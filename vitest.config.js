import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    setupFiles: ['src/__tests__/setup.js'],
    include: ['src/__tests__/**/*.test.js'],
    exclude: ['node_modules', '.claude'],
  },
});
