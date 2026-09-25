import { describe, expect, it } from "vitest";
import { parseManifest, type Manifest, type RunEvent } from "@malkom/agenticai-contract";
import { typescriptAdapter } from "@malkom/agenticai-adapters";
import {
  assemblePack,
  checkAgentFit,
  checkConnection,
  checkPublish,
  nextVersion,
  runSandbox,
  templateCode,
  templateManifest,
  type QueueType,
} from "../src/index.js";

const bookingQueue: QueueType = {
  queue: "booking",
  label: "Booking",
  subQueues: ["new", "amendment"],
  fields: [
    { key: "bookingRef", label: "Booking reference", type: "text" },
    { key: "sailing", label: "Sailing", type: "text" },
    { key: "containerCount", label: "Containers", type: "number" },
    { key: "text", label: "Message", type: "text" },
  ],
  requiredFields: ["bookingRef", "sailing", "containerCount"],
};

describe("start from a template", () => {
  it("creates a working autonomous agent: goal written, connection wired, telemetry on", () => {
    const manifest = templateManifest({
      framework: "typescript",
      queueType: bookingQueue,
      agentId: "rate-lookup",
      agentLabel: "Rate lookup",
    });
    // The manifest is complete and valid on day one.
    expect(parseManifest(manifest).ok).toBe(true);
    expect(manifest.goal.length).toBeGreaterThan(50);
    expect(manifest.telemetry.tracePercent).toBe(100);
    expect(manifest.tools.map((tool) => tool.name)).toContain("read-case");
    expect(manifest.output.map((out) => out.field)).toEqual(bookingQueue.requiredFields);

    const code = templateCode({
      framework: "typescript",
      queueType: bookingQueue,
      agentId: "rate-lookup",
      agentLabel: "Rate lookup",
    });
    expect(code).toContain("manifestAgent(start)");
    expect(code).toContain("export default agent");
  });
});

describe("versions", () => {
  it("numbers publishes forward and never lets a published version change", () => {
    expect(nextVersion([])).toBe("1.0.0");
    expect(nextVersion(["1.0.0", "1.1.0"])).toBe("1.2.0");
    expect(checkPublish(["1.0.0"], "1.1.0").ok).toBe(true);
    const again = checkPublish(["1.0.0"], "1.0.0");
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.problems.join(" ")).toContain("never change");
    expect(checkPublish(["1.1.0"], "1.0.5").ok).toBe(false);
    expect(checkPublish([], "not-a-version").ok).toBe(false);
  });
});

const parsed = (input: Record<string, unknown>): Manifest => {
  const result = parseManifest({
    kind: "malkom.agent-manifest/1",
    version: "1.0.0",
    goal: "Do the work the way an experienced person would, and finish the case.",
    queue: "booking",
    input: ["text"],
    output: [{ field: "bookingRef", minConfidence: 0.8 }],
    tools: [{ name: "read-case", label: "Read the case" }],
    container: { image: "malkom/x:1.0.0", adapter: "typescript" },
    ...input,
  });
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.manifest;
};

describe("the canvas checks", () => {
  const schema = { queue: "booking", fields: bookingQueue.fields };

  it("refuses an agent whose fields are not the org's fields", () => {
    const stranger = parsed({ id: "stranger", label: "Stranger", input: ["nonesuch"] });
    const verdict = checkAgentFit(stranger, schema);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.problems.join(" ")).toContain('"nonesuch"');
  });

  it("refuses a hands-to where a needed field never arrives", () => {
    const first = parsed({ id: "first", label: "First" });
    const second = parsed({
      id: "second",
      label: "Second",
      input: ["rate"],
      output: [{ field: "bookingRef", minConfidence: 0.8 }],
    });
    const verdict = checkConnection({
      upstream: first,
      downstream: second,
      kind: "hands-to",
      upstreamSchema: schema,
      downstreamSchema: schema,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.problems.join(" ")).toContain('"rate"');
  });

  it("refuses a wrong field type immediately, in a plain sentence", () => {
    const amendmentSchema = {
      queue: "booking",
      subQueue: "amendment",
      fields: [
        { key: "containerCount", label: "Containers", type: "text" as const },
        { key: "text", label: "Message", type: "text" as const },
        { key: "bookingRef", label: "Booking reference", type: "text" as const },
      ],
    };
    const first = parsed({ id: "first", label: "First" });
    const second = parsed({
      id: "second",
      label: "Second",
      subQueues: ["amendment"],
      input: ["containerCount"],
    });
    const verdict = checkConnection({
      upstream: first,
      downstream: second,
      kind: "hands-to",
      upstreamSchema: schema,
      downstreamSchema: amendmentSchema,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.problems.join(" ")).toContain('"containerCount" arrives as number but is needed as text');
    }
  });

  it("assembles the drawn pipeline into the same pack the runtime runs", () => {
    const clerk = parsed({ id: "booking-clerk", label: "Booking clerk" });
    const helper = parsed({
      id: "rate-lookup",
      label: "Rate lookup",
      output: [{ field: "sailing", minConfidence: 0.5 }],
    });
    const result = assemblePack(
      {
        queue: "booking",
        agents: [clerk, helper],
        connections: [{ from: "booking-clerk", to: "rate-lookup", kind: "may-call" }],
      },
      { id: "bookings", version: "1.0.0", label: "Bookings pack", generation: 7 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.generation).toBe(7);
  });

  it("lets a sub-queue override the queue's pipeline", () => {
    const clerk = parsed({ id: "amendment-clerk", label: "Amendment clerk", subQueues: ["amendment"] });
    const result = assemblePack(
      { queue: "booking", subQueue: "amendment", agents: [clerk], connections: [] },
      { id: "bookings-amendment", version: "1.0.0", label: "Amendments pack" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.subQueue).toBe("amendment");
  });

  it("refuses a sub-queue override carrying an agent that does not serve it", () => {
    const clerk = parsed({ id: "new-clerk", label: "New bookings clerk", subQueues: ["new"] });
    const result = assemblePack(
      { queue: "booking", subQueue: "amendment", agents: [clerk], connections: [] },
      { id: "bookings-amendment", version: "1.0.0", label: "Amendments pack" },
    );
    expect(result.ok).toBe(false);
  });
});

describe("the sandbox behind the run button", () => {
  it("runs a draft on a sample case, every step live, nothing outside touched", async () => {
    const manifest = parsed({
      id: "sample-agent",
      label: "Sample agent",
      output: [{ field: "bookingRef", minConfidence: 0.5 }],
      tools: [
        { name: "read-case", label: "Read the case" },
        { name: "write-fields", label: "Write fields onto the case" },
      ],
    });

    const live: RunEvent[] = [];
    const { report, caseRecord } = await runSandbox({
      manifest,
      adapter: typescriptAdapter(async (start) => {
        const read = await start.call("read-case", {});
        expect(read.ok).toBe(true);
        await start.call("write-fields", {
          fields: { bookingRef: "BK-1029" },
          confidence: { bookingRef: 0.9 },
        });
        return {
          ending: "done",
          work: { fields: { bookingRef: "BK-1029" }, confidence: { bookingRef: 0.9 }, tried: [], notes: ["All set."] },
        };
      }),
      sampleCase: { label: "a clean booking", fields: { text: "Booking BK-1029 please." } },
      queueType: bookingQueue,
      aiProvider: { provider: "none", model: null, currency: "USD", inputPerMillion: 300, outputPerMillion: 1500 },
      onEvent: (event) => {
        live.push(event);
      },
    });

    expect(report.ending.ending).toBe("done");
    // Every step arrived live, in order, starting with run.started.
    expect(live[0]?.type).toBe("run.started");
    expect(live.at(-1)?.type).toBe("run.ended");
    expect(live.filter((event) => event.type === "tool.called")).toHaveLength(2);
    // The work landed on the sample case, exactly as it would on a real one.
    expect(caseRecord.fields["bookingRef"]).toBe("BK-1029");
    expect(caseRecord.notes.map((note) => note.note)).toContain("All set.");
  });
});
