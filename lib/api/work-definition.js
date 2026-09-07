import zlib from 'node:zlib';
import {requireCapabilities,supabaseService,send,err} from './_utils.js';

// P6.2 protected Canonical WorkDefinition resolver.
// Exact module/version/task tuple required. Aggregate containers are storage only and
// are never returned. Unknown, ambiguous, wrong-version and lineage-mismatched requests fail closed.

const text=v=>String(v??'').trim();
const enc=v=>encodeURIComponent(text(v));
const protectedHeaders={'Cache-Control':'private, no-store, max-age=0','X-Atlas-Projection-Class':'EXECUTION_PROTECTED'};
const aggregateIdPattern=/^__ALL(?:_\d+)?__$/;

export function decodeDefinitionPayload(row){
  const encoding=text(row?.payload_encoding).toUpperCase();
  if(encoding==='GZIP_BASE64'||encoding==='BROTLI_BASE64'){
    if(!row?.payload_compressed_base64)throw Object.assign(new Error('Protected WorkDefinition compressed payload is missing'),{status:500});
    const buffer=Buffer.from(row.payload_compressed_base64,'base64');
    const decoded=encoding==='BROTLI_BASE64'?zlib.brotliDecompressSync(buffer):zlib.gunzipSync(buffer);
    return JSON.parse(decoded.toString('utf8'));
  }
  if(row?.payload)return row.payload;
  throw Object.assign(new Error('Protected WorkDefinition payload is missing or uses an unsupported encoding'),{status:500});
}

/**
 * Reduce a stored payload to exactly the requested task's WorkDefinition set.
 * Accepts a single-task package or an aggregate keyed/arrayed by task.
 */
export function selectExactWorkDefinitions(payload,{moduleId,moduleVersion,taskId}){
  const packages=[];
  if(payload&&typeof payload==='object'&&!Array.isArray(payload)){
    if(payload.sourceTaskId)packages.push(payload);
    else if(Array.isArray(payload.tasks))packages.push(...payload.tasks);
    else if(payload.tasks&&typeof payload.tasks==='object')packages.push(...Object.values(payload.tasks));
  }
  const matches=packages.filter(p=>p
    &&String(p.moduleId)===moduleId
    &&String(p.moduleVersion)===moduleVersion
    &&String(p.sourceTaskId)===taskId);

  if(matches.length!==1){
    throw Object.assign(new Error(matches.length===0
      ?`Protected WorkDefinition is not materialized for exact tuple ${moduleId}@${moduleVersion}/${taskId}. No alternate version was substituted.`
      :'Protected WorkDefinition aggregate returned an ambiguous exact-task match; request failed closed.'),{status:matches.length===0?404:500});
  }

  const pkg=matches[0];
  const definitions=Array.isArray(pkg.definitions)?pkg.definitions:[];
  for(const definition of definitions){
    const lineage=definition?.lineage||{};
    if(String(lineage.daughterModule)!==moduleId||String(lineage.daughterVersion)!==moduleVersion||String(lineage.sourceTaskId)!==taskId){
      throw Object.assign(new Error('Protected WorkDefinition lineage does not match the requested tuple; request failed closed.'),{status:500});
    }
    if(definition?.executability?.status!=='EXECUTOR_READY'){
      throw Object.assign(new Error('Protected WorkDefinition store returned non-executable work; request failed closed.'),{status:500});
    }
  }
  return pkg;
}

async function loadStoredRow({moduleId,moduleVersion,taskId}){
  const select='work_definition_id,module_id,module_version,source_task_id,contract_version,definition_version,semantic_source_version,status,payload,payload_encoding,payload_compressed_base64,content_hash,governed_input_content_hash,compiler_version';
  const base=`/rest/v1/atlas_work_definitions?module_id=eq.${enc(moduleId)}&module_version=eq.${enc(moduleVersion)}&contract_version=eq.1.0.0&status=in.(VALIDATED_REFERENCE_DEFINITION,APPROVED,ACTIVE)&select=${select}`;

  const exact=((await supabaseService(`${base}&source_task_id=eq.${enc(taskId)}&limit=2`)).data||[]);
  if(exact.length>1)throw Object.assign(new Error('Protected WorkDefinition store returned duplicate exact tuples; request failed closed.'),{status:500});
  if(exact.length===1)return exact[0];

  // Aggregate rows are storage containers only. They are never returned as API payloads.
  const aggregate=((await supabaseService(`${base}&source_task_id=like.__ALL*__&limit=3`)).data||[]).filter(r=>aggregateIdPattern.test(text(r?.source_task_id)));
  if(aggregate.length>1)throw Object.assign(new Error('Protected WorkDefinition store returned multiple aggregate containers for the exact module/version; request failed closed.'),{status:500});
  return aggregate[0]||null;
}

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const {user}=await requireCapabilities(req,'atlas.workdefinition.full.read');
    const moduleId=text(req.query?.moduleId);
    const moduleVersion=text(req.query?.moduleVersion);
    const taskId=text(req.query?.taskId);
    if(!moduleId||!moduleVersion||!taskId){
      return send(res,400,{ok:false,error:'Exact moduleId, moduleVersion and taskId are required. No Daughter version/task substitution is permitted.'},protectedHeaders);
    }

    const row=await loadStoredRow({moduleId,moduleVersion,taskId});
    if(!row)return send(res,404,{ok:false,error:`Protected WorkDefinition is not materialized for exact tuple ${moduleId}@${moduleVersion}/${taskId}. No alternate version was substituted.`},protectedHeaders);
    if(row.module_id!==moduleId||String(row.module_version)!==moduleVersion){
      return send(res,500,{ok:false,error:'Protected WorkDefinition store returned a module/version mismatch; request failed closed.'},protectedHeaders);
    }
    if(row.source_task_id!==taskId&&!aggregateIdPattern.test(text(row.source_task_id))){
      return send(res,500,{ok:false,error:'Protected WorkDefinition store returned an invalid storage tuple; request failed closed.'},protectedHeaders);
    }

    const storedPayload=decodeDefinitionPayload(row);
    if(storedPayload?.moduleId&&String(storedPayload.moduleId)!==moduleId){
      return send(res,500,{ok:false,error:'Protected WorkDefinition aggregate module lineage does not match the request; request failed closed.'},protectedHeaders);
    }
    if(storedPayload?.moduleVersion&&String(storedPayload.moduleVersion)!==moduleVersion){
      return send(res,500,{ok:false,error:'Protected WorkDefinition aggregate version lineage does not match the request; request failed closed.'},protectedHeaders);
    }

    const pkg=selectExactWorkDefinitions(storedPayload,{moduleId,moduleVersion,taskId});

    return send(res,200,{
      ok:true,
      projectionClass:'EXECUTION_PROTECTED',
      actor:{id:user.id,email:user.email},
      trace:{
        moduleId,
        moduleVersion,
        taskId,
        semanticSourceVersion:pkg.semanticSourceVersion||row.semantic_source_version,
        contractVersion:row.contract_version,
        definitionVersion:row.definition_version,
        storageWorkDefinitionId:row.work_definition_id,
        contentHash:row.content_hash,
        governedInputContentHash:row.governed_input_content_hash,
        compilerVersion:row.compiler_version,
        compiledFrom:'CANONICAL_WORK_DECOMPOSITION_V1'
      },
      workDefinitions:pkg.definitions||[],
      coverage:pkg.coverage||null,
      protection:'atlas.workdefinition.full.read'
    },protectedHeaders);
  }catch(e){err(res,e)}
}
