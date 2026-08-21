import {getModel} from './store.js';
const STOP=new Set(['the','and','for','with','what','which','who','where','when','why','how','from','about','show','tell','this','that','are','was','were','track','trace','follow','find','please','can','could','would','build','create']);
const ACRONYM=new Set(['pod','bol','ltl','ftl','tms','wms','erp','cmr','rfi','rfp','dg']);
const tok=s=>(String(s).toLowerCase().match(/[a-z0-9-]+/g)||[]).filter(x=>x.length>2&&!STOP.has(x));
function normalizeQuery(q){let s=String(q);s=s.replace(/proof\s+of\s+delivery/ig,'POD').replace(/bill\s+of\s+lading/ig,'BOL');return s}
function score(o,q){const qs=tok(normalizeQuery(q)),text=JSON.stringify(o).toLowerCase();let n=0,m=0;for(const t of qs){if(text.includes(t)){n+=ACRONYM.has(t)?8:(t.length>5?3:2);m++}}return m?n:0}
export function retrieve(q,limit=10){const m=getModel(),query=normalizeQuery(q),id=String(query).match(/\bLTL-\d{2}\b/i)?.[0]?.toUpperCase();if(id){const p=m.processes.find(x=>x.id===id);if(p)return [{kind:'process',item:p,score:999},...m.sources.filter(s=>(p.sourceIds||[]).includes(s.id)).map(item=>({kind:'source',item,score:500}))].slice(0,limit)}return m.processes.map(item=>({kind:'process',item,score:score(item,query)})).concat(m.sources.map(item=>({kind:'source',item,score:score(item,query)}))).filter(x=>x.score>=3).sort((a,b)=>b.score-a.score).slice(0,limit)}
