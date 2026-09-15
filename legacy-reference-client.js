/* v1.1.7 · Legacy Reference Atlas restoration
 * Restores direct access to the complete pre-canvas Atlas reference experience
 * without replacing or mutating the Stage-23 spatial canvas runtime.
 */
(function(){
'use strict';
const PAGES={
  page0:{label:'Page 0 · V6.2.3',path:'reference/legacy-v0.6.6/page0-v6.2.3.html'},
  ltl:{label:'Road LTL · V1.2',path:'reference/legacy-v0.6.6/road-ltl-v1.2.html'},
  frozen:{label:'Frozen Page 0 · V6.2.2',path:'reference/legacy-v0.6.6/page0-v6.2.2-frozen.html'},
  integrated:{label:'Frozen Page 0 + Road LTL',path:'reference/legacy-v0.6.6/page0-road-ltl-v1.2-integrated-frozen.html'}
};
let current='page0',priorFocus=null,patched=false;
const $=id=>document.getElementById(id);
function abs(p){try{const b=document.baseURI||location.href;if(/^(about|data):/i.test(b))return p;return new URL(p,b).href}catch{return p}}
function injectStyles(){
 if($('legacyReferenceStyles117'))return;
 const s=document.createElement('style');s.id='legacyReferenceStyles117';s.textContent=`
 #referenceAtlas117{position:fixed;inset:0;z-index:120000;background:#f4f8fa;display:none;flex-direction:column;color:#102f3f}
 #referenceAtlas117.open{display:flex}
 .reference-head117{height:62px;flex:0 0 auto;background:#06293a;color:#fff;display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.14);box-shadow:0 3px 16px #00131f26}
 .reference-brand117{display:flex;align-items:center;gap:10px;min-width:230px}.reference-brand117 b{font:700 15px/1.15 system-ui,sans-serif}.reference-brand117 small{display:block;color:#9fd7df;font:500 10px/1.3 system-ui,sans-serif;margin-top:2px}
 .reference-switch117{display:flex;gap:6px;overflow:auto;flex:1}.reference-switch117 button,.reference-actions117 button{border:1px solid #406577;background:#0b3448;color:#e9f6f8;border-radius:8px;padding:8px 11px;font:600 11px/1 system-ui,sans-serif;white-space:nowrap;cursor:pointer}.reference-switch117 button.active{background:#0d8197;border-color:#5dd5e5;color:white}.reference-switch117 button:hover,.reference-actions117 button:hover{border-color:#83dce7}
 .reference-actions117{display:flex;gap:6px}.reference-frame117{border:0;width:100%;height:calc(100vh - 62px);background:white;display:block}.reference-close117{font-size:15px!important;min-width:38px}
 #navReference117{position:relative}#navReference117::after{content:'REFERENCE';position:absolute;right:6px;top:-7px;font:700 7px/1 monospace;letter-spacing:.08em;color:#10a9c1;background:#e9fbfe;padding:2px 4px;border-radius:4px}
 @media(max-width:760px){.reference-head117{height:auto;min-height:58px;flex-wrap:wrap;padding:8px}.reference-brand117{min-width:0;flex:1}.reference-switch117{order:3;width:100%;flex-basis:100%}.reference-frame117{height:calc(100vh - 103px)}.reference-actions117 .open-new117{display:none}}
 `;document.head.appendChild(s);
}
function installDemoShortcut(){
 if(current!=='page0'&&current!=='ltl')return;
 const f=$('referenceFrame117');let d;try{d=f?.contentDocument}catch{return}if(!d?.body)return;
 const old=d.getElementById('atlasLtl03DemoShortcut');if(old)old.remove();
 const bar=d.createElement('div');bar.id='atlasLtl03DemoShortcut';
 bar.style.cssText='margin:10px 16px;padding:11px 13px;border:1px solid #69b9c4;border-radius:10px;background:#eaf9fb;color:#103b48;display:flex;gap:12px;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(5,51,65,.08);font-family:system-ui,-apple-system,Segoe UI,sans-serif;position:relative;z-index:9999';
 bar.innerHTML='<div><b style="font-size:13px">LTL-03 · Task → Work Decomposition → WorkDefinition</b><div style="font-size:11px;color:#55727a;margin-top:2px">Representative governed execution-depth path for the stakeholder demo.</div></div><button type="button" style="border:0;border-radius:7px;background:#087b8c;color:white;padding:9px 12px;font-weight:750;white-space:nowrap;cursor:pointer">Open LTL-03 depth →</button>';
 bar.querySelector('button').onclick=()=>{window.location.href=abs('ltl03-demo-flow.html')};
 const anchor=d.querySelector('main')||d.querySelector('[role="main"]')||d.body;
 anchor.insertBefore(bar,anchor.firstChild);
}
function inject(){
 if($('referenceAtlas117'))return;
 injectStyles();
 const nav=document.querySelector('nav.primary');
 if(nav&&!$('navReference117')){
  const b=document.createElement('button');b.id='navReference117';b.type='button';b.textContent='Reference Atlas';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','referenceAtlas117');b.addEventListener('click',()=>openReference('page0'));nav.appendChild(b);
 }
 const shell=document.createElement('section');shell.id='referenceAtlas117';shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-hidden','true');shell.innerHTML=`<div class="reference-head117"><div class="reference-brand117"><div><b>Reference Atlas</b><small>V6.2.3 + Road LTL V1.2 · preserved legacy navigation</small></div></div><div class="reference-switch117">${Object.entries(PAGES).map(([k,v])=>`<button type="button" data-reference-page117="${k}">${v.label}</button>`).join('')}</div><div class="reference-actions117"><button type="button" class="open-new117" id="referenceOpenNew117">↗ Open separately</button><button type="button" class="reference-close117" id="referenceClose117" aria-label="Close Reference Atlas">×</button></div></div><iframe class="reference-frame117" id="referenceFrame117" title="Reference Atlas"></iframe>`;
 document.body.appendChild(shell);
 shell.querySelectorAll('[data-reference-page117]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.referencePage117)));
 $('referenceOpenNew117')?.addEventListener('click',()=>window.open(abs(PAGES[current].path),'_blank','noopener'));
 $('referenceClose117')?.addEventListener('click',closeReference);
 $('referenceFrame117')?.addEventListener('load',()=>setTimeout(installDemoShortcut,30));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&shell.classList.contains('open')){e.preventDefault();closeReference()}},true);
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-module11],[data-module]');const id=b?.dataset?.module11||b?.dataset?.module;if(id==='ecosystem-page-0'){e.preventDefault();e.stopImmediatePropagation();openReference('page0')}},true);
 patchRouting();
 window.AtlasReference117={open:openReference,close:closeReference,setPage,pages:PAGES,get current(){return current}};
}
function setPage(key){
 if(!PAGES[key])key='page0';current=key;
 const f=$('referenceFrame117');if(f){const target=abs(PAGES[key].path);if(f.src!==target)f.src=target;else setTimeout(installDemoShortcut,30);}
 document.querySelectorAll('[data-reference-page117]').forEach(b=>b.classList.toggle('active',b.dataset.referencePage117===key));
}
function openReference(key='page0'){
 inject();priorFocus=document.activeElement;setPage(key);
 const el=$('referenceAtlas117');el.classList.add('open');el.setAttribute('aria-hidden','false');
 $('navReference117')?.classList.add('active');$('referenceClose117')?.focus({preventScroll:true});
 return true;
}
function closeReference(){
 const el=$('referenceAtlas117');if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');$('navReference117')?.classList.remove('active');
 if(priorFocus&&typeof priorFocus.focus==='function')priorFocus.focus({preventScroll:true});
}
function patchPage0Button(){
 const b=document.querySelector('[data-module11="ecosystem-page-0"],[data-module="ecosystem-page-0"]');
 if(!b||b.dataset.referencePatched117==='1')return;
 b.dataset.referencePatched117='1';
 b.onclick=function(e){e?.preventDefault?.();e?.stopPropagation?.();openReference('page0');return false};
}
function watchRegistry(){
 const list=$('moduleList');if(!list||list.dataset.referenceObserved117==='1')return;
 list.dataset.referenceObserved117='1';patchPage0Button();
 new MutationObserver(()=>queueMicrotask(patchPage0Button)).observe(list,{childList:true,subtree:true});
}
function patchRouting(){
 if(patched)return;patched=true;
 const wrap=(name)=>{
  const old=window[name];if(typeof old!=='function')return;
  const fn=function(id,...rest){if(id==='ecosystem-page-0'||id==='page0'||id==='reference-atlas'){return openReference('page0')}return old.call(this,id,...rest)};
  window[name]=fn;try{if(name==='activateModule')activateModule=fn;if(name==='stage11SelectCoverage')stage11SelectCoverage=fn}catch{}
 };
 wrap('activateModule');wrap('stage11SelectCoverage');
 const oldCommand=window.runAtlasCommand;
 if(typeof oldCommand==='function'){
  const cmd=function(q){const l=String(q||'').toLowerCase();if(/(open|show|take me to|reference).*(page\s*0|reference atlas|legacy atlas)/.test(l)){openReference('page0');if(typeof window.addChat==='function')window.addChat('Opened the preserved V6.2.3 Reference Atlas. Its original Page 0 navigation remains intact alongside the spatial canvas.');return true}if(/(open|show|reference).*(road\s*ltl).*(reference|page|atlas)/.test(l)){openReference('ltl');return true}return oldCommand.apply(this,arguments)};
  window.runAtlasCommand=cmd;try{runAtlasCommand=cmd}catch{};if(window.AtlasCommandBus)window.AtlasCommandBus.execute=cmd;
 }
}
function boot(){if(!document.body||!document.querySelector('nav.primary')){setTimeout(boot,80);return}inject();watchRegistry();setTimeout(()=>{patchRouting();watchRegistry();patchPage0Button()},500);setTimeout(()=>{watchRegistry();patchPage0Button()},1800)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80));else setTimeout(boot,80);
})();
