import type {
  CompilationResult,
  EvidenceAuthority,
  EvidenceConflictRecord,
  EvidenceGraph,
  EvidenceProvenance,
  IntentPlan,
} from './compiler-types.js';
import type {
  ArtifactRef,
  BriskAiTestingConfig,
  BriskAiTestingRunInput,
  ContractConfig,
  DiscoveryResult,
  DiscoveryConfig,
  EngineType,
  PlanningConfig,
} from './types.js';

export interface ApplicationInspectionInputV1 {
  readonly schemaVersion: 'brisk-aitesting.inspection-input.v1';
  readonly app: {
    readonly name: string;
    readonly baseUrl: string;
    readonly repoPath?: string;
  };
  readonly scope: {
    readonly repository: boolean;
    readonly ui: boolean;
    readonly api: boolean;
    readonly contracts: boolean;
  };
  readonly contractPaths: readonly {
    readonly kind: 'openapi' | 'graphql' | 'asyncapi' | 'protobuf' | 'pact' | 'other';
    readonly path: string;
  }[];
  readonly limits: {
    readonly maxSourceFiles: number;
    readonly maxContractBytes: number;
  };
}

export interface ApplicationInspectionOutputV1 {
  readonly schemaVersion: 'brisk-aitesting.inspection-output.v1';
  readonly discovery: DiscoveryResult;
  readonly evidenceGraphs: readonly EvidenceGraph[];
  readonly incompleteScopes: readonly {
    readonly scope: string;
    readonly reasonCode: string;
  }[];
}

export interface MissingEvidenceRequirementV1 {
  readonly id: string;
  readonly semanticType: string;
  readonly reasonCode: string;
  readonly reason: string;
  readonly requiredAuthority: EvidenceProvenance['authority'];
  readonly capability?: string;
  readonly scenarioId?: string;
  readonly actionId?: string;
  readonly operationId?: string;
}

export interface EvidenceAcquisitionInputV1 {
  readonly schemaVersion: 'brisk-aitesting.evidence-acquisition-input.v1';
  readonly currentEvidenceRevision?: string;
  readonly requirements: readonly MissingEvidenceRequirementV1[];
  readonly eligibleProviderIds: readonly string[];
  readonly scope: {
    readonly appName: string;
    readonly repoPath?: string;
    readonly tenantId?: string;
    readonly allowedHosts: readonly string[];
  };
  readonly cachePolicy: 'use-fresh' | 'refresh-stale' | 'bypass';
}

export interface EvidenceProviderAttemptV1 {
  readonly providerId: string;
  readonly status: 'succeeded' | 'completed-with-diagnostics' | 'failed' | 'cancelled' | 'skipped';
  readonly requirementIds: readonly string[];
  readonly graphRevisions: readonly string[];
  readonly cache: 'hit' | 'miss' | 'bypassed' | 'not-applicable';
}

export interface EvidenceAcquisitionOutputV1 {
  readonly schemaVersion: 'brisk-aitesting.evidence-acquisition-output.v1';
  readonly graphs: readonly EvidenceGraph[];
  readonly attempts: readonly EvidenceProviderAttemptV1[];
  readonly satisfiedRequirementIds: readonly string[];
  readonly unsatisfiedRequirementIds: readonly string[];
  readonly artifacts: readonly ArtifactRef[];
}

export interface EvidenceProviderContextV1 {
  readonly config: BriskAiTestingConfig;
  readonly input: BriskAiTestingRunInput;
  readonly discovery: DiscoveryResult;
  readonly runId: string;
  readonly intent: IntentPlan;
  readonly currentEvidence: EvidenceGraph;
  readonly signal: AbortSignal;
}

export interface EvidenceProviderSafeConfigV2 {
  readonly app: BriskAiTestingConfig['app'];
  readonly planning?: PlanningConfig;
  readonly contracts?: ContractConfig;
  readonly runtime: Pick<BriskAiTestingConfig['runtime'], 'artifactsDir' | 'timeoutMs' | 'dryRun'>;
  readonly discovery: DiscoveryConfig;
  readonly security: Pick<BriskAiTestingConfig['security'], 'networkPolicy' | 'allowedHosts' | 'redactSecrets' | 'strictMode'>;
  readonly ai?: {
    readonly provider: NonNullable<BriskAiTestingConfig['ai']>['provider'];
    readonly model: string;
    readonly endpoint?: string;
    readonly apiKeyEnv?: string;
  };
  readonly authType: BriskAiTestingConfig['auth']['type'];
}

export interface EvidenceProviderRunInputV2 {
  readonly goal: string;
  readonly scenarios?: number;
  readonly scenarioCountPolicy?: BriskAiTestingRunInput['scenarioCountPolicy'];
  readonly mode?: BriskAiTestingRunInput['mode'];
  readonly requiredTypes?: BriskAiTestingRunInput['requiredTypes'];
  readonly tags?: readonly string[];
  readonly tenantId?: string;
}

export interface EvidenceProviderSecretReferenceV2 {
  readonly id: string;
  readonly source: 'environment';
  readonly name: string;
}

export interface EvidenceProviderContextV2 {
  readonly config: EvidenceProviderSafeConfigV2;
  readonly input: EvidenceProviderRunInputV2;
  readonly discovery: DiscoveryResult;
  readonly runId: string;
  readonly intent: IntentPlan;
  readonly currentEvidence: EvidenceGraph;
  readonly tenantId?: string;
  readonly secretReferences: readonly EvidenceProviderSecretReferenceV2[];
  readonly signal: AbortSignal;
}

export interface EvidenceFreshnessAssessmentV1 {
  readonly schemaVersion: 'brisk-aitesting.evidence-freshness.v1';
  readonly status: 'fresh' | 'stale' | 'unknown';
  readonly checkedAt: string;
  readonly reasonCode: string;
  readonly sourceRevision?: string;
  readonly validUntil?: string;
}

export interface EvidenceProviderV1 {
  readonly id: string;
  readonly schemaVersion: 'brisk-aitesting.evidence-provider.v1';
  readonly revision: string;
  supports(requirement: MissingEvidenceRequirementV1): boolean;
  checkFreshness?(
    input: EvidenceAcquisitionInputV1,
    cached: EvidenceAcquisitionOutputV1,
    context: EvidenceProviderContextV1,
  ): Promise<EvidenceFreshnessAssessmentV1> | EvidenceFreshnessAssessmentV1;
  acquire(
    input: EvidenceAcquisitionInputV1,
    context: EvidenceProviderContextV1,
  ): Promise<EvidenceAcquisitionOutputV1> | EvidenceAcquisitionOutputV1;
  refresh?(
    input: EvidenceAcquisitionInputV1,
    context: EvidenceProviderContextV1,
  ): Promise<EvidenceAcquisitionOutputV1> | EvidenceAcquisitionOutputV1;
  dispose?(): Promise<void> | void;
}

export interface EvidenceProviderV2 {
  readonly id: string;
  readonly schemaVersion: 'brisk-aitesting.evidence-provider.v2';
  readonly revision: string;
  readonly execution: 'trusted-in-process';
  supports(requirement: MissingEvidenceRequirementV1): boolean;
  checkFreshness?(
    input: EvidenceAcquisitionInputV1,
    cached: EvidenceAcquisitionOutputV1,
    context: EvidenceProviderContextV2,
  ): Promise<EvidenceFreshnessAssessmentV1> | EvidenceFreshnessAssessmentV1;
  acquire(
    input: EvidenceAcquisitionInputV1,
    context: EvidenceProviderContextV2,
  ): Promise<EvidenceAcquisitionOutputV1> | EvidenceAcquisitionOutputV1;
  refresh?(
    input: EvidenceAcquisitionInputV1,
    context: EvidenceProviderContextV2,
  ): Promise<EvidenceAcquisitionOutputV1> | EvidenceAcquisitionOutputV1;
  dispose?(): Promise<void> | void;
}

export interface EvidenceWorkerProviderV1 {
  readonly id: string;
  readonly schemaVersion: 'brisk-aitesting.evidence-worker-provider.v1';
  readonly revision: string;
  readonly execution: 'isolated-worker';
  readonly modulePath: string;
  readonly exportName?: string;
  readonly supports: {
    readonly reasonCodes?: readonly string[];
    readonly semanticTypes?: readonly string[];
    readonly capabilities?: readonly string[];
  };
  readonly limits: {
    readonly memoryMb: number;
  };
  readonly allowedEnvironmentVariables?: readonly string[];
  readonly hostIsolation: {
    readonly filesystem: 'host-enforced' | 'not-enforced';
    readonly network: 'host-enforced' | 'not-enforced';
  };
}

export interface EvidenceWorkerModuleV1 {
  acquire(
    input: EvidenceAcquisitionInputV1,
    context: EvidenceProviderContextV2,
  ): Promise<EvidenceAcquisitionOutputV1> | EvidenceAcquisitionOutputV1;
}

export type EvidenceProvider = EvidenceProviderV1 | EvidenceProviderV2 | EvidenceWorkerProviderV1;

export interface EvidenceConflictV1 {
  readonly id: string;
  readonly operationId: string;
  readonly field: string;
  readonly status: 'resolved' | 'unresolved';
  readonly candidateEvidence: readonly EvidenceProvenance[];
  readonly selectedEvidence?: EvidenceProvenance;
  readonly reasonCode: string;
  readonly mutationBlocked: boolean;
}

export interface EvidenceConflictResolutionInputV1 {
  readonly schemaVersion: 'brisk-aitesting.evidence-conflict-input.v1';
  readonly graphs: readonly EvidenceGraph[];
  readonly authorityOrder: readonly EvidenceProvenance['authority'][];
  readonly hostOverrides: readonly {
    readonly scope: string;
    readonly authority: EvidenceProvenance['authority'];
    readonly reason: string;
  }[];
}

export interface EvidenceConflictResolutionOutputV1 {
  readonly schemaVersion: 'brisk-aitesting.evidence-conflict-output.v1';
  readonly graph: EvidenceGraph;
  readonly conflicts: readonly EvidenceConflictV1[];
  readonly mutationBlockedOperationIds: readonly string[];
}

export interface EvidenceAuthorityPolicyV1 {
  readonly schemaVersion: 'brisk-aitesting.evidence-authority-policy.v1';
  readonly authorityOrder: readonly EvidenceAuthority[];
  readonly hostOverrides: readonly {
    readonly scope: string;
    readonly authority: EvidenceAuthority;
    readonly reason: string;
  }[];
}

export interface EvidenceConflictResolutionInputV2 {
  readonly schemaVersion: 'brisk-aitesting.evidence-conflict-input.v2';
  readonly graphs: readonly EvidenceGraph[];
  readonly policy: EvidenceAuthorityPolicyV1;
}

export interface EvidenceConflictResolutionOutputV2 {
  readonly schemaVersion: 'brisk-aitesting.evidence-conflict-output.v2';
  readonly graph: EvidenceGraph;
  readonly conflicts: readonly EvidenceConflictRecord[];
  readonly mutationBlockedOperationIds: readonly string[];
  readonly policyDigest: string;
}

export interface SemanticPlanningInputV1 {
  readonly schemaVersion: 'brisk-aitesting.semantic-planning-input.v1';
  readonly goal: string;
  readonly scenarioCount?: number;
  readonly scenarioCountPolicy: 'exact' | 'at-least' | 'at-most' | 'flexible';
  readonly mode: 'automatic' | EngineType;
  readonly requiredTypes: readonly EngineType[];
  readonly tags: readonly string[];
  readonly evidence: EvidenceGraph;
  readonly hostInstructions?: string;
}

export interface SemanticPlanningOutputV1 {
  readonly schemaVersion: 'brisk-aitesting.semantic-planning-output.v1';
  readonly intent: IntentPlan;
  readonly provider: {
    readonly id: string;
    readonly model?: string;
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly attempts: number;
  };
  readonly originalResponseArtifact?: ArtifactRef;
  readonly validationArtifact?: ArtifactRef;
}

export interface CompilationStageInputV1 {
  readonly schemaVersion: 'brisk-aitesting.compilation-input.v1';
  readonly intent: IntentPlan;
  readonly evidence: EvidenceGraph;
  readonly previousCompilationId?: string;
  readonly affectedScenarioIds?: readonly string[];
}

export interface CompilationStageOutputV1 {
  readonly schemaVersion: 'brisk-aitesting.compilation-output.v1';
  readonly compilationId: string;
  readonly result: CompilationResult;
  readonly evidenceRevision: string;
  readonly affectedScenarioIds: readonly string[];
  readonly deterministicIdentity: string;
}

export interface MissingEvidenceAcquisitionInputV1 {
  readonly schemaVersion: 'brisk-aitesting.missing-evidence-input.v1';
  readonly compilation: CompilationStageOutputV1;
  readonly currentEvidence: EvidenceGraph;
  readonly requirements: readonly MissingEvidenceRequirementV1[];
}

export interface MissingEvidenceAcquisitionOutputV1 {
  readonly schemaVersion: 'brisk-aitesting.missing-evidence-output.v1';
  readonly acquisition: EvidenceAcquisitionOutputV1;
  readonly conflictResolution: EvidenceConflictResolutionOutputV1;
  readonly shouldRecompile: boolean;
  readonly affectedScenarioIds: readonly string[];
  readonly acquisitionAttempt: number;
  readonly maxAcquisitionAttempts: number;
}
