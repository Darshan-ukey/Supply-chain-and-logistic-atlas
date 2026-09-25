import { z } from 'zod';
import { connectionProfileSchema } from './connection.js';
import { engineDefaultsSchema } from './defaults.js';
import {
  assignmentSchema,
  calendarSchema,
  metricDefinitionSchema,
  registryDocSchema,
} from './schemas.js';

/**
 * JSON Schema export — one source of truth, zero drift. A metric-builder UI
 * in any language renders its widgets from these; the grammar and the
 * validator can never disagree because both are generated from the same Zod
 * schemas.
 *
 * `io: 'input'` exports the pre-default shape — what clients POST.
 */

export const SCHEMA_VERSION = 1;

export function jsonSchemas(): Record<string, unknown> {
  return {
    'registry-doc': z.toJSONSchema(registryDocSchema, { io: 'input' }),
    'connection-profile': z.toJSONSchema(connectionProfileSchema, { io: 'input' }),
    'metric-definition': z.toJSONSchema(metricDefinitionSchema, { io: 'input' }),
    'calendar': z.toJSONSchema(calendarSchema, { io: 'input' }),
    'assignment': z.toJSONSchema(assignmentSchema, { io: 'input' }),
    // Engine-wide behavioral defaults — exported so non-TS hosts see every
    // knob and its documented default, not just the authoring documents.
    'engine-defaults': z.toJSONSchema(engineDefaultsSchema, { io: 'input' }),
  };
}
