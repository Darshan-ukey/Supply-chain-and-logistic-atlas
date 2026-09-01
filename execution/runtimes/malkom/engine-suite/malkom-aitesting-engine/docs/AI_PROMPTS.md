# AI Intent Planning

This page defines the boundary between AI-owned intent and SDK-owned execution in `brisk-aitesting`.

## Primary Rule

The default `SemanticPlanner` asks AI for `brisk-aitesting.intent.v1`. That schema can describe semantic actions, resources, assertions, fixtures, and the requested logical scenario count. It cannot contain:

- HTTP methods, routes, or status codes
- selectors, query expressions, or engine names
- executable request payloads
- captures, variable paths, or cleanup operations

Those facts come from evidence and deterministic compilation. AI plans what should be proven; capability adapters and engines decide how a proven operation runs.

## Ownership

| Layer | Owner | Purpose |
| --- | --- | --- |
| Intent system prompt and JSON Schema | SDK, `src/ai-intent-planner.ts` | Enforces non-executable `brisk-aitesting.intent.v1` |
| Semantic vocabulary | Capability evidence | Tells AI which actions and resources are actually available |
| Host instructions | Host app | Adds product terminology and testing priorities |
| Evidence graph | SDK and host capability adapters | Supplies authoritative operations, typed inputs/outputs, outcomes, and provenance |
| Compilation and lowering | SDK | Selects operations, binds data, proves dependencies, and creates engine input |
| Legacy executable-plan prompt and repair | SDK, `src/ai-planner.ts` | Compatibility path only; not the default orchestrator path |

Host instructions are appended to SDK instructions. They do not replace the intent schema or compiler invariants.

## What The AI Receives

The intent planner receives the goal, requested logical scenario count, count
policy, requested capability types, application name/environment, and the
semantic action/resource vocabulary from the evidence graph. It does not
receive operation bindings, the full discovery object, raw configured
credentials, or a truncated list of executable routes. A common raw credential
pattern is rejected before the provider call; callers must use secret
references at the typed execution boundary.

Example intent:

```json
{
  "schema": "brisk-aitesting.intent.v1",
  "goal": "Prove that a user can create and retrieve a todo",
  "scenarios": [
    {
      "id": "todo-lifecycle",
      "name": "Create and retrieve a todo",
      "objective": "A created todo can be retrieved",
      "steps": [
        {
          "action": "create",
          "resource": "todo",
          "values": {
            "title": "compiler proof"
          }
        },
        {
          "action": "read",
          "resource": "todo"
        }
      ],
      "assertions": [
        "the retrieved todo has the requested title"
      ]
    }
  ]
}
```

There is no method, route, selector, payload shape, status, capture path, or cleanup route in this output.

## What Happens Next

1. `AiIntentPlanner` validates strict JSON and exact scenario-count rules.
2. Capability adapters produce `brisk-aitesting.evidence-graph.v1`.
3. `UniversalSemanticCompiler` matches semantic steps to evidenced operations.
4. The compiler binds required typed inputs from intent values, fixtures, secrets, generated values, or earlier outputs.
5. Mutations are allowed only with contract, host, runtime, or observed authority.
6. A successful result contains `brisk-aitesting.workflow.v1`.
7. The owning capability adapter lowers the workflow to `brisk-aitesting.lowered-plan.v1` and the existing engine plan contract.
8. Existing validation runs before any engine executes.

Unsupported, ambiguous, or insufficiently evidenced intent produces a stable compilation result. The SDK does not ask AI to invent the missing executable fact.

## Host Controls

Hosts can control:

- the user goal and logical scenario count
- exact or flexible count policy
- product terminology and priorities
- typed fixtures and secret references
- authoritative capability adapters and evidence graphs
- enabled engines and execution policy

Hosts cannot weaken compiler invariants through prompt text.

## Brisk Integration

Brisk supplies product-specific HTTP operation contracts through a typed host capability adapter in:

```text
packages/server/src/domains/testing-aitesting.ts
```

Its `testing_ai_prompt` setting adds domain guidance. The executable Brisk operations remain host-owned evidence, not AI-authored facts.

## Current Limits

OpenAPI and typed host HTTP have real evidence and lowering adapters. GraphQL,
browser accessibility, messaging, and proprietary capability shapes currently
prove that the compiler core is protocol-neutral, but their production
adapters are not yet built. Bounded evidence acquisition and selective
recompilation exist; real third-party providers and wider reference proofs
remain open.
