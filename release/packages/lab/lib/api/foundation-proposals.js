import crypto from 'node:crypto';
import {body,send,supabase,requireUser,err} from './_utils.js';
const TYPES=new Set(['COMPONENT','OVERLAY','RELATIONSHIP','RULE','SOURCE','MODULE','OTHER']);
const REVIEW=new Set(['APPROVED_FOR_RESEARCH','APPROVED_FOR_PUBLICATION_GATE','REJECTED']);
export default async function handler(req,res){
 try{
  const {token,user}=await requireUser(req);
  if(req.method==='GET'){
   const wid=String(req.query?.workspaceId||'');if(!wid)return send(res,400,{ok:false,error:'workspaceId is required'});
   const q=`/rest/v1/atlas_foundation_change_proposals?workspace_id=eq.${encodeURIComponent(wid)}&select=id,proposal_key,proposal_type,target_id,summary,rationale,evidence,status,proposed_by,reviewed_by,review_note,reviewed_at,created_at,updated_at&order=created_at.desc&limit=200`;
   return send(res,200,{ok:true,proposals:(await supabase(q,{token})).data||[]});
  }
  if(req.method==='POST'){
   const b=await body(req),wid=String(b.workspaceId||''),type=String(b.proposalType||'OTHER').toUpperCase(),summary=String(b.summary||'').trim();
   if(!wid||!summary)return send(res,400,{ok:false,error:'workspaceId and summary are required'});if(!TYPES.has(type))return send(res,400,{ok:false,error:'Invalid proposal type'});
   const row={workspace_id:wid,proposal_key:`FP-${Date.now()}-${crypto.randomUUID().slice(0,8)}`,proposal_type:type,target_id:String(b.targetId||'').slice(0,180)||null,summary:summary.slice(0,1200),rationale:String(b.rationale||'').slice(0,4000)||null,evidence:b.evidence&&typeof b.evidence==='object'?b.evidence:{},status:'PENDING_ADMIN_REVIEW',proposed_by:user.id};
   const data=(await supabase('/rest/v1/atlas_foundation_change_proposals',{method:'POST',token,headers:{Prefer:'return=representation'},data:row})).data?.[0];return send(res,201,{ok:true,proposal:data,guardrail:'This is a proposal only. It cannot mutate the canonical Atlas. Admin approval still enters the existing publication gates.'});
  }
  if(req.method==='PATCH'){
   const b=await body(req),wid=String(b.workspaceId||''),id=String(b.proposalId||''),status=String(b.status||'');if(!wid||!id||!REVIEW.has(status))return send(res,400,{ok:false,error:'workspaceId, proposalId and a valid review status are required'});
   const patch={status,reviewed_by:user.id,reviewed_at:new Date().toISOString(),review_note:String(b.reviewNote||'').slice(0,4000)};
   const data=(await supabase(`/rest/v1/atlas_foundation_change_proposals?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(wid)}`,{method:'PATCH',token,headers:{Prefer:'return=representation'},data:patch})).data?.[0];if(!data)return send(res,404,{ok:false,error:'Proposal not found or admin permission required'});return send(res,200,{ok:true,proposal:data,publicationOccurred:false,guardrail:'Approval authorizes research/publication-gate review only. It does not directly edit canonical Atlas files.'});
  }
  return send(res,405,{ok:false,error:'Method not allowed'});
 }catch(e){err(res,e)}
}
