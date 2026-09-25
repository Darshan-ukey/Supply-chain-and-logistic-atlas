import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function createEcommerceServer() {
  const products = [
    { id: 'prod_keyboard', name: 'Mechanical Keyboard', price: 129, stock: 5 },
    { id: 'prod_monitor', name: 'Studio Monitor', price: 399, stock: 0 },
  ];
  const carts = new Map();
  const orders = [];

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/') return html(response, page(products));
      if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, service: 'e-commerce' });
      if (request.method === 'GET' && url.pathname === '/api/products') return json(response, 200, { products, total: products.length });
      if (request.method === 'GET' && /^\/api\/carts\/[^/]+$/.test(url.pathname)) {
        const cartId = url.pathname.split('/').pop();
        return json(response, 200, cartSummary(cartId, carts, products));
      }
      if (request.method === 'POST' && /^\/api\/carts\/[^/]+\/items$/.test(url.pathname)) {
        const [, , cartsPart, cartId] = url.pathname.split('/');
        if (cartsPart !== 'carts') return json(response, 404, { error: { code: 'NOT_FOUND' } });
        const body = await readJson(request);
        const product = products.find((entry) => entry.id === body.productId);
        const quantity = Number(body.quantity);
        if (product === undefined) return json(response, 404, { error: { code: 'PRODUCT_NOT_FOUND' } });
        if (!Number.isInteger(quantity) || quantity < 1) return json(response, 400, { error: { code: 'INVALID_QUANTITY' } });
        if (product.stock < quantity) return json(response, 409, { error: { code: 'OUT_OF_STOCK' } });
        const cart = carts.get(cartId) ?? [];
        cart.push({ productId: product.id, quantity });
        carts.set(cartId, cart);
        return json(response, 201, cartSummary(cartId, carts, products));
      }
      if (request.method === 'POST' && /^\/api\/carts\/[^/]+\/checkout$/.test(url.pathname)) {
        const cartId = url.pathname.split('/')[3];
        const cart = carts.get(cartId) ?? [];
        if (cart.length === 0) return json(response, 400, { error: { code: 'EMPTY_CART' } });
        const order = { id: `order_${orders.length + 1}`, cartId, total: cartTotal(cart, products), status: 'confirmed' };
        orders.push(order);
        carts.set(cartId, []);
        return json(response, 201, { order });
      }
      if (request.method === 'GET' && url.pathname === '/api/orders') return json(response, 200, { orders, total: orders.length });
      if (request.method === 'GET' && url.pathname === '/openapi.json') return json(response, 200, JSON.parse(await readFile(join(here, 'openapi.json'), 'utf8')));
      return json(response, 404, { error: { code: 'NOT_FOUND' } });
    } catch (error) {
      return json(response, 500, { error: { code: 'SERVER_ERROR', message: String(error) } });
    }
  });
}

function page(products) {
  const rows = products.map((product) => `<li>${escapeHtml(product.name)} - $${product.price} - ${product.stock} in stock</li>`).join('');
  return `<!doctype html><html><head><title>Commerce Proof App</title></head><body><main><h1>Commerce Proof App</h1><button data-testid="cart">Cart</button><section aria-label="Products"><ul>${rows}</ul></section></main></body></html>`;
}

function cartSummary(cartId, carts, products) {
  const items = carts.get(cartId) ?? [];
  return { cartId, items, totalItems: items.reduce((sum, item) => sum + item.quantity, 0), total: cartTotal(items, products) };
}

function cartTotal(items, products) {
  return items.reduce((sum, item) => sum + item.quantity * (products.find((product) => product.id === item.productId)?.price ?? 0), 0);
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
