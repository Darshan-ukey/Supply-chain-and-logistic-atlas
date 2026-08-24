# Supabase isolated restore/PITR gate

The product can run without a development branch. The isolated branch is needed only for a destructive/recovery rehearsal that should not be run against the active pilot database.

Already available without a branch:

- authentication and workspace RLS;
- client-state persistence;
- private storage architecture;
- document/session processing;
- Ask Atlas;
- collaboration/telemetry;
- all normal pilot workflows;
- non-destructive transactional restore-style checks.

Still outstanding for production recovery assurance:

- create temporary isolated branch (quoted separately at $0.01344/hour);
- rehearse migration/restore there;
- verify schema/data invariants;
- remove/reset the branch after evidence capture.

This is therefore a **production recovery-certification gate**, not a runtime dependency.
