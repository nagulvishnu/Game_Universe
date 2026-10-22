import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests for the pure gameplay/validation modules.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    reporters: 'default',
  },
});
