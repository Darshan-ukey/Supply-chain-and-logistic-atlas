import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export const root=path.resolve(new URL('../..',import.meta.url).pathname);
export const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function percentile(vals,p){if(!vals.length)return 0;const a=[...vals].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.max(0,Math.ceil((p/100)*a.length)-1))]}
export function walk(dir){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...walk(p));else out.push(p)}return out}
export function copyTree(src,dst,filter=()=>true){if(!fs.existsSync(src))return;const st=fs.statSync(src);if(st.isDirectory()){fs.mkdirSync(dst,{recursive:true});for(const n of fs.readdirSync(src))copyTree(path.join(src,n),path.join(dst,n),filter)}else if(filter(src))fs.copyFileSync(src,dst)}
export function fileInfo(rel){const p=path.join(root,rel);return {path:rel,bytes:fs.statSync(p).size,sha256:sha(p)}}
