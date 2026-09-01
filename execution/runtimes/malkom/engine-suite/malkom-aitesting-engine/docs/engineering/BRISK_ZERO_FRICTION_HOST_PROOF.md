# Brisk Zero-Friction Host Proof

Date: 2026-08-11

## What was connected

Brisk consumes `brisk-aitesting` from GitHub commit
`54c863338f70e09988d932d7a22b0bc38be3fb15`. Its host bridge now calls
`defineHostConfig` with Brisk's application URL, repository path, existing AI
completion function, short-lived authentication, run settings, and discovery
choices. Brisk does not select a `brisk-aitesting` AI vendor. The provider used
for this proof happened to be DeepSeek because that was Brisk's stored setting.

The public setup is implemented by:

- `src/host-config.ts` in `brisk-aitesting`;
- `docs/HOST_INTEGRATION.md` in `brisk-aitesting`;
- `packages/server/package.json` in Brisk; and
- `packages/server/src/domains/testing-aitesting.ts` in Brisk.

## What was tested

Brisk's authenticated `POST /api/testing/generate` path was used. This is the
same server action invoked by the Testing page's Generate button. The final
accepted request asked for one logical complex journey. The real AI response
was compiled into seven dependent operations:

1. create a unique channel;
2. create a topic using the channel output;
3. create a subscription using the channel and topic outputs;
4. publish a unique message using the topic output;
5. delete the subscription;
6. delete the topic; and
7. delete the channel.

Brisk then created and executed run
`43db9b98-41de-45ec-9651-c909e6915166` through the stored-plan execution path.

## Accepted result

- AI generation time: 25,573 ms.
- AI tokens recorded by the Brisk host bridge: 4,204.
- Logical tests: 1 total, 1 passed, 0 failed, 0 skipped.
- Compiled dependent operations: 7.
- Execution time: 752 ms.
- Validation warnings: 0.
- Final run status: `passed`.
- Brisk result page:
  `http://localhost:5173/testing/runs/43db9b98-41de-45ec-9651-c909e6915166`.

One logical test does not mean one HTTP check. It means the user asked one
connected business question and the product retained one verdict while keeping
all seven dependent operations visible underneath it.

## Normal-prompt reliability rerun

On 2026-08-11 a user-visible failure reported
`scenarios.0.actions must be a non-empty array`. Inspection found that semantic
intent parsing had no provider-driven repair loop even though the host exposed
three repair attempts. `AiIntentPlanner` now asks the same host provider to
repair an invalid intent using the exact validation error, original semantic
vocabulary, and bounded attempt count. It does not create missing actions
locally.

TCV-0002 proves both boundaries: invalid-empty-actions then valid recovery uses
two provider calls; an always-invalid provider stops after two configured
repairs (three total calls) with the original actions error.

After Git commit `004285d460728e4e1f12a6b0ae2977cd39c329ce` was installed
into Brisk and the app was restarted, a normal user-style prompt asked only to
test channel, topic, subscription, message, successful outcomes, and cleanup.
It did not provide routes, operation IDs, payload fields, or internal compiler
instructions. Run `57b380f0-28f6-44b9-a48d-9fff1f170c50` produced:

- 35,921 ms generation time;
- 5,557 recorded AI tokens;
- seven linked create/publish/delete operations;
- one logical test, one passed, zero failed, zero skipped;
- 1,187 ms execution time;
- zero validation warnings; and
- final status `passed`.

Result page:
`http://localhost:5173/testing/runs/57b380f0-28f6-44b9-a48d-9fff1f170c50`.

## Defects exposed before the pass

The accepted result was not obtained by hiding earlier failures:

- Brisk initially ran without its database even though the shallow health
  route responded; the Docker services were started before testing continued.
- Node did not trust the corporate Zscaler root. A local public certificate
  copy was supplied through `NODE_EXTRA_CA_CERTS`; TLS verification remained
  enabled.
- Brisk initially sent a provider-specific JSON-schema response control. Some
  configured providers reject it, so the host now requests a portable JSON
  object and lets `brisk-aitesting` validate the result.
- A fixed 120-second provider timeout contradicted Brisk's 300-second Testing
  setting. The bridge now uses the host setting.
- Empty AI warning strings caused an otherwise meaningful intent to fail. The
  package now removes only empty warning text; it still rejects empty actions,
  assertions, outcomes, evidence, or missing values.
- Brisk's authoritative-operation list lacked the stable operation IDs carried
  by its evidence graph. The exact IDs are now paired; unknown mutations remain
  blocked.
- One diagnostic command continued after a generation error and created a
  `No tests found` run. The final driver used terminating error behavior, so a
  generation failure cannot create an empty run.

## What this does not prove

This is one real Brisk host-integration proof, not application-wide or release
proof. It does not prove hundreds of scenarios, UI button clicking, browser
snapshots, least-privilege roles, negative permission behavior, forced cleanup
failure, stress/load, memory use, provider comparison, Directus, Medusa, n8n,
Linux/macOS, or production safety. Those remain separate open gates.
