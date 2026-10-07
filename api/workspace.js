import {createRouter} from '../lib/api/_router.js';
import handler0 from '../lib/api/workspaces.js';
import handler1 from '../lib/api/client-state.js';
import handler2 from '../lib/api/saved-views.js';
import handler3 from '../lib/api/audit.js';
export default createRouter('workspace',{'workspaces':handler0,'client-state':handler1,'saved-views':handler2,'audit':handler3});
