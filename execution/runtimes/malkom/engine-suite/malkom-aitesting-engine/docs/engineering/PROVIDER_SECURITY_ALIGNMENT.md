# Missing-information helper security alignment

Status: recommended path approved; core and child-worker boundary implemented with host sandbox proof still open  
Date: 2026-08-02

## Plain-language definition

A missing-information helper is an add-on that finds facts Brisk needs before
it can build a safe test. For example, one helper may read an OpenAPI file to
find an API address and another may inspect a running application.

Security for this helper means answering five separate questions:

1. Which application, user, or tenant may it inspect?
2. Which network addresses may it contact?
3. Which files may it read or write?
4. Can it see passwords, tokens, or unrelated environment values?
5. Can Brisk stop it when it consumes too much time, memory, or processing?

A configuration value that merely tells a helper what it should do is guidance.
An enforced control prevents or blocks the action even when the helper is
faulty or hostile. Brisk must not call guidance an enforced sandbox.

## What exists now

Built:

- Brisk sends each helper only the missing-information questions it claims to
  understand.
- Brisk gives each asynchronous helper call a time limit and a stop signal.
- Brisk blocks returned data that exceeds graph, operation, artifact, or byte
  limits.
- Brisk validates the returned shape and scans for several obvious token
  formats.
- Brisk provides the configured network rule and allowed-host list in the
  request scope.
- Version 2 helpers receive a reduced context without raw configured secrets or
  unrelated run metadata.
- Tenant identity is explicit and included in request/cache identity.
- Returned absolute destinations and artifact paths are checked before use.
- Optional child workers have memory bounds, forced stop, crash containment,
  and a minimal environment-variable list.

Partially built:

- Network policy is enforced by Brisk's built-in test runners, but a custom
  in-process helper can directly use Node.js networking and ignore the supplied
  allowed-host list.
- A trusted in-process helper that never yields can still block the main
  process. The child-worker option contains this case.
- Returned secret-shaped values are detected only for known patterns. This is
  not proof that every sensitive value is recognized.

Missing:

- Tenant authentication and authorization remain host responsibilities.
- Trusted in-process helpers have no file/network/CPU sandbox.
- Child workers use the same OS account, so real filesystem and network
  isolation still needs a host or container.
- Real provider, real multi-tenant host, cross-platform worker, and production
  isolation proof remain open.

Product decision resolved:

- Existing function-based helpers remain explicitly trusted; unknown helpers
  can use the separate worker contract. ADR-0006 records this decision.

Blocked by external dependency:

- Strong filesystem and network isolation ultimately depends on the operating
  system, container, or host sandbox. A normal Node.js function or same-process
  code wrapper cannot honestly provide that boundary by itself.

## Existing decisions that apply

- The core package must stay lightweight; heavier adapters belong in optional
  packages.
- Existing services and data flow must be reused.
- Security must be enforced by code, not only described in prompts or comments.
- No synthetic check may be presented as production isolation proof.

## Two valid implementation paths

### Path A — trusted in-process helpers plus an optional isolated-worker path

Existing helpers continue to work inside Brisk but are explicitly labelled
trusted. The core removes passwords and unrelated data from the helper context,
adds tenant scope, validates returned network destinations and file references,
and keeps response/time limits. A separate worker contract is then built for
untrusted helpers and can be combined with a host or container sandbox.

Benefits:

- preserves current host integrations;
- keeps the default package lightweight;
- delivers immediate secret, tenant, destination, and output improvements;
- is honest that trusted in-process code is not sandboxed.

Cost:

- teams must not load unknown in-process helper code;
- full CPU, memory, file, and network isolation arrives only through the
  separate worker path and its host sandbox.

### Path B — require every helper to run outside the main Brisk process

The current function-based registration is replaced or deprecated in favour of
a message-based worker interface. Brisk can terminate a stuck worker and keep
its own main work responsive. Strong file and network restrictions still need
an operating-system or container policy around that worker.

Benefits:

- clearer untrusted-code boundary;
- a stuck worker can be terminated without relying on the helper to cooperate;
- per-worker memory limits and crash containment become possible.

Cost:

- breaks or substantially changes existing provider integrations;
- adds worker startup, packaging, debugging, and cross-platform complexity;
- still cannot promise file/network isolation without host sandbox support;
- conflicts with the lightweight-core direction unless separated carefully.

## Recommendation

Use Path A. It matches the approved lightweight-core decision, preserves
existing integrations, and improves the information boundary immediately.
Design the optional worker path as a versioned boundary rather than pretending
that an in-process function is sandboxed. Do not mark provider security
complete until both the core controls and the selected isolation proof exist.

## Intentionally not building before approval

- no breaking replacement of the current provider interface;
- no claim that a same-process wrapper or child process alone is an OS sandbox;
- no invented tenant source or authorization policy;
- no platform-specific container requirement in the default package.
