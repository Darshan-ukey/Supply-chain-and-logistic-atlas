import { createServer } from 'node:http';
import { HostHttpCapabilityAdapter, createBriskAiTesting, createHttpEvidenceGraph } from '../dist/index.js';

// The production death this suite pins down: the intent AI wrote
// { orgId: { semanticType: 'org.id', generate: true } } for an identifier the
// application itself lists, the compiler refused with NO_GENERATION_RECIPE,
// the repair loop could not walk it back, and a whole 15-scenario generation
// returned nothing. The engine must (1) steer the first shot to fromActionId,
// (2) refuse a repair that generates the ungeneratable and heal on the next
// attempt, and (3) when one scenario stays broken, ship the rest with the
// dropped one named — never zero.

const errors = [];

const app = createServer((request, response) => {
  const ok = (body) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.url === '/api/health') return ok({ success: true, data: { ok: true } });
  if (request.url === '/api/orgs') return ok({ success: true, data: [{ id: 'org_1' }] });
  if (request.url?.startsWith('/api/orgs/')) return ok({ success: true, data: { id: 'org_1' } });
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ success: false }));
});
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const address = app.address();
if (address === null || typeof address === 'string') throw new Error('Fixture app did not expose a TCP port');
const baseUrl = `http://127.0.0.1:${address.port}`;

const OPERATIONS = [
  { operationId: 'malkom.health.read', method: 'GET', path: '/api/health', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.orgs.list', method: 'GET', path: '/api/orgs', successStatusCodes: [200], source: 'host-adapter' },
  { operationId: 'malkom.orgs.read', method: 'GET', path: '/api/orgs/:orgId', successStatusCodes: [200], source: 'host-adapter' },
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
];

const orgAction = (values) => ({
  id: 'read_org',
  verb: 'read',
  resource: 'organization',
  capability: 'api.http',
  values,
  expectedOutcomes: [],
});
const listAction = { id: 'read_orgs', verb: 'list', resource: 'organization', capability: 'api.http', expectedOutcomes: [] };
const healthScenario = (id) => ({
  id,
  name: 'Application health is observable',
  objective: 'Prove the application reports healthy operation.',
  actions: [{ id: 'read_health', verb: 'read', resource: 'health', capability: 'api.http', expectedOutcomes: [] }],
  invariants: [],
  evidenceRequired: ['health observation'],
  cleanup: 'isolated',
});
const orgScenario = (values) => ({
  id: 'org_journey',
  name: 'One organization can be read',
  objective: 'Prove a listed organization can be fetched.',
  actions: [listAction, orgAction(values)],
  invariants: [],
  evidenceRequired: ['organization observation'],
  cleanup: 'isolated',
});
const intentJson = (scenarios) => JSON.stringify({ scenarios, warnings: [] });
const GENERATE_ORG = { orgId: { semanticType: 'org.id', generate: true } };
const FROM_LIST = { orgId: { semanticType: 'org.id', fromActionId: 'read_orgs' } };
const repairJson = (values) => JSON.stringify({
  repairs: [{ scenarioId: 'org_journey', actionId: 'read_org', action: orgAction(values) }],
  warnings: [],
});

const makeConfig = (repairAttempts) => ({
  app: { name: 'Recipe fixture app', baseUrl, env: 'local' },
  auth: { type: 'none' },
  ai: { provider: 'openai-compatible', model: 'fixture-model', apiKeyEnv: 'BRISK_AITESTING_AI_API_KEY', repairAttempts },
  runtime: { artifactsDir: '.brisk-aitesting-fixtures/artifacts', timeoutMs: 30000, retries: 0, headless: true, dryRun: true },
  discovery: { includeRepo: false, includeUi: false, includeApi: true, includeContracts: false, uiRoutes: [], apiRoutes: OPERATIONS.map((op) => ({ method: op.method, path: op.path })) },
  security: { networkPolicy: 'localhost-only', allowedHosts: ['localhost', '127.0.0.1'], redactSecrets: true, allowFallbackTargets: true, allowAiTargets: true },
  // The evidence graph carries the default "host-http" adapter id; the same
  // adapter defineHostConfig registers must compile it here.
  capabilityAdapters: [new HostHttpCapabilityAdapter()],
});
const runInput = (scenarios) => ({
  goal: 'Prove organizations behave',
  scenarios,
  scenarioCountPolicy: 'exact',
  mode: 'automatic',
  requiredTypes: ['api'],
  authoritativeOperations: OPERATIONS,
  evidenceGraph: createHttpEvidenceGraph(CONTRACTS),
});
const scripted = (steps) => {
  const calls = [];
  return {
    calls,
    provider: {
      name: 'scripted-recipe-provider',
      async complete(request) {
        calls.push({ purpose: request.purpose, system: request.system, user: request.user });
        const step = steps[calls.length - 1];
        if (step === undefined) throw new Error(`unexpected AI call #${calls.length} (${request.purpose})`);
        return { content: step(request) };
      },
    },
  };
};

try {
  // 1. The running car: the writer prompt now carries the law, and a correct
  //    first shot compiles with exactly one AI call — no repair wave at all.
  {
    const { calls, provider } = scripted([() => intentJson([orgScenario(FROM_LIST)])]);
    const result = await createBriskAiTesting({ ...makeConfig(2), aiProvider: provider }).run(runInput(1));
    if (calls.length !== 1) errors.push(`first shot: expected 1 AI call, got ${calls.length}`);
    if (!calls[0].system.includes('generatedWhenOmitted')) errors.push('first shot: writer prompt must teach the generatedWhenOmitted rule');
    if (!calls[0].system.includes('can never be generated')) errors.push('first shot: writer prompt must forbid generating app-created identifiers');
    if (result.status === 'error') errors.push('first shot: run must not fail');
    if (result.plan.counts?.checks !== 1 || result.plan.scenarios.length === 0) {
      errors.push(`first shot: expected 1 delivered check, got checks=${result.plan.counts?.checks} steps=${result.plan.scenarios.length}`);
    }
  }

  // 2. A poisoned repair (generate again) is refused before it can compile,
  //    the refusal reaches the next attempt, and fromActionId heals the run.
  {
    const { calls, provider } = scripted([
      () => intentJson([orgScenario(GENERATE_ORG)]),
      () => repairJson(GENERATE_ORG),
      () => repairJson(FROM_LIST),
    ]);
    const result = await createBriskAiTesting({ ...makeConfig(2), aiProvider: provider }).run(runInput(1));
    if (calls.length !== 3) errors.push(`poisoned repair: expected 3 AI calls, got ${calls.length}`);
    if (calls[1]?.purpose !== 'intent-semantic-repair') errors.push(`poisoned repair: call 2 must be the semantic repair, got ${calls[1]?.purpose}`);
    if (!calls[1]?.user.includes('NO_GENERATION_RECIPE')) errors.push('poisoned repair: the repair prompt must carry the NO_GENERATION_RECIPE diagnostic');
    if (!calls[2]?.user.includes('no operation declares a recipe')) errors.push('poisoned repair: the second attempt must see why the first repair was refused');
    if (result.status === 'error') errors.push('poisoned repair: run must not fail');
    if (result.plan.counts?.checks !== 1 || result.plan.scenarios.length === 0) {
      errors.push(`poisoned repair: expected 1 delivered check, got checks=${result.plan.counts?.checks} steps=${result.plan.scenarios.length}`);
    }
  }

  // 3. Never zero: when one scenario stays broken after the repair budget,
  //    the compiled scenario ships and the dropped one is named with its reason.
  {
    const { calls, provider } = scripted([
      () => intentJson([healthScenario('health_check'), orgScenario(GENERATE_ORG)]),
      () => repairJson(GENERATE_ORG),
    ]);
    const result = await createBriskAiTesting({ ...makeConfig(1), aiProvider: provider }).run(runInput(2));
    if (calls.length !== 2) errors.push(`partial delivery: expected 2 AI calls, got ${calls.length}`);
    if (result.status === 'error') errors.push(`partial delivery: run must not fail, got ${JSON.stringify(result.outcome?.issues ?? [])}`);
    if (result.plan.counts?.checks !== 1) errors.push(`partial delivery: expected 1 delivered check, got ${result.plan.counts?.checks}`);
    const everyDeliveredIsHealth = result.plan.scenarios.every((scenario) => scenario.metadata?.intentScenarioId === 'health_check');
    if (result.plan.scenarios.length === 0 || !everyDeliveredIsHealth) {
      errors.push('partial delivery: only the health check may ship');
    }
    const record = (result.plan.droppedScenarios ?? [])[0];
    if (record?.name !== 'One organization can be read' || !record.reasons.some((reason) => reason.includes('NO_GENERATION_RECIPE'))) {
      errors.push(`partial delivery: expected a dropped-scenario record naming NO_GENERATION_RECIPE, got ${JSON.stringify(result.plan.droppedScenarios)}`);
    }
    const warning = (result.plan.warnings ?? []).find((entry) => entry.includes('Dropped "One organization can be read"'));
    if (warning === undefined || !warning.includes('NO_GENERATION_RECIPE')) {
      errors.push(`partial delivery: expected a dropped-scenario warning naming NO_GENERATION_RECIPE, got ${JSON.stringify(result.plan.warnings)}`);
    }
  }
} finally {
  await new Promise((resolve) => app.close(resolve));
}

if (errors.length > 0) {
  console.error(JSON.stringify({ suite: 'no-generation-recipe-recovery', failures: errors.length, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ suite: 'no-generation-recipe-recovery', checks: 16, failures: 0 }, null, 2));
