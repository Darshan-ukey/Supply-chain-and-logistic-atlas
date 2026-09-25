/**
 * Renders a condition description tree ("show my conditions") as themed DOM.
 * Shared by the prefilter modal preview and the saved-filter popover.
 */

import type { DescriptionNode, RuleDescription } from '../conditions.js';
import type { MalkomTableIcons, MalkomTableLabels, MalkomTableTheme } from '../types.js';
import { el, icon } from './dom.js';

export interface PreviewRenderDeps {
  doc: Document;
  theme: MalkomTableTheme;
  labels: MalkomTableLabels;
  icons: MalkomTableIcons;
}

function renderRuleSentence(
  deps: PreviewRenderDeps,
  rule: RuleDescription
): HTMLElement {
  const { doc, theme } = deps;
  const sentence = el(doc, 'p', { className: theme.preview.ruleText });
  const field = el(doc, 'span', {
    className: theme.preview.ruleField,
    text: rule.fieldLabel
  });
  const operator = el(doc, 'span', {
    className: theme.preview.ruleOperator,
    text: ` ${rule.operatorLabel} `
  });
  sentence.append(field, operator);
  if (rule.hasValue) {
    sentence.appendChild(
      el(doc, 'span', { className: theme.preview.ruleValue, text: rule.value })
    );
  }
  sentence.appendChild(doc.createTextNode('.'));
  return sentence;
}

function renderAndConnector(deps: PreviewRenderDeps): HTMLElement {
  const { doc, theme, labels } = deps;
  const connector = el(doc, 'div', { className: theme.preview.andConnector });
  connector.append(
    el(doc, 'span', { className: theme.preview.andConnectorLine }),
    el(doc, 'span', {
      className: theme.preview.andConnectorLabel,
      text: labels.and
    }),
    el(doc, 'span', { className: theme.preview.andConnectorLine })
  );
  return connector;
}

function renderRuleRow(
  deps: PreviewRenderDeps,
  rule: RuleDescription,
  index: number | null
): HTMLElement {
  const { doc, theme } = deps;
  const row = el(doc, 'div', { className: theme.preview.ruleRow });
  row.append(
    el(doc, 'span', {
      className: theme.preview.ruleIndex,
      text: index === null ? '' : String(index)
    }),
    renderRuleSentence(deps, rule)
  );
  return row;
}

function renderOrAlternative(
  deps: PreviewRenderDeps,
  node: DescriptionNode
): HTMLElement {
  const { doc, theme, labels } = deps;
  if (node.type === 'group') {
    // Nested group inside an OR list renders as its own block.
    return renderNode(deps, node, null);
  }
  const alt = el(doc, 'div', { className: theme.preview.orAlternative });
  alt.append(
    el(doc, 'span', {
      className: theme.preview.orAlternativeBadge,
      text: labels.or
    }),
    renderRuleSentence(deps, node)
  );
  return alt;
}

function renderOrGroup(
  deps: PreviewRenderDeps,
  children: DescriptionNode[],
  index: number | null
): HTMLElement {
  const { doc, theme, labels } = deps;
  const box = el(doc, 'div', { className: theme.preview.orGroup });

  const header = el(doc, 'div', { className: theme.preview.orGroupHeader });
  const badge = el(doc, 'span', {
    className: theme.preview.orGroupBadge,
    text: index === null ? labels.or : String(index)
  });
  const headText = el(doc, 'div');
  headText.append(
    el(doc, 'p', { className: theme.preview.orGroupTitle, text: labels.previewMatchEither }),
    el(doc, 'p', {
      className: theme.preview.orGroupHint,
      text: labels.previewMatchEitherHint
    })
  );
  header.append(badge, headText);

  const list = el(doc, 'div', { className: theme.preview.orGroupChildren });
  for (const child of children) {
    list.appendChild(renderOrAlternative(deps, child));
  }
  box.append(header, list);
  return box;
}

function renderNode(
  deps: PreviewRenderDeps,
  node: DescriptionNode,
  index: number | null
): HTMLElement {
  if (node.type === 'rule') return renderRuleRow(deps, node, index);
  if (node.logic === 'or') return renderOrGroup(deps, node.children, index);

  // AND group: children stacked with AND connectors.
  const { doc, theme } = deps;
  const wrap = el(doc, 'div', { className: theme.preview.ruleList });
  node.children.forEach((child, i) => {
    if (i > 0) wrap.appendChild(renderAndConnector(deps));
    wrap.appendChild(renderNode(deps, child, i + 1));
  });
  return wrap;
}

/** Render the full "show a row when..." card for a description tree. */
export function renderConditionPreview(
  deps: PreviewRenderDeps,
  description: DescriptionNode
): HTMLElement {
  const { doc, theme, labels, icons } = deps;
  const card = el(doc, 'div', { className: theme.preview.card });

  const header = el(doc, 'div', { className: theme.preview.cardHeader });
  const headerIcon = el(doc, 'span', { className: theme.preview.cardHeaderIcon });
  headerIcon.appendChild(icon(doc, icons.filterActive, 'material-symbols-rounded text-[21px]'));
  const headerText = el(doc, 'div');
  headerText.append(
    el(doc, 'p', {
      className: theme.preview.cardHeaderTitle,
      text: labels.previewShowRowWhen
    }),
    el(doc, 'p', {
      className: theme.preview.cardHeaderHint,
      text: labels.previewJoinHint
    })
  );
  header.append(headerIcon, headerText);
  card.appendChild(header);

  card.appendChild(renderNode(deps, description, null));
  return card;
}

/** Render the validation-errors card. */
export function renderPreviewErrors(
  deps: PreviewRenderDeps,
  errors: string[]
): HTMLElement {
  const { doc, theme, labels, icons } = deps;
  const card = el(doc, 'div', { className: theme.preview.errorCard });
  const header = el(doc, 'div', { className: theme.preview.errorHeader });
  header.append(
    icon(doc, icons.info, 'material-symbols-rounded text-[19px]'),
    el(doc, 'span', { text: labels.previewFinishFirst })
  );
  const list = el(doc, 'ul', { className: theme.preview.errorList });
  for (const error of errors) {
    list.appendChild(el(doc, 'li', { text: error }));
  }
  card.append(header, list);
  return card;
}

/** Render the empty-state card. */
export function renderPreviewEmpty(deps: PreviewRenderDeps): HTMLElement {
  return el(deps.doc, 'div', {
    className: deps.theme.preview.emptyCard,
    text: deps.labels.previewNoConditions
  });
}
