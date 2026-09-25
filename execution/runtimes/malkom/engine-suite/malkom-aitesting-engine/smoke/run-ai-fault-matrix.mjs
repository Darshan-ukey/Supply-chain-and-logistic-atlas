import { createServer } from 'node:http';
import { HostHttpCapabilityAdapter, createBriskAiTesting, createHttpEvidenceGraph } from '../dist/index.js';

// The one dangerous seam in this product: an AI writes the intent, a strict
// compiler judges it. This matrix poisons one scenario in each AI-reachable
// way, pairs it with a worst-case AI whose repairs never improve anything,
// and requires the same outcome every time: the clean scenarios deliver and
// run, the poisoned one is dropped by name with its reasons, and the run
// never dies. The floor stays honest: when every scenario is poisoned, the
// run refuses with the reasons — partial delivery never invents success.

const errors = [];

const app = createServer((request, response) => {
  const ok = (body) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.url === '/api/health') return ok({ success: true, data: { ok: true } });
  if (request.url === '/api/orgs') return ok({ success: true, data: [{ id: 'org_1' }] });
  if (request.url?.startsWith('/api/orgs/')) return ok({ success: true, data: { id: 'org_1' } });
  if (request.url?.startsWith('/api/tickets')) return ok({ success: true, data: [] });
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ success: false }));
});
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const address = app.address();
if (address === null || typeof address === 'string') throw new Error('Fixture app did not expose a TCP port');

const OPERATIONS = [
  { operationId: 'malkom.health.read', method: 'GET', path: '/api/health', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.orgs.list', method: 'GET', path: '/api/orgs', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.orgs.read', method: 'GET', path: '/api/orgs/:orgId', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.tickets.list.a', method: 'GET', path: '/api/tickets', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.tickets.list.b', method: 'GET', path: '/api/tickets-all', successStatusCodes: [200], source: 'host-adapter' },
];
const CONTRACTS = [
  {
    operationId: 'malkom.health.read', method: 'GET', path: '/api/health',
    name: 'Verify platform health', action: 'read', resource: 'health', sideEffect: 'read',
    successStatuses: [200], authority: 'host', source: 'fixture contract',
  },
  {
    operationId: 'malkom.orgs.list', method: 'GET', path: '/api/orgs',
    name: 'List organizations', action: 'list', resource: 'organization', sideEffect: 'read',
    outputs: [{ id: 'response.orgId', name: 'id', semanticType: 'org.id', from: 'response.body', path: "$['data'][0]['id']" }],
    successStatuses: [200], authority: 'host', source: 'fixture contract',
  },
  {
    operationId: 'malkom.orgs.read', method: 'GET', path: '/api/orgs/:orgId',
    name: 'Fetch one organization', action: 'read', resource: 'organization', sideEffect: 'read',
    inputs: [{ id: 'path.orgId', name: 'orgId', location: 'path', semanticType: 'org.id', required: true }],
    successStatuses: [200], authority: 'host', source: 'fixture contract',
  },
  {
    operationId: 'malkom.tickets.list.a', method: 'GET', path: '/api/tickets',
    name: 'List tickets', action: 'list', resource: 'ticket', sideEffect: 'read',
    successStatuses: [200], authority: 'host', source: 'fixture contract',
  },
  {
    operationId: 'malkom.tickets.list.b', method: 'GET', path: '/api/tickets-all',
    name: 'List every ticket', action: 'list', resource: 'ticket', sideEffect: 'read',
    successStatuses: [200], authority: 'host', source: 'fixture contract',
  },
];

const scenario = (id, name, actions) => ({
  id,
  name,
  objective: `Prove ${name.toLowerCase()}.`,
  actions,
  invariants: [],
  evidenceRequired: ['observable result'],
  cleanup: 'isolated',
});
const cleanHealth = () => scenario('clean_health', 'Health is observable', [
  { id: 'read_health', verb: 'read', resource: 'health', capability: 'api.http', expectedOutcomes: [] },
]);
const cleanOrg = () => scenario('clean_org', 'An organization can be read', [
  { id: 'list_orgs', verb: 'list', resource: 'organization', capability: 'api.http', expectedOutcomes: [] },
  { id: 'read_org', verb: 'read', resource: 'organization', capability: 'api.http', values: { orgId: { semanticType: 'org.id', fromActionId: 'list_orgs' } }, expectedOutcomes: [] },
]);

// Every AI-reachable way one check can be wrong. Each poisons only the
// "poisoned" scenario; the worst-case repair echoes the same poison back.
const MUTATIONS = [
  {
    name: 'no operation for the intent',
    actions: [{ id: 'p1', verb: 'delete', resource: 'unicorn', capability: 'api.http', expectedOutcomes: [] }],
  },
  {
    name: 'two operations equally match',
    actions: [{ id: 'p1', verb: 'list', resource: 'ticket', capability: 'api.http', expectedOutcomes: [] }],
  },
  {
    name: 'generate for an app-created identifier',
    actions: [{ id: 'p1', verb: 'read', resource: 'organization', capability: 'api.http', values: { orgId: { semanticType: 'org.id', generate: true } }, expectedOutcomes: [] }],
  },
  {
    name: 'fromActionId names a ghost action',
    actions: [{ id: 'p1', verb: 'read', resource: 'organization', capability: 'api.http', values: { orgId: { semanticType: 'org.id', fromActionId: 'ghost_action' } }, expectedOutcomes: [] }],
  },
  {
    name: 'fromActionId names a later action',
    actions: [
      { id: 'p1', verb: 'read', resource: 'organization', capability: 'api.http', values: { orgId: { semanticType: 'org.id', fromActionId: 'p2' } }, expectedOutcomes: [] },
      { id: 'p2', verb: 'list', resource: 'organization', capability: 'api.http', expectedOutcomes: [] },
    ],
  },
  {
    name: 'value of an incompatible semantic type',
    actions: [{ id: 'p1', verb: 'read', resource: 'organization', capability: 'api.http', values: { orgId: { semanticType: 'ticket.id', value: 'not-an-org' } }, expectedOutcomes: [] }],
  },
  {
    name: 'required value with no source in the scenario',
    actions: [{ id: 'p1', verb: 'read', resource: 'organization', capability: 'api.http', expectedOutcomes: [] }],
  },
  {
    name: 'expected outcome nothing can prove',
    actions: [{ id: 'p1', verb: 'read', resource: 'health', capability: 'api.http', expectedOutcomes: ['every user is deleted forever'] }],
  },
];

const makeTester = (provider) => createBriskAiTesting({
  app: { name: 'Fault matrix app', baseUrl: `http://127.0.0.1:${address.port}`, env: 'local' },
  auth: { type: 'none' },
  ai: { provider: 'openai-compatible', model: 'fixture-model', apiKeyEnv: 'BRISK_AITESTING_AI_API_KEY', repairAttempts: 1 },
  runtime: { artifactsDir: '.brisk-aitesting-fixtures/artifacts', timeoutMs: 30000, retries: 0, headless: true, dryRun: true },
  discovery: { includeRepo: false, includeUi: false, includeApi: true, includeContracts: false, uiRoutes: [], apiRoutes: OPERATIONS.map((op) => ({ method: op.method, path: op.path })) },
  security: { networkPolicy: 'localhost-only', allowedHosts: ['localhost', '127.0.0.1'], redactSecrets: true, allowFallbackTargets: true, allowAiTargets: true },
  capabilityAdapters: [new HostHttpCapabilityAdapter()],
  aiProvider: provider,
});
const runInput = (scenarios) => ({
  goal: 'Prove the application behaves',
  scenarios,
  scenarioCountPolicy: 'exact',
  mode: 'automatic',
  requiredTypes: ['api'],
  authoritativeOperations: OPERATIONS,
  evidenceGraph: createHttpEvidenceGraph(CONTRACTS),
});
// Worst case: the writer produces the poisoned intent and every repair
// echoes the poisoned actions back unchanged, forever.
const worstCaseProvider = (scenarios, poisonedActions) => {
  let calls = 0;
  return {
    tally: () => calls,
    name: 'worst-case-provider',
    async complete(request) {
      calls += 1;
      if (calls > 12) throw new Error('unbounded AI call loop');
      if (request.purpose === 'intent-semantic-repair') {
        return { content: JSON.stringify({
          repairs: poisonedActions.map((action) => ({ scenarioId: 'poisoned', actionId: action.id, action })),
          warnings: [],
        }) };
      }
      return { content: JSON.stringify({ scenarios, warnings: [] }) };
    },
  };
};

try {
  // Control: nothing poisoned — everything delivers, nothing dropped.
  {
    const provider = worstCaseProvider([cleanHealth(), cleanOrg()], []);
    const result = await makeTester(provider).run(runInput(2));
    if (result.status === 'error') errors.push('control: run must not fail');
    if (result.checks?.ready !== 2 || (result.checks?.notReady.length ?? 0) !== 0) {
      errors.push(`control: expected 2 ready and 0 dropped, got ${JSON.stringify(result.checks)}`);
    }
  }

  for (const mutation of MUTATIONS) {
    const poisoned = scenario('poisoned', `Poisoned: ${mutation.name}`, mutation.actions);
    const provider = worstCaseProvider([cleanHealth(), poisoned, cleanOrg()], mutation.actions);
    try {
      const result = await makeTester(provider).run(runInput(3));
      if (result.status === 'error') {
        errors.push(`${mutation.name}: run died (${JSON.stringify(result.outcome?.issues ?? []).slice(0, 300)})`);
        continue;
      }
      const checks = result.checks;
      if (checks?.requested !== 3 || checks.ready !== 2 || checks.notReady.length !== 1) {
        errors.push(`${mutation.name}: expected 3 requested / 2 ready / 1 dropped, got ${JSON.stringify(checks)}`);
        continue;
      }
      if (checks.notReady[0].checkId !== 'poisoned' || checks.notReady[0].reasons.length === 0) {
        errors.push(`${mutation.name}: the poisoned check must be named with reasons, got ${JSON.stringify(checks.notReady)}`);
      }
      if ((result.plan.droppedScenarios ?? [])[0]?.id !== 'poisoned') {
        errors.push(`${mutation.name}: plan must record the dropped check`);
      }
      if (provider.tally() > 8) errors.push(`${mutation.name}: too many AI calls (${provider.tally()})`);
    } catch (error) {
      errors.push(`${mutation.name}: threw ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`);
    }
  }

  // Honest floor: every scenario poisoned — the run refuses with reasons and
  // never invents success out of nothing.
  {
    const poisoned = scenario('poisoned', 'Poisoned: nothing usable', [
      { id: 'p1', verb: 'delete', resource: 'unicorn', capability: 'api.http', expectedOutcomes: [] },
    ]);
    const provider = worstCaseProvider([poisoned], [poisoned.actions[0]]);
    const result = await makeTester(provider).run(runInput(1));
    if (result.status !== 'error') errors.push('honest floor: an all-poisoned run must refuse');
    if (result.plan.scenarios.length !== 0) errors.push('honest floor: nothing may be invented');
  }
} finally {
  await new Promise((resolve) => app.close(resolve));
}

if (errors.length > 0) {
  console.error(JSON.stringify({ suite: 'ai-fault-matrix', failures: errors.length, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ suite: 'ai-fault-matrix', mutations: MUTATIONS.length, checks: MUTATIONS.length * 4 + 4, failures: 0 }, null, 2));
