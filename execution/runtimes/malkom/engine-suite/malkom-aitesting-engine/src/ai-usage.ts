import { createHash } from 'node:crypto';
import type { AiPlannerProvider, AiPlannerProviderRequest, AiPlannerProviderResponse } from './types.js';
import { redactText as redactSecretLikeText } from './redaction.js';

/**
 * One AI call, recorded with fingerprints instead of raw text. The digests
 * let a kept record be matched to a request and answer without storing the
 * prompt (which may describe the application) inside the result.
 */
export interface AiUsageRecord {
  readonly at: string;
  readonly jsonSchemaName: string;
  /** Which pipeline step made the call (outline, write, repair, …). */
  readonly purpose?: string;
  readonly requestDigest: string;
  readonly responseDigest?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  /** Prompt and answer sizes in UTF-8 bytes — with durationMs, the whole latency story per call. */
  readonly promptBytes: number;
  readonly responseBytes?: number;
  readonly durationMs: number;
  readonly outcome: 'ok' | 'error';
  readonly error?: string;
}

/** Everything a run spent on AI: how many calls, which model, how many tokens. */
export interface AiUsage {
  readonly schemaVersion: 'brisk-aitesting.ai-usage.v1';
  readonly provider: string;
  readonly model?: string;
  readonly calls: number;
  readonly errors: number;
  /** Missing (not zero) when the provider never reported token counts. */
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly records: readonly AiUsageRecord[];
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Wraps any AI provider and counts every call, its duration, its token use
 * when reported, and request/response fingerprints. Redacted response text
 * is kept separately (per run) so proof records can be retained without
 * exposing prompts in the result.
 */
export class AiUsageTracker {
  private records: AiUsageRecord[] = [];
  private responses: { readonly responseDigest: string; readonly redactedContent: string }[] = [];
  private requests: { readonly requestDigest: string; readonly redactedSystem: string; readonly redactedUser: string }[] = [];
  private providerName = 'none';
  private modelName: string | undefined;

  constructor(model?: string) {
    this.modelName = model;
  }

  wrap(provider: AiPlannerProvider): AiPlannerProvider {
    this.providerName = provider.name;
    const tracker = this;
    return {
      name: provider.name,
      async complete(request: AiPlannerProviderRequest): Promise<AiPlannerProviderResponse> {
        const started = Date.now();
        const requestDigest = sha256Hex(`${request.system}\n${request.user}`);
        const promptBytes = Buffer.byteLength(request.system, 'utf8') + Buffer.byteLength(request.user, 'utf8');
        try {
          const response = await provider.complete(request);
          const responseDigest = sha256Hex(response.content);
          tracker.records.push({
            at: new Date(started).toISOString(),
            jsonSchemaName: request.jsonSchemaName,
            ...(request.purpose !== undefined ? { purpose: request.purpose } : {}),
            requestDigest,
            responseDigest,
            ...(response.usage?.inputTokens !== undefined ? { inputTokens: response.usage.inputTokens } : {}),
            ...(response.usage?.outputTokens !== undefined ? { outputTokens: response.usage.outputTokens } : {}),
            promptBytes,
            responseBytes: Buffer.byteLength(response.content, 'utf8'),
            durationMs: Date.now() - started,
            outcome: 'ok',
          });
          tracker.responses.push({ responseDigest, redactedContent: redactSecretLikeText(response.content) });
          tracker.requests.push({ requestDigest, redactedSystem: redactSecretLikeText(request.system), redactedUser: redactSecretLikeText(request.user) });
          return response;
        } catch (error) {
          tracker.records.push({
            at: new Date(started).toISOString(),
            jsonSchemaName: request.jsonSchemaName,
            ...(request.purpose !== undefined ? { purpose: request.purpose } : {}),
            requestDigest,
            promptBytes,
            durationMs: Date.now() - started,
            outcome: 'error',
            error: redactSecretLikeText(error instanceof Error ? error.message : String(error)),
          });
          throw error;
        }
      },
    };
  }

  reset(): void {
    this.records = [];
    this.responses = [];
    this.requests = [];
  }

  snapshot(): AiUsage {
    const inputTokens = sumDefined(this.records.map((record) => record.inputTokens));
    const outputTokens = sumDefined(this.records.map((record) => record.outputTokens));
    return {
      schemaVersion: 'brisk-aitesting.ai-usage.v1',
      provider: this.providerName,
      ...(this.modelName !== undefined ? { model: this.modelName } : {}),
      calls: this.records.length,
      errors: this.records.filter((record) => record.outcome === 'error').length,
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      records: [...this.records],
    };
  }

  /** The redacted response texts, keyed by fingerprint, for the retained per-run record file. */
  retainedResponses(): readonly { readonly responseDigest: string; readonly redactedContent: string }[] {
    return [...this.responses];
  }

  /** The exact prompts sent (secrets scrubbed), keyed by fingerprint - so a host can show precisely what the AI was asked. */
  retainedRequests(): readonly { readonly requestDigest: string; readonly redactedSystem: string; readonly redactedUser: string }[] {
    return [...this.requests];
  }
}

function sumDefined(values: readonly (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => typeof value === 'number');
  if (present.length === 0) return undefined;
  return present.reduce((total, value) => total + value, 0);
}

