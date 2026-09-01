import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
const root=process.cwd(),lock=JSON.parse(fs.readFileSync(path.join(root,'integration/frozen-stack-lock.json'),'utf8'));
const req=['release/final/integration-manifest.json','reference/universe-v7.3.html','reference/daughters/road-ltl-v1.3.html','reference/daughters/ocean-fcl-v0.5.html','reference/daughters/ocean-lcl-v0.5.html','data/modules/road-ltl-v1.3.json','data/modules/ocean-fcl-v0.5.json','data/modules/ocean-lcl-v0.5.json','data/atlas-warehouse-v1.json','canvas-v2'];
for(const p of req)if(!fs.existsSync(path.join(root,p)))throw new Error(`Final integration missing ${p}. Run npm run final:materialize with the exact frozen assets.`);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
for(const [id,file] of Object.entries({'road-ltl':'data/modules/road-ltl-v1.3.json','ocean-fcl':'data/modules/ocean-fcl-v0.5.json','ocean-lcl':'data/modules/ocean-lcl-v0.5.json'})){const a=sha(file),e=lock.knowledgeStack.modules[id].sha256;if(a!==e)throw new Error(`${id} hash drift: ${a} != ${e}`)}
const reg=JSON.parse(fs.readFileSync(path.join(root,'data/atlas-registry.json'),'utf8'));const active=new Set((reg.modules||[]).filter(x=>x.status==='ACTIVE'&&x.depth==='A5_VERIFIED').map(x=>x.id));for(const id of ['road-ltl','ocean-fcl','ocean-lcl'])if(!active.has(id))throw new Error(`${id} is not ACTIVE + A5_VERIFIED`);
const cat=JSON.parse(fs.readFileSync(path.join(root,'data/module-catalog.json'),'utf8'));for(const id of ['road-ltl','ocean-fcl','ocean-lcl'])if(!(cat.modules||[]).some(x=>x.id===id&&x.publicationState==='ACTIVE'&&x.depth==='A5_VERIFIED'&&x.approved))throw new Error(`${id} missing active approved catalog entry`);
const wh=JSON.parse(fs.readFileSync(path.join(root,'data/atlas-warehouse-v1.json'),'utf8'));if((wh.workDefinitions||[]).length!==82||(wh.workDecompositions||[]).length!==82)throw new Error('Atlas Warehouse count mismatch');
console.log('Frozen asset checks: PASS');
execFileSync(process.execPath,['tests/v2-universal-ask-smoke.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['tests/v2-public-ip-boundary.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['tests/v2-admin-auth-smoke.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['tests/v2-api-router-smoke.mjs'],{stdio:'inherit'});
console.log('Atlas 2.0 integration verification: PASS (browser/canvas deployment certification remains separate).');
