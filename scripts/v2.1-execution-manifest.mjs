import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rels=[
 'governance/ATLAS_EXECUTION_FABRIC_ARCHITECTURE_V1_FROZEN.md','execution/manifest.json',
 'execution/contracts/work-decomposition-v1.1.schema.json','execution/contracts/execution-adapter-standard-v1.schema.json','execution/contracts/runtime-projection-v1.schema.json','execution/contracts/malkom-adapter-manifest-v1.json',
 'execution/core/runtime-adapter-registry.mjs','execution/adapters/malkom/malkom-adapter.mjs','execution/ui/atlas-execution-flow.js','execution/ui/atlas-execution-flow.css','execution/ui/runtime-access-shell.js','execution/SECURITY_BOUNDARY.md','migrations/v2.1-execution-fabric.sql','lib/api/_utils.js','lib/api/runtime-access.js','lib/api/malkom-projections.js','api/atlas.js','vercel.json','.vercelignore','index.html','admin.html','V2.1_EXECUTION_FABRIC_BUILD_AUDIT.md','package.json'
];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const files=Object.fromEntries(rels.map(p=>[p,hash(p)]));
const out={release:'v2.1.0-dev.1',architecture:'Atlas Execution Fabric Architecture V1',architectureStatus:'FROZEN',generatedAt:new Date().toISOString(),files,malkomRuntimeSuiteEmbedded:fs.existsSync(path.join(ROOT,'execution/runtimes/malkom/engine-suite/malkom-domainwarehouse-engine/package.json'))};
fs.writeFileSync(path.join(ROOT,'release/v2.1-execution-fabric-manifest.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
