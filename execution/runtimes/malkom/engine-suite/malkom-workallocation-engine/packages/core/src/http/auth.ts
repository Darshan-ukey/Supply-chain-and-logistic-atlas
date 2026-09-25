import { createHash, timingSafeEqual } from 'node:crypto';
import { ForbiddenError, UnauthorizedError } from '../domain/errors.js';

export type Scope = 'admin' | 'read';

export interface AuthKeys {
  adminKeys?: string[] | undefined;
  readKeys?: string[] | undefined;
}

function sha256(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest();
}

/**
 * Two-scope static API keys, compared as SHA-256 digests in constant time.
 * Admin keys imply read. With no keys configured the control plane is OPEN —
 * acceptable for embedded/dev use; the server shell warns loudly.
 */
export class ApiAuth {
  private readonly admin: Buffer[];
  private readonly read: Buffer[];
  readonly enabled: boolean;

  constructor(keys: AuthKeys = {}) {
    this.admin = (keys.adminKeys ?? []).filter((k) => k.length > 0).map(sha256);
    this.read = (keys.readKeys ?? []).filter((k) => k.length > 0).map(sha256);
    this.enabled = this.admin.length > 0 || this.read.length > 0;
  }

  /** Throws UnauthorizedError / ForbiddenError; returns the granted scope. */
  check(req: Request, scope: Scope): Scope {
    if (!this.enabled) return 'admin';
    const header = req.headers.get('authorization') ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!m) throw new UnauthorizedError();
    const digest = sha256(m[1]!.trim());
    const matches = (list: Buffer[]) => list.some((k) => k.length === digest.length && timingSafeEqual(k, digest));
    if (matches(this.admin)) return 'admin';
    if (matches(this.read)) {
      if (scope === 'admin') throw new ForbiddenError();
      return 'read';
    }
    throw new UnauthorizedError();
  }
}
