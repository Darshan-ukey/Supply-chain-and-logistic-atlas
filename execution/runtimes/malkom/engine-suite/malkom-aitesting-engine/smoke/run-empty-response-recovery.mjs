import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AiIntentPlanner,
  BuiltinDiscoverer,
  createAiProviderFromConfig,
  createEvidenceGraph,
  defineConfig,
  normalizeConfig,
} from '../dist/index.js';

// A sized output budget pays only for visible text. A deployment that bills
// hidden reasoning against the same budget can burn a small budget before
// writing anything, which surfaces as an empty answer or a thrown provider
// error on the very first planning call. This suite proves the engine treats
// that as a budget problem: one retry without the hint (full host budget),
// outline failure falls back to writing the request as one piece, and the
// built-in provider reports the response evidence instead of silence.

const here = dirname(fileURLToPath(import.meta.url));
const errors = [];

const appServer = createServer((request, response) => {
  if (request.url === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, service: 'empty-response-fixture' }));
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><html><body><main>Fixture app</main></body></html>');
});
await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
const appAddress = appServer.address();
if (appAddress === null || typeof appAddress === 'string') throw new Error('Fixture app server did not expose a TCP port');

try {
  const config = normalizeConfig(defineConfig({
    app: {
      name: 'Empty response fixture app',
      baseUrl: `http://127.0.0.1:${appAddress.port}`,
      repoPath: join(here, 'site'),
      env: 'local',
    },
    auth: { type: 'none' },
    ai: {
      provider: 'openai-compatible',
      model: 'fixture-model',
      apiKeyEnv: 'BRISK_AITESTING_AI_API_KEY',
      repairAttempts: 1,
    },
    runtime: {
      artifactsDir: '.brisk-aitesting-fixtures/artifacts',
      timeoutMs: 30000,
      retries: 0,
      headless: true,
      dryRun: false,
    },
    discovery: {
      includeRepo: true,
      includeUi: true,
      includeApi: true,
      includeContracts: false,
      uiRoutes: ['/'],
      apiRoutes: [{ method: 'GET', path: '/api/health' }],
    },
    security: {
      networkPolicy: 'localhost-only',
      allowedHosts: ['localhost', '127.0.0.1'],
      redactSecrets: true,
      allowFallbackTargets: true,
      allowAiTargets: true,
    },
  }));
  const runId = `empty_recovery_${randomUUID()}`;
  const discovery = await new BuiltinDiscoverer().discover({ config, input: { goal: 'empty response recovery' }, runId });
  const evidence = createEvidenceGraph([]);
  const contextFor = (scenarios) => ({
    config,
    input: { goal: 'empty response recovery', scenarios, mode: 'automatic', requiredTypes: ['api'], scenarioCountPolicy: 'exact' },
    runId,
    discovery,
  });

  let idCounter = 0;
  const outlineJson = (count) => JSON.stringify({
    checks: Array.from({ length: count }, (_, index) => ({ id: `check_${index + 1}`, name: `Check ${index + 1}` })),
  });
  const intentJson = (count) => JSON.stringify({
    scenarios: Array.from({ length: count }, () => {
      idCounter += 1;
      return {
        id: `intent_${idCounter}`,
        name: `Intent ${idCounter}`,
        objective: `Prove behavior ${idCounter} works`,
        actions: [{ id: `action_${idCounter}`, verb: 'read', resource: 'home', expectedOutcomes: ['result is available'] }],
        invariants: [],
        evidenceRequired: ['observable result'],
        cleanup: 'automatic',
      };
    }),
    warnings: [],
  });
  const scripted = (script) => {
    const calls = [];
    return {
      calls,
      provider: {
        name: 'scripted-empty-response-provider',
        async complete(request) {
          calls.push({ purpose: request.purpose, hint: request.maxOutputTokensHint });
          const step = script[calls.length - 1] ?? script[script.length - 1];
          return step(request, calls.length);
        },
      },
    };
  };
  const summary = (calls) => calls.map((call) => `${call.purpose}${call.hint === undefined ? ':full' : ':sized'}`).join(',');

  // 1. The production failure: the sized outline call returns no text. The
  //    retry must repeat the outline with the hint absent, then batches write.
  {
    const { calls, provider } = scripted([
      () => ({ content: '' }),
      (request) => {
        if (request.maxOutputTokensHint !== undefined) throw new Error('recovery call must not carry a budget hint');
        return { content: outlineJson(6) };
      },
      () => ({ content: intentJson(3) }),
      () => ({ content: intentJson(3) }),
    ]);
    const intent = await new AiIntentPlanner(provider).plan(contextFor(6), evidence);
    if (intent.scenarios.length !== 6) errors.push(`starved outline: expected 6 scenarios, got ${intent.scenarios.length}`);
    if (summary(calls) !== 'intent-outline:sized,intent-outline:full,intent-write:sized,intent-write:sized') {
      errors.push(`starved outline: unexpected call sequence ${summary(calls)}`);
    }
    if (intent.warnings.some((warning) => warning.includes('Outline step failed'))) {
      errors.push('starved outline: recovery must not report an outline failure');
    }
  }

  // 2. The outline dies even at the full budget: the run must still finish by
  //    writing the whole request as one piece, and say so in a warning.
  {
    const { calls, provider } = scripted([
      () => ({ content: '' }),
      () => ({ content: '' }),
      () => ({ content: intentJson(6) }),
    ]);
    const intent = await new AiIntentPlanner(provider).plan(contextFor(6), evidence);
    if (intent.scenarios.length !== 6) errors.push(`dead outline: expected 6 scenarios, got ${intent.scenarios.length}`);
    if (summary(calls) !== 'intent-outline:sized,intent-outline:full,intent-write:sized') {
      errors.push(`dead outline: unexpected call sequence ${summary(calls)}`);
    }
    const warning = intent.warnings.find((entry) => entry.includes('Outline step failed'));
    if (warning === undefined || !warning.includes('intent-outline') || !warning.includes('twice')) {
      errors.push(`dead outline: expected a fallback warning naming the double failure, got ${JSON.stringify(intent.warnings)}`);
    }
  }

  // 3. A host provider that throws on the starved call (production hosts turn
  //    an empty vendor reply into an error) recovers the same way.
  {
    const { calls, provider } = scripted([
      () => { throw new Error('AI returned an empty response.'); },
      (request) => {
        if (request.maxOutputTokensHint !== undefined) throw new Error('recovery call must not carry a budget hint');
        return { content: outlineJson(4) };
      },
      () => ({ content: intentJson(3) }),
      () => ({ content: intentJson(1) }),
    ]);
    const intent = await new AiIntentPlanner(provider).plan(contextFor(4), evidence);
    if (intent.scenarios.length !== 4) errors.push(`thrown outline: expected 4 scenarios, got ${intent.scenarios.length}`);
    if (summary(calls) !== 'intent-outline:sized,intent-outline:full,intent-write:sized,intent-write:sized') {
      errors.push(`thrown outline: unexpected call sequence ${summary(calls)}`);
    }
  }

  // 4. A starved write call recovers inside the same attempt — no repair
  //    prompt, purpose stays intent-write for both calls.
  {
    const { calls, provider } = scripted([
      () => ({ content: '' }),
      (request) => {
        if (request.maxOutputTokensHint !== undefined) throw new Error('recovery call must not carry a budget hint');
        return { content: intentJson(2) };
      },
    ]);
    const intent = await new AiIntentPlanner(provider).plan(contextFor(2), evidence);
    if (intent.scenarios.length !== 2) errors.push(`starved write: expected 2 scenarios, got ${intent.scenarios.length}`);
    if (summary(calls) !== 'intent-write:sized,intent-write:full') {
      errors.push(`starved write: unexpected call sequence ${summary(calls)}`);
    }
  }

  // 5. The built-in provider must report the response evidence, not silence,
  //    and must grant the full configured budget when the hint is absent.
  {
    const seenMaxTokens = [];
    const vendor = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        seenMaxTokens.push(JSON.parse(body).max_tokens);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          choices: [{ finish_reason: 'length', message: { content: '', reasoning_content: 'deliberating…' } }],
          usage: { completion_tokens: 1500, completion_tokens_details: { reasoning_tokens: 1500 } },
        }));
      });
    });
    await new Promise((resolve) => vendor.listen(0, '127.0.0.1', resolve));
    const vendorAddress = vendor.address();
    if (vendorAddress === null || typeof vendorAddress === 'string') throw new Error('Vendor fixture did not expose a TCP port');
    try {
      const provider = createAiProviderFromConfig({
        provider: 'openai-compatible',
        model: 'fixture-model',
        endpoint: `http://127.0.0.1:${vendorAddress.port}/v1`,
        apiKey: 'fixture-key',
        maxTokens: 32000,
      });
      const request = {
        jsonSchemaName: 'brisk-aitesting.intent-outline.v1',
        structuredOutput: 'json',
        purpose: 'intent-outline',
        system: 'fixture',
        user: 'fixture',
      };
      for (const hinted of [true, false]) {
        try {
          await provider.complete(hinted ? { ...request, maxOutputTokensHint: 1500 } : request);
          errors.push('builtin provider: expected AI_PROVIDER_EMPTY_RESPONSE');
        } catch (error) {
          if (error?.code !== 'AI_PROVIDER_EMPTY_RESPONSE') {
            errors.push(`builtin provider: expected AI_PROVIDER_EMPTY_RESPONSE, got ${error?.code ?? error}`);
          } else if (!error.message.includes('finish_reason "length"') || !error.message.includes('1500 of them hidden reasoning')) {
            errors.push(`builtin provider: error must carry the response evidence, got ${error.message}`);
          }
        }
      }
      if (seenMaxTokens[0] !== 1500 || seenMaxTokens[1] !== 32000) {
        errors.push(`builtin provider: expected max_tokens 1500 then 32000, got ${JSON.stringify(seenMaxTokens)}`);
      }
    } finally {
      await new Promise((resolve) => vendor.close(resolve));
    }
  }
} finally {
  await new Promise((resolve) => appServer.close(resolve));
}

if (errors.length > 0) {
  console.error(JSON.stringify({ suite: 'empty-response-recovery', failures: errors.length, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ suite: 'empty-response-recovery', checks: 14, failures: 0 }, null, 2));
