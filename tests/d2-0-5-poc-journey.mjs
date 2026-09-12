import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

// D2.0.5 certification. The POC journey page makes factual claims about Atlas's state.
// This suite asserts every one of those claims still matches the committed artifact it came
// from, so the page cannot silently drift out of truth as the underlying data changes.

const PAGE = 'atlas-poc-journey.html';
const html = fs.readFileSync(PAGE, 'utf8');
const content = html.replace(/<style>[\s\S]*?<\/style>/g, ''); // strip CSS before text assertions

const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const gz = p => JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(p, 'utf8').trim(), 'base64')));

// =============================================================================
// 1. GUARDRAIL: NO_FAKE_NUMERIC_COMPLETENESS_SCORE
// =============================================================================
const pct = content.match(/\b\d{1,3}\s?%/g);
assert.equal(pct, null, `no percentage may appear in visible content, found: ${pct}`);
for (const word of ['complete', 'completion']) {
  const m = content.match(new RegExp(`\\d+\\s*(?:percent|%)?[^.]{0,20}${word}`, 'i'));
  assert.equal(m, null, `no numeric completeness claim allowed (matched: ${m})`);
}
assert.match(content, /no completion percentage/i,
  'the page must explicitly explain why no score is given');

// =============================================================================
// 2. GUARDRAIL: TRACE_LINEAGE_ACCURATELY — the decisive one.
// =============================================================================
const mk = J('data/materialized/road-ltl-v2.3-malkom-reference-projection.json');
assert.equal(mk.lineage.sourceModel, 'Road LTL V1.2',
  'underlying artifact must still be V1.2-sourced');
assert.match(content, /V1\.2/, 'the page must name V1.2 as the Malkom source lineage');
assert.match(content, /not<\/strong>\s*generated from/i,
  'the page must explicitly disclaim that Malkom output came from the governed lineage');
for (const term of ['Road LTL 1.5', 'decomposition', 'WorkDefinition compiler']) {
  assert.ok(content.includes(term),
    `the disclaimer must name what the output did NOT come from: ${term}`);
}
// Both lineages must be presented, visually separated.
assert.match(content, /Governed target lineage/);
assert.match(content, /Proven reference lineage/);

// Pending states must remain marked pending, not quietly upgraded.
for (const pending of ['proven, not persisted', 'incomplete']) {
  assert.ok(content.includes(pending), `pending state must remain visible: ${pending}`);
}

// =============================================================================
// 3. EVERY STATED NUMBER MUST MATCH ITS COMMITTED ARTIFACT
// =============================================================================
const cat = J('data/module-catalog.json');
assert.equal(cat.baseModule.version, '6.2.2');
assert.ok(content.includes('v6.2.2'), 'page must state the real Page 0 version');

const active = Object.fromEntries(cat.modules.map(m => [m.id, m.version]));
assert.equal(active['road-ltl'], '1.3');
assert.equal(active['ocean-fcl'], '0.5');
assert.equal(active['ocean-lcl'], '0.5');
assert.ok(content.includes('road-ltl v1.3'), 'page must state the real Road LTL baseline');
assert.ok(content.includes('ocean-fcl v0.5') && content.includes('ocean-lcl v0.5'));

const tgt = J('governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json').targets;
assert.equal(tgt['road-ltl'].daughterModuleVersion, '1.5');
assert.equal(tgt['ocean-fcl'].daughterModuleVersion, '0.6');
assert.ok(content.includes('1.3 → 1.5'), 'page must state the real Road LTL bridge hop');
assert.ok(content.includes('0.5 → 0.6'), 'page must state the real Ocean bridge hop');

const ltl = gz('data/materialized/road-ltl-1.5-public-safe-projections.json.gz.b64');
const oc = gz('data/materialized/ocean-0.6-public-safe-projections.json.gz.b64');
const ltlN = Object.keys(ltl.sources['road-ltl@1.5']).length;
const fclN = Object.keys(oc.sources['ocean-fcl@0.6']).length;
const lclN = Object.keys(oc.sources['ocean-lcl@0.6']).length;
assert.equal(ltlN, 22); assert.equal(fclN, 30); assert.equal(lclN, 30);
assert.ok(content.includes(`${ltlN + fclN + lclN} tasks projected`),
  `page's total task count must equal ${ltlN + fclN + lclN}`);
assert.ok(content.includes(`Road LTL ${ltlN}`) && content.includes(`Ocean FCL ${fclN}`),
  'page must break the total down accurately');

assert.equal(mk.summary.adapterCompatible, 22);
assert.equal(mk.summary.materializable, 22);
assert.ok(content.includes('22 / 22 compatible') && content.includes('22 / 22 materializable'));

const bindings = mk.knownLossesAndGaps.clientBindingRequired.totalPoints;
assert.equal(bindings, 176);
assert.ok(content.includes(`${bindings} client bindings required`),
  'page must state the real binding count');

// =============================================================================
// 4. GUARDRAIL: gaps disclosed, and disclosed accurately
// =============================================================================
const esc = mk.knownLossesAndGaps.escalateHandling.affectedTasks;
for (const t of esc) {
  assert.ok(content.includes(t), `escalation-limited task must be named on the page: ${t}`);
}
for (const op of mk.knownLossesAndGaps.adapterOperationsNotEnabled) {
  assert.ok(content.includes(op), `unavailable adapter operation must be disclosed: ${op}`);
}
assert.match(content, /none resolved, none invented/i,
  'binding honesty statement must be present');

// =============================================================================
// 5. GUARDRAIL: SHOW_GOVERNANCE_EVIDENCE_ON_DEMAND_NOT_AS_PRIMARY_PITCH
// =============================================================================
const detailsCount = (content.match(/<details>/g) || []).length;
assert.ok(detailsCount >= 3, 'governance evidence must sit behind collapsible disclosure');
const journeyIdx = content.indexOf('The journey');
const evidenceIdx = content.indexOf('Evidence, on demand');
assert.ok(journeyIdx > -1 && evidenceIdx > journeyIdx,
  'the journey must precede the governance evidence section, not follow it');

// =============================================================================
// 6. STRUCTURAL INTEGRITY + LINKS RESOLVE
// =============================================================================
for (const tag of ['html', 'head', 'body', 'section', 'details', 'table', 'div', 'footer']) {
  const o = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
  const c = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  assert.equal(o, c, `unbalanced <${tag}> tags: ${o} open, ${c} close`);
}
for (const href of [...content.matchAll(/href="([^"#]+)"/g)].map(m => m[1])) {
  assert.ok(fs.existsSync(href), `page links to a file that does not exist: ${href}`);
}
assert.match(content, /not a production promotion/i,
  'the page must carry its demo-candidate disclaimer');

console.log('D2.0.5 POC journey certification PASS');
console.log(`  ${ltlN + fclN + lclN} tasks traced (LTL ${ltlN} · FCL ${fclN} · LCL ${lclN}) | Malkom 22/22 | ${bindings} bindings | ${esc.length} escalation-limited tasks named`);
console.log(`  no completeness score; ${detailsCount} evidence panels behind disclosure; all links resolve`);
