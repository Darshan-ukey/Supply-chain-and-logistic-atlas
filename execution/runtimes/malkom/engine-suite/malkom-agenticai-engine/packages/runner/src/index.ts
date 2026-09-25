/**
 * @malkom/agenticai-runner — the runner.
 *
 * Runs pipelines and agents: retries, timeouts, resume, park, spend limits.
 * Telemetry is produced here, by the engine itself — it cannot be forgotten
 * or turned off.
 */

export {
  runAgent,
  type HostIntegration,
  type RunRequest,
  type RunReport,
} from "./runner.js";
export {
  runPipeline,
  PipelineRefused,
  type PipelineRequest,
  type PipelineReport,
} from "./pipeline.js";
export {
  OTEL_ATTRIBUTES,
  tracerFor,
  startRunSpan,
  recordEventOnSpan,
  closeRunSpan,
  keepsFullTrace,
} from "./telemetry.js";
