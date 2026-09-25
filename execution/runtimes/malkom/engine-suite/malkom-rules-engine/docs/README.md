# 🧭 Malkom Rules Engine

> **"The engine owns rules and decisions — never your data."**

A generic, metadata-aware business rules engine for queues and sub-queues. You tell it *what your data means*, it tells you *what rules apply* — and your app decides what to do with the answer.

---

## ✨ What is it? (in plain words)

Every business has rules: *"USD only on this route"*, *"confirm before shipping"*, *"reject if amount > limit"*.

This engine lets you write those rules **once, in config** — not scattered across code — and then:

- 🧾 **Validate** them before they go live
- 🧪 **Backtest** them against real data
- ✅ **Activate** them through a proper approval flow
- ⚡ **Evaluate** them on every row, with a full explanation of *why*

It never writes to your tables. It returns **verdicts + patches + effects** — your app executes them.

---

## 🚀 What you get

| | Capability | What it means for you |
|---|---|---|
| 📝 | **Metadata-aware** | Rules are written against a *registry* (entities + fields), not raw DB columns |
| 🧪 | **Evidence before activation** | Shape checks → cross-reference checks → live schema checks → backtests |
| 🛡️ | **Safe lifecycle** | `draft → pending → active → retired` — every transition is logged with who did it |
| 🧠 | **Explainable evaluation** | Every verdict comes with a full trace: which rule fired, why |
| 🔍 | **Decision log** | Every evaluation recorded — replay any point in time, audit-ready |
| 🪶 | **Tiny footprint** | One runtime dependency (`zod`), state in SQLite, no broker, no framework |

---

## 🧱 How it works (4 steps)

| Step | Action | Example |
|---|---|---|
| 1️⃣ | **Declare the registry** — the vocabulary rules are written in | `booking` has fields `shipperParty`, `portOfDischarge`, `currency`, `status` |
| 2️⃣ | **Author rule groups** — stored as drafts | *"Shipper A — USD corridors"* |
| 3️⃣ | **Validate → backtest → activate** | evidence first, then go live |
| 4️⃣ | **Evaluate rows** | `apply()` returns verdicts, patches & effects for **your** app to run |

---

## 📦 Packages at a glance

| Package | What it is | Use it for |
|---|---|---|
| `@malkom/rules-core` | The engine itself (library) | Embed rules in your app |
| `@malkom/rules-server` | REST control plane | Manage rules over HTTP |
| `@malkom/rules-cli` | Ops CLI (pure REST client) | Script/automate rule ops |

> ⚙️ Requires **Node ≥ 22.5** (uses built-in `node:sqlite`).

---

## 🧩 Key concepts (no jargon)

| Concept | In one line |
|---|---|
| **Registry** | The dictionary of *what exists* (entities, fields, allowed values) |
| **Rule group** | A named set of rules for one entity, with a scope |
| **Lifecycle** | The approval flow a group passes through before it runs |
| **Verdict / Patch / Effect** | What the engine *says* — your app decides what to *do* |
| **Decision log** | The audit trail of every evaluation, forever replayable |
| **Backtest** | Dry-run a rule against real rows before going live |

---

## 🚀 Quick start (embedded)

```ts
import { RulesEngine, SqliteRulesStateStore } from '@malkom/rules-core';

const engine = new RulesEngine({ stateStore: new SqliteRulesStateStore('./rules.db') });
await engine.start();

// 1. Registry — the vocabulary
await engine.applyRegistry({
  entities: [{
    id: 'booking',
    subQueueField: 'status',
    fields: [
      { id: 'shipperParty', type: 'string' },
      { id: 'portOfDischarge', type: 'string' },
      { id: 'currency', type: 'string' },
      { id: 'status', type: 'string', values: ['new', 'confirmed'] },
    ],
  }],
});

// 2. Author a group (draft)
const head = await engine.createGroup({ name: 'USD corridors', entity: 'booking', rules: [] }, { actor: 'money' });

// 3. Evidence → activate
await engine.validateGroup(head.id);
await engine.submit(head.id, { actor: 'money' });
await engine.activate(head.id, { actor: 'priya' });

// 4. Evaluate — verdicts come back, YOU execute them
const verdict = await engine.apply('booking', bookingRow);
```

---

## 📚 Learn more

| Doc | What's inside |
|---|---|
| [Architecture](./ARCHITECTURE.md) | The full picture — diagram, pipeline, state, control plane |
| `README.md` (engine root) | Full API walkthrough, server + CLI usage |
