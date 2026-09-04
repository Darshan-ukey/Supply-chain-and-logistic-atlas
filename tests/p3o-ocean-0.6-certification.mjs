import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

let failures = 0;
const root = process.cwd();
const check = (ok,label) => { console.log(`${ok?'PASS':'FAIL'} · ${label}`); if(!ok) failures++; };
const exists = p => fs.existsSync(path.join(root,p));
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const gitBlobSha = p => { const b=fs.readFileSync(path.join(root,p)); return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };

const expected = [
  ['data/modules/ocean-fcl-v0.6.json','334d6a11595d33c46fa3b4675aa953f1fa6943906894f1cad7a8caf30cad034a'],
  ['data/operational-knowledge/ocean-fcl-v0.6-operational.json','c665f946fa30ccea081fa6a8ad3129e7217cfdff1d20ea7ee15e4ac70506aae3'],
  ['data/client-binding-requirements/ocean-fcl-v0.6-bindings.json','9a86fe6c26360993673fc899ac8529103704a55a1a7f3d7b8455123e4261a005'],
  ['data/source-claims/ocean-fcl-v0.6-claims.json','99cd023485c0e632d387defcd8419d64ad1e68b58a0136db535721421946d1ef'],
  ['data/exchanges/ocean-fcl-v0.6-system-exchanges.json','e0e19d7f7e81d5a44f2e7b03669e150c86ca74f8e22f37b61355efb0490cc346'],
  ['data/modules/ocean-lcl-v0.6.json','73d416683f43357cd0eabfe96009405fa22d74008e452f977fa489f0c395850f'],
  ['data/operational-knowledge/ocean-lcl-v0.6-operational.json','3ba54c522a28e8e05f1f65e418eb450ba46c701de0a0d353234d467c9033307e'],
  ['data/client-binding-requirements/ocean-lcl-v0.6-bindings.json','47633373b70ac43fc02e271eb22b4a2b678107160f17385faf277b9e5a903a46'],
  ['data/source-claims/ocean-lcl-v0.6-claims.json','4d06be7436755ebddfc66ff74da2fe67583bd104def6b6c598a0e77a3d31fd21'],
  ['data/exchanges/ocean-lcl-v0.6-system-exchanges.json','5df868d6714454e239186d6097d39e261219858fc39b38d345f5b68a440a0828']
];

for (const [p,h] of expected) {
  const present=exists(p);
  check(present,`exact frozen source is materialized · ${p}`);
  if(present) check(sha256(p)===h,`immutable SHA-256 matches manifest · ${p}`);
}

const registryPath='governance/presentation/p2-projection-source-registry.json';
if(exists(registryPath)) {
  const registry=JSON.parse(read(registryPath));
  for(const key of ['ocean-fcl@0.6','ocean-lcl@0.6']) {
    const source=(registry.sources||[]).find(x=>x.sourceKey===key);
    check(!!source,`P2 source registry resolves exact candidate · ${key}`);
    if(source) {
      check(source.materialized===true,`${key} is marked materialized only after source recovery`);
      check(!String(source.modulePath||'').includes('v0.5'),`${key} has no Ocean 0.5 fallback`);
    }
  }
}

function taskCount(modulePath) {
  if(!exists(modulePath)) return null;
  const m=JSON.parse(read(modulePath));
  const candidates=[m.processes,m.tasks,m.a5Processes,m.taskOverrides,m.module?.processes,m.module?.tasks].find(Array.isArray);
  return candidates?.length ?? null;
}
const fclCount=taskCount('data/modules/ocean-fcl-v0.6.json');
const lclCount=taskCount('data/modules/ocean-lcl-v0.6.json');
if(fclCount!==null) check(fclCount===30,'Ocean FCL 0.6 resolves 30/30 A5 tasks');
if(lclCount!==null) check(lclCount===30,'Ocean LCL 0.6 resolves 30/30 A5 tasks');

const renderer='assets/universal-daughter-renderer-v2.js';
if(exists(renderer)) {
  const src=read(renderer).toLowerCase();
  for(const token of ['ocean-fcl','ocean-lcl','fcl-01','lcl-01']) check(!src.includes(token),`shared renderer remains daughter-generic · no ${token}`);
}

// The renderer must never manufacture v2 Information Resolution simply because a legacy profile is projected.
const projectionLibCandidates=['lib/execution-depth-projection.js','api/_lib/execution-depth-projection.js','api/lib/execution-depth-projection.js'];
for(const p of projectionLibCandidates.filter(exists)) {
  const src=read(p);
  check(!/moduleId\s*===?\s*['"]ocean-(fcl|lcl)/i.test(src),`projection code has no Ocean-specific semantic branch · ${p}`);
}

// Frozen P3 baselines: any P3O changes to renderer or Canvas must be explicit failures.
if(exists('index.html')) check(gitBlobSha('index.html')==='043802523b1618c143a0e78b88bbfb2afaa7c7dd','Canvas/index.html remains byte-identical to P3 baseline');
if(exists('data/modules/road-ltl-v1.5.json')) check(gitBlobSha('data/modules/road-ltl-v1.5.json')==='b69883d5369be8aad15bb9325f910610da875771','Road LTL 1.5 remains byte-identical to P3 baseline');

console.log(failures?`FAIL · ${failures} P3O certification gate(s) unresolved`:'PASS · P3O Ocean 0.6 materialization & Universal Daughter Renderer certification');
if(failures) process.exit(1);
