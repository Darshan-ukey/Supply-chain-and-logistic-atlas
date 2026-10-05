import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {normalizeAskBody,governedAskTarget,installAskContextNormalizer} from '../assets/atl-181-ask-context-normalizer.mjs';

const targets=JSON.parse(fs.readFileSync(new URL('../governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json',import.meta.url),'utf8'));
let pass=0;
const ok=(cond,msg)=>{assert.ok(cond,msg);pass+=1};

const road=governedAskTarget(targets,'road-ltl');
ok(road?.daughterModuleVersion==='1.5','Road LTL Ask target resolves exact governed 1.5');
const ocean=governedAskTarget(targets,'ocean-fcl');
ok(ocean?.canvasBaselineVersion==='0.5'&&ocean?.daughterModuleVersion==='0.6','Ocean Ask target preserves 0.5 Canvas baseline / exact 0.6 Daughter target distinction');

const input={
  question:'What is the current control?',
  surfaceState:{surface:'canvas',moduleId:'road-ltl',moduleVersion:'V1.2',selectedProcess:'LTL-03',section:'#x'},
  canvasState:{moduleId:'road-ltl',moduleVersion:'V1.2',selectedProcess:'LTL-03',depth:'a4'}
};
const normalized=normalizeAskBody(input,targets);
ok(normalized!==input&&normalized.surfaceState!==input.surfaceState,'normalization clones rather than mutates caller state');
ok(normalized.surfaceState.moduleVersion==='1.5'&&normalized.canvasState.moduleVersion==='1.5','both supplied Ask states carry exact governed target version');
ok(normalized.surfaceState.selectedProcess==='LTL-03'&&normalized.canvasState.selectedProcess==='LTL-03','selected process is preserved exactly');
ok(normalized.surfaceState.canvasBaselineVersion==='V1.2','stale structural baseline is retained as diagnostic metadata');
ok(normalized.atlasAskContext.moduleId==='road-ltl'&&normalized.atlasAskContext.moduleVersion==='1.5','Ask normalization records P4-governed source and exact tuple');
ok(normalized.atlasAskContext.selectedProcess==='LTL-03','Ask normalization retains canonical selected task');

const exact=normalizeAskBody({surfaceState:{surface:'canvas',moduleId:'road-ltl',moduleVersion:'1.5',selectedProcess:'LTL-03'}},targets);
ok(exact.surfaceState.moduleVersion==='1.5'&&exact.surfaceState.canvasBaselineVersion===undefined,'already exact version is preserved without false stale-baseline marker');

const unsupported={surfaceState:{surface:'canvas',moduleId:'road-ftl',moduleVersion:'0.1',selectedProcess:'X'}};
ok(JSON.stringify(normalizeAskBody(unsupported,targets))===JSON.stringify(unsupported),'unsupported/unregistered module is not silently substituted');

const noState={question:'Universe question'};
ok(JSON.stringify(normalizeAskBody(noState,targets))===JSON.stringify(noState),'non-A5/no-state request remains unchanged');

const calls=[];
const fakeFetch=async(input,init={})=>{
  calls.push({input,init});
  if(String(input).includes('P4_CANVAS_DAUGHTER_TARGETS'))return {ok:true,json:async()=>targets};
  return {ok:true,json:async()=>({ok:true})};
};
const g={fetch:fakeFetch,location:{origin:'https://atlas.example'}};
const marker=await installAskContextNormalizer({fetchImpl:fakeFetch,globalObj:g});
ok(marker.installed===true,'Ask request normalizer installs');
await g.fetch('api/ask-atlas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
const askCall=calls.at(-1);
const sent=JSON.parse(askCall.init.body);
ok(sent.surfaceState.moduleVersion==='1.5'&&sent.surfaceState.selectedProcess==='LTL-03','interceptor sends exact governed Ask tuple while preserving task');
const before=calls.length;
await g.fetch('/api/health',{method:'GET'});
ok(calls.length===before+1&&calls.at(-1).input==='/api/health','non-Ask traffic passes through unchanged');
const marker2=await installAskContextNormalizer({fetchImpl:g.fetch,globalObj:g});
ok(marker2===marker,'normalizer installation is idempotent');

const rootBlob=execFileSync('git',['rev-parse','HEAD:index.html'],{encoding:'utf8'}).trim();
ok(rootBlob==='043802523b1618c143a0e78b88bbfb2afaa7c7dd','certified root remains byte-identical');
const apiBlob=execFileSync('git',['rev-parse','HEAD:lib/api/ask-atlas.js'],{encoding:'utf8'}).trim();
ok(apiBlob==='8fa80f9dd0b733a523aed6970269f5f32d5e64da','server Ask API exact-version guard remains certified/unchanged');
const targetBlob=execFileSync('git',['rev-parse','HEAD:governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json'],{encoding:'utf8'}).trim();
ok(targetBlob==='0daa4af6518478d1ca590dfafc67074a0cee2e09','P4 target registry remains byte-identical');

console.log(`ATL-181 RP-04 Ask context normalization: ${pass}/${pass} PASS`);
