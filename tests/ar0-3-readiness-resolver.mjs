import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveReadiness, attachRunMetadata } from '../lib/readiness/readiness-resolver.mjs';
import { semanticResultHash } from '../lib/readiness/canonicalize.mjs';

// Atlas AR0.3 — F2 golden fixture test vectors.
// Implements the 14 vectors mandated by READINESS_VERIFICATION_CONTRACT §8.
// These prove behavior, not merely that the module parses.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'ar0-3-readiness');
const CONFIG = { ruleset_version: 'readiness-ruleset-v1', resolver_commit: 'test-harness' };

let passed = 0;
let failed = 0;
const failures = [];

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function hasBlockerType(result, type) {
  return result.blockers.some(b => b.blocker_type === type);
}

console.log('\nAtlas AR0.3 — Readiness Resolver, contract §8 test vectors\n');

// TV-1 — exact positive DOMAIN readiness
{
  const r = resolveReadiness(load('tv01-domain-ready.json'), CONFIG);
  check('TV-1  positive DOMAIN readiness returns READY', r.result === 'READY', `got ${r.result}`);
  check('TV-1  no blockers on a READY result', r.blockers.length === 0, `${r.blockers.length} blockers`);
  check('TV-1  proof carries semantic_result_hash', typeof r.semantic_result_hash === 'string' && r.semantic_result_hash.length === 64);
  check('TV-1  lifecycle is CANDIDATE, never self-promoted', r.lifecycle === 'CANDIDATE', `got ${r.lifecycle}`);
}

// TV-2 — open reusable semantic gap -> NOT_READY (validly evaluated, criteria fail)
{
  const r = resolveReadiness(load('tv02-domain-semantic-gap.json'), CONFIG);
  check('TV-2  open semantic gap returns NOT_READY (not BLOCKED)', r.result === 'NOT_READY', `got ${r.result}`);
  check('TV-2  gap surfaced as SEMANTIC_GAP blocker', hasBlockerType(r, 'SEMANTIC_GAP'));
}

// TV-3 — missing/unreadable dependency -> BLOCKED
{
  const r = resolveReadiness(load('tv03-dependency-missing.json'), CONFIG);
  check('TV-3  missing dependency returns BLOCKED (not NOT_READY)', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-3  dependency closure failure identified', hasBlockerType(r, 'DEPENDENCY_CLOSURE_INCOMPLETE'));
}

// TV-4 — floating 'latest' dependency -> BLOCKED
{
  const r = resolveReadiness(load('tv04-dependency-floating.json'), CONFIG);
  check('TV-4  floating "latest" dependency returns BLOCKED', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-4  floating identity identified', hasBlockerType(r, 'FLOATING_IDENTITY'));
}

// TV-5 — enterprise binding missing while domain READY -> ENTERPRISE NOT_READY
{
  const r = resolveReadiness(load('tv05-enterprise-binding-missing.json'), CONFIG);
  check('TV-5  unresolved binding returns NOT_READY', r.result === 'NOT_READY', `got ${r.result}`);
  check('TV-5  predecessor DOMAIN proof recorded as READY',
    r.predecessor_proofs.some(p => p.state === 'DOMAIN_EXECUTION_READY' && p.result === 'READY'));
  check('TV-5  binding surfaced as BINDING_UNRESOLVED', hasBlockerType(r, 'BINDING_UNRESOLVED'));
}

// TV-6 — domain NOT_READY -> enterprise BLOCKED (monotonicity)
{
  const r = resolveReadiness(load('tv06-enterprise-blocked-by-domain.json'), CONFIG);
  check('TV-6  domain NOT_READY blocks enterprise', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-6  monotonicity_check reports failure', r.monotonicity_check.passed === false);
  check('TV-6  causal predecessor blocker present', hasBlockerType(r, 'PREDECESSOR_NOT_READY'));
  check('TV-6  enterprise criteria NEVER evaluated when blocked',
    !hasBlockerType(r, 'BINDING_UNRESOLVED') && r.rule_evaluations.length === 0,
    'enterprise rules must not run over an unresolved predecessor');
}

// TV-7 — unauthorized NOT_APPLICABLE -> BLOCKED
{
  const r = resolveReadiness(load('tv07-na-unauthorized.json'), CONFIG);
  check('TV-7  unauthorized NOT_APPLICABLE returns BLOCKED', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-7  unauthorized waiver identified', hasBlockerType(r, 'UNAUTHORIZED_NOT_APPLICABLE'));
}

// TV-8 — governed NOT_APPLICABLE accepted under correct authority
{
  const r = resolveReadiness(load('tv08-na-governed.json'), CONFIG);
  check('TV-8  governed NOT_APPLICABLE permits READY', r.result === 'READY', `got ${r.result}`);
  check('TV-8  no unresolved-binding blocker raised', !hasBlockerType(r, 'BINDING_UNRESOLVED'));
}

// TV-9 — runtime capability gap -> RUNTIME NOT_READY
{
  const r = resolveReadiness(load('tv09-runtime-gap.json'), CONFIG);
  check('TV-9  open runtime gap returns NOT_READY', r.result === 'NOT_READY', `got ${r.result}`);
  check('TV-9  runtime gap surfaced', hasBlockerType(r, 'RUNTIME_GAP'));
  check('TV-9  full predecessor chain recorded (DOMAIN + ENTERPRISE)',
    r.predecessor_proofs.length === 2 && r.predecessor_proofs.every(p => p.result === 'READY'),
    `chain=${JSON.stringify(r.predecessor_proofs.map(p => [p.state, p.result]))}`);
}

// TV-10 — enterprise NOT_READY -> runtime BLOCKED
{
  const r = resolveReadiness(load('tv10-runtime-blocked-by-enterprise.json'), CONFIG);
  check('TV-10 enterprise NOT_READY blocks runtime', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-10 monotonicity failure recorded', r.monotonicity_check.passed === false);
  check('TV-10 runtime criteria never evaluated', !hasBlockerType(r, 'RUNTIME_GAP'));
}

// TV-11 — hash/lineage mismatch -> BLOCKED
{
  const r = resolveReadiness(load('tv11-lineage-mismatch.json'), CONFIG);
  check('TV-11 predecessor proof from another baseline returns BLOCKED', r.result === 'BLOCKED', `got ${r.result}`);
  check('TV-11 lineage mismatch identified', hasBlockerType(r, 'LINEAGE_MISMATCH'));
}

// TV-12 — determinism across clean runs
{
  const m = load('tv01-domain-ready.json');
  const a = resolveReadiness(m, CONFIG);
  const b = resolveReadiness(load('tv01-domain-ready.json'), CONFIG);
  check('TV-12 identical frozen inputs produce identical semantic hash',
    a.semantic_result_hash === b.semantic_result_hash,
    `${a.semantic_result_hash?.slice(0, 12)} vs ${b.semantic_result_hash?.slice(0, 12)}`);

  // Run metadata must NOT perturb the semantic hash — the correction ChatGPT made to the draft.
  const withMetaA = attachRunMetadata(a, { evaluation_run_id: 'run-aaa', evaluation_timestamp: '2020-01-01T00:00:00Z' });
  const withMetaB = attachRunMetadata(b, { evaluation_run_id: 'run-zzz', evaluation_timestamp: '2099-12-31T23:59:59Z' });
  check('TV-12 differing run metadata does not change the semantic hash',
    semanticResultHash(withMetaA) === semanticResultHash(withMetaB));
  check('TV-12 run metadata is still retained for audit',
    withMetaA.run_metadata.evaluation_run_id === 'run-aaa');

  // Key insertion order must not affect the hash.
  const reordered = JSON.parse(JSON.stringify(m));
  const flipped = { target_readiness_state: reordered.target_readiness_state, objects: reordered.objects,
    dependencies: reordered.dependencies, scope_version: reordered.scope_version, scope_id: reordered.scope_id,
    binding_requirements: reordered.binding_requirements, not_applicable_decisions: reordered.not_applicable_decisions,
    predecessor_proofs: reordered.predecessor_proofs };
  check('TV-12 key insertion order does not change the semantic hash',
    resolveReadiness(flipped, CONFIG).semantic_result_hash === a.semantic_result_hash);
}

// TV-13 — changed semantic input produces a successor identity, never an overwrite
{
  const base = resolveReadiness(load('tv01-domain-ready.json'), CONFIG);
  const changed = resolveReadiness(load('tv13-successor-input-changed.json'), CONFIG);
  check('TV-13 changed input yields a different semantic hash',
    base.semantic_result_hash !== changed.semantic_result_hash);
  check('TV-13 changed input yields a different proof_id',
    base.proof_id !== changed.proof_id);
  check('TV-13 changed ruleset identity yields a different hash',
    resolveReadiness(load('tv01-domain-ready.json'), { ...CONFIG, ruleset_version: 'readiness-ruleset-v1', canonicalization_profile: 'other-profile' })
      .semantic_result_hash !== base.semantic_result_hash);
}

// TV-14 — recovery run in a separate process, no originating session
{
  const expected = resolveReadiness(load('tv01-domain-ready.json'), CONFIG).semantic_result_hash;
  const recoveryScript = `
    import fs from 'node:fs';
    import { resolveReadiness } from '${path.join(HERE, '..', 'lib', 'readiness', 'readiness-resolver.mjs')}';
    const m = JSON.parse(fs.readFileSync('${path.join(FIXTURES, 'tv01-domain-ready.json')}', 'utf8'));
    process.stdout.write(resolveReadiness(m, ${JSON.stringify(CONFIG)}).semantic_result_hash);
  `;
  const tmp = path.join(HERE, '.recovery-probe.mjs');
  fs.writeFileSync(tmp, recoveryScript);
  try {
    const recovered = execFileSync('node', [tmp], { encoding: 'utf8' }).trim();
    check('TV-14 fresh process reproduces the semantic hash from frozen artifacts alone',
      recovered === expected, `${recovered.slice(0, 12)} vs ${expected.slice(0, 12)}`);
  } finally {
    fs.unlinkSync(tmp);
  }
}

// Additional: fail-closed guarantees that must hold regardless of fixture
{
  const r1 = resolveReadiness(null, CONFIG);
  check('GUARD null manifest fails closed to BLOCKED', r1.result === 'BLOCKED', `got ${r1.result}`);

  const r2 = resolveReadiness({ ...load('tv01-domain-ready.json'), target_readiness_state: 'TOTALLY_READY' }, CONFIG);
  check('GUARD unknown readiness target fails closed to BLOCKED', r2.result === 'BLOCKED', `got ${r2.result}`);

  const r3 = resolveReadiness(load('tv01-domain-ready.json'), { ruleset_version: 'unfrozen-ruleset-v99' });
  check('GUARD unknown ruleset fails closed to BLOCKED', r3.result === 'BLOCKED', `got ${r3.result}`);

  const dangling = load('tv01-domain-ready.json');
  dangling.objects[0].references = ['obj:task:DOES-NOT-EXIST'];
  const r4 = resolveReadiness(dangling, CONFIG);
  check('GUARD dangling canonical reference fails closed to BLOCKED', r4.result === 'BLOCKED', `got ${r4.result}`);

  const noProvenance = load('tv01-domain-ready.json');
  delete noProvenance.objects[0].provenance_ref;
  check('GUARD missing provenance prevents DOMAIN READY',
    resolveReadiness(noProvenance, CONFIG).result === 'NOT_READY');

  const unflaggedGap = load('tv01-domain-ready.json');
  unflaggedGap.objects[0].semantic_gaps = [{ gap_id: 'g1', status: 'OPEN', description: 'no mandatory flag supplied' }];
  check('GUARD gap without explicit mandatory flag defaults to mandatory',
    resolveReadiness(unflaggedGap, CONFIG).result === 'NOT_READY',
    'absence of a flag must not weaken the check');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
