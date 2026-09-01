# Roadmap

What is built, what is deliberately not, and what comes next. Kept here rather
than in an issue tracker because the reasoning matters as much as the list — a
deferred capability with no recorded reason gets rebuilt from scratch by
whoever picks it up next.

## Shipped

Eight of the nine mining capabilities, validated against BPI Challenge 2012
(262,200 events) and against a live Postgres host.

| Capability | Notes |
| --- | --- |
| Discovery | Directly-follows graph, Inductive Miner, BPMN + PNML export |
| Variants | Ranked routes, with how many cover 80% of cases |
| Performance | Waiting vs handling, bottlenecks ranked by total contribution |
| Organizational | Handovers, workload, specialisation, key-person risk |
| Conformance | Fitness **and** precision — never one alone |
| Comparative | Mann–Whitney, Cliff's delta, Benjamini–Hochberg |
| Root cause | Single factors and pairs, with a margin guard on pairs |
| Action-oriented | Signals: three thresholds and one mined path-risk trigger |
| Rework | Repetition, self-loops and revisits counted separately |
| Case explorer | A keyset-paged list, and one case step by step with its waits |
| Dependency strength | Per-arc: a real ordering, a coincidence, or an alternation |
| Footprint | Ordering relations as a grid, and the diff between two logs |
| Map simplification | Two answers: hide the quiet steps and bridge through them, or collapse them into openable boxes |
| Working-hours clock | Every duration measurable in working time: zones, hours, days and closed dates |
| Alignments | Where a trace departs from the model, move by move — a deviation with a place |
| Trace clustering | A long variant tail collapsed into behaviours, each carrying a filter |
| Seasonality | Weekday x hour and calendar grids, queue formation by hour, rosters |
| Flow | Work in progress by stage, Little's law as a log check, open-case aging |
| Trends | Any metric over time with process behaviour limits; conformance as a line |
| Distributions | One grouped service: box, violin, ridgeline, trace lengths |
| Grids and spectra | Repeat counts, who-can-do-what, queue discipline, slow-against-complex |
| Route shapes | Prefix tree, segment-route-outcome flow, trace fingerprints, delta map |
| Risk | Work in flight ranked by how its route has historically ended |

Plus: a universal case filter, layout with cost/volume/delay as separate
channels, replay, a stream registry with incremental coverage, host schema
discovery with binding suggestions, offline CSV/XES import, and a
framework-agnostic HTTP router.

### On measuring in working hours

Wall-clock is the wrong unit for most of what this engine reports. A handover
at five on Friday shows a sixty-two hour wait and outranks a genuine bottleneck
costing four hours every day of the week — nobody was slow over the weekend,
the office was shut.

`calendar.ts` converts an instant into working seconds elapsed since a fixed
origin Monday, and `buildLog` emits that as one column per event. Every
duration downstream is then a subtraction of two of those numbers rather than
its own calendar calculation: one place to be right, and no analysis can
quietly use a different clock from its neighbour. With no calendar configured
the column holds the epoch second, so every existing figure is unchanged to the
bit — which is what makes the rest of the suite the regression net for it.

The calculation exists twice, in TypeScript and in SQL, because `now` is a
scalar and an event stamp is a column. That is the risk worth guarding: a
transcription error between the two does not fail, it produces a number that
looks like a duration and is wrong one day in seven. The test runs both over
the same instants across four calendars and compares.

Off by default and stated on every result. It changes figures the product
already reports, and a bottleneck ranking that re-orders itself unbidden is not
an improvement.

### On a second discovery algorithm

The Inductive Miner stays the default, because soundness is the guarantee that
makes replay, animation and conformance possible at all. Its weakness is
vagueness — over-generalisation on a messy log, a flower model where no cut can
be justified — and until now a low precision score left a caller with nothing to
try.

`heuristics.ts` is the first half of the answer, and deliberately not a second
miner: it annotates the map the Inductive Miner already produced with the
Heuristics Miner's dependency measure, so the soundness guarantee is untouched
while the map stops implying cause between two activities that merely co-occur.
Split Miner is the second half and is not built. It earns its place only where
the soundness guarantee costs too much precision to be worth keeping, and it
should be reported beside the Inductive Miner with both scores shown rather than
offered as a choice nobody can make blind.

Alpha and ILP are not planned. Alpha's ordering-relation table is worth having
and is built (`footprint.ts`); the algorithm around it handles no noise, breaks
on short loops, and emits models that can deadlock. ILP needs an LP solver for
models that are usually unreadable.

## Phase 2

### Scheduled jobs

`jobs/queue.ts` already defines the BullMQ queue, the job kinds, the routing
and the concurrency rules — including the one that matters, that refresh runs
one at a time because DuckDB permits a single writer. What does not exist is a
worker consuming the schedules a host has configured.

The host currently stores a cron expression and nothing reads it. Refresh and
signal evaluation work on demand and through the API, so nothing is broken;
they simply do not happen on their own.

Remaining work is wiring, not design: start a worker from the host's
composition root, register the configured schedules through
`upsertJobScheduler`, and hand firings to the `SignalSink` the host supplies.
Test that re-registering on boot updates the existing schedule rather than
stacking a second one beside it — the classic way a nightly job silently
becomes an hourly one.

### Predictive

How long has this case left, will it breach, will it end badly. Both reference
products ship it, so its absence is a gap rather than a choice about scope.

The approach is settled and the reasoning should not be relitigated:

- **The engine computes the closed-form estimates itself.** Kaplan–Meier
  remaining time and outcome probability from the variant set. There is no
  battle-tested JavaScript survival-analysis library — the one npm package
  gets around 47 downloads a month and was last touched in 2022 — so this is
  written here, validated against published reference values, exactly as the
  Mann–Whitney implementation was.
- **Anything heavier is trained elsewhere and scored here** through
  `onnxruntime-node`. The serious tooling (lifelines, scikit-survival,
  XGBoost) is Python, ONNX is an open format, and a model that arrives as a
  file is swappable without touching this package. Rejected:
  `ml-random-forest` and `ml-xgboost`, both untouched since 2022.

Whatever is built must keep the rule the signals work already follows: an
estimate says whether it is **mined** or a **threshold**, and it is evaluated
strictly as of an instant so no event that has not happened yet can leak
backwards and flatter it.

### Simulation

What-if scenarios: add a person, remove a step, change a rule, and compare
against reality using the comparison machinery that already exists.

Cheaper than it looks. The engine already mines every input a discrete-event
simulator needs — the map, the branching probabilities, the duration
distributions, the resource capacities and now cost. Only the runner that
steps through them is missing.

### Still open, and why

**Compliance rules** — four-eyes, segregation of duties, mandatory precedence.
Deferred rather than dismissed: the checks themselves are straightforward SQL
over the log this engine already projects, and the alignment work just shipped
supplies the harder half, which is saying *where* a rule was broken rather than
that it was. What is missing is the rule language, and that is the part worth
getting right rather than guessing at — an auditor arrives with a specific set
of rules, and a schema invented before meeting one will be wrong in ways that
are expensive to change later.

**Split Miner** — a second discovery algorithm. The position in the section
below has not changed: it earns its place only where the Inductive Miner's
soundness guarantee costs too much precision to be worth keeping, and it should
be reported beside it with both scores shown rather than offered as a choice
nobody can make blind. `heuristics.ts` and `footprint.ts` already deliver most
of what a second miner would have been asked for.

## Not this engine's job

Recorded so it stops being re-proposed.

- **Editing process models.** A canvas, an undo stack and somewhere to save.
  None of that is mining. The engine discovers a model and exports it in a
  standard format; editing belongs to the client plane.
- **KPI and KCI definitions.** The processmetrics engine owns targets,
  thresholds and calendars. Duplicating them here would give the platform two
  answers to "what is the SLA". `reconcileTargets` is the bridge: mining
  measures reality, metrics holds the target, and the disagreement is the
  finding.
- **A peer range for `@duckdb/node-api`.** It cannot be written. Every version
  that package publishes carries a prerelease tag, and semver matches a
  prerelease only against a comparator sharing its exact `major.minor.patch` —
  so no forward-compatible range exists, and the one that was there broke
  `npm install` for every consumer with `ETARGET`. The requirement is enforced
  in `createDuckDBClient`, which checks for the API it calls when it loads the
  driver. If upstream ever ships a stable release, this can be revisited; until
  then, adding the peer back reintroduces the bug and
  `test/packaging.test.ts` will fail.

- **Task mining.** Desktop capture is a different collector, a different
  consent conversation and a different storage problem. Once captured it
  becomes an event log like any other and this engine mines it unchanged. The
  gap is capture, not analysis.
