import { createServer } from 'node:http';
import { basename } from 'node:path';
import {
  createDuckDBClient,
  createNodeHandler,
  createRouter,
  jsonConsoleLogger,
  type SqlClient,
} from '@malkom/mining-core';

/**
 * Stand the HTTP surface up over node:http.
 *
 * Exists so the engine can be tried without wiring it into an application
 * first — an API nobody can curl is an API nobody learns. In a real deployment
 * the host mounts `createRouter` in its own server and keeps its own auth,
 * which is why the router is framework-agnostic and this file is thin.
 */

export interface ServeOptions {
  /** Store paths, as name=path or a bare path whose filename becomes the name. */
  stores: string[];
  port: number;
  host?: string;
  apiKey?: string;
  corsOrigin?: string;
}

export async function serve(opts: ServeOptions): Promise<void> {
  const paths = new Map<string, string>();
  for (const entry of opts.stores) {
    const eq = entry.indexOf('=');
    if (eq > 0) paths.set(entry.slice(0, eq), entry.slice(eq + 1));
    else paths.set(basename(entry).replace(/\.duckdb$/i, ''), entry);
  }
  if (paths.size === 0) throw new Error('serve needs at least one --store');

  // Opened READ-ONLY, and that matters. DuckDB allows one writer per file, so
  // a server holding a write lock blocks every other process from opening the
  // store — including the CLI, and the job that refreshes it. This process
  // only ever reads, so it should never have claimed the lock.
  //
  // Connections are opened once and reused; concurrent readers are fine.
  const open = new Map<string, SqlClient>();
  const resolveStore = async (name: string): Promise<SqlClient> => {
    const existing = open.get(name);
    if (existing !== undefined) return existing;
    const path = paths.get(name);
    if (path === undefined) {
      throw Object.assign(new Error(`unknown store ${JSON.stringify(name)}`), { status: 404 });
    }
    const client = await createDuckDBClient(path, { readOnly: true });
    open.set(name, client);
    return client;
  };

  const [defaultStore] = paths.keys();

  const router = createRouter({
    resolveStore,
    ...(defaultStore !== undefined ? { defaultStore } : {}),
    ...(opts.apiKey !== undefined ? { apiKeys: { [opts.apiKey]: 'cli' } } : {}),
    logger: jsonConsoleLogger,
  });

  const handler = createNodeHandler(router, {
    ...(opts.corsOrigin !== undefined ? { corsOrigin: opts.corsOrigin } : {}),
  });

  const server = createServer(handler);
  const host = opts.host ?? '127.0.0.1';

  await new Promise<void>((resolve) => server.listen(opts.port, host, resolve));

  const base = `http://${host}:${opts.port}`;
  process.stdout.write(`\nmalkom mining API on ${base}\n`);
  process.stdout.write(`  stores       ${[...paths.keys()].join(', ')}\n`);
  process.stdout.write(`  default      ${defaultStore ?? '(none)'}\n`);
  process.stdout.write(
    `  auth         ${opts.apiKey !== undefined ? 'x-api-key required' : 'none (bind to localhost only)'}\n`,
  );
  process.stdout.write('\ntry:\n');
  process.stdout.write(`  curl ${base}/v1\n`);
  process.stdout.write(`  curl "${base}/v1/discover?lifecycle=complete&threshold=0.05"\n`);
  process.stdout.write(`  curl "${base}/v1/variants?lifecycle=complete&top=5"\n`);
  process.stdout.write(`  curl "${base}/v1/performance?lifecycle=complete"\n`);
  process.stdout.write(
    `  curl "${base}/v1/variants?lifecycle=complete&filter=activity%3AA_DECLINED"\n`,
  );
  process.stdout.write(`  curl "${base}/v1/layout?lifecycle=complete&threshold=0.05"\n\n`);

  // Close connections on the way out so a DuckDB file is never left locked.
  const shutdown = (): void => {
    process.stdout.write('\nshutting down\n');
    server.close(() => {
      void Promise.allSettled([...open.values()].map((c) => c.close())).then(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
