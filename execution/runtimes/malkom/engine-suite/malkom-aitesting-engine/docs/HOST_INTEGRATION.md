# Host Integration

A **host application** is any product that wants to run `brisk-aitesting`
through its own backend, UI, authentication, or AI connection. Brisk is one
example; the setup below is not tied to Brisk or to a particular framework.

Normal integration has two paths. Neither requires a custom TypeScript type,
mapper, engine list, or copied security configuration.

## Path 1: Environment-only

Create `.env.brisk-aitesting` in the application directory:

```bash
BRISK_AITESTING_APP_NAME=My Application
BRISK_AITESTING_BASE_URL=http://localhost:3000
BRISK_AITESTING_REPO_PATH=.
BRISK_AITESTING_EXECUTION=preview
```

Optional built-in AI connection:

```bash
BRISK_AITESTING_AI_PROVIDER=openai-compatible
BRISK_AITESTING_AI_MODEL=my-model
BRISK_AITESTING_AI_ENDPOINT=https://my-provider.example.com/v1
BRISK_AITESTING_AI_API_KEY=your-secret
```

Run:

```bash
npx brisk-aitesting doctor
npx brisk-aitesting run "Test login, dashboard, APIs, and permissions"
```

The CLI uses environment-only mode when the default config file is absent and
both `BRISK_AITESTING_APP_NAME` and `BRISK_AITESTING_BASE_URL` exist.

## Path 2: Ready Host Object

Run `npx brisk-aitesting init`, or create `brisk-aitesting.config.mjs`:

```js
import { defineHostConfig } from 'brisk-aitesting';

export default defineHostConfig({
  app: {
    name: 'My Application',
    baseUrl: 'http://localhost:3000',
    repoPath: '.',
  },
});
```

The function infers its TypeScript type and also works from JavaScript. It is
asynchronous so a host may create a short-lived session when execution starts;
the CLI and `loadConfig` await it automatically.

## Existing Host AI

The host may pass its existing common AI connection instead of selecting a
built-in provider:

```ts
export default defineHostConfig({
  app: {
    name: 'My Application',
    baseUrl: 'http://localhost:3000',
  },
  ai: {
    name: 'my-existing-ai-service',
    complete: (request) => myAiService.complete(request),
  },
});
```

`brisk-aitesting` receives only the common response. The host remains
responsible for native provider request format, keys, policy, and usage
accounting. The built-in environment path currently supports `openai`,
`openai-compatible`, `deepseek`, and `minimax`; other provider families need
the common `complete(request)` function until a tested built-in connector
exists.

## Existing Host Login

For real execution, a host can create short-lived authentication:

```ts
export default defineHostConfig({
  app: {
    name: 'My Application',
    baseUrl: 'http://localhost:3000',
  },
  run: {
    execution: 'enabled',
  },
  auth: {
    createSession: async () => ({
      type: 'bearer',
      token: await myAuthService.createShortLivedTestToken(),
    }),
  },
});
```

`createSession()` is not called in preview mode. Prefer a disposable,
least-privilege identity. Do not write a real token into the generated config.

## Environment Settings

Only the following product namespace is read. Arbitrary provider or secret
variables are not scanned.

| Setting | Required when | Meaning |
|:--------|:--------------|:--------|
| `BRISK_AITESTING_APP_NAME` | no object name | Name shown in results |
| `BRISK_AITESTING_BASE_URL` | no object URL | Complete HTTP(S) target URL |
| `BRISK_AITESTING_REPO_PATH` | optional | Source root; default `.` |
| `BRISK_AITESTING_APP_ENV` | optional | `local`, `ci`, `staging`, or `production-like` |
| `BRISK_AITESTING_EXECUTION` | optional | `preview` (default) or `enabled` |
| `BRISK_AITESTING_AI_PROVIDER` | built-in AI | `openai`, `openai-compatible`, `deepseek`, or `minimax` |
| `BRISK_AITESTING_AI_MODEL` | built-in AI | Model name |
| `BRISK_AITESTING_AI_ENDPOINT` | compatible/custom gateway | Provider base endpoint |
| `BRISK_AITESTING_AI_API_KEY` | built-in AI | Provider secret; never generated |
| `BRISK_AITESTING_AI_CA_CERT_PATH` | optional | Enterprise CA certificate |
| `BRISK_AITESTING_AI_MAX_TOKENS` | optional | Positive response-token limit |
| `BRISK_AITESTING_AI_TEMPERATURE` | optional | Number from 0 through 2 |
| `BRISK_AITESTING_AI_REPAIR_ATTEMPTS` | optional | Integer from 0 through 5 |
| `BRISK_AITESTING_AUTH_TYPE` | optional | `none` (default), `bearer`, or `credentials` |
| `BRISK_AITESTING_AUTH_TOKEN` | bearer auth | Bearer token |
| `BRISK_AITESTING_AUTH_LOGIN_URL` | optional credentials | Login path/URL |
| `BRISK_AITESTING_AUTH_USERNAME` | credentials | Test username |
| `BRISK_AITESTING_AUTH_PASSWORD` | credentials | Test password |
| `BRISK_AITESTING_OPENAPI_PATH` | optional | Trusted OpenAPI file |
| `BRISK_AITESTING_ASYNCAPI_PATH` | optional | Trusted AsyncAPI file |
| `BRISK_AITESTING_PACT_DIR` | optional | Pact contract directory |
| `BRISK_AITESTING_ARTIFACTS_DIR` | optional | Result folder |
| `BRISK_AITESTING_TIMEOUT_MS` | optional | Integer 1..3,600,000 |
| `BRISK_AITESTING_RETRIES` | optional | Integer 0..20 |
| `BRISK_AITESTING_HEADLESS` | optional | `true` or `false` |
| `BRISK_AITESTING_FIXTURES` | optional | `require-existing` (default) or `provision-when-missing`; see [Fixture Provisioning](FIXTURE_PROVISIONING.md) |

Environment-file order is `.env.brisk-aitesting.local`,
`.env.brisk-aitesting`, then the existing `.env.local` compatibility path.
Already-set process environment wins and is never overwritten by a file.

## Precedence and Defaults

The order is fixed:

1. explicit host-object value;
2. documented `BRISK_AITESTING_*` environment value;
3. safe default;
4. plain missing-information error when a required value remains absent.

Important defaults:

| Behavior | Default |
|:---------|:--------|
| Execution | preview only |
| Discovery | repository, UI, API, and contracts on |
| Browser | headless |
| Timeout | 120 seconds |
| Retries | 1 |
| Artifacts | `.brisk-aitesting/artifacts` |
| Local network | localhost only |
| Remote network | only the configured target hostname |
| Secret redaction | on |
| Strict validation | on |
| Invented fallback targets | blocked |
| AI-selected executable targets | blocked |
| UI healing | safe |

## Trusted Operations Still Matter

Configuration identifies the application; it does not prove that every AI
suggestion exists. For state-changing API work, provide trusted OpenAPI or a
host evidence graph with real routes, outcomes, value flow, and cleanup. When
that information is missing, strict mode refuses guessed execution and explains
what evidence is needed.

This requirement does not make normal setup longer: OpenAPI is one environment
path, and host-owned evidence is needed only when the application's operations
cannot be obtained from an authoritative contract or supported discovery.

## Generated Files and Safety

`npx brisk-aitesting init` creates:

- `brisk-aitesting.config.mjs` using `defineHostConfig`;
- `.env.brisk-aitesting.example` containing names/placeholders only; and
- the local artifact directory.

It does not overwrite either file on a repeated run and never inserts a real
secret. Copy the example to `.env.brisk-aitesting`, fill it locally, and keep
the secret-bearing copy out of version control.

## Advanced Mapping

`defineConfigFromHost(host, mapper)` remains available for an enterprise host
that intentionally needs full control over every internal setting. The host
owns the input type and mapping. This is an advanced compatibility path, not
normal onboarding.

See also [Configuration](CONFIGURATION.md), [API reference](API_REFERENCE.md),
[Security](SECURITY.md), and [Evidence authority](EVIDENCE_AUTHORITY.md).
