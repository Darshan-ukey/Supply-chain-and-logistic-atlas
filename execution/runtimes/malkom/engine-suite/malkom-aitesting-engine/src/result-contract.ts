import { Ajv, type ErrorObject } from 'ajv';
import type { ValidationIssue } from './types.js';

const ajv = new Ajv({ allErrors: true, strict: false });

export const resultJsonSchema = {
  $id: 'brisk-aitesting.result.v1',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'runId', 'status', 'verdict', 'outcome', 'app', 'goal', 'discovery', 'plan', 'summary', 'tests', 'operations', 'artifacts', 'diagnosis', 'handover'],
  properties: {
    schemaVersion: { const: 'brisk-aitesting.result.v1' },
    runId: { type: 'string', minLength: 1 },
    status: { enum: ['passed', 'failed', 'error', 'skipped', 'blocked'] },
    verdict: { enum: ['passed', 'failed', 'not_run'] },
    outcome: {
      type: 'object',
      additionalProperties: false,
      required: ['schemaVersion', 'status', 'terminalStage', 'acceptedTests', 'issues'],
      properties: {
        schemaVersion: { const: 'brisk-aitesting.run-outcome.v1' },
        status: { enum: ['completed', 'completed_with_diagnostics', 'recovered'] },
        terminalStage: { const: 'completed' },
        acceptedTests: { type: 'integer', minimum: 0 },
        journalPath: { type: 'string' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['category', 'stage', 'code', 'message', 'recoverable'],
            properties: {
              category: { enum: ['input', 'discovery', 'planning', 'validation', 'dependency', 'precondition', 'engine_internal', 'timeout', 'network', 'cleanup', 'reporting', 'persistence', 'interrupted'] },
              stage: { enum: ['accepted', 'discovery', 'planning', 'validation', 'grounding', 'execution', 'cleanup', 'reporting', 'persistence', 'completed'] },
              code: { type: 'string', minLength: 1 },
              message: { type: 'string', minLength: 1 },
              recoverable: { type: 'boolean' },
              scenarioId: { type: 'string' },
            },
          },
        },
      },
    },
    app: { type: 'object' },
    goal: { type: 'string', minLength: 1 },
    discovery: { type: 'object' },
    plan: { type: 'object' },
    summary: {
      type: 'object',
      required: ['total', 'passed', 'failed', 'skipped', 'blocked', 'errors', 'passRate', 'durationMs'],
      properties: {
        total: { type: 'integer', minimum: 0 },
        passed: { type: 'integer', minimum: 0 },
        failed: { type: 'integer', minimum: 0 },
        skipped: { type: 'integer', minimum: 0 },
        blocked: { type: 'integer', minimum: 0 },
        errors: { type: 'integer', minimum: 0 },
        passRate: { type: 'number', minimum: 0, maximum: 100 },
        durationMs: { type: 'number', minimum: 0 },
      },
    },
    timings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['stage', 'ms'],
        properties: {
          stage: { type: 'string', minLength: 1 },
          ms: { type: 'number', minimum: 0 },
          detail: { type: 'string' },
        },
      },
    },
    ai: {
      type: 'object',
      required: ['schemaVersion', 'provider', 'calls', 'errors', 'records'],
      properties: {
        schemaVersion: { const: 'brisk-aitesting.ai-usage.v1' },
        provider: { type: 'string', minLength: 1 },
        model: { type: 'string' },
        calls: { type: 'integer', minimum: 0 },
        errors: { type: 'integer', minimum: 0 },
        inputTokens: { type: 'integer', minimum: 0 },
        outputTokens: { type: 'integer', minimum: 0 },
        records: { type: 'array' },
      },
    },
    checks: {
      type: 'object',
      required: ['schemaVersion', 'understood', 'ready', 'notReady'],
      properties: {
        schemaVersion: { const: 'brisk-aitesting.check-accounting.v1' },
        requested: { type: 'integer', minimum: 0 },
        understood: { type: 'integer', minimum: 0 },
        ready: { type: 'integer', minimum: 0 },
        notReady: {
          type: 'array',
          items: {
            type: 'object',
            required: ['checkId', 'status', 'reasons'],
            properties: {
              checkId: { type: 'string', minLength: 1 },
              name: { type: 'string' },
              status: { enum: ['ambiguous', 'unsupported', 'needs-evidence', 'not-ready'] },
              reasons: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    tests: {
      type: 'array',
      items: { $ref: '#/$defs/scenarioResult' },
    },
    operations: {
      type: 'array',
      items: { $ref: '#/$defs/scenarioResult' },
    },
    artifacts: {
      type: 'array',
      items: { $ref: '#/$defs/artifact' },
    },
    diagnosis: {
      type: 'array',
      items: {
        type: 'object',
        required: ['reason', 'suggestedFixes'],
        properties: {
          scenarioId: { type: 'string' },
          reason: { type: 'string' },
          suggestedFixes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    handover: { type: 'object' },
  },
  $defs: {
    scenarioResult: {
      type: 'object',
      additionalProperties: false,
      required: ['scenarioId', 'name', 'type', 'engine', 'status', 'durationMs', 'assertions', 'artifacts', 'diagnostics'],
      properties: {
        scenarioId: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        type: { enum: ['ui', 'api', 'contract', 'schema', 'replay', 'message', 'custom'] },
        engine: { type: 'string', minLength: 1 },
        status: { enum: ['passed', 'failed', 'error', 'skipped', 'blocked'] },
        durationMs: { type: 'number', minimum: 0 },
        assertions: { type: 'array' },
        artifacts: { type: 'array' },
        diagnostics: { type: 'array', items: { type: 'string' } },
        failureCategory: { enum: ['application_assertion', 'dependency', 'precondition', 'engine_internal', 'timeout', 'network'] },
        failureReason: { type: 'string' },
      },
    },
    artifact: {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'label'],
      properties: {
        kind: { enum: ['json', 'junit', 'html', 'trace', 'screenshot', 'video', 'test-file', 'log', 'other'] },
        path: { type: 'string' },
        url: { type: 'string' },
        label: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
  },
} as const;

export const handoverJsonSchema = {
  $id: 'brisk-aitesting.handover.v1',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'generatedAt', 'resultSchema', 'storage', 'consumers'],
  properties: {
    schemaVersion: { const: 'brisk-aitesting.handover.v1' },
    generatedAt: { type: 'string', minLength: 1 },
    resultSchema: { const: 'brisk-aitesting.result.v1' },
    storage: {
      type: 'object',
      additionalProperties: false,
      required: ['required', 'recommendedKeys', 'artifactRoot'],
      properties: {
        required: { const: false },
        recommendedKeys: { type: 'array', items: { type: 'string' } },
        artifactRoot: { type: 'string' },
      },
    },
    consumers: {
      type: 'object',
      additionalProperties: false,
      required: ['database', 'ci', 'dashboard'],
      properties: {
        database: { type: 'string' },
        ci: { type: 'string' },
        dashboard: { type: 'string' },
      },
    },
  },
} as const;

const validateResult = ajv.compile(resultJsonSchema);
const validateHandover = ajv.compile(handoverJsonSchema);

export function validateResultJsonContract(value: unknown): readonly ValidationIssue[] {
  return validateWith(validateResult(value) === true, validateResult.errors ?? [], 'result');
}

export function validateHandoverJsonContract(value: unknown): readonly ValidationIssue[] {
  return validateWith(validateHandover(value) === true, validateHandover.errors ?? [], 'handover');
}

function validateWith(valid: boolean, errors: ErrorObject[], root: string): readonly ValidationIssue[] {
  if (valid) return [];
  return errors.map((error) => ({
    severity: 'error',
    path: jsonPointerToPath(root, error.instancePath),
    code: `JSON_CONTRACT_${error.keyword.toUpperCase()}`,
    message: `${root} contract violation: ${error.message ?? error.keyword}.`,
  }));
}

function jsonPointerToPath(root: string, pointer: string): string {
  if (pointer.length === 0) return root;
  return `${root}.${pointer.split('/').slice(1).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~')).join('.')}`;
}
