import fs from 'node:fs';
import path from 'node:path';
import {atlasData} from './_atlas.js';
const cache=new Map();
function readJson(rel){if(cache.has(rel))return cache.get(rel);const v=JSON.parse(fs.readFileSync(path.join(process.cwd(),rel),'utf8'));cache.set(rel,v);return v}
export function documentDomainRuntime({domainPackId='supply-chain',moduleId='road-ltl'}={}){
  const packs=readJson('data/domain-pack-catalog.json');
  const packRec=(packs.packs||[]).find(x=>x.id===domainPackId&&x.status==='ACTIVE');
  if(!packRec){const e=new Error(`Client-document ingestion is not published for domain pack ${domainPackId}.`);e.status=409;throw e}
  const A=atlasData(),reg=(A.registry.modules||[]).find(x=>x.id===moduleId&&x.status==='ACTIVE'&&x.source);
  if(!reg){const e=new Error(`Client-document ingestion is not published for module ${moduleId}.`);e.status=409;throw e}
  const mod=A.moduleById[moduleId];if(!mod){const e=new Error(`Published module ${moduleId} could not be loaded.`);e.status=500;throw e}
  return {domainPackId,moduleId,pack:readJson(packRec.url||packRec.path),module:mod,territories:A.page0.domains||A.page0.page0Domains||[],moduleRecord:reg};
}
