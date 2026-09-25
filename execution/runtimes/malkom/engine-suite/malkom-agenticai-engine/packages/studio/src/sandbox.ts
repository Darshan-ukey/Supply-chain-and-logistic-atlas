import { randomUUID } from "node:crypto";
import type {
  CaseRecord,
  EngineConfig,
  Manifest,
  OrgAiProvider,
  RunEvent,
} from "@malkom/agenticai-contract";
import { toolsFromOrgConfig, type GatewayHost } from "@malkom/agenticai-gateway";
import { AdapterRegistry, type Adapter } from "@malkom/agenticai-adapters";
import { runAgent, type HostIntegration, type RunReport } from "@malkom/agenticai-runner";
import type { QueueType } from "./template.js";

/**
 * The sandbox behind the run button.
 *
 * One click runs the draft on a sample case. Everything is the real path —
 * the runner, the gateway, the access pass, the event log, the four endings —
 * over an in-memory case that reaches nothing outside the sandbox. Every
 * step and every tool call streams out live, while it runs.
 */

export interface SampleCase {
  readonly label: string;
  readonly subQueue?: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly confidence?: Readonly<Record<string, number>>;
}

export interface SandboxOptions {
  readonly manifest: Manifest;
  /** The draft's code, loaded by the studio host, behind its adapter. */
  readonly adapter: Adapter;
  readonly sampleCase: SampleCase;
  readonly queueType: QueueType;
  readonly aiProvider: OrgAiProvider;
  readonly engineConfig?: EngineConfig;
  /** Every run event, live, while it runs. Awaited — the log is written first. */
  onEvent(event: RunEvent): void | Promise<void>;
}

export interface SandboxReport {
  readonly report: RunReport;
  /** The case as the run left it — fields, confidence numbers, notes. */
  readonly caseRecord: CaseRecord;
}

export const runSandbox = async (options: SandboxOptions): Promise<SandboxReport> => {
  const { manifest, queueType, sampleCase } = options;

  let record: CaseRecord = {
    taskId: `sample-${randomUUID()}`,
    org: "studio-sandbox",
    queue: manifest.queue,
    ...(sampleCase.subQueue !== undefined ? { subQueue: sampleCase.subQueue } : {}),
    fields: { ...sampleCase.fields },
    confidence: { ...(sampleCase.confidence ?? {}) },
    notes: [],
  };

  const host: GatewayHost = {
    readCase: async () => ({
      fields: record.fields,
      confidence: record.confidence,
      notes: record.notes,
    }),
    writeFields: async ({ fields, confidence }) => {
      record = {
        ...record,
        fields: { ...record.fields, ...fields },
        confidence: { ...record.confidence, ...confidence },
      };
      return { written: Object.keys(fields).length };
    },
    checkValidation: async ({ fields }) => {
      const failures = queueType.requiredFields
        .filter((field) => {
          const value = fields[field];
          return value === undefined || value === null || String(value).trim() === "";
        })
        .map((field) => ({ field, rule: "required", message: `${field} is required` }));
      return { passed: failures.length === 0, failures };
    },
  };

  const tools = toolsFromOrgConfig(
    {
      org: "studio-sandbox",
      queue: manifest.queue,
      fields: queueType.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        options: [],
      })),
      engines: { rules: false, validation: true, extraction: false, integration: false },
      integrations: [],
    },
    host,
  );

  // The sandbox is a host like any other — it implements the same integration
  // seam, over an in-memory case and the one draft adapter. The engine cannot
  // tell it apart from the real runtime, which is the point.
  const integration: HostIntegration = {
    provider: () => options.aiProvider,
    tools: () => tools,
    keep: (event) => options.onEvent(event),
    adapters: new AdapterRegistry().register(options.adapter),
  };

  const report = await runAgent(
    {
      manifest,
      caseRecord: record,
      ...(options.engineConfig !== undefined ? { engineConfig: options.engineConfig } : {}),
    },
    integration,
  );

  // The ending's work lands on the sample case exactly as it would land on a
  // real one, so the studio shows what a person or the next agent would see.
  record = {
    ...record,
    fields: { ...record.fields, ...report.ending.work.fields },
    confidence: { ...record.confidence, ...report.ending.work.confidence },
    notes: [
      ...record.notes,
      ...report.ending.work.notes.map((note) => ({
        agent: manifest.id,
        at: new Date().toISOString(),
        note,
      })),
    ],
  };

  return { report, caseRecord: record };
};
