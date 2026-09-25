import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function createApiOnlyServer() {
  const items = [{ id: 'item_1', name: 'Alpha' }];
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, service: 'api-only' });
      if (request.method === 'GET' && url.pathname === '/api/items') return json(response, 200, { items, total: items.length });
      if (request.method === 'POST' && url.pathname === '/api/items') {
        const body = await readJson(request);
        if (typeof body.name !== 'string' || body.name.trim().length === 0) return json(response, 400, { error: { code: 'NAME_REQUIRED' } });
        const item = { id: `item_${items.length + 1}`, name: body.name };
        items.push(item);
        return json(response, 201, { item });
      }
      if (request.method === 'GET' && url.pathname === '/openapi.json') return json(response, 200, JSON.parse(await readFile(join(here, 'openapi.json'), 'utf8')));
      return json(response, 404, { error: { code: 'NOT_FOUND' } });
    } catch (error) {
      return json(response, 500, { error: { code: 'SERVER_ERROR', message: String(error) } });
    }
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8');
  return text.trim().length > 0 ? JSON.parse(text) : {};
}

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}
