import type { AiPlannerProvider, AiProviderRequest, AiProviderResponse } from 'brisk-aitesting';

export class PrivateAiProvider implements AiPlannerProvider {
  readonly name = 'private-ai-provider';

  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const response = await fetch(requiredEnv('PRIVATE_AI_ENDPOINT'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${requiredEnv('PRIVATE_AI_API_KEY')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      }),
    });
    if (!response.ok) throw new Error(`Private AI provider returned HTTP ${response.status}.`);
    const body = await response.json() as { output?: string };
    return { content: body.output ?? '' };
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

