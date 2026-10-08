import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const patch=fs.readFileSync(new URL('../assets/rem034-host-stage-selection.js',import.meta.url),'utf8');
const journey=[
  {id:'booking',processIds:['LTL03']},
  {id:'origin',processIds:['LTL06','LTL07']},
  {id:'movement',processIds:['LTL08']},
];
function run(depth,displayIndex,visible,expectedStage,expectedProcess,trace=false){
 const state={depth,stageIndex:1,selectedProcessId:'LTL07',trace:trace?{steps:[{processId:'LTL06'},{processId:'LTL07'}],focus:1}:null};
 let renders=0;
 const ctx={state,currentStages:()=>journey,depthStages:()=>visible,renderAll:()=>{
   renders++;const s=journey[state.stageIndex];
   if(!s.processIds.includes(state.selectedProcessId))state.selectedProcessId=s.processIds.at(-1);
 },selectStage:()=>{throw Error('legacy called')}};
 vm.createContext(ctx);vm.runInContext(patch,ctx);ctx.selectStage(displayIndex);
 assert.equal(state.stageIndex,expectedStage,depth+' journey stage');
 assert.equal(state.selectedProcessId,expectedProcess,depth+' process');
 assert.equal(renders,1,depth+' render count');
 if(trace)assert.equal(state.trace.focus,0,'trace focus');
}
run('a3',1,journey,1,'LTL07');
run('a4',0,[{id:'LTL06',processIds:['LTL06']},{id:'LTL07',processIds:['LTL07']}],1,'LTL06');
run('a5',0,[{id:'LTL06',processIds:['LTL06']},{id:'LTL07',processIds:['LTL07']}],1,'LTL06',true);
run('a2',0,[{id:'a2-0',processIds:['LTL03','LTL06']},{id:'a2-2',processIds:['LTL07','LTL08']}],1,'LTL06');
run('a2',1,[{id:'a2-0',processIds:['LTL03','LTL06']},{id:'a2-2',processIds:['LTL07','LTL08']}],2,'LTL08');
console.log('REM-034: 5 canonical A2/A3/A4/A5/trace selection regressions PASS');
