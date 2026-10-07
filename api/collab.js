import {createRouter} from '../lib/api/_router.js';
import handler0 from '../lib/api/collaboration.js';
import handler1 from '../lib/api/telemetry.js';
export default createRouter('collab',{'collaboration':handler0,'telemetry':handler1});
