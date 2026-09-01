/**
 * @malkom/mining-core — public surface.
 *
 * The engine binds the host's own tables, declares what each column MEANS
 * rather than assuming any column name, and refuses to produce a perspective
 * the bound data cannot support.
 */

// --- domain ---------------------------------------------------------------
export {
  AdapterError,
  ConfigInvalidError,
  ConflictError,
  CoverageMissError,
  ForbiddenError,
  MalkomError,
  NotFoundError,
  PerspectiveUnavailableError,
  StoreError,
  UnauthorizedError,
  UnsupportedError,
  looksLikeSchemaError,
  type ErrorIssue,
  type MalkomErrorCode,
} from './domain/errors.js';

export {
  IDENTIFIER_RE,
  REGISTRY_ID_RE,
  countOf,
  identifierSchema,
  instantMsOf,
  numberOrNull,
  registryIdSchema,
  scalarSchema,
  type Scalar,
} from './domain/identifiers.js';

// --- ports ----------------------------------------------------------------
export { FixedClock, systemClock, type Clock } from './ports/clock.js';
export { jsonConsoleLogger, noopLogger, type Logger } from './ports/logger.js';
export type { ColumnInfo, SqlClient, SqlIntrospector } from './ports/sql.js';

// --- configuration --------------------------------------------------------
export {
  analyticsStoreSchema,
  connectionProfileSchema,
  tableRefSchema,
  type AnalyticsStoreConfig,
  type ConnectionProfile,
  type CredentialSources,
  type SecretResolver,
  type TableRef,
} from './config/connection.js';

export {
  COLUMN_REF_RE,
  baseAlias,
  columnRefSchema,
  isSingleTable,
  joinKeySchema,
  joinTypeSchema,
  joinedTableSchema,
  parseColumnRef,
  relationAliases,
  relationInputSchema,
  relationSchema,
  type ColumnRef,
  type JoinKey,
  type JoinType,
  type JoinedTable,
  type Relation,
} from './config/relation.js';

export {
  activityClassifierSchema,
  attributeSchema,
  coverageRecordSchema,
  eventsPerRow,
  filterColumns,
  filterExprSchema,
  grainSchema,
  grainYieldsSteps,
  objectLinkSchema,
  rolesSchema,
  sourceBindingSchema,
  streamDefinitionSchema,
  streamFileOriginSchema,
  streamFiltersSchema,
  timeWindowSchema,
  timestampRefSchema,
  type ActivityClassifier,
  type Attribute,
  type CoverageRecord,
  type FilterExpr,
  type Grain,
  type ObjectLink,
  type Roles,
  type SourceBinding,
  type StreamDefinition,
  type StreamDefinitionInput,
  type StreamFileOrigin,
  type StreamFilters,
  type TimeWindow,
  type TimestampRef,
} from './config/schemas.js';

export {
  assertValid,
  bindingColumns,
  canonicalJson,
  referencedColumns,
  filterFingerprint,
  isValid,
  streamFilterColumns,
  validateBinding,
  validateStream,
  type StreamValidationResult,
  type ValidationResult,
} from './config/validate.js';

// --- SQL ------------------------------------------------------------------
export {
  ParamBuilder,
  activityExpr,
  andAll,
  caseKeyExpr,
  compileFilter,
  eventTimestamps,
  fromClause,
  quoteColumn,
  timestampExpr,
  whereClause,
  type CompiledSql,
} from './sql/compile.js';

export {
  dialectByName,
  duckdbDialect,
  knownDialects,
  postgresDialect,
  requireDialect,
  type SqlDialect,
} from './sql/dialect.js';

export {
  createDuckDBClient,
  createPostgresClient,
  wrapDuckDBConnection,
  type DriverClientOptions,
  type DuckDBClientOptions,
  type DuckDBConnectionLike,
  type DuckDBInstanceLike,
  type ModuleImporter,
} from './sql/clients.js';

export {
  fromPgPool,
  fromPrisma,
  fromQueryFunction,
  hostRequirements,
  type HostRequirement,
  type PgClientLike,
  type PrismaLike,
} from './sql/host-adapters.js';

export {
  ConnectionRegistry,
  type ConnectionRegistryOptions,
  type ResolvedConnection,
} from './sql/connections.js';

// --- runtime --------------------------------------------------------------
export {
  profileBinding,
  profileIsUsable,
  type BindingProfile,
  type FindingSeverity,
  type ProfileFinding,
  type ProfileOptions,
  type RoleCoverage,
} from './runtime/profile.js';

export {
  coverageExtent,
  coveredMs,
  driftWindow,
  extendCoverage,
  intersectWindows,
  normaliseWindows,
  planReuse,
  subtractWindows,
  trimCoverage,
  type ReusePlan,
  type ReusePlanKind,
} from './runtime/coverage.js';

export {
  CASE_ATTRS_TABLE,
  EVENTS_TABLE,
  EVENT_OBJECTS_TABLE,
  availableCaseAttributes,
  availableObjectTypes,
  detectCapabilities,
  deleteWindow,
  dropEventLog,
  ensureEventLog,
  eventLogStatements,
  eventLogTables,
  insertCaseAttributes,
  insertEventObjects,
  insertEvents,
  projectedLogSql,
  eventOrderBy,
  perspectiveExpr,
  UNKNOWN_LABEL,
  type CanonicalCaseAttribute,
  type CanonicalEvent,
  type CanonicalEventObject,
  type EventLogTables,
  type LogCapabilities,
  type Perspective,
} from './runtime/eventlog.js';

export {
  DfgView,
  abstractNodes,
  buildDfg,
  filterEdges,
  groupRareActivities,
  type ActivityGroup,
  type ActivityStats,
  type Dfg,
  type DfgEdge,
  type DfgOptions,
  type NodeAbstractionOptions,
  type NodeGroupingOptions,
} from './runtime/dfg.js';

export { summariseLog, type LogSummary } from './runtime/summary.js';

export {
  discoverSchema,
  kindOf,
  suggestBindings,
  type BindingSuggestion,
  type ColumnKind,
  type DiscoverSchemaOptions,
  type DiscoveredColumn,
  type DiscoveredTable,
  type ForeignKey,
  type RoleGuess,
  type SchemaMap,
} from './runtime/discover-schema.js';

export {
  STREAMS_TABLE,
  deleteStream,
  ensureStreamRegistry,
  findStream,
  getStream,
  listStreams,
  saveStream,
  saveStreamCoverage,
  streamTableStatements,
  summarise as summariseStream,
  type SaveStreamInput,
  type StoredStream,
  type StreamSummary,
} from './runtime/streams.js';

export {
  reconcileTargets,
  type Comparator,
  type DeclaredTarget,
  type TargetCheck,
  type TargetMetric,
  type TargetOptions,
  type TargetReport,
} from './runtime/targets.js';

export {
  replayFeed,
  type ReplayFeed,
  type ReplayFrame,
  type ReplayOptions,
} from './runtime/replay.js';

export {
  JOB_CONCURRENCY,
  createMiningQueue,
  createMiningWorker,
  dispatchJob,
  type JobHandlers,
  type JobsConfig,
  type MiningJob,
  type MiningQueue,
  type MiningWorker,
} from './jobs/queue.js';

export {
  caseTimeline,
  listCases,
  type CaseListOptions,
  type CasePage,
  type CaseRow,
  type CaseSort,
  type CaseTimeline,
  type CaseTimelineOptions,
  type SortDirection,
  type TimelineStep,
} from './runtime/cases.js';

export {
  dependencyGraph,
  lengthTwoLoopCounts,
  type Branch,
  type BranchKind,
  type DependencyEdge,
  type DependencyGraph,
  type DependencyKind,
  type DependencyOptions,
  type DependencyThresholds,
  type LengthTwoCount,
  type LengthTwoLoop,
  type SelfLoop,
} from './runtime/heuristics.js';

export {
  compareFootprints,
  footprint,
  relationAt,
  type Footprint,
  type FootprintCell,
  type FootprintComparison,
  type FootprintDifference,
  type FootprintOptions,
  type FootprintRelation,
} from './runtime/footprint.js';

export {
  analyseRework,
  type ReworkActivity,
  type ReworkOptions,
  type ReworkReport,
} from './runtime/rework.js';

export {
  countBindingRows,
  extractBinding,
  sourceExtent,
  type ExtractOptions,
  type ExtractResult,
} from './runtime/extract.js';

export {
  previewRefresh,
  refreshStream,
  type CostPreview,
  type RefreshOptions,
  type RefreshResult,
} from './runtime/refresh.js';

export {
  analysePerformance,
  formatDuration,
  type ActivityPerformance,
  type Bottleneck,
  type CasePerformance,
  type Distribution,
  type PerformanceOptions,
  type PerformanceReport,
  type SlaReport,
  type TransitionPerformance,
} from './runtime/performance.js';

export {
  analyseVariants,
  formatPath,
  type Variant,
  type VariantOptions,
  type VariantReport,
} from './runtime/variants.js';

export {
  analyseOrganizational,
  normalisedEntropy,
  type ActivityOwnership,
  type Handover,
  type OrganizationalOptions,
  type OrganizationalReport,
  type ResourceProfile,
} from './runtime/organizational.js';

export {
  NetIndex,
  finalMarking,
  initialMarking,
  markingKey,
  markingsEqual,
  modelActivities,
  silentPathTo,
  treeToPetriNet,
  type Arc,
  type Marking,
  type PetriNet,
  type Transition,
} from './runtime/petrinet.js';

export {
  collectingSink,
  describeSignal,
  evaluateSignals,
  openCaseRuleSchema,
  signalDefinitionSchema,
  signalTriggerSchema,
  type EvaluateSignalsOptions,
  type OpenCaseRule,
  type SignalDefinition,
  type SignalFiring,
  type SignalReport,
  type SignalSink,
  type SignalTrigger,
} from './runtime/signals.js';

// --- export ---------------------------------------------------------------
export { toPnml, treeToPnml, type PnmlOptions } from './export/pnml.js';

export {
  bpmnFromTree,
  layoutBpmn,
  toBpmnXml,
  treeToBpmn,
  type BpmnGraph,
  type BpmnOptions,
} from './export/bpmn.js';

export { escapeAttribute, escapeText, sanitise, toNcName, XmlWriter } from './export/xml.js';

// --- HTTP -----------------------------------------------------------------
export {
  createRouter,
  type MiningRequest,
  type MiningResponse,
  type RouterOptions,
} from './http/router.js';

export {
  createNodeHandler,
  type NodeAdapterOptions,
} from './http/node-adapter.js';

export {
  CALENDAR_GRAMMAR,
  FILTER_GRAMMAR,
  parseCalendarSpec,
  parseFilterSpec,
  parseOutcomeSpec,
} from './http/specs.js';

export {
  END_NODE_ID,
  START_NODE_ID,
  layoutCacheKey,
  layoutDfg,
  type LaidOutEdge,
  type LaidOutGraph,
  type LaidOutNode,
  type LayoutOptions,
  type NodeKind,
} from './runtime/layout.js';

export {
  cycleTimeHistogram,
  dottedChart,
  throughput,
  type Bin,
  type CycleTimeHistogramOptions,
  type DottedChart,
  type DottedChartOptions,
  type DottedSort,
  type Granularity,
  type Histogram,
  type HistogramBucket,
  type ThroughputOptions,
  type TimeSeriesPoint,
} from './runtime/charts.js';

export {
  MAX_CASE_IDS,
  allOf,
  VARIANT_SEPARATOR,
  caseFilterPredicate,
  describeFilter,
  type CaseFilter,
  type FilterContext,
} from './runtime/filter.js';

export {
  CASE_CYCLE_SECONDS,
  EVENT_ORDER,
  PREVIOUS_STEP_LAGS,
  buildLog,
  clockGap,
  perCaseSql,
  waitingSecondsExpr,
  type BuiltLog,
  type LogQueryOptions,
} from './runtime/logquery.js';

export {
  OTHER_ROUTE,
  UNKNOWN_SEGMENT,
  alluvial,
  fingerprints,
  prefixTree,
  type Alluvial,
  type AlluvialFlow,
  type AlluvialOptions,
  type Fingerprint,
  type FingerprintOptions,
  type FingerprintSort,
  type FingerprintStrip,
  type PrefixNode,
  type PrefixTree,
  type PrefixTreeOptions,
} from './runtime/prefix.js';

export {
  clusterTraces,
  type ClusterReport,
  type ClusteringOptions,
  type TraceCluster,
} from './runtime/clustering.js';

export {
  MAX_EXPANSIONS,
  alignLog,
  alignTrace,
  type AlignedVariant,
  type Alignment,
  type AlignmentOptions,
  type AlignmentReport,
  type Deviation,
  type Move,
  type MoveKind,
} from './runtime/alignments.js';

export {
  casesAtRisk,
  type CaseAtRisk,
  type RiskFactor,
  type RiskOptions,
  type RiskReport,
} from './runtime/risk.js';

export {
  deltaMap,
  type ArcDelta,
  type DeltaMap,
  type DeltaMapOptions,
  type NodeDelta,
} from './runtime/delta.js';

export {
  repeatMatrix,
  skillMatrix,
  type ActivityCover,
  type RepeatActivity,
  type RepeatCell,
  type RepeatMatrix,
  type RepeatMatrixOptions,
  type SkillCell,
  type SkillMatrix,
  type SkillMatrixOptions,
} from './runtime/matrix.js';

export {
  complexityScatter,
  performanceSpectrum,
  type ComplexityOptions,
  type ComplexityScatter,
  type HexCell,
  type Passage,
  type PerformanceSpectrum,
  type SpectrumOptions,
} from './runtime/spectrum.js';

export {
  MAX_CONFORMANCE_PERIODS,
  behaviourLimits,
  conformanceTrend,
  metricTrend,
  type BehaviourLimits,
  type ConformancePeriod,
  type ConformanceTrend,
  type ConformanceTrendOptions,
  type Trend,
  type TrendMetric,
  type TrendOptions,
  type TrendPoint,
} from './runtime/trend.js';

export {
  UNGROUPED,
  binEdges,
  groupedDistribution,
  traceLengths,
  type DistributionMeasure,
  type DistributionOptions,
  type DistributionReport,
  type GroupDimension,
  type GroupedDistribution,
  type TraceLengthBucket,
  type TraceLengths,
} from './runtime/distribution.js';

export {
  MAX_INTERVALS,
  OTHER_STAGE,
  bucketRange,
  cumulativeFlow,
  littlesLaw,
  openCaseAging,
  type AgeBucket,
  type AgingOptions,
  type CumulativeFlow,
  type CumulativeFlowOptions,
  type FlowInterval,
  type LittlesLaw,
  type OpenCaseAging,
  type StageLoad,
} from './runtime/flow.js';

export {
  DAYS_PER_WEEK,
  HOURS_PER_DAY,
  MAX_CALENDAR_DAYS,
  calendarVolume,
  queueFormation,
  roster,
  seasonality,
  type CalendarVolume,
  type DayVolume,
  type QueueCurve,
  type QueueHour,
  type Roster,
  type RosterCell,
  type RosterOptions,
  type SeasonCell,
  type SeasonGrid,
  type SeasonMeasure,
  type SeasonalityOptions,
} from './runtime/seasonality.js';

export {
  MAX_HOLIDAYS,
  WEEKDAY_NAMES,
  businessCalendarSchema,
  businessElapsed,
  businessElapsedExpr,
  businessSecondsBetween,
  describeCalendar,
  hourExpr,
  localParts,
  weekdayExpr,
  workingDaySeconds,
  type BusinessCalendar,
  type LocalParts,
} from './runtime/calendar.js';

export {
  compareCohorts,
  type CohortSpec,
  type Comparison,
  type ComparativeOptions,
  type ComparativeReport,
} from './runtime/comparative.js';

export {
  findRootCauses,
  type Factor,
  type OutcomeSpec,
  type RootCauseOptions,
  type RootCauseReport,
} from './runtime/rootcause.js';

export {
  fScore,
  interpretQuality,
  measurePrecision,
  type LooseState,
  type PrecisionResult,
  type WeightedTrace,
} from './runtime/precision.js';

export {
  MIN_GROUP_SIZE,
  assessReportability,
  benjaminiHochberg,
  bootstrapInterval,
  cliffsDelta,
  cliffsDeltaFromU,
  deltaInterval,
  mannWhitneyFromRanks,
  mannWhitneyU,
  median,
  type AdjustedPValue,
  type Alternative,
  type CliffsDelta,
  type EffectMagnitude,
  type Interval,
  type RankSumInputs,
  type RankSumResult,
  type ReportabilityVerdict,
} from './stats/tests.js';

export {
  checkConformance,
  describeMarking,
  referenceNet,
  replayTrace,
  type ActivityDeviation,
  type ConformanceOptions,
  type ConformanceReport,
  type VariantConformance,
} from './runtime/conformance.js';

export {
  mineProcessTree,
  treeActivities,
  treeSize,
  treeToString,
  type CutKind,
  type MineOptions,
  type MineResult,
  type ProcessTree,
} from './runtime/inductive.js';

// --- offline mining -------------------------------------------------------
export {
  importCsv,
  inspectCsv,
  type CsvImportOptions,
  type CsvInspectOptions,
  type CsvInspection,
  type ImportResult,
} from './offline/csv.js';

export {
  DEFAULT_XES_MAX_BYTES,
  importXes,
  type XesImportOptions,
  type XesImportResult,
} from './offline/xes.js';

export {
  XES_CASE_ID,
  XES_CONCEPT_NAME,
  XES_LIFECYCLE,
  XES_RESOURCE,
  XES_TIMESTAMP,
  bareAttributeName,
  classifyAttributeColumns,
  inferMapping,
  xesColumnMappingSchema,
  type XesColumnMapping,
} from './offline/xes-standard.js';

// --- the team picture -----------------------------------------------------
export {
  analyseTeam,
  type Delegation,
  type DiscoveredRole,
  type DoesAlike,
  type TeamNetwork,
  type TeamOptions,
  type WorksAlongside,
} from './runtime/teams.js';

export { agglomerate, cosineDistance, unitVector } from './runtime/vectors.js';
