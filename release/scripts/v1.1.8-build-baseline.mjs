import fs from 'node:fs';import crypto from 'node:crypto';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const prev=JSON.parse(fs.readFileSync('release/baselines/v1.1.7-critical-hashes.json','utf8'));
const rels=[...Object.keys(prev.files), 'stage24-page0-rules.js','stage24-page0-composer.js','stage24-enterprise-entry.js','RELEASE_V1.1.8.md'];
const files={};for(const rel of rels){if(!fs.existsSync(rel))throw new Error(`Missing critical file ${rel}`);files[rel]=sha(rel)}
const out={schemaVersion:'v1.1.8-critical-integrity-v1',releaseId:'scoip-v1.1.8-governed-composition-2026.08.25',purpose:'Fail-closed integrity across v1.1.7 full-product/reference parity plus v1.1.8 governed Page-0 composition, multi-entry resolution, Ask Atlas integration and Road LTL child-role refinement.',provenance:{golden:'Exact v1.1.7 final GitHub master SHA-256 a2e64c9e89f9739c3a2fc47556566d7fbc39c8f1afb70eace8bc9d2c86a7d5f5',composition:'711 pairwise + 20 cross-axis governed rules',serverless:'8 consolidated Vercel functions / 28 public API paths'},files};
fs.writeFileSync('release/baselines/v1.1.8-critical-hashes.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({ok:true,files:Object.keys(files).length,releaseId:out.releaseId},null,2));
