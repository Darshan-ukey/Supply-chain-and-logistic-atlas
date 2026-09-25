# Getting Started

This is the shortest honest path from installation to a first result.

## 1. Install from a pinned Git commit

The public npm package is deprecated for current development.

```bash
npm install "git+https://github.com/oshjain/brisk-aitesting.git#<reviewed-commit-sha>"
```

For a pnpm monorepo:

```bash
pnpm add "git+https://github.com/oshjain/brisk-aitesting.git#<reviewed-commit-sha>" --filter <your-backend-package>
```

Commit the lockfile so a later Git push cannot silently change the installed
code. Install Playwright in the same runtime package only when it is not already
available:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## 2. Create the ready setup

```bash
npx brisk-aitesting init --app-name "My App" --base-url http://localhost:3000
```

This creates a minimal `brisk-aitesting.config.mjs` and
`.env.brisk-aitesting.example`. It does not overwrite either file and does not
generate real secrets.

The generated config is intentionally small:

```js
import { defineHostConfig } from 'brisk-aitesting';

export default defineHostConfig({
  app: {
    name: 'My App',
    baseUrl: 'http://localhost:3000',
    repoPath: '.',
  },
});
```

Alternatively, skip the config file and create `.env.brisk-aitesting`:

```bash
BRISK_AITESTING_APP_NAME=My App
BRISK_AITESTING_BASE_URL=http://localhost:3000
BRISK_AITESTING_REPO_PATH=.
BRISK_AITESTING_EXECUTION=preview
```

## 3. Add AI only when needed

```bash
BRISK_AITESTING_AI_PROVIDER=openai-compatible
BRISK_AITESTING_AI_MODEL=your-model
BRISK_AITESTING_AI_ENDPOINT=https://your-provider.example.com/v1
BRISK_AITESTING_AI_API_KEY=your-secret
```

The one built-in value is `openai-compatible`, and the endpoint is always
named explicitly — the engine hardcodes no vendor, model, or key variable.
An existing host can pass its own common `complete(request)` function for any
other provider family. This is provider-neutral design, not proof that every
provider has been tested.

## 4. Check setup

```bash
npx brisk-aitesting doctor
```

`doctor` checks the resolved host settings, application reachability, AI key
reference, contracts, auth reachability, browser, and optional tools.

## 5. Preview safely

```bash
npx brisk-aitesting run "Test login, dashboard, APIs, and permissions"
```

Preview is the default. A preview that executes nothing is not reported as a
passed test.

## 6. Enable real execution deliberately

Set this only for an isolated target with trustworthy authentication and
cleanup information:

```bash
BRISK_AITESTING_EXECUTION=enabled
```

For API mutations, provide trusted OpenAPI or host evidence. Strict mode blocks
invented routes and explains the missing information instead of guessing.

See [Host Integration](HOST_INTEGRATION.md) for environment settings, existing
AI/login callbacks, precedence, defaults, and advanced mapping. See
[Configuration](CONFIGURATION.md) for manual expert controls.

## Optional adapter runtimes

Install these only when used:

| Adapter | Additional runtime |
|:--------|:-------------------|
| Schemathesis | Python and Schemathesis |
| Specmatic | `specmatic` package and Java |
| Pact | `@pact-foundation/pact` |
