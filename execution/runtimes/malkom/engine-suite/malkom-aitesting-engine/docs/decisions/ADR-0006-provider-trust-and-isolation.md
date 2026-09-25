# ADR-0006: Trusted in-process helpers with an optional isolated-worker path

- Status: accepted
- Date: 2026-08-02
- Decision owners: brisk-aitesting product owner and product engineering

## Context

Evidence providers are add-ons that gather facts Brisk is missing. The current
provider interface runs user-supplied JavaScript functions inside the Brisk
process. Brisk can limit how long it waits for asynchronous work and how much
returned data it accepts, but same-process code can access Node.js filesystem,
network, environment, and processing facilities directly. Passing an allowlist
to that code is guidance, not an enforced sandbox.

The existing normalized provider context can also expose authentication values,
AI keys, host extensions, and unrelated run metadata. Tenant identity is not a
first-class provider scope, so cache separation cannot be proven per tenant.

Authoritative inputs for this decision are the accepted lightweight-core
direction in ADR-0002, the existing function-based provider architecture, the
product security mandate, and the product owner's approval in the Codex task.

## Decision

Keep explicitly trusted in-process helpers for compatibility and lightweight
embedding. Introduce a safer provider contract whose default context excludes
raw secrets and unrelated host objects. Add explicit tenant scope and validate
returned network destinations and file references before evidence can be
merged or cached.

Build untrusted-provider execution as a separate, versioned worker boundary.
Do not describe in-process functions, same-process wrappers, or configuration
guidance as a sandbox. Strong filesystem and network isolation must be supplied
and proven by the operating system, container, or embedding host around the
worker.

Legacy providers that require the full context must be explicitly enabled and
remain classified as trusted code. They are not the secure default.

## Consequences

- Existing integrations have a documented migration path instead of an
  immediate forced rewrite.
- New providers receive less information by default.
- Tenant identity becomes part of acquisition scope and cache identity.
- Returned evidence cannot authorize network destinations outside the selected
  policy or expose artifact paths outside the configured artifact directory.
- The optional worker contract adds packaging and cross-platform proof work.
- A trusted in-process provider can still access the host through Node.js; only
  a worker plus host isolation can address that risk.

## Security impact

The decision reduces accidental secret exposure and cross-tenant cache reuse,
and blocks unsafe returned destinations and paths. It does not itself enforce
an operating-system boundary. Worker CPU, memory, termination, filesystem, and
network claims require separate implementation and adversarial proof.

## Observability impact

Provider reports must identify the trust/execution mode, tenant-scope presence
without exposing tenant data, policy rejections, timeout/termination outcomes,
and whether a control was enforced by Brisk or delegated to the host.

## Alternatives considered

Requiring every provider to run outside the main process immediately was
rejected because it would break the current embedding model, add mandatory
worker weight to the core, and still fail to provide filesystem/network
isolation without host support.

Keeping only the current in-process interface was rejected because it cannot
honestly satisfy the security mandate for untrusted extensions.

## Proof requirements

- prove raw configured secrets and unrelated metadata do not reach the safer context;
- prove tenant scope changes cache identity and required scope cannot be omitted;
- prove forbidden returned network destinations and unsafe file paths are blocked;
- prove legacy full-context use requires explicit opt-in;
- prove a stuck worker can be terminated and bounded independently;
- report operating-system and container isolation as unverified until tested on the declared host matrix.
