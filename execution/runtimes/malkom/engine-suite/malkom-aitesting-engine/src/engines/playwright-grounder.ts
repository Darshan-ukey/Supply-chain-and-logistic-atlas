import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { UiGroundingEvidence, UiRouteGrounder, UiRouteGrounderContext, UiRouteGrounderResult } from '../types.js';
import { browserGroundingFunctionSource } from './shared.js';
import { browserLaunchOptions, loadChromium, type SharedBrowser } from './playwright-runtime.js';

/**
 * Grounds a planned UI scenario against the real rendered page: one shared
 * browser for the whole run, one fresh isolated context per page. Starting a
 * browser per scenario costs seconds each and proves nothing; the isolation
 * that matters (cookies, storage, page state) lives in the context, which is
 * cheap. Concurrent ground() calls are safe — contexts are independent and
 * the launch itself is raced through one promise.
 */
export class BuiltinPlaywrightRouteGrounder implements UiRouteGrounder {
  readonly name = 'builtin-playwright-route-grounder';
  private browser: Promise<SharedBrowser> | undefined;
  private browserLaunchMs = 0;

  async ground(context: UiRouteGrounderContext): Promise<UiRouteGrounderResult> {
    const artifactsRoot = resolve(context.config.runtime.artifactsDir);
    const dir = join(artifactsRoot, context.runId, 'grounding');
    await mkdir(dir, { recursive: true });
    const route = context.scenario.target?.route ?? '/';
    const targetUrl = new URL(route, context.config.app.uiBaseUrl ?? context.config.app.baseUrl).toString();
    const groundingPath = join(dir, `${context.scenario.id}.ui-grounding.json`);
    const logPath = join(dir, `${context.scenario.id}.grounding.log`);
    const timeoutMs = Math.max(1_000, context.config.runtime.timeoutMs);
    const logLines: string[] = [];
    const startedAt = Date.now();

    let grounding: UiGroundingEvidence;
    try {
      const alreadyRunning = this.browser !== undefined;
      const browser = await this.sharedBrowser(context.config.runtime.headless, context.config.runtime.browserExecutablePath);
      logLines.push(alreadyRunning
        ? `Browser reused (started once for this run in ${this.browserLaunchMs} ms).`
        : `Browser started once for this run in ${this.browserLaunchMs} ms.`);
      const browserContext = await browser.newContext({});
      try {
        const page = await browserContext.newPage();
        const navigationStartedAt = Date.now();
        await page.goto(targetUrl, { timeout: timeoutMs });
        await page.locator('body').waitFor({ state: 'visible', timeout: timeoutMs });
        logLines.push(`Page ${targetUrl} loaded in ${Date.now() - navigationStartedAt} ms.`);
        // Playwright evaluates a STRING page function as a bare expression and
        // ignores the argument parameter, so the argument is inlined into the
        // call expression itself (JSON is a valid JS literal once the two
        // line-separator characters are escaped).
        const argument = JSON.stringify({
          scenario: {
            id: context.scenario.id,
            name: context.scenario.name,
            objective: context.scenario.objective,
          },
          route,
          url: targetUrl,
        }).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
        grounding = await page.evaluate<UiGroundingEvidence>(`(${browserGroundingFunctionSource()})(${argument})`);
        logLines.push(`Grounded ${grounding.summary.total} element(s), ${grounding.summary.actionable} actionable, in ${Date.now() - startedAt} ms total.`);
      } finally {
        await browserContext.close().catch(() => undefined);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] ?? error.message : String(error);
      logLines.push(`Grounding failed after ${Date.now() - startedAt} ms: ${reason}`);
      await writeFile(logPath, `${logLines.join('\n')}\n`, 'utf8').catch(() => undefined);
      throw new Error(`Route grounding failed for ${route}: ${reason}`);
    }

    await writeFile(groundingPath, `${JSON.stringify(grounding, null, 2)}\n`, 'utf8');
    await writeFile(logPath, `${logLines.join('\n')}\n`, 'utf8');
    return {
      grounding,
      artifacts: [
        {
          kind: 'json',
          path: groundingPath,
          label: 'Pre-execution UI grounding evidence',
          metadata: {
            schemaVersion: 'brisk-aitesting.ui-grounding.v1',
            scenarioId: context.scenario.id,
            phase: 'pre-execution',
            elements: grounding.summary.total,
            actionable: grounding.summary.actionable,
          },
        },
        {
          kind: 'log',
          path: logPath,
          label: 'Pre-execution UI grounding log',
          metadata: { scenarioId: context.scenario.id, phase: 'pre-execution' },
        },
      ],
    };
  }

  async dispose(): Promise<void> {
    const pending = this.browser;
    this.browser = undefined;
    if (pending === undefined) return;
    try {
      const browser = await pending;
      await browser.close();
    } catch {
      // A browser that failed to launch has nothing to close.
    }
  }

  private sharedBrowser(headless: boolean, executablePath?: string): Promise<SharedBrowser> {
    if (this.browser === undefined) {
      const startedAt = Date.now();
      this.browser = loadChromium()
        .launch(browserLaunchOptions({ headless, ...(executablePath === undefined ? {} : { executablePath }) }))
        .then((browser) => {
          this.browserLaunchMs = Date.now() - startedAt;
          return browser;
        })
        .catch((error: unknown) => {
          // A failed launch must not poison every later ground() call.
          this.browser = undefined;
          throw error;
        });
    }
    return this.browser;
  }
}
