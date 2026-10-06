import {validatePublicProjection,fetchPublicProjection,renderUnavailable} from '../assets/universal-daughter-renderer-v2.js';

let failures=0;
const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++};
const selection={moduleId:'road-ltl',moduleVersion:'1.5',taskId:'LTL-03'};
const valid=()=>({
  projectionClass:'PUBLIC_SAFE',
  trace:{...selection,projectionContractVersion:'1.1.0'},
  overview:{title:'x'},
  operationalKnowledge:{businessMeaning:'x'},
  executionReadiness:{status:'BLOCKED'},
  protectedExecution:{
    workDecomposition:{status:'BLOCKED',detailIncluded:false},
    workDefinition:{status:'NOT_INDEPENDENTLY_PROVEN',detailIncluded:false}
  }
});
const rejects=(mutate)=>{
  const p=valid();mutate(p);
  try{validatePublicProjection(p,selection);return false}catch(e){return e?.code==='PROJECTION_INVALID'}
};
check(validatePublicProjection(valid(),selection).projectionClass==='PUBLIC_SAFE','valid exact PUBLIC_SAFE tuple accepted');
check(rejects(p=>p.projectionClass='PROTECTED'),'non-PUBLIC_SAFE class rejected');
check(rejects(p=>p.trace.moduleVersion='1.4'),'wrong exact tuple rejected');
check(rejects(p=>delete p.executionReadiness),'missing required depth rejected');
check(rejects(p=>p.protectedExecution.workDefinition.detailIncluded=true),'protected WorkDefinition detail rejected');
check(rejects(p=>p.protectedExecution.workDecomposition.fields=['secret']),'unexpected protected fields rejected');
const okFetch=async()=>({ok:true,status:200,json:async()=>({ok:true,projection:valid()})});
const wrongFetch=async()=>{const p=valid();p.trace.taskId='LTL-99';return {ok:true,status:200,json:async()=>({ok:true,projection:p})}};
const malformedFetch=async()=>({ok:true,status:200,json:async()=>{throw new Error('bad json')}});
const outageFetch=async()=>({ok:false,status:503,json:async()=>({ok:false,error:'down'})});
check((await fetchPublicProjection(selection,{fetchImpl:okFetch})).trace.taskId==='LTL-03','fetch accepts validated exact projection');
for(const [label,impl,code] of [
  ['fetch rejects wrong-scope 200',wrongFetch,'PROJECTION_INVALID'],
  ['fetch rejects malformed 200',malformedFetch,'PROJECTION_UNAVAILABLE'],
  ['fetch rejects outage',outageFetch,'PROJECTION_UNAVAILABLE']
]){
  let got='';try{await fetchPublicProjection(selection,{fetchImpl:impl})}catch(e){got=e?.code}
  check(got===code,label);
}
const unavailable=renderUnavailable('invalid projection');
check(unavailable.includes('FAIL-CLOSED PRESENTATION BOUNDARY')&&unavailable.includes('No alternate Daughter version has been substituted.'),'explicit fail-closed state retained');
console.log(failures?`FAIL · ${failures} RP06 renderer validation check(s) failed`:'PASS · RP06 renderer validation · exact PUBLIC_SAFE contract enforced fail-closed');
if(failures)process.exit(1);
