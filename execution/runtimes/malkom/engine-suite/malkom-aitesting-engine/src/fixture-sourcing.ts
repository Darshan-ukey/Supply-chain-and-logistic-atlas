import type {
  EvidenceGraph,
  FixtureProvisioningProbeV1,
  LoweredPlan,
  WorkflowPlan,
} from './compiler-types.js';
import type { BriskAiTestingConfig, ScenarioPlan } from './types.js';
import { getPath, isHostAllowed } from './engines/shared.js';
import { collectWorkflowReferences, isBuiltinWorkflowVariable, scopedCaptureName } from './workflow-values.js';

/**
 * One workflow input whose value is sourced from a read/list operation's
 * output. Whether that value will exist at run time depends entirely on the
 * target app holding data, which is exactly what the planning-time probe
 * checks before the run starts.
 */
export interface ListSourcedValue {
  readonly intentScenarioId: string;
  readonly workflowScenarioId: string;
  readonly consumerStepId: string;
  readonly sourceStepId: string;
  readonly sourceOperationId: string;
  readonly semanticType: string;
}

export interface ListSourceProbeResult {
  readonly source: ListSourcedValue;
  readonly probe: FixtureProvisioningProbeV1;
  readonly explanation: string;
}

/** Finds every input binding whose producer is a read/list step: the places a run can fail purely because the app holds no data. */
export function listSourcedValues(workflow: WorkflowPlan, evidence: EvidenceGraph): readonly ListSourcedValue[] {
  const operations = new Map(evidence.operations.map((operation) => [operation.id, operation]));
  const found: ListSourcedValue[] = [];
  const seen = new Set<string>();
  for (const scenario of workflow.scenarios) {
    const stepsById = new Map(scenario.steps.map((step) => [step.id, step]));
    for (const step of scenario.steps) {
      for (const input of step.inputs) {
        if (input.value.kind !== 'output') continue;
        const producer = stepsById.get(input.value.stepId);
        if (producer === undefined) continue;
        const operation = operations.get(producer.operationId);
        if (operation?.sideEffect !== 'read') continue;
        const key = `${scenario.id}:${producer.id}:${input.value.semanticType}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({
          intentScenarioId: scenario.intentScenarioId,
          workflowScenarioId: scenario.id,
          consumerStepId: step.id,
          sourceStepId: producer.id,
          sourceOperationId: operation.id,
          semanticType: input.value.semanticType,
        });
      }
    }
  }
  return found;
}

/**
 * Probes each list source with the exact read request the plan will execute,
 * and evaluates the exact capture path the runtime would evaluate. Strictly
 * read-only: GET requests only, network policy enforced, and any condition
 * that prevents a trustworthy verdict yields 'unknown' rather than a guess.
 */
/** How many distinct data-source requests may be in flight at once. */
const PROBE_CONCURRENCY = 4;

type SharedProbeFetch =
  | { readonly kind: 'response'; readonly status: number; readonly text: string }
  | { readonly kind: 'unreachable'; readonly message: string };

export async function probeListSources(params: {
  readonly sources: readonly ListSourcedValue[];
  readonly lowered: LoweredPlan;
  readonly config: BriskAiTestingConfig;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}): Promise<readonly ListSourceProbeResult[]> {
  // Many checks read the same value from the same request (fifteen scenarios
  // all listing one collection). The request is made once per distinct
  // method+URL+headers, a few in flight at a time, and every check evaluates
  // its own capture path against the shared answer.
  const prepared: { readonly source: ListSourcedValue; readonly scenario: ScenarioPlan; readonly path: string }[] = [];
  for (const source of params.sources) {
    const scenario = params.lowered.scenarios.find((candidate) => (
      candidate.metadata?.workflowStepId === source.sourceStepId
      && candidate.metadata?.workflowScenarioId === source.workflowScenarioId
    ));
    if (scenario === undefined) continue;
    const path = scenario.target?.path;
    if (path === undefined || !path.startsWith('/')) continue;
    prepared.push({ source, scenario, path });
  }

  const fetches = new Map<string, Promise<SharedProbeFetch>>();
  const slots: Promise<void>[] = Array.from({ length: PROBE_CONCURRENCY }, () => Promise.resolve());
  let nextSlot = 0;
  const sharedFetch = (key: string, url: URL, headers: Readonly<Record<string, string>>): Promise<SharedProbeFetch> => {
    const existing = fetches.get(key);
    if (existing !== undefined) return existing;
    // Round-robin over a fixed number of chains: at most PROBE_CONCURRENCY
    // requests in flight, each distinct request made exactly once.
    const slot = nextSlot;
    nextSlot = (nextSlot + 1) % PROBE_CONCURRENCY;
    const run = slots[slot]!.then(() => fetchProbe(url, headers, params.timeoutMs, params.signal));
    slots[slot] = run.then(() => undefined);
    fetches.set(key, run);
    return run;
  };

  const evaluations = prepared.map(({ source, scenario, path }) => (
    probeOne(source, scenario, path, params.config, sharedFetch, params.signal)
  ));
  return Promise.all(evaluations);
}

async function fetchProbe(
  url: URL,
  headers: Readonly<Record<string, string>>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<SharedProbeFetch> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: signal === undefined
        ? AbortSignal.timeout(timeoutMs)
        : AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
    return { kind: 'response', status: response.status, text: await response.text() };
  } catch (error) {
    return { kind: 'unreachable', message: error instanceof Error ? error.message : String(error) };
  }
}

async function probeOne(
  source: ListSourcedValue,
  scenario: ScenarioPlan,
  path: string,
  config: BriskAiTestingConfig,
  sharedFetch: (key: string, url: URL, headers: Readonly<Record<string, string>>) => Promise<SharedProbeFetch>,
  signal?: AbortSignal,
): Promise<ListSourceProbeResult> {
  const method = (scenario.target?.method ?? 'GET').toUpperCase();
  const unknown = (explanation: string, httpStatus?: number): ListSourceProbeResult => ({
    source,
    probe: {
      method,
      path,
      status: 'unknown',
      ...(httpStatus !== undefined ? { httpStatus } : {}),
      checkedAt: new Date().toISOString(),
    },
    explanation,
  });
  if (signal?.aborted === true) {
    return unknown(`Probing was cancelled before ${method} ${path} could be checked.`);
  }
  if (method !== 'GET') {
    return unknown(`Data source for ${source.semanticType} is not a GET request, so it was not probed at planning time.`);
  }
  const captureName = scopedCaptureName(source.sourceStepId, source.semanticType);
  const capture = scenario.capture?.find((candidate) => candidate.name === captureName);
  if (capture === undefined || capture.from !== 'response.body') {
    return unknown(`No response-body capture named ${captureName} exists on the data source, so emptiness could not be checked.`);
  }
  const references = collectWorkflowReferences({ path, request: scenario.request })
    .filter((reference) => !isBuiltinWorkflowVariable(reference));
  if (references.length > 0) {
    return unknown(`Data source ${method} ${path} depends on run-time value(s) ${references.join(', ')}, so it cannot be probed before execution.`);
  }
  const authHeaders = probeAuthHeaders(config);
  if (authHeaders === undefined) {
    return unknown(`Sign-in type "${config.auth.type}" creates its session only at execution time, so live data was not inspected during planning.`);
  }
  const url = new URL(path, config.app.baseUrl);
  for (const [key, value] of Object.entries(scenario.request?.query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  if (!isHostAllowed(url, config.security.allowedHosts, config.security.networkPolicy)) {
    return unknown(`Network policy does not allow probing host ${url.hostname} during planning.`);
  }
  const headers = { ...authHeaders, ...scenario.request?.headers };
  const fetchKey = `${method} ${url.toString()} ${stableHeaderKey(headers)}`;
  const shared = await sharedFetch(fetchKey, url, headers);
  if (shared.kind === 'unreachable') {
    return unknown(`Data source ${method} ${path} could not be reached during planning: ${shared.message}`);
  }
  if (shared.status < 200 || shared.status >= 300) {
    return unknown(`Data source ${method} ${path} answered HTTP ${shared.status} during planning, so emptiness could not be verified.`, shared.status);
  }
  let json: unknown;
  try {
    json = JSON.parse(shared.text) as unknown;
  } catch {
    return unknown(`Data source ${method} ${path} did not return JSON, so emptiness could not be verified.`, shared.status);
  }
  const value = getPath(json, capture.path);
  const populated = typeof value === 'number'
    ? Number.isFinite(value)
    : typeof value === 'string'
      ? value.trim().length > 0
      : value !== undefined && value !== null;
  const checkedAt = new Date().toISOString();
  if (populated) {
    return {
      source,
      probe: { method, path, status: 'populated', httpStatus: shared.status, checkedAt },
      explanation: `Live data exists for ${source.semanticType}: ${method} ${path} returned a value at ${capture.path}.`,
    };
  }
  return {
    source,
    probe: { method, path, status: 'empty', httpStatus: shared.status, checkedAt },
    explanation: `${method} ${path} succeeded with HTTP ${shared.status} but returned no ${source.semanticType} value at ${capture.path}: the collection is empty in the target app.`,
  };
}

function stableHeaderKey(headers: Readonly<Record<string, string>>): string {
  return Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join(';');
}

/** Headers a planning-time probe may derive without creating a session; undefined means the probe must stay silent. */
function probeAuthHeaders(config: BriskAiTestingConfig): Readonly<Record<string, string>> | undefined {
  if (config.auth.type === 'none') return {};
  if (config.auth.type === 'bearer') return { authorization: `Bearer ${config.auth.token}` };
  return undefined;
}
