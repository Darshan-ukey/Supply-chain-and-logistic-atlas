import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { chainedDeclarations, postDeclarationMutations, fieldSetDivergence } from '../tools/universe/analyze-construction-boundary.mjs';

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const SRC_A = 'reference/universe-v7.3.html';
const SRC_B = 'frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html';
const NOTES = 'frozen-assets/inbox/supply-chain-logistics-universe-v7.3/UNIVERSE_V7_3_RELEASE_NOTES.md';
const D = JSON.parse(fs.readFileSync('governance/recovery/R0.1B/UNIVERSE_IDENTITY_AUTHORITY_DETERMINATION.json', 'utf8'));
const payload = JSON.parse(fs.readFileSync('data/universe/universe-semantic-payload.json', 'utf8'));
const html = fs.readFileSync(SRC_A, 'utf8');

// ------------------------------------------------- inputs are the certified R0.1A artifacts
assert.equal(D.inputs.semanticPayloadSha256, sha('data/universe/universe-semantic-payload.json'),
  'determination must cite the exact certified payload it analysed');
assert.equal(D.stageId, 'R0.1B');
assert.equal(D.status, 'CANDIDATE_AWAITING_INDEPENDENT_QA');

// ------------------------------------------------------------------ D1 evidence holds
const d1 = D.D1_sourceCopyDifferenceClassification;
assert.deepEqual(d1.structures.slice().sort(), ['defaults', 'liveModuleRoutes', 'moduleCoverageStatus']);
// each copy's navigation must match the daughters packaged beside it
const daughtersB = fs.readdirSync('frozen-assets/inbox/supply-chain-logistics-universe-v7.3/daughters').sort();
const daughtersA = fs.readdirSync('frozen-assets/inbox/ocean-fcl-lcl-v0.5-v7.3/site/daughters').sort();
assert.ok(daughtersB.includes('road-ltl-v1.2.html'), 'copy B package ships Road LTL v1.2');
assert.ok(daughtersA.includes('road-ltl-v1.3.html'), 'copy A package ships Road LTL v1.3');
const htmlB = fs.readFileSync(SRC_B, 'utf8');
assert.ok(htmlB.includes('daughters/road-ltl-v1.2.html'), 'copy B navigation targets the daughters shipped beside it');
assert.ok(html.includes('daughters/road-ltl-v1.3.html'), 'copy A navigation targets the daughters shipped beside it');
// release notes corroborate copy B as the documented release shell
const notes = fs.readFileSync(NOTES, 'utf8');
assert.match(notes, /Road LTL V1\.2/, 'release notes document Road LTL V1.2');
assert.match(notes, /Ocean FCL V0\.4/, 'release notes document Ocean FCL V0.4');
// no Universe ontology structure differs
const comparison = JSON.parse(fs.readFileSync('data/universe/universe-copy-comparison.json', 'utf8'));
assert.deepEqual(comparison.differingStructures.map(x => x.name).sort(), d1.structures.slice().sort(),
  'only the three navigation structures differ');

// ------------------------------------------------------------------ D2 authority
const d2 = D.D2_authority;
assert.equal(d2.releaseShellAuthority.sha256, sha(SRC_B), 'release shell authority must cite the real copy hash');
assert.equal(d2.laterRepackage.sha256, sha(SRC_A));
assert.notEqual(d2.releaseShellAuthority.sha256, d2.laterRepackage.sha256);
assert.ok(d2.semanticPayloadAuthority.condition.includes('remediat'),
  'semantic authority must be conditional on defect remediation');

// ------------------------------------------------------------------ D3 release identity
const d3 = D.D3_releaseIdentity;
assert.equal(d3.releaseVersion.value, '7.3');
assert.equal(d3.semanticPayloadVersion.value, '7.2.0');
assert.equal(payload.lineage.embeddedSemanticIdentity.version, '7.2.0', 'evidence must come from the payload, not assumption');
assert.match(notes, /primarily a frozen UX\/foundation release/i, 'release notes must support the shell-vs-semantics reading');
assert.match(notes, /No V7\.2 canonical business\/ontology\/source semantics are removed/i);
assert.ok(d3.prohibitedAction.includes('Relabeling'), 'determination must forbid unsupported relabeling');

// ------------------------------------------------- D4 boundary rule matches the source
const chained = chainedDeclarations(html).map(c => c.name);
const mutations = postDeclarationMutations(html);
assert.ok(chained.includes('systemRecords') && chained.includes('businessObjectRecords'),
  'both affected structures must be chained declarations in the source');
assert.ok(mutations.some(m => m.target === 'systemRecords' && m.fieldAdded === 'domainIds'),
  'domainIds must be shown as a post-declaration mutation');
assert.match(html, /\]\s*\.map\(record=>\(\{\.\.\.record,description:/, 'description must be added inside the declaration expression');

// -------------------------------------------------- D5 defect is real and quantified
const d5 = D.D5_fieldSetDivergence;
const groups = fieldSetDivergence(payload.structures);
const total = groups.reduce((n, g) => n + g.count, 0);
assert.equal(total, d5.defectRecordCount + d5.artifactRecordCount, 'divergence breakdown must sum to the observed total');
assert.equal(d5.defectRecordCount, 109 + 78);
// the defect: declared description missing from the payload's own copies
assert.ok(!('description' in payload.structures.systemRecords[0]),
  'defect must be demonstrable: systemRecords lacks the declared description field');
assert.ok('description' in payload.structures.firstClassEntities.systems[0],
  'the same records reached via firstClassEntities do carry description');
assert.deepEqual(d5.affectedStructures.slice().sort(), ['businessObjectRecords', 'systemRecords']);

// ------------------------------------------------------------------ D6 state
const d6 = D.D6_stateClassification;
assert.equal(d6.determination, 'RUNTIME_UI_STATE_EXCLUDE_FROM_CANONICAL_SEMANTIC_PAYLOAD');
assert.ok('state' in payload.structures, 'state is currently in the payload, which is why it needed classification');
assert.ok(payload.structures.state.navigationState || payload.structures.state.activeContext,
  'state must demonstrably contain UI navigation/context values');

// ------------------------------------------------------- R0.1B changed nothing it must not
// The certified R0.1A artifacts must be untouched by this stage.
const r0a = JSON.parse(fs.readFileSync('governance/recovery/R0.1A/POST_IMPLEMENTATION_PRE_QA.json', 'utf8'));
assert.equal(r0a.stageId, 'R0.1A');
assert.equal(payload.lineage.identityReconciliation, 'PENDING_R0_1B',
  'R0.1B must not mutate the R0.1A payload, including its reconciliation marker');
assert.equal(payload.referenceResolution.status, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT',
  'R0.1B must not perform R0.1C reference-ownership work');
for (const c of D.outOfScopeConfirmations) assert.equal(typeof c, 'string');
assert.ok(D.outOfScopeConfirmations.some(c => /7\.4/.test(c)));
assert.ok(!fs.existsSync('governance/recovery/R0.1B/POST_QA_GOVERNED_STATE.json'),
  'implementation agent must not write Checkpoint C');

// recommendations must be advisory only
for (const r of D.D7_recommendedGovernedTreatment.recommendations) {
  assert.ok(r.id && r.action && r.priority, 'each recommendation must be structured');
}
assert.match(D.D7_recommendedGovernedTreatment.note, /Recommendations only/i);

console.log('R0.1B Universe identity & authority determination certification PASS');
