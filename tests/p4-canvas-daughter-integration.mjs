import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CANVAS_DAUGHTER_BRIDGE_VERSION,
  buildDaughterHref,
  resolveDaughterTarget,
  selectionForCanvasState
} from '../assets/canvas-daughter-bridge-v2.0.1.mjs';

let failures=0;
const root=process.cwd();
const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++;};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const gitBlobSha=p=>{const b=fs.readFileSync(path.join(root,p));return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');};

check(CANVAS_DAUGHTER_BRIDGE_VERSION==='2.0.1','P4 Canvas integration version is 2.0.1');

const registryPath='governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json';
check(exists(registryPath),'P4 governed Canvas→Daughter target registry exists');
const registry=JSON.parse(read(registryPath));
check(registry.status==='ACTIVE_P4_INTEGRATION_CONTRACT','P4 target registry is active');
check(registry.daughterRoute==='/daughter','P4 uses Universal Daughter route');

const expected=[
  ['road-ltl','1.5','LTL-03'],
  ['ocean-fcl','0.6','FCL-01'],
  ['ocean-lcl','0.6','LCL-01']
];
for(const [moduleId,version,taskId] of expected){
  const t=resolveDaughterTarget(registry,moduleId);
  check(!!t,`${moduleId} has a governed Daughter target`);
  check(t?.daughterModuleVersion===version,`${moduleId} routes to governed ${version} execution-depth target`);
  const state={activeModule:moduleId,selectedProcess:taskId,module:{module:{id:moduleId,version:t?.canvasBaselineVersion}}};
  const s=selectionForCanvasState(registry,state);
  check(s?.moduleVersion===version&&s?.taskId===taskId,`${moduleId}/${taskId} resolves exact target tuple`);
  const href=buildDaughterHref(s||{});
  check(href===`/daughter?moduleId=${moduleId}&moduleVersion=${encodeURIComponent(version)}&taskId=${taskId}`,`${moduleId}/${taskId} builds exact fail-closed Daughter URL`);
}

check(registry.targets['ocean-fcl']?.targetStatus==='APPROVED_PRODUCTION_GO_LIVE_TARGET','Ocean FCL 0.6 is the approved go-live target');
check(registry.targets['ocean-lcl']?.targetStatus==='APPROVED_PRODUCTION_GO_LIVE_TARGET','Ocean LCL 0.6 is the approved go-live target');
check(registry.targets['ocean-fcl']?.deployBaselineFirst===false,'Ocean FCL 0.5 is not deployed first');
check(registry.targets['ocean-lcl']?.deployBaselineFirst===false,'Ocean LCL 0.5 is not deployed first');
check(selectionForCanvasState(registry,{activeModule:'ocean-fcl',selectedProcess:null})===null,'no selected A5 yields no Daughter handoff');
check(selectionForCanvasState(registry,{activeModule:'unknown',selectedProcess:'X-01'})===null,'unregistered module fails closed');
check(buildDaughterHref({moduleId:'ocean-fcl',moduleVersion:'',taskId:'FCL-01'})===null,'incomplete tuple fails closed');

const bridgePath='assets/canvas-daughter-bridge-v2.0.1.mjs';
check(exists(bridgePath),'P4 Canvas Daughter bridge exists');
if(exists(bridgePath)){
  const src=read(bridgePath);
  for(const endpoint of ['/api/work-decomposition','/api/admin-workdefinitions','/api/governance-operational-projection','/api/malkom-projections'])
    check(!src.includes(endpoint),`Canvas bridge never calls protected endpoint ${endpoint}`);
  check(!/moduleId\s*===?\s*['"]ocean-(fcl|lcl)/i.test(src),'Canvas bridge contains no Ocean-specific semantic branch');
  check(src.includes('P4_CANVAS_DAUGHTER_TARGETS.json'),'bridge resolves versions from governed registry rather than inference');
}

const bootstrap='execution/ui/runtime-access-shell.js';
check(exists(bootstrap),'existing Atlas runtime bootstrap exists');
if(exists(bootstrap)){
  const src=read(bootstrap);
  check(src.includes("import('/assets/canvas-daughter-bridge-v2.0.1.mjs')"),'production /app bootstraps P4 bridge additively');
  check(src.includes('/api/runtime-access')&&src.includes('/api/malkom-projections'),'existing authorized runtime-access behavior is preserved');
}

const daughter='daughter.html';
const renderer='assets/universal-daughter-renderer-v2.js';
check(exists(daughter)&&exists(renderer),'Universal Daughter Renderer V2 surface remains present');
if(exists(renderer)){
  const src=read(renderer);
  check(src.includes("PUBLIC_PROJECTION_ENDPOINT='/api/execution-depth-projection'"),'Daughter consumes only PUBLIC_SAFE execution-depth endpoint');
  check(!src.includes('/api/work-decomposition')&&!src.includes('/api/admin-workdefinitions'),'public Daughter renderer does not preload protected endpoints');
}

const p2Registry=JSON.parse(read('governance/presentation/p2-projection-source-registry.json'));
for(const key of ['ocean-fcl@0.6','ocean-lcl@0.6']){
  const s=p2Registry.sources.find(x=>x.sourceKey===key);
  check(s?.materialized===true,`${key} is materialized for PUBLIC_SAFE Daughter projection`);
  check(!String(s?.modulePath||'').includes('v0.5'),`${key} has no semantic fallback to Ocean 0.5`);
}

// P4 is an additive integration patch: the frozen Canvas visual shell itself must not change.
check(gitBlobSha('index.html')==='043802523b1618c143a0e78b88bbfb2afaa7c7dd','production Canvas/index.html remains byte-identical to P3/P3O baseline');
check(gitBlobSha('canvas-v2/canvas-v2/index.html')==='4dfa0a8410eba303ba7dad73a5cee6431dfe3258','frozen Canvas V2 package HTML remains byte-identical');
check(gitBlobSha('canvas-v2/canvas-v2/assets/canvas-v2.js')==='672dd1b5a1eb8c3c1698fae436fa0b3db53cd5d0','frozen Canvas V2 package JS remains byte-identical');
check(gitBlobSha('canvas-v2/canvas-v2/assets/canvas-v2.css')==='860c878491479b40c1a71c8530d2f1725564341b','frozen Canvas V2 package CSS remains byte-identical');

console.log(failures?`FAIL · ${failures} P4 Canvas integration gate(s) unresolved`:'PASS · P4 Canvas V2.0.1 integration certification');
if(failures)process.exit(1);
