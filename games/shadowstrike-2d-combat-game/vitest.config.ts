import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), phaser: path.resolve(__dirname, 'node_modules/phaser/dist/phaser.js') } },
  test: {
    environment: 'jsdom',
    include: ['src/test/**/*.test.ts'],
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    pool: 'vmThreads',
  },
});
