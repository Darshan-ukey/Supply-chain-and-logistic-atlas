import fs from 'node:fs';
import crypto from 'node:crypto';

// R0.2 — deterministic materialization of effective road-ltl@1.5.
//
// effective 1.5 = frozen 1.4 base + governed 1.5 task overrides.
//
// The 1.4 base uses `taskId` while the 1.5 overlay uses `id`. That drift is normalized HERE,
// in derived tooling, by reading either key. No recovered source asset is mutated: both
// inputs are read byte-identically and the normalization exists only in this materializer's
// output. No semantics are reconstructed, inferred or invented.

export const MATERIALIZER_VERSION = 'atlas-effective-road-ltl-materializer-1.0.0';

export const stableStringify = v => Array.isArray(v)
  ? `[${v.map(stableStringify).join(',')}]`
  : (v && typeof v === 'object'
    ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`
    : JSON.stringify(v === undefined ? null : v));
export const canonicalHash = v => crypto.createHash('sha256').update(stableStringify(v)).digest('hex');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** Read a task identity under either governed key. Neither source is rewritten. */
export const taskIdentityOf = t => {
  const id = t?.taskId ?? t?.id;
  if (typeof id !== 'string' || !id) throw new Error('Task carries no taskId or id; failed closed.');
  return id;
};

export function materializeEffective({ basePath, overlayPath }) {
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));

  const baseTasks = base.tasks;
  if (!Array.isArray(baseTasks) || !baseTasks.length) throw new Error('Base module carries no tasks; failed closed.');
  const overrides = overlay.taskOverrides ?? [];

  // Module identity is declared differently in each governed asset: the 1.4 base nests it
  // under `module`, the 1.5 overlay declares it at top level. Read both without rewriting either.
  const effectiveVersion = String(overlay.version ?? overlay.module?.version ?? '');
  const baseVersion = String(base.module?.version ?? base.version ?? '');
  if (!effectiveVersion || !baseVersion) throw new Error('Module versions are not declared; failed closed.');
  const baseModuleId = String(base.module?.id ?? base.moduleId ?? '');
  const overlayModuleId = String(overlay.moduleId ?? overlay.module?.id ?? '');
  if (baseModuleId !== overlayModuleId) {
    throw new Error(`Base module '${baseModuleId}' and overlay module '${overlayModuleId}' differ; failed closed.`);
  }

  const byId = new Map();
  for (const t of baseTasks) {
    const id = taskIdentityOf(t);
    if (byId.has(id)) throw new Error(`Duplicate task identity in base: ${id}`);
    byId.set(id, { task: t, semanticSourceVersion: baseVersion, inheritance: 'LOSSLESS_UNCHANGED_TASK' });
  }
  for (const o of overrides) {
    const id = taskIdentityOf(o);
    if (!byId.has(id)) throw new Error(`Override targets a task absent from the base: ${id}; failed closed.`);
    byId.set(id, {
      task: { ...byId.get(id).task, ...o },
      semanticSourceVersion: effectiveVersion,
      inheritance: 'DIRECT_GOVERNED_OVERRIDE'
    });
  }

  const tasks = [...byId.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, v]) => ({
      taskId: id,
      semanticSourceVersion: v.semanticSourceVersion,
      inheritance: v.inheritance,
      task: v.task
    }));

  const inherited = tasks.filter(t => t.inheritance === 'LOSSLESS_UNCHANGED_TASK');
  const overridden = tasks.filter(t => t.inheritance === 'DIRECT_GOVERNED_OVERRIDE');

  return {
    schemaVersion: 'atlas-effective-road-ltl-materialization-v1',
    stageId: 'R0.2',
    materializerVersion: MATERIALIZER_VERSION,
    moduleId: baseModuleId,
    effectiveModuleVersion: effectiveVersion,
    semanticBaseVersion: baseVersion,
    identityKeyNormalization: {
      baseTaskKey: 'taskId', overlayTaskKey: 'id',
      baseVersionPath: 'module.version', overlayVersionPath: 'version',
      handledIn: 'DERIVED_TOOLING_ONLY',
      sourceAssetsMutated: false,
      note: 'The materializer reads either key. Recovered source bytes are unchanged.'
    },
    inputs: {
      base: { path: basePath, sha256: sha(basePath), version: baseVersion, taskCount: baseTasks.length },
      overlay: { path: overlayPath, sha256: sha(overlayPath), version: effectiveVersion, overrideCount: overrides.length }
    },
    lineage: {
      effectiveTaskCount: tasks.length,
      inheritedUnchangedCount: inherited.length,
      directGovernedOverrideCount: overridden.length,
      overriddenTaskIds: overridden.map(t => t.taskId),
      semanticSourceVersionSpread: tasks.reduce((acc, t) => {
        acc[t.semanticSourceVersion] = (acc[t.semanticSourceVersion] || 0) + 1; return acc;
      }, {})
    },
    tasks
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const arg = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const result = materializeEffective({
    basePath: arg('--base') || 'data/modules/road-ltl-v1.4.json',
    overlayPath: arg('--overlay') || 'data/modules/road-ltl-v1.5.json'
  });
  const l = result.lineage;
  console.log(`effective ${result.moduleId}@${result.effectiveModuleVersion} (base ${result.semanticBaseVersion})`);
  console.log(`  effective tasks            : ${l.effectiveTaskCount}`);
  console.log(`  inherited unchanged        : ${l.inheritedUnchangedCount}`);
  console.log(`  direct governed override   : ${l.directGovernedOverrideCount} -> ${l.overriddenTaskIds.join(', ')}`);
  console.log(`  semanticSourceVersion spread: ${JSON.stringify(l.semanticSourceVersionSpread)}`);
  console.log(`  materialization hash       : ${canonicalHash(result)}`);
  const out = arg('--out');
  if (out) { fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`); console.log(`  written: ${out}`); }
}
