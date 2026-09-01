import type { ScenarioPlan } from './types.js';

export interface BriskReplayRequest {
  readonly method: string;
  readonly path: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly expectStatus?: number;
}

export function scenarioReplayRequests(scenario: ScenarioPlan): readonly BriskReplayRequest[] {
  const replay = scenario.metadata?.replay;
  if (!isRecord(replay)) return [];
  return Array.isArray(replay.requests)
    ? replay.requests.map(normalizeReplayRequest).filter((request): request is BriskReplayRequest => request !== undefined)
    : [];
}

function normalizeReplayRequest(value: unknown): BriskReplayRequest | undefined {
  if (!isRecord(value) || typeof value.path !== 'string') return undefined;
  const method = typeof value.method === 'string' ? value.method.toUpperCase() : 'GET';
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return undefined;
  const headers = normalizeHeaders(value.headers);
  const expectStatus = typeof value.expectStatus === 'number' && Number.isInteger(value.expectStatus) ? value.expectStatus : undefined;
  return {
    method,
    path: normalizePath(value.path),
    ...(headers !== undefined ? { headers } : {}),
    ...(value.body !== undefined ? { body: value.body } : {}),
    ...(expectStatus !== undefined ? { expectStatus } : {}),
  };
}

function normalizePath(value: string): string {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith('/') ? value : `/${value}`;
  }
}

function normalizeHeaders(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).flatMap(([key, entry]) => {
    if (typeof entry === 'string') return [[key, entry] as const];
    if (Array.isArray(entry) && typeof entry[0] === 'string') return [[key, entry[0]] as const];
    return [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
