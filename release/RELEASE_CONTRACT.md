# Atlas Release Contract v1 — Stage 22

Stage 22 does not change the Supply Chain product model. It establishes how a validated build moves from source to Lab to Stable without silently changing Atlas knowledge.

## Channels

### Lab
- first deployment target for every code/content release;
- may retain architecture fixtures and diagnostics;
- can use an optional LLM provider or deterministic Ask Atlas fallback;
- must use a non-production or explicitly approved client workspace before testing client evidence.

### Stable
- promoted only from the exact Lab artifact that passed release gates;
- same canonical Atlas knowledge as the promoted Lab artifact;
- excludes the standalone Accounts Payable architecture fixture;
- production Supabase tenant boundary required;
- no unpublished module may be enabled through configuration or LLM behavior.

## Promotion gates

1. Source regression suite PASS.
2. Enterprise Core / Domain Contract / Supply Chain Domain Pack hashes unchanged unless the release explicitly declares a governed knowledge change.
3. Stage 18.5 AP neutrality acceptance PASS in source/Lab.
4. Stage 19 ingestion + Stage 20 product-completion + Stage 21 collaboration/telemetry regression PASS.
5. Release-integrity endpoint PASS.
6. Readiness endpoint PASS against target dependencies.
7. Supabase security advisor: zero ERROR/WARN security findings.
8. Preview/Lab E2E PASS at desktop and mobile widths.
9. No secret present in browser/static artifacts.
10. Stable is promoted from the already-tested Lab artifact; it is not rebuilt independently.

## Rollback rule

Rollback is application-first. If a release has no irreversible database change, restore the previous Stable deployment immediately. Database rollback is never performed automatically from application rollback. Forward-compatible migrations are preferred.

## Knowledge rule

A release may modify product code without changing canonical knowledge. If canonical data changes, the release manifest must identify each changed module/pack/version and publication approval separately.
