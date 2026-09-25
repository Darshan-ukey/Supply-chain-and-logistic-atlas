import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AiIntentPlanner,
  BuiltinDiscoverer,
  BuiltinPlanValidator,
  createEvidenceGraph,
  createBriskAiTesting,
  defineConfig,
  normalizeConfig,
  parseAiIntentForTesting,
  parseAiPlanForTesting,
  validatePlanJsonContract,
} from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const server = createServer((request, response) => {
  if (request.url === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, service: 'ai-fixture' }));
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><html><body><main>Fixture app</main></body></html>');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('Fixture server did not expose a TCP port');

try {
  const config = normalizeConfig(defineConfig({
    app: {
      name: 'AI fixture app',
      baseUrl: `http://127.0.0.1:${address.port}`,
      repoPath: join(here, 'site'),
      env: 'local',
    },
    auth: { type: 'none' },
    ai: {
      provider: 'openai-compatible',
      model: 'fixture-model',
      apiKeyEnv: 'BRISK_AITESTING_AI_API_KEY',
      repairAttempts: 1,
    },
    runtime: {
      artifactsDir: '.brisk-aitesting-fixtures/artifacts',
      timeoutMs: 30000,
      retries: 0,
      headless: true,
      dryRun: false,
    },
    discovery: {
      includeRepo: true,
      includeUi: true,
      includeApi: true,
      includeContracts: false,
      uiRoutes: ['/'],
      apiRoutes: [{ method: 'GET', path: '/api/health' }],
    },
    security: {
      networkPolicy: 'localhost-only',
      allowedHosts: ['localhost', '127.0.0.1'],
      redactSecrets: true,
      allowFallbackTargets: true,
      allowAiTargets: true,
    },
  }));
  const runId = `fixture_${randomUUID()}`;
  const discoverer = new BuiltinDiscoverer();
  const discovery = await discoverer.discover({ config, input: { goal: 'fixture coverage' }, runId });
  const context = { config, input: { goal: 'fixture coverage', scenarios: 2, mode: 'automatic', requiredTypes: ['ui', 'api'] }, runId, discovery };
  const validator = new BuiltinPlanValidator();

  const fixtures = [
    {
      name: 'markdown fenced json with trailing commas',
      content: '```json\n{ "mode": "automatic", "warnings": ["ok",], "scenarios": [{ "name": "Home", "type": "browser", "target": { "route": "/" }, "assertions": ["visible"], "evidenceRequired": ["ui"], },] }\n```',
      expectParseError: 'not valid JSON',
    },
    {
      name: 'json-ish object with unquoted keys',
      content: '{ mode: "automatic", scenarios: [{ name: "Home", type: "browser", target: { route: "/" }, assertions: ["visible"], evidenceRequired: ["ui"] }] }',
      expectParseError: 'Expected property name',
    },
    {
      name: 'top-level testPlan wrapper and tests alias',
      content: JSON.stringify({
        testPlan: {
          mode: 'automatic',
          tests: [
            {
              name: 'Health alias',
              type: 'backend',
              objective: 'health responds',
              target: { method: 'read', path: 'api/health?x=1' },
              expected: { statusCode: '200', json: { ok: true } },
              assertions: ['status is ok'],
              evidenceRequired: ['api'],
            },
          ],
        },
      }),
      assert(plan) {
        const api = assertHasType(plan, 'api');
        if (api.target?.method !== 'GET') throw new Error('expected read alias to normalize to GET');
        if (api.target?.path !== '/api/health') throw new Error(`expected normalized path /api/health, got ${api.target?.path}`);
        if (api.expect?.status !== 200) throw new Error('expected string status to normalize to number 200');
      },
    },
    {
      name: 'duplicate ids are repaired by orchestrator',
      content: JSON.stringify({
        mode: 'automatic',
        scenarios: [
          {
            id: 'same_id',
            name: 'First duplicate',
            type: 'ui',
            objective: 'first duplicate',
            target: { route: '/' },
            assertions: ['visible'],
            evidenceRequired: ['ui'],
          },
          {
            id: 'same_id',
            name: 'Second duplicate',
            type: 'api',
            objective: 'second duplicate',
            target: { method: 'GET', path: '/api/health' },
            expect: { status: 200 },
            assertions: ['ok'],
            evidenceRequired: ['api'],
          },
        ],
      }),
      expectValidationError: 'DUPLICATE_ID',
    },
    {
      name: 'legacy tests alias and integration category',
      content: JSON.stringify({
        mode: 'automatic',
        tests: [
          {
            name: 'Workflow loads dashboard',
            category: 'integration',
            objective: 'workflow route loads',
            target: { url: 'http://example.test//dashboard/?from=ai' },
            assertions: ['dashboard visible'],
            evidenceRequired: ['ui'],
          },
        ],
      }),
      assert(plan) {
        const ui = assertHasType(plan, 'ui');
        if (ui.target?.route !== '/dashboard') throw new Error(`expected /dashboard, got ${ui.target?.route}`);
      },
    },
    {
      name: 'custom type is corrected from target evidence',
      content: JSON.stringify({
        mode: 'automatic',
        scenarios: [
          {
            name: 'Health endpoint responds',
            type: 'custom',
            objective: 'health endpoint responds',
            target: { method: 'GET', path: '/api/health', sourceOfTruth: 'observed' },
            expect: { status: 200 },
            assertions: ['health endpoint is reachable'],
            evidenceRequired: ['api'],
          },
          {
            name: 'Home page loads',
            type: 'custom',
            objective: 'home route loads',
            target: { route: '/', sourceOfTruth: 'observed' },
            assertions: ['page body is visible'],
            evidenceRequired: ['ui'],
          },
        ],
      }),
      assert(plan) {
        const api = plan.scenarios.find((scenario) => scenario.target?.path === '/api/health');
        const ui = plan.scenarios.find((scenario) => scenario.target?.route === '/');
        if (api?.type !== 'api') throw new Error(`expected custom API target to normalize to api, got ${api?.type}`);
        if (ui?.type !== 'ui') throw new Error(`expected custom UI target to normalize to ui, got ${ui?.type}`);
      },
    },
    {
      name: 'natural language refusal is rejected',
      content: 'I cannot generate tests for this application without more information.',
      expectParseError: 'AI planner did not return a JSON object',
    },
  ];

  const errors = [];

  const validIntent = JSON.stringify({
    scenarios: [{
      id: 'intent_home',
      name: 'Home intent',
      objective: 'Prove the home experience is available',
      actions: [{ id: 'view_home', verb: 'read', resource: 'home', expectedOutcomes: ['home is available'] }],
      invariants: [],
      evidenceRequired: ['observable home result'],
      cleanup: 'automatic',
    }],
    warnings: [],
  });
  const intentEnvelopeFixtures = [
    { name: 'strict intent JSON', content: validIntent, accepted: true },
    {
      name: 'empty warning text is harmless and removed',
      content: JSON.stringify({ ...JSON.parse(validIntent), warnings: ['', '  '] }),
      accepted: true,
      expectedWarnings: [],
    },
    { name: 'one closed reasoning envelope then strict intent JSON', content: `<think>reasoning is not executable</think>\n${validIntent}`, accepted: true },
    { name: 'one closed reasoning envelope then one strict JSON fence', content: '<think>reasoning is not executable</think>\n```json\n' + validIntent + '\n```', accepted: true },
    { name: 'unterminated reasoning envelope', content: `<think>unfinished\n${validIntent}`, accepted: false },
    { name: 'reasoning envelope with trailing prose', content: `<think>done</think>\n${validIntent}\nextra`, accepted: false },
    { name: 'two reasoning envelopes', content: `<think>first</think><think>second</think>\n${validIntent}`, accepted: false },
  ];
  for (const fixture of intentEnvelopeFixtures) {
    try {
      const intent = parseAiIntentForTesting(fixture.content, { ...context, input: { ...context.input, scenarios: 1, scenarioCountPolicy: 'exact' } });
      if (!fixture.accepted) errors.push(`${fixture.name}: expected rejection`);
      if (fixture.expectedWarnings !== undefined && JSON.stringify(intent.warnings) !== JSON.stringify(fixture.expectedWarnings)) {
        errors.push(`${fixture.name}: expected warnings ${JSON.stringify(fixture.expectedWarnings)}, got ${JSON.stringify(intent.warnings)}`);
      }
    } catch (error) {
      if (fixture.accepted) errors.push(`${fixture.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const emptyIntentEvidence = createEvidenceGraph([]);
  const invalidEmptyActionsIntent = JSON.stringify({
    scenarios: [{
      id: 'empty_actions',
      name: 'Empty actions',
      objective: 'Must be repaired',
      actions: [],
      invariants: [],
      evidenceRequired: [],
      cleanup: 'automatic',
    }],
    warnings: [],
  });
  let recoveryCalls = 0;
  const recoveringIntentPlanner = new AiIntentPlanner({
    name: 'invalid-then-valid-intent-fixture',
    async complete() {
      recoveryCalls += 1;
      return { content: recoveryCalls === 1 ? invalidEmptyActionsIntent : validIntent };
    },
  });
  const repairedIntent = await recoveringIntentPlanner.plan({
    ...context,
    config: { ...context.config, planning: { ...context.config.planning, repairAttempts: 2 } },
    input: { ...context.input, scenarios: 1, scenarioCountPolicy: 'exact' },
  }, emptyIntentEvidence);
  if (recoveryCalls !== 2 || repairedIntent.scenarios[0]?.actions.length !== 1) {
    errors.push(`intent repair recovery: expected 2 provider calls and one repaired action, got calls=${recoveryCalls} intent=${JSON.stringify(repairedIntent)}`);
  }

  let exhaustionCalls = 0;
  const exhaustingIntentPlanner = new AiIntentPlanner({
    name: 'always-invalid-intent-fixture',
    async complete() {
      exhaustionCalls += 1;
      return { content: invalidEmptyActionsIntent };
    },
  });
  try {
    await exhaustingIntentPlanner.plan({
      ...context,
      config: { ...context.config, planning: { ...context.config.planning, repairAttempts: 2 } },
      input: { ...context.input, scenarios: 1, scenarioCountPolicy: 'exact' },
    }, emptyIntentEvidence);
    errors.push('intent repair exhaustion: expected bounded failure');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (exhaustionCalls !== 3 || !message.includes('after 2 repair attempt(s)') || !message.includes('actions must be a non-empty array')) {
      errors.push(`intent repair exhaustion: expected 3 calls and actionable final error, got calls=${exhaustionCalls} message=${message}`);
    }
  }

  for (const fixture of fixtures) {
    try {
      const plan = parseAiPlanForTesting(fixture.content, context);
      const validation = validator.validate({ config, input: context.input, plan });
      const codes = validation.issues.map((issue) => issue.code);
      if (fixture.expectParseError !== undefined) {
        errors.push(`${fixture.name}: expected parse error ${fixture.expectParseError}`);
      } else if (fixture.expectValidationError !== undefined) {
        if (!codes.includes(fixture.expectValidationError)) errors.push(`${fixture.name}: expected validation error ${fixture.expectValidationError}, got ${codes.join(',')}`);
      } else if (!validation.valid) {
        errors.push(`${fixture.name}: expected valid plan, got ${codes.join(',')}`);
      } else {
        fixture.assert?.(plan);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (fixture.expectParseError === undefined || !message.includes(fixture.expectParseError)) {
        errors.push(`${fixture.name}: ${message}`);
      }
    }
  }

  const contractFixtures = [
    {
      name: 'scenario-level headers are rejected',
      plan: {
        ...validPlanSkeleton(context),
        scenarios: [
          {
            ...validApiScenario(),
            headers: { authorization: 'Bearer token' },
          },
        ],
      },
      code: 'PLAN_CONTRACT_UNRECOGNIZED_KEY',
      path: 'plan.scenarios.0.headers',
    },
    {
      name: 'unsupported category field is rejected',
      plan: {
        ...validPlanSkeleton(context),
        scenarios: [
          {
            ...validApiScenario(),
            category: 'integration',
          },
        ],
      },
      code: 'PLAN_CONTRACT_UNRECOGNIZED_KEY',
      path: 'plan.scenarios.0.category',
    },
    {
      name: 'unsupported type value is rejected',
      plan: {
        ...validPlanSkeleton(context),
        scenarios: [
          {
            ...validApiScenario(),
            type: 'integration',
          },
        ],
      },
      code: 'PLAN_CONTRACT_INVALID_VALUE',
      path: 'plan.scenarios.0.type',
    },
    {
      name: 'missing evidence is rejected',
      plan: {
        ...validPlanSkeleton(context),
        scenarios: [
          {
            id: 'missing_evidence',
            name: 'Missing evidence',
            type: 'api',
            objective: 'must be rejected',
            target: { method: 'GET', path: '/api/health' },
            assertions: ['status is ok'],
          },
        ],
      },
      code: 'PLAN_CONTRACT_REQUIRED',
      path: 'plan.scenarios.0.evidenceRequired',
    },
    {
      name: 'invalid ui action value contract is rejected',
      plan: {
        ...validPlanSkeleton(context),
        scenarios: [
          {
            id: 'bad_ui_action',
            name: 'Bad UI action',
            type: 'ui',
            objective: 'must be rejected',
            target: { route: '/' },
            assertions: ['page visible'],
            evidenceRequired: ['ui'],
            uiActions: [{ action: 'fill', evidenceId: 'ui_el_001' }],
          },
        ],
      },
      code: 'PLAN_CONTRACT_REQUIRED',
      path: 'plan.scenarios.0.uiActions.0.value',
    },
  ];

  for (const fixture of contractFixtures) {
    const issues = validatePlanJsonContract(fixture.plan);
    if (!issues.some((issue) => issue.code === fixture.code && issue.path === fixture.path)) {
      errors.push(`${fixture.name}: expected ${fixture.code} at ${fixture.path}, got ${JSON.stringify(issues)}`);
    }
  }

  const malformedValidation = validator.validate({
    config,
    input: context.input,
    plan: { schemaVersion: 'brisk-aitesting.plan.v1', scenarios: [] },
  });
  if (malformedValidation.valid || !malformedValidation.issues.some((issue) => issue.code === 'PLAN_CONTRACT_REQUIRED')) {
    errors.push(`malformed validator gate: expected required contract issues, got ${JSON.stringify(malformedValidation)}`);
  }

  const missingMutationBodyValidation = validator.validate({
    config,
    input: context.input,
    plan: {
      ...validPlanSkeleton(context),
      scenarios: [
        {
          ...validApiScenario(),
          id: 'missing_mutation_body',
          name: 'Create widget with no body',
          target: { method: 'POST', path: '/api/widgets' },
          request: { headers: { authorization: 'Bearer token' } },
          expect: { status: 201 },
        },
      ],
    },
  });
  if (missingMutationBodyValidation.valid || !missingMutationBodyValidation.issues.some((issue) => issue.code === 'REQUIRED_MUTATION_BODY')) {
    errors.push(`missing mutation body validator gate: expected REQUIRED_MUTATION_BODY, got ${JSON.stringify(missingMutationBodyValidation)}`);
  }

  const lowValueNameValidation = validator.validate({
    config,
    input: context.input,
    plan: {
      ...validPlanSkeleton(context),
      scenarios: [
        {
          ...validApiScenario(),
          id: 'low_value_name',
          name: 'ai-e2e-11111111-1111-1111-1111-111111111111',
        },
      ],
    },
  });
  if (lowValueNameValidation.valid || !lowValueNameValidation.issues.some((issue) => issue.code === 'LOW_VALUE_NAME')) {
    errors.push(`low-value name validator gate: expected LOW_VALUE_NAME, got ${JSON.stringify(lowValueNameValidation)}`);
  }

  const sameRouteDiscovery = {
    ...context.discovery,
    apiRoutes: [{ method: 'DELETE', path: '/api/items/{id}', source: 'runtime', confidence: 1 }],
  };
  const sameRoutePlan = {
    ...validPlanSkeleton(context),
    discovery: sameRouteDiscovery,
    scenarios: [
      { ...validApiScenario(), id: 'same_route_cleanup', name: 'Cleanup item', target: { method: 'DELETE', path: '/api/items/known-id', sourceOfTruth: 'observed' }, expect: { status: 204 }, metadata: { operationId: 'item.cleanup' } },
      { ...validApiScenario(), id: 'same_route_archive', name: 'Archive item', target: { method: 'DELETE', path: '/api/items/known-id', sourceOfTruth: 'observed' }, expect: { status: 202 }, metadata: { operationId: 'item.archive' } },
    ],
  };
  const sameRouteInput = { goal: 'Distinguish same-route operations', requiredTypes: ['api'], authoritativeOperations: [
    { operationId: 'item.cleanup', method: 'DELETE', path: '/api/items/{id}', successStatusCodes: [204], source: 'runtime' },
    { operationId: 'item.archive', method: 'DELETE', path: '/api/items/{id}', successStatusCodes: [202], source: 'runtime' },
  ] };
  const sameRouteValidation = validator.validate({ config, input: sameRouteInput, plan: sameRoutePlan });
  if (!sameRouteValidation.valid) errors.push(`same-route operation identity: expected valid, got ${JSON.stringify(sameRouteValidation.issues)}`);
  const ambiguousSameRoute = validator.validate({ config, input: sameRouteInput, plan: { ...sameRoutePlan, scenarios: [{ ...sameRoutePlan.scenarios[0], metadata: undefined }] } });
  if (ambiguousSameRoute.valid || !ambiguousSameRoute.issues.some((issue) => issue.code === 'MUTATION_CONTRACT_REQUIRED')) errors.push('same-route operation identity: missing operation id was not rejected');

  const semanticIntentProvider = {
    name: 'semantic-intent-provider',
    calls: 0,
    requests: [],
    async complete(request) {
      this.calls += 1;
      this.requests.push(request);
      return {
        content: JSON.stringify({
          scenarios: [
            {
              id: 'health_intent',
              name: 'Application health is observable',
              objective: 'Prove the application reports healthy operation.',
              actions: [{
                id: 'read_health',
                verb: 'read',
                resource: 'health',
                capability: 'api.http',
                expectedOutcomes: [],
              }],
              invariants: ['the application remains available'],
              evidenceRequired: ['health observation'],
              cleanup: 'isolated',
            },
          ],
          warnings: [],
        }),
      };
    },
  };
  const tester = createBriskAiTesting({
    ...config,
    contracts: { openApiPath: join(here, 'openapi.json') },
    discovery: { ...config.discovery, includeContracts: true },
    aiProvider: semanticIntentProvider,
  });
  const semanticResult = await tester.run({
    goal: 'Prove application health',
    scenarios: 1,
    scenarioCountPolicy: 'exact',
    mode: 'automatic',
    requiredTypes: ['api'],
  });
  if (semanticIntentProvider.calls !== 1) errors.push(`expected semantic provider to be called once, got ${semanticIntentProvider.calls}`);
  if (semanticIntentProvider.requests[0]?.jsonSchemaName !== 'brisk-aitesting.intent.v1') errors.push('expected primary AI boundary to request brisk-aitesting.intent.v1');
  if ('target' in (semanticIntentProvider.requests[0]?.jsonSchema?.properties?.scenarios?.items?.properties ?? {})) errors.push('intent schema must not expose executable target');
  if (semanticResult.summary.passed !== 1) errors.push(`expected semantic run to pass 1, got ${semanticResult.summary.passed}`);
  if (semanticResult.plan.scenarios[0]?.target?.path !== '/api/health') errors.push(`expected compiler to select /api/health, got ${semanticResult.plan.scenarios[0]?.target?.path}`);
  if (semanticResult.plan.scenarios[0]?.metadata?.generatedBy !== 'universal-semantic-compiler') errors.push('expected universal compiler provenance on executable scenario');

  if (errors.length > 0) {
    console.error(JSON.stringify({ status: 'failed', errors }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      status: 'passed',
      fixtures: fixtures.length,
      intentEnvelopeFixtures: intentEnvelopeFixtures.length,
      intentRepairFixtures: 2,
      authorityIdentityFixtures: 2,
      contractFixtures: contractFixtures.length,
      semanticRun: semanticResult.summary,
      primaryAiSchema: semanticIntentProvider.requests[0]?.jsonSchemaName,
    }, null, 2));
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function assertHasType(plan, type) {
  const scenario = plan.scenarios.find((candidate) => candidate.type === type);
  if (scenario === undefined) throw new Error(`expected ${type} scenario`);
  return scenario;
}

function validPlanSkeleton(context) {
  return {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId: context.runId,
    goal: context.input.goal,
    mode: 'automatic',
    scenarios: [],
    discovery: context.discovery,
    warnings: [],
    createdAt: new Date().toISOString(),
  };
}

function validApiScenario() {
  return {
    id: 'valid_api',
    name: 'Valid API',
    type: 'api',
    objective: 'health responds',
    target: { method: 'GET', path: '/api/health', sourceOfTruth: 'observed' },
    expect: { status: 200 },
    assertions: ['status is ok'],
    evidenceRequired: ['api'],
  };
}
