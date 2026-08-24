# Release runbook

1. `npm test`
2. `npm run reaudit`
3. `npm run pilot:eval:offline`
4. `npm run release:manifest`
5. `npm run release:packages`
6. Deploy `release/packages/lab` or root to the Lab Vercel target.
7. Configure audited environment variables.
8. Check `/api/health`, `/api/readiness`, `/api/release-integrity`, `/api/version`.
9. Run deployed browser/mobile smoke and `PILOT_BASE_URL=<lab> npm run pilot:eval:live` when an approved provider is configured.
10. Promote the exact validated release to Stable.
