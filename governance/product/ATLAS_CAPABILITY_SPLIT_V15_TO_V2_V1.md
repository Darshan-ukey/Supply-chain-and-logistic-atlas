# Atlas Capability Split — v1.5 Bounded Slices → v2 Continuations V1

**Decision date:** 2026-09-28  
**Linear register:** ATL-152  
**v1.5 release parent:** ATL-136  
**v2 product parent:** ATL-103

## Rule

Any capability partially implemented in Atlas v1.5 must have:
1. a bounded v1.5 task with an explicit STOP boundary; and
2. a separate v2 continuation task that starts from the frozen v1.5 result and implements only the remaining delta.

The v2 continuation does not replace the governing v2 architecture issue. It links to it.

## Pair map

| Capability | v1.5 bounded slice | v2 continuation | Governing v2 issue(s) |
|---|---|---|---|
| Source / Universe | ATL-153 | ATL-154 | ATL-111 / ATL-113 |
| Daughter knowledge + page generation | ATL-155 | ATL-156 | ATL-112 / ATL-104 |
| On-Demand Depth | ATL-157 | ATL-158 | ATL-40 / ATL-116 / ATL-133 |
| Work Decomposition + Canonical WorkDefinition | ATL-159 | ATL-160 | ATL-95 / ATL-133 / ATL-103 |
| Knowledge / gap states | ATL-161 | ATL-162 | ATL-116 |
| Readiness | ATL-163 | ATL-164 | ATL-133 / ATL-95 |
| Client Binding | ATL-165 | ATL-166 | ATL-114 / ATL-95 |
| Interaction / public-private UX | ATL-167 | ATL-168 | ATL-115 / ATL-105 |
| Malkom projection / multi-consumer | ATL-169 | ATL-170 | ATL-107 |

## v1.5 dependency

ATL-153 Source/Universe baseline  
→ ATL-155 bounded Daughter generation  
→ ATL-157 bounded On-Demand Depth.

ATL-161 knowledge/gap states may proceed in parallel after the v1.5 baseline audit.

ATL-157 + ATL-161  
→ ATL-159 bounded Work Decomposition/Canonical WD  
→ ATL-163 Malkom-oriented readiness summary.

ATL-161  
→ ATL-165 minimal Client Binding/manual resolution.

ATL-138/ATL-139 + ATL-159 + ATL-163 + ATL-165  
→ ATL-169 current-lineage Malkom projection boundary/handoff.

All bounded capability slices converge into ATL-167 interaction integration and ATL-141 release integrity/polish.

## v1.5 stop boundaries

### Source/Universe
Use current governed baseline + bounded source-first research.  
**Defer:** continuous refresh, semantic delta automation, selective regeneration.

### Daughter generation
Generate bounded Daughter models/pages from governed truth.  
**Defer:** all-daughter scale, generic cross-domain regeneration.

### On-Demand Depth
Support explicit human “Deepen this scope” with bounded research/validation.  
**Defer:** downstream automatic trigger, target-depth generalization, autonomous compounding/reuse.

### Work Decomposition / WD
Generate reproducible decomposition/WD for selected scopes.  
**Defer:** generic recursive coverage, universal persistence/compiler sufficiency.

### Knowledge states
Use explicit authoritative/candidate/inferred/conflicting/unknown/research/client-binding/etc. states.  
**Defer:** full cross-engagement promotion/compounding lifecycle.

### Readiness
Provide Malkom-oriented readiness summary and exact blockers.  
**Defer:** full DOMAIN→ENTERPRISE→RUNTIME deterministic readiness across executor classes.

### Client Binding
Expose required bindings and permit bounded/manual demo-scope resolution.  
**Defer:** enterprise discovery ingestion from messy SOPs/data and scalable onboarding.

### Interaction
Preserve live Atlas UX and integrate Daughter→Depth→WD→Malkom journey with public/private separation.  
**Defer:** universal graph-wide Ask/Trace/Compare/context continuity.

### Malkom projection
Produce current-lineage Malkom package from common canonical semantics.  
**Defer:** agentic-AI, RPA/BPM/workflow and other consumer projections.

## v2 continuation rule

Each v2 continuation:
- remains Backlog during v1.5;
- is blocked by its corresponding v1.5 slice;
- consumes the frozen v1.5 artifacts/tests/contracts;
- must not repeat already-proven v1.5 functionality unless a governed defect or successor decision requires it;
- closes only through the linked governing v2 architecture/product issue.

## Anti-drift

1. A partial capability must never be marked “complete” merely because its v1.5 slice passed.
2. A v2 continuation must never restart from conceptual design if v1.5 has a validated implementation.
3. v1.5 scope must not silently expand into the v2 delta.
4. v2 scope must not silently drop a deferred requirement because v1.5 shipped without it.

## Completeness revalidation additions — 28 Sep 2026

The full-concept audit identified three partial capabilities that had been implicit but not paired:

| Capability | v1.5 bounded slice | v2 continuation | Governing v2 issue(s) |
|---|---|---|---|
| Operational Knowledge / canonical information semantics | ATL-171 | ATL-172 | ATL-95 / ATL-119 / ATL-133 / ATL-150 |
| Malkom Domain Warehouse utility proof | ATL-173 | ATL-174 | ATL-117 |
| API/versioning/release/rollback | ATL-175 | ATL-176 | ATL-106 / ATL-109 |

These ensure Daughter/Depth has an explicit semantic bridge to WorkDefinition, v1.5 proves actual Malkom utility, and the release is versioned/recoverable rather than a one-off demo.
