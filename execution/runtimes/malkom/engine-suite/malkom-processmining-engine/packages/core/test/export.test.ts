import { describe, expect, it } from 'vitest';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { ProcessTree } from '../src/runtime/inductive.js';
import { treeToPetriNet, modelActivities } from '../src/runtime/petrinet.js';
import { toPnml, treeToPnml } from '../src/export/pnml.js';
import { bpmnFromTree, toBpmnXml, treeToBpmn } from '../src/export/bpmn.js';
import { escapeAttribute, escapeText, sanitise, toNcName } from '../src/export/xml.js';

/**
 * Export correctness is checked by PARSING the output, not by matching
 * strings. A file that merely looks right and does not parse is the whole
 * failure mode here: every downstream tool rejects it with an error that
 * blames the tool rather than the file.
 */

const SEQ: ProcessTree = {
  op: 'seq',
  children: [
    { op: 'activity', label: 'Submit' },
    { op: 'activity', label: 'Approve' },
  ],
};

const RICH: ProcessTree = {
  op: 'seq',
  children: [
    { op: 'activity', label: 'Create PO' },
    { op: 'xor', children: [{ op: 'activity', label: 'Reject' }, { op: 'tau' }] },
    { op: 'and', children: [{ op: 'activity', label: 'Receipt' }, { op: 'activity', label: 'Invoice' }] },
    { op: 'loop', children: [{ op: 'activity', label: 'Chase' }, { op: 'activity', label: 'Wait' }] },
    { op: 'activity', label: 'Pay' },
  ],
};

function parse(xml: string): Record<string, unknown> {
  expect(XMLValidator.validate(xml)).toBe(true);
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) =>
      ['place', 'transition', 'arc', 'task', 'sequenceFlow', 'exclusiveGateway',
       'parallelGateway', 'startEvent', 'endEvent', 'BPMNShape', 'BPMNEdge',
       'waypoint', 'incoming', 'outgoing'].includes(name.replace(/^.*:/, '')),
  }).parse(xml) as Record<string, unknown>;
}

describe('XML escaping', () => {
  it('escapes the characters that break a file', () => {
    expect(escapeText('R&D <urgent>')).toBe('R&amp;D &lt;urgent&gt;');
    expect(escapeAttribute('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('strips control characters XML cannot carry even escaped', () => {
    const dirty = `Approve${String.fromCharCode(7)}${String.fromCharCode(0)}`;
    expect(sanitise(dirty)).toBe('Approve');
    // Tab, newline and carriage return are legal and must survive.
    expect(sanitise('a\tb\nc')).toBe('a\tb\nc');
  });

  it('derives a valid NCName from arbitrary text', () => {
    expect(toNcName('Create PO', 'x')).toBe('Create_PO');
    // An id may not start with a digit.
    expect(toNcName('2nd approval', 'x').startsWith('_')).toBe(true);
    expect(toNcName('###', 'fallback')).toBe('___');
  });
});

describe('PNML', () => {
  it('produces a valid document', () => {
    const doc = parse(treeToPnml(SEQ));
    expect(doc['pnml']).toBeDefined();
  });

  it('marks exactly one initial and one final place', () => {
    const net = treeToPetriNet(SEQ);
    const doc = parse(toPnml(net)) as Record<string, Record<string, Record<string, unknown>>>;
    const page = doc['pnml']!['net']!['page'] as Record<string, unknown>;
    const places = page['place'] as Record<string, unknown>[];

    const withMarking = places.filter((p) => p['initialMarking'] !== undefined);
    // A net with the wrong initial marking replays differently in every tool
    // that opens it.
    expect(withMarking).toHaveLength(1);
    expect(withMarking[0]!['@_id']).toBe(net.initial);

    // `place` is configured as always-array in the parser, so index into it.
    const finals = doc['pnml']!['net']!['finalmarkings'] as Record<string, Record<string, unknown>>;
    const finalPlaces = finals['marking']!['place'] as Record<string, unknown>[];
    expect(finalPlaces).toHaveLength(1);
    expect(finalPlaces[0]!['@_idref']).toBe(net.final);
  });

  it('carries every place, transition and arc', () => {
    const net = treeToPetriNet(RICH);
    const doc = parse(toPnml(net)) as Record<string, Record<string, Record<string, unknown>>>;
    const page = doc['pnml']!['net']!['page'] as Record<string, unknown[]>;

    expect((page['place'] as unknown[]).length).toBe(net.places.length);
    expect((page['transition'] as unknown[]).length).toBe(net.transitions.length);
    expect((page['arc'] as unknown[]).length).toBe(net.arcs.length);
  });

  it('marks silent transitions invisible', () => {
    const net = treeToPetriNet(RICH);
    const doc = parse(toPnml(net)) as Record<string, Record<string, Record<string, unknown>>>;
    const transitions = (doc['pnml']!['net']!['page'] as Record<string, unknown[]>)[
      'transition'
    ] as Record<string, unknown>[];

    const silentCount = net.transitions.filter((t) => t.label === null).length;
    const marked = transitions.filter((t) => t['toolspecific'] !== undefined);
    // Without the marker a tau becomes an activity nobody ever performed, and
    // every conformance figure computed elsewhere disagrees with ours.
    expect(marked).toHaveLength(silentCount);
  });

  it('survives an activity name full of XML metacharacters', () => {
    const awkward: ProcessTree = {
      op: 'activity',
      label: 'R&D <review> "urgent"',
    };
    const doc = parse(treeToPnml(awkward));
    expect(doc['pnml']).toBeDefined();
  });
});

describe('BPMN', () => {
  it('produces a valid document', async () => {
    const doc = parse(await treeToBpmn(SEQ));
    expect(doc['bpmn:definitions']).toBeDefined();
  });

  it('emits one start event and one end event', () => {
    const graph = bpmnFromTree(RICH);
    expect(graph.elements.filter((e) => e.kind === 'startEvent')).toHaveLength(1);
    expect(graph.elements.filter((e) => e.kind === 'endEvent')).toHaveLength(1);
  });

  it('turns a choice into an exclusive gateway and concurrency into a parallel one', () => {
    const graph = bpmnFromTree(RICH);
    expect(graph.elements.some((e) => e.kind === 'parallelGateway')).toBe(true);
    expect(graph.elements.filter((e) => e.kind === 'exclusiveGateway').length).toBeGreaterThan(0);
    // A DFG cannot make this distinction; the process tree can, which is why
    // the export is built from the tree.
    const parallels = graph.elements.filter((e) => e.kind === 'parallelGateway');
    expect(parallels).toHaveLength(2); // a split and its matching join
  });

  it('gives every activity a task', () => {
    const graph = bpmnFromTree(RICH);
    const tasks = graph.elements.filter((e) => e.kind === 'task').map((e) => e.name);
    for (const activity of modelActivities(treeToPetriNet(RICH))) {
      expect(tasks).toContain(activity);
    }
  });

  it('leaves no element unconnected', () => {
    // A dangling shape is a model that cannot execute and renders as a stray
    // box floating beside the diagram.
    const graph = bpmnFromTree(RICH);
    const touched = new Set<string>();
    for (const flow of graph.flows) {
      touched.add(flow.source);
      touched.add(flow.target);
    }
    for (const element of graph.elements) {
      expect(touched.has(element.id)).toBe(true);
    }
  });

  it('references only elements that exist', () => {
    const graph = bpmnFromTree(RICH);
    const ids = new Set(graph.elements.map((e) => e.id));
    for (const flow of graph.flows) {
      expect(ids.has(flow.source)).toBe(true);
      expect(ids.has(flow.target)).toBe(true);
    }
  });

  it('gives every element a unique id even when names collide after sanitising', () => {
    // 'R&D' and 'R D' both become 'R_D'; duplicate ids make the file invalid.
    const colliding: ProcessTree = {
      op: 'seq',
      children: [
        { op: 'activity', label: 'R&D' },
        { op: 'activity', label: 'R D' },
      ],
    };
    const graph = bpmnFromTree(colliding);
    const ids = graph.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('emits diagram interchange, so it does not open blank', async () => {
    const doc = parse(await treeToBpmn(RICH)) as Record<string, Record<string, unknown>>;
    const diagram = doc['bpmn:definitions']!['bpmndi:BPMNDiagram'] as Record<string, unknown>;
    expect(diagram).toBeDefined();

    const plane = diagram['bpmndi:BPMNPlane'] as Record<string, unknown[]>;
    const shapes = plane['bpmndi:BPMNShape'] as Record<string, unknown>[];
    const graph = bpmnFromTree(RICH);
    expect(shapes).toHaveLength(graph.elements.length);
  });

  it('gives every edge at least two waypoints', async () => {
    // BPMN requires it; an edge with fewer makes the WHOLE diagram fail to
    // render in bpmn-js, not just that one arc.
    const doc = parse(await treeToBpmn(RICH)) as Record<string, Record<string, unknown>>;
    const plane = (doc['bpmn:definitions']!['bpmndi:BPMNDiagram'] as Record<string, unknown>)[
      'bpmndi:BPMNPlane'
    ] as Record<string, unknown[]>;
    const edges = plane['bpmndi:BPMNEdge'] as Record<string, unknown[]>[];

    for (const edge of edges) {
      expect((edge['di:waypoint'] as unknown[]).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('still produces a usable file when elkjs is unavailable', async () => {
    // Untidy but openable beats blank.
    const xml = await treeToBpmn(SEQ, {
      importModule: async () => {
        throw Object.assign(new Error("Cannot find package 'elkjs'"), {
          code: 'ERR_MODULE_NOT_FOUND',
        });
      },
    });
    const doc = parse(xml) as Record<string, Record<string, unknown>>;
    expect(doc['bpmn:definitions']!['bpmndi:BPMNDiagram']).toBeDefined();
  });

  it('declares gateway direction so strict importers accept it', async () => {
    const xml = await treeToBpmn(RICH);
    expect(xml).toContain('gatewayDirection="Diverging"');
    expect(xml).toContain('gatewayDirection="Converging"');
  });

  it('marks the process non-executable', async () => {
    // This is a description of what happened, not something to deploy.
    expect(await treeToBpmn(SEQ)).toContain('isExecutable="false"');
  });

  it('can omit the diagram for a consumer that lays out itself', () => {
    const xml = toBpmnXml(bpmnFromTree(SEQ), { withoutDiagram: true });
    expect(xml).not.toContain('BPMNDiagram');
    expect(XMLValidator.validate(xml)).toBe(true);
  });
});
