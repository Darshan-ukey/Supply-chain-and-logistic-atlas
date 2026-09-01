/**
 * @malkom/alloc-core — a generic, metadata-driven work allocation engine.
 *
 * The engine owns DECISIONS, never data: work items and users live in the
 * host's tables under the host's schema; everything the engine knows about a
 * backend arrives as declarative, validated configuration.
 */

// Engine facade
export { AllocationEngine, ENGINE_NAME, ENGINE_VERSION } from './engine.js';
export type { EngineOptions, QueueStatus, ScheduleView, AllocationView } from './engine.js';

// Control plane
export { buildFetchHandler } from './http/router.js';
export { ApiAuth } from './http/auth.js';
export type { AuthKeys, Scope } from './http/auth.js';

// Configuration schemas + types (zod is the single source of truth)
export {
  configBundleSchema,
  connectionProfileSchema,
  queueDefinitionSchema,
  workSourceBindingSchema,
  workerSourceBindingSchema,
  scheduleSchema,
  strategySpecSchema,
  matchingRuleSchema,
  isAdapterRef,
} from './config/schemas.js';
export type {
  ConfigBundle,
  ConnectionProfile,
  QueueDefinition,
  QueueDefinitionInput,
  WorkSourceBinding,
  WorkerSourceBinding,
  Schedule,
  StrategySpec,
  MatchingRule,
  TableRef,
  OrderingTerm,
  AdapterRef,
} from './config/schemas.js';
export { validateQueueDefinition } from './config/validate.js';
export type { ValidationResult } from './config/validate.js';
export { jsonSchemas, SCHEMA_VERSION } from './config/jsonschema.js';

// Filter AST
export { evaluateFilter, filterColumns, filterExprSchema, identifierSchema } from './domain/filter.js';
export type { FilterExpr, Scalar, ComparisonOp } from './domain/filter.js';

// Domain types
export { freeCapacity, emptyCounts } from './domain/types.js';
export type {
  WorkItem,
  Worker,
  Assignment,
  AssignResult,
  AllocationRunRecord,
  RunAssignmentRecord,
  RunCounts,
  RunStatus,
  RunTrigger,
  AssignmentOutcome,
} from './domain/types.js';
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
} from './domain/errors.js';
export { uuidv7 } from './domain/ids.js';

// Ports — implement these to plug in any backend
export type { BackendAdapter, WorkSourcePort, WorkerSourcePort, AssignerPort, QueueRuntimeRef } from './ports/adapter.js';
export type {
  StateStore,
  LeaseGrant,
  RunListFilter,
  RunDeleteFilter,
  RetentionPolicy,
  RunsSummary,
  RunsSummaryFilter,
  QueueRunsSummary,
} from './ports/statestore.js';
export type { SqlClient, SqlIntrospector, ColumnInfo } from './ports/sql.js';
export type { Clock } from './ports/clock.js';
export { systemClock } from './ports/clock.js';
export type { Logger } from './ports/logger.js';
export { jsonConsoleLogger, noopLogger } from './ports/logger.js';

// Strategies
export type { AllocationStrategy, StrategyInput, StrategyResult, EligibilityMap } from './strategies/types.js';
export { fifoStrategy, roundRobinStrategy, leastActiveStrategy } from './strategies/builtins.js';
export type { RoundRobinState } from './strategies/builtins.js';
export { StrategyRegistry } from './strategies/registry.js';
export { computeEligibility } from './runtime/eligibility.js';
export type { EligibilityResult } from './runtime/eligibility.js';
export type { EngineHooks } from './runtime/pipeline.js';

// State stores
export { InMemoryStateStore } from './state/memory.js';
export { SqliteStateStore } from './state/sqlite.js';

// SQL layer
export { SqlBindingAdapter } from './sql/binding-adapter.js';
export { ConnectionRegistry } from './sql/connections.js';
export type { ResolvedConnection, SecretResolver } from './sql/connections.js';
export { SqliteSqlClient, createPostgresClient, createMysqlClient } from './sql/clients.js';
export { sqliteDialect, postgresDialect, mysqlDialect, dialectByName, knownDialects } from './sql/dialect.js';
export type { SqlDialect } from './sql/dialect.js';
export {
  buildCandidateSelect,
  buildClaimUpdate,
  buildReleaseUpdate,
  buildWorkersSelect,
  buildLoadSelect,
} from './sql/compiler.js';
export type { CompiledSql } from './sql/compiler.js';

// First-party adapters
export { MemoryBackendAdapter } from './adapters/memory.js';

// Default workEvents convention (optional batteries-included work table)
export {
  WORK_EVENTS_TABLE,
  workEventsStatements,
  workEventsBinding,
  workEventsOpenLoad,
} from './defaults/work-events.js';
export type { WorkEventsTableOptions, WorkEventsBindingOptions } from './defaults/work-events.js';
export { checkWorkEventsCoverage } from './defaults/coverage.js';
export type { CoverageOptions, CoverageReport, UncoveredCombo } from './defaults/coverage.js';

// Metrics
export { MetricsRegistry } from './metrics/metrics.js';
