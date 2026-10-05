# ATL-199E — successor integration / release QA package

Status: **MERGE-READY / NOT MERGED**

PR46 is a bounded adjunct on top of PR45. It must remain separate from the active ATL-181 remediation lineage until that remediation stabilizes.

## Integration order

1. stabilize ATL-181 remediation/re-audit;
2. select the eventual successor branch;
3. integrate the approved ATL-191 / PR45 bounded adapter proof;
4. integrate the exact approved ATL-199 / PR46 API+MCP commits;
5. run targeted ATL-199 QA plus affected Atlas regression/release-integrity checks;
6. update successor commit/tree/manifest identities;
7. freeze the successor;
8. Owner promotion/go-live gate.

## Required targeted QA after integration

- WP-199A shared service tests;
- WP-199B API routing/contract tests;
- WP-199C MCP JSON-RPC/tool tests;
- WP-199D API↔MCP parity against the exact Domain Warehouse donor;
- existing API governance: top-level function count stays 8;
- blocker/materialization guardrail checks;
- release manifest/integrity checks.

## Rollback

ATL-199 must be revertible as one bounded adjunct without reverting ATL-191 or changing canonical Atlas semantics. API routing, MCP modules and shared integration files can be removed while retaining proof evidence.

## Live-host boundary

This package is merge-ready for bounded non-live integration only. WP-199F remains blocked until real Malkom Command/Runtime host access exists.
