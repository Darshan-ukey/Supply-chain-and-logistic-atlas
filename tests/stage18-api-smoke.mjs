import ask from '../api/ask-atlas.js';
import validate from '../api/command-validate.js';
import status from '../api/llm-status.js';

function res(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(x){this.body=x}}}
async function run(handler,{method='GET',body={},headers={}}={}){const req={method,body,headers,[Symbol.asyncIterator]:async function*(){}};const r=res();await handler(req,r);return {status:r.statusCode,body:JSON.parse(r.body||'{}'),headers:r.headers}}
const tests=[];
let x=await run(status);tests.push({name:'provider-status',pass:x.status===200&&x.body.configured===false&&x.body.keysExposedToBrowser===false,detail:x.body});
x=await run(ask,{method:'POST',body:{question:'What happens at origin terminal receipt?',canvasState:{moduleId:'road-ltl',selectedProcess:'LTL-06'}}});tests.push({name:'grounded-fallback',pass:x.status===200&&x.body.grounding.retrieved>0&&x.body.citations.length>0&&x.body.provider.used===false,detail:{answer:x.body.answer,citations:x.body.citations.map(c=>c.id),grounding:x.body.grounding}});
x=await run(ask,{method:'POST',body:{question:'Compare Road LTL with Road FTL at A5',canvasState:{moduleId:'road-ltl'}}});tests.push({name:'coverage-guardrail',pass:x.status===200&&/REFERENCE|published|Detailed/i.test(x.body.answer)&&x.body.citations.some(c=>c.class==='COVERAGE'),detail:{answer:x.body.answer,citations:x.body.citations.map(c=>[c.id,c.class,c.title])}});
x=await run(validate,{method:'POST',body:{canvasState:{moduleId:'road-ltl'},commands:[{type:'select_process',args:{processId:'LTL-06'}},{type:'select_process',args:{processId:'FAKE-1'}},{type:'activate_module',args:{moduleId:'road-ftl'}}]}});tests.push({name:'command-validation',pass:x.status===200&&x.body.valid.length===1&&x.body.rejected.length===2,detail:x.body});
x=await run(ask,{method:'POST',body:{question:'Trace shipment',canvasState:{moduleId:'road-ltl'}}});tests.push({name:'structured-command-proposal',pass:x.status===200&&x.body.commands.some(c=>c.type==='trace_object'&&c.args.objectId==='obj-shipment'),detail:x.body.commands});
x=await run(ask,{method:'POST',body:{question:'Now add dangerous goods',canvasState:{moduleId:'road-ltl'}}});tests.push({name:'context-command-fallback',pass:x.status===200&&x.body.commands.some(c=>c.type==='set_context_option'&&c.args.dimension==='condition'&&c.args.optionId==='cond-dangerous-goods'),detail:x.body.commands});
x=await run(ask,{method:'POST',body:{question:'What does the client do here?',workspaceId:'00000000-0000-0000-0000-000000000001',canvasState:{moduleId:'road-ltl'}}});tests.push({name:'client-workspace-auth-gate',pass:x.status===401&&/Authentication required/i.test(x.body.error||''),detail:x.body});
const ok=tests.every(t=>t.pass);console.log(JSON.stringify({ok,tests},null,2));process.exit(ok?0:1);
