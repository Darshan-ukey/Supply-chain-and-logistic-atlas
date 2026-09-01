import type { WorkDefinition, ClientBinding, RuntimeProjection } from '@malkom/domainwarehouse-contract';
import { compileWorkflow } from './workflow.js';

export interface QueueTemplateCandidate {
  id: string;
  name: string;
  purpose: string;
  domain: string;
  sourceTaskId: string;
  subQueues: Array<{ name: string; workTypes: string[]; outcomes: string[] }>;
  workTypes: Array<{ name: string; executionMode: string; purpose: string }>;
  fields: Array<{ name: string; label: string; type: string; required: boolean }>;
  outcomes: Array<{ id:string; code: string; label: string; route: string; status: string; nextStep: string }>;
}

export interface ValueListCandidate { id: string; name: string; values: string[]; sourceTaskId: string; }

export interface MalkomCompilation {
  queue: QueueTemplateCandidate;
  workflow: ReturnType<typeof compileWorkflow>;
  valueLists: ValueListCandidate[];
  bindingRequired: boolean;
  runtimeProjection:RuntimeProjection;
  notes: string[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function compileMalkom(definition: WorkDefinition, binding?: ClientBinding): MalkomCompilation {
  const p = definition.decomposition.malkom;
  const queue: QueueTemplateCandidate = {
    id: `dw-${definition.sourceTask.taskId.toLowerCase()}`,
    name: p.queue,
    purpose: p.queuePurpose,
    domain: definition.domain,
    sourceTaskId: definition.sourceTask.taskId,
    subQueues: p.subQueues.map((s) => ({ name:s.name, workTypes:[...s.workTypes], outcomes:[...s.outcomes] })),
    workTypes: p.workTypes.map((w) => ({ ...w })),
    fields: p.fields.map((f) => ({ ...f })),
    outcomes: p.outcomes.map((o) => ({ id:o.id, code:o.code, label:o.label, route:o.route, status:o.status, nextStep:o.nextStep }))
  };

  const valueLists: ValueListCandidate[] = [];
  const families = [...new Set(p.outcomes.map((o) => o.family))];
  if (families.length > 1) valueLists.push({ id:`${slug(definition.sourceTask.taskId)}-outcome-family`, name:`${p.queue} Outcome Families`, values:families, sourceTaskId:definition.sourceTask.taskId });
  const statuses = [...new Set(p.outcomes.map((o) => o.status))];
  if (statuses.length > 1) valueLists.push({ id:`${slug(definition.sourceTask.taskId)}-status`, name:`${p.queue} Statuses`, values:statuses, sourceTaskId:definition.sourceTask.taskId });
  const routes = [...new Set(p.outcomes.map((o) => o.route))];
  if (routes.length > 1) valueLists.push({ id:`${slug(definition.sourceTask.taskId)}-route`, name:`${p.queue} Routes`, values:routes, sourceTaskId:definition.sourceTask.taskId });

  const workflow = compileWorkflow(definition);
  const bindingRequired = !binding && definition.clientOverridePoints.length > 0;
  const runtimeProjection:RuntimeProjection={
    id:`malkom:${definition.sourceTask.taskId}:compiled`,runtime:'MALKOM_3',adapterId:'malkom-command',generatedFromWorkDefinitionId:definition.id,
    disposition:workflow.materializable?'MAPPED':'UNSUPPORTED_CURRENT_MALKOM',
    capabilities:['QUEUE','SUBQUEUE','WORK_TYPE','SCHEMA','OUTCOME','VALUE_LIST','WORKFLOW'],
    payloadRef:`compiled:${queue.id}`,
    note:workflow.materializable?'Projection is representable by current queue/lifecycle structures.':'Canonical next-step semantics are preserved but one or more branches require a future/current-runtime capability.'
  };
  const notes = [
    'Reference definition remains immutable; client configuration is applied separately.',
    bindingRequired ? 'Client binding is required before deployment-specific materialization.' : 'Client binding supplied.',
    workflow.materializable ? 'Workflow projection is materializable by the current lifecycle contract.' : 'Workflow projection contains current-Malkom capability blockers; canonical flow remains visible.'
  ];
  return { queue, workflow, valueLists, bindingRequired, runtimeProjection, notes };
}

export function compileDomainPack(definitions:WorkDefinition[], bindings:ClientBinding[]=[]):MalkomCompilation[]{
  const byVersion=new Map(bindings.map((binding)=>[binding.referenceVersion,binding]));
  return definitions.map((definition)=>compileMalkom(definition,byVersion.get(definition.version)));
}
