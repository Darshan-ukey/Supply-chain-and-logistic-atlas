import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildResult, persistCiReports, persistResult } from './handover.js';
import type { ArtifactRef, BriskAiTestingConfig, BriskAiTestingResult, DiscoveryResult, OperationalIssue, RunOutcome, TestPlan } from './types.js';

export async function recoverInterruptedRuns(config: BriskAiTestingConfig): Promise<readonly BriskAiTestingResult[]> {
  let entries;
  try {
    entries = await readdir(config.runtime.artifactsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const recovered: BriskAiTestingResult[] = [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory() && candidate.name.startsWith('run_')).slice(-100)) {
    const dir = join(config.runtime.artifactsDir, entry.name);
    if (await exists(join(dir, 'result.json'))) continue;
    const meta = await readMeta(join(dir, 'run.meta.json'));
    if (meta === undefined) continue;
    const journalPath = join(dir, 'run.journal.jsonl');
    let journal: string;
    try {
      journal = await readFile(journalPath, 'utf8');
    } catch {
      continue;
    }
    if (journal.split(/\r?\n/).some((line) => line.includes('"stage":"completed"') && line.includes('"status":"completed"'))) continue;

    const discovery = emptyRecoveryDiscovery(config);
    const plan = emptyRecoveryPlan(meta.runId, meta.goal, discovery);
    const operationalIssue: OperationalIssue = {
      category: 'interrupted',
      stage: 'completed',
      code: 'INTERRUPTED_RUN_RECOVERED',
      message: 'The previous process stopped before finalization. The journal was recovered; no application test verdict was fabricated.',
      recoverable: true,
    };
    const outcome: RunOutcome = {
      schemaVersion: 'brisk-aitesting.run-outcome.v1',
      status: 'recovered',
      terminalStage: 'completed',
      acceptedTests: 0,
      issues: [operationalIssue],
      journalPath,
    };
    let result = buildResult({
      config,
      goal: meta.goal,
      runId: meta.runId,
      plan,
      discovery,
      startedAt: Date.parse(meta.startedAt),
      tests: [],
      operations: [],
      artifacts: [],
      outcome,
    });
    const reportArtifacts = await persistCiReports(config, result).catch(() => []);
    const resultArtifact: ArtifactRef = { kind: 'json', path: join(dir, 'result.json'), label: 'Result JSON' };
    result = { ...result, artifacts: [...reportArtifacts, resultArtifact] };
    await persistResult(config, result);
    recovered.push(result);
  }
  return recovered;
}

interface RunMeta {
  readonly runId: string;
  readonly goal: string;
  readonly startedAt: string;
}

async function readMeta(path: string): Promise<RunMeta | undefined> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as Partial<RunMeta>;
    if (typeof value.runId !== 'string' || typeof value.goal !== 'string' || typeof value.startedAt !== 'string') return undefined;
    return value as RunMeta;
  } catch {
    return undefined;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function emptyRecoveryDiscovery(config: BriskAiTestingConfig): DiscoveryResult {
  return {
    schemaVersion: 'brisk-aitesting.discovery.v1',
    app: {
      name: config.app.name,
      baseUrl: config.app.baseUrl,
      ...(config.app.repoPath !== undefined ? { repoPath: config.app.repoPath } : {}),
    },
    uiRoutes: [],
    apiRoutes: [],
    contracts: [],
    repoSignals: [],
    warnings: ['Discovery evidence was unavailable because this run was recovered after interruption.'],
    createdAt: new Date().toISOString(),
  };
}

function emptyRecoveryPlan(runId: string, goal: string, discovery: DiscoveryResult): TestPlan {
  return {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId,
    goal,
    mode: 'automatic',
    scenarios: [],
    discovery,
    warnings: ['No executable plan was recovered.'],
    createdAt: new Date().toISOString(),
  };
}
