// Atlas AR0.3 — frozen readiness rulesets.
//
// ChatGPT QA correction: V1 accepted any non-empty string as a waiver authority, used a
// deny-list for dependency states (so an unrecognized or misspelled state passed), and
// applied an invented `mandatory=true` default in code. Contract §3.8 forbids implicit
// defaults that materially change readiness semantics — material defaults must be versioned
// in the ruleset. Everything of that kind now lives here, frozen and allow-listed.

export const FROZEN_RULESETS = Object.freeze({
  'readiness-ruleset-v1': Object.freeze({
    ruleset_version: 'readiness-ruleset-v1',

    // Only these scope classes are evaluable. A real governed scope depends on upstream
    // AR0.3 semantic contracts that are NOT yet frozen, so it must block rather than be
    // evaluated against fixture-grade assumptions (contract §7).
    evaluable_scope_classes: Object.freeze(['SYNTHETIC_FIXTURE']),
    blocked_scope_classes: Object.freeze(['GOVERNED_SCOPE']),

    // Allow-list: only these dependency states satisfy closure. Anything else — including an
    // unrecognized or misspelled state — blocks.
    dependency_states_satisfying_closure: Object.freeze(['PRESENT_VERIFIED']),

    // Waivers. An authority not on this list cannot issue NOT_APPLICABLE, and only these
    // rules may be waived at all.
    waiver_authorities: Object.freeze(['owner:darshan-ukey']),
    waivable_rule_ids: Object.freeze(['R-ENT-001', 'R-RUN-005']),

    // No implicit gap severity. A gap entry must state `mandatory` explicitly.
    require_explicit_gap_mandatory: true,

    // Inventories that must be explicitly present per target state. A missing inventory is
    // never treated as an empty one.
    required_inventories: Object.freeze({
      DOMAIN_EXECUTION_READY: Object.freeze(['objects', 'dependencies', 'semantic_coverage_attestation']),
      ENTERPRISE_EXECUTION_READY: Object.freeze(['objects', 'dependencies', 'semantic_coverage_attestation', 'binding_requirements', 'not_applicable_decisions']),
      RUNTIME_IMPLEMENTATION_READY: Object.freeze(['objects', 'dependencies', 'semantic_coverage_attestation', 'binding_requirements', 'not_applicable_decisions', 'runtime_target'])
    })
  })
});

export const SUPPORTED_RULESET_VERSIONS = Object.freeze(Object.keys(FROZEN_RULESETS));
