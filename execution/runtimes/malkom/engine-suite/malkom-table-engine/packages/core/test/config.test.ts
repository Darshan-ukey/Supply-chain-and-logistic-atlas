/**
 * Tests for config resolution (resolveConfig) and groupableColumns.
 *
 * resolveConfig applies every documented default exactly once, up front.
 * jsdom provides the global document these tests rely on.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  DEFAULT_ICONS,
  DEFAULT_LABELS,
  DEFAULT_OPERATOR_LABELS,
  DEFAULT_THEME,
  JsonStore,
  MemoryStateStorage,
  type MalkomColumn,
  type MalkomTableConfig
} from '@malkom/table-core';
import { groupableColumns, resolveConfig } from '../src/internal/config';

function baseConfig(
  overrides: Partial<MalkomTableConfig> = {}
): MalkomTableConfig {
  return {
    title: 'Test Table',
    index: 'id',
    columns: [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' }
    ],
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('resolveConfig validation', () => {
  test('throws when title is missing', () => {
    expect(() => resolveConfig(baseConfig({ title: '' }))).toThrow(
      'MalkomTableConfig.title is required'
    );
  });

  test('throws when index is missing', () => {
    expect(() => resolveConfig(baseConfig({ index: '' }))).toThrow(
      'MalkomTableConfig.index is required'
    );
  });

  test('throws when columns is an empty array', () => {
    expect(() => resolveConfig(baseConfig({ columns: [] }))).toThrow(
      'MalkomTableConfig.columns must be a non-empty array'
    );
  });

  test('throws when columns is not an array at all', () => {
    const config = baseConfig();
    (config as Record<string, unknown>).columns = undefined;
    expect(() => resolveConfig(config)).toThrow(
      'MalkomTableConfig.columns must be a non-empty array'
    );
  });

  test('throws when a column has no field', () => {
    const columns = [{ field: '', header: 'Broken' }] as MalkomColumn[];
    expect(() => resolveConfig(baseConfig({ columns }))).toThrow(
      'Every column requires a field'
    );
  });

  test('throws when a column has no header, naming the offending field', () => {
    const columns = [{ field: 'status', header: '' }] as MalkomColumn[];
    expect(() => resolveConfig(baseConfig({ columns }))).toThrow(
      'Column "status" requires a header'
    );
  });

  test('throws on duplicate column fields', () => {
    const columns: MalkomColumn[] = [
      { field: 'id', header: 'ID' },
      { field: 'id', header: 'ID again' }
    ];
    expect(() => resolveConfig(baseConfig({ columns }))).toThrow(
      'Duplicate column field "id"'
    );
  });
});

describe('resolveConfig feature defaults', () => {
  test('refresh and liveBadge default to false without loadData', () => {
    const resolved = resolveConfig(baseConfig());
    expect(resolved.features.refresh).toBe(false);
    expect(resolved.features.liveBadge).toBe(false);
  });

  test('refresh and liveBadge default to true when loadData is provided', () => {
    const resolved = resolveConfig(baseConfig({ loadData: async () => [] }));
    expect(resolved.features.refresh).toBe(true);
    expect(resolved.features.liveBadge).toBe(true);
  });

  test('documented defaults: paginationSize 15, sizes [15,50,100], skeleton true, searchDebounceMs 250', () => {
    const resolved = resolveConfig(baseConfig());
    expect(resolved.features.paginationSize).toBe(15);
    expect(resolved.features.paginationSizes).toEqual([15, 50, 100]);
    expect(resolved.features.skeleton).toBe(true);
    expect(resolved.features.searchDebounceMs).toBe(250);
  });

  test('explicit feature values win over defaults', () => {
    const resolved = resolveConfig(
      baseConfig({
        loadData: async () => [],
        features: {
          refresh: false,
          liveBadge: false,
          paginationSize: 25,
          paginationSizes: [25, 200],
          skeleton: false,
          searchDebounceMs: 10
        }
      })
    );
    expect(resolved.features.refresh).toBe(false);
    expect(resolved.features.liveBadge).toBe(false);
    expect(resolved.features.paginationSize).toBe(25);
    expect(resolved.features.paginationSizes).toEqual([25, 200]);
    expect(resolved.features.skeleton).toBe(false);
    expect(resolved.features.searchDebounceMs).toBe(10);
  });
});

describe('resolveConfig labels, icons and theme', () => {
  test('label overrides merge over the defaults', () => {
    const resolved = resolveConfig(
      baseConfig({ labels: { records: 'Rows' } })
    );
    expect(resolved.labels.records).toBe('Rows');
    // Untouched labels keep their default values.
    expect(resolved.labels.searchPlaceholder).toBe(
      DEFAULT_LABELS.searchPlaceholder
    );
    expect(resolved.labels.noRecords).toBe(DEFAULT_LABELS.noRecords);
  });

  test('operatorLabels merge key-by-key over the defaults', () => {
    const resolved = resolveConfig(
      baseConfig({
        labels: { operatorLabels: { equals: 'matches exactly' } }
      })
    );
    expect(resolved.labels.operatorLabels.equals).toBe('matches exactly');
    // The rest of the operator labels survive the merge.
    expect(resolved.labels.operatorLabels.contains).toBe(
      DEFAULT_OPERATOR_LABELS.contains
    );
    expect(resolved.labels.operatorLabels.empty).toBe(
      DEFAULT_OPERATOR_LABELS.empty
    );
  });

  test('icon overrides merge over the defaults', () => {
    const resolved = resolveConfig(baseConfig({ icons: { search: 'zoom_in' } }));
    expect(resolved.icons.search).toBe('zoom_in');
    expect(resolved.icons.refresh).toBe(DEFAULT_ICONS.refresh);
  });

  test('theme overrides deep-merge into resolved.theme', () => {
    const resolved = resolveConfig(
      baseConfig({ theme: { topBar: { title: 'custom-title-class' } } })
    );
    expect(resolved.theme.topBar.title).toBe('custom-title-class');
    // Sibling keys and other sections keep their defaults.
    expect(resolved.theme.topBar.searchInput).toBe(
      DEFAULT_THEME.topBar.searchInput
    );
    expect(resolved.theme.shell).toBe(DEFAULT_THEME.shell);
  });

  test('with no theme override, resolved.theme is the default theme', () => {
    const resolved = resolveConfig(baseConfig());
    expect(resolved.theme).toEqual(DEFAULT_THEME);
  });
});

describe('resolveConfig persistence store', () => {
  test('store is null when no persistenceId is given', () => {
    const resolved = resolveConfig(baseConfig());
    expect(resolved.store).toBeNull();
  });

  test('store is a JsonStore namespaced under mte:<persistenceId> when one is given', () => {
    const storage = new MemoryStateStorage();
    const resolved = resolveConfig(
      baseConfig({ persistenceId: 'my-table', storage })
    );
    expect(resolved.store).toBeInstanceOf(JsonStore);

    resolved.store!.write('density', true);
    expect(storage.get('mte:my-table:density')).toBe('true');
    expect(resolved.store!.read('density', false)).toBe(true);
  });
});

describe('resolveConfig condition fields', () => {
  test('excludes filterable:false columns and defaults type to string', () => {
    const columns: MalkomColumn[] = [
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'name', header: 'Name' },
      { field: 'rawHtml', header: 'Raw', filterable: false }
    ];
    const resolved = resolveConfig(baseConfig({ columns }));
    expect(resolved.conditionFields).toEqual([
      { field: 'id', label: 'ID', type: 'number' },
      { field: 'name', label: 'Name', type: 'string' }
    ]);
  });
});

describe('resolveConfig export file name', () => {
  test('default name is the title with whitespace as underscores plus the date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T10:00:00Z'));
    const resolved = resolveConfig(baseConfig({ title: 'My Cool Table' }));
    expect(resolved.exportFileName()).toBe('My_Cool_Table_2026-08-13');
  });

  test('a string override has illegal filename characters sanitized', () => {
    const resolved = resolveConfig(
      baseConfig({ exportFileName: 'my/export:file*name?' })
    );
    expect(resolved.exportFileName()).toBe('my_export_file_name_');
  });

  test('a string override that sanitizes to nothing falls back to malkom-export', () => {
    const resolved = resolveConfig(baseConfig({ exportFileName: '   ' }));
    expect(resolved.exportFileName()).toBe('malkom-export');
  });

  test('a function override is called and its result sanitized', () => {
    const resolved = resolveConfig(
      baseConfig({ exportFileName: () => 'q*bert<report>' })
    );
    expect(resolved.exportFileName()).toBe('q_bert_report_');
  });
});

describe('resolveConfig notify and confirmAction', () => {
  test('notify defaults to a no-op', () => {
    const resolved = resolveConfig(baseConfig());
    expect(() => resolved.notify('hello', 'info')).not.toThrow();
    expect(resolved.notify('hello', 'error')).toBeUndefined();
  });

  test('a provided notify function is used as-is', () => {
    const notify = vi.fn();
    const resolved = resolveConfig(baseConfig({ notify }));
    resolved.notify('saved', 'success');
    expect(notify).toHaveBeenCalledWith('saved', 'success');
  });

  test('confirmAction resolves true when globalThis.confirm is absent', async () => {
    vi.stubGlobal('confirm', undefined);
    const resolved = resolveConfig(baseConfig());
    await expect(resolved.confirmAction('Delete this filter?')).resolves.toBe(true);
  });

  test('confirmAction uses window.confirm when present', async () => {
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);
    const resolved = resolveConfig(baseConfig());
    await expect(resolved.confirmAction('Delete this filter?')).resolves.toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith('Delete this filter?');
  });

  test('a config-level confirmAction override takes priority over window.confirm', async () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmSpy);
    const resolved = resolveConfig(
      baseConfig({ confirmAction: async () => false })
    );
    await expect(resolved.confirmAction('Sure?')).resolves.toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe('resolveConfig document resolution', () => {
  test('uses the global jsdom document by default', () => {
    const resolved = resolveConfig(baseConfig());
    expect(resolved.doc).toBe(document);
  });
});

describe('groupableColumns', () => {
  test('filters out groupable:false and keeps the rest', () => {
    const columns: MalkomColumn[] = [
      { field: 'region', header: 'Region' },
      { field: 'notes', header: 'Notes', groupable: false },
      { field: 'status', header: 'Status', groupable: true }
    ];
    expect(groupableColumns(columns).map((c) => c.field)).toEqual([
      'region',
      'status'
    ]);
  });

  test('returns an empty list when nothing is groupable', () => {
    const columns: MalkomColumn[] = [
      { field: 'a', header: 'A', groupable: false }
    ];
    expect(groupableColumns(columns)).toEqual([]);
  });
});
