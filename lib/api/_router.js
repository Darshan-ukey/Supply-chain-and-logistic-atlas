export function actionFrom(req){
  const q=req?.query?.action;if(q)return String(q);
  const url=String(req?.url||'').split('?')[0].replace(/\/+$/,'');
  return url.split('/').filter(Boolean).pop()||'';
}
export function createRouter(group,routes){return async function routed(req,res){
  const action=actionFrom(req),spec=routes[action];
  if(!spec){res.statusCode=404;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:'Unknown action',group,action:action||null,available:Object.keys(routes).sort()}))}
  try{const handler=typeof spec==='function'?spec:(await import(spec)).default;if(typeof handler!=='function')throw new Error('Handler is not callable');return await handler(req,res)}
  catch(e){res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:'Handler failed to load',group,action,detail:String(e?.message||e)}))}
}}
