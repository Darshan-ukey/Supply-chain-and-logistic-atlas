import {
  evaluateFilter,
  filterFields,
  scalarEquals,
  type FilterContext,
  type Scalar,
} from '../domain/filter.js';
import { inWindow, type Action, type Rule, type Scope } from '../config/schemas.js';
import type {
  ApplicableGroup,
  AssertionViolation,
  ConflictResolution,
  DecisionCounts,
  EffectInstance,
  EvaluationMode,
  EvaluationResult,
  FieldConflict,
  GroupSkipReason,
  GroupTrace,
  PatchCandidate,
  PatchEntry,
  RuleTrace,
} from '../domain/types.js';
import { emptyDecisionCounts } from '../domain/types.js';
import type { CompiledGroup, CompiledRuleset } from './compile.js';

/**
 * The pure evaluation core (§4). No I/O, no clocks, no randomness:
 * same row, same ruleset version, same asOf — same output, forever.
 *
 * Single-pass by construction: verbs write to the PROPOSED patch, never to
 * the row being evaluated, so a rule's write can never trigger another rule
 * within the same evaluation (D1, §4.1).
 */

export interface EvaluateOptions {
  /** UTC instant every window check compares against. */
  asOf: string;
  mode: EvaluationMode;
  /** Caller-supplied row id, echoed into the decision record by the engine. */
  entityId?: string;
}

/**
 * Deterministic cross-group resolution order (§4.3):
 * specificity desc → priority desc → created-at asc → group id asc.
 */
export function resolutionOrder(a: CompiledGroup, b: CompiledGroup): number {
  if (a.specificity !== b.specificity) return b.specificity - a.specificity;
  if (a.definition.priority !== b.definition.priority) {
    return b.definition.priority - a.definition.priority;
  }
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.groupId < b.groupId ? -1 : a.groupId > b.groupId ? 1 : 0;
}

/** Which criterion separated winner from runner-up — recorded, explainable. */
function resolvedByCriterion(winner: PatchCandidate, runnerUp: PatchCandidate): ConflictResolution {
  if (winner.scopeSpecificity !== runnerUp.scopeSpecificity) return 'specificity';
  if (winner.groupPriority !== runnerUp.groupPriority) return 'priority';
  if (winner.groupCreatedAt !== runnerUp.groupCreatedAt) return 'created-at';
  return 'group-id';
}

function scopeMatches(scope: Scope, row: Record<string, unknown>, ctx: FilterContext): boolean {
  return scope.all.every((term) => {
    const v = row[term.field];
    switch (term.op) {
      case 'eq':
        return scalarEquals(v, term.value);
      case 'in':
        return term.values.some((x) => scalarEquals(v, x));
      case 'inSet': {
        const members = ctx.valueSet?.(term.set);
        if (members === undefined) return false; // validation prevents; fail closed
        return members.some((x) => scalarEquals(v, x));
      }
    }
  });
}

/** Fields a condition touches that are absent from the row (§7: SQL-null). */
function missingFields(fields: Set<string>, row: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const f of fields) if (!(f in row)) out.push(f);
  return out.sort();
}

function scalarify(v: unknown): Scalar {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}

/** Resolve "$row.<field>" references in effect payloads against the row. */
function resolveRowRefs(
  values: Record<string, Scalar>,
  row: Record<string, unknown>,
): Record<string, Scalar> {
  const out: Record<string, Scalar> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'string' && v.startsWith('$row.')) {
      out[k] = scalarify(row[v.slice('$row.'.length)]);
    } else {
      out[k] = v;
    }
  }
  return out;
}

interface GroupOutcome {
  trace: GroupTrace;
  matched: boolean;
  rulesFired: number;
  violations: AssertionViolation[];
  candidates: PatchCandidate[];
  effects: EffectInstance[];
  uniqueViolation: FieldConflict | null;
}

function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `r${index}`;
}

function evaluateGroup(
  group: CompiledGroup,
  row: Record<string, unknown>,
  asOf: string,
  via: 'index' | 'residual',
  ctx: FilterContext,
): GroupOutcome {
  const def = group.definition;
  const outcome: GroupOutcome = {
    trace: {
      groupId: group.groupId,
      version: group.version,
      name: def.name,
      via,
      rules: [],
    },
    matched: false,
    rulesFired: 0,
    violations: [],
    candidates: [],
    effects: [],
    uniqueViolation: null,
  };
  const skip = (reason: GroupSkipReason): GroupOutcome => {
    outcome.trace.skipped = reason;
    return outcome;
  };

  if (!inWindow(asOf, def.effectiveFrom, def.effectiveTo)) return skip('out-of-window');
  if (!scopeMatches(def.scope, row, ctx)) return skip('scope-miss');
  if (!def.filters.every((f) => evaluateFilter(f, row, ctx))) return skip('filters-miss');

  outcome.matched = true;

  // --- match rules under the group's hit policy ---
  const fired: Array<{ rule: Rule; id: string }> = [];
  def.rules.forEach((rule, i) => {
    const id = ruleId(rule, i);
    const rt: RuleTrace = { ruleId: id, fired: false };
    if (rule.name !== undefined) rt.name = rule.name;
    outcome.trace.rules.push(rt);

    if (!inWindow(asOf, rule.effectiveFrom, rule.effectiveTo)) {
      rt.outOfWindow = true;
      return;
    }
    const unevaluable = missingFields(filterFields(rule.when), row);
    if (unevaluable.length > 0) rt.unevaluableFields = unevaluable;

    if (!evaluateFilter(rule.when, row, ctx)) return;

    if (def.hitPolicy === 'first' && fired.length > 0) {
      rt.shadowed = true;
      return;
    }
    rt.fired = true;
    fired.push({ rule, id });
  });

  if (def.hitPolicy === 'unique' && fired.length > 1) {
    // The group is contested: no actions execute, the collision is surfaced.
    outcome.uniqueViolation = {
      kind: 'unique-violated',
      field: '*',
      candidates: [],
      winner: null,
      resolvedBy: null,
      ruleIds: fired.map((f) => f.id),
    };
    for (const rt of outcome.trace.rules) if (rt.fired) outcome.rulesFired += 1;
    return outcome;
  }

  outcome.rulesFired = fired.length;

  // --- execute actions of fired rules ---
  for (const { rule, id } of fired) {
    for (const action of rule.then) {
      executeAction(action, group, id, row, asOf, ctx, outcome);
    }
  }
  return outcome;
}

function executeAction(
  action: Action,
  group: CompiledGroup,
  ruleIdStr: string,
  row: Record<string, unknown>,
  asOf: string,
  ctx: FilterContext,
  outcome: GroupOutcome,
): void {
  void asOf;
  switch (action.verb) {
    case 'assert': {
      // Track missing fields the check touches on the rule's trace entry.
      const rt = outcome.trace.rules.find((r) => r.ruleId === ruleIdStr);
      const unevaluable = missingFields(filterFields(action.check), row);
      if (rt && unevaluable.length > 0) {
        rt.unevaluableFields = [...new Set([...(rt.unevaluableFields ?? []), ...unevaluable])].sort();
      }
      if (!evaluateFilter(action.check, row, ctx)) {
        const violation: AssertionViolation = {
          groupId: group.groupId,
          groupVersion: group.version,
          ruleId: ruleIdStr,
          field: action.field,
          check: action.check,
        };
        if (action.message !== undefined) violation.message = action.message;
        outcome.violations.push(violation);
      }
      return;
    }
    case 'default': {
      const current = row[action.field];
      if (current !== null && current !== undefined && current !== '') return; // occupied — defaults never overwrite
      pushCandidate(action.field, action.value, 'default', action.reason, group, ruleIdStr, outcome);
      return;
    }
    case 'set': {
      pushCandidate(action.field, action.value, 'set', action.reason, group, ruleIdStr, outcome);
      return;
    }
    case 'effect': {
      const effect: EffectInstance = {
        groupId: group.groupId,
        groupVersion: group.version,
        ruleId: ruleIdStr,
        target: {
          entity: action.target.entity,
          op: action.target.op,
          key: resolveRowRefs(action.target.key, row),
          set: resolveRowRefs(action.target.set, row),
        },
      };
      if (action.message !== undefined) effect.message = action.message;
      outcome.effects.push(effect);
      return;
    }
  }
}

function pushCandidate(
  field: string,
  value: Scalar,
  verb: 'default' | 'set',
  reason: string | undefined,
  group: CompiledGroup,
  ruleIdStr: string,
  outcome: GroupOutcome,
): void {
  const candidate: PatchCandidate = {
    groupId: group.groupId,
    groupVersion: group.version,
    ruleId: ruleIdStr,
    verb,
    field,
    value,
    groupPriority: group.definition.priority,
    scopeSpecificity: group.specificity,
    groupCreatedAt: group.createdAt,
  };
  if (reason !== undefined) candidate.reason = reason;
  outcome.candidates.push(candidate);
}

/** Evaluate one row against a compiled ruleset. Pure. */
export function evaluateRuleset(
  ruleset: CompiledRuleset,
  entity: string,
  row: Record<string, unknown>,
  opts: EvaluateOptions,
): EvaluationResult {
  const ctx = ruleset.registry.filterContext();
  const { viaIndex, viaResidual } = ruleset.candidatesFor(entity, row);

  // One ordered pass: resolution order is also trace order, so what the
  // caller reads top-to-bottom is exactly how precedence was decided.
  const ordered: Array<{ group: CompiledGroup; via: 'index' | 'residual' }> = [
    ...viaIndex.map((group) => ({ group, via: 'index' as const })),
    ...viaResidual.map((group) => ({ group, via: 'residual' as const })),
  ].sort((a, b) => resolutionOrder(a.group, b.group));

  const counts: DecisionCounts = emptyDecisionCounts();
  const assertions: AssertionViolation[] = [];
  const effects: EffectInstance[] = [];
  const conflicts: FieldConflict[] = [];
  const trace: GroupTrace[] = [];
  const byField = new Map<string, PatchCandidate[]>();

  for (const { group, via } of ordered) {
    const outcome = evaluateGroup(group, row, opts.asOf, via, ctx);
    trace.push(outcome.trace);
    counts.groupsConsidered += 1;
    if (outcome.matched) counts.groupsMatched += 1;
    counts.rulesFired += outcome.rulesFired;
    assertions.push(...outcome.violations);
    effects.push(...outcome.effects);
    if (outcome.uniqueViolation) conflicts.push(outcome.uniqueViolation);
    for (const c of outcome.candidates) {
      const list = byField.get(c.field);
      if (list) list.push(c);
      else byField.set(c.field, [c]);
    }
  }

  // --- cross-group patch resolution (§4.3) ---
  // Candidates arrive in resolution order, so index 0 is always the winner.
  const patch: PatchEntry[] = [];
  for (const [field, candidates] of [...byField.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const winner = candidates[0]!;
    const entry: PatchEntry = {
      field,
      value: winner.value,
      verb: winner.verb,
      groupId: winner.groupId,
      groupVersion: winner.groupVersion,
      ruleId: winner.ruleId,
    };
    if (winner.reason !== undefined) entry.reason = winner.reason;
    patch.push(entry);

    const distinct = new Set(candidates.map((c) => JSON.stringify(c.value)));
    if (distinct.size > 1) {
      conflicts.push({
        kind: 'same-field-write',
        field,
        candidates,
        winner: 0,
        resolvedBy: resolvedByCriterion(winner, candidates[1]!),
      });
    }
  }

  counts.assertions = assertions.length;
  counts.patched = patch.length;
  counts.effects = effects.length;
  counts.conflicts = conflicts.length;

  return {
    entity,
    asOf: opts.asOf,
    rulesetVersion: ruleset.rulesetVersion,
    mode: opts.mode,
    assertions,
    patch,
    effects,
    conflicts,
    trace,
  };
}

/**
 * applicable() (§7, D6): discovery over a PARTIAL property set — no rule
 * evaluation, no full row. A group is applicable when its scope is CONSISTENT
 * with the given properties: terms on provided fields must match; terms on
 * absent fields cannot rule the group out.
 */
export function applicableGroups(
  ruleset: CompiledRuleset,
  entity: string,
  props: Record<string, unknown>,
  asOf: string,
): ApplicableGroup[] {
  const ctx = ruleset.registry.filterContext();
  return ruleset
    .entityGroups(entity)
    .filter((group) => {
      const def = group.definition;
      if (!inWindow(asOf, def.effectiveFrom, def.effectiveTo)) return false;
      return def.scope.all.every((term) => {
        if (!(term.field in props)) return true; // unknown — cannot exclude
        return scopeMatches({ all: [term] }, props, ctx);
      });
    })
    .sort(resolutionOrder)
    .map((group) => {
      const def = group.definition;
      const out: ApplicableGroup = {
        groupId: group.groupId,
        version: group.version,
        name: def.name,
        entity: def.entity,
        scope: def.scope,
        hitPolicy: def.hitPolicy,
        ruleCount: def.rules.length,
      };
      if (def.effectiveFrom !== undefined) out.effectiveFrom = def.effectiveFrom;
      if (def.effectiveTo !== undefined) out.effectiveTo = def.effectiveTo;
      return out;
    });
}
