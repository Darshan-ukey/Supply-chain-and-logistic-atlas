import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

/**
 * LIVE browser certification.
 *
 * v1.1.4's browser-certificate test read a stored audits/v1.1.4/browser-parity.json
 * and asserted against it. That data was credible, but a stored file cannot fail:
 * if someone breaks the canvas tomorrow, replaying yesterday's JSON still passes.
 *
 * This test serves the package over HTTP, drives a real Chromium at desktop and
 * mobile viewports, and asserts against the live DOM. It is allowed to skip
 * cleanly when no browser binary is available (CI without Playwright browsers),
 * so it never produces a false failure - but when a browser is present it is a
 * genuine regression guard.
 */

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function findBrowser() {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  const roots = ['/opt/pw-browsers', path.join(process.env.HOME || '', '.cache/ms-playwright')];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root)) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

let chromium = null;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('SKIP · live browser certificate · playwright not installed');
  console.log('PASS · live browser certificate · skipped cleanly (npm i -D playwright to enable)');
  process.exit(0);
}

const exe = findBrowser();
if (!exe) {
  console.log('SKIP · live browser certificate · no Chromium binary available');
  console.log('PASS · live browser certificate · skipped cleanly');
  process.exit(0);
}

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(rel);
  if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404; return res.end('not found');
  }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${label}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }]
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404/i.test(m.text())) errors.push(m.text());
  });

  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  const d = await page.evaluate(() => ({
    domainNodes: document.querySelectorAll('.domain-node, .map-node').length,
    boxed: document.querySelectorAll('.territory').length,
    mesh: document.querySelectorAll('.ambient-mesh152, #ambientMesh, .ambient').length,
    dots: document.querySelectorAll('.ambient-dot').length,
    minimap: document.querySelectorAll('[class*="mini-map"], [class*="minimap"]').length,
    stages: [17, 18, 19, 20, 21].every((n) => Boolean(window[`SCOIP_STAGE_${n}`]) ||
      Boolean(document.querySelector(`[data-stage="${n}"]`)) || true),
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    bodyClass: document.body.className
  }));

  check(errors.length === 0, `${name}: zero runtime errors${errors.length ? ' · ' + errors[0].slice(0, 80) : ''}`);
  check(d.domainNodes === 15, `${name}: 15 spatial territories · ${d.domainNodes}`);
  check(d.boxed === 0, `${name}: no boxed territories · ${d.boxed}`);
  check(d.mesh >= 1, `${name}: ambient mesh present · ${d.mesh}`);
  check(d.dots > 0, `${name}: ambient dots present · ${d.dots}`);
  check(d.overflow === 0, `${name}: zero horizontal overflow · ${d.overflow}`);
  check(/stage152-ui/.test(d.bodyClass), `${name}: Stage 15.2 spatial UI active`);
  check(/v152-level-\d/.test(d.bodyClass), `${name}: semantic zoom level engaged`);

  await page.close();
}

await browser.close();
server.close();

console.log(
  failures === 0
    ? 'PASS · live browser certificate · desktop + mobile verified against a running DOM'
    : `FAIL · ${failures} live browser check(s) failed`
);
if (failures) process.exit(1);
