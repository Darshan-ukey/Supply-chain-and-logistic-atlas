import {
  APICallError,
  generateText,
  hasToolCall,
  jsonSchema,
  stepCountIs,
  tool,
  type LanguageModel,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { AgentFailure, type Ending, type Start, workSchema } from "@malkom/agenticai-contract";
import type { Adapter } from "./adapter.js";
import { endArgsSchema, toEnding, type EndArgs } from "./ending.js";

/**
 * The TypeScript adapter — one of the two adapters we ship on day one.
 *
 * The loop itself rides on the Vercel AI SDK: tool calling, step control and
 * provider abstraction are solved problems, and hand-rolling them would be a
 * year of maintenance for no advantage. What is Malkom's is everything the
 * SDK has no opinion about: the goal goes in, the agent decides its own steps
 * inside its limits, every tool call goes through the gateway, and the run
 * ends one of exactly four ways.
 *
 * Nothing in here scripts the agent. The goal, the fields, the tools and the
 * limits all come from the manifest; which tools to call, in which order, how
 * many times, and which ending to take are the agent's own decisions, per
 * case. Two identical cases can be handled two different ways. That is normal
 * and correct.
 */

/** A TypeScript agent: any in-process code that takes the connection and ends. */
export type TypescriptAgent = (start: Start) => Promise<Ending>;

/** The goal goes in: the brief, assembled from the manifest and nothing else. */
export const goalIn = (start: Start): string => {
  const { manifest } = start;
  const lines = [
    `You are "${manifest.label}", an autonomous agent working one case on the "${manifest.queue}" queue.`,
    "",
    "Your goal — what a finished case looks like:",
    manifest.goal,
    "",
    "The work counts as done only when each of these fields is filled at or above its confidence floor:",
    ...manifest.output.map((out) => `- ${out.field} (confidence ${out.minConfidence} or better)`),
    "",
    "Decide your own steps for this case. Use the tools offered to you in any",
    "order, as many times as you judge useful. If more information would help,",
    "go and get it. If your first approach fails, try a different one. Check",
    "your own work before you finish.",
    "",
    'End by calling "end", exactly once. Choose the ending carefully:',
    "- done: the goal is met and every required field is filled confidently.",
    "  Put the fields and your confidence numbers in the call.",
    "- question: you are stuck on ONE thing a person could settle in seconds.",
    "  Give one sentence, two to five choices, and the field the answer fills.",
    "  Never an open question.",
    "- handover: you cannot finish this. Say why you stopped, in one plain",
    "  sentence. Everything you did work out goes with the case.",
    "- parked: the case is waiting for something. Say what wakes it: a reply,",
    "  a document, or a date.",
    "",
    "Never state a value you are not confident about. A question costs a",
    "person seconds; a wrong value costs them an hour and costs the business",
    "its trust in you. Whatever ending you choose, attach the fields you did",
    "work out, what you tried, and any notes the next person should read.",
  ];
  if (start.shadow) {
    lines.push(
      "",
      "This is a shadow run: you do the full work but deliver nothing, and",
      "every write is blocked at the gateway.",
    );
  }
  return lines.join("\n");
};

/** Sort out which failures are worth another attempt, by type. */
const classify = (error: unknown): AgentFailure | null => {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 0;
    if (status === 429 || status >= 500 || error.isRetryable) {
      return new AgentFailure("provider-down", `the AI endpoint failed (${status || "no status"})`);
    }
    return null;
  }
  if (error instanceof TypeError && /fetch|network|socket|ECONN|ETIMEDOUT/i.test(error.message)) {
    return new AgentFailure("network", `a network error on the way to the model: ${error.message}`);
  }
  return null;
};

/**
 * The agent the studio's TypeScript template starts from: the manifest is the
 * whole configuration, the model decides the steps. Used directly, it is a
 * complete autonomous agent; a developer can also hand `typescriptAdapter`
 * their own TypescriptAgent instead.
 */
export const manifestAgent: TypescriptAgent = async (start) => {
  const model = start.aiProvider.model;
  if (model === undefined || model === null) {
    throw new AgentFailure("provider-down", "this org has no AI provider configured");
  }

  let step = 0;
  let concluded: EndArgs | null = null;
  const tools: ToolSet = {};

  for (const offered of start.tools) {
    tools[offered.name.replace(/-/g, "_")] = tool({
      description: offered.describe === "" ? offered.label : `${offered.label} — ${offered.describe}`,
      inputSchema: jsonSchema<Record<string, unknown>>(
        offered.args as never,
      ),
      execute: async (args: Record<string, unknown>) => {
        const reply = await start.call(offered.name, args ?? {});
        return reply.ok ? (reply.reply ?? { ok: true }) : { refused: reply.refused };
      },
    });
  }

  tools["note"] = tool({
    description: "Say what you are doing and why, in one plain sentence. Recorded on the run's timeline.",
    inputSchema: z.object({ note: z.string().min(1).max(500) }),
    execute: async ({ note }: { note: string }) => {
      await start.report({ type: "noted", at: new Date().toISOString(), step, note });
      return { noted: true };
    },
  });

  tools["end"] = tool({
    description: "End the run, one of the four ways. Call this exactly once, at the end.",
    inputSchema: endArgsSchema,
    execute: async (args: EndArgs) => {
      concluded = args;
      return { accepted: true };
    },
  });

  try {
    await generateText({
      model: model as LanguageModel,
      system: goalIn(start),
      prompt: JSON.stringify(
        {
          case: {
            taskId: start.caseRecord.taskId,
            queue: start.caseRecord.queue,
            ...(start.caseRecord.subQueue !== undefined ? { subQueue: start.caseRecord.subQueue } : {}),
            fields: start.caseRecord.fields,
            confidence: start.caseRecord.confidence,
            notes: start.caseRecord.notes,
          },
        },
        null,
        2,
      ),
      tools,
      abortSignal: start.signal,
      // Retries live in the runner, split by type of failure per the
      // manifest. The SDK's own hidden retry would sit outside those limits.
      maxRetries: 0,
      // The ceilings that end the loop are the runner's limits; this step cap
      // is only the SDK's own backstop, far above anything the runner allows.
      stopWhen: [hasToolCall("end"), stepCountIs(1_000)],
      onStepFinish: async (finished) => {
        const tokensIn = finished.usage.inputTokens ?? 0;
        const tokensOut = finished.usage.outputTokens ?? 0;
        const money =
          (tokensIn / 1_000_000) * start.aiProvider.inputPerMillion +
          (tokensOut / 1_000_000) * start.aiProvider.outputPerMillion;
        await start.report({
          type: "model.replied",
          at: new Date().toISOString(),
          step,
          reply: finished.text,
          tokensIn,
          tokensOut,
          money,
          elapsedMs: 0,
        });
        step += 1;
      },
    });
  } catch (error) {
    if (start.signal.aborted) {
      // A limit was hit. The runner turns this into a normal ending — the
      // case goes to a person, with the work so far attached.
      throw error;
    }
    const failure = classify(error);
    if (failure !== null) throw failure;
    throw error;
  }

  if (concluded === null) {
    return {
      ending: "handover",
      whyStopped: "It stopped without choosing an ending.",
      work: workSchema.parse({}),
    };
  }
  return toEnding(concluded);
};

/**
 * The TypeScript adapter. With no argument it runs `manifestAgent` — the
 * template agent whose entire behaviour comes from the manifest. Handed a
 * TypescriptAgent, it runs that code instead; the contract around it — the
 * gateway, the pass, the event log, the four endings — does not change.
 */
export const typescriptAdapter = (agent: TypescriptAgent = manifestAgent): Adapter => ({
  name: "typescript",
  start: (start) => agent(start),
});
