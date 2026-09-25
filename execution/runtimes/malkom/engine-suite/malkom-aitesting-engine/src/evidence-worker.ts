import { fork } from 'node:child_process';
import type { EvidenceAcquisitionInputV1, EvidenceAcquisitionOutputV1, EvidenceProviderContextV2, EvidenceWorkerProviderV1 } from './pipeline-stage-contracts.js';

export interface EvidenceWorkerExecution {
  readonly providerId: string;
  readonly status: 'completed' | 'failed' | 'timed-out' | 'cancelled' | 'crashed';
  readonly forcedTermination: boolean;
  readonly memoryLimitMb: number;
  readonly filesystemIsolation: EvidenceWorkerProviderV1['hostIsolation']['filesystem'];
  readonly networkIsolation: EvidenceWorkerProviderV1['hostIsolation']['network'];
}

export type EvidenceWorkerOutcome =
  | { readonly status: 'completed'; readonly output: EvidenceAcquisitionOutputV1; readonly execution: EvidenceWorkerExecution }
  | { readonly status: 'failed'; readonly timedOut: boolean; readonly cancelled: boolean; readonly crashed: boolean; readonly execution: EvidenceWorkerExecution };

export async function runEvidenceWorker(params: {
  readonly provider: EvidenceWorkerProviderV1;
  readonly input: EvidenceAcquisitionInputV1;
  readonly context: EvidenceProviderContextV2;
  readonly timeoutMs: number;
  readonly parentSignal?: AbortSignal;
}): Promise<EvidenceWorkerOutcome> {
  if (params.parentSignal?.aborted === true) return failedOutcome(params.provider, 'cancelled', false);
  const workerHost = new URL('./evidence-provider-worker-host.js', import.meta.url);
  const environment = Object.fromEntries((params.provider.allowedEnvironmentVariables ?? []).flatMap((name) => {
    const value = process.env[name];
    return value === undefined ? [] : [[name, value]];
  }));
  const child = fork(workerHost, [params.provider.modulePath, params.provider.exportName ?? 'default'], {
    execArgv: [`--max-old-space-size=${params.provider.limits.memoryMb}`],
    env: { ...environment, BRISK_EVIDENCE_WORKER: '1' },
    serialization: 'advanced',
    silent: true,
  });
  child.stdout?.resume();
  child.stderr?.resume();

  return new Promise<EvidenceWorkerOutcome>((resolveOutcome) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (outcome: EvidenceWorkerOutcome): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      params.parentSignal?.removeEventListener('abort', onAbort);
      child.removeAllListeners();
      resolveOutcome(outcome);
    };
    const terminate = (kind: 'timed-out' | 'cancelled'): void => {
      child.kill('SIGKILL');
      finish(failedOutcome(params.provider, kind, true));
    };
    const onAbort = (): void => terminate('cancelled');
    params.parentSignal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => terminate('timed-out'), params.timeoutMs);

    child.once('error', () => finish(failedOutcome(params.provider, 'crashed', false)));
    child.once('exit', (code) => {
      if (!settled && code !== 0) finish(failedOutcome(params.provider, 'crashed', false));
    });
    child.on('message', (message: unknown) => {
      if (!isWorkerSuccess(message)) {
        finish(failedOutcome(params.provider, 'failed', false));
        return;
      }
      child.disconnect();
      finish({
        status: 'completed',
        output: message.output,
        execution: execution(params.provider, 'completed', false),
      });
    });

    const { signal: _signal, ...serializableContext } = params.context;
    child.send({
      schemaVersion: 'brisk-aitesting.evidence-worker-request.v1',
      input: params.input,
      context: serializableContext,
    });
  });
}

function failedOutcome(
  provider: EvidenceWorkerProviderV1,
  status: 'failed' | 'timed-out' | 'cancelled' | 'crashed',
  forcedTermination: boolean,
): EvidenceWorkerOutcome {
  return {
    status: 'failed',
    timedOut: status === 'timed-out',
    cancelled: status === 'cancelled',
    crashed: status === 'crashed',
    execution: execution(provider, status, forcedTermination),
  };
}

function execution(
  provider: EvidenceWorkerProviderV1,
  status: EvidenceWorkerExecution['status'],
  forcedTermination: boolean,
): EvidenceWorkerExecution {
  return {
    providerId: provider.id,
    status,
    forcedTermination,
    memoryLimitMb: provider.limits.memoryMb,
    filesystemIsolation: provider.hostIsolation.filesystem,
    networkIsolation: provider.hostIsolation.network,
  };
}

function isWorkerSuccess(value: unknown): value is { readonly schemaVersion: 'brisk-aitesting.evidence-worker-response.v1'; readonly output: EvidenceAcquisitionOutputV1 } {
  return typeof value === 'object' && value !== null
    && (value as Record<string, unknown>).schemaVersion === 'brisk-aitesting.evidence-worker-response.v1'
    && typeof (value as Record<string, unknown>).output === 'object'
    && (value as Record<string, unknown>).output !== null;
}
