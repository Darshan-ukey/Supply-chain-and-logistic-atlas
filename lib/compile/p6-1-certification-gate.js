import fs from 'node:fs';

// Atlas P6.2 — mandatory upstream certification gate.
//
// Compilation of Canonical WorkDefinitions is only permitted from a decomposition that is
// certified, hash-anchored and count-reconciled. There is NO skip path: a missing, mismatched
// or unreadable certification artifact is a hard failure, never a warning.
//
// Governing rule: WorkDefinitions are derived truth. Deriving them from an uncertified or
// unverified decomposition would manufacture unearned governance standing.

export class CertificationError extends Error {
  constructor(message) { super(message); this.name = 'CertificationError'; this.certification = true; }
}

const fail = message => { throw new CertificationError(message); };

function readJsonOrFail(path, label) {
  if (!path) fail(`${label} path is not configured; certification cannot be verified. Failed closed.`);
  if (!fs.existsSync(path)) fail(`${label} is missing at '${path}'; compilation from an uncertified decomposition is prohibited. Failed closed.`);
  let raw;
  try { raw = fs.readFileSync(path, 'utf8'); } catch (e) { fail(`${label} at '${path}' could not be read: ${e.message}. Failed closed.`); }
  try { return JSON.parse(raw); } catch (e) { fail(`${label} at '${path}' is not valid JSON: ${e.message}. Failed closed.`); }
}

function requireNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} is missing or not numeric in the governed certification evidence. Failed closed.`);
  return value;
}

function requireEqual(actual, expected, label) {
  if (String(actual) !== String(expected)) fail(`${label}: expected '${expected}', found '${actual}'. Failed closed.`);
}

/**
 * Verify the governed upstream input BEFORE compilation.
 * Requires: certification record, PUBLIC_SAFE summary, exact tuple, certified content hash,
 * semantic lineage, and mutual consistency between the two governed artifacts.
 *
 * @returns {object} attestation — required by reconcileCompilation and by any persistence.
 */
export function preflightCertification({
  moduleId,
  moduleVersion,
  certificationPath,
  summaryPath,
  pinnedContentHash = null
}) {
  if (!moduleId || !moduleVersion) fail('Exact moduleId and moduleVersion are required to verify certification. Failed closed.');

  const certification = readJsonOrFail(certificationPath, 'Governed P6.1 certification record');
  const summary = readJsonOrFail(summaryPath, 'Governed P6.1 PUBLIC_SAFE decomposition summary');

  // ---- certification record identity ------------------------------------------------
  requireEqual(certification.schemaVersion, 'atlas-p6-1-recursive-work-decomposition-certification-v1', 'Certification schemaVersion');
  requireEqual(certification.status, 'COMPLETE_PASS', 'Certification status');
  requireEqual(certification.moduleId, moduleId, 'Certification moduleId');
  requireEqual(certification.moduleVersion, moduleVersion, 'Certification moduleVersion');
  requireEqual(certification.contractVersion, '1.0.0', 'Certification contractVersion');

  // ---- summary identity --------------------------------------------------------------
  requireEqual(summary.classification, 'PUBLIC_SAFE_SUMMARY_ONLY', 'Decomposition summary classification');
  requireEqual(summary.moduleId, moduleId, 'Decomposition summary moduleId');
  requireEqual(summary.moduleVersion, moduleVersion, 'Decomposition summary moduleVersion');
  requireEqual(summary.contractVersion, '1.0.0', 'Decomposition summary contractVersion');

  // ---- certified content hash --------------------------------------------------------
  const bundle = certification.protectedBundle;
  if (!bundle || typeof bundle !== 'object') fail('Certification record has no protectedBundle evidence. Failed closed.');
  const certifiedHash = String(bundle.protectedStoreContentHash || '');
  if (!/^[0-9a-f]{64}$/.test(certifiedHash)) fail('Certification record has no valid protectedStoreContentHash. Failed closed.');
  if (pinnedContentHash) requireEqual(certifiedHash, pinnedContentHash, 'Certified decomposition hash vs operator-pinned hash');

  // ---- semantic lineage --------------------------------------------------------------
  const lineage = certification.sourceLineage;
  if (!lineage || typeof lineage !== 'object') fail('Certification record has no sourceLineage evidence. Failed closed.');
  requireEqual(lineage.effectiveModuleVersion, moduleVersion, 'Certified effective module version');
  for (const field of ['semanticBaseVersion', 'baseModuleSha256', 'baseOperationalKnowledgeSha256']) {
    if (!lineage[field]) fail(`Certification sourceLineage.${field} is missing; semantic lineage cannot be preserved. Failed closed.`);
  }

  // ---- invariants that must hold for compilation to be legitimate --------------------
  const invariants = certification.invariants || {};
  for (const [field, expected] of [['orphanParentCount', 0], ['cycleCount', 0], ['leafNeedsDecompositionCount', 0]]) {
    if (requireNumber(invariants[field], `Certification invariants.${field}`) !== expected) {
      fail(`Certification invariants.${field} is ${invariants[field]}, expected ${expected}. Failed closed.`);
    }
  }
  if (invariants.exactVersionRuntimeFallbackPermitted !== false) {
    fail('Certification permits runtime version fallback; compilation of exact-version WorkDefinitions is prohibited. Failed closed.');
  }

  // ---- expected counts, and mutual agreement between the two governed artifacts -------
  const expected = {
    taskCount: requireNumber(bundle.taskCount, 'Certification protectedBundle.taskCount'),
    workUnitCount: requireNumber(bundle.workUnitCount, 'Certification protectedBundle.workUnitCount'),
    leafCount: requireNumber(bundle.leafCount, 'Certification protectedBundle.leafCount'),
    executorReadyLeafCount: requireNumber(bundle.executorReadyLeafCount, 'Certification protectedBundle.executorReadyLeafCount'),
    blockedByClientBindingLeafCount: requireNumber(bundle.blockedByClientBindingLeafCount, 'Certification protectedBundle.blockedByClientBindingLeafCount'),
    blockedByKnowledgeGapLeafCount: requireNumber(bundle.blockedByKnowledgeGapLeafCount, 'Certification protectedBundle.blockedByKnowledgeGapLeafCount')
  };

  const totals = summary.totals || {};
  for (const key of Object.keys(expected)) {
    if (requireNumber(totals[key], `Decomposition summary totals.${key}`) !== expected[key]) {
      fail(`Governed evidence disagrees on ${key}: certification ${expected[key]}, summary ${totals[key]}. Failed closed.`);
    }
  }

  if (expected.executorReadyLeafCount + expected.blockedByClientBindingLeafCount + expected.blockedByKnowledgeGapLeafCount !== expected.leafCount) {
    fail('Certified leaf classification does not account for every terminal leaf. Failed closed.');
  }

  const tasks = Array.isArray(summary.tasks) ? summary.tasks : fail('Decomposition summary has no per-task evidence. Failed closed.');
  if (tasks.length !== expected.taskCount) fail(`Decomposition summary lists ${tasks.length} tasks, certified ${expected.taskCount}. Failed closed.`);
  for (const task of tasks) {
    if (!task || typeof task.taskId !== 'string') fail('Decomposition summary contains a task without a taskId. Failed closed.');
    requireNumber(task.leafCount, `Decomposition summary ${task.taskId}.leafCount`);
    requireNumber(task.executorReadyLeafCount, `Decomposition summary ${task.taskId}.executorReadyLeafCount`);
  }
  const summed = tasks.reduce((n, t) => n + t.executorReadyLeafCount, 0);
  if (summed !== expected.executorReadyLeafCount) {
    fail(`Per-task executor-ready counts sum to ${summed}, certified ${expected.executorReadyLeafCount}. Failed closed.`);
  }

  return Object.freeze({
    attested: false,
    preflight: true,
    moduleId,
    moduleVersion,
    certifiedContentHash: certifiedHash,
    certifiedImplementationCommit: certification.certifiedImplementationCommit || null,
    semanticBaseVersion: lineage.semanticBaseVersion,
    effectiveModuleVersion: lineage.effectiveModuleVersion,
    expected,
    tasks: tasks.map(t => ({ taskId: t.taskId, leafCount: t.leafCount, executorReadyLeafCount: t.executorReadyLeafCount }))
  });
}

/**
 * Full gate: pre-flight certification, then bind it to the actual protected store hash.
 * This is the only function that produces an attested result.
 */
export function assertCertifiedInput({ governedInputContentHash, ...options }) {
  if (!/^[0-9a-f]{64}$/.test(String(governedInputContentHash || ''))) {
    fail('Governed input content hash is missing or not a 64-hex digest. Failed closed.');
  }
  const expectations = preflightCertification(options);
  requireEqual(governedInputContentHash, expectations.certifiedContentHash, 'Protected store content hash vs certified decomposition hash');
  return Object.freeze({ ...expectations, attested: true, preflight: false });
}

/**
 * Reconcile actual compiler output against the attestation.
 * Must be called with the attestation produced by assertCertifiedInput.
 */
export function reconcileCompilation(attestation, compilation) {
  if (!attestation || attestation.attested !== true) {
    fail('Compilation reconciliation requires a valid upstream certification attestation. Failed closed.');
  }
  const totals = compilation?.totals || fail('Compilation produced no totals to reconcile. Failed closed.');
  requireEqual(compilation.moduleId, attestation.moduleId, 'Compiled moduleId');
  requireEqual(compilation.moduleVersion, attestation.moduleVersion, 'Compiled moduleVersion');
  requireEqual(compilation.governedInputContentHash, attestation.certifiedContentHash, 'Compiled governed input hash');

  const e = attestation.expected;
  const mismatches = [];
  const check = (label, expectedValue, actualValue) => {
    if (Number(expectedValue) !== Number(actualValue)) mismatches.push(`${label}: certified ${expectedValue}, compiled ${actualValue}`);
  };
  check('taskCount', e.taskCount, totals.taskCount);
  check('workUnitCount', e.workUnitCount, totals.workUnitCount);
  check('leafCount', e.leafCount, totals.leafCount);
  check('workDefinitionCount (vs certified EXECUTOR_READY)', e.executorReadyLeafCount, totals.workDefinitionCount);
  check('blockedByClientBindingLeafCount', e.blockedByClientBindingLeafCount, totals.blockedByClientBindingLeafCount);
  check('blockedByKnowledgeGapLeafCount', e.blockedByKnowledgeGapLeafCount, totals.blockedByKnowledgeGapLeafCount);

  const coverage = Array.isArray(compilation.coverage) ? compilation.coverage : [];
  for (const task of attestation.tasks) {
    const actual = coverage.find(c => String(c.sourceTaskId) === String(task.taskId));
    if (!actual) { mismatches.push(`${task.taskId}: certified in P6.1 but absent from compilation`); continue; }
    check(`${task.taskId} leafCount`, task.leafCount, actual.leafCount);
    check(`${task.taskId} workDefinitionCount`, task.executorReadyLeafCount, actual.compiledCount);
  }
  const extra = coverage.filter(c => !attestation.tasks.some(t => String(t.taskId) === String(c.sourceTaskId)));
  for (const c of extra) mismatches.push(`${c.sourceTaskId}: compiled but not present in certified P6.1 evidence`);

  if (mismatches.length) {
    fail(`Compilation does not reconcile with the certified P6.1 decomposition:\n  - ${mismatches.join('\n  - ')}\nFailed closed.`);
  }

  return Object.freeze({ ...attestation, reconciled: true, workDefinitionCount: totals.workDefinitionCount });
}
