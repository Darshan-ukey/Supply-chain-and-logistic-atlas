# Existing Malkom Workflow Engine integration

Domain Warehouse does **not** add a second workflow engine. It targets the existing sibling `malkom-workflow-engine` and its `@malkom/workflow-core` lifecycle definition.

Supported contract elements found in the repository:
- lifecycle `id` and `name`
- `initialState`
- states with `key`, `label`, `terminal`, `holdsClock`, `to[]`
- numeric `slaMinutes`
- `enabled`

Projection rules:
- `END_WORK_ITEM` -> terminal outcome state.
- `STAY_IN_QUEUE` -> held return state with legal return to `OPEN`.
- Road LTL semantic clocks are preserved canonically. `slaMinutes=0` unless a numeric SLA is supplied through a client/reference binding; no value is invented.
- `ESCALATE`, `MOVE_TO_QUEUE`, `WAIT_FOR_EVENT`, `RETRY`, `CONTINUE`, `HUMAN_REVIEW` require explicit runtime semantics before materialization.

## Three current escalation capability gaps

Road LTL contains three canonical Malkom outcomes with `nextStep=ESCALATE`:
- `LTL-15 -> LTL-14`
- `LTL-18 -> LTL-14`
- `LTL-22 -> LTL-14`

They are a **known current Malkom architecture gap, not missing Domain Warehouse data**. The canonical targets are preserved in v2.3. Queue Flow Explorer always renders them. Because each outcome can be available from multiple subqueues, these three canonical outcomes produce 11 dashed subqueue/outcome branch edges in the compiled queue views.

Current Malkom materialization remains blocked until native cross-queue escalation routing is defined. No END/STAY substitution is permitted.

If Malkom later adds native escalation (or MOVE_TO_QUEUE / WAIT / RETRY / recovery semantics), the intended change is to the Malkom adapter and compatibility tests. The Road LTL source model, WorkDefinition and Domain Warehouse do not need to be rebuilt unless the runtime requires genuinely new canonical information.
