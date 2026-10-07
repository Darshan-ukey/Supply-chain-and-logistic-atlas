import {createRouter} from '../lib/api/_router.js';
import handler0 from '../lib/api/auth-login.js';
import handler1 from '../lib/api/auth-logout.js';
import handler2 from '../lib/api/auth-session.js';
import handler3 from '../lib/api/auth-signup.js';
import handler4 from '../lib/api/auth-admin-login.js';
import handler5 from '../lib/api/auth-admin-session.js';
import handler6 from '../lib/api/auth-admin-logout.js';
export default createRouter('auth',{'auth-login':handler0,'auth-logout':handler1,'auth-session':handler2,'auth-signup':handler3,'auth-admin-login':handler4,'auth-admin-session':handler5,'auth-admin-logout':handler6});
