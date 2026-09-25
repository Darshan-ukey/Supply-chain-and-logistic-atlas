/* UI adapter for the pre-18.5 renderer. It aliases generic territoryId to the old
   renderer's page0DomainId property. This adapter is temporary and outside core. */
(function(g){'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 g.LegacyCanvasCompat18_5={adapt(mod){const out=clone(mod);out.page0Domains=clone(out.territories||[]);out.a3Parents=(out.a3Parents||[]).map(a=>({...a,page0DomainId:a.territoryId}));return out}};
})(globalThis);
