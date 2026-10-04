// Supplementary, NON-GATING browser corroboration for S8-4 (Chromium via Playwright).
// Usage: node e2e-smoke.mjs <baseUrl>   (prints one JSON line; exit 0 always unless the harness itself breaks)
import {createRequire} from 'node:module';
const base = process.argv[2];
const out = {tool: 'playwright-chromium', baseUrl: base, status: 'SKIPPED', detail: null};
try {
  const require = createRequire('/opt/npm-tools/node_modules/');
  const {chromium} = require('playwright');
  const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}).catch(() => chromium.launch());
  const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, {waitUntil: 'load'});
  await p.waitForSelector('#atlas-v15-malkom-journey-host', {timeout: 8000});
  const links = await p.$$eval('#atlas-v15-malkom-journey-host a', (a) => a.map((x) => x.getAttribute('href')));
  await p.goto(`${base}/atl-140-malkom-consumer.html`, {waitUntil: 'load'});
  await p.waitForFunction(() => document.querySelectorAll('#crosswalk tr').length > 0, {timeout: 8000});
  const state = await p.textContent('#state'); const rows = await p.$$eval('#crosswalk tr', (r) => r.length);
  await b.close();
  const ok = errs.length === 0 && rows === 4 && state.startsWith('CLIENT_BINDING_REQUIRED') && links.length === 3 && links[0] === '/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04';
  Object.assign(out, {status: ok ? 'PASS' : 'FAIL', detail: {journeyLinks: links, crosswalkRows: rows, state, pageErrors: errs}});
} catch (e) { out.detail = String(e.message).slice(0, 200); }
console.log(JSON.stringify(out));
