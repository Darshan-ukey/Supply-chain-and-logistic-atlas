// S8-6 successor RC exact-commit QA runner. Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>
// Fresh full clone at the exact tested commit. Runs: the S8-6 RC suite, the DAU-007/DAU-006 browser suite on the RC, the RC mutation suite and the DAU mutation suite,
// inherited S8 suites, certified donor suites (incl. API/router), the S8-5B / S8-5A / S8-4 / S8-3F predecessor suites, manifest determinism + verifier, release-integrity at the
// repo root and inside each package, package verification/determinism, source custody, protected-derivative reproduction from custody, and a LINEAGE-ONLY single-branch clone in which
// the divergent source commit (662c7847) and every historical assembly commit are absent.
// Predecessor exact-pin failures at the successor are classified (never weakened) only when (a) the exact failing case set equals the expected stage-local set, (b) every other case passes,
// (c) the mechanical reason probe for the case confirms the identity evolved as designed, and (d) the predecessor's own exact accepted commit still passes in full in this run.
// PASS = the successor RC is assembled and frozen as a candidate ready for ATL-181 independent audit. NOT ATL-181 PASS, UAT, sign-off, promotion, deployment or runtime readiness.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const repo = path.resolve(process.argv[2] || '.'), checkout = path.resolve(process.argv[3]), output = path.resolve(process.argv[4]);
if (!process.argv[3] || !process.argv[4]) throw Error('Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>');
if (fs.existsSync(checkout)) throw Error('Fresh checkout directory required');
const git = (args, cwd = repo) => cp.execFileSync('git', ['-c', 'safe.directory=' + cwd, '-c', 'safe.directory=' + cwd + '/.git', ...args], {cwd, encoding: 'utf8', maxBuffer: 400000000}).trim();
const gitTry = (args, cwd = repo) => { try { return git(args, cwd); } catch { return null; } };
const head = git(['rev-parse', 'HEAD']);
const branch = gitTry(['branch', '--show-current']);
cp.execFileSync('git', ['-c', 'safe.directory=' + repo, '-c', 'safe.directory=' + repo + '/.git', 'clone', '--no-hardlinks', '--no-checkout', repo, checkout], {stdio: 'pipe'});
git(['checkout', '--detach', head], checkout);
const BASE = '97e3086daa7b1ca694d019f0f30bb2c3150e7a6d', BASE_TREE = '33c820c5d5c347ca918f128492f9b6928ea07f64';
const S85A_HEAD = 'f8dc6c3863bc7310d8d83addf2d6ff1b6d34e12f', S85A_TESTED = 'cf6c89dc51187329e4455f20fa12e2d742735621';
const S85B_TESTED = 'c05d35d7eea79dacfa2290bc04bd0bf1727b1ef0', S84_TESTED = '07a41138f7b52e5fe1d0c9d5989f72b9835560c5', S83F_TESTED = '67c80d513aa9de798e33814b963ee0e62ed7abad';
const DIVERGENT = '662c7847d3839c1ffd95dc8589d3d0d6ac100d67';
const HISTORICAL = {'ATL-141 RC (S7-IMP-003)': 'ef6e375ca947c34902ee1e366dd71e08914f7fa8', 'ATL-142 custody (S7-IMP-004/006)': 'dba6968b0bdf28b533f4efd765302796e6ebed58', 'ATL-141 release integrity (S7-IMP-021)': 'f0a5b90904c781ac721037be98f1ae71653e7551', 'ATL-175': 'dd32b8a4eabe3c8c08f2da305efd79738c11ecd3', 'divergent source': DIVERGENT};
const sh = (b) => crypto.createHash('sha256').update(b).digest('hex');
const inherited = ['tests/p6-2-canonical-workdefinition-compiler.mjs', 'tests/s8-2e-leaf-compiler-correction.mjs', 'tests/s8-2e-atl159-workdefinition-lineage.test.cjs', 'tests/s8-2a-atl171-operational-semantics.test.cjs', 'tests/s8-2b-atl171-schema-compatibility.test.cjs', 'tests/s8-2c-atl165-client-binding.test.cjs', 'tests/s8-2d-atl165-binding-schema.test.cjs', 'tests/s8-3b-atl159-ltl04-workdefinition.test.mjs', 'tests/s8-3c-malkom-package-readiness.test.mjs', 'tests/s8-3d-malkom-projection-boundary.test.mjs', 'tests/s8-3e-atl178-flow-bpmn.test.mjs'];
const certified = ['tests/p2-projection-boundary.mjs', 'tests/p3-universal-daughter-renderer.mjs', 'tests/p4-canvas-daughter-integration.mjs', 'tests/p5-ask-trace-governance.mjs', 'tests/v2-api-router-smoke.mjs', 'tests/v2-public-ip-boundary.mjs'];
const T = {rc: 'tests/s8-6-successor-rc.test.mjs', dau: 'tests/s8-6-dau-history-sync.test.mjs', rcMut: 'tests/s8-6-rc-mutations.test.mjs', dauMut: 'tests/s8-6-dau-mutations.test.mjs', s85b: 'tests/s8-5b-atl167-ltl04-deepen.test.mjs', s85a: 'tests/s8-5a-successor-retests.test.mjs', s84: 'tests/s8-4-interaction-rebinding.test.mjs', s83f: 'tests/s8-3f-governed-release-manifest.test.mjs'};
const nonGating = ['tests/v2-ui-browser-smoke.mjs', 'tests/v1.1.4-static-parity.mjs'];
const run = (args, cwd, env = {}, timeout = 1800000) => { const r = cp.spawnSync(process.execPath, args, {cwd, encoding: 'utf8', maxBuffer: 400000000, timeout, env: {...process.env, ...env}}); return {command: ['node', ...args], exitCode: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || ''}; };
const summaryOf = (r) => { try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return null; } };
const failCases = (r) => [...new Set((r.stdout.match(/^FAIL .+$/mg) || []).map((x) => x.slice(5, 140)))].sort();
const caseId = (c) => c.split(' ')[0];
const wtPath = (tag) => path.join(path.dirname(checkout), path.basename(checkout) + '-' + tag);
const inline = (code, cwd) => { const r = cp.spawnSync(process.execPath, ['--input-type=module', '-e', code], {cwd, encoding: 'utf8', maxBuffer: 400000000, timeout: 900000}); return {exitCode: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim()}; };
const lastJson = (s) => { try { return JSON.parse(s.trim().split('\n').pop()); } catch { return null; } };
const tmpBase = path.dirname(checkout);

const clean = git(['status', '--porcelain'], checkout) === '';
const testedTree = git(['rev-parse', head + '^{tree}']);

// ------------------------------------------------------------------------------------------------ gating suites at the RC (in the fresh checkout)
const rcSuite = run([T.rc], checkout); const rcSummary = summaryOf(rcSuite);
const dauSuite = run([T.dau], checkout); const dauSummary = summaryOf(dauSuite);
const results = [];
for (const t of inherited) results.push({group: 'S8-inherited', ...run([t], checkout)});
for (const t of certified) results.push({group: 'certified-donor-suite', ...run([t], checkout)});
const s85b = {group: 'S8-5B', ...run([T.s85b], checkout)}, s85a = {group: 'S8-5A', ...run([T.s85a], checkout)}, s84 = {group: 'S8-4', ...run([T.s84], checkout)}, s83f = {group: 'S8-3F', ...run([T.s83f], checkout)};
const s83fCli = {group: 'S8-3F-cli-check-reproduce', ...run(['scripts/s8-3f-release-manifest.mjs', '--check', '--reproduce'], checkout)};
const predecessors = [s85b, s85a, s84, s83f, s83fCli];

// ------------------------------------------------------------------------------------------------ comparison with the exact S8-5B base for every non-zero non-predecessor suite
const baseWt = wtPath('base'); git(['worktree', 'add', '--detach', baseWt, BASE], checkout);
const baseComparisons = [];
for (const r of results) {
  if (r.exitCode === 0) continue;
  const b = run(r.command.slice(1), baseWt); const tested = failCases(r), base = failCases(b);
  baseComparisons.push({suite: r.command[1], group: r.group, testedExit: r.exitCode, baseExit: b.exitCode, failingCasesOnTested: tested, failingCasesOnBase: base, newFailuresVsBase: tested.filter((c) => !base.includes(c)), identicalToBase: b.exitCode === r.exitCode && tested.every((c) => base.includes(c)) && base.every((c) => tested.includes(c))});
}
const nonGatingResults = nonGating.map((t) => { const a = run([t], checkout), b = run([t], baseWt); const tail = (x) => (x.stdout + x.stderr).trim().split('\n').slice(-3).join(' | ').slice(0, 300); return {test: t, testedCommitExitCode: a.exitCode, baseExitCode: b.exitCode, failureAlreadyPresentOnBase: b.exitCode !== 0, identicalOutcome: a.exitCode === b.exitCode, testedTail: tail(a), baseTail: tail(b)}; });
const cliBase = run(['scripts/s8-3f-release-manifest.mjs', '--check', '--reproduce'], baseWt);
git(['worktree', 'remove', '--force', baseWt], checkout);

// ------------------------------------------------------------------------------------------------ predecessor exact re-pass at their own accepted commits
const predecessorAt = (commit, test, tag) => { const wt = wtPath(tag); git(['worktree', 'add', '--detach', wt, commit], checkout); const r = run([test], wt); git(['worktree', 'remove', '--force', wt], checkout); return {commit, test, exitCode: r.exitCode, summary: summaryOf(r)}; };
const repass = {s84: predecessorAt(S84_TESTED, T.s84, 'p-s84'), s83f: predecessorAt(S83F_TESTED, T.s83f, 'p-s83f'), s85aTested: predecessorAt(S85A_TESTED, T.s85a, 'p-s85at'), s85aHead: predecessorAt(S85A_HEAD, T.s85a, 'p-s85ah'), s85bTested: predecessorAt(S85B_TESTED, T.s85b, 'p-s85bt'), s85bHead: predecessorAt(BASE, T.s85b, 'p-s85bh')};
const rp = (x, total) => x.exitCode === 0 && x.summary && x.summary.failed === 0 && x.summary.total === total;
const repassOk = rp(repass.s84, 34) && rp(repass.s83f, 63) && rp(repass.s85aTested, 47) && rp(repass.s85aHead, 47) && rp(repass.s85bTested, 33) && rp(repass.s85bHead, 33);

// ------------------------------------------------------------------------------------------------ mechanical reason probes for the expected successor-only failures
const numstat = (a, b, p) => git(['diff', '--numstat', a, b, '--', p], checkout);
const journeyDelta = (() => { const was = git(['show', '6c11bf4c89eaf212004beab7a939fd4cda38477c'], checkout).split('\n'), now = fs.readFileSync(path.join(checkout, 'assets/atl-140-v15-journey.mjs'), 'utf8').split('\n'); return {added: now.filter((l) => !was.includes(l)), removed: was.filter((l) => !now.includes(l))}; })();
const journeyDeltaOk = journeyDelta.added.length === 3 && journeyDelta.removed.length === 0 && journeyDelta.added.some((l) => l.includes('atl-s8-history-sync')) && journeyDelta.added.some((l) => l.includes('installHistorySync'));
const S85A_VS_RC = git(['diff', '--name-status', '--no-renames', S85A_HEAD, 'HEAD'], checkout).split('\n').filter(Boolean).map((l) => { const [st, p] = l.split('\t'); return {st, p}; });
const MOD_ALLOWED = (p) => ['api/atlas.js', 'assets/atl-140-v15-journey.mjs', '.vercelignore', 'release/baselines/v2-critical-hashes.json'].includes(p) || /^release\/packages\/(lab|stable)\//.test(p);
const modifiedVsS85a = S85A_VS_RC.filter((x) => x.st === 'M');
const modifiedSetOk = modifiedVsS85a.every((x) => MOD_ALLOWED(x.p)) && ['api/atlas.js', 'assets/atl-140-v15-journey.mjs'].every((p) => modifiedVsS85a.some((x) => x.p === p));
const deletionsOk = S85A_VS_RC.filter((x) => x.st === 'D').every((x) => /^release\/packages\/(lab|stable)\//.test(x.p));
// Exact replica of the S8-5B P01 scan (S8-5A head..HEAD, same three markers) plus the S8-6 divergent-source marker. Every hit must be explained:
//  (a) the file is byte-identical to the accepted S8-5B base at the same path, or
//  (b) it is a release/packages/<channel>/X copy byte-identical to the accepted base file X, or
//  (c) it is an S8-6 provenance/negative-test record on the explicit allow-list below.
const MARKERS = [['stale-wd-id', ['wd', '::road-ltl::LTL-04::v', '1'].join('')], ['stale-malkom-package-id', ['malkom-dw', '::road-ltl::LTL-04::v', '1'].join('')], ['stale-source-tip', '88bd3da8'], ['divergent-source-commit', DIVERGENT]];
const staleOffenders = [];
for (const x of S85A_VS_RC) { if (x.st === 'D' || /\.(b64|gz|png)$/.test(x.p) || x.p === 'tests/s8-5b-atl167-ltl04-deepen.test.mjs') continue; const f = path.join(checkout, x.p); if (!fs.existsSync(f)) continue; const t = fs.readFileSync(f, 'utf8'); const cur = gitTry(['hash-object', x.p], checkout);
  const pkgSrc = (x.p.match(/^release\/packages\/(?:lab|stable)\/(.+)$/) || [])[1];
  const sameAsBase = cur !== null && cur === gitTry(['rev-parse', BASE + ':' + x.p], checkout);
  const pkgCopyOfAccepted = !!pkgSrc && cur !== null && cur === gitTry(['rev-parse', BASE + ':' + pkgSrc], checkout);
  for (const [marker, s] of MARKERS) if (t.includes(s)) staleOffenders.push({path: x.p, marker, explainedBy: sameAsBase ? 'IDENTICAL_TO_ACCEPTED_BASE_BLOB' : pkgCopyOfAccepted ? 'PACKAGE_COPY_IDENTICAL_TO_ACCEPTED_BASE_BLOB:' + pkgSrc : null}); }
const STALE_ALLOWED = [
  {path: 'tests/s8-6-dau-history-sync.test.mjs', marker: 'stale-wd-id', reason: 'DAU negative tests inject the stale WD id as a protected value that the history module MUST reject'},
  {path: 'tests/s8-6-dau-history-sync.test.mjs', marker: 'stale-malkom-package-id', reason: 'DAU negative tests inject the stale package id as a protected value that the history module MUST reject'},
  {path: 'tests/s8-6-dau-mutations.test.mjs', marker: 'stale-malkom-package-id', reason: 'DAU mutation payload injects the stale package id; the module must reject it'},
  {path: 'lib/release/s8-6-successor-manifest.js', marker: 'divergent-source-commit', reason: 'pinned constant: provenance + EXCLUDED_DIVERGENT_DEPENDENCY record (never read)'},
  {path: 'release/custody/s8-6/custody-pins.json', marker: 'divergent-source-commit', reason: 'custody provenance record (origin of the committed copy; dependencyAfterCustody=false)'},
  {path: 'release/manifests/atlas-v1.5-successor-s8-rc.json', marker: 'divergent-source-commit', reason: 'exclusion + custody provenance records'},
  {path: 'release/manifests/atlas-v1.5-successor-s8-rc.json', marker: 'stale-wd-id', reason: 'exclusion/negative records and the permitted packaged-schema occurrence record'},
  {path: 'release/manifests/atlas-v1.5-successor-s8-rc.json', marker: 'stale-source-tip', reason: 'recorded as an excluded stale source tip (exclusion entry; the manifest pins it as NOT current)'},
  {path: 'lib/release/s8-6-release-control.js', marker: 'stale-wd-id', reason: 'drift-reconciliation notStale check (marker built by join, detects the stale id)'},
  {path: 'tests/s8-6-successor-rc.test.mjs', marker: 'stale-wd-id', reason: 'RC test asserts the permitted packaged-schema occurrence'},
  {path: 'tests/s8-6-rc-mutations.test.mjs', marker: 'stale-wd-id', reason: 'RC mutation payload'},
  {path: 'governance/product/s8-6-evidence/run-exact-qa.cjs', marker: 'divergent-source-commit', reason: 'this QA runner pins the divergent commit to prove its absence from the lineage-only clone'}
];
const allowedBy = (o) => o.explainedBy || ((STALE_ALLOWED.find((a) => a.path === o.path && a.marker === o.marker) || {}).reason ? 'ALLOW_LIST: ' + STALE_ALLOWED.find((a) => a.path === o.path && a.marker === o.marker).reason : null);
for (const o of staleOffenders) o.explainedBy = allowedBy(o);
const unallowedStale = staleOffenders.filter((o) => !o.explainedBy);
const staleP01Ok = unallowedStale.length === 0;
const schemaPkgBlobs = ['lab', 'stable'].map((ch) => gitTry(['hash-object', `release/packages/${ch}/data/contracts/atlas-client-binding-set-v1.schema.json`], checkout));
const schemaPinOk = schemaPkgBlobs.every((b) => b === '4e777a0504855bfc4f08c3eec2cd508050e95d34') && gitTry(['hash-object', 'data/contracts/atlas-client-binding-set-v1.schema.json'], checkout) === '4e777a0504855bfc4f08c3eec2cd508050e95d34';
const supersededAskCopies = git(['ls-files', '-s'], checkout).split('\n').filter((l) => l.includes('cb2bcfea0892adf5a871fb4584461b50729ab383')).length;
const s83fProbe = inline(`import fs from 'node:fs';import {integrityState,packageAskResidual,MANIFEST_PATH} from './lib/release/s8-release-manifest.js';const ri=integrityState(process.cwd());const askRes=packageAskResidual(process.cwd());const m=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));const rec=m.rollback.recoveryEvidence.gitContentAddressedArtifacts;import cp from 'node:child_process';const bad=Object.entries(rec).filter(([p,b])=>cp.execFileSync('git',['hash-object',p],{encoding:'utf8'}).trim()!==b).map(([p])=>p);console.log(JSON.stringify({integrity:ri.observedVerification.status,mismatched:ri.observedVerification.mismatchedCount,supersededAskCopies:askRes.affectedPaths.filter(a=>a.supersededAskApiBlob).length,currentAskCopies:askRes.affectedPaths.length,recoveryMismatches:bad}))`, checkout);
const s83fProbeJson = lastJson(s83fProbe.stdout);
const s83fReasonOk = !!s83fProbeJson && s83fProbeJson.integrity === 'PASSES_VERIFICATION' && s83fProbeJson.mismatched === 0 && s83fProbeJson.supersededAskCopies === 0 && s83fProbeJson.currentAskCopies === 6 && JSON.stringify(s83fProbeJson.recoveryMismatches) === JSON.stringify(['assets/atl-140-v15-journey.mjs']);
const idRec = JSON.parse(fs.readFileSync(path.join(checkout, 'governance/product/s8-5b-evidence/successor-identity.json'), 'utf8'));
const z05Probe = (() => { const out = []; for (const f of idRec.modifiedProductFiles || []) { const cur = gitTry(['hash-object', f.path], checkout); if (cur !== f.successorBlob) out.push(f.path); } return out; })();
const z05Ok = JSON.stringify(z05Probe) === JSON.stringify(['assets/atl-140-v15-journey.mjs']);

const byStd = (g) => ({s85b, s85a, s84, s83f, cli: s83fCli})[g];
const S85B_EXPECTED = ['Z01', 'Z02', 'Z05', 'P01', 'P02'], S85A_EXPECTED = ['V01', 'S01', 'S02', 'S03'], S84_EXPECTED = ['D01', 'P01', 'P04', 'S01', 'S02', 'S03'];
const S83F_EXPECTED = ['deterministic regeneration equals the committed manifest', 'verifier accepts the committed manifest', 'protected derivatives reproduce from the governed lineage', 'superseded Ask copies under release/packages are detected', 'release packages are untouched relative to the S8-4 base', 'S8-3F scope: changed paths', 'recovery evidence: every recovery artifact is identity-pinned', 'release integrity fails closed and the manifest does NOT certify the baseline'];
const exactSet = (failed, expected) => JSON.stringify(failed.map(caseId).sort()) === JSON.stringify([...expected].sort());
const s85bFailed = failCases(s85b), s85aFailed = failCases(s85a), s84Failed = failCases(s84), s83fFailed = failCases(s83f);
const s85bOk = exactSet(s85bFailed, S85B_EXPECTED) && modifiedSetOk && deletionsOk && journeyDeltaOk && staleP01Ok && schemaPinOk && z05Ok;
const S85A_S02_DIFF = git(['diff', '--name-only', 'a3e2dc1687a9dd8a290645a4ed77895fb39f97e7', 'HEAD', '--', 'release/manifests', 'governance/product/s8-3f-evidence', 'governance/product/s8-4-evidence', 'governance/product/s8-3e-evidence'], checkout).split('\n').filter(Boolean).sort();
const s85aS02Ok = JSON.stringify(S85A_S02_DIFF) === JSON.stringify(['release/manifests/atlas-v1.5-successor-s8-rc.json', 'release/manifests/atlas-v1.5-successor-s8-rollback.json']) && git(['rev-parse', 'HEAD:release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json'], checkout) === git(['rev-parse', BASE + ':release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json'], checkout);
const drift = inline(`import {generateEvidence} from './tests/s8-5a-support/evidence.mjs';import fs from 'node:fs';const g=await generateEvidence(process.cwd());const diffs=[];const walk=(x,y,p)=>{if(typeof x!=='object'||x===null||typeof y!=='object'||y===null){if(JSON.stringify(x)!==JSON.stringify(y))diffs.push([p,x,y]);return}for(const k of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[k],y[k],p+'.'+k)};let n=0;for(const [p,c] of Object.entries(g.files)){walk(JSON.parse(fs.readFileSync(p,'utf8')),JSON.parse(c),p);n++}console.log(JSON.stringify({files:n,diffs}))`, checkout);
const s85aDrift = lastJson(drift.stdout);
const s85aDriftOk = !!s85aDrift && s85aDrift.diffs.length === 1 && /atl-167-blocked-record\.json\.mechanicallyVerifiedEvidence\.tracked167Tests$/.test(s85aDrift.diffs[0][0]);
const s85aOk = exactSet(s85aFailed, S85A_EXPECTED) && modifiedSetOk && s85aS02Ok && s85aDriftOk;
const s84D01 = (s84.stdout.match(/^FAIL D01.*$/m) || [''])[0];
const s84Ok = exactSet(s84Failed, S84_EXPECTED) && /donor identity lost api\/atlas\.js/.test(s84D01) && !/donor identity lost (?!api\/atlas\.js)/.test(s84D01) && supersededAskCopies === 0 && schemaPinOk && modifiedSetOk;
const s83fOk = s83fFailed.length === S83F_EXPECTED.length && S83F_EXPECTED.every((e) => s83fFailed.some((c) => c.startsWith(e))) && s83fReasonOk && modifiedSetOk && deletionsOk;
let cliJson = null; try { cliJson = JSON.parse(s83fCli.stdout); } catch { /* */ }
const cliFailures = cliJson ? cliJson.failures.map((f) => f.code + ' ' + f.detail).sort() : null;
const EXPECTED_CLI = ['IDENTITY_MISMATCH interaction.atl-140-journey: recorded observed identity differs from the repository', 'IDENTITY_MISMATCH interaction.atl-140-journey: repository identity is MISMATCH', 'MANIFEST_DRIFT manifest differs from deterministic regeneration', 'RELEASE_INTEGRITY_STATE_DRIFT observedVerification differs from recomputation', 'ROLLBACK_RECOVERY_IDENTITY_DRIFT assets/atl-140-v15-journey.mjs'].sort();
const cliOk = !!cliJson && cliJson.reproduced === true && JSON.stringify(cliFailures) === JSON.stringify(EXPECTED_CLI);
s85b.classification = s85bOk && repassOk ? 'SUCCESSOR_ONLY_STAGE_LOCAL_IDENTITY_EVOLUTION' : 'FAIL';
s85a.classification = s85aOk && repassOk ? 'SUCCESSOR_ONLY_STAGE_LOCAL_EVOLUTION' : 'FAIL';
s84.classification = s84Ok && repassOk ? 'SUCCESSOR_ONLY_STAGE_LOCAL_IDENTITY_EVOLUTION' : 'FAIL';
s83f.classification = s83fOk && repassOk ? 'SUCCESSOR_ONLY_IDENTITY_EVOLUTION_AND_REMEDIATION_OF_RECORDED_DEFECTS' : 'FAIL';
s83fCli.classification = cliOk && repassOk ? 'SUCCESSOR_ONLY_STAGE_LOCAL_IDENTITY_EVOLUTION' : 'FAIL';
// S8-5A evidence generator drift: V01/S03 differ only because ATL-167 now has a successor test (tracked167Tests 0 -> 1) — identical to the S8-5B-stage classification.

// ------------------------------------------------------------------------------------------------ manifest determinism / verifier / custody / release integrity / packages
const cli1 = run(['scripts/s8-6-successor-manifest.mjs', '--check', '--reproduce'], checkout), cli2 = run(['scripts/s8-6-successor-manifest.mjs', '--check', '--reproduce'], checkout);
const cliS = [lastJsonMulti(cli1.stdout), lastJsonMulti(cli2.stdout)];
function lastJsonMulti(s) { try { return JSON.parse(s.slice(s.indexOf('{'))); } catch { return null; } }
const manifestPath = 'release/manifests/atlas-v1.5-successor-s8-rc.json';
const regenWt = wtPath('regen'); git(['worktree', 'add', '--detach', regenWt, head], checkout);
const regen = run(['scripts/s8-6-successor-manifest.mjs', '--write', '--reproduce'], regenWt);
const regenBytesEqual = fs.readFileSync(path.join(regenWt, manifestPath)).equals(fs.readFileSync(path.join(checkout, manifestPath)));
const assemble = run(['release/scripts/s8-6-assemble-release-control.mjs'], checkout);
const assembleJson = lastJsonMulti(assemble.stdout);
const buildTmp = fs.mkdtempSync(path.join(os.tmpdir(), 's8-6-qa-pkg-'));
const pkgRebuild = inline(`import path from 'node:path';import {buildPackages,verifyPackageDir,CHANNELS} from './lib/release/s8-6-package-builder.js';const root=process.cwd();const s=buildPackages(root,{outDir:${JSON.stringify(path.join(buildTmp, 'p'))}});const v={};for(const c of CHANNELS)v[c]={tree:s[c].treeSha256,fileCount:s[c].fileCount,inRepo:verifyPackageDir(root,c),rebuilt:verifyPackageDir(root,c,path.join(${JSON.stringify(path.join(buildTmp, 'p'))},c))};console.log(JSON.stringify({ok:CHANNELS.every(c=>v[c].inRepo.ok&&v[c].rebuilt.ok),v:Object.fromEntries(CHANNELS.map(c=>[c,{tree:v[c].tree,fileCount:v[c].fileCount,inRepoOk:v[c].inRepo.ok,rebuiltOk:v[c].rebuilt.ok,failures:v[c].inRepo.failures.concat(v[c].rebuilt.failures)}]))}))`, checkout);
const pkgRebuildJson = lastJson(pkgRebuild.stdout); fs.rmSync(buildTmp, {recursive: true, force: true});
const PKGCHECK = `const path=require('node:path');(async()=>{const dir=process.cwd();const call=async(mod,req)=>{let out={};const res={statusCode:200,setHeader(){},getHeader(){},end(b){out.body=b},status(c){this.statusCode=c;return this},json(b){out.body=JSON.stringify(b)},write(){}};await mod.default(req,res);out.status=res.statusCode;return out};const ri=await import(path.join(dir,'lib/api/release-integrity.js'));const r=await call(ri,{method:'GET',headers:{},query:{}});const b=JSON.parse(r.body||'{}');const router=await import(path.join(dir,'api/atlas.js'));const gd=await import(path.join(dir,'lib/api/governed-depth-summary.js'));console.log(JSON.stringify({status:r.status,ok:b.ok,files:(b.files||[]).length,bad:(b.files||[]).filter(x=>!x.ok).map(x=>x.rel),router:typeof router.default,governedDepth:typeof gd.default}))})().catch(e=>{console.log(JSON.stringify({error:e.message}));process.exit(1)})`;
const integrityAt = (cwd) => { const r = cp.spawnSync(process.execPath, ['-e', PKGCHECK], {cwd, encoding: 'utf8', timeout: 300000}); return lastJson(r.stdout || '') || {error: (r.stderr || '').slice(0, 300)}; };
const releaseIntegrity = {repoRoot: integrityAt(checkout), lab: integrityAt(path.join(checkout, 'release/packages/lab')), stable: integrityAt(path.join(checkout, 'release/packages/stable'))};
const riOk = Object.values(releaseIntegrity).every((x) => x.status === 200 && x.ok === true && x.bad && x.bad.length === 0 && x.router === 'function' && x.governedDepth === 'function' && x.files === 63);
const reproduceStandalone = inline(`import {reproduceFromCustody} from './lib/release/s8-6-successor-manifest.js';import {PROTECTED} from './lib/release/s8-release-manifest.js';const r=await reproduceFromCustody(process.cwd());console.log(JSON.stringify({all:PROTECTED.every(p=>r[p.id]===p.expected),count:PROTECTED.length,taskHash:r['source.task-hash']}))`, checkout);
const reproduceJson = lastJson(reproduceStandalone.stdout);

// ------------------------------------------------------------------------------------------------ LINEAGE-ONLY single-branch clone: no dependency on the divergent source commit / historical assemblies
let lineage = {skipped: 'branch not resolvable'};
if (branch && gitTry(['rev-parse', branch]) === head) {
  const lo = wtPath('lineage-only');
  cp.execFileSync('git', ['-c', 'safe.directory=' + repo, 'clone', '--no-local', '--single-branch', '--branch', branch, '--no-checkout', 'file://' + repo, lo], {stdio: 'pipe'});
  git(['checkout', '--detach', head], lo);
  const present = Object.fromEntries(Object.entries(HISTORICAL).map(([k, c]) => [k, gitTry(['cat-file', '-e', c + '^{commit}'], lo) !== null]));
  const loCli = run(['scripts/s8-6-successor-manifest.mjs', '--check', '--reproduce'], lo);
  const loRegen = run(['scripts/s8-6-successor-manifest.mjs', '--write', '--reproduce'], lo);
  const loBytes = fs.readFileSync(path.join(lo, manifestPath)).equals(fs.readFileSync(path.join(checkout, manifestPath)));
  const loStatus = git(['status', '--porcelain'], lo);
  const loRc = run([T.rc], lo); const loRcS = summaryOf(loRc);
  const loAssemble = run(['release/scripts/s8-6-assemble-release-control.mjs'], lo);
  const loRepro = inline(`import {reproduceFromCustody} from './lib/release/s8-6-successor-manifest.js';import {PROTECTED} from './lib/release/s8-release-manifest.js';const r=await reproduceFromCustody(process.cwd());console.log(JSON.stringify({all:PROTECTED.every(p=>r[p.id]===p.expected)}))`, lo);
  lineage = {branch, clonedFrom: 'file://repo --single-branch --no-local', historicalCommitsPresentInClone: present, noHistoricalOrDivergentCommitPresent: Object.values(present).every((v) => v === false),
    manifestCheckReproduce: lastJsonMulti(loCli.stdout) && {ok: lastJsonMulti(loCli.stdout).ok, failures: lastJsonMulti(loCli.stdout).failures, reproduced: lastJsonMulti(loCli.stdout).reproduced}, manifestRegeneratedByteIdenticalToCommitted: loBytes && loRegen.exitCode === 0 && loStatus === '',
    protectedDerivativesReproducedFromCustody: lastJson(loRepro.stdout)?.all === true, rcSuite: loRcS && {total: loRcS.total, passed: loRcS.passed, failed: loRcS.failed}, releaseControlCheck: lastJsonMulti(loAssemble.stdout)?.ok === true};
  lineage.ok = lineage.noHistoricalOrDivergentCommitPresent && loCli.exitCode === 0 && lineage.manifestRegeneratedByteIdenticalToCommitted && lineage.protectedDerivativesReproducedFromCustody && !!loRcS && loRcS.failed === 0 && lineage.releaseControlCheck;
  git(['worktree', 'prune'], checkout); fs.rmSync(lo, {recursive: true, force: true});
}
git(['worktree', 'remove', '--force', regenWt], checkout);

// ------------------------------------------------------------------------------------------------ mutation suites (RC filesystem mutations; DAU mutations)
const mutReport = path.join(path.dirname(output), path.basename(output) + '.mutations.tmp.json');
const rcMut = run([T.rcMut], checkout, {S8_6_MUT_REPORT: mutReport}); const rcMutS = summaryOf(rcMut);
let mutMatrix = null; try { mutMatrix = JSON.parse(fs.readFileSync(mutReport, 'utf8')); fs.rmSync(mutReport, {force: true}); } catch { /* */ }
const dauMut = run([T.dauMut], checkout, {S8_6_MUT_CONCURRENCY: '2'}); const dauMutS = summaryOf(dauMut);

// ------------------------------------------------------------------------------------------------ identity / scope
const idPaths = ['index.html', 'execution/ui/runtime-access-shell.js', 'assets/canvas-daughter-bridge-v2.0.1.mjs', 'canvas-v2/canvas-v2/index.html', 'canvas-v2/canvas-v2/assets/canvas-v2.css', 'canvas-v2/canvas-v2/assets/canvas-v2.js', 'runtime/universal-ask-atlas.js', 'lib/api/ask-atlas.js', 'lib/ask/p5-governed-retrieval.js', 'governance/ask-atlas-surface-contract-v1.json', 'api/atlas.js', 'lib/api/release-integrity.js', 'release/release-meta.js', 'assets/atl-167-v15-deepen-inspect.mjs', 'lib/api/governed-depth-summary.js', 'lib/projections/governed-depth-summary.js', 'release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json', 'lib/release/s8-release-manifest.js', 'scripts/s8-3f-release-manifest.mjs'];
const blobAt = (c, p) => gitTry(['rev-parse', c + ':' + p], checkout);
const identity = idPaths.map((p) => ({path: p, baseBlob: blobAt(BASE, p), testedBlob: blobAt('HEAD', p), unchanged: blobAt(BASE, p) === blobAt('HEAD', p)}));
const identityOk = identity.every((i) => i.unchanged);
const CLASSES = [
  ['DAU_REMEDIATION_MODULE', /^assets\/(atl-s8-history-sync|atl-140-v15-journey)\.mjs$/], ['DAU_REMEDIATION_TESTS', /^tests\/s8-6-(dau|support)/], ['DAU_REMEDIATION_EVIDENCE', /^governance\/product\/(S8_6_DAU_HISTORY_SYNC\.md|s8-6-evidence\/(run-dau-qa\.cjs|dau-exact-qa(-run1-contended-FAIL)?\.json|dau-qa-run-history\.md))$/],
  ['RC_GENERATOR', /^(lib\/release\/s8-6-|scripts\/s8-6-|release\/scripts\/s8-6-)/], ['RC_TESTS', /^tests\/s8-6-(successor-rc|rc-mutations)/], ['RC_CUSTODY', /^release\/custody\/s8-6\//], ['RC_DEPLOY_EXCLUSION', /^\.vercelignore$/],
  ['RC_RELEASE_CONTROL', /^(release\/baselines\/v2-critical-hashes\.json|release\/manifests\/atlas-v1\.5-successor-s8-(rc|rollback)\.json|governance\/product\/s8-6-evidence\/release-integrity-drift-reconciliation\.json)$/],
  ['RC_PACKAGES_REPLACED', /^release\/packages\/(lab|stable)\//], ['RC_EVIDENCE_AND_DOCS', /^governance\/product\/(S8_6_[A-Z_]+\.md|s8-6-evidence\/[^/]+)$/]
];
const changed = git(['diff', '--name-status', '--no-renames', BASE, 'HEAD'], checkout).split('\n').filter(Boolean).map((l) => { const [st, p] = l.split('\t'); const hit = CLASSES.find(([, re]) => re.test(p)); return {status: st, path: p, category: hit ? hit[0] : 'UNCLASSIFIED'}; });
const changedByCategory = Object.fromEntries([...new Set(changed.map((c) => c.category))].sort().map((k) => [k, changed.filter((c) => c.category === k).length]));
const scopeOk = changed.every((c) => c.category !== 'UNCLASSIFIED') && changed.filter((c) => c.status === 'D').every((c) => c.category === 'RC_PACKAGES_REPLACED') && changed.filter((c) => c.status === 'M').every((c) => ['DAU_REMEDIATION_MODULE', 'RC_DEPLOY_EXCLUSION', 'RC_RELEASE_CONTROL', 'RC_PACKAGES_REPLACED'].includes(c.category));
const workbookTouched = changed.filter((c) => /workbook|\.xlsx$|google/i.test(c.path) && !/^governance\/product\//.test(c.path) && !/^release\/packages\//.test(c.path)).map((c) => c.path);
const protectedChanged = git(['diff', '--name-only', BASE, 'HEAD', '--', 'governance/product/s8-3b-evidence', 'governance/product/s8-3c-evidence', 'governance/product/s8-3d-evidence', 'governance/product/s8-3e-evidence', 'governance/product/s8-3f-evidence', 'governance/product/s8-4-evidence', 'governance/product/s8-5a-evidence', 'governance/product/s8-5b-evidence', 'lib/compile'], checkout);
const nodeEngine = JSON.parse(fs.readFileSync(path.join(checkout, 'package.json'), 'utf8')).engines || null;
const fileHash = (p) => sh(fs.readFileSync(path.join(checkout, p)));

// ------------------------------------------------------------------------------------------------ verdict
const rcSuiteOk = rcSuite.exitCode === 0 && rcSummary && rcSummary.failed === 0 && rcSummary.total >= 80;
const dauOk = dauSuite.exitCode === 0 && dauSummary && dauSummary.failed === 0 && dauSummary.total >= 110;
const cleanSuites = results.filter((r) => r.exitCode !== 0);
const gatingFailures = cleanSuites.map((r) => r.command[1]);
const newFailuresVsBase = baseComparisons.filter((c) => !c.identicalToBase).map((c) => c.suite);
const rcMutOk = rcMut.exitCode === 0 && rcMutS && rcMutS.control === true && rcMutS.survived === 0 && rcMutS.detected === rcMutS.mutations && rcMutS.mutations >= 40;
const dauMutOk = dauMut.exitCode === 0 && dauMutS && dauMutS.failed === 0 && dauMutS.detected === dauMutS.mutations && dauMutS.mutations >= 21 && dauMutS.survived.length === 0;
const manifestOk = [cli1, cli2].every((c) => c.exitCode === 0) && cliS.every((j) => j && j.ok === true && j.reproduced === true && j.failures.length === 0) && regen.exitCode === 0 && regenBytesEqual;
const assembleOk = assemble.exitCode === 0 && assembleJson && assembleJson.ok === true && assembleJson.drift.unexplainedCount === 0 && assembleJson.drift.driftCount === 12;
const pkgOk = !!pkgRebuildJson && pkgRebuildJson.ok === true;
const custodyOk = !!reproduceJson && reproduceJson.all === true && reproduceJson.taskHash === 'b0bee64f418dcf99ccd60480c86dcd9dcd066231fe72ab7033c80994922b4e65' && fileHash('release/custody/s8-6/road-ltl-v1.4.governed-source.json') === 'c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4';
const nonGatingOk = nonGatingResults.every((n) => n.identicalOutcome);
const predecessorsOk = predecessors.every((p) => /^SUCCESSOR_ONLY/.test(p.classification)) && repassOk;
const pass = clean && rcSuiteOk && dauOk && gatingFailures.length === 0 && newFailuresVsBase.length === 0 && predecessorsOk && manifestOk && assembleOk && pkgOk && riOk && custodyOk && lineage.ok === true && rcMutOk && dauMutOk && identityOk && scopeOk && protectedChanged === '' && nonGatingOk;
const cases = (r) => (r.stdout.match(/^(PASS|FAIL) .+$/mg) || []);
const evidence = {schemaVersion: 's8-6-exact-qa-v1', stage: 'S8-6 successor RC / custody assembly (corrected; supersedes four historical REPLACE_ASSEMBLY assemblies)', testedCommit: head, testedTree, base: BASE, baseTree: BASE_TREE,
  nodeVersion: process.version, nodeEngineStated: nodeEngine && nodeEngine.node, platform: process.platform, architecture: process.arch, cpus: os.cpus().length,
  status: pass ? 'PASS' : 'FAIL',
  overallClassification: pass ? 'S8-6 PASS — successor RC assembled, internally consistent and frozen as a CANDIDATE ready for ATL-181 independent audit; NOT ATL-181 PASS, UAT, sign-off, promotion, deployment or runtime readiness' : 'S8-6 FAIL — SEE QA EVIDENCE',
  cleanFreshCheckout: clean,
  deploymentCandidateIdentity: {class: 'IDENTITY_ONLY_NOT_A_DEPLOYMENT', testedCommit: head, testedTree, successorManifest: {path: manifestPath, gitBlob: gitTry(['rev-parse', 'HEAD:' + manifestPath], checkout), sha256: fileHash(manifestPath)},
    rollbackManifest: {path: 'release/manifests/atlas-v1.5-successor-s8-rollback.json', gitBlob: gitTry(['rev-parse', 'HEAD:release/manifests/atlas-v1.5-successor-s8-rollback.json'], checkout), sha256: fileHash('release/manifests/atlas-v1.5-successor-s8-rollback.json')},
    sourceCustody: {path: 'release/custody/s8-6/road-ltl-v1.4.governed-source.json', gitBlob: gitTry(['rev-parse', 'HEAD:release/custody/s8-6/road-ltl-v1.4.governed-source.json'], checkout), sha256: fileHash('release/custody/s8-6/road-ltl-v1.4.governed-source.json')},
    integrityBaseline: {path: 'release/baselines/v2-critical-hashes.json', gitBlob: gitTry(['rev-parse', 'HEAD:release/baselines/v2-critical-hashes.json'], checkout), sha256: fileHash('release/baselines/v2-critical-hashes.json')},
    packages: Object.fromEntries(['lab', 'stable'].map((ch) => [ch, {path: 'release/packages/' + ch, packageManifestSha256: fileHash(`release/packages/${ch}/PACKAGE_MANIFEST.json`), treeSha256: JSON.parse(fs.readFileSync(path.join(checkout, `release/packages/${ch}/PACKAGE_MANIFEST.json`), 'utf8')).treeSha256, fileCount: JSON.parse(fs.readFileSync(path.join(checkout, `release/packages/${ch}/PACKAGE_MANIFEST.json`), 'utf8')).fileCount}])),
    successorIdentities: {journey: gitTry(['rev-parse', 'HEAD:assets/atl-140-v15-journey.mjs'], checkout), historyModule: gitTry(['rev-parse', 'HEAD:assets/atl-s8-history-sync.mjs'], checkout), router: gitTry(['rev-parse', 'HEAD:api/atlas.js'], checkout), root: gitTry(['rev-parse', 'HEAD:index.html'], checkout), shell: gitTry(['rev-parse', 'HEAD:execution/ui/runtime-access-shell.js'], checkout)}},
  rcSuite: {...rcSummary, cases: cases(rcSuite)},
  dauBrowserRetestOnRc: {exitCode: dauSuite.exitCode, total: dauSummary && dauSummary.total, passed: dauSummary && dauSummary.passed, failed: dauSummary && dauSummary.failed, rootLoadRaceTolerated: dauSummary && dauSummary.rootLoadRaceTolerated, browser: dauSummary && {engine: dauSummary.browser, executable: dauSummary.browserExecutable}, failingCases: failCases(dauSuite)},
  suites: {total: results.length + 2, passed: results.filter((r) => r.exitCode === 0).length + [rcSuite, dauSuite].filter((r) => r.exitCode === 0).length, gatingFailures, newFailuresVsBase},
  predecessorSuites: {s8_5b: {failingCases: s85bFailed, expected: S85B_EXPECTED, classification: s85b.classification}, s8_5a: {failingCases: s85aFailed, expected: S85A_EXPECTED, s02DiffSet: S85A_S02_DIFF, s02Ok: s85aS02Ok, classification: s85a.classification}, s8_4: {failingCases: s84Failed, expected: S84_EXPECTED, classification: s84.classification, d01: s84D01.slice(0, 200)},
    s8_3f: {failingCases: s83fFailed, expectedPrefixes: S83F_EXPECTED, classification: s83f.classification, reasonProbe: s83fProbeJson, cliCheckFailures: cliFailures, cliExpected: EXPECTED_CLI, cliClassification: s83fCli.classification, cliCleanAtBase: (() => { try { return JSON.parse(cliBase.stdout).ok === true; } catch { return null; } })()},
    probes: {journeyDeltaVsS85bJourney: {added: journeyDelta.added.length, removed: journeyDelta.removed.length, ok: journeyDeltaOk}, modifiedPathsVsS85aHead: modifiedVsS85a.map((x) => x.p).length, modifiedSetOk, deletionsOnlyUnderReplacedPackages: deletionsOk, staleIdOffenders: staleOffenders, staleIdOffendersAllPermitted: staleP01Ok, packagedSchemaPinOk: schemaPinOk, supersededAskBlobCopiesInTree: supersededAskCopies, z05DriftedProductFiles: z05Probe, s85aEvidenceGeneratorDrift: s85aDrift},
    exactCommitRepass: repass, exactCommitRepassOk: repassOk, explanation: 'S8-6 legitimately evolves identities previously pinned by predecessor suites (journey, router, release packages, baseline, deploy exclusions) and repairs two defects the S8-3F suite pinned as recorded residuals (stale Ask copies in release/packages; failing release-integrity baseline). Each predecessor suite is unmodified; it fails here only on the expected stage-local cases and passes in full at its own accepted commit.'},
  manifest: {checkReproduceRuns: cliS.map((j) => ({ok: j && j.ok, entries: j && j.entries, failures: j && j.failures, reproduced: j && j.reproduced})), regenerationInCleanWorktreeByteIdentical: regenBytesEqual, releaseControlCheck: assembleJson, protectedDerivativesFromCustody: reproduceJson},
  packages: pkgRebuildJson, releaseIntegrity: {perLocation: releaseIntegrity, allPass: riOk},
  lineageOnlyClone: lineage,
  mutationSuites: {rc: {exitCode: rcMut.exitCode, ...rcMutS}, dau: dauMutS ? {exitCode: dauMut.exitCode, total: dauMutS.total, passed: dauMutS.passed, mutations: dauMutS.mutations, detected: dauMutS.detected, survived: dauMutS.survived} : {exitCode: dauMut.exitCode, error: (dauMut.stdout + dauMut.stderr).slice(-800)}, rcMatrix: mutMatrix},
  baseComparisons, nonGatingPreExistingFailures: nonGatingResults,
  results: results.map(({stdout, stderr, ...r}) => ({...r, summary: summaryOf({stdout}), failingCases: failCases({stdout}), stderrTail: (stderr || '').trim().split('\n').slice(-3).join(' | ').slice(0, 300)})),
  identity: {unchangedProofVsS85bHead: identity, allUnchanged: identityOk, priorEvidenceAndCompileChangedPaths: protectedChanged === '' ? [] : protectedChanged.split('\n'), workbookPathsTouched: workbookTouched},
  changedPathsVsS85bHead: {byCategory: changedByCategory, scopeOk, total: changed.length, paths: changed},
  environmentVariance: {node: process.version, engineStated: nodeEngine && nodeEngine.node, note: 'QA ran on Node ' + process.version + ' while package.json engines state ' + (nodeEngine && nodeEngine.node) + '; chromium from /opt/pw-browsers; ' + os.cpus().length + ' CPUs; browser suites are timing-sensitive under CPU load (see dau-qa-run-history.md).'},
  residuals: ['No deployment identity exists; deployment rollback identity NOT_ESTABLISHED (none inferred).', 'Root init-order defect (stage15RenderContract is not defined) and root load-time race are pre-existing in the unchanged root; compensated/tolerated narrowly and counted (DAU evidence).', 'Share-link serialization cannot encode A4 vs A5; history overlays reset on traversal.', 'Deployment bundling of governed-depth-summary is verified in-package only, not on a deployment.', 'LTL-04 Daughter/execution-depth/Ask paths return 404 by design (ATL-157 not materialized).', 'ATL-71, F-130-06, ATL-107, generalized v2 interaction, runtime-readiness profiles and v2 BOL/FIRI are DEFERRED_NOT_PASS.', 'DEF-GOV-002 preserved open; DEF-DAU-007 remediated pending ATL-181 independent audit; DEF-REL-ASSET-001 closed for the S8 portion only.', 'S8-3B closure-row QA hash discrepancy remains recorded; ATL-141 moving-tip assumption noted.', 'Seven of twelve release-integrity drifted files were last changed by the pre-S8 v2.1.0 RC1 history (authorized by ancestry through the accepted base; flagged for ATL-181).', 'The first DAU exact-QA run at e0a1ce28 FAILED once (R02 diagnostic probe under load) before the idle rerun PASSED; both are preserved.']};
fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({status: evidence.status, testedCommit: head, testedTree, rc: rcSummary && rcSummary.passed + '/' + rcSummary.total, dau: dauSummary && dauSummary.passed + '/' + dauSummary.total, suites: evidence.suites, predecessors: {s85b: s85b.classification, s85a: s85a.classification, s84: s84.classification, s83f: s83f.classification, cli: s83fCli.classification, repassOk}, manifestOk, assembleOk, pkgOk, riOk, custodyOk, lineageOnly: lineage.ok, rcMut: rcMutS && rcMutS.detected + '/' + rcMutS.mutations, dauMut: dauMutS && dauMutS.detected + '/' + dauMutS.mutations, identityOk, scopeOk, nonGatingOk, clean}));
if (!pass) process.exitCode = 1;
