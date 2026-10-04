# DEF-GOV-002 — residual routing (S8-6)

**Status: PRESERVED_OPEN. Not closed, not narrowed, not re-scoped by S8-6.**

S8-6 (successor RC assembly) does not change, close or re-scope DEF-GOV-002. The repository carries no definition of
DEF-GOV-002 beyond its identifier; this record therefore does not restate or reinterpret it. The canonical workbook (owned and written only by ChatGPT)
remains the authority for its definition, severity and disposition.

| Field | Value |
|---|---|
| Defect | DEF-GOV-002 |
| S8-6 disposition | PRESERVED_OPEN (`silentlyClosed: false` in the successor manifest) |
| Closed by S8-6 | No |
| Evidence offered toward closure | None |
| Routed to | Canonical-workbook owner (ChatGPT, control plane) for disposition; ATL-181 independent audit to observe that it is still open |
| Verifier | `verifySuccessorManifest` fails closed with `GOV_002_SILENTLY_CLOSED` if the manifest records any status other than `PRESERVED_OPEN` |

Handling rules carried forward:

1. Nothing in the S8-6 evidence set may be cited as closing DEF-GOV-002.
2. If the control plane re-scopes or closes it, that happens in the workbook first; the successor manifest is regenerated only after that decision.
3. S8-6 PASS means "RC frozen and ready for ATL-181 independent audit" — it is not a governance-defect closure.
