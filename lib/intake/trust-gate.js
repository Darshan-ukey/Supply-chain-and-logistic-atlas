import {isAtlasNativeQuery} from '../atlas/canonical.js';
const INJECTION=/(ignore (all|previous) instructions|system prompt|developer message|jailbreak|override guardrail|reveal secrets|exfiltrat|delete atlas|modify frozen|patch atlas|rewrite atlas)/i;
const GARBAGE=/^(?:[\W_]|lol|test|asdf|qwerty|random|garbage){1,80}$/i;
const DOMAIN=/(shipment|freight|ltl|carrier|claim|invoice|billing|pickup|delivery|pod|terminal|linehaul|rate|rating|tms|wms|erp|customs|logistics|transport|warehouse|consignee|shipper|process|system|control|exception|sop|rfp|rfi|atlas|movement|role|node|jurisdiction|regime|condition|lens|source|authority|backbone|taxonomy|ontology|trace|lineage|scenario|digital twin|operating model|page|section|handoff|data|risk|simulation|simulate|next|pause|play)/i;
const QUERY_LANGUAGE=/(what|why|who|where|when|how|explain|show|trace|track|compare|play|pause|next|previous|simulate|summar|define|meaning|help|open)/i;

export function assessQuery({text='',clientName='',atlasContext={}}){
  const t=String(text||'').trim();if(!t)return {decision:'REJECT',score:0,reasons:['Empty query.'],gate:'QUERY'};
  if(INJECTION.test(t))return {decision:'REJECT',score:0,reasons:['Prompt-injection or Atlas-mutation language detected.'],gate:'QUERY'};
  if(GARBAGE.test(t)&&!isAtlasNativeQuery(t,atlasContext))return {decision:'REJECT',score:.1,reasons:['Low-information query.'],gate:'QUERY'};
  const hasUiContext=!!(atlasContext?.page||atlasContext?.lastSelection||atlasContext?.simulationContext||atlasContext?.visibleHeadings?.length);
  const relevant=DOMAIN.test(t)||QUERY_LANGUAGE.test(t)||isAtlasNativeQuery(t,atlasContext)||hasUiContext||(clientName&&new RegExp(clientName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(t));
  return {decision:'ACCEPT',score:relevant?.98:.75,reasons:[relevant?'Safe explanatory/navigation query accepted.':'Safe query accepted; Atlas retrieval may return insufficient evidence.'],gate:'QUERY'};
}

export function assessEvidence({text='',fileName='',clientName='',atlasContext={}}){
  const t=String(text||'').trim(),reasons=[];if(!t)return {decision:'REJECT',score:0,reasons:['Empty content.'],gate:'EVIDENCE'};
  if(t.length<4||GARBAGE.test(t))reasons.push('Content is too short or low-information.');
  if(INJECTION.test(t))reasons.push('Prompt-injection or Atlas-mutation language detected.');
  const relevant=DOMAIN.test(t)||isAtlasNativeQuery(t,atlasContext)||(clientName&&new RegExp(clientName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(t));
  if(!relevant)reasons.push('No clear Atlas/logistics/client-operating-model relevance detected.');
  if(INJECTION.test(t))return {decision:'REJECT',score:0,reasons,gate:'EVIDENCE'};
  if(reasons.length>=2)return {decision:'REJECT',score:.15,reasons,gate:'EVIDENCE'};
  if(reasons.length===1)return {decision:'QUARANTINE',score:.45,reasons,gate:'EVIDENCE'};
  return {decision:'ACCEPT',score:.95,reasons:['Relevant Atlas/domain evidence detected.'],gate:'EVIDENCE'};
}

// Backward-compatible name for document/evidence intake.
export const assessInput=assessEvidence;
