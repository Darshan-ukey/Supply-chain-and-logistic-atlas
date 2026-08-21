import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {WRITE_CAPABLE_AGENTS,DEFERRED,AGENTS} from '../lib/agents/registry.js';
import {getIntegrityManifest,verifyModelIntegrity} from '../lib/atlas/store.js';
import {getConstitution} from '../lib/atlas/constitution.js';
assert.equal(WRITE_CAPABLE_AGENTS.length,0);
assert.ok(AGENTS.explainer);assert.equal(AGENTS.explainer.write,false);
assert.equal(DEFERRED.atlasAutoCorrection,true);assert.equal(DEFERRED.automaticClientFactConfirmation,true);
const m=getIntegrityManifest();for(const k of ['frozenPage0Writes','frozenRoadLtlWrites','existingAtlasContentWrites','taxonomyWrites','sourceWrites','relationshipWrites','applicabilityWrites'])assert.equal(m.mutationPolicy[k],false,k);
assert.equal(m.mutationPolicy.guideAdditionsOnly,true);assert.equal(m.additivePolicy.intelligenceMayApplyCorrections,false);assert.equal(m.additivePolicy.intelligenceMayRecommendCorrections,true);
const c=getConstitution();assert.equal(c.frozenFoundation.page0,'V6.2.2');assert.equal(c.frozenFoundation.roadLtl,'V1.2');assert.match(c.explanationPolicy.ambiguityRule,/clarification/i);
assert.equal(verifyModelIntegrity().ok,true);
// Runtime source must not contain filesystem write/delete primitives in app/lib.
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])}
for(const f of [...walk('app'),...walk('lib')].filter(x=>/\.(js|mjs)$/.test(x))){const s=fs.readFileSync(f,'utf8');assert.doesNotMatch(s,/\b(?:writeFileSync|writeFile|unlinkSync|unlink|renameSync|rename)\s*\(/,`runtime write primitive in ${f}`)}
console.log('governance-smoke: PASS');
