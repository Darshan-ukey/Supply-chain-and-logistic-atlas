# Universal Semantic Compiler

Status: normative design for the compiler introduced after `brisk-aitesting.plan.v1`.

## Product Meaning

In brisk-aitesting, **universal compiler** means a protocol-neutral compiler core
with replaceable evidence and execution adapters. It does not mean that the SDK
guesses how every undocumented application works.

The compiler accepts business-level testing intent, resolves that intent only
against attributed application evidence, constructs a typed workflow, proves
the workflow invariants, and then lowers it through a capability adapter.

```text
plain-language goal
  -> Intent IR
  -> Evidence Graph
  -> semantic resolution and typed value-flow
  -> Workflow IR
  -> capability lowering
  -> executable TestPlan
  -> engine execution and observations
  -> evidence reconciliation
```

HTTP methods, URLs, selectors, GraphQL documents, protobuf methods, broker
addresses, database statements, and CLI commands are adapter details. They are
not concepts in the semantic compiler.

## Source Of Truth

The authoritative input to compilation is the Evidence Graph. Every node and
edge has provenance, authority, and confidence. Evidence sources have this
default precedence:

1. `host` - an explicit host adapter or fixture contract
2. `contract` - OpenAPI, GraphQL, protobuf, AsyncAPI, or another formal contract
3. `runtime` - framework-registered metadata or runtime introspection
4. `observed` - a captured interaction with the running application
5. `source` - statically inspected implementation evidence
6. `heuristic` - an unconfirmed inference

Higher precedence does not silently erase conflicts. The resolver retains every
competing value and its source details. One uniquely stronger value resolves
the conflict; an equal-strength tie remains unresolved. Every unresolved
operation is unavailable to compilation, while create/update/delete/external
operations are also identified separately as mutation-blocked. Exact host
overrides require a reason and can select only an existing candidate. See
[EVIDENCE_AUTHORITY.md](EVIDENCE_AUTHORITY.md) for the complete what/how rules.

Heuristic evidence can locate additional evidence. It cannot, by itself,
authorize a side-effecting execution.

## Intent IR

`brisk-aitesting.intent.v1` describes what should be proven, not how to execute
it. An intent scenario contains:

- an actor and optional initial state;
- capability hints without protocol instructions;
- semantic actions expressed as verb and resource;
- values explicitly supplied by the user;
- expected business outcomes and invariants;
- coverage and evidence requirements;
- cleanup intent.

The Intent IR must not contain URLs, HTTP methods, selectors, executable code,
queries, broker connection strings, or engine names.

AI providers may produce Intent IR through strict structured output. Hosts may
also construct it directly. AI output never becomes executable without
semantic compilation.

## Evidence Graph

`brisk-aitesting.evidence-graph.v1` describes application capabilities:

- actors and permissions;
- resources and states;
- operations and side-effect classes;
- typed inputs and outputs;
- observations and expected outcomes;
- operation relationships;
- UI affordances;
- fixtures and generated-value policies;
- provenance and evidence conflicts.

Operations use semantic actions such as `create`, `read`, `update`, `delete`,
`publish`, `consume`, `authenticate`, `navigate`, or adapter-defined verbs.
Their adapter binding is opaque to the compiler.

Input and output slots carry a `semanticType`. A value can flow from an output
slot to an input slot only when their semantic types are compatible or an
adapter declares a conversion.

The exact definitions, five sources, full/partial information rule,
consumer/lifetime record, conversion ownership, safe stopping behavior, and
proof are in [TYPED_VALUE_FLOW.md](TYPED_VALUE_FLOW.md).

## Capability Adapter Contract

A capability adapter:

1. collects or imports attributed evidence;
2. normalizes it into Evidence Graph fragments;
3. validates adapter-owned operation bindings;
4. lowers proven Workflow IR steps into executable scenarios;
5. reconciles execution observations back into evidence.

Adapters must not:

- mutate Intent IR;
- mark heuristic evidence as authoritative;
- invent required inputs during lowering;
- drop unresolved value bindings;
- lower operations they do not own;
- expose secrets in evidence or diagnostics.

Initial adapter families are HTTP/OpenAPI, browser accessibility, AsyncAPI
messaging, and host-provided operations. GraphQL, gRPC, databases, jobs, CLI,
mobile, and proprietary systems use the same contract.

### Generated data/API platforms

Brisk is not designed around Hasura, Directus, or another data platform. The
universal compiler understands business actions, typed values, authority,
outcomes, permissions, dependencies, phases, and cleanup—not vendor metadata
keys or vendor operation names.

One vendor-neutral GraphQL/API adapter handles shared foundations such as
schema introspection, queries, mutations, subscriptions, variables, results,
and protocol errors. Small evidence connectors may read a platform's metadata,
roles, row/field permissions, policies, and optional REST/OpenAPI surface, then
translate those facts into the common Evidence Graph with provenance. A
connector cannot bypass the compiler, authorize a mutation by itself, or add a
vendor branch to operation selection.

Hasura and Directus are compatibility/reference proofs for this model, not
separate compiler products. The connector contract must remain reusable for
other generated-data-API shapes; building Supabase, PostgREST, Appwrite, or
another named connector requires separate scope approval.

The wider schema, transport, identity, permission, query, mutation, async,
error, resilience, and protocol gap map is maintained in
[SYSTEM_COMPATIBILITY_FOUNDATIONS.md](SYSTEM_COMPATIBILITY_FOUNDATIONS.md).

## Workflow IR

`brisk-aitesting.workflow.v1` is capability-neutral and contains:

- the selected evidence-backed operation for each action;
- input values and their origin;
- typed output captures;
- dependency edges;
- expected semantic outcomes;
- required observations;
- side-effect and cleanup ordering;
- the complete evidence reference set.

Workflow IR is immutable after validation. Runtime observations create a new
evidence revision and a new compilation; they do not silently patch an
executable workflow.

Operation authority, explicit lifecycle phases, deterministic workflow ids,
versioned selection decisions, outcome rules, and their proof are documented
in [OPERATION_LIFECYCLE.md](OPERATION_LIFECYCLE.md).

Every compiler-produced scenario also carries a metadata-only
`brisk-aitesting.value-flow.v1` record. It identifies type, source, producer,
consumers, lifetime, secret-reference status, and approved conversions without
copying raw values into the record.

Automatic cleanup reverses the compiled resource dependency graph, not merely
the order in which actions were written. Child resources are removed before
their parents, independent branches remain independent, and repeated resources
receive separate cleanup steps bound to their own captured identifiers. Runtime
interruption recovery and exactly-once cleanup remain separate open gates.

The lowerer revalidates workflow identity, evidence revision, operation
authority/provenance, lifecycle phases, bindings, outcomes, dependencies,
selection decisions, and cleanup safety records before calling an adapter. A
rejected workflow produces structured diagnostics and zero adapter calls; it is
not counted as an application test result.

## Correctness Invariants

A workflow is executable only when all of these invariants hold:

1. Every step resolves to exactly one operation.
2. Every selected operation is backed by non-conflicting evidence.
3. Side-effecting operations have authority `host`, `contract`, `runtime`, or
   `observed`; source-only or heuristic mutations are not executable.
4. Every required input has a typed binding.
5. Every output binding names an output declared by the selected operation.
6. Every cross-step value is produced before it is consumed.
7. Dependency edges form a directed acyclic graph.
8. Every expected outcome is declared by evidence or explicitly identified as
   a user-owned business assertion.
9. Each step has a registered adapter capable of lowering it.
10. Cleanup is present for created durable state unless host policy explicitly
    declares isolation or manual cleanup.
11. Secrets remain references and are resolved only at execution.
12. Requested scenario-count policy is satisfied after compilation.

Compilation returns `compiled`, `needs-evidence`, `ambiguous`, or `unsupported`.
These are compilation outcomes, not product crashes. `needs-evidence` includes
the exact missing fact and the adapters capable of acquiring it.

## Deterministic Resolution

The compiler uses semantic action, resource, capability, actor, state, and type
constraints to select candidate operations. Lexical similarity may rank
candidates but cannot overcome incompatible types, insufficient authority, or
conflicting evidence.

If two candidates remain semantically equivalent, compilation returns
`ambiguous`; an AI or user may choose between the proven candidates. AI cannot
introduce a candidate absent from the Evidence Graph.

## Evidence Acquisition And Recompilation

When required evidence is missing, the orchestrator may invoke safe acquisition
strategies allowed by host policy:

- contract or framework-schema import;
- runtime introspection;
- read-only probing;
- isolated mutation probing;
- fixture-provider lookup;
- UI accessibility capture;
- execution-response reconciliation.

Acquisition produces a new Evidence Graph revision. Brisk compares the old and
new graphs, rebuilds only scenarios that the change can affect through the same
semantic compiler, and preserves earlier compiler results for unaffected
scenarios. Versioned decision records remain available on both successful plans
and compilation errors. Definitions, scope rules, stop reasons, full/partial
information, proof, and current limits are documented in
[INCREMENTAL_RECOMPILATION.md](INCREMENTAL_RECOMPILATION.md).

## Compatibility

`brisk-aitesting.plan.v1` remains the executable compatibility contract during
migration. Capability adapters lower validated Workflow IR into this shape.
The old direct AI-to-`TestPlan` path is deprecated and must not be the default
once the semantic compiler is wired into the orchestrator.

## Proof Matrix

Universality is not established by Brisk alone. Release evidence must include:

| Application shape | Required proof |
| --- | --- |
| REST CRUD SaaS | typed create/read/update/delete and cleanup |
| GraphQL | mutation/query value flow without HTTP concepts in core |
| Event-driven | publish/consume correlation and eventual observation |
| Browser-first | accessibility-grounded action and visible outcome |
| Distributed workflow | API to queue to worker to persistence |
| Non-TypeScript application | adapter evidence independent of source language |
| Contract-only black box | compilation without repository access |
| Large monorepo | complete evidence inventory without prompt truncation |
| Contract drift | conflict surfaced and reconciled without guessed mutation |
| Proprietary capability | external adapter lowering and conformance |

Benchmarks report compilation correctness, operation-selection accuracy,
unbound-value prevention, cleanup completeness, execution verdict accuracy,
and stable product completion. Validator rejection counts are not success.

Cleanup terms, crash-safety rules, authoritative records, implemented behavior,
and open recovery gaps are documented in
[CLEANUP_AND_RECOVERY.md](CLEANUP_AND_RECOVERY.md).
