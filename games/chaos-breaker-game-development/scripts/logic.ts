import './stub';
import * as THREE from 'three';
import { initEngine, engineUpdate } from '../src/game/engine';
import { startRun } from '../src/game/modes';
import { input } from '../src/game/input';
import { bridge, useGame, useHud } from '../src/game/store';
import { W } from '../src/game/world';
import { spawnEnemy } from '../src/game/enemy';
import { WEAPON_ORDER, WEAPONS } from '../src/game/data/weapons';

const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 600); initEngine(scene, camera, null);
const pops: string[] = []; bridge.popup = (t) => { pops.push(t); };
const step = (n = 1) => { for (let i = 0; i < n; i++) engineUpdate(1 / 60); };
const tap = (a: any) => { input.press(a); step(1); input.release(a); };
const log = (...a: any[]) => console.log(...a);
function setup(weapon: any, enemy: string, beh = 'passive', dist = 3, style = 'samurai') {
  useGame.getState().set({ weapon, style }); useGame.getState().setSave({ training: { enemy, behavior: beh as any, pw: 1, count: 1 } });
  startRun('training', 'citadel'); step(40); for (const e of [...W.enemies]) { e.alive = false; e.state = 'dead'; e.deathT = 9; } step(2);
  const e = spawnEnemy(enemy, new THREE.Vector3(0, 0, 4 - dist), { hp: 6, dmg: 1, speed: 1 }); step(120); W.P.pos.set(0, 0, 4); W.P.yaw = Math.PI; e.pos.set(0, 0, 4 - dist); return e;
}
// 1) damage timing: light attack must damage only on hit frame
for (const w of WEAPON_ORDER) {
  const e = setup(w, 'knight'); const hp0 = e.hp; let first = -1;
  tap('light'); for (let f = 0; f < 90; f++) { step(); if (first < 0 && e.hp < hp0) first = f; }
  log(w, 'first light hit at frame', first, '(attack dur', WEAPONS[w].light[0].dur, 's, hit t', WEAPONS[w].light[0].hits[0].t, ') dmg', Math.round(hp0 - e.hp));
}
// 2) deflect bot
function botTest(weapon: string, enemy: string, secs: number, mode: 'deflect' | 'dodge' | 'none') {
  const e = setup(weapon, enemy, 'normal', 4); W.P.hp = W.P.maxHp; pops.length = 0; let perfects = 0, dmgTaken = 0, lastHp = W.P.hp; let pressed = 0;
  for (let f = 0; f < secs * 60; f++) {
    if (!e.alive) break;
    const a = e.atk;
    if (mode !== 'none' && a && ((e.state === 'windup' && e.st >= a.wind - (mode === 'deflect' ? .07 : .12)) || (e.state === 'strike' && (a.hits ?? 1) > e.hitN && e.st >= (a.gap ?? .4) - .07))) { if (!input.isHeld(mode === 'deflect' ? 'deflect' : 'dodge')) { input.press(mode === 'deflect' ? 'deflect' : 'dodge'); pressed++; } }
    else input.release('deflect'), input.release('dodge');
    step(); e.hp = e.maxHp; e.posture = 0;
    if (W.P.hp < lastHp) dmgTaken += lastHp - W.P.hp; lastHp = W.P.hp; if (W.P.hp < 10) W.P.hp = W.P.maxHp; W.P.stam = W.P.maxStam;
  }
  input.clear();
  const count = (t: string) => pops.filter(p => p === t).length;
  log(`${weapon} vs ${enemy} [${mode}]: pressed ${pressed}, PERFECT DEFLECT ${count('PERFECT DEFLECT')}, DEFLECT ${count('DEFLECT')}, PERFECT DODGE ${count('PERFECT DODGE')}, dmg taken ${Math.round(dmgTaken)}`);
}
botTest('inferno', 'knight', 40, 'deflect'); botTest('thunder', 'assassin', 40, 'deflect'); botTest('plasma', 'executioner', 40, 'deflect'); botTest('titan', 'brute', 40, 'deflect');
botTest('void', 'mage', 40, 'deflect'); botTest('glacier', 'hunter', 40, 'deflect'); botTest('inferno', 'brute', 40, 'dodge'); botTest('inferno', 'knight', 40, 'none');
botTest('plasma', 'iron', 60, 'deflect'); botTest('thunder', 'storm', 60, 'deflect'); botTest('void', 'titan', 60, 'dodge');
// 3) counter after perfect
{
  const e = setup('inferno', 'knight', 'normal', 3); let counters = 0; const hp0 = e.hp; pops.length = 0;
  for (let f = 0; f < 60 * 30 && e.alive; f++) {
    const a = e.atk;
    if (a && e.state === 'windup' && e.st >= a.wind - .07) input.press('deflect'); else input.release('deflect');
    if (W.P.counterT > 0 && W.P.state !== 'attack') { tap('light'); counters++; }
    step(); W.P.hp = W.P.maxHp;
  }
  log('counter test: counters triggered', counters, 'enemy hp', Math.round(e.hp), '/', Math.round(hp0), 'alive', e.alive);
}
console.log('done');
