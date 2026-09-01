/**
 * The one place secrets are scrubbed. Evidence files, diagnostics, results,
 * AI usage records, and repair prompts all use these same rules, so a fix
 * here protects every output at once.
 */

/** Keys whose values are always hidden, wherever they appear. */
export const SECRET_KEY_PATTERN = /authorization|cookie|token|secret|password|api[-_]?key/i;

/** Hide secret-shaped text inside any string. */
export function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, 'Bearer [redacted]')
    .replace(/\b(sk|pk|rk|npm)[-_][A-Za-z0-9._-]{8,}\b/g, '[redacted]')
    .replace(/(["']?(?:password|token|secret|authorization|apiKey|api_key)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s;,}]+)/gi, '$1[redacted]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[redacted-ssn]');
}

/** Hide secrets in a header map (by key). */
export function redactHeaderRecord(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [
    key,
    SECRET_KEY_PATTERN.test(key) ? '[redacted]' : value,
  ]));
}

/** Hide secrets anywhere inside a value: by key name and by text shape. */
export function redactDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => redactDeep(entry));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
    key,
    SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redactDeep(entry),
  ]));
}
