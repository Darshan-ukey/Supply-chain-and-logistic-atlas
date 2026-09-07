import crypto from 'node:crypto';

// Atlas P6.2 — Canonical WorkDefinition compiler.
// Deterministic, executor-neutral, pure. No network, no clock, no randomness.
// Governing contract: governance/standards/CANONICAL_WORKDEFINITION_CONTRACT_V1_FROZEN.md
// Upstream contract:  governance/standards/CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md

export const COMPILER_VERSION = 'atlas-workdefinition-compiler-1.0.0';
export const WORKDEFINITION_SCHEMA_VERSION = 'atlas-canonical-workdefinition-v1';
export const WORKDEFINITION_CONTRACT_VERSION = '1.0.0';
export const DEFINITION_VERSION = '1.0.0';

const EXECUTOR_READY = 'EXECUTOR_READY';

function fail(message, status = 500) {
  throw Object.assign(new Error(message), { status });
}

/** Stable, key-sorted serialization used for canonical hashing. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function canonicalHash(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function list(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : [JSON.parse(JSON.stringify(value))];
}

function stringList(value) {
  return list(value).map(x => String(x));
}

/**
 * Index a decomposition's work units into parent -> children, preserving governed order.
 * Detects duplicate ids, missing roots, orphan parents and cycles. Fails closed.
 */
export function indexWorkUnits(decomposition) {
  const units = Array.isArray(decomposition?.workUnits) ? decomposition.workUnits : null;
  if (!units || units.length === 0) fail('Work Decomposition contains no workUnits; compilation failed closed.');

  const byId = new Map();
  for (const unit of units) {
    const id = String(unit?.workUnitId || '');
    if (!id) fail('Work unit is missing workUnitId; compilation failed closed.');
    if (byId.has(id)) fail(`Duplicate workUnitId in governed decomposition: ${id}`);
    byId.set(id, unit);
  }

  const children = new Map();
  const roots = [];
  for (const unit of units) {
    const parentId = unit.parentWorkUnitId === null || unit.parentWorkUnitId === undefined
      ? null
      : String(unit.parentWorkUnitId);
    if (parentId === null) { roots.push(unit); continue; }
    if (!byId.has(parentId)) fail(`Orphan parent reference in governed decomposition: ${unit.workUnitId} -> ${parentId}`);
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(unit);
  }
  if (roots.length !== 1) fail(`Governed decomposition must have exactly one task root; found ${roots.length}.`);

  // Governed ordering: sequence ascending, workUnitId as deterministic tie-break.
  const order = (a, b) => {
    const sa = Number(a.sequence ?? 0), sb = Number(b.sequence ?? 0);
    if (sa !== sb) return sa - sb;
    return String(a.workUnitId).localeCompare(String(b.workUnitId));
  };
  for (const arr of children.values()) arr.sort(order);

  // Cycle detection over the parent chain.
  for (const unit of units) {
    const seen = new Set([String(unit.workUnitId)]);
    let cursor = unit.parentWorkUnitId ? String(unit.parentWorkUnitId) : null;
    while (cursor) {
      if (seen.has(cursor)) fail(`Illegal cycle detected in governed decomposition at ${unit.workUnitId}.`);
      seen.add(cursor);
      const parent = byId.get(cursor);
      cursor = parent?.parentWorkUnitId ? String(parent.parentWorkUnitId) : null;
    }
  }

  return { byId, children, root: roots[0] };
}

/** Deterministic preorder traversal yielding {unit, path} where path is root -> unit. */
export function traverse(decomposition) {
  const { children, root } = indexWorkUnits(decomposition);
  const out = [];
  const walk = (unit, path) => {
    const nextPath = [...path, String(unit.workUnitId)];
    out.push({ unit, path: nextPath, children: children.get(String(unit.workUnitId)) || [] });
    for (const child of children.get(String(unit.workUnitId)) || []) walk(child, nextPath);
  };
  walk(root, []);
  return out;
}

function requireLineage(decomposition) {
  const lineage = decomposition?.semanticLineage || {};
  const daughterModule = String(decomposition?.daughterModule || '');
  const daughterVersion = String(decomposition?.daughterVersion || '');
  const sourceTaskId = String(decomposition?.sourceTaskId || '');
  const sourceTaskTitle = String(decomposition?.sourceTaskTitle || '');
  const decompositionId = String(decomposition?.decompositionId || '');
  const contractVersion = String(decomposition?.contractVersion || '');
  const semanticSourceVersion = String(lineage?.semanticSourceVersion || '');
  const inheritance = String(lineage?.inheritance || '');

  for (const [name, value] of Object.entries({
    daughterModule, daughterVersion, sourceTaskId, sourceTaskTitle,
    decompositionId, contractVersion, semanticSourceVersion, inheritance
  })) {
    if (!value) fail(`Governed decomposition is missing required lineage field '${name}'; compilation failed closed.`);
  }
  if (contractVersion !== '1.0.0') {
    fail(`Unsupported Work Decomposition contract version '${contractVersion}'; compilation failed closed.`);
  }
  return { daughterModule, daughterVersion, sourceTaskId, sourceTaskTitle, decompositionId, contractVersion, semanticSourceVersion, inheritance };
}

function workDefinitionId(base, workUnitId) {
  return `${base.daughterModule}@${base.daughterVersion}::${base.sourceTaskId}::${workUnitId}::WD`;
}

/** Compile one EXECUTOR_READY terminal leaf into a Canonical WorkDefinition. */
function compileLeaf({ unit, path }, base, governedInputContentHash) {
  const readiness = unit.executorReadiness || {};
  const requiredClientBindings = stringList(readiness.requiredClientBindings);
  const requiredKnowledgeGaps = stringList(readiness.requiredKnowledgeGaps);

  const definition = {
    schemaVersion: WORKDEFINITION_SCHEMA_VERSION,
    workDefinitionId: workDefinitionId(base, unit.workUnitId),
    contractVersion: WORKDEFINITION_CONTRACT_VERSION,
    version: DEFINITION_VERSION,
    status: 'VALIDATED_REFERENCE_DEFINITION',
    title: String(unit.name || ''),
    purpose: String(unit.purpose ?? ''),

    lineage: {
      daughterModule: base.daughterModule,
      daughterVersion: base.daughterVersion,
      semanticSourceVersion: base.semanticSourceVersion,
      inheritance: base.inheritance,
      sourceTaskId: base.sourceTaskId,
      sourceTaskTitle: base.sourceTaskTitle,
      decompositionId: base.decompositionId,
      decompositionContractVersion: base.contractVersion,
      sourceWorkUnitId: String(unit.workUnitId),
      workUnitPath: path,
      unitType: String(unit.unitType),
      parentWorkUnitId: unit.parentWorkUnitId === undefined ? null : (unit.parentWorkUnitId === null ? null : String(unit.parentWorkUnitId)),
      sequence: Number(unit.sequence)
    },

    provenance: {
      compiledFrom: 'CANONICAL_WORK_DECOMPOSITION_V1',
      compilerVersion: COMPILER_VERSION,
      governedInputContentHash,
      sourceRefs: stringList(unit.sourceRefs)
    },

    applicability: {
      requiredWhen: [],
      prohibitedWhen: [],
      entryConditions: stringList(unit.entryConditions)
    },

    trigger: unit.trigger === undefined ? null : String(unit.trigger),

    // Categories the governed Work Decomposition V1 source establishes.
    inputs: list(unit.inputs),
    decisions: list(unit.decisionGates),
    actions: list(unit.atomicActions),
    transitions: list(unit.branchTransitions),
    clocks: list(unit.temporalConstraints),
    evidence: list(unit.evidenceRequirements),
    dependencies: list(unit.dependencies),

    // Categories the contract recognises but Work Decomposition V1 does not populate.
    // Carried as explicit empty sets. The compiler must not synthesise them.
    actors: [],
    systems: [],
    rules: [],
    validations: [],
    controls: [],
    outcomes: [],
    exceptions: [],

    executability: {
      status: EXECUTOR_READY,
      executorClass: 'EXECUTOR_CLASS_UNBOUND',
      independentExecutorProofStatus: 'NOT_INDEPENDENTLY_PROVEN',
      requiredClientBindings,
      requiredKnowledgeGaps
    },

    executionCharacteristics: {
      executorClassBound: false,
      clientBindingRequired: requiredClientBindings.length > 0,
      knowledgeGapPresent: requiredKnowledgeGaps.length > 0,
      outputState: unit.outputState === undefined ? null : unit.outputState,
      fallbackIfBlocked: unit.fallbackIfBlocked === undefined ? null : String(unit.fallbackIfBlocked)
    },

    clientBindingRequirements: requiredClientBindings
  };

  if (!definition.title) fail(`Governed work unit ${unit.workUnitId} has no name; compilation failed closed.`);
  return definition;
}

/**
 * Compile a single governed task decomposition.
 * Returns { definitions[], coverage } — never throws for blocked work, only for structural violation.
 */
export function compileTaskDecomposition(decomposition, { governedInputContentHash }) {
  if (!/^[0-9a-f]{64}$/.test(String(governedInputContentHash || ''))) {
    fail('A 64-hex governed input content hash is required to compile; compilation failed closed.');
  }
  const base = requireLineage(decomposition);
  const nodes = traverse(decomposition);

  const definitions = [];
  const notCompiled = [];
  let leafCount = 0;

  for (const node of nodes) {
    const isTerminal = node.children.length === 0;
    const status = String(node.unit?.executorReadiness?.status || '');

    if (!isTerminal) {
      if (status === EXECUTOR_READY) {
        fail(`Internal node ${node.unit.workUnitId} claims EXECUTOR_READY; governed contract prohibits this. Failed closed.`);
      }
      continue;
    }

    leafCount += 1;

    if (status === EXECUTOR_READY) {
      definitions.push(compileLeaf(node, base, governedInputContentHash));
      continue;
    }

    if (status === 'NEEDS_DECOMPOSITION') {
      fail(`Terminal leaf ${node.unit.workUnitId} is NEEDS_DECOMPOSITION; governed contract prohibits this. Failed closed.`);
    }
    if (status !== 'BLOCKED_BY_CLIENT_BINDING' && status !== 'BLOCKED_BY_KNOWLEDGE_GAP') {
      fail(`Terminal leaf ${node.unit.workUnitId} has unrecognised executorReadiness status '${status}'. Failed closed.`);
    }

    // Blocked work stays visibly blocked, with governed reasons preserved. It is never made executable.
    notCompiled.push({
      workUnitId: String(node.unit.workUnitId),
      unitType: String(node.unit.unitType),
      status,
      requiredClientBindings: stringList(node.unit.executorReadiness?.requiredClientBindings),
      requiredKnowledgeGaps: stringList(node.unit.executorReadiness?.requiredKnowledgeGaps)
    });
  }

  definitions.sort((a, b) => a.workDefinitionId.localeCompare(b.workDefinitionId));
  notCompiled.sort((a, b) => a.workUnitId.localeCompare(b.workUnitId));

  const blockedByClientBinding = notCompiled.filter(x => x.status === 'BLOCKED_BY_CLIENT_BINDING').length;
  const blockedByKnowledgeGap = notCompiled.filter(x => x.status === 'BLOCKED_BY_KNOWLEDGE_GAP').length;

  const coverage = {
    sourceTaskId: base.sourceTaskId,
    sourceTaskTitle: base.sourceTaskTitle,
    decompositionId: base.decompositionId,
    daughterModule: base.daughterModule,
    daughterVersion: base.daughterVersion,
    semanticSourceVersion: base.semanticSourceVersion,
    inheritance: base.inheritance,
    workUnitCount: nodes.length,
    leafCount,
    compiledCount: definitions.length,
    notCompiledCount: notCompiled.length,
    blockedByClientBindingCount: blockedByClientBinding,
    blockedByKnowledgeGapCount: blockedByKnowledgeGap,
    coverageStatus: notCompiled.length === 0 ? 'FULLY_COMPILED' : 'PARTIALLY_COMPILED_WITH_EXPLICIT_BLOCKERS',
    notCompiled
  };

  return { definitions, coverage };
}

/**
 * Compile a governed multi-task bundle (the P6.1 aggregate shape).
 * Returns { moduleId, moduleVersion, definitions[], coverage[], totals }.
 */
export function compileBundle(bundle, { governedInputContentHash }) {
  const moduleId = String(bundle?.moduleId || '');
  const moduleVersion = String(bundle?.moduleVersion || '');
  if (!moduleId || !moduleVersion) fail('Governed bundle is missing moduleId/moduleVersion; compilation failed closed.');

  const raw = bundle?.decompositions;
  const items = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : null);
  if (!items || items.length === 0) fail('Governed bundle contains no decompositions; compilation failed closed.');

  const definitions = [];
  const coverage = [];
  const seenTasks = new Set();

  for (const decomposition of items) {
    if (String(decomposition?.daughterModule) !== moduleId || String(decomposition?.daughterVersion) !== moduleVersion) {
      fail(`Decomposition ${decomposition?.decompositionId} does not match bundle tuple ${moduleId}@${moduleVersion}; failed closed.`);
    }
    const taskId = String(decomposition?.sourceTaskId || '');
    if (seenTasks.has(taskId)) fail(`Duplicate task decomposition for ${taskId}; failed closed.`);
    seenTasks.add(taskId);

    const result = compileTaskDecomposition(decomposition, { governedInputContentHash });
    definitions.push(...result.definitions);
    coverage.push(result.coverage);
  }

  definitions.sort((a, b) => a.workDefinitionId.localeCompare(b.workDefinitionId));
  coverage.sort((a, b) => a.sourceTaskId.localeCompare(b.sourceTaskId));

  const ids = new Set();
  for (const d of definitions) {
    if (ids.has(d.workDefinitionId)) fail(`Duplicate workDefinitionId produced: ${d.workDefinitionId}; failed closed.`);
    ids.add(d.workDefinitionId);
  }

  const totals = {
    taskCount: coverage.length,
    workUnitCount: coverage.reduce((n, c) => n + c.workUnitCount, 0),
    leafCount: coverage.reduce((n, c) => n + c.leafCount, 0),
    workDefinitionCount: definitions.length,
    notCompiledLeafCount: coverage.reduce((n, c) => n + c.notCompiledCount, 0),
    blockedByClientBindingLeafCount: coverage.reduce((n, c) => n + c.blockedByClientBindingCount, 0),
    blockedByKnowledgeGapLeafCount: coverage.reduce((n, c) => n + c.blockedByKnowledgeGapCount, 0),
    fullyCompiledTaskCount: coverage.filter(c => c.coverageStatus === 'FULLY_COMPILED').length
  };

  return {
    schemaVersion: 'atlas-canonical-workdefinition-compilation-v1',
    moduleId,
    moduleVersion,
    contractVersion: WORKDEFINITION_CONTRACT_VERSION,
    compilerVersion: COMPILER_VERSION,
    governedInputContentHash,
    definitions,
    coverage,
    totals
  };
}
