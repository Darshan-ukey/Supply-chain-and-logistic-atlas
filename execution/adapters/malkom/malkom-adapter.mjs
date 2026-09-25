const CAPABILITIES=['MANAGED_WORK','QUEUE','SUBQUEUE','WORK_TYPE','FIELD_SCHEMA','OUTCOME','VALUE_LIST','WORKFLOW','STAY_RETURN','FLOW_BPMN','FLOW_SIMPLE','CLIENT_BINDING'];

function sourceId(def){return def?.sourceTask?.sourceId||def?.sourceTask?.taskId||def?.sourceTaskId||def?.id||'unknown'}
function version(def){return def?.version||def?.definitionVersion||'unknown'}
function projection(def){return def?.malkomProjection||def?.decomposition?.malkom||null}

export const MalkomAdapterV1={
  adapterId:'atlas-adapter-malkom-v1',runtime:'MALKOM_3',version:'1.0.0-dev1',capabilities:CAPABILITIES,

  assess(def,client={}){
    const p=projection(def),dispositions=[];
    const add=(capability,disposition,note,blocking=false)=>dispositions.push({capability,disposition,note,blocking});
    if(!p){
      add('MALKOM_PROJECTION','UNSUPPORTED_RUNTIME','No governed Malkom projection is present for this WorkDefinition.',true);
      return {compatible:false,capabilityDispositions:dispositions,requiredBindings:[],blockers:['Malkom projection missing']};
    }
    for(const cap of ['QUEUE','SUBQUEUE','WORK_TYPE','FIELD_SCHEMA','OUTCOME'])add(cap,'MAPPED','Present in the governed Malkom projection.');
    const bindings=this.requiredBindings(def,client);
    if(bindings.length)add('CLIENT_BINDING','CLIENT_BINDING_REQUIRED',`${bindings.length} binding families require client-specific resolution.`,false);
    const outcomes=p.outcomes||[];
    const unsupported=[...new Set(outcomes.map(o=>o.nextStep).filter(x=>x&&!['END_WORK_ITEM','END_QUEUE','STAY_IN_QUEUE','STAY'].includes(x)))];
    for(const step of unsupported)add(`NEXT_STEP:${step}`,step==='ESCALATE'?'PARTIAL':'UNSUPPORTED_RUNTIME',step==='ESCALATE'?'Canonical escalation remains visible; live cross-queue materialization is runtime-specific.':`Current Malkom projection requires explicit handling for ${step}.`,step!=='ESCALATE');
    return {compatible:!dispositions.some(x=>x.blocking),capabilityDispositions:dispositions,requiredBindings:bindings,blockers:dispositions.filter(x=>x.blocking).map(x=>x.note),warnings:dispositions.filter(x=>x.disposition==='PARTIAL').map(x=>x.note)};
  },

  requiredBindings(def,client={}){
    const raw=def?.clientBindingPoints||def?.clientOverridePoints||def?.decomposition?.malkom?.clientOverridePoints||[];
    const supplied=new Set(Object.keys(client||{}));
    return raw.map(String).filter(x=>!supplied.has(x));
  },

  project(def){
    const p=projection(def);if(!p)throw new Error(`WorkDefinition ${sourceId(def)} has no Malkom projection`);
    return {
      projectionId:`malkom:${sourceId(def)}:${version(def)}`,
      adapterId:this.adapterId,runtime:this.runtime,
      generatedFrom:{workDefinitionId:def.id||sourceId(def),workDefinitionVersion:version(def)},
      payload:structuredClone(p)
    };
  },

  verify(runtimeProjection){
    const p=runtimeProjection?.payload||runtimeProjection;
    const problems=[];
    if(!p?.queue)problems.push({severity:'ERROR',path:'queue',message:'Queue missing'});
    if(!Array.isArray(p?.subQueues)||!p.subQueues.length)problems.push({severity:'ERROR',path:'subQueues',message:'At least one subqueue is required'});
    if(!Array.isArray(p?.outcomes)||!p.outcomes.length)problems.push({severity:'ERROR',path:'outcomes',message:'At least one outcome is required'});
    return {valid:!problems.some(x=>x.severity==='ERROR'),problems};
  },

  compile(def,client={}){
    const projected=this.project(def),assessment=this.assess(def,client),verification=this.verify(projected);
    return {...projected,assessment,verification,materializable:assessment.compatible&&verification.valid};
  }
};

export default MalkomAdapterV1;
