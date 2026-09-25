import { UnauthorizedError, ForbiddenError } from '../domain/errors.js';

/**
 * Bearer-key auth with two scopes, same shape as the sibling engine:
 *  - read:  discovery, queries, applicable/explain
 *  - admin: everything, including lifecycle mutations, apply, deletion
 * Both key lists empty = the control plane is OPEN (dev mode; the server
 * shell warns loudly).
 */

export type Scope = 'read' | 'admin';

export interface AuthKeys {
  adminKeys: string[];
  readKeys: string[];
}

export class ApiAuth {
  private readonly admin: Set<string>;
  private readonly read: Set<string>;

  constructor(keys: AuthKeys) {
    this.admin = new Set(keys.adminKeys.filter((k) => k.length > 0));
    this.read = new Set(keys.readKeys.filter((k) => k.length > 0));
  }

  get open(): boolean {
    return this.admin.size === 0 && this.read.size === 0;
  }

  /** Throws UnauthorizedError / ForbiddenError; returns the granted scope. */
  check(req: Request, required: Scope): Scope {
    if (this.open) return 'admin';
    const header = req.headers.get('authorization') ?? '';
    // RFC 7235 §2.1: the auth scheme is case-insensitive.
    const match = /^bearer\s+(.+)$/i.exec(header);
    const token = match?.[1]?.trim() ?? '';
    if (token === '') throw new UnauthorizedError();
    if (this.admin.has(token)) return 'admin';
    if (this.read.has(token)) {
      if (required === 'admin') throw new ForbiddenError('this operation requires an admin key');
      return 'read';
    }
    throw new UnauthorizedError();
  }
}
