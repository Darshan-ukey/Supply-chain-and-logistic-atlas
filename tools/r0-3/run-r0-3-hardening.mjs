import fs from 'node:fs';
import path from 'node:path';
import {
  TOOL_VERSION, canonicalHash, fileSha, readJson,
  composeEffectiveOperationalKnowledge, assessCoverage,
  buildObjectRegister, buildInformationResolutionCoverage, buildKnowledgeGapQueue,
} from './ok-hardening.mjs';

// Deterministic by construction: outputs contain no wall-clock value. Re-running this
// tool on the same governed inputs must produce byte-identical artifacts.
const STAGE_DATE = '2026-09-10';

const INPUTS = {
  module: 'data/modules/road-ltl-v1.4.json',
  okBase: 'data/operational-knowledge/road-ltl-v1.4-operational.json',
  okOverlay: 'data/operational-knowledge/road-ltl-v1.5-operational.json',
  okContract: 'schemas/operational-knowledge-contract-v2.json',
  irContract: 'schemas/information-resolution-contract-v1.json',
  bolBaseline: 'data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json',
  effective15: 'data/road-ltl/effective-road-ltl-1.5-materialization.json',
};

const OUT = {
  effectiveOk: 'data/operational-knowledge/derived/effective-road-ltl-1.5-operational-knowledge.json',
  matrix: 'governance/recovery/R0.3/OK_COVERAGE_MATRIX.json',
  register: 'governance/recovery/R0.3/CANONICAL_OBJECT_DOCUMENT_REGISTER.json',
  ir: 'governance/recovery/R0.3/INFORMATION_RESOLUTION_COVERAGE.json',
  gaps: 'governance/recovery/R0.3/KNOWLEDGE_GAP_QUEUE.json',
};

const write = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  return fileSha(p);
};

export function run() {
  const inputHashes = Object.fromEntries(
    Object.entries(INPUTS).sort(([a], [b]) => a < b ? -1 : 1).map(([k, p]) => [p, fileSha(p)]),
  );

  const composition = composeEffectiveOperationalKnowledge({
    modulePath: INPUTS.module, okBasePath: INPUTS.okBase, okOverlayPath: INPUTS.okOverlay,
  });

  // Cross-check the composition against the R0.2-certified effective materialization.
  const eff = readJson(INPUTS.effective15);
  const effTasks = (eff.tasks ?? []).map(t => t.taskId ?? t.id).filter(Boolean).sort();
  const composedIds = composition.composed.map(c => c.taskId).sort();
  const lineageAgreesWithR02 =
    effTasks.length === composedIds.length && effTasks.every((id, i) => id === composedIds[i]);

  const provenance = {
    toolVersion: TOOL_VERSION,
    stageId: 'R0.3',
    governanceBranch: 'atlas-governance-registry-v2.1',
    inputs: inputHashes,
    derivationRule: 'Every value in this artifact is read from, or counted over, the governed inputs listed above. No operational knowledge is authored, inferred or completed by this tool.',
  };

  // 1. Effective operational knowledge (derived view; source assets untouched).
  const effectiveOk = {
    schemaVersion: 'atlas-effective-operational-knowledge-view-v1',
    moduleId: composition.moduleRoot.module.id,
    moduleVersion: '1.5',
    status: 'DERIVED_VIEW_NOT_A_SOURCE_OF_TRUTH',
    provenance,
    inheritance: {
      policy: 'LOSSLESS_INHERIT_BASE_AND_OVERRIDE_ONLY_DECLARED_TASKS',
      taskCount: composition.composed.length,
      inheritedFrom14: composition.inheritedCount,
      directGoverned15Overrides: composition.overriddenCount,
      directOverrideTaskIds: composition.overriddenTaskIds,
      orphanOkTaskIds: composition.orphanOkTaskIds,
      agreesWithR02CertifiedEffectiveMaterialization: lineageAgreesWithR02,
    },
    tasks: composition.composed.map(c => ({
      taskId: c.taskId,
      okSourceVersion: c.okSourceVersion,
      lineage: c.lineage,
      moduleLayerPath: INPUTS.module,
      operationalKnowledgePath: c.okOverride ? INPUTS.okOverlay : INPUTS.okBase,
    })),
  };

  // R0.3 evaluates whether Road LTL execution knowledge is complete when the governed
  // MODULE semantics and the Operational Knowledge payload are COMPOSED. It is not a test
  // of whether the Operational Knowledge JSON is self-contained. Both surfaces are
  // measured and both are reported; the composed surface is the governed one.
  const okContract = readJson(INPUTS.okContract);
  const coverage = assessCoverage({ contract: okContract, composition, surface: 'COMPOSED' });
  const coverageOkOnly = assessCoverage({ contract: okContract, composition, surface: 'OK_ONLY' });
  const objectRegister = buildObjectRegister(composition);
  const irCoverage = buildInformationResolutionCoverage({
    irContract: readJson(INPUTS.irContract),
    bolBaseline: readJson(INPUTS.bolBaseline),
  });
  const gaps = buildKnowledgeGapQueue({ coverage, objectRegister, irCoverage, createdAt: STAGE_DATE });

  const totalsOf = c => ({
    satisfiedDirect: c.tasks.reduce((n, t) => n + t.satisfiedDirect, 0),
    satisfiedByDeclaredEquivalent: c.tasks.reduce((n, t) => n + t.satisfiedByDeclaredEquivalent, 0),
    presentNestedOnly: c.tasks.reduce((n, t) => n + t.presentNestedOnly, 0),
    absent: c.tasks.reduce((n, t) => n + t.absent, 0),
  });

  const matrix = {
    schemaVersion: 'atlas-ok-coverage-matrix-v2',
    stageId: 'R0.3',
    contract: 'atlas-operational-knowledge-contract-v2',
    status: 'CANDIDATE_AWAITING_INDEPENDENT_QA',
    provenance,
    scope: {
      taskCount: coverage.tasks.length,
      contractAttributeCount: coverage.attributeCount,
      assessedCells: coverage.tasks.length * coverage.attributeCount,
    },
    evaluationBasis: 'R0.3 measures the EFFECTIVE COMPOSED governed semantic surface: data/modules/road-ltl-v1.4.json (module layer) together with the Operational Knowledge payload and its governed 1.5 overlay. The OK-only surface is reported alongside it as a structural observation about one asset, not as the stage verdict.',
    statusSemantics: {
      SATISFIED_DIRECT: 'Populated under the contract attribute name inside the surface.',
      SATISFIED_BY_DECLARED_EQUIVALENT: 'Populated under a different governed name whose equivalence is declared in EQUIVALENCE_MAP with a named basis. Independently rejectable by QA, entry by entry.',
      PRESENT_NESTED_ONLY_NOT_TASK_LEVEL: 'Populated only inside a child structure, so not addressable as a task-level contract attribute. NOT counted as compliant.',
      ABSENT: 'No governed asset in the surface carries it. NOT counted as compliant.',
    },
    complianceRule: 'Only SATISFIED_DIRECT and SATISFIED_BY_DECLARED_EQUIVALENT count as satisfied. PRESENT_NESTED_ONLY_NOT_TASK_LEVEL and ABSENT remain open gaps and were not converted into compliant attributes.',
    composedSurface: {
      surface: 'COMPOSED',
      layers: ['data/modules/road-ltl-v1.4.json', 'data/operational-knowledge/road-ltl-v1.4-operational.json', 'data/operational-knowledge/road-ltl-v1.5-operational.json'],
      totals: totalsOf(coverage),
      byAttribute: coverage.byAttribute,
      byTask: coverage.tasks,
    },
    okOnlySurface: {
      surface: 'OK_ONLY',
      layers: ['data/operational-knowledge/road-ltl-v1.4-operational.json', 'data/operational-knowledge/road-ltl-v1.5-operational.json'],
      totals: totalsOf(coverageOkOnly),
      byAttribute: coverageOkOnly.byAttribute,
      byTask: coverageOkOnly.tasks,
    },
  };
  matrix.surfaceDelta = {
    note: 'Attributes satisfied only once the governed module layer is composed in. These are carried by the module asset, not missing from Atlas.',
    satisfiedOnlyWhenComposed: coverage.byAttribute
      .map(a => {
        const o = coverageOkOnly.byAttribute.find(x => x.attribute === a.attribute);
        const composedSat = a.satisfiedDirect + a.satisfiedByDeclaredEquivalent;
        const okSat = o.satisfiedDirect + o.satisfiedByDeclaredEquivalent;
        return composedSat > okSat
          ? { attribute: a.attribute, group: a.group, okOnlySatisfied: okSat, composedSatisfied: composedSat }
          : null;
      })
      .filter(Boolean),
  };
  matrix.semanticHash = canonicalHash({
    composed: { byAttribute: coverage.byAttribute, byTask: coverage.tasks },
    okOnly: { byAttribute: coverageOkOnly.byAttribute, byTask: coverageOkOnly.tasks },
  });

  const register = {
    schemaVersion: 'atlas-canonical-object-document-register-v1',
    stageId: 'R0.3',
    status: 'CANDIDATE_AWAITING_INDEPENDENT_QA',
    classificationRule: 'Identifiers here are collected from governed bytes. No object, document, meaning, relationship or cardinality is invented by this stage. Fields the governed assets do not state are emitted as null and classified as a gap.',
    provenance,
    ...objectRegister,
  };
  register.semanticHash = canonicalHash({ objects: register.objects, documents: register.documents });

  const ir = {
    schemaVersion: 'atlas-information-resolution-coverage-v1',
    stageId: 'R0.3',
    status: 'CANDIDATE_AWAITING_INDEPENDENT_QA',
    provenance,
    metricIntegrityNote: 'reportedAccuracyMetric and reportedExtractionMetric in the BOL baseline are runtime observations over a client extraction population. Under Operational Knowledge Contract v2 runtimeFeedback they may indicate gaps; they are not canonical truth and are not promoted here.',
    ...irCoverage,
  };
  ir.semanticHash = canonicalHash({ fields: ir.fields, unresolvedSemanticLabels: ir.unresolvedSemanticLabels });

  const written = {
    [OUT.effectiveOk]: write(OUT.effectiveOk, effectiveOk),
    [OUT.matrix]: write(OUT.matrix, matrix),
    [OUT.register]: write(OUT.register, register),
    [OUT.ir]: write(OUT.ir, ir),
    [OUT.gaps]: write(OUT.gaps, gaps),
  };

  return { composition, coverage, coverageOkOnly, objectRegister, irCoverage, gaps, matrix, register, ir, written, lineageAgreesWithR02 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = run();
  console.log(`tool: ${TOOL_VERSION}`);
  console.log(`tasks composed: ${r.composition.composed.length} (${r.composition.inheritedCount} inherited 1.4 + ${r.composition.overriddenCount} direct 1.5: ${r.composition.overriddenTaskIds.join(', ')})`);
  console.log(`lineage agrees with R0.2 certified effective materialization: ${r.lineageAgreesWithR02}`);
  console.log(`contract attributes: ${r.coverage.attributeCount} | cells per surface: ${r.matrix.scope.assessedCells}`);
  for (const [label, s2] of [['COMPOSED (governed surface)', r.matrix.composedSurface], ['OK_ONLY  (single asset)', r.matrix.okOnlySurface]]) {
    const t = s2.totals;
    console.log(`  ${label}: direct ${t.satisfiedDirect} | declared-equiv ${t.satisfiedByDeclaredEquivalent} | nested-only ${t.presentNestedOnly} | absent ${t.absent}`);
  }
  console.log(`  attributes satisfied only when composed: ${r.matrix.surfaceDelta.satisfiedOnlyWhenComposed.length}`);
  console.log(`objects referenced: ${r.objectRegister.objectCount} | with canonical object contract: ${r.objectRegister.objectsWithCanonicalContract}`);
  console.log(`documents declared: ${r.objectRegister.documentCount}`);
  console.log(`BOL fields: ${r.irCoverage.fieldCount} | conformant IR contracts: ${r.irCoverage.fieldsWithConformantContract}`);
  console.log(`knowledge gaps recorded: ${r.gaps.items.length}`);
  console.log('');
  for (const [p, h] of Object.entries(r.written)) console.log(`${h.slice(0, 16)}…  ${p}`);
}
