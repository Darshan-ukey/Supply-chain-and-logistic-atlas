import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { AiPlannerProvider, AiPlannerProviderRequest, AiPlannerProviderResponse, AiProviderConfig } from './types.js';

export class BriskAiTestingProviderError extends Error {
  readonly code: string;
  readonly provider: string;
  readonly diagnosis: string;
  readonly resolution: readonly string[];

  constructor(params: {
    readonly code: string;
    readonly provider: string;
    readonly message: string;
    readonly diagnosis: string;
    readonly resolution: readonly string[];
    readonly cause?: unknown;
  }) {
    super(params.message, params.cause !== undefined ? { cause: params.cause } : undefined);
    this.name = 'BriskAiTestingProviderError';
    this.code = params.code;
    this.provider = params.provider;
    this.diagnosis = params.diagnosis;
    this.resolution = params.resolution;
  }
}

export class OpenAiCompatibleProvider implements AiPlannerProvider {
  readonly name: string;

  constructor(private readonly config: AiProviderConfig) {
    this.name = `${config.provider}-planner-provider`;
  }

  async complete(request: AiPlannerProviderRequest): Promise<AiPlannerProviderResponse> {
    const apiKey = resolveApiKey(this.config);
    if (apiKey.length === 0) {
      throw new Error(`Missing API key for ${this.config.provider}. Set ai.apiKey or ai.apiKeyEnv.`);
    }

    const response = await requestProvider(this.config, apiKey, request);

    const body = parseProviderJson(response.body, this.config.provider);
    if (!response.ok) {
      throw new Error(`${this.config.provider} request failed with HTTP ${response.status}: ${safeStringify(body)}`);
    }
    const usage = extractUsage(body);
    const content = extractChatContent(body);
    if (content.trim().length === 0) {
      throw new BriskAiTestingProviderError({
        code: 'AI_PROVIDER_EMPTY_RESPONSE',
        provider: this.config.provider,
        message: `${this.config.provider} answered successfully but message.content is empty (${emptyResponseDetail(body)}).`,
        diagnosis: 'The model produced no visible text. With finish_reason "length" the output budget ran out before the visible answer began — typical of deployments that spend the same budget on hidden reasoning first.',
        resolution: [
          'Raise ai.maxTokens so hidden reasoning and the visible answer both fit.',
          'Retry the call without maxOutputTokensHint to grant the full ai.maxTokens budget; the engine planner does this automatically.',
          'If it persists at the full budget, use a deployment that returns visible text for structured requests.',
        ],
      });
    }
    return {
      content,
      ...(usage !== undefined ? { usage } : {}),
    };
  }
}

/** Human-readable evidence from a success-shaped response that carried no visible text. */
function emptyResponseDetail(body: unknown): string {
  const root = body !== null && typeof body === 'object' ? body as Record<string, unknown> : {};
  const firstChoice = Array.isArray(root.choices) ? root.choices[0] : undefined;
  const choice = firstChoice !== null && typeof firstChoice === 'object' ? firstChoice as Record<string, unknown> : {};
  const message = choice.message !== null && typeof choice.message === 'object' ? choice.message as Record<string, unknown> : {};
  const usage = root.usage !== null && typeof root.usage === 'object' ? root.usage as Record<string, unknown> : {};
  const usageDetails = usage.completion_tokens_details !== null && typeof usage.completion_tokens_details === 'object'
    ? usage.completion_tokens_details as Record<string, unknown>
    : {};
  const parts = [
    typeof choice.finish_reason === 'string' ? `finish_reason "${choice.finish_reason}"` : 'no finish_reason',
    typeof usage.completion_tokens === 'number' ? `${usage.completion_tokens} completion tokens spent` : undefined,
    typeof usageDetails.reasoning_tokens === 'number' ? `${usageDetails.reasoning_tokens} of them hidden reasoning` : undefined,
    typeof message.reasoning_content === 'string' && message.reasoning_content.trim().length > 0 ? 'hidden reasoning_content present' : undefined,
  ];
  return parts.filter((part) => part !== undefined).join('; ');
}

interface ProviderHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: string;
}

async function requestProvider(
  config: AiProviderConfig,
  apiKey: string,
  request: AiPlannerProviderRequest,
): Promise<ProviderHttpResponse> {
  const url = new URL(chatCompletionsUrl(config));
  const body = JSON.stringify({
    model: config.model,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
    temperature: config.temperature ?? 0.1,
    // The engine sizes each answer from the work actually requested; a small
    // outline never gets the budget of a full test-case batch.
    max_tokens: Math.max(256, Math.min(config.maxTokens ?? 4096, request.maxOutputTokensHint ?? Number.MAX_SAFE_INTEGER)),
    stream: false,
    ...(request.structuredOutput === 'json-schema' && request.jsonSchema !== undefined
      ? {
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: request.jsonSchemaName.replace(/[^A-Za-z0-9_-]/g, '_'),
              strict: true,
              schema: request.jsonSchema,
            },
          },
        }
      : request.structuredOutput === 'json'
        ? { response_format: { type: 'json_object' } }
        : {}),
  });

  try {
    const ca = config.caCertPath !== undefined ? await readFile(config.caCertPath, 'utf8') : undefined;
    return await new Promise<ProviderHttpResponse>((resolve, reject) => {
      const client = url.protocol === 'http:' ? httpRequest : httpsRequest;
      const req = client({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        ...(ca !== undefined && url.protocol === 'https:' ? { ca } : {}),
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (error) {
    throw classifyProviderConnectionError(config.provider, error);
  }
}

function parseProviderJson(body: string, provider: AiProviderConfig['provider']): unknown {
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new BriskAiTestingProviderError({
      code: 'AI_PROVIDER_INVALID_JSON_RESPONSE',
      provider,
      message: `${provider} returned a response that was not valid JSON.`,
      diagnosis: 'The provider endpoint responded, but the body was not an OpenAI-compatible JSON response.',
      resolution: [
        'Confirm ai.endpoint points to the provider chat completions API.',
        'Check whether a proxy, gateway, or login page is returning HTML instead of JSON.',
      ],
      cause: error,
    });
  }
}

function classifyProviderConnectionError(provider: AiProviderConfig['provider'], error: unknown): BriskAiTestingProviderError {
  const code = nestedErrorCode(error);
  if (code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' || code === 'SELF_SIGNED_CERT_IN_CHAIN') {
    return new BriskAiTestingProviderError({
      code: 'AI_PROVIDER_TLS_TRUST_FAILED',
      provider,
      message: `${provider} connection failed because Node.js could not validate the TLS certificate chain.`,
      diagnosis: 'The AI provider path is configured and being used, but this machine or network is missing the required trusted CA certificate for outbound HTTPS.',
      resolution: [
        'Set ai.caCertPath to the corporate/root CA PEM certificate file, or set the matching provider CA env value used by your config.',
        'Alternatively start Node with NODE_EXTRA_CA_CERTS pointing to the PEM certificate file.',
        'Confirm the configured ai.endpoint is the expected provider endpoint and is not being intercepted by an untrusted proxy.',
        'Run the smoke again after fixing certificate trust; do not disable TLS verification for a real product or CI setup.',
      ],
      cause: error,
    });
  }

  return new BriskAiTestingProviderError({
    code: 'AI_PROVIDER_CONNECTION_FAILED',
    provider,
    message: `${provider} connection failed before a response was received.`,
    diagnosis: 'The AI provider could not be reached from the current runtime.',
    resolution: [
      'Check network access, proxy configuration, DNS, firewall rules, and the configured ai.endpoint.',
      'Verify the provider API key and model only after network connectivity succeeds.',
    ],
    cause: error,
  });
}

function nestedErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const direct = (error as { readonly code?: unknown }).code;
  if (typeof direct === 'string') return direct;
  const cause = (error as { readonly cause?: unknown }).cause;
  if (cause !== undefined) return nestedErrorCode(cause);
  return undefined;
}

export function createAiProviderFromConfig(config: AiProviderConfig): AiPlannerProvider {
  if (config.provider === 'openai-compatible') {
    return new OpenAiCompatibleProvider(config);
  }
  throw new Error(`Provider "${config.provider}" is not implemented. Use "openai-compatible" with an explicit ai.endpoint, or pass your own AiPlannerProvider.`);
}

// No vendor names, endpoints, or key variables are hardcoded: the host names
// the endpoint and the key source explicitly, and the engine stays neutral.
function resolveApiKey(config: AiProviderConfig): string {
  if (config.apiKey !== undefined && config.apiKey.length > 0) return config.apiKey;
  if (config.apiKeyEnv !== undefined && config.apiKeyEnv.length > 0) return process.env[config.apiKeyEnv] ?? '';
  return process.env.BRISK_AITESTING_AI_API_KEY ?? '';
}

function chatCompletionsUrl(config: AiProviderConfig): string {
  const configured = config.endpoint?.trim() ?? '';
  if (configured.length === 0) {
    throw new Error('ai.endpoint is required for the built-in provider. Set ai.endpoint or BRISK_AITESTING_AI_ENDPOINT to your chat-completions base URL.');
  }
  const endpoint = configured.replace(/\/+$/, '');
  if (endpoint.endsWith('/chat/completions')) return endpoint;
  return `${endpoint}/chat/completions`;
}

function extractChatContent(value: unknown): string {
  if (value === null || typeof value !== 'object') throw new Error('Provider returned a non-object response.');
  const choices = (value as { readonly choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new Error('Provider response did not include choices.');
  const first = choices[0] as { readonly message?: { readonly content?: unknown } };
  if (typeof first.message?.content !== 'string') throw new Error('Provider response did not include message.content.');
  return first.message.content;
}

function extractUsage(value: unknown): AiPlannerProviderResponse['usage'] {
  if (value === null || typeof value !== 'object') return undefined;
  const usage = (value as { readonly usage?: { readonly prompt_tokens?: unknown; readonly completion_tokens?: unknown } }).usage;
  if (usage === undefined) return undefined;
  return {
    ...(typeof usage.prompt_tokens === 'number' ? { inputTokens: usage.prompt_tokens } : {}),
    ...(typeof usage.completion_tokens === 'number' ? { outputTokens: usage.completion_tokens } : {}),
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
