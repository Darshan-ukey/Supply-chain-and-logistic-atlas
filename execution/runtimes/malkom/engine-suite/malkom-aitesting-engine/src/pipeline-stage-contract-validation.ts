import { Ajv, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidationIssue } from './types.js';

const nonEmptyString = { type: 'string', minLength: 1, maxLength: 8192 } as const;
const identifier = { type: 'string', minLength: 1, maxLength: 512 } as const;
const authority = { enum: ['host', 'contract', 'runtime', 'observed', 'source', 'heuristic'] } as const;
const engineType = { enum: ['ui', 'api', 'contract', 'schema', 'replay', 'message', 'custom'] } as const;
const artifactRef = {
  type: 'object', additionalProperties: false, required: ['kind', 'label'], properties: {
    kind: { enum: ['json', 'junit', 'html', 'trace', 'screenshot', 'video', 'test-file', 'log', 'other'] },
    path: nonEmptyString, url: { type: 'string', minLength: 1, format: 'uri' }, label: nonEmptyString,
    metadata: { type: 'object' },
  },
} as const;
const provenance = {
  type: 'object', additionalProperties: false, required: ['authority', 'source', 'confidence'], properties: {
    authority, source: nonEmptyString, confidence: { type: 'number', minimum: 0, maximum: 1 },
    observedAt: { type: 'string', format: 'date-time' }, revision: nonEmptyString,
  },
} as const;

function domainContractRef(schemaVersion: string) {
  // This validates the identity of an independently versioned domain payload.
  // Its deep schema is intentionally not duplicated inside every stage wrapper.
  return {
    type: 'object',
    required: ['schemaVersion'],
    properties: { schemaVersion: { const: schemaVersion } },
  } as const;
}

function closed(schemaVersion: string, required: readonly string[], properties: Record<string, unknown>) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', ...required],
    properties: { schemaVersion: { const: schemaVersion }, ...properties },
  } as const;
}

const missingRequirement = {
  type: 'object', additionalProperties: false,
  required: ['id', 'semanticType', 'reasonCode', 'reason', 'requiredAuthority'],
  properties: {
    id: identifier, semanticType: nonEmptyString,
    reasonCode: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,127}$' },
    reason: nonEmptyString, requiredAuthority: authority, capability: nonEmptyString,
    scenarioId: identifier, actionId: identifier, operationId: identifier,
  },
} as const;

const acquisitionOutput = closed('brisk-aitesting.evidence-acquisition-output.v1',
  ['graphs', 'attempts', 'satisfiedRequirementIds', 'unsatisfiedRequirementIds', 'artifacts'], {
    graphs: { type: 'array', maxItems: 1024, items: domainContractRef('brisk-aitesting.evidence-graph.v1') },
    attempts: { type: 'array', maxItems: 1024, items: {
      type: 'object', additionalProperties: false,
      required: ['providerId', 'status', 'requirementIds', 'graphRevisions', 'cache'],
      properties: {
        providerId: identifier,
        status: { enum: ['succeeded', 'completed-with-diagnostics', 'failed', 'cancelled', 'skipped'] },
        requirementIds: { type: 'array', uniqueItems: true, items: identifier },
        graphRevisions: { type: 'array', uniqueItems: true, items: identifier },
        cache: { enum: ['hit', 'miss', 'bypassed', 'not-applicable'] },
      },
    } },
    satisfiedRequirementIds: { type: 'array', uniqueItems: true, items: identifier },
    unsatisfiedRequirementIds: { type: 'array', uniqueItems: true, items: identifier },
    artifacts: { type: 'array', items: artifactRef },
  });

const conflictOutput = closed('brisk-aitesting.evidence-conflict-output.v1',
  ['graph', 'conflicts', 'mutationBlockedOperationIds'], {
    graph: domainContractRef('brisk-aitesting.evidence-graph.v1'),
    conflicts: { type: 'array', maxItems: 10000, items: {
      type: 'object', additionalProperties: false,
      required: ['id', 'operationId', 'field', 'status', 'candidateEvidence', 'reasonCode', 'mutationBlocked'],
      properties: {
        id: identifier, operationId: identifier, field: nonEmptyString,
        status: { enum: ['resolved', 'unresolved'] },
        candidateEvidence: { type: 'array', minItems: 2, items: provenance },
        selectedEvidence: provenance,
        reasonCode: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,127}$' },
        mutationBlocked: { type: 'boolean' },
      },
    } },
    mutationBlockedOperationIds: { type: 'array', uniqueItems: true, items: identifier },
  });

const authorityOverride = {
  type: 'object', additionalProperties: false, required: ['scope', 'authority', 'reason'], properties: {
    scope: nonEmptyString, authority, reason: nonEmptyString,
  },
} as const;

const authorityPolicy = closed('brisk-aitesting.evidence-authority-policy.v1',
  ['authorityOrder', 'hostOverrides'], {
    authorityOrder: { type: 'array', minItems: 6, maxItems: 6, uniqueItems: true, items: authority },
    hostOverrides: { type: 'array', maxItems: 1024, items: authorityOverride },
  });

const conflictCandidate = {
  type: 'object', additionalProperties: false,
  required: ['id', 'value', 'provenance', 'sourceGraphRevisions'],
  properties: {
    id: identifier,
    value: {},
    provenance: { type: 'array', minItems: 1, maxItems: 10000, items: provenance },
    sourceGraphRevisions: { type: 'array', minItems: 1, maxItems: 1024, uniqueItems: true, items: identifier },
  },
} as const;

const conflictRecordV2 = {
  type: 'object', additionalProperties: false,
  required: ['id', 'operationId', 'field', 'status', 'candidates', 'reasonCode', 'explanation', 'mutationBlocked'],
  properties: {
    id: identifier, operationId: identifier, field: nonEmptyString,
    status: { enum: ['resolved', 'unresolved'] },
    candidates: { type: 'array', minItems: 2, maxItems: 10000, items: conflictCandidate },
    selectedCandidateId: identifier,
    reasonCode: { enum: ['AUTHORITY_PRECEDENCE', 'AUTHORITY_TIE', 'HOST_OVERRIDE_APPLIED', 'HOST_OVERRIDE_NO_MATCH', 'HOST_OVERRIDE_AMBIGUOUS'] },
    explanation: nonEmptyString,
    mutationBlocked: { type: 'boolean' },
    override: authorityOverride,
  },
} as const;

const conflictOutputV2 = closed('brisk-aitesting.evidence-conflict-output.v2',
  ['graph', 'conflicts', 'mutationBlockedOperationIds', 'policyDigest'], {
    graph: domainContractRef('brisk-aitesting.evidence-graph.v1'),
    conflicts: { type: 'array', maxItems: 10000, items: conflictRecordV2 },
    mutationBlockedOperationIds: { type: 'array', uniqueItems: true, items: identifier },
    policyDigest: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
  });

export const pipelineStagePayloadJsonSchemas = {
  'brisk-aitesting.evidence-authority-policy.v1': authorityPolicy,
  'brisk-aitesting.evidence-freshness.v1': closed('brisk-aitesting.evidence-freshness.v1',
    ['status', 'checkedAt', 'reasonCode'], {
      status: { enum: ['fresh', 'stale', 'unknown'] },
      checkedAt: { type: 'string', format: 'date-time' },
      reasonCode: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,127}$' },
      sourceRevision: nonEmptyString,
      validUntil: { type: 'string', format: 'date-time' },
    }),
  'brisk-aitesting.inspection-input.v1': closed('brisk-aitesting.inspection-input.v1',
    ['app', 'scope', 'contractPaths', 'limits'], {
      app: { type: 'object', additionalProperties: false, required: ['name', 'baseUrl'], properties: {
        name: nonEmptyString, baseUrl: { type: 'string', minLength: 1, format: 'uri' }, repoPath: nonEmptyString,
      } },
      scope: { type: 'object', additionalProperties: false, required: ['repository', 'ui', 'api', 'contracts'], properties: {
        repository: { type: 'boolean' }, ui: { type: 'boolean' }, api: { type: 'boolean' }, contracts: { type: 'boolean' },
      } },
      contractPaths: { type: 'array', maxItems: 1024, items: {
        type: 'object', additionalProperties: false, required: ['kind', 'path'], properties: {
          kind: { enum: ['openapi', 'graphql', 'asyncapi', 'protobuf', 'pact', 'other'] }, path: nonEmptyString,
        },
      } },
      limits: { type: 'object', additionalProperties: false, required: ['maxSourceFiles', 'maxContractBytes'], properties: {
        maxSourceFiles: { type: 'integer', minimum: 1, maximum: 1000000 },
        maxContractBytes: { type: 'integer', minimum: 1, maximum: 1073741824 },
      } },
    }),
  'brisk-aitesting.inspection-output.v1': closed('brisk-aitesting.inspection-output.v1',
    ['discovery', 'evidenceGraphs', 'incompleteScopes'], {
      discovery: domainContractRef('brisk-aitesting.discovery.v1'),
      evidenceGraphs: { type: 'array', maxItems: 1024, items: domainContractRef('brisk-aitesting.evidence-graph.v1') },
      incompleteScopes: { type: 'array', maxItems: 1024, items: {
        type: 'object', additionalProperties: false, required: ['scope', 'reasonCode'], properties: {
          scope: nonEmptyString, reasonCode: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,127}$' },
        },
      } },
    }),
  'brisk-aitesting.evidence-acquisition-input.v1': closed('brisk-aitesting.evidence-acquisition-input.v1',
    ['requirements', 'eligibleProviderIds', 'scope', 'cachePolicy'], {
      currentEvidenceRevision: identifier,
      requirements: { type: 'array', minItems: 1, maxItems: 10000, items: missingRequirement },
      eligibleProviderIds: { type: 'array', minItems: 1, uniqueItems: true, items: identifier },
      scope: { type: 'object', additionalProperties: false, required: ['appName', 'allowedHosts'], properties: {
        appName: nonEmptyString, repoPath: nonEmptyString,
        tenantId: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$' },
        allowedHosts: { type: 'array', uniqueItems: true, items: nonEmptyString },
      } },
      cachePolicy: { enum: ['use-fresh', 'refresh-stale', 'bypass'] },
    }),
  'brisk-aitesting.evidence-acquisition-output.v1': acquisitionOutput,
  'brisk-aitesting.evidence-conflict-input.v1': closed('brisk-aitesting.evidence-conflict-input.v1',
    ['graphs', 'authorityOrder', 'hostOverrides'], {
      graphs: { type: 'array', minItems: 1, maxItems: 1024, items: domainContractRef('brisk-aitesting.evidence-graph.v1') },
      authorityOrder: { type: 'array', minItems: 1, uniqueItems: true, items: authority },
      hostOverrides: { type: 'array', maxItems: 1024, items: {
        type: 'object', additionalProperties: false, required: ['scope', 'authority', 'reason'], properties: {
          scope: nonEmptyString, authority, reason: nonEmptyString,
        },
      } },
    }),
  'brisk-aitesting.evidence-conflict-output.v1': conflictOutput,
  'brisk-aitesting.evidence-conflict-input.v2': closed('brisk-aitesting.evidence-conflict-input.v2',
    ['graphs', 'policy'], {
      graphs: { type: 'array', minItems: 1, maxItems: 1024, items: domainContractRef('brisk-aitesting.evidence-graph.v1') },
      policy: authorityPolicy,
    }),
  'brisk-aitesting.evidence-conflict-output.v2': conflictOutputV2,
  'brisk-aitesting.semantic-planning-input.v1': closed('brisk-aitesting.semantic-planning-input.v1',
    ['goal', 'scenarioCountPolicy', 'mode', 'requiredTypes', 'tags', 'evidence'], {
      goal: nonEmptyString, scenarioCount: { type: 'integer', minimum: 1, maximum: 10000 },
      scenarioCountPolicy: { enum: ['exact', 'at-least', 'at-most', 'flexible'] }, mode: { anyOf: [{ const: 'automatic' }, engineType] },
      requiredTypes: { type: 'array', uniqueItems: true, items: engineType }, tags: { type: 'array', uniqueItems: true, items: nonEmptyString },
      evidence: domainContractRef('brisk-aitesting.evidence-graph.v1'), hostInstructions: nonEmptyString,
    }),
  'brisk-aitesting.semantic-planning-output.v1': closed('brisk-aitesting.semantic-planning-output.v1',
    ['intent', 'provider'], {
      intent: domainContractRef('brisk-aitesting.intent.v1'),
      provider: { type: 'object', additionalProperties: false, required: ['id', 'attempts'], properties: {
        id: identifier, model: nonEmptyString, inputTokens: { type: 'integer', minimum: 0 }, outputTokens: { type: 'integer', minimum: 0 }, attempts: { type: 'integer', minimum: 1, maximum: 100 },
      } },
      originalResponseArtifact: artifactRef, validationArtifact: artifactRef,
    }),
  'brisk-aitesting.compilation-input.v1': closed('brisk-aitesting.compilation-input.v1',
    ['intent', 'evidence'], {
      intent: domainContractRef('brisk-aitesting.intent.v1'), evidence: domainContractRef('brisk-aitesting.evidence-graph.v1'),
      previousCompilationId: identifier, affectedScenarioIds: { type: 'array', uniqueItems: true, items: identifier },
    }),
  'brisk-aitesting.compilation-output.v1': closed('brisk-aitesting.compilation-output.v1',
    ['compilationId', 'result', 'evidenceRevision', 'affectedScenarioIds', 'deterministicIdentity'], {
      compilationId: identifier, result: domainContractRef('brisk-aitesting.compilation.v1'), evidenceRevision: identifier,
      affectedScenarioIds: { type: 'array', uniqueItems: true, items: identifier }, deterministicIdentity: identifier,
    }),
  'brisk-aitesting.missing-evidence-input.v1': closed('brisk-aitesting.missing-evidence-input.v1',
    ['compilation', 'currentEvidence', 'requirements'], {
      compilation: domainContractRef('brisk-aitesting.compilation-output.v1'),
      currentEvidence: domainContractRef('brisk-aitesting.evidence-graph.v1'),
      requirements: { type: 'array', minItems: 1, maxItems: 10000, items: missingRequirement },
    }),
  'brisk-aitesting.missing-evidence-output.v1': closed('brisk-aitesting.missing-evidence-output.v1',
    ['acquisition', 'conflictResolution', 'shouldRecompile', 'affectedScenarioIds', 'acquisitionAttempt', 'maxAcquisitionAttempts'], {
      acquisition: acquisitionOutput, conflictResolution: conflictOutput, shouldRecompile: { type: 'boolean' },
      affectedScenarioIds: { type: 'array', uniqueItems: true, items: identifier },
      acquisitionAttempt: { type: 'integer', minimum: 1, maximum: 100 }, maxAcquisitionAttempts: { type: 'integer', minimum: 1, maximum: 100 },
    }),
} as const;

export type PipelineStagePayloadSchemaVersion = keyof typeof pipelineStagePayloadJsonSchemas;

const ajv = new Ajv({ allErrors: true, strict: true });
const applyFormats = addFormats as unknown as (instance: Ajv, formats: string[]) => Ajv;
// REG-0001 applies to every schema registry: a format annotation must never be
// confused with validation. Register the maintained URI implementation.
applyFormats(ajv, ['uri', 'date-time']);
const validators = new Map(Object.entries(pipelineStagePayloadJsonSchemas).map(([version, schema]) => [version, ajv.compile(schema)]));

export function validatePipelineStagePayloadJsonContract(value: unknown): readonly ValidationIssue[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [issue('/', 'Stage payload must be an object.')];
  const version = (value as { readonly schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'string') return [issue('/schemaVersion', 'Stage payload must declare schemaVersion.')];
  const validate = validators.get(version);
  if (validate === undefined) return [issue('/schemaVersion', `Unsupported pipeline stage payload schema ${version}.`, 'UNSUPPORTED_PIPELINE_STAGE_CONTRACT')];
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error: ErrorObject) => issue(error.instancePath || '/', error.message ?? 'Stage payload validation failed.'));
}

function issue(path: string, message: string, code = 'INVALID_PIPELINE_STAGE_CONTRACT'): ValidationIssue {
  return { severity: 'error', path: `stagePayload${path}`, code, message };
}
