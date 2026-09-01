import type { WorkDefinition, WorkflowLifecycle, MaterializationBlocker } from '@malkom/domainwarehouse-contract';

const safe = (value: string, max = 40) => {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'STATE';
  return normalized.slice(0, max);
};

export function escalationTarget(definition: WorkDefinition): string | undefined {
  const text = String(definition.sourceRecord?.paths?.escalation ?? definition.sourceRecord?.escalation ?? '');
  return text.match(/LTL-\d{2}/)?.[0];
}

export interface WorkflowProjection {
  lifecycle: WorkflowLifecycle;
  materializable: boolean;
  blockers: MaterializationBlocker[];
  supportedOutcomeCodes: string[];
  unsupportedOutcomeCodes: string[];
}

/**
 * Projects a Domain Warehouse definition into the existing
 * @malkom/workflow-core lifecycle vocabulary without modifying that engine.
 * Unsupported cross-queue semantics remain blockers; they are never flattened.
 */
export function compileWorkflow(definition: WorkDefinition): WorkflowProjection {
  const outcomes = definition.decomposition.malkom.outcomes;
  const blockers: MaterializationBlocker[] = [];
  const stateByCode = new Map<string, string>();
  const supported: string[] = [];
  const unsupported: string[] = [];

  for (const outcome of outcomes) {
    stateByCode.set(outcome.code, safe(`OUT_${outcome.code}`));
    if (outcome.nextStep === 'ESCALATE' || outcome.nextStep === 'MOVE_TO_QUEUE' || outcome.nextStep === 'WAIT_FOR_EVENT' || outcome.nextStep === 'RETRY' || outcome.nextStep === 'CONTINUE' || outcome.nextStep === 'HUMAN_REVIEW') {
      unsupported.push(outcome.code);
      blockers.push({
        workDefinitionId: definition.id,
        outcomeCode: outcome.code,
        nextStep: outcome.nextStep,
        targetTaskId: outcome.nextStep === 'ESCALATE' ? escalationTarget(definition) : undefined,
        capability: `workflow.${outcome.nextStep.toLowerCase()}`,
        reason: `Current Malkom workflow lifecycle expresses legal state moves and SLA timing but does not define the required cross-queue/runtime semantics for ${outcome.nextStep}. Canonical meaning is preserved and remains visible in Flow Explorer.`,
        disposition: 'UNSUPPORTED_CURRENT_MALKOM'
      });
    } else {
      supported.push(outcome.code);
    }
  }

  const outcomeStates = outcomes.map((outcome) => {
    const key = stateByCode.get(outcome.code)!;
    const end = outcome.nextStep === 'END_WORK_ITEM';
    const stay = outcome.nextStep === 'STAY_IN_QUEUE';
    const unsupportedStep = unsupported.includes(outcome.code);
    return {
      key,
      label: unsupportedStep ? `${outcome.label} · runtime binding required` : outcome.label,
      terminal: end,
      holdsClock: stay || unsupportedStep,
      to: stay ? ['OPEN'] : []
    };
  });

  const lifecycle: WorkflowLifecycle = {
    id: safe(`dw_${definition.sourceTask.taskId}`, 64),
    name: definition.canonicalName.slice(0, 120),
    initialState: 'OPEN',
    states: [
      { key: 'OPEN', label: 'Open', terminal: false, holdsClock: false, to: outcomeStates.map((s) => s.key) },
      ...outcomeStates
    ],
    // LTL V1.2 carries semantic clocks, not a universal numeric SLA. Do not invent minutes.
    slaMinutes: 0,
    enabled: true
  };

  return { lifecycle, materializable: blockers.length === 0, blockers, supportedOutcomeCodes: supported, unsupportedOutcomeCodes: unsupported };
}
