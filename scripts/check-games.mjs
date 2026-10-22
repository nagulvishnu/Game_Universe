#!/usr/bin/env node
/**
 * Run every game's own quality gate.
 *
 * Games are self-contained: each folder under /games owns its package.json, its
 * eslint config and its tests. ESLint resolves its config from the working directory,
 * so a game has to be checked from inside its own folder — this script does that.
 *
 * A game is checked when its package.json declares a "check" script.
 * Exits non-zero if any game fails.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const GAMES_DIR = join(ROOT, 'games');

if (!existsSync(GAMES_DIR)) {
  console.log('check:games — no games directory, nothing to do');
  process.exit(0);
}

const targets = readdirSync(GAMES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
  .map((d) => d.name)
  .filter((name) => {
    const pkgPath = join(GAMES_DIR, name, 'package.json');
    if (!existsSync(pkgPath)) return false;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      return typeof pkg.scripts?.check === 'string';
    } catch {
      return false;
    }
  });

if (!targets.length) {
  console.log('check:games — no games declare a "check" script');
  process.exit(0);
}

console.log(`check:games — checking ${targets.length} game${targets.length === 1 ? '' : 's'}: ${targets.join(', ')}\n`);

const failures = [];

for (const name of targets) {
  const cwd = join(GAMES_DIR, name);
  console.log(`── ${name} ${'─'.repeat(Math.max(0, 50 - name.length))}`);
  // A single command string (no args array) keeps Node from warning about unescaped
  // arguments when the shell is used on Windows.
  const result = spawnSync('npm run check', {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
  });
  if (result.status !== 0) failures.push(name);
  console.log('');
}

if (failures.length) {
  console.error(`check:games — FAILED: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(`check:games — all ${targets.length} game${targets.length === 1 ? '' : 's'} passed`);
