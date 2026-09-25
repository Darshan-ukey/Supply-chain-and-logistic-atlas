import type {
  BriskAiTestingConfig,
  BriskAiTestingRunInput,
  ApiCleanupStep,
  DiscoveryResult,
  EngineType,
  ScenarioPlan,
} from './types.js';

export type CapabilityKind =
  | 'web.ui'
  | 'api.http'
  | 'api.graphql'
  | 'api.grpc'
  | 'messaging'
  | 'data'
  | 'job'
  | 'cli'
  | 'code'
  | `custom.${string}`;

export type EvidenceAuthority = 'host' | 'contract' | 'runtime' | 'observed' | 'source' | 'heuristic';

export interface EvidenceProvenance {
  readonly authority: EvidenceAuthority;
  readonly source: string;
  readonly confidence: number;
  readonly observedAt?: string;
  readonly revision?: string;
}

export interface EvidenceConflictCandidate {
  readonly id: string;
  readonly value: unknown;
  readonly provenance: readonly EvidenceProvenance[];
  readonly sourceGraphRevisions: readonly string[];
}

export interface EvidenceConflictRecord {
  readonly id: string;
  readonly operationId: string;
  readonly field: string;
  readonly status: 'resolved' | 'unresolved';
  readonly candidates: readonly EvidenceConflictCandidate[];
  readonly selectedCandidateId?: string;
  readonly reasonCode: 'AUTHORITY_PRECEDENCE' | 'AUTHORITY_TIE' | 'HOST_OVERRIDE_APPLIED' | 'HOST_OVERRIDE_NO_MATCH' | 'HOST_OVERRIDE_AMBIGUOUS';
  readonly explanation: string;
  readonly mutationBlocked: boolean;
  readonly override?: {
    readonly scope: string;
    readonly authority: EvidenceAuthority;
    readonly reason: string;
  };
}

export interface IntentValue {
  readonly semanticType: string;
  readonly value?: unknown;
  readonly fixture?: string;
  readonly secretRef?: string;
  /** References an earlier intent action in the same scenario. The compiler
   * resolves the matching typed output and never asks AI to name a runtime
   * capture path or executable step id. */
  readonly fromActionId?: string;
  /** Ask for a brand-new value made from the operation's declared recipe (for example a fresh unique name). */
  readonly generate?: true;
}

export interface IntentAction {
  readonly id: string;
  readonly verb: string;
  readonly resource: string;
  readonly capability?: CapabilityKind;
  readonly actor?: string;
  readonly phase?: 'setup' | 'test' | 'verification';
  readonly values?: Readonly<Record<string, IntentValue>>;
  readonly expectedOutcomes: readonly string[];
}

export interface IntentScenario {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly actor?: string;
  readonly initialState?: readonly string[];
  readonly actions: readonly IntentAction[];
  readonly invariants: readonly string[];
  readonly evidenceRequired: readonly string[];
  readonly cleanup: 'automatic' | 'isolated' | 'manual';
}

export interface IntentPlan {
  readonly schemaVersion: 'brisk-aitesting.intent.v1';
  readonly goal: string;
  readonly scenarios: readonly IntentScenario[];
  readonly warnings: readonly string[];
}

export type OperationSideEffect = 'none' | 'read' | 'create' | 'update' | 'delete' | 'external';
export type WorkflowPhase = 'setup' | 'test' | 'verification' | 'cleanup';

export type ValueGenerationPolicy =
  | { readonly kind: 'constant'; readonly value: unknown }
  | { readonly kind: 'unique-string'; readonly prefix?: string }
  | { readonly kind: 'uuid' }
  | { readonly kind: 'timestamp' };

export interface EvidenceValueSlot {
  readonly id: string;
  readonly name: string;
  readonly semanticType: string;
  readonly required: boolean;
  readonly schema?: unknown;
  readonly generation?: ValueGenerationPolicy;
  /** Environment variable name resolved only at execution time. The secret value
   * must never be stored in evidence, workflow IR, or a lowered artifact. */
  readonly secretRef?: string;
}

export interface EvidenceOutcome {
  readonly id: string;
  readonly meaning: string;
  readonly successful: boolean;
  readonly binding?: unknown;
}

/** A conversion exists only when the operation-owning adapter declares it.
 * The compiler may authorize this typed edge, but only the adapter may lower it. */
export interface EvidenceValueConversion {
  readonly id: string;
  readonly fromSemanticType: string;
  readonly toSemanticType: string;
  readonly safety: 'lossless' | 'validated';
  readonly binding?: unknown;
}

export interface EvidenceOperation {
  readonly id: string;
  readonly adapterId: string;
  readonly capability: CapabilityKind;
  readonly name: string;
  readonly action: string;
  readonly resource: string;
  readonly actor?: string;
  readonly sideEffect: OperationSideEffect;
  readonly inputs: readonly EvidenceValueSlot[];
  readonly outputs: readonly EvidenceValueSlot[];
  readonly outcomes: readonly EvidenceOutcome[];
  readonly provenance: readonly EvidenceProvenance[];
  readonly binding: unknown;
  readonly conflicts?: readonly string[];
  readonly cleanupOperationId?: string;
  readonly valueConversions?: readonly EvidenceValueConversion[];
}

export interface EvidenceGraph {
  readonly schemaVersion: 'brisk-aitesting.evidence-graph.v1';
  readonly revision: string;
  readonly operations: readonly EvidenceOperation[];
  readonly diagnostics: readonly string[];
  readonly conflicts?: readonly EvidenceConflictRecord[];
}

export type WorkflowValueBinding = (
  | {
      readonly kind: 'intent';
      readonly semanticType: string;
      readonly value: unknown;
    }
  | {
      readonly kind: 'fixture';
      readonly semanticType: string;
      readonly fixture: string;
    }
  | {
      readonly kind: 'secret';
      readonly semanticType: string;
      readonly secretRef: string;
    }
  | {
      readonly kind: 'generated';
      readonly semanticType: string;
      readonly generation: ValueGenerationPolicy;
    }
  | {
      readonly kind: 'output';
      readonly semanticType: string;
      readonly stepId: string;
      readonly outputSlotId: string;
    }
) & {
  readonly conversion?: WorkflowValueConversion;
};

export interface WorkflowValueConversion {
  readonly id: string;
  readonly adapterId: string;
  readonly fromSemanticType: string;
  readonly toSemanticType: string;
  readonly safety: EvidenceValueConversion['safety'];
}

export type WorkflowValueSourceKind = 'intent' | 'fixture' | 'secret-reference' | 'generated' | 'step-output';

export interface WorkflowValueConsumer {
  readonly stepId: string;
  readonly inputSlotId: string;
  readonly conversion?: WorkflowValueConversion;
}

/** Metadata-only value record. It deliberately never stores the runtime value. */
export interface WorkflowValueRecordV1 {
  readonly id: string;
  readonly semanticType: string;
  readonly source: {
    readonly kind: WorkflowValueSourceKind;
    readonly reference?: string;
  };
  readonly producer: {
    readonly kind: 'external' | 'step-output';
    readonly stepId?: string;
    readonly outputSlotId?: string;
  };
  readonly consumers: readonly WorkflowValueConsumer[];
  readonly lifetime: {
    readonly scope: 'scenario';
    readonly startsAt: 'scenario-start' | `after:${string}`;
    readonly endsAt: `after:${string}`;
  };
  readonly secret: boolean;
}

export interface WorkflowValueFlowV1 {
  readonly schemaVersion: 'brisk-aitesting.value-flow.v1';
  readonly values: readonly WorkflowValueRecordV1[];
}

export interface WorkflowSelectionCandidateV1 {
  readonly operationId: string;
  readonly score: number;
}

export interface WorkflowSelectionDecisionV1 {
  readonly schemaVersion: 'brisk-aitesting.workflow-selection-decision.v1';
  readonly id: string;
  readonly scenarioId: string;
  readonly stepId: string;
  readonly intentActionId: string;
  readonly phase: WorkflowPhase;
  readonly candidates: readonly WorkflowSelectionCandidateV1[];
  readonly selectedOperationId: string;
  readonly selectionReason: 'highest-unambiguous-score' | 'declared-cleanup-operation';
  readonly expectedOutcomeIds: readonly string[];
  readonly evidenceRevision: string;
  readonly provenance: readonly EvidenceProvenance[];
}

export interface WorkflowInputBinding {
  readonly inputSlotId: string;
  readonly value: WorkflowValueBinding;
}

export interface WorkflowCaptureBinding {
  readonly outputSlotId: string;
  readonly semanticType: string;
}

export interface WorkflowStep {
  readonly id: string;
  readonly intentActionId: string;
  readonly operationId: string;
  readonly adapterId: string;
  readonly capability: CapabilityKind;
  readonly phase: WorkflowPhase;
  readonly inputs: readonly WorkflowInputBinding[];
  readonly captures: readonly WorkflowCaptureBinding[];
  readonly dependsOn: readonly string[];
  readonly expectedOutcomeIds: readonly string[];
  readonly evidence: readonly EvidenceProvenance[];
  readonly sideEffect: OperationSideEffect;
}

export interface WorkflowScenario {
  readonly id: string;
  readonly intentScenarioId: string;
  readonly name: string;
  readonly objective: string;
  readonly steps: readonly WorkflowStep[];
  readonly invariants: readonly string[];
  readonly cleanupPolicy: IntentScenario['cleanup'];
  readonly cleanupStepIds: readonly string[];
  /** Optional only for legacy host-authored Workflow IR. The compiler always emits it. */
  readonly valueFlow?: WorkflowValueFlowV1;
}

export interface WorkflowCleanupRequiredValueV1 {
  readonly inputSlotId: string;
  readonly sourceKind: WorkflowValueSourceKind;
  readonly producerStepId?: string;
  readonly outputSlotId?: string;
  readonly semanticType: string;
}

/** Inspectable proof of why one cleanup is attached and what must be true before it runs. */
export interface WorkflowCleanupSafetyRecordV1 {
  readonly schemaVersion: 'brisk-aitesting.workflow-cleanup-safety.v1';
  readonly id: string;
  readonly scenarioId: string;
  readonly sourceStepId: string;
  readonly sourceOperationId: string;
  readonly cleanupStepId: string;
  readonly cleanupOperationId: string;
  readonly dependsOnCleanupStepIds: readonly string[];
  readonly requiredValues: readonly WorkflowCleanupRequiredValueV1[];
  readonly expectedOutcomeIds: readonly string[];
  readonly evidenceRevision: string;
  readonly provenance: readonly EvidenceProvenance[];
  readonly recoveryPolicy: 'cleanup-only-no-unknown-mutation-replay';
}

export interface WorkflowPlan {
  readonly schemaVersion: 'brisk-aitesting.workflow.v1';
  readonly id: string;
  readonly evidenceRevision: string;
  readonly goal: string;
  readonly scenarios: readonly WorkflowScenario[];
  readonly selectionDecisions: readonly WorkflowSelectionDecisionV1[];
  readonly cleanupSafetyRecords: readonly WorkflowCleanupSafetyRecordV1[];
  readonly createdAt: string;
}

/** How missing test data may be sourced when no existing value satisfies a required input. */
export type FixtureSourcingPolicy = 'provision-when-missing' | 'require-existing';

export interface SemanticCompileOptions {
  /** Default 'require-existing': the compiler never invents create steps unless the host opts in. */
  readonly fixtures?: FixtureSourcingPolicy;
  /** Semantic types that must NOT be sourced from a read/list operation's output.
   * Set by the planner after a live probe proved the backing collection is empty,
   * so the compiler selects the declared self-cleaning producer instead. */
  readonly forceProvisionSemanticTypes?: ReadonlySet<string>;
}

export interface FixtureProvisioningProbeV1 {
  readonly method: string;
  readonly path: string;
  readonly status: 'empty' | 'populated' | 'unknown';
  readonly httpStatus?: number;
  readonly checkedAt: string;
}

/** Inspectable record of how one required value's data availability was handled:
 * provisioned as a self-cleaning fixture, confirmed to exist, found empty, or
 * impossible to provision safely. Stamped on the plan so the user knows before running. */
export interface FixtureProvisioningRecordV1 {
  readonly schemaVersion: 'brisk-aitesting.fixture-provisioning.v1';
  readonly id: string;
  /** Intent scenario (check) id the value belongs to. */
  readonly scenarioId: string;
  readonly semanticType: string;
  readonly policy: FixtureSourcingPolicy;
  readonly outcome:
    | 'provisioned'
    | 'existing-data'
    | 'empty-requires-existing-data'
    | 'no-cleanup-safe-producer'
    | 'unverified';
  readonly explanation: string;
  readonly sourceOperationId?: string;
  readonly producerOperationId?: string;
  readonly cleanupOperationId?: string;
  readonly probe?: FixtureProvisioningProbeV1;
}

export interface CompilationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly scenarioId?: string;
  readonly actionId?: string;
  readonly operationIds?: readonly string[];
  readonly missingSemanticType?: string;
  /** For ambiguous-producer refusals: the earlier intent actions that compete. */
  readonly candidateIntentActionIds?: readonly string[];
}

export interface CompilationResult {
  readonly schemaVersion: 'brisk-aitesting.compilation.v1';
  readonly status: 'compiled' | 'needs-evidence' | 'ambiguous' | 'unsupported';
  readonly workflow?: WorkflowPlan;
  readonly diagnostics: readonly CompilationDiagnostic[];
  /** Present when fixture sourcing made (or refused) a data-provisioning decision. */
  readonly fixtureProvisioning?: readonly FixtureProvisioningRecordV1[];
}

export interface CapabilityAdapter {
  readonly id: string;
  readonly capabilities: readonly CapabilityKind[];
  collect?(context: {
    readonly config: BriskAiTestingConfig;
    readonly input: BriskAiTestingRunInput;
    readonly discovery: DiscoveryResult;
    readonly runId: string;
  }): Promise<EvidenceGraph | undefined> | EvidenceGraph | undefined;
  lower(params: {
    readonly workflow: WorkflowPlan;
    readonly scenario: WorkflowScenario;
    readonly step: WorkflowStep;
    readonly operation: EvidenceOperation;
  }): Promise<readonly Omit<ScenarioPlan, 'id'>[]> | readonly Omit<ScenarioPlan, 'id'>[];
  lowerCleanup?(params: {
    readonly workflow: WorkflowPlan;
    readonly scenario: WorkflowScenario;
    readonly step: WorkflowStep;
    readonly operation: EvidenceOperation;
  }): Promise<ApiCleanupStep> | ApiCleanupStep;
  validateBinding?(operation: EvidenceOperation): readonly string[];
}

export interface LoweredPlan {
  readonly schemaVersion: 'brisk-aitesting.lowered-plan.v1';
  readonly scenarios: readonly ScenarioPlan[];
  readonly engineTypes: readonly EngineType[];
}
