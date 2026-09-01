import { z } from "zod";
import { fieldKeySchema } from "./ids.js";

/**
 * The four ways a run can finish. There are no others, and the agent itself
 * chooses which ending, and when.
 *
 *   done      — work is finished. The task becomes PROCESSED / CLOSED.
 *   question  — needs one answer. The task becomes QUERY; takes a person seconds.
 *   handover  — gives up, work attached. Goes to work allocation, then the
 *               HITL queue. A person never starts from zero.
 *   parked    — waiting for something. The task becomes PARKED, and the ending
 *               says what wakes it: a reply, a document, a date.
 *
 * Every ending carries the agent's work — the fields it filled, its confidence
 * numbers, what it tried, and its notes — so nothing an agent worked out is
 * ever thrown away, whichever way the run ends.
 */

/**
 * The agent's work, attached to every ending and written onto the shared case
 * record. When a person gets the case in HITL, they see exactly this.
 */
export const workSchema = z.object({
  /** The fields it filled, keyed by the org's own field names. */
  fields: z.record(z.string(), z.unknown()).default({}),
  /** Its confidence numbers, one per filled field, 0 to 1. */
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  /** What it tried, one plain sentence per attempt. */
  tried: z.array(z.string().min(1).max(300)).default([]),
  /** Notes for the next agent, or the person, working this case. */
  notes: z.array(z.string().min(1).max(500)).default([]),
});
export type Work = z.infer<typeof workSchema>;

export const emptyWork = (): Work => workSchema.parse({});

/** done — the work is finished. */
export const doneSchema = z.object({
  ending: z.literal("done"),
  work: workSchema,
});
export type Done = z.infer<typeof doneSchema>;

/**
 * question — the agent needs one answer, not a whole review.
 *
 * The format is forced: one sentence, two to five choices, and the field the
 * answer fills. Answering takes seconds, and the answer is a stored example
 * with a known correct value.
 */
export const questionSchema = z.object({
  ending: z.literal("question"),
  /** One sentence. The work carries the context — the sentence never has to. */
  sentence: z.string().min(1).max(200),
  /** Two to five choices. An open question is not a question, it is a handover. */
  choices: z.array(z.string().min(1).max(120)).min(2).max(5),
  /** The field the answer fills, so one answer completes the work. */
  fills: fieldKeySchema,
  work: workSchema,
});
export type Question = z.infer<typeof questionSchema>;

/** handover — the agent gives up, and its work goes with the case. */
export const handoverSchema = z.object({
  ending: z.literal("handover"),
  /** Why it stopped, in one plain sentence a person reads first. */
  whyStopped: z.string().min(1).max(300),
  work: workSchema,
});
export type Handover = z.infer<typeof handoverSchema>;

/**
 * What should wake a parked run: a reply, a document, or a date.
 * The runtime implements the waking; the ending only names it.
 */
export const wakeSchema = z.discriminatedUnion("on", [
  z.object({ on: z.literal("reply"), detail: z.string().max(300).optional() }),
  z.object({ on: z.literal("document"), detail: z.string().max(300).optional() }),
  z.object({ on: z.literal("date"), date: z.string().datetime() }),
]);
export type Wake = z.infer<typeof wakeSchema>;

/** parked — waiting for something, and it says what wakes it. */
export const parkedSchema = z.object({
  ending: z.literal("parked"),
  wake: wakeSchema,
  /** Why it parked, in one plain sentence. */
  because: z.string().min(1).max(300),
  work: workSchema,
});
export type Parked = z.infer<typeof parkedSchema>;

export const endingSchema = z.discriminatedUnion("ending", [
  doneSchema,
  questionSchema,
  handoverSchema,
  parkedSchema,
]);
export type Ending = z.infer<typeof endingSchema>;
export type EndingName = Ending["ending"];

export const ENDING_NAMES = ["done", "question", "handover", "parked"] as const;

/** Does this ending put the case in front of a person now? parked does not — it waits. */
export const needsAPerson = (ending: Ending): boolean =>
  ending.ending === "question" || ending.ending === "handover";
