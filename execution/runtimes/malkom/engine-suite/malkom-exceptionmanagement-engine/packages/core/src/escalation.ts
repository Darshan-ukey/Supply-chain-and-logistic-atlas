import { specificityOf, scopeMatches, type EscalationLadder, type EscalationRung, type Scope } from './schemas.js';

/**
 * Escalation, and the two things it must not become.
 *
 * It must not move the baton. Escalation buys attention; only a transfer moves
 * work. Conflating them is why escalation ladders stop meaning anything —
 * everybody learns that escalating makes the thing somebody else's problem,
 * and then everybody escalates.
 *
 * And it must not name a person. A rung names a ROLE and a place to look for
 * one, resolved by the host's directory at fire time. A ladder naming an
 * individual breaks the week they take leave, which is reliably the week you
 * needed it.
 *
 * Ladders are resolved like reasons: most specific scope wins, ties by
 * declaration order. One ladder can then serve forty offices, which is the
 * difference between an escalation policy and forty copies of one.
 */

export interface LadderMatch {
  readonly ladder: EscalationLadder;
  readonly why: string;
}

/** The ladder governing one desk and reason, or null when none applies. */
export const ladderFor = (
  ladders: readonly EscalationLadder[],
  scope: Scope,
  reasonCode: string,
  side: 'RESOLVER' | 'ORIGINATOR',
): LadderMatch | null => {
  const candidates = ladders
    .filter((ladder) => ladder.enabled)
    .filter((ladder) => ladder.sides.includes(side))
    .filter((ladder) => ladder.reasonCodes.length === 0 || ladder.reasonCodes.includes(reasonCode))
    .filter((ladder) => scopeMatches(ladder.where, scope))
    .map((ladder, index) => ({ ladder, index }))
    .sort((left, right) => {
      const bySpecificity = specificityOf(right.ladder.where) - specificityOf(left.ladder.where);
      return bySpecificity !== 0 ? bySpecificity : right.index - left.index;
    });
  const best = candidates[0];
  if (best === undefined) return null;
  const named = best.ladder.reasonCodes.length > 0 ? ` for ${reasonCode}` : '';
  return { ladder: best.ladder, why: `${best.ladder.id}${named}` };
};

/**
 * The highest rung this handover has earned, given how much of the current
 * holder's budget is gone. Null when it has earned none.
 *
 * Highest rather than next, so a case that sat unnoticed through three
 * thresholds arrives at the top one instead of climbing politely.
 */
export const rungFor = (ladder: EscalationLadder, budgetUsed: number): EscalationRung | null => {
  const percent = budgetUsed * 100;
  const earned = [...ladder.rungs]
    .filter((rung) => percent >= rung.atPercent)
    .sort((left, right) => right.atPercent - left.atPercent);
  return earned[0] ?? null;
};

/** Where to look for somebody in the rung's role, from the holding desk. */
export const audienceScope = (rung: EscalationRung, desk: Scope): Scope => {
  switch (rung.at) {
    case 'DESK':
      return desk;
    case 'OFFICE':
      return desk.office === undefined ? desk : { office: desk.office };
    case 'COUNTRY':
      return desk.country === undefined ? desk : { country: desk.country };
    case 'REGION':
      return desk.region === undefined ? desk : { region: desk.region };
    case 'GLOBAL':
      return {};
    default: {
      const exhaustive: never = rung.at;
      return exhaustive;
    }
  }
};
