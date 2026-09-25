import {
  packSchema,
  parsePack,
  type ConnectionKind,
  type Manifest,
  type Pack,
  type PackConnection,
} from "@malkom/agenticai-contract";
import type { TemplateField } from "./template.js";

/**
 * The canvas checks.
 *
 * On the canvas in the Command: pick a queue, place agents on it, draw the
 * connections. A connection that does not fit — wrong field types — is
 * refused immediately, at design time instead of at 2am. A sub-queue can
 * override the queue's pipeline.
 *
 * The pipeline only defines connections BETWEEN agents — who hands work to
 * whom, who may help whom. It never defines the steps inside an agent.
 */

/** The fields a queue (or one of its sub-queues) carries, with their types. */
export interface QueueFieldSchema {
  readonly queue: string;
  readonly subQueue?: string;
  readonly fields: readonly TemplateField[];
}

const fieldTypesOf = (schema: QueueFieldSchema): Map<string, string> =>
  new Map(schema.fields.map((field) => [field.key, field.type]));

/**
 * Does this agent fit this queue at all? Its input and output fields must
 * point at the org's existing field schemas — nothing new is invented.
 */
export const checkAgentFit = (
  manifest: Manifest,
  schema: QueueFieldSchema,
): { ok: true } | { ok: false; problems: string[] } => {
  const problems: string[] = [];
  if (manifest.queue !== schema.queue) {
    problems.push(`"${manifest.label}" serves queue "${manifest.queue}", not "${schema.queue}"`);
  }
  const types = fieldTypesOf(schema);
  for (const key of manifest.input) {
    if (!types.has(key)) {
      problems.push(`"${manifest.label}" reads "${key}", which is not a field of "${schema.queue}"`);
    }
  }
  for (const out of manifest.output) {
    if (!types.has(out.field)) {
      problems.push(`"${manifest.label}" fills "${out.field}", which is not a field of "${schema.queue}"`);
    }
  }
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
};

/**
 * Does this connection fit? Drawn on the canvas, checked immediately:
 *
 *   hands-to — the downstream agent must be able to read what arrives. Every
 *   field it reads must be a field of the queue or a field the upstream
 *   agent fills, and when the two agents work against different sub-queue
 *   schemas the field's type must be the same in both. A field that arrives
 *   as one type and is needed as another is refused with a plain sentence.
 *
 *   may-call — the helper's answers land on the shared case record, so every
 *   field the helper fills must exist, with the same type, where the asking
 *   agent works.
 */
export const checkConnection = (options: {
  readonly upstream: Manifest;
  readonly downstream: Manifest;
  readonly kind: ConnectionKind;
  readonly upstreamSchema: QueueFieldSchema;
  readonly downstreamSchema: QueueFieldSchema;
}): { ok: true } | { ok: false; problems: string[] } => {
  const { upstream, downstream, kind } = options;
  const problems: string[] = [];

  if (upstream.id === downstream.id) {
    problems.push(`"${upstream.label}" cannot be connected to itself`);
    return { ok: false, problems };
  }

  const upstreamTypes = fieldTypesOf(options.upstreamSchema);
  const downstreamTypes = fieldTypesOf(options.downstreamSchema);

  if (kind === "hands-to") {
    const arrives = new Set([...upstreamTypes.keys(), ...upstream.output.map((out) => out.field)]);
    for (const key of downstream.input) {
      if (!arrives.has(key)) {
        problems.push(
          `"${downstream.label}" reads "${key}", and neither the queue nor "${upstream.label}" provides it`,
        );
        continue;
      }
      const arrivesAs = upstreamTypes.get(key);
      const neededAs = downstreamTypes.get(key);
      if (arrivesAs !== undefined && neededAs !== undefined && arrivesAs !== neededAs) {
        problems.push(`"${key}" arrives as ${arrivesAs} but is needed as ${neededAs}`);
      }
    }
  }

  if (kind === "may-call") {
    for (const out of downstream.output) {
      const helperFills = downstreamTypes.get(out.field) ?? "text";
      const landsOn = upstreamTypes.get(out.field);
      if (landsOn === undefined) {
        problems.push(
          `"${downstream.label}" fills "${out.field}", which is not a field where "${upstream.label}" works`,
        );
      } else if (landsOn !== helperFills) {
        problems.push(`"${out.field}" arrives as ${helperFills} but is needed as ${landsOn}`);
      }
    }
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
};

/** What the canvas holds while a pipeline is being drawn. */
export interface CanvasState {
  readonly queue: string;
  /** Set when this pipeline overrides the queue's for one sub-queue. */
  readonly subQueue?: string;
  readonly agents: readonly Manifest[];
  readonly connections: readonly PackConnection[];
}

/**
 * Assemble the drawn pipeline into a pack — the same pack the runtime runs
 * and the config bundle carries. Everything the contract refuses, the canvas
 * refuses too; nothing invalid can leave the drawing board.
 */
export const assemblePack = (
  canvas: CanvasState,
  pack: { id: string; version: string; label: string; generation?: number },
): { ok: true; pack: Pack } | { ok: false; problems: string[] } => {
  const candidate = packSchema.safeParse({
    kind: "malkom.agent-pack/1",
    id: pack.id,
    version: pack.version,
    label: pack.label,
    queue: canvas.queue,
    ...(canvas.subQueue !== undefined ? { subQueue: canvas.subQueue } : {}),
    agents: canvas.agents,
    connections: canvas.connections,
    ...(pack.generation !== undefined ? { generation: pack.generation } : {}),
    overrides: {},
  });
  if (!candidate.success) {
    return {
      ok: false,
      problems: candidate.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
      ),
    };
  }
  const parsed = parsePack(candidate.data);
  if (!parsed.ok) return { ok: false, problems: parsed.problems };
  return { ok: true, pack: parsed.pack };
};
