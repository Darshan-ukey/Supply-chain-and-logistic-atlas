import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root=new URL('../',import.meta.url).pathname;process.chdir(root);
const read=p=>fs.readFileSync(root+p,'utf8');const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(root+p)).digest('hex');
const base='./';
for(const p of ['data/core/enterprise-core-ontology-v1.json','data/contracts/domain-extension-contract-v1.schema.json','data/domains/supply-chain-domain-pack-v1.json','data/atlas-registry.json','data/page0/page0-v6.2.2.json','data/modules/road-ltl-v1.2.json'])assert.equal(sha(p),crypto.createHash('sha256').update(fs.readFileSync(base+p)).digest('hex'),`canonical changed: ${p}`);

let captured=null;
const server=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;captured={url:req.url,headers:req.headers,body:JSON.parse(raw)};res.setHeader('Content-Type','application/json');res.end(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({facts:[{factKey:'TEST-1',factType:'PROCESS_EXISTS',statement:'The client accepts the transport request after service eligibility is checked.',processId:'LTL-01',evidenceQuote:'The client accepts the transport request after service eligibility is checked.',evidenceLocator:'chunk:1',confidence:.91,proposedPatch:{confirmProcess:true}}]})}]}}]}));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
process.env.ATLAS_LLM_PROVIDER='gemini';process.env.ATLAS_LLM_API_KEY='test-secret';process.env.ATLAS_LLM_MODEL='gemini-test';process.env.ATLAS_LLM_BASE_URL=`http://127.0.0.1:${port}/generate`;
const {documentDomainRuntime}=await import('../lib/api/_document-domain.js');const {extractCandidateFacts}=await import('../lib/api/_documents.js');
const runtime=documentDomainRuntime();
const sentence='The client accepts the transport request after service eligibility is checked.';
const out=await extractCandidateFacts([{chunkIndex:0,locator:'chunk:1',content:`RFP narrative: ${sentence} The request arrives through an internal portal and is reviewed before commitment.`}],{ephemeral:true},runtime,{requireLlm:true,allowDeterministicFallback:false,maxBatches:1,batchSize:1});
assert.equal(out.method,'LLM_DOCUMENT_EXTRACTION_V3');assert.equal(out.facts.length,1);assert.equal(out.facts[0].processId,'LTL-01');assert.equal(captured.body.store,false,'Gemini request must set store=false');assert.equal(captured.headers['x-goog-api-key'],'test-secret','Gemini key must use header');assert.ok(!captured.url.includes('test-secret'),'Gemini key must not appear in URL');
server.close();

process.env.ATLAS_LLM_PROVIDER='none';process.env.ATLAS_LLM_API_KEY='';process.env.ATLAS_LLM_MODEL='';process.env.ATLAS_LLM_BASE_URL='';
let failedClosed=false;try{await extractCandidateFacts([{chunkIndex:0,locator:'chunk:1',content:sentence}],{ephemeral:true},runtime,{requireLlm:true,allowDeterministicFallback:false})}catch(e){failedClosed=e.status===503}assert.equal(failedClosed,true,'Required LLM path must fail closed when provider is absent');

const ingest=read('lib/api/session-document-ingest.js');assert.doesNotMatch(ingest,/\bsupabase\s*\(/);assert.doesNotMatch(ingest,/storage\/v1|atlas_client_documents|atlas_document_chunks|atlas_candidate_facts/);assert.match(ingest,/allowDeterministicFallback:!pol\.requireLlm/);assert.match(ingest,/Cache-Control.*no-store/);assert.match(read('.env.example'),/ATLAS_EPHEMERAL_DOCUMENT_LLM=true/);assert.match(read('.env.example'),/ATLAS_EPHEMERAL_DOCUMENT_REQUIRE_LLM=true/);assert.match(read('.env.example'),/ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED=false/);
console.log(JSON.stringify({ok:true,llmStructuringRequired:true,deterministicFallbackWhenRequired:false,applicationSourceRetention:'NONE',geminiRequestStore:false,geminiKeyInUrl:false,canonicalUnchanged:true},null,2));

// End-to-end session endpoint proof: auth -> transient LLM -> no-store response; no database/storage write.
process.env.SUPABASE_URL='https://supabase.test';process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test';process.env.ATLAS_LLM_PROVIDER='gemini';process.env.ATLAS_LLM_API_KEY='test-secret';process.env.ATLAS_LLM_MODEL='gemini-test';delete process.env.ATLAS_LLM_BASE_URL;process.env.ATLAS_EPHEMERAL_DOCUMENTS='true';process.env.ATLAS_EPHEMERAL_DOCUMENT_LLM='true';process.env.ATLAS_EPHEMERAL_DOCUMENT_REQUIRE_LLM='true';process.env.ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED='true';process.env.ATLAS_EPHEMERAL_DOCUMENT_ALLOWED_PROVIDERS='gemini';
const sessionHandler=(await import('../lib/api/session-document-ingest.js')).default;
const calls=[];global.fetch=async(url,opt={})=>{calls.push({url:String(url),method:opt.method||'GET',body:opt.body||null});if(String(url).startsWith('https://supabase.test/auth/v1/user'))return {ok:true,status:200,text:async()=>JSON.stringify({id:'u1',email:'pilot@example.com'})};if(String(url).includes(':generateContent'))return {ok:true,status:200,text:async()=>JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({facts:[{factKey:'E2E-1',factType:'PROCESS_EXISTS',statement:sentence,processId:'LTL-01',evidenceQuote:sentence,evidenceLocator:'chunk:1',confidence:.9,proposedPatch:{confirmProcess:true}}]})}]}}]})};throw new Error(`Unexpected outbound call: ${url}`)};
const req={method:'POST',query:{},headers:{cookie:'atlas_access=test-token'},body:{workspaceId:'00000000-0000-0000-0000-000000000001',fileName:'rfp.txt',mimeType:'text/plain',base64:Buffer.from(`${sentence} This paragraph intentionally adds enough readable client narrative for the ingestion validator to accept the supplied RFP evidence.`).toString('base64'),documentType:'RFP / RFI',domainPackId:'supply-chain',moduleId:'road-ltl'},async *[Symbol.asyncIterator](){}};
const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.payload=JSON.parse(v)}};await sessionHandler(req,res);assert.equal(res.statusCode,200);assert.equal(res.payload.retainedServerSide,false);assert.equal(res.payload.externalLlmUsed,true);assert.match(String(res.headers['Cache-Control']||''),/no-store/);assert.equal(calls.filter(x=>x.url.includes('/rest/v1/')||x.url.includes('/storage/v1/')).length,0,'ephemeral endpoint must make no data/storage persistence calls');
console.log(JSON.stringify({endpointOk:true,status:res.statusCode,noStore:true,outboundCalls:calls.map(x=>x.url.replace(/test-secret/g,'REDACTED'))},null,2));
