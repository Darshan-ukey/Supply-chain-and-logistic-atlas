import {
  checkPass,
  explainRefusal,
  type AccessPass,
  type DraftRunEvent,
  type OfferedTool,
  type ToolReply,
} from "@malkom/agenticai-contract";

/**
 * The gateway — the only door to data.
 *
 * Two jobs, and the second is why this is a choke point rather than a helper
 * the agent may or may not use:
 *
 *   The access pass is checked on every call. Anything not on the pass — a
 *   tool the manifest never listed, a write during a shadow run, an expired
 *   pass — is refused.
 *
 *   The gateway records and times every tool call itself. So you see exactly
 *   what an agent touched, even if the agent's code is badly written.
 *
 * A refusal comes back as a value rather than a throw. An agent told "no"
 * should be able to try something else — that is the difference between a
 * system that reasons and one that crashes.
 */

/** One tool behind the gateway: what the agent sees, and what the host runs. */
export interface GatewayTool {
  readonly name: string;
  /** The plain-language label. Every tool has one; the gateway refuses to serve one without. */
  readonly label: string;
  readonly describe: string;
  /** True when this tool changes anything. Shadow runs are refused every write. */
  readonly writes: boolean;
  /** JSON Schema for the arguments, generated from org config. */
  readonly args: Record<string, unknown>;
  run(args: Record<string, unknown>): Promise<unknown>;
}

export interface GatewayOptions {
  readonly tools: readonly GatewayTool[];
  readonly pass: AccessPass;
  /**
   * Every call is written to the event log — tool.called before the tool
   * runs, tool.replied before anything else happens. Awaited, so the log
   * always has the step before the next one starts.
   */
  record(event: DraftRunEvent): Promise<void>;
  /** Redaction applied to arguments and replies before they are recorded. */
  redact(value: unknown): unknown;
  /** A timeout per step, from the run's limits. */
  readonly stepTimeoutMs: number;
  now?(): number;
  /**
   * Recorded tool replies from an earlier run, keyed by `tool:argsKey`.
   * Present on resume and replay: the recorded reply is served instead of
   * calling the tool again, so the run takes the route it was taking.
   */
  readonly recorded?: ReadonlyMap<string, unknown>;
}

/** The stable key for a call, used to match recorded replies on resume. */
export const callKey = (tool: string, args: Record<string, unknown>): string =>
  `${tool}:${JSON.stringify(args, Object.keys(args).sort())}`;

export class Gateway {
  private step = 0;
  private readonly toolsByName: ReadonlyMap<string, GatewayTool>;

  constructor(private readonly options: GatewayOptions) {
    for (const tool of options.tools) {
      if (tool.label.trim() === "") {
        throw new Error(`tool "${tool.name}" has no plain-language label — the gateway refuses to serve it`);
      }
    }
    this.toolsByName = new Map(options.tools.map((tool) => [tool.name, tool]));
  }

  /**
   * The tools this run is offered: the pass's named list, and on a shadow run
   * nothing that writes. An agent is never even shown a door it may not open —
   * refusal at call time is the second line of defence, not the first.
   */
  offered(): OfferedTool[] {
    const offered: OfferedTool[] = [];
    for (const name of this.options.pass.tools) {
      const tool = this.toolsByName.get(name);
      if (tool === undefined) continue;
      if (this.options.pass.shadow && tool.writes) continue;
      offered.push({
        name: tool.name,
        label: tool.label,
        describe: tool.describe,
        writes: tool.writes,
        args: tool.args,
      });
    }
    return offered;
  }

  /** How many calls have gone through this gateway, refused ones included. */
  calls(): number {
    return this.step;
  }

  /**
   * Call a tool. The pass is checked on every call; the call is timed and
   * recorded whether it succeeds, fails or is refused.
   */
  async call(name: string, args: Record<string, unknown>): Promise<ToolReply> {
    const now = this.options.now ?? Date.now;
    const step = this.step;
    this.step += 1;

    const tool = this.toolsByName.get(name);
    const writes = tool?.writes ?? true;

    const decision = checkPass(
      this.options.pass,
      { tool: name, taskId: this.options.pass.taskId, writes },
      Math.floor(now() / 1000),
    );

    if (!decision.ok) {
      const refused = explainRefusal(decision.refusal);
      await this.options.record({
        type: "tool.called",
        at: new Date(now()).toISOString(),
        step,
        tool: name,
        args: this.options.redact(args) as Record<string, unknown>,
        writes,
      });
      await this.options.record({
        type: "tool.replied",
        at: new Date(now()).toISOString(),
        step,
        tool: name,
        ok: false,
        reply: null,
        refused,
        elapsedMs: 0,
      });
      return { ok: false, refused };
    }

    if (tool === undefined) {
      // On the pass, but not generated from this org's config — the org lost
      // an Integration, or the manifest names a tool the org never had.
      const refused = `"${name}" is not a tool this org's gateway has`;
      await this.options.record({
        type: "tool.called",
        at: new Date(now()).toISOString(),
        step,
        tool: name,
        args: this.options.redact(args) as Record<string, unknown>,
        writes,
      });
      await this.options.record({
        type: "tool.replied",
        at: new Date(now()).toISOString(),
        step,
        tool: name,
        ok: false,
        reply: null,
        refused,
        elapsedMs: 0,
      });
      return { ok: false, refused };
    }

    await this.options.record({
      type: "tool.called",
      at: new Date(now()).toISOString(),
      step,
      tool: name,
      args: this.options.redact(args) as Record<string, unknown>,
      writes: tool.writes,
    });

    const startedAt = now();
    try {
      const key = callKey(name, args);
      const recorded = this.options.recorded?.has(key) === true;
      const reply = recorded
        ? this.options.recorded?.get(key)
        : await withTimeout(tool.run(args), this.options.stepTimeoutMs, `"${tool.label}"`);

      const elapsedMs = now() - startedAt;
      await this.options.record({
        type: "tool.replied",
        at: new Date(now()).toISOString(),
        step,
        tool: name,
        ok: true,
        reply: this.options.redact(reply),
        elapsedMs,
      });
      return { ok: true, reply };
    } catch (error) {
      const elapsedMs = now() - startedAt;
      const refused = error instanceof Error ? error.message : String(error);
      await this.options.record({
        type: "tool.replied",
        at: new Date(now()).toISOString(),
        step,
        tool: name,
        ok: false,
        reply: null,
        refused: refused.slice(0, 300),
        elapsedMs,
      });
      return { ok: false, refused };
    }
  }
}

/** The timeout per step, applied to the tool's own work. */
const withTimeout = async <T>(work: Promise<T>, ms: number, what: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms}ms`)), ms);
    timer.unref?.();
  });
  try {
    return await Promise.race([work, ceiling]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};
