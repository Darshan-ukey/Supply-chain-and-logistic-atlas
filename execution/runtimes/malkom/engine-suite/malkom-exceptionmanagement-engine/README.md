# Malkom — Exception Management Engine

**Status: proposed. No code yet — this folder holds the architecture that decides what gets built.**

An exception is not a status. It is a timed transfer of obligation between two parties, and it is
not finished when the second party answers — it is finished when the first party accepts.

An offshore processor cannot complete an invoice because the work order was never updated. She
raises a query; onshore updates it and answers; she applies the answer and closes. Two people, two
obligations, two deadlines. A ticket records one duration and gives it one name, which is why
cross-team SLA reporting is so widely distrusted. This engine records both, and can prove which
party held the clock at any instant.

```
age = ownedMinutes(originator) + ownedMinutes(resolver) + pausedMinutes
```

Every term names a party and a reason. No term is a residual.

## What exists today

`@malkom/exception-core` — the baton ledger and the aggregate around it, built and
tested. 42 tests over four files, `npm test`.

| Module | What it is |
| --- | --- |
| `calendar.ts` | Business time per party, zero dependencies. `Intl` supplies the zone and DST history; the engine walks local working windows. Swapped for the process-metrics engine's versioned calendars through `CalendarProvider` in a MALKOM deployment. |
| `ledger.ts` | Segments, accrual, and the two invariants as callable assertions. Elapsed time is derived on read, never stored, so a replay and a restart agree. |
| `schemas.ts` | Zod as the single source of truth — commands, events, reason contracts, nullable budgets, the configured noun vocabulary. |
| `engine.ts` | Command in, one event and one projection out. Idempotency keys, optimistic versioning, `applyOnAccept`, bounded pauses. |
| `engine.ts` (reads) | `list` / `count` / `desk` / `facts` / `deflectionCandidate` — the resolver desk, the raiser's list, the breach list, and the row the metrics registry consumes. |
| `store.ts` | `HandoverStore` port, in-memory and SQLite (`node:sqlite`, WAL) implementations. |
| `catalogue.ts` | One catalogue for forty offices: a base definition plus scoped variants, resolved general-to-specific with an audit trail of what applied. |
| `router.ts` | `buildFetchHandler` — the `/v1` control plane the MALKOM runtime bridges behind its own JWT. |

## How the list is built for each country, region and office

Not forty lists. **One definition per reason**, carrying a base and any number of
scoped variants:

```
COST_APPROVAL                       respond 240m → onshore.ap.GLOBAL
  where region=EMEA                 respond 960m → onshore.ap.EMEA
  where office=USHOU                respond 240m
  where country=DE                  enabled: false
  where country=FR                  asks: [tvaNumber]
```

Resolution walks general to specific — base, region, country, office — and each
matching variant overrides only the fields it names. Specificity is the count of
pinned scope fields, ties broken by declaration order: the same rule the MALKOM
runtime already applies to routing overrides, on purpose, so an administrator who
has learned one has learned both.

That buys the thing forty copies cannot. Change the base window and every office
without its own variant follows, in one edit to one document:

```
base 480 → 600m
before: USHOU 240m · NLRTM 960m · SGSIN 480m · USDAL 480m
after:  USHOU 240m · NLRTM 960m · SGSIN 600m · USDAL 600m
```

**The scope is the WORK's, never the viewer's.** A processor in Kolkata handling a
Houston invoice must see Houston's list, Houston's destination and Houston's clock.
Who may raise what is a different question — that is authorization, and it belongs
to the host's `Authorizer`. Conflating the two shows people the wrong questions and
hides the right ones.

Every event carries the resolution it was governed by, so a case can still be
explained after the catalogue has moved on:

```
COST_APPROVAL@v1 resolved [base → office=USHOU] for {"country":"US","office":"USHOU","queue":"AP"}
```

## Ask it the questions before believing it

`node examples/interrogate.mjs` seeds a week of handovers and puts eighteen real
operational questions to the engine — the ones the raiser, the resolving desk, the
lead and the auditor actually ask. Every question either gets a real answer from a
real call or is recorded as one the engine cannot answer.

The first run scored **6 answered, 1 partial, 11 unanswerable**, and the pattern was
exact: the engine answered everything about one handover whose id you already held,
and nothing at all about a set of them. No desk, no breach list, no "what am I
waiting on", nothing for a metrics engine to read. A ledger you cannot look across is
an archive. That run is what the query surface, the facts feed and the deflection
index were built for; it now scores 18 of 18.

Two of those eighteen only passed after a second look, which is the harness earning
its keep. Deflection was keyed on `clusterBy` — a value derived from the *answer*, so
finding a known answer required already knowing it. It is now keyed on `deflectOn`,
a tuple of fields the raiser has in hand before anything is created. And "how much of
our ageing is paused" was answerable only as a total; the reason it was paused for is
the half a lead can act on, so facts now carry `pausedByReason`.

The tests are the argument, not the documentation:

- `engine.test.ts` walks the worked handover and asserts **6h10 resolver, 3h50 originator,
  1h40 paused against an age of 11h40** — the age identity with no residual.
- Invariant 1 is tested by a resolver trying to accept and being refused.
- Invariant 2 is a seeded property test: forty random command walks, and no party total
  ever decreases. An illegal move is a refusal, never a rewound clock.
- Reassign and reroute are tested to *keep* the responding side's clock running.
- `calendar.test.ts` proves the Kolkata/Houston pair has **zero** business-hour overlap
  on the default shift and ninety minutes once offshore moves to 12:00–21:00.

Still to build: the CLI, the engine adapters (rules, allocation, workflow, metrics),
the escalation sweep, and the runtime surface.

## The design

[`docs/ARCHITECTURE.html`](docs/ARCHITECTURE.html) — twenty sections in four parts, with four
diagrams. Open it in a browser.

| Part | Covers |
| --- | --- |
| I · The thesis | What an exception is; twelve things `TaskQuery` cannot do; the word "exception" is already taken in malkom-runtime |
| II · The protocol | The baton and the two clocks; two calendars; closure asymmetry; commands and events; reasons as contracts; deflect/cluster/dedupe; escalation and the bounded pause |
| III · Composition | How rules, allocation, workflow, metrics and quality already do most of this; ports; governance; the eleven metrics |
| IV · In the product | Raising from a field on a case; seeing every query on a transaction; the same protocol invented eight times; the one industry convention to refuse; migration; shape, effort, sequence; twelve decisions |

## Not an accounts-payable tool

The offshore/onshore invoice query is the worked example, not the source. The same structure — a
named question against a shared object, owed by a counterparty, with a deadline on the answer and on
what happens after it — was arrived at independently by construction (Procore's RFI carries a literal
*Ball in Court* field that shifts on response), clinical data management, legal discovery, trade
finance, healthcare referrals, peer review and customs. Section 17 sets out all eight, what varies
between them, and why each variation is a configuration axis rather than a fork: how many legs carry
a budget, which direction the question travels, how many parties sit on the responding side, and how
long the auto-accept window is.

Section 18 covers the one near-universal convention the design refuses. Every service-desk platform
pauses the SLA clock while waiting on the requester. That is not a measurement of the counterparty's
time — it is the absence of one. This engine starts their clock instead, and reserves pause for the
single honest case: a party outside the system holds the work and neither internal party owes
anything.

## Two invariants worth failing a build over

1. No command may set `holder = NONE` except `accept`, `withdraw` and `auto-accept`. If the resolver
   can reach a terminal state, you have rebuilt a ticket.
2. No command may reset or reduce `accrued[party]`. Clocks are monotonic. Reassignment *inside* a
   party never resets that party's clock.

Every workaround anyone has built to make an SLA look better lands on one of those two lines.

## House rules it follows

Same shape as its siblings in this repository: a hexagonal core behind ports, zod schemas as the one
source of truth, engine state in `node:sqlite`, a REST control plane mirrored 1:1 by a CLI that is a
pure client of it, and **decisions owned, host data never written**. Composition over reimplementation —
routing goes through `@malkom/rules-core` so a change is backtested against real history before it
governs work; the resolver desk is an allocation queue; calendars come from `@malkom/metrics-core`.

Build order is stated in the architecture and matters: the baton ledger and its two invariants come
first, before any screen.
