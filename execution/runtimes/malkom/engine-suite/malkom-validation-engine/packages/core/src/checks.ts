import type { Check, Finding } from './schemas.js';

/**
 * Check evaluation. Every check is pure: record in, findings out. A check
 * whose field is absent only fails when the check is about presence —
 * format checks stay silent on missing values so one gap does not produce
 * a cascade of unrelated findings.
 */

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || String(value).trim() === '';

const asString = (value: unknown): string => (typeof value === 'string' ? value : String(value));

const finding = (check: Check, fallback: string): Finding => ({
  field: check.field,
  rule: check.kind,
  message: check.message ?? fallback,
  severity: 'ERROR',
});

export const runCheck = (check: Check, fields: Record<string, unknown>): Finding | null => {
  const value = fields[check.field];

  if (check.kind === 'required') {
    return isBlank(value) ? finding(check, `${check.field} is required`) : null;
  }

  if (check.kind === 'requiredWhen') {
    const trigger = fields[check.whenField];
    const armed = !isBlank(trigger) && check.whenValues.includes(asString(trigger));
    if (!armed) return null;
    return isBlank(value)
      ? finding(check, `${check.field} is required when ${check.whenField} is ${asString(trigger)}`)
      : null;
  }

  // format checks stay silent on missing values — that is `required`'s job
  if (isBlank(value)) return null;

  if (check.kind === 'pattern') {
    try {
      return new RegExp(check.pattern).test(asString(value))
        ? null
        : finding(check, `${check.field} does not match the expected format`);
    } catch {
      return { field: check.field, rule: 'pattern', message: `pattern for ${check.field} is not a valid expression`, severity: 'ERROR' };
    }
  }

  if (check.kind === 'length') {
    const length = asString(value).trim().length;
    if (length < check.min) return finding(check, `${check.field} must be at least ${check.min} characters`);
    if (length > check.max) return finding(check, `${check.field} must be at most ${check.max} characters`);
    return null;
  }

  if (check.kind === 'range') {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return finding(check, `${check.field} must be a number`);
    if (check.min !== undefined && numeric < check.min) return finding(check, `${check.field} must be at least ${check.min}`);
    if (check.max !== undefined && numeric > check.max) return finding(check, `${check.field} must be at most ${check.max}`);
    return null;
  }

  if (check.kind === 'oneOf') {
    return check.values.includes(asString(value))
      ? null
      : finding(check, `${check.field} must be one of: ${check.values.slice(0, 8).join(', ')}`);
  }

  if (check.kind === 'date') {
    return Number.isNaN(Date.parse(asString(value)))
      ? finding(check, `${check.field} is not a valid date`)
      : null;
  }

  const other = fields[check.otherField];
  if (isBlank(other)) return null;
  return asString(value) === asString(other)
    ? finding(check, `${check.field} must differ from ${check.otherField}`)
    : null;
};

export const evaluate = (
  checks: Check[],
  fields: Record<string, unknown>,
  warnOnly: string[],
): { passed: boolean; findings: Finding[] } => {
  const findings: Finding[] = [];
  for (const check of checks) {
    const result = runCheck(check, fields);
    if (result === null) continue;
    findings.push(warnOnly.includes(result.field) ? { ...result, severity: 'WARN' } : result);
  }
  return { passed: findings.every((entry) => entry.severity === 'WARN'), findings };
};
