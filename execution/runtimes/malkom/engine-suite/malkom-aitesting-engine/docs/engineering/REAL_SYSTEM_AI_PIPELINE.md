# Real AI in the test pipeline

## Honest current answer

The product contains a connected AI planning path, but the current Directus,
Medusa, and n8n readiness results did not use it. Those 66 checks prove local
setup, pinned source, secret handling, and application readiness. They do not
prove AI-generated tests or business behavior.

The normal `smoke:ci` command uses fixed AI response fixtures. It does not call
a real model. The separate `smoke:real-ai` command calls the configured model,
but currently targets only a small built-in demo page and health API—and its
current run still fails before producing an executable plan. This demo is a
diagnostic only. It cannot approve an AI capability or real-system support.

Current real-target AI execution count:

The accepted world-class validation denominator is 300 distinct connected
real-AI scenarios: 100 each for Directus, Medusa, and n8n. The current accepted
total is 0/300. The historical Directus run lacks the newly required raw AI
response digest/token record and therefore does not count in this stricter
corpus. This is a baseline gap, not an application-support or benchmark pass.

| Target | AI-proposed business scenarios | Accepted | Executed |
| --- | ---: | ---: | ---: |
| Directus | 1 complex API journey (6 business actions) | 1 | 1 journey / 7 operations including cleanup |
| Medusa | 0 | 0 | 0 |
| n8n | 0 | 0 | 0 |

The Directus result first passed through the working-tree path and then passed
again on 2026-08-03 from `brisk-aitesting-0.2.0.tgz` installed into a newly
emptied npm project. The child run explicitly reported
`productLoad: clean-installed-package`. This is real-model, real-application,
packed-install API proof; it does not include Directus UI or GraphQL execution.

## What AI is allowed to do

AI receives the user's testing goal and a limited vocabulary derived from
application evidence. It may propose business intent such as "a permitted
editor creates a valid article and can read it back". It is required to return
strict structured data.

AI is not allowed to choose an executable URL, HTTP method, browser selector,
query, payload field, status code, script, command, credential, or cleanup
request. The fixed compiler must find those details in trusted evidence. If it
cannot find one safe unambiguous operation, execution must stop.

The intended connected flow is:

1. inspect the real application and collect redacted facts;
2. ask AI which business behavior is valuable to test;
3. reject malformed or invented AI output;
4. let deterministic code match the intent to trusted operations;
5. validate permissions, inputs, expected results, dependencies, and cleanup;
6. execute through the product's browser/API engines;
7. retain what AI proposed, what code accepted or rejected, what ran, and the
   actual application result.

## What counts as a full AI feature test

A full AI test must use the same packed-package path available to an installing
user. It must consume a real model response and carry that exact response
through safe parsing, trusted compilation, execution, cleanup, and reporting.
The record must identify the provider and model parameters without exposing a
key, plus latency and token counts when the provider supplies them.

Fixed responses remain essential for repeatable parser, rejection, timeout,
permission, and cleanup tests. They prove safety code. They do not prove that a
real model works with the product. Similarly, a real model call that never
reaches execution proves connectivity or a defect, not AI testing.

"Self-healing" follows the same rule. If fixed code re-finds an element from
live page facts without a model response, documentation must call it
deterministic recovery. An AI self-healing claim additionally requires a real
model response, a deliberately changed real page, safe acceptance or rejection,
an actual retry, and a recorded final result.

## Default complexity bar

AI acceptance starts with complex real-business journeys, not one-page or
one-endpoint demos. A qualifying journey combines the important surfaces of the
application; moves typed values between dependent steps; changes meaningful
state; checks at least one identity or permission boundary where applicable;
executes valid and invalid/refused behavior; includes a controlled middle
failure or delayed result; recovers without repeating an unknown mutation;
cleans test-created state; and verifies the final application state.

Small tests still diagnose a specific boundary quickly. They are supporting
evidence only and never the product's quality ceiling.

## Current real-provider result

On 2026-08-03 the existing real-provider smoke was run with the locally
configured provider secret kept out of output. Discovery completed, planning
started, and the 30-second planning limit expired. The retained journal contains
`STAGE_TIMEOUT` with "Planning timed out." The command reported:

- 0 planned scenarios;
- 0 executed scenarios;
- 0 passes and 0 failures;
- final status `skipped`;
- an empty top-level diagnosis list.

This is a failed proof, not a pass or a harmless skip. It also exposes a product
reporting defect: the journal knows the timeout, while the convenient diagnosis
shown to the user does not. The correction must first prove timeout reporting;
simply increasing the time allowance would hide that defect.

Older local artifacts show that the demo test has previously reached execution:
its health API passed while a generated UI assertion failed after grounding the
wrong visible element. That history is useful defect evidence, but it is not a
current pass and it is not evidence for the three real applications.

## Required proof before making an AI-testing claim

For each real application, reports must separate these counts:

- live surfaces discovered;
- scenarios proposed by AI;
- AI outputs rejected by schema or safety rules;
- scenarios matched to trusted application evidence;
- scenarios rejected for missing or conflicting evidence;
- scenarios executed;
- passed, failed, timed out, skipped, cleaned, and residual results.

Only the executed counts demonstrate testing depth. A source route, upstream
test file, AI suggestion, compiled plan, or ready application is not an executed
`brisk-aitesting` test.
