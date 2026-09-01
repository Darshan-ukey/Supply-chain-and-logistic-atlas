# Source Date and Lineage Validation — Atlas V2.1 RC1

Validation cut-off: **2026-09-01 17:17:51 UTC**. The project inventory was
listed recursively and sorted by `modified_at`; duplicate names and later
release artifacts were reconciled by timestamp, release status, and SHA-256.

| Component | Selected source timestamp (UTC) | Selection proof |
| --- | ---: | --- |
| Universe V7.3 | 2026-08-31 10:46:05 | Latest standalone V7.3; byte-identical to the materialized release surface (`d674a8f7…`). |
| Road LTL V1.3 JSON | 2026-08-31 09:15:06 | Latest Library version; matches the later final stack lock (`0f855cc0…`). |
| Road LTL V1.3 HTML | 2026-08-31 09:14:53 | Latest standalone reference; matches release surface (`5d8fdc6b…`). |
| Ocean FCL V0.5 | 2026-08-31 10:45:56 | Latest standalone V0.5 reference; matches release surface (`66733685…`). |
| Ocean LCL V0.5 | 2026-08-31 10:46:01 | Latest standalone V0.5 reference; matches release surface (`f5cb0897…`). |
| Atlas Warehouse V1 | 2026-08-31 11:47:18 | Latest and only governed Warehouse V1 asset in the inventory. |
| Foundation V1.2 | 2026-08-31 11:47:27 | Latest and only Foundation V1.2 asset in the inventory. |
| Execution Fabric V2.1 dev1 | 2026-09-01 07:27:13 | Latest Execution Fabric implementation; architecture frozen, implementation originally marked development. Rebased here as RC1. |
| Canvas V2.0 frozen | 2026-09-01 08:46:55 | Later than the V2.1 dev build; exact frozen ZIP hash `bc340946…`. |
| Universal Ask V2.0.1 | 2026-09-01 09:23:16 | Later than Execution Fabric and Canvas; merged after both. |
| Final integration framework | 2026-09-01 12:37:26 | Later branch-ready integration baseline used for the rebase. |
| LTL Operations Knowledge V0.1 | 2026-09-01 12:39:03 | Latest substantive Atlas artifact before this release; retained as an isolated prototype, not promoted as a production module. |

No source component created after the entries above and before the validation
cut-off supersedes the selected production asset. The V2.0.3 ZIP created at
17:17 was an integration output, not a newer source component; this V2.1 RC1
supersedes it by restoring the omitted Execution Fabric.

Date is used to establish candidate order. Release/freeze status and hash are
used to choose between similarly named candidates; a later timestamp alone does
not automatically promote a development artifact.
