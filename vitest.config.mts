import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Default node; component tests opt into jsdom via `// @vitest-environment jsdom`
    // at the top of the file (keeps game-logic tests fast, avoids a global jsdom).
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 15000,
    teardownTimeout: 5000,
  },
});
