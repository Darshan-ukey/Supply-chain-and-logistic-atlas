import { filterFields, scalarEquals, type Scalar } from '../domain/filter.js';
import type { CompiledRegistry } from '../domain/registry.js';
import type { GroupDefinition, Scope, ScopeTerm } from '../config/schemas.js';

/**
 * Static rule-analysis helpers for the consistency tier (§5.2) and the D6
 * query surface. Everything here is best-effort and conservative: overlap
 * detection may report "possible" for pairs that never co-occur in real
 * data, but must never miss a pair that can.
 */

/** Fields a definition WRITES (set/default targets). Asserts don't write. */
export function writtenFields(def: GroupDefinition, into: Set<string> = new Set()): Set<string> {
  for (const rule of def.rules) {
    for (const action of rule.then) {
      if (action.verb === 'set' || action.verb === 'default') into.add(action.field);
    }
  }
  return into;
}

/** Fields a definition reads or writes — the queryGroups(touchesField) set. */
export function touchedFields(def: GroupDefinition, into: Set<string> = new Set()): Set<string> {
  for (const term of def.scope.all) into.add(term.field);
  for (const f of def.filters) filterFields(f, into);
  for (const rule of def.rules) {
    filterFields(rule.when, into);
    for (const action of rule.then) {
      if (action.verb === 'effect') continue;
      into.add(action.field);
      if (action.verb === 'assert') filterFields(action.check, into);
    }
  }
  return into;
}

/** Fields a definition's effects touch, per target entity. */
export function effectTouchedFields(def: GroupDefinition): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const rule of def.rules) {
    for (const action of rule.then) {
      if (action.verb !== 'effect') continue;
      let set = out.get(action.target.entity);
      if (!set) {
        set = new Set();
        out.set(action.target.entity, set);
      }
      for (const k of Object.keys(action.target.key)) set.add(k);
      for (const k of Object.keys(action.target.set)) set.add(k);
    }
  }
  return out;
}

/** The values a scope term accepts; null = unbounded/unresolvable. */
function acceptedValues(term: ScopeTerm, registry: CompiledRegistry): Scalar[] | null {
  switch (term.op) {
    case 'eq':
      return [term.value];
    case 'in':
      return [...term.values];
    case 'inSet': {
      const members = registry.valueSet(term.set);
      return members === undefined ? null : [...members];
    }
  }
}

/**
 * Can one row satisfy both scopes? Conservative: for every field constrained
 * by BOTH scopes, the accepted-value sets must intersect; a field constrained
 * by only one scope never excludes overlap. Unresolvable terms count as
 * overlapping (fail open — this feeds warnings, not enforcement).
 */
export function scopesMayOverlap(a: Scope, b: Scope, registry: CompiledRegistry): boolean {
  const byFieldA = new Map<string, ScopeTerm[]>();
  for (const t of a.all) {
    const list = byFieldA.get(t.field);
    if (list) list.push(t);
    else byFieldA.set(t.field, [t]);
  }
  for (const tb of b.all) {
    const tas = byFieldA.get(tb.field);
    if (!tas) continue;
    const bVals = acceptedValues(tb, registry);
    if (bVals === null) continue;
    for (const ta of tas) {
      const aVals = acceptedValues(ta, registry);
      if (aVals === null) continue;
      const intersects = aVals.some((av) => bVals.some((bv) => av === bv));
      if (!intersects) return false;
    }
  }
  return true;
}

/** Does the scope explicitly constrain `field` to a set accepting `value`? */
export function scopeAccepts(scope: Scope, field: string, value: Scalar, registry: CompiledRegistry): boolean {
  const terms = scope.all.filter((t) => t.field === field);
  if (terms.length === 0) return false; // not scoped to this field at all
  return terms.every((term) => {
    const values = acceptedValues(term, registry);
    if (values === null) return false;
    return values.some((v) => scalarEquals(value, v));
  });
}

/** Case-insensitive text search across the human-facing strings of a group. */
export function definitionMatchesText(def: GroupDefinition, needle: string): boolean {
  const q = needle.toLowerCase();
  if (def.name.toLowerCase().includes(q)) return true;
  for (const rule of def.rules) {
    if (rule.name?.toLowerCase().includes(q)) return true;
    for (const action of rule.then) {
      const message = action.verb === 'assert' || action.verb === 'effect' ? action.message : action.reason;
      if (message?.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

export interface ConsistencyFinding {
  kind: 'overlapping-writes' | 'contradictory-asserts';
  entity: string;
  field: string;
  groups: Array<{ groupId: string; name: string }>;
  message: string;
}

export interface AnalyzableGroup {
  groupId: string;
  name: string;
  definition: GroupDefinition;
}

/**
 * Pairwise cross-group analysis (§4.3, §5.2): find group pairs whose scopes
 * can both match one row AND both write the same field. Cheap for the
 * restricted scope grammar; quadratic in groups-per-entity, which stays
 * small in practice per entity.
 */
export function findOverlappingWrites(
  groups: AnalyzableGroup[],
  registry: CompiledRegistry,
): ConsistencyFinding[] {
  const findings: ConsistencyFinding[] = [];
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const a = groups[i]!;
      const b = groups[j]!;
      if (a.definition.entity !== b.definition.entity) continue;
      const shared = [...writtenFields(a.definition)].filter((f) =>
        writtenFields(b.definition).has(f),
      );
      if (shared.length === 0) continue;
      if (!scopesMayOverlap(a.definition.scope, b.definition.scope, registry)) continue;
      for (const field of shared.sort()) {
        findings.push({
          kind: 'overlapping-writes',
          entity: a.definition.entity,
          field,
          groups: [
            { groupId: a.groupId, name: a.name },
            { groupId: b.groupId, name: b.name },
          ],
          message: `groups "${a.name}" and "${b.name}" can both match one ${a.definition.entity} row and both write "${field}" — resolution order will decide (§4.3)`,
        });
      }
    }
  }
  return findings;
}
