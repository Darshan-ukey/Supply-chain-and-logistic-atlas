# Evidence ingestion governance

Pipeline: Trust Gate -> Document Intake -> Claim Extraction -> Evidence Validation -> Contradiction Check -> Human Review -> Client Workspace.

Decisions: ACCEPT, QUARANTINE, REJECT.
Evidence states: CONFIRMED, OBSERVED, PUBLICLY_EVIDENCED, INFERRED, REFERENCE_ONLY, UNKNOWN.
No automated promotion to CONFIRMED is permitted.
Public client research creates PUBLICLY_EVIDENCED candidate claims only.
The same Trust Gate runs before normal Atlas chat.
The frozen Atlas is never mutated by evidence ingestion.
