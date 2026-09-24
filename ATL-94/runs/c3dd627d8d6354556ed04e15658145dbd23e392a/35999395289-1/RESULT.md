# ATL-94 CI gate result: **PASS (1 of 1 candidate(s) passed the gate)**

| Field | Value |
|---|---|
| Repository | Darshan-ukey/Supply-chain-and-logistic-atlas |
| Ref | atlas-governance-registry-v2.1 |
| Commit | c3dd627d8d6354556ed04e15658145dbd23e392a |
| Event | push |
| Run | https://github.com/Darshan-ukey/Supply-chain-and-logistic-atlas/actions/runs/35999395289 (attempt 1) |
| Runner | Linux ubuntu24 20260920.314.1 |
| PostgreSQL server / client | 16.15 (Ubuntu 16.15-1.pgdg24.04+2) / psql (PostgreSQL) 16.15 (Ubuntu 16.15-1.pgdg24.04+2) |
| Cluster collation | C.UTF-8 |
| Reference files | ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh:9af8eef15dbd3e6750dc643583ad0cf6ae1e2c6b ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh:b9cdbbe2d5071066f5f333e8229b65d2bb095cc1 ATL_83_TEST_PACK_OUTPUT_V0_2.txt:f79e97e887552dc3b6e792049552cff261b7fe04 |
| CI code (raw blobs) | workflow b4e179a99be1416a0b240b507a6584371b1ccbf4, runner ab833c26fb605d620a978da8f680b42413520c2a, publisher 792e6155236e0b661f539ed02100d5a1fcccd201 |
| Candidates checked / passed | 1 / 1 |
| UTC time | 2026-09-24T12:29:50Z |

| Kind | Name | Blob | Pin / expectation | Exit | Verdict |
|---|---|---|---|---|---|
| canary | standin | `31e9f4ca8c3877519dda71f84b82502d7476ff86` | expect exit 0 | 0 | OK |
| canary | b1_only | `0ee97349aa165870083a87939c1c354f9a43be36` | expect exit 6 | 6 | OK |
| canary | hash_nullable | `4f14071c55c73e5778470cc36ca3185c40600c0e` | expect exit 5 | 5 | OK |
| candidate | ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_1 | `b16a4bd9b16763287a76574e7231695b2c271f2e` | - | - | SKIPPED (V0.1-failed-ATL-83-QA) |
| candidate | ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_2 | `344d0d4fed7fd5ae7d271764ba1f10e0d7552d63` | - | - | SKIPPED (V0.2-failed-ATL-83-re-QA) |
| candidate | ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_3 | `31e9f4ca8c3877519dda71f84b82502d7476ff86` | 31e9f4ca8c3877519dda71f84b82502d7476ff86 | 0 | PASS |

Gate output SHA-256:
- gate-ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_3.txt: `83b5a265e07b26b2060f08a18f68202f81d50273eecf916647c95ccfab497079`
- gate-canary-b1_only.txt: `8a29396d5113f76145569e8966a17999921ab26310b22a2042ab4410be3e290d`
- gate-canary-hash_nullable.txt: `fbadb425c5ff78bb6b52b3538d06441e5a35ddb9b3e55ea79fa5a96b46348e1a`
- gate-canary-standin.txt: `db00dc0bc1db1eaa0674500c5dae6156c3a1bbaa2909cc17db7b00da8c73be19`
