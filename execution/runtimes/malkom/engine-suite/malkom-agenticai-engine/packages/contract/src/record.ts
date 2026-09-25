import { z } from "zod";
import { nameSchema } from "./ids.js";
import type { Work } from "./endings.js";

/**
 * The shared case record.
 *
 * Every agent that works on a case writes its results onto the case — fields,
 * confidence numbers, notes. The next agent sees all of it. Nothing is worked
 * out twice. When a person gets the case in HITL, they see the same record.
 */

export const caseNoteSchema = z.object({
  /** Which agent left this note. */
  agent: nameSchema,
  at: z.string().datetime(),
  note: z.string().min(1).max(500),
});
export type CaseNote = z.infer<typeof caseNoteSchema>;

export const caseRecordSchema = z.object({
  taskId: z.string().min(1),
  org: z.string().min(1),
  queue: nameSchema,
  subQueue: nameSchema.optional(),
  /** The case's fields, keyed by the org's own field names. */
  fields: z.record(z.string(), z.unknown()).default({}),
  /** Confidence numbers, one per field an agent filled. */
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  /** Notes agents left for whoever works this case next. */
  notes: z.array(caseNoteSchema).default([]),
});
export type CaseRecord = z.infer<typeof caseRecordSchema>;

/**
 * Write an agent's work onto the case record. Returns a new record — the
 * engine never mutates the case in place; the host decides when to store it.
 */
export const writeWork = (
  record: CaseRecord,
  agent: string,
  work: Work,
  at: string,
): CaseRecord => ({
  ...record,
  fields: { ...record.fields, ...work.fields },
  confidence: { ...record.confidence, ...work.confidence },
  notes: [
    ...record.notes,
    ...work.notes.map((note) => ({ agent, at, note })),
  ],
});

/** The slice of the case an agent may read: exactly its manifest's input fields. */
export const readableCase = (record: CaseRecord, input: readonly string[]): CaseRecord => {
  const fields: Record<string, unknown> = {};
  const confidence: Record<string, number> = {};
  for (const key of input) {
    if (key in record.fields) fields[key] = record.fields[key];
    const c = record.confidence[key];
    if (c !== undefined) confidence[key] = c;
  }
  const narrowed: CaseRecord = {
    taskId: record.taskId,
    org: record.org,
    queue: record.queue,
    fields,
    confidence,
    notes: record.notes,
  };
  if (record.subQueue !== undefined) narrowed.subQueue = record.subQueue;
  return narrowed;
};
