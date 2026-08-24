import {createRouter} from '../lib/api/_router.js';
export default createRouter('system',{'health':'./health.js','version':'./version.js','config':'./config.js','readiness':'./readiness.js','pilot-readiness':'./pilot-readiness.js','release-integrity':'./release-integrity.js','llm-status':'./llm-status.js'});
