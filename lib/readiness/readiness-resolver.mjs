import { canonicalHash, semanticResultHash, SUPPORTED_CANONICALIZATION_PROFILES } from './canonicalize.mjs';
import { FROZEN_RULESETS, SUPPORTED_RULESET_VERSIONS } from './rulesets.mjs';
import { FROZEN_FIXTURE_REGISTRY } from './fixture-registry.mjs';

// Atlas AR0.3 — Readiness Verification Resolver.
// Implements READINESS_VERIFICATION_CONTRACT_DRAFT_V1 (VERIFIED CANDIDATE @ 425729d),
// as corrected by ChatGPT implementation QA.
//
// Engine class: G1 deterministic resolver.
//
// The governing failure this version exists to prevent: V1 proved the ABSENCE OF DECLARED
// PROBLEMS and called it readiness. An entirely empty scope therefore evaluated to
// RUNTIME_IMPLEMENTATION_READY with zero blockers. Readiness must instead be a POSITIVE
// COVERAGE PROOF — required semantics must be shown present, not merely un-objected-to.
//
// Structural guarantees (not caller-configurable):
//   - no permissive mode exists; fail-closed is not optional (§3.8)
//   - monotonicity is control flow: a later state's criteria are never evaluated when a
//     predecessor is not READY (§3.5)
//   - no clock/network/randomness/filesystem inside the evaluation function (§3.6)
//   - a missing inventory NEVER degrades to an empty one
//   - real governed scopes BLOCK until upstream AR0.3 contracts are frozen (§7)

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

const FLOATING_VERSION_LABELS = Object.freeze(['latest', 'current', 'head', 'main', 'newest']);

export const RESOLVER_IMPLEMENTATION_VERSION = '2.0.0';
export const GENERATOR_CONTRACT_VERSION = 'readiness-verification-contract-v1';
export { SUPPORTED_RULESET_VERSIONS };

function isFloating(version) {
  if (version === null || version === undefined) return true;
  if (typeof version !== 'string' || version.trim() === '') return true;
  return FLOATING_VERSION_LABELS.includes(version.trim().toLowerCase());
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function blocker({ id, type, ruleId, reason, zone = null, objectId = null, dependencyId = null, causalParentId = null, severity = 'BLOCKING' }) {
  return {
    blocker_id: id, blocker_type: type, zone, object_id: objectId,
    dependency_id: dependencyId, rule_id: ruleId, reason, severity,
    causal_parent_id: causalParentId
  };
}

/* ================================================================== *
 * CONFIGURATION VALIDATION — engine identity must itself be pinned.
 * ================================================================== */
function validateConfig(config) {
  const blockers = [];

  if (!SUPPORTED_RULESET_VERSIONS.includes(config.ruleset_version)) {
    blockers.push(blocker({
      id: 'BLK-RULESET-UNKNOWN', type: 'UNKNOWN_RULESET', ruleId: 'R-CFG-001',
      reason: `Ruleset '${config.ruleset_version}' is not a frozen ruleset known to resolver ${RESOLVER_IMPLEMENTATION_VERSION}. Failed closed.`
    }));
  }
  if (!SUPPORTED_CANONICALIZATION_PROFILES.includes(config.canonicalization_profile)) {
    blockers.push(blocker({
      id: 'BLK-CANON-PROFILE-UNKNOWN', type: 'UNKNOWN_CANONICALIZATION_PROFILE', ruleId: 'R-CFG-002',
      reason: `Canonicalization profile '${config.canonicalization_profile}' is not frozen/allow-listed. A proof hash computed under an unknown profile is not reproducible. Failed closed.`
    }));
  }
  // Contract §3.9 requires exact resolver implementation identity in the proof. A proof that
  // cannot name the engine that produced it is not recoverable.
  if (!isNonEmptyString(config.resolver_commit) || isFloating(config.resolver_commit)) {
    blockers.push(blocker({
      id: 'BLK-RESOLVER-IDENTITY-MISSING', type: 'MISSING_ENGINE_IDENTITY', ruleId: 'R-CFG-003',
      reason: `Resolver implementation identity (resolver_commit) is absent or floating ('${config.resolver_commit ?? null}'). The exact engine must be identifiable for rebuild. Failed closed.`
    }));
  }
  return blockers;
}

/* ================================================================== *
 * INVENTORY PRESENCE — a missing inventory is never an empty inventory.
 * ================================================================== */
function validateInventories(manifest, targetState, ruleset) {
  const blockers = [];
  const required = ruleset.required_inventories[targetState] ?? [];

  for (const name of required) {
    const value = manifest[name];
    if (value === undefined || value === null) {
      blockers.push(blocker({
        id: `BLK-INVENTORY-ABSENT-${name.toUpperCase()}`, type: 'INVENTORY_NOT_DECLARED', ruleId: 'R-INV-001',
        reason: `Required inventory '${name}' is not declared for ${targetState}. An undeclared inventory is not an empty one: absence of a declaration proves nothing and must never read as "no items". Failed closed.`
      }));
      continue;
    }
    const expectArray = name !== 'semantic_coverage_attestation' && name !== 'runtime_target';
    if (expectArray && !Array.isArray(value)) {
      blockers.push(blocker({
        id: `BLK-INVENTORY-MALFORMED-${name.toUpperCase()}`, type: 'MALFORMED_INPUT', ruleId: 'R-INV-002',
        reason: `Inventory '${name}' must be an explicitly declared array. Failed closed.`
      }));
    }
    if (!expectArray && (typeof value !== 'object' || Array.isArray(value))) {
      blockers.push(blocker({
        id: `BLK-INVENTORY-MALFORMED-${name.toUpperCase()}`, type: 'MALFORMED_INPUT', ruleId: 'R-INV-002',
        reason: `Inventory '${name}' must be an explicitly declared object. Failed closed.`
      }));
    }
  }
  return blockers;
}

/* ================================================================== *
 * FIXTURE REGISTRY BINDING
 *
 * ChatGPT re-QA correction: SYNTHETIC_FIXTURE was self-asserted, so a real governed scope
 * escaped its BLOCK by editing one string. Fixture status is now bound to an F2 frozen
 * registry entry and an exact content hash. Anything unregistered defaults to governed.
 * ================================================================== */
function fixtureContentHash(manifest) {
  const { fixture_identity, ...content } = manifest ?? {};
  return canonicalHash(content);
}

function validateFixtureBinding(manifest) {
  const blockers = [];
  const identity = manifest?.fixture_identity;

  if (!identity || typeof identity !== 'object' || !isNonEmptyString(identity.fixture_id)) {
    return [blocker({
      id: 'BLK-FIXTURE-IDENTITY-ABSENT', type: 'FIXTURE_NOT_REGISTERED', ruleId: 'R-FIX-001',
      reason: 'Scope claims SYNTHETIC_FIXTURE but declares no registered fixture identity. Fixture status is not self-assertable; an unregistered scope defaults to governed and blocks while the upstream completeness contract is unavailable. Failed closed.'
    })];
  }

  const entry = FROZEN_FIXTURE_REGISTRY[identity.fixture_id];
  if (!entry) {
    return [blocker({
      id: `BLK-FIXTURE-UNREGISTERED-${identity.fixture_id}`, type: 'FIXTURE_NOT_REGISTERED', ruleId: 'R-FIX-002',
      reason: `Fixture '${identity.fixture_id}' is not present in the F2 frozen fixture registry. Unregistered scopes default to governed and block. Failed closed.`
    })];
  }

  if (identity.fixture_version !== entry.fixture_version) {
    blockers.push(blocker({
      id: `BLK-FIXTURE-VERSION-${identity.fixture_id}`, type: 'FIXTURE_IDENTITY_MISMATCH', ruleId: 'R-FIX-003',
      reason: `Fixture '${identity.fixture_id}' declares version '${identity.fixture_version}' but the registry froze '${entry.fixture_version}'. Failed closed.`
    }));
  }

  const actual = fixtureContentHash(manifest);
  if (actual !== entry.content_hash) {
    blockers.push(blocker({
      id: `BLK-FIXTURE-TAMPERED-${identity.fixture_id}`, type: 'FIXTURE_CONTENT_TAMPERED', ruleId: 'R-FIX-004',
      reason: `Fixture '${identity.fixture_id}' content hash does not match its frozen registry entry. The scope has been modified since it was frozen; evaluating it would prove nothing about the registered artifact. Failed closed.`
    }));
  }
  return blockers;
}

/* ================================================================== *
 * STRUCTURAL VALIDATION — failures yield BLOCKED, never NOT_READY.
 * ================================================================== */
function validateManifest(manifest, targetState, ruleset) {
  const blockers = [];

  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return [blocker({
      id: 'BLK-MANIFEST-MALFORMED', type: 'MALFORMED_INPUT', ruleId: 'R-VAL-001',
      reason: 'Readiness Scope Manifest is absent or not an object. Failed closed.'
    })];
  }

  for (const field of ['scope_id', 'scope_version', 'target_readiness_state', 'scope_class']) {
    if (!isNonEmptyString(manifest[field])) {
      blockers.push(blocker({
        id: `BLK-MANIFEST-FIELD-${field.toUpperCase()}`, type: 'MALFORMED_INPUT', ruleId: 'R-VAL-002',
        reason: `Manifest field '${field}' is missing or empty. Failed closed.`
      }));
    }
  }

  if (manifest.target_readiness_state && !READINESS_STATES.includes(manifest.target_readiness_state)) {
    blockers.push(blocker({
      id: 'BLK-TARGET-UNKNOWN', type: 'UNKNOWN_TARGET_STATE', ruleId: 'R-VAL-003',
      reason: `Unknown readiness target '${manifest.target_readiness_state}'. Failed closed.`
    }));
  }

  if (isFloating(manifest.scope_version)) {
    blockers.push(blocker({
      id: 'BLK-SCOPE-VERSION-FLOATING', type: 'FLOATING_IDENTITY', ruleId: 'R-VAL-004',
      reason: `Scope version '${manifest.scope_version}' is floating or unversioned. Failed closed.`
    }));
  }

  // Scope class gate (contract §7): a real governed scope depends on upstream AR0.3 semantic
  // contracts that are not yet frozen. It must block rather than be judged by fixture rules.
  if (isNonEmptyString(manifest.scope_class)) {
    if (ruleset.blocked_scope_classes.includes(manifest.scope_class)) {
      blockers.push(blocker({
        id: 'BLK-SCOPE-CLASS-UPSTREAM-UNFROZEN', type: 'UPSTREAM_CONTRACTS_UNFROZEN', ruleId: 'R-VAL-018',
        reason: `Scope class '${manifest.scope_class}' requires upstream AR0.3 semantic contracts that are not yet frozen. No production READY may be emitted until they exist. Failed closed.`
      }));
    } else if (!ruleset.evaluable_scope_classes.includes(manifest.scope_class)) {
      blockers.push(blocker({
        id: 'BLK-SCOPE-CLASS-UNKNOWN', type: 'UNKNOWN_SCOPE_CLASS', ruleId: 'R-VAL-019',
        reason: `Scope class '${manifest.scope_class}' is not evaluable under ruleset ${ruleset.ruleset_version}. Failed closed.`
      }));
    } else {
      // Claiming an evaluable class is not enough: the claim must be backed by the frozen registry.
      blockers.push(...validateFixtureBinding(manifest));
    }
  }

  blockers.push(...validateInventories(manifest, targetState, ruleset));

  // ---- objects -----------------------------------------------------------------
  const objects = Array.isArray(manifest.objects) ? manifest.objects : [];
  const seenObjectIds = new Set();
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object' || !isNonEmptyString(obj.object_id)) {
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
        reason: `Duplicate object identity '${obj.object_id}'. Failed closed.`
      }));
    }
    seenObjectIds.add(obj.object_id);

    if (isFloating(obj.object_version)) {
      blockers.push(blocker({
        id: `BLK-OBJECT-FLOATING-${obj.object_id}`, type: 'FLOATING_IDENTITY', ruleId: 'R-VAL-009',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Object '${obj.object_id}' has floating/unversioned identity. Failed closed.`
      }));
    }
    if (!isNonEmptyString(obj.object_hash)) {
      blockers.push(blocker({
        id: `BLK-OBJECT-NOHASH-${obj.object_id}`, type: 'MISSING_IDENTITY', ruleId: 'R-VAL-010',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Object '${obj.object_id}' has no content hash. Failed closed.`
      }));
    }
    if (!isNonEmptyString(obj.authoritative_location_ref)) {
      blockers.push(blocker({
        id: `BLK-OBJECT-NOLOC-${obj.object_id}`, type: 'MISSING_IDENTITY', ruleId: 'R-VAL-020',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Object '${obj.object_id}' has no authoritative location reference; it could not be located during recovery. Failed closed.`
      }));
    }
    if (!Array.isArray(obj.semantic_classes)) {
      blockers.push(blocker({
        id: `BLK-OBJECT-NOCLASSES-${obj.object_id}`, type: 'COVERAGE_NOT_DECLARED', ruleId: 'R-VAL-021',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Object '${obj.object_id}' does not declare which semantic classes it provides; coverage cannot be proven. Failed closed.`
      }));
    }
    if (!Array.isArray(obj.semantic_gaps)) {
      blockers.push(blocker({
        id: `BLK-OBJECT-NOGAPS-${obj.object_id}`, type: 'INVENTORY_NOT_DECLARED', ruleId: 'R-VAL-022',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Object '${obj.object_id}' does not explicitly declare its semantic_gaps inventory. Absence of a declaration is not an absence of gaps. Failed closed.`
      }));
    } else if (ruleset.require_explicit_gap_mandatory) {
      for (const gap of obj.semantic_gaps) {
        if (typeof gap?.mandatory !== 'boolean') {
          blockers.push(blocker({
            id: `BLK-GAP-MANDATORY-UNSTATED-${obj.object_id}-${gap?.gap_id ?? 'UNSPECIFIED'}`,
            type: 'MALFORMED_INPUT', ruleId: 'R-VAL-023', objectId: obj.object_id, zone: obj.zone ?? null,
            reason: `Gap '${gap?.gap_id ?? 'UNSPECIFIED'}' on '${obj.object_id}' does not state 'mandatory' explicitly. The resolver applies no default severity. Failed closed.`
          }));
        }
      }
    }
    if (!Array.isArray(obj.references)) {
      blockers.push(blocker({
        id: `BLK-OBJECT-NOREFS-${obj.object_id}`, type: 'INVENTORY_NOT_DECLARED', ruleId: 'R-VAL-024',
        objectId: obj.object_id, zone: obj.zone ?? null,
        reason: `Object '${obj.object_id}' does not explicitly declare its references inventory. Failed closed.`
      }));
    }
  }

  // ---- dependencies ------------------------------------------------------------
  const dependencies = Array.isArray(manifest.dependencies) ? manifest.dependencies : [];
  for (const dep of dependencies) {
    if (!dep || typeof dep !== 'object' || !isNonEmptyString(dep.dependency_id)) {
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
        reason: `Dependency '${dep.dependency_id}' resolves to floating version '${dep.dependency_version}'. Failed closed.`
      }));
    }
    if (!isNonEmptyString(dep.dependency_hash)) {
      blockers.push(blocker({
        id: `BLK-DEP-NOHASH-${dep.dependency_id}`, type: 'MISSING_IDENTITY', ruleId: 'R-VAL-025',
        dependencyId: dep.dependency_id,
        reason: `Dependency '${dep.dependency_id}' has no content hash. Its integrity cannot be verified on rebuild. Failed closed.`
      }));
    }
    // Allow-list, not deny-list: an unrecognized or misspelled state blocks.
    if (!ruleset.dependency_states_satisfying_closure.includes(dep.status)) {
      blockers.push(blocker({
        id: `BLK-DEP-STATE-${dep.dependency_id}`, type: 'DEPENDENCY_CLOSURE_INCOMPLETE', ruleId: 'R-VAL-013',
        dependencyId: dep.dependency_id,
        reason: `Dependency '${dep.dependency_id}' has status '${dep.status ?? null}', which is not an allow-listed closure-satisfying state (${ruleset.dependency_states_satisfying_closure.join(', ')}). Failed closed.`
      }));
    }
    if (!isNonEmptyString(dep.authoritative_location_ref)) {
      blockers.push(blocker({
        id: `BLK-DEP-NOLOC-${dep.dependency_id}`, type: 'MISSING_IDENTITY', ruleId: 'R-VAL-014',
        dependencyId: dep.dependency_id,
        reason: `Dependency '${dep.dependency_id}' has no authoritative location reference. Failed closed.`
      }));
    }
  }

  // ---- dangling references -----------------------------------------------------
  for (const obj of objects) {
    const refs = Array.isArray(obj?.references) ? obj.references : [];
    for (const ref of refs) {
      if (!seenObjectIds.has(ref)) {
        blockers.push(blocker({
          id: `BLK-REF-DANGLING-${obj.object_id}-${ref}`, type: 'REFERENCE_INTEGRITY', ruleId: 'R-VAL-015',
          objectId: obj.object_id, zone: obj.zone ?? null,
          reason: `Object '${obj.object_id}' references '${ref}', which is not in the declared version-closed scope. Failed closed.`
        }));
      }
    }
  }

  // ---- NOT_APPLICABLE waivers --------------------------------------------------
  const naDecisions = Array.isArray(manifest.not_applicable_decisions) ? manifest.not_applicable_decisions : [];
  for (const na of naDecisions) {
    if (!na || typeof na !== 'object' || !isNonEmptyString(na.item_id)) {
      blockers.push(blocker({
        id: 'BLK-NA-MALFORMED', type: 'MALFORMED_INPUT', ruleId: 'R-VAL-016',
        reason: 'A NOT_APPLICABLE decision entry is malformed or missing item_id. Failed closed.'
      }));
      continue;
    }
    // State-level applicability is NOT authorized in V1 (ChatGPT re-QA correction). Without
    // this, an item-level waivable rule could waive an entire readiness state and zero out
    // every criterion for it.
    if (READINESS_STATES.includes(na.item_id)) {
      blockers.push(blocker({
        id: `BLK-NA-STATE-LEVEL-${na.item_id}`, type: 'STATE_LEVEL_NA_NOT_AUTHORIZED', ruleId: 'R-VAL-033',
        objectId: na.item_id,
        reason: `NOT_APPLICABLE targets readiness state '${na.item_id}'. State-level applicability is not authorized under ${ruleset.ruleset_version}; N/A is confined to explicitly waivable items/rules. A future ruleset must authorize state-level applicability separately. Failed closed.`
      }));
    }
    // Validated against the FROZEN authority allow-list and waivable-rule list — not merely
    // checked for non-empty strings.
    if (!ruleset.waiver_authorities.includes(na.authority)) {
      blockers.push(blocker({
        id: `BLK-NA-AUTHORITY-${na.item_id}`, type: 'UNAUTHORIZED_NOT_APPLICABLE', ruleId: 'R-VAL-017',
        objectId: na.item_id,
        reason: `NOT_APPLICABLE for '${na.item_id}' cites authority '${na.authority ?? null}', which is not an allow-listed waiver authority. Failed closed.`
      }));
    }
    if (!ruleset.waivable_rule_ids.includes(na.waives_rule_id)) {
      blockers.push(blocker({
        id: `BLK-NA-RULE-${na.item_id}`, type: 'UNAUTHORIZED_NOT_APPLICABLE', ruleId: 'R-VAL-026',
        objectId: na.item_id,
        reason: `NOT_APPLICABLE for '${na.item_id}' claims to waive rule '${na.waives_rule_id ?? null}', which is not a waivable rule under ${ruleset.ruleset_version}. Failed closed.`
      }));
    }
    if (!isNonEmptyString(na.decision_id) || isFloating(na.decision_version)) {
      blockers.push(blocker({
        id: `BLK-NA-DECISION-${na.item_id}`, type: 'UNAUTHORIZED_NOT_APPLICABLE', ruleId: 'R-VAL-027',
        objectId: na.item_id,
        reason: `NOT_APPLICABLE for '${na.item_id}' lacks a versioned governed decision identity. Failed closed.`
      }));
    }
  }

  // ---- semantic coverage attestation -------------------------------------------
  const att = manifest.semantic_coverage_attestation;
  if (att && typeof att === 'object' && !Array.isArray(att)) {
    if (!ruleset.waiver_authorities.includes(att.authority)) {
      blockers.push(blocker({
        id: 'BLK-ATTESTATION-AUTHORITY', type: 'UNAUTHORIZED_ATTESTATION', ruleId: 'R-VAL-028',
        reason: `Semantic coverage attestation cites authority '${att.authority ?? null}', which is not allow-listed. Failed closed.`
      }));
    }
    if (!isNonEmptyString(att.attestation_id) || isFloating(att.attestation_version)) {
      blockers.push(blocker({
        id: 'BLK-ATTESTATION-IDENTITY', type: 'UNAUTHORIZED_ATTESTATION', ruleId: 'R-VAL-029',
        reason: 'Semantic coverage attestation lacks a versioned identity. Failed closed.'
      }));
    }
    if (!Array.isArray(att.required_semantic_classes) || att.required_semantic_classes.length === 0) {
      blockers.push(blocker({
        id: 'BLK-ATTESTATION-NO-REQUIRED-CLASSES', type: 'COVERAGE_NOT_DECLARED', ruleId: 'R-VAL-030',
        reason: 'Semantic coverage attestation declares no required semantic classes. A completeness proof over an empty requirement set proves nothing. Failed closed.'
      }));
    }
  }

  // ---- runtime target ----------------------------------------------------------
  if (targetState === 'RUNTIME_IMPLEMENTATION_READY') {
    const t = manifest.runtime_target;
    if (t && typeof t === 'object' && !Array.isArray(t)) {
      if (!Array.isArray(t.gaps)) {
        blockers.push(blocker({
          id: 'BLK-RUNTIME-GAPS-NOT-DECLARED', type: 'INVENTORY_NOT_DECLARED', ruleId: 'R-VAL-031', zone: 'Z6',
          reason: 'Runtime target does not explicitly declare its gaps inventory. Absence of a declaration is not an absence of gaps. Failed closed.'
        }));
      }
      if (!Array.isArray(t.runtime_requirements)) {
        blockers.push(blocker({
          id: 'BLK-RUNTIME-REQS-NOT-DECLARED', type: 'INVENTORY_NOT_DECLARED', ruleId: 'R-VAL-032', zone: 'Z6',
          reason: 'Runtime target does not explicitly declare its implementation/configuration/integration requirements inventory. Failed closed.'
        }));
      }
    }
  }

  return blockers;
}

/* ================================================================== *
 * PREDECESSOR LINEAGE
 * ================================================================== */
function verifyPredecessorLineage(manifest, predecessorState, computedProof) {
  const blockers = [];
  const supplied = Array.isArray(manifest.predecessor_proofs)
    ? manifest.predecessor_proofs.find(p => p?.state === predecessorState)
    : null;
  if (!supplied) return blockers;

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
      reason: `Supplied ${predecessorState} proof claims '${supplied.result}' but re-evaluation yields '${computedProof.result}'. Contradictory governed inputs. Failed closed.`
    }));
  }
  return blockers;
}

/* ================================================================== *
 * STATE CRITERIA — failures yield NOT_READY (validly evaluated, criteria fail).
 * ================================================================== */
function evaluateDomain(manifest, ruleset) {
  const blockers = [];
  const objects = manifest.objects;
  const att = manifest.semantic_coverage_attestation;

  // POSITIVE COVERAGE PROOF. This is the correction that kills the empty-scope false
  // positive: required classes must be demonstrably provided by in-scope objects, rather
  // than readiness being inferred from nobody having declared a problem.
  const provided = new Set();
  for (const obj of objects) {
    for (const cls of (Array.isArray(obj?.semantic_classes) ? obj.semantic_classes : [])) provided.add(cls);
  }
  for (const required of att.required_semantic_classes) {
    if (!provided.has(required)) {
      blockers.push(blocker({
        id: `COVERAGE-MISSING-${required}`, type: 'SEMANTIC_COVERAGE_INCOMPLETE', ruleId: 'R-DOM-003',
        zone: 'Z1', severity: 'NOT_READY',
        reason: `Required semantic class '${required}' is not provided by any object in the declared scope. Readiness requires proven coverage, not absence of objections.`
      }));
    }
  }

  // Attested coverage must not exceed what the scope actually provides.
  for (const claimed of (Array.isArray(att.covered_semantic_classes) ? att.covered_semantic_classes : [])) {
    if (!provided.has(claimed)) {
      blockers.push(blocker({
        id: `COVERAGE-OVERCLAIMED-${claimed}`, type: 'COVERAGE_OVERCLAIMED', ruleId: 'R-DOM-004',
        zone: 'Z1', severity: 'NOT_READY',
        reason: `Attestation claims coverage of '${claimed}' but no in-scope object provides it. Attested coverage must be corroborated by scope content.`
      }));
    }
  }

  for (const obj of objects) {
    for (const gap of obj.semantic_gaps) {
      if (gap.mandatory !== true) continue;      // explicit by validation; no default applied
      if (gap?.status === 'RESOLVED') continue;
      blockers.push(blocker({
        id: `GAP-${obj.object_id}-${gap?.gap_id ?? 'UNSPECIFIED'}`, type: 'SEMANTIC_GAP', ruleId: 'R-DOM-001',
        objectId: obj.object_id, zone: obj.zone ?? 'Z1', severity: 'NOT_READY',
        reason: `Unresolved mandatory reusable semantic gap on '${obj.object_id}': ${gap?.description ?? 'no description supplied'}.`
      }));
    }
    if (!isNonEmptyString(obj?.provenance_ref)) {
      blockers.push(blocker({
        id: `PROV-MISSING-${obj.object_id}`, type: 'PROVENANCE_MISSING', ruleId: 'R-DOM-002',
        objectId: obj.object_id, zone: obj.zone ?? 'Z1', severity: 'NOT_READY',
        reason: `Object '${obj.object_id}' is not source/provenance controlled.`
      }));
    }
  }
  return blockers;
}

function authorizedWaivers(manifest, ruleset, ruleId) {
  return new Set(
    manifest.not_applicable_decisions
      .filter(na =>
        ruleset.waiver_authorities.includes(na?.authority) &&
        na?.waives_rule_id === ruleId &&
        isNonEmptyString(na?.decision_id) &&
        !isFloating(na?.decision_version))
      .map(na => na.item_id)
  );
}

function evaluateEnterprise(manifest, ruleset) {
  const blockers = [];
  const waived = authorizedWaivers(manifest, ruleset, 'R-ENT-001');

  for (const req of manifest.binding_requirements) {
    if (!isNonEmptyString(req?.requirement_id)) continue;
    if (waived.has(req.requirement_id)) continue;
    if (isNonEmptyString(req.resolved_value_ref)) continue;
    blockers.push(blocker({
      id: `BIND-UNRESOLVED-${req.requirement_id}`, type: 'BINDING_UNRESOLVED', ruleId: 'R-ENT-001',
      objectId: req.requirement_id, zone: 'Z2', severity: 'NOT_READY',
      reason: `Declared binding requirement '${req.requirement_id}' has no resolved enterprise value and no authorized NOT_APPLICABLE waiver.`
    }));
  }
  return blockers;
}

function evaluateRuntime(manifest, ruleset) {
  const blockers = [];
  const t = manifest.runtime_target;
  const waived = authorizedWaivers(manifest, ruleset, 'R-RUN-005');

  if (!isNonEmptyString(t.tool_id) || isFloating(t.tool_version)) {
    blockers.push(blocker({
      id: 'RUNTIME-TARGET-UNVERSIONED', type: 'RUNTIME_TARGET_MISSING', ruleId: 'R-RUN-002',
      zone: 'Z6', severity: 'NOT_READY',
      reason: `Runtime target is not version-identified (tool_id='${t.tool_id ?? null}', tool_version='${t.tool_version ?? null}').`
    }));
  }
  if (!isNonEmptyString(t.specification_ref)) {
    blockers.push(blocker({
      id: 'RUNTIME-SPEC-MISSING', type: 'SPECIFICATION_MISSING', ruleId: 'R-RUN-003',
      zone: 'Z6', severity: 'NOT_READY',
      reason: 'No version-closed specification/projection exists for the declared runtime target.'
    }));
  }
  if (!isNonEmptyString(t.capability_profile_ref)) {
    blockers.push(blocker({
      id: 'RUNTIME-CAPABILITY-PROFILE-MISSING', type: 'CAPABILITY_PROFILE_MISSING', ruleId: 'R-RUN-004',
      zone: 'Z6', severity: 'NOT_READY',
      reason: 'No capability profile is declared for the runtime target.'
    }));
  }
  for (const gap of t.gaps) {
    if (gap?.status === 'RESOLVED' || waived.has(gap?.gap_id)) continue;
    blockers.push(blocker({
      id: `RUNTIME-GAP-${gap?.gap_id ?? 'UNSPECIFIED'}`, type: 'RUNTIME_GAP', ruleId: 'R-RUN-005',
      zone: 'Z6', severity: 'NOT_READY',
      reason: `Runtime gap '${gap?.gap_id ?? 'UNSPECIFIED'}' is neither resolved nor covered by an authorized waiver: ${gap?.description ?? 'no description supplied'}.`
    }));
  }
  // Implementation/configuration/integration requirements must be positively closed.
  for (const req of t.runtime_requirements) {
    if (req?.status === 'RESOLVED' || req?.status === 'GOVERNED') continue;
    blockers.push(blocker({
      id: `RUNTIME-REQ-${req?.requirement_id ?? 'UNSPECIFIED'}`, type: 'RUNTIME_REQUIREMENT_OPEN', ruleId: 'R-RUN-006',
      zone: 'Z6', severity: 'NOT_READY',
      reason: `Runtime implementation/configuration/integration requirement '${req?.requirement_id ?? 'UNSPECIFIED'}' is not resolved or governed (status='${req?.status ?? null}').`
    }));
  }
  return blockers;
}

const STATE_EVALUATORS = Object.freeze({
  DOMAIN_EXECUTION_READY: evaluateDomain,
  ENTERPRISE_EXECUTION_READY: evaluateEnterprise,
  RUNTIME_IMPLEMENTATION_READY: evaluateRuntime
});

const RULE_IDS_BY_STATE = Object.freeze({
  DOMAIN_EXECUTION_READY: ['R-DOM-001', 'R-DOM-002', 'R-DOM-003', 'R-DOM-004'],
  ENTERPRISE_EXECUTION_READY: ['R-ENT-001'],
  RUNTIME_IMPLEMENTATION_READY: ['R-RUN-002', 'R-RUN-003', 'R-RUN-004', 'R-RUN-005', 'R-RUN-006']
});

/* ================================================================== *
 * CORE EVALUATION
 * ================================================================== */
function evaluateState(manifest, targetState, config, ruleset) {
  const predecessorState = PREDECESSOR[targetState];
  const predecessorProofs = [];

  if (predecessorState) {
    const predecessorProof = evaluateState(manifest, predecessorState, config, ruleset);
    predecessorProofs.push(
      ...predecessorProof.predecessor_proofs,
      { state: predecessorState, proof_id: predecessorProof.proof_id,
        semantic_result_hash: predecessorProof.semantic_result_hash, result: predecessorProof.result }
    );

    const lineageBlockers = verifyPredecessorLineage(manifest, predecessorState, predecessorProof);

    if (lineageBlockers.length > 0 || predecessorProof.result !== 'READY') {
      const directCause = lineageBlockers.length > 0 ? lineageBlockers : [blocker({
        id: `BLK-PREDECESSOR-${predecessorState}`, type: 'PREDECESSOR_NOT_READY', ruleId: 'R-MONO-001',
        causalParentId: predecessorProof.proof_id,
        reason: `${targetState} cannot be evaluated because mandatory predecessor ${predecessorState} is '${predecessorProof.result}', not READY.`
      })];
      // Root-cause propagation (retained from V1; passed QA).
      const inheritedCause = predecessorProof.blockers.map(b => ({
        ...b, causal_parent_id: b.causal_parent_id ?? predecessorProof.proof_id
      }));
      return buildResult({
        manifest, targetState, config, ruleset, result: 'BLOCKED',
        blockers: [...directCause, ...inheritedCause], predecessorProofs,
        monotonicityPassed: false, dependencyChainStatus: 'NOT_EVALUATED_PREDECESSOR_BLOCKED',
        ruleEvaluations: []
      });
    }
  }

  const structuralBlockers = validateManifest(manifest, targetState, ruleset);
  if (structuralBlockers.length > 0) {
    return buildResult({
      manifest, targetState, config, ruleset, result: 'BLOCKED',
      blockers: structuralBlockers, predecessorProofs, monotonicityPassed: true,
      dependencyChainStatus: 'NOT_EVALUATED_INPUT_INVALID', ruleEvaluations: []
    });
  }

  // NOTE: there is deliberately NO whole-readiness-state NOT_APPLICABLE path in V1. A state
  // cannot be waived; only explicitly waivable items/rules can. Attempting a state-level
  // waiver is rejected during structural validation (R-VAL-033).

  const criteriaBlockers = STATE_EVALUATORS[targetState](manifest, ruleset);
  const failedRuleIds = new Set(criteriaBlockers.map(b => b.rule_id));

  return buildResult({
    manifest, targetState, config, ruleset,
    result: criteriaBlockers.length === 0 ? 'READY' : 'NOT_READY',
    blockers: criteriaBlockers, predecessorProofs, monotonicityPassed: true,
    dependencyChainStatus: 'EVALUATED',
    ruleEvaluations: RULE_IDS_BY_STATE[targetState].map(ruleId => ({
      rule_id: ruleId, rule_version: ruleset.ruleset_version,
      result: failedRuleIds.has(ruleId) ? 'FAIL' : 'PASS',
      evidence_refs: criteriaBlockers.filter(b => b.rule_id === ruleId).map(b => b.blocker_id)
    }))
  });
}

function buildDependencyChain(manifest) {
  const deps = Array.isArray(manifest?.dependencies) ? manifest.dependencies : [];
  return deps.map(d => ({
    dependency_id: d?.dependency_id ?? null, dependency_version: d?.dependency_version ?? null,
    dependency_hash: d?.dependency_hash ?? null, status: d?.status ?? 'UNDECLARED',
    authoritative_location_ref: d?.authoritative_location_ref ?? null
  }));
}

// Contract §3.9: the proof must carry exact, recoverable input identities and locations, so
// a new operator can locate every input without the originating session.
function buildInputIdentities(manifest) {
  const objs = Array.isArray(manifest?.objects) ? manifest.objects : [];
  return objs.map(o => ({
    object_id: o?.object_id ?? null, object_version: o?.object_version ?? null,
    object_hash: o?.object_hash ?? null, authoritative_location_ref: o?.authoritative_location_ref ?? null
  }));
}

function buildResult({ manifest, targetState, config, ruleset, result, blockers, predecessorProofs, monotonicityPassed, dependencyChainStatus, ruleEvaluations }) {
  const profile = config.canonicalization_profile;
  const hashable = SUPPORTED_CANONICALIZATION_PROFILES.includes(profile) ? profile : 'canonical-json-sha256-v1';

  const semanticCore = {
    scope_id: manifest?.scope_id ?? null,
    scope_version: manifest?.scope_version ?? null,
    scope_class: manifest?.scope_class ?? null,
    state_evaluated: targetState,
    result,
    blockers,
    dependency_chain: buildDependencyChain(manifest),
    dependency_chain_status: dependencyChainStatus,
    input_object_identities: buildInputIdentities(manifest),
    predecessor_proofs: predecessorProofs,
    rule_evaluations: ruleEvaluations,
    monotonicity_check: { passed: monotonicityPassed, predecessor_states_checked: predecessorProofs.map(p => p.state) },
    identity: {
      generator_contract_version: GENERATOR_CONTRACT_VERSION,
      resolver_implementation_version: RESOLVER_IMPLEMENTATION_VERSION,
      resolver_commit: config.resolver_commit ?? null,
      ruleset_version: config.ruleset_version ?? null,
      canonicalization_profile: profile ?? null,
      configuration_hash: canonicalHash({
        ruleset_version: config.ruleset_version ?? null,
        canonicalization_profile: profile ?? null,
        resolver_commit: config.resolver_commit ?? null
      }, hashable),
      input_manifest_hash: canonicalHash(manifest ?? null, hashable)
    },
    lifecycle: 'CANDIDATE'
  };

  semanticCore.proof_id = `proof:${targetState}:${canonicalHash(semanticCore, hashable).slice(0, 16)}`;
  return { ...semanticCore, semantic_result_hash: semanticResultHash(semanticCore, hashable) };
}

/**
 * Evaluate readiness for a declared scope.
 * Pure and deterministic: identical frozen inputs + identical config produce an identical
 * semantic_result_hash. Run metadata and environment identity are attached outside this
 * function so no impure read can occur inside it.
 */
export function resolveReadiness(manifest, config = {}) {
  const effectiveConfig = {
    ruleset_version: config.ruleset_version ?? null,
    canonicalization_profile: config.canonicalization_profile ?? 'canonical-json-sha256-v1',
    resolver_commit: config.resolver_commit ?? null
  };

  const configBlockers = validateConfig(effectiveConfig);
  const target = manifest?.target_readiness_state;
  const ruleset = FROZEN_RULESETS[effectiveConfig.ruleset_version];

  if (configBlockers.length > 0 || !ruleset) {
    return buildResult({
      manifest, targetState: (target && READINESS_STATES.includes(target)) ? target : 'UNKNOWN',
      config: effectiveConfig, ruleset: null, result: 'BLOCKED',
      blockers: configBlockers.length > 0 ? configBlockers : [blocker({
        id: 'BLK-RULESET-UNKNOWN', type: 'UNKNOWN_RULESET', ruleId: 'R-CFG-001',
        reason: `Ruleset '${effectiveConfig.ruleset_version}' is not frozen/known. Failed closed.`
      })],
      predecessorProofs: [], monotonicityPassed: false,
      dependencyChainStatus: 'NOT_EVALUATED_CONFIG_INVALID', ruleEvaluations: []
    });
  }

  if (!target || !READINESS_STATES.includes(target)) {
    return buildResult({
      manifest, targetState: target ?? 'UNKNOWN', config: effectiveConfig, ruleset,
      result: 'BLOCKED',
      blockers: validateManifest(manifest, 'DOMAIN_EXECUTION_READY', ruleset),
      predecessorProofs: [], monotonicityPassed: false,
      dependencyChainStatus: 'NOT_EVALUATED_INPUT_INVALID', ruleEvaluations: []
    });
  }

  return evaluateState(manifest, target, effectiveConfig, ruleset);
}

/**
 * Attach non-semantic run and environment context. Separate from resolveReadiness so no
 * clock read or environment probe occurs inside the deterministic evaluation function.
 * Both blocks are excluded from the semantic hash by SEMANTIC_EXCLUDED_KEYS.
 */
export function attachRunContext(result, { evaluation_run_id, evaluation_timestamp, environment = null }) {
  return {
    ...result,
    run_metadata: { evaluation_run_id, evaluation_timestamp },
    environment: environment ?? {
      runtime: `node ${process.version}`,
      platform: `${process.platform}-${process.arch}`
    }
  };
}
