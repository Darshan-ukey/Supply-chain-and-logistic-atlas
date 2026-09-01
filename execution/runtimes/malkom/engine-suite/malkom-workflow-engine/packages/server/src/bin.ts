#!/usr/bin/env node
import { createServer } from 'node:http';
import {
  buildFetchHandler,
  WorkflowEngine,
  SqliteWorkflowStateStore,
} from '@malkom/workflow-core';

/**
 * Standalone server. Configuration by environment:
 *   MALKOM_WORKFLOW_PORT        default 7077
 *   MALKOM_WORKFLOW_HOST        default 127.0.0.1
 *   MALKOM_WORKFLOW_STATE_DB    default ./malkom-workflow-state.db (":memory:" works)
 *   MALKOM_WORKFLOW_ADMIN_KEYS  comma-separated admin API keys
 *   MALKOM_WORKFLOW_READ_KEYS   comma-separated read-only API keys
 */
function main(): void {
  const env = process.env;
  const portRaw = env['MALKOM_WORKFLOW_PORT'];
  const port = portRaw === undefined || portRaw.trim() === '' ? 7077 : Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid MALKOM_WORKFLOW_PORT: ${JSON.stringify(portRaw)}`);
  }
  const host = env['MALKOM_WORKFLOW_HOST'] ?? '127.0.0.1';
  const stateDb = env['MALKOM_WORKFLOW_STATE_DB'] ?? './malkom-workflow-state.db';
  const adminKeys = (env['MALKOM_WORKFLOW_ADMIN_KEYS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const readKeys = (env['MALKOM_WORKFLOW_READ_KEYS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const engine = new WorkflowEngine({ stateStore: new SqliteWorkflowStateStore(stateDb) });
  if (adminKeys.length === 0 && readKeys.length === 0) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'no API keys configured — the control plane is OPEN' }));
  }
  const handler = buildFetchHandler(engine, { adminKeys, readKeys });

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        const bodyText = Buffer.concat(chunks).toString('utf8');
        const request = new Request(`http://${host}:${port}${req.url ?? '/'}`, {
          method: req.method ?? 'GET',
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : (value ?? '')]),
          ),
          ...(bodyText !== '' && req.method !== 'GET' && req.method !== 'HEAD' ? { body: bodyText } : {}),
        });
        const response = await handler(request);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(await response.text());
      })().catch((error: unknown) => {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'internal', message: (error as Error).message } }));
      });
    });
  });

  server.listen(port, host, () => {
    console.log(JSON.stringify({ level: 'info', msg: `malkom-workflow listening on ${host}:${port}`, stateDb }));
  });

  const shutdown = (): void => {
    server.close(() => {
      engine.stop();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
