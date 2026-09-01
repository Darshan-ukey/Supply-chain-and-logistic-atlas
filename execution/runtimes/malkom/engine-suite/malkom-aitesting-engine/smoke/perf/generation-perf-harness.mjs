// Instrumented end-to-end preview of malkom-aitesting-engine, mirroring the
// malkom-command bridge exactly (same defineHostConfig fields, same run input,
// same evidence contracts), with:
//  - a local stub MALKOM API (instant or artificially delayed responses)
//  - a mock AI provider (instant or artificially delayed, valid answers)
// so engine-side "construct building" time is isolated from AI/network time.
//
// Usage: node harness.mjs <scenarios> <aiDelayMs> <httpDelayMs> <repoPath|none> <label> [failPlanning]
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createBriskAiTesting,
  createHttpEvidenceGraph,
  defineHostConfig,
} from '../../dist/index.js';

const [, , scenariosArg, aiDelayArg, httpDelayArg, repoArg, label, failArg] = process.argv;
const SCENARIOS = Number(scenariosArg ?? 15);
const AI_DELAY_MS = Number(aiDelayArg ?? 0);
const HTTP_DELAY_MS = Number(httpDelayArg ?? 0);
const REPO_PATH = repoArg === 'none' ? undefined : repoArg;
const FAIL_PLANNING = failArg === 'fail';

/* ---------------- stub MALKOM server ---------------- */
const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());
let httpRequests = 0;
const httpLog = new Map();
const server = createServer(async (req, res) => {
  httpRequests += 1;
  const key = `${req.method} ${req.url.split('?')[0]}`;
  httpLog.set(key, (httpLog.get(key) ?? 0) + 1);
  await sleep(HTTP_DELAY_MS);
  const ok = (data) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
  };
  if (req.url.startsWith('/api/orgs') && req.method === 'GET' && req.url === '/api/orgs') return ok([{ id: 'org-1', name: 'Org One' }]);
  if (req.method === 'GET' && /^\/api\/orgs\/[^/]+$/.test(req.url)) return ok({ id: 'org-1', name: 'Org One' });
  if (req.method === 'POST' && /contacts$/.test(req.url)) return ok({ id: 'contact-1', name: 'aitest-contact-1' });
  if (req.method === 'DELETE') return ok({ deleted: true });
  return ok({});
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

/* ---------------- evidence contracts (verbatim from bridge.ts) ---------------- */
const MALKOM_AUTHORITATIVE_OPERATIONS = [
  { operationId: 'malkom.health.read', method: 'GET', path: '/api/health', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.auth.reject-anonymous', method: 'GET', path: '/api/orgs', successStatusCodes: [401], source: 'host-adapter' },
  { operationId: 'malkom.orgs.list', method: 'GET', path: '/api/orgs', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.orgs.read', method: 'GET', path: '/api/orgs/:orgId', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.orgs.contacts.create', method: 'POST', path: '/api/orgs/:orgId/contacts', requiredBodyFields: ['name', 'email'], successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.orgs.contacts.delete', method: 'DELETE', path: '/api/orgs/:orgId/contacts/:contactId', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.ai.catalog.read', method: 'GET', path: '/api/ai/catalog', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.rules.list', method: 'GET', path: '/api/rules', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.tickets.list', method: 'GET', path: '/api/tickets', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.community.pages.read', method: 'GET', path: '/api/community/pages', successStatusCodes: [200], source: 'host-adapter' },
];
const MALKOM_EVIDENCE_CONTRACTS = [
  { operationId: 'malkom.health.read', method: 'GET', path: '/api/health', name: 'Verify platform health', action: 'read', resource: 'platform health', sideEffect: 'read', successStatuses: [200], expectedJson: { success: true }, authority: 'host', source: 'MALKOM public health route' },
  { operationId: 'malkom.auth.reject-anonymous', method: 'GET', path: '/api/orgs', name: 'Reject anonymous protected API access', action: 'reject', resource: 'anonymous protected API access', sideEffect: 'none', successStatuses: [401], authority: 'host', source: 'MALKOM global JWT route guard' },
  { operationId: 'malkom.orgs.list', method: 'GET', path: '/api/orgs', name: 'List organizations', action: 'list', resource: 'organization', sideEffect: 'read', outputs: [ { id: 'response.orgId', name: 'id', semanticType: 'org.id', from: 'response.body', path: "$['data'][0]['id']" } ], successStatuses: [200], authority: 'host', source: 'MALKOM registered route contract' },
  { operationId: 'malkom.orgs.read', method: 'GET', path: '/api/orgs/:orgId', name: 'Fetch one organization', action: 'read', resource: 'organization', sideEffect: 'read', inputs: [ { id: 'path.orgId', name: 'orgId', location: 'path', semanticType: 'org.id', required: true } ], successStatuses: [200], authority: 'host', source: 'MALKOM registered route contract' },
  { operationId: 'malkom.orgs.contacts.create', method: 'POST', path: '/api/orgs/:orgId/contacts', name: 'Create an organization contact', action: 'create', resource: 'org contact', sideEffect: 'create', inputs: [ { id: 'path.orgId', name: 'orgId', location: 'path', semanticType: 'org.id', required: true }, { id: 'body.name', name: 'name', location: 'body', semanticType: 'org.contact.name', required: true, generation: { kind: 'unique-string', prefix: 'aitest-contact' } }, { id: 'body.email', name: 'email', location: 'body', semanticType: 'org.contact.email', required: true, generation: { kind: 'constant', value: 'aitesting@malkom.local' } } ], outputs: [ { id: 'response.contactId', name: 'id', semanticType: 'org.contact.id', from: 'response.body', path: "$['data']['id']" }, { id: 'response.contactName', name: 'name', semanticType: 'org.contact.name', from: 'response.body', path: "$['data']['name']" } ], successStatuses: [200], cleanupOperationId: 'malkom.orgs.contacts.delete', authority: 'host', source: 'MALKOM registered route contract' },
  { operationId: 'malkom.orgs.contacts.delete', method: 'DELETE', path: '/api/orgs/:orgId/contacts/:contactId', name: 'Delete an organization contact', action: 'delete', resource: 'org contact', sideEffect: 'delete', inputs: [ { id: 'path.orgId', name: 'orgId', location: 'path', semanticType: 'org.id', required: true }, { id: 'path.contactId', name: 'contactId', location: 'path', semanticType: 'org.contact.id', required: true } ], successStatuses: [200], authority: 'host', source: 'MALKOM registered route contract' },
  { operationId: 'malkom.orgs.contacts.reject-invalid', method: 'POST', path: '/api/orgs/:orgId/contacts', name: 'Reject contact creation without a valid email', action: 'reject', resource: 'invalid contact creation', sideEffect: 'none', inputs: [ { id: 'path.orgId', name: 'orgId', location: 'path', semanticType: 'org.id', required: true } ], requestExample: { name: 'aitest-invalid-contact' }, successStatuses: [400], unchanged: [{ name: 'organizations remain unchanged', target: { method: 'GET', path: '/api/orgs' } }], authority: 'host', source: 'MALKOM contact validation route' },
  { operationId: 'malkom.ai.catalog.read', method: 'GET', path: '/api/ai/catalog', name: 'Read the AI provider catalog', action: 'read', resource: 'ai catalog', sideEffect: 'read', successStatuses: [200], authority: 'host', source: 'MALKOM registered route contract' },
  { operationId: 'malkom.rules.list', method: 'GET', path: '/api/rules', name: 'List rule definitions', action: 'list', resource: 'rule', sideEffect: 'read', successStatuses: [200], authority: 'host', source: 'MALKOM registered route contract' },
  { operationId: 'malkom.tickets.list', method: 'GET', path: '/api/tickets', name: 'List support tickets', action: 'list', resource: 'ticket', sideEffect: 'read', successStatuses: [200], authority: 'host', source: 'MALKOM registered route contract' },
  { operationId: 'malkom.community.pages.read', method: 'GET', path: '/api/community/pages', name: 'List role-grantable pages', action: 'read', resource: 'page catalog', sideEffect: 'read', successStatuses: [200], authority: 'host', source: 'MALKOM registered route contract' },
];

/* ---------------- mock AI provider ---------------- */
const aiCalls = [];
const checkList = Array.from({ length: SCENARIOS }, (_, index) => ({
  id: `check_${index + 1}`,
  name: `Contact lifecycle check ${index + 1}`,
  objective: `Prove contact lifecycle ${index + 1}`,
}));
const scenarioFor = (check) => ({
  id: check.id,
  name: check.name,
  objective: check.objective,
  actor: 'authenticated user',
  initialState: [],
  actions: FAIL_PLANNING
    ? [{ id: 'action_1', verb: 'teleport', resource: 'starship', capability: 'api.http', expectedOutcomes: [] }]
    : [
        { id: 'action_1', verb: 'list', resource: 'organization', capability: 'api.http', expectedOutcomes: [] },
        { id: 'action_2', verb: 'create', resource: 'org contact', capability: 'api.http', values: [
          { name: 'orgId', semanticType: 'org.id', fromActionId: 'action_1' },
        ], expectedOutcomes: [] },
        { id: 'action_3', verb: 'read', resource: 'organization', capability: 'api.http', values: [
          { name: 'orgId', semanticType: 'org.id', fromActionId: 'action_1' },
        ], expectedOutcomes: [] },
      ],
  invariants: [],
  evidenceRequired: [],
  cleanup: 'automatic',
});
const provider = {
  name: 'perf-mock-provider',
  async complete(request) {
    const startedAt = Date.now();
    await sleep(AI_DELAY_MS);
    let content;
    if (request.jsonSchemaName === 'brisk-aitesting.intent-outline.v1') {
      content = JSON.stringify({ checks: checkList, warnings: [] });
    } else if (request.jsonSchemaName === 'brisk-aitesting.intent.v1') {
      const user = JSON.parse(request.user.split('\n\n')[0] ?? request.user);
      const assigned = user.assignedChecks ?? checkList.slice(0, SCENARIOS);
      content = JSON.stringify({ scenarios: assigned.map(scenarioFor), warnings: [] });
    } else if (request.jsonSchemaName === 'brisk-aitesting.intent-semantic-repair.v1') {
      const user = JSON.parse(request.user.split('\n\n')[0] ?? request.user);
      content = JSON.stringify({
        repairs: (user.affectedActions ?? []).map((entry) => ({
          scenarioId: entry.scenarioId,
          actionId: entry.action.id,
          action: entry.action,
        })),
        warnings: [],
      });
    } else {
      content = JSON.stringify({ scenarios: [], warnings: [] });
    }
    aiCalls.push({
      schema: request.jsonSchemaName,
      purpose: request.purpose,
      maxOutputTokensHint: request.maxOutputTokensHint,
      ms: Date.now() - startedAt,
      promptBytes: Buffer.byteLength(request.user ?? '', 'utf8') + Buffer.byteLength(request.system ?? '', 'utf8'),
      at: startedAt,
    });
    return { content, usage: { inputTokens: 0, outputTokens: 0 } };
  },
};

/* ---------------- config + run input (mirrors bridge.buildSdkConfig/buildRunInput) ---------------- */
const artifactsDir = mkdtempSync(join(tmpdir(), 'brisk-perf-'));
const config = await defineHostConfig({
  app: {
    name: 'MALKOM Command',
    baseUrl,
    uiBaseUrl: baseUrl,
    ...(REPO_PATH !== undefined ? { repoPath: REPO_PATH } : {}),
    env: 'local',
  },
  auth: { type: 'none' },
  run: { execution: 'preview', artifactsDir, timeoutMs: 600_000, retries: 0, headless: true },
  discovery: {
    includeRepo: REPO_PATH !== undefined,
    includeUi: false,
    includeApi: true,
    includeContracts: true,
    uiRoutes: [],
    apiRoutes: MALKOM_AUTHORITATIVE_OPERATIONS.map((op) => ({ method: op.method, path: op.path })),
  },
  fixtures: 'require-existing',
  advanced: { planning: { repairAttempts: 2 } },
  ai: provider,
}, { environment: {} });

const phaseEvents = [];
const startedAt = Date.now();
const tester = createBriskAiTesting(config);
tester.onEvent((event) => {
  if (event.type === 'planning.phase') phaseEvents.push({ phase: event.phase, at: Date.now() - startedAt, detail: event.detail });
});

let result;
let failure;
try {
  result = await tester.run({
    goal: 'Prove the organization contact lifecycle works end to end, including validation and cleanup, across the whole catalogue',
    scenarios: SCENARIOS,
    scenarioCountPolicy: 'exact',
    mode: 'automatic',
    requiredTypes: [],
    uiActionFeedback: 'off',
    authoritativeOperations: MALKOM_AUTHORITATIVE_OPERATIONS,
    evidenceGraph: createHttpEvidenceGraph(MALKOM_EVIDENCE_CONTRACTS),
    metadata: { host: 'perf-harness' },
  });
} catch (error) {
  failure = error instanceof Error ? error.message.slice(0, 300) : String(error);
}
const totalMs = Date.now() - startedAt;
server.close();

/* ---------------- report ---------------- */
const timings = (result?.timings ?? []).map((entry) => ({ stage: entry.stage, ms: entry.ms }));
const serialChain = aiCalls.length === 0 ? 0 : (() => {
  // Count "waves": calls whose start times overlap are one wave.
  const sorted = [...aiCalls].sort((left, right) => left.at - right.at);
  let waves = 0;
  let waveEnd = -1;
  for (const call of sorted) {
    if (call.at >= waveEnd) { waves += 1; }
    waveEnd = Math.max(waveEnd, call.at + call.ms);
  }
  return waves;
})();
console.log(JSON.stringify({
  label: label ?? 'run',
  scenarios: SCENARIOS,
  aiDelayMs: AI_DELAY_MS,
  httpDelayMs: HTTP_DELAY_MS,
  repoPath: REPO_PATH ?? null,
  totalMs,
  status: result?.status ?? 'threw',
  ...(failure !== undefined ? { failure } : {}),
  planScenarios: result?.plan.scenarios.length ?? 0,
  aiCallCount: aiCalls.length,
  aiSerialWaves: serialChain,
  aiCalls: aiCalls.map((call) => ({ schema: call.schema.replace('brisk-aitesting.', ''), purpose: call.purpose, hint: call.maxOutputTokensHint, ms: call.ms, promptKB: Math.round(call.promptBytes / 1024) })),
  httpRequests,
  httpByRoute: Object.fromEntries(httpLog),
  aiUsage: result?.ai === undefined ? null : { calls: result.ai.calls, errors: result.ai.errors, records: result.ai.records.map((r) => ({ purpose: r.purpose, schema: r.jsonSchemaName.replace('brisk-aitesting.', ''), ms: r.durationMs, promptBytes: r.promptBytes, responseBytes: r.responseBytes })) },
  timings,
  phases: phaseEvents,
}, null, 2));
