import fs from 'node:fs';import path from 'node:path';import {root,json,sha,walk} from './common.mjs';
const checks=[];const add=(name,ok,detail='')=>checks.push({name,ok,detail});
const pkg=json(path.join(root,'package.json')),vercel=json(path.join(root,'vercel.json')),baseline=json(path.join(root,'release/baselines/core-hashes-stage21.json')).hashes;
add('node engine pinned 24.x',pkg.engines?.node==='24.x',pkg.engines?.node);
for(const [rel,expected] of Object.entries(baseline)){const p=path.join(root,rel);add(`frozen:${rel}`,fs.existsSync(p)&&sha(p)===expected,fs.existsSync(p)?sha(p):'missing')}
for(const f of ['api/health.js','api/readiness.js','api/pilot-readiness.js','api/version.js','api/release-integrity.js','release/release-meta.js'])add(`release endpoint:${f}`,fs.existsSync(path.join(root,f)));
const headers=JSON.stringify(vercel.headers||[]);for(const h of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Strict-Transport-Security'])add(`security header:${h}`,headers.includes(h));
const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');for(const k of ['ATLAS_RELEASE_CHANNEL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','ATLAS_LLM_PROVIDER'])add(`env contract:${k}`,env.includes(k));
const runtimeFiles=[...walk(path.join(root,'api')),...walk(path.join(root,'engine')),path.join(root,'stage17-client.js'),path.join(root,'stage18-client.js'),path.join(root,'stage19-client.js'),path.join(root,'stage20-client.js'),path.join(root,'stage21-client.js')];
const runtimeText=runtimeFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
add('runtime has no /mnt/data absolute dependency',!runtimeText.includes('/mnt/data/'));
const secretPatterns=[/sb_secret_[A-Za-z0-9_-]{8,}/,/sk-[A-Za-z0-9_-]{20,}/,/AIza[0-9A-Za-z_-]{20,}/];add('runtime secret scan',!secretPatterns.some(r=>r.test(runtimeText)));
add('release channel contract only stable/lab',fs.readFileSync(path.join(root,'release/release-meta.js'),'utf8').includes("['stable','lab']"));
const status=checks.every(x=>x.ok)?'PASS':'FAIL';const out={stage:'23',status,checks};fs.writeFileSync(path.join(root,'release/evidence/release-validation.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(status!=='PASS')process.exit(1);
