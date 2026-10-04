import fs from 'node:fs';
import { compileBundle, canonicalHash, traverse } from './workdefinition-compiler.js';
import { verifyCompilation } from './workdefinition-verifier.js';
import { validateFrozenSchema } from './frozen-schema-validator.js';

const read = path => JSON.parse(fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8'));
const decompositionSchema = read('schemas/canonical-work-decomposition-contract-v1.schema.json');
const definitionSchema = read('schemas/canonical-workdefinition-contract-v1.schema.json');
const localSchema = read('data/contracts/atlas-workdefinition-v1.schema.json');
const check = (condition,code) => { if (!condition) throw Error(code); };

// A caller must supply the independently pinned protected input digest.
// Donor fingerprints bind the protected decomposition envelope to the corrected
// semantics/binding chain; no client values are copied into canonical output.
export function compileCorrectedTask(envelope, expectedHash, semantics, binding) {
  check(envelope?.classification==='EXECUTION_PROTECTED','PROTECTED_INPUT_REQUIRED');
  const d=envelope.decomposition;
  check(/^[a-f0-9]{64}$/.test(expectedHash||''),'PINNED_DECOMPOSITION_HASH_REQUIRED');
  check(canonicalHash(d)===expectedHash,'DECOMPOSITION_HASH_MISMATCH');
  check(validateFrozenSchema(d,decompositionSchema).length===0,'DECOMPOSITION_SCHEMA_INVALID');
  check(d.daughterModule==='road-ltl' && d.daughterVersion==='1.5' && d.sourceTaskId==='LTL-04','EXACT_CORRECTED_TUPLE_REQUIRED');
  check(d.semanticLineage.effectiveModuleVersion==='1.5','EFFECTIVE_VERSION_MISMATCH');
  check(d.semanticLineage.semanticSourceVersion==='1.4' && d.semanticLineage.inheritance==='LOSSLESS_UNCHANGED_TASK','GOVERNED_LTL04_INHERITANCE_REQUIRED');
  const record=semantics.records?.find(r=>r.processId==='LTL-04');
  check(record?.moduleVersion==='1.5' && record.governingLineage?.overrideApplied===false,'CORRECTED_SEMANTIC_DONOR_REQUIRED');
  check(binding.semanticRecordId===record.semanticRecordId && binding.semanticModuleVersion==='1.5' && binding.canonicalTruthMutation===false,'CORRECTED_BINDING_DONOR_REQUIRED');
  check(envelope.correctedDonors?.semanticRecordHash===canonicalHash(record) && envelope.correctedDonors?.clientBindingHash===canonicalHash(binding),'CORRECTED_DONOR_FINGERPRINT_MISMATCH');
  const nodes=traverse(d),leaves=nodes.filter(n=>n.children.length===0);
  check(d.summary.workUnitCount===nodes.length && d.summary.leafCount===leaves.length,'DECOMPOSITION_SUMMARY_MISMATCH');
  for (const status of ['EXECUTOR_READY','BLOCKED_BY_CLIENT_BINDING','BLOCKED_BY_KNOWLEDGE_GAP']) {
    check((d.summary.leafStatusCounts[status]||0)===leaves.filter(n=>n.unit.executorReadiness.status===status).length,'DECOMPOSITION_STATUS_COUNTS_MISMATCH');
  }
  for (const {unit,children} of nodes) {
    const r=unit.executorReadiness;
    check(children.length===0 || r.status==='NEEDS_DECOMPOSITION','COMPOSITE_READINESS_INVALID');
    check(r.status!=='BLOCKED_BY_CLIENT_BINDING' || r.requiredClientBindings.length>0,'CLIENT_BLOCKER_REFERENCE_REQUIRED');
    check(r.status!=='BLOCKED_BY_KNOWLEDGE_GAP' || r.requiredKnowledgeGaps.length>0,'KNOWLEDGE_BLOCKER_REFERENCE_REQUIRED');
    check(r.status!=='EXECUTOR_READY' || r.requiredKnowledgeGaps.length===0,'READY_LEAF_HAS_KNOWLEDGE_GAP');
    check(unit.sourceRefs.length>0 && unit.sourceRefs.every(ref=>record.sourceIds.includes(ref)),'SOURCE_REFERENCE_MISMATCH');
  }
  const result=compileBundle({moduleId:d.daughterModule,moduleVersion:d.daughterVersion,decompositions:[d]},{governedInputContentHash:expectedHash});
  check(verifyCompilation(result).ok,'WORKDEFINITION_VERIFIER_FAILED');
  for (const definition of result.definitions) {
    check(validateFrozenSchema(definition,definitionSchema).length===0,'FROZEN_WORKDEFINITION_SCHEMA_INVALID');
    check(validateFrozenSchema(definition,localSchema).length===0,'LOCAL_WORKDEFINITION_SCHEMA_INVALID');
  }
  return result;
}
