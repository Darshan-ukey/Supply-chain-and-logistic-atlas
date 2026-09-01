/**
 * Settings drawer ("View Controls"): quick actions, grouping, smart
 * prefilters and column visibility toggles.
 */

import type { SmartPrefilter } from '../conditions.js';
import type { MalkomTableIcons, MalkomTableLabels, MalkomTableTheme } from '../types.js';
import type { ResolvedFeatures } from './config.js';
import { el, icon, onEscape } from './dom.js';

export interface DrawerColumnInfo {
  field: string;
  title: string;
  visible: boolean;
  locked: boolean;
}

export interface DrawerGroupOption {
  field: string;
  header: string;
}

export interface DrawerCallbacks {
  onClearFilters: () => void;
  onClearSort: () => void;
  onGroupChange: (field: string | null) => void;
  onMasterReset: () => void;
  onCreateFilter: () => void;
  onEditFilter: (prefilter: SmartPrefilter) => void;
  onDeleteFilter: (id: string) => void;
  onTogglePrefilter: (prefilter: SmartPrefilter) => void;
  onToggleColumn: (field: string) => void;
  onShowSavedPreview: (prefilter: SmartPrefilter, anchor: HTMLElement) => void;
}

export interface DrawerDeps {
  doc: Document;
  theme: MalkomTableTheme;
  labels: MalkomTableLabels;
  icons: MalkomTableIcons;
  features: ResolvedFeatures;
  mountRoot: HTMLElement;
  getGroupableColumns: () => DrawerGroupOption[];
  getCurrentGroupField: () => string | null;
  getColumns: () => DrawerColumnInfo[];
  getPrefilters: () => SmartPrefilter[];
  getActivePrefilterIds: () => ReadonlySet<string>;
  callbacks: DrawerCallbacks;
}

export class SettingsDrawer {
  private overlay: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private groupSelect: HTMLSelectElement | null = null;
  private prefilterList: HTMLElement | null = null;
  private columnGrid: HTMLElement | null = null;
  private prefilterAccordionOpen = false;
  private prefilterBody: HTMLElement | null = null;
  private prefilterChevron: HTMLElement | null = null;
  private escDispose: (() => void) | null = null;
  private openState = false;

  constructor(private readonly deps: DrawerDeps) {}

  isOpen(): boolean {
    return this.openState;
  }

  open(): void {
    if (this.openState) return;
    this.openState = true;
    this.render();
    const doc = this.deps.doc;
    this.escDispose = onEscape(doc, () => this.close());
    // animate in
    const win = doc.defaultView;
    const show = (): void => {
      if (this.panel) {
        this.panel.classList.remove(...splitClasses(this.deps.theme.drawer.panelClosed));
        this.panel.classList.add(...splitClasses(this.deps.theme.drawer.panelOpen));
      }
    };
    if (win?.requestAnimationFrame) win.requestAnimationFrame(show);
    else show();
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    if (this.escDispose) {
      this.escDispose();
      this.escDispose = null;
    }
    const overlay = this.overlay;
    const panel = this.panel;
    this.overlay = null;
    this.panel = null;
    this.groupSelect = null;
    this.prefilterList = null;
    this.columnGrid = null;
    this.prefilterBody = null;
    this.prefilterChevron = null;
    if (panel) {
      panel.classList.remove(...splitClasses(this.deps.theme.drawer.panelOpen));
      panel.classList.add(...splitClasses(this.deps.theme.drawer.panelClosed));
    }
    if (overlay) {
      setTimeout(() => overlay.remove(), 200);
    }
  }

  /** Re-render dynamic sections while open (prefilters, columns, grouping). */
  refresh(): void {
    if (!this.openState) return;
    this.renderGroupSelectValue();
    this.renderPrefilterList();
    this.renderColumnGrid();
  }

  dispose(): void {
    if (this.escDispose) {
      this.escDispose();
      this.escDispose = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    this.panel = null;
    this.openState = false;
  }

  // -------------------------------------------------------------------------

  private render(): void {
    const { doc, theme, labels, icons: ic, features, mountRoot, callbacks } = this.deps;

    this.overlay?.remove();
    const overlay = el(doc, 'div', { className: theme.drawer.overlay });
    const backdrop = el(doc, 'div', { className: theme.drawer.backdrop });
    backdrop.addEventListener('click', () => this.close());

    const panel = el(doc, 'div', {
      className: `${theme.drawer.panel} ${theme.drawer.panelClosed}`
    });

    // Header
    const header = el(doc, 'div', { className: theme.drawer.header });
    const headTitle = el(doc, 'div', { className: theme.drawer.headerTitleWrap });
    headTitle.append(
      icon(doc, ic.gamepad, theme.drawer.headerIcon),
      el(doc, 'h3', { className: theme.drawer.headerTitle, text: labels.viewControls })
    );
    const closeBtn = el(doc, 'button', {
      className: theme.drawer.closeButton,
      title: labels.close,
      type: 'button'
    });
    closeBtn.appendChild(icon(doc, ic.close));
    closeBtn.addEventListener('click', () => this.close());
    header.append(headTitle, closeBtn);

    // Body
    const body = el(doc, 'div', { className: theme.drawer.body });

    // Quick actions
    const quick = el(doc, 'div', { className: theme.drawer.quickActions });
    const clearFiltersBtn = el(doc, 'button', {
      className: theme.drawer.clearFiltersButton,
      type: 'button'
    });
    clearFiltersBtn.append(
      icon(doc, ic.filterOff, 'material-symbols-rounded text-[18px]'),
      doc.createTextNode(labels.clearFilters)
    );
    clearFiltersBtn.addEventListener('click', () => callbacks.onClearFilters());
    const clearSortBtn = el(doc, 'button', {
      className: theme.drawer.clearSortButton,
      type: 'button'
    });
    clearSortBtn.append(
      icon(doc, ic.sort, 'material-symbols-rounded text-[18px]'),
      doc.createTextNode(labels.clearSort)
    );
    clearSortBtn.addEventListener('click', () => callbacks.onClearSort());
    quick.append(clearFiltersBtn, clearSortBtn);
    body.appendChild(quick);

    // Grouping
    if (features.grouping) {
      const section = el(doc, 'div');
      section.appendChild(
        el(doc, 'h4', { className: theme.drawer.sectionTitle, text: labels.groupDataBy })
      );
      const select = el(doc, 'select', { className: theme.drawer.groupSelect });
      const noneOption = el(doc, 'option', { text: labels.noGrouping });
      noneOption.value = '';
      select.appendChild(noneOption);
      for (const option of this.deps.getGroupableColumns()) {
        const opt = el(doc, 'option', { text: option.header });
        opt.value = option.field;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        callbacks.onGroupChange(select.value === '' ? null : select.value);
      });
      this.groupSelect = select;
      section.appendChild(select);
      body.appendChild(section);
    }

    // Smart prefilters
    if (features.prefilters) {
      const section = el(doc, 'div', { className: theme.drawer.prefilterSection });
      const headerBtn = el(doc, 'button', {
        className: theme.drawer.prefilterHeader,
        type: 'button'
      });
      const headerTitle = el(doc, 'span', {
        className: theme.drawer.prefilterHeaderTitle
      });
      headerTitle.append(
        icon(doc, ic.prefilter, theme.drawer.prefilterHeaderIcon),
        doc.createTextNode(labels.smartPrefilters)
      );
      const chevron = icon(doc, ic.expandMore, theme.drawer.prefilterChevron);
      headerBtn.append(headerTitle, chevron);
      this.prefilterChevron = chevron;

      const prefBody = el(doc, 'div', { className: theme.drawer.prefilterBody });
      const list = el(doc, 'div', { className: theme.drawer.prefilterList });
      const createBtn = el(doc, 'button', {
        className: theme.drawer.createFilterButton,
        type: 'button'
      });
      createBtn.append(
        icon(doc, ic.add, 'material-symbols-rounded text-lg'),
        doc.createTextNode(labels.createNewFilter)
      );
      createBtn.addEventListener('click', () => callbacks.onCreateFilter());
      prefBody.append(list, createBtn);
      this.prefilterList = list;
      this.prefilterBody = prefBody;

      const applyAccordion = (): void => {
        prefBody.style.display = this.prefilterAccordionOpen ? '' : 'none';
        chevron.style.transform = this.prefilterAccordionOpen
          ? 'rotate(180deg)'
          : 'rotate(0deg)';
      };
      applyAccordion();
      headerBtn.addEventListener('click', () => {
        this.prefilterAccordionOpen = !this.prefilterAccordionOpen;
        applyAccordion();
      });

      section.append(headerBtn, prefBody);
      body.appendChild(section);
    }

    // Visible columns
    if (features.columnToggles) {
      const section = el(doc, 'div');
      section.appendChild(
        el(doc, 'h4', {
          className: theme.drawer.sectionTitle,
          text: labels.visibleColumns
        })
      );
      const grid = el(doc, 'div', { className: theme.drawer.columnGrid });
      this.columnGrid = grid;
      section.appendChild(grid);
      body.appendChild(section);
    }

    // Footer: master reset
    const footer = el(doc, 'div', { className: theme.drawer.footer });
    const resetBtn = el(doc, 'button', {
      className: theme.drawer.masterResetButton,
      type: 'button'
    });
    resetBtn.append(
      icon(doc, ic.reset, 'material-symbols-rounded text-lg'),
      doc.createTextNode(labels.masterReset)
    );
    resetBtn.addEventListener('click', () => callbacks.onMasterReset());
    footer.appendChild(resetBtn);

    panel.append(header, body, footer);
    overlay.append(backdrop, panel);
    mountRoot.appendChild(overlay);

    this.overlay = overlay;
    this.panel = panel;

    this.renderGroupSelectValue();
    this.renderPrefilterList();
    this.renderColumnGrid();
  }

  private renderGroupSelectValue(): void {
    if (!this.groupSelect) return;
    this.groupSelect.value = this.deps.getCurrentGroupField() ?? '';
  }

  private renderPrefilterList(): void {
    const list = this.prefilterList;
    if (!list) return;
    const { doc, theme, labels, icons: ic, callbacks } = this.deps;
    list.innerHTML = '';

    const prefilters = this.deps.getPrefilters();
    if (prefilters.length === 0) {
      list.appendChild(
        el(doc, 'div', {
          className: theme.drawer.prefilterEmpty,
          text: labels.noSavedFilters
        })
      );
      return;
    }

    const activeIds = this.deps.getActivePrefilterIds();
    for (const prefilter of prefilters) {
      const isActive = activeIds.has(prefilter.id);
      const item = el(doc, 'div', {
        className: isActive
          ? theme.drawer.prefilterItemActive
          : theme.drawer.prefilterItem
      });

      const applyZone = el(doc, 'div', {
        className: 'flex items-center gap-3 cursor-pointer flex-grow'
      });
      applyZone.append(
        el(doc, 'span', {
          className: isActive
            ? theme.drawer.prefilterDotActive
            : theme.drawer.prefilterDot
        }),
        el(doc, 'span', {
          className: isActive
            ? theme.drawer.prefilterNameActive
            : theme.drawer.prefilterName,
          text: prefilter.name
        })
      );
      applyZone.addEventListener('click', () => callbacks.onTogglePrefilter(prefilter));

      const actions = el(doc, 'div', { className: theme.drawer.prefilterActions });
      const previewBtn = el(doc, 'button', {
        className: theme.drawer.prefilterActionButton,
        title: labels.showMyConditions,
        type: 'button'
      });
      previewBtn.appendChild(
        icon(doc, ic.visibility, 'material-symbols-rounded text-lg')
      );
      previewBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        callbacks.onShowSavedPreview(prefilter, previewBtn);
      });
      const editBtn = el(doc, 'button', {
        className: theme.drawer.prefilterActionButton,
        type: 'button'
      });
      editBtn.appendChild(icon(doc, ic.edit, 'material-symbols-rounded text-lg'));
      editBtn.addEventListener('click', () => callbacks.onEditFilter(prefilter));
      const deleteBtn = el(doc, 'button', {
        className: theme.drawer.prefilterActionButton,
        type: 'button'
      });
      deleteBtn.appendChild(icon(doc, ic.delete, 'material-symbols-rounded text-lg'));
      deleteBtn.addEventListener('click', () => callbacks.onDeleteFilter(prefilter.id));
      actions.append(previewBtn, editBtn, deleteBtn);

      item.append(applyZone, actions);
      list.appendChild(item);
    }
  }

  private renderColumnGrid(): void {
    const grid = this.columnGrid;
    if (!grid) return;
    const { doc, theme, icons: ic, callbacks } = this.deps;
    grid.innerHTML = '';

    for (const column of this.deps.getColumns()) {
      const button = el(doc, 'button', { type: 'button' });
      const base = column.visible
        ? theme.drawer.columnButtonVisible
        : theme.drawer.columnButtonHidden;
      button.className = column.locked
        ? `${base} ${theme.drawer.columnButtonLocked}`
        : base;
      button.append(
        el(doc, 'span', { text: column.title }),
        icon(
          doc,
          column.locked ? ic.lock : column.visible ? ic.visibility : ic.visibilityOff,
          'material-symbols-rounded text-[16px]'
        )
      );
      if (!column.locked) {
        button.addEventListener('click', () => {
          callbacks.onToggleColumn(column.field);
        });
      }
      grid.appendChild(button);
    }
  }
}

function splitClasses(classString: string): string[] {
  return classString.split(/\s+/).filter(Boolean);
}
