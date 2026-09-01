# Kept proof

This folder holds small, cleaned summaries of real proof runs, so the proof
travels with the code instead of living only on one person's machine.

## Why this folder exists

Before 2026-08-11, all real run results were saved in folders that git
ignores (`.brisk-aitesting-*`). That meant anyone who downloaded the project
saw zero proof, while the documents talked about passing runs. This folder
fixes that: every important claim should point at a file in here.

## What goes in here

After a real proof run (a real AI model, a real application, or both), save
one small JSON or Markdown summary that contains:

- the date and what was run (command, application, AI provider and model name);
- the counts: how many checks were asked for, run, passed, failed, skipped,
  and blocked;
- what was created and what was cleaned up, including anything left behind;
- fingerprints (SHA-256) of the full run folder's key files, so the summary
  can be matched to the full evidence if that machine is available;
- what the run does NOT prove.

## What must never go in here

- passwords, tokens, keys, cookies, or anything secret;
- personal data;
- huge files (screenshots, videos, full traces stay in the ignored run
  folders — only their fingerprints belong here);
- edited or trimmed results that hide a failure. A failing run gets saved
  the same way as a passing run.

## Naming

`YYYY-MM-DD-<what>.md` or `.json`, for example:
`2026-08-12-directus-real-ai-journey.json`.
