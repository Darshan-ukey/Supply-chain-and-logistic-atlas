import { createHash } from 'node:crypto';
import { ConfigInvalidError, type ErrorIssue } from '../domain/errors.js';
import { baseAlias, parseColumnRef, relationAliases } from './relation.js';
import {
  filterColumns,
  grainYieldsSteps,
  type Attribute,
  type ClassifierPart,
  type FilterExpr,
  type SourceBinding,
  type StreamDefinition,
  type StreamFilters,
} from './schemas.js';

/**
 * Tier-2 validation: the cross-field rules zod cannot express.
 *
 * The guiding rule is that a configuration mistake must surface HERE, as a
 * message naming the fix — never downstream as a confidently wrong process
 * map. A map that is silently wrong is worse than no map, because it reaches a
 * steering committee looking exactly like a correct one.
 */

export interface ValidationResult {
  errors: ErrorIssue[];
  /** Real problems that do not block: a working config with a sharp edge. */
  warnings: ErrorIssue[];
}

export function isValid(result: ValidationResult): boolean {
  return result.errors.length === 0;
}

/** Throw a ConfigInvalidError carrying every issue, if any errors were found. */
export function assertValid(result: ValidationResult, subject: string): void {
  if (result.errors.length === 0) return;
  throw new ConfigInvalidError(
    `${subject} is not valid`,
    result.errors.map((e) => `${e.path}: ${e.message}`),
    result.errors,
  );
}

function err(into: ErrorIssue[], path: string, message: string, code?: string): void {
  into.push(code !== undefined ? { path, message, code } : { path, message });
}

// ---------------------------------------------------------------------------
// Binding
// ---------------------------------------------------------------------------

/**
 * Validate one source binding.
 *
 * `knownConnections` is optional: when the caller has a live registry it can
 * catch a dangling connectionRef here rather than at first query.
 */
export function validateBinding(
  binding: SourceBinding,
  opts: { path?: string; knownConnections?: ReadonlySet<string> } = {},
): ValidationResult {
  const base = opts.path ?? `binding[${binding.id}]`;
  const errors: ErrorIssue[] = [];
  const warnings: ErrorIssue[] = [];
  const { roles, grain } = binding;

  if (opts.knownConnections !== undefined && !opts.knownConnections.has(binding.connectionRef)) {
    err(
      errors,
      `${base}.connectionRef`,
      `unknown connection ${JSON.stringify(binding.connectionRef)}`,
      'UNKNOWN_CONNECTION',
    );
  }

  // --- timestamps required by grain ---------------------------------------
  if (grain === 'event' && roles.timestamp === undefined) {
    err(errors, `${base}.roles.timestamp`, "grain 'event' requires roles.timestamp", 'MISSING_ROLE');
  }
  if (grain === 'interval') {
    if (roles.start === undefined) {
      err(errors, `${base}.roles.start`, "grain 'interval' requires roles.start", 'MISSING_ROLE');
    }
    if (roles.end === undefined) {
      err(errors, `${base}.roles.end`, "grain 'interval' requires roles.end", 'MISSING_ROLE');
    }
    if (roles.timestamp !== undefined) {
      err(
        warnings,
        `${base}.roles.timestamp`,
        "grain 'interval' derives events from start and end; roles.timestamp is ignored",
        'IGNORED_ROLE',
      );
    }
  }

  // --- activity ------------------------------------------------------------
  if (grainYieldsSteps(grain) && roles.activity === undefined) {
    err(
      errors,
      `${base}.roles.activity`,
      `grain '${grain}' contributes steps and so requires roles.activity`,
      'MISSING_ROLE',
    );
  }
  if (grain === 'snapshot') {
    if (roles.activity !== undefined) {
      err(
        warnings,
        `${base}.roles.activity`,
        "grain 'snapshot' contributes case attributes only; roles.activity is ignored",
        'IGNORED_ROLE',
      );
    }
    if (binding.attributes.length === 0) {
      err(
        warnings,
        `${base}.attributes`,
        "grain 'snapshot' with no attributes contributes nothing — map the columns you want on the case, or drop the binding",
        'EMPTY_SNAPSHOT',
      );
    }
  }

  // --- case correlation ----------------------------------------------------
  if (roles.case === undefined && binding.objects.length === 0) {
    err(
      errors,
      `${base}.roles.case`,
      'a binding needs either roles.case or at least one entry in objects, otherwise its rows cannot be correlated into cases',
      'NO_CORRELATION',
    );
  }

  // --- object links --------------------------------------------------------
  const seenTypes = new Set<string>();
  for (const [i, link] of binding.objects.entries()) {
    if (seenTypes.has(link.type)) {
      err(
        errors,
        `${base}.objects[${i}].type`,
        `duplicate object type ${JSON.stringify(link.type)} in one binding`,
        'DUPLICATE_OBJECT_TYPE',
      );
    }
    seenTypes.add(link.type);
  }

  // --- attributes ----------------------------------------------------------
  const seenNames = new Set<string>();
  for (const [i, attr] of (binding.attributes as Attribute[]).entries()) {
    const name = attr.as ?? attr.column;
    if (seenNames.has(name)) {
      err(
        errors,
        `${base}.attributes[${i}]`,
        `duplicate attribute name ${JSON.stringify(name)} — set a distinct 'as'`,
        'DUPLICATE_ATTRIBUTE',
      );
    }
    seenNames.add(name);
  }

  // --- the relation and its aliases ---------------------------------------
  const aliases = relationAliases(binding.from);
  const seenAliases = new Set<string>();
  for (const alias of aliases) {
    if (seenAliases.has(alias)) {
      err(
        errors,
        `${base}.from`,
        `duplicate table alias ${JSON.stringify(alias)} — every table in a relation needs its own alias`,
        'DUPLICATE_ALIAS',
      );
    }
    seenAliases.add(alias);
  }

  // A join key may only reference tables already in the relation. Caught here
  // because the alternative is an opaque "missing FROM-clause entry" from the
  // database, several layers away from the config that caused it.
  const introduced = new Set<string>([baseAlias(binding.from)]);
  for (const [i, join] of binding.from.joins.entries()) {
    for (const [k, key] of join.on.entries()) {
      if (!introduced.has(key.leftAlias)) {
        err(
          errors,
          `${base}.from.joins[${i}].on[${k}].leftAlias`,
          `unknown alias ${JSON.stringify(key.leftAlias)} — a join key may only reference a table already joined. Available: ${[...introduced].join(', ')}`,
          'UNKNOWN_ALIAS',
        );
      }
      if (key.rightAlias !== join.alias) {
        err(
          errors,
          `${base}.from.joins[${i}].on[${k}].rightAlias`,
          `rightAlias must be ${JSON.stringify(join.alias)}, the table being joined`,
          'UNKNOWN_ALIAS',
        );
      }
    }
    if (join.type === 'inner') {
      err(
        warnings,
        `${base}.from.joins[${i}].type`,
        `an inner join DROPS every row with no match in ${JSON.stringify(join.alias)}; those events vanish from the log and the process will look cleaner than it is. Use 'left' unless the loss is intended`,
        'INNER_JOIN_DROPS_EVENTS',
      );
    }
    introduced.add(join.alias);
  }

  // Every column reference must name a table in the relation.
  for (const [where, reference] of referencedColumns(binding)) {
    const { alias } = parseColumnRef(reference);
    if (alias !== undefined && !seenAliases.has(alias)) {
      err(
        errors,
        `${base}.${where}`,
        `column ${JSON.stringify(reference)} names alias ${JSON.stringify(alias)}, which is not in this binding's relation. Available: ${aliases.join(', ')}`,
        'UNKNOWN_ALIAS',
      );
    }
  }

  // --- naive-timestamp timezones ------------------------------------------
  // Setting tz on a column that is already timestamptz shifts every event and
  // silently reorders the log, so it is called out even though it is legal.
  for (const [role, ref] of [
    ['timestamp', roles.timestamp],
    ['start', roles.start],
    ['end', roles.end],
  ] as const) {
    if (ref !== undefined && ref.tz !== undefined) {
      err(
        warnings,
        `${base}.roles.${role}.tz`,
        `tz is for NAIVE local-time columns only; on a timestamptz column it shifts every event and reorders the log`,
        'NAIVE_TIMEZONE',
      );
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------

export interface StreamValidationResult extends ValidationResult {
  /** Object types declared across all bindings — the legal case-key choices. */
  objectTypes: string[];
  /** True when at least one binding contributes steps. */
  canDiscoverControlFlow: boolean;
}

export function validateStream(
  stream: StreamDefinition,
  opts: { knownConnections?: ReadonlySet<string> } = {},
): StreamValidationResult {
  const errors: ErrorIssue[] = [];
  const warnings: ErrorIssue[] = [];

  const seenIds = new Set<string>();
  const objectTypes = new Set<string>();
  let stepSources = 0;

  /**
   * An imported stream is already extracted, so there is nothing here to check.
   *
   * Every rule below is about SQL — a table that exists, a column that plays a
   * role, a connection that is known. A log that came from a file has none of
   * those and never will, so running the rules over it would report the
   * absence of a host as a fault in the configuration.
   */
  if (stream.file !== undefined) {
    return {
      errors,
      warnings,
      objectTypes: stream.defaultCaseObject === undefined ? [] : [stream.defaultCaseObject],
      canDiscoverControlFlow: stream.file.events > 0,
    };
  }

  for (const binding of stream.bindings) {
    if (seenIds.has(binding.id)) {
      err(
        errors,
        `bindings[${binding.id}]`,
        `duplicate binding id ${JSON.stringify(binding.id)}`,
        'DUPLICATE_BINDING',
      );
    }
    seenIds.add(binding.id);

    const sub = validateBinding(binding, {
      path: `bindings[${binding.id}]`,
      ...(opts.knownConnections !== undefined ? { knownConnections: opts.knownConnections } : {}),
    });
    errors.push(...sub.errors);
    warnings.push(...sub.warnings);

    for (const link of binding.objects) objectTypes.add(link.type);
    if (grainYieldsSteps(binding.grain)) stepSources += 1;
  }

  // --- the honest refusal, surfaced at configuration time ------------------
  // Not an error: performance and organizational mining over interval data
  // still work, and a host may legitimately want exactly that. But it must be
  // impossible to reach a process map without having been told.
  if (stepSources === 0) {
    err(
      warnings,
      'bindings',
      'every binding is snapshot grain, so no source retains transitions: the control-flow perspective will be refused. Bind an append-only (event) or start/end (interval) source to enable process discovery',
      'NO_CONTROL_FLOW',
    );
  }

  // --- default case object must exist --------------------------------------
  if (stream.defaultCaseObject !== undefined && !objectTypes.has(stream.defaultCaseObject)) {
    err(
      errors,
      'defaultCaseObject',
      objectTypes.size === 0
        ? `defaultCaseObject ${JSON.stringify(stream.defaultCaseObject)} is set but no binding declares any object links`
        : `unknown object type ${JSON.stringify(stream.defaultCaseObject)} — declared types: ${[...objectTypes].sort().join(', ')}`,
      'UNKNOWN_OBJECT_TYPE',
    );
  }

  // --- per-binding filter overrides must target real bindings --------------
  for (const bindingId of Object.keys(stream.filters.where)) {
    if (!seenIds.has(bindingId)) {
      err(
        errors,
        `filters.where[${bindingId}]`,
        `filter targets unknown binding ${JSON.stringify(bindingId)}`,
        'UNKNOWN_BINDING',
      );
    }
  }

  // --- silent truncation is never silent -----------------------------------
  if (stream.filters.caseLimit > 0) {
    err(
      warnings,
      'filters.caseLimit',
      `caseLimit ${stream.filters.caseLimit} bounds this stream to a SUBSET of cases; every figure derived from it is a sample, not a total`,
      'BOUNDED_COVERAGE',
    );
  }

  return {
    errors,
    warnings,
    objectTypes: [...objectTypes].sort(),
    canDiscoverControlFlow: stepSources > 0,
  };
}

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON with sorted object keys, so two structurally identical
 * configurations always hash the same regardless of authoring order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/**
 * Fingerprint of everything that changes WHICH ROWS a stream materialises,
 * excluding the time window — the window is tracked separately as coverage,
 * because widening it should append rather than invalidate.
 *
 * Bindings are part of the fingerprint: re-pointing a binding at another table
 * or remapping a role changes the meaning of already-materialised rows, and
 * reusing them would silently mix two definitions in one file.
 */
export function filterFingerprint(stream: StreamDefinition): string {
  const material = {
    bindings: [...stream.bindings]
      .map((b) => ({
        id: b.id,
        connectionRef: b.connectionRef,
        from: b.from,
        grain: b.grain,
        roles: b.roles,
        objects: b.objects,
        attributes: b.attributes,
        where: b.where ?? null,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    where: stream.filters.where,
    caseLimit: stream.filters.caseLimit,
    defaultCaseObject: stream.defaultCaseObject ?? null,
  };
  return createHash('sha256').update(canonicalJson(material)).digest('hex').slice(0, 32);
}

/**
 * Every column reference in a binding, paired with where it was written, so a
 * message can point at the field rather than just naming the column.
 */
export function referencedColumns(binding: SourceBinding): [string, string][] {
  const out: [string, string][] = [];
  const { roles } = binding;
  if (roles.case !== undefined) out.push(['roles.case', roles.case]);
  if (roles.resource !== undefined) out.push(['roles.resource', roles.resource]);
  if (roles.duration !== undefined) out.push(['roles.duration', roles.duration]);
  if (roles.lifecycle !== undefined) out.push(['roles.lifecycle', roles.lifecycle]);
  for (const [role, ref] of [
    ['timestamp', roles.timestamp],
    ['start', roles.start],
    ['end', roles.end],
  ] as const) {
    if (ref !== undefined) out.push([`roles.${role}.column`, ref.column]);
  }
  if (roles.activity !== undefined) {
    for (const [i, part] of roles.activity.columns.entries()) {
      out.push([`roles.activity.columns[${i}]`, classifierColumn(part)]);
    }
  }
  for (const [i, link] of binding.objects.entries()) {
    out.push([`objects[${i}].column`, link.column]);
  }
  for (const [i, attr] of (binding.attributes as Attribute[]).entries()) {
    out.push([`attributes[${i}].column`, attr.column]);
  }
  if (binding.where !== undefined) {
    for (const c of filterColumns(binding.where)) out.push(['where', c]);
  }
  return out;
}

/**
 * The physical column a classifier part reads.
 *
 * Introspection checks care whether the COLUMN exists; whether a JSON key
 * inside it exists is not something a schema can answer, and pretending
 * otherwise would reject a valid binding.
 */
export function classifierColumn(part: ClassifierPart): string {
  return typeof part === 'string' ? part : part.column;
}

/** Every column a binding references, for bind-time introspection checks. */
export function bindingColumns(binding: SourceBinding): Set<string> {
  const cols = new Set<string>();
  const { roles } = binding;
  if (roles.case !== undefined) cols.add(roles.case);
  if (roles.resource !== undefined) cols.add(roles.resource);
  if (roles.duration !== undefined) cols.add(roles.duration);
  if (roles.lifecycle !== undefined) cols.add(roles.lifecycle);
  for (const ref of [roles.timestamp, roles.start, roles.end]) {
    if (ref !== undefined) cols.add(ref.column);
  }
  if (roles.activity !== undefined) {
    for (const part of roles.activity.columns) cols.add(classifierColumn(part));
  }
  for (const link of binding.objects) cols.add(link.column);
  for (const attr of binding.attributes as Attribute[]) cols.add(attr.column);
  if (binding.where !== undefined) for (const c of filterColumns(binding.where)) cols.add(c);
  return cols;
}

/** Columns a stream-level filter adds on top of a binding's own. */
export function streamFilterColumns(filters: StreamFilters, bindingId: string): Set<string> {
  const expr: FilterExpr | undefined = filters.where[bindingId];
  return expr === undefined ? new Set() : filterColumns(expr);
}
