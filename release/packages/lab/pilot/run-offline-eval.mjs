import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadCases,loadContract} from './eval-lib.mjs';
import {validateExtractedText,relevance,chunkText} from '../lib/api/_documents.js';
import {documentDomainRuntime} from '../lib/api/_document-domain.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cases=loadCases(root),contract=loadContract(root),runtime=documentDomainRuntime({domainPackId:'supply-chain',moduleId:'road-ltl'});
const results=[];
for(const c of cases){
  const tech=validateExtractedText(c.text,{supported:true}), rel=tech.status==='ACCEPTED'?relevance(c.text,runtime):{status:tech.status,class:tech.class,reason:tech.reason,score:0,terms:[]};
  const status=tech.status==='REJECTED'?'REJECTED':rel.status;
  const technicalPrecheckPass=c.id==='P23-DOC-008'?status==='REJECTED':status!=='REJECTED';
  results.push({id:c.id,title:c.title,status,technicalPrecheckPass,validationClass:tech.status==='REJECTED'?tech.class:rel.class,relevanceScore:rel.score||0,chunkCount:chunkText(c.text).length});
}
const read=p=>fs.readFileSync(path.join(root,p));const sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'tests','_core-baseline.mjs').replace(/\.mjs$/,'.mjs'),'utf8').match(/BASELINE\s*=\s*(\{[\s\S]*?\});/)?.[1]||'{}');
const canonical={
  core:sha('data/core/enterprise-core-ontology-v1.json'),
  domainContract:sha('data/contracts/domain-extension-contract-v1.schema.json'),
  supplyChainPack:sha('data/domains/supply-chain-domain-pack-v1.json'),
  registry:sha('data/atlas-registry.json'),
  page0:sha('data/page0/page0-v6.2.2.json'),
  roadLtl:sha('data/modules/road-ltl-v1.2.json')
};
const staticChecks={
  tenSyntheticCases:cases.length===10,
  technicalPrechecksPass:results.every(r=>r.technicalPrecheckPass),
  contractHasHardPrivacyGates:contract.hardGates.includes('ephemeralPersistenceWrites')&&contract.hardGates.includes('canonicalMutationCount'),
  noRealClientNamesInCorpus:!cases.some(c=>/fedex|aramex|ups\b/i.test(JSON.stringify(c))),
  promptInjectionCasePresent:cases.some(c=>c.id==='P23-DOC-009'),
  unpublishedCoverageCasePresent:cases.some(c=>c.id==='P23-DOC-010')
};
const out={ok:Object.values(staticChecks).every(Boolean),mode:'OFFLINE_PRE_PROVIDER',contractVersion:contract.contractVersion,staticChecks,canonical,results,note:'This does not certify live Gemini extraction quality. Run npm run pilot:eval:live after the approved Gemini provider is configured.'};
fs.writeFileSync(path.join(root,'pilot','results','stage23-offline-eval.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);
