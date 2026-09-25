import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MiningRequest, MiningResponse } from './router.js';

/**
 * Adapter from node:http to the framework-agnostic router.
 *
 * Deliberately thin, and deliberately here rather than in the router: the
 * router stays usable under Express, Fastify, a Next.js route handler or a
 * Lambda, and each of those needs its own dozen lines like these. Shipping one
 * for node:http means a host can stand the engine up with no framework at all.
 */

export interface NodeAdapterOptions {
  /** Strip this prefix before routing, e.g. '/mining' when mounted there. */
  mountPath?: string;
  /**
   * Largest JSON body accepted, in bytes. Default 4 MB — generous for a filter
   * or a process tree, and a bound rather than an open door.
   */
  maxBodyBytes?: number;
  /**
   * Allowed CORS origin. Omit to send no CORS headers at all, which is right
   * when the host serves the UI from the same origin.
   */
  corsOrigin?: string;
}

const DEFAULT_MAX_BODY = 4 * 1024 * 1024;

export function createNodeHandler(
  route: (req: MiningRequest) => Promise<MiningResponse>,
  opts: NodeAdapterOptions = {},
): (req: IncomingMessage, res: ServerResponse) => void {
  const maxBody = opts.maxBodyBytes ?? DEFAULT_MAX_BODY;

  return (req, res) => {
    void (async () => {
      try {
        // A relative URL needs a base to parse; the host is irrelevant since
        // only the path and query are used.
        const url = new URL(req.url ?? '/', 'http://localhost');
        let path = url.pathname;
        if (opts.mountPath !== undefined && path.startsWith(opts.mountPath)) {
          path = path.slice(opts.mountPath.length) || '/';
        }

        if (opts.corsOrigin !== undefined) {
          res.setHeader('access-control-allow-origin', opts.corsOrigin);
          res.setHeader('access-control-allow-headers', 'content-type, x-api-key');
          res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
          if (req.method === 'OPTIONS') {
            res.writeHead(204).end();
            return;
          }
        }

        const body = req.method === 'POST' ? await readJsonBody(req, maxBody) : undefined;

        const headers: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }

        const response = await route({
          method: req.method ?? 'GET',
          path,
          query: url.searchParams,
          body,
          headers,
        });

        res.writeHead(response.status, response.headers);
        res.end(JSON.stringify(response.body));
      } catch (err) {
        // Reaching here means the adapter itself failed — a malformed body, a
        // socket error. The router handles everything else.
        const message = err instanceof Error ? err.message : 'bad request';
        if (!res.headersSent) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        }
        res.end(JSON.stringify({ error: { code: 'BAD_REQUEST', message } }));
      }
    })();
  };
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.length;
    // Stop reading at the limit rather than buffering the whole thing and
    // rejecting afterwards.
    if (size > maxBytes) throw new Error(`request body exceeds ${maxBytes} bytes`);
    chunks.push(buffer);
  }

  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('request body is not valid JSON');
  }
}
