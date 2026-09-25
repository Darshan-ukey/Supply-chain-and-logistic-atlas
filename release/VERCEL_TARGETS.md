# Vercel target reservation — Stage 22.2

Reserved targets:

- Lab: `supply-chain-atlas-lab` — bootstrap preview target created.
- Stable: `supply-chain-atlas-stable` — bootstrap preview target created; **not production promoted**.

These are target reservations only. The exact Stage-22.2 artifact is not claimed as deployed because the current connector cannot ingest the mounted project tree as an exact artifact.

Promotion remains:

`exact Lab artifact -> Lab env audit -> /api/readiness + /api/release-integrity -> deployed E2E -> approve -> exact artifact promotion to Stable`.
