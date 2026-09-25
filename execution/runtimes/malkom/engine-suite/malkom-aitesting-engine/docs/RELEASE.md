# Release

This page describes the release checklist.

## Before Publishing

Run:

```bash
npm run release:check
```

That command runs the deterministic release path:

```bash
npm run typecheck
npm run build
npm run smoke:ci
npm run benchmark
npm run pack:check
node smoke/run-release-readiness.mjs
```

Optional real environment checks:

```bash
npm run smoke:real-ai
npm run smoke:schemathesis
```

## Package Check

```bash
npm run pack:check
```

This confirms the npm package contains the expected files and does not ship generated local artifacts.

## Changelog

Every release must have a matching section in `CHANGELOG.md`.

## Version

Use semantic versioning:

- patch: docs, fixes, small compatible changes
- minor: new compatible features
- major: breaking public API or result contract changes

## Publish

```bash
npm publish --access public
```

## After Publishing

Verify:

```bash
npm view brisk-aitesting version
```

Then create a GitHub release with:

- version
- short summary
- user impact
- migration notes if needed
- verification commands that passed
