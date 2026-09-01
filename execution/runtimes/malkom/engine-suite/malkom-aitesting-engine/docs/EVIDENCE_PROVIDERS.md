# Evidence Providers

Evidence providers gather missing authoritative information so Brisk can build
a valid test instead of treating an evidence gap as an unsupported user case.

## How Brisk identifies missing information

Brisk does not ask AI to decide whether executable information is missing. The
deterministic compiler compares the requested business action with the current
evidence graph. It produces a structured reason when it cannot safely finish a
workflow. The acquisition flow currently recognizes these reasons:

- no evidenced operation can perform the requested business action;
- a selected operation needs a typed value that intent, fixtures, generators,
  secrets, environment policy, or an earlier operation cannot provide;
- a required workflow input remains unbound;
- an automatic cleanup operation is required but not evidenced;
- an operation exists but lacks the authority or consistency required for safe execution.

Each recognized reason becomes a versioned missing-information requirement.
The requirement carries its reason, semantic type, required authority, and the
known scenario, action, or operation identifiers. A provider's `supports`
method then decides whether that provider is relevant. This keeps a browser
source, for example, from receiving an unrelated database requirement.

An important distinction is that the compiler may initially use the word
`unsupported` when no current operation matches. The acquisition layer treats
that as potentially obtainable information, not proof that Brisk can never test
the user's case. Only the absence of usable evidence after bounded acquisition
prevents a plan from being built.

## Full, partial, missing, and invalid results

These words describe the provider result, not whether the application passed
or failed a test.

### Full information

A result is full for one provider attempt when every requirement sent to that
provider is listed as satisfied and the provider returns an evidence graph.
Full does not mean the entire application is understood. It means only that
this provider claims to have answered every requirement in its assigned scope.
Brisk still validates the response, merges it, and recompiles. If compilation
still finds a gap, acquisition can continue within the configured round limit.

### Partial information

A result is partial when the provider satisfies some assigned requirements and
explicitly lists the rest as unsatisfied. The satisfied part must include an
evidence graph. Brisk keeps that usable evidence, merges it, and tries again.
Requirements may not be silently omitted or appear in both lists.

Example: a source-code provider may prove that `create customer` exists but be
unable to prove the required cleanup operation. The create-operation evidence
is retained; cleanup remains an open requirement. Brisk must not execute the
mutation until the cleanup gap is resolved.

### Missing information

Information remains missing when no registered provider accepts the
requirement, every relevant provider reports it as unsatisfied, providers fail
or time out without usable evidence, or newly returned evidence still does not
allow compilation before the round limit. Brisk returns a planning problem and
does not invent executable details or an application verdict.

### Invalid information

A result is invalid when it breaks the versioned response shape or consistency
rules. Examples include an unsupported version, an unknown requirement ID, the
same requirement marked both satisfied and unsatisfied, an omitted requirement
outcome, or a satisfaction claim without an evidence graph. Invalid provider
data is blocked as an internal provider failure. It is never reported as an
unsupported user test case.

## What happens after information arrives

1. Brisk checks the response shape and requirement accounting.
2. Invalid provider output is contained and excluded.
3. Valid full or partial evidence receives a new graph revision when merged.
4. Authority and provenance remain attached to every evidenced operation.
5. Brisk recompiles the intent using the merged graph.
6. Compilation success proceeds to lowering and execution.
7. Remaining gaps can trigger another acquisition round until the configured limit.
8. An unresolved gap ends in an explicit planning failure without a fabricated test verdict.

The current implementation recompiles the whole intent after new evidence.
Scenario-scoped recompilation is now connected through `SemanticPlanner` and is
covered by TCV-0029. Its proof is synthetic and in-memory: persistent restart,
large plans, distributed/concurrent compilation, cross-scenario value
dependencies, and a real-provider reference application remain pending.

## Lifecycle

1. The host registers providers in `evidenceProviders`.
2. Brisk compiles the semantic intent using current evidence.
3. Brisk converts evidence-resolvable compilation gaps into versioned requirements.
4. `supports` selects only providers relevant to each requirement.
5. `acquire` receives only its relevant requirements, current evidence,
   application scope, security allowlist, and an abort signal.
6. Brisk validates the returned versioned result and its requirement IDs.
7. Valid full or partial evidence is merged into a new evidence revision.
8. Brisk recompiles automatically. Repeated acquisition is bounded by
   `planning.evidenceAcquisitionRounds`.
9. `checkFreshness` can prove cached evidence fresh, stale, or unknown.
10. `refresh` is used automatically when cached evidence is proven stale and
    the provider implements refresh.
11. `dispose` is the optional entry point for host-managed provider shutdown.

Only registration, selection, acquisition, validation, merge, bounded retry,
recompilation, bounded in-memory caching, per-cache-hit freshness checking, and
stale refresh are wired into the current planning path. Automatic provider
disposal during normal host shutdown is not yet wired. The conformance runner
calls disposal only to verify a provider that declares it.

## Cache, digest, freshness, and retention

### What the cache is

The cache is a short-lived memory-only copy of a provider result. Its purpose is
to avoid asking the same provider the same unchanged question repeatedly. It is
not the evidence source of truth and it is never written to disk by this cache.
It disappears when the planner instance or process ends.

### How Brisk decides two requests are the same

Brisk creates a SHA-256 key from:

- provider ID and provider revision;
- a deterministic digest of the current evidence content;
- the exact sorted missing-information requirements;
- application name, repository scope, and allowed hosts.

The evidence digest deliberately ignores the graph's random revision ID. It
includes operations, typed inputs and outputs, outcomes, bindings, provenance,
conflicts, and diagnostics in stable order. Equivalent content therefore has
the same digest; a meaningful content change has a different digest.

Every provider must declare a non-empty `revision`. Changing that revision
invalidates earlier cache entries even when the provider ID stays the same.
Hosts should change it whenever provider logic or its authoritative upstream
contract changes in a way that can affect returned evidence.

### Cache freshness versus source freshness

Cache freshness means that a saved result is younger than
`evidenceCacheTtlMs` and all cache-key inputs still match. At the exact expiry
time it cannot be reused.

Source freshness asks a different question: has the authoritative OpenAPI
document, source tree, page, database metadata, runtime route set, or other
upstream source changed since the evidence was obtained? Providers can answer
that question through `checkFreshness` using
`brisk-aitesting.evidence-freshness.v1`.

The three source states are:

- `fresh`: the provider checked its upstream source and found the cached
  evidence still valid. If `validUntil` is supplied, it must be later than
  `checkedAt` and still in the future when Brisk evaluates it.
- `stale`: the provider found a source revision or condition that invalidates
  the cached evidence.
- `unknown`: the provider cannot prove either fresh or stale, for example when
  the upstream source cannot be reached.

On a cache hit, Brisk follows this fixed decision flow:

1. If the provider has no `checkFreshness`, Brisk can use only the bounded cache
   TTL. This remains cache freshness, not source-freshness proof.
2. A valid `fresh` assessment allows reuse.
3. A `stale` assessment or expired `validUntil` deletes the cache entry and
   calls `refresh` when the provider implements it; otherwise Brisk calls
   `acquire` again.
4. An `unknown`, failed, timed-out, or invalid assessment deletes the cache
   entry and reacquires. Brisk does not silently trust the old evidence.
5. Cancellation stops the freshness check and does not start refresh or
   reacquisition work after the stop request.
6. Refresh and reacquisition responses pass the same contract, consistency,
   resource, authority, merge, and compilation checks as the original result.

This proves the shared refresh mechanism, not that every real provider can
detect upstream changes. Each production provider still needs reference-app
proof for its own revision, ETag, file digest, runtime observation, or equivalent
freshness method.

### Retention and eviction

The default cache keeps at most 64 entries for five minutes. It uses
least-recently-used eviction: when the bound is exceeded, the entry unused for
the longest time is removed. Expired entries are removed when accessed or when
new entries are stored. Clearing the cache removes every retained provider
result. A zero TTL or zero entry limit disables caching.

Only provider responses that pass both the versioned contract check and the
requirement-consistency checks enter the cache. Failures, timeouts, cancelled
attempts, and invalid responses are never cached.

## Provider response limits

Provider code runs inside the host process today, so a response must be bounded
before Brisk merges or retains it. The defaults are:

| Limit | Default | Purpose |
| --- | ---: | --- |
| response bytes | 10,485,760 | prevent oversized serialized results |
| evidence graphs | 16 | prevent graph fan-out |
| operations across all graphs | 10,000 | prevent excessive compiler work |
| artifacts | 1,000 | prevent artifact-reference flooding |

Crossing any one limit makes the provider response invalid for that attempt.
No graph from that response is merged or cached. These limits contain returned
data, but they do not sandbox provider CPU, filesystem, or network access.
Provider sandboxing and enforced network policy remain open security work.

## Outcomes and safety

- A provider can satisfy all requirements, satisfy some and report the rest as
  unsatisfied, or report all as unsatisfied.
- Partial evidence is preserved and can support the next bounded compilation round.
- A provider that exceeds its time limit is stopped through an abort signal;
  the caller also enforces the limit if the provider ignores that signal.
- A caller cancellation is passed to the provider.
- A provider exception is contained. Its raw message is not copied into
  planning diagnostics because it may contain secrets.
- Malformed responses, unknown requirement IDs, inconsistent satisfied and
  unsatisfied lists, and false satisfaction without an evidence graph are
  blocked as provider-contract failures. These are internal failures, not
  application test verdicts.
- When no provider can obtain the required evidence, Brisk returns an explicit
  planning failure and never fabricates an executable test.

## Configuration

```ts
defineConfig({
  // Existing application, runtime, discovery, and security settings...
  planning: {
    evidenceAcquisitionRounds: 2,
    evidenceProviderTimeoutMs: 30_000,
    evidenceCacheTtlMs: 300_000,
    evidenceCacheMaxEntries: 64,
    evidenceMaxResponseBytes: 10_485_760,
    evidenceMaxGraphsPerResponse: 16,
    evidenceMaxOperationsPerResponse: 10_000,
    evidenceMaxArtifactsPerResponse: 1_000,
  },
  evidenceProviders: [myEvidenceProvider],
});
```

`evidenceAcquisitionRounds` accepts 0 through 5. The default is 2. A value of 0
disables post-compilation acquisition. `evidenceProviderTimeoutMs` accepts 1
through 3,600,000 milliseconds. Its default is the smaller of the run timeout
and 30 seconds. `evidenceCacheTtlMs` accepts 0 through 86,400,000 milliseconds;
the default is 300,000. `evidenceCacheMaxEntries` accepts 0 through 1,024; the
default is 64. Setting either cache value to 0 disables reuse.

Response-byte limits accept 1,024 through 104,857,600. Graph limits accept 1
through 1,024. Operation limits accept 1 through 100,000. Artifact limits
accept 0 through 10,000.

The recommended public helper contract is `EvidenceProviderV2`. A helper must
declare `schemaVersion: 'brisk-aitesting.evidence-provider.v2'`,
`execution: 'trusted-in-process'`, a non-empty `revision`, and return
`brisk-aitesting.evidence-acquisition-output.v1`.

Version 2 receives a reduced view rather than the whole Brisk configuration.
Raw authentication values, AI keys, unrelated metadata, engines, adapters, and
host functions are excluded. Known secret values in discovery, intent, or
existing evidence are redacted. Approved environment-variable names can be
passed as secret references; their values are not resolved for the helper.

The older `EvidenceProviderV1` contract receives the full context and is
blocked by default. It can be temporarily enabled through
`allowLegacyFullContextEvidenceProviders` only for reviewed trusted code.

`tenantId`, when present on run input, is copied into the helper request and
cache identity. With `requireEvidenceProviderTenantId` enabled, missing or
malformed scope is blocked before a helper runs. This prevents cross-tenant
cache reuse; the host remains responsible for authenticating the caller and
authorizing the tenant.

Absolute HTTP/WebSocket destinations returned inside operation details must
match Brisk's network policy. Artifact paths must remain inside the configured
artifact directory. Failed responses are neither merged nor cached. These
checks control what Brisk accepts. They cannot prevent trusted in-process code
from directly using Node.js network or file APIs.

## Separate worker helpers

`EvidenceWorkerProviderV1` describes a helper module that Brisk launches in a
separate child process. Unlike a normal provider object, it declares supported
reason codes, semantic types, or capabilities as data; Brisk does not execute a
selection function from the worker in its main process.

The worker boundary provides:

- a 16–4,096 MB configured V8 memory ceiling;
- the normal provider time limit plus forced child termination;
- main-process survival when the worker crashes or runs a synchronous infinite loop;
- an empty environment by default, with explicit environment-variable names
  copied only when registered;
- the same reduced provider context, response contract, secret, tenant,
  destination, path, and size checks as trusted helpers;
- a structured execution record showing completion/crash/timeout/cancellation,
  forced termination, memory setting, and declared host file/network isolation.

The module exports an `EvidenceWorkerModuleV1` object with an `acquire` method.
The registration names the module path and export. Worker stdout/stderr is
drained but not copied into user diagnostics because it may contain secrets.

This child process is failure and resource containment, not a complete OS
sandbox. It runs as the same user and can directly use files and networking.
`hostIsolation.filesystem` and `hostIsolation.network` must say
`not-enforced` unless a trusted host/container actually applies those controls.
`requireEvidenceWorkerHostIsolation` blocks workers that do not declare both
controls as host-enforced, but Brisk cannot independently verify the host's
claim.

## Provider conformance gate

`runEvidenceProviderConformance` is the reusable quality gate for an evidence
provider. The host supplies one safe, deterministic requirement that the
provider is expected to answer. The gate returns a versioned report; it does
not throw merely because the provider fails a check.

The three check states mean:

- `passed`: the named behavior was exercised and produced the required result;
- `failed`: the behavior was exercised, missing, invalid, unsafe, or did not
  finish within its bound;
- `not-applicable`: the case did not claim that optional behavior. This is
  visible and is not silently counted as a pass.

| Check area | What it means | How Brisk recognizes it | Decision |
| --- | --- | --- | --- |
| identity | the provider can be addressed and invalidated safely | non-empty ID/revision and the supported provider contract version | fail the report when invalid |
| selection | the provider can answer at least one supplied requirement | `supports` completes and returns true for a scoped requirement | fail when selection throws or accepts none |
| acquisition | the provider returns useful, consistent evidence on time | the normal acquisition path validates shape, IDs, graphs, limits, and timeout | fail and exclude invalid output |
| secret-shaped output | obvious token formats did not enter returned evidence | the same detector used by existing extension conformance scans the result | fail the report; never treat this scan as complete secret detection |
| freshness | cached evidence is rechecked as claimed | a second bounded request records the provider freshness check | reuse, refresh, or reacquire according to the declared probe |
| refresh | stale evidence is replaced through the provider refresh path | the second request records the provider ID in refreshed sources | fail if refresh was claimed but did not run successfully |
| cancellation | a cancellation-safe probe stops without returning success | the gate aborts the supplied provider call and waits only for the configured bound | fail if it succeeds after cancellation or ignores cancellation until timeout |
| disposal | declared resources can be released | `dispose` completes inside the same bound | fail on absence when required, exception, or timeout |

### Why the cancellation probe is explicit

Some real acquisitions legitimately finish almost immediately. A general test
cannot distinguish that from a provider that ignored a stop request. Set
`cancellationProbe: true` only when the supplied conformance requirement is
designed to remain pending until its signal is aborted. A provider that returns
successful evidence after that abort, or remains pending past the bound, fails.

### Why optional checks are not hidden

Freshness, refresh, cancellation probing, and disposal depend on what a
provider declares and what safe fixture the host can supply. When a case does
not require one, the report says `not-applicable`. When a case requires it and
the provider omits or fails it, the report fails. This distinction prevents
“not tested” from being presented as “passed.”

### Current proof and limits

The repository conformance smoke exercises seven in-process synthetic
providers: one conforming provider and six deliberately bad providers covering
timeout, malformed output, excessive response size, obvious secret leakage,
cancellation ignored, and disposal failure. This proves that the shared gate
detects those fixtures. It does not certify an arbitrary third-party provider,
a real upstream system, hidden secret formats, operating-system process
isolation, CPU/memory quotas, filesystem restrictions, network enforcement, or
tenant separation. Those controls remain separate open security work.
