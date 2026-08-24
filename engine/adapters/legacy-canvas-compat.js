'use strict';
function canvasAnchor(p,domainPack){const id=p.parent||p.page0DomainId||p.extensions?.territoryId;const territory=(domainPack.territories||[]).find(t=>(t.id||t)===id);return{territoryId:id,label:territory?.label||id}}
module.exports={canvasAnchor};
