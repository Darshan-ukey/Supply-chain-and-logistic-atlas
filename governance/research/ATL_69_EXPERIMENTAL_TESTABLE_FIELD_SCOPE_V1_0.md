# ATL-69 — Experimental Testable Field Scope v1.0

Status: FROZEN PRE-RESULT EXPERIMENT DENOMINATOR — READY FOR INDEPENDENT QA
Date: 2026-09-27
Parent: ATL-59
Predecessor: ATL-68 v1.1
Authoritative source denominator: ATL-68 rows 1–76.

## Frozen denominator
Source fields: 76
Experiment-testable fields: 64
Pre-result exclusions: 12
Accounting: 64 + 12 = 76

This denominator is frozen before experimental results are inspected. Poor performance is not grounds to remove a field after results exist. Later authoritative evidence requires a versioned successor and separate reporting.

## Selection rule
A source row is testable when its expected value and object ownership can be established from document evidence plus generic governed domain semantics without client masters or unresolved local vocabularies. Conditional rows remain testable only on applicable documents/objects.

## Included source rows
All ATL-68 rows are included except the 12 rows explicitly listed below.

## Excluded ATL-68 source rows
| Row | Reason | Re-entry evidence |
|---:|---|---|
| 6 | Client vocabulary/binding required | Authoritative type vocabulary and mapping |
| 18 | Master-data identity required | Authoritative account master and binding |
| 26 | Client vocabulary unresolved | Authoritative value set and binding |
| 31 | Exact source meaning unresolved | Authoritative Ops/source definition |
| 32 | Master-data identity required | Authoritative account master and binding |
| 43 | Exact source meaning unresolved | Authoritative Ops/source definition |
| 48 | No supported frozen semantic target | Authoritative source definition establishing semantics/ownership |
| 54 | Master-data identity required | Authoritative party/client master and binding |
| 57 | Local document-type/lifecycle vocabulary required | Authoritative type/lifecycle mapping |
| 58 | Related object/value semantics unresolved | Authoritative source definition |
| 62 | Domain family exists, but retained source says exact coding is CLIENT_BINDING_REQUIRED | Authoritative code/value set and mapping |
| 68 | Frozen ATL-67 lacks a governed item-level area-measure target | Governed canonical area measure/unit expansion |

Rows refer immutably to ATL-68 v1.1 at commit 0a54c0ceca5a14192572eb2bdb6f4d2a10e012d3.

## Scoring controls
1. Conditional rows are applicability-masked; non-applicable absence is not an extraction failure.
2. Values must be associated to the correct governed owner/role/line/unit.
3. Shipment, line-item and handling-unit quantities remain distinct; sequence/association values are not counts.
4. Multi-line addresses remain layout representations within role-resolved postal-address structures.
5. Historical source metrics above 100% are observations only, not ground truth or thresholds.
6. ATL-68 row 62 is excluded until its exact coding contract is bound; related date-window rows remain conditionally testable.
7. Experimental failure on an included row is evidence and may not cause post-result denominator removal.

## Acceptance reconciliation
PASS — frozen pre-result denominator: 64 included / 12 excluded / 76 total.
PASS — every exclusion has a governed reason and re-entry condition.
PASS — master/client/unresolved/model-gap rows separated from document/domain-resolvable rows.
PASS — conditional rows use applicability masking.
PASS — no experimental result shaped this denominator.

## Downstream
ATL-70 must define benchmark ground truth and metrics against ATL-69-v1.0 before ATL-72 experimental results are produced.
