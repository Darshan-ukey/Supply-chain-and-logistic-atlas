import health from '../api/health.js';
import session from '../api/auth-session.js';
import workspaces from '../api/workspaces.js';
import state from '../api/client-state.js';
import evidence from '../api/evidence-upload.js';
import login from '../api/auth-login.js';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test-only';
function req(method='GET',query={}){return {method,query,headers:{},body:undefined,async *[Symbol.asyncIterator](){}}}
function res(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.payload=v?JSON.parse(v):null}}}
async function run(name,fn,r,expected){const s=res();await fn(r,s);if(s.statusCode!==expected)throw new Error(`${name}: expected ${expected}, got ${s.statusCode}`);return s.payload}
const results={};
results.health=await run('health',health,req('GET'),200);
results.session=await run('session',session,req('GET'),200);
results.workspacesUnauth=await run('workspaces',workspaces,req('GET'),401);
results.stateUnauth=await run('state',state,req('GET',{workspaceId:'x'}),401);
results.evidenceUnauth=await run('evidence',evidence,req('POST'),401);
results.loginMethodGuard=await run('loginMethod',login,req('GET'),405);
if(results.session.authenticated!==false)throw new Error('Unauthenticated session incorrectly authenticated');
console.log(JSON.stringify({ok:true,results},null,2));
