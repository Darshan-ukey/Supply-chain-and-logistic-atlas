import fs from 'node:fs';
import zlib from 'node:zlib';
import { compileBundle, canonicalHash, COMPILER_VERSION, WORKDEFINITION_CONTRACT_VERSION, DEFINITION_VERSION } from '../lib/compile/workdefinition-compiler.js';
import { verifyCompilation } from '../lib/compile/workdefinition-verifier.js';

// P6.2 — compile Canonical WorkDefinitions from the certified protected P6.1 Work Decomposition.
//
//   node scripts/compile-p6-2-work-definitions.mjs <moduleId> <moduleVersion> [--persist] [--out <path>]
//
// Reads the governed decomposition from the protected Supabase store, compiles deterministically,
// verifies, and optionally persists the protected WorkDefinition aggregate.
// No protected payload is ever written into the web/GitHub bundle.

const args = process.argv.slice(2);
const moduleId = args[0];
const moduleVersion = args[1];
const persist = args.includes('--persist');
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;

const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!moduleId || !moduleVersion) throw new Error('Usage: compile-p6-2-work-definitions.mjs <moduleId> <moduleVersion> [--persist] [--out <path>]');
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

async function rest(path, init = {}) {
  const r = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers || {}) }
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

function decode(row) {
  const encoding = String(row.payload_encoding || '').toUpperCase();
  if (encoding === 'BROTLI_BASE64') return JSON.parse(zlib.brotliDecompressSync(Buffer.from(row.payload_compressed_base64, 'base64')).toString('utf8'));
  if (encoding === 'GZIP_BASE64') return JSON.parse(zlib.gunzipSync(Buffer.from(row.payload_compressed_base64, 'base64')).toString('utf8'));
  if (row.payload) return row.payload;
  throw new Error('Protected decomposition payload is missing or uses an unsupported encoding');
}

// ---- 1. load certified governed input ------------------------------------------------
const select = 'decomposition_id,module_id,module_version,source_task_id,contract_version,semantic_source_version,status,payload,payload_encoding,payload_compressed_base64,content_hash';
const rows = await rest(`/rest/v1/atlas_work_decompositions?module_id=eq.${encodeURIComponent(moduleId)}&module_version=eq.${encodeURIComponent(moduleVersion)}&contract_version=eq.1.0.0&status=in.(VALIDATED_REFERENCE_DECOMPOSITION,APPROVED,ACTIVE)&select=${select}`);
if (!rows?.length) throw new Error(`No certified Work Decomposition for exact tuple ${moduleId}@${moduleVersion}. No alternate version was substituted.`);
if (rows.length > 1) throw new Error(`Ambiguous Work Decomposition storage for ${moduleId}@${moduleVersion}; failed closed.`);

const row = rows[0];
const governedInputContentHash = String(row.content_hash);
if (!/^[0-9a-f]{64}$/.test(governedInputContentHash)) throw new Error('Governed input content hash is not a 64-hex digest; failed closed.');

const expectedHash = process.env.ATLAS_EXPECTED_DECOMPOSITION_HASH;
if (expectedHash && expectedHash !== governedInputContentHash) {
  throw new Error(`Governed input hash ${governedInputContentHash} does not match the pinned certified hash ${expectedHash}; failed closed.`);
}

const bundle = decode(row);
if (String(bundle.moduleId) !== moduleId || String(bundle.moduleVersion) !== moduleVersion) {
  throw new Error('Governed bundle lineage does not match the requested tuple; failed closed.');
}

// ---- 2. compile + verify -------------------------------------------------------------
const compilation = compileBundle(bundle, { governedInputContentHash });
const verification = verifyCompilation(compilation);
if (!verification.ok) {
  console.error('P6.2 verification FAILED:');
  for (const v of verification.violations) console.error(`  - ${v}`);
  process.exit(1);
}

const t = compilation.totals;
console.log(`P6.2 compiled ${moduleId}@${moduleVersion}`);
console.log(`  governed input hash        : ${governedInputContentHash}`);
console.log(`  tasks                      : ${t.taskCount}`);
console.log(`  work units                 : ${t.workUnitCount}`);
console.log(`  terminal leaves            : ${t.leafCount}`);
console.log(`  WorkDefinitions compiled   : ${t.workDefinitionCount}`);
console.log(`  leaves not compiled        : ${t.notCompiledLeafCount}`);
console.log(`    blocked by client binding: ${t.blockedByClientBindingLeafCount}`);
console.log(`    blocked by knowledge gap : ${t.blockedByKnowledgeGapLeafCount}`);
console.log(`  fully compiled tasks       : ${t.fullyCompiledTaskCount}`);
console.log(`  compilation hash           : ${canonicalHash(compilation)}`);

// ---- 3. emit PUBLIC_SAFE summary (counts/status only) --------------------------------
const publicSummary = {
  schemaVersion: 'atlas-p6-2-public-workdefinition-summary-v1',
  phase: 'P6.2',
  classification: 'PUBLIC_SAFE_SUMMARY_ONLY',
  moduleId,
  moduleVersion,
  contractVersion: WORKDEFINITION_CONTRACT_VERSION,
  status: t.notCompiledLeafCount === 0 ? 'COMPILED' : 'COMPILED_PROTECTED_WITH_EXPLICIT_BLOCKERS',
  totals: {
    taskCount: t.taskCount,
    workDefinitionCount: t.workDefinitionCount,
    compiledLeafCount: t.workDefinitionCount,
    notCompiledLeafCount: t.notCompiledLeafCount,
    blockedByClientBindingLeafCount: t.blockedByClientBindingLeafCount,
    blockedByKnowledgeGapLeafCount: t.blockedByKnowledgeGapLeafCount
  },
  detailIncluded: false,
  independentExecutorProofStatus: 'NOT_INDEPENDENTLY_PROVEN',
  tasks: compilation.coverage.map(c => ({
    taskId: c.sourceTaskId,
    workDefinitionCount: c.compiledCount,
    compiledLeafCount: c.compiledCount,
    notCompiledLeafCount: c.notCompiledCount,
    blockedByClientBindingLeafCount: c.blockedByClientBindingCount,
    blockedByKnowledgeGapLeafCount: c.blockedByKnowledgeGapCount,
    coverageStatus: c.coverageStatus,
    executorProof: 'NOT_INDEPENDENTLY_PROVEN'
  })),
  securityNote: 'No WorkDefinition identity, title, action, gate, evidence, source reference, blocker identifier or payload is included.'
};

if (outPath) {
  fs.writeFileSync(outPath, `${JSON.stringify(publicSummary, null, 2)}\n`);
  console.log(`  PUBLIC_SAFE summary written: ${outPath}`);
}

// ---- 4. persist protected aggregate --------------------------------------------------
if (!persist) {
  console.log('Dry run complete. Re-run with --persist to write the protected store.');
  process.exit(0);
}

const tasks = compilation.coverage.map(c => ({
  moduleId,
  moduleVersion,
  sourceTaskId: c.sourceTaskId,
  semanticSourceVersion: c.semanticSourceVersion,
  inheritance: c.inheritance,
  coverage: c,
  definitions: compilation.definitions.filter(d => d.lineage.sourceTaskId === c.sourceTaskId)
}));

const aggregate = {
  schemaVersion: 'atlas-canonical-workdefinition-package-v1',
  moduleId,
  moduleVersion,
  contractVersion: WORKDEFINITION_CONTRACT_VERSION,
  definitionVersion: DEFINITION_VERSION,
  compilerVersion: COMPILER_VERSION,
  governedInputContentHash,
  totals: t,
  tasks
};

const record = {
  work_definition_id: `${moduleId}-${moduleVersion}::P6.2::package`,
  module_id: moduleId,
  module_version: moduleVersion,
  source_task_id: `__ALL_${tasks.length}__`,
  contract_version: WORKDEFINITION_CONTRACT_VERSION,
  definition_version: DEFINITION_VERSION,
  semantic_source_version: String(row.semantic_source_version),
  status: 'VALIDATED_REFERENCE_DEFINITION',
  payload: null,
  payload_encoding: 'BROTLI_BASE64',
  payload_compressed_base64: zlib.brotliCompressSync(Buffer.from(JSON.stringify(aggregate), 'utf8')).toString('base64'),
  content_hash: canonicalHash(aggregate),
  governed_input_content_hash: governedInputContentHash,
  compiler_version: COMPILER_VERSION,
  updated_at: new Date().toISOString()
};

await rest('/rest/v1/atlas_work_definitions?on_conflict=work_definition_id', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([record])
});

console.log(`Persisted protected WorkDefinition package (${tasks.length} tasks, ${t.workDefinitionCount} definitions).`);
console.log(`  protected store content hash: ${record.content_hash}`);
console.log('No WorkDefinition detail was written into the web bundle.');
