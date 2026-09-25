import { readFile } from 'node:fs/promises';

const operation = {
  id: 'worker.read-profile', adapterId: 'fixture-http', capability: 'api.http', name: 'Read profile',
  action: 'read', resource: 'customer profile', sideEffect: 'read', inputs: [], outputs: [],
  outcomes: [{ id: 'returned', meaning: 'profile returned', successful: true, binding: { status: 200 } }],
  provenance: [{ authority: 'contract', source: 'worker-fixture', confidence: 1, observedAt: '2026-08-02T00:00:00.000Z', revision: 'fixture-v1' }],
  binding: { method: 'GET', path: '/api/customer-profile' },
};

function output(input, binding = operation.binding) {
  return {
    schemaVersion: 'brisk-aitesting.evidence-acquisition-output.v1',
    graphs: [{ schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: 'worker-graph', operations: [{ ...operation, binding }], diagnostics: [] }],
    attempts: [{ providerId: input.eligibleProviderIds[0], status: 'succeeded', requirementIds: input.requirements.map((entry) => entry.id), graphRevisions: ['worker-graph'], cache: 'miss' }],
    satisfiedRequirementIds: input.requirements.map((entry) => entry.id), unsatisfiedRequirementIds: [], artifacts: [],
  };
}

export const good = { acquire: (input) => output(input) };
export const malformed = { acquire: () => ({ wrong: true }) };
export const crash = { acquire: () => process.exit(19) };
export const hang = { acquire: () => { while (true) { /* deliberate CPU loop */ } } };
export const memory = { acquire: () => {
  const retained = [];
  while (true) retained.push(new Array(250_000).fill(retained.length));
} };
export const environment = { acquire: (input) => output(input, {
  method: 'GET', path: '/api/customer-profile',
  allowedEnvironmentVisible: process.env.BRISK_WORKER_ALLOWED === 'allowed-value',
  unlistedSecretVisible: process.env.BRISK_WORKER_SECRET !== undefined,
}) };
export const accessProbe = { acquire: async (input) => {
  const packageText = await readFile('package.json', 'utf8');
  const response = await fetch(process.env.WORKER_PROBE_URL);
  return output(input, {
    method: 'GET', path: '/api/customer-profile',
    directFileReadSucceeded: packageText.includes('brisk-aitesting'),
    directNetworkCallSucceeded: response.status === 204,
  });
} };
