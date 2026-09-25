import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import {
  collectingSink,
  describeSignal,
  evaluateSignals,
  type SignalDefinition,
} from '../src/runtime/signals.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Signals are the point where the engine stops describing and starts telling
 * someone to do something, so the tests are about restraint as much as
 * detection: does it stay quiet when it should, does it distinguish a mined
 * insight from a plain threshold, and does it refuse to call a two-case
 * coincidence a prediction.
 */

let dir: string;
let client: SqlClient;

const NOW = new Date('2026-03-01T00:00:00Z');

beforeAll(async () => {
  dir = await makeTempDir();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

afterEach(async () => {
  await client?.close();
});

/**
 * A support process where cases that reach "Escalate" nearly always end in
 * "Refund", and cases that do not, almost never do. Plus a handful of cases
 * still in flight near NOW.
 */
async function supportLog(): Promise<SqlClient> {
  const path = join(dir, 'signals.csv');
  const lines = ['case:concept:name,concept:name,time:timestamp,org:resource,case:tier'];
  const day = 86_400_000;
  // History sits entirely BEFORE the evaluation instant. Letting it run past
  // `now` would make finished cases look live and would have the risk model
  // learning from events that had not happened yet.
  const base = Date.parse('2025-06-01T00:00:00Z');

  const emit = (id: string, steps: string[], startMs: number, stepMs = 3_600_000): void => {
    steps.forEach((activity, i) => {
      lines.push(
        `${id},${activity},${new Date(startMs + i * stepMs).toISOString()},agent${i % 2},gold`,
      );
    });
  };

  // 60 closed cases that escalate: 54 end in Refund (90%).
  for (let i = 0; i < 60; i += 1) {
    const steps = ['Open', 'Triage', 'Escalate', i < 54 ? 'Refund' : 'Resolve'];
    emit(`esc-${i}`, steps, base + i * day);
  }
  // 60 closed cases that never escalate: 3 end in Refund (5%).
  for (let i = 0; i < 60; i += 1) {
    const steps = ['Open', 'Triage', i < 3 ? 'Refund' : 'Resolve'];
    emit(`plain-${i}`, steps, base + (60 + i) * day);
  }
  // 4 cases still in flight: opened recently, stuck after Escalate.
  for (let i = 0; i < 4; i += 1) {
    emit(`live-${i}`, ['Open', 'Triage', 'Escalate'], NOW.getTime() - (i + 2) * day);
  }
  // 1 in-flight case that has NOT escalated.
  emit('calm-0', ['Open', 'Triage'], NOW.getTime() - 3 * day);
  // 1 in-flight case looping on Triage.
  emit('loop-0', ['Open', 'Triage', 'Triage', 'Triage'], NOW.getTime() - 4 * day);

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

const OPEN_RULE = {
  kind: 'missing-end-activity' as const,
  endActivities: ['Refund', 'Resolve'],
};

function shared() {
  return { objectType: 'case', openCases: OPEN_RULE, now: NOW };
}

describe('deciding which cases are still running', () => {
  it('treats cases without a terminal activity as open', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [], shared());

    // 4 escalated + 1 calm + 1 looping = 6 in flight, out of 126.
    expect(report.totalCases).toBe(126);
    expect(report.openCases).toBe(6);
  });

  it('always states which definition of open it used', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [], shared());
    // A log is a snapshot; numbers read as live truth unless this is said.
    expect(report.openCaseRule).toContain('Refund');
  });

  it('ignores events after the evaluation instant', async () => {
    // Evaluating "as of" a past instant must not consult later events: that is
    // how a prediction ends up scored against information it never had.
    client = await supportLog();
    const early = new Date('2025-07-01T00:00:00Z');
    const report = await evaluateSignals(client, duckdbDialect, [], {
      objectType: 'case',
      openCases: OPEN_RULE,
      now: early,
    });
    expect(report.totalCases).toBeLessThan(126);
  });

  it('can treat only recently-active cases as open', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [], {
      objectType: 'case',
      now: NOW,
      openCases: { kind: 'recent-activity', withinSeconds: 7 * 86_400 },
    });
    // The historical cases are months old and must not look live.
    expect(report.openCases).toBe(6);
    expect(report.openCaseRule).toContain('last event within');
  });
});

describe('threshold triggers', () => {
  it('fires on cases open longer than a threshold', async () => {
    client = await supportLog();
    const signal: SignalDefinition = {
      id: 'too-long',
      objectType: 'case',
      severity: 'warning',
      trigger: { kind: 'running-longer-than', seconds: 3 * 86_400 },
    };
    const report = await evaluateSignals(client, duckdbDialect, [signal], shared());
    expect(report.firings.length).toBeGreaterThan(0);
    for (const firing of report.firings) {
      expect(firing.openForSeconds!).toBeGreaterThan(3 * 86_400);
    }
  });

  it('labels a plain threshold as NOT a mined insight', async () => {
    // A threshold needs no process model. Calling it a discovery would
    // misrepresent what the engine did.
    client = await supportLog();
    const report = await evaluateSignals(
      client,
      duckdbDialect,
      [
        {
          id: 'too-long',
          objectType: 'case',
          severity: 'info',
          trigger: { kind: 'running-longer-than', seconds: 1 },
        },
      ],
      shared(),
    );
    expect(report.firings.every((f) => f.mined === false)).toBe(true);
  });

  it('fires on a stalled case, optionally at a named step', async () => {
    client = await supportLog();
    const report = await evaluateSignals(
      client,
      duckdbDialect,
      [
        {
          id: 'stuck-at-escalate',
          objectType: 'case',
          severity: 'critical',
          trigger: { kind: 'stalled', seconds: 86_400, atActivity: 'Escalate' },
        },
      ],
      shared(),
    );
    expect(report.firings.length).toBeGreaterThan(0);
    for (const firing of report.firings) {
      expect(firing.currentActivity).toBe('Escalate');
      expect(firing.reason).toContain('no progress');
    }
  });

  it('fires on an activity repeating in flight', async () => {
    client = await supportLog();
    const report = await evaluateSignals(
      client,
      duckdbDialect,
      [
        {
          id: 'triage-rework',
          objectType: 'case',
          severity: 'warning',
          trigger: { kind: 'repeating', activity: 'Triage', times: 3 },
        },
      ],
      shared(),
    );
    expect(report.firings.map((f) => f.caseId)).toEqual(['loop-0']);
    expect(report.firings[0]!.evidence['occurrences']).toBe(3);
  });
});

describe('path risk — the mined trigger', () => {
  const riskSignal: SignalDefinition = {
    id: 'refund-risk',
    name: 'Likely refund',
    objectType: 'case',
    severity: 'critical',
    trigger: {
      kind: 'path-risk',
      outcomeActivity: 'Refund',
      minRate: 0.5,
      minSupport: 20,
    },
    action: { kind: 'rule', ref: 'notify-team-lead' },
  };

  it('fires on cases whose path historically ends badly', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [riskSignal], shared());

    const fired = report.firings.map((f) => f.caseId).sort();
    // The four escalated in-flight cases; not the calm one, not the looper.
    expect(fired).toEqual(['live-0', 'live-1', 'live-2', 'live-3']);
  });

  it('is labelled as mined, because the decision came from the process', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [riskSignal], shared());
    expect(report.firings.every((f) => f.mined === true)).toBe(true);
  });

  it('carries the evidence a human would ask for', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [riskSignal], shared());
    const evidence = report.firings[0]!.evidence;

    expect(Number(evidence['historicalRate'])).toBeGreaterThan(0.8);
    expect(Number(evidence['support'])).toBeGreaterThanOrEqual(20);
    expect(evidence['matchedPrefix']).toEqual(['Open', 'Triage', 'Escalate']);
    // Lift is the point: a 40% risk is not a finding if 40% of everything ends
    // that way.
    expect(Number(evidence['lift'])).toBeGreaterThan(1.5);
    expect(report.firings[0]!.reason).toContain('% of the time');
  });

  it('stays quiet about cases on a safe path', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [riskSignal], shared());
    // 'calm-0' sits on Open -> Triage, which historically refunds ~5% of the
    // time. A signal engine that fires on everything gets muted.
    expect(report.firings.map((f) => f.caseId)).not.toContain('calm-0');
  });

  it('refuses to predict from a handful of cases', async () => {
    client = await supportLog();
    const strict = await evaluateSignals(
      client,
      duckdbDialect,
      [{ ...riskSignal, trigger: { ...riskSignal.trigger, minSupport: 10_000 } as never }],
      shared(),
    );
    // Nothing has that much history, so nothing should fire. Without a support
    // floor, a prefix seen twice — both badly — reads as a 100% risk.
    expect(strict.firings).toHaveLength(0);
  });

  it('does not count a prefix that already contains the outcome', async () => {
    // A prefix including 'Refund' would report a 100% risk for something that
    // has already happened, which is a prediction of the past.
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [riskSignal], shared());
    for (const firing of report.firings) {
      expect(firing.evidence['matchedPrefix']).not.toContain('Refund');
    }
  });

  it('carries the host action through without interpreting it', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [riskSignal], shared());
    expect(report.firings[0]!.action).toEqual({ kind: 'rule', ref: 'notify-team-lead' });
  });
});

describe('scoping and limits', () => {
  it('restricts a signal to a filtered subset', async () => {
    client = await supportLog();
    const report = await evaluateSignals(
      client,
      duckdbDialect,
      [
        {
          id: 'scoped',
          objectType: 'case',
          severity: 'info',
          filter: { kind: 'activity', activity: 'Escalate' },
          trigger: { kind: 'running-longer-than', seconds: 1 },
        },
      ],
      shared(),
    );
    expect(report.firings.every((f) => f.caseId.startsWith('live-'))).toBe(true);
  });

  it('caps firings and says how many were suppressed', async () => {
    client = await supportLog();
    const report = await evaluateSignals(
      client,
      duckdbDialect,
      [
        {
          id: 'noisy',
          objectType: 'case',
          severity: 'info',
          trigger: { kind: 'running-longer-than', seconds: 1 },
        },
      ],
      { ...shared(), limit: 2 },
    );
    expect(report.firings).toHaveLength(2);
    const summary = report.bySignal[0]!;
    // Silent truncation would read as "only two cases are affected".
    expect(summary.truncated).toBe(true);
    expect(summary.note).toContain('suppressed');
  });

  it('reports each signal separately', async () => {
    client = await supportLog();
    const report = await evaluateSignals(
      client,
      duckdbDialect,
      [
        { id: 'a', objectType: 'case', severity: 'info', trigger: { kind: 'running-longer-than', seconds: 1 } },
        { id: 'b', objectType: 'case', severity: 'info', trigger: { kind: 'repeating', activity: 'Triage', times: 3 } },
      ],
      shared(),
    );
    expect(report.bySignal.map((s) => s.signalId)).toEqual(['a', 'b']);
  });

  it('produces nothing when no case is open', async () => {
    client = await supportLog();
    const report = await evaluateSignals(client, duckdbDialect, [], {
      ...shared(),
      openCases: { kind: 'recent-activity', withinSeconds: 1 },
    });
    expect(report.openCases).toBe(0);
    expect(report.firings).toHaveLength(0);
  });
});

describe('emission', () => {
  it('hands firings to a sink without acting on them', async () => {
    // The engine emits; the host decides. There is no HTTP call, no queue
    // write and no rule invocation anywhere in this module.
    client = await supportLog();
    const sink = collectingSink();
    const report = await evaluateSignals(
      client,
      duckdbDialect,
      [{ id: 's', objectType: 'case', severity: 'info', trigger: { kind: 'running-longer-than', seconds: 1 } }],
      shared(),
    );
    await sink.emit(report.firings);
    expect(sink.firings).toHaveLength(report.firings.length);
  });
});

describe('descriptions', () => {
  it('reads back in plain language', () => {
    expect(
      describeSignal({
        id: 'x',
        objectType: 'case',
        severity: 'warning',
        trigger: { kind: 'path-risk', outcomeActivity: 'Refund', minRate: 0.6, minSupport: 20 },
      }),
    ).toContain('historically ends in "Refund" 60%+');

    expect(
      describeSignal({
        id: 'y',
        objectType: 'case',
        severity: 'info',
        filter: { kind: 'attribute', key: 'tier', value: 'gold' },
        trigger: { kind: 'stalled', seconds: 3600 },
      }),
    ).toContain('within tier = gold');
  });
});
