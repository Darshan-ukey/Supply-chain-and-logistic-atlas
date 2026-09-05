import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {
  buildPublicExecutionDepthProjection,
  buildGovernanceOperationalProjection,
  publicProjectionForbiddenTokens
} from '../lib/projections/execution-depth-projection.js';

let failures = 0;
const root = process.cwd();
const check = (ok,label) => { console.log(`${ok?'PASS':'FAIL'} · ${label}`); if(!ok) failures++; };
const exists = p => fs.existsSync(path.join(root,p));
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const gitBlobSha = p => { const b=fs.readFileSync(path.join(root,p)); return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };

const expectedHashes = new Map([
  ['data/modules/ocean-fcl-v0.6.json','334d6a11595d33c46fa3b4675aa953f1fa6943906894f1cad7a8caf30cad034a'],
  ['data/modules/ocean-lcl-v0.6.json','73d416683f43357cd0eabfe96009405fa22d74008e452f977fa489f0c395850f'],
  ['data/operational-knowledge/ocean-fcl-v0.6-operational.json','c665f946fa30ccea081fa6a8ad3129e7217cfdff1d20ea7ee15e4ac70506aae3'],
  ['data/operational-knowledge/ocean-lcl-v0.6-operational.json','3ba54c522a28e8e05f1f65e418eb450ba46c701de0a0d353234d467c9033307e'],
  ['data/client-binding-requirements/ocean-fcl-v0.6-bindings.json','9a86fe6c26360993673fc899ac8529103704a55a1a7f3d7b8455123e4261a005'],
  ['data/client-binding-requirements/ocean-lcl-v0.6-bindings.json','47633373b70ac43fc02e271eb22b4a2b678107160f17385faf277b9e5a903a46'],
  ['data/source-claims/ocean-fcl-v0.6-claims.json','99cd023485c0e632d387defcd8419d64ad1e68b58a0136db535721421946d1ef'],
  ['data/source-claims/ocean-lcl-v0.6-claims.json','4d06be7436755ebddfc66ff74da2fe67583bd104def6b6c598a0e77a3d31fd21'],
  ['data/exchanges/ocean-fcl-v0.6-system-exchanges.json','e0e19d7f7e81d5a44f2e7b03669e150c86ca74f8e22f37b61355efb0490cc346'],
  ['data/exchanges/ocean-lcl-v0.6-system-exchanges.json','5df868d6714454e239186d6097d39e261219858fc39b38d345f5b68a440a0828']
]);

const sourceCertPath='governance/baselines/P3O_OCEAN_0_6_SOURCE_CERTIFICATION.json';
check(exists(sourceCertPath),'P3O exact-source certification manifest exists');
if(exists(sourceCertPath)) {
  const cert=JSON.parse(read(sourceCertPath));
  check(cert.status==='PASS','exact Ocean 0.6 source certification is PASS');
  check(cert.releaseZip?.sha256==='b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289','frozen release ZIP SHA-256 is pinned');
  check(cert.sourceVault?.provider==='GOOGLE_DRIVE','canonical Ocean source is retained in governed Drive vault');
  check(Boolean(cert.sourceVault?.fileId),'governed Drive vault file id is pinned');
  check(cert.verification?.canonicalFileCount===10,'ten canonical Ocean files were certified');
  check(cert.verification?.canonicalFileHashResult==='PASS','all canonical Ocean file hashes passed');
  check(cert.verification?.semanticMutation===false,'P3O performs no Ocean semantic mutation');
  check(cert.semanticBoundary?.informationResolutionDepth==='NOT_POPULATED_AT_OKV2_DEPTH','Ocean OKv1 does not fabricate OKv2 Information Resolution');
  const certified=new Map((cert.canonicalFiles||[]).map(x=>[x.path,x.sha256]));
  for(const [p,h] of expectedHashes) check(certified.get(p)===h,`certified frozen SHA-256 matches lock · ${p}`);
}

const registryPath='governance/presentation/p2-projection-source-registry.json';
check(exists(registryPath),'P2 projection source registry exists');
let registry=null;
if(exists(registryPath)) registry=JSON.parse(read(registryPath));
const expectedSources=[
  {key:'ocean-fcl@0.6',moduleId:'ocean-fcl',version:'0.6',moduleSha:expectedHashes.get('data/modules/ocean-fcl-v0.6.json')},
  {key:'ocean-lcl@0.6',moduleId:'ocean-lcl',version:'0.6',moduleSha:expectedHashes.get('data/modules/ocean-lcl-v0.6.json')}
];
for(const e of expectedSources) {
  const source=(registry?.sources||[]).find(x=>x.sourceKey===e.key);
  check(!!source,`P2 source registry resolves exact candidate · ${e.key}`);
  if(source) {
    check(source.materialized===true,`${e.key} is materialized for PUBLIC_SAFE projection`);
    check(source.sourceProfile==='FROZEN_DAUGHTER_OKV1_PRECOMPILED_PUBLIC_SAFE',`${e.key} uses the governed OKv1 precompiled-public-safe profile`);
    check(source.canonicalModuleSha256===e.moduleSha,`${e.key} pins the frozen canonical module SHA-256`);
    check(source.informationResolutionDepth==='NOT_POPULATED_AT_OKV2_DEPTH',`${e.key} does not fabricate OKv2 Information Resolution`);
    check(!String(source.modulePath||'').includes('v0.5'),`${e.key} has no Ocean 0.5 fallback`);
    check(source.publicProjectionBundlePath==='data/materialized/ocean-0.6-public-safe-projections.json.gz.b64',`${e.key} resolves the certified public-safe projection bundle`);
  }
}

const bundlePath='data/materialized/ocean-0.6-public-safe-projections.json.gz.b64';
check(exists(bundlePath),'Ocean 0.6 public-safe projection bundle exists');
let bundle=null;
if(exists(bundlePath)) {
  try {
    bundle=JSON.parse(zlib.gunzipSync(Buffer.from(read(bundlePath).trim(),'base64')).toString('utf8'));
    check(true,'Ocean 0.6 public-safe projection bundle decodes');
  } catch (err) {
    check(false,`Ocean 0.6 public-safe projection bundle decodes · ${err.message}`);
  }
}

const forbidden=publicProjectionForbiddenTokens();
for(const e of expectedSources) {
  const projections=bundle?.sources?.[e.key];
  check(projections && typeof projections==='object' && !Array.isArray(projections),`${e.key} projection collection exists`);
  const taskIds=projections?Object.keys(projections):[];
  check(taskIds.length===30,`${e.key} resolves 30/30 A5 tasks`);
  for(const taskId of taskIds) {
    const stored=projections[taskId];
    check(stored?.projectionClass==='PUBLIC_SAFE',`${e.key}/${taskId} is PUBLIC_SAFE`);
    check(stored?.trace?.moduleId===e.moduleId && String(stored?.trace?.moduleVersion)===e.version,`${e.key}/${taskId} trace preserves exact module/version`);
    check(String(stored?.trace?.taskId)===String(taskId),`${e.key}/${taskId} trace preserves exact task id`);
    check(stored?.protectedExecution?.workDecomposition?.detailIncluded===false,`${e.key}/${taskId} excludes Work Decomposition detail`);
    check(stored?.protectedExecution?.workDefinition?.detailIncluded===false,`${e.key}/${taskId} excludes WorkDefinition detail`);
    const serialized=JSON.stringify(stored);
    for(const token of forbidden) check(!serialized.includes(token),`${e.key}/${taskId} excludes protected token · ${token}`);
    try {
      const runtime=buildPublicExecutionDepthProjection({moduleId:e.moduleId,moduleVersion:e.version,taskId});
      check(JSON.stringify(runtime)===serialized,`${e.key}/${taskId} runtime resolves certified precompiled projection without semantic rewrite`);
    } catch(err) {
      check(false,`${e.key}/${taskId} runtime projection resolves · ${err.message}`);
    }
  }
  const firstTask=taskIds[0];
  if(firstTask) {
    let governanceDenied=false;
    try { buildGovernanceOperationalProjection({moduleId:e.moduleId,moduleVersion:e.version,taskId:firstTask}); }
    catch(err) { governanceDenied=Number(err?.status)===404; }
    check(governanceDenied,`${e.key} governance-canonical payload fails closed on runtime server`);
  }
}

const renderer='assets/universal-daughter-renderer-v2.js';
check(exists(renderer),'Universal Daughter Renderer V2 exists');
if(exists(renderer)) {
  const src=read(renderer).toLowerCase();
  for(const token of ['ocean-fcl','ocean-lcl','fcl-01','lcl-01']) check(!src.includes(token),`shared renderer remains daughter-generic · no ${token}`);
}

const projectionLib='lib/projections/execution-depth-projection.js';
check(exists(projectionLib),'shared execution-depth projection library exists');
if(exists(projectionLib)) {
  const src=read(projectionLib);
  check(!/moduleId\s*===?\s*['"]ocean-(fcl|lcl)/i.test(src),'projection code has no Ocean-specific semantic branch');
}

// Frozen P3 baselines: P3O may add source registration/materialization only.
if(exists('index.html')) check(gitBlobSha('index.html')==='043802523b1618c143a0e78b88bbfb2afaa7c7dd','Canvas/index.html remains byte-identical to P3 baseline');
if(exists('data/modules/road-ltl-v1.5.json')) check(gitBlobSha('data/modules/road-ltl-v1.5.json')==='b69883d5369be8aad15bb9325f910610da875771','Road LTL 1.5 remains byte-identical to P3 baseline');

console.log(failures?`FAIL · ${failures} P3O certification gate(s) unresolved`:'PASS · P3O Ocean 0.6 materialization & Universal Daughter Renderer certification');
if(failures) process.exit(1);
