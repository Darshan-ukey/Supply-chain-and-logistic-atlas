// S8-3F exact-commit QA runner. Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>
// Fresh full clone at the exact tested commit; runs inherited S8 suites + certified donor suites + S8-4 suite + S8-3F suite,
// the manifest CLI check (with protected-identity reproduction), deliberate mutation tests, and compares the two
// known non-gating failures against the exact S8-4 base. PASS here = manifest/regeneration correctness ONLY.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const repo=path.resolve(process.argv[2]||'.'),checkout=path.resolve(process.argv[3]),output=path.resolve(process.argv[4]);
if(!process.argv[3]||!process.argv[4])throw Error('Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>');
if(fs.existsSync(checkout))throw Error('Fresh checkout directory required');
const git=(args,cwd=repo)=>cp.execFileSync('git',['-c','safe.directory='+cwd,'-c','safe.directory='+cwd+'/.git',...args],{cwd,encoding:'utf8',maxBuffer:200000000}).trim();
const head=git(['rev-parse','HEAD']);
cp.execFileSync('git',['-c','safe.directory='+repo,'-c','safe.directory='+repo+'/.git','clone','--no-hardlinks','--no-checkout',repo,checkout],{stdio:'pipe'});
git(['checkout','--detach',head],checkout);
const S84_BASE='3ead8bd108c349ba2149063d39376c8d2a04c2f3';
const inherited=['tests/p6-2-canonical-workdefinition-compiler.mjs','tests/s8-2e-leaf-compiler-correction.mjs','tests/s8-2e-atl159-workdefinition-lineage.test.cjs','tests/s8-2a-atl171-operational-semantics.test.cjs','tests/s8-2b-atl171-schema-compatibility.test.cjs','tests/s8-2c-atl165-client-binding.test.cjs','tests/s8-2d-atl165-binding-schema.test.cjs','tests/s8-3b-atl159-ltl04-workdefinition.test.mjs','tests/s8-3c-malkom-package-readiness.test.mjs','tests/s8-3d-malkom-projection-boundary.test.mjs','tests/s8-3e-atl178-flow-bpmn.test.mjs'];
const certified=['tests/p2-projection-boundary.mjs','tests/p3-universal-daughter-renderer.mjs','tests/p4-canvas-daughter-integration.mjs','tests/p5-ask-trace-governance.mjs','tests/v2-api-router-smoke.mjs'];
const s84='tests/s8-4-interaction-rebinding.test.mjs',s83f='tests/s8-3f-governed-release-manifest.test.mjs';
const nonGating=['tests/v2-ui-browser-smoke.mjs','tests/v1.1.4-static-parity.mjs'];
const run=(args,cwd)=>{const r=cp.spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:200000000,timeout:600000});return {command:['node',...args],exitCode:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr};};
const summaryOf=(r)=>{try{return JSON.parse(r.stdout.trim().split('\n').pop())}catch{return null}};
const results=[...inherited.map(t=>({group:'S8-inherited',...run([t],checkout)})),...certified.map(t=>({group:'certified-donor-suite',...run([t],checkout)})),{group:'S8-4',...run([s84],checkout)},{group:'S8-3F',...run([s83f],checkout)},{group:'S8-3F-cli-check-reproduce',...run(['scripts/s8-3f-release-manifest.mjs','--check','--reproduce'],checkout)}];
const clean=git(['status','--porcelain'],checkout)==='';
const s83fSummary=summaryOf(results.find(r=>r.group==='S8-3F'));
const s83fCases=(results.find(r=>r.group==='S8-3F').stdout.match(/^(PASS|FAIL) .+$/mg)||[]);

// ---- deliberate mutation phase: each mutation is COMMITTED in a scratch worktree and the S8-3F suite MUST fail.
const MANIFEST='release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json';
const w=(cwd,p,c)=>{fs.mkdirSync(path.dirname(path.join(cwd,p)),{recursive:true});fs.writeFileSync(path.join(cwd,p),c)};
const rd=(cwd,p)=>fs.readFileSync(path.join(cwd,p),'utf8');
const man=(fn)=>(c)=>{const m=JSON.parse(rd(c,MANIFEST));fn(m,c);w(c,MANIFEST,JSON.stringify(m,null,2)+'\n')};
const ent=(m,id)=>m.lineage.find(l=>l.id===id);
const blob=(c,b)=>cp.execFileSync('git',['-c','safe.directory='+c,'cat-file','blob',b],{cwd:c,maxBuffer:200000000});
const STALE_WD=['wd','::road-ltl::LTL-04::v','1'].join('');
const ATL142='dba6968b0bdf28b533f4efd765302796e6ebed58';
const mutations=[
 ['M01','corrected S8 derivative identity replaced by a stale identity (manifest)',man((m)=>{const e=ent(m,'derivative.wd');e.expected='c3bb7336'+'0'.repeat(56);e.observed=e.expected})],
 ['M02','corrected S8-4 input identity replaced by a stale blob (manifest)',man((m)=>{ent(m,'interaction.ask-runtime').expected='d43f4130'+'0'.repeat(32)})],
 ['M03','ATL-140 wrong root reintroduced as the tree root index.html',(c)=>w(c,'index.html',blob(c,'9cf88a867359ba33ebfbe85c1360f0ab21bc29b3'))],
 ['M04','ATL-140 wrong root reintroduced as release authority (manifest)',man((m)=>{const e=ent(m,'interaction.root-index');e.expected=e.observed='9cf88a867359ba33ebfbe85c1360f0ab21bc29b3'})],
 ['M05','ATL-142 wrong root reintroduced as the tree root index.html',(c)=>w(c,'index.html',git(['show',ATL142+':index.html'],c)+'\n')],
 ['M06','ATL-142 wrong root introduced as release authority (manifest)',man((m)=>{const e=ent(m,'interaction.root-index');e.expected=e.observed='379f988ce807f33dc8fd43b49b227b917a15b8c0'})],
 ['M07','superseded Ask (cb2bcfea) installed as the live Ask API',(c)=>w(c,'lib/api/ask-atlas.js',blob(c,'cb2bcfea0892adf5a871fb4584461b50729ab383'))],
 ['M08','superseded Ask residual represented as current certified Ask (manifest)',man((m)=>{const r=m.residuals.find(x=>x.id==='RES-ASK-RELEASE-PACKAGES');r.representsCurrentCertifiedAsk=true;r.status='CERTIFIED_CURRENT'})],
 ['M09','inherited release-package Ask copy rewritten (out-of-scope package change)',(c)=>w(c,'release/packages/lab/lib/api/ask-atlas.js',rd(c,'release/packages/lab/lib/api/ask-atlas.js')+'\n// rewritten\n')],
 ['M10','governed source identity missing from manifest',man((m)=>{m.lineage=m.lineage.filter(l=>l.id!=='source.road-ltl-v1.4')})],
 ['M11','frozen donor generator deleted from the tree',(c)=>fs.rmSync(path.join(c,'lib/compile/workdefinition-compiler.js'))],
 ['M12','frozen donor schema identity missing from manifest',man((m)=>{m.lineage=m.lineage.filter(l=>l.id!=='contract.workdefinition-frozen-schema')})],
 ['M13','protected artifact represented by ungoverned content (path/content added to manifest)',man((m)=>{const e=ent(m,'derivative.bpmn');e.path='generated/flow.bpmn';e.content='<bpmn/>';e.bytesPublished=true})],
 ['M14','protected output hash drift in manifest (package observed altered)',man((m)=>{ent(m,'derivative.package').observed='0'.repeat(64)})],
 ['M15','public S8-3C evidence summary tampered (package hash drift in source evidence)',(c)=>{const p='governance/product/s8-3c-evidence/package-readiness-summary.json';w(c,p,rd(c,p).replace('6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367','0'.repeat(64)))}],
 ['M16','rollback identity nominated without authority (v2 baseline selected as target)',man((m)=>{m.rollback.currentSuccessorRollbackTarget='release/baselines/v2-critical-hashes.json';m.rollback.rollbackIdentityStatus='ESTABLISHED'})],
 ['M17','rollback section missing',man((m)=>{delete m.rollback})],
 ['M18','rollback recovery identity drift',man((m)=>{m.rollback.recoveryEvidence.gitContentAddressedArtifacts['index.html']='0'.repeat(40)})],
 ['M19','deployment rollback identity fabricated',man((m)=>{m.rollback.deploymentRollbackIdentity='dpl_fabricated'})],
 ['M20','historical ATL-175 v1.1.8 baseline imported into the successor tree',(c)=>w(c,'release/baselines/v1.1.8-critical-hashes.json',blob(c,'98296aa26eb563479e666fe6dd007bf422920c6d').toString('utf8'))],
 ['M21','historical ATL-175 baseline relabelled as current rollback identity (manifest)',man((m)=>{m.historicalEvidence.find(h=>h.id==='historical.atl-175-rollback-baseline').currentSuccessorRollbackIdentity=true})],
 ['M22','ownerGateRequired set to false',man((m)=>{m.controls.ownerGateRequired=false})],
 ['M23','productionPromotionAuthorized set to true',man((m)=>{m.controls.productionPromotionAuthorized=true})],
 ['M24','runtime readiness promoted in manifest',man((m)=>{m.runtimeState.universalExecutionReady=true;m.runtimeState.materializable=true;m.runtimeState.runtimeReadiness='READY'})],
 ['M25','runtime readiness promoted in public S8-3D evidence (universalExecutionReady true)',(c)=>{const p='governance/product/s8-3d-evidence/projection-summary.json';w(c,p,rd(c,p).replace(/"universalExecutionReady":\s*false/,'"universalExecutionReady": true'))}],
 ['M26','unresolved blocker removed (client binding + knowledge gap) in manifest',man((m)=>{m.runtimeState.unresolvedBindingCount=0;m.runtimeState.clientBindingState='RESOLVED';m.runtimeState.knowledgeGapState='RESOLVED';m.runtimeState.blockedByKnowledgeGapLeafCount=0})],
 ['M27','S8-4 identity omitted from manifest successor spine',man((m)=>{delete m.successorSpine.s8_4})],
 ['M28','S8-4 certified bridge deleted from the tree',(c)=>fs.rmSync(path.join(c,'assets/canvas-daughter-bridge-v2.0.1.mjs'))],
 ['M29','S8-4 QA evidence file altered',(c)=>{const p='governance/product/s8-4-evidence/exact-qa.json';w(c,p,rd(c,p).replace('"PASS"','"FAIL"'))}],
 ['M30','release-integrity baseline "repaired" so the verifier passes (must not be silently repaired)',(c)=>{const crypto=require('crypto');const p='release/baselines/v2-critical-hashes.json';const b=JSON.parse(rd(c,p));for(const f of Object.keys(b.files))b.files[f]=crypto.createHash('sha256').update(fs.readFileSync(path.join(c,f))).digest('hex');w(c,p,JSON.stringify(b,null,2)+'\n')}],
 ['M31','release-integrity manifest section certifies the failing baseline',man((m)=>{m.releaseIntegrity.certified=true;m.releaseIntegrity.manifestCertifiesBaseline=true;m.releaseIntegrity.observedVerification.status='PASSES_VERIFICATION'})],
 ['M32','release-integrity verifier weakened (always ok)',(c)=>w(c,'lib/api/release-integrity.js',rd(c,'lib/api/release-integrity.js').replace('const ok=files.length>0&&files.every(x=>x.ok);','const ok=true;'))],
 ['M33','manifest generator tampered (determinism/identity of generator)',(c)=>w(c,'lib/release/s8-release-manifest.js',rd(c,'lib/release/s8-release-manifest.js')+'\n// tampered\n')],
 ['M34','stale WorkDefinition id introduced into governed S8-4 consumer page',(c)=>w(c,'atl-140-malkom-consumer.html',rd(c,'atl-140-malkom-consumer.html')+'<!-- '+STALE_WD+' -->\n')],
 ['M35','downstream state altered (S8-5 marked started, release mergeable)',man((m)=>{m.downstream['S8-5']='STARTED';m.downstream.release='MERGE'})],
 ['M36','manifest hand-edited (not equal to deterministic regeneration)',man((m)=>{m.generator.hand='edited'})]
];
const mutationResults=[];
for(const [id,desc,fn] of mutations){
 const wt=path.join(path.dirname(checkout),path.basename(checkout)+'-'+id);
 git(['worktree','add','--detach',wt,head],checkout);
 let r;try{fn(wt);git(['add','-A'],wt);cp.execFileSync('git',['-c','safe.directory='+wt,'-c','user.name=qa','-c','user.email=qa@example.invalid','commit','-q','--allow-empty','-m','mutation '+id],{cwd:wt});r=run([s83f],wt)}catch(e){r={exitCode:null,stdout:'',stderr:String(e.message).slice(0,400)}}
 const failedCases=(r.stdout.match(/^FAIL (.+)$/mg)||[]).map(x=>x.slice(5));
 mutationResults.push({id,mutation:desc,s83fSuiteExitCode:r.exitCode,detectedByFailingCases:failedCases.length,firstDetections:failedCases.slice(0,3),result:(r.exitCode!==0&&r.exitCode!==null&&failedCases.length>0)?'DETECTED':'NOT_DETECTED',...(r.exitCode===null?{infrastructureError:r.stderr}:{})});
 git(['worktree','remove','--force',wt],checkout);
}

// ---- non-gating inherited failures: run on the tested commit and on the exact S8-4 base head; compare.
const baseWt=path.join(path.dirname(checkout),path.basename(checkout)+'-s84base');
git(['worktree','add','--detach',baseWt,S84_BASE],checkout);
const nonGatingResults=nonGating.map(t=>{const a=run([t],checkout),b=run([t],baseWt);const tail=(x)=>(x.stdout+x.stderr).trim().split('\n').slice(-3).join(' | ').slice(0,300);return {test:t,testedCommitExitCode:a.exitCode,s84BaseExitCode:b.exitCode,failureAlreadyOnS84Base:a.exitCode!==0&&b.exitCode!==0,identicalOutcome:a.exitCode===b.exitCode,testedCommitTail:tail(a),s84BaseTail:tail(b)}});
git(['worktree','remove','--force',baseWt],checkout);

// ---- S8-3F changed paths relative to the S8-4 base
const changedPaths=git(['diff','--name-status',S84_BASE,head],checkout).split('\n');
const gatingOk=results.every(r=>r.exitCode===0);
const pass=gatingOk&&clean&&mutationResults.every(m=>m.result==='DETECTED')&&nonGatingResults.every(n=>n.identicalOutcome);
const evidence={schemaVersion:'s8-3f-exact-qa-v1',testedCommit:head,testedTree:git(['rev-parse',head+'^{tree}']),base:S84_BASE,nodeVersion:process.version,platform:process.platform,architecture:process.arch,
 testScope:'S8-3F governed release-manifest regeneration: deterministic generator/verifier, lineage closure, stale/wrong-donor exclusion, protected boundary, rollback NOT_ESTABLISHED representation, fail-closed integrity, Owner gate, no promotion; inherited S8-2/3/4 suites; certified donor suites; deliberate mutation tests. PASS = manifest/regeneration correctness ONLY (not release, rollback or runtime readiness).',
 status:pass?'PASS':'FAIL',suites:{total:results.length,passed:results.filter(r=>r.exitCode===0).length},s83fSuite:{...s83fSummary,cases:s83fCases},s84Suite:summaryOf(results.find(r=>r.group==='S8-4')),results,mutationTests:{total:mutationResults.length,detected:mutationResults.filter(m=>m.result==='DETECTED').length,results:mutationResults},nonGatingInheritedChecks:nonGatingResults,changedPathsVsS84Base:changedPaths,cleanCheckout:clean};
fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,testedCommit:head,testedTree:evidence.testedTree,passedSuites:evidence.suites.passed,totalSuites:evidence.suites.total,s83f:s83fSummary,mutations:evidence.mutationTests.detected+'/'+evidence.mutationTests.total,notDetected:mutationResults.filter(m=>m.result!=='DETECTED').map(m=>m.id),nonGating:nonGatingResults.map(n=>[n.test,n.testedCommitExitCode,n.s84BaseExitCode]),cleanCheckout:clean,evidenceSha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')},null,2));
if(!pass)process.exitCode=1;
