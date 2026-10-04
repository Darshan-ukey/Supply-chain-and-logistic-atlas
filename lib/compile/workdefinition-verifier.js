import { WORKDEFINITION_SCHEMA_VERSION, WORKDEFINITION_CONTRACT_VERSION } from './workdefinition-compiler.js';

// Atlas P6.2 — Canonical WorkDefinition verifier.
// Deterministic, dependency-free structural + boundary validation.
// Produces ordered, human-readable violations. Never mutates input.

const UNIT_TYPES = new Set([
  'TASK_ROOT','INFORMATION_RESOLUTION','DECISION_EVALUATION','DECISION_GATE','ACTION_EXECUTION','ACTION_GROUP',
  'ATOMIC_ACTION_CANDIDATE','ATOMIC_ACTION','TEMPORAL_CONTROL','TEMPORAL_GATE','EVIDENCE_AND_STATE','EVIDENCE_CAPTURE'
]);

const EXECUTOR_CLASSES = new Set([
  'EXECUTABLE_HUMAN','EXECUTABLE_RULE','EXECUTABLE_SYSTEM','EXECUTABLE_API','EXECUTABLE_RPA',
  'EXECUTABLE_DOCUMENT_AI','EXECUTABLE_AGENT','EXECUTABLE_HYBRID','EXECUTOR_CLASS_UNBOUND'
]);

const ALLOWED_TOP_LEVEL = new Set([
  'schemaVersion','workDefinitionId','contractVersion','version','status','title','purpose',
  'lineage','provenance','applicability','executability','executionCharacteristics',
  'trigger','inputs','actors','systems','decisions','rules','validations','controls','actions',
  'outcomes','transitions','clocks','evidence','exceptions','dependencies','clientBindingRequirements'
]);

const ALLOWED_LINEAGE = new Set([
  'daughterModule','daughterVersion','semanticSourceVersion','inheritance','sourceTaskId','sourceTaskTitle',
  'decompositionId','decompositionContractVersion','sourceWorkUnitId','workUnitPath','unitType','parentWorkUnitId','sequence'
]);

/**
 * Runtime/client structures that must never enter canonical WorkDefinition.
 * Matched case-insensitively against every object key at any depth.
 */
export const FORBIDDEN_KEY_TOKENS = [
  'malkomprojection','malkom','queue','subqueue','sub_queue','rpastep','rpa_step',
  'agentprompt','agent_prompt','runtimemapping','runtimemappings','runtimeprojection',
  'clientfieldmapping','clientapplication','clientenvironment','clientvalue','clientsystem',
  'endpoint','connectionstring','credential','apikey','api_key'
];

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

/** Walk every object key at any depth. */
function walkKeys(value, visit, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkKeys(item, visit, `${path}[${i}]`));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      visit(key, `${path}.${key}`, child);
      walkKeys(child, visit, `${path}.${key}`);
    }
  }
}

function checkForbiddenLeakage(definition, violations) {
  walkKeys(definition, (key, path) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const token of FORBIDDEN_KEY_TOKENS) {
      if (normalized === token || normalized.includes(token)) {
        violations.push(`${definition.workDefinitionId}: forbidden runtime/client key '${key}' at ${path}`);
        return;
      }
    }
  });
}

function requireArrayOfStrings(value, label, id, violations) {
  if (!Array.isArray(value)) { violations.push(`${id}: ${label} must be an array`); return; }
  value.forEach((x, i) => { if (typeof x !== 'string') violations.push(`${id}: ${label}[${i}] must be a string`); });
}

function verifyOne(definition, context, violations) {
  const id = definition?.workDefinitionId || '<missing workDefinitionId>';

  if (!isObject(definition)) { violations.push(`${id}: WorkDefinition must be an object`); return; }

  for (const key of Object.keys(definition)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) violations.push(`${id}: unknown top-level property '${key}'`);
  }

  if (definition.schemaVersion !== WORKDEFINITION_SCHEMA_VERSION) violations.push(`${id}: schemaVersion must be ${WORKDEFINITION_SCHEMA_VERSION}`);
  if (definition.contractVersion !== WORKDEFINITION_CONTRACT_VERSION) violations.push(`${id}: contractVersion must be ${WORKDEFINITION_CONTRACT_VERSION}`);
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(String(definition.version || ''))) violations.push(`${id}: version must be semantic (x.y.z)`);
  if (!['DRAFT','VALIDATED_REFERENCE_DEFINITION','APPROVED','ACTIVE','DEPRECATED'].includes(definition.status)) violations.push(`${id}: invalid status '${definition.status}'`);
  if (typeof definition.title !== 'string' || !definition.title.trim()) violations.push(`${id}: title is required`);

  // ---- lineage ----
  const lineage = definition.lineage;
  if (!isObject(lineage)) {
    violations.push(`${id}: lineage is required`);
  } else {
    for (const key of Object.keys(lineage)) {
      if (!ALLOWED_LINEAGE.has(key)) violations.push(`${id}: unknown lineage property '${key}'`);
    }
    for (const key of ['daughterModule','daughterVersion','semanticSourceVersion','inheritance','sourceTaskId','sourceTaskTitle','decompositionId','sourceWorkUnitId','unitType']) {
      if (!lineage[key] || typeof lineage[key] !== 'string') violations.push(`${id}: lineage.${key} is required`);
    }
    if (lineage.decompositionContractVersion !== '1.0.0') violations.push(`${id}: lineage.decompositionContractVersion must be 1.0.0`);
    if (!UNIT_TYPES.has(String(lineage.unitType))) violations.push(`${id}: lineage.unitType '${lineage.unitType}' is not a governed unit type`);

    if (!Array.isArray(lineage.workUnitPath) || lineage.workUnitPath.length === 0) {
      violations.push(`${id}: lineage.workUnitPath must be a non-empty root-to-leaf chain`);
    } else if (lineage.workUnitPath[lineage.workUnitPath.length - 1] !== lineage.sourceWorkUnitId) {
      violations.push(`${id}: lineage.workUnitPath must terminate at sourceWorkUnitId`);
    }

    // Exact-tuple integrity against the compilation context.
    if (context) {
      if (lineage.daughterModule !== context.moduleId) violations.push(`${id}: lineage.daughterModule does not match compiled module ${context.moduleId}`);
      if (String(lineage.daughterVersion) !== String(context.moduleVersion)) violations.push(`${id}: lineage.daughterVersion does not match compiled effective version ${context.moduleVersion}`);
    }
  }

  // ---- provenance ----
  const provenance = definition.provenance;
  if (!isObject(provenance)) {
    violations.push(`${id}: provenance is required`);
  } else {
    if (provenance.compiledFrom !== 'CANONICAL_WORK_DECOMPOSITION_V1') violations.push(`${id}: provenance.compiledFrom must be CANONICAL_WORK_DECOMPOSITION_V1`);
    if (!provenance.compilerVersion) violations.push(`${id}: provenance.compilerVersion is required`);
    if (!/^[0-9a-f]{64}$/.test(String(provenance.governedInputContentHash || ''))) violations.push(`${id}: provenance.governedInputContentHash must be a 64-hex digest`);
    if (context && provenance.governedInputContentHash !== context.governedInputContentHash) {
      violations.push(`${id}: provenance.governedInputContentHash does not match the governed upstream input`);
    }
    requireArrayOfStrings(provenance.sourceRefs, 'provenance.sourceRefs', id, violations);
  }

  // ---- applicability ----
  const applicability = definition.applicability;
  if (!isObject(applicability)) {
    violations.push(`${id}: applicability is required`);
  } else {
    for (const key of ['requiredWhen','prohibitedWhen','entryConditions']) {
      requireArrayOfStrings(applicability[key], `applicability.${key}`, id, violations);
    }
  }

  // ---- executability ----
  const executability = definition.executability;
  if (!isObject(executability)) {
    violations.push(`${id}: executability is required`);
  } else {
    if (executability.status !== 'EXECUTOR_READY') {
      violations.push(`${id}: only EXECUTOR_READY work compiles to a WorkDefinition; found '${executability.status}'`);
    }
    if (!EXECUTOR_CLASSES.has(String(executability.executorClass))) {
      violations.push(`${id}: executability.executorClass '${executability.executorClass}' is not in the governed vocabulary`);
    }
    if (executability.independentExecutorProofStatus !== 'NOT_INDEPENDENTLY_PROVEN') {
      violations.push(`${id}: independentExecutorProofStatus may not be claimed by compilation`);
    }
    requireArrayOfStrings(executability.requiredClientBindings, 'executability.requiredClientBindings', id, violations);
    requireArrayOfStrings(executability.requiredKnowledgeGaps, 'executability.requiredKnowledgeGaps', id, violations);
  }

  // ---- execution characteristics ----
  const chars = definition.executionCharacteristics;
  if (!isObject(chars)) {
    violations.push(`${id}: executionCharacteristics is required`);
  } else {
    for (const key of ['executorClassBound','clientBindingRequired','knowledgeGapPresent']) {
      if (typeof chars[key] !== 'boolean') violations.push(`${id}: executionCharacteristics.${key} must be boolean`);
    }
    const bindings = Array.isArray(executability?.requiredClientBindings) ? executability.requiredClientBindings : [];
    const gaps = Array.isArray(executability?.requiredKnowledgeGaps) ? executability.requiredKnowledgeGaps : [];
    if (chars.clientBindingRequired !== (bindings.length > 0)) violations.push(`${id}: executionCharacteristics.clientBindingRequired disagrees with requiredClientBindings`);
    if (chars.knowledgeGapPresent !== (gaps.length > 0)) violations.push(`${id}: executionCharacteristics.knowledgeGapPresent disagrees with requiredKnowledgeGaps`);
    if (chars.executorClassBound !== (String(executability?.executorClass) !== 'EXECUTOR_CLASS_UNBOUND')) {
      violations.push(`${id}: executionCharacteristics.executorClassBound disagrees with executability.executorClass`);
    }
  }

  // ---- client-binding boundary ----
  requireArrayOfStrings(definition.clientBindingRequirements, 'clientBindingRequirements', id, violations);
  const declared = JSON.stringify(Array.isArray(definition.clientBindingRequirements) ? definition.clientBindingRequirements : []);
  const fromExecutability = JSON.stringify(Array.isArray(executability?.requiredClientBindings) ? executability.requiredClientBindings : []);
  if (declared !== fromExecutability) {
    violations.push(`${id}: clientBindingRequirements must mirror executability.requiredClientBindings exactly`);
  }

  // ---- forbidden runtime/client leakage ----
  checkForbiddenLeakage(definition, violations);
}

/** Verify a single WorkDefinition. */
export function verifyWorkDefinition(definition, context = null) {
  const violations = [];
  verifyOne(definition, context, violations);
  return { ok: violations.length === 0, violations };
}

/**
 * Verify a full compilation result: every definition, plus cross-cutting
 * identity, coverage-arithmetic and blocked-work integrity.
 */
export function verifyCompilation(compilation) {
  const violations = [];

  if (compilation?.schemaVersion !== 'atlas-canonical-workdefinition-compilation-v1') {
    violations.push('compilation: unexpected schemaVersion');
  }
  const context = {
    moduleId: compilation?.moduleId,
    moduleVersion: compilation?.moduleVersion,
    governedInputContentHash: compilation?.governedInputContentHash
  };

  const definitions = Array.isArray(compilation?.definitions) ? compilation.definitions : [];
  const coverage = Array.isArray(compilation?.coverage) ? compilation.coverage : [];

  const seen = new Set();
  for (const definition of definitions) {
    if (seen.has(definition?.workDefinitionId)) violations.push(`duplicate workDefinitionId: ${definition?.workDefinitionId}`);
    seen.add(definition?.workDefinitionId);
    verifyOne(definition, context, violations);
  }

  // Every compiled definition must belong to a declared coverage task.
  const coverageByTask = new Map(coverage.map(c => [String(c.sourceTaskId), c]));
  const compiledPerTask = new Map();
  for (const definition of definitions) {
    const taskId = String(definition?.lineage?.sourceTaskId || '');
    if (!coverageByTask.has(taskId)) {
      violations.push(`${definition?.workDefinitionId}: no coverage record for task ${taskId}`);
      continue;
    }
    compiledPerTask.set(taskId, (compiledPerTask.get(taskId) || 0) + 1);
  }

  for (const record of coverage) {
    const taskId = String(record.sourceTaskId);
    const actual = compiledPerTask.get(taskId) || 0;
    if (actual !== Number(record.compiledCount)) {
      violations.push(`coverage ${taskId}: compiledCount ${record.compiledCount} disagrees with ${actual} compiled definitions`);
    }
    if (Number(record.compiledCount) + Number(record.notCompiledCount) !== Number(record.leafCount)) {
      violations.push(`coverage ${taskId}: compiled + notCompiled does not equal leafCount`);
    }
    const expectedStatus = Number(record.notCompiledCount) === 0 ? 'FULLY_COMPILED' : 'PARTIALLY_COMPILED_WITH_EXPLICIT_BLOCKERS';
    if (record.coverageStatus !== expectedStatus) {
      violations.push(`coverage ${taskId}: coverageStatus '${record.coverageStatus}' disagrees with blocker counts`);
    }
    for (const blocked of record.notCompiled || []) {
      if (blocked.status !== 'BLOCKED_BY_CLIENT_BINDING' && blocked.status !== 'BLOCKED_BY_KNOWLEDGE_GAP') {
        violations.push(`coverage ${taskId}: blocked leaf ${blocked.workUnitId} has non-blocked status '${blocked.status}'`);
      }
      const refs = [...(blocked.requiredClientBindings || []), ...(blocked.requiredKnowledgeGaps || [])];
      if (refs.length === 0) {
        violations.push(`coverage ${taskId}: blocked leaf ${blocked.workUnitId} must preserve at least one governed blocker reference`);
      }
      if (seen.has(`${context.moduleId}@${context.moduleVersion}::${taskId}::${blocked.workUnitId}::WD`)) {
        violations.push(`coverage ${taskId}: blocked leaf ${blocked.workUnitId} must not have produced a WorkDefinition`);
      }
    }
  }

  // Totals must be arithmetic, not asserted.
  const totals = compilation?.totals || {};
  if (Number(totals.workDefinitionCount) !== definitions.length) {
    violations.push(`totals.workDefinitionCount ${totals.workDefinitionCount} disagrees with ${definitions.length} definitions`);
  }
  const summed = coverage.reduce((n, c) => n + Number(c.compiledCount || 0), 0);
  if (summed !== definitions.length) {
    violations.push(`coverage compiledCount sum ${summed} disagrees with ${definitions.length} definitions`);
  }

  return { ok: violations.length === 0, violations };
}
