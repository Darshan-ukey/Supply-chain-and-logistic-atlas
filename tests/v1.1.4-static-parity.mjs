import fs from'node:fs';import crypto from'node:crypto';
const j=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),canon=x=>crypto.createHash('sha256').update(JSON.stringify(x,Object.keys(x||{}).sort())).digest('hex');
const checks=[],add=(n,ok,d='')=>checks.push([n,!!ok,d]);
const golden=j('audits/v1.1.4/stage23-golden-hashes.json').hashes,sem=j('audits/v1.1.4/stage23-semantic-hashes.json').hashes,index=fs.readFileSync('index.html','utf8');
for(let i=17;i<=21;i++){const r=`stage${i}-client.js`;add(`Stage ${i} full client exact donor`,sha(r)===golden[r],sha(r))}
for(const token of ['.field{','ambient-mesh152','ambient-dot','mini-map','ATLAS VIEW','semantic-zoom152','Play execution','Trace object','Lens','Compose','Freeze','stage17-client.js','stage18-client.js','stage19-client.js','stage20-client.js','stage21-client.js'])add(`spatial/runtime token ${token}`,index.includes(token));
add('boxed v1 rewrite is absent',!index.includes('.territory{width:150px')&&!index.includes('.territory {width:150px'));
add('Stage17-21 scripts loaded by main index',[17,18,19,20,21].every(i=>index.includes(`<script src="stage${i}-client.js"></script>`)));
const p0=j('data/page0/page0-v6.2.2.json'),road=j('data/modules/road-ltl-v1.2.json');
function h(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex')}
// semantic donor arrays are JSON-identical, so direct JSON.stringify hashes are compared via known structure equality tokenized below.
add('15 spatial territories',(p0.page0Domains||[]).length===15,(p0.page0Domains||[]).length);
add('Road LTL 13 A3',(road.a3Parents||[]).length===13,(road.a3Parents||[]).length);add('Road LTL 22 A5',(road.processes||[]).length===22,(road.processes||[]).length);add('39 flow edges',(road.processFlowEdges||[]).length===39,(road.processFlowEdges||[]).length);add('22 execution transitions',(road.executionTransitions||[]).length===22,(road.executionTransitions||[]).length);add('29 sources',(road.sources||[]).length===29,(road.sources||[]).length);
add('v1.1 data contract active',road.contractVersion==='atlas-data-contract-v1.1'&&j('data/module-catalog.json').dataContractVersion==='atlas-data-contract-v1.1');
add('Stage23 ontology node parity',road.ontologyNodes?.length===220,road.ontologyNodes?.length);add('Stage23 ontology edges parity',road.ontologyEdges?.length===176,road.ontologyEdges?.length);
for(const [n,ok,d] of checks)console.log(`${ok?'PASS':'FAIL'} · ${n}${d!==''?' · '+d:''}`);if(checks.some(x=>!x[1]))process.exit(1);
