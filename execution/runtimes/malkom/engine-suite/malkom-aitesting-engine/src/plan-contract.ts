import { Ajv, type ErrorObject } from 'ajv';
import type { ValidationIssue } from './types.js';

const ajv = new Ajv({ allErrors: true, strict: false });

export const planJsonSchema = {
  $id: 'brisk-aitesting.plan.v1',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'runId', 'goal', 'mode', 'scenarios', 'discovery', 'warnings', 'createdAt'],
  properties: {
    schemaVersion: { const: 'brisk-aitesting.plan.v1' },
    runId: { type: 'string', minLength: 1 },
    goal: { type: 'string', minLength: 1 },
    mode: { enum: ['automatic', 'ui', 'api', 'contract', 'schema', 'replay', 'message', 'custom'] },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    droppedScenarios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'reasons'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          reasons: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        },
      },
    },
    evidenceDecisions: {
      type: 'array',
      items: { $ref: '#/$defs/evidenceDecision' },
    },
    fixtureProvisioning: {
      type: 'array',
      items: { $ref: '#/$defs/fixtureProvisioningRecord' },
    },
    createdAt: { type: 'string', minLength: 1 },
    counts: {
      type: 'object',
      additionalProperties: false,
      required: ['checks', 'executableSteps'],
      properties: {
        requested: { type: 'integer', minimum: 0 },
        checks: { type: 'integer', minimum: 0 },
        executableSteps: { type: 'integer', minimum: 0 },
      },
    },
    discovery: {
      type: 'object',
      additionalProperties: true,
      required: ['schemaVersion', 'app', 'uiRoutes', 'apiRoutes', 'contracts', 'repoSignals', 'warnings', 'createdAt'],
      properties: {
        schemaVersion: { const: 'brisk-aitesting.discovery.v1' },
        app: { type: 'object' },
        uiRoutes: { type: 'array' },
        apiRoutes: { type: 'array' },
        contracts: { type: 'array' },
        repoSignals: { type: 'array' },
        warnings: { type: 'array', items: { type: 'string' } },
        createdAt: { type: 'string' },
      },
    },
    scenarios: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/$defs/scenario' },
    },
  },
  $defs: {
    evidenceDecision: {
      type: 'object',
      additionalProperties: false,
      required: [
        'schemaVersion', 'id', 'round', 'outcome', 'reasonCode', 'explanation',
        'requirementIds', 'affectedScenarioIds', 'recompiledScenarioIds', 'preservedScenarioIds',
        'attemptedProviderIds', 'cacheHitProviderIds', 'acquiredGraphRevisions', 'conflictIds',
        'diagnosticCodes', 'beforeEvidenceRevision', 'afterEvidenceRevision', 'beforeEvidenceDigest',
        'afterEvidenceDigest', 'authorityPolicyDigest', 'compilationStatus',
      ],
      properties: {
        schemaVersion: { const: 'brisk-aitesting.acquisition-recompilation-decision.v1' },
        id: { type: 'string', pattern: '^decision_[a-f0-9]{24}$' },
        round: { type: 'integer', minimum: 0 },
        outcome: { enum: ['recompiled', 'completed', 'stopped'] },
        reasonCode: { enum: ['EVIDENCE_ACQUIRED', 'NO_ACQUIRABLE_REQUIREMENT', 'NO_ELIGIBLE_PROVIDER', 'NO_USABLE_EVIDENCE', 'IRRELEVANT_EVIDENCE', 'CONTRADICTORY_EVIDENCE', 'MAX_ROUNDS_REACHED'] },
        explanation: { type: 'string', minLength: 1 },
        requirementIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        affectedScenarioIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        recompiledScenarioIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        preservedScenarioIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        attemptedProviderIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        cacheHitProviderIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        acquiredGraphRevisions: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        conflictIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        diagnosticCodes: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
        beforeEvidenceRevision: { type: 'string', minLength: 1 },
        afterEvidenceRevision: { type: 'string', minLength: 1 },
        beforeEvidenceDigest: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
        afterEvidenceDigest: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
        authorityPolicyDigest: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
        compilationStatus: { enum: ['compiled', 'needs-evidence', 'ambiguous', 'unsupported'] },
      },
    },
    fixtureProvisioningRecord: {
      type: 'object',
      additionalProperties: false,
      required: ['schemaVersion', 'id', 'scenarioId', 'semanticType', 'policy', 'outcome', 'explanation'],
      properties: {
        schemaVersion: { const: 'brisk-aitesting.fixture-provisioning.v1' },
        id: { type: 'string', pattern: '^fixture_[a-f0-9]{24}$' },
        scenarioId: { type: 'string', minLength: 1 },
        semanticType: { type: 'string', minLength: 1 },
        policy: { enum: ['provision-when-missing', 'require-existing'] },
        outcome: { enum: ['provisioned', 'existing-data', 'empty-requires-existing-data', 'no-cleanup-safe-producer', 'unverified'] },
        explanation: { type: 'string', minLength: 1 },
        sourceOperationId: { type: 'string', minLength: 1 },
        producerOperationId: { type: 'string', minLength: 1 },
        cleanupOperationId: { type: 'string', minLength: 1 },
        probe: {
          type: 'object',
          additionalProperties: false,
          required: ['method', 'path', 'status', 'checkedAt'],
          properties: {
            method: { type: 'string', minLength: 1 },
            path: { type: 'string', pattern: '^/' },
            status: { enum: ['empty', 'populated', 'unknown'] },
            httpStatus: { type: 'integer', minimum: 100, maximum: 599 },
            checkedAt: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    scenario: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'type', 'objective', 'assertions', 'evidenceRequired'],
      properties: {
        id: { type: 'string', minLength: 1, pattern: '^[A-Za-z_$][A-Za-z0-9_$-]*$' },
        name: { type: 'string', minLength: 1 },
        type: { enum: ['ui', 'api', 'contract', 'schema', 'replay', 'message', 'custom'] },
        objective: { type: 'string', minLength: 1 },
        target: {
          type: 'object',
          additionalProperties: false,
          properties: {
            method: { type: 'string' },
            path: { type: 'string' },
            route: { type: 'string' },
            schema: { type: 'string' },
            channel: { type: 'string' },
            sourceOfTruth: { enum: ['user', 'observed', 'contract', 'ai', 'fallback'] },
          },
        },
        request: {
          type: 'object',
          additionalProperties: false,
          properties: {
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
            query: {
              type: 'object',
              additionalProperties: {
                anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
              },
            },
            body: {},
          },
        },
        expect: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: {
              anyOf: [
                { type: 'integer', minimum: 100, maximum: 599 },
                {
                  type: 'array',
                  minItems: 1,
                  items: { type: 'integer', minimum: 100, maximum: 599 },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    min: { type: 'integer', minimum: 100, maximum: 599 },
                    max: { type: 'integer', minimum: 100, maximum: 599 },
                  },
                },
              ],
            },
            json: { type: 'object' },
            contains: { type: 'string' },
            unchanged: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/$defs/apiStateSnapshotExpectation' },
            },
          },
        },
        assertions: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
        dependsOn: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
        capture: {
          type: 'array',
          items: { $ref: '#/$defs/workflowCapture' },
        },
        cleanup: {
          type: 'array',
          items: { $ref: '#/$defs/apiCleanupStep' },
        },
        uiActions: {
          type: 'array',
          items: { $ref: '#/$defs/uiAction' },
        },
        evidenceRequired: {
          type: 'array',
          minItems: 1,
          items: { enum: ['repo', 'ui', 'api', 'schema', 'auth', 'message'] },
        },
        metadata: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    workflowCapture: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'from', 'path'],
      properties: {
        name: { type: 'string', minLength: 1, pattern: '^[A-Za-z_$][A-Za-z0-9_$-]*(\\.[A-Za-z_$][A-Za-z0-9_$-]*)?$' },
        from: { enum: ['response.body', 'response.header'] },
        path: { type: 'string', minLength: 1 },
      },
    },
    apiCleanupStep: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'target'],
      properties: {
        type: { const: 'api' },
        target: {
          type: 'object',
          additionalProperties: false,
          required: ['method', 'path'],
          properties: {
            method: { enum: ['DELETE', 'POST'] },
            path: { type: 'string', pattern: '^/' },
          },
        },
        request: {
          type: 'object',
          additionalProperties: false,
          properties: {
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
            query: {
              type: 'object',
              additionalProperties: {
                anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
              },
            },
            body: {},
          },
        },
        expect: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: {
              anyOf: [
                { type: 'integer', minimum: 100, maximum: 599 },
                {
                  type: 'array',
                  minItems: 1,
                  items: { type: 'integer', minimum: 100, maximum: 599 },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    min: { type: 'integer', minimum: 100, maximum: 599 },
                    max: { type: 'integer', minimum: 100, maximum: 599 },
                  },
                },
              ],
            },
          },
        },
      },
    },
    apiStateSnapshotExpectation: {
      type: 'object',
      additionalProperties: false,
      required: ['target'],
      properties: {
        name: { type: 'string', minLength: 1 },
        target: {
          type: 'object',
          additionalProperties: false,
          required: ['path'],
          properties: {
            method: { type: 'string', minLength: 1 },
            path: { type: 'string', pattern: '^/' },
          },
        },
        request: {
          type: 'object',
          additionalProperties: false,
          properties: {
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
            query: {
              type: 'object',
              additionalProperties: {
                anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
              },
            },
            body: {},
          },
        },
        json: { type: 'object' },
      },
    },
    uiAction: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'evidenceId'],
      properties: {
        action: { enum: ['fill', 'click', 'check', 'select', 'press', 'assertText'] },
        evidenceId: { type: 'string', pattern: '^ui_el_\\d{3,}$' },
        value: { type: 'string' },
        key: { type: 'string' },
        text: { type: 'string' },
        description: { type: 'string' },
      },
      allOf: [
        {
          if: { properties: { action: { enum: ['fill', 'select'] } }, required: ['action'] },
          then: { required: ['value'] },
        },
        {
          if: { properties: { action: { const: 'press' } }, required: ['action'] },
          then: { required: ['key'] },
        },
        {
          if: { properties: { action: { const: 'assertText' } }, required: ['action'] },
          then: { required: ['text'] },
        },
      ],
    },
  },
} as const;

const validatePlan = ajv.compile(planJsonSchema);

export function validatePlanJsonContract(value: unknown): readonly ValidationIssue[] {
  const valid = validatePlan(value) === true;
  if (valid) return [];
  return (validatePlan.errors ?? []).map(toIssue);
}

function toIssue(error: ErrorObject): ValidationIssue {
  const path = jsonPointerToPlanPath(error.instancePath);
  if (error.keyword === 'additionalProperties') {
    const property = typeof error.params.additionalProperty === 'string' ? error.params.additionalProperty : 'unknown';
    return {
      severity: 'error',
      path: `${path}.${property}`,
      code: 'PLAN_CONTRACT_UNRECOGNIZED_KEY',
      message: `Plan contract does not allow "${property}" at ${path}.`,
    };
  }
  if (error.keyword === 'required') {
    const missing = typeof error.params.missingProperty === 'string' ? error.params.missingProperty : 'unknown';
    return {
      severity: 'error',
      path: `${path}.${missing}`,
      code: 'PLAN_CONTRACT_REQUIRED',
      message: `Plan contract requires "${missing}" at ${path}.`,
    };
  }
  if (error.keyword === 'enum' || error.keyword === 'const') {
    return {
      severity: 'error',
      path,
      code: 'PLAN_CONTRACT_INVALID_VALUE',
      message: `Plan contract received an unsupported value at ${path}.`,
    };
  }
  return {
    severity: 'error',
    path,
    code: 'PLAN_CONTRACT_INVALID_SHAPE',
    message: `Plan contract violation at ${path}: ${error.message ?? error.keyword}.`,
  };
}

function jsonPointerToPlanPath(pointer: string): string {
  if (pointer.length === 0) return 'plan';
  const parts = pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  return `plan.${parts.join('.')}`;
}
