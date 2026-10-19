# FIRI v0.22 — reconstructed integrity-control recovery

Status: RECONSTRUCTED_FROM_V0.21_PLUS_RETAINED_V0.22_STATUS_RECORDS

This recovery starts from the exact supplied v0.21 Final Record Policy package (131 tests) and preserves its resolver, provenance resolver, LLM association bridge, source-span gate, Atlas adapter, scoring, and final-record non-mutation policy.

The retained v0.22 status record establishes only that v0.22 was the latest confirmed implementation, 134/134 tests passed, integrity controls were in place, and independent verification of the five original BOL image regions had NOT yet been executed. It does not preserve the original v0.22 source diff or test names.

Therefore this is not claimed to be byte-identical to the lost original v0.22. The smallest defensible integrity hardening has been reconstructed: source-span verifier and final-record approver must be distinct asserted identities. Three regression tests cover same-actor rejection, distinct-actor proposal eligibility, and preservation of the no-automatic-mutation invariant.

No image authenticity, human identity authentication, five-BOL adjudication, accuracy uplift, Malkom readiness, or production readiness is claimed.
