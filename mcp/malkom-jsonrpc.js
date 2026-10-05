import {malkomToolDefinitions,createMalkomMcpTools} from './malkom-tools.js';

const response=(id,result)=>({jsonrpc:'2.0',id,result});
const failure=(id,code,message,data)=>({jsonrpc:'2.0',id,error:{code,message,...(data===undefined?{}:{data})}});

export function createMalkomMcpJsonRpcHandler(service){
  const tools=createMalkomMcpTools(service);
  return async message=>{
    const id=message?.id??null;
    if(message?.jsonrpc!=='2.0')return failure(id,-32600,'Invalid Request');
    if(message.method==='initialize')return response(id,{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'atlas-malkom-bounded',version:'1.0.0'},instructions:'Bounded non-live Atlas→Malkom integration. Live host certification is not claimed.'});
    if(message.method==='tools/list')return response(id,{tools:malkomToolDefinitions});
    if(message.method==='tools/call'){
      const name=message.params?.name,args=message.params?.arguments||{};
      return response(id,await tools.call(name,args));
    }
    if(message.method==='ping')return response(id,{});
    return failure(id,-32601,'Method not found');
  };
}
