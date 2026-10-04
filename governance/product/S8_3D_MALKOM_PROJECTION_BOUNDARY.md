# S8-3D — ATL-169 corrected projection boundary

Base: 97459a5e06abda96cbe3b2a121dfbee3a0bcf41e.
User authorized continuation after the recorded schema custody failure. The retained schema is restored byte-for-byte from ATL-169 commit 88bd3da8e9bf46d41676adbfce0c96fc45cf013c, blob 7357321fd673351ee1685e3a7c479ceb7065287f. Prior failure is preserved in blocked-exact-qa.json.

The deterministic protected projection is generated only from exact corrected WD/package/readiness hashes. It preserves compiled canonical leaf, partial coverage, separate process bindings, unknown/loss/unsupported dispositions and lineage. Ten adversarial input cases reject stale or mutated lineage, inferred interface, coverage removal, binding application and readiness promotion. Public evidence contains only hashes/counts; no full protected instance is published.

Runtime readiness remains BLOCKED: one protected WD, four noncompiled leaves (two client-binding and two knowledge-gap), one unresolved binding, universalExecutionReady=false, executor NOT_INDEPENDENTLY_PROVEN, materializable=false. No runtime or release certification.

Fresh-checkout exact QA is required for closure. No main merge, production deploy, protected-store mutation or downstream implementation. S8-3E remains READY/NOT STARTED; ATL-181 waits for S8-6.
