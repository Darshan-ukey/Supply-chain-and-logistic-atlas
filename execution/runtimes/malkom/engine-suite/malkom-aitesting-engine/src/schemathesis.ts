import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult } from './types.js';

export interface SchemathesisEngineOptions {
  readonly command?: string;
  readonly commandArgs?: readonly string[];
  readonly mode?: 'positive' | 'negative' | 'all';
  readonly phases?: readonly ('examples' | 'coverage' | 'fuzzing' | 'stateful')[];
  readonly checks?: readonly string[];
  readonly maxExamples?: number;
  readonly seed?: number;
  readonly workers?: number | 'auto';
  readonly requestTimeoutMs?: number;
}

export class SchemathesisOpenApiFuzzEngine implements Engine {
  readonly name = 'schemathesis-openapi-fuzz-engine';
  readonly type = 'schema' as const;
  private readonly options: Required<Omit<SchemathesisEngineOptions, 'command' | 'commandArgs' | 'seed'>> & {
    readonly command: string;
    readonly commandArgs: readonly string[];
    readonly seed?: number;
  };

  constructor(options: SchemathesisEngineOptions = {}) {
    this.options = {
      command: options.command ?? 'st',
      commandArgs: options.commandArgs ?? [],
      mode: options.mode ?? 'all',
      phases: options.phases ?? ['examples', 'coverage', 'fuzzing'],
      checks: options.checks ?? [
        'not_a_server_error',
        'status_code_conformance',
        'content_type_conformance',
        'response_schema_conformance',
        'negative_data_rejection',
        'positive_data_acceptance',
      ],
      maxExamples: options.maxExamples ?? 10,
      workers: options.workers ?? 1,
      requestTimeoutMs: options.requestTimeoutMs ?? 5_000,
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
    };
  }

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'schema' && wantsSchemathesis(scenario);
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'schemathesis');
    await mkdir(dir, { recursive: true });

    const schemaPath = context.scenario.target?.schema ?? context.config.contracts?.openApiPath;
    const logPath = join(dir, `${context.scenario.id}.schemathesis.log`);
    const ndjsonPath = join(dir, `${context.scenario.id}.schemathesis.ndjson`);
    const junitPath = join(dir, `${context.scenario.id}.schemathesis.junit.xml`);
    const harPath = join(dir, `${context.scenario.id}.schemathesis.har`);
    const evidencePath = join(dir, `${context.scenario.id}.schemathesis-evidence.json`);

    if (schemaPath === undefined) {
      const evidence = {
        schemaVersion: 'brisk-aitesting.schemathesis-evidence.v1',
        scenario: scenarioEvidence(context),
        status: 'skipped',
        diagnostics: ['No OpenAPI schema path configured for Schemathesis.'],
      };
      await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
      const artifact = evidenceArtifact(evidencePath, context.scenario.id);
      return {
        artifacts: [artifact],
        result: scenarioResult(context, {
          engine: this.name,
          status: 'skipped',
          durationMs: Date.now() - started,
          artifacts: [artifact],
          diagnostics: ['No OpenAPI schema path configured for Schemathesis.'],
        }),
      };
    }

    const headerArgs = authHeaderArgs(context);
    const args = [
      ...this.options.commandArgs,
      'run',
      schemaPath,
      '--url',
      context.config.app.baseUrl,
      '--mode',
      this.options.mode,
      '--phases',
      this.options.phases.join(','),
      '--checks',
      this.options.checks.join(','),
      '--max-examples',
      String(Math.max(1, this.options.maxExamples)),
      '--workers',
      String(this.options.workers),
      '--request-timeout',
      String(Math.max(0.1, this.options.requestTimeoutMs / 1000)),
      '--request-retries',
      String(Math.max(0, context.config.runtime.retries)),
      '--generation-deterministic',
      '--report',
      'junit,ndjson,har',
      '--report-junit-path',
      junitPath,
      '--report-ndjson-path',
      ndjsonPath,
      '--report-har-path',
      harPath,
      '--output-sanitize',
      context.config.security.redactSecrets ? 'true' : 'false',
      '--output-truncate',
      'true',
      '--no-color',
      ...headerArgs,
      ...includeOperationArgs(context.scenario),
      ...(this.options.seed !== undefined ? ['--seed', String(this.options.seed)] : []),
    ];
    const displayArgs = args.map(redactCommandArg);

    const execution = await runProcess(this.options.command, args, {
      cwd: context.config.app.repoPath ?? process.cwd(),
      timeoutMs: context.config.runtime.timeoutMs,
      env: {
        PYTHONIOENCODING: 'utf-8',
      },
    });
    const log = [
      `$ ${[this.options.command, ...displayArgs].map(shellQuote).join(' ')}`,
      execution.stdout,
      execution.stderr,
    ].filter((part) => part.trim().length > 0).join('\n\n');
    await writeFile(logPath, log, 'utf8');

    const eventSummary = await summarizeNdjson(ndjsonPath);
    const status = execution.exitCode === 0 ? 'passed' : execution.timedOut ? 'error' : 'failed';
    const diagnostics = [
      ...(execution.timedOut ? [`Schemathesis exceeded runtime timeout of ${context.config.runtime.timeoutMs}ms.`] : []),
      ...(execution.exitCode !== 0 && execution.exitCode !== null ? [`Schemathesis exited with code ${execution.exitCode}.`] : []),
      ...eventSummary.diagnostics,
      ...firstUsefulLines(execution.stderr || execution.stdout),
    ];

    const artifacts: ArtifactRef[] = [
      { kind: 'log', path: logPath, label: 'Schemathesis execution log', metadata: { scenarioId: context.scenario.id } },
      { kind: 'junit', path: junitPath, label: 'Schemathesis JUnit report', metadata: { scenarioId: context.scenario.id } },
      { kind: 'json', path: ndjsonPath, label: 'Schemathesis NDJSON events', metadata: { scenarioId: context.scenario.id } },
      { kind: 'other', path: harPath, label: 'Schemathesis HAR report', metadata: { scenarioId: context.scenario.id } },
    ];

    const evidence = {
      schemaVersion: 'brisk-aitesting.schemathesis-evidence.v1',
      scenario: scenarioEvidence(context),
      command: this.options.command,
      schemaPath,
      baseUrl: context.config.app.baseUrl,
      mode: this.options.mode,
      phases: this.options.phases,
      checks: this.options.checks,
      maxExamples: this.options.maxExamples,
      status,
      exitCode: execution.exitCode,
      timedOut: execution.timedOut,
      events: eventSummary,
      artifacts: artifacts.map((artifact) => ({ kind: artifact.kind, path: artifact.path, label: artifact.label })),
      diagnostics,
    };
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    artifacts.push(evidenceArtifact(evidencePath, context.scenario.id));

    const assertions: ScenarioResult['assertions'][number][] = [
      {
        name: 'Schemathesis CLI executed',
        status: execution.exitCode === null && execution.timedOut ? 'error' : 'passed',
        ...(execution.exitCode === null && execution.timedOut ? { message: `Timed out after ${context.config.runtime.timeoutMs}ms.` } : {}),
      },
      {
        name: 'Schemathesis found no contract failures',
        status,
        ...(status === 'passed' ? {} : { message: diagnostics.join('; ') }),
      },
      {
        name: 'Schemathesis emitted evidence',
        status: eventSummary.eventCount > 0 || execution.exitCode === 0 ? 'passed' : status,
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
        assertions,
      }),
    };
  }
}

function wantsSchemathesis(scenario: ScenarioPlan): boolean {
  const adapter = stringMetadata(scenario, 'adapter') ?? stringMetadata(scenario, 'engine');
  return adapter === 'schemathesis' || adapter === 'schemathesis-openapi-fuzz-engine';
}

function stringMetadata(scenario: ScenarioPlan, key: string): string | undefined {
  const value = scenario.metadata?.[key];
  return typeof value === 'string' ? value.toLowerCase() : undefined;
}

function authHeaderArgs(context: EngineContext): readonly string[] {
  const headers: string[] = [];
  if (context.config.auth.type === 'bearer') headers.push(`authorization:Bearer ${context.config.auth.token}`);
  for (const [key, value] of Object.entries(context.scenario.request?.headers ?? {})) {
    headers.push(`${key}:${value}`);
  }
  return headers.flatMap((header) => ['--header', header]);
}

function includeOperationArgs(scenario: ScenarioPlan): readonly string[] {
  const args: string[] = [];
  if (scenario.target?.method !== undefined) args.push('--include-method', scenario.target.method.toUpperCase());
  if (scenario.target?.path !== undefined) args.push('--include-path', scenario.target.path);
  return args;
}

async function summarizeNdjson(path: string): Promise<{
  readonly eventCount: number;
  readonly eventTypes: readonly string[];
  readonly operations: {
    readonly total: number;
    readonly selected: number;
  };
  readonly scenarioLabels: readonly string[];
  readonly phaseNames: readonly string[];
  readonly statusCounts: Record<string, number>;
  readonly generationModes: readonly string[];
  readonly diagnostics: readonly string[];
}> {
  try {
    const content = await readFile(path, 'utf8');
    const events = content.split(/\r?\n/).filter((line) => line.trim().length > 0).map((line) => parseJsonOrNull(line));
    const eventTypes = [...new Set(events.flatMap((event) => event === undefined ? [] : Object.keys(event)))].sort();
    const operations = summarizeOperations(events);
    const scenarioLabels = [...new Set(events.flatMap((event) => labelFromEvent(event)))].sort();
    const phaseNames = [...new Set(events.flatMap((event) => phaseFromEvent(event)))].sort();
    const statusCounts = summarizeStatuses(events);
    const generationModes = [...new Set(events.flatMap((event) => generationModesFromEvent(event)))].sort();
    return {
      eventCount: events.length,
      eventTypes,
      operations,
      scenarioLabels,
      phaseNames,
      statusCounts,
      generationModes,
      diagnostics: eventTypes.length > 0
        ? [`Schemathesis emitted ${events.length} NDJSON events across ${operations.selected} selected operations: ${eventTypes.join(', ')}.`]
        : [`Schemathesis emitted ${events.length} NDJSON events.`],
    };
  } catch (error) {
    return {
      eventCount: 0,
      eventTypes: [],
      operations: { total: 0, selected: 0 },
      scenarioLabels: [],
      phaseNames: [],
      statusCounts: {},
      generationModes: [],
      diagnostics: [`Could not read Schemathesis NDJSON report: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function summarizeOperations(events: readonly (Record<string, unknown> | undefined)[]): { readonly total: number; readonly selected: number } {
  for (const event of events) {
    const loadingFinished = recordValue(event, 'LoadingFinished');
    const statistic = recordValue(loadingFinished, 'statistic');
    const operations = recordValue(statistic, 'operations');
    const total = numberValue(operations, 'total');
    const selected = numberValue(operations, 'selected');
    if (total !== undefined || selected !== undefined) return { total: total ?? 0, selected: selected ?? 0 };
  }
  return { total: 0, selected: 0 };
}

function labelFromEvent(event: Record<string, unknown> | undefined): readonly string[] {
  const scenarioFinished = recordValue(event, 'ScenarioFinished');
  const recorder = recordValue(scenarioFinished, 'recorder');
  const label = stringValue(recorder, 'label');
  return label === undefined ? [] : [label];
}

function phaseFromEvent(event: Record<string, unknown> | undefined): readonly string[] {
  const scenarioFinished = recordValue(event, 'ScenarioFinished');
  const phase = stringValue(scenarioFinished, 'phase');
  return phase === undefined ? [] : [phase];
}

function summarizeStatuses(events: readonly (Record<string, unknown> | undefined)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const scenarioFinished = recordValue(event, 'ScenarioFinished');
    const status = stringValue(scenarioFinished, 'status');
    if (status !== undefined) counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function generationModesFromEvent(event: Record<string, unknown> | undefined): readonly string[] {
  const scenarioFinished = recordValue(event, 'ScenarioFinished');
  const recorder = recordValue(scenarioFinished, 'recorder');
  const cases = recordValue(recorder, 'cases');
  if (cases === undefined) return [];
  const modes = [];
  for (const value of Object.values(cases)) {
    const caseValue = recordValue(recordValue(value, 'value'), 'meta');
    const generation = recordValue(caseValue, 'generation');
    const mode = stringValue(generation, 'mode');
    if (mode !== undefined) modes.push(mode);
  }
  return modes;
}

function parseJsonOrNull(line: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(line) as unknown;
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function recordValue(value: unknown, key: string): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === 'object' && nested !== null && !Array.isArray(nested) ? nested as Record<string, unknown> : undefined;
}

function stringValue(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === 'string' ? nested : undefined;
}

function numberValue(value: unknown, key: string): number | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === 'number' && Number.isFinite(nested) ? nested : undefined;
}

function scenarioResult(
  context: EngineContext,
  params: {
    readonly engine: string;
    readonly status: ScenarioResult['status'];
    readonly durationMs: number;
    readonly artifacts: readonly ArtifactRef[];
    readonly diagnostics: readonly string[];
    readonly assertions?: readonly ScenarioResult['assertions'][number][];
  },
): ScenarioResult {
  return {
    scenarioId: context.scenario.id,
    name: context.scenario.name,
    type: context.scenario.type,
    engine: params.engine,
    status: params.status,
    durationMs: params.durationMs,
    assertions: params.assertions ?? context.scenario.assertions.map((assertion) => ({ name: assertion, status: params.status })),
    artifacts: params.artifacts,
    diagnostics: params.diagnostics,
  };
}

function scenarioEvidence(context: EngineContext): Record<string, unknown> {
  return {
    id: context.scenario.id,
    name: context.scenario.name,
    type: context.scenario.type,
    objective: context.scenario.objective,
  };
}

function evidenceArtifact(path: string, scenarioId: string): ArtifactRef {
  return {
    kind: 'json',
    path,
    label: 'Schemathesis evidence',
    metadata: {
      schemaVersion: 'brisk-aitesting.schemathesis-evidence.v1',
      scenarioId,
    },
  };
}

async function runProcess(command: string, args: readonly string[], options: {
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly env?: Record<string, string>;
}): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}> {
  return new Promise((resolveProcess) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGTERM');
      resolveProcess({ exitCode: null, stdout, stderr, timedOut: true });
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveProcess({ exitCode: null, stdout, stderr: `${stderr}\n${error.message}`.trim(), timedOut: false });
    });
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveProcess({ exitCode, stdout, stderr, timedOut: false });
    });
  });
}

function firstUsefulLines(value: string): readonly string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^\W+$/.test(line))
    .slice(0, 3);
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=,-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function redactCommandArg(value: string): string {
  return /authorization:|cookie:|token|secret|password|Bearer\s+/i.test(value) ? '[redacted]' : value;
}
