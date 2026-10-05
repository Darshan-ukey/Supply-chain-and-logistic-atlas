# ATL-191A — pinned donor and adapter contract map

Status: **PASS WITH EXPLICIT CONSUMER-PROFILE REQUIREMENT**  
Scope: DEC-037 / ATL-191 bounded proof only. Non-release-blocking.

## Exact authorities

- ATL-169 corrected projection: `703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c`
- ATL-169 tested commit: `3fa4348628c0fb5bcd08e1ca33d841fb9024beb4`
- P6.2 Canonical WorkDefinition V1 frozen contract blob: `c074489f2cf7edacde962f7e0260e2b240d24b87`
- August Domain Warehouse package SHA-256: `77d5db87be91f17a93c040c10d30c19710a0961c786f21bedf2c22a35dac7336`

## Finding

The existing Domain Warehouse engine is reusable, but its `malkom.domain-work-definition/2.3` contract requires Malkom-specific queue/subqueue/worktype/field/outcome structures that are intentionally absent from the P6.2 canonical WorkDefinition.

Therefore the bounded adapter must have **two explicit inputs**:

1. governed ATL-169/P6.2 semantics — semantic authority;
2. a pinned Malkom consumer projection profile — consumer structure only.

The August LTL-04 Malkom decomposition is usable as a **historical consumer-profile donor for feasibility testing**, with canonical SHA-256:

`1bed891ecfa7b2d8bf4dd996692e9a109de8033898933e74bd8c892397c16e88`

It must **not** be treated as current Atlas/Road-LTL semantic authority.

## Consequence for ATL-194 / ATL-195

- ATL-194 should prefer **NO CHANGE** to ATL-169. The missing item is a separate adapter input, not missing canonical metadata.
- ATL-195 should implement:
  `ATL-169 projection + Malkom consumer profile -> malkom.domain-work-definition/2.3`.
- Any stale semantic claim in the historical profile must be ignored/rejected rather than promoted.
- Existing Atlas binding/readiness/blockers remain authoritative and cannot be upgraded by the profile.

See `ATL_191A_DONOR_CONTRACT_MAP.json` for the machine-readable mapping.
