# 🎯 Malkom Work Allocation Engine

> **"The engine owns decisions — never data."**

A generic, metadata-driven work allocation engine. It reads your work items and your users from **your** tables, matches them by rules you declare, and assigns work safely — with an audit trail for every single decision.

---

## ✨ What is it? (in plain words)

You have a queue of work (claims, tickets, shipments) and a pool of people who can do it. This engine does the **"who gets what"** thinking for you:

- 📥 Reads from **your** DB (SQLite / Postgres / MySQL) — no copying, no mirroring
- 🧑‍🤝‍🧑 Knows who is **eligible** for what (skills, capacity, presence)
- 🎯 Picks a person using a strategy you choose (FIFO, round-robin, least-busy…)
- 🔒 Assigns **safely** — even when many instances run at once, no double-assignment
- 🧾 **Audits everything** — who got what, why, under which config

You configure it **declaratively** (JSON), run it, and get a clean REST API + CLI on top.

---

## 🚀 What you get

| | Capability | What it means for you |
|---|---|---|
| 🗄️ | **Backend-agnostic** | Your tables, your schema. SQLite / Postgres / MySQL out of the box |
| 🧑‍💼 | **Eligibility rules** | Matching rules = who *may* take an item (skills, attributes, capacity) |
| 🎲 | **Strategy picker** | `fifo` · `round_robin` · `least_active` · or your own |
| 🔒 | **Concurrency-safe** | Guarded `UPDATE … WHERE assignee IS NULL` — losing a race is normal, never corrupt |
| ⏰ | **Scheduler built-in** | Per-queue cron, timezone-aware, pause/resume |
| 🧾 | **Audit by default** | Every run persisted; retention policies included |
| 📈 | **Observable** | Prometheus metrics + a **starvation alarm** for old unassigned items |

---

## 🧱 How it works (5 steps)

| Step | Action | Example |
|---|---|---|
| 1️⃣ | **Register connections** | point the engine at your DB |
| 2️⃣ | **Describe the work table** | "this table is `claims`, assignee is `owner_id`, only `status=NEW` is assignable" |
| 3️⃣ | **Describe the workers** | "agents table, only `presence=AVAILABLE`, capacity = `max_open`" |
| 4️⃣ | **Set matching + strategy + schedule** | "claims with `line` → agents with matching `skills`; least-active; every 5 min" |
| 5️⃣ | **Run** | scheduler runs it automatically, or trigger a run manually |

---

## 📦 Packages at a glance

| Package | What it is | Use it for |
|---|---|---|
| `@malkom/alloc-core` | The engine itself (library) | Embed allocation in your app |
| `@malkom/alloc-server` | REST control plane | Manage queues over HTTP |
| `@malkom/alloc-cli` | Ops CLI (pure REST client) | Script/automate queue ops |

> ⚙️ Requires **Node ≥ 22.5**. Two runtime deps only: `zod` + `croner`. No Redis, no broker.

---

## 🧩 Key concepts (no jargon)

| Concept | In one line |
|---|---|
| **Queue** | One work table + its workers, matching, strategy and schedule |
| **Work item** | A row in your table waiting to be assigned |
| **Eligibility** | The rules that say who *may* take an item |
| **Strategy** | The rule that says who *does* (FIFO, round-robin, least-active…) |
| **Lease** | A "this instance owns this queue right now" ticket with a fencing token |
| **Audit record** | A permanent log of every assignment decision |
| **workEvents** | An optional ready-made work table convention (not a requirement) |

---

## 🚀 Quick start (embedded)

```ts
import { AllocationEngine, SqliteStateStore, SqliteSqlClient } from '@malkom/alloc-core';

const engine = new AllocationEngine({ stateStore: new SqliteStateStore('./state.db') });
engine.connections.registerClient('crm', 'sqlite', new SqliteSqlClient('./crm.db'));
await engine.start();

await engine.upsertQueue({
  id: 'q-claims',
  name: 'Insurance claims',
  work: {
    connectionRef: 'crm',
    table: { name: 'claims' },
    fields: { id: 'claim_id', assignee: 'owner_id', state: 'status', createdAt: 'created_at' },
    allocatableWhen: { op: 'in', column: 'status', values: ['NEW'] },
    ordering: [{ column: 'created_at', dir: 'asc' }],
  },
  workers: {
    connectionRef: 'crm',
    table: { name: 'agents' },
    fields: { id: 'agent_id', eligibleWhen: { op: 'eq', column: 'presence', value: 'AVAILABLE' } },
  },
  strategy: { kind: 'least_active' },
  schedule: { trigger: { kind: 'cron', expr: '*/5 * * * *', tz: 'America/Chicago' } },
});

// Scheduler runs it — or trigger manually:
await engine.runQueue('q-claims', 'manual', false);
```

---

## 📚 Learn more

| Doc | What's inside |
|---|---|
| [Architecture](./ARCHITECTURE.md) | The full picture — diagram, run pipeline, scheduler, control plane |
| [Frontend Guide](./FRONTEND-GUIDE.md) | Building UIs on top of the engine |
| `README.md` (engine root) | Full API walkthrough, server + CLI usage |
