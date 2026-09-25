# Atlas Foundation & Daughter Module Build Process

## Status
MANDATORY GOVERNANCE PROCESS — applies to Universe and every daughter module from V7.2 onward.

## 1. Canonical architecture rule
- Universe and daughter domains are governed data/knowledge modules.
- HTML reference pages, Canvas, Ask Atlas, Inspector, Compare, Trace and future WorkDefinition views are renderers/consumers of those modules.
- Canonical truth must not depend on one generated HTML artifact.
- A new or updated daughter module must not require a Canvas or Reference Atlas redesign unless it exposes a genuinely generic platform capability gap.

## 2. Permanent daughter-module build loop
1. Start from the current frozen Universe.
2. Build inside-out from the Universe inheritance model.
3. Build outside-in from authoritative domain sources.
4. Classify every discovery:
   - already represented by Universe → inherit;
   - generic and missing/incorrect in Universe → Universe change candidate;
   - daughter-specific → retain only in daughter module.
5. Apply approved generic corrections as a governed Universe patch/version.
6. Regression-test the updated Universe against all existing canonical IDs, rules, navigation, sources, renderers and verified daughter modules.
7. Rebase/reconcile the daughter against the updated Universe.
8. Validate the daughter at its publication depth.
9. Any new generic discovery after freeze enters the next Universe candidate queue; it does not silently mutate the current release.

## 3. Foundation update rule
- Update/patch the Universe; do not reconstruct it as a new product page.
- Canonical IDs are stable unless an explicitly governed migration is approved.
- Existing verified semantics must not be removed silently.
- Additive enrichment is preferred.
- Corrections require an explicit change record, impact analysis and regression evidence.

## 4. Mandatory parent-change regression
Every Universe change must test:
- canonical ID preservation and alias resolution;
- source registry and provenance consistency;
- relationship/rule/overlay compatibility;
- 71-destination coverage registry;
- all previously verified daughter modules;
- Reference Atlas rendering;
- v1.1.8 Context Composer/rule resolver;
- Canvas semantic zoom, playback and Inspector;
- Search / Ask Atlas / Trace / Compare interfaces where applicable;
- desktop/mobile behaviour;
- no protected/public projection leakage.

## 5. Renderer rule
- Content updates change governed data, not renderer architecture.
- Renderer changes must be generic, never mode-specific when the requirement can be expressed through module metadata/status.
- Example: replace a `road-ltl`-only A5 activation gate with `ACTIVE + A5_VERIFIED`, rather than adding Ocean-specific conditions.

## 6. Consumption-first Reference Atlas UX rule
The Reference Atlas exists to be USED, not to continuously explain how it was built.

Primary interaction order should favour:
1. Overview / what the user can do.
2. Daughter/module navigator.
3. Ecosystem / enterprise / role / mode / system views.
4. Execution and discovery views.
5. Methodology, governance, provenance and source evidence as secondary/deeper tabs.

Required UX principles:
- Do not front-load source methodology, governance mechanics or evidence framing.
- Keep evidence, provenance, claim boundaries and source freshness available and rigorous, but progressively disclosed.
- High-level views should be bold, concise and operationally consumable.
- Detailed governance/source information belongs in later tabs, Inspector, evidence drawers or Admin/private views.
- Canvas complements the Reference Atlas; it does not justify downgrading Reference Atlas usability.
- New governance capability must not increase front-page cognitive load unless users need it to perform the primary task.

## 7. Versioning principle
- Universe version = governed canonical foundation version.
- Daughter module version = governed domain knowledge version.
- Platform/renderer version = application behaviour version.
- Do not couple all three version numbers unnecessarily.
- A presentation-only correction should not masquerade as a new ontology/domain release.

## 8. Release acceptance principle
A new foundation is better only when it is BOTH:
- semantically richer/correcter than its predecessor; and
- at least as usable, navigable and interaction-complete as the predecessor.

If richer knowledge causes a poorer user experience, the release is not ready to freeze.


## V7.3 permanent rendering and navigation rule

From Universe V7.3 onward, the governed knowledge model and its renderers are explicitly separated.

- Universe Core and daughter modules are canonical governed data modules.
- Reference HTML pages and Canvas are renderers/interaction surfaces, not canonical truth.
- The Universe is patched/versioned; it is not reconstructed from scratch for each daughter build.
- Daughter modules are built inside-out from the current Universe and outside-in from authoritative domain sources.
- Generic discoveries become governed Universe candidates; daughter-specific execution remains in the daughter.
- Every parent change must regression-test all already verified daughters and all product surfaces.
- New daughter content must not require Canvas or Reference renderer redesign unless it exposes a genuinely missing generic renderer capability.
- Consumption-first UX is mandatory: operating/navigation views precede methodology, provenance, governance and source-detail views. Evidence remains available but is progressively disclosed.
- Cross-view navigation is a platform contract: users can switch Canvas ↔ Universe ↔ live daughter page. A live daughter can be opened directly from the Universe navigator; planned destinations remain maturity previews.
- Release versions remain independent: Universe version, daughter-module version and platform/runtime version must not be conflated.
