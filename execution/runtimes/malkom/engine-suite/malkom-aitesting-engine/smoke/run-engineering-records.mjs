import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((value) => value.trim().replaceAll('`', ''));
}

function table(markdown, expectedHeaders) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const values = cells(line);
    return expectedHeaders.every((header, index) => values[index] === header);
  });
  if (headerIndex < 0) throw new Error(`Missing table with headers: ${expectedHeaders.join(', ')}`);
  const headers = cells(lines[headerIndex]);
  const rows = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith('|')) break;
    const values = cells(line);
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }
  return rows;
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function loadRecords() {
  const [requirementsText, capabilitiesText, claimsText, decisionsText, coverageText, proofText, statusText] = await Promise.all([
    read('docs/engineering/REQUIREMENTS_TRACEABILITY.md'),
    read('docs/engineering/CAPABILITY_MATRIX.md'),
    read('docs/engineering/CLAIM_LEDGER.md'),
    read('docs/decisions/README.md'),
    read('docs/engineering/TEST_COVERAGE.md'),
    read('docs/engineering/PROOF_CLASSIFICATION.md'),
    read('docs/engineering/STATUS_MODEL.md'),
  ]);

  return {
    schemaVersion: 'brisk-aitesting.engineering-records.v1',
    requirements: table(requirementsText, ['Requirement ID', 'Requirement and acceptance obligation']).map((row) => ({
      id: row['Requirement ID'],
      requirement: row['Requirement and acceptance obligation'],
      implementation: row['Implementation'],
      testProof: row['Test/proof'],
      evidence: row['Evidence'],
      status: row['Status'],
    })),
    capabilities: table(capabilitiesText, ['Capability ID', 'Capability']).map((row) => ({
      id: row['Capability ID'],
      capability: row['Capability'],
      requirementIds: row['Requirement IDs'].split(',').map((value) => value.trim()).filter(Boolean),
      status: row['Status'],
      currentEvidence: row['Current evidence'],
      requiredNextProof: row['Required next proof'],
    })),
    claims: table(claimsText, ['Claim ID', 'Exact claim']).map((row) => ({
      id: row['Claim ID'],
      claim: row['Exact claim'],
      capabilityIds: row['Capability IDs'].split(',').map((value) => value.trim()).filter(Boolean),
      status: row['Status'],
      proofClass: row['Proof class'],
      procedure: row['Command/procedure'],
      environment: row['Environment'],
      result: row['Result'],
      evidence: row['Evidence'],
      exclusions: row['Exclusions'],
    })),
    decisions: table(decisionsText, ['ADR', 'Decision']).map((row) => {
      const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(row['ADR']);
      if (!match) throw new Error(`ADR index entry is not a link: ${row['ADR']}`);
      return { id: match[1], path: match[2], decision: row['Decision'], status: row['Status'] };
    }),
    testCoverage: table(coverageText, ['Coverage ID', 'Test path']).map((row) => ({
      id: row['Coverage ID'],
      path: row['Test path'],
      sha256: row['SHA-256'],
      documentationStatus: row['Documentation status'],
      legacyBaseline: row['Legacy baseline'] === 'yes',
      proofClass: row['Proof class'],
      requirementIds: row['Requirement IDs'].split(',').map((value) => value.trim()).filter(Boolean),
      dimensions: row['Dimensions'].split(',').map((value) => value.trim()).filter(Boolean),
      risk: row['Risk or subtle behavior covered'],
      authoritativeInputs: row['Authoritative inputs'],
      expectedEvidence: row['Expected evidence and denominator'],
      exclusions: row['Exclusions'],
    })),
    proofClasses: table(proofText, ['Proof class', 'Meaning']).map((row) => row['Proof class']),
    statusTransitions: table(statusText, ['Status', 'Entry criteria']).map((row) => row['Status']),
  };
}

function duplicateValues(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function isPending(value) {
  return /^(pending|none|n\/a|not implemented)|\bpending\b/i.test(value.trim());
}

function validateInvariants(records) {
  const issues = [];
  for (const [name, rows] of [
    ['requirement', records.requirements],
    ['capability', records.capabilities],
    ['claim', records.claims],
    ['decision', records.decisions],
    ['test coverage', records.testCoverage],
  ]) {
    for (const id of duplicateValues(rows.map((row) => row.id))) issues.push(`Duplicate ${name} id ${id}.`);
  }

  const expectedGroups = ['MIS', 'PRN', 'SUR', 'PIP', 'AI', 'EVD', 'CMP', 'ADP', 'MCP', 'CLI', 'HEAL', 'REL', 'BEN', 'EXT', 'DX', 'OBS', 'SEC', 'HON', 'PER', 'REC', 'DOD', 'REP', 'WRK', 'FIN', 'TST'];
  const groups = new Set(records.requirements.map((row) => row.id.split('-')[0]));
  for (const group of expectedGroups) if (!groups.has(group)) issues.push(`Missing mandate requirement group ${group}.`);

  const requirementIds = new Set(records.requirements.map((row) => row.id));
  const capabilityIds = new Set(records.capabilities.map((row) => row.id));
  for (const capability of records.capabilities) {
    for (const id of capability.requirementIds) if (!requirementIds.has(id)) issues.push(`Capability ${capability.id} references unknown requirement ${id}.`);
  }
  for (const claim of records.claims) {
    for (const id of claim.capabilityIds) if (!capabilityIds.has(id)) issues.push(`Claim ${claim.id} references unknown capability ${id}.`);
  }
  for (const coverage of records.testCoverage) {
    for (const id of coverage.requirementIds) if (!requirementIds.has(id)) issues.push(`Test coverage ${coverage.id} references unknown requirement ${id}.`);
    const resolved = path.resolve(root, coverage.path);
    const smokeRoot = path.resolve(root, 'smoke') + path.sep;
    if (!resolved.startsWith(smokeRoot)) issues.push(`Test coverage ${coverage.id} escapes the smoke directory.`);
    if (!coverage.legacyBaseline && coverage.documentationStatus !== 'documented') issues.push(`New test coverage ${coverage.id} is not fully documented.`);
    if (coverage.documentationStatus === 'legacy-backfill-pending' && !coverage.legacyBaseline) issues.push(`Non-legacy test coverage ${coverage.id} cannot create legacy documentation debt.`);
    if (coverage.documentationStatus === 'documented' && [coverage.risk, coverage.authoritativeInputs, coverage.expectedEvidence, coverage.exclusions].some(isPending)) issues.push(`Documented test coverage ${coverage.id} still contains pending documentation.`);
  }
  for (const duplicatePath of duplicateValues(records.testCoverage.map((entry) => entry.path))) issues.push(`Duplicate test coverage path ${duplicatePath}.`);

  for (const claim of records.claims.filter((row) => row.status === 'verified')) {
    for (const [field, value] of Object.entries(claim)) {
      if (field !== 'status' && isPending(String(value))) issues.push(`Verified claim ${claim.id} has non-evidence value in ${field}.`);
    }
    if (!/\b\d+\b/.test(claim.result)) issues.push(`Verified claim ${claim.id} result has no numeric scope or count.`);
  }

  for (const capability of records.capabilities.filter((row) => row.status === 'production-proven')) {
    const hasProductionClaim = records.claims.some((claim) => claim.status === 'verified' && claim.proofClass === 'production' && claim.capabilityIds.includes(capability.id));
    if (!hasProductionClaim) issues.push(`Production-proven capability ${capability.id} has no matching verified production claim.`);
    const openRequirements = records.requirements.filter((row) => capability.requirementIds.includes(row.id) && row.status !== 'complete');
    if (openRequirements.length > 0) issues.push(`Production-proven capability ${capability.id} has open requirements: ${openRequirements.map((row) => row.id).join(', ')}.`);
  }

  for (const requirement of records.requirements.filter((row) => row.status === 'complete')) {
    if ([requirement.implementation, requirement.testProof, requirement.evidence].some(isPending)) issues.push(`Complete requirement ${requirement.id} still contains pending proof.`);
  }

  for (const decision of records.decisions) {
    const resolved = path.resolve(root, 'docs/decisions', decision.path);
    const decisionRoot = path.resolve(root, 'docs/decisions') + path.sep;
    if (!resolved.startsWith(decisionRoot)) issues.push(`Decision ${decision.id} escapes the decisions directory.`);
  }
  return issues;
}

async function validateCoverageFilesystem(records) {
  const issues = [];
  const files = (await readdir(path.join(root, 'smoke')))
    .filter((name) => /^run-.*\.mjs$/.test(name))
    .map((name) => `smoke/${name}`)
    .sort();
  const documentedPaths = records.testCoverage.map((entry) => entry.path).sort();
  for (const file of files) if (!documentedPaths.includes(file)) issues.push(`Test executable ${file} has no coverage record.`);
  for (const file of documentedPaths) if (!files.includes(file)) issues.push(`Coverage record points to missing test executable ${file}.`);
  for (const coverage of records.testCoverage) {
    if (!files.includes(coverage.path)) continue;
    const bytes = await readFile(path.join(root, coverage.path));
    // Normalize line endings so the digest is stable regardless of checkout
    // (Windows core.autocrlf=true yields CRLF locally, CI checks out LF).
    const text = bytes.toString('utf8').replace(/\r\n/g, '\n');
    const digest = createHash('sha256').update(text, 'utf8').digest('hex');
    if (digest !== coverage.sha256) issues.push(`Test coverage ${coverage.id} digest is stale for ${coverage.path}.`);
  }
  return issues;
}

function validateCheckpointProgress(markdown) {
  const issues = [];
  const lines = markdown.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!/^- \[x\] ~~.+~~\s*$/.test(line)) continue;
    if (!/^  Evidence:\s+\S/.test(lines[index + 1] ?? '')) {
      issues.push(`Completed checkpoint task on line ${index + 1} has no immediate evidence sentence.`);
    }
  }
  const completed = [...markdown.matchAll(/^- \[x\]/gm)].length;
  const open = [...markdown.matchAll(/^- \[ \]/gm)].length;
  const total = completed + open;
  const percentage = Number(((completed / total) * 100).toFixed(1));
  const progress = /Task-count progress: \*\*(\d+) \/ (\d+) completed \(([0-9.]+)%\)\*\*/.exec(markdown);
  if (progress === null) {
    issues.push('Checkpoint is missing parseable task-count progress metadata.');
  } else {
    if (Number(progress[1]) !== completed) issues.push(`Checkpoint reports ${progress[1]} completed tasks but contains ${completed}.`);
    if (Number(progress[2]) !== total) issues.push(`Checkpoint reports ${progress[2]} total tasks but contains ${total}.`);
    if (Number(progress[3]) !== percentage) issues.push(`Checkpoint reports ${progress[3]}% but calculated progress is ${percentage}%.`);
  }
  const bar = /Progress: `([█░]+)`/.exec(markdown);
  const expectedFilled = Math.round(percentage / 5);
  const expectedBar = `${'█'.repeat(expectedFilled)}${'░'.repeat(20 - expectedFilled)}`;
  if (bar === null) issues.push('Checkpoint is missing the 20-segment progress bar.');
  else if (bar[1] !== expectedBar) issues.push(`Checkpoint progress bar is stale; expected ${expectedBar}.`);
  return { issues, completed, open, total, percentage, bar: expectedBar };
}

async function main() {
  const schema = JSON.parse(await read('docs/engineering/engineering-records.schema.json'));
  const records = await loadRecords();
  const checkpointText = await read('docs/ENGINEERING_EXECUTION_CHECKPOINTS.md');
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(records)) throw new Error(`Engineering record schema failed:\n${JSON.stringify(validate.errors, null, 2)}`);

  const issues = validateInvariants(records);
  issues.push(...await validateCoverageFilesystem(records));
  const checkpoint = validateCheckpointProgress(checkpointText);
  issues.push(...checkpoint.issues);
  if (issues.length > 0) throw new Error(`Engineering record invariants failed:\n- ${issues.join('\n- ')}`);

  const negativeFixtures = [
    { name: 'duplicate requirement', mutate: (copy) => copy.requirements.push({ ...copy.requirements[0] }) },
    { name: 'missing mandate group', mutate: (copy) => { copy.requirements = copy.requirements.filter((row) => !row.id.startsWith('MCP-')); } },
    { name: 'unproven verified claim', mutate: (copy) => { copy.claims[0].evidence = 'Pending'; } },
    { name: 'unproven production capability', mutate: (copy) => { copy.capabilities[0].status = 'production-proven'; } },
    { name: 'orphan requirement reference', mutate: (copy) => { copy.capabilities[0].requirementIds.push('MCP-999'); } },
    { name: 'orphan capability reference', mutate: (copy) => { copy.claims[0].capabilityIds.push('CAP-999'); } },
    { name: 'ADR path traversal', mutate: (copy) => { copy.decisions[0].path = '../secret.md'; } },
    { name: 'duplicate test path', mutate: (copy) => { copy.testCoverage[1].path = copy.testCoverage[0].path; } },
    { name: 'orphan coverage requirement', mutate: (copy) => { copy.testCoverage[0].requirementIds.push('TST-999'); } },
    { name: 'new undocumented test', mutate: (copy) => { copy.testCoverage.find((entry) => !entry.legacyBaseline).documentationStatus = 'legacy-backfill-pending'; } },
    { name: 'coverage path traversal', mutate: (copy) => { copy.testCoverage[0].path = '../secret.mjs'; } },
  ];
  let blockedMalformedOrInconsistentFixtures = 0;
  for (const fixture of negativeFixtures) {
    const copy = structuredClone(records);
    fixture.mutate(copy);
    const schemaAccepted = validate(copy);
    const fixtureIssues = schemaAccepted ? validateInvariants(copy) : ['schema blocked malformed record'];
    if (fixtureIssues.length === 0) throw new Error(`Negative fixture was accepted: ${fixture.name}`);
    blockedMalformedOrInconsistentFixtures += 1;
  }

  const staleDigest = structuredClone(records);
  staleDigest.testCoverage[0].sha256 = '0'.repeat(64);
  if ((await validateCoverageFilesystem(staleDigest)).length === 0) throw new Error('Negative fixture was accepted: stale test digest');
  blockedMalformedOrInconsistentFixtures += 1;

  const staleCheckpoint = checkpointText.replace(/Task-count progress: \*\*\d+ \/ /, 'Task-count progress: **0 / ');
  if (validateCheckpointProgress(staleCheckpoint).issues.length === 0) throw new Error('Negative fixture was accepted: stale checkpoint progress');
  blockedMalformedOrInconsistentFixtures += 1;
  const evidenceLessCheckpoint = checkpointText.replace(/(\r?\n)  Evidence:[^\r\n]+/, '$1  Missing proof: deliberately removed by negative fixture.');
  if (validateCheckpointProgress(evidenceLessCheckpoint).issues.length === 0) throw new Error('Negative fixture was accepted: completed checkpoint task without evidence');
  blockedMalformedOrInconsistentFixtures += 1;
  const malformedOrInconsistentRecordFixtures = negativeFixtures.length + 3;
  if (blockedMalformedOrInconsistentFixtures !== malformedOrInconsistentRecordFixtures) {
    throw new Error(`Malformed/inconsistent fixture denominator mismatch: blocked ${blockedMalformedOrInconsistentFixtures} of ${malformedOrInconsistentRecordFixtures}.`);
  }

  console.log(JSON.stringify({
    schemaVersion: 'brisk-aitesting.engineering-record-check.v1',
    requirements: records.requirements.length,
    capabilities: records.capabilities.length,
    claims: records.claims.length,
    decisions: records.decisions.length,
    testCoverageRecords: records.testCoverage.length,
    fullyDocumentedTests: records.testCoverage.filter((entry) => entry.documentationStatus === 'documented').length,
    legacyBackfillPending: records.testCoverage.filter((entry) => entry.documentationStatus === 'legacy-backfill-pending').length,
    checkpointProgress: {
      completed: checkpoint.completed,
      open: checkpoint.open,
      total: checkpoint.total,
      percentage: checkpoint.percentage,
      bar: checkpoint.bar,
    },
    proofClasses: records.proofClasses.length,
    statusTransitions: records.statusTransitions.length,
    positiveChecks: 1,
    malformedOrInconsistentRecordFixtures,
    blockedMalformedOrInconsistentFixtures,
    failures: 0,
    skips: 0,
  }, null, 2));
}

await main();
