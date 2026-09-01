import { createHash } from 'node:crypto';
import type {
  RegistryDoc,
  RegistryEntity,
  RegistryField,
} from '../config/schemas.js';
import type { FilterContext, Scalar } from './filter.js';

/**
 * The compiled form of a registry document: lookup maps for entities, fields
 * and value-sets, plus the content hash that makes schema drift detectable.
 * Immutable once built; rebuilt whenever the host applies a new registry.
 * This engine uses the identical metadata-registry concept as its siblings —
 * metric definitions reference registry fields, never physical columns.
 */

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

/** Stable sha-256 of the canonical (key-sorted) JSON form of any value. */
export function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

/** Stable sha-256 of the canonical (key-sorted) JSON form of the document. */
export function registryHash(doc: RegistryDoc): string {
  return contentHash(doc);
}

export class CompiledRegistry {
  readonly doc: RegistryDoc;
  readonly version: number;
  readonly hash: string;

  private readonly entities = new Map<string, RegistryEntity>();
  private readonly fields = new Map<string, Map<string, RegistryField>>();
  private readonly sets = new Map<string, readonly Scalar[]>();

  constructor(doc: RegistryDoc, version: number) {
    this.doc = doc;
    this.version = version;
    this.hash = registryHash(doc);
    for (const vs of doc.valueSets) this.sets.set(vs.id, vs.values);
    for (const e of doc.entities) {
      this.entities.set(e.id, e);
      const byId = new Map<string, RegistryField>();
      for (const f of e.fields) byId.set(f.id, f);
      this.fields.set(e.id, byId);
    }
  }

  entity(id: string): RegistryEntity | undefined {
    return this.entities.get(id);
  }

  entityIds(): string[] {
    return [...this.entities.keys()].sort();
  }

  field(entityId: string, fieldId: string): RegistryField | undefined {
    return this.fields.get(entityId)?.get(fieldId);
  }

  fieldIds(entityId: string): string[] {
    const m = this.fields.get(entityId);
    return m ? [...m.keys()] : [];
  }

  valueSet(id: string): readonly Scalar[] | undefined {
    return this.sets.get(id);
  }

  /** Bound resolver in the shape evaluateFilter's FilterContext expects. */
  filterContext(): FilterContext {
    return { valueSet: (id) => this.sets.get(id) };
  }

  /** Physical column for a field; defaults to the field id. */
  columnFor(entityId: string, fieldId: string): string | undefined {
    const f = this.field(entityId, fieldId);
    if (!f) return undefined;
    return f.column ?? f.id;
  }

  /** Legal values for a field: inline enum or referenced value-set, if any. */
  fieldValues(entityId: string, fieldId: string): readonly Scalar[] | undefined {
    const f = this.field(entityId, fieldId);
    if (!f) return undefined;
    if (f.values) return f.values;
    if (f.valueSet) return this.sets.get(f.valueSet);
    return undefined;
  }

  /** The sub-queue values of an entity, when its discriminator declares them. */
  subQueues(entityId: string): readonly Scalar[] | undefined {
    const e = this.entities.get(entityId);
    if (!e?.subQueueField) return undefined;
    return this.fieldValues(entityId, e.subQueueField);
  }
}
