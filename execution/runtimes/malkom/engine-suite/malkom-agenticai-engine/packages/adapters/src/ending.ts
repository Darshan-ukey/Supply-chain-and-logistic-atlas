import { z } from "zod";
import { type Ending, type Work, workSchema } from "@malkom/agenticai-contract";

/**
 * The four endings, and how an agent's `end` call becomes one — shared by
 * every adapter so that a TypeScript agent and a LangGraph agent end a case
 * in exactly the same way. The rules here are the contract's, not a
 * framework's: a question that cannot be answered in one action is a handover
 * wearing a question's clothes; a parked case with nothing named to wake it
 * would sleep forever, so it hands over instead.
 */

/** The `end` tool's arguments — the four endings, and no fifth. */
export const endArgsSchema = z.object({
  ending: z.enum(["done", "question", "handover", "parked"]),
  fields: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  tried: z.array(z.string().max(300)).default([]),
  notes: z.array(z.string().max(500)).default([]),
  /** question: one sentence, two to five choices, and the field the answer fills. */
  sentence: z.string().max(200).optional(),
  choices: z.array(z.string().min(1).max(120)).max(5).optional(),
  fills: z.string().optional(),
  /** handover: why you stopped, in one plain sentence. */
  whyStopped: z.string().max(300).optional(),
  /** parked: what wakes the case — a reply, a document, or a date. */
  wakeOn: z.enum(["reply", "document", "date"]).optional(),
  wakeDate: z.string().optional(),
  wakeDetail: z.string().max(300).optional(),
  because: z.string().max(300).optional(),
});
export type EndArgs = z.infer<typeof endArgsSchema>;

const workOf = (raw: EndArgs): Work =>
  workSchema.parse({
    fields: raw.fields,
    confidence: raw.confidence,
    tried: raw.tried,
    notes: raw.notes,
  });

/**
 * Turn the agent's `end` call into a contract ending. A question missing its
 * sentence, its two-to-five choices or the field it fills is not answerable
 * in one action — it is a handover wearing a question's clothes, and treated
 * as one rather than passed along to waste a person's time.
 */
export const toEnding = (raw: EndArgs): Ending => {
  const work = workOf(raw);
  switch (raw.ending) {
    case "done":
      return { ending: "done", work };
    case "question": {
      if (
        raw.sentence === undefined ||
        raw.fills === undefined ||
        raw.choices === undefined ||
        raw.choices.length < 2
      ) {
        return {
          ending: "handover",
          whyStopped:
            raw.because ??
            "It asked a question that could not be answered in one action, so the case needs a person.",
          work,
        };
      }
      return {
        ending: "question",
        sentence: raw.sentence,
        choices: raw.choices,
        fills: raw.fills,
        work,
      };
    }
    case "handover":
      return {
        ending: "handover",
        whyStopped: raw.whyStopped ?? raw.because ?? "It could not finish this case.",
        work,
      };
    case "parked": {
      const because = raw.because ?? "The case is waiting on something outside it.";
      if (raw.wakeOn === "date" && raw.wakeDate !== undefined && !Number.isNaN(Date.parse(raw.wakeDate))) {
        return {
          ending: "parked",
          wake: { on: "date", date: new Date(raw.wakeDate).toISOString() },
          because,
          work,
        };
      }
      if (raw.wakeOn === "reply" || raw.wakeOn === "document") {
        return {
          ending: "parked",
          wake:
            raw.wakeDetail !== undefined ? { on: raw.wakeOn, detail: raw.wakeDetail } : { on: raw.wakeOn },
          because,
          work,
        };
      }
      // Parked with nothing named to wake it would sleep forever. Hand it over.
      return {
        ending: "handover",
        whyStopped: `${because} — but it did not say what should wake the case.`,
        work,
      };
    }
  }
};
