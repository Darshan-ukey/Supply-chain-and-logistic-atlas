import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult } from './types.js';
import { firstUsefulLine, scenarioEvidence, scenarioResult } from './engines/shared.js';

export interface PactMessageEngineOptions {
  readonly pactUrls?: readonly string[];
  readonly pactDir?: string;
  readonly provider?: string;
  readonly messageProviders?: Record<string, () => unknown | Promise<unknown>>;
}

export class PactMessageEngine implements Engine {
  readonly name = 'pact-message-engine';
  readonly type = 'message' as const;

  constructor(private readonly options: PactMessageEngineOptions = {}) {}

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'message' && adapterName(scenario) === 'pact';
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'pact');
    await mkdir(dir, { recursive: true });
    const evidencePath = join(dir, `${context.scenario.id}.pact-message-evidence.json`);
    const logPath = join(dir, `${context.scenario.id}.pact-message.log`);
    const diagnostics: string[] = [];
    const assertions: ScenarioResult['assertions'][number][] = [];
    const pactUrls = pactUrlsFromScenario(context.scenario) ?? this.options.pactUrls ?? pactUrlsFromConfig(context);
    const provider = providerFromScenario(context.scenario) ?? this.options.provider ?? context.config.app.name;
    const messageProviders = this.messageProvidersFor(context.scenario);
    let status: ScenarioResult['status'] = 'passed';
    let verification: unknown;

    if (pactUrls.length === 0) {
      status = 'failed';
      diagnostics.push('Pact message scenario needs metadata.pact.pactUrls, engine pactUrls, or config.contracts.pactDir.');
    } else if (Object.keys(messageProviders).length === 0) {
      status = 'failed';
      diagnostics.push('Pact message scenario needs a message provider function for the pact interaction description.');
    } else if (context.config.runtime.dryRun) {
      status = 'skipped';
      diagnostics.push('Dry run enabled; Pact verification was planned but not executed.');
    } else {
      try {
        const pact = await import('@pact-foundation/pact');
        const verifier = new pact.MessageProviderPact({
          provider,
          pactUrls: [...pactUrls],
          messageProviders,
          logLevel: 'error',
        });
        verification = await verifier.verify();
        assertions.push({ name: 'Pact message provider verification passed', status: 'passed' });
        diagnostics.push('Pact message provider verification completed.');
      } catch (error) {
        status = 'failed';
        const message = error instanceof Error ? error.message : String(error);
        assertions.push({ name: 'Pact message provider verification passed', status: 'failed', message: firstUsefulLine(message) });
        diagnostics.push(message);
      }
    }

    const evidence = {
      schemaVersion: 'brisk-aitesting.pact-message-evidence.v1',
      scenario: scenarioEvidence(context),
      status,
      provider,
      pactUrls,
      messageProviderNames: Object.keys(messageProviders),
      verification,
      assertions,
      diagnostics,
    };
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    await writeFile(logPath, `${diagnostics.join('\n')}\n`, 'utf8');
    const artifacts: ArtifactRef[] = [
      {
        kind: 'json',
        path: evidencePath,
        label: 'Pact message evidence',
        metadata: { schemaVersion: 'brisk-aitesting.pact-message-evidence.v1', scenarioId: context.scenario.id },
      },
      {
        kind: 'log',
        path: logPath,
        label: 'Pact message log',
        metadata: { scenarioId: context.scenario.id },
      },
    ];

    return {
      artifacts,
      result: scenarioResult(context, {
        engine: this.name,
        status,
        durationMs: Date.now() - started,
        artifacts,
        diagnostics,
        ...(assertions.length > 0 ? { assertions } : {}),
      }),
    };
  }

  private messageProvidersFor(scenario: ScenarioPlan): Record<string, () => unknown | Promise<unknown>> {
    const descriptions = pactMessageDescriptions(scenario);
    if (descriptions.length === 0) return this.options.messageProviders ?? {};
    const providers: Record<string, () => unknown | Promise<unknown>> = {};
    for (const description of descriptions) {
      const provider = this.options.messageProviders?.[description] ?? messageBodyProvider(scenario);
      if (provider !== undefined) providers[description] = provider;
    }
    return providers;
  }
}

function messageBodyProvider(scenario: ScenarioPlan): (() => unknown) | undefined {
  const pact = scenario.metadata?.pact;
  if (!isRecord(pact) || !('message' in pact)) return undefined;
  const metadata = isStringRecord(pact.metadata) ? pact.metadata : undefined;
  return () => metadata === undefined ? pact.message : {
    __pactMessageMetadata: metadata,
    message: pact.message,
  };
}

function pactMessageDescriptions(scenario: ScenarioPlan): readonly string[] {
  const pact = scenario.metadata?.pact;
  if (!isRecord(pact)) return [];
  if (typeof pact.messageDescription === 'string') return [pact.messageDescription];
  if (Array.isArray(pact.messageDescriptions) && pact.messageDescriptions.every((entry) => typeof entry === 'string')) return pact.messageDescriptions;
  return [];
}

function pactUrlsFromScenario(scenario: ScenarioPlan): readonly string[] | undefined {
  const pact = scenario.metadata?.pact;
  if (!isRecord(pact)) return undefined;
  if (Array.isArray(pact.pactUrls) && pact.pactUrls.every((entry) => typeof entry === 'string')) return pact.pactUrls;
  if (typeof pact.pactUrl === 'string') return [pact.pactUrl];
  return undefined;
}

function providerFromScenario(scenario: ScenarioPlan): string | undefined {
  const pact = scenario.metadata?.pact;
  if (!isRecord(pact)) return undefined;
  return typeof pact.provider === 'string' ? pact.provider : undefined;
}

function pactUrlsFromConfig(context: EngineContext): readonly string[] {
  const pactDir = context.config.contracts?.pactDir;
  return pactDir === undefined ? [] : [pactDir];
}

function adapterName(scenario: ScenarioPlan): string | undefined {
  const adapter = scenario.metadata?.adapter ?? scenario.metadata?.engine;
  return typeof adapter === 'string' ? adapter.toLowerCase() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}
