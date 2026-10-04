// S8-3E bounded BPMN 2.0 structural validator (Node built-ins only).
//
// Scope: the bounded Atlas v1.5 subset emitted by s8-flow-bpmn.js
// (startEvent, task, exclusiveGateway, endEvent, sequenceFlow, BPMNDI).
// This is a well-formedness + structural-reference checker. It is NOT a full
// XSD validator and NOT a BPMN importer/editor; it never mutates or repairs.
export const BPMN_NS = Object.freeze({
  model: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
  di: 'http://www.omg.org/spec/BPMN/20100524/DI',
  dc: 'http://www.omg.org/spec/DD/20100524/DC',
  ddi: 'http://www.omg.org/spec/DD/20100524/DI'
});

const NCNAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
export const isNCName = (s) => typeof s === 'string' && NCNAME.test(s);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(text, where) {
  if (text.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);/g, '').includes('&')) throw Error(`XML_BAD_ENTITY:${where}`);
  return text.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(cp) || cp > 0x10ffff) throw Error(`XML_BAD_CHARREF:${where}`);
      return String.fromCodePoint(cp);
    }
    if (!(e in ENTITIES)) throw Error(`XML_UNKNOWN_ENTITY:${e}`);
    return ENTITIES[e];
  });
}

// Minimal strict XML 1.0 parser: prolog, comments, elements, attributes, text,
// predefined entities and numeric character references. DTD/CDATA/PI-in-body
// are rejected (not produced by the bounded exporter).
export function parseXml(xml) {
  if (typeof xml !== 'string') throw Error('XML_NOT_STRING');
  let i = 0;
  const n = xml.length;
  const stack = [];
  let root = null;
  let seenProlog = false;
  const fail = (code) => { throw Error(`${code}@${i}`); };
  const nameRe = /[A-Za-z_][A-Za-z0-9_.:-]*/y;
  const readName = () => { nameRe.lastIndex = i; const m = nameRe.exec(xml); if (!m) fail('XML_BAD_NAME'); i += m[0].length; return m[0]; };
  const skipWs = () => { while (i < n && /\s/.test(xml[i])) i++; };

  if (xml.startsWith('<?xml')) {
    const end = xml.indexOf('?>');
    if (end < 0) fail('XML_PROLOG_UNTERMINATED');
    if (!/^<\?xml\s+version\s*=\s*("1\.0"|'1\.0')/.test(xml)) fail('XML_PROLOG_VERSION');
    i = end + 2; seenProlog = true;
  }
  while (i < n) {
    if (xml[i] === '<') {
      if (xml.startsWith('<!--', i)) {
        const end = xml.indexOf('-->', i + 4); if (end < 0) fail('XML_COMMENT_UNTERMINATED');
        if (xml.slice(i + 4, end).includes('--')) fail('XML_COMMENT_DOUBLE_HYPHEN');
        i = end + 3; continue;
      }
      if (xml.startsWith('<![CDATA[', i) || xml.startsWith('<!', i) || xml.startsWith('<?', i)) fail('XML_UNSUPPORTED_CONSTRUCT');
      if (xml[i + 1] === '/') {
        i += 2; const name = readName(); skipWs();
        if (xml[i] !== '>') fail('XML_BAD_CLOSE');
        i++;
        const top = stack.pop();
        if (!top || top.qname !== name) fail('XML_MISMATCHED_TAG');
        continue;
      }
      i++;
      const qname = readName();
      const attrs = {}; const lattrs = {}; const rawAttrs = [];
      for (;;) {
        const before = i; skipWs();
        if (xml[i] === '>' || (xml[i] === '/' && xml[i + 1] === '>')) break;
        if (i === before) fail('XML_ATTR_SPACE');
        const an = readName(); skipWs();
        if (xml[i] !== '=') fail('XML_ATTR_EQ'); i++; skipWs();
        const q = xml[i]; if (q !== '"' && q !== "'") fail('XML_ATTR_QUOTE'); i++;
        const end = xml.indexOf(q, i); if (end < 0) fail('XML_ATTR_UNTERMINATED');
        const raw = xml.slice(i, end);
        if (raw.includes('<')) fail('XML_ATTR_LT');
        if (an in attrs) fail('XML_DUPLICATE_ATTR');
        attrs[an] = decode(raw, an); rawAttrs.push(an); if (!an.startsWith('xmlns')) lattrs[an.slice(an.indexOf(':') + 1)] = attrs[an]; i = end + 1;
      }
      const selfClose = xml[i] === '/'; i += selfClose ? 2 : 1;
      const nsDecl = {};
      for (const a of rawAttrs) {
        if (a === 'xmlns') nsDecl[''] = attrs[a];
        else if (a.startsWith('xmlns:')) nsDecl[a.slice(6)] = attrs[a];
      }
      const parent = stack[stack.length - 1];
      const scope = { ...(parent ? parent.scope : { xml: 'http://www.w3.org/XML/1998/namespace' }), ...nsDecl };
      const colon = qname.indexOf(':');
      const prefix = colon < 0 ? '' : qname.slice(0, colon);
      const local = colon < 0 ? qname : qname.slice(colon + 1);
      if (prefix && !(prefix in scope)) fail('XML_UNBOUND_PREFIX');
      const el = { qname, prefix, local, ns: scope[prefix] ?? null, attrs, lattrs, children: [], text: '', scope };
      if (parent) parent.children.push(el); else { if (root) fail('XML_MULTIPLE_ROOTS'); root = el; }
      if (!selfClose) stack.push(el);
    } else {
      const end = xml.indexOf('<', i); const stop = end < 0 ? n : end;
      const raw = xml.slice(i, stop);
      const top = stack[stack.length - 1];
      if (top) { top.text += decode(raw, 'text'); }
      else if (raw.trim() !== '') fail('XML_TEXT_OUTSIDE_ROOT');
      i = stop;
    }
  }
  if (stack.length) fail('XML_UNCLOSED_ELEMENT');
  if (!root) fail('XML_NO_ROOT');
  return { root, hasProlog: seenProlog };
}

const FLOW_NODE_LOCALS = new Set(['startEvent', 'task', 'exclusiveGateway', 'endEvent']);
const SUPPORTED_PROCESS_CHILDREN = new Set([...FLOW_NODE_LOCALS, 'sequenceFlow', 'documentation', 'extensionElements']);
const node = (el, ns, local) => el.ns === ns && el.local === local;
const kids = (el, local, ns = BPMN_NS.model) => el.children.filter((c) => node(c, ns, local));

// Validate the bounded BPMN 2.0 subset. Returns {valid, errors, summary}.
export function validateBpmn(xml) {
  const errors = [];
  const err = (code, detail = '') => errors.push(detail ? `${code}:${detail}` : code);
  let parsed;
  try { parsed = parseXml(xml); } catch (e) { return { valid: false, errors: [`XML_NOT_WELL_FORMED:${e.message}`], summary: null }; }
  if (!parsed.hasProlog) err('XML_PROLOG_MISSING');
  const defs = parsed.root;
  if (!node(defs, BPMN_NS.model, 'definitions')) { err('ROOT_NOT_BPMN_DEFINITIONS'); return { valid: false, errors, summary: null }; }
  if (!defs.attrs.id || !isNCName(defs.attrs.id)) err('DEFINITIONS_ID_INVALID');
  if (!defs.attrs.targetNamespace) err('DEFINITIONS_TARGETNAMESPACE_MISSING');

  // Global id uniqueness + NCName validity across the whole document.
  const ids = new Map();
  const walk = (el) => {
    if ('id' in el.attrs) {
      if (!isNCName(el.attrs.id)) err('ID_NOT_NCNAME', el.attrs.id);
      if (ids.has(el.attrs.id)) err('ID_DUPLICATE', el.attrs.id); else ids.set(el.attrs.id, el);
    }
    el.children.forEach(walk);
  };
  walk(defs);

  const processes = kids(defs, 'process');
  if (processes.length !== 1) err('PROCESS_COUNT_NOT_ONE', String(processes.length));
  for (const c of defs.children) {
    if (node(c, BPMN_NS.model, 'process') || node(c, BPMN_NS.di, 'BPMNDiagram')) continue;
    if (node(c, BPMN_NS.model, 'documentation') || node(c, BPMN_NS.model, 'extensionElements')) continue;
    err('UNSUPPORTED_DEFINITIONS_CHILD', c.qname);
  }
  const summary = { starts: 0, tasks: 0, gateways: 0, ends: 0, flows: 0, shapes: 0, edges: 0 };
  if (processes.length !== 1) return { valid: false, errors, summary };
  const proc = processes[0];
  if (!proc.attrs.id) err('PROCESS_ID_MISSING');
  if (proc.attrs.isExecutable !== 'false') err('PROCESS_MUST_BE_NON_EXECUTABLE');

  const flowNodes = new Map();
  const flows = new Map();
  let prevRank = 0;
  const rank = { documentation: 1, extensionElements: 2 };
  for (const c of proc.children) {
    if (c.ns !== BPMN_NS.model || !SUPPORTED_PROCESS_CHILDREN.has(c.local)) { err('UNSUPPORTED_PROCESS_ELEMENT', c.qname); continue; }
    const r = rank[c.local] ?? 3;
    if (r < prevRank) err('PROCESS_CHILD_ORDER', c.qname);
    prevRank = Math.max(prevRank, r);
    if (FLOW_NODE_LOCALS.has(c.local)) flowNodes.set(c.attrs.id, c);
    if (c.local === 'sequenceFlow') flows.set(c.attrs.id, c);
    // conditions/timers/subprocess semantics are outside the bounded scope.
    for (const g of c.children) {
      if (g.ns === BPMN_NS.model && ['conditionExpression', 'timerEventDefinition', 'messageEventDefinition', 'compensateEventDefinition', 'subProcess'].includes(g.local)) err('UNSUPPORTED_SEMANTIC_ELEMENT', g.local);
    }
  }
  const outgoingOf = new Map(); const incomingOf = new Map();
  for (const [id, f] of flows) {
    if (!id) { err('SEQUENCEFLOW_ID_MISSING'); continue; }
    const s = f.attrs.sourceRef; const t = f.attrs.targetRef;
    if (!flowNodes.has(s)) err('SEQUENCEFLOW_SOURCE_UNRESOLVED', id);
    if (!flowNodes.has(t)) err('SEQUENCEFLOW_TARGET_UNRESOLVED', id);
    if (s === t) err('SEQUENCEFLOW_SELF_LOOP', id);
    (outgoingOf.get(s) ?? outgoingOf.set(s, []).get(s)).push(id);
    (incomingOf.get(t) ?? incomingOf.set(t, []).get(t)).push(id);
    summary.flows++;
  }
  for (const [id, el] of flowNodes) {
    if (!id) { err('FLOWNODE_ID_MISSING', el.local); continue; }
    // child order: documentation*, extensionElements?, incoming*, outgoing*
    let stage = 0;
    const stageOf = { documentation: 1, extensionElements: 2, incoming: 3, outgoing: 4 };
    for (const ch of el.children) {
      const st = stageOf[ch.local];
      if (ch.ns !== BPMN_NS.model || !st) { err('UNSUPPORTED_FLOWNODE_CHILD', `${id}/${ch.qname}`); continue; }
      if (st < stage) err('FLOWNODE_CHILD_ORDER', `${id}/${ch.qname}`);
      stage = Math.max(stage, st);
    }
    const inc = kids(el, 'incoming').map((x) => x.text.trim());
    const out = kids(el, 'outgoing').map((x) => x.text.trim());
    const wantIn = (incomingOf.get(id) ?? []).slice().sort().join('|');
    const wantOut = (outgoingOf.get(id) ?? []).slice().sort().join('|');
    if (inc.slice().sort().join('|') !== wantIn) err('INCOMING_INCONSISTENT', id);
    if (out.slice().sort().join('|') !== wantOut) err('OUTGOING_INCONSISTENT', id);
    const nIn = (incomingOf.get(id) ?? []).length; const nOut = (outgoingOf.get(id) ?? []).length;
    if (el.local === 'startEvent') { summary.starts++; if (nIn) err('START_HAS_INCOMING', id); if (!nOut) err('START_NO_OUTGOING', id); }
    if (el.local === 'endEvent') { summary.ends++; if (nOut) err('END_HAS_OUTGOING', id); if (!nIn) err('END_NO_INCOMING', id); }
    if (el.local === 'task') { summary.tasks++; if (nIn < 1 || nOut < 1) err('TASK_DANGLING', id); }
    if (el.local === 'exclusiveGateway') { summary.gateways++; if (nIn < 1 || nOut < 2) err('GATEWAY_NOT_DIVERGING', id); }
  }
  if (summary.starts !== 1) err('START_COUNT_NOT_ONE', String(summary.starts));
  if (summary.ends < 1) err('END_MISSING');

  // Reachability: every flow node reachable from the start; every node reaches an end.
  const start = [...flowNodes].find(([, e]) => e.local === 'startEvent');
  if (start) {
    const seen = new Set([start[0]]); const q = [start[0]];
    while (q.length) { const cur = q.shift(); for (const fid of outgoingOf.get(cur) ?? []) { const t = flows.get(fid).attrs.targetRef; if (flowNodes.has(t) && !seen.has(t)) { seen.add(t); q.push(t); } } }
    for (const id of flowNodes.keys()) if (!seen.has(id)) err('FLOWNODE_UNREACHABLE', id);
  }

  // BPMNDI (optional, but if present must be complete and consistent).
  const diagrams = kids(defs, 'BPMNDiagram', BPMN_NS.di);
  if (diagrams.length > 1) err('DIAGRAM_COUNT_GT_ONE');
  for (const d of diagrams) {
    const planes = kids(d, 'BPMNPlane', BPMN_NS.di);
    if (planes.length !== 1) { err('PLANE_COUNT_NOT_ONE'); continue; }
    const plane = planes[0];
    if (plane.attrs.bpmnElement !== proc.attrs.id) err('PLANE_BPMNELEMENT_MISMATCH');
    const shaped = new Set(); const edged = new Set();
    for (const c of plane.children) {
      if (node(c, BPMN_NS.di, 'BPMNShape')) {
        summary.shapes++;
        const ref = c.attrs.bpmnElement;
        if (!flowNodes.has(ref)) err('SHAPE_REF_UNRESOLVED', ref);
        if (shaped.has(ref)) err('SHAPE_DUPLICATE', ref); shaped.add(ref);
        const b = c.children.find((x) => node(x, BPMN_NS.dc, 'Bounds'));
        if (!b) err('SHAPE_BOUNDS_MISSING', ref);
        else for (const k of ['x', 'y', 'width', 'height']) if (!Number.isFinite(Number(b.attrs[k]))) err('SHAPE_BOUNDS_NOT_NUMERIC', `${ref}.${k}`);
      } else if (node(c, BPMN_NS.di, 'BPMNEdge')) {
        summary.edges++;
        const ref = c.attrs.bpmnElement;
        if (!flows.has(ref)) err('EDGE_REF_UNRESOLVED', ref);
        if (edged.has(ref)) err('EDGE_DUPLICATE', ref); edged.add(ref);
        const wps = c.children.filter((x) => node(x, BPMN_NS.ddi, 'waypoint'));
        if (wps.length < 2) err('EDGE_WAYPOINTS_LT_2', ref);
        for (const w of wps) if (!Number.isFinite(Number(w.attrs.x)) || !Number.isFinite(Number(w.attrs.y))) err('EDGE_WAYPOINT_NOT_NUMERIC', ref);
      } else err('UNSUPPORTED_PLANE_CHILD', c.qname);
    }
    for (const id of flowNodes.keys()) if (!shaped.has(id)) err('SHAPE_MISSING', id);
    for (const id of flows.keys()) if (!edged.has(id)) err('EDGE_MISSING', id);
  }
  return { valid: errors.length === 0, errors, summary };
}
