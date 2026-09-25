/**
 * Runs the whole suite as if it were on Node >= 25, where the built-in
 * `localStorage` global shadows jsdom's and does not work.
 * See test/setup/node25-storage.ts for why that happens.
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: ['./test/setup/node25-storage.ts']
    }
  })
);
