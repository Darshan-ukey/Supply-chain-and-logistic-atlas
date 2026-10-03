const fs=require('fs');

const baseModule=JSON.parse(fs.readFileSync('data/modules/road-ltl-v1.2.json','utf8'));
const overlay=JSON.parse(fs.readFileSync('data/modules/road-ltl-v1.5.json','utf8'));
const operational=JSON.parse(fs.readFileSync('data/operational-knowledge/road-ltl-v1.5-operational.json','utf8'));

if(overlay.moduleId!=='road-ltl'||overlay.version!=='1.5') throw Error('INVALID_V15_OVERLAY');
if(operational.moduleId!=='road-ltl'||operational.moduleVersion!=='1.5') throw Error('INVALID_V15_OPERATIONAL_KNOWLEDGE');
if(overlay.materializationPolicy?.method!=='LOSSLESS_INHERIT_BASE_THEN_APPLY_OVERRIDES') throw Error('UNSUPPORTED_OVERLAY_POLICY');

const overrides=new Map((overlay.taskOverrides||[]).map(x=>[x.id,x]));
const allowed=new Set(['OBSERVES_EVENT','CHANGES_STATE','REQUIRES_DECISION','EVALUATES_RULE','OPERATES_CONTROL','AUTHORIZES_ACTION','GENERATES_EVIDENCE','CONTRIBUTES_TO_OUTCOME']);

function materialize(p){
  const o=overrides.get(p.id);
  const effective=o?{...p,...o}:p;
  const sourceIds=effective.sourceIds||p.sourceIds||[];
  if(!sourceIds.length) throw Error('MISSING_PROVENANCE:'+p.id);
  const req=['before','event','decision','rule','control','action','evidence','after','outcome'];
  for(const k of req) if(!effective[k]) throw Error('MISSING_SEMANTIC:'+p.id+':'+k);
  const ok=(operational.taskOperationalKnowledge||[]).find(x=>x.taskId===p.id);
  return {
    semanticRecordId:'road-ltl::'+p.id+'::operational-semantics::v1',
    moduleId:'road-ltl',
    moduleVersion:'1.5',
    processId:p.id,
    stateBefore:effective.before,event:effective.event,decision:effective.decision,rule:effective.rule,
    control:effective.control,action:effective.action,evidence:effective.evidence,stateAfter:effective.after,outcome:effective.outcome,
    inputs:effective.inputs||p.inputs||[],outputs:effective.outputs||p.outputs||[],sourceIds,
    knowledgeState:'KNOWN_SYNTHESIS',
    dependencyClass:(effective.applicability&&/customer|contract|tariff|master/i.test(JSON.stringify(effective.applicability)))?'CLIENT_MASTER_REQUIRED':'GENERIC_DOMAIN',
    relationships:(baseModule.ontologyEdges||[]).filter(e=>e.from===p.id&&allowed.has(e.type)).map(e=>({type:e.type,targetId:e.to})),
    governingLineage:{
      baseModule:'data/modules/road-ltl-v1.2.json',
      overlay:'data/modules/road-ltl-v1.5.json',
      operationalKnowledge:'data/operational-knowledge/road-ltl-v1.5-operational.json',
      operationalKnowledgeContract:'schemas/operational-knowledge-contract-v2.json',
      informationResolutionContract:'schemas/information-resolution-contract-v1.json',
      overrideApplied:Boolean(o),
      operationalKnowledgeRef:ok?ok.canonicalTaskRef:null
    }
  };
}

const records=(baseModule.processes||[]).map(materialize);
const out={
  schemaVersion:'atlas-operational-semantics-v1.1',
  status:'S8_REMEDIATED_CANDIDATE',
  moduleId:'road-ltl',moduleVersion:'1.5',
  materializationPolicy:'LOSSLESS_V15_OVERLAY_ON_V12_BASE',
  changedTaskIds:overlay.materializationPolicy?.changedTaskIds||[],
  recordCount:records.length,records
};
process.stdout.write(JSON.stringify(out,null,2)+'\n');
