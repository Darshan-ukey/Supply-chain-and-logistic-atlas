# CP-12 CA-1 — Owner clarification: asset authority vs historical HTML integration (2026-10-09)

**Owner-supplied authoritative product intent:** Universe **V7.3** is the final Universe asset; Road LTL Daughter **V1.5** and Ocean Daughter **V0.6** are the intended latest assets. Earlier HTML-based iterations evolved separately, and these final assets were not integrated into one live whole. Older Road 1.2/1.3 and Ocean 0.4/0.5 references are historical/projection wiring, **not rival final-product versions**.

**Important scope distinction:** This owner clarification establishes intended versions, not cryptographic custody, exact frozen-package contents, current runtime binding, QA certification or deployment. Existing S8-6 frozen RC remains unchanged. Historical `reference/universe-v7.3.html` vs standalone V7.3 eight-pointer differences are recorded as *integration drift*, not a requirement to select one as final canonical truth.

**CA-1 revised closure gates:**
1. Verify exact governed Universe V7.3 frozen source identity and provenance; distinguish source content from packaged HTML projection.
2. Locate and verify **Road LTL V1.5** and **Ocean V0.6** frozen artifacts by exact paths, blobs, manifests and SHA256; if unavailable, mark missing custody evidence rather than substituting 1.4/1.3 or 0.5.
3. Define version-aware Universe-to-Daughter resolution to the intended final assets, with explicit not-integrated/blocked status where routing is not yet implemented. Do not rewrite frozen Universe HTML to imply deployment.
4. Verify deterministic asset and pointer checks and at least two negative mutations against the exact final frozen identities; record execution output.
5. Keep live-host QA and production readiness separate from governed knowledge completeness. No release/promotion under CP-12.

**Known evidence (prior direct GitHub retrieval):** standalone Universe blob `27695e6e633f4531da4e7dcb0dd6cb8d451f9039`, packaged reference blob `d828f284c83a7a394970605552e4d0e4440017a7`; eight differing code units in older Road/Ocean pointer labels; six relative historical Daughter paths exist in respective trees. This evidence remains valid but does not adjudicate the final V1.5/V0.6 asset custody.

**Current disposition:** CA-1 **OWNER INTENT CLARIFIED / ASSET CUSTODY AND BINDING VERIFICATION OPEN**. Do not mark CA-1 PASS. The earlier `tests/cp12-universe-identity.test.mjs` requirement for selecting `standalone` or `packaged` as `governedIdentity` is now **superseded as a closure requirement**; retain it only as historical variant comparison until replaced by source/asset/projection-role tests. No product edits, merge or deployment.
