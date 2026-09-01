import { Ajv, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidationIssue } from './types.js';

export interface RealValidationBucketRequirementV1 {
  readonly id: string;
  readonly name: string;
  readonly requiredScenarios: number;
}

export interface RealValidationApplicationRequirementV1 {
  readonly id: string;
  readonly name: string;
  readonly requiredScenarios: number;
  readonly buckets: readonly RealValidationBucketRequirementV1[];
}

export interface RealValidationCountsV1 {
  readonly proposed: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly compiled: number;
  readonly executed: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly errors: number;
  readonly cleaned: number;
  readonly residual: number;
}

export interface RealValidationScenarioProofV1 {
  readonly proofClass: 'real-ai';
  readonly runId: string;
  readonly ai: {
    readonly provider: string;
    readonly model: string;
    readonly requestDigest: string;
    readonly responseDigest: string;
    readonly responseAccepted: true;
    readonly fixture: false;
    readonly tokenRecord: { readonly availability: 'known'; readonly input: number; readonly output: number; readonly total: number }
      | { readonly availability: 'not-returned'; readonly reason: string };
  };
  readonly product: {
    readonly version: string;
    readonly packageDigest: string;
    readonly load: 'clean-installed-package';
  };
  readonly connectedOperations: number;
  readonly mutated: boolean;
  readonly cleanupOutcome: 'clean' | 'not-required';
  readonly counts: RealValidationCountsV1;
  readonly evidenceDigests: readonly string[];
  readonly durationMs: number;
}

export interface RealValidationScenarioV1 {
  readonly id: string;
  readonly applicationId: string;
  readonly bucketId: string;
  readonly title: string;
  readonly businessRisk: string;
  readonly surfaces: readonly string[];
  readonly status: 'planned' | 'counted';
  readonly proof?: RealValidationScenarioProofV1;
}

export interface RealValidationManifestV1 {
  readonly schemaVersion: 'brisk-aitesting.real-validation-manifest.v1';
  readonly corpusVersion: string;
  readonly productVersion: string;
  readonly generatedAt: string;
  readonly requiredTotal: number;
  readonly acceptedScenarioCount: number;
  readonly applications: readonly RealValidationApplicationRequirementV1[];
  readonly scenarios: readonly RealValidationScenarioV1[];
  readonly excludedEvidence: readonly {
    readonly id: string;
    readonly applicationId: string;
    readonly reasonCode: string;
    readonly reason: string;
    readonly references: readonly string[];
  }[];
}

export interface RealValidationBenchmarkSampleV1 {
  readonly schemaVersion: 'brisk-aitesting.real-validation-sample.v1';
  readonly sampleId: string;
  readonly corpusVersion: string;
  readonly productVersion: string;
  readonly applicationId: string;
  readonly scenarioIds: readonly string[];
  readonly mode: 'cold' | 'warm' | 'load' | 'stress' | 'soak' | 'interruption';
  readonly concurrency: number;
  readonly repetition: number;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly identity: {
    readonly machineDigest: string;
    readonly runtime: string;
    readonly applicationVersion: string;
    readonly provider: string;
    readonly model: string;
    readonly configurationDigest: string;
  };
  readonly stages: readonly { readonly name: string; readonly durationMs: number; readonly providerWaitMs: number }[];
  readonly resources: {
    readonly cpuUserMicros: number;
    readonly cpuSystemMicros: number;
    readonly normalizedCpuPercent: number;
    readonly rssBaselineBytes: number;
    readonly rssMedianBytes: number;
    readonly rssP95Bytes: number;
    readonly rssPeakBytes: number;
    readonly eventLoopDelayP95Ms: number;
    readonly activeHandlesPeak: number;
    readonly openFilesPeak: number;
    readonly openSocketsPeak: number;
    readonly childProcessesPeak: number;
  };
  readonly inspection: {
    readonly enumeratedFiles: number;
    readonly openedFiles: number;
    readonly parsedFiles: number;
    readonly acceptedFiles: number;
    readonly rejectedFiles: number;
    readonly excludedFiles: number;
    readonly bytesRead: number;
    readonly routesOrOperations: number;
    readonly graphNodes: number;
    readonly graphEdges: number;
    readonly conflicts: number;
    readonly unresolvedFacts: number;
  };
  readonly ai: {
    readonly requests: number;
    readonly retries: number;
    readonly timeouts: number;
    readonly cancellations: number;
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
    readonly cost: number | null;
    readonly unavailableReason: string | null;
  };
  readonly execution: RealValidationCountsV1 & { readonly operationsPerSecond: number };
  readonly artifacts: { readonly files: number; readonly bytes: number };
  readonly database: { readonly created: number; readonly cleaned: number; readonly residual: number };
  readonly outcome: 'passed' | 'failed' | 'cancelled' | 'interrupted';
  readonly exclusions: readonly string[];
  readonly evidenceDigests: readonly string[];
}

const digest = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' } as const;
const id = { type: 'string', minLength: 1, maxLength: 256, pattern: '^[a-z0-9][a-z0-9._-]*$' } as const;
const text = { type: 'string', minLength: 1, maxLength: 8192 } as const;
const count = { type: 'integer', minimum: 0 } as const;
const metric = { type: 'number', minimum: 0 } as const;
const counts = {
  type: 'object', additionalProperties: false,
  required: ['proposed', 'accepted', 'rejected', 'compiled', 'executed', 'passed', 'failed', 'skipped', 'errors', 'cleaned', 'residual'],
  properties: { proposed: count, accepted: count, rejected: count, compiled: count, executed: count, passed: count, failed: count, skipped: count, errors: count, cleaned: count, residual: count },
} as const;

const scenarioProof = {
  type: 'object', additionalProperties: false,
  required: ['proofClass', 'runId', 'ai', 'product', 'connectedOperations', 'mutated', 'cleanupOutcome', 'counts', 'evidenceDigests', 'durationMs'],
  properties: {
    proofClass: { const: 'real-ai' }, runId: id,
    ai: {
      type: 'object', additionalProperties: false,
      required: ['provider', 'model', 'requestDigest', 'responseDigest', 'responseAccepted', 'fixture', 'tokenRecord'],
      properties: {
        provider: text, model: text, requestDigest: digest, responseDigest: digest,
        responseAccepted: { const: true }, fixture: { const: false },
        tokenRecord: {
          oneOf: [
            { type: 'object', additionalProperties: false, required: ['availability', 'input', 'output', 'total'], properties: { availability: { const: 'known' }, input: count, output: count, total: count } },
            { type: 'object', additionalProperties: false, required: ['availability', 'reason'], properties: { availability: { const: 'not-returned' }, reason: text } },
          ],
        },
      },
    },
    product: {
      type: 'object', additionalProperties: false, required: ['version', 'packageDigest', 'load'],
      properties: { version: text, packageDigest: digest, load: { const: 'clean-installed-package' } },
    },
    connectedOperations: { type: 'integer', minimum: 3 }, mutated: { type: 'boolean' },
    cleanupOutcome: { enum: ['clean', 'not-required'] }, counts,
    evidenceDigests: { type: 'array', minItems: 1, uniqueItems: true, items: digest },
    durationMs: metric,
  },
} as const;

export const realValidationManifestJsonSchema = {
  $id: 'brisk-aitesting.real-validation-manifest.v1', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'corpusVersion', 'productVersion', 'generatedAt', 'requiredTotal', 'acceptedScenarioCount', 'applications', 'scenarios', 'excludedEvidence'],
  properties: {
    schemaVersion: { const: 'brisk-aitesting.real-validation-manifest.v1' }, corpusVersion: id, productVersion: text,
    generatedAt: { type: 'string', format: 'date-time' }, requiredTotal: { type: 'integer', minimum: 1 }, acceptedScenarioCount: count,
    applications: { type: 'array', minItems: 1, items: {
      type: 'object', additionalProperties: false, required: ['id', 'name', 'requiredScenarios', 'buckets'],
      properties: { id, name: text, requiredScenarios: { type: 'integer', minimum: 1 }, buckets: { type: 'array', minItems: 1, items: {
        type: 'object', additionalProperties: false, required: ['id', 'name', 'requiredScenarios'],
        properties: { id, name: text, requiredScenarios: { type: 'integer', minimum: 1 } },
      } } },
    } },
    scenarios: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['id', 'applicationId', 'bucketId', 'title', 'businessRisk', 'surfaces', 'status'],
      properties: { id, applicationId: id, bucketId: id, title: text, businessRisk: text, surfaces: { type: 'array', minItems: 1, uniqueItems: true, items: id }, status: { enum: ['planned', 'counted'] }, proof: scenarioProof },
    } },
    excludedEvidence: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['id', 'applicationId', 'reasonCode', 'reason', 'references'],
      properties: { id, applicationId: id, reasonCode: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,127}$' }, reason: text, references: { type: 'array', minItems: 1, uniqueItems: true, items: text } },
    } },
  },
} as const;

export const realValidationBenchmarkSampleJsonSchema = {
  $id: 'brisk-aitesting.real-validation-sample.v1', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'sampleId', 'corpusVersion', 'productVersion', 'applicationId', 'scenarioIds', 'mode', 'concurrency', 'repetition', 'startedAt', 'durationMs', 'identity', 'stages', 'resources', 'inspection', 'ai', 'execution', 'artifacts', 'database', 'outcome', 'exclusions', 'evidenceDigests'],
  properties: {
    schemaVersion: { const: 'brisk-aitesting.real-validation-sample.v1' }, sampleId: id, corpusVersion: id, productVersion: text, applicationId: id,
    scenarioIds: { type: 'array', uniqueItems: true, items: id }, mode: { enum: ['cold', 'warm', 'load', 'stress', 'soak', 'interruption'] },
    concurrency: { type: 'integer', minimum: 1 }, repetition: { type: 'integer', minimum: 1 }, startedAt: { type: 'string', format: 'date-time' }, durationMs: metric,
    identity: { type: 'object', additionalProperties: false, required: ['machineDigest', 'runtime', 'applicationVersion', 'provider', 'model', 'configurationDigest'], properties: { machineDigest: digest, runtime: text, applicationVersion: text, provider: text, model: text, configurationDigest: digest } },
    stages: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['name', 'durationMs', 'providerWaitMs'], properties: { name: id, durationMs: metric, providerWaitMs: metric } } },
    resources: { type: 'object', additionalProperties: false, required: ['cpuUserMicros', 'cpuSystemMicros', 'normalizedCpuPercent', 'rssBaselineBytes', 'rssMedianBytes', 'rssP95Bytes', 'rssPeakBytes', 'eventLoopDelayP95Ms', 'activeHandlesPeak', 'openFilesPeak', 'openSocketsPeak', 'childProcessesPeak'], properties: { cpuUserMicros: metric, cpuSystemMicros: metric, normalizedCpuPercent: metric, rssBaselineBytes: count, rssMedianBytes: count, rssP95Bytes: count, rssPeakBytes: count, eventLoopDelayP95Ms: metric, activeHandlesPeak: count, openFilesPeak: count, openSocketsPeak: count, childProcessesPeak: count } },
    inspection: { type: 'object', additionalProperties: false, required: ['enumeratedFiles', 'openedFiles', 'parsedFiles', 'acceptedFiles', 'rejectedFiles', 'excludedFiles', 'bytesRead', 'routesOrOperations', 'graphNodes', 'graphEdges', 'conflicts', 'unresolvedFacts'], properties: { enumeratedFiles: count, openedFiles: count, parsedFiles: count, acceptedFiles: count, rejectedFiles: count, excludedFiles: count, bytesRead: count, routesOrOperations: count, graphNodes: count, graphEdges: count, conflicts: count, unresolvedFacts: count } },
    ai: { type: 'object', additionalProperties: false, required: ['requests', 'retries', 'timeouts', 'cancellations', 'inputTokens', 'outputTokens', 'cost', 'unavailableReason'], properties: { requests: count, retries: count, timeouts: count, cancellations: count, inputTokens: { type: ['integer', 'null'], minimum: 0 }, outputTokens: { type: ['integer', 'null'], minimum: 0 }, cost: { type: ['number', 'null'], minimum: 0 }, unavailableReason: { type: ['string', 'null'], minLength: 1 } } },
    execution: { ...counts, properties: { ...counts.properties, operationsPerSecond: metric }, required: [...counts.required, 'operationsPerSecond'] },
    artifacts: { type: 'object', additionalProperties: false, required: ['files', 'bytes'], properties: { files: count, bytes: count } },
    database: { type: 'object', additionalProperties: false, required: ['created', 'cleaned', 'residual'], properties: { created: count, cleaned: count, residual: count } },
    outcome: { enum: ['passed', 'failed', 'cancelled', 'interrupted'] }, exclusions: { type: 'array', uniqueItems: true, items: text }, evidenceDigests: { type: 'array', minItems: 1, uniqueItems: true, items: digest },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const applyFormats = addFormats as unknown as (instance: Ajv, formats: string[]) => Ajv;
applyFormats(ajv, ['date-time']);
const validateManifestSchema = ajv.compile(realValidationManifestJsonSchema);
const validateSampleSchema = ajv.compile(realValidationBenchmarkSampleJsonSchema);

export function validateRealValidationManifest(value: unknown): readonly ValidationIssue[] {
  if (!validateManifestSchema(value)) return schemaIssues(validateManifestSchema.errors ?? [], 'manifest');
  const manifest = value as RealValidationManifestV1;
  const issues: ValidationIssue[] = [];
  const applicationIds = new Set<string>();
  let requiredTotal = 0;
  const buckets = new Map<string, Set<string>>();
  for (const application of manifest.applications) {
    if (applicationIds.has(application.id)) issues.push(issue(`manifest.applications.${application.id}`, 'DUPLICATE_APPLICATION', 'Application IDs must be unique.'));
    applicationIds.add(application.id);
    requiredTotal += application.requiredScenarios;
    const bucketIds = new Set<string>();
    let bucketTotal = 0;
    for (const bucket of application.buckets) {
      if (bucketIds.has(bucket.id)) issues.push(issue(`manifest.applications.${application.id}.buckets.${bucket.id}`, 'DUPLICATE_BUCKET', 'Bucket IDs must be unique within an application.'));
      bucketIds.add(bucket.id);
      bucketTotal += bucket.requiredScenarios;
    }
    if (bucketTotal !== application.requiredScenarios) issues.push(issue(`manifest.applications.${application.id}.requiredScenarios`, 'BUCKET_TOTAL_MISMATCH', `Bucket total ${bucketTotal} does not equal application total ${application.requiredScenarios}.`));
    buckets.set(application.id, bucketIds);
  }
  if (requiredTotal !== manifest.requiredTotal) issues.push(issue('manifest.requiredTotal', 'CORPUS_TOTAL_MISMATCH', `Application total ${requiredTotal} does not equal requiredTotal ${manifest.requiredTotal}.`));

  const scenarioIds = new Set<string>();
  let counted = 0;
  for (const scenario of manifest.scenarios) {
    if (scenarioIds.has(scenario.id)) issues.push(issue(`manifest.scenarios.${scenario.id}`, 'DUPLICATE_SCENARIO', 'Scenario IDs must be unique.'));
    scenarioIds.add(scenario.id);
    if (!applicationIds.has(scenario.applicationId)) issues.push(issue(`manifest.scenarios.${scenario.id}.applicationId`, 'UNKNOWN_APPLICATION', 'Scenario application must exist in the manifest.'));
    if (!buckets.get(scenario.applicationId)?.has(scenario.bucketId)) issues.push(issue(`manifest.scenarios.${scenario.id}.bucketId`, 'UNKNOWN_BUCKET', 'Scenario bucket must exist in its application.'));
    if (scenario.status !== 'counted') {
      if (scenario.proof !== undefined) issues.push(issue(`manifest.scenarios.${scenario.id}.proof`, 'UNCOUNTED_PROOF', 'A planned scenario cannot carry accepted proof.'));
      continue;
    }
    counted += 1;
    if (scenario.proof === undefined) {
      issues.push(issue(`manifest.scenarios.${scenario.id}.proof`, 'COUNTED_PROOF_REQUIRED', 'A counted scenario requires complete proof.'));
      continue;
    }
    issues.push(...validateCountedProof(scenario.id, scenario.proof));
  }
  if (counted !== manifest.acceptedScenarioCount) issues.push(issue('manifest.acceptedScenarioCount', 'ACCEPTED_COUNT_MISMATCH', `Found ${counted} counted scenarios but acceptedScenarioCount is ${manifest.acceptedScenarioCount}.`));
  if (counted > manifest.requiredTotal) issues.push(issue('manifest.acceptedScenarioCount', 'ACCEPTED_COUNT_EXCEEDS_REQUIRED', 'Accepted count cannot exceed the required corpus total.'));
  return issues;
}

export function validateRealValidationBenchmarkSample(value: unknown): readonly ValidationIssue[] {
  if (!validateSampleSchema(value)) return schemaIssues(validateSampleSchema.errors ?? [], 'sample');
  const sample = value as RealValidationBenchmarkSampleV1;
  const issues: ValidationIssue[] = [];
  issues.push(...validateCounts('sample.execution', sample.execution));
  if (!(sample.resources.rssBaselineBytes <= sample.resources.rssMedianBytes && sample.resources.rssMedianBytes <= sample.resources.rssP95Bytes && sample.resources.rssP95Bytes <= sample.resources.rssPeakBytes)) {
    issues.push(issue('sample.resources', 'MEMORY_PERCENTILE_ORDER', 'RSS values must satisfy baseline <= median <= p95 <= peak.'));
  }
  if (sample.inspection.openedFiles > sample.inspection.enumeratedFiles || sample.inspection.parsedFiles > sample.inspection.openedFiles || sample.inspection.acceptedFiles + sample.inspection.rejectedFiles > sample.inspection.parsedFiles) {
    issues.push(issue('sample.inspection', 'INSPECTION_COUNT_ORDER', 'File counts must reflect enumerated, opened, parsed, and accepted/rejected subsets.'));
  }
  if (sample.ai.inputTokens === null || sample.ai.outputTokens === null || sample.ai.cost === null) {
    if (sample.ai.unavailableReason === null) issues.push(issue('sample.ai.unavailableReason', 'AI_METRIC_REASON_REQUIRED', 'Unavailable AI token or cost metrics require a reason.'));
  } else if (sample.ai.unavailableReason !== null) {
    issues.push(issue('sample.ai.unavailableReason', 'AI_METRIC_REASON_UNEXPECTED', 'A reason must be null when all AI metrics are known.'));
  }
  if (sample.database.residual > 0 && sample.outcome === 'passed') issues.push(issue('sample.database.residual', 'PASSED_WITH_RESIDUE', 'A sample with residual database state cannot pass.'));
  if (sample.outcome === 'passed' && (sample.execution.failed > 0 || sample.execution.skipped > 0 || sample.execution.errors > 0)) issues.push(issue('sample.outcome', 'PASSED_WITH_NONPASS', 'A passed sample cannot contain failed, skipped, or errored execution.'));
  return issues;
}

function validateCountedProof(scenarioId: string, proof: RealValidationScenarioProofV1): ValidationIssue[] {
  const root = `manifest.scenarios.${scenarioId}.proof`;
  const issues = [...validateCounts(`${root}.counts`, proof.counts)];
  if (proof.counts.executed !== 1 || proof.counts.passed !== 1 || proof.counts.failed !== 0 || proof.counts.skipped !== 0 || proof.counts.errors !== 0) issues.push(issue(`${root}.counts`, 'COUNTED_SCENARIO_NOT_PASSED', 'A counted scenario must represent exactly one passed logical scenario with no failure, skip, or error.'));
  if (proof.mutated && proof.cleanupOutcome !== 'clean') issues.push(issue(`${root}.cleanupOutcome`, 'MUTATION_NOT_CLEAN', 'A counted mutation requires a clean cleanup outcome.'));
  if (!proof.mutated && proof.cleanupOutcome !== 'not-required') issues.push(issue(`${root}.cleanupOutcome`, 'READ_ONLY_CLEANUP_MISMATCH', 'A read-only scenario must declare cleanup not required.'));
  if (proof.counts.residual !== 0) issues.push(issue(`${root}.counts.residual`, 'COUNTED_RESIDUE', 'A counted scenario must leave zero residual state.'));
  if (proof.ai.tokenRecord.availability === 'known' && proof.ai.tokenRecord.total !== proof.ai.tokenRecord.input + proof.ai.tokenRecord.output) issues.push(issue(`${root}.ai.tokenRecord.total`, 'TOKEN_TOTAL_MISMATCH', 'Token total must equal input plus output.'));
  return issues;
}

function validateCounts(path: string, value: RealValidationCountsV1): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (value.accepted + value.rejected > value.proposed) issues.push(issue(path, 'PROPOSAL_COUNT_MISMATCH', 'Accepted plus rejected cannot exceed proposed.'));
  if (value.compiled > value.accepted) issues.push(issue(path, 'COMPILED_COUNT_MISMATCH', 'Compiled cannot exceed accepted.'));
  if (value.executed !== value.passed + value.failed + value.skipped + value.errors) issues.push(issue(path, 'EXECUTION_COUNT_MISMATCH', 'Executed must equal passed plus failed plus skipped plus errors.'));
  if (value.residual > value.executed + value.cleaned) issues.push(issue(path, 'RESIDUAL_COUNT_IMPOSSIBLE', 'Residual count exceeds executed plus cleaned work.'));
  return issues;
}

function schemaIssues(errors: readonly ErrorObject[], root: string): ValidationIssue[] {
  return errors.map((error) => issue(`${root}${error.instancePath.replaceAll('/', '.')}`, `JSON_CONTRACT_${error.keyword.toUpperCase()}`, `${root} contract violation: ${error.message ?? error.keyword}.`));
}

function issue(path: string, code: string, message: string): ValidationIssue {
  return { severity: 'error', path, code, message };
}
