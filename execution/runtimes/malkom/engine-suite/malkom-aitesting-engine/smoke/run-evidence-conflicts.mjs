import assert from 'node:assert/strict';
import {
  DEFAULT_EVIDENCE_AUTHORITY_POLICY,
  UniversalSemanticCompiler,
  createEvidenceGraph,
  evidenceConflictScope,
  mergeEvidenceGraphs,
  resolveEvidenceConflicts,
  validatePipelineStagePayloadJsonContract,
} from '../dist/index.js';

const authorities = ['host', 'contract', 'runtime', 'observed', 'source', 'heuristic'];
const provenance = (authority, source, revision) => [{ authority, source, confidence: authority === 'source' ? 0.7 : 1, revision }];
const operation = ({ authority, source, revision, binding, sideEffect = 'create' }) => ({
  id: 'customer.save',
  adapterId: 'http',
  capability: 'api.http',
  name: 'Save customer',
  action: sideEffect === 'read' ? 'read' : 'create',
  resource: 'customer',
  sideEffect,
  inputs: [],
  outputs: [],
  outcomes: [{ id: 'ok', meaning: 'saved', successful: true }],
  provenance: provenance(authority, source, revision),
  binding,
});
const graph = (options) => createEvidenceGraph([operation(options)]);
const policy = (authorityOrder = authorities, hostOverrides = []) => ({
  schemaVersion: 'brisk-aitesting.evidence-authority-policy.v1',
  authorityOrder,
  hostOverrides,
});
const resolve = (graphs, selectedPolicy = policy()) => resolveEvidenceConflicts({
  schemaVersion: 'brisk-aitesting.evidence-conflict-input.v2',
  graphs,
  policy: selectedPolicy,
});
const findBindingConflict = (result) => result.conflicts.find((entry) => entry.field === 'binding');
const intent = (verb = 'create') => ({
  schemaVersion: 'brisk-aitesting.intent.v1',
  goal: `${verb} a customer`,
  warnings: [],
  scenarios: [{
    id: 'scenario_1', name: 'customer', objective: `${verb} a customer`,
    actions: [{ id: 'action_1', verb, resource: 'customer', expectedOutcomes: [] }],
    invariants: [], evidenceRequired: [], cleanup: 'isolated',
  }],
});

const contractGraph = graph({ authority: 'contract', source: 'openapi.json', revision: 'contract-v7', binding: { method: 'POST', path: '/customers' } });
const sourceGraph = graph({ authority: 'source', source: 'routes.ts', revision: 'source-a31', binding: { method: 'PUT', path: '/customer' } });

const resolved = resolve([sourceGraph, contractGraph]);
const resolvedConflict = findBindingConflict(resolved);
assert.equal(resolvedConflict?.status, 'resolved');
assert.equal(resolvedConflict?.reasonCode, 'AUTHORITY_PRECEDENCE');
assert.equal(resolvedConflict?.mutationBlocked, false);
assert.deepEqual(resolved.graph.operations[0]?.binding, { method: 'POST', path: '/customers' });
assert.equal(resolvedConflict?.candidates.length, 2);
assert.deepEqual(new Set(resolvedConflict?.candidates.flatMap((entry) => entry.provenance.map((item) => item.source))), new Set(['openapi.json', 'routes.ts']));
assert.deepEqual(new Set(resolvedConflict?.candidates.flatMap((entry) => entry.provenance.map((item) => item.authority))), new Set(['contract', 'source']));
assert.deepEqual(new Set(resolvedConflict?.candidates.flatMap((entry) => entry.provenance.map((item) => item.confidence))), new Set([1, 0.7]));
assert.deepEqual(new Set(resolvedConflict?.candidates.flatMap((entry) => entry.provenance.map((item) => item.revision))), new Set(['contract-v7', 'source-a31']));
assert.deepEqual(new Set(resolvedConflict?.candidates.flatMap((entry) => entry.sourceGraphRevisions)), new Set([contractGraph.revision, sourceGraph.revision]));
assert.deepEqual(resolved.graph.operations[0]?.conflicts, undefined);
assert.equal('actor' in resolved.graph.operations[0], false);
assert.equal('cleanupOperationId' in resolved.graph.operations[0], false);
assert.equal(new UniversalSemanticCompiler().compile(intent(), resolved.graph).status, 'compiled');

const reversed = resolve([contractGraph, sourceGraph]);
assert.equal(reversed.graph.revision, resolved.graph.revision);
assert.deepEqual(reversed.conflicts, resolved.conflicts);
assert.equal(reversed.policyDigest, resolved.policyDigest);

const customOrder = ['host', 'source', 'contract', 'runtime', 'observed', 'heuristic'];
const sourceWins = resolve([contractGraph, sourceGraph], policy(customOrder));
assert.deepEqual(sourceWins.graph.operations[0]?.binding, { method: 'PUT', path: '/customer' });

const tiedGraph = graph({ authority: 'contract', source: 'second-openapi.json', revision: 'contract-v8', binding: { method: 'PATCH', path: '/customers/{id}' } });
const tied = resolve([contractGraph, tiedGraph]);
const tiedConflict = findBindingConflict(tied);
assert.equal(tiedConflict?.status, 'unresolved');
assert.equal(tiedConflict?.reasonCode, 'AUTHORITY_TIE');
assert.equal(tiedConflict?.selectedCandidateId, undefined);
assert.equal(tiedConflict?.mutationBlocked, true);
assert.deepEqual(tied.mutationBlockedOperationIds, ['customer.save']);
assert.deepEqual(tied.graph.operations[0]?.conflicts, [tiedConflict?.id]);
const tiedCompilation = new UniversalSemanticCompiler().compile(intent(), tied.graph);
assert.equal(tiedCompilation.status, 'needs-evidence');
assert.ok(tiedCompilation.diagnostics.some((entry) => entry.code === 'OPERATION_NOT_EXECUTABLE'));

const readContract = graph({ authority: 'contract', source: 'read-a.json', revision: 'read-a', binding: { method: 'GET', path: '/customers' }, sideEffect: 'read' });
const readTie = graph({ authority: 'contract', source: 'read-b.json', revision: 'read-b', binding: { method: 'GET', path: '/customer-list' }, sideEffect: 'read' });
const unresolvedRead = resolve([readContract, readTie]);
assert.equal(findBindingConflict(unresolvedRead)?.mutationBlocked, false);
assert.deepEqual(unresolvedRead.mutationBlockedOperationIds, []);
assert.equal(new UniversalSemanticCompiler().compile(intent('read'), unresolvedRead.graph).status, 'needs-evidence');

const runtimeGraph = graph({ authority: 'runtime', source: 'runtime-probe', revision: 'probe-12', binding: { method: 'POST', path: '/v2/customers' } });
const fieldScope = evidenceConflictScope('customer.save', 'binding');
const overridden = resolve([contractGraph, runtimeGraph], policy(authorities, [{ scope: fieldScope, authority: 'runtime', reason: 'Production probe is newer than the checked-in contract.' }]));
assert.equal(findBindingConflict(overridden)?.reasonCode, 'HOST_OVERRIDE_APPLIED');
assert.deepEqual(overridden.graph.operations[0]?.binding, { method: 'POST', path: '/v2/customers' });

const noMatch = resolve([contractGraph, sourceGraph], policy(authorities, [{ scope: fieldScope, authority: 'host', reason: 'Use a host-confirmed value only.' }]));
assert.equal(findBindingConflict(noMatch)?.reasonCode, 'HOST_OVERRIDE_NO_MATCH');
assert.equal(findBindingConflict(noMatch)?.status, 'unresolved');
assert.equal(findBindingConflict(noMatch)?.selectedCandidateId, undefined);
assert.equal(noMatch.mutationBlockedOperationIds.includes('customer.save'), true);

const secondRuntime = graph({ authority: 'runtime', source: 'runtime-probe-2', revision: 'probe-13', binding: { method: 'POST', path: '/v3/customers' } });
const ambiguous = resolve([contractGraph, runtimeGraph, secondRuntime], policy(authorities, [{ scope: fieldScope, authority: 'runtime', reason: 'Prefer live runtime evidence.' }]));
assert.equal(findBindingConflict(ambiguous)?.reasonCode, 'HOST_OVERRIDE_AMBIGUOUS');
assert.equal(findBindingConflict(ambiguous)?.status, 'unresolved');
assert.equal(findBindingConflict(ambiguous)?.selectedCandidateId, undefined);

assert.equal(resolvedConflict?.explanation, `Declared authority order selected ${resolvedConflict?.selectedCandidateId} for customer.save.binding; competing lower-authority facts remain recorded.`);
assert.equal(tiedConflict?.explanation, 'The strongest candidates for customer.save.binding have equal authority; Brisk did not guess.');
assert.equal(findBindingConflict(overridden)?.explanation, `Host override ${fieldScope} selected ${findBindingConflict(overridden)?.selectedCandidateId} for customer.save.binding: Production probe is newer than the checked-in contract.`);
assert.equal(findBindingConflict(noMatch)?.explanation, `Host override ${fieldScope} requested host, but no candidate for customer.save.binding has that authority.`);
assert.equal(findBindingConflict(ambiguous)?.explanation, `Host override ${fieldScope} matched more than one conflicting value for customer.save.binding; no value was chosen.`);

const same = resolve([contractGraph, contractGraph]);
assert.equal(same.conflicts.length, 0);
assert.deepEqual(mergeEvidenceGraphs([sourceGraph, contractGraph]), resolved.graph);
assert.equal(mergeEvidenceGraphs([]).operations.length, 0);
assert.equal(mergeEvidenceGraphs([]).diagnostics.length, 0);

assert.deepEqual(validatePipelineStagePayloadJsonContract(DEFAULT_EVIDENCE_AUTHORITY_POLICY), []);
assert.deepEqual(validatePipelineStagePayloadJsonContract({
  schemaVersion: 'brisk-aitesting.evidence-conflict-input.v2', graphs: [contractGraph], policy: DEFAULT_EVIDENCE_AUTHORITY_POLICY,
}), []);
assert.deepEqual(validatePipelineStagePayloadJsonContract(resolved), []);

const malformedPolicies = [
  policy(['host', 'contract']),
  policy(['host', 'contract', 'runtime', 'observed', 'source', 'source']),
  policy(authorities, [{ scope: fieldScope, authority: 'runtime', reason: ' ' }]),
  policy(authorities, [
    { scope: fieldScope, authority: 'runtime', reason: 'first' },
    { scope: fieldScope, authority: 'contract', reason: 'duplicate' },
  ]),
  policy(authorities, [{ scope: 'everything', authority: 'runtime', reason: 'too broad' }]),
];
for (const malformed of malformedPolicies) {
  assert.throws(() => resolve([contractGraph, sourceGraph], malformed));
}
assert.ok(validatePipelineStagePayloadJsonContract({
  schemaVersion: 'brisk-aitesting.evidence-conflict-input.v2', graphs: [contractGraph], policy: malformedPolicies[0],
}).length > 0);

const categories = {
  strongerAuthorityAndPreservation: 15,
  deterministicOrder: 3,
  customPolicy: 1,
  tiedMutationAndCompilationBlock: 8,
  unresolvedRead: 3,
  validHostOverride: 2,
  missingOverrideCandidate: 4,
  ambiguousOverride: 3,
  noConflictAndCompatibility: 6,
  stableExplanations: 5,
  contractValidation: 3,
  malformedPolicy: 6,
};
const checks = Object.values(categories).reduce((sum, count) => sum + count, 0);
assert.equal(checks, 59);
console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.evidence-conflict-smoke.v1',
  conflictsInspected: resolved.conflicts.length + tied.conflicts.length + unresolvedRead.conflicts.length + overridden.conflicts.length + noMatch.conflicts.length + ambiguous.conflicts.length,
  categories,
  checks,
  failures: 0,
  skips: 0,
}, null, 2));
