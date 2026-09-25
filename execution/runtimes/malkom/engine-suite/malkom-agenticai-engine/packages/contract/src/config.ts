import { z } from "zod";
import { limitsSchema, telemetrySchema } from "./manifest.js";

/**
 * The engine's configuration — every default in one place, and every one of
 * them the host's to change. A manifest that states a number wins over these;
 * an org override wins over the manifest. Nothing is hard-coded.
 */

export const engineConfigSchema = z.object({
  /** Defaults for any limit a manifest leaves unstated. */
  limits: limitsSchema.default({}),
  /** Defaults for any telemetry setting a manifest leaves unstated. */
  telemetry: telemetrySchema.default({}),
  pass: z
    .object({
      /** How long an access pass is valid. Minutes, never hours. */
      validityMinutes: z.number().int().min(1).max(120).default(15),
    })
    .default({}),
  runner: z
    .object({
      /**
       * A ceiling on how many steps a run may take before the runner ends it.
       * A limit on runaway loops, not a script — the agent decides its steps.
       */
      maxSteps: z.number().int().min(1).max(200).default(24),
    })
    .default({}),
});
export type EngineConfig = z.infer<typeof engineConfigSchema>;

/** Build a full engine config from whatever the host chooses to state. */
export const engineConfig = (partial?: unknown): EngineConfig =>
  engineConfigSchema.parse(partial ?? {});
