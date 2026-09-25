import { manifestSchema, type Manifest } from "@malkom/agenticai-contract";

/**
 * Start from a template.
 *
 * Pick a framework and a queue type. The studio creates a working autonomous
 * agent you can then change — goal written, connection wired, telemetry
 * already on. The template never writes steps: the goal, the fields and the
 * limits are the whole configuration, and the agent decides the rest per
 * case.
 */

/** One field of the queue type's field schema, as the template needs it. */
export interface TemplateField {
  readonly key: string;
  readonly label: string;
  readonly type: "text" | "number" | "select" | "date";
}

/** The queue type the agent is being built for. */
export interface QueueType {
  readonly queue: string;
  readonly label: string;
  readonly subQueues: readonly string[];
  readonly fields: readonly TemplateField[];
  /** The fields a finished case must carry, from the org's own schemas. */
  readonly requiredFields: readonly string[];
}

export interface TemplateRequest {
  /** The framework the agent is written in. Both ship on day one. */
  readonly framework: Framework;
  readonly queueType: QueueType;
  readonly agentId: string;
  readonly agentLabel: string;
}

export const FRAMEWORKS = ["typescript", "langgraph"] as const;
export type Framework = (typeof FRAMEWORKS)[number];

/** How each framework is presented and stored — its plain label and code file. */
export const FRAMEWORK_INFO: Record<Framework, { label: string; language: "typescript" | "python"; codeFile: string }> = {
  typescript: { label: "TypeScript", language: "typescript", codeFile: "agent.ts" },
  langgraph: { label: "LangGraph (Python)", language: "python", codeFile: "agent.py" },
};

/** The manifest the template starts from — complete, valid, changeable. */
export const templateManifest = (request: TemplateRequest): Manifest => {
  const { queueType } = request;
  const output =
    queueType.requiredFields.length > 0
      ? queueType.requiredFields
      : queueType.fields.slice(0, 3).map((field) => field.key);

  return manifestSchema.parse({
    kind: "malkom.agent-manifest/1",
    id: request.agentId,
    version: "0.1.0",
    label: request.agentLabel,
    goal: [
      `Complete each case on the "${queueType.label}" queue the way an experienced`,
      `person would: work out ${output.join(", ")} from the message and the case,`,
      "check them, and finish the case. If exactly one thing blocks you and a",
      "person could settle it in seconds, ask that one question. If you cannot do",
      "the work, hand the case over with everything you found. If the case is",
      "waiting on something that will arrive, park it and say what wakes it.",
    ].join(" "),
    queue: queueType.queue,
    subQueues: [],
    input: queueType.fields.map((field) => field.key),
    output: output.map((field) => ({ field, minConfidence: 0.8 })),
    rules: { ruleSets: [], validationSets: [] },
    tools: [
      { name: "read-case", label: "Read the case" },
      { name: "write-fields", label: "Write fields onto the case" },
      { name: "check-validation", label: "Check the fields are valid" },
    ],
    // Telemetry already on: the engine produces it; these are the manifest's
    // additions on top, and the developer cannot turn the telemetry off.
    telemetry: { extraFields: [], tracePercent: 100, redact: [] },
    limits: {},
    container: {
      image: `malkom/${request.agentId}:0.1.0`,
      adapter: request.framework,
    },
  });
};

/**
 * The agent's starter code — connection already wired. It is a complete,
 * working autonomous agent on day one; the developer changes it from there.
 */
export const templateCode = (request: TemplateRequest): string =>
  request.framework === "langgraph" ? langgraphTemplate(request) : typescriptTemplate(request);

/** The LangGraph (Python) starter — the engine's autonomous graph, editable. */
const langgraphTemplate = (request: TemplateRequest): string =>
  `"""${request.agentLabel} — an autonomous agent on the "${request.queueType.queue}" queue.

The agent gets a goal, not a list of steps. The goal, the fields it reads and
writes, its tools and its limits all come from the manifest beside this file.
Inside those limits it decides its own steps, case by case, and ends one of
exactly four ways: done, question, handover, parked.

\`ctx\` is the connection: \`ctx.case\` and \`ctx.manifest\` carry the case and
the goal, \`ctx.tools\` the tools offered, \`ctx.call(tool, args)\` is the only
door to data (every call goes through the gateway, checked against the pass and
recorded), \`ctx.report(event)\` writes to the run's event log, and
\`ctx.end(...)\` ends the run.
"""

from malkom_langgraph import run_manifest_agent


def run(ctx):
    # The engine's autonomous LangGraph loop: it reads the goal and the case,
    # decides its own route through the offered tools, and chooses its ending.
    # Replace this with your own graph when the loop should behave differently —
    # the contract around it (the gateway, the pass, the event log, the four
    # endings) does not change. For example:
    #
    #     case = ctx.call("read-case", {})
    #     ctx.call("write-fields", {"fields": {...}, "confidence": {...}})
    #     ctx.end(ending="done", fields={...}, confidence={...})
    run_manifest_agent(ctx)
`;

/** The TypeScript starter — the engine's autonomous loop, editable. */
const typescriptTemplate = (request: TemplateRequest): string =>
  `import type { Ending, Start } from "@malkom/agenticai-contract";
import { manifestAgent } from "@malkom/agenticai-adapters";

/**
 * ${request.agentLabel} — an autonomous agent on the "${request.queueType.queue}" queue.
 *
 * The agent gets a goal, not a list of steps. The goal, the fields it reads
 * and writes, its tools and its limits all come from the manifest beside this
 * file. Inside those limits it decides its own steps, case by case — which
 * tools to use, in which order, and how many times — and it ends one of
 * exactly four ways: done, question, handover, parked.
 *
 * The connection is already wired: \`start\` carries the goal, the case, the
 * access pass, the offered tools and this org's AI provider. \`start.call\`
 * is the only door to data — every call goes through the gateway, checked
 * against the pass and recorded. \`start.report\` writes to the run's event
 * log, live.
 */
const agent = async (start: Start): Promise<Ending> => {
  // The engine's autonomous loop: the model reads the goal and the case,
  // decides its own route through the offered tools, and chooses its ending.
  // Replace this with your own code when the loop should behave differently —
  // the contract around it (the gateway, the pass, the event log, the four
  // endings) does not change.
  return manifestAgent(start);
};

export default agent;
`;
