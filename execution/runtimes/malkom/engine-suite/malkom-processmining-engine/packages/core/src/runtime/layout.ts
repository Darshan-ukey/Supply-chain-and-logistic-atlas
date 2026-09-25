import { ConfigInvalidError } from '../domain/errors.js';
import type { ModuleImporter } from '../sql/clients.js';
import type { Dfg } from './dfg.js';

/**
 * Turning a discovered graph into coordinates.
 *
 * Computed here rather than in the browser for two reasons. A four-hundred
 * node map takes seconds to lay out, and the result is identical for every
 * viewer — so it is computed once and cached rather than recomputed on every
 * page load. And laying out server-side keeps the engine's promise intact: it
 * emits data and geometry, never pixels. Nothing here knows a colour.
 *
 * ELK's layered algorithm is used over dagre because process maps are layered
 * DAGs full of rework loops and edge labels, and dagre tangles on exactly
 * those. `elkjs` is an OPTIONAL peer — a host that renders elsewhere, or lays
 * out client-side, never installs it.
 *
 * Licence note: elkjs is EPL-2.0 OR GPL-3.0, not MIT like the rest of this
 * engine. Depending on it as an optional peer keeps that choice with the host,
 * which is why it is not a hard dependency.
 */

export interface LayoutOptions {
  /** 'DOWN' reads like a flowchart; 'RIGHT' suits wide, shallow processes. */
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT';
  /** Gap between nodes in the same layer. */
  nodeSpacing?: number;
  /** Gap between layers. */
  layerSpacing?: number;
  /** Approximate width of one character at the renderer's font size. */
  charWidth?: number;
  nodeHeight?: number;
  minNodeWidth?: number;
  maxNodeWidth?: number;
  /** Add synthetic start and end markers, as a real process map has. */
  includeEndpoints?: boolean;
  /** Test seam for the optional elkjs import. */
  importModule?: ModuleImporter;
}

export type NodeKind = 'activity' | 'start' | 'end';

export interface LaidOutNode {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  frequency: number;
  caseCount: number;
  medianDurationSeconds: number | null;
  /** Cost across the selection, and a 0–1 weight against the costliest step. */
  totalCost: number | null;
  medianCost: number | null;
  /**
   * 0–1 against the most expensive activity, or null when the log has no cost.
   *
   * A third channel alongside volume and delay, deliberately separate from
   * both: the slowest step and the most expensive step are frequently not the
   * same one, and that disagreement is usually the finding.
   */
  costWeight: number | null;
  /**
   * 0–1 against the busiest activity.
   *
   * Returned so the renderer maps one number to whatever it uses — fill
   * intensity, border weight, font size — without recomputing the scale and
   * without the engine choosing a colour.
   */
  weight: number;
}

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  frequency: number;
  caseCount: number;
  medianSeconds: number | null;
  /** 0–1 against the busiest arc. Drives line thickness. */
  weight: number;
  /**
   * 0–1 against the slowest arc. Drives bottleneck heat.
   *
   * Deliberately separate from `weight`: a rare arc can be the slowest, and a
   * busy one can be instant. Collapsing both into a single visual channel is
   * what makes a map look informative while hiding the actual delay.
   */
  delayWeight: number;
  /** Polyline from source to target, including bend points. */
  points: { x: number; y: number }[];
  /** Midpoint of the route, for placing a frequency or duration label. */
  labelAnchor: { x: number; y: number };
  /** True when the arc returns to its own source — rework. */
  selfLoop: boolean;
}

export interface LaidOutGraph {
  width: number;
  height: number;
  direction: string;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  /** The maxima the weights are relative to, so a legend can show real values. */
  scales: {
    maxNodeFrequency: number;
    maxEdgeFrequency: number;
    maxEdgeMedianSeconds: number;
    maxNodeMedianDurationSeconds: number;
    /** Null when the log records no cost, so a legend can omit the scale entirely. */
    maxNodeTotalCost: number | null;
  };
}

const DEFAULTS = {
  direction: 'DOWN' as const,
  nodeSpacing: 40,
  layerSpacing: 60,
  charWidth: 7.2,
  nodeHeight: 44,
  minNodeWidth: 90,
  maxNodeWidth: 260,
};

export const START_NODE_ID = '__start__';
export const END_NODE_ID = '__end__';

/** Minimal shapes of the ELK API this module uses, declared structurally. */
interface ElkPoint {
  x: number;
  y: number;
}
interface ElkSection {
  startPoint: ElkPoint;
  endPoint: ElkPoint;
  bendPoints?: ElkPoint[];
}
interface ElkNodeLike {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkNodeLike[];
  edges?: ElkEdgeLike[];
  layoutOptions?: Record<string, string>;
}
interface ElkEdgeLike {
  id: string;
  sources: string[];
  targets: string[];
  sections?: ElkSection[];
}
interface ElkLike {
  layout(graph: ElkNodeLike): Promise<ElkNodeLike>;
}
interface ElkModuleLike {
  default?: new (args?: Record<string, unknown>) => ElkLike;
}

export async function layoutDfg(dfg: Dfg, opts: LayoutOptions = {}): Promise<LaidOutGraph> {
  const settings = { ...DEFAULTS, ...opts };
  const includeEndpoints = opts.includeEndpoints ?? true;

  const Elk = await loadElk(opts.importModule);
  const elk = new Elk();

  const activityStats = new Map(dfg.activities.map((a) => [a.activity, a]));
  const maxNodeFrequency = Math.max(1, ...dfg.activities.map((a) => a.frequency));
  const maxEdgeFrequency = Math.max(1, ...dfg.edges.map((e) => e.frequency));
  const maxEdgeMedian = Math.max(
    0,
    ...dfg.edges.map((e) => e.medianSeconds ?? 0).filter((n) => Number.isFinite(n)),
  );
  const maxNodeDuration = Math.max(
    0,
    ...dfg.activities.map((a) => a.medianDurationSeconds ?? 0).filter((n) => Number.isFinite(n)),
  );
  // Total, not median: the cost overlay answers "where does the money go",
  // which is a question about the whole selection rather than one execution.
  const maxNodeCost = Math.max(
    0,
    ...dfg.activities.map((a) => a.totalCost ?? 0).filter((n) => Number.isFinite(n)),
  );

  const nodes: ElkNodeLike[] = dfg.activities.map((a) => ({
    id: a.activity,
    width: nodeWidth(a.activity, settings),
    height: settings.nodeHeight,
  }));

  const edges: ElkEdgeLike[] = dfg.edges.map((e, i) => ({
    id: `e${i}`,
    sources: [e.from],
    targets: [e.to],
  }));

  if (includeEndpoints) {
    // Markers are small circles, not labelled boxes; sizing them like an
    // activity would push the whole first layer sideways.
    nodes.push({ id: START_NODE_ID, width: 28, height: 28 });
    nodes.push({ id: END_NODE_ID, width: 28, height: 28 });
    let n = dfg.edges.length;
    for (const activity of dfg.starts.keys()) {
      edges.push({ id: `e${n++}`, sources: [START_NODE_ID], targets: [activity] });
    }
    for (const activity of dfg.ends.keys()) {
      edges.push({ id: `e${n++}`, sources: [activity], targets: [END_NODE_ID] });
    }
  }

  const graph: ElkNodeLike = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': settings.direction,
      'elk.spacing.nodeNode': String(settings.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(settings.layerSpacing),
      // ORTHOGONAL routing gives clean right-angled arcs, which is what makes
      // a dense map readable; splines cross each other into a tangle.
      'elk.edgeRouting': 'ORTHOGONAL',
      // Rework loops make process graphs cyclic, and the layered algorithm
      // needs a strategy for breaking them or it produces nothing usable.
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.mergeEdges': 'false',
    },
    children: nodes,
    edges,
  };

  const result = await elk.layout(graph);
  const placed = new Map((result.children ?? []).map((n) => [n.id, n]));
  const routed = new Map((result.edges ?? []).map((e) => [e.id, e]));

  const laidOutNodes: LaidOutNode[] = (result.children ?? []).map((n) => {
    const stats = activityStats.get(n.id);
    const kind: NodeKind =
      n.id === START_NODE_ID ? 'start' : n.id === END_NODE_ID ? 'end' : 'activity';
    return {
      id: n.id,
      label: kind === 'activity' ? n.id : kind,
      kind,
      x: n.x ?? 0,
      y: n.y ?? 0,
      width: n.width ?? 0,
      height: n.height ?? 0,
      frequency: stats?.frequency ?? 0,
      caseCount: stats?.caseCount ?? 0,
      medianDurationSeconds: stats?.medianDurationSeconds ?? null,
      totalCost: stats?.totalCost ?? null,
      medianCost: stats?.medianCost ?? null,
      costWeight:
        stats?.totalCost === null || stats?.totalCost === undefined || maxNodeCost === 0
          ? null
          : stats.totalCost / maxNodeCost,
      weight: stats === undefined ? 0 : stats.frequency / maxNodeFrequency,
    };
  });

  const laidOutEdges: LaidOutEdge[] = dfg.edges.map((e, i) => {
    const section = routed.get(`e${i}`)?.sections?.[0];
    const points = section === undefined ? fallbackRoute(placed, e.from, e.to) : sectionPoints(section);
    return {
      id: `e${i}`,
      from: e.from,
      to: e.to,
      frequency: e.frequency,
      caseCount: e.caseCount,
      medianSeconds: e.medianSeconds,
      weight: e.frequency / maxEdgeFrequency,
      delayWeight: maxEdgeMedian > 0 ? (e.medianSeconds ?? 0) / maxEdgeMedian : 0,
      points,
      labelAnchor: midpoint(points),
      selfLoop: e.from === e.to,
    };
  });

  if (includeEndpoints) {
    let n = dfg.edges.length;
    for (const [activity, count] of dfg.starts) {
      laidOutEdges.push(endpointEdge(`e${n++}`, START_NODE_ID, activity, count, routed, placed));
    }
    for (const [activity, count] of dfg.ends) {
      laidOutEdges.push(endpointEdge(`e${n++}`, activity, END_NODE_ID, count, routed, placed));
    }
  }

  return {
    width: result.width ?? 0,
    height: result.height ?? 0,
    direction: settings.direction,
    nodes: laidOutNodes,
    edges: laidOutEdges,
    scales: {
      maxNodeFrequency,
      maxEdgeFrequency,
      maxEdgeMedianSeconds: maxEdgeMedian,
      maxNodeMedianDurationSeconds: maxNodeDuration,
      maxNodeTotalCost: maxNodeCost > 0 ? maxNodeCost : null,
    },
  };
}

function endpointEdge(
  id: string,
  from: string,
  to: string,
  count: number,
  routed: Map<string, ElkEdgeLike>,
  placed: Map<string, ElkNodeLike>,
): LaidOutEdge {
  const section = routed.get(id)?.sections?.[0];
  const points = section === undefined ? fallbackRoute(placed, from, to) : sectionPoints(section);
  return {
    id,
    from,
    to,
    frequency: count,
    caseCount: count,
    medianSeconds: null,
    weight: 0,
    delayWeight: 0,
    points,
    labelAnchor: midpoint(points),
    selfLoop: false,
  };
}

function sectionPoints(section: ElkSection): { x: number; y: number }[] {
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((p) => ({
    x: p.x,
    y: p.y,
  }));
}

/**
 * A straight line between node centres.
 *
 * ELK omits a section for an edge it could not route — a self-loop in some
 * configurations. Returning an empty polyline would make the arc silently
 * vanish from the map, so a crude route is drawn instead and the arc stays
 * visible.
 */
function fallbackRoute(
  placed: Map<string, ElkNodeLike>,
  from: string,
  to: string,
): { x: number; y: number }[] {
  const a = placed.get(from);
  const b = placed.get(to);
  const centre = (n: ElkNodeLike | undefined) => ({
    x: (n?.x ?? 0) + (n?.width ?? 0) / 2,
    y: (n?.y ?? 0) + (n?.height ?? 0) / 2,
  });
  const start = centre(a);
  const end = centre(b);
  if (from === to) {
    // A visible loop above the node rather than a zero-length point.
    return [
      { x: start.x, y: start.y },
      { x: start.x + 40, y: start.y - 30 },
      { x: start.x, y: start.y },
    ];
  }
  return [start, end];
}

function midpoint(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0]! };
  const mid = points[Math.floor(points.length / 2)]!;
  return { ...mid };
}

interface SizingSettings {
  charWidth: number;
  minNodeWidth: number;
  maxNodeWidth: number;
}

function nodeWidth(label: string, settings: SizingSettings): number {
  const estimated = label.length * settings.charWidth + 28;
  return Math.min(settings.maxNodeWidth, Math.max(settings.minNodeWidth, Math.round(estimated)));
}

async function loadElk(
  importModule?: ModuleImporter,
): Promise<new (args?: Record<string, unknown>) => ElkLike> {
  const load = importModule ?? ((specifier: string) => import(specifier));
  let mod: ElkModuleLike;
  try {
    // The bundled build runs in-process. The default entry expects a Web
    // Worker, which Node does not provide by the same name.
    mod = (await load('elkjs/lib/elk.bundled.js')) as ElkModuleLike;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      throw new ConfigInvalidError(
        'layout requires the optional elkjs package — npm install elkjs (note: EPL-2.0 OR GPL-3.0, unlike this engine)',
      );
    }
    throw err;
  }
  const Elk = mod.default;
  if (typeof Elk !== 'function') {
    throw new ConfigInvalidError('elkjs did not export a constructor — incompatible version?');
  }
  return Elk;
}

/**
 * A stable key for caching a layout.
 *
 * The same graph laid out twice gives the same coordinates, so the result can
 * be cached against its input rather than recomputed per viewer. Frequencies
 * are excluded: they change the weights, not the geometry, and including them
 * would miss the cache on every refresh for no benefit.
 */
export function layoutCacheKey(dfg: Dfg, opts: LayoutOptions = {}): string {
  const structure = [
    dfg.objectType,
    ...dfg.activities.map((a) => a.activity).sort(),
    '|',
    ...dfg.edges.map((e) => `${e.from}>${e.to}`).sort(),
    '|',
    ...[...dfg.starts.keys()].sort(),
    '|',
    ...[...dfg.ends.keys()].sort(),
    '|',
    opts.direction ?? DEFAULTS.direction,
    String(opts.nodeSpacing ?? DEFAULTS.nodeSpacing),
    String(opts.layerSpacing ?? DEFAULTS.layerSpacing),
    String(opts.includeEndpoints ?? true),
  ].join('');
  // FNV-1a: short, stable, and no crypto dependency for a cache key.
  let hash = 0x811c9dc5;
  for (let i = 0; i < structure.length; i += 1) {
    hash ^= structure.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
