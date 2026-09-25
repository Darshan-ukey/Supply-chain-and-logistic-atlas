import { Ajv, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { ArtifactRef, ValidationIssue } from './types.js';

export const pipelineStages = [
  'accepted', 'inspection', 'evidence-acquisition', 'evidence-conflict-resolution',
  'semantic-planning', 'compilation', 'missing-evidence-acquisition', 'preflight',
  'lowering', 'execution', 'drift-detection', 'healing', 'cleanup', 'aggregation',
  'persistence', 'handover',
] as const;

export type PipelineStage = typeof pipelineStages[number];

export const pipelineDiagnosticCategories = [
  'input', 'evidence', 'conflict', 'planning', 'compilation', 'preflight',
  'dependency', 'policy', 'engine', 'timeout', 'cancellation', 'network',
  'healing', 'cleanup', 'reporting', 'persistence', 'extension', 'internal',
] as const;

export type PipelineDiagnosticCategory = typeof pipelineDiagnosticCategories[number];

export interface PipelineReference {
  readonly kind: 'scenario' | 'action' | 'operation' | 'evidence' | 'artifact' | 'extension';
  readonly id: string;
}

export interface PipelineDiagnostic {
  readonly schemaVersion: 'brisk-aitesting.diagnostic.v1';
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly category: PipelineDiagnosticCategory;
  readonly stage: PipelineStage;
  readonly message: string;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly nextAction?: string;
  readonly references: readonly PipelineReference[];
  readonly causes: readonly { readonly code?: string; readonly message: string }[];
}

export interface PipelineContractRef {
  readonly name: string;
  readonly version: string;
}

export interface PipelineProvenanceRef {
  readonly kind: 'evidence' | 'intent' | 'workflow' | 'plan' | 'observation' | 'policy' | 'configuration';
  readonly id: string;
  readonly digest?: string;
}

export interface PipelineRetryState {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly previousStageId?: string;
}

export interface PipelineRecoveryState {
  readonly mode: 'fresh' | 'retry' | 'resume' | 'recovered';
  readonly sourceRunId?: string;
  readonly sourceStageId?: string;
}

export interface PipelineCancellationState {
  readonly requested: boolean;
  readonly requestedAt?: string;
  readonly reason?: string;
}

interface PipelineEnvelopeBase {
  readonly schemaVersion: 'brisk-aitesting.stage-envelope.v1';
  readonly stageId: string;
  readonly stage: PipelineStage;
  readonly contract: PipelineContractRef;
  readonly correlationId: string;
  readonly runId: string;
  readonly scenarioId?: string;
  readonly operationId?: string;
  readonly adapterId?: string;
  readonly engineId?: string;
  readonly parentStageId?: string;
  readonly evidenceRevision?: string;
  readonly policyDigest?: string;
  readonly retry: PipelineRetryState;
  readonly recovery: PipelineRecoveryState;
  readonly cancellation: PipelineCancellationState;
  readonly provenance: readonly PipelineProvenanceRef[];
}

export interface PipelineStageInput<TPayload = unknown> extends PipelineEnvelopeBase {
  readonly direction: 'input';
  readonly createdAt: string;
  readonly payload: TPayload;
}

export interface PipelineStageOutput<TPayload = unknown> extends PipelineEnvelopeBase {
  readonly direction: 'output';
  readonly status: 'succeeded' | 'completed-with-diagnostics' | 'failed' | 'cancelled' | 'blocked';
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly diagnostics: readonly PipelineDiagnostic[];
  readonly artifacts: readonly ArtifactRef[];
  readonly redaction: { readonly applied: boolean; readonly policyId?: string };
  readonly payload: TPayload;
}

const identifierSchema = { type: 'string', minLength: 1, maxLength: 512 } as const;
const dateTimeSchema = { type: 'string', format: 'date-time' } as const;

export const pipelineDiagnosticJsonSchema = {
  $id: 'brisk-aitesting.diagnostic.v1', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'code', 'severity', 'category', 'stage', 'message', 'recoverable', 'retryable', 'references', 'causes'],
  properties: {
    schemaVersion: { const: 'brisk-aitesting.diagnostic.v1' },
    code: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,127}$' },
    severity: { enum: ['info', 'warning', 'error'] },
    category: { enum: pipelineDiagnosticCategories }, stage: { enum: pipelineStages },
    message: { type: 'string', minLength: 1, maxLength: 8192 },
    recoverable: { type: 'boolean' }, retryable: { type: 'boolean' },
    nextAction: { type: 'string', minLength: 1, maxLength: 4096 },
    references: { type: 'array', maxItems: 256, items: {
      type: 'object', additionalProperties: false, required: ['kind', 'id'],
      properties: { kind: { enum: ['scenario', 'action', 'operation', 'evidence', 'artifact', 'extension'] }, id: identifierSchema },
    } },
    causes: { type: 'array', maxItems: 32, items: {
      type: 'object', additionalProperties: false, required: ['message'],
      properties: { code: { type: 'string', minLength: 1, maxLength: 128 }, message: { type: 'string', minLength: 1, maxLength: 4096 } },
    } },
  },
} as const;

const baseProperties = {
  schemaVersion: { const: 'brisk-aitesting.stage-envelope.v1' }, stageId: identifierSchema,
  stage: { enum: pipelineStages },
  contract: { type: 'object', additionalProperties: false, required: ['name', 'version'], properties: {
    name: { type: 'string', pattern: '^brisk-aitesting\\.[a-z0-9.-]+$' }, version: { type: 'string', pattern: '^v[1-9][0-9]*$' },
  } },
  correlationId: identifierSchema, runId: identifierSchema, scenarioId: identifierSchema,
  operationId: identifierSchema, adapterId: identifierSchema, engineId: identifierSchema,
  parentStageId: identifierSchema, evidenceRevision: identifierSchema,
  policyDigest: { type: 'string', pattern: '^[A-Za-z0-9:_-]{8,256}$' },
  retry: { type: 'object', additionalProperties: false, required: ['attempt', 'maxAttempts'], properties: {
    attempt: { type: 'integer', minimum: 1, maximum: 100 }, maxAttempts: { type: 'integer', minimum: 1, maximum: 100 }, previousStageId: identifierSchema,
  } },
  recovery: { type: 'object', additionalProperties: false, required: ['mode'], properties: {
    mode: { enum: ['fresh', 'retry', 'resume', 'recovered'] }, sourceRunId: identifierSchema, sourceStageId: identifierSchema,
  } },
  cancellation: { type: 'object', additionalProperties: false, required: ['requested'], properties: {
    requested: { type: 'boolean' }, requestedAt: dateTimeSchema, reason: { type: 'string', minLength: 1, maxLength: 2048 },
  } },
  provenance: { type: 'array', maxItems: 1024, items: {
    type: 'object', additionalProperties: false, required: ['kind', 'id'], properties: {
      kind: { enum: ['evidence', 'intent', 'workflow', 'plan', 'observation', 'policy', 'configuration'] },
      id: identifierSchema, digest: { type: 'string', minLength: 8, maxLength: 256 },
    },
  } }, payload: true,
} as const;

export const pipelineStageEnvelopeJsonSchema = {
  $id: 'brisk-aitesting.stage-envelope.v1', oneOf: [
    { type: 'object', additionalProperties: false,
      required: ['schemaVersion', 'direction', 'stageId', 'stage', 'contract', 'correlationId', 'runId', 'retry', 'recovery', 'cancellation', 'provenance', 'createdAt', 'payload'],
      properties: { ...baseProperties, direction: { const: 'input' }, createdAt: dateTimeSchema } },
    { type: 'object', additionalProperties: false,
      required: ['schemaVersion', 'direction', 'stageId', 'stage', 'contract', 'correlationId', 'runId', 'retry', 'recovery', 'cancellation', 'provenance', 'status', 'startedAt', 'completedAt', 'durationMs', 'diagnostics', 'artifacts', 'redaction', 'payload'],
      properties: { ...baseProperties, direction: { const: 'output' },
        status: { enum: ['succeeded', 'completed-with-diagnostics', 'failed', 'cancelled', 'blocked'] },
        startedAt: dateTimeSchema, completedAt: dateTimeSchema, durationMs: { type: 'number', minimum: 0 },
        diagnostics: { type: 'array', maxItems: 4096, items: { $ref: 'brisk-aitesting.diagnostic.v1' } },
        artifacts: { type: 'array', maxItems: 10000, items: { type: 'object', additionalProperties: false, required: ['kind', 'label'], properties: {
          kind: { enum: ['json', 'junit', 'html', 'trace', 'screenshot', 'video', 'test-file', 'log', 'other'] }, path: { type: 'string' }, url: { type: 'string' }, label: { type: 'string', minLength: 1 }, metadata: { type: 'object' },
        } } },
        redaction: { type: 'object', additionalProperties: false, required: ['applied'], properties: {
          applied: { type: 'boolean' }, policyId: identifierSchema,
        } },
      } },
  ],
} as const;

const ajv = new Ajv({ allErrors: true, strict: true });
const applyFormats = addFormats as unknown as (instance: Ajv, formats: string[]) => Ajv;
// REG-0001: declaring a format as `true` only annotates it and accepted values
// such as "yesterday". Use AJV's maintained format implementation so temporal
// evidence, cancellation, and recovery metadata is validated rather than trusted.
applyFormats(ajv, ['date-time']);
ajv.addSchema(pipelineDiagnosticJsonSchema);
const validateDiagnostic = ajv.getSchema('brisk-aitesting.diagnostic.v1');
const validateEnvelope = ajv.compile(pipelineStageEnvelopeJsonSchema);

export function validatePipelineDiagnosticJsonContract(value: unknown): readonly ValidationIssue[] {
  if (validateDiagnostic === undefined) return [{ severity: 'error', path: 'diagnostic', code: 'SCHEMA_NOT_REGISTERED', message: 'Diagnostic schema was not registered.' }];
  return validationIssues(validateDiagnostic(value) === true, validateDiagnostic.errors ?? [], 'diagnostic');
}

export function validatePipelineStageEnvelopeJsonContract(value: unknown): readonly ValidationIssue[] {
  return validationIssues(validateEnvelope(value) === true, validateEnvelope.errors ?? [], 'stageEnvelope');
}

function validationIssues(valid: boolean, errors: readonly ErrorObject[], root: string): readonly ValidationIssue[] {
  if (valid) return [];
  return errors.map((error) => ({ severity: 'error' as const, path: `${root}${error.instancePath || '/'}`, code: 'INVALID_PIPELINE_CONTRACT', message: error.message ?? 'Pipeline contract validation failed.' }));
}
