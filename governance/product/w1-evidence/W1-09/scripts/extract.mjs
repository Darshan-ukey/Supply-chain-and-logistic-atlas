// W1-09 step 1: load the frozen V7.3 HTML bytes unmodified, write a scratch copy with ONE read-only export hook
// inserted before the closing "renderAll(); })();", evaluate it in Chromium (no network), dump the file's own registries to JSON.
// Same method as W1-02 extract.mjs (claude/W1-02-L1-INTEGRITY-RERUN-RECEIPT-2026-10-10.md); paths are arguments.
// usage: node extract.mjs <frozen.html> <scratch-instrumented.html> <out.json>
import fs from 'fs'; import crypto from 'crypto'; import {createRequire} from 'module';
const require = createRequire('/opt/npm-tools/node_modules/');
const {chromium} = require('playwright');
const [,, src, scratchHtml, outJson] = process.argv;
const buf = fs.readFileSync(src);
const sha = crypto.createHash('sha256').update(buf).digest('hex');
let h = buf.toString('utf8');
const tail = "  renderAll();\n})();";
const idx = h.indexOf(tail);
if (idx < 0 || h.indexOf(tail, idx + 1) >= 0) throw new Error('hook anchor not unique');
const names = ['domains','models','enterpriseCoverage','businessCycles','navigatorFamilies','contextRules','authorityRules','exchanges','systemRecords','businessObjectRecords','actorRecords','eventRecords','documentRecords','relationshipTypeVocabulary','processRelationshipRecords','entityRegistryGroups','sourceRecords','activePage0SourceIds','referenceGroups','contractServiceContexts','scor','apqc','modes','universeReleaseMetadata','roleProfiles','evidenceProfiles','sourceIdsForPlacement'];
const hook = "  try{window.__U={" + names.join(',') + "}}catch(e){window.__UERR=String(e)}\n";
h = h.slice(0, idx) + hook + h.slice(idx);
fs.writeFileSync(scratchHtml, h);
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(async () => chromium.launch());
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + scratchHtml);
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({
  placementSources: window.__U.referenceGroups.flatMap(g => g.items.map(i => ({group: g.no, name: i.name, ids: window.__U.sourceIdsForPlacement(i)}))),
  U: Object.fromEntries(Object.entries(window.__U).filter(([k, v]) => typeof v !== 'function')),
  err: window.__UERR,
  integ: document.documentElement.dataset.atlasIntegrity
}));
await b.close();
fs.writeFileSync(outJson, JSON.stringify({placementSources: r.placementSources, sha256: sha, bytes: buf.length, pageErrors: errs, hookErr: r.err || null, integrity: r.integ ? JSON.parse(r.integ) : null, U: r.U}));
console.log('sha', sha, 'bytes', buf.length, 'pageErrors', errs.length, 'hookErr', r.err);
