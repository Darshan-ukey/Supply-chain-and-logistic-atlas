# Regression Catalogue

### REG-0027: The writer prompt steered AI into generating app-created identifiers, and one unfixable check zeroed the whole delivery

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree (host report: MALKOM command AI-testing generation failed after 435.8s with `Semantic compilation needs-evidence: NO_GENERATION_RECIPE: A fresh value was requested for orgId, but the operation declares no recipe to make one.` and zero scenarios delivered)
- Original symptom: a fifteen-check generation survived planning, writing, and the repair phase, then died on its final compile with a single `NO_GENERATION_RECIPE` refusal — one check carried `{ orgId: { semanticType: 'org.id', generate: true } }` for an identifier the application itself lists, and that one check took all fifteen down after more than seven minutes of work.
- Reproduction evidence: the exact production shape (list organizations producing `org.id`, read organization consuming it, `generate: true` on the consumer) reproduces the refusal against a real loopback application; the poisoned-repair variant reproduces the walked-in dead end.
- Root cause: four compounding defects. (1) The intent writer prompt actively instructed the failure: "for a BRAND-NEW value use generate: true — never point a new or renamed value at an earlier output," with no qualifier, so a scenario phrased around a new or fresh organization obeyed the instruction and generated an ungeneratable id; the repair prompt repeated the same unqualified rule. (2) The vocabulary already carried per-input `generatedWhenOmitted` recipe flags, but no prompt rule told the model to consult them. (3) `NO_GENERATION_RECIPE` was missing from the AI-repairable set, so once a first shot or a repair introduced the bad selector the loop had no way back — and nothing validated repair feasibility, so a repair could re-introduce it freely. (4) Planning was all-or-nothing: a compilation refused for one scenario threw away every compiled scenario, converting one bad selector into a zero-delivery failure.
- Affected architecture: intent writer and repair prompts, semantic-repair application, the AI-repairable diagnostic set, planning's delivery gate, the plan contract, and the plan validator's scenario-count gate.
- Wider defect-pattern search: every unqualified selector instruction in both prompts was reviewed against the compiler's actual selector semantics; the fixture/secretRef selectors are demand-driven and carry no equivalent trap; the equivalent all-or-nothing gate in evidence acquisition already preserved per-scenario recompilation and needed no change.
- Mature libraries evaluated: not applicable; prompt law, repair validation, and delivery policy are product-specific.
- Systemic correction: the writer and repair prompts state the selector law — `generate: true` only where the operation input shows `generatedWhenOmitted: true`, and an identifier the application itself creates or lists is never generatable: it binds `fromActionId` to the action that creates or lists it, adding that action when missing. A repair that generates an ungeneratable semantic type (no operation input declares a recipe or secret source) is refused at apply time with that exact instruction, and the refusal feeds the next attempt. `NO_GENERATION_RECIPE` is AI-repairable. Planning delivers partial results: when diagnostics all name their scenarios and at least one scenario is clean, the blocked scenarios are dropped with their reasons — recorded structurally on the new optional `plan.droppedScenarios` (contract and both validators updated) and as plain warnings — and the count gate accounts delivered plus dropped against the exact request.
- Regression test: TCV-0044 (`smoke/run-no-generation-recipe-recovery.mjs`) proves the one-call first shot under the new law, the refused poisoned repair with its reason reaching the next attempt, the fromActionId heal, and the partial delivery with its structured record, on the production shape end to end.
- Adversarial counterexample: a diagnostic without a scenario attribution still refuses the whole compilation (dropping would not be safe), and delivering zero scenarios is still a failure — partial delivery never turns "nothing compiled" into success.
- Affected suite result: TCV-0044 passed 16/16 with 0 failures and 0 skips on the corrected tree; TCV-0043 remains 14/14.
- Broader release-suite result: the full `smoke:ci` chain passed on the corrected tree in the verification environment (browser suites included, via the system-browser path).
- Documentation and gap-register updates: CHANGELOG records the behavior change and the plan-contract addition; the MALKOM host RCA thread continues in the host repository.
- Remaining exclusions: no live-model proof that the prompt law is always obeyed (the refusal-and-retry path exists precisely because prompts steer rather than guarantee); host pages do not yet render `plan.droppedScenarios` as a first-class list; UI scenarios are not covered by the new suite.

### REG-0026: A sized output budget starved hidden-reasoning deployments and one empty first answer killed the whole generation

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree (host report: MALKOM command AI-testing generation failed after 13.9s with `AI produced no executable scenarios: planning: AI returned an empty response.`)
- Original symptom: the very first planning call — the intent outline, hinted at `max(1500, 96 × checks)` output tokens — returned an HTTP-success vendor response whose `message.content` was empty with `finish_reason: length`; the host raised a bare error, and the run died on that single call in under fourteen seconds. Before per-call sizing existed every call carried the host-wide ceiling, so this class of deployment had always had room to deliberate and the defect stayed latent.
- Reproduction evidence: a scripted provider returning one empty answer for the sized outline call reproduces the exact production death; a real loopback vendor returning the recorded envelope shape (`finish_reason: length`, 1500 completion tokens, all of them reasoning) reproduces the evidence-free error path of the built-in provider.
- Root cause: three compounding defects. (1) `maxOutputTokensHint` was defined and consumed as if the output budget paid only for visible text; on a deployment that bills hidden reasoning against the same budget, a small sized call can burn its entire budget before the first visible character, which is a success-shaped response with no text. (2) `planOutline` was the one provider call with no retry and no fallback, so planning's cheapest step was also its only single point of failure; `planScenarios` retried, but with the same starving hint, so its retries would have failed identically. (3) Neither the built-in provider nor the planner surfaced the response evidence (`finish_reason`, token usage, hidden-reasoning signals), so the failure read as an unexplainable vendor mystery instead of a budget event.
- Affected architecture: per-call output sizing (the `maxOutputTokensHint` contract), intent outline/write/semantic-repair provider calls, and the built-in OpenAI-compatible provider's response handling.
- Wider defect-pattern search: every `provider.complete` call site in the planning path was audited for the same unguarded single-call pattern; the legacy `AiPlanner` (never instantiated by the orchestrator) shares the hint mechanics but was left on its existing repair loop; UI-action enrichment calls are optional-path and fail soft already.
- Mature libraries evaluated: not applicable; this is the engine's own provider contract and retry policy.
- Systemic correction: one shared `completeWithBudgetRecovery` wraps the outline, write, and semantic-repair calls — a call that throws or returns no visible text is retried exactly once with the hint absent, so the host's full configured output budget applies; a second failure throws with both attempts' evidence. The outline additionally stopped being a single point of failure: when it cannot be produced at all, the whole request is written as one piece and the plan carries a warning naming the double failure. The outline floor rose from 1,500 to 3,000 tokens as deliberation headroom. The built-in provider now reports `AI_PROVIDER_EMPTY_RESPONSE` carrying `finish_reason`, completion-token, and hidden-reasoning evidence, and the `maxOutputTokensHint` contract documents that hosts honoring the hint must grant their full configured budget whenever the hint is absent.
- Regression test: TCV-0043 (`smoke/run-empty-response-recovery.mjs`) proves sized-call recovery on the outline, single-piece fallback with its warning when the outline dies at full budget, recovery from a thrown host error, in-attempt recovery of a starved write call, and the built-in provider's evidence-carrying error with hint-present versus hint-absent budgets observed on the wire.
- Adversarial counterexample: a provider empty at the full budget too still fails — bounded at two calls per step — and the final error names both attempts; the dead-outline fallback still writes the requested scenario count.
- Affected suite result: TCV-0043 passed 14/14 with 0 failures and 0 skips on the corrected tree.
- Broader release-suite result: the full `smoke:ci` chain passed on the corrected tree in the verification environment (browser suites included, via the system-browser path).
- Documentation and gap-register updates: CHANGELOG records the behavior change; the `maxOutputTokensHint` contract documentation now states the visible-text semantics and the hint-absent obligation; the MALKOM host's completion-layer correction (envelope diagnosis and ceiling retry) is recorded in the host repository.
- Remaining exclusions: the engine cannot observe `finish_reason` through host-implemented providers (the provider contract carries text and token counts only), so host completion layers must do their own envelope diagnosis; no per-vendor model of reasoning-token overhead is attempted — the recovery is evidence-driven, not predictive; live-vendor behavior beyond the recorded envelope shape is not reproduced in the suite.

### REG-0025: Repeated reads and cleanup binding produced unrepairable producer ambiguity that killed whole generations

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree (host report: MALKOM command AI-testing generation failed after 364.8s with three identical `AMBIGUOUS_VALUE_PRODUCER: More than one earlier output can provide orgId` diagnostics and zero executable scenarios)
- Original symptom: any scenario that exposed the same typed value twice — most commonly "list organizations" written twice by the intent AI, or a synthesized cleanup step binding after a later read echoed the id its source step had used — refused with `AMBIGUOUS_VALUE_PRODUCER`; the AI repair loop then ran its full attempts without ever changing the outcome, evidence acquisition stopped with no acquirable requirement, and the run ended with status `needs-evidence` and no scenarios.
- Reproduction evidence: compile of the exact MALKOM host contracts with intent `list organization → create org contact → list organization` under automatic cleanup; three such checks reproduce the production triple-diagnostic verbatim.
- Root cause: four compounding defects. (1) `bindFromAvailableOutput` treated every step output as a distinct producer, so two identical side-effect-free reads of one operation counted as two producers even though they observe one value. (2) The synthesized cleanup step searched all outputs instead of mirroring the source step's own bindings, so a later echo made cleanup ambiguous even when every intent action bound cleanly. (3) Cleanup diagnostics carried the synthetic action id `cleanup_<sourceAction>`, which exists in no intent, so `repairSemantic` requested — and `applySemanticRepairs` silently discarded — replacements for an action that cannot be replaced; every repair attempt was a no-op and the repair prompt never showed the scenario's other action ids, so a correct `fromActionId` could only be guessed. (4) Ambiguity was reported as `needs-evidence`, which is not answerable by evidence and misdirected both the acquisition loop and the human reading the failure.
- Affected architecture: semantic producer selection, cleanup synthesis, AI semantic repair, and compilation status classification.
- Wider defect-pattern search: fixture-provisioning binding was inspected for the same synthetic-id attribution defect (its diagnostics now attribute to the triggering intent action); `findIntentValue` ambiguity paths were reviewed and remain explicit-name refusals; owner-create refusal for genuinely competing creations was preserved and re-proven.
- Mature libraries evaluated: not applicable; this is product-specific semantic lineage and repair-loop plumbing.
- Systemic correction: three deterministic narrowings before refusal, none of which guesses — cleanup mirrors its source step's bindings for same-typed inputs; a later same-typed input continues with the one candidate value the scenario already consumed; identical side-effect-free reads (same operation, same inputs, no owner-touching mutation between them) collapse to the earliest step. Remaining refusals report status `ambiguous`, name every candidate action (`candidateIntentActionIds`), and state the exact `values`/`fromActionId` repair. Cleanup diagnostics attribute to the source step's real intent action, the repair prompt includes each affected scenario's full ordered action list, and diagnostics naming no existing intent action no longer trigger repair attempts.
- Regression test: TCV-0030 now proves the enriched candidate-naming refusal, the two-identical-reads collapse to the earliest step, consumed-value continuity, and the cleanup mirror surviving a later echo; the two-owner-creates refusal is unchanged.
- Adversarial counterexample: two customers created before a read still refuse with `AMBIGUOUS_VALUE_PRODUCER`, and reads with different inputs or an owner-mutating step between them still refuse rather than collapse.
- Affected suite result: TCV-0030 passed 70/70 with 0 failures and 0 skips; universal-compiler, semantic-workflow, operation-lifecycle, fixture-provisioning, incremental-recompilation, and engineering-records suites passed on the corrected tree.
- Broader release-suite result: all compile/planning suites of `smoke:ci` passed; the browser-execution suites (engine-conformance Playwright engine, reference-app UI scenarios, golden fixtures) fail in the verification sandbox for a pre-existing environmental reason — the pinned Playwright build's headless shell is not installed there — identically before and after this change.
- Documentation and gap-register updates: typed-value-flow guide documents the narrowing ladder and the cleanup mirror; CHANGELOG records the behavior change; the host-side RCA lives in the MALKOM command repository.
- Remaining exclusions: a mutating owner operation whose resource name differs from the semantic type's owner token (for example resource `organization` versus owner `org`) is not recognized by the collapse guard's resource check unless it also captures the wanted type; explicit equality lineage from contracts and cross-adapter identity equivalence remain unmodelled.

### REG-0024: First packed Directus launcher attempts stopped before business execution

- Status: corrected and affected packed path verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the first packed proof stopped with Windows `spawn EINVAL`; the second built the package but failed to parse npm lifecycle text that preceded the JSON package report.
- Reproduction evidence: the first two `smoke:packed-real-ai-directus` attempts on 2026-08-03. Both ended before the real AI/Directus child run, so both provide 0 business-execution evidence.
- Root cause: the launcher directly spawned `npm.cmd` on Windows, then assumed npm's entire standard output contained only JSON even though the package `prepare` lifecycle emitted build lines first.
- Affected architecture: packed-package test launcher and release evidence collection; product planning and Directus execution were not reached.
- Wider defect-pattern search: clean directory creation, tarball path, installed package version, bare-package import marker, child working directory, environment handoff, timeout, result buffer, and real cleanup result were inspected in the successful repetition.
- Mature libraries evaluated: the existing Node child-process and npm-provided `npm_execpath` were reused; no shell-specific package runner was added.
- Systemic correction: invoke npm's actual JavaScript entry point through the current Node executable and extract the final JSON array from npm output rather than parsing lifecycle text as JSON.
- Regression test: TCV-0035 rebuilds, clean-installs, loads by package name, and runs the complete real-AI Directus journey.
- Adversarial counterexamples: Windows command shims that cannot be directly spawned and valid npm lifecycle output before the machine-readable package report.
- Affected suite result: corrected run passed; package version 0.2.0, 125 files, 989,394 unpacked bytes, clean install true, installed-product marker present, 1/1 journey and 7/7 operations passed, 0 final article/role/policy residue.
- Broader release-suite result: typecheck, build, AI fixtures, 146-check engine conformance, 44-check typed value flow, 20-check reliability, 88-check operation lifecycle, and the real local semantic workflow passed. Full CI and non-Windows packed paths were not run.
- Documentation and gap-register updates: checkpoint, TCV-0035, CLM-0022, traceability, AI-pipeline guide, and real-system proof log updated.
- Remaining exclusions: Directus UI/GraphQL, Medusa, n8n, pnpm/Yarn, Linux/macOS, forced install/network failure, package publication, and production.

### REG-0023: First complex Directus AI journey exposed disconnected authority and cleanup identities

- Status: corrected for the affected HTTP path and host verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: consecutive real-model runs were safely blocked for missing cleanup, routes absent from discovery, and conflicting status authority when the same DELETE path represented a least-privilege refusal and an administrator cleanup.
- Reproduction evidence: the first four `smoke:real-ai-directus` attempts on 2026-08-03; each reported 0 executed operations until the full authority map passed validation. The first executed attempt passed 6/7 but failed the published-state response assertion.
- Root cause: host HTTP evidence, discovery routes, and authoritative mutation records could be supplied as disconnected lists; runtime secret references were compiled but not resolved by the HTTP engine; mutation authority matched only method/path and could not distinguish two evidenced meanings on the same route; the first response expectation used nested object equality rather than the engine's documented JSON-path form.
- Affected architecture: real AI semantic planning, HTTP lowering, mutation validation, cleanup identity, secret redaction, response assertions, and real-system proof reporting.
- Wider defect-pattern search: Directus runtime OpenAPI versus observed schema creation, permission entitlement, user validation, all five business operations, cleanup, same-route refusal/cleanup, API artifacts, residual queries, and real-provider CA handling were inspected. Medusa, n8n, UI, and GraphQL remain open.
- Mature libraries evaluated: existing fetch, Directus runtime contracts, current semantic compiler, shared host HTTP adapter, and environment secret-reference model were reused; no Directus branch or alternate test runner was added.
- Systemic correction: one host operation list now derives evidence, discovery, and authority inputs; stable `operationId` separates same-route meanings; evidence slots can declare environment secret references resolved only at execution; missing references block requests; cleanup uses an isolated in-memory authorization; expected JSON uses explicit path/value semantics.
- Regression test: TCV-0034 is the connected host regression; TCV-0002 now covers two same-route operation-identity cases, TCV-0030 covers compile-time secret-reference safety, and TCV-0006 covers present/missing runtime secret resolution without leaking or sending a blocked request.
- Adversarial counterexamples: least-privilege delete expecting 403 and cleanup delete expecting 204/404 share one route; missing cleanup blocks durable create; a missing CA blocks the model call without disabling TLS; extra legitimate response fields must not defeat an explicit `data.status` assertion.
- Affected suite result: final real run passed 1/1 logical journey and 7/7 operations, with expected 400/403 refusals, cleanup 204, final matching items 0, harness deletions 204, and residual role/policy 0.
- Broader release-suite result: the Directus packed-install repetition passed, as did build, 2 authority-identity fixtures, 12 secret-safety checks, and 5 runtime-secret checks. Full CI, Medusa, n8n, UI, GraphQL, other providers, and cross-platform were not run.
- Documentation and gap-register updates: TCV-0034, CLM-0022, AI/MIS traceability, real-system proof log, target-depth guide, AI pipeline guide, and checklist updated.
- Remaining exclusions: forced cleanup failure, secret lifetime/memory erasure, UI/GraphQL, cross-platform, and production.

### REG-0022: Real-AI planning timeout appeared as an empty skipped run

- Status: corrected and focused/real-provider behavior verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the current real-provider smoke ended with status `skipped`, 0 planned scenarios, 0 executed scenarios, and an empty top-level diagnosis even though planning had failed.
- Reproduction evidence: `npm run smoke:real-ai` on 2026-08-03; discovery completed, planning started, and the retained journal recorded `STAGE_TIMEOUT` after the configured 30-second limit.
- Root cause: the planner timeout is retained as an operational issue and journal entry, but the convenient diagnosis array and smoke summary do not expose that issue; the provider response did not arrive before the shared runtime limit.
- Affected architecture: real-AI planning status, user-facing failure explanation, automation interpretation, and every claim that treats the separate smoke as current real-provider proof.
- Wider defect-pattern search: the current result JSON, journal, command assertions, earlier local real-AI artifacts, normal fixture suite, normal CI composition, and real-system readiness suite were compared. Normal CI and the 66 readiness checks do not call a real model.
- Mature libraries evaluated: not yet applicable; this is connected result propagation and timeout-policy behavior in existing code.
- Systemic correction: result status and verdict now account for run-level errors when no scenario exists; the summary records one run-level error and diagnosis includes the retained operational issue.
- Regression test: TCV-0018 forces a planning timeout and requires status `error`, failed verdict, 0 fabricated tests, 1 run-level error, retained `STAGE_TIMEOUT`, and visible diagnosis.
- Adversarial counterexample: increasing the timeout until one call happens to return would make the smoke green while the hidden-timeout reporting defect remains.
- Affected suite result: failed proof: 0 planned, 0 executed, 0 passed; final status `skipped`; command exit 1.
- Broader release-suite result: build passed immediately before the smoke. No real-target AI suite or full release suite was run.
- Documentation and gap-register updates: real-AI pipeline record and execution checklist updated; capability status remains unproven.
- Remaining exclusions: exact provider-side latency cause, successful current provider run, malformed/outage behavior, Directus/Medusa/n8n AI planning, and target execution remain unproven.

### REG-0021: Target inventory assumed Medusa expressed UI depth through page files

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the first target-depth inventory failed 1 of 15 checks because it found 30 Medusa `page.tsx` files against an assumed minimum of 50.
- Reproduction evidence: first `npm run smoke:real-system-target-inventory` run on 2026-08-03; 14 checks passed and the Medusa UI-depth check failed with observed value 30.
- Root cause: the draft measurement applied a file-routed UI convention to Medusa, whose core admin dashboard declares most routes as `path:` records in a generated route map; plugin pages and core route records were conflated.
- Affected architecture: target-depth reporting and any prioritization derived from Medusa UI size; no Medusa runtime or product scenario failed.
- Wider defect-pattern search: Directus root/module route registries, Medusa dashboard route map and plugin page files, and n8n router/feature-route files were inspected separately; API measures also remain architecture-specific rather than forced into one file convention.
- Mature libraries evaluated: Git's tracked-file index plus Node filesystem/text inspection are sufficient for a reproducible static inventory; no parser library can make different routing architectures semantically identical without architecture-aware rules.
- Systemic correction: retain the 30 page-file value as an informational plugin/file-routing metric, count 272 core Medusa `path:` route records from its actual dashboard route-definition files, and state the method and limits beside every metric.
- Regression test: TCV-0033 requires each exact clean revision, substantial tracked inventory, and architecture-appropriate UI/API depth; it retains independent Directus, Medusa, and n8n checks.
- Adversarial counterexample: lowering the Medusa threshold below 30 would make the test green without measuring its actual core route map and is explicitly rejected.
- Affected suite result: corrected TCV-0033 passed 15 of 15 checks with 0 failures and 0 skips; Medusa reported 272 UI route records, 321 API route files, and 478 exported HTTP handlers.
- Broader release-suite result: the inventory is static evidence only; real-system readiness, reference UI/API suites, packaging, and governance are separate proofs.
- Documentation and gap-register updates: real-system target-depth guide, TCV-0033, changelog, README, and expanded UI/API gate tasks.
- Remaining exclusions: dynamic/generated routes, optional/edition-gated runtime state, live authenticated surface counts, executed business coverage, and cross-platform inventory remain open.

### REG-0020: Lab setup could report success while disposable data remained or the application still could not start

- Status: corrected and first-readiness/helper-control proof passed
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the first Directus account email was rejected; a later restart could not decrypt stored data after temporary keys changed; a Compose shutdown without all profiles returned success while the three labelled data volumes remained; Medusa package downloads repeatedly received HTTP 429; and the first Medusa start appeared to have port 9000 available even though that listener belonged to Zscaler and never returned Medusa health.
- Reproduction evidence: Directus startup/login failures, explicit post-shutdown volume inspection, and two Medusa installation attempts on 2026-08-03; the bounded retry spent 391.6 seconds and still received HTTP 429 for four required Medusa packages.
- Root cause: the disposable account used a locally invalid email shape, generated keys were not stable across restarts, profile-scoped Compose resources were omitted from the shutdown command, the package service temporarily rate-limited downloads, and port ownership was inferred from a listener without verifying its owning process and application response.
- Affected architecture: repeatable local application setup, safe reset, startup diagnosis, and honest dependency reporting.
- Wider defect-pattern search: all three profiles, named volumes, local secrets, published ports, health addresses, restart behavior, reset scope, official setup instructions, and vendor-source cleanliness were inspected.
- Mature libraries evaluated: official versioned containers and each application's official setup path remain the chosen foundation; no custom replacement runtime was introduced.
- Systemic correction: use stable ignored local keys, an accepted disposable Directus identity, host-only port bindings, every profile on full reset, exact Compose-label volume verification, separate Medusa database/application states, and the manifest's isolated Medusa port 19000. Medusa's lockfile and supply-chain checks were not bypassed.
- Regression test: TCV-0032 validates the common application description, complete Compose file, exact clean clones, ignored secret file, separate Medusa states, and confirmation-required reset. Manual stop/start proof also returned Directus and n8n to ready state.
- Adversarial counterexample: exit code zero from a shutdown command is insufficient if labelled data volumes still exist; a healthy PostgreSQL container is insufficient if the Medusa HTTP application never answers.
- Affected suite result: after the network change, frozen offline installation passed, migration completed, Medusa returned HTTP 200 `OK` on port 19000, helper stop/start returned it from ready to not-ready to ready, and TCV-0032 passed 66 of 66 checks with all three applications ready, 0 failures, and 0 skips.
- Broader release-suite result: no product CI or packed-product scenario suite is claimed by this setup proof.
- Documentation and gap-register updates: cross-architecture proof guide, TCV-0032, and real-system checklist preparation tasks.
- Remaining exclusions: dedicated customer/test identities, memory/disk timing, Redis/distributed mode, automatic interruption recovery, cross-platform process control, and all business scenarios remain open.

### REG-0019: Lab could call all applications ready when only Medusa's database was ready

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the lab's first combined result used Medusa database health but did not require the Medusa HTTP application, so it could say the whole lab was ready while no Medusa app was listening.
- Reproduction evidence: helper review on 2026-08-03 found the combined condition before the readiness test was added; the live state had a healthy Medusa database and an unreachable Medusa application.
- Root cause: two different meanings—database ready and application ready—were collapsed into one Medusa result.
- Affected architecture: lab status, progress claims, and every later check that depends on a genuinely running Medusa backend.
- Wider defect-pattern search: Directus anonymous/authenticated health, Directus `ok`/`warn`, Medusa database/app, n8n readiness, combined status, and stated proof limits were reviewed independently.
- Mature libraries evaluated: no new library is needed; direct documented HTTP readiness responses and Docker health are the authoritative observations.
- Systemic correction: expose `databaseReady` and `applicationReady` separately, require both for combined readiness, retain the app failure reason, and state that readiness does not equal product support.
- Regression test: TCV-0032 calculates the required combined answer independently and compares it with the helper's answer; it also requires the Medusa app state to be an explicit boolean.
- Adversarial counterexample: a healthy database beside a missing, crashed, or unreachable application must leave combined readiness false.
- Affected suite result: TCV-0032 first proved database true/application false/overall false, then after the backend became ready proved database true/application true/overall true; the strengthened current run passed 66 of 66 internal consistency and safety checks with 0 failures and 0 skips.
- Broader release-suite result: no compiler, business-scenario, packed-product, security, or release suite is implied by readiness proof.
- Documentation and gap-register updates: cross-architecture proof guide, TCV-0032, and the Medusa readiness checklist remains open.
- Remaining exclusions: the test does not make the Medusa app ready or prove any Medusa business behavior.

### REG-0018: Direct lowering trusted a previously validated cleanup workflow

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: after compilation, changing a cleanup safety-record identity did not stop `WorkflowLowerer`; the custom adapter still received and lowered the altered workflow.
- Reproduction evidence: TCV-0031 failed first at `altered cleanup identity was not blocked by the shared workflow validation gate` on 2026-08-03.
- Root cause: the compiler validated its own freshly built workflow, but the public lowerer assumed that validation remained true. A caller or later in-memory change could therefore bypass cleanup safety-record validation between compilation and lowering. The invariant validator also did not recheck operation executability or compare current operation provenance with step provenance.
- Affected architecture: every public or internal workflow-lowering call, especially cleanup identity, source/cleanup operation, phase, value binding, outcome, dependency, provenance, and authority.
- Wider defect-pattern search: the shared compiler-to-lowerer path, public lowerer export, semantic planner call, adapter validation order, workflow identity, selection decisions, cleanup records, bindings, outcomes, dependencies, evidence revision, provenance, capability, and mutation authority were inspected.
- Mature libraries evaluated: no new library is required; the existing deterministic invariant validator is the authoritative shared gate and structured TypeScript error class is sufficient.
- Systemic correction: call `validateWorkflowInvariants` at the start of every `WorkflowLowerer.lower`; throw public `WorkflowLoweringValidationError` with stable code and diagnostics before building operations or invoking adapters; extend invariants to recheck capability, operation provenance, conflicts, secret-bearing evidence, and mutation authority.
- Regression test: one valid workflow reaches both adapter paths; eight altered/de-authorized families each require `WORKFLOW_VALIDATION_FAILED`, the expected diagnostic, zero normal adapter calls, and zero cleanup adapter calls.
- Adversarial counterexample: a workflow that was valid when compiled is not safe evidence after its cleanup record or Evidence Graph authority changes; prior validation is not perpetual authorization.
- Affected suite result: typecheck and build passed; TCV-0031 passed 88 checks across 14 categories, including 26 pre-lowering checks, with 0 failures and 0 skips.
- Broader release-suite result: contracts, universal-compiler, typed-value-flow, incremental-recompilation, real local semantic-workflow, engineering-record, and packed-product checks passed. The installed package exposed the new lowerer error class. Full combined CI, benchmark, real AI, cross-platform, and release readiness were not executed.
- Documentation and gap-register updates: cleanup/recovery, operation-lifecycle, universal-compiler, API reference, changelog, TCV-0031, PRN-005, CAP-003, CLM-0021, and the Phase 4.3 checkpoint.
- Remaining exclusions: runtime journal recovery, exactly-once cleanup, direct externally constructed legacy-plan execution, every adapter, cross-platform behavior, property/fuzz proof, and production load remain open.

### REG-0017: Cleanup ordering chained unrelated branches and could collapse repeated resources

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the first expanded cleanup-order proof showed that project cleanup depended on unrelated report cleanup merely because the report was created later. Review also showed that two resources created by the same operation could reuse one generated cleanup operation or stop as an ambiguous value binding.
- Reproduction evidence: the expanded `smoke:operation-lifecycle` suite failed first at the independent-branch assertion before the compiler correction on 2026-08-03.
- Root cause: cleanup synthesis chained every cleanup to the previously appended cleanup, so creation order was treated as dependency truth. It also searched the growing step list for an operation id, allowing a newly synthesized cleanup to look like an existing cleanup for another resource, while cleanup input binding did not prefer the exact producing step.
- Affected architecture: automatic cleanup construction, cleanup safety records, branch failure isolation, and repeated same-type resource cleanup.
- Wider defect-pattern search: simple chains, sibling branches, shared parents, repeated operation ids, cleanup identifiers, captured-value producers, safety-record dependencies, and final invariant validation were inspected together.
- Mature libraries evaluated: no additional library is needed; the existing typed workflow dependency graph is the authoritative source and deterministic graph traversal is sufficient.
- Systemic correction: derive reverse cleanup edges from the nearest created-resource dependencies, leave unrelated branches unconnected, restrict explicit-cleanup reuse to original cleanup-phase steps tied to the source, and prefer the source step's output when binding its generated cleanup.
- Regression test: TCV-0031 now proves a three-resource chain, two independent sibling branches whose parent waits for both, and two same-type resources with two cleanup ids and two producer bindings.
- Adversarial counterexample: a global reverse list can appear correct for a chain while causing an unrelated cleanup failure to block safe work; one delete operation id cannot prove that only one resource instance exists.
- Affected suite result: `npm run typecheck`, `npm run build`, and `npm run smoke:operation-lifecycle` passed; the focused suite reported 62 checks across 13 categories, 0 failures, and 0 skips.
- Broader release-suite result: universal-compiler, typed-value-flow, incremental-recompilation, and the real local semantic-workflow suites passed; the engineering-record gate passed before and after the checkpoint strike; packed proof passed with 120 files, 935,022 bytes, 20 required paths, 22 links, clean install/import, and 0 errors. Full combined CI, benchmark, real AI, and release readiness were not executed.
- Documentation and gap-register updates: cleanup/recovery, operation-lifecycle, universal-compiler, API, status, changelog, TCV-0031, CMP-005, CAP-003, CLM-0021, and the Phase 4.3 checkpoint.
- Remaining exclusions: property-generated graphs, runtime cleanup failure continuation, journal recovery, exactly-once cleanup, every adapter, cross-platform execution, and production load remain open.

### REG-0015: Crossed checkpoint tasks could omit direct evidence

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: nine crossed alignment tasks had no immediate evidence sentence while the engineering-record checker still passed.
- Reproduction evidence: completion-integrity audit on 2026-08-03 counted 136 crossed tasks, 127 with immediate evidence and 9 without it.
- Root cause: checkpoint validation checked task counts, percentage, and progress-bar consistency but did not require proof text for each completed task.
- Affected architecture: governance and progress reporting; this did not itself show that the nine underlying actions were unperformed.
- Wider defect-pattern search: every crossed task was inventoried; stale numeric claims and stale documentation were reviewed separately rather than treating this syntactic gate as semantic proof.
- Mature libraries evaluated: not applicable; this is a repository Markdown invariant.
- Systemic correction: require every `[x] ~~task~~` line to be followed immediately by a non-empty `Evidence:` sentence.
- Regression test: the engineering-record suite removes one evidence sentence and must reject the resulting checklist.
- Adversarial counterexample: accurate overall progress counts with a crossed task that has no stated proof.
- Affected suite result: after the required digest/coverage update, the checker passed its positive invariant and blocked all 14 of 14 malformed/inconsistent fixtures with 0 failures and 0 skips; the failed pre-update stale-digest run is not counted as proof.
- Broader release-suite result: the full connected CI passed immediately before this checker change; it must not be used as proof of the changed checker.
- Documentation and gap-register updates: completion-integrity audit gate, TCV-0007, and this record.
- Remaining exclusions: an evidence sentence can still be incomplete or false; manual semantic review and direct commands remain necessary.

### REG-0016: Packed documentation linked to an omitted compatibility guide

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: packaged `docs/UNIVERSAL_COMPILER.md` linked to `SYSTEM_COMPATIBILITY_FOUNDATIONS.md`, but that target was absent from the tarball; the old pack check still passed.
- Reproduction evidence: completion-integrity audit compared relative links in shipped Markdown against the 119-file package manifest.
- Root cause: the pack gate checked a hand-maintained required-file list but did not traverse relative Markdown links or install/import the tarball.
- Affected architecture: installed developer documentation and package-consumption proof; repository-local links still worked.
- Wider defect-pattern search: every relative link in every shipped Markdown file is now checked against the package manifest.
- Mature libraries evaluated: Node filesystem/path APIs and npm's own pack/install commands are sufficient; no additional dependency is needed.
- Systemic correction: ship the compatibility guide, require it explicitly, validate all relative packaged Markdown links, install the real tarball into a clean temporary project, and import the installed public entry point.
- Regression test: `smoke/run-pack-check.mjs` now performs all four checks and fails on any missing target or failed consumption step.
- Adversarial counterexample: a required guide that itself links to an unlisted guide.
- Affected suite result: 120 files, 929,822 bytes, 20 required paths, 22 relative links, clean install passed, installed import passed, 0 errors.
- Broader release-suite result: the earlier full connected CI passed before this strengthened pack test; the affected pack suite was rerun after the correction.
- Documentation and gap-register updates: TCV-0010, CLM-0013, checklist package evidence, and this record.
- Remaining exclusions: other package managers, other operating systems, publication, offline installation, and every runtime export remain open.

Every escaped defect receives a stable `REG-nnnn` entry.

## Entry Template

- ID:
- Status: open | corrected | verified
- First affected version:
- Original symptom:
- Reproduction evidence:
- Root cause:
- Affected architecture:
- Wider defect-pattern search:
- Mature libraries evaluated:
- Systemic correction:
- Regression test:
- Adversarial counterexample:
- Affected suite result:
- Broader release-suite result:
- Documentation and gap-register updates:
- Remaining exclusions:

## Entries

### REG-0014: Preserved scenario decision kept the old graph revision

- Status: corrected and affected-suite verified
- First affected version: unreleased Phase 4.2 draft
- Original symptom: focused compiler and real workflow proofs passed, but incremental recombination returned `needs-evidence` after an unaffected scenario was preserved across a new Evidence Graph revision.
- Reproduction evidence: first `smoke:incremental-recompilation` run after adding per-step selection decisions.
- Root cause: the combined workflow copied the preserved scenario's earlier decision record verbatim, so its evidence revision was correctly rejected as stale by the new validator.
- Affected architecture: selective recompilation where a scenario result is preserved but the combined workflow points to a later graph revision.
- Wider defect-pattern search: scenario objects, value-flow records, decisions, workflow identity, and acquisition decisions were reviewed for revision ownership; the mismatch belonged to the new combined-workflow selection decision.
- Mature libraries evaluated: Node's built-in SHA-256 remains sufficient for stable local record identity; the defect was record lifecycle, not hashing.
- Systemic correction: keep the exact preserved scenario result object, but rebuild the combined workflow's per-step decisions from the final graph and recalculate their and the workflow's identities.
- Regression test: TCV-0029 continues to prove exact unaffected-object preservation and now passes with final-revision selection decisions; TCV-0031 separately rejects stale decisions.
- Adversarial counterexample: mutating the preserved result or accepting its stale revision would make history or authority dishonest and is not allowed.
- Affected suite result: corrected incremental suite passed 54/54; operation-lifecycle passed 35/35; real semantic workflow passed.
- Broader release-suite result: selected compiler, typed-flow, incremental, and reference suites passed; full combined CI remains pending.
- Documentation and gap-register updates: operation-lifecycle guide explains the preserved-history/fresh-decision split; TCV-0031 and CLM-0021 are proof-bounded.
- Remaining exclusions: persistence/restart, distributed concurrent recombination, and production load remain open.

### REG-0013: Echoed identifiers made one original owner look ambiguous

- Status: corrected and affected-suite verified
- First affected version: unreleased Phase 4.1 draft
- Original symptom: the real event workflow stopped before publish because both the topic-create response and a later subscription response exposed `topic.id`.
- Reproduction evidence: first connected `smoke:semantic-workflow` run after removing the old last-output rule.
- Root cause: strict same-type counting treated an echoed relationship id as equal to the single create operation that originally owned the topic identity.
- Affected architecture: semantic producer selection for workflows where later responses repeat an earlier business id.
- Wider defect-pattern search: the real OpenAPI event chain was inspected; it also contains channel, subscription, and message identifiers with resource ownership.
- Mature libraries evaluated: not applicable; this is product-specific semantic lineage, not parsing or graph traversal.
- Systemic correction: prefer exactly one earlier create output whose operation resource matches the semantic type's owner; reject if two owner-create outputs or otherwise equal candidates remain. The former arbitrary last-output fallback was not restored.
- Regression test: TCV-0030 rejects two `customer.id` owner-create outputs; TCV-0020 proves the echoed `topic.id` real workflow still completes.
- Adversarial counterexample: two customers created before a read remain ambiguous and compilation stops.
- Affected suite result: TCV-0030 passed 40/40 and the semantic-workflow reference proof passed one logical test across five operations.
- Broader release-suite result: universal compiler and targeted connected suites passed; full combined CI remains to be run.
- Documentation and gap-register updates: typed-value-flow guide explains the owner rule and its no-guess boundary.
- Remaining exclusions: explicit equality lineage from contracts and cross-adapter identity equivalence are not yet modelled.

### REG-0012: Unrelated incompatible output blocked a valid generator

- Status: corrected and affected-suite verified
- First affected version: unreleased Phase 4.1 draft
- Original symptom: topic creation stopped because an earlier unrelated output named `name` had a different semantic type, even though the input declared a safe generator.
- Reproduction evidence: first universal-compiler and semantic-workflow runs after adding incompatible-output diagnostics.
- Root cause: the draft treated a same-name earlier output as an attempted binding before type selection; name similarity alone was incorrectly allowed to block the next approved source.
- Affected architecture: source priority whenever unrelated outputs and a declared generator coexist.
- Wider defect-pattern search: user-supplied aliases, fixtures, secrets, generated inputs, and output bindings were reviewed separately; only an explicitly supplied user alias represents an attempted incompatible binding.
- Mature libraries evaluated: not applicable; this is deterministic compiler policy.
- Systemic correction: ignore incompatible earlier outputs because they are not selected bindings, then allow a declared generator; continue rejecting explicitly supplied wrong-type values and forged workflow bindings.
- Regression test: the existing OpenAPI event workflow creates generated topic input successfully; TCV-0030 separately proves explicit wrong-type rejection.
- Adversarial counterexample: an explicit `order.id` supplied for `customer.id` is still rejected and cannot fall through to another source.
- Affected suite result: corrected universal compiler passed all listed fixture/adapter cases; TCV-0030 passed 40/40; semantic workflow passed.
- Broader release-suite result: conflict and incremental suites also passed; full combined CI remains to be run.
- Documentation and gap-register updates: TCV-0030 and the typed-value-flow safe stopping rules distinguish supplied incompatibility from unrelated availability.
- Remaining exclusions: property-based source-order permutations and large candidate sets remain open.

### REG-0011: Expanded decision-validator proof omitted its own route evidence

- Status: corrected and affected-suite verified
- First affected version: unreleased TCV-0029 fixture
- Original symptom: the first 54-check incremental-recompilation run expected the complete plan to pass `BuiltinPlanValidator`, but the fixture discovery object declared no API routes; the validator correctly returned `UNPROVEN_API_ROUTE` for `GET /profile` and `POST /order`.
- Reproduction evidence: failed `npm run smoke:incremental-recompilation` expansion on 2026-08-02 after the earlier 49-check suite had passed.
- Root cause: the new end-to-end validator assertion reused a minimal planning discovery fixture that was sufficient for lowering but not for the product's route-provenance gate.
- Affected architecture: test evidence only; no runtime product implementation defect was demonstrated by this failure.
- Wider defect-pattern search: both lowered API targets were compared with discovery; each required method/path/source/confidence evidence.
- Mature libraries evaluated: not applicable; this was authoritative test-data completeness, not a library gap.
- Systemic correction: declare the exact contract-backed `GET /profile` and `POST /order` routes in the discovery fixture and keep the validator assertion.
- Regression test: the corrected TCV-0029 valid plan passes the full built-in validator; malformed decision records remain rejected separately.
- Adversarial counterexample: weakening or bypassing `UNPROVEN_API_ROUTE` would make the test pass for the wrong reason and was not done.
- Affected suite result: corrected suite passed all 54 checks across 17 categories with 0 failures and 0 skips.
- Broader release-suite result: targeted acquisition, compiler, plan, engineering-record, and package checks are rerun after records; combined CI remains tracked by REG-0004.
- Documentation and gap-register updates: TCV-0029 and this entry preserve the failed-first-run explanation.
- Remaining exclusions: synthetic route declarations do not prove a real contract or application route.

### REG-0010: New evidence decision field was absent from the plan validator allowlist

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree draft
- Original symptom: review found that `planJsonSchema` could accept `evidenceDecisions`, while `BuiltinPlanValidator` would independently classify the same top-level field as unrecognized.
- Reproduction evidence: integration review before the expanded TCV-0029 validator cases on 2026-08-02.
- Root cause: the plan has a closed JSON Schema and a separate semantic key allowlist; only the schema had initially been extended.
- Affected architecture: every successful semantic plan that acquired evidence and then passed through the standard built-in plan validator.
- Wider defect-pattern search: decision shape, duplicate IDs, affected/recompiled/preserved relationships, graph references, and policy digests were inspected.
- Mature libraries evaluated: existing AJV remains the shape validator; semantic cross-field checks belong in the existing built-in validator rather than a replacement library.
- Systemic correction: add `evidenceDecisions` to the plan allowlist and validate duplicate IDs, affected/recompiled containment, recompiled/preserved overlap, and acquired-graph references.
- Regression test: TCV-0029 sends a valid acquired plan through `BuiltinPlanValidator` and rejects overlap, duplicate ID, unknown trust field, and malformed policy-digest counterexamples.
- Adversarial counterexample: allowing the field without cross-field checks would accept internally contradictory decision records.
- Affected suite result: 5 decision-validation checks and all 54 suite checks passed with 0 failures and 0 skips after REG-0011's fixture correction.
- Broader release-suite result: targeted acquisition, compiler, plan, engineering-record, and package checks are rerun after records; combined CI remains tracked by REG-0004.
- Documentation and gap-register updates: TCV-0029, CLM-0019, API/selective-recompilation guides, and this entry.
- Remaining exclusions: plan-level records are not yet persisted as standalone restart artifacts or proven across old package consumers.

### REG-0009: Conflict resolver draft could break empty evidence collection and turn optional absence into null

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree draft
- Original symptom: review of the initial authority-resolver draft found that `mergeEvidenceGraphs([])` would throw, although semantic planning can legitimately collect no graph, and absent optional operation fields could be emitted as explicit `null` values.
- Reproduction evidence: pre-test compatibility review on 2026-08-02; the old semantic-planner path calls the shared merge function even when no adapter returns evidence.
- Root cause: the public v2 resolver correctly requires at least one input graph, but the compatibility wrapper inherited that restriction; field comparison normalized absence to `null` without removing it when rebuilding the operation.
- Affected architecture: evidence collection with no configured/returning capability adapter, and merged operations without optional actor or cleanup identifiers.
- Wider defect-pattern search: the resolver's required and optional operation fields, no-conflict path, compilation handoff, and empty graph behavior were inspected.
- Mature libraries evaluated: no new dependency was needed; the correction reuses the existing deterministic graph hashing and TypeScript operation model.
- Systemic correction: keep the strict resolver input contract, make `mergeEvidenceGraphs([])` return a deterministic empty graph, and omit optional fields whose candidate value represents absence.
- Regression test: `smoke/run-evidence-conflicts.mjs` asserts empty-merge compatibility and compiles a resolved operation whose optional fields remain absent.
- Adversarial counterexample: a required non-empty resolver request does not imply that the higher-level evidence collector may reject an ordinary empty collection.
- Affected suite result: 6 compatibility checks and all 59 conflict checks passed with 0 failures and 0 skips.
- Broader release-suite result: targeted compiler, pipeline, records, and package checks are rerun after documentation; combined CI remains tracked by REG-0004.
- Documentation and gap-register updates: TCV-0028, CLM-0018, EVD-003, CAP-002, authority guide, API/compiler guides, and the Phase 3.2 checkpoint are updated.
- Remaining exclusions: real adapters with no evidence and cross-platform package consumers remain part of broader integration proof.

### REG-0008: Completely malformed provider output could crash validation

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the first worker-security run supplied `{ wrong: true }`; schema validation found it invalid, but consistency validation then called `.some` on the missing `attempts` field and threw a `TypeError`.
- Reproduction evidence: first `smoke:evidence-worker-security` execution on 2026-08-02.
- Root cause: `validateProviderOutput` collected schema problems but assumed the typed array fields existed before returning those problems. TypeScript's declared return type was incorrectly treated as runtime proof for untrusted worker data.
- Affected architecture: every in-process or worker evidence-provider response that is so malformed that required arrays are absent.
- Wider defect-pattern search: provider response consistency and resource checks were inspected for direct field access; a single runtime shape guard now protects all later reads.
- Mature libraries evaluated: the existing AJV contract validator remains authoritative; the correction adds the necessary runtime short-circuit rather than replacing it.
- Systemic correction: after schema validation, require the five top-level array fields before any consistency, size, secret, network, or path logic reads them. Invalid data returns the normal contained provider-response diagnostic.
- Regression test: the worker `malformed` export returns only `{ wrong: true }`; Brisk must return `EVIDENCE_PROVIDER_RESPONSE_INVALID`, no evidence graph, and no main-process exception.
- Adversarial counterexample: a compile-time `EvidenceAcquisitionOutputV1` annotation cannot make hostile runtime IPC data valid.
- Affected suite result: corrected worker suite passed its 2 malformed-output checks and all 28 total checks with 0 failures and 0 skips.
- Broader release-suite result: related acquisition, provider-security, provider-conformance, contracts, records, and package checks are rerun after record updates; combined CI remains tracked by REG-0004.
- Documentation and gap-register updates: TCV-0027 and this regression entry added.
- Remaining exclusions: other untrusted boundaries still require the broader malformed-input inventory and fuzz/property proof.

### REG-0006: Cancellation during source-freshness checking could fall through to reacquisition

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: review of the new freshness failure path showed that a cancellation diagnostic could be recorded and then normal reacquisition could continue for the same provider.
- Reproduction evidence: cancellation fixture added while implementing source freshness on 2026-08-02; the first build also exposed an unsafe assumption that an abort signal observed as false at function entry could not change after an await.
- Root cause: freshness failure, timeout, and cancellation initially shared one fallback path. Cancellation is a terminal control signal for new provider work and requires separate handling.
- Affected architecture: provider freshness checking, refresh/reacquisition lifecycle, and user cancellation guarantees.
- Wider defect-pattern search: initial acquisition cancellation and freshness cancellation paths were both inspected. The bounded async helper now checks cancellation before work, after awaited work, and in the failure path.
- Mature libraries evaluated: the platform `AbortController` and `AbortSignal` remain the standard mechanism; no replacement library is needed.
- Systemic correction: centralize bounded-work cancellation observation, remove the invalidated cache entry, stop the provider loop on freshness cancellation, and never begin replacement acquisition.
- Regression test: freshness-cancellation case in `smoke/run-evidence-acquisition.mjs`.
- Adversarial counterexample: cancel while a provider freshness check is pending and assert acquisition call count remains unchanged.
- Affected suite result: build passed; `smoke:evidence-acquisition` passed 16 source-freshness checks including cancellation-without-reacquisition; 0 failures and 0 skips.
- Broader release-suite result: selected related suites pending after record update.
- Documentation and gap-register updates: TCV-0024 and the evidence-provider cancellation decision flow updated.
- Remaining exclusions: full run-level cancelled terminal outcome remains open.

### REG-0005: Required evidence documentation pushed the package beyond its size gate

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: `npm run pack:check` reported 1,205,318 unpacked bytes against the 1,200,000-byte limit while all required package files were present.
- Reproduction evidence: packed-product execution on 2026-08-02 after adding evidence-provider implementation and detailed documentation.
- Root cause: the npm package included 46 generated source maps totalling about 460 KB; those maps referenced TypeScript source files that the package intentionally does not ship. The new documented feature exposed the already narrow budget.
- Affected architecture: package composition, installation footprint, and installed debugging experience.
- Wider defect-pattern search: packed file inventory, JavaScript, declaration, source-map, and documentation totals were inspected. Runtime JavaScript and declarations are required; repository-only source-map references were the avoidable class.
- Mature libraries evaluated: TypeScript's standard source-map output and npm's standard `files` exclusion patterns were retained rather than adding a custom packaging script.
- Systemic correction: keep source maps in local builds and exclude `dist/**/*.map` only from the npm artifact; retain the existing byte limit and required documentation. ADR-0005 records the trade-off.
- Regression test: `smoke/run-pack-check.mjs` checks exact required runtime, declaration, and documentation files, explicitly forbids distributed source maps, and retains entry-count and byte limits.
- Adversarial counterexample: removing required documentation or raising the budget without removing avoidable weight would make the check pass while weakening the product.
- Affected suite result: `npm run pack:check` passed with 104 files and 744,593 unpacked bytes; all 14 required runtime, declaration, metadata, and documentation paths were present; 0 reported errors.
- Broader release-suite result: not executed for this packaging correction.
- Documentation and gap-register updates: ADR-0005 and this regression entry added.
- Remaining exclusions: installed source-mapped debugging is not currently promised; cross-platform packed installation remains open.

### REG-0004: Combined local CI command terminated without a failing-test diagnostic

- Status: open; individual-command verification completed
- First affected version: unreleased 0.2.0 working tree
- Original symptom: `npm run smoke:ci` exited with code 1 without identifying a failed assertion or emitting a terminal suite result.
- Reproduction evidence: first combined run stopped after the engineering-record output as pipeline contracts began; the immediate isolated pipeline-contract rerun passed. A second combined run ended after 295.2 seconds with exit code 1 and no captured output despite a requested 900-second command timeout.
- Root cause: unverified. The near-five-minute second termination suggests an invocation-runner ceiling, but this is an inference and is not accepted as the root cause.
- Affected architecture: developer workflow and combined release-proof execution; no individual product subsystem failure has been reproduced.
- Wider defect-pattern search: every command listed in `smoke:ci` was executed in smaller groups in the same environment. Each command completed successfully, including the packed-artifact check.
- Mature libraries evaluated: not applicable until the termination source is isolated.
- Systemic correction: pending. The combined runner must preserve the active child command, exit reason, elapsed time, and partial results before this defect can be closed.
- Regression test: pending a reproducible runner-level failure.
- Adversarial counterexample: a long combined run that exceeds an external invocation ceiling must report interruption rather than appear to be a product-test failure.
- Affected suite result: all 19 commands composing `smoke:ci` completed successfully when executed individually or in smaller groups; the combined command itself did not pass.
- Broader release-suite result: not claimed; `smoke:real-ai`, benchmark, and release-readiness checks were not part of this execution.
- Documentation and gap-register updates: this entry records the unresolved combined-run gap; no product capability status was upgraded from the combined run.
- Remaining exclusions: a single uninterrupted `smoke:ci` proof and exact termination-source diagnosis remain open.

### REG-0003: Strict schema registration rejected incomplete nested artifact definitions

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: pipeline-contract smoke terminated during AJV registration because artifact fields were required but absent from `properties`.
- Reproduction evidence: first upstream stage-payload schema execution on 2026-08-02.
- Root cause: artifact and provenance fragments were described inline and incompletely instead of reusing one strict shared definition.
- Affected architecture: evidence-acquisition and semantic-planning artifact fields plus conflict provenance fields.
- Wider defect-pattern search: all twelve new wrapper schemas were inspected for nested `required` declarations; artifact and provenance fragments were centralized.
- Mature libraries evaluated: AJV strict-schema validation was retained because it correctly exposed the defect.
- Systemic correction: introduce closed shared artifact and evidence-provenance fragments with every required property declared and bounded formats.
- Regression test: schema registry compilation occurs before all pipeline contract fixtures; any incomplete required declaration fails the suite.
- Adversarial counterexample: incomplete artifact schema requiring undeclared `kind` and `label`.
- Affected suite result: build and schema registration passed; `smoke:pipeline-contracts` passed 9 positive cases and rejected 13 of 13 invalid cases with 0 failures and 0 skips.
- Broader release-suite result: not executed for this contract-local correction.
- Documentation and gap-register updates: regression catalogue and coverage record updated after verification.
- Remaining exclusions: deep referenced domain schemas remain a separate task.

### REG-0002: Coverage gate reported an incorrect adversarial denominator

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the engineering-record report showed 12 negative/adversarial checks and 13 rejected checks.
- Reproduction evidence: first progress-gate execution on 2026-08-02.
- Root cause: two standalone filesystem/checkpoint counterexamples were executed after the fixture array, but the displayed denominator added only one.
- Affected architecture: test evidence reporting and any claim consuming its denominator.
- Wider defect-pattern search: selected test reports were reviewed for separately accumulated cases; the engineering-record script was the changed affected path.
- Mature libraries evaluated: not applicable; this was local counter accounting.
- Systemic correction: calculate one named denominator including both standalone checks and assert rejected count equals that denominator before emitting evidence.
- Regression test: the engineering-record executable now fails on any internal negative/adversarial count mismatch.
- Adversarial counterexample: stale checkpoint metadata, the second standalone rejection omitted from the old denominator.
- Affected suite result: `npm run smoke:engineering-records` reported and rejected 13 of 13 negative/adversarial checks with 0 failures and 0 skips.
- Broader release-suite result: not executed for this reporting-only correction.
- Documentation and gap-register updates: regression catalogue and test coverage documentation updated.
- Remaining exclusions: full release-report denominator audit remains open.

### REG-0001: Stage envelope accepted invalid date-time strings

- Status: corrected and affected-suite verified; broader release verification pending
- First affected version: unreleased 0.2.0 working tree
- Original symptom: `validatePipelineStageEnvelopeJsonContract` accepted the adversarial cancellation timestamp `"yesterday"`.
- Reproduction evidence: first execution of `npm run smoke:pipeline-contracts` on 2026-08-02; 1 of 7 invalid fixtures was incorrectly accepted.
- Root cause: AJV was configured with a `date-time` format callback value of `true`, which annotated the format without validating it.
- Affected architecture: every new stage-envelope date-time field.
- Wider defect-pattern search: the new pipeline contract was the only location using the permissive format registration; existing contracts did not validate date-time formats.
- Mature libraries evaluated: `ajv-formats` 3.0.1, the maintained AJV format implementation.
- Systemic correction: register `date-time` through `ajv-formats` rather than an always-valid format declaration.
- Regression test: `invalid cancellation timestamp` in `smoke/run-pipeline-contracts.mjs`.
- Adversarial counterexample: cancellation request with `requestedAt: "yesterday"`.
- Affected suite result: `npm run smoke:pipeline-contracts` passed 3 positive checks and rejected 7 of 7 negative/adversarial fixtures; 0 failures and 0 skips.
- Broader release-suite result: the selected existing contract, universal-compiler, and semantic-workflow suites passed; the full release suite was not executed.
- Documentation and gap-register updates: regression catalogue updated; checkpoint remains incomplete until rerun.
- Remaining exclusions: other stage contracts and the full release suite are not yet implemented/executed.
### REG-0007: New provider-security test did not reach the product checks

- Status: corrected and affected-suite verified
- First affected version: unreleased 0.2.0 working tree
- Original symptom: the first `smoke:evidence-provider-security` run stopped at fixture construction with `ReferenceError: apiKey is not defined`; no provider-security behavior had executed.
- Reproduction evidence: first execution on 2026-08-02 after adding the provider-security suite.
- Root cause: the fixture declared the value as `aiKey` but used the nonexistent shorthand name `apiKey` in its configuration object.
- Affected architecture: test harness only; this failed run provides no product-security evidence.
- Wider defect-pattern search: the fixture's other secret, tenant, network, and path variables were checked for declaration/use mismatches; the corrected suite then exercised every named category.
- Mature libraries evaluated: not applicable; this was a fixture naming defect.
- Systemic correction: use the explicit `apiKey: aiKey` mapping and require the suite's final category report before accepting any security claim.
- Regression test: the same executable now constructs a config containing the known AI key, then asserts that exact value is absent from the safe provider context.
- Adversarial counterexample: a suite that exits before its product assertions must never be counted as a security pass merely because failure was expected somewhere.
- Affected suite result: corrected rerun passed 23 checks across legacy opt-in, context minimization, configured-secret output, tenant isolation, network destination, and artifact path categories; 0 failures; 0 skips.
- Broader release-suite result: related build, acquisition, and conformance suites are rerun separately; full combined CI remains tracked by REG-0004.
- Documentation and gap-register updates: TCV-0026 records the defect and exact coverage; the first failed run is not included in claim evidence.
- Remaining exclusions: isolated worker, direct Node.js access controls, operating-system/container enforcement, and real multi-tenant proof remain open.
