import {
  SCOPE_FIELDS,
  scopeMatches,
  type Capability,
  type Scope,
  type ScopeGrant,
  type Viewer,
} from './schemas.js';

/**
 * Who may do what, to which work.
 *
 * Two questions that get conflated, and the conflation is the bug:
 *
 *   role  — WHAT may you do?    answer, comment, accept, administer
 *   grant — over WHICH work?    these two offices · everything under EMEA
 *
 * A "resolver" is not a kind of person. It is somebody holding a resolver-side
 * capability over the desk a particular handover sits on. The same person is
 * the originator of what they raised and a resolver of what lands on their
 * desk, and which one they are is a fact about the handover, never a field on
 * their profile. Reading it off a profile is what makes an onshore lead unable
 * to raise a query.
 *
 * Grants are additive. Reach is their union, so narrowing somebody means
 * giving fewer grants — never writing an exclusion. An exclusion list is how a
 * permission model becomes impossible to reason about, and it is the opposite
 * of the host's own rule that access only ever narrows and never lifts.
 */

/** Commands that belong to the side that raised it and must close it. */
export const ORIGINATOR_CAPABILITIES: readonly Capability[] = ['raise', 'requery', 'accept', 'withdraw', 'reopen'];

/** Commands that belong to the desk that owes the answer. */
export const RESOLVER_CAPABILITIES: readonly Capability[] = ['answer', 'refer', 'reassign', 'reroute'];

export const sideOfCapability = (capability: Capability): 'ORIGINATOR' | 'RESOLVER' | null =>
  ORIGINATOR_CAPABILITIES.includes(capability) ? 'ORIGINATOR'
  : RESOLVER_CAPABILITIES.includes(capability) ? 'RESOLVER'
  : null;

/** The work and the desk a handover sits on — the two scopes a grant can reach. */
export interface HandoverScopes {
  /** The transaction's own scope: which country's invoice, which queue. */
  readonly work: Scope;
  /** The desk that owes the answer: which department, which office. */
  readonly destination: Scope;
  readonly createdBy: string;
  /** Desks tagged in — they read, they do not owe. */
  readonly watching?: readonly Scope[];
}

const grantsFor = (viewer: Viewer, capability: Capability): readonly ScopeGrant[] =>
  viewer.grants.filter((grant) => grant.capabilities.includes(capability));

/** Does any grant carrying this capability reach this scope? */
const reaches = (viewer: Viewer, capability: Capability, scope: Scope): boolean =>
  grantsFor(viewer, capability).some((grant) => scopeMatches(grant.where, scope));

/** Holds the capability at all, anywhere — used for work you raised yourself. */
const holds = (viewer: Viewer, capability: Capability): boolean => grantsFor(viewer, capability).length > 0;

export interface Decision {
  readonly allowed: boolean;
  /** Why not, in a sentence a caller can act on. Empty when allowed. */
  readonly reason: string;
}

const ALLOW: Decision = { allowed: true, reason: '' };
const deny = (reason: string): Decision => ({ allowed: false, reason });

/**
 * The one reach question. Every read and every command asks it, so a list and
 * a command can never disagree about what somebody may see.
 */
export const may = (viewer: Viewer, capability: Capability, scopes: HandoverScopes): Decision => {
  if (viewer.system) return ALLOW;

  const raisedIt = scopes.createdBy === viewer.id;
  const side = sideOfCapability(capability);

  // Four eyes, and precisely scoped to the act it is about. Whoever asked the
  // question does not get to ANSWER it, however wide their grants are — the
  // desk they staff is not the point.
  //
  // It stops there deliberately. Correcting a misroute you made yourself, or
  // handing your own question to a supplier, is not answering it, and blocking
  // those would leave a wrongly-routed handover stuck with the one person who
  // noticed. The grant check below still applies, so a raiser without a
  // resolver-side grant over that desk cannot do it anyway.
  if (capability === 'answer' && raisedIt) {
    return deny('you raised this; the desk it went to answers it, not you');
  }

  if (side === 'RESOLVER') {
    return reaches(viewer, capability, scopes.destination)
      ? ALLOW
      : deny(`you have no ${capability} grant covering ${describe(scopes.destination)}`);
  }

  if (side === 'ORIGINATOR') {
    if (raisedIt && holds(viewer, capability)) return ALLOW;
    // A lead may act on their team's work without having raised it.
    return reaches(viewer, capability, scopes.work)
      ? ALLOW
      : deny(`you did not raise this and have no ${capability} grant covering ${describe(scopes.work)}`);
  }

  // read, comment, attach: either side, or a desk tagged in.
  if (raisedIt && holds(viewer, capability)) return ALLOW;
  if (reaches(viewer, capability, scopes.work)) return ALLOW;
  if (reaches(viewer, capability, scopes.destination)) return ALLOW;
  if ((scopes.watching ?? []).some((scope) => reaches(viewer, capability, scope))) return ALLOW;
  return deny(`you have no ${capability} grant covering this work, the desk it sits on, or a desk tagged into it`);
};

/** Which side this viewer stands on for this handover, or null for a bystander. */
export const sideOfViewer = (viewer: Viewer, scopes: HandoverScopes): 'ORIGINATOR' | 'RESOLVER' | null => {
  if (scopes.createdBy === viewer.id) return 'ORIGINATOR';
  if (viewer.system) return null;
  const canResolve = RESOLVER_CAPABILITIES.some((capability) => reaches(viewer, capability, scopes.destination));
  return canResolve ? 'RESOLVER' : null;
};

/**
 * The scope predicates a viewer may read, as a disjunction. A store turns this
 * into query terms rather than filtering after the fact, because a desk with
 * ten thousand handovers cannot be filtered in memory and a page of results
 * that was silently trimmed afterwards reports the wrong total.
 */
export interface ReadReach {
  /** True when every row is reachable — an administrator, or the engine. */
  readonly unrestricted: boolean;
  /** Match a row when ANY of these matches its work OR destination scope. */
  readonly scopes: readonly Scope[];
  /** Rows this viewer raised are always readable, whatever the scopes say. */
  readonly ownRaisesOf: string | null;
}

export const readReachOf = (viewer: Viewer): ReadReach => {
  if (viewer.system) return { unrestricted: true, scopes: [], ownRaisesOf: null };
  const grants = grantsFor(viewer, 'read');
  const unrestricted = grants.some((grant) => SCOPE_FIELDS.every((field) => (grant.where[field] ?? '') === ''));
  return {
    unrestricted,
    scopes: grants.map((grant) => grant.where),
    ownRaisesOf: holds(viewer, 'read') ? viewer.id : null,
  };
};

/** Human-readable scope, for a refusal that tells somebody what to ask for. */
export const describe = (scope: Scope): string => {
  const parts = SCOPE_FIELDS.filter((field) => (scope[field] ?? '') !== '').map(
    (field) => `${field}=${scope[field] ?? ''}`,
  );
  return parts.length === 0 ? 'anywhere' : parts.join('/');
};
