import type { CustomConnectorDef } from './schemas.js';

/**
 * Declarative HTTP executor — interprets a CustomConnectorDef operation.
 * One engine, unlimited org-defined connectors: base URL + auth + typed
 * operations, `{placeholders}` filled from the input payload, an optional
 * dot-path pick into the response.
 */

export interface CustomExecutionOutcome {
  ok: boolean;
  detail: string;
  result: unknown;
}

const fillTemplate = (template: string, payload: Record<string, unknown>): string =>
  template.replace(/\{([A-Za-z0-9_.]+)\}/g, (_match, key: string) => {
    const value = pickPath(payload, key);
    return value === undefined || value === null ? '' : String(value as string | number | boolean);
  });

export const pickPath = (value: unknown, path: string): unknown => {
  if (path === '') return value;
  let current: unknown = value;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

export const executeCustomOperation = async (
  def: CustomConnectorDef,
  operationKey: string,
  payload: Record<string, unknown>,
  secret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CustomExecutionOutcome> => {
  const operation = def.operations.find((entry) => entry.key === operationKey);
  if (operation === undefined) {
    return { ok: false, detail: `operation ${operationKey} not defined`, result: null };
  }
  const headers: Record<string, string> = { 'content-type': 'application/json', ...def.headers };
  if (def.auth === 'apiKey-header') headers[def.authHeader] = secret;
  if (def.auth === 'bearer') headers['authorization'] = `Bearer ${secret}`;
  if (def.auth === 'basic') headers['authorization'] = `Basic ${Buffer.from(secret).toString('base64')}`;

  const target = `${def.baseUrl.replace(/\/$/, '')}/${fillTemplate(operation.path, payload).replace(/^\//, '')}`;
  const body = operation.method === 'GET' || operation.bodyTemplate === '' ? undefined : fillTemplate(operation.bodyTemplate, payload);
  try {
    const response = await fetchImpl(target, {
      method: operation.method,
      headers,
      ...(body !== undefined ? { body } : {}),
      signal: AbortSignal.timeout(def.timeoutMs),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text === '' ? null : JSON.parse(text);
    } catch {
      /* non-JSON response bodies are kept as text */
    }
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}`, result: parsed };
    return { ok: true, detail: `HTTP ${response.status}`, result: operation.responsePick === '' ? parsed : pickPath(parsed, operation.responsePick) };
  } catch (error) {
    return { ok: false, detail: (error as Error).message.slice(0, 200), result: null };
  }
};
