import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '../../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));

export function seriousSaasConfig(baseUrl) {
  return defineConfig({
    app: {
      name: 'serious-saas reference app',
      baseUrl,
      repoPath: dirname(dirname(here)),
      env: 'local',
    },
    auth: { type: 'none' },
    contracts: {
      openApiPath: join(here, 'openapi.json'),
    },
    runtime: {
      artifactsDir: '.brisk-aitesting-reference-serious-saas/artifacts',
      timeoutMs: 30000,
      retries: 0,
      headless: true,
      dryRun: false,
    },
    discovery: {
      includeRepo: true,
      includeUi: true,
      includeApi: false,
      includeContracts: true,
      uiRoutes: ['/', '/login', '/dashboard', '/users'],
    },
    security: {
      networkPolicy: 'localhost-only',
      allowedHosts: ['localhost', '127.0.0.1', '::1'],
      redactSecrets: true,
    },
  });
}
