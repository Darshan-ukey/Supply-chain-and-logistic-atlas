/**
 * Excel-style value-set header filters: a funnel button per column opening a
 * checkbox menu of distinct values with counts, search, select-all/clear.
 */

import type {
  MalkomColumn,
  MalkomTableIcons,
  MalkomTableLabels,
  MalkomTableTheme,
  RowData,
  TabCellComponent
} from '../types.js';
import { adoptShellTheme } from './overlay.js';
import {
  clampMenuPosition,
  containsTarget,
  el,
  getByPath,
  icon,
  onEscape,
  onOutsideClick
} from './dom.js';

interface HeaderFilterDeps<TRow extends RowData> {
  doc: Document;
  theme: MalkomTableTheme;
  labels: MalkomTableLabels;
  icons: MalkomTableIcons;
  /** All loaded rows (unfiltered) — the value universe for the menu. */
  getAllRows: () => TRow[];
  /** The .mte-shell element — the scope the design tokens live on. */
  shellRoot: HTMLElement;
}

interface IconUpdater {
  button: HTMLButtonElement;
  update: () => void;
}

/**
 * Out-of-band key for blank cells. Using a sentinel (not the display label)
 * keeps genuinely blank cells distinguishable from cells whose text happens
 * to equal the "(Blanks)" label.
 */
export const BLANK_FILTER_KEY = '\u0000__mte_blanks__';

function valueKey(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') {
    return BLANK_FILTER_KEY;
  }
  return String(value);
}

function sortValueKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    // Blanks always sort first
    if (a === BLANK_FILTER_KEY) return b === BLANK_FILTER_KEY ? 0 : -1;
    if (b === BLANK_FILTER_KEY) return 1;
    const na = Number.parseFloat(a);
    const nb = Number.parseFloat(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

export class HeaderFilterController<TRow extends RowData> {
  private menuDispose: (() => void) | null = null;
  private readonly iconUpdaters = new Map<string, Set<IconUpdater>>();

  constructor(private readonly deps: HeaderFilterDeps<TRow>) {}

  /** Tabulator column-definition fragment enabling the filter for a column. */
  binding(column: MalkomColumn<TRow>): Record<string, unknown> {
    const keyOfRow = this.rowKeyFn(column);
    return {
      headerFilter: this.makeRenderer(column),
      headerFilterFunc: (
        headerValue: unknown,
        _rowValue: unknown,
        rowData: TRow
      ): boolean => {
        if (!Array.isArray(headerValue) || headerValue.length === 0) return true;
        return (headerValue as string[]).includes(keyOfRow(rowData));
      },
      headerFilterLiveFilter: false,
      headerFilterEmptyCheck: (value: unknown): boolean =>
        !Array.isArray(value) || value.length === 0
    };
  }

  /** Refresh funnel icons (e.g. after Clear Filters). */
  refreshIcons(field?: string): void {
    const entries = field
      ? [this.iconUpdaters.get(field)].filter(Boolean) as Set<IconUpdater>[]
      : Array.from(this.iconUpdaters.values());
    for (const set of entries) {
      for (const updater of Array.from(set)) {
        if (!updater.button.isConnected) {
          set.delete(updater);
          continue;
        }
        updater.update();
      }
    }
  }

  closeMenu(): void {
    if (this.menuDispose) {
      this.menuDispose();
      this.menuDispose = null;
    }
  }

  dispose(): void {
    this.closeMenu();
    this.iconUpdaters.clear();
  }

  // -------------------------------------------------------------------------

  private rowKeyFn(column: MalkomColumn<TRow>): (row: TRow) => string {
    const filterValue = column.filterValue;
    if (filterValue) return (row) => valueKey(filterValue(row));
    const field = column.field;
    return (row) => valueKey(getByPath(row, field));
  }

  private makeRenderer(column: MalkomColumn<TRow>) {
    return (
      cell: TabCellComponent,
      _onRendered: (cb: () => void) => void,
      success: (value: unknown) => void,
      _cancel: (value?: unknown) => void
    ): HTMLElement => {
      const { doc, theme, icons } = this.deps;
      const container = el(doc, 'div', {
        className: 'flex items-center justify-center h-full'
      });
      container.style.width = '14px';
      const button = el(doc, 'button', { type: 'button' });

      const currentFilterValue = (): unknown =>
        cell.getColumn().getHeaderFilterValue?.();

      const renderIcon = (active: boolean): void => {
        button.className = active
          ? theme.headerFilterMenu.buttonActive
          : theme.headerFilterMenu.button;
        button.innerHTML = '';
        button.appendChild(
          icon(
            doc,
            active ? icons.filterActive : icons.filter,
            'material-symbols-rounded text-[12px]'
          )
        );
      };

      const update = (): void => {
        try {
          const value = currentFilterValue();
          renderIcon(Array.isArray(value) && value.length > 0);
        } catch {
          renderIcon(false);
        }
      };

      // Paint the inactive icon synchronously WITHOUT querying Tabulator:
      // getHeaderFilterValue() before the header filter element is assigned
      // logs a "Column Filter Error" console warning per column. The real
      // state is read one tick later, once Tabulator finished wiring.
      renderIcon(false);
      setTimeout(update, 0);

      let set = this.iconUpdaters.get(column.field);
      if (!set) {
        set = new Set();
        this.iconUpdaters.set(column.field, set);
      }
      set.add({ button, update });

      // Keep header presses on the funnel from starting a column drag
      // (Tabulator's movableColumns listens for mousedown/touchstart on the
      // whole header and starts a move after a 250ms hold).
      button.addEventListener('mousedown', (event) => event.stopPropagation());
      button.addEventListener('touchstart', (event) => event.stopPropagation(), {
        passive: true
      });

      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.openMenu(button, column, currentFilterValue(), (value) => {
          success(value);
          update();
        });
      });

      container.appendChild(button);
      return container;
    };
  }

  private openMenu(
    anchor: HTMLElement,
    column: MalkomColumn<TRow>,
    currentValue: unknown,
    apply: (value: unknown) => void
  ): void {
    this.closeMenu();
    const { doc, theme, labels } = this.deps;
    const keyOfRow = this.rowKeyFn(column);

    // Value universe with counts
    const counts = new Map<string, number>();
    for (const row of this.deps.getAllRows()) {
      const key = keyOfRow(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sortedValues = sortValueKeys(Array.from(counts.keys()));
    const selected = new Set<string>(
      Array.isArray(currentValue) && currentValue.length > 0
        ? (currentValue as unknown[]).map(String)
        : sortedValues
    );

    const menu = el(doc, 'div', { className: theme.headerFilterMenu.menu });

    const searchBox = el(doc, 'div', { className: theme.headerFilterMenu.searchBox });
    const searchInput = el(doc, 'input', {
      className: theme.headerFilterMenu.searchInput,
      type: 'text',
      placeholder: labels.searchPlaceholder
    });
    searchBox.appendChild(searchInput);

    const actions = el(doc, 'div', { className: theme.headerFilterMenu.actionsRow });
    const selectAll = el(doc, 'span', {
      className: theme.headerFilterMenu.actionLink,
      text: labels.selectAll
    });
    const clearAll = el(doc, 'span', {
      className: theme.headerFilterMenu.actionLink,
      text: labels.clear
    });
    actions.append(selectAll, clearAll);

    const list = el(doc, 'div', { className: theme.headerFilterMenu.list });
    const displayOf = (value: string): string =>
      value === BLANK_FILTER_KEY ? labels.blanks : value;

    const renderList = (items: string[]): void => {
      list.innerHTML = '';
      if (items.length === 0) {
        list.appendChild(
          el(doc, 'div', {
            className: theme.headerFilterMenu.empty,
            text: labels.noMatches
          })
        );
        return;
      }
      for (const value of items) {
        const item = el(doc, 'label', { className: theme.headerFilterMenu.listItem });
        const checkbox = el(doc, 'input', {
          className: theme.headerFilterMenu.checkbox,
          type: 'checkbox'
        });
        checkbox.checked = selected.has(value);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selected.add(value);
          else selected.delete(value);
        });
        const labelSpan = el(doc, 'span', {
          className: theme.headerFilterMenu.itemLabel,
          text: displayOf(value),
          title: displayOf(value)
        });
        const countSpan = el(doc, 'span', {
          className: theme.headerFilterMenu.itemCount,
          text: String(counts.get(value) ?? 0)
        });
        item.append(checkbox, labelSpan, countSpan);
        list.appendChild(item);
      }
    };
    renderList(sortedValues);

    const visibleItems = (): string[] => {
      const term = searchInput.value.toLowerCase();
      return term
        ? sortedValues.filter((v) => displayOf(v).toLowerCase().includes(term))
        : sortedValues;
    };
    searchInput.addEventListener('input', () => renderList(visibleItems()));
    selectAll.addEventListener('click', () => {
      sortedValues.forEach((v) => selected.add(v));
      renderList(visibleItems());
    });
    clearAll.addEventListener('click', () => {
      selected.clear();
      renderList(visibleItems());
    });

    const footer = el(doc, 'div', { className: theme.headerFilterMenu.footer });
    const cancelBtn = el(doc, 'button', {
      className: theme.headerFilterMenu.cancelButton,
      text: labels.cancel,
      type: 'button'
    });
    const applyBtn = el(doc, 'button', {
      className: theme.headerFilterMenu.applyButton,
      text: labels.apply,
      type: 'button'
    });
    footer.append(cancelBtn, applyBtn);

    menu.append(searchBox, actions, list, footer);
    adoptShellTheme(this.deps.shellRoot, menu);
    doc.body.appendChild(menu);

    // Position near the anchor, clamped to the viewport
    const rect = anchor.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || 256;
    const menuHeight = menu.offsetHeight || 300;
    const viewport = {
      width: doc.defaultView?.innerWidth ?? 1024,
      height: doc.defaultView?.innerHeight ?? 768
    };
    const pos = clampMenuPosition(rect, menuWidth, menuHeight, viewport);
    menu.style.left = `${pos.left}px`;
    menu.style.top = `${pos.top}px`;

    const disposeOutside = onOutsideClick(
      doc,
      (target) => containsTarget(menu, target),
      () => this.closeMenu()
    );
    const disposeEscape = onEscape(doc, () => this.closeMenu());

    this.menuDispose = (): void => {
      disposeOutside();
      disposeEscape();
      menu.remove();
    };

    cancelBtn.addEventListener('click', () => this.closeMenu());
    applyBtn.addEventListener('click', () => {
      const finalSelection = Array.from(selected);
      apply(finalSelection.length === sortedValues.length ? '' : finalSelection);
      this.closeMenu();
    });
    searchInput.focus();
  }
}
