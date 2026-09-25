import { z } from "zod";
import { fieldKeySchema, labelSchema, nameSchema, versionSchema } from "./ids.js";

/**
 * The manifest — one small file that states: the agent's goal, its queue,
 * which fields it reads and writes, its tools, its rules, its limits, its
 * telemetry settings. Limits only — never steps.
 *
 * An agent gets a goal. It does not get a list of steps. The agent looks at
 * the case, decides its own steps, decides which tools to use, in which order,
 * and how many times. Two identical cases can be handled in two different ways
 * by the same agent — that is normal and correct. If the steps were fixed
 * before the run starts it would be a workflow, and we do not ship workflows
 * and call them agents.
 *
 * We define four things about an agent, and they are all limits, not steps:
 * its goal, what it may access, what it may spend, and the four ways it can
 * finish.
 */

/* ------------------------------- limits -------------------------------- */

/**
 * Types of failure, for retries. Retries are configured, and split by type:
 * a network error or a dead AI endpoint is worth retrying. A wrong answer is
 * not — retrying it costs money and still gives a wrong answer.
 */
export const failureTypeSchema = z.enum([
  /** A network error on the way to a tool or the model. */
  "network",
  /** A dead or overloaded AI endpoint. */
  "provider-down",
  /** A tool that errored rather than refused. */
  "tool-failed",
  /** The agent produced a wrong or unusable answer. Never worth retrying. */
  "wrong-answer",
]);
export type FailureType = z.infer<typeof failureTypeSchema>;

/** Which failure types get retried, how many times, and with what delay. */
export const retrySchema = z.object({
  on: z.array(failureTypeSchema).default(["network", "provider-down"]),
  times: z.number().int().min(0).max(10).default(2),
  delayMs: z.number().int().min(0).max(600_000).default(2_000),
});
export type Retry = z.infer<typeof retrySchema>;

/**
 * Three limits per run: a timeout per step, a total time limit, and a money
 * limit. Hitting any limit is a normal ending, not a crash — the case goes to
 * a person. Same principle as "never silently guess": never silently
 * overspend.
 *
 * Every number here is a manifest field, and each org can override it.
 * Nothing is hard-coded.
 */
export const limitsSchema = z.object({
  retry: retrySchema.default({}),
  /** A timeout per step: one model reply, one tool reply. */
  stepTimeoutMs: z.number().int().min(100).max(600_000).default(30_000),
  /** A total time limit for the whole run. */
  runTimeoutMs: z.number().int().min(1_000).max(86_400_000).default(300_000),
  /** A money limit for the whole run, in minor units of the org's currency. */
  moneyLimit: z.number().min(0).default(500),
});
export type Limits = z.infer<typeof limitsSchema>;

/** An org's overrides, applied on top of a manifest's limits at attach time. */
export const limitsOverrideSchema = z.object({
  retry: retrySchema.partial().optional(),
  stepTimeoutMs: z.number().int().min(100).max(600_000).optional(),
  runTimeoutMs: z.number().int().min(1_000).max(86_400_000).optional(),
  moneyLimit: z.number().min(0).optional(),
});
export type LimitsOverride = z.infer<typeof limitsOverrideSchema>;

/** The limits a run actually gets: the manifest's numbers, org override on top. */
export const resolveLimits = (limits: Limits, override?: LimitsOverride): Limits => ({
  retry: {
    on: override?.retry?.on ?? limits.retry.on,
    times: override?.retry?.times ?? limits.retry.times,
    delayMs: override?.retry?.delayMs ?? limits.retry.delayMs,
  },
  stepTimeoutMs: override?.stepTimeoutMs ?? limits.stepTimeoutMs,
  runTimeoutMs: override?.runTimeoutMs ?? limits.runTimeoutMs,
  moneyLimit: override?.moneyLimit ?? limits.moneyLimit,
});

/* ------------------------ input, output, rules, tools ------------------- */

/**
 * Output: which fields the agent fills in, and the minimum confidence needed
 * on each field before "done" counts.
 */
export const outputFieldSchema = z.object({
  field: fieldKeySchema,
  minConfidence: z.number().min(0).max(1).default(0.8),
});
export type OutputField = z.infer<typeof outputFieldSchema>;

/**
 * Rules: rule sets and validation sets from the engines the org already runs.
 * Rules are never copied into agent code. One rulebook, used by agents and
 * people alike.
 */
export const rulesSchema = z.object({
  ruleSets: z.array(nameSchema).default([]),
  validationSets: z.array(nameSchema).default([]),
});
export type Rules = z.infer<typeof rulesSchema>;

/**
 * A tool on the manifest's named list. The MCP gateway blocks any tool not on
 * the list. But the agent alone decides which listed tools to use, when, and
 * how often. Every tool must have a plain-language label — the manifest is
 * rejected without one.
 */
export const manifestToolSchema = z.object({
  name: nameSchema,
  label: labelSchema,
});
export type ManifestTool = z.infer<typeof manifestToolSchema>;

/* ------------------------------ telemetry ------------------------------- */

/**
 * Telemetry is on by default, produced by the engine itself — the agent
 * developer cannot forget it or turn it off. The manifest only adds extra
 * fields and redaction rules on top.
 */
export const telemetrySchema = z.object({
  /** Extra fields to record on the run's trace, by field key. */
  extraFields: z.array(fieldKeySchema).default([]),
  /** What percentage of runs keep a full trace. */
  tracePercent: z.number().min(0).max(100).default(100),
  /** Values that must be redacted before writing, by field key. */
  redact: z.array(fieldKeySchema).default([]),
});
export type Telemetry = z.infer<typeof telemetrySchema>;

/* ------------------------------ container ------------------------------- */

/**
 * The container — the agent's code, packaged. It can be written in any
 * language, with any framework; Malkom does not need to know what is inside.
 * The adapter names how the container connects to the contract.
 */
export const containerSchema = z.object({
  image: z.string().min(1).max(300),
  adapter: nameSchema.default("typescript"),
});
export type Container = z.infer<typeof containerSchema>;

/* ------------------------------ manifest -------------------------------- */

export const manifestSchema = z.object({
  kind: z.literal("malkom.agent-manifest/1"),

  id: nameSchema,
  version: versionSchema,
  /** The plain-language label. The manifest is rejected without one. */
  label: labelSchema,
  /** The agent's goal — what a finished case looks like. Handed to the agent. */
  goal: z.string().min(1).max(2_000),

  /** The queue this agent serves, and optionally which sub-queues. */
  queue: nameSchema,
  subQueues: z.array(nameSchema).default([]),

  /**
   * Input: which task fields the agent may read — these point at the org's
   * existing field schemas, nothing new is invented.
   */
  input: z.array(fieldKeySchema).default([]),
  /** Output: the fields it fills, each with its confidence floor. */
  output: z.array(outputFieldSchema).min(1),

  rules: rulesSchema.default({}),
  tools: z.array(manifestToolSchema).default([]),
  limits: limitsSchema.default({}),
  telemetry: telemetrySchema.default({}),
  container: containerSchema,
});
export type Manifest = z.infer<typeof manifestSchema>;

/** Parse a manifest, returning problems rather than throwing. */
export const parseManifest = (
  input: unknown,
): { ok: true; manifest: Manifest } | { ok: false; problems: string[] } => {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
      ),
    };
  }

  // Rules the shape alone cannot express.
  const problems: string[] = [];
  const manifest = parsed.data;

  const toolNames = new Set<string>();
  for (const tool of manifest.tools) {
    if (toolNames.has(tool.name)) problems.push(`tool "${tool.name}" is listed twice`);
    toolNames.add(tool.name);
  }

  const inputKeys = new Set<string>();
  for (const key of manifest.input) {
    if (inputKeys.has(key)) problems.push(`input field "${key}" is listed twice`);
    inputKeys.add(key);
  }
  const outputKeys = new Set<string>();
  for (const out of manifest.output) {
    if (outputKeys.has(out.field)) problems.push(`output field "${out.field}" is listed twice`);
    outputKeys.add(out.field);
  }

  return problems.length === 0 ? { ok: true, manifest } : { ok: false, problems };
};
