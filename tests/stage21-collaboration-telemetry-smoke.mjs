import fs from 'node:fs';import path from 'node:path';
import {root,assertFrozen} from './_core-baseline.mjs';
import collaboration from '../api/collaboration.js';
import telemetry,{sanitizeTelemetryContext,aggregateTelemetry} from '../api/telemetry.js';
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test-only';
const checks=[];const check=(name,ok,detail='')=>{checks.push({name,ok,detail});if(!ok)process.exitCode=1};
assertFrozen(check);
const client=fs.readFileSync(path.join(root,'stage21-client.js'),'utf8'),migration=fs.readFileSync(path.join(root,'migrations/stage21-collaboration-telemetry.sql'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),stand=fs.readFileSync(path.join(root,'preview-standalone.html'),'utf8');
for(const token of ['Review & Collaboration','LOCAL REVIEW MODE','Product telemetry','Privacy boundary','comment_add','review_request','atlas-stage21-events'])check(`client:${token}`,client.includes(token));
for(const table of ['atlas_collaboration_comments','atlas_review_requests','atlas_usage_events']){check(`migration:${table}`,migration.includes(`public.${table}`));check(`migration RLS:${table}`,migration.includes(`alter table public.${table} enable row level security`))}
check('index loads Stage21 client',html.includes('stage21-client.js'));check('standalone inlines Stage21 client',stand.includes('Stage 21 · Collaboration + Product Telemetry'));
const sanitized=sanitizeTelemetryContext({view:'transform',semanticLevel:3,questionText:'SECRET CLIENT QUESTION',clientName:'Client X',documentText:'sensitive',result:'grounded',citationCount:4});
check('telemetry keeps safe metadata',sanitized.view==='transform'&&sanitized.semanticLevel===3&&sanitized.result==='grounded'&&sanitized.citationCount===4,JSON.stringify(sanitized));
check('telemetry strips free text',!('questionText'in sanitized)&&!('clientName'in sanitized)&&!('documentText'in sanitized),JSON.stringify(sanitized));
const agg=aggregateTelemetry([{user_id:'u1',session_id:'s1',event_name:'trace_start',module_id:'road-ltl',context:{view:'execute'},occurred_at:'2026-08-23T00:00:00Z'},{user_id:'u1',session_id:'s1',event_name:'ask_atlas_submit',module_id:'road-ltl',context:{view:'execute'},occurred_at:'2026-08-23T00:01:00Z'},{user_id:'u2',session_id:'s2',event_name:'ask_atlas_submit',module_id:'road-ltl',context:{view:'transform'},occurred_at:'2026-08-23T00:02:00Z'}],30);
check('aggregate event count',agg.eventCount===3,agg.eventCount);check('aggregate users/sessions',agg.uniqueUsers===2&&agg.uniqueSessions===2,`${agg.uniqueUsers}/${agg.uniqueSessions}`);check('aggregate Ask Atlas',agg.counts.ask_atlas_submit===2,agg.counts.ask_atlas_submit);
function req(method='GET',query={}){return {method,query,headers:{},body:undefined,async *[Symbol.asyncIterator](){}}}
function res(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.payload=v?JSON.parse(v):null}}}
async function run(name,fn,r,expected){const s=res();await fn(r,s);check(name,s.statusCode===expected,`${s.statusCode}`);return s.payload}
await run('collaboration unauthenticated guard',collaboration,req('GET',{workspaceId:'x',entityType:'PROCESS',entityKey:'LTL-01'}),401);
await run('telemetry unauthenticated guard',telemetry,req('GET',{workspaceId:'x'}),401);
check('telemetry schema comments prohibit free text',migration.includes('Do not store question text, document content, client evidence, comments, names, or other free text'));
const result={stage:'21',status:checks.every(x=>x.ok)?'PASS':'FAIL',checks};fs.writeFileSync(path.join(root,'tests','stage21-collaboration-telemetry-smoke.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
