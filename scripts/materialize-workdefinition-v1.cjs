const fs=require('fs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const semantics=read('data/generated/operational-semantics/road-ltl-v1.json');
const selected=['LTL-04'];
const records=selected.map(processId=>{
 const r=semantics.records.find(x=>x.processId===processId);
 if(!r) throw Error('MISSING_SEMANTIC:'+processId);
 const required=['semanticRecordId','stateBefore','event','decision','rule','control','action','evidence','stateAfter','outcome','inputs','outputs','sourceIds','knowledgeState','dependencyClass'];
 for(const k of required) if(r[k]===undefined||r[k]===null) throw Error('MISSING_REQUIRED_SEMANTIC:'+processId+':'+k);
 const bindingNeeds=[];
 let knowledgeState=r.knowledgeState;
 if(r.dependencyClass==='CLIENT_MASTER_REQUIRED'){bindingNeeds.push({type:'CLIENT_BINDING_REQUIRED',dimension:'client/master execution parameters',reason:'Canonical generic semantics require client-specific master/contract values before executable projection.'});knowledgeState='CLIENT_BINDING_REQUIRED';}
 return {
  workDefinitionId:'wd::'+r.moduleId+'::'+r.processId+'::v1',
  version:'1.0.0',
  lineage:{semanticRecordId:r.semanticRecordId,moduleVersion:semantics.moduleVersion,sourceIds:r.sourceIds,compiler:'ATL-159 deterministic compiler v1'},
  scope:{moduleId:r.moduleId,processId:r.processId,stateBefore:r.stateBefore,event:r.event,stateAfter:r.stateAfter},
  requiredInputs:r.inputs.map(id=>({objectId:id,requirementState:'REQUIRED'})),
  decisionSemantics:{decision:r.decision,rule:r.rule,control:r.control,evidence:r.evidence},
  actorsSystems:{actors:[{id:'actor-authorized-operator',state:'CLIENT_BINDING_REQUIRED'}],systems:[{id:'system-execution-platform',state:'CLIENT_BINDING_REQUIRED'}]},
  actions:[{sequence:1,action:r.action}],
  outcomes:[{outcome:r.outcome,outputs:r.outputs}],
  exceptions:[{type:'UNRESOLVED_CLIENT_BINDING',on:'missing client/master execution parameters',disposition:'FAIL_CLOSED'}],
  bindingNeeds,
  knowledgeState
 };
});
const out={schemaVersion:'atlas-workdefinition-set-v1.0',status:'FROZEN',bounded:true,moduleId:'road-ltl',scopeProcessIds:selected,workDefinitionCount:records.length,workDefinitions:records};
process.stdout.write(JSON.stringify(out,null,2)+'\n');
