# Atlas v1.5 — QA Outcome & Architecture Standard (v1)

Status: ACTIVE. Referenced by ATL-177 ("SUPERSEDING QA STANDARD — Owner directive 28 Sep 2026"). This file was missing from the repository despite being referenced; it is created here to close that gap and to make the 10-point checklist below mandatory, explicit, and binding on both agents.

## Scope and binding force

This standard applies to **every substantive task in the ATL-177 v1.5 LIVE sequence**, for **both workers**:

- **ChatGPT (builder/executor):** must self-check all 10 categories below before posting BUILD_COMPLETE / durable evidence and handing the baton to Claude. A BUILD_COMPLETE claim that has not been checked against all 10 is an incomplete handoff, not a build.
- **Claude (independent QA):** must independently re-verify all 10 categories before issuing a PASS. Claude does not inherit ChatGPT's self-check as evidence — each category must be independently confirmed with real tool output (file reads, test runs, diffs), not asserted from the handoff narrative.

A task may be marked PASS only when **all 10** categories hold. There is no partial pass and no averaging: a single category that fails is sufficient, on its own, to return the task as **REWORK_REQUIRED** under the ATL-177 rework rule (same task, same issue — remediate and re-QA; do not open a new issue for an ordinary defect).

When a QA turn finds a hard failure in one category early, the QA agent may still disposition the task as REWORK_REQUIRED without exhaustively completing the remaining categories, but **must say explicitly, in the handoff and the issue comment, which of the 10 were checked, which were not, and why** — never represent an unchecked category as having passed.

## The 10 categories

### 1. Build Correctness
The code/artifact/test that was committed actually runs and does what it claims, from a clean checkout, with no undisclosed manual steps. All declared dependencies must be present in the repo's own dependency manifest (package.json/lockfile) or vendored — not installed ad hoc by the verifier. Evidence: re-run the committed test/script from a fresh clone; the QA agent reproduces the stated result itself rather than trusting a printed "PASS" in a handoff.

### 2. Outcome Fitness
The delivered work actually achieves the intended user/business outcome stated in the issue's acceptance criteria — not just a technically-shaped proxy for it. Evidence: map each acceptance-criteria bullet in the Linear issue to concrete, observed behavior or artifact content.

### 3. Architecture Fitness
The change fits coherently into Atlas's existing product and cross-layer architecture — it does not bypass layers, duplicate canonical concerns, or introduce a parallel/local model of something Atlas already owns canonically. Evidence: identify what layer(s) the change touches and confirm it respects existing boundaries (e.g. canonical Work/WorkDefinition semantics vs. a runtime-specific projection).

### 4. Future-Scope Compatibility
The design does not foreclose or contradict the already-registered v2 continuations under ATL-152. A bounded v1.5 slice is fine; a design choice that would require re-doing the v1.5 work to reach v2 is not. Evidence: check the task's v1.5 boundary language against the paired ATL-152 v2 continuation (if one exists) for contradiction.

### 5. Canonical Ownership / Truth Integrity
Atlas canonical truth (Work/WorkDefinition/process semantics, version/lineage identifiers) is not overwritten, shadowed, or redefined by a runtime-specific (e.g. Malkom) structure. Mutation flags/claims (e.g. `canonicalMutation:false`) must be independently verified against the actual data, not just read as an asserted field. Evidence: confirm canonical IDs are sourced from, not invented in parallel to, the upstream canonical artifact.

### 6. Reachability
A real user can actually reach and use the delivered capability through the product, without developer knowledge, a manual file read, or an undocumented internal API call. Data and contracts that exist only as repo files with no UI/consuming surface fail this category, even if the data itself is correct. Evidence: locate the actual UI/page/API surface in the diff that exposes the capability; its absence is a fail, not a pending item.

### 7. Provenance / Lineage Integrity
Every generated artifact carries exact, independently-checkable lineage back to its canonical and upstream source artifacts (source release tip, upstream task IDs, version). IDs referenced must resolve to real, pre-existing artifacts — not be fabricated to look plausible. Evidence: cross-reference every lineage ID/tip SHA in the new artifact against the actual upstream file/commit.

### 8. Fail-Closed Behavior
Unknown, ambiguous, or unsupported semantics are explicitly surfaced as such (e.g. `UNKNOWN` / `SURFACE_NOT_INVENT`) rather than silently invented, guessed, or defaulted. Evidence: identify at least one unsupported/ambiguous case the artifact had to handle, and confirm it is surfaced rather than papered over.

### 9. Malkom Utility
The capability is genuinely useful to the Malkom Domain Warehouse consumption context it was built for — not merely schema-valid. A capability that is Reachability-compliant in theory but trivial, inert, or disconnected from real Malkom consumption needs fails here even if every other category is clean.

### 10. Consumer Independence
The capability does not hard-wire itself to a single fixture/example in a way that makes it unusable for any other consumer or scope without a code change. A result that only works for one hardcoded example (e.g. a single queue/work item) where the issue calls for a general, repeatable capability fails this category. Evidence: check whether the generation/consumption path is parameterized by governed source data, or whether the single shipped example is actually the entire capability.

## Handoff record-keeping requirement

Every BUILD_COMPLETE handoff (ChatGPT → Claude) and every QA disposition (Claude → ChatGPT) must state, for each of the 10 categories, either a one-line confirmation of what was checked and how, or an explicit "not checked / pending" flag. Silence on a category is not evidence it passed.

## Revision history
- v1 — 2026-10-02 — created by Claude at Owner (Darshan) direction, closing the gap where ATL-177 referenced this file before it existed. Content formalizes the 10 categories already named informally in ATL-177's "SUPERSEDING QA STANDARD" section, adding explicit "Build Correctness" as its own named category and making the check mandatory and symmetric for both ChatGPT and Claude.
