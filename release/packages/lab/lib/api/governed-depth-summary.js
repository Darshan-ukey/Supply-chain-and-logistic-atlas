import {send, err} from './_utils.js';
import {buildGovernedDepthSummary, assertAllowedParameters} from '../projections/governed-depth-summary.js';

// S8-5B: read-only, public-safe, fail-closed. Bounded to the exact governed scope road-ltl@1.5 / LTL-04.
// Does NOT alter execution-depth-projection semantics and is not a generic depth endpoint.
function params(req) {
  const out = {};
  try { for (const [k, v] of new URL(req.url, 'http://atlas.local').searchParams) out[k] = v; } catch { /* fall through */ }
  if (req?.query && typeof req.query === 'object') for (const [k, v] of Object.entries(req.query)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, {ok: false, error: 'Method not allowed'});
    const q = params(req);
    assertAllowedParameters(Object.keys(q));
    const scope = {moduleId: q.moduleId || q.module, moduleVersion: q.moduleVersion || q.version, taskId: q.taskId};
    const summary = buildGovernedDepthSummary(scope);
    return send(res, 200, {ok: true, summary}, {'Cache-Control': 'public, max-age=300, stale-while-revalidate=300', 'X-Atlas-Projection-Class': 'PUBLIC_SAFE'});
  } catch (e) {
    if (e && e.status && e.code) return send(res, e.status, {ok: false, error: e.message, code: e.code});
    err(res, e);
  }
}
