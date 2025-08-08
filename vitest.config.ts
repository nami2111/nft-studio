import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    globals: true,
    environment: 'jsdom',
  },
});
