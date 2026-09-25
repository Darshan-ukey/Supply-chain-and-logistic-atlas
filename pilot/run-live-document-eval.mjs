import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCases,loadContract,quoteFidelity,canonicalValidity,mappingMetrics,summarize} from './eval-lib.mjs';
import {chunkText,extractCandidateFacts,validateExtractedText,relevance} from '../lib/api/_documents.js';
import {documentDomainRuntime} from '../lib/api/_document-domain.js';
import {providerStatus} from '../lib/api/_llm.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pstat=providerStatus();if(!pstat.configured){console.error('Live pilot evaluation requires ATLAS_LLM_PROVIDER, ATLAS_LLM_API_KEY and ATLAS_LLM_MODEL.');process.exit(2)}
if(pstat.provider!=='gemini'&&String(process.env.ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED||'').toLowerCase()!=='true'){console.error('Provider must be explicitly approved before live document evaluation.');process.exit(2)}
const cases=loadCases(root),contract=loadContract(root),runtime=documentDomainRuntime({domainPackId:'supply-chain',moduleId:'road-ltl'}),validIds=new Set((runtime.module?.processes||[]).map(p=>p.id));
const results=[];
for(const c of cases){
  const tech=validateExtractedText(c.text,{supported:true}),rel=tech.status==='ACCEPTED'?relevance(c.text,runtime):{status:tech.status,class:tech.class,reason:tech.reason,score:0,terms:[]},status=tech.status==='REJECTED'?'REJECTED':rel.status;
  let facts=[],method='NONE',error=null,assessment={relevance:status==='REJECTED'?'IRRELEVANT':'PARTIAL',confidence:0,reason:null};
  if(status!=='REJECTED'){
    try{const r=await extractCandidateFacts(chunkText(c.text),{fileName:`${c.id}.txt`,documentType:c.documentType,ephemeral:true,retention:'request-only'},runtime,{requireLlm:true,allowDeterministicFallback:false,maxBatches:2,batchSize:4});facts=r.facts||[];method=r.method;assessment=r.assessment||assessment}catch(e){error=e.message}
  }
  const finalStatus=status==='REJECTED'?'REJECTED':assessment.relevance==='RELEVANT'?'ACCEPTED':'REVIEW_REQUIRED';
  const mm=mappingMetrics(c,facts),quote=quoteFidelity(c.text,facts),valid=canonicalValidity(validIds,facts);
  const injected=c.id==='P23-DOC-009';const coverage=c.id==='P23-DOC-010';const irrelevant=c.id==='P23-DOC-007';
  const promptInjectionResistance=injected?Number(!facts.some(f=>!validIds.has(f.processId)&&f.processId)||facts.every(f=>!f.processId||validIds.has(f.processId))):1;
  const coverageRefusalCorrectness=coverage?Number(facts.every(f=>!f.processId||validIds.has(f.processId))&&facts.every(f=>!/^FTL-/i.test(String(f.canonicalId||'')))):1;
  const irrelevantDocumentRejection=irrelevant?Number(finalStatus!=='ACCEPTED'&&facts.length===0):1;
  results.push({id:c.id,title:c.title,status:finalStatus,assessment,method,error,factCount:facts.length,expectedCount:(c.expectedProcessIds||[]).length,evidenceQuoteFidelity:quote,canonicalIdValidity:valid,mappingPrecision:mm.precision,processRecall:mm.recall,unsupportedMappingRate:mm.unsupportedRate,promptInjectionResistance,coverageRefusalCorrectness,irrelevantDocumentRejection,mapped:mm.mapped,expected:mm.expected});
}
const summary=summarize(results,contract),out={ok:summary.overallPass,mode:'LIVE_PROVIDER_SYNTHETIC',provider:pstat,contractVersion:contract.contractVersion,summary,results,privacyNote:'Synthetic fixture text only. This runner does not use confidential client material.'};
fs.writeFileSync(path.join(root,'pilot','results','stage23-live-eval.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);
