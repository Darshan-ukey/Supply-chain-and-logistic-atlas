/**
 * Redaction — which values must be redacted before writing, per the manifest's
 * telemetry settings. Applied by the gateway to every recorded argument and
 * reply, and by the runner to every recorded model reply, so a redacted value
 * never reaches the event log or a trace in the first place.
 */

const REDACTED = "[redacted]";

/** A redactor for the manifest's `telemetry.redact` field keys. */
export const redactorFor = (redact: readonly string[]): ((value: unknown) => unknown) => {
  if (redact.length === 0) return (value) => value;
  const keys = new Set(redact);

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        out[key] = keys.has(key) ? REDACTED : walk(inner);
      }
      return out;
    }
    return value;
  };
  return walk;
};

/** Redact field values inside a plain text, for recorded model replies. */
export const redactTextFor = (
  redact: readonly string[],
  values: Record<string, unknown>,
): ((text: string) => string) => {
  const secrets = redact
    .map((key) => values[key])
    .filter((value): value is string => typeof value === "string" && value.length > 2);
  if (secrets.length === 0) return (text) => text;
  return (text) => {
    let out = text;
    for (const secret of secrets) out = out.split(secret).join(REDACTED);
    return out;
  };
};
