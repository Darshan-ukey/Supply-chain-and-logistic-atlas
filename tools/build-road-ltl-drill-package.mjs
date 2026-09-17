import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Atlas AR0.3 — PC-5 drill package builder for Road LTL 1.5.
//
// Contract §9 step 2: "build a frozen evaluation package without relying on chat/session
// memory". Everything below is extracted from git by explicit commit SHA. Nothing is carried
// in from conversation, and nothing is invented to make the scope evaluable.
//
// Honesty rule enforced here: where Road LTL 1.5 has no governed declaration (semantic
// classes, completeness attestation), this builder OMITS the field rather than supplying a
// plausible value. An omission blocks; a fabrication would produce a false READY.

const REPO = process.argv[2];
const OUT = process.argv[3];
const P61_COMMIT = '07208535f9aebede6daae5c8905688c3d40063a8';
const AR02_COMMIT = '5041441a811b739ea7d59c6a207ad1e47b9ecb6b'; // carries road-ltl-v1.4.json

const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'buffer' });
const gitText = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim();
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

function artifact(commit, filePath) {
  const content = git('cat-file', '-p', `${commit}:${filePath}`);
  return {
    content_sha256: sha256(content),
    git_blob_sha: gitText('rev-parse', `${commit}:${filePath}`),
    authoritative_location_ref: `github://Darshan-ukey/Supply-chain-and-logistic-atlas/${filePath}@${commit}`
  };
}

const cert = JSON.parse(git('cat-file', '-p',
  `${P61_COMMIT}:governance/baselines/P6_1_RECURSIVE_WORK_DECOMPOSITION_CERTIFICATION.json`).toString('utf8'));

const v15Module = artifact(P61_COMMIT, 'data/modules/road-ltl-v1.5.json');
const v15Operational = artifact(P61_COMMIT, 'data/operational-knowledge/road-ltl-v1.5-operational.json');
const v14Base = artifact(AR02_COMMIT, 'data/modules/road-ltl-v1.4.json');

// ---- lineage verification against the P6.1 certification's own claims -------------
const lineage = cert.sourceLineage;
const lineageChecks = [
  { claim: 'v15ModuleOverlayGitBlobSha', expected: lineage.v15ModuleOverlayGitBlobSha, actual: v15Module.git_blob_sha },
  { claim: 'v15OperationalOverlayGitBlobSha', expected: lineage.v15OperationalOverlayGitBlobSha, actual: v15Operational.git_blob_sha },
  { claim: 'baseModuleSha256', expected: lineage.baseModuleSha256, actual: v14Base.content_sha256 }
].map(c => ({ ...c, verified: c.expected === c.actual }));

// ---- objects: the 22 certified LTL tasks -----------------------------------------
// semantic_classes is deliberately NOT supplied: no governed completeness contract defines
// the required/provided semantic classes for Road LTL yet. Omission is the honest state.
const objects = cert.perTask.map(t => ({
  object_id: `road-ltl:task:${t.taskId}`,
  object_version: cert.moduleVersion,
  object_hash: `sha256:${t.contentHashSha256}`,
  zone: 'Z1',
  provenance_ref: `p6-1-certification:${cert.certifiedImplementationCommit}`,
  authoritative_location_ref: `supabase://${cert.backend.store}/${cert.backend.aggregateSourceTaskId}#${t.taskId}`,
  semantic_gaps: [],
  references: []
}));

// ---- dependencies: real closure state, stated honestly ----------------------------
const dependencies = [
  { dependency_id: 'road-ltl:module:v1.5-overlay', dependency_version: '1.5',
    dependency_hash: `sha256:${v15Module.content_sha256}`, status: 'PRESENT_VERIFIED',
    authoritative_location_ref: v15Module.authoritative_location_ref },
  { dependency_id: 'road-ltl:operational-knowledge:v1.5-overlay', dependency_version: '1.5',
    dependency_hash: `sha256:${v15Operational.content_sha256}`, status: 'PRESENT_VERIFIED',
    authoritative_location_ref: v15Operational.authoritative_location_ref },
  { dependency_id: 'road-ltl:module:v1.4-semantic-base', dependency_version: '1.4',
    dependency_hash: `sha256:${v14Base.content_sha256}`, status: 'PRESENT_VERIFIED',
    authoritative_location_ref: v14Base.authoritative_location_ref },
  // The P6.1 decomposition output — the artifact P6.2+ actually consumes. The certification
  // records committedToGitHub:false and a Supabase protected store. It cannot be located,
  // read or validated from governed GitHub artifacts at drill time.
  { dependency_id: 'road-ltl:decomposition:p6-1-protected-bundle', dependency_version: '1.5',
    dependency_hash: `sha256:${cert.protectedBundle.compileBundleSha256}`,
    status: 'NOT_RETRIEVABLE_FROM_GOVERNED_ARTIFACTS',
    authoritative_location_ref: `supabase://${cert.backend.store}/${cert.backend.aggregateSourceTaskId}` }
];

// semantic_coverage_attestation is deliberately ABSENT: no authority has attested Road LTL
// 1.5 semantic completeness, and fabricating one would manufacture a false READY.
const manifest = {
  scope_id: 'scope:road-ltl:1.5',
  scope_version: `1.5+p6.1@${cert.certifiedImplementationCommit.slice(0, 12)}`,
  scope_class: 'GOVERNED_SCOPE',
  target_readiness_state: 'DOMAIN_EXECUTION_READY',
  objects,
  dependencies,
  binding_requirements: [],
  not_applicable_decisions: [],
  predecessor_proofs: []
};

const pkg = {
  drill_id: 'pc5-drill:road-ltl-1.5:001',
  drill_contract_ref: 'governance/architecture-refinement/AR0.3/READINESS_VERIFICATION_CONTRACT_DRAFT_V1.md §9',
  frozen_inputs: {
    p6_1_commit: P61_COMMIT,
    v1_4_base_source_commit: AR02_COMMIT,
    certification_artifact: `${P61_COMMIT}:governance/baselines/P6_1_RECURSIVE_WORK_DECOMPOSITION_CERTIFICATION.json`
  },
  lineage_verification: lineageChecks,
  resolver_config: {
    ruleset_version: 'readiness-ruleset-v1',
    canonicalization_profile: 'canonical-json-sha256-v1',
    resolver_commit: null // filled by the runner from the actual resolver commit
  },
  manifest
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(pkg, null, 2) + '\n');
console.log(`drill package -> ${OUT}`);
console.log(`  objects:      ${objects.length}`);
console.log(`  dependencies: ${dependencies.length}`);
for (const c of lineageChecks) console.log(`  lineage ${c.claim}: ${c.verified ? 'VERIFIED' : 'MISMATCH'}`);
