import { describe, expect, it } from 'vitest';
import { buildQueueFlow, compileMalkom, compileWorkflow, DomainWarehouse, enumerateQueuePaths, score, verify } from '../src/index.js';
import type { ClientBinding, ClientExtension, WorkDefinition } from '@malkom/domainwarehouse-contract';
import defsJson from '../../../fixtures/road-ltl/work-definitions.json' with { type: 'json' };
const defs=defsJson as WorkDefinition[];
describe('Road LTL Domain Warehouse v2.3',()=>{
  it('keeps 22 definitions and verifies them',()=>{expect(defs).toHaveLength(22);expect(verify(defs).valid).toBe(true)});
  it('first-classes knowledge notes and runtime projection metadata',()=>{expect(defs.every(d=>d.notes.length>=3&&d.projections.length>=1)).toBe(true)});
  it('builds queue flow from compiled Malkom subqueues/outcomes',()=>{const d=defs.find(x=>x.sourceTask.taskId==='LTL-22')!;const c=compileMalkom(d);const f=buildQueueFlow(c.queue,c.valueLists,{canonicalEscalationTarget:{taskId:'LTL-14'}});expect(f.nodes.some(n=>n.kind==='SUBQUEUE')).toBe(true);expect(f.edges.filter(e=>e.kind==='STAY_RETURN')).toHaveLength(8);expect(f.edges.filter(e=>e.kind==='CANONICAL_ESCALATION')).toHaveLength(4)});
  it('enumerates finite paths with STAY loop guards',()=>{const d=defs.find(x=>x.sourceTask.taskId==='LTL-22')!;const c=compileMalkom(d);const f=buildQueueFlow(c.queue,c.valueLists,{canonicalEscalationTarget:{taskId:'LTL-14'}});const paths=enumerateQueuePaths(f,{maxVisitsPerNode:2,maxDepth:64});expect(paths.length).toBeGreaterThan(0);expect(paths.some(p=>p.termination==='LOOP_GUARD')).toBe(true);expect(paths.every(p=>p.nodeIds.length<=65)).toBe(true)});
  it('blocks current workflow materialization for escalation tasks',()=>{expect(defs.filter(d=>compileWorkflow(d).blockers.length>0).map(d=>d.sourceTask.taskId)).toEqual(['LTL-15','LTL-18','LTL-22'])});
  it('snapshots bindings and extensions without structuredClone callback failure',()=>{const wh=new DomainWarehouse();wh.publish(defs[0]);const binding={id:'b1',clientId:'c1',referenceVersion:'1.2.0',fieldMappings:[],systemMappings:[],statusMappings:[],routeMappings:[],slaMappings:[],policyMappings:[],interfaceMappings:[]} satisfies ClientBinding;const ext={id:'e1',clientId:'c1',workDefinitionId:defs[0].id,subQueues:[],workTypes:[],fields:[],outcomes:[],controls:[],exceptionBranches:[]} satisfies ClientExtension;wh.bind(binding);wh.extend(ext);const snap=wh.snapshot();expect(snap.bindings).toHaveLength(1);expect(snap.extensions).toHaveLength(1)});
  it('scores reference vs client actual deterministically',()=>{expect(score({a:1},{a:1}).score).toBe(100)});
});
