import fs from 'node:fs';
import path from 'node:path';

// R0.1C — Canonical Reference Ownership Audit.
//
// Inventories governed identifier references and classifies each by GOVERNING LAYER using
// evidence only. It performs no mutation: it never creates identifiers, never writes a
// crosswalk, and never rewrites a reference. Repair type is recommended, not applied.

export const AUDIT_VERSION = 'atlas-reference-ownership-audit-1.0.0';

export const LAYERS = {
  UNIVERSE_CANONICAL: 'Identifier defined by the governed Universe semantic payload.',
  CROSS_LAYER_CONTRACT: 'Identifier defined by a governed cross-module contract/crosswalk layer that sits between Universe and daughters.',
  DAUGHTER_LOCAL: 'Identifier owned by a daughter module and deterministically derived from that module\'s own identity.',
  OPERATIONAL_KNOWLEDGE: 'Identifier defined by governed Operational Knowledge.',
  CANONICAL_INFORMATION_OBJECT: 'Identifier defined by the canonical information/object layer.',
  ORPHAN: 'Referenced but not defined or derivable in any governed layer.'
};

const walkJson = (value, visit, pathStr = '') => {
  if (Array.isArray(value)) value.forEach((v, i) => walkJson(v, visit, `${pathStr}[${i}]`));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      visit(k, v, `${pathStr}.${k}`);
      walkJson(v, visit, `${pathStr}.${k}`);
    }
  }
};

/**
 * Paths excluded from the evidence scan.
 *
 * The audit must inventory references carried by governed source/model evidence, not
 * references quoted inside audit or governance records ABOUT those references. Without
 * this, the audit reads its own output and its counts change once its findings are
 * committed, making the result non-reproducible.
 */
export const EXCLUDED_EVIDENCE_PATHS = [
  'data/references',            // this audit's own output
  'governance/recovery',        // stage records that quote identifiers as findings
  'governance/backlog',         // queue/roadmap prose
  'governance/registry'         // input registry metadata
];

const isExcluded = p => EXCLUDED_EVIDENCE_PATHS.some(x => path.normalize(p).startsWith(path.normalize(x)));

const listJson = dir => {
  const out = [];
  const rec = d => {
    if (isExcluded(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (isExcluded(p)) continue;
      if (e.isDirectory()) rec(p);
      else if (e.name.endsWith('.json')) out.push(p);
    }
  };
  if (fs.existsSync(dir)) rec(dir);
  return out;
};

/** Collect every reference to an identifier matching `pattern`, with the field that carried it. */
export function collectReferences(roots, pattern) {
  const refs = new Map();
  for (const root of roots) {
    for (const file of listJson(root)) {
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
      walkJson(doc, (key, value) => {
        if (typeof value === 'string' && pattern.test(value)) {
          if (!refs.has(value)) refs.set(value, { identifier: value, referencedBy: new Set() });
          refs.get(value).referencedBy.add(`${file}::${key}`);
        }
      });
    }
  }
  return refs;
}

/** Collect identifier DEFINITION sites: an object whose identity field holds the identifier. */
export function collectDefinitions(roots, pattern, identityFields = ['id', 'conceptId', 'contractId', 'assetId']) {
  const defs = new Map();
  for (const root of roots) {
    for (const file of listJson(root)) {
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
      walkJson(doc, (key, value) => {
        if (identityFields.includes(key) && typeof value === 'string' && pattern.test(value)) {
          if (!defs.has(value)) defs.set(value, new Set());
          defs.get(value).add(`${file}::${key}`);
        }
      });
    }
  }
  return defs;
}

/**
 * Is the identifier deterministically derivable from a daughter's own module + process
 * identity? Derivability is evidence of daughter-local ownership: the identifier carries no
 * information beyond the daughter's own keys and therefore needs no external definition site.
 */
export function derivabilityFromModuleIdentity(warehousePath) {
  if (!fs.existsSync(warehousePath)) return null;
  const w = JSON.parse(fs.readFileSync(warehousePath, 'utf8'));
  const rows = (w.workDecompositions || []).filter(d => d.lineage?.a5ContractId);
  const checked = rows.map(d => {
    const { moduleId, a5ProcessId, a5ContractId } = d.lineage;
    const expected = `a5-${String(moduleId).split('-').pop()}-${String(a5ProcessId).split('-').pop()}`.toLowerCase();
    return { moduleId, processId: a5ProcessId, identifier: a5ContractId, expected, derivable: a5ContractId === expected };
  });
  return {
    sampleSize: checked.length,
    derivableCount: checked.filter(x => x.derivable).length,
    allDerivable: checked.length > 0 && checked.every(x => x.derivable),
    rule: 'a5-{moduleSuffix}-{processSuffix} derived from the daughter module id and its own process id',
    examples: checked.slice(0, 3)
  };
}

export function auditOwnership({ roots, universePayloadPath, crosswalkPath, warehousePath }) {
  const universe = JSON.parse(fs.readFileSync(universePayloadPath, 'utf8'));
  const universeBlob = JSON.stringify(universe.structures);
  const crosswalk = fs.existsSync(crosswalkPath) ? JSON.parse(fs.readFileSync(crosswalkPath, 'utf8')) : null;
  const crosswalkConcepts = new Map((crosswalk?.concepts || []).map(c => [c.conceptId, c]));

  const classes = [];
  for (const [label, pattern] of [['a5', /^a5-[a-z0-9-]+$/], ['scp', /^scp-[a-z0-9-]+$/]]) {
    const refs = collectReferences(roots, pattern);
    const defs = collectDefinitions(roots, pattern);
    const derivability = label === 'a5' ? derivabilityFromModuleIdentity(warehousePath) : null;

    const identifiers = [...refs.values()].map(r => {
      const inUniverse = universeBlob.includes(r.identifier);
      const definedAt = [...(defs.get(r.identifier) || [])].sort();
      const concept = crosswalkConcepts.get(r.identifier);
      let layer, basis;
      if (inUniverse) { layer = 'UNIVERSE_CANONICAL'; basis = 'Present in the governed Universe semantic payload.'; }
      else if (concept) {
        layer = 'CROSS_LAYER_CONTRACT';
        basis = `Defined in the governed cross-module concept layer with definitionStatus ${concept.definitionStatus}.`;
      } else if (derivability?.allDerivable) {
        layer = 'DAUGHTER_LOCAL';
        basis = `Deterministically derivable from the daughter module and process identity (${derivability.rule}); no external definition site is required.`;
      } else if (definedAt.length) { layer = 'CROSS_LAYER_CONTRACT'; basis = `Defined at ${definedAt.join(', ')}.`; }
      else { layer = 'ORPHAN'; basis = 'Referenced but neither defined nor derivable in any governed layer.'; }
      return {
        identifier: r.identifier,
        governingLayer: layer,
        basis,
        definedAt,
        presentInUniversePayload: inUniverse,
        referenceCount: r.referencedBy.size,
        referencedBy: [...r.referencedBy].sort().slice(0, 6)
      };
    }).sort((a, b) => a.identifier.localeCompare(b.identifier));

    const byLayer = {};
    for (const i of identifiers) byLayer[i.governingLayer] = (byLayer[i.governingLayer] || 0) + 1;
    classes.push({ identifierClass: label, referencedCount: identifiers.length, definitionSites: [...new Set([...defs.values()].flatMap(s => [...s]))].sort(), byLayer, derivability, identifiers });
  }

  return {
    schemaVersion: 'atlas-reference-ownership-audit-v1',
    stageId: 'R0.1C',
    auditVersion: AUDIT_VERSION,
    classification: 'EVIDENCE_BASED_OWNERSHIP_AUDIT_NO_MUTATION',
    excludedEvidencePaths: EXCLUDED_EVIDENCE_PATHS,
    layerLegend: LAYERS,
    universeSemanticStructuresConsulted: universe.lineage?.sourceSha256 ? true : false,
    classes
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
  const report = auditOwnership({
    roots: ['data', 'governance'],
    universePayloadPath: 'data/universe/r0-1a-r/universe-semantic-payload.json',
    crosswalkPath: 'data/crosswalks/process-concept-crosswalk-v1.json',
    warehousePath: 'data/atlas-warehouse-v1.json'
  });
  for (const c of report.classes) {
    console.log(`${c.identifierClass}-* : ${c.referencedCount} referenced`);
    console.log(`  definition sites : ${c.definitionSites.length ? c.definitionSites.join(', ') : 'NONE'}`);
    console.log(`  by layer         : ${JSON.stringify(c.byLayer)}`);
    if (c.derivability) console.log(`  derivable        : ${c.derivability.derivableCount}/${c.derivability.sampleSize}`);
  }
  if (out) { fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`); console.log(`written: ${out}`); }
}
