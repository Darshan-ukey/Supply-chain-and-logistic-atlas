# S8-6 successor RC — exact-QA run history

Three fresh-checkout runs of `run-exact-qa.cjs`, each at a distinct tested commit. Runs 1 and 2 are preserved as FAIL evidence. In every run all gating suites, the manifest/package/integrity/custody/lineage-only proofs and both mutation suites passed; the failures were in the runner's own predecessor-classification probes, which were mis-specified. No predecessor test, RC assertion or product file was changed between runs (only `run-exact-qa.cjs`).

| Run | Tested commit | Status | Cause |
|---|---|---|---|
| 1 | `9518690b25258519c660ab8d66571cc9ae2012b7` | FAIL | S8-5B P01 replica omitted the stale-source-tip marker (hit: recorded exclusion in the successor manifest); S8-5A S02 missing from the expected set (the two new successor manifests in `release/manifests`); S8-3F expected set missed "release packages are untouched relative to the S8-4 base" (the package rewrite is mandated) and its Ask probe counted current rather than superseded Ask copies (0 superseded; 6 current). Evidence: `exact-qa-run1-FAIL-probe-classification.json`. |
| 2 | `91ad86fe638c07c69ff98e80f3e9002a4baa0e9b` | FAIL | S8-5B classification: the runner source itself embedded the stale-source-tip literal it scans for (the only unexplained hit). Evidence: `exact-qa-run2-FAIL-stale-tip-literal.json`. |
| 3 | `78a3b7c87f24d20f07c8fdb24c0202c33f5de6c2` | PASS | Marker built by join. Authoritative: `exact-qa.json`. |

The corrections strengthen the classification (exact failing-case sets, mechanical reason probes per case, an exact replica of the S8-5B P01 scan with every hit explained by base-blob identity, package-copy identity or an explicit allow-list reason); none weakens a predecessor test.
Product and release-control files are identical across the three tested commits (diffs between them touch only `governance/product/s8-6-evidence/run-exact-qa.cjs`).
