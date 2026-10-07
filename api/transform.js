import {createRouter} from '../lib/api/_router.js';
import handler0 from '../lib/api/transformation-export.js';
import handler1 from '../lib/api/foundation-proposals.js';
export default createRouter('transform',{'transformation-export':handler0,'foundation-proposals':handler1});
