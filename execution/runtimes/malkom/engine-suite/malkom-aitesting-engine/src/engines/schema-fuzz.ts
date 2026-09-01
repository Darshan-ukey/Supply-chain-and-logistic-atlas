import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadOpenApiSummary } from '../openapi.js';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, OpenApiOperationSummary, ScenarioPlan, ScenarioResult } from '../types.js';
import { authHeaders, isHostAllowed, redactHeaders, redactValue, scenarioEvidence, scenarioResult } from './shared.js';

export class BuiltinSchemaFuzzEngine implements Engine {
  readonly name = 'builtin-schema-fuzz-engine';
  readonly type = 'schema' as const;

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'schema' && String(scenario.metadata?.adapter ?? '').toLowerCase() !== 'schemathesis';
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'schema-fuzz');
    await mkdir(dir, { recursive: true });
    const evidencePath = join(dir, `${context.scenario.id}.schema-fuzz.json`);
    const schemaPath = context.scenario.target?.schema ?? context.config.contracts?.openApiPath;
    const diagnostics: string[] = [];
    const assertions: ScenarioResult['assertions'][number][] = [];
    let status: ScenarioResult['status'] = 'skipped';
    const checks: unknown[] = [];

    if (schemaPath === undefined) {
      diagnostics.push('No OpenAPI schema path configured for schema fuzzing.');
      assertions.push({ name: 'OpenAPI schema is configured', status: 'skipped' });
    } else {
      try {
        const summary = await loadOpenApiSummary(schemaPath);
        const operations = summary.operations.filter(isFuzzableOperation);
        assertions.push({
          name: 'OpenAPI exposes fuzzable request schemas',
          status: operations.length > 0 ? 'passed' : 'skipped',
          ...(operations.length > 0 ? {} : { message: 'No operations with invalid request examples were found.' }),
        });

        for (const operation of operations.slice(0, scenarioLimit(context.scenario))) {
          const output = await runInvalidRequest(context, operation);
          checks.push(output.evidence);
          assertions.push(output.assertion);
          diagnostics.push(output.diagnostic);
        }

        if (assertions.some((assertion) => assertion.status === 'failed')) status = 'failed';
        else if (assertions.some((assertion) => assertion.status === 'passed')) status = 'passed';
      } catch (error) {
        status = 'error';
        const message = error instanceof Error ? error.message : String(error);
        diagnostics.push(message);
        assertions.push({ name: 'schema fuzzing completes', status: 'error', message });
      }
    }

    const artifact: ArtifactRef = {
      kind: 'json',
      path: evidencePath,
      label: 'Schema fuzz evidence',
      metadata: {
        schemaVersion: 'brisk-aitesting.schema-fuzz-evidence.v1',
        scenarioId: context.scenario.id,
      },
    };
    await writeFile(evidencePath, `${JSON.stringify({
      schemaVersion: 'brisk-aitesting.schema-fuzz-evidence.v1',
      scenario: scenarioEvidence(context),
      schemaPath,
      checks,
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

function isFuzzableOperation(operation: OpenApiOperationSummary): boolean {
  return operation.invalidRequestExample !== undefined && !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(operation.method);
}

function scenarioLimit(scenario: ScenarioPlan): number {
  const limit = scenario.metadata?.maxFuzzOperations;
  return typeof limit === 'number' && Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 10;
}

async function runInvalidRequest(context: EngineContext, operation: OpenApiOperationSummary): Promise<{
  readonly evidence: unknown;
  readonly assertion: ScenarioResult['assertions'][number];
  readonly diagnostic: string;
}> {
  const url = new URL(operation.path.replace(/\{[^/{}]+\}/g, '1'), context.config.app.baseUrl);
  const headers = {
    ...authHeaders(context.config.auth, context.runState?.authSession),
    'content-type': operation.requestContentTypes.find((entry) => entry.includes('json')) ?? 'application/json',
  };
  if (!isHostAllowed(url, context.config.security.allowedHosts, context.config.security.networkPolicy)) {
    return {
      evidence: {
        method: operation.method,
        url: url.toString(),
        skipped: true,
        reason: `Network policy blocked host ${url.hostname}`,
      },
      assertion: { name: `${operation.method} ${operation.path} respects network policy`, status: 'skipped' },
      diagnostic: `Network policy blocked host ${url.hostname}`,
    };
  }

  const started = Date.now();
  const response = await fetch(url, {
    method: operation.method,
    headers,
    body: JSON.stringify(operation.invalidRequestExample),
    signal: AbortSignal.timeout(context.config.runtime.timeoutMs),
  });
  const responseText = await response.text();
  const passed = response.status >= 400 && response.status < 500;
  return {
    evidence: {
      operationId: operation.operationId,
      method: operation.method,
      url: url.toString(),
      durationMs: Date.now() - started,
      request: {
        headers: redactHeaders(headers, context.config.security.redactSecrets),
        body: redactValue(operation.invalidRequestExample, context.config.security.redactSecrets),
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        body: responseText.slice(0, 2000),
      },
    },
    assertion: {
      name: `${operation.method} ${operation.path} rejects malformed request`,
      status: passed ? 'passed' : 'failed',
      ...(passed ? {} : { message: `Expected 4xx rejection, got ${response.status}.` }),
    },
    diagnostic: `${operation.method} ${operation.path} returned HTTP ${response.status}.`,
  };
}
