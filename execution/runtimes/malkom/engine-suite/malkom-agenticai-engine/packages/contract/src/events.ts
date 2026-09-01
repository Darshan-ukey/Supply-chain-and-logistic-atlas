import { z } from "zod";
import { endingSchema } from "./endings.js";
import { failureTypeSchema } from "./manifest.js";
import { nameSchema, versionSchema } from "./ids.js";

/**
 * The run events — the event log of a run.
 *
 * Every step is written to the event log before the next step starts — the
 * model's reply, the tool's reply, the time. If a machine dies mid-run, the
 * run continues from the last written step. Any old run can also be replayed
 * exactly, which means "why did it do that?" always has an answer.
 *
 * The log is append-only and gapless: one run per log, sequence numbers with
 * no holes, starting with run.started and — once finished — ending with
 * run.ended.
 */

/** What a run has spent so far, and in total when it ends. */
export const spendSchema = z.object({
  /** Money, in minor units of the org's currency. */
  money: z.number().min(0),
  tokensIn: z.number().int().min(0),
  tokensOut: z.number().int().min(0),
  toolCalls: z.number().int().min(0),
  elapsedMs: z.number().int().min(0),
});
export type Spend = z.infer<typeof spendSchema>;

export const zeroSpend = (): Spend => ({
  money: 0,
  tokensIn: 0,
  tokensOut: 0,
  toolCalls: 0,
  elapsedMs: 0,
});

const base = {
  runId: z.string().uuid(),
  /** Gapless, per run. A hole means the log cannot be trusted for resume. */
  seq: z.number().int().min(0),
  /** The time, ISO. */
  at: z.string().datetime(),
};

export const runStartedSchema = z.object({
  ...base,
  type: z.literal("run.started"),
  agent: z.object({ id: nameSchema, version: versionSchema, label: z.string() }),
  org: z.string().min(1),
  taskId: z.string().min(1),
  queue: nameSchema,
  subQueue: nameSchema.optional(),
  /** The id of the access pass minted for this run. */
  passId: z.string().uuid(),
  /** True on shadow runs — the access pass blocks all writes. */
  shadow: z.boolean(),
  /** The goal handed in, verbatim. */
  goal: z.string(),
});

/** The model's reply. Written before the next step starts. */
export const modelRepliedSchema = z.object({
  ...base,
  type: z.literal("model.replied"),
  step: z.number().int().min(0),
  /** The reply, with the manifest's redaction rules already applied. */
  reply: z.string(),
  tokensIn: z.number().int().min(0),
  tokensOut: z.number().int().min(0),
  /** What this reply cost, in minor units of the org's currency. */
  money: z.number().min(0),
  elapsedMs: z.number().int().min(0),
});

/** A tool call going through the gateway. Recorded whether or not the agent cooperates. */
export const toolCalledSchema = z.object({
  ...base,
  type: z.literal("tool.called"),
  step: z.number().int().min(0),
  tool: nameSchema,
  /** The arguments, with the manifest's redaction rules already applied. */
  args: z.record(z.string(), z.unknown()),
  writes: z.boolean(),
});

/** The tool's reply. Written before the next step starts. */
export const toolRepliedSchema = z.object({
  ...base,
  type: z.literal("tool.replied"),
  step: z.number().int().min(0),
  tool: nameSchema,
  ok: z.boolean(),
  /** The reply, with the manifest's redaction rules already applied. */
  reply: z.unknown(),
  /** Set when the gateway refused the call — pass check failed, tool not listed. */
  refused: z.string().optional(),
  elapsedMs: z.number().int().min(0),
});

/** The agent reported what it is doing. One line, plain language. */
export const notedSchema = z.object({
  ...base,
  type: z.literal("noted"),
  step: z.number().int().min(0),
  note: z.string().min(1).max(500),
});

/** A retry, split by type of failure per the manifest's limits. */
export const runRetriedSchema = z.object({
  ...base,
  type: z.literal("run.retried"),
  failure: failureTypeSchema,
  attempt: z.number().int().min(1),
  delayMs: z.number().int().min(0),
  because: z.string().max(300),
});

export const runEndedSchema = z.object({
  ...base,
  type: z.literal("run.ended"),
  outcome: endingSchema,
  spend: spendSchema,
});

export const runEventSchema = z.discriminatedUnion("type", [
  runStartedSchema,
  modelRepliedSchema,
  toolCalledSchema,
  toolRepliedSchema,
  notedSchema,
  runRetriedSchema,
  runEndedSchema,
]);
export type RunEvent = z.infer<typeof runEventSchema>;
export type RunEventType = RunEvent["type"];

/**
 * An event before the log stamps it with its run id and sequence number.
 * (`Omit` over a union collapses to shared fields; this distributes instead.)
 */
export type Draft<T> = T extends unknown ? Omit<T, "runId" | "seq"> : never;
export type DraftRunEvent = Draft<RunEvent>;

/** Is this log trustworthy: starts once, gapless, one run, ended last if ended. */
export const checkEventLog = (
  events: readonly RunEvent[],
): { ok: true } | { ok: false; problems: string[] } => {
  const problems: string[] = [];
  if (events.length === 0) return { ok: false, problems: ["the event log is empty"] };
  if (events[0]?.type !== "run.started") problems.push('the log does not begin with "run.started"');

  events.forEach((event, index) => {
    if (event.seq !== index) problems.push(`event ${index} has seq ${event.seq} — the log has a hole`);
    if (event.type === "run.started" && index !== 0) problems.push(`"run.started" appears again at ${index}`);
    if (event.type === "run.ended" && index !== events.length - 1) {
      problems.push(`"run.ended" at ${index}, before the end of the log`);
    }
  });

  if (new Set(events.map((event) => event.runId)).size > 1) {
    problems.push("the log mixes more than one run");
  }
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
};

/** Has this run finished, one of the four ways? */
export const isEnded = (events: readonly RunEvent[]): boolean =>
  events.at(-1)?.type === "run.ended";

/** What a run spent, read straight off its event log. */
export const spendOf = (events: readonly RunEvent[]): Spend => {
  const spend = zeroSpend();
  const startedAt = events[0] !== undefined ? Date.parse(events[0].at) : Number.NaN;
  for (const event of events) {
    if (event.type === "model.replied") {
      spend.money += event.money;
      spend.tokensIn += event.tokensIn;
      spend.tokensOut += event.tokensOut;
    }
    if (event.type === "tool.called") spend.toolCalls += 1;
  }
  const last = events.at(-1);
  if (last !== undefined && !Number.isNaN(startedAt)) {
    spend.elapsedMs = Math.max(0, Date.parse(last.at) - startedAt);
  }
  return spend;
};

/**
 * Where a resumed run continues from: the last written step. Everything before
 * it is settled; recorded tool replies are served again so the run takes the
 * route it was taking. Null when the run already ended.
 */
export const resumePoint = (
  events: readonly RunEvent[],
): { seq: number; step: number } | null => {
  if (events.length === 0) return { seq: 0, step: 0 };
  if (isEnded(events)) return null;
  let last: { seq: number; step: number } = { seq: 0, step: 0 };
  for (const event of events) {
    if ("step" in event && typeof event.step === "number") {
      last = { seq: event.seq, step: event.step };
    }
  }
  return last;
};

/**
 * Recorded tool replies, keyed by tool and arguments, for resume and replay.
 * A resumed or replayed run is served the recorded reply instead of calling
 * the tool again — which is what makes a run exactly repeatable.
 */
export const recordedToolReplies = (
  events: readonly RunEvent[],
  keyOf: (tool: string, args: Record<string, unknown>) => string,
): Map<string, unknown> => {
  const calls = new Map<string, { tool: string; args: Record<string, unknown> }>();
  const replies = new Map<string, unknown>();
  for (const event of events) {
    if (event.type === "tool.called") {
      calls.set(`${event.tool}:${event.step}`, { tool: event.tool, args: event.args });
    }
    if (event.type === "tool.replied" && event.ok) {
      const call = calls.get(`${event.tool}:${event.step}`);
      if (call !== undefined) replies.set(keyOf(call.tool, call.args), event.reply);
    }
  }
  return replies;
};
