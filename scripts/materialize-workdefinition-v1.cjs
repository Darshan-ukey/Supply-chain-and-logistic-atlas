const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
async function main(){
  const args=process.argv.slice(2);
  if(args.length===1 && args[0]==='--plan') {
    process.stdout.write(cp.execFileSync(process.execPath,['scripts/workdefinition-lineage-plan-v1.cjs'],{cwd:root}));return;
  }
  if(args.length<2 || args.length>3) throw Error('PINNED_PROTECTED_DECOMPOSITION_REQUIRED');
  const [input,expectedHash,output]=args;
  const envelope=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
  const donor=script=>JSON.parse(cp.execFileSync(process.execPath,[script],{cwd:root,encoding:'utf8'}));
  const {compileCorrectedTask}=await import('../lib/compile/s8-workdefinition-compiler.js');
  const result=compileCorrectedTask(envelope,expectedHash,donor('scripts/materialize-operational-semantics-v1.cjs'),donor('scripts/materialize-client-binding-v1.cjs'));
  const {canonicalHash}=await import('../lib/compile/workdefinition-compiler.js');
  if(output){
    const requested=path.resolve(output);
    const target=path.join(fs.realpathSync(path.dirname(requested)),path.basename(requested));
    const relative=path.relative(fs.realpathSync(root),target);
    if(!relative.startsWith('..'+path.sep) && !path.isAbsolute(relative)) throw Error('PROTECTED_OUTPUT_MUST_BE_OUTSIDE_PUBLIC_REPOSITORY');
    fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  }
  process.stdout.write(JSON.stringify({status:'DETERMINISTIC_COMPILATION_VERIFIED',moduleId:result.moduleId,moduleVersion:result.moduleVersion,totals:result.totals,governedInputContentHash:expectedHash,outputContentHash:canonicalHash(result),independentExecutorProofStatus:'NOT_INDEPENDENTLY_PROVEN',detailIncluded:false},null,2)+'\n');
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
