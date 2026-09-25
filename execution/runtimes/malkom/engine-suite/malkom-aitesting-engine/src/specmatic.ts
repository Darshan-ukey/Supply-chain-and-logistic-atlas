import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult } from './types.js';
import { firstUsefulLine, isRecord, listFiles, runProcess, scenarioEvidence, scenarioResult } from './engines/shared.js';

export interface SpecmaticEngineOptions {
  readonly command?: string;
  readonly commandArgs?: readonly string[];
  readonly mode?: 'test' | 'mock' | 'test-and-mock';
  readonly port?: number;
  readonly strict?: boolean;
}

export class SpecmaticContractEngine implements Engine {
  readonly name = 'specmatic-contract-engine';
  readonly type = 'contract' as const;
  private readonly options: Required<Omit<SpecmaticEngineOptions, 'command' | 'commandArgs' | 'port'>> & {
    readonly command: string;
    readonly commandArgs: readonly string[];
    readonly port?: number;
  };

  constructor(options: SpecmaticEngineOptions = {}) {
    const command = options.command ?? defaultSpecmaticCommand();
    const commandArgs = options.commandArgs ?? defaultSpecmaticCommandArgs();
    this.options = {
      command,
      commandArgs,
      mode: options.mode ?? 'test',
      strict: options.strict ?? false,
      ...(options.port !== undefined ? { port: options.port } : {}),
    };
  }

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'contract' && adapterName(scenario) === 'specmatic';
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'specmatic');
    const reportsDir = join(dir, 'reports');
    await mkdir(reportsDir, { recursive: true });

    const schemaPath = context.scenario.target?.schema ?? context.config.contracts?.openApiPath;
    const evidencePath = join(dir, `${context.scenario.id}.specmatic-evidence.json`);
    const logPath = join(dir, `${context.scenario.id}.specmatic.log`);

    if (schemaPath === undefined) {
      return await skipped(context, started, evidencePath, ['No OpenAPI schema path configured for Specmatic.']);
    }

    const runs: SpecmaticCommandRun[] = [];
    if (this.options.mode === 'test' || this.options.mode === 'test-and-mock') {
      runs.push(await this.runSpecmatic('test', context, schemaPath, dir));
    }
    if (this.options.mode === 'mock' || this.options.mode === 'test-and-mock') {
      runs.push(await this.runSpecmatic('mock', context, schemaPath, dir));
    }

    const combinedLog = runs.map((run) => [
      `$ ${[run.command, ...run.displayArgs].map(shellQuote).join(' ')}`,
      run.stdout,
      run.stderr,
    ].filter((part) => part.trim().length > 0).join('\n\n')).join('\n\n---\n\n');
    await writeFile(logPath, combinedLog, 'utf8');

    const reportFiles = existsSync(reportsDir) ? await listFiles(reportsDir) : [];
    const summary = summarizeSpecmatic(runs, reportFiles);
    const diagnostics = [
      ...runs.flatMap((run) => run.diagnostics),
      ...(reportFiles.length === 0 ? ['Specmatic did not write report files in the configured reports directory.'] : []),
    ];
    const hasReportedFailures = numericSummaryValue(summary, 'failures') > 0 || numericSummaryValue(summary, 'errors') > 0;
    const status = runs.length === 0
      ? 'skipped'
      : runs.some((run) => run.timedOut || run.exitCode === null)
        ? 'error'
        : runs.some((run) => run.exitCode !== 0) || hasReportedFailures
          ? 'failed'
          : 'passed';

    const artifacts: ArtifactRef[] = [
      { kind: 'log', path: logPath, label: 'Specmatic execution log', metadata: { scenarioId: context.scenario.id } },
      ...reportFiles.map((path): ArtifactRef => ({
        kind: artifactKind(path),
        path,
        label: 'Specmatic report artifact',
        metadata: { schemaVersion: 'brisk-aitesting.specmatic-report.v1', scenarioId: context.scenario.id },
      })),
    ];

    const evidence = {
      schemaVersion: 'brisk-aitesting.specmatic-evidence.v1',
      scenario: scenarioEvidence(context),
      mode: this.options.mode,
      schemaPath,
      baseUrl: context.config.app.baseUrl,
      reportsDir,
      status,
      commands: runs.map((run) => ({
        mode: run.mode,
        exitCode: run.exitCode,
        timedOut: run.timedOut,
        command: run.command,
        args: run.displayArgs,
      })),
      summary,
      artifacts: artifacts.map((artifact) => ({ kind: artifact.kind, path: artifact.path, label: artifact.label })),
      diagnostics,
    };
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    artifacts.push({
      kind: 'json',
      path: evidencePath,
      label: 'Specmatic evidence',
      metadata: { schemaVersion: 'brisk-aitesting.specmatic-evidence.v1', scenarioId: context.scenario.id },
    });

    const assertions: ScenarioResult['assertions'][number][] = [
      { name: 'Specmatic CLI executed', status: status === 'error' ? 'error' : runs.length > 0 ? 'passed' : 'skipped' },
      { name: 'Specmatic found no contract failures', status: status === 'passed' ? 'passed' : status, ...(status === 'passed' ? {} : { message: diagnostics.join('; ') }) },
      { name: 'Specmatic emitted evidence', status: 'passed' },
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

  private async runSpecmatic(mode: 'test' | 'mock', context: EngineContext, schemaPath: string, dir: string): Promise<SpecmaticCommandRun> {
    const junitDir = join(dir, 'reports');
    const args = [
      ...this.options.commandArgs,
      mode,
      schemaPath,
      ...(mode === 'test'
        ? ['--testBaseURL', context.config.app.baseUrl, '--junitReportDir', junitDir]
        : [
            '--port',
            String(this.options.port ?? 9000),
          ]),
      ...(this.options.strict ? ['--strict'] : []),
    ];
    const execution = mode === 'mock'
      ? await runManagedServerProcess(this.options.command, args, {
          cwd: context.config.app.repoPath ?? process.cwd(),
          startupMs: Math.min(5_000, Math.max(1_000, context.config.runtime.timeoutMs / 4)),
        })
      : await runProcess(this.options.command, args, {
          cwd: context.config.app.repoPath ?? process.cwd(),
          timeoutMs: context.config.runtime.timeoutMs,
        });
    return {
      mode,
      command: this.options.command,
      displayArgs: args.map(redactCommandArg),
      exitCode: execution.exitCode,
      stdout: execution.stdout,
      stderr: execution.stderr,
      timedOut: execution.timedOut,
      diagnostics: commandDiagnostics('Specmatic', execution),
    };
  }
}

interface SpecmaticCommandRun {
  readonly mode: 'test' | 'mock';
  readonly command: string;
  readonly displayArgs: readonly string[];
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly diagnostics: readonly string[];
}

async function skipped(context: EngineContext, started: number, evidencePath: string, diagnostics: readonly string[]): Promise<EngineRunResult> {
  const evidence = {
    schemaVersion: 'brisk-aitesting.specmatic-evidence.v1',
    scenario: scenarioEvidence(context),
    status: 'skipped',
    diagnostics,
  };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  const artifact: ArtifactRef = {
    kind: 'json',
    path: evidencePath,
    label: 'Specmatic evidence',
    metadata: { schemaVersion: 'brisk-aitesting.specmatic-evidence.v1', scenarioId: context.scenario.id },
  };
  return {
    artifacts: [artifact],
    result: scenarioResult(context, {
      engine: 'specmatic-contract-engine',
      status: 'skipped',
      durationMs: Date.now() - started,
      artifacts: [artifact],
      diagnostics,
      assertions: [{ name: 'Specmatic input is configured', status: 'skipped', message: diagnostics.join('; ') }],
    }),
  };
}

function adapterName(scenario: ScenarioPlan): string | undefined {
  const adapter = scenario.metadata?.adapter ?? scenario.metadata?.engine;
  return typeof adapter === 'string' ? adapter.toLowerCase() : undefined;
}

function defaultSpecmaticCommand(): string {
  return process.execPath;
}

function defaultSpecmaticCommandArgs(): readonly string[] {
  const require = createRequire(import.meta.url);
  try {
    const packageJsonPath = require.resolve('specmatic/package.json');
    return [join(dirname(packageJsonPath), 'dist', 'bin', 'index.js')];
  } catch {
    return ['-e', 'process.stderr.write("Specmatic is not installed in this host project. To use SpecmaticContractEngine, install specmatic in the same package that runs brisk-aitesting and make sure Java is available.\\n"); process.exit(127);'];
  }
}

function summarizeSpecmatic(runs: readonly SpecmaticCommandRun[], reportFiles: readonly string[]): Record<string, unknown> {
  const combined = runs.map((run) => `${run.stdout}\n${run.stderr}`).join('\n');
  return {
    runs: runs.length,
    reportFiles: reportFiles.length,
    testsRun: numberAfter(combined, /Tests run:\s*(\d+)/i),
    successes: numberAfter(combined, /Successes:\s*(\d+)/i),
    failures: numberAfter(combined, /Failures:\s*(\d+)/i),
    errors: numberAfter(combined, /Errors:\s*(\d+)/i),
    coveragePercent: numberAfter(combined, /(\d+(?:\.\d+)?)%\s+API Coverage/i),
    scenarios: scenarioLines(combined),
  };
}

function numericSummaryValue(summary: Record<string, unknown>, key: string): number {
  const value = summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numberAfter(value: string, pattern: RegExp): number | undefined {
  const match = value.match(pattern);
  if (match?.[1] === undefined) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function scenarioLines(value: string): readonly string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^Scenario:/i.test(line) || /has (SUCCEEDED|FAILED)/i.test(line))
    .slice(0, 50);
}

function commandDiagnostics(label: string, execution: { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string; readonly timedOut: boolean }): readonly string[] {
  const diagnostics = [];
  if (execution.timedOut) diagnostics.push(`${label} timed out.`);
  diagnostics.push(`${label} exited with code ${execution.exitCode ?? 'unknown'}.`);
  if (execution.stderr.trim().length > 0) diagnostics.push(firstUsefulLine(execution.stderr));
  if (execution.stdout.trim().length > 0) diagnostics.push(firstUsefulLine(execution.stdout));
  return diagnostics;
}

async function runManagedServerProcess(command: string, args: readonly string[], options: {
  readonly cwd: string;
  readonly startupMs: number;
}): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}> {
  return new Promise((resolveProcess) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolveProcess({ exitCode: 0, stdout, stderr, timedOut: false });
    }, options.startupMs);

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

function artifactKind(path: string): ArtifactRef['kind'] {
  const lower = path.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.xml')) return 'junit';
  if (lower.endsWith('.html')) return 'html';
  if (lower.endsWith('.log')) return 'log';
  return 'other';
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=,\\-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function redactCommandArg(value: string): string {
  return /authorization|cookie|token|secret|password|Bearer\s+/i.test(value) ? '[redacted]' : value;
}

void isRecord;
