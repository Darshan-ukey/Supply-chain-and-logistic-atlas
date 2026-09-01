import type { DeepPartial, MalkomTableTheme } from '../types.js';

/**
 * Default Malkom skin.
 *
 * Two rules hold throughout:
 *
 * 1. **Every colour, radius and shadow comes from a CSS custom property**
 *    (`--mte-*`, declared in internal/styles.ts). A host re-skins the whole
 *    grid by setting those variables — usually mapping them onto its own
 *    design tokens — without restating a single class string.
 * 2. **Every token starts with a stable `mte-*` hook class.** Those hooks
 *    are structural API: they survive theme overrides and let a host target
 *    any part of the grid from plain CSS, Tailwind or otherwise.
 *
 * Layout lives here; sizing that has to respond to the *container* (not the
 * viewport) lives in STRUCTURAL_CSS, because Tailwind's breakpoints measure
 * the window and a grid is usually in a panel.
 */
export const DEFAULT_THEME: MalkomTableTheme = {
  shell:
    'mte-shell flex flex-col h-full relative overflow-hidden bg-[var(--mte-surface)] text-[var(--mte-text)] rounded-[var(--mte-radius)] border border-[var(--mte-border)] shadow-[var(--mte-shadow)]',
  topBar: {
    container:
      'mte-topbar shrink-0 border-b border-[var(--mte-border)] bg-[var(--mte-surface-muted)]',
    inner: 'mte-topbar-inner flex items-center justify-between gap-3 px-4 py-3 min-w-0',
    titleBlock: 'mte-topbar-title-block flex items-center gap-3 min-w-0',
    iconBadge:
      'mte-title-icon h-9 w-9 shrink-0 rounded-[var(--mte-radius-sm)] bg-[var(--mte-accent-soft)] border border-[var(--mte-accent-border)] flex items-center justify-center',
    iconBadgeIcon: 'material-symbols-rounded text-[var(--mte-accent)] text-[20px]',
    titleWrap: 'mte-title-wrap min-w-0',
    titleRow: 'flex items-center gap-2 min-w-0',
    title: 'mte-title font-extrabold tracking-tight truncate text-[var(--mte-text)]',
    liveBadge:
      'mte-live-badge inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--mte-border)] bg-[var(--mte-success-soft)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--mte-success)]',
    liveDot: 'h-1.5 w-1.5 rounded-full bg-[var(--mte-success)]',
    syncMeta: 'mte-topbar-meta text-[11px] font-semibold truncate text-[var(--mte-text-muted)]',
    syncDivider: 'mx-2 text-[var(--mte-border-strong)]',
    syncLabel: 'text-[var(--mte-text-subtle)]',
    syncValue: 'font-bold text-[var(--mte-text-muted)]',
    chips: 'mte-chips hidden md:flex items-center gap-2 ml-2 min-w-0',
    groupChip:
      'mte-chip mte-chip-group inline-flex items-center gap-2 rounded-full border border-[var(--mte-border)] bg-[var(--mte-info-soft)] px-3 py-1 text-[11px] font-extrabold text-[var(--mte-info)]',
    groupChipLabel: '',
    groupChipName: 'font-black',
    groupChipClear:
      'ml-1 inline-flex items-center hover:text-[var(--mte-danger)] cursor-pointer',
    prefilterChips: 'mte-chip-list flex flex-wrap gap-1.5 items-center',
    prefilterChip:
      'mte-chip mte-chip-prefilter inline-flex items-center gap-1 rounded-full border border-[var(--mte-accent-border)] bg-[var(--mte-accent-soft)] px-3 py-1 text-[11px] font-extrabold text-[var(--mte-accent)]',
    prefilterChipRemove:
      'ml-0.5 inline-flex items-center hover:text-[var(--mte-danger)] transition cursor-pointer',
    controls: 'mte-topbar-controls flex items-center gap-1.5',
    searchWrap: 'mte-search-wrap relative',
    searchIcon:
      'material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--mte-text-subtle)] pointer-events-none',
    searchInput:
      'mte-search w-full pl-9 pr-3 py-2 text-sm outline-none transition bg-[var(--mte-surface)] text-[var(--mte-text)] border border-[var(--mte-border-strong)] rounded-[var(--mte-radius-sm)] focus:border-[var(--mte-accent)]',
    iconButton:
      'mte-btn mte-btn-icon h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface)] text-[var(--mte-text-muted)] hover:text-[var(--mte-accent)] hover:bg-[var(--mte-accent-soft)] transition cursor-pointer',
    exportButton:
      'mte-btn mte-btn-export h-9 shrink-0 inline-flex items-center gap-2 px-3 rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-success-soft)] text-[var(--mte-success)] hover:brightness-95 transition font-bold text-[11px] tracking-[0.02em] cursor-pointer',
    settingsButton:
      'mte-btn mte-btn-settings h-9 shrink-0 inline-flex items-center gap-2 px-3 rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface)] text-[var(--mte-text)] hover:text-[var(--mte-accent)] hover:bg-[var(--mte-accent-soft)] transition font-bold text-[11px] tracking-[0.02em] cursor-pointer',
    buttonLabel: 'mte-btn-label',
    mobileSearchRow: 'hidden'
  },
  grid: {
    container: 'mte-grid flex-1 min-h-0 min-w-0 relative overflow-hidden bg-[var(--mte-surface)]',
    host: 'mte-grid-host h-full w-full'
  },
  skeleton: {
    overlay: 'mte-skeleton absolute inset-0 z-10 overflow-hidden bg-[var(--mte-surface)]',
    row: 'flex items-center space-x-4 border-b border-[var(--mte-row-border)] p-4 animate-pulse',
    cell: 'h-4 rounded bg-[var(--mte-surface-sunken)]'
  },
  footer: {
    container:
      'mte-footer-controls flex items-center gap-3 text-xs font-bold mr-auto pl-2 text-[var(--mte-text-muted)]',
    pageSizeLabel: 'uppercase tracking-wider',
    pageSizeSelect:
      'mte-pagesize border rounded px-2 py-1 outline-none cursor-pointer transition bg-[var(--mte-surface-muted)] border-[var(--mte-border-strong)] text-[var(--mte-text)]',
    divider: 'w-[1px] h-4 mx-2 bg-[var(--mte-border-strong)]',
    counts: 'mte-counts flex flex-wrap items-center gap-x-3 gap-y-1',
    countGroup: 'inline-flex items-center gap-1 whitespace-nowrap text-[var(--mte-text-muted)]',
    countLabel: '',
    countValue: 'font-black text-[var(--mte-text)]',
    filteredGroup: 'inline-flex items-center gap-1 whitespace-nowrap text-[var(--mte-accent)]',
    filteredLabel: '',
    filteredValue: 'font-black'
  },
  drawer: {
    overlay: 'mte-drawer absolute inset-0 z-50 flex justify-end',
    backdrop: 'mte-scrim absolute inset-0 bg-[var(--mte-scrim)] backdrop-blur-sm',
    panel:
      'mte-drawer-panel relative w-[400px] max-w-full h-full flex flex-col transition-transform duration-200 ease-out bg-[var(--mte-surface)] border-l border-[var(--mte-border)] shadow-2xl',
    panelOpen: 'translate-x-0',
    panelClosed: 'translate-x-full',
    header:
      'px-4 py-3 border-b border-[var(--mte-border)] flex justify-between items-center bg-[var(--mte-surface-muted)]',
    headerTitleWrap: 'flex items-center gap-2',
    headerIcon: 'material-symbols-rounded text-[20px] text-[var(--mte-text)]',
    headerTitle: 'font-extrabold text-lg text-[var(--mte-text)]',
    closeButton:
      'mte-btn h-8 w-8 inline-flex items-center justify-center rounded-[var(--mte-radius-sm)] text-[var(--mte-text-subtle)] hover:text-[var(--mte-danger)] hover:bg-[var(--mte-surface)] transition cursor-pointer',
    body: 'flex-1 overflow-y-auto p-4 space-y-4',
    quickActions: 'grid grid-cols-2 gap-2',
    clearFiltersButton:
      'mte-btn h-10 inline-flex items-center justify-center gap-1.5 rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface-muted)] px-3 text-xs font-bold text-[var(--mte-text)] transition hover:bg-[var(--mte-surface-sunken)] cursor-pointer',
    clearSortButton:
      'mte-btn h-10 inline-flex items-center justify-center gap-1.5 rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface-muted)] px-3 text-xs font-bold text-[var(--mte-text)] transition hover:bg-[var(--mte-surface-sunken)] cursor-pointer',
    sectionTitle:
      'text-xs font-black uppercase tracking-widest mb-2 text-[var(--mte-text-subtle)]',
    groupSelect:
      'mte-select w-full h-10 px-3 rounded-[var(--mte-radius-sm)] text-sm outline-none cursor-pointer bg-[var(--mte-surface)] border border-[var(--mte-border-strong)] text-[var(--mte-text)] focus:border-[var(--mte-accent)]',
    prefilterSection:
      'rounded-[var(--mte-radius)] border border-[var(--mte-border)] bg-[var(--mte-surface-muted)] overflow-hidden',
    prefilterHeader:
      'w-full flex justify-between items-center p-3 hover:bg-[var(--mte-surface-sunken)] transition cursor-pointer',
    prefilterHeaderTitle:
      'font-extrabold text-sm flex items-center gap-2 text-[var(--mte-text)]',
    prefilterHeaderIcon: 'material-symbols-rounded text-[var(--mte-accent)]',
    prefilterChevron:
      'material-symbols-rounded transition-transform text-[var(--mte-text-subtle)]',
    prefilterBody: 'px-3 pb-3 border-t border-[var(--mte-border)]',
    prefilterList: 'space-y-2 mt-3 mb-3',
    prefilterEmpty: 'text-center text-xs py-2 text-[var(--mte-text-subtle)]',
    prefilterItem:
      'mte-prefilter flex items-center justify-between p-3 rounded-[var(--mte-radius-sm)] border transition group bg-[var(--mte-surface)] border-[var(--mte-border)]',
    prefilterItemActive:
      'mte-prefilter mte-prefilter-active flex items-center justify-between p-3 rounded-[var(--mte-radius-sm)] border transition group bg-[var(--mte-accent-soft)] border-[var(--mte-accent-border)]',
    prefilterDot:
      'w-3 h-3 rounded-full transition bg-[var(--mte-border-strong)] group-hover:bg-[var(--mte-accent)]',
    prefilterDotActive: 'w-3 h-3 rounded-full transition bg-[var(--mte-accent)]',
    prefilterName:
      'font-bold text-sm transition text-[var(--mte-text)] group-hover:text-[var(--mte-accent)]',
    prefilterNameActive: 'font-bold text-sm transition text-[var(--mte-accent)]',
    prefilterActions: 'flex gap-1',
    prefilterActionButton:
      'mte-btn p-1 transition cursor-pointer text-[var(--mte-text-subtle)] hover:text-[var(--mte-accent)]',
    createFilterButton:
      'mte-btn w-full h-10 border-2 border-dashed rounded-[var(--mte-radius-sm)] text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer border-[var(--mte-border-strong)] text-[var(--mte-text-muted)] hover:border-[var(--mte-accent)] hover:text-[var(--mte-accent)]',
    columnGrid: 'grid grid-cols-2 gap-2',
    columnButtonVisible:
      'mte-col-toggle flex items-center justify-between px-2 py-1 rounded-[var(--mte-radius-sm)] border text-xs font-medium transition-all duration-200 cursor-pointer bg-[var(--mte-surface)] border-[var(--mte-accent-border)] text-[var(--mte-accent)]',
    columnButtonHidden:
      'mte-col-toggle flex items-center justify-between px-2 py-1 rounded-[var(--mte-radius-sm)] border text-xs font-medium transition-all duration-200 cursor-pointer bg-[var(--mte-surface-muted)] border-transparent text-[var(--mte-text-subtle)] hover:bg-[var(--mte-surface-sunken)]',
    columnButtonLocked: 'opacity-60 cursor-not-allowed',
    footer:
      'p-3 border-t flex justify-center bg-[var(--mte-surface-muted)] border-[var(--mte-border)]',
    masterResetButton:
      'mte-btn flex items-center gap-2 font-extrabold text-sm transition cursor-pointer text-[var(--mte-danger)] hover:brightness-90'
  },
  modal: {
    backdrop:
      'mte-modal mte-scrim fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--mte-scrim)] backdrop-blur-sm transition-opacity duration-200 opacity-0',
    backdropVisible: 'opacity-100',
    content:
      'mte-modal-content w-[min(980px,calc(100vw-2rem))] h-[min(680px,calc(100vh-2rem))] px-5 py-4 transform transition-all duration-200 scale-95 flex flex-col gap-4 bg-[var(--mte-surface)] text-[var(--mte-text)] rounded-[var(--mte-radius)] border border-[var(--mte-border)] shadow-2xl',
    contentVisible: 'scale-100',
    header:
      'flex shrink-0 justify-between items-center border-b border-[var(--mte-border)] pb-2',
    title: 'text-lg font-bold flex items-center gap-2 text-[var(--mte-text)]',
    titleIcon: 'material-symbols-rounded text-[var(--mte-accent)]',
    closeButton:
      'mte-btn p-2 rounded-full transition cursor-pointer text-[var(--mte-text-subtle)] hover:bg-[var(--mte-surface-muted)] hover:text-[var(--mte-danger)]',
    body: 'flex min-h-0 flex-1 flex-col gap-4',
    nameLabel: 'block text-sm font-semibold mb-1 text-[var(--mte-text-muted)]',
    nameInput:
      'mte-input w-full px-4 py-2.5 rounded-[var(--mte-radius-sm)] outline-none transition font-medium bg-[var(--mte-surface-muted)] border border-[var(--mte-border)] text-[var(--mte-text)] focus:border-[var(--mte-accent)]',
    logicSection:
      'flex min-h-0 flex-1 flex-col p-4 rounded-[var(--mte-radius-sm)] bg-[var(--mte-surface-muted)] border border-[var(--mte-border)]',
    logicHeader: 'mb-3 flex shrink-0 flex-wrap items-center gap-2',
    logicTitle: 'text-xs font-bold uppercase tracking-wider text-[var(--mte-text-muted)]',
    logicHint:
      'text-[11px] font-semibold normal-case tracking-normal text-[var(--mte-text-muted)]',
    builderScroll: 'min-h-0 flex-1 overflow-y-auto pr-1',
    footer:
      'flex shrink-0 items-center justify-between gap-3 border-t border-[var(--mte-border)] pt-3',
    footerLeft: 'relative',
    previewButton:
      'mte-btn inline-flex h-10 items-center gap-2 rounded-[var(--mte-radius-sm)] px-3 text-xs font-black transition cursor-pointer border border-[var(--mte-border)] bg-[var(--mte-surface)] text-[var(--mte-text-muted)] hover:border-[var(--mte-accent-border)] hover:bg-[var(--mte-accent-soft)] hover:text-[var(--mte-accent)]',
    footerRight: 'flex items-center justify-end gap-3',
    cancelButton:
      'mte-btn px-5 py-2.5 text-sm font-bold rounded-[var(--mte-radius-sm)] transition cursor-pointer text-[var(--mte-text-muted)] hover:bg-[var(--mte-surface-muted)]',
    saveButton:
      'mte-btn mte-btn-primary px-6 py-2.5 text-sm font-bold rounded-[var(--mte-radius-sm)] transition cursor-pointer bg-[var(--mte-accent)] text-[var(--mte-accent-contrast)] hover:brightness-110',
    previewPopover:
      'mte-popover absolute bottom-12 left-0 z-[100000] w-[min(520px,calc(100vw-3rem))] overflow-hidden rounded-[var(--mte-radius)] border border-[var(--mte-border)] bg-[var(--mte-surface)] shadow-2xl',
    previewHeader:
      'flex items-start justify-between gap-3 border-b border-[var(--mte-border)] bg-[var(--mte-surface-muted)] px-4 py-3',
    previewHeaderIcon:
      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--mte-radius-sm)] bg-[var(--mte-accent-soft)] text-[var(--mte-accent)]',
    previewHeaderTitle: 'text-sm font-black text-[var(--mte-text)]',
    previewHeaderSubtitle: 'text-xs font-semibold leading-5 text-[var(--mte-text-muted)]',
    previewClose:
      'mte-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition cursor-pointer text-[var(--mte-text-subtle)] hover:bg-[var(--mte-surface)] hover:text-[var(--mte-danger)]',
    previewBody: 'max-h-72 overflow-y-auto px-4 py-3'
  },
  builder: {
    group:
      'mte-builder-group rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface)] p-3',
    groupHeader: 'flex items-center justify-between gap-2 mb-2',
    logicToggleWrap:
      'inline-flex rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface-muted)] p-0.5 gap-0.5',
    logicButtonActive:
      'mte-btn px-3 py-1 rounded text-xs font-black cursor-pointer bg-[var(--mte-accent)] text-[var(--mte-accent-contrast)]',
    logicButtonInactive:
      'mte-btn px-3 py-1 rounded text-xs font-black cursor-pointer text-[var(--mte-text-muted)] hover:bg-[var(--mte-surface)]',
    headerActions: 'flex items-center gap-1',
    addRuleButton:
      'mte-btn inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition cursor-pointer text-[var(--mte-accent)] hover:bg-[var(--mte-accent-soft)]',
    addGroupButton:
      'mte-btn inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition cursor-pointer text-[var(--mte-info)] hover:bg-[var(--mte-info-soft)]',
    removeGroupButton:
      'mte-btn p-1 rounded transition cursor-pointer text-[var(--mte-text-subtle)] hover:text-[var(--mte-danger)]',
    children: 'space-y-2 border-l-2 border-[var(--mte-border)] pl-3',
    ruleRow: 'grid grid-cols-12 gap-2 items-center',
    fieldSelect:
      'mte-select col-span-4 w-full px-3 py-2 rounded-[var(--mte-radius-sm)] text-sm outline-none cursor-pointer bg-[var(--mte-surface)] border border-[var(--mte-border)] text-[var(--mte-text)] focus:border-[var(--mte-accent)]',
    operatorSelect:
      'mte-select col-span-3 w-full px-3 py-2 rounded-[var(--mte-radius-sm)] text-sm outline-none cursor-pointer bg-[var(--mte-surface)] border border-[var(--mte-border)] text-[var(--mte-text)] focus:border-[var(--mte-accent)]',
    valueInput:
      'mte-input col-span-4 w-full px-3 py-2 rounded-[var(--mte-radius-sm)] text-sm outline-none bg-[var(--mte-surface)] border border-[var(--mte-border)] text-[var(--mte-text)] focus:border-[var(--mte-accent)]',
    ruleActions: 'col-span-1 flex items-center justify-center gap-0.5',
    ruleActionButton:
      'mte-btn p-0.5 transition cursor-pointer text-[var(--mte-text-subtle)] hover:text-[var(--mte-danger)]',
    emptyGroup:
      'rounded border border-dashed px-3 py-3 text-xs font-semibold text-center border-[var(--mte-border-strong)] bg-[var(--mte-surface-muted)] text-[var(--mte-text-subtle)]'
  },
  preview: {
    card:
      'rounded-[var(--mte-radius)] border border-[var(--mte-border)] bg-[var(--mte-surface)] p-4',
    cardHeader: 'mb-3 flex items-start gap-3',
    cardHeaderIcon:
      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--mte-radius-sm)] bg-[var(--mte-success-soft)] text-[var(--mte-success)]',
    cardHeaderTitle: 'text-sm font-black text-[var(--mte-text)]',
    cardHeaderHint: 'mt-0.5 text-xs font-semibold leading-5 text-[var(--mte-text-muted)]',
    ruleList: 'space-y-3',
    ruleRow:
      'flex items-start gap-3 rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface-muted)] px-3 py-3',
    ruleIndex:
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black bg-[var(--mte-surface)] text-[var(--mte-accent)]',
    ruleText: 'min-w-0 text-sm font-semibold leading-6 text-[var(--mte-text-muted)]',
    ruleField: 'font-black text-[var(--mte-text)]',
    ruleOperator: 'font-bold text-[var(--mte-text-muted)]',
    ruleValue:
      'rounded px-1.5 py-0.5 font-black bg-[var(--mte-surface)] text-[var(--mte-text)]',
    andConnector: 'flex items-center gap-3 px-3',
    andConnectorLine: 'h-px flex-1 bg-[var(--mte-border)]',
    andConnectorLabel:
      'rounded-full border px-3 py-1 text-xs font-black tracking-wide border-[var(--mte-border)] bg-[var(--mte-success-soft)] text-[var(--mte-success)]',
    orGroup:
      'rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-info-soft)] px-3 py-3',
    orGroupHeader: 'mb-2 flex items-start gap-3',
    orGroupBadge:
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black bg-[var(--mte-surface)] text-[var(--mte-accent)]',
    orGroupTitle: 'text-sm font-black text-[var(--mte-text)]',
    orGroupHint: 'text-xs font-semibold leading-5 text-[var(--mte-text-muted)]',
    orGroupChildren: 'space-y-2 pl-10',
    orAlternative:
      'flex items-start gap-2 rounded border border-[var(--mte-border)] bg-[var(--mte-surface)] px-3 py-2',
    orAlternativeBadge:
      'mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-black bg-[var(--mte-info-soft)] text-[var(--mte-info)]',
    errorCard: 'rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface-muted)] px-3 py-3',
    errorHeader: 'mb-2 flex items-center gap-2 text-sm font-black text-[var(--mte-danger)]',
    errorList: 'space-y-1 text-sm font-semibold leading-6 list-none text-[var(--mte-text)]',
    emptyCard:
      'rounded-[var(--mte-radius-sm)] border border-dashed px-3 py-4 text-sm font-semibold border-[var(--mte-border-strong)] bg-[var(--mte-surface-muted)] text-[var(--mte-text-muted)]'
  },
  headerFilterMenu: {
    button: 'mte-hf-btn rounded transition cursor-pointer text-[var(--mte-text-subtle)]',
    buttonActive: 'mte-hf-btn rounded transition cursor-pointer text-[var(--mte-accent)]',
    menu:
      'mte-hf-menu fixed z-[9999] w-64 flex flex-col text-sm rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface)] text-[var(--mte-text)] shadow-2xl',
    searchBox: 'p-2 border-b border-[var(--mte-border)]',
    searchInput:
      'mte-input w-full px-2 py-1.5 rounded text-xs outline-none bg-[var(--mte-surface)] border border-[var(--mte-border)] text-[var(--mte-text)] focus:border-[var(--mte-accent)]',
    actionsRow:
      'flex justify-between px-3 py-2 text-[10px] font-bold uppercase bg-[var(--mte-surface-muted)] text-[var(--mte-accent)]',
    actionLink: 'cursor-pointer hover:underline',
    list: 'max-h-48 overflow-y-auto p-2 space-y-1',
    listItem:
      'flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded select-none hover:bg-[var(--mte-surface-muted)]',
    checkbox: 'rounded-sm w-3.5 h-3.5 accent-[var(--mte-accent)]',
    itemLabel: 'truncate text-xs',
    itemCount:
      'text-[10px] font-mono px-1.5 rounded ml-auto bg-[var(--mte-surface-sunken)] text-[var(--mte-text-muted)]',
    footer:
      'p-2 border-t flex justify-end gap-2 rounded-b-[var(--mte-radius-sm)] border-[var(--mte-border)] bg-[var(--mte-surface-muted)]',
    cancelButton:
      'mte-btn px-3 py-1 rounded text-xs cursor-pointer bg-[var(--mte-surface)] border border-[var(--mte-border)] text-[var(--mte-text)] hover:bg-[var(--mte-surface-sunken)]',
    applyButton:
      'mte-btn mte-btn-primary px-3 py-1 rounded text-xs font-bold cursor-pointer bg-[var(--mte-accent)] text-[var(--mte-accent-contrast)] hover:brightness-110',
    empty: 'text-xs p-2 italic text-[var(--mte-text-subtle)]'
  },
  savedPreviewPopover: {
    container:
      'mte-popover fixed z-[100000] w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-[var(--mte-radius)] border border-[var(--mte-border)] bg-[var(--mte-surface)] shadow-2xl',
    header:
      'flex items-start justify-between gap-3 border-b border-[var(--mte-border)] bg-[var(--mte-surface-muted)] px-4 py-3',
    headerIcon:
      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--mte-radius-sm)] bg-[var(--mte-accent-soft)] text-[var(--mte-accent)]',
    headerTitle: 'text-sm font-black text-[var(--mte-text)]',
    headerSubtitle: 'mt-0.5 text-xs font-semibold leading-5 text-[var(--mte-text-muted)]',
    closeButton:
      'mte-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition cursor-pointer text-[var(--mte-text-subtle)] hover:bg-[var(--mte-surface)] hover:text-[var(--mte-danger)]',
    body: 'max-h-72 overflow-y-auto px-4 py-3'
  },
  groupHeader: {
    value: 'font-bold text-[var(--mte-accent)]',
    count: 'text-xs ml-2 text-[var(--mte-text-muted)]'
  }
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merge theme overrides onto the default theme. */
export function mergeTheme(
  base: MalkomTableTheme,
  override?: DeepPartial<MalkomTableTheme>
): MalkomTableTheme {
  if (!override) return base;
  const merge = (
    a: Record<string, unknown>,
    b: Record<string, unknown>
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...a };
    for (const [key, value] of Object.entries(b)) {
      if (value === undefined) continue;
      const current = out[key];
      if (isPlainObject(current) && isPlainObject(value)) {
        out[key] = merge(current, value);
      } else {
        out[key] = value;
      }
    }
    return out;
  };
  return merge(
    base as unknown as Record<string, unknown>,
    override as Record<string, unknown>
  ) as unknown as MalkomTableTheme;
}
