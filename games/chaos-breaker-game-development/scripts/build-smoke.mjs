import { build } from 'esbuild';
await build({ entryPoints: ['scripts/smoke.ts'], bundle: true, platform: 'node', format: 'esm', outfile: '/tmp/smoke.mjs', logLevel: 'error', external: [] });
