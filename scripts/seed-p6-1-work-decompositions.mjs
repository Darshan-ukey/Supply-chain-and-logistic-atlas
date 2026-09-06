import fs from 'node:fs';
import crypto from 'node:crypto';

const source=process.argv[2]||process.env.ATLAS_WORK_DECOMPOSITION_SEED_FILE;
const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!source)throw new Error('Pass the private P6.1 decomposition bundle path');
if(!url||!key)throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const bundle=JSON.parse(fs.readFileSync(source,'utf8'));
const map=bundle.decompositions||{};
const items=Object.values(map);
if(bundle.moduleId!=='road-ltl'||bundle.moduleVersion!=='1.5'||items.length!==22)throw new Error('Expected the protected Road LTL 1.5 P6.1 bundle with 22 task decompositions');
const stable=v=>{if(Array.isArray(v))return `[${v.map(stable).join(',')}]`;if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;return JSON.stringify(v)};
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const rows=items.map(d=>({
  decomposition_id:d.decompositionId,
  module_id:d.daughterModule,
  module_version:d.daughterVersion,
  source_task_id:d.sourceTaskId,
  contract_version:d.contractVersion,
  semantic_source_version:d.semanticLineage?.semanticSourceVersion||d.daughterVersion,
  status:d.status,
  payload:d,
  content_hash:hash(d),
  updated_at:new Date().toISOString()
}));
const r=await fetch(`${url}/rest/v1/atlas_work_decompositions?on_conflict=decomposition_id`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
if(!r.ok)throw new Error(`P6.1 seed failed ${r.status}: ${await r.text()}`);
console.log(`Seeded ${rows.length} protected Work Decompositions. No decomposition-detail JSON was written into the web bundle.`);
