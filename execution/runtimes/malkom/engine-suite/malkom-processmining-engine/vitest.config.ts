import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    // DuckDB-backed tests write real files to a temp dir and are slower than
    // a pure-unit suite; the default 5s timeout trips on first instance boot.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
