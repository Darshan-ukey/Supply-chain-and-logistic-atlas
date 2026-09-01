import type { ProcessTree } from '../runtime/inductive.js';
import type { ModuleImporter } from '../sql/clients.js';
import { XmlWriter, toNcName } from './xml.js';

/**
 * BPMN 2.0 export.
 *
 * PNML is what the research tools read; BPMN is what the business reads. A
 * discovered process that cannot be opened in Camunda, Signavio or Bizagi is a
 * finding trapped inside the tool that found it, and "send me the process map"
 * is the most ordinary request there is.
 *
 * The translation is from the process tree rather than the directly-follows
 * graph, because a DFG has no notion of a gateway: it records that two things
 * followed each other, not whether the choice between them was exclusive or
 * parallel. The tree carries exactly that, so the gateways come out right.
 *
 * Diagram interchange is emitted, not skipped. Without it bpmn-js renders an
 * empty canvas, and a file that opens blank is indistinguishable from a broken
 * export.
 */

export interface BpmnOptions {
  processId?: string;
  name?: string;
  /**
   * Omit coordinates. Only sensible for a consumer that lays out itself; most
   * viewers show nothing.
   */
  withoutDiagram?: boolean;
  /** Test seam for the optional elkjs import used to place the shapes. */
  importModule?: ModuleImporter;
}

type ElementKind =
  | 'startEvent'
  | 'endEvent'
  | 'task'
  | 'exclusiveGateway'
  | 'parallelGateway';

interface BpmnElement {
  id: string;
  kind: ElementKind;
  name?: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface BpmnFlow {
  id: string;
  source: string;
  target: string;
  name?: string;
  waypoints?: { x: number; y: number }[];
}

export interface BpmnGraph {
  elements: BpmnElement[];
  flows: BpmnFlow[];
}

const TASK_SIZE = { width: 120, height: 80 };
const GATEWAY_SIZE = { width: 50, height: 50 };
const EVENT_SIZE = { width: 36, height: 36 };

/**
 * Build the BPMN element graph from a process tree.
 *
 * Each subtree is compiled to a fragment with one entry and one exit, which is
 * what keeps gateways balanced: every split gets its matching join, and a model
 * with unbalanced gateways is rejected by most engines and silently mis-drawn
 * by the rest.
 */
export function bpmnFromTree(tree: ProcessTree): BpmnGraph {
  const elements: BpmnElement[] = [];
  const flows: BpmnFlow[] = [];
  let seq = 0;
  const usedIds = new Set<string>();

  const add = (kind: ElementKind, name?: string): string => {
    seq += 1;
    const base =
      name === undefined ? `${kind}_${seq}` : toNcName(name, `${kind}_${seq}`);
    // Two activities can share a name after sanitising ("R&D" and "R D"), and
    // duplicate ids make the file invalid.
    let id = base;
    let suffix = 1;
    while (usedIds.has(id)) id = `${base}_${(suffix += 1)}`;
    usedIds.add(id);

    const size =
      kind === 'task'
        ? TASK_SIZE
        : kind === 'exclusiveGateway' || kind === 'parallelGateway'
          ? GATEWAY_SIZE
          : EVENT_SIZE;
    elements.push({ id, kind, ...(name !== undefined ? { name } : {}), ...size });
    return id;
  };

  const connect = (source: string, target: string, name?: string): void => {
    seq += 1;
    flows.push({ id: `flow_${seq}`, source, target, ...(name !== undefined ? { name } : {}) });
  };

  /** Compile a node, returning its entry and exit element ids. */
  const compile = (node: ProcessTree): { entry: string; exit: string } => {
    switch (node.op) {
      case 'activity': {
        const id = add('task', node.label);
        return { entry: id, exit: id };
      }
      case 'tau': {
        // A silent step becomes an unlabelled pass-through gateway rather than
        // a task: a task named "tau" would appear in the model as work someone
        // is supposed to do.
        const id = add('exclusiveGateway');
        return { entry: id, exit: id };
      }
      case 'seq': {
        if (node.children.length === 0) return compile({ op: 'tau' });
        const parts = node.children.map(compile);
        for (let i = 0; i < parts.length - 1; i += 1) {
          connect(parts[i]!.exit, parts[i + 1]!.entry);
        }
        return { entry: parts[0]!.entry, exit: parts[parts.length - 1]!.exit };
      }
      case 'xor':
      case 'and': {
        if (node.children.length === 0) return compile({ op: 'tau' });
        if (node.children.length === 1) return compile(node.children[0]!);
        const kind = node.op === 'xor' ? 'exclusiveGateway' : 'parallelGateway';
        const split = add(kind);
        const join = add(kind);
        for (const child of node.children) {
          const part = compile(child);
          connect(split, part.entry);
          connect(part.exit, join);
        }
        return { entry: split, exit: join };
      }
      case 'loop': {
        const [body, ...redos] = node.children;
        if (body === undefined) return compile({ op: 'tau' });
        // Entry gateway is the loop-back target; exit gateway is the decision
        // point that either leaves or goes round again.
        const entry = add('exclusiveGateway');
        const exit = add('exclusiveGateway');
        const compiledBody = compile(body);
        connect(entry, compiledBody.entry);
        connect(compiledBody.exit, exit);
        for (const redo of redos) {
          const part = compile(redo);
          connect(exit, part.entry, 'repeat');
          connect(part.exit, entry);
        }
        return { entry, exit };
      }
    }
  };

  const start = add('startEvent');
  const compiled = compile(tree);
  const end = add('endEvent');
  connect(start, compiled.entry);
  connect(compiled.exit, end);

  return { elements, flows };
}

/** The slice of ELK this module needs, declared structurally. */
interface ElkPoint {
  x: number;
  y: number;
}
interface ElkLaidOut {
  children?: { id: string; x?: number; y?: number }[];
  edges?: {
    id: string;
    sections?: { startPoint: ElkPoint; endPoint: ElkPoint; bendPoints?: ElkPoint[] }[];
  }[];
}
interface ElkEngine {
  layout(graph: unknown): Promise<ElkLaidOut>;
}
type ElkConstructor = new (args?: Record<string, unknown>) => ElkEngine;

/**
 * Place the BPMN shapes with ELK, so the exported file opens as a diagram.
 *
 * Falls back to a simple stacked layout when elkjs is not installed. An
 * untidy diagram still opens and can be rearranged; a file with no diagram
 * interchange at all opens blank, which is indistinguishable from a broken
 * export.
 */
export async function layoutBpmn(graph: BpmnGraph, opts: BpmnOptions = {}): Promise<BpmnGraph> {
  const load = opts.importModule ?? ((specifier: string) => import(specifier));

  let Elk: ElkConstructor | undefined;
  try {
    const mod = (await load('elkjs/lib/elk.bundled.js')) as { default?: ElkConstructor };
    Elk = typeof mod.default === 'function' ? mod.default : undefined;
  } catch {
    Elk = undefined;
  }

  if (Elk === undefined) {
    let y = 40;
    return {
      elements: graph.elements.map((e) => {
        const placed = { ...e, x: 200, y };
        y += e.height + 40;
        return placed;
      }),
      flows: graph.flows,
    };
  }

  const elk = new Elk();
  const laid = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
    },
    children: graph.elements.map((e) => ({ id: e.id, width: e.width, height: e.height })),
    edges: graph.flows.map((f) => ({ id: f.id, sources: [f.source], targets: [f.target] })),
  });

  const positions = new Map((laid.children ?? []).map((c) => [c.id, c]));
  const routes = new Map((laid.edges ?? []).map((e) => [e.id, e]));

  return {
    elements: graph.elements.map((e) => {
      const placed = positions.get(e.id);
      return { ...e, x: placed?.x ?? 0, y: placed?.y ?? 0 };
    }),
    flows: graph.flows.map((f) => {
      const section = routes.get(f.id)?.sections?.[0];
      if (section === undefined) return f;
      return {
        ...f,
        waypoints: [section.startPoint, ...(section.bendPoints ?? []), section.endPoint],
      };
    }),
  };
}

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';
const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI';
const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC';

export function toBpmnXml(graph: BpmnGraph, opts: BpmnOptions = {}): string {
  const processId = opts.processId ?? 'Process_1';
  const xml = new XmlWriter();

  xml.declaration();
  xml.open('bpmn:definitions', {
    'xmlns:bpmn': BPMN_NS,
    'xmlns:bpmndi': BPMNDI_NS,
    'xmlns:di': DI_NS,
    'xmlns:dc': DC_NS,
    id: 'Definitions_1',
    targetNamespace: 'http://malkom.dev/processmining',
  });

  // isExecutable is false on purpose: this is a DISCOVERED model, a
  // description of what happened, not something anyone should deploy and run.
  xml.open('bpmn:process', {
    id: processId,
    name: opts.name ?? 'Discovered process',
    isExecutable: 'false',
  });

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const flow of graph.flows) {
    (outgoing.get(flow.source) ?? outgoing.set(flow.source, []).get(flow.source)!).push(flow.id);
    (incoming.get(flow.target) ?? incoming.set(flow.target, []).get(flow.target)!).push(flow.id);
  }

  for (const element of graph.elements) {
    const tag = `bpmn:${element.kind}`;
    const attrs: Record<string, string> = { id: element.id };
    if (element.name !== undefined) attrs['name'] = element.name;
    // A gateway with several outgoing flows must declare its direction, or
    // strict importers reject the file.
    if (element.kind === 'exclusiveGateway' || element.kind === 'parallelGateway') {
      const outs = outgoing.get(element.id)?.length ?? 0;
      const ins = incoming.get(element.id)?.length ?? 0;
      attrs['gatewayDirection'] = outs > 1 ? 'Diverging' : ins > 1 ? 'Converging' : 'Unspecified';
    }

    xml.open(tag, attrs);
    for (const id of incoming.get(element.id) ?? []) xml.text('bpmn:incoming', id);
    for (const id of outgoing.get(element.id) ?? []) xml.text('bpmn:outgoing', id);
    xml.close(tag);
  }

  for (const flow of graph.flows) {
    xml.empty('bpmn:sequenceFlow', {
      id: flow.id,
      sourceRef: flow.source,
      targetRef: flow.target,
      ...(flow.name !== undefined ? { name: flow.name } : {}),
    });
  }

  xml.close('bpmn:process');

  if (opts.withoutDiagram !== true) {
    xml.open('bpmndi:BPMNDiagram', { id: 'Diagram_1' });
    xml.open('bpmndi:BPMNPlane', { id: 'Plane_1', bpmnElement: processId });

    for (const element of graph.elements) {
      xml.open('bpmndi:BPMNShape', {
        id: `${element.id}_shape`,
        bpmnElement: element.id,
        ...(element.kind === 'exclusiveGateway' || element.kind === 'parallelGateway'
          ? { isMarkerVisible: 'true' }
          : {}),
      });
      xml.empty('dc:Bounds', {
        x: Math.round(element.x ?? 0),
        y: Math.round(element.y ?? 0),
        width: element.width,
        height: element.height,
      });
      xml.close('bpmndi:BPMNShape');
    }

    for (const flow of graph.flows) {
      xml.open('bpmndi:BPMNEdge', { id: `${flow.id}_edge`, bpmnElement: flow.id });
      const points = flow.waypoints ?? fallbackWaypoints(graph, flow);
      for (const point of points) {
        xml.empty('di:waypoint', { x: Math.round(point.x), y: Math.round(point.y) });
      }
      xml.close('bpmndi:BPMNEdge');
    }

    xml.close('bpmndi:BPMNPlane');
    xml.close('bpmndi:BPMNDiagram');
  }

  xml.close('bpmn:definitions');
  return xml.toString();
}

/**
 * A straight line between shape centres.
 *
 * BPMN requires at least two waypoints per edge; an edge with none makes the
 * whole diagram fail to render in bpmn-js rather than just that one arc.
 */
function fallbackWaypoints(graph: BpmnGraph, flow: BpmnFlow): { x: number; y: number }[] {
  const find = (id: string) => graph.elements.find((e) => e.id === id);
  const centre = (element: BpmnElement | undefined) => ({
    x: (element?.x ?? 0) + (element?.width ?? 0) / 2,
    y: (element?.y ?? 0) + (element?.height ?? 0) / 2,
  });
  return [centre(find(flow.source)), centre(find(flow.target))];
}

/** Process tree straight to a laid-out BPMN file. */
export async function treeToBpmn(tree: ProcessTree, opts: BpmnOptions = {}): Promise<string> {
  const graph = bpmnFromTree(tree);
  const laid = opts.withoutDiagram === true ? graph : await layoutBpmn(graph, opts);
  return toBpmnXml(laid, opts);
}
