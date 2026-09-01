import type { AttachmentRef } from './schemas.js';

/**
 * WHAT THE ENGINE IS ALLOWED TO KNOW ABOUT THE WORK IT IS ABOUT.
 *
 * The answer is: the labels, the values, and nothing else.
 *
 * A person resolving a query needs to see the thing the query is about — for
 * an invoice queue that is the reference, the counterparty, the amount, the
 * dates, the files. For a booking queue it is the vessel, the ports, the cargo
 * type. If this engine held either of those shapes it would be an invoice tool
 * pretending to be general, and the second queue would need a second engine.
 *
 * So the host DECLARES what a subject carries, per queue, and hands over an
 * ordered list of label/value/kind. The engine stores it, indexes the fields
 * the declaration marks searchable, renders it, and never learns what any of
 * it means. That is the whole contract, and it is the reason this engine
 * survives contact with the second client.
 */

export type FieldKind = 'text' | 'number' | 'money' | 'date' | 'instant' | 'boolean' | 'code';

/** One field the host says a subject of this queue carries. */
export interface SubjectFieldDef {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** Show it on the list, not only in the detail view. Costs a column. */
  readonly onList?: boolean;
  /** Filterable and sortable — the host promotes these to a real index. */
  readonly searchable?: boolean;
  /**
   * Computed from the others for display only ("arrived same day"). Never
   * stored, never searchable — a derived value that gets stored is a value
   * that goes stale while looking authoritative.
   */
  readonly derivedFrom?: readonly string[];
}

/** What a queue's subjects look like. One per queue, held by the host. */
export interface SubjectSchema {
  readonly subjectType: string;
  readonly title: string;
  readonly fields: readonly SubjectFieldDef[];
  /**
   * The field carrying the date the DOCUMENT's own age counts from — the
   * invoice date, the booking date. Not the date the query was raised, and not
   * a date this engine could ever work out for itself. It is on the client's
   * contract and it never pauses, so it is read, shown and never owned.
   */
  readonly ageAnchorKey: string | null;
}

/**
 * The values, frozen at the moment somebody raised the query.
 *
 * Frozen, not live, and that is a decision rather than an accident: six months
 * later "the field was empty when I raised this" has to be provable, and a
 * live read cannot prove anything about the past. A host that wants current
 * values reads them itself and shows both, with both times.
 */
export interface SubjectSnapshot {
  readonly subjectType: string;
  readonly subjectId: string;
  readonly takenAt: string;
  readonly values: Readonly<Record<string, unknown>>;
  readonly attachments: readonly AttachmentRef[];
  /** ISO instant the document's own clock starts from, if the queue has one. */
  readonly ageAnchor: string | null;
}

export interface RenderedField {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly value: unknown;
  readonly derived: boolean;
}

/**
 * The snapshot laid out for a screen, in the order the host declared.
 *
 * Values with no declaration are kept and marked, rather than dropped: a field
 * that arrives without a declaration usually means somebody added it upstream
 * and forgot the other half, and silently swallowing it makes that invisible
 * for months.
 */
export const renderSnapshot = (
  schema: SubjectSchema | null,
  snapshot: SubjectSnapshot,
): readonly RenderedField[] => {
  const declared = schema?.fields ?? [];
  const known = new Set(declared.map((field) => field.key));
  const shown: RenderedField[] = declared.map((field) => ({
    key: field.key,
    label: field.label,
    kind: field.kind,
    value: snapshot.values[field.key] ?? null,
    derived: (field.derivedFrom?.length ?? 0) > 0,
  }));
  for (const [key, value] of Object.entries(snapshot.values)) {
    if (known.has(key)) continue;
    shown.push({ key, label: key, kind: 'text', value, derived: false });
  }
  return shown;
};

/** Fields the host should be able to filter and sort on. */
export const searchableKeys = (schema: SubjectSchema | null): readonly string[] =>
  (schema?.fields ?? []).filter((field) => field.searchable === true).map((field) => field.key);

/** Fields worth a column on the list. */
export const listKeys = (schema: SubjectSchema | null): readonly string[] =>
  (schema?.fields ?? []).filter((field) => field.onList === true).map((field) => field.key);

export interface SnapshotProblem {
  readonly key: string;
  readonly problem: string;
}

/**
 * Hold a snapshot against its declaration.
 *
 * Deliberately lenient about extra keys and strict about wrong types. A field
 * the engine will later sort on must be sortable, and "2026-01-04" arriving
 * where a number was declared is the kind of thing that only surfaces when
 * somebody sorts the column three months later.
 */
export const snapshotProblems = (
  schema: SubjectSchema | null,
  snapshot: SubjectSnapshot,
): readonly SnapshotProblem[] => {
  if (schema === null) return [];
  const problems: SnapshotProblem[] = [];
  if (schema.subjectType !== snapshot.subjectType) {
    problems.push({
      key: 'subjectType',
      problem: `snapshot says "${snapshot.subjectType}" but the schema is for "${schema.subjectType}"`,
    });
  }
  for (const field of schema.fields) {
    if ((field.derivedFrom?.length ?? 0) > 0) continue;
    const value = snapshot.values[field.key];
    if (value === undefined || value === null || value === '') continue;
    const wrong =
      (field.kind === 'number' || field.kind === 'money') && typeof value !== 'number'
        ? `must be a number (got ${typeof value})`
        : field.kind === 'boolean' && typeof value !== 'boolean'
          ? `must be true or false (got ${typeof value})`
          : (field.kind === 'date' || field.kind === 'instant') &&
              (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
            ? 'must be a readable date'
            : null;
    if (wrong !== null) problems.push({ key: field.key, problem: `"${field.key}" ${wrong}` });
  }
  if (schema.ageAnchorKey !== null && snapshot.ageAnchor === null) {
    problems.push({
      key: schema.ageAnchorKey,
      problem: `this queue counts document age from "${schema.ageAnchorKey}" — the snapshot carries no anchor`,
    });
  }
  return problems;
};

/** Whole days the DOCUMENT has been alive. Nobody's clock; nobody's fault. */
export const documentAgeDays = (snapshot: SubjectSnapshot, now: string): number | null => {
  if (snapshot.ageAnchor === null) return null;
  const from = Date.parse(snapshot.ageAnchor);
  const to = Date.parse(now);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.floor((to - from) / 86_400_000));
};
