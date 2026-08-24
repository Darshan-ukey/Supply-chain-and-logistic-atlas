'use strict';
const registryEngine=require('../engine/atlas-module-registry');
let cache;
function load(){if(cache)return cache;const registry=registryEngine.loadRegistry(),active=registryEngine.loadActiveModules(registry),indexes=registryEngine.buildIndexes(active),page0=registryEngine.readJson(registry.baseModule.source);cache={registry,page0,modules:active,moduleById:indexes.moduleById,moduleByProcessId:indexes.moduleByProcessId,processById:indexes.processById,sourceById:indexes.sourceById};return cache}
function terms(s){return[...new Set(String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2))]}
function search(question,{limit=6,moduleIds}={}){const atlas=load(),q=terms(question),allowed=new Set(moduleIds&&moduleIds.length?moduleIds:Object.keys(atlas.moduleById));const rows=[];for(const [pid,p] of Object.entries(atlas.processById)){const mid=atlas.moduleByProcessId[pid];if(!allowed.has(mid))continue;const blob=[p.id,p.label,p.trigger,p.before,p.event,p.decision,p.rule,p.control,p.action,p.evidence,p.after,p.outcome,p.actor,p.owner,p.inputs?.join(' '),p.outputs?.join(' ')].join(' ').toLowerCase();let score=0;q.forEach(t=>{if(blob.includes(t))score+=t.length>7?2:1});if(String(question).toUpperCase().includes(p.id))score+=10;if(score>0)rows.push({id:p.id,moduleId:mid,score,label:p.label,process:p})}return rows.sort((a,b)=>b.score-a.score).slice(0,limit)}
function evidenceForProcess(p){const {sourceById}=load();return(p.sourceIds||[]).map(id=>sourceById[id]).filter(Boolean).map(s=>({id:s.id,issuer:s.issuer,title:s.title,url:s.url,supports:s.supports,version:s.version,status:s.status}))}
function activeModuleIds(context={}){return registryEngine.resolveModuleIds(context,load().registry)}
module.exports={load,search,evidenceForProcess,activeModuleIds};
