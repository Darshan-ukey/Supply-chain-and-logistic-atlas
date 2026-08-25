import fs from 'node:fs';import crypto from 'node:crypto';
let failures=0;const check=(ok,l,d='')=>{console.log(`${ok?'PASS':'FAIL'} · ${l}${d!==''?' · '+d:''}`);if(!ok)failures++};const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const idx=fs.readFileSync('index.html','utf8'),ask=fs.readFileSync('stage18-client.js','utf8'),composer=fs.readFileSync('stage24-page0-composer.js','utf8'),entry=fs.readFileSync('stage24-enterprise-entry.js','utf8');
for(const f of ['stage24-page0-rules.js','stage24-page0-composer.js','stage24-enterprise-entry.js'])check(idx.includes(`src="${f}"`),`index loads ${f}`);
check(idx.indexOf('stage18-client.js')<idx.indexOf('stage24-page0-rules.js'),'Stage 18 loads before governed composer so command routing can be patched');
check(ask.includes('page0Composition')&&ask.includes('entryState'),'Ask Atlas captures v1.1.8 composition + entry state');
check(ask.includes('AtlasPage0Composer24?.applyContextOption'),'Ask Atlas context commands route through governed composer');
check(composer.includes('Execution Role / Perspective')&&composer.includes('selectExecutionRole24'),'Road LTL child execution-role refinement present');
check(composer.includes('1 Active')===false,'composer does not hard-code test result counts');
check(entry.includes('Multi-entry Atlas navigation')&&entry.includes('compatibleModes'),'multi-entry resolution layer present');
check(entry.includes('page0Composer24'),'Saved Views capture governed composer state');
const protectedHashes={
 'data/page0/page0-v6.2.2.json':'c8805c194f87cd795014e4a44f362d67c921f5e0e978b9a29014befafc0fbbd0',
 'data/modules/road-ltl-v1.2.json':'2d5c78d4480bb693747bcb18a2c006b3fe0a63e6150c506e84ea3e4c5f3f6cfd',
 'data/core/enterprise-core-ontology-v1.json':'43cb2e69b7b4203ad8418394f3aa7050b55fa06a11939bf0909c24a494438b9c',
 'data/domains/supply-chain-domain-pack-v1.json':'e2fb5a9eeb5c6906c3e5fd2fcf1f29d9b3e7e1a450f7346d163234cf978acab7',
 'stage17-client.js':'c5b29ceb9eb365541d0598cfd9f59a134ed866a9bd0c21bcbf03ee460c64f35d',
 'stage19-client.js':'f1c92dd1c09eb3714a7cf204f125221ca31156dbc3e148846866442c810dffaa',
 'stage20-client.js':'86f707a669edb2ec8a1cd58e4de399f6b46147455fa6e596172c025e22f45e67',
 'stage21-client.js':'b1d0c420efb31bba3a9cadd31cf0bdafa51d79563d5615268db66068451ab5a7'
};
for(const [f,h] of Object.entries(protectedHashes))check(sha(f)===h,`${f} protected hash`,sha(f));
check(sha('reference/legacy-v0.6.6/page0-v6.2.3.html')==='45ea5ad55c6f0103bdb70ee33c05e2ca68587d98453a8c0c2c160e67d51e73c7','exact Page 0 V6.2.3 Reference donor');
check(sha('reference/legacy-v0.6.6/road-ltl-v1.2.html')==='a75ca386b0048af94aa8f8f9ea726dbe10f3c819c602d90daff4f90ddf942c92','exact Road LTL V1.2 Reference donor');
console.log(failures?'FAIL · v1.1.8 static integration':'PASS · v1.1.8 static integration');if(failures)process.exit(1);
