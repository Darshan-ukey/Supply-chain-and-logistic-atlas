import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';

// S8-3F — governed release-manifest REGENERATION (derivative, SEQ-08; S7-IMP-013 / S6-LIN-020; PA-5 REGENERATE_DERIVATIVE).
//
// The manifest is a pure, deterministic function of (a) the pinned registry below and (b) the repository tree at the
// tested commit. Every governed identity is checked EXACTLY (expected vs observed); nothing is copied from the historical
// ATL-175/ATL-141 manifest. The ATL-175 release-control MECHANISM is retained (exact identity check, fail-closed mismatch,
// Owner gate, no implicit promotion, identity-verified recovery evidence); its historical CONTENT is evidence only.
//
// This module represents release state truthfully. It never nominates a rollback target, never certifies a failing
// release-integrity baseline and never promotes runtime/release readiness.

export const MANIFEST_PATH = 'release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json';
export const SCHEMA_VERSION = 'atlas-v1.5-release-manifest-v2.0-s8';
export const GENERATOR_PATHS = Object.freeze(['lib/release/s8-release-manifest.js', 'scripts/s8-3f-release-manifest.mjs']);

// ------------------------------------------------------------------ pinned registry (accepted S8 identities)
const SHA = {
  wd: 'fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61',
  package: '6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367',
  readiness: 'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617',
  projection: '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c',
  binding: '2f532fad61c0a5878028fb0bf362827b18593f7c1c502ba88b557dcc8e3a56f9',
  semantics: 'd642c1d59f2e938e5afcc60355f086b61e57f33d63e57e54b2a72def09a21576',
  taskHash: 'b0bee64f418dcf99ccd60480c86dcd9dcd066231fe72ab7033c80994922b4e65',
  graph: 'dfad5a029ce830e4c1bff68ea1a9ac7f482315c619495a7295aef3c50abe408e',
  flowView: '1b3839e0bde5e92216373b9ff232a5d20de5e84a7c25250f7d4ce4b93dbaba6f',
  bpmn: '1ede708543a8906333646f010b082446ec75dbf371337ad6069481c4958dfd61',
  svg: 'dbd7d34f978d21a7f81059b58b6de6cac78c89c66c047af6bf98c71ead237482'
};
const C = {
  s8_4Base: 'fe17ebb5c77fe86ef44a68d8a38eab65b5ce4751',
  s8_4Head: '3ead8bd108c349ba2149063d39376c8d2a04c2f3',
  s8_4Tested: '07a41138f7b52e5fe1d0c9d5989f72b9835560c5',
  s8_4Tree: '075784fe046f4f7a55ea719809d5ccb10376ea2c',
  s8_4Qa: '3ed23c6732f97d1451e62a32be517b19697ac24fee9f9cc8e769d0d365c3fe51',
  atl175: 'dd32b8a4eabe3c8c08f2da305efd79738c11ecd3',
  atl141: 'f0a5b90904c781ac721037be98f1ae71653e7551',
  atl141Tree: '3aae4c19fcccea3aa8baa7d01c7e5faa5cc5e484',
  atl140: 'e0c17bbb85bda27ebb9189be7cc845e3c48979dd',
  atl142: 'dba6968b0bdf28b533f4efd765302796e6ebed58',
  source: '662c7847d3839c1ffd95dc8589d3d0d6ac100d67'
};
export const PROTECTED = Object.freeze([
  {id: 'derivative.wd', role: 'CANONICAL_WORKDEFINITION', stage: 'S8-3B', kind: 'SHA256_CANONICAL', expected: SHA.wd, from: ['reconstruction', 'outputHash']},
  {id: 'derivative.package', role: 'MALKOM_PACKAGE', stage: 'S8-3C', kind: 'SHA256_CANONICAL', expected: SHA.package, from: ['packageReadiness', 'packageHash']},
  {id: 'derivative.readiness', role: 'READINESS', stage: 'S8-3C', kind: 'SHA256_CANONICAL', expected: SHA.readiness, from: ['packageReadiness', 'readinessHash']},
  {id: 'derivative.projection', role: 'MALKOM_PROJECTION_BOUNDARY', stage: 'S8-3D', kind: 'SHA256_CANONICAL', expected: SHA.projection, from: ['projection', 'projectionHash']},
  {id: 'derivative.flow-graph', role: 'FLOW_GRAPH', stage: 'S8-3E', kind: 'SHA256_CANONICAL', expected: SHA.graph, from: ['flow', 'artifactIdentities', 'graphHash']},
  {id: 'derivative.flow-view', role: 'FLOW_VIEW', stage: 'S8-3E', kind: 'SHA256_BYTES', expected: SHA.flowView, from: ['flow', 'artifactIdentities', 'flowViewSha256']},
  {id: 'derivative.bpmn', role: 'BPMN_2_0', stage: 'S8-3E', kind: 'SHA256_BYTES', expected: SHA.bpmn, from: ['flow', 'artifactIdentities', 'bpmnSha256']},
  {id: 'derivative.svg', role: 'FLOW_SVG', stage: 'S8-3E', kind: 'SHA256_BYTES', expected: SHA.svg, from: ['flow', 'artifactIdentities', 'svgSha256']}
]);
const PUBLIC_SUMMARIES = Object.freeze({
  reconstruction: 'governance/product/s8-3b-evidence/reconstruction-summary.json',
  packageReadiness: 'governance/product/s8-3c-evidence/package-readiness-summary.json',
  projection: 'governance/product/s8-3d-evidence/projection-summary.json',
  flow: 'governance/product/s8-3e-evidence/flow-summary.json'
});
// Worktree git-blob pins: [id, role, stage, path, expectedBlob]
const BLOBS = Object.freeze([
  // governed semantic / binding / source-module inputs and their generators
  ['input.semantics-generator', 'SEMANTICS_GENERATOR', 'S8-2A', 'scripts/materialize-operational-semantics-v1.cjs', '229f387b93c967621e6651f3cd67ea40f0472c3d'],
  ['input.module-road-ltl-v1.2', 'GOVERNED_MODULE_INPUT', 'S8-2A', 'data/modules/road-ltl-v1.2.json', '27e563c02abd3a189535a18c2c0d3350316a3d2b'],
  ['input.module-road-ltl-v1.5', 'GOVERNED_MODULE_INPUT', 'S8-2A', 'data/modules/road-ltl-v1.5.json', 'b69883d5369be8aad15bb9325f910610da875771'],
  ['input.operational-knowledge-v1.5', 'GOVERNED_OPERATIONAL_INPUT', 'S8-2A', 'data/operational-knowledge/road-ltl-v1.5-operational.json', '91408e34382a26bd96f1d6224b252dfb9f8b8d53'],
  ['input.binding-generator', 'CLIENT_BINDING_GENERATOR', 'S8-2C', 'scripts/materialize-client-binding-v1.cjs', 'fc4d62d5c90ee7c1bf0a365fa3e2f343a406789c'],
  ['input.binding-requirement-schema', 'CLIENT_BINDING_FROZEN_SCHEMA', 'S8-2C', 'schemas/client-binding-requirement-v1.json', '32d02dc1993b083ab5b43ef5df812e21942fe69b'],
  ['input.binding-principle', 'CLIENT_BINDING_FROZEN_PRINCIPLE', 'S8-2C', 'governance/standards/CLIENT_BINDING_RESOLUTION_PRINCIPLE_V1_FROZEN.md', '2991c6d6bc0add9081b900ba7ca7691ea5bd8815'],
  // frozen contracts / schemas governing the generated outputs
  ['contract.workdefinition-local-schema', 'LOCAL_OUTPUT_SCHEMA', 'S8-2D', 'data/contracts/atlas-workdefinition-v1.schema.json', 'a1e01ef0b6c0837d47c8c3526b9544cd52debe72'],
  ['contract.semantic-record-schema', 'SEMANTIC_RECORD_SCHEMA', 'S8-2B', 'data/contracts/atlas-operational-semantic-record-v1.schema.json', '8fac2de61d1d42af66028c456c7d0d12774600a4'],
  ['contract.client-binding-set-schema', 'CLIENT_BINDING_SET_SCHEMA', 'S8-2D', 'data/contracts/atlas-client-binding-set-v1.schema.json', '4e777a0504855bfc4f08c3eec2cd508050e95d34'],
  ['contract.atl-138-consumption', 'RETAINED_CONSUMPTION_CONTRACT (ATL-138 @ d7dbabdb451b486c07fd443d01fa3cc105cd96a7)', 'S8-3C', 'governance/product/s8-3c-evidence/ATL_138_CONSUMPTION_CONTRACT.json', 'edcefecc310462967fffce0b853579c619c97a01'],
  ['contract.atl-163-readiness-schema', 'RETAINED_READINESS_SCHEMA (ATL-163 @ fcf3206470455d6782a7c29cacd9bcf09651b8d9)', 'S8-3C', 'schemas/malkom-readiness-summary-v1.schema.json', '42507e6053096f86e294df5e69d974c60fc3c105'],
  ['contract.atl-169-boundary-schema', 'RETAINED_BOUNDARY_SCHEMA (ATL-169 @ 88bd3da8e9bf46d41676adbfce0c96fc45cf013c)', 'S8-3D', 'governance/product/s8-3d-evidence/ATL_169_BOUNDARY_SCHEMA.json', '7357321fd673351ee1685e3a7c479ceb7065287f'],
  ['contract.workdefinition-frozen-schema', 'FROZEN_WORKDEFINITION_SCHEMA (restored from c72b5002…)', 'S8-2E', 'schemas/canonical-workdefinition-contract-v1.schema.json', 'dfe74707a2829a310ad8958be791eda0b17ad05d'],
  ['contract.decomposition-frozen-schema', 'FROZEN_DECOMPOSITION_SCHEMA (restored from c72b5002…)', 'S8-2E', 'schemas/canonical-work-decomposition-contract-v1.schema.json', '4b3e2e4040f05de82077b0e89790d47f6d0df989'],
  ['contract.workdefinition-frozen-standard', 'FROZEN_WORKDEFINITION_CONTRACT (restored from c72b5002…)', 'S8-2E', 'governance/standards/CANONICAL_WORKDEFINITION_CONTRACT_V1_FROZEN.md', 'c074489f2cf7edacde962f7e0260e2b240d24b87'],
  ['contract.decomposition-frozen-standard', 'FROZEN_DECOMPOSITION_CONTRACT (restored from c72b5002…)', 'S8-2E', 'governance/standards/CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md', '046885c71dc9fb24532b398cacd47ffc522f3a1b'],
  // generators (corrected S8 lineage)
  ['generator.workdefinition-compiler', 'GENERIC_LEAF_COMPILER (restored)', 'S8-2E', 'lib/compile/workdefinition-compiler.js', '69f9f56e4e8fbb72e74936a467b884b4681175c9'],
  ['generator.workdefinition-verifier', 'GENERIC_LEAF_VERIFIER (restored)', 'S8-2E', 'lib/compile/workdefinition-verifier.js', 'd503dbc4d3200657c7a1117a90b5c7d7dd227160'],
  ['generator.frozen-schema-validator', 'FROZEN_SCHEMA_VALIDATOR', 'S8-2E', 'lib/compile/frozen-schema-validator.js', '487571ee2ad2c87c00e057dc8564044fd165119f'],
  ['generator.source-task-decomposition', 'SOURCE_RECONSTRUCTION', 'S8-3B', 'lib/compile/source-task-decomposition.js', '1ad5a858a5a438a0765d87a51d0f47f1c3978711'],
  ['generator.s8-workdefinition-compiler', 'S8_WORKDEFINITION_WRAPPER', 'S8-3B', 'lib/compile/s8-workdefinition-compiler.js', '7cff3ba9d35835291b72a0b7d12677ee6bb922ab'],
  ['generator.s8-malkom-package', 'MALKOM_PACKAGE_READINESS_GENERATOR', 'S8-3C', 'lib/compile/s8-malkom-package.js', '2d8744f5d929e0ca99fe5362ba1632f355089565'],
  ['generator.s8-malkom-projection', 'MALKOM_PROJECTION_GENERATOR', 'S8-3D', 'lib/compile/s8-malkom-projection.js', '74624af71a9c88bd2f1cd8657d483647bdadf152'],
  ['generator.s8-flow-bpmn', 'FLOW_BPMN_GENERATOR', 'S8-3E', 'lib/compile/s8-flow-bpmn.js', 'f3c70571cc21cfc9859e96fae1bcb7d1166b5934'],
  ['generator.s8-bpmn-structure', 'BPMN_STRUCTURE_VALIDATOR', 'S8-3E', 'lib/compile/s8-bpmn-structure.js', '4fb663a46e4cef5b9d11c78a9643d17da6c6f483'],
  // S8-4 certified presentation / interaction identities (provenance recorded by S8-4)
  ['interaction.canvas-index', 'CERTIFIED_CANVAS_V2_0 (P6.2 6ae00356…; S7-IMP-029)', 'S8-4', 'canvas-v2/canvas-v2/index.html', '4dfa0a8410eba303ba7dad73a5cee6431dfe3258'],
  ['interaction.canvas-css', 'CERTIFIED_CANVAS_V2_0 (P6.2 6ae00356…; S7-IMP-029)', 'S8-4', 'canvas-v2/canvas-v2/assets/canvas-v2.css', '860c878491479b40c1a71c8530d2f1725564341b'],
  ['interaction.canvas-js', 'CERTIFIED_CANVAS_V2_0 (P6.2 6ae00356…; S7-IMP-029)', 'S8-4', 'canvas-v2/canvas-v2/assets/canvas-v2.js', '672dd1b5a1eb8c3c1698fae436fa0b3db53cd5d0'],
  ['interaction.canvas-freeze-certificate', 'CERTIFIED_CANVAS_V2_0 (P6.2 6ae00356…; S7-IMP-029)', 'S8-4', 'canvas-v2/canvas-v2/FREEZE_CERTIFICATE.md', 'cff249802d6d61db395bf8d0a3587fafad26da67'],
  ['interaction.root-index', 'CERTIFIED_ROOT_INDEX (not ATL-140/ATL-142 root)', 'S8-4', 'index.html', '043802523b1618c143a0e78b88bbfb2afaa7c7dd'],
  ['interaction.canvas-daughter-bridge', 'CERTIFIED_BRIDGE_V2_0_1 (P6.2 6ae00356…; S7-IMP-030)', 'S8-4', 'assets/canvas-daughter-bridge-v2.0.1.mjs', '264e4ed26f112845bd4afb3d1e990138971d13fe'],
  ['interaction.ask-runtime', 'CERTIFIED_UNIVERSAL_ASK_2_0_1 runtime (P5 814d2e7d…; S7-IMP-031)', 'S8-4', 'runtime/universal-ask-atlas.js', '521c47a3956c81367bab942a657f998d576ff15f'],
  ['interaction.ask-api', 'CERTIFIED_UNIVERSAL_ASK_2_0_1 API (P5 814d2e7d…; S7-IMP-031)', 'S8-4', 'lib/api/ask-atlas.js', '8fa80f9dd0b733a523aed6970269f5f32d5e64da'],
  ['interaction.ask-contract', 'CERTIFIED_UNIVERSAL_ASK_2_0_1 surface contract (P5 814d2e7d…; S7-IMP-031)', 'S8-4', 'governance/ask-atlas-surface-contract-v1.json', '608956d30ea89859e9e649457debb73d267e04cd'],
  ['interaction.ask-retrieval', 'CERTIFIED_UNIVERSAL_ASK_2_0_1 governed retrieval (P5 814d2e7d…; S7-IMP-031)', 'S8-4', 'lib/ask/p5-governed-retrieval.js', '6f3c29dcbdf0ee60a694cd2f7ac7c9e521367a00'],
  ['interaction.ask-certification', 'CERTIFIED_UNIVERSAL_ASK_2_0_1 certification (P5 814d2e7d…; S7-IMP-031)', 'S8-4', 'ATLAS_V2.0.1_UNIVERSAL_ASK_CERTIFICATION.md', 'd0dfd8b2e4343f7ea86af249407e33f158267959'],
  ['interaction.runtime-shell-adapted', 'P5 shell donor b72d0c88… + ONE governed additive line (S8-4 adaptation)', 'S8-4', 'execution/ui/runtime-access-shell.js', 'e65e98b9a0f57acfb9abfd7633fcada4671a9084'],
  ['interaction.atl-140-journey', 'ATL-140 behavioural delta rebound (e0c17bbb…; behaviour only)', 'S8-4', 'assets/atl-140-v15-journey.mjs', '2c97dbdee40fa1ba13ad108a7de6a0fa170bfec7'],
  ['interaction.atl-140-consumer-view-module', 'ATL-140 behavioural delta rebound (behaviour only)', 'S8-4', 'assets/atl-140-consumer-view.mjs', 'fc20076a892356a84b0b80c285bc263bf4484c9a'],
  ['interaction.atl-140-consumer-page', 'ATL-140 behavioural delta rebound (behaviour only)', 'S8-4', 'atl-140-malkom-consumer.html', '8a2739c4482824a52bdf7c49b1852815b6d75c0f'],
  ['interaction.donor-provenance', 'S8-4 donor provenance record', 'S8-4', 'governance/product/s8-4-evidence/donor-provenance.json', '62f728a055092461aad82475503bd7d68420e88c']
]);
// Entries whose full 40-hex pin is derived from the S8-4 donor-provenance record (prefix-only pins above are completed from it).
const STAGE_EVIDENCE = Object.freeze([
  {id: 'stage.s8-3b', stage: 'S8-3B', file: 'governance/product/s8-3b-evidence/exact-qa.json', testedCommit: 'b4c15fd51b0efbb208f8fbf2107a16cc50becfe6', testedTree: '0aa076fa57679bb5a0359b3ad0b118cbb54a1cce', finalHead: '7c5384ec57c47cea3102911851a02add48d3007d'},
  {id: 'stage.s8-3c', stage: 'S8-3C', file: 'governance/product/s8-3c-evidence/exact-qa.json', testedCommit: '58d3359e901cec0134502eb2fb619cf3dfa2f857', testedTree: '33b3b2e35e9d5d467da4d3b9cf315412d19e2dab', finalHead: '97459a5e06abda96cbe3b2a121dfbee3a0bcf41e'},
  {id: 'stage.s8-3d', stage: 'S8-3D', file: 'governance/product/s8-3d-evidence/exact-qa.json', testedCommit: '3fa4348628c0fb5bcd08e1ca33d841fb9024beb4', testedTree: 'aaf01d9bf91ff46d84a200c67224fa55e190ab88', finalHead: 'ae21689cce53511227207eac6c15e187da5fb52f', qa: '3a80e4082ab38e9f5c43c17c61dc6d804683858329bc432e36281d53c56dbda8'},
  {id: 'stage.s8-3e', stage: 'S8-3E', file: 'governance/product/s8-3e-evidence/exact-qa.json', testedCommit: '7c6b5ce12e8d10738d7370186c55d2fdfeac0879', testedTree: 'e973ca832559a45113ce4092d5589fcbc069e6ed', finalHead: 'fe17ebb5c77fe86ef44a68d8a38eab65b5ce4751', qa: '89cf052a6820bcfa609d3bfe42fe44365e7f703c91199296f23cceb7ad6152e8'},
  {id: 'stage.s8-4', stage: 'S8-4', file: 'governance/product/s8-4-evidence/exact-qa.json', testedCommit: C.s8_4Tested, testedTree: C.s8_4Tree, finalHead: C.s8_4Head, qa: C.s8_4Qa}
]);
// Identities that must NEVER be current authority (historical / stale / wrong-donor / superseded).
export const EXCLUDED = Object.freeze([
  {id: 'excluded.atl-140-root-index', kind: 'GIT_BLOB', value: '9cf88a867359ba33ebfbe85c1360f0ab21bc29b3', classification: 'EXCLUDED_WRONG_ROOT', reason: 'ATL-140 root presentation architecture (S7-IMP-005 SALVAGE_REBIND/WRONG_DONOR)'},
  {id: 'excluded.atl-142-root-index', kind: 'GIT_BLOB', value: '379f988ce807f33dc8fd43b49b227b917a15b8c0', classification: 'EXCLUDED_WRONG_ROOT', reason: 'ATL-142 root presentation assembly (S7-IMP-006 WRONG_DONOR/REPLACE_ASSEMBLY)'},
  {id: 'excluded.atl-142-commit', kind: 'GIT_COMMIT', value: C.atl142, classification: 'EXCLUDED_WRONG_DONOR', reason: 'ATL-142 historical evidence only; never base, root, assembly or release authority'},
  {id: 'excluded.superseded-ask-api', kind: 'GIT_BLOB', value: 'cb2bcfea0892adf5a871fb4584461b50729ab383', classification: 'EXCLUDED_SUPERSEDED_INPUT', reason: 'ATL-142 older Ask API (S7-IMP-037/S6-LIN-011); not current certified Universal Ask 2.0.1', allowedInheritedPaths: ['release/packages/lab/lib/api/ask-atlas.js', 'release/packages/stable/lib/api/ask-atlas.js']},
  {id: 'excluded.atl-141-baseline-rewrite', kind: 'GIT_BLOB', value: '02a3e9e21a0362d1371e2863cfb028e62c966e23', classification: 'EXCLUDED_NOT_ROLLBACK_TARGET', reason: 'ATL-141 release/baselines/v1.1.8-critical-hashes.json carries candidate/root changes of the stale ATL-140 lineage; historical evidence only'},
  {id: 'excluded.historical-manifest-atl175', kind: 'GIT_BLOB_AT', commit: C.atl175, path: 'release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json', classification: 'EXCLUDED_STALE_MANIFEST_CONTENT', reason: 'ATL-175 historical manifest: PARTIAL_LINEAGE / STALE_PENDING_REVALIDATION'},
  {id: 'excluded.historical-manifest-atl141', kind: 'GIT_BLOB_AT', commit: C.atl141, path: 'release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json', classification: 'EXCLUDED_STALE_MANIFEST_CONTENT', reason: 'ATL-141 historical manifest: PARTIAL_LINEAGE / STALE_PENDING_REVALIDATION'},
  {id: 'excluded.stale-generated-malkom-package', kind: 'GIT_BLOB', value: 'c3bb7336361a46daf365d9c75066da5f046f8302', classification: 'EXCLUDED_STALE_GENERATED_OUTPUT', reason: 'historical stale ATL-139 package (stale WD/package chain)'},
  {id: 'excluded.stale-generated-readiness', kind: 'GIT_BLOB', value: 'd43f41309304b12756baa491f5664f39a0e59c7d', classification: 'EXCLUDED_STALE_GENERATED_OUTPUT', reason: 'historical stale readiness'},
  {id: 'excluded.stale-generated-projection-boundary', kind: 'GIT_BLOB', value: '1a542b1a13fd93c837bdb37e21cd3183c8a21d5d', classification: 'EXCLUDED_STALE_GENERATED_OUTPUT', reason: 'historical stale projection boundary'},
  {id: 'excluded.stale-generated-client-binding', kind: 'GIT_BLOB', value: '47fe62aa91005cb48bbae69f0bd890d8b0e42d28', classification: 'EXCLUDED_STALE_GENERATED_OUTPUT', reason: 'historical stale client binding'},
  {id: 'excluded.stale-generated-flow-graph', kind: 'GIT_BLOB', value: '6a0fa535a6273f01b5eeef421c4e90885a35671b', classification: 'EXCLUDED_STALE_GENERATED_OUTPUT', reason: 'historical stale ATL-178 flow graph'},
  {id: 'excluded.stale-atl-140-consumer-atl175', kind: 'GIT_BLOB', value: '561a9c787469a1f832beb26b5cfe56c17451c1a7', classification: 'EXCLUDED_STALE_PRESENTATION', reason: 'historical ATL-140 consumer page (ATL-175 manifest)'},
  {id: 'excluded.stale-atl-140-consumer-atl141', kind: 'GIT_BLOB', value: 'a13fd8069b832f8cf2522ca78a75890c3d72b580', classification: 'EXCLUDED_STALE_PRESENTATION', reason: 'historical ATL-140 consumer page (ATL-141 manifest)'},
  {id: 'excluded.stale-atl-167-slice', kind: 'GIT_BLOB', value: '72c4ce7ca1f1ed137f43470c54b662162c984c90', classification: 'EXCLUDED_STALE_PRESENTATION', reason: 'historical ATL-167 interaction slice'},
  {id: 'excluded.stale-atl-178-explorer', kind: 'GIT_BLOB', value: '4cc2aaf46f071c49a6c57a81601da2a78dfbfaf5', classification: 'EXCLUDED_STALE_PRESENTATION', reason: 'historical ATL-178 flow explorer'},
  {id: 'excluded.stale-utility-proof', kind: 'GIT_BLOB', value: '8608c68f1007ea5f18b07452eeb9d3894b9aea40', classification: 'EXCLUDED_STALE_GENERATED_OUTPUT', reason: 'historical ATL-173 utility proof'}
]);
export const STALE_WD_MARKER = ['wd', '::road-ltl::LTL-04::v', '1'].join('');
const ROLLBACK_BASELINE_PATH = 'release/baselines/v1.1.8-critical-hashes.json';
const INTEGRITY_BASELINE = 'release/baselines/v2-critical-hashes.json';
const REQUIRED_IDS = Object.freeze([
  ...PROTECTED.map((p) => p.id), ...BLOBS.map((b) => b[0]), ...STAGE_EVIDENCE.map((s) => s.id),
  'source.road-ltl-v1.4', 'source.task-hash', 'source.semantics-record', 'source.client-binding'
]);

// ------------------------------------------------------------------ utilities
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
export const serialize = (v) => JSON.stringify(sortKeys(v), null, 2) + '\n';
const sha256Hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
const gitBlobOfBytes = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const git = (root, args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 200000000, stdio: ['ignore', 'pipe', 'pipe']}).trim();
const gitTry = (root, args) => { try { return git(root, args); } catch { return null; } };
const worktreeBlob = (root, p) => { const f = path.join(root, p); return fs.existsSync(f) && fs.statSync(f).isFile() ? gitBlobOfBytes(fs.readFileSync(f)) : null; };
const readJson = (root, p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const dig = (o, keys) => keys.reduce((a, k) => (a == null ? undefined : a[k]), o);
const matches = (expected, observed) => observed != null && (expected.length === 40 || expected.length === 64 ? expected === observed : observed.startsWith(expected));

function allTrackedBlobIds(root) {
  const out = git(root, ['ls-files', '-s', '-z']).split('\0').filter(Boolean);
  const m = new Map();
  for (const l of out) { const [meta, p] = l.split('\t'); const blob = meta.split(' ')[1]; if (!m.has(blob)) m.set(blob, []); m.get(blob).push(p); }
  return m;
}

// ------------------------------------------------------------------ build
export function buildManifest(root) {
  const summaries = Object.fromEntries(Object.entries(PUBLIC_SUMMARIES).map(([k, p]) => [k, fs.existsSync(path.join(root, p)) ? readJson(root, p) : null]));
  const provenance = fs.existsSync(path.join(root, 'governance/product/s8-4-evidence/donor-provenance.json')) ? readJson(root, 'governance/product/s8-4-evidence/donor-provenance.json') : null;
  const fullBlob = new Map();
  if (provenance) for (const e of [...provenance.imports, ...provenance.alreadyInBase]) fullBlob.set(e.path, e.expectedBlob);
  if (provenance?.bridge) fullBlob.set(provenance.bridge.path, provenance.bridge.expectedBlob);
  const entry = (id, role, stage, kind, expected, observed, extra = {}) => ({id, role, stage, kind, ...extra, expected, observed, status: expected != null && observed != null && matches(expected, observed) ? 'MATCH' : observed == null ? 'MISSING' : 'MISMATCH'});
  const lineage = [];
  // governed source / frozen donor
  const srcBlob = gitTry(root, ['rev-parse', `${C.source}:data/modules/road-ltl-v1.4.json`]);
  lineage.push(entry('source.road-ltl-v1.4', 'GOVERNED_SOURCE_FROZEN_TASK_MODULE', 'S8-3A/S8-3B', 'GIT_BLOB', 'd06974e9ee86cea59227e0866a98ad5d1367bfad', srcBlob, {source: {commit: C.source, path: 'data/modules/road-ltl-v1.4.json', branch: 's8-3a-atl155-daughter-regeneration'}}));
  lineage.push(entry('source.task-hash', 'GOVERNED_SOURCE_TASK_LTL-04', 'S8-3B', 'SHA256_CANONICAL', SHA.taskHash, dig(summaries.reconstruction, ['sourcePin', 'taskHash']) ?? null, {publicEvidence: PUBLIC_SUMMARIES.reconstruction}));
  lineage.push(entry('source.semantics-record', 'CORRECTED_OPERATIONAL_SEMANTICS', 'S8-2A/S8-3B', 'SHA256_CANONICAL', SHA.semantics, dig(summaries.reconstruction, ['semanticRecordHash']) ?? null, {publicEvidence: PUBLIC_SUMMARIES.reconstruction}));
  lineage.push(entry('source.client-binding', 'CORRECTED_CLIENT_BINDING', 'S8-2C/S8-3B', 'SHA256_CANONICAL', SHA.binding, dig(summaries.reconstruction, ['bindingHash']) ?? null, {publicEvidence: PUBLIC_SUMMARIES.reconstruction}));
  // worktree blobs (inputs, frozen contracts, generators, S8-4 interaction)
  for (const [id, role, stage, p, pin] of BLOBS) {
    const expected = pin && pin.length === 40 ? pin : (fullBlob.get(p) ?? pin);
    const observed = worktreeBlob(root, p);
    const extra = {path: p};
    extra.pinnedBy = pin && pin.length === 40 ? 'S8-4 tested tree 07a41138 (public evidence)' : 'S8-4 donor-provenance record';
    lineage.push(entry(id, role, stage, 'GIT_BLOB', expected ?? observed, observed, extra));
  }
  // protected derivatives (identity only; no bytes, no path)
  for (const p of PROTECTED) {
    const observed = dig(summaries[p.from[0]], p.from.slice(1)) ?? null;
    lineage.push(entry(p.id, p.role, p.stage, p.kind, p.expected, observed, {classification: 'EXECUTION_PROTECTED', bytesPublished: false, custody: {mechanism: 'DETERMINISTIC_REPRODUCTION_FROM_GOVERNED_LINEAGE', protectedStore: 'PRIVATE_CUSTODY_OUTSIDE_REPOSITORY', reproducer: 'lib/compile/s8-flow-bpmn.js#generateFlowArtifacts via tests/s8-3e-atl178-flow-bpmn.test.mjs', reconstructedContentInManifest: false}, publicEvidence: PUBLIC_SUMMARIES[p.from[0]], publicEvidenceBlob: worktreeBlob(root, PUBLIC_SUMMARIES[p.from[0]])}));
  }
  // stage QA evidence (public)
  for (const s of STAGE_EVIDENCE) {
    const f = path.join(root, s.file); const ok = fs.existsSync(f);
    const doc = ok ? readJson(root, s.file) : null; const bytes = ok ? fs.readFileSync(f) : null;
    const observed = {testedCommit: doc?.testedCommit ?? null, testedTree: doc?.testedTree ?? null, status: doc?.status ?? null, evidenceSha256: bytes ? sha256Hex(bytes) : null, evidenceBlob: bytes ? gitBlobOfBytes(bytes) : null};
    const expected = {testedCommit: s.testedCommit, testedTree: s.testedTree, status: 'PASS', evidenceSha256: s.qa ?? observed.evidenceSha256};
    const good = ok && observed.testedCommit === expected.testedCommit && observed.testedTree === expected.testedTree && observed.status === 'PASS' && observed.evidenceSha256 === expected.evidenceSha256;
    lineage.push({id: s.id, role: 'STAGE_QA_EVIDENCE', stage: s.stage, kind: 'STAGE_EVIDENCE', path: s.file, finalEvidenceHead: s.finalHead, expected, observed, status: good ? 'MATCH' : ok ? 'MISMATCH' : 'MISSING',
      ...(s.qa ? {} : {note: 'evidence SHA256 pinned at regeneration to the committed file; see residual RES-S8-3B-QA-HASH-RECORD'})});
  }
  lineage.sort((a, b) => (a.id < b.id ? -1 : 1));

  // exclusions: stale / wrong-donor identities must be absent from the current tree and from authority
  const tracked = allTrackedBlobIds(root);
  const headIsAncestor = (c) => gitTry(root, ['merge-base', '--is-ancestor', c, 'HEAD']) !== null;
  const exclusions = EXCLUDED.map((e) => {
    let present = false, where = [];
    if (e.kind === 'GIT_BLOB') { where = (tracked.get(e.value) ?? []).filter((p) => !(e.allowedInheritedPaths ?? []).includes(p)); present = where.length > 0; }
    else if (e.kind === 'GIT_COMMIT') { present = headIsAncestor(e.value); }
    else if (e.kind === 'GIT_BLOB_AT') { const v = gitTry(root, ['rev-parse', `${e.commit}:${e.path}`]); where = v ? (tracked.get(v) ?? []) : []; present = where.length > 0; return {id: e.id, kind: e.kind, commit: e.commit, path: e.path, historicalBlob: v, classification: e.classification, reason: e.reason, currentAuthority: false, presentInSuccessorTree: present, locations: where, status: present ? 'PRESENT_VIOLATION' : 'ABSENT_FROM_AUTHORITY'}; }
    return {id: e.id, kind: e.kind, value: e.value, classification: e.classification, reason: e.reason, currentAuthority: false, ...(e.allowedInheritedPaths ? {inheritedResidualPaths: e.allowedInheritedPaths} : {}), presentInSuccessorTree: present, locations: where, status: present ? 'PRESENT_VIOLATION' : 'ABSENT_FROM_AUTHORITY'};
  });
  // stale WD marker must not appear in manifest-governed (current-authority) files
  const staleMarkerFiles = lineage.filter((l) => l.path && l.kind === 'GIT_BLOB' && /^S8-(3[B-E]|4)/.test(l.stage) && fs.existsSync(path.join(root, l.path)) && !/\.(b64|gz)$/.test(l.path) && fs.readFileSync(path.join(root, l.path), 'utf8').includes(STALE_WD_MARKER)).map((l) => l.path).filter((p) => p !== 'lib/compile/s8-flow-bpmn.js');

  // historical control / evidence donors (EVIDENCE ONLY; never authority)
  const at = (c, p) => gitTry(root, ['rev-parse', `${c}:${p}`]);
  const historicalEvidence = [
    {id: 'historical.atl-175-control-donor', branch: 'atl-175-v15-release-contract', commit: C.atl175, commitResolves: gitTry(root, ['cat-file', '-t', C.atl175]) === 'commit', tree: gitTry(root, ['rev-parse', `${C.atl175}^{tree}`]), authority: 'S6-LIN-034 / S7-IMP-020', disposition: 'RETAIN_CONTROL_MECHANISM_ONLY', currentAuthority: false, contentAuthority: false, evidenceBlobs: {'governance/product/ATL_175_V1_5_RELEASE_CONTRACT_V1.json': at(C.atl175, 'governance/product/ATL_175_V1_5_RELEASE_CONTRACT_V1.json'), 'tests/atl-175-release-contract.test.cjs': at(C.atl175, 'tests/atl-175-release-contract.test.cjs'), 'atl-175-release-status.html': at(C.atl175, 'atl-175-release-status.html')}},
    {id: 'historical.atl-141-integrity-evidence', branch: 'atl-141-v15-release-integrity', commit: C.atl141, commitResolves: gitTry(root, ['cat-file', '-t', C.atl141]) === 'commit', tree: gitTry(root, ['rev-parse', `${C.atl141}^{tree}`]), expectedTree: C.atl141Tree, authority: 'S6-LIN-035 / S7-IMP-021', disposition: 'BEHAVIOURAL_RELEASE_INTEGRITY_EVIDENCE_ONLY', currentAuthority: false, contentAuthority: false, evidenceBlobs: {'tests/atl-141-release-integrity.test.cjs': at(C.atl141, 'tests/atl-141-release-integrity.test.cjs')}},
    {id: 'historical.atl-175-rollback-baseline', path: ROLLBACK_BASELINE_PATH, commit: C.atl175, blob: at(C.atl175, ROLLBACK_BASELINE_PATH), expectedBlob: '98296aa26eb563479e666fe6dd007bf422920c6d', classification: 'HISTORICAL_ROLLBACK_CONTROL_EVIDENCE', currentSuccessorRollbackIdentity: false, importedIntoSuccessorTree: fs.existsSync(path.join(root, ROLLBACK_BASELINE_PATH)), note: 'Retained as evidence only; not imported and not relabelled as current authority unless independently proven.'}
  ];

  // release integrity: the existing endpoint verifies INTEGRITY_BASELINE; report its true state, never certify it
  const integrity = integrityState(root);
  // inherited superseded Ask copies under release/packages
  const askResidual = packageAskResidual(root);
  const certifiedAskApi = fullBlob.get('lib/api/ask-atlas.js') ?? worktreeBlob(root, 'lib/api/ask-atlas.js');

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    releaseId: 'atlas-v1.5-road-ltl-malkom',
    manifestClass: 'GOVERNED_REGENERATED_DERIVATIVE',
    stage: {id: 'S8-3F', authority: ['S7-IMP-013', 'S6-LIN-020', 'PA-5 REGENERATE_DERIVATIVE', 'SEQ-08'], meaning: 'manifest/regeneration correctness only; NOT release readiness, rollback readiness or runtime readiness'},
    supersedes: {historicalManifestPath: MANIFEST_PATH, disposition: 'PARTIAL_LINEAGE / STALE_PENDING_REVALIDATION — regenerated, never transplanted', historicalContentCarriedForward: false},
    generator: {paths: [...GENERATOR_PATHS], blobs: Object.fromEntries(GENERATOR_PATHS.map((p) => [p, worktreeBlob(root, p)])), deterministic: true, inputs: 'pinned registry + repository tree; no clock, no randomness, no network'},
    successorSpine: {
      branchBase: C.s8_4Head,
      s8_3eFinalHead: C.s8_4Base,
      s8_4: {finalEvidenceHead: C.s8_4Head, testedCommit: C.s8_4Tested, testedTree: C.s8_4Tree, qaEvidenceSha256: C.s8_4Qa, qaEvidencePath: 'governance/product/s8-4-evidence/exact-qa.json'},
      publicDerivativeSummaries: PUBLIC_SUMMARIES,
      workDefinitionId: 'road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD',
      sourceReleaseTip: dig(summaries.projection, ['inputHashes', 'base']) ?? null
    },
    lineage,
    exclusions,
    staleLineageMarkerFiles: staleMarkerFiles,
    historicalEvidence,
    controls: {
      ownerGateRequired: true,
      productionPromotionAuthorized: false,
      stagePath: ['STAGING', 'INDEPENDENT_QA', 'OWNER_GATE', 'PRODUCTION'],
      channelMapping: {staging: 'Lab', production: 'Stable'},
      frozenAssetMutationAllowed: false,
      identityVerification: {mode: 'EXACT', onMismatch: 'FAIL_CLOSED', implicitMultiGenerationNegotiation: false, unknownCompatibility: 'FAIL_CLOSED'},
      verificationEndpoints: ['/api/version', '/api/readiness', '/api/release-integrity'],
      mechanismSource: 'ATL-175 dd32b8a4… (retained mechanism: bounded release contract, exact identity check, release-integrity verification, rollback control, recovery evidence, Owner-gated promotion)'
    },
    rollback: {
      rollbackMechanismStatus: 'ESTABLISHED',
      mechanism: {runbook: 'release/ROLLBACK_RUNBOOK.md', runbookBlob: worktreeBlob(root, 'release/ROLLBACK_RUNBOOK.md'), contract: 'release/RELEASE_CONTRACT.md', contractBlob: worktreeBlob(root, 'release/RELEASE_CONTRACT.md'), principle: 'application-first rollback to the last known-good deployment; database rollback exceptional and never automatic'},
      historicalRollbackEvidence: ['historical.atl-175-rollback-baseline'],
      rollbackIdentityStatus: 'NOT_ESTABLISHED',
      currentSuccessorRollbackTarget: null,
      deploymentRollbackIdentity: 'NOT_ESTABLISHED',
      recoveryEvidence: {
        kind: 'IDENTITY_VERIFIED_RECOVERY_EVIDENCE',
        gitContentAddressedArtifacts: Object.fromEntries(lineage.filter((l) => l.kind === 'GIT_BLOB' && l.path).map((l) => [l.path, l.observed])),
        protectedDerivativesRecovery: 'deterministic reproduction from the governed lineage (private custody); no backup bytes are published',
        rule: 'restore only from identity-verified evidence; a git blob/hash match is evidence of identity, not a rollback target'
      },
      promotionBlockedWhile: ['rollbackIdentityStatus != ESTABLISHED by a separately governed authority', 'deploymentRollbackIdentity != ESTABLISHED', 'Owner gate not exercised'],
      interpretationGuards: ['missing rollback identity is NOT "rollback not required"', 'the current candidate is NOT its own rollback', 'historical ATL-175 does NOT automatically govern', 'the latest available baseline is NOT acceptable', 'a missing rollback identity is NOT runtime or release readiness']
    },
    releaseIntegrity: integrity,
    runtimeState: {
      projectionDisposition: dig(summaries.packageReadiness, ['projectionDisposition']) ?? null,
      universalExecutionReady: dig(summaries.projection, ['universalExecutionReady']) ?? null,
      materializable: dig(summaries.projection, ['materializable']) ?? null,
      independentExecutorProofStatus: dig(summaries.projection, ['independentExecutorProofStatus']) ?? null,
      runtimeCertification: dig(summaries.projection, ['runtimeCertification']) ?? null,
      runtimeReadiness: dig(summaries.flow, ['boundary', 'runtimeReadiness']) ?? null,
      unresolvedBindingCount: dig(summaries.packageReadiness, ['unresolvedBindingCount']) ?? null,
      notCompiledLeafCount: dig(summaries.packageReadiness, ['totals', 'notCompiledLeafCount']) ?? null,
      blockedByClientBindingLeafCount: dig(summaries.packageReadiness, ['totals', 'blockedByClientBindingLeafCount']) ?? null,
      blockedByKnowledgeGapLeafCount: dig(summaries.packageReadiness, ['totals', 'blockedByKnowledgeGapLeafCount']) ?? null,
      clientBindingState: 'CLIENT_BINDING_REQUIRED',
      knowledgeGapState: 'BLOCKED',
      promotedByThisStage: false
    },
    downstream: {'ATL-181': 'BLOCKED — WAIT S8-6', 'S8-5': 'NOT STARTED', 'S8-6': 'NOT STARTED', release: 'DO NOT MERGE', successorRc: 'NOT BUILT (belongs to S8-6)'},
    residuals: [
      {id: 'RES-ASK-RELEASE-PACKAGES', status: 'UNRESOLVED_SUCCESSOR_ASSEMBLY_CLEANUP', classification: 'EXCLUDED_SUPERSEDED_INPUT', representsCurrentCertifiedAsk: false, currentCertifiedAskApiBlob: certifiedAskApi, ...askResidual, cleanup: 'S8-6 successor assembly; not performed or certified by S8-3F'},
      {id: 'RES-RELEASE-INTEGRITY-BASELINE-DRIFT', status: integrity.observedVerification.status, detail: 'The existing /api/release-integrity verifier fails closed against its own baseline; S8-3F neither repairs nor certifies it.'},
      {id: 'RES-ROLLBACK-IDENTITY', status: 'NOT_ESTABLISHED', detail: 'No deterministic successor rollback target; no historical or in-spine baseline promoted by availability.'},
      {id: 'RES-DEPLOYMENT-IDENTITY', status: 'NOT_ESTABLISHED', detail: 'No exact last-known-good deployment identity; none inferred or fabricated.'},
      {id: 'RES-S8-3B-QA-HASH-RECORD', status: 'RECORD_DISCREPANCY_FOR_RECONCILIATION', detail: 'The S8-3B closure row records evidence SHA256 36d18ec3…; the committed exact-qa.json at the S8-3B final head hashes differently. Derivative identities are unaffected; the committed file identity is pinned here.'},
      {id: 'RES-DEF-DAU-007', status: 'OPEN_OUT_OF_SCOPE', detail: 'ATL-142 history-navigation release blocker remains open.'},
      {id: 'RES-NODE-VARIANCE', status: 'NOTED', detail: 'QA runs on Node v22; repository engines state 24.x.'}
    ]
  };
  return manifest;
}

function hashFileAt(root, p) { const f = path.join(root, p); return fs.existsSync(f) ? sha256Hex(fs.readFileSync(f)) : null; }

export function integrityState(root) {
  const bp = INTEGRITY_BASELINE;
  const base = fs.existsSync(path.join(root, bp)) ? readJson(root, bp) : null;
  const mismatches = []; let count = 0;
  if (base) for (const [rel, expected] of Object.entries(base.files ?? {})) { count++; const a = hashFileAt(root, rel); if (a === null) mismatches.push({path: rel, reason: 'missing'}); else if (a !== expected) mismatches.push({path: rel, reason: 'drift'}); }
  // classify drift against the S8-3E base (fe17ebb5): pre-existing vs introduced since
  const preexisting = [], sinceBase = [];
  for (const m of mismatches) {
    let atBase = null; try { atBase = sha256Hex(cp.execFileSync('git', ['-c', `safe.directory=${root}`, 'show', `${C.s8_4Base}:${m.path}`], {cwd: root, maxBuffer: 200000000, stdio: ['ignore', 'pipe', 'ignore']})); } catch { /* absent at base */ }
    (atBase !== null && atBase === base.files[m.path] ? sinceBase : preexisting).push(m.path);
  }
  const failing = !base || mismatches.length > 0;
  return {
    endpoint: '/api/release-integrity',
    verifier: {path: 'lib/api/release-integrity.js', blob: worktreeBlob(root, 'lib/api/release-integrity.js'), baselinePathHardcodedInVerifier: bp},
    baseline: {path: bp, blob: worktreeBlob(root, bp), release: base?.release ?? null, fileCount: count},
    observedVerification: {status: failing ? 'FAILS_VERIFICATION' : 'PASSES_VERIFICATION', mismatchedCount: mismatches.length, mismatches, driftAtS8_3EBaseAndBefore: preexisting, driftIntroducedAfterS8_3EBase: sinceBase},
    certified: false,
    manifestCertifiesBaseline: false,
    disposition: failing ? 'RESIDUAL_RELEASE_INTEGRITY_CONDITION — verifier fails closed; not repaired and not weakened by S8-3F' : 'BASELINE_VERIFIES — still not certified by S8-3F'
  };
}

export function packageAskResidual(root) {
  const dir = path.join(root, 'release/packages'); const found = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/(^|-)ask-atlas(-surface-contract-v1)?\.(js|json)$|universal-ask-atlas\.js$/.test(e.name)) found.push(path.relative(root, f).split(path.sep).join('/')); } };
  if (fs.existsSync(dir)) walk(dir);
  found.sort();
  return {affectedPaths: found.map((p) => ({path: p, blob: worktreeBlob(root, p), supersededAskApiBlob: worktreeBlob(root, p) === 'cb2bcfea0892adf5a871fb4584461b50729ab383'}))};
}

// ------------------------------------------------------------------ verify (fail-closed; returns every failure)
export function verifyManifest(manifest, {root, reproduce = null} = {}) {
  const f = []; const fail = (code, detail) => f.push({code, detail});
  const m = manifest;
  if (!m || typeof m !== 'object') return {ok: false, failures: [{code: 'MANIFEST_INVALID', detail: 'not an object'}]};
  if (m.schemaVersion !== SCHEMA_VERSION) fail('SCHEMA_VERSION_MISMATCH', m.schemaVersion);
  const rebuilt = buildManifest(root);
  const byId = new Map((m.lineage ?? []).map((l) => [l.id, l]));
  const ids = new Set(byId.keys());
  // required governed entries (source/frozen donors, derivatives, S8-4 identities)
  for (const id of REQUIRED_IDS) if (!ids.has(id)) fail(id.startsWith('interaction.') || id === 'stage.s8-4' ? 'S8_4_IDENTITY_MISSING' : id.startsWith('source.') || id.startsWith('input.') || id.startsWith('contract.') || /^generator\.(workdefinition-|frozen-|source-task)/.test(id) ? 'SOURCE_OR_FROZEN_DONOR_IDENTITY_MISSING' : 'ENTRY_MISSING', id);
  for (const l of m.lineage ?? []) {
    const reg = rebuilt.lineage.find((r) => r.id === l.id);
    if (!reg) { fail('UNKNOWN_ENTRY', l.id); continue; }
    if (JSON.stringify(sortKeys(l.expected)) !== JSON.stringify(sortKeys(reg.expected))) fail(String(l.id).startsWith('derivative.') ? 'OUTPUT_HASH_DRIFT' : 'IDENTITY_REPLACED_OR_STALE', `${l.id}: manifest expected differs from the accepted pin`);
    if (JSON.stringify(sortKeys(l.observed)) !== JSON.stringify(sortKeys(reg.observed))) fail(String(l.id).startsWith('derivative.') ? 'OUTPUT_HASH_DRIFT' : 'IDENTITY_MISMATCH', `${l.id}: recorded observed identity differs from the repository`);
    if (reg.status !== 'MATCH') fail(String(l.id).startsWith('derivative.') ? 'OUTPUT_HASH_DRIFT' : 'IDENTITY_MISMATCH', `${l.id}: repository identity is ${reg.status}`);
    if (l.status !== 'MATCH') fail('ENTRY_NOT_MATCH', `${l.id}: ${l.status}`);
    if (l.classification === 'EXECUTION_PROTECTED') {
      if (l.bytesPublished !== false || 'path' in l || 'content' in l || 'bytes' in l || 'body' in l || l.custody?.reconstructedContentInManifest !== false) fail('PROTECTED_ARTIFACT_UNGOVERNED_REPRESENTATION', l.id);
    } else if (String(l.id).startsWith('derivative.')) fail('PROTECTED_ARTIFACT_UNGOVERNED_REPRESENTATION', `${l.id}: derivative must be EXECUTION_PROTECTED`);
  }
  for (const id of ['derivative.wd', 'derivative.package', 'derivative.readiness', 'derivative.projection', 'derivative.flow-graph', 'derivative.flow-view', 'derivative.bpmn', 'derivative.svg']) if (!ids.has(id)) fail('ENTRY_MISSING', id);
  // successor spine / S8-4 identity
  const s4 = m.successorSpine?.s8_4;
  if (!s4) fail('S8_4_IDENTITY_MISSING', 'successorSpine.s8_4');
  else for (const [k, v] of Object.entries({finalEvidenceHead: C.s8_4Head, testedCommit: C.s8_4Tested, testedTree: C.s8_4Tree, qaEvidenceSha256: C.s8_4Qa})) if (s4[k] !== v) fail('S8_4_IDENTITY_MISSING', `successorSpine.s8_4.${k}`);
  if (m.successorSpine?.branchBase !== C.s8_4Head) fail('WRONG_SUCCESSOR_BASE', String(m.successorSpine?.branchBase));
  // exclusions: never authority; never present
  const excl = new Map((m.exclusions ?? []).map((e) => [e.id, e]));
  for (const e of EXCLUDED) {
    const x = excl.get(e.id);
    if (!x) { fail('EXCLUSION_RECORD_MISSING', e.id); continue; }
    if (x.currentAuthority !== false) fail('STALE_IDENTITY_AS_AUTHORITY', e.id);
    if (x.classification !== e.classification) fail('EXCLUSION_RECLASSIFIED', e.id);
  }
  for (const x of rebuilt.exclusions) if (x.status === 'PRESENT_VIOLATION') fail(x.id === 'excluded.atl-140-root-index' ? 'ATL_140_ROOT_REINTRODUCED' : x.id === 'excluded.atl-142-root-index' || x.id === 'excluded.atl-142-commit' ? 'ATL_142_ROOT_REINTRODUCED' : x.id === 'excluded.superseded-ask-api' ? 'SUPERSEDED_ASK_PRESENT_OUTSIDE_INHERITED_RESIDUAL' : 'STALE_IDENTITY_PRESENT_IN_TREE', `${x.id}: ${x.locations.join(',') || 'ancestry'}`);
  for (const l of m.lineage ?? []) for (const e of EXCLUDED) if (e.kind === 'GIT_BLOB' && (l.expected === e.value || l.observed === e.value)) fail(e.id === 'excluded.superseded-ask-api' ? 'SUPERSEDED_ASK_AS_CURRENT' : e.id.includes('root-index') ? (e.id.includes('140') ? 'ATL_140_ROOT_REINTRODUCED' : 'ATL_142_ROOT_REINTRODUCED') : 'STALE_IDENTITY_AS_AUTHORITY', `${l.id} carries ${e.id}`);
  if ((rebuilt.staleLineageMarkerFiles ?? []).length) fail('STALE_WD_LINEAGE_MARKER', rebuilt.staleLineageMarkerFiles.join(','));
  if ((m.staleLineageMarkerFiles ?? []).length) fail('STALE_WD_LINEAGE_MARKER', (m.staleLineageMarkerFiles).join(','));
  if (fs.existsSync(path.join(root, ROLLBACK_BASELINE_PATH))) fail('HISTORICAL_ROLLBACK_BASELINE_IMPORTED_AS_AUTHORITY', ROLLBACK_BASELINE_PATH);
  // superseded Ask residual must be represented as unresolved, never as current
  const askRes = (m.residuals ?? []).find((r) => r.id === 'RES-ASK-RELEASE-PACKAGES');
  if (!askRes) fail('ASK_RESIDUAL_MISSING', 'RES-ASK-RELEASE-PACKAGES');
  else {
    if (askRes.representsCurrentCertifiedAsk !== false) fail('SUPERSEDED_ASK_AS_CURRENT', 'representsCurrentCertifiedAsk');
    if (askRes.status !== 'UNRESOLVED_SUCCESSOR_ASSEMBLY_CLEANUP') fail('SUPERSEDED_ASK_AS_CURRENT', `status ${askRes.status}`);
    for (const a of askRes.affectedPaths ?? []) if (a.supersededAskApiBlob && !/^release\/packages\//.test(a.path)) fail('SUPERSEDED_ASK_PRESENT_OUTSIDE_INHERITED_RESIDUAL', a.path);
  }
  // controls
  const c = m.controls ?? {};
  if (c.ownerGateRequired !== true) fail('OWNER_GATE_NOT_REQUIRED', String(c.ownerGateRequired));
  if (c.productionPromotionAuthorized !== false) fail('PRODUCTION_PROMOTION_AUTHORIZED', String(c.productionPromotionAuthorized));
  if (c.identityVerification?.mode !== 'EXACT' || c.identityVerification?.onMismatch !== 'FAIL_CLOSED') fail('IDENTITY_VERIFICATION_NOT_FAIL_CLOSED', JSON.stringify(c.identityVerification));
  if (c.frozenAssetMutationAllowed !== false) fail('FROZEN_ASSET_MUTATION_ALLOWED', String(c.frozenAssetMutationAllowed));
  // rollback
  const r = m.rollback ?? {};
  if (r.rollbackMechanismStatus !== 'ESTABLISHED') fail('ROLLBACK_STATE_INVALID', `rollbackMechanismStatus=${r.rollbackMechanismStatus}`);
  if (r.rollbackIdentityStatus !== 'NOT_ESTABLISHED' || r.currentSuccessorRollbackTarget !== null) fail('ROLLBACK_IDENTITY_ASSERTED_WITHOUT_AUTHORITY', JSON.stringify({s: r.rollbackIdentityStatus, t: r.currentSuccessorRollbackTarget}));
  if (r.deploymentRollbackIdentity !== 'NOT_ESTABLISHED') fail('DEPLOYMENT_IDENTITY_ASSERTED_WITHOUT_AUTHORITY', String(r.deploymentRollbackIdentity));
  if (!r.recoveryEvidence || !r.recoveryEvidence.gitContentAddressedArtifacts || Object.keys(r.recoveryEvidence.gitContentAddressedArtifacts).length === 0) fail('ROLLBACK_RECOVERY_EVIDENCE_MISSING', 'recoveryEvidence');
  else for (const [p, blob] of Object.entries(r.recoveryEvidence.gitContentAddressedArtifacts)) if (worktreeBlob(root, p) !== blob) fail('ROLLBACK_RECOVERY_IDENTITY_DRIFT', p);
  if (!Array.isArray(r.promotionBlockedWhile) || r.promotionBlockedWhile.length < 3 || !Array.isArray(r.interpretationGuards) || r.interpretationGuards.length < 5) fail('ROLLBACK_PROMOTION_GUARD_MISSING', 'promotionBlockedWhile/interpretationGuards');
  if (r.mechanism?.runbookBlob !== worktreeBlob(root, 'release/ROLLBACK_RUNBOOK.md')) fail('ROLLBACK_MECHANISM_IDENTITY_DRIFT', 'release/ROLLBACK_RUNBOOK.md');
  const hist = (m.historicalEvidence ?? []).find((h) => h.id === 'historical.atl-175-rollback-baseline');
  if (!hist || hist.classification !== 'HISTORICAL_ROLLBACK_CONTROL_EVIDENCE' || hist.currentSuccessorRollbackIdentity !== false || hist.blob !== '98296aa26eb563479e666fe6dd007bf422920c6d') fail('HISTORICAL_ROLLBACK_EVIDENCE_MISREPRESENTED', JSON.stringify(hist && {c: hist.classification, cur: hist.currentSuccessorRollbackIdentity, b: hist.blob}));
  for (const h of m.historicalEvidence ?? []) if (h.currentAuthority === true || h.contentAuthority === true) fail('STALE_IDENTITY_AS_AUTHORITY', h.id);
  // release integrity: never certify a baseline that fails its own verification
  const ri = m.releaseIntegrity ?? {}; const liveRi = rebuilt.releaseIntegrity;
  if (liveRi.observedVerification.status === 'FAILS_VERIFICATION' && (ri.certified !== false || ri.manifestCertifiesBaseline !== false || ri.observedVerification?.status !== 'FAILS_VERIFICATION')) fail('INTEGRITY_BASELINE_CERTIFIED_WHILE_FAILING', JSON.stringify({c: ri.certified, s: ri.observedVerification?.status}));
  if (JSON.stringify(sortKeys(ri.observedVerification ?? null)) !== JSON.stringify(sortKeys(liveRi.observedVerification))) fail('RELEASE_INTEGRITY_STATE_DRIFT', 'observedVerification differs from recomputation');
  if (ri.certified !== false) fail('INTEGRITY_BASELINE_CERTIFIED_WHILE_FAILING', 'certified must remain false');
  // runtime / blockers
  const rt = m.runtimeState ?? {};
  const exp = rebuilt.runtimeState;
  if (rt.universalExecutionReady !== false || rt.materializable !== false || rt.runtimeCertification !== false || rt.projectionDisposition !== 'BLOCKED' || rt.runtimeReadiness !== 'NOT_PROMOTED' || rt.independentExecutorProofStatus !== 'NOT_INDEPENDENTLY_PROVEN') fail('RUNTIME_READINESS_PROMOTED', JSON.stringify(rt));
  if (rt.unresolvedBindingCount !== 1 || rt.notCompiledLeafCount !== 4 || rt.blockedByClientBindingLeafCount !== 2 || rt.blockedByKnowledgeGapLeafCount !== 2 || rt.clientBindingState !== 'CLIENT_BINDING_REQUIRED' || rt.knowledgeGapState !== 'BLOCKED') fail('UNRESOLVED_BLOCKER_REMOVED', JSON.stringify(rt));
  if (JSON.stringify(sortKeys(rt)) !== JSON.stringify(sortKeys(exp))) fail('RUNTIME_STATE_DRIFT', 'runtimeState differs from public evidence');
  const d = m.downstream ?? {};
  if (d.release !== 'DO NOT MERGE' || d['ATL-181'] !== 'BLOCKED — WAIT S8-6' || d['S8-5'] !== 'NOT STARTED' || d['S8-6'] !== 'NOT STARTED') fail('DOWNSTREAM_STATE_ALTERED', JSON.stringify(d));
  // optional reproduction of protected identities from the governed lineage (never printed)
  if (reproduce) for (const [id, h] of Object.entries(reproduce)) { const l = byId.get(id); if (!l || l.observed !== h) fail('OUTPUT_HASH_DRIFT', `${id}: reproduced identity differs`); }
  // determinism: the committed manifest must equal a fresh regeneration
  if (serialize(m) !== serialize(rebuilt)) fail('MANIFEST_DRIFT', 'manifest differs from deterministic regeneration');
  return {ok: f.length === 0, failures: f};
}

export function generateManifest(root) {
  const manifest = buildManifest(root);
  const bad = manifest.lineage.filter((l) => l.status !== 'MATCH');
  if (bad.length) throw Error('GENERATION_REFUSED: ' + bad.map((l) => `${l.id}=${l.status}`).join(', '));
  const viol = manifest.exclusions.filter((x) => x.status === 'PRESENT_VIOLATION');
  if (viol.length) throw Error('GENERATION_REFUSED: excluded identity present: ' + viol.map((x) => x.id).join(', '));
  return manifest;
}

// Reproduce the protected derivative identities from the governed lineage (same chain as S8-3E). Returns hashes only.
export async function reproduceProtectedIdentities(root) {
  const u = (p) => import(new URL('file://' + path.join(root, p)));
  const {generateMalkomPackage} = await u('lib/compile/s8-malkom-package.js');
  const {generateMalkomProjection} = await u('lib/compile/s8-malkom-projection.js');
  const {canonicalHash} = await u('lib/compile/workdefinition-compiler.js');
  const {reconstructTask} = await u('lib/compile/source-task-decomposition.js');
  const {compileCorrectedTask} = await u('lib/compile/s8-workdefinition-compiler.js');
  const {generateFlowArtifacts} = await u('lib/compile/s8-flow-bpmn.js');
  const source = JSON.parse(git(root, ['show', `${C.source}:data/modules/road-ltl-v1.4.json`]));
  const run = (s) => JSON.parse(cp.execFileSync(process.execPath, [s], {cwd: root, encoding: 'utf8', maxBuffer: 200000000}));
  const semantics = run('scripts/materialize-operational-semantics-v1.cjs'); const binding = run('scripts/materialize-client-binding-v1.cjs');
  const record = semantics.records.find((r) => r.processId === 'LTL-04'); const task = source.tasks.find((t) => t.taskId === 'LTL-04');
  const pin = {commit: C.source, path: 'data/modules/road-ltl-v1.4.json', blob: 'd06974e9ee86cea59227e0866a98ad5d1367bfad', taskHash: canonicalHash(task), semanticSourceVersion: '1.4'};
  const envelope = reconstructTask(task, pin, record, binding);
  const compiled = compileCorrectedTask(envelope, canonicalHash(envelope.decomposition), semantics, binding);
  const a = generateMalkomPackage(compiled, binding, record);
  const projection = generateMalkomProjection(compiled, a.packageArtifact, a.readiness);
  const flow = generateFlowArtifacts(compiled, a.packageArtifact, a.readiness, projection);
  return {
    'derivative.wd': canonicalHash(compiled), 'derivative.package': canonicalHash(a.packageArtifact), 'derivative.readiness': canonicalHash(a.readiness), 'derivative.projection': canonicalHash(projection),
    'derivative.flow-graph': flow.identities.graphHash, 'derivative.flow-view': flow.identities.flowViewSha256, 'derivative.bpmn': flow.identities.bpmnSha256, 'derivative.svg': flow.identities.svgSha256,
    'source.task-hash': canonicalHash(task), 'source.semantics-record': PROTECTED_SEMANTICS_FROM(semantics, canonicalHash), 'source.client-binding': canonicalHash(binding)
  };
}
function PROTECTED_SEMANTICS_FROM(semantics, canonicalHash) { return canonicalHash(semantics.records.find((r) => r.processId === 'LTL-04')); }
