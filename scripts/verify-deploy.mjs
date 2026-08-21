import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const required=[
  'package.json',
  'app/page.js',
  'app/components/SimulationStudio.js',
  'app/api/chat/route.js',
  'app/api/simulation/route.js',
  'lib/agents/orchestrator.js',
  'lib/runtime/capabilities.js',
  'lib/runtime/ui-actions.js',
  'lib/simulation/engine.js',
  'lib/atlas/store.js',
  'data/road-ltl-v1.2-model.json',
  'data/atlas-constitution-v6.2.3.json',
  'public/atlas.html',
  'public/road-ltl.html'
];

const missing=required.filter(rel=>!fs.existsSync(path.join(root,rel)));
if(missing.length){
  console.error('DEPLOYMENT FILE VERIFICATION FAILED. Missing required files:');
  for(const rel of missing)console.error(` - ${rel}`);
  console.error('This usually means a GitHub web upload omitted a new file/folder. Re-upload the complete deploy package at repository root.');
  process.exit(1);
}

const sourceRoots=['app','lib'];
const exts=['.js','.mjs','.jsx','.ts','.tsx'];
const importRe=/(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g;
const requireRe=/require\((['"])(\.{1,2}\/[^'"]+)\1\)/g;
const unresolved=[];
function resolveLocal(file,spec){
  const base=path.resolve(path.dirname(file),spec);
  const candidates=path.extname(base)?[base]:[base,...exts.map(ext=>base+ext),...exts.map(ext=>path.join(base,'index'+ext))];
  return candidates.some(c=>fs.existsSync(c));
}
function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())walk(p);
    else if(exts.includes(path.extname(ent.name))){
      const txt=fs.readFileSync(p,'utf8');
      for(const re of [importRe,requireRe]){
        re.lastIndex=0; let m;
        while((m=re.exec(txt))){if(!resolveLocal(p,m[2]))unresolved.push(`${path.relative(root,p)} -> ${m[2]}`)}
      }
    }
  }
}
for(const d of sourceRoots)walk(path.join(root,d));
if(unresolved.length){
  console.error('LOCAL IMPORT VERIFICATION FAILED:');
  for(const item of unresolved)console.error(` - ${item}`);
  process.exit(1);
}
console.log(`deploy-file-verifier: PASS (${required.length} required files; all local app/lib imports resolve)`);
