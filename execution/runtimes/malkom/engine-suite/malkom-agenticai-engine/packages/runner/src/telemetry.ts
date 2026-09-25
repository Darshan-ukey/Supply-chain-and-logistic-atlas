import { SpanStatusCode, trace, type Span, type Tracer } from "@opentelemetry/api";
import type { CaseRecord, Ending, Manifest, RunEvent, Spend } from "@malkom/agenticai-contract";

/**
 * Telemetry — on by default, produced by the engine itself. The agent
 * developer cannot forget it or turn it off. The manifest only adds extra
 * fields and redaction rules on top.
 *
 * OpenTelemetry, against the global provider: the host chooses the exporter
 * and the sampler; the engine only emits. Values from the case never become
 * span attributes unless the manifest's telemetry.extraFields names them, and
 * never when the manifest redacts them.
 */

export const OTEL_ATTRIBUTES = {
  runId: "malkom.agenticai.run.id",
  agentId: "malkom.agenticai.agent.id",
  agentVersion: "malkom.agenticai.agent.version",
  org: "malkom.agenticai.org",
  taskId: "malkom.agenticai.task.id",
  queue: "malkom.agenticai.queue",
  subQueue: "malkom.agenticai.sub_queue",
  shadow: "malkom.agenticai.shadow",
  ending: "malkom.agenticai.ending",
  money: "malkom.agenticai.spend.money",
  tokensIn: "malkom.agenticai.spend.tokens_in",
  tokensOut: "malkom.agenticai.spend.tokens_out",
  toolCalls: "malkom.agenticai.spend.tool_calls",
  elapsedMs: "malkom.agenticai.spend.elapsed_ms",
  attempts: "malkom.agenticai.attempts",
  tool: "malkom.agenticai.tool",
  extraField: (field: string): string => `malkom.agenticai.field.${field}`,
} as const;

export const tracerFor = (): Tracer => trace.getTracer("malkom-agenticai-engine", "0.1.0");

export const startRunSpan = (
  tracer: Tracer,
  options: {
    runId: string;
    manifest: Manifest;
    caseRecord: CaseRecord;
    shadow: boolean;
  },
): Span => {
  const span = tracer.startSpan(`agent ${options.manifest.id}`, {
    attributes: {
      [OTEL_ATTRIBUTES.runId]: options.runId,
      [OTEL_ATTRIBUTES.agentId]: options.manifest.id,
      [OTEL_ATTRIBUTES.agentVersion]: options.manifest.version,
      [OTEL_ATTRIBUTES.org]: options.caseRecord.org,
      [OTEL_ATTRIBUTES.taskId]: options.caseRecord.taskId,
      [OTEL_ATTRIBUTES.queue]: options.caseRecord.queue,
      ...(options.caseRecord.subQueue !== undefined
        ? { [OTEL_ATTRIBUTES.subQueue]: options.caseRecord.subQueue }
        : {}),
      [OTEL_ATTRIBUTES.shadow]: options.shadow,
    },
  });

  // The manifest's extra fields, minus anything it redacts. Only these case
  // values ever reach a span.
  const redacted = new Set(options.manifest.telemetry.redact);
  for (const field of options.manifest.telemetry.extraFields) {
    if (redacted.has(field)) continue;
    const value = options.caseRecord.fields[field];
    if (value === undefined || value === null) continue;
    span.setAttribute(OTEL_ATTRIBUTES.extraField(field), String(value));
  }
  return span;
};

/** Every run event becomes a span event, so a trace can be read as a timeline. */
export const recordEventOnSpan = (span: Span, event: RunEvent): void => {
  switch (event.type) {
    case "tool.called":
      span.addEvent("tool.called", { [OTEL_ATTRIBUTES.tool]: event.tool }, new Date(event.at));
      break;
    case "tool.replied":
      span.addEvent(
        "tool.replied",
        {
          [OTEL_ATTRIBUTES.tool]: event.tool,
          "malkom.agenticai.ok": event.ok,
          "malkom.agenticai.elapsed_ms": event.elapsedMs,
        },
        new Date(event.at),
      );
      break;
    case "model.replied":
      span.addEvent(
        "model.replied",
        {
          [OTEL_ATTRIBUTES.tokensIn]: event.tokensIn,
          [OTEL_ATTRIBUTES.tokensOut]: event.tokensOut,
          [OTEL_ATTRIBUTES.money]: event.money,
        },
        new Date(event.at),
      );
      break;
    case "noted":
      span.addEvent("noted", { "malkom.agenticai.note": event.note }, new Date(event.at));
      break;
    case "run.retried":
      span.addEvent(
        "run.retried",
        { "malkom.agenticai.failure": event.failure, [OTEL_ATTRIBUTES.attempts]: event.attempt },
        new Date(event.at),
      );
      break;
    case "run.started":
    case "run.ended":
      break;
  }
};

export const closeRunSpan = (span: Span, ending: Ending, spend: Spend, attempts: number): void => {
  span.setAttribute(OTEL_ATTRIBUTES.ending, ending.ending);
  span.setAttribute(OTEL_ATTRIBUTES.money, spend.money);
  span.setAttribute(OTEL_ATTRIBUTES.tokensIn, spend.tokensIn);
  span.setAttribute(OTEL_ATTRIBUTES.tokensOut, spend.tokensOut);
  span.setAttribute(OTEL_ATTRIBUTES.toolCalls, spend.toolCalls);
  span.setAttribute(OTEL_ATTRIBUTES.elapsedMs, spend.elapsedMs);
  span.setAttribute(OTEL_ATTRIBUTES.attempts, attempts);
  // handover is the one ending that is a failure from the queue's point of
  // view; the other three are the system working as designed.
  span.setStatus(
    ending.ending === "handover"
      ? { code: SpanStatusCode.ERROR, message: ending.whyStopped }
      : { code: SpanStatusCode.OK },
  );
  span.end();
};

/**
 * Whether this run keeps a full trace, per the manifest's tracePercent.
 * Deterministic on the run id — never random, which would break replay.
 */
export const keepsFullTrace = (runId: string, tracePercent: number): boolean => {
  if (tracePercent >= 100) return true;
  if (tracePercent <= 0) return false;
  let hash = 0;
  for (let index = 0; index < runId.length; index += 1) {
    hash = (hash * 31 + runId.charCodeAt(index)) >>> 0;
  }
  return hash % 100 < tracePercent;
};
