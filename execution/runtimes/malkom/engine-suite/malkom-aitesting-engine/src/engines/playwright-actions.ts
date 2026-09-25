import type { UiActionPlan, UiElementEvidence } from '../types.js';

/** Read a field that only some kinds of action carry. */
function actionField(action: UiActionPlan, field: 'value' | 'text' | 'key' | 'description'): string | undefined {
  const record = action as unknown as Record<string, unknown>;
  const value = record[field];
  return typeof value === 'string' ? value : undefined;
}
import type { LocatorLike, PageLike } from './playwright-runtime.js';

/**
 * Turn one piece of page evidence into the locator that finds it again.
 * This used to live as a source string inside a generated test file; running
 * in the same process lets it be ordinary, testable code.
 */
export function locatorForEvidence(page: PageLike, evidence: UiElementEvidence): LocatorLike {
  const strategy = evidence.locator?.strategy;
  const value = evidence.locator?.value ?? '';
  if (strategy === 'testId') return page.getByTestId(value);
  if (strategy === 'label') return page.getByLabel(value);
  if (strategy === 'role') {
    const [role, ...nameParts] = String(value).split(':');
    const name = nameParts.join(':');
    return name.length > 0 ? page.getByRole(role ?? '', { name }) : page.getByRole(role ?? '');
  }
  if (strategy === 'text') return page.getByText(value);
  if (typeof evidence.css === 'string' && evidence.css.length > 0) return page.locator(evidence.css);
  return page.locator(evidence.tagName ?? 'body');
}

/** Does this evidence match the kind of thing the action needs? */
export function isCompatibleEvidence(action: UiActionPlan, element: UiElementEvidence | undefined): boolean {
  if (element === undefined) return false;
  const role = String(element.role ?? '').toLowerCase();
  const tag = String(element.tagName ?? '').toLowerCase();
  const inputType = String(element.inputType ?? '').toLowerCase();
  if (action.action === 'fill') {
    return tag === 'textarea' || (tag === 'input' && !['checkbox', 'radio', 'button', 'submit'].includes(inputType)) || role === 'textbox';
  }
  if (action.action === 'check') return inputType === 'checkbox' || inputType === 'radio' || role === 'checkbox' || role === 'radio';
  if (action.action === 'select') return tag === 'select' || role === 'combobox' || role === 'listbox';
  if (action.action === 'click') return true;
  return true;
}

/** Never quietly retarget an action that could change or destroy real data. */
export function isSensitiveAction(action: UiActionPlan, element: UiElementEvidence | undefined): boolean {
  if (action.action !== 'click') return false;
  const text = [actionField(action, 'description'), actionField(action, 'text'), actionField(action, 'value'), element?.text, element?.label, element?.testId, element?.locator?.value]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .toLowerCase();
  return /delete|remove|destroy|drop|disable|revoke|reset|admin|production|billing|payment|submit|confirm|publish|send/.test(text);
}

/**
 * When a control moved, look for one that provably serves the same purpose.
 * A replacement must score high enough; otherwise the check fails honestly
 * instead of clicking something that merely looks similar.
 */
export function findHealingCandidate(
  action: UiActionPlan,
  previous: UiElementEvidence | undefined,
  elements: readonly UiElementEvidence[],
  healingPolicy: 'off' | 'safe' | 'aggressive',
): UiElementEvidence | undefined {
  const actionable = elements.filter((element) => (
    element.locator !== undefined
    && isCompatibleEvidence(action, element)
    && (element.role !== undefined || element.label !== undefined || element.testId !== undefined || element.text !== undefined || element.css !== undefined)
  ));
  if (actionable.length === 0) return undefined;
  const preferredKind = action.action === 'fill'
    ? new Set(['testId', 'label', 'role'])
    : new Set(['testId', 'role', 'text', 'label']);
  const expectedText = String(actionField(action, 'text') ?? actionField(action, 'value') ?? actionField(action, 'description') ?? '').trim().toLowerCase();
  const previousText = String(previous?.text ?? previous?.label ?? previous?.testId ?? previous?.locator?.value ?? '').trim().toLowerCase();
  const scored = actionable.map((element) => {
    let score = 0;
    if (isCompatibleEvidence(action, element)) score += 3;
    if (previous !== undefined && element.id !== previous.id && element.locator?.strategy === previous.locator?.strategy) score += 2;
    if (previous?.role !== undefined && element.role === previous.role) score += 3;
    if (previous?.tagName !== undefined && element.tagName === previous.tagName) score += 2;
    if (healingPolicy === 'safe' && previous?.role !== undefined && element.role !== previous.role) score -= 10;
    if (healingPolicy === 'safe' && previous?.tagName !== undefined && element.tagName !== previous.tagName) score -= 10;
    if (element.locator !== undefined && preferredKind.has(element.locator.strategy)) score += 2;
    const haystack = [element.text, element.label, element.testId, element.locator?.value]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ')
      .toLowerCase();
    if (expectedText.length > 0 && haystack.includes(expectedText)) score += 5;
    if (previousText.length > 0 && haystack.includes(previousText)) score += 4;
    return { element, score };
  })
    .filter((candidate) => candidate.score >= (healingPolicy === 'safe' ? 7 : 1))
    .sort((left, right) => right.score - left.score);
  return scored[0]?.element;
}

/** Perform one grounded action against the page. */
export async function performUiAction(locator: LocatorLike, action: UiActionPlan): Promise<void> {
  const target = locator.first();
  if (action.action === 'fill') return target.fill(actionField(action, 'value') ?? '');
  if (action.action === 'click') return target.click();
  if (action.action === 'check') return target.check();
  if (action.action === 'select') return target.selectOption(actionField(action, 'value') ?? '');
  if (action.action === 'press') return target.press(actionField(action, 'key') ?? 'Enter');
  if (action.action === 'assertText') {
    const expected = actionField(action, 'text') ?? '';
    const text = (await target.textContent()) ?? '';
    if (!text.includes(expected)) {
      throw new Error(`Expected the control to contain "${expected}", but it showed "${text.trim().slice(0, 120)}".`);
    }
    return;
  }
  throw new Error(`Unsupported grounded UI action ${String(action.action)}.`);
}
