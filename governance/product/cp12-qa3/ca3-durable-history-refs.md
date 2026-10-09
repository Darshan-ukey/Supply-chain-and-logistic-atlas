# CP-12 CA-3 durable history refs — 2026-10-09

These are **custody references only**, not product branches, RCs or release authority.

- `cp12-qa3-history-pin-ef6e375` -> `ef6e375ca947c34902ee1e366dd71e08914f7fa8`
- `cp12-qa3-history-pin-dba6968` -> `dba6968b0bdf28b533f4efd765302796e6ebed58`

Both refs were created successfully against independently resolved GitHub commits. They prevent these commit objects from becoming unreachable solely through deletion of other refs. The independent review also mentions raw blobs `379f988c` and `9cf88a86`; **their reachability via these two refs has not yet been proven**, and a fresh shallow-clone test has not been executed. Therefore CA-3 is **PARTIAL**, not PASS.

A QA reviewer must: (1) fresh shallow clone the CP-12 remediation branch, (2) explicitly fetch these two refs, (3) verify required blob objects are reachable, (4) run the complete 82-case RC suite and 41-mutation matrix on Node24, (5) record exact command, output and hashes. Do not count a shallow clone alone as full-history self-containment.

No product bytes changed; no merge/deploy/promotion. Release HOLD.
