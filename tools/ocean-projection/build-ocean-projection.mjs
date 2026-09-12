// Ocean-specific projection builder. Kept separate from lib/projections/execution-depth-projection.js
// (which is tuned to Road LTL v1.5's field shapes: task.label/trigger/before/after/outcome/rule/control/
// action/clock/evidence). Ocean 0.6 tasks use a structurally different, OK-v1-era shape: title, identity{},
// states{}, controls[], atomicActions[], expectedOutcomes[], evidenceContracts[], constraints[],
// temporalConstraints[], workDefinitionReadiness{}. Reusing the LTL function directly against this shape
// silently returns nulls (task.label doesn't exist, etc) rather than real content -- confirmed by testing.
// This builder reads Ocean's actual fields. Every value is either a direct field or a mechanical join of
// real, sourced array items. No narrative content is invented. Fields with no honest Ocean equivalent
// (trigger, why, canonical object families, requiredWhen/prohibitedWhen) are left null/empty, matching
// the registry's own "informationResolutionDepth": "NOT_POPULATED_AT_OKV2_DEPTH" self-description.

function join(items, pick, max = 3) {
  const vals = (items || []).map(pick).filter(Boolean);
  if (!vals.length) return null;
  const shown = vals.slice(0, max);
  const suffix = vals.length > max ? ` (+${vals.length - max} more)` : '';
  return shown.join(' · ') + suffix;
}

export function buildOceanPublicExecutionDepthProjection({ task, moduleId, moduleVersion }) {
  const states = task.states || {};
  const outcomes = task.expectedOutcomes || [];
  const wdr = task.workDefinitionReadiness || {};
  return {
    schemaVersion: 'atlas-execution-depth-public-projection-v1',
    projectionClass: 'PUBLIC_SAFE',
    trace: {
      moduleId, moduleVersion, taskId: task.taskId,
      canonicalTaskRef: task.identity?.a5ContractId || null,
      canonicalProcessConceptId: null,
      operationalKnowledgeContractVersion: 'operational-knowledge-v1',
      informationResolutionContractVersion: null,
      projectionContractVersion: '1.1.0-ocean-okv1',
      sourceProfile: 'FROZEN_DAUGHTER_OKV1_PRECOMPILED_PUBLIC_SAFE',
    },
    overview: {
      title: task.title || null,
      purpose: task.identity?.purpose || null,
      trigger: null, // no task-level trigger field in Ocean's OK v1 shape; not fabricated
      before: states.before || null,
      after: states.success || null,
      outcome: join(outcomes, o => o.outcome, 2),
      semanticStatus: 'FROZEN_EXECUTION_REFERENCE_CANDIDATE',
    },
    operationalKnowledge: {
      businessMeaning: task.identity?.purpose || null,
      why: null, // no direct equivalent at this depth; not fabricated
      informationResolution: {
        canonicalObjectFamilies: [], // OK v1 depth: field-level requiredInformation exists, not object-family semantics -- left empty rather than mismapped
        applicability: { requiredWhen: [], prohibitedWhen: [] },
        resolutionCapabilities: [],
        criticalResolutionSummaries: [],
        unresolved: { total: 0, countsByStatus: {} },
        measurement: { status: 'NOT_POPULATED_AT_OKV2_DEPTH', metricDefinitionPendingCount: 0, targetMeasurementFamilies: [] },
      },
      ruleSummary: join(task.constraints, c => c.statement, 2),
      controlSummary: join(task.controls, c => c.objective, 2),
      actionSummary: join(task.atomicActions, a => a.action, 2),
      timingSummary: join(task.temporalConstraints, t => t.requiredWhen, 2),
      evidenceSummary: join(task.evidenceContracts, e => e.requirement, 2),
      clientDependencySummary: { bindingRequired: false, exactClientValuesIncluded: false, exactRuntimeMappingsIncluded: false },
    },
    executionReadiness: {
      status: wdr.daughterOperationalContract === 'PASS_CANDIDATE' ? 'CONDITIONAL_READY' : 'NOT_READY',
      decompositionRequired: true,
      decompositionStatus: wdr.workDecomposition || 'REQUIRED_NOT_STARTED',
      executorReadyStatus: 'NOT_READY',
      independentExecutorProofStatus: wdr.independentExecutorProof || 'PENDING',
      coverage: {},
      unresolved: { operationalKnowledgeCount: 0, sourceContextPendingCount: 0, clientBindingCount: 0, metricDefinitionPendingCount: 0, unknownCount: 0 },
      dependencies: { deterministicVsJudgement: 'UNKNOWN', hitlRequired: true, systemActionRequired: false, clientBindingRequired: false },
      downstream: { workDecompositionStatus: wdr.workDecomposition || 'NOT_YET_COMPILED', workDefinitionStatus: wdr.canonicalWorkDefinition || 'NOT_YET_COMPILED' },
    },
    protectedExecution: {
      workDecomposition: { status: 'NOT_YET_COMPILED', detailIncluded: false },
      workDefinition: { status: 'NOT_YET_COMPILED', detailIncluded: false },
    },
  };
}
