import { z } from 'zod';
import {
  configBundleSchema,
  connectionProfileSchema,
  queueDefinitionSchema,
} from './schemas.js';

/**
 * JSON Schema export for non-TypeScript clients (a Python admin script, a Java
 * host, a predicate-builder UI). Generated from the same zod definitions that
 * validate every API call — one source of truth, zero drift.
 */
export const SCHEMA_VERSION = 1;

export function jsonSchemas(): Record<string, unknown> {
  return {
    'queue-definition': z.toJSONSchema(queueDefinitionSchema, { io: 'input' }),
    'connection-profile': z.toJSONSchema(connectionProfileSchema, { io: 'input' }),
    'config-bundle': z.toJSONSchema(configBundleSchema, { io: 'input' }),
  };
}
