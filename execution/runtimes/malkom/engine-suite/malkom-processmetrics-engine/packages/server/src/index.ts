import { createServer, type Server } from 'node:http';
import { Readable } from 'node:stream';
import type { FetchHandler } from '@malkom/metrics-core';

export type { FetchHandler };

/**
 * The documented default request-body budget: 1 MiB. Configurable per server
 * via ServeOptions.maxBodyBytes (the bin wires `--max-body-bytes` /
 * MALKOM_METRICS_MAX_BODY_BYTES to it). Registry documents and definitions
 * are small JSON — anything beyond this is a mistake or an attack.
 */
export const DEFAULT_MAX_BODY_BYTES = 1_048_576;

export interface ServeOptions {
  port: number;
  host?: string;
  /**
   * Hard cap on request-body bytes, enforced BEFORE the fetch handler (and
   * therefore before auth ever sees the request): a declared Content-Length
   * over budget is refused 413 immediately, and a streamed body is aborted
   * the moment its byte count crosses the budget — the shell never buffers
   * an unbounded body for a caller that presented no key.
   * Default DEFAULT_MAX_BODY_BYTES (1 MiB).
   */
  maxBodyBytes?: number;
}

const PAYLOAD_TOO_LARGE = JSON.stringify({
  error: { code: 'PAYLOAD_TOO_LARGE', message: 'request body exceeds the configured max-body-bytes budget' },
});

/**
 * Serve a web-standard fetch handler over node:http — no web framework, no
 * dependencies. The same handler mounts unchanged in Hono/Bun/Deno.
 * Response bodies are STREAMED to the socket (Readable.fromWeb), never
 * buffered into a second copy — the rules-engine review lesson.
 *
 * Request bodies ARE buffered (the handler wants a whole JSON document), so
 * the budget above is the memory-safety boundary: without it one keyless
 * over-sized PUT would balloon RSS before auth ran.
 */
export function serveFetchHandler(handler: FetchHandler, opts: ServeOptions): Server {
  const maxBodyBytes = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new Error(`invalid maxBodyBytes: ${JSON.stringify(opts.maxBodyBytes)} — must be a positive integer`);
  }
  const server = createServer((req, res) => {
    void (async () => {
      const method = (req.method ?? 'GET').toUpperCase();
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(', '));
      }
      const url = `http://${req.headers.host ?? `${opts.host ?? '127.0.0.1'}:${opts.port}`}${req.url ?? '/'}`;

      /** Refuse an over-budget body: 413, then drop the connection — the
       * client would otherwise keep streaming into a socket nobody reads. */
      const refusePayload = (): void => {
        res.writeHead(413, { 'content-type': 'application/json; charset=utf-8', connection: 'close' });
        // Destroy the socket AFTER the 413 flushes — the client must not
        // keep streaming into a connection nobody reads.
        res.end(PAYLOAD_TOO_LARGE, () => req.destroy());
      };

      let request: Request;
      if (method === 'GET' || method === 'HEAD') {
        // No body to drain — don't pay for one.
        request = new Request(url, { method, headers });
      } else {
        // Cheap first check: an honest Content-Length over budget never
        // buffers a byte.
        const declared = Number(req.headers['content-length']);
        if (Number.isFinite(declared) && declared > maxBodyBytes) {
          refusePayload();
          return;
        }
        // Streamed enforcement: chunked (or lying) senders are cut off the
        // moment the running byte count crosses the budget.
        const chunks: Buffer[] = [];
        let received = 0;
        for await (const chunk of req) {
          const buf = chunk as Buffer;
          received += buf.length;
          if (received > maxBodyBytes) {
            refusePayload();
            return;
          }
          chunks.push(buf);
        }
        request = new Request(url, { method, headers, body: Buffer.concat(chunks) });
      }

      let response: Response;
      try {
        response = await handler(request);
      } catch {
        // Same envelope the router's errorResponse produces — one 500 format.
        response = new Response(
          JSON.stringify({ error: { code: 'INTERNAL', message: 'internal error' } }),
          { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
        );
      }
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res);
      } else {
        res.end();
      }
    })().catch(() => {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  });
  server.listen(opts.port, opts.host ?? '127.0.0.1');
  return server;
}

/**
 * Drain, then stop: close the listener and wait for every in-flight request
 * to finish (idle keep-alive sockets are closed immediately so the drain
 * cannot hang on them), and only THEN run `stop` (engine.stop() closes the
 * state store — under the old fire-and-forget order it closed underneath
 * in-flight requests). The bin awaits this before process.exit.
 */
export async function drainAndStop(server: Server, stop: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeIdleConnections();
  });
  await stop();
}
