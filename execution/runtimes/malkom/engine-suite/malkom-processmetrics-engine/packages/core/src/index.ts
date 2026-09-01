/**
 * @malkom/metrics-core — a metadata-aware, embeddable process-metrics & KPI
 * engine.
 *
 * M0 exports the substrate: the condition language, the entity registry, the
 * SQL and state-store ports, and the operational telemetry. M1 adds the
 * authoring models (definitions, calendars, assignments) with tier-1
 * validation; M2 adds the pure calculation core (business time, window
 * resolution, compiled metrics, evaluation). M3 adds engine-wide
 * configurability (EngineDefaults), fact access (FactSourcePort + the SQL
 * fetch path), on-demand calculation and backtests, and tier-2 live schema
 * validation. M4 adds governance and persistence: the definition lifecycle
 * with immutable versions, points + runs stores with retention, the croner
 * rollup scheduler, persisting backfills, and host hooks/events. The engine
 * facade arrives in M5; the HTTP router and server/CLI shells are thin
 * transports over exactly these exports.
 */

// Condition language
export {
  evaluateFilter,
  filterFields,
  filterValueSets,
  filterExprSchema,
  scalarSchema,
  identifierSchema,
  valueSetRefSchema,
  scalarEquals,
  compileRegex,
  IDENTIFIER_RE,
  VALUE_SET_REF_RE,
  REGEX_PATTERN_MAX,
  type FilterExpr,
  type FilterContext,
  type Scalar,
  type ComparisonOp,
} from './domain/filter.js';

// Configuration schemas — zod is the single source of truth
export {
  registryDocSchema,
  registryEntitySchema,
  registryFieldSchema,
  valueSetSchema,
  entityIdSchema,
  ENTITY_ID_RE,
  type RegistryDoc,
  type RegistryDocInput,
  type RegistryEntity,
  type RegistryField,
  type ValueSet,
} from './config/schemas.js';
export { tableRefSchema, connectionProfileSchema, type TableRef, type ConnectionProfile } from './config/connection.js';

// Engine defaults — every behavioral knob, declared and validated in ONE place
export {
  engineDefaultsSchema,
  resolveDefaults,
  ENGINE_DEFAULTS,
  UNIT_DEFAULTS,
  WEEKDAYS,
  dstAmbiguitySchema,
  DST_AMBIGUITY_DEFAULT,
  percentileMethodSchema,
  rollupCronsSchema,
  schedulerDefaultsSchema,
  runRetentionSchema,
  type EngineDefaults,
  type EngineDefaultsInput,
  type DstAmbiguity,
  type PercentileMethod,
  type RollupCrons,
  type SchedulerDefaults,
  type RunRetention,
} from './config/defaults.js';

// Authoring schemas — metric definitions, calendars, assignments
export {
  slugSchema,
  instantSchema,
  hhmmSchema,
  HHMM_RE,
  calendarDateSchema,
  metricKindSchema,
  metricTypeSchema,
  aggFnSchema,
  aggSpecSchema,
  formulaSchema,
  metricAnchorSchema,
  metricOptionsSchema,
  windowAlignmentSchema,
  windowSchema,
  thresholdsSchema,
  targetSchema,
  deriveSpecSchema,
  exclusionSchema,
  metricDefinitionSchema,
  weekdaySchema,
  timezoneSchema,
  calendarSchema,
  assignmentScopeValueSchema,
  targetOverrideSchema,
  assignmentSchema,
  type MetricKind,
  type MetricType,
  type AggFn,
  type AggSpec,
  type MetricFormula,
  type MetricAnchor,
  type MetricOptions,
  type WindowAlignment,
  type MetricWindow,
  type Thresholds,
  type MetricTarget,
  type DeriveSpec,
  type MetricExclusion,
  type MetricDefinition,
  type MetricDefinitionInput,
  type Weekday,
  type Calendar,
  type CalendarInput,
  type AssignmentScopeValue,
  type TargetOverride,
  type Assignment,
  type AssignmentInput,
} from './config/schemas.js';

// Validation — tier 1 (static) and tier 2 (live schema)
export {
  validateRegistryDoc,
  validateMetricDefinition,
  validateAssignment,
  validateMetricLive,
  referencedFieldsBySource,
  type LiveSchemaAccess,
  type MetricIssueCode,
  type ValidationIssue,
  type ValidationResult,
} from './config/validate.js';
export { jsonSchemas, SCHEMA_VERSION } from './config/jsonschema.js';

// Runtime domain
export { CompiledRegistry, registryHash, contentHash } from './domain/registry.js';

// Calculation core — pure, deterministic, replayable (M2)
export {
  compileCalendar,
  CompiledCalendar,
  wallClockAt,
  wallTimeToInstant,
  MAX_SPAN_DAYS,
  type CompileCalendarOptions,
  type WallClock,
} from './runtime/calendar.js';
export { resolveWindow } from './runtime/window.js';
export {
  compileMetric,
  effectiveTarget,
  type CompiledMetric,
  type CompiledAggregate,
  type CompiledDerivedField,
  type CompiledExclusion,
} from './runtime/compile.js';
export { evaluateMetric, statusForValue, type EvaluateContext, type MetricFacts } from './runtime/evaluate.js';
export type {
  ResolvedWindow,
  WindowGrain,
  MetricStatus,
  MetricResult,
  MetricTrace,
  AggregateTrace,
  AggregateRole,
  FetchTrace,
} from './domain/types.js';

// Fact access — how the engine reads host rows (M3)
export { MemoryFactSource, type FactQuery, type FactSourcePort } from './ports/factsource.js';
export { buildFactSelect, SqlFactSource, dialectIntrospector, type FactSelect } from './sql/factfetch.js';

// Calculation orchestration — on-demand points and backtests (M3)
export {
  calculateMetric,
  backtestMetric,
  backtestWindows,
  calendarFor,
  type CalculateInput,
  type BacktestInput,
  type FactsAccess,
} from './runtime/calculate.js';

// Lifecycle & governance (M4) — the rules engine's state machine, ported
export {
  submitDefinition,
  rejectDefinition,
  activateDefinition,
  retireDefinition,
  revalidationSweep,
  type LifecycleOptions,
  type SweepInput,
  type SweepEntry,
} from './runtime/lifecycle.js';

// Materialization & scheduling (M4) — persisted points, rollups, backfills
export {
  materializeWindow,
  WriteAbortedError,
  type MaterializeInput,
  type MaterializeOutcome,
} from './runtime/materialize.js';
export {
  RollupScheduler,
  previousWindow,
  rollupLeaseKey,
  weekCronFor,
  type RollupSchedulerOptions,
  type RollupJob,
} from './runtime/scheduler.js';
export { backfillMetric, BACKFILL_TRIGGER, type BackfillInput } from './runtime/backfill.js';

// Hooks & events (M4) — the host wires alerting/approvals here
export {
  fireEvent,
  fireError,
  type EngineHooks,
  type EngineEvent,
  type EngineEventType,
  type EngineErrorContext,
  type DefinitionEventBase,
  type MetricEventBase,
} from './ports/hooks.js';

// Ports — implement these to plug in any backend
export { DEFINITION_STATES } from './ports/statestore.js';
export type {
  MetricsStateStore,
  RegistryRecord,
  CalendarRecord,
  DefinitionRecord,
  DefinitionState,
  DefinitionTransition,
  DefinitionVersionRecord,
  DefinitionVersionAppend,
  ValidationStatus,
  AssignmentRecord,
  AssignmentFilter,
  MetricPointRecord,
  MetricPointUpsert,
  PointUpsertResult,
  PointQuery,
  PointDeleteFilter,
  MetricRunRecord,
  RunQuery,
  RunTrigger,
  RunStatus,
} from './ports/statestore.js';
export type { SqlClient, SqlIntrospector, ColumnInfo } from './ports/sql.js';
export { systemClock, type Clock } from './ports/clock.js';
export { jsonConsoleLogger, noopLogger, type Logger } from './ports/logger.js';

// State stores
export { InMemoryMetricsStateStore } from './state/memory.js';
export { SqliteMetricsStateStore } from './state/sqlite.js';

// SQL substrate
export { ConnectionRegistry, type ResolvedConnection, type SecretResolver } from './sql/connections.js';
export { dialectByName, knownDialects, type SqlDialect } from './sql/dialect.js';
export {
  SqliteSqlClient,
  createPostgresClient,
  createMysqlClient,
  type DriverClientOptions,
  type ModuleImporter,
} from './sql/clients.js';

// Errors
export {
  MalkomError,
  ConfigInvalidError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  AdapterError,
  StateStoreError,
  UnsupportedError,
  looksLikeSchemaError,
  type MalkomErrorCode,
  type ErrorIssue,
} from './domain/errors.js';
export { uuidv7 } from './domain/ids.js';

// Observability (the engine's own counters — the business domain is "metrics")
export { TelemetryRegistry, TELEMETRY } from './telemetry/telemetry.js';

// The engine facade (M5) — the whole embedding story
export {
  MetricsEngine,
  ENGINE_NAME,
  ENGINE_VERSION,
  type MetricsEngineOptions,
  type StateOption,
  type AuthKeysInput,
  type SchedulerOptionsInput,
  type ActorOptions,
  type ValidateMetricOptions,
  type TieredValidationResult,
  type CalculateApiInput,
  type SnapshotApiInput,
  type SnapshotMode,
  type SnapshotEntry,
  type SeriesApiInput,
  type BacktestApiInput,
  type BackfillApiInput,
  type BackfillReport,
} from './engine.js';

// HTTP control plane
export { ApiAuth, type AuthKeys, type Scope as AuthScope } from './http/auth.js';
export { buildFetchHandler, type FetchHandler } from './http/router.js';
