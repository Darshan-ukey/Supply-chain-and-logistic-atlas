import fs from 'node:fs';
// Copy the frozen shell into an external host; never write into the package.
const frozen = fs.readFileSync('canvas-v2/canvas-v2/index.html', 'utf8');
const host = frozen.replace('<head>', '<head>\n<base href="/canvas-v2/canvas-v2/">')
  .replace('</body>', '<script type="module" src="/assets/canvas-v2-host.mjs"></script>\n</body>');
fs.writeFileSync('canvas-v2-host.html', host);
// The standalone frozen preview carries the missing upstream rules dependency.
// Materialize that exact assignment outside the frozen package, without invention.
const preview = fs.readFileSync('canvas-v2/canvas-v2/preview-standalone.html', 'utf8');
const rules = preview.match(/window\.__PAGE0_RULES24__=([^\r\n]+);/);
if (!rules) throw new Error('Frozen standalone Page0 rules donor missing');
JSON.parse(rules[1]);
fs.writeFileSync('assets/canvas-v2-page0-rules.js', `window.__PAGE0_RULES24__=${rules[1]};\n`);
