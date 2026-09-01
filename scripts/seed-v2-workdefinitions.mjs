import fs from 'node:fs';
import crypto from 'node:crypto';

const source=process.argv[2]||process.env.ATLAS_WORKDEFINITION_SEED_FILE;
const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!source)throw new Error('Pass the private registry JSON path: node scripts/seed-v2-workdefinitions.mjs /path/to/private-seed.json');
if(!url||!key)throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const registry=JSON.parse(fs.readFileSync(source,'utf8'));
if(!Array.isArray(registry.definitions)||registry.definitions.length!==22)throw new Error(`Expected 22 Road LTL WorkDefinitions, found ${registry.definitions?.length??0}`);
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const rows=registry.definitions.map(d=>({
  definition_id:d.id,
  domain:d.domain,
  source_task_id:d.sourceTask?.sourceId,
  source_version:d.sourceTask?.sourceVersion||'Road LTL V1.2',
  definition_version:d.version||'0.1.0',
  status:d.lifecycleStatus||'ACTIVE',
  payload:d,
  content_hash:hash(d),
  updated_at:new Date().toISOString()
}));
const r=await fetch(`${url}/rest/v1/atlas_work_definitions?on_conflict=definition_id`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
if(!r.ok)throw new Error(`Seed failed ${r.status}: ${await r.text()}`);
console.log(`Seeded ${rows.length} protected WorkDefinitions. No execution-detail JSON was written into the web bundle.`);
