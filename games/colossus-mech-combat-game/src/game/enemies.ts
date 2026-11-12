// Monster / boss AI, attack patterns, phases, deaths
import * as THREE from 'three';
import { MONSTERS, type MonDef, type Atk } from './data';
import { buildMonster, type MonModel } from './models';
import { audio } from './audio';
import { useStore } from './store';
import type { Game } from './engine';
import type { Tele } from './fx';

const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(); const _b = new THREE.Vector3();
const FXC: Record<string, string> = { fire: '#ff7a1a', ice: '#9ae8ff', lightning: '#bfe6ff', acid: '#8aff3a', water: '#58c8ff', plasma: '#6ad0ff', void: '#c27bff', wind: '#d6f2ff', ink: '#c04aff', lava: '#ff5a14', meteor: '#ff8a2a', ring: '#ff9ad0' };

export interface Act { t: number; dur: number; tick: (dt: number, k: number) => void; end?: () => void; data?: any }
export interface Enemy {
  id: number; def: MonDef; model: MonModel; group: THREE.Group; pos: THREE.Vector3; center: THREE.Vector3; yaw: number; hp: number; maxHp: number; state: string; st: number; atk: Atk | null; cd: number; radius: number;
  isBoss: boolean; phase: number; vuln: number; poise: number; poiseMax: number; slow: number; frozen: number; burn: number; flash: number; dead: boolean; deathT: number; invuln: number; mv: number; wind: number; strike: number;
  tele: Tele[]; pts: THREE.Vector3[]; act: Act | null; tgtBeacon: boolean; orbit: number; burrowed: boolean; grounded: boolean; flying: boolean; dmgMult: number; phaseSpd: number; pieces: { o: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3 }[];
  removeT: number; hitOnce: boolean; spawnDur: number; rise: number; minion: boolean; aimDir: THREE.Vector3; noiseT: number; lastAtk: number; bossMult: number; xpMult: number;
}
let EID = 1;

export function spawnEnemy(g: Game, id: string, pos: THREE.Vector3, o: { hpMult?: number; instant?: boolean; minion?: boolean } = {}) {
  const def = MONSTERS[id]; const model = buildMonster(def); const flying = def.ai === 'fly' || def.ai === 'float'; const boss = !!def.boss;
  const hp = def.hp * g.diff.hp * (o.hpMult || 1);
  const e: Enemy = {
    id: EID++, def, model, group: model.group, pos: pos.clone(), center: V(), yaw: Math.atan2(g.P.pos.x - pos.x, g.P.pos.z - pos.z), hp, maxHp: hp, state: o.instant ? 'chase' : 'spawn', st: 0, atk: null, cd: 1.5 + Math.random(), radius: def.radius,
    isBoss: boss, phase: 0, vuln: 0, poise: 0, poiseMax: hp * (boss ? 0.09 : 0.16), slow: 0, frozen: 0, burn: 0, flash: 0, dead: false, deathT: 0, invuln: 0, mv: 0, wind: 0, strike: 0, tele: [], pts: [], act: null, tgtBeacon: !!g.beacon && !boss && Math.random() < 0.65, orbit: Math.random() < 0.5 ? 1 : -1,
    burrowed: false, grounded: false, flying, dmgMult: g.diff.dmg, phaseSpd: 1, pieces: [], removeT: 0, hitOnce: false, spawnDur: boss ? 3.4 : 1.3, rise: 0, minion: !!o.minion, aimDir: V(0, 0, 1), noiseT: 0, lastAtk: -1, bossMult: 1, xpMult: 1,
  };
  if (flying) e.pos.y = def.alt || 20; else e.pos.y = 0;
  e.group.position.copy(e.pos); e.group.rotation.y = e.yaw; g.scene.add(e.group); g.enemies.push(e); useStore.getState().markSeen(id);
  if (!o.instant) { g.fx.dust(e.pos.clone().setY(0), e.radius * 1.2, 24); g.fx.ring(e.pos, e.radius * 2, '#ffffff', 0.8); }
  if (boss) e.model.setPhase(0);
  return e;
}

export function center(e: Enemy) { return e.center.set(e.pos.x, e.pos.y + (e.flying ? 0 : e.def.hitY), e.pos.z); }

function telegraph(g: Game, e: Enemy, a: Atk, tp: THREE.Vector3) {
  e.tele.forEach(t => t.kill()); e.tele = []; const w = a.w * (e.isBoss ? 1 : 1);
  const fwd = _a.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
  switch (a.t) {
    case 'melee': e.tele.push(g.fx.tele('cone', e.pos.x, e.pos.z, w, a.r[1] + e.radius * 0.6, e.yaw)); break;
    case 'slam': { const o = e.radius * 0.9 + (a.rad || 14) * 0.35; e.tele.push(g.fx.tele('disc', e.pos.x + fwd.x * o, e.pos.z + fwd.z * o, w, a.rad || 14)); break; }
    case 'sweep': case 'pulse': e.tele.push(g.fx.tele('disc', e.pos.x, e.pos.z, w, a.rad || 20)); break;
    case 'charge': e.tele.push(g.fx.tele('line', e.pos.x, e.pos.z, w, (a.dur || 1) * e.def.speed * 3.4 + 10, e.yaw)); g.fx.lineW(e.tele[0], e.radius * 1.4); break;
    case 'leap': case 'dive': e.pts = [tp.clone().setY(0)]; e.tele.push(g.fx.tele('disc', tp.x, tp.z, w + 0.1, a.rad || 10)); break;
    case 'breath': e.tele.push(g.fx.tele('cone', e.pos.x, e.pos.z, w, a.r[1], e.yaw)); break;
    case 'beam': e.tele.push(g.fx.tele('line', e.pos.x, e.pos.z, w, a.r[1], e.yaw)); g.fx.lineW(e.tele[0], 5); break;
    case 'bolts': {
      e.pts = []; const n = a.n || 4; for (let i = 0; i < n; i++) { const p = i === 0 ? tp.clone().addScaledVector(g.P.vel, 0.4) : tp.clone().add(V((Math.random() - 0.5) * 80, 0, (Math.random() - 0.5) * 80)); p.y = 0; clampArena(g, p); e.pts.push(p); }
      break;
    }
    default: break;
  }
}
function clampArena(g: Game, p: THREE.Vector3, m = 8) { const h = g.world.half - m; p.x = THREE.MathUtils.clamp(p.x, -h, h); p.z = THREE.MathUtils.clamp(p.z, -h, h); }

export function strikeAt(g: Game, x: number, z: number, rad: number, dmg: number, fx: string, delay: number, e?: Enemy) {
  const t = g.fx.tele('disc', x, z, delay, rad, 0, FXC[fx] === '#bfe6ff' ? 0xaad8ff : fx === 'water' ? 0x4ac8ff : fx === 'void' ? 0xb04aff : 0xff2a1a);
  g.sched(delay, () => {
    t.kill(); const p = V(x, 0, z); const col = FXC[fx] || '#ff9a3a';
    if (fx === 'lightning' || fx === 'void') { g.fx.bolt(V(x + (Math.random() - 0.5) * 10, 150, z), V(x, 0, z), fx === 'void' ? '#d9a0ff' : '#cfeaff', 1.2, 0.35, 10); g.fx.flash(V(x, 10, z), col, 8, 120, 0.4); g.fx.burst(V(x, 1, z), 14, col, 30, 1.0, 0.5, 20, true); audio.sfx('thunder', 0.5 + g.vol(p) * 0.5); g.fx.ring(p, rad * 1.3, col, 0.5); }
    else if (fx === 'lava') { for (let i = 0; i < 24; i++) g.fx.emit(V(x + (Math.random() - 0.5) * rad, 0.5, z + (Math.random() - 0.5) * rad), V((Math.random() - 0.5) * 8, 30 + Math.random() * 40, (Math.random() - 0.5) * 8), '#ff6a14', 1.6, 1.4, true, 30, 0.2); g.fx.explosion(V(x, 2, z), rad / 7, '#ff5a14'); g.fx.crack(x, z, rad); audio.sfx('bigExplode', g.vol(p) * 0.6); }
    else if (fx === 'meteor') { g.fx.beam(V(x + 40, 160, z + 20), V(x, 0, z), '#ff9a3a', 3, 0.3); g.fx.explosion(V(x, 2, z), rad / 6, '#ff7a1a'); g.fx.crack(x, z, rad * 0.8); audio.sfx('bigExplode', g.vol(p) * 0.6); }
    else if (fx === 'water') { for (let i = 0; i < 22; i++) g.fx.emit(V(x + (Math.random() - 0.5) * rad * 0.6, 0.5, z + (Math.random() - 0.5) * rad * 0.6), V((Math.random() - 0.5) * 10, 28 + Math.random() * 30, (Math.random() - 0.5) * 10), '#8ad8ff', 1.5, 1.4, true, 40, 0.3); g.fx.ring(p, rad * 1.4, '#8ad8ff', 0.6); g.fx.dust(p, rad, 12, '#cfeeff'); audio.sfx('explode', g.vol(p) * 0.5); }
    else g.fx.explosion(V(x, 2, z), rad / 6, col);
    g.eAoe(p, rad, dmg, e, { kb: 18 });
  });
}

function chooseAtk(e: Enemy, d: number): Atk | null {
  const list = e.def.phases ? e.def.phases[e.phase].atks : e.def.attacks.map((_, i) => i); const c: Atk[] = [];
  for (const i of list) { const a = e.def.attacks[i]; if (d >= a.r[0] - 1 && d <= a.r[1] + e.radius * 0.5) { c.push(a); if (i !== e.lastAtk) c.push(a); } }
  if (!c.length) return null; const a = c[Math.floor(Math.random() * c.length)]; e.lastAtk = e.def.attacks.indexOf(a); return a;
}

function exec(g: Game, e: Enemy, a: Atk, tp: THREE.Vector3) {
  e.tele.forEach(t => t.kill()); e.tele = []; const P = g.P; const dmg = a.dmg * e.dmgMult; const fwd = V(Math.sin(e.yaw), 0, Math.cos(e.yaw)); const col = FXC[a.fx || ''] || '#ff9a3a';
  const mouth = (() => { e.group.updateWorldMatrix(true, true); return e.model.mouth.getWorldPosition(V()); })(); const rec = a.rec ?? (e.isBoss ? 0.7 : 0.55);
  const finish = (r = rec) => { e.state = 'recover'; e.st = 0; (e as any).rec = r; };
  const roar = () => { audio.roar(e.def.voice, g.vol(e.pos)); g.shakeAdd(0.2 * g.vol(e.pos) * Math.min(2, e.def.scale)); };
  switch (a.t) {
    case 'melee': {
      e.strike = 1; const to = _a.set(P.pos.x - e.pos.x, 0, P.pos.z - e.pos.z); const d = to.length(); to.normalize();
      const reach = a.r[1] + e.radius * 0.6; g.fx.slash(V(e.pos.x + fwd.x * e.radius * 0.8, e.pos.y + e.def.hitY + 2, e.pos.z + fwd.z * e.radius * 0.8), e.yaw, (Math.random() - 0.5) * 1.2, e.radius * 0.9, FXC[a.fx || ''] || '#ffd0a0');
      if (d - P.radius < reach && fwd.dot(to) > 0.25 && P.pos.y < 8) g.hurtPlayer(dmg, e.pos, { kb: 25, e });
      g.world.hit(e.pos.x + fwd.x * reach * 0.6, 3, e.pos.z + fwd.z * reach * 0.6, 8, dmg * 3); audio.sfx('slash', g.vol(e.pos)); g.shakeAdd(0.25 * g.vol(e.pos)); finish(); break;
    }
    case 'slam': {
      e.strike = 1; const o = e.radius * 0.9 + (a.rad || 14) * 0.35; const c = V(e.pos.x + fwd.x * o, 0, e.pos.z + fwd.z * o); g.slamFx(c, a.rad || 14, col); g.eAoe(c, a.rad || 14, dmg, e, { kb: 22 }); finish(); break;
    }
    case 'sweep': case 'pulse': {
      e.strike = 1; const c = e.pos.clone().setY(0); g.slamFx(c, a.rad || 20, a.t === 'pulse' ? (col === '#ff9a3a' ? '#9ad8ff' : col) : '#ffd0a0'); g.eAoe(c, a.rad || 20, dmg, e, { kb: a.t === 'pulse' ? 45 : 20, sky: e.flying }); if (a.t === 'pulse') { g.fx.vring(e.pos.clone().setY(e.pos.y + e.def.hitY), (a.rad || 20) * 0.8, col, 0, 0.5); g.clearEnemyProjs(c, a.rad || 20); } roar(); finish(); break;
    }
    case 'charge': {
      const sp = e.def.speed * 3.4 * e.phaseSpd; let hit = false; roar(); const dir = fwd.clone();
      e.act = { t: 0, dur: a.dur || 1, tick: (dt) => {
        e.pos.addScaledVector(dir, sp * dt); clampArena(g, e.pos, 2); e.mv = 1.4; g.world.collide(e.pos, e.radius * 0.8, -1, 900, dt);
        if (!hit && Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) < e.radius + P.radius && P.pos.y < 6) { hit = true; g.hurtPlayer(dmg, e.pos, { kb: 50, e }); }
        g.fx.dust(e.pos.clone().setY(0), 3, 1); if (Math.random() < 0.2) g.fx.burst(e.pos.clone().setY(1), 2, '#9a8a70', 8, 1, 0.5, 5, false);
      }, end: () => { g.shakeAdd(0.3); if (e.isBoss) e.vuln = 3; finish(1.2); } }; e.state = 'attack'; e.st = 0; break;
    }
    case 'leap': {
      const from = e.pos.clone(); const to = e.pts[0] || tp.clone(); const dur = 0.9; roar();
      e.act = { t: 0, dur, tick: (_dt, k) => { e.pos.x = THREE.MathUtils.lerp(from.x, to.x, k); e.pos.z = THREE.MathUtils.lerp(from.z, to.z, k); e.pos.y = Math.sin(k * Math.PI) * 18; e.yaw = Math.atan2(to.x - from.x, to.z - from.z); e.mv = 1; },
        end: () => { e.pos.y = 0; g.slamFx(e.pos.clone(), a.rad || 10, col); g.eAoe(e.pos.clone(), a.rad || 10, dmg, e, { kb: 25 }); finish(0.8); } }; e.state = 'attack'; e.st = 0; break;
    }
    case 'dive': {
      const from = e.pos.clone(); const to = e.pts[0] || tp.clone(); const dur = 0.8; roar();
      e.act = { t: 0, dur, tick: (_dt, k) => { const kk = k * k; e.pos.x = THREE.MathUtils.lerp(from.x, to.x, kk); e.pos.z = THREE.MathUtils.lerp(from.z, to.z, kk); e.pos.y = THREE.MathUtils.lerp(from.y, 4, kk); e.yaw = Math.atan2(to.x - from.x, to.z - from.z); e.mv = 1.3; g.fx.burst(e.pos, 1, '#d6f2ff', 5, 1.5, 0.4); },
        end: () => { e.grounded = true; e.vuln = e.isBoss ? 3.4 : 2.4; g.slamFx(V(e.pos.x, 0, e.pos.z), a.rad || 12, col); g.eAoe(V(e.pos.x, 0, e.pos.z), a.rad || 12, dmg, e, { kb: 30 }); finish(e.isBoss ? 3.4 : 2.4); } }; e.state = 'attack'; e.st = 0; break;
    }
    case 'spit': {
      const n = a.n || 3; roar(); for (let i = 0; i < n; i++) {
        const tgt = tp.clone().addScaledVector(P.vel, 0.7).add(V((Math.random() - 0.5) * 12 * (n > 1 ? 1 : 0), 0, (Math.random() - 0.5) * 12)); tgt.y = 0; const dv = tgt.clone().sub(mouth); const dist = Math.hypot(dv.x, dv.z); const sp = 62; const T = Math.max(0.4, dist / sp); const gr = 26;
        g.spawnProj({ pos: mouth.clone(), vel: V(dv.x / T, (dv.y + 0.5 * gr * T * T) / T, dv.z / T), color: col, size: 1.6, dmg, aoe: a.rad || 7, grav: gr, friendly: false, life: 5, src: e, kind: a.fx || 'plasma', trail: true });
      }
      audio.sfx('shoot_plasma', g.vol(e.pos)); finish(); break;
    }
    case 'volley': {
      const n = a.n || 6; const ring = a.fx === 'ring'; const base = Math.atan2(tp.x - mouth.x, tp.z - mouth.z); audio.sfx('shoot_plasma', g.vol(e.pos));
      for (let i = 0; i < n; i++) {
        const ang = ring ? (i / n) * TAU + Math.random() * 0.2 : base + (i / Math.max(1, n - 1) - 0.5) * 0.9; const col2 = ring ? '#ff9ad0' : col;
        const dir = ring ? V(Math.sin(ang), 0, Math.cos(ang)) : _b.copy(tp).setY(P.pos.y + 4).sub(mouth).normalize().applyAxisAngle(V(0, 1, 0), ang - base);
        g.spawnProj({ pos: ring ? e.pos.clone().setY(e.pos.y + (e.flying ? 0 : e.def.hitY)) : mouth.clone(), vel: dir.clone().multiplyScalar(ring ? 38 : 58), color: col2, size: 1.3, dmg, aoe: 4, friendly: false, life: 4, src: e, kind: a.fx || 'plasma', trail: true });
      }
      finish(); break;
    }
    case 'breath': case 'beam': {
      const beam = a.t === 'beam'; const dur = a.dur || 1.8; e.aimDir.copy(tp).setY(P.pos.y + 3).sub(mouth).normalize(); let tk = 0; audio.roar(e.def.voice, g.vol(e.pos)); const range = a.r[1];
      e.act = { t: 0, dur, tick: (dt) => {
        e.group.updateWorldMatrix(true, true); e.model.mouth.getWorldPosition(mouth);
        const want = _b.set(P.pos.x, P.pos.y + 3, P.pos.z).sub(mouth).normalize(); e.aimDir.lerp(want, Math.min(1, dt * (beam ? 0.9 : 1.4))).normalize(); e.yaw += angDiff(e.yaw, Math.atan2(e.aimDir.x, e.aimDir.z)) * Math.min(1, dt * 1.2);
        tk += dt; const end = mouth.clone().addScaledVector(e.aimDir, range); if (end.y < 0) { const k = mouth.y / (mouth.y - end.y); end.copy(mouth).lerp(end, k); }
        if (beam) { g.fx.beam(mouth, end, col, 2.2 + Math.random() * 0.6, 0.12); g.fx.beam(mouth, end, '#ffffff', 0.9, 0.1); if (Math.random() < 0.5) g.fx.burst(end, 2, col, 14, 1.5, 0.4, 8); }
        else for (let i = 0; i < 4; i++) { const v = e.aimDir.clone().multiplyScalar(40 + Math.random() * 25).add(V((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)); g.fx.emit(mouth, v, i % 2 ? col : '#ffe0a0', 2.2 + Math.random() * 1.5, 0.5, true, a.fx === 'fire' ? -4 : 0, 0.6, 1.5); }
        if (tk >= 0.1) {
          tk = 0; const d = _a.copy(P.pos).setY(P.pos.y + 4).sub(mouth); const along = d.dot(e.aimDir); const perp = d.clone().addScaledVector(e.aimDir, -along).length();
          const wid = beam ? 4 + P.radius : 5 + along * 0.22 + P.radius; if (along > 0 && along < range + 5 && perp < wid) g.hurtPlayer(dmg * 0.1, e.pos, { kb: 4, e, dot: true });
          const hp = mouth.clone().addScaledVector(e.aimDir, Math.min(range, along > 0 ? Math.min(along, range) : 30)); if (hp.y < 8) g.world.hit(hp.x, Math.max(1, hp.y), hp.z, 7, dmg * 0.5);
          if (Math.random() < 0.3) audio.sfx(a.fx === 'fire' ? 'flame' : 'laser', g.vol(e.pos) * 0.5);
        }
      }, end: () => { if (e.isBoss && beam) e.vuln = 3; finish(0.9); } }; e.state = 'attack'; e.st = 0; break;
    }
    case 'bolts': {
      const n = e.pts.length; for (let i = 0; i < n; i++) strikeAt(g, e.pts[i].x, e.pts[i].z, a.rad || 9, dmg, a.fx || 'lightning', 0.45 + i * 0.16, e); roar(); if (e.isBoss && (a.fx === 'meteor' || a.fx === 'lava')) e.vuln = 4; finish(0.9 + n * 0.12); break;
    }
    case 'wave': {
      g.waves.push({ x: e.pos.x, z: e.pos.z, r: e.radius, speed: 42, max: 140, dmg, hit: false, color: col, e }); g.fx.ring(e.pos, 140, col, 140 / 42, true, true); e.strike = 1; g.shakeAdd(0.5 * g.vol(e.pos)); audio.sfx('land', g.vol(e.pos)); roar(); if (e.isBoss) e.vuln = 3.2; finish(1.0); break;
    }
    case 'burrow': {
      const dur = a.dur || 2; e.burrowed = true; e.group.visible = false; g.fx.dust(e.pos.clone().setY(0), e.radius * 1.4, 22); audio.sfx('land', g.vol(e.pos)); let t0 = 0;
      e.act = { t: 0, dur, tick: (dt, k) => {
        const to = _a.set(P.pos.x - e.pos.x, 0, P.pos.z - e.pos.z); const d = to.length(); to.normalize(); if (k < 0.85) { e.pos.addScaledVector(to, e.def.speed * 3.2 * dt); e.yaw = Math.atan2(to.x, to.z); } clampArena(g, e.pos, 2);
        t0 += dt; if (t0 > 0.05) { t0 = 0; g.fx.burst(e.pos.clone().setY(1), 3, '#8a7050', 10, 1.8, 0.8, 12, false); g.fx.dust(e.pos.clone().setY(0), 3, 1); } g.world.collide(e.pos, e.radius * 0.5, -1, 300, dt);
        if (k > 0.7 && k < 0.85 && !e.tele.length) e.tele.push(g.fx.tele('disc', e.pos.x, e.pos.z, 0.5, a.rad || 14)); if (k < 0.85) e.tele.forEach(t => t.mesh.position.set(e.pos.x, 0.3, e.pos.z)); void d;
      }, end: () => { e.tele.forEach(t => t.kill()); e.tele = []; e.burrowed = false; e.group.visible = true; g.slamFx(e.pos.clone().setY(0), a.rad || 14, '#b09060'); g.eAoe(e.pos.clone().setY(0), a.rad || 14, dmg, e, { kb: 40 }); g.fx.chunk(e.pos.clone().setY(1), 10, '#7a6040', 30, 1.4); roar(); e.vuln = 2; finish(1.6); } }; e.state = 'attack'; e.st = 0; break;
    }
    case 'summon': {
      const n = a.n || 4; const minions = g.enemies.filter(m => m.minion && !m.dead).length; roar(); g.fx.ring(e.pos, 50, '#c27bff', 0.9);
      for (let i = 0; i < n && minions + i < 8; i++) { const ang = Math.random() * TAU, r = 25 + Math.random() * 25; const p = V(e.pos.x + Math.cos(ang) * r, 0, e.pos.z + Math.sin(ang) * r); clampArena(g, p); const m = spawnEnemy(g, 'riftspawn', p, { minion: true, hpMult: 0.8 }); m.xpMult = 0; g.fx.explosion(p.clone().setY(3), 1.2, '#b06aff'); }
      finish(1.2); break;
    }
    default: finish();
  }
}

function phaseTransition(g: Game, e: Enemy) {
  e.phase++; e.state = 'phase'; e.st = 0; e.invuln = 2.6; e.tele.forEach(t => t.kill()); e.tele = []; e.act = null; if (e.burrowed) { e.burrowed = false; e.group.visible = true; }
  e.model.setPhase(e.phase); e.phaseSpd = e.def.phases![e.phase].spd; audio.roar(e.def.voice, 1); audio.sfx('bigExplode', 0.6); g.shakeAdd(1.3); g.fx.ring(e.pos, e.radius * 4, '#ffffff', 0.9); g.fx.ring(e.pos, e.radius * 6, e.def.glow, 1.2);
  g.fx.burst(e.pos.clone().setY(e.def.hitY), 40, e.def.glow, 40, 2.5, 1, 0, true, 1.5, 1); g.eAoe(e.pos.clone().setY(0), e.radius * 2.8, 40, e, { kb: 60 });
  g.msg(`${e.def.name} — PHASE ${e.phase + 1}`, 2.4); g.cineStart('phase', 2.2, e); if (e.def.id === 'omegabeast' || e.def.id === 'hollowking') e.poise = 0;
}

export function killEnemy(g: Game, e: Enemy) {
  if (e.dead) return; e.dead = true; e.deathT = 0; e.state = 'dead'; e.tele.forEach(t => t.kill()); e.act = null; e.burrowed = false; e.group.visible = true; audio.roar([e.def.voice[0] * 0.8, e.def.voice[1] * 1.2, e.def.voice[2]], g.vol(e.pos));
  g.onKill(e); if (e.isBoss) g.fx.flash(e.pos, '#ffffff', 10, 200, 1);
}
function deathAnim(g: Game, e: Enemy, dt: number) {
  e.deathT += dt; const t = e.deathT; const d = e.def; const grp = e.group; const c = V(e.pos.x, e.pos.y + e.def.hitY, e.pos.z); const big = e.isBoss ? 2.5 : 1;
  const pop = (n = 1) => { for (let i = 0; i < n; i++) { const p = c.clone().add(V((Math.random() - 0.5) * e.radius * 1.4, Math.random() * e.radius * 0.9, (Math.random() - 0.5) * e.radius * 1.4)); g.fx.explosion(p, Math.max(0.6, e.radius * 0.07), Math.random() < 0.5 ? '#ff9a3a' : d.glow, Math.random() < 0.3); } if (n) audio.sfx('explode', g.vol(e.pos) * 0.6); };
  const total = d.death === 'explode' ? 1.4 * (e.isBoss ? 2 : 1) : d.death === 'collapse' ? 3.2 : d.death === 'melt' ? 2.4 : d.death === 'sink' ? 1.8 : d.death === 'spiral' ? 2 : 1.5;
  e.model.update(g.t, dt, 0, 0, 0); e.noiseT -= dt;
  if (e.isBoss && e.noiseT <= 0 && t < total) { e.noiseT = 0.18; pop(1); g.shakeAdd(0.2); }
  switch (d.death) {
    case 'collapse': { grp.rotation.z = THREE.MathUtils.lerp(grp.rotation.z, (e.orbit > 0 ? 1 : -1) * 1.45, Math.min(1, dt * 2.2)); grp.position.y = Math.max(-e.radius * 0.5, -t * e.radius * 0.18); if (Math.random() < dt * 8) g.fx.smoke(c, 1, e.radius * 0.15); if (t < 0.1) pop(1); if (t > 1.4 && Math.random() < dt * 4) pop(1); grp.scale.setScalar(d.scale * (t > 2.4 ? Math.max(0, 1 - (t - 2.4) * 1.2) : 1)); break; }
    case 'explode': { if (t > 0.6 && !e.pieces.length) { pop(Math.round(5 * big)); g.fx.explosion(c, e.radius * 0.3, '#ffcf70'); audio.sfx('bigExplode', g.vol(e.pos)); g.shakeAdd(1.2 * g.vol(e.pos) * big); e.model.shatter(g.scene).forEach(o => e.pieces.push({ o, v: V((Math.random() - 0.5) * 40, 20 + Math.random() * 30, (Math.random() - 0.5) * 40), w: V(Math.random() * 6, Math.random() * 6, Math.random() * 6) })); } if (t < 0.6) { grp.position.x = e.pos.x + (Math.random() - 0.5) * 0.8; if (Math.random() < dt * 12) pop(1); } break; }
    case 'dissolve': { const k = Math.min(1, t / total); grp.scale.setScalar(d.scale * (1 - k * k)); grp.position.y = e.pos.y + k * 6; g.fx.burst(c, 2, d.glow, 20, 1.5, 0.8, -5, true); if (t < 0.1) g.fx.ring(e.pos, e.radius * 2, d.glow, 0.8); break; }
    case 'melt': { const k = Math.min(1, t / total); grp.scale.set(d.scale * (1 + k * 0.4), d.scale * Math.max(0.02, 1 - k), d.scale * (1 + k * 0.4)); if (Math.random() < dt * 20) g.fx.burst(V(e.pos.x, 1, e.pos.z), 2, d.glow, 12, 1.4, 0.8, 8, false); break; }
    case 'sink': { grp.position.y = -t * e.radius * 0.6; if (Math.random() < dt * 25) { g.fx.dust(V(e.pos.x, 0, e.pos.z), e.radius * 0.7, 1); g.fx.burst(V(e.pos.x, 1, e.pos.z), 2, '#8a7050', 10, 1.6, 0.8, 12, false); } break; }
    case 'spiral': { e.pos.y = Math.max(0, e.pos.y - dt * (e.isBoss ? 16 : 22) * (1 + t)); grp.rotation.z += dt * 5; grp.rotation.y += dt * 2; grp.position.y = e.pos.y; if (Math.random() < dt * 14) g.fx.burst(c, 2, '#ff9a3a', 12, 1.8, 0.7, -3, true); if (Math.random() < dt * 10) g.fx.smoke(c, 1, 1.2); if (e.pos.y <= 0.5 && !e.pieces.length) { pop(Math.round(5 * big)); g.fx.explosion(c, e.radius * 0.3, '#ffa040'); g.shakeAdd(1.2 * big); audio.sfx('bigExplode', g.vol(e.pos)); grp.visible = false; e.pieces.push({ o: new THREE.Object3D(), v: V(), w: V() }); } break; }
  }
  e.pieces.forEach(p => { if (!p.o.parent) return; p.v.y -= 50 * dt; p.o.position.addScaledVector(p.v, dt); p.o.rotation.x += p.w.x * dt; p.o.rotation.y += p.w.y * dt; p.o.rotation.z += p.w.z * dt; if (p.o.position.y < 0.5) { p.o.position.y = 0.5; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; } });
  if (t > total + (d.death === 'explode' ? 1.8 : 0.4)) { e.removeT = 1; }
}

export function updateEnemies(g: Game, dt: number) {
  const P = g.P; const list = g.enemies; let attackers = 0; for (const e of list) if (!e.isBoss && !e.dead && (e.state === 'windup' || e.state === 'attack')) attackers++;
  for (const e of list) {
    if (e.dead) { deathAnim(g, e, dt); continue; }
    center(e); e.flash = Math.max(0, e.flash - dt * 6); e.model.flash(e.flash * 0.7 + (e.frozen > 0 ? 0.28 : 0)); e.vuln = Math.max(0, e.vuln - dt); e.invuln = Math.max(0, e.invuln - dt); e.cd -= dt; e.wind = THREE.MathUtils.lerp(e.wind, e.state === 'windup' ? 1 : 0, Math.min(1, dt * 8)); e.strike = Math.max(0, e.strike - dt * 3.5);
    e.model.weak.scale.setScalar(THREE.MathUtils.lerp(e.model.weak.scale.x, e.vuln > 0 ? 1.7 + Math.sin(g.t * 12) * 0.2 : 1, Math.min(1, dt * 8)));
    if (e.slow > 0) e.slow -= dt; if (e.burn > 0) { e.burn -= dt; g.damageEnemy(e, (e.isBoss ? 28 : 40) * dt * g.P.dmgMult, null, { dot: true }); if (Math.random() < dt * 10) g.fx.burst(e.center, 1, '#ff8a2a', 8, 1.5, 0.6, -3, true); if (e.dead) continue; }
    if (e.frozen > 0) { e.frozen -= dt; if (e.state === 'windup') { e.tele.forEach(t => t.kill()); e.tele = []; e.state = 'chase'; } e.mv = 0; e.group.position.set(e.pos.x, e.pos.y, e.pos.z); continue; }
    const sf = e.slow > 0 ? 0.4 : 1; const tgt = g.targetFor(e); const dx = tgt.x - e.pos.x, dz = tgt.z - e.pos.z; const d = Math.hypot(dx, dz); const want = Math.atan2(dx, dz); let mvTarget = 0;
    const turn = (rate: number) => { e.yaw += THREE.MathUtils.clamp(angDiff(e.yaw, want), -rate * dt, rate * dt); };
    switch (e.state) {
      case 'spawn': {
        e.st += dt; const k = Math.min(1, e.st / e.spawnDur); e.invuln = 0.2; if (!e.flying) e.rise = -e.radius * 1.4 * (1 - k * k); else e.rise = (1 - k) * 30;
        if (e.st < dt * 2) { audio.roar(e.def.voice, g.vol(e.pos)); } if (e.isBoss && Math.random() < dt * 14) { g.fx.dust(V(e.pos.x, 0, e.pos.z), e.radius * 1.2, 2); g.shakeAdd(0.1); } if (Math.random() < dt * 6) g.fx.dust(V(e.pos.x, 0, e.pos.z), e.radius * 0.8, 1);
        if (e.st >= e.spawnDur) { e.state = 'chase'; e.rise = 0; if (!e.isBoss) audio.roar(e.def.voice, g.vol(e.pos) * 0.8); } break;
      }
      case 'chase': {
        turn(e.isBoss ? 1.5 : 3.2 * sf); const spd = e.def.speed * e.phaseSpd * sf; const hold = e.def.hold + e.radius * 0.3; const ai = e.def.ai; const fwd = _a.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)); const side = _b.set(fwd.z, 0, -fwd.x);
        let mvx = 0, mvz = 0;
        if (ai === 'walk') { if (d > hold) { mvx = fwd.x; mvz = fwd.z; mvTarget = 1; } else if (d > hold * 0.6) { mvTarget = 0.3; mvx = fwd.x * 0.3; mvz = fwd.z * 0.3; } }
        else if (ai === 'range') { if (d > hold + 8) { mvx = fwd.x; mvz = fwd.z; mvTarget = 1; } else if (d < hold - 10) { mvx = -fwd.x * 0.7; mvz = -fwd.z * 0.7; mvTarget = 0.7; } else { mvx = side.x * e.orbit * 0.45; mvz = side.z * e.orbit * 0.45; mvTarget = 0.5; } }
        else if (ai === 'circle') { if (d > hold + 14) { mvx = fwd.x; mvz = fwd.z; mvTarget = 1; } else { mvx = side.x * e.orbit * 0.9 + fwd.x * (d > hold ? 0.4 : -0.1); mvz = side.z * e.orbit * 0.9 + fwd.z * (d > hold ? 0.4 : -0.1); mvTarget = 1; if (Math.random() < dt * 0.25) e.orbit *= -1; } }
        else if (ai === 'fly' || ai === 'float') { const keep = ai === 'fly' ? hold : hold * 0.8; if (d > keep + 6) { mvx = fwd.x; mvz = fwd.z; mvTarget = 1; } else { mvx = side.x * e.orbit * 0.8 + (d < keep - 8 ? -fwd.x * 0.5 : 0); mvz = side.z * e.orbit * 0.8 + (d < keep - 8 ? -fwd.z * 0.5 : 0); mvTarget = 0.8; if (Math.random() < dt * 0.15) e.orbit *= -1; } }
        e.pos.x += mvx * spd * dt; e.pos.z += mvz * spd * dt;
        if (e.flying) { const alt = e.grounded ? 3 : (e.def.alt || 20) + Math.sin(g.t * 0.8 + e.id) * 2; e.pos.y = THREE.MathUtils.lerp(e.pos.y, alt, Math.min(1, dt * 1.6)); if (e.grounded && e.pos.y < 4) { /* waiting */ } }
        if (!e.flying) { if (g.world.collide(e.pos, e.radius * 0.7, e.radius >= 9 ? -1 : e.radius * 2.4, 450, dt) && !e.isBoss) { e.orbit *= -1; } }
        // choose attack
        if (e.cd <= 0 && (e.isBoss || attackers < 3)) {
          const a = chooseAtk(e, d); if (a) {
            e.atk = a; e.state = 'windup'; e.st = 0; if (!e.isBoss) attackers++; telegraph(g, e, a, tgt); if (e.isBoss) audio.sfx('warn', 0.5); if (['dive'].includes(a.t)) e.grounded = false;
          }
        }
        break;
      }
      case 'windup': {
        e.st += dt * sf; const a = e.atk!; if (a.t !== 'leap' && a.t !== 'dive' && a.t !== 'bolts') turn(a.t === 'charge' ? 2.5 : 2.2); else if (a.t === 'leap' || a.t === 'dive') { if (e.st < a.w * 0.6) { e.pts[0] = tgt.clone().setY(0); e.tele.forEach(t => t.mesh.position.set(tgt.x, 0.3, tgt.z)); } turn(4); }
        if (a.t === 'dive' && e.flying) e.pos.y = THREE.MathUtils.lerp(e.pos.y, (e.def.alt || 20) + 14, Math.min(1, dt * 3));
        if (a.t === 'melee' || a.t === 'breath' || a.t === 'beam' || a.t === 'charge') e.tele.forEach(t => { t.mesh.position.set(e.pos.x, 0.3, e.pos.z); t.mesh.rotation.y = e.yaw; });
        if (e.st >= a.w) { e.state = 'attack'; e.st = 0; exec(g, e, a, tgt); e.cd = (a.cd * (0.85 + Math.random() * 0.3)) / e.phaseSpd; }
        break;
      }
      case 'attack': {
        const act = e.act; if (!act) { e.state = 'recover'; break; } act.t += dt * (e.slow > 0 ? 0.6 : 1); act.tick(dt, Math.min(1, act.t / act.dur)); if (act.t >= act.dur) { e.act = null; act.end?.(); }
        break;
      }
      case 'recover': {
        e.st += dt * sf; if (e.flying && e.grounded) { e.pos.y = THREE.MathUtils.lerp(e.pos.y, 2.5, Math.min(1, dt * 5)); } if (e.st >= ((e as any).rec ?? 0.5)) { e.state = 'chase'; e.grounded = false; } break;
      }
      case 'stagger': {
        e.st += dt; e.vuln = Math.max(e.vuln, 0.5); if (e.st >= (e.isBoss ? 2.4 : 1.4)) { e.state = 'chase'; e.poise = 0; } break;
      }
      case 'phase': {
        e.st += dt; e.wind = 1; if (e.st >= 2.6) { e.state = 'chase'; e.cd = 0.8; } break;
      }
    }
    // phase check
    if (e.isBoss && e.def.phases && e.phase < e.def.phases.length - 1 && e.hp / e.maxHp <= e.def.phases[e.phase + 1].at && e.state !== 'phase') phaseTransition(g, e);
    e.mv = THREE.MathUtils.lerp(e.mv, mvTarget * sf, Math.min(1, dt * 6));
    // bounds & apply
    if (!e.burrowed) { const h = g.world.half + 10; e.pos.x = THREE.MathUtils.clamp(e.pos.x, -h, h); e.pos.z = THREE.MathUtils.clamp(e.pos.z, -h, h); }
    e.group.position.set(e.pos.x, e.pos.y + e.rise, e.pos.z); e.group.rotation.y = e.yaw; e.group.rotation.z = e.state === 'phase' ? Math.sin(g.t * 40) * 0.02 : 0;
    e.model.update(g.t, dt, e.state === 'spawn' ? 0.5 : e.mv, e.wind, e.strike);
    if (e.model.stomp > 0 && !e.flying) { e.model.stomp = 0; const dd = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); const v = Math.max(0, 1 - dd / 140); if (v > 0.05) { g.shakeAdd(v * e.radius * 0.022); audio.sfx('step', v * Math.min(1, e.radius / 10)); if (e.radius > 6) g.fx.dust(V(e.pos.x, 0, e.pos.z), e.radius * 0.5, 3); if (e.isBoss) g.fx.ring(V(e.pos.x, 0, e.pos.z), e.radius * 1.2, '#aaaaaa', 0.4); } }
    else e.model.stomp = 0;
  }
  // separation
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; if (a.dead || b.dead || a.burrowed || b.burrowed || (a.flying !== b.flying)) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; const dd = Math.hypot(dx, dz); const min = (a.radius + b.radius) * 0.7;
    if (dd < min && dd > 0.01 && a.state !== 'attack' && b.state !== 'attack') { const k = (min - dd) * 0.5 / dd * Math.min(1, dt * 6); const wa = b.radius / (a.radius + b.radius), wb = a.radius / (a.radius + b.radius); a.pos.x -= dx * k * wa * 2; a.pos.z -= dz * k * wa * 2; b.pos.x += dx * k * wb * 2; b.pos.z += dz * k * wb * 2; }
  }
  for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; if (e.removeT) { g.scene.remove(e.group); e.pieces.forEach(p => g.scene.remove(p.o)); e.model.dispose(); list.splice(i, 1); } }
}

export function onHitStagger(g: Game, e: Enemy, weak: boolean) {
  if (e.state === 'stagger' || e.state === 'spawn' || e.state === 'phase' || e.dead) return;
  if (e.poise >= e.poiseMax * (e.isBoss && !weak ? 1.6 : 1)) {
    e.poise = 0; if (e.state === 'attack' && e.act) { if (e.isBoss) return; e.act = null; e.burrowed = false; e.group.visible = true; }
    e.tele.forEach(t => t.kill()); e.tele = []; e.state = 'stagger'; e.st = 0; e.vuln = 2.4; e.cd = Math.max(e.cd, 1); g.fx.burst(e.center, 12, '#ffffff', 25, 1.4, 0.5); g.fx.ring(e.pos, e.radius * 1.6, '#ffe070', 0.5); audio.sfx('clang', g.vol(e.pos)); if (e.isBoss) g.msg('CORE EXPOSED — ATTACK THE WEAK POINT!', 1.8);
  }
}
