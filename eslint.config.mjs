import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Games are self-contained: each folder carries its own eslint.config.mjs and is
    // linted by its own `npm run lint` (run from inside that folder). ESLint resolves
    // the config from the working directory, not per file, so they cannot be merged
    // here. `npm run check:games` runs every game's gate.
    "games/**",
    // Built copies of games, published by discovery into /public/play.
    "public/play/**",
    // Leftovers from an interrupted discovery sync (same content as above).
    "public/play.tmp-*/",
  ]),
]);
