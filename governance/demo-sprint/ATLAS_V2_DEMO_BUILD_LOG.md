# Atlas V2 Demo Build Log

## 11 September 2026 — Demo sprint authorization

### Owner direction
- Atlas 2.0 functional concept to be live by Monday 14 September 2026.
- Tuesday 15 September demo is primarily for Malkom 3.0; Atlas gets a short stakeholder introduction and Malkom projection demonstration.
- Additional Atlas page required to communicate larger scope/future: daughter domain knowledge, Operational Knowledge, decomposition, WorkDefinition, execution readiness, adapters and downstream execution platforms.
- ChatGPT becomes primary executor for the time being.
- Claude remains hot backup and must be able to resume at any point without reconstructing state from chat.
- Build must proceed in quick stages with audits before, during and after each stage.
- No delta-only build/certification. Each passed stage must preserve a complete frozen repository state and update the frozen-state record.

### Governance response
- Created `ATLAS_V2_DEMO_BUILD_PROTOCOL.md`.
- Created `ATLAS_V2_DEMO_HANDOVER.md`.
- Defined separate `ATLAS_V2_DEMO_GO_LIVE` concept so Monday demo promotion does not falsely represent full Atlas 2.0 production certification.
- AR0.2 architecture-refinement state is preserved; demo sprint does not erase or silently resolve it.

---

## 12 September 2026 — Hybrid demo rebaseline

### Why the plan changed
Joint ChatGPT/Claude review surfaced two separate execution lineages:

1. Existing proof lineage: `Road LTL V1.2 → Domain Warehouse v2.3 → Malkom 3.0 projection`.
2. New governed successor lineage: `Road LTL V1.4/V1.5 → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition VNext → Client Binding → future adapters`.

These lineages must not be silently presented as one already-connected pipeline. A full bridge/compiler is not a Monday requirement and remains governed post-demo architecture work.

### Owner clarification
The Tuesday/Monday release is a functional proof of concept, not a governance/completeness showcase. Representative 60–70% workable/acceptable execution-depth proof is sufficient; governance/readiness evidence should remain secondary and available on demand.

### Selected demo strategy
`HYBRID_REUSE_PROVEN_EXECUTION_LINEAGE_WITH_ADDITIVE_ATLAS_V2_SURFACE`

- Reuse the existing verified execution-depth/Malkom proof where it works.
- Use the newer Atlas V2 shell and scope/future page to communicate the tool-agnostic domain-to-execution direction.
- Do not claim the v1.4/v1.5/R0.3 lineage currently generates the existing Malkom projection.
- Do not attempt a full v1.4/v1.5 → v2.3 compiler before Monday.
- Do not hand-author LTL-03 into the demo lineage unless separately owner-authorized after baseline verification.
- Governance/readiness is a secondary admin/protected view, not the primary stakeholder journey.

### Rebased D2.0 stages
- `D2.0.0` — Baseline seam verification + hybrid release freeze.
- `D2.0.1` — Additive Canvas V2 shell + Atlas scope/future page.
- `D2.0.2` — Road LTL + Ocean demo domain surfaces.
- `D2.0.3` — Proven Road LTL execution-depth integration using the verified V1.2 / Domain Warehouse v2.3 reference proof lineage.
- `D2.0.4` — Malkom 3.0 adapter/projection integration from the proven lineage.
- `D2.0.5` — Representative POC journey + secondary governance/readiness view.
- `D2.0.6` — Hybrid demo full integration, regression + deployment parity certification and full-state freeze.
- `D2.0.7` — Controlled Monday demo promotion with Owner approval.

### Current stage
`D2.0.0 — Baseline seam verification + hybrid release freeze`

Mandatory D2.0.0 exit checks:
1. Verify exact Road LTL version/hash actually served by the live Vercel runtime.
2. Locate and verify the authoritative Canvas V2 asset and deployment history.
3. Verify existing V1.2 → Domain Warehouse v2.3 → Malkom artifacts, definition counts, scripts and known gaps.
4. Verify additive compatibility with the currently live app.
5. Verify Universe/Road LTL/Ocean/Ask Atlas version and naming facts before UI copy is frozen.
6. Create complete pre-change repository freeze point.

### Shared executor coordination
Both ChatGPT and Claude must read and update `claude_chatGPT.md` for material findings/actions so the Owner does not need to copy findings between tools.

No feature mutation is authorized until D2.0.0 passes.
