const fail=(code,message=code)=>{const e=new Error(message);e.code=code;throw e;};

export async function loadMalkomDomainWarehouseEngine({moduleRef=process.env.MALKOM_DOMAINWAREHOUSE_MODULE}={}){
  if(!moduleRef) fail('MALKOM_ENGINE_MODULE_NOT_CONFIGURED','MALKOM_DOMAINWAREHOUSE_MODULE is not configured');
  let mod;
  try{mod=await import(moduleRef)}catch(error){
    const e=new Error(`Unable to load Domain Warehouse engine module: ${moduleRef}`);
    e.code='MALKOM_ENGINE_MODULE_LOAD_FAILED';e.cause=error;throw e;
  }
  const verify=mod.verify||mod.default?.verify;
  const compileMalkom=mod.compileMalkom||mod.default?.compileMalkom;
  if(typeof verify!=='function'||typeof compileMalkom!=='function'){
    fail('MALKOM_ENGINE_MODULE_INVALID','Domain Warehouse module must export verify and compileMalkom');
  }
  return Object.freeze({verify,compileMalkom,moduleRef});
}
