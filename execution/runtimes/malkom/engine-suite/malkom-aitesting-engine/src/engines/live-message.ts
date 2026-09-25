import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult } from '../types.js';
import { assertJsonShape, assertStatus, authHeaders, headersToRecord, isHostAllowed, parseJsonOrNull, redactHeaders, redactValue, scenarioEvidence, scenarioResult, serializeBody, type HeaderRecord } from './shared.js';

export class BuiltinLiveMessageEngine implements Engine {
  readonly name = 'builtin-live-message-engine';
  readonly type = 'message' as const;

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'message' && adapterName(scenario) === 'live-message';
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'live-message');
    await mkdir(dir, { recursive: true });
    const artifactPath = join(dir, `${context.scenario.id}.live-message-evidence.json`);
    const flow = liveMessageFlow(context.scenario);
    const diagnostics: string[] = [];
    const assertions: ScenarioResult['assertions'][number][] = [];
    const interactions: LiveMessageInteraction[] = [];
    let status: ScenarioResult['status'] = 'passed';

    if (flow === undefined) {
      status = 'failed';
      diagnostics.push('Message scenario metadata.liveMessage must define publish and verify HTTP steps.');
    } else if (context.config.runtime.dryRun) {
      status = 'skipped';
      diagnostics.push('Dry run enabled; live message flow was planned but not executed.');
    } else {
      const publish = await executeHttpStep(context, flow.publish, 'publish');
      interactions.push(publish.interaction);
      assertions.push(publish.statusAssertion);
      if (publish.error !== undefined) {
        status = 'error';
        diagnostics.push(publish.error);
      } else {
        const verification = await pollVerification(context, flow);
        interactions.push(...verification.interactions);
        assertions.push(...verification.assertions);
        diagnostics.push(...verification.diagnostics);
        if (verification.error !== undefined) {
          status = 'error';
          diagnostics.push(verification.error);
        }
      }
      if (status === 'passed' && assertions.some((assertion) => assertion.status === 'failed')) status = 'failed';
    }

    const evidence = {
      schemaVersion: 'brisk-aitesting.live-message-evidence.v1',
      scenario: scenarioEvidence(context),
      channel: context.scenario.target?.channel,
      status,
      flow: flow === undefined ? undefined : redactValue(flow, context.config.security.redactSecrets),
      interactions: redactValue(interactions, context.config.security.redactSecrets),
      assertions,
      diagnostics,
    };
    await writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    const artifact: ArtifactRef = {
      kind: 'json',
      path: artifactPath,
      label: 'Live message flow evidence',
      metadata: {
        schemaVersion: 'brisk-aitesting.live-message-evidence.v1',
        scenarioId: context.scenario.id,
        ...(context.scenario.target?.channel !== undefined ? { channel: context.scenario.target.channel } : {}),
      },
    };

    return {
      artifacts: [artifact],
      result: scenarioResult(context, {
        engine: this.name,
        status,
        durationMs: Date.now() - started,
        artifacts: [artifact],
        diagnostics,
        ...(assertions.length > 0 ? { assertions } : {}),
      }),
    };
  }
}

interface LiveMessageFlow {
  readonly publish: LiveMessageHttpStep;
  readonly verify: LiveMessageHttpStep & {
    readonly expect?: ScenarioPlan['expect'];
  };
  readonly poll?: {
    readonly attempts?: number;
    readonly intervalMs?: number;
  };
}

interface LiveMessageHttpStep {
  readonly method?: string;
  readonly path: string;
  readonly headers?: Record<string, string>;
  readonly query?: Record<string, string | number | boolean>;
  readonly body?: unknown;
  readonly expect?: ScenarioPlan['expect'];
}

interface LiveMessageInteraction {
  readonly step: 'publish' | 'verify';
  readonly method: string;
  readonly url: string;
  readonly request: {
    readonly headers: Record<string, string>;
    readonly body?: unknown;
  };
  readonly response?: {
    readonly status: number;
    readonly headers: Record<string, string>;
    readonly body: unknown;
  };
  readonly durationMs?: number;
  readonly error?: string;
}

async function pollVerification(context: EngineContext, flow: LiveMessageFlow): Promise<{
  readonly interactions: readonly LiveMessageInteraction[];
  readonly assertions: readonly ScenarioResult['assertions'][number][];
  readonly diagnostics: readonly string[];
  readonly error?: string;
}> {
  const attempts = clampInteger(flow.poll?.attempts, 1, 20, 5);
  const intervalMs = clampInteger(flow.poll?.intervalMs, 0, 5000, 100);
  const interactions: LiveMessageInteraction[] = [];
  const diagnostics: string[] = [];
  let lastAssertions: ScenarioResult['assertions'][number][] = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const verification = await executeHttpStep(context, flow.verify, 'verify');
    interactions.push(verification.interaction);
    if (verification.error !== undefined) return { interactions, assertions: lastAssertions, diagnostics, error: verification.error };
    lastAssertions = [
      verification.statusAssertion,
      ...verification.jsonAssertions,
    ];
    if (lastAssertions.every((assertion) => assertion.status === 'passed')) {
      diagnostics.push(`Live message verification passed on attempt ${attempt}/${attempts}.`);
      return { interactions, assertions: lastAssertions, diagnostics };
    }
    if (attempt < attempts && intervalMs > 0) await delay(intervalMs);
  }

  diagnostics.push(`Live message verification did not pass within ${attempts} attempt(s).`);
  return { interactions, assertions: lastAssertions, diagnostics };
}

async function executeHttpStep(context: EngineContext, step: LiveMessageHttpStep, name: 'publish' | 'verify'): Promise<{
  readonly interaction: LiveMessageInteraction;
  readonly statusAssertion: ScenarioResult['assertions'][number];
  readonly jsonAssertions: readonly ScenarioResult['assertions'][number][];
  readonly error?: string;
}> {
  const method = (step.method ?? (name === 'publish' ? 'POST' : 'GET')).toUpperCase();
  const url = new URL(step.path, context.config.app.baseUrl);
  for (const [key, value] of Object.entries(step.query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const headers: HeaderRecord = {
    ...authHeaders(context.config.auth, context.runState?.authSession),
    ...step.headers,
  };
  const interaction: LiveMessageInteraction = {
    step: name,
    method,
    url: url.toString(),
    request: {
      headers: redactHeaders(headers, context.config.security.redactSecrets),
      ...(step.body !== undefined ? { body: redactValue(step.body, context.config.security.redactSecrets) } : {}),
    },
  };

  if (!isHostAllowed(url, context.config.security.allowedHosts, context.config.security.networkPolicy)) {
    return {
      interaction: { ...interaction, error: `Network policy blocked host ${url.hostname}` },
      statusAssertion: { name: `${name} network policy allows ${url.hostname}`, status: 'skipped' },
      jsonAssertions: [],
    };
  }

  try {
    const started = Date.now();
    const response = await fetch(url, {
      method,
      headers,
      ...(step.body !== undefined ? { body: serializeBody(step.body, headers) } : {}),
      signal: AbortSignal.timeout(context.config.runtime.timeoutMs),
    });
    const text = await response.text();
    const body = parseJsonOrNull(text) ?? text;
    const completed: LiveMessageInteraction = {
      ...interaction,
      durationMs: Date.now() - started,
      response: {
        status: response.status,
        headers: headersToRecord(response.headers),
        body,
      },
    };
    return {
      interaction: completed,
      statusAssertion: assertStatus(response.status, step.expect?.status),
      jsonAssertions: step.expect?.json === undefined ? [] : assertJsonShape(body, step.expect.json),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      interaction: { ...interaction, error: message },
      statusAssertion: { name: `${name} HTTP step executed`, status: 'error', message },
      jsonAssertions: [],
      error: message,
    };
  }
}

function liveMessageFlow(scenario: ScenarioPlan): LiveMessageFlow | undefined {
  const metadata = scenario.metadata?.liveMessage;
  if (!isRecord(metadata)) return undefined;
  const publish = parseStep(metadata.publish);
  const verify = parseStep(metadata.verify);
  if (publish === undefined || verify === undefined) return undefined;
  return {
    publish,
    verify,
    ...(isRecord(metadata.poll) ? { poll: metadata.poll } : {}),
  };
}

function parseStep(value: unknown): LiveMessageHttpStep | undefined {
  if (!isRecord(value) || typeof value.path !== 'string' || !value.path.startsWith('/')) return undefined;
  return {
    ...(typeof value.method === 'string' ? { method: value.method } : {}),
    path: value.path,
    ...(isStringRecord(value.headers) ? { headers: value.headers } : {}),
    ...(isQueryRecord(value.query) ? { query: value.query } : {}),
    ...('body' in value ? { body: value.body } : {}),
    ...(isRecord(value.expect) ? { expect: value.expect as ScenarioPlan['expect'] } : {}),
  };
}

function adapterName(scenario: ScenarioPlan): string | undefined {
  const adapter = scenario.metadata?.adapter ?? scenario.metadata?.engine;
  return typeof adapter === 'string' ? adapter.toLowerCase() : undefined;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isQueryRecord(value: unknown): value is Record<string, string | number | boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean');
}
