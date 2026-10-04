# DAU-007 / DAU-006 exact-QA run history (tested commit e0a1ce28530735e4673d1e59ade4c8fd1ece58ce)

Both runs used the same committed runner (`run-dau-qa.cjs`) in a fresh clone of the same tested commit/tree (`42ee3010a3054efb174034edd6603640970a8edf`). Nothing in the repository changed between them.

| Run | File | sha256 | DAU run 1 | DAU run 2 | Mutations | Status |
|---|---|---|---|---|---|---|
| 1 (container under concurrent load from unrelated assembly work) | `dau-exact-qa-run1-contended-FAIL.json` | `48196976032a8001d115f3d64fce13737025f20a92ae6da6aca57465c988a362` | 110/110 | **109/110** | 21/21 + clean control | **FAIL** |
| 2 (container idle) | `dau-exact-qa.json` | `2d85ce25309e756e1c9c1d9bbe985f471700043bd3c0efcb6f34547d2e5da393` | 110/110 | 110/110 | 21/21 + clean control | **PASS** |

Run 1's single failing case was **R02**, the diagnostic proof that the pre-existing root load-time race reproduces in the unchanged root with the history module absent (a timing probe). It is not a DAU-006 or DAU-007 behaviour case: all 14-step DAU-007 cases, all DAU-006 matrix cases, the negatives, identity and unit cases passed in both runs of both QA executions.

The run-1 failure message was not captured by the runner (it records failing case names only). It was not reproduced afterwards: R02 passed 12/12 in isolation, 8/8 with three CPU-saturating processes, and the full suite passed 110/110 on three consecutive standalone runs before the idle rerun. The cause is therefore recorded as **unconfirmed, probable timing sensitivity of the split-delivery probe under load**; it is not claimed as proven. The failed run is kept as evidence and is not deleted or edited. Run 2 is the authoritative gate evidence for the remediation; the RC exact-QA re-runs the DAU suite on the RC tree and will report any recurrence.
