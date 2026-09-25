import {validateExtractedText,relevance,chunkText,deterministicCandidateFacts} from '../api/_documents.js';
import documents from '../api/documents.js';
import ingest from '../api/document-ingest.js';
import facts from '../api/document-facts.js';
import {retrieveAtlas} from '../api/_atlas.js';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test-only';
function req(method='GET',query={}){return {method,query,headers:{},body:undefined,async *[Symbol.asyncIterator](){}}}
function res(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.payload=v?JSON.parse(v):null}}}
async function run(name,fn,r,expected){const s=res();await fn(r,s);if(s.statusCode!==expected)throw new Error(`${name}: expected ${expected}, got ${s.statusCode}`);return s.payload}
const tests=[];
const good='At the origin service centre, the carrier receives the shipment, verifies the handling unit state, records the arrival event and reconciles the transport document before consolidation. The terminal operator uses the transport management system and scan evidence to verify the shipment.';
let x=validateExtractedText(good,{supported:true});tests.push({name:'readable-document-pass',pass:x.status==='ACCEPTED',detail:x});
x=validateExtractedText('$$$$ #### @@', {supported:true});tests.push({name:'garbage-rejected',pass:x.status==='REJECTED'&&x.class==='GARBAGE',detail:x});
const rel=relevance(good);tests.push({name:'atlas-relevance',pass:rel.status==='ACCEPTED'&&rel.score>=0.5&&rel.terms.length>=3,detail:rel});
const low=relevance('The museum exhibition catalogue describes Renaissance portraiture, pigments, restoration techniques, curatorial notes, gallery opening hours, sculpture collections, artist biographies, architectural history, public lectures, ticket reservations, and educational events. Visitors may attend guided tours and evening performances throughout the autumn season.');tests.push({name:'low-relevance-does-not-pollute',pass:low.status==='REVIEW_REQUIRED'&&low.class==='LOW_RELEVANCE',detail:low});
const cands=deterministicCandidateFacts(chunkText(good));tests.push({name:'deterministic-candidate-mapping',pass:cands.length>=1&&cands[0].processId==='LTL-06'&&cands[0].mappingStatus==='MAPPED',detail:cands.slice(0,2)});
const client={workspace:{mappings:{},evidence:{'DOC-f1':{id:'DOC-f1',title:'SOP excerpt',note:'Client uses TerminalScan X at origin receipt.',locator:'page 3',documentId:'doc-1'}},confirmedDocumentFacts:{'f1':{id:'f1',factType:'SYSTEM',statement:'Client uses TerminalScan X at origin receipt.',processId:'LTL-06',canonicalId:'LTL-06',confirmedAt:'2026-08-23T00:00:00Z',evidenceId:'DOC-f1'}}}};
const retrieved=retrieveAtlas('What client system is used at origin receipt?',{moduleId:'road-ltl',selectedProcess:'LTL-06'},client);tests.push({name:'only-confirmed-document-facts-enter-retrieval',pass:retrieved.some(e=>e.class==='CLIENT_DOCUMENT_FACT'&&e.content.id==='f1'),detail:retrieved.filter(e=>e.class.startsWith('CLIENT_')).map(e=>({class:e.class,title:e.title}))});
let r=await run('documentsUnauth',documents,req('GET',{workspaceId:'x'}),401);tests.push({name:'documents-auth-gate',pass:/Authentication required/i.test(r.error||''),detail:r});
r=await run('ingestUnauth',ingest,req('POST'),401);tests.push({name:'ingest-auth-gate',pass:/Authentication required/i.test(r.error||''),detail:r});
r=await run('factsUnauth',facts,req('GET',{workspaceId:'x'}),401);tests.push({name:'candidate-review-auth-gate',pass:/Authentication required/i.test(r.error||''),detail:r});
const ok=tests.every(t=>t.pass);console.log(JSON.stringify({ok,tests},null,2));process.exit(ok?0:1);
