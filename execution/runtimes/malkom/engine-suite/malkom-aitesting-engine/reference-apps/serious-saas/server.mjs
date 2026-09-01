import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function createSeriousSaasServer() {
  const state = createInitialState();

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (request.method === 'GET' && url.pathname === '/api/health') {
        return json(response, 200, { ok: true, service: 'serious-saas' });
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        const body = await readJson(request);
        const user = state.accounts.find((account) => account.email === body.email && account.password === body.password);
        if (user === undefined) {
          state.auditEvents.push({ id: `audit_${state.auditEvents.length + 1}`, action: 'login.failed', actor: String(body.email ?? 'unknown') });
          return json(response, 401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        }
        state.auditEvents.push({ id: `audit_${state.auditEvents.length + 1}`, action: 'login.succeeded', actor: user.email });
        return json(response, 200, { token: user.token, user: publicUser(user) });
      }

      if (request.method === 'GET' && url.pathname === '/api/me') {
        const account = authenticate(request, state);
        if (account === undefined) return json(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
        return json(response, 200, { user: publicUser(account) });
      }

      if (request.method === 'GET' && url.pathname === '/api/users') {
        const account = authenticate(request, state);
        if (account === undefined) return json(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
        return json(response, 200, { users: state.users, total: state.users.length });
      }

      if (request.method === 'POST' && url.pathname === '/api/users') {
        const account = authenticate(request, state);
        if (account === undefined) return json(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
        if (account.role !== 'admin') return json(response, 403, { error: { code: 'FORBIDDEN', message: 'Only admins can create users' } });
        const body = await readJson(request);
        if (typeof body.name !== 'string' || body.name.trim().length === 0) {
          return json(response, 400, { error: { code: 'NAME_REQUIRED', message: 'name is required' } });
        }
        if (typeof body.email !== 'string' || !body.email.includes('@')) {
          return json(response, 400, { error: { code: 'EMAIL_INVALID', message: 'email must be valid' } });
        }
        const user = { id: `user_${state.users.length + 1}`, name: body.name, email: body.email, role: body.role === 'viewer' ? 'viewer' : 'admin' };
        state.users.push(user);
        state.auditEvents.push({ id: `audit_${state.auditEvents.length + 1}`, action: 'user.created', actor: account.email, target: user.email });
        return json(response, 201, { user });
      }

      if (request.method === 'GET' && url.pathname === '/api/audit-events') {
        const account = authenticate(request, state);
        if (account === undefined) return json(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
        if (account.role !== 'admin') return json(response, 403, { error: { code: 'FORBIDDEN', message: 'Only admins can inspect audit events' } });
        return json(response, 200, { events: state.auditEvents, total: state.auditEvents.length });
      }

      if (request.method === 'POST' && url.pathname === '/login') {
        const form = new URLSearchParams(await readText(request));
        const user = state.accounts.find((account) => account.email === form.get('email') && account.password === form.get('password'));
        if (user === undefined) return html(response, page('Login failed', '<p role="alert">Invalid email or password</p>'));
        return html(response, page('Dashboard', `<h1>Dashboard</h1><p>Welcome ${escapeHtml(user.email)}</p><a href="/users">Users</a>`));
      }

      if (request.method === 'GET' && url.pathname === '/login') return html(response, loginPage());
      if (request.method === 'GET' && url.pathname === '/dashboard') return html(response, page('Dashboard', '<h1>Dashboard</h1><p>Operational overview</p><a href="/users">Users</a>'));
      if (request.method === 'GET' && url.pathname === '/users') return html(response, usersPage(state));
      if (request.method === 'GET' && url.pathname === '/') return html(response, page('Serious SaaS', '<h1>Serious SaaS</h1><a href="/login">Login</a><a href="/dashboard">Dashboard</a>'));
      if (request.method === 'GET' && url.pathname === '/openapi.json') {
        return json(response, 200, JSON.parse(await readFile(join(here, 'openapi.json'), 'utf8')));
      }

      return json(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
    } catch (error) {
      return json(response, 500, { error: { code: 'SERVER_ERROR', message: error instanceof Error ? error.message : String(error) } });
    }
  });
}

function createInitialState() {
  return {
    accounts: [
      { id: 'acct_admin', email: 'admin@example.com', password: 'admin-password', role: 'admin', token: 'admin-token' },
      { id: 'acct_viewer', email: 'viewer@example.com', password: 'viewer-password', role: 'viewer', token: 'viewer-token' },
    ],
    users: [
      { id: 'user_1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin' },
      { id: 'user_2', name: 'Vera Viewer', email: 'vera@example.com', role: 'viewer' },
    ],
    auditEvents: [
      { id: 'audit_1', action: 'system.seeded', actor: 'system' },
    ],
  };
}

function authenticate(request, state) {
  const authorization = request.headers.authorization ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  return state.accounts.find((account) => account.token === token);
}

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role };
}

async function readJson(request) {
  const text = await readText(request);
  return text.trim().length > 0 ? JSON.parse(text) : {};
}

async function readText(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function html(response, content) {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(content);
}

function loginPage() {
  return page('Login', `
    <h1>Login</h1>
    <form method="post" action="/login">
      <label>Email <input name="email" type="email" /></label>
      <label>Password <input name="password" type="password" /></label>
      <button type="submit">Sign in</button>
    </form>
  `);
}

function usersPage(state) {
  const rows = state.users.map((user) => `<li>${escapeHtml(user.name)} (${escapeHtml(user.role)})</li>`).join('');
  return page('Users', `
    <h1>Users</h1>
    <ul>${rows}</ul>
    <form method="post" action="/users">
      <label>Name <input name="name" /></label>
      <label>Email <input name="email" type="email" /></label>
      <button type="submit">Create user</button>
    </form>
  `);
}

function page(title, body) {
  return `<!doctype html>
<html>
  <head><title>${escapeHtml(title)}</title></head>
  <body><main>${body}</main></body>
</html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const server = createSeriousSaasServer();
  server.listen(3000, '127.0.0.1', () => {
    console.log('serious-saas reference app listening on http://127.0.0.1:3000');
  });
}
