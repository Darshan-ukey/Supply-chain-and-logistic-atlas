const REQUIRED_OPERATIONS=['assess','requiredBindings','project','verify'];
const DISPOSITIONS=new Set(['SUPPORTED','MAPPED','TRANSFORMED','CLIENT_BINDING_REQUIRED','PARTIAL','UNSUPPORTED_RUNTIME','DEFERRED_RUNTIME_ENHANCEMENT']);

export class RuntimeAdapterRegistry {
  #adapters=new Map();

  register(adapter){
    validateAdapter(adapter);
    if(this.#adapters.has(adapter.adapterId)) throw new Error(`Duplicate adapter ${adapter.adapterId}`);
    this.#adapters.set(adapter.adapterId,adapter);
    return adapter;
  }

  replace(adapter){
    validateAdapter(adapter);
    this.#adapters.set(adapter.adapterId,adapter);
    return adapter;
  }

  get(adapterId){return this.#adapters.get(adapterId)||null}
  list(){return [...this.#adapters.values()].map(a=>describeAdapter(a))}

  assess(adapterId,workDefinition,clientContext={}){
    const adapter=this.get(adapterId);if(!adapter)throw new Error(`Unknown adapter ${adapterId}`);
    const result=adapter.assess(workDefinition,clientContext);
    return normalizeAssessment(result,adapter);
  }
}

export function validateAdapter(adapter){
  const errors=[];
  for(const k of ['adapterId','runtime','version']) if(!String(adapter?.[k]||'').trim()) errors.push(`missing ${k}`);
  for(const op of REQUIRED_OPERATIONS) if(typeof adapter?.[op]!=='function') errors.push(`missing required operation ${op}()`);
  if(adapter?.capabilities&&!Array.isArray(adapter.capabilities)) errors.push('capabilities must be an array');
  if(errors.length) throw new Error(`Invalid runtime adapter: ${errors.join('; ')}`);
  return true;
}

export function describeAdapter(adapter){
  const optional=['compile','materialize','deploy','status','execute','reconcileEvidence'];
  return {
    adapterId:adapter.adapterId,runtime:adapter.runtime,version:adapter.version,
    capabilities:[...(adapter.capabilities||[])],
    operations:Object.fromEntries([...REQUIRED_OPERATIONS,...optional].map(k=>[k,typeof adapter[k]==='function']))
  };
}

export function normalizeAssessment(result={},adapter){
  const dispositions=(result.capabilityDispositions||[]).map(x=>{
    const disposition=DISPOSITIONS.has(x.disposition)?x.disposition:'UNSUPPORTED_RUNTIME';
    return {...x,disposition};
  });
  return {
    adapter:describeAdapter(adapter),
    compatible:result.compatible!==false && !dispositions.some(x=>x.disposition==='UNSUPPORTED_RUNTIME'&&x.blocking!==false),
    requiredBindings:result.requiredBindings||[],
    capabilityDispositions:dispositions,
    blockers:result.blockers||[],
    warnings:result.warnings||[]
  };
}

export const AtlasRuntimeAdapterStandardV1={
  version:'atlas-runtime-adapter-standard-v1',
  requiredOperations:[...REQUIRED_OPERATIONS],
  dispositionVocabulary:[...DISPOSITIONS]
};
