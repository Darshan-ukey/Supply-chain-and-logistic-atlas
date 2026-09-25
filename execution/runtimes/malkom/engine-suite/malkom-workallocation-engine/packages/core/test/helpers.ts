import { queueDefinitionSchema, type QueueDefinition, type QueueDefinitionInput } from '../src/index.js';
import type { Clock } from '../src/index.js';

export class FakeClock implements Clock {
  constructor(public t: number = Date.parse('2026-08-12T10:00:00Z')) {}
  now(): Date {
    return new Date(this.t);
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

/** Canonical test queue over tasks(task_id,status,owner,assigned_at,created_at,skill) + agents(agent_id,active,cap,skills). */
export function queueInput(mutate?: (d: QueueDefinitionInput) => void): QueueDefinitionInput {
  const d: QueueDefinitionInput = {
    id: 'q-test',
    name: 'Test queue',
    work: {
      connectionRef: 'db',
      table: { name: 'tasks' },
      fields: {
        id: 'task_id',
        assignee: 'owner',
        state: 'status',
        assignedAt: { column: 'assigned_at' },
        createdAt: 'created_at',
        attributes: ['skill'],
      },
      allocatableWhen: { op: 'in', column: 'status', values: ['NEW'] },
      ordering: [{ column: 'created_at', dir: 'asc' }],
      onAssign: { set: { status: 'ASSIGNED' } },
      onRelease: { set: { status: 'NEW' } },
    },
    workers: {
      connectionRef: 'db',
      table: { name: 'agents' },
      fields: {
        id: 'agent_id',
        eligibleWhen: { op: 'eq', column: 'active', value: true },
        capacity: { column: 'cap' },
        attributes: ['skills'],
      },
    },
    strategy: { kind: 'fifo' },
    schedule: { trigger: { kind: 'interval', everyMs: 60_000 } },
  };
  mutate?.(d);
  return d;
}

export function parseQueue(mutate?: (d: QueueDefinitionInput) => void): QueueDefinition {
  const def = queueDefinitionSchema.parse(queueInput(mutate));
  return { ...def, version: def.version ?? 1 };
}

export function taskRow(id: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    task_id: id,
    status: 'NEW',
    owner: null,
    assigned_at: null,
    created_at: `2026-08-12T0${(id % 8) + 1}:00:00Z`,
    skill: 'billing',
    ...over,
  };
}

export function agentRow(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return { agent_id: id, active: true, cap: 10, skills: ['billing', 'claims'], ...over };
}
