import fs from 'node:fs';
import vm from 'node:vm';
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
export const PAYLOAD_SCHEMA_VERSION = 'atlas-universe-semantic-payload-v1';

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
    const end = balancedEnd(script, litStart);
    if (end < 0) continue;
    decls.push({ name, literal: script.slice(litStart, end), depth, end });
    i = end - 1;
  }
  return decls;
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
 * Extract Universe semantic structures from HTML.
 *
 * Pass 1 evaluates each top-level literal in an empty sandbox (pure literals only).
 * Pass 2 re-attempts the remainder in a sandbox seeded with pass-1 results, recovering
 * structures that merely reference earlier declarations (e.g. spreads/concats).
 * Nothing is inferred: a structure that cannot be evaluated is reported unresolved.
 */
export function extractUniverseSemantics(html) {
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

  // Pass 3 — controlled whole-block execution for structures built by data-factory helpers
  // (e.g. sourceRecords built via S(...)). Module-scope declarations are rewritten to
  // assignments on a capture object and the block is executed in an isolated sandbox with
  // inert DOM stubs. Execution stops at the first DOM-dependent statement; whatever was
  // declared before that point is captured verbatim. No value is inferred or synthesized.
  const pass3 = [];
  if (remaining.length) {
    blocks.forEach((block, blockIndex) => {
      const wanted = remaining.filter(d => d.blockIndex === blockIndex).map(d => d.name);
      if (!wanted.length) return;
      // Preserve every original binding and append a capture statement after each
      // module-scope literal declaration. Nothing is rewritten or removed, so all
      // subsequent references still resolve exactly as in the source.
      const found = findDeclarations(block);
      if (!found.length) return;
      const moduleDepth = Math.min(...found.map(d => d.depth));
      // Only inject where the declaration genuinely terminates. A literal followed by a
      // chained call or a further declarator is not a safe injection point, and injecting
      // there would corrupt the source rather than capture it.
      const points = found
        .filter(d => d.depth === moduleDepth && /^\s*;/.test(block.slice(d.end, d.end + 40)))
        .sort((a, b) => b.end - a.end);
      let src = block;
      for (const d of points) src = `${src.slice(0, d.end)};__cap.${d.name}=${d.name};${src.slice(d.end)}`;

      const inert = new Proxy(function () {}, {
        get: () => inert, set: () => true, apply: () => inert, construct: () => inert, has: () => true
      });
      const cap = {};
      const sandbox = { __cap: cap, document: inert, window: inert, navigator: inert, location: inert, console: { log() {}, warn() {}, error() {} } };
      try { vm.runInNewContext(src, sandbox, { timeout: EVAL_TIMEOUT_MS }); } catch { /* partial capture retained */ }
      for (const name of wanted) {
        const v = cap[name];
        if (v === undefined || typeof v === 'function') continue;
        let plain;
        try { plain = JSON.parse(JSON.stringify(v)); } catch { continue; }
        values[name] = plain;
        pass3.push(name);
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
      scriptBlocks: blocks.length
    }
  };
}

/** Read the self-declared release metadata without interpreting it. */
export function embeddedReleaseIdentity(structures) {
  const m = structures.universeReleaseMetadata;
  if (!m || typeof m !== 'object') return null;
  return { id: m.id ?? null, version: m.version ?? null, releaseDate: m.releaseDate ?? null, classification: m.classification ?? null };
}

export function buildPayload({ sourcePath, html, releaseShellVersion }) {
  const result = extractUniverseSemantics(html);
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
        nestedNamesIgnored: result.extraction.nestedNames
      },
      structureProvenance: result.provenance,
      semanticBlockIndex: result.semanticBlockIndex,
      inventory: result.inventory.sort((a, b) => b.records - a.records || a.name.localeCompare(b.name)),
      totalRecords: result.inventory.reduce((n, x) => n + x.records, 0)
    };
    fs.writeFileSync(rep, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report written        : ${rep}`);
  }
}
