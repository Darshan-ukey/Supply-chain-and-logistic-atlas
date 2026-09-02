#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const regPath=path.join(root,'governance/frozen-assets/ASSET_REGISTER.json');
const curPath=path.join(root,'governance/frozen-assets/CURRENT.json');
const cmd=process.argv[2]||'validate';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const reg=read(regPath), cur=read(curPath);
const byId=new Map(reg.assets.map(a=>[a.assetId,a]));
const fail=[];

if(new Set(reg.assets.map(a=>a.assetId)).size!==reg.assets.length) fail.push('duplicate assetId');
const sha=/^[a-f0-9]{64}$/;
for(const a of reg.assets){
  if(a.sha256 && !sha.test(a.sha256)) fail.push(`${a.assetId}: invalid sha256`);
  if(a.repositoryPath && fs.existsSync(path.join(root,a.repositoryPath)) && a.sha256){
    const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,a.repositoryPath))).digest('hex');
    if(actual!==a.sha256) fail.push(`${a.assetId}: checksum mismatch`);
  }
}
const ids=[];
for(const group of [cur.productionBaseline,cur.latestFrozenCandidates]) for(const v of Object.values(group||{})) ids.push(v);
for(const v of cur.governingStandards||[]) ids.push(v);
for(const v of cur.nextImplementation||[]) ids.push(v);
for(const id of ids) if(!byId.has(id)) fail.push(`CURRENT points to missing asset: ${id}`);

if(cmd==='latest'){
 console.log(JSON.stringify({productionBaseline:cur.productionBaseline,latestFrozenCandidates:cur.latestFrozenCandidates,governingStandards:cur.governingStandards,nextImplementation:cur.nextImplementation},null,2));
 process.exit(0);
}
if(fail.length){ console.error('Frozen asset registry INVALID'); for(const e of fail) console.error(' - '+e); process.exit(1); }
console.log(`Frozen asset registry VALID: ${reg.assets.length} assets; lock ${reg.latestIntegrationLock.version}`);
