#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  buildFetchHandler,
  jsonConsoleLogger,
  MetricsEngine,
  type RegistryDocInput,
} from '@malkom/metrics-core';
import { DEFAULT_MAX_BODY_BYTES, drainAndStop, serveFetchHandler } from './index.js';

/**
 * Standalone server. Configuration by flags and environment — a flag beats
 * its env var, the env var beats the documented default (the rules-server
 * pattern, with `MALKOM_METRICS_` as this engine's prefix):
 *
 *   --port            MALKOM_METRICS_PORT            default 7072
 *   --host            MALKOM_METRICS_HOST            default 127.0.0.1
 *   --state-db        MALKOM_METRICS_STATE_DB        default ./malkom-metrics-state.db (":memory:" works)
 *   --registry        MALKOM_METRICS_REGISTRY        path to a JSON registry document applied at boot
 *   --scheduler       MALKOM_METRICS_SCHEDULER       "true" starts the rollup scheduler (default false)
 *   --max-body-bytes  MALKOM_METRICS_MAX_BODY_BYTES  request-body budget, default 1048576 (1 MiB);
 *                                                    over-budget bodies are 413'd before auth or parsing
 *                     MALKOM_METRICS_ADMIN_KEYS      comma-separated admin API keys
 *                     MALKOM_METRICS_READ_KEYS       comma-separated read-only API keys
 *
 * Shutdown: the FIRST SIGINT/SIGTERM drains — the listener closes, in-flight
 * requests finish, then the engine stops (scheduler drained, store closed) —
 * and the process exits 0. A SECOND signal during the drain forces immediate
 * exit 130 (the operator insisted).
 */

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function setting(args: string[], flagName: string, envName: string): string | undefined {
  const fromFlag = flag(args, flagName);
  if (fromFlag !== undefined) return fromFlag;
  const fromEnv = process.env[envName];
  return fromEnv !== undefined && fromEnv.trim() !== '' ? fromEnv : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const portRaw = setting(args, '--port', 'MALKOM_METRICS_PORT');
  const port = portRaw === undefined ? 7072 : Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid port: ${JSON.stringify(portRaw)}`);
  }
  const host = setting(args, '--host', 'MALKOM_METRICS_HOST') ?? '127.0.0.1';
  const stateDb = setting(args, '--state-db', 'MALKOM_METRICS_STATE_DB') ?? './malkom-metrics-state.db';
  const schedulerRaw = setting(args, '--scheduler', 'MALKOM_METRICS_SCHEDULER') ?? 'false';
  const scheduler = schedulerRaw === 'true' || schedulerRaw === '1';
  const maxBodyRaw = setting(args, '--max-body-bytes', 'MALKOM_METRICS_MAX_BODY_BYTES');
  const maxBodyBytes = maxBodyRaw === undefined ? DEFAULT_MAX_BODY_BYTES : Number(maxBodyRaw);
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new Error(`invalid max-body-bytes: ${JSON.stringify(maxBodyRaw)}`);
  }
  const adminKeys = (process.env['MALKOM_METRICS_ADMIN_KEYS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const readKeys = (process.env['MALKOM_METRICS_READ_KEYS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const engine = new MetricsEngine({
    state: { kind: 'sqlite', path: stateDb },
    logger: jsonConsoleLogger,
    auth: { adminKeys, readKeys },
    scheduler: { enabled: scheduler },
  });
  await engine.start();

  const registryPath = setting(args, '--registry', 'MALKOM_METRICS_REGISTRY');
  if (registryPath !== undefined) {
    const doc = JSON.parse(readFileSync(registryPath, 'utf8')) as RegistryDocInput;
    const { version, hash } = await engine.applyRegistry(doc);
    jsonConsoleLogger.info({ registryPath, version, hash }, 'boot registry applied');
  }

  // ApiAuth is the single source of truth for what "open" means.
  if (engine.auth.open) {
    jsonConsoleLogger.warn(
      {},
      'no MALKOM_METRICS_ADMIN_KEYS / MALKOM_METRICS_READ_KEYS configured — the control plane is OPEN. Set keys before exposing it.',
    );
  }

  const handler = buildFetchHandler(engine);
  const server = serveFetchHandler(handler, { port, host, maxBodyBytes });
  jsonConsoleLogger.info(
    { url: `http://${host}:${port}`, stateDb, scheduler, maxBodyBytes },
    'malkom-metrics-server listening',
  );

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      // Second signal: the operator insists — skip the drain, exit now.
      jsonConsoleLogger.warn({ signal }, 'second signal during drain — forcing exit');
      process.exit(130);
    }
    shuttingDown = true;
    jsonConsoleLogger.info({ signal }, 'shutting down — draining in-flight requests');
    // Drain first (in-flight responses complete), THEN stop the engine
    // (scheduler drained, store closed), THEN exit — never racing them.
    drainAndStop(server, () => engine.stop())
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        console.error(err);
        process.exit(1);
      });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
