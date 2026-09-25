import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import {
  AgentFailure,
  type DraftRunEvent,
  type Manifest,
  type Start,
  type ToolReply,
  manifestSchema,
} from "@malkom/agenticai-contract";
import { manifestAgent, typescriptAdapter } from "../src/index.js";

const manifest: Manifest = manifestSchema.parse({
  kind: "malkom.agent-manifest/1",
  id: "booking-clerk",
  version: "1.0.0",
  label: "Booking clerk",
  goal: "Complete the booking so it can be confirmed.",
  queue: "booking",
  output: [{ field: "bookingRef", minConfidence: 0.85 }],
  tools: [
    { name: "read-case", label: "Read the case" },
    { name: "write-fields", label: "Write fields onto the case" },
  ],
  container: { image: "malkom/booking-clerk:1.0.0", adapter: "typescript" },
});

/** A reply the mock model gives: one tool call, or an end. */
type Scripted =
  | { tool: string; input: Record<string, unknown> }
  | { end: Record<string, unknown> }
  | { fail: () => never };

const modelFrom = (script: readonly Scripted[]): MockLanguageModelV4 => {
  let turn = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const move = script[Math.min(turn, script.length - 1)];
      turn += 1;
      if (move === undefined) throw new Error("the script ran out");
      if ("fail" in move) move.fail();
      const call =
        "end" in move
          ? { toolName: "end", input: JSON.stringify(move.end) }
          : { toolName: move.tool.replace(/-/g, "_"), input: JSON.stringify(move.input) };
      return {
        finishReason: { type: "tool-calls" as const },
        usage: { inputTokens: { total: 100 }, outputTokens: { total: 20 } },
        content: [
          {
            type: "tool-call" as const,
            toolCallId: `call-${turn}`,
            toolName: call.toolName,
            input: call.input,
          },
        ],
        warnings: [],
      };
    },
  });
};

const startWith = (
  script: readonly Scripted[],
  onCall?: (tool: string, args: Record<string, unknown>) => Promise<ToolReply>,
): { start: Start; events: DraftRunEvent[] } => {
  const events: DraftRunEvent[] = [];
  const start: Start = {
    manifest,
    goal: manifest.goal,
    caseRecord: {
      taskId: "task-1",
      org: "seko",
      queue: "booking",
      fields: { text: "Please amend booking BK-1029 to sailing ERV 13E." },
      confidence: {},
      notes: [],
    },
    pass: {
      format: 1,
      passId: "0b0e8b9a-58b7-4c2b-9f57-3c7f6a1d2e3f",
      runId: "1c1f9c0b-69c8-4d3c-8a68-4d8f7b2e3f4a",
      org: "seko",
      taskId: "task-1",
      agent: { id: manifest.id, version: manifest.version },
      tools: manifest.tools.map((tool) => tool.name),
      issuedAt: 0,
      expiresAt: Math.floor(Date.now() / 1000) + 900,
      shadow: false,
    },
    tools: [
      { name: "read-case", label: "Read the case", describe: "", writes: false, args: { type: "object", properties: {} } },
      { name: "write-fields", label: "Write fields onto the case", describe: "", writes: true, args: { type: "object", properties: {} } },
    ],
    limits: manifest.limits,
    shadow: false,
    aiProvider: {
      provider: "mock",
      model: modelFrom(script),
      currency: "USD",
      inputPerMillion: 300,
      outputPerMillion: 1_500,
    },
    signal: new AbortController().signal,
    report: async (event) => {
      events.push(event);
    },
    call: onCall ?? (async () => ({ ok: true, reply: {} })),
  };
  return { start, events };
};

describe("the TypeScript adapter", () => {
  it("passes the goal in and the endings out — the agent decides the steps", async () => {
    const called: string[] = [];
    const { start, events } = startWith(
      [
        { tool: "read-case", input: {} },
        { tool: "write-fields", input: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.95 } } },
        {
          end: {
            ending: "done",
            fields: { bookingRef: "BK-1029" },
            confidence: { bookingRef: 0.95 },
          },
        },
      ],
      async (tool, args) => {
        called.push(tool);
        void args;
        return { ok: true, reply: { fine: true } };
      },
    );

    const ending = await manifestAgent(start);
    expect(ending.ending).toBe("done");
    if (ending.ending === "done") {
      expect(ending.work.fields["bookingRef"]).toBe("BK-1029");
      expect(ending.work.confidence["bookingRef"]).toBe(0.95);
    }
    // The agent chose its tools; the adapter only carried the calls.
    expect(called).toEqual(["read-case", "write-fields"]);
    // Every model reply was reported — a run event per step, money computed
    // from this org's AI provider prices.
    const modelReplies = events.filter((event) => event.type === "model.replied");
    expect(modelReplies.length).toBe(3);
    const first = modelReplies[0];
    if (first?.type === "model.replied") {
      expect(first.money).toBeCloseTo((100 / 1_000_000) * 300 + (20 / 1_000_000) * 1_500);
    }
  });

  it("turns a question that cannot be answered in one action into a handover", async () => {
    const { start } = startWith([
      { end: { ending: "question", sentence: "Which sailing?", choices: ["ERV 12E"], fills: "sailing" } },
    ]);
    const ending = await manifestAgent(start);
    expect(ending.ending).toBe("handover");
  });

  it("lets a well-formed question through: one sentence, choices, the field it fills", async () => {
    const { start } = startWith([
      {
        end: {
          ending: "question",
          sentence: "Split across two sailings, or keep 40 units on the later one?",
          choices: ["Split across both", "All on the later sailing"],
          fills: "sailingChoice",
        },
      },
    ]);
    const ending = await manifestAgent(start);
    expect(ending.ending).toBe("question");
    if (ending.ending === "question") expect(ending.choices).toHaveLength(2);
  });

  it("turns parked-with-nothing-named into a handover — a case must not sleep forever", async () => {
    const { start } = startWith([{ end: { ending: "parked" } }]);
    const ending = await manifestAgent(start);
    expect(ending.ending).toBe("handover");
  });

  it("keeps a parked ending that names its wake: a date", async () => {
    const wakeAt = new Date(Date.now() + 86_400_000).toISOString();
    const { start } = startWith([
      { end: { ending: "parked", wakeOn: "date", wakeDate: wakeAt, because: "Documents follow tomorrow." } },
    ]);
    const ending = await manifestAgent(start);
    expect(ending.ending).toBe("parked");
    if (ending.ending === "parked") expect(ending.wake).toEqual({ on: "date", date: wakeAt });
  });

  it("raises provider-down as a typed failure the runner can retry", async () => {
    const { APICallError } = await import("ai");
    const { start } = startWith([
      {
        fail: () => {
          throw new APICallError({
            message: "overloaded",
            url: "https://api.example.test",
            requestBodyValues: {},
            statusCode: 529,
            responseHeaders: {},
            responseBody: "overloaded",
            isRetryable: true,
            data: undefined,
          });
        },
      },
    ]);
    await expect(manifestAgent(start)).rejects.toSatisfy(
      (error: unknown) => error instanceof AgentFailure && error.failure === "provider-down",
    );
  });

  it("hands over when the agent stops without choosing an ending", async () => {
    let turn = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        turn += 1;
        return {
          finishReason: { type: "stop" as const },
          usage: { inputTokens: { total: 10 }, outputTokens: { total: 5 } },
          content: [{ type: "text" as const, text: "hm." }],
          warnings: [],
        };
      },
    });
    const { start } = startWith([]);
    const ending = await typescriptAdapter().start({
      ...start,
      aiProvider: { ...start.aiProvider, model },
    });
    expect(turn).toBe(1);
    expect(ending.ending).toBe("handover");
  });
});
