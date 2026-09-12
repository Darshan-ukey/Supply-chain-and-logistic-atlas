// D2.0.4 — Malkom 3.0 reference projection generator.
//
// Runs the GOVERNED, ALREADY-VERIFIED adapter (execution/adapters/malkom/malkom-adapter.mjs,
// imported byte-identical at f22b77d) over the PROVEN REFERENCE WorkDefinition bundle
// (canvas-v2/canvas-v2/data/road-ltl-workdefinitions-v2.3.json) and emits a deterministic,
// committed artifact so the demo shows real machine-readable adapter output rather than a
// live-computed claim.
//
// LINEAGE — this is the PROVEN REFERENCE lineage, not the governed target lineage:
//   Road LTL V1.2 -> Domain Warehouse v2.3 -> Malkom 3.0 projection
// The bundle self-declares sourceModel "Road LTL V1.2". This generator does NOT read, touch or
// reference Road LTL 1.5, Operational Knowledge, the P6.1 decomposition, or the P6.2 compiler,
// and makes no claim that any of those produced this output.
//
// Determinism: no wall-clock value, no randomness, stable key order. Re-running on unchanged
// inputs produces a byte-identical artifact.

import fs from 'node:fs';
import crypto from 'node:crypto';
import { MalkomAdapterV1 } from '../../execution/adapters/malkom/malkom-adapter.mjs';

const BUNDLE = 'canvas-v2/canvas-v2/data/road-ltl-workdefinitions-v2.3.json';
const ADAPTER = 'execution/adapters/malkom/malkom-adapter.mjs';
const MANIFEST = 'execution/contracts/malkom-adapter-manifest-v1.json';
const OUT = 'data/materialized/road-ltl-v2.3-malkom-reference-projection.json';

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// The v2.3 bundle carries the Malkom shape at the definition root. The adapter's projection()
// accessor looks for decomposition.malkom, so wrap without mutating any source content.
function toAdapterInput(def) {
  return {
    id: def.taskId,
    sourceTaskId: def.taskId,
    version: '2.3',
    decomposition: { malkom: def },
    clientOverridePoints: def.clientOverridePoints || [],
  };
}

export function buildMalkomReferenceProjection() {
  const bundle = readJson(BUNDLE);
  const manifest = readJson(MANIFEST);

  const tasks = {};
  const gaps = { escalateTasks: [], unsupportedNextSteps: {}, bindingFamilies: {} };
  let compatible = 0, materializable = 0, bindingsTotal = 0;

  for (const def of bundle.definitions) {
    const compiled = MalkomAdapterV1.compile(toAdapterInput(def));
    if (compiled.assessment.compatible) compatible++;
    if (compiled.materializable) materializable++;
    bindingsTotal += compiled.assessment.requiredBindings.length;

    for (const o of def.outcomes || []) {
      if (o.nextStep === 'ESCALATE' && !gaps.escalateTasks.includes(def.taskId)) {
        gaps.escalateTasks.push(def.taskId);
      }
      if (o.nextStep && !['END_WORK_ITEM', 'END_QUEUE', 'STAY_IN_QUEUE', 'STAY', 'ESCALATE'].includes(o.nextStep)) {
        gaps.unsupportedNextSteps[o.nextStep] = (gaps.unsupportedNextSteps[o.nextStep] || 0) + 1;
      }
    }
    for (const fam of def.clientOverridePoints || []) {
      gaps.bindingFamilies[fam] = (gaps.bindingFamilies[fam] || 0) + 1;
    }

    tasks[def.taskId] = {
      taskId: def.taskId,
      taskLabel: def.taskLabel,
      queue: def.queue,
      queuePurpose: def.queuePurpose,
      subQueueCount: (def.subQueues || []).length,
      workTypes: (def.workTypes || []).map(t => ({ name: t.name, executionMode: t.executionMode })),
      outcomeCount: (def.outcomes || []).length,
      nextSteps: [...new Set((def.outcomes || []).map(o => o.nextStep).filter(Boolean))].sort(),
      fieldCount: (def.fields || []).length,
      compatible: compiled.assessment.compatible,
      materializable: compiled.materializable,
      requiredBindingCount: compiled.assessment.requiredBindings.length,
      warnings: compiled.assessment.warnings || [],
      projectionId: compiled.projectionId,
    };
  }

  gaps.escalateTasks.sort();

  const artifact = {
    schemaVersion: 'atlas-malkom-reference-projection-v1',
    classification: 'DEMO_REFERENCE_PROJECTION_NOT_CANONICAL_TRUTH',
    lineage: {
      lineageName: 'PROVEN_EXECUTION_REFERENCE',
      chain: 'Road LTL V1.2 -> Domain Warehouse v2.3 -> Malkom 3.0 projection',
      sourceModel: bundle.sourceModel,
      bundleSource: bundle.source,
      bundleNote: bundle.note,
      notGeneratedFrom: [
        'Road LTL 1.5',
        'Operational Knowledge v2',
        'P6.1 recursive work decomposition',
        'P6.2 canonical WorkDefinition compiler',
      ],
      statement: 'This artifact is produced solely from the V1.2-derived Domain Warehouse v2.3 reference bundle. It is NOT evidence that the governed target lineage (Road LTL 1.5 / P6.1 / P6.2) generates Malkom output. Those two lineages are not connected.',
    },
    inputs: {
      [BUNDLE]: sha(BUNDLE),
      [ADAPTER]: sha(ADAPTER),
      [MANIFEST]: sha(MANIFEST),
    },
    adapter: {
      adapterId: manifest.adapterId,
      runtime: manifest.runtime,
      version: manifest.version,
      capabilities: manifest.capabilities,
      operationsEnabled: manifest.operations,
    },
    summary: {
      definitionsProcessed: bundle.definitions.length,
      adapterCompatible: compatible,
      materializable,
      requiredClientBindingsTotal: bindingsTotal,
    },
    knownLossesAndGaps: {
      note: 'Recorded per the D2.0.4 guardrail DOCUMENT_KNOWN_ADAPTER_LOSSES_GAPS. These are real limitations of the reference adapter, reported rather than suppressed.',
      escalateHandling: {
        disposition: 'PARTIAL',
        affectedTasks: gaps.escalateTasks,
        explanation: 'Canonical escalation remains visible in the projection, but live cross-queue materialization is runtime-specific and is not performed by this adapter.',
      },
      unsupportedNextSteps: gaps.unsupportedNextSteps,
      clientBindingRequired: {
        disposition: 'CLIENT_BINDING_REQUIRED',
        totalPoints: bindingsTotal,
        distinctFamilies: Object.keys(gaps.bindingFamilies).length,
        familyCounts: Object.fromEntries(Object.entries(gaps.bindingFamilies).sort()),
        explanation: 'Atlas owns the binding requirement; the client supplies the value. None of these are resolved by this artifact and none are invented.',
      },
      adapterOperationsNotEnabled: Object.entries(manifest.operations)
        .filter(([, v]) => v === false).map(([k]) => k).sort(),
    },
    tasks,
  };

  artifact.semanticHash = crypto.createHash('sha256')
    .update(JSON.stringify({ tasks: artifact.tasks, summary: artifact.summary, gaps: artifact.knownLossesAndGaps }))
    .digest('hex');

  return artifact;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifact = buildMalkomReferenceProjection();
  fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2) + '\n');
  const s = artifact.summary;
  console.log(`wrote ${OUT}`);
  console.log(`  definitions ${s.definitionsProcessed} | compatible ${s.adapterCompatible} | materializable ${s.materializable}`);
  console.log(`  client bindings required: ${s.requiredClientBindingsTotal} across ${artifact.knownLossesAndGaps.clientBindingRequired.distinctFamilies} families`);
  console.log(`  ESCALATE partial tasks: ${artifact.knownLossesAndGaps.escalateHandling.affectedTasks.join(', ')}`);
  console.log(`  semanticHash ${artifact.semanticHash}`);
}
