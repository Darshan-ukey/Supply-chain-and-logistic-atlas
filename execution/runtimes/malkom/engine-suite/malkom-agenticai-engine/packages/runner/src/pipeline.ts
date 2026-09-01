import {
  mayCall,
  packOrder,
  writeWork,
  type CaseRecord,
  type Ending,
  type EngineConfig,
  type Manifest,
  type Pack,
  type RunEvent,
} from "@malkom/agenticai-contract";
import type { GatewayTool } from "@malkom/agenticai-gateway";
import { runAgentWith, type HostIntegration, type RunReport } from "./runner.js";

/**
 * The queue's agent pipeline.
 *
 * The pipeline only defines connections BETWEEN agents — who hands work to
 * whom, who may help whom. It never defines the steps inside an agent.
 *
 * The case travels the hands-to line. Every agent writes its results onto the
 * shared case record — fields, confidence numbers, notes — and the next agent
 * sees all of it. Nothing is worked out twice. The first agent that does not
 * end done decides the case's ending: a question, a handover or a park stops
 * the line, and the case goes where that ending sends it.
 *
 * Direct calls: an agent may call another agent in its pack when it decides
 * it needs help — but only along a declared may-call connection. Whether and
 * when to actually call is always the agent's own decision.
 */

/** What a host asks the engine to run: a whole pack on one case. */
export interface PipelineRequest {
  readonly pack: Pack;
  readonly caseRecord: CaseRecord;
  readonly engineConfig?: EngineConfig;
  readonly shadow?: boolean;
  /** Continue an earlier run of one agent from its last written step. */
  readonly resume?: {
    readonly agentId: string;
    readonly runId: string;
    readonly events: readonly RunEvent[];
  };
}

export interface PipelineReport {
  /** The case's ending: the first agent that did not end done, or the last done. */
  readonly ending: Ending;
  /** Which agent produced that ending. */
  readonly endedBy: string;
  /** The case record with every agent's work written onto it. */
  readonly caseRecord: CaseRecord;
  readonly runs: readonly RunReport[];
}

/** The pipeline could not run at all — a missing adapter, a malformed pack. */
export class PipelineRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineRefused";
  }
}

export const runPipeline = async (
  request: PipelineRequest,
  host: HostIntegration,
): Promise<PipelineReport> => {
  const order = packOrder(request.pack);
  if (order.length === 0) throw new PipelineRefused(`pack "${request.pack.id}" has no hands-to line to run`);

  const byId = new Map(request.pack.agents.map((agent) => [agent.id, agent]));
  for (const agentId of order) {
    const manifest = byId.get(agentId);
    if (manifest === undefined) throw new PipelineRefused(`the pack's line names "${agentId}", which is not in the pack`);
    if (host.adapters.get(manifest.container.adapter) === undefined) {
      throw new PipelineRefused(
        `agent "${agentId}" wants the "${manifest.container.adapter}" adapter, and this runtime has none ` +
          `(it has: ${host.adapters.names().join(", ") || "nothing"})`,
      );
    }
  }

  const now = host.now ?? Date.now;
  const runs: RunReport[] = [];
  let caseRecord = request.caseRecord;

  /** Agents currently running, so help cannot loop back into its asker. */
  const running = new Set<string>();

  const runOne = async (
    manifest: Manifest,
    resume?: { runId: string; events: readonly RunEvent[] },
  ): Promise<RunReport> => {
    const adapter = host.adapters.get(manifest.container.adapter);
    if (adapter === undefined) {
      throw new PipelineRefused(`agent "${manifest.id}" wants the "${manifest.container.adapter}" adapter`);
    }

    running.add(manifest.id);
    try {
      /**
       * The declared help: one extra door per may-call connection. Calling it
       * runs the helper agent on the same shared case record, and its work
       * comes back as the reply — and lands on the case like any other work.
       */
      const helpers: GatewayTool[] = [];
      for (const helperId of mayCall(request.pack, manifest.id)) {
        const helper = byId.get(helperId);
        if (helper === undefined || running.has(helperId)) continue;
        helpers.push({
          name: helper.id,
          label: helper.label,
          describe: `Ask "${helper.label}" for help with this case. Its goal: ${helper.goal.slice(0, 200)}`,
          writes: false,
          args: {
            type: "object",
            properties: {
              because: { type: "string", description: "Why you are asking for help." },
            },
          },
          run: async () => {
            const helped = await runOne(helper);
            runs.push(helped);
            caseRecord = writeWork(caseRecord, helper.id, helped.ending.work, new Date(now()).toISOString());
            return { ending: helped.ending.ending, work: helped.ending.work };
          },
        });
      }

      const manifestWithHelp: Manifest = {
        ...manifest,
        tools: [
          ...manifest.tools,
          ...helpers.map((helper) => ({ name: helper.name, label: helper.label })),
        ],
      };

      // Per agent, the host resolves its provider and its base tools; the
      // helper doors are added on top. runAgentWith is the engine-internal
      // entry so the pipeline can inject those helpers.
      const [aiProvider, baseTools] = await Promise.all([
        Promise.resolve(host.provider({ id: manifest.id, version: manifest.version })),
        Promise.resolve(host.tools(manifest)),
      ]);

      return await runAgentWith({
        manifest: manifestWithHelp,
        caseRecord,
        adapter,
        tools: [...baseTools, ...helpers],
        aiProvider,
        ...(request.engineConfig !== undefined ? { engineConfig: request.engineConfig } : {}),
        ...(request.pack.overrides[manifest.id] !== undefined
          ? { overrides: request.pack.overrides[manifest.id] }
          : {}),
        ...(request.shadow !== undefined ? { shadow: request.shadow } : {}),
        ...(resume !== undefined ? { resume } : {}),
        keep: async (event) => {
          await host.keep(event);
        },
        now,
      });
    } finally {
      running.delete(manifest.id);
    }
  };

  /** On resume, the line starts again at the agent that parked or crashed. */
  const startIndex =
    request.resume !== undefined ? Math.max(0, order.indexOf(request.resume.agentId)) : 0;

  let ending: Ending | null = null;
  let endedBy = order[startIndex] ?? "";

  for (let index = startIndex; index < order.length; index += 1) {
    const agentId = order[index];
    if (agentId === undefined) continue;
    const manifest = byId.get(agentId);
    if (manifest === undefined) continue;

    const resume =
      request.resume !== undefined && index === startIndex && request.resume.agentId === agentId
        ? { runId: request.resume.runId, events: request.resume.events }
        : undefined;

    const report = await runOne(manifest, resume);
    runs.push(report);
    caseRecord = writeWork(caseRecord, agentId, report.ending.work, new Date(now()).toISOString());
    ending = report.ending;
    endedBy = agentId;

    // done hands the case along the line. Anything else stops it: the case
    // goes where the ending sends it — a person, a query, or the car park.
    if (report.ending.ending !== "done") break;
  }

  if (ending === null) throw new PipelineRefused(`pack "${request.pack.id}" ran no agents`);
  return { ending, endedBy, caseRecord, runs };
};
