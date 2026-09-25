import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@malkom/miniemail-core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'jsdom',
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx']
  }
});
