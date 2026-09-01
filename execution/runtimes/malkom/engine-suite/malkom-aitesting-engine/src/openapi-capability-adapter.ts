import SwaggerParser from '@apidevtools/swagger-parser';
import { sample } from 'openapi-sampler';
import type {
  CapabilityAdapter,
  EvidenceGraph,
  EvidenceAuthority,
  EvidenceOperation,
  EvidenceOutcome,
  EvidenceValueSlot,
  ValueGenerationPolicy,
  WorkflowValueBinding,
} from './compiler-types.js';
import { createEvidenceGraph } from './semantic-compiler.js';
import type { ApiCleanupStep, ScenarioPlan, WorkflowCapture } from './types.js';
import { captureNameFromSemanticType, scopedCaptureName } from './workflow-values.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

interface OpenApiBindingInput {
  readonly slotId: string;
  readonly location: 'path' | 'query' | 'header' | 'body' | 'expect.json';
  readonly name: string;
}

interface OpenApiBindingOutput {
  readonly slotId: string;
  readonly from: 'response.body' | 'response.header';
  readonly path: string;
}

interface OpenApiOperationBinding {
  readonly kind: 'openapi-operation';
  readonly method: string;
  readonly path: string;
  readonly inputs: readonly OpenApiBindingInput[];
  readonly outputs: readonly OpenApiBindingOutput[];
  readonly requestExample?: unknown;
  readonly successStatuses: readonly number[];
  readonly expectedJson?: Record<string, unknown>;
  readonly unchanged?: readonly import('./types.js').ApiStateSnapshotExpectation[];
}

type JsonRecord = Record<string, unknown>;

export interface HttpOperationContract {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly name: string;
  readonly action: string;
  readonly resource: string;
  readonly sideEffect: EvidenceOperation['sideEffect'];
  readonly inputs?: readonly {
    readonly id: string;
    readonly name: string;
    readonly location: OpenApiBindingInput['location'];
    readonly semanticType: string;
    readonly required: boolean;
    readonly schema?: unknown;
    readonly generation?: EvidenceValueSlot['generation'];
    readonly secretRef?: string;
  }[];
  readonly outputs?: readonly {
    readonly id: string;
    readonly name: string;
    readonly semanticType: string;
    readonly from: OpenApiBindingOutput['from'];
    readonly path: string;
    readonly schema?: unknown;
  }[];
  readonly successStatuses: readonly number[];
  readonly requestExample?: unknown;
  readonly expectedJson?: Record<string, unknown>;
  readonly unchanged?: readonly import('./types.js').ApiStateSnapshotExpectation[];
  readonly cleanupOperationId?: string;
  readonly authority: EvidenceAuthority;
  readonly source: string;
}

export class OpenApiCapabilityAdapter implements CapabilityAdapter {
  readonly id: string = 'openapi';
  readonly capabilities = ['api.http'] as const;

  async collect(context: Parameters<NonNullable<CapabilityAdapter['collect']>>[0]): Promise<EvidenceGraph | undefined> {
    const path = context.config.contracts?.openApiPath;
    return path === undefined ? undefined : this.loadEvidence(path);
  }

  async loadEvidence(path: string): Promise<EvidenceGraph> {
    const document = await SwaggerParser.validate(path);
    const operations = operationsFromDocument(document as unknown as JsonRecord, path);
    return createEvidenceGraph(withCleanupRelationships(operations), []);
  }

  validateBinding(operation: EvidenceOperation): readonly string[] {
    const binding = operation.binding;
    if (!isOpenApiBinding(binding)) return ['binding must be an OpenAPI operation binding'];
    const issues: string[] = [];
    if (!binding.path.startsWith('/')) issues.push('path must begin with /');
    if (!HTTP_METHODS.has(binding.method.toLowerCase())) issues.push(`unsupported HTTP method ${binding.method}`);
    if (binding.successStatuses.length === 0) issues.push('at least one successful response status is required');
    return issues;
  }

  lower(params: Parameters<CapabilityAdapter['lower']>[0]): readonly Omit<ScenarioPlan, 'id'>[] {
    const binding = params.operation.binding;
    if (!isOpenApiBinding(binding)) throw new Error(`Operation ${params.operation.id} has an invalid OpenAPI binding.`);
    const workflowBindings = new Map(params.step.inputs.map((input) => [input.inputSlotId, input.value]));
    let path = binding.path;
    const headers: Record<string, string> = {};
    const query: Record<string, string | number | boolean> = {};
    const body = cloneValue(binding.requestExample) ?? (binding.inputs.some((input) => input.location === 'body') ? {} : undefined);
    const expectedJson = (cloneValue(binding.expectedJson) ?? {}) as Record<string, unknown>;

    for (const input of binding.inputs) {
      const value = workflowBindings.get(input.slotId);
      if (value === undefined) continue;
      const loweredValue = lowerValue(value);
      if (input.location === 'path') {
        path = replacePathParameter(path, input.name, loweredValue);
      } else if (input.location === 'header') {
        headers[input.name] = String(loweredValue);
      } else if (input.location === 'query') {
        if (typeof loweredValue === 'string' || typeof loweredValue === 'number' || typeof loweredValue === 'boolean') query[input.name] = loweredValue;
      } else if (input.location === 'expect.json') {
        // A response check may only name a field the operation's declared
        // outputs prove exists. A check on an unproven field can never pass
        // and would report a false failure against a healthy application.
        // (Only enforceable when the operation declares its outputs at all.)
        const provenFields = new Set([
          ...params.operation.outputs.flatMap((output) => [output.name, output.id]),
          ...binding.outputs.map((output) => output.path),
        ]);
        if (params.operation.outputs.length > 0 && !provenFields.has(input.name)) {
          throw new Error(`Operation ${params.operation.id} declares response check field "${input.name}", but its declared outputs only prove: ${[...provenFields].filter(Boolean).join(', ')}. Fix the evidence declaration so checks match the real answer shape.`);
        }
        expectedJson[input.name] = loweredValue;
      } else {
        setObjectPath(body, input.name, loweredValue);
      }
    }

    const captures: WorkflowCapture[] = binding.outputs
      .filter((output) => params.step.captures.some((capture) => capture.outputSlotId === output.slotId))
      .map((output) => ({
        name: scopedCaptureName(params.step.id, semanticTypeForSlot(params.operation, output.slotId)),
        from: output.from,
        path: output.path,
      }));
    const seenCaptureNames = new Set<string>();
    for (const capture of captures) {
      if (seenCaptureNames.has(capture.name)) {
        throw new Error(`Step ${params.step.id} would capture two outputs under the same name "${capture.name}"; the adapter cannot keep them apart. Give the outputs distinct semantic types.`);
      }
      seenCaptureNames.add(capture.name);
    }
    const firstStatus = binding.successStatuses[0];
    if (firstStatus === undefined) throw new Error(`Operation ${params.operation.id} declares no successful response status.`);
    const status = binding.successStatuses.length === 1 ? firstStatus : binding.successStatuses;
    return [{
      name: params.operation.name,
      type: 'api',
      objective: `${params.operation.action} ${params.operation.resource} using operation ${params.operation.id}.`,
      target: {
        method: binding.method,
        path,
        sourceOfTruth: params.operation.provenance.some((entry) => entry.authority === 'contract') ? 'contract' : 'observed',
      },
      ...((Object.keys(headers).length > 0 || Object.keys(query).length > 0 || hasBody(body))
        ? {
            request: {
              ...(Object.keys(headers).length > 0 ? { headers } : {}),
              ...(Object.keys(query).length > 0 ? { query } : {}),
              ...(hasBody(body) ? { body } : {}),
            },
          }
        : {}),
      expect: {
        status,
        ...(Object.keys(expectedJson).length > 0 ? { json: expectedJson } : {}),
        ...(binding.unchanged !== undefined ? { unchanged: binding.unchanged } : {}),
      },
      assertions: params.step.expectedOutcomeIds.map((id) => params.operation.outcomes.find((outcome) => outcome.id === id)?.meaning ?? id),
      ...(captures.length > 0 ? { capture: captures } : {}),
      evidenceRequired: ['api', 'schema'],
      metadata: {
        evidenceSource: params.operation.provenance[0]?.source,
        operationId: params.operation.id,
      },
    }];
  }

  lowerCleanup(params: Parameters<NonNullable<CapabilityAdapter['lowerCleanup']>>[0]): ApiCleanupStep {
    const binding = params.operation.binding;
    if (!isOpenApiBinding(binding)) throw new Error(`Cleanup operation ${params.operation.id} has an invalid OpenAPI binding.`);
    if (binding.method !== 'DELETE' && binding.method !== 'POST') {
      throw new Error(`Cleanup operation ${params.operation.id} must use DELETE or POST.`);
    }
    const workflowBindings = new Map(params.step.inputs.map((input) => [input.inputSlotId, input.value]));
    let path = binding.path;
    const headers: Record<string, string> = {};
    const query: Record<string, string | number | boolean> = {};
    const body = cloneValue(binding.requestExample) ?? (binding.inputs.some((input) => input.location === 'body') ? {} : undefined);
    for (const input of binding.inputs) {
      const value = workflowBindings.get(input.slotId);
      if (value === undefined) continue;
      const loweredValue = lowerValue(value);
      if (input.location === 'path') {
        path = replacePathParameter(path, input.name, loweredValue);
      } else if (input.location === 'header') {
        headers[input.name] = String(loweredValue);
      } else if (input.location === 'query') {
        if (typeof loweredValue === 'string' || typeof loweredValue === 'number' || typeof loweredValue === 'boolean') query[input.name] = loweredValue;
      } else {
        setObjectPath(body, input.name, loweredValue);
      }
    }
    const firstStatus = binding.successStatuses[0];
    if (firstStatus === undefined) throw new Error(`Cleanup operation ${params.operation.id} declares no successful response status.`);
    return {
      type: 'api',
      target: { method: binding.method, path },
      ...((Object.keys(headers).length > 0 || Object.keys(query).length > 0 || hasBody(body))
        ? {
            request: {
              ...(Object.keys(headers).length > 0 ? { headers } : {}),
              ...(Object.keys(query).length > 0 ? { query } : {}),
              ...(hasBody(body) ? { body } : {}),
            },
          }
        : {}),
      expect: { status: binding.successStatuses.length === 1 ? firstStatus : binding.successStatuses },
    };
  }
}

export class HostHttpCapabilityAdapter extends OpenApiCapabilityAdapter {
  override readonly id: string = 'host-http';
}

export function createHttpEvidenceGraph(
  contracts: readonly HttpOperationContract[],
  adapterId = 'host-http',
): EvidenceGraph {
  return createEvidenceGraph(contracts.map((contract): EvidenceOperation => {
    const inputs = contract.inputs ?? [];
    const outputs = contract.outputs ?? [];
    return {
      id: contract.operationId,
      adapterId,
      capability: 'api.http',
      name: contract.name,
      action: contract.action,
      resource: contract.resource,
      sideEffect: contract.sideEffect,
      inputs: inputs.map((input) => ({
        id: input.id,
        name: input.name,
        semanticType: input.semanticType,
        required: input.required,
        ...(input.schema !== undefined ? { schema: input.schema } : {}),
        ...(input.generation !== undefined ? { generation: input.generation } : {}),
        ...(input.secretRef !== undefined ? { secretRef: input.secretRef } : {}),
      })),
      outputs: outputs.map((output) => ({
        id: output.id,
        name: output.name,
        semanticType: output.semanticType,
        required: false,
        ...(output.schema !== undefined ? { schema: output.schema } : {}),
      })),
      outcomes: contract.successStatuses.map((status) => ({
        id: `status.${status}`,
        meaning: `${contract.action} ${contract.resource} succeeds with status ${status}`,
        successful: true,
        binding: { status },
      })),
      provenance: [{
        authority: contract.authority,
        source: contract.source,
        confidence: 1,
      }],
      binding: {
        kind: 'openapi-operation',
        method: contract.method.toUpperCase(),
        path: contract.path,
        inputs: inputs.map((input) => ({
          slotId: input.id,
          location: input.location,
          name: input.name,
        })),
        outputs: outputs.map((output) => ({
          slotId: output.id,
          from: output.from,
          path: output.path,
        })),
        ...(contract.requestExample !== undefined ? { requestExample: contract.requestExample } : {}),
        successStatuses: contract.successStatuses,
        ...(contract.expectedJson !== undefined ? { expectedJson: contract.expectedJson } : {}),
        ...(contract.unchanged !== undefined ? { unchanged: contract.unchanged } : {}),
      } satisfies OpenApiOperationBinding,
      ...(contract.cleanupOperationId !== undefined ? { cleanupOperationId: contract.cleanupOperationId } : {}),
    };
  }));
}

function operationsFromDocument(document: JsonRecord, source: string): readonly EvidenceOperation[] {
  const paths = isRecord(document.paths) ? document.paths : {};
  const operations: EvidenceOperation[] = [];
  for (const [path, rawPathItem] of Object.entries(paths)) {
    if (!isRecord(rawPathItem)) continue;
    for (const [rawMethod, rawOperation] of Object.entries(rawPathItem)) {
      const method = rawMethod.toLowerCase();
      if (!HTTP_METHODS.has(method) || !isRecord(rawOperation)) continue;
      operations.push(operationFromOpenApi({
        document,
        path,
        pathItem: rawPathItem,
        method: method.toUpperCase(),
        operation: rawOperation,
        source,
      }));
    }
  }
  return operations;
}

function operationFromOpenApi(params: {
  readonly document: JsonRecord;
  readonly path: string;
  readonly pathItem: JsonRecord;
  readonly method: string;
  readonly operation: JsonRecord;
  readonly source: string;
}): EvidenceOperation {
  const operationId = typeof params.operation.operationId === 'string'
    ? params.operation.operationId
    : `${params.method.toLowerCase()}_${params.path.replace(/[^A-Za-z0-9]+/g, '_')}`;
  const resource = inferResource(params.operation, params.path);
  const action = inferAction(operationId, params.method, resource, params.path);
  const parameterRecords = [...recordArray(params.pathItem.parameters), ...recordArray(params.operation.parameters)];
  const inputSlots: EvidenceValueSlot[] = [];
  const bindingInputs: OpenApiBindingInput[] = [];

  for (const parameter of parameterRecords) {
    const name = typeof parameter.name === 'string' ? parameter.name : undefined;
    const location = parameter.in;
    if (name === undefined || !['path', 'query', 'header'].includes(String(location))) continue;
    const semanticType = semanticTypeForField(resource, name);
    const slotId = `${String(location)}.${name}`;
    inputSlots.push({
      id: slotId,
      name,
      semanticType,
      required: parameter.required === true || location === 'path',
      ...(isRecord(parameter.schema) ? { schema: parameter.schema } : {}),
      ...generationFromSchema(parameter.schema),
    });
    bindingInputs.push({ slotId, location: location as 'path' | 'query' | 'header', name });
  }

  const requestBody = isRecord(params.operation.requestBody) ? params.operation.requestBody : undefined;
  const requestSchema = contentSchema(requestBody);
  const requestExample = requestSchema === undefined
    ? undefined
    : sample(requestSchema as never, { skipReadOnly: true, skipNonRequired: true }, params.document);
  if (isRecord(requestSchema)) {
    const properties = isRecord(requestSchema.properties) ? requestSchema.properties : {};
    const required = new Set(stringArray(requestSchema.required));
    for (const [name, schema] of Object.entries(properties)) {
      if (!required.has(name)) continue;
      const slotId = `body.${name}`;
      inputSlots.push({
        id: slotId,
        name,
        semanticType: semanticTypeForField(resource, name),
        required: true,
        schema,
        ...generationFromSchema(schema),
      });
      bindingInputs.push({ slotId, location: 'body', name });
    }
  }

  const responses = isRecord(params.operation.responses) ? params.operation.responses : {};
  const successStatuses = Object.keys(responses)
    .map(Number)
    .filter((status) => Number.isInteger(status) && status >= 200 && status < 300)
    .sort((left, right) => left - right);
  const outputSlots: EvidenceValueSlot[] = [];
  const bindingOutputs: OpenApiBindingOutput[] = [];
  for (const status of successStatuses) {
    const response = responses[String(status)];
    if (!isRecord(response)) continue;
    const schema = contentSchema(response);
    if (!isRecord(schema)) continue;
    for (const output of responseOutputs(schema, resource)) {
      const slotId = `response.${output.path}`;
      if (outputSlots.some((slot) => slot.id === slotId)) continue;
      outputSlots.push({
        id: slotId,
        name: output.name,
        semanticType: output.semanticType,
        required: false,
        schema: output.schema,
      });
      bindingOutputs.push({ slotId, from: 'response.body', path: toJsonPath(output.path) });
    }
  }
  const outcomes: EvidenceOutcome[] = successStatuses.map((status) => ({
    id: `status.${status}`,
    meaning: `${action} ${resource} succeeds with status ${status}`,
    successful: true,
    binding: { status },
  }));
  const binding: OpenApiOperationBinding = {
    kind: 'openapi-operation',
    method: params.method,
    path: params.path,
    inputs: bindingInputs,
    outputs: bindingOutputs,
    ...(requestExample !== undefined ? { requestExample } : {}),
    successStatuses,
  };
  return {
    id: operationId,
    adapterId: 'openapi',
    capability: 'api.http',
    name: typeof params.operation.summary === 'string' ? params.operation.summary : `${params.method} ${params.path}`,
    action,
    resource,
    sideEffect: sideEffectForMethod(params.method),
    inputs: inputSlots,
    outputs: outputSlots,
    outcomes,
    provenance: [{ authority: 'contract', source: params.source, confidence: 1 }],
    binding,
  };
}

function withCleanupRelationships(operations: readonly EvidenceOperation[]): readonly EvidenceOperation[] {
  const deleteOperations = operations.filter((operation) => operation.sideEffect === 'delete');
  return operations.map((operation) => {
    if (operation.sideEffect !== 'create') return operation;
    const cleanup = deleteOperations.find((candidate) => (
      candidate.resource === operation.resource
      && candidate.inputs.some((input) => input.semanticType === `${normalizeToken(operation.resource)}.id`)
    ));
    return cleanup === undefined ? operation : { ...operation, cleanupOperationId: cleanup.id };
  });
}

function inferAction(operationId: string, method: string, resource: string, path: string): string {
  if (resource === 'message' || resource === 'event') {
    if (method === 'POST') return 'publish';
    if (method === 'GET' && /subscriptions?|consumers?/i.test(path)) return 'consume';
  }
  const first = operationId.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean)[0]?.toLowerCase();
  if (first !== undefined && ['create', 'add', 'register', 'publish', 'send', 'get', 'list', 'read', 'update', 'patch', 'delete', 'remove', 'consume', 'subscribe'].includes(first)) {
    return first;
  }
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'read';
}

function inferResource(operation: JsonRecord, path: string): string {
  if (typeof operation.operationId === 'string') {
    const operationTokens = operation.operationId
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean);
    const candidate = operationTokens.at(-1);
    if (candidate !== undefined && !['create', 'add', 'register', 'publish', 'send', 'get', 'list', 'read', 'update', 'patch', 'delete', 'remove', 'consume', 'subscribe'].includes(candidate.toLowerCase())) {
      return normalizeToken(candidate);
    }
  }
  const segments = path.split('/').filter((segment) => segment.length > 0 && !segment.startsWith('{') && segment !== 'api');
  const pathResource = segments.at(-1);
  if (pathResource !== undefined) return normalizeToken(pathResource);
  const tag = stringArray(operation.tags)[0];
  return normalizeToken(tag ?? 'resource');
}

function semanticTypeForField(resource: string, field: string): string {
  const normalizedField = normalizeToken(field);
  const normalizedResource = normalizeToken(resource);
  if (normalizedField === 'id' || normalizedField === `${normalizedResource}.id` || normalizedField === `${normalizedResource}id`) {
    return `${normalizedResource}.id`;
  }
  const fieldParts = normalizedField.split('.').filter(Boolean);
  if (fieldParts.at(-1) === 'id') {
    const owner = fieldParts.slice(0, -1).join('.') || normalizedResource;
    return `${owner}.id`;
  }
  return `${normalizedResource}.${normalizedField}`;
}

function responseOutputs(
  schema: JsonRecord,
  resource: string,
  prefix = '',
  depth = 0,
): readonly { readonly name: string; readonly path: string; readonly semanticType: string; readonly schema: unknown }[] {
  if (depth > 4 || !isRecord(schema.properties)) return [];
  const outputs: { readonly name: string; readonly path: string; readonly semanticType: string; readonly schema: unknown }[] = [];
  for (const [name, propertySchema] of Object.entries(schema.properties)) {
    const path = prefix.length === 0 ? name : `${prefix}.${name}`;
    if (isRecord(propertySchema) && (propertySchema.type === 'object' || isRecord(propertySchema.properties))) {
      const nestedResource = name === 'data' || name === 'item' || name === 'result' ? resource : normalizeToken(name);
      outputs.push(...responseOutputs(propertySchema, nestedResource, path, depth + 1));
      continue;
    }
    outputs.push({
      name,
      path,
      semanticType: semanticTypeForField(resource, name),
      schema: propertySchema,
    });
  }
  return outputs;
}

function generationFromSchema(schema: unknown): {} | { readonly generation: ValueGenerationPolicy } {
  if (!isRecord(schema)) return {};
  if (schema.const !== undefined) return { generation: { kind: 'constant', value: schema.const } };
  if (Array.isArray(schema.enum) && schema.enum[0] !== undefined) return { generation: { kind: 'constant', value: schema.enum[0] } };
  if (schema.default !== undefined) return { generation: { kind: 'constant', value: schema.default } };
  if (schema.example !== undefined) return { generation: { kind: 'constant', value: schema.example } };
  if (schema.format === 'uuid') return { generation: { kind: 'uuid' } };
  if (schema.format === 'date-time') return { generation: { kind: 'timestamp' } };
  if (schema.type === 'string') return { generation: { kind: 'unique-string' } };
  const generated = sample(schema as never, { skipReadOnly: true, skipNonRequired: true });
  return generated === undefined ? {} : { generation: { kind: 'constant', value: generated } };
}

function lowerValue(value: WorkflowValueBinding): unknown {
  if (value.kind === 'intent') return value.value;
  if (value.kind === 'fixture') return `<fixture:${value.fixture}>`;
  if (value.kind === 'secret') return `<secret:${value.secretRef}>`;
  // The placeholder carries the producing step's identity, so a consumer can
  // never pick up a same-typed value produced by a different step.
  if (value.kind === 'output') return `<${scopedCaptureName(value.stepId, value.semanticType)}>`;
  if (value.generation.kind === 'constant') return value.generation.value;
  if (value.generation.kind === 'uuid') return '<uuid>';
  if (value.generation.kind === 'timestamp') return '<timestamp>';
  return `${value.generation.prefix ?? captureNameFromSemanticType(value.semanticType)}-<unique>`;
}

function semanticTypeForSlot(operation: EvidenceOperation, slotId: string): string {
  const slot = operation.outputs.find((output) => output.id === slotId);
  return slot?.semanticType ?? slotId;
}

function contentSchema(container: JsonRecord | undefined): unknown {
  const content = isRecord(container?.content) ? container.content : undefined;
  if (content === undefined) return undefined;
  const json = content['application/json'];
  if (isRecord(json) && json.schema !== undefined) return json.schema;
  for (const media of Object.values(content)) {
    if (isRecord(media) && media.schema !== undefined) return media.schema;
  }
  return undefined;
}

function sideEffectForMethod(method: string): EvidenceOperation['sideEffect'] {
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'read';
}

function cloneValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function setObjectPath(target: unknown, name: string, value: unknown): void {
  if (!isRecord(target)) return;
  target[name] = value;
}

function hasBody(value: unknown): boolean {
  return value !== undefined && (!isRecord(value) || Object.keys(value).length > 0);
}

function isOpenApiBinding(value: unknown): value is OpenApiOperationBinding {
  return isRecord(value)
    && value.kind === 'openapi-operation'
    && typeof value.method === 'string'
    && typeof value.path === 'string'
    && Array.isArray(value.inputs)
    && Array.isArray(value.outputs)
    && Array.isArray(value.successStatuses);
}

function recordArray(value: unknown): readonly JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function normalizeToken(value: string): string {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('.');
  if (normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) return normalized.slice(0, -1);
  return normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePathParameter(path: string, name: string, value: unknown): string {
  return path
    .replace(new RegExp(`\\{${escapeRegExp(name)}\\}`, 'g'), String(value))
    .replace(new RegExp(`:${escapeRegExp(name)}(?=/|$)`, 'g'), String(value));
}

function toJsonPath(path: string): string {
  return `$${path.split('.').map((segment) => `['${segment.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`).join('')}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
