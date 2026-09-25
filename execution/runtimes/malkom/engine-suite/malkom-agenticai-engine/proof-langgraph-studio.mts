/**
 * Proof: a LangGraph agent built in the studio actually runs.
 *
 * Two Python agents run through the REAL runner + gateway + LangGraph bridge:
 *   1. the exact starter code the studio ships (templateCode, langgraph) — it
 *      delegates to the engine's built-in graph;
 *   2. a hand-written custom run(ctx) that builds its own steps — proving an
 *      edited agent, not just the default, runs.
 * Both must reach the right ending. No engine mocks.
 */
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  manifestSchema,
  type CaseRecord,
  type Manifest,
  type OrgAiProvider,
  type RunEvent,
} from "@malkom/agenticai-contract";
import type { GatewayTool } from "@malkom/agenticai-gateway";
import { AdapterRegistry, langgraphAdapter } from "@malkom/agenticai-adapters";
import { runAgent } from "@malkom/agenticai-runner";
import { templateCode, templateManifest, type QueueType } from "@malkom/agenticai-studio";

const python = process.env["MALKOM_PYTHON"] ?? "python3";
const dir = mkdtempSync(path.join(tmpdir(), "proof-lg-studio-"));

const queueType: QueueType = {
  queue: "booking",
  label: "Booking",
  subQueues: [],
  fields: [
    { key: "reference", label: "Reference", type: "text" },
    { key: "port", label: "Port", type: "text" },
  ],
  requiredFields: ["reference", "port"],
};

const request = { framework: "langgraph" as const, queueType, agentId: "lg-booking", agentLabel: "Booking clerk (LangGraph)" };
const manifest: Manifest = manifestSchema.parse(templateManifest(request));

const aiProvider: OrgAiProvider = { provider: "sandbox", model: null, currency: "USD", inputPerMillion: 300, outputPerMillion: 1500 };

const toolsOver = (store: { fields: Record<string, unknown>; confidence: Record<string, number> }): GatewayTool[] => [
  { name: "read-case", label: "Read the case", describe: "", writes: false, args: { type: "object", properties: {} },
    run: async () => ({ fields: store.fields, confidence: store.confidence, notes: [] }) },
  { name: "write-fields", label: "Write fields", describe: "", writes: true, args: { type: "object", properties: {} },
    run: async (a) => { store.fields = { ...store.fields, ...((a["fields"] ?? {}) as Record<string, unknown>) };
      store.confidence = { ...store.confidence, ...((a["confidence"] ?? {}) as Record<string, number>) }; return { written: true }; } },
  { name: "check-validation", label: "Check valid", describe: "", writes: false, args: { type: "object", properties: {} },
    run: async () => ({ passed: true }) },
];

const caseRecord: CaseRecord = {
  taskId: "task-1", org: "seko", queue: "booking", subQueue: "new",
  fields: { text: "reference: ABC-1234, port: USLAX." }, confidence: {}, notes: [],
};

const runFile = async (label: string, code: string, expect: string): Promise<boolean> => {
  const agentFile = path.join(dir, `${label}.py`);
  writeFileSync(agentFile, code);
  const events: RunEvent[] = [];
  const store = { fields: { text: "reference: ABC-1234, port: USLAX." } as Record<string, unknown>, confidence: {} as Record<string, number> };
  const report = await runAgent(
    { manifest, caseRecord },
    { provider: () => aiProvider, tools: () => toolsOver(store), keep: async (e) => { events.push(e); },
      adapters: new AdapterRegistry().register(langgraphAdapter({ python, agentFile })) },
  );
  const calls = events.filter((e) => e.type === "tool.called").map((e) => (e as { tool: string }).tool);
  const ok = report.ending.ending === expect;
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(18)} → ending=${report.ending.ending.padEnd(9)} toolCalls=[${calls.join(", ")}]`);
  return ok;
};

// 1) The exact code the studio ships for a new LangGraph agent.
const shipped = templateCode(request);

// 2) A hand-written custom graph — the developer edited run(ctx).
const custom = `from malkom_langgraph import run_manifest_agent

def run(ctx):
    case = ctx.call("read-case", {})
    fields = case.get("fields", {}) if isinstance(case, dict) else {}
    text = fields.get("text", "")
    import re
    ref = re.search(r"reference:\\s*([^,\\n]+)", text)
    port = re.search(r"port:\\s*([^,\\n.]+)", text)
    if ref and port:
        settled = {"reference": ref.group(1).strip(), "port": port.group(1).strip()}
        ctx.call("write-fields", {"fields": settled, "confidence": {"reference": 0.95, "port": 0.95}})
        ctx.end(ending="done", fields=settled, confidence={"reference": 0.95, "port": 0.95})
    else:
        ctx.end(ending="handover", whyStopped="Could not read the reference and port.")
`;

const a = await runFile("studio-template", shipped, "done");
const b = await runFile("custom-run-ctx", custom, "done");
console.log("");
console.log(a && b ? "PROOF PASSED ✓  the studio's LangGraph agent — shipped template and edited — runs on the real runner." : "PROOF FAILED ✗");
process.exit(a && b ? 0 : 1);
