import assert from 'node:assert/strict';
import {
  UniversalSemanticCompiler,
  createEvidenceGraph,
  defineHostConfig,
  findCleanupSafeProducer,
  validatePlanJsonContract,
  resultJsonSchema,
} from '../dist/index.js';

const compiler = new UniversalSemanticCompiler();
const authority = (source, kind = 'host') => [{ authority: kind, source, confidence: 1 }];
const outcome = (id, meaning = id) => ({ id, meaning, successful: true });
const slot = (id, name, semanticType, options = {}) => ({
  id,
  name,
  semanticType,
  required: options.required ?? true,
  ...(options.generation === undefined ? {} : { generation: options.generation }),
});
const operation = (value) => ({
  capability: 'api.http',
  adapterId: 'host-http',
  inputs: [],
  outputs: [],
  outcomes: [outcome('succeeded')],
  sideEffect: 'none',
  provenance: authority(`host:${value.id}`),
  binding: { adapterOwned: true },
  ...value,
});
const intent = (goal, actions, cleanup = 'automatic') => ({
  schemaVersion: 'brisk-aitesting.intent.v1',
  goal,
  warnings: [],
  scenarios: [{
    id: 'check_1',
    name: goal,
    objective: goal,
    actions: actions.map((action, index) => ({ id: `action_${index + 1}`, expectedOutcomes: [], ...action })),
    invariants: [],
    evidenceRequired: [],
    cleanup,
  }],
});

const orgCreate = operation({
  id: 'org.create',
  name: 'Create organization',
  action: 'create',
  resource: 'organization',
  sideEffect: 'create',
  inputs: [slot('body.name', 'name', 'organization.name', { generation: { kind: 'unique-string', prefix: 'org' } })],
  outputs: [slot('response.id', 'id', 'organization.id', { required: false })],
  cleanupOperationId: 'org.delete',
});
const orgDelete = operation({
  id: 'org.delete',
  name: 'Delete organization',
  action: 'delete',
  resource: 'organization',
  sideEffect: 'delete',
  inputs: [slot('path.id', 'id', 'organization.id')],
});
const orgUpdate = operation({
  id: 'org.update',
  name: 'Rename organization',
  action: 'update',
  resource: 'organization',
  sideEffect: 'update',
  inputs: [
    slot('path.id', 'id', 'organization.id'),
    slot('body.name', 'name', 'organization.name', { generation: { kind: 'unique-string', prefix: 'org' } }),
  ],
});
const orgList = operation({
  id: 'org.list',
  name: 'List organizations',
  action: 'list',
  resource: 'organization',
  sideEffect: 'read',
  outputs: [slot('response.first.id', 'id', 'organization.id', { required: false })],
});

const updateIntent = intent('Rename an organization', [{ verb: 'update', resource: 'organization' }]);

// 1. provision-when-missing + cleanup-safe producer: the compiler synthesizes
//    a fixture setup step, binds the consumer to its output, and attaches
//    automatic cleanup — the workflow compiles instead of failing.
{
  const evidence = createEvidenceGraph([orgCreate, orgDelete, orgUpdate]);
  const result = compiler.compile(updateIntent, evidence, { fixtures: 'provision-when-missing' });
  assert.equal(result.status, 'compiled', JSON.stringify(result.diagnostics));
  const scenario = result.workflow.scenarios[0];
  const fixtureStep = scenario.steps.find((step) => step.id.startsWith('step_fixture_'));
  assert.ok(fixtureStep, 'a fixture setup step must be synthesized');
  assert.equal(fixtureStep.phase, 'setup');
  assert.equal(fixtureStep.operationId, 'org.create');
  const updateStep = scenario.steps.find((step) => step.operationId === 'org.update');
  const idInput = updateStep.inputs.find((input) => input.value.kind === 'output');
  assert.equal(idInput.value.stepId, fixtureStep.id, 'the consumer must read the fixture output');
  assert.equal(scenario.cleanupStepIds.length, 1, 'the fixture must have exactly one cleanup step');
  const cleanupStep = scenario.steps.find((step) => step.id === scenario.cleanupStepIds[0]);
  assert.equal(cleanupStep.operationId, 'org.delete');
  assert.equal(result.fixtureProvisioning.length, 1);
  assert.equal(result.fixtureProvisioning[0].outcome, 'provisioned');
  assert.equal(result.fixtureProvisioning[0].producerOperationId, 'org.create');
  assert.equal(result.fixtureProvisioning[0].cleanupOperationId, 'org.delete');
  assert.match(result.fixtureProvisioning[0].id, /^fixture_[a-f0-9]{24}$/);
}

// 2. provision-when-missing but no cleanup declared: honest refusal with a
//    real diagnosis, never a fixture that would leave residue.
{
  const evidence = createEvidenceGraph([{ ...orgCreate, cleanupOperationId: undefined }, orgUpdate]);
  const result = compiler.compile(updateIntent, evidence, { fixtures: 'provision-when-missing' });
  assert.notEqual(result.status, 'compiled');
  assert.ok(result.diagnostics.some((entry) => entry.code === 'NO_CLEANUP_SAFE_PRODUCER'));
  assert.ok(result.diagnostics.some((entry) => entry.code === 'MISSING_REQUIRED_VALUE'));
  assert.equal(result.fixtureProvisioning[0].outcome, 'no-cleanup-safe-producer');
  assert.match(result.fixtureProvisioning[0].explanation, /cleanupOperationId/);
}

// 3. require-existing (the default): behavior is unchanged — no fixture steps,
//    no invented mutations, only the standard missing-value diagnostic.
{
  const evidence = createEvidenceGraph([orgCreate, orgDelete, orgUpdate]);
  const result = compiler.compile(updateIntent, evidence);
  assert.notEqual(result.status, 'compiled');
  assert.ok(result.diagnostics.some((entry) => entry.code === 'MISSING_REQUIRED_VALUE'));
  assert.ok(!result.diagnostics.some((entry) => entry.code === 'NO_CLEANUP_SAFE_PRODUCER'));
  assert.equal(result.fixtureProvisioning, undefined);
}

// 4. Heuristic-only producers are never used for provisioning.
{
  const weakCreate = { ...orgCreate, provenance: [{ authority: 'heuristic', source: 'guess', confidence: 0.4 }] };
  const search = findCleanupSafeProducer('organization.id', createEvidenceGraph([weakCreate, orgDelete]));
  assert.equal(search.kind, 'unavailable');
  assert.match(search.explanation, /host or contract authority/);
}

// 5. forceProvisionSemanticTypes (set after a live probe proved the list is
//    empty): the read-sourced binding is replaced by a provisioned fixture.
{
  const listIntent = intent('Rename the first listed organization', [
    { verb: 'list', resource: 'organization' },
    { verb: 'update', resource: 'organization' },
  ]);
  const evidence = createEvidenceGraph([orgCreate, orgDelete, orgUpdate, orgList]);
  const fromList = compiler.compile(listIntent, evidence, { fixtures: 'provision-when-missing' });
  assert.equal(fromList.status, 'compiled', JSON.stringify(fromList.diagnostics));
  const listScenario = fromList.workflow.scenarios[0];
  const listStep = listScenario.steps.find((step) => step.operationId === 'org.list');
  const consumerFromList = listScenario.steps.find((step) => step.operationId === 'org.update');
  assert.equal(consumerFromList.inputs.find((input) => input.value.kind === 'output').value.stepId, listStep.id);

  const forced = compiler.compile(listIntent, evidence, {
    fixtures: 'provision-when-missing',
    forceProvisionSemanticTypes: new Set(['organization.id']),
  });
  assert.equal(forced.status, 'compiled', JSON.stringify(forced.diagnostics));
  const forcedScenario = forced.workflow.scenarios[0];
  const forcedConsumer = forcedScenario.steps.find((step) => step.operationId === 'org.update');
  const forcedBinding = forcedConsumer.inputs.find((input) => input.value.kind === 'output');
  assert.ok(forcedBinding.value.stepId.startsWith('step_fixture_'), 'a probed-empty list must be replaced by a fixture');
  assert.equal(forced.fixtureProvisioning[0].outcome, 'provisioned');
}

// 6. The plan contract accepts (and strictly shapes) fixtureProvisioning records.
{
  const plan = {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId: 'run_test',
    goal: 'goal',
    mode: 'automatic',
    warnings: [],
    createdAt: new Date().toISOString(),
    discovery: {
      schemaVersion: 'brisk-aitesting.discovery.v1',
      app: { name: 'app', baseUrl: 'http://localhost:3000' },
      uiRoutes: [], apiRoutes: [], contracts: [], repoSignals: [], warnings: [],
      createdAt: new Date().toISOString(),
    },
    scenarios: [{
      id: 'compiled_1',
      name: 'Check',
      type: 'api',
      objective: 'objective',
      assertions: ['ok'],
      evidenceRequired: ['api'],
    }],
    fixtureProvisioning: [{
      schemaVersion: 'brisk-aitesting.fixture-provisioning.v1',
      id: `fixture_${'a'.repeat(24)}`,
      scenarioId: 'check_1',
      semanticType: 'organization.id',
      policy: 'provision-when-missing',
      outcome: 'provisioned',
      explanation: 'Provisioned via org.create, removed by org.delete.',
      producerOperationId: 'org.create',
      cleanupOperationId: 'org.delete',
      probe: { method: 'GET', path: '/api/organizations', status: 'empty', httpStatus: 200, checkedAt: new Date().toISOString() },
    }],
  };
  const issues = validatePlanJsonContract(plan);
  assert.deepEqual(issues, [], JSON.stringify(issues));
  const badIssues = validatePlanJsonContract({
    ...plan,
    fixtureProvisioning: [{ ...plan.fixtureProvisioning[0], outcome: 'made-up-outcome' }],
  });
  assert.ok(badIssues.length > 0, 'unsupported outcomes must be rejected');
}

// 7. The result contract knows the precondition failure category end to end.
{
  assert.ok(resultJsonSchema.$defs.scenarioResult.properties.failureCategory.enum.includes('precondition'));
  assert.ok(resultJsonSchema.properties.outcome.properties.issues.items.properties.category.enum.includes('precondition'));
}

// 8. The host switch reaches planning config, from code and from environment.
{
  const fromCode = await defineHostConfig(
    { app: { name: 'app', baseUrl: 'http://localhost:3000' }, fixtures: 'provision-when-missing' },
    { environment: {} },
  );
  assert.equal(fromCode.planning?.fixtures, 'provision-when-missing');
  const fromEnvironment = await defineHostConfig(
    { app: { name: 'app', baseUrl: 'http://localhost:3000' } },
    { environment: { BRISK_AITESTING_FIXTURES: 'require-existing' } },
  );
  assert.equal(fromEnvironment.planning?.fixtures, 'require-existing');
  const unset = await defineHostConfig(
    { app: { name: 'app', baseUrl: 'http://localhost:3000' } },
    { environment: {} },
  );
  assert.equal(unset.planning?.fixtures, undefined);
  await assert.rejects(
    () => defineHostConfig(
      { app: { name: 'app', baseUrl: 'http://localhost:3000' } },
      { environment: { BRISK_AITESTING_FIXTURES: 'always' } },
    ),
    /fixtures or BRISK_AITESTING_FIXTURES/,
  );
}

console.log('fixture-provisioning smoke passed');
