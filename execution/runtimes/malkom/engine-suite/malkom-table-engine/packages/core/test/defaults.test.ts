import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LABELS,
  DEFAULT_OPERATOR_LABELS,
  DEFAULT_THEME,
  formatLabel,
  mergeTheme
} from '@malkom/table-core';
import type { ConditionOperator } from '@malkom/table-core';

describe('mergeTheme', () => {
  it('returns the base theme unchanged when no override is given', () => {
    expect(mergeTheme(DEFAULT_THEME)).toBe(DEFAULT_THEME);
    expect(mergeTheme(DEFAULT_THEME, undefined)).toBe(DEFAULT_THEME);
  });

  it('deep-merges a nested override while preserving sibling keys', () => {
    const merged = mergeTheme(DEFAULT_THEME, {
      topBar: { title: 'custom-title-class' }
    });
    expect(merged.topBar.title).toBe('custom-title-class');
    // Siblings inside the overridden section survive.
    expect(merged.topBar.container).toBe(DEFAULT_THEME.topBar.container);
    expect(merged.topBar.searchInput).toBe(DEFAULT_THEME.topBar.searchInput);
    // Untouched sections survive.
    expect(merged.drawer).toEqual(DEFAULT_THEME.drawer);
    expect(merged.shell).toBe(DEFAULT_THEME.shell);
  });

  it('replaces top-level string leaves', () => {
    const merged = mergeTheme(DEFAULT_THEME, { shell: 'my-shell' });
    expect(merged.shell).toBe('my-shell');
  });

  it('does not mutate the base theme', () => {
    const originalTitle = DEFAULT_THEME.topBar.title;
    const originalShell = DEFAULT_THEME.shell;
    const snapshot = JSON.parse(JSON.stringify(DEFAULT_THEME));

    mergeTheme(DEFAULT_THEME, {
      shell: 'mutant-shell',
      topBar: { title: 'mutant-title' },
      drawer: { panel: 'mutant-panel' }
    });

    expect(DEFAULT_THEME.topBar.title).toBe(originalTitle);
    expect(DEFAULT_THEME.shell).toBe(originalShell);
    expect(DEFAULT_THEME).toEqual(snapshot);
  });

  it('ignores undefined override values', () => {
    const merged = mergeTheme(DEFAULT_THEME, {
      shell: undefined,
      topBar: { title: undefined, container: 'new-container' }
    });
    expect(merged.shell).toBe(DEFAULT_THEME.shell);
    expect(merged.topBar.title).toBe(DEFAULT_THEME.topBar.title);
    expect(merged.topBar.container).toBe('new-container');
  });

  it('merging two nested overrides in sequence keeps both', () => {
    const step1 = mergeTheme(DEFAULT_THEME, { drawer: { panel: 'p1' } });
    const step2 = mergeTheme(step1, { drawer: { header: 'h2' } });
    expect(step2.drawer.panel).toBe('p1');
    expect(step2.drawer.header).toBe('h2');
  });
});

describe('DEFAULT_THEME', () => {
  it('spot check: key topBar classes are non-empty strings', () => {
    const keys = [
      'container',
      'inner',
      'title',
      'searchInput',
      'iconButton',
      'exportButton',
      'settingsButton',
      'liveBadge'
    ] as const;
    for (const key of keys) {
      const value = DEFAULT_THEME.topBar[key];
      expect(typeof value, `topBar.${key}`).toBe('string');
      expect(value.length, `topBar.${key} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('spot check: key drawer classes are non-empty strings', () => {
    const keys = [
      'overlay',
      'backdrop',
      'panel',
      'header',
      'headerTitle',
      'body',
      'sectionTitle',
      'masterResetButton'
    ] as const;
    for (const key of keys) {
      const value = DEFAULT_THEME.drawer[key];
      expect(typeof value, `drawer.${key}`).toBe('string');
      expect(value.length, `drawer.${key} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('every topBar and drawer leaf is a string', () => {
    for (const [key, value] of Object.entries(DEFAULT_THEME.topBar)) {
      expect(typeof value, `topBar.${key}`).toBe('string');
    }
    for (const [key, value] of Object.entries(DEFAULT_THEME.drawer)) {
      expect(typeof value, `drawer.${key}`).toBe('string');
    }
  });
});

describe('formatLabel', () => {
  it('replaces a {name} placeholder with its value', () => {
    expect(formatLabel('Applied: {name}', { name: 'Priority Sydney' })).toBe(
      'Applied: Priority Sydney'
    );
  });

  it('works with the actual DEFAULT_LABELS templates', () => {
    expect(formatLabel(DEFAULT_LABELS.filterApplied, { name: 'X' })).toBe(
      'Applied: X'
    );
    expect(formatLabel(DEFAULT_LABELS.filterRemoved, { name: 'X' })).toBe(
      'Removed: X'
    );
  });

  it('leaves unknown placeholders intact', () => {
    expect(formatLabel('Hi {name}, {unknown}!', { name: 'Bob' })).toBe(
      'Hi Bob, {unknown}!'
    );
  });

  it('replaces repeated placeholders everywhere they occur', () => {
    expect(formatLabel('{a} and {a} and {b}', { a: '1', b: '2' })).toBe(
      '1 and 1 and 2'
    );
  });

  it('returns the template untouched when there are no placeholders', () => {
    expect(formatLabel('no vars here', { name: 'x' })).toBe('no vars here');
  });
});

describe('DEFAULT_LABELS.operatorLabels', () => {
  const ALL_OPERATORS: ConditionOperator[] = [
    'equals',
    'notEquals',
    'lessThan',
    'lessThanOrEqual',
    'greaterThan',
    'greaterThanOrEqual',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'oneOf',
    'empty',
    'notEmpty',
    'regex'
  ];

  it('covers every operator with a non-empty label', () => {
    for (const op of ALL_OPERATORS) {
      const label = DEFAULT_LABELS.operatorLabels[op];
      expect(typeof label, `operatorLabels.${op}`).toBe('string');
      expect(label.length, `operatorLabels.${op} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('matches DEFAULT_OPERATOR_LABELS but is an independent copy', () => {
    expect(DEFAULT_LABELS.operatorLabels).toEqual(DEFAULT_OPERATOR_LABELS);
    expect(DEFAULT_LABELS.operatorLabels).not.toBe(DEFAULT_OPERATOR_LABELS);
  });

  it('has no extra operator keys beyond the known set', () => {
    expect(Object.keys(DEFAULT_LABELS.operatorLabels).sort()).toEqual(
      [...ALL_OPERATORS].sort()
    );
  });
});
