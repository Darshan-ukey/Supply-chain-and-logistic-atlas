'use strict';
const routes={
  'release-integrity':require('../server/api/release-integrity'),
  'config':require('../server/api/config'),
  'telemetry':require('../server/api/telemetry'),
  'session-fact-confirm':require('../server/api/session-fact-confirm'),
  'document-facts':require('../server/api/session-fact-confirm'),
  'client-state':require('../server/api/client-state'),
  'workspaces':require('../server/api/workspaces'),
  'readiness':require('../server/api/readiness'),
  'saved-views':require('../server/api/saved-views'),
  'session-document-ingest':require('../server/api/session-document-ingest'),
  'document-ingest':require('../server/api/session-document-ingest'),
  'transformation-export':require('../server/api/transformation-export'),
  'auth-login':require('../server/api/auth-login'),
  'health':require('../server/api/health'),
  'pilot-evaluation':require('../server/api/pilot-evaluation'),
  'version':require('../server/api/version'),
  'llm-status':require('../server/api/llm-status'),
  'collaboration':require('../server/api/collaboration'),
  'command-validate':require('../server/api/command-validate'),
  'audit':require('../server/api/audit'),
  'auth-signup':require('../server/api/auth-signup'),
  'pilot-readiness':require('../server/api/pilot-readiness'),
  'evidence-upload':require('../server/api/evidence-upload'),
  'documents':require('../server/api/documents'),
  'auth-logout':require('../server/api/auth-logout'),
  'ask-atlas':require('../server/api/ask-atlas'),
  'auth-session':require('../server/api/auth-session'),
  'foundation-proposals':require('../server/api/foundation-proposals')
};
module.exports=async(req,res)=>{
  const raw=req.query&&req.query.__atlasRoute;
  const route=Array.isArray(raw)?raw[0]:String(raw||'');
  const handler=routes[route];
  if(!handler){res.statusCode=404;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:'Unknown API route'}))}
  return handler(req,res);
};
module.exports.routes=routes;
