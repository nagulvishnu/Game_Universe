import { defineConfig } from 'vitest/config';

// Test-only config (the production build uses vite.config.ts untouched).
export default defineConfig({
  test: { server: { deps: { inline: ['zustand'] } } },
});
