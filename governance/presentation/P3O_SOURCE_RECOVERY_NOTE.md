# P3O Source Recovery Rule

Ocean 0.6 is already frozen. P3O MUST materialize the exact frozen bytes identified by `governance/frozen-assets/CANDIDATE_PAYLOAD_MANIFEST.json` and MUST NOT regenerate, infer, backfill, or reconstruct candidate semantic payloads from older Ocean 0.5 data, renderer HTML, WorkDefinition projections, or model knowledge.

The file-library record confirms the original release package identity and historical sandbox artifact path, but a reference is not itself sufficient evidence for byte-for-byte materialization. Certification remains blocked until the exact frozen bytes are retrieved and their SHA-256 values match the manifest.
