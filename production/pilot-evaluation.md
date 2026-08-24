# Stage 23 — Pilot Validation & Quality Gates

Stage 23 adds a validation layer around the existing Enterprise Operations Platform. It does not modify the Enterprise Core, Supply Chain Domain Pack, Page 0 or Road LTL reference content.

## Document intelligence correction
The production ephemeral path is now:

`technical file validation → transient approved LLM semantic assessment + structuring → deterministic canonical-ID validation → candidate facts → consultant confirmation`

Keyword relevance remains only a diagnostic hint. It is no longer trusted to decide whether a readable document is semantically relevant. The LLM receives document text as **untrusted evidence, never instructions**. Invalid process IDs are removed by deterministic validation after the model response.

## Evaluation storage
Pilot scorecards persist separately from client documents. `atlas_pilot_evaluations` contains only evaluator/workspace/session identifiers, artifact type, numeric dimensions, pass/fail, optional notes and timestamps. The evaluation API does not accept raw document bytes/text/excerpts.

RLS:
- OWNER/ADMIN can review the workspace evaluation set.
- EDITOR/Pilot users can submit evaluations and read their own rows.
- VIEWER cannot write.

## Synthetic corpus
Ten synthetic cases cover messy prose, commercial/rating, exception recovery, proprietary-system ambiguity, contradictions, partial/unknown scope, irrelevant content, garbage extraction, prompt injection and an attempt to backfill unpublished Road FTL A5 knowledge.

The corpus contains no real client content and is included only in the Lab package. Stable excludes the `pilot/` test corpus.

## Live quality certification
`npm run pilot:eval:live` runs the synthetic corpus against the configured LLM provider and measures the frozen Stage-23 evaluation contract. It must be run after Gemini is configured and again against the deployed Lab environment before confidential pilot use.
