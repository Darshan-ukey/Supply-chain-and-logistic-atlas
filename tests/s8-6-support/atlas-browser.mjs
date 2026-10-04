// S8-6 browser support: static server over a repository tree (no /api), Chromium launch, and governed-state helpers.
// Deterministic by construction: assertions wait on observable state (history-sync settle), never on fixed sleeps alone.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png'};

export function loadPlaywright() {
  const req = createRequire(import.meta.url);
  const tries = [() => req('playwright'), () => req('playwright-core'), () => createRequire(path.join(process.env.NODE_PATH?.split(path.delimiter)[0] ?? '/usr/local/lib/node_modules_global', 'x.js'))('playwright')];
  for (const t of tries) { try { return t(); } catch { /* next */ } }
  throw new Error('Playwright is not resolvable in this environment');
}
export function chromiumExecutable() {
  const cands = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);
  return cands.find((p) => fs.existsSync(p)) ?? null;
}
export async function launch() {
  const {chromium} = loadPlaywright();
  const exe = chromiumExecutable();
  return chromium.launch({...(exe ? {executablePath: exe} : {}), args: ['--no-sandbox', '--disable-dev-shm-usage']});
}

export function startStaticServer(root) {
  const base = path.resolve(root);
  const server = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    const f = path.join(base, u);
    if (u.startsWith('/api/') || !f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404, {'content-type': 'application/json'}); r.end('{"ok":false}'); return; }
    r.writeHead(200, {'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    r.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({server, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok))})));
}

// history instrumentation (counts only; installed before any page script)
export const INSTRUMENT = () => {
  Error.stackTraceLimit = 120;
  window.addEventListener('error', (e) => { try { console.debug('S86ERR ' + JSON.stringify({m: String(e.message), a: document.documentElement.dataset.atlasHistorySync ?? null})); } catch { /* ignore */ } });
  window.__hist = {push: 0, replace: 0, popstate: 0, hashchange: 0};
  const op = history.pushState.bind(history), or = history.replaceState.bind(history);
  history.pushState = (...a) => { window.__hist.push++; return op(...a); };
  history.replaceState = (...a) => { window.__hist.replace++; return or(...a); };
  addEventListener('popstate', () => window.__hist.popstate++);
  addEventListener('hashchange', () => window.__hist.hashchange++);
};

export async function openAtlas(browser, origin, {hash = '', instrument = true, storage = null, waitActive = true} = {}) {
  const ctx = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await ctx.newPage();
  const errors = [];
  Object.defineProperty(errors, 'stacks', {value: [], enumerable: false});
  page.on('pageerror', (e) => { errors.push(String(e.message).slice(0, 200)); errors.stacks.push(String(e.stack ?? e.message).slice(0, 9000)); });
  Object.defineProperty(errors, 'meta', {value: [], enumerable: false});
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('S86ERR ')) { try { errors.meta.push(JSON.parse(t.slice(7))); } catch { /* ignore */ } } });
  if (instrument) await page.addInitScript(INSTRUMENT);
  if (storage) await page.addInitScript((s) => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* ignore */ } }, storage);
  await page.goto(`${origin}/index.html${hash}`, {waitUntil: 'load'});
  if (waitActive) await waitActiveSync(page);
  return {ctx, page, errors};
}

// Pre-existing root load-time race (root is byte-identical and not modified): the Stage-8 closeFutureDrawer recursion is repaired only by a later script
// block, so a render task that slips in before it overflows the stack. It is tolerated ONLY as that exact message AND ONLY when raised before the history
// module set any status (i.e. before the module could have run). Counted, never silent.
export const LOAD_RACE_MESSAGE = 'Maximum call stack size exceeded';
export const loadRaceTally = {tolerated: 0};
export function withoutRootLoadRace(errors) {
  let k = (errors.meta ?? []).filter((x) => x.m.includes(LOAD_RACE_MESSAGE) && x.a === null).length;
  return errors.filter((e) => { if (k > 0 && e.includes(LOAD_RACE_MESSAGE)) { k--; loadRaceTally.tolerated++; return false; } return true; });
}
export const waitActiveSync = (page, timeout = 25000) => page.waitForFunction(() => document.documentElement.dataset.atlasHistorySync === 'active' && window.AtlasS8HistorySync?.status().started, null, {timeout});

// live governed state + history counters
export const snapshot = (page) => page.evaluate(() => ({
  module: S.activeModule ?? null, domain: S.selectedDomain ?? null, a3: S.selectedA3 ?? null, process: S.selectedProcess ?? null,
  depth: S.depth, level: S.visual152.level, slider: document.getElementById('semanticRange152')?.value ?? null,
  levelName: document.getElementById('levelName')?.textContent ?? null,
  histLen: history.length, hist: {...(window.__hist ?? {})},
  sync: window.AtlasS8HistorySync ? (({state, guard, stats}) => ({state, guard, stats}))(window.AtlasS8HistorySync.status()) : null,
  path: location.pathname + location.hash.slice(0, 7),
  adminOpen: document.body.classList.contains('admin16')
}));
export const govState = async (page) => { const s = await snapshot(page); return {module: s.module, domain: s.domain, a3: s.a3, process: s.process, depth: s.depth, level: s.level}; };

// wait until history sync has recorded/restored the live state and nothing is moving
export async function settle(page, {timeout = 8000} = {}) {
  const t0 = Date.now();
  let prev = null;
  while (Date.now() - t0 < timeout) {
    const cur = await page.evaluate(() => {
      const a = window.AtlasS8HistorySync;
      if (!a) return null;
      const st = a.status();
      const live = JSON.stringify([S.activeModule ?? null, S.selectedDomain ?? null, S.selectedA3 ?? null, S.selectedProcess ?? null, S.depth || 'domain', S.visual152.level]);
      return JSON.stringify({guard: st.guard, restoring: !!S.stage11?.restoring, sameKey: st.lastKey === live, h: history.length, c: window.__hist, stats: st.stats});
    }).catch(() => null);
    if (cur && prev === cur) { const o = JSON.parse(cur); if (!o.guard && !o.restoring && o.sameKey) return; }
    prev = cur;
    await page.waitForTimeout(170);
  }
  throw new Error('settle timeout');
}

// ---- governed UI actions (real UI where the root provides it)
export async function activateRoadLtl(page) {
  await page.click('#railModels152');
  await page.waitForSelector('button[data-module11="road-ltl"]', {state: 'visible'});
  await page.click('button[data-module11="road-ltl"]');
  await page.waitForFunction(() => S.activeModule === 'road-ltl');
  await settle(page);
}
export async function selectA3(page, id = 'a3-commercial-commitment') {
  await page.click(`.a3-node[data-a3="${id}"]`, {force: true});
  await page.waitForFunction((x) => S.selectedA3 === x, id);
  await settle(page);
}
export async function setLevel(page, n) {
  await page.evaluate((v) => { const s = document.getElementById('semanticRange152'); s.value = String(v); s.dispatchEvent(new Event('input', {bubbles: true})); }, n);
  await page.waitForFunction((v) => S.visual152.level === v, n);
  await settle(page);
}
export async function selectProcess(page, id = 'LTL-01') {
  await page.click(`.a4-node[data-process="${id}"]`, {force: true});
  await page.waitForFunction((x) => S.selectedProcess === x, id);
  await settle(page);
}
export const firstProcessOf = (page, a3) => page.evaluate((x) => AtlasModuleLoader.get('road-ltl').processes.find((p) => p.a3ParentId === x)?.id ?? null, a3);

// reach a named governed critical state from a fresh Universe
export const STATES = {
  U: {module: null, domain: null, a3: null, process: null, depth: 'domain', level: 0},
  M: {module: 'road-ltl', domain: null, a3: null, process: null, depth: 'a3', level: 1},
  A: {module: 'road-ltl', domain: null, a3: 'a3-commercial-commitment', process: null, depth: 'a3', level: 1},
  B: {module: 'road-ltl', domain: null, a3: 'a3-commercial-commitment', process: null, depth: 'a4', level: 2},
  C: {module: 'road-ltl', domain: null, a3: 'a3-commercial-commitment', process: 'LTL-01', depth: 'a4', level: 2},
  D: {module: 'road-ltl', domain: null, a3: 'a3-commercial-commitment', process: 'LTL-01', depth: 'a4', level: 3},
  E: {module: 'road-ltl', domain: null, a3: 'a3-origin-terminal', process: '@first-of-origin-terminal', depth: 'a4', level: 2},
  F: {module: null, domain: 'commercial', a3: null, process: null, depth: 'domain', level: 0},
  G: {module: 'road-ltl', domain: null, a3: null, process: null, depth: 'domain', level: 0}
};
export async function reach(page, name) {
  if (name === 'U') return;
  if (name === 'F') { await page.evaluate(() => selectDomain('commercial')); await page.waitForFunction(() => S.selectedDomain === 'commercial'); await settle(page); return; }
  await activateRoadLtl(page);
  if (name === 'M') return;
  if (name === 'G') { await page.evaluate(() => v152FitUniverse()); await page.waitForFunction(() => S.visual152.level === 0 && S.activeModule === 'road-ltl'); await settle(page); return; }
  if (name === 'E') { await selectA3(page, 'a3-origin-terminal'); await setLevel(page, 2); await selectProcess(page, await firstProcessOf(page, 'a3-origin-terminal')); return; }
  await selectA3(page, 'a3-commercial-commitment');
  if (name === 'A') return;
  await setLevel(page, 2);
  if (name === 'B') return;
  await selectProcess(page, 'LTL-01');
  if (name === 'C') return;
  await setLevel(page, 3);
}
export async function expectedState(page, name) {
  const e = {...STATES[name]};
  if (e.process === '@first-of-origin-terminal') e.process = await firstProcessOf(page, 'a3-origin-terminal');
  return e;
}

export async function reloadAndSettle(page) {
  await page.reload({waitUntil: 'load'});
  await waitActiveSync(page);
  await settle(page);
}
export async function back(page) { await page.goBack({waitUntil: 'commit'}).catch(() => null); }
export async function forward(page) { await page.goForward({waitUntil: 'commit'}).catch(() => null); }
export async function waitForGov(page, expected, timeout = 8000) {
  await page.waitForFunction((e) => S.activeModule === e.module && (S.selectedDomain ?? null) === e.domain && (S.selectedA3 ?? null) === e.a3 && (S.selectedProcess ?? null) === e.process && S.depth === e.depth && S.visual152.level === e.level, expected, {timeout});
  await settle(page);
}

// Mechanism probe for the pre-existing root load-time race. Serves the UNCHANGED root in two chunks (parser yields between script blocks) and,
// optionally, injects ONE render task into the unrepaired window (probe only; nothing in the repository is modified). The history module is blocked (404)
// so the probe proves the overflow does not depend on the module at all.
export function startRaceProbeServer(root, {inject = true, blockHistoryModule = true, splitAfterLine = 1319} = {}) {
  const base = path.resolve(root);
  const lines = fs.readFileSync(path.join(base, 'index.html'), 'utf8').split('\n');
  if (!lines[splitAfterLine - 2].startsWith('</script>') || !lines[splitAfterLine].startsWith('<script>')) throw new Error('root script boundary moved: probe is stale');
  if (inject) lines[splitAfterLine - 2] = "setTimeout(function(){try{renderCanvas()}catch(e){console.debug('RACEPROBE '+e.name+': '+e.message)}},0);\n" + lines[splitAfterLine - 2];
  const A = lines.slice(0, splitAfterLine).join('\n') + '\n', B = lines.slice(splitAfterLine).join('\n');
  const server = http.createServer(async (q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/' || u === '/index.html') { r.writeHead(200, {'content-type': TYPES['.html'], 'cache-control': 'no-store'}); r.write(A); await new Promise((x) => setTimeout(x, 400)); r.end(B); return; }
    const f = path.join(base, u);
    if (u.startsWith('/api/') || (blockHistoryModule && u.includes('atl-s8-history-sync')) || !f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('{}'); return; }
    r.writeHead(200, {'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store'}); r.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok))})));
}
