import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const cert=JSON.parse(fs.readFileSync('governance/product/S8_3A_OCEAN_0_6_SOURCE_CERTIFICATION.json','utf8'));
const bytes=fs.readFileSync(cert.package.path);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(bytes),cert.package.sha256);
const zip=await JSZip.loadAsync(bytes);
for(const [path,expected] of Object.entries(cert.payloads)){
  const f=zip.file('atlas-daughter-release-ltl-v1.4-ocean-v0.6/'+path);
  assert.ok(f,'missing '+path);
  const b=await f.async('nodebuffer');
  assert.equal(sha(b),expected,'hash mismatch '+path);
}
for(const id of ['ocean-fcl','ocean-lcl']){
  const path='atlas-daughter-release-ltl-v1.4-ocean-v0.6/data/modules/'+id+'-v0.6.json';
  const mod=JSON.parse(await zip.file(path).async('string'));
  assert.equal(mod.module.id,id);
  assert.equal(mod.module.version,'0.6');
  assert.equal(mod.module.status,'EXECUTION_READY_REFERENCE_CANDIDATE');
  assert.equal(mod.tasks.length,30);
}
assert.equal(cert.promotion,false);
assert.ok(cert.constraints.includes('NO_OCEAN_0_5_FALLBACK'));
console.log(JSON.stringify({ok:true,packageSha256:cert.package.sha256,payloads:Object.keys(cert.payloads).length,oceanFclTasks:30,oceanLclTasks:30,promotion:false},null,2));
