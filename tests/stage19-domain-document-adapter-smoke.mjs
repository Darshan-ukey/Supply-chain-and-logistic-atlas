import fs from 'node:fs';
import {deterministicCandidateFacts,relevance,chunkText} from '../api/_documents.js';
import {documentDomainRuntime} from '../api/_document-domain.js';
const module=JSON.parse(fs.readFileSync(new URL('../data/fixtures/accounts-payable-module-v0.1.json',import.meta.url),'utf8'));
const pack=JSON.parse(fs.readFileSync(new URL('../data/domains/accounts-payable-fixture-domain-pack-v1.json',import.meta.url),'utf8'));
const runtime={domainPackId:pack.id,moduleId:module.module.id,pack,module,territories:pack.territories};
const text='The invoice is validated and matched to the purchase order and receipt. If the invoice does not match, an exception is created before approval and posting.';
const rel=relevance(text,runtime),facts=deterministicCandidateFacts(chunkText(text),runtime);
let gate=false,gateMessage='';try{documentDomainRuntime({domainPackId:'accounts-payable-fixture',moduleId:'accounts-payable-fixture'})}catch(e){gate=true;gateMessage=e.message}
const out={ok:rel.status==='ACCEPTED'&&facts.some(x=>x.processId==='APF-03')&&facts.some(x=>x.processId==='APF-04')&&gate,relevance:rel,facts,productionGate:{pass:gate,message:gateMessage}};
fs.writeFileSync(new URL('./stage19-domain-document-adapter-smoke.json',import.meta.url),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);
