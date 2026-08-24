# Rollback runbook

- Keep the prior Stable Vercel deployment addressable.
- Roll back application code independently from Atlas content only if the saved work's pinned Atlas release remains compatible.
- Never silently open old saved work against a newer module version without recording the upgrade.
- If a content publication fails validation, keep the previous active registry/module release.
