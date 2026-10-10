# W1-02 evidence (QA round 2) - op W102-R2-20261010-1305-IST
Evidence-only. Frozen V7.3 HTML: commit e5f5029cd9551ae6c141a13be6221064f18d7c32, frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html, SHA-256 31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd.
Reproduce: node extract.mjs <html> data.json; W102_HTML=<html> node w102_l1_checks.mjs data.json <FROZEN_RELEASE_MANIFEST.json> result.json; node w102_f4_definitions.mjs data.json f4_result.json (edit the hard-coded /tmp/claude-0/w102 paths and playwright path in extract.mjs for your host).
SHA-256: see SHA256SUMS.txt in this folder. prior_L1_report.md = verbatim claude/V73-L1-INTEGRITY-RESULT-2026-10-10.md.
