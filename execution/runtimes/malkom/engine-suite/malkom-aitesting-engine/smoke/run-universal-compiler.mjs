import assert from 'node:assert/strict';
import {
  OpenApiCapabilityAdapter,
  UniversalSemanticCompiler,
  WorkflowLowerer,
  createEvidenceGraph,
} from '../dist/index.js';

const compiler = new UniversalSemanticCompiler();
const authority = (source, authority = 'contract') => [{ authority, source, confidence: 1 }];
const outcome = (id, meaning = id) => ({ id, meaning, successful: true });
const slot = (id, semanticType, options = {}) => ({
  id,
  name: id,
  semanticType,
  required: options.required ?? true,
  ...(options.generation === undefined ? {} : { generation: options.generation }),
});
const operation = (value) => ({
  inputs: [],
  outputs: [],
  outcomes: [outcome('succeeded')],
  sideEffect: 'none',
  provenance: authority(`${value.adapterId}:${value.id}`),
  binding: { adapterOwned: true, deliberatelyOpaque: true },
  ...value,
});
const intent = (goal, actions, cleanup = 'automatic') => ({
  schemaVersion: 'brisk-aitesting.intent.v1',
  goal,
  warnings: [],
  scenarios: [{
    id: 'scenario_1',
    name: goal,
    objective: goal,
    actions: actions.map((action, index) => ({
      id: `action_${index + 1}`,
      expectedOutcomes: [],
      ...action,
    })),
    invariants: [],
    evidenceRequired: [],
    cleanup,
  }],
});

const cases = [
  {
    name: 'REST resource workflow',
    intent: intent('Create and inspect a customer', [
      { verb: 'create', resource: 'customer' },
      { verb: 'read', resource: 'customer' },
    ]),
    operations: [
      operation({
        id: 'customer.create',
        adapterId: 'openapi',
        capability: 'api.http',
        name: 'Create customer',
        action: 'create',
        resource: 'customer',
        sideEffect: 'create',
        inputs: [slot('customer.name', 'customer.name', { generation: { kind: 'unique-string', prefix: 'customer' } })],
        outputs: [slot('customer.id', 'customer.id', { required: false })],
        cleanupOperationId: 'customer.delete',
      }),
      operation({
        id: 'customer.read',
        adapterId: 'openapi',
        capability: 'api.http',
        name: 'Read customer',
        action: 'read',
        resource: 'customer',
        sideEffect: 'read',
        inputs: [slot('customer.id', 'customer.id')],
      }),
      operation({
        id: 'customer.delete',
        adapterId: 'openapi',
        capability: 'api.http',
        name: 'Delete customer',
        action: 'delete',
        resource: 'customer',
        sideEffect: 'delete',
        inputs: [slot('customer.id', 'customer.id')],
      }),
    ],
    expectedCapabilities: ['api.http'],
    expectedSteps: 3,
  },
  {
    name: 'GraphQL mutation and query',
    intent: intent('Create and retrieve a book', [
      { verb: 'create', resource: 'book' },
      { verb: 'read', resource: 'book' },
    ]),
    operations: [
      operation({
        id: 'mutation.addBook',
        adapterId: 'graphql',
        capability: 'api.graphql',
        name: 'addBook mutation',
        action: 'create',
        resource: 'book',
        sideEffect: 'create',
        inputs: [slot('book.title', 'book.title', { generation: { kind: 'unique-string', prefix: 'book' } })],
        outputs: [slot('book.id', 'book.id', { required: false })],
        cleanupOperationId: 'mutation.deleteBook',
      }),
      operation({
        id: 'query.book',
        adapterId: 'graphql',
        capability: 'api.graphql',
        name: 'book query',
        action: 'read',
        resource: 'book',
        sideEffect: 'read',
        inputs: [slot('book.id', 'book.id')],
      }),
      operation({
        id: 'mutation.deleteBook',
        adapterId: 'graphql',
        capability: 'api.graphql',
        name: 'deleteBook mutation',
        action: 'delete',
        resource: 'book',
        sideEffect: 'delete',
        inputs: [slot('book.id', 'book.id')],
      }),
    ],
    expectedCapabilities: ['api.graphql'],
    expectedSteps: 3,
  },
  {
    name: 'Event publish and consume',
    intent: intent('Publish and receive an order event', [
      { verb: 'publish', resource: 'order event' },
      { verb: 'consume', resource: 'order event' },
    ], 'isolated'),
    operations: [
      operation({
        id: 'orders.publish',
        adapterId: 'asyncapi',
        capability: 'messaging',
        name: 'Publish order event',
        action: 'publish',
        resource: 'order event',
        sideEffect: 'external',
        inputs: [slot('order.payload', 'order.payload', { generation: { kind: 'constant', value: { kind: 'created' } } })],
        outputs: [slot('event.correlationId', 'event.correlation.id', { required: false })],
      }),
      operation({
        id: 'orders.consume',
        adapterId: 'asyncapi',
        capability: 'messaging',
        name: 'Consume order event',
        action: 'consume',
        resource: 'order event',
        sideEffect: 'read',
        inputs: [slot('event.correlationId', 'event.correlation.id')],
      }),
    ],
    expectedCapabilities: ['messaging'],
    expectedSteps: 2,
  },
  {
    name: 'Browser accessibility workflow',
    intent: intent('Open and submit a registration form', [
      { verb: 'navigate', resource: 'registration form' },
      { verb: 'submit', resource: 'registration form' },
    ], 'isolated'),
    operations: [
      operation({
        id: 'registration.open',
        adapterId: 'playwright-accessibility',
        capability: 'web.ui',
        name: 'Open registration form',
        action: 'navigate',
        resource: 'registration form',
        sideEffect: 'read',
        outputs: [slot('registration.form', 'ui.registration.form', { required: false })],
      }),
      operation({
        id: 'registration.submit',
        adapterId: 'playwright-accessibility',
        capability: 'web.ui',
        name: 'Submit registration form',
        action: 'submit',
        resource: 'registration form',
        sideEffect: 'external',
        inputs: [slot('registration.form', 'ui.registration.form')],
      }),
    ],
    expectedCapabilities: ['web.ui'],
    expectedSteps: 2,
  },
  {
    name: 'Proprietary CLI extension',
    intent: intent('Provision and inspect a sandbox', [
      { verb: 'create', resource: 'sandbox' },
      { verb: 'read', resource: 'sandbox' },
    ], 'isolated'),
    operations: [
      operation({
        id: 'sandbox.provision',
        adapterId: 'vendor-sandbox-cli',
        capability: 'custom.vendor-sandbox',
        name: 'Provision sandbox',
        action: 'create',
        resource: 'sandbox',
        sideEffect: 'create',
        outputs: [slot('sandbox.id', 'sandbox.id', { required: false })],
      }),
      operation({
        id: 'sandbox.inspect',
        adapterId: 'vendor-sandbox-cli',
        capability: 'custom.vendor-sandbox',
        name: 'Inspect sandbox',
        action: 'read',
        resource: 'sandbox',
        sideEffect: 'read',
        inputs: [slot('sandbox.id', 'sandbox.id')],
      }),
    ],
    expectedCapabilities: ['custom.vendor-sandbox'],
    expectedSteps: 2,
  },
];

const reports = [];
for (const proof of cases) {
  const result = compiler.compile(proof.intent, createEvidenceGraph(proof.operations));
  assert.equal(result.status, 'compiled', `${proof.name}: ${JSON.stringify(result.diagnostics)}`);
  assert.ok(result.workflow);
  const steps = result.workflow.scenarios[0]?.steps ?? [];
  assert.equal(steps.length, proof.expectedSteps, proof.name);
  assert.deepEqual([...new Set(steps.map((step) => step.capability))], proof.expectedCapabilities, proof.name);
  assert.equal(steps.slice(1).every((step) => step.dependsOn.length > 0), true, `${proof.name} must carry typed value dependencies`);
  const serialized = JSON.stringify(result.workflow);
  assert.equal(/\b(GET|POST|PUT|PATCH|DELETE)\b|https?:\/\/|css=|xpath=/.test(serialized), false, `${proof.name} leaked adapter syntax into Workflow IR`);
  reports.push({ name: proof.name, status: result.status, steps: steps.length });
}

const missingValue = compiler.compile(
  intent('Create a tenant without required organization evidence', [{ verb: 'create', resource: 'tenant' }], 'isolated'),
  createEvidenceGraph([
    operation({
      id: 'tenant.create',
      adapterId: 'generic',
      capability: 'api.http',
      name: 'Create tenant',
      action: 'create',
      resource: 'tenant',
      sideEffect: 'create',
      inputs: [slot('organization.id', 'organization.id')],
      outputs: [slot('tenant.id', 'tenant.id', { required: false })],
    }),
  ]),
);
assert.equal(missingValue.status, 'needs-evidence');
assert.equal(missingValue.diagnostics.some((entry) => entry.code === 'MISSING_REQUIRED_VALUE' && entry.missingSemanticType === 'organization.id'), true);

const unsafeHeuristic = compiler.compile(
  intent('Delete a customer using guessed evidence', [{ verb: 'delete', resource: 'customer', values: { id: { semanticType: 'customer.id', value: 'customer-1' } } }], 'manual'),
  createEvidenceGraph([
    operation({
      id: 'customer.guessed-delete',
      adapterId: 'source-guess',
      capability: 'api.http',
      name: 'Guessed delete customer',
      action: 'delete',
      resource: 'customer',
      sideEffect: 'delete',
      inputs: [slot('customer.id', 'customer.id')],
      provenance: authority('regex guess', 'heuristic'),
    }),
  ]),
);
assert.equal(unsafeHeuristic.status, 'needs-evidence');
assert.equal(unsafeHeuristic.diagnostics.some((entry) => entry.code === 'OPERATION_NOT_EXECUTABLE'), true);

const ambiguous = compiler.compile(
  intent('Create an account', [{ verb: 'create', resource: 'account' }], 'isolated'),
  createEvidenceGraph([
    operation({
      id: 'account.create.primary',
      adapterId: 'one',
      capability: 'api.http',
      name: 'Create account primary',
      action: 'create',
      resource: 'account',
      sideEffect: 'create',
    }),
    operation({
      id: 'account.create.secondary',
      adapterId: 'two',
      capability: 'api.graphql',
      name: 'Create account secondary',
      action: 'create',
      resource: 'account',
      sideEffect: 'create',
    }),
  ]),
);
assert.equal(ambiguous.status, 'ambiguous');

const openApiAdapter = new OpenApiCapabilityAdapter();
const todoEvidence = await openApiAdapter.loadEvidence('reference-apps/todo/openapi.json');
const todoCompilation = compiler.compile(
  intent('Create a todo from a real OpenAPI contract', [{ verb: 'create', resource: 'todo' }], 'isolated'),
  todoEvidence,
);
assert.equal(todoCompilation.status, 'compiled', JSON.stringify(todoCompilation.diagnostics));
assert.ok(todoCompilation.workflow);
const todoLowered = await new WorkflowLowerer([openApiAdapter]).lower({
  workflow: todoCompilation.workflow,
  evidence: todoEvidence,
});
assert.equal(todoLowered.scenarios.length, 1);
assert.equal(todoLowered.scenarios[0]?.target?.method, 'POST');
assert.equal(todoLowered.scenarios[0]?.target?.path, '/api/todos');
assert.equal(typeof todoLowered.scenarios[0]?.request?.body?.title, 'string');

const eventEvidence = await openApiAdapter.loadEvidence('reference-apps/event-messaging/openapi.json');
const eventCompilation = compiler.compile(
  intent('Create a channel, create a topic, and publish a message', [
    { verb: 'create', resource: 'channel' },
    { verb: 'create', resource: 'topic' },
    { verb: 'publish', resource: 'message' },
  ], 'isolated'),
  eventEvidence,
);
assert.equal(eventCompilation.status, 'compiled', JSON.stringify(eventCompilation.diagnostics));
assert.ok(eventCompilation.workflow);
const eventLowered = await new WorkflowLowerer([openApiAdapter]).lower({
  workflow: eventCompilation.workflow,
  evidence: eventEvidence,
});
assert.equal(eventLowered.scenarios.length, 3);
assert.equal(eventLowered.scenarios[0]?.target?.path, '/api/channels');
// Placeholders carry the producing step's identity so same-typed values never mix.
assert.equal(eventLowered.scenarios[1]?.target?.path, '/api/channels/<step_scenario_1_action_1_1.channelId>/topics');
assert.equal(eventLowered.scenarios[2]?.target?.path, '/api/topics/<step_scenario_1_action_2_2.topicId>/messages');
assert.deepEqual(eventLowered.scenarios.map((scenario) => scenario.expect?.status), [201, 201, 202]);
assert.equal(eventLowered.scenarios[1]?.dependsOn?.includes(eventLowered.scenarios[0]?.id ?? ''), true);
assert.equal(eventLowered.scenarios[2]?.dependsOn?.includes(eventLowered.scenarios[1]?.id ?? ''), true);

const cleanupEvidence = await openApiAdapter.loadEvidence('fixtures/compiler/openapi-cleanup.json');
const cleanupCompilation = compiler.compile(
  intent('Create a widget and restore state', [{ verb: 'create', resource: 'widget' }], 'automatic'),
  cleanupEvidence,
);
assert.equal(cleanupCompilation.status, 'compiled', JSON.stringify(cleanupCompilation.diagnostics));
assert.ok(cleanupCompilation.workflow);
assert.equal(cleanupCompilation.workflow.scenarios[0]?.cleanupStepIds.length, 1);
const cleanupLowered = await new WorkflowLowerer([openApiAdapter]).lower({
  workflow: cleanupCompilation.workflow,
  evidence: cleanupEvidence,
});
assert.equal(cleanupLowered.scenarios.length, 1, 'compiler cleanup operations must lower as compensation, not extra tests');
assert.equal(cleanupLowered.scenarios[0]?.cleanup?.[0]?.target.method, 'DELETE');
assert.equal(cleanupLowered.scenarios[0]?.cleanup?.[0]?.target.path, '/api/widgets/<step_scenario_1_action_1_1.widgetId>');
assert.equal(cleanupLowered.scenarios[0]?.cleanup?.[0]?.expect?.status, 204);

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.universal-compiler-smoke.v1',
  status: 'passed',
  proofCases: reports,
  safetyCases: [
    { name: 'missing typed input', status: missingValue.status },
    { name: 'heuristic mutation authority', status: unsafeHeuristic.status },
    { name: 'ambiguous operation', status: ambiguous.status },
  ],
  realAdapterCases: [
    { name: 'OpenAPI todo compilation and lowering', status: todoCompilation.status, scenarios: todoLowered.scenarios.length },
    { name: 'OpenAPI event workflow value flow', status: eventCompilation.status, scenarios: eventLowered.scenarios.length },
    { name: 'OpenAPI automatic cleanup lowering', status: cleanupCompilation.status, scenarios: cleanupLowered.scenarios.length },
  ],
}, null, 2));
