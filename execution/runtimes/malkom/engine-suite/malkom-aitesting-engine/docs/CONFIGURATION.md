# Configuration

Normal users should use `defineHostConfig` or environment-only setup. Manual
internal configuration remains available for advanced integrations.

## Recommended Minimal Config

```js
import { defineHostConfig } from 'brisk-aitesting';

export default defineHostConfig({
  app: {
    name: 'My SaaS',
    baseUrl: 'http://localhost:3000',
  },
});
```

The same setup can be code-free:

```bash
BRISK_AITESTING_APP_NAME=My SaaS
BRISK_AITESTING_BASE_URL=http://localhost:3000
BRISK_AITESTING_EXECUTION=preview
```

The complete environment catalogue, precedence, defaults, AI callback, and
short-lived authentication examples are in [Host Integration](HOST_INTEGRATION.md).

## Advanced Manual Config

The CLI creates `brisk-aitesting.config.mjs` by default. JSON, YAML, and YML config files are also supported for teams that prefer config without executable code.

```js
import { defineConfig } from 'brisk-aitesting';

export default defineConfig({
  app: {
    name: 'My SaaS',
    baseUrl: 'http://localhost:3000',
    repoPath: '.',
    env: 'local',
  },
  auth: { type: 'none' },
  runtime: {
    artifactsDir: '.brisk-aitesting/artifacts',
    timeoutMs: 120000,
    retries: 1,
    headless: true,
    dryRun: false,
    // Optional: launch a system-installed Chromium/Chrome instead of
    // Playwright's downloaded browser — for hosts where downloading one is
    // impossible or forbidden (locked-down CI, air-gapped machines).
    // Env: BRISK_AITESTING_BROWSER_EXECUTABLE_PATH.
    // browserExecutablePath: '/usr/bin/chromium',
  },
  discovery: {
    includeRepo: true,
    includeUi: true,
    includeApi: true,
    includeContracts: true,
    maxSourceFiles: 20000,
    uiRoutes: ['/'],
    apiRoutes: [{ method: 'GET', path: '/api/health' }],
  },
  security: {
    networkPolicy: 'localhost-only',
    allowedHosts: ['localhost', '127.0.0.1', '::1'],
    redactSecrets: true,
    strictMode: true,
    allowFallbackTargets: false,
    allowHeuristicWorkflowCapture: false,
    uiHealing: 'safe',
    allowLegacyFullContextEvidenceProviders: false,
    requireEvidenceProviderTenantId: false,
    requireEvidenceWorkerHostIsolation: false,
  },
});
```

## App

| Field | Meaning |
|:------|:--------|
| `name` | Product name shown in results |
| `baseUrl` | Running app URL |
| `repoPath` | Local repo path used for discovery |
| `env` | Local, CI, staging, or production-like |

## Auth

Supported today:

| Type | Use |
|:-----|:----|
| `none` | Public pages or unauthenticated APIs |
| `credentials` | Username/password flows |
| `bearer` | APIs with bearer tokens |
| `custom` | Host-owned auth metadata |

## AI Provider

Prefer the product namespace:

```bash
BRISK_AITESTING_AI_PROVIDER=openai-compatible
BRISK_AITESTING_AI_ENDPOINT=https://your-gateway.example.com/v1
BRISK_AITESTING_AI_MODEL=your-model
BRISK_AITESTING_AI_API_KEY=your-key
```

Then map it:

```ts
ai: {
  provider: 'openai-compatible',
  endpoint: process.env.BRISK_AITESTING_AI_ENDPOINT,
  model: requiredEnv('BRISK_AITESTING_AI_MODEL'),
  apiKeyEnv: 'BRISK_AITESTING_AI_API_KEY',
}
```

Provider-specific environment variables are compatibility aliases. Product integrations should prefer `BRISK_AITESTING_*`.

The built-in provider path supports:

| Provider value | Meaning |
|:---------------|:--------|
| `openai-compatible` | Any chat-completions-compatible endpoint. `ai.endpoint` (or `BRISK_AITESTING_AI_ENDPOINT`) is required — no vendor endpoint, model, or key variable is hardcoded in the engine. |

For any other wire protocol, use the `AiPlannerProvider` interface and pass your provider adapter through SDK configuration. Do not put unimplemented provider names in config.

With an `aiProvider`, the default planner requests non-executable `brisk-aitesting.intent.v1` and compiles it against authoritative capability evidence. Configure `contracts.openApiPath` for OpenAPI applications. For host-owned operation registries, configure `capabilityAdapters` and pass an `evidenceGraph` with the run input. See [UNIVERSAL_COMPILER.md](UNIVERSAL_COMPILER.md).

## Missing-information planning

When compilation finds an evidence gap, registered `evidenceProviders` can
obtain the missing information and trigger automatic recompilation.

| Field | Default | Allowed | Meaning |
|:------|:--------|:--------|:--------|
| `planning.evidenceAcquisitionRounds` | `2` | integer `0..5` | Maximum bounded rounds; `0` disables acquisition |
| `planning.evidenceProviderTimeoutMs` | smaller of run timeout and `30000` | integer `1..3600000` | Maximum time for one provider call |
| `planning.evidenceCacheTtlMs` | `300000` | integer `0..86400000` | How long a validated in-memory result can be reused; `0` disables cache reuse |
| `planning.evidenceCacheMaxEntries` | `64` | integer `0..1024` | Maximum in-memory results retained; `0` disables cache reuse |
| `planning.evidenceMaxResponseBytes` | `10485760` | integer `1024..104857600` | Maximum serialized provider response size accepted for merging |
| `planning.evidenceMaxGraphsPerResponse` | `16` | integer `1..1024` | Maximum evidence graphs accepted from one provider response |
| `planning.evidenceMaxOperationsPerResponse` | `10000` | integer `1..100000` | Maximum combined operations accepted from one provider response |
| `planning.evidenceMaxArtifactsPerResponse` | `1000` | integer `0..10000` | Maximum artifact references accepted from one provider response |

The cache is memory-only and bounded. Providers may implement `checkFreshness`
and `refresh` to validate their upstream source. Unknown or invalid source
freshness causes reacquisition rather than silent cached reuse. See
[EVIDENCE_PROVIDERS.md](EVIDENCE_PROVIDERS.md) for the exact full, partial,
missing, invalid, digest, freshness, invalidation, refresh, retention, and
resource-limit rules.

## Missing test data (fixtures)

| Field | Default | Allowed | Meaning |
|:------|:--------|:--------|:--------|
| `planning.fixtures` | `require-existing` | `require-existing`, `provision-when-missing` | Whether a missing required value may be satisfied by provisioning a self-cleaning fixture from a declared host/contract creation operation with a `cleanupOperationId` |

Host-facing form: `fixtures: 'provision-when-missing'` on `defineHostConfig`,
or `BRISK_AITESTING_FIXTURES`. Under the default `require-existing` policy the
engine never creates business entities; a check whose data is absent is called
out in `plan.warnings`/`plan.fixtureProvisioning` at planning time and fails
with a `precondition` diagnosis at run time. The full safety rules are in
[FIXTURE_PROVISIONING.md](FIXTURE_PROVISIONING.md).

## Optional Adapter Commands

Third-party adapters are local and opt-in.

The default package install does not force heavy adapter runtimes into the host application:

```bash
npm install "git+https://github.com/oshjain/brisk-aitesting.git#<reviewed-commit-sha>"
```

Install enhanced adapter runtimes only in the app/package that will run them:

```bash
npm install specmatic
npm install @pact-foundation/pact
```

For pnpm monorepos:

```bash
pnpm add specmatic --filter <your-backend-package>
pnpm add @pact-foundation/pact --filter <your-backend-package>
```

| Setting | Meaning |
|:--------|:--------|
| `BRISK_AITESTING_SCHEMATHESIS_COMMAND` | Path or command name for Schemathesis. Defaults to `st`. |

Specmatic is loaded through the host-installed `specmatic` npm runtime and still needs Java available on the machine. Schemathesis is a Python runtime and should be installed outside npm.

## Advanced Host Mapper

Most hosts should use `defineHostConfig`. If an enterprise host intentionally
needs every internal setting, it may map its existing structure:

```ts
import { defineConfigFromHost } from 'brisk-aitesting';

export default defineConfigFromHost(hostConfig, (host) => ({
  app: {
    name: host.appName,
    baseUrl: host.publicBaseUrl,
    repoPath: host.repoRoot,
  },
  auth: host.auth,
  ai: host.ai,
  runtime: host.testing.runtime,
  discovery: host.testing.discovery,
  security: host.testing.security,
}));
```

The host must define the `hostConfig` shape in its own code. This mapper does
not automatically discover provider settings, credentials, routes, selectors,
permissions, or cleanup behavior. Configuration validation occurs when the
mapped value is consumed by `createBriskAiTesting` or `loadConfig`.

For the complete install-to-result path—including runtime-selected AI,
authentication, trusted operation evidence, preview versus execution, cleanup,
result handling, and verification—follow the
[Host Integration Guide](HOST_INTEGRATION.md).

## Security Defaults

Default behavior is local-first:

- network policy: `localhost-only`
- secret redaction: on
- strict plan validation: on
- fallback target execution: off
- UI healing: safe mode
- old helpers that receive passwords and the full run context: blocked
- helper tenant ID: optional unless the host requires it
- separate helper-worker file/network isolation: reported, but host enforcement is optional unless required
- no hosted dashboard required
- no database required

| Setting | Default | Meaning |
|:--------|:--------|:--------|
| `strictMode` | `true` | Intent, compiler output, lowered plans, and legacy executable plans must pass their deterministic gates. |
| `allowFallbackTargets` | `false` | Brisk will not run a scenario against an invented target when discovery could not prove the target. |
| `allowHeuristicWorkflowCapture` | `false` | Brisk will not guess workflow IDs from API responses unless explicitly enabled. Semantic compilation derives captures from typed evidence. |
| `uiHealing` | `safe` | Brisk may try low-risk selector recovery. Destructive actions are not healed in safe mode. |
| `allowLegacyFullContextEvidenceProviders` | `false` | Blocks old helpers that receive the complete configuration and run input. Enable only for reviewed trusted code during migration. |
| `requireEvidenceProviderTenantId` | `false` | Blocks missing-information acquisition unless the run input contains a valid explicit `tenantId`. |
| `requireEvidenceWorkerHostIsolation` | `false` | When enabled, refuses to start a separate helper worker unless trusted host configuration declares both file and network isolation as host-enforced. |

`tenantId` belongs on the individual run input, not global configuration. It
separates helper requests and cached information for different customers. The
host must still verify who the caller is and which tenant that caller may use.

The worker-isolation declaration is not self-proving. Use the required setting
only with a launcher, container, or host policy that actually establishes the
declared file and network restrictions.
