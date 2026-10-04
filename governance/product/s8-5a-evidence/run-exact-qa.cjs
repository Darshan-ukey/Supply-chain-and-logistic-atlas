// S8-5A exact-commit QA runner. Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>
// Fresh full clone at the exact tested commit; runs the S8-5A suite (ATL-157 compatibility retest, ATL-173 corrected successor
// derivation, ATL-167 BLOCKED record, scope) + inherited S8 suites + certified donor suites + S8-4 + S8-3F suites; compares every
// failing case with the exact S8-3F base worktree; deliberate mutation tests; non-gating inherited failures vs the S8-3F base.
// PASS here = S8-5A executable retests only. It is NOT release readiness and does not resolve ATL-167 (BLOCKED).
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const repo=path.resolve(process.argv[2]||'.'),checkout=path.resolve(process.argv[3]),output=path.resolve(process.argv[4]);
if(!process.argv[3]||!process.argv[4])throw Error('Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>');
if(fs.existsSync(checkout))throw Error('Fresh checkout directory required');
const git=(args,cwd=repo)=>cp.execFileSync('git',['-c','safe.directory='+cwd,'-c','safe.directory='+cwd+'/.git',...args],{cwd,encoding:'utf8',maxBuffer:200000000}).trim();
const head=git(['rev-parse','HEAD']);
cp.execFileSync('git',['-c','safe.directory='+repo,'-c','safe.directory='+repo+'/.git','clone','--no-hardlinks','--no-checkout',repo,checkout],{stdio:'pipe'});
git(['checkout','--detach',head],checkout);
const BASE='a3e2dc1687a9dd8a290645a4ed77895fb39f97e7';
const S84_TESTED='07a41138f7b52e5fe1d0c9d5989f72b9835560c5',S83F_TESTED='67c80d513aa9de798e33814b963ee0e62ed7abad';
const inherited=['tests/p6-2-canonical-workdefinition-compiler.mjs','tests/s8-2e-leaf-compiler-correction.mjs','tests/s8-2e-atl159-workdefinition-lineage.test.cjs','tests/s8-2a-atl171-operational-semantics.test.cjs','tests/s8-2b-atl171-schema-compatibility.test.cjs','tests/s8-2c-atl165-client-binding.test.cjs','tests/s8-2d-atl165-binding-schema.test.cjs','tests/s8-3b-atl159-ltl04-workdefinition.test.mjs','tests/s8-3c-malkom-package-readiness.test.mjs','tests/s8-3d-malkom-projection-boundary.test.mjs','tests/s8-3e-atl178-flow-bpmn.test.mjs'];
const certified=['tests/p2-projection-boundary.mjs','tests/p3-universal-daughter-renderer.mjs','tests/p4-canvas-daughter-integration.mjs','tests/p5-ask-trace-governance.mjs','tests/v2-api-router-smoke.mjs'];
const s85a='tests/s8-5a-successor-retests.test.mjs',s84='tests/s8-4-interaction-rebinding.test.mjs',s83f='tests/s8-3f-governed-release-manifest.test.mjs';
const nonGating=['tests/v2-ui-browser-smoke.mjs','tests/v1.1.4-static-parity.mjs'];
const run=(args,cwd)=>{const r=cp.spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:200000000,timeout:600000});return {command:['node',...args],exitCode:r.status,signal:r.signal,stdout:r.stdout||'',stderr:r.stderr||''};};
const summaryOf=(r)=>{try{return JSON.parse(r.stdout.trim().split('\n').pop())}catch{return null}};
const failCases=(r)=>[...new Set((r.stdout.match(/^FAIL .+$/mg)||[]).map(x=>x.slice(5,125)))].sort();
const wtPath=(tag)=>path.join(path.dirname(checkout),path.basename(checkout)+'-'+tag);
const results=[{group:'S8-5A',...run([s85a],checkout)},...inherited.map(t=>({group:'S8-inherited',...run([t],checkout)})),...certified.map(t=>({group:'certified-donor-suite',...run([t],checkout)})),{group:'S8-4',...run([s84],checkout)},{group:'S8-3F',...run([s83f],checkout)},{group:'S8-3F-cli-check-reproduce',...run(['scripts/s8-3f-release-manifest.mjs','--check','--reproduce'],checkout)}];
const clean=git(['status','--porcelain'],checkout)==='';
const s85aRes=results[0];const s85aSummary=summaryOf(s85aRes);
const s85aCases=(s85aRes.stdout.match(/^(PASS|FAIL) .+$/mg)||[]);

// ---- every non-zero suite is compared with the exact S8-3F base worktree (same failing-case set => inherited, not a regression)
const baseWt=wtPath('base');git(['worktree','add','--detach',baseWt,BASE],checkout);
const baseComparisons=[];
for(const r of results){
 if(r.group==='S8-5A'||r.exitCode===0)continue;
 const b=run(r.command.slice(1),baseWt);
 const tested=failCases(r),base=failCases(b);
 const onlyOnTested=tested.filter(c=>!base.includes(c));
 baseComparisons.push({suite:r.command[1],group:r.group,testedExit:r.exitCode,baseExit:b.exitCode,failingCasesOnTested:tested,failingCasesOnBase:base,newFailuresVsBase:onlyOnTested,identicalToBase:b.exitCode===r.exitCode&&onlyOnTested.length===0});
}
const nonGatingResults=nonGating.map(t=>{const a=run([t],checkout),b=run([t],baseWt);const tail=(x)=>(x.stdout+x.stderr).trim().split('\n').slice(-3).join(' | ').slice(0,300);return {test:t,testedCommitExitCode:a.exitCode,s83fBaseExitCode:b.exitCode,failureAlreadyOnBase:a.exitCode!==0&&b.exitCode!==0,identicalOutcome:a.exitCode===b.exitCode,testedCommitTail:tail(a),s83fBaseTail:tail(b)}});
git(['worktree','remove','--force',baseWt],checkout);

// ---- stage-scope guards: S8-4 S01..S03 and the S8-3F scope case assert changed paths vs their OWN base; they fail on any successor commit by design.
// Predecessor suites are NOT edited. Rule: they may fail ONLY those cases, the new failures vs base must be only the S8-3F scope case, and each predecessor's exact tested commit must pass in this run.
const predecessorAt=(commit,test,tag)=>{const wt=wtPath(tag);git(['worktree','add','--detach',wt,commit],checkout);const r=run([test],wt);git(['worktree','remove','--force',wt],checkout);return {commit,exitCode:r.exitCode,summary:summaryOf(r)};};
const s84AtTested=predecessorAt(S84_TESTED,s84,'s84tested');
const s83fAtTested=predecessorAt(S83F_TESTED,s83f,'s83ftested');
const s84Res=results.find(r=>r.group==='S8-4'),s83fRes=results.find(r=>r.group==='S8-3F');
const s84Failed=failCases(s84Res).map(x=>x.split(' ')[0]);
const s83fFailed=failCases(s83fRes);
const s84Guard=s84Res.exitCode===0||(s84Failed.every(c=>['S01','S02','S03'].includes(c))&&s84AtTested.exitCode===0&&s84AtTested.summary&&s84AtTested.summary.failed===0);
const s83fGuard=s83fRes.exitCode===0||(s83fFailed.length>0&&s83fFailed.every(c=>c.startsWith('S8-3F scope'))&&s83fAtTested.exitCode===0&&s83fAtTested.summary&&s83fAtTested.summary.failed===0);
s84Res.classification=s84Res.exitCode===0?'PASS':(s84Guard?'STAGE_SCOPE_GUARD_ONLY_NOT_PRODUCT_REGRESSION':'FAIL');
s83fRes.classification=s83fRes.exitCode===0?'PASS':(s83fGuard?'STAGE_SCOPE_GUARD_ONLY_NOT_PRODUCT_REGRESSION':'FAIL');
const scopeGuardAnalysis={s84:{failedCasesOnTestedCommit:s84Failed,atExactS84TestedCommit:s84AtTested,alreadyFailingOnS83fBase:(baseComparisons.find(c=>c.suite===s84)||{}).failingCasesOnBase||[]},s83f:{failedCasesOnTestedCommit:s83fFailed,atExactS83fTestedCommit:s83fAtTested},explanation:'These cases compare the changed-path set to their own stage diff and necessarily fail on any successor commit. All product cases pass. Scope control for S8-5A is asserted by the S8-5A suite (additive allowlist) and the changed-path scan below.'};

// ---- deliberate mutation phase: each mutation is COMMITTED in a scratch worktree and the S8-5A suite MUST fail.
const EV='governance/product/s8-5a-evidence/',FX='tests/fixtures/s8-5a/atl-157-historical/';
const w=(cwd,p,c)=>{fs.mkdirSync(path.dirname(path.join(cwd,p)),{recursive:true});fs.writeFileSync(path.join(cwd,p),c)};
const rd=(cwd,p)=>fs.readFileSync(path.join(cwd,p),'utf8');
const js=(p,fn)=>(c)=>{const o=JSON.parse(rd(c,p));fn(o);w(c,p,JSON.stringify(o,null,2)+'\n')};
const blob=(c,b)=>cp.execFileSync('git',['-c','safe.directory='+c,'cat-file','blob',b],{cwd:c,maxBuffer:200000000});
const P173=EV+'atl-173-successor-utility-proof.json',P167=EV+'atl-167-blocked-record.json',P157=EV+'atl-157-retest-summary.json';
const sub=(p,a,b)=>(c)=>{const t=rd(c,p);if(!t.includes(a))throw Error('mutation anchor missing: '+a);w(c,p,t.replace(a,b))};
const mutations=[
 ['M01','historical ATL-157 materializer fixture tampered (extra byte)',(c)=>w(c,FX+'materialize-bounded-depth-v1.cjs',rd(c,FX+'materialize-bounded-depth-v1.cjs')+'\n// tampered\n')],
 ['M02','historical ATL-157 test fixture weakened (assertion removed)',(c)=>{const p=FX+'atl-157-bounded-depth.test.cjs';const t=rd(c,p);const i=t.indexOf('assert');if(i<0)throw Error('no assert');w(c,p,t.slice(0,i)+'// '+t.slice(i))}],
 ['M03','historical machine-trigger rejection fixture deleted',(c)=>fs.rmSync(path.join(c,FX+'atl-157-machine-trigger-reject.json'))],
 ['M04','fixture provenance blob table altered',sub(FX+'PROVENANCE.json','348f4c48','00000000')],
 ['M05','corrected readiness pin replaced by a stale identity',sub('tests/s8-5a-support/successor-lineage.mjs','c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617','0'.repeat(64))],
 ['M06','corrected semantics-record pin replaced by a stale identity',sub('tests/s8-5a-support/successor-lineage.mjs','d642c1d59f2e938e5afcc60355f086b61e57f33d63e57e54b2a72def09a21576','1'.repeat(64))],
 ['M07','stale source blob identity injected into the successor utility proof',js(P173,(o)=>{o.requirements[0].derivedFrom+=' c3bb7336'})],
 ['M08','utility proof promotes universalExecutionReady',js(P173,(o)=>{o.state.universalExecutionReady=true})],
 ['M09','utility proof promotes materializable/runtime certification',js(P173,(o)=>{o.state.materializable=true;o.state.runtimeCertification=true})],
 ['M10','utility proof overstates work semantics as AVAILABLE',js(P173,(o)=>{o.requirements[1].status='AVAILABLE'})],
 ['M11','historical counts presented as the current successor counts',js(P173,(o)=>{o.counts.availableOrProjectable=2;delete o.counts.partial})],
 ['M12','client-binding blocker silently resolved in utility proof',js(P173,(o)=>{o.state.clientBindingState='RESOLVED';o.requirements[2].status='AVAILABLE'})],
 ['M13','utility-value limitation guard removed from proof',js(P173,(o)=>{o.limitations=o.limitations.filter(l=>!/utility-value|partially compiled/.test(l))})],
 ['M14','non-public source identifier leaked into the public proof',js(P173,(o)=>{o.requirements[3].residual+=' src-leaked-source-id'})],
 ['M15','ATL-167 recorded as PASS',js(P167,(o)=>{o.result='PASS'})],
 ['M16','ATL-167 marked superseded by S8-4 exclusion',js(P167,(o)=>{o.notAnAuthoritativeSupersession='SUPERSEDED by S8-4';o.paDisposition.disposition='SUPERSEDED'})],
 ['M17','ATL-167 stale slice page ported into the successor tree',(c)=>w(c,'atl-167-coherent-interaction-slice.html','<!doctype html><title>slice</title>\n')],
 ['M18','ATL-157 bounded-depth materializer introduced as a successor product component',(c)=>w(c,'scripts/materialize-bounded-depth-v1.cjs',rd(c,FX+'materialize-bounded-depth-v1.cjs'))],
 ['M19','certified root index.html modified to link the stale slice',(c)=>w(c,'index.html',rd(c,'index.html')+'\n<a href="atl-167-coherent-interaction-slice.html">slice</a>\n')],
 ['M20','ATL-157 summary claims a shipped successor component',js(P157,(o)=>{o.passMeans='ATL-157 is a shipped successor component.'})],
 ['M21','ATL-157 summary result/candidate count altered',js(P157,(o)=>{o.successorOutput.candidateCount=7})],
 ['M22','S8-3F release manifest hand-edited (manifest regeneration out of scope)',(c)=>{const p='release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json';w(c,p,rd(c,p).replace(/\n$/,'')+'\n\n')}],
 ['M23','S8-3F evidence altered',(c)=>{const p='governance/product/s8-3f-evidence/exact-qa.json';w(c,p,rd(c,p).replace('"PASS"','"FAIL"'))}],
 ['M24','product library path modified (scope creep)',(c)=>w(c,'lib/s8-5a-scope-creep.js','// scope creep\n')],
 ['M25','S8-5A successor test harness helper tampered (derivation guard removed)',sub('tests/s8-5a-support/atl173-utility-derivation.mjs','assertCorrectedIdentities(hashes);','/* guard removed */')],
 ['M26','evidence summary no longer deterministic (field added to committed ATL-157 summary)',js(P157,(o)=>{o.extra='hand-edited'})]
];
const mutationResults=[];
for(const [id,desc,fn] of mutations){
 const wt=wtPath(id);git(['worktree','add','--detach',wt,head],checkout);
 let r;try{fn(wt);git(['add','-A'],wt);cp.execFileSync('git',['-c','safe.directory='+wt,'-c','user.name=qa','-c','user.email=qa@example.invalid','commit','-q','--allow-empty','-m','mutation '+id],{cwd:wt});r=run([s85a],wt)}catch(e){r={exitCode:null,stdout:'',stderr:String(e.message).slice(0,400)}}
 const f=failCases(r);
 mutationResults.push({id,mutation:desc,s85aSuiteExitCode:r.exitCode,detectedByFailingCases:f.length,firstDetections:f.slice(0,3),result:(r.exitCode!==0&&r.exitCode!==null&&f.length>0)?'DETECTED':'NOT_DETECTED',...(r.exitCode===null?{infrastructureError:r.stderr}:{})});
 git(['worktree','remove','--force',wt],checkout);
}

// ---- changed paths relative to the exact S8-3F base + product-path scan
const changedPaths=git(['diff','--name-status',BASE,head],checkout).split('\n').filter(Boolean);
const okPath=(p)=>p.startsWith('tests/fixtures/s8-5a/atl-157-historical/')||p.startsWith('tests/s8-5a-support/')||p==='tests/s8-5a-successor-retests.test.mjs'||p==='governance/product/S8_5A_BOUNDED_SUCCESSOR_RETESTS.md'||p.startsWith('governance/product/s8-5a-evidence/');
const scopeOk=changedPaths.every(l=>{const [st,p]=l.split('\t');return st==='A'&&okPath(p)});

const gatingFailures=results.filter(r=>r.exitCode!==0&&r.classification!=='STAGE_SCOPE_GUARD_ONLY_NOT_PRODUCT_REGRESSION').map(r=>r.command[1]);
const newFailuresVsBase=baseComparisons.filter(c=>!c.identicalToBase&&!(c.suite===s84||c.suite===s83f)).map(c=>c.suite);
const atl157Pass=/^PASS K\d\d/m.test(s85aRes.stdout)&&!/^FAIL K\d\d/m.test(s85aRes.stdout);
const atl173Pass=/^PASS U\d\d/m.test(s85aRes.stdout)&&!/^FAIL U\d\d/m.test(s85aRes.stdout);
const atl167Blocked=JSON.parse(fs.readFileSync(path.join(checkout,P167),'utf8')).result==='BLOCKED'&&!/^FAIL V\d\d/m.test(s85aRes.stdout);
const executablePass=s85aRes.exitCode===0&&atl157Pass&&atl173Pass;
const pass=executablePass&&atl167Blocked&&gatingFailures.length===0&&newFailuresVsBase.length===0&&clean&&scopeOk&&mutationResults.every(m=>m.result==='DETECTED')&&nonGatingResults.every(n=>n.identicalOutcome);
const classification=pass?'S8-5A PARTIAL — EXECUTABLE RETESTS PASS; ATL-167 BLOCKED PENDING BOUNDED REMEDIATION DECISION':'S8-5A FAIL — SEE QA EVIDENCE';
const evidence={schemaVersion:'s8-5a-exact-qa-v1',testedCommit:head,testedTree:git(['rev-parse',head+'^{tree}']),base:BASE,nodeVersion:process.version,platform:process.platform,architecture:process.arch,
 testScope:'S8-5A bounded successor retests: ATL-157 compatibility retest (historical blob-pinned fixtures against corrected S8 inputs; not a shipped successor component), ATL-173 corrected successor utility derivation (no historical counts, no utility-value claim), ATL-167 BLOCKED record (not executed/ported/superseded); inherited S8 suites, certified donor suites, S8-4 and S8-3F suites compared with the exact S8-3F base; deliberate mutation tests. PARTIAL is not release readiness.',
 status:pass?'PASS':'FAIL',overallClassification:classification,
 itemResults:{'ATL-157':atl157Pass?'PASS (compatibility only)':'FAIL','ATL-173':atl173Pass?'PASS (corrected bounded state; no readiness/utility-value claim)':'FAIL','ATL-167':atl167Blocked?'BLOCKED — NO CURRENT SUCCESSOR RETEST SURFACE':'UNKNOWN'},
 suites:{total:results.length,passed:results.filter(r=>r.exitCode===0).length,scopeGuardOnlyException:results.filter(r=>r.classification==='STAGE_SCOPE_GUARD_ONLY_NOT_PRODUCT_REGRESSION').length,gatingFailures,newFailuresVsS83fBase:newFailuresVsBase},
 s85aSuite:{...s85aSummary,cases:s85aCases},scopeGuardAnalysis,baseComparisons,results:results.map(({stdout,stderr,...r})=>({...r,summary:summaryOf({stdout}),failingCases:failCases({stdout}),stderrTail:(stderr||'').trim().split('\n').slice(-2).join(' | ').slice(0,300)})),mutationTests:{total:mutationResults.length,detected:mutationResults.filter(m=>m.result==='DETECTED').length,results:mutationResults},nonGatingInheritedChecks:nonGatingResults,changedPathsVsS83fBase:changedPaths,changedPathScopeOk:scopeOk,cleanCheckout:clean};
fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,classification,testedCommit:head,testedTree:evidence.testedTree,items:evidence.itemResults,passedSuites:evidence.suites.passed,totalSuites:evidence.suites.total,gatingFailures,newFailuresVsBase,s85a:s85aSummary,mutations:evidence.mutationTests.detected+'/'+evidence.mutationTests.total,notDetected:mutationResults.filter(m=>m.result!=='DETECTED').map(m=>m.id),nonGating:nonGatingResults.map(n=>[n.test,n.testedCommitExitCode,n.s83fBaseExitCode]),scopeOk,cleanCheckout:clean,evidenceSha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')},null,2));
if(!pass)process.exitCode=1;
