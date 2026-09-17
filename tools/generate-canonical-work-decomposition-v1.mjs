import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * Atlas Canonical Work Decomposition Generator V1 — HARDENED
 *
 * Implements P6_1_SUCCESSOR_GENERATION_CONTRACT_V1.md.
 * Status: DRAFT_CANDIDATE — NOT OWNER-FROZEN. See governance/generation/
 * GENERATOR_V1_HARDENING_NOTES.md for the empirical defects this version
 * fixes relative to the original commit (00bb8bb).
 *
 * This implementation is intentionally runtime-neutral. It never projects
 * canonical work into Malkom, RPA, workflow-engine, agent, or client-specific
 * schemas (contract §7). It never uses historical P6.1 counts as generation
 * targets (contract §5) — this function is pure and receives no historical
 * count as input by construction; see the self-QA harness for the
 * non-influence proof.
 */

const GENERATOR_ID = 'atlas-canonical-work-decomposition-generator-v1';
const GENERATOR_VERSION = '1.1.0';
const HASH_ALGORITHM = 'sha256';
const CANONICALIZATION_VERSION = 'atlas-stable-json-v1';
const CONTAINER_TYPES = Object.freeze(['TASK_ROOT', 'ACTION_GROUP']);

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
function isContainerType(type) { return CONTAINER_TYPES.includes(type); }

/**
 * Collect ALL applicable blockers, not the first match.
 *
 * HARDENING FIX 1 (empirically confirmed defect in 00bb8bb): the original
 * returned on the first matching rule, so a unit with e.g. missing decision
 * criteria AND missing validation AND missing authority AND missing failure
 * semantics reported only 'MISSING_DECISION_CRITERIA' — the other three
 * genuine gaps were invisible in the output. A reader auditing the result
 * for completeness would not know they existed. Every applicable rule is
 * now evaluated and every resulting ref is unioned before status is decided.
 *
 * HARDENING FIX 2 (empirically confirmed defect): the original had no floor
 * requirement for EXECUTOR_READY. A unit with action=null and no other
 * declared gap classified as EXECUTOR_READY — a governed-ready leaf with no
 * governed operation. This reproduces the historical V1 terminal test's own
 * requirement ("one unambiguous operation") as a structural floor: no unit
 * may reach EXECUTOR_READY without a non-null action or decisionCriteria,
 * regardless of what other flags were or were not set on it.
 */
function deriveStatus(unit) {
  const kgRefs = new Set();

  for (const gap of asArray(unit.knowledgeGaps).filter(Boolean)) kgRefs.add(String(gap));

  const materialDecision = unit.type === 'DECISION_GATE' || unit.materialDecision === true;
  if (materialDecision && !has(unit.decisionCriteria)) kgRefs.add('MISSING_DECISION_CRITERIA');

  if (unit.validationRequired === true && asArray(unit.validationRules).length === 0) {
    kgRefs.add('MISSING_APPLICABLE_VALIDATION_RULE');
  }

  if (unit.authorityMaterial === true && !has(unit.authority)) kgRefs.add('MISSING_CANONICAL_AUTHORITY');

  if (unit.failureModeMaterial === true && !has(unit.failurePath) && !has(unit.exceptionPolicy)) {
    kgRefs.add('MISSING_FAILURE_OR_EXCEPTION_SEMANTICS');
  }

  if (!isContainerType(unit.type) && !has(unit.action) && !has(unit.decisionCriteria)) {
    kgRefs.add('MISSING_ACTION_OR_DECISION');
  }

  if (kgRefs.size > 0) {
    return { status: 'BLOCKED_BY_KNOWLEDGE_GAP', blockerRefs: [...kgRefs].sort() };
  }

  const cbRefs = new Set();
  if (unit.clientBindingRequired === true) cbRefs.add('CLIENT_BINDING_REQUIRED');
  if (unit.runtimeBindingRequired === true) cbRefs.add('RUNTIME_BINDING_REQUIRED');
  if (cbRefs.size > 0) return { status: 'BLOCKED_BY_CLIENT_BINDING', blockerRefs: [...cbRefs].sort() };

  return { status: 'EXECUTOR_READY', blockerRefs: [] };
}

/**
 * CR2 equivalent: a candidate child is only accepted when it is explicitly
 * marked source-supported AND independently carries execution/gate
 * semantics of its own (an action or decision criteria) — object-model
 * membership or lexical presence alone does not qualify.
 */
function classifyChildren(seed) {
  const declared = asArray(seed.childContracts);
  const accepted = [];
  const rejected = [];
  declared.forEach((c, i) => {
    const id = c?.id ?? `candidate-${i + 1}`;
    if (c && c.sourceSupported === true && (has(c.action) || has(c.decisionCriteria))) {
      accepted.push(c);
    } else {
      rejected.push({ id, reason: !c ? 'NULL_CANDIDATE' : c.sourceSupported !== true ? 'NOT_SOURCE_SUPPORTED' : 'NO_INDEPENDENT_EXECUTION_SEMANTICS' });
    }
  });
  return { declared, accepted, rejected };
}

/**
 * HARDENING ADDITION: every seed that declared any candidate child contracts
 * carries a visible audit record of what was considered, accepted and
 * rejected — regardless of whether the >=2 split threshold was met. This is
 * what makes "was anything dropped" answerable by inspection rather than by
 * trusting the generator's silence. Absent this, a rejected or below-
 * threshold child leaves no trace anywhere in the output (the exact
 * condition probed and confirmed against 00bb8bb).
 */
function childContractAudit(classified) {
  if (classified.declared.length === 0) return null;
  return {
    declaredCount: classified.declared.length,
    acceptedCount: classified.accepted.length,
    splitApplied: classified.accepted.length >= 2,
    rejected: classified.rejected.map(r => ({ id: String(r.id), reason: r.reason })).sort((a, b) => a.id.localeCompare(b.id))
  };
}

function normalizeUnit(raw, ctx, audit = null) {
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
    validationRules: asArray(raw.validationRules).map(String).sort(),
    authority: raw.authority ?? null,
    authorityMaterial: raw.authorityMaterial === true,
    failurePath: raw.failurePath ?? null,
    exceptionPolicy: raw.exceptionPolicy ?? null,
    failureModeMaterial: raw.failureModeMaterial === true,
    sourceRefs: asArray(raw.sourceRefs).map(String).sort(),
    status: readiness.status,
    blockerRefs: readiness.blockerRefs,
    adapterCapabilityRequirements: asArray(raw.adapterCapabilityRequirements).map(String).sort(),
    childContractAudit: audit
  };
  out.contentHash = sha256(out);
  return out;
}

function generateTask(task) {
  if (!task?.taskId) throw new Error('taskId is required');
  const semanticSourceVersion = task.semanticSourceVersion ?? null;
  const rootId = `WD-${slug(task.taskId)}-root`;
  const root = normalizeUnit(
    { name: task.name || task.taskId, sourceRefs: task.sourceRefs, type: 'TASK_ROOT' },
    { id: rootId, parentId: null, rootId, taskId: task.taskId, semanticSourceVersion, path: [] }
  );
  root.status = 'NEEDS_DECOMPOSITION';
  root.blockerRefs = [];

  const units = [root];
  const seeds = asArray(task.workDecompositionSeed);

  seeds.forEach((seed, i) => {
    const primaryPath = [i + 1];
    const primaryId = `${rootId}-${String(i + 1).padStart(2, '0')}`;
    const classified = classifyChildren(seed);
    const audit = childContractAudit(classified);

    if (classified.accepted.length >= 2) {
      // CR2/contract §4.4: split only where >=2 children are independently
      // source-supported. The container's type is always ACTION_GROUP,
      // regardless of what the pre-split seed declared — its role is
      // structural grouping, not the seed's own semantic type.
      const container = normalizeUnit(
        { name: seed.name || seed.id, type: 'ACTION_GROUP', sourceRefs: seed.sourceRefs },
        { id: primaryId, parentId: rootId, rootId, taskId: task.taskId, semanticSourceVersion, path: primaryPath },
        audit
      );
      container.status = 'NEEDS_DECOMPOSITION';
      container.blockerRefs = [];
      container.contentHash = sha256(container);
      units.push(container);

      classified.accepted.forEach((child, j) => {
        const childPath = [...primaryPath, j + 1];
        const childId = `${primaryId}-${String(j + 1).padStart(2, '0')}`;
        units.push(normalizeUnit(child, {
          id: childId, parentId: primaryId, rootId, taskId: task.taskId, semanticSourceVersion, path: childPath
        }));
      });
    } else {
      // Below split threshold: the seed itself remains one primary unit.
      // childContractAudit is still attached when candidates existed, so a
      // below-threshold or fully-rejected set of children is visible on the
      // unit rather than silently absorbed with no trace. This unit is
      // subject to the same minimum-sufficiency floor as any other in
      // deriveStatus: if it has no action/decisionCriteria of its own (the
      // below-threshold child's content is NOT merged in — merging would
      // invent structure the source did not establish), it fails closed to
      // BLOCKED_BY_KNOWLEDGE_GAP rather than reaching a false READY.
      units.push(normalizeUnit(seed, {
        id: primaryId, parentId: rootId, rootId, taskId: task.taskId, semanticSourceVersion, path: primaryPath
      }, audit));
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
    // HARDENING ADDITION: the floor from deriveStatus, re-asserted as a
    // structural graph invariant so it cannot be bypassed by any future
    // code path that constructs a unit without going through normalizeUnit.
    if (unit.status === 'EXECUTOR_READY' && !has(unit.action) && !has(unit.decisionCriteria)) {
      throw new Error(`EXECUTOR_READY unit with no action or decisionCriteria: ${unit.id}`);
    }
    // Runtime/adapter contamination guard (contract §7): canonical units must
    // never carry Malkom/adapter-shaped keys. Defensive re-check independent
    // of normalizeUnit's allow-list, in case a future caller inspects raw
    // input fields directly rather than only the normalized output.
    const forbidden = ['queueId', 'subqueueId', 'malkomWorkType', 'workflowEngineState', 'rpaStepId', 'agentSchemaId'];
    for (const key of forbidden) {
      if (Object.prototype.hasOwnProperty.call(unit, key)) throw new Error(`Runtime/adapter key '${key}' leaked into canonical unit ${unit.id}`);
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

export const __internal = { deriveStatus, classifyChildren, CONTAINER_TYPES };

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: node tools/generate-canonical-work-decomposition-v1.mjs <input.json>');
  const input = JSON.parse(fs.readFileSync(path, 'utf8'));
  process.stdout.write(`${JSON.stringify(generate(input), null, 2)}\n`);
}
