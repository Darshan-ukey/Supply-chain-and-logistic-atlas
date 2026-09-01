import type { FilterExpr, Scalar } from './filter.js';
import type { GroupDefinition } from '../config/schemas.js';

/**
 * Backend-free runtime shapes. Everything here is JSON-serializable —
 * decision records persist these verbatim, and the REST surface returns them
 * unchanged. All timestamps are ISO-8601 UTC instants.
 */

// ---------------------------------------------------------------------------
// Group lifecycle (§6)
// ---------------------------------------------------------------------------

export type GroupState = 'draft' | 'pending' | 'active' | 'retired';
export const GROUP_STATES = ['draft', 'pending', 'active', 'retired'] as const;

/** Registry-conformance verdict from the last revalidation sweep (§5.3). */
export type GroupValidity = 'valid' | 'degraded' | 'broken' | 'unchecked';

/** One recorded lifecycle transition — the engine's half of the audit trail. */
export interface GroupTransition {
  to: GroupState;
  actor: string;
  at: string;
  reason?: string;
}

/**
 * The mutable head of a rule group: current state, the working draft, and a
 * pointer to the version that is live. Editing never touches an activated
 * version — it changes the draft, and the next activation snapshots it.
 */
export interface GroupHead {
  id: string;
  entity: string;
  name: string;
  state: GroupState;
  /** Highest version number ever snapshotted for this group (0 = none yet). */
  latestVersion: number;
  /** The version currently evaluating, or null when none is active. */
  activeVersion: number | null;
  draft: GroupDefinition;
  validity: GroupValidity;
  transitions: GroupTransition[];
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
}

/** An immutable activation snapshot — what the evaluator and auditors read. */
export interface GroupVersionRecord {
  groupId: string;
  version: number;
  definition: GroupDefinition;
  /** Registry version this definition validated against (schema-drift pin). */
  registryVersion: number;
  createdAt: string;
  activatedBy: string;
  /** Set when this version stopped being the active one. */
  supersededAt?: string;
  retiredBy?: string;
}

// ---------------------------------------------------------------------------
// Evaluation outputs (§4, §7)
// ---------------------------------------------------------------------------

export type EvaluationMode = 'explain' | 'apply';

/** A failed `assert` — the row disagrees with a rule that applies to it. */
export interface AssertionViolation {
  groupId: string;
  groupVersion: number;
  ruleId: string;
  field: string;
  check: FilterExpr;
  message?: string;
}

/** One candidate write produced by a `default`/`set` action. */
export interface PatchCandidate {
  groupId: string;
  groupVersion: number;
  ruleId: string;
  verb: 'default' | 'set';
  field: string;
  value: Scalar;
  reason?: string;
  /** Cross-group ordering inputs, recorded so resolutions are explainable. */
  groupPriority: number;
  scopeSpecificity: number;
  groupCreatedAt: string;
}

/** A resolved write in the final proposed patch. */
export interface PatchEntry {
  field: string;
  value: Scalar;
  verb: 'default' | 'set';
  groupId: string;
  groupVersion: number;
  ruleId: string;
  reason?: string;
}

/** An effect descriptor with $row.* references resolved — host executes it. */
export interface EffectInstance {
  groupId: string;
  groupVersion: number;
  ruleId: string;
  target: {
    entity: string;
    op: 'insert' | 'update' | 'upsert';
    key: Record<string, Scalar>;
    set: Record<string, Scalar>;
  };
  message?: string;
}

export type ConflictKind =
  /** Two or more groups (or rules under hitPolicy 'all') wrote one field. */
  | 'same-field-write'
  /** A group with hitPolicy 'unique' had more than one rule match. */
  | 'unique-violated';

export type ConflictResolution = 'specificity' | 'priority' | 'created-at' | 'group-id';

/**
 * A same-field collision. `apply()` resolves it deterministically
 * (specificity → priority → created-at → group id) and records how;
 * `explain()` carries every candidate so the caller sees the collision.
 */
export interface FieldConflict {
  kind: ConflictKind;
  /** The contested field; "*" for unique-violated (the whole group is contested). */
  field: string;
  candidates: PatchCandidate[];
  /** Index into candidates; null only when kind = 'unique-violated'. */
  winner: number | null;
  resolvedBy: ConflictResolution | null;
  /** For unique-violated: the rules that matched when only one was allowed to. */
  ruleIds?: string[];
}

export type GroupSkipReason =
  | 'not-active'
  | 'out-of-window'
  | 'scope-miss'
  | 'filters-miss';

export interface RuleTrace {
  ruleId: string;
  name?: string;
  fired: boolean;
  /** Rule-level window excluded it at this asOf. */
  outOfWindow?: boolean;
  /** Suppressed by hitPolicy 'first' after an earlier rule fired. */
  shadowed?: boolean;
  /** Fields the condition touched that were missing from the row (SQL-null). */
  unevaluableFields?: string[];
}

/** Why each candidate group did or did not participate — the honesty layer. */
export interface GroupTrace {
  groupId: string;
  version: number;
  name: string;
  /** How the group became a candidate: index lookup or residual scan. */
  via: 'index' | 'residual';
  skipped?: GroupSkipReason;
  rules: RuleTrace[];
}

/** The pure evaluation verdict — same inputs, same output, forever. */
export interface EvaluationResult {
  entity: string;
  asOf: string;
  rulesetVersion: number;
  mode: EvaluationMode;
  assertions: AssertionViolation[];
  patch: PatchEntry[];
  effects: EffectInstance[];
  conflicts: FieldConflict[];
  trace: GroupTrace[];
}

/** Output of applicable(): discovery without evaluation (§7, D6). */
export interface ApplicableGroup {
  groupId: string;
  version: number;
  name: string;
  entity: string;
  scope: GroupDefinition['scope'];
  hitPolicy: GroupDefinition['hitPolicy'];
  ruleCount: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

// ---------------------------------------------------------------------------
// Decision log (§2.5, §8)
// ---------------------------------------------------------------------------

export interface DecisionCounts {
  groupsConsidered: number;
  groupsMatched: number;
  rulesFired: number;
  assertions: number;
  patched: number;
  effects: number;
  conflicts: number;
}

export function emptyDecisionCounts(): DecisionCounts {
  return {
    groupsConsidered: 0,
    groupsMatched: 0,
    rulesFired: 0,
    assertions: 0,
    patched: 0,
    effects: 0,
    conflicts: 0,
  };
}

/** One evaluation, durably recorded. apply() always writes one (§4). */
export interface DecisionRecord {
  /** Time-ordered uuidv7. */
  id: string;
  entity: string;
  /** The evaluated row's id when the caller supplied one. */
  entityId: string | null;
  asOf: string;
  rulesetVersion: number;
  mode: EvaluationMode;
  matched: Array<{ groupId: string; version: number }>;
  counts: DecisionCounts;
  result: EvaluationResult;
  createdAt: string;
}
