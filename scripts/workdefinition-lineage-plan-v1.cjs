const cp=require('child_process'),fs=require('fs');
const semantics=JSON.parse(cp.execFileSync(process.execPath,['scripts/materialize-operational-semantics-v1.cjs'],{encoding:'utf8'}));
const binding=JSON.parse(cp.execFileSync(process.execPath,['scripts/materialize-client-binding-v1.cjs'],{encoding:'utf8'}));
const r=semantics.records.find(x=>x.processId==='LTL-04'); if(!r||r.moduleVersion!=='1.5') throw Error('CORRECTED_SEMANTIC_DONOR_REQUIRED');
if(binding.semanticRecordId!==r.semanticRecordId||binding.semanticModuleVersion!=='1.5') throw Error('CLIENT_BINDING_LINEAGE_MISMATCH');
const governing={
 decomposition:{path:'governance/standards/CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md',commit:'c72b50025d38c6ba103a98e6b698ac2181d5017b',blob:'046885c71dc9fb24532b398cacd47ffc522f3a1b',version:'1.0.0'},
 workDefinition:{path:'governance/standards/CANONICAL_WORKDEFINITION_CONTRACT_V1_FROZEN.md',commit:'c72b50025d38c6ba103a98e6b698ac2181d5017b',blob:'c074489f2cf7edacde962f7e0260e2b240d24b87',version:'1.0.0'}
};
const plan={schemaVersion:'atlas-workdefinition-compiler-lineage-v1.0',status:'S8_2E_CONFORMED_NOT_REGENERATED',moduleId:'road-ltl',effectiveModuleVersion:'1.5',sourceTaskId:'LTL-04',semanticRecordId:r.semanticRecordId,governingContracts:governing,compilerPolicy:{
 compilationUnit:'EXECUTOR_READY_TERMINAL_DECOMPOSITION_LEAF_ONLY',
 blockedLeafCompilation:false,deterministic:true,addsKnowledge:false,canonicalClientValues:false,runtimeSpecificStructure:false,fullDetailProtection:'EXECUTION_PROTECTED'
},correctedDonors:{operationalSemantics:'scripts/materialize-operational-semantics-v1.cjs',clientBinding:'scripts/materialize-client-binding-v1.cjs',clientBindingState:binding.readiness.state},
regeneration:{performed:false,stage:'S8-3',reason:'S8-2E aligns compiler/schema lineage only; actual WorkDefinition derivative regeneration is governed S8-3 work.'}};
process.stdout.write(JSON.stringify(plan,null,2)+'\n');
