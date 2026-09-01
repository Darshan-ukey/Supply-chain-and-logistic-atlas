# Operation Selection and Lifecycle

Status: implemented compiler contract with focused synthetic and connected
reference-workflow proof.

## What the words mean

- **Operation**: one application action declared by evidence, such as creating
  a customer or reading a report.
- **Selection**: choosing exactly one evidenced operation for one intent action.
- **Authoritative evidence**: evidence with a named source and provenance that
  is stronger than a heuristic guess. The exact Evidence Graph revision on the
  workflow is the source of truth.
- **Lifecycle phase**: the role of a step: `setup`, `test`, `verification`, or
  `cleanup`.
- **Logical scenario**: the one behavior the user asked Brisk to prove. It may
  require several internal operations without becoming several reported user
  tests.
- **Stable identity**: an id calculated from semantic workflow facts, not the
  clock or array arrival order.
- **Decision record**: the inspectable answer to “what was considered, what was
  chosen, why, and from which evidence?”

Full selection information means the chosen operation exists in the final
Evidence Graph revision, has usable provenance, has no unresolved conflict,
has approved authority for its side effect, and exposes every selected outcome.
Partial information means one of these facts is missing or disputed; the
affected scenario does not execute.

## How selection works

The compiler ranks operations from the final Evidence Graph using semantic
action, resource, capability, and actor meaning. A candidate cannot execute
when it is absent from that graph, conflict-bearing, provenance-free, or backed
only by heuristic evidence. Source inspection may support a read, but
create/update/delete/external work still requires host, contract, runtime, or
observed authority.

The highest candidate is selected only when it is clearly ahead of the next
candidate. The decision is then tied to the exact graph revision. Later
validation rejects an unknown operation, stale graph revision, altered choice,
or a decision whose candidate/provenance/outcome facts no longer match.

## Outcomes

An outcome can be selected only if the chosen operation declares its id. When
intent names no outcome, the compiler uses the operation's declared successful
outcomes. An exact outcome id is preferred. A missing textual match, an equal
ambiguous match, a duplicate id, or a contradictory duplicate stops the
affected scenario.

## Lifecycle phases

An intent action may explicitly say `setup`, `test`, or `verification`. If it
does not, Brisk uses `test`; it does not guess setup or verification from a
verb. Compiler-synthesized cleanup is always `cleanup` and must also appear in
the scenario's cleanup list.

Phases describe roles and do not silently reorder normal steps. The compiler
preserves intent order, then appends cleanup in reverse resource-dependency
order when automatic cleanup is required. A parent cleanup waits for its child
cleanups; unrelated branch cleanups do not wait for each other. Two resources
created by the same operation receive distinct cleanup steps tied to their own
producer and captured id. The lowerer exposes the phase on operation metadata
while keeping all internal operations attached to their original logical
scenario.

## Stable identities and decision records

Compiler workflows now include a deterministic `workflow_<digest>` id. The
digest includes the evidence revision, goal, scenarios, steps, value flow, and
selection decisions, but excludes `createdAt`. Scenario, step, and cleanup ids
come from stable intent/action relationships. Duplicate intent scenario or
action ids are rejected before workflow construction.

Each step has one `brisk-aitesting.workflow-selection-decision.v1` record with:

- candidate operation ids and scores;
- selected operation and selection reason;
- intent action and lifecycle phase;
- selected outcome ids;
- Evidence Graph revision;
- provenance references.

Incremental compilation preserves the exact unaffected scenario result object,
but rebuilds its combined-workflow decision against the final Evidence Graph
revision. This prevents stale decision metadata without mutating preserved
history.

## Proof and limits

`TCV-0031` runs 88 focused synthetic checks covering authority, outcomes, all
phases, cleanup safety, reverse cleanup chains, independent branches, distinct
same-type resource cleanup, logical scenario preservation, no normal-step
reordering, stable identities, complete decision records, duplicate identities,
tampered/stale records, and eight cleanup tampering families stopped before an
adapter call. TCV-0020 separately proves one real local logical
scenario across five HTTP operations and cleanup. TCV-0029 proves selective
incremental preservation.

These are synthetic and local reference proofs. Runtime interruption recovery,
exactly-once cleanup, cleanup failure continuation by dependency, large
candidate sets, property-based ordering, distributed compilation, authenticated
human decision approval, every adapter, cross-platform identity, and production
load remain unproven.
