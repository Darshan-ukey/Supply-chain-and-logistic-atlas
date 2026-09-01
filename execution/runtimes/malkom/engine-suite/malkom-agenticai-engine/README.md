# Malkom Agentic AI engine

Agents are autonomous. An agent gets a goal. It does not get a list of steps.

The agent looks at the case. It decides its own steps for that case. It decides
which tools to use, in which order, and how many times. Two identical cases can
be handled in two different ways by the same agent — that is normal and
correct. If the steps are fixed before the run starts, it is not an agent, it
is a workflow, and we do not ship workflows and call them agents.

We define four things about an agent, and they are all limits, not steps:

- **its goal** — what a finished case looks like
- **what it may access** — which data fields and which tools
- **what it may spend** — time and money limits per run
- **the four ways it can finish** — done, question, handover, parked

## The engine is the definition centre — and nothing else

The engine defines what an agent is and how it runs. It knows nothing about
which model, whose key, or where it is deployed. It ships no UI. A front end
— Malkom's or anyone's, in any framework — **complies to** the engine; the
engine never depends on a front end.

The litmus that keeps the boundary honest: *would a team on Vue, or Python,
or a CLI with no screen at all, still want this exact package?* Everything in
it passes that test. Framework-specific rendering does not, so it lives in the
host, not here.

| part | what it does | used by |
|---|---|---|
| `contract` | the manifest format, the run events, the connection, the access pass, the four endings — **and the framework-free presentation definitions** the UI renders from (the plain-language timeline, the pipeline graph). Small. Fixed early. | both |
| `runner` | runs pipelines and agents: retries, timeouts, resume, park, spend limits. Exposes one seam — `HostIntegration` — the host implements to supply a provider, tools, an event sink and adapters. | runtime |
| `gateway` | the MCP gateway — tools generated from org config, passes checked, every call recorded | runtime |
| `adapters` | one per framework (TypeScript now; LangGraph and Camunda come with the adapter stage). Also home to the sandbox stand-in model, so the engine runs with no AI key without a model living in its core. | both |
| `studio` | building agents: templates, versions, the canvas checks, the sandbox behind the run button. Framework-free — no model, no React. | Command |

```
@malkom/agenticai-contract   zod schemas + pure functions (incl. presentation), no server, no UI
@malkom/agenticai-gateway    the gateway + MCP transport over it
@malkom/agenticai-adapters   the TypeScript adapter + the sandbox stand-in model, on the Vercel AI SDK
@malkom/agenticai-runner     the runner + the pipeline + the HostIntegration seam + engine-produced telemetry
@malkom/agenticai-studio     templates, versions, canvas checks, the sandbox — framework-free
```

The shared UI components (the canvas, the run timeline) are **not** in the
engine. They live on the host side and render from the contract's presentation
definitions, so command and runtime show the same diagram and the same
timeline without the engine ever importing a rendering framework.

## The host integration seam

The one interface a host implements to run agents. The engine resolves
everything it needs to touch the world through it, and learns nothing else:

```ts
import { runAgent, runPipeline, type HostIntegration } from "@malkom/agenticai-runner";

const host: HostIntegration = {
  provider(agent) { /* the org's AI provider — an opaque model handle + prices */ },
  tools(manifest) { /* the gateway tools, generated from this org's config */ },
  keep(event)     { /* write the run event, before the next step starts */ },
  adapters,       /* the framework adapters installed here */
};

await runPipeline({ pack, caseRecord }, host);   // a whole pack
await runAgent({ manifest, caseRecord }, host);  // one agent
```

## The manifest

One small file that states: the agent's goal, its queue, which fields it reads
and writes, its tools, its rules, its limits, its telemetry settings. Limits
only — never steps.

```ts
import { parseManifest } from "@malkom/agenticai-contract";

const result = parseManifest(json);
if (!result.ok) console.error(result.problems);
```

- **Input** — which task fields the agent may read; these point at the org's
  existing field schemas, nothing new is invented.
- **Output** — which fields it fills in, and the minimum confidence needed on
  each field before "done" counts.
- **Rules** — rule sets and validation sets from the engines the org already
  runs. Rules are never copied into agent code. One rulebook, used by agents
  and people alike.
- **Tools** — a named list. The gateway blocks any tool not on the list. But
  the agent alone decides which listed tools to use, when, and how often.
- **Telemetry** — on by default, produced by the engine itself; the agent
  developer cannot forget it or turn it off. The manifest only adds extra
  fields and redaction rules on top.

Every agent and every tool must have a plain-language label in its manifest —
the manifest is rejected without one.

## The four ways a run can end

There are no others, and the agent itself chooses which ending, and when.

| ending | what it means | what the runtime does |
|---|---|---|
| `done` | the work is finished | the task becomes PROCESSED / CLOSED |
| `question` | needs one answer — one sentence, two to five choices, and the field the answer fills | the task becomes QUERY; takes a person seconds |
| `handover` | gives up, work attached | goes to work allocation, then the HITL queue |
| `parked` | waiting for something — a reply, a document, a date | the task becomes PARKED; the ending says what wakes it |

Every ending carries the agent's work — the fields it filled, its confidence
numbers, what it tried, and why it stopped. A person never starts from zero.

## The run events

Every step is written to the event log before the next step starts — the
model's reply, the tool's reply, the time. If a machine dies mid-run, the run
continues from the last written step. Any old run can also be replayed
exactly, which means "why did it do that?" always has an answer.

```ts
import { checkEventLog, spendOf, resumePoint } from "@malkom/agenticai-contract";
```

## The access pass

An agent never holds a password or key. For each run it gets a short-lived
access pass: one org, one task, the named tools, valid for minutes. Nothing
else is reachable. During shadow runs the pass blocks all writes — the agent
cannot change anything even if its code tries.

```ts
import { checkPass } from "@malkom/agenticai-contract";
```

`checkPass` is a pure function with no dependencies — the most
security-sensitive code in the engine, readable in one sitting.

## The gateway

Written once, inside the engine. Not per customer. Not per queue. Its tools
are generated from what the org already has — its queues and fields, its
deployed engines (rules, validation, integration, extraction), its configured
Integrations. Add a new Integration to the org, and the gateway gets a new
tool. No code written.

The gateway records and times every tool call itself, so you see exactly what
an agent touched, even if the agent's code is badly written. MCP is the door
for an agent written in any language:

```ts
import { Gateway, toolsFromOrgConfig, mcpGateway } from "@malkom/agenticai-gateway";
```

## The runner

Retries, timeouts, resumption, long-running agents — all of it lives in the
runner, not in agent code:

- **Retries** are configured, and split by type of failure. A network error or
  a dead AI endpoint is worth retrying. A wrong answer is not.
- **Three limits per run**: a timeout per step, a total time limit, and a
  money limit. Hitting any limit is a normal ending, not a crash — the case
  goes to a person. Never silently overspend.
- **Resumption**: every step is committed before the next starts; a run
  continues from the last written step.
- **Long-running agents** end with `parked` and state what should wake them.
  This uses the existing PARKED task state. No new system is invented.

Every number is a manifest field, and each org can override it. Nothing is
hard-coded. The engine-wide defaults are the host's to change too:

```ts
import { engineConfig } from "@malkom/agenticai-contract";
import { runAgent, runPipeline } from "@malkom/agenticai-runner";

const config = engineConfig({ pass: { validityMinutes: 10 } });
```

## Adapters

The engine does not lock into one framework. An agent is a manifest, a
container, and a connection — one standard way to start the agent, one way
for it to report what it is doing, and the four endings. The adapter passes
the goal in and the endings out. It never controls the agent's steps.

```ts
import { typescriptAdapter, AdapterRegistry } from "@malkom/agenticai-adapters";
```

The TypeScript adapter ships now; its loop rides on the Vercel AI SDK. The
LangGraph (Python) adapter and the Camunda adapter come with the adapter
stage — a new framework is a new adapter, not a new engine.

## Install

```bash
npm install
npm run build
npm test
```
