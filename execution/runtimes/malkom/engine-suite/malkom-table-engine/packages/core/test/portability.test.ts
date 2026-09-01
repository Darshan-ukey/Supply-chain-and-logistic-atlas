/**
 * Environment-portability behaviours: the engine has to work in a real
 * browser, in jsdom (any Node version), in a second document, and on a
 * server. These cover the paths that differ between those environments.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCsvExporter,
  downloadTextFile,
  MalkomTableEngine
} from '@malkom/table-core';
import type { ExportContext } from '@malkom/table-core';
import { resolveConfig } from '../src/internal/config';
import { containsTarget } from '../src/internal/dom';
import { FakeTabulator, makeConfig, makeEngine, sampleRows } from './helpers/fakeTabulator';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('file download without object URLs (jsdom, older browsers)', () => {
  it('falls back to a data: URL instead of throwing', () => {
    // jsdom implements neither Blob nor URL.createObjectURL.
    expect(typeof URL.createObjectURL).not.toBe('function');

    const clicked: HTMLAnchorElement[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicked.push(this);
    };
    try {
      expect(() =>
        downloadTextFile('a,b\r\n1,2', 'rows.csv', 'text/csv;charset=utf-8')
      ).not.toThrow();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }

    expect(clicked).toHaveLength(1);
    const anchor = clicked[0]!;
    expect(anchor.download).toBe('rows.csv');
    expect(anchor.href.startsWith('data:text/csv;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(anchor.href.split(',').slice(1).join(','))).toContain('1,2');
    // The anchor must not be left behind in the document.
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('the default CSV exporter completes its real delivery path', async () => {
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      /* swallow the navigation */
    };
    try {
      const exporter = createCsvExporter();
      const ctx: ExportContext = {
        rows: [{ name: 'Alpha' }],
        columns: [{ field: 'name', header: 'Name' }],
        valueOf: (row, field) => (row as Record<string, unknown>)[field],
        fileName: 'export',
        meta: {
          title: 'T',
          exportedAt: new Date(0),
          totalRows: 1,
          filteredRows: 1
        },
        notify: () => undefined
      };
      await expect(Promise.resolve(exporter.run(ctx))).resolves.toBeUndefined();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});

describe('confirmation prompts across environments', () => {
  it('proceeds when the environment confirm returns a non-boolean (jsdom)', async () => {
    // jsdom's confirm is a function that logs "Not implemented" and returns
    // undefined; treating that as "cancel" would silently break deletions.
    vi.spyOn(window, 'confirm').mockImplementation(
      () => undefined as unknown as boolean
    );
    const resolved = resolveConfig(makeConfig());
    await expect(resolved.confirmAction('Delete this filter?')).resolves.toBe(true);
  });

  it('proceeds when the environment has no confirm at all (server)', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'confirm');
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: undefined
    });
    try {
      const resolved = resolveConfig(makeConfig());
      await expect(resolved.confirmAction('Delete this filter?')).resolves.toBe(true);
    } finally {
      if (original) Object.defineProperty(window, 'confirm', original);
    }
  });

  it('still honours a real answer and the host override', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await expect(resolveConfig(makeConfig()).confirmAction('x')).resolves.toBe(false);

    const resolvedWithHost = resolveConfig(
      makeConfig({ confirmAction: () => true })
    );
    await expect(resolvedWithHost.confirmAction('x')).resolves.toBe(true);
  });

  it('deletes a prefilter under a jsdom-style confirm', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(
      () => undefined as unknown as boolean
    );
    const { engine, fake } = makeEngine();
    fake.trigger('tableBuilt');
    engine.savePrefilter({
      id: 'pf-1',
      name: 'Open',
      root: { kind: 'group', logic: 'and', children: [] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    expect(engine.getPrefilters()).toHaveLength(1);

    await engine.deletePrefilter('pf-1');
    expect(engine.getPrefilters()).toHaveLength(0);
    engine.destroy();
  });
});

describe('containment checks work across realms', () => {
  it('matches nodes from another document, where instanceof would fail', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const otherDoc = frame.contentDocument!;
    const root = otherDoc.createElement('div');
    const child = otherDoc.createElement('span');
    root.appendChild(child);
    otherDoc.body.appendChild(root);

    // The premise: cross-realm instanceof is false, so the old guard bailed.
    expect(child instanceof Node).toBe(false);

    expect(containsTarget(root, child)).toBe(true);
    expect(containsTarget(root, otherDoc.body)).toBe(false);
    expect(containsTarget(root, null)).toBe(false);
  });
});

describe('remounting into an occupied container', () => {
  it('tears down the previous engine instead of orphaning it', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const first = new MalkomTableEngine(container, makeConfig());
    const firstFake = first.getTabulator() as unknown as FakeTabulator;
    firstFake.trigger('tableBuilt');
    first.setData(sampleRows());

    let destroyed = false;
    first.on('destroyed', () => {
      destroyed = true;
    });

    const second = new MalkomTableEngine(container, makeConfig());

    expect(destroyed).toBe(true);
    expect(firstFake.destroyed).toBe(true);
    // Exactly one shell in the container — the second engine's.
    expect(container.querySelectorAll('.mte-shell')).toHaveLength(1);

    second.destroy();
  });

  it('does not tear down an engine in a different container', () => {
    const a = makeEngine();
    const b = makeEngine();
    expect(a.fake.destroyed).toBe(false);
    expect(b.fake.destroyed).toBe(false);
    a.engine.destroy();
    expect(b.fake.destroyed).toBe(false);
    b.engine.destroy();
  });
});
