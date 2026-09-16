import { createHash } from 'node:crypto';

// Atlas AR0.3 — canonical serialization for the readiness resolver.
//
// The G1 determinism guarantee (contract §2) requires the *semantic* result to be
// reproducible. Two things break that if left implicit, and both are handled here rather
// than left to caller discipline:
//
//   1. Key order. Object keys are sorted, so construction order cannot leak into the hash.
//   2. Collection order. An unordered SET whose elements arrive in a different order is
//      semantically identical and must hash identically. An ordered SEQUENCE must not be
//      reordered, because position carries meaning.
//
// ChatGPT QA correction: V1 treated every array as ordered, so a permuted object list
// produced a different hash for a semantically identical scope. The profile below makes
// ordered-vs-unordered an explicit, frozen, allow-listed decision instead of an accident.

export const SEMANTIC_EXCLUDED_KEYS = Object.freeze(['run_metadata', 'environment', 'semantic_result_hash']);

// Collections whose element order carries NO meaning. Hashed order-independently.
const UNORDERED_COLLECTION_KEYS = Object.freeze([
  'objects', 'dependencies', 'binding_requirements', 'not_applicable_decisions',
  'semantic_gaps', 'semantic_classes', 'references', 'gaps', 'runtime_requirements',
  'required_semantic_classes', 'covered_semantic_classes',
  'blockers', 'dependency_chain', 'rule_evaluations', 'evidence_refs',
  'predecessor_states_checked', 'input_object_identities', 'dependency_identities'
]);

// Collections whose element order DOES carry meaning. Never reordered.
const ORDERED_COLLECTION_KEYS = Object.freeze(['predecessor_proofs']);

export const CANONICALIZATION_PROFILES = Object.freeze({
  'canonical-json-sha256-v1': Object.freeze({
    profile_id: 'canonical-json-sha256-v1',
    hash_algorithm: 'sha256',
    key_ordering: 'lexicographic',
    unordered_collection_keys: UNORDERED_COLLECTION_KEYS,
    ordered_collection_keys: ORDERED_COLLECTION_KEYS
  })
});

export const SUPPORTED_CANONICALIZATION_PROFILES = Object.freeze(Object.keys(CANONICALIZATION_PROFILES));

function sortUnordered(items) {
  // Sort by the canonical form of each element, so ordering is content-derived and stable
  // regardless of how the caller assembled the collection.
  return items
    .map(item => ({ item, key: JSON.stringify(item) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(entry => entry.item);
}

function canonicalizeNode(value, parentKey, profile) {
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    const canonicalItems = value.map(item => canonicalizeNode(item, null, profile));
    if (profile.unordered_collection_keys.includes(parentKey)) return sortUnordered(canonicalItems);
    return canonicalItems; // ordered, or an unrecognized key: preserve order, never guess
  }

  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue; // not representable in JSON; drop rather than emit null
    out[key] = canonicalizeNode(value[key], key, profile);
  }
  return out;
}

function resolveProfile(profileId) {
  const profile = CANONICALIZATION_PROFILES[profileId];
  if (!profile) {
    throw new Error(
      `Canonicalization profile '${profileId}' is not a frozen allow-listed profile. ` +
      `Known profiles: ${SUPPORTED_CANONICALIZATION_PROFILES.join(', ')}.`
    );
  }
  return profile;
}

export function canonicalize(value, profileId = 'canonical-json-sha256-v1') {
  return canonicalizeNode(value, null, resolveProfile(profileId));
}

export function canonicalJson(value, profileId = 'canonical-json-sha256-v1') {
  return JSON.stringify(canonicalize(value, profileId));
}

export function canonicalHash(value, profileId = 'canonical-json-sha256-v1') {
  const profile = resolveProfile(profileId);
  return createHash(profile.hash_algorithm).update(canonicalJson(value, profileId), 'utf8').digest('hex');
}

/**
 * Semantic result hash: excludes non-semantic run metadata and environment identity.
 *
 * Environment identity is recorded on the proof for recovery (contract §3.9) but excluded
 * here deliberately — including it would make the hash machine-specific and destroy the
 * cross-environment reproducibility the hash exists to prove.
 */
export function semanticResultHash(result, profileId = 'canonical-json-sha256-v1') {
  const semantic = {};
  for (const key of Object.keys(result)) {
    if (SEMANTIC_EXCLUDED_KEYS.includes(key)) continue;
    semantic[key] = result[key];
  }
  return canonicalHash(semantic, profileId);
}
