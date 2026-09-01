# 📊 Malkom Process Metrics & KPI Engine

> **"The engine owns metrics and decisions — never your data."**

A generic, metadata-aware engine for process metrics and KPIs. You describe *what a metric means*, the engine computes it — over the exact time windows, business calendars and targets you define — and returns a value with a full explanation of how it got there.

---

## ✨ What is it? (in plain words)

You want answers like: *"How many claims did we close this week?"*, *"What's our SLA attainment % this month?"*, *"Is turnaround time breaching its target?"*

This engine does that **declaratively**:

- 📐 You define **metrics** in config — what to count, over what window, against what target
- 🗓️ You define **calendars** — business days, timezones, holidays — so "this week" means *your* week
- 🧮 The engine **computes** values over your real data (read-only)
- 🧾 Every result comes with a **trace** — how many rows fed it, what got excluded, why
- 🎯 Results carry a **status**: `attained` · `warn` · `breach` · `no_data`

It reads from **your** database and never writes to it.

---

## 🚀 What you get

| | Capability | What it means for you |
|---|---|---|
| 📐 | **Metadata-aware metrics** | Define once in config — fields map to your columns, not hardcoded |
| 🗓️ | **Business time** | Calendars, weekdays, timezones, DST handled for you |
| 🪟 | **Flexible windows** | Day / week / month / quarter — or rolling `30d`, `4h` |
| 🧮 | **Rich math** | count, sum, avg, min, max + percentiles `p50`–`p99` |
| 🎯 | **Targets & thresholds** | `attained` / `warn` / `breach` — know at a glance if you're on track |
| 🧾 | **Replayable traces** | Same inputs → same values, forever. Explainable results |
| 🔌 | **Backend-agnostic** | SQLite / Postgres / MySQL fact fetching, or your own fact source |

---

## 🧱 How it works (4 steps)

| Step | Action | Example |
|---|---|---|
| 1️⃣ | **Register entities** | "the `booking` table exists; `status` is a string field" |
| 2️⃣ | **Define metrics + calendars** | "SLA attainment = % of bookings where `delivered_on ≤ target` this month" |
| 3️⃣ | **Assign scope** | "this metric applies to the `freight` team, with a tighter target" |
| 4️⃣ | **Calculate or backtest** | get the value + trace, or dry-run against historical rows |

---

## 📦 Packages at a glance

| Package | What it is | Use it for |
|---|---|---|
| `@malkom/metrics-core` | The engine (library) | Embed metrics in your app |

> ⚙️ Requires **Node ≥ 22.5**. Zero runtime deps in the calculation core.
>
> 🚧 **Status:** calculation core is complete (M0–M3). The engine facade + REST/CLI shells land in M4+ — for now you embed the library directly.

---

## 🧩 Key concepts (no jargon)

| Concept | In one line |
|---|---|
| **Registry** | The dictionary of *what exists* (entities, fields, allowed values) |
| **Metric definition** | What to compute: aggregation, window, target, thresholds |
| **Calendar** | Business time — working days, timezone, holidays |
| **Assignment** | Which metric runs for whom, with optional target overrides |
| **Window** | The time slice a metric is computed over |
| **Status** | `attained` · `warn` · `breach` · `no_data` — is it on track? |
| **Trace** | The receipt showing exactly how a value was computed |

---

## 🚀 Quick start (library)

```ts
import {
  InMemoryMetricsStateStore, MemoryFactSource,
  calculateMetric, compileMetric, resolveWindow,
} from '@malkom/metrics-core';

// 1. Define a metric
const definition = {
  id: 'sla-attainment',
  name: 'SLA attainment',
  kind: 'kpi',
  metricType: 'percent',
  window: { kind: 'month', alignment: 'utc' },
  aggregate: { agg: 'count', where: { op: 'eq', field: 'status', value: 'closed_on_time' } },
  target: { value: 90, direction: 'gte', thresholdWarn: 80 },
};

// 2. Compute it
const result = calculateMetric({
  definition,
  facts: { rows: [...] },          // or a FactSourcePort / SQL fetch
  nowIso: new Date().toISOString(),
});

// 3. Read the result + its trace
console.log(result.value, result.status); // e.g. 92.4, 'attained'
console.log(result.trace);                // how many rows, what was excluded…
```

---

## 📚 Learn more

| Doc | What's inside |
|---|---|
| [Architecture](./ARCHITECTURE.md) | The full picture — diagram, calculation pipeline, ports, state |
