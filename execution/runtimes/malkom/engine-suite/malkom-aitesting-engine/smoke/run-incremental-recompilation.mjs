import assert from 'node:assert/strict';
import {
  BuiltinPlanValidator,
  SemanticCompilationError,
  SemanticPlanner,
  UniversalSemanticCompiler,
  affectedScenarioIdsForEvidenceChange,
  compileIntentIncrementally,
  mergeEvidenceGraphs,
  normalizeConfig,
  requirementsFromCompilation,
  resolveEvidenceConflicts,
  validatePlanJsonContract,
} from '../dist/index.js';

const categories = {};
function check(category, actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  categories[category] = (categories[category] ?? 0) + 1;
}
function checkTrue(category, value, message) {
  check(category, value, true, message);
}

const provenance = (authority, source, revision) => [{ authority, source, confidence: 1, revision }];
const operation = ({ id, action, resource, authority = 'contract', source = `${id}.json`, binding = { operation: id }, inputs = [] }) => ({
  id, adapterId: 'fixture', capability: 'api.http', name: `${action} ${resource}`,
  action, resource, sideEffect: action === 'read' ? 'read' : 'create', inputs, outputs: [],
  outcomes: [{ id: 'ok', meaning: 'operation succeeds', successful: true }],
  provenance: provenance(authority, source, `${source}-v1`), binding,
});
const graph = (revision, operations) => ({
  schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision, operations, diagnostics: [],
});
const scenario = (id, verb, resource) => ({
  id, name: `${resource} scenario`, objective: `${verb} ${resource}`,
  actions: [{ id: `${id}-action`, verb, resource, capability: 'api.http', expectedOutcomes: [] }],
  invariants: [], evidenceRequired: ['api'], cleanup: 'isolated',
});
const intent = {
  schemaVersion: 'brisk-aitesting.intent.v1', goal: 'Read a profile and create an order', warnings: [],
  scenarios: [scenario('profile-scenario', 'read', 'profile'), scenario('order-scenario', 'create', 'order')],
};
const profileOperation = operation({ id: 'profile.read', action: 'read', resource: 'profile' });
const orderOperation = operation({ id: 'order.create', action: 'create', resource: 'order' });
const baseEvidence = graph('base-v1', [profileOperation]);
const completeEvidence = mergeEvidenceGraphs([baseEvidence, graph('order-v1', [orderOperation])]);

class CountingCompiler extends UniversalSemanticCompiler {
  calls = [];
  compile(value, evidence) {
    this.calls.push(value.scenarios.map((entry) => entry.id));
    return super.compile(value, evidence);
  }
}

const compiler = new CountingCompiler();
const initial = compileIntentIncrementally({ intent, evidence: baseEvidence, compiler });
check('initialScenarioState', compiler.calls, [['profile-scenario'], ['order-scenario']]);
check('initialScenarioState', initial.result.status, 'unsupported');
const requirements = requirementsFromCompilation(initial.result, intent);
check('affectedScenarioDetection', requirements.map((entry) => entry.scenarioId), ['order-scenario']);
const affected = affectedScenarioIdsForEvidenceChange({ intent, requirements, before: baseEvidence, after: completeEvidence, previous: initial.state });
check('affectedScenarioDetection', affected, ['order-scenario']);

const updated = compileIntentIncrementally({
  intent, evidence: completeEvidence, previous: initial.state, affectedScenarioIds: affected, compiler,
});
check('selectiveRecompilation', compiler.calls.at(-1), ['order-scenario']);
check('selectiveRecompilation', updated.recompiledScenarioIds, ['order-scenario']);
check('selectiveRecompilation', updated.preservedScenarioIds, ['profile-scenario']);
check('selectiveRecompilation', updated.result.status, 'compiled');
check('selectiveRecompilation', updated.result.workflow?.scenarios.map((entry) => entry.intentScenarioId), ['profile-scenario', 'order-scenario']);
checkTrue('selectiveRecompilation', updated.state.scenarioCompilations[0]?.result === initial.state.scenarioCompilations[0]?.result, 'unaffected scenario result must be the same preserved object');

const changedProfile = mergeEvidenceGraphs([graph('profile-change', [{ ...profileOperation, binding: { operation: 'profile.read.v2' } }]), graph('order-v1', [orderOperation])]);
check('changedOperationDetection', affectedScenarioIdsForEvidenceChange({ intent, requirements: [], before: completeEvidence, after: changedProfile, previous: updated.state }), ['profile-scenario']);

const duplicateProfile = mergeEvidenceGraphs([completeEvidence, graph('profile-copy', [operation({ id: 'profile.read.alternate', action: 'read', resource: 'profile' })])]);
check('newMatchingOperationDetection', affectedScenarioIdsForEvidenceChange({ intent, requirements: [], before: completeEvidence, after: duplicateProfile, previous: updated.state }), ['profile-scenario']);

const irrelevant = mergeEvidenceGraphs([baseEvidence, graph('invoice-v1', [operation({ id: 'invoice.read', action: 'read', resource: 'invoice' })])]);
check('irrelevantEvidence', affectedScenarioIdsForEvidenceChange({ intent, requirements, before: baseEvidence, after: irrelevant, previous: initial.state }), []);
const reordered = { ...completeEvidence, operations: [...completeEvidence.operations].reverse() };
check('inputOrderStability', affectedScenarioIdsForEvidenceChange({ intent, requirements, before: baseEvidence, after: reordered, previous: initial.state }), ['order-scenario']);

const tiedOrder = resolveEvidenceConflicts({
  schemaVersion: 'brisk-aitesting.evidence-conflict-input.v2',
  graphs: [
    graph('order-a', [{ ...orderOperation, provenance: provenance('heuristic', 'guess-a', 'a'), binding: { path: '/orders-a' } }]),
    graph('order-b', [{ ...orderOperation, provenance: provenance('heuristic', 'guess-b', 'b'), binding: { path: '/orders-b' } }]),
  ],
  policy: { schemaVersion: 'brisk-aitesting.evidence-authority-policy.v1', authorityOrder: ['host', 'contract', 'runtime', 'observed', 'source', 'heuristic'], hostOverrides: [] },
}).graph;
const conflictEvidence = mergeEvidenceGraphs([baseEvidence, tiedOrder]);
const conflictAffected = affectedScenarioIdsForEvidenceChange({ intent, requirements, before: baseEvidence, after: conflictEvidence, previous: initial.state });
check('contradictoryEvidence', conflictAffected, ['order-scenario']);
const conflictUpdate = compileIntentIncrementally({ intent, evidence: conflictEvidence, previous: initial.state, affectedScenarioIds: conflictAffected });
check('contradictoryEvidence', conflictUpdate.result.status, 'needs-evidence');
checkTrue('contradictoryEvidence', conflictUpdate.result.diagnostics.some((entry) => entry.code === 'OPERATION_NOT_EXECUTABLE'));
checkTrue('noInvention', conflictUpdate.result.workflow === undefined);
assert.throws(() => compileIntentIncrementally({ intent, evidence: completeEvidence, previous: initial.state, affectedScenarioIds: ['made-up-scenario'] }));
categories.noInvention = (categories.noInvention ?? 0) + 1;

const discovery = {
  schemaVersion: 'brisk-aitesting.discovery.v1', app: { name: 'Incremental fixture', baseUrl: 'http://127.0.0.1:3000' },
  uiRoutes: [],
  apiRoutes: [
    { method: 'GET', path: '/profile', source: 'contract', confidence: 1 },
    { method: 'POST', path: '/order', source: 'contract', confidence: 1 },
  ],
  contracts: [], repoSignals: [], warnings: [], createdAt: '2026-08-02T00:00:00.000Z',
};
const aiProvider = { name: 'incremental-intent-fixture', async complete() { return { content: JSON.stringify({ scenarios: intent.scenarios, warnings: [] }) }; } };
const adapter = {
  id: 'fixture', capabilities: ['api.http'],
  lower({ operation: selected }) {
    return [{ name: selected.name, type: 'api', objective: selected.name, target: { method: selected.action === 'read' ? 'GET' : 'POST', path: `/${selected.resource}`, sourceOfTruth: 'contract' }, assertions: ['operation succeeds'], evidenceRequired: ['api'] }];
  },
};
function outputFor(providerId, input, operations) {
  const supplied = graph(`${providerId}-graph-v1`, operations);
  return {
    schemaVersion: 'brisk-aitesting.evidence-acquisition-output.v1', graphs: [supplied],
    attempts: [{ providerId, status: 'succeeded', requirementIds: input.requirements.map((entry) => entry.id), graphRevisions: [supplied.revision], cache: 'miss' }],
    satisfiedRequirementIds: input.requirements.map((entry) => entry.id), unsatisfiedRequirementIds: [], artifacts: [],
  };
}
const successfulProvider = {
  id: 'order-contract', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'v1',
  supports: (requirement) => requirement.scenarioId === 'order-scenario',
  acquire: (input) => outputFor('order-contract', input, [orderOperation]),
};
function config(providers, rounds = 2) {
  return normalizeConfig({
    app: { name: 'Incremental fixture', baseUrl: 'http://127.0.0.1:3000' }, auth: { type: 'none' },
    runtime: { artifactsDir: '.incremental-fixture', timeoutMs: 1000, retries: 0, headless: true, dryRun: true },
    discovery: { includeRepo: false, includeUi: false, includeApi: false, includeContracts: false, maxSourceFiles: 10, uiRoutes: [], apiRoutes: [] },
    security: { networkPolicy: 'localhost-only', allowedHosts: ['127.0.0.1'], redactSecrets: true, allowLegacyFullContextEvidenceProviders: true },
    aiProvider, capabilityAdapters: [adapter], evidenceProviders: providers,
    planning: { evidenceAcquisitionRounds: rounds, evidenceProviderTimeoutMs: 100, evidenceCacheTtlMs: 0, evidenceCacheMaxEntries: 0 },
  });
}
const context = (configured, evidence = baseEvidence) => ({
  config: configured, input: { goal: intent.goal, evidenceGraph: evidence }, runId: 'incremental-run', discovery,
});
// The order scenario cannot compile in these cases, but the profile scenario
// can: planning now ships the compiled check and names the dropped one with
// its reasons, instead of throwing everything away. The decision records the
// error used to carry ride on the delivered plan.
async function capturePartial(providers, evidence = baseEvidence, rounds = 2) {
  const partial = await new SemanticPlanner(aiProvider, [adapter]).plan(context(config(providers, rounds), evidence));
  assert.ok(partial.droppedScenarios?.some((record) => record.id === 'order-scenario'));
  assert.ok(partial.scenarios.every((scenario) => scenario.metadata?.intentScenarioId !== 'order-scenario'));
  return partial;
}

const plan = await new SemanticPlanner(aiProvider, [adapter]).plan(context(config([successfulProvider])));
const successDecision = plan.evidenceDecisions?.[0];
check('plannerIntegration', plan.scenarios.length, 2);
check('plannerIntegration', successDecision?.reasonCode, 'EVIDENCE_ACQUIRED');
check('plannerIntegration', successDecision?.outcome, 'completed');
check('plannerIntegration', successDecision?.affectedScenarioIds, ['order-scenario']);
check('plannerIntegration', successDecision?.recompiledScenarioIds, ['order-scenario']);
check('plannerIntegration', successDecision?.preservedScenarioIds, ['profile-scenario']);
check('decisionRecord', successDecision?.attemptedProviderIds, ['order-contract']);
check('decisionRecord', successDecision?.acquiredGraphRevisions, ['order-contract-graph-v1']);
checkTrue('decisionRecord', successDecision?.beforeEvidenceDigest.startsWith('sha256:'));
checkTrue('decisionRecord', successDecision?.afterEvidenceDigest.startsWith('sha256:'));
checkTrue('decisionRecord', successDecision?.authorityPolicyDigest.startsWith('sha256:'));
check('decisionRecord', validatePlanJsonContract(plan), []);
const validator = new BuiltinPlanValidator();
const validPlanCheck = validator.validate({ config: config([successfulProvider]), input: context(config([successfulProvider])).input, plan });
if (!validPlanCheck.valid) console.error(JSON.stringify(validPlanCheck.issues, null, 2));
check('decisionRecordValidation', validPlanCheck.valid, true);
const overlappingDecision = { ...successDecision, preservedScenarioIds: ['order-scenario', 'profile-scenario'] };
const overlapPlan = { ...plan, evidenceDecisions: [overlappingDecision] };
checkTrue('decisionRecordValidation', validator.validate({ config: config([successfulProvider]), input: context(config([successfulProvider])).input, plan: overlapPlan }).issues.some((entry) => entry.code === 'INVALID_EVIDENCE_DECISION'));
const duplicatePlan = { ...plan, evidenceDecisions: [successDecision, successDecision] };
checkTrue('decisionRecordValidation', validator.validate({ config: config([successfulProvider]), input: context(config([successfulProvider])).input, plan: duplicatePlan }).issues.some((entry) => entry.code === 'DUPLICATE_EVIDENCE_DECISION'));
checkTrue('decisionRecordValidation', validatePlanJsonContract({ ...plan, evidenceDecisions: [{ ...successDecision, extraTrust: true }] }).length > 0);
checkTrue('decisionRecordValidation', validatePlanJsonContract({ ...plan, evidenceDecisions: [{ ...successDecision, authorityPolicyDigest: 'trusted' }] }).length > 0);
const repeatedPlan = await new SemanticPlanner(aiProvider, [adapter]).plan(context(config([successfulProvider])));
check('decisionRecord', repeatedPlan.evidenceDecisions?.[0]?.id, successDecision?.id);

const unavailable = await capturePartial([]);
check('unavailableProviderRecovery', unavailable.evidenceDecisions?.[0]?.reasonCode, 'NO_ELIGIBLE_PROVIDER');
check('unavailableProviderRecovery', unavailable.evidenceDecisions?.[0]?.outcome, 'stopped');
check('unavailableProviderRecovery', unavailable.evidenceDecisions?.[0]?.recompiledScenarioIds, []);
check('unavailableProviderRecovery', unavailable.droppedScenarios?.length, 1);

const failedProvider = {
  ...successfulProvider, id: 'failed-source',
  acquire() { throw new Error('private provider detail'); },
};
const failed = await capturePartial([failedProvider]);
check('failedProviderRecovery', failed.evidenceDecisions?.[0]?.reasonCode, 'NO_USABLE_EVIDENCE');
check('failedProviderRecovery', failed.evidenceDecisions?.[0]?.diagnosticCodes, ['EVIDENCE_PROVIDER_FAILED']);
checkTrue('failedProviderRecovery', (failed.droppedScenarios ?? []).every((record) => record.reasons.every((reason) => !reason.includes('private provider detail')))
  && failed.warnings.every((entry) => !entry.includes('private provider detail')));

const irrelevantProvider = {
  ...successfulProvider, id: 'irrelevant-source',
  acquire: (input) => outputFor('irrelevant-source', input, [operation({ id: 'invoice.read', action: 'read', resource: 'invoice' })]),
};
const irrelevantPlan = await capturePartial([irrelevantProvider]);
check('irrelevantEvidenceRecovery', irrelevantPlan.evidenceDecisions?.[0]?.reasonCode, 'IRRELEVANT_EVIDENCE');
check('irrelevantEvidenceRecovery', irrelevantPlan.evidenceDecisions?.[0]?.recompiledScenarioIds, []);
check('irrelevantEvidenceRecovery', irrelevantPlan.evidenceDecisions?.[0]?.preservedScenarioIds, ['order-scenario', 'profile-scenario']);

const heuristicOrder = { ...orderOperation, provenance: provenance('heuristic', 'guess-a', 'a'), binding: { path: '/orders-a' } };
const contradictoryProvider = {
  ...successfulProvider, id: 'contradictory-source',
  acquire: (input) => outputFor('contradictory-source', input, [{ ...heuristicOrder, provenance: provenance('heuristic', 'guess-b', 'b'), binding: { path: '/orders-b' } }]),
};
const contradiction = await capturePartial([contradictoryProvider], graph('base-with-guess', [profileOperation, heuristicOrder]));
check('contradictoryEvidenceRecovery', contradiction.evidenceDecisions?.[0]?.reasonCode, 'CONTRADICTORY_EVIDENCE');
check('contradictoryEvidenceRecovery', contradiction.evidenceDecisions?.[0]?.outcome, 'stopped');
checkTrue('contradictoryEvidenceRecovery', contradiction.evidenceDecisions?.[0]?.conflictIds.length > 0);
check('contradictoryEvidenceRecovery', contradiction.evidenceDecisions?.length, 1);
// No invention: the conflicted order scenario is not delivered in any form.
checkTrue('noInvention', contradiction.scenarios.every((scenario) => scenario.metadata?.intentScenarioId !== 'order-scenario'));

const requiredInputOrder = operation({
  id: 'order.create', action: 'create', resource: 'order',
  inputs: [{ id: 'account-id', name: 'accountId', semanticType: 'account.id', required: true }],
});
const incompleteProvider = {
  ...successfulProvider, id: 'incomplete-source',
  acquire: (input) => outputFor('incomplete-source', input, [requiredInputOrder]),
};
const bounded = await capturePartial([incompleteProvider], baseEvidence, 1);
check('boundedRounds', bounded.evidenceDecisions?.map((entry) => entry.reasonCode), ['EVIDENCE_ACQUIRED', 'MAX_ROUNDS_REACHED']);
check('boundedRounds', bounded.evidenceDecisions?.at(-1)?.outcome, 'stopped');
checkTrue('boundedRounds', (bounded.droppedScenarios ?? []).some((record) => record.reasons.some((reason) => reason.includes('MISSING_REQUIRED_VALUE'))));

const checks = Object.values(categories).reduce((sum, value) => sum + value, 0);
console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.incremental-recompilation-smoke.v1',
  categories, checks, failures: 0, skips: 0,
}, null, 2));
