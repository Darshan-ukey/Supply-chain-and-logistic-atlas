import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {send} from './_utils.js';
import {releaseRuntime} from '../../release/release-meta.js';

const baselineUrl=new URL('../../release/baselines/v1.1.8-critical-hashes.json',import.meta.url);

// Keep every governed integrity asset as a literal URL so Vercel's Node file tracer
// packages the exact files that the runtime integrity check hashes.
const assetUrls={
  'index.html':new URL('../../index.html',import.meta.url),
  'stage17-client.js':new URL('../../stage17-client.js',import.meta.url),
  'stage18-client.js':new URL('../../stage18-client.js',import.meta.url),
  'stage19-client.js':new URL('../../stage19-client.js',import.meta.url),
  'stage20-client.js':new URL('../../stage20-client.js',import.meta.url),
  'stage21-client.js':new URL('../../stage21-client.js',import.meta.url),
  'engine/domain-neutral-core.js':new URL('../../engine/domain-neutral-core.js',import.meta.url),
  'engine/adapters/supply-chain-legacy-v1.js':new URL('../../engine/adapters/supply-chain-legacy-v1.js',import.meta.url),
  'engine/adapters/legacy-canvas-compat.js':new URL('../../engine/adapters/legacy-canvas-compat.js',import.meta.url),
  'data/atlas-registry.json':new URL('../../data/atlas-registry.json',import.meta.url),
  'data/module-catalog.json':new URL('../../data/module-catalog.json',import.meta.url),
  'data/domain-pack-catalog.json':new URL('../../data/domain-pack-catalog.json',import.meta.url),
  'data/page0/page0-v6.2.2.json':new URL('../../data/page0/page0-v6.2.2.json',import.meta.url),
  'data/modules/road-ltl-v1.2.json':new URL('../../data/modules/road-ltl-v1.2.json',import.meta.url),
  'data/core/enterprise-core-ontology-v1.json':new URL('../../data/core/enterprise-core-ontology-v1.json',import.meta.url),
  'data/contracts/domain-extension-contract-v1.schema.json':new URL('../../data/contracts/domain-extension-contract-v1.schema.json',import.meta.url),
  'data/contracts/atlas-data-contract-v1.1.schema.json':new URL('../../data/contracts/atlas-data-contract-v1.1.schema.json',import.meta.url),
  'data/domains/supply-chain-domain-pack-v1.json':new URL('../../data/domains/supply-chain-domain-pack-v1.json',import.meta.url),
  'data/crosswalks/process-concept-crosswalk-v1.json':new URL('../../data/crosswalks/process-concept-crosswalk-v1.json',import.meta.url),
  'data/governance/source-registry-v1.json':new URL('../../data/governance/source-registry-v1.json',import.meta.url),
  'governance/relationship-vocabulary-v1.json':new URL('../../governance/relationship-vocabulary-v1.json',import.meta.url),
  'governance/rule-registry-v1.1.json':new URL('../../governance/rule-registry-v1.1.json',import.meta.url),
  'governance/overlay-registry-v1.1.json':new URL('../../governance/overlay-registry-v1.1.json',import.meta.url),
  'package.json':new URL('../../package.json',import.meta.url),
  'vercel.json':new URL('../../vercel.json',import.meta.url),
  '.env.example':new URL('../../.env.example',import.meta.url),
  'release/release-meta.js':new URL('../../release/release-meta.js',import.meta.url),
  'lib/api/release-integrity.js':new URL('./release-integrity.js',import.meta.url),
  'legacy-reference-client.js':new URL('../../legacy-reference-client.js',import.meta.url),
  'reference/legacy-v0.6.6/page0-v6.2.3.html':new URL('../../reference/legacy-v0.6.6/page0-v6.2.3.html',import.meta.url),
  'reference/legacy-v0.6.6/road-ltl-v1.2.html':new URL('../../reference/legacy-v0.6.6/road-ltl-v1.2.html',import.meta.url),
  'reference/legacy-v0.6.6/page0-v6.2.2-frozen.html':new URL('../../reference/legacy-v0.6.6/page0-v6.2.2-frozen.html',import.meta.url),
  'reference/legacy-v0.6.6/page0-road-ltl-v1.2-integrated-frozen.html':new URL('../../reference/legacy-v0.6.6/page0-road-ltl-v1.2-integrated-frozen.html',import.meta.url),
  'stage24-page0-rules.js':new URL('../../stage24-page0-rules.js',import.meta.url),
  'stage24-page0-composer.js':new URL('../../stage24-page0-composer.js',import.meta.url),
  'stage24-enterprise-entry.js':new URL('../../stage24-enterprise-entry.js',import.meta.url),
  'RELEASE_V1.1.8.md':new URL('../../RELEASE_V1.1.8.md',import.meta.url)
};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

export default async function handler(req,res){
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  try{
    const baseline=JSON.parse(fs.readFileSync(fileURLToPath(baselineUrl),'utf8'));
    const files=Object.entries(baseline.files||{}).map(([rel,expected])=>{
      const url=assetUrls[rel];
      if(!url)return{rel,ok:false,expected,actual:null,error:'unmapped'};
      const p=fileURLToPath(url);
      if(!fs.existsSync(p))return{rel,ok:false,expected,actual:null,error:'missing'};
      const actual=sha(p);
      return{rel,ok:actual===expected,expected,actual};
    });
    const ok=files.length>0&&files.every(x=>x.ok);
    return send(res,ok?200:500,{ok,release:releaseRuntime(),parityContract:'stage23-full-product-parity-v1',compositionContract:'page0-governed-composition-v1.1.8',foundationContract:'atlas-data-contract-v1.1',criticalIntegrity:ok,checkedFiles:files.length,files});
  }catch(e){return send(res,500,{ok:false,error:e.message,release:releaseRuntime()})}
}
