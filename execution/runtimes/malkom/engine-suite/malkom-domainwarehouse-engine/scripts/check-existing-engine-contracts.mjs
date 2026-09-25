import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const checks=[
 ['workflow','malkom-workflow-engine/packages/core/src/schemas.ts',['lifecycleDefinitionSchema','initialState','states','slaMinutes','holdsClock','terminal','to:']],
 ['validation','malkom-validation-engine/packages/core/src/schemas.ts',['required','pattern','oneOf']],
 ['integration','malkom-integration-engine/packages/core/src/schemas.ts',['connection','mapping']],
 ['allocation','malkom-workallocation-engine/packages/core/src/config/schemas.ts',['queueDefinitionSchema','workers','strategy']],
 ['exceptions','malkom-exceptionmanagement-engine/packages/core/src/schemas.ts',['reason']],
 ['rules','malkom-rules-engine/packages/core/src/config/schemas.ts',['registryEntitySchema','groupDefinitionSchema','scopeSchema']],
 ['agentic','malkom-agenticai-engine/packages/contract/src/manifest.ts',['goal:','queue:','subQueues:']]
];
let fail=0;const result=[];for(const [name,rel,tokens] of checks){const file=path.join(root,rel);if(!fs.existsSync(file)){result.push({name,ok:false,file,missing:['FILE']});fail++;continue}const text=fs.readFileSync(file,'utf8');const missing=tokens.filter(t=>!text.includes(t));result.push({name,ok:missing.length===0,file:path.relative(root,file),missing});if(missing.length)fail++;}
const out={ok:fail===0,checked:result.length,failed:fail,result};fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),'../docs/ENGINE_CONTRACT_COMPATIBILITY.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(fail)process.exit(1);
