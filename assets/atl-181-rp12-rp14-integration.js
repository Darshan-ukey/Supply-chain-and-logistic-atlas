(function(root){
  'use strict';
  function state(){try{return typeof S!=='undefined'?S:root.S}catch(_){return root.S}}
  function canonicalMatches(q){
    const st=state();
    return q&&root.AtlasCanonicalDiscovery&&st?.page0
      ?root.AtlasCanonicalDiscovery.searchCanonicalDiscovery(st.page0,q).slice(0,12):[];
  }
  function selectCanonical(id,objectClass){
    const st=state();
    const rec=root.AtlasCanonicalDiscovery?.findCanonicalById(st?.page0,id,objectClass);
    if(!rec){root.addChat?.('Canonical object '+id+' is not present in governed Page 0.','atlas',true);return}
    st.canonicalSelection={id:rec.id,objectClass:rec.objectClass};
    const r=root.AtlasCanonicalDiscovery.resolveCanonicalDiscovery(st.page0,rec.id,{objectClass:rec.objectClass});
    if(r.status!=='RESOLVED'){root.addChat?.('Canonical object '+id+' could not be resolved fail-closed.','atlas',true);return}
    root.addChat?.('Canonical '+rec.objectClass+': '+rec.name+' ('+rec.id+').'
      +(rec.aliases?.length?' Governed aliases: '+rec.aliases.join(', ')+'.':''),'atlas',false);
  }
  function augmentCanonicalResults(){
    const input=document.getElementById('moduleSearch'),list=document.getElementById('moduleList');
    if(!input||!list)return;
    list.querySelectorAll('[data-atl181-canonical]').forEach(n=>n.remove());
    const q=input.value.trim(); if(!q)return;
    canonicalMatches(q).forEach(x=>{
      const b=document.createElement('button');b.className='module-item canonical-result';
      b.setAttribute('data-atl181-canonical','1');
      const left=document.createElement('span'),title=document.createElement('b'),
        meta=document.createElement('span'),status=document.createElement('span');
      title.textContent=x.name;meta.className='meta';
      meta.textContent=x.objectClass+' · '+x.id+(x.aliases?.length?' · aliases: '+x.aliases.slice(0,3).join(', '):'');
      status.className='status current';status.textContent=x.matchType;
      left.append(title,meta);b.append(left,status);
      b.addEventListener('click',()=>selectCanonical(x.id,x.objectClass));list.appendChild(b);
    });
  }
  function mapExternalSource(ext,trace){
    return {id:ext.sourceId,issuer:ext.issuer,title:ext.title,url:ext.url,
      version:trace?.targetVersion||'Road LTL 1.5',confidence:ext.tier,research:trace?.status||'GOVERNED',
      modeScope:'Road LTL BOL resolution',jurisdictionScope:ext.applicability,
      roleScope:'Public source evidence',supports:ext.applicability,
      notSupports:'Does not authorize broader applicability beyond the linked governed claim.',
      kind:ext.tier,modelUsageClass:ext.tier};
  }
  function installSourceTrace(trace){
    const st=state();st.roadLtl15SourceTrace=trace;
    const baseSourceRecord=root.sourceRecord;
    root.sourceRecord=function(id){
      const existing=baseSourceRecord?.(id);if(existing)return existing;
      const normalized=root.normalizeSourceId?root.normalizeSourceId(id):id;
      const ext=root.AtlasRoadLtlSourceTrace.sourceRecordFromTrace(trace,normalized);
      return ext?mapExternalSource(ext,trace):null;
    };
    root.openSourceClaim=function(claimId){
      const tr=root.AtlasRoadLtlSourceTrace.traceRoadLtlClaim(trace,claimId);
      if(!tr||tr.status!=='RESOLVED'){
        root.addChat?.('Claim '+claimId+' is not present in the governed Road LTL 1.5 source-claim pack.','atlas',true);return;
      }
      const body=document.getElementById('inspectorBody');if(!body)return;
      body.dataset.sourceView='1';body.className='';body.innerHTML='';
      const card=document.createElement('div');card.className='source-card';
      const badge=document.createElement('span');badge.className='status current';badge.textContent='GOVERNED SOURCE CLAIM';
      const h=document.createElement('h2');h.className='source-title';h.textContent=tr.claim.claimId;
      card.append(badge,h);
      [['Claim',tr.claim.statement],['Resolution effect',tr.claim.resolutionEffect],
       ['Maps to',(tr.claim.mapsTo||[]).join(' · ')]].forEach(([label,value])=>{
        const d=document.createElement('div');d.className='source-block';
        const b=document.createElement('b');b.textContent=label;d.append(b,document.createTextNode(String(value||'Not stated')));card.appendChild(d);
      });
      const nav=document.createElement('div');nav.className='source-nav';
      tr.sources.forEach(src=>{
        const b=document.createElement('button');b.className='source-chip';b.textContent=src.issuer+' · '+src.title;
        b.addEventListener('click',()=>root.openSource?.(src.sourceId));nav.appendChild(b);
      });
      card.appendChild(nav);
      const back=document.createElement('button');back.className='source-back';back.textContent='Back to Atlas item';
      back.addEventListener('click',()=>root.renderInspector?.());card.appendChild(back);body.appendChild(card);
      root.openMobilePanel?.('inspector');
    };
    const baseAppend=root.appendEvidenceNavigator;
    root.appendEvidenceNavigator=function(){
      baseAppend?.();
      const st2=state(),body=document.getElementById('inspectorBody');
      if(!body||body.dataset.sourceView==='1'||st2?.selectedProcess!=='LTL-03'||body.querySelector('[data-atl181-claim-nav]'))return;
      const claims=Object.values(trace.claimsById||{}).filter(c=>(c.mapsTo||[]).includes('LTL-03'));
      if(!claims.length)return;
      const wrap=document.createElement('div');wrap.className='ins-section evidence-nav';wrap.setAttribute('data-atl181-claim-nav','1');
      const h=document.createElement('h3');h.textContent='Road LTL 1.5 governed claims';wrap.appendChild(h);
      const nav=document.createElement('div');nav.className='source-nav';
      claims.forEach(c=>{
        const b=document.createElement('button');b.className='source-chip';b.textContent='Claim · '+c.claimId;
        b.addEventListener('click',()=>root.openSourceClaim(c.claimId));nav.appendChild(b);
      });
      wrap.appendChild(nav);body.appendChild(wrap);
    };
    if(root.AtlasCommandBus){
      root.AtlasCommandBus.openSourceClaim=root.openSourceClaim;
      root.AtlasCommandBus.resolveCanonical=(q,o)=>root.AtlasCanonicalDiscovery.resolveCanonicalDiscovery(state().page0,q,o);
    }
    root.renderInspector?.();
  }
  function init(){
    const st=state();
    if(!st||!root.AtlasModuleLoader||!root.AtlasRoadLtlSourceTrace||!root.AtlasCanonicalDiscovery
      ||!document.getElementById('moduleSearch')||typeof root.sourceRecord!=='function'){
      setTimeout(init,50);return;
    }
    const input=document.getElementById('moduleSearch');
    if(!input.dataset.atl181CanonicalBound){
      input.dataset.atl181CanonicalBound='1';
      input.addEventListener('input',()=>setTimeout(augmentCanonicalResults,0));
      setTimeout(augmentCanonicalResults,0);
    }
    root.AtlasModuleLoader.fetchJson('data/source-claims/road-ltl-v1.5-bol-resolution-claims.json')
      .then(pack=>installSourceTrace(root.AtlasRoadLtlSourceTrace.buildRoadLtlSourceTrace(pack)))
      .catch(e=>console.warn('Road LTL source trace unavailable:',e.message));
  }
  init();
})(globalThis);
