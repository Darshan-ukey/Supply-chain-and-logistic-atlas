/**
 * Simulates Node >= 25 for the whole test suite.
 *
 * Node >= 25 exposes its own built-in `localStorage` global, which is
 * non-functional unless `--localstorage-file` points somewhere valid.
 * vitest's `populateGlobal` skips any key that already exists on the Node
 * global (`getWindowKeys`: `if (k in global) return keysArray.includes(k)`,
 * and `localStorage` is not in that list) and sets `global.window = global`
 * — so under jsdom on Node >= 25 there is NO working web storage at all,
 * neither on the global nor on `window`.
 *
 * Run the suite through this setup (`npm run test:node25`) to prove the
 * engine still behaves correctly there, from any Node version.
 */

const fail = (): never => {
  throw new Error(
    'localStorage is not available (simulated Node >= 25 without --localstorage-file)'
  );
};

const brokenStorage = {
  getItem: fail,
  setItem: fail,
  removeItem: fail,
  clear: fail,
  key: fail,
  get length(): number {
    return fail();
  }
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get: () => brokenStorage
});
