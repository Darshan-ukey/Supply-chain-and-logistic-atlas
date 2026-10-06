(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.AtlasCanonicalDiscovery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CLASSES=[
    ['System','systemRecords'],
    ['Business Object','businessObjectRecords'],
    ['Event','eventRecords'],
    ['Document','documentRecords']
  ];
  const norm=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
  function buildCanonicalDiscoveryIndex(page0){
    const records=[];
    for(const [objectClass,key] of CLASSES){
      for(const record of (page0?.[key]||[])){
        const tokens=[record.id,record.code,record.name,...(record.aliases||[])].filter(Boolean);
        records.push({
          objectClass,id:record.id,code:record.code||'',name:record.name||record.id,
          aliases:[...(record.aliases||[])],domainIds:[...(record.domainIds||[])],
          tokens,normalizedTokens:[...new Set(tokens.map(norm).filter(Boolean))]
        });
      }
    }
    return records;
  }
  function searchCanonicalDiscovery(page0,query,{objectClass}={}){
    const q=norm(query); if(!q)return [];
    return buildCanonicalDiscoveryIndex(page0)
      .filter(r=>!objectClass||r.objectClass===objectClass)
      .map(r=>{
        const exact=r.normalizedTokens.includes(q);
        const contains=!exact&&r.normalizedTokens.some(t=>t.includes(q));
        return exact||contains?{...r,matchType:exact?'EXACT':'CONTAINS'}:null;
      }).filter(Boolean)
      .sort((a,b)=>(a.matchType===b.matchType?0:a.matchType==='EXACT'?-1:1)
        ||a.objectClass.localeCompare(b.objectClass)||a.name.localeCompare(b.name));
  }
  function resolveCanonicalDiscovery(page0,query,{objectClass}={}){
    const q=norm(query);
    if(!q)return {status:'NO_RESULT',query:String(query??''),matches:[]};
    const matches=buildCanonicalDiscoveryIndex(page0)
      .filter(r=>(!objectClass||r.objectClass===objectClass)&&r.normalizedTokens.includes(q));
    if(matches.length===1)return {status:'RESOLVED',query:String(query),match:matches[0],matches};
    if(matches.length>1)return {status:'AMBIGUOUS',query:String(query),matches};
    return {status:'NO_RESULT',query:String(query),matches:[]};
  }
  function findCanonicalById(page0,id,objectClass){
    return buildCanonicalDiscoveryIndex(page0)
      .find(r=>r.id===id&&(!objectClass||r.objectClass===objectClass))||null;
  }
  return {buildCanonicalDiscoveryIndex,searchCanonicalDiscovery,resolveCanonicalDiscovery,findCanonicalById};
});
