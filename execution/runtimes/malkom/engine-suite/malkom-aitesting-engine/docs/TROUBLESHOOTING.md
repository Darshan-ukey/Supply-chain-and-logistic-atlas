# Troubleshooting

This guide maps common failures to direct fixes.

## Missing Playwright

Error:

```text
Cannot find module '@playwright/test/package.json'
```

Fix:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## App Is Not Reachable

Symptoms:

- UI tests fail at page load
- API checks return network errors
- discovery finds defaults only

Fix:

- start the app
- confirm `app.baseUrl`
- check firewall, VPN, proxy, or container networking
- update `security.allowedHosts` if using staging

## AI Provider Fails

Symptoms:

- missing API key
- invalid JSON from provider
- TLS certificate error

Fix:

- set `BRISK_AITESTING_AI_API_KEY`
- set `BRISK_AITESTING_AI_MODEL`
- set `BRISK_AITESTING_AI_ENDPOINT` for gateways
- set `ai.caCertPath` or `NODE_EXTRA_CA_CERTS` for enterprise TLS

## UI Element Not Found

Why it happens:

- page changed after grounding
- element has no stable label, role, text, or test id
- auth redirected the page
- app loaded slowly

Fix:

- add test IDs or accessible labels
- confirm auth config
- increase `runtime.timeoutMs`
- use `uiActionFeedback: 'always'` for stronger grounding

## No Data To Test Against (Precondition Failures)

Symptoms:

- a check fails with `failureCategory: 'precondition'`
- the message reads like: `No org existed to test against: "List organizations" completed successfully but its response contained no value for step_x.orgId.`
- the plan already warned: `... the collection is empty in the target app`

This means every producing request succeeded, but the app simply held no data
for the check to act on. It is not an application defect and not a harness
defect.

Fix (any one of):

- create the missing resource in the target app before running
- declare a host/contract creation operation for that value type with a
  `cleanupOperationId`
- set `fixtures: 'provision-when-missing'` (or
  `BRISK_AITESTING_FIXTURES=provision-when-missing`) so Brisk provisions a
  self-cleaning fixture and removes it after the check

Details and safety rules: [FIXTURE_PROVISIONING.md](FIXTURE_PROVISIONING.md).

## OpenAPI Contract Not Found

Fix:

```ts
contracts: {
  openApiPath: './openapi.yaml',
}
```

The path is resolved from the current working directory unless you pass an absolute path.

## Clean Local Artifacts

```bash
npx brisk-aitesting clean
```

This removes Brisk-generated local artifacts and workspaces.

To also remove Playwright's standard output folders:

```bash
npx brisk-aitesting clean --include-playwright-output
```

Preview cleanup without deleting anything:

```bash
npx brisk-aitesting clean --dry-run
```

Use JSON output in CI or scripts:

```bash
npx brisk-aitesting clean --artifacts-dir .brisk-aitesting --dry-run --json
```
