const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const repo=path.resolve(process.argv[2]||'.'),checkout=path.resolve(process.argv[3]),output=path.resolve(process.argv[4]);
if(!process.argv[3]||!process.argv[4])throw Error('Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>');
if(fs.existsSync(checkout))throw Error('Fresh checkout directory required');
const git=(args,cwd=repo)=>cp.execFileSync('git',['-c','safe.directory='+cwd,'-c','safe.directory='+cwd+'/.git',...args],{cwd,encoding:'utf8',maxBuffer:50000000}).trim();
const head=git(['rev-parse','HEAD']);
// Full clone (all branches): the S8-3B suite reads pinned source commit 662c7847... reachable only from another branch.
cp.execFileSync('git',['-c','safe.directory='+repo,'-c','safe.directory='+repo+'/.git','clone','--no-hardlinks','--no-checkout',repo,checkout],{stdio:'pipe'});
git(['checkout','--detach',head],checkout);
const BASE='fe17ebb5c77fe86ef44a68d8a38eab65b5ce4751';
const inherited=['tests/p6-2-canonical-workdefinition-compiler.mjs','tests/s8-2e-leaf-compiler-correction.mjs','tests/s8-2e-atl159-workdefinition-lineage.test.cjs','tests/s8-2a-atl171-operational-semantics.test.cjs','tests/s8-2b-atl171-schema-compatibility.test.cjs','tests/s8-2c-atl165-client-binding.test.cjs','tests/s8-2d-atl165-binding-schema.test.cjs','tests/s8-3b-atl159-ltl04-workdefinition.test.mjs','tests/s8-3c-malkom-package-readiness.test.mjs','tests/s8-3d-malkom-projection-boundary.test.mjs','tests/s8-3e-atl178-flow-bpmn.test.mjs'];
const certified=['tests/p2-projection-boundary.mjs','tests/p3-universal-daughter-renderer.mjs','tests/p4-canvas-daughter-integration.mjs','tests/p5-ask-trace-governance.mjs','tests/v2-api-router-smoke.mjs'];
const s84='tests/s8-4-interaction-rebinding.test.mjs';
const run=(test,cwd)=>{const r=cp.spawnSync(process.execPath,[test],{cwd,encoding:'utf8',maxBuffer:50000000});return {command:['node',test],exitCode:r.status,stdout:r.stdout,stderr:r.stderr};};
const results=[...inherited.map(t=>({group:'S8-inherited',...run(t,checkout)})),...certified.map(t=>({group:'certified-donor-suite',...run(t,checkout)})),{group:'S8-4',...run(s84,checkout)}];
const clean=git(['status','--porcelain'],checkout)==='';
const s84r=results[results.length-1];
let s84Summary=null;try{s84Summary=JSON.parse(s84r.stdout.trim().split('\n').pop())}catch{}
// Deliberate mutation (negative) phase: each reintroduces a prohibited/regressed state in a scratch worktree and MUST make the S8-4 suite fail.
const ATL142='dba6968b0bdf28b533f4efd765302796e6ebed58',SUPERSEDED='cb2bcfea0892adf5a871fb4584461b50729ab383';
const w=(cwd,p,c)=>{fs.mkdirSync(path.dirname(path.join(cwd,p)),{recursive:true});fs.writeFileSync(path.join(cwd,p),c)};
const rd=(cwd,p)=>fs.readFileSync(path.join(cwd,p),'utf8');
const mutations=[
 ['M01','reintroduce ATL-142 superseded Ask API (cb2bcfea) as the live Ask API',(c)=>w(c,'lib/api/ask-atlas.js',git(['cat-file','blob',SUPERSEDED],c))],
 ['M02','reintroduce ATL-142 wrong root index.html',(c)=>w(c,'index.html',git(['show',ATL142+':index.html'],c)+'\n')],
 ['M03','replace the certified Canvas donor (modify canvas-v2.js)',(c)=>w(c,'canvas-v2/canvas-v2/assets/canvas-v2.js',rd(c,'canvas-v2/canvas-v2/assets/canvas-v2.js')+'\n// tampered\n')],
 ['M04','replace the certified bridge with an ungoverned stub',(c)=>w(c,'assets/canvas-daughter-bridge-v2.0.1.mjs',"export const CANVAS_DAUGHTER_BRIDGE_VERSION='2.0.1';export const TARGET_REGISTRY_PATH='/x';export const DAUGHTER_ROUTE='/daughter';export const buildDaughterHref=()=>'/daughter?stub';export const resolveDaughterTarget=()=>({moduleId:'road-ltl',daughterModuleVersion:'1.5'});\n")],
 ['M05','replace the certified Ask runtime with an older/modified implementation',(c)=>w(c,'runtime/universal-ask-atlas.js',rd(c,'runtime/universal-ask-atlas.js')+'\n// older\n')],
 ['M06','replace certified governed retrieval',(c)=>w(c,'lib/ask/p5-governed-retrieval.js',rd(c,'lib/ask/p5-governed-retrieval.js')+'\n// older\n')],
 ['M07','lose the ATL-140 behavioural delta: delete the journey module',(c)=>fs.rmSync(path.join(c,'assets/atl-140-v15-journey.mjs'))],
 ['M08','lose the ATL-140 behavioural delta: remove the shell journey bootstrap',(c)=>w(c,'execution/ui/runtime-access-shell.js',rd(c,'execution/ui/runtime-access-shell.js').split('\n').filter(l=>!l.includes('atl-140-v15-journey')).join('\n'))],
 ['M09','lose the ATL-140 behavioural delta: drop a crosswalk column from the consumer page',(c)=>w(c,'atl-140-malkom-consumer.html',rd(c,'atl-140-malkom-consumer.html').replace('<th>Malkom output</th>',''))],
 ['M10','reintroduce stale ATL-178 flow explorer page',(c)=>w(c,'atl-178-flow-explorer.html','<!doctype html><title>stale</title>\n')],
 ['M11','modify a governed S8-3E output implementation',(c)=>w(c,'lib/compile/s8-flow-bpmn.js',rd(c,'lib/compile/s8-flow-bpmn.js')+'\n// drift\n')],
 ['M12','introduce the stale WorkDefinition id into the consumer page',(c)=>w(c,'atl-140-malkom-consumer.html',rd(c,'atl-140-malkom-consumer.html')+'<!-- '+['wd','::road-ltl::LTL-04::v','1'].join('')+' -->\n')],
 ['M13','promote readiness claim in the public consumer model path (tamper S8-3D summary to READY)',(c)=>w(c,'governance/product/s8-3d-evidence/projection-summary.json',rd(c,'governance/product/s8-3d-evidence/projection-summary.json').replace('"readiness": "BLOCKED"','"readiness": "READY"'))],
 ['M14','delete a pinned Canvas freeze certificate',(c)=>fs.rmSync(path.join(c,'canvas-v2/canvas-v2/FREEZE_CERTIFICATE.md'))]
];
const mutationResults=[];
for(const [id,desc,fn] of mutations){
 const wt=path.join(path.dirname(checkout),path.basename(checkout)+'-'+id);
 git(['worktree','add','--detach',wt,head],checkout);
 let r;try{fn(wt);git(['add','-A'],wt);cp.execFileSync('git',['-c','safe.directory='+wt,'-c','user.name=qa','-c','user.email=qa@example.invalid','commit','-q','-m','mutation '+id],{cwd:wt});r=run(s84,wt)}catch(e){r={exitCode:null,stdout:'',stderr:String(e.message)}}
 const failedCases=(r.stdout.match(/^FAIL (\S+)/mg)||[]).map(x=>x.slice(5));
 mutationResults.push({id,mutation:desc,s84SuiteExitCode:r.exitCode,detectedByFailingCases:failedCases,detectionKind:failedCases.length?'CASE_FAILURE':'LOAD_ERROR',result:(r.exitCode!==0&&r.exitCode!==null&&(failedCases.length>0||/Error/.test(r.stderr)))?'DETECTED':'NOT_DETECTED'});
 git(['worktree','remove','--force',wt],checkout);
}
// Supplementary non-gating browser check.
let browser={status:'SKIPPED',detail:'harness unavailable'};
try{
 const port=39000+Math.floor(Math.random()*500);
 const srv=cp.spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:checkout,stdio:'ignore'});
 cp.spawnSync('sleep',['1']);
 const r=cp.spawnSync(process.execPath,[path.join(checkout,'governance/product/s8-4-evidence/e2e-smoke.mjs'),'http://127.0.0.1:'+port],{encoding:'utf8',timeout:120000});
 srv.kill();try{browser=JSON.parse(r.stdout.trim().split('\n').pop())}catch{browser={status:'SKIPPED',detail:'no output'}}
}catch(e){browser={status:'SKIPPED',detail:String(e.message).slice(0,200)}}
const pass=results.every(r=>r.exitCode===0)&&clean&&mutationResults.every(m=>m.result==='DETECTED');
const evidence={schemaVersion:'s8-4-exact-qa-v1',testedCommit:head,testedTree:git(['rev-parse',head+'^{tree}']),base:BASE,nodeVersion:process.version,platform:process.platform,architecture:process.arch,testScope:'S8-4 controlled interaction rebinding: certified donor identity, corrected ancestry, prohibited lineage (ATL-142 root/Ask), ATL-140 behaviour preservation, scope/non-promotion, fail-closed; inherited S8-2/3 suites; certified donor suites p2-p5 + api router smoke; deliberate mutation tests; no runtime/release certification',status:pass?'PASS':'FAIL',suites:{total:results.length,passed:results.filter(r=>r.exitCode===0).length},s84Suite:s84Summary,results,mutationTests:{total:mutationResults.length,detected:mutationResults.filter(m=>m.result==='DETECTED').length,results:mutationResults},supplementaryBrowserCheck:browser,cleanCheckout:clean};
fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,testedCommit:head,testedTree:evidence.testedTree,passedSuites:evidence.suites.passed,totalSuites:evidence.suites.total,s84:s84Summary&&{total:s84Summary.total,passed:s84Summary.passed},mutations:evidence.mutationTests.detected+'/'+evidence.mutationTests.total,browser:browser.status,cleanCheckout:clean,evidenceSha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')},null,2));
if(!pass)process.exitCode=1;
