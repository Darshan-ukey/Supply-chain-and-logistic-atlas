import type { AuthConfig, BriskAiTestingConfig } from './types.js';

/**
 * A signed-in session, created once per run and shared by every engine.
 * `headers` go on every API request. `cookies` are installed into the
 * browser for UI tests.
 */
export interface AuthSession {
  readonly kind: 'bearer' | 'login-token' | 'login-cookie';
  readonly headers: Readonly<Record<string, string>>;
  readonly cookies: readonly { readonly name: string; readonly value: string; readonly url: string }[];
}

/** Paths tried, in order, to find a token inside a login response body. */
const COMMON_TOKEN_PATHS = [
  'token', 'accessToken', 'access_token', 'jwt',
  'data.token', 'data.accessToken', 'data.access_token',
  'result.token', 'result.accessToken', 'result.access_token',
];

/**
 * Create the run's session from the configured way of signing in.
 *
 * - `none` needs no session.
 * - `bearer` becomes an authorization header directly.
 * - `credentials` performs a real login: POST the username and password to
 *   the login address, then take the token or cookies from the answer.
 * - `custom` cannot be executed here and fails with a plain explanation.
 *
 * This function either returns a working session or throws a clear error.
 * It never lets a run continue silently signed out.
 */
export async function resolveAuthSession(config: BriskAiTestingConfig): Promise<AuthSession | undefined> {
  const auth = config.auth;
  if (auth.type === 'none') return undefined;
  if (auth.type === 'bearer') {
    return { kind: 'bearer', headers: { authorization: `Bearer ${auth.token}` }, cookies: [] };
  }
  if (auth.type === 'custom') {
    throw new Error('auth.type "custom" only describes a sign-in; it cannot perform one. Use a host createSession function that returns none, bearer, or credentials.');
  }
  return loginWithCredentials(auth, config);
}

async function loginWithCredentials(
  auth: Extract<AuthConfig, { type: 'credentials' }>,
  config: BriskAiTestingConfig,
): Promise<AuthSession> {
  if (auth.loginUrl === undefined || auth.loginUrl.trim().length === 0) {
    throw new Error('Login is configured with a username and password, but auth.loginUrl is missing. Set auth.loginUrl to your application\'s login address, for example /auth/login.');
  }
  const url = new URL(auth.loginUrl, config.app.baseUrl);
  // Many applications sign in with an "email" field. If the username looks
  // like an email address and no field name was chosen, use "email".
  const usernameField = auth.usernameField ?? (auth.username.includes('@') ? 'email' : 'username');
  const passwordField = auth.passwordField ?? 'password';
  const body = JSON.stringify({ [usernameField]: auth.username, [passwordField]: auth.password });
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(Math.min(config.runtime.timeoutMs, 30_000)),
    });
  } catch (error) {
    throw new Error(`Login request to ${url.toString()} could not be sent: ${error instanceof Error ? error.message : String(error)}. Check that the application is running and the login address is right.`);
  }
  const responseText = await response.text();
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`Login at ${url.toString()} was refused with HTTP ${response.status} for field names "${usernameField}"/"${passwordField}". Check the username, password, and login address. If your application uses different field names, set auth.usernameField and auth.passwordField.`);
  }
  const responseJson = parseJsonSafely(responseText);
  const token = findToken(responseJson, auth.tokenPath);
  const cookies = readSessionCookies(response, url);
  if (token !== undefined) {
    return {
      kind: 'login-token',
      headers: { authorization: `Bearer ${token}` },
      cookies,
    };
  }
  if (cookies.length > 0) {
    return {
      kind: 'login-cookie',
      headers: { cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') },
      cookies,
    };
  }
  throw new Error(`Login at ${url.toString()} answered HTTP ${response.status}, but no token was found (tried ${auth.tokenPath !== undefined ? `auth.tokenPath "${auth.tokenPath}"` : COMMON_TOKEN_PATHS.join(', ')}) and no session cookie was set. Set auth.tokenPath to where the token lives in the login answer, for example data.access_token.`);
}

function findToken(json: unknown, explicitPath: string | undefined): string | undefined {
  if (json === undefined) return undefined;
  const paths = explicitPath !== undefined ? [explicitPath] : COMMON_TOKEN_PATHS;
  for (const path of paths) {
    const value = valueAtPath(json, path);
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
}

function valueAtPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function readSessionCookies(response: Response, url: URL): readonly { name: string; value: string; url: string }[] {
  const rawCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  return rawCookies.flatMap((raw) => {
    const pair = raw.split(';')[0];
    const separator = pair?.indexOf('=') ?? -1;
    if (pair === undefined || separator <= 0) return [];
    return [{
      name: pair.slice(0, separator).trim(),
      value: pair.slice(separator + 1).trim(),
      url: url.origin,
    }];
  });
}

function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
