import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

/**
 * v1.1.8 strict LIVE browser + governed-composition certification.
 *
 * This is intentionally fail-closed: release certification MUST launch a real
 * Chromium instance. Unlike the v1.1.5 guard, browser absence is a release
 * failure, never SKIP=PASS. No Playwright package is required; Chromium is
 * driven through the Chrome DevTools Protocol. Because this execution
 * environment blocks localhost/file navigation by administrator policy, the
 * self-contained preview is loaded into the real browser frame with CDP
 * Page.setDocumentContent (the same class of live-DOM check as Playwright
 * setContent), not replayed from stored JSON.
 */

const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.md':'text/markdown'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failures=0;
const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++};

function browserPath(){
  const c=[process.env.CHROMIUM_PATH,process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable'].filter(Boolean);
  return c.find(p=>fs.existsSync(p))||null;
}
function listenWs(ws){
  let id=0; const pending=new Map(); const events=[];
  ws.addEventListener('message',ev=>{let m;try{m=JSON.parse(ev.data)}catch{return}if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(new Error(m.error.message||'CDP error')):resolve(m.result||{})}else events.push(m)});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(pending.has(n)){pending.delete(n);reject(new Error(`CDP timeout: ${method}`))}},10000)});
  return {send,events};
}
async function openWs(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(new Error('WebSocket connection failed')),{once:true})});return ws}

const root=process.cwd();
const standaloneHtml=fs.readFileSync(path.join(root,'preview-standalone.html'),'utf8');

const exe=browserPath();
check(Boolean(exe),`Chromium binary required for release certification${exe?' · '+exe:''}`);
if(!exe){process.exit(1)}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'scoip-v118-chrome-'));
const chrome=spawn(exe,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${tmp}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let browserWs=''; let stderr='';
chrome.stderr.setEncoding('utf8');
chrome.stderr.on('data',chunk=>{stderr+=chunk;const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m)browserWs=m[1]});
for(let i=0;i<100&&!browserWs;i++)await sleep(50);
check(Boolean(browserWs),'Chromium DevTools endpoint started');
if(!browserWs){chrome.kill('SIGKILL');server.close();fs.rmSync(tmp,{recursive:true,force:true});process.exit(1)}
const port=new URL(browserWs).port;

async function certify(name,viewport){
  const create=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});
  if(!create.ok)throw new Error(`Cannot create browser target: ${create.status}`);
  const target=await create.json();
  const ws=await openWs(target.webSocketDebuggerUrl);
  const {send,events}=listenWs(ws);
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:name==='mobile'});
  const tree=await send('Page.getFrameTree');
  const frameId=tree?.frameTree?.frame?.id;
  if(!frameId) throw new Error('Cannot resolve Chromium root frame');
  await send('Page.setDocumentContent',{frameId,html:standaloneHtml});
  await sleep(4200);
  const expr=`(()=>({
    domains:document.querySelectorAll('.domain-node,.map-node.domain-node').length,
    boxed:document.querySelectorAll('.territory').length,
    mesh:document.querySelectorAll('.ambient-mesh152,#ambientMesh,.ambient').length,
    dots:document.querySelectorAll('.ambient-dot').length,
    minimap:document.querySelectorAll('.mini-map,#miniMap').length,
    overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
    bodyClass:document.body.className,
    brand:document.querySelector('.brand small')?.textContent||'', reference:{button:!!document.getElementById('navReference117'),api:!!window.AtlasReference117}, governed:{composer:!!window.AtlasPage0Composer24,entry:!!window.AtlasEntry24,graph:!!window.AtlasGraphComposer24,rules:window.AtlasPage0Composer24?.rules?.pairwiseRuleCount||0,cross:window.AtlasPage0Composer24?.rules?.crossAxisRuleCount||0},
    controls:{play:!!document.getElementById('playPause'),freeze:!!document.getElementById('freezeBtn'),trace:!!document.getElementById('traceBtn'),lens:!!document.getElementById('lensBtn12'),compose:!!document.getElementById('composeBtn13'),fit:!!document.getElementById('fitUniverse152'),inspector:!!document.getElementById('inspector')},
    stages:{s17:!!window.AtlasStage17,s18:!!window.AtlasAsk18,s19:!!window.AtlasDocuments19,s20:!!window.AtlasStage20,s21:!!window.AtlasStage21},
    title:document.title
  }))()`;
  const result=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
  const d=result?.result?.value||{};
  const runtimeErrors=events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&['error','assert'].includes(e.params?.entry?.level))||(e.method==='Runtime.consoleAPICalled'&&e.params?.type==='error'));
  check(runtimeErrors.length===0,`${name}: zero runtime errors${runtimeErrors.length?' · '+JSON.stringify(runtimeErrors[0]).slice(0,120):''}`);
  check(d.domains===15,`${name}: 15 spatial territories · ${d.domains}`);
  check(d.boxed===0,`${name}: boxed territory renderer absent · ${d.boxed}`);
  check(d.mesh>=1,`${name}: ambient mesh present · ${d.mesh}`);
  check(d.dots>0,`${name}: ambient dots present · ${d.dots}`);
  check(d.minimap>=1,`${name}: minimap/ATLAS VIEW present · ${d.minimap}`);
  check(d.overflow===0,`${name}: zero horizontal overflow · ${d.overflow}`);
  check(/stage152-ui/.test(d.bodyClass||''),`${name}: Stage 15.2 spatial UI active`);
  check(/v152-level-\d/.test(d.bodyClass||''),`${name}: semantic zoom engaged`);
  check(Object.values(d.controls||{}).every(Boolean),`${name}: Play/Freeze/Trace/Lens/Compose/Fit/Inspector controls present`);
  check(Object.values(d.stages||{}).every(Boolean),`${name}: Stage 17–21 runtime objects initialized · ${JSON.stringify(d.stages)}`);
  check(/v1\.1\.8/.test(d.brand||''),`${name}: release identity v1.1.8 visible · ${d.brand}`);
  check(d.reference?.button&&d.reference?.api,`${name}: Reference Atlas control + runtime available`);
  check(d.governed?.composer&&d.governed?.entry&&d.governed?.graph,`${name}: v1.1.8 governed composer / entry / graph runtimes initialized`);
  check(d.governed?.rules===711&&d.governed?.cross===20,`${name}: v1.1.8 governed rule counts 711 + 20 · ${JSON.stringify(d.governed)}`);

  // v1.1.7 final semantic-focus regression gate. A4/A5 are spatial drill-down
  // states, never global anonymous-dot modes. Direct depth changes without a
  // spatial focus must clamp safely; wheel/pinch/double-click establish focus.
  await send('Runtime.evaluate',{expression:`(()=>{window.activateModule?.('road-ltl');window.S.selectedA3=null;window.S.selectedProcess=null;if(window.S.visual152)window.S.visual152.focusedA3=null;window.v152SetLevel?.(1,{center:false});window.v152SetLevel?.(2,{center:false});return true})()`,returnByValue:true});
  await sleep(220);
  const clampEval=await send('Runtime.evaluate',{expression:`(()=>({level:window.S?.visual152?.level,depth:window.S?.depth,selectedA3:window.S?.selectedA3||null,selectedProcess:window.S?.selectedProcess||null,a4Labels:[...document.querySelectorAll('.a4-node.label-visible152')].length}))()`,returnByValue:true});
  const clamp=clampEval?.result?.value||{};
  check(clamp.level===1&&clamp.depth==='a3'&&!clamp.selectedA3&&!clamp.selectedProcess,`${name}: unfocused A4 request clamps to focused-navigation A3 · ${JSON.stringify(clamp)}`);

  const targetEval=await send('Runtime.evaluate',{expression:`(()=>{const nodes=[...document.querySelectorAll('.a3-node[data-a3]')];const n=nodes.find(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})||nodes[0];if(!n)return null;n.scrollIntoView({block:'center',inline:'center'});const r=n.getBoundingClientRect();return {id:n.dataset.a3,x:r.left+r.width/2,y:r.top+r.height/2}})()`,returnByValue:true});
  await sleep(120);
  const focusTarget=targetEval?.result?.value||null;
  check(Boolean(focusTarget?.id),`${name}: A3 spatial focus target resolved · ${focusTarget?.id||'none'}`);
  if(focusTarget?.id){
    if(name==='mobile'){
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:focusTarget.x-18,y:focusTarget.y,id:0},{x:focusTarget.x+18,y:focusTarget.y,id:1}]});
      await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:focusTarget.x-48,y:focusTarget.y,id:0},{x:focusTarget.x+48,y:focusTarget.y,id:1}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }else{
      await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:focusTarget.x,y:focusTarget.y,deltaX:0,deltaY:-140});
    }
    await sleep(420);
    const a4Eval=await send('Runtime.evaluate',{expression:`(()=>{const focus=window.S?.selectedA3||window.S?.visual152?.focusedA3||null;const labels=[...document.querySelectorAll('.a4-node.label-visible152')].map(n=>({id:n.dataset.process,parent:window.S?.module?.processes?.find(p=>p.id===n.dataset.process)?.a3ParentId||null,text:n.querySelector('.node-label')?.textContent||''}));const active=[...document.querySelectorAll('.a4-node:not(.v152-outside-focus)')].map(n=>n.dataset.process);return {level:window.S?.visual152?.level,depth:window.S?.depth,focus,labels,active}})()`,returnByValue:true});
    const a4=a4Eval?.result?.value||{};
    check(a4.level===2&&a4.depth==='a4'&&Boolean(a4.focus),`${name}: ${name==='mobile'?'pinch':'wheel'} zoom focuses one A3 and enters A4 · ${JSON.stringify({level:a4.level,focus:a4.focus})}`);
    check((a4.labels||[]).length>0&&a4.labels.every(x=>x.parent===a4.focus),`${name}: focused A4 labels visible and scoped to selected A3 · ${(a4.labels||[]).map(x=>x.id).join(',')}`);

    const a4TargetEval=await send('Runtime.evaluate',{expression:`(()=>{const focus=window.S?.selectedA3||window.S?.visual152?.focusedA3;const nodes=[...document.querySelectorAll('.a4-node[data-process]')].filter(n=>window.S?.module?.processes?.find(p=>p.id===n.dataset.process)?.a3ParentId===focus);const n=nodes.find(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})||nodes[0];if(!n)return null;n.scrollIntoView({block:'center',inline:'center'});const r=n.getBoundingClientRect();return {id:n.dataset.process,x:r.left+r.width/2,y:r.top+r.height/2}})()`,returnByValue:true});
    await sleep(100);
    const a4Target=a4TargetEval?.result?.value||null;
    check(Boolean(a4Target?.id),`${name}: focused A4 target resolved for A5 drill-down · ${a4Target?.id||'none'}`);
    if(a4Target?.id){
      if(name==='mobile'){
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a4Target.x-16,y:a4Target.y,id:0},{x:a4Target.x+16,y:a4Target.y,id:1}]});
        await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a4Target.x-46,y:a4Target.y,id:0},{x:a4Target.x+46,y:a4Target.y,id:1}]});
        await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }else{
        await send('Input.dispatchMouseEvent',{type:'mousePressed',x:a4Target.x,y:a4Target.y,button:'left',clickCount:1});
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:a4Target.x,y:a4Target.y,button:'left',clickCount:1});
        await sleep(70);
        await send('Input.dispatchMouseEvent',{type:'mousePressed',x:a4Target.x,y:a4Target.y,button:'left',clickCount:2});
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:a4Target.x,y:a4Target.y,button:'left',clickCount:2});
      }
      await sleep(420);
      const a5Eval=await send('Runtime.evaluate',{expression:`(()=>({level:window.S?.visual152?.level,selectedA3:window.S?.selectedA3||null,selectedProcess:window.S?.selectedProcess||null,inspector:(document.getElementById('inspectorBody')?.textContent||'').replace(/\s+/g,' ').trim(),selectedVisible:!!document.querySelector('.a4-node.selected')}))()`,returnByValue:true});
      const a5=a5Eval?.result?.value||{};
      check(a5.level===3&&Boolean(a5.selectedProcess),`${name}: ${name==='mobile'?'pinch':'double-click'} A4 drill-down enters A5 focus · ${a5.selectedProcess||'none'}`);
      check(/A4\s*→\s*A5 CONTRACT/i.test(a5.inspector||'')&&a5.selectedVisible,`${name}: A5 execution contract visible in Inspector for focused A4`);
    }
  }
  await send('Runtime.evaluate',{expression:`(()=>{window.v152FitUniverse?.();window.activateModule?.('road-ltl');return true})()`});
  await sleep(180);
  const refOpen=await send('Runtime.evaluate',{expression:`(()=>{const b=document.querySelector('[data-module11=\"ecosystem-page-0\"],[data-module=\"ecosystem-page-0\"]');if(b)b.click();else window.AtlasReference117?.open('page0');const e=document.getElementById('referenceAtlas117'),f=document.getElementById('referenceFrame117');return {buttonFound:!!b,patched:b?.dataset?.referencePatched117||'',onclick:typeof b?.onclick,disabled:!!b?.disabled,open:e?.classList.contains('open')||false,src:f?.getAttribute('src')||f?.src||'',active:document.getElementById('navReference117')?.classList.contains('active')||false}})()`,returnByValue:true});
  const rd=refOpen?.result?.value||{};check(rd.open&&rd.active&&/page0-v6\.2\.3\.html/.test(rd.src),`${name}: Page 0 registry opens preserved Reference Atlas · ${JSON.stringify(rd)}`);
  await send('Runtime.evaluate',{expression:`window.AtlasReference117?.close()`});
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.mkdirSync('audits/v1.1.8',{recursive:true});
  fs.writeFileSync(`audits/v1.1.8/v1.1.7-${name}-certified.png`,Buffer.from(shot.data,'base64'));
  ws.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  return d;
}

try{
  const desktop=await certify('desktop',{width:1440,height:900});
  const mobile=await certify('mobile',{width:390,height:844});
  fs.mkdirSync('audits/v1.1.8',{recursive:true});
  fs.writeFileSync('audits/v1.1.8/live-browser-certificate.json',JSON.stringify({release:'v1.1.8',certifiedAt:new Date().toISOString(),chromium:exe,desktop,mobile,failures},null,2));
}catch(e){check(false,`live browser certification exception · ${e.message}`)}
finally{
  chrome.kill('SIGTERM'); await sleep(250); try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}
}
console.log(failures===0?'PASS · v1.1.8 strict live browser/governed-composition certificate · release gate satisfied':`FAIL · v1.1.8 strict live browser/governed-composition certificate · ${failures} check(s) failed`);
if(failures)process.exit(1);
