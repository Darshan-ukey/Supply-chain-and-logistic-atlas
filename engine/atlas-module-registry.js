'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const readJson=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function loadRegistry(){return readJson('data/atlas-registry.json')}
function activeModuleEntries(registry=loadRegistry()){return (registry.modules||[]).filter(m=>m.status==='ACTIVE'&&m.source)}
function loadActiveModules(registry=loadRegistry()){return activeModuleEntries(registry).map(entry=>({entry,module:readJson(entry.source)}))}
function buildIndexes(modules=loadActiveModules()){
 const processById={},sourceById={},moduleByProcessId={},moduleById={};
 for(const {entry,module} of modules){moduleById[entry.id]=module;for(const p of module.processes||[]){if(processById[p.id])throw new Error(`Duplicate process id ${p.id}`);processById[p.id]=p;moduleByProcessId[p.id]=entry.id}for(const s of module.sources||[])sourceById[s.id]??=s}
 return{processById,sourceById,moduleByProcessId,moduleById}
}
function resolveModuleIds(context={},registry=loadRegistry()){
 const active=new Set(activeModuleEntries(registry).map(x=>x.id));
 const asked=[...(Array.isArray(context.moduleIds)?context.moduleIds:[]),context.moduleId,context.mode,context.service].filter(Boolean);
 const matched=asked.filter(x=>active.has(x));return matched.length?[...new Set(matched)]:[...active]
}
module.exports={ROOT,readJson,loadRegistry,activeModuleEntries,loadActiveModules,buildIndexes,resolveModuleIds};
