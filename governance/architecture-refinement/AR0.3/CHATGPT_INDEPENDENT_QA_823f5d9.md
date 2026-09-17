# ChatGPT Independent QA — Claude handoff `823f5d9`

**Scope:** independent QA of the four bounded deliverables in Claude commit `823f5d99c4a05a1fde52b1365c3f443586731ffd` only. No Drive write, no Supabase execution, no P6.x restart, no reconstruction work.

## Overall disposition

`INDEPENDENT_QA_COMPLETE__BOUNDED_CORRECTIONS_REQUIRED_BEFORE_EXECUTION`

The handoff is directionally sound and materially improves the control posture, but two documents require bounded correction before B can be executed, and A2 evidence cannot yet be independently reverified because the actual custody files remain only in Claude's container.

## 1. A2 custody integrity recheck

**Disposition:** `STRUCTURE_PASS__INDEPENDENT_EVIDENCE_QA_BLOCKED`

What passes:
- Correctly distinguishes the Git record from the actual custody files.
- Correctly states that A2 is not closed while the files remain only in ephemeral/session-local storage.
- The proposed ZIP approach is a sound way to avoid Google-native conversion risk.
- No false claim of completed Drive custody is made.

What remains blocked:
- ChatGPT cannot independently recompute the five hashes because the four drill files + manifest are not in GitHub or governed Drive custody and are not available to this reviewer.
- Therefore Claude's reported `sha256sum -c: 5/5 OK` is accepted only as Claude's evidence, not as crossed independent QA.

**Closure condition:** upload one byte-preserving ZIP to governed Drive custody, record immutable Drive identity/location and ZIP SHA-256, then ChatGPT independently downloads/reads the custody artifact and verifies the manifest and contained file hashes. Until then: `A2 OPEN`.

## 2. P6.1 read-only restore-test specification

**Disposition:** `FAIL__BOUNDED_CORRECTIONS_REQUIRED`

The specification is careful about row identity, encoding discrepancy, counts, write prohibition, and per-task verification. However, as written it is a retrieval/verification procedure, not yet a full independent recovery proof.

Required corrections before execution:

### B-1 — independent restore is missing
The procedure permits a read-only production query as the fallback and then validates the retrieved payload locally. That proves retrieval, not independent restoration. PC-5 recovery closure requires proving the protected artifact can be recovered without relying on the live production row after export.

**Required change:** after exact export + custody freeze, restore the exported artifact into a disposable isolated recovery environment or equivalent non-production verification harness built from the governed schema/recovery envelope. The restore step must consume the exported custody artifact, not re-read the production row.

### B-2 — hash semantics are assumed too early
The specification requires the SHA-256 of the **decoded payload** to equal `protectedStoreContentHash`. But the governed evidence currently establishes that value as the protected-store content hash; it does not yet prove whether the hash was computed over decoded JSON, stored compressed bytes, canonical serialized JSON, or another exact representation.

**Required change:** first compare the stored row's own `content_hash` field to the certification value. Then identify/cite the exact historical hash construction rule if available. Only after the hash domain is established may PASS require recomputation over a specific representation. Do not hard-code `decoded payload` as the hash domain without proof.

### B-3 — exact export is underspecified
`Export the exact retrieved row ... as returned` is not sufficient for immutable-byte recovery because a connector/client can reserialize JSON, normalize whitespace, change ordering, or represent null/binary values differently.

**Required change:** define a canonical recovery export envelope or database-native/raw export method with explicit serialization rules and hash the resulting artifact. The artifact used for later restore must be exactly the artifact placed into independent custody.

### B-4 — per-task hash recomputation requires algorithm identity
The spec says to recompute all 22 `contentHashSha256` values but does not bind that operation to the exact canonicalization/serialization/hash algorithm and implementation/version that originally produced those hashes.

**Required change:** cite the exact governed algorithm/profile/implementation commit used to construct the 22 hashes, or if that identity cannot be proven, downgrade the check to comparison of stored certified values and report algorithm provenance as unresolved rather than inventing a recomputation method.

The BROTLI-vs-JSONB/GZIP discrepancy is correctly treated as an open read-only finding and should remain fail-closed.

## 3. Historical-vs-reconstructed reconciliation schema

**Disposition:** `PASS_WITH_ONE_CLOSURE_CLARIFICATION`

The six-category taxonomy is materially better than a "find the missing five" framing and is suitable for future forensic comparison. It correctly gives special attention to historical blockers that disappear in the reconstruction.

Required clarification before the framework is ever declared complete:
- `UNRESOLVED_COMPARISON` is a temporary evidence state, not a substantive reconciled outcome. Any unresolved unit/blocker must keep reconciliation closure open unless the Owner explicitly accepts the residual uncertainty as a documented exception.

No actual comparison is authorized or performed by this QA.

## 4. Mechanism-provenance amendment

**Disposition:** `FAIL__NARROW_WORDING_CORRECTION_REQUIRED`

The core correction is right: historical 43 and reconstructed 38 are outputs of different mechanisms; 43 is forensic evidence, not a correctness target.

One statement overreaches the evidence:
> `It is not recoverable as a procedure — only its output counts are.`

That is stronger than what has been proven and conflicts with the active plan to recover historical unit-level output from the protected Supabase bundle. The old procedure has **not been recovered from governed evidence so far**; that does not prove it is impossible to recover further context/evidence.

**Required replacement:**
`The historical generator procedure is not currently reproducible from the governed evidence recovered so far. Historical output, including unit-level detail, may still be recoverable from the protected P6.1 bundle and other forensic evidence.`

All other provenance corrections in the amendment are accepted.

## Gate after this QA

- `A2`: remains OPEN pending governed custody + crossed hash verification.
- `B specification`: NOT AUTHORIZED FOR EXECUTION until B-1 through B-4 are corrected and independently re-QA'd.
- `Reconciliation schema`: accepted as framework; do not execute while the P6.1 reconstruction track is frozen.
- `Mechanism provenance`: accepted in principle, but the unrecoverability wording must be corrected before it is treated as frozen authority.
- No P6.x reconstruction/restart is authorized by this QA.
