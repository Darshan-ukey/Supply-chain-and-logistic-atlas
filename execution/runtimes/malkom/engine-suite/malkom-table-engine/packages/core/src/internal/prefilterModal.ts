/**
 * Smart-prefilter modal: name + nested AND/OR condition builder + live
 * plain-English preview. The builder is engine-owned (no external
 * ConditionBuilder dependency).
 */

import {
  cloneCondition,
  describeCondition,
  emptyGroup,
  emptyRule,
  operatorsForType,
  validateCondition,
  VALUELESS_OPERATORS,
  type ConditionFieldInfo,
  type ConditionGroup,
  type ConditionNode,
  type ConditionRule,
  type SmartPrefilter
} from '../conditions.js';
import type { MalkomTableIcons, MalkomTableLabels, MalkomTableTheme } from '../types.js';
import { el, icon, onEscape, uid } from './dom.js';
import {
  renderConditionPreview,
  renderPreviewEmpty,
  renderPreviewErrors,
  type PreviewRenderDeps
} from './previewRender.js';

export interface PrefilterModalDeps {
  doc: Document;
  theme: MalkomTableTheme;
  labels: MalkomTableLabels;
  icons: MalkomTableIcons;
  fields: ConditionFieldInfo[];
  notify: (message: string, kind: 'info' | 'success' | 'warning' | 'error') => void;
  onSave: (prefilter: SmartPrefilter) => void;
}

export class PrefilterModal {
  private backdrop: HTMLElement | null = null;
  private builderScroll: HTMLElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  private previewPopover: HTMLElement | null = null;
  private previewBody: HTMLElement | null = null;
  private escDispose: (() => void) | null = null;
  private root: ConditionGroup = emptyGroup();
  private editing: SmartPrefilter | null = null;

  constructor(private readonly deps: PrefilterModalDeps) {}

  isOpen(): boolean {
    return this.backdrop !== null;
  }

  open(existing: SmartPrefilter | null = null): void {
    this.close();
    this.editing = existing;
    this.root = existing
      ? cloneCondition(existing.root)
      : { kind: 'group', logic: 'and', children: [this.newRule()] };
    this.render();
  }

  close(): void {
    if (this.escDispose) {
      this.escDispose();
      this.escDispose = null;
    }
    this.previewPopover = null;
    this.previewBody = null;
    this.builderScroll = null;
    this.nameInput = null;
    const backdrop = this.backdrop;
    this.backdrop = null;
    if (backdrop) {
      const { theme } = this.deps;
      backdrop.classList.remove(...splitClasses(theme.modal.backdropVisible));
      setTimeout(() => backdrop.remove(), 200);
    }
  }

  dispose(): void {
    if (this.escDispose) {
      this.escDispose();
      this.escDispose = null;
    }
    this.backdrop?.remove();
    this.backdrop = null;
  }

  // -------------------------------------------------------------------------

  private newRule(): ConditionRule {
    const firstField = this.deps.fields[0];
    const rule = emptyRule(firstField?.field ?? '');
    if (firstField) {
      const ops = operatorsForType(firstField.type);
      rule.operator = ops[0] ?? 'contains';
    }
    return rule;
  }

  private fieldInfo(field: string): ConditionFieldInfo | undefined {
    return this.deps.fields.find((f) => f.field === field);
  }

  private previewDeps(): PreviewRenderDeps {
    const { doc, theme, labels, icons } = this.deps;
    return { doc, theme, labels, icons };
  }

  private render(): void {
    const { doc, theme, labels, icons: ic } = this.deps;

    const backdrop = el(doc, 'div', { className: theme.modal.backdrop });
    const content = el(doc, 'div', { className: theme.modal.content });

    // Header
    const header = el(doc, 'div', { className: theme.modal.header });
    const title = el(doc, 'h3', { className: theme.modal.title });
    title.append(
      icon(doc, ic.filterActive, theme.modal.titleIcon),
      doc.createTextNode(this.editing ? labels.editSmartFilter : labels.newSmartFilter)
    );
    const closeBtn = el(doc, 'button', {
      className: theme.modal.closeButton,
      title: labels.close,
      type: 'button'
    });
    closeBtn.appendChild(icon(doc, ic.close));
    closeBtn.addEventListener('click', () => this.close());
    header.append(title, closeBtn);

    // Body: name + logic builder
    const body = el(doc, 'div', { className: theme.modal.body });

    const nameSection = el(doc, 'div', { className: 'shrink-0' });
    nameSection.appendChild(
      el(doc, 'label', { className: theme.modal.nameLabel, text: labels.filterName })
    );
    const nameInput = el(doc, 'input', {
      className: theme.modal.nameInput,
      type: 'text',
      placeholder: labels.filterNamePlaceholder,
      value: this.editing?.name ?? ''
    });
    this.nameInput = nameInput;
    nameSection.appendChild(nameInput);

    const logicSection = el(doc, 'div', { className: theme.modal.logicSection });
    const logicHeader = el(doc, 'div', { className: theme.modal.logicHeader });
    logicHeader.append(
      el(doc, 'span', { className: theme.modal.logicTitle, text: labels.filterLogic }),
      el(doc, 'span', { className: theme.modal.logicHint, text: labels.filterLogicHint })
    );
    const builderScroll = el(doc, 'div', { className: theme.modal.builderScroll });
    this.builderScroll = builderScroll;
    logicSection.append(logicHeader, builderScroll);

    body.append(nameSection, logicSection);

    // Footer: preview toggle + cancel/save
    const footer = el(doc, 'div', { className: theme.modal.footer });
    const footerLeft = el(doc, 'div', { className: theme.modal.footerLeft });
    const previewBtn = el(doc, 'button', {
      className: theme.modal.previewButton,
      type: 'button'
    });
    previewBtn.append(
      icon(doc, ic.visibility, 'material-symbols-rounded text-[19px]'),
      el(doc, 'span', { text: labels.showMyConditions })
    );
    previewBtn.addEventListener('click', () => this.togglePreview(footerLeft));
    footerLeft.appendChild(previewBtn);

    const footerRight = el(doc, 'div', { className: theme.modal.footerRight });
    const cancelBtn = el(doc, 'button', {
      className: theme.modal.cancelButton,
      text: labels.cancel,
      type: 'button'
    });
    cancelBtn.addEventListener('click', () => this.close());
    const saveBtn = el(doc, 'button', {
      className: theme.modal.saveButton,
      text: labels.save,
      type: 'button'
    });
    saveBtn.addEventListener('click', () => this.save());
    footerRight.append(cancelBtn, saveBtn);

    footer.append(footerLeft, footerRight);
    content.append(header, body, footer);
    backdrop.appendChild(content);
    doc.body.appendChild(backdrop);
    this.backdrop = backdrop;

    this.renderBuilder();

    this.escDispose = onEscape(doc, () => {
      if (this.previewPopover) this.closePreview();
      else this.close();
    });

    // animate in
    const win = doc.defaultView;
    const show = (): void => {
      backdrop.classList.add(...splitClasses(this.deps.theme.modal.backdropVisible));
      content.classList.add(...splitClasses(this.deps.theme.modal.contentVisible));
      nameInput.focus();
      nameInput.select();
    };
    if (win?.requestAnimationFrame) win.requestAnimationFrame(show);
    else show();
  }

  // ------------------------------------------------------------ Builder

  private renderBuilder(): void {
    const scroll = this.builderScroll;
    if (!scroll) return;
    scroll.innerHTML = '';
    scroll.appendChild(this.renderGroup(this.root, null));
  }

  private renderGroup(
    group: ConditionGroup,
    parent: ConditionGroup | null
  ): HTMLElement {
    const { doc, theme, labels, icons: ic } = this.deps;
    const card = el(doc, 'div', { className: theme.builder.group });

    // Header: AND/OR toggle + actions
    const header = el(doc, 'div', { className: theme.builder.groupHeader });
    const toggleWrap = el(doc, 'div', { className: theme.builder.logicToggleWrap });
    const andBtn = el(doc, 'button', {
      className:
        group.logic === 'and'
          ? theme.builder.logicButtonActive
          : theme.builder.logicButtonInactive,
      text: labels.and,
      type: 'button'
    });
    const orBtn = el(doc, 'button', {
      className:
        group.logic === 'or'
          ? theme.builder.logicButtonActive
          : theme.builder.logicButtonInactive,
      text: labels.or,
      type: 'button'
    });
    andBtn.addEventListener('click', () => {
      group.logic = 'and';
      this.renderBuilder();
    });
    orBtn.addEventListener('click', () => {
      group.logic = 'or';
      this.renderBuilder();
    });
    toggleWrap.append(andBtn, orBtn);

    const actions = el(doc, 'div', { className: theme.builder.headerActions });
    const addRuleBtn = el(doc, 'button', {
      className: theme.builder.addRuleButton,
      title: labels.addCondition,
      type: 'button'
    });
    addRuleBtn.append(
      icon(doc, ic.addCircle, 'material-symbols-rounded text-base'),
      doc.createTextNode(labels.addCondition)
    );
    addRuleBtn.addEventListener('click', () => {
      group.children.push(this.newRule());
      this.renderBuilder();
    });
    const addGroupBtn = el(doc, 'button', {
      className: theme.builder.addGroupButton,
      title: labels.addGroup,
      type: 'button'
    });
    addGroupBtn.append(
      icon(doc, ic.add, 'material-symbols-rounded text-base'),
      doc.createTextNode(labels.addGroup)
    );
    addGroupBtn.addEventListener('click', () => {
      const nested = emptyGroup(group.logic === 'and' ? 'or' : 'and');
      nested.children.push(this.newRule());
      group.children.push(nested);
      this.renderBuilder();
    });
    actions.append(addRuleBtn, addGroupBtn);

    if (parent) {
      const removeBtn = el(doc, 'button', {
        className: theme.builder.removeGroupButton,
        type: 'button'
      });
      removeBtn.appendChild(icon(doc, ic.delete, 'material-symbols-rounded text-base'));
      removeBtn.addEventListener('click', () => {
        parent.children = parent.children.filter((child) => child !== group);
        this.renderBuilder();
      });
      actions.appendChild(removeBtn);
    }

    header.append(toggleWrap, actions);
    card.appendChild(header);

    // Children
    const children = el(doc, 'div', { className: theme.builder.children });
    if (group.children.length === 0) {
      children.appendChild(
        el(doc, 'div', {
          className: theme.builder.emptyGroup,
          text: labels.previewNoConditions
        })
      );
    }
    group.children.forEach((child, index) => {
      if (child.kind === 'group') {
        children.appendChild(this.renderGroup(child, group));
      } else {
        children.appendChild(this.renderRule(child, group, index));
      }
    });
    card.appendChild(children);
    return card;
  }

  private renderRule(
    rule: ConditionRule,
    group: ConditionGroup,
    index: number
  ): HTMLElement {
    const { doc, theme, labels, icons: ic, fields } = this.deps;
    const row = el(doc, 'div', { className: theme.builder.ruleRow });

    // Field select
    const fieldSelect = el(doc, 'select', { className: theme.builder.fieldSelect });
    for (const field of fields) {
      const opt = el(doc, 'option', { text: field.label });
      opt.value = field.field;
      if (field.field === rule.field) opt.selected = true;
      fieldSelect.appendChild(opt);
    }
    fieldSelect.addEventListener('change', () => {
      const previousType = this.fieldInfo(rule.field)?.type ?? 'string';
      rule.field = fieldSelect.value;
      const nextType = this.fieldInfo(rule.field)?.type ?? 'string';
      const ops = operatorsForType(nextType);
      if (!ops.includes(rule.operator)) {
        rule.operator = ops[0] ?? 'contains';
      }
      // A value typed for another type (e.g. "archived" on a boolean/number
      // field) would silently match nothing — reset it on type change.
      if (previousType !== nextType) {
        rule.value = '';
      }
      this.renderBuilder();
    });

    // Operator select
    const info = this.fieldInfo(rule.field);
    const type = info?.type ?? 'string';
    const operatorSelect = el(doc, 'select', {
      className: theme.builder.operatorSelect
    });
    for (const op of operatorsForType(type)) {
      const opt = el(doc, 'option', {
        text: labels.operatorLabels[op] ?? op
      });
      opt.value = op;
      if (op === rule.operator) opt.selected = true;
      operatorSelect.appendChild(opt);
    }
    operatorSelect.addEventListener('change', () => {
      rule.operator = operatorSelect.value as ConditionRule['operator'];
      this.renderBuilder();
    });

    // Value input (type-aware; hidden for valueless operators)
    const valueless = VALUELESS_OPERATORS.has(rule.operator);
    let valueEl: HTMLElement;
    if (valueless) {
      valueEl = el(doc, 'div', { className: 'col-span-4' });
    } else if (type === 'boolean') {
      // The model must always match what the select displays.
      if (rule.value !== 'true' && rule.value !== 'false') rule.value = 'true';
      const select = el(doc, 'select', { className: theme.builder.valueInput });
      for (const bool of ['true', 'false']) {
        const opt = el(doc, 'option', { text: bool });
        opt.value = bool;
        if (bool === rule.value) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        rule.value = select.value;
      });
      valueEl = select;
    } else {
      const input = el(doc, 'input', {
        className: theme.builder.valueInput,
        type: type === 'number' ? 'number' : type === 'date' ? 'date' : 'text',
        placeholder:
          rule.operator === 'oneOf' ? labels.oneOfPlaceholder : labels.valuePlaceholder,
        value: rule.value ?? ''
      });
      input.addEventListener('input', () => {
        rule.value = input.value;
      });
      valueEl = input;
    }

    // Actions: move up/down + remove
    const actions = el(doc, 'div', { className: theme.builder.ruleActions });
    const upBtn = el(doc, 'button', {
      className: theme.builder.ruleActionButton,
      type: 'button'
    });
    upBtn.appendChild(icon(doc, ic.moveUp, 'material-symbols-rounded text-base'));
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => {
      if (index > 0) {
        const prev = group.children[index - 1];
        const curr = group.children[index];
        if (prev !== undefined && curr !== undefined) {
          group.children[index - 1] = curr;
          group.children[index] = prev;
          this.renderBuilder();
        }
      }
    });
    const downBtn = el(doc, 'button', {
      className: theme.builder.ruleActionButton,
      type: 'button'
    });
    downBtn.appendChild(icon(doc, ic.moveDown, 'material-symbols-rounded text-base'));
    downBtn.disabled = index >= group.children.length - 1;
    downBtn.addEventListener('click', () => {
      if (index < group.children.length - 1) {
        const next = group.children[index + 1];
        const curr = group.children[index];
        if (next !== undefined && curr !== undefined) {
          group.children[index + 1] = curr;
          group.children[index] = next;
          this.renderBuilder();
        }
      }
    });
    const removeBtn = el(doc, 'button', {
      className: theme.builder.ruleActionButton,
      type: 'button'
    });
    removeBtn.appendChild(
      icon(doc, ic.removeCircle, 'material-symbols-rounded text-base')
    );
    removeBtn.addEventListener('click', () => {
      group.children = group.children.filter(
        (child: ConditionNode) => child !== rule
      );
      this.renderBuilder();
    });
    actions.append(upBtn, downBtn, removeBtn);

    row.append(fieldSelect, operatorSelect, valueEl, actions);
    return row;
  }

  // ------------------------------------------------------------ Preview

  private togglePreview(anchorWrap: HTMLElement): void {
    if (this.previewPopover) {
      this.closePreview();
      return;
    }
    const { doc, theme, labels, icons: ic, fields } = this.deps;
    const popover = el(doc, 'div', { className: theme.modal.previewPopover });

    const header = el(doc, 'div', { className: theme.modal.previewHeader });
    const headLeft = el(doc, 'div', { className: 'flex items-start gap-2' });
    const headIcon = el(doc, 'span', { className: theme.modal.previewHeaderIcon });
    headIcon.appendChild(
      icon(doc, ic.visibility, 'material-symbols-rounded text-[21px]')
    );
    const headText = el(doc, 'div');
    headText.append(
      el(doc, 'p', { className: theme.modal.previewHeaderTitle, text: labels.previewTitle }),
      el(doc, 'p', {
        className: theme.modal.previewHeaderSubtitle,
        text: labels.previewSubtitle
      })
    );
    headLeft.append(headIcon, headText);
    const closeBtn = el(doc, 'button', {
      className: theme.modal.previewClose,
      type: 'button'
    });
    closeBtn.appendChild(icon(doc, ic.close, 'material-symbols-rounded text-[18px]'));
    closeBtn.addEventListener('click', () => this.closePreview());
    header.append(headLeft, closeBtn);

    const body = el(doc, 'div', { className: theme.modal.previewBody });
    this.previewBody = body;
    popover.append(header, body);
    anchorWrap.appendChild(popover);
    this.previewPopover = popover;

    this.renderPreviewContent();
  }

  private renderPreviewContent(): void {
    const body = this.previewBody;
    if (!body) return;
    body.innerHTML = '';
    const deps = this.previewDeps();
    const { labels } = this.deps;

    const hasAnyCondition = this.root.children.length > 0;
    if (!hasAnyCondition) {
      body.appendChild(renderPreviewEmpty(deps));
      return;
    }

    const validation = validateCondition(this.root, this.deps.fields);
    if (!validation.valid) {
      body.appendChild(renderPreviewErrors(deps, validation.errors));
      return;
    }

    const intro = el(deps.doc, 'div', {
      className:
        'rounded-xl border border-pink-100 bg-pink-50 px-3 py-3 text-sm font-semibold leading-6 text-slate-700 mb-3',
      text: labels.previewIntro
    });
    body.appendChild(intro);
    body.appendChild(
      renderConditionPreview(
        deps,
        describeCondition(this.root, this.deps.fields, labels.operatorLabels)
      )
    );
  }

  private closePreview(): void {
    this.previewPopover?.remove();
    this.previewPopover = null;
    this.previewBody = null;
  }

  // ------------------------------------------------------------ Save

  private save(): void {
    const { labels, notify } = this.deps;
    const name = this.nameInput?.value.trim() ?? '';
    if (!name) {
      notify(labels.nameRequired, 'warning');
      return;
    }
    if (this.root.children.length === 0) {
      notify(labels.conditionRequired, 'warning');
      return;
    }
    const validation = validateCondition(this.root, this.deps.fields);
    if (!validation.valid) {
      notify(validation.errors.join('\n'), 'warning');
      return;
    }

    const now = new Date().toISOString();
    const prefilter: SmartPrefilter = {
      id: this.editing?.id ?? uid('pf'),
      name,
      root: cloneCondition(this.root),
      createdAt: this.editing?.createdAt ?? now,
      updatedAt: now
    };
    this.deps.onSave(prefilter);
    this.close();
  }
}

function splitClasses(classString: string): string[] {
  return classString.split(/\s+/).filter(Boolean);
}
