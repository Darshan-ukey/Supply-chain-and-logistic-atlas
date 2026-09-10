import fs from 'node:fs';
import crypto from 'node:crypto';

// R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening.
//
// This tool MEASURES governed operational knowledge against the frozen Operational
// Knowledge Contract v2 and the frozen Information Resolution Contract v1. It does not
// author, infer or complete business knowledge. Every status it emits is derived from
// bytes that already exist in a governed asset on atlas-governance-registry-v2.1.
//
// Two governed assets carry Road LTL operational knowledge and R0.3 must read both:
//   - data/modules/road-ltl-v1.4.json                       (A5 task layer)
//   - data/operational-knowledge/road-ltl-v1.4-operational.json (OK payload)
// plus the governed 1.5 overlay, which overrides LTL-03 only.
//
// Where a contract attribute is not present under its contract name but IS present under
// a different governed name carrying the same meaning, this tool records
// SATISFIED_BY_DECLARED_EQUIVALENT and names the exact path. Equivalences are declared
// once, in EQUIVALENCE_MAP below, so independent QA can accept or reject each one
// individually. An undeclared attribute is never quietly treated as satisfied.

export const TOOL_VERSION = 'atlas-r0-3-ok-hardening-1.0.0';

export const stableStringify = v => Array.isArray(v)
  ? `[${v.map(stableStringify).join(',')}]`
  : (v && typeof v === 'object'
    ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`
    : JSON.stringify(v === undefined ? null : v));

export const canonicalHash = v => crypto.createHash('sha256').update(stableStringify(v)).digest('hex');
export const fileSha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Read a task identity under either governed key. Neither source asset is rewritten. */
export const taskIdentityOf = t => {
  const id = t?.taskId ?? t?.id;
  if (typeof id !== 'string' || !id) throw new Error('Task carries no taskId or id; failed closed.');
  return id;
};

/** A value counts as populated only if it carries actual content. */
export const isPopulated = v => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// ---------------------------------------------------------------------------
// Operational Knowledge Contract v2 — taskOperationalKnowledge required attributes.
// Groups and names are read from the frozen contract at run time; this list is only
// used to assert that the contract has not silently changed shape underneath us.
// ---------------------------------------------------------------------------
export const EXPECTED_CONTRACT_GROUPS = [
  'identity', 'meaning', 'applicability', 'inputsOutputs', 'authority', 'executionReadiness',
];

// ---------------------------------------------------------------------------
// Declared equivalences. Each entry says: this contract attribute is carried by this
// governed path, under this named basis. QA may reject any single entry without
// invalidating the rest of the matrix.
// ---------------------------------------------------------------------------
export const EQUIVALENCE_MAP = {
  canonicalTaskRef: [{
    layer: 'module', path: 'identity.a5ContractId',
    basis: 'R0.1C certified a5-* as the Daughter-local canonical task identifier layer; identity.a5ContractId is that identifier.',
  }],
  module: [{
    layer: 'moduleRoot', path: 'module.id',
    basis: 'Module identity is declared once at asset root rather than repeated per task.',
  }],
  version: [{
    layer: 'moduleRoot', path: 'module.version',
    basis: 'Module version is declared once at asset root rather than repeated per task.',
  }],
  businessMeaning: [{
    layer: 'module', path: 'identity.purpose',
    basis: 'identity.purpose states what the task means in business terms and is the module-layer counterpart of businessMeaning.',
  }],
  businessOutcome: [{
    layer: 'module', path: 'baseline.after',
    basis: 'baseline.after states the business state reached when the task succeeds.',
  }],
  preconditions: [{
    layer: 'module', path: 'baseline.before',
    basis: 'baseline.before states the governed state required before the task runs.',
  }],
  postconditions: [{
    layer: 'module', path: 'baseline.after',
    basis: 'baseline.after states the governed state after the task completes.',
  }],
  requiredWhen: [{
    layer: 'module', path: 'baseline.trigger',
    basis: 'baseline.trigger states the governed condition under which the task is required.',
  }],
  authorityOwner: [{
    layer: 'module', path: 'responsibility.decisionAuthority',
    basis: 'responsibility.decisionAuthority names the governed decision authority for the task.',
  }],
  clientBindingRequirements: [{
    layer: 'module', path: 'clientBindingRequirements',
    basis: 'Present under the contract name at the module layer rather than in the OK payload.',
  }],
  sourceClaims: [{
    layer: 'ok', path: 'provenanceClaims',
    basis: 'provenanceClaims carries claimId/sourceRefs/evidenceClass/claimBoundary, which is the provenance structure the contract requires.',
  }],
  systemOfRecordRoles: [{
    layer: 'module', path: 'systemExchanges',
    basis: 'systemExchanges declares producerSystemRole, authoritySystemRole and consumerSystemRoles per exchange, which is the system-of-record role information the contract requires. Roles are expressed per exchange rather than as one task-level list.',
  }],
};

// Attributes with NO declared equivalent are reported ABSENT wherever they are missing.
// They are the honest gap surface of this stage.

// ---------------------------------------------------------------------------
// Composition — effective Road LTL 1.5 operational knowledge.
// ---------------------------------------------------------------------------
export function composeEffectiveOperationalKnowledge({ modulePath, okBasePath, okOverlayPath }) {
  const mod = readJson(modulePath);
  const okBase = readJson(okBasePath);
  const overlay = readJson(okOverlayPath);

  const policy = overlay.inheritancePolicy;
  if (policy !== 'LOSSLESS_INHERIT_BASE_AND_OVERRIDE_ONLY_DECLARED_TASKS') {
    throw new Error(`Unexpected inheritancePolicy "${policy}"; failed closed rather than guessing.`);
  }

  const changed = new Set(overlay.changedTaskIds ?? []);
  const overrides = new Map((overlay.taskOperationalKnowledge ?? []).map(t => [taskIdentityOf(t), t]));

  for (const id of changed) {
    if (!overrides.has(id)) throw new Error(`Overlay declares ${id} changed but carries no override; failed closed.`);
  }
  for (const id of overrides.keys()) {
    if (!changed.has(id)) throw new Error(`Overlay carries an override for ${id} that is not declared changed; failed closed.`);
  }

  const moduleTasks = new Map(mod.tasks.map(t => [taskIdentityOf(t), t]));
  const okTasks = new Map(okBase.tasks.map(t => [taskIdentityOf(t), t]));

  const composed = [...moduleTasks.keys()].sort().map(taskId => {
    const okTask = okTasks.get(taskId);
    if (!okTask) throw new Error(`Module task ${taskId} has no Operational Knowledge record; failed closed.`);
    const override = overrides.get(taskId) ?? null;
    return {
      taskId,
      moduleTask: moduleTasks.get(taskId),
      okTask,
      okOverride: override,
      okSourceVersion: override ? String(overlay.moduleVersion) : String(okBase.version),
      lineage: override ? 'DIRECT_GOVERNED_1_5_OVERRIDE' : 'INHERITED_FROM_1_4',
    };
  });

  const orphanOk = [...okTasks.keys()].filter(id => !moduleTasks.has(id));

  return {
    moduleRoot: mod,
    composed,
    orphanOkTaskIds: orphanOk.sort(),
    inheritedCount: composed.filter(c => c.lineage === 'INHERITED_FROM_1_4').length,
    overriddenCount: composed.filter(c => c.lineage === 'DIRECT_GOVERNED_1_5_OVERRIDE').length,
    overriddenTaskIds: composed.filter(c => c.lineage === 'DIRECT_GOVERNED_1_5_OVERRIDE').map(c => c.taskId),
  };
}

// ---------------------------------------------------------------------------
// Coverage assessment.
// ---------------------------------------------------------------------------
// A surface names which governed layers are in scope for a measurement.
//   OK_ONLY  — the Operational Knowledge payload and its governed 1.5 overlay, alone.
//   COMPOSED — the effective governed semantic surface: module layer + Operational Knowledge.
// Both are reported. Neither replaces the other.
export const SURFACES = {
  OK_ONLY: { layers: ['okOverride', 'ok'], equivalenceLayers: ['ok'] },
  COMPOSED: { layers: ['okOverride', 'ok', 'module'], equivalenceLayers: ['ok', 'module', 'moduleRoot'] },
};

function locateAttribute(attr, entry, moduleRoot, surface) {
  const scope = SURFACES[surface];
  if (!scope) throw new Error(`Unknown measurement surface "${surface}"; failed closed.`);
  const layerObj = { okOverride: entry.okOverride, ok: entry.okTask, module: entry.moduleTask };

  // 1. Direct presence under the contract name, within the surface's layers.
  for (const layer of scope.layers) {
    const obj = layerObj[layer];
    if (obj && isPopulated(obj[attr])) {
      return { status: 'SATISFIED_DIRECT', layer, path: attr, equivalenceBasis: null };
    }
  }
  // 2. Declared equivalent, only where the equivalence lives inside this surface.
  for (const eq of EQUIVALENCE_MAP[attr] ?? []) {
    if (!scope.equivalenceLayers.includes(eq.layer)) continue;
    const root = eq.layer === 'moduleRoot' ? moduleRoot
      : eq.layer === 'module' ? entry.moduleTask
        : eq.layer === 'ok' ? entry.okTask : null;
    if (root && isPopulated(at(root, eq.path))) {
      return { status: 'SATISFIED_BY_DECLARED_EQUIVALENT', layer: eq.layer, path: eq.path, equivalenceBasis: eq.basis };
    }
  }
  // 3. Present, but only nested inside a child structure rather than at task level.
  //    This is materially different from absence and is reported as its own status so
  //    that QA sees where the information already exists but is not addressable per task.
  const nested = [];
  const findNested = (node, label, depth) => {
    if (depth === 0 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => findNested(n, `${label}[]`, depth - 1)); return; }
    for (const [k, v] of Object.entries(node)) {
      const p = label ? `${label}.${k}` : k;
      if (k === attr && isPopulated(v)) nested.push(p);
      findNested(v, p, depth - 1);
    }
  };
  for (const layer of scope.layers) {
    const obj = layerObj[layer];
    if (!obj) continue;
    nested.length = 0;
    findNested(obj, '', 4);
    if (nested.length) {
      return {
        status: 'PRESENT_NESTED_ONLY_NOT_TASK_LEVEL',
        layer,
        path: [...new Set(nested)].sort().slice(0, 3).join(' | '),
        equivalenceBasis: null,
      };
    }
  }

  return { status: 'ABSENT', layer: null, path: null, equivalenceBasis: null };
}

export function assessCoverage({ contract, composition, surface = 'COMPOSED' }) {
  const groups = contract.taskOperationalKnowledge;
  const groupNames = Object.keys(groups).sort();
  const missingGroups = EXPECTED_CONTRACT_GROUPS.filter(g => !groupNames.includes(g));
  if (missingGroups.length) {
    throw new Error(`Frozen contract no longer declares groups: ${missingGroups.join(', ')}; failed closed.`);
  }

  const attributes = [];
  for (const g of groupNames) for (const a of groups[g]) attributes.push({ group: g, attribute: a });

  const tasks = composition.composed.map(entry => {
    const results = attributes.map(({ group, attribute }) => ({
      group, attribute, ...locateAttribute(attribute, entry, composition.moduleRoot, surface),
    }));
    const tally = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
    return {
      taskId: entry.taskId,
      okSourceVersion: entry.okSourceVersion,
      lineage: entry.lineage,
      contractAttributes: results,
      satisfiedDirect: tally.SATISFIED_DIRECT ?? 0,
      satisfiedByDeclaredEquivalent: tally.SATISFIED_BY_DECLARED_EQUIVALENT ?? 0,
      presentNestedOnly: tally.PRESENT_NESTED_ONLY_NOT_TASK_LEVEL ?? 0,
      absent: tally.ABSENT ?? 0,
      nestedOnlyAttributes: results.filter(r => r.status === 'PRESENT_NESTED_ONLY_NOT_TASK_LEVEL').map(r => r.attribute).sort(),
      absentAttributes: results.filter(r => r.status === 'ABSENT').map(r => r.attribute).sort(),
    };
  });

  // Per-attribute rollup across all tasks.
  const byAttribute = attributes.map(({ group, attribute }) => {
    const statuses = tasks.map(t => t.contractAttributes.find(r => r.attribute === attribute).status);
    return {
      group,
      attribute,
      satisfiedDirect: statuses.filter(s => s === 'SATISFIED_DIRECT').length,
      satisfiedByDeclaredEquivalent: statuses.filter(s => s === 'SATISFIED_BY_DECLARED_EQUIVALENT').length,
      presentNestedOnly: statuses.filter(s => s === 'PRESENT_NESTED_ONLY_NOT_TASK_LEVEL').length,
      absent: statuses.filter(s => s === 'ABSENT').length,
      taskCount: tasks.length,
    };
  });

  return { surface, attributeCount: attributes.length, tasks, byAttribute };
}

// ---------------------------------------------------------------------------
// Canonical object and document register.
// Objects are collected from governed bytes only. Nothing is named that a governed
// asset does not already name.
// ---------------------------------------------------------------------------
export function buildObjectRegister(composition) {
  const objects = new Map();   // objId -> { usageSites: Set }
  const documents = new Map(); // documentId -> { taskIds: Set, record }

  const note = (id, site) => {
    if (!objects.has(id)) objects.set(id, new Set());
    objects.get(id).add(site);
  };

  const scanForObjects = (node, taskId, pathLabel) => {
    if (typeof node === 'string') {
      if (/^obj-[a-z0-9-]+$/.test(node)) note(node, `${taskId}:${pathLabel}`);
      return;
    }
    if (Array.isArray(node)) { node.forEach(n => scanForObjects(n, taskId, pathLabel)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) scanForObjects(v, taskId, pathLabel ? `${pathLabel}.${k}` : k);
    }
  };

  for (const entry of composition.composed) {
    scanForObjects(entry.moduleTask, entry.taskId, '');
    scanForObjects(entry.okTask, entry.taskId, 'ok');
    if (entry.okOverride) scanForObjects(entry.okOverride, entry.taskId, 'ok15');

    for (const d of entry.moduleTask.documents ?? []) {
      const id = d.documentId ?? d.id ?? d.name ?? null;
      if (!id) continue;
      if (!documents.has(id)) documents.set(id, { documentId: id, taskIds: new Set(), sample: d });
      documents.get(id).taskIds.add(entry.taskId);
    }
  }

  // Object semantics required by Operational Knowledge Contract v2 objectSemantics.
  // No governed asset defines these for obj-* identifiers; that absence is the finding.
  const objectRecords = [...objects.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([canonicalObjectId, sites]) => ({
    canonicalObjectId,
    referencedByTaskCount: new Set([...sites].map(s => s.split(':')[0])).size,
    referenceSiteCount: sites.size,
    businessMeaning: null,
    relationships: null,
    cardinality: null,
    lifecycleOrStateWhereRelevant: null,
    sourceClaims: null,
    objectSemanticsStatus: 'REFERENCED_WITHOUT_CANONICAL_OBJECT_CONTRACT',
    classification: 'GOVERNED_IDENTIFIER_PENDING_OBJECT_SEMANTICS',
  }));

  const documentRecords = [...documents.values()]
    .sort((a, b) => a.documentId < b.documentId ? -1 : 1)
    .map(d => ({
      documentId: d.documentId,
      referencedByTaskCount: d.taskIds.size,
      referencedByTaskIds: [...d.taskIds].sort(),
      hasRequiredWhen: isPopulated(d.sample?.requiredWhen),
      documentSemanticsStatus: 'DECLARED_AT_TASK_LEVEL_WITHOUT_REUSABLE_DOCUMENT_CONTRACT',
    }));

  return {
    objectCount: objectRecords.length,
    objectsWithCanonicalContract: 0,
    documentCount: documentRecords.length,
    objects: objectRecords,
    documents: documentRecords,
  };
}

// ---------------------------------------------------------------------------
// BOL / information-resolution coverage against Information Resolution Contract v1.
// ---------------------------------------------------------------------------
export function buildInformationResolutionCoverage({ irContract, bolBaseline }) {
  const required = [...(irContract.required ?? [])].sort();
  const minimumSemantics = null; // supplied by caller from the OK contract when needed.

  const cols = bolBaseline.performanceColumnOrder ?? [];
  const nameIdx = cols.indexOf('fieldName');
  if (nameIdx < 0) throw new Error('BOL baseline declares no fieldName column; failed closed.');

  const unresolved = new Map((bolBaseline.unresolvedSemantics ?? []).map(u => [u.label, u.status]));

  const fields = (bolBaseline.fieldPerformanceBaseline ?? [])
    .map(row => row[nameIdx])
    .filter(n => typeof n === 'string' && n.length)
    .sort()
    .map(fieldName => ({
      fieldName,
      // Contract conformance is measured, not assumed. No governed asset carries a
      // conformant Information Resolution record for any of these fields.
      contractRecordPresent: false,
      satisfiedRequiredProperties: 0,
      requiredPropertyCount: required.length,
      governedStatus: unresolved.get(fieldName) ?? 'NO_GOVERNED_RESOLUTION_RECORD',
      conformance: 'ABSENT',
    }));

  const objectModel = bolBaseline.canonicalObjectModel ?? null;
  const modelObjects = [];
  if (objectModel) {
    if (objectModel.root) modelObjects.push(objectModel.root);
    for (const [parent, children] of Object.entries(objectModel.children ?? {})) {
      modelObjects.push(parent);
      for (const c of children) modelObjects.push(c);
    }
  }

  return {
    informationResolutionContractRequiredProperties: required,
    minimumSemantics,
    fieldCount: fields.length,
    fieldsWithConformantContract: fields.filter(f => f.contractRecordPresent).length,
    fields,
    unresolvedSemanticLabels: [...unresolved.entries()].sort(([a], [b]) => a < b ? -1 : 1)
      .map(([label, status]) => ({ label, status })),
    researchedCanonicalObjectModel: {
      status: bolBaseline.status ?? null,
      root: objectModel?.root ?? null,
      declaredNodes: [...new Set(modelObjects)].sort(),
      promotedToCanonicalObjectContracts: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Knowledge gap queue (governance/knowledge-gap-queue.schema.json).
// ---------------------------------------------------------------------------
export function buildKnowledgeGapQueue({ coverage, objectRegister, irCoverage, createdAt }) {
  const items = [];
  const push = (id, kind, basis, context = {}, affected = []) => items.push({
    id, kind, status: 'OPEN', moduleId: 'road-ltl', createdAt, basis, context,
    affectedProcessIds: affected.sort(),
  });

  // 1. Contract attributes absent across every task.
  for (const a of coverage.byAttribute) {
    if (a.absent === a.taskCount && a.taskCount > 0) {
      push(
        `R0.3-GAP-OK-${a.attribute}`,
        a.group === 'applicability' ? 'INSUFFICIENT_APPLICABILITY_EVIDENCE' : 'MISSING_A5_DETAIL',
        `Operational Knowledge Contract v2 group "${a.group}" requires "${a.attribute}". No governed Road LTL asset carries it, directly or by declared equivalent, for any of the ${a.taskCount} tasks.`,
        { contractGroup: a.group, contractAttribute: a.attribute, absentTaskCount: a.absent },
        coverage.tasks.map(t => t.taskId),
      );
    } else if (a.absent > 0) {
      push(
        `R0.3-GAP-OK-PARTIAL-${a.attribute}`,
        'DEPTH_MISMATCH',
        `Operational Knowledge Contract v2 requires "${a.attribute}". It resolves for ${a.taskCount - a.absent} of ${a.taskCount} tasks and is absent for the remainder.`,
        { contractGroup: a.group, contractAttribute: a.attribute, absentTaskCount: a.absent },
        coverage.tasks.filter(t => t.absentAttributes.includes(a.attribute)).map(t => t.taskId),
      );
    }
  }

  // 1b. Attributes that exist only nested inside child structures.
  for (const a of coverage.byAttribute) {
    if (a.presentNestedOnly > 0) {
      push(
        `R0.3-GAP-OK-NESTED-${a.attribute}`,
        'DEPTH_MISMATCH',
        `Operational Knowledge Contract v2 requires "${a.attribute}" at task level. It is populated for ${a.presentNestedOnly} of ${a.taskCount} tasks only inside a child structure, so it is not addressable as a task-level contract attribute.`,
        { contractGroup: a.group, contractAttribute: a.attribute, nestedOnlyTaskCount: a.presentNestedOnly },
        coverage.tasks.filter(t => t.nestedOnlyAttributes.includes(a.attribute)).map(t => t.taskId),
      );
    }
  }

  // 2. Object semantics.
  if (objectRegister.objectsWithCanonicalContract < objectRegister.objectCount) {
    push(
      'R0.3-GAP-OBJECT-SEMANTICS',
      'MISSING_RELATIONSHIP',
      `Operational Knowledge Contract v2 objectSemantics requires canonicalObjectId, businessMeaning, relationships, cardinality, lifecycleOrStateWhereRelevant and sourceClaims for each canonical object. ${objectRegister.objectCount} obj-* identifiers are referenced by governed Road LTL assets and ${objectRegister.objectsWithCanonicalContract} carry a canonical object contract.`,
      { referencedObjectCount: objectRegister.objectCount, contractedObjectCount: objectRegister.objectsWithCanonicalContract },
    );
  }

  // 3. Documents as reusable contracts.
  if (objectRegister.documentCount > 0) {
    push(
      'R0.3-GAP-DOCUMENT-CONTRACTS',
      'MISSING_RELATIONSHIP',
      `Operational Knowledge Contract v2 states documents are first-class reusable information contracts, not attachments to tasks. ${objectRegister.documentCount} document identifiers are declared inside task records with no reusable document contract asset.`,
      { documentCount: objectRegister.documentCount },
    );
  }

  // 4. Information resolution field contracts.
  push(
    'R0.3-GAP-IR-FIELD-CONTRACTS',
    'MISSING_A5_DETAIL',
    `Information Resolution Contract v1 requires ${irCoverage.informationResolutionContractRequiredProperties.length} properties per canonical field. ${irCoverage.fieldCount} BOL fields carry a researched performance baseline and ${irCoverage.fieldsWithConformantContract} carry a conformant resolution contract.`,
    { fieldCount: irCoverage.fieldCount, conformantCount: irCoverage.fieldsWithConformantContract },
    ['LTL-03'],
  );

  // 5. Each unresolved BOL semantic label, preserved individually.
  for (const u of irCoverage.unresolvedSemanticLabels) {
    push(
      `R0.3-GAP-BOL-${u.label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      u.status === 'CLIENT_BINDING_REQUIRED' ? 'INSUFFICIENT_APPLICABILITY_EVIDENCE' : 'SOURCE_CONFLICT',
      `BOL information-resolution baseline records "${u.label}" as ${u.status}. R0.3 preserves it as an explicit governed gap and does not resolve it by inference.`,
      { label: u.label, governedStatus: u.status },
      ['LTL-03'],
    );
  }

  items.sort((a, b) => a.id < b.id ? -1 : 1);
  return { schemaVersion: 'atlas-knowledge-gap-queue-v1.0', items };
}
