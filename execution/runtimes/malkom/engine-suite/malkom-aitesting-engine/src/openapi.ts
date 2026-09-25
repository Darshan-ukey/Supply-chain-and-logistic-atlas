import { readFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { createInvalidSchemaExample, createSchemaExample } from './schema.js';
import type { DiscoveryApiRoute, OpenApiDocumentSummary, OpenApiOperationSummary } from './types.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

type JsonRecord = Record<string, unknown>;

export async function loadOpenApiSummary(path: string): Promise<OpenApiDocumentSummary> {
  const raw = await readFile(path, 'utf8');
  const parsed = parseOpenApiSource(path, raw);
  return summarizeOpenApiDocument(path, parsed.document, parsed.format);
}

export function summarizeOpenApiDocument(path: string, document: unknown, format: 'json' | 'yaml' = 'json'): OpenApiDocumentSummary {
  const diagnostics: string[] = [];
  if (!isRecord(document)) {
    return {
      schemaVersion: 'brisk-aitesting.openapi-summary.v1',
      path,
      format,
      operations: [],
      diagnostics: ['OpenAPI document must be a JSON object.'],
    };
  }

  const info = isRecord(document.info) ? document.info : undefined;
  const paths = isRecord(document.paths) ? document.paths : undefined;
  const operations: OpenApiOperationSummary[] = [];

  if (paths === undefined) {
    diagnostics.push('OpenAPI document does not define a paths object.');
  } else {
    for (const [operationPath, pathItem] of Object.entries(paths)) {
      if (!isRecord(pathItem)) {
        diagnostics.push(`Path item ${operationPath} is not an object.`);
        continue;
      }
      for (const [rawMethod, operation] of Object.entries(pathItem)) {
        const method = rawMethod.toLowerCase();
        if (!HTTP_METHODS.has(method)) continue;
        if (!isRecord(operation)) {
          diagnostics.push(`${rawMethod.toUpperCase()} ${operationPath} operation is not an object.`);
          continue;
        }
        operations.push(summarizeOperation(operationPath, method.toUpperCase(), operation, document));
      }
    }
  }

  if (operations.length === 0) diagnostics.push('OpenAPI document did not expose any HTTP operations.');

  return {
    schemaVersion: 'brisk-aitesting.openapi-summary.v1',
    path,
    format,
    ...(typeof info?.title === 'string' ? { title: info.title } : {}),
    ...(typeof info?.version === 'string' ? { version: info.version } : {}),
    ...(typeof document.openapi === 'string'
      ? { openapiVersion: document.openapi }
      : typeof document.swagger === 'string'
        ? { openapiVersion: document.swagger }
        : {}),
    operations,
    diagnostics,
  };
}

export function openApiOperationsToDiscoveryRoutes(summary: OpenApiDocumentSummary): readonly DiscoveryApiRoute[] {
  return summary.operations.map((operation) => ({
    method: operation.method,
    path: operation.path,
    source: 'contract',
    confidence: 0.95,
    ...(operation.operationId !== undefined ? { operationId: operation.operationId } : {}),
    ...(operation.summary !== undefined ? { summary: operation.summary } : {}),
    ...(operation.tags.length > 0 ? { tags: operation.tags } : {}),
    contractPath: summary.path,
    ...(operation.statusCodes.length > 0 ? { statusCodes: operation.statusCodes } : {}),
    requestBodyRequired: operation.requestBodyRequired,
  }));
}

function parseOpenApiSource(path: string, raw: string): { readonly document: unknown; readonly format: 'json' | 'yaml' } {
  if (/\.ya?ml$/i.test(path)) {
    const parsed = parseDocument(raw, { prettyErrors: false });
    if (parsed.errors.length > 0) {
      throw parsed.errors[0] ?? new Error('YAML parse failed.');
    }
    return { document: parsed.toJSON(), format: 'yaml' };
  }
  return { document: JSON.parse(raw) as unknown, format: 'json' };
}

function summarizeOperation(path: string, method: string, operation: JsonRecord, document: JsonRecord): OpenApiOperationSummary {
  const requestBody = isRecord(operation.requestBody) ? operation.requestBody : undefined;
  const responses = isRecord(operation.responses) ? operation.responses : undefined;
  const requestSchema = resolveSchema(firstContentSchema(requestBody), document);
  const requestExample = requestSchema === undefined ? undefined : createSchemaExample(requestSchema);
  const invalidRequestExample = requestSchema === undefined ? undefined : createInvalidSchemaExample(requestSchema);

  return {
    method,
    path,
    ...(typeof operation.operationId === 'string' ? { operationId: operation.operationId } : {}),
    ...(typeof operation.summary === 'string' ? { summary: operation.summary } : {}),
    tags: Array.isArray(operation.tags) ? operation.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    statusCodes: summarizeStatusCodes(responses),
    requestBodyRequired: requestBody?.required === true,
    requestContentTypes: summarizeContentTypes(requestBody),
    ...(requestSchema !== undefined ? { requestSchema } : {}),
    ...(requestExample !== undefined ? { requestExample } : {}),
    ...(invalidRequestExample !== undefined ? { invalidRequestExample } : {}),
    responseContentTypes: summarizeResponseContentTypes(responses),
    responseSchemas: summarizeResponseSchemas(responses, document),
  };
}

function summarizeStatusCodes(responses: JsonRecord | undefined): readonly number[] {
  if (responses === undefined) return [];
  return Object.keys(responses)
    .map((status) => Number(status))
    .filter((status) => Number.isInteger(status) && status >= 100 && status <= 599)
    .sort((left, right) => left - right);
}

function summarizeContentTypes(value: JsonRecord | undefined): readonly string[] {
  const content = isRecord(value?.content) ? value.content : undefined;
  return content === undefined ? [] : Object.keys(content).sort();
}

function summarizeResponseContentTypes(responses: JsonRecord | undefined): readonly string[] {
  if (responses === undefined) return [];
  const contentTypes = new Set<string>();
  for (const response of Object.values(responses)) {
    if (!isRecord(response)) continue;
    for (const contentType of summarizeContentTypes(response)) {
      contentTypes.add(contentType);
    }
  }
  return [...contentTypes].sort();
}

function summarizeResponseSchemas(responses: JsonRecord | undefined, document: JsonRecord): readonly {
  readonly statusCode: number;
  readonly contentType?: string;
  readonly schema?: unknown;
}[] {
  if (responses === undefined) return [];
  const result: {
    readonly statusCode: number;
    readonly contentType?: string;
    readonly schema?: unknown;
  }[] = [];
  for (const [status, response] of Object.entries(responses)) {
    const statusCode = Number(status);
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599 || !isRecord(response)) continue;
    const content = isRecord(response.content) ? response.content : {};
    for (const [contentType, mediaType] of Object.entries(content)) {
      const schema = resolveSchema(isRecord(mediaType) ? mediaType.schema : undefined, document);
      result.push({
        statusCode,
        contentType,
        ...(schema !== undefined ? { schema } : {}),
      });
    }
    if (Object.keys(content).length === 0) result.push({ statusCode });
  }
  return result.sort((left, right) => left.statusCode - right.statusCode || (left.contentType ?? '').localeCompare(right.contentType ?? ''));
}

function firstContentSchema(value: JsonRecord | undefined): unknown {
  const content = isRecord(value?.content) ? value.content : undefined;
  if (content === undefined) return undefined;
  const jsonEntry = content['application/json'];
  if (isRecord(jsonEntry) && jsonEntry.schema !== undefined) return jsonEntry.schema;
  for (const mediaType of Object.values(content)) {
    if (isRecord(mediaType) && mediaType.schema !== undefined) return mediaType.schema;
  }
  return undefined;
}

function resolveSchema(schema: unknown, document: JsonRecord, seenRefs = new Set<string>()): unknown {
  if (!isRecord(schema)) return schema;
  if (typeof schema.$ref === 'string') {
    if (seenRefs.has(schema.$ref)) return schema;
    const resolved = resolveLocalRef(schema.$ref, document);
    if (resolved === undefined) return schema;
    return resolveSchema(resolved, document, new Set([...seenRefs, schema.$ref]));
  }
  if (schema.allOf !== undefined && Array.isArray(schema.allOf)) {
    return {
      ...schema,
      allOf: schema.allOf.map((entry) => resolveSchema(entry, document, seenRefs)),
    };
  }
  if (schema.oneOf !== undefined && Array.isArray(schema.oneOf)) {
    return {
      ...schema,
      oneOf: schema.oneOf.map((entry) => resolveSchema(entry, document, seenRefs)),
    };
  }
  if (schema.anyOf !== undefined && Array.isArray(schema.anyOf)) {
    return {
      ...schema,
      anyOf: schema.anyOf.map((entry) => resolveSchema(entry, document, seenRefs)),
    };
  }
  if (isRecord(schema.items)) {
    return {
      ...schema,
      items: resolveSchema(schema.items, document, seenRefs),
    };
  }
  if (isRecord(schema.properties)) {
    return {
      ...schema,
      properties: Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, resolveSchema(value, document, seenRefs)])),
    };
  }
  return schema;
}

function resolveLocalRef(ref: string, document: JsonRecord): unknown {
  if (!ref.startsWith('#/')) return undefined;
  return ref
    .slice(2)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((current, segment) => (isRecord(current) ? current[segment] : undefined), document);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
