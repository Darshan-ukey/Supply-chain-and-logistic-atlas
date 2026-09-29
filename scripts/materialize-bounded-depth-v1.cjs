const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const requestPath=process.argv[2]||'tests/fixtures/atl-157-road-ltl-depth-request.json';
const req=read(requestPath);
function fail(code,detail){const e=new Error(code+(detail?': '+detail:''));e.code=code;throw e}
if(req.trigger?.actorType!=='AUTHORIZED_HUMAN'||req.trigger?.explicitRequest!==true) fail('HUMAN_TRIGGER_REQUIRED');
if(req.moduleId!=='road-ltl') fail('UNSUPPORTED_MODULE',req.moduleId);
const semantics=read('data/generated/operational-semantics/road-ltl-v1.json');
const provenance=read('data/provenance/road-ltl-claim-provenance-v1.json');
const record=semantics.records.find(x=>x.processId===req.processId);
if(!record) fail('UNKNOWN_PROCESS',req.processId);
const allowed=['stateBefore','event','decision','rule','control','action','evidence','stateAfter','outcome','inputs','outputs'];
const requested=[...new Set(req.requestedFields||[])];
if(!requested.length) fail('NO_DEPTH_FIELDS');
const unsupported=requested.filter(x=>!allowed.includes(x));
if(unsupported.length) fail('UNSUPPORTED_REQUESTED_FIELD',unsupported.join(','));
if(!Array.isArray(record.sourceIds)||!record.sourceIds.length) fail('MISSING_PROVENANCE');
const claims=provenance.claims.filter(c=>c.processId===req.processId);
const byField={};
for(const c of claims){const k=String(c.field||'').toLowerCase();(byField[k]??=[]).push(c)}
const candidates=[]; const gaps=[];
for(const field of requested){
  const value=record[field];
  const claimSet=byField[field.toLowerCase()]||[];
  if(value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length)){
    gaps.push({field,state:'UNKNOWN',reason:'No governed value exists in current operational semantics.'});continue;
  }
  if(!claimSet.length){
    gaps.push({field,state:'CANDIDATE_REVIEW_REQUIRED',reason:'Operational value exists but no field-level provenance claim was found; no promotion allowed.'});continue;
  }
  const sourceIds=[...new Set(claimSet.flatMap(c=>c.sourceIds||[]))];
  if(!sourceIds.length) fail('MISSING_PROVENANCE',field);
  const conflicts=new Set(claimSet.map(c=>JSON.stringify(c.statement))).size>1;
  if(conflicts){
    gaps.push({field,state:'CANDIDATE_REVIEW_REQUIRED',reason:'Multiple source-backed statements require human conflict resolution.',sourceIds});continue;
  }
  candidates.push({field,value,knowledgeState:record.knowledgeState||'KNOWN_SYNTHESIS',sourceIds,claims:claimSet.map(c=>({claimId:c.claimId,evidenceClass:c.evidenceClass,claimBoundary:c.claimBoundary,confidence:c.confidence,status:c.status}))});
}
const researchNeeded=gaps.map(g=>({field:g.field,question:`Resolve ${req.moduleId}/${req.processId} ${g.field} using bounded authoritative sources only.`,allowedSourceIds:record.sourceIds,status:'NOT_EXECUTED_BY_MATERIALIZER'}));
const out={
 schemaVersion:'atlas-bounded-depth-result-v1.0',moduleId:req.moduleId,moduleVersion:semantics.moduleVersion,processId:req.processId,
 trigger:{actorType:req.trigger.actorType,explicitRequest:true,requestId:req.trigger.requestId||null},
 existingKnowledgeLookup:{semanticRecordId:record.semanticRecordId,sourceIds:record.sourceIds},
 gapDetection:{requestedFieldCount:requested.length,gaps},
 boundedResearch:{mode:'AUTHORITATIVE_SOURCE_IDS_ONLY',researchNeeded},
 candidateKnowledge:candidates,
 validation:{failClosed:true,canonicalMutation:false,allCandidatesProvenanced:candidates.every(c=>c.sourceIds.length>0),unresolvedCount:gaps.length},
 persistenceDisposition:gaps.length?'CANDIDATE_OVERLAY_WITH_UNRESOLVED':'CANDIDATE_OVERLAY_READY_FOR_HUMAN_APPROVAL',
 downstream:{workDefinitionInputEligible:gaps.length===0,canonicalPromotion:'NOT_PERFORMED'}
};
process.stdout.write(JSON.stringify(out,null,2)+'\n');
