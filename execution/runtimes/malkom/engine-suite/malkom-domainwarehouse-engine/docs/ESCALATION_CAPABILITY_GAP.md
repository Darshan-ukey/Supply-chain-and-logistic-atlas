# Current Malkom 3.0 capability gap — escalation handling

Road LTL V1.2 contains three governed `ESCALATE` outcomes:

- LTL-15 -> LTL-14
- LTL-18 -> LTL-14
- LTL-22 -> LTL-14

The current Malkom Command/runtime contract does not provide a sufficiently explicit cross-queue escalation/next-step semantic to materialize these without interpretation.

Therefore:

- canonical escalation is preserved in Domain Warehouse v2.3;
- Queue Flow Explorer always displays the three routes;
- Malkom projection labels them `UNSUPPORTED_CURRENT_MALKOM`;
- materialization is blocked for those outcomes;
- no `END_QUEUE` / `STAY` substitution is permitted;
- native escalation routing is documented as a future Malkom 3.0 enhancement.
