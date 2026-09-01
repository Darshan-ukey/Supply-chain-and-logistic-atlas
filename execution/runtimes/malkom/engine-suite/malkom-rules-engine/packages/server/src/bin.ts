#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  ApiAuth,
  RulesEngine,
  buildFetchHandler,
  jsonConsoleLogger,
  SqliteRulesStateStore,
  type RegistryDocInput,
} from '@malkom/rules-core';
import { serveFetchHandler } from './index.js';

/**
 * Standalone server. Configuration by environment:
 *   MALKOM_RULES_PORT        default 7071
 *   MALKOM_RULES_HOST        default 127.0.0.1
 *   MALKOM_RULES_STATE_DB    default ./malkom-rules-state.db (":memory:" works)
 *   MALKOM_RULES_ADMIN_KEYS  comma-separated admin API keys
 *   MALKOM_RULES_READ_KEYS   comma-separated read-only API keys
 *   MALKOM_RULES_REGISTRY    path to a JSON registry document applied at boot
 */
async function main(): Promise<void> {
  const env = process.env;
  const portRaw = env['MALKOM_RULES_PORT'];
  const port = portRaw === undefined || portRaw.trim() === '' ? 7071 : Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid MALKOM_RULES_PORT: ${JSON.stringify(portRaw)}`);
  }
  const host = env['MALKOM_RULES_HOST'] ?? '127.0.0.1';
  const stateDb = env['MALKOM_RULES_STATE_DB'] ?? './malkom-rules-state.db';
  const adminKeys = (env['MALKOM_RULES_ADMIN_KEYS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const readKeys = (env['MALKOM_RULES_READ_KEYS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const engine = new RulesEngine({
    stateStore: new SqliteRulesStateStore(stateDb),
    logger: jsonConsoleLogger,
  });
  await engine.start();

  const registryPath = env['MALKOM_RULES_REGISTRY'];
  if (registryPath !== undefined && registryPath !== '') {
    const doc = JSON.parse(readFileSync(registryPath, 'utf8')) as RegistryDocInput;
    const { version, hash } = await engine.applyRegistry(doc);
    jsonConsoleLogger.info({ registryPath, version, hash }, 'boot registry applied');
  }

  // ApiAuth is the single source of truth for what "open" means.
  if (new ApiAuth({ adminKeys, readKeys }).open) {
    jsonConsoleLogger.warn(
      {},
      'no MALKOM_RULES_ADMIN_KEYS / MALKOM_RULES_READ_KEYS configured — the control plane is OPEN. Set keys before exposing it.',
    );
  }

  const handler = buildFetchHandler(engine, { auth: { adminKeys, readKeys } });
  const server = serveFetchHandler(handler, { port, host });
  jsonConsoleLogger.info({ url: `http://${host}:${port}`, stateDb }, 'malkom-rules-server listening');

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
