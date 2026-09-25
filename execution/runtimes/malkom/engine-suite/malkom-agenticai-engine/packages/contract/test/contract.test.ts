import { describe, expect, it } from "vitest";
import {
  checkEventLog,
  checkPass,
  endingSchema,
  mayCall,
  packOrder,
  parseManifest,
  parsePack,
  recordedToolReplies,
  resolveLimits,
  resumePoint,
  spendOf,
  type AccessPass,
  type RunEvent,
} from "../src/index.js";

const manifest = (over: Record<string, unknown> = {}): unknown => ({
  kind: "malkom.agent-manifest/1",
  id: "booking-clerk",
  version: "1.0.0",
  label: "Booking clerk",
  goal: "Complete the booking so it can be confirmed.",
  queue: "booking",
  output: [{ field: "bookingRef", minConfidence: 0.85 }],
  tools: [{ name: "read-case", label: "Read the case" }],
  container: { image: "malkom/booking-clerk:1.0.0", adapter: "typescript" },
  ...over,
});

describe("the manifest", () => {
  it("accepts a manifest with a goal, a queue, fields, tools and limits", () => {
    const result = parseManifest(manifest());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.limits.stepTimeoutMs).toBe(30_000);
    expect(result.manifest.limits.moneyLimit).toBe(500);
    expect(result.manifest.limits.retry.on).toEqual(["network", "provider-down"]);
    expect(result.manifest.telemetry.tracePercent).toBe(100);
  });

  it("is rejected without a plain-language label", () => {
    const result = parseManifest(manifest({ label: "" }));
    expect(result.ok).toBe(false);
  });

  it("is rejected when a tool has no plain-language label", () => {
    const result = parseManifest(manifest({ tools: [{ name: "read-case", label: "" }] }));
    expect(result.ok).toBe(false);
  });

  it("is rejected when it defines no output fields — done would mean nothing", () => {
    const result = parseManifest(manifest({ output: [] }));
    expect(result.ok).toBe(false);
  });

  it("refuses duplicate tools and duplicate output fields", () => {
    const twice = parseManifest(
      manifest({
        tools: [
          { name: "read-case", label: "Read the case" },
          { name: "read-case", label: "Read it again" },
        ],
      }),
    );
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.problems.join(" ")).toContain("listed twice");
  });

  it("lets an org override the manifest's numbers, and only those", () => {
    const parsed = parseManifest(manifest({ limits: { moneyLimit: 1_000 } }));
    if (!parsed.ok) throw new Error("manifest should parse");
    const limits = resolveLimits(parsed.manifest.limits, { runTimeoutMs: 60_000 });
    expect(limits.moneyLimit).toBe(1_000); // the manifest's number
    expect(limits.runTimeoutMs).toBe(60_000); // the org's override
    expect(limits.stepTimeoutMs).toBe(30_000); // the default
  });
});

describe("the four endings", () => {
  it("knows exactly four ways to finish", () => {
    for (const ending of [
      { ending: "done", work: {} },
      { ending: "question", sentence: "Which sailing?", choices: ["ERV 12E", "ERV 13E"], fills: "sailing", work: {} },
      { ending: "handover", whyStopped: "The document has no text layer.", work: {} },
      { ending: "parked", wake: { on: "date", date: new Date().toISOString() }, because: "Docs follow Monday.", work: {} },
    ]) {
      expect(endingSchema.safeParse(ending).success).toBe(true);
    }
    expect(endingSchema.safeParse({ ending: "gave-up", work: {} }).success).toBe(false);
  });

  it("forces the question format: one sentence, two to five choices, the field it fills", () => {
    const one = endingSchema.safeParse({
      ending: "question",
      sentence: "Which sailing?",
      choices: ["only one"],
      fills: "sailing",
      work: {},
    });
    expect(one.success).toBe(false);
    const six = endingSchema.safeParse({
      ending: "question",
      sentence: "Which sailing?",
      choices: ["a", "b", "c", "d", "e", "f"],
      fills: "sailing",
      work: {},
    });
    expect(six.success).toBe(false);
  });

  it("forces parked to say what wakes it: a reply, a document, a date", () => {
    const nothing = endingSchema.safeParse({
      ending: "parked",
      wake: { on: "someday" },
      because: "waiting",
      work: {},
    });
    expect(nothing.success).toBe(false);
  });
});

describe("the access pass", () => {
  const pass: AccessPass = {
    format: 1,
    passId: "0b0e8b9a-58b7-4c2b-9f57-3c7f6a1d2e3f",
    runId: "1c1f9c0b-69c8-4d3c-8a68-4d8f7b2e3f4a",
    org: "seko",
    taskId: "task-1",
    agent: { id: "booking-clerk", version: "1.0.0" },
    tools: ["read-case", "write-fields"],
    issuedAt: 1_000,
    expiresAt: 1_000 + 15 * 60,
    shadow: false,
  };

  it("allows a named tool on the right task while the pass is valid", () => {
    const decision = checkPass(pass, { tool: "read-case", taskId: "task-1", writes: false }, 1_060);
    expect(decision.ok).toBe(true);
  });

  it("refuses after the minutes run out", () => {
    const decision = checkPass(pass, { tool: "read-case", taskId: "task-1", writes: false }, 1_000 + 15 * 60);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.refusal.reason).toBe("expired");
  });

  it("refuses a tool that is not on the pass", () => {
    const decision = checkPass(pass, { tool: "send-edi", taskId: "task-1", writes: true }, 1_060);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.refusal.reason).toBe("tool-not-on-pass");
  });

  it("refuses another task — one pass, one task", () => {
    const decision = checkPass(pass, { tool: "read-case", taskId: "task-2", writes: false }, 1_060);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.refusal.reason).toBe("wrong-task");
  });

  it("blocks all writes during a shadow run, even for a named tool", () => {
    const shadow = { ...pass, shadow: true };
    const read = checkPass(shadow, { tool: "read-case", taskId: "task-1", writes: false }, 1_060);
    expect(read.ok).toBe(true);
    const write = checkPass(shadow, { tool: "write-fields", taskId: "task-1", writes: true }, 1_060);
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.refusal.reason).toBe("write-during-shadow");
  });
});

const runId = "2d2f9c0b-69c8-4d3c-8a68-4d8f7b2e3f4b";
const at = new Date().toISOString();
const started: RunEvent = {
  type: "run.started",
  runId,
  seq: 0,
  at,
  agent: { id: "booking-clerk", version: "1.0.0", label: "Booking clerk" },
  org: "seko",
  taskId: "task-1",
  queue: "booking",
  passId: "0b0e8b9a-58b7-4c2b-9f57-3c7f6a1d2e3f",
  shadow: false,
  goal: "Complete the booking.",
};

describe("the run events", () => {
  it("accepts a gapless log that starts with run.started", () => {
    const events: RunEvent[] = [
      started,
      { type: "tool.called", runId, seq: 1, at, step: 0, tool: "read-case", args: {}, writes: false },
      { type: "tool.replied", runId, seq: 2, at, step: 0, tool: "read-case", ok: true, reply: { fields: {} }, elapsedMs: 3 },
    ];
    expect(checkEventLog(events).ok).toBe(true);
  });

  it("refuses a log with a hole — it cannot be trusted for resume", () => {
    const events: RunEvent[] = [
      started,
      { type: "tool.called", runId, seq: 2, at, step: 0, tool: "read-case", args: {}, writes: false },
    ];
    const checked = checkEventLog(events);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.problems.join(" ")).toContain("hole");
  });

  it("reads what a run spent straight off the log", () => {
    const events: RunEvent[] = [
      started,
      { type: "model.replied", runId, seq: 1, at, step: 0, reply: "looking", tokensIn: 100, tokensOut: 20, money: 12, elapsedMs: 400 },
      { type: "tool.called", runId, seq: 2, at, step: 0, tool: "read-case", args: {}, writes: false },
      { type: "model.replied", runId, seq: 3, at, step: 1, reply: "done", tokensIn: 60, tokensOut: 10, money: 8, elapsedMs: 300 },
    ];
    const spend = spendOf(events);
    expect(spend.money).toBe(20);
    expect(spend.tokensIn).toBe(160);
    expect(spend.toolCalls).toBe(1);
  });

  it("finds the last written step to resume from, and none once ended", () => {
    const unfinished: RunEvent[] = [
      started,
      { type: "tool.called", runId, seq: 1, at, step: 0, tool: "read-case", args: {}, writes: false },
      { type: "tool.replied", runId, seq: 2, at, step: 0, tool: "read-case", ok: true, reply: {}, elapsedMs: 3 },
    ];
    expect(resumePoint(unfinished)).toEqual({ seq: 2, step: 0 });

    const ended: RunEvent[] = [
      ...unfinished,
      {
        type: "run.ended",
        runId,
        seq: 3,
        at,
        outcome: { ending: "done", work: { fields: {}, confidence: {}, tried: [], notes: [] } },
        spend: { money: 0, tokensIn: 0, tokensOut: 0, toolCalls: 1, elapsedMs: 10 },
      },
    ];
    expect(resumePoint(ended)).toBeNull();
  });

  it("serves recorded tool replies again, so a resumed run takes the same route", () => {
    const events: RunEvent[] = [
      started,
      { type: "tool.called", runId, seq: 1, at, step: 0, tool: "read-case", args: { deep: true }, writes: false },
      { type: "tool.replied", runId, seq: 2, at, step: 0, tool: "read-case", ok: true, reply: { fields: { a: 1 } }, elapsedMs: 3 },
    ];
    const keyOf = (tool: string, args: Record<string, unknown>): string => `${tool}:${JSON.stringify(args)}`;
    const replies = recordedToolReplies(events, keyOf);
    expect(replies.get('read-case:{"deep":true}')).toEqual({ fields: { a: 1 } });
  });
});

describe("the pack", () => {
  const pack = (over: Record<string, unknown> = {}): unknown => ({
    kind: "malkom.agent-pack/1",
    id: "bookings",
    version: "1.0.0",
    label: "Bookings pack",
    queue: "booking",
    agents: [
      manifest({ id: "intake-clerk", label: "Intake clerk" }),
      manifest({ id: "booking-clerk" }),
      manifest({ id: "rate-lookup", label: "Rate lookup" }),
    ],
    connections: [
      { from: "intake-clerk", to: "booking-clerk", kind: "hands-to" },
      { from: "booking-clerk", to: "rate-lookup", kind: "may-call" },
    ],
    ...over,
  });

  it("accepts a pack and orders the hands-to line", () => {
    const result = parsePack(pack());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(packOrder(result.pack)).toEqual(["intake-clerk", "booking-clerk"]);
    expect(mayCall(result.pack, "booking-clerk")).toEqual(["rate-lookup"]);
  });

  it("refuses an agent from another queue — a pack is built per queue", () => {
    const result = parsePack(
      pack({ agents: [manifest({ id: "intake-clerk", queue: "invoices" })], connections: [] }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a connection to an agent that is not in the pack", () => {
    const result = parsePack(
      pack({ connections: [{ from: "intake-clerk", to: "ghost", kind: "hands-to" }] }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a hands-to loop — a case must be able to leave the line", () => {
    const result = parsePack(
      pack({
        agents: [manifest({ id: "intake-clerk" }), manifest({ id: "booking-clerk" })],
        connections: [
          { from: "intake-clerk", to: "booking-clerk", kind: "hands-to" },
          { from: "booking-clerk", to: "intake-clerk", kind: "hands-to" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses two disjoint hands-to lines — a case can only travel one", () => {
    const result = parsePack(
      pack({
        agents: [
          manifest({ id: "a", label: "A" }),
          manifest({ id: "b", label: "B" }),
          manifest({ id: "c", label: "C" }),
          manifest({ id: "d", label: "D" }),
        ],
        connections: [
          { from: "a", to: "b", kind: "hands-to" },
          { from: "c", to: "d", kind: "hands-to" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ")).toContain("more than one line");
  });

  it("refuses a floating agent nobody is connected to", () => {
    const result = parsePack(
      pack({
        agents: [manifest({ id: "intake-clerk" }), manifest({ id: "booking-clerk" }), manifest({ id: "rate-lookup" })],
        connections: [{ from: "intake-clerk", to: "booking-clerk", kind: "hands-to" }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ")).toContain("rate-lookup");
  });
});
