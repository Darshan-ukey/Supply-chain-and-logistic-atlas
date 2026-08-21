# Atlas Constitution / Methodology — V6.2.3

> Additive interpretability layer. Frozen Page 0 V6.2.2 and Road LTL V1.2 remain unchanged.

## Purpose
A global-neutral supply-chain, logistics and distribution reference architecture that keeps source-native frameworks, Atlas crosswalks, execution overlays, enterprise lenses, systems/objects and evidence boundaries distinguishable.

Use the Atlas as a governed map of how supply-chain work fits together: what happens, who does it, which systems/objects/evidence are involved, which sources support the statement, and how context changes execution.

## Build methodology
### 1. Preserve source-native process architecture
SCOR and APQC remain independent native frameworks. Their published semantics are shown/crosswalked rather than silently rewritten as Atlas-native taxonomy.

**In simple English:** Start with established process frameworks instead of inventing a new supply-chain language and pretending it came from an industry body.

### 2. Separate modelling notation from process evidence
BPMN and DMN are modelling/decision notations. They can represent workflow and decision logic later, but they are not logistics process-content evidence.

**In simple English:** A diagramming language can show a process; it does not prove that the process itself is an industry standard.

### 3. Add semantic/object/interoperability standards
UN/CEFACT, UN/EDIFACT, GS1 and related standards provide business-object, identity, event and message semantics within their published scope.

**In simple English:** These sources help define what the data, documents, identifiers and events mean across organizations and systems.

### 4. Add mode, role and legal/regulatory source packs conditionally
Mode/role/legal references are applied only within their actual mode, jurisdiction, contract, goods and carriage scope. Inclusion in the source universe never means universal applicability.

**In simple English:** A rule can be authoritative without applying to every shipment. The Atlas keeps the rule available but activates it only when the real-world context qualifies.

### 5. Create Atlas canonical navigation and crosswalks
Atlas domains/lenses/navigation organize the source material. Crosswalks are explicitly Atlas interpretations and may be one-to-many.

**In simple English:** The Atlas gives users one coherent way to navigate many different standards without falsely claiming the standards use the same structure.

### 6. Build execution children under the Page-0 parent
Detailed Road LTL A4/A5 records are Atlas child synthesis inherited from Page 0 and bounded issuer evidence. They are not claimed as source-native SCOR/APQC nodes.

**In simple English:** Page 0 is the enterprise map; LTL is a detailed operating playbook built under that map using multiple sources and explicit synthesis.

### 7. Separate ontology from process flow
Typed entities (state, event, decision, rule, control, action, evidence, outcome, actor, object) and their ontology relationships are governed separately from process-flow edges such as PRECEDES, REQUIRES, TRIGGERS or RECOVERS_TO.

**In simple English:** What something *is* is different from what happens *before or after* it. The Atlas keeps those two questions separate.

### 8. Keep provenance, claim boundaries and confidence visible
Every detailed record carries provenance/source mapping/claim boundary/confidence so users can distinguish source-native evidence, Atlas synthesis and unresolved research.

**In simple English:** The Atlas should be able to answer not only ‘what does this say?’ but also ‘where did this come from and how certain are we?’

### 9. Compose execution context without deleting the enterprise universe
Mode/service is the primary execution lens; role, movement, node, jurisdiction, carriage regime, condition and contract/service refine applicability. Enterprise lenses remain analytical views over the same governed universe.

**In simple English:** Choose the operating situation you care about, but do not pretend the rest of the enterprise stops existing.

### 10. Treat gaps as hypotheses, not conclusions
A visible failure or automation gap is not proof of root cause or value. Trace upstream/downstream dependencies, evidence, controls, frequency, materiality and economics before design.

**In simple English:** Where a problem shows up is often not where it started. Investigate before proposing automation or AI.

## Governance
- Frozen V6.2.2 and Road LTL V1.2 content cannot be mutated by intelligence.
- V6.2.3 is additive: methodology/guide/definitions only.
- Source-native, crosswalk, Atlas synthesis and runtime state must remain distinguishable.
- A source must never be used beyond its stated claim boundary.
- Legal/regulatory applicability is conditional and provision/scope dependent.
- Unknown and reference-only client areas must not be filled by model knowledge.
- Atlas corrections are advisory; administrator manually creates a new governed Atlas source release.
- If classification is ambiguous, clarification precedes explanation.
- Plain-English explanation must not erase the technical definition/provenance underneath it.
