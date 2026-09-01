# Execution Fabric Security Boundary

The Atlas Execution Fabric contains protected execution IP.

## Deployment

`.vercelignore` excludes:

- `execution/runtimes/`
- `execution/adapters/`
- `execution/core/`
- `execution/contracts/`

Only generic browser UI helpers under `execution/ui/` are deployed. They contain no runtime projection data and receive protected data only through authenticated/capability-gated APIs.

## Repository

A repository containing `execution/runtimes/malkom/engine-suite` **must be private**.

If the public Atlas source is ever hosted in a public repository, the protected Execution Fabric must move to either:

- a private Git submodule;
- a private package registry;
- a separate private monorepo package consumed during server build;
- another private source boundary with equivalent access control.

Vercel exclusion protects web deployment; it does not protect a public Git repository.

## Browser boundary

Public Atlas does not receive WorkDefinition/runtime payloads.

Authorized runtime users receive only the runtime data permitted by their capability grant. Admin/Governor access remains a separate stronger capability set.
