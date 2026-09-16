import { canonicalHash, semanticResultHash } from './canonicalize.mjs';

// Atlas AR0.3 — Readiness Verification Resolver, implementing
// governance/architecture-refinement/AR0.3/READINESS_VERIFICATION_CONTRACT_DRAFT_V1.md
// (VERIFIED CANDIDATE V1, ChatGPT-corrected @ 425729d).
//
// Engine class: G1 deterministic resolver.
//
// Three rules from the contract are load-bearing and are implemented as structure, not as
// checks a caller could skip:
//   1. There is NO permissive mode (§3.8). Fail-closed is not configurable.
//   2. A later state is BLOCKED — never independently evaluated — when a predecessor is not
//      READY (§3.5). Monotonicity is enforced by control flow, not by a post-hoc assertion.
//   3. Nothing outside the frozen input package may enter the evaluation function (§3.6):
//      no clock read, no network, no randomness, no filesystem access in this module.
//
// The resolver never creates, infers or repairs upstream truth. Missing upstream truth
// remains missing (§1).

export const READINESS_STATES = Object.freeze([
  'DOMAIN_EXECUTION_READY',
  'ENTERPRISE_EXECUTION_READY',
  'RUNTIME_IMPLEMENTATION_READY'
]);

const PREDECESSOR = Object.freeze({
  DOMAIN_EXECUTION_READY: null,
  ENTERPRISE_EXECUTION_READY: 'DOMAIN_EXECUTION_READY',
  RUNTIME_IMPLEMENTATION_READY: 'ENTERPRISE_EXECUTION_READY'
});

// Contract §3.2 / §3.10: a floating label is invalid input, never a resolvable version.
const FLOATING_VERSION_LABELS = Object.freeze(['latest', 'current', 'head', 'main', 'newest']);

export const RESOLVER_IMPLEMENTATION_VERSION = '1.0.0';
export const GENERATOR_CONTRACT_VERSION = 'readiness-verification-contract-v1';
export const SUPPORTED_RULESET_VERSIONS = Object.freeze(['readiness-ruleset-v1']);

function isFloating(version) {
  if (version === null || version === undefined) return true;
  if (typeof version !== 'string' || version.trim() === '') return true;
  return FLOATING_VERSION_LABELS.includes(version.trim().toLowerCase());
}

function blocker({ id, type, ruleId, reason, zone = null, objectId = null, dependencyId = null, causalParentId = null, severity = 'BLOCKING' }) {
  return {
    blocker_id: id,
    blocker_type: type,
    zone,
    object_id: objectId,
    dependency_id: dependencyId,
    rule_id: ruleId,
    reason,
    severity,
    causal_parent_id: causalParentId
  };
}

/* ------------------------------------------------------------------ *
 * Structural validation — failures here yield BLOCKED, never NOT_READY.
 * Contract §3.10: BLOCKED means the state could not be *validly evaluated*.
 * ------------------------------------------------------------------ */
function validateManifest(manifest, config) {
  const blockers = [];

  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return [blocker({
      id: 'BLK-MANIFEST-MALFORMED', type: 'MALFORMED_INPUT', ruleId: 'R-VAL-001',
      reason: 'Readiness Scope Manifest is absent or not an object. Evaluation cannot proceed. Failed closed.'
    })];
  }

  for (const field of ['scope_id', 'scope_version', 'target_readiness_state']) {
    if (!manifest[field] || typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
      blockers.push(blocker({
        id: `BLK-MANIFEST-FIELD-${field.toUpperCase()}`, type: 'MALFORMED_INPUT', ruleId: 'R-VAL-002',
        reason: `Manifest field '${field}' is missing or empty. A scope must be version-closed and explicitly targeted. Failed closed.`
      }));
    }
  }

  if (manifest.target_readiness_state && !READINESS_STATES.includes(manifest.target_readiness_state)) {
    blockers.push(blocker({
      id: 'BLK-TARGET-UNKNOWN', type: 'UNKNOWN_TARGET_STATE', ruleId: 'R-VAL-003',
      reason: `Unknown readiness target '${manifest.target_readiness_state}'. Only the three Constitution-defined states are evaluable. Failed closed.`
    }));
  }

  if (isFloating(manifest.scope_version)) {
    blockers.push(blocker({
      id: 'BLK-SCOPE-VERSION-FLOATING', type: 'FLOATING_IDENTITY', ruleId: 'R-VAL-004',
      reason: `Scope version '${manifest.scope_version}' is floating or unversioned. A floating scope cannot produce a reproducible proof. Failed closed.`
    }));
  }

  // Ruleset / configuration identity must be known and frozen (§3.10).
  if (!SUPPORTED_RULESET_VERSIONS.includes(config.ruleset_version)) {
    blockers.push(blocker({
      id: 'BLK-RULESET-UNKNOWN', type: 'UNKNOWN_RULESET', ruleId: 'R-VAL-005',
      reason: `Ruleset '${config.ruleset_version}' is not a frozen ruleset known to resolver ${RESOLVER_IMPLEMENTATION_VERSION}. Failed closed.`
    }));
  }

  // Objects: identity and version closure.
  const objects = Array.isArray(manifest.objects) ? manifest.objects : [];
  if (!Array.isArray(manifest.objects)) {
    blockers.push(blocker({
      id: 'BLK-OBJECTS-MALFORMED', type: 'MALFORMED_INPUT', ruleId: 'R-VAL-006',
      reason: 'Manifest.objects is missing or not an array. Failed closed.'
    }));
  }

  const seenObjectIds = new Set();
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object' || !obj.object_id) {
      blockers.push(blocker({
        id: 'BLK-OBJECT-MALFORMED', type: 'MALFORMED_INPUT', ruleId: 'R-VAL-007',
        reason: 'A governed object entry is malformed or missing object_id. Failed closed.'
      }));
      continue;
    }
    if (seenObjectIds.has(obj.object_id)) {
      blockers.push(blocker({
        id: `BLK-OBJECT-DUPLICATE-${obj.object_id}`, type: 'DUPLICATE_IDENTITY', ruleId: 'R-VAL-008',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Duplicate object identity '${obj.object_id}' in scope. Identity must be unique for lineage to be provable. Failed closed.`
      }));
    }
    seenObjectIds.add(obj.object_id);

    if (isFloating(obj.object_version)) {
      blockers.push(blocker({
        id: `BLK-OBJECT-FLOATING-${obj.object_id}`, type: 'FLOATING_IDENTITY', ruleId: 'R-VAL-009',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Object '${obj.object_id}' has floating/unversioned identity '${obj.object_version}'. Failed closed.`
      }));
    }
    if (!obj.object_hash || typeof obj.object_hash !== 'string') {
      blockers.push(blocker({
        id: `BLK-OBJECT-NOHASH-${obj.object_id}`, type: 'MISSING_IDENTITY', ruleId: 'R-VAL-010',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Object '${obj.object_id}' has no content hash. Identity cannot be verified on recovery. Failed closed.`
      }));
    }
  }

  // Dependencies: closure and readability.
  const dependencies = Array.isArray(manifest.dependencies) ? manifest.dependencies : [];
  for (const dep of dependencies) {
    if (!dep || typeof dep !== 'object' || !dep.dependency_id) {
      blockers.push(blocker({
        id: 'BLK-DEP-MALFORMED', type: 'MALFORMED_INPUT', ruleId: 'R-VAL-011',
        reason: 'A dependency entry is malformed or missing dependency_id. Failed closed.'
      }));
      continue;
    }
    if (isFloating(dep.dependency_version)) {
      blockers.push(blocker({
        id: `BLK-DEP-FLOATING-${dep.dependency_id}`, type: 'FLOATING_IDENTITY', ruleId: 'R-VAL-012',
        dependencyId: dep.dependency_id,
        reason: `Dependency '${dep.dependency_id}' resolves to floating version '${dep.dependency_version}'. A floating dependency breaks reproducibility. Failed closed.`
      }));
    }
    if (dep.status === 'MISSING' || dep.status === 'UNREADABLE') {
      blockers.push(blocker({
        id: `BLK-DEP-${dep.status}-${dep.dependency_id}`, type: 'DEPENDENCY_CLOSURE_INCOMPLETE', ruleId: 'R-VAL-013',
        dependencyId: dep.dependency_id,
        reason: `Dependency '${dep.dependency_id}' is ${dep.status.toLowerCase()} at its authoritative location. Dependency closure is incomplete. Failed closed.`
      }));
    }
    if (!dep.authoritative_location_ref) {
      blockers.push(blocker({
        id: `BLK-DEP-NOLOC-${dep.dependency_id}`, type: 'MISSING_IDENTITY', ruleId: 'R-VAL-014',
        dependencyId: dep.dependency_id,
        reason: `Dependency '${dep.dependency_id}' has no authoritative location reference. It could not be located during recovery. Failed closed.`
      }));
    }
  }

  // Dangling references: every referenced object must be inside the declared scope.
  for (const obj of objects) {
    const refs = Array.isArray(obj?.references) ? obj.references : [];
    for (const ref of refs) {
      if (!seenObjectIds.has(ref)) {
        blockers.push(blocker({
          id: `BLK-REF-DANGLING-${obj.object_id}-${ref}`, type: 'REFERENCE_INTEGRITY', ruleId: 'R-VAL-015',
          objectId: obj.object_id, zone: obj.zone ?? null,
          reason: `Object '${obj.object_id}' references '${ref}', which is not present in the declared version-closed scope. Failed closed.`
        }));
      }
    }
  }

  // NOT_APPLICABLE decisions must carry governing authority (§3.5).
  const naDecisions = Array.isArray(manifest.not_applicable_decisions) ? manifest.not_applicable_decisions : [];
  for (const na of naDecisions) {
    if (!na || typeof na !== 'object' || !na.item_id) {
      blockers.push(blocker({
        id: 'BLK-NA-MALFORMED', type: 'MALFORMED_INPUT', ruleId: 'R-VAL-016',
        reason: 'A NOT_APPLICABLE decision entry is malformed or missing item_id. Failed closed.'
      }));
      continue;
    }
    if (!na.authority || !na.decision_id || isFloating(na.decision_version)) {
      blockers.push(blocker({
        id: `BLK-NA-UNAUTHORIZED-${na.item_id}`, type: 'UNAUTHORIZED_NOT_APPLICABLE', ruleId: 'R-VAL-017',
        objectId: na.item_id,
        reason: `NOT_APPLICABLE claimed for '${na.item_id}' without a complete governed authority/decision identity. NOT_APPLICABLE is never inferred from absence. Failed closed.`
      }));
    }
  }

  return blockers;
}

/* ------------------------------------------------------------------ *
 * Predecessor lineage verification (§3.2, §3.10).
 * ------------------------------------------------------------------ */
function verifyPredecessorLineage(manifest, predecessorState, computedProof) {
  const blockers = [];
  const supplied = Array.isArray(manifest.predecessor_proofs)
    ? manifest.predecessor_proofs.find(p => p?.state === predecessorState)
    : null;

  if (!supplied) return blockers; // re-evaluated in-run instead; permitted by §3.2.

  if (supplied.semantic_result_hash && computedProof.semantic_result_hash
      && supplied.semantic_result_hash !== computedProof.semantic_result_hash) {
    blockers.push(blocker({
      id: `BLK-LINEAGE-MISMATCH-${predecessorState}`, type: 'LINEAGE_MISMATCH', ruleId: 'R-MONO-003',
      reason: `Supplied ${predecessorState} proof hash does not match the hash recomputed from this scope's frozen inputs. The supplied proof belongs to a different input baseline. Failed closed.`
    }));
  }
  if (supplied.result && supplied.result !== computedProof.result) {
    blockers.push(blocker({
      id: `BLK-LINEAGE-RESULT-CONFLICT-${predecessorState}`, type: 'LINEAGE_MISMATCH', ruleId: 'R-MONO-004',
      reason: `Supplied ${predecessorState} proof claims '${supplied.result}' but re-evaluation of the same frozen scope yields '${computedProof.result}'. Contradictory governed inputs. Failed closed.`
    }));
  }
  return blockers;
}

/* ------------------------------------------------------------------ *
 * State rule evaluation — failures here yield NOT_READY (validly evaluated, criteria fail).
 * ------------------------------------------------------------------ */
function evaluateDomain(manifest) {
  const blockers = [];
  const objects = Array.isArray(manifest.objects) ? manifest.objects : [];

  for (const obj of objects) {
    const gaps = Array.isArray(obj?.semantic_gaps) ? obj.semantic_gaps : [];
    for (const gap of gaps) {
      const mandatory = gap?.mandatory !== false; // default to mandatory: absence of the flag must not weaken the check
      if (!mandatory) continue;
      if (gap?.status === 'RESOLVED') continue;
      blockers.push(blocker({
        id: `GAP-${obj.object_id}-${gap?.gap_id ?? 'UNSPECIFIED'}`, type: 'SEMANTIC_GAP', ruleId: 'R-DOM-001',
        objectId: obj.object_id, zone: obj.zone ?? 'Z1', severity: 'NOT_READY',
        reason: `Unresolved mandatory reusable semantic gap on '${obj.object_id}': ${gap?.description ?? 'no description supplied'}.`
      }));
    }
    // Provenance control is part of the Constitution's DOMAIN definition.
    if (!obj?.provenance_ref) {
      blockers.push(blocker({
        id: `PROV-MISSING-${obj.object_id}`, type: 'PROVENANCE_MISSING', ruleId: 'R-DOM-002',
        objectId: obj.object_id, zone: obj.zone ?? 'Z1', severity: 'NOT_READY',
        reason: `Object '${obj.object_id}' is not source/provenance controlled; DOMAIN readiness requires provenance control.`
      }));
    }
  }
  return blockers;
}

function evaluateEnterprise(manifest) {
  const blockers = [];
  const requirements = Array.isArray(manifest.binding_requirements) ? manifest.binding_requirements : [];
  const naIds = new Set(
    (Array.isArray(manifest.not_applicable_decisions) ? manifest.not_applicable_decisions : [])
      .filter(na => na?.authority && na?.decision_id && !isFloating(na?.decision_version))
      .map(na => na.item_id)
  );

  for (const req of requirements) {
    if (!req?.requirement_id) continue; // structural validity already handled upstream
    if (naIds.has(req.requirement_id)) continue; // governed NOT_APPLICABLE, correctly authorized
    if (req.resolved_value_ref) continue;
    blockers.push(blocker({
      id: `BIND-UNRESOLVED-${req.requirement_id}`, type: 'BINDING_UNRESOLVED', ruleId: 'R-ENT-001',
      objectId: req.requirement_id, zone: 'Z2', severity: 'NOT_READY',
      reason: `Declared binding requirement '${req.requirement_id}' has no resolved enterprise value and no governed NOT_APPLICABLE decision.`
    }));
  }
  return blockers;
}

function evaluateRuntime(manifest) {
  const blockers = [];
  const target = manifest.runtime_target;

  if (!target || typeof target !== 'object') {
    blockers.push(blocker({
      id: 'RUNTIME-TARGET-ABSENT', type: 'RUNTIME_TARGET_MISSING', ruleId: 'R-RUN-001',
      zone: 'Z6', severity: 'NOT_READY',
      reason: 'No downstream runtime target declared; RUNTIME readiness requires a version-identified chosen tool.'
    }));
    return blockers;
  }
  if (!target.tool_id || isFloating(target.tool_version)) {
    blockers.push(blocker({
      id: 'RUNTIME-TARGET-UNVERSIONED', type: 'RUNTIME_TARGET_MISSING', ruleId: 'R-RUN-002',
      zone: 'Z6', severity: 'NOT_READY',
      reason: `Runtime target is not version-identified (tool_id='${target.tool_id ?? null}', tool_version='${target.tool_version ?? null}').`
    }));
  }
  if (!target.specification_ref) {
    blockers.push(blocker({
      id: 'RUNTIME-SPEC-MISSING', type: 'SPECIFICATION_MISSING', ruleId: 'R-RUN-003',
      zone: 'Z6', severity: 'NOT_READY',
      reason: 'No version-closed specification/projection exists for the declared runtime target.'
    }));
  }
  if (!target.capability_profile_ref) {
    blockers.push(blocker({
      id: 'RUNTIME-CAPABILITY-PROFILE-MISSING', type: 'CAPABILITY_PROFILE_MISSING', ruleId: 'R-RUN-004',
      zone: 'Z6', severity: 'NOT_READY',
      reason: 'No capability profile is declared for the runtime target; capability gaps cannot be assessed.'
    }));
  }
  const gaps = Array.isArray(target.gaps) ? target.gaps : [];
  for (const gap of gaps) {
    if (gap?.status === 'RESOLVED' || gap?.status === 'GOVERNED') continue;
    blockers.push(blocker({
      id: `RUNTIME-GAP-${gap?.gap_id ?? 'UNSPECIFIED'}`, type: 'RUNTIME_GAP', ruleId: 'R-RUN-005',
      zone: 'Z6', severity: 'NOT_READY',
      reason: `Runtime capability/configuration/integration gap '${gap?.gap_id ?? 'UNSPECIFIED'}' is neither resolved nor explicitly governed: ${gap?.description ?? 'no description supplied'}.`
    }));
  }
  return blockers;
}

const STATE_EVALUATORS = Object.freeze({
  DOMAIN_EXECUTION_READY: evaluateDomain,
  ENTERPRISE_EXECUTION_READY: evaluateEnterprise,
  RUNTIME_IMPLEMENTATION_READY: evaluateRuntime
});

/* ------------------------------------------------------------------ *
 * Core evaluation, recursive through the predecessor chain.
 * ------------------------------------------------------------------ */
function evaluateState(manifest, targetState, config) {
  const predecessorState = PREDECESSOR[targetState];
  const predecessorProofs = [];
  let dependencyChainStatus = 'EVALUATED';

  if (predecessorState) {
    const predecessorProof = evaluateState(manifest, predecessorState, config);
    predecessorProofs.push(
      ...predecessorProof.predecessor_proofs,
      {
        state: predecessorState,
        proof_id: predecessorProof.proof_id,
        semantic_result_hash: predecessorProof.semantic_result_hash,
        result: predecessorProof.result
      }
    );

    const lineageBlockers = verifyPredecessorLineage(manifest, predecessorState, predecessorProof);

    // Monotonicity enforced by control flow: if the predecessor is anything other than READY,
    // the later state is BLOCKED and its own criteria are NEVER evaluated (§3.5).
    if (lineageBlockers.length > 0 || predecessorProof.result !== 'READY') {
      const directCause = lineageBlockers.length > 0
        ? lineageBlockers
        : [blocker({
            id: `BLK-PREDECESSOR-${predecessorState}`, type: 'PREDECESSOR_NOT_READY', ruleId: 'R-MONO-001',
            causalParentId: predecessorProof.proof_id,
            reason: `${targetState} cannot be evaluated because mandatory predecessor ${predecessorState} is '${predecessorProof.result}', not READY. Monotonicity prevents a later state asserting readiness over an unresolved earlier one.`
          })];

      // §3.10 requires ALL blockers, and BC-3 requires a causal chain. Reporting only
      // "predecessor not ready" would hide the actual root cause, leaving an operator unable
      // to act on the result. Propagate the predecessor's own blockers, preserving any
      // deeper causal_parent_id so a DOMAIN root cause stays traceable through RUNTIME.
      const inheritedCause = predecessorProof.blockers.map(b => ({
        ...b,
        causal_parent_id: b.causal_parent_id ?? predecessorProof.proof_id
      }));

      return buildResult({
        manifest, targetState, config,
        result: 'BLOCKED',
        blockers: [...directCause, ...inheritedCause],
        predecessorProofs,
        monotonicityPassed: false,
        dependencyChainStatus: 'NOT_EVALUATED_PREDECESSOR_BLOCKED',
        ruleEvaluations: []
      });
    }
  }

  // Structural validation gates the target state's own evaluation.
  const structuralBlockers = validateManifest(manifest, config);
  if (structuralBlockers.length > 0) {
    return buildResult({
      manifest, targetState, config,
      result: 'BLOCKED',
      blockers: structuralBlockers,
      predecessorProofs,
      monotonicityPassed: true,
      dependencyChainStatus: 'NOT_EVALUATED_INPUT_INVALID',
      ruleEvaluations: []
    });
  }

  // Explicit governed NOT_APPLICABLE for the whole scope/state.
  const scopeNa = (Array.isArray(manifest.not_applicable_decisions) ? manifest.not_applicable_decisions : [])
    .find(na => na?.item_id === targetState && na?.authority && na?.decision_id && !isFloating(na?.decision_version));
  if (scopeNa) {
    return buildResult({
      manifest, targetState, config,
      result: 'NOT_APPLICABLE',
      blockers: [],
      predecessorProofs,
      monotonicityPassed: true,
      dependencyChainStatus,
      ruleEvaluations: [{ rule_id: 'R-NA-001', rule_version: config.ruleset_version, result: 'NOT_APPLICABLE', evidence_refs: [scopeNa.decision_id] }]
    });
  }

  const evaluator = STATE_EVALUATORS[targetState];
  const criteriaBlockers = evaluator(manifest);

  return buildResult({
    manifest, targetState, config,
    result: criteriaBlockers.length === 0 ? 'READY' : 'NOT_READY',
    blockers: criteriaBlockers,
    predecessorProofs,
    monotonicityPassed: true,
    dependencyChainStatus,
    ruleEvaluations: buildRuleEvaluations(targetState, criteriaBlockers, config)
  });
}

function buildRuleEvaluations(targetState, blockers, config) {
  const failedRuleIds = new Set(blockers.map(b => b.rule_id));
  const ruleIdsByState = {
    DOMAIN_EXECUTION_READY: ['R-DOM-001', 'R-DOM-002'],
    ENTERPRISE_EXECUTION_READY: ['R-ENT-001'],
    RUNTIME_IMPLEMENTATION_READY: ['R-RUN-001', 'R-RUN-002', 'R-RUN-003', 'R-RUN-004', 'R-RUN-005']
  };
  return ruleIdsByState[targetState].map(ruleId => ({
    rule_id: ruleId,
    rule_version: config.ruleset_version,
    result: failedRuleIds.has(ruleId) ? 'FAIL' : 'PASS',
    evidence_refs: blockers.filter(b => b.rule_id === ruleId).map(b => b.blocker_id)
  }));
}

function buildDependencyChain(manifest) {
  const dependencies = Array.isArray(manifest?.dependencies) ? manifest.dependencies : [];
  return dependencies.map(dep => ({
    dependency_id: dep?.dependency_id ?? null,
    dependency_version: dep?.dependency_version ?? null,
    dependency_hash: dep?.dependency_hash ?? null,
    status: dep?.status ?? 'UNDECLARED',
    authoritative_location_ref: dep?.authoritative_location_ref ?? null
  }));
}

function buildResult({ manifest, targetState, config, result, blockers, predecessorProofs, monotonicityPassed, dependencyChainStatus, ruleEvaluations }) {
  const semanticCore = {
    scope_id: manifest?.scope_id ?? null,
    scope_version: manifest?.scope_version ?? null,
    state_evaluated: targetState,
    result,
    blockers,
    dependency_chain: buildDependencyChain(manifest),
    dependency_chain_status: dependencyChainStatus,
    predecessor_proofs: predecessorProofs,
    rule_evaluations: ruleEvaluations,
    monotonicity_check: {
      passed: monotonicityPassed,
      predecessor_states_checked: predecessorProofs.map(p => p.state)
    },
    identity: {
      generator_contract_version: GENERATOR_CONTRACT_VERSION,
      resolver_implementation_version: RESOLVER_IMPLEMENTATION_VERSION,
      resolver_commit: config.resolver_commit ?? null,
      ruleset_version: config.ruleset_version ?? null,
      configuration_hash: canonicalHash({
        ruleset_version: config.ruleset_version ?? null,
        canonicalization_profile: config.canonicalization_profile ?? null
      }),
      input_manifest_hash: canonicalHash(manifest ?? null)
    },
    lifecycle: 'CANDIDATE' // §3.3: a resolver can never self-promote its own output.
  };

  semanticCore.proof_id = `proof:${targetState}:${canonicalHash(semanticCore).slice(0, 16)}`;
  return { ...semanticCore, semantic_result_hash: semanticResultHash(semanticCore) };
}

/**
 * Evaluate readiness for a declared scope.
 *
 * Pure and deterministic: identical frozen inputs + identical config produce an identical
 * semantic_result_hash. Run metadata is attached by the caller (see attachRunMetadata) and
 * is excluded from that hash by construction.
 *
 * @param {object} manifest Readiness Scope Manifest (frozen, version-closed).
 * @param {object} config   { ruleset_version, canonicalization_profile?, resolver_commit? }
 * @returns {object} ReadinessResult
 */
export function resolveReadiness(manifest, config = {}) {
  const effectiveConfig = {
    ruleset_version: config.ruleset_version ?? null,
    canonicalization_profile: config.canonicalization_profile ?? 'canonical-json-sha256-v1',
    resolver_commit: config.resolver_commit ?? null
  };

  const target = manifest?.target_readiness_state;

  // An unknown/absent target cannot select an evaluator, so validate before dispatch.
  if (!target || !READINESS_STATES.includes(target)) {
    return buildResult({
      manifest, targetState: target ?? 'UNKNOWN', config: effectiveConfig,
      result: 'BLOCKED',
      blockers: validateManifest(manifest, effectiveConfig),
      predecessorProofs: [],
      monotonicityPassed: false,
      dependencyChainStatus: 'NOT_EVALUATED_INPUT_INVALID',
      ruleEvaluations: []
    });
  }

  return evaluateState(manifest, target, effectiveConfig);
}

/**
 * Attach non-semantic audit metadata. Kept separate from resolveReadiness so that no clock
 * read can ever occur inside the deterministic evaluation function (§3.6).
 */
export function attachRunMetadata(result, { evaluation_run_id, evaluation_timestamp }) {
  return { ...result, run_metadata: { evaluation_run_id, evaluation_timestamp } };
}
