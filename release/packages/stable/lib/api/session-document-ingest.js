import crypto from 'node:crypto';
import {body,send,requireUser,err} from './_utils.js';
import {extractDocument,sha256,validateExtractedText,relevance,chunkText,extractCandidateFacts} from './_documents.js';
import {documentDomainRuntime} from './_document-domain.js';
import {providerStatus} from './_llm.js';

const ALLOWED=new Set(['application/pdf','text/plain','text/markdown','text/csv','application/json','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
function b64(s){if(!/^[A-Za-z0-9+/=\r\n]+$/.test(String(s||'')))throw Object.assign(new Error('Invalid base64 payload'),{status:400});return Buffer.from(s,'base64')}
function yes(name,def=false){const v=process.env[name];if(v==null)return def;return String(v).toLowerCase()==='true'}
function allowedProviders(){return new Set(String(process.env.ATLAS_EPHEMERAL_DOCUMENT_ALLOWED_PROVIDERS||'gemini').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean))}
function policy(){return {enabled:yes('ATLAS_EPHEMERAL_DOCUMENTS',true),useLlm:yes('ATLAS_EPHEMERAL_DOCUMENT_LLM',true),requireLlm:yes('ATLAS_EPHEMERAL_DOCUMENT_REQUIRE_LLM',true),providerApproved:yes('ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED',false),allowedProviders:allowedProviders()}}
function noStore(){return {'Cache-Control':'no-store, no-cache, max-age=0, must-revalidate, private','Pragma':'no-cache','Expires':'0'}}
export default async function handler(req,res){
 try{
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'},noStore());
  await requireUser(req);const b=await body(req),pol=policy(),pstat=providerStatus();
  if(!pol.enabled)return send(res,409,{ok:false,error:'Ephemeral client-document mode is disabled.'},noStore());
  if(!b.workspaceId||!b.fileName||!b.base64)return send(res,400,{ok:false,error:'workspaceId, fileName and base64 are required'},noStore());
  if(pol.requireLlm){
    if(!pol.useLlm)return send(res,503,{ok:false,error:'Ephemeral document structuring requires the approved LLM path; ATLAS_EPHEMERAL_DOCUMENT_LLM is disabled.'},noStore());
    if(!pol.providerApproved)return send(res,503,{ok:false,error:'Ephemeral document LLM provider has not been administratively approved for confidential pilot use.'},noStore());
    if(!pstat.configured)return send(res,503,{ok:false,error:'Ephemeral document structuring requires a configured LLM provider.'},noStore());
    if(!pol.allowedProviders.has(pstat.provider))return send(res,403,{ok:false,error:`LLM provider ${pstat.provider} is not approved for ephemeral client-document structuring.`},noStore());
  }
  const mime=String(b.mimeType||'application/octet-stream');if(!ALLOWED.has(mime))return send(res,415,{ok:false,error:'Unsupported client document type'},noStore());
  const bytes=b64(b.base64);if(bytes.length>3*1024*1024)return send(res,413,{ok:false,error:'Ephemeral inline ingestion is capped at 3 MB.'},noStore());if(bytes.length<20)return send(res,400,{ok:false,error:'File is empty or too small.'},noStore());
  const domain=documentDomainRuntime({domainPackId:String(b.domainPackId||'supply-chain'),moduleId:String(b.moduleId||'road-ltl')});
  const extracted=await extractDocument(bytes,mime,b.fileName),tech=validateExtractedText(extracted.text,extracted),relHint=tech.status==='ACCEPTED'?relevance(extracted.text,domain):{status:tech.status,class:tech.class,reason:tech.reason,score:0,terms:[]};
  let facts=[],method='NONE',provider={...pstat,used:false},assessment={relevance:tech.status==='REJECTED'?'IRRELEVANT':'PARTIAL',confidence:0,reason:tech.reason};
  if(tech.status!=='REJECTED'&&extracted.supported&&extracted.text){
    const chunks=chunkText(extracted.text);
    if(chunks.length){
      const r=await extractCandidateFacts(chunks,{fileName:b.fileName,mimeType:mime,documentType:b.documentType||null,validationClass:tech.class,domainPackId:domain.domainPackId,moduleId:domain.moduleId,ephemeral:true,retention:'request-only'},domain,{requireLlm:pol.requireLlm,allowDeterministicFallback:!pol.requireLlm,maxBatches:8,batchSize:6});
      facts=r.facts||[];method=r.method;provider=r.provider||provider;assessment=r.assessment||assessment;
    }
  }
  const finalStatus=tech.status==='REJECTED'?'REJECTED':assessment.relevance==='RELEVANT'?'ACCEPTED':'REVIEW_REQUIRED';
  const validationClass=tech.status==='REJECTED'?tech.class:assessment.relevance==='IRRELEVANT'?'LLM_IRRELEVANT':assessment.relevance==='PARTIAL'?'LLM_PARTIAL':'VALID';
  const reason=tech.status==='REJECTED'?tech.reason:(assessment.reason||relHint.reason||tech.reason);
  const sid=crypto.randomUUID(),candidates=facts.map((f,i)=>({...f,id:`SESSION-${sid}-${i+1}`,review_status:'NEEDS_REVIEW',ephemeral:true}));
  // Deliberately no Storage write, no document row, no chunk row, no vector/cache write and no candidate-fact row.
  return send(res,200,{ok:true,ephemeral:true,retainedServerSide:false,externalLlmUsed:provider.used===true,document:{id:`SESSION-${sid}`,original_filename:b.fileName,mime_type:mime,size_bytes:bytes.length,sha256:sha256(bytes),document_type:b.documentType||null,ingestion_status:finalStatus,validation_class:validationClass,validation_reason:reason,extraction_method:extracted.method,extracted_chars:extracted.text?.length||0,relevance_score:relHint.score||0,relevance_terms:relHint.terms||[],ephemeral:true,created_at:new Date().toISOString()},candidates,method,documentAssessment:assessment,providerPolicy:{provider:pstat.provider,providerApproved:pol.providerApproved,requestStorage:pstat.requestStorage,applicationRetention:'NONE',canonicalMutation:'NONE'},guardrail:'The approved LLM may structure request-scoped document text, but the Atlas server does not persist the source bytes, parsed text, chunks, embeddings, candidate-fact rows or provider response. Gemini generateContent requests are sent with store=false. Candidate facts remain unconfirmed until consultant review.'},noStore());
 }catch(e){err(res,e)}
}
