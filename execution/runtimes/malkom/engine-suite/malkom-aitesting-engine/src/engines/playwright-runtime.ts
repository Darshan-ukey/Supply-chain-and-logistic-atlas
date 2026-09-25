import { createRequire } from 'node:module';

/**
 * The browser is started once and reused by every page check in a run.
 * Starting a fresh browser per check costs about three seconds each, which
 * is pure waiting: it tests nothing and pushes checks against their deadline.
 */
export interface SharedBrowser {
  readonly launchMs: number;
  newContext(options: Record<string, unknown>): Promise<BrowserContextLike>;
  close(): Promise<void>;
}

export interface BrowserContextLike {
  newPage(): Promise<PageLike>;
  addCookies(cookies: readonly { name: string; value: string; url: string }[]): Promise<void>;
  close(): Promise<void>;
  readonly tracing: {
    start(options: Record<string, unknown>): Promise<void>;
    stop(options: { path: string }): Promise<void>;
  };
}

export interface PageLike {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(source: string | ((argument: unknown) => T), argument?: unknown): Promise<T>;
  waitForFunction(source: string, argument?: unknown, options?: { timeout?: number }): Promise<unknown>;
  screenshot(options: { path: string; fullPage?: boolean }): Promise<unknown>;
  locator(selector: string): LocatorLike;
  getByRole(role: string, options?: { name?: string; exact?: boolean }): LocatorLike;
  getByLabel(text: string, options?: { exact?: boolean }): LocatorLike;
  getByTestId(value: string): LocatorLike;
  getByText(text: string, options?: { exact?: boolean }): LocatorLike;
  close(): Promise<void>;
}

export interface LocatorLike {
  first(): LocatorLike;
  waitFor(options: { state?: string; timeout?: number }): Promise<void>;
  isVisible(): Promise<boolean>;
  innerText(): Promise<string>;
  fill(value: string): Promise<void>;
  click(): Promise<void>;
  check(): Promise<void>;
  selectOption(value: string): Promise<void>;
  press(key: string): Promise<void>;
  textContent(): Promise<string | null>;
}

/**
 * Launch options every browser start in the engine uses. A configured
 * executable path (runtime.browserExecutablePath, or the
 * BRISK_AITESTING_BROWSER_EXECUTABLE_PATH environment variable as a
 * last-resort fallback) points Playwright at a system-installed browser for
 * hosts where downloading one is impossible or forbidden.
 */
export function browserLaunchOptions(params: {
  readonly headless: boolean;
  readonly executablePath?: string;
}): Record<string, unknown> {
  const executablePath = params.executablePath ?? process.env.BRISK_AITESTING_BROWSER_EXECUTABLE_PATH;
  return {
    headless: params.headless,
    ...(executablePath !== undefined && executablePath.trim().length > 0 ? { executablePath: executablePath.trim() } : {}),
  };
}

/**
 * Load Playwright's browser library from whichever copy is installed. The
 * package is an optional peer, so a clear message beats a raw module error.
 */
export function loadChromium(): { launch(options: Record<string, unknown>): Promise<SharedBrowser> } {
  const require = createRequire(import.meta.url);
  for (const candidate of ['@playwright/test', 'playwright', 'playwright-core']) {
    try {
      const loaded = require(candidate) as { chromium?: { launch(options: Record<string, unknown>): Promise<SharedBrowser> } };
      if (loaded.chromium !== undefined) return loaded.chromium;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error('Playwright is required for page checks. Install @playwright/test and run "npx playwright install chromium".');
}
