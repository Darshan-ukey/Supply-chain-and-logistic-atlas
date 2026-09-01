import { z } from 'zod';

/**
 * The integration engine's vocabulary.
 *
 * Connector  — a *type* from the registry: category, capabilities, auth
 *              schemes, config fields, secret slots, how it executes.
 * Connection — a configured, credentialed instance of a connector for
 *              one deployment ("Maersk prod S3"). Secrets are references
 *              (vault keys / env names) — never values.
 * Binding    — a usage site: which consumer (pipeline step, agent tool,
 *              notify channel…) uses which connection, with local config
 *              and an optional field mapping.
 * Run        — the execution ledger: every deliver / receive / test /
 *              collect attempt with its outcome.
 *
 * The engine owns execution and the ledger; the host owns payloads,
 * scheduling and credential values. Non-native connectors (cloud SDKs)
 * execute through host-registered adapters so the engine itself stays
 * dependency-free.
 */

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/* ---------------- connections ---------------- */

export const connectionSchema = z.object({
  id: z.string().regex(idPattern),
  connectorId: z.string().regex(idPattern),
  name: z.string().min(1).max(120),
  /** connector-field values, validated against the descriptor's cfg */
  config: z.record(z.string(), z.unknown()).default({}),
  /** secret slot -> reference ("vault:<key>" or "env:<VAR>"), never a value */
  secretRefs: z.record(z.string(), z.string().max(200)).default({}),
  enabled: z.boolean().default(true),
});
export type ConnectionDefinition = z.infer<typeof connectionSchema>;
export type ConnectionDefinitionInput = z.input<typeof connectionSchema>;

export type ConnectionStatus = 'UNTESTED' | 'HEALTHY' | 'DEGRADED' | 'FAILED';

export interface ConnectionRecord {
  definition: ConnectionDefinition;
  version: number;
  status: ConnectionStatus;
  lastTestedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

/* ---------------- bindings ---------------- */

export const consumerTypes = [
  'pipeline-step',
  'agent-tool',
  'ml-dataset',
  'notify-channel',
  'master-sync',
  'metrics-export',
  'ticket-bridge',
  'deploy-target',
  'manual-test',
] as const;
export type ConsumerType = (typeof consumerTypes)[number];

export const bindingSchema = z.object({
  id: z.string().regex(idPattern),
  connectionId: z.string().regex(idPattern),
  consumerType: z.enum(consumerTypes),
  /** id inside the consuming module (step id, agent id, channel key…) */
  consumerId: z.string().min(1).max(120),
  direction: z.enum(['INPUT', 'OUTPUT']),
  /** binding-local overrides of connection config */
  config: z.record(z.string(), z.unknown()).default({}),
  /** declarative field mapping: payload path -> target field */
  mapping: z
    .array(
      z.object({
        from: z.string().min(1).max(200),
        to: z.string().min(1).max(200),
        coerce: z.enum(['string', 'number', 'boolean', 'date']).optional(),
        constant: z.string().max(500).optional(),
      }),
    )
    .max(256)
    .default([]),
  enabled: z.boolean().default(true),
});
export type BindingDefinition = z.infer<typeof bindingSchema>;
export type BindingDefinitionInput = z.input<typeof bindingSchema>;

export interface BindingRecord {
  definition: BindingDefinition;
  version: number;
  updatedAt: string;
}

/* ---------------- custom declarative HTTP connectors ---------------- */

export const customOperationSchema = z.object({
  key: z.string().regex(idPattern),
  name: z.string().min(1).max(120),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  /** path joined onto baseUrl; {placeholders} filled from input */
  path: z.string().min(1).max(500),
  direction: z.enum(['read', 'write']),
  /** JSON body template; {placeholders} filled from input */
  bodyTemplate: z.string().max(10_000).default(''),
  /** dot-path into the response JSON picked as the result */
  responsePick: z.string().max(200).default(''),
  isTest: z.boolean().default(false),
});

export const customConnectorDefSchema = z.object({
  id: z.string().regex(idPattern),
  name: z.string().min(1).max(120),
  baseUrl: z.string().min(1).max(500),
  auth: z.enum(['none', 'apiKey-header', 'bearer', 'basic']),
  /** header name for apiKey-header auth */
  authHeader: z.string().max(120).default('authorization'),
  headers: z.record(z.string(), z.string().max(500)).default({}),
  timeoutMs: z.number().int().min(100).max(120_000).default(15_000),
  operations: z.array(customOperationSchema).min(1).max(64),
  published: z.boolean().default(false),
});
export type CustomConnectorDef = z.infer<typeof customConnectorDefSchema>;
export type CustomConnectorDefInput = z.input<typeof customConnectorDefSchema>;

export interface CustomDefRecord {
  definition: CustomConnectorDef;
  version: number;
  updatedAt: string;
}

/* ---------------- runs (execution ledger) ---------------- */

export type RunKind = 'DELIVER' | 'RECEIVE' | 'EXECUTE' | 'TEST' | 'COLLECT';
export type RunStatus = 'OK' | 'PREPARED' | 'FAILED';

export interface RunRecord {
  id: string;
  connectionId: string;
  bindingId: string | null;
  kind: RunKind;
  itemId: string;
  status: RunStatus;
  attempt: number;
  detail: string;
  /** stored only for PREPARED/FAILED so redeliver/collect can work */
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export const executeRequestSchema = z.object({
  itemId: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()),
  bindingId: z.string().regex(idPattern).optional(),
  /** custom.http connections: which operation to run */
  operation: z.string().max(64).optional(),
});
export type ExecuteRequest = z.infer<typeof executeRequestSchema>;

export interface ExecuteResult {
  runId: string;
  status: RunStatus;
  detail: string;
  connectionVersion: number;
  result: unknown;
}

export interface TestResult {
  status: ConnectionStatus;
  detail: string;
  testedAt: string;
}

/* ---------------- config bundle (control plane -> engine) ---------------- */

/** Legacy destination shape (v1) — accepted and converted to connections. */
export const destinationDefinitionSchema = z.object({
  id: z.string().regex(idPattern),
  name: z.string().min(1).max(120),
  format: z.enum(['API', 'EDI', 'SFTP', 'EMAIL']),
  endpoint: z.string().min(1).max(500),
  headers: z.record(z.string(), z.string().max(500)).default({}),
  timeoutMs: z.number().int().min(100).max(120_000).default(15_000),
  enabled: z.boolean().default(true),
});
export type DestinationDefinition = z.infer<typeof destinationDefinitionSchema>;

export const configBundleSchema = z.object({
  /** v1 compat — converted to out.* connections on apply */
  destinations: z.array(destinationDefinitionSchema).max(128).default([]),
  connections: z.array(connectionSchema).max(256).default([]),
  bindings: z.array(bindingSchema).max(1024).default([]),
  customConnectors: z.array(customConnectorDefSchema).max(64).default([]),
});
export type ConfigBundle = z.infer<typeof configBundleSchema>;
export type ConfigBundleInput = z.input<typeof configBundleSchema>;

/** Map a legacy destination onto its connector id. */
export const connectorForFormat = (format: DestinationDefinition['format']): string =>
  format === 'API' ? 'out.rest' : format === 'EDI' ? 'out.edi' : format === 'SFTP' ? 'out.sftp' : 'out.mail';

/**
 * A legacy destination carries one `endpoint` string, but the connectors it
 * maps onto declare different fields — an SFTP delivery needs a host and a
 * path where a REST write-back needs a URL. Spread the endpoint onto the
 * fields the target connector actually declares.
 *
 * Where the endpoint genuinely cannot supply a required field (an SFTP
 * destination recorded as a bare path has no host in it), the missing field
 * is left missing so validation reports it, rather than inventing a value
 * that would point deliveries somewhere nobody chose.
 */
export const legacyConfigFor = (destination: DestinationDefinition): Record<string, unknown> => {
  if (destination.format === 'API') return { endpoint: destination.endpoint, timeoutMs: destination.timeoutMs };
  if (destination.format === 'EDI') return { endpoint: destination.endpoint };
  if (destination.format === 'EMAIL') return {};

  // SFTP: host[:port]/path, sftp://host/path, or a bare path with no host.
  const raw = destination.endpoint;
  const hasScheme = raw.includes('://');
  const firstSegment = raw.replace(/^[a-z]+:\/\//i, '').split('/')[0] ?? '';
  // "outbound/bookings" is a path, not a host. Something is only treated as
  // a host when it looks like one — an explicit scheme, a dotted name, or a
  // port — otherwise the first path segment would be mistaken for a server.
  const looksLikeHost = hasScheme || firstSegment.includes('.') || firstSegment.includes(':');
  const withScheme = hasScheme ? raw : `sftp://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (looksLikeHost && parsed.hostname !== '' && !raw.startsWith('/')) {
      const path = parsed.pathname === '' || parsed.pathname === '/' ? '/' : parsed.pathname;
      return {
        host: parsed.hostname,
        ...(parsed.port === '' ? {} : { port: Number(parsed.port) }),
        path,
      };
    }
  } catch {
    /* not parseable as a host — treated as a path below */
  }
  // No host in the endpoint: keep it as the destination path and let the
  // missing host surface as a validation error the operator can fix.
  return { path: raw.startsWith('/') ? raw : `/${raw}` };
};
