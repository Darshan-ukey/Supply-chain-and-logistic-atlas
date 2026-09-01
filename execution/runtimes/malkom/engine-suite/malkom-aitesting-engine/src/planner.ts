import { randomUUID } from 'node:crypto';
import { loadOpenApiSummary } from './openapi.js';
import type { OpenApiOperationSummary, Planner, PlannerContext, ScenarioPlan, TestPlan } from './types.js';

const DEFAULT_SCENARIOS: readonly Omit<ScenarioPlan, 'id'>[] = [
  {
    name: 'Application is reachable',
    type: 'ui',
    objective: 'Prove the configured base URL loads for a browser user.',
    target: { route: '/', sourceOfTruth: 'fallback' },
    assertions: ['page responds successfully', 'document is not blank'],
    evidenceRequired: ['ui'],
  },
  {
    name: 'Authenticated user can sign in',
    type: 'ui',
    objective: 'Prove the primary login path works for configured credentials.',
    target: { route: '/login', sourceOfTruth: 'fallback' },
    assertions: ['login form is usable', 'authenticated page is reached'],
    evidenceRequired: ['ui', 'auth'],
  },
  {
    name: 'Protected API rejects anonymous access',
    type: 'api',
    objective: 'Prove protected backend routes do not allow anonymous requests.',
    target: { method: 'GET', path: '/api/me', sourceOfTruth: 'fallback' },
    assertions: ['status is 401 or 403'],
    evidenceRequired: ['api', 'auth'],
  },
  {
    name: 'OpenAPI contract is valid',
    type: 'contract',
    objective: 'Prove the configured API contract can be parsed and used as a testing source.',
    target: { sourceOfTruth: 'fallback' },
    assertions: ['contract file exists', 'contract file is readable'],
    evidenceRequired: ['schema'],
  },
];

export class BuiltinPlanner implements Planner {
  readonly name = 'builtin-planner';

  async plan(context: PlannerContext): Promise<TestPlan> {
    const mode = context.input.mode ?? 'automatic';
    const selected = await expandGoalIntoScenarios(context);

    return {
      schemaVersion: 'brisk-aitesting.plan.v1',
      runId: context.runId,
      goal: context.input.goal,
      mode,
      scenarios: selected.map((scenario) => ({ ...scenario, id: `scenario_${randomUUID()}` })),
      discovery: context.discovery,
      warnings: [],
      createdAt: new Date().toISOString(),
    };
  }
}

function clampScenarioCount(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(50, Math.round(value)));
}

async function expandGoalIntoScenarios(context: PlannerContext): Promise<readonly Omit<ScenarioPlan, 'id'>[]> {
  const goal = context.input.goal;
  const desired = clampScenarioCount(context.input.scenarios ?? 5);
  const mode = context.input.mode ?? 'automatic';
  const lower = goal.toLowerCase();
  const scenarios: Omit<ScenarioPlan, 'id'>[] = [];

  if (/\b(api|backend|route|endpoint)\b/.test(lower)) {
    const healthRoute = context.discovery.apiRoutes.find((route) => route.path === '/api/health') ?? context.discovery.apiRoutes[0];
    scenarios.push({
      name: 'Backend health and API surface respond',
      type: mode === 'automatic' ? 'api' : mode,
      objective: 'Prove backend routes selected by discovery return controlled responses.',
      target: {
        method: healthRoute?.method ?? 'GET',
        path: healthRoute?.path ?? '/api/health',
        sourceOfTruth: healthRoute === undefined ? 'fallback' : provenanceFromDiscoverySource(healthRoute.source),
      },
      assertions: ['status is 2xx, 4xx, or documented but not a network crash'],
      evidenceRequired: ['api'],
    });
  }

  if (/\b(role|permission|rbac|auth|login|user)\b/.test(lower)) {
    const authRoute = context.discovery.apiRoutes.find((route) => /me|user|secure|admin|auth/i.test(route.path));
    scenarios.push({
      name: 'Permission boundary is enforced',
      type: 'api',
      objective: 'Prove unauthorized or under-authorized access is rejected cleanly.',
      target: {
        method: authRoute?.method ?? 'GET',
        path: authRoute?.path ?? '/api/admin',
        sourceOfTruth: authRoute === undefined ? 'fallback' : provenanceFromDiscoverySource(authRoute.source),
      },
      assertions: ['status is 401 or 403', 'response has a stable error shape'],
      evidenceRequired: ['api', 'auth'],
    });
  }

  if (/\b(billing|checkout|payment|subscription)\b/.test(lower)) {
    const revenueRoute = context.discovery.uiRoutes.find((route) => /billing|checkout|payment|subscription/i.test(route.path)) ?? context.discovery.uiRoutes[0];
    scenarios.push({
      name: 'Critical revenue workflow is covered',
      type: 'ui',
      objective: 'Prove the business-critical payment or subscription flow is discoverable and testable.',
      target: {
        route: revenueRoute?.path ?? '/',
        sourceOfTruth: revenueRoute === undefined ? 'fallback' : provenanceFromDiscoverySource(revenueRoute.source),
      },
      assertions: ['entry page loads', 'primary action is visible', 'backend confirmation route is checked when available'],
      evidenceRequired: ['ui', 'api'],
    });
  }

  if (/\b(contract|openapi|schema)\b/.test(lower)) {
    const contract = context.discovery.contracts.find((candidate) => candidate.kind === 'openapi' && candidate.exists);
    const schemaPath = contract?.path ?? context.config.contracts?.openApiPath;
    scenarios.push({
      name: 'API schema rejects malformed input',
      type: 'schema',
      objective: 'Generate schema-based negative tests from OpenAPI or discovered route contracts.',
      target: {
        ...(schemaPath !== undefined ? { schema: schemaPath } : {}),
        sourceOfTruth: contract === undefined && context.config.contracts?.openApiPath === undefined ? 'fallback' : 'contract',
      },
      assertions: ['malformed input receives controlled 4xx response'],
      evidenceRequired: ['schema', 'api'],
    });
  }

  if (/\b(api|backend|route|endpoint|contract|openapi|schema)\b/.test(lower)) {
    scenarios.push(...await openApiScenariosFromContract(context, desired - scenarios.length));
  }

  scenarios.push(...defaultScenariosFromDiscovery(context));

  while (scenarios.length < desired) {
    const next = DEFAULT_SCENARIOS[scenarios.length % DEFAULT_SCENARIOS.length]!;
    scenarios.push({
      ...next,
      name: `${next.name} ${Math.floor(scenarios.length / DEFAULT_SCENARIOS.length) + 1}`,
    });
  }

  return scenarios.slice(0, desired).map((scenario) => ({
    ...scenario,
    type: mode === 'automatic' ? scenario.type : mode,
  }));
}

async function openApiScenariosFromContract(context: PlannerContext, limit: number): Promise<readonly Omit<ScenarioPlan, 'id'>[]> {
  if (limit <= 0 || context.config.contracts?.openApiPath === undefined) return [];
  try {
    const summary = await loadOpenApiSummary(context.config.contracts.openApiPath);
    const scenarios: Omit<ScenarioPlan, 'id'>[] = [];
    for (const operation of [...summary.operations].sort((left, right) => Number(right.requestBodyRequired) - Number(left.requestBodyRequired))) {
      if (scenarios.length >= limit) break;
      const positive = positiveScenarioFromOperation(operation, summary.path);
      if (positive !== undefined) scenarios.push(positive);
      if (scenarios.length >= limit) break;
      const negative = negativeScenarioFromOperation(operation, summary.path);
      if (negative !== undefined) scenarios.push(negative);
    }
    return scenarios;
  } catch {
    return [];
  }
}

function positiveScenarioFromOperation(operation: OpenApiOperationSummary, contractPath: string): Omit<ScenarioPlan, 'id'> | undefined {
  const successStatus = operation.statusCodes.find((status) => status >= 200 && status < 300);
  const method = operation.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method) && operation.requestBodyRequired && operation.requestExample === undefined) return undefined;
  return {
    name: `${method} ${operation.path} matches OpenAPI success contract`,
    type: 'api',
    objective: `Execute ${method} ${operation.path} using the OpenAPI contract as the source of truth.`,
    target: { method, path: operation.path, sourceOfTruth: 'contract' },
    ...(operation.requestExample !== undefined ? { request: { body: operation.requestExample } } : {}),
    expect: { status: successStatus ?? { min: 200, max: 499 } },
    assertions: ['status is documented by OpenAPI', 'response body matches documented schema when available'],
    evidenceRequired: ['api', 'schema'],
    metadata: {
      generatedBy: 'openapi',
      polarity: 'positive',
      contractPath,
      ...(operation.operationId !== undefined ? { operationId: operation.operationId } : {}),
    },
  };
}

function negativeScenarioFromOperation(operation: OpenApiOperationSummary, contractPath: string): Omit<ScenarioPlan, 'id'> | undefined {
  const method = operation.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(method) || operation.invalidRequestExample === undefined) return undefined;
  return {
    name: `${method} ${operation.path} rejects invalid OpenAPI request body`,
    type: 'api',
    objective: `Send an invalid ${method} ${operation.path} request generated from the OpenAPI request schema.`,
    target: { method, path: operation.path, sourceOfTruth: 'contract' },
    request: { body: operation.invalidRequestExample },
    expect: { status: { min: 400, max: 499 } },
    assertions: ['invalid request receives controlled 4xx response'],
    evidenceRequired: ['api', 'schema'],
    metadata: {
      generatedBy: 'openapi',
      polarity: 'negative',
      contractPath,
      ...(operation.operationId !== undefined ? { operationId: operation.operationId } : {}),
    },
  };
}

function defaultScenariosFromDiscovery(context: PlannerContext): Omit<ScenarioPlan, 'id'>[] {
  const firstUiRoute = context.discovery.uiRoutes[0]?.path ?? '/';
  const loginRoute = context.discovery.uiRoutes.find((route) => /login|signin|auth/i.test(route.path))?.path ?? '/login';
  const protectedApi = context.discovery.apiRoutes.find((route) => /me|user|secure|admin|auth/i.test(route.path));
  const contract = context.discovery.contracts.find((entry) => entry.exists);
  return DEFAULT_SCENARIOS.map((scenario) => {
    if (scenario.type === 'ui' && scenario.name === 'Application is reachable') {
      return { ...scenario, target: { route: firstUiRoute, sourceOfTruth: context.discovery.uiRoutes[0] === undefined ? 'fallback' : provenanceFromDiscoverySource(context.discovery.uiRoutes[0].source) } };
    }
    if (scenario.type === 'ui' && scenario.name === 'Authenticated user can sign in') {
      const loginRouteEvidence = context.discovery.uiRoutes.find((route) => route.path === loginRoute);
      return { ...scenario, target: { route: loginRoute, sourceOfTruth: loginRouteEvidence === undefined ? 'fallback' : provenanceFromDiscoverySource(loginRouteEvidence.source) } };
    }
    if (scenario.type === 'api' && protectedApi !== undefined) {
      return {
        ...scenario,
        target: { method: protectedApi.method, path: protectedApi.path, sourceOfTruth: provenanceFromDiscoverySource(protectedApi.source) },
        expect: { status: { min: 200, max: 499 } },
      };
    }
    if (scenario.type === 'contract' && contract !== undefined) {
      return { ...scenario, target: { schema: contract.path, sourceOfTruth: 'contract' } };
    }
    return scenario;
  });
}

function provenanceFromDiscoverySource(source: 'config' | 'repo' | 'runtime' | 'contract'): NonNullable<NonNullable<ScenarioPlan['target']>['sourceOfTruth']> {
  if (source === 'contract') return 'contract';
  return 'observed';
}
