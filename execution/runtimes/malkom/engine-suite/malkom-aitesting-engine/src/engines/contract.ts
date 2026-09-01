import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadOpenApiSummary } from '../openapi.js';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult } from '../types.js';
import { isOpenApiContractPath, scenarioResult } from './shared.js';
export class BuiltinContractEngine implements Engine {
  readonly name = 'builtin-contract-engine';
  readonly type = 'contract' as const;

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'contract' || scenario.type === 'schema';
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'contracts');
    await mkdir(dir, { recursive: true });
    const contractPath = context.scenario.target?.schema ?? context.config.contracts?.openApiPath ?? context.config.contracts?.asyncApiPath;
    const artifactPath = join(dir, `${context.scenario.id}.openapi-summary.json`);
    const diagnostics: string[] = [];
    const assertions: ScenarioResult['assertions'][number][] = [];
    const artifacts: ArtifactRef[] = [];
    let status: ScenarioResult['status'] = 'skipped';

    if (contractPath === undefined) {
      diagnostics.push('No OpenAPI or AsyncAPI contract configured.');
      assertions.push({ name: 'contract is configured', status: 'skipped' });
    } else {
      try {
        await access(contractPath);
        if (isOpenApiContractPath(contractPath, context)) {
          const summary = await loadOpenApiSummary(contractPath);
          assertions.push({ name: `OpenAPI contract is valid ${summary.format.toUpperCase()}`, status: 'passed' });
          assertions.push({
            name: 'OpenAPI contract exposes operations',
            status: summary.operations.length > 0 ? 'passed' : 'failed',
            ...(summary.operations.length > 0 ? {} : { message: 'No HTTP operations were found in paths.' }),
          });
          assertions.push({
            name: 'OpenAPI operations define method and path',
            status: summary.operations.every((operation) => operation.method.length > 0 && operation.path.startsWith('/')) ? 'passed' : 'failed',
          });
          for (const diagnostic of summary.diagnostics) diagnostics.push(diagnostic);
          status = assertions.some((assertion) => assertion.status === 'failed') ? 'failed' : 'passed';
          await writeFile(artifactPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
          artifacts.push({
            kind: 'json',
            path: artifactPath,
            label: 'OpenAPI operation summary',
            metadata: {
              schemaVersion: 'brisk-aitesting.openapi-summary.v1',
              scenarioId: context.scenario.id,
              operations: summary.operations.length,
            },
          });
          diagnostics.push(`OpenAPI contract parsed: ${contractPath}`);
        } else {
          const content = await readFile(contractPath, 'utf8');
          JSON.parse(content);
          status = 'passed';
          assertions.push({ name: 'contract is valid JSON', status: 'passed' });
          diagnostics.push(`Contract parsed: ${contractPath}`);
        }
      } catch (error) {
        status = 'failed';
        const message = error instanceof Error ? error.message : String(error);
        assertions.push({ name: 'contract parses', status: 'failed', message });
        diagnostics.push(message);
      }
    }

    return {
      ...(artifacts.length > 0 ? { artifacts } : {}),
      result: scenarioResult(context, {
        engine: this.name,
        status,
        durationMs: Date.now() - started,
        ...(artifacts.length > 0 ? { artifacts } : {}),
        diagnostics,
        ...(assertions.length > 0 ? { assertions } : {}),
      }),
    };
  }
}


