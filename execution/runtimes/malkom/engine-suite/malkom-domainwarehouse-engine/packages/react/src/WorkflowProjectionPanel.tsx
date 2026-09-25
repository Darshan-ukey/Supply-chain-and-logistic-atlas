import React from 'react';
import type { WorkDefinition } from '@malkom/domainwarehouse-contract';
import { compileWorkflow } from '@malkom/domainwarehouse-core';

export function WorkflowProjectionPanel({definition}:{definition:WorkDefinition}){
  const result=compileWorkflow(definition);
  return <section data-testid="workflow-projection"><h3>Workflow Engine Projection</h3>
    <p>{result.materializable?'Compatible with current Malkom workflow lifecycle contract.':'Canonical definition contains runtime capabilities not currently materializable.'}</p>
    <dl><dt>Lifecycle</dt><dd>{result.lifecycle.name}</dd><dt>States</dt><dd>{result.lifecycle.states.length}</dd><dt>Numeric SLA</dt><dd>{result.lifecycle.slaMinutes||'Not invented — client/reference binding required'}</dd></dl>
    {result.blockers.length>0&&<><h4>Materialization blockers</h4><ul>{result.blockers.map((b,i)=><li key={i}>{b.outcomeCode} · {b.nextStep}{b.targetTaskId?` → ${b.targetTaskId}`:''} · {b.disposition}</li>)}</ul></>}
  </section>;
}
