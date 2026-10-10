// W1-02 rework R2: explicit definitions for "source referenced by a record" (F4). Input: data.json from extract.mjs. Read-only.
import fs from 'fs';
const [,, dataPath, outPath]=process.argv;
const D=JSON.parse(fs.readFileSync(dataPath));const U=D.U;const ids=U.activePage0SourceIds;
const lc=new Set([...U.enterpriseCoverage.flatMap(l=>l.sourceIds),...U.businessCycles.flatMap(c=>c.sourceIds)]);
const domKeys=[...new Set(U.domains.flatMap(d=>d.sources))];
const evKeys=[...new Set(Object.values(U.evidenceProfiles).flat().map(x=>x.key))];
const exact=ks=>new Set(ks.map(k=>'src-'+k.toLowerCase()));
const fam=ks=>new Set(ks.flatMap(k=>ids.filter(i=>i==='src-'+k.toLowerCase()||i.startsWith('src-'+k.toLowerCase()+'-')||(k.toLowerCase()==='cesni'&&i.startsWith('src-cesni')))));
const placement=new Set(D.placementSources.flatMap(x=>x.ids));
const union=(...s)=>new Set(s.flatMap(x=>[...x]));
const un=s=>ids.filter(i=>!s.has(i));
const {sourceRecords:_a,activePage0SourceIds:_b,...rest}=U;const restTxt=JSON.stringify(rest);
const defs={
 R0_lensSourceIds_or_cycleSourceIds: un(lc),
 R1_R0_plus_domainKeyEqualsIdMinusSrc: un(union(lc,exact(domKeys))),
 R2_R0_plus_domainFamilyKeyPrefix: un(union(lc,fam(domKeys))),
 R3_R2_plus_evidenceProfileFamilyKeys: un(union(lc,fam(domKeys),fam(evKeys))),
 R4_R3_plus_pageSourceIdsForPlacementMapper: un(union(lc,fam(domKeys),fam(evKeys),placement)),
 L_exactIdLiteralOutsideSourceRegistries: ids.filter(i=>!restTxt.includes('"'+i+'"'))
};
const out={artifactSha256:D.sha256,sourceTotal:ids.length,counts:Object.fromEntries(Object.entries(defs).map(([k,v])=>[k,v.length])),
 R0_notReferenced:defs.R0_lensSourceIds_or_cycleSourceIds,
 R1_minus_R0:defs.R0_lensSourceIds_or_cycleSourceIds.filter(i=>!defs.R1_R0_plus_domainKeyEqualsIdMinusSrc.includes(i)),
 L_set:defs.L_exactIdLiteralOutsideSourceRegistries,
 priorFive:['src-unedifact-d25a','src-gs1-cbv','src-iata-one-record','src-iata-cargo','src-hague-visby'],
 priorFiveAllInL:['src-unedifact-d25a','src-gs1-cbv','src-iata-one-record','src-iata-cargo','src-hague-visby'].every(i=>defs.L_exactIdLiteralOutsideSourceRegistries.includes(i)),
 L_minus_priorFive:defs.L_exactIdLiteralOutsideSourceRegistries.filter(i=>!['src-unedifact-d25a','src-gs1-cbv','src-iata-one-record','src-iata-cargo','src-hague-visby'].includes(i)),
 L_minus_priorFive_reachedBy:Object.fromEntries(defs.L_exactIdLiteralOutsideSourceRegistries.filter(i=>!['src-unedifact-d25a','src-gs1-cbv','src-iata-one-record','src-iata-cargo','src-hague-visby'].includes(i)).map(i=>[i,[exact(domKeys).has(i)&&'domainKeyEqualsId',exact(evKeys).has(i)&&'evidenceKeyEqualsId',placement.has(i)&&'pageMapperOnly'].filter(Boolean)])),
 note:'No single tested definition yields exactly the 5 of the prior L1 text; the 5 are a subset of set L (11).'};
fs.writeFileSync(outPath,JSON.stringify(out,null,1));console.log(JSON.stringify(out,null,1));
