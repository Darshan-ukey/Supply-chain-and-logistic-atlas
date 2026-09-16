import { createHash } from 'node:crypto';

// Atlas AR0.3 — canonical serialization for the readiness resolver.
//
// The G1 determinism guarantee in READINESS_VERIFICATION_CONTRACT §2 requires that the
// *semantic* result be byte-reproducible. That is only true if serialization is itself
// deterministic, so key order must never depend on object construction order.
//
// ChatGPT's verification correction (§3.6, §10) separated deterministic semantic content
// from non-deterministic run metadata. That separation is enforced here, not left to the
// caller's discipline: SEMANTIC_EXCLUDED_KEYS are stripped before hashing.

// Excluded from the semantic hash because they legitimately differ between identical runs.
// Contract §2: "metadata such as execution timestamp/run ID may differ between runs but is
// excluded from the semantic result hash".
export const SEMANTIC_EXCLUDED_KEYS = Object.freeze(['run_metadata', 'semantic_result_hash']);

/**
 * Recursively canonicalize a value: object keys sorted, arrays order-preserved.
 * Array order is preserved deliberately — for blockers and dependency chains the order
 * carries meaning (evaluation sequence), so sorting them would destroy information.
 * Determinism is instead guaranteed by the resolver emitting them in a fixed rule order.
 */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue; // undefined is not representable in JSON; drop rather than emit null
    out[key] = canonicalize(value[key]);
  }
  return out;
}

/** Deterministic JSON string. No whitespace, sorted keys. */
export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

/** SHA-256 over the canonical JSON form. */
export function canonicalHash(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/**
 * Compute the semantic result hash for a ReadinessResult, excluding non-semantic run metadata.
 * This is the value compared during a PC-5 rebuild proof.
 */
export function semanticResultHash(result) {
  const semantic = {};
  for (const key of Object.keys(result)) {
    if (SEMANTIC_EXCLUDED_KEYS.includes(key)) continue;
    semantic[key] = result[key];
  }
  return canonicalHash(semantic);
}
