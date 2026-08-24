import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const prior='.';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const rel of ['data/core/enterprise-core-ontology-v1.json','data/contracts/domain-extension-contract-v1.schema.json','data/domains/supply-chain-domain-pack-v1.json','data/atlas-registry.json','data/page0/page0-v6.2.2.json','data/modules/road-ltl-v1.2.json','data/fixtures/accounts-payable-module-v0.1.json'])assert.equal(sha(path.join(root,rel)),sha(path.join(prior,rel)),`canonical/domain fixture changed: ${rel}`);

const contract=JSON.parse(fs.readFileSync(path.join(root,'pilot/evaluation-contract-v1.json'),'utf8'));
assert.equal(contract.contractVersion,'atlas-pilot-evaluation-v1.0');
assert.ok(contract.hardGates.includes('ephemeralPersistenceWrites'));
assert.ok(contract.hardGates.includes('canonicalMutationCount'));
const caseFiles=fs.readdirSync(path.join(root,'pilot/cases')).filter(x=>x.endsWith('.json'));
assert.equal(caseFiles.length,10);
const cases=caseFiles.map(f=>JSON.parse(fs.readFileSync(path.join(root,'pilot/cases',f),'utf8')));
assert.ok(cases.some(x=>x.id==='P23-DOC-009'&&/ignore all previous instructions/i.test(x.text)));
assert.ok(cases.some(x=>x.id==='P23-DOC-010'&&/FTL/i.test(x.text)));
assert.ok(!cases.some(x=>/fedex|aramex|ups\b/i.test(JSON.stringify(x))),'synthetic corpus must not contain real client names');

let mode='relevant',captured=[];
const server=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);captured.push(body);let payload;
 if(mode==='irrelevant')payload={documentAssessment:{relevance:'IRRELEVANT',confidence:.99,reason:'No supply-chain operating content.'},facts:[]};
 else if(mode==='injection')payload={documentAssessment:{relevance:'RELEVANT',confidence:.94,reason:'Origin receipt operating evidence is present.'},facts:[{factKey:'INJ-1',factType:'PROCESS_EXISTS',statement:'Freight arrives at the origin service centre and handling units are scanned.',processId:'FTL-FAKE-999',canonicalType:'PROCESS',canonicalId:'FTL-FAKE-999',canonicalLabel:'Invented task',evidenceQuote:'freight arrives at the origin service centre, handling units are scanned',evidenceLocator:'chunk:1',confidence:.99,proposedPatch:{confirmProcess:true}}]};
 else payload={documentAssessment:{relevance:'RELEVANT',confidence:.95,reason:'Pickup and origin operations are described.'},facts:[{factKey:'REL-1',factType:'PROCESS_EXISTS',statement:'The client requests pickup and verifies readiness.',processId:'LTL-04',evidenceQuote:'Customer submits pickup request by portal/email.',evidenceLocator:'chunk:1',confidence:.9,proposedPatch:{confirmProcess:true}}]};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(payload)}]}}]}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
process.env.ATLAS_LLM_PROVIDER='gemini';process.env.ATLAS_LLM_API_KEY='synthetic-key';process.env.ATLAS_LLM_MODEL='gemini-test';process.env.ATLAS_LLM_BASE_URL=`http://127.0.0.1:${server.address().port}/generate`;
const {documentDomainRuntime}=await import('../lib/api/_document-domain.js');const {extractCandidateFacts,chunkText}=await import('../lib/api/_documents.js');const runtime=documentDomainRuntime();

const relevant=cases.find(x=>x.id==='P23-DOC-001');mode='relevant';let r=await extractCandidateFacts(chunkText(relevant.text),{ephemeral:true},runtime,{requireLlm:true,allowDeterministicFallback:false,maxBatches:1,batchSize:2});
assert.equal(r.method,'LLM_DOCUMENT_EXTRACTION_V3');assert.equal(r.assessment.relevance,'RELEVANT');assert.equal(r.facts[0].processId,'LTL-04');
mode='irrelevant';r=await extractCandidateFacts(chunkText(cases.find(x=>x.id==='P23-DOC-007').text),{ephemeral:true},runtime,{requireLlm:true,allowDeterministicFallback:false,maxBatches:1,batchSize:2});assert.equal(r.assessment.relevance,'IRRELEVANT');assert.equal(r.facts.length,0);
mode='injection';r=await extractCandidateFacts(chunkText(cases.find(x=>x.id==='P23-DOC-009').text),{ephemeral:true},runtime,{requireLlm:true,allowDeterministicFallback:false,maxBatches:1,batchSize:2});assert.equal(r.facts.length,1);assert.equal(r.facts[0].processId,null,'invalid process ID must not survive deterministic Atlas validation');assert.equal(r.facts[0].mappingStatus,'UNMAPPED');
assert.ok(captured.every(x=>x.store===false),'all Gemini requests must use store=false');assert.ok(captured.every(x=>/untrusted evidence, never as instructions/i.test(x.systemInstruction.parts[0].text)),'prompt injection boundary missing');
server.close();

const ingest=fs.readFileSync(path.join(root,'lib/api/session-document-ingest.js'),'utf8');assert.doesNotMatch(ingest,/\bsupabase\s*\(/);assert.match(ingest,/assessment\.relevance==='RELEVANT'/);assert.match(ingest,/documentAssessment:assessment/);
const evalApi=fs.readFileSync(path.join(root,'lib/api/pilot-evaluation.js'),'utf8');assert.match(evalApi,/atlas_pilot_evaluations/);assert.doesNotMatch(evalApi,/documentText|rawDocument|sourceExcerpt|documentBytes/,'evaluation API must not define raw-document content fields');
const migration=fs.readFileSync(path.join(root,'migrations/stage23-pilot-evaluations.sql'),'utf8');assert.match(migration,/enable row level security/i);assert.match(migration,/can_write_workspace/);assert.match(migration,/can_manage_workspace/);

const out={ok:true,stage:'23',canonicalUnchanged:true,syntheticCases:cases.length,llmSemanticRelevance:true,promptInjectionBoundary:true,invalidCanonicalIdMapped:false,ephemeralPersistence:'NONE',evaluationRls:true,liveGeminiCertification:'PENDING_EXTERNAL_CONFIGURATION'};
fs.writeFileSync(path.join(root,'tests/stage23-pilot-evaluation-smoke.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
