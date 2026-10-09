import assert from 'node:assert/strict';
import test from 'node:test';

// CP-12 CA-4: isolated fail-closed certification summary validator.
// No frozen root or DAU harness modifications. Proposed strict default: zero tolerances.
export function validateDauGate(report, policy = {}) {
  const errors = [];
  const required = ['testedCommit','testedTree','nodeVersion','total','passed','failed','rootLoadRaceTolerated'];
  if (!report || typeof report !== 'object' || Array.isArray(report)) return {ok:false,errors:['INVALID_REPORT']};
  for (const key of required) if (!(key in report)) errors.push('MISSING_'+key);
  for (const key of ['total','passed','failed','rootLoadRaceTolerated']) {
    if (!Number.isSafeInteger(report[key]) || report[key] < 0) errors.push('INVALID_'+key);
  }
  if (Number.isSafeInteger(report.total) && Number.isSafeInteger(report.passed) && Number.isSafeInteger(report.failed) && report.passed + report.failed !== report.total) errors.push('COUNT_MISMATCH');
  if (report.failed !== 0) errors.push('FAILED_CASES');
  for (const key of ['testedCommit','testedTree','nodeVersion']) {
    if (typeof report[key] !== 'string' || !report[key]) errors.push('INVALID_'+key);
    if (policy[key] && report[key] !== policy[key]) errors.push('WRONG_'+key);
  }
  const ceiling = policy.maxTolerated ?? 0;
  if (!Number.isSafeInteger(ceiling) || ceiling < 0) errors.push('INVALID_POLICY_CEILING');
  if (Number.isSafeInteger(report.rootLoadRaceTolerated) && report.rootLoadRaceTolerated > ceiling) errors.push('OVER_CEILING');
  if (report.rootLoadRaceTolerated > 0) {
    if (!policy.approvedExceptionId || !policy.expiresAt || !policy.testedCommit || !policy.testedTree || !policy.nodeVersion || !policy.stackFingerprint || !policy.sourceLocation) errors.push('UNAPPROVED_EXCEPTION');
    if (typeof policy.expiresAt !== 'string' || !Number.isFinite(Date.parse(policy.expiresAt)) || Date.parse(policy.expiresAt) <= Date.now()) errors.push('EXPIRED_EXCEPTION');
    if (!Array.isArray(report.toleratedEvents) || report.toleratedEvents.length !== report.rootLoadRaceTolerated) errors.push('MISSING_EVENT_EVIDENCE');
    else for (const e of report.toleratedEvents) {
      if (!e || typeof e.stackFingerprint !== 'string' || e.stackFingerprint !== policy.stackFingerprint) errors.push('UNKNOWN_STACK');
      if (!e || typeof e.sourceLocation !== 'string' || !e.sourceLocation) errors.push('MISSING_SOURCE');
      else if (e.sourceLocation !== policy.sourceLocation) errors.push('UNKNOWN_SOURCE');
    }
  }
  return {ok:errors.length===0,errors};
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const base = {testedCommit:'a'.repeat(40),testedTree:'b'.repeat(40),nodeVersion:'v24.21.0',total:110,passed:110,failed:0,rootLoadRaceTolerated:0};
  const policy = {testedCommit:base.testedCommit,testedTree:base.testedTree,nodeVersion:base.nodeVersion};
  const fail = (r,p=policy) => assert.equal(validateDauGate(r,p).ok,false);
  test('strict zero tolerated events passes',()=>assert.equal(validateDauGate(base,policy).ok,true));
  test('missing counter fails',()=>{const r={...base};delete r.rootLoadRaceTolerated;fail(r)});
  test('negative counter fails',()=>fail({...base,rootLoadRaceTolerated:-1}));
  test('noninteger counter fails',()=>fail({...base,rootLoadRaceTolerated:0.5}));
  test('positive tolerance without exception fails',()=>fail({...base,rootLoadRaceTolerated:1}));
  test('failed cases fail',()=>fail({...base,failed:1,passed:109}));
  test('count mismatch fails',()=>fail({...base,passed:109}));
  test('wrong Node fails',()=>fail({...base,nodeVersion:'v22.22.0'}));
  test('wrong commit fails',()=>fail({...base,testedCommit:'c'.repeat(40)}));
  test('wrong tree fails',()=>fail({...base,testedTree:'c'.repeat(40)}));
  const except = {...policy,maxTolerated:1,approvedExceptionId:'EX-1',expiresAt:'2999-01-01',stackFingerprint:'closeFutureDrawer@root',sourceLocation:'index.html:1'};
  const tolerated = {...base,rootLoadRaceTolerated:1,toleratedEvents:[{stackFingerprint:'closeFutureDrawer@root',sourceLocation:'index.html:1'}]};
  test('bounded exact exception passes',()=>assert.equal(validateDauGate(tolerated,except).ok,true));
  test('same message different stack fails',()=>fail({...tolerated,toleratedEvents:[{stackFingerprint:'other@root',sourceLocation:'index.html:1'}]},except));
  test('different source location fails',()=>fail({...tolerated,toleratedEvents:[{stackFingerprint:'closeFutureDrawer@root',sourceLocation:'other.html:1'}]},except));
  test('missing source fails',()=>fail({...tolerated,toleratedEvents:[{stackFingerprint:'closeFutureDrawer@root'}]},except));
  test('expired exception fails',()=>fail(tolerated,{...except,expiresAt:'2020-01-01'}));
  test('missing event list fails',()=>fail({...base,rootLoadRaceTolerated:1},except));
}
