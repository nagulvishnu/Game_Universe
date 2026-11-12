/* headless smoke test: runs the game engine for many frames with fuzzed input */
const noop = () => {};
const ctx2d: any = new Proxy({}, { get: (_t, k) => k === 'createImageData' ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener: noop };
(globalThis as any).window = { innerWidth: 1280, innerHeight: 720, addEventListener: noop };
(globalThis as any).localStorage = { getItem: () => null, setItem: noop };
import * as THREE from 'three';
import { initEngine, engineUpdate, enterHub } from '../src/game/engine';
import { startRun } from '../src/game/modes';
import { input } from '../src/game/input';
import { useGame, useHud } from '../src/game/store';
import { W } from '../src/game/world';
import { ACTIONS } from '../src/game/store';
import { WEAPON_ORDER } from '../src/game/data/weapons';
import { BOSSES } from '../src/game/data/world';
import { spawnEnemy } from '../src/game/enemy';

const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 600);
initEngine(scene, camera, null);
const modes = ['training', 'survival', 'elite', 'boss', 'mastery', 'endless'] as const;
const arenas = ['citadel', 'forge', 'sanctuary', 'coliseum'] as const;
let frames = 0, errors = 0;
const combat = ['light', 'heavy', 'deflect', 'dodge', 'spec1', 'spec2', 'ult', 'awaken', 'jump', 'lock', 'forward', 'left', 'back', 'right', 'sprint', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'] as const;
function fuzz(seconds: number, label: string) {
  for (let f = 0; f < seconds * 60; f++) {
    if (f % 6 === 0) { const a = combat[Math.floor(Math.random() * combat.length)]; if (Math.random() < .5) input.press(a); else input.release(a); }
    if (f % 20 === 0) { const P = W.P; if (P) { P.ult = Math.min(100, P.ult + 30); P.awk = Math.min(100, P.awk + 20); } }
    if (f % 40 === 0) { input.look.x += (Math.random() - .5) * 80; }
    try { engineUpdate(1 / 60); frames++; } catch (e: any) { errors++; console.log('ERROR in', label, e.stack?.split('\n').slice(0, 5).join('\n')); if (errors > 5) process.exit(1); }
    const P = W.P; if (!Number.isFinite(P.pos.x + P.pos.y + P.pos.z)) { console.log('NaN player pos', label); process.exit(1); }
    for (const e of W.enemies) if (!Number.isFinite(e.pos.x + e.pos.y + e.pos.z)) { console.log('NaN enemy pos', e.def.id, label); process.exit(1); }
    if (useGame.getState().screen !== 'playing') break;
  }
}
for (const m of modes) {
  const arena = arenas[modes.indexOf(m) % 4]; const w = WEAPON_ORDER[modes.indexOf(m) % 6];
  useGame.getState().set({ weapon: w }); startRun(m, arena); fuzz(25, m + ':' + arena + ':' + w);
  input.clear();
}
// every weapon vs every enemy/boss, with scripted deflect timing
for (const w of WEAPON_ORDER) {
  for (const id of ['knight', 'assassin', 'brute', 'mage', 'hunter', 'executioner', 'iron', 'storm', 'titan']) {
    useGame.getState().set({ weapon: w }); startRun('training', 'citadel'); W.run!.phase = 'fight';
    spawnEnemy(id, new THREE.Vector3(0, 0, -5), { hp: 4, dmg: 1, speed: 1 });
    fuzz(8, w + ':' + id); input.clear();
  }
}
enterHub(); for (let i = 0; i < 120; i++) engineUpdate(1 / 60);
console.log('OK frames', frames, 'errors', errors, 'hud', Object.keys(useHud.getState()).length);
void ACTIONS; void BOSSES;
