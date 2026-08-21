# Atlas Intelligence v0.6.4 — Canonical Atlas Resolver

v0.6.4 is a focused semantic/runtime upgrade over v0.6.3. The frozen V6.2.2 + Road LTL V1.2 Atlas remains byte-identical.

## What v0.6.4 fixes
- Universal canonical resolver runs before generic process search.
- Trace is no longer POD-specific: processes, governed entity nodes and business objects resolve to source-backed Road LTL process anchors.
- Common semantic traces: POD, invoice, claim, BOL/eBOL and rate.
- Atlas-native terminology explainer for execution axes, source concepts, lenses, applicability/compatibility concepts and exact selector/source names.
- Active-page context and last clicked/selected Atlas element support follow-ups such as “what does this mean?”.
- Trust Gate accepts canonical Atlas vocabulary without becoming permissive to unrelated garbage.
- Actor wording expanded (`owns`, `performs`, etc.).
- LLM configuration metadata made explicit; deterministic fallback remains safe until a server-side key is configured.

## Frozen Atlas contract
Agents can read, explain, highlight, grey, trace, compare, simulate and recommend. They cannot modify the frozen Atlas. Any proposed correction remains a manual governed change outside the runtime.

## Tests
`npm test` runs seven suites, including the exhaustive semantic/canonical audit.

## Deploy
Deploy this folder as the Vercel project root. See `docs/V0.6.4_LLM_SETUP.md` and `docs/DEPLOY.md`.
Deployment trigger for v0.6.4
