// S8-6 DAU-007 / DAU-006 exact-commit QA runner. Usage: node run-dau-qa.cjs <repo> <fresh-checkout> <evidence-output>
// Fresh full clone at the exact tested commit; runs the DAU suite twice (determinism), the 21-mutation suite, and the identity/scope proofs.
// PASS = the bounded governed-history capability only. NOT runtime/release readiness, UAT, ATL-181 PASS, sign-off or promotion.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const repo=path.resolve(process.argv[2]||'.'),checkout=path.resolve(process.argv[3]),output=path.resolve(process.argv[4]);
if(!process.argv[3]||!process.argv[4])throw Error('Usage: node run-dau-qa.cjs <repo> <fresh-checkout> <evidence-output>');
if(fs.existsSync(checkout))throw Error('Fresh checkout directory required');
const git=(args,cwd=repo)=>cp.execFileSync('git',['-c','safe.directory='+cwd,'-c','safe.directory='+cwd+'/.git',...args],{cwd,encoding:'utf8',maxBuffer:300000000}).trim();
const head=git(['rev-parse','HEAD']);
cp.execFileSync('git',['-c','safe.directory='+repo,'-c','safe.directory='+repo+'/.git','clone','--no-hardlinks','--no-checkout',repo,checkout],{stdio:'pipe'});
git(['checkout','--detach',head],checkout);
const BASE='97e3086daa7b1ca694d019f0f30bb2c3150e7a6d',BASE_TREE='33c820c5d5c347ca918f128492f9b6928ea07f64';
const sh=(b)=>crypto.createHash('sha256').update(b).digest('hex');
const run=(args,cwd,env={})=>{const r=cp.spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:300000000,timeout:1500000,env:{...process.env,...env}});return {command:['node',...args],exitCode:r.status,stdout:r.stdout||'',stderr:r.stderr||''};};
const summaryOf=(r)=>{try{return JSON.parse(r.stdout.trim().split('\n').pop())}catch{return null}};
const clean=git(['status','--porcelain'],checkout)==='';
const dau=[run(['tests/s8-6-dau-history-sync.test.mjs'],checkout,{S8_6_CONCURRENCY:'3'}),run(['tests/s8-6-dau-history-sync.test.mjs'],checkout,{S8_6_CONCURRENCY:'3'})];
const daus=dau.map(summaryOf);
const mut=run(['tests/s8-6-dau-mutations.test.mjs'],checkout,{S8_6_MUT_CONCURRENCY:'3'});const muts=summaryOf(mut);
const identityPaths=['index.html','execution/ui/runtime-access-shell.js','assets/canvas-daughter-bridge-v2.0.1.mjs','canvas-v2/canvas-v2/index.html','canvas-v2/canvas-v2/assets/canvas-v2.css','canvas-v2/canvas-v2/assets/canvas-v2.js','canvas-v2/canvas-v2/FREEZE_CERTIFICATE.md','runtime/universal-ask-atlas.js','lib/api/ask-atlas.js','governance/ask-atlas-surface-contract-v1.json','lib/ask/p5-governed-retrieval.js','ATLAS_V2.0.1_UNIVERSAL_ASK_CERTIFICATION.md','assets/atl-140-consumer-view.mjs','atl-140-malkom-consumer.html','daughter.html','assets/universal-daughter-renderer-v2.js','api/atlas.js','vercel.json','assets/atl-167-v15-deepen-inspect.mjs','lib/api/governed-depth-summary.js','lib/projections/governed-depth-summary.js'];
const protectedDirs=['governance/product/s8-3b-evidence','governance/product/s8-3c-evidence','governance/product/s8-3d-evidence','governance/product/s8-3e-evidence','lib/compile'];
const blobAt=(c,p,cwd)=>{try{return git(['rev-parse',c+':'+p],cwd)}catch{return null}};
const identity=identityPaths.map(p=>({path:p,baseBlob:blobAt(BASE,p,checkout),testedBlob:blobAt('HEAD',p,checkout),unchanged:blobAt(BASE,p,checkout)===blobAt('HEAD',p,checkout)}));
const protectedChanged=git(['diff','--name-only',BASE,'HEAD','--',...protectedDirs],checkout);
const changed=git(['diff','--name-status','--no-renames',BASE,'HEAD'],checkout).split('\n').filter(Boolean).map(l=>{const [st,p]=l.split('\t');return {status:st,path:p}});
const cls=(c)=>c.status==='M'&&c.path==='assets/atl-140-v15-journey.mjs'?'JOURNEY_LOADS_HISTORY_MODULE_THREE_ADDED_LINES':c.status==='A'&&c.path==='assets/atl-s8-history-sync.mjs'?'HISTORY_SYNC_MODULE':c.status==='A'&&/^tests\/s8-6-(dau-|support\/)/.test(c.path)?'DAU_TEST_OR_SUPPORT':c.status==='A'&&/^governance\/product\/(S8_6_DAU_HISTORY_SYNC\.md|s8-6-evidence\/)/.test(c.path)?'DAU_GOVERNANCE_EVIDENCE':'UNCLASSIFIED';
const changedClassified=changed.map(c=>({...c,category:cls(c)}));
const jd=git(['diff','--numstat',BASE,'HEAD','--','assets/atl-140-v15-journey.mjs'],checkout);
const journeyOnlyAdds=/^3\t0\t/.test(jd);
const dauOk=dau.every((r,i)=>r.exitCode===0&&daus[i]&&daus[i].failed===0&&daus[i].total>=100);
const sameCases=JSON.stringify(daus[0]&&daus[0].caseIds)===JSON.stringify(daus[1]&&daus[1].caseIds);
const mutOk=mut.exitCode===0&&muts&&muts.failed===0&&muts.detected===muts.mutations&&muts.mutations>=21&&muts.survived.length===0;
const idOk=identity.every(i=>i.unchanged)&&protectedChanged==='';
const scopeOk=changedClassified.every(c=>c.category!=='UNCLASSIFIED')&&journeyOnlyAdds;
const pass=clean&&dauOk&&sameCases&&mutOk&&idOk&&scopeOk;
const fileHash=(p)=>sh(fs.readFileSync(path.join(checkout,p)));
const evidence={schemaVersion:'s8-6-dau-exact-qa-v1',stage:'S8-6 bounded DAU-007 history-sync remediation (also closes the reopened DAU-006 deep-link/reload regression)',testedCommit:head,testedTree:git(['rev-parse',head+'^{tree}']),base:BASE,baseTree:BASE_TREE,nodeVersion:process.version,platform:process.platform,architecture:process.arch,nodeEngineStated:'24.x',
 status:pass?'PASS':'FAIL',classification:pass?'DAU-007 + DAU-006 bounded governed-history remediation PASS on the corrected successor lineage; not runtime/release readiness':'DAU REMEDIATION FAIL — SEE EVIDENCE',
 cleanFreshCheckout:clean,
 browser:daus[0]&&{engine:daus[0].browser,executable:daus[0].browserExecutable},
 dauSuite:{runs:dau.map((r,i)=>({exitCode:r.exitCode,total:daus[i]&&daus[i].total,passed:daus[i]&&daus[i].passed,failed:daus[i]&&daus[i].failed,rootLoadRaceTolerated:daus[i]&&daus[i].rootLoadRaceTolerated,failingCases:[...new Set((r.stdout.match(/^FAIL .+$/mg)||[]).map(x=>x.slice(5,120)))]})),identicalCaseSetAcrossRuns:sameCases,caseIds:daus[0]&&daus[0].caseIds,
  groups:{dau007:'B007-01..10 (14-step sequence, determinism, A4 independence, Back/Forward walk, module/A3 preservation, no duplicates, rapid traversal, A5)',dau006:'D6-R-* refresh, D6-L-* generated deep links, D6-D1 direct load, D6-R2/R3 Back/Forward with reload',negatives:'N-P-*/N-R-* (18 injected-state kinds via popstate and reload), N-L-* deep links, N-X1..X3',identity:'I01..I09',unit:'U01..U17',consumerNoop:'C01',rootLoadRace:'R01..R03'},
  rootLoadRaceNote:'Pre-existing intermittent root load-time race (Stage-8 closeFutureDrawer recursion repaired by a later script block). Tolerated only as that exact message before the history module sets any status; counted; mechanism proven with the module absent (R02). Root unchanged.'},
 mutationSuite:muts?{exitCode:mut.exitCode,total:muts.total,passed:muts.passed,mutations:muts.mutations,detected:muts.detected,survived:muts.survived,detail:muts.detail}:{exitCode:mut.exitCode,error:(mut.stdout+mut.stderr).slice(-800)},
 identity:{unchangedProof:identity,protectedS83BtoEAndCompileChangedPaths:protectedChanged===''?[]:protectedChanged.split('\n'),allUnchanged:idOk},
 successorIdentities:{historyModule:{path:'assets/atl-s8-history-sync.mjs',gitBlob:git(['rev-parse','HEAD:assets/atl-s8-history-sync.mjs'],checkout),sha256:fileHash('assets/atl-s8-history-sync.mjs')},journey:{path:'assets/atl-140-v15-journey.mjs',predecessorBlob:'6c11bf4c89eaf212004beab7a939fd4cda38477c',successorBlob:git(['rev-parse','HEAD:assets/atl-140-v15-journey.mjs'],checkout),sha256:fileHash('assets/atl-140-v15-journey.mjs'),addedLinesOnly:journeyOnlyAdds}},
 changedPaths:changedClassified,
 residuals:['Pre-existing root init-order defect (stage15RenderContract is not defined) remains in the unchanged root; compensated after root settle by the history module (hash/last-session restore re-applied).','Share-link serialization has no A4-vs-A5 field: an A5 deep link opens at A4 with its process; history entries carry the exact level.','Working-surface/context overlays (playback/trace/transform/compare/lens) are not recorded and reset on history traversal.','Module-level (module sha) staleness is delegated to the root own version gate.','Pre-existing root load-time stack-overflow race (see rootLoadRaceNote).']};
fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,testedCommit:head,testedTree:evidence.testedTree,dau:evidence.dauSuite.runs.map(r=>r.passed+'/'+r.total),mutations:muts&&muts.detected+'/'+muts.mutations,identityUnchanged:idOk,scopeOk,clean}));
if(!pass)process.exitCode=1;
