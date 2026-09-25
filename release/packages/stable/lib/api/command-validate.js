import {send,body,err} from './_utils.js';
import {validateCanvasState,validateCommands} from './_atlas.js';
export default async function handler(req,res){try{if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});const b=await body(req),state=b.canvasState||{};const vs=validateCanvasState(state);if(!vs.valid)return send(res,409,{ok:false,error:'Canvas state failed Atlas validation',details:vs.errors});const x=validateCommands(b.commands||[],state);send(res,200,{ok:true,stage:'18',...x})}catch(e){err(res,e)}}
