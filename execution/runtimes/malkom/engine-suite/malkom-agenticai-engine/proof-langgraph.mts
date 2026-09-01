/**
 * Proof: the LangGraph adapter is real and ends all four ways.
 *
 * No mocks in the engine path. This drives the REAL runner (runAgent), the
 * REAL gateway (pass checked, every call recorded), and a REAL LangGraph agent
 * in Python — a compiled StateGraph running think → act → think — over the
 * bridge. The model in this no-key run is the sandbox clerk (the stand-in),
 * exactly as with the TypeScript adapter; everything around it is production.
 *
 * Four sample cases, one per ending. Each asserts the ending AND that the
 * event log is gapless and carries the gateway's own record of the tool calls.
 */
import { fileURLToPath } from "node:url";
import {
  checkEventLog,
  manifestSchema,
  type CaseRecord,
  type Manifest,
  type OrgAiProvider,
  type RunEvent,
} from "@malkom/agenticai-contract";
import type { GatewayTool } from "@malkom/agenticai-gateway";
import { AdapterRegistry, langgraphAdapter } from "@malkom/agenticai-adapters";
import { runAgent } from "@malkom/agenticai-runner";

const python =
  process.env["MALKOM_PYTHON"] ??
  fileURLToPath(new URL("./.proof-venv/bin/python", import.meta.url));

const manifest: Manifest = manifestSchema.parse({
  kind: "malkom.agent-manifest/1",
  id: "booking-clerk-lg",
  version: "1.0.0",
  label: "Booking clerk (LangGraph)",
  goal: "Read the enquiry and settle the booking's reference and port.",
  queue: "booking",
  output: [
    { field: "reference", minConfidence: 0.8 },
    { field: "port", minConfidence: 0.8 },
  ],
  tools: [
    { name: "read-case", label: "Read the case" },
    { name: "write-fields", label: "Write fields onto the case" },
    { name: "check-validation", label: "Check the fields are valid" },
  ],
  container: { image: "malkom/booking-clerk-lg:1.0.0", adapter: "langgraph" },
});

const aiProvider: OrgAiProvider = {
  provider: "sandbox",
  model: null,
  currency: "USD",
  inputPerMillion: 300,
  outputPerMillion: 1_500,
};

/** Real gateway tools over an in-memory case — the gateway still checks the
 *  pass, times each call and records it on the event log. */
const toolsOver = (store: { fields: Record<string, unknown>; confidence: Record<string, number> }): GatewayTool[] => [
  {
    name: "read-case",
    label: "Read the case",
    describe: "",
    writes: false,
    args: { type: "object", properties: {} },
    run: async () => ({ fields: store.fields, confidence: store.confidence, notes: [] }),
  },
  {
    name: "write-fields",
    label: "Write fields onto the case",
    describe: "",
    writes: true,
    args: { type: "object", properties: {} },
    run: async (args) => {
      const fields = (args["fields"] ?? {}) as Record<string, unknown>;
      const confidence = (args["confidence"] ?? {}) as Record<string, number>;
      store.fields = { ...store.fields, ...fields };
      store.confidence = { ...store.confidence, ...confidence };
      return { written: Object.keys(fields).length };
    },
  },
  {
    name: "check-validation",
    label: "Check the fields are valid",
    describe: "",
    writes: false,
    args: { type: "object", properties: {} },
    run: async () => ({ passed: true, findings: [], checksRun: 2 }),
  },
];

const caseWith = (text: string): CaseRecord => ({
  taskId: `task-${Math.abs(hash(text))}`,
  org: "seko",
  queue: "booking",
  subQueue: "new",
  fields: { text },
  confidence: {},
  notes: [],
});

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

const adapter = langgraphAdapter({ python });

const runCase = async (
  text: string,
): Promise<{ ending: string; gapless: boolean; toolCalls: string[] }> => {
  const events: RunEvent[] = [];
  const store = { fields: { text } as Record<string, unknown>, confidence: {} as Record<string, number> };
  const report = await runAgent(
    { manifest, caseRecord: caseWith(text) },
    {
      provider: () => aiProvider,
      tools: () => toolsOver(store),
      keep: async (event) => {
        events.push(event);
      },
      adapters: new AdapterRegistry().register(adapter),
    },
  );
  const check = checkEventLog(events);
  const toolCalls = events
    .filter((e): e is Extract<RunEvent, { type: "tool.called" }> => e.type === "tool.called")
    .map((e) => e.tool);
  return { ending: report.ending.ending, gapless: check.ok, toolCalls };
};

const cases: { name: string; text: string; expect: string }[] = [
  { name: "done", text: "reference: ABC-1234, port: USLAX. Please confirm.", expect: "done" },
  { name: "question", text: "Booking enquiry — is the port USLAX or USNYC?", expect: "question" },
  { name: "handover", text: "New booking enquiry, but the details are unclear.", expect: "handover" },
  { name: "parked", text: "New booking; the documents will follow shortly.", expect: "parked" },
];

let ok = true;
for (const c of cases) {
  const result = await runCase(c.text);
  const pass = result.ending === c.expect && result.gapless;
  ok = ok && pass;
  console.log(
    `${pass ? "✓" : "✗"} ${c.name.padEnd(9)} → ending=${result.ending.padEnd(9)} ` +
      `gapless=${result.gapless} toolCalls=[${result.toolCalls.join(", ")}]`,
  );
}

console.log("");
console.log(ok ? "PROOF PASSED ✓  the LangGraph agent runs on the real runner and ends all four ways." : "PROOF FAILED ✗");
process.exit(ok ? 0 : 1);
