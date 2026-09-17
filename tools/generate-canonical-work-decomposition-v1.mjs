import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * Atlas Canonical Work Decomposition Generator V1
 *
 * This implementation is intentionally runtime-neutral. It never projects
 * canonical work into Malkom, RPA, workflow-engine, agent, or client-specific
 * schemas. It also never uses historical P6.1 counts as generation targets.
 *
 * Input contract (JSON):
 * {
 *   moduleId, moduleVersion, generationContractVersion,
 *   tasks: [{
 *     taskId, semanticSourceVersion,
 *     workDecompositionSeed: [{ id?, name?, action?, type?, sourceRefs?,
 *       childContracts?, decisionCriteria?, validationRules?, authority?,
 *       exceptionPolicy?, clientBindingRequired?, runtimeBindingRequired?,
 *       knowledgeGaps? }]
 *   }]
 * }
 */

const GENERATOR_ID = 'atlas-canonical-work-decomposition-generator-v1';
const GENERATOR_VERSION = '1.0.0';
const HASH_ALGORITHM = 'sha256';
const CANONICALIZATION_VERSION = 'atlas-stable-json-v1';

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash(HASH_ALGORITHM).update(typeof value === 'string' ? value : stable(value)).digest('hex');
}

function slug(v) {
  return String(v ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unit';
}

function asArray(v) { return Array.isArray(v) ? v : []; }
function has(v) { return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === ''); }

function deriveStatus(unit) {
  const knowledgeGaps = asArray(unit.knowledgeGaps).filter(Boolean);
  if (knowledgeGaps.length) {
    return { status: 'BLOCKED_BY_KNOWLEDGE_GAP', blockerRefs: knowledgeGaps.map(String).sort() };
  }

  const materialDecision = unit.type === 'DECISION_GATE' || unit.materialDecision === true;
  if (materialDecision && !has(unit.decisionCriteria)) {
    return { status: 'BLOCKED_BY_KNOWLEDGE_GAP', blockerRefs: ['MISSING_DECISION_CRITERIA'] };
  }

  const validationRequired = unit.validationRequired === true;
  if (validationRequired && asArray(unit.validationRules).length === 0) {
    return { status: 'BLOCKED_BY_KNOWLEDGE_GAP', blockerRefs: ['MISSING_APPLICABLE_VALIDATION_RULE'] };
  }

  const authorityMaterial = unit.authorityMaterial === true;
  if (authorityMaterial && !has(unit.authority)) {
    return { status: 'BLOCKED_BY_KNOWLEDGE_GAP', blockerRefs: ['MISSING_CANONICAL_AUTHORITY'] };
  }

  const failureModeMaterial = unit.failureModeMaterial === true;
  const hasFailureSemantics = has(unit.failurePath) || has(unit.exceptionPolicy);
  if (failureModeMaterial && !hasFailureSemantics) {
    return { status: 'BLOCKED_BY_KNOWLEDGE_GAP', blockerRefs: ['MISSING_FAILURE_OR_EXCEPTION_SEMANTICS'] };
  }

  if (unit.clientBindingRequired === true || unit.runtimeBindingRequired === true) {
    const refs = [];
    if (unit.clientBindingRequired === true) refs.push('CLIENT_BINDING_REQUIRED');
    if (unit.runtimeBindingRequired === true) refs.push('RUNTIME_BINDING_REQUIRED');
    return { status: 'BLOCKED_BY_CLIENT_BINDING', blockerRefs: refs };
  }

  return { status: 'EXECUTOR_READY', blockerRefs: [] };
}

function childContracts(seed) {
  const children = asArray(seed.childContracts);
  // CR2: a recursive split is only valid where each child is explicitly
  // source-supported and independently carries execution/gate semantics.
  return children.filter(c => c && c.sourceSupported === true && (has(c.action) || has(c.decisionCriteria)));
}

function normalizeUnit(raw, ctx) {
  const readiness = deriveStatus(raw);
  const out = {
    id: ctx.id,
    parentId: ctx.parentId,
    rootId: ctx.rootId,
    sourceTaskId: ctx.taskId,
    semanticSourceVersion: ctx.semanticSourceVersion,
    path: ctx.path,
    type: raw.type || (has(raw.decisionCriteria) ? 'DECISION_GATE' : 'ACTION'),
    name: raw.name || raw.action || raw.id || ctx.id,
    action: raw.action ?? null,
    decisionCriteria: raw.decisionCriteria ?? null,
    validationRules: asArray(raw.validationRules),
    authority: raw.authority ?? null,
    authorityMaterial: raw.authorityMaterial === true,
    failurePath: raw.failurePath ?? null,
    exceptionPolicy: raw.exceptionPolicy ?? null,
    failureModeMaterial: raw.failureModeMaterial === true,
    sourceRefs: asArray(raw.sourceRefs).map(String).sort(),
    status: readiness.status,
    blockerRefs: readiness.blockerRefs,
    adapterCapabilityRequirements: asArray(raw.adapterCapabilityRequirements).map(String).sort()
  };
  out.contentHash = sha256(out);
  return out;
}

function generateTask(task) {
  if (!task?.taskId) throw new Error('taskId is required');
  const semanticSourceVersion = task.semanticSourceVersion ?? null;
  const rootId = `WD-${slug(task.taskId)}-root`;
  const root = {
    id: rootId,
    parentId: null,
    rootId,
    sourceTaskId: task.taskId,
    semanticSourceVersion,
    path: [],
    type: 'TASK_ROOT',
    name: task.name || task.taskId,
    action: null,
    decisionCriteria: null,
    validationRules: [],
    authority: null,
    authorityMaterial: false,
    failurePath: null,
    exceptionPolicy: null,
    failureModeMaterial: false,
    sourceRefs: asArray(task.sourceRefs).map(String).sort(),
    status: 'NEEDS_DECOMPOSITION',
    blockerRefs: [],
    adapterCapabilityRequirements: []
  };
  root.contentHash = sha256(root);

  const units = [root];
  const seeds = asArray(task.workDecompositionSeed);

  seeds.forEach((seed, i) => {
    const primaryPath = [i + 1];
    const primaryId = `${rootId}-${String(i + 1).padStart(2, '0')}`;
    const children = childContracts(seed);

    if (children.length >= 2) {
      const container = normalizeUnit({ ...seed, type: seed.type || 'ACTION_GROUP', knowledgeGaps: ['REQUIRES_GOVERNED_CHILD_DECOMPOSITION'] }, {
        id: primaryId, parentId: rootId, rootId, taskId: task.taskId,
        semanticSourceVersion, path: primaryPath
      });
      container.status = 'NEEDS_DECOMPOSITION';
      container.blockerRefs = [];
      container.contentHash = sha256(container);
      units.push(container);

      children.forEach((child, j) => {
        const childPath = [...primaryPath, j + 1];
        const childId = `${primaryId}-${String(j + 1).padStart(2, '0')}`;
        units.push(normalizeUnit(child, {
          id: childId, parentId: primaryId, rootId, taskId: task.taskId,
          semanticSourceVersion, path: childPath
        }));
      });
    } else {
      units.push(normalizeUnit(seed, {
        id: primaryId, parentId: rootId, rootId, taskId: task.taskId,
        semanticSourceVersion, path: primaryPath
      }));
    }
  });

  if (seeds.length === 0) {
    root.status = 'BLOCKED_BY_KNOWLEDGE_GAP';
    root.blockerRefs = ['WORK_DECOMPOSITION_SEED_NOT_DECLARED'];
    root.contentHash = sha256(root);
  }

  return { taskId: task.taskId, semanticSourceVersion, units };
}

function validateGraph(tasks) {
  const all = tasks.flatMap(t => t.units);
  const byId = new Map(all.map(u => [u.id, u]));
  if (byId.size !== all.length) throw new Error('Duplicate work-unit ID');
  for (const unit of all) {
    if (unit.parentId && !byId.has(unit.parentId)) throw new Error(`Orphan parent for ${unit.id}`);
    if (unit.status === 'NEEDS_DECOMPOSITION') {
      const hasChild = all.some(x => x.parentId === unit.id);
      if (!hasChild) throw new Error(`Invalid terminal NEEDS_DECOMPOSITION: ${unit.id}`);
    }
  }
  for (const unit of all) {
    const seen = new Set([unit.id]);
    let p = unit.parentId;
    while (p) {
      if (seen.has(p)) throw new Error(`Cycle detected at ${unit.id}`);
      seen.add(p);
      p = byId.get(p)?.parentId ?? null;
    }
  }
}

export function generate(input) {
  if (!input?.moduleId || !input?.moduleVersion) throw new Error('moduleId and moduleVersion are required');
  const tasks = asArray(input.tasks).slice().sort((a, b) => String(a.taskId).localeCompare(String(b.taskId))).map(generateTask);
  validateGraph(tasks);

  const semantic = {
    schemaVersion: 'atlas-canonical-work-decomposition-output-v1',
    generator: { id: GENERATOR_ID, version: GENERATOR_VERSION, canonicalization: CANONICALIZATION_VERSION, hashAlgorithm: HASH_ALGORITHM },
    moduleId: input.moduleId,
    moduleVersion: input.moduleVersion,
    generationContractVersion: input.generationContractVersion || 'P6_1_SUCCESSOR_GENERATION_CONTRACT_V1',
    tasks
  };
  semantic.semanticHash = sha256(semantic);
  return semantic;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: node tools/generate-canonical-work-decomposition-v1.mjs <input.json>');
  const input = JSON.parse(fs.readFileSync(path, 'utf8'));
  process.stdout.write(`${JSON.stringify(generate(input), null, 2)}\n`);
}
