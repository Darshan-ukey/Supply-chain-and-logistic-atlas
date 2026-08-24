import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {send} from './_utils.js';import {releaseRuntime} from '../../release/release-meta.js';
const baselinePath='release/baselines/v1.1.7-critical-hashes.json';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
 try{
  const baseline=JSON.parse(fs.readFileSync(path.join(process.cwd(),baselinePath),'utf8'));
  const files=Object.entries(baseline.files||{}).map(([rel,expected])=>{const p=path.join(process.cwd(),rel);if(!fs.existsSync(p))return{rel,ok:false,expected,actual:null,error:'missing'};const actual=sha(p);return{rel,ok:actual===expected,expected,actual}});
  const ok=files.length>0&&files.every(x=>x.ok);
  return send(res,ok?200:500,{ok,release:releaseRuntime(),parityContract:'stage23-full-product-parity-v1',foundationContract:'atlas-data-contract-v1.1',criticalIntegrity:ok,checkedFiles:files.length,files});
 }catch(e){return send(res,500,{ok:false,error:e.message,release:releaseRuntime()})}
}
