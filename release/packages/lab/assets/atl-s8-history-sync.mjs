// S8-6 — bounded DAU-007 / DAU-006 remediation: governed in-app history registration + restoration synchronization.
//
// Defect (reproduced on the corrected successor lineage): the certified root registers NO browser-history entry for the governed
// navigation Road LTL -> commercial A3 -> semantic A4 -> LTL-01, so Back leaves Atlas and a refresh loses the A4/process state.
// The existing state machinery is valid and is REUSED, not redesigned: stage11CaptureState() captures, stage11ApplyState() restores.
//
// This module is ADDITIVE. It is loaded by assets/atl-140-v15-journey.mjs; the certified root index.html, the runtime shell, the
// Canvas donor, the Canvas->Daughter bridge and Universal Ask 2.0.1 are not modified. The historical ATL-142 history controller
// is NOT a donor and is not reproduced: it wrapped navigation functions that were re-wrapped later and therefore never recorded
// the A4 (slider) state. This controller observes the rendered governed view state instead.
//
// Behaviour
//   * A browser-history entry is created whenever the governed view key changes: active module, selected A3, semantic level,
//     selected process (plus the Page-0 domain selection). A4 with no process is its own restorable state.
//   * Startup adopts the current entry with replaceState (no artificial duplicate); user navigation uses pushState.
//   * popstate restores through the EXISTING stage11ApplyState under a restoration guard that suppresses all history writes.
//   * Reload reconstructs the exact entry state from history.state (the entry wins over the root's last-session restore).
//   * history.state carries ONLY an allow-listed, public-safe navigation projection (ids, depth, level, public version pins).
//   * Everything read back is validated against the canonical loaded module (module, A3, process, depth, level, version pin);
//     anything malformed, unknown, unsupported, stale or protected-looking fails closed: it is NOT applied and no fallback is invented.
//   * No-op where the Atlas root navigation model is absent (e.g. the Malkom consumer page, Node).
//
// This is a bounded UI-navigation capability. It is not runtime readiness, release readiness or a canonical-semantics change.

export const HISTORY_SYNC_SCHEMA = 'atlas-s8-history-sync-v1';
export const HISTORY_STATE_KEY = 'atlasS8HistorySync';
export const VIEW_SCHEMA = 'atlas-view-state-v0.1';
export const DEPTHS = Object.freeze(['domain', 'a3', 'a4']);
export const PRIMARIES = Object.freeze(['execute', 'explore']);
// The ONLY view-state fields that may ever enter history.state (a strict subset of stage11CaptureState()).
export const VIEW_FIELDS = Object.freeze(['schema', 'atlasModule', 'coveragePreview', 'primary', 'depth', 'selectedDomain', 'selectedA3', 'selectedProcess', 'moduleVersion', 'dataContractVersion', 'governancePin16']);
const ENVELOPE_KEYS = Object.freeze(['schema', 'level', 'view']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PIN_KEY = /^[A-Za-z0-9_.-]{1,48}$/;
// Anything that looks like protected execution content / client values / secrets is rejected outright (never stripped-and-continued).
const PROTECTED_LOOKING = /(?:^|[^a-z0-9])(?:wd|malkom-dw)::|bpmn|<\/?[a-z!?]|\bpackage[_-]?hash\b|work-?definition|readiness[_-]?payload|client[_-]?value|api[_-]?key|secret|password|token|bearer|-----BEGIN/i;

export class HistoryStateRejection extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'HistoryStateRejection'; this.code = code; this.detail = detail ?? null; }
}
const reject = (code, detail) => ({ok: false, code, detail: detail ?? null});
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const idOrNull = (v) => v === null ? true : typeof v === 'string' && ID.test(v);

// ---------------------------------------------------------------- public-version pin (stable subset; excludes the capture clock)
export function stablePin(pin) {
  const walk = (v, depth, budget) => {
    if (budget.n-- <= 0 || depth > 4) throw new HistoryStateRejection('PIN_MALFORMED', 'pin too large or deep');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { if (!Number.isFinite(v)) throw new HistoryStateRejection('PIN_MALFORMED', 'non-finite number'); return v; }
    if (typeof v === 'string') { if (v.length > 200) throw new HistoryStateRejection('PIN_MALFORMED', 'string too long'); return v; }
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1, budget));
    if (isPlain(v)) return Object.fromEntries(Object.keys(v).sort().filter((k) => k !== 'capturedAt').map((k) => { if (!PIN_KEY.test(k)) throw new HistoryStateRejection('PIN_MALFORMED', 'bad key'); return [k, walk(v[k], depth + 1, budget)]; }));
    throw new HistoryStateRejection('PIN_MALFORMED', 'unsupported value');
  };
  return walk(pin, 0, {n: 200});
}
const pinKey = (pin) => JSON.stringify(stablePin(pin));
// The pin captured with a view is contextual (it names the module that was active then), so staleness is judged on the
// module-INDEPENDENT public version identifiers; module-level pin staleness is judged by the root's own version gate inside
// stage11ApplyState (an inexact pin makes it refuse the apply, which this controller treats as a refusal, never as success).
export function pinCore(pin, atlasModule = null) {
  const p = stablePin(pin);
  if (!isPlain(p)) throw new HistoryStateRejection('PIN_MALFORMED', 'pin is not an object');
  if (p.module != null && (!isPlain(p.module) || (atlasModule && p.module.id !== atlasModule))) throw new HistoryStateRejection('STALE_VERSION', 'pin names a different module');
  const {module: _m, overlays: _o, ...core} = p;
  return JSON.stringify(core);
}

// ---------------------------------------------------------------- projection (write path) — the only way state enters history
export function sanitizeView(capture) {
  const src = isPlain(capture) ? capture : {};
  const view = {};
  for (const k of VIEW_FIELDS) view[k] = src[k] === undefined ? null : src[k];
  view.schema = VIEW_SCHEMA;
  return view;
}
export function viewKey(view, level) {
  return JSON.stringify([view.atlasModule ?? null, view.selectedDomain ?? null, view.selectedA3 ?? null, view.selectedProcess ?? null, view.depth ?? null, level ?? null]);
}
export function buildEnvelope(view, level) { return {schema: HISTORY_SYNC_SCHEMA, level, view: sanitizeView(view)}; }

function scanProtected(value, path = '') {
  if (typeof value === 'string') { if (PROTECTED_LOOKING.test(value)) throw new HistoryStateRejection('PROTECTED_CONTENT_REJECTED', path || 'value'); return; }
  if (Array.isArray(value)) { value.forEach((x, i) => scanProtected(x, `${path}[${i}]`)); return; }
  if (isPlain(value)) { for (const [k, v] of Object.entries(value)) { if (PROTECTED_LOOKING.test(k)) throw new HistoryStateRejection('PROTECTED_CONTENT_REJECTED', `key ${path}.${k}`); scanProtected(v, `${path}.${k}`); } }
}

// Strict read path: exact envelope shape, exact allow-listed keys, typed values. Returns {ok, level, view} or {ok:false, code}.
export function parseEnvelope(raw) {
  try {
    if (!isPlain(raw)) return reject('HISTORY_STATE_MALFORMED', 'not an object');
    const keys = Object.keys(raw).sort();
    if (keys.join() !== [...ENVELOPE_KEYS].sort().join()) return reject('HISTORY_STATE_UNKNOWN_KEY', keys.join(','));
    if (raw.schema !== HISTORY_SYNC_SCHEMA) return reject('HISTORY_STATE_SCHEMA', String(raw.schema));
    if (!Number.isInteger(raw.level) || raw.level < 0 || raw.level > 3) return reject('INVALID_LEVEL', String(raw.level));
    if (!isPlain(raw.view)) return reject('HISTORY_STATE_MALFORMED', 'view not an object');
    const vkeys = Object.keys(raw.view).sort();
    if (vkeys.join() !== [...VIEW_FIELDS].sort().join()) return reject(vkeys.length < VIEW_FIELDS.length ? 'INCOMPLETE_STATE' : 'HISTORY_STATE_UNKNOWN_KEY', vkeys.join(','));
    const {governancePin16, ...rest} = raw.view;
    scanProtected({schema: raw.schema, level: raw.level, view: rest});
    const v = raw.view;
    if (v.schema !== VIEW_SCHEMA) return reject('HISTORY_STATE_SCHEMA', 'view schema');
    for (const k of ['atlasModule', 'coveragePreview', 'selectedDomain', 'selectedA3', 'selectedProcess']) if (!idOrNull(v[k])) return reject('HISTORY_STATE_MALFORMED', k);
    for (const k of ['moduleVersion', 'dataContractVersion']) if (!(v[k] === null || (typeof v[k] === 'string' && VERSION.test(v[k])))) return reject('HISTORY_STATE_MALFORMED', k);
    if (!PRIMARIES.includes(v.primary)) return reject('HISTORY_STATE_MALFORMED', 'primary');
    if (!DEPTHS.includes(v.depth)) return reject('INVALID_DEPTH', String(v.depth));
    if (governancePin16 !== null) stablePin(governancePin16);
    return {ok: true, level: raw.level, view: structuredClone(raw.view)};
  } catch (e) {
    if (e instanceof HistoryStateRejection) return reject(e.code, e.detail);
    return reject('HISTORY_STATE_MALFORMED', 'unparseable');
  }
}

// ---------------------------------------------------------------- canonical validation (shared by history restore AND the apply guard)
// `app` is the app adapter: registryHas(id), isLoaded(id)->module|null, domainIds()->Set, currentPin()->object|null.
export function validateView(view, level, app, {checkPin = false, allowCoverage = false, requireLevel = true} = {}) {
  if (!isPlain(view) || view.schema !== VIEW_SCHEMA) return reject('HISTORY_STATE_MALFORMED', 'schema');
  for (const k of ['atlasModule', 'coveragePreview', 'selectedDomain', 'selectedA3', 'selectedProcess']) if (!idOrNull(view[k] ?? null)) return reject('HISTORY_STATE_MALFORMED', k);
  const depth = view.depth ?? null;
  if (!DEPTHS.includes(depth)) return reject('INVALID_DEPTH', String(depth));
  const mod = view.atlasModule ?? null, a3 = view.selectedA3 ?? null, proc = view.selectedProcess ?? null, dom = view.selectedDomain ?? null;
  if (view.coveragePreview) {
    if (!allowCoverage) return reject('UNSUPPORTED_CONTEXT', 'coverage preview is not a recordable governed view');
    return app.registryHas(view.coveragePreview) ? {ok: true} : reject('UNSUPPORTED_CONTEXT', 'unknown coverage target');
  }
  if (requireLevel) { if (!Number.isInteger(level) || level < 0 || level > 3) return reject('INVALID_LEVEL', String(level)); }
  let m = null;
  if (mod) {
    if (!app.registryHas(mod)) return reject('UNSUPPORTED_MODULE', mod);
    m = app.isLoaded(mod);
    if (!m) return reject('UNSUPPORTED_MODULE', `${mod} is not a loaded governed module`);
  } else if (a3 || proc) return reject('INCOMPLETE_STATE', 'A3/process without a module');
  if (checkPin) {
    const cur = app.currentPin?.();
    if (!cur) return reject('STALE_VERSION', 'no current version pin');
    let p, c;
    try { p = view.governancePin16 == null ? null : pinCore(view.governancePin16, mod); c = pinCore(cur); } catch (e) { return reject(e.code ?? 'PIN_MALFORMED', e.detail ?? null); }
    if (p === null || p !== c) return reject('STALE_VERSION', 'version pin differs from the running Atlas');
  }
  // domain selection is canonical Page-0 (universe) or the active module's own territories
  if (dom) {
    const ids = m ? new Set((m.a3Parents ?? []).map((x) => x.page0DomainId)) : app.domainIds();
    if (!ids.has(dom)) return reject('UNKNOWN_DOMAIN', dom);
  }
  const a3Ids = new Set((m?.a3Parents ?? []).map((x) => x.id));
  if (a3 && !a3Ids.has(a3)) return reject('UNKNOWN_A3', a3);
  let p = null;
  if (proc) {
    p = (m?.processes ?? []).find((x) => x.id === proc) ?? null;
    if (!p) return reject('UNKNOWN_PROCESS', proc);
    if (!a3) return reject('INCOMPLETE_STATE', 'process without its A3');
    if (p.a3ParentId !== a3) return reject('PROCESS_A3_MISMATCH', `${proc} is not under ${a3}`);
  }
  // depth <-> level coherence (A4 and A5 share depth "a4"; level 3 = A5 focus requires a selected process)
  if (!mod && (depth !== 'domain' || (requireLevel && level !== 0))) return reject('INVALID_DEPTH', 'universe is depth domain / level 0');
  if (depth === 'domain') { if (a3 || proc) return reject('INCOMPLETE_STATE', 'selection under domain depth'); if (requireLevel && level !== 0) return reject('INVALID_LEVEL', 'domain depth is level 0'); }
  if (depth === 'a3') { if (proc) return reject('INCOMPLETE_STATE', 'process under A3 depth'); if (requireLevel && level !== 1) return reject('INVALID_LEVEL', 'A3 depth is level 1'); }
  if (depth === 'a4') {
    if (!a3) return reject('INCOMPLETE_STATE', 'A4 requires a selected A3');
    if (requireLevel && ![2, 3].includes(level)) return reject('INVALID_LEVEL', 'A4 depth is level 2 or 3');
    if (requireLevel && level === 3 && !proc) return reject('INCOMPLETE_STATE', 'A5 focus requires a selected process');
  }
  return {ok: true};
}

// Apply input handed to the EXISTING stage11ApplyState: allow-listed view fields + idle working-surface defaults (shape of a capture).
export function buildApplyInput(view) {
  return {
    ...sanitizeView(view),
    playback: {enabled: false, index: 0, follow: 'all', frozen: false},
    trace: {enabled: false, target: null, focusIndex: 0},
    transform: {enabled: false, filter: 'all', submode: 'reference'},
    compare: {enabled: false, mode: 'reference-client', targetModuleId: 'road-ftl', selectedProcess: null}
  };
}

// ---------------------------------------------------------------- deep link (#view=...) target, read with the SAME canonical validation
export const HASH_PREFIX = '#view=';
export function levelForDepth(depth) { return depth === 'domain' ? 0 : depth === 'a3' ? 1 : 2; }
// kind: none (no/ignored hash) | valid | invalid | stale. The existing share-link serialization has no A4-vs-A5 field: a deep link opens at A4 with its process.
export function readHashTarget(hash, app) {
  if (typeof hash !== 'string' || !hash.startsWith(HASH_PREFIX)) return {kind: 'none'};
  let raw;
  try { raw = JSON.parse(decodeURIComponent(hash.slice(HASH_PREFIX.length))); } catch { return {kind: 'none', reason: 'malformed'}; }
  if (!isPlain(raw) || raw.schema !== VIEW_SCHEMA) return {kind: 'none', reason: 'not-a-view-state'};
  const view = {...Object.fromEntries(VIEW_FIELDS.map((k) => [k, raw[k] === undefined ? null : raw[k]])), schema: VIEW_SCHEMA};
  if (view.coveragePreview) return {kind: 'none', reason: 'coverage-preview'};
  if (!PRIMARIES.includes(view.primary)) view.primary = 'execute';
  try { const {governancePin16, ...rest} = view; scanProtected(rest); } catch (e) { return {kind: 'invalid', code: e.code, detail: e.detail}; }
  const level = levelForDepth(view.depth);
  const v = validateView(view, level, app, {requireLevel: DEPTHS.includes(view.depth)});
  if (!v.ok) return {kind: 'invalid', code: v.code, detail: v.detail};
  if (view.governancePin16 != null) {
    const v2 = validateView(view, level, app, {checkPin: true});
    if (!v2.ok) return {kind: 'stale', code: v2.code, detail: v2.detail};
  }
  return {kind: 'valid', view, level};
}

// ---------------------------------------------------------------- app adapter (browser root)
export function isAtlasRoot(win) {
  return !!win && typeof win.stage11CaptureState === 'function' && typeof win.stage11ApplyState === 'function' && typeof win.renderCanvas === 'function' && !!win.S && typeof win.S === 'object' && !!win.AtlasModuleLoader;
}
export function browserApp(win) {
  const S = () => win.S;
  const idle = () => !(S().playback?.enabled || S().trace?.enabled || S().transform?.enabled || S().compare10?.enabled);
  return {
    capture: () => win.stage11CaptureState(),
    level: () => Number(S().visual152?.level ?? 0),
    registryHas: (id) => !!S().registry?.items?.some((x) => x.id === id),
    isLoaded: (id) => { try { return win.AtlasModuleLoader.get(id) || null; } catch { return null; } },
    domainIds: () => new Set((S().page0?.domains ?? []).map((d) => d.id)),
    currentPin: () => win.stage11CaptureState()?.governancePin16 ?? null,
    restoring: () => !!S().stage11?.restoring,
    idle,
    setLevel: (n) => win.v152SetLevel?.(n, {center: false}),
    reset: () => win.reset?.(),
    ready: () => !!(S().module && S().registry && win.AtlasCommandBus && win.stage11CaptureState()?.governancePin16 && typeof win.v152SetLevel === 'function')
  };
}

// ---------------------------------------------------------------- controller
const delay = (win, ms) => new Promise((r) => win.setTimeout(r, ms));
export function createHistorySync(win, {app = browserApp(win), settleMs = 220, readyTimeoutMs = 20000, pollMs = 35} = {}) {
  const stats = {adopted: 0, pushed: 0, replaced: 0, restored: 0, ignoredForeign: 0, rejected: 0, rejectedApply: 0, skippedInvalidLive: 0, resetFailClosed: 0, restoreMismatch: 0, lastRejection: null};
  let guard = false, started = false, stopped = false, lastKey = null, pending = null, innerApply = null, origRender = null, timer = null, interval = null;
  const html = () => win.document?.documentElement;
  const setStatus = (s) => { try { html().dataset.atlasHistorySync = s; } catch { /* non-DOM */ } };
  const noteReject = (r) => { stats.lastRejection = r.code; try { html().dataset.atlasHistorySyncRejection = r.code; } catch { /* non-DOM */ } };
  const liveView = () => sanitizeView(app.capture());
  const liveKey = () => viewKey(liveView(), app.level());
  const ownEntry = () => { const st = win.history.state; return isPlain(st) && HISTORY_STATE_KEY in st ? st[HISTORY_STATE_KEY] : undefined; };

  function writeEntry(view, level) {
    const key = viewKey(view, level), entry = buildEnvelope(view, level), cur = win.history.state;
    if (ownEntry() === undefined) { win.history.replaceState({...(isPlain(cur) ? cur : {}), [HISTORY_STATE_KEY]: entry}, '', win.location.href); stats[started && lastKey !== null ? 'replaced' : 'adopted']++; }
    else { win.history.pushState({[HISTORY_STATE_KEY]: entry}, '', win.location.href); stats.pushed++; }
    lastKey = key;
  }

  function evaluate() {
    if (!started || stopped || guard || app.restoring() || !app.idle()) return;
    const view = liveView(), level = app.level();
    const v = validateView(view, level, app);
    if (!v.ok) { stats.skippedInvalidLive++; noteReject(v); return; }
    if (viewKey(view, level) === lastKey) return;
    writeEntry(view, level);
  }
  const schedule = () => { if (timer == null) timer = win.setTimeout(() => { timer = null; try { evaluate(); } catch (e) { stats.lastRejection = 'EVALUATE_ERROR'; } }, 0); };

  async function settle() {
    const t0 = Date.now();
    while (app.restoring() && Date.now() - t0 < 2000) await delay(win, 20);
    await delay(win, settleMs);
  }
  async function restore(target) {
    if (guard) { pending = target; return; }
    guard = true;
    try {
      const ok = innerApply(buildApplyInput(target.view));
      if (ok === false) { stats.restoreMismatch++; noteReject(reject('RESTORE_REFUSED')); }
      else {
        await settle();
        if (app.level() !== target.level) { app.setLevel(target.level); await settle(); }
        stats.restored++;
      }
      let live = null; try { live = liveKey(); } catch { live = null; }
      if (live !== viewKey(target.view, target.level)) { stats.restoreMismatch++; noteReject(reject('RESTORE_MISMATCH')); }
      lastKey = live;
    } finally {
      guard = false;
      if (pending) { const p = pending; pending = null; await restore(p); }
    }
  }

  function onPop(e) {
    if (stopped || !started) return;
    const raw = isPlain(e.state) ? e.state[HISTORY_STATE_KEY] : undefined;
    if (raw === undefined) { stats.ignoredForeign++; return; }
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) { stats.rejected++; noteReject(parsed); return; }
    const v = validateView(parsed.view, parsed.level, app, {checkPin: true});
    if (!v.ok) { stats.rejected++; noteReject(v); return; }
    if (!guard && viewKey(parsed.view, parsed.level) === liveKey()) { lastKey = viewKey(parsed.view, parsed.level); return; }
    restore(parsed).catch(() => { stats.lastRejection = 'RESTORE_ERROR'; });
  }

  // Every other caller of stage11ApplyState (saved views, #view= deep links, last-session restore, hashchange) is validated against the
  // same canonical data before the existing machinery runs; an invalid state is refused (returns false), never "repaired".
  function installApplyGuard() {
    innerApply = win.stage11ApplyState;
    win.stage11ApplyState = function guardedApply(st) {
      if (isPlain(st) && st.schema === VIEW_SCHEMA && !guard) {
        const view = {...Object.fromEntries(VIEW_FIELDS.map((k) => [k, st[k] === undefined ? null : st[k]])), schema: VIEW_SCHEMA};
        const v = validateView(view, null, app, {allowCoverage: true, requireLevel: false});
        if (!v.ok) { stats.rejectedApply++; noteReject(v); return false; }
      }
      return innerApply.apply(this, arguments);
    };
  }
  function installRenderHook() {
    origRender = win.renderCanvas;
    win.renderCanvas = function historySyncRender() { const r = origRender.apply(this, arguments); schedule(); return r; };
  }

  async function start() {
    if (started || stopped) return status();
    if (!isAtlasRoot(win)) { setStatus('inactive-non-root'); return status(); }
    const t0 = Date.now();
    while (!app.ready()) { if (Date.now() - t0 > readyTimeoutMs) { setStatus('inactive-not-ready'); return status(); } await delay(win, pollMs); }
    await settle();
    installApplyGuard();
    // reconcile the current history entry with the live view.
    // Precedence: (1) a valid history entry (reload / restored session) -> (2) a valid #view= deep link -> (3) the live root state.
    // The root applies #view= / last-session state at init, BEFORE its V1.5 layers exist, and throws part-way (stage15RenderContract is not
    // defined): only the module survives. This controller therefore re-applies the canonical target after the root has settled.
    const own = ownEntry();
    let handled = false;
    if (own !== undefined) {
      const parsed = parseEnvelope(own), v = parsed.ok ? validateView(parsed.view, parsed.level, app, {checkPin: true}) : parsed;
      if (v.ok) { handled = true; started = true; if (viewKey(parsed.view, parsed.level) !== liveKey()) await restore(parsed); else lastKey = liveKey(); }
      else { noteReject(v); stats.rejected++; }
    }
    if (!handled) {
      started = true;
      const hashTarget = readHashTarget(win.location.hash, app);
      const neutral = async () => { guard = true; try { app.reset(); await settle(); } finally { guard = false; } };
      if (hashTarget.kind === 'valid') {
        if (viewKey(hashTarget.view, hashTarget.level) !== liveKey()) await restore({view: hashTarget.view, level: hashTarget.level});
        stats.hashRestored = (stats.hashRestored ?? 0) + 1;
        let v = validateView(liveView(), app.level(), app);
        if (v.ok) { writeEntry(liveView(), app.level()); handled = true; }
      } else if (hashTarget.kind === 'invalid' || hashTarget.kind === 'stale') {
        // an invalid / stale deep link is refused: never applied, never repaired -> the canonical neutral Universe
        noteReject(hashTarget); stats.rejected++; stats.resetFailClosed++;
        if (liveKey() !== viewKey(sanitizeView({atlasModule: null, depth: 'domain'}), 0)) await neutral();
        if (validateView(liveView(), app.level(), app).ok) { writeEntry(liveView(), app.level()); handled = true; }
      }
    }
    if (!handled) {
      started = true;
      const view = liveView(), level = app.level();
      let v = validateView(view, level, app);
      if (!v.ok) {
        // live state (e.g. an invalid last-session applied by the root before this module loaded) is not governed: fail closed to the canonical neutral state.
        noteReject(v); stats.resetFailClosed++;
        guard = true;
        try { app.reset(); await settle(); } finally { guard = false; }
        v = validateView(liveView(), app.level(), app);
      }
      if (v.ok) writeEntry(liveView(), app.level());
    }
    win.addEventListener('popstate', onPop);
    installRenderHook();
    interval = win.setInterval(schedule, 250);
    setStatus('active');
    return status();
  }
  function stop() {
    stopped = true; started = false;
    try { win.removeEventListener('popstate', onPop); } catch { /* ignore */ }
    if (interval != null) win.clearInterval(interval);
    if (origRender && win.renderCanvas && win.renderCanvas.name === 'historySyncRender') win.renderCanvas = origRender;
    if (innerApply && win.stage11ApplyState?.name === 'guardedApply') win.stage11ApplyState = innerApply;
    setStatus('stopped');
  }
  const status = () => ({schema: HISTORY_SYNC_SCHEMA, state: html()?.dataset?.atlasHistorySync ?? null, started, guard, lastKey, stats: {...stats}});
  return {start, stop, status, evaluate, restore, _internals: {app}};
}

export function installHistorySync(win = globalThis) {
  if (!win || !win.document) return null;
  if (win.AtlasS8HistorySync) return win.AtlasS8HistorySync;
  if (!isAtlasRoot(win)) { try { win.document.documentElement.dataset.atlasHistorySync = 'inactive-non-root'; } catch { /* ignore */ } return null; }
  const ctl = createHistorySync(win);
  win.AtlasS8HistorySync = {schema: HISTORY_SYNC_SCHEMA, status: ctl.status, stop: ctl.stop, ready: ctl.start()};
  win.AtlasS8HistorySync.ready.catch((e) => { try { win.document.documentElement.dataset.atlasHistorySync = 'error'; } catch { /* ignore */ } console.warn('Atlas S8 history sync', e); });
  return win.AtlasS8HistorySync;
}
