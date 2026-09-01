# Real-system reference applications

This folder contains only `brisk-aitesting` lab definitions and safe test
helpers. Vendor source stays in sibling folders under
`C:\Users\u306076\Documents\azure-pubsub` and is not copied into the npm
package.

`versions.json` is the source of truth for the exact cloned revisions and first
stable runtime versions. Secrets and live application data must not be added to
this folder. Runtime helpers must generate secrets in memory or accept secret
references from an ignored local environment.

Current state: repositories are acquired and recorded, and all three first
readiness checks pass. Real packed-product business-scenario tests remain open.

`compose.yaml` provides isolated first-start services:

- Directus at `http://127.0.0.1:18055`;
- Medusa PostgreSQL at `127.0.0.1:15432` and its helper-managed app at
  `http://127.0.0.1:19000`;
- n8n at `http://127.0.0.1:15678`.

The Compose file refuses to start a service when its disposable local-lab
secret is absent. `.env.example` contains names and placeholders only. Create
an ignored `.env.local` once and use it again on every restart; changing an
encryption key while reusing application data correctly causes a startup
failure. Runtime values must not be committed or copied into test evidence.

The first attempt used an internal-only Docker network. On this Windows Docker
Desktop environment, container port bindings were configured but were not
published, so the laptop could not call the applications. The lab now uses a
normal bridge network, binds every exposed port to `127.0.0.1` only, and disables
Directus/n8n telemetry or external template/version checks. Full enforceable
outbound-network denial remains a separate security proof; this setup must not
be described as that proof.

n8n's source inspection and first runtime logs showed that disabling telemetry,
templates, and version checks did not disable its separate public MCP registry
refresh. The lab therefore disables the `mcp-registry` module explicitly. It
also disables Python Code-node execution because the selected repository was
approved as a TypeScript/Vue system and this first proof must not silently add a
Python runtime requirement. JavaScript task execution remains available.

## Repeatable commands

Run these commands from this folder:

```text
node lab.mjs doctor --json
node lab.mjs pull all
node lab.mjs start all
node lab.mjs status --json
node lab.mjs stop all
```

`doctor` checks the exact clean clones, Docker, Compose, and ignored local secret
file. `status` performs the real readiness requests and never prints the
Directus token or local passwords. Medusa database readiness and Medusa app
readiness are intentionally separate. `start medusa` and `start all` start the
database first and then the exact recorded Medusa application on port 19000;
`stop` terminates only the process identity recorded by this helper. If another
process already owns a ready Medusa address, the helper refuses to adopt or
stop it.

Reset is destructive only to the named disposable lab containers and volumes,
so it requires an explicit confirmation flag:

```text
node lab.mjs reset --confirm-disposable-data
```

No readiness command claims that `brisk-aitesting` has discovered, compiled, or
executed a real business scenario. Those proofs remain separate checkpoints.

## Common application description

`applications.json` describes all three applications in one shared shape. In
plain language, it records where an application is, which computer addresses
may be contacted, where login information will be looked up without storing its
value, which local data belongs to the lab, what may be cleaned, how readiness
is observed, which information sources are authoritative, and which foundation
behaviors are exposed.

Labels such as HTTP, GraphQL, workflow, event, mutation, and cleanup describe
foundations. They do not select vendor-specific compiler rules. An application
name is identity for reports only; it is not permission to guess an operation,
payload, permission, or cleanup action.
