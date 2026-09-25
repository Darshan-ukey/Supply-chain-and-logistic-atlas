import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModel } from "ai";

/**
 * The sandbox's built-in test model.
 *
 * The run button must work on a machine with no AI key — a draft still runs
 * on sample cases, end to end, over the real runner, gateway, pass and event
 * log. This model is the stand-in that makes that possible: a careful clerk
 * that reads the brief and the sample case and works the fields out.
 *
 * It is a stand-in for a model, not for the engine — everything around it is
 * the production path. With an AI provider configured, the same draft runs
 * against the real model with nothing else changed.
 */

interface RequiredField {
  field: string;
  floor: number;
}

interface CaseView {
  fields: Record<string, unknown>;
  confidence: Record<string, number>;
  notes: { note: string }[];
}

type Move = { tool: string; input: Record<string, unknown> } | { end: Record<string, unknown> };

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

/** The fields the goal requires, parsed from the brief the adapter builds. */
const requiredFrom = (system: string): RequiredField[] => {
  const required: RequiredField[] = [];
  for (const match of system.matchAll(/^- (\S+) \(confidence ([\d.]+) or better\)$/gm)) {
    const field = match[1];
    const floor = Number(match[2]);
    if (field !== undefined && Number.isFinite(floor)) required.push({ field, floor });
  }
  return required;
};

/**
 * The clerk's reading of the message. Labelled values first — "field: value"
 * in the sample settles that field — then a reference-code pattern for fields
 * whose names say they hold one.
 */
const extract = (
  text: string,
  required: readonly RequiredField[],
): { fields: Record<string, unknown>; confidence: Record<string, number> } => {
  const fields: Record<string, unknown> = {};
  const confidence: Record<string, number> = {};

  for (const need of required) {
    const labelled = new RegExp(`${need.field}\\s*[:=]\\s*([^\\n,;]+)`, "i").exec(text);
    if (labelled?.[1] !== undefined) {
      const raw = labelled[1].trim();
      const asNumber = Number(raw);
      fields[need.field] = raw !== "" && Number.isFinite(asNumber) && /^\d+(\.\d+)?$/.test(raw) ? asNumber : raw;
      // A field the message states outright: the clerk is as sure as the
      // message is clear, high enough for any ordinary floor a manifest sets.
      confidence[need.field] = 0.98;
      continue;
    }
    if (/ref|number/i.test(need.field)) {
      const code = /\b([A-Z]{2,4}-?\d{3,7})\b/.exec(text);
      if (code?.[1] !== undefined) {
        fields[need.field] = code[1];
        confidence[need.field] = 0.9;
      }
    }
  }
  return { fields, confidence };
};

const decide = (system: string, view: CaseView, toolNames: readonly string[]): Move[] => {
  const required = requiredFrom(system);
  const text = Object.values(view.fields)
    .map(textOf)
    .filter((part) => part !== "")
    .join("\n");
  const has = (tool: string): boolean => toolNames.includes(tool);
  const moves: Move[] = [];
  const woken = view.notes.some((note) => note.note.startsWith("The case woke:"));

  if (has("read_case")) moves.push({ tool: "read_case", input: {} });

  if (/cannot be read|no text layer|scanned image|illegible/i.test(text)) {
    const partial = extract(text, required);
    moves.push({
      end: {
        ending: "handover",
        whyStopped: "The attached document cannot be read, and inventing its contents would be worse than stopping.",
        fields: partial.fields,
        confidence: partial.confidence,
        tried: ["Read the message", "Looked for a text layer in the attachment"],
        notes: ["Ask the sender to resend the document as text or a readable PDF."],
      },
    });
    return moves;
  }

  if (!woken && /will follow|to follow shortly|awaiting documents/i.test(text)) {
    const soon = /shortly|within the hour|in a moment/i.test(text);
    moves.push({
      end: {
        ending: "parked",
        because: "The message says the documents are still on their way.",
        wakeOn: "date",
        wakeDate: new Date(Date.now() + (soon ? 15_000 : 86_400_000)).toISOString(),
        tried: ["Read the message"],
        notes: ["Parked until the promised documents arrive."],
      },
    });
    return moves;
  }

  const read = extract(text, required);
  const merged = { ...read.fields, ...view.fields };
  const mergedConfidence = { ...read.confidence, ...view.confidence };
  const personAnswered = required.some((need) => (view.confidence[need.field] ?? 0) >= 0.999);

  const asked = /([^.?!]*\b(?:or)\b[^.?!]*)\?/.exec(text);
  if (asked?.[1] !== undefined && !personAnswered) {
    const sentence = `${asked[1].trim().replace(/^\w/, (c) => c.toUpperCase())}?`.slice(0, 200);
    const halves = asked[1].split(/,?\s+or\s+/i).map((half) => half.trim()).filter((half) => half !== "");
    const choices = halves.length >= 2 ? halves.slice(0, 5) : ["Yes", "No"];
    const fills =
      required.find((need) => (mergedConfidence[need.field] ?? 0) < need.floor)?.field ??
      required[0]?.field ??
      "answer";
    moves.push({
      end: {
        ending: "question",
        sentence,
        choices: choices.map((choice) => choice.replace(/^do (?:you|we) want\s+/i, "").slice(0, 120)),
        fills,
        fields: read.fields,
        confidence: read.confidence,
        tried: ["Read the message", "Worked out every field the message settles"],
        notes: ["One answer completes this case."],
      },
    });
    return moves;
  }

  const answered: Record<string, unknown> = {};
  const answeredConfidence: Record<string, number> = {};
  const missing: string[] = [];
  for (const need of required) {
    const value = merged[need.field];
    const sure = mergedConfidence[need.field] ?? 0;
    if (value !== undefined && value !== null && value !== "" && sure >= need.floor) {
      answered[need.field] = value;
      answeredConfidence[need.field] = sure;
    } else {
      missing.push(need.field);
    }
  }

  if (missing.length > 0) {
    moves.push({
      end: {
        ending: "handover",
        whyStopped: `The message does not settle ${missing.join(", ")}, and guessing would cost a person more than asking.`,
        fields: answered,
        confidence: answeredConfidence,
        tried: ["Read the message", "Worked out every field the message settles"],
        notes: [`Still needed: ${missing.join(", ")}.`],
      },
    });
    return moves;
  }

  if (has("write_fields")) {
    moves.push({ tool: "write_fields", input: { fields: answered, confidence: answeredConfidence } });
  }
  if (has("check_validation")) {
    moves.push({ tool: "check_validation", input: { fields: answered } });
  }
  moves.push({
    end: {
      ending: "done",
      fields: answered,
      confidence: answeredConfidence,
      tried: ["Read the message", "Worked out the fields", "Checked them"],
      notes: [],
    },
  });
  return moves;
};

/** A fresh clerk per run — it keeps its place in its own moves. */
export const sandboxModel = (): LanguageModel => {
  let moves: Move[] | null = null;
  let at = 0;

  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      if (moves === null) {
        const system = options.prompt
          .filter((message) => message.role === "system")
          .map((message) => (typeof message.content === "string" ? message.content : ""))
          .join("\n");
        const firstUser = options.prompt.find((message) => message.role === "user");
        let view: CaseView = { fields: {}, confidence: {}, notes: [] };
        if (firstUser !== undefined && Array.isArray(firstUser.content)) {
          const text = firstUser.content.map((part) => (part.type === "text" ? part.text : "")).join("");
          try {
            const parsed = JSON.parse(text) as { case?: Partial<CaseView> };
            view = {
              fields: parsed.case?.fields ?? {},
              confidence: parsed.case?.confidence ?? {},
              notes: (parsed.case?.notes ?? []) as { note: string }[],
            };
          } catch {
            // An unreadable case leaves the view empty; the clerk hands over.
          }
        }
        const toolNames = (options.tools ?? []).map((tool) => tool.name);
        moves = decide(system, view, toolNames);
      }

      const move = moves[Math.min(at, moves.length - 1)];
      at += 1;
      if (move === undefined) throw new Error("the clerk ran out of moves");

      const call =
        "end" in move
          ? { toolName: "end", input: JSON.stringify(move.end) }
          : { toolName: move.tool, input: JSON.stringify(move.input) };

      return {
        finishReason: { unified: "tool-calls" as const, raw: "tool-calls" },
        usage: {
          inputTokens: { total: 220, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 45, text: 45, reasoning: undefined },
        },
        content: [
          {
            type: "tool-call" as const,
            toolCallId: `clerk-${at}`,
            toolName: call.toolName,
            input: call.input,
          },
        ],
        warnings: [],
      };
    },
  }) as unknown as LanguageModel;
};
