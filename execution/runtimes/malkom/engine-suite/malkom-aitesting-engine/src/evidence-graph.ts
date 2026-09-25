import { createHash } from 'node:crypto';
import type {
  EvidenceAuthority,
  EvidenceConflictCandidate,
  EvidenceConflictRecord,
  EvidenceGraph,
  EvidenceOperation,
  EvidenceProvenance,
} from './compiler-types.js';
import type {
  EvidenceAuthorityPolicyV1,
  EvidenceConflictResolutionInputV2,
  EvidenceConflictResolutionOutputV2,
} from './pipeline-stage-contracts.js';

const ALL_AUTHORITIES: readonly EvidenceAuthority[] = ['host', 'contract', 'runtime', 'observed', 'source', 'heuristic'];
const OPERATION_FIELDS = [
  'adapterId', 'capability', 'name', 'action', 'resource', 'actor', 'sideEffect',
  'inputs', 'outputs', 'outcomes', 'binding', 'cleanupOperationId',
  'valueConversions',
] as const satisfies readonly (keyof EvidenceOperation)[];

export const DEFAULT_EVIDENCE_AUTHORITY_POLICY: EvidenceAuthorityPolicyV1 = {
  schemaVersion: 'brisk-aitesting.evidence-authority-policy.v1',
  authorityOrder: ALL_AUTHORITIES,
  hostOverrides: [],
};

/**
 * Combines evidence through the same public conflict resolver used by hosts.
 * A resolved disagreement remains in graph.conflicts for explanation; an
 * unresolved disagreement is also attached to the operation so compilation
 * cannot accidentally treat the deterministic display fallback as approval.
 */
export function mergeEvidenceGraphs(graphs: readonly EvidenceGraph[]): EvidenceGraph {
  if (graphs.length === 0) {
    const graphContent = {
      schemaVersion: 'brisk-aitesting.evidence-graph.v1' as const,
      operations: [],
      diagnostics: [],
      conflicts: [],
    };
    return {
      ...graphContent,
      revision: `evidence_${sha256(stableStringify(graphContent)).slice(0, 32)}`,
    };
  }
  return resolveEvidenceConflicts({
    schemaVersion: 'brisk-aitesting.evidence-conflict-input.v2',
    graphs,
    policy: DEFAULT_EVIDENCE_AUTHORITY_POLICY,
  }).graph;
}

export function resolveEvidenceConflicts(
  input: EvidenceConflictResolutionInputV2,
): EvidenceConflictResolutionOutputV2 {
  validatePolicy(input.policy);
  if (input.schemaVersion !== 'brisk-aitesting.evidence-conflict-input.v2') {
    throw new Error('Unsupported evidence conflict input version.');
  }
  if (input.graphs.length === 0) throw new Error('At least one evidence graph is required.');

  const byOperationId = new Map<string, { readonly operation: EvidenceOperation; readonly graphRevision: string }[]>();
  const retainedConflicts = new Map<string, EvidenceConflictRecord>();
  const sourceDiagnostics = new Set<string>();
  for (const graph of input.graphs) {
    graph.diagnostics.forEach((diagnostic) => sourceDiagnostics.add(diagnostic));
    graph.conflicts?.forEach((conflict) => retainedConflicts.set(conflict.id, conflict));
    for (const operation of graph.operations) {
      const entries = byOperationId.get(operation.id) ?? [];
      entries.push({ operation, graphRevision: graph.revision });
      byOperationId.set(operation.id, entries);
    }
  }

  const operations: EvidenceOperation[] = [];
  const newConflicts: EvidenceConflictRecord[] = [];
  for (const operationId of [...byOperationId.keys()].sort()) {
    const entries = byOperationId.get(operationId) ?? [];
    if (entries.length === 0) continue;
    // Decisions are made field-by-field so every competing fact remains
    // inspectable. Optional absence stays absent; it is never invented as a
    // host-confirmed value.
    const selectedFields: Record<string, unknown> = {};
    const unresolvedIds = new Set(entries.flatMap((entry) => entry.operation.conflicts ?? []));
    for (const field of OPERATION_FIELDS) {
      const candidates = conflictCandidates(entries, field);
      const decision = chooseCandidate(operationId, field, candidates, entries, input.policy);
      selectedFields[field] = decision.selected.value;
      if (decision.conflict !== undefined) {
        newConflicts.push(decision.conflict);
        if (decision.conflict.status === 'unresolved') unresolvedIds.add(decision.conflict.id);
        else unresolvedIds.delete(decision.conflict.id);
      }
    }
    const provenance = mergeProvenance(entries.flatMap((entry) => entry.operation.provenance));
    const { actor, cleanupOperationId, valueConversions, ...requiredFields } = selectedFields;
    const operation = {
      id: operationId,
      ...requiredFields,
      ...(actor === null ? {} : { actor }),
      ...(cleanupOperationId === null ? {} : { cleanupOperationId }),
      ...(valueConversions === null ? {} : { valueConversions }),
      provenance,
      ...(unresolvedIds.size === 0 ? {} : { conflicts: [...unresolvedIds].sort() }),
    } as unknown as EvidenceOperation;
    operations.push(operation);
  }

  for (const conflict of newConflicts) retainedConflicts.set(conflict.id, conflict);
  const conflicts = [...retainedConflicts.values()].sort((left, right) => left.id.localeCompare(right.id));
  for (const conflict of conflicts) sourceDiagnostics.add(`Evidence conflict ${conflict.id}: ${conflict.explanation}`);
  const diagnostics = [...sourceDiagnostics].sort();
  const graphContent = {
    schemaVersion: 'brisk-aitesting.evidence-graph.v1' as const,
    operations: operations.sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics,
    conflicts,
  };
  const revision = `evidence_${sha256(stableStringify(graphContent)).slice(0, 32)}`;
  const graph: EvidenceGraph = { ...graphContent, revision };
  return {
    schemaVersion: 'brisk-aitesting.evidence-conflict-output.v2',
    graph,
    conflicts,
    mutationBlockedOperationIds: [...new Set(conflicts.filter((conflict) => conflict.mutationBlocked).map((conflict) => conflict.operationId))].sort(),
    policyDigest: `sha256:${sha256(stableStringify(input.policy))}`,
  };
}

export function evidenceConflictScope(operationId: string, field?: string): string {
  return field === undefined ? `operation:${operationId}` : `operation:${operationId}/field:${field}`;
}

export function evidenceAuthorityPolicyDigest(policy: EvidenceAuthorityPolicyV1): string {
  validatePolicy(policy);
  return `sha256:${sha256(stableStringify(policy))}`;
}

export function evidenceGraphDigest(graph: EvidenceGraph): string {
  const operations = [...graph.operations]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((operation) => ({
      ...operation,
      inputs: [...operation.inputs].sort((left, right) => left.id.localeCompare(right.id)),
      outputs: [...operation.outputs].sort((left, right) => left.id.localeCompare(right.id)),
      outcomes: [...operation.outcomes].sort((left, right) => left.id.localeCompare(right.id)),
      provenance: [...operation.provenance].sort((left, right) => provenanceKey(left).localeCompare(provenanceKey(right))),
      ...(operation.conflicts === undefined ? {} : { conflicts: [...operation.conflicts].sort() }),
    }));
  const conflicts = [...(graph.conflicts ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const content = stableStringify({ schemaVersion: graph.schemaVersion, operations, diagnostics: [...graph.diagnostics].sort(), conflicts });
  return `sha256:${sha256(content)}`;
}

function conflictCandidates(
  entries: readonly { readonly operation: EvidenceOperation; readonly graphRevision: string }[],
  field: typeof OPERATION_FIELDS[number],
): readonly EvidenceConflictCandidate[] {
  const groups = new Map<string, { value: unknown; provenance: EvidenceProvenance[]; graphRevisions: string[] }>();
  for (const entry of entries) {
    const value = entry.operation[field] ?? null;
    const key = stableStringify(value);
    const group = groups.get(key) ?? { value, provenance: [], graphRevisions: [] };
    group.provenance.push(...entry.operation.provenance);
    group.graphRevisions.push(entry.graphRevision);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const provenance = mergeProvenance(group.provenance);
    const sourceGraphRevisions = [...new Set(group.graphRevisions)].sort();
    const id = `candidate_${sha256(stableStringify({ field, value: group.value, provenance, sourceGraphRevisions })).slice(0, 24)}`;
    return { id, value: group.value, provenance, sourceGraphRevisions };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function chooseCandidate(
  operationId: string,
  field: typeof OPERATION_FIELDS[number],
  candidates: readonly EvidenceConflictCandidate[],
  entries: readonly { readonly operation: EvidenceOperation; readonly graphRevision: string }[],
  policy: EvidenceAuthorityPolicyV1,
): { readonly selected: EvidenceConflictCandidate; readonly conflict?: EvidenceConflictRecord } {
  const first = candidates[0];
  if (first === undefined) throw new Error(`Operation ${operationId} has no candidate for ${field}.`);
  if (candidates.length === 1) return { selected: first };

  const fieldScope = evidenceConflictScope(operationId, field);
  const operationScope = evidenceConflictScope(operationId);
  const override = policy.hostOverrides.find((entry) => entry.scope === fieldScope)
    ?? policy.hostOverrides.find((entry) => entry.scope === operationScope);
  let selected: EvidenceConflictCandidate;
  let status: EvidenceConflictRecord['status'];
  let reasonCode: EvidenceConflictRecord['reasonCode'];

  if (override !== undefined) {
    // An override selects only a value that actually carries the requested
    // authority. Zero or multiple matches stay unresolved instead of guessing.
    const matches = candidates.filter((candidate) => candidate.provenance.some((entry) => entry.authority === override.authority));
    if (matches.length === 1) {
      selected = matches[0] as EvidenceConflictCandidate;
      status = 'resolved';
      reasonCode = 'HOST_OVERRIDE_APPLIED';
    } else {
      selected = deterministicCandidate(candidates, policy);
      status = 'unresolved';
      reasonCode = matches.length === 0 ? 'HOST_OVERRIDE_NO_MATCH' : 'HOST_OVERRIDE_AMBIGUOUS';
    }
  } else {
    const ranked = candidates.map((candidate) => ({ candidate, rank: candidateRank(candidate, policy) }))
      .sort((left, right) => left.rank - right.rank || left.candidate.id.localeCompare(right.candidate.id));
    selected = ranked[0]?.candidate ?? first;
    const bestRank = ranked[0]?.rank ?? Number.POSITIVE_INFINITY;
    const top = ranked.filter((entry) => entry.rank === bestRank);
    status = top.length === 1 ? 'resolved' : 'unresolved';
    reasonCode = status === 'resolved' ? 'AUTHORITY_PRECEDENCE' : 'AUTHORITY_TIE';
  }

  const mutationBlocked = status === 'unresolved' && entries.some((entry) => !['none', 'read'].includes(entry.operation.sideEffect));
  const conflictId = `conflict_${sha256(stableStringify({ operationId, field, candidates: candidates.map((entry) => entry.id) })).slice(0, 24)}`;
  const explanation = conflictExplanation(operationId, field, status, reasonCode, selected, override);
  return {
    selected,
    conflict: {
      id: conflictId,
      operationId,
      field,
      status,
      candidates,
      ...(status === 'resolved' ? { selectedCandidateId: selected.id } : {}),
      reasonCode,
      explanation,
      mutationBlocked,
      ...(override === undefined ? {} : { override }),
    },
  };
}

function deterministicCandidate(candidates: readonly EvidenceConflictCandidate[], policy: EvidenceAuthorityPolicyV1): EvidenceConflictCandidate {
  return [...candidates].sort((left, right) => candidateRank(left, policy) - candidateRank(right, policy) || left.id.localeCompare(right.id))[0] as EvidenceConflictCandidate;
}

function candidateRank(candidate: EvidenceConflictCandidate, policy: EvidenceAuthorityPolicyV1): number {
  return candidate.provenance.reduce((best, entry) => Math.min(best, policy.authorityOrder.indexOf(entry.authority)), Number.POSITIVE_INFINITY);
}

function conflictExplanation(
  operationId: string,
  field: string,
  status: EvidenceConflictRecord['status'],
  reasonCode: EvidenceConflictRecord['reasonCode'],
  selected: EvidenceConflictCandidate,
  override: EvidenceAuthorityPolicyV1['hostOverrides'][number] | undefined,
): string {
  if (reasonCode === 'HOST_OVERRIDE_APPLIED') return `Host override ${override?.scope} selected ${selected.id} for ${operationId}.${field}: ${override?.reason}`;
  if (reasonCode === 'HOST_OVERRIDE_NO_MATCH') return `Host override ${override?.scope} requested ${override?.authority}, but no candidate for ${operationId}.${field} has that authority.`;
  if (reasonCode === 'HOST_OVERRIDE_AMBIGUOUS') return `Host override ${override?.scope} matched more than one conflicting value for ${operationId}.${field}; no value was chosen.`;
  if (status === 'resolved') return `Declared authority order selected ${selected.id} for ${operationId}.${field}; competing lower-authority facts remain recorded.`;
  return `The strongest candidates for ${operationId}.${field} have equal authority; Brisk did not guess.`;
}

function validatePolicy(policy: EvidenceAuthorityPolicyV1): void {
  if (policy.schemaVersion !== 'brisk-aitesting.evidence-authority-policy.v1') throw new Error('Unsupported evidence authority policy version.');
  if (policy.authorityOrder.length !== ALL_AUTHORITIES.length
    || new Set(policy.authorityOrder).size !== ALL_AUTHORITIES.length
    || ALL_AUTHORITIES.some((authority) => !policy.authorityOrder.includes(authority))) {
    throw new Error('Evidence authority policy must list every authority exactly once.');
  }
  const scopes = new Set<string>();
  for (const override of policy.hostOverrides) {
    if (override.reason.trim().length === 0) throw new Error('Every host authority override requires a reason.');
    if (!/^operation:.+(?:\/field:[A-Za-z][A-Za-z0-9]*)?$/.test(override.scope)) throw new Error(`Host authority override scope "${override.scope}" is invalid.`);
    if (scopes.has(override.scope)) throw new Error(`Host authority override scope "${override.scope}" is declared more than once.`);
    scopes.add(override.scope);
  }
}

function mergeProvenance(values: readonly EvidenceProvenance[]): readonly EvidenceProvenance[] {
  const entries = new Map<string, EvidenceProvenance>();
  for (const entry of values) entries.set(provenanceKey(entry), entry);
  return [...entries.values()].sort((left, right) => provenanceKey(left).localeCompare(provenanceKey(right)));
}

function stableStringify(value: unknown): string {
  try { return JSON.stringify(sortValue(value)); } catch { return '[unserializable]'; }
}

function provenanceKey(value: EvidenceProvenance): string {
  return `${value.authority}\u0000${value.source}\u0000${value.revision ?? ''}\u0000${value.observedAt ?? ''}\u0000${value.confidence}`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, sortValue(entry)]));
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
