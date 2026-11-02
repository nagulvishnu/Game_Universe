// Headless validation: runs the ENTIRE film through the real runtime (no rendering) and checks invariants.
import { film } from '../src/film/runtime';
import { SCENES, estimateFilm } from '../src/story/orchestrator';
import { ENVS } from '../src/world/envData';
import { CHAR_MAP } from '../src/story/characters';
import { findPath } from '../src/ai/nav';

let failures = 0;
const fail = (m: string) => { failures++; console.log('FAIL', m); };

// 1. static validation of screenplay data
for (const s of SCENES) {
  const env = ENVS[s.env];
  for (const c of s.cast) {
    if (!CHAR_MAP[c.id]) fail(`${s.id}: unknown cast ${c.id}`);
    if (!env.marks[c.at]) fail(`${s.id}: unknown mark ${c.at}`);
    if (c.face && !env.marks[c.face] && !CHAR_MAP[c.face]) fail(`${s.id}: unknown face ${c.face}`);
  }
  for (const b of s.beats) {
    if (b.t === 'line' && !CHAR_MAP[b.who]) fail(`${s.id}: unknown speaker ${b.who}`);
    if (b.t === 'move') for (const [id, m] of Object.entries(b.to)) { if (!CHAR_MAP[id]) fail(`${s.id}: move unknown ${id}`); if (!env.marks[m]) fail(`${s.id}: move unknown mark ${m}`); }
    if (b.t === 'enter' && (!env.marks[b.from] || !env.marks[b.to])) fail(`${s.id}: bad enter marks`);
    if (b.t === 'exit' && !env.marks[b.via]) fail(`${s.id}: bad exit mark`);
  }
}
for (const [id, env] of Object.entries(ENVS)) {
  for (const [name, m] of Object.entries(env.marks)) {
    if (name === 'in' || name === 'out' || name === 'pool' || name === 'fire') continue;
    for (const o of env.obstacles) if (Math.hypot(m[0] - o.x, m[1] - o.z) < o.r + 0.3) fail(`env ${id}: mark ${name} inside obstacle`);
    if (Math.hypot(m[0], m[1]) > env.bounds - 0.4) fail(`env ${id}: mark ${name} outside bounds`);
  }
  const p = findPath(env, env.marks.in, env.marks.c);
  if (!p) fail(`env ${id}: no path in→c`);
}

// 2. run whole film
let t = 0;
const dt = 1 / 30;
film.start(0);
const startedAt = Date.now();
while (film.status === 'playing' && t < 60 * 60) { film.update(dt); t += dt; }
const rep = film.runtimeReport();
console.log(`Simulated playback: ${(rep.actual / 60).toFixed(2)} min (screenplay estimate ${(estimateFilm() / 60).toFixed(2)} min) in ${(Date.now() - startedAt)}ms wall`);
console.log(`Status=${film.status} scenesCompleted=${rep.completed}/${SCENES.length}`);
if (film.status !== 'ended') fail('film did not end');
if (rep.completed !== SCENES.length) fail('not all scenes completed');
for (const r of rep.rows) console.log(`${r.id.padEnd(16)} act${r.act} est ${r.estimated.toFixed(0).padStart(4)}s actual ${r.actual.toFixed(0).padStart(4)}s warn ${r.warnings} nav ${r.navFallbacks} combat ${r.combatLog}`);
const warns = film.log.filter((l) => l.includes('WARN'));
console.log(`\nWarnings (${warns.length}):`); warns.slice(0, 40).forEach((w) => console.log(' ', w));
console.log('nav fallbacks by agent:', [...film.agents.values()].filter(a=>a.navFallbacks).map(a=>a.id+':'+a.navFallbacks).join(' '));
console.log('\nFinal world facts:', [...film.world.facts].length, 'dead:', [...film.world.dead].join(','), 'kael items:', film.world.possessions.kael?.join(','));
if (!film.world.dead.has('orrin') || !film.world.dead.has('malachar')) fail('expected deaths missing');
if (!film.world.possessions.kael?.includes('veil_key')) fail('veil key continuity');

// 3. jump continuity: jump to every scene, ensure prerequisites satisfied without warnings about missing prereqs
for (let i = 0; i < SCENES.length; i++) {
  film.jump(i);
  const w = film.log.filter((l) => l.includes('prerequisite') && l.includes(SCENES[i].id));
  if (w.length) fail(`jump ${SCENES[i].id}: ${w[w.length - 1]}`);
}
console.log(failures ? `\n${failures} FAILURES` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
