const clone=v=>JSON.parse(JSON.stringify(v));
const ok=content=>({content:[{type:'text',text:JSON.stringify(content)}],isError:false});
const err=(code,message=code)=>({content:[{type:'text',text:JSON.stringify({ok:false,error:{code,message}})}],isError:true});

export const malkomToolDefinitions=Object.freeze([
  {name:'validate_atlas_workdefinition',description:'Validate Atlas→Malkom adapted definition through the configured Domain Warehouse verifier.',inputSchema:{type:'object',properties:{definition:{type:'object'}},required:['definition']}},
  {name:'adapt_to_malkom',description:'Adapt governed ATL-169/P6.2 projection + Malkom consumer profile into the Domain Warehouse v2.3 definition shape.',inputSchema:{type:'object',properties:{atlasProjection:{type:'object'},consumerProfile:{type:'object'},profile:{type:'object'}},required:['atlasProjection','consumerProfile']}},
  {name:'verify_domain_warehouse',description:'Verify an adapted Domain Warehouse definition.',inputSchema:{type:'object',properties:{definition:{type:'object'}},required:['definition']}},
  {name:'compile_malkom',description:'Compile a verified Malkom Domain Warehouse definition.',inputSchema:{type:'object',properties:{definition:{type:'object'}},required:['definition']}},
  {name:'run_malkom_integration',description:'Run adapt → verify → compile → Atlas-governed materialization gate.',inputSchema:{type:'object',properties:{atlasProjection:{type:'object'},consumerProfile:{type:'object'},profile:{type:'object'}},required:['atlasProjection','consumerProfile']}},
  {name:'get_materialization_blockers',description:'Return final blocker/readiness summary from a completed bounded integration result.',inputSchema:{type:'object',properties:{result:{type:'object'}},required:['result']}},
  {name:'get_projection_summary',description:'Return the bounded integration projection summary.',inputSchema:{type:'object',properties:{result:{type:'object'}},required:['result']}}
]);

export function createMalkomMcpTools(service){
  const call=async(name,args={})=>{
    try{
      let result;
      if(name==='validate_atlas_workdefinition'||name==='verify_domain_warehouse')result=service.verify(args);
      else if(name==='adapt_to_malkom')result=service.adapt(args);
      else if(name==='compile_malkom')result=service.compile(args);
      else if(name==='run_malkom_integration')result=service.run(args);
      else if(name==='get_projection_summary')result=service.projectionSummary(args);
      else if(name==='get_materialization_blockers'){
        const summary=service.projectionSummary(args);
        result={finalMaterializable:summary.finalMaterializable,finalDisposition:summary.finalDisposition,blockers:clone(summary.blockers||[])};
      }else return err('UNKNOWN_TOOL',`Unknown MCP tool: ${name}`);
      return ok({ok:true,tool:name,result,claims:{liveHostCertified:false,scope:'BOUNDED_NON_LIVE'}});
    }catch(error){
      return err(String(error?.code||'MCP_TOOL_ERROR'),String(error?.message||error));
    }
  };
  return Object.freeze({list:()=>clone(malkomToolDefinitions),call});
}
