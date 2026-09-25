import {
  scopeMatches,
  specificityOf,
  type ReasonDefinition,
  type ReasonVariant,
  type Scope,
} from './schemas.js';

/**
 * How one catalogue serves forty offices.
 *
 * The naive answer is a list per country, and it is wrong for a reason that
 * shows up in month three rather than week one: a change to a shared reason
 * then has to be made forty times, forty approvals deep, and the copies drift
 * until nobody can say what "the AP exception list" is.
 *
 * So there is ONE definition per reason code, carrying a base and any number
 * of scoped variants. Resolution walks from general to specific — base, then
 * region, then country, then office — and each matching variant overrides only
 * the fields it names. `{ where: { country: 'DE' }, enabled: false }` withdraws
 * a reason in Germany and changes nothing anywhere else.
 *
 * Specificity is the count of pinned scope fields, ties broken by declaration
 * order. That is the same rule the MALKOM runtime already applies to routing
 * overrides, and it is the same rule on purpose: an administrator who has
 * learned one has learned both.
 */

export interface ResolvedReason extends ReasonDefinition {
  /** The scope this was resolved for. */
  readonly scope: Scope;
  /**
   * What produced this definition, general to specific. A desk asking "why is
   * our SLA four hours when Rotterdam's is eight" gets an answer from this
   * rather than from a reading of the config.
   */
  readonly resolvedFrom: readonly string[];
}

const describe = (where: Scope): string => {
  const parts = (['country', 'region', 'office', 'queue', 'subQueue'] as const)
    .filter((field) => (where[field] ?? '') !== '')
    .map((field) => `${field}=${where[field] ?? ''}`);
  return parts.length === 0 ? 'base' : parts.join('&');
};

/** Only the fields a variant actually names; `undefined` never overrides. */
const overlay = (base: ReasonDefinition, variant: ReasonVariant): ReasonDefinition => {
  const named = Object.fromEntries(
    Object.entries(variant).filter(([key, value]) => value !== undefined && key !== 'where' && key !== 'note'),
  );
  return { ...base, ...named } as ReasonDefinition;
};

/**
 * The effective definition for one reason in one scope, or null when the
 * reason does not reach here at all — either its base scope excludes this
 * work, or a variant withdrew it.
 */
export const resolveReason = (definition: ReasonDefinition, scope: Scope): ResolvedReason | null => {
  if (!scopeMatches(definition.where, scope)) return null;

  const applicable = definition.variants
    .map((variant, index) => ({ variant, index }))
    .filter((entry) => scopeMatches(entry.variant.where, scope))
    // General first, so the most specific override lands last and wins.
    // Equal specificity falls back to the order an author wrote them in,
    // which is the order they see on screen.
    .sort((left, right) => {
      const bySpecificity = specificityOf(left.variant.where) - specificityOf(right.variant.where);
      return bySpecificity !== 0 ? bySpecificity : left.index - right.index;
    });

  const effective = applicable.reduce((carry, entry) => overlay(carry, entry.variant), definition);
  if (!effective.enabled) return null;

  return {
    ...effective,
    // Variants are already spent; carrying them into the resolved definition
    // would invite a second, silent resolution somewhere downstream.
    variants: [],
    scope,
    resolvedFrom: ['base', ...applicable.map((entry) => describe(entry.variant.where))],
  };
};

/**
 * The list a raise dialog shows for one transaction: every reason that reaches
 * this scope, already resolved, narrowed to the subject at hand.
 */
export const resolveCatalogue = (
  definitions: readonly ReasonDefinition[],
  scope: Scope,
  subjectType?: string,
): readonly ResolvedReason[] =>
  definitions
    .map((definition) => resolveReason(definition, scope))
    .filter((resolved): resolved is ResolvedReason => resolved !== null)
    .filter((resolved) => subjectType === undefined || resolved.subjectTypes.includes(subjectType))
    .sort((left, right) => left.code.localeCompare(right.code));
