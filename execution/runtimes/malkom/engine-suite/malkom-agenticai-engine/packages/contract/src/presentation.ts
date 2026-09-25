import type { ConnectionKind, Pack, PackConnection } from "./pack.js";
import type { EndingName } from "./endings.js";
import type { RunEvent } from "./events.js";

/**
 * Presentation — how a run and a pipeline read, in plain language, with no
 * rendering framework anywhere in sight.
 *
 * The engine is the definition centre for how things are shown, not just for
 * how they run. A front end — Malkom's or anyone else's, in React, Vue, a
 * terminal, a PDF — renders from these. The UI complies to the engine; the
 * engine never depends on a UI.
 *
 * The one rule these encode: the surface never shows framework terms. Every
 * line is a plain sentence; the technical detail is the caller's to reveal one
 * layer deeper.
 */

/* ------------------------------ the run timeline ------------------------------ */

/** What each ending means, in one plain phrase. */
export const ENDING_SENTENCE: Record<EndingName, string> = {
  done: "done — the work is finished",
  question: "question — it needs one answer",
  handover: "handover — it gives up, work attached",
  parked: "parked — waiting for something",
};

/** One line of a run's timeline: a plain sentence, and the event behind it. */
export interface TimelineLine {
  /** Stable key for a list: `${runId}:${seq}`. */
  readonly key: string;
  readonly at: string;
  /** The plain-language sentence a person reads. */
  readonly sentence: string;
  /** True for the lines worth emphasising: start, end, retry, a refusal. */
  readonly accent: boolean;
  readonly event: RunEvent;
}

export interface TimelineOptions {
  /** Plain-language labels per tool name, from the manifest. */
  readonly toolLabels?: Readonly<Record<string, string>>;
  /** How to phrase money. Minor units in, a sentence fragment out. */
  readonly formatMoney?: (minorUnits: number) => string;
}

/**
 * Turn a run's event log into plain-language timeline lines. The whole
 * "how a run reads" logic lives here, framework-free, so every timeline —
 * in the studio, in monitoring, in an exported report — reads the same.
 */
export const timelineLines = (
  events: readonly RunEvent[],
  options: TimelineOptions = {},
): TimelineLine[] => {
  const formatMoney = options.formatMoney ?? ((minor: number) => `${minor.toFixed(2)} minor units`);
  const labelOf = (tool: string): string => options.toolLabels?.[tool] ?? tool;

  return events.map((event): TimelineLine => {
    const key = `${event.runId}:${event.seq}`;
    switch (event.type) {
      case "run.started":
        return {
          key,
          at: event.at,
          sentence: `Started — "${event.agent.label}" took the case${
            event.shadow ? " (shadow: it can change nothing)" : ""
          }`,
          accent: true,
          event,
        };
      case "noted":
        return { key, at: event.at, sentence: event.note, accent: false, event };
      case "tool.called":
        return { key, at: event.at, sentence: `Reached for "${labelOf(event.tool)}"`, accent: false, event };
      case "tool.replied":
        return {
          key,
          at: event.at,
          sentence: event.ok
            ? `"${labelOf(event.tool)}" answered (${event.elapsedMs}ms)`
            : `"${labelOf(event.tool)}" was refused — ${event.refused ?? "no reason recorded"}`,
          accent: !event.ok,
          event,
        };
      case "model.replied":
        return {
          key,
          at: event.at,
          sentence: `Decided its next move (${event.tokensIn + event.tokensOut} tokens, ${formatMoney(event.money)})`,
          accent: false,
          event,
        };
      case "run.retried":
        return {
          key,
          at: event.at,
          sentence: `Tried again — ${event.failure} (attempt ${event.attempt}): ${event.because}`,
          accent: true,
          event,
        };
      case "run.ended":
        return {
          key,
          at: event.at,
          sentence: `Ended: ${ENDING_SENTENCE[event.outcome.ending]} · ${event.spend.toolCalls} tool calls · ${formatMoney(
            event.spend.money,
          )} · ${(event.spend.elapsedMs / 1000).toFixed(1)}s`,
          accent: true,
          event,
        };
    }
  });
};

/* ------------------------------ the pipeline graph ------------------------------ */

/** Plain words for each kind of connection; the technical name stays underneath. */
export const CONNECTION_WORDS: Record<ConnectionKind, string> = {
  "hands-to": "hands the case to",
  "may-call": "may ask for help",
};

/** A node the UI places: one agent on the queue. */
export interface GraphNode {
  readonly id: string;
  readonly label: string;
  /** One line under the label — the goal's first words. */
  readonly summary: string;
}

/** An edge the UI draws: one connection, in plain words. */
export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: ConnectionKind;
  readonly words: string;
}

export interface PipelineGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/**
 * The pipeline as a graph the UI renders — nodes and edges with plain-language
 * labels. The same picture in design, test and monitoring reads from this, so
 * the three can differ in their affordances but never in their meaning.
 */
export const pipelineGraph = (
  agents: readonly { id: string; label: string; goal?: string }[],
  connections: readonly PackConnection[],
): PipelineGraph => ({
  nodes: agents.map((agent) => ({
    id: agent.id,
    label: agent.label,
    summary: (agent.goal ?? "").slice(0, 80),
  })),
  edges: connections.map((connection) => ({
    from: connection.from,
    to: connection.to,
    kind: connection.kind,
    words: CONNECTION_WORDS[connection.kind],
  })),
});

/** The pipeline graph for a whole pack, straight from its agents and wires. */
export const packGraph = (pack: Pack): PipelineGraph =>
  pipelineGraph(
    pack.agents.map((agent) => ({ id: agent.id, label: agent.label, goal: agent.goal })),
    pack.connections,
  );
