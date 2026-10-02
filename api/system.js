import {createRouter} from '../lib/api/_router.js';
import health from '../lib/api/health.js';
import version from '../lib/api/version.js';
import config from '../lib/api/config.js';
import readiness from '../lib/api/readiness.js';
import pilotReadiness from '../lib/api/pilot-readiness.js';
import releaseIntegrity from '../lib/api/release-integrity.js';
import llmStatus from '../lib/api/llm-status.js';

// Static imports are intentional: Vercel's function bundler must be able to
// discover every handler dependency. Passing callable handlers also avoids
// runtime module-resolution failures from dynamically constructed imports.
export default createRouter('system',{
  'health':health,
  'version':version,
  'config':config,
  'readiness':readiness,
  'pilot-readiness':pilotReadiness,
  'release-integrity':releaseIntegrity,
  'llm-status':llmStatus
});
