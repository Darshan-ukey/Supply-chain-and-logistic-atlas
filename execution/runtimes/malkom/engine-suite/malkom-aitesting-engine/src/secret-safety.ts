const OBVIOUS_SECRET_VALUE = /sk-[A-Za-z0-9]{12,}|npm_[A-Za-z0-9]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|AKIA[A-Z0-9]{12,}/i;
const SECRET_FIELD = /^(authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|client[-_]?secret)$/i;

/** Conservative boundary check for raw credentials. References such as an
 * environment-variable name must be passed separately and are not scanned. */
export function containsObviousSecretLikeValue(value: unknown): boolean {
  return inspect(value, new Set<object>());
}

function inspect(value: unknown, seen: Set<object>, key?: string): boolean {
  if (typeof value === 'string') {
    return OBVIOUS_SECRET_VALUE.test(value) || (key !== undefined && SECRET_FIELD.test(key) && value.length > 0);
  }
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => inspect(entry, seen));
  return Object.entries(value).some(([entryKey, entryValue]) => inspect(entryValue, seen, entryKey));
}
