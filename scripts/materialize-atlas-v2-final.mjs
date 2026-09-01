import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const lock=JSON.parse(fs.readFileSync(path.join(root,'integration/frozen-stack-lock.json'),'utf8'));
const arg=(name,def)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:def};
const inbox=path.resolve(arg('--assets',path.join(root,'frozen-assets/inbox')));
if(!fs.existsSync(inbox))throw new Error(`Frozen asset input not found: ${inbox}`);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function walk(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,out);else out.push(p)}return out}
const files=walk(inbox);
const byBase=new Map(files.map(p=>[path.basename(p).toLowerCase(),p]));
const find=(...names)=>{for(const n of names){const p=byBase.get(n.toLowerCase());if(p)return p}return null};
const requireFile=(label,...names)=>{const p=find(...names);if(!p)throw new Error(`Missing ${label}; expected one of: ${names.join(', ')}`);return p};
const copy=(src,dst)=>{fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);return dst};
function json(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function arr(x,...keys){for(const k of keys)if(Array.isArray(x?.[k]))return x[k];return []}
function assertHash(label,p,expected){const actual=sha(p);if(actual!==expected)throw new Error(`${label} SHA-256 mismatch\nexpected ${expected}\nactual   ${actual}\nfile     ${p}`);return actual}
function moduleStats(m){return {processes:arr(m,'processes').length,a3:arr(m,'a3Parents','a3').length,edges:arr(m,'processFlowEdges','edges').length,transitions:arr(m,'executionTransitions','transitions').length,sources:arr(m,'sources').length,ontologyEdges:arr(m,'ontologyEdges').length}}
function assertExpected(id,stats,expected){for(const [k,v] of Object.entries(expected||{})){if(v!==undefined && stats[k]!==v)throw new Error(`${id} ${k} mismatch: expected ${v}, got ${stats[k]}`)}}

const assets={
 universe:requireFile('Universe V7.3','universe-v7.3.html','Supply-Chain-Logistics-Universe-V7.3.html'),
 ltlJson:requireFile('Road LTL V1.3 JSON','road-ltl-v1.3.json'),
 ltlHtml:requireFile('Road LTL V1.3 HTML','road-ltl-v1.3.html'),
 fclJson:requireFile('Ocean FCL V0.5 JSON','ocean-fcl-v0.5.json'),
 fclHtml:requireFile('Ocean FCL V0.5 HTML','ocean-fcl-v0.5.html'),
 lclJson:requireFile('Ocean LCL V0.5 JSON','ocean-lcl-v0.5.json'),
 lclHtml:requireFile('Ocean LCL V0.5 HTML','ocean-lcl-v0.5.html'),
 warehouse:requireFile('Atlas Warehouse V1','atlas-warehouse-v1.json')
};
for(const [id,key] of [['road-ltl','ltlJson'],['ocean-fcl','fclJson'],['ocean-lcl','lclJson']]){
 const cfg=lock.knowledgeStack.modules[id];assertHash(id,assets[key],cfg.sha256);assertExpected(id,moduleStats(json(assets[key])),cfg.expected);
}
const wh=json(assets.warehouse);const whStats={modules:new Set((wh.workDefinitions||[]).map(x=>x?.lineage?.moduleId).filter(Boolean)).size,workDecompositions:(wh.workDecompositions||[]).length,workDefinitions:(wh.workDefinitions||[]).length,dependencyRecords:(wh.dependencies||wh.dependencyRecords||[]).length};
for(const [k,v] of Object.entries(lock.knowledgeStack.atlasWarehouse)){if(k==='version')continue;if(whStats[k]!==v)throw new Error(`Atlas Warehouse ${k} mismatch: expected ${v}, got ${whStats[k]}`)}

copy(assets.universe,path.join(root,'reference/universe-v7.3.html'));
copy(assets.ltlHtml,path.join(root,'reference/daughters/road-ltl-v1.3.html'));
copy(assets.fclHtml,path.join(root,'reference/daughters/ocean-fcl-v0.5.html'));
copy(assets.lclHtml,path.join(root,'reference/daughters/ocean-lcl-v0.5.html'));
copy(assets.ltlJson,path.join(root,'data/modules/road-ltl-v1.3.json'));
copy(assets.fclJson,path.join(root,'data/modules/ocean-fcl-v0.5.json'));
copy(assets.lclJson,path.join(root,'data/modules/ocean-lcl-v0.5.json'));
copy(assets.warehouse,path.join(root,'data/atlas-warehouse-v1.json'));
const admin=find('admin-execution-renderer.html');if(admin)copy(admin,path.join(root,'reference/admin-execution-renderer-v1.html'));
const foundation=find('foundation-v1.2.json');if(foundation)copy(foundation,path.join(root,'data/governance/foundation-v1.2.json'));

// Canvas: accept frozen zip or extracted directory named canvas-v2 / atlas-canvas-v2.0.
const canvasZip=find('atlas-canvas-v2.0-frozen.zip');
let canvasMode='absent';
if(canvasZip){assertHash('Canvas V2.0 frozen ZIP',canvasZip,lock.knowledgeStack.canvas.frozenZipSha256);const dst=path.join(root,'canvas-v2');fs.rmSync(dst,{recursive:true,force:true});fs.mkdirSync(dst,{recursive:true});execFileSync('unzip',['-q',canvasZip,'-d',dst]);canvasMode='frozen-zip'}
else{
 const candidates=['canvas-v2','atlas-canvas-v2.0'];let dir=null;for(const n of candidates){const p=path.join(inbox,n);if(fs.existsSync(p)&&fs.statSync(p).isDirectory()){dir=p;break}}
 if(dir){const dst=path.join(root,'canvas-v2');fs.rmSync(dst,{recursive:true,force:true});fs.cpSync(dir,dst,{recursive:true});canvasMode='extracted-directory'}
 else throw new Error('Missing Canvas V2.0: provide atlas-canvas-v2.0-frozen.zip or an extracted canvas-v2 directory.');
}

// Registry/catalog: publish the exact three A5 daughters through generic discovery.
const regPath=path.join(root,'data/atlas-registry.json'),reg=json(regPath);
reg.release={...(reg.release||{}),product:'Supply Chain Atlas',releaseName:'Atlas 2.0 Final Integration',releaseId:'atlas-v2.0-final-integrated',stage:'V2.0 FINAL INTEGRATION',technicalLineage:{...(reg.release?.technicalLineage||{}),universe:'V7.3',roadLtlModule:'V1.3',oceanFclModule:'V0.5',oceanLclModule:'V0.5',canvas:'V2.0',universalAsk:'V2.0.1',atlasWarehouse:'V1',foundation:'V1.2'}};
reg.modules=[
 {id:'road-ltl',label:'Road LTL / Groupage',version:'1.3',status:'ACTIVE',depth:'A5_VERIFIED',processCount:22,a3Count:13,edgeCount:39,sourceCount:29,source:'data/modules/road-ltl-v1.3.json'},
 {id:'ocean-fcl',label:'Ocean FCL / Full Container Load',version:'0.5',status:'ACTIVE',depth:'A5_VERIFIED',processCount:30,a3Count:15,edgeCount:56,source:'data/modules/ocean-fcl-v0.5.json'},
 {id:'ocean-lcl',label:'Ocean LCL / Less than Container Load',version:'0.5',status:'ACTIVE',depth:'A5_VERIFIED',processCount:30,a3Count:14,edgeCount:56,source:'data/modules/ocean-lcl-v0.5.json'}
];
reg.plannedModules=(reg.plannedModules||[]).filter(x=>!['road-ltl','ocean-fcl','ocean-lcl'].includes(x));
for(const item of reg.items||[]){if(['road-ltl','ocean-fcl','ocean-lcl'].includes(item.id)){item.status='ACTIVE';item.depth='A5_VERIFIED'}}
reg.release.referenceSurfaces={...(reg.release.referenceSurfaces||{}),universeV7_3:'reference/universe-v7.3.html',roadLtlV1_3:'reference/daughters/road-ltl-v1.3.html',oceanFclV0_5:'reference/daughters/ocean-fcl-v0.5.html',oceanLclV0_5:'reference/daughters/ocean-lcl-v0.5.html'};
fs.writeFileSync(regPath,JSON.stringify(reg,null,2)+'\n');

const catPath=path.join(root,'data/module-catalog.json'),cat=json(catPath);
cat.modules=[
 {id:'road-ltl',registryId:'road-ltl',name:'Road LTL',version:'1.3',depth:'A5_VERIFIED',publicationState:'ACTIVE',url:'data/modules/road-ltl-v1.3.json',sha256:lock.knowledgeStack.modules['road-ltl'].sha256,approved:true,sourceArtifactStatus:'SOURCE_ARTIFACT_NOT_EXPOSED_IN_RUNTIME',domainPackId:'supply-chain'},
 {id:'ocean-fcl',registryId:'ocean-fcl',name:'Ocean FCL',version:'0.5',depth:'A5_VERIFIED',publicationState:'ACTIVE',url:'data/modules/ocean-fcl-v0.5.json',sha256:lock.knowledgeStack.modules['ocean-fcl'].sha256,approved:true,sourceArtifactStatus:'SOURCE_ARTIFACT_NOT_EXPOSED_IN_RUNTIME',domainPackId:'supply-chain'},
 {id:'ocean-lcl',registryId:'ocean-lcl',name:'Ocean LCL',version:'0.5',depth:'A5_VERIFIED',publicationState:'ACTIVE',url:'data/modules/ocean-lcl-v0.5.json',sha256:lock.knowledgeStack.modules['ocean-lcl'].sha256,approved:true,sourceArtifactStatus:'SOURCE_ARTIFACT_NOT_EXPOSED_IN_RUNTIME',domainPackId:'supply-chain'}
];
cat.planned=(cat.planned||[]).filter(x=>!['road-ltl','ocean-fcl','ocean-lcl'].includes(x.id));
cat.generatedAt=new Date().toISOString();cat.version='2.0-final';
fs.writeFileSync(catPath,JSON.stringify(cat,null,2)+'\n');

const manifest={schemaVersion:'atlas-final-integration-manifest-v1',status:'MATERIALIZED_PENDING_FULL_REGRESSION',generatedAt:new Date().toISOString(),stack:lock.knowledgeStack,assets:{universe:{path:'reference/universe-v7.3.html',sha256:sha(assets.universe)},roadLtl:{path:'data/modules/road-ltl-v1.3.json',sha256:sha(assets.ltlJson)},oceanFcl:{path:'data/modules/ocean-fcl-v0.5.json',sha256:sha(assets.fclJson)},oceanLcl:{path:'data/modules/ocean-lcl-v0.5.json',sha256:sha(assets.lclJson)},warehouse:{path:'data/atlas-warehouse-v1.json',sha256:sha(assets.warehouse)},canvas:{mode:canvasMode}}};
fs.writeFileSync(path.join(root,'release/final/integration-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ok:true,canvasMode,warehouse:whStats,manifest:'release/final/integration-manifest.json'},null,2));
