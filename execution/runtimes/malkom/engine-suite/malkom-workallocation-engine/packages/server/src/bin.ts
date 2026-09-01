#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  AllocationEngine,
  buildFetchHandler,
  jsonConsoleLogger,
  SqliteStateStore,
} from '@malkom/alloc-core';
import { serveFetchHandler } from './index.js';

/**
 * Standalone server. Configuration by environment:
 *   MALKOM_PORT            default 7070
 *   MALKOM_HOST            default 127.0.0.1
 *   MALKOM_STATE_DB        default ./malkom-state.db
 *   MALKOM_ADMIN_KEYS      comma-separated admin API keys
 *   MALKOM_READ_KEYS       comma-separated read-only API keys
 *   MALKOM_CONFIG          path to a JSON config bundle applied at boot
 *   MALKOM_RETENTION_DAYS  run retention age (default 30)
 *   MALKOM_RETENTION_RUNS  max runs kept per queue (default 2000)
 *   MALKOM_INSTANCES       declared instance count (default 1)
 */
async function main(): Promise<void> {
  const env = process.env;
  const port = Number(env['MALKOM_PORT'] ?? 7070);
  const host = env['MALKOM_HOST'] ?? '127.0.0.1';
  const stateDb = env['MALKOM_STATE_DB'] ?? './malkom-state.db';
  const adminKeys = (env['MALKOM_ADMIN_KEYS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const readKeys = (env['MALKOM_READ_KEYS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const engine = new AllocationEngine({
    stateStore: new SqliteStateStore(stateDb),
    logger: jsonConsoleLogger,
    instances: Number(env['MALKOM_INSTANCES'] ?? 1),
    retention: {
      maxAgeMs: Number(env['MALKOM_RETENTION_DAYS'] ?? 30) * 24 * 3600_000,
      maxCountPerQueue: Number(env['MALKOM_RETENTION_RUNS'] ?? 2000),
    },
  });
  await engine.start();

  const configPath = env['MALKOM_CONFIG'];
  if (configPath !== undefined && configPath !== '') {
    const bundle: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
    const { configVersion, warnings } = await engine.applyConfig(bundle);
    jsonConsoleLogger.info({ configPath, configVersion, warnings }, 'boot config applied');
  }

  if (adminKeys.length === 0 && readKeys.length === 0) {
    jsonConsoleLogger.warn(
      {},
      'no MALKOM_ADMIN_KEYS / MALKOM_READ_KEYS configured — the control plane is OPEN. Set keys before exposing it.',
    );
  }

  const handler = buildFetchHandler(engine, { auth: { adminKeys, readKeys } });
  const server = serveFetchHandler(handler, { port, host });
  jsonConsoleLogger.info({ port, host, stateDb }, 'malkom-alloc-server listening');

  const shutdown = async (signal: string): Promise<void> => {
    jsonConsoleLogger.info({ signal }, 'shutting down');
    server.close();
    await engine.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
