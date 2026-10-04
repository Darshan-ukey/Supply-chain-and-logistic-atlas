# S8-3D — BLOCKED / QA failure

Scope: ATL-169 only. Base: `97459a5e06abda96cbe3b2a121dfbee3a0bcf41e`.
PR36 entry authority was verified OPEN/DRAFT/UNMERGED; corrected S8-3C
package/readiness hashes reproduced from governed inputs.

The candidate generic projection preserves the corrected compiled leaf,
coverage, separate bindings, dispositions, readiness and canonical lineage.
It is an unaccepted candidate: no S8-3D output or PASS is certified.

QA stopped at exact retained-schema custody verification. Expected ATL-169
schema blob at `88bd3da8e9bf46d41676adbfce0c96fc45cf013c`:
`7357321fd673351ee1685e3a7c479ceb7065287f`.
Observed copied schema blob: `0c1e8b935a24e5dbda51ea25fcdb59c4760d0026`.
The copied schema was written with an appended newline; byte identity is
therefore not accepted. No repair or continuation after the failure is claimed.
The exact committed candidate is checked in a fresh checkout solely to record
the failure and inherited regression results with commit/tree evidence.

Runtime readiness remains BLOCKED; one protected WD, four noncompiled leaves
(two client-binding and two knowledge-gap), one unresolved binding,
universalExecutionReady=false, executor NOT_INDEPENDENTLY_PROVEN.
No full protected projection is published, stored or certified.
No main merge, production deployment, protected-store mutation or downstream
advancement. ATL-181 waits for the exact S8-6 RC.
