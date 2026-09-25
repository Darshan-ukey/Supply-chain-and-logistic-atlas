# Atlas Product Constitution V1

Status: OWNER-DIRECTED PRODUCT BASELINE — FROZEN FOR ARCHITECTURE DESIGN  
Effective: 16 September 2026  
Owner/Governor: Darshan Ukey

## 1. North Star

> **Atlas is a governed operational intelligence platform that builds a reusable, source-backed model of how work operates, binds it to enterprise reality, and uses that model to understand operations, design transformation, and produce execution-ready specifications.**

Atlas must create reusable intellectual capital from domain and enterprise operating knowledge. It is not primarily a document repository, governance portal, WorkDefinition compiler, workflow engine, ERP, RPA platform, process-mining tool, or execution runtime.

## 2. Three products on one governed foundation

Atlas exposes three distinct products/capabilities over the same governed foundation.

### Product 1 — Operations Intelligence
Purpose: **understand how the client actually operates.**

Atlas should be able to combine reference/domain semantics, enterprise context and operational evidence to identify and explain:
- process and operating variants;
- cycle-time and performance patterns;
- friction, rework and exception drivers;
- risk/control gaps;
- standardisation and complexity opportunities;
- operational outcome patterns.

### Product 2 — Transformation Intelligence
Purpose: **decide what should change and why.**

Atlas should be able to:
- identify and prioritise transformation opportunities;
- distinguish root cause from symptom;
- design and compare future-state options;
- assess likely impact, assumptions and dependencies;
- classify solution patterns such as process/policy change, workflow, RPA, rules, AI/agent, enterprise-system change, human-work redesign or mixed patterns.

Transformation outputs are proposals until governed approval. They do not silently mutate canonical current/reference truth.

### Product 3 — Execution Intelligence
Purpose: **define how approved work should operate and make it implementation-ready.**

Atlas should be able to:
- convert governed process/task semantics into canonical execution semantics;
- expose and resolve declared enterprise/client binding requirements;
- produce technology-neutral Work Decomposition and Canonical WorkDefinitions;
- certify readiness at domain and enterprise levels;
- assemble version-closed implementation specifications;
- project those specifications to materially different downstream tools without redefining the underlying business meaning.

## 3. Common Atlas Foundation

All three products must use the same governed semantic foundation. At minimum the foundation must support:
- reference models and domain taxonomy;
- source-backed operational semantics;
- process/task/object/field/document semantics;
- state, event, rule, clock, decision, action and outcome semantics where material;
- roles, authorities, validations, controls and evidence expectations;
- operational knowledge and explicit unknown/conflict state;
- enterprise/client context and binding requirements;
- provenance, lineage, versioning and trust;
- operational evidence and observed outcomes;
- approved current/future-state identities;
- execution contracts where applicable.

No product may maintain a competing copy of business truth merely because it presents or analyses that truth differently.

## 4. Product lifecycle

The governing lifecycle is:

`UNDERSTAND → DECIDE → DEFINE → EXECUTE EXTERNALLY → OBSERVE → IMPROVE`

Mapped to the three products:
- UNDERSTAND = Operations Intelligence;
- DECIDE = Transformation Intelligence;
- DEFINE = Execution Intelligence;
- EXECUTE EXTERNALLY = Malkom, workflows, RPA, agents, ERP/TMS/WMS, BPM/runtime engines, custom applications and/or human work;
- OBSERVE/IMPROVE = governed evidence returned to Atlas for conformance, learning and the next transformation cycle.

## 5. Hard product boundaries

1. **Atlas owns governed understanding, transformation intelligence and execution specification.**
2. **Downstream platforms and people own runtime business execution.** Atlas may export/deploy/project through authorized adapters, but it does not become the business-transaction authority.
3. **Client Binding must not compensate for missing reusable domain knowledge.** Client Binding resolves declared enterprise-specific slots/values/variants; unresolved reusable business semantics remain domain knowledge gaps.
4. **Runtime adapters must not repair missing business semantics.** A downstream tool may choose implementation mechanics, but it may not invent missing governed business rules without raising a governed gap/decision.
5. **Presentation is not authority.** Canvas/HTML/Ask Atlas/inspectors render or analyse governed data; they do not own canonical business meaning.
6. **Observed behavior is evidence, not automatic truth.** Runtime evidence may trigger a proposal/gap/reconciliation path but cannot silently overwrite canonical knowledge.

## 6. Execution-readiness states

Atlas must distinguish at least:

### DOMAIN_EXECUTION_READY
All reusable, tool-neutral execution semantics required for the governed scope are present, version-closed, internally consistent and source/provenance controlled. Only declared enterprise-specific binding values may remain unresolved.

### ENTERPRISE_EXECUTION_READY
All mandatory enterprise/client bindings, mappings, authorities, policies, thresholds and operating constraints required for the scope are resolved or explicitly governed as not applicable.

### RUNTIME_IMPLEMENTATION_READY
A chosen downstream tool/runtime has a version-closed specification/projection with capability gaps and implementation/configuration/integration requirements explicitly resolved or governed.

A scope must not be promoted to a later state by hiding earlier-stage semantic gaps.

## 7. Value and kill tests

Atlas must prove more than artifact generation.

For a representative enterprise scope, the same governed foundation should materially support all three questions:
1. **Operations Intelligence:** What is actually happening, where is the friction and why?
2. **Transformation Intelligence:** What should change, why, and what future-state/solution pattern is justified?
3. **Execution Intelligence:** Exactly how should the approved work operate, and can a downstream implementation proceed without rediscovering the business logic?

A strong multi-consumer proof should also show that the same underlying business semantics can support materially different consumers such as an agent/workflow, BPM/digital-twin representation and ERP/TMS/Malkom implementation requirement set.

If Atlas can only produce WorkDefinitions but cannot support Operations and Transformation Intelligence from the same governed foundation, it has narrowed below this constitution.

## 8. Change control

This constitution is a frozen product-design baseline for AR0.2/AR0.3 and successor architecture work.

It may be changed only by explicit Owner/Governor decision with:
- rationale for the pivot;
- expected value gain;
- impact on the three-product model and existing architecture;
- explicit successor version.

Architecture, UI, storage or implementation convenience is not sufficient reason to silently change the product identity.
