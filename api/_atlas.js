'use strict';
const fs=require('fs'),path=require('path');
let cache;
function load(){if(cache)return cache;const root=path.join(__dirname,'..');const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));const road=read('data/modules/road-ltl-v1.2.json'),page0=read('data/page0/page0-v6.2.2.json'),registry=read('data/atlas-registry.json');cache={road,page0,registry,processById:Object.fromEntries(road.processes.map(p=>[p.id,p])),sourceById:Object.fromEntries(road.sources.map(s=>[s.id,s]))};return cache}
function terms(s){return [...new Set(String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2))]}
function search(question,{limit=6}={}){const {road}=load(),q=terms(question);return road.processes.map(p=>{const blob=[p.id,p.label,p.trigger,p.before,p.event,p.decision,p.rule,p.control,p.action,p.evidence,p.after,p.outcome,p.actor,p.owner,p.inputs?.join(' '),p.outputs?.join(' ')].join(' ').toLowerCase();let score=0;q.forEach(t=>{if(blob.includes(t))score+=t.length>7?2:1});if(String(question).toUpperCase().includes(p.id))score+=10;return {id:p.id,score,label:p.label,process:p}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit)}
function evidenceForProcess(p){const {sourceById}=load();return (p.sourceIds||[]).map(id=>sourceById[id]).filter(Boolean).map(s=>({id:s.id,issuer:s.issuer,title:s.title,url:s.url,supports:s.supports}))}
module.exports={load,search,evidenceForProcess};
