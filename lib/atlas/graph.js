import {getModel,processById} from './store.js';
const FLOW=new Set(['REQUIRES','PRECEDES','FOLLOWS','TRIGGERS','MAY_TRIGGER','BRANCHES_TO','OPTIONAL_AFTER','ALTERNATIVE_TO','BLOCKS','ESCALATES_TO','RECOVERS_TO','ENABLES','ITERATES_TO_NEXT_LEG']);
export function edges(){return getModel().processFlowEdges.filter(e=>FLOW.has(e.type))}
export function incoming(id){return edges().filter(e=>e.to===id)}
export function outgoing(id){return edges().filter(e=>e.from===id)}
export function neighborhood(id,depth=1){const seen=new Set([id]);let frontier=[id];for(let d=0;d<depth;d++){const next=[];for(const n of frontier){for(const e of edges()){if(e.from===n&&!seen.has(e.to)){seen.add(e.to);next.push(e.to)}if(e.to===n&&!seen.has(e.from)){seen.add(e.from);next.push(e.from)}}}frontier=next}return [...seen].map(processById).filter(Boolean)}
export function pathImpact(id){return {process:processById(id),incoming:incoming(id),outgoing:outgoing(id),neighbors:neighborhood(id,2)}}
export function compareProcesses(a,b){const A=processById(a),B=processById(b);if(!A||!B)return null;const keys=['phase','pathType','actor','performer','owner','decisionAuthority','authoritySystem','producer','consumers','upstream','downstream','control','evidence','outcome','claimBoundary'];const differences=[],common=[];for(const k of keys){const av=A[k]??'',bv=B[k]??'';(String(av)===String(bv)?common:differences).push({field:k,a:av,b:bv})}return {a:A,b:B,differences,common}}
