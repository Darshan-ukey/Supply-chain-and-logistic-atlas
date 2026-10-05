# ATL-191B — ATL-169 adapter-readiness decision

Status: **PASS — NO CHANGE TO ATL-169**

## Decision

ATL-169 already contains the canonical and handoff metadata required by a deterministic Malkom adapter:

- consumer = MALKOM;
- exact source package / WorkDefinition identity and version;
- exact input hashes;
- canonicalMutation=false;
- traceable lineage;
- clientBindingsSeparate=true;
- failClosed=true;
- capability dispositions;
- separate bindings;
- explicit unknown / unsupported / loss states;
- readiness and materializable/runtimeCertification flags;
- deterministic release metadata;
- stop boundary.

The missing Malkom queue/subqueue/worktype/field/outcome structure identified in ATL-191A is **not missing canonical metadata**. It is consumer-specific structure and therefore belongs in a separate, pinned Malkom consumer profile input.

## Consequence

Do **not** modify ATL-169 or PR37 for ATL-191.

ATL-195 will implement a translator with two inputs:

1. immutable ATL-169 projection / P6.2 canonical payload;
2. separately pinned Malkom consumer profile.

This preserves the P6.2 prohibition on runtime/queue leakage into canonical WorkDefinition and avoids invalidating ATL-169's existing 10/10 QA evidence.

## Runtime-distribution metadata

No distribution-mode field is added in this bounded proof. DYNAMIC_LOOKUP and other live consumption modes remain v2 under DEC-036. Adding them now would expand semantics beyond the ATL-191 proof.

## Release effect

None. ATL-169 remains DONE and unchanged; frozen v1.5 RC remains untouched.
