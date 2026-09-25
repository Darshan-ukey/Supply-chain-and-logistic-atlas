import type { CoverageResult } from '@malkom/domainwarehouse-contract';

function flatten(value:any, prefix='', out=new Map<string,any>()) {
  if (value === null || typeof value !== 'object') { out.set(prefix,value); return out; }
  if (Array.isArray(value)) { value.forEach((v,i)=>flatten(v,`${prefix}[${i}]`,out)); return out; }
  Object.keys(value).sort().forEach((k)=>flatten(value[k],prefix?`${prefix}.${k}`:k,out));
  return out;
}

/** Reference-vs-client comparison. Difference is not automatically a gap. */
export function score(reference:any, actual:any): CoverageResult {
  const ref=flatten(reference), act=flatten(actual); const findings:CoverageResult['findings']=[]; let matched=0;
  for (const [path,rv] of ref) {
    if (!act.has(path)) { findings.push({path,classification:'GAP',reference:rv,note:'Reference element has no client actual mapping.'}); continue; }
    const av=act.get(path); if (JSON.stringify(rv)===JSON.stringify(av)) matched++;
    else findings.push({path,classification:'UNEXPLAINED_DEVIATION',reference:rv,actual:av,note:'Requires client/context review; difference is not automatically wrong.'});
  }
  for (const [path,av] of act) if (!ref.has(path)) findings.push({path,classification:'EXTRA_CLIENT_WORK',actual:av});
  const total=ref.size; return { score: total ? Math.round((matched/total)*10000)/100 : 100, matched, total, findings };
}
