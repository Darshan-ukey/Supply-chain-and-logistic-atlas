// W1-09 step 2: seeded draw of 40 business objects, 10 systems, 10 documents/events from the extracted V7.3 registries.
// Method as W1-08: mulberry32(20261010) + Fisher-Yates (i = n-1..1, j = floor(rnd()*(i+1))), first k taken.
// The generator is RE-SEEDED with 20261010 for each stratum so that strata are independent of each other and of evaluation order.
// Populations are in registry (document) order: businessObjectRecords (128); systemRecords (78);
// documents/events pooled as documentRecords (19) then eventRecords (9) = 28.
// usage: node select.mjs <data.json> <out.json>
import fs from 'fs'; import crypto from 'crypto';
const [,, dataPath, outPath] = process.argv;
const D = JSON.parse(fs.readFileSync(dataPath)); const U = D.U;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function draw(pop, k, seed) {
  const rnd = mulberry32(seed); const idx = pop.map((_, i) => i);
  for (let i = idx.length - 1; i >= 1; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, k).map((pi, rank) => ({rank: rank + 1, popIndex: pi, ...pop[pi]}));
}
const SEED = 20261010;
const objects = U.businessObjectRecords.map(r => ({stratum: 'business_object', ...r}));
const systems = U.systemRecords.map(r => ({stratum: 'system', ...r}));
const docEvt = [...U.documentRecords.map(r => ({stratum: 'document', ...r})), ...U.eventRecords.map(r => ({stratum: 'event', ...r}))];
const out = {
  sha256Input: D.sha256, seed: SEED, generator: 'mulberry32', shuffle: 'Fisher-Yates i=n-1..1, j=floor(rnd()*(i+1)); reseeded per stratum',
  populations: {business_object: objects.length, system: systems.length, document_event: docEvt.length, documents: U.documentRecords.length, events: U.eventRecords.length},
  business_object: draw(objects, 40, SEED), system: draw(systems, 10, SEED), document_event: draw(docEvt, 10, SEED)
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.populations));
for (const k of ['business_object', 'system', 'document_event']) console.log(k, out[k].length, out[k].map(x => x.id).join(', '));
