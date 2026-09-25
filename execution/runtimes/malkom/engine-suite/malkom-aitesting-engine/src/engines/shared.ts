import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, readdir, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { loadOpenApiSummary } from '../openapi.js';
import { redactDeep, redactHeaderRecord } from '../redaction.js';
import { validateJsonSchema } from '../schema.js';
import type { ArtifactRef, DiscoveryApiRoute, EngineContext, OpenApiOperationSummary, ScenarioPlan, ScenarioResult, UiGroundingEvidence } from '../types.js';
import { query as queryJsonPath, type JsonValue } from 'jsonpath-rfc9535';
export type HeaderRecord = Record<string, string>;
export type StatusExpectation = NonNullable<NonNullable<ScenarioPlan['expect']>['status']>;
export function scenarioResult(
  context: EngineContext,
  params: {
    readonly engine: string;
    readonly status: ScenarioResult['status'];
    readonly durationMs: number;
    readonly artifacts?: readonly ArtifactRef[];
    readonly diagnostics: readonly string[];
    readonly assertions?: readonly ScenarioResult['assertions'][number][];
    readonly failureCategory?: ScenarioResult['failureCategory'];
    readonly failureReason?: string;
  },
): ScenarioResult {
  return {
    scenarioId: context.scenario.id,
    name: context.scenario.name,
    type: context.scenario.type,
    engine: params.engine,
    status: params.status,
    durationMs: params.durationMs,
    assertions: params.assertions ?? context.scenario.assertions.map((assertion) => ({
      name: assertion,
      status: params.status === 'passed' ? 'passed' : params.status,
    })),
    artifacts: params.artifacts ?? [],
    diagnostics: params.diagnostics,
    ...(params.failureCategory !== undefined ? { failureCategory: params.failureCategory } : {}),
    ...(params.failureReason !== undefined ? { failureReason: params.failureReason } : {}),
  };
}

export function scenarioEvidence(context: EngineContext): Record<string, unknown> {
  return {
    id: context.scenario.id,
    name: context.scenario.name,
    type: context.scenario.type,
    objective: context.scenario.objective,
  };
}

export function isOpenApiContractPath(contractPath: string, context: EngineContext): boolean {
  if (contractPath === context.config.contracts?.openApiPath) return true;
  if (contractPath === context.config.contracts?.asyncApiPath) return false;
  return /\.(json|ya?ml)$/i.test(contractPath);
}

export function authHeaders(
  auth: EngineContext['config']['auth'],
  session?: import('../auth-session.js').AuthSession,
): HeaderRecord {
  if (session !== undefined) return { ...session.headers };
  if (auth.type === 'bearer') return { authorization: `Bearer ${auth.token}` };
  if (auth.type === 'credentials' || auth.type === 'custom') {
    // Never send a request silently signed out when a sign-in was configured.
    throw new Error(`Sign-in type "${auth.type}" is configured but no session was created for this run. The run must log in before executing tests; this is a product defect if it happens during a normal run.`);
  }
  return {};
}

export function apiUrl(
  context: EngineContext,
  path: string = context.scenario.target?.path ?? '/',
  query: NonNullable<ScenarioPlan['request']>['query'] | undefined = context.scenario.request?.query,
): URL {
  const url = new URL(path, context.config.app.baseUrl);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function findContractRoute(context: EngineContext): DiscoveryApiRoute | undefined {
  const scenarioMethod = (context.scenario.target?.method ?? 'GET').toUpperCase();
  const scenarioPath = context.scenario.target?.path;
  if (scenarioPath === undefined) return undefined;
  return context.plan.discovery.apiRoutes.find((route) => (
    route.source === 'contract'
    && route.method.toUpperCase() === scenarioMethod
    && route.path === scenarioPath
  ));
}

export async function findContractOperation(route: DiscoveryApiRoute): Promise<OpenApiOperationSummary | undefined> {
  if (route.contractPath === undefined) return undefined;
  try {
    const summary = await loadOpenApiSummary(route.contractPath);
    return summary.operations.find((operation) => (
      operation.method.toUpperCase() === route.method.toUpperCase()
      && operation.path === route.path
    ));
  } catch {
    return undefined;
  }
}

export function contractRouteEvidence(route: DiscoveryApiRoute, operation: OpenApiOperationSummary | undefined): Record<string, unknown> {
  return {
    method: route.method,
    path: route.path,
    ...(route.operationId !== undefined ? { operationId: route.operationId } : {}),
    ...(route.summary !== undefined ? { summary: route.summary } : {}),
    ...(route.tags !== undefined ? { tags: route.tags } : {}),
    ...(route.contractPath !== undefined ? { contractPath: route.contractPath } : {}),
    ...(route.statusCodes !== undefined ? { statusCodes: route.statusCodes } : {}),
    ...(operation?.responseSchemas !== undefined ? { responseSchemas: operation.responseSchemas } : {}),
  };
}

export function serializeBody(body: unknown, headers: Record<string, string>): BodyInit {
  if (typeof body === 'string') return body;
  if (!hasHeader(headers, 'content-type')) headers['content-type'] = 'application/json';
  return JSON.stringify(body);
}

export function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

export function parseJsonOrNull(value: string): unknown | null {
  if (value.trim().length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function assertStatus(actual: number, expected: StatusExpectation | undefined): ScenarioResult['assertions'][number] {
  if (expected === undefined) {
    return { name: 'response status is below 500', status: actual < 500 ? 'passed' : 'failed', ...(actual < 500 ? {} : { message: `Expected status below 500, got ${actual}.` }) };
  }
  if (typeof expected === 'number') {
    return { name: `status is ${expected}`, status: actual === expected ? 'passed' : 'failed', ...(actual === expected ? {} : { message: `Expected ${expected}, got ${actual}.` }) };
  }
  if (isReadonlyNumberArray(expected)) {
    return { name: `status is one of ${expected.join(', ')}`, status: expected.includes(actual) ? 'passed' : 'failed', ...(expected.includes(actual) ? {} : { message: `Expected one of ${expected.join(', ')}, got ${actual}.` }) };
  }
  const min = expected.min ?? 100;
  const max = expected.max ?? 599;
  const passed = actual >= min && actual <= max;
  return { name: `status is between ${min} and ${max}`, status: passed ? 'passed' : 'failed', ...(passed ? {} : { message: `Expected ${min}-${max}, got ${actual}.` }) };
}

export function assertContractStatus(
  actual: number,
  route: DiscoveryApiRoute | undefined,
  explicitExpectation: StatusExpectation | undefined,
): ScenarioResult['assertions'][number] | undefined {
  if (route?.statusCodes === undefined || route.statusCodes.length === 0) return undefined;
  const passed = route.statusCodes.includes(actual);
  return {
    name: explicitExpectation === undefined
      ? `status is documented in contract: ${route.statusCodes.join(', ')}`
      : `explicit status is backed by contract: ${route.statusCodes.join(', ')}`,
    status: passed ? 'passed' : 'failed',
    ...(passed ? {} : { message: `Contract for ${route.method} ${route.path} documents ${route.statusCodes.join(', ')}, got ${actual}.` }),
  };
}

export function assertResponseSchema(
  status: number,
  headers: Headers,
  body: unknown,
  operation: OpenApiOperationSummary | undefined,
): ScenarioResult['assertions'][number] | undefined {
  if (body === null || operation === undefined) return undefined;
  const contentType = headers.get('content-type') ?? '';
  const responseSchema = operation.responseSchemas.find((entry) => (
    entry.statusCode === status
    && entry.schema !== undefined
    && (entry.contentType === undefined || contentType.toLowerCase().includes(entry.contentType.toLowerCase()))
  ));
  if (responseSchema?.schema === undefined) return undefined;
  const validation = validateJsonSchema(responseSchema.schema, body);
  return {
    name: `response body matches OpenAPI schema for ${status}`,
    status: validation.valid ? 'passed' : 'failed',
    ...(validation.valid ? {} : { message: validation.errors.join('; ') }),
  };
}

export function isReadonlyNumberArray(value: StatusExpectation): value is readonly number[] {
  return Array.isArray(value);
}

export function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function assertJsonShape(actual: unknown, expected: Record<string, unknown>): readonly ScenarioResult['assertions'][number][] {
  return Object.entries(expected).map(([path, expectedValue]) => {
    const actualValue = getPath(actual, path);
    const passed = deepEqual(actualValue, expectedValue);
    return {
      name: `json.${path} equals ${JSON.stringify(expectedValue)}`,
      status: passed ? 'passed' : 'failed',
      ...(passed ? {} : { message: `Expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}.` }),
    };
  });
}

export function getPath(value: unknown, path: string): unknown {
  if (path.startsWith('$')) {
    try {
      return queryJsonPath(value as JsonValue, path)[0];
    } catch {
      return undefined;
    }
  }
  if (path.startsWith('/')) {
    return path.split('/').slice(1).reduce<unknown>((current, rawSegment) => {
      if (current === null || typeof current !== 'object') return undefined;
      const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
      return (current as Record<string, unknown>)[segment];
    }, value);
  }
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((entry, index) => deepEqual(entry, right[index]));
  }
  if (left !== null && right !== null && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    const leftKeys = Object.keys(left as Record<string, unknown>).sort();
    const rightKeys = Object.keys(right as Record<string, unknown>).sort();
    if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) return false;
    return leftKeys.every((key) => deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
  }
  return false;
}

// All redaction rules live in src/redaction.ts so every output is scrubbed
// the same way. These wrappers keep the existing engine call sites working.
export function redactHeaders(headers: Record<string, string>, shouldRedact: boolean): Record<string, string> {
  if (!shouldRedact) return headers;
  return redactHeaderRecord(headers);
}

export function redactValue(value: unknown, shouldRedact: boolean): unknown {
  if (!shouldRedact) return value;
  return redactDeep(value);
}

export function isHostAllowed(url: URL, allowedHosts: readonly string[], policy: EngineContext['config']['security']['networkPolicy']): boolean {
  if (policy === 'open') return true;
  if (policy === 'allowlist') return allowedHosts.includes(url.hostname);
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

export function resolvePlaywrightCli(): string {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve('@playwright/test/package.json');
  return join(dirname(packageJsonPath), 'cli.js');
}

export function toPlaywrightPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function playwrightConfigSource(specPath: string): string {
  return [
    'module.exports = {',
    '  testDir: __dirname,',
    `  testMatch: [${JSON.stringify(basename(specPath))}],`,
    '  forbidOnly: true,',
    '  fullyParallel: false,',
    '};',
    '',
  ].join('\n');
}

export async function runProcess(command: string, args: readonly string[], options: {
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly env?: Record<string, string>;
}): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}> {
  return new Promise((resolveProcess) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGTERM');
      resolveProcess({ exitCode: null, stdout, stderr, timedOut: true });
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveProcess({ exitCode: null, stdout, stderr: `${stderr}\n${error.message}`.trim(), timedOut: false });
    });
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveProcess({ exitCode, stdout, stderr, timedOut: false });
    });
  });
}

export async function collectPlaywrightArtifacts(outputDir: string): Promise<readonly ArtifactRef[]> {
  const entries = await listFiles(outputDir);
  return entries.map((path) => {
    const lower = path.toLowerCase();
    if (lower.endsWith('.zip')) return { kind: 'trace' as const, path, label: 'Playwright trace', metadata: { source: 'playwright-output' } };
    if (lower.endsWith('.png')) return { kind: 'screenshot' as const, path, label: 'Playwright screenshot', metadata: { source: 'playwright-output' } };
    if (lower.endsWith('.webm')) return { kind: 'video' as const, path, label: 'Playwright video', metadata: { source: 'playwright-output' } };
    return { kind: 'other' as const, path, label: 'Playwright artifact', metadata: { source: 'playwright-output' } };
  });
}

export async function listFiles(root: string): Promise<readonly string[]> {
  const result: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...await listFiles(absolute));
    } else if (entry.isFile()) {
      result.push(absolute);
    }
  }
  return result;
}

export async function removePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export interface PlaywrightReportSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly errors: number;
  readonly durationMs?: number;
  readonly assertions: readonly ScenarioResult['assertions'][number][];
}

export async function readUiGroundingSummary(path: string): Promise<UiGroundingEvidence['summary']> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (isRecord(parsed) && isRecord(parsed.summary)) {
      return {
        total: numberOrZero(parsed.summary.total),
        roles: isNumberRecord(parsed.summary.roles) ? parsed.summary.roles : {},
        labels: numberOrZero(parsed.summary.labels),
        testIds: numberOrZero(parsed.summary.testIds),
        actionable: numberOrZero(parsed.summary.actionable),
      };
    }
  } catch {
    // Missing grounding is reported through the manifest and smoke gates.
  }
  return { total: 0, roles: {}, labels: 0, testIds: 0, actionable: 0 };
}

export function browserGroundingFunctionSource(): string {
  return `({ scenario, route, url }) => {
    const elements = [];
    const roleCounts = {};
    const actionableTags = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
    const roleFor = (element) => {
      const explicit = element.getAttribute('role');
      if (explicit) return explicit;
      const tag = element.tagName;
      if (tag === 'A' && element.getAttribute('href')) return 'link';
      if (tag === 'BUTTON') return 'button';
      if (tag === 'INPUT') {
        const type = (element.getAttribute('type') || 'text').toLowerCase();
        if (type === 'submit' || type === 'button') return 'button';
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        return 'textbox';
      }
      if (tag === 'TEXTAREA') return 'textbox';
      if (tag === 'SELECT') return 'combobox';
      if (/^H[1-6]$/.test(tag)) return 'heading';
      return undefined;
    };
    const labelFor = (element) => {
      if (element.labels && element.labels.length > 0) return Array.from(element.labels).map((label) => label.innerText.trim()).filter(Boolean).join(' ');
      const aria = element.getAttribute('aria-label');
      if (aria) return aria.trim();
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        return labelledBy.split(/\\s+/).map((id) => document.getElementById(id)?.innerText.trim()).filter(Boolean).join(' ');
      }
      return '';
    };
    const cssFor = (element) => {
      const testId = element.getAttribute('data-testid') || element.getAttribute('data-test') || element.getAttribute('data-cy');
      if (testId) return '[data-testid="' + testId.replace(/"/g, '\\\\"') + '"]';
      if (element.id) return '#' + CSS.escape(element.id);
      const name = element.getAttribute('name');
      if (name) return element.tagName.toLowerCase() + '[name="' + name.replace(/"/g, '\\\\"') + '"]';
      return element.tagName.toLowerCase();
    };
    const textFor = (element) => (element.innerText || element.value || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
    const candidates = Array.from(document.querySelectorAll('a,button,input,select,textarea,[role],[data-testid],[data-test],[data-cy],label,h1,h2,h3'));
    candidates.slice(0, 200).forEach((element, index) => {
      const role = roleFor(element);
      const label = labelFor(element);
      const text = textFor(element);
      const testId = element.getAttribute('data-testid') || element.getAttribute('data-test') || element.getAttribute('data-cy') || '';
      let strategy = 'css';
      let value = cssFor(element);
      let kind = 'css';
      let confidence = 0.55;
      if (testId) {
        strategy = 'testId';
        value = testId;
        kind = 'testId';
        confidence = 0.98;
      } else if (label) {
        strategy = 'label';
        value = label;
        kind = 'label';
        confidence = 0.9;
      } else if (role && (text || label)) {
        strategy = 'role';
        value = role + ':' + (text || label);
        kind = 'role';
        confidence = 0.85;
      } else if (text) {
        strategy = 'text';
        value = text;
        kind = 'text';
        confidence = 0.7;
      }
      if (role) roleCounts[role] = (roleCounts[role] || 0) + 1;
      elements.push({
        id: 'ui_el_' + String(index + 1).padStart(3, '0'),
        kind,
        ...(role ? { role } : {}),
        ...(label ? { label } : {}),
        ...(text ? { text } : {}),
        ...(testId ? { testId } : {}),
        css: cssFor(element),
        tagName: element.tagName.toLowerCase(),
        ...(element.getAttribute('type') ? { inputType: element.getAttribute('type') } : {}),
        locator: { strategy, value },
        confidence,
      });
    });
    return {
      schemaVersion: 'brisk-aitesting.ui-grounding.v1',
      scenario,
      route,
      url,
      title: document.title,
      capturedAt: new Date().toISOString(),
      elements,
      summary: {
        total: elements.length,
        roles: roleCounts,
        labels: elements.filter((element) => element.label).length,
        testIds: elements.filter((element) => element.testId).length,
        actionable: elements.filter((element) => actionableTags.has(element.tagName.toUpperCase()) || ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(element.role || '')).length,
      },
    };
  }`;
}

export function playwrightLocatorFunctionSource(): string {
  return `(page, evidence) => {
    if (evidence.locator?.strategy === 'testId') return page.getByTestId(evidence.locator.value);
    if (evidence.locator?.strategy === 'label') return page.getByLabel(evidence.locator.value);
    if (evidence.locator?.strategy === 'role') {
      const [role, ...nameParts] = String(evidence.locator.value).split(':');
      const name = nameParts.join(':');
      return name ? page.getByRole(role, { name }) : page.getByRole(role);
    }
    if (evidence.locator?.strategy === 'text') return page.getByText(evidence.locator.value);
    if (evidence.css) return page.locator(evidence.css);
    return page.locator(evidence.tagName || 'body');
  }`;
}

export async function parsePlaywrightReport(reportPath: string): Promise<PlaywrightReportSummary> {
  try {
    const report = JSON.parse(await readFile(reportPath, 'utf8')) as unknown;
    const specs = collectPlaywrightSpecs(report);
    const assertions = specs.map((spec, index) => {
      const status = normalizePlaywrightStatus(spec.status);
      return {
        name: spec.title ?? `Playwright test ${index + 1}`,
        status,
        ...(spec.error !== undefined ? { message: spec.error } : {}),
      };
    });
    const total = assertions.length;
    const passed = assertions.filter((assertion) => assertion.status === 'passed').length;
    const failed = assertions.filter((assertion) => assertion.status === 'failed').length;
    const skipped = assertions.filter((assertion) => assertion.status === 'skipped').length;
    const errors = assertions.filter((assertion) => assertion.status === 'error').length;
    const durationMs = isRecord(report) && isRecord(report.stats) && typeof report.stats.duration === 'number'
      ? report.stats.duration
      : undefined;
    return {
      total,
      passed,
      failed,
      skipped,
      errors,
      ...(durationMs !== undefined ? { durationMs } : {}),
      assertions,
    };
  } catch (error) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: 1,
      assertions: [{
        name: 'Playwright JSON report is readable',
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

export function collectPlaywrightSpecs(value: unknown): readonly { readonly title?: string; readonly status?: string; readonly error?: string }[] {
  const result: { title?: string; status?: string; error?: string }[] = [];
  visitPlaywrightNode(value, result);
  return result;
}

export function visitPlaywrightNode(value: unknown, result: { title?: string; status?: string; error?: string }[]): void {
  if (!isRecord(value)) return;
  const specs = value.specs;
  if (Array.isArray(specs)) {
    for (const spec of specs) {
      if (!isRecord(spec)) continue;
      const tests = Array.isArray(spec.tests) ? spec.tests : [];
      for (const testCase of tests) {
        const bestResult = latestPlaywrightResult(testCase);
        result.push({
          ...(typeof spec.title === 'string' ? { title: spec.title } : {}),
          ...(bestResult.status !== undefined ? { status: bestResult.status } : {}),
          ...(bestResult.error !== undefined ? { error: bestResult.error } : {}),
        });
      }
    }
  }
  for (const childKey of ['suites', 'children']) {
    const children = value[childKey];
    if (!Array.isArray(children)) continue;
    for (const child of children) visitPlaywrightNode(child, result);
  }
}

export function latestPlaywrightResult(value: unknown): { readonly status?: string; readonly error?: string } {
  if (!isRecord(value) || !Array.isArray(value.results) || value.results.length === 0) return {};
  const result = value.results[value.results.length - 1];
  if (!isRecord(result)) return {};
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const firstError = errors.find(isRecord);
  const message = firstError !== undefined && typeof firstError.message === 'string' ? firstError.message : undefined;
  return {
    ...(typeof result.status === 'string' ? { status: result.status } : {}),
    ...(message !== undefined ? { error: message } : {}),
  };
}

export function normalizePlaywrightStatus(status: string | undefined): ScenarioResult['status'] {
  if (status === 'passed' || status === 'expected') return 'passed';
  if (status === 'skipped') return 'skipped';
  if (status === 'timedOut' || status === 'interrupted') return 'error';
  if (status === 'failed' || status === 'unexpected') return 'failed';
  return 'error';
}

export function summarizePlaywrightExecution(execution: {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}, reportPath: string, report: PlaywrightReportSummary): readonly string[] {
  if (execution.timedOut) return ['Playwright execution timed out.'];
  // When no test ran at all, the first line must carry the CAUSE - a host UI
  // often shows only one line, and "exit code 1" alone explains nothing.
  const cause = report.total === 0
    ? [firstUsefulLine(execution.stderr), firstUsefulLine(execution.stdout)].find((line) => line.trim().length > 0)
    : undefined;
  const diagnostics = [`Playwright exited with code ${execution.exitCode ?? 'unknown'}${cause !== undefined ? `: ${cause}` : ''}`];
  if (report.total > 0) diagnostics.push(`Playwright report: ${report.passed}/${report.total} passed.`);
  if (execution.stderr.trim().length > 0) diagnostics.push(firstUsefulLine(execution.stderr));
  if (execution.stdout.trim().length > 0) diagnostics.push(firstUsefulLine(execution.stdout));
  diagnostics.push(`JSON report: ${reportPath}`);
  return diagnostics;
}

export function firstUsefulLine(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?? value.trim().slice(0, 200);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'number');
}

