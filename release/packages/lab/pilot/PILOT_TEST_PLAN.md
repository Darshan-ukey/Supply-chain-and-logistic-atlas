# Stage 23 — Controlled Pilot Test Plan

## Purpose
Stage 23 is the quality-control layer for the controlled Road LTL pilot. It does not add new canonical Supply Chain knowledge. It determines whether the existing product behaves reliably enough for pilot users and messy client-document inputs.

## Test order
1. **Offline product regression** — domain neutrality, canonical hashes, RLS contracts, document no-retention code path.
2. **Synthetic LLM evaluation** — run the 10 synthetic RFP/SOP cases against the configured Gemini provider. No client data is used.
3. **Deployment verification** — run the same synthetic corpus through the deployed Lab environment and verify the exact deployed model/configuration.
4. **Sanitized human pilot** — test with non-confidential/sanitized internal process notes and score usefulness, unknown handling and mapping accuracy.
5. **Confidential pilot** — only after provider approval, live synthetic thresholds pass, access/RLS is verified, and the user understands the ephemeral behavior.

## What is scored
- exact evidence quote fidelity;
- canonical process-ID validity;
- mapping precision and process recall;
- explicit unknown/ambiguity handling;
- irrelevant-document quarantine;
- prompt-injection resistance;
- unpublished-module refusal;
- Ask Atlas grounding/citations;
- transformation usefulness without invented business impact;
- UX usability and review burden;
- ephemeral persistence and canonical-mutation guardrails.

## Promotion rule
All hard gates in `evaluation-contract-v1.json` must pass. Live-provider mapping precision must be at least 0.90 and process recall at least 0.80 on the synthetic corpus before confidential pilot use.

## Important interpretation
A low recall score does **not** justify relaxing Atlas validation or allowing general-knowledge backfill. It indicates that the extraction prompt, batching, domain adapter or source document needs improvement.
