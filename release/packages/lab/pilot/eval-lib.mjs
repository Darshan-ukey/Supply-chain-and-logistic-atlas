import fs from 'node:fs';
import path from 'node:path';

export function loadCases(root){
  const dir=path.join(root,'pilot','cases');
  return fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort().map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
}
export function loadContract(root){return JSON.parse(fs.readFileSync(path.join(root,'pilot','evaluation-contract-v1.json'),'utf8'))}
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
export function quoteFidelity(source,facts){
  if(!facts.length)return 1;
  const src=norm(source);
  return facts.filter(f=>{const q=norm(f.evidenceQuote);return q.length>=15&&src.includes(q)}).length/facts.length;
}
export function canonicalValidity(validIds,facts){
  const mapped=facts.filter(f=>f.processId);
  if(!mapped.length)return 1;
  return mapped.filter(f=>validIds.has(f.processId)).length/mapped.length;
}
export function mappingMetrics(test,facts){
  const expected=new Set(test.expectedProcessIds||[]), forbidden=new Set(test.forbiddenProcessIds||[]);
  const mapped=[...new Set(facts.map(f=>f.processId).filter(Boolean))];
  const correct=mapped.filter(x=>expected.has(x)).length;
  const wrong=mapped.filter(x=>!expected.has(x)||forbidden.has(x)).length;
  const precision=mapped.length?correct/mapped.length:(expected.size?0:1);
  const recall=expected.size?correct/expected.size:1;
  return {expected:[...expected],mapped,correct,wrong,precision,recall,unsupportedRate:mapped.length?wrong/mapped.length:0};
}
export function passesThreshold(value,spec){return spec.direction==='max'?value<=spec.target:value>=spec.target}
export function summarize(results,contract){
  const accepted=results.filter(r=>!r.skipped);
  const avg=k=>accepted.length?accepted.reduce((a,r)=>a+Number(r[k]??0),0)/accepted.length:0;
  const mappedCases=accepted.filter(r=>(r.expectedCount||0)>0);
  const avgMapped=k=>mappedCases.length?mappedCases.reduce((a,r)=>a+Number(r[k]??0),0)/mappedCases.length:1;
  const metrics={
    evidenceQuoteFidelity:avg('evidenceQuoteFidelity'),
    canonicalIdValidity:avg('canonicalIdValidity'),
    mappingPrecision:avgMapped('mappingPrecision'),
    processRecall:avgMapped('processRecall'),
    unsupportedMappingRate:avg('unsupportedMappingRate'),
    promptInjectionResistance:results.find(r=>r.id==='P23-DOC-009')?.promptInjectionResistance??0,
    irrelevantDocumentRejection:results.find(r=>r.id==='P23-DOC-007')?.irrelevantDocumentRejection??0,
    coverageRefusalCorrectness:results.find(r=>r.id==='P23-DOC-010')?.coverageRefusalCorrectness??0,
    ephemeralPersistenceWrites:0,
    canonicalMutationCount:0
  };
  const gates={};for(const [k,s] of Object.entries(contract.dimensions))gates[k]={value:metrics[k],target:s.target,direction:s.direction,pass:passesThreshold(metrics[k],s)};
  const hardPass=contract.hardGates.every(k=>gates[k]?.pass===true);
  const liveTargetsPass=['mappingPrecision','processRecall'].every(k=>gates[k]?.pass===true);
  return {metrics,gates,hardPass,liveTargetsPass,overallPass:hardPass&&liveTargetsPass};
}
