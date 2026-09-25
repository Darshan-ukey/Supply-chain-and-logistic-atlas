import { z } from 'zod';

export const provenanceSchema = z.enum([
  'SOURCE_BACKED','ATLAS_DERIVED','MALKOM_STANDARD','CLIENT_OVERRIDE','INFERRED','UNRESOLVED'
]);
export const lifecycleStatusSchema = z.enum(['DRAFT','CANDIDATE','VALIDATED','APPROVED','ACTIVE','DEPRECATED']);
export const runtimeDispositionSchema = z.enum([
  'SUPPORTED','MAPPED','TRANSFORMED','CLIENT_BINDING_REQUIRED','UNSUPPORTED_CURRENT_MALKOM','FUTURE_MALKOM_ENHANCEMENT'
]);
export const nextStepSchema = z.enum([
  'END_WORK_ITEM','STAY_IN_QUEUE','MOVE_TO_QUEUE','WAIT_FOR_EVENT','ESCALATE','RETRY','CONTINUE','HUMAN_REVIEW'
]);
export const executionModeSchema = z.enum([
  'DETERMINISTIC_RULES','VALIDATION','WORKFLOW','API_SYSTEM','RPA','DOCUMENT_AI','COPILOT','AI_AGENT','HUMAN','HUMAN_IN_LOOP','HYBRID'
]);

export const knowledgeNoteKindSchema = z.enum([
  'DEFINITION','WHY_IT_MATTERS','EXAMPLE','COUNTER_EXAMPLE','LOGIC','REASON_CODE','SOURCE','OPEN_QUESTION'
]);
export const knowledgeNodeKindSchema = z.enum([
  'DOMAIN','LIFECYCLE','QUEUE','SUBQUEUE','WORK_TYPE','TABLE','FIELD','OUTCOME','RULE','CONTROL','TRANSITION'
]);
export const knowledgeNoteSchema = z.object({
  id:z.string().min(1),
  kind:knowledgeNoteKindSchema,
  nodeRef:z.object({ kind:knowledgeNodeKindSchema, id:z.string().min(1) }),
  text:z.string().min(1),
  provenance:provenanceSchema,
  sourceRefs:z.array(z.string()).default([]),
  confidence:z.enum(['HIGH','MEDIUM','LOW','UNRESOLVED']).default('HIGH')
});
export type KnowledgeNote = z.infer<typeof knowledgeNoteSchema>;

export const runtimeProjectionSchema = z.object({
  id:z.string().min(1),
  runtime:z.string().min(1),
  adapterId:z.string().min(1),
  generatedFromWorkDefinitionId:z.string().min(1),
  disposition:runtimeDispositionSchema,
  capabilities:z.array(z.string()).default([]),
  payloadRef:z.string().min(1),
  note:z.string().min(1)
});
export type RuntimeProjection = z.infer<typeof runtimeProjectionSchema>;

export const sourceRefSchema = z.object({ id:z.string().min(1), provenance:provenanceSchema.default('SOURCE_BACKED') });

export const canonicalExecutionSchema = z.object({
  trigger:z.string().min(1),
  stateBefore:z.string().min(1),
  event:z.string().min(1),
  decision:z.string().min(1),
  rule:z.string().min(1),
  control:z.string().min(1),
  clock:z.string().min(1),
  action:z.string().min(1),
  evidence:z.string().min(1),
  stateAfter:z.string().min(1),
  outcome:z.string().min(1)
});

export const actorContractSchema = z.object({
  actor:z.string().min(1), performer:z.string().min(1), owner:z.string().min(1),
  decisionAuthority:z.string().min(1), custody:z.string().min(1), financial:z.string().min(1), exceptionOwner:z.string().min(1)
});

export const systemContractSchema = z.object({
  producer:z.string().min(1), authoritySystem:z.string().min(1), authorityObject:z.string().min(1),
  consumers:z.string().min(1), interface:z.string().min(1)
});

export const informationContractSchema = z.object({
  inputs:z.array(z.string()), outputs:z.array(z.string()), identifiers:z.string().min(1), lineage:z.string().min(1)
});

export const malkomFieldSchema = z.object({ name:z.string().min(1), label:z.string().min(1), type:z.string().min(1), required:z.boolean() });
export const malkomOutcomeSchema = z.object({
  id:z.string().min(1), code:z.string().min(1), label:z.string().min(1), family:z.string().min(1), route:z.string().min(1),
  status:z.string().min(1), businessState:z.string().min(1), nextStep:nextStepSchema
});
export const malkomWorkTypeSchema = z.object({ name:z.string().min(1), executionMode:z.string().min(1), purpose:z.string().min(1) });
export const malkomSubQueueSchema = z.object({ name:z.string().min(1), workTypes:z.array(z.string()).min(1), outcomes:z.array(z.string()).min(1) });
export const malkomTaskProjectionSchema = z.object({
  taskId:z.string().min(1), taskLabel:z.string().min(1), a3:z.string().min(1), queue:z.string().min(1), queuePurpose:z.string().min(1),
  businessObjects:z.array(z.string()), subQueues:z.array(malkomSubQueueSchema).min(1), workTypes:z.array(malkomWorkTypeSchema).min(1),
  fields:z.array(malkomFieldSchema).min(1), outcomes:z.array(malkomOutcomeSchema).min(1),
  decisions:z.array(z.any()).default([]), rules:z.array(z.string()).default([]), controls:z.array(z.string()).default([]), actions:z.array(z.string()).default([]),
  actors:z.array(z.string()).default([]), systems:z.array(z.any()).default([]), clientOverridePoints:z.array(z.string()).default([]), sourceRefs:z.array(z.string()).default([])
});

export const sourceGraphEdgeSchema = z.object({ id:z.string().min(1), from:z.string().min(1), type:z.string().min(1), to:z.string().min(1) });
export const executionTransitionSchema = z.object({
  id:z.string().min(1), processId:z.string().min(1), stateBeforeId:z.string().min(1), eventId:z.string().min(1),
  decisionId:z.string().min(1), ruleId:z.string().min(1), controlId:z.string().min(1), clock:z.string().min(1),
  actionId:z.string().min(1), evidenceId:z.string().min(1), stateAfterId:z.string().min(1)
});

export const workDefinitionSchema = z.object({
  kind:z.literal('malkom.domain-work-definition/2.3'),
  id:z.string().min(1), domain:z.string().min(1), version:z.string().min(1), status:lifecycleStatusSchema,
  canonicalName:z.string().min(1),
  sourceTask:z.object({ module:z.string().min(1), taskId:z.string().min(1), normalizedSourceSha256:z.string().length(64), sourceRefs:z.array(z.string()) }),
  sourceRecord:z.record(z.string(), z.any()),
  sourceGraph:z.object({ incoming:z.array(sourceGraphEdgeSchema), outgoing:z.array(sourceGraphEdgeSchema), executionTransition:executionTransitionSchema }),
  canonical:z.object({
    execution:canonicalExecutionSchema,
    actors:actorContractSchema,
    systems:systemContractSchema,
    information:informationContractSchema,
    applicability:z.record(z.string(), z.any()), participants:z.array(z.any()), paths:z.record(z.string(), z.any()),
    claimBoundary:z.string().min(1), sourceIds:z.array(z.string()), confidenceModel:z.record(z.string(), z.any())
  }),
  decomposition:z.object({ basis:z.literal('MALKOM_STANDARD'), malkom:malkomTaskProjectionSchema }),
  notes:z.array(knowledgeNoteSchema).default([]),
  projections:z.array(runtimeProjectionSchema).default([]),
  clientOverridePoints:z.array(z.string()),
  provenance:z.object({ sourceRecord:provenanceSchema, canonical:provenanceSchema, decomposition:provenanceSchema, projection:provenanceSchema })
});
export type WorkDefinition = z.infer<typeof workDefinitionSchema>;

export const clientBindingSchema = z.object({
  id:z.string().min(1), clientId:z.string().min(1), referenceVersion:z.string().min(1),
  fieldMappings:z.array(z.object({ canonicalField:z.string(), clientField:z.string() })).default([]),
  systemMappings:z.array(z.object({ canonicalSystem:z.string(), clientSystem:z.string(), connectionRef:z.string().optional() })).default([]),
  statusMappings:z.array(z.object({ canonicalStatus:z.string(), clientStatus:z.string() })).default([]),
  routeMappings:z.array(z.object({ canonicalRoute:z.string(), clientRoute:z.string() })).default([]),
  slaMappings:z.array(z.object({ workDefinitionId:z.string(), clientSlaMinutes:z.number().int().nonnegative() })).default([]),
  policyMappings:z.array(z.object({ reference:z.string(), clientValue:z.string() })).default([]),
  interfaceMappings:z.array(z.object({ canonicalSystem:z.string(), interfaceType:z.string(), bindingRef:z.string().optional() })).default([])
});
export type ClientBinding = z.infer<typeof clientBindingSchema>;

export const clientExtensionSchema = z.object({
  id:z.string().min(1), clientId:z.string().min(1), workDefinitionId:z.string().min(1),
  subQueues:z.array(malkomSubQueueSchema).default([]), workTypes:z.array(malkomWorkTypeSchema).default([]), fields:z.array(malkomFieldSchema).default([]),
  outcomes:z.array(malkomOutcomeSchema).default([]), controls:z.array(z.string()).default([]), exceptionBranches:z.array(z.string()).default([])
});
export type ClientExtension = z.infer<typeof clientExtensionSchema>;

export const workflowStateSchema = z.object({ key:z.string().min(1).max(40), label:z.string().min(1).max(120), terminal:z.boolean(), holdsClock:z.boolean(), to:z.array(z.string().min(1).max(40)).max(40) });
export const workflowLifecycleSchema = z.object({ id:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/), name:z.string().min(1).max(120), initialState:z.string().min(1).max(40), states:z.array(workflowStateSchema).min(2).max(64), slaMinutes:z.number().int().nonnegative(), enabled:z.boolean() });
export type WorkflowLifecycle = z.infer<typeof workflowLifecycleSchema>;

export const materializationBlockerSchema = z.object({
  workDefinitionId:z.string().min(1), outcomeCode:z.string().min(1), nextStep:nextStepSchema,
  targetTaskId:z.string().optional(), capability:z.string().min(1), reason:z.string().min(1), disposition:runtimeDispositionSchema
});
export type MaterializationBlocker = z.infer<typeof materializationBlockerSchema>;

export const coverageClassificationSchema = z.enum(['ALIGNED','LEGITIMATE_VARIANT','UNEXPLAINED_DEVIATION','GAP','EXTRA_CLIENT_WORK','RUNTIME_LIMITATION']);
export const coverageResultSchema = z.object({
  score:z.number().min(0).max(100), matched:z.number().int().nonnegative(), total:z.number().int().nonnegative(),
  findings:z.array(z.object({ path:z.string(), classification:coverageClassificationSchema, reference:z.any().optional(), actual:z.any().optional(), note:z.string().optional() }))
});
export type CoverageResult = z.infer<typeof coverageResultSchema>;

export const runtimeCapabilitySchema = z.object({ capability:z.string().min(1), disposition:runtimeDispositionSchema, note:z.string().min(1) });
