import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function createEventMessagingServer() {
  const channels = [{ id: 'channel_default', name: 'Default Channel' }];
  const topics = [{ id: 'topic_default', channelId: 'channel_default', name: 'orders.created' }];
  const subscriptions = [{ id: 'sub_default', topicId: 'topic_default', delivered: [] }];
  const metrics = { published: 0, delivered: 0 };

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/') return html(response, homePage());
      if (request.method === 'GET' && url.pathname === '/playground') return html(response, playgroundPage());
      if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, service: 'event-messaging' });
      if (request.method === 'GET' && url.pathname === '/api/channels') return json(response, 200, { channels, total: channels.length });
      if (request.method === 'POST' && url.pathname === '/api/channels') {
        const body = await readJson(request);
        if (typeof body.name !== 'string' || body.name.trim().length === 0) return json(response, 400, { error: { code: 'CHANNEL_NAME_REQUIRED' } });
        const channel = { id: `channel_${channels.length + 1}`, name: body.name };
        channels.push(channel);
        return json(response, 201, { channel });
      }
      if (request.method === 'POST' && /^\/api\/channels\/[^/]+\/topics$/.test(url.pathname)) {
        const channelId = url.pathname.split('/')[3];
        if (!channels.some((channel) => channel.id === channelId)) return json(response, 404, { error: { code: 'CHANNEL_NOT_FOUND' } });
        const body = await readJson(request);
        if (typeof body.name !== 'string' || body.name.trim().length === 0) return json(response, 400, { error: { code: 'TOPIC_NAME_REQUIRED' } });
        const topic = { id: `topic_${topics.length + 1}`, channelId, name: body.name };
        topics.push(topic);
        return json(response, 201, { topic });
      }
      if (request.method === 'POST' && /^\/api\/topics\/[^/]+\/subscriptions$/.test(url.pathname)) {
        const topicId = url.pathname.split('/')[3];
        if (!topics.some((topic) => topic.id === topicId)) return json(response, 404, { error: { code: 'TOPIC_NOT_FOUND' } });
        const subscription = { id: `sub_${subscriptions.length + 1}`, topicId, delivered: [] };
        subscriptions.push(subscription);
        return json(response, 201, { subscription });
      }
      if (request.method === 'POST' && /^\/api\/topics\/[^/]+\/messages$/.test(url.pathname)) {
        const topicId = url.pathname.split('/')[3];
        const topic = topics.find((entry) => entry.id === topicId);
        if (topic === undefined) return json(response, 404, { error: { code: 'TOPIC_NOT_FOUND' } });
        const body = await readJson(request);
        if (!isRecord(body.payload)) return json(response, 400, { error: { code: 'MESSAGE_PAYLOAD_REQUIRED' } });
        const message = { id: `msg_${metrics.published + 1}`, topicId, payload: body.payload };
        metrics.published += 1;
        for (const subscription of subscriptions.filter((entry) => entry.topicId === topicId)) {
          subscription.delivered.push(message);
          metrics.delivered += 1;
        }
        return json(response, 202, { messageId: message.id, delivered: subscriptions.filter((entry) => entry.topicId === topicId).length });
      }
      if (request.method === 'GET' && /^\/api\/subscriptions\/[^/]+\/messages$/.test(url.pathname)) {
        const subscriptionId = url.pathname.split('/')[3];
        const subscription = subscriptions.find((entry) => entry.id === subscriptionId);
        if (subscription === undefined) return json(response, 404, { error: { code: 'SUBSCRIPTION_NOT_FOUND' } });
        return json(response, 200, { subscriptionId, messages: subscription.delivered, total: subscription.delivered.length });
      }
      if (request.method === 'GET' && url.pathname === '/api/metrics') return json(response, 200, metrics);
      if (request.method === 'GET' && url.pathname === '/openapi.json') return json(response, 200, JSON.parse(await readFile(join(here, 'openapi.json'), 'utf8')));
      if (request.method === 'GET' && url.pathname === '/asyncapi.json') return json(response, 200, JSON.parse(await readFile(join(here, 'asyncapi.json'), 'utf8')));
      return json(response, 404, { error: { code: 'NOT_FOUND' } });
    } catch (error) {
      return json(response, 500, { error: { code: 'SERVER_ERROR', message: String(error) } });
    }
  });
}

function homePage() {
  return '<!doctype html><html><head><title>Event Messaging Proof App</title></head><body><main><h1>Event Messaging Proof App</h1><a href="/playground">Playground</a><section aria-label="Channels">Default Channel</section></main></body></html>';
}

function playgroundPage() {
  return '<!doctype html><html><head><title>Messaging Playground</title></head><body><main><h1>Messaging Playground</h1><label>Payload <textarea name="payload">{ "orderId": "order_1" }</textarea></label><button data-testid="publish-message">Publish Message</button></main></body></html>';
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

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
