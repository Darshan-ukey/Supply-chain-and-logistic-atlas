import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactDeep } from './redaction.js';
import type { ArtifactRef, BriskAiTestingConfig, BriskAiTestingResult, CheckAccounting, HandoverEnvelope, RunOutcome, ScenarioResult, TestPlan } from './types.js';

export function buildResult(params: {
  readonly config: BriskAiTestingConfig;
  readonly goal: string;
  readonly runId: string;
  readonly plan: TestPlan;
  readonly discovery: BriskAiTestingResult['discovery'];
  readonly startedAt: number;
  readonly tests: readonly ScenarioResult[];
  readonly operations?: readonly ScenarioResult[];
  readonly artifacts: readonly ArtifactRef[];
  readonly outcome: RunOutcome;
  readonly checks?: CheckAccounting;
  readonly ai?: BriskAiTestingResult['ai'];
  readonly timings?: BriskAiTestingResult['timings'];
}): BriskAiTestingResult {
  const summary = summarize(params.tests, Date.now() - params.startedAt, params.outcome);
  const status = summary.failed > 0 ? 'failed' : summary.errors > 0 ? 'error' : summary.blocked > 0 ? 'blocked' : summary.passed > 0 ? 'passed' : 'skipped';

  return {
    schemaVersion: 'brisk-aitesting.result.v1',
    runId: params.runId,
    status,
    // A blocked test proved nothing, so it can never soften the verdict:
    // any blocked test means the run as a whole did not pass.
    verdict: summary.failed > 0 || summary.errors > 0 || summary.blocked > 0 ? 'failed' : summary.passed > 0 ? 'passed' : 'not_run',
    outcome: params.outcome,
    app: {
      name: params.config.app.name,
      baseUrl: params.config.app.baseUrl,
      ...(params.config.app.env !== undefined ? { env: params.config.app.env } : {}),
    },
    goal: params.goal,
    discovery: redactResultValue(params.discovery) as BriskAiTestingResult['discovery'],
    plan: redactResultValue(params.plan) as BriskAiTestingResult['plan'],
    summary,
    ...(params.checks !== undefined ? { checks: params.checks } : {}),
    ...(params.ai !== undefined ? { ai: params.ai } : {}),
    ...(params.timings !== undefined ? { timings: params.timings } : {}),
    tests: params.tests,
    operations: params.operations ?? [],
    artifacts: params.artifacts,
    diagnosis: [
      ...params.tests
      .filter((test) => test.status === 'failed' || test.status === 'error' || test.status === 'blocked')
      .map((test) => diagnoseTest(test)),
      ...params.outcome.issues
        .filter((entry) => entry.scenarioId === undefined)
        .map(diagnoseOperationalIssue),
    ],
    handover: buildHandover(params.config, params.runId),
  };
}

function diagnoseOperationalIssue(issue: RunOutcome['issues'][number]): BriskAiTestingResult['diagnosis'][number] {
  const timeout = issue.category === 'timeout' || issue.code.includes('TIMEOUT');
  return {
    reason: `${issue.stage}: ${issue.message}`,
    suggestedFixes: timeout
      ? [
          `The ${issue.stage} stage exceeded its configured time limit; no unfinished work should be counted as an executed test.`,
          'Check provider or application availability and measured latency before changing the time limit, then rerun the same test.',
        ]
      : [
          `The run stopped during ${issue.stage} before it could produce a normal scenario result.`,
          'Inspect the retained run issue and journal, correct the cause, and rerun the same goal.',
        ],
  };
}

function redactResultValue(value: unknown): unknown {
  return redactDeep(value);
}

function diagnoseTest(test: ScenarioResult): BriskAiTestingResult['diagnosis'][number] {
  const details = [
    ...test.diagnostics,
    ...test.assertions.map((assertion) => assertion.message ?? assertion.name),
  ].filter((entry) => entry.trim().length > 0).join('; ');
  const reason = details || `${test.name} did not pass`;
  const lower = reason.toLowerCase();

  if (test.failureCategory === 'precondition') {
    return {
      scenarioId: test.scenarioId,
      reason,
      suggestedFixes: [
        'The app had no data for this check to act on: every producing request succeeded, but the answers contained nothing to capture.',
        "Create the missing resource in the target app, declare a host/contract creation operation with a cleanupOperationId, or set planning.fixtures to 'provision-when-missing' so Brisk provisions a self-cleaning fixture.",
      ],
    };
  }
  if (test.status === 'blocked' || lower.includes('dependency') || lower.includes('required value')) {
    return {
      scenarioId: test.scenarioId,
      reason,
      suggestedFixes: [
        'This scenario did not run because an earlier required scenario or captured value was not proven.',
        'Fix the upstream route, payload, or capture first; then retry the same plan instead of regenerating tokens.',
      ],
    };
  }
  if (lower.includes('unresolved workflow variable') || lower.includes('missing value for') || lower.includes('unbound_workflow_variable')) {
    return {
      scenarioId: test.scenarioId,
      reason,
      suggestedFixes: [
        'A later step used a value that was never captured earlier.',
        'Add an explicit capture to the scenario that creates the resource, or use a built-in value such as <unique> only for generated names.',
      ],
    };
  }
  if (lower.includes('ai_target_blocked') || lower.includes('ai-derived target')) {
    return {
      scenarioId: test.scenarioId,
      reason,
      suggestedFixes: [
        'The plan tried to execute a route or schema that only came from AI text.',
        'Point the scenario at a discovered route, contract operation, observed UI route, or explicitly provided user target.',
      ],
    };
  }
  if (lower.includes('http 401') || lower.includes('http 403') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return {
      scenarioId: test.scenarioId,
      reason,
      suggestedFixes: [
        'Authentication or authorization blocked this check.',
        'Verify auth config, role/tenant data, and whether this scenario expects allowed or denied access.',
      ],
    };
  }
  if (lower.includes('http 404') || lower.includes('not found')) {
    return {
      scenarioId: test.scenarioId,
      reason,
      suggestedFixes: [
        'The route or dependent resource was not found.',
        'Check that the route came from discovery or a contract, and that any resource ID used in the path or body was captured from an earlier successful step.',
      ],
    };
  }
  if (lower.includes('http 400') || lower.includes('http 422') || lower.includes('validation') || lower.includes('required')) {
    return {
      scenarioId: test.scenarioId,
      reason,
      suggestedFixes: [
        'The request payload did not match what the app expects.',
        'Compare the request body in the evidence artifact with the OpenAPI contract or backend validation rules.',
      ],
    };
  }
  if (lower.includes('element') || lower.includes('locator') || lower.includes('playwright')) {
    return {
      scenarioId: test.scenarioId,
      reason,
      suggestedFixes: [
        'A UI action could not be matched to live page evidence.',
        'Use grounded UI actions from observed page evidence, or inspect UI healing evidence when a stale selector was replaced.',
      ],
    };
  }
  return {
    scenarioId: test.scenarioId,
    reason,
    suggestedFixes: ['Open the scenario artifact first, then check app availability, auth, payload, route evidence, and engine diagnostics.'],
  };
}

export async function persistResult(config: BriskAiTestingConfig, result: BriskAiTestingResult): Promise<ArtifactRef> {
  const dir = join(config.runtime.artifactsDir, result.runId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'result.json');
  const temporaryPath = join(dir, `result.${process.pid}.tmp`);
  const handle = await open(temporaryPath, 'w');
  try {
    await handle.writeFile(`${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
  return { kind: 'json', path, label: 'Result JSON' };
}

export async function persistCiReports(config: BriskAiTestingConfig, result: BriskAiTestingResult): Promise<readonly ArtifactRef[]> {
  const dir = join(config.runtime.artifactsDir, result.runId);
  await mkdir(dir, { recursive: true });
  const junitPath = join(dir, 'junit.xml');
  const htmlPath = join(dir, 'report.html');
  await writeFile(junitPath, junitReport(result), 'utf8');
  await writeFile(htmlPath, htmlReport(result), 'utf8');
  return [
    {
      kind: 'junit',
      path: junitPath,
      label: 'JUnit report',
      metadata: {
        schemaVersion: 'brisk-aitesting.junit-report.v1',
        runId: result.runId,
      },
    },
    {
      kind: 'html',
      path: htmlPath,
      label: 'HTML report',
      metadata: {
        schemaVersion: 'brisk-aitesting.html-report.v1',
        runId: result.runId,
      },
    },
  ];
}

function summarize(tests: readonly ScenarioResult[], durationMs: number, outcome: RunOutcome): BriskAiTestingResult['summary'] {
  const total = tests.length;
  const passed = tests.filter((test) => test.status === 'passed').length;
  const failed = tests.filter((test) => test.status === 'failed').length;
  const skipped = tests.filter((test) => test.status === 'skipped').length;
  const blocked = tests.filter((test) => test.status === 'blocked').length;
  const testErrors = tests.filter((test) => test.status === 'error').length;
  const runLevelErrors = tests.length === 0 && outcome.issues.length > 0 ? 1 : 0;
  return {
    total,
    passed,
    failed,
    skipped,
    blocked,
    errors: testErrors + runLevelErrors,
    passRate: total === 0 ? 0 : Math.round((passed / total) * 10000) / 100,
    durationMs,
  };
}

function buildHandover(config: BriskAiTestingConfig, runId: string): HandoverEnvelope {
  return {
    schemaVersion: 'brisk-aitesting.handover.v1',
    generatedAt: new Date().toISOString(),
    resultSchema: 'brisk-aitesting.result.v1',
    storage: {
      required: false,
      recommendedKeys: ['runId', 'status', 'summary', 'tests', 'artifacts', 'diagnosis', 'handover'],
      artifactRoot: join(config.runtime.artifactsDir, runId),
    },
    consumers: {
      database: 'store result JSON as-is or split summary/tests/artifacts',
      ci: 'use status, summary, artifacts, and junit/html outputs',
      dashboard: 'render summary, tests, artifacts, and diagnosis',
    },
  };
}

function junitReport(result: BriskAiTestingResult): string {
  const tests = result.tests;
  const failures = tests.filter((test) => test.status === 'failed').length;
  const errors = tests.filter((test) => test.status === 'error').length;
  const skipped = tests.filter((test) => test.status === 'skipped' || test.status === 'blocked').length;
  const body = tests.map((test) => {
    const timeSeconds = Math.max(0, test.durationMs / 1000);
    const diagnostics = test.diagnostics.join('\n');
    const assertions = test.assertions.map((assertion) => `${assertion.status.toUpperCase()}: ${assertion.name}${assertion.message !== undefined ? ` - ${assertion.message}` : ''}`).join('\n');
    const details = [diagnostics, assertions].filter((entry) => entry.trim().length > 0).join('\n\n');
    const problem = test.status === 'failed'
      ? `\n    <failure message=${quoteXml(details || 'Test failed')}>${escapeXml(details)}</failure>`
      : test.status === 'error'
        ? `\n    <error message=${quoteXml(details || 'Test errored')}>${escapeXml(details)}</error>`
        : test.status === 'skipped' || test.status === 'blocked'
          ? '\n    <skipped />'
          : '';
    return `  <testcase classname=${quoteXml(`brisk.${test.type}`)} name=${quoteXml(test.name)} time=${quoteXml(String(timeSeconds))}>${problem}\n  </testcase>`;
  }).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name=${quoteXml(result.app.name)} tests=${quoteXml(String(tests.length))} failures=${quoteXml(String(failures))} errors=${quoteXml(String(errors))} skipped=${quoteXml(String(skipped))} time=${quoteXml(String(Math.max(0, result.summary.durationMs / 1000)))} timestamp=${quoteXml(result.handover.generatedAt)}>`,
    body,
    '</testsuite>',
    '',
  ].join('\n');
}

function htmlReport(result: BriskAiTestingResult): string {
  const rows = result.tests.map((test) => `
        <tr>
          <td>${escapeHtml(test.name)}</td>
          <td>${escapeHtml(test.type)}</td>
          <td><span class="status ${escapeHtml(test.status)}">${escapeHtml(test.status)}</span></td>
          <td>${escapeHtml(test.engine)}</td>
          <td>${Math.round(test.durationMs / 100) / 10}s</td>
          <td>${escapeHtml(test.diagnostics.join('; '))}</td>
        </tr>`).join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>brisk-aitesting report ${escapeHtml(result.runId)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
      h1 { margin-bottom: 4px; }
      .summary { display: flex; gap: 12px; margin: 20px 0; flex-wrap: wrap; }
      .card { border: 1px solid #d1d5db; border-radius: 6px; padding: 12px 16px; min-width: 120px; }
      .value { font-size: 24px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 10px; vertical-align: top; }
      th { background: #f9fafb; }
      .status { border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 700; }
      .passed { background: #dcfce7; color: #166534; }
      .failed { background: #fee2e2; color: #991b1b; }
      .error { background: #ffedd5; color: #9a3412; }
      .skipped { background: #e5e7eb; color: #374151; }
      .blocked { background: #fef3c7; color: #92400e; }
    </style>
  </head>
  <body>
    <h1>brisk-aitesting report</h1>
    <div>${escapeHtml(result.app.name)} · ${escapeHtml(result.runId)}</div>
    <p>${escapeHtml(result.goal)}</p>
    ${result.checks !== undefined ? `<section class="summary">
      ${result.checks.requested !== undefined ? `<div class="card"><div>Checks asked for</div><div class="value">${result.checks.requested}</div></div>` : ''}
      <div class="card"><div>Checks understood</div><div class="value">${result.checks.understood}</div></div>
      <div class="card"><div>Checks ready</div><div class="value">${result.checks.ready}</div></div>
      <div class="card"><div>Checks not ready</div><div class="value">${result.checks.notReady.length}</div></div>
    </section>` : ''}
    <section class="summary">
      <div class="card"><div>Total</div><div class="value">${result.summary.total}</div></div>
      <div class="card"><div>Passed</div><div class="value">${result.summary.passed}</div></div>
      <div class="card"><div>Failed</div><div class="value">${result.summary.failed}</div></div>
      <div class="card"><div>Skipped</div><div class="value">${result.summary.skipped}</div></div>
      <div class="card"><div>Blocked</div><div class="value">${result.summary.blocked}</div></div>
      <div class="card"><div>Pass Rate</div><div class="value">${result.summary.passRate}%</div></div>
      <div class="card"><div>Cleanup actions</div><div class="value">${result.operations.length}</div></div>
      <div class="card"><div>Cleanup failed</div><div class="value">${result.operations.filter((operation) => operation.status === 'failed' || operation.status === 'error').length}</div></div>
    </section>
    <table>
      <thead>
        <tr><th>Scenario</th><th>Type</th><th>Status</th><th>Engine</th><th>Duration</th><th>Diagnostics</th></tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
  </body>
</html>
`;
}

function quoteXml(value: string): string {
  return `"${escapeXml(value)}"`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value: string): string {
  return escapeXml(value);
}
