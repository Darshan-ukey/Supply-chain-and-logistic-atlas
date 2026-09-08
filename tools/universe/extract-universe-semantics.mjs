import fs from 'node:fs';
import vm from 'node:vm';
import { inventoryModuleDeclarations, maskLiterals } from './inventory-module-declarations.mjs';
import crypto from 'node:crypto';

// R0.1A — Universe Semantic Materialization.
//
// Mechanically extracts embedded semantic data structures from a retained Universe HTML
// release shell into a normalized machine-readable payload.
//
// This tool performs NO semantic inference. It does not redesign Universe semantics, create
// Universe 7.4, invent a5-*/scp-* identifiers, build a crosswalk, or alter daughter references.
// It only recovers what is already literally present in the source.
//
// Usage: node tools/universe/extract-universe-semantics.mjs <source.html> [--out <payload.json>] [--report <report.json>]

export const EXTRACTOR_VERSION = 'atlas-universe-semantic-extractor-1.0.0';
export const PAYLOAD_SCHEMA_VERSION = 'atlas-universe-semantic-payload-v2';

/**
 * Declarations excluded from the canonical semantic payload by governed determination.
 * These are NOT heuristics and NOT test conveniences: each carries the governing decision
 * and the source evidence behind it. The declaration itself is never removed from the
 * source or hidden from the inventory; it is materialized, classified and set aside so the
 * exclusion is auditable.
 */
export const GOVERNED_RUNTIME_STATE_EXCLUSIONS = [
  {
    name: 'state',
    classification: 'RUNTIME_UI_STATE',
    determination: 'R0.1B D6',
    sourceEvidence: 'Declared as bindStateAliases(createCanonicalState()); createCanonicalState returns navigationState (family, selection, selectedEntityId) and activeContext (mode, role, movementPatternId, nodeId, jurisdictionId), which are user-interface selection values rather than Universe ontology.'
  }
];

/** Deterministic, key-sorted serialization for stable hashing. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}
export const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
export const canonicalHash = value => sha256(stableStringify(value));

/** Return the inner text of every <script> block. */
function scriptBlocks(html) {
  const out = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/**
 * Find declarations of object/array literals and record the brace/paren depth of each.
 *
 * Scripts here are wrapped in an IIFE, so module-scope data sits at depth 1, not 0. Rather
 * than assume a wrapper shape, the caller selects the shallowest depth at which literal
 * declarations occur and treats that as module scope. Declarations nested deeper are
 * function-local working variables and are reported, not extracted.
 */
function findDeclarations(script) {
  const decls = [];
  let depth = 0, inStr = null, esc = false, inLine = false, inBlock = false;
  for (let i = 0; i < script.length; i++) {
    const c = script[i], n = script[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; continue; }

    // candidate declaration start
    const m = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?=[[{])/.exec(script.slice(i, i + 200));
    if (!m) continue;
    const prev = i === 0 ? '\n' : script[i - 1];
    if (/[\w$.]/.test(prev)) continue; // not a real keyword boundary
    const name = m[1];
    const litStart = i + m[0].length;
    const literalEnd = balancedEnd(script, litStart);
    if (literalEnd < 0) continue;
    // Extend past the literal to the end of the complete declaration expression so
    // declaration-level chained transforms are included (R0.1B D4).
    const exprEnd = declarationExpressionEnd(script, litStart);
    const end = exprEnd > literalEnd ? exprEnd : literalEnd;
    decls.push({
      name,
      literal: script.slice(litStart, end),
      literalOnly: script.slice(litStart, literalEnd),
      chained: end > literalEnd,
      depth,
      end
    });
    i = end - 1;
  }
  return decls;
}

/**
 * From the start of a declaration's right-hand side, return the index of the end of the
 * COMPLETE declaration expression: the first `;` or `,` encountered at declarator depth.
 *
 * This is what makes `const x = [...].map(...)` capture the mapped value rather than the
 * bare literal. Transforms chained inside the declaration expression are part of how the
 * source defines the value (R0.1B D4); statements executed after the declaration are not.
 */
function declarationExpressionEnd(s, start) {
  let depth = 0, inStr = null, esc = false, inLine = false, inBlock = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    if (depth === 0 && (c === ';' || c === ',')) return i;
  }
  return -1;
}

/** Return the index just past the balanced bracket group beginning at `start`. */
function balancedEnd(s, start) {
  let depth = 0, inStr = null, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

const EVAL_TIMEOUT_MS = 5000;

/**
 * Locate the statement-terminating `;` at module depth for each named declaration, whatever
 * the shape of its right-hand side. Uses a masked copy so semicolons inside strings/comments
 * are never mistaken for statement ends. Enables declaration-boundary capture of values built
 * by factory/derivation calls, not only object/array literals.
 */
function namedDeclarationBoundaries(block, names) {
  const masked = maskLiterals(block);
  const depth = new Int32Array(masked.length);
  let d = 0;
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (c === '{' || c === '[' || c === '(') d++;
    else if (c === '}' || c === ']' || c === ')') d--;
    depth[i] = d;
  }
  const all = [];
  const dre = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;
  let m;
  while ((m = dre.exec(masked))) all.push({ name: m[1], at: m.index, depth: depth[m.index] });
  if (!all.length) return [];
  const moduleDepth = Math.min(...all.map(x => x.depth));
  const out = [];
  for (const decl of all) {
    if (decl.depth !== moduleDepth || !names.includes(decl.name)) continue;
    let end = -1;
    for (let i = decl.at; i < masked.length; i++) {
      if (masked[i] === ';' && depth[i] === moduleDepth) { end = i + 1; break; }
    }
    if (end > 0) out.push({ name: decl.name, end });
  }
  return out;
}

/**
 * Extract Universe semantic structures from HTML.
 *
 * Pass 1 evaluates each top-level literal in an empty sandbox (pure literals only).
 * Pass 2 re-attempts the remainder in a sandbox seeded with pass-1 results, recovering
 * structures that merely reference earlier declarations (e.g. spreads/concats).
 * Nothing is inferred: a structure that cannot be evaluated is reported unresolved.
 */
export function extractUniverseSemantics(html, { additionalTargets = [] } = {}) {
  const blocks = scriptBlocks(html);
  const declarations = [];
  blocks.forEach((block, blockIndex) => {
    const found = findDeclarations(block);
    if (!found.length) return;
    // Module scope = shallowest depth at which literal declarations occur in this block.
    const moduleDepth = Math.min(...found.map(d => d.depth));
    for (const d of found) declarations.push({ ...d, blockIndex, moduleScope: d.depth === moduleDepth });
  });

  const topLevel = declarations.filter(d => d.moduleScope);
  const nested = declarations.filter(d => !d.moduleScope);
  const provenance = {};
  for (const d of topLevel) if (provenance[d.name] === undefined) provenance[d.name] = d.blockIndex;

  const values = {};
  const pass1 = [], pass2 = [], unresolved = [];

  for (const d of topLevel) {
    try {
      values[d.name] = vm.runInNewContext(`(${d.literal})`, {}, { timeout: EVAL_TIMEOUT_MS });
      pass1.push(d.name);
    } catch {
      unresolved.push(d);
    }
  }

  // Pass 2 — seeded with what pass 1 recovered. Repeat until no further progress.
  let remaining = unresolved.slice();
  for (let round = 0; round < 5 && remaining.length; round++) {
    const still = [];
    for (const d of remaining) {
      const sandbox = { ...values };
      try {
        values[d.name] = vm.runInNewContext(`(${d.literal})`, sandbox, { timeout: EVAL_TIMEOUT_MS });
        pass2.push(d.name);
      } catch {
        still.push(d);
      }
    }
    if (still.length === remaining.length) break;
    remaining = still;
  }

  // Pass 3 — controlled execution bounded at the governed construction boundary.
  //
  // Each module-scope literal declaration is followed by an injected *deep-snapshot* capture,
  // so the recorded value is the declaration-time value, not a live reference that later
  // runtime code could mutate. Immediately after the last required target is captured, a
  // sentinel throw halts execution deliberately, so no subsequent application/UI logic runs
  // at all. DOM stubs exist only to let construction complete, not to absorb runtime behaviour.
  const CAPTURE_COMPLETE = '__ATLAS_R0_1A_CAPTURE_COMPLETE__';
  const pass3 = [];
  const pass3Termination = [];
  // Targets come from the literal-detection remainder PLUS any externally supplied
  // declaration names (the independent inventory), so completeness is measured against a
  // denominator this module did not produce.
  const extraTargets = additionalTargets.filter(n => !(n in values));
  if (remaining.length || extraTargets.length) {
    blocks.forEach((block, blockIndex) => {
      const found = findDeclarations(block);
      if (!found.length) return;
      const extraPoints = namedDeclarationBoundaries(block, extraTargets);
      const wanted = [
        ...remaining.filter(d => d.blockIndex === blockIndex).map(d => d.name),
        ...extraPoints.map(p => p.name)
      ];
      if (!wanted.length) return;
      const moduleDepth = Math.min(...found.map(d => d.depth));
      // Inject only where a declaration genuinely terminates; a literal followed by a chained
      // call or further declarator is not a safe injection point.
      const literalPoints = found
        .filter(d => d.depth === moduleDepth && /^\s*;/.test(block.slice(d.end, d.end + 40)))
        .map(d => ({ name: d.name, end: d.end }));
      // Merge literal-declaration points with boundaries located for arbitrary declarations.
      const seenEnds = new Set();
      const points = [...literalPoints, ...extraPoints]
        .filter(p => (seenEnds.has(`${p.name}@${p.end}`) ? false : seenEnds.add(`${p.name}@${p.end}`)))
        .sort((a, b) => a.end - b.end);
      if (!points.length) return;

      // Capture at every safe point; terminate after the last point overall so externally
      // supplied targets declared later in the block are still reached.
      const lastWantedEnd = Math.max(...points.map(d => d.end), -1);
      if (lastWantedEnd < 0) return;

      let src = block;
      for (const d of [...points].sort((a, b) => b.end - a.end)) {
        // Deep snapshot at the declaration boundary; JSON round-trip freezes the value.
        let inject = `;try{__cap.${d.name}=JSON.parse(JSON.stringify(${d.name}))}catch(e){};`;
        if (d.end === lastWantedEnd) inject += `throw new Error(${JSON.stringify(CAPTURE_COMPLETE)});`;
        src = `${src.slice(0, d.end)}${inject}${src.slice(d.end)}`;
      }

      const inert = new Proxy(function () {}, {
        get: () => inert, set: () => true, apply: () => inert, construct: () => inert, has: () => true
      });
      const cap = {};
      const sandbox = { __cap: cap, document: inert, window: inert, navigator: inert, location: inert, console: { log() {}, warn() {}, error() {} } };
      let termination = 'UNEXPECTED_NO_THROW';
      try {
        vm.runInNewContext(src, sandbox, { timeout: EVAL_TIMEOUT_MS });
      } catch (e) {
        termination = String(e?.message).includes(CAPTURE_COMPLETE) ? 'DELIBERATE_SENTINEL_AFTER_LAST_CAPTURE' : `EARLY_ABORT: ${String(e?.message).slice(0, 120)}`;
      }
      pass3Termination.push({ blockIndex, termination });

      for (const name of wanted) {
        const v = cap[name];
        if (v === undefined || typeof v === 'function') continue;
        values[name] = v;   // already a JSON deep snapshot taken at declaration time
        if (!pass3.includes(name)) pass3.push(name);
      }
    });
    remaining = remaining.filter(d => !pass3.includes(d.name));
  }

  const structures = {};
  for (const name of Object.keys(values).sort()) structures[name] = values[name];

  const shape = v => Array.isArray(v) ? 'array' : (v && typeof v === 'object' ? 'object' : typeof v);
  const size = v => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);

  const semanticBlockIndex = provenance.universeReleaseMetadata ?? null;

  return {
    structures,
    provenance,
    semanticBlockIndex,
    inventory: Object.keys(structures).map(n => ({ name: n, type: shape(structures[n]), records: size(structures[n]) })),
    extraction: {
      topLevelDeclarations: topLevel.length,
      nestedDeclarationsIgnored: nested.length,
      nestedNames: [...new Set(nested.map(d => d.name))].sort(),
      recoveredPass1: pass1.sort(),
      recoveredPass2: pass2.sort(),
      recoveredPass3: pass3.sort(),
      unresolved: remaining.map(d => d.name).sort(),
      pass3Termination,
      scriptBlocks: blocks.length
    }
  };
}

/**
 * Detect where two extracted structures describe the same underlying records but disagree
 * on field sets. The source enriches record objects between declarations, so a value captured
 * at one declaration boundary can legitimately differ from the same record captured at a later
 * boundary. R0.1A reports this; deciding which boundary is canonical belongs to R0.1B.
 */
export function constructionBoundaryConsistency(structures) {
  // Collect every addressable record collection.
  const sets = [];
  const push = (path, recs) => {
    if (Array.isArray(recs) && recs.length && recs.every(x => x && typeof x === 'object' && typeof x.id === 'string')) {
      sets.push({ path, records: recs, idSignature: recs.map(r => r.id).sort().join('\u0000') });
    }
  };
  for (const [name, value] of Object.entries(structures)) {
    push(name, value);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) push(`${name}.${k}`, v);
    }
  }

  // Entity-aware identity (R0.1B D7 REC-6): two paths describe the SAME logical collection
  // only when they carry the same id set. Comparing on id alone made unrelated entity types
  // that happen to share an id string look divergent, which produced two false findings.
  const collections = new Map();
  for (const set of sets) {
    if (!collections.has(set.idSignature)) collections.set(set.idSignature, []);
    collections.get(set.idSignature).push(set);
  }

  const divergences = [];
  for (const group of collections.values()) {
    if (group.length < 2) continue;
    const perRecord = new Map();
    for (const set of group) {
      for (const r of set.records) {
        if (!perRecord.has(r.id)) perRecord.set(r.id, []);
        perRecord.get(r.id).push({ path: set.path, fields: Object.keys(r).sort().join(',') });
      }
    }
    for (const [id, entries] of perRecord) {
      if (new Set(entries.map(e => e.fields)).size > 1) divergences.push({ recordId: id, observedFieldSets: entries });
    }
  }

  // Records whose id appears in more than one DIFFERENT collection: reported explicitly as
  // heterogeneous id collisions, never as divergence.
  const idToCollections = new Map();
  for (const set of sets) {
    for (const r of set.records) {
      if (!idToCollections.has(r.id)) idToCollections.set(r.id, new Set());
      idToCollections.get(r.id).add(set.idSignature);
    }
  }
  const heterogeneousIdCollisions = [];
  for (const [id, sigs] of idToCollections) {
    if (sigs.size > 1) {
      heterogeneousIdCollisions.push({
        recordId: id,
        paths: sets.filter(s => s.records.some(r => r.id === id)).map(s => s.path).sort(),
        classification: 'DISTINCT_COLLECTIONS_SHARING_AN_ID_NOT_A_DIVERGENCE'
      });
    }
  }

  return {
    status: divergences.length ? 'FIELD_SET_DIVERGENCE_OBSERVED' : 'CONSISTENT',
    identityRule: 'SAME_LOGICAL_COLLECTION_BY_IDENTICAL_ID_SET',
    identityRuleRationale: 'R0.1B D7 REC-6: heterogeneous records must not be compared on id alone.',
    divergentRecordCount: divergences.length,
    affectedPaths: [...new Set(divergences.flatMap(d => d.observedFieldSets.map(f => f.path)))].sort(),
    heterogeneousIdCollisionCount: heterogeneousIdCollisions.length,
    heterogeneousIdCollisions,
    sample: divergences.slice(0, 3)
  };
}

/** Read the self-declared release metadata without interpreting it. */
export function embeddedReleaseIdentity(structures) {
  const m = structures.universeReleaseMetadata;
  if (!m || typeof m !== 'object') return null;
  return { id: m.id ?? null, version: m.version ?? null, releaseDate: m.releaseDate ?? null, classification: m.classification ?? null };
}

export function buildPayload({ sourcePath, html, releaseShellVersion, additionalTargets = null }) {
  // Completeness denominator comes from the independent declaration inventory.
  const inventory = inventoryModuleDeclarations(html);
  const targets = additionalTargets ?? inventory.mustMaterialize;
  const result = extractUniverseSemantics(html, { additionalTargets: targets });
  // Apply governed runtime-state exclusions (R0.1B D6). Excluded declarations remain in the
  // inventory and in excludedRuntimeState so the decision stays auditable.
  const excludedRuntimeState = [];
  for (const rule of GOVERNED_RUNTIME_STATE_EXCLUSIONS) {
    if (rule.name in result.structures) {
      excludedRuntimeState.push({
        ...rule,
        materialized: true,
        topLevelKeys: Object.keys(result.structures[rule.name] ?? {}).sort(),
        excludedFromCanonicalPayload: true
      });
      delete result.structures[rule.name];
    }
  }

  // Recompute the inventory view so reported structures/records describe the CANONICAL
  // payload after governed exclusions, not the pre-exclusion extraction.
  const shapeOf = v => Array.isArray(v) ? 'array' : (v && typeof v === 'object' ? 'object' : typeof v);
  const sizeOf = v => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);
  result.inventory = Object.keys(result.structures).map(n => ({ name: n, type: shapeOf(result.structures[n]), records: sizeOf(result.structures[n]) }));

  result.inventoryDenominator = {
    totalModuleScopeDeclarations: inventory.totalModuleScopeDeclarations,
    mustMaterialize: inventory.mustMaterialize,
    mustMaterializeCount: inventory.mustMaterializeCount,
    governedRuntimeStateExclusions: GOVERNED_RUNTIME_STATE_EXCLUSIONS.map(r => r.name).sort(),
    materialized: inventory.mustMaterialize.filter(n => n in result.structures).sort(),
    notMaterialized: inventory.mustMaterialize
      .filter(n => !(n in result.structures) && !GOVERNED_RUNTIME_STATE_EXCLUSIONS.some(r => r.name === n)).sort(),
    excludedByClassification: {
      FUNCTION_HELPER: inventory.byClassification.FUNCTION_HELPER || [],
      SCALAR_CONFIG: inventory.byClassification.SCALAR_CONFIG || [],
      RUNTIME_UI_STATE: inventory.byClassification.RUNTIME_UI_STATE || []
    }
  };
  const identity = embeddedReleaseIdentity(result.structures);
  const payload = {
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    classification: 'MECHANICAL_SEMANTIC_MATERIALIZATION_NO_INFERENCE',
    stageId: 'R0.1A',
    extractorVersion: EXTRACTOR_VERSION,
    // Dual lineage preserved: the release shell and the embedded semantic identity are
    // recorded separately. R0.1A does not decide which is authoritative.
    lineage: {
      releaseShellVersion: releaseShellVersion ?? null,
      embeddedSemanticIdentity: identity,
      identityReconciliation: 'PENDING_R0_1B',
      sourcePath,
      sourceSha256: sha256(Buffer.from(html, 'utf8'))
    },
    referenceResolution: {
      status: 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT',
      note: 'Daughter a5-* / scp-* identifiers are not resolved by this materialization. Ownership is determined in R0.1C and must not be presumed here.'
    },
    excludedRuntimeState,
    structures: result.structures,
    structureProvenance: result.provenance,
    semanticBlockIndex: result.semanticBlockIndex
  };
  return { payload, result };
}

// ----------------------------------------------------------------- CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, ...rest] = process.argv.slice(2);
  if (!src) { console.error('Usage: extract-universe-semantics.mjs <source.html> [--out f] [--report f] [--release-shell v]'); process.exit(2); }
  const arg = f => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : null; };
  const html = fs.readFileSync(src, 'utf8');
  const { payload, result } = buildPayload({ sourcePath: src, html, releaseShellVersion: arg('--release-shell') || '7.3' });

  const payloadHash = canonicalHash(payload);
  const semanticHash = canonicalHash(payload.structures);

  console.log(`source                : ${src}`);
  console.log(`source sha256         : ${payload.lineage.sourceSha256}`);
  console.log(`release shell         : ${payload.lineage.releaseShellVersion}`);
  console.log(`embedded identity     : ${JSON.stringify(payload.lineage.embeddedSemanticIdentity)}`);
  console.log(`top-level decls       : ${result.extraction.topLevelDeclarations}`);
  console.log(`recovered pass 1      : ${result.extraction.recoveredPass1.length}`);
  console.log(`recovered pass 2      : ${result.extraction.recoveredPass2.length}`);
  console.log(`recovered pass 3      : ${result.extraction.recoveredPass3.length}`);
  console.log(`unresolved            : ${result.extraction.unresolved.length} ${result.extraction.unresolved.join(', ')}`);
  console.log(`nested decls ignored  : ${result.extraction.nestedDeclarationsIgnored}`);
  console.log(`structures            : ${result.inventory.length}`);
  console.log(`total records         : ${result.inventory.reduce((n, x) => n + x.records, 0)}`);
  console.log(`semantic payload hash : ${semanticHash}`);
  console.log(`full payload hash     : ${payloadHash}`);

  const out = arg('--out');
  if (out) { fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`); console.log(`payload written       : ${out}`); }
  const rep = arg('--report');
  if (rep) {
    const report = {
      schemaVersion: 'atlas-universe-extraction-report-v1',
      stageId: 'R0.1A',
      extractorVersion: EXTRACTOR_VERSION,
      source: { path: src, sha256: payload.lineage.sourceSha256 },
      releaseShellVersion: payload.lineage.releaseShellVersion,
      embeddedSemanticIdentity: payload.lineage.embeddedSemanticIdentity,
      hashes: { semanticStructures: semanticHash, fullPayload: payloadHash },
      completeness: {
        topLevelDeclarations: result.extraction.topLevelDeclarations,
        recoveredPass1: result.extraction.recoveredPass1.length,
        recoveredPass2: result.extraction.recoveredPass2.length,
        recoveredPass3: result.extraction.recoveredPass3.length,
        unresolvedCount: result.extraction.unresolved.length,
        unresolved: result.extraction.unresolved,
        nestedDeclarationsIgnored: result.extraction.nestedDeclarationsIgnored,
        nestedNamesIgnored: result.extraction.nestedNames,
        independentInventory: result.inventoryDenominator
      },
      structureProvenance: result.provenance,
      semanticBlockIndex: result.semanticBlockIndex,
      constructionBoundaryConsistency: constructionBoundaryConsistency(payload.structures),
      inventory: result.inventory.sort((a, b) => b.records - a.records || a.name.localeCompare(b.name)),
      totalRecords: result.inventory.reduce((n, x) => n + x.records, 0)
    };
    fs.writeFileSync(rep, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report written        : ${rep}`);
  }
}
