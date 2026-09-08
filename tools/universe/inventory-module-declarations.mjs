import { PRODUCING_STAGE_ID } from './extract-universe-semantics.mjs';
import fs from 'node:fs';

// INDEPENDENT module-scope declaration inventory.
// Corrected implementation produced under R0.1A-R; see extract-universe-semantics.mjs.
//
// Deliberately does NOT reuse the extractor's parser. It masks strings/comments first, then
// enumerates every module-scope declaration regardless of right-hand-side shape, so extraction
// completeness can be judged against a denominator the extractor did not produce.
//
// Classification is by syntactic shape only. No semantic judgement is made about the content.
//
// Usage: node tools/universe/inventory-module-declarations.mjs <source.html> [--out inventory.json]

/** Replace string/template/comment bodies with filler of identical length, preserving offsets. */
export function maskLiterals(src) {
  const out = src.split('');
  let i = 0;
  const blank = (a, b) => { for (let k = a; k < b && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e; blank(i, end); i = end; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; blank(i, end); i = end; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, esc = false;
      for (; j < src.length; j++) {
        if (esc) { esc = false; continue; }
        if (src[j] === '\\') { esc = true; continue; }
        if (src[j] === c) break;
      }
      blank(i + 1, j); i = j + 1; continue;
    }
    i++;
  }
  return out.join('');
}

const CLASSES = {
  DATA_STRUCTURE_LITERAL: 'canonical data structure — must materialize',
  CALL_DERIVED_DATA: 'data built by a factory/constructor call — must materialize if it yields data',
  FUNCTION_HELPER: 'function/arrow helper — tooling, not semantic payload',
  SCALAR_CONFIG: 'scalar/config value — not a data structure',
  RUNTIME_UI_STATE: 'DOM/runtime state — excluded from semantic payload',
  UNCLASSIFIED_CANDIDATE: 'shape not recognised — must be reported explicitly'
};

function classify(rhs) {
  const t = rhs.trimStart();
  if (/^[[{]/.test(t)) return 'DATA_STRUCTURE_LITERAL';
  if (/^(?:function\b|async\b|\(|[A-Za-z_$][\w$]*\s*=>)/.test(t) && /=>|function/.test(t.slice(0, 200))) return 'FUNCTION_HELPER';
  if (/^(?:document|window|navigator|location)\b/.test(t)) return 'RUNTIME_UI_STATE';
  if (/^\$\$?\s*\(/.test(t)) return 'RUNTIME_UI_STATE';           // DOM selector helper
  if (/^[A-Za-z_$][\w$]*\s*\(\s*['"`]?#/.test(t)) return 'RUNTIME_UI_STATE';
  if (/^new\s+[A-Za-z_$]/.test(t)) return 'RUNTIME_UI_STATE';
  if (/^[A-Za-z_$][\w$.]*\s*\(/.test(t)) return 'CALL_DERIVED_DATA';
  if (/^(?:['"`]|-?\d|true\b|false\b|null\b|undefined\b)/.test(t)) return 'SCALAR_CONFIG';
  if (/^[A-Za-z_$][\w$.]*\s*(?:\.|\[|;|$)/.test(t)) return 'CALL_DERIVED_DATA';
  return 'UNCLASSIFIED_CANDIDATE';
}

export function inventoryModuleDeclarations(html) {
  const blocks = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);

  const declarations = [];
  blocks.forEach((block, blockIndex) => {
    const masked = maskLiterals(block);
    // depth at every offset
    const depth = new Int32Array(masked.length);
    let d = 0;
    for (let i = 0; i < masked.length; i++) {
      const c = masked[i];
      if (c === '{' || c === '[' || c === '(') d++;
      else if (c === '}' || c === ']' || c === ')') d--;
      depth[i] = d;
    }
    const found = [];
    const dre = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;
    let dm;
    while ((dm = dre.exec(masked))) {
      const at = dm.index;
      found.push({ name: dm[2], keyword: dm[1], depth: depth[at], rhsStart: dm.index + dm[0].length, blockIndex });
    }
    if (!found.length) return;
    const moduleDepth = Math.min(...found.map(x => x.depth));
    for (const f of found) {
      if (f.depth !== moduleDepth) continue;
      // classify using the ORIGINAL text so string content is visible to the classifier
      const rhs = block.slice(f.rhsStart, f.rhsStart + 300);
      declarations.push({ name: f.name, keyword: f.keyword, blockIndex: f.blockIndex, classification: classify(rhs) });
    }
  });

  const byClass = {};
  for (const d of declarations) (byClass[d.classification] ||= []).push(d.name);
  for (const k of Object.keys(byClass)) byClass[k] = [...new Set(byClass[k])].sort();

  const mustMaterialize = [...new Set([...(byClass.DATA_STRUCTURE_LITERAL || []), ...(byClass.CALL_DERIVED_DATA || [])])].sort();

  return {
    schemaVersion: 'atlas-universe-declaration-inventory-v1',
    stageId: PRODUCING_STAGE_ID,
    classificationLegend: CLASSES,
    totalModuleScopeDeclarations: declarations.length,
    distinctNames: [...new Set(declarations.map(d => d.name))].length,
    byClassification: byClass,
    mustMaterialize,
    mustMaterializeCount: mustMaterialize.length
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, ...rest] = process.argv.slice(2);
  if (!src) { console.error('Usage: inventory-module-declarations.mjs <source.html> [--out f]'); process.exit(2); }
  const inv = inventoryModuleDeclarations(fs.readFileSync(src, 'utf8'));
  console.log(`module-scope declarations : ${inv.totalModuleScopeDeclarations} (${inv.distinctNames} distinct names)`);
  for (const [k, v] of Object.entries(inv.byClassification)) console.log(`  ${k.padEnd(24)} ${String(v.length).padStart(3)}`);
  console.log(`must materialize          : ${inv.mustMaterializeCount}`);
  const oi = rest.indexOf('--out');
  if (oi >= 0) { fs.writeFileSync(rest[oi + 1], `${JSON.stringify(inv, null, 2)}\n`); console.log(`written                   : ${rest[oi + 1]}`); }
}
