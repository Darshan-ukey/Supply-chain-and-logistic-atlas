import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult } from '../types.js';
import { apiUrl, assertContractStatus, assertJsonShape, assertResponseSchema, assertStatus, authHeaders, contractRouteEvidence, deepEqual, findContractOperation, findContractRoute, getPath, headersToRecord, isHostAllowed, parseJsonOrNull, redactHeaders, redactValue, scenarioEvidence, scenarioResult, serializeBody, type HeaderRecord } from './shared.js';
import { angleReferencePattern, braceReferencePattern } from '../workflow-values.js';
export class BuiltinApiEngine implements Engine {
  readonly name = 'builtin-api-engine';
  readonly type = 'api' as const;

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'api';
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'api');
    await mkdir(dir, { recursive: true });
    const artifactPath = join(dir, `${context.scenario.id}.request-response.json`);
    const variables = context.runState?.variables ?? {};
    const resolvedPath = resolveWorkflowPath(context.scenario.target?.path ?? '/', variables);
    const resolvedRequest = resolveWorkflowRequest(context.scenario.request, variables);
    const resolvedExpectedJson = resolveWorkflowValue(context.scenario.expect?.json, variables);
    const unresolvedVariables = [...resolvedPath.unresolved, ...resolvedRequest.unresolved, ...resolvedExpectedJson.unresolved];
    const url = apiUrl(context, resolvedPath.value, resolvedRequest.value?.query);
    const contractRoute = findContractRoute(context);
    const contractOperation = contractRoute === undefined ? undefined : await findContractOperation(contractRoute);
    const headers: HeaderRecord = {
      ...authHeaders(context.config.auth, context.runState?.authSession),
      ...resolvedRequest.value?.headers,
    };
    const method = context.scenario.target?.method ?? 'GET';
    let status: ScenarioResult['status'] = 'passed';
    let failureCategory: ScenarioResult['failureCategory'];
    const diagnostics: string[] = [];
    const assertions: ScenarioResult['assertions'][number][] = [];
    const stateSnapshots: StateSnapshotEvidence[] = [];
    let responseDurationMs = 0;
    let artifactPayload: unknown = {
      schemaVersion: 'brisk-aitesting.api-evidence.v1',
      scenario: scenarioEvidence(context),
      request: {
        method,
        url: url.toString(),
        headers: redactHeaders(headers, context.config.security.redactSecrets),
        body: redactValue(resolvedRequest.value?.body, context.config.security.redactSecrets),
      },
      response: null,
    };

    if (context.config.runtime.dryRun) {
      status = 'skipped';
      diagnostics.push('Dry run enabled; API request was planned but not executed.');
    } else if (unresolvedVariables.length > 0) {
      status = 'failed';
      const uniqueUnresolved = [...new Set(unresolvedVariables)];
      const shortfalls = preconditionShortfalls(uniqueUnresolved, context);
      // When every producing step succeeded but returned nothing to capture,
      // the app simply had no data to test against. That is a precondition
      // problem, not a dependency failure, and it deserves a real diagnosis
      // instead of a bare "Missing value for step_x.orgId".
      if (shortfalls.length === uniqueUnresolved.length) {
        failureCategory = 'precondition';
        diagnostics.push(`Precondition not met: ${shortfalls.map((entry) => entry.explanation).join(' ')}`);
        assertions.push({
          name: 'required data exists before request execution',
          status: 'failed',
          message: shortfalls.map((entry) => entry.explanation).join(' '),
        });
      } else {
        failureCategory = 'dependency';
        diagnostics.push(`Unresolved workflow variable(s): ${uniqueUnresolved.join(', ')}.`);
        assertions.push({
          name: 'workflow variables are resolved before request execution',
          status: 'failed',
          message: `Missing value for ${uniqueUnresolved.join(', ')}.`,
        });
      }
    } else if (isHostAllowed(url, context.config.security.allowedHosts, context.config.security.networkPolicy)) {
      try {
        for (const snapshot of context.scenario.expect?.unchanged ?? []) {
          stateSnapshots.push({
            name: snapshot.name ?? `${snapshot.target.method ?? 'GET'} ${snapshot.target.path}`,
            expectation: snapshot,
            before: await captureStateSnapshot(context, snapshot, headers, variables),
          });
        }
        // Register compensation before a mutation can create durable state. A failed
        // request may leave no resource; cleanup defaults deliberately accept 404.
        if (context.scenario.cleanup !== undefined && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
          context.runState?.cleanup.push(...context.scenario.cleanup);
        }
        const requestStarted = Date.now();
        const response = await fetch(url, {
          method,
          headers,
          ...(resolvedRequest.value?.body !== undefined ? { body: serializeBody(resolvedRequest.value.body, headers) } : {}),
          signal: AbortSignal.timeout(context.config.runtime.timeoutMs),
        });
        responseDurationMs = Date.now() - requestStarted;
        const responseText = await response.text();
        const responseJson = parseJsonOrNull(responseText);
        if (response.status >= 200 && response.status < 300) {
          captureExplicitWorkflowVariables(context, response, responseJson, variables);
          if (context.config.security.allowHeuristicWorkflowCapture === true) {
            captureHeuristicWorkflowVariables(context, responseJson, variables);
          }
        }
        assertions.push(assertStatus(response.status, context.scenario.expect?.status));
        const contractStatusAssertion = assertContractStatus(response.status, contractRoute, context.scenario.expect?.status);
        if (contractStatusAssertion !== undefined) assertions.push(contractStatusAssertion);
        if (context.scenario.expect?.json !== undefined) {
          assertions.push(...assertJsonShape(responseJson, resolvedExpectedJson.value as Record<string, unknown>));
        }
        if (context.scenario.expect?.contains !== undefined) {
          assertions.push({
            name: `response contains ${context.scenario.expect.contains}`,
            status: responseText.includes(context.scenario.expect.contains) ? 'passed' : 'failed',
            ...(responseText.includes(context.scenario.expect.contains) ? {} : { message: 'Expected text was not found in response body.' }),
          });
        }
        for (const snapshotEvidence of stateSnapshots) {
          snapshotEvidence.after = await captureStateSnapshot(context, snapshotEvidence.expectation, headers, variables);
          assertions.push(...assertStateUnchanged(snapshotEvidence));
        }
        const responseSchemaAssertion = assertResponseSchema(response.status, response.headers, responseJson, contractOperation);
        if (responseSchemaAssertion !== undefined) assertions.push(responseSchemaAssertion);
        if (assertions.length === 0) {
          assertions.push({ name: 'response status is below 500', status: response.status < 500 ? 'passed' : 'failed' });
        }
        if (assertions.some((assertion) => assertion.status === 'failed')) {
          status = 'failed';
          // The application answered and the answer did not match what was
          // expected. That is an application result, not a harness problem.
          failureCategory = 'application_assertion';
        }
        diagnostics.push(`HTTP ${response.status} ${response.statusText}`);
        artifactPayload = {
          schemaVersion: 'brisk-aitesting.api-evidence.v1',
          scenario: scenarioEvidence(context),
          timing: {
            startedAt: new Date(requestStarted).toISOString(),
            durationMs: responseDurationMs,
          },
          request: {
            method,
            url: url.toString(),
            headers: redactHeaders(headers, context.config.security.redactSecrets),
            body: redactValue(resolvedRequest.value?.body, context.config.security.redactSecrets),
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: redactHeaders(headersToRecord(response.headers), context.config.security.redactSecrets),
            body: redactValue(responseJson ?? responseText, context.config.security.redactSecrets),
          },
          ...(contractRoute !== undefined ? { contract: contractRouteEvidence(contractRoute, contractOperation) } : {}),
          ...(stateSnapshots.length > 0 ? { stateSnapshots: redactValue(stateSnapshots, context.config.security.redactSecrets) } : {}),
          workflow: { variables: redactValue(variables, context.config.security.redactSecrets) },
          assertions,
          diagnostics,
        };
      } catch (error) {
        status = 'error';
        failureCategory = isAbortTimeout(error) ? 'timeout' : 'network';
        diagnostics.push(error instanceof Error ? error.message : String(error));
      }
    } else {
      status = 'skipped';
      diagnostics.push(`Network policy blocked host ${url.hostname}`);
    }

    await writeFile(artifactPath, `${JSON.stringify(artifactPayload, null, 2)}\n`, 'utf8');
    const artifact: ArtifactRef = {
      kind: 'json',
      path: artifactPath,
      label: 'API request/response',
      metadata: {
        schemaVersion: 'brisk-aitesting.api-evidence.v1',
        scenarioId: context.scenario.id,
        method,
        url: url.toString(),
        durationMs: responseDurationMs,
        ...(contractRoute !== undefined ? { contractPath: contractRoute.contractPath, operationId: contractRoute.operationId } : {}),
      },
    };

    return {
      artifacts: [artifact],
      result: scenarioResult(context, {
        engine: this.name,
        status,
        durationMs: Date.now() - started,
        artifacts: [artifact],
        diagnostics,
        ...(assertions.length > 0 ? { assertions } : {}),
        ...(failureCategory !== undefined ? { failureCategory } : {}),
        ...(status === 'passed' || status === 'skipped' ? {} : {
          failureReason: assertions.find((assertion) => assertion.status === 'failed')?.message
            ?? diagnostics.at(-1)
            ?? `${method} ${url.pathname} did not pass.`,
        }),
      }),
    };
  }
}

function isAbortTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

interface PreconditionShortfall {
  readonly variable: string;
  readonly explanation: string;
}

/**
 * An unresolved variable is a precondition shortfall — not a dependency
 * failure — when the scenario that declares its capture already ran and
 * passed: the request succeeded, but its response contained no such value.
 * That happens when the collection being read is empty in the target app.
 */
function preconditionShortfalls(
  unresolved: readonly string[],
  context: EngineContext,
): readonly PreconditionShortfall[] {
  const shortfalls: PreconditionShortfall[] = [];
  for (const variable of unresolved) {
    const producer = context.plan.scenarios.find((scenario) => scenario.capture?.some((capture) => capture.name === variable));
    if (producer === undefined) continue;
    if (context.runState?.scenarioStatus[producer.id] !== 'passed') continue;
    const resource = resourceFromVariableName(variable);
    shortfalls.push({
      variable,
      explanation: `No ${resource} existed to test against: "${producer.name}" completed successfully but its response contained no value for ${variable}.`,
    });
  }
  return shortfalls;
}

function resourceFromVariableName(variable: string): string {
  const localName = variable.split('.').at(-1) ?? variable;
  const withoutIdSuffix = localName.replace(/Id$/u, '').replace(/_id$/iu, '');
  return withoutIdSuffix.length > 0 ? withoutIdSuffix : localName;
}

interface StateSnapshotEvidence {
  readonly name: string;
  readonly expectation: NonNullable<NonNullable<ScenarioPlan['expect']>['unchanged']>[number];
  before: CapturedStateSnapshot;
  after?: CapturedStateSnapshot;
}

interface CapturedStateSnapshot {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly durationMs: number;
}

type WorkflowResolution<T> = {
  readonly value: T;
  readonly unresolved: readonly string[];
};

type ScenarioRequest = ScenarioPlan['request'];
type StateSnapshotRequest = NonNullable<NonNullable<ScenarioPlan['expect']>['unchanged']>[number]['request'];

function resolveWorkflowRequest(request: ScenarioRequest, variables: Record<string, string>): WorkflowResolution<ScenarioRequest> {
  if (request === undefined) return { value: undefined, unresolved: [] };
  const headers = resolveWorkflowValue(request.headers, variables);
  const query = resolveWorkflowValue(request.query, variables);
  const body = resolveWorkflowValue(request.body, variables);
  return {
    value: {
      ...(isStringRecord(headers.value) ? { headers: headers.value } : {}),
      ...(isQueryRecord(query.value) ? { query: query.value } : {}),
      ...(body.value !== undefined ? { body: body.value } : {}),
    },
    unresolved: [...headers.unresolved, ...query.unresolved, ...body.unresolved],
  };
}

function resolveWorkflowSnapshotRequest(request: StateSnapshotRequest, variables: Record<string, string>): WorkflowResolution<StateSnapshotRequest> {
  if (request === undefined) return { value: undefined, unresolved: [] };
  const headers = resolveWorkflowValue(request.headers, variables);
  const query = resolveWorkflowValue(request.query, variables);
  const body = resolveWorkflowValue(request.body, variables);
  return {
    value: {
      ...(isStringRecord(headers.value) ? { headers: headers.value } : {}),
      ...(isQueryRecord(query.value) ? { query: query.value } : {}),
      ...(body.value !== undefined ? { body: body.value } : {}),
    },
    unresolved: [...headers.unresolved, ...query.unresolved, ...body.unresolved],
  };
}

function resolveWorkflowPath(path: string, variables: Record<string, string>): WorkflowResolution<string> {
  const angleResolved = resolveWorkflowString(path, variables);
  const unresolved = [...angleResolved.unresolved];
  const value = angleResolved.value.replace(/([/])\:([A-Za-z_$][A-Za-z0-9_$-]*)/g, (match, slash: string, name: string) => {
    const variable = lookupVariable(variables, name);
    if (variable === undefined) {
      unresolved.push(name);
      return match;
    }
    return `${slash}${encodeURIComponent(variable)}`;
  }).replace(braceReferencePattern(), (match, name: string) => {
    const variable = lookupVariable(variables, name);
    if (variable === undefined) {
      unresolved.push(name);
      return match;
    }
    return encodeURIComponent(variable);
  });
  return { value, unresolved };
}

function resolveWorkflowValue(value: unknown, variables: Record<string, string>): WorkflowResolution<unknown> {
  if (typeof value === 'string') return resolveWorkflowString(value, variables);
  if (Array.isArray(value)) {
    const items = value.map((entry) => resolveWorkflowValue(entry, variables));
    return {
      value: items.map((entry) => entry.value),
      unresolved: items.flatMap((entry) => entry.unresolved),
    };
  }
  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    const unresolved: string[] = [];
    for (const [key, entry] of Object.entries(value)) {
      const resolved = resolveWorkflowValue(entry, variables);
      output[key] = resolved.value;
      unresolved.push(...resolved.unresolved);
    }
    return { value: output, unresolved };
  }
  return { value, unresolved: [] };
}

function resolveWorkflowString(value: string, variables: Record<string, string>): WorkflowResolution<string> {
  const unresolved: string[] = [];
  const replaceToken = (match: string, name: string): string => {
    const builtin = builtinWorkflowValue(name);
    if (builtin !== undefined) return builtin;
    const variable = lookupVariable(variables, name);
    if (variable === undefined) {
      unresolved.push(name);
      return match;
    }
    return variable;
  };
  const secretResolved = value.replace(/<secret:([A-Za-z_][A-Za-z0-9_]*)>/g, (match, name: string) => {
    const secret = process.env[name];
    if (secret === undefined || secret.length === 0) {
      unresolved.push(`secret:${name}`);
      return match;
    }
    return secret;
  });
  const resolved = secretResolved
    .replace(angleReferencePattern(), replaceToken)
    .replace(braceReferencePattern(), replaceToken);
  return { value: resolved, unresolved };
}

function builtinWorkflowValue(name: string): string | undefined {
  const normalized = name.toLowerCase();
  if (normalized === 'uuid') return randomUUID();
  if (normalized === 'unique') return `unique-${randomUUID().slice(0, 8)}`;
  if (normalized === 'timestamp' || normalized === 'now') return String(Date.now());
  return undefined;
}

function lookupVariable(variables: Record<string, string>, name: string): string | undefined {
  // Exact match only. Near-miss spellings must fail loudly rather than
  // silently resolve to a value the plan did not name.
  const value = variables[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

function captureExplicitWorkflowVariables(context: EngineContext, response: Response, responseJson: unknown, variables: Record<string, string>): void {
  for (const capture of context.scenario.capture ?? []) {
    const rawValue = capture.from === 'response.header'
      ? response.headers.get(capture.path)
      : getPath(responseJson, capture.path);
    const value = idValue(rawValue);
    if (value === undefined) continue;
    variables[capture.name] = value;
    if (context.runState !== undefined) {
      context.runState.captures[capture.name] = {
        scenarioId: context.scenario.id,
        source: 'explicit',
        path: `${capture.from}.${capture.path}`,
      };
    }
  }
}

function captureHeuristicWorkflowVariables(context: EngineContext, responseJson: unknown, variables: Record<string, string>): void {
  if (!isRecord(responseJson)) return;
  // Heuristic capture never overwrites any existing value. Overwriting is how
  // two same-named IDs get mixed up, and cleanup then deletes the wrong thing.
  // The old last-write-wins `lastId` alias was removed for the same reason.
  for (const [key, value] of collectIdValues(responseJson)) {
    if (variables[key] !== undefined || context.runState?.captures[key] !== undefined) continue;
    variables[key] = value;
    if (context.runState !== undefined) {
      context.runState.captures[key] = {
        scenarioId: context.scenario.id,
        source: 'heuristic',
        path: `response.body.${key}`,
      };
    }
  }
  const id = idValue(responseJson.id);
  const resourceName = resourceNameForScenario(context.scenario);
  if (id !== undefined && resourceName !== undefined) {
    const alias = `${resourceName}Id`;
    if (variables[alias] === undefined && context.runState?.captures[alias] === undefined) {
      variables[alias] = id;
      if (context.runState !== undefined) {
        context.runState.captures[alias] = {
          scenarioId: context.scenario.id,
          source: 'heuristic',
          path: 'response.body.id',
        };
      }
    }
  }
}

function collectIdValues(value: unknown): readonly [string, string][] {
  if (!isRecord(value)) return [];
  const entries: [string, string][] = [];
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.trim();
    const id = idValue(entry);
    if (id !== undefined && /(^id$|id$)/i.test(normalizedKey)) {
      entries.push([`${normalizedKey.charAt(0).toLowerCase()}${normalizedKey.slice(1)}`, id]);
    }
    if (isRecord(entry)) entries.push(...collectIdValues(entry));
  }
  return entries;
}

function idValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function resourceNameForScenario(scenario: ScenarioPlan): string | undefined {
  const path = scenario.target?.path ?? '';
  const segments = path.split('/').filter((segment) => segment.length > 0 && !segment.startsWith(':'));
  const candidate = [...segments].reverse().find((segment) => segment.toLowerCase() !== 'api');
  const normalized = singularizeResource(candidate);
  if (normalized !== undefined) return normalized;
  const name = scenario.name.toLowerCase();
  for (const resource of ['channel', 'topic', 'subscription', 'message', 'user', 'organization', 'workspace']) {
    if (name.includes(resource)) return resource;
  }
  return undefined;
}

function singularizeResource(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value.startsWith(':')) return undefined;
  const cleaned = value.replace(/[^A-Za-z0-9_$-]/g, '');
  if (cleaned.length === 0) return undefined;
  const lower = cleaned.toLowerCase();
  if (lower.endsWith('ies') && lower.length > 3) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith('s') && lower.length > 1) return lower.slice(0, -1);
  return lower;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isQueryRecord(value: unknown): value is Record<string, string | number | boolean> {
  return isRecord(value) && Object.values(value).every((entry) => (
    typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
  ));
}

async function captureStateSnapshot(
  context: EngineContext,
  snapshot: NonNullable<NonNullable<ScenarioPlan['expect']>['unchanged']>[number],
  inheritedHeaders: HeaderRecord,
  variables: Record<string, string>,
): Promise<CapturedStateSnapshot> {
  const method = snapshot.target.method ?? 'GET';
  const resolvedPath = resolveWorkflowPath(snapshot.target.path, variables);
  const resolvedRequest = resolveWorkflowSnapshotRequest(snapshot.request, variables);
  const unresolvedVariables = [...resolvedPath.unresolved, ...resolvedRequest.unresolved];
  if (unresolvedVariables.length > 0) {
    throw new Error(`Unresolved workflow variable(s): ${[...new Set(unresolvedVariables)].join(', ')}.`);
  }
  const url = new URL(resolvedPath.value, context.config.app.baseUrl);
  for (const [key, value] of Object.entries(resolvedRequest.value?.query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  if (!isHostAllowed(url, context.config.security.allowedHosts, context.config.security.networkPolicy)) {
    throw new Error(`Network policy blocked state snapshot host ${url.hostname}`);
  }
  const headers: HeaderRecord = {
    ...inheritedHeaders,
    ...resolvedRequest.value?.headers,
  };
  const started = Date.now();
  const response = await fetch(url, {
    method,
    headers,
    ...(resolvedRequest.value?.body !== undefined ? { body: serializeBody(resolvedRequest.value.body, headers) } : {}),
    signal: AbortSignal.timeout(context.config.runtime.timeoutMs),
  });
  const text = await response.text();
  return {
    method,
    url: url.toString(),
    status: response.status,
    body: parseJsonOrNull(text) ?? text,
    durationMs: Date.now() - started,
  };
}

function assertStateUnchanged(snapshot: StateSnapshotEvidence): readonly ScenarioResult['assertions'][number][] {
  if (snapshot.after === undefined) {
    return [{ name: `${snapshot.name} state snapshot captured after action`, status: 'failed', message: 'After snapshot was not captured.' }];
  }
  const assertions: ScenarioResult['assertions'][number][] = [
    {
      name: `${snapshot.name} before/after snapshot status unchanged`,
      status: snapshot.before.status === snapshot.after.status ? 'passed' : 'failed',
      ...(snapshot.before.status === snapshot.after.status ? {} : { message: `Expected snapshot status ${snapshot.before.status}, got ${snapshot.after.status}.` }),
    },
  ];
  const expectedPaths = snapshot.expectation.json;
  if (expectedPaths !== undefined) {
    for (const [path, expectedValue] of Object.entries(expectedPaths)) {
      const beforeValue = getPath(snapshot.before.body, path);
      const afterValue = getPath(snapshot.after.body, path);
      const passed = deepEqual(beforeValue, expectedValue) && deepEqual(afterValue, expectedValue);
      assertions.push({
        name: `${snapshot.name} json.${path} remains ${JSON.stringify(expectedValue)}`,
        status: passed ? 'passed' : 'failed',
        ...(passed ? {} : { message: `Before ${JSON.stringify(beforeValue)}, after ${JSON.stringify(afterValue)}, expected ${JSON.stringify(expectedValue)}.` }),
      });
    }
  } else {
    const passed = deepEqual(snapshot.before.body, snapshot.after.body);
    assertions.push({
      name: `${snapshot.name} response body unchanged`,
      status: passed ? 'passed' : 'failed',
      ...(passed ? {} : { message: 'Before and after snapshot bodies differ.' }),
    });
  }
  return assertions;
}



