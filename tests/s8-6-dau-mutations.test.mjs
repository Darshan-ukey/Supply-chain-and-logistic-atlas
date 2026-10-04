import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';

// S8-6 DAU-007 / DAU-006 mutation suite. Each mutation is applied to an isolated detached worktree of HEAD (never to the working tree)
// and the governed DAU suite must FAIL. A surviving mutation fails this suite. A clean control run must PASS.
const root = process.cwd();
const git = (args, cwd = root) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd, encoding: 'utf8', maxBuffer: 300000000}).trim();
const MOD = 'assets/atl-s8-history-sync.mjs', JOURNEY = 'assets/atl-140-v15-journey.mjs', INDEX = 'index.html', SHELL = 'execution/ui/runtime-access-shell.js';
const OVERLAY = [MOD, JOURNEY, 'tests/s8-6-dau-history-sync.test.mjs', 'tests/s8-6-support/atlas-browser.mjs'];
const CORE = '^(U[0-9]+|I0[0-9]|B007-.*|D6-D1|D6-R-C|D6-R-B|D6-R2|D6-R3|D6-L-C|C01|N-X.*|N-P-(stalePin|unknownProcess|unknownModule|protectedKey)|N-R-(stalePin|unknownProcess))$';
const BROWSER = '^(B007-.*|D6-D1|D6-R-C|D6-R-B|D6-L-C|C01|N-X.*)$';

const M = [
  {id: 'M01-A4-ENTRY-OMITTED', name: 'A4 history entry omitted (no entry when A4 has no process)', edits: [{file: MOD, find: 'if (viewKey(view, level) === lastKey) return;\n    writeEntry(view, level);', repl: "if (viewKey(view, level) === lastKey || (view.depth === 'a4' && !view.selectedProcess)) return;\n    writeEntry(view, level);"}], scope: BROWSER},
  {id: 'M02-PROCESS-WITHOUT-A4', name: 'process entry overwrites the preceding A4 entry (process pushed without preceding A4)', edits: [{file: MOD, find: "if (ownEntry() === undefined) { win.history.replaceState", repl: "if (ownEntry() === undefined || view.selectedProcess) { win.history.replaceState"}], scope: BROWSER},
  {id: 'M03-BACK-SKIPS-A4', name: 'Back skips the A4 state', edits: [{file: MOD, find: "    const v = validateView(parsed.view, parsed.level, app, {checkPin: true});\n    if (!v.ok) { stats.rejected++; noteReject(v); return; }\n    if (!guard && viewKey", repl: "    const v = validateView(parsed.view, parsed.level, app, {checkPin: true});\n    if (!v.ok) { stats.rejected++; noteReject(v); return; }\n    if (parsed.view.depth === 'a4' && !parsed.view.selectedProcess) { win.history.back(); return; }\n    if (!guard && viewKey"}], scope: BROWSER},
  {id: 'M04-FORWARD-LOSES-LTL01', name: 'Forward loses LTL-01 (process dropped on restore)', edits: [{file: MOD, find: 'const ok = innerApply(buildApplyInput(target.view));', repl: 'const ok = innerApply(buildApplyInput({...target.view, selectedProcess: null}));'}], scope: BROWSER},
  {id: 'M05-RELOAD-LOSES-STATE', name: 'reload loses state (own history entry ignored on start)', edits: [{file: MOD, find: 'const own = ownEntry();', repl: 'const own = undefined;'}], scope: BROWSER},
  {id: 'M06-ROOT-CHANGED', name: 'root index.html changed', edits: [{file: INDEX, append: '\n<!-- mutation -->\n'}], scope: CORE},
  {id: 'M07-SHELL-CHANGED', name: 'runtime access shell changed', edits: [{file: SHELL, append: '\n// mutation\n'}], scope: CORE},
  {id: 'M08-ATL142-CONTROLLER-COPIED', name: 'ATL-142 history controller restored', edits: [{file: MOD, append: '\nfunction stage11HistoryWrite() { return null; }\nfunction stage11HistoryWrap() { return null; }\n'}], scope: CORE},
  {id: 'M09-PROTECTED-IN-HISTORY-STATE', name: 'protected value placed in history.state', edits: [{file: MOD, find: 'entry = buildEnvelope(view, level), cur', repl: "entry = {...buildEnvelope(view, level), protectedPackage: 'malkom-dw::road-ltl::LTL-04::v1'}, cur"}], scope: CORE},
  {id: 'M10-UNKNOWN-PROCESS-ACCEPTED', name: 'unknown process accepted', edits: [{file: MOD, find: "if (!p) return reject('UNKNOWN_PROCESS', proc);", repl: "if (!p) p = {a3ParentId: a3};"}], scope: CORE},
  {id: 'M11-DUPLICATE-ENTRIES', name: 'duplicate history entries on idempotent renders', edits: [{file: MOD, find: 'if (viewKey(view, level) === lastKey) return;\n    writeEntry(view, level);', repl: 'writeEntry(view, level);'}], scope: BROWSER},
  {id: 'M12-POPSTATE-PUSHES', name: 'popstate creates a new pushState', edits: [{file: MOD, find: '    restore(parsed).catch(() => { stats.lastRejection = \'RESTORE_ERROR\'; });\n  }', repl: "    win.history.pushState({[HISTORY_STATE_KEY]: buildEnvelope(parsed.view, parsed.level)}, '', win.location.href);\n    restore(parsed).catch(() => { stats.lastRejection = 'RESTORE_ERROR'; });\n  }"}], scope: BROWSER},
  {id: 'M13-MODULE-NOT-PRESERVED', name: 'module change not preserved in the history key', edits: [{file: MOD, find: 'return JSON.stringify([view.atlasModule ?? null, view.selectedDomain', repl: 'return JSON.stringify([null, view.selectedDomain'}], scope: CORE},
  {id: 'M14-A3-NOT-PRESERVED', name: 'A3 change not preserved in the history key', edits: [{file: MOD, find: 'view.selectedDomain ?? null, view.selectedA3 ?? null, view.selectedProcess', repl: 'view.selectedDomain ?? null, null, view.selectedProcess'}], scope: CORE},
  {id: 'M15-RESTORE-FEEDBACK-LOOP', name: 'restoration guard disabled (restore re-enters history)', edits: [{file: MOD, find: '    guard = true;\n    try {\n      const ok = innerApply', repl: '    try {\n      const ok = innerApply'}], scope: BROWSER},
  {id: 'M16-STALE-PIN-ACCEPTED', name: 'stale version pin accepted', edits: [{file: MOD, find: 'if (p === null || p !== c) return reject', repl: 'if (false) return reject'}], scope: CORE},
  {id: 'M17-JOURNEY-NOT-LOADING-MODULE', name: 'journey does not load the history module', edits: [{file: JOURNEY, find: 'try { installHistorySync(globalThis); }', repl: 'try { /* mutation */ }'}], scope: CORE},
  {id: 'M18-CONSUMER-PAGE-NOT-NOOP', name: 'module not a no-op off the Atlas root', edits: [{file: MOD, find: 'export function isAtlasRoot(win) {', repl: 'export function isAtlasRoot(win) {\n  if (win && win.document) return true;'}], scope: '^(C01|U[0-9]+)$'},
  {id: 'M19-STARTUP-PUSHES', name: 'startup pushes instead of replacing the current entry', edits: [{file: MOD, find: "if (ownEntry() === undefined) { win.history.replaceState", repl: "if (false) { win.history.replaceState"}], scope: BROWSER},
  {id: 'M20-UNKNOWN-MODULE-ACCEPTED', name: 'unknown module accepted (registry and loaded-module checks both removed)', edits: [{file: MOD, find: "if (!app.registryHas(mod)) return reject('UNSUPPORTED_MODULE', mod);\n    m = app.isLoaded(mod);\n    if (!m) return reject('UNSUPPORTED_MODULE', `${mod} is not a loaded governed module`);", repl: 'm = app.isLoaded(mod) ?? {a3Parents: [], processes: []};'}], scope: CORE},
  {id: 'M21-JOURNEY-OTHER-CHANGE', name: 'journey changed beyond the authorized additive three lines', edits: [{file: JOURNEY, append: '\nexport const mutated = true;\n'}], scope: CORE}
];

const results = [];
const test = async (id, name, fn) => { try { await fn(); results.push({id, ok: true}); console.log(`PASS ${id} ${name}`); } catch (e) { results.push({id, ok: false}); console.log(`FAIL ${id} ${name}\n  ${String(e.message).split('\n').slice(0, 6).join('\n  ')}`); } };

const tmp = fs.mkdtempSync(path.join(process.env.S8_6_MUT_TMP ?? os.tmpdir(), 's8-6-mut-'));
const made = [];
function worktree(tag) {
  const dir = path.join(tmp, tag);
  git(['worktree', 'add', '--detach', dir, 'HEAD']);
  made.push(dir);
  for (const f of OVERLAY) { const src = path.join(root, f); const dst = path.join(dir, f); fs.mkdirSync(path.dirname(dst), {recursive: true}); fs.copyFileSync(src, dst); }
  return dir;
}
function applyEdits(dir, edits) {
  for (const e of edits) {
    const p = path.join(dir, e.file); let s = fs.readFileSync(p, 'utf8');
    if (e.append !== undefined) s += e.append; else { assert.ok(s.includes(e.find), `mutation anchor not found in ${e.file}: ${e.find.slice(0, 60)}`); s = s.replace(e.find, () => e.repl); }
    fs.writeFileSync(p, s);
  }
}
function runSuite(dir, scope) {
  return new Promise((resolve) => {
    const out = [];
    const c = cp.spawn('node', ['tests/s8-6-dau-history-sync.test.mjs'], {cwd: dir, env: {...process.env, S8_6_ONLY: scope, S8_6_CONCURRENCY: '2'}});
    c.stdout.on('data', (d) => out.push(d)); c.stderr.on('data', (d) => out.push(d));
    const timer = setTimeout(() => c.kill('SIGKILL'), 9 * 60 * 1000);
    c.on('close', (code) => { clearTimeout(timer); const text = Buffer.concat(out).toString(); resolve({code, text, failed: [...text.matchAll(/^FAIL (\S+)/gm)].map((m) => m[1]), passed: [...text.matchAll(/^PASS (\S+)/gm)].map((m) => m[1])}); });
  });
}

const detail = {};
const CONC = Number(process.env.S8_6_MUT_CONCURRENCY ?? 3);
async function pool(items, n, fn) { const q = [...items]; await Promise.all(Array.from({length: n}, async () => { while (q.length) await fn(q.shift()); })); }

try {
  await test('MC00', 'control: the unmutated worktree passes the governed DAU scope (mutation harness is meaningful)', async () => {
    const dir = worktree('control'); const r = await runSuite(dir, CORE);
    assert.equal(r.code, 0, r.text.slice(-1500)); assert.ok(r.passed.length > 40); detail.control = {passed: r.passed.length};
  });
  const SEL = process.env.S8_6_MUT_ONLY ? new RegExp(process.env.S8_6_MUT_ONLY) : null;
  await pool(M.filter((m) => !SEL || SEL.test(m.id)), CONC, async (m) => {
    await test(m.id, `${m.name} is detected`, async () => {
      const dir = worktree(m.id); applyEdits(dir, m.edits);
      const r = await runSuite(dir, m.scope);
      detail[m.id] = {killedBy: r.failed, exit: r.code, ran: r.passed.length + r.failed.length};
      assert.notEqual(r.code, 0, `SURVIVED: ${m.id}`);
      assert.ok(r.failed.length >= 1, `no failing governed case recorded for ${m.id}`);
    });
  });
} finally {
  for (const d of made) { try { git(['worktree', 'remove', '--force', d]); } catch { /* best effort */ } }
  try { fs.rmSync(tmp, {recursive: true, force: true}); } catch { /* ignore */ }
}
const failed = results.filter((r) => !r.ok);
const killed = M.filter((m) => results.find((r) => r.id === m.id)?.ok).length;
console.log(`\nS8-6 DAU mutations: ${results.length - failed.length}/${results.length} passed (mutations detected ${killed}/${M.length})`);
console.log(JSON.stringify({suite: 's8-6-dau-mutations', total: results.length, passed: results.length - failed.length, failed: failed.length, mutations: M.length, detected: killed, survived: M.filter((m) => !results.find((r) => r.id === m.id)?.ok).map((m) => m.id), detail, caseIds: results.map((r) => r.id).sort()}));
process.exit(failed.length ? 1 : 0);
