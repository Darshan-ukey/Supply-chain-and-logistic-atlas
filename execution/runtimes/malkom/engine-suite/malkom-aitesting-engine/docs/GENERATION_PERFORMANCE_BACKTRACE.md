# Generation Performance Backtrace

Why AI test generation takes minutes, measured stage by stage — and where the
engine needs to be beefed up. Written after a MALKOM command generation spent
364.8s to produce zero scenarios for a 15-check request.

Method: the real engine (`createBriskAiTesting`, same `defineHostConfig`
fields and run input the MALKOM bridge builds, the same evidence contracts)
was run end to end with a local stub application server and a mock AI
provider whose latency is dialed per run. That isolates the engine's own
"construct building" time from provider and network time. The harness is
committed at `smoke/perf/generation-perf-harness.mjs`; the compiler scaling
benchmark at `smoke/perf/compile-scaling-bench.mjs`. All numbers below are
from those runs on this branch (Linux sandbox, Node 22).

## 1. The verdict in one paragraph

The engine's deterministic construct building — evidence, compile, lower,
validate — is **not** the cost. For 15 scenarios it is ~0.17 seconds total,
and it stays under ~0.35 seconds at 50 scenarios. Generation time is almost
entirely **waiting, in series, on things outside the compiler**: AI provider
round-trips (2 serial waves on the happy path, 2 + repair-attempts when
planning has to repair), a per-UI-scenario Playwright *subprocess* during
grounding, serial un-deduplicated live data probes, and (first click only)
repo discovery and Chromium download. The 364.8s failure was ~3 serial
provider waves of a large, non-streamed structured completion — roughly two
minutes per wave — plus overhead, ending in the unrepairable-diagnostic loop
fixed in REG-0025.

## 2. The measured shape of one generation

Stages, in order, for a preview/generation run (`orchestrator.run` with
`execution: 'preview'`):

```
discovery → planning.evidence → planning.ai-intent (outline + parallel write wave)
→ planning.compile → [planning.ai-repair-N → planning.recompile-N]* 
→ evidence-acquisition rounds → planning.lower → planning.data-probe
→ validation → grounding (per UI scenario: browser + AI) → reporting
```

Measured, 15 scenarios, instant AI, instant HTTP, no repo scan:

| stage | ms |
|---|---|
| discovery | 9 |
| planning.evidence | 5 |
| planning.ai-intent | 6 |
| planning.compile | 53 |
| planning.lower | 12 |
| planning.data-probe | 48 |
| validation | 11 |
| grounding (no UI scenarios) | 0 |
| **total run** | **172** |

The same run at 50 scenarios: 305ms total (compile 131ms). **Engine CPU is a
rounding error at MALKOM's scale.**

## 3. Where the time really goes, ranked

### 3.1 Serial AI waves × per-call latency (dominant)

With every AI call forced to exactly 3s, the pipeline's *shape* becomes
visible:

- Happy path, 15 scenarios: **6.2s = exactly 2 serial waves.** Wave 1 is the
  outline call; wave 2 writes all five 3-check batches in parallel
  (`AiIntentPlanner.BATCH_SIZE = 3`, `MAX_PARALLEL = 8`). This part of the
  design is good.
- Failing path (repairAttempts=2): **12.1s = exactly 4 serial waves** —
  outline → write → repair-1 → repair-2. Each repair attempt is one full
  provider round-trip that cannot be parallelized with anything.
- Scenario-count scaling: waves = 1 + ceil(ceil(N/3)/8) — 15 scenarios = 2
  waves, 50 = 4, 100 = 6.

Reconstruction of the production 364.8s failure: MALKOM's default
`aiJsonRepairAttempts` is 1, so the failing run's serial chain was outline →
write wave → repair-1 → (recompiles and evidence rounds, ~0.2s) →
refusal — **3 provider waves ≈ 120 seconds per wave**. That per-wave latency
is provider-side, and the host's completion layer explains it
(`apps/server/src/modules/ai/complete.ts` in malkom-command):

- completions are **not streamed** — nothing returns until the last token;
- `max_tokens` defaults to **32,000** and is sent on *every* call, including
  the outline whose answer is a 15-line list;
- the JSON Schema is embedded in the system prompt (portable, but adds input
  tokens and relies on the model to comply — non-compliance triggers whole
  batch retries);
- which model is configured lives in the host's provider settings, not in
  code, so the per-call latency cannot be attributed further from here.
  Even a plain (non-thinking) model writing a 3-scenario structured batch
  emits 1.5–4k output tokens, which is 20–90s un-streamed at common
  provider speeds; a single invalid-JSON batch retry silently doubles its
  wave. The engine additionally tolerates `<think>` reasoning envelopes
  (`structuredIntentJson`), so if a thinking model is ever configured its
  hidden reasoning stacks on top. "The AI feels fast" in chat does not
  transfer to these calls either way. Closing G12 (per-call telemetry)
  turns this attribution from arithmetic into a read-off number; today the
  progress panel's `ai-outline`/`ai-write`/`ai-repair` phase durations are
  the closest per-call measurement available.

A hidden multiplier lives inside the write wave: each batch that returns
invalid JSON is retried up to `repairAttempts` times, and the retry prompt
re-embeds **up to 200,000 characters of the invalid response plus the full
original prompt** (`intentRepairUserPrompt`), so retries are strictly slower
than the call they replace — invisible in the coarse phase list.

### 3.2 Grounding: was one Playwright subprocess per UI scenario — now fixed

**Correction (own error).** The first version of this document presented
generation-time grounding as a live per-scenario cost of the default
pipeline. Re-audit showed that was wrong: no default planner implements
`enrichUiActions` (the only implementer, the legacy `AiPlanner`, is never
instantiated by the orchestrator), so on the default semantic path the
grounding stage returned immediately and **no browser ever opened during
generation**. The cost was *latent* — it fired only for hosts shipping a
custom planner with UI-action enrichment. The mechanism critique still
stood: the shipped grounder spawned a fresh `playwright test` CLI
subprocess (runner boot + brand-new Chromium, typically 3–6s) per scenario,
serially, with one AI call per scenario after it.

**Now fixed, and proven with a real browser** (`smoke/perf/real-browser-grounding.mjs`:
a real HTTP server, real HTML pages, real system Chromium, the real
orchestrator, and a real deterministic planner on the public extension
API — nothing mocked). The grounder launches **one shared browser per run**
(one isolated context per page, concurrent-safe, disposed by the
orchestrator), pages ground in parallel (concurrency 3), and the planner
contract gained `enrichUiActionsForScenarios` so **all grounded screens are
enriched in one AI call** — the orchestrator prefers it and falls back to
per-scenario calls for older planners. Measured: three pages grounded in
parallel in **839ms total including the launch**, a warm page in **135ms**,
the whole orchestrator grounding stage for three screens in **533ms**, with
exactly one batched enrich call — versus roughly 3 × (4–6s + one AI call)
before.

### 3.3 Data probes: serial, duplicated, and blind in preview

`probeListSources` awaits each probe in a `for` loop. Measured with a 300ms
route: 15 scenarios → **15 sequential GETs to the *same URL*
(`GET /api/orgs`) = 4.57s**; there is no dedupe by URL and no concurrency,
and each probe may wait up to 30s. Worse, host-config forces
`auth: none` in preview, and `probeAuthHeaders` then probes with *no*
credentials — against MALKOM's JWT-guarded routes every probe is a full
round-trip whose only possible outcome is HTTP 401 → `unknown`, plus one
warning per scenario in the plan.

### 3.4 Repo discovery: full TypeScript AST parse of every source file

Discovery reads and `ts.createSourceFile`-parses **every** `.ts/.tsx/.js/…`
file under `app.repoPath`, sequentially, up to `maxSourceFiles = 20,000`.
Measured on the malkom-command monorepo clone: 727 files / 6.4MB → **1.64s**;
a real developer workspace is many times larger. malkom-command points
`repoPath` at the whole monorepo, so ~500 of those files are the vendored
engines — including this engine's own reference apps and fixtures — parsed
to find MALKOM routes that the host already declares with confidence 1.0.
The host's `CachingDiscoverer` amortizes this for 5 minutes only.

### 3.5 First-click costs

`ensureChromium` in the bridge may run `npx playwright install chromium`
("one-time, a few minutes") inside the first generation's start, with only a
log line to show for it.

## 4. Compiler headroom (fine today, worth beefing up for scale)

`smoke/perf/compile-scaling-bench.mjs`, 15 scenarios × 3 actions:

| evidence operations | full compile |
|---|---|
| 12 | 22ms |
| 99 | 47ms |
| 300 | 116ms |
| 999 | 341ms |
| 3,000 | 1,082ms |

Linear (~0.36ms per operation for 15 scenarios) because `rankedCandidates`
scores every operation for every action — no verb/resource index. At an
OpenAPI-scale graph (thousands of operations) plus repair rounds this
becomes user-visible seconds.

Two structural findings in the same area:

- The semantic repair loop recompiles **all** scenarios each round
  (`planning.recompile-N` calls `compileIntentIncrementally` without
  `previous`/`affectedScenarioIds`), although the diagnostics name exactly
  which scenarios failed and the incremental machinery already exists.
- Even the incremental path pays a fixed combine cost — recompiling 1 of 15
  scenarios took 69ms vs 177ms for all 15, because
  `combineScenarioCompilations` recomputes selection decisions, cleanup
  safety records, workflow hashing, and full-plan invariants over every
  scenario every time.

## 5. The gap list

Ordered by measured impact on the times the user actually sees.

**Implementation status.** Since this document was first written, the engine
has shipped: the G1 engine half — every AI request now carries a `purpose`
label and a `maxOutputTokensHint` sized from the work actually requested
(outline ≈1.5k tokens instead of a host-wide ceiling; batches and repairs
scale with count), and the built-in provider caps `max_tokens` with the
hint; the G2 retry trim — a JSON-repair retry now embeds at most ~48KB of
the invalid answer (head and tail, with an exact omitted-count marker)
instead of up to 200KB, and the REG-0025 fix removed the dominant repair
trigger; all of G4 — planning-time data probes are deduplicated by
method+URL+headers and run at most four in flight, so fifteen checks
reading one collection make one request (measured: 15 requests → 1,
probe stage 4,569ms → 329ms at a 300ms route); and the G12 engine half —
per-call telemetry (`result.ai.records`) now records purpose, duration,
and prompt/response byte sizes for every call, on failed runs too. G3 is
shipped and real-browser-proven (see the corrected §3.2): one shared
browser per run, parallel page grounding, one batched enrichment call,
grounder disposal, and a new `runtime.browserExecutablePath` option
(env `BRISK_AITESTING_BROWSER_EXECUTABLE_PATH`) so locked-down hosts can
use a system-installed browser — which also let this sandbox run the real
browser suites instead of skipping them. Still open: host-side G1
(streaming, native structured-output modes), G5–G11, and the host display
halves of G12/G13.

### Tier 1 — the minutes

| id | gap | where | fix direction | expected win |
|---|---|---|---|---|
| G1 | Non-streamed completions, 32k `max_tokens` on every call, schema-in-prompt only, and no per-call latency record to attribute slowness | host `modules/ai/complete.ts`, provider settings | Stream; per-purpose token caps (outline ≤1k, batch/repair ≤4k — engine should pass a size hint per request); temperature ≈0 for structured output; native `json_schema`/tool-call modes where the vendor has them; measure the configured model’s structured-output speed and pick a fast one for intent writing (a thinking model, if ever configured, multiplies every wave) | 2–4× on every wave; fewer invalid-JSON retries |
| G2 | Every repair attempt is a full serial provider wave; batch retries re-embed up to 200KB of invalid output | engine `ai-intent-planner.ts` | Truncate retry context to the failing region + validation error; keep reducing repair *triggers* (the REG-0025 fix already removed the biggest one and gave repairs `candidateIntentActionIds` + full scenario context, so surviving repairs converge in one attempt) | one wave (~1–2min) saved per avoided attempt |
| G3 | Grounding spawns a `playwright test` subprocess + fresh Chromium per UI scenario, serially, each followed by its own AI enrich call, inside preview | engine `engines/playwright-grounder.ts`, `orchestrator.enrichUiActionsFromGrounding` | Reuse one `SharedBrowser` (the execution runtime already does); ground pages with modest parallelism; enrich all scenarios in **one** batched AI call; or defer grounding out of preview entirely and ground at execution time | from K×(5s+call) serial to ~1 call + parallel page loads; minutes for UI-heavy runs |

### Tier 2 — the seconds, and the scale traps

| id | gap | where | fix direction |
|---|---|---|---|
| G4 | Probes serial, zero dedupe (15 identical GETs measured), up to 30s each, and run credential-less in preview against routes that can only 401 | engine `fixture-sourcing.ts` (`probeListSources`, `probeAuthHeaders`), host-config preview auth | Dedupe by method+URL+query; small concurrency pool; skip probing when the evidence itself declares the route auth-guarded (MALKOM's `reject-anonymous` contract proves the 401) or when preview has no credentials; share one verdict across scenarios |
| G5 | Discovery TS-parses every repo file sequentially; monorepo hosts pay for vendored engines and reference apps | engine `discovery.ts`; host `repoPath` | Cheap substring pre-filter before AST parse (only files containing route-ish tokens: `/api/`, `Router(`, `@Controller`, HTTP verbs — most files never reach the parser); parallel read/parse pool; persistent cache keyed by path+mtime+size; config ignore-globs; malkom-command: point `repoPath` at `apps/` instead of the workspace root |
| G6 | First generation may silently include a multi-minute Chromium download | host `bridge.ensureChromium` | Surface as an explicit progress phase; pre-install at server start when UI testing is enabled |

### Tier 3 — compiler beef-ups for larger evidence graphs

| id | gap | where | fix direction |
|---|---|---|---|
| G7 | Candidate scoring is O(scenarios × actions × operations); 1.1s at 3k ops | engine `semantic-compiler.ts` (`rankedCandidates`) | Index operations by canonical verb + resource tokens once per compile; score only the bucket |
| G8 | Repair loop recompiles all scenarios; combine step recomputes decisions/safety/invariants/hash for every scenario every round | engine `semantic-planner.ts` (repair loop), `incremental-compilation.ts` (`combineScenarioCompilations`) | Pass `previous` + diagnosed `affectedScenarioIds` into `planning.recompile-N`; memoize per-scenario selection/cleanup records and workflow-invariant results by scenario digest |
| G9 | Full re-lowering after fixture recompile (`planning.lower-fixtures`) | engine `semantic-planner.ts` | Lower only the affected scenarios and merge |
| G10 | Evidence digests (`evidenceGraphDigest`) recomputed per decision record | engine `evidence-graph.ts` | Cache digest by graph revision |

### Tier 4 — observability (why this took a debugging session to see)

| id | gap | where | fix direction |
|---|---|---|---|
| G11 | On failure, all stage timings are discarded: the run record carries only the diagnostic text, never "where the 364.8s went" | engine `SemanticCompilationError`/result path; host `service.generateTests` throw path | Attach `timings` and the per-AI-call table to the error result and to `ai_test_runs.aiMetadata`; render in the failure UI |
| G12 | No per-AI-call telemetry (schema name, duration, input/output tokens, retries) | host `MalkomAiProviderBridge` (records prompts but not durations); engine `AiUsageTracker` | Record duration + retry count per call; show a call table in the progress page |
| G13 | Parallel write waves report progress, but the UI shows only the latest phase line, hiding stalls (one slow batch looks like a hang) | host progress page | Show the wave table with per-piece elapsed time |

## 6. Split of responsibility

Engine (this repo): G2, G3, G4, G5 (pre-filter/parallelism/cache), G7–G11
(engine side), plus per-purpose token hints on `AiPlannerProviderRequest` so
hosts can cap output sizes correctly (G1's engine half).

malkom-command host: G1 (streaming, token caps, model choice, structured
output modes), G5 (narrow `repoPath`), G6, G11–G13 (surface what the engine
reports).

## 7. Reproducing these measurements

```
# stage timing, instant AI, no repo scan
node smoke/perf/generation-perf-harness.mjs 15 0 0 none baseline

# serial-wave structure (3s per AI call)
node smoke/perf/generation-perf-harness.mjs 15 3000 0 none waves

# failing-planning shape (adds repair waves)
node smoke/perf/generation-perf-harness.mjs 15 3000 0 none fail-shape fail

# probe serialization (300ms per HTTP round-trip)
node smoke/perf/generation-perf-harness.mjs 15 0 300 none probes

# repo discovery cost (point at any workspace)
node smoke/perf/generation-perf-harness.mjs 15 0 0 /path/to/workspace repo

# compiler scaling
node smoke/perf/compile-scaling-bench.mjs
```

The harness prints total wall time, the engine's own per-stage timings, every
AI call (schema, latency, prompt size), every HTTP request by route, and the
phase event stream with offsets.
