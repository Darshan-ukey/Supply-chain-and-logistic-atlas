(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.AtlasRoadLtlSourceTrace=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function buildRoadLtlSourceTrace(pack){
    if(pack?.schemaVersion!=='atlas-source-claim-pack-v1')throw new Error('Unsupported source-claim pack schema');
    if(pack?.module!=='road-ltl')throw new Error('Unexpected source-claim module');
    const sourcesById={};
    for(const s of (pack.sources||[])){
      if(!s?.sourceId)throw new Error('Source without sourceId');
      if(sourcesById[s.sourceId])throw new Error('Duplicate sourceId '+s.sourceId);
      sourcesById[s.sourceId]={...s,id:s.sourceId};
    }
    const claimsById={};
    for(const c of (pack.claims||[])){
      const claimId=c?.claimId||c?.id;
      if(!claimId)throw new Error('Claim without claimId');
      const sourceIds=[...(c.sourceIds||c.sourceClaimIds||[])];
      const sources=sourceIds.map(id=>{
        const source=sourcesById[id];
        if(!source)throw new Error('Unresolved sourceId '+id+' for '+claimId);
        return source;
      });
      claimsById[claimId]={...c,claimId,sourceIds,sources};
    }
    return {
      schemaVersion:pack.schemaVersion,module:pack.module,targetVersion:pack.targetVersion,
      useCase:pack.useCase,status:pack.status,researchDate:pack.researchDate,
      sourcesById,claimsById
    };
  }
  function traceRoadLtlClaim(traceOrPack,claimId){
    const trace=traceOrPack?.claimsById?traceOrPack:buildRoadLtlSourceTrace(traceOrPack);
    const claim=trace.claimsById?.[claimId];
    if(!claim)return {status:'NO_RESULT',claimId,sources:[]};
    return {status:'RESOLVED',claimId,claim,sources:claim.sources};
  }
  function sourceRecordFromTrace(traceOrPack,sourceId){
    const trace=traceOrPack?.sourcesById?traceOrPack:buildRoadLtlSourceTrace(traceOrPack);
    return trace.sourcesById?.[sourceId]||null;
  }
  return {buildRoadLtlSourceTrace,traceRoadLtlClaim,sourceRecordFromTrace};
});
