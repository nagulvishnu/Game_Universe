import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ARENAS, CHALLENGES } from './data/world';
import { ArenaId, AttackDef } from './types';
import { buildArena } from './arenas';
import { vfx } from './vfx';
import { setMusic } from './audio';
import { input } from './input';
import { useGame, useHud } from './store';
import { W } from './world';
import { updateCamera } from './camera';
import { applyStyle, createPlayer, equip, resetPlayer, startAttack, updatePlayer } from './player';
import { clearEnemies, spawnEnemy, updateEnemies } from './enemy';
import { hazardAt, updateProjs, updateZones } from './combat';
import { updateRun } from './modes';

const api = { hazard: hazardAt, px: 0, pz: 0, shakeCam: (a: number) => { W.shake = Math.max(W.shake, a); } };
let ready = false, hudAcc = 0;

export function initEngine(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer | null) {
  W.scene = scene; W.camera = camera; W.renderer = renderer;
  const s = useGame.getState().settings;
  if (renderer) { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .7; } catch { /* ignore */ } }
  W.hemi = new THREE.HemisphereLight(0x8899ff, 0x221018, 1.8); scene.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xffffff, 5); W.sun.position.set(14, 26, 10); scene.add(W.sun, W.sun.target);
  W.sun.shadow.camera.left = -24; W.sun.shadow.camera.right = 24; W.sun.shadow.camera.top = 24; W.sun.shadow.camera.bottom = -24; W.sun.shadow.camera.near = 1; W.sun.shadow.camera.far = 80; W.sun.shadow.bias = -.0004; W.sun.shadow.normalBias = .04;
  W.rim = new THREE.PointLight(0xffffff, 28, 14, 1.5); scene.add(W.rim);
  vfx.init(scene, camera, renderer, s.fx * (s.quality === 'low' ? .55 : s.quality === 'medium' ? .8 : 1));
  setArena(useGame.getState().arena); createPlayer(); resetPlayer(); applyQuality(); ready = true;
}
export function applyQuality() {
  const s = useGame.getState().settings; if (!W.sun) return;
  const sh = s.shadows && s.quality !== 'low'; W.sun.castShadow = sh; const size = s.quality === 'high' ? 2048 : 1024;
  if (W.sun.shadow.mapSize.x !== size) { W.sun.shadow.mapSize.set(size, size); W.sun.shadow.map?.dispose(); W.sun.shadow.map = null; }
  vfx.density = s.fx * (s.quality === 'low' ? .55 : s.quality === 'medium' ? .8 : 1);
}
export function setArena(id: ArenaId) {
  const def = ARENAS[id], q = useGame.getState().settings.quality;
  if (W.arena) { W.scene.remove(W.arena.group); W.arena.group.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (mat) (Array.isArray(mat) ? mat : [mat]).forEach(x => x.dispose()); }); }
  W.arena = buildArena(def, q); W.scene.add(W.arena.group);
  W.scene.background = new THREE.Color(def.sky[0]); W.scene.fog = new THREE.FogExp2(def.fog, def.fogDensity);
  W.hemi.color.setHex(def.sky[1] === 0 ? 0x888888 : new THREE.Color(def.light).lerp(new THREE.Color(0x6677ff), .4).getHex()); W.hemi.groundColor.setHex(def.fog); W.hemi.intensity = def.ambient * 3.4;
  W.sun.color.setHex(def.light); W.sun.intensity = 5.2; W.rim.color.setHex(def.accent); W.gravity = def.gravity;
  vfx.later.length = 0; W.camera.far = 600; W.camera.updateProjectionMatrix();
}
export function trainSpawn(id: string) { const cfg = useGame.getState().save; useGame.getState().setSave({ training: { ...cfg.training, enemy: id } }); clearEnemies(); }
export function demoAttack(def: AttackDef) { if (W.P.state === 'free') { W.P.yaw = Math.PI; startAttack(def, { noHold: true }); W.P.charged = true; } }
export function enterHub() {
  clearEnemies(); resetPlayer(); W.run = null; W.cine = null; if (W.arena && W.arena.group && useGame.getState().arena !== 'citadel') setArena('citadel');
  W.P.pos.set(0, 0, 0); W.P.yaw = 0; useGame.getState().set({ screen: 'hub' }); setMusic(0, 1);
}

const rankOf = (c: number) => c >= 90 ? 'SSS' : c >= 60 ? 'SS' : c >= 35 ? 'S' : c >= 20 ? 'A' : c >= 10 ? 'B' : c >= 5 ? 'C' : 'D';

export function engineUpdate(rawDtIn: number) {
  if (!ready) return;
  const raw = Math.min(rawDtIn, .05), st = useGame.getState(), screen = st.screen, playing = screen === 'playing', hub = screen === 'hub';
  // loadout sync
  if (W.P.weaponId !== st.weapon) equip(st.weapon, !playing && !hub); applyStyle();
  const P = W.P;
  if (!playing && !hub) { vfx.update(raw * .0, W.camera); return; }
  let sim = raw;
  if (W.hitStop > 0) { W.hitStop -= raw; sim = raw * .02; }
  if (W.slowT > 0) { W.slowT -= raw; sim *= W.slowF; }
  W.time += sim; input.pollPad();
  api.px = P.pos.x; api.pz = P.pos.z;
  updatePlayer(sim, raw, playing);
  if (playing) {
    updateEnemies(sim, raw); updateProjs(sim); updateZones(sim); W.arena?.update(sim, W.time, api); updateRun(sim);
    if (W.cine) { W.cine.t += raw; if (W.cine.t >= W.cine.dur) W.cine = null; }
  } else W.arena?.update(sim, W.time, api);
  vfx.update(W.hitStop > 0 ? raw * .08 : sim, W.camera);
  updateCamera(sim, raw, hub ? 'hub' : 'play');
  // lights follow player; dramatic dimming
  const dim = 1 - .55 * Math.min(1, W.dim), A = ARENAS[st.arena];
  W.sun.position.set(P.pos.x + 14, 26, P.pos.z + 10); W.sun.target.position.set(P.pos.x, 0, P.pos.z); W.sun.intensity = 5.2 * dim; W.hemi.intensity = A.ambient * 3.4 * (.5 + .5 * dim);
  W.rim.position.set(P.pos.x - 1.5, 2.4, P.pos.z - 2); W.rim.intensity = 26 + (P.awkT > 0 ? 24 : 0);
  if (playing) { hudAcc += raw; if (hudAcc > .06) { hudAcc = 0; syncHud(); } }
}

function syncHud() {
  const P = W.P, r = W.run, st = useGame.getState(); if (!r) return;
  let tgt: typeof W.enemies[number] | null = P.lock && P.lock.alive ? P.lock : null;
  if (!tgt) { let b = -1; for (const e of W.enemies) if (e.alive && !e.boss && W.time - e.lastDmgT < 4 && e.lastDmgT > b) { b = e.lastDmgT; tgt = e; } }
  const boss = W.enemies.find(e => e.boss && (e.alive || e.state === 'dying'));
  const alive = W.enemies.filter(e => e.alive).length + r.toSpawn.length;
  const wl: Record<string, string> = { training: 'TRAINING', survival: `WAVE ${r.wave}/${r.waveMax}`, endless: `WAVE ${r.wave}`, elite: `ROUND ${r.wave}/${r.waveMax}`, boss: `BOSS ${r.wave}/${r.waveMax}`, mastery: `TRIAL ${r.wave}` };
  const prog = st.save.progress[P.weaponId], done = st.save.done;
  const obj = r.mode === 'mastery' ? CHALLENGES[P.weaponId].map(c => `${done[c.id] ? '✓' : '○'} ${c.label} — ${Math.min(prog[c.stat], c.target)}/${c.target}`) : [];
  let hint = ''; const staggerBoss = W.enemies.some(e => e.alive && e.boss && e.state === 'stagger');
  if (staggerBoss) hint = 'HEAVY ATTACK → EXECUTE'; else if (P.counterT > 0) hint = 'COUNTER! LIGHT / HEAVY'; else if (P.ult >= 100) hint = 'ULTIMATE READY'; else if (P.awk >= 100 && P.awkT <= 0) hint = 'AWAKENING READY';
  useHud.setState({
    hp: P.hp, maxHp: P.maxHp, stam: P.stam, maxStam: P.maxStam, ult: P.ult, awk: P.awk, awkOn: P.awkT > 0, combo: P.combatCount, comboT: P.comboT, score: r.score, rank: rankOf(P.combatCount),
    wave: wl[r.mode], left: alive, cds: [P.cds.spec1 / Math.max(.1, P.cdMax.spec1), P.cds.spec2 / Math.max(.1, P.cdMax.spec2), P.dodgeCd], lock: !!P.lock, objective: obj, chain: P.d.chain, hint, time: r.time, training: r.mode === 'training', counter: P.counterT > 0, deflectCd: P.d.lock,
    target: tgt ? { name: tgt.def.name, hp: tgt.hp, max: tgt.maxHp, posture: tgt.posture / tgt.maxPosture, frozen: tgt.frozenT > 0 } : null,
    boss: boss ? { name: boss.def.name, hp: Math.max(0, boss.hp), max: boss.maxHp, posture: boss.posture / boss.maxPosture, phase: boss.phase, phases: boss.def.phases?.length ?? 1, stagger: boss.state === 'stagger' } : null,
  });
}
export { spawnEnemy };
