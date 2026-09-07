import zlib from 'node:zlib';
import {requireCapabilities,supabaseService,send,err} from './_utils.js';

const text=v=>String(v??'').trim();
const enc=v=>encodeURIComponent(text(v));
const protectedHeaders={'Cache-Control':'private, no-store, max-age=0','X-Atlas-Projection-Class':'EXECUTION_PROTECTED'};
const aggregateIdPattern=/^__ALL(?:_\d+)?__$/;

export function decodePayload(row){
  const encoding=text(row?.payload_encoding).toUpperCase();
  if(encoding==='GZIP_BASE64'||encoding==='BROTLI_BASE64'){
    if(!row?.payload_compressed_base64)throw Object.assign(new Error('Protected Work Decomposition compressed payload is missing'),{status:500});
    const buffer=Buffer.from(row.payload_compressed_base64,'base64');
    const decoded=encoding==='BROTLI_BASE64'?zlib.brotliDecompressSync(buffer):zlib.gunzipSync(buffer);
    return JSON.parse(decoded.toString('utf8'));
  }
  if(row?.payload)return row.payload;
  throw Object.assign(new Error('Protected Work Decomposition payload is missing or uses an unsupported encoding'),{status:500});
}

export function selectExactDecomposition(payload,{moduleId,moduleVersion,taskId}){
  const direct=payload&&typeof payload==='object'&&!Array.isArray(payload)&&payload.sourceTaskId?payload:null;
  let candidates=[];
  if(direct)candidates=[direct];
  else if(Array.isArray(payload?.decompositions))candidates=payload.decompositions;
  else if(payload?.decompositions&&typeof payload.decompositions==='object')candidates=Object.values(payload.decompositions);
  const matches=candidates.filter(d=>d&&d.daughterModule===moduleId&&String(d.daughterVersion)===moduleVersion&&d.sourceTaskId===taskId);
  if(matches.length!==1){
    throw Object.assign(new Error(matches.length===0
      ?`Protected Work Decomposition is not materialized for exact tuple ${moduleId}@${moduleVersion}/${taskId}. No alternate version was substituted.`
      :'Protected Work Decomposition aggregate returned an ambiguous exact-task match; request failed closed.'),{status:matches.length===0?404:500});
  }
  return matches[0];
}

async function loadStoredRow({moduleId,moduleVersion,taskId}){
  const select='decomposition_id,module_id,module_version,source_task_id,contract_version,semantic_source_version,status,payload,payload_encoding,payload_compressed_base64,content_hash';
  const base=`/rest/v1/atlas_work_decompositions?module_id=eq.${enc(moduleId)}&module_version=eq.${enc(moduleVersion)}&contract_version=eq.1.0.0&status=in.(VALIDATED_REFERENCE_DECOMPOSITION,APPROVED,ACTIVE)&select=${select}`;
  const exact=((await supabaseService(`${base}&source_task_id=eq.${enc(taskId)}&limit=2`)).data||[]);
  if(exact.length>1)throw Object.assign(new Error('Protected Work Decomposition store returned duplicate exact tuples; request failed closed.'),{status:500});
  if(exact.length===1)return exact[0];

  // Aggregate rows are storage containers only. They are never returned as API payloads.
  const aggregate=((await supabaseService(`${base}&source_task_id=like.__ALL*__&limit=3`)).data||[]).filter(r=>aggregateIdPattern.test(text(r?.source_task_id)));
  if(aggregate.length>1)throw Object.assign(new Error('Protected Work Decomposition store returned multiple aggregate containers for the exact module/version; request failed closed.'),{status:500});
  return aggregate[0]||null;
}

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const {user}=await requireCapabilities(req,'atlas.work_decomposition.full.read');
    const moduleId=text(req.query?.moduleId);
    const moduleVersion=text(req.query?.moduleVersion);
    const taskId=text(req.query?.taskId);
    if(!moduleId||!moduleVersion||!taskId){
      return send(res,400,{ok:false,error:'Exact moduleId, moduleVersion and taskId are required. No Daughter version/task substitution is permitted.'},protectedHeaders);
    }

    const row=await loadStoredRow({moduleId,moduleVersion,taskId});
    if(!row)return send(res,404,{ok:false,error:`Protected Work Decomposition is not materialized for exact tuple ${moduleId}@${moduleVersion}/${taskId}. No alternate version was substituted.`},protectedHeaders);
    if(row.module_id!==moduleId||String(row.module_version)!==moduleVersion){
      return send(res,500,{ok:false,error:'Protected Work Decomposition store returned a module/version mismatch; request failed closed.'},protectedHeaders);
    }
    if(row.source_task_id!==taskId&&!aggregateIdPattern.test(text(row.source_task_id))){
      return send(res,500,{ok:false,error:'Protected Work Decomposition store returned an invalid storage tuple; request failed closed.'},protectedHeaders);
    }

    const storedPayload=decodePayload(row);
    if(storedPayload?.moduleId&&storedPayload.moduleId!==moduleId){
      return send(res,500,{ok:false,error:'Protected Work Decomposition aggregate module lineage does not match the request; request failed closed.'},protectedHeaders);
    }
    if(storedPayload?.moduleVersion&&String(storedPayload.moduleVersion)!==moduleVersion){
      return send(res,500,{ok:false,error:'Protected Work Decomposition aggregate version lineage does not match the request; request failed closed.'},protectedHeaders);
    }
    const decomposition=selectExactDecomposition(storedPayload,{moduleId,moduleVersion,taskId});

    return send(res,200,{
      ok:true,
      projectionClass:'EXECUTION_PROTECTED',
      actor:{id:user.id,email:user.email},
      trace:{
        moduleId,
        moduleVersion,
        taskId,
        semanticSourceVersion:row.semantic_source_version,
        contractVersion:row.contract_version,
        decompositionId:decomposition.decompositionId,
        storageDecompositionId:row.decomposition_id,
        contentHash:row.content_hash
      },
      decomposition,
      protection:'atlas.work_decomposition.full.read'
    },protectedHeaders);
  }catch(e){err(res,e)}
}
