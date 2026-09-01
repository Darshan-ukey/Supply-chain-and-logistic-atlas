import { z } from 'zod';
import { identifierSchema } from '../domain/filter.js';

/**
 * Connection configuration schemas — the single source of truth. The
 * TypeScript types are z.infer outputs; there is no hand-written type that
 * can drift. Profiles reference credentials (env var names, secret refs) —
 * config never carries raw secrets.
 */

export const tableRefSchema = z.object({
  schema: identifierSchema.optional(),
  name: identifierSchema,
});
export type TableRef = z.infer<typeof tableRefSchema>;

export const connectionProfileSchema = z.object({
  id: z.string().min(1).max(64),
  /** Adapter plugin key: 'sqlite' | 'postgres' | 'mysql' | custom. */
  dialect: z.string().min(1).max(32),
  /** Env var holding the DSN / filename, resolved at use time. Never a raw secret. */
  env: z.string().min(1).optional(),
  /** Pointer into a secret store; resolution is pluggable. Never a raw secret. */
  secretRef: z.object({ provider: z.string().min(1), path: z.string().min(1) }).optional(),
  /** Non-secret dialect options (e.g. { filename } for sqlite, pool sizing). */
  config: z.record(z.string(), z.unknown()).default({}),
});
export type ConnectionProfile = z.infer<typeof connectionProfileSchema>;
