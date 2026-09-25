import type { EvidenceGraph, IntentPlan } from './compiler-types.js';
import type { AiPlannerProvider, AiPlannerProviderRequest, AiPlannerProviderResponse, PlannerContext } from './types.js';
import { containsObviousSecretLikeValue } from './secret-safety.js';
import { resolveRepairAttempts } from './config.js';

const CAPABILITIES = ['web.ui', 'api.http', 'api.graphql', 'api.grpc', 'messaging', 'data', 'job', 'cli', 'code'] as const;

export const aiIntentOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['scenarios', 'warnings'],
  properties: {
    scenarios: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'objective', 'actions', 'invariants', 'evidenceRequired', 'cleanup'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          objective: { type: 'string', minLength: 1 },
          actor: { type: 'string', minLength: 1 },
          initialState: { type: 'array', items: { type: 'string', minLength: 1 } },
          actions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'verb', 'resource', 'expectedOutcomes'],
              properties: {
                id: { type: 'string', minLength: 1 },
                verb: { type: 'string', minLength: 1 },
                resource: { type: 'string', minLength: 1 },
                capability: { enum: CAPABILITIES },
                actor: { type: 'string', minLength: 1 },
                phase: { enum: ['setup', 'test', 'verification'] },
                // A list, not a map: some providers' strict structured-output
                // modes reject object-valued additionalProperties, so each
                // value entry names its input explicitly.
                values: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'semanticType'],
                    properties: {
                      name: { type: 'string', minLength: 1 },
                      semanticType: { type: 'string', minLength: 1 },
                      value: {},
                      fixture: { type: 'string', minLength: 1 },
                      secretRef: { type: 'string', minLength: 1 },
                      fromActionId: { type: 'string', minLength: 1 },
                      generate: { const: true },
                    },
                  },
                },
                expectedOutcomes: { type: 'array', items: { type: 'string', minLength: 1 } },
              },
            },
          },
          invariants: { type: 'array', items: { type: 'string', minLength: 1 } },
          evidenceRequired: { type: 'array', items: { type: 'string', minLength: 1 } },
          cleanup: { enum: ['automatic', 'isolated', 'manual'] },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const;

const aiIntentOutlineJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['checks'],
  properties: {
    checks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        // Deliberately two short fields: this step only divides the request,
        // so every extra word it must write is time the user waits.
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
        },
      },
    },
  },
} as const;

const aiIntentSemanticRepairJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['repairs', 'warnings'],
  properties: {
    repairs: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['scenarioId', 'actionId', 'action'],
        properties: {
          scenarioId: { type: 'string', minLength: 1 },
          actionId: { type: 'string', minLength: 1 },
          action: aiIntentOutputJsonSchema.properties.scenarios.items.properties.actions.items,
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const;

export class AiIntentPlanner {
  readonly name = 'ai-intent-planner';

  constructor(private readonly provider: AiPlannerProvider) {}

  /**
   * Small pieces finish fast and run at the same time. One giant answer is
   * slow no matter how fast the model is, because the model must write it
   * end to end before anything can start.
   */
  private static readonly BATCH_SIZE = 3;
  /** Ceiling on how many pieces are in flight at once, so providers are not flooded. */
  private static readonly MAX_PARALLEL = 8;

  async plan(context: PlannerContext, evidence: EvidenceGraph): Promise<IntentPlan> {
    const requested = context.input.scenarios;
    if (requested === undefined || requested <= AiIntentPlanner.BATCH_SIZE) {
      context.onPhase?.('planning.ai-write', 'AI is writing the test cases from your description');
      return this.planScenarios(context, evidence, requested, undefined);
    }
    // Step 1: a small, quick answer listing the checks. This is also the
    // honest division of the request: one check here becomes one test case.
    context.onPhase?.('planning.ai-outline', `AI is listing the ${requested} checks in your description`);
    let outline: readonly { readonly id: string; readonly name: string; readonly objective: string }[];
    try {
      outline = await this.planOutline(context, evidence, requested);
    } catch (error) {
      // The outline only splits the work so pieces can run in parallel; it
      // must never be the reason a run dies. When it cannot be produced, the
      // whole request is written as one piece — slower, but still the answer.
      const reason = error instanceof Error ? error.message : String(error);
      context.onPhase?.('planning.ai-write', 'Check list unavailable — AI is writing all test cases in one piece');
      const single = await this.planScenarios(context, evidence, requested, undefined);
      return { ...single, warnings: [...single.warnings, `Outline step failed and the request was written as one piece instead: ${reason}`] };
    }
    // Step 2: expand that list into full test cases using several small
    // answers sent at the same time, instead of one huge answer sent alone.
    const batches: (typeof outline)[] = [];
    for (let index = 0; index < outline.length; index += AiIntentPlanner.BATCH_SIZE) {
      batches.push(outline.slice(index, index + AiIntentPlanner.BATCH_SIZE));
    }
    context.onPhase?.('planning.ai-write', `AI is writing ${outline.length} test cases as ${batches.length} small pieces at the same time`);
    // Each finished piece reports immediately, so the screen keeps moving
    // instead of sitting on one sentence until everything is done.
    let finishedPieces = 0;
    let finishedCases = 0;
    const runBatch = async (slice: typeof outline): Promise<IntentPlan> => {
      const part = await this.planScenarios(context, evidence, slice.length, slice);
      finishedPieces += 1;
      finishedCases += part.scenarios.length;
      context.onPhase?.(
        `planning.ai-write-${finishedPieces}`,
        `${finishedCases} of ${outline.length} test cases written (piece ${finishedPieces} of ${batches.length} done)`,
      );
      return part;
    };
    const written: IntentPlan[] = [];
    for (let start = 0; start < batches.length; start += AiIntentPlanner.MAX_PARALLEL) {
      const wave = batches.slice(start, start + AiIntentPlanner.MAX_PARALLEL);
      written.push(...await Promise.all(wave.map(runBatch)));
    }
    const seen = new Set<string>();
    const scenarios = written.flatMap((part) => part.scenarios).map((scenario, index) => {
      if (!seen.has(scenario.id)) {
        seen.add(scenario.id);
        return scenario;
      }
      const uniqueId = `${scenario.id}_${index + 1}`;
      seen.add(uniqueId);
      return { ...scenario, id: uniqueId };
    });
    validateScenarioCount(scenarios.length, context);
    return {
      schemaVersion: 'brisk-aitesting.intent.v1',
      goal: context.input.goal,
      scenarios,
      warnings: written.flatMap((part) => part.warnings),
    };
  }

  /**
   * One provider call, recovered once when the sized budget starves it.
   *
   * The per-call maxOutputTokensHint pays only for the visible answer. A
   * deployment that bills hidden reasoning against the same budget can spend
   * a small budget entirely before writing anything, which surfaces as a
   * failed call or an answer with no text. That is a budget problem, not a
   * model problem, so the retry repeats the identical request without the
   * hint — the host's full configured output budget applies. Only a second
   * failure is real, and it is reported with both attempts' evidence.
   */
  private async completeWithBudgetRecovery(request: AiPlannerProviderRequest): Promise<AiPlannerProviderResponse> {
    let firstFailure: string;
    try {
      const response = await this.provider.complete(request);
      if (response.content.trim().length > 0) return response;
      firstFailure = 'the provider returned no visible text';
    } catch (error) {
      firstFailure = error instanceof Error ? error.message : String(error);
    }
    const unbudgeted: AiPlannerProviderRequest = {
      jsonSchemaName: request.jsonSchemaName,
      ...(request.jsonSchema !== undefined ? { jsonSchema: request.jsonSchema } : {}),
      ...(request.structuredOutput !== undefined ? { structuredOutput: request.structuredOutput } : {}),
      ...(request.purpose !== undefined ? { purpose: request.purpose } : {}),
      system: request.system,
      user: request.user,
    };
    const retry = await this.provider.complete(unbudgeted);
    if (retry.content.trim().length === 0) {
      throw new Error(
        `AI returned no usable text for ${request.purpose ?? request.jsonSchemaName} twice: first with a ${request.maxOutputTokensHint ?? 'sized'}-token output budget (${firstFailure}), then with the host's full output budget. If the model spends its output budget on hidden reasoning, raise the configured AI output budget or use a deployment that returns visible text.`,
      );
    }
    return retry;
  }

  /** Ask only for the list of checks: a small answer that divides the request. */
  private async planOutline(
    context: PlannerContext,
    evidence: EvidenceGraph,
    requested: number,
  ): Promise<readonly { readonly id: string; readonly name: string; readonly objective: string }[]> {
    // Deliberately small: dividing the request needs the resource names, not
    // the full operation catalogue. A short question gets a short, fast answer.
    const resources = [...new Set(evidence.operations.map((operation) => operation.resource))];
    const capabilities = [...new Set(evidence.operations.map((operation) => operation.capability))];
    const user = JSON.stringify({
      task: `Divide the testing request into exactly ${requested} separate checks. Return only the list: no steps, no values, no operations.`,
      goal: context.input.goal,
      rules: [
        `Return exactly ${requested} checks.`,
        'Each check must be one self-contained business journey that can be tested on its own.',
        'Cover the whole request; never drop a requested area; never repeat the same check twice.',
        'Use short lowercase ids with underscores, for example create_and_read_channel.',
        'Keep every name to one short line of at most ten words.',
      ],
      availableResources: resources,
      availableCapabilities: capabilities,
    });
    const response = await this.completeWithBudgetRecovery({
      jsonSchemaName: 'brisk-aitesting.intent-outline.v1',
      jsonSchema: aiIntentOutlineJsonSchema,
      structuredOutput: 'json-schema',
      purpose: 'intent-outline',
      // The outline is one short line per check; it never needs a batch-sized
      // budget. The floor leaves room for deployments that spend output
      // tokens deliberating before the visible answer appears.
      maxOutputTokensHint: Math.max(3_000, 96 * requested),
      system: [
        'You divide a software-testing request into separate checks.',
        'Return only the requested structured JSON.',
        'Answer immediately. Do not deliberate, explain, or restate the request: the list itself is the whole answer.',
      ].join('\n'),
      user,
    });
    const parsed = JSON.parse(structuredIntentJson(response.content)) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.checks)) throw new Error('AI outline must contain a checks array.');
    const checks = parsed.checks.map((check, index) => {
      if (!isRecord(check)) throw new Error(`checks.${index} must be an object.`);
      // The list is a cheap dividing step. A thin label is not worth throwing
      // away a whole answer for, so a missing objective falls back to the name.
      const name = typeof check.name === 'string' && check.name.trim().length > 0
        ? check.name.trim()
        : requireString(check.id, `checks.${index}.id`);
      const objective = typeof check.objective === 'string' && check.objective.trim().length > 0
        ? check.objective.trim()
        : `Prove: ${name}`;
      return { id: requireString(check.id, `checks.${index}.id`), name, objective };
    });
    if (checks.length === 0) throw new Error('AI outline returned no checks.');
    return checks;
  }

  /** Write full test cases: either the whole request, or one assigned slice of the check list. */
  private async planScenarios(
    context: PlannerContext,
    evidence: EvidenceGraph,
    expectedCount: number | undefined,
    assigned: readonly { readonly id: string; readonly name: string; readonly objective: string }[] | undefined,
  ): Promise<IntentPlan> {
    const maxRepairAttempts = resolveRepairAttempts(context.config.planning?.repairAttempts ?? context.config.ai?.repairAttempts);
    let invalidContent = '';
    let lastError = 'AI intent was not accepted.';
    for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
      const basePrompt = assigned === undefined
        ? intentUserPrompt(context, evidence)
        : intentBatchUserPrompt(context, evidence, assigned);
      const userPrompt = attempt === 0
        ? basePrompt
        : intentRepairUserPrompt(context, evidence, invalidContent, lastError, attempt, maxRepairAttempts, basePrompt);
      if (containsObviousSecretLikeValue(userPrompt)) {
        throw new Error('AI intent prompt rejected because it contains a raw secret-like value. Pass a secret reference instead.');
      }
      let response;
      try {
        response = await this.completeWithBudgetRecovery({
          jsonSchemaName: 'brisk-aitesting.intent.v1',
          jsonSchema: aiIntentOutputJsonSchema,
          structuredOutput: 'json-schema',
          purpose: attempt === 0 ? 'intent-write' : 'intent-json-repair',
          maxOutputTokensHint: intentOutputTokensHint(expectedCount ?? context.input.scenarios ?? 5),
          system: attempt === 0 ? intentSystemPrompt() : intentRepairSystemPrompt(),
          user: userPrompt,
        });
      } catch (error) {
        // A provider hiccup (empty answer, transient refusal) is retryable
        // exactly like a malformed answer - one flake must not kill the run.
        lastError = error instanceof Error ? error.message : String(error);
        continue;
      }
      invalidContent = response.content;
      try {
        return parseIntent(response.content, context, expectedCount);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(`AI intent remained invalid after ${maxRepairAttempts} repair attempt(s): ${lastError}`);
  }

  async repairSemantic(
    context: PlannerContext,
    evidence: EvidenceGraph,
    invalidIntent: IntentPlan,
    diagnostics: readonly { readonly code: string; readonly message: string; readonly scenarioId?: string; readonly actionId?: string }[],
    attempt: number,
    maxAttempts: number,
    previousError?: string,
  ): Promise<IntentPlan> {
    // Only diagnostics that name a real intent action can be repaired: a
    // synthesized step id (a compiler-made cleanup or fixture action) matches
    // nothing in the intent, so a "replacement" for it could never be applied
    // and every attempt would silently change nothing.
    const intentActionKeys = new Set(invalidIntent.scenarios.flatMap((scenario) => (
      scenario.actions.map((action) => `${scenario.id}:${action.id}`)
    )));
    const affected = diagnostics.flatMap((diagnostic) => (
      diagnostic.scenarioId === undefined
      || diagnostic.actionId === undefined
      || !intentActionKeys.has(`${diagnostic.scenarioId}:${diagnostic.actionId}`)
        ? []
        : [{ scenarioId: diagnostic.scenarioId, actionId: diagnostic.actionId }]
    ));
    const affectedKeys = new Set(affected.map((entry) => `${entry.scenarioId}:${entry.actionId}`));
    if (affectedKeys.size === 0) {
      throw new Error('AI semantic repair requires at least one diagnostic naming an existing scenario action; every current diagnostic points at compiler-synthesized steps or carries no action.');
    }
    const affectedScenarioIds = new Set(affected.map((entry) => entry.scenarioId));
    const affectedActions = invalidIntent.scenarios.flatMap((scenario) => scenario.actions
      .filter((action) => affectedKeys.has(`${scenario.id}:${action.id}`))
      .map((action) => ({ scenarioId: scenario.id, action: wireAction(action) })));
    // The full action list of each affected scenario, in execution order: a
    // fromActionId must name an EARLIER action in the same scenario, and the
    // model cannot pick one it has never seen.
    const affectedScenarios = invalidIntent.scenarios
      .filter((scenario) => affectedScenarioIds.has(scenario.id))
      .map((scenario) => ({
        scenarioId: scenario.id,
        actionsInOrder: scenario.actions.map((action) => wireAction(action)),
      }));
    const user = JSON.stringify({
      task: 'Return replacements only for the listed faulty actions. Valid scenarios and actions are preserved by the product and must not be repeated.',
      attempt,
      maxAttempts,
      rules: [
        'Return exactly one replacement for every affected scenarioId/actionId and no others.',
        'Keep each replacement action id unchanged.',
        'For AMBIGUOUS_OPERATION, select one exact action/resource/capability combination from semanticVocabulary.operations.',
        'For missing or ambiguous values, add a values entry with the input name, its semantic type, and fromActionId set to the exact id of the producing action, copied from affectedScenarios.actionsInOrder — it must appear EARLIER in that scenario than the action being repaired.',
        'When a diagnostic lists candidateIntentActionIds, fromActionId must be one of them.',
        'For a brand-new or renamed value use { name, semanticType, generate: true } instead of fromActionId, but only where that operation input shows generatedWhenOmitted: true in semanticVocabulary.',
        'An identifier the application itself creates or lists can never be generated. For NO_GENERATION_RECIPE, replace generate with fromActionId naming the earlier action in the same scenario that creates or lists that value.',
        'Do not invent an operation, input, output, route, selector, payload field, or status code.',
      ],
      diagnostics,
      ...(previousError !== undefined ? { previousAttemptError: previousError } : {}),
      affectedActions,
      affectedScenarios,
      originalGoal: context.input.goal,
      outputExample: {
        repairs: [{
          scenarioId: 'scenario_1',
          actionId: 'action_2',
          action: {
            id: 'action_2', verb: 'read', resource: 'channel', capability: 'api.http',
            values: [{ name: 'channelId', semanticType: 'channel.id', fromActionId: 'action_1' }],
            expectedOutcomes: [],
          },
        }],
        warnings: [],
      },
      semanticVocabulary: (JSON.parse(intentUserPrompt(context, evidence)) as { semanticVocabulary: unknown }).semanticVocabulary,
    });
    if (containsObviousSecretLikeValue(user)) {
      throw new Error('AI semantic repair prompt rejected because it contains a raw secret-like value. Pass a secret reference instead.');
    }
    const response = await this.completeWithBudgetRecovery({
      jsonSchemaName: 'brisk-aitesting.intent-semantic-repair.v1',
      jsonSchema: aiIntentSemanticRepairJsonSchema,
      structuredOutput: 'json-schema',
      purpose: 'intent-semantic-repair',
      // One replacement action per affected id, nothing else.
      maxOutputTokensHint: Math.max(1_500, 900 * affectedKeys.size),
      system: [
        intentRepairSystemPrompt(),
        'Fix compiler ambiguity and typed value relationships without reducing requested coverage.',
        'Answer immediately with the replacements. Do not deliberate or explain: only the listed faulty actions need rewriting.',
      ].join('\n'),
      user,
    });
    return applySemanticRepairs(response.content, invalidIntent, affectedKeys, evidence);
  }
}

export function parseAiIntentForTesting(content: string, context: PlannerContext): IntentPlan {
  return parseIntent(content, context);
}

function intentSystemPrompt(): string {
  return [
    'You translate a software-testing goal into protocol-neutral business intent.',
    'Return only the requested structured JSON.',
    'Describe what the user wants proven; never describe how an engine should execute it.',
    'Do not output URLs, routes, HTTP methods, selectors, queries, payload field names, status codes, capture paths, scripts, commands, broker addresses, or engine names.',
    'Use only semantic actions: a verb, a business resource, optional actor, and expected business outcomes.',
    'When an action needs a value produced by one specific earlier action, add a values entry: { name: <input>, semanticType: <type>, fromActionId: <earlier action id> }.',
    'When an action needs a BRAND-NEW value - a fresh unique name, a new title, a renamed value - add { name: <input>, semanticType: <type>, generate: true }, but only where that operation input shows generatedWhenOmitted: true in semanticVocabulary: that flag means a recipe exists to make one. Never point a new or renamed value at an earlier output.',
    'An identifier the application itself creates or lists (an organization id, a record id) can never be generated. Bind it with { name, semanticType, fromActionId: <the earlier action in the same scenario that creates or lists it> }, and add that earlier action if the scenario does not have one yet.',
    'Use fromActionId whenever more than one earlier action creates the same resource type; never leave that relationship ambiguous.',
    'fromActionId rules that are checked mechanically and reject the whole answer when broken: (1) it must exactly equal the id of an action that appears EARLIER in the SAME scenario\'s actions array - never a later action, never an action from another scenario, never an invented id; (2) before writing any fromActionId, find the producing action in the current scenario and copy its id character for character; (3) if the producing action does not exist yet in that scenario, add it before the consumer; (4) every scenario must be self-contained: all ids it references exist inside it.',
    'Prefer flat scenarios where each check creates what it needs; only reference earlier actions when the request explicitly connects them.',
    'For expectedOutcomes, copy only exact outcome ids supplied in the application evidence vocabulary.',
    'Use setup or verification phase only when the user explicitly asks for that role; otherwise omit phase and the compiler will use test.',
    'The deterministic compiler—not you—selects operations, constructs inputs, binds values, derives executable assertions, and plans cleanup.',
    'Use the semantic capability and resource vocabulary supplied by the application evidence.',
    'Do not invent a capability or resource absent from the supplied vocabulary.',
    'When the requested scenario count policy is exact, return exactly that many scenarios.',
    'Answer immediately with the JSON. Do not deliberate, restate the request, or explain your choices: the JSON is the whole answer.',
  ].join('\n');
}

function intentRepairSystemPrompt(): string {
  return [
    intentSystemPrompt(),
    'Repair the previous response using the supplied validation error.',
    'Every scenario must contain at least one action.',
    'Every action must contain at least one expected business outcome when the supplied vocabulary provides one.',
    'Preserve valid scenarios and change only what the validation error requires.',
    'Return the complete repaired JSON object, not a patch or explanation.',
  ].join('\n');
}

function intentUserPrompt(context: PlannerContext, evidence: EvidenceGraph): string {
  const vocabulary = {
    capabilities: [...new Set(evidence.operations.map((operation) => operation.capability))].sort(),
    resources: [...new Set(evidence.operations.map((operation) => operation.resource))].sort(),
    actions: [...new Set(evidence.operations.map((operation) => operation.action))].sort(),
    actors: [...new Set(evidence.operations.map((operation) => operation.actor).filter((actor): actor is string => actor !== undefined))].sort(),
    outcomes: evidence.operations.map((operation) => ({
      action: operation.action,
      resource: operation.resource,
      ids: operation.outcomes.map((outcome) => outcome.id),
    })),
    operations: evidence.operations.map((operation) => ({
      action: operation.action,
      resource: operation.resource,
      capability: operation.capability,
      requiredInputs: operation.inputs.filter((input) => input.required).map((input) => ({
        name: input.name,
        semanticType: input.semanticType,
        generatedWhenOmitted: input.generation !== undefined,
      })),
      outputs: operation.outputs.map((output) => ({ name: output.name, semanticType: output.semanticType })),
      outcomeIds: operation.outcomes.map((outcome) => outcome.id),
    })),
  };
  return JSON.stringify({
    goal: context.input.goal,
    requestedScenarios: context.input.scenarios ?? 5,
    scenarioCountPolicy: context.input.scenarioCountPolicy ?? 'flexible',
    requestedCapabilityTypes: context.input.requiredTypes ?? [],
    application: {
      name: context.config.app.name,
      environment: context.config.app.env,
    },
    semanticVocabulary: vocabulary,
    outputExample: {
      scenarios: [{
        id: 'scenario_1',
        name: 'Business behavior',
        objective: 'What this scenario proves',
        actor: 'authenticated user',
        initialState: ['required business state'],
        actions: [{
          id: 'action_1',
          verb: 'create',
          resource: 'known resource from semanticVocabulary',
          capability: vocabulary.capabilities[0],
          values: [
            { name: 'parentId', semanticType: 'known.id.type', fromActionId: 'earlier_action_id' },
          ],
          expectedOutcomes: [],
        }],
        invariants: ['business invariant'],
        evidenceRequired: ['observable business result'],
        cleanup: 'automatic',
      }],
      warnings: [],
    },
  });
}

/** Ask for full test cases for one assigned slice of the check list. */
function intentBatchUserPrompt(
  context: PlannerContext,
  evidence: EvidenceGraph,
  assigned: readonly { readonly id: string; readonly name: string; readonly objective: string }[],
): string {
  const original = JSON.parse(intentUserPrompt(context, evidence)) as Record<string, unknown>;
  return JSON.stringify({
    task: `Write full business intent for exactly these ${assigned.length} assigned checks, and nothing else. Other checks are being written separately.`,
    assignedChecks: assigned,
    rules: [
      `Return exactly ${assigned.length} scenarios, one per assigned check, keeping each assigned id as the scenario id.`,
      'Each scenario must be self-contained: it creates whatever it needs and references only its own earlier actions.',
    ],
    goal: original.goal,
    application: original.application,
    semanticVocabulary: original.semanticVocabulary,
    outputExample: original.outputExample,
  });
}

/** Output budget for writing full test cases: sized by how many are asked for. */
function intentOutputTokensHint(scenarioCount: number): number {
  return Math.max(2_000, 1_600 * Math.max(1, scenarioCount) + 800);
}

/**
 * A JSON-repair retry must see its previous answer to patch it, but embedding
 * a huge invalid answer whole makes the retry strictly slower than the call
 * it replaces. Beyond the cap, keep the head and tail (where truncation and
 * wrapper mistakes live) and say exactly how much was omitted.
 */
function trimmedInvalidResponse(content: string): string {
  const headLimit = 40_000;
  const tailLimit = 8_000;
  if (content.length <= headLimit + tailLimit) return content;
  const omitted = content.length - headLimit - tailLimit;
  return `${content.slice(0, headLimit)}\n…[${omitted} characters omitted]…\n${content.slice(-tailLimit)}`;
}

function intentRepairUserPrompt(
  context: PlannerContext,
  evidence: EvidenceGraph,
  invalidContent: string,
  validationError: string,
  attempt: number,
  maxAttempts: number,
  basePrompt?: string,
): string {
  return JSON.stringify({
    task: 'Repair the invalid protocol-neutral business intent.',
    attempt,
    maxAttempts,
    validationError,
    invalidResponse: trimmedInvalidResponse(invalidContent),
    originalRequest: JSON.parse(basePrompt ?? intentUserPrompt(context, evidence)) as unknown,
  });
}

function parseIntent(content: string, context: PlannerContext, expectedCount?: number): IntentPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(structuredIntentJson(content));
  } catch (error) {
    throw new Error(`AI intent output is not strict JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.scenarios) || !Array.isArray(parsed.warnings)) {
    throw new Error('AI intent output must contain scenarios and warnings arrays.');
  }
  const scenarios = parsed.scenarios.map((scenario, index) => parseScenario(scenario, index));
  const seenScenarioIds = new Set<string>();
  for (const scenario of scenarios) {
    // Two checks with the same id would silently collide later (the second
    // would overwrite the first during incremental compilation).
    if (seenScenarioIds.has(scenario.id)) throw new Error(`AI intent repeats scenario id "${scenario.id}"; every check needs its own id.`);
    seenScenarioIds.add(scenario.id);
    // A wrong fromActionId is judged by the semantic compiler, which refuses
    // it per scenario with an exact diagnostic the repair round can fix and
    // the delivery gate can drop. Rejecting it here instead would make one
    // check's bad reference fatal to every check in the answer.
  }
  const warnings = normalizeWarnings(parsed.warnings);
  if (expectedCount === undefined) {
    validateScenarioCount(scenarios.length, context);
  } else if (scenarios.length !== expectedCount) {
    // One piece of a split request: it must return exactly its assigned share.
    throw new Error(`AI returned ${scenarios.length} scenarios; exactly ${expectedCount} were assigned to this piece.`);
  }
  return {
    schemaVersion: 'brisk-aitesting.intent.v1',
    goal: context.input.goal,
    scenarios,
    warnings,
  };
}

function applySemanticRepairs(content: string, intent: IntentPlan, affectedKeys: ReadonlySet<string>, evidence: EvidenceGraph): IntentPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(structuredIntentJson(content));
  } catch (error) {
    throw new Error(`AI semantic repair output is not strict JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.repairs) || !Array.isArray(parsed.warnings)) {
    throw new Error('AI semantic repair output must contain repairs and warnings arrays.');
  }
  // generate: true is only satisfiable where some operation input of that
  // semantic type declares a recipe (or a secret source). A repair that asks
  // to generate anything else could never compile, so it is refused here and
  // the refusal steers the next attempt to fromActionId instead.
  const generatableTypes = new Set<string>();
  for (const operation of evidence.operations) {
    for (const input of operation.inputs ?? []) {
      if (input.generation !== undefined || input.secretRef !== undefined) generatableTypes.add(input.semanticType);
    }
  }
  const replacements = new Map<string, IntentPlan['scenarios'][number]['actions'][number]>();
  for (const [index, value] of parsed.repairs.entries()) {
    if (!isRecord(value)) throw new Error(`repairs.${index} must be an object.`);
    const scenarioId = requireString(value.scenarioId, `repairs.${index}.scenarioId`);
    const actionId = requireString(value.actionId, `repairs.${index}.actionId`);
    const key = `${scenarioId}:${actionId}`;
    if (!affectedKeys.has(key)) throw new Error(`repairs.${index} targets unaffected action ${key}.`);
    if (replacements.has(key)) throw new Error(`AI semantic repair repeats action ${key}.`);
    const action = parseAction(value.action, index, 0);
    if (action.id !== actionId) throw new Error(`repairs.${index}.action.id must remain ${actionId}.`);
    for (const [name, valueEntry] of Object.entries(action.values ?? {})) {
      if (valueEntry.generate === true && !generatableTypes.has(valueEntry.semanticType)) {
        throw new Error(
          `repairs.${index} asks to generate a fresh ${name} (${valueEntry.semanticType}), but no operation declares a recipe to make one; bind it with fromActionId to the earlier action in the same scenario that creates or lists it.`,
        );
      }
    }
    replacements.set(key, action);
  }
  for (const key of affectedKeys) {
    if (!replacements.has(key)) throw new Error(`AI semantic repair omitted affected action ${key}.`);
  }
  const warnings = normalizeWarnings(parsed.warnings);
  return {
    ...intent,
    scenarios: intent.scenarios.map((scenario) => ({
      ...scenario,
      actions: scenario.actions.map((action) => replacements.get(`${scenario.id}:${action.id}`) ?? action),
    })),
    warnings: [...intent.warnings, ...warnings],
  };
}

function normalizeWarnings(value: readonly unknown[]): readonly string[] {
  return value.flatMap((warning, index) => {
    if (typeof warning !== 'string') throw new Error(`warnings.${index} must be a string.`);
    const normalized = warning.trim();
    return normalized.length === 0 ? [] : [normalized];
  });
}

function structuredIntentJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  if (!trimmed.startsWith('<think>')) return trimmed;

  const closing = trimmed.indexOf('</think>');
  if (closing < 0 || trimmed.indexOf('</think>', closing + 8) >= 0) {
    throw new Error('reasoning envelope must contain exactly one closed <think> block');
  }
  const remainder = trimmed.slice(closing + 8).trim();
  const fenced = remainder.match(/^```json\s*([\s\S]*?)\s*```$/i);
  const json = (fenced?.[1] ?? remainder).trim();
  if (!json.startsWith('{') || !json.endsWith('}')) {
    throw new Error('reasoning envelope must be followed by exactly one JSON object, optionally in one JSON fence');
  }
  return json;
}

function parseScenario(value: unknown, index: number): IntentPlan['scenarios'][number] {
  if (!isRecord(value)) throw new Error(`scenarios.${index} must be an object.`);
  if (!Array.isArray(value.actions) || value.actions.length === 0) throw new Error(`scenarios.${index}.actions must be a non-empty array.`);
  if (!Array.isArray(value.invariants)) throw new Error(`scenarios.${index}.invariants must be an array.`);
  if (!Array.isArray(value.evidenceRequired)) throw new Error(`scenarios.${index}.evidenceRequired must be an array.`);
  if (!['automatic', 'isolated', 'manual'].includes(String(value.cleanup))) throw new Error(`scenarios.${index}.cleanup is invalid.`);
  return {
    id: requireString(value.id, `scenarios.${index}.id`),
    name: requireString(value.name, `scenarios.${index}.name`),
    objective: requireString(value.objective, `scenarios.${index}.objective`),
    ...(value.actor === undefined ? {} : { actor: requireString(value.actor, `scenarios.${index}.actor`) }),
    ...(value.initialState === undefined
      ? {}
      : {
          initialState: requireStringArray(value.initialState, `scenarios.${index}.initialState`),
        }),
    actions: value.actions.map((action, actionIndex) => parseAction(action, index, actionIndex)),
    invariants: requireStringArray(value.invariants, `scenarios.${index}.invariants`),
    evidenceRequired: requireStringArray(value.evidenceRequired, `scenarios.${index}.evidenceRequired`),
    cleanup: value.cleanup as 'automatic' | 'isolated' | 'manual',
  };
}

function parseAction(value: unknown, scenarioIndex: number, actionIndex: number): IntentPlan['scenarios'][number]['actions'][number] {
  const path = `scenarios.${scenarioIndex}.actions.${actionIndex}`;
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  if (!Array.isArray(value.expectedOutcomes)) throw new Error(`${path}.expectedOutcomes must be an array.`);
  const capability = value.capability;
  if (capability !== undefined && !CAPABILITIES.includes(capability as typeof CAPABILITIES[number])) {
    throw new Error(`${path}.capability is invalid.`);
  }
  return {
    id: requireString(value.id, `${path}.id`),
    verb: requireString(value.verb, `${path}.verb`),
    resource: requireString(value.resource, `${path}.resource`),
    ...(capability === undefined ? {} : { capability: capability as typeof CAPABILITIES[number] }),
    ...(value.actor === undefined ? {} : { actor: requireString(value.actor, `${path}.actor`) }),
    ...(value.phase === undefined
      ? {}
      : ['setup', 'test', 'verification'].includes(String(value.phase))
        ? { phase: value.phase as 'setup' | 'test' | 'verification' }
        : (() => { throw new Error(`${path}.phase is invalid.`); })()),
    ...(value.values === undefined ? {} : { values: parseIntentValues(value.values, `${path}.values`) }),
    expectedOutcomes: requireStringArray(value.expectedOutcomes, `${path}.expectedOutcomes`),
  };
}

/** Show an internal action to the AI in the same list shape the schema demands back. */
function wireAction(action: IntentPlan['scenarios'][number]['actions'][number]): Record<string, unknown> {
  return {
    ...action,
    ...(action.values === undefined ? {} : {
      values: Object.entries(action.values).map(([name, entry]) => ({ name, ...entry })),
    }),
  };
}

function parseIntentValues(value: unknown, path: string): NonNullable<IntentPlan['scenarios'][number]['actions'][number]['values']> {
  // The wire shape is a list of named entries (strict providers refuse maps
  // in structured output). The older map shape is still accepted so existing
  // hosts and fixtures keep working.
  const entries: readonly [string, unknown][] = Array.isArray(value)
    ? value.map((entry, index) => {
        if (!isRecord(entry)) throw new Error(`${path}.${index} must be an object.`);
        return [requireString(entry.name, `${path}.${index}.name`), entry] as [string, unknown];
      })
    : isRecord(value)
      ? Object.entries(value)
      : (() => { throw new Error(`${path} must be a list of named value entries.`); })();
  const result: Record<string, { semanticType: string; value?: unknown; fixture?: string; secretRef?: string; fromActionId?: string }> = {};
  for (const [key, raw] of entries) {
    if (key.trim().length === 0 || !isRecord(raw)) throw new Error(`${path}.${key || '(blank)'} must be an object.`);
    if (result[key] !== undefined) throw new Error(`${path} names "${key}" more than once.`);
    const selectors = ['value', 'fixture', 'secretRef', 'fromActionId', 'generate'].filter((field) => Object.prototype.hasOwnProperty.call(raw, field));
    if (selectors.length !== 1) throw new Error(`${path}.${key} must contain exactly one of value, fixture, secretRef, fromActionId, or generate.`);
    result[key] = {
      semanticType: requireString(raw.semanticType, `${path}.${key}.semanticType`),
      ...(Object.prototype.hasOwnProperty.call(raw, 'value') ? { value: raw.value } : {}),
      ...(raw.fixture === undefined ? {} : { fixture: requireString(raw.fixture, `${path}.${key}.fixture`) }),
      ...(raw.secretRef === undefined ? {} : { secretRef: requireString(raw.secretRef, `${path}.${key}.secretRef`) }),
      ...(raw.fromActionId === undefined ? {} : { fromActionId: requireString(raw.fromActionId, `${path}.${key}.fromActionId`) }),
      ...(raw.generate === true ? { generate: true as const } : {}),
    };
  }
  return result;
}

function validateScenarioCount(count: number, context: PlannerContext): void {
  const requested = context.input.scenarios;
  const policy = context.input.scenarioCountPolicy ?? 'flexible';
  if (requested === undefined || policy === 'flexible') return;
  if (policy === 'exact' && count !== requested) throw new Error(`AI intent returned ${count} scenarios; exactly ${requested} were required.`);
  if (policy === 'at-least' && count < requested) throw new Error(`AI intent returned ${count} scenarios; at least ${requested} were required.`);
  if (policy === 'at-most' && count > requested) throw new Error(`AI intent returned ${count} scenarios; at most ${requested} were required.`);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${path} must be a non-empty string.`);
  return value.trim();
}

function requireStringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((entry, index) => requireString(entry, `${path}.${index}`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
