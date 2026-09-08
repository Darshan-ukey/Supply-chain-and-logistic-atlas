import fs from 'node:fs';
import zlib from 'node:zlib';
import { compileBundle, canonicalHash, COMPILER_VERSION, WORKDEFINITION_CONTRACT_VERSION, DEFINITION_VERSION } from '../lib/compile/workdefinition-compiler.js';
import { verifyCompilation } from '../lib/compile/workdefinition-verifier.js';
import { preflightCertification, assertCertifiedInput, reconcileCompilation } from '../lib/compile/p6-1-certification-gate.js';

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

// Decode the protected payload. The declared payload_encoding is tried first. If it fails,
// known-safe variants are attempted so an encoding-label defect is diagnosable rather than
// opaque. Any divergence between declared and actual encoding is reported as a governance
// finding and blocks persistence: the store's own metadata must be trustworthy before we
// write derived truth alongside it.
const encodingFinding = { declared: null, actual: null, mismatch: false };

function decode(row) {
  const declared = String(row.payload_encoding || '').toUpperCase();
  encodingFinding.declared = declared;
  const b64 = row.payload_compressed_base64;

  if (declared === 'JSONB' || (!b64 && row.payload)) {
    encodingFinding.actual = 'JSONB';
    return row.payload;
  }
  if (!b64) throw new Error('Protected decomposition payload is missing');
  const buffer = Buffer.from(b64, 'base64');

  const C = zlib.constants;
  const strategies = [
    ['BROTLI_BASE64', b => zlib.brotliDecompressSync(b)],
    ['BROTLI_BASE64_LARGE_WINDOW', b => zlib.brotliDecompressSync(b, { params: { [C.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 1 } })],
    ['GZIP_BASE64', b => zlib.gunzipSync(b)],
    ['DEFLATE_BASE64', b => zlib.inflateSync(b)],
    ['DEFLATE_RAW_BASE64', b => zlib.inflateRawSync(b)],
    ['ZSTD_BASE64', b => { if (typeof zlib.zstdDecompressSync !== 'function') throw new Error('zstd unavailable'); return zlib.zstdDecompressSync(b); }],
    ['PLAIN_BASE64_JSON', b => b]
  ];
  // Try the declared encoding first, then the rest.
  strategies.sort((a, x) => (a[0] === declared ? -1 : x[0] === declared ? 1 : 0));

  const attempts = [];
  for (const [name, fn] of strategies) {
    try {
      const parsed = JSON.parse(fn(buffer).toString('utf8'));
      encodingFinding.actual = name;
      encodingFinding.mismatch = name !== declared;
      if (encodingFinding.mismatch) {
        console.error('');
        console.error('  GOVERNANCE FINDING — protected store encoding label is incorrect');
        console.error(`    declared payload_encoding : ${declared}`);
        console.error(`    actual encoding           : ${name}`);
        console.error('    Impact: any consumer trusting the declared label fails to decode this row.');
        console.error('    Persistence is blocked until this is resolved by governance.');
        console.error('');
      }
      return parsed;
    } catch (e) {
      attempts.push(`${name}: ${String(e.message).slice(0, 80)}`);
    }
  }
  const head = buffer.subarray(0, 16).toString('hex');
  const tail = buffer.subarray(-16).toString('hex');
  console.error(`DECODE_FAIL bytes=${buffer.length} head=${head} tail=${tail}`);
  console.error(`DECODE_ATTEMPTS ${attempts.map(a => a.replace(/\s+/g, ' ')).join(' || ')}`);
  throw new Error('Protected decomposition payload could not be decoded by any known encoding; failed closed.');
}

// ---- 0. MANDATORY certification pre-flight (before any network access) ---------------
// Fails fast if governed certification evidence is missing, mismatched or inconsistent.
const certificationPath = process.env.ATLAS_P6_1_CERTIFICATION_PATH || 'governance/baselines/P6_1_RECURSIVE_WORK_DECOMPOSITION_CERTIFICATION.json';
const summaryPath = process.env.ATLAS_P6_1_SUMMARY_PATH || 'governance/presentation/P6_1_PUBLIC_DECOMPOSITION_SUMMARY.json';
const pinnedContentHash = process.env.ATLAS_EXPECTED_DECOMPOSITION_HASH || null;
const expectations = preflightCertification({ moduleId, moduleVersion, certificationPath, summaryPath, pinnedContentHash });
console.log(`P6.2 certification pre-flight PASS for ${moduleId}@${moduleVersion}`);
console.log(`  certified decomposition    : ${expectations.certifiedContentHash}`);
console.log(`  expected WorkDefinitions   : ${expectations.expected.executorReadyLeafCount}`);

// ---- 1. load certified governed input ------------------------------------------------
const select = 'decomposition_id,module_id,module_version,source_task_id,contract_version,semantic_source_version,status,payload,payload_encoding,payload_compressed_base64,content_hash';
const rows = await rest(`/rest/v1/atlas_work_decompositions?module_id=eq.${encodeURIComponent(moduleId)}&module_version=eq.${encodeURIComponent(moduleVersion)}&contract_version=eq.1.0.0&status=in.(VALIDATED_REFERENCE_DECOMPOSITION,APPROVED,ACTIVE)&select=${select}`);
if (!rows?.length) throw new Error(`No certified Work Decomposition for exact tuple ${moduleId}@${moduleVersion}. No alternate version was substituted.`);
if (rows.length > 1) throw new Error(`Ambiguous Work Decomposition storage for ${moduleId}@${moduleVersion}; failed closed.`);

const row = rows[0];
const governedInputContentHash = String(row.content_hash);
if (!/^[0-9a-f]{64}$/.test(governedInputContentHash)) throw new Error('Governed input content hash is not a 64-hex digest; failed closed.');

const bundle = decode(row);

// Structural diagnostics: key names only, never values. Key names are schema-level and
// carry no business content, so this is safe to print while remaining useful when the
// governed bundle shape differs from what the contract schema implies.
function shape(value, depth = 0) {
  if (Array.isArray(value)) return `array[${value.length}]` + (value.length && depth < 2 ? ` of ${shape(value[0], depth + 1)}` : '');
  if (value && typeof value === 'object') return `{${Object.keys(value).join(',')}}`;
  return typeof value;
}
if (process.env.ATLAS_COMPILE_DIAGNOSTICS === '1') {
  console.log(`  bundle shape               : ${shape(bundle)}`);
}
if (String(bundle.moduleId) !== moduleId || String(bundle.moduleVersion) !== moduleVersion) {
  console.error(`Governed bundle lineage mismatch. Observed top-level shape: ${shape(bundle)}`);
  throw new Error('Governed bundle lineage does not match the requested tuple; failed closed.');
}

// ---- 2. MANDATORY upstream certification gate (no skip path) -------------------------
// Runs before compilation. A missing, mismatched or inconsistent certification artifact
// is a hard failure. This gate is enforced by the runtime, not only by tests.
const attestation = assertCertifiedInput({ moduleId, moduleVersion, governedInputContentHash, certificationPath, summaryPath, pinnedContentHash });
console.log(`  certified upstream         : ${attestation.moduleId}@${attestation.effectiveModuleVersion} (base ${attestation.semanticBaseVersion})`);
console.log(`  certified commit           : ${attestation.certifiedImplementationCommit}`);

// ---- 3. compile + verify -------------------------------------------------------------
let compilation;
try {
  compilation = compileBundle(bundle, { governedInputContentHash });
} catch (e) {
  const raw = bundle?.decompositions;
  const items = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : null);
  console.error('Compilation failed against the governed bundle.');
  console.error(`  bundle top-level     : ${shape(bundle)}`);
  console.error(`  decompositions       : ${shape(raw)}`);
  if (items && items[0]) {
    console.error(`  first decomposition  : ${shape(items[0])}`);
    const units = items[0].workUnits;
    console.error(`  workUnits            : ${shape(units)}`);
    if (Array.isArray(units) && units[0]) console.error(`  first workUnit       : ${shape(units[0])}`);
    if (Array.isArray(units) && units[0]?.executorReadiness) console.error(`  executorReadiness    : ${shape(units[0].executorReadiness)}`);
  }
  throw e;
}
const verification = verifyCompilation(compilation);
if (!verification.ok) {
  console.error('P6.2 verification FAILED:');
  for (const v of verification.violations) console.error(`  - ${v}`);
  process.exit(1);
}

// ---- 4. MANDATORY reconciliation against certified counts ----------------------------
const attested = reconcileCompilation(attestation, compilation);
console.log('  cross-check vs certified P6.1: PASS');

const t = compilation.totals;
// ---- 5. emit PUBLIC_SAFE summary (counts/status only) --------------------------------
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

// ---- 6. persist protected aggregate --------------------------------------------------
if (!persist) {
  console.log('Dry run complete. No write was made to atlas_work_definitions.');
  console.log('Re-run with --persist to write the protected store.');
  process.exit(0);
}

if (encodingFinding.mismatch) {
  console.error(`Refusing to persist: protected store declares ${encodingFinding.declared} but is actually ${encodingFinding.actual}.`);
  console.error('Resolve the store encoding label through governance before writing derived truth. Failed closed.');
  process.exit(1);
}

// --persist cannot bypass certification: the write path requires the reconciled attestation.
if (attested?.attested !== true || attested?.reconciled !== true) {
  console.error('Refusing to persist: upstream certification was not attested and reconciled. Failed closed.');
  process.exit(1);
}
if (attested.certifiedContentHash !== governedInputContentHash || attested.workDefinitionCount !== t.workDefinitionCount) {
  console.error('Refusing to persist: attestation does not match the compiled artifact. Failed closed.');
  process.exit(1);
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
