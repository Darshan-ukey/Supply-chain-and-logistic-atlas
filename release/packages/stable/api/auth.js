import {createRouter} from '../lib/api/_router.js';
export default createRouter('auth',{'auth-login':'./auth-login.js','auth-logout':'./auth-logout.js','auth-session':'./auth-session.js','auth-signup':'./auth-signup.js'});
