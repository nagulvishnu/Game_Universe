import * as THREE from 'three';
import { ArenaId, EnemyId, ModeId } from './types';
import { BOSS_ORDER, BOSSES, CHALLENGES, ENEMIES, WAVES } from './data/world';
import { W, rand } from './world';
import { bridge, useGame } from './store';
import { sfx, setMusic, stopMusic } from './audio';
import { clearEnemies, spawnEnemy } from './enemy';
import { resetPlayer } from './player';
import { setArena } from './engine';
import { vfx } from './vfx';
import { gainUlt } from './combat';

let curMult = { hp: 1, dmg: 1, speed: 1 };
const COST: Record<string, number> = { knight: 1, assassin: 1.3, hunter: 1.4, mage: 1.4, brute: 2.2, executioner: 3.5 };
const ROMAN = ['', 'I', 'II', 'III'];

export function startRun(mode: ModeId, arena: ArenaId) {
  const st = useGame.getState();
  setArena(arena); clearEnemies(); resetPlayer(); vfx.later.length = 0;
  const wmax = mode === 'survival' ? 10 : mode === 'elite' ? 5 : mode === 'boss' ? 3 : 0;
  W.run = { mode, score: 0, wave: 0, waveMax: wmax, time: 0, kills: 0, perfects: 0, deflects: 0, maxCombo: 0, bossIdx: 0, phase: 'intro', timer: 1.8, noHit: true, over: false, label: '', toSpawn: [], trainTimer: 0, masteryDone: false, damageTaken: 0, started: performance.now() };
  W.cine = null; W.slowT = 0; W.hitStop = 0; W.dim = 0; curMult = { hp: 1, dmg: 1, speed: 1 };
  st.set({ screen: 'playing', result: null, runId: st.runId + 1, mode, arena });
  const names: Record<ModeId, string> = { training: 'TRAINING', survival: 'SURVIVAL', elite: 'ELITE CHALLENGE', boss: 'BOSS RUSH', mastery: 'WEAPON MASTERY', endless: 'ENDLESS ARENA' };
  bridge.banner(names[mode], mode === 'training' ? 'Master your weapon' : 'Perfect your deflection'); sfx.start();
  setMusic(W.arena ? ({ citadel: 0, forge: 1, sanctuary: 2, coliseum: 3 }[arena]) : 0, mode === 'training' ? 1 : 2);
  if (mode === 'training') { W.run.timer = .4; }
}
export function restartRun() { const s = useGame.getState(); startRun(s.mode, s.arena); }

function spawnPos(): THREE.Vector3 {
  const R = (W.arena?.radius ?? 20) * .72;
  for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, x = Math.cos(a) * R, z = Math.sin(a) * R; if (Math.hypot(x - W.P.pos.x, z - W.P.pos.z) > 9) return new THREE.Vector3(x, 0, z); }
  return new THREE.Vector3(-W.P.pos.x * .8, 0, -W.P.pos.z * .8 - 6);
}
function queue(list: { id: string; n: number }[]) {
  const r = W.run!; let d = .2; for (const g of list) for (let i = 0; i < g.n; i++) { r.toSpawn.push({ id: g.id, delay: d }); d += .45; }
}
function endlessList(n: number) {
  const out: { id: string; n: number }[] = []; let budget = 3 + n * 1.5; const ids = Object.keys(COST).filter(k => k !== 'executioner');
  if (n % 5 === 0) { out.push({ id: 'executioner', n: 1 + Math.floor(n / 10) }); budget -= 3.5; }
  while (budget > .9) { const id = ids[Math.floor(Math.random() * ids.length)]; const c = COST[id]; if (c > budget && budget < 1.3) break; const f = out.find(o => o.id === id); if (f) f.n++; else out.push({ id, n: 1 }); budget -= c; }
  return out;
}
function nextWave() {
  const r = W.run!, mode = r.mode; r.wave++; r.phase = 'fight'; r.noHit = true;
  const w = r.wave;
  if (mode === 'survival') { queue(WAVES[w - 1]); curMult = { hp: 1 + .045 * (w - 1), dmg: 1 + .03 * (w - 1), speed: 1 + .01 * w }; bridge.banner(`WAVE ${w}`, w === 10 ? 'FINAL WAVE' : `of ${r.waveMax}`); }
  else if (mode === 'endless') {
    const lst = endlessList(w); if (w % 10 === 0) { r.toSpawn.push({ id: BOSS_ORDER[(w / 10 - 1) % 3], delay: .5 }); } queue(lst);
    curMult = { hp: Math.min(2.8, 1 + .07 * w), dmg: Math.min(1.9, 1 + .035 * w), speed: Math.min(1.25, 1 + .008 * w) }; bridge.banner(`WAVE ${w}`, w % 10 === 0 ? 'BOSS WAVE' : 'ENDLESS');
  } else if (mode === 'elite') {
    const L: { id: EnemyId; n: number }[][] = [[{ id: 'executioner', n: 1 }], [{ id: 'executioner', n: 2 }], [{ id: 'executioner', n: 1 }, { id: 'brute', n: 1 }, { id: 'mage', n: 1 }], [{ id: 'executioner', n: 2 }, { id: 'assassin', n: 2 }], [{ id: 'executioner', n: 3 }, { id: 'hunter', n: 1 }]];
    queue(L[w - 1]); curMult = { hp: 1.15 + w * .08, dmg: 1.1 + w * .05, speed: 1.05 + w * .02 }; bridge.banner(`ROUND ${w}`, 'ELITE');
  } else if (mode === 'boss') {
    const id = BOSS_ORDER[w - 1]; r.toSpawn.push({ id, delay: .6 }); curMult = { hp: 1, dmg: 1, speed: 1 }; r.bossIdx = w - 1;
    bridge.banner(BOSSES[id].name.toUpperCase(), `BOSS ${ROMAN[w]} / III`); setMusic(({ citadel: 0, forge: 1, sanctuary: 2, coliseum: 3 })[useGame.getState().arena], 3);
  } else if (mode === 'mastery') {
    const lst = WAVES[(w + 1) % WAVES.length].filter(g => g.id !== 'executioner' || w > 2); queue(lst); curMult = { hp: 1, dmg: .9, speed: 1 }; bridge.banner(`TRIAL ${w}`, 'COMPLETE THE WEAPON CHALLENGES');
  }
}
function waveClear() {
  const r = W.run!, P = W.P, mode = r.mode; r.phase = 'break'; r.timer = mode === 'boss' ? 4.5 : 3.2;
  const bonus = 500 * Math.max(1, r.wave) + (r.noHit ? 400 : 0); r.score += bonus; sfx.win();
  bridge.popup(mode === 'boss' ? 'BOSS DEFEATED' : 'WAVE CLEARED', 'gold', `+${bonus}${r.noHit ? ' · FLAWLESS' : ''}`);
  const heal = mode === 'boss' ? .45 : mode === 'elite' ? .3 : .25; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * heal); P.stam = P.maxStam; gainUlt(20);
  if (r.waveMax && r.wave >= r.waveMax) { endRun(true); }
}
export function endRun(victory: boolean) {
  const r = W.run; if (!r || r.over) return; r.over = true; r.phase = 'done';
  const st = useGame.getState(), P = W.P; let rank = 0;
  const time = Math.round((performance.now() - r.started) / 1000);
  if (victory) r.score += 2000 + Math.max(0, 600 - time) * 2;
  if (r.mode !== 'training') rank = st.addScore({ name: st.save.name || 'PLAYER', score: r.score, mode: r.mode, weapon: P.weaponId, wave: r.wave, date: Date.now() });
  const best = st.save.best[r.mode] ?? 0; if (r.score > best) st.setSave({ best: { ...st.save.best, [r.mode]: r.score } });
  st.set({ screen: 'gameover', result: { score: r.score, wave: r.wave, mode: r.mode, weapon: P.weaponId, rank, victory, stats: [`Time ${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`, `Kills ${r.kills}`, `Perfect deflects ${r.perfects}`, `Best combo ${r.maxCombo}`, `Damage taken ${Math.round(r.damageTaken)}`] } });
  stopMusic(); if (victory) sfx.win(); else sfx.fail();
}

export function updateRun(dt: number) {
  const r = W.run; if (!r || r.over) return; const P = W.P;
  r.time += dt; r.maxCombo = Math.max(r.maxCombo, P.combatCount);
  if (P.state === 'dying') {
    if (r.mode === 'training' && P.deadT > 1) { P.state = 'free'; P.hp = P.maxHp; P.deadT = 0; P.rig.root.rotation.x = 0; P.invuln = 1; }
    else if (P.deadT > 1.8) { endRun(false); return; }
  }
  const alive = W.enemies.filter(e => e.alive).length;
  // spawn queue (cap concurrent)
  if (r.toSpawn.length) {
    const cap = useGame.getState().settings.quality === 'low' ? 5 : 7;
    for (const s of r.toSpawn) s.delay -= dt;
    while (r.toSpawn.length && r.toSpawn[0].delay <= 0 && alive + 0 < cap + 100 && W.enemies.filter(e => e.alive).length < cap) { const s = r.toSpawn.shift()!; spawnEnemy(s.id, spawnPos(), { ...curMult }); }
  }
  switch (r.mode) {
    case 'training': {
      const cfg = useGame.getState().save.training; r.trainTimer += dt;
      if (r.phase === 'intro') { r.timer -= dt; if (r.timer <= 0) r.phase = 'fight'; }
      else if (alive < cfg.count && !r.toSpawn.length) { if (r.trainTimer > 1.4) { r.trainTimer = 0; const id = cfg.enemy; spawnEnemy(id, new THREE.Vector3(rand(-3, 3), 0, -7 - Math.random() * 3), { hp: id in BOSSES ? .6 : 3, dmg: 1, speed: 1 }); } }
      else if (alive >= cfg.count) r.trainTimer = 0;
      if (alive > cfg.count + 1) { /* leave */ }
      break;
    }
    default: {
      if (r.phase === 'intro' || r.phase === 'break') { r.timer -= dt; if (r.timer <= 0) nextWave(); }
      else if (r.phase === 'fight' && !r.toSpawn.length && alive === 0 && !W.cine) waveClear();
      if (r.mode === 'mastery' && !r.masteryDone) {
        const done = useGame.getState().save.done; if (CHALLENGES[P.weaponId].every(c => done[c.id])) { r.masteryDone = true; bridge.popup('MASTERY COMPLETE', 'gold', P.weapon.name); setTimeout(() => { if (W.run === r && !r.over) endRun(true); }, 2500); }
      }
    }
  }
  void ENEMIES;
}
