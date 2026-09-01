import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@malkom/table-core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    // No storage patching here on purpose: the suite must pass against the
    // web storage a host actually has, including the broken built-in on
    // Node >= 25. `npm run test:node25` simulates that case deliberately.
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx']
  }
});
