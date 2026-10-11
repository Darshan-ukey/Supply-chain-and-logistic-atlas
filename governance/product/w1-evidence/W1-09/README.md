# W1-09 evidence (evidence-only; DEC-055 13b)

Task: W1-09 seeded (20261010) sample of 40 business objects, 10 systems, 10 documents/events from the frozen Universe V7.3 HTML;
basis in a registered source vocabulary; failures by claim class. Executor: Claude Sonnet 5.5 scheduled monitor, op W109-20261011-0715-IST.
Risk MEDIUM, QA_REQUIRED, batch QA W1-12 (ChatGPT). Read-only against the frozen artifact; nothing in this folder edits it.

Frozen input: commit e5f5029cd9551ae6c141a13be6221064f18d7c32, path frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html,
SHA-256 31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd.

Draw convention (state it to QA): mulberry32(20261010) + Fisher-Yates (i = n-1..1, j = floor(rnd()*(i+1))), first k taken, RE-SEEDED with 20261010 for each stratum.
Populations in registry order: businessObjectRecords 128 (take 40); systemRecords 78 (take 10); documentRecords 19 followed by eventRecords 9 = 28 pooled (take 10).

Reproduce:
1. node scripts/extract.mjs <frozen.html> <scratch-copy.html> data/registries-extract.json   (needs Playwright/Chromium; same hook as W1-02)
2. node scripts/select.mjs data/registries-extract.json data/selected_60.json
3. python3 -I scripts/build_index.py <vocab_dir> vocab_index.jsonl   (needs local clones of IATA-Cargo/ONE-Record 2026-07-standard, gs1/EPCIS, uncefact/spec-JSONSchema at the heads below)
4. python3 -I scripts/search_items.py data/selected_60.json vocab_index.jsonl data/hits.txt
5. python3 -I scripts/classify.py data/selected_60.json <outdir>      (the per-item categories are recorded by hand inside this script after reading hits.txt, APQC PCF 8.0 and issuer pages; it only validates and tallies)

Vocabulary repo heads used: ONE-Record 698d641a5ed3bebc2ff73ba62665b64edbaa0c1f; EPCIS 6f71468231838e424bb5dfa836e006e8dc69615c; spec-JSONSchema 47d813e9809db02db2c5d841791d7118ab8b835f.
vocab_index.jsonl (3.5 MB, not committed) sha256 f55c9a55cc60e95cbe2970516cdadcf5950336ccd04d04cfa4af53b9d46d0ef7.
Web evidence (DCSA, X12, FIATA pages) was read through WebFetch (small-model page summaries); APQC PCF 8.0 is the Project file K016808 (Excel). Neither is in this folder.
The full receipt (revision 2) is the Project doc claude/W1-09-SOURCE-BASIS-SAMPLE-VERIFICATION-RECEIPT-2026-10-11.md and a Google Drive copy (file IDs in Atlas Wave 0 Control AA18).

Revision history
- Revision 1 (2026-10-11 07:28-07:30 IST; commits 1bbac597 and d79c8246, first pushed to w1-evidence-20261011): first publication.
- Revision 2 (2026-10-11): sys-customer-portal corrected from NO_BASIS to PASS_WITH_LIMITATION (the function-level mapping used for the other nine systems had not been applied in revision 1); PCF 6.3.3 neighbour added to obj-subrogation (category unchanged); Owner guidance of 2026-10-11 08:11 IST recorded in the receipt. Changed files: README.md, scripts/classify.py, data/results.json, data/results.tsv, data/summary.json. Counts: NO_BASIS 3 -> 2, PASS_WITH_LIMITATION 23 -> 24, all else unchanged.
- This folder now lives on w1-evidence-20261010 (the single Wave 1 evidence branch, Owner request 2026-10-11); w1-evidence-20261011 was merged into it and is left in place.
