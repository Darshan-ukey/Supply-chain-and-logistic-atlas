import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function createMultiTenantServer() {
  const tenants = {
    alpha: { projects: [{ id: 'alpha_project_1', name: 'Alpha Launch' }] },
    beta: { projects: [{ id: 'beta_project_1', name: 'Beta Pilot' }] },
  };
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/') return html(response, '<!doctype html><html><head><title>Tenants</title></head><body><main><h1>Tenants</h1><a href="/tenant/alpha">Alpha</a><a href="/tenant/beta">Beta</a></main></body></html>');
      if (request.method === 'GET' && /^\/tenant\/[^/]+$/.test(url.pathname)) {
        const tenantId = url.pathname.split('/').pop();
        return html(response, `<!doctype html><html><head><title>${tenantId}</title></head><body><main><h1>Tenant ${tenantId}</h1><button data-testid="project-action">Projects</button></main></body></html>`);
      }
      const match = url.pathname.match(/^\/api\/tenants\/([^/]+)\/projects$/);
      if (request.method === 'GET' && match) {
        const tenantId = match[1];
        const account = authorize(request, tenantId);
        if (!account.ok) return json(response, account.status, { error: { code: account.code } });
        return json(response, 200, { tenantId, projects: tenants[tenantId]?.projects ?? [], total: tenants[tenantId]?.projects.length ?? 0 });
      }
      if (request.method === 'POST' && match) {
        const tenantId = match[1];
        const account = authorize(request, tenantId);
        if (!account.ok) return json(response, account.status, { error: { code: account.code } });
        const body = await readJson(request);
        if (typeof body.name !== 'string' || body.name.trim().length === 0) return json(response, 400, { error: { code: 'PROJECT_NAME_REQUIRED' } });
        const project = { id: `${tenantId}_project_${(tenants[tenantId]?.projects.length ?? 0) + 1}`, name: body.name };
        tenants[tenantId] ??= { projects: [] };
        tenants[tenantId].projects.push(project);
        return json(response, 201, { tenantId, project });
      }
      if (request.method === 'GET' && url.pathname === '/openapi.json') return json(response, 200, JSON.parse(await readFile(join(here, 'openapi.json'), 'utf8')));
      return json(response, 404, { error: { code: 'NOT_FOUND' } });
    } catch (error) {
      return json(response, 500, { error: { code: 'SERVER_ERROR', message: String(error) } });
    }
  });
}

function authorize(request, tenantId) {
  const token = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (token.length === 0) return { ok: false, status: 401, code: 'UNAUTHORIZED' };
  if (token !== `${tenantId}-token`) return { ok: false, status: 403, code: 'TENANT_FORBIDDEN' };
  return { ok: true };
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

function html(response, content) {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(content);
}
