/**
 * Behavior tests for MalkomTableEngine driven through a FakeTabulator.
 * The fake fires nothing automatically; each test triggers 'tableBuilt'
 * (and friends) explicitly.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MalkomTableEngine, MemoryStateStorage } from '@malkom/table-core';
import type { ExportContext, TableExporter } from '@malkom/table-core';
import {
  FakeTabulator,
  flush,
  makeConfig,
  makeEngine,
  makePrefilter,
  sampleRows,
  type TestRow
} from './helpers/fakeTabulator';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const searchInputsOf = (container: HTMLElement): HTMLInputElement[] =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input[placeholder="Search across all columns..."]'
    )
  );

describe('construction and shell', () => {
  it('renders the title, search inputs, export and settings buttons, and no refresh button without loadData', () => {
    const { container } = makeEngine();
    expect(container.textContent).toContain('Test Grid');
    expect(searchInputsOf(container).length).toBeGreaterThan(0);
    expect(container.querySelector('button[title="EXPORT"]')).not.toBeNull();
    expect(container.querySelector('button[title="SETTINGS"]')).not.toBeNull();
    expect(container.querySelector('button[title="Reload data"]')).toBeNull();
  });

  it('renders the refresh button and LIVE badge when loadData is provided', () => {
    const { container } = makeEngine({ loadData: async () => [] });
    expect(container.querySelector('button[title="Reload data"]')).not.toBeNull();
    expect(container.textContent).toContain('LIVE');
  });

  it('resolves a container given as an id string, with or without a leading #', () => {
    const host = document.createElement('div');
    host.id = 'engine-host';
    document.body.appendChild(host);
    const engine = new MalkomTableEngine<TestRow>('#engine-host', makeConfig());
    expect(host.textContent).toContain('Test Grid');
    expect(engine.getTabulator()).toBeInstanceOf(FakeTabulator);
    engine.destroy();
  });

  it('throws when the container cannot be found', () => {
    expect(
      () => new MalkomTableEngine<TestRow>('definitely-missing', makeConfig())
    ).toThrow(/not found/);
  });
});

describe('setData and formatData', () => {
  it('queues setData before tableBuilt and hands it to the grid once built', async () => {
    const rows = sampleRows();
    const { engine, fake } = makeEngine();
    engine.setData(rows);
    expect(fake.lastSetData).toBeNull();
    expect(engine.getRawData()).toEqual([]);

    fake.trigger('tableBuilt');
    await flush();
    expect(fake.lastSetData).toEqual(rows);
    expect(engine.getRawData()).toEqual(rows);
    expect(engine.isBuilt()).toBe(true);
  });

  it('feeds static config.data to the grid after tableBuilt', async () => {
    const rows = sampleRows();
    const { fake } = makeEngine({ data: rows });
    expect(fake.lastSetData).toBeNull();
    fake.trigger('tableBuilt');
    await flush();
    expect(fake.lastSetData).toEqual(rows);
  });

  it('applies formatData: raw and processed data differ and the grid renders the processed rows', async () => {
    const rows = sampleRows();
    const { engine, fake } = makeEngine({
      formatData: (input) =>
        input.map((r) => ({ ...r, name: String(r.name).toUpperCase() }))
    });
    fake.trigger('tableBuilt');
    engine.setData(rows);
    await flush();

    expect(engine.getRawData()[0]?.name).toBe('Alpha');
    expect(engine.getProcessedData()[0]?.name).toBe('ALPHA');
    expect(fake.lastSetData?.[0]?.['name']).toBe('ALPHA');
  });

  it('falls back to the raw rows and emits an internal error when formatData throws', async () => {
    const rows = sampleRows();
    const onError = vi.fn();
    const { engine, fake } = makeEngine({
      formatData: () => {
        throw new Error('boom');
      },
      onError
    });
    const errorSpy = vi.fn();
    engine.on('error', errorSpy);

    fake.trigger('tableBuilt');
    engine.setData(rows);
    await flush();

    expect(engine.getProcessedData()).toEqual(rows);
    expect(fake.lastSetData).toEqual(rows);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'internal');
    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error), 'internal');
  });
});

describe('refreshData', () => {
  it('loads rows into the grid, fires dataLoaded callbacks, updates the sync meta and reloads on demand', async () => {
    const first = sampleRows();
    const second: TestRow[] = [
      { id: 9, name: 'Omega', city: 'Perth', secret: 'shh' }
    ];
    const loadData = vi.fn(async () => first);
    const onDataLoaded = vi.fn();
    const notify = vi.fn();
    const { engine, fake, container } = makeEngine({
      loadData,
      onDataLoaded,
      notify
    });
    const dataLoadedSpy = vi.fn();
    engine.on('dataLoaded', dataLoadedSpy);

    expect(container.textContent).toContain('—'); // no sync time yet

    fake.trigger('tableBuilt'); // engine auto-refreshes when loadData exists
    await flush();

    expect(loadData).toHaveBeenCalledTimes(1);
    expect(fake.lastSetData).toEqual(first);
    expect(onDataLoaded).toHaveBeenCalledWith(first);
    expect(dataLoadedSpy).toHaveBeenCalledWith(first);
    expect(notify).toHaveBeenCalledWith('Data refreshed', 'info');
    expect(container.textContent).toContain('3 Records');
    expect(container.textContent).not.toContain('—'); // last-sync time rendered

    loadData.mockImplementation(async () => second);
    await engine.refreshData();
    expect(fake.lastSetData).toEqual(second);
    expect(container.textContent).toContain('1 Records');
  });

  it('notifies and emits an error with context load when loadData rejects', async () => {
    const loadData = vi.fn(async () => {
      throw new Error('backend down');
    });
    const notify = vi.fn();
    const onError = vi.fn();
    const { engine, fake } = makeEngine({ loadData, notify, onError });
    const errorSpy = vi.fn();
    engine.on('error', errorSpy);

    fake.trigger('tableBuilt');
    await flush();

    expect(notify).toHaveBeenCalledWith('Error loading data', 'error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'load');
    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error), 'load');
    expect(fake.lastSetData).toBeNull();
  });
});

describe('global search', () => {
  it('applies a programmatic filter for the search term and syncs the inputs', async () => {
    const { engine, fake, container } = makeEngine();
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    engine.setSearchTerm('sydney');
    expect(engine.getSearchTerm()).toBe('sydney');
    for (const input of searchInputsOf(container)) {
      expect(input.value).toBe('sydney');
    }
    expect(fake.currentFilter).toBeTypeOf('function');
    expect(fake.getData('active').map((r) => r['id'])).toEqual([1, 3]);
    expect(fake.getDataCount('active')).toBe(2);
  });

  it('does not match rows on non-searchable columns', async () => {
    const { engine, fake } = makeEngine();
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    // 'zebra' only appears in the secret column, which is searchable: false
    engine.setSearchTerm('zebra');
    expect(fake.getData('active')).toEqual([]);
  });

  it('clears the grid filter when the term is cleared', async () => {
    const { engine, fake } = makeEngine();
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    engine.setSearchTerm('sydney');
    expect(fake.currentFilter).not.toBeNull();
    engine.setSearchTerm('');
    expect(fake.currentFilter).toBeNull();
    expect(fake.getData('active')).toHaveLength(3);
  });
});

describe('smart prefilters', () => {
  it('savePrefilter activates the filter, filters rows and persists it', async () => {
    const storage = new MemoryStateStorage();
    const notify = vi.fn();
    const { engine, fake } = makeEngine({
      storage,
      persistenceId: 'pf-test',
      notify
    });
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    engine.savePrefilter(makePrefilter('pf1', 'Sydney only', 'city', 'Sydney'));

    expect(engine.getActivePrefilters().map((p) => p.id)).toEqual(['pf1']);
    expect(fake.getData('active').map((r) => r['id'])).toEqual([1, 3]);
    expect(notify).toHaveBeenCalledWith('Filter saved and applied', 'success');
    expect(storage.get('mte:pf-test:prefilters')).toContain('Sydney only');
    expect(storage.get('mte:pf-test:activePrefilterIds')).toContain('pf1');
  });

  it('a fresh engine with the same storage and persistenceId restores and reapplies the prefilter', async () => {
    const storage = new MemoryStateStorage();
    const a = makeEngine({ storage, persistenceId: 'pf-restore' });
    a.fake.trigger('tableBuilt');
    a.engine.setData(sampleRows());
    await flush();
    a.engine.savePrefilter(makePrefilter('pf1', 'Sydney only', 'city', 'Sydney'));

    const b = makeEngine({ storage, persistenceId: 'pf-restore' });
    expect(b.engine.getPrefilters().map((p) => p.id)).toEqual(['pf1']);
    expect(b.engine.getActivePrefilters().map((p) => p.id)).toEqual(['pf1']);

    b.fake.trigger('tableBuilt');
    b.engine.setData(sampleRows());
    await flush();
    expect(b.fake.getData('active').map((r) => r['id'])).toEqual([1, 3]);
  });

  it('togglePrefilter deactivates and reactivates a saved filter', async () => {
    const { engine, fake } = makeEngine();
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();
    const pf = makePrefilter('pf1', 'Sydney only', 'city', 'Sydney');
    engine.savePrefilter(pf);
    expect(fake.getData('active')).toHaveLength(2);

    engine.togglePrefilter(pf);
    expect(engine.getActivePrefilters()).toEqual([]);
    expect(fake.getData('active')).toHaveLength(3);

    engine.togglePrefilter(pf);
    expect(engine.getActivePrefilters().map((p) => p.id)).toEqual(['pf1']);
    expect(fake.getData('active')).toHaveLength(2);
  });

  it('deletePrefilter keeps the filter when confirmAction declines', async () => {
    const { engine } = makeEngine({ confirmAction: () => false });
    engine.savePrefilter(makePrefilter('pf1', 'Sydney only', 'city', 'Sydney'));

    await engine.deletePrefilter('pf1');
    expect(engine.getPrefilters().map((p) => p.id)).toEqual(['pf1']);
    expect(engine.getActivePrefilters().map((p) => p.id)).toEqual(['pf1']);
  });

  it('deletePrefilter removes the filter when confirmAction confirms', async () => {
    const { engine } = makeEngine({ confirmAction: async () => true });
    engine.savePrefilter(makePrefilter('pf1', 'Sydney only', 'city', 'Sydney'));

    await engine.deletePrefilter('pf1');
    expect(engine.getPrefilters()).toEqual([]);
    expect(engine.getActivePrefilters()).toEqual([]);
  });

  it('renders chips for active prefilters and the chip remove button deactivates', async () => {
    const { engine, fake, container } = makeEngine();
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();
    engine.savePrefilter(makePrefilter('pf1', 'Sydney only', 'city', 'Sydney'));

    const nameSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === 'Sydney only'
    );
    expect(nameSpan).toBeTruthy();
    const chip = nameSpan!.parentElement!;
    const removeBtn = chip.querySelector('button');
    expect(removeBtn).not.toBeNull();

    removeBtn!.click();
    expect(engine.getActivePrefilters()).toEqual([]);
    expect(fake.getData('active')).toHaveLength(3);
    expect(
      Array.from(container.querySelectorAll('span')).find(
        (s) => s.textContent === 'Sydney only'
      )
    ).toBeUndefined();
  });
});

describe('clearFilters', () => {
  it('clears search, active prefilters, grid filter and header filters for filterable columns, then notifies', async () => {
    const notify = vi.fn();
    const { engine, fake, container } = makeEngine({ notify });
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    engine.setSearchTerm('sydney');
    engine.savePrefilter(makePrefilter('pf1', 'Sydney only', 'city', 'Sydney'));
    const clearCallsBefore = fake.clearFilterCalls;
    notify.mockClear();

    engine.clearFilters();

    expect(engine.getSearchTerm()).toBe('');
    for (const input of searchInputsOf(container)) {
      expect(input.value).toBe('');
    }
    expect(engine.getActivePrefilters()).toEqual([]);
    expect(fake.clearFilterCalls).toBeGreaterThan(clearCallsBefore);
    // secret has headerFilter: false, so no header filter reset for it
    expect(fake.headerFilterValues).toEqual({ id: '', name: '', city: '' });
    expect(notify).toHaveBeenCalledWith('Filters cleared', 'info');
    expect(fake.getData('active')).toHaveLength(3);
  });
});

describe('grouping', () => {
  it('setGroupBy updates the grid, shows the chip with the column header, and the chip clear button clears it', () => {
    const notify = vi.fn();
    const { engine, fake, container } = makeEngine({ notify });
    fake.trigger('tableBuilt');

    engine.setGroupBy('city');
    expect(fake.groupBy).toBe('city');
    expect(engine.getGroupBy()).toBe('city');
    expect(notify).toHaveBeenCalledWith('Grouped: City', 'success');

    const clearBtn = container.querySelector<HTMLButtonElement>(
      'button[title="Clear grouping"]'
    );
    expect(clearBtn).not.toBeNull();
    const chipWrap = clearBtn!.parentElement!.parentElement!;
    expect(chipWrap.style.display).toBe('');
    expect(chipWrap.textContent).toContain('City');

    clearBtn!.click();
    expect(fake.groupBy).toBe(false);
    expect(engine.getGroupBy()).toBeNull();
    expect(chipWrap.style.display).toBe('none');
  });

  it('restores persisted groupBy on a fresh engine', () => {
    const storage = new MemoryStateStorage();
    const a = makeEngine({ storage, persistenceId: 'grp' });
    a.engine.setGroupBy('city');

    const b = makeEngine({ storage, persistenceId: 'grp' });
    expect(b.engine.getGroupBy()).toBe('city');
    expect(b.fake.options['groupBy']).toBe('city');

    b.fake.trigger('tableBuilt');
    const clearBtn = b.container.querySelector<HTMLButtonElement>(
      'button[title="Clear grouping"]'
    );
    const chipWrap = clearBtn!.parentElement!.parentElement!;
    expect(chipWrap.style.display).toBe('');
    expect(chipWrap.textContent).toContain('City');
  });
});

describe('density', () => {
  it('toggleDensity toggles the mte-dense class, persists it, and a fresh engine restores it', () => {
    // The engine owns an INNER shell element (first child of the container)
    // so host-owned container classes (e.g. React className) never collide.
    const shellOf = (containerEl: HTMLElement): HTMLElement =>
      containerEl.querySelector('.mte-shell') as HTMLElement;

    const storage = new MemoryStateStorage();
    const { engine, container } = makeEngine({ storage, persistenceId: 'den' });
    expect(shellOf(container).classList.contains('mte-dense')).toBe(false);
    expect(engine.isDense()).toBe(false);

    engine.toggleDensity();
    expect(shellOf(container).classList.contains('mte-dense')).toBe(true);
    expect(engine.isDense()).toBe(true);

    const b = makeEngine({ storage, persistenceId: 'den' });
    expect(b.engine.isDense()).toBe(true);
    expect(shellOf(b.container).classList.contains('mte-dense')).toBe(true);

    b.engine.toggleDensity();
    expect(shellOf(b.container).classList.contains('mte-dense')).toBe(false);
  });
});

describe('pagination', () => {
  it('injects a page-size select into the grid footer and changing it calls setPageSize', () => {
    const { fake } = makeEngine();
    fake.trigger('tableBuilt');

    const select = fake.element.querySelector<HTMLSelectElement>(
      '.tabulator-footer select'
    );
    expect(select).not.toBeNull();
    expect(Array.from(select!.options).map((o) => o.value)).toEqual([
      '15',
      '50',
      '100'
    ]);
    expect(select!.value).toBe('15'); // documented default page size

    select!.value = '50';
    select!.dispatchEvent(new Event('change'));
    expect(fake.pageSize).toBe(50);
  });

  it('persists the size on pageSizeChanged and a fresh engine applies it after build', async () => {
    const storage = new MemoryStateStorage();
    const a = makeEngine({ storage, persistenceId: 'pg' });
    a.fake.trigger('tableBuilt');
    a.fake.trigger('pageSizeChanged', 50);
    expect(storage.get('mte:pg:pageSize')).toBe('50');

    const b = makeEngine({ storage, persistenceId: 'pg' });
    b.fake.trigger('tableBuilt');
    expect(b.fake.pageSize).toBe(50);
    const select = b.fake.element.querySelector<HTMLSelectElement>(
      '.tabulator-footer select'
    );
    expect(select!.value).toBe('50');
    await flush(); // let the pageSizeChanged redraw timer settle
  });
});

describe('export', () => {
  const exportColumns = () => [
    { field: 'id', header: 'ID', type: 'number' as const, locked: true },
    {
      field: 'name',
      header: 'Name',
      exportValue: (row: TestRow) => `N:${row.name}`
    },
    { field: 'city', header: 'City' },
    {
      field: 'secret',
      header: 'Secret',
      searchable: false,
      exportable: false
    }
  ];

  it('runs the replaced csv exporter with active rows, visible exportable columns and exportValue overrides', async () => {
    const run = vi.fn();
    const exporter: TableExporter<TestRow> = { id: 'csv', label: 'Spy CSV', run };
    const notify = vi.fn();
    const { engine, fake } = makeEngine({
      exporters: [exporter],
      notify,
      columns: exportColumns()
    });
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    fake.hideColumn('city'); // hidden columns must not be exported
    engine.setSearchTerm('alpha'); // only row 1 stays active

    await engine.export('csv');

    expect(run).toHaveBeenCalledTimes(1);
    const ctx = run.mock.calls[0]![0] as ExportContext<TestRow>;
    expect(ctx.rows.map((r) => r.id)).toEqual([1]);
    expect(ctx.columns).toEqual([
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' }
    ]);
    expect(ctx.valueOf(ctx.rows[0]!, 'name')).toBe('N:Alpha');
    expect(ctx.valueOf(ctx.rows[0]!, 'id')).toBe(1);
    expect(ctx.meta.totalRows).toBe(3);
    expect(ctx.meta.filteredRows).toBe(1);
    expect(ctx.fileName).toMatch(/^Test_Grid_/);
    expect(notify).toHaveBeenCalledWith('Export successful', 'success');
  });

  it('notifies exportNoData and skips the exporter when there is no data', async () => {
    const run = vi.fn();
    const notify = vi.fn();
    const { engine, fake } = makeEngine({
      exporters: [{ id: 'csv', label: 'Spy CSV', run }],
      notify
    });
    fake.trigger('tableBuilt');

    await engine.export('csv');

    expect(run).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('No data to export', 'warning');
  });

  it('registerExporter adds an exporter usable by id at runtime', async () => {
    const run = vi.fn();
    const { engine, fake } = makeEngine({
      exporters: [{ id: 'csv', label: 'Spy CSV', run: vi.fn() }]
    });
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    engine.registerExporter({ id: 'extra', label: 'Extra', run });
    await engine.export('extra');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('applyRowUpdates', () => {
  it('merges patches, processes the merged row and calls updateOrAddData with it', async () => {
    const { engine, fake } = makeEngine({
      formatData: (rows) => rows.map((r) => ({ ...r, shout: `${r.name}!` }))
    });
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    engine.applyRowUpdates([{ id: 2, patch: { name: 'Betty' } }]);

    expect(engine.getRawData().find((r) => r.id === 2)?.name).toBe('Betty');
    const processed = engine.getProcessedData().find((r) => r.id === 2);
    expect(processed?.['shout']).toBe('Betty!');
    expect(fake.updateOrAddCalls.at(-1)?.[0]).toMatchObject({
      id: 2,
      name: 'Betty',
      shout: 'Betty!'
    });
  });

  it('removes rows from raw and processed data, calls deleteRow and updates the record count', async () => {
    const { engine, fake, container } = makeEngine({
      formatData: (rows) => rows.map((r) => ({ ...r }))
    });
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();
    expect(container.textContent).toContain('3 Records');

    engine.applyRowUpdates([{ id: 1, remove: true }]);

    expect(engine.getRawData().map((r) => r.id)).toEqual([2, 3]);
    expect(engine.getProcessedData()).toHaveLength(2);
    expect(fake.deletedIds).toEqual([1]);
    expect(container.textContent).toContain('2 Records');
  });

  // SUSPECTED SOURCE BUG: when no formatData is configured, processRows()
  // returns the input array unchanged, so this.rawData and this.processedData
  // reference the SAME array. applyRowUpdates' remove path then splices that
  // one array twice (once as rawData, once as processedData) and deletes an
  // extra, unrelated row: removing id 1 from [1,2,3] leaves [3], not [2,3].
  it('removes only the targeted row when no formatData is configured', async () => {
    const { engine, fake } = makeEngine();
    fake.trigger('tableBuilt');
    engine.setData(sampleRows());
    await flush();

    engine.applyRowUpdates([{ id: 1, remove: true }]);

    expect(engine.getRawData().map((r) => r.id)).toEqual([2, 3]);
    expect(fake.deletedIds).toEqual([1]);
  });
});

describe('engine events', () => {
  it('on and off subscribe and unsubscribe listeners', () => {
    const { engine, fake } = makeEngine();
    fake.trigger('tableBuilt');

    const spy = vi.fn();
    const unsubscribe = engine.on('searchChanged', spy);
    engine.setSearchTerm('a');
    expect(spy).toHaveBeenCalledWith('a');

    engine.off('searchChanged', spy);
    engine.setSearchTerm('b');
    expect(spy).toHaveBeenCalledTimes(1);

    const spy2 = vi.fn();
    const off2 = engine.on('densityChanged', spy2);
    off2();
    engine.toggleDensity();
    expect(spy2).not.toHaveBeenCalled();
    expect(unsubscribe).toBeTypeOf('function');
  });

  it('rowClick triggered on the grid reaches config.onRowClick and engine listeners', () => {
    const onRowClick = vi.fn();
    const { engine, fake } = makeEngine({ onRowClick });
    const listener = vi.fn();
    engine.on('rowClick', listener);

    const row: TestRow = { id: 7, name: 'Zed', city: 'Perth', secret: 'x' };
    const event = new Event('click');
    fake.trigger('rowClick', event, {
      getData: () => row,
      getElement: () => document.createElement('div'),
      update: () => undefined
    });

    expect(onRowClick).toHaveBeenCalledWith(row, event);
    expect(listener).toHaveBeenCalledWith(row, event);
  });
});

describe('destroy', () => {
  it('destroys the grid, empties the container, emits destroyed and is a no-op the second time', () => {
    const { engine, fake, container } = makeEngine();
    fake.trigger('tableBuilt');
    const destroyedSpy = vi.fn();
    engine.on('destroyed', destroyedSpy);

    engine.destroy();
    expect(fake.destroyed).toBe(true);
    expect(container.innerHTML).toBe('');
    expect(destroyedSpy).toHaveBeenCalledTimes(1);

    expect(() => engine.destroy()).not.toThrow();
    expect(destroyedSpy).toHaveBeenCalledTimes(1);
  });

  it('stops the auto-refresh interval on destroy', () => {
    vi.useFakeTimers();
    const loadData = vi.fn(async () => [] as TestRow[]);
    const { engine } = makeEngine({
      loadData,
      features: { autoRefreshMs: 50 }
    });

    engine.destroy();
    vi.advanceTimersByTime(1000);
    expect(loadData).not.toHaveBeenCalled();
  });
});
