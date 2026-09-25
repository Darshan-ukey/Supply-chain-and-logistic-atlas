# ATL-94 CI gate result: **PASS (1 of 1 candidate(s) passed the gate)**

| Field | Value |
|---|---|
| Repository | Darshan-ukey/Supply-chain-and-logistic-atlas |
| Ref | atlas-governance-registry-v2.1 |
| Commit | 6c9425e84911ec9419087c5331a3d5044a171274 |
| Event | push |
| Run | https://github.com/Darshan-ukey/Supply-chain-and-logistic-atlas/actions/runs/36089142379 (attempt 1) |
| Runner | Linux ubuntu24 20260920.314.1 |
| PostgreSQL server / client | 16.15 (Ubuntu 16.15-1.pgdg24.04+2) / psql (PostgreSQL) 16.15 (Ubuntu 16.15-1.pgdg24.04+2) |
| Cluster collation | C.UTF-8 |
| Reference files | ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh:9af8eef15dbd3e6750dc643583ad0cf6ae1e2c6b ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh:b9cdbbe2d5071066f5f333e8229b65d2bb095cc1 ATL_83_TEST_PACK_OUTPUT_V0_2.txt:f79e97e887552dc3b6e792049552cff261b7fe04 |
| CI code (raw blobs) | workflow b4e179a99be1416a0b240b507a6584371b1ccbf4, runner ab833c26fb605d620a978da8f680b42413520c2a, publisher 792e6155236e0b661f539ed02100d5a1fcccd201 |
| Candidates checked / passed | 1 / 1 |
| UTC time | 2026-09-25T03:08:41Z |

| Kind | Name | Blob | Pin / expectation | Exit | Verdict |
|---|---|---|---|---|---|
| canary | standin | `31e9f4ca8c3877519dda71f84b82502d7476ff86` | expect exit 0 | 0 | OK |
| canary | b1_only | `0ee97349aa165870083a87939c1c354f9a43be36` | expect exit 6 | 6 | OK |
| canary | hash_nullable | `4f14071c55c73e5778470cc36ca3185c40600c0e` | expect exit 5 | 5 | OK |
| candidate | ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_1 | `b16a4bd9b16763287a76574e7231695b2c271f2e` | - | - | SKIPPED (V0.1-failed-ATL-83-QA) |
| candidate | ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_2 | `344d0d4fed7fd5ae7d271764ba1f10e0d7552d63` | - | - | SKIPPED (V0.2-failed-ATL-83-re-QA) |
| candidate | ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_3 | `31e9f4ca8c3877519dda71f84b82502d7476ff86` | 31e9f4ca8c3877519dda71f84b82502d7476ff86 | 0 | PASS |

Gate output SHA-256:
- gate-ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_3.txt: `1488ce953cf94f98dba1cfc77f2f75cbdbdf469eaf31cfe8a576b4ba250f7b15`
- gate-canary-b1_only.txt: `8a29396d5113f76145569e8966a17999921ab26310b22a2042ab4410be3e290d`
- gate-canary-hash_nullable.txt: `ca3b3d851b3f51609b7b9d14d87aecf749177843cf289424f57b0ca875e53273`
- gate-canary-standin.txt: `9e7562881e055047ad34eadfb6fa9074b2e9a8cecf6b104ba4a8e6f9c7530e92`
