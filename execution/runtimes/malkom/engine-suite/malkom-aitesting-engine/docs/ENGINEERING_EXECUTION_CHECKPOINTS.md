# brisk-aitesting Engineering Execution Checkpoints

Status: active source of truth  
Started: 2026-08-02  
Scope: complete product-engineering mandate approved by the product owner

## Overall Progress

Task-count progress: **213 / 593 completed (35.9%)**
Progress: `███████░░░░░░░░░░░░░`

This is a count of explicit checklist tasks, not an estimate of elapsed time,
remaining engineering effort, or release readiness. Large adapters, security
proof, benchmarks, and cross-platform release gates can require substantially
more effort than an individual record or contract task.

## Operating Commitment

This checklist records the complete execution programme for turning
`brisk-aitesting` into a world-class, general-purpose, locally embeddable,
AI-assisted testing product.

The product owner's earlier instructions and expectations remain binding:

- follow the complete product-engineering mandate, not a reduced architectural interpretation;
- deliver nothing less than world-class concepts, implementation, developer experience, security, observability, verification, and documentation;
- maintain full honesty about what is built, tested, skipped, blocked, synthetic, reference-proven, host-proven, or production-proven;
- document what every test actually covers, including subtle defects, boundary conditions, proof depth, authoritative inputs, denominators, and exclusions, so users and contributors can understand why the test exists and what it does not prove;
- proactively document every important product behaviour as durable product knowledge: define what it means, explain at a useful high level how Brisk identifies and handles it, distinguish closely related states such as full/partial/missing/invalid, state the resulting action, and state both proven depth and remaining limits;
- do not hallucinate capabilities, results, provenance, support, completeness, or test outcomes;
- use this file as the execution source of truth and follow its dependency-aware order;
- break every checkpoint into executable tasks and strike through each task only after its applicable proof exists;
- preserve existing user work and reuse existing architecture and data flows before adding replacements;
- do not weaken, silently skip, reorder, or declare complete any non-negotiable requirement merely to make progress appear faster;
- report failures, exclusions, denominators, and remaining gaps explicitly;
- show the overall completed/open checklist progress bar whenever work is completed, and identify it as task-count rather than effort-weighted progress;
- keep working through safe in-scope tasks when an external dependency blocks one proof path.
- communicate progress in ordinary, jargon-free language first: explain who or
  what is affected, what Brisk now does, why it matters, and what remains
  unproven before introducing a product or programming term; whenever a term
  such as provider, conformance, contract, evidence, lifecycle, or reusable
  gate is unavoidable, define it immediately with a concrete example that a
  non-developer can understand.

Completed checklist entries use `[x] ~~task~~`. An entry means only that the
task itself and its stated evidence are complete. Code existing without proof
does not qualify.

## Approved Product Decisions

- [x] ~~DEC-001: Target MCP 2026-07-28 natively and retain 2025-11-25 compatibility.~~  
  Evidence: product-owner approval in the Codex task on 2026-08-02.
- [x] ~~DEC-002: Keep `brisk-aitesting` as a lightweight core and place heavy adapters in optional packages.~~  
  Evidence: product-owner approval in the Codex task on 2026-08-02.
- [x] ~~DEC-003: Evolve the append-only local journal and atomic artifact store behind pluggable storage contracts; do not require a native database in the default package.~~  
  Evidence: product-owner approval in the Codex task on 2026-08-02.
- [x] ~~DEC-004: Deliver dependency-safe vertical slices in this order: engineering truth, pipeline/evidence, OpenAPI proof, CLI, MCP, remaining adapters, benchmarks, and release proof.~~  
  Evidence: product-owner approval in the Codex task on 2026-08-02.
- [x] ~~DEC-005: Model data/API platform foundations rather than building a Hasura-specific or Directus-specific compiler. Use one vendor-neutral GraphQL/API capability path; thin evidence connectors may translate platform metadata, roles, permissions, and optional REST/OpenAPI surfaces into common Evidence Graph facts.~~  
  Evidence: product-owner approval in the Codex task on 2026-08-03; Hasura and Directus are required compatibility proofs, not universal compiler design centres.
- [x] ~~DEC-006: Use Directus, Medusa, and n8n as the first real cross-architecture proof set for `brisk-aitesting`; treat them as independent applications under test, never as the product or as vendor-specific compiler design centres.~~  
  Evidence: product-owner approval in the Codex task on 2026-08-03 after comparing the database-generated API, transactional commerce, and event/workflow architecture choices.
- [x] ~~DEC-007: A full claim for any AI-driven feature requires a real-model response to be consumed through the freshly packed product's complete user path and executed against the applicable real application. Fixed AI fixtures remain necessary safety proof but cannot establish AI planning, AI coverage, AI healing, AI explanation, or real-system support by themselves.~~  
  Evidence: product-owner non-negotiable correction on 2026-08-03; `docs/engineering/REAL_SYSTEM_AI_PIPELINE.md` defines the resulting claim boundary and required response-to-execution trace.
- [x] ~~DEC-008: Make complex connected real-business journeys the default AI acceptance proof. A simple demo may diagnose connectivity or one pipeline boundary but can never approve a product capability or set the product's quality ceiling.~~  
  Evidence: product-owner correction on 2026-08-03 after rejecting a basic-pipeline framing. Complex means connected UI/API or workflow steps, meaningful state, multiple identities or permission boundaries where applicable, positive and negative paths, dependent values, failure/recovery, cleanup, and final-state verification.
- [x] ~~DEC-009: Make zero-friction global host integration the normal product path: either documented `BRISK_AITESTING_*` environment settings or one ready `defineHostConfig({...})` object with inferred types and safe defaults. Keep `defineConfigFromHost` as an advanced compatibility path, never the normal onboarding requirement.~~  
  Evidence: product-owner approval on 2026-08-06 after rejecting the existing type-plus-mapper-plus-manual-runtime setup as unsuitable for broad adoption.

## Execution Rules

1. Preserve current uncommitted user changes.
2. Inspect and reuse the current implementation before adding code.
3. Keep the evidence graph authoritative for executable capability knowledge.
4. Keep host-specific behavior outside the universal compiler.
5. Keep AI output non-executable and closed-schema validated.
6. Build shared application services before adding or expanding product surfaces.
7. Complete a working vertical slice before broad adapter expansion.
8. Add fault, negative, adversarial, interruption, security, and cleanup proof alongside positive proof.
9. Do not let optional adapters, external services, or unavailable platforms block unrelated core work.
10. Update this checklist, the capability matrix, traceability ledger, claim ledger, and regression catalogue as part of each change.
11. Every new or changed test must update its test-coverage record; a content-digest gate prevents tests from changing silently without coverage review.
12. Every completion report must recalculate and display the overall checklist progress; stored counts and the progress bar are validation-gated.
13. Do not document only that a behaviour exists. Document what it means, how Brisk recognizes it, what decision follows, why that decision is safe, and what the current proof does not establish.
14. Start every progress update with the user-visible outcome in plain
    language. Do not use an unexplained product or programming term as the
    explanation itself.
15. Model shared foundations first. Vendor connectors may explain metadata,
    roles, permissions, naming, and exposed surfaces, but they must not add
    vendor branches, vendor operations, or vendor permission rules to the
    universal compiler.
16. Never call a fixed-response fixture a full AI feature proof. Every completed
    AI feature claim must retain the real provider/model parameters (without
    secrets), response acceptance or rejection, trusted compilation decision,
    actual execution result, and cleanup result from a clean-installed package.
17. If recovery or healing does not consume a real model response, describe it
    as deterministic or rule-based recovery rather than AI self-healing.
18. Default AI acceptance proof to complex connected real-application journeys.
    Keep simple smoke tests only as clearly labelled diagnostics; never use them
    to approve a product capability, real-system support, or release readiness.

## Dependency-Safe Critical Path

```text
engineering truth and gates
  -> shared versioned pipeline contracts
  -> evidence acquisition and incremental recompilation
  -> compiler and cleanup invariants
  -> cross-architecture lab provisioning (may proceed without claiming adapter support)
  -> OpenAPI vertical reference proof
  -> reliability, healing, security, and observability foundations
  -> shared application service
  -> complete CLI
  -> dual-era MCP
  -> optional production adapters
  -> benchmark corpus and regression gates
  -> cross-platform packed release proof
```

## Zero-Friction Global Host Integration Gate

This gate defines **zero-friction host integration** globally, not from Brisk's
private configuration shape. A normal user connects an application without
declaring TypeScript interfaces, writing a mapper, selecting engines, copying
security settings, or understanding internal planning objects. The normal paths
are:

1. environment-only: populate documented `BRISK_AITESTING_*` settings and run;
2. ready host object: call `defineHostConfig({...})` with application values
   and optional host-owned AI/authentication functions.

`defineConfigFromHost` remains available for advanced hosts, but its flexibility
must not leak into five-minute onboarding. AI setting detection means reading
only the documented product namespace or an explicit host object; it never
means scanning arbitrary environment secrets.

Tradeoff: read-only discovery can use safe defaults immediately. State-changing
tests still require trustworthy authentication and cleanup knowledge. The
product must request only that missing information in plain language instead
of exposing its complete internal configuration.

### A. Product contract and honest baseline

- [x] ~~Define zero-friction globally and freeze environment-only plus ready-host-object as the two normal paths.~~  
  Evidence: the definition above was approved by the product owner on 2026-08-06; Brisk is only the first host proof.
- [x] ~~Inspect and record reusable configuration paths before adding code.~~  
  Evidence: inspection on 2026-08-06 found reusable `defineConfig`, `defineConfigFromHost`, `normalizeConfig`, environment-file loading, provider configuration, CLI configuration loading, and existing examples. It confirmed `defineHostConfig` has never existed in repository history and the current host guide requires expert-owned types, mapping, engines, security settings, evidence, and execution plumbing.
- [x] ~~Freeze the small public `HostConfig` object accepted by `defineHostConfig`, with TypeScript inference and JavaScript compatibility; users must not declare their own interface.~~  
  Evidence: `src/host-config.ts` exports the inferred `HostConfig` object and `defineHostConfig`; README, JavaScript config, and TypeScript example use the function without declaring a host interface; build and installed-package import passed.
- [x] ~~Freeze the complete documented `BRISK_AITESTING_*` environment catalogue for application, AI, authentication, contracts, and only the small set of normal runtime choices.~~  
  Evidence: `docs/HOST_INTEGRATION.md` records the exact application, execution, AI, auth, contract, artifact, timeout, retry, and browser names plus their required conditions and limits; TCV-0038 exercises the implemented catalogue.
- [x] ~~Define and enforce one precedence rule: explicit host object, then documented product environment, then safe default, otherwise a plain missing-information error.~~  
  Evidence: the host guide states the four-step order; TCV-0038 proves explicit object values override environment, existing process environment overrides named files, defaults apply, and unresolved requirements stop with exact object/environment names.
- [x] ~~Define safe defaults for discovery, engines, artifacts, retries, timeout, browser mode, network policy, secret redaction, strict validation, fallback refusal, and preview/execution behavior.~~  
  Evidence: `defineHostConfig` supplies built-in engines through existing orchestrator defaults, automatic host HTTP capability adapter, all-surface discovery, 120-second timeout, one retry, headless browser, local/target-only network, redaction, strict validation, fallback/AI-target refusal, safe UI healing, and preview-only execution; TCV-0038 checks these defaults and the packed installed call rechecks preview plus strict mode.

### B. Minimal implementation

- [x] ~~Implement and export `defineHostConfig({...})` without a mapper or manually constructed internal configuration.~~  
  Evidence: public source/export, build, TCV-0005 runtime inventory, TCV-0038 behavior suite, and TCV-0010 clean-installed invocation passed.
- [x] ~~Support an environment-only host path that reads only documented `BRISK_AITESTING_*` names and never scans arbitrary secrets.~~  
  Evidence: CLI falls back to `defineHostConfig()` when no config file exists; named environment files load deterministically; TCV-0038 proves unrelated `OPENAI_API_KEY` is ignored; TCV-0004 executes an environment-only OpenAPI scenario successfully.
- [x] ~~Support one small host-owned AI completion function so native or future providers do not require a full provider class.~~  
  Evidence: `HostConfig.ai` accepts the common `AiPlannerProvider` shape with `name` and `complete`; TCV-0038 proves it passes through without creating built-in provider config. Real native provider families remain separately unproven.
- [x] ~~Support one small host-owned test-session function for applications that already own login/session creation.~~  
  Evidence: `auth.createSession()` accepts sync/async `AuthConfig`; TCV-0038 proves preview calls it zero times, enabled execution calls it exactly once, and an empty returned bearer token is rejected.
- [x] ~~Return plain errors for every missing or contradictory required value, naming the exact environment setting or object field that resolves it.~~  
  Evidence: TCV-0038 rejects missing app name/URL/model/key/token, invalid URL/provider/execution/timeout, and empty callback token with the exact resolving field or environment name; 54/54 checks pass.
- [x] ~~Keep secrets out of generated configuration, prompts, plans, results, diagnostics, logs, and artifacts; generated files may contain secret environment-variable names only.~~  
  Evidence: init emits only commented placeholders and environment names; TCV-0004 checks no active placeholder AI key, TCV-0038 proves built-in config retains `apiKeyEnv` rather than copying the AI key, and the existing TCV-0026 secret-context/output gate remains the connected redaction proof. Runtime auth necessarily exists in memory for execution; memory erasure remains unproven.
- [x] ~~Preserve `defineConfig`, `defineConfigFromHost`, existing files, and current CLI behavior as backwards-compatible advanced paths.~~  
  Evidence: legacy functions remain exported; TCV-0038 maps the legacy host successfully; TCV-0005 retains required exports; TCV-0004 passes prior run/doctor/inspect/clean/error behavior while adding the minimal paths.
- [x] ~~Make `init` generate a ready host config and `.env.example` without overwriting files or inserting real secrets.~~  
  Evidence: TCV-0004 runs init twice, proves generated `defineHostConfig` and `.env.brisk-aitesting.example`, preserves an inserted user line and the original config on the second run, and confirms AI/auth secret placeholders remain commented.

### C. Public documentation and examples

- [x] ~~Replace the README mapper-first host section with environment-only and minimal `defineHostConfig` five-minute paths; link advanced control separately.~~  
  Evidence: README installation, quick config, host section, AI environment setup, and website host example now lead with pinned Git, environment-only, and minimal object paths; the mapper is linked only as advanced.
- [x] ~~Rewrite `docs/HOST_INTEGRATION.md` so the first complete path is minimal and expert mapping is clearly advanced.~~  
  Evidence: the shipped guide now starts with the two normal paths, then documents existing AI/login functions, the full environment table, precedence, defaults, trusted-operation limit, generated-file safety, and advanced mapper separately; TCV-0010 requires and link-checks the guide in the packed artifact.
- [x] ~~Update `docs/CONFIGURATION.md` and `docs/API_REFERENCE.md` with the exact object, environment catalogue, precedence, defaults, callbacks, errors, and current provider limits.~~  
  Evidence: configuration now labels the manual object and mapper advanced and links the complete minimal guide; API reference leads with `defineHostConfig`, environment-only invocation, async result, and advanced mapper boundary; built-in provider limits remain explicit.
- [ ] Add copy-ready JavaScript and TypeScript examples plus generated `.env.example`, and prove every shipped example type-checks or runs against the packed product.
- [x] ~~Add digest-bound coverage documentation explaining what environment-only, host-object, callback, precedence, validation, secret, compatibility, and scaffold tests prove and do not prove.~~  
  Evidence: TCV-0038 documents 54 host-config checks and exclusions; updated TCV-0004, TCV-0005, and TCV-0010 document CLI scaffolding/execution, public exports, and clean package consumption with current SHA-256 digests; engineering-record validation reports 38 records, 26 fully documented, 12 legacy backfills, 0 failures/skips.

### D. Verification and Brisk proof

- [x] ~~Add focused positive, missing-value, conflict, malformed-value, secret-safety, callback, backwards-compatibility, and no-overwrite tests.~~  
  Evidence: TCV-0038 passes 54/54 configuration checks across 12 categories and TCV-0004 passes init/no-overwrite/preview/enabled/environment-only CLI paths; deliberately invalid inputs are rejected rather than counted as harness failures.
- [x] ~~Repair malformed semantic AI intent through the host's existing provider before failing generation, with a bounded attempt count and no locally invented business actions.~~  
  Evidence: TCV-0002 proves empty-actions then valid recovery in two provider calls and an always-invalid provider stopping after two configured repairs/three total calls with the exact final error. Git-installed Brisk commit `004285d460728e4e1f12a6b0ae2977cd39c329ce` then accepted and executed the normal user-style real-AI run `57b380f0-28f6-44b9-a48d-9fff1f170c50`: seven linked operations, 1/1 passed, 0 failed/skipped, and cleanup included.
- [x] ~~Build, run connected regressions, pack cleanly, install from Git-compatible package contents, and import/run the new public API without source fallback.~~  
  Evidence: TypeScript build, host-config, contract, CLI, and engineering-record suites passed; TCV-0010 packed 131 files/1,083,127 bytes, checked 27 required paths and 41 links, installed into a clean project, imported and invoked installed `defineHostConfig`, and reported 0 errors. The complete connected `smoke:ci` rerun remains required before final gate closure and is not implied by this task.
- [x] ~~Replace Brisk's custom host type-and-mapper assembly with minimal `defineHostConfig` while preserving runtime AI, short-lived authentication, trusted operations, security boundaries, and existing user work.~~  
  Evidence: Brisk installs Git commit `54c863338f70e09988d932d7a22b0bc38be3fb15`; `packages/server/src/domains/testing-aitesting.ts` now supplies the small host object and existing Brisk AI callback while `defineHostConfig` owns safe defaults. Brisk server type-checking and installed public export checks passed. Stable operation IDs were added to the host authority list so exact trusted evidence matches without allowing unknown mutations.
- [x] ~~Start Brisk and prove preview configuration plus authorized execution wiring through the minimal path; record supplied settings, defaults, callbacks, results, failures, exclusions, and remaining limits.~~  
  Evidence: `docs/engineering/BRISK_ZERO_FRICTION_HOST_PROOF.md` records database/certificate/provider/timeout/empty-intent/operation-ID failures, bounded provider-driven intent repair, and two accepted real-AI runs. The normal user-style rerun `57b380f0-28f6-44b9-a48d-9fff1f170c50` supplied no routes or operation IDs: 35,921 ms generation, 5,557 AI tokens, one logical journey compiled to seven dependent operations, 1/1 passed, 0 failed/skipped, 1,187 ms execution, zero warnings, and cleanup included. Browser-click and broad-system proof remain explicitly excluded.

### E. Deep connected-workflow recovery

The authoritative acceptance request is the product owner's complete BRISK
workflow prompt beginning `Run a deep BRISK workflow test across API, UI,
auth...`. Passing a smaller substitute does not complete this checkpoint.

- [x] ~~Retain and inspect both real failed attempts instead of treating the smaller seven-operation proof as sufficient.~~  
  Evidence: runs `run_71445207-0640-49de-9ec8-5a24367e0ed8` and `run_1b80a10b-03fe-4945-bd39-b11f4d2038d0` preserve respectively the empty-action failure and the later ambiguous/missing dependent-ID failures for the exact deep prompt.
- [x] ~~Add an explicit, validated way for AI intent to say which earlier action produced each dependent value when several channels, topics, messages, or subscriptions exist.~~  
  Evidence: intent values now accept `fromActionId`; the compiler resolves only an earlier action's type-compatible output and records the resulting dependency without exposing runtime capture paths to AI.
- [x] ~~Prove unique, missing, forward, incompatible, and ambiguous producer references without weakening the compiler's refusal to guess.~~  
  Evidence: the typed-value-flow suite passes 50/50 checks, including six explicit-producer checks for correct second-producer selection, dependency recording, missing and future producer rejection, and ambiguous-output rejection. Incompatible typed edges remain covered by the existing rejection checks.
- [ ] Expand the Brisk host evidence supplied to `brisk-aitesting` so the requested health, anonymous-auth, resource-read, message-read, subscription-read, negative-validation, monitoring, and cleanup checks are genuinely available.
- [ ] Add a general discovered-UI-page evidence path so dashboard, channels, topics, and playground checks compile from observed pages and grounded controls rather than Brisk-only compiler rules.
- [ ] Generate the exact unshortened acceptance prompt through Brisk's installed Git package and prove every requested available area appears in the accepted plan; list any unavailable request explicitly rather than silently omitting it.
- [ ] Execute the accepted plan against the running Brisk application, retain per-check results and resource cleanup proof, and rerun it to expose nondeterministic AI or dependency failures.
- [ ] Update coverage, claims, requirements, regression, host-integration documentation, and this progress count only from the retained exact-prompt proof.
- [ ] Update capability, requirements, claims, regression, coverage, documentation, and progress records only after matching proof exists.

## Cross-Architecture Real-System Proof Programme

The product owner's phrase "clone and implement all three" means all of the
following: obtain a pinned official source revision, make the application start
repeatably on this laptop, prepare isolated test data and accounts, exercise it
through the packed `brisk-aitesting` product, retain understandable evidence,
and clean up what the test created. A downloaded repository or a successful
application start is preparation, not proof that `brisk-aitesting` supports it.

The three applications remain outside the `brisk-aitesting` repository under
`C:\Users\u306076\Documents\azure-pubsub`. Their official source, published
contracts or schemas, and observed runtime responses are authoritative for what
they expose. Generated guesses and vendor names inside universal compiler
selection rules are not authoritative.

Tradeoff: begin with shallow, commit-pinned clones so setup is reproducible and
does not consume unnecessary disk space. Preserve the ability to deepen a clone
later if source-history testing becomes necessary. Begin each application in a
single-laptop mode; add multi-worker or distributed modes only in the explicit
later tasks below.

### A. Alignment, scope, and honest gaps

- [x] ~~Confirm that the product is `brisk-aitesting` and that Brisk, Directus, Medusa, and n8n are applications used to expose product weaknesses rather than the product's design centre.~~  
  Evidence: product-owner correction and approval in the Codex task on 2026-08-03 plus mandate section 1 and DEC-006.
- [x] ~~Inspect the existing implementation and records before adding this programme; identify reusable evidence, compiler, lowering, journal, cleanup, result, security, and packed-package paths.~~  
  Evidence: repository and checkpoint inspection on 2026-08-03 found the shared paths and the existing Directus/GraphQL requirements while preserving the dirty worktree.
- [x] ~~Define "implemented on an application" as repeatable local start, isolated setup, packed-product execution, positive and negative outcomes, cleanup, evidence, and documented limits rather than clone-only or fixture-only success.~~  
  Evidence: definition immediately above this checklist, derived from the approved product mandate and reporting rules.
- [x] ~~Record the initial gap list: reference fixtures are built; Directus/GraphQL is specified but not real-system proven; Medusa and n8n real-system proofs are missing; no current product decision blocks preparation; internet, application startup, and machine resources remain external dependencies to verify.~~  
  Evidence: source-of-truth, traceability, repository, runtime-tool, Docker-engine, and disk inspection on 2026-08-03.
- [x] ~~Create a durable plain-language proof guide describing what each application teaches, what every scenario attempts, how `brisk-aitesting` recognizes success/failure/missing information, and what each result does not prove.~~  
  Evidence: `docs/CROSS_ARCHITECTURE_PROOF.md` defines the three architecture lessons, implementation threshold, expected-refusal execution, result explanation, eight information/result states, authority order, startup tradeoffs, gap list, and readiness-proof limit.
- [ ] Update the capability matrix, requirements traceability, claim ledger, regression catalogue, and test-coverage record whenever a real-system proof changes a product claim.

### B. Safe repository acquisition and repeatable lab setup

- [x] ~~Verify each target path is absent or belongs to the intended official repository before writing into it; never overwrite an existing directory.~~  
  Evidence: pre-clone PowerShell inspection on 2026-08-03 reported all three exact target paths absent, followed by official-remote reachability checks; no existing directory was overwritten.
- [x] ~~Clone the official Directus repository into `C:\Users\u306076\Documents\azure-pubsub\directus`, pin and record the exact commit, remote, license, prerequisites, and startup choice.~~  
  Evidence: clean shallow official clone has 4,497 tracked files, 0 dirty paths, commit `b1d7a45a77661fd13928a53448c06649f36b56f5`; remote, source requirements, MSCL-1.0-GPL license, stable 12.2.0 runtime, and official container/SQLite startup choice are recorded in `versions.json` and the proof guide.
- [x] ~~Clone the official Medusa repository into `C:\Users\u306076\Documents\azure-pubsub\medusa`, pin and record the exact commit, remote, license, prerequisites, and startup choice.~~  
  Evidence: clean shallow official clone has 23,419 tracked files, 0 dirty paths, commit `efab588e9ce621f998be4ec4431f5b15486aaac0`; remote, Node/PostgreSQL requirements, MIT license, stable 2.18.0 runtime, and official sibling test-application startup choice are recorded in `versions.json` and the proof guide.
- [x] ~~Clone the official n8n repository into `C:\Users\u306076\Documents\azure-pubsub\n8n`, pin and record the exact commit, remote, license, prerequisites, and startup choice.~~  
  Evidence: clean shallow official clone has 26,109 tracked files, 0 dirty paths, commit `0839326a9ba41ecb85a72b71ffc15fe42a15364b`; remote, Node/pnpm requirements, Sustainable Use/enterprise-file licenses, stable 2.32.7 runtime, and official container/SQLite startup choice are recorded in `versions.json` and the proof guide.
- [x] ~~Inspect each official README, contribution guide, package-manager declaration, environment template, container definition, and health endpoint before choosing startup commands.~~  
  Evidence: repository files and official setup guides were inspected; the source proves Directus `/server/health`, Medusa `/health`, and n8n `/healthz` plus `/healthz/readiness`; missing root quick-start/container files were not guessed and were resolved through each project's official documented setup path.
- [x] ~~Keep passwords, tokens, seeded identities, ports, data folders, and container names isolated per application and out of committed files and captured reports.~~  
  Evidence: each service has a distinct localhost port, Compose service/container and named-volume scope, the disposable identities and stable keys remain in Git-ignored `.env.local`, `git check-ignore` passed, TCV-0032 checks the exclusion, and readiness output records `tokenPrinted: false` without emitting credential values.
- [x] ~~Add repeatable start, readiness, stop, reset, and diagnosis helpers without modifying vendor source unless a documented unavoidable defect requires a minimal patch.~~  
  Evidence: `lab.mjs` now owns Directus/n8n containers, the Medusa database, and the exact recorded Medusa application process on port 19000. A manual helper proof started all Medusa parts to HTTP 200, stopped the recorded process plus database to not-ready, restarted both to ready, refused to adopt/stop an unrecorded ready process, retained confirmation-required reset, and emitted machine-readable success; TCV-0032 then passed 66/66 manifest, source, safety, and readiness checks. Vendor clones remain clean and unmodified.
- [ ] Capture setup time, disk use, memory expectations, required services, port use, and exact failures or workarounds for each application.

### C. Shared `brisk-aitesting` real-system contract

- [x] ~~Define one vendor-neutral application-under-test manifest containing application identity, authoritative evidence sources, base addresses, allowed hosts, authentication references, isolation boundary, cleanup policy, readiness proof, and capability labels.~~  
  Evidence: `reference-apps/real-systems/applications.json` describes Directus, Medusa, and n8n through one shared shape without stored credential values; TCV-0032 passes 27 common-manifest checks plus 36 setup/readiness checks, and the lab README explains that application names are report identity rather than permission to guess compiler behavior.
- [ ] Reuse existing configuration, evidence-provider, compiler, workflow, lowering, journal, result, redaction, and artifact paths; add code only where a demonstrated gap prevents a real run.
- [ ] Define the same proof stages for all three applications: readiness, discovery, evidence acquisition, planning, validation, execution, verification, cleanup, and result explanation.
- [ ] Define result wording that says exactly what was attempted, what the application returned, whether that response was expected, what was created or changed, and whether cleanup completed.
- [ ] Define common positive, expected-refusal, invalid-input, missing-information, authentication, authorization, timeout, cancellation, cleanup, and residual-state scenario categories.
- [ ] Prevent a vendor name from selecting a compiler operation, outcome, permission, payload, or cleanup rule; add a test that fails if the universal core branches on Directus, Medusa, or n8n.
- [x] ~~Run the complex Directus real-AI API journey from a freshly packed and clean-installed `brisk-aitesting` artifact rather than importing repository source.~~  
  Evidence: `npm run smoke:packed-real-ai-directus` built `brisk-aitesting-0.2.0.tgz`, installed it into a newly emptied npm project, and the child proof explicitly reported `productLoad: clean-installed-package`. The configured real MiniMax response produced six connected actions; 7/7 operations including cleanup passed, the logical journey passed 1/1 with 0 failures/skips/errors, and final article/role/policy residue was 0. TCV-0035 and CLM-0022 preserve exact scope and exclusions.
- [ ] Run every Medusa real-system scenario from a freshly packed and clean-installed `brisk-aitesting` artifact rather than importing repository source.
- [ ] Run every n8n real-system scenario from a freshly packed and clean-installed `brisk-aitesting` artifact rather than importing repository source.
- [ ] Store redacted machine-readable evidence and a plain-language summary for every run, including pass/fail/skip/error counts and the reason for every skip.

### D. Directus: database-generated REST/GraphQL and permissions

- [x] ~~Start a pinned Directus instance with isolated local data and prove readiness from its real runtime response.~~  
  Evidence: the isolated Directus 12.2.0 container returned expected anonymous HTTP 403, isolated-admin login HTTP 200, authenticated health HTTP 200 with release 12.2.0 and status `ok`; stop/start returned it to ready state, and TCV-0032 preserves seven Directus readiness checks without printing the token.
- [ ] Create a dedicated test collection with typed fields and documented full, partial, missing, and invalid records.
- [x] ~~Create least-privilege test identities/policies that expose different records and actions without using an administrator token for normal scenarios; record the edition-gated field-rule limit rather than bypassing it.~~  
  Evidence: TCV-0034 dynamically created a disposable Directus role, non-admin policy, role-policy access link, create/read/update permissions, and active user; all six normal/refusal operations used that user's bearer token. Delete was deliberately absent and returned 403. Directus 12.2.0 default entitlement rejected selective-field rules with `RESOURCE_RESTRICTED`, so hidden-field proof remains open rather than being misreported as supported.
- [ ] Acquire Directus schema, REST, GraphQL, role/policy, permission, and runtime evidence through shared evidence paths.
- [ ] Prove equivalent permitted create/read/update/delete behavior through REST and GraphQL without embedding Directus operations in the universal compiler.
- [ ] Prove expected refusals for hidden fields, forbidden actions, wrong roles, invalid values, and missing authentication; execute these attempts and report the actual response rather than silently excluding them.
- [ ] Prove test-created Directus records are isolated, receipts are journaled, cleanup runs in safe order, and residual data is reported after forced cleanup failure.
- [ ] Prove schema or permission drift causes fresh evidence and safe recompilation rather than a guessed operation.
- [ ] Document exact Directus scenario coverage, identities, authoritative inputs, counts, exclusions, discovered defects, and what remains unproven.

### E. Medusa: connected commerce state and recovery

- [x] ~~Start a pinned Medusa backend, database, and required local services; add the admin or storefront only when its scenario needs that surface.~~  
  Evidence: the exact Medusa 2.18.0 workspace passed a frozen offline install check, `medusa db:migrate` completed, PostgreSQL contains 143 public tables, and the backend started on isolated port 19000 and returned HTTP 200 with body `OK` from `/health`. TCV-0032 then passed 66/66 checks with Directus, Medusa, and n8n all ready. The storefront was intentionally omitted because no current readiness/API scenario requires it; Redis remains the documented later distributed-mode task.
- [ ] Seed an isolated sales channel, region, product, inventory, customer, and test identity set using supported Medusa paths.
- [ ] Acquire real Medusa API/schema, authentication, module, workflow, event, job, and observed runtime evidence through shared paths.
- [ ] Prove permitted product/customer/cart/order flows with typed values passed between connected steps.
- [ ] Prove invalid product, inventory, pricing, authentication, authorization, and state-transition attempts are executed and correctly explained.
- [ ] Force a middle-step failure and prove completed earlier actions, compensation behavior, remaining state, and final application verdict are reported separately.
- [ ] Prove delayed event/job outcomes with bounded waiting, stable correlation, timeout, and cancellation behavior.
- [ ] Prove test-created Medusa state is isolated and cleanup/compensation does not delete pre-existing business data.
- [ ] Prove contract or workflow drift refreshes authoritative evidence and recompiles only the affected work.
- [ ] Document exact Medusa scenario coverage, setup state, authoritative inputs, counts, exclusions, discovered defects, and what remains unproven.

### F. n8n: webhooks, workflows, delayed runs, and workers

- [x] ~~Start a pinned n8n instance with isolated local storage and prove readiness from its real runtime response.~~  
  Evidence: the isolated n8n 2.32.7 container returned HTTP 200 and status `ok` from `/healthz/readiness`; stop/start returned it to ready state, and TCV-0032 preserves three n8n readiness checks.
- [ ] Create isolated test credentials and workflows containing webhook, data transformation, HTTP call, branching, wait, and deliberate-failure steps without storing usable secrets in source.
- [ ] Acquire real n8n workflow, webhook, credential-reference, execution, node, and runtime evidence through shared paths.
- [ ] Prove successful manual and webhook-triggered workflows and explain every executed step and observed result.
- [ ] Prove invalid webhook input, missing credentials, denied access, node failure, and unreachable dependency attempts are executed and correctly explained.
- [ ] Prove retry, timeout, waiting, cancellation, and resumed/terminal execution behavior without confusing a delayed result with a pass.
- [ ] Prove reports and artifacts redact credential values while retaining useful credential-reference and failure information.
- [ ] Prove test-created workflows, executions, webhooks, and credentials are isolated and removed or reported as residual state.
- [ ] Start n8n queue mode with PostgreSQL, Redis, and at least one worker; repeat the correlation, cancellation, retry, and cleanup proof across process boundaries.
- [ ] Prove workflow or node drift refreshes authoritative evidence and safely recompiles affected work.
- [ ] Document exact n8n scenario coverage, trigger types, authoritative inputs, counts, exclusions, discovered defects, and what remains unproven.

### G. Cross-architecture completion gate

- [x] ~~Maintain a dated, durable real-system achievement record that states why each application was chosen, exact versions, what and how every proof tested, actual results and denominators, defects and root causes, corrections, authoritative inputs, and remaining limits.~~  
  Evidence: `docs/engineering/REAL_SYSTEM_PROOF_LOG.md` preserves the 2026-08-03 Directus/Medusa/n8n readiness achievement, 66-check breakdown, 11 important discoveries, commands/procedures, 0 failures/skips, setup data counts, packaging result, proof boundary, and links to TCV-0032 plus REG-0019/0020.
- [x] ~~Define "upgrade" and make Directus, Medusa, and n8n the default minimum real-architecture gate for every product-behavior change, while distinguishing documentation-only changes and refusing to turn an unavailable application into a pass.~~  
  Evidence: `docs/engineering/REAL_SYSTEM_CHANGE_GATE.md` defines affected changes, seven ordered gates, required reporting questions, blocked/not-executed semantics, current built/partial/missing depth, and the rule that readiness alone cannot approve compiler, adapter, execution, cleanup, security, or result-behavior upgrades.
- [x] ~~Ship the cross-architecture explanation, dated proof log, and default upgrade gate in the actual npm package and verify that developers can install and follow their internal links.~~  
  Evidence: the latest `npm run pack:check` passed with 129 files, 1,072,947 unpacked bytes, all 26 explicitly required paths plus the linked host-integration guide, 40 valid relative documentation links, clean tarball install, and 0 errors. The installed main API plus both public real-validation validators imported successfully; TCV-0010 and CLM-0013 retain the exact exclusions.
- [ ] Build one executable behavior-upgrade command that clean-installs the packed product and runs the applicable positive, refusal, invalid, missing-information, timeout/cancellation, mutation, cleanup, and residual-state suites on Directus, Medusa, and n8n; it must fail on every unexecuted required application.  
  Gap: common readiness is executable, but the three packed-product business-scenario suites are still open below; until they exist, affected behavior upgrades remain explicitly not fully cross-application-tested.
- [ ] Run a documented minimum scenario set on Directus, Medusa, and n8n with no vendor-specific universal compiler branches.
- [ ] Compare discovery, compilation, execution, cleanup, latency, memory, artifacts, and diagnostic quality using the same definitions and denominators.
- [ ] Run interruption and restart proof while each application has an unfinished mutation or cleanup, and verify no unknown mutation is repeated.
- [ ] Run malicious input, secret-redaction, unauthorized-network, path-safety, and resource-bound checks against all three applications.
- [ ] Repeat the proof from clean application state and a clean-installed packed product to establish reproducibility.
- [ ] Record every defect, root cause, systemic correction, related-pattern search, regression test, and adversarial counterexample.
- [ ] Update public guides so a developer can reproduce each setup and understand exactly what full, partial, missing, invalid, refused, failed, cleaned, and residual mean.
- [ ] Recalculate all proof counts and the overall checklist progress; do not call the programme cross-architecture-proven while any required application or common gate remains open.

### H. Real AI and true target-depth proof

For this gate, repository size is background context only. The primary measures
are reachable pages, interactive elements, supported user journeys, API
operations, request/response rules, identity and permission boundaries,
workflows/events/jobs, and the fraction actually planned and executed through
`brisk-aitesting`.

- [x] ~~Audit the connected AI path and state exactly what AI chooses, what deterministic product code controls, and whether the normal and real-system gates actually invoke a real model.~~  
  Evidence: `docs/engineering/REAL_SYSTEM_AI_PIPELINE.md` maps the connected path. AI proposes protocol-neutral business intent; evidence-backed code selects executable operations and cleanup. The normal CI and 66-check real-system readiness gate do not call a real model.
- [x] ~~Run the existing real-provider smoke without treating an earlier or fixture result as current proof, and record its exact planned/executed result.~~  
  Evidence: the 2026-08-03 run reached the configured provider but timed out during planning after 30 seconds: 0 scenarios planned, 0 executed, final status `skipped`, and the top-level diagnosis array was empty. The journal retained `STAGE_TIMEOUT`; REG-0022 records the defect and its limits.
- [x] ~~Replace total repository files as the headline depth measure with live pages, interactive elements, API operations, contracts, permissions, workflows, and executed-scenario coverage; retain source size only as secondary context.~~  
  Evidence: `docs/engineering/REAL_SYSTEM_TARGET_DEPTH.md` defines the primary denominators and explicitly records Directus 0, Medusa 0, and n8n 0 executed business UI scenarios today.
- [x] ~~Correct the real-AI smoke so a planning timeout is clearly visible in the final status, summary, diagnosis, and command output; prove the correction with a forced-timeout case before changing the time allowance.~~  
  Evidence: TCV-0018 passes 20/20 including a forced planning timeout with final status `error`, failed verdict, 0 executed tests, 1 run-level error, retained `STAGE_TIMEOUT`, and a visible plain-language diagnosis. The next real-provider run exposed the timeout the same way instead of reporting a blank skipped result.
- [ ] Define one versioned AI contribution record that captures provider/model parameters without secrets, request/evidence digests, response accepted/rejected state, intent, compiler decisions, execution results, cleanup results, latency, token counts when available, and artifacts.
- [ ] Audit every current planning, coverage, healing, explanation, and "AI-driven" claim; downgrade wording to deterministic/rule-based wherever no real model response is consumed.
- [ ] Prove AI-assisted UI healing on a real deliberately changed page through the packed product, including the model response, trusted live-page evidence, accepted/rejected repair, retry result, and no unsafe selector execution.
- [ ] Create least-privilege disposable identities and isolated test data for all three applications before authenticated live-surface discovery.
- [ ] Inventory Directus live reachable pages, rendered interactive elements, OpenAPI operations, GraphQL fields/mutations, roles, permissions, and important data rules from its running instance.
- [ ] Inventory Medusa live reachable admin/store pages, rendered interactive elements, supported API operations, request/response rules, identities, commerce state transitions, workflows, events, and jobs.
- [ ] Inventory n8n live reachable pages, rendered interactive elements, supported API/webhook operations, request/response rules, roles, workflow/node types, executions, events, and worker behavior.
- [ ] Store machine-readable per-application denominators and explain exclusions such as optional, edition-gated, unreachable, generated, duplicate, or role-hidden surfaces.
- [ ] Feed the live, redacted, authoritative target evidence into the existing AI-intent path without exposing credentials or allowing source text to become executable instructions.
- [x] ~~Ask the configured real model to propose a complex business-focused API scenario for Directus, then retain its accepted/rejected intent and reasons.~~  
  Evidence: TCV-0034 and TCV-0035 used the configured real MiniMax model, accepted one connected intent containing six ordered business actions, compiled them only against runtime/host evidence, executed seven operations including cleanup from a clean-installed package, and retained the plan, results, diagnostics, artifacts, and earlier rejection reasons. Directus UI AI planning remains separately open in the live-surface/UI tasks.
- [ ] Ask the configured real model to propose business-focused UI and API scenarios for Medusa, then retain its accepted/rejected intent and reasons.
- [ ] Ask the configured real model to propose business-focused UI, webhook, and workflow scenarios for n8n, then retain its accepted/rejected intent and reasons.
- [ ] Prove deterministic code—not AI text—selects every route, selector, request, assertion, value binding, permission expectation, and cleanup action before execution.
- [ ] Execute the accepted AI-planned positive, invalid, missing-information, unauthenticated, unauthorized, recovery, and cleanup scenarios on all three real applications.
- [ ] Prove at least one complex connected AI-planned journey per application that crosses its important surfaces, passes values between steps, changes meaningful state, encounters a controlled middle failure or refusal, recovers safely, cleans up, and verifies the final state; a one-page or one-endpoint demo cannot satisfy this task.
- [ ] Report discovered, AI-proposed, accepted, rejected, compiled, executed, passed, failed, skipped, and cleaned counts separately for every application and surface type.
- [ ] Add adversarial real-target cases where AI invents a route, field, permission, selector, state change, credential, or cleanup action and prove they cannot execute.
- [ ] Repeat the complete AI-and-depth gate from a clean-installed packed product and update capability, requirements, claims, coverage, regression, proof-log, and progress records.

### H2. Brisk (fourth real-application diagnostic)

The product owner approved a fourth real application — the sibling `brisk`
pub-sub platform at `C:\Users\u306076\Documents\azure-pubsub\brisk` — on
2026-08-05 for early real-AI feedback, explicitly choosing this ahead of the
still-open Phase 4.3 foundation work (mutation receipts, journaled cleanup,
crash-safe recovery) that the dependency-safe critical path would otherwise
require first. Everything in this subsection is diagnostic only: one identity,
one path, no permission-boundary, UI, healing, drift, or load proof. It must
never be read as application-support, cross-architecture, or release proof.

- [x] ~~Start a local, isolated Brisk instance (Postgres/Kafka/RabbitMQ/Redis via Docker, schema pushed, seed data loaded, server running) without modifying any vendor-committed port or dependency version.~~
  Evidence: Postgres was remapped to host port 25432 through a new untracked `docker/docker-compose.override.local.yml` (Compose `!override` merge) because the default 5432 was already bound by an unrelated container; `.env` `BRISK_DATABASE_URL` was updated to match and the original file was preserved as `.env.pre-brisk-aitesting.bak`. `prisma db push` and the seed script ran cleanly against the isolated database. `packages/server`'s own dependency on `brisk-aitesting@0.2.0` cannot resolve from the public registry (highest published version is 0.1.9); this was worked around for local install only with an `overrides:` entry in `pnpm-workspace.yaml` pointing at a locally packed `brisk-aitesting-0.2.0.tgz`, not by changing the declared dependency version. Both are local-lab-only files, not proposed product or vendor-source changes.
Current packaging note (2026-08-06): the local packed-file workaround described
in the historical startup evidence is no longer the active installation path.
The product owner deprecated the public npm package. Brisk's declared dependency
and lockfile now resolve the exact GitHub commit
`dd672dcf96739e54511cbd1c1fad439c40a53f34`; no public npm package is used.

- [x] ~~Record real defects discovered in Brisk's own setup path while getting it running, rather than silently working around them.~~
  Evidence: (1) `pnpm-workspace.yaml`/`package.json` mismatch — Brisk's own `pnpm.overrides` (e.g. the `pino` pin) silently stop applying under pnpm 11, which now warns that `package.json`'s `pnpm` field is no longer read; (2) `db:seed` unconditionally runs `prisma migrate deploy` first, but the repository ships no `prisma/migrations` directory at all (it is a `db push`-only schema), so `pnpm db:seed` cannot succeed as written on a clean checkout — seeding only worked here by calling the seed script directly. Neither defect was fixed in Brisk's own source; both are reported here for the product owner to route to that codebase's own backlog.
- [x] ~~Design and freeze one complex connected Brisk business journey using only real, curl-verified operations (not guessed from source): create channel, create topic, publish message, read message back, attempt an invalid topic create, then clean up.~~
  Evidence: every operation was hand-verified against the running instance with `curl` first (channel create 201, topic create 201, publish 201, read 200, invalid topic create 400, topic delete 204, channel delete 204) before being encoded as an evidence-graph contract, so the AI is only ever offered operations proven to exist.
- [x] ~~Ask the configured real AI provider to plan this journey against Brisk end to end, execute it, and report the exact result — including a first attempt that the deterministic compiler correctly refused.~~
  Evidence: `smoke/run-real-ai-brisk.mjs` (`npm run smoke:real-ai-brisk`) is a new diagnostic script, modeled on the existing `run-real-ai-directus.mjs` pattern. The first run never called the AI model at all: `MISSING_CLEANUP_OPERATION` correctly stopped planning because the publish-message operation created durable state with no declared cleanup, and Brisk exposes no per-message delete endpoint. This was corrected honestly, not bypassed — the message's `cleanupOperationId` now points at the real topic-delete operation, because deleting a Brisk topic is the message's true and only lifecycle boundary in the live product. After that correction, three consecutive runs against the real MiniMax-configured provider all planned the same 5 evidenced operations, executed 1/1 logical journey with 0 failures/skips/errors, and passed cleanup; a direct follow-up `GET /api/channels` after every run confirmed 0 residual test-created channels.
- [x] ~~Replace Brisk's temporary package-specific configuration assembly with the installed public `defineConfigFromHost` host-mapping entry point, while preserving Brisk-owned URLs, authentication, evidence, engines, security limits, and runtime-selected AI connection.~~
  Evidence: on 2026-08-06 `packages/server/src/domains/testing-aitesting.ts` imported and called the installed GitHub package's actual `defineConfigFromHost` export (there is no `defineHostConfig` export in commit `dd672dcf96739e54511cbd1c1fad439c40a53f34`). Brisk server and root TypeScript checks passed. No provider or model name is fixed inside the host mapping; the provider object is obtained at run time from Brisk's organization configuration.
- [x] ~~Restart Brisk and the Directus, Medusa, and n8n lab, then verify application responses rather than treating running processes or containers as readiness proof.~~
  Evidence: on 2026-08-06 Brisk backend `/api/health`, frontend, and docs returned HTTP 200. The shared lab readiness report returned `ok: true`: Directus deliberately refused its anonymous health request with 403, accepted login with 200, and returned authenticated health 200; Medusa database was healthy and its application health returned 200; n8n readiness returned 200. This proves startup/readiness only, not business scenarios, AI quality, cleanup, stress, or application support.
- [ ] Prove the Brisk host connection against every provider family Brisk offers, including native Anthropic, Gemini's compatible endpoint, Azure OpenAI deployment addressing, OpenAI, DeepSeek, and custom OpenAI-compatible servers; record request format, structured-output behavior, timeout, usage, refusal, and secret-redaction results without assuming that one compatible endpoint proves them all.
- [ ] Run this same diagnostic from a clean-installed packed `brisk-aitesting` artifact rather than the working-tree build, matching the rigor already applied to Directus.
- [ ] Design and execute negative/permission-boundary scenarios using a disposable least-privilege Brisk identity rather than the single seeded administrator this diagnostic reused for both setup and the AI-planned journey.
- [ ] Extend the journey to Brisk's UI, subscriptions, publishers, and webhook surfaces; today only channels/topics/messages are covered.
- [ ] Fold Brisk into the same shared readiness/manifest/proof-log machinery used for Directus, Medusa, and n8n if the product owner decides it should become a permanent fourth proof application rather than a one-off diagnostic.

## World-Class Real Validation and Stress Gate

This gate is governed by
`docs/engineering/WORLD_CLASS_REAL_VALIDATION_GATE.md`. A scenario counts only
when it satisfies that document's real-model, connected-workflow,
clean-installed-product, evidence, cleanup, and reporting rules.

### A. Truthful baseline and enforcement

- [x] ~~State explicitly that one successful Directus journey is narrow evidence, not application-support, cross-architecture, benchmark, stress, UI, database, contract, healing, or release proof.~~  
  Evidence: `WORLD_CLASS_REAL_VALIDATION_GATE.md` records the accepted baseline as Directus 0/100, Medusa 0/100, n8n 0/100, overall 0/300. The earlier Directus journey remains historical narrow execution evidence because it did not retain the newly required raw-response digest/token record; real UI/database-behaviour/contract-drift/load/stress/soak denominators are also 0.
- [x] ~~Define the minimum counted real-AI scenario and forbid fixtures, readiness checks, repository totals, isolated endpoint checks, and repeated copies from inflating the real-AI denominator.~~  
  Evidence: the gate's ten-part scenario definition requires a current real-model response, authoritative live evidence, at least three connected operations or an equivalent state/permission boundary, dependent state, meaningful verification/refusal/recovery, cleanup, packed clean install, complete counts, timings, and retained redacted evidence.
- [x] ~~Add the 300-scenario manifest and closed schema with unique scenario identity, application, primary bucket, business risk, identities, evidence sources, AI response reference, operations, mutations, cleanup, metrics, and proof status.~~  
  Evidence: `fixtures/real-validation/corpus-v1.json` fixes the three 100-scenario application requirements and 18 primary buckets while accepting 0 scenarios; the public closed `brisk-aitesting.real-validation-manifest.v1` contract and semantic validator require unique application/bucket/scenario identity, real-AI proof, response/package/evidence digests, clean-installed load, connected operations, balanced counts, cleanup, and zero residue. TCV-0036 passed 38 checks and rejected all 31 malformed/inflated cases.
- [ ] Make the engineering-record checker reject duplicate counted scenarios, missing bucket membership, fixture providers in real-AI rows, missing denominators, missing cleanup/residual results, and a claimed 300-scenario pass with any required skip/failure/error.
- [ ] Make every broad application-support, stress, benchmark, healing, cross-architecture, and release claim depend on the applicable complete denominator rather than one representative example.

### B. Directus 100-scenario real-AI corpus

- [ ] Design, review, and freeze 25 distinct connected REST/generated-collection scenario definitions.
- [ ] Execute all 25 Directus REST/generated-collection scenarios from a clean-installed packed product and record exact results.
- [ ] Design, review, and freeze 20 distinct connected GraphQL query/mutation/variable/error/permission scenario definitions.
- [ ] Execute all 20 Directus GraphQL scenarios from a clean-installed packed product and record exact results.
- [ ] Design, review, and freeze 20 distinct connected real-UI navigation/form/table/filter/validation/accessibility scenario definitions.
- [ ] Execute all 20 Directus UI scenarios from a clean-installed packed product with real browser evidence and record exact results.
- [ ] Design and execute 15 distinct role/policy/record-visibility/authentication/authorization scenarios using disposable least-privilege identities.
- [ ] Design and execute 10 distinct contract/schema/database-constraint/data-integrity scenarios.
- [ ] Design and execute 10 distinct drift/healing/interruption/recovery/cleanup/residual scenarios.
- [ ] Prove Directus totals exactly 100 distinct counted real-AI scenarios with every required failure/safety dimension represented and no unexplained skip.

### C. Medusa 100-scenario real-AI corpus

- [ ] Design, review, and freeze 20 distinct connected admin API/product/inventory/pricing/customer/permission scenarios.
- [ ] Execute all 20 Medusa admin API scenarios from a clean-installed packed product and record exact results.
- [ ] Design, review, and freeze 25 distinct connected store/cart/line-item/shipping/payment/order/return scenarios.
- [ ] Execute all 25 Medusa store and commerce-state scenarios from a clean-installed packed product and record exact results.
- [ ] Design, review, and freeze 20 distinct real admin/storefront UI validation/accessibility/role scenarios.
- [ ] Execute all 20 Medusa UI scenarios from a clean-installed packed product with real browser evidence and record exact results.
- [ ] Design and execute 15 distinct workflow/event/subscriber/job/retry/compensation scenarios.
- [ ] Design and execute 10 distinct contract/database-constraint/transaction/data-integrity scenarios.
- [ ] Design and execute 10 distinct drift/security-refusal/interruption/recovery/cleanup/residual scenarios.
- [ ] Prove Medusa totals exactly 100 distinct counted real-AI scenarios with every required failure/safety dimension represented and no unexplained skip.

### D. n8n 100-scenario real-AI corpus

- [ ] Design, review, and freeze 15 distinct REST identity/credential/project/permission scenarios.
- [ ] Execute all 15 n8n REST scenarios from a clean-installed packed product and record exact results.
- [ ] Design, review, and freeze 15 distinct test/production webhook payload/response/authentication scenarios.
- [ ] Execute all 15 n8n webhook scenarios from a clean-installed packed product and record exact results.
- [ ] Design, review, and freeze 20 distinct real-UI workflow editing/execution/history/validation/accessibility scenarios.
- [ ] Execute all 20 n8n UI scenarios from a clean-installed packed product with real browser evidence and record exact results.
- [ ] Design and execute 25 distinct node/branch/merge/wait/retry/error/sub-workflow/data-flow scenarios.
- [ ] Design and execute 15 distinct execution-mode/worker/queue/database/event/concurrency scenarios.
- [ ] Design and execute 10 distinct drift/security-refusal/interruption/recovery/cleanup/residual scenarios.
- [ ] Prove n8n totals exactly 100 distinct counted real-AI scenarios with every required failure/safety dimension represented and no unexplained skip.

### E. Live depth and actual-inspection accounting

- [ ] Record Directus reachable pages/states, interactive elements, REST/GraphQL operations, contracts, roles/policies, database constraints, workflows, and exact inspected/accepted/rejected/excluded files and bytes.
- [ ] Record Medusa reachable pages/states, interactive elements, APIs/contracts, roles, commerce transitions, workflows/events/jobs, database constraints, and exact inspected/accepted/rejected/excluded files and bytes.
- [ ] Record n8n reachable pages/states, interactive elements, APIs/webhooks/contracts, roles/projects, nodes/workflows/executions/workers, database constraints, and exact inspected/accepted/rejected/excluded files and bytes.
- [ ] Report Evidence Graph nodes, edges, conflicts, unresolved facts, source authority, and discovery precision/recall against reviewed ground truth for every application.
- [ ] Prove dependency folders, generated output, caches, unopened files, static source totals, and unreachable surfaces cannot be counted as inspected or tested.

### F. Performance, load, stress, and resource proof

- [x] ~~Build a versioned raw benchmark-sample contract containing machine/runtime/app/product/provider/configuration identity, exact denominators, stage timings, CPU/RAM/handles/files/sockets/processes, actual inspection counts, AI usage, execution/cleanup/residue, artifacts, exclusions, and evidence digests.~~  
  Evidence: public `brisk-aitesting.real-validation-sample.v1` and its validator enforce the stated closed fields plus percentile/count ordering, AI metric availability reasons, balanced execution totals, and refusal of a passed outcome with failures, skips, errors, or database residue; TCV-0036 passed all focused valid and adversarial checks.
- [ ] Build the versioned aggregate benchmark-result contract with raw-sample references, percentile/confidence calculations, regression comparison, threshold verdicts, exact denominators, and exclusions.
- [ ] Instrument wall time, per-stage time, AI network time, process CPU, normalized CPU, baseline/median/p95/peak resident memory, event-loop delay, active handles, files/sockets, child processes, throughput, tokens/retries/cost when known, bytes read/written, artifact volume, mutations, cleanup, and residue.
- [ ] Prove measurement overhead and sampling accuracy against an independent local observer; report the observer and known error bounds.
- [ ] Run at least 10 cold and 30 warm full-path repetitions per application and report minimum, median, p95, p99, maximum, variance, failures, skips, and errors.
- [ ] Run small, medium, large, and very-large repository inspection corpora and report actual inspected files/bytes, exclusions, discovered surfaces, graph size, time, memory, and artifact volume.
- [ ] Compile and validate plans containing at least 10, 100, 500, and 1,000 operations; retain uncompiled/rejected/error counts rather than treating them as passes.
- [ ] Run inspection/compilation at 1, 5, 10, 25, and 50 concurrent runs and report throughput, latency percentiles, CPU, RAM, handles, failures, and recovery.
- [ ] Run isolated real execution at 1, 5, 10, and 25 concurrent runs per safe local-application limit with unique identities/data and exact cleanup/residual proof.
- [ ] Run real-provider planning at 1, 3, and 5 concurrent calls within configured provider policy and retain rate-limit, retry, timeout, cancellation, token, latency, and cost outcomes.
- [ ] Run a minimum 30-minute sustained packed-product test with periodic mutations, controlled failures, cleanup, residual checks, and memory/handle growth measurements.
- [ ] Interrupt planning, execution, artifact writing, result storage, and cleanup at controlled points and prove safe resume or explicit non-replay of unknown mutations.
- [ ] Set reviewed absolute and regression thresholds from the versioned baseline before accepting the benchmark; forbid weakening a threshold after a candidate failure without a recorded product decision.
- [ ] Enforce zero fabricated pass, invented executable operation, unauthoritative/cross-boundary mutation, leaked secret, unsafe AI instruction, lost known result, unknown mutation replay, unexplained skip, missing cleanup outcome, false-clean residue, or unsafe healing across the accepted corpus.

### G. Final evidence and release linkage

- [ ] Produce per-application and combined reports with proposed/accepted/rejected/compiled/executed/passed/failed/skipped/errored/cleaned/residual counts for every surface and scenario bucket.
- [ ] Preserve redacted raw AI, discovery, compiler, execution, browser, database, cleanup, stress, and benchmark evidence with stable digests and reproduction commands.
- [ ] Compare benchmark results against the previous accepted product/corpus version and explain every statistically or operationally meaningful regression.
- [ ] Update test coverage, requirements, capabilities, claims, decisions, defects, proof log, public documentation, and progress from the accepted evidence.
- [ ] Run the complete 300-scenario, depth, stress, security, recovery, packed-product, and documentation gate twice from clean application state to prove reproducibility.
- [ ] Mark the world-class real-validation gate complete only when all required denominators pass and nothing required by this accepted scope remains open.

## Completion-Integrity Audit Gate

This gate was added at the product owner's request before any further feature
work. A crossed task remains crossed only when its complete wording—not merely
the presence of code or a passing governance checker—is supported by direct,
reproducible evidence.

- [x] ~~Freeze forward feature execution and inventory every crossed task, its evidence sentence, implementation path, proof command, proof class, and stated exclusion.~~  
  Evidence: `COMPLETION_INTEGRITY_AUDIT.md` accounts for all 136 pre-audit crossed tasks in fifteen groups; every retained crossed line now has immediate evidence and forward feature work remained paused during the audit.
- [x] ~~Verify every approval- or inspection-only completion against durable conversation, repository, or command evidence.~~  
  Evidence: the nine evidence-less alignment tasks were reviewed; eight received direct durable evidence, ongoing instruction compliance was split open, and decision records remain explicitly decision-only rather than implementation proof.
- [x] ~~Verify every implementation completion against the exact reused runtime path and reject types, schemas, or helpers that are not actually connected where the task promises connection.~~  
  Evidence: task/evidence/source review plus the full connected CI; definition-only stage tasks remain worded as definitions, runtime-connected acquisition uses `SemanticPlanner`, and unproven security halves were split open.
- [x] ~~Verify every test completion against current file digests, exact checks and denominators, failures, skips, authoritative inputs, adversarial cases, and exclusions.~~  
  Evidence: all 31 test executables have digest-checked coverage rows; full `smoke:ci` exited 0 in 377.9 seconds with reported skips 0; stale denominators were corrected; the changed governance and pack suites were rerun separately.
- [x] ~~Verify every documentation completion explains what, how, decision, safety reason, full/partial/missing states, proof depth, and remaining limits in ordinary language.~~  
  Evidence: completed behavior guides and engineering records were reviewed; stale provider/pipeline statements were corrected, MCP publication uncertainty is explicit, and audit limits are recorded in `COMPLETION_INTEGRITY_AUDIT.md`.
- [x] ~~Verify every public/package completion against exports, packed files, clean consumption, links, compatibility, and the exact package evidence claimed.~~  
  Evidence: strengthened `pack:check` passes with 120 files, 929,822 bytes, 20 required paths, 22 relative Markdown links, clean npm install, installed public import, and 0 errors; REG-0016 preserves the omitted-guide defect.
- [x] ~~Split or reopen every crossed compound task whose complete wording is only partially proven; never preserve progress by narrowing its meaning after the fact.~~  
  Evidence: ongoing instruction compliance, symlink/junction/direct-file isolation, and actual OS CPU/total-memory quotas are explicit open tasks; the proven portions retain narrower exact wording and direct evidence.
- [x] ~~Publish the audit findings, corrected checklist state, reproducible proof, discovered defects, remaining uncertainty, and the next safe execution point.~~  
  Evidence: `docs/engineering/COMPLETION_INTEGRITY_AUDIT.md`, REG-0015/0016, corrected ledgers/guides/ADR/checklist, and the final governance/package reruns.

Optional adapter work may proceed independently after the shared adapter,
storage, cancellation, policy, telemetry, and conformance contracts are stable.

## Phase 0 — Alignment and Baseline

- [x] ~~Read the complete attached product-engineering mandate.~~  
  Evidence: the complete attachment at `C:\Users\u306076\.codex\attachments\ee50b860-4667-41dd-ad27-ed272782ed70\pasted-text.txt` was read before checklist construction and reread during the completion-integrity audit.
- [x] ~~Read the repository instructions before meaningful build work.~~  
  Evidence: the active repository `AGENTS.md` instructions were supplied in the Codex task and the alignment/checklist workflow records their required pre-build questions and gates.
- [ ] Continue applying every repository instruction throughout the unfinished programme; this ongoing obligation cannot honestly be completed before the programme ends.
- [x] ~~Locate the actual repository and confirm the configured path was stale.~~  
  Evidence: repository commands and builds resolve at `C:\Users\u306076\Documents\azure-pubsub\brisk-aitesting`; the initially supplied `me2u\packages\brisk-aitesting` path did not contain this repository.
- [x] ~~Inspect the dirty working tree and identify existing user-owned changes.~~  
  Evidence: non-mutating `git status --short` inspection identified the pre-existing modified/untracked tree; execution preserves it and no destructive reset/checkout has been used.
- [x] ~~Inventory the SDK, CLI, compiler, evidence, engines, adapters, recovery, documentation, reference applications, and smoke suites.~~  
  Evidence: `PIPELINE_CONTRACT_INVENTORY.md`, `CAPABILITY_MATRIX.md`, `TEST_COVERAGE.md`, package scripts, adapter manifest, and repository file inventory cover the named surfaces and retain explicit gaps.
- [x] ~~Identify current built, partial, missing, decision-blocked, and externally blocked capabilities.~~  
  Evidence: the capability matrix and requirements traceability ledger use explicit status/proof/gap columns; the audit corrects stale statements rather than treating the initial snapshot as permanently current.
- [x] ~~Define ambiguous product terms in the context of brisk-aitesting.~~  
  Evidence: status/proof classifications and the evidence-provider, authority, incremental-recompilation, typed-value, operation-lifecycle, compatibility, and cleanup guides define the terms used by completed work with examples and limits.
- [x] ~~Map MCP requirements against the current official 2025-11-25 generation and the 2026-07-28 release-candidate/draft generation without calling an unpublished or externally inconsistent revision current.~~  
  Evidence: corrected ADR-0001 records the official current-version page, official 2025-11-25 specification, official 2026 release-candidate announcement/draft, their lifecycle/transport difference, and the external publication-status discrepancy checked on 2026-08-03.
- [x] ~~Run the non-writing TypeScript baseline check.~~  
  Evidence: `npm run typecheck`, 1 command passed, 0 failed, 0 skipped, 0 TypeScript diagnostics.
- [x] ~~Obtain product-owner approval for the four material architectural decisions.~~  
  Evidence: explicit product-owner approval in the Codex task on 2026-08-02, preserved durably by accepted ADR-0001 through ADR-0004; this is decision evidence, not implementation proof.
- [x] ~~Record the approved decisions as repository ADRs.~~  
  Evidence: `docs/decisions/ADR-0001` through `ADR-0004` and verified ADR index.

## Phase 1 — Engineering Truth and Acceptance System

### 1.1 Records and taxonomies

- [x] ~~Assign stable requirement IDs to every mandate section and acceptance obligation.~~  
  Evidence: the current checker reports 93 unique IDs covering all 24 mandate groups; duplicate and group-coverage checks pass.
- [x] ~~Create the capability matrix with implemented, production-proven, partially proven, missing, product-decision-blocked, and external-dependency-blocked states.~~  
  Evidence: `docs/engineering/CAPABILITY_MATRIX.md`.
- [x] ~~Create the requirements traceability ledger linking requirements to implementation, tests, artifacts, and status.~~  
  Evidence: `docs/engineering/REQUIREMENTS_TRACEABILITY.md`.
- [x] ~~Create the release claim ledger with command, environment, result, exclusions, and evidence fields.~~  
  Evidence: `docs/engineering/CLAIM_LEDGER.md`, including explicit unverified entries.
- [x] ~~Create the architecture decision record index and approved-decision ADRs.~~  
  Evidence: `docs/decisions/README.md` and ADR-0001 through ADR-0004.
- [x] ~~Create the regression catalogue and escaped-defect template.~~  
  Evidence: `docs/engineering/REGRESSION_CATALOGUE.md`.
- [x] ~~Define synthetic, reference-app, host-integration, cross-architecture, and production proof classes.~~  
  Evidence: `docs/engineering/PROOF_CLASSIFICATION.md`.
- [x] ~~Define the exact `specified`, `implemented`, `integration-proven`, `cross-architecture-proven`, `release-ready`, and `complete` transitions.~~  
  Evidence: `docs/engineering/STATUS_MODEL.md`.

### 1.2 Automated honesty gates

- [x] ~~Define machine-readable record schemas.~~  
  Evidence: closed JSON Schema `brisk-aitesting.engineering-records.v1`.
- [x] ~~Validate required fields, identifiers, statuses, and evidence references.~~  
  Evidence: AJV 2020 validation plus cross-record invariants.
- [x] ~~Detect duplicate and orphaned requirement IDs.~~  
  Evidence: duplicate IDs and unknown capability-to-requirement references are rejected.
- [x] ~~Detect claims without proof commands or evidence locations.~~  
  Evidence: verified claims with pending/non-evidence fields are rejected.
- [x] ~~Detect production-support claims backed only by fixture or type proof.~~  
  Evidence: production-proven capabilities require an explicitly linked verified production claim.
- [x] ~~Detect completed capabilities with open required requirements.~~  
  Evidence: production-proven capabilities with any linked non-complete requirement are rejected.
- [x] ~~Add the engineering-record check to package scripts.~~  
  Evidence: `npm run smoke:engineering-records`.
- [x] ~~Add the check to CI without weakening existing gates.~~  
  Evidence: the check is prepended to `smoke:ci`, which the existing 9-job OS/Node CI matrix executes.
- [x] ~~Add positive, negative, and adversarial fixtures for the record checker.~~  
  Evidence: the current checker passes 1 positive invariant and blocks all 13 of 13 malformed/inconsistent fixtures with 0 failures and 0 skips.
- [x] ~~Document how contributors update records.~~  
  Evidence: `docs/engineering/ENGINEERING_RECORDS.md`.

### 1.3 Test coverage documentation gate

- [x] ~~Define the test coverage and subtle-defect documentation taxonomy.~~  
  Evidence: proof classes, thirteen coverage dimensions, risk/subtlety, authority, evidence/denominator, and exclusion fields in `TEST_COVERAGE.md` and its closed schema.
- [x] ~~Assign stable coverage IDs to every test executable.~~  
  Evidence: TCV-0001 through TCV-0031 cover all 31 current `smoke/run-*.mjs` files; the content-digest gate rejects an unlisted executable.
- [x] ~~Record requirement links, proof class, dimensions, authoritative inputs, expected evidence, denominators, subtle behavior, and exclusions.~~  
  Evidence: every coverage row contains all required fields; incomplete depth is explicitly classified as legacy debt.
- [x] ~~Fully document the engineering-record and pipeline-contract tests added under this programme.~~  
  Evidence: TCV-0007 and TCV-0012, including REG-0001 and tested limitations.
- [x] ~~Inventory pre-existing tests and mark incomplete descriptions as explicit legacy backfill debt.~~  
  Evidence: the original 23 tests were inventoried; the current 31-test catalogue reports the same 19 legacy rows as `legacy-backfill-pending` and 12 fully documented rows.
- [x] ~~Add test-file content digests so changed tests require coverage review.~~  
  Evidence: SHA-256 comparison against current bytes.
- [x] ~~Reject new test executables without complete coverage documentation.~~  
  Evidence: filesystem inventory plus non-legacy completeness invariant and negative fixture.
- [x] ~~Reject stale digests, duplicate paths, orphan requirement IDs, and path traversal.~~  
  Evidence: dedicated invariants and rejected counterexamples.
- [x] ~~Add positive, negative, and adversarial checks for the coverage gate.~~  
  Evidence: coverage counterexamples are included in the 13 malformed/inconsistent engineering-record fixtures, all of which are currently blocked.
- [x] ~~Wire the coverage gate into CI before tests execute.~~  
  Evidence: `smoke:engineering-records` remains first in `smoke:ci`.
- [x] ~~Document how users and contributors read and maintain coverage records.~~  
  Evidence: `TEST_COVERAGE.md` maintenance rule and `ENGINEERING_RECORDS.md` contributor guidance.
- [ ] Backfill every legacy test to complete coverage documentation.

### 1.4 Overall progress reporting gate

- [x] ~~Add an overall completed/total task-count progress bar to the source-of-truth checkpoint.~~  
  Evidence: `Overall Progress` section at the top of this file.
- [x] ~~State explicitly that task-count progress is not effort, time, or release-readiness progress.~~  
  Evidence: progress qualification immediately below the bar.
- [x] ~~Validate the stored completed, open, total, percentage, and bar values against the checklist.~~  
  Evidence: engineering-record gate parses this file and rejects stale progress metadata.

## Phase 2 — Versioned Universal Pipeline Contracts

### 2.1 Contract inventory and ownership

- [x] ~~Inventory every current pipeline boundary and legacy duplicate.~~  
  Evidence: `docs/engineering/PIPELINE_CONTRACT_INVENTORY.md` maps accepted request through handover and identifies direct AI, fallback planner, UI enrichment, and discovery/evidence duplicate paths.
- [x] ~~Assign ownership and authoritative data source to every boundary.~~  
  Evidence: boundary and authoritative-data-source tables in the pipeline inventory.
- [x] ~~Define a common versioned stage envelope.~~  
  Evidence: normative `brisk-aitesting.stage-envelope.v1` concept definition in the pipeline inventory.
- [x] ~~Define stable diagnostic classification and severity.~~  
  Evidence: normative diagnostic model with stable code, severity, category, stage, recoverability, retryability, affected references, and safe cause chain.
- [x] ~~Define provenance, correlation, timing, retry, recovery, and redaction metadata.~~  
  Evidence: required envelope field set and security/observability rules.
- [x] ~~Define schema compatibility and migration policy.~~  
  Evidence: eight-step additive compatibility and legacy-path migration policy.

### 2.2 Stage contracts

- [x] ~~Implement and export `brisk-aitesting.diagnostic.v1`.~~  
  Evidence: closed AJV schema, TypeScript contract, public exports, and 1 positive plus 2 diagnostic-negative checks.
- [x] ~~Implement and export `brisk-aitesting.stage-envelope.v1`.~~  
  Evidence: closed AJV schema, TypeScript input/output contracts, public exports, and 2 positive plus 5 envelope-negative/adversarial checks.
- [x] ~~Enforce real date-time validation for pipeline contracts with a maintained JSON Schema format library.~~  
  Evidence: `ajv-formats` 3.0.1; REG-0001 failed-first counterexample now rejected.
- [x] ~~Wire cross-cutting pipeline contract checks into the existing CI suite.~~  
  Evidence: `smoke:pipeline-contracts` is included in `smoke:ci` without removing existing gates.
- [x] ~~Version application-inspection input and output.~~  
  Evidence: exported `inspection-input.v1` and `inspection-output.v1` TypeScript contracts; deterministic runtime schema remains tracked in Phase 2.3.
- [x] ~~Version evidence-acquisition input and output.~~  
  Evidence: exported `evidence-acquisition-input.v1` and `evidence-acquisition-output.v1`, including requirements, provider attempts, cache disposition, satisfaction, and artifacts.
- [x] ~~Version evidence-conflict input and output.~~  
  Evidence: exported `evidence-conflict-input.v1` and `evidence-conflict-output.v1`, including candidates, selected authority, reason, resolution, and mutation blocking.
- [x] ~~Define versioned semantic-planning stage wrappers.~~  
  Evidence: exported `semantic-planning-input.v1` and `semantic-planning-output.v1`; semantic intent hardening remains open below.
- [x] ~~Define versioned compilation stage wrappers.~~  
  Evidence: exported `compilation-input.v1` and `compilation-output.v1`, including previous compilation, affected scope, evidence revision, and deterministic identity; compilation hardening remains open below.
- [ ] Harden semantic-intent input and output.
- [ ] Harden compilation input and output.
- [x] ~~Version missing-evidence acquisition requests.~~  
  Evidence: exported `missing-evidence-input.v1` and `missing-evidence-output.v1` with bounded attempt state, conflict resolution, affected scenarios, and recompile decision.
- [ ] Version preflight input and output.
- [ ] Harden adapter-lowering input and output.
- [ ] Version execution input and observation output.
- [ ] Version drift-detection input and output.
- [ ] Version healing proposal, equivalence, and result contracts.
- [ ] Version cleanup plan and cleanup outcome contracts.
- [ ] Version evidence aggregation and final handover contracts.

### 2.3 Contract proof

- [x] ~~Add closed deterministic wrapper schemas for the twelve upstream inspection, evidence, conflict, semantic-planning, compilation, and missing-evidence stage payloads.~~  
  Evidence: `pipelineStagePayloadJsonSchemas`, public validator/export, strict shared fragments, and successful schema registration.
- [x] ~~Add positive, negative, boundary, and adversarial proof for the upstream wrapper schemas.~~  
  Evidence: `smoke:pipeline-contracts` passes 10 positive contract fixtures and blocks all 15 of 15 malformed control-plane fixtures with 0 failures and 0 skips; these are contract fixtures, not product test scenarios or unsupported application cases. TCV-0012 documents coverage and exclusions.
- [ ] Add closed JSON Schemas where applicable.
- [ ] Add deterministic validators for all boundaries.
- [ ] Add malformed, unknown-field, oversized, and incompatible-version tests.
- [ ] Add round-trip and backwards-compatibility fixtures.
- [ ] Remove or isolate weaker duplicate planning paths.
- [ ] Prove SDK and future CLI/MCP consumers use the same contracts.

## Phase 3 — Evidence Acquisition and Incremental Recompilation

### 3.1 Provider framework

- [x] ~~Define the versioned `EvidenceProvider` interface.~~  
  Evidence: public `EvidenceProviderV1` contract and versioned acquisition input/output contracts.
- [x] ~~Define provider discovery, acquisition, refresh, and disposal lifecycle.~~  
  Evidence: `supports`, `acquire`, optional `refresh`, and optional `dispose` lifecycle documented in `docs/EVIDENCE_PROVIDERS.md`; only selection/acquisition are runtime-wired and the remaining lifecycle gaps stay explicit.
- [x] ~~Define timeout, cancellation, failure, and partial-result semantics.~~  
  Evidence: TCV-0024 covers enforced timeout, propagated cancellation, contained/redacted failure, valid partial results, and malformed responses; full run-level cancellation outcome remains a separate open task.
- [x] ~~Define evidence caching, digesting, and retention.~~  
  Evidence: deterministic SHA-256 evidence content digest; provider-revision/request/evidence/scope cache key; five-minute bounded in-memory default; exact expiry; least-recently-used eviction; explicit clear; invalid results excluded; TCV-0024. This does not claim persistent caching or upstream-source freshness.
- [x] ~~Define staleness, invalidation, and refresh policy.~~  
  Evidence: versioned `fresh`/`stale`/`unknown` assessment; valid-until checks; cache invalidation; automatic `refresh` for stale sources; reacquisition for unknown, failed, timed-out, or invalid assessment; TCV-0024. Real providers still require their own source-revision proof.
Provider security execution gate (each line is counted and may be crossed only
after its named proof exists):

- [x] ~~Define helper security in plain language and map existing controls, partial controls, missing controls, decision blockers, and external blockers.~~  
  Evidence: `docs/engineering/PROVIDER_SECURITY_ALIGNMENT.md` and direct inspection of provider context, configuration, acquisition, network, timeout, and response-limit paths.
- [x] ~~Confirm the product choice between trusted in-process helpers plus an optional isolated-worker path, or mandatory out-of-process helpers.~~  
  Evidence: product-owner approval in the Codex task and accepted ADR-0006.
- [x] ~~Remove passwords, tokens, and unrelated run data from the default helper context; use explicit secret references where a helper is authorized to resolve one.~~  
  Evidence: `EvidenceProviderV2` reduced context; legacy full context blocked by default; TCV-0026 proves configured auth/AI secrets, matching discovered values, and unrelated metadata are absent while an environment-variable reference remains.
- [x] ~~Add explicit tenant scope and prevent cross-tenant cache or evidence reuse.~~  
  Evidence: versioned optional `tenantId`, required-scope policy, validation, request propagation, cache-key inclusion, and TCV-0026 tenant A/B isolation checks. Host tenant authorization remains separate and open.
- [x] ~~Enforce returned network-destination policy rather than merely sending helpers an allowlist.~~  
  Evidence: absolute HTTP/WebSocket operation-binding destinations are checked before merge/cache; TCV-0026 blocks a forbidden host and accepts localhost. Direct in-process provider network calls remain outside this control.
- [x] ~~Enforce lexical provider artifact-reference boundaries for returned paths.~~  
  Evidence: returned artifact paths are resolved and must remain below `runtime.artifactsDir`; TCV-0026 blocks ordinary traversal and accepts an in-bound path.
- [ ] Enforce filesystem-identity safety for returned artifacts, including symlink/junction escape, and prevent direct helper file access where the selected trust policy requires isolation.
- [x] ~~Enforce the selected child-process, V8-heap, wall-time, cancellation, crash, and forced-termination boundary without calling it a full sandbox.~~  
  Evidence: `EvidenceWorkerProviderV1`, child-process IPC, configured 16–4,096 MB V8 old-space setting, hard wall-time/cancellation kill, crash containment, minimal environment, structured execution record, and TCV-0027. File/network isolation is explicitly host-enforced or `not-enforced`.
- [ ] Enforce and prove actual operating-system CPU quotas and total-process-memory quotas when the selected host isolation policy requires them; the V8 old-space setting and wall-time kill are not equivalent to those controls.
- [x] ~~Add positive, negative, adversarial secret, tenant, returned-network, returned-path, and existing response-resource tests with complete coverage documentation.~~  
  Evidence: TCV-0024 through TCV-0026; new TCV-0026 has 23 checks, 0 failures, 0 skips, exact inputs, decisions, defect REG-0007, and exclusions.
- [x] ~~Add isolated-worker CPU, memory, forced-termination, crash, timeout, cancellation, direct-network, and direct-file adversarial proof.~~  
  Evidence: TCV-0027 runs 28 checks; loop timeout and cancellation force termination, deliberate exit and 16 MB memory pressure remain contained, malformed IPC is blocked, unlisted environment secret is absent, unisolated direct file/network access is demonstrated honestly, and required host-isolation policy blocks that descriptor before launch.
- [x] ~~Document the chosen trust model, configuration, developer responsibilities, operating-system dependencies, proof depth, and remaining limits.~~  
  Evidence: ADR-0006, `PROVIDER_SECURITY_ALIGNMENT.md`, `SECURITY.md`, `CONFIGURATION.md`, `API_REFERENCE.md`, and `EVIDENCE_PROVIDERS.md`.
Provider conformance execution gate (each line is counted and may be crossed
only after its named proof exists):

- [x] ~~Define a public, versioned provider-conformance input and report.~~  
  Evidence: public `EvidenceProviderConformanceCaseV1`, check/report contracts, and `runEvidenceProviderConformance` export.
- [x] ~~Reuse the existing conformance report style and secret-leak detector.~~  
  Evidence: the existing detector is now the shared `containsObviousSecretLikeValue`; provider reports use the existing passed/failed report pattern plus explicit `not-applicable`.
- [x] ~~Check provider identity, version, revision, requirement selection, acquisition output, and bounded completion.~~  
  Evidence: reusable runner plus TCV-0025 positive, malformed, and timeout cases.
- [x] ~~Check cancellation, freshness, refresh, response limits, and secret leakage without hiding unsupported optional lifecycle features.~~  
  Evidence: explicit optional probes and `not-applicable` state; TCV-0025 stale-refresh, cancellation, overflow, and leaking cases.
- [x] ~~Check provider disposal and report when disposal is not applicable.~~  
  Evidence: bounded required/optional disposal logic; TCV-0025 success and deliberate disposal failure.
- [x] ~~Prove the runner catches deliberately slow, malformed, oversized, leaking, cancellation-ignoring, and disposal-failing synthetic providers.~~  
  Evidence: `npm run smoke:evidence-provider-conformance`; 7 providers, 1 conforming, all 6 deliberately bad providers rejected, 123 checks, 0 failures, 0 skips on the completion-integrity rerun.
- [x] ~~Document what every provider check means, how it is recognized, what decision follows, and what this synthetic proof does not establish.~~  
  Evidence: `docs/EVIDENCE_PROVIDERS.md`, API reference, TCV-0025, CLM-0015, and updated capability/traceability records.

### 3.2 Authority and conflicts

Authority-conflict execution gate (each line is counted and may be crossed only
after its named proof exists):

- [x] ~~Define authority, conflict, resolved conflict, unresolved conflict, and host override in plain language.~~  
  Evidence: `docs/EVIDENCE_AUTHORITY.md` gives plain definitions, examples, and the meaning of full versus partial information.
- [x] ~~Publish a versioned authority-policy contract with a complete declared trust order.~~  
  Evidence: public `EvidenceAuthorityPolicyV1`, default six-authority policy, strict runtime check, JSON schema, and TCV-0028 malformed-policy cases.
- [x] ~~Reuse the evidence-graph merge path through one deterministic conflict resolver.~~  
  Evidence: `mergeEvidenceGraphs` delegates non-empty work to public `resolveEvidenceConflicts`; TCV-0028 proves default-path equality and reversed-input stability.
- [x] ~~Preserve every competing value, source, authority, confidence, revision, and source-graph revision.~~  
  Evidence: public candidate/conflict records and 15 TCV-0028 preservation/precedence checks.
- [x] ~~Resolve a conflict only when one candidate has uniquely stronger declared authority.~~  
  Evidence: default contract-over-source and custom source-over-contract cases select the single strongest existing candidate.
- [x] ~~Keep equal-authority or otherwise tied conflicts unresolved instead of guessing.~~  
  Evidence: TCV-0028 equal-contract, read-only, and ambiguous-override cases have no selected candidate ID and remain unresolved.
- [x] ~~Support exact-scope host overrides with a required reason without inventing a missing candidate.~~  
  Evidence: exact operation/field scope helper and policy validation; TCV-0028 covers one match, no match, multiple matches, blank reason, duplicate scope, and broad invalid scope.
- [x] ~~Prevent every unresolved operation conflict from compiling and identify mutation-blocked operations separately.~~  
  Evidence: TCV-0028 proves both unresolved mutation and read operations return `needs-evidence`, while only the mutation appears in `mutationBlockedOperationIds`.
- [x] ~~Produce stable structured explanations for resolved, unresolved, override-selected, and override-invalid decisions.~~  
  Evidence: versioned conflict records plus 5 direct stable-explanation checks and reversed-input result equality in TCV-0028.
- [x] ~~Add positive, negative, adversarial, malformed-policy, input-order, read, and mutation proof with exact coverage documentation.~~  
  Evidence: TCV-0028 documents and passes 59 checks across 12 named categories, with 0 failures and 0 skips.
- [x] ~~Update user/developer documentation, capability/traceability/claim/regression records, package proof, and progress.~~  
  Evidence: authority/API/compiler guides, CAP-002, EVD-003, CLM-0018, REG-0009, TCV-0028, and a passing package proof with 15 required paths.

### 3.3 Acquisition loop

Acquisition-loop execution gate (expanded before implementation so affected
scope, safe stopping, and proof are visible rather than hidden inside broad
tasks):

- [x] ~~Map `needs-evidence` diagnostics to eligible providers.~~  
  Evidence: `requirementsFromCompilation` maps missing-operation and missing-value diagnostics; TCV-0024 covers both the `unsupported`-but-acquirable and `needs-evidence` cases.
- [x] ~~Acquire only the affected evidence scope.~~  
  Evidence: provider selection filters requirements through `supports`; TCV-0024 proves a source receives only its declared requirement subset.
- [x] ~~Merge evidence into a new graph revision.~~  
  Evidence: `SemanticPlanner` merges validated provider graphs through the existing authority-aware graph merge; TCV-0024 then compiles and lowers the formerly missing operation.
- [x] ~~Bound repeated acquisition and prevent infinite loops.~~  
  Evidence: configurable 0-5 round bound; TCV-0024 proves irrelevant new graphs stop after exactly two configured rounds.
- [x] ~~Define affected scenario, preserved scenario, selective recompilation, unavailable source, and contradictory evidence in plain language.~~  
  Evidence: `docs/INCREMENTAL_RECOMPILATION.md` defines every term plus full/partial information and why preserved does not mean unchecked.
- [x] ~~Publish a versioned acquisition/recompilation decision record with authoritative evidence and policy references.~~  
  Evidence: public `AcquisitionRecompilationDecisionV1`, closed plan JSON shape, before/after revision and digest, authority-policy digest, provider/graph/conflict/diagnostic references, and TCV-0029.
- [x] ~~Identify affected scenarios from missing-information requirements, changed operations, new matching operations, and unresolved conflicts.~~  
  Evidence: public `affectedScenarioIdsForEvidenceChange` reuses the compiler candidate rule; TCV-0029 covers referenced changes, new matches, conflicts, unrelated evidence, and reversed input.
- [x] ~~Reuse the existing semantic compiler to rebuild only affected scenarios while preserving unaffected scenario results.~~  
  Evidence: public `compileIntentIncrementally` calls `UniversalSemanticCompiler` per affected scenario; TCV-0029 proves only `order-scenario` is called again and the exact `profile-scenario` result object is preserved.
- [x] ~~Integrate selective recompilation into `SemanticPlanner` without creating a second planning path.~~  
  Evidence: `SemanticPlanner` uses the public incremental helper and shared conflict resolver; TCV-0029 plan integration plus the passing existing acquisition and real semantic-workflow suites.
- [x] ~~Stop safely with structured reasons when no provider is eligible, providers return no usable evidence, or acquired evidence conflicts.~~  
  Evidence: versioned reason/outcome fields exposed on plans and `SemanticCompilationError`; TCV-0029 unavailable, failed, irrelevant, conflict, no-invention, and maximum-round cases.
- [x] ~~Add multi-scenario, input-order, unavailable-provider, failed-provider, irrelevant-evidence, contradiction, bounded-round, and no-invention proof with exact coverage documentation.~~  
  Evidence: TCV-0029 passes 54 checks across 17 named categories with 0 failures and 0 skips in the corrected run; REG-0010 and REG-0011 record the implementation and proof-fixture corrections.
- [x] ~~Update user/developer documentation, API/types, capability/traceability/claim/regression records, package proof, and progress.~~  
  Evidence: selective-recompilation/API/compiler guides, CAP-003/CAP-006, EVD-004/CMP-006/FIN-001, CLM-0019, REG-0010/0011, TCV-0029, and passing package proof with 16 required paths.

## Phase 4 — Compiler, Mutation, and Cleanup Invariants

### 4.1 Typed value flow

Typed-value-flow execution gate (expanded before implementation so every
decision, rejection, and proof remains visible):

- [x] ~~Define value, source, producer, consumer, lifetime, full information, partial information, conversion, and secret reference in plain language.~~  
  Evidence: `docs/TYPED_VALUE_FLOW.md` defines each term and explains full versus partial information in plain language.
- [x] ~~Publish a versioned value-flow record that exposes type, source, producer, consumers, lifetime, and any approved conversion without storing the value itself.~~  
  Evidence: public `WorkflowValueFlowV1`/`WorkflowValueRecordV1` use `brisk-aitesting.value-flow.v1`; TCV-0030 verifies the metadata-only record.
- [x] ~~Reuse the existing compiler binding path to record user values, fixtures, secret references, generated values, and earlier-step outputs.~~  
  Evidence: `UniversalSemanticCompiler` builds the record from final existing step bindings; TCV-0030 proves all five sources.
- [x] ~~Record every consumer and the exact start/end boundary of each value's useful lifetime.~~  
  Evidence: output records aggregate consumer step/input pairs and calculate producer-to-last-consumer boundaries; TCV-0030 proves two consumers.
- [x] ~~Normalize and enforce semantic types; reject blank, malformed, or incompatible types instead of guessing.~~  
  Evidence: exact normalized equality or one declared conversion is required; TCV-0030 proves malformed and incompatible rejection plus valid matching.
- [x] ~~Define adapter-owned conversions as explicit, reviewable source-type to target-type declarations; never let the compiler invent a conversion.~~  
  Evidence: public conversion records carry id, owning adapter, types, and safety; TCV-0030 proves declared success, absent failure, and duplicate rejection.
- [x] ~~Detect missing required values and explicitly supplied incompatible values with safe, useful reasons.~~  
  Evidence: separate `MISSING_REQUIRED_VALUE` and `INCOMPATIBLE_VALUE_BINDING` paths are proven by TCV-0030.
- [x] ~~Detect duplicate user aliases and multiple possible earlier-output producers; stop instead of silently choosing one.~~  
  Evidence: duplicate and ambiguity diagnostics replace the former last-value fallback; TCV-0030 proves duplicate aliases and two owner producers are rejected.
- [x] ~~Validate unique step/input/output identities, producer existence and order, and detect circular value dependencies.~~  
  Evidence: workflow validation checks identities, producer/capture facts, order, types, and the combined dependency graph; TCV-0030 proves invalid fixtures.
- [x] ~~Allow secret references but prevent raw secret-like values from AI prompts, compiler records, diagnostics, workflow proof, and evidence artifacts.~~  
  Evidence: pre-provider refusal, evidence/compiler guards, metadata-only records, and conformance artifact checks; TCV-0030 proves no provider call and secret-safe diagnostics.
- [x] ~~Add positive, negative, and adversarial tests for all five sources, consumers/lifetimes, conversions, missing/duplicate/incompatible/ambiguous bindings, cycles, and secret safety; document exact coverage and discovered defects.~~  
  Evidence: TCV-0030 passed 40/40 across seven exact categories with 0 failures/skips; REG-0012 and REG-0013 preserve the generator and echoed-identifier defects found during development. Connected compiler, real workflow, provider conformance/security, engine/extension conformance, conflict, and incremental suites passed.
- [x] ~~Update public types, user/developer guidance, capability/traceability/claim/regression records, package proof, and final progress.~~  
  Evidence: public value/conversion types and exports; typed-flow/compiler/API/security/AI guides; PRN-006, CMP-002/003, CAP-003, CLM-0020, TCV-0030, REG-0012/0013; package proof passed with 117 files, 895,527 bytes, and all 17 required paths.

### 4.2 Operation selection and lifecycle

Operation-selection/lifecycle execution gate (expanded before implementation
so authority, phase meaning, identities, and proof cannot remain implicit):

- [x] ~~Define operation, selection, authoritative evidence, lifecycle phase, logical scenario, stable identity, and decision record in plain language; name the Evidence Graph revision as source of truth.~~  
  Evidence: `docs/OPERATION_LIFECYCLE.md` defines every term, full/partial information, the exact source of truth, and current limits.
- [x] ~~Require every selected operation to exist in the exact Evidence Graph revision, have provenance, be conflict-free, and have more than heuristic-only support.~~  
  Evidence: compiler authority gate plus final workflow/decision revision validation; TCV-0031 proves heuristic-only read rejection and source-supported read acceptance.
- [x] ~~Keep the stronger host/contract/runtime/observed authority rule for create, update, delete, and external side effects.~~  
  Evidence: existing mutation-authority rule remains separate and TCV-0031 proves heuristic mutation rejection; connected universal safety proof still passes.
- [x] ~~Select only outcomes declared by the chosen operation and reject missing, duplicate, or contradictory outcome identities.~~  
  Evidence: exact ids, unique operation outcomes, ambiguous/missing stop, and final-workflow outcome validation; TCV-0031 covers valid, missing, and contradictory cases.
- [x] ~~Add explicit setup, test, verification, and cleanup phase values; preserve an explicit intent phase, default unspecified intent actions to test, and never guess setup/verification.~~  
  Evidence: public `WorkflowPhase`, closed AI phase values, compiler default, synthetic cleanup phase, and TCV-0031 all-phase proof.
- [x] ~~Preserve one logical user scenario while exposing every internal operation and phase without silently reordering execution.~~  
  Evidence: TCV-0031 preserves three intent actions in order inside one scenario; TCV-0020 still reports one logical test across five real operations.
- [x] ~~Generate deterministic workflow, scenario, step, and cleanup identities from stable semantic inputs while keeping creation time as non-identity metadata.~~  
  Evidence: SHA-256 workflow identity excludes `createdAt`; stable compiler ids and duplicate intent-id rejection; TCV-0031 proves repeated and reversed-evidence-order stability including cleanup.
- [x] ~~Publish a versioned selection decision for every chosen step with candidates, score/reason, operation, outcomes, phase, evidence revision, and provenance references.~~  
  Evidence: public `WorkflowSelectionDecisionV1`; TCV-0031 proves all fields for normal and cleanup steps.
- [x] ~~Validate workflow identities and selection decisions against the final workflow and Evidence Graph; reject duplicates, stale revisions, unknown facts, and altered decisions.~~  
  Evidence: invariant validator checks digest, count, uniqueness, revision, candidate, operation, outcome, phase, and provenance consistency; TCV-0031 tampering fixtures.
- [x] ~~Add positive, negative, adversarial, input-order, and compatibility tests for authority, outcomes, phases, logical reporting, stable identities, and decision tampering; document exact coverage and discovered defects.~~  
  Evidence: TCV-0031 initially passed 35/35 lifecycle checks and now passes 45/45 across ten categories after cleanup-safety records were added, with 0 failures/skips; REG-0014 documents and corrects the stale preserved-scenario decision found by incremental compatibility proof.
- [x] ~~Update public types, user/developer guidance, capability/traceability/claim/regression records, package proof, and final progress.~~  
  Evidence: public types/helpers; operation-lifecycle/compiler/API guides; PRN-007, CMP-004/006, CAP-003, CLM-0021, TCV-0031, REG-0014; the original package proof passed with 118 files, 912,497 bytes, and all 18 then-required paths, and the current proof is recorded separately after the cleanup guide addition.

### 4.3 Cleanup and recovery safety

Cleanup/recovery execution gate (expanded before implementation so a crash,
retry, or partial cleanup can never silently repeat an unsafe action):

- [x] ~~Define cleanup, precondition, mutation receipt, idempotency, independent cleanup, residual state, and full/partial recovery in plain language; name the workflow and run journal as sources of truth.~~  
  Evidence: `docs/CLEANUP_AND_RECOVERY.md` defines each term with examples, separates built/partial/missing behavior, fixes the cleanup-only interruption rule, identifies workflow/journal/captures as authority, and explains why incomplete proof leaves visible residual state instead of repeating a mutation.
- [x] ~~Publish a versioned cleanup-safety record linking each resource-producing step, cleanup step, dependencies, required captured values, accepted outcomes, and evidence authority.~~  
  Evidence: public `WorkflowCleanupSafetyRecordV1`, compiler generation, stable identity, final-workflow validation, incremental-workflow regeneration, public helper/export, API and cleanup guide, and TCV-0031 with 8 positive field checks plus altered/missing rejection. Build and connected incremental, universal-compiler, and real semantic-workflow suites passed; the strengthened package proof passes with 120 files, 929,822 bytes, all 20 required paths, 22 internal links, clean install, and installed import.
- [x] ~~Synthesize cleanup in reverse dependency order and prove the order for chains, branches, and multiple resources.~~  
  Evidence: `UniversalSemanticCompiler` now reverses the compiled typed resource dependencies, keeps independent branches independent, and binds repeated same-type resources to distinct producer-specific cleanup steps. TCV-0031 failed first on the former false branch dependency, then passed 62/62 focused checks across 13 categories, including 17 chain/branch/multiple-resource cleanup checks, with 0 failures and 0 skips. Typecheck, build, universal-compiler, typed-value-flow, incremental-recompilation, and the real local semantic workflow also passed; the real workflow executed one cleanup and left 0 resources. Packed proof passed with 120 files, 935,022 bytes, 20 required paths, 22 valid internal links, clean install/import, and 0 errors. REG-0017 records the defect and limits.
- [x] ~~Validate cleanup identity, source operation, cleanup operation, phase, bindings, outcomes, dependencies, and authority before lowering or execution.~~  
  Evidence: public `WorkflowLowerer` now runs the shared workflow/evidence invariant gate before any adapter and throws structured `WORKFLOW_VALIDATION_FAILED` diagnostics. TCV-0031 failed first when an altered cleanup identity still reached lowering, then passed 88/88 checks across 14 categories; 26 pre-lowering checks cover one valid path and eight rejected identity/source-operation/cleanup-operation/phase/binding/outcome/dependency/authority families, each with 0 normal and 0 cleanup adapter calls. Typecheck, build, contracts, universal compiler, typed value flow, incremental recompilation, real local semantic workflow, engineering records, and packed proof passed. The packed package contains 120 files (938,668 bytes), all 20 required paths and 22 links, installs/imports cleanly, and exposes `WorkflowLowerer` plus `WorkflowLoweringValidationError`. REG-0018 records the defect and exclusions.
- [ ] Record mutation intent and completion receipts around every external side effect using stable operation and attempt identities.
- [ ] Classify operations as proven idempotent/resumable or unknown; after interruption, never repeat an unknown mutation.
- [ ] Journal cleanup registration, attempt, completion, failure, skip, and the captured values needed for recovery.
- [ ] Reconstruct an interrupted run from its journal and continue pending cleanup only, without restarting discovery, planning, tests, or mutations.
- [ ] Continue cleanup branches that do not depend on a failed cleanup; block only the unsafe dependants.
- [ ] Prevent the same cleanup from running twice across retry, process restart, re-entry, or concurrent recovery.
- [ ] Record residual state: what may remain, which cleanup failed or was skipped, why, and the next safe action; never fabricate a test verdict.
- [ ] Add chain, branch, property-based, mutation, interruption, double-recovery, corrupt-journal, timeout, partial-cleanup, and adversarial tests with exact documented coverage.
- [ ] Update public types, user/developer guidance, capability/traceability/claim/regression records, package proof, and progress.

## Phase 5 — OpenAPI Vertical Reference Proof

- [ ] Route inspection through the shared evidence-provider lifecycle.
- [ ] Prove parsing and dereferencing against mature OpenAPI tooling.
- [ ] Prove typed request and response mapping.
- [ ] Prove authentication mapping.
- [ ] Prove positive and negative outcomes.
- [ ] Prove setup, mutation, verification, and cleanup lowering.
- [ ] Prove execution artifacts and provenance.
- [ ] Prove timeout and cancellation.
- [ ] Prove contract drift and evidence refresh.
- [ ] Prove safe API healing through recompilation.
- [ ] Prove interrupted-run and cleanup recovery.
- [ ] Run real reference applications from packed artifacts.
- [ ] Update capability, traceability, claim, and regression records.

## Phase 6 — Reliability and Controlled Healing

### 6.1 Healing framework

- [ ] Define common drift evidence and equivalence contracts.
- [ ] Implement evidence healing.
- [ ] Implement type-safe binding healing.
- [ ] Expand UI healing to multi-page workflows.
- [ ] Implement API contract healing.
- [ ] Implement dependency-aware workflow healing.
- [ ] Implement bounded infrastructure healing.
- [ ] Capture before-state and after-state evidence.
- [ ] Enforce stronger authorization for destructive healing.
- [ ] Report attempted, succeeded, declined, confidence, equivalence, retries, and final outcome.

### 6.2 Containment and recovery

- [ ] Propagate abort signals through every pipeline stage.
- [ ] Contain malformed provider responses.
- [ ] Contain engine, browser, worker, observer, and artifact failures.
- [ ] Contain partial result-storage failures.
- [ ] Persist recoverable interrupted-run state.
- [ ] Resume only operations proven safe to continue.
- [ ] Continue cleanup independently where safe.
- [ ] Add systematic fault injection for every mandate failure class.
- [ ] Add regression and adversarial counterexamples.

## Phase 7 — Security and Observability Foundations

### 7.1 Security

- [ ] Centralize enforceable policy evaluation.
- [ ] Enforce local-first network behavior at every outbound boundary.
- [ ] Enforce explicit host allowlists.
- [ ] Validate filesystem roots and prevent path traversal.
- [ ] Use safe temporary directories.
- [ ] Add secret-reference and secret-resolver contracts.
- [ ] Unify redaction across logs, diagnostics, results, artifacts, CLI, and MCP.
- [ ] Isolate prompt-injection-bearing application data.
- [ ] Enforce tenant scoping and cross-tenant denial tests.
- [ ] Add consent and mutation-authorization records.
- [ ] Add command allowlisting and extension sandbox expectations.
- [ ] Bound schema depth, input size, CPU, memory, concurrency, and artifact volume.
- [ ] Add evidence and artifact retention policy.
- [ ] Run dependency and malicious-input security checks.

### 7.2 Observability

- [ ] Carry correlation, run, scenario, operation, adapter, and engine IDs.
- [ ] Record stage timings, retries, provider use, healing, cleanup, and artifacts.
- [ ] Define host observer and telemetry extension contracts.
- [ ] Add OpenTelemetry-compatible traces.
- [ ] Add metrics export.
- [ ] Add structured log export.
- [ ] Prove telemetry failure cannot affect execution or verdicts.
- [ ] Add cardinality, redaction, and performance tests.

## Phase 8 — Shared Application Service and Complete CLI

### 8.1 Shared application service

- [ ] Define one application-service boundary over the universal pipeline.
- [ ] Move SDK orchestration behind the shared boundary.
- [ ] Expose cancellation, progress, storage, artifact, and policy controls.
- [ ] Add service-level integration and compatibility tests.

### 8.2 CLI commands

- [ ] Complete `init` guided and non-interactive behavior.
- [ ] Complete `doctor` diagnostics and correction guidance.
- [ ] Implement `discover`.
- [ ] Implement `plan`.
- [ ] Implement `explain`.
- [ ] Implement `validate`.
- [ ] Harden `run`.
- [ ] Implement `resume`.
- [ ] Harden `inspect`.
- [ ] Implement `replay`.
- [ ] Harden `clean`.
- [ ] Implement `benchmark`.
- [ ] Implement `adapters`.
- [ ] Implement `version`.

### 8.3 CLI contracts and proof

- [ ] Define stable JSON schemas for every command.
- [ ] Define and document exit codes.
- [ ] Add progress and cancellation handling.
- [ ] Prevent forced termination and hanging handles.
- [ ] Implement configuration precedence.
- [ ] Emit deterministic output and machine-readable artifact references.
- [ ] Prove secret redaction and actionable invalid-config errors.
- [ ] Run packed `install -> init -> doctor -> discover -> plan -> run -> inspect -> clean` proof.
- [ ] Measure installation time, package size, dependency count, setup fields, and time to first test.
- [ ] Prove npm, pnpm, Yarn, CI, Windows, Linux, and macOS paths.

## Phase 9 — First-Party Dual-Era MCP Product

### 9.1 Protocol and transport foundation

- [ ] Record the dual-era MCP ADR and compatibility matrix.
- [ ] Adopt the official TypeScript MCP SDK.
- [ ] Implement native 2026-07-28 serving.
- [ ] Implement 2025-11-25 compatibility.
- [ ] Implement stdio as the default local transport.
- [ ] Implement optional authenticated Streamable HTTP.
- [ ] Validate origins and bind local HTTP to loopback by default.
- [ ] Implement version, capability, extension, and error negotiation.

### 9.2 MCP capabilities

- [ ] Define closed, versioned schemas for every MCP tool.
- [ ] Expose product-capability inspection.
- [ ] Expose application evidence and route/contract discovery.
- [ ] Expose planning and compilation explanations.
- [ ] Expose workflow validation.
- [ ] Expose test execution.
- [ ] Expose progress and cancellation.
- [ ] Expose interrupted-run inspection and safe resumption.
- [ ] Expose results and artifacts.
- [ ] Expose benchmarks, adapters, and environment diagnostics.
- [ ] Expose read-only evidence, plans, results, reports, manifests, and documentation as resources.
- [ ] Add intent-expression prompts without bypassing compiler validation.

### 9.3 Long-running work and security

- [ ] Implement the 2026 Tasks extension for durable long-running work.
- [ ] Implement down-level progress/cancellation behavior.
- [ ] Use correlation IDs across MCP, service, run, and artifacts.
- [ ] Bind task and run access to authorization context.
- [ ] Enforce tenant, consent, filesystem, network, and secret policy.
- [ ] Bound task concurrency, TTL, storage, and polling.

### 9.4 MCP proof

- [ ] Run official protocol conformance checks.
- [ ] Add tool/resource/prompt schema tests.
- [ ] Add compatibility tests for both protocol eras.
- [ ] Add load, cancellation, interruption, resumption, and storage-failure tests.
- [ ] Add authorization, tenant-isolation, injection, path, network, and redaction tests.
- [ ] Run the MCP server from the packed product.
- [ ] Publish honest MCP integration evidence and exclusions.

## Phase 10 — Production Adapter Programme

Each adapter must prove discovery, evidence, typed mappings, authentication,
positive/negative outcomes, lowering, execution, artifacts, timeout,
cancellation, cleanup, drift, healing, conformance, packaging, documentation,
and real reference execution.

Shared foundation gates must be completed before duplicating the same behavior
inside named adapters:

- [ ] Define one versioned capability-profile contract so protocols and platform connectors describe operations, types, transports, authority, outcomes, lifecycle, cleanup, and limits in the same Evidence Graph language.
- [ ] Support explicit schema dialects and safe type mapping across JSON Schema, GraphQL types/custom scalars, protobuf, Avro, and XML Schema; preserve unknown formats instead of coercing them to strings.
- [ ] Support common payload/encoding shapes: JSON, XML, form data, multipart uploads, text, NDJSON/streaming records, binary data, protobuf, and Avro without placing codec rules in the compiler.
- [ ] Define transport profiles for HTTP/1.1, HTTP/2, WebSocket, Server-Sent Events, callbacks/webhooks, brokers, and local process streams with cancellation, deadlines, correlation, backpressure, and connection lifecycle.
- [ ] Normalize authentication evidence for anonymous access, API keys, Basic, bearer/JWT, OAuth 2/OIDC, cookies/sessions, mutual TLS, signed requests, delegated identity, and secret references without acquiring credentials through AI.
- [ ] Normalize authorization evidence for scopes/claims, RBAC, ABAC, ReBAC, row/record/field rules, tenant boundaries, impersonation, consent, and service accounts while keeping policy ownership with the source system.
- [ ] Model resource/query behavior for pagination, cursors, filtering, sorting, search, sparse fields, projections, relationships, includes/expansion, counts, batching, and bulk operations.
- [ ] Model mutation safety for idempotency keys, conditional requests, ETags/versions, optimistic concurrency, duplicate suppression, transactions, compensation, isolation, and partial commit evidence.
- [ ] Model asynchronous behavior for accepted/background operations, polling, progress, callbacks, webhooks, subscriptions, eventual consistency, delivery delay, and stable terminal outcomes.
- [ ] Normalize protocol error and partial-success evidence across HTTP problem details, GraphQL errors, gRPC status, JSON-RPC errors, SOAP faults, broker rejection/dead-letter outcomes, and per-item batch failures.
- [ ] Model operational limits and resilience evidence for rate limits, quotas, retry-after, deadlines, bounded retries, backoff, keepalive, flow control, message size, pagination bounds, and stream cancellation.
- [ ] Model versioning, deprecation, compatibility, disabled discovery/introspection, contract overlays, persisted operations, traffic/HAR evidence, and drift without guessing absent operations.

- [ ] Prove GraphQL interfaces, unions, fragments, nullability, lists, enums, input objects, directives, custom scalars, deprecation, pagination connections, nested relations, partial data, and field-level errors.
- [ ] Prove GraphQL-over-HTTP, persisted operations, disabled-introspection fallback, subscriptions, federation/supergraph/schema-stitching gateways, and multiple upstream graphs as evidence profiles rather than compiler branches.
- [ ] Build an OData evidence/lowering profile for metadata, entity sets, relationships, query options, batch, ETags, delta links, actions/functions, and protocol errors.
- [ ] Build resource/hypermedia profiles for JSON:API and link-driven APIs, including relationships, included resources, pagination, sparse fields, sorting, errors, and discoverable links.
- [ ] Build a JSON-RPC 2.0 adapter/profile for named/positional parameters, request/response correlation, notifications, batches, protocol errors, and partial batch outcomes.
- [ ] Build an optional SOAP/WSDL enterprise adapter/profile for service/operation discovery, XML Schema types, message exchange patterns, SOAP faults, headers, policies, authentication, attachments, and cleanup.
- [ ] Normalize CloudEvents envelopes and schema-registry evidence across JSON Schema, Avro, and protobuf while keeping broker/cloud transport details in their owning adapters.
- [ ] Import API collections and recorded traffic as attributed evidence, including HAR and collection variables/examples, without allowing examples or captured credentials to become mutation authority.

- [ ] Harden OpenAPI/HTTP to production-proof status.
- [ ] Build one vendor-neutral GraphQL capability adapter from schema/introspection evidence; do not encode Hasura, Directus, or another product in compiler selection rules.
- [ ] Prove GraphQL queries, mutations, subscriptions, variables, typed inputs/outputs, business outcomes, and protocol errors through the shared adapter contract.
- [ ] Normalize authentication, roles, row/field permissions, tenant scope, and mutation authority as attributed common evidence rather than assuming platform metadata is executable truth.
- [ ] Define a small reusable data-platform evidence-connector contract that can translate vendor metadata and optional REST/OpenAPI surfaces without creating a second compiler or execution pipeline.
- [ ] Add a thin Hasura evidence connector/proof that translates its exposed schema, metadata, roles, permissions, queries, mutations, subscriptions, and REST endpoints into common Evidence Graph facts.
- [ ] Add a thin Directus evidence connector/proof that translates its schema, roles/policies, permissions, GraphQL operations, and REST/OpenAPI surface into the same common Evidence Graph facts.
- [ ] Prove plain GraphQL, Hasura, and Directus fixtures compile through the same Intent IR, Evidence Graph, Workflow IR, value-flow, lifecycle, security, cleanup, and decision-record path; fail if the core imports or branches on a vendor name.
- [ ] Prove the connector contract can represent an additional generated-data-API shape without changing compiler rules, while keeping Supabase/PostgREST/Appwrite implementation outside the accepted scope until separately approved.
- [ ] Build browser/accessibility.
- [ ] Build AsyncAPI normalization and lowering.
- [ ] Build Kafka.
- [ ] Build RabbitMQ.
- [ ] Build Azure Service Bus.
- [ ] Build Azure Event Hubs.
- [ ] Build AWS SQS.
- [ ] Build AWS SNS.
- [ ] Build Google Pub/Sub.
- [ ] Build gRPC unary, client-streaming, server-streaming, and bidirectional-streaming lowering through the shared RPC/value-flow contract.
- [ ] Prove protobuf types/evolution, reflection, metadata, status details, deadlines, cancellation, health, keepalive, flow control, retries, and message-size limits.
- [ ] Prove gRPC authentication/authorization, interceptors, partial stream failure, interruption, cleanup, artifacts, and a real polyglot reference service.
- [ ] Build command-line application support.
- [ ] Build scheduled-job and worker support.
- [ ] Build relational database support.
- [ ] Build document database support.
- [ ] Build filesystem support.
- [ ] Build object-storage support.
- [ ] Harden proprietary host capabilities.
- [ ] Package heavy adapters separately from the lightweight core.
- [ ] Keep fixture-only compatibility visibly separate from production support.

## Phase 11 — Shared Product and Extension Surfaces

- [ ] Route SDK calls through the shared application service.
- [ ] Route CLI commands through the shared application service.
- [ ] Route MCP tools through the shared application service.
- [x] ~~Document embedded host integration.~~
  Evidence: `docs/HOST_INTEGRATION.md` now defines the host boundary and gives the complete pinned-Git-install, host-owned type, explicit mapping, runtime-selected AI connector, authentication, trusted-operation evidence, preview/execution, result, cleanup, verification, mistake, and Brisk-reference path. README, configuration, and API-reference entry points link to it. `npm run pack:check` passed with the guide inside the 129-file clean-installed artifact, 40 internal Markdown links resolved, installed imports passed, and 0 errors. This documents the integration contract; it does not prove every host or provider family works.
- [ ] Complete programmatic APIs.
- [ ] Add CI reporters and stable exit semantics.
- [ ] Add editor and agent integration examples.
- [ ] Version adapter, provider, planner, validator, engine, authentication, secret, fixture, cleanup, storage, telemetry, policy, reporting, and MCP exposure contracts.
- [ ] Add JSON Schemas where applicable.
- [ ] Document lifecycle, timeout, cancellation, errors, security, and compatibility.
- [ ] Publish conformance kits and examples for each extension family.
- [ ] Prove hosts can adapt important behavior without forking.

## Phase 12 — World-Class Benchmark System

### 12.1 Corpus

- [ ] Version the corpus format and ground-truth schema.
- [ ] Add small, medium, large, and very-large repositories.
- [ ] Add language, framework, protocol, authentication, and architecture diversity.
- [ ] Add known operations, bindings, outcomes, cleanup, drift, and attack annotations.
- [ ] Separate synthetic, reference, host, and real-world corpora.

### 12.2 Measurements

- [ ] Measure intent quality.
- [ ] Measure compilation quality.
- [ ] Measure evidence quality.
- [ ] Measure execution quality.
- [ ] Measure healing quality and unsafe-healing rate.
- [ ] Measure mutation safety.
- [ ] Measure reliability and recovery.
- [ ] Measure scalability and resource use.
- [ ] Measure developer experience.
- [ ] Measure AI provider quality, cost, variance, and outage behavior.
- [ ] Measure security and prompt-injection resistance.

### 12.3 Reporting and gates

- [ ] Report corpus/product/provider/runtime/configuration versions.
- [ ] Report sample counts and denominators.
- [ ] Report pass, fail, skip, and error counts.
- [ ] Report percentile latency and confidence intervals where meaningful.
- [ ] Preserve raw redacted evidence.
- [ ] Compare regressions against versioned thresholds.
- [ ] Report known exclusions.
- [ ] Prevent percentage-only or synthetic-as-real claims.
- [ ] Add benchmark regression gates to release verification.

## Phase 13 — Documentation, Packaging, and Release Proof

### 13.1 Documentation and examples

- [ ] Test a five-minute quick start from the packed artifact.
- [ ] Test SDK, CLI, MCP, host, and CI examples.
- [ ] Test adapter and engine authoring examples.
- [ ] Complete security configuration and threat documentation.
- [ ] Complete troubleshooting and environment diagnosis.
- [ ] Complete migration and compatibility guidance.
- [ ] Complete configuration and capability references.
- [ ] Audit README, website, changelog, and package metadata against the claim ledger.

### 13.2 Release gates

- [ ] Run unit tests and report exact counts.
- [ ] Run integration tests and report exact counts.
- [ ] Run negative and adversarial tests and report exact counts.
- [ ] Run interruption, timeout, cleanup, and security tests.
- [ ] Run every reference application.
- [ ] Run host integration.
- [ ] Run packed CLI and MCP paths.
- [ ] Run cross-platform package-manager proofs.
- [ ] Run benchmark regression thresholds.
- [ ] Inspect all produced artifacts.
- [ ] Update capability, traceability, claim, decision, and regression records.
- [ ] Report justified claims and all remaining gaps.
- [ ] Mark `complete` only when nothing required by the accepted scope remains open.

## Current Execution Position

Current checkpoint: world-class real-validation baseline and measurement gate before further Medusa scenario construction.  
Next executable work: version the 300-scenario manifest and benchmark sample contracts, then record mutation intent and completion receipts around
every external side effect using stable operation and attempt identities.
Idempotency, partial failure,
interruption, and residual-state reporting remain later Phase 4.3 gates. Real host/container file-network
isolation, a real provider, cross-platform worker, and broader
reference-application proof remain open elsewhere in the programme.
