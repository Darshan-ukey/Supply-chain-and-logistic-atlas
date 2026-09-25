import { describe, expect, it } from "vitest";
import {
  AgentFailure,
  checkEventLog,
  manifestSchema,
  packSchema,
  type CaseRecord,
  type EngineConfig,
  type Ending,
  type LimitsOverride,
  type Manifest,
  type OrgAiProvider,
  type Pack,
  type RunEvent,
  type Start,
  type Work,
} from "@malkom/agenticai-contract";
import type { GatewayTool } from "@malkom/agenticai-gateway";
import { AdapterRegistry, type Adapter } from "@malkom/agenticai-adapters";
import { runAgent as runAgentApi, runPipeline as runPipelineApi } from "../src/index.js";

/**
 * These tests drive the engine's real two-argument API — runAgent(request,
 * host) and runPipeline(request, host). The shims below split the old
 * single-bag shape into a request and a HostIntegration so the many cases
 * stay readable; every call still goes through the real entry points.
 */
interface AgentBag {
  manifest: Manifest;
  caseRecord: CaseRecord;
  adapter: Adapter;
  tools: GatewayTool[];
  aiProvider: OrgAiProvider;
  engineConfig?: EngineConfig;
  overrides?: LimitsOverride;
  shadow?: boolean;
  resume?: { runId: string; events: readonly RunEvent[] };
  workFromCall?: (tool: string, args: Record<string, unknown>) => Partial<Work> | null;
  keep: (event: RunEvent) => Promise<void>;
  now?: () => number;
}

const runAgent = (bag: AgentBag): ReturnType<typeof runAgentApi> =>
  runAgentApi(
    {
      manifest: bag.manifest,
      caseRecord: bag.caseRecord,
      ...(bag.engineConfig !== undefined ? { engineConfig: bag.engineConfig } : {}),
      ...(bag.overrides !== undefined ? { overrides: bag.overrides } : {}),
      ...(bag.shadow !== undefined ? { shadow: bag.shadow } : {}),
      ...(bag.resume !== undefined ? { resume: bag.resume } : {}),
      ...(bag.workFromCall !== undefined ? { workFromCall: bag.workFromCall } : {}),
    },
    {
      provider: () => bag.aiProvider,
      tools: () => bag.tools,
      keep: bag.keep,
      adapters: new AdapterRegistry().register(bag.adapter),
      ...(bag.now !== undefined ? { now: bag.now } : {}),
    },
  );

interface PipelineBag {
  pack: Pack;
  caseRecord: CaseRecord;
  adapters: AdapterRegistry;
  toolsFor: (manifest: Manifest) => GatewayTool[];
  aiProvider: OrgAiProvider;
  keep: (event: RunEvent) => Promise<void>;
  shadow?: boolean;
  resume?: { agentId: string; runId: string; events: readonly RunEvent[] };
  now?: () => number;
}

const runPipeline = (bag: PipelineBag): ReturnType<typeof runPipelineApi> =>
  runPipelineApi(
    {
      pack: bag.pack,
      caseRecord: bag.caseRecord,
      ...(bag.shadow !== undefined ? { shadow: bag.shadow } : {}),
      ...(bag.resume !== undefined ? { resume: bag.resume } : {}),
    },
    {
      provider: () => bag.aiProvider,
      tools: (manifest) => bag.toolsFor(manifest),
      keep: bag.keep,
      adapters: bag.adapters,
      ...(bag.now !== undefined ? { now: bag.now } : {}),
    },
  );

const manifest = (over: Record<string, unknown> = {}): Manifest =>
  manifestSchema.parse({
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
    ...over,
  });

const caseRecord = (): CaseRecord => ({
  taskId: "task-1",
  org: "seko",
  queue: "booking",
  subQueue: "amendment",
  fields: { text: "Please amend booking BK-1029 to sailing ERV 13E." },
  confidence: {},
  notes: [],
});

const aiProvider: OrgAiProvider = {
  provider: "none",
  model: null,
  currency: "USD",
  inputPerMillion: 300,
  outputPerMillion: 1_500,
};

const tools = (): GatewayTool[] => [
  {
    name: "read-case",
    label: "Read the case",
    describe: "",
    writes: false,
    args: { type: "object", properties: {} },
    run: async () => ({ fields: { customer: "Mercantile" } }),
  },
  {
    name: "write-fields",
    label: "Write fields onto the case",
    describe: "",
    writes: true,
    args: { type: "object", properties: {} },
    run: async () => ({ written: true }),
  },
];

const keepInto = (events: RunEvent[]) => async (event: RunEvent) => {
  events.push(event);
};

/** An agent as an adapter: real connection, scripted decisions. */
const agentThat = (work: (start: Start) => Promise<Ending>): Adapter => ({
  name: "typescript",
  start: work,
});

describe("the runner", () => {
  it("runs an agent to done and writes every step to the event log first", async () => {
    const events: RunEvent[] = [];
    const report = await runAgent({
      manifest: manifest(),
      caseRecord: caseRecord(),
      adapter: agentThat(async (start) => {
        await start.call("read-case", {});
        await start.call("write-fields", {
          fields: { bookingRef: "BK-1029" },
          confidence: { bookingRef: 0.95 },
        });
        return {
          ending: "done",
          work: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.95 }, tried: [], notes: [] },
        };
      }),
      tools: tools(),
      aiProvider,
      keep: keepInto(events),
    });

    expect(report.ending.ending).toBe("done");
    expect(report.attempts).toBe(1);
    expect(checkEventLog(events).ok).toBe(true);
    expect(events[0]?.type).toBe("run.started");
    expect(events.at(-1)?.type).toBe("run.ended");
    expect(report.spend.toolCalls).toBe(2);
    // The pass was minted for this run: one org, one task, the named tools.
    expect(report.pass.tools).toEqual(["read-case", "write-fields"]);
    expect(report.pass.taskId).toBe("task-1");
  });

  it('grades "done" against the confidence floors — under the line goes to a person', async () => {
    const events: RunEvent[] = [];
    const report = await runAgent({
      manifest: manifest(),
      caseRecord: caseRecord(),
      adapter: agentThat(async () => ({
        ending: "done",
        work: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.42 }, tried: [], notes: [] },
      })),
      tools: tools(),
      aiProvider,
      keep: keepInto(events),
    });
    expect(report.ending.ending).toBe("handover");
    if (report.ending.ending === "handover") {
      expect(report.ending.whyStopped).toContain("0.42");
      // The work is attached — a person never starts from zero.
      expect(report.ending.work.fields["bookingRef"]).toBe("BK-1029");
    }
  });

  it("retries the failure types the manifest names, with the manifest's delay", async () => {
    const events: RunEvent[] = [];
    let attempt = 0;
    const report = await runAgent({
      manifest: manifest({ limits: { retry: { on: ["provider-down"], times: 2, delayMs: 1 } } }),
      caseRecord: caseRecord(),
      adapter: agentThat(async () => {
        attempt += 1;
        if (attempt < 3) throw new AgentFailure("provider-down", "the AI endpoint failed (529)");
        return { ending: "done", work: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.9 }, tried: [], notes: [] } };
      }),
      tools: tools(),
      aiProvider,
      keep: keepInto(events),
    });
    expect(report.ending.ending).toBe("done");
    expect(report.attempts).toBe(3);
    expect(events.filter((event) => event.type === "run.retried")).toHaveLength(2);
  });

  it("never retries a wrong answer unless the manifest says so", async () => {
    const events: RunEvent[] = [];
    let attempts = 0;
    const report = await runAgent({
      manifest: manifest(),
      caseRecord: caseRecord(),
      adapter: agentThat(async () => {
        attempts += 1;
        return { ending: "done", work: { fields: {}, confidence: {}, tried: [], notes: [] } };
      }),
      tools: tools(),
      aiProvider,
      keep: keepInto(events),
    });
    expect(attempts).toBe(1);
    expect(report.ending.ending).toBe("handover");
  });

  it("stops at the money limit — never silently overspend — with the work attached", async () => {
    const events: RunEvent[] = [];
    const report = await runAgent({
      manifest: manifest({ limits: { moneyLimit: 25 } }),
      caseRecord: caseRecord(),
      adapter: agentThat(async (start) => {
        await start.call("write-fields", { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.9 } });
        // An agent burning money in a loop. The engine, not the agent, stops it.
        for (let step = 0; step < 100; step += 1) {
          if (start.signal.aborted) throw new Error("stopped");
          await start.report({
            type: "model.replied",
            at: new Date().toISOString(),
            step,
            reply: "thinking...",
            tokensIn: 10_000,
            tokensOut: 2_000,
            money: 10,
            elapsedMs: 5,
          });
        }
        return { ending: "done", work: { fields: {}, confidence: {}, tried: [], notes: [] } };
      }),
      tools: tools(),
      aiProvider,
      keep: keepInto(events),
    });
    expect(report.ending.ending).toBe("handover");
    if (report.ending.ending === "handover") {
      expect(report.ending.whyStopped).toContain("money limit");
      expect(report.ending.work.fields["bookingRef"]).toBe("BK-1029");
    }
    expect(report.spend.money).toBeGreaterThan(25);
    expect(report.spend.money).toBeLessThan(50);
  });

  it("stops at the total time limit — a normal ending, not a crash", async () => {
    const events: RunEvent[] = [];
    const report = await runAgent({
      manifest: manifest({ limits: { runTimeoutMs: 1_000, stepTimeoutMs: 600_000 } }),
      caseRecord: caseRecord(),
      adapter: agentThat(
        (start) =>
          new Promise((_, reject) => {
            start.signal.addEventListener("abort", () => reject(new Error("stopped")), { once: true });
          }),
      ),
      tools: tools(),
      aiProvider,
      keep: keepInto(events),
    });
    expect(report.ending.ending).toBe("handover");
    if (report.ending.ending === "handover") expect(report.ending.whyStopped).toContain("total time limit");
  }, 15_000);

  it("stops a run whose step produces nothing within the timeout per step", async () => {
    const events: RunEvent[] = [];
    const report = await runAgent({
      manifest: manifest({ limits: { stepTimeoutMs: 100, runTimeoutMs: 60_000 } }),
      caseRecord: caseRecord(),
      adapter: agentThat(
        (start) =>
          new Promise((_, reject) => {
            start.signal.addEventListener("abort", () => reject(new Error("stopped")), { once: true });
          }),
      ),
      tools: tools(),
      aiProvider,
      keep: keepInto(events),
    });
    expect(report.ending.ending).toBe("handover");
    if (report.ending.ending === "handover") expect(report.ending.whyStopped).toContain("timeout per step");
  });

  it("parks when the agent parks, and says what wakes it", async () => {
    const events: RunEvent[] = [];
    const wakeAt = new Date(Date.now() + 3_600_000).toISOString();
    const report = await runAgent({
      manifest: manifest(),
      caseRecord: caseRecord(),
      adapter: agentThat(async () => ({
        ending: "parked",
        wake: { on: "date", date: wakeAt },
        because: "The customer sends documents tomorrow.",
        work: { fields: {}, confidence: {}, tried: ["read the message"], notes: [] },
      })),
      tools: tools(),
      aiProvider,
      keep: keepInto(events),
    });
    expect(report.ending.ending).toBe("parked");
    if (report.ending.ending === "parked") expect(report.ending.wake).toEqual({ on: "date", date: wakeAt });
    const ended = events.at(-1);
    if (ended?.type === "run.ended") expect(ended.outcome.ending).toBe("parked");
  });

  it("resumes from the last written step, serving recorded tool replies", async () => {
    // First run: the agent reads the case, then the machine dies mid-run.
    const firstEvents: RunEvent[] = [];
    let firstRunId = "";
    await runAgent({
      manifest: manifest(),
      caseRecord: caseRecord(),
      adapter: agentThat(async (start) => {
        firstRunId = start.pass.runId;
        await start.call("read-case", {});
        throw new Error("the machine died");
      }),
      tools: tools(),
      aiProvider,
      keep: keepInto(firstEvents),
    });

    // The unfinished log: everything up to the last written step.
    const unfinished = firstEvents.filter((event) => event.type !== "run.ended");

    // Resume: the same tool call is served from the log, not run again.
    let reran = 0;
    const resumedEvents: RunEvent[] = [];
    const report = await runAgent({
      manifest: manifest(),
      caseRecord: caseRecord(),
      adapter: agentThat(async (start) => {
        const reply = await start.call("read-case", {});
        if (!reply.ok) throw new Error("expected the recorded reply");
        return {
          ending: "done",
          work: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.9 }, tried: [], notes: [] },
        };
      }),
      tools: [
        {
          name: "read-case",
          label: "Read the case",
          describe: "",
          writes: false,
          args: {},
          run: async () => {
            reran += 1;
            return { fields: {} };
          },
        },
        ...tools().slice(1),
      ],
      aiProvider,
      resume: { runId: firstRunId, events: unfinished },
      keep: keepInto(resumedEvents),
    });

    expect(report.ending.ending).toBe("done");
    expect(report.runId).toBe(firstRunId);
    expect(reran).toBe(0); // served from the log — the run took the route it was taking
    // The continued log is gapless across the break.
    const whole = [...unfinished, ...resumedEvents];
    expect(checkEventLog(whole).ok).toBe(true);
  });

  it("blocks writes on a shadow run — the pass, not politeness", async () => {
    const events: RunEvent[] = [];
    const report = await runAgent({
      manifest: manifest(),
      caseRecord: caseRecord(),
      adapter: agentThat(async (start) => {
        expect(start.tools.map((tool) => tool.name)).toEqual(["read-case"]); // writes not even offered
        const write = await start.call("write-fields", { fields: { bookingRef: "X" }, confidence: {} });
        expect(write.ok).toBe(false);
        return {
          ending: "done",
          work: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.9 }, tried: [], notes: [] },
        };
      }),
      tools: tools(),
      aiProvider,
      shadow: true,
      keep: keepInto(events),
    });
    expect(report.pass.shadow).toBe(true);
    expect(report.ending.ending).toBe("done");
  });
});

describe("the queue's agent pipeline", () => {
  const packOf = (agents: Manifest[], connections: { from: string; to: string; kind: "hands-to" | "may-call" }[]) =>
    packSchema.parse({
      kind: "malkom.agent-pack/1",
      id: "bookings",
      version: "1.0.0",
      label: "Bookings pack",
      queue: "booking",
      agents,
      connections,
    });

  it("hands the case along the line, each agent seeing the last one's work", async () => {
    const first = manifest({ id: "intake-clerk", label: "Intake clerk" });
    const second = manifest({ id: "booking-clerk" });
    const seen: Record<string, unknown>[] = [];

    const adapters = new AdapterRegistry().register({
      name: "typescript",
      start: async (start) => {
        seen.push(start.caseRecord.fields);
        if (start.manifest.id === "intake-clerk") {
          return {
            ending: "done",
            work: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.95 }, tried: [], notes: ["Matched the booking."] },
          };
        }
        return {
          ending: "question",
          sentence: "Split across two sailings, or keep 40 units on the later one?",
          choices: ["Split across both", "All on the later sailing"],
          fills: "sailingChoice",
          work: { fields: {}, confidence: {}, tried: [], notes: [] },
        };
      },
    });

    const events: RunEvent[] = [];
    const report = await runPipeline({
      pack: packOf([first, second], [{ from: "intake-clerk", to: "booking-clerk", kind: "hands-to" }]),
      caseRecord: caseRecord(),
      adapters,
      toolsFor: () => tools(),
      aiProvider,
      keep: keepInto(events),
    });

    expect(report.runs).toHaveLength(2);
    expect(report.ending.ending).toBe("question");
    expect(report.endedBy).toBe("booking-clerk");
    // The second agent saw the first agent's work on the shared case record.
    expect(seen[1]?.["bookingRef"]).toBe("BK-1029");
    // And the case record carries the note for whoever comes next — or HITL.
    expect(report.caseRecord.notes.map((note) => note.note)).toContain("Matched the booking.");
  });

  it("lets an agent call declared help — and only declared help", async () => {
    const clerk = manifest({ id: "booking-clerk" });
    const helper = manifest({ id: "rate-lookup", label: "Rate lookup", output: [{ field: "rate", minConfidence: 0.5 }] });

    const adapters = new AdapterRegistry().register({
      name: "typescript",
      start: async (start) => {
        if (start.manifest.id === "booking-clerk") {
          expect(start.tools.map((tool) => tool.name)).toContain("rate-lookup");
          const help = await start.call("rate-lookup", { because: "need the rate" });
          expect(help.ok).toBe(true);
          return {
            ending: "done",
            work: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.9 }, tried: [], notes: [] },
          };
        }
        return {
          ending: "done",
          work: { fields: { rate: "USD 2,150" }, confidence: { rate: 0.9 }, tried: [], notes: [] },
        };
      },
    });

    const events: RunEvent[] = [];
    const report = await runPipeline({
      pack: packOf([clerk, helper], [{ from: "booking-clerk", to: "rate-lookup", kind: "may-call" }]),
      caseRecord: caseRecord(),
      adapters,
      toolsFor: () => tools(),
      aiProvider,
      keep: keepInto(events),
    });

    expect(report.ending.ending).toBe("done");
    expect(report.runs).toHaveLength(2); // the helper's run is a real, recorded run
    expect(report.caseRecord.fields["rate"]).toBe("USD 2,150"); // help lands on the case
  });

  it("refuses to run an agent whose adapter this runtime does not have", async () => {
    const adapters = new AdapterRegistry();
    await expect(
      runPipeline({
        pack: packOf([manifest()], []),
        caseRecord: caseRecord(),
        adapters,
        toolsFor: () => tools(),
        aiProvider,
        keep: async () => {},
      }),
    ).rejects.toThrow(/adapter/);
  });
});
