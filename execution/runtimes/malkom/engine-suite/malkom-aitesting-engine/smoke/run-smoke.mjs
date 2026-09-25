import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBriskAiTesting, defineConfig, normalizeConfig, parseAiPlanForTesting } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, 'site');

const server = createServer(async (request, response) => {
  try {
    if (request.url === '/api/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, service: 'smoke-api' }));
      return;
    }
    if (request.url === '/api/secure') {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } }));
      return;
    }
    if (request.url === '/api/messages' && request.method === 'POST') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = rawBody.trim().length === 0 ? null : JSON.parse(rawBody);
      if (body !== null && typeof body === 'object' && !Array.isArray(body) && typeof body.text === 'string') {
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ accepted: true, id: 'msg_001' }));
        return;
      }
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'INVALID_MESSAGE', message: 'text is required' } }));
      return;
    }
    const html = await readFile(join(appRoot, 'index.html'), 'utf8');
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html.replaceAll('__PATH__', request.url ?? '/'));
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') {
  throw new Error('Smoke server did not expose a TCP port');
}

try {
  const config = defineConfig({
    app: {
      name: 'brisk-aitesting smoke app',
      baseUrl: `http://127.0.0.1:${address.port}`,
      repoPath: process.cwd(),
      env: 'local',
    },
    auth: { type: 'none' },
    contracts: {
      openApiPath: join(here, 'openapi.yaml'),
    },
    runtime: {
      artifactsDir: '.brisk-aitesting-smoke/artifacts',
      timeoutMs: 30000,
      retries: 0,
      headless: true,
      dryRun: false,
    },
    discovery: {
      includeRepo: true,
      includeUi: true,
      includeApi: false,
      includeContracts: true,
      uiRoutes: ['/', '/login'],
    },
    security: {
      networkPolicy: 'localhost-only',
      allowedHosts: ['localhost', '127.0.0.1'],
      redactSecrets: true,
    },
  });

  const planner = {
    name: 'smoke-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'smoke_ui_home',
            name: 'Smoke app homepage renders',
            type: 'ui',
            objective: 'Real browser can load homepage.',
            target: { route: '/', sourceOfTruth: 'observed' },
            assertions: ['body is visible', 'body is not blank'],
            evidenceRequired: ['ui'],
          },
          {
            id: 'smoke_ui_login',
            name: 'Smoke app login page renders',
            type: 'ui',
            objective: 'Real browser can load login route.',
            target: { route: '/login', sourceOfTruth: 'observed' },
            assertions: ['body is visible', 'body is not blank'],
            uiActions: [
              { action: 'fill', evidenceId: 'ui_el_003', value: 'user@example.com', description: 'Fill grounded email input' },
              { action: 'fill', evidenceId: 'ui_el_005', value: 'secret-password', description: 'Fill grounded password input' },
              { action: 'click', evidenceId: 'ui_el_006', description: 'Click grounded sign in button' },
            ],
            evidenceRequired: ['ui'],
          },
          {
            id: 'smoke_api_health',
            name: 'Health API returns ok',
            type: 'api',
            objective: 'API engine checks status and JSON shape.',
            target: { method: 'GET', path: '/api/health', sourceOfTruth: 'contract' },
            expect: { status: 200, json: { ok: true, service: 'smoke-api' } },
            assertions: ['status is 200', 'json.ok is true'],
            evidenceRequired: ['api'],
          },
          {
            id: 'smoke_api_secure',
            name: 'Secure API rejects anonymous access',
            type: 'api',
            objective: 'API engine checks auth boundary.',
            target: { method: 'GET', path: '/api/secure', sourceOfTruth: 'contract' },
            expect: { status: 401, json: { 'error.code': 'UNAUTHORIZED' } },
            assertions: ['status is 401', 'error.code is UNAUTHORIZED'],
            evidenceRequired: ['api', 'auth'],
          },
          {
            id: 'smoke_contract_openapi_yaml',
            name: 'YAML OpenAPI contract exposes operations',
            type: 'contract',
            objective: 'Contract engine summarizes YAML OpenAPI operations for host consumption.',
            target: { schema: join(here, 'openapi.yaml'), sourceOfTruth: 'contract' },
            assertions: ['contract parses', 'operations are discovered'],
            evidenceRequired: ['schema', 'api'],
          },
          {
            id: 'smoke_contract_openapi_json',
            name: 'JSON OpenAPI contract exposes equivalent operations',
            type: 'contract',
            objective: 'JSON and YAML OpenAPI inputs produce equivalent operation summaries.',
            target: { schema: join(here, 'openapi.json'), sourceOfTruth: 'contract' },
            assertions: ['contract parses', 'operations are discovered'],
            evidenceRequired: ['schema', 'api'],
          },
        ],
      };
    },
  };
  const tester = createBriskAiTesting(config, { planner });
  const result = await tester.run({
    goal: 'Test UI and API execution through real engines',
    scenarios: 6,
    mode: 'automatic',
  });

  const errors = [];
  if (result.schemaVersion !== 'brisk-aitesting.result.v1') errors.push('wrong result schema');
  if (result.handover.schemaVersion !== 'brisk-aitesting.handover.v1') errors.push('wrong handover schema');
  if (result.discovery.schemaVersion !== 'brisk-aitesting.discovery.v1') errors.push('wrong discovery schema');
  if (result.plan.discovery.schemaVersion !== 'brisk-aitesting.discovery.v1') errors.push('plan missing discovery');
  if (!result.discovery.uiRoutes.some((route) => route.path === '/')) errors.push('discovery missing root UI route');
  if (!result.discovery.apiRoutes.some((route) => route.path === '/api/health')) errors.push('discovery missing health API route');
  if (!result.discovery.apiRoutes.some((route) => route.source === 'contract' && route.method === 'POST' && route.path === '/api/messages' && route.operationId === 'publishMessage')) {
    errors.push('discovery missing OpenAPI contract route');
  }
  if (!result.discovery.contracts.some((contract) => contract.kind === 'openapi' && contract.exists === true && contract.operations >= 3)) {
    errors.push('discovery missing OpenAPI operation count');
  }
  if (result.summary.total !== 6) errors.push(`expected 6 tests, got ${result.summary.total}`);
  if (result.summary.passed !== 6) errors.push(`expected 6 passed, got ${result.summary.passed}`);
  if (!result.artifacts.some((artifact) => artifact.kind === 'json')) errors.push('missing JSON artifact');
  if (!result.artifacts.some((artifact) => artifact.kind === 'junit' && artifact.metadata?.schemaVersion === 'brisk-aitesting.junit-report.v1')) errors.push('missing JUnit report artifact');
  if (!result.artifacts.some((artifact) => artifact.kind === 'html' && artifact.metadata?.schemaVersion === 'brisk-aitesting.html-report.v1')) errors.push('missing HTML report artifact');
  if (!result.artifacts.some((artifact) => artifact.kind === 'test-file')) errors.push('missing generated test artifact');
  if (!result.artifacts.some((artifact) => artifact.label === 'API request/response')) errors.push('missing API request/response artifact');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.api-evidence.v1')) errors.push('missing API evidence metadata');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.openapi-summary.v1')) errors.push('missing OpenAPI summary metadata');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.playwright-evidence.v1')) errors.push('missing Playwright evidence manifest metadata');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.ui-grounding.v1')) errors.push('missing UI grounding metadata');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.ui-actions.v1')) errors.push('missing grounded UI action metadata');
  if (!result.artifacts.some((artifact) => artifact.kind === 'trace')) errors.push('missing Playwright trace artifact');
  if (!result.artifacts.some((artifact) => artifact.kind === 'screenshot')) errors.push('missing Playwright screenshot artifact');
  const apiEvidenceArtifact = result.artifacts.find((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.api-evidence.v1');
  const openApiSummaryArtifacts = result.artifacts.filter((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.openapi-summary.v1');
  const uiEvidenceArtifact = result.artifacts.find((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.playwright-evidence.v1');
  const groundingArtifact = result.artifacts.find((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.ui-grounding.v1');
  const actionArtifact = result.artifacts.find((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.ui-actions.v1' && artifact.metadata?.actions === 3);
  if (apiEvidenceArtifact?.path !== undefined) {
    const apiEvidence = JSON.parse(await readFile(apiEvidenceArtifact.path, 'utf8'));
    if (apiEvidence.schemaVersion !== 'brisk-aitesting.api-evidence.v1') errors.push('wrong API evidence schema');
    if (apiEvidence.scenario?.id === undefined) errors.push('API evidence missing scenario id');
    if (!Array.isArray(apiEvidence.assertions)) errors.push('API evidence missing assertions');
    if (apiEvidence.contract?.operationId !== 'getHealth') errors.push('API evidence missing OpenAPI contract linkage');
  }
  if (openApiSummaryArtifacts.length >= 2 && openApiSummaryArtifacts.every((artifact) => artifact.path !== undefined)) {
    const openApiSummaries = await Promise.all(openApiSummaryArtifacts.map(async (artifact) => JSON.parse(await readFile(artifact.path, 'utf8'))));
    const yamlSummary = openApiSummaries.find((summary) => summary.format === 'yaml');
    const jsonSummary = openApiSummaries.find((summary) => summary.format === 'json');
    for (const openApiSummary of openApiSummaries) {
      if (openApiSummary.schemaVersion !== 'brisk-aitesting.openapi-summary.v1') errors.push('wrong OpenAPI summary schema');
      if (!Array.isArray(openApiSummary.operations) || openApiSummary.operations.length < 3) errors.push('OpenAPI summary missing operations');
      if (!openApiSummary.operations.some((operation) => operation.method === 'POST' && operation.path === '/api/messages' && operation.requestBodyRequired === true)) {
        errors.push('OpenAPI summary missing POST /api/messages request body signal');
      }
      const messageOperation = openApiSummary.operations.find((operation) => operation.method === 'POST' && operation.path === '/api/messages');
      if (messageOperation?.requestExample?.text !== 'example') errors.push('OpenAPI summary missing generated valid request example');
      if (messageOperation?.invalidRequestExample === undefined) errors.push('OpenAPI summary missing generated invalid request example');
      if (!messageOperation?.responseSchemas?.some((entry) => entry.statusCode === 201 && entry.schema !== undefined)) {
        errors.push('OpenAPI summary missing response schema');
      }
    }
    if (yamlSummary === undefined) errors.push('missing YAML OpenAPI summary');
    if (jsonSummary === undefined) errors.push('missing JSON OpenAPI summary');
    if (yamlSummary !== undefined && jsonSummary !== undefined && operationSignature(yamlSummary.operations) !== operationSignature(jsonSummary.operations)) {
      errors.push('YAML and JSON OpenAPI summaries are not equivalent');
    }
  } else {
    errors.push('missing OpenAPI summary artifacts');
  }
  if (uiEvidenceArtifact?.path !== undefined) {
    const uiEvidence = JSON.parse(await readFile(uiEvidenceArtifact.path, 'utf8'));
    if (uiEvidence.schemaVersion !== 'brisk-aitesting.playwright-evidence.v1') errors.push('wrong Playwright evidence schema');
    if (uiEvidence.scenario?.id === undefined) errors.push('Playwright evidence missing scenario id');
    if (!Array.isArray(uiEvidence.artifacts) || uiEvidence.artifacts.length === 0) errors.push('Playwright evidence missing artifact list');
    if (uiEvidence.report?.total < 1) errors.push('Playwright evidence missing report summary');
    if (uiEvidence.grounding?.summary?.total < 1) errors.push('Playwright evidence missing grounding summary');
  }
  if (groundingArtifact?.path !== undefined) {
    const grounding = JSON.parse(await readFile(groundingArtifact.path, 'utf8'));
    if (grounding.schemaVersion !== 'brisk-aitesting.ui-grounding.v1') errors.push('wrong UI grounding schema');
    if (grounding.scenario?.id === undefined) errors.push('UI grounding missing scenario id');
    if (!Array.isArray(grounding.elements) || grounding.elements.length === 0) errors.push('UI grounding missing elements');
    if (grounding.summary?.actionable < 1) errors.push('UI grounding missing actionable elements');
    if (!grounding.elements.some((element) => element.role === 'button' && /sign in/i.test(element.text ?? element.label ?? ''))) errors.push('UI grounding missing Sign in button evidence');
    if (!grounding.elements.some((element) => element.kind === 'label' && /email/i.test(element.label ?? ''))) errors.push('UI grounding missing Email label evidence');
  }
  if (actionArtifact?.path !== undefined) {
    const actionEvidence = JSON.parse(await readFile(actionArtifact.path, 'utf8'));
    if (actionEvidence.schemaVersion !== 'brisk-aitesting.ui-actions.v1') errors.push('wrong UI action evidence schema');
    if (!Array.isArray(actionEvidence.actions) || actionEvidence.actions.length !== 3) errors.push('UI action evidence missing executed actions');
    if (!actionEvidence.actions.every((action) => action.status === 'passed')) errors.push('not all grounded UI actions passed');
  } else {
    errors.push('missing executed grounded UI action artifact');
  }
  const uiResults = result.tests.filter((test) => test.type === 'ui');
  if (!uiResults.every((test) => test.assertions.length > 0 && test.assertions.every((assertion) => assertion.status === 'passed'))) {
    errors.push('UI results missing passed report-derived assertions');
  }

  if (errors.length > 0) {
    console.error(JSON.stringify({ status: result.status, summary: result.summary, errors, diagnosis: result.diagnosis }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      status: result.status,
      summary: result.summary,
      resultSchema: result.schemaVersion,
      discoverySchema: result.discovery.schemaVersion,
      handoverSchema: result.handover.schemaVersion,
      discoveredUiRoutes: result.discovery.uiRoutes.length,
      discoveredApiRoutes: result.discovery.apiRoutes.length,
      artifacts: result.artifacts.length,
    }, null, 2));
  }

  const generatedTester = createBriskAiTesting(config);
  const generatedResult = await generatedTester.run({
    goal: 'Generate OpenAPI schema API contract scenarios',
    scenarios: 6,
    mode: 'automatic',
  });
  const generatedErrors = [];
  const generatedScenarios = generatedResult.plan.scenarios.filter((scenario) => scenario.metadata?.generatedBy === 'openapi');
  if (!generatedScenarios.some((scenario) => scenario.metadata?.operationId === 'publishMessage' && scenario.metadata?.polarity === 'positive')) {
    generatedErrors.push('built-in planner missing positive OpenAPI publishMessage scenario');
  }
  if (!generatedScenarios.some((scenario) => scenario.metadata?.operationId === 'publishMessage' && scenario.metadata?.polarity === 'negative')) {
    generatedErrors.push('built-in planner missing negative OpenAPI publishMessage scenario');
  }
  const generatedPublishResults = generatedResult.tests.filter((test) => /POST \/api\/messages/.test(test.name));
  if (generatedPublishResults.length < 2) generatedErrors.push('generated OpenAPI publishMessage scenarios did not execute');
  if (!generatedPublishResults.every((test) => test.status === 'passed')) generatedErrors.push('generated OpenAPI publishMessage scenarios did not pass');
  if (!generatedPublishResults.some((test) => test.assertions.some((assertion) => /response body matches OpenAPI schema/.test(assertion.name) && assertion.status === 'passed'))) {
    generatedErrors.push('generated positive scenario did not validate response schema');
  }
  if (generatedErrors.length > 0) {
    console.error(JSON.stringify({ generatedErrors, status: generatedResult.status, summary: generatedResult.summary, plan: generatedResult.plan }, null, 2));
    process.exitCode = 1;
  }

  const repairEvents = [];
  const repairablePlanner = {
    name: 'repairable-smoke-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'repairable_api_missing_path',
            name: 'Repairable API missing path',
            type: 'api',
            objective: 'This plan should be repaired before execution.',
            target: { method: 'GET' },
            assertions: ['status is 200'],
            evidenceRequired: ['api'],
          },
        ],
      };
    },
    async repair(context) {
      repairEvents.push({
        attempt: context.attempt,
        issues: context.validation.issues.map((issue) => issue.code),
      });
      return {
        ...context.invalidPlan,
        warnings: ['smoke repair applied'],
        scenarios: [
          {
            ...context.invalidPlan.scenarios[0],
            target: { method: 'GET', path: '/api/health', sourceOfTruth: 'contract' },
            expect: { status: 200, json: { ok: true } },
          },
        ],
      };
    },
  };
  const repairableTester = createBriskAiTesting({
    ...config,
    planning: { repairAttempts: 1 },
  }, { planner: repairablePlanner });
  const repairableResult = await repairableTester.run({
    goal: 'Repair invalid API plan before execution',
    scenarios: 1,
    mode: 'automatic',
  });
  const repairErrors = [];
  if (repairEvents.length !== 1) repairErrors.push(`expected one repair event, got ${repairEvents.length}`);
  if (!repairEvents[0]?.issues.includes('REQUIRED_API_PATH')) repairErrors.push('repair did not receive REQUIRED_API_PATH issue');
  if (repairableResult.summary.total !== 1) repairErrors.push(`expected repaired total 1, got ${repairableResult.summary.total}`);
  if (repairableResult.summary.passed !== 1) repairErrors.push(`expected repaired passed 1, got ${repairableResult.summary.passed}`);
  if (repairableResult.plan.warnings[0] !== 'smoke repair applied') repairErrors.push('repaired plan warning was not preserved');
  if (repairErrors.length > 0) {
    console.error(JSON.stringify({ repairErrors, repairEvents, status: repairableResult.status, summary: repairableResult.summary, plan: repairableResult.plan }, null, 2));
    process.exitCode = 1;
  }

  const missingEvidencePlanner = {
    name: 'missing-ui-evidence-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'missing_ui_evidence',
            name: 'Missing UI evidence is rejected',
            type: 'ui',
            objective: 'A grounded action with a missing evidence id must fail without selector guessing.',
            target: { route: '/login', sourceOfTruth: 'observed' },
            assertions: ['missing evidence is rejected'],
            uiActions: [{ action: 'click', evidenceId: 'ui_el_999' }],
            evidenceRequired: ['ui'],
          },
        ],
      };
    },
  };
  const missingEvidenceTester = createBriskAiTesting(config, { planner: missingEvidencePlanner });
  const missingEvidenceResult = await missingEvidenceTester.run({
    goal: 'Reject missing grounded UI evidence',
    scenarios: 1,
    mode: 'automatic',
  });
  if (missingEvidenceResult.status !== 'failed') {
    console.error(JSON.stringify({ missingEvidenceError: 'expected missing evidence run to fail', status: missingEvidenceResult.status, summary: missingEvidenceResult.summary, tests: missingEvidenceResult.tests }, null, 2));
    process.exitCode = 1;
  }
  if (!missingEvidenceResult.tests[0]?.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.ui-grounding.v1')) {
    console.error('Missing evidence failure did not preserve UI grounding artifact.');
    process.exitCode = 1;
  }

  const healingPlanner = {
    name: 'ui-healing-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'healed_ui_action',
            name: 'UI healing replaces stale evidence',
            type: 'ui',
            objective: 'A stale evidence id with clear intent should be healed from fresh page evidence.',
            target: { route: '/login', sourceOfTruth: 'observed' },
            assertions: ['stale evidence is healed with evidence'],
            uiActions: [{ action: 'click', evidenceId: 'ui_el_999', description: 'Sign in' }],
            evidenceRequired: ['ui'],
          },
        ],
      };
    },
  };
  const healingTester = createBriskAiTesting(config, { planner: healingPlanner });
  const healingResult = await healingTester.run({
    goal: 'Heal stale grounded UI evidence',
    scenarios: 1,
    mode: 'automatic',
  });
  const healingArtifact = healingResult.artifacts.find((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.ui-healing.v1' && artifact.path !== undefined);
  const healingErrors = [];
  if (healingResult.summary.passed !== 1) healingErrors.push(`expected healing run to pass, got ${healingResult.status}`);
  if (healingArtifact === undefined) {
    healingErrors.push('healing run missing UI healing evidence artifact');
  } else {
    const healingEvidence = JSON.parse(await readFile(healingArtifact.path, 'utf8'));
    if (!Array.isArray(healingEvidence.events) || healingEvidence.events.length !== 1) healingErrors.push('healing evidence did not record exactly one healing event');
    if (healingEvidence.events?.[0]?.after?.id === undefined) healingErrors.push('healing event missing replacement evidence');
  }
  if (healingErrors.length > 0) {
    console.error(JSON.stringify({ healingErrors, status: healingResult.status, summary: healingResult.summary, tests: healingResult.tests }, null, 2));
    process.exitCode = 1;
  }

  const feedbackEvents = [];
  const feedbackPlanner = {
    name: 'feedback-loop-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'feedback_ui_login',
            name: 'Feedback loop enriches login actions',
            type: 'ui',
            objective: 'Route grounding evidence should drive action selection.',
            target: { route: '/login', sourceOfTruth: 'observed' },
            assertions: ['feedback loop chooses grounded actions'],
            evidenceRequired: ['ui'],
          },
        ],
      };
    },
    async enrichUiActions(context) {
      const email = context.grounding.elements.find((element) => /email/i.test(element.label ?? ''));
      const password = context.grounding.elements.find((element) => /password/i.test(element.label ?? ''));
      const signIn = context.grounding.elements.find((element) => element.role === 'button' && /sign in/i.test(element.text ?? element.label ?? ''));
      feedbackEvents.push({
        elements: context.grounding.summary.total,
        email: email?.id,
        password: password?.id,
        signIn: signIn?.id,
      });
      return [
        ...(email !== undefined ? [{ action: 'fill', evidenceId: email.id, value: 'feedback@example.com' }] : []),
        ...(password !== undefined ? [{ action: 'fill', evidenceId: password.id, value: 'feedback-secret' }] : []),
        ...(signIn !== undefined ? [{ action: 'click', evidenceId: signIn.id }] : []),
      ];
    },
  };
  const feedbackTester = createBriskAiTesting(config, { planner: feedbackPlanner });
  const feedbackResult = await feedbackTester.run({
    goal: 'Use route grounding feedback to choose login actions',
    scenarios: 1,
    mode: 'automatic',
    uiActionFeedback: 'when-missing',
  });
  const feedbackErrors = [];
  if (feedbackResult.summary.passed !== 1) feedbackErrors.push(`expected feedback run to pass, got ${feedbackResult.status}`);
  if (feedbackEvents.length !== 1) feedbackErrors.push(`expected one feedback enrichment event, got ${feedbackEvents.length}`);
  if (feedbackEvents[0]?.email === undefined) feedbackErrors.push('feedback loop did not see email evidence');
  if (feedbackEvents[0]?.password === undefined) feedbackErrors.push('feedback loop did not see password evidence');
  if (feedbackEvents[0]?.signIn === undefined) feedbackErrors.push('feedback loop did not see sign-in evidence');
  if (!feedbackResult.plan.scenarios[0]?.uiActions || feedbackResult.plan.scenarios[0].uiActions.length !== 3) feedbackErrors.push('feedback plan was not enriched with three uiActions');
  if (!feedbackResult.artifacts.some((artifact) => artifact.metadata?.phase === 'pre-execution' && artifact.metadata?.schemaVersion === 'brisk-aitesting.ui-grounding.v1')) feedbackErrors.push('feedback run missing pre-execution grounding artifact');
  if (!feedbackResult.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.ui-actions.v1' && artifact.metadata?.actions === 3)) feedbackErrors.push('feedback run missing executed action evidence');
  if (feedbackErrors.length > 0) {
    console.error(JSON.stringify({ feedbackErrors, feedbackEvents, status: feedbackResult.status, summary: feedbackResult.summary, plan: feedbackResult.plan }, null, 2));
    process.exitCode = 1;
  }

  const invalidPlanner = {
    name: 'invalid-smoke-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'invalid_ui_missing_route',
            name: 'Invalid UI missing route',
            type: 'ui',
            objective: 'This should be rejected before engines run.',
            assertions: ['should never execute'],
            evidenceRequired: ['ui'],
          },
        ],
      };
    },
  };
  const invalidTester = createBriskAiTesting(config, { planner: invalidPlanner });
  const invalidResult = await invalidTester.run({
    goal: 'Invalid plan must fail validation',
    scenarios: 1,
    mode: 'automatic',
  });
  const validationFailed = invalidResult.tests.length === 0
    && invalidResult.outcome.status === 'completed_with_diagnostics'
    && invalidResult.outcome.issues.some((entry) => entry.code === 'PLAN_REJECTED' && entry.message.includes('target.route'));
  if (!validationFailed) {
    console.error('Invalid plan smoke did not fail at validation boundary.');
    process.exitCode = 1;
  }

  const aiTargetPlanner = {
    name: 'ai-target-smoke-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'ai_invented_route',
            name: 'AI invented route is blocked',
            type: 'api',
            objective: 'AI-only executable targets must not reach an engine in strict mode.',
            target: { method: 'POST', path: '/api/invented-resource', sourceOfTruth: 'ai' },
            request: { body: { name: 'invented-<unique>' } },
            expect: { status: 201 },
            assertions: ['AI-only target is rejected'],
            evidenceRequired: ['api'],
          },
        ],
      };
    },
  };
  const aiTargetTester = createBriskAiTesting(config, { planner: aiTargetPlanner });
  const aiTargetResult = await aiTargetTester.run({
    goal: 'Reject AI-only executable targets',
    scenarios: 1,
    mode: 'automatic',
  });
  const aiTargetBlocked = aiTargetResult.tests.length === 0
    && aiTargetResult.outcome.issues.some((entry) => entry.code === 'PLAN_REJECTED' && entry.message.includes('AI-derived targets'));
  if (!aiTargetBlocked) {
    console.error('AI target smoke did not block an AI-derived executable target.');
    process.exitCode = 1;
  }

  const fakeUserTargetPlanner = {
    name: 'fake-user-target-smoke-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'fake_user_target',
            name: 'AI cannot claim user supplied a target',
            type: 'api',
            objective: 'sourceOfTruth user must come from host input, not AI output.',
            target: { method: 'POST', path: '/api/messages', sourceOfTruth: 'user' },
            request: { body: { text: 'hello' } },
            expect: { status: 201 },
            assertions: ['fake user provenance is rejected'],
            evidenceRequired: ['api'],
          },
        ],
      };
    },
  };
  const fakeUserTargetTester = createBriskAiTesting(config, { planner: fakeUserTargetPlanner });
  const fakeUserTargetResult = await fakeUserTargetTester.run({
    goal: 'Reject AI claiming a user target',
    scenarios: 1,
    mode: 'automatic',
  });
  const fakeUserTargetBlocked = fakeUserTargetResult.tests.length === 0
    && fakeUserTargetResult.outcome.issues.some((entry) => entry.code === 'PLAN_REJECTED' && entry.message.includes('sourceOfTruth "user"'));
  if (!fakeUserTargetBlocked) {
    console.error('Fake user target smoke did not reject sourceOfTruth user without host allowlist.');
    process.exitCode = 1;
  }

  const explicitUserTargetTester = createBriskAiTesting(config, { planner: fakeUserTargetPlanner });
  const explicitUserTargetResult = await explicitUserTargetTester.run({
    goal: 'Allow host-supplied user target',
    scenarios: 1,
    mode: 'automatic',
    metadata: { explicitUserTargets: ['POST /api/messages'] },
  });
  if (explicitUserTargetResult.summary.passed !== 1) {
    console.error(JSON.stringify({ explicitUserTargetError: 'host supplied user target did not run', status: explicitUserTargetResult.status, summary: explicitUserTargetResult.summary, tests: explicitUserTargetResult.tests }, null, 2));
    process.exitCode = 1;
  }

  const blockedDependencyPlanner = {
    name: 'blocked-dependency-smoke-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'producer_message',
            name: 'Producer message creation fails validation',
            type: 'api',
            objective: 'This scenario intentionally fails before producing messageId.',
            target: { method: 'POST', path: '/api/messages', sourceOfTruth: 'contract' },
            request: { body: {} },
            expect: { status: 201 },
            capture: [{ name: 'messageId', from: 'response.body', path: 'id' }],
            assertions: ['message is created'],
            evidenceRequired: ['api'],
          },
          {
            id: 'consumer_message',
            name: 'Consumer message scenario is blocked',
            type: 'api',
            objective: 'This scenario must not run when messageId was not proven.',
            dependsOn: ['producer_message'],
            target: { method: 'POST', path: '/api/messages', sourceOfTruth: 'contract' },
            request: { body: { text: 'follow-up-{messageId}' } },
            expect: { status: 201 },
            assertions: ['consumer is blocked when producer fails'],
            evidenceRequired: ['api'],
          },
        ],
      };
    },
  };
  const blockedDependencyTester = createBriskAiTesting(config, { planner: blockedDependencyPlanner });
  const blockedDependencyResult = await blockedDependencyTester.run({
    goal: 'Downstream workflow steps are blocked after producer failure',
    scenarios: 2,
    mode: 'automatic',
  });
  const producer = blockedDependencyResult.tests.find((test) => test.scenarioId === 'producer_message');
  const consumer = blockedDependencyResult.tests.find((test) => test.scenarioId === 'consumer_message');
  const blockedErrors = [];
  if (producer?.status !== 'failed') blockedErrors.push(`expected producer failed, got ${producer?.status}`);
  // A test that never ran is reported as blocked, not failed. Blocked still
  // fails the run verdict, but the counts stay honest: 1 failed, 1 blocked.
  if (consumer?.status !== 'blocked' || consumer?.failureCategory !== 'dependency') blockedErrors.push(`expected consumer blocked by dependency, got ${consumer?.status}/${consumer?.failureCategory}`);
  if (!consumer?.diagnostics.join(' ').includes('producer_message')) blockedErrors.push('blocked diagnostic did not name upstream producer');
  if (blockedDependencyResult.summary.failed !== 1) blockedErrors.push('the producer failure must be counted exactly once as failed');
  if (blockedDependencyResult.summary.blocked !== 1) blockedErrors.push('the blocked consumer must be counted as blocked, not failed or skipped');
  if (blockedDependencyResult.verdict !== 'failed') blockedErrors.push('a run with a blocked test must not carry a passing verdict');
  if (blockedErrors.length > 0) {
    console.error(JSON.stringify({ blockedErrors, status: blockedDependencyResult.status, summary: blockedDependencyResult.summary, tests: blockedDependencyResult.tests }, null, 2));
    process.exitCode = 1;
  }

  const unboundWorkflowPlanner = {
    name: 'unbound-workflow-smoke-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [
          {
            id: 'unbound_workflow_body',
            name: 'Unbound body variable is blocked',
            type: 'api',
            objective: 'Request bodies must not contain workflow variables that were never captured.',
            target: { method: 'POST', path: '/api/messages', sourceOfTruth: 'contract' },
            request: { body: { text: 'child-of-{missingParentId}' } },
            expect: { status: 201 },
            assertions: ['unbound body variable is rejected'],
            evidenceRequired: ['api'],
          },
        ],
      };
    },
  };
  const unboundWorkflowTester = createBriskAiTesting(config, { planner: unboundWorkflowPlanner });
  const unboundWorkflowResult = await unboundWorkflowTester.run({
    goal: 'Reject unbound workflow variables',
    scenarios: 1,
    mode: 'automatic',
  });
  const unboundWorkflowBlocked = unboundWorkflowResult.tests.length === 0
    && unboundWorkflowResult.outcome.issues.some((entry) => entry.code === 'PLAN_REJECTED' && entry.message.includes('Workflow variable "missingParentId"'));
  if (!unboundWorkflowBlocked) {
    console.error('Unbound workflow smoke did not reject a request body variable before execution.');
    process.exitCode = 1;
  }

  let malformedJsonRejected = false;
  try {
    parseAiPlanForTesting(`Here is the plan:
{
  "mode": "automatic",
  "warnings": ["normalized by smoke"],
  "scenarios": [
    {
      "name": "AI planned homepage",
      "type": "browser",
      "objective": "Homepage loads from AI plan",
      "target": { "route": "/" },
      "assertions": ["body is visible"],
      "evidenceRequired": ["ui"],
    }
  ]
}`, {
      config,
      input: { goal: 'Malformed AI JSON should be rejected', scenarios: 1, mode: 'automatic' },
      runId: 'smoke_ai_strict_json',
      discovery: result.discovery,
    });
  } catch {
    malformedJsonRejected = true;
  }
  const normalizedAiPlan = parseAiPlanForTesting(`{
  "mode": "automatic",
  "warnings": ["normalized by smoke"],
  "scenarios": [
    {
      "name": "AI planned homepage",
      "type": "browser",
      "objective": "Homepage loads from AI plan",
      "target": { "route": "/" },
      "assertions": ["body is visible"],
      "evidenceRequired": ["ui"]
    },
    {
      "name": "AI planned health API",
      "type": "backend",
      "objective": "Health API responds from AI plan",
      "target": { "method": "GET", "path": "/api/health" },
      "expect": { "status": 200, "json": { "ok": true } },
      "assertions": ["status is 200"],
      "evidenceRequired": ["api"]
    }
  ]
}`, {
    config,
    input: { goal: 'AI should plan homepage and health API tests', scenarios: 2, mode: 'automatic' },
    runId: 'smoke_ai_normalization',
    discovery: result.discovery,
  });
  const aiErrors = [];
  if (!malformedJsonRejected) aiErrors.push('strict AI parser accepted malformed JSON');
  if (normalizedAiPlan.scenarios.length !== 2) aiErrors.push(`expected AI total 2, got ${normalizedAiPlan.scenarios.length}`);
  if (!normalizedAiPlan.scenarios.some((scenario) => scenario.type === 'ui')) aiErrors.push('AI browser alias was not normalized to ui');
  if (!normalizedAiPlan.scenarios.some((scenario) => scenario.type === 'api')) aiErrors.push('AI backend alias was not normalized to api');

  const aiClaimingUserPlan = parseAiPlanForTesting(`{
  "scenarios": [
    {
      "name": "AI tries to self certify discovered route",
      "type": "api",
      "objective": "AI output must not be able to mark itself as user supplied.",
      "target": { "method": "GET", "path": "/api/health", "sourceOfTruth": "user" },
      "expect": { "status": 200 },
      "assertions": ["user provenance is stripped"],
      "evidenceRequired": ["api"]
    },
    {
      "name": "AI tries to self certify invented route",
      "type": "api",
      "objective": "Invented AI routes must stay AI derived and fail validation in strict mode.",
      "target": { "method": "POST", "path": "/api/not-a-real-route", "sourceOfTruth": "user" },
      "request": { "body": { "name": "bad-<unique>" } },
      "expect": { "status": 201 },
      "assertions": ["invented route is not promoted"],
      "evidenceRequired": ["api"]
    }
  ]
}`, {
    config,
    input: { goal: 'AI cannot claim user supplied targets', scenarios: 2, mode: 'automatic' },
    runId: 'smoke_ai_user_provenance_normalization',
    discovery: result.discovery,
  });
  const discoveredClaim = aiClaimingUserPlan.scenarios.find((scenario) => scenario.name.includes('discovered route'));
  const inventedClaim = aiClaimingUserPlan.scenarios.find((scenario) => scenario.name.includes('invented route'));
  if (discoveredClaim?.target?.sourceOfTruth === 'user') aiErrors.push('AI-declared user provenance survived on discovered route');
  if (inventedClaim?.target?.sourceOfTruth !== 'ai') aiErrors.push(`expected invented AI route to remain ai, got ${inventedClaim?.target?.sourceOfTruth}`);
  if (aiErrors.length > 0) {
    console.error(JSON.stringify({ aiErrors, plan: normalizedAiPlan }, null, 2));
    process.exitCode = 1;
  }

  let configGuardPassed = false;
  try {
    normalizeConfig(defineConfig({
      app: { name: 'bad config', baseUrl: 'http://localhost' },
      ai: {
        provider: 'openai-compatible',
        model: 'fixture-model',
        apiKeyEnv: 'sk-test-secret',
      },
    }));
  } catch (error) {
    configGuardPassed = error instanceof Error && error.message.includes('ai.apiKeyEnv must be an environment variable name');
  }
  if (!configGuardPassed) {
    console.error('Config guard smoke did not reject secret-looking ai.apiKeyEnv.');
    process.exitCode = 1;
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function operationSignature(operations) {
  return operations
    .map((operation) => [
      operation.method,
      operation.path,
      operation.operationId ?? '',
      (operation.statusCodes ?? []).join(','),
      operation.requestBodyRequired === true ? 'body-required' : 'body-optional',
    ].join(' '))
    .sort()
    .join('|');
}
