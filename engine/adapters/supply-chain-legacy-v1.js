/* Compatibility adapter: legacy Supply Chain Atlas child contract -> enterprise module contract.
   SCM-specific field names stay here and do not enter the Enterprise Operations core. */
(function(g){'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 g.SupplyChainLegacyAdapter18_5={
  adapt(raw){
   if(!['atlas-data-contract-v1.0','atlas-data-contract-v1.1'].includes(raw?.contractVersion))return clone(raw);
   const out=clone(raw);
   out.legacyContractVersion=raw.contractVersion;
   out.contractVersion='enterprise-operations-module-v1.0';
   out.domainPackId='supply-chain';
   out.a3Parents=(out.a3Parents||[]).map(a=>({...a,territoryId:a.page0DomainId}));
   return out;
  }
 };
})(globalThis);
