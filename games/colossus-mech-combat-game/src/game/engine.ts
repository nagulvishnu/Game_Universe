// COLOSSUS game engine: player mech, combat, abilities, projectiles, camera, cinematics
import * as THREE from 'three';
import { useStore, useHud, type LaunchCfg, type RunResult } from './store';
import { MECH_BY_ID, WEAPONS, THEMES, DIFFICULTIES, MONSTERS, levelFromXp, type MechDef, type Theme, type WeaponDef } from './data';
import { buildMech, type MechModel } from './models';
import { FX } from './fx';
import { World } from './world';
import { audio } from './audio';
import { input } from './input';
import { spawnEnemy, updateEnemies, killEnemy, onHitStagger, center, strikeAt, type Enemy } from './enemies';
import { initMode, updateMode, modeOnKill, modeApplyUpgrade, type ModeState } from './modes';

const TAU = Math.PI * 2; const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const clamp = THREE.MathUtils.clamp; const lerp = THREE.MathUtils.lerp;
const _a = V(), _b = V(), _c = V(), _d = V();

export interface Proj { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; life: number; dmg: number; aoe: number; friendly: boolean; grav: number; homing: boolean; target: Enemy | null; size: number; color: string; trail: boolean; kind: string; src?: Enemy; active: boolean; status?: string; crit?: boolean; weapon?: string; big?: boolean }
export interface WaveRing { x: number; z: number; r: number; speed: number; max: number; dmg: number; hit: boolean; color: string; e: Enemy }
interface Pickup { mesh: THREE.Mesh; kind: string; pos: THREE.Vector3; t: number }
interface Cine { kind: string; t: number; dur: number; e?: Enemy; lock: boolean; from: THREE.Vector3; blend: number }
export interface Player {
  pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; hp: number; maxHp: number; armor: number; maxArmor: number; en: number; maxEn: number; enDelay: number; radius: number; scale: number;
  weapons: string[]; wi: number; atk: number; atkDur: number; atkType: string; combo: number; comboT: number; hitDone: boolean; atkCd: number; fireT: number; aimHold: number; chargeT: number;
  dashT: number; dashCd: number; dashDir: THREE.Vector3; dashHit: Set<Enemy>; dashStrike: boolean; iT: number; guard: boolean; guardT: number; spCd: number; ult: number; tfT: number; tfCd: number; tfK: number; grounded: boolean;
  hitT: number; dead: boolean; deadT: number; shield: { hp: number; max: number; t: number } | null; lock: Enemy | null; comboHits: number; comboHitT: number; baseSpeed: number; dmgMult: number; dr: number; abilityPow: number; cdMult: number; enRegen: number;
  ventCd: number; diveState: string; ultT: number; moveMag: number; auraT: number; regen: number; faceT: number; faceYaw: number; lastHurt: number; dashPerfect: boolean; critBonus: number; enemyDmgTaken: number;
}

const QUAL: Record<string, { density: number; enemies: number; qi: number }> = { low: { density: 0.5, enemies: 4, qi: 0 }, medium: { density: 0.75, enemies: 6, qi: 1 }, high: { density: 1, enemies: 8, qi: 2 }, ultra: { density: 1.15, enemies: 10, qi: 3 } };
export const gameRef: { g: Game | null } = { g: null };
(window as any).__gameRef = gameRef;

export class Game {
  scene: THREE.Scene; cam: THREE.PerspectiveCamera; gl: THREE.WebGLRenderer; cfg: LaunchCfg; settings = useStore.getState().settings; profile = useStore.getState().profile;
  fx: FX; world: World; theme: Theme; mech: MechDef; model: MechModel; P!: Player; diff = DIFFICULTIES[0]; enemies: Enemy[] = []; projs: Proj[] = []; waves: WaveRing[] = []; pickups: Pickup[] = []; M!: ModeState;
  t = 0; time = 0; timeScale = 1; slowT = 0; slowS = 1; hitstop = 0; shakeV = 0; cine: Cine | null = null; sch: { t: number; fn: () => void }[] = []; beacon: { group: THREE.Group; pos: THREE.Vector3; hp: number; max: number; dead: boolean } | null = null;
  camYaw = 0; camPitch = 0.3; camLook = V(); camFov = 65; qual = QUAL.high; maxEnemies = 8; over = false; overT = 0;
  kills: Record<string, number> = {}; xp = 0; score = 0; buildingsDown = 0; dodges = 0; counters = 0; ults = 0; transforms = 0; weakHits = 0; bossesDown: string[] = [];
  hudT = 0; hudMsg = ''; hudMsgT = 0; title: { t: string; s: string } | null = null; titleT = 0; fps = 60; fpsAcc = 0; fpsN = 0; hazardT = 8; achT = 0;
  projGroup = new THREE.Group(); projGeo = new THREE.SphereGeometry(1, 8, 6); projMats: THREE.MeshBasicMaterial[] = []; guardDome: THREE.Mesh; dirLight: THREE.DirectionalLight; lights: THREE.Light[] = [];
  pickGeo = new THREE.OctahedronGeometry(1.4); pickMats: Record<string, THREE.MeshStandardMaterial> = {}; reticle: HTMLElement | null = null; weakMark: HTMLElement | null = null; isTouch = 'ontouchstart' in window;
  afterT = 0; bonusDone = false; upgrades = { regen: 0, dmg: 1 }; startPos = V(); lockTimer = 0; slowPerfect = 0;

  constructor(scene: THREE.Scene, cam: THREE.PerspectiveCamera, gl: THREE.WebGLRenderer, cfg: LaunchCfg) {
    this.scene = scene; this.cam = cam; this.gl = gl; this.cfg = cfg; gameRef.g = this; const S = this.settings; this.qual = QUAL[S.quality] || QUAL.high; this.maxEnemies = this.qual.enemies; this.diff = DIFFICULTIES[cfg.diff] || DIFFICULTIES[0];
    this.theme = THEMES[cfg.theme] || THEMES.city; this.mech = MECH_BY_ID[cfg.mechId]; gl.shadowMap.enabled = S.shadows > 0; gl.shadowMap.type = THREE.PCFSoftShadowMap; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05;
    this.fx = new FX(scene, S.particles, Math.round(60 + S.particles * 0.09)); this.world = new World(scene, this.theme, this.fx, this.qual.density, this.qual.qi);
    this.world.onBuildingDown = () => { if (!this.over) this.buildingsDown++; };
    // lights
    const th = this.theme; const hemi = new THREE.HemisphereLight(th.amb, th.ground2, 1.15); const dl = new THREE.DirectionalLight(th.sun, 2.4); dl.position.set(-80, 120, -60); this.dirLight = dl;
    dl.castShadow = S.shadows > 0; const ms = [0, 512, 1024, 2048][S.shadows] || 1024; dl.shadow.mapSize.set(ms, ms); const sc = dl.shadow.camera; sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 10; sc.far = 400; dl.shadow.bias = -0.0006; dl.shadow.normalBias = 0.6;
    const rim = new THREE.DirectionalLight('#7aa8ff', 0.7); rim.position.set(90, 50, 80); scene.add(hemi, dl, dl.target, rim); this.lights.push(hemi, dl, rim);
    scene.add(this.projGroup); for (let i = 0; i < 90; i++) { const m = new THREE.MeshBasicMaterial({ color: '#fff', fog: false }); this.projMats.push(m); const mesh = new THREE.Mesh(this.projGeo, m); mesh.visible = false; this.projGroup.add(mesh); this.projs.push({ mesh, pos: V(), vel: V(), life: 0, dmg: 0, aoe: 0, friendly: true, grav: 0, homing: false, target: null, size: 1, color: '#fff', trail: false, kind: '', active: false }); }
    const gd = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); gd.visible = false; scene.add(gd); this.guardDome = gd;
    ['repair', 'energy', 'armor'].forEach((k, i) => { this.pickMats[k] = new THREE.MeshStandardMaterial({ color: ['#4aff7a', '#4ac8ff', '#ffc84a'][i], emissive: ['#4aff7a', '#4ac8ff', '#ffc84a'][i], emissiveIntensity: 1.6, flatShading: true }); });
    // player
    const ms2 = this.profile.mechs[cfg.mechId]; const cust = ms2.cust; this.model = buildMech(this.mech, cust); scene.add(this.model.group); this.initPlayer(); this.model.group.position.copy(this.P.pos);
    this.camYaw = this.P.yaw; this.reticle = document.getElementById('lock-reticle'); this.weakMark = document.getElementById('weak-marker');
    input.active = true; input.canvas = gl.domElement; input.rebuild(); input.clear(); this.camFov = S.fov;
    initMode(this); this.camPos0();
    audio.init(); audio.setVolumes(S.master, S.music, S.sfx);
  }
  camPos0() { const P = this.P; this.cam.position.set(P.pos.x - Math.sin(this.camYaw) * 30, 12, P.pos.z - Math.cos(this.camYaw) * 30); this.camLook.copy(P.pos).setY(6); this.cam.fov = this.camFov; }

  initPlayer() {
    const m = this.mech, ms = this.profile.mechs[m.id]; const up = ms.up; const u = (k: string) => up[k] || 0; const lvl = levelFromXp(ms.xp).level; const lb = 1 + (lvl - 1) * 0.02; const pl = levelFromXp(this.profile.xp).level;
    const st = m.stats; const S = m.scale; const ab = 1 + 0.08 * u('armor');
    this.P = {
      pos: V(0, 0, this.cfg.mode === 'boss' ? -70 : -45), vel: V(), yaw: 0, hp: 0, maxHp: (500 + st.armor * 105) * ab * lb, armor: 0, maxArmor: (180 + st.defense * 60) * ab * lb, en: 0, maxEn: (80 + st.energy * 20) * (1 + 0.1 * u('core')), enDelay: 0, radius: 4.6 * S, scale: S,
      weapons: [...ms.cust.loadout], wi: 0, atk: 0, atkDur: 0.6, atkType: 'slash', combo: 0, comboT: 0, hitDone: true, atkCd: 0, fireT: 0, aimHold: 0, chargeT: 0, dashT: 0, dashCd: 0, dashDir: V(0, 0, 1), dashHit: new Set(), dashStrike: false, iT: 0, guard: false, guardT: 0,
      spCd: 0, ult: 0, tfT: 0, tfCd: 0, tfK: 0, grounded: true, hitT: 0, dead: false, deadT: 0, shield: null, lock: null, comboHits: 0, comboHitT: 0,
      baseSpeed: (13 + st.speed * 1.75) * (1 + 0.04 * u('speed')), dmgMult: (0.7 + st.power * 0.1) * (1 + 0.06 * u('weapon')) * lb * (1 + 0.01 * (pl - 1)), dr: Math.min(0.4, st.defense * 0.03), abilityPow: 1 + 0.1 * u('ability'), cdMult: 1 - 0.04 * u('ability'),
      enRegen: (9 + st.energy * 1.3) * (1 + 0.1 * u('core')), ventCd: 0, diveState: '', ultT: 0, moveMag: 0, auraT: 0, regen: 0, faceT: 0, faceYaw: 0, lastHurt: -10, dashPerfect: false, critBonus: 0, enemyDmgTaken: 0,
    };
    this.P.hp = this.P.maxHp; this.P.armor = this.P.maxArmor; this.P.en = this.P.maxEn; this.model.setWeapon(this.P.weapons[0]);
  }

  // ------------------------------------------------------------------ utilities
  vol(p: THREE.Vector3) { return clamp(1 - p.distanceTo(this.P.pos) / 280, 0.12, 1); }
  sched(t: number, fn: () => void) { this.sch.push({ t, fn }); }
  shakeAdd(v: number) { this.shakeV = Math.min(3, this.shakeV + v); }
  msg(t: string, d = 2) { this.hudMsg = t; this.hudMsgT = d; }
  slowMo(s: number, real: number) { this.slowS = s; this.slowT = real; }
  tf() { const t = this.mech.transform; return this.P.tfT > 0 ? t : null; }
  spend(n: number) { this.P.en = Math.max(0, this.P.en - n); this.P.enDelay = 0.8; }
  center(e: Enemy) { return center(e); }
  weakPos(e: Enemy) { e.group.updateWorldMatrix(true, false); return e.model.weak.getWorldPosition(_d); }
  chest() { return _c.set(this.P.pos.x, this.P.pos.y + 5.5 * this.P.scale, this.P.pos.z); }
  targetFor(e: Enemy): THREE.Vector3 {
    if (this.beacon && !this.beacon.dead && e.tgtBeacon && Math.hypot(e.pos.x - this.P.pos.x, e.pos.z - this.P.pos.z) > 40) return this.beacon.pos; return this.P.pos;
  }
  aliveEnemies() { return this.enemies.filter(e => !e.dead && !e.burrowed && e.state !== 'spawn'); }
  nearest(maxD = 300, front = false) {
    let best: Enemy | null = null, bd = 1e9; const fwd = _b.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    for (const e of this.aliveEnemies()) { const dx = e.pos.x - this.P.pos.x, dz = e.pos.z - this.P.pos.z; const d = Math.hypot(dx, dz) - e.radius; if (d > maxD) continue; if (front && (dx * fwd.x + dz * fwd.z) / (Math.hypot(dx, dz) || 1) < 0.3) continue; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  facing() { return _a.set(Math.sin(this.P.yaw), 0, Math.cos(this.P.yaw)); }

  // ------------------------------------------------------------------ camera helpers
  cineStart(kind: string, dur: number, e?: Enemy) {
    this.cine = { kind, t: 0, dur, e, lock: ['intro', 'boss', 'phase', 'bossDeath'].includes(kind), from: this.cam.position.clone(), blend: 0 };
    if (kind === 'boss' && e) { this.title = { t: e.def.title || e.def.name, s: e.def.sub || '' }; this.titleT = dur - 0.6; audio.music('boss'); }
    if (kind === 'bossDeath') this.slowMo(0.3, dur - 0.5);
  }
  aimPoint(): THREE.Vector3 {
    const P = this.P; if (P.lock && !P.lock.dead) return this.center(P.lock).clone();
    const o = this.cam.position; const d = this.cam.getWorldDirection(_b).clone(); let bestT = 1e9; let pt: THREE.Vector3 | null = null;
    for (const e of this.aliveEnemies()) { const c = this.center(e); const t = _c.copy(c).sub(o).dot(d); if (t < 5) continue; const perp = _a.copy(o).addScaledVector(d, t).distanceTo(c); if (perp < e.radius * 1.1 + 3 && t < bestT) { bestT = t; pt = c.clone(); } }
    if (pt) return pt;
    if (this.isTouch) { const n = this.nearest(160, true); if (n) return this.center(n).clone(); }
    let t = 140; if (d.y < -0.01) { const tg = -o.y / d.y; if (tg > 5 && tg < t) t = tg; }
    return o.clone().addScaledVector(d, t);
  }
  muzzle(): THREE.Vector3 { this.model.group.updateWorldMatrix(true, true); return this.model.muzzle.getWorldPosition(V()); }

  // ------------------------------------------------------------------ projectiles
  spawnProj(o: Partial<Proj> & { pos: THREE.Vector3; vel: THREE.Vector3; color: string }) {
    let p = this.projs.find(x => !x.active); if (!p) p = this.projs.find(x => !x.friendly) || this.projs[0];
    Object.assign(p, { life: 3, dmg: 0, aoe: 0, friendly: true, grav: 0, homing: false, target: null, size: 1, trail: false, kind: '', src: undefined, status: undefined, crit: false, weapon: undefined, big: false }, o); p.active = true; p.mesh.visible = true; p.mesh.position.copy(p.pos);
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(p.color); p.mesh.scale.set(p.size, p.size, p.size * (p.friendly && p.grav === 0 ? 3 : 1.4)); return p;
  }
  clearEnemyProjs(c: THREE.Vector3, r: number) { for (const p of this.projs) if (p.active && !p.friendly && p.pos.distanceTo(c) < r) { p.active = false; p.mesh.visible = false; this.fx.burst(p.pos, 6, p.color, 14, 1, 0.4); } }
  updateProjs(dt: number) {
    const P = this.P;
    for (const p of this.projs) {
      if (!p.active) continue; p.life -= dt;
      if (p.homing) { if (!p.target || p.target.dead) { p.target = this.nearest(300) || null; } if (p.target) { const sp = p.vel.length(); const des = _a.copy(this.center(p.target)).sub(p.pos).normalize().multiplyScalar(sp); p.vel.lerp(des, Math.min(1, dt * 3.5)); } }
      p.vel.y -= p.grav * dt; p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos); if (p.vel.lengthSq() > 1) p.mesh.lookAt(_a.copy(p.pos).add(p.vel));
      if (p.trail) this.fx.emit(p.pos, _a.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4), p.color, p.size * 0.7, 0.35, true, 0, 1, -0.3);
      let hit: Enemy | null | 'x' = null; let boom = false;
      if (p.friendly) { for (const e of this.enemies) { if (e.dead || e.burrowed || e.state === 'spawn') continue; if (p.pos.distanceTo(this.center(e)) < e.radius * 0.95 + p.size) { hit = e; boom = true; break; } } }
      else { if (p.pos.distanceTo(this.chest()) < P.radius + p.size + 1.5) { hit = 'x'; boom = true; } }
      if (!boom && p.pos.y < 0.3 && p.vel.y < 0) boom = true;
      if (!boom && p.pos.y < 60) { const bh = this.world.pointHit(p.pos); if (bh) { boom = true; if (p.friendly) this.world.damageFloor(bh.b, bh.f, p.dmg * 0.8 + 40); } }
      if (!boom && p.life <= 0) boom = p.aoe > 0 && false;
      if (!boom && Math.abs(p.pos.x) > 400) p.life = 0;
      if (boom) this.projBoom(p, hit); if (p.life <= 0 || boom) { p.active = false; p.mesh.visible = false; }
    }
  }
  projBoom(p: Proj, hit: Enemy | null | 'x') {
    if (p.friendly) {
      if (p.aoe > 0) { this.aoe(p.pos, p.aoe, p.dmg, { crit: p.crit, status: p.status, weakTol: p.aoe * 0.35, kb: 8 }); this.fx.explosion(p.pos, Math.max(0.6, p.aoe / 7), p.color); audio.sfx(p.aoe > 12 ? 'bigExplode' : 'explode', this.vol(p.pos)); this.shakeAdd(Math.min(0.6, p.aoe * 0.03)); if (p.big) this.slamFx(p.pos.clone().setY(0), p.aoe, p.color); }
      else if (hit && hit !== 'x') { this.damageEnemy(hit, p.dmg, p.pos, { crit: p.crit, status: p.status }); this.fx.sparks(p.pos, _a.copy(p.vel).normalize().negate(), 5, p.color, 28); }
      else this.fx.sparks(p.pos, V(0, 1, 0), 4, p.color, 20);
    } else {
      const r = Math.max(p.aoe, 3.5); this.fx.explosion(p.pos, r / 7, p.color); this.eAoe(p.pos, r, p.dmg, p.src, { kb: 12, sky: true }); audio.sfx('explode', this.vol(p.pos) * 0.7);
    }
  }

  // ------------------------------------------------------------------ damage
  damageEnemy(e: Enemy, dmg: number, pos: THREE.Vector3 | null, o: { crit?: boolean; dot?: boolean; status?: string; kb?: number; poise?: number; weakTol?: number } = {}) {
    if (e.dead || e.burrowed || e.invuln > 0 || e.state === 'spawn') return 0; const P = this.P; let mult = 1; let weak = false; let crit = !!o.crit;
    if (pos && !o.dot) { const wp = this.weakPos(e); if (wp.distanceTo(pos) < e.def.weak[3] * 1.3 + (o.weakTol || 0)) { weak = true; mult *= 2.0; } }
    if (e.vuln > 0) mult *= 1.3; if (!o.dot && !crit && Math.random() < 0.1 + P.critBonus) crit = true; if (crit) mult *= 1.6;
    const final = dmg * mult * this.upgrades.dmg; e.hp -= final; e.flash = 1; if (!o.dot) { P.ult = Math.min(100, P.ult + final * 0.012 * (this.cfg.mode === 'boss' ? 1.4 : 1)); this.score += final * 0.08; }
    if (!o.dot) {
      P.comboHits++; P.comboHitT = 3; if (weak) this.weakHits++;
      window.dispatchEvent(new CustomEvent('hitmark', { detail: weak ? 'weak' : crit ? 'crit' : 'hit' }));
      if (pos) { this.fx.sparks(pos, _a.copy(P.pos).sub(pos).normalize(), weak ? 10 : 5, weak ? '#ff6a4a' : crit ? '#ffe070' : '#ffd8a0', weak ? 46 : 30); }
      if (weak || crit) { this.fx.ring(pos || e.pos, weak ? 5 : 3, weak ? '#ff4a4a' : '#ffe070', 0.3, false); audio.sfx('clang', this.vol(e.pos) * 0.8); } else audio.sfx('hit', this.vol(e.pos) * 0.8);
    }
    e.poise += final * (weak ? 1.8 : 1) * (o.poise ?? 1);
    if (o.kb && !e.isBoss && e.radius < 8 && pos) { const k = _a.copy(e.pos).sub(P.pos).setY(0).normalize(); e.pos.addScaledVector(k, o.kb * 0.15); }
    if (o.status === 'burn') e.burn = 4; if (o.status === 'freeze') { if (e.isBoss) e.slow = 3; else { e.frozen = 2.0; e.slow = 4; } } if (o.status === 'slow') e.slow = Math.max(e.slow, 3);
    if (o.status === 'shock') { e.poise += final * 0.6; if (!e.isBoss) e.slow = Math.max(e.slow, 1.2); }
    if (e.hp <= 0) { killEnemy(this, e); return final; }
    onHitStagger(this, e, weak); return final;
  }
  aoe(pos: THREE.Vector3, r: number, dmg: number, o: { crit?: boolean; status?: string; kb?: number; weakTol?: number; poise?: number; noBuild?: boolean; vehicles?: boolean } = {}) {
    for (const e of this.enemies) { if (e.dead || e.burrowed) continue; const d = pos.distanceTo(this.center(e)) - e.radius; if (d > r) continue; this.damageEnemy(e, dmg * (1 - clamp(d / r, 0, 1) * 0.5), pos, o); }
    if (!o.noBuild) { const k = this.cfg.mode === 'city' || this.cfg.mission === 9 ? 0.25 : 0.6; const n = this.world.hit(pos.x, Math.max(1, pos.y), pos.z, r, dmg * k + 60); void n; }
    for (const v of this.world.vehicles) if (v.state === 0 && Math.hypot(v.x - pos.x, v.z - pos.z) < r + 3) { this.world.explodeVehicle(v); this.world.syncVehicles(); this.aoe(_d.set(v.x, 1, v.z).clone(), 12, 120, { noBuild: false }); }
  }
  eAoe(pos: THREE.Vector3, rad: number, dmg: number, e: Enemy | undefined, o: { kb?: number; sky?: boolean } = {}) {
    const P = this.P; const dx = P.pos.x - pos.x, dz = P.pos.z - pos.z; const d = Math.hypot(dx, dz) - P.radius;
    if (d <= rad && (o.sky || P.pos.y < 4.5)) { const f = 1 - clamp(d / rad, 0, 1) * 0.4; this.hurtPlayer(dmg * f, pos, { kb: o.kb || 0, e }); }
    if (this.beacon && !this.beacon.dead && Math.hypot(this.beacon.pos.x - pos.x, this.beacon.pos.z - pos.z) < rad + 6) this.damageBeacon(dmg * 2.2);
    this.world.hit(pos.x, 2, pos.z, rad * 1.05, dmg * 3.2);
    for (const v of this.world.vehicles) if (v.state === 0 && Math.hypot(v.x - pos.x, v.z - pos.z) < rad + 3) { this.world.explodeVehicle(v); this.world.syncVehicles(); }
  }
  damageBeacon(d: number) { const b = this.beacon!; if (b.dead) return; b.hp -= d; this.fx.sparks(b.pos.clone().setY(8), V(0, 1, 0), 5, '#ffc84a', 30); if (b.hp <= 0) { b.dead = true; b.group.visible = false; this.fx.explosion(b.pos.clone().setY(6), 4, '#ffa040'); audio.sfx('bigExplode', 1); this.shakeAdd(2); } }
  hurtPlayer(dmg: number, from: THREE.Vector3 | null, o: { kb?: number; e?: Enemy; dot?: boolean } = {}) {
    const P = this.P; if (P.dead || this.over || P.ultT > 0 || this.cine?.lock) return false;
    if (P.iT > 0) { if (P.dashCd > 0.3 && !P.dashPerfect && !o.dot) { P.dashPerfect = true; this.dodges++; P.en = Math.min(P.maxEn, P.en + 25); P.ult = Math.min(100, P.ult + 4); this.msg('PERFECT DODGE', 1.0); this.slowMo(0.45, 0.55); window.dispatchEvent(new CustomEvent('hitmark', { detail: 'dodge' })); this.fx.ring(P.pos, 14, '#ffffff', 0.4, false); } return false; }
    if (P.shield) { P.shield.hp -= dmg; this.fx.ring(this.chest(), 9, '#7fe8ff', 0.3, false); audio.sfx('clang', 0.6); if (P.shield.hp <= 0) { P.shield = null; this.msg('BARRIER DOWN', 1.2); } return false; }
    if (P.guard) {
      if (P.guardT < 0.28 && !o.dot && o.e) { this.counter(o.e); return false; }
      dmg *= 0.25; this.spend(dmg * 0.04 + 1); audio.sfx('clang', 0.7); this.fx.sparks(this.chest(), V(0, 0.3, 0), 6, '#9ad8ff', 30); if (P.en <= 0) P.guard = false;
    }
    const tf = this.tf(); dmg *= (1 - P.dr) / (tf ? tf.def : 1); const a = Math.min(P.armor, dmg * 0.7); P.armor -= a; P.hp -= dmg - a; P.enemyDmgTaken += dmg; P.lastHurt = this.t; P.regen = 0;
    if (!o.dot) { P.hitT = 1; this.shakeAdd(Math.min(1.4, dmg / 70)); window.dispatchEvent(new CustomEvent('hurt', { detail: Math.min(1, dmg / 120) })); audio.sfx('hit', 1); P.ult = Math.min(100, P.ult + dmg * 0.03); }
    if (o.kb && from && !o.dot) { const k = _a.copy(P.pos).sub(from).setY(0).normalize(); P.vel.x += k.x * o.kb * 0.8 / Math.sqrt(P.scale); P.vel.z += k.z * o.kb * 0.8 / Math.sqrt(P.scale); if (o.kb > 30 && P.grounded) P.vel.y = 8; }
    if (P.hp <= 0) this.killPlayer(); return true;
  }
  counter(e: Enemy) {
    const P = this.P; this.counters++; P.guardT = 1; this.msg('COUNTERATTACK!', 1.2); this.hitstop = 0.12; this.slowMo(0.3, 0.4); const c = this.center(e); this.fx.slash(this.chest().clone().addScaledVector(this.facing(), 6), P.yaw, 0.3, 26, '#ffffff'); this.fx.explosion(_a.copy(this.chest()).addScaledVector(this.facing(), 8).clone(), 1.5, '#ffffff'); audio.sfx('clang', 1); audio.sfx('bigExplode', 0.5);
    const w = WEAPONS[P.weapons[0]]; const dmg = Math.max(350, w.dmg * 3.2) * P.dmgMult; if (P.pos.distanceTo(c) < 160) { this.damageEnemy(e, dmg, c, { crit: true, poise: 6 }); e.poise += e.poiseMax; onHitStagger(this, e, true); }
    this.aoe(P.pos.clone(), 20, dmg * 0.4, { poise: 3 }); P.en = Math.min(P.maxEn, P.en + 25); P.ult = Math.min(100, P.ult + 8); this.shakeAdd(1);
  }
  killPlayer() {
    const P = this.P; if (P.dead) return; P.dead = true; P.deadT = 0; P.hp = 0; this.fx.explosion(this.chest().clone(), 3, '#ff9a3a'); audio.sfx('bigExplode', 1); audio.music(null); audio.sfx('defeat', 1); this.shakeAdd(2);
    this.model.shatter(this.scene).forEach(o => this.pieces.push({ o, v: V((Math.random() - 0.5) * 40, 25 + Math.random() * 25, (Math.random() - 0.5) * 40) })); this.msg('MECH DESTROYED', 3); this.slowMo(0.35, 1.4);
    this.sched(3.2, () => this.finish(false));
  }
  pieces: { o: THREE.Object3D; v: THREE.Vector3 }[] = [];

  onKill(e: Enemy) {
    const id = e.def.id; this.kills[id] = (this.kills[id] || 0) + 1; this.xp += e.def.xp * e.xpMult * (e.isBoss && this.cfg.mode !== 'campaign' && this.cfg.mode !== 'boss' ? 0.5 : 1); this.score += e.def.xp * 2 * e.xpMult; this.P.ult = Math.min(100, this.P.ult + (e.isBoss ? 40 : 10)); this.P.en = Math.min(this.P.maxEn, this.P.en + 15);
    if (e.xpMult > 0) { const n = e.isBoss ? 4 : Math.random() < 0.4 ? 1 : 0; for (let i = 0; i < n; i++) { const r = Math.random(); this.dropPickup(e.pos, r < 0.4 ? 'repair' : r < 0.75 ? 'energy' : 'armor', i); } }
    this.shakeAdd(e.isBoss ? 2 : 0.5); if (e.isBoss) { this.bossesDown.push(id); this.msg(`${e.def.name} DESTROYED`, 3); this.hitstop = 0.2; }
    modeOnKill(this, e);
  }
  dropPickup(p: THREE.Vector3, kind: string, i = 0) {
    const m = new THREE.Mesh(this.pickGeo, this.pickMats[kind]); const a = Math.random() * TAU; m.position.set(p.x + Math.cos(a) * (8 + i * 4), 3, p.z + Math.sin(a) * (8 + i * 4)); this.scene.add(m); this.pickups.push({ mesh: m, kind, pos: m.position, t: 25 });
  }
  slamFx(c: THREE.Vector3, r: number, color: string) {
    this.fx.ring(c, r * 1.1, color, 0.6); this.fx.ring(c, r * 0.7, '#ffffff', 0.45); this.fx.dust(c, r * 0.5, Math.min(40, Math.round(r * 1.5))); this.fx.crack(c.x, c.z, r * 0.8); this.fx.chunk(c.clone().setY(1), Math.min(12, Math.round(r * 0.5)), '#6a6e78', r * 1.1, 1.2);
    this.fx.burst(c.clone().setY(1), 10, color, r * 1.2, 1.2, 0.5, 10); this.fx.flash(c.clone().setY(4), color, 4, 70, 0.3); const d = c.distanceTo(this.P.pos); this.shakeAdd(clamp(1 - d / 150, 0, 1) * Math.min(1.2, r * 0.05)); audio.sfx('land', this.vol(c));
  }

  // ------------------------------------------------------------------ player abilities
  fireRanged(w: WeaponDef) {
    const P = this.P; const tf = this.tf(); const rate = tf?.siege ? 0.8 : 1; if (P.en < w.cost) { if (this.t - (this as any).lowT > 1.2 || !(this as any).lowT) { (this as any).lowT = this.t; this.msg('LOW ENERGY — [R] VENT', 1); audio.sfx('warn', 0.4); } return; }
    const m = this.muzzle(); const aim = this.aimPoint(); const dir = aim.clone().sub(m).normalize(); P.atkCd = (w.cd / rate) * (this.mech.id === 'sky' && w.id === 'machinegun' ? 0.85 : 1); P.fireT = 1; P.aimHold = 0.7; this.spend(w.cost); const dm = P.dmgMult; P.faceT = 0.7; P.faceYaw = Math.atan2(aim.x - P.pos.x, aim.z - P.pos.z);
    if (P.lock) P.faceYaw = Math.atan2(P.lock.pos.x - P.pos.x, P.lock.pos.z - P.pos.z);
    const spread = (s: number) => dir.clone().add(V((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s)).normalize();
    this.fx.burst(m, 3, w.color, 14, 0.9, 0.18, 0, true); this.fx.flash(m, w.color, 1.4, 40, 0.1);
    switch (w.id) {
      case 'machinegun': this.spawnProj({ pos: m.clone(), vel: spread(w.spread!).multiplyScalar(w.speed!), color: w.color, size: w.size!, dmg: w.dmg * dm, life: 1.4, weapon: w.id }); audio.sfx('shoot_mg', 0.7); this.shakeAdd(0.02); break;
      case 'shotgun': for (let i = 0; i < w.pellets!; i++) this.spawnProj({ pos: m.clone(), vel: spread(w.spread!).multiplyScalar(w.speed! * (0.85 + Math.random() * 0.3)), color: w.color, size: w.size!, dmg: w.dmg * dm, life: 0.6, weapon: w.id }); audio.sfx('shoot_plasma', 0.8); this.shakeAdd(0.2); P.vel.addScaledVector(dir, -4); break;
      case 'rocket': case 'plasma': this.spawnProj({ pos: m.clone(), vel: dir.clone().multiplyScalar(w.speed!), color: w.color, size: w.size!, dmg: w.dmg * dm, aoe: w.aoe, life: 3, trail: true, weapon: w.id }); audio.sfx(w.id === 'rocket' ? 'shoot_rocket' : 'shoot_plasma', 0.9); this.shakeAdd(0.1); break;
      case 'homing': for (let i = 0; i < w.count!; i++) this.sched(i * 0.07, () => { const mm = this.muzzle(); const v = dir.clone().add(V((Math.random() - 0.5) * 0.7, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.7)).normalize().multiplyScalar(w.speed!); this.spawnProj({ pos: mm, vel: v, color: w.color, size: w.size!, dmg: w.dmg * dm, aoe: w.aoe, life: 4, trail: true, homing: true, target: P.lock || this.nearest(300, true) || null, weapon: w.id }); audio.sfx('shoot_rocket', 0.6); }); break;
      case 'artillery': { const dist = aim.distanceTo(m); const T = Math.max(0.5, dist / w.speed!); const gr = w.grav!; const v = V((aim.x - m.x) / T, (aim.y - m.y + 0.5 * gr * T * T) / T, (aim.z - m.z) / T); this.spawnProj({ pos: m.clone(), vel: v, color: w.color, size: w.size!, dmg: w.dmg * dm, aoe: w.aoe, grav: gr, life: 6, trail: true, big: true, weapon: w.id }); audio.sfx('shoot_rocket', 1); this.shakeAdd(0.4); P.vel.addScaledVector(dir, -8); break; }
      case 'railgun': { audio.sfx('rail', 1); this.shakeAdd(0.5); const end = m.clone().addScaledVector(dir, w.range); for (const e of this.aliveEnemies()) { const c = this.center(e); const t = _c.copy(c).sub(m).dot(dir); if (t < 0 || t > w.range) continue; const perp = _a.copy(m).addScaledVector(dir, t).distanceTo(c); if (perp < e.radius) { const wp = this.weakPos(e); const wl = _a.copy(m).addScaledVector(dir, _b.copy(wp).sub(m).dot(dir)).distanceTo(wp); this.damageEnemy(e, w.dmg * dm, wl < e.def.weak[3] * 1.2 ? wp : c.clone().addScaledVector(dir, -e.radius * 0.5), { crit: Math.random() < 0.4 + P.critBonus, poise: 1.4 }); } }
        for (let i = 6; i < w.range; i += 8) { const q = _a.copy(m).addScaledVector(dir, i); const bh = this.world.pointHit(q); if (bh) this.world.damageFloor(bh.b, bh.f, w.dmg * 0.8); }
        this.fx.beam(m, end, w.color, 1.0, 0.3); this.fx.beam(m, end, '#ffffff', 0.35, 0.2); this.fx.ring(m, 6, w.color, 0.3, false); if (this.mech.id === 'storm') this.fx.bolt(m, end, '#9ad0ff', 0.5, 0.2, 14); break; }
      case 'laser': { audio.sfx('laser', 0.5); let best = 1e9; let he: Enemy | null = null; for (const e of this.aliveEnemies()) { const c = this.center(e); const t = _c.copy(c).sub(m).dot(dir); if (t < 0 || t > w.range) continue; const perp = _a.copy(m).addScaledVector(dir, t).distanceTo(c); if (perp < e.radius && t < best) { best = t; he = e; } }
        const end = m.clone().addScaledVector(dir, he ? best : w.range); if (!he && dir.y < 0) { const k = m.y / -dir.y; if (k < w.range) end.copy(m).addScaledVector(dir, k); } this.fx.beam(m, end, w.color, 0.55, 0.07); this.fx.beam(m, end, '#ffffff', 0.2, 0.05); this.fx.burst(end, 1, w.color, 12, 1, 0.3, 4);
        if (he) { const wp = this.weakPos(he); this.damageEnemy(he, w.dmg * dm, wp.distanceTo(end) < he.def.weak[3] * 1.3 ? wp : end, { poise: 0.5 }); } else if (end.y < 6) this.world.hit(end.x, 2, end.z, 3, 12); break; }
    }
  }
  startMelee(w: WeaponDef) {
    const P = this.P; P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0; P.comboT = 1.1; P.atk = 0.001; P.hitDone = false; const c2 = P.combo === 2;
    P.atkType = w.id === 'hammer' ? 'smash' : w.id === 'plasmafist' ? 'punch' : w.id === 'spear' ? 'thrust' : 'slash'; P.atkDur = w.cd * 1.6 * (c2 ? 1.3 : 1); P.atkCd = 0;
    const tgt = P.lock && !P.lock.dead ? P.lock : this.nearest(w.range * P.scale + 45, true); P.faceYaw = tgt ? Math.atan2(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z) : this.camYaw; P.faceT = 0.7; P.yaw = P.yaw + angDiff(P.yaw, P.faceYaw) * 0.6;
    const f = _a.set(Math.sin(P.faceYaw), 0, Math.cos(P.faceYaw)); P.vel.addScaledVector(f, 14 * P.scale); audio.sfx('slash', 0.8); this.spend(0);
  }
  meleeHit(w: WeaponDef) {
    const P = this.P; const S = P.scale; const R = w.range * S; const yaw = P.faceYaw; const f = V(Math.sin(yaw), 0, Math.cos(yaw)); const chest = this.chest().clone(); const c2 = P.combo === 2; const tf = this.tf();
    const bonus = 1 + Math.min(0.25, P.comboHits * 0.01); const dmg = w.dmg * P.dmgMult * bonus * (c2 ? 1.7 : 1) * (this.mech.id === 'iron' ? 1.1 : 1); let hits = 0;
    const roll = P.atkType === 'smash' || c2 ? Math.PI / 2 : P.combo === 1 ? -0.5 : 0.5; this.fx.slash(chest.clone().addScaledVector(f, R * 0.45), yaw, roll, R * (c2 ? 0.85 : 0.65), w.color); if (c2) this.fx.slash(chest.clone().addScaledVector(f, R * 0.5), yaw, roll + 0.5, R, '#ffffff');
    if (P.atkType === 'thrust') this.fx.beam(chest, chest.clone().addScaledVector(f, R), w.color, 0.9, 0.15);
    for (const e of this.aliveEnemies()) {
      const c = this.center(e); const dx = c.x - P.pos.x, dz = c.z - P.pos.z; const dh = Math.hypot(dx, dz); if (dh - e.radius > R) continue; if (Math.abs(c.y - chest.y) > e.radius + 12 * S) continue;
      const dot = (dx * f.x + dz * f.z) / (dh || 1); if (dot < (w.arc ?? 0) && dh > e.radius * 1.15) continue;
      const wp = this.weakPos(e); const weakNear = wp.distanceTo(chest) < R + e.def.weak[3] && ((wp.x - P.pos.x) * f.x + (wp.z - P.pos.z) * f.z) > -2;
      const hp = weakNear ? wp.clone() : c.clone().addScaledVector(_b.copy(chest).sub(c).normalize(), e.radius * 0.85);
      this.damageEnemy(e, dmg, hp, { kb: 40, poise: c2 ? 1.8 : 1, status: tf?.aura === 'shock' ? 'shock' : tf?.aura === 'burn' ? 'burn' : undefined }); hits++; this.fx.burst(hp, 5, w.color, 24, 1, 0.3);
    }
    if (hits) { this.hitstop = c2 ? 0.09 : 0.05; this.shakeAdd(c2 ? 0.5 : 0.25); P.en = Math.min(P.maxEn, P.en + 3 * hits); this.slowPerfect = 0; }
    const sp = chest.clone().addScaledVector(f, R * 0.6); this.world.hit(sp.x, 3, sp.z, R * 0.5, dmg * 0.5);
    if (P.atkType === 'smash' || c2) { const cc = P.pos.clone().addScaledVector(f, R * 0.85).setY(0); this.slamFx(cc, c2 ? 16 : 13, w.color); this.aoe(cc, c2 ? 16 : 13, dmg * 0.4, { poise: 1.5 }); }
    for (const v of this.world.vehicles) if (v.state === 0 && Math.hypot(v.x - sp.x, v.z - sp.z) < R * 0.7 + 3) { v.state = 1; v.vx = f.x * 70; v.vz = f.z * 70; v.vy = 24; v.y = 1; audio.sfx('hit', 0.8); }
    audio.sfx(hits ? 'clang' : 'slash', 0.7);
  }
  special() {
    const P = this.P; const sp = this.mech.special; if (P.spCd > 0 || P.en < sp.cost || P.dead || this.cine?.lock) return; this.spend(sp.cost); P.spCd = sp.cd * P.cdMult; const ap = P.abilityPow; const dm = P.dmgMult; const f = this.facing().clone(); const col = this.profile.mechs[this.mech.id].cust.fx;
    const tgt = P.lock || this.nearest(250, true); if (tgt && !P.lock) P.faceYaw = Math.atan2(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z); const ay = (P.faceT > 0 || tgt) ? P.faceYaw : this.camYaw; P.yaw = ay; P.faceYaw = ay; P.faceT = 0.8; f.set(Math.sin(ay), 0, Math.cos(ay));
    switch (sp.id) {
      case 'blast': P.chargeT = 0.4; audio.sfx('charge', 1); this.fx.ring(P.pos, 14, col, 0.4, false); this.sched(0.4, () => { const m = this.muzzle(); const aim = this.aimPoint(); this.spawnProj({ pos: m, vel: aim.sub(m).normalize().multiplyScalar(95), color: col, size: 4.5, dmg: 560 * dm * ap, aoe: 22, life: 3, trail: true, big: true, crit: true }); P.fireT = 1; P.aimHold = 0.8; this.shakeAdd(1); audio.sfx('rail', 1); this.fx.explosion(m, 1.5, col); }); break;
      case 'dash': { P.dashT = 0.3; P.iT = 0.5; P.dashDir.copy(f); P.dashStrike = true; P.dashHit.clear(); audio.sfx('dash', 1); this.fx.bolt(P.pos.clone().setY(5), P.pos.clone().addScaledVector(f, 45).setY(5), col, 1, 0.3, 9); break; }
      case 'smash': P.vel.y = 12; this.sched(0.25, () => { const c = P.pos.clone().addScaledVector(f, 12 * P.scale).setY(0); this.slamFx(c, 32, col); this.fx.ring(c, 44, '#ffffff', 0.7); this.aoe(c, 32, 480 * dm * ap, { poise: 3, kb: 40 }); this.shakeAdd(1.2); this.world.hit(c.x, 2, c.z, 38, 800); }); break;
      case 'teleport': { let np: THREE.Vector3; if (tgt) { const bf = V(Math.sin(tgt.yaw), 0, Math.cos(tgt.yaw)); np = tgt.pos.clone().addScaledVector(bf, -(tgt.radius + 9)).setY(0); } else np = P.pos.clone().addScaledVector(f, 45); np.x = clamp(np.x, -this.world.half + 8, this.world.half - 8); np.z = clamp(np.z, -this.world.half + 8, this.world.half - 8);
        this.fx.burst(P.pos.clone().setY(5), 30, col, 40, 1.6, 0.6, 0, true); this.fx.ring(P.pos, 16, col, 0.5); P.pos.copy(np); P.iT = 0.6; audio.sfx('dash', 1); this.fx.burst(P.pos.clone().setY(5), 30, col, 40, 1.6, 0.6, 0, true); this.fx.ring(P.pos, 16, col, 0.5); this.fx.flash(P.pos.clone().setY(5), col, 5, 60);
        if (tgt) { P.yaw = P.faceYaw = Math.atan2(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z); P.atk = 0.36; P.atkType = 'slash'; P.combo = 2; P.hitDone = true; P.atkDur = 0.5; this.sched(0.12, () => { const c = this.center(tgt); this.fx.slash(this.chest().clone().addScaledVector(this.facing(), 8), P.yaw, 0.5, 18, col); this.fx.slash(this.chest().clone().addScaledVector(this.facing(), 8), P.yaw, -0.5, 18, '#ffffff'); this.damageEnemy(tgt, 400 * dm * ap, this.weakPos(tgt), { crit: true, poise: 2.5 }); this.hitstop = 0.08; void c; }); } break; }
      case 'shield': P.shield = { hp: 700 * ap, max: 700 * ap, t: 8 }; audio.sfx('shield', 1); this.fx.ring(P.pos, 20, col, 0.6); break;
      case 'flame': { audio.sfx('flame', 1); for (let i = 0; i < 12; i++) this.sched(i * 0.1, () => { const m = this.muzzle(); const fd = f.clone(); for (let k = 0; k < 6; k++) this.fx.emit(m, fd.clone().multiplyScalar(45 + Math.random() * 25).add(V((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14)), k % 2 ? '#ff7a1a' : '#ffd070', 3 + Math.random() * 2, 0.6, true, -3, 0.5, 1.4);
          for (const e of this.aliveEnemies()) { const c = this.center(e); const d = _a.copy(c).sub(P.pos).setY(0); const dist = d.length(); if (dist - e.radius < 58 && d.normalize().dot(fd) > 0.55) this.damageEnemy(e, 62 * dm * ap, c.clone().addScaledVector(d, -e.radius * 0.5), { status: 'burn', dot: false, poise: 0.5 }); } this.world.hit(P.pos.x + fd.x * 30, 3, P.pos.z + fd.z * 30, 18, 40); audio.sfx('flame', 0.5); }); break; }
      case 'freeze': { this.fx.ring(P.pos, 48, '#9ff4ff', 0.7); this.fx.ring(P.pos, 30, '#ffffff', 0.5); this.fx.burst(P.pos.clone().setY(4), 40, '#cfffff', 50, 1.8, 0.9, 5); audio.sfx('freeze', 1); this.aoe(P.pos.clone(), 46, 230 * dm * ap, { status: 'freeze', poise: 2 }); this.shakeAdd(0.6); break; }
      case 'chain': { let cur: Enemy | null = tgt || null; if (!cur) { this.fx.bolt(this.chest().clone(), this.chest().clone().addScaledVector(f, 50), col, 0.8, 0.3); break; } let from = this.chest().clone(); const hit = new Set<Enemy>(); audio.sfx('thunder', 0.8);
        for (let i = 0; i < 6 && cur; i++) { const e: Enemy = cur; hit.add(e); const c = this.center(e).clone(); const k = i; this.sched(i * 0.09, () => { this.fx.bolt(from.clone(), c, col, 0.8, 0.3, 8); this.fx.flash(c, col, 3, 50, 0.2); if (!e.dead) this.damageEnemy(e, 320 * dm * ap * Math.pow(0.88, k), this.weakPos(e), { status: 'shock', poise: 1.5 }); this.fx.burst(c, 8, col, 30, 1.2, 0.4); });
          from = c; let nx: Enemy | null = null; let bd = 55; for (const o of this.aliveEnemies()) if (!hit.has(o)) { const d = o.pos.distanceTo(e.pos) - o.radius; if (d < bd) { bd = d; nx = o; } } cur = nx; } break; }
      case 'dive': { if (P.grounded) { P.vel.y = 46; P.diveState = 'rise'; P.grounded = false; audio.sfx('jump', 1); this.fx.dust(P.pos.clone(), 12, 14); this.sched(0.5, () => { P.diveState = 'dive'; const t = P.lock || this.nearest(250); if (t) { const d = _a.copy(t.pos).sub(P.pos).setY(0); const l = d.length(); d.normalize(); P.vel.x = d.x * Math.min(70, l * 1.6); P.vel.z = d.z * Math.min(70, l * 1.6); } else { P.vel.x = f.x * 30; P.vel.z = f.z * 30; } P.vel.y = -110; P.iT = 0.2; }); } else { P.diveState = 'dive'; P.vel.y = -110; P.vel.x = f.x * 40; P.vel.z = f.z * 40; } break; }
      case 'shockwave': { const c = P.pos.clone(); this.slamFx(c, 55, col); for (let i = 1; i <= 3; i++) this.sched(i * 0.12, () => { this.fx.ring(c, 55 + i * 10, i % 2 ? '#ffffff' : col, 0.6); this.shakeAdd(0.3); }); this.aoe(c, 56, 400 * dm * ap, { kb: 70, poise: 3 }); this.clearEnemyProjs(c, 70); P.iT = 0.4; this.fx.vring(c.clone().setY(5), 40, col, 0, 0.5); break; }
    }
    audio.sfx('servo', 0.5); void tgt;
  }
  ultimate() {
    const P = this.P; if (P.ult < 100 || P.dead || this.cine?.lock || P.ultT > 0) return; const id = this.mech.ultimate.id; const en = this.aliveEnemies(); if (!en.length && id !== 'fortress' && id !== 'sunder') { this.msg('NO TARGETS', 1); return; }
    P.ult = 0; P.ultT = 1.9; P.iT = 1.9; this.ults++; this.cineStart('ult', 1.5); this.slowMo(0.35, 1.2); audio.sfx('ult', 1); this.msg(this.mech.ultimate.name.toUpperCase(), 2); const col = this.profile.mechs[this.mech.id].cust.fx; const dm = P.dmgMult; P.fireT = 1; P.aimHold = 1.5;
    const f = V(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)); const tg = P.lock || this.nearest(300, true) || this.nearest(300); if (tg) { P.yaw = P.faceYaw = Math.atan2(tg.pos.x - P.pos.x, tg.pos.z - P.pos.z); f.set(Math.sin(P.yaw), 0, Math.cos(P.yaw)); } else { P.yaw = P.faceYaw = this.camYaw; } P.faceT = 2;
    this.fx.ring(P.pos, 30, col, 0.8); this.fx.burst(this.chest().clone(), 40, col, 40, 1.6, 0.8, 0, true, 1.5, 1);
    const go = (delay: number, fn: () => void) => this.sched(delay, fn);
    switch (id) {
      case 'sunder': go(0.35, () => { const o = this.chest().clone(); const end = o.clone().addScaledVector(f, 150); this.fx.beam(o, end, col, 9, 0.5); this.fx.beam(o, end, '#ffffff', 3, 0.4); for (let i = 0; i < 4; i++) this.fx.slash(o.clone().addScaledVector(f, 14 + i * 14), P.yaw, (i - 1.5) * 0.4, 30 + i * 6, i % 2 ? '#ffffff' : col);
        for (const e of this.aliveEnemies()) { const c = this.center(e); const d = _a.copy(c).sub(P.pos).setY(0); const dist = d.length(); if (dist < 170 && d.normalize().dot(f) > 0.55) this.damageEnemy(e, 1300 * dm, this.weakPos(e), { crit: true, poise: 5 }); }
        for (let i = 1; i < 11; i++) { const q = P.pos.clone().addScaledVector(f, i * 14); this.world.hit(q.x, 3, q.z, 14, 600); if (i % 2) this.fx.crack(q.x, q.z, 10); } this.shakeAdd(2); audio.sfx('bigExplode', 1); }); break;
      case 'thunder': for (let i = 0; i < 8; i++) go(0.3 + i * 0.1, () => { const e = en[i % Math.max(1, en.length)]; const x = e && !e.dead ? e.pos.x : P.pos.x + (Math.random() - 0.5) * 80; const z = e && !e.dead ? e.pos.z : P.pos.z + (Math.random() - 0.5) * 80; this.fx.bolt(V(x, 160, z), V(x, 0, z), '#e8f6ff', 1.6, 0.4, 12); this.fx.flash(V(x, 10, z), col, 8, 120, 0.4); this.fx.ring(V(x, 0, z), 22, col, 0.6); this.aoe(V(x, 2, z), 16, 800 * dm, { status: 'shock', poise: 3 }); this.shakeAdd(0.5); audio.sfx('thunder', 0.8); }); break;
      case 'quake': [38, 52, 66].forEach((r, i) => go(0.35 + i * 0.4, () => { const c = P.pos.clone().setY(0); this.slamFx(c, r, col); this.fx.ring(c, r * 1.3, '#ffffff', 0.7); this.aoe(c, r, (650 + i * 150) * dm, { kb: 50, poise: 4 }); this.world.hit(c.x, 2, c.z, r, 1200); this.shakeAdd(1.4); P.vel.y = i === 2 ? 0 : 10; })); break;
      case 'phantom': for (let i = 0; i < 7; i++) go(0.3 + i * 0.15, () => { const al = this.aliveEnemies(); if (!al.length) return; const e = al[i % al.length]; const a = Math.random() * TAU; P.pos.set(e.pos.x + Math.cos(a) * (e.radius + 7), e.pos.y > 4 ? 0 : 0, e.pos.z + Math.sin(a) * (e.radius + 7)); P.yaw = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z); this.fx.burst(this.chest().clone(), 14, col, 40, 1.4, 0.5); const cc = this.center(e); this.fx.slash(cc.clone(), P.yaw, Math.random() * 3, e.radius * 1.2, col); this.fx.slash(cc.clone(), P.yaw, Math.random() * 3, e.radius * 1.2, '#ffffff'); this.damageEnemy(e, 520 * dm, this.weakPos(e), { crit: true, poise: 2 }); audio.sfx('slash', 1); this.shakeAdd(0.3); P.atk = 0.4; P.combo = i % 3; P.atkType = 'slash'; }); break;
      case 'fortress': go(0.3, () => { P.shield = { hp: 1400, max: 1400, t: 9 }; const m = this.muzzle(); const end = m.clone().addScaledVector(f, 170); this.fx.beam(m, end, col, 10, 0.7); this.fx.beam(m, end, '#ffffff', 4, 0.5); for (const e of this.aliveEnemies()) { const c = this.center(e); const t = _a.copy(c).sub(m).dot(f); if (t < 0 || t > 180) continue; if (_b.copy(m).addScaledVector(f, t).distanceTo(c) < e.radius + 12) this.damageEnemy(e, 1600 * dm, this.weakPos(e), { crit: true, poise: 5 }); } for (let i = 1; i < 12; i++) { const q = P.pos.clone().addScaledVector(f, i * 14); this.world.hit(q.x, 3, q.z, 12, 500); } this.shakeAdd(2.2); audio.sfx('bigExplode', 1); this.fx.explosion(end, 4, col); }); break;
      case 'inferno': for (let i = 0; i < 14; i++) go(0.3 + i * 0.09, () => { const e = en[i % Math.max(1, en.length)]; const x = i < en.length * 2 && e && !e.dead ? e.pos.x + (Math.random() - 0.5) * 8 : P.pos.x + (Math.random() - 0.5) * 140; const z = i < en.length * 2 && e && !e.dead ? e.pos.z + (Math.random() - 0.5) * 8 : P.pos.z + (Math.random() - 0.5) * 140; for (let k = 0; k < 16; k++) this.fx.emit(V(x + (Math.random() - 0.5) * 10, 0.5, z + (Math.random() - 0.5) * 10), V((Math.random() - 0.5) * 6, 30 + Math.random() * 40, (Math.random() - 0.5) * 6), '#ff7a1a', 2.4, 1.2, true, 25, 0.2, 1); this.fx.explosion(V(x, 3, z), 2.4, '#ff6a14'); this.aoe(V(x, 2, z), 15, 450 * dm, { status: 'burn', poise: 2 }); this.shakeAdd(0.3); audio.sfx('bigExplode', 0.5); this.fx.crack(x, z, 12); }); break;
      case 'blizzard': go(0.35, () => { this.fx.ring(P.pos, 140, '#cfffff', 1); this.fx.burst(this.chest().clone(), 80, '#cfffff', 90, 2, 1.2, 5); audio.sfx('freeze', 1); for (const e of this.aliveEnemies()) { if (e.pos.distanceTo(P.pos) < 160) this.damageEnemy(e, 600 * dm, this.center(e), { status: 'freeze', poise: 2 }); } this.shakeAdd(1); this.sched(2.0, () => { audio.sfx('bigExplode', 1); for (const e of this.enemies) if (!e.dead && (e.frozen > 0 || e.slow > 0)) { this.fx.burst(this.center(e), 30, '#cfffff', 50, 2, 0.8, 20); this.fx.explosion(this.center(e), 2, '#9ff4ff'); this.damageEnemy(e, 750 * dm, this.weakPos(e), { crit: true, poise: 4 }); } this.shakeAdd(1); }); }); break;
      case 'railstorm': for (let i = 0; i < 10; i++) go(0.3 + i * 0.13, () => { const al = this.aliveEnemies(); const e = al.length ? al[i % al.length] : null; const x = e ? e.pos.x + (Math.random() - 0.5) * e.radius : P.pos.x + (Math.random() - 0.5) * 80; const z = e ? e.pos.z + (Math.random() - 0.5) * e.radius : P.pos.z + (Math.random() - 0.5) * 80; this.fx.beam(V(x, 200, z), V(x, 0, z), col, 5, 0.35); this.fx.beam(V(x, 200, z), V(x, 0, z), '#ffffff', 1.6, 0.25); this.fx.ring(V(x, 0, z), 20, col, 0.5); this.fx.explosion(V(x, 3, z), 2, col); this.aoe(V(x, 3, z), 14, 640 * dm, { status: 'shock', poise: 3 }); this.shakeAdd(0.5); audio.sfx('rail', 0.9); }); break;
      case 'skyfall': for (let i = 0; i < 24; i++) go(0.3 + i * 0.05, () => { const al = this.aliveEnemies(); const t = al.length ? al[i % al.length] : null; const a = Math.random() * TAU; this.spawnProj({ pos: V(P.pos.x + Math.cos(a) * 20, 70 + Math.random() * 20, P.pos.z + Math.sin(a) * 20), vel: V((Math.random() - 0.5) * 20, -40, (Math.random() - 0.5) * 20), color: col, size: 0.9, dmg: 170 * dm, aoe: 10, life: 5, trail: true, homing: true, target: t }); audio.sfx('shoot_rocket', 0.4); }); break;
      case 'omega': for (let i = 0; i < 13; i++) go(0.3 + i * 0.18, () => { const m = this.muzzle(); const ang = P.yaw + (i / 12 - 0.5) * 1.6; const d = V(Math.sin(ang), -0.04, Math.cos(ang)); const end = m.clone().addScaledVector(d, 150); end.y = Math.max(0, end.y); this.fx.beam(m, end, col, 9, 0.25); this.fx.beam(m, end, '#ffffff', 3.5, 0.2); const fl = d.clone().setY(0).normalize(); for (const e of this.aliveEnemies()) { const c = this.center(e); const t = _a.copy(c).sub(m).dot(d); if (t < 0 || t > 170) continue; if (_b.copy(m).addScaledVector(d, t).distanceTo(c) < e.radius + 11) this.damageEnemy(e, 290 * dm, this.weakPos(e), { poise: 1.5 }); } for (let k = 1; k < 10; k++) { const q = P.pos.clone().addScaledVector(fl, k * 15); this.world.hit(q.x, 3, q.z, 11, 260); } this.fx.explosion(end, 2, col); this.shakeAdd(0.6); audio.sfx('laser', 1); if (i === 12) { const c = P.pos.clone().addScaledVector(f, 50).setY(0); this.slamFx(c, 50, col); this.aoe(c, 50, 1100 * dm, { poise: 4 }); audio.sfx('bigExplode', 1); } }); break;
    }
  }
  transform() {
    const P = this.P; const t = this.mech.transform; if (P.dead || this.cine?.lock) return; if (P.tfT > 0) { P.tfT = 0; return; } if (P.tfCd > 0 || P.en < 35) { if (P.tfCd <= 0) this.msg('LOW ENERGY', 1); return; }
    this.spend(35); P.tfT = t.dur; P.tfCd = t.cd; this.transforms++; this.cineStart('transform', 1.1); this.slowMo(0.4, 0.9); audio.sfx('transform', 1); this.msg(t.name.toUpperCase(), 2); const col = this.profile.mechs[this.mech.id].cust.fx;
    this.fx.ring(P.pos, 24, col, 0.9); this.fx.ring(P.pos, 14, '#ffffff', 0.6); this.fx.burst(this.chest().clone(), 50, col, 50, 1.6, 0.9, 0, true, 1.5, 1); this.fx.flash(this.chest().clone(), col, 6, 80, 0.8); P.iT = 1.0; P.ultT = Math.max(P.ultT, 0.6);
  }
  vent() { const P = this.P; if (P.ventCd > 0 || P.dead) return; P.ventCd = 8; P.en = Math.min(P.maxEn, P.en + P.maxEn * 0.3); this.fx.burst(this.chest().clone(), 24, '#cfefff', 30, 1.5, 0.8, -4, false); audio.sfx('freeze', 0.6); this.msg('COOLANT VENTED', 1); }

  // ------------------------------------------------------------------ main update
  updatePlayer(dt: number, rawDt: number) {
    const P = this.P; const S = P.scale; const locked = !!this.cine?.lock || P.ultT > 0 && false; const tf = this.tf(); const st = this.settings; const was = (a: string) => !locked && !P.dead && input.was(a); const held = (a: string) => !locked && !P.dead && input.down(a);
    // timers
    P.atkCd -= dt; P.comboT -= dt; P.dashCd -= dt; P.dashT -= dt; P.iT -= dt; P.spCd -= dt; P.tfCd -= dt; P.hitT = Math.max(0, P.hitT - dt * 4); P.fireT = Math.max(0, P.fireT - dt * 5); P.aimHold -= dt; P.chargeT = Math.max(0, P.chargeT - dt); P.ventCd -= dt; P.faceT -= dt; P.ultT -= dt; P.comboHitT -= dt; if (P.comboHitT <= 0) P.comboHits = 0;
    if (P.iT <= 0) P.dashPerfect = false; if (P.tfT > 0) { P.tfT -= dt; if (P.tfT <= 0) { this.msg('MODE ENDED', 1); } }
    P.tfK = lerp(P.tfK, P.tfT > 0 ? 1 : 0, Math.min(1, dt * 2.5)); this.model.setTransform(P.tfK); if (tf?.cloak || (P.tfK > 0 && this.mech.transform.cloak)) this.model.setCloak(P.tfK); else this.model.setCloak(0);
    if (P.shield) { P.shield.t -= dt; if (P.shield.t <= 0) P.shield = null; }
    if (P.dead) { P.deadT += dt; return; }
    // energy & armor regen
    P.enDelay -= dt; if (P.enDelay <= 0) P.en = Math.min(P.maxEn, P.en + P.enRegen * (this.mech.id === 'omega' && tf ? 2 : 1) * dt);
    if (this.t - P.lastHurt > 5) { P.armor = Math.min(P.maxArmor, P.armor + P.maxArmor * 0.03 * dt); } if (this.upgrades.regen) P.hp = Math.min(P.maxHp, P.hp + this.upgrades.regen * dt);
    // camera look
    if (!locked) {
      const sens = 0.0023 * st.sens; this.camYaw -= input.mdx * sens; this.camPitch = clamp(this.camPitch + input.mdy * sens * (st.invertY ? -1 : 1), -0.2, 1.15);
      if (P.lock && !P.lock.dead) { const ty = Math.atan2(P.lock.pos.x - P.pos.x, P.lock.pos.z - P.pos.z); this.camYaw += angDiff(this.camYaw, ty) * Math.min(1, dt * 3.5) * (Math.abs(input.mdx) > 2 ? 0.2 : 1); this.camPitch = lerp(this.camPitch, clamp(0.28 + (P.pos.distanceTo(P.lock.pos) < 40 ? 0.1 : 0), 0, 0.8), Math.min(1, dt * 2)); }
    }
    // lock handling
    if (P.lock && (P.lock.dead || P.lock.pos.distanceTo(P.pos) > 320)) P.lock = null;
    if (was('lock')) { const al = this.aliveEnemies().sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos)); if (al.length) { const i = P.lock ? al.indexOf(P.lock) : -1; P.lock = al[(i + 1) % al.length]; audio.sfx('ui', 0.6); } }
    if (was('aimlock')) { if (P.lock) { P.lock = null; } else { const c = this.cam.position; const d = this.cam.getWorldDirection(_b).clone(); let best: Enemy | null = null; let ba = 0.6; for (const e of this.aliveEnemies()) { const v = _a.copy(this.center(e)).sub(c).normalize(); const a = Math.acos(clamp(v.dot(d), -1, 1)); if (a < ba) { ba = a; best = e; } } P.lock = best; if (best) audio.sfx('ui', 0.6); } }
    if (!P.lock && this.isTouch && (input.attack) ) { const n = this.nearest(200, true); if (n) P.lock = n; }
    // movement
    const ax = locked ? { x: 0, y: 0 } : input.axis(); const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw); let mx = ax.x * -cy + ax.y * sy, mz = ax.x * sy + ax.y * cy; P.moveMag = Math.hypot(mx, mz);
    const busy = P.atk > 0 && WEAPONS[P.weapons[P.wi]].kind === 'melee'; const flying = !!tf?.fly; P.guard = held('guard') && P.en > 1 && P.dashT <= 0 && !P.ultT; if (P.guard) { P.guardT += dt; this.spend(5 * dt); } else P.guardT = 0;
    const spd = P.baseSpeed * (tf?.spd ?? 1) * (P.guard ? 0.45 : 1) * (busy ? 0.55 : 1) * (P.chargeT > 0 ? 0.3 : 1) * (this.mech.id === 'sky' && flying ? 1.2 : 1); const dx = mx * spd, dz = mz * spd; const acc = (P.grounded || flying ? 60 : 24) * (1 + P.baseSpeed * 0.01) * dt;
    if (P.dashT > 0) { P.vel.x = P.dashDir.x * (P.dashStrike ? 150 : 82 * (1 + 0.04 * (this.profile.mechs[this.mech.id].up.speed || 0))); P.vel.z = P.dashDir.z * (P.dashStrike ? 150 : 82); }
    else { P.vel.x += clamp(dx - P.vel.x, -acc, acc); P.vel.z += clamp(dz - P.vel.z, -acc, acc); if (P.dashStrike) { P.dashStrike = false; P.vel.multiplyScalar(0.3); } }
    if (was('dash') && P.dashCd <= 0 && P.en >= 12 && P.dashT <= 0) { const d = P.moveMag > 0.1 ? V(mx, 0, mz).normalize() : this.facing().clone(); P.dashDir.copy(d); P.dashT = 0.26; P.iT = Math.max(P.iT, 0.36); P.dashCd = 0.7; P.dashStrike = false; this.spend(12); audio.sfx('dash', 1); this.fx.burst(this.chest().clone(), 12, '#cfefff', 25, 1.2, 0.4); this.fx.ring(P.pos, 10, '#ffffff', 0.35); P.yaw = Math.atan2(d.x, d.z); P.dashPerfect = false; this.fx.dust(P.pos.clone(), 8, 10); }
    if (P.dashT > 0) { this.fx.burst(this.chest().clone().add(V((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, 0)), 2, this.profile.mechs[this.mech.id].cust.fx, 8, 1.6 * S, 0.35, 0, true); if (P.dashStrike) { for (const e of this.aliveEnemies()) if (!P.dashHit.has(e) && e.pos.distanceTo(P.pos) - e.radius < 11) { P.dashHit.add(e); this.damageEnemy(e, 260 * P.dmgMult * P.abilityPow, this.center(e), { status: 'shock', poise: 2, crit: true }); this.fx.bolt(this.chest().clone(), this.center(e), '#fff6a0', 0.7, 0.25); this.hitstop = 0.05; } this.fx.bolt(this.chest().clone(), this.chest().clone().addScaledVector(P.dashDir, -14), '#fff36b', 0.6, 0.2, 5); } }
    // jump / fly
    if (flying) { if (held('jump')) P.vel.y = Math.min(24, P.vel.y + 90 * dt); else if (P.pos.y > 0.1) P.vel.y = lerp(P.vel.y, held('guard') ? -22 : -2.5, Math.min(1, dt * 3)); if (P.pos.y > 38) P.vel.y = Math.min(P.vel.y, 0); if (P.pos.y > 0.4 && Math.random() < dt * 30) this.fx.emit(P.pos.clone().add(V(0, 3, 0)), V((Math.random() - 0.5) * 4, -14, (Math.random() - 0.5) * 4), '#ffb070', 2, 0.35, true); P.grounded = P.pos.y <= 0.05; }
    else {
      if (was('jump') && P.grounded) { P.vel.y = 29 * (this.mech.id === 'sky' ? 1.15 : 1) / Math.sqrt(S * 0.8 + 0.2); P.grounded = false; audio.sfx('jump', 0.9); this.fx.dust(P.pos.clone(), 10 * S, 12); this.fx.ring(P.pos, 8 * S, '#ffffff', 0.35); }
      if (!P.grounded) { P.vel.y -= 68 * dt; if (held('jump') && P.vel.y < 6 && P.en > 4 && P.diveState === '' && P.vel.y > -30) { P.vel.y = Math.min(P.vel.y + 100 * dt, 9); this.spend(15 * dt); if (Math.random() < dt * 40) this.fx.emit(P.pos.clone().add(V(0, 2, 0)), V((Math.random() - 0.5) * 3, -16, (Math.random() - 0.5) * 3), '#ffb070', 1.8, 0.3, true); } }
    }
    P.pos.addScaledVector(P.vel, dt);
    if (P.pos.y <= 0) { const imp = -P.vel.y; if (!P.grounded && imp > 8) { this.fx.dust(P.pos.clone(), 12 * S, 16); audio.sfx('land', clamp(imp / 40, 0.3, 1)); this.shakeAdd(Math.min(0.8, imp / 60) * S); if (imp > 28 && S >= 1.2) { this.slamFx(P.pos.clone(), 14, '#ffd0a0'); this.aoe(P.pos.clone(), 14, 70 * P.dmgMult, {}); } }
      if (P.diveState === 'dive') { P.diveState = ''; const c = P.pos.clone().setY(0); this.slamFx(c, 28, this.profile.mechs[this.mech.id].cust.fx); this.fx.ring(c, 40, '#ffffff', 0.6); this.aoe(c, 28, 560 * P.dmgMult * P.abilityPow, { poise: 3, kb: 40, crit: true }); this.shakeAdd(1.2); }
      if (P.diveState === 'rise') P.diveState = 'rise'; P.pos.y = 0; P.vel.y = 0; P.grounded = true; if (P.diveState === 'rise') P.diveState = ''; }
    else if (!flying) P.grounded = false;
    const h = this.world.half - 6; P.pos.x = clamp(P.pos.x, -h, h); P.pos.z = clamp(P.pos.z, -h, h);
    this.world.collide(P.pos, P.radius * 0.8, 13 * S, (P.dashT > 0 ? 1500 : 500), dt); if (P.grounded && this.world.hazardAt(P.pos.x, P.pos.z)) { this.hurtPlayer(26 * dt, null, { dot: true }); if (Math.random() < dt * 8) this.fx.burst(P.pos.clone().setY(1), 2, '#ff7a1a', 12, 1.4, 0.5, 4); }
    // facing
    const aiming = input.aim && !locked; const wDef = WEAPONS[P.weapons[P.wi]]; let tyaw = P.yaw;
    if (P.faceT > 0) tyaw = P.faceYaw; else if (P.guard || aiming || P.lock) tyaw = P.lock ? Math.atan2(P.lock.pos.x - P.pos.x, P.lock.pos.z - P.pos.z) : this.camYaw; else if (P.moveMag > 0.1) tyaw = Math.atan2(mx, mz); else if (input.attack && wDef.kind === 'ranged') tyaw = this.camYaw;
    if (P.dashT <= 0) P.yaw += angDiff(P.yaw, tyaw) * Math.min(1, dt * (9 / Math.sqrt(S)));
    // weapons
    if (was('switch')) { P.wi = (P.wi + 1) % 3; this.model.setWeapon(P.weapons[P.wi]); audio.sfx('servo', 1); this.msg(WEAPONS[P.weapons[P.wi]].name.toUpperCase(), 1.2); P.atk = 0; P.atkCd = 0.15; }
    if (was('reload')) this.vent(); if (was('special')) this.special(); if (was('ultimate')) this.ultimate(); if (was('transform')) this.transform();
    const w = WEAPONS[P.weapons[P.wi]]; const atkHeld = held('attack') || (!locked && input.attack);
    if (w.kind === 'melee') {
      if (P.atk > 0) { P.atk += dt / P.atkDur; if (!P.hitDone && P.atk >= 0.42) { P.hitDone = true; this.meleeHit(w); } if (P.atk >= 1) { P.atk = 0; } }
      if (atkHeld && !P.guard && P.dashT <= 0 && !P.dead && P.ultT <= 0 && (P.atk === 0 || P.atk >= 0.72) && P.atkCd <= 0) this.startMelee(w);
    } else { P.atk = 0; if (atkHeld && !P.guard && P.dashT <= 0 && P.atkCd <= 0 && P.ultT <= 0 && P.chargeT <= 0) this.fireRanged(w); }
    // aura
    if (tf?.aura && tf.aura !== 'none') { P.auraT -= dt; if (P.auraT <= 0) { P.auraT = 0.5; const col = tf.aura === 'burn' ? '#ff7a2e' : tf.aura === 'frost' ? '#9ff4ff' : '#fff36b'; this.fx.ring(P.pos, 24, col, 0.5); for (const e of this.aliveEnemies()) if (e.pos.distanceTo(P.pos) - e.radius < 26) { this.damageEnemy(e, tf.aura === 'frost' ? 6 : 38 * P.dmgMult, null, { dot: true, status: tf.aura === 'burn' ? 'burn' : tf.aura === 'frost' ? 'slow' : 'shock' }); if (tf.aura === 'shock') this.fx.bolt(this.chest().clone(), this.center(e), '#fff36b', 0.4, 0.15, 5); } } }
    // flying vehicles vs enemies
    for (const v of this.world.vehicles) if (v.state === 1) for (const e of this.aliveEnemies()) if (Math.hypot(v.x - e.pos.x, v.z - e.pos.z) < e.radius + 2 && v.y < e.radius * 1.4) { this.damageEnemy(e, 260 * P.dmgMult, _d.set(v.x, v.y + 1, v.z), { poise: 1.5 }); this.world.explodeVehicle(v); this.world.hit(v.x, 1, v.z, 14, 200); this.world.syncVehicles(); break; }
    // pose / model
    const mv = Math.hypot(P.vel.x, P.vel.z) / P.baseSpeed;
    this.model.group.position.copy(P.pos); this.model.group.rotation.y = P.yaw; this.model.group.rotation.z = 0;
    this.model.update(this.t, dt, { move: P.dashT > 0 ? 0.3 : mv, atk: P.atk, atkType: P.atkType, combo: P.combo, ranged: w.kind === 'ranged', air: !P.grounded && !flying, vy: P.vel.y, dash: P.dashT > 0, hit: P.hitT, guard: P.guard, dead: 0, fire: Math.max(P.fireT, P.aimHold > 0 ? 0.01 : 0), charge: P.chargeT, fly: flying });
    if (this.model.stepped) { this.model.stepped = 0; if (P.grounded && mv > 0.2) { audio.sfx('step', 0.5 * Math.min(1.3, S)); this.shakeAdd(0.05 * S); this.fx.dust(P.pos.clone(), 4 * S, 2); } }
    this.guardDome.visible = P.guard || !!P.shield; if (this.guardDome.visible) { this.guardDome.position.copy(P.pos).setY(P.pos.y + 5 * S); this.guardDome.scale.setScalar((P.shield ? 11 : 8) * S + Math.sin(this.t * 10) * 0.2); (this.guardDome.material as THREE.MeshBasicMaterial).color.set(P.shield ? '#8bffb0' : '#7fe8ff'); }
    void rawDt;
  }

  updatePickups(dt: number) {
    const P = this.P;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i]; k.t -= dt; k.mesh.rotation.y += dt * 2; k.mesh.position.y = 3 + Math.sin(this.t * 3 + i) * 0.8; const d = k.pos.distanceTo(P.pos);
      if (d < 30 && !P.dead) k.pos.lerp(_a.copy(P.pos).setY(3), Math.min(1, dt * (3 + (30 - d) * 0.2)));
      if (d < 7 && !P.dead) { if (k.kind === 'repair') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.2); else if (k.kind === 'energy') P.en = Math.min(P.maxEn, P.en + P.maxEn * 0.5); else P.armor = Math.min(P.maxArmor, P.armor + P.maxArmor * 0.5); audio.sfx('pickup', 0.8); this.fx.burst(k.pos, 8, k.kind === 'repair' ? '#4aff7a' : k.kind === 'energy' ? '#4ac8ff' : '#ffc84a', 16, 1, 0.4); this.scene.remove(k.mesh); this.pickups.splice(i, 1); continue; }
      if (k.t <= 0) { this.scene.remove(k.mesh); this.pickups.splice(i, 1); }
    }
  }

  updateCamera(dt: number, rawDt: number) {
    const P = this.P; const S = P.scale; const cam = this.cam; const st = this.settings; let tp: THREE.Vector3; const look = _b;
    if (this.cine) {
      const c = this.cine; c.t += rawDt; const k = Math.min(1, c.t / c.dur); const ctr = P.pos; const ep = c.e;
      let ang = 0, r = 30, h = 8; const tgt = _c;
      switch (c.kind) {
        case 'intro': ang = this.camYaw + Math.PI - 1.7 + k * 1.7; r = lerp(52, 28 * S, k); h = lerp(5, 12, k); tgt.copy(ctr).setY(6 * S + 2); break;
        case 'boss': if (ep) { ang = Math.atan2(P.pos.x - ep.pos.x, P.pos.z - ep.pos.z) + 0.7 - k * 0.8; r = ep.radius * 2.6 + 52; h = lerp(2, ep.radius * 0.9, Math.min(1, k * 1.3)); tgt.copy(ep.pos).setY(ep.radius * lerp(0.5, 1.0, k)); } break;
        case 'phase': if (ep) { ang = Math.atan2(P.pos.x - ep.pos.x, P.pos.z - ep.pos.z) + 0.4; r = ep.radius * 2.2 + 36; h = ep.radius * 0.5; tgt.copy(ep.pos).setY(ep.radius * 0.8); } break;
        case 'bossDeath': if (ep) { ang = Math.atan2(P.pos.x - ep.pos.x, P.pos.z - ep.pos.z) + k * 2.2; r = ep.radius * 2.6 + 44; h = ep.radius * 0.6 + k * 10; tgt.copy(ep.pos).setY(ep.radius * 0.8); } break;
        case 'ult': ang = this.camYaw + Math.PI + lerp(1.1, -0.2, k); r = 24 * S; h = 5 + k * 4; tgt.copy(ctr).setY(6 * S); break;
        case 'transform': ang = this.camYaw + lerp(0.5, -0.4, k); r = 21 * S; h = 6; tgt.copy(ctr).setY(5.5 * S); break;
      }
      const ex = ep ? 0 : 0; void ex; const cp = _a.set(tgt.x + Math.sin(ang) * r, h + (c.kind === 'boss' || c.kind === 'bossDeath' ? 0 : ctr.y), tgt.z + Math.cos(ang) * r);
      for (let i = 0; i < 12 && this.world.pointHit(cp); i++) cp.y += 7;
      c.blend = Math.min(1, c.blend + rawDt * 3.5); if (c.blend < 1) cam.position.lerpVectors(c.from, cp, c.blend); else cam.position.copy(cp); this.camLook.lerp(tgt, Math.min(1, rawDt * 8)); cam.lookAt(this.camLook);
      if (c.kind === 'boss' || c.kind === 'phase') this.shakeV = Math.max(this.shakeV, 0.25);
      if (c.t >= c.dur) this.cine = null; useHud.setState({ cine: !!this.cine });
    } else {
      const aim = input.aim; const dist = (aim ? 20 : 26) * Math.pow(S, 0.8); const fwd = _c.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)); const right = _d.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
      const phi = this.camPitch; look.copy(P.pos).setY(P.pos.y + 6.5 * S).addScaledVector(right, (aim ? 4.5 : 3) * S);
      const off = _a.set(-Math.sin(this.camYaw) * Math.cos(phi), Math.sin(phi), -Math.cos(this.camYaw) * Math.cos(phi)); let s = 1; tp = _a.clone();
      for (let i = 0; i < 6; i++) { tp.copy(look).addScaledVector(off, dist * s); if (!this.world.pointHit(tp)) break; s -= 0.15; } void fwd;
      if (tp.y < 1.5) tp.y = 1.5; cam.position.lerp(tp, 1 - Math.exp(-dt * 10 * (1 / Math.max(0.2, 1)))); this.camLook.lerp(look, 1 - Math.exp(-rawDt * 14)); cam.lookAt(this.camLook);
    }
    const wantFov = st.fov + (input.aim && !this.cine ? -10 : 0) + (P.dashT > 0 ? 9 : 0) + (this.cine?.kind === 'ult' ? -12 : 0); this.camFov = lerp(this.camFov, wantFov, Math.min(1, rawDt * 8)); if (Math.abs(cam.fov - this.camFov) > 0.01) { cam.fov = this.camFov; cam.updateProjectionMatrix(); }
    this.shakeV *= Math.exp(-rawDt * 4.5); const sk = this.shakeV * st.shake * 0.8; if (sk > 0.01) { cam.position.x += (Math.random() - 0.5) * sk; cam.position.y += (Math.random() - 0.5) * sk; cam.position.z += (Math.random() - 0.5) * sk; }
    if (cam.position.y < 1) cam.position.y = 1;
  }
  updateReticles() {
    const P = this.P; const place = (el: HTMLElement | null, p: THREE.Vector3 | null) => { if (!el) return; if (!p) { el.style.display = 'none'; return; } const v = _a.copy(p).project(this.cam); if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { el.style.display = 'none'; return; } el.style.display = 'block'; el.style.transform = `translate(${((v.x + 1) / 2) * window.innerWidth}px, ${((1 - v.y) / 2) * window.innerHeight}px) translate(-50%,-50%)`; };
    place(this.reticle, P.lock && !P.lock.dead && !this.cine ? this.center(P.lock) : null);
    const boss = this.enemies.find(e => e.isBoss && !e.dead && e.vuln > 0); place(this.weakMark, boss && !this.cine ? this.weakPos(boss).clone() : null);
  }
  updateHud(rawDt: number) {
    this.hudT -= rawDt; this.hudMsgT -= rawDt; this.titleT -= rawDt; if (this.titleT < 0) this.title = null; this.fpsAcc += rawDt; this.fpsN++; if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    if (this.hudT > 0) return; this.hudT = 0.09; const P = this.P; const boss = this.enemies.find(e => e.isBoss && !e.dead && e.state !== 'spawn'); const sp = this.mech.special; const tf = this.mech.transform; const w = WEAPONS[P.weapons[P.wi]];
    useHud.setState({
      hp: P.hp, maxHp: P.maxHp, armor: P.armor, maxArmor: P.maxArmor, en: P.en, maxEn: P.maxEn, weapons: P.weapons, wi: P.wi, wcd: P.atkCd > 0 ? 1 - P.atkCd / Math.max(0.05, w.cd) : 1,
      special: P.spCd > 0 ? 1 - P.spCd / (sp.cd * P.cdMult) : 1, specialCd: Math.max(0, P.spCd), specialCost: sp.cost, ult: P.ult, transformCd: P.tfCd > 0 ? 1 - P.tfCd / tf.cd : 1, transformT: P.tfT, guardCd: P.guard ? 1 : 0, dashCd: P.dashCd > 0 ? 1 - P.dashCd / 0.7 : 1,
      boss: boss ? { name: boss.def.name, hp: boss.hp, max: boss.maxHp, phase: boss.phase, phases: boss.def.phases?.length || 1, vuln: boss.vuln > 0 } : null, lock: !!P.lock, combo: P.comboHits, time: this.time, kills: Object.values(this.kills).reduce((a, b) => a + b, 0), score: Math.round(this.score),
      msg: this.hudMsgT > 0 ? this.hudMsg : '', cine: !!this.cine, title: this.titleT > 0 ? this.title : null, alt: P.tfT > 0 ? tf.name : '', beacon: this.beacon ? Math.max(0, this.beacon.hp / this.beacon.max) : -1, enemies: this.enemies.filter(e => !e.dead).length + (this.M?.queue.length || 0), fps: this.fps,
      integrity: this.world.integrity(), shield: P.shield ? P.shield.hp / P.shield.max : 0, flying: !!tf.fly && P.tfT > 0, mechName: this.mech.name, specialName: sp.name, ultName: this.mech.ultimate.name, altName: tf.name,
    });
    this.achT -= 0.09; if (this.achT < 0) { this.achT = 2; useStore.getState().checkAch({ kills: Object.values(this.kills).reduce((a, b) => a + b, 0), buildings: this.buildingsDown, dodges: this.dodges, counters: this.counters, ults: this.ults, transforms: this.transforms, weak: this.weakHits, bosses: this.bossesDown.length, wave: this.cfg.mode === 'arena' || this.cfg.mode === 'survival' ? this.M.wave : 0 }); }
  }
  setEnvHazard(dt: number) {
    const boss = this.enemies.find(e => e.isBoss && !e.dead); const env = boss?.def.env || (this.theme.hazard && this.cfg.mode !== 'boss' ? this.theme.hazard : this.theme.hazard); if (!env || this.cine || this.over) return;
    this.hazardT -= dt; if (this.hazardT <= 0) { this.hazardT = env.every * (0.8 + Math.random() * 0.5); const n = boss ? 2 : 1; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = 10 + Math.random() * 60; strikeAt(this, clamp(this.P.pos.x + Math.cos(a) * r, -this.world.half + 8, this.world.half - 8), clamp(this.P.pos.z + Math.sin(a) * r, -this.world.half + 8, this.world.half - 8), 12, 70 * this.diff.dmg, env.fx, 1.5); } }
  }
  updateWaves(dt: number) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.r += w.speed * dt; const P = this.P; const d = Math.hypot(P.pos.x - w.x, P.pos.z - w.z);
      if (!w.hit && Math.abs(d - w.r) < 5 + w.r * 0.04 && P.pos.y < 3.8) { w.hit = true; this.hurtPlayer(w.dmg, _a.set(w.x, 0, w.z), { kb: 35, e: w.e }); }
      for (const b of this.world.buildings) { if (b.alive === 0) continue; const bd = Math.hypot(b.x - w.x, b.z - w.z); if (Math.abs(bd - w.r) < 6) { const f = b.floors.find(k => k.alive); if (f) this.world.damageFloor(b, f, w.dmg * 3 * dt * 6); } }
      if (w.r > w.max) this.waves.splice(i, 1);
    }
  }
  updatePieces(dt: number) { for (const p of this.pieces) { p.v.y -= 50 * dt; p.o.position.addScaledVector(p.v, dt); p.o.rotation.x += dt * 3; p.o.rotation.z += dt * 2; if (p.o.position.y < 0.5) { p.o.position.y = 0.5; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; } } }

  update(rawDt: number) {
    const st = useStore.getState(); if (st.paused) { input.endFrame(); return; }
    rawDt = Math.min(rawDt, 0.05); if (this.slowT > 0) { this.slowT -= rawDt; this.timeScale = this.slowS; } else this.timeScale = 1;
    let dt = rawDt * this.timeScale; if (this.hitstop > 0) { this.hitstop -= rawDt; dt *= 0.06; }
    this.t += dt; if (!this.over && !this.cine?.lock) this.time += dt; const P = this.P;
    // schedule
    for (let i = this.sch.length - 1; i >= 0; i--) { this.sch[i].t -= dt; if (this.sch[i].t <= 0) { const f = this.sch[i].fn; this.sch.splice(i, 1); f(); } }
    this.updatePlayer(dt, rawDt);
    if (P.dead) { this.model.update(this.t, dt, { move: 0, atk: 0, atkType: '', combo: 0, ranged: false, air: false, vy: 0, dash: false, hit: 0, guard: false, dead: 1, fire: 0, charge: 0, fly: false }, ); }
    updateEnemies(this, dt); this.updateProjs(dt); this.updateWaves(dt); this.updatePickups(dt); this.updatePieces(dt); this.setEnvHazard(dt);
    if (this.beacon && !this.beacon.dead) { this.beacon.group.children[2].rotation.y += dt; this.beacon.group.children[1].position.y = 14 + Math.sin(this.t * 2) * 0.8; }
    this.world.update(dt, this.t, this.cam.position); this.fx.update(dt);
    // light follow
    this.dirLight.position.set(P.pos.x - 80, 120, P.pos.z - 60); this.dirLight.target.position.copy(P.pos); this.dirLight.target.updateMatrixWorld();
    if (!this.over) updateMode(this, dt);
    this.updateCamera(dt, rawDt); this.updateReticles(); this.updateHud(rawDt);
    if (P.dead && this.over) this.overT += rawDt; input.endFrame();
  }

  finish(win: boolean) {
    if (this.over) return; this.over = true; const m = this.M; const bonus = win && this.cfg.mode === 'campaign' && m.mission ? (m.mission.bonus.t === 'time' ? this.time <= m.mission.bonus.v : this.world.integrity() >= m.mission.bonus.v) : false;
    audio.music(win ? 'victory' : 'defeat'); if (win) audio.sfx('victory', 1); input.exitLock(); input.clear();
    const res: RunResult = { win, cfg: this.cfg, kills: this.kills, xp: Math.round(this.xp), score: Math.round(this.score), time: this.time, wave: m.wave, buildings: this.buildingsDown, dodges: this.dodges, counters: this.counters, ults: this.ults, transforms: this.transforms, weak: this.weakHits, integrity: Math.round(this.world.integrity()), bosses: this.bossesDown, bonus };
    setTimeout(() => { if (gameRef.g === this) useStore.getState().finishRun(res); }, win ? 1200 : 600);
  }
  applyUpgrade(id: string) { modeApplyUpgrade(this, id); }

  dispose() {
    input.active = false; input.exitLock(); input.clear(); audio.music(null); gameRef.g = null;
    this.enemies.forEach(e => { this.scene.remove(e.group); e.model.dispose(); }); this.pickups.forEach(p => this.scene.remove(p.mesh)); this.pieces.forEach(p => this.scene.remove(p.o));
    this.scene.remove(this.model.group, this.projGroup, this.guardDome); this.model.dispose(); this.projGeo.dispose(); this.projMats.forEach(m => m.dispose()); this.pickGeo.dispose(); Object.values(this.pickMats).forEach(m => m.dispose());
    this.guardDome.geometry.dispose(); (this.guardDome.material as THREE.Material).dispose(); this.fx.dispose(); this.world.dispose(); this.lights.forEach(l => this.scene.remove(l)); this.scene.remove(this.dirLight.target); this.scene.background = null; useHud.setState({ boss: null, title: null, cine: false, choices: null, msg: '' });
  }
}
void spawnEnemy; void MONSTERS;
(window as any).__dbg = { spawnEnemy, killEnemy, input };
export type { Theme };
