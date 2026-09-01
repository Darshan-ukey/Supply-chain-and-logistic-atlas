import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { EvidenceProviderContextV2, EvidenceWorkerModuleV1 } from './pipeline-stage-contracts.js';

const modulePath = process.argv[2];
const exportName = process.argv[3] ?? 'default';

process.on('message', async (message: unknown) => {
  if (!isWorkerRequest(message) || modulePath === undefined) {
    sendFailure();
    return;
  }
  try {
    const imported = await import(pathToFileURL(resolve(modulePath)).href);
    const workerModule = imported[exportName] as EvidenceWorkerModuleV1 | undefined;
    if (workerModule === undefined || typeof workerModule.acquire !== 'function') {
      sendFailure();
      return;
    }
    const controller = new AbortController();
    const output = await workerModule.acquire(message.input, { ...message.context, signal: controller.signal });
    process.send?.({ schemaVersion: 'brisk-aitesting.evidence-worker-response.v1', output }, () => process.disconnect());
  } catch {
    sendFailure();
  }
});

function sendFailure(): void {
  process.send?.({ schemaVersion: 'brisk-aitesting.evidence-worker-failure.v1' }, () => process.disconnect());
}

function isWorkerRequest(value: unknown): value is {
  readonly schemaVersion: 'brisk-aitesting.evidence-worker-request.v1';
  readonly input: Parameters<EvidenceWorkerModuleV1['acquire']>[0];
  readonly context: Omit<EvidenceProviderContextV2, 'signal'>;
} {
  return typeof value === 'object' && value !== null
    && (value as Record<string, unknown>).schemaVersion === 'brisk-aitesting.evidence-worker-request.v1'
    && typeof (value as Record<string, unknown>).input === 'object'
    && typeof (value as Record<string, unknown>).context === 'object';
}
