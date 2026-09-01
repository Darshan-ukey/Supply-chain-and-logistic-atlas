# Future Malkom improvements — documented, not forced now

These are observations from projecting the richer Domain Warehouse v2.3 model into the current Malkom 3.0 contracts. They are **not changes made to Hasmukh's existing engines**.

1. Native cross-queue `ESCALATE` with explicit target queue/work definition.
2. Native `MOVE_TO_QUEUE` semantics separate from generic outcome routing.
3. `WAIT_FOR_EVENT` with event subscription/resume semantics.
4. `RETRY` policy with governed retry count/backoff and evidence.
5. Explicit recovery routing and return-to-prior-state semantics.
6. Cross-engine runtime capability registry so Command can preflight a materialization before deployment.
7. Shared Command target types should replace the local portable Queue/ValueList candidates once the actual `malkom-command` shared package is available.

Domain Warehouse does not require these enhancements to preserve the canonical model. The adapter simply reports them as unsupported until Malkom adopts them.
