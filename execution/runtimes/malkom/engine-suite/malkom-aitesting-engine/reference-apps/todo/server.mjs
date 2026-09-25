import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function createTodoServer() {
  const todos = [{ id: 'todo_1', title: 'Ship Brisk', completed: false }];
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/') return html(response, page(todos));
      if (request.method === 'GET' && url.pathname === '/api/todos') return json(response, 200, { todos, total: todos.length });
      if (request.method === 'POST' && url.pathname === '/api/todos') {
        const body = await readJson(request);
        if (typeof body.title !== 'string' || body.title.trim().length === 0) return json(response, 400, { error: { code: 'TITLE_REQUIRED' } });
        const todo = { id: `todo_${todos.length + 1}`, title: body.title, completed: false };
        todos.push(todo);
        return json(response, 201, { todo });
      }
      if (request.method === 'PATCH' && /^\/api\/todos\/[^/]+$/.test(url.pathname)) {
        const todo = todos.find((entry) => entry.id === url.pathname.split('/').pop());
        if (todo === undefined) return json(response, 404, { error: { code: 'TODO_NOT_FOUND' } });
        todo.completed = true;
        return json(response, 200, { todo });
      }
      if (request.method === 'GET' && url.pathname === '/openapi.json') return json(response, 200, JSON.parse(await readFile(join(here, 'openapi.json'), 'utf8')));
      return json(response, 404, { error: { code: 'NOT_FOUND' } });
    } catch (error) {
      return json(response, 500, { error: { code: 'SERVER_ERROR', message: String(error) } });
    }
  });
}

function page(todos) {
  const rows = todos.map((todo) => `<li>${escapeHtml(todo.title)}</li>`).join('');
  return `<!doctype html><html><head><title>Todo</title></head><body><main><h1>Todo</h1><label>Title <input name="title" /></label><button data-testid="add-todo">Add todo</button><ul>${rows}</ul></main></body></html>`;
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
