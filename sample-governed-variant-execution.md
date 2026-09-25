# Stage 14 — Governed Variant / Exception Execution

## Execution path types

The player now supports four governed playback modes:

1. **Standard** — `pathType = STANDARD`, ordered by declared `PRECEDES` edges.
2. **Conditional variant** — discovered from `BRANCHES_TO` and downstream conditional `PRECEDES` / iteration relationships.
3. **Exception → recovery** — discovered from `TRIGGERS` into an EXCEPTION task, `ESCALATES_TO`, then declared `RECOVERS_TO`.
4. **Exception branch** — discovered from `MAY_TRIGGER` into an EXCEPTION task. `MAY_TRIGGER` remains optional and is never promoted to mandatory execution.

## Road LTL graph discovered dynamically

- STANDARD A5 tasks: **13**
- CONDITIONAL A5 tasks: **6**
- EXCEPTION A5 tasks: **3**
- `BRANCHES_TO`: **1**
- `TRIGGERS`: **5** total; **4** target exception classification/recovery
- `ESCALATES_TO`: **1**
- `RECOVERS_TO`: **3**
- `MAY_TRIGGER`: **7** total; **2** directly trigger the claim/dispute exception task from the standard spine

### Examples supported by the declared graph

**Conditional network transfer**  
`LTL-08 BRANCHES_TO LTL-09` → `LTL-09 PRECEDES LTL-10` → `LTL-10 ITERATES_TO_NEXT_LEG LTL-08`

**Execution variance / recovery**  
A declared trigger such as `LTL-13 TRIGGERS LTL-14` → `LTL-14 ESCALATES_TO LTL-15` → one declared `RECOVERS_TO` target.

**Claim/dispute branch**  
A declared `MAY_TRIGGER` from `LTL-13` or `LTL-17` can enter `LTL-18`. Any downstream `MAY_TRIGGER` is presented as optional, not automatically executed.

## Guardrail

No exception path is synthesized from generic logistics knowledge. If the graph lacks an inbound trigger, ordering edge, escalation edge, or recovery edge, the player does not fabricate one. Context eligibility from Stage 13 is respected.
