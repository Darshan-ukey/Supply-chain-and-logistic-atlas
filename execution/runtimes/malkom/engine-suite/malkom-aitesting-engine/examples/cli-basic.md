# CLI basic run

Install from npm, create the default config, check setup, then run:

```bash
npm install --save-dev brisk-aitesting
npx brisk-aitesting init
npx brisk-aitesting doctor
npx brisk-aitesting run --config brisk-aitesting.config.mjs --goal "Check login, dashboard, and health API" --scenarios 5 --json
```

The command returns `brisk-aitesting.cli-result.v1`. The detailed handover JSON is written under `.brisk-aitesting/artifacts/<run-id>/result.json`.
