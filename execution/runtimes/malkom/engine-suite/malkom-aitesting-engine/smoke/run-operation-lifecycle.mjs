import assert from 'node:assert/strict';
import { UniversalSemanticCompiler, WorkflowLowerer, createEvidenceGraph, validateWorkflowInvariants } from '../dist/index.js';

const categories = {};
let checks = 0;
const check = (category, condition, message) => {
  assert.equal(condition, true, message);
  categories[category] = (categories[category] ?? 0) + 1;
  checks += 1;
};
const compiler = new UniversalSemanticCompiler();
const provenance = (authority = 'contract') => [{ authority, source: `${authority}-fixture`, confidence: 1 }];
const operation = (value) => ({
  inputs: [], outputs: [], sideEffect: 'none', binding: { fixture: true }, provenance: provenance(),
  outcomes: [{ id: 'ok', meaning: 'operation succeeds', successful: true }, { id: 'denied', meaning: 'operation is denied', successful: false }],
  ...value,
});
const scenario = (actions, cleanup = 'isolated', id = 'lifecycle') => ({
  id, name: id, objective: id, actions: actions.map((action, index) => ({ id: `action_${index + 1}`, expectedOutcomes: [], ...action })),
  invariants: [], evidenceRequired: [], cleanup,
});
const intent = (scenarios) => ({ schemaVersion: 'brisk-aitesting.intent.v1', goal: 'Prove lifecycle selection', warnings: [], scenarios });

const phaseEvidence = createEvidenceGraph([
  operation({ id: 'tenant.prepare', adapterId: 'fixture', capability: 'custom.fixture', name: 'Prepare tenant', action: 'prepare', resource: 'tenant' }),
  operation({ id: 'tenant.exercise', adapterId: 'fixture', capability: 'custom.fixture', name: 'Exercise tenant', action: 'exercise', resource: 'tenant' }),
  operation({ id: 'tenant.verify', adapterId: 'fixture', capability: 'custom.fixture', name: 'Verify tenant', action: 'verify', resource: 'tenant', sideEffect: 'read' }),
]);
const phaseIntent = intent([scenario([
  { verb: 'prepare', resource: 'tenant', phase: 'setup' },
  { verb: 'exercise', resource: 'tenant' },
  { verb: 'verify', resource: 'tenant', phase: 'verification', expectedOutcomes: ['ok'] },
])]);
const phases = compiler.compile(phaseIntent, phaseEvidence);
check('lifecyclePhases', phases.status === 'compiled', JSON.stringify(phases.diagnostics));
check('lifecyclePhases', JSON.stringify(phases.workflow?.scenarios[0]?.steps.map((step) => step.phase)) === JSON.stringify(['setup', 'test', 'verification']));
check('logicalScenario', phases.workflow?.scenarios.length === 1);
check('logicalScenario', phases.workflow?.scenarios[0]?.steps.length === 3);
check('logicalScenario', phases.workflow?.scenarios[0]?.steps.map((step) => step.intentActionId).join(',') === 'action_1,action_2,action_3');
check('outcomes', JSON.stringify(phases.workflow?.scenarios[0]?.steps[2]?.expectedOutcomeIds) === JSON.stringify(['ok']));

const heuristicRead = compiler.compile(intent([scenario([{ verb: 'read', resource: 'report' }])]), createEvidenceGraph([
  operation({ id: 'report.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read report', action: 'read', resource: 'report', sideEffect: 'read', provenance: provenance('heuristic') }),
]));
check('authority', heuristicRead.status === 'needs-evidence');
check('authority', heuristicRead.diagnostics.some((entry) => entry.code === 'OPERATION_NOT_EXECUTABLE'));
const sourceRead = compiler.compile(intent([scenario([{ verb: 'read', resource: 'report' }])]), createEvidenceGraph([
  operation({ id: 'report.read', adapterId: 'fixture', capability: 'custom.fixture', name: 'Read report', action: 'read', resource: 'report', sideEffect: 'read', provenance: provenance('source') }),
]));
check('authority', sourceRead.status === 'compiled');
const heuristicMutation = compiler.compile(intent([scenario([{ verb: 'create', resource: 'report' }])]), createEvidenceGraph([
  operation({ id: 'report.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create report', action: 'create', resource: 'report', sideEffect: 'create', provenance: provenance('heuristic') }),
]));
check('authority', heuristicMutation.status === 'needs-evidence');

const unknownOutcome = compiler.compile(intent([scenario([{ verb: 'verify', resource: 'tenant', expectedOutcomes: ['not-declared'] }])]), phaseEvidence);
check('outcomes', unknownOutcome.diagnostics.some((entry) => entry.code === 'UNPROVEN_EXPECTED_OUTCOME'));
const duplicateOutcomes = compiler.compile(intent([scenario([{ verb: 'verify', resource: 'tenant' }])]), createEvidenceGraph([{ ...phaseEvidence.operations[2], outcomes: [
  { id: 'same', meaning: 'yes', successful: true }, { id: 'same', meaning: 'no', successful: false },
] }]));
check('outcomes', duplicateOutcomes.diagnostics.some((entry) => entry.code === 'OPERATION_NOT_EXECUTABLE'));

const first = compiler.compile(phaseIntent, phaseEvidence);
const second = compiler.compile(phaseIntent, phaseEvidence);
check('stableIdentity', first.workflow?.id === second.workflow?.id);
check('stableIdentity', first.workflow?.id?.startsWith('workflow_') === true);
check('stableIdentity', first.workflow?.scenarios[0]?.id === second.workflow?.scenarios[0]?.id);
check('stableIdentity', JSON.stringify(first.workflow?.scenarios[0]?.steps.map((step) => step.id)) === JSON.stringify(second.workflow?.scenarios[0]?.steps.map((step) => step.id)));
const reversedEvidence = { ...phaseEvidence, operations: [...phaseEvidence.operations].reverse() };
check('stableIdentity', compiler.compile(phaseIntent, reversedEvidence).workflow?.id === first.workflow?.id);

const decisions = first.workflow?.selectionDecisions ?? [];
check('decisionRecord', decisions.length === 3);
check('decisionRecord', decisions.every((decision) => decision.schemaVersion === 'brisk-aitesting.workflow-selection-decision.v1'));
check('decisionRecord', decisions.every((decision) => decision.evidenceRevision === phaseEvidence.revision));
check('decisionRecord', decisions.every((decision) => decision.candidates.some((candidate) => candidate.operationId === decision.selectedOperationId)));
check('decisionRecord', decisions.map((decision) => decision.phase).join(',') === 'setup,test,verification');
check('decisionRecord', decisions.every((decision) => decision.provenance.length > 0));

const cleanupEvidence = createEvidenceGraph([
  operation({ id: 'widget.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create widget', action: 'create', resource: 'widget', sideEffect: 'create', cleanupOperationId: 'widget.delete', outputs: [{ id: 'widgetId', name: 'widgetId', semanticType: 'widget.id', required: false }] }),
  operation({ id: 'widget.delete', adapterId: 'fixture', capability: 'custom.fixture', name: 'Delete widget', action: 'delete', resource: 'widget', sideEffect: 'delete', inputs: [{ id: 'widgetId', name: 'widgetId', semanticType: 'widget.id', required: true }] }),
]);
const cleanupIntent = intent([scenario([{ verb: 'create', resource: 'widget' }], 'automatic')]);
const cleanupResult = compiler.compile(cleanupIntent, cleanupEvidence);
check('lifecyclePhases', cleanupResult.status === 'compiled', JSON.stringify(cleanupResult.diagnostics));
check('lifecyclePhases', cleanupResult.workflow?.scenarios[0]?.steps.map((step) => step.phase).join(',') === 'test,cleanup');
check('decisionRecord', cleanupResult.workflow?.selectionDecisions[1]?.selectionReason === 'declared-cleanup-operation');
check('stableIdentity', compiler.compile(cleanupIntent, cleanupEvidence).workflow?.id === cleanupResult.workflow?.id);
const cleanupSafety = cleanupResult.workflow?.cleanupSafetyRecords[0];
check('cleanupSafety', cleanupResult.workflow?.cleanupSafetyRecords.length === 1);
check('cleanupSafety', cleanupSafety?.schemaVersion === 'brisk-aitesting.workflow-cleanup-safety.v1');
check('cleanupSafety', cleanupSafety?.sourceOperationId === 'widget.create' && cleanupSafety?.cleanupOperationId === 'widget.delete');
check('cleanupSafety', cleanupSafety?.requiredValues[0]?.sourceKind === 'step-output');
check('cleanupSafety', cleanupSafety?.requiredValues[0]?.producerStepId === cleanupResult.workflow?.scenarios[0]?.steps[0]?.id);
check('cleanupSafety', cleanupSafety?.requiredValues[0]?.outputSlotId === 'widgetId');
check('cleanupSafety', cleanupSafety?.expectedOutcomeIds.join(',') === 'ok');
check('cleanupSafety', cleanupSafety?.recoveryPolicy === 'cleanup-only-no-unknown-mutation-replay');
const alteredCleanupSafety = structuredClone(cleanupResult.workflow);
alteredCleanupSafety.cleanupSafetyRecords[0].sourceOperationId = 'widget.delete';
check('cleanupSafetyRejection', validateWorkflowInvariants(alteredCleanupSafety, cleanupEvidence).some((entry) => entry.code === 'ALTERED_CLEANUP_SAFETY_RECORD'));
const missingCleanupSafety = structuredClone(cleanupResult.workflow);
missingCleanupSafety.cleanupSafetyRecords.pop();
check('cleanupSafetyRejection', validateWorkflowInvariants(missingCleanupSafety, cleanupEvidence).some((entry) => entry.code === 'MISSING_CLEANUP_SAFETY_RECORD'));

const cleanupSlot = (id, semanticType, required = false) => ({ id, name: id, semanticType, required });
const dependencyCleanupEvidence = createEvidenceGraph([
  operation({ id: 'account.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create account', action: 'create', resource: 'account', sideEffect: 'create', cleanupOperationId: 'account.delete', outputs: [cleanupSlot('accountId', 'account.id')] }),
  operation({ id: 'account.delete', adapterId: 'fixture', capability: 'custom.fixture', name: 'Delete account', action: 'delete', resource: 'account', sideEffect: 'delete', inputs: [cleanupSlot('accountId', 'account.id', true)] }),
  operation({ id: 'project.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create project', action: 'create', resource: 'project', sideEffect: 'create', cleanupOperationId: 'project.delete', inputs: [cleanupSlot('accountId', 'account.id', true)], outputs: [cleanupSlot('projectId', 'project.id')] }),
  operation({ id: 'project.delete', adapterId: 'fixture', capability: 'custom.fixture', name: 'Delete project', action: 'delete', resource: 'project', sideEffect: 'delete', inputs: [cleanupSlot('projectId', 'project.id', true)] }),
  operation({ id: 'task.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create task', action: 'create', resource: 'task', sideEffect: 'create', cleanupOperationId: 'task.delete', inputs: [cleanupSlot('projectId', 'project.id', true)], outputs: [cleanupSlot('taskId', 'task.id')] }),
  operation({ id: 'task.delete', adapterId: 'fixture', capability: 'custom.fixture', name: 'Delete task', action: 'delete', resource: 'task', sideEffect: 'delete', inputs: [cleanupSlot('taskId', 'task.id', true)] }),
  operation({ id: 'report.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create report', action: 'create', resource: 'report', sideEffect: 'create', cleanupOperationId: 'report.delete', inputs: [cleanupSlot('accountId', 'account.id', true)], outputs: [cleanupSlot('reportId', 'report.id')] }),
  operation({ id: 'report.delete', adapterId: 'fixture', capability: 'custom.fixture', name: 'Delete report', action: 'delete', resource: 'report', sideEffect: 'delete', inputs: [cleanupSlot('reportId', 'report.id', true)] }),
]);

const chainCleanup = compiler.compile(intent([scenario([
  { verb: 'create', resource: 'account' },
  { verb: 'create', resource: 'project' },
  { verb: 'create', resource: 'task' },
], 'automatic', 'cleanup-chain')]), dependencyCleanupEvidence);
check('cleanupReverseChain', chainCleanup.status === 'compiled', JSON.stringify(chainCleanup.diagnostics));
const chainScenario = chainCleanup.workflow?.scenarios[0];
const chainCleanupSteps = chainScenario?.cleanupStepIds.map((id) => chainScenario.steps.find((step) => step.id === id));
check('cleanupReverseChain', chainCleanupSteps?.map((step) => step?.operationId).join(',') === 'task.delete,project.delete,account.delete');
check('cleanupReverseChain', chainCleanupSteps?.[1]?.dependsOn.includes(chainCleanupSteps[0]?.id) === true);
check('cleanupReverseChain', chainCleanupSteps?.[2]?.dependsOn.includes(chainCleanupSteps[1]?.id) === true);

const branchCleanup = compiler.compile(intent([scenario([
  { verb: 'create', resource: 'account' },
  { verb: 'create', resource: 'project' },
  { verb: 'create', resource: 'report' },
], 'automatic', 'cleanup-branch')]), dependencyCleanupEvidence);
check('cleanupIndependentBranches', branchCleanup.status === 'compiled', JSON.stringify(branchCleanup.diagnostics));
const branchScenario = branchCleanup.workflow?.scenarios[0];
const branchCleanupByOperation = new Map(branchScenario?.cleanupStepIds.map((id) => {
  const step = branchScenario.steps.find((candidate) => candidate.id === id);
  return [step?.operationId, step];
}));
const projectCleanup = branchCleanupByOperation.get('project.delete');
const reportCleanup = branchCleanupByOperation.get('report.delete');
const accountCleanup = branchCleanupByOperation.get('account.delete');
check('cleanupIndependentBranches', projectCleanup !== undefined && reportCleanup !== undefined && accountCleanup !== undefined);
check('cleanupIndependentBranches', projectCleanup?.dependsOn.includes(reportCleanup?.id) === false);
check('cleanupIndependentBranches', reportCleanup?.dependsOn.includes(projectCleanup?.id) === false);
check('cleanupIndependentBranches', accountCleanup?.dependsOn.includes(projectCleanup?.id) === true);
check('cleanupIndependentBranches', accountCleanup?.dependsOn.includes(reportCleanup?.id) === true);
const accountSafety = branchCleanup.workflow?.cleanupSafetyRecords.find((record) => record.cleanupOperationId === 'account.delete');
check('cleanupIndependentBranches', new Set(accountSafety?.dependsOnCleanupStepIds).size === 2);

const repeatedResourceEvidence = createEvidenceGraph([
  operation({ id: 'widget.create', adapterId: 'fixture', capability: 'custom.fixture', name: 'Create widget', action: 'create', resource: 'widget', sideEffect: 'create', cleanupOperationId: 'widget.delete', outputs: [cleanupSlot('widgetId', 'widget.id')] }),
  operation({ id: 'widget.delete', adapterId: 'fixture', capability: 'custom.fixture', name: 'Delete widget', action: 'delete', resource: 'widget', sideEffect: 'delete', inputs: [cleanupSlot('widgetId', 'widget.id', true)] }),
]);
const repeatedResourceCleanup = compiler.compile(intent([scenario([
  { id: 'first-widget', verb: 'create', resource: 'widget' },
  { id: 'second-widget', verb: 'create', resource: 'widget' },
], 'automatic', 'cleanup-repeated-resource')]), repeatedResourceEvidence);
check('cleanupMultipleResources', repeatedResourceCleanup.status === 'compiled', JSON.stringify(repeatedResourceCleanup.diagnostics));
const repeatedScenario = repeatedResourceCleanup.workflow?.scenarios[0];
check('cleanupMultipleResources', repeatedScenario?.cleanupStepIds.length === 2);
check('cleanupMultipleResources', new Set(repeatedScenario?.cleanupStepIds).size === 2);
check('cleanupMultipleResources', repeatedResourceCleanup.workflow?.cleanupSafetyRecords.length === 2);
const repeatedProducers = repeatedResourceCleanup.workflow?.cleanupSafetyRecords.map((record) => record.requiredValues[0]?.producerStepId);
check('cleanupMultipleResources', new Set(repeatedProducers).size === 2);
check('cleanupMultipleResources', repeatedResourceCleanup.workflow?.cleanupSafetyRecords.every((record) => record.dependsOnCleanupStepIds.length === 0) === true);

let loweringCalls = 0;
let cleanupLoweringCalls = 0;
const loweringAdapter = {
  id: 'fixture',
  capabilities: ['custom.fixture'],
  async lower({ step }) {
    loweringCalls += 1;
    return [{
      id: `lowered_${step.id}`,
      name: step.id,
      type: 'api',
      objective: step.id,
      target: { method: 'POST', path: '/fixture' },
      assertions: [],
      evidenceRequired: [],
    }];
  },
  async lowerCleanup() {
    cleanupLoweringCalls += 1;
    return { type: 'api', target: { method: 'DELETE', path: '/fixture' } };
  },
};
const lowerer = new WorkflowLowerer([loweringAdapter]);
const loweredValidCleanup = await lowerer.lower({ workflow: cleanupResult.workflow, evidence: cleanupEvidence });
check('cleanupPreLoweringGate', loweredValidCleanup.scenarios.length === 1);
check('cleanupPreLoweringGate', loweringCalls === 1 && cleanupLoweringCalls === 1);

const expectCleanupLoweringRejected = async (name, mutateWorkflow, expectedCode, mutateEvidence = (value) => value) => {
  const workflow = structuredClone(cleanupResult.workflow);
  mutateWorkflow(workflow);
  const evidence = mutateEvidence(structuredClone(cleanupEvidence));
  loweringCalls = 0;
  cleanupLoweringCalls = 0;
  let captured;
  try {
    await lowerer.lower({ workflow, evidence });
  } catch (error) {
    captured = error;
  }
  check('cleanupPreLoweringGate', captured?.code === 'WORKFLOW_VALIDATION_FAILED', `${name} was not blocked by the shared workflow validation gate.`);
  check('cleanupPreLoweringGate', captured?.diagnostics?.some((entry) => entry.code === expectedCode) === true, `${name} did not report ${expectedCode}.`);
  check('cleanupPreLoweringGate', loweringCalls === 0 && cleanupLoweringCalls === 0, `${name} reached an adapter before validation stopped it.`);
};

await expectCleanupLoweringRejected('altered cleanup identity', (workflow) => { workflow.cleanupSafetyRecords[0].id = 'cleanup_forged'; }, 'ALTERED_CLEANUP_SAFETY_RECORD');
await expectCleanupLoweringRejected('altered source operation', (workflow) => { workflow.cleanupSafetyRecords[0].sourceOperationId = 'widget.delete'; }, 'ALTERED_CLEANUP_SAFETY_RECORD');
await expectCleanupLoweringRejected('altered cleanup operation', (workflow) => { workflow.cleanupSafetyRecords[0].cleanupOperationId = 'widget.create'; }, 'ALTERED_CLEANUP_SAFETY_RECORD');
await expectCleanupLoweringRejected('altered cleanup phase', (workflow) => { workflow.scenarios[0].steps[1].phase = 'test'; }, 'LIFECYCLE_PHASE_MISMATCH');
await expectCleanupLoweringRejected('altered cleanup binding', (workflow) => { workflow.scenarios[0].steps[1].inputs[0].value.outputSlotId = 'forgedId'; }, 'UNKNOWN_VALUE_PRODUCER');
await expectCleanupLoweringRejected('altered cleanup outcome', (workflow) => { workflow.scenarios[0].steps[1].expectedOutcomeIds = ['denied']; }, 'SELECTION_DECISION_MISMATCH');
await expectCleanupLoweringRejected('altered cleanup dependency', (workflow) => { workflow.scenarios[0].steps[1].dependsOn = []; }, 'INVALID_CLEANUP_SAFETY_RECORD');
await expectCleanupLoweringRejected('cleanup authority removed', () => {}, 'OPERATION_NOT_EXECUTABLE', (evidence) => ({
  ...evidence,
  operations: evidence.operations.map((entry) => entry.id === 'widget.delete'
    ? { ...entry, provenance: provenance('heuristic') }
    : entry),
}));

const tamperedDecision = structuredClone(first.workflow);
tamperedDecision.selectionDecisions[0].selectedOperationId = 'tenant.verify';
const tamperedDiagnostics = validateWorkflowInvariants(tamperedDecision, phaseEvidence);
check('tamperRejection', tamperedDiagnostics.some((entry) => entry.code === 'ALTERED_SELECTION_DECISION'));
check('tamperRejection', tamperedDiagnostics.some((entry) => entry.code === 'SELECTION_DECISION_MISMATCH'));
check('tamperRejection', tamperedDiagnostics.some((entry) => entry.code === 'ALTERED_WORKFLOW_IDENTITY'));
const missingDecision = structuredClone(first.workflow);
missingDecision.selectionDecisions.pop();
check('tamperRejection', validateWorkflowInvariants(missingDecision, phaseEvidence).some((entry) => entry.code === 'MISSING_SELECTION_DECISION'));
const staleEvidence = { ...phaseEvidence, revision: 'new-revision' };
check('tamperRejection', validateWorkflowInvariants(first.workflow, staleEvidence).some((entry) => entry.code === 'STALE_EVIDENCE_REVISION'));
const phaseTamper = structuredClone(first.workflow);
phaseTamper.scenarios[0].steps[0].phase = 'cleanup';
check('tamperRejection', validateWorkflowInvariants(phaseTamper, phaseEvidence).some((entry) => entry.code === 'LIFECYCLE_PHASE_MISMATCH'));

const duplicateAction = intent([scenario([
  { id: 'duplicate', verb: 'prepare', resource: 'tenant' }, { id: 'duplicate', verb: 'verify', resource: 'tenant' },
])]);
check('identityRejection', compiler.compile(duplicateAction, phaseEvidence).diagnostics.some((entry) => entry.code === 'DUPLICATE_INTENT_ACTION_ID'));
const duplicateScenario = intent([scenario([{ verb: 'prepare', resource: 'tenant' }], 'isolated', 'same'), scenario([{ verb: 'verify', resource: 'tenant' }], 'isolated', 'same')]);
check('identityRejection', compiler.compile(duplicateScenario, phaseEvidence).diagnostics.some((entry) => entry.code === 'DUPLICATE_INTENT_SCENARIO_ID'));

console.log(JSON.stringify({ schemaVersion: 'brisk-aitesting.operation-lifecycle-smoke.v1', categories, checks, failures: 0, skips: 0 }, null, 2));
