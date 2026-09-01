# Kept proof: real-AI Directus journey — 2026-08-11

## What ran

- Command: `npm run smoke:real-ai-directus`
- Application under test: real Directus 12.2.0 in Docker at `http://127.0.0.1:18055`
- AI: real MiniMax (model `MiniMax-M3`) through the product's normal planning path
- Product build: working tree at commit `094936c` plus the intent-schema fix
  committed right after this run (values list shape)
- Machine: Windows 11, Node 24.4.1

## Counts (from the saved result)

| What | Number |
| --- | --- |
| Checks asked for | 1 |
| Checks understood | 1 |
| Checks ready | 1 |
| Checks not ready | 0 |
| Logical tests passed | 1 of 1 (100%) |
| Failed / skipped / blocked / errors | 0 / 0 / 0 / 0 |
| Executed operations | 7 (create, read, publish, verify published, refuse missing title with HTTP 400, refuse forbidden delete with HTTP 403, cleanup with HTTP 204) |
| AI calls | 1 (0 errors) |
| AI tokens | 1,190 in / 1,783 out |
| Run time | 42.7 seconds |

## Cleanup and leftovers

Every harness cleanup deletion answered HTTP 204 (user, permissions, access,
policy, role, collection). Fresh re-queries afterwards found **0** matching
articles, **0** residual roles, **0** residual policies. No credential value
was printed anywhere.

## What went wrong first (kept honestly)

The first attempt failed before any test ran: MiniMax refused the intent
request with HTTP 400 because the request schema used a map with an
object-valued `additionalProperties`, which MiniMax's strict mode rejects.
That schema shape was introduced by the 2026-08-10 "deep connected AI
workflows" work — and no real-AI check had run since, so nothing caught it.
This is exactly why the automatic checks being AI-free is a real gap. The
schema now sends value entries as a named list, and this passing run is the
proof of the fix.

## Fingerprints (SHA-256) of the full evidence on the running machine

Full evidence lives in
`.brisk-aitesting-real-ai-directus/artifacts/run_23067efd-8624-4e02-939a-45876e058a88/`
(git-ignored, this machine only):

- `result.json` — `6cad2183d1919411dc3e690aad0e40ec26ee4649fef7b4f8af0852bcca2f32f3`
- `run.journal.jsonl` — `7702f66ade530f83a15a7138f2b59d0e4f2180765452043161aeaea1c8569b14`
- `ai/ai-usage.json` (AI record with request/answer fingerprints and redacted answer text) — `456a7c76c60dda75af0e89546712d339c61141a8f0b7144a412264328ea5f1ae`

## What this does not prove

One journey, one provider, one machine, API only. It does not prove Directus
UI or GraphQL testing, other models, other operating systems, Medusa, n8n,
load, or production readiness.
