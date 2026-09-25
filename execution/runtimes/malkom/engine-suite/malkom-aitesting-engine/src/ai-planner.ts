import { randomUUID } from 'node:crypto';
import { BuiltinPlanner } from './planner.js';
import type {
  AiPlannerProvider,
  DiscoveryResult,
  EngineType,
  Planner,
  PlannerContext,
  PlannerRepairContext,
  ScenarioPlan,
  TestPlan,
  UiActionBatchEnrichmentContext,
  UiActionBatchEnrichmentResult,
  UiActionEnrichmentContext,
  UiActionPlan,
} from './types.js';

type ExpectedStatus = NonNullable<ScenarioPlan['expect']>['status'];

export const aiPlanOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['scenarios'],
  properties: {
    mode: { enum: ['automatic', 'ui', 'api', 'contract', 'schema', 'replay', 'message', 'custom'] },
    warnings: { type: 'array', items: { type: 'string' } },
    scenarios: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name', 'type', 'objective', 'target', 'assertions', 'evidenceRequired'],
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          name: { type: 'string', minLength: 1 },
          type: { enum: ['ui', 'api', 'contract', 'schema', 'replay', 'message', 'custom'] },
          objective: { type: 'string', minLength: 1 },
          target: { type: 'object' },
          request: { type: 'object' },
          expect: { type: 'object' },
          assertions: { type: 'array', minItems: 1, items: { type: 'string' } },
          dependsOn: { type: 'array', items: { type: 'string' } },
          capture: { type: 'array', items: { type: 'object' } },
          cleanup: { type: 'array', items: { type: 'object' } },
          uiActions: { type: 'array', items: { type: 'object' } },
          evidenceRequired: { type: 'array', items: { enum: ['repo', 'ui', 'api', 'schema', 'auth', 'message'] } },
          metadata: { type: 'object' },
        },
      },
    },
  },
} as const;

export class AiPlanner implements Planner {
  readonly name = 'ai-planner';
  private readonly fallback = new BuiltinPlanner();

  constructor(private readonly provider: AiPlannerProvider) {}

  async plan(context: PlannerContext): Promise<TestPlan> {
    const response = await this.provider.complete({
      jsonSchemaName: 'brisk-aitesting.plan.v1',
      jsonSchema: aiPlanOutputJsonSchema,
      structuredOutput: 'json-schema',
      purpose: 'plan',
      maxOutputTokensHint: planOutputTokensHint(context.input.scenarios ?? 5),
      system: buildSystemPrompt(),
      user: buildUserPrompt(context),
    });
    const parsed = parseAiPlan(response.content, context.config.security.strictMode !== false);
    return this.buildPlan(parsed, context);
  }

  async repair(context: PlannerRepairContext): Promise<TestPlan> {
    const response = await this.provider.complete({
      jsonSchemaName: 'brisk-aitesting.plan.v1',
      jsonSchema: aiPlanOutputJsonSchema,
      structuredOutput: 'json-schema',
      purpose: 'plan-repair',
      maxOutputTokensHint: planOutputTokensHint(context.input.scenarios ?? 5),
      system: buildRepairSystemPrompt(),
      user: buildRepairUserPrompt(context),
    });
    const parsed = parseAiPlan(response.content, context.config.security.strictMode !== false);
    return this.buildPlan(parsed, context);
  }

  async enrichUiActions(context: UiActionEnrichmentContext): Promise<readonly UiActionPlan[]> {
    const response = await this.provider.complete({
      jsonSchemaName: 'brisk-aitesting.plan.v1',
      structuredOutput: 'json',
      purpose: 'ui-actions',
      // A short action list for one page, never a whole plan.
      maxOutputTokensHint: 1_500,
      system: buildUiActionEnrichmentSystemPrompt(),
      user: buildUiActionEnrichmentUserPrompt(context),
    });
    return parseAiUiActions(response.content);
  }

  /** All grounded screens in one answer: one round-trip instead of one per screen. */
  async enrichUiActionsForScenarios(context: UiActionBatchEnrichmentContext): Promise<readonly UiActionBatchEnrichmentResult[]> {
    if (context.items.length === 0) return [];
    const response = await this.provider.complete({
      jsonSchemaName: 'brisk-aitesting.plan.v1',
      structuredOutput: 'json',
      purpose: 'ui-actions',
      maxOutputTokensHint: Math.max(1_500, 1_200 * context.items.length),
      system: [
        buildUiActionEnrichmentSystemPrompt(),
        'Several screens are provided. Answer for every one of them:',
        'return { "scenarios": [{ "scenarioId": <id exactly as given>, "uiActions": [...] }] } with one entry per screen, and no other screens.',
      ].join('\n'),
      user: JSON.stringify({
        goal: context.input.goal,
        screens: context.items.map((item) => JSON.parse(buildUiActionEnrichmentUserPrompt({
          ...context,
          scenario: item.scenario,
          grounding: item.grounding,
        })) as unknown),
        outputShape: {
          scenarios: [
            { scenarioId: 'scenario-id-exactly-as-given', uiActions: [{ action: 'click', evidenceId: 'ui_el_003' }] },
          ],
        },
      }, null, 2),
    });
    return parseAiUiActionBatch(response.content, context.items.map((item) => item.scenario.id));
  }

  private async buildPlan(parsed: ReturnType<typeof parseAiPlan>, context: PlannerContext): Promise<TestPlan> {
    const plan = buildNormalizedPlan(parsed, context);
    if (plan !== undefined) return plan;
    return this.fallback.plan(context);
  }

}

/** Output budget for a full plan answer: sized by how many scenarios are asked for. */
function planOutputTokensHint(scenarioCount: number): number {
  return Math.max(2_500, 2_000 * Math.max(1, scenarioCount) + 1_000);
}

function buildSystemPrompt(): string {
  return [
    'You are the planner for brisk-aitesting.',
    'Return only JSON. Do not return markdown or TypeScript.',
    'Plan high-level test scenarios. Do not generate executable test code.',
    'For UI interactions, output uiActions with action intent and evidenceId only. Do not output CSS selectors or Playwright code.',
    'Each scenario must choose one type: ui, api, contract, schema, replay, or custom.',
    'UI scenarios need target.route. API scenarios need target.method and target.path.',
    'Each target must include sourceOfTruth: observed, contract, or ai.',
    'Never output sourceOfTruth: user. User provenance is reserved for exact targets supplied by the host app outside AI output.',
    'Use observed only for routes listed in discovery. Use contract only for contract-backed routes. Use ai for inferred targets that still need validation or repair.',
    'For multi-step API workflows, every later {name} or <name> reference must be produced by an earlier explicit capture with the same name.',
    'Use built-in placeholders unique, uuid, timestamp, or now for generated values. Example: "resource-<unique>".',
    'Use cleanup for API scenarios that create durable data.',
    'Prefer discovered routes and APIs. Do not invent targets when discovery provides options.',
  ].join('\n');
}

function buildRepairSystemPrompt(): string {
  return [
    'You are the repair planner for brisk-aitesting.',
    'Return only JSON. Do not return markdown, TypeScript, prose, or comments.',
    'Repair the supplied test plan so it satisfies every validation issue.',
    'Keep valid scenarios when possible. Change only fields needed to make the plan executable.',
    'Each scenario must choose one type: ui, api, contract, schema, replay, or custom.',
    'UI scenarios need target.route beginning with /. API scenarios need target.method and target.path beginning with /.',
    'Each target must include sourceOfTruth: observed, contract, or ai. Never use fallback in repaired AI output.',
    'Never output sourceOfTruth: user. User provenance is reserved for exact targets supplied by the host app outside AI output.',
    'Use observed only for routes listed in discovery. Use contract only for contract-backed routes. Use ai only when validation explicitly allows AI-derived targets.',
    'Successful POST/PUT/PATCH scenarios need a request body.',
    'For multi-step API workflows, every later {name} or <name> reference must be produced by an earlier explicit capture with the same name.',
    'Use built-in placeholders unique, uuid, timestamp, or now for generated values. Example: "resource-<unique>".',
    'Use cleanup for API scenarios that create durable data.',
    'UI actions must use evidenceId values like ui_el_001. Do not invent selectors.',
    'Prefer discovered routes and APIs. Do not invent targets when discovery provides options.',
  ].join('\n');
}

function buildUiActionEnrichmentSystemPrompt(): string {
  return [
    'You are the UI action enrichment planner for brisk-aitesting.',
    'Return only JSON. Do not return markdown, TypeScript, Playwright code, CSS selectors, XPath, or prose.',
    'Choose UI actions only from the provided grounding evidence IDs.',
    'Every action must include evidenceId exactly as provided, for example ui_el_003.',
    'Supported actions: fill, click, check, select, press, assertText.',
    'Do not create actions when the evidence does not support the requested workflow.',
  ].join('\n');
}

function buildUserPrompt(context: PlannerContext): string {
  return JSON.stringify({
    goal: context.input.goal,
    scenarios: context.input.scenarios ?? 5,
    scenarioCountPolicy: context.input.scenarioCountPolicy ?? 'flexible',
    mode: context.input.mode ?? 'automatic',
    requiredTypes: context.input.requiredTypes ?? [],
    app: context.config.app,
    discovery: summarizeDiscovery(context.discovery),
    planningRules: {
      scenarioCount: context.input.scenarioCountPolicy === 'exact' && context.input.scenarios !== undefined
        ? `Return exactly ${context.input.scenarios} scenarios. Do not return fewer or more.`
        : 'Use the requested scenario count as guidance unless the host policy says exact.',
    },
    outputShape: {
      mode: 'automatic',
      warnings: [],
      scenarios: [
        {
          name: 'Scenario name',
          type: 'ui',
          objective: 'What this proves',
          target: { route: '/', sourceOfTruth: 'observed' },
          request: {},
          expect: {},
          assertions: ['human readable assertion'],
          capture: [{ name: 'resourceId', from: 'response.body', path: 'id' }],
          dependsOn: [],
          cleanup: [{ type: 'api', target: { method: 'DELETE', path: '/api/resources/<resourceId>' }, expect: { status: { min: 200, max: 204 } } }],
          uiActions: [
            { action: 'fill', evidenceId: 'ui_el_001', value: 'user@example.com' },
            { action: 'click', evidenceId: 'ui_el_003' },
          ],
          evidenceRequired: ['ui'],
        },
      ],
    },
  }, null, 2);
}

function buildRepairUserPrompt(context: PlannerRepairContext): string {
  return JSON.stringify({
    goal: context.input.goal,
    attempt: context.attempt,
    maxAttempts: context.maxAttempts,
    mode: context.input.mode ?? 'automatic',
    scenarios: context.input.scenarios ?? 5,
    scenarioCountPolicy: context.input.scenarioCountPolicy ?? 'flexible',
    requiredTypes: context.input.requiredTypes ?? [],
    app: context.config.app,
    discovery: summarizeDiscovery(context.discovery),
    validationIssues: context.validation.issues.map((issue) => ({
      severity: issue.severity,
      path: issue.path,
      code: issue.code,
      message: issue.message,
    })),
    invalidPlan: sanitizePlanForRepair(context.invalidPlan),
    planningRules: {
      scenarioCount: context.input.scenarioCountPolicy === 'exact' && context.input.scenarios !== undefined
        ? `Repair must return exactly ${context.input.scenarios} scenarios. If the invalid plan has too many, keep the strongest proven scenarios. If it has too few, add proven scenarios from discovery or contract evidence.`
        : 'Use the requested scenario count as guidance unless the host policy says exact.',
    },
    outputShape: {
      mode: context.input.mode ?? 'automatic',
      warnings: ['fixed validation issues'],
      scenarios: [
        {
          name: 'Scenario name',
          type: 'api',
          objective: 'What this proves',
          target: { method: 'GET', path: '/api/health', sourceOfTruth: 'observed' },
          request: {},
          expect: { status: 200 },
          assertions: ['human readable assertion'],
          uiActions: [],
          evidenceRequired: ['api'],
        },
      ],
    },
  }, null, 2);
}

function buildUiActionEnrichmentUserPrompt(context: UiActionEnrichmentContext): string {
  return JSON.stringify({
    goal: context.input.goal,
    scenario: {
      id: context.scenario.id,
      name: context.scenario.name,
      objective: context.scenario.objective,
      target: context.scenario.target,
      existingUiActions: context.scenario.uiActions ?? [],
    },
    grounding: {
      route: context.grounding.route,
      url: context.grounding.url,
      title: context.grounding.title,
      summary: context.grounding.summary,
      elements: context.grounding.elements.slice(0, 100).map((element) => ({
        id: element.id,
        kind: element.kind,
        role: element.role,
        label: element.label,
        text: element.text,
        testId: element.testId,
        tagName: element.tagName,
        inputType: element.inputType,
        locator: element.locator,
        confidence: element.confidence,
      })),
    },
    outputShape: {
      uiActions: [
        { action: 'fill', evidenceId: 'ui_el_001', value: 'value to type' },
        { action: 'click', evidenceId: 'ui_el_003' },
      ],
    },
  }, null, 2);
}

function sanitizePlanForRepair(plan: TestPlan): unknown {
  return {
    mode: plan.mode,
    warnings: plan.warnings,
    scenarios: plan.scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      type: scenario.type,
      objective: scenario.objective,
      target: scenario.target,
      request: scenario.request,
      expect: scenario.expect,
      assertions: scenario.assertions,
      uiActions: scenario.uiActions,
      evidenceRequired: scenario.evidenceRequired,
      metadata: scenario.metadata,
    })),
  };
}

function ensureRequiredTypes(scenarios: readonly ScenarioPlan[], context: PlannerContext): readonly ScenarioPlan[] {
  const required = context.input.requiredTypes ?? [];
  if (required.length === 0) return scenarios;
  const desired = context.input.scenarios ?? Math.max(scenarios.length, required.length);
  const result = [...scenarios];
  for (const type of required) {
    if (result.some((scenario) => scenario.type === type)) continue;
    const replacement = scenarioForType(type, context);
    const replaceIndex = result.findIndex((scenario, index) => !required.includes(scenario.type) || result.findIndex((other) => other.type === scenario.type) !== index);
    if (replaceIndex >= 0 && result.length >= desired) {
      result[replaceIndex] = replacement;
    } else {
      result.push(replacement);
    }
  }
  return result.slice(0, Math.max(desired, required.length));
}

function scenarioForType(type: EngineType, context: PlannerContext): ScenarioPlan {
  if (type === 'api') {
    const apiRoute = context.discovery.apiRoutes.find((route) => route.path === '/api/health') ?? context.discovery.apiRoutes[0];
    return {
      id: `required_api_${randomUUID()}`,
      name: 'Required API coverage',
      type: 'api',
      objective: 'Ensure required API coverage is present in the plan.',
      target: {
        method: apiRoute?.method ?? 'GET',
        path: apiRoute?.path ?? '/api/health',
        sourceOfTruth: apiRoute === undefined ? 'fallback' : provenanceForApiRoute(apiRoute.method, apiRoute.path, context.discovery) ?? 'observed',
      },
      expect: { status: { min: 200, max: 499 } },
      assertions: ['API responds with a controlled status'],
      evidenceRequired: ['api'],
    };
  }
  if (type === 'ui') {
    return {
      id: `required_ui_${randomUUID()}`,
      name: 'Required UI coverage',
      type: 'ui',
      objective: 'Ensure required UI coverage is present in the plan.',
      target: {
        route: context.discovery.uiRoutes[0]?.path ?? '/',
        sourceOfTruth: context.discovery.uiRoutes[0] === undefined ? 'fallback' : provenanceForUiRoute(context.discovery.uiRoutes[0].path, context.discovery) ?? 'observed',
      },
      assertions: ['page body is visible'],
      evidenceRequired: ['ui'],
    };
  }
  if (type === 'message') {
    const schema = context.discovery.contracts.find((contract) => contract.kind === 'asyncapi' && contract.exists)?.path;
    return {
      id: `required_message_${randomUUID()}`,
      name: 'Required message coverage',
      type: 'message',
      objective: 'Ensure required message/event contract coverage is present in the plan.',
      target: { ...(schema !== undefined ? { schema } : {}), channel: 'default', sourceOfTruth: schema === undefined ? 'fallback' : 'contract' },
      assertions: ['message contract can be inspected'],
      evidenceRequired: ['message', 'schema'],
    };
  }
  return {
    id: `required_${type}_${randomUUID()}`,
    name: `Required ${type} coverage`,
    type,
    objective: `Ensure required ${type} coverage is present in the plan.`,
    ...(type === 'schema' || type === 'contract' ? { target: { sourceOfTruth: 'fallback' as const } } : {}),
    assertions: [`${type} coverage exists`],
    evidenceRequired: type === 'schema' || type === 'contract' ? ['schema'] : ['repo'],
  };
}

function summarizeDiscovery(discovery: DiscoveryResult): unknown {
  return {
    uiRoutes: discovery.uiRoutes.slice(0, 30),
    apiRoutes: discovery.apiRoutes.slice(0, 50),
    contracts: discovery.contracts,
    ...(discovery.contractDrift !== undefined
      ? {
          contractDrift: {
            implementedButUndocumented: discovery.contractDrift.implementedButUndocumented.slice(0, 20),
            documentedButNotImplemented: discovery.contractDrift.documentedButNotImplemented.slice(0, 20),
            diagnostics: discovery.contractDrift.diagnostics,
          },
        }
      : {}),
    repoSignals: discovery.repoSignals.slice(0, 50),
  };
}

function parseAiPlan(content: string, strictJson = true): {
  readonly mode?: 'automatic' | EngineType;
  readonly warnings?: unknown;
  readonly scenarios?: unknown;
} {
  const json = extractJsonObject(content, isPlanLikeObject, strictJson);
  const parsed = unwrapPlanObject(JSON.parse(strictJson ? json : repairJson(json)) as unknown);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI planner returned JSON that is not an object.');
  }
  return parsed as {
    readonly mode?: 'automatic' | EngineType;
    readonly warnings?: unknown;
    readonly scenarios?: unknown;
  };
}

function parseAiUiActions(content: string): readonly UiActionPlan[] {
  const json = extractJsonObject(content, undefined, true);
  const parsed = JSON.parse(json) as unknown;
  const source = isRecord(parsed) ? parsed.uiActions ?? parsed.actions ?? parsed.steps : undefined;
  return normalizeUiActions(source) ?? [];
}

/** Strict: exactly one entry per requested screen, no invented screens. */
function parseAiUiActionBatch(content: string, expectedScenarioIds: readonly string[]): readonly UiActionBatchEnrichmentResult[] {
  const json = extractJsonObject(content, undefined, true);
  const parsed = JSON.parse(json) as unknown;
  const entries = isRecord(parsed) && Array.isArray(parsed.scenarios) ? parsed.scenarios : undefined;
  if (entries === undefined) throw new Error('UI action batch answer must contain a scenarios array.');
  const expected = new Set(expectedScenarioIds);
  const results = new Map<string, readonly UiActionPlan[]>();
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.scenarioId !== 'string') throw new Error('Every UI action batch entry needs a scenarioId.');
    if (!expected.has(entry.scenarioId)) throw new Error(`UI action batch answered for unknown scenario "${entry.scenarioId}".`);
    if (results.has(entry.scenarioId)) throw new Error(`UI action batch answered scenario "${entry.scenarioId}" more than once.`);
    results.set(entry.scenarioId, normalizeUiActions(entry.uiActions ?? entry.actions ?? entry.steps) ?? []);
  }
  const missing = expectedScenarioIds.filter((id) => !results.has(id));
  if (missing.length > 0) throw new Error(`UI action batch omitted scenario(s): ${missing.join(', ')}.`);
  return expectedScenarioIds.map((scenarioId) => ({ scenarioId, actions: results.get(scenarioId) ?? [] }));
}

function unwrapPlanObject(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (isRecord(value.testPlan)) return value.testPlan;
  if (isRecord(value.plan)) return value.plan;
  return value;
}

export function parseAiPlanForTesting(content: string, context: PlannerContext): TestPlan {
  const parsed = parseAiPlan(content, context.config.security.strictMode !== false);
  const plan = buildNormalizedPlan(parsed, context);
  if (plan === undefined) throw new Error('AI planner returned no scenarios after normalization.');
  return plan;
}

function buildNormalizedPlan(parsed: ReturnType<typeof parseAiPlan>, context: PlannerContext): TestPlan | undefined {
  const scenarios = ensureRequiredTypes(normalizeAiScenarios(normalizeScenarioCollection(parsed), context), context);
  if (scenarios.length === 0) return undefined;
  return {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId: context.runId,
    goal: context.input.goal,
    mode: context.input.mode ?? parsed.mode ?? 'automatic',
    scenarios,
    discovery: context.discovery,
    warnings: normalizeStringArray(parsed.warnings),
    createdAt: new Date().toISOString(),
  };
}

function normalizeScenarioCollection(parsed: ReturnType<typeof parseAiPlan>): unknown {
  if (Array.isArray(parsed.scenarios)) return parsed.scenarios;
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.tests)) return record.tests;
  if (Array.isArray(record.testCases)) return record.testCases;
  return parsed.scenarios;
}

function repairJson(value: string): string {
  return value
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)(\s*:)/g, '$1"$2"$3');
}

function extractJsonObject(content: string, accepts: ((value: unknown) => boolean) | undefined = () => true, strictJson = true): string {
  const trimmed = content.trim();
  const candidates = jsonCandidates(trimmed);
  for (const candidate of candidates.sort((left, right) => right.length - left.length)) {
    try {
      const parsed = JSON.parse(strictJson ? candidate : repairJson(candidate)) as unknown;
      if ((accepts ?? (() => true))(parsed)) return candidate;
    } catch {
      // Try the next balanced JSON-looking candidate.
    }
  }
  if (candidates.length > 0) return candidates[0]!;
  throw new Error('AI planner did not return a JSON object.');
}

function isPlanLikeObject(value: unknown): boolean {
  const unwrapped = unwrapPlanObject(value);
  return isRecord(unwrapped)
    && (Array.isArray(unwrapped.scenarios) || Array.isArray(unwrapped.tests) || Array.isArray(unwrapped.testCases));
}

function jsonCandidates(content: string): string[] {
  const candidates: string[] = [];
  for (const match of content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const fenced = match[1]?.trim();
    if (fenced?.startsWith('{') === true) candidates.push(fenced);
  }
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== '{') continue;
    const end = findBalancedJsonEnd(content, index);
    if (end > index) candidates.push(content.slice(index, end + 1));
  }
  if (content.startsWith('{') && content.endsWith('}')) candidates.push(content);
  return [...new Set(candidates)];
}

function findBalancedJsonEnd(content: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') inString = true;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function normalizeAiScenarios(value: unknown, context: PlannerContext): readonly ScenarioPlan[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => normalizeScenario(entry, index, context));
}

function normalizeScenario(value: unknown, index: number, context: PlannerContext): ScenarioPlan {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const type = normalizeEngineType(record.type ?? record.category ?? record.testType, record.target);
  const target = normalizeTarget(record.target, type, context.discovery);
  const request = normalizeRequest(record.request);
  const expect = normalizeExpect(record.expect ?? record.expected);
  const capture = normalizeCapture(record.capture ?? record.captures);
  const dependsOn = normalizeStringArray(record.dependsOn);
  const cleanup = normalizeCleanup(record.cleanup ?? record.teardown);
  const uiActions = type === 'ui' ? normalizeUiActions(record.uiActions ?? record.actions ?? record.steps) : undefined;
  const metadata = isRecord(record.metadata) ? record.metadata : undefined;
  return {
    id: normalizeIdentifier(record.id, `ai_scenario_${index + 1}`),
    name: normalizeString(record.name, `AI scenario ${index + 1}`),
    type,
    objective: normalizeString(record.objective, `Validate ${type} behavior for ${context.input.goal}`),
    ...(target !== undefined ? { target } : {}),
    ...(request !== undefined ? { request } : {}),
    ...(expect !== undefined ? { expect } : {}),
    assertions: normalizeStringArray(record.assertions, ['scenario completes successfully']),
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
    ...(capture !== undefined ? { capture } : {}),
    ...(cleanup !== undefined ? { cleanup } : {}),
    ...(uiActions !== undefined ? { uiActions } : {}),
    evidenceRequired: normalizeEvidenceRequired(record.evidenceRequired, type),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

function normalizeIdentifier(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(value)) return value;
  return `${fallback}_${randomUUID()}`;
}

function normalizeEngineType(value: unknown, target?: unknown): EngineType {
  const inferred = inferEngineTypeFromTarget(target);
  if (typeof value !== 'string') return inferred ?? 'custom';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'custom') return inferred ?? 'custom';
  if (['ui', 'api', 'contract', 'schema', 'replay', 'message'].includes(normalized)) return normalized as EngineType;
  if (['e2e', 'browser', 'frontend'].includes(normalized)) return 'ui';
  if (['integration', 'workflow', 'end-to-end'].includes(normalized)) return 'ui';
  if (['backend', 'http', 'rest'].includes(normalized)) return 'api';
  if (normalized === 'asyncapi' || normalized === 'event' || normalized === 'messaging' || normalized === 'message') return 'message';
  if (normalized === 'openapi') return 'schema';
  return inferred ?? 'custom';
}

function inferEngineTypeFromTarget(target: unknown): EngineType | undefined {
  if (!isRecord(target)) return undefined;
  const method = typeof target.method === 'string' ? target.method.trim() : '';
  const pathLike = typeof target.path === 'string'
    ? target.path
    : typeof target.route === 'string'
      ? target.route
      : typeof target.url === 'string'
        ? target.url
        : '';
  const path = normalizePath(pathLike);
  if (method.length > 0 || path?.startsWith('/api/') === true || path === '/api') return 'api';
  if (path !== undefined && path.startsWith('/')) return 'ui';
  if (typeof target.schema === 'string') return 'schema';
  return undefined;
}

function normalizeTarget(value: unknown, type: EngineType, discovery: DiscoveryResult): ScenarioPlan['target'] {
  const record = isRecord(value) ? value : {};
  const explicitSource = normalizeAiDeclaredSourceOfTruth(record.sourceOfTruth ?? record.provenance);
  if (type === 'ui') {
    const direct = normalizePath(record.route ?? record.path ?? record.url);
    if (direct !== undefined) return { route: direct, sourceOfTruth: explicitSource ?? provenanceForUiRoute(direct, discovery) ?? 'ai' };
    const fallback = discovery.uiRoutes[0]?.path ?? '/';
    return { route: fallback, sourceOfTruth: 'fallback' };
  }
  if (type === 'api') {
    const discovered = discovery.apiRoutes[0];
    const directPath = normalizePath(record.path ?? record.route ?? record.url);
    const method = normalizeMethod(record.method);
    if (directPath !== undefined || method !== undefined) {
      const path = directPath ?? discovered?.path ?? '/';
      const finalMethod = method ?? discovered?.method ?? 'GET';
      return { method: finalMethod, path, sourceOfTruth: explicitSource ?? provenanceForApiRoute(finalMethod, path, discovery) ?? 'ai' };
    }
    return { method: discovered?.method ?? 'GET', path: discovered?.path ?? '/', sourceOfTruth: 'fallback' };
  }
  if (type === 'contract' || type === 'schema') {
    const schema = typeof record.schema === 'string' ? record.schema : discovery.contracts.find((contract) => contract.exists)?.path;
    return schema !== undefined ? { schema, sourceOfTruth: explicitSource ?? provenanceForContract(schema, discovery) ?? 'ai' } : {};
  }
  if (type === 'message') {
    const schema = typeof record.schema === 'string' ? record.schema : discovery.contracts.find((contract) => contract.kind === 'asyncapi' && contract.exists)?.path;
    const channel = typeof record.channel === 'string' ? record.channel : typeof record.path === 'string' ? record.path : undefined;
    return {
      ...(schema !== undefined ? { schema } : {}),
      ...(channel !== undefined ? { channel } : {}),
      sourceOfTruth: explicitSource ?? (schema !== undefined ? provenanceForContract(schema, discovery) ?? 'ai' : 'ai'),
    };
  }
  return isRecord(value) ? value as ScenarioPlan['target'] : {};
}

function normalizeUiActions(value: unknown): readonly UiActionPlan[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const actions = value
    .map(normalizeUiAction)
    .filter((action): action is UiActionPlan => action !== undefined);
  return actions.length > 0 ? actions : undefined;
}

function normalizeUiAction(value: unknown): UiActionPlan | undefined {
  if (!isRecord(value)) return undefined;
  const rawAction = typeof value.action === 'string' ? value.action : typeof value.type === 'string' ? value.type : undefined;
  const action = normalizeUiActionName(rawAction);
  const evidenceId = typeof value.evidenceId === 'string' ? value.evidenceId.trim() : typeof value.elementId === 'string' ? value.elementId.trim() : undefined;
  const description = typeof value.description === 'string' && value.description.trim().length > 0 ? value.description.trim() : undefined;
  if (action === undefined || evidenceId === undefined || !/^ui_el_\d{3,}$/.test(evidenceId)) return undefined;
  if (action === 'click' || action === 'check') return { action, evidenceId, ...(description !== undefined ? { description } : {}) };
  if (action === 'fill') {
    const fillValue = typeof value.value === 'string' ? value.value : typeof value.text === 'string' ? value.text : undefined;
    return fillValue !== undefined ? { action, evidenceId, value: fillValue, ...(description !== undefined ? { description } : {}) } : undefined;
  }
  if (action === 'select') {
    const selectValue = typeof value.value === 'string' ? value.value : undefined;
    return selectValue !== undefined ? { action, evidenceId, value: selectValue, ...(description !== undefined ? { description } : {}) } : undefined;
  }
  if (action === 'press') {
    const key = typeof value.key === 'string' ? value.key : undefined;
    return key !== undefined ? { action, evidenceId, key, ...(description !== undefined ? { description } : {}) } : undefined;
  }
  if (action === 'assertText') {
    const text = typeof value.text === 'string' ? value.text : typeof value.value === 'string' ? value.value : undefined;
    return text !== undefined ? { action, evidenceId, text, ...(description !== undefined ? { description } : {}) } : undefined;
  }
  return undefined;
}

function normalizeUiActionName(value: unknown): UiActionPlan['action'] | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'fill' || normalized === 'type' || normalized === 'input') return 'fill';
  if (normalized === 'click' || normalized === 'tap') return 'click';
  if (normalized === 'select' || normalized === 'choose') return 'select';
  if (normalized === 'check') return 'check';
  if (normalized === 'press' || normalized === 'keypress') return 'press';
  if (normalized === 'asserttext' || normalized === 'assert-text' || normalized === 'expecttext') return 'assertText';
  return undefined;
}

function normalizeRequest(value: unknown): ScenarioPlan['request'] | undefined {
  if (!isRecord(value)) return undefined;
  const headers = isStringRecord(value.headers) ? value.headers : undefined;
  const query = isQueryRecord(value.query) ? value.query : undefined;
  return {
    ...(headers !== undefined ? { headers } : {}),
    ...(query !== undefined ? { query } : {}),
    ...(value.body !== undefined ? { body: value.body } : {}),
  };
}

function normalizeCapture(value: unknown): ScenarioPlan['capture'] | undefined {
  if (!Array.isArray(value)) return undefined;
  const captures = value
    .map((entry) => {
      if (!isRecord(entry)) return undefined;
      const name = typeof entry.name === 'string' ? entry.name.trim() : typeof entry.as === 'string' ? entry.as.trim() : undefined;
      const from = entry.from === 'response.header' ? 'response.header' : entry.from === 'response.body' || entry.from === undefined ? 'response.body' : undefined;
      const path = typeof entry.path === 'string' ? entry.path.trim() : undefined;
      if (name === undefined || from === undefined || path === undefined || name.length === 0 || path.length === 0) return undefined;
      return { name, from, path };
    })
    .filter((entry): entry is NonNullable<ScenarioPlan['capture']>[number] => entry !== undefined);
  return captures.length > 0 ? captures : undefined;
}

function normalizeCleanup(value: unknown): ScenarioPlan['cleanup'] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleanup = value
    .map((entry) => {
      if (!isRecord(entry)) return undefined;
      const target = isRecord(entry.target) ? entry.target : {};
      const method = normalizeMethod(target.method) ?? normalizeMethod(entry.method);
      const path = normalizePath(target.path ?? entry.path);
      if ((method !== 'DELETE' && method !== 'POST') || path === undefined) return undefined;
      return {
        type: 'api' as const,
        target: { method, path },
        ...(normalizeRequest(entry.request) !== undefined ? { request: normalizeRequest(entry.request) } : {}),
        ...(normalizeExpect(entry.expect) !== undefined ? { expect: normalizeExpect(entry.expect) } : {}),
      };
    })
    .filter((entry): entry is NonNullable<ScenarioPlan['cleanup']>[number] => entry !== undefined);
  return cleanup.length > 0 ? cleanup : undefined;
}

function normalizeExpect(value: unknown): ScenarioPlan['expect'] | undefined {
  if (!isRecord(value)) return undefined;
  const status = normalizeStatus(value.status ?? value.statusCode);
  const json = isRecord(value.json) ? value.json : undefined;
  const contains = typeof value.contains === 'string' ? value.contains : undefined;
  return {
    ...(status !== undefined ? { status } : {}),
    ...(json !== undefined ? { json } : {}),
    ...(contains !== undefined ? { contains } : {}),
  };
}

function normalizeStatus(value: unknown): ExpectedStatus | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) return Number(value.trim());
  if (Array.isArray(value)) {
    const statuses = value
      .map((entry) => typeof entry === 'number' ? entry : typeof entry === 'string' && /^\d{3}$/.test(entry.trim()) ? Number(entry.trim()) : undefined)
      .filter((entry): entry is number => entry !== undefined);
    return statuses.length > 0 ? statuses : undefined;
  }
  if (isRecord(value)) {
    const min = typeof value.min === 'number' ? value.min : typeof value.min === 'string' && /^\d{3}$/.test(value.min.trim()) ? Number(value.min.trim()) : undefined;
    const max = typeof value.max === 'number' ? value.max : typeof value.max === 'string' && /^\d{3}$/.test(value.max.trim()) ? Number(value.max.trim()) : undefined;
    return min !== undefined || max !== undefined ? { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) } : undefined;
  }
  return undefined;
}

function normalizeMethod(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  const aliases: Record<string, string> = {
    READ: 'GET',
    CREATE: 'POST',
    UPDATE: 'PUT',
    MODIFY: 'PATCH',
    REMOVE: 'DELETE',
  };
  return aliases[normalized] ?? normalized;
}

function normalizeSourceOfTruth(value: unknown): NonNullable<NonNullable<ScenarioPlan['target']>['sourceOfTruth']> | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'user' || normalized === 'observed' || normalized === 'contract' || normalized === 'ai' || normalized === 'fallback') return normalized;
  if (normalized === 'repo' || normalized === 'runtime') return 'observed';
  return undefined;
}

function normalizeAiDeclaredSourceOfTruth(value: unknown): NonNullable<NonNullable<ScenarioPlan['target']>['sourceOfTruth']> | undefined {
  const source = normalizeSourceOfTruth(value);
  if (source === 'user') return undefined;
  return source;
}

function provenanceForUiRoute(path: string, discovery: DiscoveryResult): NonNullable<NonNullable<ScenarioPlan['target']>['sourceOfTruth']> | undefined {
  const route = discovery.uiRoutes.find((candidate) => routePathMatches(candidate.path, path));
  if (route === undefined) return undefined;
  if (route.source === 'contract') return 'contract';
  return 'observed';
}

function provenanceForApiRoute(method: string, path: string, discovery: DiscoveryResult): NonNullable<NonNullable<ScenarioPlan['target']>['sourceOfTruth']> | undefined {
  const route = discovery.apiRoutes.find((candidate) => candidate.method.toUpperCase() === method.toUpperCase() && routePathMatches(candidate.path, path));
  if (route === undefined) return undefined;
  if (route.source === 'contract') return 'contract';
  return 'observed';
}

function provenanceForContract(path: string, discovery: DiscoveryResult): NonNullable<NonNullable<ScenarioPlan['target']>['sourceOfTruth']> | undefined {
  const contract = discovery.contracts.find((candidate) => candidate.path === path);
  if (contract === undefined) return undefined;
  return 'contract';
}

function routePathMatches(discovered: string, planned: string): boolean {
  const discoveredSegments = normalizeRouteForProof(discovered).split('/').filter(Boolean);
  const plannedSegments = normalizeRouteForProof(planned).split('/').filter(Boolean);
  if (discoveredSegments.length !== plannedSegments.length) return false;
  return discoveredSegments.every((segment, index) => segment === '{}' || plannedSegments[index] === '{}' || segment === plannedSegments[index]);
}

function normalizeRouteForProof(path: string): string {
  return path
    .replace(/\/+$/g, '')
    .replace(/:([A-Za-z_$][A-Za-z0-9_$-]*)/g, '{}')
    .replace(/\{[A-Za-z_$][A-Za-z0-9_$-]*\}/g, '{}')
    .replace(/<([A-Za-z_$][A-Za-z0-9_$-]*)>/g, '{}')
    || '/';
}

function normalizePath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  try {
    const url = new URL(trimmed);
    return normalizePath(url.pathname);
  } catch {
    const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, '');
    const noQuery = withoutOrigin.split(/[?#]/, 1)[0] ?? '';
    const normalized = `/${noQuery.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
    return normalized.length > 1 ? normalized.replace(/\/$/, '') : '/';
  }
}

function normalizeEvidenceRequired(value: unknown, type: EngineType): ScenarioPlan['evidenceRequired'] {
  const allowed = new Set(['repo', 'ui', 'api', 'schema', 'auth', 'message']);
  if (Array.isArray(value)) {
    const normalized = value.filter((entry): entry is ScenarioPlan['evidenceRequired'][number] => typeof entry === 'string' && allowed.has(entry));
    if (normalized.length > 0) return normalized;
  }
  if (type === 'ui') return ['ui'];
  if (type === 'api') return ['api'];
  if (type === 'contract' || type === 'schema') return ['schema'];
  if (type === 'message') return ['message', 'schema'];
  return ['repo'];
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: readonly string[] = []): readonly string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim());
  return normalized.length > 0 ? normalized : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isQueryRecord(value: unknown): value is Record<string, string | number | boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean');
}
