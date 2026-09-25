import {requireUser,supabase,send,body,err} from './_utils.js';

const TYPES=new Set(['PROCESS','FINDING','OPPORTUNITY','FUTURE_STATE','COLLECTION','DOCUMENT','CANDIDATE_FACT','WORKSPACE']);
const REVIEW_TYPES=new Set(['VALIDATION','EVIDENCE','REVIEW']);
const COMMENT_STATUS=new Set(['OPEN','RESOLVED']);
const REVIEW_STATUS=new Set(['OPEN','COMPLETED','CANCELLED']);
const enc=x=>encodeURIComponent(String(x));
const cleanText=(x,max=4000)=>String(x??'').trim().slice(0,max);
function entity(input){const type=String(input.entityType||'').toUpperCase(),key=cleanText(input.entityKey,240);if(!TYPES.has(type)||!key){const e=new Error('A valid entityType and entityKey are required');e.status=400;throw e}return {type,key}}

async function fetchMembers(token,workspaceId){const q=`/rest/v1/atlas_workspace_members?workspace_id=eq.${enc(workspaceId)}&select=user_id,role,created_at&order=created_at.asc`;return (await supabase(q,{token})).data||[]}
async function fetchEntity(token,workspaceId,type,key){const base=`workspace_id=eq.${enc(workspaceId)}&entity_type=eq.${enc(type)}&entity_key=eq.${enc(key)}`;
 const comments=(await supabase(`/rest/v1/atlas_collaboration_comments?${base}&select=id,entity_type,entity_key,body,status,evidence_ref,created_by,resolved_by,resolved_at,created_at,updated_at&order=created_at.asc`,{token})).data||[];
 const reviews=(await supabase(`/rest/v1/atlas_review_requests?${base}&select=id,entity_type,entity_key,request_type,status,message,requested_by,assigned_to,resolution_note,completed_by,completed_at,created_at,updated_at&order=created_at.desc`,{token})).data||[];
 return {comments,reviews};
}
async function fetchOpen(token,workspaceId){return (await supabase(`/rest/v1/atlas_review_requests?workspace_id=eq.${enc(workspaceId)}&status=eq.OPEN&select=id,entity_type,entity_key,request_type,status,message,requested_by,assigned_to,created_at,updated_at&order=created_at.desc&limit=100`,{token})).data||[]}

export default async function handler(req,res){
 try{
  const {token,user}=await requireUser(req);
  if(req.method==='GET'){
   const workspaceId=String(req.query?.workspaceId||'');if(!workspaceId){const e=new Error('workspaceId is required');e.status=400;throw e}
   const mode=String(req.query?.mode||'entity');
   if(mode==='open'){const [reviews,members]=await Promise.all([fetchOpen(token,workspaceId),fetchMembers(token,workspaceId)]);return send(res,200,{ok:true,reviews,members,userId:user.id})}
   const {type,key}=entity({entityType:req.query?.entityType,entityKey:req.query?.entityKey});
   const [{comments,reviews},members]=await Promise.all([fetchEntity(token,workspaceId,type,key),fetchMembers(token,workspaceId)]);
   return send(res,200,{ok:true,comments,reviews,members,userId:user.id});
  }
  const b=await body(req),workspaceId=String(b.workspaceId||'');if(!workspaceId){const e=new Error('workspaceId is required');e.status=400;throw e}
  if(req.method==='POST'){
   const {type,key}=entity(b),kind=String(b.kind||'COMMENT').toUpperCase();
   if(kind==='COMMENT'){
    const text=cleanText(b.body);if(!text){const e=new Error('Comment body is required');e.status=400;throw e}
    const row={workspace_id:workspaceId,entity_type:type,entity_key:key,body:text,status:'OPEN',evidence_ref:cleanText(b.evidenceRef,240)||null,created_by:user.id};
    const r=await supabase('/rest/v1/atlas_collaboration_comments',{method:'POST',token,headers:{Prefer:'return=representation'},data:row});return send(res,201,{ok:true,comment:r.data?.[0]||null});
   }
   if(kind==='REVIEW'){
    const requestType=String(b.requestType||'VALIDATION').toUpperCase(),message=cleanText(b.message);if(!REVIEW_TYPES.has(requestType)||!message){const e=new Error('Valid requestType and message are required');e.status=400;throw e}
    const row={workspace_id:workspaceId,entity_type:type,entity_key:key,request_type:requestType,status:'OPEN',message,requested_by:user.id,assigned_to:b.assignedTo||null};
    const r=await supabase('/rest/v1/atlas_review_requests',{method:'POST',token,headers:{Prefer:'return=representation'},data:row});return send(res,201,{ok:true,review:r.data?.[0]||null});
   }
   const e=new Error('Unsupported collaboration kind');e.status=400;throw e;
  }
  if(req.method==='PATCH'){
   const kind=String(b.kind||'').toUpperCase(),id=String(b.id||'');if(!id){const e=new Error('id is required');e.status=400;throw e}
   if(kind==='COMMENT'){
    const patch={};if(b.status!==undefined){const s=String(b.status).toUpperCase();if(!COMMENT_STATUS.has(s)){const e=new Error('Invalid comment status');e.status=400;throw e}patch.status=s;if(s==='RESOLVED'){patch.resolved_by=user.id;patch.resolved_at=new Date().toISOString()}else{patch.resolved_by=null;patch.resolved_at=null}}
    if(b.body!==undefined){const text=cleanText(b.body);if(!text){const e=new Error('Comment body cannot be empty');e.status=400;throw e}patch.body=text}
    const r=await supabase(`/rest/v1/atlas_collaboration_comments?id=eq.${enc(id)}&workspace_id=eq.${enc(workspaceId)}`,{method:'PATCH',token,headers:{Prefer:'return=representation'},data:patch});return send(res,200,{ok:true,comment:r.data?.[0]||null});
   }
   if(kind==='REVIEW'){
    const patch={};if(b.status!==undefined){const s=String(b.status).toUpperCase();if(!REVIEW_STATUS.has(s)){const e=new Error('Invalid review status');e.status=400;throw e}patch.status=s;if(s==='COMPLETED'){patch.completed_by=user.id;patch.completed_at=new Date().toISOString()}else if(s==='OPEN'){patch.completed_by=null;patch.completed_at=null}}
    if(b.resolutionNote!==undefined)patch.resolution_note=cleanText(b.resolutionNote)||null;if(b.assignedTo!==undefined)patch.assigned_to=b.assignedTo||null;if(patch.status==='COMPLETED'&&!patch.resolution_note){const e=new Error('resolutionNote is required to complete a review');e.status=400;throw e}
    const r=await supabase(`/rest/v1/atlas_review_requests?id=eq.${enc(id)}&workspace_id=eq.${enc(workspaceId)}`,{method:'PATCH',token,headers:{Prefer:'return=representation'},data:patch});return send(res,200,{ok:true,review:r.data?.[0]||null});
   }
   const e=new Error('Unsupported collaboration kind');e.status=400;throw e;
  }
  return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 }catch(e){return err(res,e)}
}
