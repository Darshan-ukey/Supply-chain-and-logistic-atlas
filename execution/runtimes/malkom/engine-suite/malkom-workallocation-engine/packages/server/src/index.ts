import { createServer, type Server } from 'node:http';

export type FetchHandler = (req: Request) => Promise<Response>;

/**
 * Serve a web-standard fetch handler over node:http — no web framework, no
 * dependencies. The same handler mounts unchanged in Hono/Bun/Deno.
 */
export function serveFetchHandler(handler: FetchHandler, opts: { port: number; host?: string }): Server {
  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const bodyBuf = Buffer.concat(chunks);

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(', '));
      }
      const url = `http://${req.headers.host ?? `${opts.host ?? '127.0.0.1'}:${opts.port}`}${req.url ?? '/'}`;
      const method = (req.method ?? 'GET').toUpperCase();
      const request =
        method === 'GET' || method === 'HEAD'
          ? new Request(url, { method, headers })
          : new Request(url, { method, headers, body: bodyBuf });

      let response: Response;
      try {
        response = await handler(request);
      } catch (err) {
        response = new Response(JSON.stringify({ error: { code: 'INTERNAL', message: String(err) } }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    })().catch(() => {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  });
  server.listen(opts.port, opts.host ?? '127.0.0.1');
  return server;
}
