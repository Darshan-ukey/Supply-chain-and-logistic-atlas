/**
 * @malkom/agenticai-contract — the contract.
 *
 * The manifest format, the run events, the connection, the access pass.
 * Small. Fixed early. This is the only part both sides must agree on:
 * the Command validates manifests with it, the client runtime runs agents
 * and mints access passes with it.
 */

export {
  nameSchema,
  fieldKeySchema,
  versionSchema,
  labelSchema,
} from "./ids.js";

export {
  workSchema,
  emptyWork,
  doneSchema,
  questionSchema,
  handoverSchema,
  wakeSchema,
  parkedSchema,
  endingSchema,
  ENDING_NAMES,
  needsAPerson,
  type Work,
  type Done,
  type Question,
  type Handover,
  type Wake,
  type Parked,
  type Ending,
  type EndingName,
} from "./endings.js";

export {
  failureTypeSchema,
  retrySchema,
  limitsSchema,
  limitsOverrideSchema,
  resolveLimits,
  outputFieldSchema,
  rulesSchema,
  manifestToolSchema,
  telemetrySchema,
  containerSchema,
  manifestSchema,
  parseManifest,
  type FailureType,
  type Retry,
  type Limits,
  type LimitsOverride,
  type OutputField,
  type Rules,
  type ManifestTool,
  type Telemetry,
  type Container,
  type Manifest,
} from "./manifest.js";

export {
  spendSchema,
  zeroSpend,
  runStartedSchema,
  modelRepliedSchema,
  toolCalledSchema,
  toolRepliedSchema,
  notedSchema,
  runRetriedSchema,
  runEndedSchema,
  runEventSchema,
  checkEventLog,
  isEnded,
  spendOf,
  resumePoint,
  recordedToolReplies,
  type Spend,
  type RunEvent,
  type RunEventType,
  type Draft,
  type DraftRunEvent,
} from "./events.js";

export {
  accessPassSchema,
  checkPass,
  explainRefusal,
  type AccessPass,
  type PassRefusal,
} from "./pass.js";

export {
  caseNoteSchema,
  caseRecordSchema,
  writeWork,
  readableCase,
  type CaseNote,
  type CaseRecord,
} from "./record.js";

export {
  connectionKindSchema,
  packConnectionSchema,
  packSchema,
  parsePack,
  packOrder,
  mayCall,
  packFor,
  type ConnectionKind,
  type PackConnection,
  type Pack,
} from "./pack.js";

export {
  type ToolReply,
  type OfferedTool,
  type OrgAiProvider,
  type Start,
} from "./connection.js";

export { engineConfigSchema, engineConfig, type EngineConfig } from "./config.js";

export { AgentFailure, isAgentFailure } from "./failure.js";

export {
  ENDING_SENTENCE,
  timelineLines,
  CONNECTION_WORDS,
  pipelineGraph,
  packGraph,
  type TimelineLine,
  type TimelineOptions,
  type GraphNode,
  type GraphEdge,
  type PipelineGraph,
} from "./presentation.js";
