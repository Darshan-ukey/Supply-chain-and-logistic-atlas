// REAL end-to-end grounding verification. Nothing is mocked:
//  - a real HTTP server serves real HTML pages,
//  - a real Chromium (system executable via runtime.browserExecutablePath or
//    BRISK_AITESTING_BROWSER_EXECUTABLE_PATH) renders them,
//  - the real BuiltinPlaywrightRouteGrounder grounds them,
//  - a real deterministic Planner (the product's public extension API, as any
//    host can ship) turns real grounding evidence into UI actions,
//  - the real orchestrator runs the whole preview.
//
// Usage: node smoke/perf/real-browser-grounding.mjs [chromiumPath]
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createBriskAiTesting,
  defineHostConfig,
} from '../../dist/index.js';
import { BuiltinPlaywrightRouteGrounder } from '../../dist/engines/playwright-grounder.js';

const executablePath = process.argv[2] ?? process.env.BRISK_AITESTING_BROWSER_EXECUTABLE_PATH;
if (executablePath === undefined) {
  console.error('Pass a Chromium executable path or set BRISK_AITESTING_BROWSER_EXECUTABLE_PATH.');
  process.exit(2);
}

/* ---------------- a real web application ---------------- */
const page = (title, body) => `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;
const pages = {
  '/login': page('Sign in', `
    <h1>Sign in</h1>
    <form>
      <label for="email">Email</label><input id="email" type="email" name="email">
      <label for="password">Password</label><input id="password" type="password" name="password">
      <button type="submit">Sign in</button>
    </form>`),
  '/orgs': page('Organizations', `
    <h1>Organizations</h1>
    <a href="/orgs/new">New organization</a>
    <table><tr><td>Org One</td><td><button data-testid="open-org">Open</button></td></tr></table>`),
  '/settings': page('Settings', `
    <h1>Settings</h1>
    <label for="name">Display name</label><input id="name" type="text">
    <input id="notify" type="checkbox"><label for="notify">Email notifications</label>
    <button>Save</button>`),
};
const server = createServer((req, res) => {
  const html = pages[req.url.split('?')[0]];
  res.writeHead(html === undefined ? 404 : 200, { 'content-type': 'text/html' });
  res.end(html ?? 'not found');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

const artifactsDir = await mkdtemp(join(tmpdir(), 'brisk-real-grounding-'));
const checks = [];
const check = (name, condition, detail) => {
  checks.push({ name, ok: condition === true });
  assert.equal(condition, true, `${name}${detail !== undefined ? `: ${detail}` : ''}`);
};

/* ---------------- part 1: the grounder itself, shared browser, parallel ---------------- */
const config = await defineHostConfig({
  app: { name: 'real grounding target', baseUrl, uiBaseUrl: baseUrl, env: 'local' },
  auth: { type: 'none' },
  run: { execution: 'preview', artifactsDir, timeoutMs: 30_000, retries: 0, headless: true, browserExecutablePath: executablePath },
  discovery: { includeRepo: false, includeUi: true, includeApi: false, includeContracts: false, uiRoutes: Object.keys(pages), apiRoutes: [] },
}, { environment: {} });
check('config carries browserExecutablePath', config.runtime.browserExecutablePath === executablePath);

const grounder = new BuiltinPlaywrightRouteGrounder();
const scenarioFor = (id, route) => ({
  id, name: `${route} loads`, type: 'ui', objective: `${route} renders`, target: { route, sourceOfTruth: 'observed' }, assertions: [], evidenceRequired: [],
});
const startedAt = Date.now();
const [login, orgs, settings] = await Promise.all([
  grounder.ground({ config, runId: 'real_ground_run', scenario: scenarioFor('ui_login', '/login') }),
  grounder.ground({ config, runId: 'real_ground_run', scenario: scenarioFor('ui_orgs', '/orgs') }),
  grounder.ground({ config, runId: 'real_ground_run', scenario: scenarioFor('ui_settings', '/settings') }),
]);
const threePagesMs = Date.now() - startedAt;

check('login page grounded with real elements', login.grounding.summary.total > 0);
check('login page found its two inputs and button', login.grounding.elements.filter((e) => e.tagName === 'input').length === 2 && login.grounding.elements.some((e) => e.role === 'button'));
check('orgs page found link and button', orgs.grounding.elements.some((e) => e.role === 'link') && orgs.grounding.elements.some((e) => e.testId === 'open-org'));
check('settings page found checkbox', settings.grounding.elements.some((e) => e.role === 'checkbox'));

const logs = await Promise.all([login, orgs, settings].map(async (result) => readFile(result.artifacts[1].path, 'utf8')));
const launches = logs.filter((log) => log.includes('Browser started once')).length;
const reuses = logs.filter((log) => log.includes('Browser reused')).length;
check('exactly one real browser launch across three pages', launches === 1, `launches=${launches} reuses=${reuses}`);
check('the other two pages reused it', reuses === 2);

const fourthStartedAt = Date.now();
await grounder.ground({ config, runId: 'real_ground_run', scenario: scenarioFor('ui_login_again', '/login') });
const reusedPageMs = Date.now() - fourthStartedAt;
check('a page on the warm browser costs a fraction of the cold trio', reusedPageMs < threePagesMs, `${reusedPageMs}ms vs ${threePagesMs}ms`);
await grounder.dispose();

/* ---------------- part 2: the whole preview through the real orchestrator ---------------- */
// A real deterministic planner, built on the public Planner extension API the
// way any host could ship one: it plans one UI scenario per discovered route
// and derives actions from the real grounding evidence in ONE batched call.
let batchCalls = 0;
const routePlanner = {
  name: 'route-visit-planner',
  async plan(context) {
    return {
      schemaVersion: 'brisk-aitesting.plan.v1',
      runId: context.runId,
      goal: context.input.goal,
      mode: 'automatic',
      scenarios: context.discovery.uiRoutes.map((route, index) => ({
        id: `ui_${index + 1}`,
        name: `${route.path} loads`,
        type: 'ui',
        objective: `${route.path} renders and its first control is reachable`,
        target: { route: route.path, sourceOfTruth: 'observed' },
        assertions: [`${route.path} shows a page`],
        evidenceRequired: ['ui'],
      })),
      discovery: context.discovery,
      warnings: [],
      createdAt: new Date().toISOString(),
    };
  },
  async enrichUiActionsForScenarios(context) {
    batchCalls += 1;
    return context.items.map(({ scenario, grounding }) => {
      const actionable = grounding.elements.find((element) => element.role === 'button' || element.role === 'link');
      return {
        scenarioId: scenario.id,
        actions: actionable === undefined ? [] : [{ action: 'assertText', evidenceId: actionable.id, text: actionable.text ?? actionable.label ?? '' }],
      };
    });
  },
};

const tester = createBriskAiTesting(config, { planner: routePlanner });
const result = await tester.run({
  goal: 'Prove every screen renders with reachable controls',
  scenarios: 3,
  uiActionFeedback: 'when-missing',
});
server.close();

check('preview completed', result.plan.scenarios.length === 3, JSON.stringify(result.outcome));
check('one batched enrichment call for all three screens', batchCalls === 1, String(batchCalls));
const enriched = result.plan.scenarios.filter((scenario) => (scenario.uiActions ?? []).length > 0);
check('scenarios carry actions grounded in real evidence ids', enriched.length >= 2 && enriched.every((scenario) => scenario.uiActions.every((action) => /^ui_el_/.test(action.evidenceId))));
const groundingTiming = (result.timings ?? []).find((timing) => timing.stage === 'grounding');
check('grounding stage timing recorded', groundingTiming !== undefined && groundingTiming.ms > 0);

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.real-browser-grounding.v1',
  executablePath,
  threePagesParallelMs: threePagesMs,
  warmSinglePageMs: reusedPageMs,
  orchestratorGroundingMs: groundingTiming?.ms,
  batchedEnrichCalls: batchCalls,
  checks: checks.length,
  failures: checks.filter((entry) => !entry.ok).length,
}, null, 2));
