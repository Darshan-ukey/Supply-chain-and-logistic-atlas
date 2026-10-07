import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { selectionForCanvasState, buildDaughterHref } from '../assets/canvas-daughter-bridge-v2.0.1.mjs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const config = JSON.parse(read('vercel.json'));
const host = read('canvas-v2-host.html');
const frozen = read('canvas-v2/canvas-v2/index.html');
assert.equal(read('assets/canvas-v2-page0-rules.js'), read('canvas-v2/canvas-v2/preview-standalone.html').match(/window\.__PAGE0_RULES24__=[^\n]+;/)[0] + '\n');
assert.equal(host, frozen.replace('<head>', '<head>\n<base href="/canvas-v2/canvas-v2/">')
  .replace('</body>', '<script type="module" src="/assets/canvas-v2-host.mjs"></script>\n</body>'));
assert.equal(config.rewrites.find(r => r.source === '/app').destination, '/canvas-v2-host');
assert.equal(config.cleanUrls, true);
assert.equal(config.trailingSlash, false);
const manifest = JSON.parse(read('canvas-v2/canvas-v2/ASSET_MANIFEST.json'));
for (const file of manifest.files) {
  const p = `canvas-v2/canvas-v2/${file.path}`;
  const bytes = execFileSync('git', ['show', `HEAD:${p}`], { maxBuffer: 20 * 1024 * 1024 });
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, p);
}
assert.equal(execFileSync('git', ['diff', 'b4ccbaab4430e23c0e656c206d3982888102e7f9', '--', 'canvas-v2', 'assets/canvas-daughter-bridge-v2.0.1.mjs']).length, 0);

const resolve = pathname => {
  const redirect = config.redirects.find(r => r.source === pathname);
  if (redirect) return resolve(redirect.destination);
  const exact = config.rewrites.find(r => r.source === pathname);
  if (exact) return exact.destination;
  for (const r of config.rewrites.filter(r => r.source.endsWith('/:path*'))) {
    const prefix = r.source.slice(0, -':path*'.length);
    if (pathname.startsWith(prefix)) return r.destination.replace(':path*', pathname.slice(prefix.length));
  }
  return pathname;
};
assert.equal(config.redirects.find(r => r.source === '/canvas-v2/canvas-v2').destination, '/app');
assert.equal(config.redirects.find(r => r.source === '/canvas-v2/canvas-v2').permanent, false);
// Vercel cleanUrls publishes HTML at extensionless destinations.
for (const r of config.rewrites.filter(r => r.source === '/app')) {
  assert(!r.destination.endsWith('.html'));
  assert(fs.statSync(`.${r.destination}.html`).isFile());
}
const urls = new Set();
for (const route of ['/app', '/app/', '/canvas-v2/canvas-v2', '/canvas-v2/canvas-v2/']) {
  assert.equal(resolve(route.replace(/\/$/, '')), '/canvas-v2-host');
  const base = new URL(host.match(/<base href="([^"]+)"/)[1], `https://preview.example${route}`);
  for (const m of host.matchAll(/(?:src|href)="([^"]+)"/g)) urls.add(new URL(m[1], base).pathname);
  for (const m of read('canvas-v2/canvas-v2/assets/canvas-v2.js').matchAll(/loadJson\('([^']+)'\)/g)) urls.add(new URL(m[1], base).pathname);
}
urls.delete('/canvas-v2/canvas-v2/');
urls.add('/assets/canvas-daughter-bridge-v2.0.1.mjs');
urls.add('/governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json');
for (const url of urls) assert(fs.statSync(`.${resolve(url)}`).isFile(), url);
const registry = JSON.parse(read('governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json'));
const module = JSON.parse(read('data/modules/road-ltl-v1.2.json'));
for (const p of module.processes) assert.equal(buildDaughterHref(selectionForCanvasState(registry, {activeModule:'road-ltl', selectedProcess:p.id})), `/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=${p.id}`);
assert.equal(selectionForCanvasState(registry, {activeModule:'road-ltl', selectedProcess:null}), null);
if (process.env.ATLAS_PREVIEW_URL) {
  for (const url of ['/app', '/canvas-v2/canvas-v2', ...urls]) {
    const response = await fetch(new URL(url, process.env.ATLAS_PREVIEW_URL));
    assert.equal(response.status, 200, url);
    const body = await response.text();
    const expected = url === '/app' || url === '/canvas-v2/canvas-v2' ? host : read(`.${resolve(url)}`);
    assert.equal(body.replaceAll('\r\n', '\n'), expected, `${url} returned wrong bytes`);
  }
}
console.log(`PASS: frozen manifest ${manifest.files.length} files; /app + nested hosts; ${urls.size} required asset/data URLs; exact 2.0.1 Daughter tuples; optional preview byte-equivalence.`);
