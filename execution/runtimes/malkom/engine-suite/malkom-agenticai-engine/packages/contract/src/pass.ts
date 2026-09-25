import { z } from "zod";
import { nameSchema, versionSchema } from "./ids.js";

/**
 * The access pass.
 *
 * An agent never holds a password or key. For each run it gets a short-lived
 * access pass: one org, one task, the named tools, valid for minutes. Nothing
 * else is reachable. The gateway checks the pass on every call.
 *
 * During shadow runs, the pass blocks all writes — the agent cannot change
 * anything even if its code tries.
 *
 * `checkPass` is a pure function with no dependencies, because it is the most
 * security-sensitive code in the engine and should be readable in one sitting
 * and testable without a server.
 */

export const accessPassSchema = z.object({
  /** Pass format version, so checking can change without breaking old runs. */
  format: z.literal(1),
  /** Unique per pass — logged, and usable to revoke one run mid-flight. */
  passId: z.string().uuid(),
  runId: z.string().uuid(),

  /** One org. */
  org: z.string().min(1),
  /** One task. */
  taskId: z.string().min(1),

  agent: z.object({ id: nameSchema, version: versionSchema }),

  /**
   * The named tools, copied from the manifest at mint time. The gateway does
   * not re-read the manifest; the pass is the authority, so a manifest change
   * mid-run cannot widen a pass already in the wild.
   */
  tools: z.array(nameSchema),

  /** Seconds since epoch. Valid for minutes — never hours. */
  issuedAt: z.number().int().min(0),
  expiresAt: z.number().int().min(0),

  /** True when this run must change nothing. The gateway refuses every write. */
  shadow: z.boolean(),
});
export type AccessPass = z.infer<typeof accessPassSchema>;

/** Why a pass check failed. Returned rather than thrown, so callers log it. */
export type PassRefusal =
  | { reason: "malformed"; problems: string[] }
  | { reason: "expired"; expiredAt: number }
  | { reason: "tool-not-on-pass"; tool: string }
  | { reason: "wrong-task"; expected: string; got: string }
  | { reason: "write-during-shadow"; tool: string };

/** The gateway's whole pass decision, in one pure function. */
export const checkPass = (
  raw: unknown,
  call: { tool: string; taskId: string; writes: boolean },
  nowSec: number,
): { ok: true; pass: AccessPass } | { ok: false; refusal: PassRefusal } => {
  const parsed = accessPassSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      refusal: {
        reason: "malformed",
        problems: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      },
    };
  }
  const pass = parsed.data;

  if (nowSec >= pass.expiresAt) {
    return { ok: false, refusal: { reason: "expired", expiredAt: pass.expiresAt } };
  }
  if (call.taskId !== pass.taskId) {
    return { ok: false, refusal: { reason: "wrong-task", expected: pass.taskId, got: call.taskId } };
  }
  if (!pass.tools.includes(call.tool)) {
    return { ok: false, refusal: { reason: "tool-not-on-pass", tool: call.tool } };
  }
  if (pass.shadow && call.writes) {
    return { ok: false, refusal: { reason: "write-during-shadow", tool: call.tool } };
  }
  return { ok: true, pass };
};

/** One sentence for the audit trail, phrased the same by every caller. */
export const explainRefusal = (refusal: PassRefusal): string => {
  switch (refusal.reason) {
    case "malformed":
      return `the access pass could not be read: ${refusal.problems.join("; ")}`;
    case "expired":
      return "the access pass had already expired";
    case "tool-not-on-pass":
      return `"${refusal.tool}" is not on this run's access pass`;
    case "wrong-task":
      return `the access pass is for a different task (${refusal.expected})`;
    case "write-during-shadow":
      return `"${refusal.tool}" writes, and this is a shadow run — all writes are blocked`;
  }
};
