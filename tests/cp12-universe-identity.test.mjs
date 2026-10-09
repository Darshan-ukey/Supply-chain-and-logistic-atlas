import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';

// CP-12 CA-1: source-neutral, fail-closed Universe variant identity and pointer delta.
// This deliberately does NOT nominate a canonical governed variant.
export const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
export function compareUniverseVariants(standalone, packaged, expected) {
  const errors=[];
  if (!Buffer.isBuffer(standalone) || !Buffer.isBuffer(packaged)) return {ok:false,errors:['NOT_BUFFERS']};
  if (standalone.length!==packaged.length) errors.push('SIZE_MISMATCH');
  if (sha256(standalone)!==expected.standaloneSha256) errors.push('STANDALONE_HASH');
  if (sha256(packaged)!==expected.packagedSha256) errors.push('PACKAGED_HASH');
  const offsets=[];
  for(let i=0;i<Math.max(standalone.length,packaged.length);i++) if(standalone[i]!==packaged[i]) offsets.push(i);
  if(JSON.stringify(offsets)!==JSON.stringify(expected.offsets)) errors.push('UNEXPECTED_BYTE_DELTA');
  if (!expected.provenanceDecisionId || !expected.governedIdentity) errors.push('MISSING_GOVERNED_DECISION');
  if(expected.governedIdentity && !['standalone','packaged'].includes(expected.governedIdentity)) errors.push('INVALID_GOVERNED_IDENTITY');
  return {ok:errors.length===0,errors,offsets,standaloneSha256:sha256(standalone),packagedSha256:sha256(packaged)};
}

if(process.argv.includes('--check')) {
  const args=process.argv.slice(process.argv.indexOf('--check')+1);
  if(args.length!==3) { console.error('Usage: node tests/cp12-universe-identity.test.mjs --check <standalone> <packaged> <governance-decision.json>');process.exit(2); }
  const expected=JSON.parse(fs.readFileSync(args[2],'utf8'));
  const result=compareUniverseVariants(fs.readFileSync(args[0]),fs.readFileSync(args[1]),expected);
  console.log(JSON.stringify(result,null,2));process.exit(result.ok?0:1);
}
if(process.argv.length===2) {
  const a=Buffer.from('Road1.2 Ocean0.4'),b=Buffer.from('Road1.3 Ocean0.5');
  const offsets=[...a.keys()].filter(i=>a[i]!==b[i]);
  const accepted={standaloneSha256:sha256(a),packagedSha256:sha256(b),offsets,provenanceDecisionId:'TEST-ONLY',governedIdentity:'standalone'};
  test('exact variant identity with explicit decision passes',()=>assert.equal(compareUniverseVariants(a,b,accepted).ok,true));
  test('missing governance decision fails',()=>assert.equal(compareUniverseVariants(a,b,{...accepted,provenanceDecisionId:null}).ok,false));
  test('wrong standalone hash fails',()=>assert.equal(compareUniverseVariants(a,b,{...accepted,standaloneSha256:'bad'}).ok,false));
  test('wrong packaged hash fails',()=>assert.equal(compareUniverseVariants(a,b,{...accepted,packagedSha256:'bad'}).ok,false));
  test('unexpected pointer delta fails',()=>assert.equal(compareUniverseVariants(a,b,{...accepted,offsets:[]}).ok,false));
  test('mutated packaged byte fails',()=>{const changed=Buffer.from(b);changed[0]=0;assert.equal(compareUniverseVariants(a,changed,accepted).ok,false)});
  test('invalid governed identity fails',()=>assert.equal(compareUniverseVariants(a,b,{...accepted,governedIdentity:'both'}).ok,false));
}
