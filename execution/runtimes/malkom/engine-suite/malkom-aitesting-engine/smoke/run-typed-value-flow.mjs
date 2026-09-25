import assert from 'node:assert/strict';
import {
  AiIntentPlanner,
  SemanticPlanner,
  HostHttpCapabilityAdapter,
  WorkflowLowerer,
  UniversalSemanticCompiler,
  containsObviousSecretLikeValue,
  createEvidenceGraph,
  createHttpEvidenceGraph,
  validateWorkflowInvariants,
} from '../dist/index.js';

const categories = {};
let checks = 0;
const check = (category, condition, message) => {
  assert.equal(condition, true, message);
  categories[category] = (categories[category] ?? 0) + 1;
  checks += 1;
};
const compiler = new UniversalSemanticCompiler();
const provenance = [{ authority: 'contract', source: 'typed-value-flow-fixture', confidence: 1 }];
const slot = (id, semanticType, options = {}) => ({ id, name: options.name ?? id, semanticType, required: options.required ?? true, ...(options.generation === undefined ? {} : { generation: options.generation }), ...(options.secretRef === undefined ? {} : { secretRef: options.secretRef }) });
const operation = (value) => ({
  inputs: [], outputs: [], outcomes: [{ id: 'ok', meaning: 'succeeds', successful: true }],
  sideEffect: 'none', provenance, binding: { fixture: true }, ...value,
});
const intent = (actions, goal = 'Prove typed value flow') => ({
  schemaVersion: 'brisk-aitesting.intent.v1', goal, warnings: [], scenarios: [{
    id: 'typed_values', name: 'Typed values', objective: goal, actions: actions.map((action, index) => ({ id: `action_${index + 1}`, expectedOutcomes: [], ...action })),
    invariants: [], evidenceRequired: [], cleanup: 'isolated',
  }],
});

const sourceEvidence = createEvidenceGraph([
  operation({ id: 'widget.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create widget', action: 'create', resource: 'widget', sideEffect: 'create', outputs: [slot('widgetId', 'widget.id', { required: false })] }),
  operation({ id: 'profile.submit', adapterId: 'fixture', capability: 'custom.fixture', name: 'Submit profile', action: 'submit', resource: 'profile', inputs: [
    slot('widgetId', 'widget.id'), slot('name', 'profile.name'), slot('fixture', 'profile.fixture'), slot('token', 'auth.token'),
    slot('requestId', 'request.id', { generation: { kind: 'uuid' } }),
  ] }),
  operation({ id: 'widget.verify', adapterId: 'fixture', capability: 'custom.fixture', name: 'Verify widget', action: 'verify', resource: 'widget audit', sideEffect: 'read', inputs: [slot('widgetId', 'widget.id')] }),
]);
const sourceResult = compiler.compile(intent([
  { verb: 'create', resource: 'widget' },
  { verb: 'submit', resource: 'profile', values: {
    name: { semanticType: 'profile.name', value: 'Ada' },
    fixture: { semanticType: 'profile.fixture', fixture: 'standard-profile' },
    token: { semanticType: 'auth.token', secretRef: 'PROFILE_AUTH_TOKEN' },
  } },
  { verb: 'verify', resource: 'widget audit' },
]), sourceEvidence);
check('fiveSources', sourceResult.status === 'compiled', JSON.stringify(sourceResult.diagnostics));
const sourceScenario = sourceResult.workflow?.scenarios[0];
check('fiveSources', sourceScenario?.valueFlow?.schemaVersion === 'brisk-aitesting.value-flow.v1');
const sourceKinds = new Set(sourceScenario?.valueFlow?.values.map((value) => value.source.kind));
for (const kind of ['intent', 'fixture', 'secret-reference', 'generated', 'step-output']) check('fiveSources', sourceKinds.has(kind), `missing ${kind}`);
check('fiveSources', sourceScenario?.valueFlow?.values.every((value) => value.semanticType.length > 0) === true);
check('consumersAndLifetime', sourceScenario?.valueFlow?.values.every((value) => value.consumers.length > 0) === true);
const sharedOutput = sourceScenario?.valueFlow?.values.find((value) => value.source.kind === 'step-output');
check('consumersAndLifetime', sharedOutput?.consumers.length === 2);
check('consumersAndLifetime', sharedOutput?.lifetime.startsAt === 'after:step_typed_values_action_1_1');
check('consumersAndLifetime', sharedOutput?.lifetime.endsAt === 'after:step_typed_values_action_3_3');
check('secretSafety', sourceScenario?.valueFlow?.values.find((value) => value.secret)?.source.reference === 'PROFILE_AUTH_TOKEN');
check('secretSafety', !JSON.stringify(sourceScenario?.valueFlow).includes('actual-secret-value'));

const conversionEvidence = createEvidenceGraph([
  operation({ id: 'legacy.create', adapterId: 'conversion-adapter', capability: 'custom.fixture', name: 'Create legacy customer', action: 'create', resource: 'legacy', sideEffect: 'create', outputs: [slot('legacyId', 'legacy.id', { required: false })] }),
  operation({ id: 'customer.read', adapterId: 'conversion-adapter', capability: 'custom.fixture', name: 'Read customer', action: 'read', resource: 'customer', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')], valueConversions: [{ id: 'legacy-to-customer-id', fromSemanticType: 'legacy.id', toSemanticType: 'customer.id', safety: 'validated', binding: { adapterOwned: true } }] }),
]);
const converted = compiler.compile(intent([{ verb: 'create', resource: 'legacy' }, { verb: 'read', resource: 'customer' }]), conversionEvidence);
check('adapterConversion', converted.status === 'compiled', JSON.stringify(converted.diagnostics));
const convertedBinding = converted.workflow?.scenarios[0]?.steps[1]?.inputs[0]?.value;
check('adapterConversion', convertedBinding?.conversion?.id === 'legacy-to-customer-id');
check('adapterConversion', convertedBinding?.conversion?.adapterId === 'conversion-adapter');
check('adapterConversion', converted.workflow?.scenarios[0]?.valueFlow?.values.some((value) => value.consumers.some((consumer) => consumer.conversion?.id === 'legacy-to-customer-id')) === true);

const noConversion = compiler.compile(intent([{ verb: 'create', resource: 'legacy' }, { verb: 'read', resource: 'customer' }]), createEvidenceGraph(conversionEvidence.operations.map((entry) => ({ ...entry, valueConversions: undefined }))));
check('adapterConversion', noConversion.status === 'needs-evidence');
check('adapterConversion', noConversion.diagnostics.some((entry) => entry.code === 'MISSING_REQUIRED_VALUE'));

const incompatible = compiler.compile(intent([{ verb: 'read', resource: 'customer', values: { customerId: { semanticType: 'order.id', value: 'order-1' } } }]), createEvidenceGraph([conversionEvidence.operations[1]]));
check('bindingRejections', incompatible.status === 'needs-evidence');
check('bindingRejections', incompatible.diagnostics.some((entry) => entry.code === 'INCOMPATIBLE_VALUE_BINDING'));
const duplicate = compiler.compile(intent([{ verb: 'read', resource: 'customer', values: {
  customerId: { semanticType: 'customer.id', value: 'customer-1' },
  'customer.id': { semanticType: 'customer.id', value: 'customer-2' },
} }]), createEvidenceGraph([conversionEvidence.operations[1]]));
check('bindingRejections', duplicate.status === 'ambiguous');
check('bindingRejections', duplicate.diagnostics.some((entry) => entry.code === 'DUPLICATE_INTENT_BINDING'));
const missing = compiler.compile(intent([{ verb: 'read', resource: 'customer' }]), createEvidenceGraph([conversionEvidence.operations[1]]));
check('bindingRejections', missing.diagnostics.some((entry) => entry.code === 'MISSING_REQUIRED_VALUE'));

const ambiguousProducer = compiler.compile(intent([
  { verb: 'create', resource: 'customer' }, { verb: 'create', resource: 'customer' }, { verb: 'read', resource: 'customer' },
]), createEvidenceGraph([
  operation({ id: 'customer.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create customer', action: 'create', resource: 'customer', sideEffect: 'create', outputs: [slot('customerId', 'customer.id', { required: false })] }),
  operation({ id: 'customer.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read customer', action: 'read', resource: 'customer', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')] }),
]));
check('bindingRejections', ambiguousProducer.status === 'ambiguous');
check('bindingRejections', ambiguousProducer.diagnostics.some((entry) => entry.code === 'AMBIGUOUS_VALUE_PRODUCER'));
const ambiguousDiagnostic = ambiguousProducer.diagnostics.find((entry) => entry.code === 'AMBIGUOUS_VALUE_PRODUCER');
check('bindingRejections', ambiguousDiagnostic?.candidateIntentActionIds?.join(',') === 'action_1,action_2');
check('bindingRejections', ambiguousDiagnostic?.message.includes('action_1') === true, ambiguousDiagnostic?.message);
check('bindingRejections', ambiguousDiagnostic?.message.includes('fromActionId') === true);

// Two identical reads are one producer echoed twice, not two producers: the
// consumer binds to the earliest read instead of refusing.
const repeatedReadEvidence = createEvidenceGraph([
  operation({ id: 'customer.list', adapterId: 'fixture', capability: 'custom.fixture', name: 'List customers', action: 'list', resource: 'customer', sideEffect: 'read', outputs: [slot('customerId', 'customer.id', { required: false })] }),
  operation({ id: 'customer.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read customer', action: 'read', resource: 'customer', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')] }),
]);
const repeatedRead = compiler.compile(intent([
  { verb: 'list', resource: 'customer' }, { verb: 'list', resource: 'customer' }, { verb: 'read', resource: 'customer' },
]), repeatedReadEvidence);
check('equivalentReads', repeatedRead.status === 'compiled', JSON.stringify(repeatedRead.diagnostics));
check('equivalentReads', repeatedRead.workflow?.scenarios[0]?.steps[2]?.inputs[0]?.value.stepId === 'step_typed_values_action_1_1');

// Once a scenario has consumed one of the candidate values, later same-typed
// inputs continue with that value — scenario consistency is not a guess.
const continuityEvidence = createEvidenceGraph([
  operation({ id: 'customer.list', adapterId: 'fixture', capability: 'custom.fixture', name: 'List customers', action: 'list', resource: 'customer', sideEffect: 'read', outputs: [slot('customerId', 'customer.id', { required: false })] }),
  operation({ id: 'customer.audit', adapterId: 'fixture', capability: 'custom.fixture', name: 'Audit customer', action: 'audit', resource: 'customer audit', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')], outputs: [slot('auditedCustomerId', 'customer.id', { required: false })] }),
  operation({ id: 'customer.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read customer', action: 'read', resource: 'customer', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')] }),
]);
const continuity = compiler.compile(intent([
  { verb: 'list', resource: 'customer' }, { verb: 'audit', resource: 'customer audit' }, { verb: 'read', resource: 'customer' },
]), continuityEvidence);
check('consumedContinuity', continuity.status === 'compiled', JSON.stringify(continuity.diagnostics));
check('consumedContinuity', continuity.workflow?.scenarios[0]?.steps[2]?.inputs[0]?.value.stepId === 'step_typed_values_action_1_1');

const explicitProducer = compiler.compile(intent([
  { verb: 'create', resource: 'customer' },
  { verb: 'create', resource: 'customer' },
  { verb: 'read', resource: 'customer', values: {
    customerId: { semanticType: 'customer.id', fromActionId: 'action_2' },
  } },
]), createEvidenceGraph([
  operation({ id: 'customer.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create customer', action: 'create', resource: 'customer', sideEffect: 'create', outputs: [slot('customerId', 'customer.id', { required: false })] }),
  operation({ id: 'customer.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read customer', action: 'read', resource: 'customer', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')] }),
]));
check('explicitProducer', explicitProducer.status === 'compiled', JSON.stringify(explicitProducer.diagnostics));
check('explicitProducer', explicitProducer.workflow?.scenarios[0]?.steps[2]?.inputs[0]?.value.stepId === 'step_typed_values_action_2_2');
check('explicitProducer', explicitProducer.workflow?.scenarios[0]?.steps[2]?.dependsOn.includes('step_typed_values_action_2_2') === true);

const missingExplicitProducer = compiler.compile(intent([
  { verb: 'create', resource: 'customer' },
  { verb: 'read', resource: 'customer', values: {
    customerId: { semanticType: 'customer.id', fromActionId: 'does_not_exist' },
  } },
]), createEvidenceGraph([
  operation({ id: 'customer.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create customer', action: 'create', resource: 'customer', sideEffect: 'create', outputs: [slot('customerId', 'customer.id', { required: false })] }),
  operation({ id: 'customer.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read customer', action: 'read', resource: 'customer', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')] }),
]));
check('explicitProducer', missingExplicitProducer.diagnostics.some((entry) => entry.code === 'UNKNOWN_INTENT_VALUE_PRODUCER'));

const forwardExplicitProducer = compiler.compile(intent([
  { verb: 'read', resource: 'customer', values: {
    customerId: { semanticType: 'customer.id', fromActionId: 'action_2' },
  } },
  { verb: 'create', resource: 'customer' },
]), createEvidenceGraph([
  operation({ id: 'customer.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create customer', action: 'create', resource: 'customer', sideEffect: 'create', outputs: [slot('customerId', 'customer.id', { required: false })] }),
  operation({ id: 'customer.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read customer', action: 'read', resource: 'customer', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')] }),
]));
check('explicitProducer', forwardExplicitProducer.diagnostics.some((entry) => entry.code === 'UNKNOWN_INTENT_VALUE_PRODUCER'));

const ambiguousExplicitProducer = compiler.compile(intent([
  { verb: 'create', resource: 'customer pair' },
  { verb: 'read', resource: 'customer', values: {
    customerId: { semanticType: 'customer.id', fromActionId: 'action_1' },
  } },
]), createEvidenceGraph([
  operation({ id: 'customer-pair.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create customer pair', action: 'create', resource: 'customer pair', sideEffect: 'create', outputs: [
    slot('firstCustomerId', 'customer.id', { required: false }),
    slot('secondCustomerId', 'customer.id', { required: false }),
  ] }),
  operation({ id: 'customer.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read customer', action: 'read', resource: 'customer', sideEffect: 'read', inputs: [slot('customerId', 'customer.id')] }),
]));
check('explicitProducer', ambiguousExplicitProducer.diagnostics.some((entry) => entry.code === 'AMBIGUOUS_INTENT_VALUE_PRODUCER'));

const rawSecret = 'sk-abcdefghijklmnop';
const rawSecretResult = compiler.compile(intent([{ verb: 'read', resource: 'customer', values: { customerId: { semanticType: 'customer.id', value: rawSecret } } }]), createEvidenceGraph([conversionEvidence.operations[1]]));
check('secretSafety', rawSecretResult.diagnostics.some((entry) => entry.code === 'RAW_SECRET_VALUE_FORBIDDEN'));
check('secretSafety', !JSON.stringify(rawSecretResult.diagnostics).includes(rawSecret));
const secretEvidence = compiler.compile(intent([{ verb: 'read', resource: 'customer', values: { customerId: { semanticType: 'customer.id', value: 'customer-1' } } }]), createEvidenceGraph([{ ...conversionEvidence.operations[1], binding: { authorization: 'Bearer abcdefghijklmnop' } }]));
check('secretSafety', secretEvidence.diagnostics.some((entry) => entry.code === 'OPERATION_NOT_EXECUTABLE'));
check('secretSafety', !JSON.stringify(secretEvidence.diagnostics).includes('abcdefghijklmnop'));
check('secretSafety', containsObviousSecretLikeValue({ password: 'plain-text-password' }));

const evidenceSecretResult = compiler.compile(intent([{ verb: 'authorize', resource: 'cleanup' }]), createEvidenceGraph([
  operation({ id: 'cleanup.authorize', adapterId: 'fixture', capability: 'api.http', name: 'Authorize cleanup', action: 'authorize', resource: 'cleanup', inputs: [slot('authorization', 'auth.bearer', { secretRef: 'BRISK_CLEANUP_AUTHORIZATION' })] }),
]));
check('secretSafety', evidenceSecretResult.status === 'compiled', JSON.stringify(evidenceSecretResult.diagnostics));
check('secretSafety', evidenceSecretResult.workflow?.scenarios[0]?.steps[0]?.inputs[0]?.value.kind === 'secret');
check('secretSafety', evidenceSecretResult.workflow?.scenarios[0]?.valueFlow?.values[0]?.source.reference === 'BRISK_CLEANUP_AUTHORIZATION');
const invalidEvidenceSecret = compiler.compile(intent([{ verb: 'authorize', resource: 'cleanup' }]), createEvidenceGraph([
  operation({ id: 'cleanup.invalid-secret', adapterId: 'fixture', capability: 'api.http', name: 'Invalid cleanup secret', action: 'authorize', resource: 'cleanup', inputs: [slot('authorization', 'auth.bearer', { secretRef: 'not valid' })] }),
]));
check('secretSafety', invalidEvidenceSecret.diagnostics.some((entry) => entry.code === 'OPERATION_NOT_EXECUTABLE'));

let providerCalls = 0;
const aiPlanner = new AiIntentPlanner({ name: 'must-not-run', async complete() { providerCalls += 1; throw new Error('provider must not receive secret'); } });
await assert.rejects(() => aiPlanner.plan({
  config: { app: { name: 'fixture', env: 'test' } },
  input: { goal: `Inspect with Bearer abcdefghijklmnop` }, runId: 'run_secret', discovery: {},
}, sourceEvidence), /raw secret-like value/);
check('secretSafety', providerCalls === 0);

const malformedType = compiler.compile(intent([{ verb: 'read', resource: 'broken' }]), createEvidenceGraph([
  operation({ id: 'broken.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Broken read', action: 'read', resource: 'broken', inputs: [slot('broken', '!!!')] }),
]));
check('typeValidation', malformedType.diagnostics.some((entry) => entry.code === 'INVALID_SEMANTIC_TYPE'));
const duplicateConversion = compiler.compile(intent([{ verb: 'read', resource: 'customer', values: { customerId: { semanticType: 'legacy.id', value: 'legacy-1' } } }]), createEvidenceGraph([{ ...conversionEvidence.operations[1], valueConversions: [
  { id: 'same', fromSemanticType: 'legacy.id', toSemanticType: 'customer.id', safety: 'lossless' },
  { id: 'same', fromSemanticType: 'legacy.id', toSemanticType: 'customer.id', safety: 'lossless' },
] }]));
check('typeValidation', duplicateConversion.diagnostics.some((entry) => entry.code === 'OPERATION_NOT_EXECUTABLE'));

const validWorkflow = structuredClone(sourceResult.workflow);
const cycleSteps = validWorkflow.scenarios[0].steps;
cycleSteps[0].dependsOn = [cycleSteps[1].id];
cycleSteps[1].dependsOn = [cycleSteps[0].id];
const cycleDiagnostics = validateWorkflowInvariants(validWorkflow, sourceEvidence);
check('graphInvariants', cycleDiagnostics.some((entry) => entry.code === 'CIRCULAR_VALUE_DEPENDENCY'));
const duplicateStepWorkflow = structuredClone(sourceResult.workflow);
duplicateStepWorkflow.scenarios[0].steps[1].id = duplicateStepWorkflow.scenarios[0].steps[0].id;
check('graphInvariants', validateWorkflowInvariants(duplicateStepWorkflow, sourceEvidence).some((entry) => entry.code === 'DUPLICATE_STEP_ID'));
const duplicateInputWorkflow = structuredClone(sourceResult.workflow);
duplicateInputWorkflow.scenarios[0].steps[1].inputs.push(structuredClone(duplicateInputWorkflow.scenarios[0].steps[1].inputs[0]));
check('graphInvariants', validateWorkflowInvariants(duplicateInputWorkflow, sourceEvidence).some((entry) => entry.code === 'DUPLICATE_INPUT_BINDING'));
const unknownProducerWorkflow = structuredClone(sourceResult.workflow);
unknownProducerWorkflow.scenarios[0].steps[1].inputs[0].value.stepId = 'missing-step';
check('graphInvariants', validateWorkflowInvariants(unknownProducerWorkflow, sourceEvidence).some((entry) => entry.code === 'UNKNOWN_VALUE_PRODUCER'));
const lateProducerWorkflow = structuredClone(sourceResult.workflow);
lateProducerWorkflow.scenarios[0].steps[0].inputs = [{ inputSlotId: 'invented', value: { kind: 'output', semanticType: 'widget.id', stepId: lateProducerWorkflow.scenarios[0].steps[2].id, outputSlotId: 'widgetId' } }];
check('graphInvariants', validateWorkflowInvariants(lateProducerWorkflow, sourceEvidence).some((entry) => entry.code === 'VALUE_PRODUCED_TOO_LATE' || entry.code === 'UNKNOWN_INPUT_SLOT'));

const discoveredUiPlanner = new SemanticPlanner({
  name: 'discovered-ui-fixture',
  async complete() {
    return { content: JSON.stringify({
      scenarios: [{
        id: 'ui_pages',
        name: 'Core pages load',
        objective: 'Prove dashboard, channels, topics, and playground pages load.',
        actions: [
          { id: 'open_dashboard', verb: 'open', resource: 'dashboard page', capability: 'web.ui', expectedOutcomes: ['page.loaded'] },
          { id: 'open_channels', verb: 'open', resource: 'channels page', capability: 'web.ui', expectedOutcomes: ['page.loaded'] },
          { id: 'open_topics', verb: 'open', resource: 'topics page', capability: 'web.ui', expectedOutcomes: ['page.loaded'] },
          { id: 'open_playground', verb: 'open', resource: 'playground page', capability: 'web.ui', expectedOutcomes: ['page.loaded'] },
        ],
        invariants: [], evidenceRequired: ['observed pages'], cleanup: 'isolated',
      }], warnings: [],
    }) };
  },
});
const discoveredUiPlan = await discoveredUiPlanner.plan({
  config: {
    app: { name: 'UI discovery fixture', baseUrl: 'http://127.0.0.1:5173', env: 'test' },
    runtime: { artifactsDir: '.tmp', timeoutMs: 1000, retries: 0, headless: true, dryRun: true },
  },
  input: { goal: 'Open the four core pages', scenarios: 1, scenarioCountPolicy: 'exact' },
  runId: 'run_discovered_ui',
  discovery: {
    uiRoutes: [
      { path: '/dashboard', source: 'repo' },
      { path: '/channels', source: 'repo' },
      { path: '/topics', source: 'repo' },
      { path: '/playground', source: 'repo' },
      { path: '/playground/', source: 'runtime' },
    ],
    apiRoutes: [], contracts: [], warnings: [], discoveredAt: new Date(0).toISOString(),
  },
});
check('discoveredUi', discoveredUiPlan.scenarios.length === 4);
check('discoveredUi', discoveredUiPlan.scenarios.every((scenario) => scenario.type === 'ui'));
check('discoveredUi', discoveredUiPlan.scenarios.map((scenario) => scenario.target?.route).join(',') === '/dashboard,/channels,/topics,/playground');
check('discoveredUi', discoveredUiPlan.scenarios.every((scenario) => scenario.target?.sourceOfTruth === 'observed'));

let semanticRepairCalls = 0;
const semanticRepairEvidence = createEvidenceGraph([
  operation({ id: 'channel.list', adapterId: 'fixture', capability: 'api.http', name: 'List channels', action: 'list', resource: 'channel', sideEffect: 'read' }),
  operation({ id: 'channel-topic.list', adapterId: 'fixture', capability: 'data', name: 'List channel topics', action: 'list', resource: 'channel', sideEffect: 'read' }),
]);
const ambiguousListIntent = intent([{ verb: 'list', resource: 'channel' }], 'List channel information');
check('semanticRepair', compiler.compile(ambiguousListIntent, semanticRepairEvidence).status === 'ambiguous');
const semanticRepairPlanner = new SemanticPlanner({
  name: 'semantic-repair-fixture',
  async complete() {
    semanticRepairCalls += 1;
    return { content: JSON.stringify(semanticRepairCalls === 1 ? ambiguousListIntent : {
      repairs: [{
        scenarioId: 'typed_values', actionId: 'action_1',
        action: { id: 'action_1', verb: 'list', resource: 'channel', capability: 'data', expectedOutcomes: [] },
      }],
      warnings: [],
    }) };
  },
}, [{
  id: 'fixture', capabilities: ['api.http', 'data'],
  lower({ operation: selected }) {
    return [{ name: selected.name, type: 'api', objective: selected.name, target: { method: 'GET', path: `/${selected.id}`, sourceOfTruth: 'observed' }, expect: { status: 200 }, assertions: ['listed'], evidenceRequired: ['api'] }];
  },
}]);
const semanticRepairPlan = await semanticRepairPlanner.plan({
  config: { app: { name: 'repair fixture', env: 'test' }, planning: { repairAttempts: 1 }, runtime: { timeoutMs: 1000 } },
  input: { goal: 'List channel information', scenarios: 1, scenarioCountPolicy: 'exact', evidenceGraph: semanticRepairEvidence },
  runId: 'run_semantic_repair', discovery: { uiRoutes: [], apiRoutes: [], contracts: [], warnings: [], discoveredAt: new Date(0).toISOString() },
});
check('semanticRepair', semanticRepairCalls === 2);
check('semanticRepair', semanticRepairPlan.scenarios[0]?.target?.path === '/channel-topic.list');

const httpExpectationEvidence = createHttpEvidenceGraph([
  {
    operationId: 'widget.create', method: 'POST', path: '/api/widgets', name: 'Create widget', action: 'create', resource: 'widget', sideEffect: 'create',
    inputs: [{ id: 'body.name', name: 'name', location: 'body', semanticType: 'widget.name', required: true, generation: { kind: 'unique-string', prefix: 'widget' } }],
    outputs: [
      { id: 'response.id', name: 'id', semanticType: 'widget.id', from: 'response.body', path: "$['id']" },
      { id: 'response.name', name: 'name', semanticType: 'widget.name', from: 'response.body', path: "$['name']" },
    ],
    successStatuses: [201], authority: 'host', source: 'fixture',
  },
  {
    operationId: 'widget.read', method: 'GET', path: '/api/widgets/:widgetId', name: 'Read widget', action: 'read', resource: 'widget', sideEffect: 'read',
    inputs: [
      { id: 'path.widgetId', name: 'widgetId', location: 'path', semanticType: 'widget.id', required: true },
      { id: 'expect.name', name: 'name', location: 'expect.json', semanticType: 'widget.name', required: true },
    ],
    successStatuses: [200], unchanged: [{ target: { method: 'GET', path: '/api/widgets' } }], authority: 'host', source: 'fixture',
  },
]);
const httpExpectationCompilation = compiler.compile(intent([
  { id: 'create_widget', verb: 'create', resource: 'widget' },
  { id: 'read_widget', verb: 'read', resource: 'widget', values: {
    widgetId: { semanticType: 'widget.id', fromActionId: 'create_widget' },
    name: { semanticType: 'widget.name', fromActionId: 'create_widget' },
  } },
]), httpExpectationEvidence);
check('httpExpectation', httpExpectationCompilation.status === 'compiled', JSON.stringify(httpExpectationCompilation.diagnostics));
const httpExpectationLowered = await new WorkflowLowerer([new HostHttpCapabilityAdapter()]).lower({
  workflow: httpExpectationCompilation.workflow,
  evidence: httpExpectationEvidence,
});
// The placeholder is scoped by its producing step so two same-typed values can never mix.
check('httpExpectation', httpExpectationLowered.scenarios[1]?.expect?.json?.name === '<step_typed_values_create_widget_1.widgetName>');
check('httpExpectation', httpExpectationLowered.scenarios[1]?.expect?.unchanged?.[0]?.target.path === '/api/widgets');

// A synthesized cleanup step mirrors its source step's own bindings: the
// member created in account X is deleted from account X — even when a later
// read echoes another account.id output after the create.
const cleanupMirrorEvidence = createEvidenceGraph([
  operation({ id: 'account.list', adapterId: 'fixture', capability: 'custom.fixture', name: 'List accounts', action: 'list', resource: 'account', sideEffect: 'read', outputs: [slot('accountId', 'account.id', { required: false })] }),
  operation({ id: 'member.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create member', action: 'create', resource: 'member', sideEffect: 'create', inputs: [slot('accountId', 'account.id')], outputs: [slot('memberId', 'member.id', { required: false })], cleanupOperationId: 'member.delete' }),
  operation({ id: 'member.delete', adapterId: 'fixture', capability: 'custom.fixture', name: 'Delete member', action: 'delete', resource: 'member', sideEffect: 'delete', inputs: [slot('accountId', 'account.id'), slot('memberId', 'member.id')] }),
]);
const cleanupMirror = compiler.compile({
  schemaVersion: 'brisk-aitesting.intent.v1', goal: 'Member lifecycle stays clean', warnings: [], scenarios: [{
    id: 'member_lifecycle', name: 'Member lifecycle', objective: 'Member lifecycle stays clean',
    actions: [
      { id: 'action_1', verb: 'list', resource: 'account', expectedOutcomes: [] },
      { id: 'action_2', verb: 'create', resource: 'member', expectedOutcomes: [] },
      { id: 'action_3', verb: 'list', resource: 'account', expectedOutcomes: [] },
    ],
    invariants: [], evidenceRequired: [], cleanup: 'automatic',
  }],
}, cleanupMirrorEvidence);
check('cleanupMirror', cleanupMirror.status === 'compiled', JSON.stringify(cleanupMirror.diagnostics));
const cleanupMirrorSteps = cleanupMirror.workflow?.scenarios[0]?.steps ?? [];
const cleanupStep = cleanupMirrorSteps.find((step) => step.phase === 'cleanup');
const cleanupAccountBinding = cleanupStep?.inputs.find((input) => input.value.semanticType === 'account.id')?.value;
check('cleanupMirror', cleanupAccountBinding?.stepId === 'step_member_lifecycle_action_1_1', JSON.stringify(cleanupAccountBinding));
const cleanupMemberBinding = cleanupStep?.inputs.find((input) => input.value.semanticType === 'member.id')?.value;
check('cleanupMirror', cleanupMemberBinding?.stepId === 'step_member_lifecycle_action_2_2');

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.typed-value-flow-smoke.v1',
  categories,
  checks,
  failures: 0,
  skips: 0,
}, null, 2));
