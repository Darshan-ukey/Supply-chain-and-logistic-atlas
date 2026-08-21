# Frozen Atlas intelligence guardrails

1. Frozen Page 0 and Road LTL source artifacts are authoritative inputs and are never modified by this application.
2. No API endpoint accepts Atlas write/patch/delete operations.
3. Agent registry contains zero Atlas write-capable agents.
4. UI actions may only alter temporary presentation state: focus, grey-out, highlight, trace, compare, play and reset.
5. Recommendations/corrections are advisory. A human manually edits a future governed Atlas source version.
6. Unsupported facts are refused rather than filled from general model knowledge.
7. Opportunity and solution output stays explicitly separate from source-native Atlas content.
8. Client workspace content never becomes Atlas content automatically.
9. Integrity hashes detect unexpected changes to the frozen artifacts/model.
