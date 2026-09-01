/** Typed error hierarchy. `code` is stable API surface; messages are not. */

export type MalkomErrorCode =
  | 'CONFIG_INVALID'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ADAPTER_ERROR'
  | 'STATE_STORE_ERROR'
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
   * Structured issues when the thrower has them (zod parse failures, tier-1
   * validation); `details` always carries the flat "path: message" strings.
   * The router serves these as the 422 body's `issues` array.
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
  /** True when the failure looks like schema drift (missing table/column) — drives auto-pause. */
  readonly schemaClass: boolean;
  /**
   * The registry entity whose fetch failed, when known. The HTTP boundary
   * serializes AdapterError as a GENERIC message plus this entity name — the
   * full driver message (`.message`) may carry table/column/connection intel
   * and is only for in-process callers and the engine log, never the wire.
   */
  readonly entity: string | undefined;
  constructor(message: string, opts: { schemaClass?: boolean; entity?: string } = {}) {
    super('ADAPTER_ERROR', message, 502);
    this.schemaClass = opts.schemaClass ?? false;
    this.entity = opts.entity;
  }
}

export class StateStoreError extends MalkomError {
  constructor(message: string) {
    super('STATE_STORE_ERROR', message, 500);
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
    m.includes('invalid column name') ||
    m.includes('invalid object name')
  );
}
