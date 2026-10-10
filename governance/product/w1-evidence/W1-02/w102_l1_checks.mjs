// W1-02 L1 structural integrity checks (read-only). Input: data.json from extract.mjs (frozen HTML evaluated unmodified in scratch copy + export hook) + FROZEN_RELEASE_MANIFEST.json.
import fs from 'fs';
const [,, dataPath, manifestPath, outPath]=process.argv;
const D=JSON.parse(fs.readFileSync(dataPath)); const U=D.U; const M=JSON.parse(fs.readFileSync(manifestPath)).integrity;
const R={sha256:D.sha256,bytes:D.bytes,checks:[],findings:{}};
const rec=(name,expected,actual,note='')=>{const ok=JSON.stringify(expected)===JSON.stringify(actual);R.checks.push({name,expected,actual,result:ok?'match':'DIFF',note});};
// ---- 1. registry counts vs manifest
const groupCount=g=>U.domains.filter(d=>d.group===g).length;
const refPlace=U.referenceGroups.reduce((n,g)=>n+g.items.length,0);
const entCount=U.entityRegistryGroups.reduce((s,g)=>s+g.records.length,0);
const navCount=U.navigatorFamilies.reduce((s,f)=>s+f.items.length,0);
rec('coreDomainCount',M.coreDomainCount,groupCount('core'));
rec('conditionalDomainCount',M.conditionalDomainCount,groupCount('conditional'));
rec('crossEnterpriseRailCount',M.crossEnterpriseRailCount,groupCount('rail'));
rec('enterpriseCoverageLensCount',M.enterpriseCoverageLensCount,U.enterpriseCoverage.length);
rec('businessCycleViewCount',M.businessCycleViewCount,U.businessCycles.length);
rec('navigatorEntryCount',M.navigatorEntryCount,navCount);
rec('systemAuthorityRuleCount',M.systemAuthorityRuleCount,U.authorityRules.length);
rec('contextResolverRuleCount',M.contextResolverRuleCount,U.contextRules.length);
rec('operatingRoleCount',M.operatingRoleCount,U.models.length-1,'models minus neutral');
rec('modeOverlayCount',M.modeOverlayCount,U.modes.length-1,'modes minus none');
rec('contractServiceContextCount',M.contractServiceContextCount,U.contractServiceContexts.length-1,'array incl. contract-unresolved placeholder; page formula subtracts 1');
rec('authorityDomainCount (page formula = referenceGroups.length)',M.authorityDomainCount,U.referenceGroups.length);
rec('referencePlacementCount',M.referencePlacementCount,refPlace);
rec('governedSourceRecordCount (activePage0SourceIds)',M.governedSourceRecordCount,U.activePage0SourceIds.length);
rec('governedSourceRecords in sourceRecords map',M.governedSourceRecordCount,Object.keys(U.sourceRecords).length);
rec('firstClassEntityCount',M.firstClassEntityCount,entCount);
rec('relationshipTypeCount',M.relationshipTypeCount,U.relationshipTypeVocabulary.length);
rec('directionalExchangeCount',M.directionalExchangeCount,U.exchanges.length);
const grp=Object.fromEntries(U.entityRegistryGroups.map(g=>[g.key,g.records.length]));
R.entityGroups=grp;
// built-in page integrity block vs manifest (every key the page emits)
const pageI=D.integrity||{}; const mism=[];for(const k of Object.keys(M)){if(k in pageI&&JSON.stringify(pageI[k])!==JSON.stringify(M[k]))mism.push([k,M[k],pageI[k]]);}
R.pageIntegrity={status:pageI.status,errors:pageI.errors,keysCompared:Object.keys(M).filter(k=>k in pageI).length,mismatches:mism,pageErrors:D.pageErrors};
// ---- 2. ID uniqueness
const dups=a=>{const s=new Map();a.forEach(x=>s.set(x,(s.get(x)||0)+1));return [...s].filter(([,n])=>n>1).map(([x])=>x)};
const regs={domains:U.domains.map(x=>x.id),lenses:U.enterpriseCoverage.map(x=>x.id),cycles:U.businessCycles.map(x=>x.id),authority:U.authorityRules.map(x=>x.id),models:U.models.map(x=>x.id),modes:U.modes.map(x=>x.id),sources:U.activePage0SourceIds,
 systems:U.systemRecords.map(x=>x.id),objects:U.businessObjectRecords.map(x=>x.id),actors:U.actorRecords.map(x=>x.id),events:U.eventRecords.map(x=>x.id),documents:U.documentRecords.map(x=>x.id),relationships:U.processRelationshipRecords.map(x=>x.id),contractCtx:U.contractServiceContexts.map(x=>x.id),roleProfiles:Object.keys(U.roleProfiles)};
R.idDuplicatesWithinRegistry=Object.fromEntries(Object.entries(regs).map(([k,v])=>[k,dups(v)]));
const owner=new Map();Object.entries(regs).forEach(([k,v])=>new Set(v).forEach(id=>owner.set(id,[...(owner.get(id)||[]),k])));
R.crossRegistryIdReuse=[...owner].filter(([,ks])=>ks.length>1).map(([id,ks])=>({id,registries:ks}));
// ---- 3. reference integrity
const sourceSet=new Set(U.activePage0SourceIds),sys=new Set(regs.systems),obj=new Set(regs.objects),dom=new Set(regs.domains),cyc=new Set(regs.cycles),act=new Set(regs.actors),evt=new Set(regs.events),doc=new Set(regs.documents),mode=new Set(regs.modes);
const broken=[];const chk=(from,field,ids,set)=>(ids||[]).forEach(i=>{if(!set.has(i))broken.push({from,field,missing:i})});
U.enterpriseCoverage.forEach(l=>{chk(l.id,'domainIds',l.domainIds,dom);chk(l.id,'sourceIds',l.sourceIds,sourceSet);chk(l.id,'systemIds',l.systemIds,sys);chk(l.id,'objectIds',l.objectIds,obj);chk(l.id,'cycleIds',l.cycleIds,cyc)});
U.businessCycles.forEach(c=>{chk(c.id,'domainIds',c.domainIds,dom);chk(c.id,'sourceIds',c.sourceIds,sourceSet);chk(c.id,'systemIds',c.systemIds,sys);chk(c.id,'objectIds',c.objectIds,obj)});
U.authorityRules.forEach(a=>{chk(a.id,'objectId',[a.objectId],obj);chk(a.id,'systemIds',a.systemIds,sys)});
U.domains.forEach(d=>{chk(d.id,'systemIds',d.systemIds,sys);chk(d.id,'inputObjectIds',d.inputObjectIds,obj);chk(d.id,'outputObjectIds',d.outputObjectIds,obj);chk(d.id,'actorIds',d.actorIds,act);chk(d.id,'eventIds',d.eventIds,evt);chk(d.id,'documentIds',d.documentIds,doc);chk(d.id,'upstreamProcessIds',d.upstreamProcessIds,dom);chk(d.id,'downstreamProcessIds',d.downstreamProcessIds,dom)});
U.exchanges.forEach((e,i)=>chk('exchange#'+i,'domains',e.domains,dom));
U.contextRules.forEach((r,i)=>chk('contextRule#'+i,'modeIds',r.modeIds,mode));
U.modes.forEach(m=>{chk(m.id,'objectIds',m.objectIds,obj)});
Object.entries(U.sourceRecords).forEach(([k,s])=>{if(s.id!==k)broken.push({from:k,field:'id',missing:'key/id mismatch '+s.id})});
const ents=new Set([...sys,...obj,...act,...evt,...doc]);const typed=[];
U.processRelationshipRecords.forEach(r=>{if(!U.relationshipTypeVocabulary.includes(r.code))broken.push({from:r.id,field:'code',missing:r.code});for(const e of [r.sourceEntityId,r.targetEntityId])if(!dom.has(e)&&!ents.has(e))broken.push({from:r.id,field:'endpoint',missing:e});
 const kind=e=>dom.has(e)?'domain':sys.has(e)?'system':obj.has(e)?'object':evt.has(e)?'event':act.has(e)?'actor':doc.has(e)?'document':'?';typed.push([r.id,kind(r.sourceEntityId),kind(r.targetEntityId)])});
R.brokenReferences=broken;
R.nonDomainRelationshipEndpoints=typed.filter(([,a,b])=>a!=='domain'||b!=='domain');
R.relationshipTypesUnused=U.relationshipTypeVocabulary.filter(t=>!U.processRelationshipRecords.some(r=>r.code===t)).length;
// ---- 4. source-link granularity
const entityGroupsWithSourceField={};U.entityRegistryGroups.forEach(g=>{const keys=new Set(g.records.flatMap(r=>Object.keys(r)));entityGroupsWithSourceField[g.key]={records:g.records.length,fields:[...keys],hasSourceField:[...keys].some(k=>/source/i.test(k))}});
R.recordLevelSourceTagging=entityGroupsWithSourceField;
R.recordLevelTaggedRegistries={domains:U.domains.every(d=>'sources' in d),lenses:U.enterpriseCoverage.every(l=>'sourceIds' in l),cycles:U.businessCycles.every(c=>'sourceIds' in c)};
const famKeys=[...new Set(U.domains.flatMap(d=>d.sources))];const famMap={};famKeys.forEach(k=>{const n=k.toLowerCase();famMap[k]=U.activePage0SourceIds.filter(i=>i==='src-'+n||i.startsWith('src-'+n+'-'))});
R.familyKeyResolution=Object.fromEntries(Object.entries(famMap).map(([k,v])=>[k,v.length]));
R.unresolvedFamilyKeyOccurrences=U.domains.flatMap(d=>d.sources.filter(k=>famMap[k].length===0).map(k=>({domain:d.id,key:k})));
R.resolutionRule='source id === "src-"+key.toLowerCase() OR startsWith("src-"+key.toLowerCase()+"-")';
const ids=U.activePage0SourceIds;
const lensCycle=new Set([...U.enterpriseCoverage.flatMap(l=>l.sourceIds),...U.businessCycles.flatMap(c=>c.sourceIds)]);
const fam2={};[...new Set([...U.domains.flatMap(d=>d.sources),...Object.values(U.evidenceProfiles).flat().map(x=>x.key)])].forEach(k=>{const n=k.toLowerCase();fam2[k]=ids.filter(i=>i==='src-'+n||i.startsWith('src-'+n+'-')||(n==='cesni'&&i.startsWith('src-cesni')))});
const domFam=new Set(U.domains.flatMap(d=>d.sources.flatMap(k=>fam2[k])));
const evFam=new Set(Object.values(U.evidenceProfiles).flat().flatMap(x=>fam2[x.key]));
const placeIds=new Set(D.placementSources.flatMap(x=>x.ids));
const {sourceRecords:_a,activePage0SourceIds:_b,...restU}=U;const restTxt=JSON.stringify(restU);
const un=set=>ids.filter(i=>!set.has(i));
R.sourceReferenceDefinitions={
 D1_lensCycleDirectSourceIds_notReferenced:un(lensCycle).length,
 D2_plus_domainFamilyKeys_notReferenced:un(new Set([...lensCycle,...domFam])).length,
 D3_plus_evidenceProfileFamilyKeys_notReferenced:un(new Set([...lensCycle,...domFam,...evFam])).length,
 D4_plus_placementMapper_notReferenced:un(new Set([...lensCycle,...domFam,...evFam,...placeIds])).length,
 D5_exactIdLiteralAnywhereOutsideRegistry_notReferenced:ids.filter(i=>!restTxt.includes('"'+i+'"')),
 placementsTotal:D.placementSources.length,placementsWithoutResolvedSourceId:D.placementSources.filter(x=>!x.ids.length).length};
R.sourcesNotReferencedByDomainLensCycle=R.sourceReferenceDefinitions.D2_plus_domainFamilyKeys_notReferenced;
R.sourcesNotInDomainLensCycleOrIdLiteral=R.sourceReferenceDefinitions.D5_exactIdLiteralAnywhereOutsideRegistry_notReferenced;
R.placementByGroup=U.referenceGroups.map(g=>[g.no,g.items.length]);
// ---- 5. alias and atomic-name checks
const norm=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
const aliasMap=new Map();U.businessObjectRecords.forEach(o=>(o.aliases||[]).forEach(a=>{const k=norm(a);aliasMap.set(k,[...(aliasMap.get(k)||[]),o.id])}));
R.objects={count:U.businessObjectRecords.length,withAliases:U.businessObjectRecords.filter(o=>(o.aliases||[]).length>0).length,aliasCollisionsAcrossObjects:[...aliasMap].filter(([,v])=>new Set(v).size>1).map(([a,v])=>({alias:a,ids:[...new Set(v)]}))};
const nonAtomic=r=>/\s(and|or)\s|\/|&|,|;/i.test(r.name);
R.objects.nonAtomicNames=U.businessObjectRecords.filter(nonAtomic).map(o=>o.name);
R.objects.nonAtomicNamesNote='heuristic: name contains " and "/" or "/"/"/"&"/","/";"';
R.objects.nameDuplicates=dups(U.businessObjectRecords.map(o=>norm(o.name)));
const sysAlias=new Map();U.systemRecords.forEach(o=>(o.aliases||[]).forEach(a=>{const k=norm(a);sysAlias.set(k,[...(sysAlias.get(k)||[]),o.id])}));
R.systems={count:U.systemRecords.length,withAliases:U.systemRecords.filter(o=>(o.aliases||[]).length>0).length,aliasCollisions:[...sysAlias].filter(([,v])=>new Set(v).size>1).map(([a,v])=>({alias:a,ids:[...new Set(v)]})),nonAtomicNames:U.systemRecords.filter(nonAtomic).map(o=>o.name),nameDuplicates:dups(U.systemRecords.map(o=>norm(o.name)))};
const allAl=new Map();[...U.systemRecords,...U.businessObjectRecords].forEach(o=>(o.aliases||[]).forEach(a=>{const k=norm(a);allAl.set(k,[...(allAl.get(k)||[]),o.id])}));
R.crossSystemObjectAliasCollisions=[...allAl].filter(([,v])=>new Set(v).size>1).map(([a,v])=>({alias:a,ids:[...new Set(v)]}));
// 344 regex count (informational): count {id:'...'} literals in source HTML
const html=fs.readFileSync(process.env.W102_HTML,'utf8');const lits=[...html.matchAll(/\{\s*id\s*:\s*'([^']+)'/g)].map(m=>m[1]);
R.idLiteralRegex={literals:lits.length,distinct:new Set(lits).size,note:'regex count of {id:\'...\'} literals; not an ontology measure; not a threshold'};
R.embeddedIdentity={id:U.universeReleaseMetadata.id,version:U.universeReleaseMetadata.version,releaseDate:U.universeReleaseMetadata.releaseDate,correctionCycle:U.universeReleaseMetadata.correctionCycle};
R.lensReadiness=Object.fromEntries([...new Set(U.enterpriseCoverage.map(l=>l.status))].map(s=>[s,U.enterpriseCoverage.filter(l=>l.status===s).length]));
R.lensesWithGap=U.enterpriseCoverage.filter(l=>l.gap&&l.gap.length).length;
fs.writeFileSync(outPath,JSON.stringify(R,null,1));
const diffs=R.checks.filter(c=>c.result!=='match');
console.log('checks',R.checks.length,'diffs',diffs.length);diffs.forEach(d=>console.log(' DIFF',JSON.stringify(d)));
console.log(JSON.stringify({entityGroups:R.entityGroups,pageIntegrity:R.pageIntegrity,dupWithin:Object.fromEntries(Object.entries(R.idDuplicatesWithinRegistry).filter(([,v])=>v.length)),cross:R.crossRegistryIdReuse.length,broken:R.brokenReferences.length,nonDomainEnd:R.nonDomainRelationshipEndpoints,unusedRelTypes:R.relationshipTypesUnused,recLevel:R.recordLevelSourceTagging,recLevelTagged:R.recordLevelTaggedRegistries,fam:R.familyKeyResolution,unresolved:R.unresolvedFamilyKeyOccurrences,srcDefs:R.sourceReferenceDefinitions,objects:R.objects,systems:R.systems,crossAlias:R.crossSystemObjectAliasCollisions,regex:R.idLiteralRegex,ident:R.embeddedIdentity,lens:R.lensReadiness,gap:R.lensesWithGap},null,1));
