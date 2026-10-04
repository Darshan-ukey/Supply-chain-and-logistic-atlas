// S8-5B exact-commit QA runner. Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>
// Fresh full clone at the exact tested commit; runs the ATL-167 successor suite (same-context LTL-04 public-safe Deepen/Inspect),
// inherited S8 suites, certified donor suites, and the S8-4 / S8-3F / S8-5A predecessor suites. Predecessor exact-identity failures that are
// a CONSEQUENCE of the new S8-5B successor interaction identity are classified (never weakened) only when (a) the exact set of failing cases is
// the expected stage-local set, (b) every other case passes, and (c) the predecessor's own exact tested commit still passes in this run.
// PASS = ATL-167 bounded v1.5 successor interaction capability only. NOT runtime/release readiness, ATL-157 materialization of LTL-04, S8-5 completion or S8-6 authority.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const repo=path.resolve(process.argv[2]||'.'),checkout=path.resolve(process.argv[3]),output=path.resolve(process.argv[4]);
if(!process.argv[3]||!process.argv[4])throw Error('Usage: node run-exact-qa.cjs <repo> <fresh-checkout> <evidence-output>');
if(fs.existsSync(checkout))throw Error('Fresh checkout directory required');
const git=(args,cwd=repo)=>cp.execFileSync('git',['-c','safe.directory='+cwd,'-c','safe.directory='+cwd+'/.git',...args],{cwd,encoding:'utf8',maxBuffer:200000000}).trim();
const head=git(['rev-parse','HEAD']);
cp.execFileSync('git',['-c','safe.directory='+repo,'-c','safe.directory='+repo+'/.git','clone','--no-hardlinks','--no-checkout',repo,checkout],{stdio:'pipe'});
git(['checkout','--detach',head],checkout);
const BASE='f8dc6c3863bc7310d8d83addf2d6ff1b6d34e12f',BASE_TREE='b2fa339ac2ce1c6410a623978c2cfcf4dc3ce0aa';
const S84_TESTED='07a41138f7b52e5fe1d0c9d5989f72b9835560c5',S83F_TESTED='67c80d513aa9de798e33814b963ee0e62ed7abad',S85A_TESTED='cf6c89dc51187329e4455f20fa12e2d742735621';
const S85A_EVIDENCE_SHA='5d9bf6f43732a1a54b0dd5f0e69bff79c35b447bb9fbb76117135a2939ff3cbb',S85A_EVIDENCE_BLOB='3ff74da496914500d28405bae7df66d99ea684d4';
const inherited=['tests/p6-2-canonical-workdefinition-compiler.mjs','tests/s8-2e-leaf-compiler-correction.mjs','tests/s8-2e-atl159-workdefinition-lineage.test.cjs','tests/s8-2a-atl171-operational-semantics.test.cjs','tests/s8-2b-atl171-schema-compatibility.test.cjs','tests/s8-2c-atl165-client-binding.test.cjs','tests/s8-2d-atl165-binding-schema.test.cjs','tests/s8-3b-atl159-ltl04-workdefinition.test.mjs','tests/s8-3c-malkom-package-readiness.test.mjs','tests/s8-3d-malkom-projection-boundary.test.mjs','tests/s8-3e-atl178-flow-bpmn.test.mjs'];
const certified=['tests/p2-projection-boundary.mjs','tests/p3-universal-daughter-renderer.mjs','tests/p4-canvas-daughter-integration.mjs','tests/p5-ask-trace-governance.mjs','tests/v2-api-router-smoke.mjs','tests/v2-public-ip-boundary.mjs'];
const s85b='tests/s8-5b-atl167-ltl04-deepen.test.mjs',s85a='tests/s8-5a-successor-retests.test.mjs',s84='tests/s8-4-interaction-rebinding.test.mjs',s83f='tests/s8-3f-governed-release-manifest.test.mjs';
const nonGating=['tests/v2-ui-browser-smoke.mjs','tests/v1.1.4-static-parity.mjs'];
const run=(args,cwd)=>{const r=cp.spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:200000000,timeout:600000});return {command:['node',...args],exitCode:r.status,signal:r.signal,stdout:r.stdout||'',stderr:r.stderr||''};};
const summaryOf=(r)=>{try{return JSON.parse(r.stdout.trim().split('\n').pop())}catch{return null}};
const failCases=(r)=>[...new Set((r.stdout.match(/^FAIL .+$/mg)||[]).map(x=>x.slice(5,140)))].sort();
const caseId=(c)=>c.split(' ')[0];
const wtPath=(tag)=>path.join(path.dirname(checkout),path.basename(checkout)+'-'+tag);
const results=[{group:'S8-5B-ATL167',...run([s85b],checkout)},...inherited.map(t=>({group:'S8-inherited',...run([t],checkout)})),...certified.map(t=>({group:'certified-donor-suite',...run([t],checkout)})),{group:'S8-4',...run([s84],checkout)},{group:'S8-3F',...run([s83f],checkout)},{group:'S8-5A',...run([s85a],checkout)},{group:'S8-3F-cli-check-reproduce',...run(['scripts/s8-3f-release-manifest.mjs','--check','--reproduce'],checkout)}];
const clean=git(['status','--porcelain'],checkout)==='';
const main=results[0],mainSummary=summaryOf(main),mainCases=(main.stdout.match(/^(PASS|FAIL) .+$/mg)||[]);

// ---- every non-zero suite compared with the exact S8-5A base worktree
const baseWt=wtPath('base');git(['worktree','add','--detach',baseWt,BASE],checkout);
const baseComparisons=[];
for(const r of results){
 if(r.group==='S8-5B-ATL167'||r.exitCode===0)continue;
 const b=run(r.command.slice(1),baseWt);const tested=failCases(r),base=failCases(b);
 baseComparisons.push({suite:r.command[1],group:r.group,testedExit:r.exitCode,baseExit:b.exitCode,failingCasesOnTested:tested,failingCasesOnBase:base,newFailuresVsBase:tested.filter(c=>!base.includes(c)),identicalToBase:b.exitCode===r.exitCode&&tested.every(c=>base.includes(c))});
}
const nonGatingResults=nonGating.map(t=>{const a=run([t],checkout),b=run([t],baseWt);const tail=(x)=>(x.stdout+x.stderr).trim().split('\n').slice(-3).join(' | ').slice(0,300);return {test:t,testedCommitExitCode:a.exitCode,baseExitCode:b.exitCode,failureAlreadyOnBase:a.exitCode!==0&&b.exitCode!==0,identicalOutcome:a.exitCode===b.exitCode,testedCommitTail:tail(a),baseTail:tail(b)}});
// S8-3F CLI at the S8-5A base must be clean (baseline for the expected successor-only drift)
const cliBase=run(['scripts/s8-3f-release-manifest.mjs','--check','--reproduce'],baseWt);
git(['worktree','remove','--force',baseWt],checkout);

// ---- predecessor exact re-pass at their own tested commits
const predecessorAt=(commit,test,tag)=>{const wt=wtPath(tag);git(['worktree','add','--detach',wt,commit],checkout);const r=run([test],wt);git(['worktree','remove','--force',wt],checkout);return {commit,test,exitCode:r.exitCode,summary:summaryOf(r)};};
const repass={s84:predecessorAt(S84_TESTED,s84,'s84tested'),s83f:predecessorAt(S83F_TESTED,s83f,'s83ftested'),s85aTested:predecessorAt(S85A_TESTED,s85a,'s85atested'),s85aHead:predecessorAt(BASE,s85a,'s85ahead')};
const repassOk=repass.s84.exitCode===0&&repass.s84.summary&&repass.s84.summary.failed===0&&repass.s84.summary.total===34&&repass.s83f.exitCode===0&&repass.s83f.summary&&repass.s83f.summary.failed===0&&repass.s83f.summary.total===63&&[repass.s85aTested,repass.s85aHead].every(x=>x.exitCode===0&&x.summary&&x.summary.failed===0&&x.summary.total===47);

// ---- expected successor-only identity evolution (never weakens a predecessor test)
const byGroup=(g)=>results.find(r=>r.group===g);
const s84Failed=failCases(byGroup('S8-4')),s83fFailed=failCases(byGroup('S8-3F')),s85aFailed=failCases(byGroup('S8-5A'));
const s84Detail=(byGroup('S8-4').stdout.match(/^FAIL D01.*$/m)||[''])[0];
const S83F_EXPECTED=['deterministic regeneration equals the committed manifest','verifier accepts the committed manifest','protected derivatives reproduce from the governed lineage','S8-3F scope: changed paths','recovery evidence: every recovery artifact is identity-pinned'];
const s83fExpectedOnly=s83fFailed.length>0&&s83fFailed.every(c=>S83F_EXPECTED.some(e=>c.startsWith(e)));
let cliJson=null;try{cliJson=JSON.parse(byGroup('S8-3F-cli-check-reproduce').stdout)}catch{}
const cliFailures=cliJson?cliJson.failures.map(f=>f.code+' '+f.detail).sort():null;
const EXPECTED_CLI=['IDENTITY_MISMATCH interaction.atl-140-journey: recorded observed identity differs from the repository','IDENTITY_MISMATCH interaction.atl-140-journey: repository identity is MISMATCH','MANIFEST_DRIFT manifest differs from deterministic regeneration','ROLLBACK_RECOVERY_IDENTITY_DRIFT assets/atl-140-v15-journey.mjs'].sort();
const cliExpectedOnly=!!cliJson&&cliJson.reproduced===true&&JSON.stringify(cliFailures)===JSON.stringify(EXPECTED_CLI);
let cliBaseJson=null;try{cliBaseJson=JSON.parse(cliBase.stdout)}catch{}
// S8-5A V01/S03 differ only because ATL-167 now has a successor test (tracked167Tests 0 -> 1) — verified by regenerating its evidence generator output.
const drift=cp.spawnSync(process.execPath,['--input-type=module','-e',`import fs from 'node:fs';import {generateEvidence} from './tests/s8-5a-support/evidence.mjs';const g=await generateEvidence(process.cwd());const diffs=[];const walk=(x,y,p)=>{if(typeof x!=='object'||x===null||typeof y!=='object'||y===null){if(JSON.stringify(x)!==JSON.stringify(y))diffs.push([p,x,y]);return}for(const k of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[k],y[k],p+'.'+k)};let n=0;for(const [p,c] of Object.entries(g.files)){const a=JSON.parse(fs.readFileSync(p,'utf8'));walk(a,JSON.parse(c),p);n++}console.log(JSON.stringify({files:n,diffs}))`],{cwd:checkout,encoding:'utf8'});
let s85aDrift=null;try{s85aDrift=JSON.parse(drift.stdout.trim().split('\n').pop())}catch{}
const s85aDriftOnlyTracked167=!!s85aDrift&&s85aDrift.diffs.length===1&&s85aDrift.diffs[0][0].endsWith('.mechanicallyVerifiedEvidence.tracked167Tests')&&s85aDrift.diffs[0][1]===0&&s85aDrift.diffs[0][2]===1;
const s84ExpectedOnly=s84Failed.length>0&&s84Failed.every(c=>['D01','S01','S02','S03'].includes(caseId(c)))&&/api\/atlas\.js/.test(s84Detail);
const s85aExpectedOnly=s85aFailed.length>0&&s85aFailed.every(c=>['V01','S01','S03'].includes(caseId(c)))&&s85aDriftOnlyTracked167;
const evolution={
 s8_4:{failingCases:s84Failed,expectedStageLocalSet:['D01 (api/atlas.js donor pin: exactly one registered route)','S01','S02','S03'],onlyExpected:s84ExpectedOnly,d01Detail:s84Detail.slice(0,200)},
 s8_3f:{failingCases:s83fFailed,expectedStageLocalSet:S83F_EXPECTED,onlyExpected:s83fExpectedOnly,cliCheckFailures:cliFailures,cliOnlyExpectedJourneyIdentityDrift:cliExpectedOnly,protectedDerivativesReproduced:cliJson?cliJson.reproduced:null,cliCleanAtS85aBase:!!cliBaseJson&&cliBaseJson.ok===true},
 s8_5a:{failingCases:s85aFailed,expectedStageLocalSet:['V01','S01','S03'],onlyExpected:s85aExpectedOnly,evidenceDriftOnlyTracked167Tests:s85aDriftOnlyTracked167,driftDiffs:s85aDrift?s85aDrift.diffs:null},
 predecessorExactRepass:repass,predecessorExactRepassOk:repassOk,
 s8_5aEvidencePreservation:{changedPathsUnderS85aEvidence:git(['diff','--name-only',BASE,head,'--','governance/product/s8-5a-evidence'],checkout),exactQaSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(checkout,'governance/product/s8-5a-evidence/exact-qa.json'))).digest('hex'),exactQaBlob:git(['hash-object','governance/product/s8-5a-evidence/exact-qa.json'],checkout)},
 explanation:'S8-5B legitimately changes two previously pinned files (api/atlas.js: one registered route; assets/atl-140-v15-journey.mjs: additive Deepen/Inspect control). Predecessor exact-identity/scope cases fail on the successor by design; each predecessor remains PASS at its own exact tested commit (re-run above). No predecessor test or evidence file was edited.'
};
evolution.s8_5aEvidencePreservation.preserved=evolution.s8_5aEvidencePreservation.changedPathsUnderS85aEvidence===''&&evolution.s8_5aEvidencePreservation.exactQaSha256===S85A_EVIDENCE_SHA&&evolution.s8_5aEvidencePreservation.exactQaBlob===S85A_EVIDENCE_BLOB;
byGroup('S8-4').classification=s84ExpectedOnly&&repassOk?'SUCCESSOR_ONLY_STAGE_LOCAL_IDENTITY_EVOLUTION':'FAIL';
byGroup('S8-3F').classification=s83fExpectedOnly&&cliExpectedOnly&&repassOk?'SUCCESSOR_ONLY_STAGE_LOCAL_IDENTITY_EVOLUTION':'FAIL';
byGroup('S8-5A').classification=s85aExpectedOnly&&repassOk?'SUCCESSOR_ONLY_STAGE_LOCAL_EVOLUTION':'FAIL';
byGroup('S8-3F-cli-check-reproduce').classification=cliExpectedOnly&&repassOk?'SUCCESSOR_ONLY_STAGE_LOCAL_IDENTITY_EVOLUTION':'FAIL';

// ---- deliberate mutation phase: each mutation is COMMITTED in a scratch worktree and the S8-5B suite MUST fail.
const w=(cwd,p,c)=>{fs.mkdirSync(path.dirname(path.join(cwd,p)),{recursive:true});fs.writeFileSync(path.join(cwd,p),c)};
const rd=(cwd,p)=>fs.readFileSync(path.join(cwd,p),'utf8');
const sub=(p,a,b)=>(c)=>{const t=rd(c,p);if(!t.includes(a))throw Error('mutation anchor missing: '+a);w(c,p,t.replace(a,b))};
const js=(p,fn)=>(c)=>{const o=JSON.parse(rd(c,p));fn(o);w(c,p,JSON.stringify(o,null,2)+'\n')};
const blob=(c,b)=>cp.execFileSync('git',['-c','safe.directory='+c,'cat-file','blob',b],{cwd:c,maxBuffer:200000000});
const LIB='lib/projections/governed-depth-summary.js',CLI='assets/atl-167-v15-deepen-inspect.mjs',JRN='assets/atl-140-v15-journey.mjs',APIH='lib/api/governed-depth-summary.js';
const STALE_WD=['wd','::road-ltl::LTL-04::v','1'].join(''),STALE_PKG=['malkom-dw','::road-ltl::LTL-04::v','1'].join('');
const mutations=[
 ['M01','LTL-03 fallback introduced (server accepts LTL-03)',sub(LIB,"if (String(taskId) !== GOVERNED_DEPTH_SCOPE.taskId) throw","if (String(taskId) !== GOVERNED_DEPTH_SCOPE.taskId && String(taskId) !== 'LTL-03') throw")],
 ['M02','client Deepen scope switched to LTL-03',sub(CLI,"taskId: 'LTL-04'});","taskId: 'LTL-03'});")],
 ['M03','LTL-04 added to ATL-157 materialization (module taskOverrides)',js('data/modules/road-ltl-v1.5.json',(o)=>{o.taskOverrides.push({id:'LTL-04',label:'x'})})],
 ['M04','ATL-157 firstProofTaskId changed to LTL-04',js('governance/presentation/p2-projection-source-registry.json',(o)=>{o.sources.find(s=>s.sourceKey==='road-ltl@1.5').firstProofTaskId='LTL-04'})],
 ['M05','stale WorkDefinition id introduced in the Deepen module',sub(CLI,"export const DEEPEN_WORKDEFINITION_ID = 'road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD';","export const DEEPEN_WORKDEFINITION_ID = 'road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD'; // "+STALE_WD)],
 ['M06','stale Malkom package id introduced in the projection',sub(LIB,"export const GOVERNED_DEPTH_SCHEMA","// "+STALE_PKG+"\nexport const GOVERNED_DEPTH_SCHEMA")],
 ['M07','protected flow bytes exposed in the public summary',sub(LIB,"trace: {flow: m.flow,","trace: {bpmnXml: '<bpmn/>', flow: m.flow,")],
 ['M08','readiness promoted in the public summary',sub(LIB,"readiness: {disposition: 'BLOCKED',","readiness: {disposition: 'READY',")],
 ['M09','blocked leaves hidden (notCompiledLeafCount zeroed)',sub(LIB,"notCompiledLeafCount: t.notCompiledLeafCount, blockedByClientBindingLeafCount","notCompiledLeafCount: 0, blockedByClientBindingLeafCount")],
 ['M10','unresolved client binding shown resolved',sub(LIB,"clientBinding: 'CLIENT_BINDING_REQUIRED', unresolvedBindingCount: c.unresolvedBindingCount,","clientBinding: 'RESOLVED', unresolvedBindingCount: 0,")],
 ['M11','certified Ask replaced by the superseded old Ask implementation',(c)=>w(c,'lib/api/ask-atlas.js',blob(c,'cb2bcfea0892adf5a871fb4584461b50729ab383').toString('utf8'))],
 ['M12','stale ATL-167 interaction-slice page restored',(c)=>w(c,'atl-167-interaction-slice.html','<!doctype html><title>slice</title>\n')],
 ['M13','stale ATL-178 flow-explorer page restored',(c)=>w(c,'atl-178-flow-explorer.html','<!doctype html><title>explorer</title>\n')],
 ['M14','wrong module version accepted (Road 1.4 fallback)',sub(LIB,"if (String(moduleVersion) !== GOVERNED_DEPTH_SCOPE.moduleVersion) throw","if (false) throw")],
 ['M15','wrong module accepted',sub(LIB,"if (String(moduleId) !== GOVERNED_DEPTH_SCOPE.moduleId) throw","if (false) throw")],
 ['M16','certified root index.html modified',(c)=>w(c,'index.html',rd(c,'index.html')+'\n<!-- tamper -->\n')],
 ['M17','S8-3C protected package identity changed in the public evidence',(c)=>{const p='governance/product/s8-3c-evidence/package-readiness-summary.json';w(c,p,rd(c,p).replace('6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367','0'.repeat(64)))}],
 ['M18','S8-3D projection identity changed in the public evidence',(c)=>{const p='governance/product/s8-3d-evidence/projection-summary.json';w(c,p,rd(c,p).replace('703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c','1'.repeat(64)))}],
 ['M19','runtime shell modified',(c)=>w(c,'execution/ui/runtime-access-shell.js',rd(c,'execution/ui/runtime-access-shell.js')+"import('/assets/probe.mjs');\n")],
 ['M20','Deepen action pointed at an ungoverned endpoint',sub(CLI,"export const DEEPEN_ENDPOINT = '/api/atlas';","export const DEEPEN_ENDPOINT = '/api/ungoverned';")],
 ['M21','Deepen action pointed at the ATL-157 execution-depth action',sub(CLI,"export const DEEPEN_ACTION = 'governed-depth-summary';","export const DEEPEN_ACTION = 'execution-depth-projection';")],
 ['M22','protected-content parameter guard weakened',sub(LIB,"'include', 'detail',","'detail',")],
 ['M23','client promotion validation weakened (readiness BLOCKED check removed)',sub(CLI,"eq(s.readiness.disposition, 'BLOCKED', 'DEEPEN_PROMOTION_CLAIM:readiness');","")],
 ['M24','context identity lost between steps (trace link context dropped)',sub(CLI,'data-journey-link="trace-context" data-context="${esc(contextKey())}"','data-journey-link="trace-context" data-context="road-ltl@1.5 / LTL-03"')],
 ['M25','bounded action unregistered from the router',(c)=>w(c,'api/atlas.js',rd(c,'api/atlas.js').replace("  'governed-depth-summary':'./governed-depth-summary.js',\n",''))],
 ['M26','ATL-157 execution-depth endpoint semantics altered (LTL-04 special-cased)',sub('lib/api/execution-depth-projection.js',"const projection=buildPublicExecutionDepthProjection({moduleId,moduleVersion,taskId});","if(taskId==='LTL-04')return send(res,200,{ok:true,projection:{}});const projection=buildPublicExecutionDepthProjection({moduleId,moduleVersion,taskId});")],
 ['M27','successor identity evidence tampered',js('governance/product/s8-5b-evidence/successor-identity.json',(o)=>{o.modifiedProductFiles[0].successorBlob='0'.repeat(40)})],
 ['M28','public summary evidence tampered',js('governance/product/s8-5b-evidence/governed-depth-summary-ltl04.json',(o)=>{o.summary.readiness.disposition='READY'})],
 ['M29','S8-4 journey link removed (Trace generated flow)',sub(JRN,'<a href="${FLOW_ANCHOR_PATH}" data-journey-link="trace-flow">Trace generated flow</a> · ','')],
 ['M30','read-only violated (write call in the projection)',sub(LIB,"export function readGovernedSummaries","fs.writeFileSync('/tmp/x','x');\nexport function readGovernedSummaries")],
 ['M31','prior S8-4 test weakened',(c)=>w(c,s84,rd(c,s84)+'\n// weakened\n')],
 ['M32','vercel.json modified',(c)=>w(c,'vercel.json',rd(c,'vercel.json').replace('"cleanUrls": true','"cleanUrls": false'))],
 ['M33','S8-3F release manifest hand-edited/regenerated',(c)=>{const p='release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json';w(c,p,rd(c,p).replace(/\n$/,'')+'\n\n')}],
 ['M34','new top-level API function added (consolidation broken)',(c)=>w(c,'api/extra.js','export default async function h(){}\n')],
 ['M35','protected WorkDefinition body field added to the response',sub(LIB,"bodyIncluded: false}","bodyIncluded: true}")],
 ['M36','Ask re-implemented inside the Deepen module',sub(CLI,"export const contextKey","export async function askAtlas(question){return {answer:question}}\nexport const contextKey")],
 ['M37','S8-5A evidence file altered (historical evidence rewritten)',(c)=>{const p='governance/product/s8-5a-evidence/exact-qa.json';w(c,p,rd(c,p).replace('"PASS"','"FAIL"'))}],
 ['M38','identity continuity: summary scope version altered',sub(LIB,"scope: {...GOVERNED_DEPTH_SCOPE, workDefinitionId:","scope: {...GOVERNED_DEPTH_SCOPE, moduleVersion: '1.4', workDefinitionId:")]
];
const mutationResults=[];
for(const [id,desc,fn] of mutations){
 const wt=wtPath(id);git(['worktree','add','--detach',wt,head],checkout);
 let r;try{fn(wt);git(['add','-A'],wt);cp.execFileSync('git',['-c','safe.directory='+wt,'-c','user.name=qa','-c','user.email=qa@example.invalid','commit','-q','--allow-empty','-m','mutation '+id],{cwd:wt});r=run([s85b],wt)}catch(e){r={exitCode:null,stdout:'',stderr:String(e.message).slice(0,400)}}
 const f=failCases(r);
 mutationResults.push({id,mutation:desc,s85bSuiteExitCode:r.exitCode,detectedByFailingCases:f.length,firstDetections:f.slice(0,3).map(x=>x.slice(0,60)),detection:f.length>0?'CASE_FAILURE':'SUITE_ABORT_FAIL_CLOSED',result:(r.exitCode!==0&&r.exitCode!==null)?'DETECTED':'NOT_DETECTED',...(r.exitCode===null?{infrastructureError:r.stderr}:{}),...(f.length===0&&r.exitCode!==0&&r.exitCode!==null?{abortTail:(r.stderr||'').trim().split('\n').slice(-2).join(' | ').slice(0,300)}:{})});
 git(['worktree','remove','--force',wt],checkout);
}

// ---- changed paths relative to the exact S8-5A head
const changedPaths=git(['diff','--name-status','--no-renames',BASE,head],checkout).split('\n').filter(Boolean);
const MODIFIED_OK=['api/atlas.js','assets/atl-140-v15-journey.mjs'];
const addOk=(p)=>['assets/atl-167-v15-deepen-inspect.mjs','lib/api/governed-depth-summary.js','lib/projections/governed-depth-summary.js','tests/s8-5b-atl167-ltl04-deepen.test.mjs','governance/product/S8_5B_ATL167_LTL04_DEEPEN.md'].includes(p)||p.startsWith('tests/s8-5b-support/')||p.startsWith('governance/product/s8-5b-evidence/');
const classify=(st,p)=>st==='M'&&MODIFIED_OK.includes(p)?(p==='api/atlas.js'?'ROUTER_REGISTRATION_ONE_LINE':'MINIMAL_ADDITIVE_INTERACTION_INTEGRATION'):st==='A'&&addOk(p)?(p.startsWith('tests/')?'ATL167_SUCCESSOR_TEST':p.startsWith('governance/')?'EVIDENCE_GOVERNANCE':p.startsWith('lib/')?'BOUNDED_PUBLIC_SAFE_API_PROJECTION':'ATL167_INTERACTION_MODULE'):'UNCLASSIFIED';
const changedClassified=changedPaths.map(l=>{const [st,p]=l.split('\t');return {status:st,path:p,category:classify(st,p)}});
const scopeOk=changedClassified.every(c=>c.category!=='UNCLASSIFIED');
const certifiedUnchanged=['index.html','execution/ui/runtime-access-shell.js','assets/canvas-daughter-bridge-v2.0.1.mjs','assets/universal-daughter-renderer-v2.js','daughter.html','lib/api/ask-atlas.js','runtime/universal-ask-atlas.js','atl-140-malkom-consumer.html','assets/atl-140-consumer-view.mjs','vercel.json','data/modules/road-ltl-v1.5.json','governance/presentation/p2-projection-source-registry.json'].every(p=>git(['rev-parse',BASE+':'+p],checkout)===git(['rev-parse',head+':'+p],checkout));

const mainPass=main.exitCode===0&&mainSummary&&mainSummary.failed===0;
const gatingFailures=results.filter(r=>r.exitCode!==0&&!/^SUCCESSOR_ONLY/.test(r.classification||'')).map(r=>r.command[1]);
const newFailuresVsBase=baseComparisons.filter(c=>!c.identicalToBase&&!['S8-4','S8-3F','S8-5A','S8-3F-cli-check-reproduce'].includes(c.group)).map(c=>c.suite);
const pass=mainPass&&gatingFailures.length===0&&newFailuresVsBase.length===0&&repassOk&&evolution.s8_5aEvidencePreservation.preserved&&clean&&scopeOk&&certifiedUnchanged&&mutationResults.every(m=>m.result==='DETECTED')&&nonGatingResults.every(n=>n.identicalOutcome);
const classification=pass?'S8-5B PASS — ATL-167 bounded v1.5 same-context (road-ltl@1.5 / LTL-04) public-safe Deepen/Inspect interaction restored over existing governed depth; not runtime/release readiness':'S8-5B FAIL — SEE QA EVIDENCE';
const evidence={schemaVersion:'s8-5b-exact-qa-v1',testedCommit:head,testedTree:git(['rev-parse',head+'^{tree}']),base:BASE,baseTree:BASE_TREE,nodeVersion:process.version,platform:process.platform,architecture:process.arch,
 testScope:'S8-5B ATL-167 bounded successor remediation: new read-only governed-depth-summary action (exact road-ltl@1.5 / LTL-04, existing S8 public evidence only), additive Deepen/Inspect control in the S8-4 journey, same-context continuity, fail-closed negatives, protected boundary, ATL-157 non-expansion, Ask/Trace/Malkom reachability; inherited S8 + certified suites; predecessor exact re-pass; deliberate mutation tests. PASS != runtime/release readiness, LTL-04 ATL-157 materialization, S8-5 completion or S8-6 authority.',
 status:pass?'PASS':'FAIL',overallClassification:classification,
 suites:{total:results.length,passed:results.filter(r=>r.exitCode===0).length,successorOnlyStageLocalEvolution:results.filter(r=>/^SUCCESSOR_ONLY/.test(r.classification||'')).length,gatingFailures,newFailuresVsS85aBase:newFailuresVsBase},
 atl167SuccessorSuite:{...mainSummary,cases:mainCases},predecessorIdentityEvolution:evolution,baseComparisons,results:results.map(({stdout,stderr,...r})=>({...r,summary:summaryOf({stdout}),failingCases:failCases({stdout}),stderrTail:(stderr||'').trim().split('\n').slice(-2).join(' | ').slice(0,300)})),mutationTests:{total:mutationResults.length,detected:mutationResults.filter(m=>m.result==='DETECTED').length,results:mutationResults},nonGatingInheritedChecks:nonGatingResults,changedPathsVsS85aHead:changedClassified,changedPathScopeOk:scopeOk,certifiedIdentitiesUnchanged:certifiedUnchanged,cleanCheckout:clean};
fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,classification,testedCommit:head,testedTree:evidence.testedTree,suiteTotals:{total:evidence.suites.total,passed:evidence.suites.passed,evolution:evidence.suites.successorOnlyStageLocalEvolution},s85b:mainSummary&&{total:mainSummary.total,passed:mainSummary.passed,failed:mainSummary.failed},gatingFailures,newFailuresVsBase,evolutionOnlyExpected:{s84:s84ExpectedOnly,s83f:s83fExpectedOnly,cli:cliExpectedOnly,s85a:s85aExpectedOnly},predecessorRepassOk:repassOk,s85aEvidencePreserved:evolution.s8_5aEvidencePreservation.preserved,mutations:evidence.mutationTests.detected+'/'+evidence.mutationTests.total,notDetected:mutationResults.filter(m=>m.result!=='DETECTED').map(m=>m.id),nonGating:nonGatingResults.map(n=>[n.test,n.testedCommitExitCode,n.baseExitCode]),scopeOk,certifiedUnchanged,cleanCheckout:clean,evidenceSha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')},null,2));
if(!pass)process.exitCode=1;
