import { Ajv, type AnySchema, type ErrorObject } from 'ajv';

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ajv = new Ajv({ allErrors: true, strict: false });

export function validateJsonSchema(schema: unknown, value: unknown): SchemaValidationResult {
  try {
    const validate = ajv.compile(schema as AnySchema);
    const valid = validate(value) === true;
    return {
      valid,
      errors: valid
        ? []
        : (validate.errors ?? []).map((error: ErrorObject) => `${error.instancePath || '/'} ${error.message ?? 'failed validation'}`),
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function createSchemaExample(schema: unknown): unknown {
  if (!isRecord(schema)) return {};
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.default !== undefined) return schema.default;
  if (schema.example !== undefined) return schema.example;

  const type = schemaType(schema);
  if (type === 'object') {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : [];
    const result: Record<string, unknown> = {};
    const keys = required.length > 0 ? required : Object.keys(properties).slice(0, 3);
    for (const key of keys) {
      result[key] = createSchemaExample(properties[key]);
    }
    return result;
  }
  if (type === 'array') return [createSchemaExample(schema.items)];
  if (type === 'integer') return schema.minimum ?? 1;
  if (type === 'number') return schema.minimum ?? 1;
  if (type === 'boolean') return true;
  if (type === 'string') {
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'uuid') return '00000000-0000-4000-8000-000000000000';
    if (schema.format === 'date-time') return '2026-01-01T00:00:00.000Z';
    return 'example';
  }
  return {};
}

export function createInvalidSchemaExample(schema: unknown): unknown | undefined {
  if (!isRecord(schema)) return undefined;
  const type = schemaType(schema);
  if (type === 'object') {
    const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : [];
    if (required.length > 0) return {};
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const firstKey = Object.keys(properties)[0];
    if (firstKey !== undefined) return { [firstKey]: createInvalidSchemaExample(properties[firstKey]) ?? null };
  }
  if (type === 'array') return {};
  if (type === 'integer' || type === 'number') return 'not-a-number';
  if (type === 'boolean') return 'not-a-boolean';
  if (type === 'string') return 12345;
  return undefined;
}

function schemaType(schema: Record<string, unknown>): string | undefined {
  if (typeof schema.type === 'string') return schema.type;
  if (Array.isArray(schema.type)) return schema.type.find((entry): entry is string => typeof entry === 'string');
  if (schema.properties !== undefined) return 'object';
  if (schema.items !== undefined) return 'array';
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
