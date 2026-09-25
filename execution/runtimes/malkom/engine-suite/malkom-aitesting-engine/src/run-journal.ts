import { appendFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OperationalIssue, RunStage } from './types.js';

export interface RunJournalEntry {
  readonly schemaVersion: 'brisk-aitesting.run-journal-entry.v1';
  readonly runId: string;
  readonly sequence: number;
  readonly stage: RunStage;
  readonly status: 'started' | 'completed' | 'diagnostic';
  readonly createdAt: string;
  readonly issue?: OperationalIssue;
}

export class RunJournal {
  private sequence = 0;
  readonly path: string;

  constructor(
    private readonly artifactsDir: string,
    private readonly runId: string,
  ) {
    this.path = join(artifactsDir, runId, 'run.journal.jsonl');
  }

  async initialize(goal: string, app: { readonly name: string; readonly baseUrl: string; readonly env?: string }): Promise<void> {
    const dir = join(this.artifactsDir, this.runId);
    await mkdir(dir, { recursive: true });
    const path = join(dir, 'run.meta.json');
    const temporaryPath = join(dir, `run.meta.${process.pid}.tmp`);
    await writeFile(temporaryPath, `${JSON.stringify({
      schemaVersion: 'brisk-aitesting.run-meta.v1',
      runId: this.runId,
      goal,
      app,
      startedAt: new Date().toISOString(),
    }, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, path);
  }

  async record(stage: RunStage, status: RunJournalEntry['status'], issue?: OperationalIssue): Promise<void> {
    await mkdir(join(this.artifactsDir, this.runId), { recursive: true });
    const entry: RunJournalEntry = {
      schemaVersion: 'brisk-aitesting.run-journal-entry.v1',
      runId: this.runId,
      sequence: ++this.sequence,
      stage,
      status,
      createdAt: new Date().toISOString(),
      ...(issue !== undefined ? { issue } : {}),
    };
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, 'utf8');
  }
}
