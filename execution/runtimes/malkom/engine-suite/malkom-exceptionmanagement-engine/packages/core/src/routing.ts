import type { ResolvedReason } from './catalogue.js';
import type { Scope } from './schemas.js';

/**
 * Where a handover goes, and where that decision came from.
 *
 * Three tiers, and keeping them apart is the whole design:
 *
 *   1. the CATALOGUE default — destination as a function of scope. Declarative,
 *      always resolvable, needs nothing installed. Covers most real routing.
 *   2. a RULES proposal — destination as a function of the transaction's DATA.
 *      "Over twenty-five thousand goes to the controller." That is a predicate
 *      over fields, which is what @malkom/rules-core is for, and its backtest
 *      against real host rows is the thing a static table can never offer.
 *   3. a human OVERRIDE — recorded as an event, and its frequency is the
 *      measure of how wrong the other two are.
 *
 * This engine does not evaluate predicates. It asks, and it applies. Building
 * a rules language in here would put a second one in the product, with its own
 * authoring UI, its own approval flow, and two sets of rules to disagree.
 */

export interface RoutingRequest {
  readonly reason: ResolvedReason;
  readonly scope: Scope;
  readonly subject: { readonly type: string; readonly id: string };
  /** What the raiser supplied. The only thing tier 2 can decide on. */
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface RoutingProposal {
  readonly destination: string;
  /** Higher sorts first on a desk. Null leaves the reason's own priority. */
  readonly priority?: number | null;
  /** Why, in a sentence somebody can read on the raise dialog. */
  readonly because: string;
}

/**
 * The seam a rules adapter plugs into. `@malkom/rules-core` returns verdicts
 * and effect descriptors that the host executes; an adapter turns one of those
 * into a proposal, and this engine applies only what it is allowed to.
 *
 * Returning null means "no opinion", which is the common case and must stay
 * cheap: the catalogue default then stands.
 */
export interface RoutingAdvisor {
  readonly name: string;
  propose(request: RoutingRequest): RoutingProposal | null;
}

export type RoutedBy = 'catalogue' | 'rules' | 'override';

export interface RoutingDecision {
  readonly destination: string | null;
  readonly routedBy: RoutedBy;
  readonly because: string;
  /** Which advisor spoke, when one did. */
  readonly advisor: string | null;
  readonly priority: number | null;
}

/**
 * Resolve a destination, and say where it came from. The `because` travels
 * onto the raise event, so a desk asking "why did this come to us" gets an
 * answer, and a catalogue default, a rules proposal and a hand override stay
 * distinguishable a quarter later.
 */
export const decideRoute = (
  request: RoutingRequest,
  advisors: readonly RoutingAdvisor[],
  override: string | null,
): RoutingDecision => {
  if (override !== null) {
    return {
      destination: override,
      routedBy: 'override',
      because: 'chosen by hand at raise',
      advisor: null,
      priority: null,
    };
  }
  for (const advisor of advisors) {
    const proposal = advisor.propose(request);
    if (proposal !== null) {
      return {
        destination: proposal.destination,
        routedBy: 'rules',
        because: proposal.because,
        advisor: advisor.name,
        priority: proposal.priority ?? null,
      };
    }
  }
  const fallback = request.reason.defaultDestination;
  return {
    destination: fallback,
    routedBy: 'catalogue',
    because:
      fallback === null
        ? `${request.reason.code} names no destination`
        : `${request.reason.code} resolved [${request.reason.resolvedFrom.join(' → ')}]`,
    advisor: null,
    priority: null,
  };
};
