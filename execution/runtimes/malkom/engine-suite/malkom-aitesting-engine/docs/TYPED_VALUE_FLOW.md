# Typed Value Flow

Status: implemented compiler contract with focused synthetic and real-workflow proof.

## What the words mean

- **Value**: one piece of information needed by a test step, such as a customer
  id, display name, fixture name, or secret reference.
- **Semantic type**: the business meaning of a value. `customer.id` and
  `order.id` may both be strings, but they are not interchangeable.
- **Source**: where Brisk obtained the value: user intent, fixture, secret
  reference, generator, or an earlier step's output.
- **Producer**: what made the value available. External sources have an
  external producer; an earlier output names its exact step and output slot.
- **Consumer**: the exact step and input slot that use the value.
- **Lifetime**: when the value first becomes available and the last step after
  which it is no longer needed. This is a useful-life record, not a promise
  about memory erasure.
- **Conversion**: an adapter-declared, reviewed path from one semantic type to
  another. The compiler can approve the declaration but cannot invent or
  execute the conversion itself.
- **Secret reference**: a safe name such as `PAYMENTS_API_TOKEN`. It tells the
  execution boundary which secret to resolve without placing the secret value
  in the workflow record.

**Full value information** means every required input has one unambiguous
source, an exact semantic type, a known producer, all known consumers, a
start/end lifetime, and an adapter-owned conversion when types differ.

**Partial value information** means at least one of those facts is missing or
disputed. Brisk may still compile unaffected scenarios, but it does not execute
the affected scenario by guessing the missing fact.

## How Brisk identifies the flow

For each selected operation, the compiler reads the operation's declared input
slots. It checks sources in this order:

1. an explicitly named user value, fixture, or secret reference;
2. a compatible output from an earlier step;
3. the input slot's declared generation policy.

An earlier output is compatible only when its normalized semantic type is an
exact match, or the consuming operation's adapter declares exactly one safe
conversion. Similar-looking suffixes are not treated as proof.

When several outputs share a type, Brisk narrows them without guessing:

1. If exactly one came from the create operation for that semantic type's
   business owner, it is the producer. This lets a later response echo the
   same id without replacing its original producer.
2. Otherwise, if an earlier step in the same scenario already consumed exactly
   one of the candidate values, the scenario continues with that value.
   Scenario consistency is not a guess; switching to a different producer
   mid-scenario would be the surprising reading.
3. Otherwise, if every candidate is the same side-effect-free read — the same
   operation called with the same inputs — the repeats are one producer echoed
   several times, not several producers, and the earliest step is used. The
   collapse is refused when a mutating step between the reads touches the
   owning resource or captures the wanted type, because then the echoes may
   genuinely disagree.

A synthesized cleanup step never searches at all for values its source step
already used: it mirrors the source step's own bindings, so the contact
created in organization X is deleted from organization X even when other
same-typed values are in play.

If two owner-create steps remain—for example, two customers were created—Brisk
stops with `AMBIGUOUS_VALUE_PRODUCER` instead of choosing the newest value.
The refusal reports status `ambiguous` (a missing choice — more evidence
cannot resolve it), names every candidate action, and states the exact
`values` entry with `fromActionId` that would resolve it, so an AI repair or
a human can act on it directly.

After all steps and cleanup steps are known, the compiler emits a
`brisk-aitesting.value-flow.v1` record. The record contains metadata only; it
never contains a user value or resolved secret.

## Five supported sources

| Source | What is recorded | Useful lifetime starts |
| --- | --- | --- |
| User intent | type and consumer, not the value | scenario start |
| Fixture | fixture reference and consumer | scenario start |
| Secret | secret reference, `secret: true`, and consumer | scenario start |
| Generated | generation policy name and consumer | scenario start |
| Earlier output | producer step/output and every consumer | after producer step |

The lifetime ends after the last recorded consumer. An output used by two
later steps therefore has one producer and two consumer records.

## Adapter-owned conversions

The consuming operation may declare `valueConversions`. Each declaration has:

- a stable id;
- source and target semantic types;
- `lossless` or `validated` safety;
- optional opaque adapter instructions.

The compiler verifies that the declaration belongs to the operation's adapter
and places its public identity on the consumer edge. The adapter sees that edge
during lowering and remains responsible for the actual conversion. A missing,
duplicate, reversed, or unrelated declaration does not authorize the value.

## Safe stopping rules

Brisk stops the affected scenario when it finds:

- a required input with no source;
- an explicitly supplied value with the wrong semantic type;
- two user aliases targeting one input;
- multiple equally valid user values or earlier producers;
- a blank or meaningless semantic type;
- an unknown, late, or circular producer;
- duplicate step, input-binding, or output-capture identities;
- a raw secret-like value where a secret reference is required.

The diagnostic explains the missing fact but never repeats a detected secret.
Rejected cases remain testable: the focused suite deliberately constructs each
invalid case and proves that Brisk rejects it for the intended reason.

## Secret boundary

The AI intent prompt contains only the goal, requested counts, application
name/environment, and a small semantic vocabulary. Before the provider call,
Brisk rejects obvious raw credential patterns. Evidence-provider and extension
conformance checks reject obvious secret leakage in returned artifacts, and
the compiler rejects raw secret-like user values, constant generators, and
selected operation bindings. Secret references remain allowed.

This protection detects common credential formats and secret-bearing field
names. It is a boundary guard, not a claim that arbitrary unknown secrets can
always be recognized. Central resolver, redaction, and retention policy work
remains in Phase 7.

## Proof and current limit

`TCV-0030` covers all five sources, two-consumer lifetime aggregation,
adapter-owned conversion, missing/duplicate/incompatible/ambiguous bindings,
malformed types, duplicate conversions, circular and invalid graph identities,
AI-prompt refusal, evidence-binding refusal, and secret-safe diagnostics.

The proof is strong synthetic contract coverage plus the real local
event-messaging workflow. Cross-process secret resolution, long-running value
retention, and every third-party adapter remain unproven and are not claimed.
