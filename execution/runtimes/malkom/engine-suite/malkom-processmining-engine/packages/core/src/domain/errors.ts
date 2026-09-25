/**
 * Typed error hierarchy. `code` is stable API surface; messages are not.
 *
 * Shared vocabulary with the other Malkom engines, plus two codes this engine
 * needs: PERSPECTIVE_UNAVAILABLE (the honest refusal — the bound data cannot
 * support the requested analysis) and COVERAGE_MISS (the requested slice is
 * not materialised and the caller asked not to fetch).
 */

export type MalkomErrorCode =
  | 'CONFIG_INVALID'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ADAPTER_ERROR'
  | 'STORE_ERROR'
  | 'PERSPECTIVE_UNAVAILABLE'
  | 'COVERAGE_MISS'
  | 'UNSUPPORTED'
  | 'INTERNAL';

export class MalkomError extends Error {
  readonly code: MalkomErrorCode;
  /** HTTP status the control plane maps this to. */
  readonly status: number;
  readonly details: readonly string[];

  constructor(code: MalkomErrorCode, message: string, status: number, details: string[] = []) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** One structured validation issue, as the control plane's 422 body carries it. */
export interface ErrorIssue {
  path: string;
  code?: string;
  message: string;
}

export class ConfigInvalidError extends MalkomError {
  /**
   * Structured issues when the thrower has them (zod parse failures, tier-2
   * validation); `details` always carries the flat "path: message" strings.
   */
  readonly issues: readonly ErrorIssue[];

  constructor(message: string, details: string[] = [], issues: ErrorIssue[] = []) {
    super('CONFIG_INVALID', message, 422, details);
    this.issues = issues;
  }
}

export class NotFoundError extends MalkomError {
  constructor(what: string) {
    super('NOT_FOUND', `${what} not found`, 404);
  }
}

export class ConflictError extends MalkomError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class UnauthorizedError extends MalkomError {
  constructor(message = 'missing or invalid API key') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends MalkomError {
  constructor(message = 'this key does not have the required scope') {
    super('FORBIDDEN', message, 403);
  }
}

export class AdapterError extends MalkomError {
  /** True when the failure looks like schema drift (missing table/column). */
  readonly schemaClass: boolean;
  /**
   * The binding whose query failed, when known. The HTTP boundary serializes
   * AdapterError as a GENERIC message plus this name — the full driver message
   * may carry table/column/connection intel and is for the engine log only.
   */
  readonly binding: string | undefined;
  constructor(message: string, opts: { schemaClass?: boolean; binding?: string } = {}) {
    super('ADAPTER_ERROR', message, 502);
    this.schemaClass = opts.schemaClass ?? false;
    this.binding = opts.binding;
  }
}

export class StoreError extends MalkomError {
  constructor(message: string) {
    super('STORE_ERROR', message, 500);
  }
}

/**
 * The honest refusal. Raised when the bound data provably cannot support the
 * requested perspective — every source is snapshot grain and control-flow was
 * asked for, or no resource role is mapped and the organizational perspective
 * was asked for.
 *
 * This is a 200-class fact about the data dressed as an error only because it
 * terminates a request; `remedies` is the actionable half and callers are
 * expected to surface it verbatim. Never throw this for a transient condition.
 */
export class PerspectiveUnavailableError extends MalkomError {
  readonly perspective: string;
  /** Concrete, ordered steps that would make this perspective available. */
  readonly remedies: readonly string[];

  constructor(perspective: string, reason: string, remedies: string[] = []) {
    super('PERSPECTIVE_UNAVAILABLE', `${perspective} perspective unavailable: ${reason}`, 409);
    this.perspective = perspective;
    this.remedies = remedies;
  }
}

/** The requested slice is outside a stream's coverage and fetching was declined. */
export class CoverageMissError extends MalkomError {
  constructor(message: string) {
    super('COVERAGE_MISS', message, 409);
  }
}

export class UnsupportedError extends MalkomError {
  constructor(message: string) {
    super('UNSUPPORTED', message, 400);
  }
}

/** Heuristic: does a driver error indicate schema drift (renamed/missing column or table)? */
export function looksLikeSchemaError(err: unknown): boolean {
  const m = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    m.includes('no such column') ||
    m.includes('no such table') ||
    m.includes('unknown column') ||
    m.includes('does not exist') ||
    m.includes('not found in from clause') ||
    m.includes('referenced column') ||
    m.includes('invalid column name') ||
    m.includes('invalid object name')
  );
}
