'use strict';
/** Adapter keeps SCM-specific field names outside the domain-neutral core. */
function toCoreProcess(p){return{id:p.id,label:p.label,level:p.level,parentId:p.a3ParentId||p.parent,states:{before:p.before,after:p.after},event:p.event,decision:p.decision,rule:p.rule,control:p.control,action:p.action,evidence:p.evidence,outcome:p.outcome,inputs:p.inputs||[],outputs:p.outputs||[],sources:p.sourceIds||[],extensions:{supplyChain:{applicability:p.applicability||{},custody:p.custody,financial:p.financial,documents:p.documentIds||[]}}}}
module.exports={toCoreProcess};
