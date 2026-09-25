import { normalizeConfig, type UserConfig } from './config.js';
import { HostHttpCapabilityAdapter } from './openapi-capability-adapter.js';
import type { FixtureSourcingPolicy } from './compiler-types.js';
import type {
  AiPlannerProvider,
  AiProviderConfig,
  AppConfig,
  AuthConfig,
  BriskAiTestingConfig,
  ContractConfig,
} from './types.js';

export type HostExecutionMode = 'preview' | 'enabled';

export interface HostAppConfig {
  readonly name?: string;
  readonly baseUrl?: string;
  /** Where the app's pages live when that differs from the API address. */
  readonly uiBaseUrl?: string;
  readonly repoPath?: string;
  readonly env?: AppConfig['env'];
}

export interface HostBuiltInAiConfig {
  readonly source?: 'environment';
  readonly provider?: AiProviderConfig['provider'];
  readonly model?: string;
  readonly endpoint?: string;
  readonly apiKeyEnv?: string;
  readonly caCertPath?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly repairAttempts?: number;
}

export type HostAuthConfig =
  | { readonly source: 'environment' }
  | AuthConfig
  | { readonly createSession: () => AuthConfig | Promise<AuthConfig> };

export interface HostRunConfig {
  readonly execution?: HostExecutionMode;
  readonly artifactsDir?: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly headless?: boolean;
  /** Path to a system-installed Chromium/Chrome, for hosts that cannot download browsers. */
  readonly browserExecutablePath?: string;
}

export interface HostConfig {
  readonly app?: HostAppConfig;
  readonly ai?: HostBuiltInAiConfig | AiPlannerProvider;
  readonly auth?: HostAuthConfig;
  readonly contracts?: {
    readonly openApiPath?: string;
    readonly asyncApiPath?: string;
    readonly pactDir?: string;
  };
  readonly run?: HostRunConfig;
  /**
   * How missing test data is sourced. Default 'require-existing': the engine
   * never creates business entities, and a check whose data is absent fails
   * with an honest precondition diagnosis. 'provision-when-missing' allows a
   * self-cleaning fixture from a declared creation operation with a cleanup.
   */
  readonly fixtures?: FixtureSourcingPolicy;
  readonly discovery?: {
    readonly includeRepo?: boolean;
    readonly includeUi?: boolean;
    readonly includeApi?: boolean;
    readonly includeContracts?: boolean;
    readonly uiRoutes?: readonly string[];
    readonly apiRoutes?: readonly { readonly method: string; readonly path: string }[];
  };
  readonly advanced?: Omit<Partial<UserConfig>, 'app' | 'ai' | 'aiProvider' | 'auth' | 'contracts' | 'runtime' | 'discovery'>;
}

export interface DefineHostConfigOptions {
  readonly environment?: Readonly<Record<string, string | undefined>>;
}

const providers: readonly AiProviderConfig['provider'][] = [
  'openai-compatible',
];

export async function defineHostConfig(
  host: HostConfig = {},
  options: DefineHostConfigOptions = {},
): Promise<BriskAiTestingConfig> {
  const environment = options.environment ?? process.env;
  const app = resolveApp(host.app, environment);
  const execution = enumValue(
    host.run?.execution,
    environment.BRISK_AITESTING_EXECUTION,
    ['preview', 'enabled'] as const,
    'run.execution or BRISK_AITESTING_EXECUTION',
    'preview',
  );
  const auth = await resolveAuth(host.auth, execution, environment);
  const ai = resolveAi(host.ai, environment);
  const contracts = resolveContracts(host.contracts, environment);
  const fixtures = host.fixtures !== undefined || text(undefined, environment.BRISK_AITESTING_FIXTURES) !== undefined
    ? enumValue(
        host.fixtures,
        environment.BRISK_AITESTING_FIXTURES,
        ['provision-when-missing', 'require-existing'] as const,
        'fixtures or BRISK_AITESTING_FIXTURES',
      )
    : undefined;
  const targetHost = hostName(app.baseUrl);
  const loopback = isLoopback(targetHost);

  const config = {
    app,
    auth,
    ...(ai.config !== undefined ? { ai: ai.config } : {}),
    ...(ai.provider !== undefined ? { aiProvider: ai.provider } : {}),
    ...(contracts !== undefined ? { contracts } : {}),
    runtime: {
      artifactsDir: text(host.run?.artifactsDir, environment.BRISK_AITESTING_ARTIFACTS_DIR) ?? '.brisk-aitesting/artifacts',
      timeoutMs: integerValue(host.run?.timeoutMs, environment.BRISK_AITESTING_TIMEOUT_MS, 'run.timeoutMs or BRISK_AITESTING_TIMEOUT_MS', 120_000, 1, 3_600_000),
      retries: integerValue(host.run?.retries, environment.BRISK_AITESTING_RETRIES, 'run.retries or BRISK_AITESTING_RETRIES', 1, 0, 20),
      headless: booleanValue(host.run?.headless, environment.BRISK_AITESTING_HEADLESS, 'run.headless or BRISK_AITESTING_HEADLESS', true),
      dryRun: execution !== 'enabled',
      ...optional('browserExecutablePath', text(host.run?.browserExecutablePath, environment.BRISK_AITESTING_BROWSER_EXECUTABLE_PATH)),
    },
    discovery: {
      includeRepo: host.discovery?.includeRepo ?? true,
      includeUi: host.discovery?.includeUi ?? true,
      includeApi: host.discovery?.includeApi ?? true,
      includeContracts: host.discovery?.includeContracts ?? true,
      maxSourceFiles: 20_000,
      uiRoutes: host.discovery?.uiRoutes ?? [],
      apiRoutes: host.discovery?.apiRoutes ?? [],
    },
    security: {
      networkPolicy: loopback ? 'localhost-only' : 'allowlist',
      allowedHosts: loopback ? ['localhost', '127.0.0.1', '::1'] : [targetHost],
      redactSecrets: true,
      strictMode: true,
      allowFallbackTargets: false,
      allowAiTargets: false,
      allowHeuristicWorkflowCapture: false,
      uiHealing: 'safe',
      allowLegacyFullContextEvidenceProviders: false,
      requireEvidenceProviderTenantId: false,
      requireEvidenceWorkerHostIsolation: false,
    },
    capabilityAdapters: [new HostHttpCapabilityAdapter()],
    ...host.advanced,
    // The fixtures switch is host-facing; advanced planning settings compose
    // with it rather than being silently replaced by it.
    ...(fixtures !== undefined || host.advanced?.planning !== undefined
      ? { planning: { ...host.advanced?.planning, ...(fixtures !== undefined ? { fixtures } : {}) } }
      : {}),
  } satisfies UserConfig;
  return normalizeConfig(config);
}

function resolveContracts(
  input: HostConfig['contracts'],
  environment: Readonly<Record<string, string | undefined>>,
): ContractConfig | undefined {
  const openApiPath = text(input?.openApiPath, environment.BRISK_AITESTING_OPENAPI_PATH);
  const asyncApiPath = text(input?.asyncApiPath, environment.BRISK_AITESTING_ASYNCAPI_PATH);
  const pactDir = text(input?.pactDir, environment.BRISK_AITESTING_PACT_DIR);
  if (openApiPath === undefined && asyncApiPath === undefined && pactDir === undefined) return undefined;
  return {
    ...optional('openApiPath', openApiPath),
    ...optional('asyncApiPath', asyncApiPath),
    ...optional('pactDir', pactDir),
  };
}

function resolveApp(app: HostAppConfig | undefined, environment: Readonly<Record<string, string | undefined>>): AppConfig {
  const name = requiredText(app?.name, environment.BRISK_AITESTING_APP_NAME, 'app.name or BRISK_AITESTING_APP_NAME');
  const baseUrl = requiredText(app?.baseUrl, environment.BRISK_AITESTING_BASE_URL, 'app.baseUrl or BRISK_AITESTING_BASE_URL');
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
  } catch {
    throw new Error('app.baseUrl or BRISK_AITESTING_BASE_URL must be a complete http:// or https:// URL.');
  }
  const env = enumValue(app?.env, environment.BRISK_AITESTING_APP_ENV, ['local', 'ci', 'staging', 'production-like'] as const, 'app.env or BRISK_AITESTING_APP_ENV', 'local');
  const uiBaseUrl = text(app?.uiBaseUrl, environment.BRISK_AITESTING_UI_BASE_URL);
  return {
    name,
    baseUrl,
    ...(uiBaseUrl !== undefined ? { uiBaseUrl } : {}),
    repoPath: text(app?.repoPath, environment.BRISK_AITESTING_REPO_PATH) ?? '.',
    env,
  };
}

function resolveAi(
  input: HostConfig['ai'],
  environment: Readonly<Record<string, string | undefined>>,
): { readonly config?: AiProviderConfig; readonly provider?: AiPlannerProvider } {
  if (input !== undefined && 'complete' in input) {
    if (typeof input.complete !== 'function') throw new Error('ai.complete must be a function.');
    return { provider: input };
  }
  const configured = input !== undefined || hasAnyEnvironment(environment, [
    'BRISK_AITESTING_AI_PROVIDER',
    'BRISK_AITESTING_AI_MODEL',
    'BRISK_AITESTING_AI_ENDPOINT',
    'BRISK_AITESTING_AI_API_KEY',
  ]);
  if (!configured) return {};
  const source = input as HostBuiltInAiConfig | undefined;
  const provider = enumValue(source?.provider, environment.BRISK_AITESTING_AI_PROVIDER, providers, 'ai.provider or BRISK_AITESTING_AI_PROVIDER');
  const model = requiredText(source?.model, environment.BRISK_AITESTING_AI_MODEL, 'ai.model or BRISK_AITESTING_AI_MODEL');
  const apiKeyEnv = text(source?.apiKeyEnv, undefined) ?? 'BRISK_AITESTING_AI_API_KEY';
  if (!/^[A-Z_][A-Z0-9_]*$/.test(apiKeyEnv)) {
    throw new Error('ai.apiKeyEnv must be an environment-variable name, not a secret value.');
  }
  if (text(undefined, environment[apiKeyEnv]) === undefined) {
    throw new Error(`AI is configured but ${apiKeyEnv} is missing. Set that environment variable to the provider key.`);
  }
  return {
    config: {
      provider,
      model,
      apiKeyEnv,
      ...optional('endpoint', text(source?.endpoint, environment.BRISK_AITESTING_AI_ENDPOINT)),
      ...optional('caCertPath', text(source?.caCertPath, environment.BRISK_AITESTING_AI_CA_CERT_PATH)),
      ...optional('maxTokens', optionalInteger(source?.maxTokens, environment.BRISK_AITESTING_AI_MAX_TOKENS, 'ai.maxTokens or BRISK_AITESTING_AI_MAX_TOKENS', 1, 1_000_000)),
      ...optional('temperature', optionalNumber(source?.temperature, environment.BRISK_AITESTING_AI_TEMPERATURE, 'ai.temperature or BRISK_AITESTING_AI_TEMPERATURE', 0, 2)),
      ...optional('repairAttempts', optionalInteger(source?.repairAttempts, environment.BRISK_AITESTING_AI_REPAIR_ATTEMPTS, 'ai.repairAttempts or BRISK_AITESTING_AI_REPAIR_ATTEMPTS', 0, 5)),
    },
  };
}

async function resolveAuth(
  input: HostAuthConfig | undefined,
  execution: HostExecutionMode,
  environment: Readonly<Record<string, string | undefined>>,
): Promise<AuthConfig> {
  if (input !== undefined && 'createSession' in input) {
    if (execution !== 'enabled') return { type: 'none' };
    const auth = await input.createSession();
    validateResolvedAuth(auth, 'auth.createSession');
    return auth;
  }
  if (input !== undefined && !('source' in input)) {
    validateResolvedAuth(input, 'auth');
    return input;
  }
  const type = enumValue(undefined, environment.BRISK_AITESTING_AUTH_TYPE, ['none', 'credentials', 'bearer'] as const, 'auth.type or BRISK_AITESTING_AUTH_TYPE', 'none');
  if (type === 'none') return { type: 'none' };
  if (type === 'bearer') {
    return { type, token: requiredText(undefined, environment.BRISK_AITESTING_AUTH_TOKEN, 'BRISK_AITESTING_AUTH_TOKEN') };
  }
  return {
    type,
    ...optional('loginUrl', text(undefined, environment.BRISK_AITESTING_AUTH_LOGIN_URL)),
    username: requiredText(undefined, environment.BRISK_AITESTING_AUTH_USERNAME, 'BRISK_AITESTING_AUTH_USERNAME'),
    password: requiredText(undefined, environment.BRISK_AITESTING_AUTH_PASSWORD, 'BRISK_AITESTING_AUTH_PASSWORD'),
    ...optional('usernameField', text(undefined, environment.BRISK_AITESTING_AUTH_USERNAME_FIELD)),
    ...optional('passwordField', text(undefined, environment.BRISK_AITESTING_AUTH_PASSWORD_FIELD)),
    ...optional('tokenPath', text(undefined, environment.BRISK_AITESTING_AUTH_TOKEN_PATH)),
  };
}

function validateResolvedAuth(auth: AuthConfig, source: string): void {
  if (auth.type === 'bearer' && auth.token.trim().length === 0) throw new Error(`${source} returned an empty bearer token.`);
  if (auth.type === 'credentials' && (auth.username.trim().length === 0 || auth.password.trim().length === 0)) {
    throw new Error(`${source} returned empty credentials.`);
  }
}

function requiredText(explicit: string | undefined, environment: string | undefined, name: string): string {
  const value = text(explicit, environment);
  if (value === undefined) throw new Error(`${name} is required.`);
  return value;
}

function text(explicit: string | undefined, environment: string | undefined): string | undefined {
  const value = explicit ?? environment;
  return value !== undefined && value.trim().length > 0 ? value.trim() : undefined;
}

function enumValue<T extends string>(explicit: T | undefined, environment: string | undefined, allowed: readonly T[], name: string, fallback?: T): T {
  const value = text(explicit, environment) ?? fallback;
  if (value === undefined) throw new Error(`${name} is required.`);
  if (!allowed.includes(value as T)) throw new Error(`${name} must be one of: ${allowed.join(', ')}.`);
  return value as T;
}

function integerValue(explicit: number | undefined, environment: string | undefined, name: string, fallback: number, min: number, max: number): number {
  return optionalInteger(explicit, environment, name, min, max) ?? fallback;
}

function optionalInteger(explicit: number | undefined, environment: string | undefined, name: string, min: number, max: number): number | undefined {
  const value = explicit ?? (text(undefined, environment) === undefined ? undefined : Number(environment));
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}

function optionalNumber(explicit: number | undefined, environment: string | undefined, name: string, min: number, max: number): number | undefined {
  const value = explicit ?? (text(undefined, environment) === undefined ? undefined : Number(environment));
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a number between ${min} and ${max}.`);
  return value;
}

function booleanValue(explicit: boolean | undefined, environment: string | undefined, name: string, fallback: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const value = text(undefined, environment);
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function hostName(baseUrl: string): string {
  return new URL(baseUrl).hostname;
}

function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function hasAnyEnvironment(environment: Readonly<Record<string, string | undefined>>, names: readonly string[]): boolean {
  return names.some((name) => text(undefined, environment[name]) !== undefined);
}

function optional<K extends string, V>(key: K, value: V | undefined): { readonly [P in K]?: V } {
  return value === undefined ? {} : { [key]: value } as { readonly [P in K]?: V };
}
