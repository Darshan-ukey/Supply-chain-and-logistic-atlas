import fs from 'node:fs';
import path from 'node:path';
let failures=0;const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++};
const root=process.cwd();
const pub=fs.readFileSync(path.join(root,'index.html'),'utf8');
const admin=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const sensitive=[
  '"queue":"Service Eligibility"',
  '"id":"work_item_id"',
  '"nextStep":"END_WORK_ITEM"',
  '"clientBindingPoints":["FIELD_MAPPING"',
  '"subQueues":[{"id":"ltl-01-new-request"'
];
check(/const V2PUB=/.test(pub),'public bundle contains only public V2 capability projection');
for(const token of sensitive)check(!pub.includes(token),`public bundle excludes protected execution token · ${token.slice(0,40)}`);
for(const token of sensitive)check(!admin.includes(token),`admin shell excludes embedded protected payload · ${token.slice(0,40)}`);
check(/admin-workdefinitions/.test(admin)&&/auth-admin-login/.test(admin),'admin shell loads protected definitions only after Admin auth');
check(/Admin sign-in/.test(admin),'admin shell contains Admin sign-in UX');
check(!fs.existsSync(path.join(root,'road-ltl-workdefinition-registry-v2.json')),'private WorkDefinition registry absent from GitHub repository root');
const forbidden=[];for(const d of ['private-seed']){if(fs.existsSync(path.join(root,d)))forbidden.push(d)}
check(forbidden.length===0,'no private seed directory committed');
check(fs.existsSync(path.join(root,'migrations/v2-admin-workdefinitions.sql')),'protected execution-store migration present');
check(fs.existsSync(path.join(root,'scripts/seed-v2-workdefinitions.mjs')),'private seed loader script present without seed data');
console.log(failures?`FAIL · ${failures} public/IP boundary check(s) failed`:'PASS · V2 public/IP boundary · protected execution data absent from public web/GitHub bundle');
if(failures)process.exit(1);
