import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveReadiness, attachRunContext } from '../lib/readiness/readiness-resolver.mjs';
import { semanticResultHash, canonicalHash } from '../lib/readiness/canonicalize.mjs';

// Atlas AR0.3 — F2 golden fixture test vectors (contract §8) plus negative fixtures for
// every false-positive path found during ChatGPT implementation QA.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'ar0-3-readiness');
const CONFIG = {
  ruleset_version: 'readiness-ruleset-v1',
  canonicalization_profile: 'canonical-json-sha256-v1',
  resolver_commit: 'test-harness-pinned'
};

let passed = 0, failed = 0;
const failures = [];
const load = name => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));

function check(label, condition, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}
const hasType = (r, t) => r.blockers.some(b => b.blocker_type === t);
const run = (m, c = CONFIG) => resolveReadiness(m, c);

console.log('\nAtlas AR0.3 — Readiness Resolver v2 — contract §8 vectors + QA negative paths\n');

console.log('--- contract §8 test vectors ---');
{
  const r = run(load('tv01-domain-ready.json'));
  check('TV-1  positive DOMAIN readiness returns READY', r.result === 'READY', `got ${r.result}`);
  check('TV-1  no blockers on READY', r.blockers.length === 0);
  check('TV-1  lifecycle is CANDIDATE, never self-promoted', r.lifecycle === 'CANDIDATE');
  check('TV-1  proof carries recoverable input identities + locations',
    r.input_object_identities.length === 2 && r.input_object_identities.every(i => i.authoritative_location_ref));
  check('TV-1  proof pins resolver/ruleset/profile identity',
    r.identity.resolver_commit === 'test-harness-pinned' &&
    r.identity.ruleset_version === 'readiness-ruleset-v1' &&
    r.identity.canonicalization_profile === 'canonical-json-sha256-v1');
}
{
  const r = run(load('tv02-domain-semantic-gap.json'));
  check('TV-2  open mandatory gap returns NOT_READY (not BLOCKED)', r.result === 'NOT_READY', `got ${r.result}`);
  check('TV-2  gap surfaced', hasType(r, 'SEMANTIC_GAP'));
}
{
  const r = run(load('tv03-dependency-missing.json'));
  check('TV-3  missing dependency returns BLOCKED', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-3  closure failure identified', hasType(r, 'DEPENDENCY_CLOSURE_INCOMPLETE'));
}
{
  const r = run(load('tv04-dependency-floating.json'));
  check('TV-4  floating dependency returns BLOCKED', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-4  floating identity identified', hasType(r, 'FLOATING_IDENTITY'));
}
{
  const r = run(load('tv05-enterprise-binding-missing.json'));
  check('TV-5  unresolved binding returns NOT_READY', r.result === 'NOT_READY', `got ${r.result}`);
  check('TV-5  predecessor DOMAIN recorded READY',
    r.predecessor_proofs.some(p => p.state === 'DOMAIN_EXECUTION_READY' && p.result === 'READY'));
  check('TV-5  binding blocker surfaced', hasType(r, 'BINDING_UNRESOLVED'));
}
{
  const r = run(load('tv06-enterprise-blocked-by-domain.json'));
  check('TV-6  domain NOT_READY blocks enterprise', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-6  monotonicity failure recorded', r.monotonicity_check.passed === false);
  check('TV-6  enterprise criteria never evaluated',
    !hasType(r, 'BINDING_UNRESOLVED') && r.rule_evaluations.length === 0);
  check('TV-6  root cause propagated (retained V1 fix)', hasType(r, 'SEMANTIC_GAP'));
}
{
  const r = run(load('tv07-na-unauthorized.json'));
  check('TV-7  unauthorized waiver returns BLOCKED', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-7  unauthorized waiver identified', hasType(r, 'UNAUTHORIZED_NOT_APPLICABLE'));
}
{
  const r = run(load('tv08-na-governed.json'));
  check('TV-8  authorized waiver naming a waivable rule permits READY', r.result === 'READY', `got ${r.result}`);
  check('TV-8  no unresolved-binding blocker', !hasType(r, 'BINDING_UNRESOLVED'));
}
{
  const r = run(load('tv09-runtime-gap.json'));
  check('TV-9  open runtime gap returns NOT_READY', r.result === 'NOT_READY', `got ${r.result}`);
  check('TV-9  runtime gap surfaced', hasType(r, 'RUNTIME_GAP'));
  check('TV-9  full predecessor chain READY', r.predecessor_proofs.length === 2 && r.predecessor_proofs.every(p => p.result === 'READY'));
}
{
  const r = run(load('tv10-runtime-blocked-by-enterprise.json'));
  check('TV-10 enterprise NOT_READY blocks runtime', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-10 runtime criteria never evaluated', !hasType(r, 'RUNTIME_GAP'));
}
{
  const r = run(load('tv11-lineage-mismatch.json'));
  check('TV-11 foreign predecessor proof returns BLOCKED', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-11 lineage mismatch identified', hasType(r, 'LINEAGE_MISMATCH'));
}
{
  const a = run(load('tv01-domain-ready.json'));
  const b = run(load('tv01-domain-ready.json'));
  check('TV-12 identical inputs produce identical semantic hash', a.semantic_result_hash === b.semantic_result_hash);
  const ctxA = attachRunContext(a, { evaluation_run_id: 'run-aaa', evaluation_timestamp: '2020-01-01T00:00:00Z' });
  const ctxB = attachRunContext(b, { evaluation_run_id: 'run-zzz', evaluation_timestamp: '2099-12-31T23:59:59Z' });
  check('TV-12 run metadata does not affect semantic hash', semanticResultHash(ctxA) === semanticResultHash(ctxB));
  check('TV-12 environment identity recorded but excluded from hash',
    ctxA.environment.runtime.startsWith('node ') && semanticResultHash(ctxA) === a.semantic_result_hash);
  check('TV-12 run metadata retained for audit', ctxA.run_metadata.evaluation_run_id === 'run-aaa');
}
{
  const base = run(load('tv01-domain-ready.json'));
  const changed = run(load('tv13-successor-input-changed.json'));
  check('TV-13 changed semantic input yields different hash', base.semantic_result_hash !== changed.semantic_result_hash);
  check('TV-13 changed semantic input yields different proof_id', base.proof_id !== changed.proof_id);
  // CORRECTED: previously this asserted "changed ruleset" while holding ruleset_version constant.
  check('TV-13 changed resolver identity yields different hash',
    run(load('tv01-domain-ready.json'), { ...CONFIG, resolver_commit: 'different-commit' }).semantic_result_hash
      !== base.semantic_result_hash);
  check('TV-13 unknown ruleset cannot silently reinterpret: blocks instead',
    run(load('tv01-domain-ready.json'), { ...CONFIG, ruleset_version: 'readiness-ruleset-v2' }).result === 'BLOCKED');
}
{
  const expected = run(load('tv01-domain-ready.json')).semantic_result_hash;
  const probe = path.join(HERE, '.recovery-probe.mjs');
  fs.writeFileSync(probe, `
    import fs from 'node:fs';
    import { resolveReadiness } from '${path.join(HERE, '..', 'lib', 'readiness', 'readiness-resolver.mjs')}';
    const m = JSON.parse(fs.readFileSync('${path.join(FIXTURES, 'tv01-domain-ready.json')}', 'utf8'));
    process.stdout.write(resolveReadiness(m, ${JSON.stringify(CONFIG)}).semantic_result_hash);
  `);
  try {
    const recovered = execFileSync('node', [probe], { encoding: 'utf8' }).trim();
    check('TV-14 fresh process reproduces hash from frozen artifacts alone', recovered === expected);
  } finally { fs.unlinkSync(probe); }
}

console.log('\n--- negative fixtures: false-positive paths closed ---');
{
  const r = run(load('neg01-empty-scope.json'));
  check('NEG-1 empty scope no longer proves READY', r.result !== 'READY', `got ${r.result}`);
  check('NEG-1 failure is coverage-based, not absence-based', hasType(r, 'SEMANTIC_COVERAGE_INCOMPLETE'));
}
check('NEG-2 absent objects inventory blocks', run(load('neg02-inventory-objects-absent.json')).result === 'BLOCKED');
check('NEG-3 absent bindings inventory blocks', run(load('neg03-inventory-bindings-absent.json')).result === 'BLOCKED');
check('NEG-4 absent dependencies inventory blocks', run(load('neg04-inventory-dependencies-absent.json')).result === 'BLOCKED');
{
  const r = run(load('neg05-dependency-status-unrecognized.json'));
  check('NEG-5 unrecognized dependency status blocks (allow-list)', r.result === 'BLOCKED', `got ${r.result}`);
  check('NEG-5 identified as closure failure', hasType(r, 'DEPENDENCY_CLOSURE_INCOMPLETE'));
}
check('NEG-6 absent dependency hash blocks', run(load('neg06-dependency-hash-absent.json')).result === 'BLOCKED');
{
  const r = run(load('neg07-gap-mandatory-unstated.json'));
  check('NEG-7 gap without explicit mandatory flag blocks (no implicit default)', r.result === 'BLOCKED', `got ${r.result}`);
}
{
  const r = run(load('neg08-coverage-incomplete.json'));
  check('NEG-8 uncovered required semantic class returns NOT_READY', r.result === 'NOT_READY', `got ${r.result}`);
  check('NEG-8 names the missing class', r.blockers.some(b => b.blocker_id.includes('exception-recovery')));
}
{
  const r = run(load('neg09-coverage-overclaimed.json'));
  check('NEG-9 overclaimed coverage returns NOT_READY', r.result === 'NOT_READY', `got ${r.result}`);
  check('NEG-9 overclaim identified', hasType(r, 'COVERAGE_OVERCLAIMED'));
}
check('NEG-10 unauthorized attestation authority blocks', run(load('neg10-attestation-unauthorized.json')).result === 'BLOCKED');
{
  const r = run(load('neg11-governed-scope-upstream-unfrozen.json'));
  check('NEG-11 real governed scope BLOCKS until upstream contracts frozen', r.result === 'BLOCKED', `got ${r.result}`);
  check('NEG-11 reason is upstream contracts unfrozen', hasType(r, 'UPSTREAM_CONTRACTS_UNFROZEN'));
}
check('NEG-12 absent runtime requirements inventory blocks', run(load('neg12-runtime-inventories-absent.json')).result === 'BLOCKED');
{
  const r = run(load('neg13-runtime-requirement-open.json'));
  check('NEG-13 open runtime requirement returns NOT_READY', r.result === 'NOT_READY', `got ${r.result}`);
  check('NEG-13 requirement surfaced', hasType(r, 'RUNTIME_REQUIREMENT_OPEN'));
}
check('NEG-14 object without authoritative location blocks', run(load('neg14-object-location-absent.json')).result === 'BLOCKED');

console.log('\n--- canonicalization: ordered vs unordered collections ---');
{
  const a = load('tv01-domain-ready.json');
  const b = load('tv01-domain-ready.json'); b.objects.reverse();
  check('PERM-1 permuted objects (unordered set) hash identically',
    run(a).semantic_result_hash === run(b).semantic_result_hash);

  const c = load('tv01-domain-ready.json');
  c.dependencies = [...c.dependencies, { dependency_id: 'contract-second', dependency_version: '1.0.0',
    dependency_hash: 'sha256:second', status: 'PRESENT_VERIFIED', authoritative_location_ref: 'github://dep/second@abc' }];
  const d = JSON.parse(JSON.stringify(c)); d.dependencies.reverse();
  check('PERM-2 permuted dependencies hash identically', run(c).semantic_result_hash === run(d).semantic_result_hash);

  const e = load('tv01-domain-ready.json');
  e.objects[0].semantic_classes = ['action', 'trigger']; // reversed order, same set
  check('PERM-3 permuted semantic_classes hash identically', run(e).semantic_result_hash === run(a).semantic_result_hash);

  const f = load('tv02-domain-semantic-gap.json');
  const g = JSON.parse(JSON.stringify(f));
  g.objects[0].semantic_gaps.push({ gap_id: 'gap:second', mandatory: true, status: 'OPEN', description: 'second gap' });
  f.objects[0].semantic_gaps.push({ gap_id: 'gap:second', mandatory: true, status: 'OPEN', description: 'second gap' });
  g.objects[0].semantic_gaps.reverse();
  check('PERM-4 permuted gaps produce identical blockers hash',
    run(f).semantic_result_hash === run(g).semantic_result_hash);

  check('PERM-5 ordered predecessor_proofs are NOT reordered',
    canonicalHash({ predecessor_proofs: [{ state: 'A' }, { state: 'B' }] })
      !== canonicalHash({ predecessor_proofs: [{ state: 'B' }, { state: 'A' }] }));
}

console.log('\n--- configuration and fail-closed guards ---');
check('GUARD null manifest blocks', run(null).result === 'BLOCKED');
check('GUARD unknown target blocks', run({ ...load('tv01-domain-ready.json'), target_readiness_state: 'TOTALLY_READY' }).result === 'BLOCKED');
check('GUARD unknown ruleset blocks', run(load('tv01-domain-ready.json'), { ...CONFIG, ruleset_version: 'made-up' }).result === 'BLOCKED');
check('GUARD unknown canonicalization profile blocks',
  run(load('tv01-domain-ready.json'), { ...CONFIG, canonicalization_profile: 'made-up-profile' }).result === 'BLOCKED');
check('GUARD absent resolver identity blocks',
  run(load('tv01-domain-ready.json'), { ...CONFIG, resolver_commit: null }).result === 'BLOCKED');
check('GUARD floating resolver identity blocks',
  run(load('tv01-domain-ready.json'), { ...CONFIG, resolver_commit: 'latest' }).result === 'BLOCKED');
check('GUARD absent scope_class blocks',
  run((() => { const m = load('tv01-domain-ready.json'); delete m.scope_class; return m; })()).result === 'BLOCKED');
check('GUARD dangling reference blocks',
  run((() => { const m = load('tv01-domain-ready.json'); m.objects[0].references = ['nope']; return m; })()).result === 'BLOCKED');
check('GUARD missing provenance prevents READY',
  run((() => { const m = load('tv01-domain-ready.json'); delete m.objects[0].provenance_ref; return m; })()).result === 'NOT_READY');
check('GUARD undeclared semantic_gaps inventory blocks',
  run((() => { const m = load('tv01-domain-ready.json'); delete m.objects[0].semantic_gaps; return m; })()).result === 'BLOCKED');
check('GUARD undeclared semantic_classes blocks',
  run((() => { const m = load('tv01-domain-ready.json'); delete m.objects[0].semantic_classes; return m; })()).result === 'BLOCKED');
check('GUARD attestation with empty required classes blocks',
  run((() => { const m = load('tv01-domain-ready.json'); m.semantic_coverage_attestation.required_semantic_classes = []; return m; })()).result === 'BLOCKED');

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) { console.log('Failures:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
