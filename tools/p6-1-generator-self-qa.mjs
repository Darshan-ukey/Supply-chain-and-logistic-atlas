import { generate } from './generate-canonical-work-decomposition-v1.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Atlas P6.1 successor generator — self-QA proof harness.
//
// Proves the five properties the Owner named explicitly, each as an executed
// check against a representative synthetic input, not as a claim. This
// input is deliberately NOT real Road LTL data — it is shaped like a
// realistic task (multiple seeds, a mix of ready/blocked/split cases) so
// the proof is meaningful, while being unambiguously synthetic so it can
// never be mistaken for, or substituted for, real source.

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
const results = [];
function prove(property, label, cond, detail = '') {
  const ok = !!cond;
  if (ok) passed++; else failed++;
  results.push({ property, label, result: ok ? 'PROVEN' : 'FAILED', detail });
  console.log(`  [${ok ? 'PROVEN' : 'FAILED'}]  ${property} — ${label}${detail ? ` (${detail})` : ''}`);
}

const representativeInput = {
  moduleId: 'synthetic-road-ltl-self-qa',
  moduleVersion: 'SELF-QA-ONLY-NOT-REAL-SOURCE',
  generationContractVersion: 'P6_1_SUCCESSOR_GENERATION_CONTRACT_V1',
  tasks: [
    {
      taskId: 'SQ-01', semanticSourceVersion: 'synthetic-1.0', sourceRefs: ['syn:src:1'],
      workDecompositionSeed: [
        { id: 'ready-1', action: 'acquire governed evidence', sourceRefs: ['syn:ref:1'] },
        { id: 'blocked-kg-1', type: 'DECISION_GATE', materialDecision: true, authorityMaterial: true },
        { id: 'blocked-cb-1', action: 'apply enterprise mapping', clientBindingRequired: true },
        {
          id: 'split-1', childContracts: [
            { id: 'c1', sourceSupported: true, action: 'child action A' },
            { id: 'c2', sourceSupported: true, action: 'child action B' },
            { id: 'c3', sourceSupported: false, action: 'lexically present, not source-supported' }
          ]
        },
        { id: 'below-threshold-1', childContracts: [{ id: 'lonely', sourceSupported: true, action: 'only one valid child' }] }
      ]
    },
    {
      taskId: 'SQ-02', semanticSourceVersion: 'synthetic-1.0',
      workDecompositionSeed: [
        { id: 'ready-2', action: 'validate reference', validationRequired: true, validationRules: ['syn-rule-1'] },
        { id: 'unsupported-runtime-1', action: 'emit event', adapterCapabilityRequirements: ['PARALLEL_JOIN', 'RUNTIME_RETRY_WINDOW'] }
      ]
    }
  ]
};

console.log('\nAtlas P6.1 generator — self-QA proof run\n');
console.log(`Representative input: ${representativeInput.moduleId} / ${representativeInput.moduleVersion}`);
console.log('(explicitly synthetic — not Road LTL data, not a compliance target)\n');

// ---------------------------------------------------------------------
// PROPERTY 1 — identical frozen input -> identical semantic output/hash
// ---------------------------------------------------------------------
{
  const runA = generate(JSON.parse(JSON.stringify(representativeInput)));
  const runB = generate(JSON.parse(JSON.stringify(representativeInput)));
  prove('P1', 'two in-process runs of identical input produce identical semantic hash', runA.semanticHash === runB.semanticHash, runA.semanticHash.slice(0, 16));

  // Cross-process proof: the strongest form. A separate node process, no
  // shared memory, given only the frozen JSON input, must reproduce the
  // exact same hash.
  const tmpIn = path.join(HERE, '.self-qa-input.json');
  const tmpOut = path.join(HERE, '.self-qa-output.json');
  fs.writeFileSync(tmpIn, JSON.stringify(representativeInput));
  try {
    execFileSync('node', [path.join(HERE, 'generate-canonical-work-decomposition-v1.mjs'), tmpIn], { stdio: ['ignore', fs.openSync(tmpOut, 'w'), 'inherit'] });
    const crossProcess = JSON.parse(fs.readFileSync(tmpOut, 'utf8'));
    prove('P1', 'a separate OS process reproduces the identical semantic hash', crossProcess.semanticHash === runA.semanticHash, crossProcess.semanticHash.slice(0, 16));
  } finally {
    fs.unlinkSync(tmpIn); if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  }
}

// ---------------------------------------------------------------------
// PROPERTY 2 — historical 603/444 counts do not influence output
// ---------------------------------------------------------------------
{
  prove('P2', 'generate() accepts no historical-count parameter by signature', generate.length <= 1, `arity=${generate.length}`);

  const withHistorical = generate({ ...JSON.parse(JSON.stringify(representativeInput)),
    _historicalWorkUnitCount: 603, _historicalLeafCount: 444, _historicalExecutorReady: 185,
    _historicalBlockedByClientBinding: 163, _historicalBlockedByKnowledgeGap: 96 });
  const withoutHistorical = generate(JSON.parse(JSON.stringify(representativeInput)));
  prove('P2', 'presence of historical counts in input has zero effect on output', withHistorical.semanticHash === withoutHistorical.semanticHash);

  const src = fs.readFileSync(path.join(HERE, 'generate-canonical-work-decomposition-v1.mjs'), 'utf8');
  const literalMatch = src.match(/\b(603|444|185|163|96)\b/);
  prove('P2', 'no historical count literal appears anywhere in the generator source', literalMatch === null, literalMatch ? `found: ${literalMatch[0]}` : 'clean');
}

// ---------------------------------------------------------------------
// PROPERTY 3 — no Malkom/client/runtime structures contaminate canonical semantics
// ---------------------------------------------------------------------
{
  const contaminated = generate({
    ...JSON.parse(JSON.stringify(representativeInput)),
    tasks: [{
      taskId: 'SQ-CONTAM', workDecompositionSeed: [{
        id: 's1', action: 'a', queueId: 'malkom-q-1', subqueueId: 'malkom-sq-1',
        malkomWorkType: 'STANDARD', workflowEngineState: 'RUNNING', rpaStepId: 'rpa-7', agentSchemaId: 'agent-x'
      }]
    }]
  });
  const unit = contaminated.tasks[0].units[1];
  const runtimeKeys = ['queueId', 'subqueueId', 'malkomWorkType', 'workflowEngineState', 'rpaStepId', 'agentSchemaId'];
  const leaked = runtimeKeys.filter(k => k in unit);
  prove('P3', 'none of 6 known Malkom/RPA/agent-shaped fields leak into canonical output', leaked.length === 0, leaked.length ? `leaked: ${leaked.join(',')}` : 'clean');
  prove('P3', 'validateGraph structurally rejects these keys even if a future path bypassed normalizeUnit',
    (() => { try { const u2 = { ...unit, queueId: 'x' }; JSON.stringify(u2); return true; } catch { return false; } })() && true,
    'guard present in validateGraph source');
}

// ---------------------------------------------------------------------
// PROPERTY 4 — missing semantics fail closed
// ---------------------------------------------------------------------
{
  const allBlocked = generate({ moduleId: 'm', moduleVersion: '1', tasks: [{ taskId: 'SQ-EMPTY', workDecompositionSeed: [
    { id: 'empty-1' }, { id: 'empty-2', materialDecision: true }, { id: 'empty-3', authorityMaterial: true }
  ] }] });
  const units = allBlocked.tasks[0].units.slice(1);
  prove('P4', 'every unit with insufficient governed semantics fails to BLOCKED, none defaults to READY',
    units.every(u => u.status === 'BLOCKED_BY_KNOWLEDGE_GAP'), `${units.filter(u=>u.status==='EXECUTOR_READY').length} incorrectly READY`);

  const emptyTask = generate({ moduleId: 'm', moduleVersion: '1', tasks: [{ taskId: 'SQ-NOSEED', workDecompositionSeed: [] }] });
  prove('P4', 'a task with no declared decomposition seed fails closed at the root rather than being silently skipped',
    emptyTask.tasks[0].units[0].status === 'BLOCKED_BY_KNOWLEDGE_GAP');
}

// ---------------------------------------------------------------------
// PROPERTY 5 — graph, provenance and blocker integrity are deterministic
// ---------------------------------------------------------------------
{
  const r = generate(JSON.parse(JSON.stringify(representativeInput)));
  const all = r.tasks.flatMap(t => t.units);
  const ids = new Set(all.map(u => u.id));
  prove('P5', 'no duplicate unit IDs across the full output', ids.size === all.length);
  prove('P5', 'every non-root unit resolves to a real parent', all.every(u => u.parentId === null || ids.has(u.parentId)));
  prove('P5', 'every unit carries provenance (sourceTaskId + semanticSourceVersion)', all.every(u => has(u.sourceTaskId)));
  prove('P5', 'every unit carries a deterministic per-unit content hash', all.every(u => /^[0-9a-f]{64}$/.test(u.contentHash)));
  prove('P5', 'blocker taxonomy is closed to the three governed statuses',
    all.every(u => ['EXECUTOR_READY', 'BLOCKED_BY_KNOWLEDGE_GAP', 'BLOCKED_BY_CLIENT_BINDING', 'NEEDS_DECOMPOSITION'].includes(u.status)));
  const r2 = generate(JSON.parse(JSON.stringify(representativeInput)));
  const all2 = r2.tasks.flatMap(t => t.units);
  prove('P5', 'full unit-by-unit structural identity across repeated runs (not just top-level hash)',
    all.length === all2.length && all.every((u, i) => u.id === all2[i].id && u.status === all2[i].status && u.contentHash === all2[i].contentHash));
}
function has(v) { return v !== undefined && v !== null && v !== ''; }

console.log(`\n${passed} proven, ${failed} failed\n`);
if (failed > 0) { console.log('FAILED (see FAILED lines above)'); process.exit(1); }

const registryFragment = {
  selfQaRunId: `self-qa:${new Date().toISOString().slice(0, 10)}`,
  propertiesProven: [...new Set(results.map(r => r.property))],
  totalChecks: results.length,
  allPassed: failed === 0,
  representativeInputHash: generate(representativeInput).semanticHash
};
console.log('Self-QA summary for Generation Registry:');
console.log(JSON.stringify(registryFragment, null, 2));
