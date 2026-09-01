import { z } from 'zod';

/** Scalar values allowed in filter comparisons and configuration payloads. */
export type Scalar = string | number | boolean | null;

export const scalarSchema: z.ZodType<Scalar> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

/**
 * Host-supplied identifiers (table/column names). The regex is defense-in-depth
 * and early feedback; the dialect quoter and information_schema verification at
 * bind time are the real safety layers.
 *
 * There is deliberately no raw-SQL escape hatch anywhere in a binding: stream
 * and binding definitions arrive from admin UIs and API callers.
 */
export const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_$]{0,127}$/;
export const identifierSchema = z
  .string()
  .regex(IDENTIFIER_RE, 'must be a plain SQL identifier (letters, digits, _, $; max 128 chars)');

/** Registry ids (stream ids, binding ids, object type names) — allow namespacing. */
export const REGISTRY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9:_.\-]{0,127}$/;
export const registryIdSchema = z
  .string()
  .regex(REGISTRY_ID_RE, 'must be a registry id (letters, digits, :, _, ., -; max 128 chars)');

/**
 * Read a value as an instant in epoch ms. Drivers hand back Date objects,
 * ISO-8601 strings, epoch numbers, and — from DuckDB — bigint microseconds
 * already converted to Date by the JS converter. Unparseable values are null:
 * a data condition, never an error.
 */
export function instantMsOf(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/**
 * Coerce a driver-returned aggregate to a JS number.
 *
 * Necessary, not defensive: DuckDB returns COUNT(*) as a BIGINT which the JS
 * converter surfaces as a `bigint`, and node-postgres returns COUNT(*) as a
 * decimal STRING (int8 is not safely representable, so pg refuses to guess).
 * Arithmetic on either without this silently produces NaN or a TypeError.
 */
export function countOf(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  if (value === null || value === undefined) return 0;
  throw new TypeError(`expected a numeric aggregate, received ${typeof value}`);
}

/** Same coercion as countOf, but a missing/NULL aggregate stays null. */
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return countOf(value);
}
