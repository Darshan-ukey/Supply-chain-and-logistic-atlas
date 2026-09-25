# How Brisk Runs a Test: A Plain-Language Guide to Engines

This page explains the part of Brisk that actually does the work: **engines**.
If you have ever wondered "what happens after Brisk decides what to test,"
this is the answer.

Read this if you are choosing which kind of test to write, debugging why a
test ran the way it did, or building your own engine for something Brisk
does not cover yet (a database, a queue, a mobile app).

## What an engine is

An **engine** is the piece of code that takes one already-approved test step
and actually carries it out — clicking a button, sending an HTTP request,
reading a contract file, replaying a saved request. Nothing else in Brisk
is allowed to do that. The AI does not touch your app directly. The planner
does not touch your app directly. Only an engine does, and only after the
step has been checked and approved.

A simple example: if a test step says "call `GET /api/users/42` and expect a
200 response," the **API engine** is the piece that opens the network
connection, sends the request, reads the response, and checks it against
what was expected. If the step instead says "click the Save button," the
**UI engine** (Playwright) is the piece that finds that real button on a
real page and clicks it.

Brisk ships with several engines already built in, and you can add your own
for anything else — a database check, a message queue, a mobile app.

## How Brisk picks the right engine for a step

Every test step has a `type` — for example `api`, `ui`, `contract`, `schema`,
`replay`, or `message`. When it's time to run a step, Brisk asks each
registered engine, "can you handle this?" The first engine that says yes
runs the step. If no engine says yes, Brisk does not guess — it reports the
step as failed with a clear reason, rather than trying something unsafe.

## The built-in engines

### API engine — calling your HTTP endpoints

**What it's for:** any check that sends a real HTTP request and looks at
the response — status code, response body, headers.

**A concrete example:** "Call `POST /api/orders` with a test order and
expect a 201 response with an `id` field."

**What it actually does:**
- Builds the real URL and request body, filling in any placeholders (for
  example, a previous step's response can hand this step a value to use).
- Sends the request, but only if the target host is on the allowed list
  (by default, only `localhost` — see the security notes below).
- Checks the response in several possible ways: exact status code, a list
  or range of acceptable status codes, specific JSON fields, plain-text
  content, or — if you have an OpenAPI contract (a file that describes what
  your API is supposed to return) — it checks the whole response shape
  against that contract automatically.
- For actions that change something (like creating an order), it can take a
  "before" snapshot and an "after" snapshot to prove that a *rejected*
  action really did not change anything. This is how Brisk proves a
  security check actually blocked something, instead of just trusting the
  status code.

**What gets saved as proof:** the exact request and response (with
passwords, tokens, and similar values blanked out), which contract it was
checked against, and whether each individual check passed or failed.

**Current limits:** it checks JSON and plain-text responses well; it does
not yet deeply validate other response formats like XML or binary files.

### Contract engine — reading your API's contract file

**What it's for:** confirming that your OpenAPI file (JSON or YAML) is
valid and readable, and producing a plain summary of what it describes.

**What it actually does:** loads the file, checks that it parses correctly,
and lists out the operations it found (method, path, expected responses).

**What gets saved as proof:** a summary of the contract — title, version,
and every operation found in it.

**Current limits:** this engine reads OpenAPI files. It does not deeply
inspect other contract formats (like AsyncAPI) — that is handled by the
separate Message Contract engine below.

### UI engine (Playwright) — real browser actions

**What it's for:** any check that opens a real browser and interacts with a
real page — clicking, typing, checking that text appears.

**Why this one needs an extra safety step:** an AI cannot be trusted to
guess where a button "probably" is on your page — a guess like that can
click the wrong thing. So this engine always works in two steps:

1. **Look first.** Before doing anything, it opens the page and records
   every real, usable element it can see — buttons, links, form fields —
   each with its own ID (like `ui_el_004`) and where it found it (an
   accessible label, visible text, a stable test ID, and so on). This
   record is called **grounding evidence**, because every action that
   follows is grounded in something Brisk actually observed on the page,
   not something it assumed.
2. **Act second.** Every action in the test (click, fill in a field, check
   a box) refers back to one of those recorded element IDs. If an action
   points to an ID that was never recorded, it fails outright instead of
   guessing which element was meant.

**Self-healing:** if a page changes slightly between when it was recorded
and when the test runs (a button moved, its label changed a little), the
engine can re-look at the page once and try to find a close match — but
never for sensitive actions like "delete" or "submit payment," and never
more than one retry. Every healing attempt is recorded, including what
changed and whether it was accepted.

**What gets saved as proof:** a video/trace of the run, screenshots, the
list of elements it found on the page, the actions it took, and a record of
any healing attempts.

**Current limits:** it needs pages with reasonably accessible labels, text,
or test IDs to find elements reliably; a page with no such structure will
produce weak or no grounding evidence.

### Schema Fuzz engine — checking that bad input gets rejected

**What it's for:** proving your API safely rejects malformed requests,
without needing a heavy third-party tool.

**What it actually does:** for each operation in your OpenAPI contract that
takes a request body, it builds a deliberately broken example (a required
field left empty, the wrong data type, and so on) and sends it. "Safe"
means your API responds with a `400`–`499` error — it noticed the bad input
and rejected it cleanly, rather than crashing or, worse, silently accepting
it.

**Note:** this is a lightweight, always-available check. It is a different,
smaller tool than the optional Schemathesis adapter described below, which
does much deeper fuzzing but needs Python installed.

**Current limits:** by default it checks up to 10 operations per run (you
can raise this) and only operations whose contract makes a broken example
possible to construct.

### Replay engine — re-running a saved request

**What it's for:** quickly catching regressions by re-sending an HTTP
request you already know the expected outcome of, instead of re-planning
it from scratch every time.

**What it actually does:** reads a small list of declared requests from the
test step, sends each one, and checks the status code against what was
declared (or just "under 500" if nothing specific was declared).

**Current limits:** it replays plain, already-known requests — it does not
currently produce a detailed diff of what changed compared to the last
run; that is listed in the roadmap as future work.

### Live Message engine — testing message/event flows over HTTP

**What it's for:** systems where "publish an event" and "confirm it
arrived" both happen through HTTP endpoints your app exposes (for example,
a "publish" endpoint and a "check inbox" endpoint), rather than a direct
connection to a message broker.

**What it actually does:** calls the publish endpoint, then repeatedly
calls the verify endpoint (with a configurable number of attempts and a
short wait between each) until the expected result shows up or it runs out
of attempts.

**Current limits:** it only talks to brokers/queues through HTTP endpoints
your app exposes. It does not connect directly to a broker like Kafka or
RabbitMQ — those are listed as future work.

### Message Contract engine — reading your event contract file

**What it's for:** checking that an AsyncAPI file (the event/message
equivalent of an OpenAPI file) is valid, and summarizing the channels and
message types it describes.

**Current limits:** this is a shape/contract check, not a live test — it
confirms the contract file is well-formed, it does not publish or verify
real messages (that is what the Live Message engine above is for).

## Optional engines (need something extra installed)

These ship with Brisk but stay switched off until you install the extra
tool they depend on. If you ask for one without installing its dependency,
Brisk tells you clearly what is missing instead of pretending it ran.

| Engine | What it does | What you need to install first |
|:-------|:--------------|:--------------------------------|
| **Specmatic** | Runs deep contract tests against a live API, and can also spin up a fake ("mock") version of your API from its contract for other teams to test against. | The `specmatic` package, plus Java (Specmatic itself is written in Java — the app you're testing does not need to be). |
| **Pact** | Confirms your app can produce the exact event message that a consumer's contract expects. | The `@pact-foundation/pact` package. |
| **Schemathesis** | Deep, high-volume OpenAPI fuzz testing — sends many more request variations than the built-in Schema Fuzz engine. | Python, plus the `schemathesis` package. |

## Safety rules that apply to every engine, no exceptions

- **No engine invents an action.** Every action an engine performs was
  already checked and approved before the engine ever saw it. Engines
  execute; they do not decide what "seems reasonable" to try next.
- **Network policy is enforced before every request.** By default, only
  `localhost` is reachable. Anything else needs to be explicitly allowed in
  your configuration.
- **Secrets are removed from everything that gets saved.** Passwords,
  tokens, and similar values are blanked out of every saved request,
  response, and log before it is written to disk.
- **A change that deletes or creates something real always needs backing.**
  An engine will not perform a create/update/delete action unless there is
  a real contract, a real observed route, or explicit host-provided
  information proving that action is legitimate.

## What this document does not prove

This page explains what each engine is built to do and how it is meant to
behave, based on reading the current source code directly. It is not, by
itself, proof that every engine has been run against every kind of
real-world application — that separate proof (and its exact scope, counts,
and gaps) lives in `docs/engineering/CAPABILITY_MATRIX.md`,
`docs/engineering/CLAIM_LEDGER.md`, and `docs/engineering/REAL_SYSTEM_PROOF_LOG.md`.
If a claim in one of those files and a description here ever disagree,
those records are the authority, not this page.
