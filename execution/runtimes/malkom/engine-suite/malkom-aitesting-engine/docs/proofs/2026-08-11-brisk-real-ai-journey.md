# Kept proof: real-AI Brisk journey — 2026-08-11

## What ran

- Command: `npm run smoke:real-ai-brisk`
- Application under test: the real Brisk pub-sub platform (sibling project)
  running locally at `http://127.0.0.1:3000` with its own Postgres, Kafka,
  Redis, and RabbitMQ containers
- AI: real MiniMax (model `MiniMax-M3`) through the product's normal planning path
- Machine: Windows 11, Node 24.4.1

## The journey (one connected workflow, 8 executed operations)

1. Create a channel.
2. Create a topic **using the channel's captured ID**.
3. Publish a message onto that topic.
4. Read the published messages back from that exact topic.
5. Reject a topic missing its required name (expected refusal).
6. Cleanup: delete the topic (twice tolerated), delete the channel.

The plan's cleanup steps carry step-scoped value names —
`<step_action_1_1.briskChannelId>`, `<step_action_2_2.briskTopicId>` — so
each delete provably targeted the resource created by that exact step. This
is the "never guess between two IDs" rule working against a real product.

## Counts (from the saved result)

| What | Number |
| --- | --- |
| Checks asked for / understood / ready / not ready | 1 / 1 / 1 / 0 |
| Logical tests passed | 1 of 1 (100%) |
| Failed / skipped / blocked / errors | 0 / 0 / 0 / 0 |
| Executed operations | 8 |
| AI calls | 1 (0 errors) |
| AI tokens | 1,258 in / 1,546 out |
| Run time | 29.5 seconds |
| Channels left behind (fresh re-query) | 0 |
| Credentials printed anywhere | no |

## What went wrong first (kept honestly)

The first attempt stopped at admin sign-in with HTTP 500: the Brisk server
process was running, but its own database and broker containers had exited
two hours earlier. After restarting Brisk's containers, sign-in answered 200
and the run passed. Lesson recorded: an answering health page does not prove
the application's dependencies are alive.

## Fingerprints (SHA-256) of the full evidence on the running machine

Full evidence lives in
`.brisk-aitesting-real-ai-brisk/artifacts/run_a4937128-200a-4bc1-999f-d51a13718207/`
(git-ignored, this machine only):

- `result.json` — `87d4195a8441dbb59601ff5a77702bc067db8721583778a54cdc8c9ae883a910`
- `run.journal.jsonl` — `543f0f25b9a9e4dd109fa9212334d4a6110610f87f14f8f20c2381f808064361`
- `ai/ai-usage.json` — `b3e968052b94f8129f10b3f471e28d20656fd87d140b67f87dc25a7c60368276`

## What this does not prove

One API journey with one provider on one machine. It does not prove Brisk UI
testing, subscriptions/consumers under load, other models, other operating
systems, or production readiness. Deeper end-to-end Brisk suites (and running
brisk-aitesting from inside Brisk as a platform) are the next pass.
