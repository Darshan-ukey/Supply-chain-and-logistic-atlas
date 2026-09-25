/**
 * Test double for the Tabulator grid the engine drives, plus a `makeEngine`
 * convenience that wires a MalkomTableEngine to a FakeTabulator instance.
 *
 * The fake fires NOTHING automatically — tests call `trigger('tableBuilt')`
 * (etc.) themselves — and records every call the engine makes so tests can
 * assert against them.
 */

import {
  MalkomTableEngine,
  MemoryStateStorage
} from '@malkom/table-core';
import type {
  MalkomColumn,
  MalkomTableConfig,
  RowData,
  SmartPrefilter,
  TabColumnComponent,
  TabulatorGrid
} from '@malkom/table-core';

type Listener = (...args: any[]) => void;

/** Row shape used across the engine tests. */
export interface TestRow extends RowData {
  id: number;
  name: string;
  city: string;
  secret: string;
}

export class FakeColumn implements TabColumnComponent {
  visible: boolean;
  headerFilterValue: unknown = undefined;

  constructor(
    private readonly def: Record<string, unknown>,
    private readonly doc: Document
  ) {
    this.visible = def['visible'] !== false;
  }

  getField(): string | undefined {
    return this.def['field'] as string | undefined;
  }
  getDefinition(): { title?: string; field?: string } & Record<string, unknown> {
    return this.def as { title?: string; field?: string } & Record<string, unknown>;
  }
  isVisible(): boolean {
    return this.visible;
  }
  toggle(): void {
    this.visible = !this.visible;
  }
  show(): void {
    this.visible = true;
  }
  hide(): void {
    this.visible = false;
  }
  getElement(): HTMLElement {
    return this.doc.createElement('div');
  }
  getHeaderFilterValue(): unknown {
    return this.headerFilterValue;
  }
}

export class FakeTabulator implements TabulatorGrid {
  element: HTMLElement;
  options: Record<string, unknown>;
  columns: FakeColumn[];

  /** Rows currently held by the grid (kept up to date by data mutations). */
  data: RowData[] = [];

  // ------------------------------------------------------------- call records
  lastSetData: RowData[] | null = null;
  /** Every argument ever passed to setFilter, in order. */
  filters: unknown[] = [];
  /** The currently active programmatic filter function (null when cleared). */
  currentFilter: ((row: RowData) => boolean) | null = null;
  clearFilterCalls = 0;
  headerFilterValues: Record<string, unknown> = {};
  groupBy: string | string[] | false | null = null;
  clearSortCalls = 0;
  pageSize: number | null = null;
  setPageCalls: (number | string)[] = [];
  redrawCalls = 0;
  updateOrAddCalls: RowData[][] = [];
  deletedIds: unknown[] = [];
  destroyed = false;

  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(element: HTMLElement, options: Record<string, unknown>) {
    this.element = element;
    this.options = options;
    const doc = element.ownerDocument;
    // Real Tabulator renders a footer inside its root; the engine injects
    // its page-size controls into it.
    const footer = doc.createElement('div');
    footer.className = 'tabulator-footer';
    element.appendChild(footer);
    this.columns = ((options['columns'] as Record<string, unknown>[]) ?? []).map(
      (def) => new FakeColumn(def, doc)
    );
    if (options['groupBy'] !== undefined) {
      this.groupBy = options['groupBy'] as string | string[] | false;
    }
  }

  // ------------------------------------------------------------------ events
  on(event: string, callback: Listener): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
  }

  off(event: string, callback?: Listener): void {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.get(event)?.delete(callback);
  }

  /** Manually fire an event to every listener the engine registered. */
  trigger(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of Array.from(set)) listener(...args);
  }

  // -------------------------------------------------------------------- data
  setData(data: RowData[]): Promise<void> {
    this.lastSetData = data;
    this.data = [...data];
    return Promise.resolve();
  }

  private activeRows(): RowData[] {
    const filter = this.currentFilter;
    return filter ? this.data.filter((row) => filter(row)) : [...this.data];
  }

  getData(active?: 'active' | 'visible' | 'all'): RowData[] {
    if (active === 'active' || active === 'visible') return this.activeRows();
    return [...this.data];
  }

  getDataCount(active?: 'active' | 'visible' | 'all'): number {
    return this.getData(active).length;
  }

  // ----------------------------------------------------------------- filters
  setFilter(filter: unknown): void {
    this.filters.push(filter);
    this.currentFilter =
      typeof filter === 'function' ? (filter as (row: RowData) => boolean) : null;
  }

  addFilter(filter: unknown): void {
    this.filters.push(filter);
  }

  clearFilter(): void {
    this.clearFilterCalls += 1;
    this.currentFilter = null;
  }

  setHeaderFilterValue(field: string, value: unknown): void {
    this.headerFilterValues[field] = value;
    const column = this.columns.find((c) => c.getField() === field);
    if (column) column.headerFilterValue = value;
  }

  // ----------------------------------------------------------------- columns
  getColumns(): TabColumnComponent[] {
    return this.columns;
  }

  showColumn(field: string): void {
    this.columns.find((c) => c.getField() === field)?.show();
  }

  hideColumn(field: string): void {
    this.columns.find((c) => c.getField() === field)?.hide();
  }

  // -------------------------------------------------------------------- misc
  setGroupBy(groups: string | string[] | false): void {
    this.groupBy = groups;
  }

  clearSort(): void {
    this.clearSortCalls += 1;
  }

  setPageSize(size: number): void {
    this.pageSize = size;
  }

  setPage(page: number | 'first' | 'prev' | 'next' | 'last'): Promise<void> {
    this.setPageCalls.push(page);
    return Promise.resolve();
  }

  redraw(): void {
    this.redrawCalls += 1;
  }

  private indexField(): string {
    return String(this.options['index'] ?? 'id');
  }

  updateOrAddData(rows: RowData[]): Promise<unknown> {
    this.updateOrAddCalls.push(rows);
    const index = this.indexField();
    for (const row of rows) {
      const i = this.data.findIndex(
        (existing) => String(existing[index]) === String(row[index])
      );
      if (i >= 0) this.data[i] = { ...this.data[i], ...row };
      else this.data.push(row);
    }
    return Promise.resolve(undefined);
  }

  deleteRow(id: unknown): void {
    this.deletedIds.push(id);
    const index = this.indexField();
    this.data = this.data.filter((row) => String(row[index]) !== String(id));
  }

  destroy(): void {
    this.destroyed = true;
  }
}

// ---------------------------------------------------------------------------
// Engine factory
// ---------------------------------------------------------------------------

export function baseColumns(): MalkomColumn<TestRow>[] {
  return [
    { field: 'id', header: 'ID', type: 'number', locked: true },
    { field: 'name', header: 'Name', type: 'string' },
    { field: 'city', header: 'City', type: 'string' },
    {
      field: 'secret',
      header: 'Secret',
      type: 'string',
      searchable: false,
      headerFilter: false
    }
  ];
}

export function makeConfig(
  overrides: Partial<MalkomTableConfig<TestRow>> = {}
): MalkomTableConfig<TestRow> {
  return {
    title: 'Test Grid',
    index: 'id',
    columns: baseColumns(),
    storage: new MemoryStateStorage(),
    ...overrides,
    advanced: {
      tabulatorConstructor: FakeTabulator,
      ...overrides.advanced
    }
  };
}

export interface MakeEngineResult {
  engine: MalkomTableEngine<TestRow>;
  fake: FakeTabulator;
  container: HTMLDivElement;
}

/**
 * Build an engine on a fresh container div appended to document.body,
 * wired to a FakeTabulator.
 */
export function makeEngine(
  overrides: Partial<MalkomTableConfig<TestRow>> = {}
): MakeEngineResult {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const engine = new MalkomTableEngine<TestRow>(container, makeConfig(overrides));
  return {
    engine,
    fake: engine.getTabulator() as unknown as FakeTabulator,
    container
  };
}

export function sampleRows(): TestRow[] {
  return [
    { id: 1, name: 'Alpha', city: 'Sydney', secret: 'zebra' },
    { id: 2, name: 'Beta', city: 'Melbourne', secret: 'hush' },
    { id: 3, name: 'Gamma', city: 'Sydney', secret: 'quiet' }
  ];
}

/** A saved prefilter with a single `field equals value` rule. */
export function makePrefilter(
  id: string,
  name: string,
  field: string,
  value: string
): SmartPrefilter {
  const now = new Date().toISOString();
  return {
    id,
    name,
    root: {
      kind: 'group',
      logic: 'and',
      children: [{ kind: 'rule', field, operator: 'equals', value }]
    },
    createdAt: now,
    updatedAt: now
  };
}

/** Flush pending microtasks and zero-delay timers. */
export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
