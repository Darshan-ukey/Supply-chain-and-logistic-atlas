/**
 * Tests for the React binding <MalkomTable />.
 *
 * The engine is real (@malkom/table-core); the Tabulator grid is a minimal
 * inline fake injected through config.advanced.tabulatorConstructor so the
 * tests exercise the React lifecycle wiring, not Tabulator itself.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  MalkomTableEngine,
  MemoryStateStorage,
  type MalkomTableConfig,
  type RowData,
  type TabColumnComponent
} from '@malkom/table-core';
import { MalkomTable, type MalkomTableProps } from '../src/MalkomTable';

// React 18+/19 requires this flag for act() outside a test renderer.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface Row extends RowData {
  id: number;
  name: string;
}

/**
 * Minimal Tabulator stand-in: records constructor args and event handlers,
 * exposes an element with a .tabulator-footer child (the engine injects its
 * footer controls there), and implements every TabulatorGrid method as a
 * benign no-op. destroy() flips a flag so teardown can be asserted.
 */
class FakeTabulator {
  static instances: FakeTabulator[] = [];

  readonly host: HTMLElement;
  readonly options: Record<string, unknown>;
  readonly element: HTMLElement;
  readonly handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  data: RowData[] = [];
  setDataCalls = 0;
  destroyed = false;

  constructor(host: HTMLElement, options: Record<string, unknown>) {
    this.host = host;
    this.options = options;
    const doc = host.ownerDocument;
    this.element = doc.createElement('div');
    const footer = doc.createElement('div');
    footer.className = 'tabulator-footer';
    this.element.appendChild(footer);
    host.appendChild(this.element);
    FakeTabulator.instances.push(this);
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    const list = this.handlers.get(event) ?? [];
    list.push(callback);
    this.handlers.set(event, list);
  }
  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (!callback) {
      this.handlers.delete(event);
      return;
    }
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(
      event,
      list.filter((cb) => cb !== callback)
    );
  }
  /** Test helper: fire a recorded Tabulator event. */
  emit(event: string, ...args: unknown[]): void {
    for (const callback of this.handlers.get(event) ?? []) callback(...args);
  }

  setData(data: RowData[]): Promise<void> {
    this.setDataCalls += 1;
    this.data = data;
    return Promise.resolve();
  }
  getData(): RowData[] {
    return this.data;
  }
  getDataCount(): number {
    return this.data.length;
  }
  setFilter(): void {}
  addFilter(): void {}
  clearFilter(): void {}
  setHeaderFilterValue(): void {}
  getColumns(): TabColumnComponent[] {
    return [];
  }
  showColumn(): void {}
  hideColumn(): void {}
  setGroupBy(): void {}
  clearSort(): void {}
  setPageSize(): void {}
  setPage(): Promise<void> {
    return Promise.resolve();
  }
  redraw(): void {}
  updateOrAddData(): Promise<unknown> {
    return Promise.resolve([]);
  }
  deleteRow(): void {}
  destroy(): void {
    this.destroyed = true;
  }
}

function makeConfig(
  overrides: Partial<MalkomTableConfig<Row>> = {}
): MalkomTableConfig<Row> {
  return {
    title: 'Fleet Overview',
    index: 'id',
    columns: [
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'name', header: 'Name' }
    ],
    storage: new MemoryStateStorage(),
    advanced: { tabulatorConstructor: FakeTabulator },
    ...overrides
  };
}

let host: HTMLElement;
let root: Root;

function renderTable(props: MalkomTableProps<Row> & { ref?: unknown }): void {
  act(() => {
    root.render(<MalkomTable<Row> {...(props as MalkomTableProps<Row>)} />);
  });
}

function outerDiv(): HTMLElement {
  const el = host.firstElementChild;
  expect(el).toBeInstanceOf(HTMLElement);
  return el as HTMLElement;
}

beforeEach(() => {
  FakeTabulator.instances = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
  document.body.innerHTML = '';
});

describe('MalkomTable mounting', () => {
  test('mounting renders the engine shell inside the component container with the title visible', () => {
    renderTable({ config: makeConfig() });

    const outer = outerDiv();
    // buildShell mounts an INNER shell element (React owns the outer div's
    // className, so the engine skin lives one level down).
    expect(outer.classList.contains('mte-shell')).toBe(false);
    expect(outer.querySelector('.mte-shell')).not.toBeNull();
    expect(outer.textContent).toContain('Fleet Overview');
    const titleEl = Array.from(outer.querySelectorAll('div')).find(
      (d) => d.textContent === 'Fleet Overview'
    );
    expect(titleEl).toBeDefined();
  });

  test('the engine constructs the tabulator with a grid host inside the container and the documented default options', () => {
    renderTable({ config: makeConfig() });

    expect(FakeTabulator.instances).toHaveLength(1);
    const fake = FakeTabulator.instances[0]!;
    expect(outerDiv().contains(fake.host)).toBe(true);
    expect(fake.options['index']).toBe('id');
    expect(fake.options['layout']).toBe('fitDataFill');
    expect(fake.options['pagination']).toBe(true);
    expect(fake.options['paginationSize']).toBe(15);
    expect(Array.isArray(fake.options['columns'])).toBe(true);
    expect(fake.options['columns']).toHaveLength(2);
  });

  test('onReady is called exactly once per engine instance, with a MalkomTableEngine', () => {
    const onReady = vi.fn();
    const config = makeConfig();
    renderTable({ config, onReady });

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.calls[0]![0]).toBeInstanceOf(MalkomTableEngine);

    // Re-rendering with the same config identity must NOT re-create the engine.
    renderTable({ config, onReady });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(FakeTabulator.instances).toHaveLength(1);
  });

  test('the ref resolves to the same engine instance that onReady received', () => {
    const onReady = vi.fn();
    const ref = createRef<MalkomTableEngine<Row> | null>();
    renderTable({ config: makeConfig(), onReady, ref });

    expect(ref.current).toBeInstanceOf(MalkomTableEngine);
    expect(ref.current).toBe(onReady.mock.calls[0]![0]);
  });
});

describe('MalkomTable unmounting', () => {
  test('unmounting destroys the engine, empties the container and nulls the ref', () => {
    const ref = createRef<MalkomTableEngine<Row> | null>();
    renderTable({ config: makeConfig(), ref });

    const fake = FakeTabulator.instances[0]!;
    const outer = outerDiv();
    expect(fake.destroyed).toBe(false);

    act(() => {
      root.unmount();
    });

    expect(fake.destroyed).toBe(true);
    expect(outer.childNodes).toHaveLength(0);
    expect(ref.current).toBeNull();
    expect(host.childNodes).toHaveLength(0);
  });
});

describe('MalkomTable config prop', () => {
  test('changing the config identity destroys the old engine and creates a new one', () => {
    const onReady = vi.fn();
    const ref = createRef<MalkomTableEngine<Row> | null>();
    renderTable({ config: makeConfig(), onReady, ref });

    const firstEngine = onReady.mock.calls[0]![0] as MalkomTableEngine<Row>;
    const firstFake = FakeTabulator.instances[0]!;

    renderTable({ config: makeConfig(), onReady, ref });

    expect(onReady).toHaveBeenCalledTimes(2);
    const secondEngine = onReady.mock.calls[1]![0] as MalkomTableEngine<Row>;
    expect(secondEngine).toBeInstanceOf(MalkomTableEngine);
    expect(secondEngine).not.toBe(firstEngine);

    expect(firstFake.destroyed).toBe(true);
    expect(FakeTabulator.instances).toHaveLength(2);
    expect(FakeTabulator.instances[1]!.destroyed).toBe(false);

    expect(ref.current).toBe(secondEngine);
    // The new engine rebuilt the shell in the same container.
    expect(outerDiv().textContent).toContain('Fleet Overview');
  });
});

describe('MalkomTable data prop', () => {
  const rowsA: Row[] = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' }
  ];

  test('the data prop is pushed into the engine and lands once the table is built', () => {
    const onReady = vi.fn();
    const config = makeConfig();
    renderTable({ config, data: rowsA, onReady });

    const engine = onReady.mock.calls[0]![0] as MalkomTableEngine<Row>;
    const fake = FakeTabulator.instances[0]!;

    // Before tableBuilt the push is held as pending data.
    expect(engine.isBuilt()).toBe(false);
    expect(engine.getRawData()).toEqual([]);
    expect(fake.setDataCalls).toBe(0);

    act(() => {
      fake.emit('tableBuilt');
    });

    expect(engine.isBuilt()).toBe(true);
    expect(engine.getRawData()).toEqual(rowsA);
    expect(fake.setDataCalls).toBe(1);
    expect(fake.data).toEqual(rowsA);
  });

  test('a new data array identity is pushed again; the same identity is not', () => {
    const onReady = vi.fn();
    const config = makeConfig();
    renderTable({ config, data: rowsA, onReady });

    const engine = onReady.mock.calls[0]![0] as MalkomTableEngine<Row>;
    const fake = FakeTabulator.instances[0]!;
    act(() => {
      fake.emit('tableBuilt');
    });
    expect(fake.setDataCalls).toBe(1);

    const rowsB: Row[] = [{ id: 3, name: 'Gamma' }];
    renderTable({ config, data: rowsB, onReady });

    expect(engine.getRawData()).toEqual(rowsB);
    expect(fake.setDataCalls).toBe(2);
    expect(fake.data).toEqual(rowsB);

    // Same array identity: the effect must not push again.
    renderTable({ config, data: rowsB, onReady });
    expect(fake.setDataCalls).toBe(2);
  });
});

describe('MalkomTable container props', () => {
  test('style lands on the outer container div', () => {
    renderTable({
      config: makeConfig(),
      style: { width: '400px', marginTop: '8px' }
    });

    const outer = outerDiv();
    expect(outer.style.width).toBe('400px');
    expect(outer.style.marginTop).toBe('8px');
  });

  // SUSPECTED SOURCE BUG: MalkomTableProps.className is passed to the outer
  // div, but the engine's buildShell() then runs `container.className =
  // theme.shell`, which replaces (rather than appends to) the class React
  // set — so the documented className prop is silently discarded on mount.
  test('className lands on the outer container div', () => {
    renderTable({ config: makeConfig(), className: 'my-table' });

    expect(outerDiv().classList.contains('my-table')).toBe(true);
  });
});
