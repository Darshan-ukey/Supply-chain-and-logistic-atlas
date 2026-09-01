import { z } from 'zod';

/**
 * The workflow engine's vocabulary. A *lifecycle* is the unit of
 * configuration: the states an item may hold, which moves are legal, and
 * the SLA clock that runs while it is open. The engine owns legality and
 * the timing ledger; the host owns the item and who is allowed to move it.
 */

export const stateDefinitionSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  /** terminal states end the SLA clock and accept no further moves */
  terminal: z.boolean().default(false),
  /** the clock pauses in these states (waiting on someone else) */
  holdsClock: z.boolean().default(false),
  to: z.array(z.string().min(1).max(40)).max(40).default([]),
});
export type StateDefinition = z.infer<typeof stateDefinitionSchema>;

export const lifecycleDefinitionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
  name: z.string().min(1).max(120),
  initialState: z.string().min(1).max(40),
  states: z.array(stateDefinitionSchema).min(2).max(64),
  /** working minutes allowed from start to a terminal state; 0 = no SLA */
  slaMinutes: z.number().int().min(0).max(1_000_000).default(0),
  enabled: z.boolean().default(true),
});
export type LifecycleDefinition = z.infer<typeof lifecycleDefinitionSchema>;
export type LifecycleDefinitionInput = z.input<typeof lifecycleDefinitionSchema>;

export const startRequestSchema = z.object({
  itemId: z.string().min(1).max(200),
});

export const moveRequestSchema = z.object({
  itemId: z.string().min(1).max(200),
  to: z.string().min(1).max(40),
  actor: z.string().min(1).max(120).default('system'),
});

export interface MoveOutcome {
  legal: boolean;
  reason: string | null;
  state: string;
  terminal: boolean;
  /** minutes the clock has run, excluding held states */
  elapsedMinutes: number;
  slaBreached: boolean;
  lifecycleVersion: number;
}

export interface ItemRecord {
  itemId: string;
  lifecycleId: string;
  state: string;
  startedAt: string;
  /** accumulated running minutes at the moment the clock last stopped */
  accruedMs: number;
  /** when the current running span began; null while held or terminal */
  runningSince: string | null;
  completedAt: string | null;
}

export interface TransitionRecord {
  id: string;
  lifecycleId: string;
  itemId: string;
  fromState: string;
  toState: string;
  actor: string;
  createdAt: string;
}

export const configBundleSchema = z.object({
  lifecycles: z.array(lifecycleDefinitionSchema).max(128),
});
export type ConfigBundle = z.infer<typeof configBundleSchema>;
