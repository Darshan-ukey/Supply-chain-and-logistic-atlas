import {createRouter} from '../lib/api/_router.js';
import handler0 from '../lib/api/health.js';
import handler1 from '../lib/api/version.js';
import handler2 from '../lib/api/config.js';
import handler3 from '../lib/api/readiness.js';
import handler4 from '../lib/api/pilot-readiness.js';
import handler5 from '../lib/api/release-integrity.js';
import handler6 from '../lib/api/llm-status.js';
export default createRouter('system',{'health':handler0,'version':handler1,'config':handler2,'readiness':handler3,'pilot-readiness':handler4,'release-integrity':handler5,'llm-status':handler6});
