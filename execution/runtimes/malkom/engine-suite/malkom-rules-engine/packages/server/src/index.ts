import { createServer, type Server } from 'node:http';
import { Readable } from 'node:stream';
import type { FetchHandler } from '@malkom/rules-core';

export type { FetchHandler };

/**
 * Serve a web-standard fetch handler over node:http — no web framework, no
 * dependencies. The same handler mounts unchanged in Hono/Bun/Deno.
 */
export function serveFetchHandler(handler: FetchHandler, opts: { port: number; host?: string }): Server {
  const server = createServer((req, res) => {
    void (async () => {
      const method = (req.method ?? 'GET').toUpperCase();
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(', '));
      }
      const url = `http://${req.headers.host ?? `${opts.host ?? '127.0.0.1'}:${opts.port}`}${req.url ?? '/'}`;

      let request: Request;
      if (method === 'GET' || method === 'HEAD') {
        // No body to drain — don't pay for one.
        request = new Request(url, { method, headers });
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
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
