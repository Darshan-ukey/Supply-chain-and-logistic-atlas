import { scalarEquals, type Scalar } from '../domain/filter.js';

/**
 * Fact access port — how the engine reads host rows to calculate over. The
 * engine pushes down only what SQL can do losslessly (projection, scope
 * equality, the anchor time range, a row cap); every richer predicate
 * (`where` filters, exclusions, derived fields) is applied by the pure
 * evaluation core so that port- and SQL-backed calculations are IDENTICAL.
 *
 * Implementations: MemoryFactSource below (reference + test double, in the
 * spirit of the alloc engine's MemoryBackendAdapter) and SqlFactSource
 * (sql/factfetch.ts) over the M0 connection substrate.
 */

/** One fetch request: the minimal projection of one entity's rows. */
export interface FactQuery {
  /** Registry entity id. */
  entity: string;
  /** Registry field ids to project — the minimal set the metric reads. */
  fields: string[];
  /** Scope equality bindings (fieldId → scalar), scalarEquals semantics. */
  scope?: Record<string, Scalar>;
  /**
   * Event-anchor range: only rows whose `field` timestamp lies in
   * [startIso, endIso) belong. Absent for snapshot-anchored fetches — those
   * read as-of-now regardless of the window.
   */
  anchor?: { field: string; startIso: string; endIso: string };
  /**
   * Hard cap on returned rows. Callers request one MORE row than they will
   * accept, so an at-limit result proves overflow — silent truncation is
   * forbidden everywhere in this engine.
   */
  limit: number;
}

export interface FactSourcePort {
  fetchFacts(q: FactQuery): Promise<ReadonlyArray<Record<string, unknown>>>;
}

type Row = Record<string, unknown>;

/** Row timestamp as epoch ms: number, ISO string, or Date; else null. */
function instantOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/**
 * In-memory fact source with the SAME query semantics as the SQL fetch path:
 * scope equality (scalarEquals), half-open anchor range (a null/unparseable
 * anchor timestamp is never in any window), projection to exactly the
 * requested fields, and the row cap. The reference implementation the parity
 * tests hold SqlFactSource against, and the test double for hosts without a
 * database.
 *
 * Construct with one shared row array (served for every entity) or a
 * rows-by-entity record for multi-source metrics.
 */
export class MemoryFactSource implements FactSourcePort {
  private readonly rowsByEntity: Readonly<Record<string, ReadonlyArray<Row>>> | null;
  private readonly sharedRows: ReadonlyArray<Row>;

  constructor(rows: ReadonlyArray<Row> | Readonly<Record<string, ReadonlyArray<Row>>>) {
    if (Array.isArray(rows)) {
      this.rowsByEntity = null;
      this.sharedRows = rows;
    } else {
      this.rowsByEntity = rows as Readonly<Record<string, ReadonlyArray<Row>>>;
      this.sharedRows = [];
    }
  }

  async fetchFacts(q: FactQuery): Promise<ReadonlyArray<Row>> {
    let rows = this.rowsByEntity === null ? this.sharedRows : (this.rowsByEntity[q.entity] ?? []);

    if (q.scope !== undefined && Object.keys(q.scope).length > 0) {
      const scope = q.scope;
      rows = rows.filter((row) => Object.entries(scope).every(([field, value]) => scalarEquals(row[field], value)));
    }

    if (q.anchor !== undefined) {
      const { field } = q.anchor;
      const startMs = Date.parse(q.anchor.startIso);
      const endMs = Date.parse(q.anchor.endIso);
      rows = rows.filter((row) => {
        const at = instantOf(row[field]);
        return at !== null && at >= startMs && at < endMs;
      });
    }

    return rows.slice(0, q.limit).map((row) => {
      const out: Row = {};
      for (const field of q.fields) {
        if (field in row) out[field] = row[field];
      }
      return out;
    });
  }
}
