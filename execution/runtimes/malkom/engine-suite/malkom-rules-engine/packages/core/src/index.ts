/**
 * @malkom/rules-core — a metadata-aware, embeddable business-rules engine.
 *
 * The facade IS the API: construct a RulesEngine, start() it, applyRegistry(),
 * author groups, and evaluate. The HTTP router and server/CLI shells are thin
 * transports over exactly these exports.
 */

// Engine facade
export {
  RulesEngine,
  ENGINE_NAME,
  ENGINE_VERSION,
  type RulesEngineOptions,
  type EngineEvent,
  type EngineEventType,
  type EngineHooks,
  type ActorOptions,
  type EvaluateApiOptions,
  type TieredValidationResult,
  type GroupQueryCriteria,
} from './engine.js';

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
  scopeSchema,
  scopeTermSchema,
  actionSchema,
  effectTargetSchema,
  ruleSchema,
  hitPolicySchema,
  groupDefinitionSchema,
  instantSchema,
  entityIdSchema,
  scopeFields,
  scopeValueSets,
  inWindow,
  AST_VERSION,
  ENTITY_ID_RE,
  ROW_REF_RE,
  type RegistryDoc,
  type RegistryDocInput,
  type RegistryEntity,
  type RegistryField,
  type ValueSet,
  type Scope,
  type ScopeTerm,
  type Action,
  type ActionVerb,
  type EffectTarget,
  type Rule,
  type HitPolicy,
  type GroupDefinition,
  type GroupDefinitionInput,
} from './config/schemas.js';
export { tableRefSchema, connectionProfileSchema, type TableRef, type ConnectionProfile } from './config/connection.js';

// Validation
export {
  validateRegistryDoc,
  validateGroupDefinition,
  type ValidationIssue,
  type ValidationResult,
  type ValidateGroupOptions,
} from './config/validate.js';
export { jsonSchemas, SCHEMA_VERSION } from './config/jsonschema.js';

// Runtime domain
export { CompiledRegistry, registryHash } from './domain/registry.js';
export type {
  GroupState,
  GroupValidity,
  GroupHead,
  GroupTransition,
  GroupVersionRecord,
  EvaluationMode,
  EvaluationResult,
  AssertionViolation,
  PatchCandidate,
  PatchEntry,
  EffectInstance,
  FieldConflict,
  ConflictKind,
  ConflictResolution,
  GroupTrace,
  RuleTrace,
  GroupSkipReason,
  ApplicableGroup,
  DecisionRecord,
  DecisionCounts,
} from './domain/types.js';
export { GROUP_STATES, emptyDecisionCounts } from './domain/types.js';

// Evaluation core (advanced embedding: bring your own storage)
export { CompiledRuleset, probeKeys, scalarBucketKey, type ActiveGroupInput, type CompiledGroup } from './runtime/compile.js';
export { evaluateRuleset, applicableGroups, resolutionOrder, type EvaluateOptions } from './runtime/evaluate.js';
export {
  touchedFields,
  writtenFields,
  effectTouchedFields,
  scopesMayOverlap,
  scopeAccepts,
  findOverlappingWrites,
  type ConsistencyFinding,
  type AnalyzableGroup,
} from './runtime/analyze.js';
export type { BacktestOptions, BacktestReport, BacktestRowOutcome } from './runtime/backtest.js';

// Ports — implement these to plug in any backend
export type { RulesStateStore, RegistryRecord, GroupHeadFilter, DecisionQuery, DecisionDeleteFilter, RetentionPolicy } from './ports/statestore.js';
export type { SqlClient, SqlIntrospector, ColumnInfo } from './ports/sql.js';
export { systemClock, type Clock } from './ports/clock.js';
export { jsonConsoleLogger, noopLogger, type Logger } from './ports/logger.js';

// State stores
export { InMemoryRulesStateStore } from './state/memory.js';
export { SqliteRulesStateStore } from './state/sqlite.js';

// SQL substrate
export { ConnectionRegistry, type ResolvedConnection, type SecretResolver } from './sql/connections.js';
export { dialectByName, knownDialects, type SqlDialect } from './sql/dialect.js';
export { SqliteSqlClient, createPostgresClient, createMysqlClient } from './sql/clients.js';

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
} from './domain/errors.js';
export { uuidv7 } from './domain/ids.js';

// Observability
export { MetricsRegistry, METRIC } from './metrics/metrics.js';

// HTTP control plane
export { buildFetchHandler, type FetchHandler, type RouterOptions } from './http/router.js';
export { ApiAuth, type AuthKeys, type Scope as AuthScope } from './http/auth.js';
