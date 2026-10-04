import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const [repo,sha,destination,evidencePath,phase='final']=process.argv.slice(2);
if(!repo||!/^[a-f0-9]{40}$/.test(sha||'')||!destination||!evidencePath)throw Error('Usage: node run-s8-3a-exact-qa.mjs REPO EXACT_SHA NEW_CHECKOUT EVIDENCE_JSON [pre-generation|final]');
if(fs.existsSync(destination))throw Error('Runner requires a new checkout directory');
const evidence={runnerId:'s8-3a-local-exact-sha-'+sha,startedAt:new Date().toISOString(),commit:sha,phase,node:process.version,platform:process.platform,commands:[],result:'FAIL'};
function command(executable,args,cwd,env=process.env){
 const r=spawnSync(executable,args,{cwd,env,encoding:'utf8',maxBuffer:20*1024*1024});
 evidence.commands.push({executable,args,cwd,exit:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message});
 if(r.status!==0)throw Error('Command failed: '+executable+' '+args.join(' '));
 return r.stdout;
}
try{
 command('git',['clone','--no-checkout','--shared',path.resolve(repo),path.resolve(destination)]);
 command('git',['-c','core.autocrlf=false','checkout','--detach',sha],destination);
 if(command('git',['rev-parse','HEAD'],destination).trim()!==sha)throw Error('Exact SHA mismatch');
 evidence.tree=command('git',['rev-parse','HEAD^{tree}'],destination).trim();
 if(command('git',['status','--porcelain'],destination).trim())throw Error('Checkout not clean');
 const stdout=command(process.execPath,['tests/atl-155-bounded-daughter-generation.test.js'],destination,{...process.env,S8_REQUIRE_MATERIALIZED:phase==='final'?'1':'0'});
 evidence.regression=JSON.parse(stdout);
 evidence.identities={};
 const files=command('git',['ls-files','scripts/generate-bounded-daughter-v1.js','scripts/s8-3a-certified-inputs.js','tests/atl-155-bounded-daughter-generation.test.js','data/generated/daughters'],destination).trim().split('\n').filter(Boolean);
 for(const file of files){const bytes=fs.readFileSync(path.join(destination,file));evidence.identities[file]={gitBlob:command('git',['rev-parse',sha+':'+file],destination).trim(),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};}
 if(command('git',['status','--porcelain'],destination).trim())throw Error('Regression mutated exact checkout');
 evidence.result='PASS';
}catch(error){evidence.failure=error.message;process.exitCode=1;}
finally{evidence.finishedAt=new Date().toISOString();fs.mkdirSync(path.dirname(path.resolve(evidencePath)),{recursive:true});fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({commit:sha,result:evidence.result,evidencePath,failure:evidence.failure}));}
