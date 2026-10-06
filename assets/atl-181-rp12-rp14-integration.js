(function(root){
  'use strict';
  function escText(v){return String(v==null?'':v)}
  function canonicalMatches(q){return q&&root.AtlasCanonicalDiscovery&&root.S?.page0?root.AtlasCanonicalDiscovery.searchCanonicalDiscovery(root.S.page0,q).slice(0,12):[]}
  function selectCanonical(id,objectClass){
    var rec=root.AtlasCanonicalDiscovery&&root.AtlasCanonicalDiscovery.findCanonicalById(root.S&&root.S.page0,id,objectClass);
    if(!rec){root.addChat&&root.addChat('Canonical object '+id+' is not present in governed Page 0.','atlas',true);return}
    root.S.canonicalSelection={id:rec.id,objectClass:rec.objectClass};
    var r=root.AtlasCanonicalDiscovery.resolveCanonicalDiscovery(root.S.page0,rec.id,{objectClass:rec.objectClass});
    if(r.status!=='RESOLVED'){root.addChat&&root.addChat('Canonical object '+id+' could not be resolved fail-closed.','atlas',true);return}
    root.addChat&&root.addChat('Canonical '+rec.objectClass+': '+rec.name+' ('+rec.id+').'+(rec.aliases&&rec.aliases.length?' Governed aliases: '+rec.aliases.join(', ')+'.':''),'atlas',false);
  }
  function augmentCanonicalResults(){
    var input=document.getElementById('moduleSearch'),list=document.getElementById('moduleList'); if(!input||!list)return;
    Array.prototype.forEach.call(list.querySelectorAll('[data-atl181-canonical]'),function(n){n.remove()});
    var q=input.value.trim(); if(!q)return;
    canonicalMatches(q).forEach(function(x){
      var b=document.createElement('button'); b.className='module-item canonical-result'; b.setAttribute('data-atl181-canonical','1');
      var left=document.createElement('span'),title=document.createElement('b'),meta=document.createElement('span'),status=document.createElement('span');
      title.textContent=x.name; meta.className='meta'; meta.textContent=x.objectClass+' · '+x.id+(x.aliases&&x.aliases.length?' · aliases: '+x.aliases.slice(0,3).join(', '):'');
      status.className='status current'; status.textContent=x.matchType; left.appendChild(title);lef...[truncated]