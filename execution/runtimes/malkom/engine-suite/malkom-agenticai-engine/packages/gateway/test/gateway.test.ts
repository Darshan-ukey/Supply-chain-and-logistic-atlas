import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AccessPass, RunEvent } from "@malkom/agenticai-contract";
import { Gateway, callKey, mcpGateway, redactorFor, toolsFromOrgConfig, type GatewayTool } from "../src/index.js";

const pass = (over: Partial<AccessPass> = {}): AccessPass => ({
  format: 1,
  passId: "0b0e8b9a-58b7-4c2b-9f57-3c7f6a1d2e3f",
  runId: "1c1f9c0b-69c8-4d3c-8a68-4d8f7b2e3f4a",
  org: "seko",
  taskId: "task-1",
  agent: { id: "booking-clerk", version: "1.0.0" },
  tools: ["read-case", "write-fields"],
  issuedAt: Math.floor(Date.now() / 1000),
  expiresAt: Math.floor(Date.now() / 1000) + 900,
  shadow: false,
  ...over,
});

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

const collect = (): { events: RunEvent[]; record: (e: unknown) => Promise<void> } => {
  const events: RunEvent[] = [];
  return {
    events,
    record: async (event) => {
      events.push({ ...(event as object), runId: pass().runId, seq: events.length } as RunEvent);
    },
  };
};

const gatewayWith = (
  over: Partial<AccessPass> = {},
  extra: Partial<ConstructorParameters<typeof Gateway>[0]> = {},
): { gateway: Gateway; events: RunEvent[] } => {
  const { events, record } = collect();
  const gateway = new Gateway({
    tools: tools(),
    pass: pass(over),
    record,
    redact: (value) => value,
    stepTimeoutMs: 1_000,
    ...extra,
  });
  return { gateway, events };
};

describe("the gateway", () => {
  it("offers exactly the pass's named tools", () => {
    const { gateway } = gatewayWith({ tools: ["read-case"] });
    expect(gateway.offered().map((tool) => tool.name)).toEqual(["read-case"]);
  });

  it("does not even offer a write on a shadow run", () => {
    const { gateway } = gatewayWith({ shadow: true });
    expect(gateway.offered().map((tool) => tool.name)).toEqual(["read-case"]);
  });

  it("refuses to serve a tool with no plain-language label", () => {
    const { record } = collect();
    expect(
      () =>
        new Gateway({
          tools: [{ ...tools()[0]!, label: " " }],
          pass: pass(),
          record,
          redact: (value) => value,
          stepTimeoutMs: 1_000,
        }),
    ).toThrow(/plain-language label/);
  });

  it("checks the pass on every call and records the refusal", async () => {
    const { gateway, events } = gatewayWith();
    const reply = await gateway.call("send-edi", {});
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.refused).toContain("not on this run's access pass");
    expect(events.map((event) => event.type)).toEqual(["tool.called", "tool.replied"]);
  });

  it("records and times every call itself — the agent cannot skip the recording", async () => {
    const { gateway, events } = gatewayWith();
    const reply = await gateway.call("read-case", {});
    expect(reply.ok).toBe(true);
    expect(events).toHaveLength(2);
    const replied = events[1];
    if (replied?.type !== "tool.replied") throw new Error("expected tool.replied");
    expect(replied.ok).toBe(true);
    expect(replied.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("blocks a write during a shadow run at call time too", async () => {
    const { gateway } = gatewayWith({ shadow: true });
    const reply = await gateway.call("write-fields", { fields: {} });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.refused).toContain("shadow");
  });

  it("turns a tool error into a refusal the agent can reason about", async () => {
    const { events, record } = collect();
    const gateway = new Gateway({
      tools: [
        {
          name: "read-case",
          label: "Read the case",
          describe: "",
          writes: false,
          args: {},
          run: async () => {
            throw new Error("the database is down");
          },
        },
      ],
      pass: pass({ tools: ["read-case"] }),
      record,
      redact: (value) => value,
      stepTimeoutMs: 1_000,
    });
    const reply = await gateway.call("read-case", {});
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.refused).toContain("database is down");
    expect(events.filter((event) => event.type === "tool.replied")).toHaveLength(1);
  });

  it("applies the manifest's redaction before anything is recorded", async () => {
    const { events, record } = collect();
    const gateway = new Gateway({
      tools: tools(),
      pass: pass(),
      record,
      redact: redactorFor(["shipperTaxId"]),
      stepTimeoutMs: 1_000,
    });
    await gateway.call("write-fields", { fields: { shipperTaxId: "SECRET-77" } });
    const called = events[0];
    if (called?.type !== "tool.called") throw new Error("expected tool.called");
    expect(JSON.stringify(called.args)).not.toContain("SECRET-77");
  });

  it("times out a step that hangs — the timeout per step", async () => {
    const { record } = collect();
    const gateway = new Gateway({
      tools: [
        {
          name: "read-case",
          label: "Read the case",
          describe: "",
          writes: false,
          args: {},
          run: () => new Promise((resolve) => setTimeout(resolve, 5_000)),
        },
      ],
      pass: pass({ tools: ["read-case"] }),
      record,
      redact: (value) => value,
      stepTimeoutMs: 30,
    });
    const reply = await gateway.call("read-case", {});
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.refused).toContain("longer than 30ms");
  });

  it("serves recorded replies on resume instead of calling the tool again", async () => {
    let ran = 0;
    const { record } = collect();
    const recorded = new Map([[callKey("read-case", {}), { fields: { customer: "Recorded" } }]]);
    const gateway = new Gateway({
      tools: [
        {
          name: "read-case",
          label: "Read the case",
          describe: "",
          writes: false,
          args: {},
          run: async () => {
            ran += 1;
            return { fields: {} };
          },
        },
      ],
      pass: pass({ tools: ["read-case"] }),
      record,
      redact: (value) => value,
      stepTimeoutMs: 1_000,
      recorded,
    });
    const reply = await gateway.call("read-case", {});
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.reply).toEqual({ fields: { customer: "Recorded" } });
    expect(ran).toBe(0);
  });
});

describe("tools generated from org config", () => {
  it("adds a tool per configured Integration — no code written", () => {
    const generated = toolsFromOrgConfig(
      {
        org: "seko",
        queue: "booking",
        fields: [{ key: "bookingRef", label: "Booking reference", type: "text", options: [] }],
        engines: { rules: false, validation: true, extraction: false, integration: false },
        integrations: [
          { name: "carrier-schedules", label: "Look up the carrier's schedules", describe: "", writes: false, args: {} },
        ],
      },
      {
        readCase: async () => ({}),
        writeFields: async () => ({}),
        checkValidation: async () => ({ passed: true }),
        callIntegration: async () => ({}),
      },
    );
    expect(generated.map((tool) => tool.name)).toEqual([
      "read-case",
      "write-fields",
      "check-validation",
      "carrier-schedules",
    ]);
    for (const tool of generated) expect(tool.label.length).toBeGreaterThan(0);
  });

  it("generates no door for an engine the org has not deployed", () => {
    const generated = toolsFromOrgConfig(
      {
        org: "seko",
        queue: "booking",
        fields: [],
        engines: { rules: false, validation: false, extraction: false, integration: false },
        integrations: [],
      },
      { checkRules: async () => ({}), checkValidation: async () => ({}) },
    );
    expect(generated).toHaveLength(0);
  });
});

describe("MCP over the gateway", () => {
  it("serves the offered tools over a real MCP client, recorded the same way", async () => {
    const { gateway, events } = gatewayWith();
    const { server, exposed } = mcpGateway({
      gateway,
      name: "malkom-gateway",
      version: "1.0.0",
      caseRecord: { taskId: "task-1" },
    });
    expect(exposed).toEqual(["read-case", "write-fields"]);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "agent", version: "1.0.0" });
    await client.connect(clientTransport);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(["read_case", "write_fields"]);

    const result = await client.callTool({ name: "read_case", arguments: { args: {} } });
    const content = result.content as { type: string; text: string }[];
    expect(JSON.parse(content[0]?.text ?? "{}")).toEqual({ fields: { customer: "Mercantile" } });

    // The MCP transport added nothing and hid nothing: the same gateway
    // recorded the call, exactly as an in-process call is recorded.
    expect(events.map((event) => event.type)).toEqual(["tool.called", "tool.replied"]);

    await client.close();
    await server.close();
  });
});
