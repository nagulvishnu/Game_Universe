import { build } from 'esbuild';
await build({ entryPoints: [process.argv[2]], bundle: true, platform: 'node', format: 'cjs', outfile: '/tmp/t.cjs', logLevel: 'error', jsx: 'automatic' });
