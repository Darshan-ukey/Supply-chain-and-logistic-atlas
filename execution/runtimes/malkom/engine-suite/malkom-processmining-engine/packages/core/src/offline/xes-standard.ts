import { z } from 'zod';

/**
 * The XES standard extensions, and the flat-column convention that CSV exports
 * from Disco, ProM, Celonis and pm4py all follow.
 *
 * XES proper is XML; the CSV convention flattens it by using the same
 * extension-qualified keys as column headers, with `case:` prefixing anything
 * scoped to the trace rather than the event. Supporting the convention rather
 * than inventing one means a log exported from any of those tools imports
 * without the host writing a mapping at all.
 */

export const XES_CONCEPT_NAME = 'concept:name';
export const XES_CASE_ID = 'case:concept:name';
export const XES_TIMESTAMP = 'time:timestamp';
export const XES_RESOURCE = 'org:resource';
export const XES_LIFECYCLE = 'lifecycle:transition';
export const XES_ROLE = 'org:role';
export const XES_GROUP = 'org:group';
export const XES_COST = 'cost:total';

/** Prefix marking a column as case-scoped rather than event-scoped. */
export const XES_CASE_PREFIX = 'case:';

/**
 * Which columns carry which role. Every field is overridable: the defaults are
 * the XES convention, not an assumption about the host.
 */
export const xesColumnMappingSchema = z.object({
  caseId: z.string().min(1).default(XES_CASE_ID),
  activity: z.string().min(1).default(XES_CONCEPT_NAME),
  timestamp: z.string().min(1).default(XES_TIMESTAMP),
  resource: z.string().min(1).default(XES_RESOURCE),
  lifecycle: z.string().min(1).default(XES_LIFECYCLE),
  /** Optional column holding handling time in seconds. */
  duration: z.string().min(1).optional(),
  /** Columns to carry as event attributes. Empty means "every remaining column". */
  attributes: z.array(z.string().min(1)).default([]),
  /** Prefix marking case-scoped columns. Set to '' to disable the split. */
  casePrefix: z.string().default(XES_CASE_PREFIX),
});
export type XesColumnMapping = z.infer<typeof xesColumnMappingSchema>;

/** Common header spellings, so a near-miss export still lands without config. */
const ALIASES: Record<keyof Pick<XesColumnMapping, 'caseId' | 'activity' | 'timestamp' | 'resource' | 'lifecycle'>, string[]> = {
  caseId: [XES_CASE_ID, 'case:id', 'caseid', 'case_id', 'case', 'trace', 'traceid', 'trace_id'],
  activity: [XES_CONCEPT_NAME, 'activity', 'activityname', 'activity_name', 'event', 'eventname', 'task'],
  timestamp: [XES_TIMESTAMP, 'timestamp', 'time', 'datetime', 'date_time', 'completetime', 'complete_timestamp'],
  resource: [XES_RESOURCE, 'resource', 'user', 'agent', 'performer', 'operator'],
  lifecycle: [XES_LIFECYCLE, 'lifecycle', 'transition', 'event_type', 'eventtype'],
};

function normalise(header: string): string {
  return header.trim().toLowerCase().replaceAll(/[\s\-]+/g, '_');
}

/**
 * Infer a mapping from the headers actually present.
 *
 * Matching is case- and separator-insensitive and returns the header EXACTLY as
 * it appears in the file, because that string has to survive into SQL as a
 * quoted identifier.
 */
export function inferMapping(
  headers: readonly string[],
  overrides: Partial<XesColumnMapping> = {},
): { mapping: XesColumnMapping; missing: string[] } {
  const byNormalised = new Map<string, string>();
  for (const h of headers) {
    const key = normalise(h);
    if (!byNormalised.has(key)) byNormalised.set(key, h);
  }

  const pick = (role: keyof typeof ALIASES): string | undefined => {
    const override = overrides[role];
    if (override !== undefined) return override;
    for (const alias of ALIASES[role]) {
      const found = byNormalised.get(normalise(alias));
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const caseId = pick('caseId');
  const activity = pick('activity');
  const timestamp = pick('timestamp');
  const resource = pick('resource');
  const lifecycle = pick('lifecycle');

  const missing: string[] = [];
  if (caseId === undefined) missing.push('caseId');
  if (activity === undefined) missing.push('activity');
  if (timestamp === undefined) missing.push('timestamp');

  const mapping = xesColumnMappingSchema.parse({
    ...(caseId !== undefined ? { caseId } : {}),
    ...(activity !== undefined ? { activity } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
    ...(resource !== undefined ? { resource } : {}),
    ...(lifecycle !== undefined ? { lifecycle } : {}),
    ...(overrides.duration !== undefined ? { duration: overrides.duration } : {}),
    ...(overrides.attributes !== undefined ? { attributes: overrides.attributes } : {}),
    ...(overrides.casePrefix !== undefined ? { casePrefix: overrides.casePrefix } : {}),
  });

  return { mapping, missing };
}

/** Split remaining headers into event- and case-scoped attribute columns. */
export function classifyAttributeColumns(
  headers: readonly string[],
  mapping: XesColumnMapping,
): { event: string[]; case: string[] } {
  const claimed = new Set(
    [
      mapping.caseId,
      mapping.activity,
      mapping.timestamp,
      mapping.resource,
      mapping.lifecycle,
      mapping.duration,
    ].filter((c): c is string => c !== undefined),
  );

  const allowed =
    mapping.attributes.length > 0 ? new Set(mapping.attributes) : null;

  const event: string[] = [];
  const caseScoped: string[] = [];
  for (const header of headers) {
    if (claimed.has(header)) continue;
    if (allowed !== null && !allowed.has(header)) continue;
    if (mapping.casePrefix !== '' && header.startsWith(mapping.casePrefix)) {
      caseScoped.push(header);
    } else {
      event.push(header);
    }
  }
  return { event, case: caseScoped };
}

/** Strip the `case:` prefix for display, leaving the bare attribute name. */
export function bareAttributeName(header: string, mapping: XesColumnMapping): string {
  return mapping.casePrefix !== '' && header.startsWith(mapping.casePrefix)
    ? header.slice(mapping.casePrefix.length)
    : header;
}
