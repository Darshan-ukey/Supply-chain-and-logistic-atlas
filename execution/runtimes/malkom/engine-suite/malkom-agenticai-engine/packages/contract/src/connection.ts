import type { CaseRecord } from "./record.js";
import type { DraftRunEvent } from "./events.js";
import type { AccessPass } from "./pass.js";
import type { Limits, Manifest } from "./manifest.js";

/**
 * The connection — one standard way to start the agent, one way for it to
 * report what it is doing, and the four endings.
 *
 * Every framework connects to the engine through this, via an adapter. The
 * adapter passes the goal in and the endings out. It never controls the
 * agent's steps.
 */

/** A tool reply as the agent sees it: the result, or the reason it was refused. */
export type ToolReply =
  | { ok: true; reply: unknown }
  | { ok: false; refused: string };

/** A tool as it is offered to the agent: plain-language label, name, whether it writes. */
export interface OfferedTool {
  readonly name: string;
  readonly label: string;
  readonly describe: string;
  readonly writes: boolean;
  /** JSON Schema for the tool's arguments, generated from org config. */
  readonly args: Record<string, unknown>;
}

/**
 * This org's AI provider — an Integration, set per org. A pack never names a
 * provider; it uses whatever the org configured. The `model` value is opaque
 * to the contract: the adapter that starts the agent knows what to do with it.
 */
export interface OrgAiProvider {
  readonly provider: string;
  /** The model handle, resolved by the host from the org's Integration. */
  readonly model: unknown;
  readonly currency: string;
  /** Price of a million input tokens, in minor units of the currency. */
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

/** The one standard way to start the agent. */
export interface Start {
  readonly manifest: Manifest;
  /** The goal goes in, plus the case. */
  readonly goal: string;
  /** The case, narrowed to exactly the fields the manifest may read. */
  readonly caseRecord: CaseRecord;
  /** The run's short-lived access pass. */
  readonly pass: AccessPass;
  /** The tools this run is offered — the manifest's list, none other. */
  readonly tools: readonly OfferedTool[];
  /** The limits this run is under, org overrides already applied. */
  readonly limits: Limits;
  /** True when this run must change nothing. */
  readonly shadow: boolean;
  /** This org's AI provider. */
  readonly aiProvider: OrgAiProvider;
  /** Trips when a limit is hit. The agent must stop; the runner ends the run. */
  readonly signal: AbortSignal;

  /** One way for it to report what it is doing. Every report is a run event,
   *  written to the event log before the next step starts. */
  report(event: DraftRunEvent): Promise<void>;

  /** The only door to data: call a tool through the MCP gateway. */
  call(tool: string, args: Record<string, unknown>): Promise<ToolReply>;
}
