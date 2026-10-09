# CP-12 CA-4 — proposed fail-closed root-load-race gate

Status: **PROPOSED / NOT EXECUTED / NOT QA3 PASS** (2026-10-09).
Applies to future DAU Chromium regression executions of the exact frozen S8-6 identity and separately certified successors. This document does not amend the frozen root.

## Observed baseline
Independent QA3 reviewer: Node 22.22.0 `rootLoadRaceTolerated=0` / 110; Node 24.21.0 `rootLoadRaceTolerated=1` / 110. The harness currently tolerates a known string `Maximum call stack size exceeded` associated with Stage-8 `closeFutureDrawer` recursion. These are **observations**, not approved thresholds.

## Proposed gate
1. Require every DAU run to emit `nodeVersion`, `testedCommit`, `testedTree`, `total`, `passed`, `failed`, `rootLoadRaceTolerated`, and **per-occurrence** stack/source fingerprint (call-site and frame signature). Missing or unparseable counters => FAIL.
2. For the **certification gate**, default tolerance **zero** on both Node22 and Node24. A tolerated event must be explicitly adjudicated, not silently converted to PASS. This is stricter than historical observations and may initially fail on Node24; do not call it a regression-free PASS without rerun.
3. If Owner later authorizes a nonzero exception, bind it to an exact commit/tree, Node version, known stack fingerprint, explicit maximum count and expiry. Never allow a text-only error-message match to suppress unknown stack traces or a different source location.
4. Any new error, counter > approved ceiling, missing fingerprint, or unapproved Node version => FAIL_CLOSED. No generic error-text waiver.
5. Preserve historical 110/110 results as historical evidence, not as proof this new gate has passed.

## Required proof before CA-4 closure
Add a **test-only** validator for DAU summary JSON, with negative tests: missing counter, negative counter, over-ceiling count, wrong Node version, wrong stack signature, same message/different stack, wrong commit/tree, expired exception. Run against Node22 and Node24 artifacts. Record command/output/hash and seek delta-only QA3 re-review.

No product files or frozen-root bytes may change under CP-12. This is a proposed gate, not an authorization to implement an exception or a release waiver.
