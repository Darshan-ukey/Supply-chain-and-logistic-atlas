import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { AgentFailure, type Ending, type Start } from "@malkom/agenticai-contract";
import type { Adapter } from "./adapter.js";
import { endArgsSchema, toEnding } from "./ending.js";

/**
 * The LangGraph adapter — the second of the two adapters we ship on day one.
 *
 * The agent is a LangGraph graph, in Python. This adapter is the bridge: it
 * starts the Python process, hands the goal and the case in, and relays the
 * agent's every tool call through the same gateway, its every report to the
 * same event log, and its ending out — exactly the four the contract allows.
 * The graph decides its own steps; this adapter never controls them. The
 * contract around it — the gateway, the pass, the event log, the four endings
 * — is identical to the TypeScript adapter's. A new framework is a new
 * adapter, not a new engine.
 *
 * The channel is newline-delimited JSON over the child's stdin/stdout, so the
 * agent could be written in any language that can read a line and write one;
 * Python and LangGraph are simply the first.
 */

export interface LanggraphOptions {
  /** The Python executable. Defaults to $MALKOM_PYTHON, then "python3". */
  readonly python?: string;
  /** The directory holding the malkom_langgraph package. Defaults to the one shipped here. */
  readonly packageDir?: string;
  /**
   * A Python file whose `run(ctx)` is the agent — a studio draft. With none,
   * the engine's built-in manifest-driven graph runs. The file is loaded by
   * the Python side; nothing about the contract changes.
   */
  readonly agentFile?: string;
}

/** A message the Python agent sends up the bridge. */
type FromAgent =
  | { type: "call"; id: number; tool: string; args?: Record<string, unknown> }
  | { type: "report"; id: number; event: unknown }
  | { type: "end"; ending: unknown }
  | { type: "log"; message?: unknown };

const packageDirDefault = (): string => fileURLToPath(new URL("../python", import.meta.url));

const startMessage = (start: Start): string => {
  const { manifest } = start;
  return JSON.stringify({
    type: "start",
    provider: start.aiProvider.provider,
    shadow: start.shadow,
    manifest: {
      label: manifest.label,
      queue: manifest.queue,
      goal: manifest.goal,
      output: manifest.output.map((out) => ({ field: out.field, minConfidence: out.minConfidence })),
    },
    case: {
      taskId: start.caseRecord.taskId,
      queue: start.caseRecord.queue,
      ...(start.caseRecord.subQueue !== undefined ? { subQueue: start.caseRecord.subQueue } : {}),
      fields: start.caseRecord.fields,
      confidence: start.caseRecord.confidence,
      notes: start.caseRecord.notes,
    },
    tools: start.tools.map((tool) => ({
      name: tool.name,
      label: tool.label,
      describe: tool.describe,
      writes: tool.writes,
      args: tool.args,
    })),
  });
};

/**
 * Run a LangGraph agent for one case. Handed no options it runs the shipped
 * `malkom_langgraph` package with `python3`; a host can point it at its own
 * Python or its own package directory.
 */
export const langgraphAdapter = (options: LanggraphOptions = {}): Adapter => ({
  name: "langgraph",
  start: (start: Start): Promise<Ending> =>
    new Promise<Ending>((resolve, reject) => {
      const python = options.python ?? process.env["MALKOM_PYTHON"] ?? "python3";
      const packageDir = options.packageDir ?? packageDirDefault();

      const child = spawn(python, ["-m", "malkom_langgraph"], {
        cwd: packageDir,
        env: {
          ...process.env,
          PYTHONPATH: packageDir,
          PYTHONUNBUFFERED: "1",
          ...(options.agentFile !== undefined ? { MALKOM_LG_AGENT: options.agentFile } : {}),
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let settled = false;
      let stderr = "";
      const send = (message: unknown): void => {
        if (!child.stdin.destroyed) child.stdin.write(`${JSON.stringify(message)}\n`);
      };
      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        start.signal.removeEventListener("abort", onAbort);
        if (!child.killed) child.kill("SIGKILL");
        fn();
      };

      const onAbort = (): void => {
        // A limit was hit; the runner turns the abort into a normal ending
        // (the case goes to a person, work attached). Stop the child and let
        // the runner do that — same as the TypeScript adapter re-throwing.
        finish(() => reject(start.signal.reason ?? new Error("aborted")));
      };
      start.signal.addEventListener("abort", onAbort);

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const lines = createInterface({ input: child.stdout });
      lines.on("line", (line: string) => {
        const trimmed = line.trim();
        if (trimmed === "") return;
        let message: FromAgent;
        try {
          message = JSON.parse(trimmed) as FromAgent;
        } catch {
          return; // a stray print from the agent is not a protocol message
        }
        void handle(message);
      });

      const handle = async (message: FromAgent): Promise<void> => {
        switch (message.type) {
          case "call": {
            const reply = await start.call(message.tool, message.args ?? {});
            send({ type: "reply", id: message.id, ...reply });
            return;
          }
          case "report": {
            try {
              await start.report(message.event as Parameters<Start["report"]>[0]);
              send({ type: "reply", id: message.id, ok: true });
            } catch (error) {
              send({
                type: "reply",
                id: message.id,
                ok: false,
                refused: error instanceof Error ? error.message : String(error),
              });
            }
            return;
          }
          case "end": {
            const parsed = endArgsSchema.safeParse(message.ending);
            if (!parsed.success) {
              finish(() =>
                resolve({
                  ending: "handover",
                  whyStopped: "The agent ended with something that is not one of the four endings.",
                  work: { fields: {}, confidence: {}, tried: [], notes: [] },
                }),
              );
              return;
            }
            finish(() => resolve(toEnding(parsed.data)));
            return;
          }
          case "log":
            return;
        }
      };

      child.on("error", (error) => {
        finish(() => reject(new AgentFailure("provider-down", `could not start the LangGraph agent: ${error.message}`)));
      });

      child.on("close", (code) => {
        if (settled) return;
        // Exited without an ending. If it was aborted, onAbort already ran.
        settled = true;
        start.signal.removeEventListener("abort", onAbort);
        if (code === 0) {
          resolve({
            ending: "handover",
            whyStopped: "The LangGraph agent stopped without choosing an ending.",
            work: { fields: {}, confidence: {}, tried: [], notes: [] },
          });
        } else {
          reject(
            new AgentFailure(
              "provider-down",
              `the LangGraph agent exited with code ${code ?? "unknown"}${stderr !== "" ? `: ${stderr.trim().slice(-500)}` : ""}`,
            ),
          );
        }
      });

      send(JSON.parse(startMessage(start)) as unknown);
    }),
});
