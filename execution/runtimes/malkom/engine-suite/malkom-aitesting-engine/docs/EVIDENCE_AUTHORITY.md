# Evidence Authority And Conflicts

This guide explains what Brisk does when two sources describe the same
application operation differently. The short rule is: **preserve both facts,
apply a written trust order, and do not guess when that order cannot produce one
clear answer.**

## Plain-language definitions

- **Evidence** is information Brisk received about what an application can do.
  Examples are an OpenAPI operation, runtime route metadata, inspected source,
  or an explicit host declaration.
- **Authority** is the named kind of source, not a claim that the source is
  always correct. It tells Brisk which source to prefer when facts disagree.
- **Conflict** means two or more evidence graphs use the same operation ID but
  give different values for a field such as action, resource, inputs, binding,
  side effect, or cleanup operation.
- **Resolved conflict** means exactly one competing value is strongest under
  the declared rule. Brisk can use that value, but keeps the losing facts and
  the reason for the decision.
- **Unresolved conflict** means the strongest values are tied, or a host
  override matches zero or multiple values. Brisk records the disagreement and
  refuses to compile that operation. It does not silently choose one.
- **Host override** is a narrowly scoped instruction from the application or
  team running Brisk. Here “host” does not mean a network hostname. Every
  override names one operation (optionally one field), a required authority,
  and a human reason.

## What “full” and “partial” mean here

A **fully recorded conflict candidate** contains the competing value plus its
source, authority, confidence, optional source revision, and the revision of
the evidence graph that carried it. This is enough to explain where the answer
came from and reproduce the comparison.

**Partial evidence** means a source can describe an operation without every
optional fact. For example, `actor` or `cleanupOperationId` may be absent. Brisk
keeps absence as absence; it does not turn it into a host-approved value. A
required compiler fact that is missing still produces `needs-evidence`.

“Fully recorded” does not mean “proven true.” Confidence is preserved for
inspection, but confidence does not replace the declared authority order.

## Default trust order

`brisk-aitesting.evidence-authority-policy.v1` lists all six authorities exactly
once. The default order, strongest first, is:

1. `host` — an explicit application-owned declaration
2. `contract` — a formal API or message contract
3. `runtime` — registered metadata or runtime inspection
4. `observed` — a captured application interaction
5. `source` — static source inspection
6. `heuristic` — an unconfirmed inference

The order is data, not a hidden rule. A host may supply a different complete
order. The policy digest in the result identifies the exact policy used.

## How Brisk recognizes and decides a conflict

For each operation ID, Brisk compares the executable fields one by one. Equal
values are grouped together. Different values become candidates. Each
candidate retains its provenance and source-graph revisions.

Without an override, Brisk finds the best authority carried by each candidate:

- one uniquely strongest candidate: `AUTHORITY_PRECEDENCE`, resolved;
- two or more strongest candidates: `AUTHORITY_TIE`, unresolved.

With an exact operation or operation-field override:

- exactly one candidate has the requested authority:
  `HOST_OVERRIDE_APPLIED`, resolved;
- no candidate has it: `HOST_OVERRIDE_NO_MATCH`, unresolved;
- several different candidates have it: `HOST_OVERRIDE_AMBIGUOUS`, unresolved.

An override never creates a candidate. If the requested fact is absent, Brisk
reports that absence and stops the operation from compiling.

## What happens after the decision

Every conflict is returned as structured data and as a stable explanation.
Resolved conflicts have `selectedCandidateId`. Unresolved conflicts do not.
The affected operation also receives the unresolved conflict ID; the semantic
compiler sees that ID and returns `needs-evidence` instead of an executable
workflow.

`mutationBlockedOperationIds` is a separate safety view. It contains unresolved
operations whose declared side effect is create, update, delete, or external.
A read-only conflict is still not compiled, but it is not mislabeled as a
blocked mutation.

This distinction answers an important testing question: a rejected candidate
is still tested by the conflict test suite. “Rejected” means it was not allowed
to authorize execution; it does not mean Brisk hid or skipped the case.

## Public use

Use `resolveEvidenceConflicts` when a host needs a custom policy or overrides.
Use `mergeEvidenceGraphs` for the default policy. Both paths use the same
resolver.

```ts
const result = resolveEvidenceConflicts({
  schemaVersion: 'brisk-aitesting.evidence-conflict-input.v2',
  graphs,
  policy: {
    schemaVersion: 'brisk-aitesting.evidence-authority-policy.v1',
    authorityOrder: ['host', 'contract', 'runtime', 'observed', 'source', 'heuristic'],
    hostOverrides: [{
      scope: evidenceConflictScope('customer.save', 'binding'),
      authority: 'runtime',
      reason: 'The production route probe is newer than the checked-in contract.',
    }],
  },
});
```

Review `result.conflicts`, `result.mutationBlockedOperationIds`, and
`result.policyDigest` before treating the graph as approved evidence.

## Proof and honest limits

`npm run smoke:evidence-conflicts` runs 59 checks covering stronger authority,
equal-authority ties, custom order, exact override success, missing and
ambiguous override targets, preserved provenance, input-order stability,
read-only and mutation behavior, compilation blocking, malformed policies,
versioned data validation, no-conflict behavior, and the empty-merge
compatibility case.

This is deterministic synthetic proof. It does not prove that an upstream
contract, runtime probe, source inspector, or host declaration is factually
correct or fresh. It does not authenticate who supplied a host override. Those
truth, freshness, and authorization checks remain the responsibility of the
evidence provider and host security boundary.
