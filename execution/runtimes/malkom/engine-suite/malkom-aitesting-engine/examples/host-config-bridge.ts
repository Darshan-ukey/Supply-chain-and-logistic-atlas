import { defineConfigFromHost, mergeConfig, type AiProviderConfig } from 'brisk-aitesting';

const hostAiCaCertPath = optionalEnv('HOST_AI_CA_CERT_PATH');
type SupportedProvider = AiProviderConfig['provider'];
const supportedProviders: readonly SupportedProvider[] = [
  'openai-compatible',
];

type HostSaaSConfig = {
  readonly appName: string;
  readonly publicBaseUrl: string;
  readonly repoRoot: string;
  readonly ai: {
    readonly provider: SupportedProvider;
    readonly apiKey: string;
    readonly model: string;
    readonly caCertPath?: string;
  };
};

const hostConfig: HostSaaSConfig = {
  appName: requiredEnv('HOST_APP_NAME'),
  publicBaseUrl: requiredEnv('HOST_PUBLIC_BASE_URL'),
  repoRoot: process.env.HOST_REPO_ROOT ?? '.',
  ai: {
    provider: parseProvider(requiredEnv('HOST_AI_PROVIDER')),
    apiKey: requiredEnv('HOST_AI_API_KEY'),
    model: requiredEnv('HOST_AI_MODEL'),
    ...(hostAiCaCertPath !== undefined ? { caCertPath: hostAiCaCertPath } : {}),
  },
};

const baseTestingConfig = defineConfigFromHost(hostConfig, (host) => ({
  app: {
    name: host.appName,
    baseUrl: host.publicBaseUrl,
    repoPath: host.repoRoot,
    env: 'local',
  },
  auth: { type: 'none' },
  ai: {
    provider: host.ai.provider,
    model: host.ai.model,
    apiKey: host.ai.apiKey,
    ...(host.ai.caCertPath !== undefined ? { caCertPath: host.ai.caCertPath } : {}),
  },
}));

export default mergeConfig(baseTestingConfig, {
  runtime: {
    artifactsDir: '.brisk-aitesting/artifacts',
    timeoutMs: 120000,
    retries: 1,
    headless: true,
    dryRun: false,
  },
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required for the host config bridge example.`);
  }
  return value;
}

function parseProvider(value: string): SupportedProvider {
  if (supportedProviders.includes(value as SupportedProvider)) return value as SupportedProvider;
  throw new Error(`HOST_AI_PROVIDER must be one of: ${supportedProviders.join(', ')}.`);
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.trim().length > 0 ? value : undefined;
}
