import {
  ConfigInvalidError,
  MalkomError,
  NotFoundError,
  UnauthorizedError,
} from '../domain/errors.js';
import type { Logger } from '../ports/logger.js';
import { noopLogger } from '../ports/logger.js';
import type { SqlClient } from '../ports/sql.js';
import { duckdbDialect } from '../sql/dialect.js';
import { abstractNodes, buildDfg, groupRareActivities, type Dfg } from '../runtime/dfg.js';
import { mineProcessTree, treeToString, type ProcessTree } from '../runtime/inductive.js';
import { analysePerformance } from '../runtime/performance.js';
import { analyseVariants } from '../runtime/variants.js';
import { analyseOrganizational } from '../runtime/organizational.js';
import { checkConformance } from '../runtime/conformance.js';
import { compareCohorts, type CohortSpec } from '../runtime/comparative.js';
import { findRootCauses, type OutcomeSpec } from '../runtime/rootcause.js';
import { layoutCacheKey, layoutDfg, type LaidOutGraph } from '../runtime/layout.js';
import {
  cycleTimeHistogram,
  dottedChart,
  throughput,
  type Granularity,
} from '../runtime/charts.js';
import {
  availableCaseAttributes,
  availableObjectTypes,
  detectCapabilities,
  type LogCapabilities,
  type Perspective,
} from '../runtime/eventlog.js';
import { summariseLog } from '../runtime/summary.js';
import {
  deleteStream,
  ensureStreamRegistry,
  getStream,
  listStreams,
  saveStream,
} from '../runtime/streams.js';
import { streamDefinitionSchema } from '../config/schemas.js';
import { analyseRework } from '../runtime/rework.js';
import { caseTimeline, listCases, type CaseSort } from '../runtime/cases.js';
import { dependencyGraph, lengthTwoLoopCounts } from '../runtime/heuristics.js';
import { compareFootprints, footprint } from '../runtime/footprint.js';
import { replayFeed } from '../runtime/replay.js';
import { reconcileTargets, type DeclaredTarget } from '../runtime/targets.js';
import { allOf, describeFilter, type CaseFilter } from '../runtime/filter.js';
import { hostRequirements } from '../sql/host-adapters.js';
import { treeToPnml } from '../export/pnml.js';
import { treeToBpmn } from '../export/bpmn.js';
import {
  evaluateSignals,
  openCaseRuleSchema,
  type OpenCaseRule,
  type SignalDefinition,
} from '../runtime/signals.js';
import { ZodError } from 'zod';
import { alignLog } from '../runtime/alignments.js';
import { clusterTraces } from '../runtime/clustering.js';
import { analyseTeam } from '../runtime/teams.js';
import { deltaMap } from '../runtime/delta.js';
import {
  groupedDistribution,
  traceLengths,
  type DistributionMeasure,
  type GroupDimension,
} from '../runtime/distribution.js';
import { cumulativeFlow, littlesLaw, openCaseAging } from '../runtime/flow.js';
import { repeatMatrix, skillMatrix } from '../runtime/matrix.js';
import { alluvial, fingerprints, prefixTree } from '../runtime/prefix.js';
import { casesAtRisk } from '../runtime/risk.js';
import {
  calendarVolume,
  queueFormation,
  roster,
  seasonality,
  type SeasonMeasure,
} from '../runtime/seasonality.js';
import { complexityScatter, performanceSpectrum } from '../runtime/spectrum.js';
import { conformanceTrend, metricTrend, type TrendMetric } from '../runtime/trend.js';
import {
  businessCalendarSchema,
  describeCalendar,
  type BusinessCalendar,
} from '../runtime/calendar.js';
import {
  CALENDAR_GRAMMAR,
  FILTER_GRAMMAR,
  parseCalendarSpec,
  parseFilterSpec,
  parseOutcomeSpec,
} from './specs.js';

/**
 * The HTTP surface, framework-agnostic.
 *
 * This is a request-in, response-out function rather than an Express app or a
 * Fastify plugin, because the engine is embedded and cannot dictate the host's
 * server. Mount it under node:http, Express, Fastify, a Next.js route handler
 * or a Lambda — the adapter is a dozen lines and lives with the host.
 *
 * Every analysis is available over GET with query parameters as well as POST
 * with a JSON body. GET exists so the thing can be explored with a browser and
 * a curl, which is how anyone actually learns an API; POST exists for filters
 * too complex to express in a query string.
 */

export interface MiningRequest {
  method: string;
  /** Path only — the adapter strips any mount prefix. */
  path: string;
  query: URLSearchParams;
  /** Parsed JSON body, for POST. */
  body?: unknown;
  headers?: Record<string, string | undefined>;
}

export interface MiningResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface RouterOptions {
  /**
   * Resolve a store name to an open client. Called per request; implementations
   * are expected to cache. Returning the same client for every name is a valid
   * single-store setup.
   */
  resolveStore: (name: string) => Promise<SqlClient>;
  /** Store used when the request names none. */
  defaultStore?: string;
  /**
   * API keys, mapped to a label used only in logs. Omit to leave the surface
   * unauthenticated — appropriate only behind a host that has already
   * authenticated the caller, which is the normal embedded case.
   */
  apiKeys?: Record<string, string>;
  /** Header carrying the key. Default 'x-api-key'. */
  apiKeyHeader?: string;
  logger?: Logger;
  /**
   * Cache for laid-out graphs, keyed by layoutCacheKey. Layout is
   * deterministic and expensive, and identical for every viewer, so a cache is
   * the difference between a map that appears instantly and one that is
   * recomputed for each person who opens it.
   */
  layoutCache?: Map<string, LaidOutGraph>;
}

interface RouteContext {
  request: MiningRequest;
  client: SqlClient;
  options: SharedOptions;
  storeName: string;
}

interface SharedOptions {
  objectType: string;
  lifecycle?: readonly string[];
  filter?: CaseFilter;
  window?: { from: Date; to: Date };
  perspective?: Perspective;
  capabilities?: LogCapabilities;
  calendar?: BusinessCalendar;
}

interface RouteDefinition {
  path: string;
  summary: string;
  params?: Record<string, string>;
  /**
   * False for routes that do not read the mined log.
   *
   * They skip resolving the shared selection, which would otherwise require an
   * event log to exist — and the routes that manage streams are precisely the
   * ones somebody uses before anything has been mined.
   */
  needsLog?: boolean;
  handle: (ctx: RouteContext) => Promise<unknown>;
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function createRouter(opts: RouterOptions): (req: MiningRequest) => Promise<MiningResponse> {
  const logger = opts.logger ?? noopLogger;
  const keyHeader = (opts.apiKeyHeader ?? 'x-api-key').toLowerCase();
  const layoutCache = opts.layoutCache ?? new Map<string, LaidOutGraph>();

  const routes: RouteDefinition[] = [
    {
      path: '/v1/log',
      summary: 'Object types in the store, and the case attributes each carries',
      handle: async ({ client }) => ({
        objectTypes: await availableObjectTypes(client, duckdbDialect),
        // Every analysis that segments a population takes an attribute NAME.
        // Without this the caller has to ask somebody to remember a column
        // name, which is what the discovery path exists to stop.
        attributes: await availableCaseAttributes(client, duckdbDialect),
      }),
    },
    /**
     * Saved streams — the named selections a person actually works with.
     *
     * Read and write on one path because the shape is small and the verb
     * carries the intent: GET lists, POST creates or saves, DELETE removes.
     * Everything is validated by the stream schema on the way in, so a
     * definition that could not extract is refused here rather than failing
     * inside a refresh nobody is watching.
     */
    {
      path: '/v1/streams',
      summary: 'Saved data streams: list, create, save, delete',
      // Managing streams is what happens BEFORE anything is mined, so this
      // route must not require an event log to exist.
      needsLog: false,
      params: {
        id: 'stream to act on, for DELETE',
        createOnly: 'true to refuse overwriting an existing stream',
      },
      handle: async ({ client, request }) => {
        await ensureStreamRegistry(client, duckdbDialect);

        if (request.method === 'GET') {
          const id = request.query.get('id');
          if (id !== null) return getStream(client, duckdbDialect, id);
          return { streams: await listStreams(client, duckdbDialect) };
        }

        const body = record(request.body) ?? {};
        const action = asString(body['action']) ?? asString(request.query.get('action') ?? undefined);

        if (action === 'delete') {
          const id = asString(body['id']) ?? request.query.get('id') ?? '';
          if (id === '') throw new ConfigInvalidError('delete needs the stream id');
          return { deleted: await deleteStream(client, duckdbDialect, id) };
        }

        const definition = streamDefinitionSchema.parse(body['definition'] ?? body['stream']);
        return saveStream(client, duckdbDialect, {
          definition,
          ...(asString(body['name']) !== undefined ? { name: asString(body['name'])! } : {}),
          ...(body['description'] !== undefined
            ? { description: body['description'] === null ? null : String(body['description']) }
            : {}),
          createOnly: body['createOnly'] === true || request.query.get('createOnly') === 'true',
        });
      },
    },
    {
      path: '/v1/log/summary',
      summary: 'Header figures: cases, variants, events, activities, duration spread, timeframe',
      handle: async ({ client, options }) => summariseLog(client, duckdbDialect, options),
    },
    {
      path: '/v1/discover',
      summary: 'Directly-follows graph and the discovered process tree',
      params: {
        threshold: 'drop arcs below this share of their source, 0-1',
        nodes: 'keep this share of activities, 0-1; paths reconnect around the rest',
        group: 'true to collapse the rest into openable boxes instead of hiding them',
        minCluster: 'smallest box worth making when grouping, default 2',
      },
      handle: async ({ client, options, request }) => {
        const threshold = number(request, 'threshold');
        const dfg = simplify(
          await buildDfg(client, duckdbDialect, {
            ...options,
            ...(threshold !== undefined ? { edgeThreshold: threshold } : {}),
          }),
          request,
        );
        const mined = mineProcessTree(dfg);
        return {
          caseCount: dfg.caseCount,
          eventCount: dfg.eventCount,
          activities: dfg.activities,
          edges: dfg.edges,
          starts: Object.fromEntries(dfg.starts),
          ends: Object.fromEntries(dfg.ends),
          tree: mined.tree,
          treeText: treeToString(mined.tree),
          cuts: mined.cuts,
          fallbacks: mined.fallbacks,
          // Surfaced rather than buried: a model with fallbacks is imprecise,
          // and a caller rendering it should be able to say so.
          imprecise: mined.fallbacks > 0,
          // Present only when grouping ran. Empty then means "nothing worth
          // collapsing", which is a different answer from never having asked.
          ...(dfg.groups !== undefined ? { groups: dfg.groups } : {}),
        };
      },
    },
    {
      path: '/v1/layout',
      summary: 'Laid-out graph: coordinates, sizes, edge polylines, weights',
      params: {
        threshold: 'drop arcs below this share of their source, 0-1',
        nodes: 'keep this share of activities, 0-1; paths reconnect around the rest',
        group: 'true to collapse the rest into openable boxes instead of hiding them',
        minCluster: 'smallest box worth making when grouping, default 2',
        direction: 'DOWN or RIGHT',
      },
      handle: async ({ client, options, request }) => {
        const threshold = number(request, 'threshold');
        const dfg = simplify(
          await buildDfg(client, duckdbDialect, {
            ...options,
            ...(threshold !== undefined ? { edgeThreshold: threshold } : {}),
          }),
          request,
        );
        const direction = request.query.get('direction') === 'RIGHT' ? 'RIGHT' : 'DOWN';
        const key = layoutCacheKey(dfg, { direction });
        // The cache key hashes the graph's own activities and edges, so a
        // grouped graph and a thinned one key differently by construction and
        // cannot serve each other's layout.
        const groups = dfg.groups !== undefined ? { groups: dfg.groups } : {};
        const cached = layoutCache.get(key);
        if (cached !== undefined) return { ...cached, ...groups, cacheKey: key, cached: true };
        const graph = await layoutDfg(dfg, { direction });
        layoutCache.set(key, graph);
        return { ...graph, ...groups, cacheKey: key, cached: false };
      },
    },
    {
      path: '/v1/replay',
      summary: 'Frame-by-frame arc occupancy, for animating the map',
      params: {
        frames: 'number of frames, default 120',
        maxArcs: 'arcs reported per frame, busiest first',
      },
      handle: async ({ client, options, request }) =>
        replayFeed(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'frames', 'frames'),
          ...numberOpt(request, 'maxArcs', 'maxArcsPerFrame'),
        }),
    },
    {
      path: '/v1/targets',
      summary: 'Declared targets against what the log actually shows (POST)',
      handle: async ({ client, options, request }) => {
        const body = record(request.body) ?? {};
        const targets = Array.isArray(body['targets']) ? (body['targets'] as DeclaredTarget[]) : [];
        return reconcileTargets(client, duckdbDialect, { ...options, targets });
      },
    },
    {
      path: '/v1/rework',
      summary: 'Work done more than once: repeats, self-loops, revisits, effort share',
      params: { limit: 'activities to return, worst first' },
      handle: async ({ client, options, request }) =>
        analyseRework(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'limit', 'limit'),
        }),
    },
    {
      path: '/v1/signals',
      summary: 'Evaluate signal definitions against cases still in flight (POST)',
      params: { now: 'evaluation instant, ISO; defaults to the request time' },
      handle: async ({ client, options, request }) => {
        const body = record(request.body) ?? {};
        const definitions = (body['signals'] ?? []) as SignalDefinition[];
        const openCases = (body['openCases'] ?? { kind: 'all' }) as OpenCaseRule;
        const nowText = request.query.get('now') ?? asString(body['now']);
        const now = nowText === undefined ? new Date() : new Date(nowText);
        if (Number.isNaN(now.getTime())) {
          throw new ConfigInvalidError('now must be an ISO timestamp');
        }
        return evaluateSignals(client, duckdbDialect, definitions, {
          objectType: options.objectType,
          ...(options.lifecycle !== undefined ? { lifecycle: options.lifecycle } : {}),
          ...(options.calendar !== undefined ? { calendar: options.calendar } : {}),
          openCases,
          now,
        });
      },
    },
    {
      path: '/v1/export',
      summary: 'Discovered model as BPMN 2.0 or PNML, for another tool to open',
      params: { format: 'bpmn | pnml | tree', threshold: 'noise filter, 0-1' },
      handle: async ({ client, options, request }) => {
        const threshold = number(request, 'threshold');
        const dfg = await buildDfg(client, duckdbDialect, {
          ...options,
          ...(threshold !== undefined ? { edgeThreshold: threshold } : {}),
        });
        const mined = mineProcessTree(dfg);
        const format = (request.query.get('format') ?? 'bpmn').toLowerCase();
        const name = request.query.get('name') ?? `Discovered from ${options.objectType}`;

        // The warning travels WITH the file. Exporting a flower produces a
        // diagram that looks like a process and describes nothing, and the
        // person who opens it will not have seen this endpoint's response.
        const warning =
          mined.fallbacks > 0
            ? `${mined.fallbacks} part(s) of this model are a flower: the exported diagram shows structure the data does not support`
            : null;

        if (format === 'tree') return { tree: mined.tree, warning };
        const content = format === 'pnml' ? treeToPnml(mined.tree, { name }) : await treeToBpmn(mined.tree, { name });
        return {
          format,
          filename: `process.${format}`,
          contentType: format === 'pnml' ? 'application/xml' : 'application/xml',
          content,
          warning,
        };
      },
    },
    {
      path: '/v1/performance',
      summary: 'Waiting versus handling, bottlenecks ranked by total contribution',
      params: { sla: 'breach threshold in seconds' },
      handle: async ({ client, options, request }) => {
        const sla = number(request, 'sla');
        return analysePerformance(client, duckdbDialect, {
          ...options,
          ...(sla !== undefined ? { slaSeconds: sla } : {}),
        });
      },
    },
    {
      path: '/v1/variants',
      summary: 'Distinct paths ranked, with the coverage needed for 80% of cases',
      params: { top: 'variants to return' },
      handle: async ({ client, options, request }) => {
        const top = number(request, 'top');
        return analyseVariants(client, duckdbDialect, {
          ...options,
          ...(top !== undefined ? { limit: top } : {}),
        });
      },
    },
    {
      path: '/v1/resources',
      summary: 'Workload, handovers, specialisation and key-person risk',
      handle: async ({ client, options }) => analyseOrganizational(client, duckdbDialect, options),
    },
    {
      path: '/v1/teams',
      summary: 'Who works alongside whom, who delegates, and the roles behaviour reveals',
      params: {
        limit: 'people considered, busiest first, default 40',
        roles: 'how many groups to form; omit to decide from headcount',
        minSimilarity: 'pairs below this are not reported as doing alike, default 0.6',
      },
      handle: async ({ client, options, request }) => {
        const limit = number(request, 'limit');
        const roles = number(request, 'roles');
        const minSimilarity = number(request, 'minSimilarity');
        return analyseTeam(client, duckdbDialect, {
          ...options,
          ...(limit !== undefined ? { limit } : {}),
          ...(roles !== undefined ? { roles } : {}),
          ...(minSimilarity !== undefined ? { minSimilarity } : {}),
        });
      },
    },
    {
      path: '/v1/conformance',
      summary: 'Token replay against a model, with fitness AND precision',
      params: {
        top: 'variants to replay',
        model: 'process tree as JSON (POST body preferred)',
      },
      handle: async ({ client, options, request }) => {
        const top = number(request, 'top');
        const model = readModel(request);
        const resolved =
          model ?? mineProcessTree(await buildDfg(client, duckdbDialect, options)).tree;
        const report = await checkConformance(client, duckdbDialect, {
          ...options,
          model: resolved,
          ...(top !== undefined ? { limit: top } : {}),
        });
        return {
          ...report,
          // Without this a caller cannot tell a compliance result from a model
          // checked against the log it was discovered from.
          selfCheck: model === undefined,
          ...(model === undefined
            ? {
                caveat:
                  'no model supplied: the log was checked against a model discovered from itself. This measures how well the map explains the data, not compliance with an intended process.',
              }
            : {}),
        };
      },
    },
    {
      path: '/v1/compare',
      summary: 'Two cohorts, with Mann-Whitney, Cliff delta and BH correction',
      params: { a: 'cohort spec', b: 'cohort spec, or "rest"' },
      handle: async ({ client, options, request }) => {
        const a = readCohort(request, 'a');
        if (a === undefined) {
          throw new ConfigInvalidError("compare needs cohort 'a'", [
            "pass ?a=channel=web, ?a=activity:Reject, or a structured cohort in a POST body",
          ]);
        }
        const b = readCohort(request, 'b') ?? { kind: 'complement' as const };
        return compareCohorts(client, duckdbDialect, { ...options, a, b });
      },
    },
    {
      path: '/v1/rootcause',
      summary: 'Factors associated with a bad outcome, by lift',
      params: { outcome: 'slowest:0.2 | slower-than:N | contains:X | missing:X' },
      handle: async ({ client, options, request }) => {
        const outcome = readOutcome(request);
        return findRootCauses(client, duckdbDialect, { ...options, outcome });
      },
    },
    {
      path: '/v1/cases',
      summary: 'The cases themselves: a page of them, or one case step by step',
      params: {
        id: 'a case id — returns that case timeline instead of the list',
        sort: 'start | end | duration | events | cost, default duration',
        direction: 'asc | desc, default desc',
        limit: 'page size, default 50',
        cursor: 'nextCursor from the previous page',
        steps: 'timeline only: steps to return, default 1000',
      },
      handle: async ({ client, options, request }) => {
        const id = request.query.get('id') ?? asString(record(request.body)?.['id']);
        if (id !== undefined && id !== null && id !== '') {
          return caseTimeline(client, duckdbDialect, id, {
            ...options,
            ...numberOpt(request, 'steps', 'limit'),
          });
        }

        const sort = request.query.get('sort');
        const direction = request.query.get('direction');
        const cursor = request.query.get('cursor');
        return listCases(client, duckdbDialect, {
          ...options,
          ...(isCaseSort(sort) ? { sort } : {}),
          ...(direction === 'asc' || direction === 'desc' ? { direction } : {}),
          ...numberOpt(request, 'limit', 'limit'),
          ...(cursor !== null && cursor !== '' ? { cursor } : {}),
        });
      },
    },
    {
      path: '/v1/dependency',
      summary: 'Per-arc dependency strength: a real ordering, or two things that co-occur',
      params: {
        threshold: 'drop arcs below this share of their source, 0-1',
        nodes: 'keep this share of activities, 0-1',
        dependency: 'above this absolute measure an arc is called a dependency, default 0.8',
        minSupport: 'observations below which an arc is reported unreliable, default 5',
        shortLoops: 'false to skip the a-b-a pass, which costs one extra query',
      },
      handle: async ({ client, options, request }) => {
        const threshold = number(request, 'threshold');
        const dfg = simplify(
          await buildDfg(client, duckdbDialect, {
            ...options,
            ...(threshold !== undefined ? { edgeThreshold: threshold } : {}),
          }),
          request,
        );
        // Opt-out rather than opt-in: without it every alternating pair is
        // misreported as unrelated, which is the failure this route exists to fix.
        const wantLoops = request.query.get('shortLoops') !== 'false';
        const lengthTwoCounts = wantLoops
          ? await lengthTwoLoopCounts(client, duckdbDialect, options)
          : undefined;
        return dependencyGraph(dfg, {
          ...numberOpt(request, 'dependency', 'dependencyThreshold'),
          ...numberOpt(request, 'minSupport', 'minSupport'),
          ...numberOpt(request, 'and', 'andThreshold'),
          ...(lengthTwoCounts !== undefined ? { lengthTwoCounts } : {}),
        });
      },
    },
    {
      path: '/v1/footprint',
      summary: 'Ordering relations as a grid; with cohorts a and b, what changed between them',
      params: {
        limit: 'activities in the grid, most frequent first, default 60',
        a: 'cohort spec — with it, the answer is a comparison rather than a grid',
        b: 'cohort spec to compare against; defaults to everything outside a',
      },
      handle: async ({ client, options, request }) => {
        const limit = number(request, 'limit');
        const opts = limit !== undefined ? { limit } : {};
        const grid = async (filter: CaseFilter | undefined): Promise<ReturnType<typeof footprint>> =>
          footprint(
            await buildDfg(client, duckdbDialect, {
              ...options,
              ...(filter !== undefined ? { filter } : {}),
            }),
            opts,
          );

        const a = readCohort(request, 'a');
        if (a === undefined) return grid(options.filter);
        if (a.kind === 'complement') {
          throw new ConfigInvalidError("cohort 'a' cannot be the complement of nothing", [
            'name a real selection for a, and leave b out to compare it against the rest',
          ]);
        }

        const b = readCohort(request, 'b') ?? { kind: 'complement' as const };
        const afterFilter: CaseFilter = b.kind === 'complement' ? { kind: 'not', arg: a } : b;
        const [before, after] = await Promise.all([
          grid(allOf(options.filter, a)),
          grid(allOf(options.filter, afterFilter)),
        ]);
        return { before, after, ...compareFootprints(before, after) };
      },
    },
    {
      path: '/v1/chart/dotted',
      summary: 'Dotted chart, pre-binned so a browser can draw it',
      params: { xBins: 'default 400', yBins: 'default 300', sort: 'start | duration | end' },
      handle: async ({ client, options, request }) => {
        const sort = request.query.get('sort');
        return dottedChart(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'xBins', 'xBins'),
          ...numberOpt(request, 'yBins', 'yBins'),
          ...(sort === 'start' || sort === 'duration' || sort === 'end' ? { sortBy: sort } : {}),
        });
      },
    },
    {
      path: '/v1/chart/histogram',
      summary: 'Cycle-time distribution, log-bucketed by default',
      params: { buckets: 'default 40', linear: 'true for even buckets' },
      handle: async ({ client, options, request }) =>
        cycleTimeHistogram(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'buckets', 'buckets'),
          ...(request.query.get('linear') === 'true' ? { linear: true } : {}),
        }),
    },
    {
      path: '/v1/chart/throughput',
      summary: 'Cases over time — demand when counted at start, delivery at end',
      params: { granularity: 'hour | day | week | month', countAt: 'start | end' },
      handle: async ({ client, options, request }) => {
        const granularity = request.query.get('granularity');
        const countAt = request.query.get('countAt');
        // Named rather than bare: every other route answers an object, and one
        // that does not forces each caller to special-case it.
        const points = await throughput(client, duckdbDialect, {
          ...options,
          ...(granularity === 'hour' || granularity === 'day' || granularity === 'week' || granularity === 'month'
            ? { granularity }
            : {}),
          ...(countAt === 'start' || countAt === 'end' ? { countAt } : {}),
        });
        return { points };
      },
    },
    // --- when work happens, and where it is piled up -----------------------
    {
      path: '/v1/chart/seasonality',
      summary: 'Weekday x hour grid: when work arrives, is worked, and waits',
      params: {
        timezone: 'IANA zone the buckets are cut in; defaults to the calendar, else UTC',
        measure: 'events (default), starts, or ends',
      },
      handle: async ({ client, options, request }) =>
        seasonality(client, duckdbDialect, {
          ...options,
          ...zoneOpt(request),
          ...measureOpt(request),
        }),
    },
    {
      path: '/v1/chart/calendar',
      summary: 'A year of days, contiguous, with the quiet days counted',
      params: { timezone: 'IANA zone', measure: 'events (default), starts, or ends' },
      handle: async ({ client, options, request }) =>
        calendarVolume(client, duckdbDialect, {
          ...options,
          ...zoneOpt(request),
          ...measureOpt(request),
        }),
    },
    {
      path: '/v1/chart/queue',
      summary: 'Waiting time by hour of day — when the queue forms and whether it clears',
      params: { timezone: 'IANA zone' },
      handle: async ({ client, options, request }) =>
        queueFormation(client, duckdbDialect, { ...options, ...zoneOpt(request) }),
    },
    {
      path: '/v1/roster',
      summary: 'Who works which hours, to lay over the queue curve',
      params: { timezone: 'IANA zone', limit: 'people returned, busiest first' },
      handle: async ({ client, options, request }) =>
        roster(client, duckdbDialect, {
          ...options,
          ...zoneOpt(request),
          ...numberOpt(request, 'limit', 'limit'),
        }),
    },
    {
      path: '/v1/flow',
      summary: 'Work in progress by stage over time',
      params: {
        granularity: 'hour, day, week or month',
        stageLimit: 'stages tracked before the rest merge into one band',
      },
      handle: async ({ client, options, request }) =>
        cumulativeFlow(client, duckdbDialect, {
          ...options,
          ...granularityOpt(request),
          ...numberOpt(request, 'stageLimit', 'stageLimit'),
        }),
    },
    {
      path: '/v1/flow/littles-law',
      summary: 'WIP against throughput and cycle time — a consistency check on the log',
      params: { granularity: 'hour, day, week or month' },
      handle: async ({ client, options, request }) =>
        littlesLaw(client, duckdbDialect, { ...options, ...granularityOpt(request) }),
    },
    {
      path: '/v1/aging',
      summary: 'Open cases bucketed by how long they have been waiting (POST)',
      params: {
        now: 'evaluation instant, ISO; defaults to the request time',
        sla: 'seconds past which an open case is breaching',
        limit: 'oldest cases listed',
      },
      handle: async ({ client, options, request }) =>
        openCaseAging(client, duckdbDialect, {
          ...options,
          openCases: readOpenCaseRule(request),
          now: readNow(request),
          ...numberOpt(request, 'sla', 'slaSeconds'),
          ...numberOpt(request, 'limit', 'limit'),
        }),
    },

    // --- distributions, trends and grids -----------------------------------
    {
      path: '/v1/distribution',
      summary: 'A grouped distribution: the numbers a box plot, violin or ridgeline needs',
      params: {
        measure: 'cycle (default), handling, waiting or length',
        groupBy: 'none (default), activity, resource, variant, or attr:<key>',
        bins: 'bins per group, for a violin or ridgeline',
        minObservations: 'groups smaller than this are dropped',
        limit: 'groups returned, largest first',
      },
      handle: async ({ client, options, request }) =>
        groupedDistribution(client, duckdbDialect, {
          ...options,
          ...distributionMeasureOpt(request),
          ...groupByOpt(request),
          ...numberOpt(request, 'bins', 'bins'),
          ...numberOpt(request, 'minObservations', 'minObservations'),
          ...numberOpt(request, 'limit', 'limit'),
        }),
    },
    {
      path: '/v1/trace-lengths',
      summary: 'How many steps a case takes, one bucket per length',
      handle: async ({ client, options }) => traceLengths(client, duckdbDialect, options),
    },
    {
      path: '/v1/trend',
      summary: 'A metric over time, with the range within which variation is ordinary',
      params: {
        metric: 'cycle (default), throughput, arrivals, waiting, rework, reworkCost, stepDuration',
        granularity: 'hour, day, week (default) or month',
        activity: 'required by stepDuration',
      },
      handle: async ({ client, options, request }) =>
        metricTrend(client, duckdbDialect, {
          ...options,
          ...trendMetricOpt(request),
          ...granularityOpt(request),
          ...stringOpt(request, 'activity', 'activity'),
        }),
    },
    {
      path: '/v1/matrix/repeat',
      summary: 'Activity by how many times it ran in one case',
      params: { limit: 'activities returned', maxRuns: 'runs above this fold into the top row' },
      handle: async ({ client, options, request }) =>
        repeatMatrix(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'limit', 'limit'),
          ...numberOpt(request, 'maxRuns', 'maxRuns'),
        }),
    },
    {
      path: '/v1/matrix/skill',
      summary: 'Who does what, and which steps only one person can do',
      params: { limit: 'people returned, busiest first' },
      handle: async ({ client, options, request }) =>
        skillMatrix(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'limit', 'limit'),
        }),
    },

    // --- queue discipline and shape ----------------------------------------
    {
      path: '/v1/spectrum',
      summary: 'Every case passage between two steps — FIFO, overtaking, or batching',
      params: {
        from: 'the step work leaves (required)',
        to: 'the step it arrives at (required)',
        limit: 'segments returned',
      },
      handle: async ({ client, options, request }) => {
        const fromActivity = request.query.get('from') ?? asString(record(request.body)?.['from']);
        const toActivity = request.query.get('to') ?? asString(record(request.body)?.['to']);
        if (fromActivity === undefined || toActivity === undefined) {
          throw new ConfigInvalidError('spectrum needs both from and to', [
            'pass ?from=<activity>&to=<activity>',
          ]);
        }
        return performanceSpectrum(client, duckdbDialect, {
          ...options,
          fromActivity,
          toActivity,
          ...numberOpt(request, 'limit', 'limit'),
        });
      },
    },
    {
      path: '/v1/scatter',
      summary: 'Cycle time against trace length — the slow cases that are not complex',
      params: { bins: 'bins along each axis', limit: 'cases listed in the slow-and-simple corner' },
      handle: async ({ client, options, request }) =>
        complexityScatter(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'bins', 'bins'),
          ...numberOpt(request, 'limit', 'limit'),
        }),
    },

    // --- routes, segments and cohorts --------------------------------------
    {
      path: '/v1/prefix',
      summary: 'Routes as a tree of shared prefixes — where the process fans out',
      params: { maxDepth: 'steps to follow', minCases: 'prefixes below this are not expanded' },
      handle: async ({ client, options, request }) =>
        prefixTree(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'maxDepth', 'maxDepth'),
          ...numberOpt(request, 'minCases', 'minCases'),
        }),
    },
    {
      path: '/v1/alluvial',
      summary: 'Segment, route and outcome as one three-column flow',
      params: {
        attribute: 'the case attribute that segments the population (required)',
        routeLimit: 'routes kept as their own band',
      },
      handle: async ({ client, options, request }) => {
        const attribute =
          request.query.get('attribute') ?? asString(record(request.body)?.['attribute']);
        if (attribute === undefined) {
          throw new ConfigInvalidError('alluvial needs an attribute to segment by', [
            'pass ?attribute=<key>',
          ]);
        }
        return alluvial(client, duckdbDialect, {
          ...options,
          attribute,
          ...numberOpt(request, 'routeLimit', 'routeLimit'),
        });
      },
    },
    {
      path: '/v1/fingerprints',
      summary: 'Every case as a row of palette indices, for a trace strip',
      params: {
        limit: 'cases returned',
        maxSteps: 'steps per case before cutting',
        sort: 'duration (default), length or start',
      },
      handle: async ({ client, options, request }) => {
        const sort = request.query.get('sort');
        return fingerprints(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'limit', 'limit'),
          ...numberOpt(request, 'maxSteps', 'maxSteps'),
          ...(sort === 'length' || sort === 'start' || sort === 'duration' ? { sort } : {}),
        });
      },
    },
    {
      path: '/v1/delta',
      summary: 'Two cohorts on one map, arcs carrying which side uses them more',
      params: {
        a: 'the cohort under examination, as a filter spec (required)',
        b: 'what to compare it against; omit for everything else',
      },
      handle: async ({ client, options, request }) => {
        const a = readCohort(request, 'a');
        if (a === undefined || a.kind === 'complement') {
          throw new ConfigInvalidError('delta needs cohort a', [
            'pass ?a=<filter spec>, e.g. a=channel%3Dphone',
          ]);
        }
        const b = readCohort(request, 'b');
        return deltaMap(client, duckdbDialect, {
          ...options,
          a,
          ...(b !== undefined && b.kind !== 'complement' ? { b } : {}),
        });
      },
    },
    {
      path: '/v1/clusters',
      summary: 'A long variant tail collapsed into behaviours, each with a filter',
      params: { clusters: 'groups to cut into, default 6', variantLimit: 'routes considered' },
      handle: async ({ client, options, request }) =>
        clusterTraces(client, duckdbDialect, {
          ...options,
          ...numberOpt(request, 'clusters', 'clusters'),
          ...numberOpt(request, 'variantLimit', 'variantLimit'),
        }),
    },

    // --- conformance and what is in flight ---------------------------------
    {
      path: '/v1/align',
      summary: 'Where each route departs from the model, move by move (POST)',
      params: {
        model: 'a process tree in the body; discovered from the log when absent',
        variantLimit: 'routes aligned, most frequent first',
      },
      handle: async ({ client, options, request }) => {
        const model = await modelFor(client, options, request);
        return alignLog(client, duckdbDialect, {
          ...options,
          model,
          ...numberOpt(request, 'variantLimit', 'variantLimit'),
        });
      },
    },
    {
      path: '/v1/conformance/trend',
      summary: 'Fitness and precision per period — compliance as a line, not a snapshot',
      params: { granularity: 'day, week or month (default)', model: 'a process tree in the body' },
      handle: async ({ client, options, request }) => {
        const model = await modelFor(client, options, request);
        return conformanceTrend(client, duckdbDialect, {
          ...options,
          model,
          ...granularityOpt(request),
        });
      },
    },
    {
      path: '/v1/risk',
      summary: 'Work in flight ranked by how its route has historically ended (POST)',
      params: {
        now: 'evaluation instant, ISO',
        sla: 'seconds past which a finished case ended badly',
        bad: 'comma-separated activities that count as a bad ending',
        minSupport: 'finished cases a rate needs behind it',
        limit: 'cases returned, riskiest first',
      },
      handle: async ({ client, options, request }) => {
        const bad = (request.query.get('bad') ?? asString(record(request.body)?.['bad']))
          ?.split(',')
          .map((a) => a.trim())
          .filter((a) => a.length > 0);
        return casesAtRisk(client, duckdbDialect, {
          ...options,
          openCases: readOpenCaseRule(request),
          now: readNow(request),
          ...numberOpt(request, 'sla', 'slaSeconds'),
          ...(bad !== undefined && bad.length > 0 ? { badActivities: bad } : {}),
          ...numberOpt(request, 'minSupport', 'minSupport'),
          ...numberOpt(request, 'limit', 'limit'),
        });
      },
    },
  ];

  const byPath = new Map(routes.map((r) => [r.path, r]));

  return async function handle(request: MiningRequest): Promise<MiningResponse> {
    try {
      authenticate(request, opts.apiKeys, keyHeader);

      const path = normalise(request.path);

      if (path === '/v1' || path === '/') {
        // Discovery reflects what is actually registered, so it cannot drift
        // from the routes that exist.
        return ok({
          engine: 'malkom-processmining-engine',
          version: '0.1.0',
          defaultStore: opts.defaultStore ?? null,
          shared: {
            store: 'which store to query',
            objectType: 'case notion to pivot on; defaults to the first available',
            perspective: 'activity (default), resource, or attr:<key>',
            lifecycle: 'comma-separated transitions to keep, e.g. complete',
            filter:
              'repeatable case selector: channel=web, activity:X, !activity:X, resource:R, slower-than:N, faster-than:N, length:a..b, from:ISO..ISO',
            from: 'event window start (ISO)',
            to: 'event window end (ISO)',
            calendar: `measure in working time: ${CALENDAR_GRAMMAR.map((g) => g.form).join(', ')}`,
          },
          routes: routes.map((r) => ({
            path: r.path,
            methods: ['GET', 'POST'],
            summary: r.summary,
            params: r.params ?? {},
          })),
        });
      }

      if (path === '/v1/requirements') {
        return ok({ requirements: hostRequirements() });
      }

      const route = byPath.get(path);
      if (route === undefined) throw new NotFoundError(`route ${JSON.stringify(path)}`);
      if (request.method !== 'GET' && request.method !== 'POST') {
        return {
          status: 405,
          headers: { ...JSON_HEADERS, allow: 'GET, POST' },
          body: { error: { code: 'METHOD_NOT_ALLOWED', message: 'use GET or POST' } },
        };
      }

      const storeName = readStore(request, opts.defaultStore);
      const client = await opts.resolveStore(storeName);

      // Most routes analyse the mined log, so they resolve the shared
      // selection first — which needs an event log to exist. A few do not:
      // managing streams is what you do BEFORE anything has been mined, and
      // demanding a log there makes the first stream impossible to create.
      const options =
        route.needsLog === false
          ? { objectType: '' }
          : await readShared(request, client);

      const started = Date.now();
      const payload = await route.handle({ request, client, options, storeName });
      const elapsed = Date.now() - started;

      logger.info({ path, store: storeName, ms: elapsed }, 'mining request');

      const meta = {
        store: storeName,
        objectType: options.objectType,
        filter: options.filter === undefined ? null : describeFilter(options.filter),
        lifecycle: options.lifecycle ?? null,
        // Stated on every result. Eight working hours and eight wall-clock
        // hours are different measurements, and a reader comparing a figure
        // from one request against a figure from another needs to know which.
        clock: options.calendar === undefined ? 'wall-clock' : describeCalendar(options.calendar),
        elapsedMs: elapsed,
      };

      // Spreading is only safe over a plain object. An array spread into one
      // becomes {"0": …, "1": …} — still valid JSON, still 200, and utterly
      // wrong, which is the worst way for this to fail. A handler returning
      // anything else keeps its own value under `result` rather than being
      // silently reshaped.
      return ok(
        isPlainObject(payload)
          ? { ...payload, meta }
          : { result: payload, meta },
      );
    } catch (err) {
      return errorResponse(err, logger);
    }
  };
}

// ---------------------------------------------------------------------------

function ok(body: unknown): MiningResponse {
  return { status: 200, headers: JSON_HEADERS, body };
}

function errorResponse(err: unknown, logger: Logger): MiningResponse {
  if (err instanceof MalkomError) {
    // The engine's typed errors carry their own status and, for the honest
    // refusals, the remedies that make them actionable.
    const body: Record<string, unknown> = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    if ('remedies' in err) body['remedies'] = (err as { remedies: readonly string[] }).remedies;
    if ('issues' in err) body['issues'] = (err as { issues: readonly unknown[] }).issues;
    return { status: err.status, headers: JSON_HEADERS, body };
  }
  // A schema rejection is the CALLER's mistake, not ours. Left unmapped it
  // becomes a 500 saying "internal error", which tells someone with a
  // malformed body to go and read server logs they cannot see. The issues
  // describe the request they just sent, so returning them leaks nothing.
  if (err instanceof ZodError) {
    return {
      status: 422,
      headers: JSON_HEADERS,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: 'the request body is not valid',
          details: err.issues.map(
            (issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`,
          ),
        },
      },
    };
  }

  // Never leak an unexpected error's message: it may carry table names,
  // column names or a connection string.
  logger.error({ err: err instanceof Error ? err.message : String(err) }, 'unhandled request error');
  return {
    status: 500,
    headers: JSON_HEADERS,
    body: { error: { code: 'INTERNAL', message: 'internal error' } },
  };
}

function authenticate(
  request: MiningRequest,
  apiKeys: Record<string, string> | undefined,
  header: string,
): void {
  if (apiKeys === undefined) return;
  const supplied = request.headers?.[header] ?? request.headers?.[header.toLowerCase()];
  if (supplied === undefined || apiKeys[supplied] === undefined) {
    throw new UnauthorizedError();
  }
}

function normalise(path: string): string {
  const trimmed = path.split('?')[0]!.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function readStore(request: MiningRequest, fallback: string | undefined): string {
  const fromQuery = request.query.get('store');
  const fromBody = record(request.body)?.['store'];
  const name = fromQuery ?? (typeof fromBody === 'string' ? fromBody : undefined) ?? fallback;
  if (name === undefined) {
    throw new ConfigInvalidError('no store selected', [
      'pass ?store=<name>, or configure a default store on the router',
    ]);
  }
  return name;
}

/**
 * Shared options every route accepts.
 *
 * The object type defaults to whatever the store actually holds rather than a
 * hardcoded 'case', so a store built around bookings works without the caller
 * having to know what it is called.
 */
async function readShared(request: MiningRequest, client: SqlClient): Promise<SharedOptions> {
  const body = record(request.body);

  let objectType = request.query.get('objectType') ?? asString(body?.['objectType']);
  if (objectType === undefined) {
    const types = await availableObjectTypes(client, duckdbDialect);
    if (types.length === 0) throw new NotFoundError('an event log in this store');
    objectType = types[0]!.objectType;
  }

  const lifecycleRaw = request.query.get('lifecycle') ?? asString(body?.['lifecycle']);
  const lifecycle = lifecycleRaw
    ?.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Query filters use the terse grammar; a POST body may supply the structured
  // form directly, which is what a UI holding a built-up selection will send.
  const specs = request.query.getAll('filter');
  const parsed = specs.map(parseFilterSpec).filter((f): f is CaseFilter => f !== undefined);
  if (parsed.length !== specs.length) {
    throw new ConfigInvalidError(
      'one or more filters could not be parsed',
      FILTER_GRAMMAR.map((g) => `${g.form} — ${g.means}`),
    );
  }
  const structured = body?.['filter'];
  const filter = allOf(
    ...parsed,
    ...(structured !== undefined && structured !== null ? [structured as CaseFilter] : []),
  );

  const from = readDate(request.query.get('from') ?? asString(body?.['from']));
  const to = readDate(request.query.get('to') ?? asString(body?.['to']));
  const window = from !== undefined && to !== undefined ? { from, to } : undefined;

  // 'activity' (default), 'resource', or 'attr:key' for anything the events
  // carry. One parameter rather than two so a caller cannot ask for an
  // attribute perspective and forget to say which attribute.
  const perspectiveRaw = request.query.get('perspective') ?? asString(body?.['perspective']);
  const perspective = readPerspective(perspectiveRaw);

  // Probed per request rather than assumed: a store written by an older
  // version has no cost column, and every analysis must project a NULL there
  // instead of failing to bind.
  const capabilities = await detectCapabilities(client, duckdbDialect);

  const calendar = readCalendar(request);

  return {
    objectType,
    capabilities,
    ...(lifecycle !== undefined && lifecycle.length > 0 ? { lifecycle } : {}),
    ...(filter !== undefined ? { filter } : {}),
    ...(window !== undefined ? { window } : {}),
    ...(perspective !== undefined ? { perspective } : {}),
    ...(calendar !== undefined ? { calendar } : {}),
  };
}

/**
 * The working calendar for this request, if one was asked for.
 *
 * Accepted both ways for the same reason filters are: a person types the terse
 * form into a query string, and a UI holding a configured calendar posts the
 * structured one. Validated either way by the schema, so a bad zone is a 422
 * naming the field rather than a query that fails somewhere in the store.
 */
function readCalendar(request: MiningRequest): BusinessCalendar | undefined {
  const body = record(request.body);
  const structured = body?.['calendar'];
  const spec = request.query.get('calendar') ?? asString(structured);

  let candidate: unknown;
  if (spec !== undefined) {
    candidate = parseCalendarSpec(spec);
    if (candidate === undefined) {
      throw new ConfigInvalidError(
        `'${spec}' is not a working calendar`,
        CALENDAR_GRAMMAR.map((g) => `${g.form} — ${g.means}`),
      );
    }
  } else if (structured !== undefined && structured !== null && typeof structured === 'object') {
    candidate = structured;
  } else {
    return undefined;
  }

  const parsed = businessCalendarSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ConfigInvalidError(
      'the working calendar is not usable',
      parsed.error.issues.map((i) => `${i.path.join('.') || 'calendar'}: ${i.message}`),
    );
  }
  return parsed.data;
}

function readCohort(request: MiningRequest, key: 'a' | 'b'): CohortSpec | undefined {
  const body = record(request.body);
  const structured = body?.[key];
  if (structured !== undefined && structured !== null && typeof structured === 'object') {
    return structured as CohortSpec;
  }
  const spec = request.query.get(key) ?? asString(structured);
  if (spec === undefined) return undefined;
  if (spec === 'rest' || spec === 'complement') return { kind: 'complement' };
  return parseFilterSpec(spec);
}

function readOutcome(request: MiningRequest): OutcomeSpec {
  const body = record(request.body);
  const structured = body?.['outcome'];
  if (structured !== undefined && structured !== null && typeof structured === 'object') {
    return structured as OutcomeSpec;
  }
  const spec = request.query.get('outcome') ?? asString(structured) ?? 'slowest:0.2';
  const parsed = parseOutcomeSpec(spec);
  if (parsed === undefined) {
    throw new ConfigInvalidError(`outcome ${JSON.stringify(spec)} could not be parsed`, [
      'slowest:0.2 — the slowest fifth of cases',
      'slower-than:604800 — cases taking more than a week',
      'contains:Reject — cases that reach an activity',
      'missing:Pay — cases that never reach one',
    ]);
  }
  return parsed;
}

function readModel(request: MiningRequest): ReturnType<typeof mineProcessTree>['tree'] | undefined {
  const body = record(request.body);
  const fromBody = body?.['model'];
  if (fromBody !== undefined && fromBody !== null && typeof fromBody === 'object') {
    return fromBody as ReturnType<typeof mineProcessTree>['tree'];
  }
  const raw = request.query.get('model');
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as ReturnType<typeof mineProcessTree>['tree'];
  } catch {
    return undefined;
  }
}

function number(request: MiningRequest, key: string): number | undefined {
  // A query string only ever holds text, but a JSON body holds a real number —
  // and reading the body as a string discards it, so every numeric option sent
  // by a POSTing client was silently ignored while the request still
  // succeeded. Silent is the problem: a cap that does not apply looks exactly
  // like a cap that was not needed.
  const fromBody = record(request.body)?.[key];
  if (typeof fromBody === 'number') return Number.isFinite(fromBody) ? fromBody : undefined;

  const raw = request.query.get(key) ?? asString(fromBody);
  if (raw === undefined || raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Narrow a query string to a sort key the case list understands. */
function isCaseSort(value: string | null): value is CaseSort {
  return (
    value === 'start' ||
    value === 'end' ||
    value === 'duration' ||
    value === 'events' ||
    value === 'cost'
  );
}

/** IANA zone for a seasonality-style route. */
function zoneOpt(request: MiningRequest): Record<string, string> {
  const zone = request.query.get('timezone') ?? asString(record(request.body)?.['timezone']);
  return zone === undefined || zone === '' ? {} : { timezone: zone };
}

/** What a seasonality cell counts. */
function measureOpt(request: MiningRequest): Record<string, SeasonMeasure> {
  const value = request.query.get('measure') ?? asString(record(request.body)?.['measure']);
  return value === 'starts' || value === 'ends' || value === 'events' ? { measure: value } : {};
}

/** Bucket width for anything that returns a series. */
function granularityOpt(request: MiningRequest): Record<string, Granularity> {
  const value =
    request.query.get('granularity') ?? asString(record(request.body)?.['granularity']);
  return value === 'hour' || value === 'day' || value === 'week' || value === 'month'
    ? { granularity: value }
    : {};
}

function trendMetricOpt(request: MiningRequest): Record<string, TrendMetric> {
  const value = request.query.get('metric') ?? asString(record(request.body)?.['metric']);
  const known: readonly TrendMetric[] = [
    'cycle',
    'throughput',
    'arrivals',
    'waiting',
    'rework',
    'reworkCost',
    'stepDuration',
  ];
  return known.includes(value as TrendMetric) ? { metric: value as TrendMetric } : {};
}

function distributionMeasureOpt(request: MiningRequest): Record<string, DistributionMeasure> {
  const value = request.query.get('measure') ?? asString(record(request.body)?.['measure']);
  const known: readonly DistributionMeasure[] = ['cycle', 'handling', 'waiting', 'length'];
  return known.includes(value as DistributionMeasure)
    ? { measure: value as DistributionMeasure }
    : {};
}

/**
 * How a distribution is split.
 *
 * `attr:<key>` matches the perspective grammar, so one spelling of "by
 * attribute" serves the whole surface.
 */
function groupByOpt(request: MiningRequest): Record<string, GroupDimension> {
  const value = request.query.get('groupBy') ?? asString(record(request.body)?.['groupBy']);
  if (value === undefined || value === '' || value === 'none') return {};
  if (value === 'activity' || value === 'resource' || value === 'variant') {
    return { groupBy: { kind: value } };
  }
  if (value.startsWith('attr:')) {
    return { groupBy: { kind: 'attribute', key: value.slice(5) } };
  }
  throw new ConfigInvalidError(`'${value}' is not a grouping`, [
    'none, activity, resource, variant, or attr:<key>',
  ]);
}

function stringOpt(
  request: MiningRequest,
  key: string,
  target: string,
): Record<string, string> {
  const value = request.query.get(key) ?? asString(record(request.body)?.[key]);
  return value === undefined || value === '' ? {} : { [target]: value };
}

/** The evaluation instant. Defaults to now, and refuses text that is not a time. */
function readNow(request: MiningRequest): Date {
  const raw = request.query.get('now') ?? asString(record(request.body)?.['now']);
  if (raw === undefined) return new Date();
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) throw new ConfigInvalidError('now must be an ISO timestamp');
  return at;
}

/**
 * How to tell a running case from a finished one.
 *
 * Defaults to treating every case as open, which is the only honest default: a
 * log is a snapshot, and guessing an end activity would silently decide which
 * work counts as finished.
 */
function readOpenCaseRule(request: MiningRequest): OpenCaseRule {
  const body = record(request.body);
  const structured = body?.['openCases'];
  if (structured !== undefined && structured !== null && typeof structured === 'object') {
    const parsed = openCaseRuleSchema.safeParse(structured);
    if (!parsed.success) {
      throw new ConfigInvalidError(
        'openCases is not a usable rule',
        parsed.error.issues.map((i) => `${i.path.join('.') || 'openCases'}: ${i.message}`),
      );
    }
    return parsed.data;
  }

  const ends = request.query.get('endActivities');
  if (ends !== null && ends !== '') {
    const endActivities = ends
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    if (endActivities.length > 0) return { kind: 'missing-end-activity', endActivities };
  }

  const within = number(request, 'openWithin');
  if (within !== undefined) {
    return { kind: 'recent-activity', withinSeconds: Math.max(1, Math.trunc(within)) };
  }
  return { kind: 'all' };
}

/**
 * The model to check against: the caller's, or one discovered from the log.
 *
 * Discovering when none is given matches what `/v1/conformance` already does —
 * checking a log against itself is a real question ("how structured is this"),
 * and demanding a model before anybody has one makes the route unreachable.
 */
async function modelFor(
  client: SqlClient,
  options: SharedOptions,
  request: MiningRequest,
): Promise<ProcessTree> {
  const supplied = record(request.body)?.['model'];
  if (supplied !== undefined && supplied !== null && typeof supplied === 'object') {
    return supplied as ProcessTree;
  }
  const dfg = await buildDfg(client, duckdbDialect, options);
  return mineProcessTree(dfg).tree;
}

function numberOpt(request: MiningRequest, key: string, target: string): Record<string, number> {
  const n = number(request, key);
  return n === undefined ? {} : { [target]: n };
}

function readDate(raw: string | undefined | null): Date | undefined {
  if (raw === undefined || raw === null) return undefined;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Apply the node slider, if the caller moved it.
 *
 * Shared by discover and layout so the two cannot disagree about what the
 * simplified map contains — a laid-out graph whose nodes differ from the
 * discovered one would place boxes the caller never received.
 */
/** A spreadable object: not null, not an array, not a Date or a Map. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function readPerspective(raw: string | undefined): Perspective | undefined {
  if (raw === undefined || raw === '' || raw === 'activity') return undefined;
  if (raw === 'resource') return { kind: 'resource' };
  if (raw.startsWith('attr:')) {
    const key = raw.slice(5);
    if (key === '') {
      throw new ConfigInvalidError('perspective attr: needs an attribute name', [
        'perspective=attr:status',
      ]);
    }
    return { kind: 'attribute', key };
  }
  throw new ConfigInvalidError(`unknown perspective ${JSON.stringify(raw)}`, [
    'activity — the recorded step (default)',
    'resource — who did it',
    'attr:<key> — any event attribute',
  ]);
}

/**
 * Thin the map down to what a reader can take in.
 *
 * Two ways to do it, and which one is right depends on what they are asking.
 * Hiding answers "show me the busy process" — the quiet steps go and the paths
 * through them are bridged. Grouping answers "and what am I not being shown" —
 * they stay as openable boxes carrying their own traffic. A map with twelve
 * steps silently absent looks exactly like a map of a simpler process, so the
 * choice is the caller's rather than ours.
 */
function simplify(dfg: Dfg, request: MiningRequest): Dfg {
  const keep = number(request, 'nodes');
  if (keep === undefined || keep >= 1) return dfg;

  if (request.query.get('group') === 'true') {
    const minCluster = number(request, 'minCluster');
    return groupRareActivities(dfg, {
      keep,
      ...(minCluster !== undefined ? { minClusterSize: minCluster } : {}),
    });
  }
  return abstractNodes(dfg, { keep });
}
