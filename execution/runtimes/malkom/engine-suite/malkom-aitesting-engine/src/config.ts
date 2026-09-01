import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { BriskAiTestingConfig } from './types.js';
import { createAiProviderFromConfig } from './providers.js';

export type UserConfig = Omit<Partial<BriskAiTestingConfig>, 'app' | 'discovery'> & {
  readonly app: BriskAiTestingConfig['app'];
  readonly discovery?: Partial<BriskAiTestingConfig['discovery']>;
};

export function defineConfig(config: UserConfig): UserConfig {
  return config;
}

export function defineConfigFromHost<THostConfig>(
  hostConfig: THostConfig,
  mapper: (hostConfig: THostConfig) => UserConfig,
): UserConfig {
  return mapper(hostConfig);
}

export function mergeConfig(base: UserConfig, override: Partial<UserConfig>): UserConfig {
  return {
    ...base,
    ...override,
    app: { ...base.app, ...override.app },
    ...(base.auth !== undefined || override.auth !== undefined ? { auth: override.auth ?? base.auth } : {}),
    ...(base.ai !== undefined || override.ai !== undefined ? { ai: { ...base.ai, ...override.ai } as NonNullable<UserConfig['ai']> } : {}),
    ...(base.planning !== undefined || override.planning !== undefined ? { planning: { ...base.planning, ...override.planning } as NonNullable<UserConfig['planning']> } : {}),
    ...(base.contracts !== undefined || override.contracts !== undefined ? { contracts: { ...base.contracts, ...override.contracts } } : {}),
    ...(base.runtime !== undefined || override.runtime !== undefined ? { runtime: { ...base.runtime, ...override.runtime } as NonNullable<UserConfig['runtime']> } : {}),
    ...(base.discovery !== undefined || override.discovery !== undefined ? { discovery: { ...base.discovery, ...override.discovery } as NonNullable<UserConfig['discovery']> } : {}),
    ...(base.security !== undefined || override.security !== undefined ? { security: { ...base.security, ...override.security } as NonNullable<UserConfig['security']> } : {}),
  };
}

export async function loadConfig(configPath = 'brisk-aitesting.config.mjs'): Promise<BriskAiTestingConfig> {
  const absolute = resolve(process.cwd(), configPath);
  const extension = extname(absolute).toLowerCase();
  if (extension === '.json' || extension === '.yaml' || extension === '.yml') {
    const raw = await readFile(absolute, 'utf8');
    const parsed = extension === '.json' ? JSON.parse(raw) as unknown : parseYaml(raw) as unknown;
    return normalizeConfig(assertUserConfig(parsed, absolute));
  }
  const imported = await import(pathToFileURL(absolute).href) as { default?: UserConfig | Promise<UserConfig>; config?: UserConfig | Promise<UserConfig> };
  const pendingConfig = imported.default ?? imported.config;
  const config = pendingConfig === undefined ? undefined : await pendingConfig;
  if (config === undefined) {
    throw new Error(`No default config export found in ${absolute}`);
  }
  return normalizeConfig(config);
}

function assertUserConfig(value: unknown, path: string): UserConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Config ${path} must be an object.`);
  }
  const config = value as Partial<UserConfig>;
  if (config.app === undefined) {
    throw new Error(`Config ${path} must include app.name and app.baseUrl.`);
  }
  return config as UserConfig;
}

export function normalizeConfig(input: UserConfig): BriskAiTestingConfig {
  if (input.app.name.trim().length === 0) throw new Error('app.name is required');
  if (input.app.baseUrl.trim().length === 0) throw new Error('app.baseUrl is required');
  validateAiConfig(input.ai);
  validatePlanningConfig(input.planning);
  validateEvidenceProviders(input.evidenceProviders, input.security?.allowLegacyFullContextEvidenceProviders === true);
  if (input.discovery?.maxSourceFiles !== undefined && (!Number.isInteger(input.discovery.maxSourceFiles) || input.discovery.maxSourceFiles < 1 || input.discovery.maxSourceFiles > 1_000_000)) {
    throw new Error('discovery.maxSourceFiles must be an integer between 1 and 1000000.');
  }

  const artifactsDir = input.runtime?.artifactsDir ?? '.brisk-aitesting/artifacts';
  const timeoutMs = input.runtime?.timeoutMs ?? 120_000;
  const retries = input.runtime?.retries ?? 1;

  return {
    app: {
      name: input.app.name,
      baseUrl: input.app.baseUrl.replace(/\/+$/, ''),
      ...(input.app.uiBaseUrl !== undefined ? { uiBaseUrl: input.app.uiBaseUrl.replace(/\/+$/, '') } : {}),
      ...(input.app.repoPath !== undefined ? { repoPath: input.app.repoPath } : {}),
      ...(input.app.env !== undefined ? { env: input.app.env } : {}),
    },
    auth: input.auth ?? { type: 'none' },
    ...(input.ai !== undefined ? { ai: input.ai } : {}),
    ...(input.planning !== undefined ? { planning: input.planning } : {}),
    ...(input.contracts !== undefined ? { contracts: input.contracts } : {}),
    runtime: {
      artifactsDir,
      timeoutMs,
      retries,
      headless: input.runtime?.headless ?? true,
      dryRun: input.runtime?.dryRun ?? false,
      ...(input.runtime?.browserExecutablePath !== undefined && input.runtime.browserExecutablePath.trim().length > 0
        ? { browserExecutablePath: input.runtime.browserExecutablePath.trim() }
        : {}),
    },
    discovery: {
      includeRepo: input.discovery?.includeRepo ?? true,
      includeUi: input.discovery?.includeUi ?? true,
      includeApi: input.discovery?.includeApi ?? true,
      includeContracts: input.discovery?.includeContracts ?? true,
      maxSourceFiles: input.discovery?.maxSourceFiles ?? 20_000,
      uiRoutes: input.discovery?.uiRoutes ?? [],
      apiRoutes: input.discovery?.apiRoutes ?? [],
    },
    security: {
      networkPolicy: input.security?.networkPolicy ?? 'localhost-only',
      allowedHosts: input.security?.allowedHosts ?? ['localhost', '127.0.0.1', '::1'],
      redactSecrets: input.security?.redactSecrets ?? true,
      strictMode: input.security?.strictMode ?? true,
      allowFallbackTargets: input.security?.allowFallbackTargets ?? false,
      allowAiTargets: input.security?.allowAiTargets ?? false,
      allowHeuristicWorkflowCapture: input.security?.allowHeuristicWorkflowCapture ?? false,
      uiHealing: input.security?.uiHealing ?? 'safe',
      allowLegacyFullContextEvidenceProviders: input.security?.allowLegacyFullContextEvidenceProviders ?? false,
      requireEvidenceProviderTenantId: input.security?.requireEvidenceProviderTenantId ?? false,
      requireEvidenceWorkerHostIsolation: input.security?.requireEvidenceWorkerHostIsolation ?? false,
    },
    ...(input.engines !== undefined ? { engines: input.engines } : {}),
    ...(input.discoverer !== undefined ? { discoverer: input.discoverer } : {}),
    ...(input.validator !== undefined ? { validator: input.validator } : {}),
    ...(input.capabilityAdapters !== undefined ? { capabilityAdapters: input.capabilityAdapters } : {}),
    ...(input.evidenceProviders !== undefined ? { evidenceProviders: input.evidenceProviders } : {}),
    ...(input.aiProvider !== undefined ? { aiProvider: input.aiProvider } : input.ai !== undefined ? { aiProvider: createAiProviderFromConfig(input.ai) } : {}),
  };
}

function validateAiConfig(ai: UserConfig['ai']): void {
  if (ai === undefined) return;
  if (ai.apiKeyEnv !== undefined) {
    if (/^(sk-|Bearer\s+)/i.test(ai.apiKeyEnv) || !/^[A-Z_][A-Z0-9_]*$/.test(ai.apiKeyEnv)) {
      throw new Error('ai.apiKeyEnv must be an environment variable name such as BRISK_AITESTING_AI_API_KEY, not the API key value.');
    }
  }
  if (ai.model.trim().length === 0) {
    throw new Error('ai.model is required when ai config is provided.');
  }
  if (ai.repairAttempts !== undefined && (!Number.isFinite(ai.repairAttempts) || ai.repairAttempts < 0 || ai.repairAttempts > 5)) {
    throw new Error('ai.repairAttempts must be a number between 0 and 5.');
  }
}

function validatePlanningConfig(planning: UserConfig['planning']): void {
  if (planning === undefined) return;
  if (planning.repairAttempts !== undefined && (!Number.isFinite(planning.repairAttempts) || planning.repairAttempts < 0 || planning.repairAttempts > 5)) {
    throw new Error('planning.repairAttempts must be a number between 0 and 5.');
  }
  if (planning.fixtures !== undefined && planning.fixtures !== 'provision-when-missing' && planning.fixtures !== 'require-existing') {
    throw new Error("planning.fixtures must be 'provision-when-missing' or 'require-existing'.");
  }
  if (planning.evidenceAcquisitionRounds !== undefined && (!Number.isInteger(planning.evidenceAcquisitionRounds) || planning.evidenceAcquisitionRounds < 0 || planning.evidenceAcquisitionRounds > 5)) {
    throw new Error('planning.evidenceAcquisitionRounds must be an integer between 0 and 5.');
  }
  if (planning.evidenceProviderTimeoutMs !== undefined && (!Number.isInteger(planning.evidenceProviderTimeoutMs) || planning.evidenceProviderTimeoutMs < 1 || planning.evidenceProviderTimeoutMs > 3_600_000)) {
    throw new Error('planning.evidenceProviderTimeoutMs must be an integer between 1 and 3600000.');
  }
  if (planning.evidenceCacheTtlMs !== undefined && (!Number.isInteger(planning.evidenceCacheTtlMs) || planning.evidenceCacheTtlMs < 0 || planning.evidenceCacheTtlMs > 86_400_000)) {
    throw new Error('planning.evidenceCacheTtlMs must be an integer between 0 and 86400000.');
  }
  if (planning.evidenceCacheMaxEntries !== undefined && (!Number.isInteger(planning.evidenceCacheMaxEntries) || planning.evidenceCacheMaxEntries < 0 || planning.evidenceCacheMaxEntries > 1024)) {
    throw new Error('planning.evidenceCacheMaxEntries must be an integer between 0 and 1024.');
  }
  if (planning.evidenceMaxResponseBytes !== undefined && (!Number.isInteger(planning.evidenceMaxResponseBytes) || planning.evidenceMaxResponseBytes < 1024 || planning.evidenceMaxResponseBytes > 104_857_600)) {
    throw new Error('planning.evidenceMaxResponseBytes must be an integer between 1024 and 104857600.');
  }
  if (planning.evidenceMaxGraphsPerResponse !== undefined && (!Number.isInteger(planning.evidenceMaxGraphsPerResponse) || planning.evidenceMaxGraphsPerResponse < 1 || planning.evidenceMaxGraphsPerResponse > 1024)) {
    throw new Error('planning.evidenceMaxGraphsPerResponse must be an integer between 1 and 1024.');
  }
  if (planning.evidenceMaxOperationsPerResponse !== undefined && (!Number.isInteger(planning.evidenceMaxOperationsPerResponse) || planning.evidenceMaxOperationsPerResponse < 1 || planning.evidenceMaxOperationsPerResponse > 100_000)) {
    throw new Error('planning.evidenceMaxOperationsPerResponse must be an integer between 1 and 100000.');
  }
  if (planning.evidenceMaxArtifactsPerResponse !== undefined && (!Number.isInteger(planning.evidenceMaxArtifactsPerResponse) || planning.evidenceMaxArtifactsPerResponse < 0 || planning.evidenceMaxArtifactsPerResponse > 10_000)) {
    throw new Error('planning.evidenceMaxArtifactsPerResponse must be an integer between 0 and 10000.');
  }
}

function validateEvidenceProviders(providers: UserConfig['evidenceProviders'], allowLegacyFullContext: boolean): void {
  if (providers === undefined) return;
  const ids = new Set<string>();
  for (const provider of providers) {
    const declaredExecution = (provider as { readonly execution?: unknown }).execution;
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(provider.id)) {
      throw new Error(`Evidence provider id "${provider.id}" is invalid.`);
    }
    if (!['brisk-aitesting.evidence-provider.v1', 'brisk-aitesting.evidence-provider.v2', 'brisk-aitesting.evidence-worker-provider.v1'].includes(provider.schemaVersion)) {
      throw new Error(`Evidence provider "${provider.id}" uses unsupported contract ${provider.schemaVersion as string}.`);
    }
    if (provider.schemaVersion === 'brisk-aitesting.evidence-provider.v1' && !allowLegacyFullContext) {
      throw new Error(`Evidence provider "${provider.id}" uses the legacy full-context contract. Set security.allowLegacyFullContextEvidenceProviders to true only for reviewed trusted code, or migrate it to evidence-provider.v2.`);
    }
    if (provider.schemaVersion === 'brisk-aitesting.evidence-provider.v2' && declaredExecution !== 'trusted-in-process') {
      throw new Error(`Evidence provider "${provider.id}" must declare execution as trusted-in-process.`);
    }
    if (provider.schemaVersion === 'brisk-aitesting.evidence-worker-provider.v1') {
      if (declaredExecution !== 'isolated-worker') throw new Error(`Evidence worker "${provider.id}" must declare isolated-worker execution.`);
      if (provider.modulePath.trim().length === 0) throw new Error(`Evidence worker "${provider.id}" must declare a modulePath.`);
      if (!Number.isInteger(provider.limits.memoryMb) || provider.limits.memoryMb < 16 || provider.limits.memoryMb > 4096) {
        throw new Error(`Evidence worker "${provider.id}" memoryMb must be an integer between 16 and 4096.`);
      }
      const supportCount = (provider.supports.reasonCodes?.length ?? 0) + (provider.supports.semanticTypes?.length ?? 0) + (provider.supports.capabilities?.length ?? 0);
      if (supportCount === 0) throw new Error(`Evidence worker "${provider.id}" must declare at least one supported requirement selector.`);
      if (provider.allowedEnvironmentVariables?.some((name) => !/^[A-Z_][A-Z0-9_]*$/.test(name)) === true) {
        throw new Error(`Evidence worker "${provider.id}" has an invalid environment-variable name.`);
      }
    }
    if (provider.revision.trim().length === 0 || provider.revision.length > 256) {
      throw new Error(`Evidence provider "${provider.id}" must declare a non-empty revision no longer than 256 characters.`);
    }
    if (ids.has(provider.id)) throw new Error(`Evidence provider id "${provider.id}" is registered more than once.`);
    ids.add(provider.id);
  }
}

/**
 * One shared rule for how many AI repair attempts a run allows.
 * Default 2, always between 0 and 5. Every repair loop uses this same rule
 * so the setting means the same thing everywhere.
 */
export function resolveRepairAttempts(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 2;
  return Math.max(0, Math.min(5, Math.trunc(value)));
}
