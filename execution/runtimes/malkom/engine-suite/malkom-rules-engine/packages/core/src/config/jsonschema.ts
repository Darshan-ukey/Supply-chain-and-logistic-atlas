import { z } from 'zod';
import { filterExprSchema } from '../domain/filter.js';
import { connectionProfileSchema } from './connection.js';
import {
  actionSchema,
  groupDefinitionSchema,
  registryDocSchema,
  ruleSchema,
  scopeSchema,
} from './schemas.js';

/**
 * JSON Schema export — one source of truth, zero drift. A rule-builder UI in
 * any language renders its widgets from these; the grammar and the validator
 * can never disagree because both are generated from the same Zod schemas.
 *
 * `io: 'input'` exports the pre-default shape — what clients POST.
 */

export const SCHEMA_VERSION = 1;

export function jsonSchemas(): Record<string, unknown> {
  return {
    'registry-doc': z.toJSONSchema(registryDocSchema, { io: 'input' }),
    'group-definition': z.toJSONSchema(groupDefinitionSchema, { io: 'input' }),
    rule: z.toJSONSchema(ruleSchema, { io: 'input' }),
    action: z.toJSONSchema(actionSchema, { io: 'input' }),
    'filter-expr': z.toJSONSchema(filterExprSchema, { io: 'input' }),
    scope: z.toJSONSchema(scopeSchema, { io: 'input' }),
    'connection-profile': z.toJSONSchema(connectionProfileSchema, { io: 'input' }),
  };
}
