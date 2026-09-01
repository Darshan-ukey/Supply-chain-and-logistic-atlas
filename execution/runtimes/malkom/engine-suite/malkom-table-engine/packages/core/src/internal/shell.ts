/**
 * The engine-owned shell: title bar (icon, title, LIVE badge, sync meta,
 * state chips), controls (search, density, refresh, export, settings) and
 * the grid host + skeleton overlay.
 */

import type { MalkomTableIcons, MalkomTableLabels, MalkomTableTheme } from '../types.js';
import type { ResolvedFeatures } from './config.js';
import { debounce, el, icon, type Debounced } from './dom.js';

export interface ShellCallbacks {
  onSearch: (term: string) => void;
  onRefresh: () => void;
  onExport: (anchor: HTMLElement) => void;
  onSettings: () => void;
  onDensityToggle: () => void;
  onClearGrouping: () => void;
}

export interface ShellRefs {
  root: HTMLElement;
  gridHost: HTMLElement;
  skeletonOverlay: HTMLElement;
  searchInputs: HTMLInputElement[];
  titleEl: HTMLElement;
  liveBadgeEl: HTMLElement | null;
  syncMetaEl: HTMLElement | null;
  syncCountEl: HTMLElement | null;
  syncTimeEl: HTMLElement | null;
  groupChipWrap: HTMLElement;
  groupChipName: HTMLElement;
  prefilterChipsWrap: HTMLElement;
  refreshBtn: HTMLButtonElement | null;
  exportBtn: HTMLButtonElement | null;
  settingsBtn: HTMLButtonElement | null;
  densityBtn: HTMLButtonElement | null;
  densityIconEl: HTMLElement | null;
  searchDebouncers: Debounced<[string]>[];
  dispose: () => void;
}

export function buildShell(options: {
  doc: Document;
  container: HTMLElement;
  theme: MalkomTableTheme;
  labels: MalkomTableLabels;
  icons: MalkomTableIcons;
  features: ResolvedFeatures;
  title: string;
  cssVars?: Record<string, string> | undefined;
  callbacks: ShellCallbacks;
}): ShellRefs {
  const { doc, container, theme, labels, icons: ic, features, title, callbacks } =
    options;

  container.innerHTML = '';
  // The engine owns an INNER shell element rather than the container itself:
  // in React the host owns the container's className (React re-writes it on
  // prop changes), so the shell skin must live one level down where nothing
  // external can wipe it.
  const shellRoot = el(doc, 'div', { className: theme.shell });
  shellRoot.style.height = '100%';
  // Host design tokens: set before anything renders so the first paint is
  // already in the host's palette.
  for (const [name, value] of Object.entries(options.cssVars ?? {})) {
    if (name.startsWith('--')) shellRoot.style.setProperty(name, value);
  }
  container.appendChild(shellRoot);

  const disposers: (() => void)[] = [];
  const searchInputs: HTMLInputElement[] = [];
  const searchDebouncers: Debounced<[string]>[] = [];

  // ------------------------------------------------------------- Top bar
  const topBar = el(doc, 'div', { className: theme.topBar.container });
  const inner = el(doc, 'div', { className: theme.topBar.inner });

  const titleBlock = el(doc, 'div', { className: theme.topBar.titleBlock });
  const iconBadge = el(doc, 'div', { className: theme.topBar.iconBadge });
  iconBadge.appendChild(icon(doc, ic.table, theme.topBar.iconBadgeIcon));

  const titleWrap = el(doc, 'div', { className: theme.topBar.titleWrap });
  const titleRow = el(doc, 'div', { className: theme.topBar.titleRow });
  const titleEl = el(doc, 'div', { className: theme.topBar.title, text: title });
  titleRow.appendChild(titleEl);

  let liveBadgeEl: HTMLElement | null = null;
  if (features.liveBadge) {
    liveBadgeEl = el(doc, 'span', { className: theme.topBar.liveBadge });
    liveBadgeEl.append(
      el(doc, 'span', { className: theme.topBar.liveDot }),
      doc.createTextNode(labels.live)
    );
    titleRow.appendChild(liveBadgeEl);
  }
  titleWrap.appendChild(titleRow);

  let syncMetaEl: HTMLElement | null = null;
  let syncCountEl: HTMLElement | null = null;
  let syncTimeEl: HTMLElement | null = null;
  if (features.syncMeta) {
    syncMetaEl = el(doc, 'div', { className: theme.topBar.syncMeta });
    syncCountEl = el(doc, 'span', { text: `0 ${labels.records}` });
    const divider = el(doc, 'span', { className: theme.topBar.syncDivider, text: '•' });
    const syncLabel = el(doc, 'span', {
      className: theme.topBar.syncLabel,
      text: ` ${labels.lastSync} `
    });
    syncTimeEl = el(doc, 'span', { className: theme.topBar.syncValue, text: '—' });
    syncMetaEl.append(syncCountEl, divider, syncLabel, syncTimeEl);
    titleWrap.appendChild(syncMetaEl);
  }

  titleBlock.append(iconBadge, titleWrap);

  // State chips (grouping + active prefilters)
  const chips = el(doc, 'div', { className: theme.topBar.chips });
  const groupChipWrap = el(doc, 'div');
  groupChipWrap.style.display = 'none';
  const groupChip = el(doc, 'div', { className: theme.topBar.groupChip });
  groupChip.appendChild(icon(doc, ic.group, 'material-symbols-rounded text-[16px]'));
  groupChip.appendChild(
    el(doc, 'span', { className: theme.topBar.groupChipLabel, text: labels.groupedBy })
  );
  const groupChipName = el(doc, 'span', { className: theme.topBar.groupChipName });
  groupChip.appendChild(groupChipName);
  const groupChipClear = el(doc, 'button', {
    className: theme.topBar.groupChipClear,
    title: labels.clearGroupingTitle,
    type: 'button'
  });
  groupChipClear.appendChild(icon(doc, ic.close, 'material-symbols-rounded text-[16px]'));
  groupChipClear.addEventListener('click', () => callbacks.onClearGrouping());
  groupChip.appendChild(groupChipClear);
  groupChipWrap.appendChild(groupChip);

  const prefilterChipsWrap = el(doc, 'div', {
    className: theme.topBar.prefilterChips
  });
  prefilterChipsWrap.style.display = 'none';

  chips.append(groupChipWrap, prefilterChipsWrap);
  titleBlock.appendChild(chips);

  // Controls
  const controls = el(doc, 'div', { className: theme.topBar.controls });

  const makeSearchInput = (wrapClass: string): HTMLElement => {
    const wrap = el(doc, 'div', { className: wrapClass });
    wrap.appendChild(icon(doc, ic.search, theme.topBar.searchIcon));
    const input = el(doc, 'input', {
      className: theme.topBar.searchInput,
      type: 'text',
      placeholder: labels.searchPlaceholder
    });
    const debounced = debounce(
      (term: string) => callbacks.onSearch(term),
      features.searchDebounceMs
    );
    searchDebouncers.push(debounced);
    input.addEventListener('input', () => debounced(input.value));
    searchInputs.push(input);
    wrap.appendChild(input);
    return wrap;
  };

  if (features.globalSearch) {
    controls.appendChild(makeSearchInput(theme.topBar.searchWrap));
  }

  let densityBtn: HTMLButtonElement | null = null;
  let densityIconEl: HTMLElement | null = null;
  if (features.density) {
    densityBtn = el(doc, 'button', {
      className: theme.topBar.iconButton,
      title: labels.densityTitle,
      type: 'button'
    });
    densityIconEl = icon(doc, ic.densityCompact, 'material-symbols-rounded text-[20px]');
    densityBtn.appendChild(densityIconEl);
    densityBtn.addEventListener('click', () => callbacks.onDensityToggle());
    controls.appendChild(densityBtn);
  }

  let refreshBtn: HTMLButtonElement | null = null;
  if (features.refresh) {
    refreshBtn = el(doc, 'button', {
      className: theme.topBar.iconButton,
      title: labels.refreshTitle,
      type: 'button'
    });
    refreshBtn.appendChild(icon(doc, ic.refresh, 'material-symbols-rounded text-[20px]'));
    refreshBtn.addEventListener('click', () => callbacks.onRefresh());
    controls.appendChild(refreshBtn);
  }

  // Labels live in their own span so a narrow container can hide the text
  // and keep the icon, instead of pushing the button out of view.
  const labelSpan = (text: string): HTMLSpanElement =>
    el(doc, 'span', { className: theme.topBar.buttonLabel, text });

  let exportBtn: HTMLButtonElement | null = null;
  if (features.export) {
    exportBtn = el(doc, 'button', {
      className: theme.topBar.exportButton,
      title: labels.exportLabel,
      type: 'button'
    });
    exportBtn.appendChild(icon(doc, ic.export, 'material-symbols-rounded text-[17px]'));
    exportBtn.appendChild(labelSpan(labels.exportLabel));
    exportBtn.addEventListener('click', () => {
      if (exportBtn) callbacks.onExport(exportBtn);
    });
    controls.appendChild(exportBtn);
  }

  let settingsBtn: HTMLButtonElement | null = null;
  if (features.settings) {
    settingsBtn = el(doc, 'button', {
      className: theme.topBar.settingsButton,
      title: labels.settingsLabel,
      type: 'button'
    });
    settingsBtn.appendChild(icon(doc, ic.settings, 'material-symbols-rounded text-[17px]'));
    settingsBtn.appendChild(labelSpan(labels.settingsLabel));
    settingsBtn.addEventListener('click', () => callbacks.onSettings());
    controls.appendChild(settingsBtn);
  }

  inner.append(titleBlock, controls);
  topBar.appendChild(inner);

  // ------------------------------------------------------------- Grid area
  const gridContainer = el(doc, 'div', { className: theme.grid.container });
  const gridHost = el(doc, 'div', { className: theme.grid.host });
  const skeletonOverlay = el(doc, 'div', { className: theme.skeleton.overlay });
  gridContainer.append(gridHost, skeletonOverlay);

  shellRoot.append(topBar, gridContainer);

  return {
    root: shellRoot,
    gridHost,
    skeletonOverlay,
    searchInputs,
    titleEl,
    liveBadgeEl,
    syncMetaEl,
    syncCountEl,
    syncTimeEl,
    groupChipWrap,
    groupChipName,
    prefilterChipsWrap,
    refreshBtn,
    exportBtn,
    settingsBtn,
    densityBtn,
    densityIconEl,
    searchDebouncers,
    dispose: () => {
      for (const d of disposers) d();
      for (const d of searchDebouncers) d.cancel();
      shellRoot.remove();
    }
  };
}
