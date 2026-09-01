import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult, UiElementEvidence } from '../types.js';
import { browserGroundingFunctionSource, readUiGroundingSummary, scenarioEvidence, scenarioResult } from './shared.js';
import { findHealingCandidate, isCompatibleEvidence, isSensitiveAction, locatorForEvidence, performUiAction } from './playwright-actions.js';
import { browserLaunchOptions, loadChromium, type BrowserContextLike, type PageLike, type SharedBrowser } from './playwright-runtime.js';

/**
 * Runs page checks in this process against one browser that stays open for
 * the whole run.
 *
 * The previous design started a separate Playwright process and a separate
 * browser for every single check. Measured on a real application that cost
 * about three seconds per check before the page was even opened, which is
 * time spent waiting rather than testing, and it pushed slower pages against
 * their deadline. The browser is now started once and reused.
 */
/** The value or text an action carries, when its kind has one. */
function describeActionInput(action: import('../types.js').UiActionPlan): string {
  const record = action as unknown as Record<string, unknown>;
  if (typeof record.value === 'string') return ` with "${record.value}"`;
  if (typeof record.text === 'string') return ` expecting "${record.text}"`;
  if (typeof record.key === 'string') return ` pressing "${record.key}"`;
  return '';
}

export class BuiltinPlaywrightEngine implements Engine {
  readonly name = 'builtin-playwright-engine';
  readonly type = 'ui' as const;
  /**
   * An open browser holds the host process open. A host that never calls
   * dispose must still be able to exit, so an idle browser closes itself.
   */
  private static readonly IDLE_CLOSE_MS = 10_000;
  private browser?: SharedBrowser;
  private browserLaunchMs = 0;
  private idleTimer?: NodeJS.Timeout;

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'ui';
  }

  /** Closed by the orchestrator when the run finishes. */
  async dispose(): Promise<void> {
    this.cancelIdleClose();
    const browser = this.browser;
    delete this.browser;
    if (browser !== undefined) await browser.close().catch(() => undefined);
  }

  private cancelIdleClose(): void {
    if (this.idleTimer === undefined) return;
    clearTimeout(this.idleTimer);
    delete this.idleTimer;
  }

  /** Close the browser when no page check has needed it for a while. */
  private scheduleIdleClose(): void {
    this.cancelIdleClose();
    this.idleTimer = setTimeout(() => { void this.dispose(); }, BuiltinPlaywrightEngine.IDLE_CLOSE_MS);
    // The timer itself must never hold the process open either.
    this.idleTimer.unref?.();
  }

  private async sharedBrowser(headless: boolean, executablePath?: string): Promise<SharedBrowser> {
    this.cancelIdleClose();
    if (this.browser !== undefined) return this.browser;
    const startedAt = Date.now();
    const chromium = loadChromium();
    this.browser = await chromium.launch(browserLaunchOptions({ headless, ...(executablePath === undefined ? {} : { executablePath }) }));
    this.browserLaunchMs = Date.now() - startedAt;
    return this.browser;
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const artifactsRoot = resolve(context.config.runtime.artifactsDir);
    const dir = join(artifactsRoot, context.runId, 'playwright');
    await mkdir(dir, { recursive: true });
    const id = context.scenario.id;
    const reportPath = join(dir, `${id}.report.json`);
    const logPath = join(dir, `${id}.log`);
    const manifestPath = join(dir, `${id}.evidence.json`);
    const groundingPath = join(dir, `${id}.ui-grounding.json`);
    const actionEvidencePath = join(dir, `${id}.ui-actions.json`);
    const healingEvidencePath = join(dir, `${id}.ui-healing.json`);
    const tracePath = join(dir, `${id}.trace.zip`);
    const screenshotPath = join(dir, `${id}.screenshot.png`);
    const planPath = join(dir, `${id}.check-plan.json`);

    const route = context.scenario.target?.route ?? '/';
    const targetUrl = new URL(route, context.config.app.uiBaseUrl ?? context.config.app.baseUrl).toString();
    const uiActions = context.scenario.uiActions ?? [];
    const healingPolicy = context.config.security.uiHealing ?? 'safe';
    const session = context.runState?.authSession;
    if (session === undefined && (context.config.auth.type === 'credentials' || context.config.auth.type === 'custom')) {
      throw new Error(`Sign-in type "${context.config.auth.type}" is configured but no session was created for this run. The run must log in before executing UI tests.`);
    }
    const sessionHeaders = session?.headers ?? {};
    const sessionCookies = session?.cookies ?? [];
    // Waiting for content must fit inside the scenario's own time budget so a
    // slow page is reported as a slow page, never as a blunt engine timeout.
    const contentWaitMs = Math.max(2_000, Math.min(10_000, Math.floor(context.config.runtime.timeoutMs / 3)));

    // A readable record of exactly what this check does, kept as evidence in
    // place of the generated test file the old design executed.
    const checkPlan = {
      schemaVersion: 'brisk-aitesting.ui-check-plan.v1',
      scenario: scenarioEvidence(context),
      target: { route, url: targetUrl },
      steps: [
        `Open ${targetUrl}`,
        `Wait up to ${Math.round(contentWaitMs / 1000)} seconds for the page to show content`,
        'Record every control the page exposes',
        ...uiActions.map((action) => `${action.action} on ${action.evidenceId}${describeActionInput(action)}`),
      ],
      session: { headers: Object.keys(sessionHeaders), cookies: sessionCookies.map((cookie) => cookie.name) },
      healingPolicy,
    };
    await writeFile(planPath, `${JSON.stringify(checkPlan, null, 2)}\n`, 'utf8');
    const planArtifact: ArtifactRef = {
      kind: 'test-file',
      path: planPath,
      label: 'Page check plan',
      metadata: { scenarioId: id, route },
    };

    if (context.config.runtime.dryRun) {
      return {
        artifacts: [planArtifact],
        result: scenarioResult(context, {
          engine: this.name,
          status: 'skipped',
          durationMs: Date.now() - started,
          artifacts: [planArtifact],
          diagnostics: ['Dry run enabled; the page check was prepared but not executed.'],
        }),
      };
    }

    const logLines: string[] = [];
    const actionLog: Record<string, unknown>[] = [];
    const healingEvents: Record<string, unknown>[] = [];
    const assertions: ScenarioResult['assertions'][number][] = [];
    let grounding: { elements: UiElementEvidence[] } = { elements: [] };
    let failureReason: string | undefined;
    let context_: BrowserContextLike | undefined;
    let page: PageLike | undefined;
    let tracing = false;

    try {
      const browser = await this.sharedBrowser(context.config.runtime.headless, context.config.runtime.browserExecutablePath);
      logLines.push(`Browser ready (started once for this run in ${this.browserLaunchMs} ms).`);
      context_ = await browser.newContext({
        ...(Object.keys(sessionHeaders).length > 0 ? { extraHTTPHeaders: sessionHeaders } : {}),
      });
      await context_.tracing.start({ screenshots: true, snapshots: true, sources: false });
      tracing = true;
      if (sessionCookies.length > 0) await context_.addCookies(sessionCookies);
      page = await context_.newPage();

      // Wait only for the navigation to start here. Development servers build
      // a page's code on first visit, which can hold "loaded" for many
      // seconds; whether the page really works is decided by the content
      // check below, which reports honestly and stays inside the budget.
      await page.goto(targetUrl, { waitUntil: 'commit', timeout: contentWaitMs });
      // Navigation has only started, so the page is given time to appear.
      let bodyVisible = true;
      await page.locator('body').waitFor({ state: 'visible', timeout: contentWaitMs })
        .catch(() => { bodyVisible = false; });
      assertions.push({
        name: 'the page opens',
        status: bodyVisible ? 'passed' : 'failed',
        ...(bodyVisible ? {} : { message: `The page at ${targetUrl} did not open within ${Math.round(contentWaitMs / 1000)} seconds.` }),
      });
      if (!bodyVisible) throw new Error(`The page at ${targetUrl} did not open within ${Math.round(contentWaitMs / 1000)} seconds.`);

      // Many real pages paint an empty shell and fill it after fetching data,
      // so content is awaited rather than judged at the first instant.
      let hasContent = true;
      await page.waitForFunction(
        'document.body !== null && document.body.innerText.trim().length > 0',
        undefined,
        { timeout: contentWaitMs },
      ).catch(() => { hasContent = false; });
      assertions.push({
        name: 'the page shows content',
        status: hasContent ? 'passed' : 'failed',
        ...(hasContent ? {} : { message: `The page opened but showed no content within ${Math.round(contentWaitMs / 1000)} seconds.` }),
      });
      if (!hasContent) throw new Error(`The page opened but showed no content within ${Math.round(contentWaitMs / 1000)} seconds.`);

      grounding = await page.evaluate<{ elements: UiElementEvidence[] }>(
        `(${browserGroundingFunctionSource()})(${JSON.stringify({
          scenario: { id, name: context.scenario.name, objective: context.scenario.objective },
          route,
          url: targetUrl,
        })})`,
      );
      await writeFile(groundingPath, `${JSON.stringify(grounding, null, 2)}\n`, 'utf8');
      logLines.push(`Recorded ${grounding.elements.length} controls on the page.`);

      for (const action of uiActions) {
        let evidence = grounding.elements.find((element) => element.id === action.evidenceId);
        let locator;
        try {
          if (evidence === undefined) throw new Error(`This action points at control ${action.evidenceId}, which the page does not expose.`);
          if (!isCompatibleEvidence(action, evidence)) {
            throw new Error(`Action ${action.action} points at control ${action.evidenceId}, which is a ${evidence.role ?? evidence.tagName} and cannot take it.`);
          }
          locator = locatorForEvidence(page, evidence);
          await locator.first().waitFor({ state: 'visible', timeout: 5_000 });
        } catch (firstError) {
          const fresh = await page.evaluate<{ elements: UiElementEvidence[] }>(
            `(${browserGroundingFunctionSource()})(${JSON.stringify({
              scenario: { id, name: context.scenario.name, objective: context.scenario.objective },
              route,
              url: targetUrl,
            })})`,
          );
          if (healingPolicy === 'off' || isSensitiveAction(action, evidence)) throw firstError;
          const healed = findHealingCandidate(action, evidence, fresh.elements, healingPolicy);
          if (healed === undefined) throw firstError;
          locator = locatorForEvidence(page, healed);
          await locator.first().waitFor({ state: 'visible', timeout: 5_000 });
          healingEvents.push({
            schemaVersion: 'brisk-aitesting.ui-healing-event.v1',
            action: action.action,
            evidenceId: action.evidenceId,
            reason: firstError instanceof Error ? firstError.message : String(firstError),
            before: evidence ?? null,
            after: healed,
          });
          evidence = healed;
        }
        await performUiAction(locator, action);
        actionLog.push({ action: action.action, evidenceId: action.evidenceId, locator: evidence?.locator, status: 'passed' });
        assertions.push({ name: `${action.action} on ${action.evidenceId}`, status: 'passed' });
      }
    } catch (error) {
      failureReason = error instanceof Error ? error.message : String(error);
      logLines.push(failureReason);
      if (assertions.every((assertion) => assertion.status === 'passed')) {
        assertions.push({ name: 'the page check completes', status: 'failed', message: failureReason });
      }
    } finally {
      // Evidence is captured for every check, passing or failing.
      if (page !== undefined) await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
      if (context_ !== undefined && tracing) await context_.tracing.stop({ path: tracePath }).catch(() => undefined);
      if (context_ !== undefined) await context_.close().catch(() => undefined);
    }

    await writeFile(actionEvidencePath, `${JSON.stringify({ schemaVersion: 'brisk-aitesting.ui-actions.v1', scenario: scenarioEvidence(context), actions: actionLog }, null, 2)}\n`, 'utf8');
    await writeFile(healingEvidencePath, `${JSON.stringify({ schemaVersion: 'brisk-aitesting.ui-healing.v1', scenario: scenarioEvidence(context), events: healingEvents }, null, 2)}\n`, 'utf8');
    await writeFile(logPath, logLines.join('\n'), 'utf8');

    const passed = failureReason === undefined;
    const durationMs = Date.now() - started;
    const report = {
      schemaVersion: 'brisk-aitesting.playwright-report.v1',
      total: 1,
      passed: passed ? 1 : 0,
      failed: passed ? 0 : 1,
      durationMs,
      assertions,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const groundingSummary = await readUiGroundingSummary(groundingPath);

    const artifacts: ArtifactRef[] = [
      planArtifact,
      { kind: 'json', path: reportPath, label: 'Page check report', metadata: { scenarioId: id } },
      { kind: 'log', path: logPath, label: 'Page check log', metadata: { scenarioId: id } },
      { kind: 'json', path: groundingPath, label: 'UI grounding evidence', metadata: { schemaVersion: 'brisk-aitesting.ui-grounding.v1', scenarioId: id, elements: groundingSummary.total, actionable: groundingSummary.actionable } },
      { kind: 'json', path: actionEvidencePath, label: 'Grounded UI action evidence', metadata: { schemaVersion: 'brisk-aitesting.ui-actions.v1', scenarioId: id, actions: uiActions.length } },
      { kind: 'json', path: healingEvidencePath, label: 'UI healing evidence', metadata: { schemaVersion: 'brisk-aitesting.ui-healing.v1', scenarioId: id } },
      { kind: 'trace', path: tracePath, label: 'Page trace', metadata: { scenarioId: id } },
      { kind: 'screenshot', path: screenshotPath, label: 'Page screenshot', metadata: { scenarioId: id } },
      { kind: 'json', path: manifestPath, label: 'Playwright evidence manifest', metadata: { schemaVersion: 'brisk-aitesting.playwright-evidence.v1', scenarioId: id } },
    ];
    const diagnostics = passed
      ? [`Page check passed in ${durationMs} ms.`, ...logLines]
      : [failureReason ?? 'The page check failed.', ...logLines];

    await writeFile(manifestPath, `${JSON.stringify({
      schemaVersion: 'brisk-aitesting.playwright-evidence.v1',
      scenario: scenarioEvidence(context),
      target: { route, url: targetUrl },
      execution: {
        exitCode: passed ? 0 : 1,
        timedOut: false,
        durationMs,
        browserStartMs: this.browserLaunchMs,
        browserReused: this.browserLaunchMs > 0 && durationMs > 0,
      },
      report,
      grounding: { schemaVersion: 'brisk-aitesting.ui-grounding.v1', path: groundingPath, summary: groundingSummary },
      actions: { schemaVersion: 'brisk-aitesting.ui-actions.v1', path: actionEvidencePath, planned: uiActions.length },
      healing: { schemaVersion: 'brisk-aitesting.ui-healing.v1', path: healingEvidencePath },
      artifacts: artifacts.filter((artifact) => artifact.path !== manifestPath),
      diagnostics,
    }, null, 2)}\n`, 'utf8');

    // Keep the browser warm for the next check, but never past the point
    // where it would stop the host process from exiting on its own.
    this.scheduleIdleClose();
    return {
      artifacts,
      result: scenarioResult(context, {
        engine: this.name,
        status: passed ? 'passed' : 'failed',
        durationMs,
        artifacts,
        diagnostics,
        assertions,
        ...(passed ? {} : { failureCategory: 'application_assertion' as const, failureReason: failureReason ?? 'The page check failed.' }),
      }),
    };
  }
}
