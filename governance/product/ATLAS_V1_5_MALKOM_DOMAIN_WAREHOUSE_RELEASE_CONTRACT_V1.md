# Atlas v1.5 — Malkom Domain Warehouse Release Contract V1

**Decision date:** 2026-09-28  
**Status:** OWNER-DIRECTED INTERMEDIATE RELEASE CONTRACT  
**Canonical roadmap:** `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md`

## 1. Release purpose

Atlas v1.5 is the first finished-enough product release specifically demonstrating the original Malkom Domain Warehouse requirement:

> **Atlas should provide the domain/work details Malkom needs, in the form Malkom needs them, so Malkom does not have to recreate the domain for every implementation.**

It is an intermediate product slice on the path to Atlas v2.0. It does not redefine the Atlas North Star.

## 2. Product identity

Atlas remains a governed domain/intelligence/specification product. It does not become Malkom, a Malkom admin console, an execution runtime, a generic workflow engine or an OCR/BOL product.

Malkom is the first/reference consumer.

Canonical rule:

> **Atlas owns understanding and specification. Downstream platforms own execution.**

## 3. UX contract

v1.5 must preserve or improve the current/frozen Atlas identity rather than replace it.

Primary reusable interaction assets:
- frozen Canvas 2.0.0 shell;
- additive Canvas 2.0.1 routing bridge candidate after required validation;
- Universal Ask 2.0.1 baseline;
- current Atlas spatial/domain navigation;
- Explore / Execute / Trace / Compare / Transform where applicable;
- rich task/A5 Inspector;
- Sources/provenance and governed context.

The Malkom Domain Warehouse story must appear as an Atlas journey through these surfaces.

No frozen payload may be edited in place.

## 3A. Verified current live baseline

Vercel production metadata verified on 2026-09-28:

- production alias: `supplychainatlas.vercel.app`;
- Vercel project: `logistic_atlas_v2`;
- production deployment: `dpl_6Xa5N7TVSk7CwyqE52nR2EGQythx`;
- source branch: `main`;
- source commit: `f9b08a951ca823ff8c23b64044fe1a7abb9dde79`.

The source/release tests at that production commit preserve the established Atlas interaction identity: spatial Canvas/composition, domain entry/navigation, Ask Atlas, rich Inspector, Sources, Trace, Compare, Transform, Execute/Explore controls, playback/freeze and governed context/saved views.

**v1.5 must reuse or improve this interaction model.** It must not replace the live Atlas shell with a Malkom-specific product.

This verification establishes deployment identity and source/test behavior. A fresh visual/browser inspection of the actual v1.5 release candidate remains mandatory under ATL-137/ATL-141.

## 4. Knowledge/release scope

v1.5 should use governed, currently supportable Atlas knowledge rather than wait for exhaustive future depth.

Required:
- Universe/domain hierarchy and reusable concepts;
- Road LTL 1.5 governed reference/effective lineage where certified;
- domain/process/task/work meaning;
- relevant objects/information, roles, systems, rules/decisions/controls/evidence where governed;
- applicability/dependencies/known exceptions where available;
- source/provenance;
- explicit `CLIENT_BINDING_REQUIRED`, unresolved, unsupported or loss states;
- aliases/synonyms where governed and material to consumption.

A visible, governed gap is acceptable. A hidden assumption presented as truth is not.

## 5. Malkom package boundary

v1.5 requires a **new current-lineage Malkom Domain Warehouse package/projection**.

The historical `Road LTL 1.2 → Domain Warehouse 2.3 → Malkom 3.0` materialized projection remains a reference fixture only. It may inform the adapter shape and demo expectations, but it must not be represented as a Road LTL 1.5 output.

The v1.5 package must:
- retain canonical Atlas IDs/versions/lineage;
- declare exact source Atlas release/package identity;
- expose Malkom-consumable domain/work data in a documented contract;
- distinguish reusable domain truth from client binding;
- declare unsupported/lossy mappings;
- fail closed for mandatory semantics that cannot be represented;
- remain a projection, not canonical Atlas truth.

## 6. Demo/live acceptance journey

A stakeholder should be able to:

1. enter Atlas through the normal Canvas/domain experience;
2. select Road LTL and navigate to a process/task/work area;
3. inspect the reusable domain/work detail Atlas already governs;
4. ask/inspect/trace supporting knowledge and provenance where available;
5. choose or view the Malkom Domain Warehouse consumer output;
6. see the exact Malkom-consumable package/contract and what is reusable vs client-specific/unresolved;
7. trace the package back to Atlas canonical semantics/version/source;
8. understand that Malkom can start implementation from this governed baseline instead of recreating the domain.

The experience must look like a coherent Atlas product, not a collection of governance artifacts.

## 7. v1.5 release gates

- current-lineage Road LTL → Malkom Domain Warehouse package exists and is deterministic;
- stable adapter/API/export contract exists;
- lineage/version/provenance and binding/loss states are inspectable;
- no false claim that historical v1.2/v2.3 Malkom proof came from Road LTL 1.5;
- frozen Canvas identity retained; additive UX integrated;
- navigation/Ask/Inspector/Trace/Sources relevant paths work;
- browser/visual regression performed on actual release candidate;
- responsive/readability/accessibility basic acceptance passes;
- stale/demo-only/incorrect version labels removed from user-facing product;
- release-integrity and security/public-protected checks pass for the v1.5 scope;
- independent QA passes;
- GitHub/Drive custody records agree;
- Vercel production promotion requires explicit Owner approval.

## 8. BOL disposition

BOL/FIRI is not a v1.5 release gate.

Completed governed BOL evidence is preserved. Unfinished ATL-59/BOL experimental work is deferred to v2.0.

A narrowly bounded BOL item may be resumed only if the v1.5 Malkom package itself exposes a material missing semantic that cannot truthfully be represented without it.

## 9. Atlas v2.0 deferred/future scope

v2.0 remains the full Execution-Readiness Platform and is expected to extend v1.5 with:

- source/universe refresh and semantic delta management;
- repeatable source-first Daughter knowledge generation;
- broader Operational Knowledge depth;
- on-demand research/enrichment triggered by users or downstream execution gaps;
- governed epistemic states and candidate→validate→promote→reuse lifecycle;
- future self-enrichment/compounding mechanism;
- generic recursive Work Decomposition;
- canonical WorkDefinition compilation/persistence and sufficiency;
- enterprise/client discovery and Client Binding;
- deterministic domain/enterprise/runtime readiness;
- richer rules, decisions, validations, controls, state/exception/recovery semantics;
- cross-layer dependency/staleness/selective regeneration;
- Malkom + agentic AI + RPA/BPM and other runtime projections from common canonical semantics;
- full Universal Ask / Canvas / Inspector / Trace / Compare integration over the v2 graph;
- production backend/API/versioning/upgrade/release architecture;
- Operations Intelligence + Transformation Intelligence + Execution Intelligence end state;
- value/kill-test instrumentation;
- final end-to-end v2 production certification and QA.

## 10. Anti-drift rules

1. Do not copy Malkom runtime schema into canonical Atlas truth.
2. Do not redesign frozen Canvas solely for this release.
3. Do not require exhaustive domain completeness; require explicit gap state.
4. Do not use a BOL-specific truth model as the product model.
5. Do not promote demo/reference artifacts to production without governed validation.
6. Do not weaken v2 requirements to claim v1.5 completion.
7. Every v1.5 artifact should be reusable or supersedable by v2 without semantic re-entry.

## 11. Success statement

Atlas v1.5 succeeds when the stakeholder can credibly see:

> **“Atlas already knows enough reusable Road LTL domain/work detail to give Malkom a governed starting package. Malkom does not have to rediscover the domain from scratch, while client-specific gaps remain explicit.”**

Atlas v2.0 then proves the much larger proposition: Atlas can continuously deepen that understanding, bind enterprise reality, determine readiness and produce implementation-ready specifications across multiple execution technologies.
