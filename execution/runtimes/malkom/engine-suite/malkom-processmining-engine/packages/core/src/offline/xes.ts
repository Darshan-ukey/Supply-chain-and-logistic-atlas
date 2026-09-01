import { readFile } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { ConfigInvalidError, UnsupportedError } from '../domain/errors.js';
import type { Logger } from '../ports/logger.js';
import { noopLogger } from '../ports/logger.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import {
  ensureEventLog,
  insertCaseAttributes,
  insertEventObjects,
  insertEvents,
  type CanonicalCaseAttribute,
  type CanonicalEvent,
  type CanonicalEventObject,
} from '../runtime/eventlog.js';
import type { ModuleImporter } from '../sql/clients.js';
import {
  XES_CASE_ID,
  XES_CONCEPT_NAME,
  XES_LIFECYCLE,
  XES_RESOURCE,
  XES_TIMESTAMP,
} from './xes-standard.js';

/**
 * Offline mining from a XES XML log (`.xes`, or gzipped `.xes.gz`).
 *
 * XES is the IEEE 1849 standard interchange format, so this is the path for a
 * log exported from ProM, Apromore, Disco or pm4py, and for the public
 * research logs (BPI Challenge and friends).
 *
 * Unlike the CSV path, this one cannot stay inside the database: the file is
 * XML and has to be parsed in Node. That has a real consequence — the document
 * is materialised in memory — so `maxBytes` is enforced up front rather than
 * discovered as an out-of-memory crash halfway through a long import. Very
 * large logs should be converted to CSV or Parquet first, which DuckDB then
 * streams.
 */

/** 256 MB of XML is already several GB once parsed into objects. */
export const DEFAULT_XES_MAX_BYTES = 256 * 1024 * 1024;

export interface XesImportOptions {
  path: string;
  /** Object type the trace id becomes. Default 'case'. */
  objectType?: string;
  schema?: string;
  /** Refuse files larger than this. Default 256 MB. */
  maxBytes?: number;
  /** Binding id recorded on every imported event. Default 'xes-import'. */
  bindingId?: string;
  /** Treat a trace with no concept:name as this prefix + its ordinal. */
  fallbackCasePrefix?: string;
  logger?: Logger;
  /** Test seam for the optional fast-xml-parser import. */
  importModule?: ModuleImporter;
}

export interface XesImportResult {
  events: number;
  traces: number;
  activities: number;
  objectType: string;
  /** Extensions declared in the log header, e.g. concept, time, organizational. */
  extensions: string[];
  /** Global event attribute keys the log declares. */
  globalEventKeys: string[];
  timeRange: { from: Date; to: Date } | null;
  warnings: string[];
}

/** One parsed XES attribute — the format's tagged-value model. */
interface XesAttribute {
  key: string;
  value: string;
}

interface ParsedTrace {
  caseId: string;
  attributes: XesAttribute[];
  events: XesAttribute[][];
}

export async function importXes(
  client: SqlClient,
  dialect: SqlDialect,
  opts: XesImportOptions,
): Promise<XesImportResult> {
  const logger = opts.logger ?? noopLogger;
  const objectType = opts.objectType ?? 'case';
  const bindingId = opts.bindingId ?? 'xes-import';
  const maxBytes = opts.maxBytes ?? DEFAULT_XES_MAX_BYTES;
  const warnings: string[] = [];

  const size = (await stat(opts.path)).size;
  if (size > maxBytes) {
    throw new UnsupportedError(
      `XES file is ${mb(size)} MB, above the ${mb(maxBytes)} MB limit. ` +
        'XES must be parsed in memory; convert to CSV or Parquet and import that, which DuckDB streams.',
    );
  }

  // The check above sees the file ON DISK, which for a .gz is the COMPRESSED
  // size — XES compresses roughly 40:1, so a 3 MB archive expands to well over
  // 100 MB and sails past a limit meant to prevent exactly that. Re-check once
  // the real extent is known.
  const xml = await readXml(opts.path);
  if (xml.length > maxBytes) {
    throw new UnsupportedError(
      `XES file expands to ${mb(xml.length)} MB, above the ${mb(maxBytes)} MB limit (the archive on disk is only ${mb(size)} MB). ` +
        'XES must be parsed in memory; convert to CSV or Parquet and import that, which DuckDB streams.',
    );
  }
  const parsed = await parseXes(xml, opts);

  if (parsed.traces.length === 0) {
    throw new ConfigInvalidError(
      `no traces found in ${JSON.stringify(opts.path)} — is this a XES log?`,
    );
  }

  await ensureEventLog(client, dialect, opts.schema);

  const events: CanonicalEvent[] = [];
  const links: CanonicalEventObject[] = [];
  const caseAttrs: CanonicalCaseAttribute[] = [];
  const activities = new Set<string>();
  const resources = new Set<string>();
  let eventId = await nextEventId(client, dialect, opts.schema);
  let skippedNoTimestamp = 0;
  let skippedNoActivity = 0;
  let withResource = 0;
  let minTs: number | null = null;
  let maxTs: number | null = null;

  for (const trace of parsed.traces) {
    for (const attr of trace.attributes) {
      if (attr.key === XES_CONCEPT_NAME) continue; // already the case id
      caseAttrs.push({
        objectType,
        objectId: trace.caseId,
        key: attr.key,
        value: attr.value,
      });
    }

    for (const raw of trace.events) {
      const byKey = new Map(raw.map((a) => [a.key, a.value]));
      const activity = byKey.get(XES_CONCEPT_NAME);
      const timestampText = byKey.get(XES_TIMESTAMP);

      if (activity === undefined) {
        skippedNoActivity += 1;
        continue;
      }
      if (timestampText === undefined) {
        skippedNoTimestamp += 1;
        continue;
      }
      const ms = Date.parse(timestampText);
      if (Number.isNaN(ms)) {
        skippedNoTimestamp += 1;
        continue;
      }

      minTs = minTs === null ? ms : Math.min(minTs, ms);
      maxTs = maxTs === null ? ms : Math.max(maxTs, ms);
      activities.add(activity);

      const attributes: Record<string, unknown> = {};
      for (const [key, value] of byKey) {
        if (key === XES_CONCEPT_NAME || key === XES_TIMESTAMP) continue;
        if (key === XES_RESOURCE || key === XES_LIFECYCLE) continue;
        attributes[key] = value;
      }

      const resource = byKey.get(XES_RESOURCE) ?? null;
      if (resource !== null && resource !== '') {
        withResource += 1;
        resources.add(resource);
      }

      eventId += 1;
      events.push({
        eventId,
        activity,
        timestamp: new Date(ms),
        lifecycle: byKey.get(XES_LIFECYCLE) ?? null,
        resource,
        durationSeconds: null,
        bindingId,
        attributes,
      });
      links.push({ eventId, objectType, objectId: trace.caseId });
    }
  }

  if (events.length === 0) {
    throw new ConfigInvalidError(
      `parsed ${parsed.traces.length} traces from ${JSON.stringify(opts.path)} but no usable events: every event lacked ${XES_CONCEPT_NAME} or a parseable ${XES_TIMESTAMP}`,
    );
  }
  if (skippedNoActivity > 0) {
    warnings.push(`${skippedNoActivity} events skipped: no ${XES_CONCEPT_NAME}`);
  }
  if (skippedNoTimestamp > 0) {
    warnings.push(
      `${skippedNoTimestamp} events skipped: missing or unparseable ${XES_TIMESTAMP} — they cannot be placed in a trace`,
    );
  }
  // Judged on what the EVENTS carry, never on the <global> header. Real logs
  // routinely omit a key from the header while every event supplies it — BPI
  // Challenge 2012 is exactly that shape, with org:resource on 244k of its
  // 262k events and no global declaration. Trusting the header there reports
  // the organizational perspective as unavailable when it is fully available.
  if (withResource === 0) {
    warnings.push('no event carries org:resource — the organizational perspective is unavailable');
  } else if (withResource < events.length) {
    const missing = events.length - withResource;
    warnings.push(
      `${missing.toLocaleString()} of ${events.length.toLocaleString()} events have no org:resource (${((missing / events.length) * 100).toFixed(1)}%); organizational figures cover the remainder`,
    );
  }

  await insertEvents(client, dialect, events, opts.schema);
  await insertEventObjects(client, dialect, links, opts.schema);
  await insertCaseAttributes(client, dialect, dedupeCaseAttributes(caseAttrs), opts.schema);

  logger.info(
    { path: opts.path, events: events.length, traces: parsed.traces.length, objectType },
    'xes import complete',
  );

  return {
    events: events.length,
    traces: parsed.traces.length,
    activities: activities.size,
    objectType,
    extensions: parsed.extensions,
    globalEventKeys: parsed.globalEventKeys,
    timeRange: minTs !== null && maxTs !== null ? { from: new Date(minTs), to: new Date(maxTs) } : null,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(0);
}

async function readXml(path: string): Promise<string> {
  const buffer = await readFile(path);
  // gzip magic number, so a .xes.gz works without the caller saying so.
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return gunzipSync(buffer).toString('utf8');
  }
  return buffer.toString('utf8');
}

interface XmlParserLike {
  parse(xml: string): unknown;
}

interface FastXmlModuleLike {
  XMLParser?: new (options: Record<string, unknown>) => XmlParserLike;
  default?: { XMLParser?: new (options: Record<string, unknown>) => XmlParserLike };
}

interface ParsedXes {
  traces: ParsedTrace[];
  extensions: string[];
  globalEventKeys: string[];
}

async function parseXes(xml: string, opts: XesImportOptions): Promise<ParsedXes> {
  const importModule = opts.importModule ?? ((s: string) => import(s));
  let mod: FastXmlModuleLike;
  try {
    mod = (await importModule('fast-xml-parser')) as FastXmlModuleLike;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      throw new ConfigInvalidError(
        "XES import requires the optional 'fast-xml-parser' package — npm install fast-xml-parser",
      );
    }
    throw err;
  }

  const XMLParser = mod.default?.XMLParser ?? mod.XMLParser;
  if (typeof XMLParser !== 'function') {
    throw new ConfigInvalidError(
      "the 'fast-xml-parser' package does not expose XMLParser — incompatible version?",
    );
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // XES leans entirely on element attributes (key=, value=); parsing those
    // as text would lose every value in the document.
    parseAttributeValue: false,
    trimValues: true,
    // A log with exactly one trace, or a trace with one event, must still
    // arrive as an array — otherwise every single-element case needs a
    // special path and one of them is always forgotten.
    isArray: (name: string) =>
      ['trace', 'event', 'string', 'date', 'int', 'float', 'boolean', 'id', 'extension', 'global'].includes(name),
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const log = asRecord(doc['log']);
  if (log === null) {
    throw new ConfigInvalidError('no <log> element found — this does not look like a XES document');
  }

  const extensions = asArray(log['extension'])
    .map((e) => asRecord(e)?.['@_name'])
    .filter((n): n is string => typeof n === 'string');

  const globalEventKeys: string[] = [];
  for (const global of asArray(log['global'])) {
    const rec = asRecord(global);
    if (rec === null || rec['@_scope'] !== 'event') continue;
    for (const attr of readAttributes(rec)) globalEventKeys.push(attr.key);
  }

  const fallbackPrefix = opts.fallbackCasePrefix ?? 'trace-';
  const traces: ParsedTrace[] = [];

  for (const [index, rawTrace] of asArray(log['trace']).entries()) {
    const traceRec = asRecord(rawTrace);
    if (traceRec === null) continue;

    const traceAttributes = readAttributes(traceRec);
    const named = traceAttributes.find((a) => a.key === XES_CONCEPT_NAME);
    const caseId = named?.value ?? `${fallbackPrefix}${index + 1}`;

    const events = asArray(traceRec['event'])
      .map((e) => asRecord(e))
      .filter((e): e is Record<string, unknown> => e !== null)
      .map((e) => readAttributes(e));

    traces.push({ caseId, attributes: traceAttributes, events });
  }

  return { traces, extensions, globalEventKeys };
}

/**
 * XES models every value as a typed element: `<string key=".." value=".."/>`,
 * `<date .../>`, `<int .../>` and so on. All of them are read the same way and
 * kept as text — typing is the miner's business, not the parser's.
 */
const VALUE_ELEMENTS = ['string', 'date', 'int', 'float', 'boolean', 'id'] as const;

function readAttributes(element: Record<string, unknown>): XesAttribute[] {
  const out: XesAttribute[] = [];
  for (const tag of VALUE_ELEMENTS) {
    for (const raw of asArray(element[tag])) {
      const rec = asRecord(raw);
      if (rec === null) continue;
      const key = rec['@_key'];
      const value = rec['@_value'];
      if (typeof key !== 'string') continue;
      out.push({ key, value: value === undefined || value === null ? '' : String(value) });
    }
  }
  return out;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** One row per (case, key): a trace attribute repeated across events is still one fact. */
function dedupeCaseAttributes(attrs: readonly CanonicalCaseAttribute[]): CanonicalCaseAttribute[] {
  const seen = new Map<string, CanonicalCaseAttribute>();
  for (const a of attrs) {
    seen.set(`${a.objectType}\u0000${a.objectId}\u0000${a.key}`, a);
  }
  return [...seen.values()];
}

async function nextEventId(
  client: SqlClient,
  dialect: SqlDialect,
  schema: string | undefined,
): Promise<number> {
  const { eventLogTables } = await import('../runtime/eventlog.js');
  const tables = eventLogTables(dialect, schema);
  try {
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(event_id), 0) AS m FROM ${tables.events}`,
      [],
    );
    const raw = rows[0]?.['m'];
    return typeof raw === 'bigint' ? Number(raw) : Number(raw ?? 0);
  } catch {
    return 0; // table does not exist yet
  }
}

export { XES_CASE_ID };
