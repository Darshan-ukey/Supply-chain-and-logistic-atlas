# Security

`brisk-aitesting` is designed to run inside the user's environment.

It does not require a hosted platform, a hosted database, or a remote dashboard.

## Core Rules

- AI output is never executed directly.
- AI must return a structured plan.
- The plan is normalized and validated before execution.
- Engines do execution.
- Results are written as local artifacts.
- Secrets are redacted by default.
- Network access is controlled by config.

## Network Policy

| Policy | Meaning |
|:-------|:--------|
| `localhost-only` | Only localhost, 127.0.0.1, and ::1 |
| `allowlist` | Only configured hosts |
| `open` | Any host reachable by the runtime |

Use `allowlist` for staging or controlled enterprise environments.

## Secret Handling

Set this unless you have a special reason not to:

```ts
security: {
  redactSecrets: true,
}
```

Brisk redacts common secret-looking keys and values in artifacts and plugin checks.

Typed workflows keep secret **references**, not resolved secret values. The
compiler's value-flow record is metadata-only and does not copy user values.
Before an AI intent request, Brisk rejects common raw credential patterns; the
same boundary check covers selected evidence bindings, constant generators,
compiler diagnostics, and conformance-tested outputs. See
[TYPED_VALUE_FLOW.md](TYPED_VALUE_FLOW.md) for the exact what/how rule and its
limits. Central secret resolution, universal redaction, and retention policy
remain Phase 7 work.

## AI Provider Boundary

AI intent providers receive the goal, requested counts/types, application
name/environment, and a small semantic vocabulary. They do not receive
operation bindings or a full discovery object on this path.

They do not receive permission to run shell commands. They do not write executable code that Brisk runs blindly.

For enterprise use, route AI calls through your approved provider, gateway, proxy, or local model endpoint.

## Artifacts

Artifacts can include:

- request/response evidence
- browser traces
- screenshots
- logs
- generated test files
- result JSON

Do not publish artifacts from sensitive environments without reviewing your own data rules.

## Recommended Production Posture

- use `allowlist`
- keep `redactSecrets: true`
- use short-lived test credentials
- run against safe test data
- store artifacts in a controlled location
- use a corporate AI gateway if source or route metadata is sensitive

## Missing-information helpers

A missing-information helper finds facts Brisk needs before it can safely build
a test. For example, it may read an API description and return the operations
that actually exist.

### What the safer helper receives

New helpers use `brisk-aitesting.evidence-provider.v2`. Brisk does not give this
helper raw login passwords, bearer tokens, AI keys, custom host functions, or
unrelated run metadata. It receives the application scope, the specific missing
question, safe limits, redacted existing information, and an optional tenant ID.
An approved secret is represented by its environment-variable name; its value
is not passed.

The older `evidence-provider.v1` receives the full information set and is
blocked by default. A host may enable it with
`allowLegacyFullContextEvidenceProviders: true` only after reviewing and
trusting that code. This is a migration escape hatch, not a sandbox.

### Tenant separation

`tenantId` is an explicit run-input field. It becomes part of the helper
request and saved-answer identity, so tenant A cannot reuse tenant B's cached
answer. Set `requireEvidenceProviderTenantId: true` when every helper request
must carry a tenant. Missing or malformed tenant IDs are blocked before the
helper runs.

The host still owns login and permission checks. A tenant string by itself does
not prove that its caller may access that tenant.

### Returned destinations and files

Brisk checks absolute HTTP and WebSocket addresses returned in operation
details against the configured network rule. A forbidden destination is
rejected and never merged or cached.

Returned artifact paths must remain inside `runtime.artifactsDir`. Traversal
paths and paths outside that directory are rejected. This controls what Brisk
accepts; it cannot stop trusted same-process code from directly calling Node.js
file or network functions.

### Honest isolation boundary

Version 2 helpers are marked `trusted-in-process`. Time and response limits are
enforced, but same-process code still has the permissions of the Brisk process.
ADR-0006 therefore provides a separate optional worker for unknown code. That
worker runs in a child process with a configured memory ceiling, a hard time
limit, forced termination, a minimal environment-variable list, and contained
crash reporting. A synchronous infinite loop cannot freeze the main Brisk
process.

The worker process still runs as the same operating-system user. By itself it
can read files and make network calls that user can access. Its registration
must therefore state whether the host or container enforces file and network
isolation. With `requireEvidenceWorkerHostIsolation: true`, Brisk refuses to
start workers that are not declared host-isolated. This declaration comes from
trusted host configuration; Brisk cannot independently verify an OS sandbox.

The synthetic security test deliberately demonstrates both facts: an
unisolated worker can read a repository file and call a local server directly,
and the required-isolation setting blocks that same unisolated worker before it
starts. Real container and cross-platform sandbox proof remains open.
