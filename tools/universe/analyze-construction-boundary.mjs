import fs from 'node:fs';
import { maskLiterals } from './inventory-module-declarations.mjs';

// R0.1B — evidence tooling for construction-boundary determination.
//
// Distinguishes two mechanically different phenomena that both change a record's field set:
//   (a) transforms chained INSIDE the declaration expression (e.g. `= [...].map(...)`)
//   (b) separate mutation statements executed AFTER the declaration (e.g. `x.forEach(r=>{r.f=...})`)
//
// It reports where each occurs. It does not rewrite any payload.

/** Module-scope declarations whose object/array literal is followed by a chained call. */
export function chainedDeclarations(html) {
  const out = [];
  const re = /(?:^|[^\w$.])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?=[[{])/g;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1];
    let i = re.lastIndex, d = 0, s = null, esc = false;
    for (; i < html.length; i++) {
      const c = html[i];
      if (s) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === s) s = null; continue; }
      if (c === '"' || c === "'" || c === '`') { s = c; continue; }
      if (c === '[' || c === '{') d++;
      else if (c === ']' || c === '}') { d--; if (d === 0) { i++; break; } }
    }
    const after = html.slice(i, i + 120);
    if (/^\s*\./.test(after)) {
      out.push({ name, chainedExpression: after.replace(/\s+/g, ' ').slice(0, 90) });
    }
  }
  return out;
}

/** Statements that mutate an already-declared structure's records after declaration. */
export function postDeclarationMutations(html) {
  const masked = maskLiterals(html);
  const out = [];
  const re = /([A-Za-z_$][\w$]*)\s*\.\s*forEach\s*\(\s*([A-Za-z_$][\w$]*)\s*=>\s*\{\s*\2\s*\.\s*([A-Za-z_$][\w$]*)\s*=/g;
  let m;
  while ((m = re.exec(masked))) out.push({ target: m[1], fieldAdded: m[3] });
  return out;
}

/** Records reachable from more than one structure with differing field sets. */
export function fieldSetDivergence(structures) {
  const sets = [];
  const push = (path, recs) => {
    if (Array.isArray(recs) && recs.length && recs.every(r => r && typeof r === 'object' && typeof r.id === 'string')) sets.push({ path, recs });
  };
  for (const [k, v] of Object.entries(structures)) {
    push(k, v);
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) push(`${k}.${k2}`, v2);
  }
  const byId = new Map();
  for (const s of sets) for (const r of s.recs) {
    if (!byId.has(r.id)) byId.set(r.id, []);
    byId.get(r.id).push({ path: s.path, fields: Object.keys(r).sort().join(',') });
  }
  const groups = new Map();
  for (const [, entries] of byId) {
    if (new Set(entries.map(e => e.fields)).size < 2) continue;
    const key = entries.map(e => e.path).sort().join(' | ');
    if (!groups.has(key)) groups.set(key, { pathSet: key, count: 0, observedFieldSets: entries });
    groups.get(key).count++;
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, payloadPath, ...rest] = process.argv.slice(2);
  const html = fs.readFileSync(src, 'utf8');
  const structures = JSON.parse(fs.readFileSync(payloadPath, 'utf8')).structures;
  const chained = chainedDeclarations(html);
  const mutations = postDeclarationMutations(html);
  const divergence = fieldSetDivergence(structures);

  console.log('chained declaration expressions:');
  for (const c of chained) console.log(`  ${c.name.padEnd(26)} ${c.chainedExpression.slice(0, 60)}`);
  console.log('\npost-declaration mutation statements:');
  for (const mu of mutations) console.log(`  ${mu.target.padEnd(26)} adds .${mu.fieldAdded}`);
  console.log('\nfield-set divergence groups:');
  for (const g of divergence) console.log(`  ${String(g.count).padStart(4)}  ${g.pathSet}`);

  const oi = rest.indexOf('--out');
  if (oi >= 0) {
    fs.writeFileSync(rest[oi + 1], `${JSON.stringify({
      schemaVersion: 'atlas-universe-construction-boundary-evidence-v1',
      stageId: 'R0.1B',
      source: src,
      chainedDeclarations: chained,
      postDeclarationMutations: mutations,
      fieldSetDivergenceGroups: divergence,
      totalDivergentRecords: divergence.reduce((n, g) => n + g.count, 0)
    }, null, 2)}\n`);
    console.log(`\nwritten: ${rest[oi + 1]}`);
  }
}
