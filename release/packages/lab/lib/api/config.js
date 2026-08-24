import {send} from './_utils.js';
import {providerStatus} from './_llm.js';
function yes(name,def=false){const v=process.env[name];if(v==null)return def;return String(v).toLowerCase()==='true'}
export default async function handler(req,res){
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  const ephemeral=yes('ATLAS_EPHEMERAL_DOCUMENTS',true),ephemeralLlm=yes('ATLAS_EPHEMERAL_DOCUMENT_LLM',true),llmRequired=yes('ATLAS_EPHEMERAL_DOCUMENT_REQUIRE_LLM',true),providerApproved=yes('ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED',false),llm=providerStatus();
  send(res,200,{ok:true,stage:'22.2',persistence:'supabase',auth:'httpOnly-cookie',clientEvidence:ephemeral?'request-scoped-ephemeral-documents':'tenant-isolated-private-storage',pilot:{ephemeralDocuments:ephemeral,externalLlmForEphemeralDocuments:ephemeralLlm,llmRequiredForEphemeralDocuments:llmRequired,providerApproved,allowedProviders:String(process.env.ATLAS_EPHEMERAL_DOCUMENT_ALLOWED_PROVIDERS||'gemini').split(',').map(x=>x.trim()).filter(Boolean),sourcePersistence:ephemeral?'NONE':'PRIVATE_WORKSPACE',foundationMutation:'admin-governed-publication-only',pilotWorkspaceRole:'EDITOR',viewerWrite:false},askAtlas:{retrieval:'server-side governed evidence',commandValidation:'deterministic',llm}});
}
