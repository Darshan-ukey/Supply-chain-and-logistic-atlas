import { scopeMatches, specificityOf, type Scope } from './schemas.js';
import { resolveReason, type ResolvedReason } from './catalogue.js';
import type { ReasonDefinition } from './schemas.js';

/**
 * THE CATALOGUE'S MISSING MIDDLE.
 *
 * A raise dialog does not offer a flat list of reasons. Real catalogues run
 * four or five hundred reasons across a dozen offices, and nobody scrolls
 * that. They offer a CATEGORY first, and the reasons under it second — and
 * which categories exist at all depends on where the work is and what kind of
 * thing it is.
 *
 * So the shape a person actually meets is five keys:
 *
 *     office × workType × queue × subQueue   →   category   →   reason   →   department
 *     \_________________ known _____________/   \____ picked ____/   \_ derived _/
 *
 * The first four are already decided before the dialog opens — they come off
 * the work item, not off a form. The person picks two. The last one falls out
 * of the row that matched, and is shown rather than asked, because a person
 * who can choose the department can route around the SLA.
 *
 * There is no separate five-column routing table. The scope IS the first four
 * keys; a reason names its category; and the destination a reason resolves to
 * is already scope-aware through the variant mechanism that was here before
 * this file. `{ where: { office: 'ECHO' }, defaultDestination: 'repair-desk' }`
 * on one reason is the whole of "the same reason routes elsewhere at that
 * office" — one row, not forty.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * What the colon in "Finance : Tax" and "Repair Agreement Issues : FOXTR"
 * actually means — and it is not the same thing twice.
 *
 * SUB_FAMILY is a narrower name: Tax under Finance. It groups, and nothing
 * routes differently because of it.
 *
 * SCOPE is a CONDITION: this category only exists where the work carries that
 * property. It is a *where*, wearing a name's clothes. Left as one string,
 * "all agreement issues across every port" is a question nobody can ask, and
 * re-pointing one port at a different team means editing text.
 */
export type QualifierKind = 'SUB_FAMILY' | 'SCOPE';

export interface CategoryDefinition {
  readonly key: string;
  /** The broad grouping — "Finance", "Repair Agreement Issues". */
  readonly family: string;
  /** The half after the colon. Empty when there isn't one. */
  readonly qualifier: string;
  readonly qualifierKind: QualifierKind;
  /**
   * SCOPE variants only: the plain category this stands in for, and whose
   * reasons it inherits. See the schema for why leaving this out is a
   * catalogue that looks complete and is missing most of itself.
   */
  readonly variantOf?: string | null;
  /** Where this category applies at all. Empty = everywhere. */
  readonly where: Scope;
  readonly enabled: boolean;
  readonly sequence: number;
}

/** What a person reads on screen. Built, never stored — storing it is how the
 *  family and the qualifier drift apart. */
export const categoryLabel = (category: Pick<CategoryDefinition, 'family' | 'qualifier'>): string =>
  category.qualifier === '' ? category.family : `${category.family} : ${category.qualifier}`;

/**
 * Categories that reach this scope, most specific first within a family.
 *
 * The SCOPE-qualified ones are the interesting case. `Repair Agreement Issues`
 * and `Repair Agreement Issues : FOXTR` carry the same reasons and the same
 * department; the second exists to be offered INSTEAD of the first when the
 * work is at that port. Offering both is the bug — the person then picks one
 * at random and the data stops meaning anything.
 */
export const categoriesFor = (
  categories: readonly CategoryDefinition[],
  scope: Scope,
): readonly CategoryDefinition[] => {
  const reaching = categories.filter((c) => c.enabled && scopeMatches(c.where, scope));

  // Within one family, a SCOPE-qualified variant that matches beats the plain
  // one. Sub-families never suppress each other — they are siblings.
  const bestScopedPerFamily = new Map<string, CategoryDefinition>();
  for (const category of reaching) {
    if (category.qualifierKind !== 'SCOPE') continue;
    const held = bestScopedPerFamily.get(category.family);
    if (held === undefined || specificityOf(category.where) > specificityOf(held.where)) {
      bestScopedPerFamily.set(category.family, category);
    }
  }

  const kept = reaching.filter((category) => {
    if (category.qualifierKind !== 'SCOPE') {
      // A plain family is hidden only when a scoped variant of it won here.
      const winner = bestScopedPerFamily.get(category.family);
      return winner === undefined || category.qualifier !== '';
    }
    return bestScopedPerFamily.get(category.family)?.key === category.key;
  });

  return [...kept].sort(
    (left, right) =>
      left.family.localeCompare(right.family) ||
      left.sequence - right.sequence ||
      left.key.localeCompare(right.key),
  );
};

// ---------------------------------------------------------------------------
// The cascade
// ---------------------------------------------------------------------------

/** One rung of the dialog: what to show, and what is already decided. */
export interface CascadeStep {
  readonly key: 'category' | 'reason';
  readonly label: string;
  readonly options: readonly { key: string; label: string; hint: string }[];
}

/** The whole dialog, resolved for one work item in one go. */
export interface Cascade {
  /** Echoed back so a caller can show what was decided FOR them. */
  readonly known: Scope;
  readonly steps: readonly CascadeStep[];
  /** How many category × reason combinations reach here at all. */
  readonly rows: number;
}

/**
 * The reasons under one category.
 *
 * `alsoUnder` is how a scope variant keeps its base's reasons. "Repair
 * Agreement Issues : ECHO" is not a different category with a different list —
 * it is the same category at one site, and it carries every reason the plain
 * form carries. Anything else means turning on a site-specific SLA silently
 * empties that site's picker.
 */
export const reasonsFor = (
  definitions: readonly ReasonDefinition[],
  scope: Scope,
  categoryKey: string,
  subjectType?: string,
  alsoUnder?: string | null,
): readonly ResolvedReason[] => {
  const keys = new Set([categoryKey, ...(alsoUnder === null || alsoUnder === undefined ? [] : [alsoUnder])]);
  return definitions
    .filter((definition) => keys.has((definition as { categoryKey?: string }).categoryKey ?? ''))
    .map((definition) => resolveReason(definition, scope))
    .filter((resolved): resolved is ResolvedReason => resolved !== null)
    .filter((resolved) => subjectType === undefined || resolved.subjectTypes.includes(subjectType))
    .sort((left, right) => left.label.localeCompare(right.label));
};

/**
 * The raise dialog for one work item — two lists, and nothing typed by hand.
 *
 * Categories with no reason under them are dropped rather than shown empty: a
 * dead end in a picker is indistinguishable from a broken catalogue, and
 * people report it as one.
 */
/**
 * Reasons whose category was never declared. They are not dropped and not
 * hidden: a reason that vanishes from a picker is reported as a bug, chased
 * for a week, and found to be a one-line config omission.
 */
export const UNCATEGORISED: CategoryDefinition = {
  key: 'UNCATEGORISED',
  family: 'Uncategorised',
  qualifier: '',
  qualifierKind: 'SUB_FAMILY',
  where: {},
  enabled: true,
  sequence: 9_999,
};

export const cascadeFor = (
  categories: readonly CategoryDefinition[],
  definitions: readonly ReasonDefinition[],
  scope: Scope,
  subjectType?: string,
): Cascade => {
  const declared = categoriesFor(categories, scope);
  // Anything pointing at a category nobody declared still has to be offered,
  // under a heading that says so. Silence here reads as "the catalogue is
  // empty at this office", which is a very different problem.
  const declaredKeys = new Set(categories.map((category) => category.key));
  const orphans = new Set(
    definitions
      .map((definition) => (definition as { categoryKey?: string }).categoryKey ?? UNCATEGORISED.key)
      .filter((key) => !declaredKeys.has(key)),
  );
  const reaching = [
    ...declared,
    ...[...orphans].sort().map((key) => ({ ...UNCATEGORISED, key })),
  ];
  const live = reaching
    .map((category) => ({
      category,
      reasons: reasonsFor(definitions, scope, category.key, subjectType, category.variantOf ?? null),
    }))
    .filter((entry) => entry.reasons.length > 0);

  return {
    known: scope,
    rows: live.reduce((count, entry) => count + entry.reasons.length, 0),
    steps: [
      {
        key: 'category',
        label: 'What kind of problem is it?',
        options: live.map((entry) => ({
          key: entry.category.key,
          label: categoryLabel(entry.category),
          hint: `${entry.reasons.length} reason${entry.reasons.length === 1 ? '' : 's'}`,
        })),
      },
      {
        key: 'reason',
        label: 'Which one, exactly?',
        // Flattened deliberately: one round trip gives the dialog everything,
        // and a picker that has to fetch on every click feels broken on a slow
        // line — which is every line in a shared-services floor.
        options: live.flatMap((entry) =>
          entry.reasons.map((reason) => ({
            key: `${entry.category.key}/${reason.code}`,
            label: reason.label,
            hint: reason.defaultDestination ?? 'unrouted',
          })),
        ),
      },
    ],
  };
};

/**
 * The same catalogue as a flat five-key table — what an administrator exports,
 * diffs and argues about. Generated from the definitions, never authored: two
 * copies of a mapping is how the export and the behaviour start disagreeing.
 */
export interface MappingRow {
  readonly office: string;
  readonly workType: string;
  readonly queue: string;
  readonly subQueue: string;
  readonly category: string;
  readonly reason: string;
  readonly department: string;
}

export const mappingRows = (
  categories: readonly CategoryDefinition[],
  definitions: readonly ReasonDefinition[],
  scopes: readonly Scope[],
): readonly MappingRow[] =>
  scopes.flatMap((scope) =>
    categoriesFor(categories, scope).flatMap((category) =>
      reasonsFor(definitions, scope, category.key, undefined, category.variantOf ?? null).map((reason) => ({
        office: scope.office ?? '*',
        workType: scope.workType ?? '*',
        queue: scope.queue ?? '*',
        subQueue: scope.subQueue ?? '*',
        category: categoryLabel(category),
        reason: reason.label,
        department: reason.defaultDestination ?? 'unrouted',
      })),
    ),
  );
