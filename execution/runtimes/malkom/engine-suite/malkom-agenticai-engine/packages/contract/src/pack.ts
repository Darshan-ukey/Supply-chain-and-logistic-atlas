import { z } from "zod";
import { labelSchema, nameSchema, versionSchema } from "./ids.js";
import { limitsOverrideSchema, manifestSchema } from "./manifest.js";

/**
 * An agent pack — built per queue. A bookings pack works for an ocean liner
 * and a freight forwarder alike; you attach it to any org that runs that
 * process.
 *
 * The pack carries the queue's agents and the connections between them. The
 * pipeline only defines connections BETWEEN agents — who hands work to whom,
 * who may help whom. It never defines the steps INSIDE an agent.
 *
 * Versions never change after publishing. An upgrade is a new version. The
 * org's packs travel inside the config bundle, stamped with the config
 * generation, and are promoted from UAT to production unchanged.
 */

export const connectionKindSchema = z.enum([
  /** Who hands work to whom: the case moves from one agent to the next. */
  "hands-to",
  /**
   * Who may help whom: an agent can call another agent in its pack when it
   * decides it needs help. Whether and when to actually call is always the
   * agent's own decision.
   */
  "may-call",
]);
export type ConnectionKind = z.infer<typeof connectionKindSchema>;

export const packConnectionSchema = z.object({
  from: nameSchema,
  to: nameSchema,
  kind: connectionKindSchema,
});
export type PackConnection = z.infer<typeof packConnectionSchema>;

export const packSchema = z.object({
  kind: z.literal("malkom.agent-pack/1"),
  id: nameSchema,
  version: versionSchema,
  label: labelSchema,
  /** The queue this pack is built for. */
  queue: nameSchema,
  /**
   * Set when this pack overrides the queue's pipeline for one sub-queue —
   * the same override pattern Malkom already uses everywhere else. A pack
   * without it serves the whole queue.
   */
  subQueue: nameSchema.optional(),
  agents: z.array(manifestSchema).min(1),
  connections: z.array(packConnectionSchema).default([]),
  /** The config generation this pack travelled with, stamped at bundle time. */
  generation: z.number().int().min(0).optional(),
  /** This org's overrides: limits per agent, set when the pack was attached. */
  overrides: z.record(nameSchema, limitsOverrideSchema).default({}),
});
export type Pack = z.infer<typeof packSchema>;

/** Parse a pack, returning problems rather than throwing. */
export const parsePack = (
  input: unknown,
): { ok: true; pack: Pack } | { ok: false; problems: string[] } => {
  const parsed = packSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
      ),
    };
  }

  const pack = parsed.data;
  const problems: string[] = [];
  const agentIds = new Set(pack.agents.map((agent) => agent.id));

  if (agentIds.size !== pack.agents.length) problems.push("two agents in the pack share an id");
  for (const agent of pack.agents) {
    if (agent.queue !== pack.queue) {
      problems.push(`agent "${agent.id}" serves queue "${agent.queue}", but the pack is for "${pack.queue}"`);
    }
    if (
      pack.subQueue !== undefined &&
      agent.subQueues.length > 0 &&
      !agent.subQueues.includes(pack.subQueue)
    ) {
      problems.push(
        `agent "${agent.id}" does not serve sub-queue "${pack.subQueue}", which this pack overrides`,
      );
    }
  }
  for (const connection of pack.connections) {
    if (!agentIds.has(connection.from)) problems.push(`connection from "${connection.from}", which is not in the pack`);
    if (!agentIds.has(connection.to)) problems.push(`connection to "${connection.to}", which is not in the pack`);
    if (connection.from === connection.to) problems.push(`agent "${connection.from}" is connected to itself`);
  }
  for (const agentId of Object.keys(pack.overrides)) {
    if (!agentIds.has(agentId)) problems.push(`override for "${agentId}", which is not in the pack`);
  }

  // hands-to must form ONE line the case can actually travel: no agent hands
  // to two agents, no agent is handed work by two agents, no loop, and — the
  // one the obvious check misses — no second, disconnected chain that would
  // silently never receive work.
  const handsTo = pack.connections.filter((c) => c.kind === "hands-to");
  const froms = new Set<string>();
  const tos = new Set<string>();
  const next = new Map<string, string>();
  for (const c of handsTo) {
    if (froms.has(c.from)) problems.push(`agent "${c.from}" hands work to two agents`);
    if (tos.has(c.to)) problems.push(`agent "${c.to}" is handed work by two agents`);
    froms.add(c.from);
    tos.add(c.to);
    next.set(c.from, c.to);
  }
  if (problems.length === 0 && handsTo.length > 0) {
    const starts = [...froms].filter((id) => !tos.has(id));
    if (starts.length === 0) {
      problems.push("the hands-to connections form a loop");
    } else if (starts.length > 1) {
      problems.push("the hands-to connections form more than one line — a case can only travel one");
    } else {
      // Walk the single line and confirm it covers every agent that takes
      // part in a hands-to connection. Anything left over is a second chain.
      const online = new Set<string>();
      let current: string | undefined = starts[0];
      while (current !== undefined && !online.has(current)) {
        online.add(current);
        current = next.get(current);
      }
      const stranded = [...froms, ...tos].filter((id) => !online.has(id));
      if (stranded.length > 0) {
        problems.push(
          `the hands-to connections form more than one line — "${stranded[0]}" is on a line of its own`,
        );
      }
    }
  }

  // In a pack of several agents, every agent must be connected — on the
  // hands-to line or reachable as help. A drawn canvas has no floating boxes.
  if (pack.agents.length > 1) {
    const connected = new Set<string>();
    for (const c of pack.connections) {
      connected.add(c.from);
      connected.add(c.to);
    }
    for (const agent of pack.agents) {
      if (!connected.has(agent.id)) {
        problems.push(`agent "${agent.id}" is not connected to anything in the pack`);
      }
    }
  }

  return problems.length === 0 ? { ok: true, pack } : { ok: false, problems };
};

/**
 * The order the case travels through the pack: the hands-to line, starting
 * with the agent nobody hands work to. Agents outside the line (helpers that
 * are only may-called) are not part of the order.
 */
export const packOrder = (pack: Pack): string[] => {
  const handsTo = new Map(
    pack.connections.filter((c) => c.kind === "hands-to").map((c) => [c.from, c.to]),
  );
  const handedTo = new Set(handsTo.values());
  const start = pack.agents.find(
    (agent) => !handedTo.has(agent.id) && (handsTo.has(agent.id) || handsTo.size === 0),
  );
  if (start === undefined) return pack.agents.length === 1 && pack.agents[0] !== undefined ? [pack.agents[0].id] : [];

  const order: string[] = [];
  let current: string | undefined = start.id;
  const seen = new Set<string>();
  while (current !== undefined && !seen.has(current)) {
    order.push(current);
    seen.add(current);
    current = handsTo.get(current);
  }
  return order;
};

/** The agents this agent may call for help, per the pack's declared connections. */
export const mayCall = (pack: Pack, agentId: string): string[] =>
  pack.connections.filter((c) => c.kind === "may-call" && c.from === agentId).map((c) => c.to);

/**
 * The pack that takes a case: a sub-queue's own pack overrides the queue's —
 * the same override pattern Malkom already uses everywhere else.
 */
export const packFor = (
  packs: readonly Pack[],
  queue: string,
  subQueue?: string,
): Pack | null =>
  (subQueue !== undefined
    ? packs.find((pack) => pack.queue === queue && pack.subQueue === subQueue)
    : undefined) ??
  packs.find((pack) => pack.queue === queue && pack.subQueue === undefined) ??
  null;
