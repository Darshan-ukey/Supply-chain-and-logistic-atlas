import type { MatchingRule } from '../config/schemas.js';
import type { WorkItem, Worker } from '../domain/types.js';
import type { EligibilityMap } from '../strategies/types.js';

function fieldValue(attrs: Record<string, unknown>, id: string, field: string): unknown {
  return field === 'id' ? id : attrs[field];
}

/**
 * eq: strict scalar equality.
 * contains: worker attribute array includes the item value, or worker string
 * attribute contains it as a substring. Documented, deterministic — no coercion magic.
 */
function ruleMatches(rule: MatchingRule, item: WorkItem, worker: Worker): boolean {
  const iv = fieldValue(item.attrs, item.id, rule.itemField);
  const wv = fieldValue(worker.attrs, worker.id, rule.workerAttr);
  if (iv === null || iv === undefined || wv === null || wv === undefined) return false;
  if (rule.op === 'eq') return iv === wv;
  if (Array.isArray(wv)) return wv.includes(iv);
  if (typeof wv === 'string') return typeof iv === 'string' && iv !== '' && wv.includes(iv);
  return false;
}

export interface EligibilityResult {
  eligibility: EligibilityMap;
  /** Items with zero eligible workers, with the first failing rule for diagnostics. */
  unmatchable: Array<{ itemId: string; reason: string }>;
}

/**
 * Hard per-pair eligibility — who MAY take an item. Evaluated by the engine
 * before any strategy runs, so every strategy gets skill-filtering for free.
 * An empty rule list means every worker is eligible for every item.
 */
export function computeEligibility(
  rules: readonly MatchingRule[],
  items: readonly WorkItem[],
  workers: readonly Worker[],
): EligibilityResult {
  const eligibility = new Map<string, ReadonlySet<string>>();
  const unmatchable: Array<{ itemId: string; reason: string }> = [];
  const allWorkerIds: ReadonlySet<string> = new Set(workers.map((w) => w.id));

  for (const item of items) {
    if (rules.length === 0) {
      eligibility.set(item.id, allWorkerIds);
      continue;
    }
    const eligible = new Set<string>();
    let firstFail = '';
    for (const worker of workers) {
      const failing = rules.find((r) => !ruleMatches(r, item, worker));
      if (failing === undefined) {
        eligible.add(worker.id);
      } else if (firstFail === '') {
        firstFail = `${failing.itemField} ${failing.op} ${failing.workerAttr}`;
      }
    }
    eligibility.set(item.id, eligible);
    if (eligible.size === 0) {
      unmatchable.push({ itemId: item.id, reason: `no eligible worker (first failing rule: ${firstFail || 'n/a'})` });
    }
  }

  return { eligibility, unmatchable };
}
