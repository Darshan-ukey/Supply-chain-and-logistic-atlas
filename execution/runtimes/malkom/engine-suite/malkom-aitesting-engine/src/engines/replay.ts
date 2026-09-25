import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scenarioReplayRequests, type BriskReplayRequest } from '../replay.js';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult } from '../types.js';
import { authHeaders, hasHeader, isHostAllowed, parseJsonOrNull, redactHeaders, redactValue, scenarioEvidence, scenarioResult } from './shared.js';

type ReplayRequest = BriskReplayRequest;

export class BuiltinReplayEngine implements Engine {
  readonly name = 'builtin-replay-engine';
  readonly type = 'replay' as const;

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'replay';
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'replay');
    await mkdir(dir, { recursive: true });
    const evidencePath = join(dir, `${context.scenario.id}.replay.json`);
    const requests = replayRequests(context.scenario);
    const diagnostics: string[] = [];
    const assertions: ScenarioResult['assertions'][number][] = [];
    const interactions: unknown[] = [];
    let status: ScenarioResult['status'] = requests.length === 0 ? 'skipped' : 'passed';

    if (requests.length === 0) {
      diagnostics.push('Replay scenario has no metadata.replay.requests entries.');
      assertions.push({ name: 'replay requests are provided', status: 'skipped' });
    }

    for (const request of requests) {
      const output = await replayRequest(context, request);
      interactions.push(output.evidence);
      assertions.push(output.assertion);
      diagnostics.push(output.diagnostic);
    }

    if (assertions.some((assertion) => assertion.status === 'failed')) status = 'failed';
    if (assertions.some((assertion) => assertion.status === 'error')) status = 'error';

    const artifact: ArtifactRef = {
      kind: 'json',
      path: evidencePath,
      label: 'Replay evidence',
      metadata: {
        schemaVersion: 'brisk-aitesting.replay-evidence.v1',
        scenarioId: context.scenario.id,
        interactions: requests.length,
      },
    };
    await writeFile(evidencePath, `${JSON.stringify({
      schemaVersion: 'brisk-aitesting.replay-evidence.v1',
      scenario: scenarioEvidence(context),
      interactions,
      assertions,
      diagnostics,
    }, null, 2)}\n`, 'utf8');

    return {
      artifacts: [artifact],
      result: scenarioResult(context, {
        engine: this.name,
        status,
        durationMs: Date.now() - started,
        artifacts: [artifact],
        diagnostics,
        assertions,
      }),
    };
  }
}

async function replayRequest(context: EngineContext, request: ReplayRequest): Promise<{
  readonly evidence: unknown;
  readonly assertion: ScenarioResult['assertions'][number];
  readonly diagnostic: string;
}> {
  const url = new URL(request.path, context.config.app.baseUrl);
  const headers = {
    ...authHeaders(context.config.auth, context.runState?.authSession),
    ...request.headers,
  };
  if (request.body !== undefined && typeof request.body !== 'string' && !hasHeader(headers, 'content-type')) {
    headers['content-type'] = 'application/json';
  }
  if (!isHostAllowed(url, context.config.security.allowedHosts, context.config.security.networkPolicy)) {
    return {
      evidence: {
        method: request.method,
        url: url.toString(),
        skipped: true,
        reason: `Network policy blocked host ${url.hostname}`,
      },
      assertion: { name: `${request.method} ${request.path} respects network policy`, status: 'skipped' },
      diagnostic: `Network policy blocked host ${url.hostname}`,
    };
  }

  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      ...(request.body !== undefined ? { body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body) } : {}),
      signal: AbortSignal.timeout(context.config.runtime.timeoutMs),
    });
    const responseText = await response.text();
    const expected = request.expectStatus;
    const passed = expected === undefined ? response.status < 500 : response.status === expected;
    return {
      evidence: {
        method: request.method,
        url: url.toString(),
        durationMs: Date.now() - started,
        request: {
          headers: redactHeaders(headers, context.config.security.redactSecrets),
          body: redactValue(request.body, context.config.security.redactSecrets),
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          body: parseJsonOrNull(responseText) ?? responseText,
        },
      },
      assertion: {
        name: expected === undefined ? `${request.method} ${request.path} returns below 500` : `${request.method} ${request.path} returns ${expected}`,
        status: passed ? 'passed' : 'failed',
        ...(passed ? {} : { message: expected === undefined ? `Expected status below 500, got ${response.status}.` : `Expected ${expected}, got ${response.status}.` }),
      },
      diagnostic: `${request.method} ${request.path} returned HTTP ${response.status}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      evidence: {
        method: request.method,
        url: url.toString(),
        error: message,
      },
      assertion: { name: `${request.method} ${request.path} replays`, status: 'error', message },
      diagnostic: message,
    };
  }
}

function replayRequests(scenario: ScenarioPlan): readonly ReplayRequest[] {
  return scenarioReplayRequests(scenario);
}

