# ADR-0005: Keep source maps locally and omit incomplete maps from the npm package

- Status: accepted
- Date: 2026-08-02
- Decision owners: brisk-aitesting product engineering

## Context

The packed-product gate failed at 1,205,318 unpacked bytes against the existing
1,200,000-byte limit after adding the public evidence-provider implementation
and documentation. All required files were present. The build emitted 46 source
maps totalling about 460 KB. Those maps point to `../src/*.ts`, while `src` is
intentionally excluded from the npm package.

## Decision

Continue generating source maps in local repository builds, but exclude
`dist/**/*.map` from the published npm package. Keep JavaScript runtime files,
TypeScript declaration files, documentation, and the existing size limit.

## Why

- Local contributors retain source maps while developing and testing the repository.
- Installed users keep runtime code and complete public type declarations.
- Maps that point to unshipped TypeScript sources do not provide complete source-level debugging to package users.
- Documentation is a required product surface and must not be removed merely to satisfy the size check.
- Raising the budget would hide avoidable package weight without improving installed behavior.

## Trade-offs

- Installed stack traces refer to distributed JavaScript rather than the original TypeScript source.
- If source-mapped installed debugging becomes a supported requirement, Brisk must either ship the referenced sources or embed `sourcesContent`, then establish a new measured package budget.
- The packed-artifact test must continue proving that runtime files, declarations, and required documentation remain present.
