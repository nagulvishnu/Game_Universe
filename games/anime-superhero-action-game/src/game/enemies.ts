import * as THREE from "three";
import { G, P, V3, rnd, clamp, dampAng, yawTo, fwd, pick, later } from "./core";
import { buildChar, animate, Rig } from "./rig";
import { fx, FxM } from "./fx";
import { sfx } from "./audio";
import { moveBody, mv, freeSpot } from "./world";
import { hurt, shoot, explode, shockwave, chestPos } from "./combat";

let root: THREE.Group;
export const initEnemies = (r: THREE.Group) => (root = r);

export interface TypeDef { name: string; hp: number; speed: number; r: number; h: number; armor?: number; kbRes?: number; staggerRes?: boolean; detect?: number; fly?: boolean; build?: string; noSoul?: boolean }
export const TYPES: Record<string, TypeDef> = {
  criminal: { name: "Street Criminal", hp: 90, speed: 5.8, r: 0.5, h: 1.8 },
  assassin: { name: "Fire Assassin", hp: 78, speed: 7.5, r: 0.5, h: 1.8 },
  ninja: { name: "Shadow Ninja", hp: 85, speed: 9.5, r: 0.5, h: 1.8 },
  brute: { name: "Heavy Brute", hp: 520, speed: 3.6, r: 1.1, h: 2.9, armor: 0.12, kbRes: 0.65, staggerRes: true },
  gunner: { name: "Energy Gunner", hp: 68, speed: 6.5, r: 0.5, h: 1.8, detect: 55 },
  hunter: { name: "Aerial Hunter", hp: 100, speed: 11, r: 0.6, h: 1.8, fly: true, detect: 50 },
  commander: { name: "Elite Commander", hp: 1000, speed: 6.2, r: 0.85, h: 2.5, armor: 0.1, kbRes: 0.7, staggerRes: true, detect: 45 },
  clone: { name: "Shadow Clone", hp: 45, speed: 12, r: 0.6, h: 2.4, noSoul: true },
};

export interface AtkDef {
  wind: number; dur: number; cd: number; kind?: number; armor?: boolean;
  begin?: (e: any) => void; on?: (e: any) => void; upd?: (e: any, dt: number, t: number) => void; end?: (e: any) => void;
}
export const ATK: Record<string, AtkDef> = {};
export const AI: Record<string, (e: any, dt: number, c: Ctx) => void> = {};
export interface Ctx { tp: V3; dx: number; dz: number; d: number; dp: number; ang: number; tgt: any }

export function createEnemy(type: string, x: number, z: number, o: { aggro?: boolean; y?: number; minion?: boolean; hpMul?: number; build?: string } = {}) {
  const def = TYPES[type];
  const rig: Rig = buildChar(o.build ?? def.build ?? type);
  const hp = def.hp * (o.hpMul ?? 1);
  const e: any = {
    id: G.nextId++, type, name: def.name, rig, pos: new V3(x, o.y ?? (def.fly ? 10 : 0), z), vel: new V3(), kb: new V3(), yaw: rnd(0, 6.28), faceYaw: 0, hp, maxHp: hp, r: def.r, h: def.h, speed: def.speed,
    armor: def.armor ?? 0, kbRes: def.kbRes ?? 0, staggerRes: def.staggerRes, noKnock: false, detect: def.detect ?? 32, aggro: !!o.aggro, dead: false, deadT: 0, flash: 0, stagger: 0, atk: null, tele: [], cd: {}, recover: rnd(0.2, 0.8),
    tgt: null, tgtT: 0, slot: rnd(0, 6.28), ai: {}, dm: 1 + (Math.max(1, G.level ?? 1) - 1) * 0.015, boss: false, hidden: false, invuln: 0, evade: 0, burn: null, dash: null, vuln: 1, spd: 0, mode: "idle", minion: !!o.minion, fly: !!def.fly, noSoul: def.noSoul,
    shadowCol: 0xffffff, t0: rnd(0, 10),
  };
  e.faceYaw = e.yaw;
  rig.root.position.copy(e.pos);
  root.add(rig.root);
  G.enemies.push(e);
  return e;
}
export function removeEnemy(e: any) {
  e.tele?.forEach((t: FxM) => fx.kill(t));
  root.remove(e.rig.root);
  const i = G.enemies.indexOf(e);
  if (i >= 0) G.enemies.splice(i, 1);
  G.hooks.onRemove?.(e);
}
export function spawnEnemy(type: string, x: number, z: number, o: any = {}) {
  const p = freeSpot(x, z, 3, TYPES[type].r + 0.6);
  const e = createEnemy(type, p.x, p.z, o);
  fx.burst(e.pos.clone().add(new V3(0, 1, 0)), 0xffffff, 6, 3, 0.4, 0.4, 0);
  return e;
}

/* ---------- helpers ---------- */
export function startAtk(e: any, name: string) {
  const def = ATK[name];
  e.atk = { def, name, t: 0, hit: false, kind: def.kind ?? 0 };
  def.begin?.(e);
  return e.atk;
}
export function teleRing(e: any, x: number, z: number, r: number, life: number, color = 0xff3030) {
  const a = fx.mesh("disc", x, 0.12, z, color, { life, s0: [r * 0.1, 1, r * 0.1], s1: [r, 1, r], o0: 0.25, o1: 0.5, ease: 0.5 });
  const b = fx.mesh("ring", x, 0.14, z, color, { life: life + 0.1, s0: [r, 1, r], s1: [r, 1, r], o0: 0.9, o1: 0.9 });
  e.tele.push(a, b);
}
export function teleLine(e: any, from: V3, to: V3, w: number, life: number, color = 0xff3030) {
  const dir = to.clone().sub(from).setY(0);
  const len = dir.length();
  dir.normalize();
  const m = fx.mesh("beam", from.x, 0.15, from.z, color, { life, s0: [w, len, w * 0.05], s1: [w, len, w * 0.05], o0: 0.35, o1: 0.7 });
  m.mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
  m.mesh.rotateX(0);
  e.tele.push(m);
  return m;
}
export function clearTele(e: any) {
  e.tele.forEach((t: FxM) => fx.kill(t));
  e.tele = [];
}
export function melee(e: any, reach: number, dmg: number, o: { kb?: number; stagger?: number; arc?: number } = {}) {
  const t = e.tgt;
  if (!t || t.dead) { sfx("whoosh", e.pos, 0.5); return false; }
  const dx = t.pos.x - e.pos.x, dz = t.pos.z - e.pos.z, d = Math.hypot(dx, dz);
  const f = fwd(e.yaw);
  const dot = (dx * f.x + dz * f.z) / (d || 1);
  const dy = t.pos.y - e.pos.y;
  if (d < reach + (t.r ?? 0.5) && dot > (o.arc ?? 0.1) && dy < 2.8 && dy > -3) {
    hurt(t, dmg * e.dm, e.pos, { kb: o.kb ?? 4, stagger: o.stagger ?? 0.15 });
    fx.sparks(new V3(t.pos.x, t.pos.y + 1.2, t.pos.z), 0xffffff, 6, 7);
    sfx("punch", e.pos);
    return true;
  }
  sfx("whoosh", e.pos, 0.5);
  return false;
}
export const tokens = (type: string) => G.enemies.filter((x: any) => !x.dead && x.type === type && x.atk).length;
const aimLead = (e: any, speed: number) => {
  const t = e.tgt;
  const tp = chestPos(t as any);
  if (t === P) { const d = tp.distanceTo(e.pos) / speed; tp.addScaledVector(P.vel, d * 0.6); }
  return tp;
};
export function fire(e: any, kind: string, speed: number, dmg: number, o: { radius?: number; spread?: number; scale?: number; from?: V3; wave?: boolean; pierce?: boolean; hitR?: number; knock?: number; homing?: boolean } = {}) {
  const from = o.from ?? e.rig.handR.getWorldPosition(new V3());
  const tp = aimLead(e, speed);
  const dir = tp.sub(from).normalize();
  if (o.spread) { dir.x += rnd(-o.spread, o.spread); dir.y += rnd(-o.spread, o.spread) * 0.5; dir.z += rnd(-o.spread, o.spread); dir.normalize(); }
  return shoot({ kind, team: "e", pos: from.clone().addScaledVector(dir, 0.6), dir, speed, dmg: dmg * e.dm, radius: o.radius, scale: o.scale, wave: o.wave, pierce: o.pierce, hitR: o.hitR, knock: o.knock, homing: o.homing ? { tgt: e.tgt === P ? { pos: P.pos, dead: false, h: 1.8 } : e.tgt, turn: 1.2 } : undefined });
}
const ringPos = (e: any, c: Ctx, r: number, off = 0) => {
  const a = e.slot + off;
  return { x: c.tp.x + Math.cos(a) * r, z: c.tp.z + Math.sin(a) * r };
};
export function walkTo(e: any, x: number, z: number, speed: number, stop = 0.5) {
  const dx = x - e.pos.x, dz = z - e.pos.z, d = Math.hypot(dx, dz);
  if (d > stop) { e.mvx = dx / d; e.mvz = dz / d; e.mvs = speed; } 
  return d;
}
export function walkDir(e: any, x: number, z: number, speed: number) { const l = Math.hypot(x, z) || 1; e.mvx = x / l; e.mvz = z / l; e.mvs = speed; }
const cdr = (e: any, k: string) => (e.cd[k] ?? 0) <= 0;
const setcd = (e: any, k: string, v: number) => (e.cd[k] = v * (e.cdScale ?? 1) * rnd(0.9, 1.15));

/* ---------- attack definitions ---------- */
ATK.punch = { wind: 0.5, dur: 0.9, cd: 1.6, kind: 0, begin: (e) => { e.kindAlt = !e.kindAlt; }, on: (e) => melee(e, 2.3, e.type === "criminal" ? 11 : 14, { kb: 4, stagger: 0.18 }) };
ATK.hook = { wind: 0.55, dur: 1.0, cd: 2.2, kind: 1, on: (e) => melee(e, 2.5, 13, { kb: 7, stagger: 0.25 }) };
ATK.kick = { wind: 0.6, dur: 1.0, cd: 2.6, kind: 2, on: (e) => melee(e, 2.6, 15, { kb: 8, stagger: 0.3 }) };
ATK.fireball = {
  wind: 0.6, dur: 1.0, cd: 2.6, kind: 10,
  begin: (e) => { fx.burst(e.rig.handR.getWorldPosition(new V3()), 0xff7a1a, 8, 3, 0.4, 0.5, 0); },
  on: (e) => { fire(e, "ember", 24, 14, { radius: 2.4 }); sfx("fireball", e.pos, 0.7); },
};
ATK.firedash = {
  wind: 0.35, dur: 0.75, cd: 6, kind: 13,
  begin: (e) => { e.ai.dd = null; },
  on: (e) => {
    const t = e.tgt; if (!t) return;
    const dx = t.pos.x - e.pos.x, dz = t.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
    let vx = dx / d, vz = dz / d;
    if (d < 9) { const s = Math.random() < 0.5 ? 1 : -1; vx = (-dz / d) * s - (dx / d) * 0.5; vz = (dx / d) * s - (dz / d) * 0.5; const l = Math.hypot(vx, vz); vx /= l; vz /= l; e.ai.strike = false; }
    else e.ai.strike = true;
    e.dash = { x: vx, z: vz, s: 26, until: G.time + 0.36 };
    sfx("dash", e.pos, 0.6);
  },
  upd: (e, _dt, t) => {
    if (t > 0.35 && t < 0.75) {
      fx.em(e.pos.x, e.pos.y + 1, e.pos.z, rnd(-1, 1), rnd(0, 2), rnd(-1, 1), 0xff6a1a, 1.2, 0.5, -1);
      if (e.ai.strike && e.tgt && !e.ai.struck && Math.hypot(e.tgt.pos.x - e.pos.x, e.tgt.pos.z - e.pos.z) < 2.4) { e.ai.struck = true; hurt(e.tgt, 18 * e.dm, e.pos, { kb: 7, stagger: 0.25 }); }
    }
  },
  end: (e) => { e.ai.struck = false; },
};
ATK.firebomb = {
  wind: 1.0, dur: 1.4, cd: 9, kind: 12,
  begin: (e) => { const t = e.tgt; e.ai.bx = t.pos.x; e.ai.bz = t.pos.z; teleRing(e, e.ai.bx, e.ai.bz, 4.2, 1.0, 0xff5020); sfx("warn", e.pos, 0.6); },
  on: (e) => { explode(new V3(e.ai.bx, 0.3, e.ai.bz), 4.2, 24 * e.dm, { team: "e", knock: 9 }); },
};
ATK.slash = { wind: 0.3, dur: 0.55, cd: 1.1, kind: 0, on: (e) => melee(e, 2.9, 12, { kb: 4, stagger: 0.15 }) };
ATK.ambush = {
  wind: 1.05, dur: 1.65, cd: 6, kind: 0,
  begin: (e) => {
    e.hidden = true; e.rig.root.visible = false;
    fx.smoke(e.pos.x, e.pos.y + 1, e.pos.z, 0, 1, 0, 0x120a22, 2.2, 1, 0, 1);
    fx.burst(e.pos.clone().add(new V3(0, 1, 0)), 0xa060ff, 12, 5, 0.4, 0.5, 0);
    sfx("teleport", e.pos, 0.7);
    e.ai.appeared = false;
  },
  upd: (e, _dt, t) => {
    if (t > 0.65 && !e.ai.appeared) {
      e.ai.appeared = true;
      const tg = e.tgt;
      if (tg) {
        const yaw = tg === P ? P.yaw : tg.yaw ?? 0;
        const a = yaw + Math.PI + rnd(-0.5, 0.5);
        const p = freeSpot(tg.pos.x + Math.sin(a) * 2.6, tg.pos.z + Math.cos(a) * 2.6, 0.5);
        e.pos.set(p.x, tg.pos.y, p.z);
        e.yaw = e.faceYaw = yawTo(e.pos, tg.pos);
      }
      e.hidden = false; e.rig.root.visible = true;
      fx.burst(e.pos.clone().add(new V3(0, 1, 0)), 0xa060ff, 14, 6, 0.5, 0.5, 0);
      fx.ring(e.pos.x, e.pos.z, 0.5, 3, 0xa060ff, 0.4);
      sfx("teleport", e.pos, 0.8);
    }
    if (t > 1.3 && !e.ai.second) { e.ai.second = true; melee(e, 3.0, 11, { kb: 6, stagger: 0.2, arc: -1 }); }
  },
  on: (e) => { melee(e, 3.0, 17, { kb: 6, stagger: 0.3, arc: -1 }); },
  end: (e) => { e.ai.second = false; e.hidden = false; e.rig.root.visible = true; },
};
ATK.shuriken = {
  wind: 0.35, dur: 0.7, cd: 4, kind: 10,
  on: (e) => { for (let i = -1; i <= 1; i++) { const p = fire(e, "dark", 30, 8, { scale: 0.45, hitR: 0.4 }); p.vel.applyAxisAngle(new V3(0, 1, 0), i * 0.18); } sfx("shot", e.pos, 0.6); },
};
ATK.brutepunch = { wind: 0.85, dur: 1.5, cd: 2.4, kind: 3, armor: true, on: (e) => { if (melee(e, 3.6, 38, { kb: 14, stagger: 0.5 })) fx.burst(e.pos.clone().add(new V3(0, 1, 0)), 0xffffff, 8, 6, 0.4, 0.4); } };
ATK.slam = {
  wind: 1.15, dur: 2.0, cd: 7, kind: 3, armor: true,
  begin: (e) => { teleRing(e, e.pos.x, e.pos.z, 6.5, 1.15, 0xff4020); sfx("warn", e.pos); },
  on: (e) => { explode(e.pos.clone(), 6.5, 40 * e.dm, { team: "e", knock: 12, color: 0xaa8855, color2: 0xffdd99, shake: 0.7 }); shockwave(e.pos.x, e.pos.z, { max: 15, dmg: 24 * e.dm, speed: 16, color: 0xffb060 }); },
};
ATK.charge = {
  wind: 0.9, dur: 2.1, cd: 10, kind: 6, armor: true,
  begin: (e) => {
    const t = e.tgt;
    const to = new V3(t.pos.x, 0, t.pos.z);
    const dir = to.clone().sub(e.pos).setY(0).normalize();
    e.ai.cdir = dir;
    teleLine(e, e.pos, e.pos.clone().addScaledVector(dir, 22), 3.2, 0.9, 0xff4020);
    sfx("roar", e.pos, 0.7);
  },
  on: (e) => { e.dash = { x: e.ai.cdir.x, z: e.ai.cdir.z, s: 24, until: G.time + 1.0 }; e.ai.hitC = false; e.yaw = e.faceYaw = Math.atan2(e.ai.cdir.x, e.ai.cdir.z); },
  upd: (e, _dt, t) => {
    if (t > 0.9 && t < 1.95) {
      if (Math.random() < 0.5) fx.em(e.pos.x, 0.3, e.pos.z, rnd(-2, 2), rnd(1, 4), rnd(-2, 2), 0xcfc0a0, 1.6, 0.6, 3);
      const tg = e.tgt;
      if (tg && !e.ai.hitC && Math.hypot(tg.pos.x - e.pos.x, tg.pos.z - e.pos.z) < e.r + 1.2 && Math.abs(tg.pos.y - e.pos.y) < 2.6) { e.ai.hitC = true; hurt(tg, 48 * e.dm, e.pos, { kb: 16, stagger: 0.6 }); fx.explosion(chestPos(tg), 2.5, 0xffaa40, 0xffffff); }
      G.hooks.damageAt?.(e.pos, 2.5, 30, "e");
      if (mv.wall && e.dash && !e.ai.dizzy) { e.ai.dizzy = true; e.dash = null; e.stagger = 1.1; e.atk = null; shockwave(e.pos.x, e.pos.z, { max: 8, dmg: 12, speed: 14 }); }
    }
  },
  end: (e) => { e.ai.dizzy = false; },
};
ATK.burst = {
  wind: 0.5, dur: 1.4, cd: 2.6, kind: 11,
  on: (e) => { for (let i = 0; i < 3; i++) later(i * 0.17, () => { if (!e.dead && !e.stagger) { fire(e, "bolt", 50, 8, { spread: 0.03 }); sfx("shot", e.pos, 0.5); } }); },
};
ATK.chargeshot = {
  wind: 1.4, dur: 1.9, cd: 7.5, kind: 10,
  begin: (e) => { e.ai.laser = fx.mesh("beam", e.pos.x, 1.4, e.pos.z, 0x33ffff, { life: 1.5, s0: [0.06, 1, 0.06], s1: [0.06, 1, 0.06], o0: 0.4, o1: 0.9 }); e.tele.push(e.ai.laser); sfx("charge", e.pos, 0.6); },
  upd: (e, _dt, t) => {
    if (e.ai.laser?.active && t < 1.4 && e.tgt) {
      const o = e.rig.handR.getWorldPosition(new V3());
      const tp = chestPos(e.tgt as any);
      const dir = tp.clone().sub(o);
      const len = dir.length();
      e.ai.laser.mesh.position.copy(o);
      e.ai.laser.mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.normalize());
      e.ai.laser.mesh.scale.set(0.05 + t * 0.06, len, 0.05 + t * 0.06);
    }
  },
  on: (e) => { clearTele(e); fire(e, "bolt", 85, 34, { scale: 3, hitR: 0.9 }); sfx("laser", e.pos); },
};
ATK.volley = {
  wind: 0.5, dur: 1.1, cd: 3, kind: 10,
  on: (e) => { for (let i = 0; i < 3; i++) { fire(e, "red", 28, 9, { spread: 0.1, scale: 0.8 }); } sfx("shot", e.pos, 0.6); },
};
ATK.dive = {
  wind: 0.9, dur: 2.2, cd: 7, kind: 6,
  begin: (e) => { const t = e.tgt; e.ai.dx = t.pos.x; e.ai.dz = t.pos.z; teleRing(e, e.ai.dx, e.ai.dz, 3, 0.9, 0xff3050); sfx("warn", e.pos, 0.5); e.ai.diving = false; e.ai.hitD = false; },
  on: (e) => { e.ai.diving = true; const tg = e.tgt; e.ai.dv = new V3(e.ai.dx - e.pos.x, tg.pos.y + 0.8 - e.pos.y, e.ai.dz - e.pos.z).normalize(); sfx("dash", e.pos, 0.7); },
  upd: (e, _dt, t) => {
    if (e.ai.diving) {
      e.vel3 = e.ai.dv.clone().multiplyScalar(40);
      fx.em(e.pos.x, e.pos.y + 1, e.pos.z, 0, 0, 0, 0xff3050, 0.8, 0.4);
      const tg = e.tgt;
      if (tg && !e.ai.hitD && e.pos.distanceTo(new V3(tg.pos.x, tg.pos.y + 1, tg.pos.z)) < 2.2) { e.ai.hitD = true; hurt(tg, 28 * e.dm, e.pos, { kb: 11, stagger: 0.4 }); fx.explosion(e.pos.clone(), 2.5, 0xff3050, 0xffffff); }
      if (e.pos.y < 1.6 || t > 1.7) { e.ai.diving = false; e.vel3 = null; if (e.pos.y < 2) explode(e.pos.clone(), 3, 10 * e.dm, { team: "e", knock: 6 }); }
    } else if (t > 1.0) e.pos.y += 10 * _dt;
  },
  end: (e) => { e.ai.diving = false; e.vel3 = null; },
};
ATK.combo3 = {
  wind: 0.45, dur: 1.6, cd: 3, kind: 0, armor: true,
  on: (e) => { melee(e, 3.8, 18, { kb: 6, stagger: 0.2 }); e.ai.c = 1; },
  upd: (e, _dt, t) => {
    if (t > 0.85 && e.ai.c === 1) { e.ai.c = 2; e.yaw = e.faceYaw = yawTo(e.pos, e.tgt.pos); e.dash = { x: Math.sin(e.yaw), z: Math.cos(e.yaw), s: 12, until: G.time + 0.15 }; melee(e, 3.8, 18, { kb: 6, stagger: 0.2 }); }
    if (t > 1.25 && e.ai.c === 2) { e.ai.c = 3; melee(e, 4.2, 26, { kb: 14, stagger: 0.5 }); fx.explosion(e.pos.clone().addScaledVector(fwd(e.yaw), 2.5).setY(0.5), 2.5, 0xff3050, 0xffd23f); }
  },
};
ATK.cwave = {
  wind: 0.85, dur: 1.4, cd: 5, kind: 12,
  begin: (e) => { teleLine(e, e.pos, e.pos.clone().addScaledVector(fwd(yawTo(e.pos, e.tgt.pos)), 24), 2, 0.8, 0xff3050); sfx("warn", e.pos, 0.5); },
  on: (e) => { const f = fwd(yawTo(e.pos, e.tgt.pos)); shoot({ kind: "wave", team: "e", pos: e.pos.clone().add(new V3(0, 1.2, 0)).addScaledVector(f, 1.5), dir: f, speed: 26, dmg: 26 * e.dm, hitR: 1.5, life: 1.4, pierce: true, wave: true, scale: 1.5, knock: 8 }); sfx("laser", e.pos); },
};
ATK.nova = {
  wind: 1.4, dur: 2.1, cd: 10, kind: 14, armor: true,
  begin: (e) => { teleRing(e, e.pos.x, e.pos.z, 9.5, 1.4, 0xff3050); sfx("longcharge" as any, e.pos, 0.5); sfx("charge", e.pos, 0.7); },
  on: (e) => { explode(e.pos.clone(), 9.5, 42 * e.dm, { team: "e", color: 0xff3050, color2: 0xffd23f, knock: 14, shake: 0.8 }); },
};
ATK.summon = {
  wind: 1.1, dur: 1.9, cd: 16, kind: 12,
  begin: (e) => { fx.ring(e.pos.x, e.pos.z, 1, 8, 0xff3050, 1.0); sfx("summon", e.pos); },
  on: (e) => {
    const n = e.ai.p2 ? 4 : 3;
    const minions = G.enemies.filter((x: any) => x.minion && !x.dead).length;
    for (let i = 0; i < Math.min(n, 8 - minions); i++) { const a = (i / n) * 6.28; const m = spawnEnemy(pick(["criminal", "criminal", "ninja"]), e.pos.x + Math.sin(a) * 5, e.pos.z + Math.cos(a) * 5, { aggro: true, minion: true }); m.noSoul = false; }
    shockwave(e.pos.x, e.pos.z, { max: 9, dmg: 8, speed: 14, color: 0xff3050 });
  },
};
ATK.dstrike = {
  wind: 0.45, dur: 1.0, cd: 5, kind: 6,
  on: (e) => { const dir = fwd(yawTo(e.pos, e.tgt.pos)); e.dash = { x: dir.x, z: dir.z, s: 30, until: G.time + 0.28 }; e.ai.hitS = false; sfx("dash", e.pos); },
  upd: (e, _dt, t) => { if (t > 0.45 && t < 0.8 && !e.ai.hitS && e.tgt && Math.hypot(e.tgt.pos.x - e.pos.x, e.tgt.pos.z - e.pos.z) < 3) { e.ai.hitS = true; hurt(e.tgt, 30 * e.dm, e.pos, { kb: 12, stagger: 0.5 }); fx.explosion(chestPos(e.tgt), 2.5, 0xff3050, 0xffd23f); } },
};

/* ---------- AI ---------- */
function strafeAround(e: any, c: Ctx, r: number, spd: number) {
  const p = ringPos(e, c, r);
  walkTo(e, p.x, p.z, spd, 0.8);
}
AI.criminal = (e, dt, c) => {
  e.slot += dt * 0.12 * (e.slotDir ?? (e.slotDir = Math.random() < 0.5 ? 1 : -1));
  if (c.d > 11) walkTo(e, c.tp.x, c.tp.z, e.speed, 2);
  else if (c.d > 3.4) { strafeAround(e, c, 3.0, e.speed * 0.8); }
  else if (c.d < 2.0) walkDir(e, -c.dx, -c.dz, e.speed * 0.5);
  // dodge
  if (e.dodgeCd === undefined) e.dodgeCd = 0;
  e.dodgeCd -= dt;
  if (e.dodgeCd <= 0 && c.dp < 5 && P.act?.type === "atk" && Math.random() < 0.02 * 60 * dt) { e.dodgeCd = 3.5; e.evade = 0.28; e.kb.x += -c.dz / c.d * 12; e.kb.z += c.dx / c.d * 12; fx.em(e.pos.x, e.pos.y + 1, e.pos.z, 0, 0, 0, 0xffffff, 1, 0.3); }
  if (c.d < 3.0 && cdr(e, "a") && tokens("criminal") < 2 && e.recover <= 0) {
    const name = pick(["punch", "punch", "hook", "kick"]);
    startAtk(e, name); setcd(e, "a", ATK[name].cd);
  }
};
AI.assassin = (e, dt, c) => {
  e.slot += dt * 0.3;
  if (c.d < 8 && cdr(e, "fd")) { startAtk(e, "firedash"); setcd(e, "fd", ATK.firedash.cd); return; }
  if (c.d > 18) walkTo(e, c.tp.x, c.tp.z, e.speed, 2);
  else if (c.d < 10) walkDir(e, -c.dx, -c.dz, e.speed);
  else strafeAround(e, c, 14, e.speed * 0.7);
  if (c.d < 8 && cdr(e, "fb") && Math.random() < 0.5) { startAtk(e, "firebomb"); setcd(e, "fb", ATK.firebomb.cd); return; }
  if (c.d < 30 && cdr(e, "f") && e.recover <= 0) { startAtk(e, "fireball"); setcd(e, "f", ATK.fireball.cd); }
};
AI.ninja = (e, dt, c) => {
  e.slot += dt * 0.5;
  if (cdr(e, "amb") && c.d < 26 && c.d > 3 && e.recover <= 0) { startAtk(e, "ambush"); setcd(e, "amb", ATK.ambush.cd); return; }
  if (c.d > 10) walkTo(e, c.tp.x, c.tp.z, e.speed, 2);
  else if (c.d > 3) { if (cdr(e, "a")) walkTo(e, c.tp.x, c.tp.z, e.speed * 1.2, 1); else strafeAround(e, c, 6, e.speed * 0.9); }
  if (c.d > 7 && c.d < 24 && cdr(e, "sh") && e.recover <= 0) { startAtk(e, "shuriken"); setcd(e, "sh", ATK.shuriken.cd); return; }
  if (c.d < 3.1 && cdr(e, "a") && e.recover <= 0) { startAtk(e, "slash"); setcd(e, "a", 0.9); e.ai.n = (e.ai.n ?? 0) + 1; }
};
AI.brute = (e, _dt, c) => {
  walkTo(e, c.tp.x, c.tp.z, e.speed, 2.8);
  if (e.recover > 0) return;
  if (c.d < 3.8 && cdr(e, "p")) { startAtk(e, "brutepunch"); setcd(e, "p", 2.4); return; }
  if (c.d < 9 && cdr(e, "s") && Math.random() < 0.02 * 60 * _dt * 3) { startAtk(e, "slam"); setcd(e, "s", 7); return; }
  if (c.d > 7 && c.d < 24 && cdr(e, "c")) { startAtk(e, "charge"); setcd(e, "c", 10); }
};
AI.gunner = (e, dt, c) => {
  e.ai.rp = (e.ai.rp ?? 0) - dt;
  if (c.d < 13) { walkDir(e, -c.dx, -c.dz, e.speed * 1.4); e.ai.rp = 0; }
  else if (c.d > 36) walkTo(e, c.tp.x, c.tp.z, e.speed, 2);
  else {
    if (e.ai.rp <= 0) { e.ai.rp = rnd(2.5, 4.5); const a = Math.atan2(-c.dz, -c.dx) + rnd(-1.2, 1.2); const r = rnd(18, 30); e.ai.tx = c.tp.x + Math.cos(a) * r; e.ai.tz = c.tp.z + Math.sin(a) * r; }
    if (e.ai.tx !== undefined) walkTo(e, e.ai.tx, e.ai.tz, e.speed * 0.9, 1);
  }
  if (e.recover > 0 || c.d > 52) return;
  if (cdr(e, "cs") && c.d > 14) { startAtk(e, "chargeshot"); setcd(e, "cs", ATK.chargeshot.cd); return; }
  if (cdr(e, "b")) { startAtk(e, "burst"); setcd(e, "b", ATK.burst.cd); }
};
AI.hunter = (e, dt, c) => {
  e.slot += dt * 0.5;
  const alt = (e.tgt?.pos.y ?? 0) + 9 + Math.sin(G.time + e.t0) * 2;
  e.ai.alt = alt;
  const p = ringPos(e, c, 14);
  walkTo(e, p.x, p.z, e.speed, 1);
  if (e.recover > 0) return;
  if (cdr(e, "d") && c.d < 30) { startAtk(e, "dive"); setcd(e, "d", ATK.dive.cd); return; }
  if (cdr(e, "v") && c.d < 38) { startAtk(e, "volley"); setcd(e, "v", ATK.volley.cd); }
};
AI.commander = (e, dt, c) => {
  if (!e.ai.p2 && e.hp < e.maxHp * 0.5) {
    e.ai.p2 = true; e.cdScale = 0.65; e.speed *= 1.2; e.cd.summon = 0;
    fx.burst(e.pos.clone().add(new V3(0, 1, 0)), 0xff3050, 40, 12, 0.7, 0.8, 0);
    sfx("roar", e.pos);
    G.hooks.toast?.("Elite Commander enraged!", "#ff6070");
  }
  e.slot += dt * 0.2;
  if (c.d > 5) walkTo(e, c.tp.x, c.tp.z, e.speed, 2); else if (c.d < 2.5) walkDir(e, -c.dx, -c.dz, e.speed * 0.5);
  if (e.recover > 0) return;
  const minions = G.enemies.filter((x: any) => x.minion && !x.dead).length;
  if (cdr(e, "summon") && minions < 4) { startAtk(e, "summon"); setcd(e, "summon", ATK.summon.cd); return; }
  if (c.d < 10 && cdr(e, "nova") && Math.random() < 0.03) { startAtk(e, "nova"); setcd(e, "nova", ATK.nova.cd); return; }
  if (c.d > 8 && cdr(e, "ds")) { startAtk(e, "dstrike"); setcd(e, "ds", ATK.dstrike.cd); return; }
  if (c.d > 10 && cdr(e, "w")) { startAtk(e, "cwave"); setcd(e, "w", ATK.cwave.cd); return; }
  if (c.d < 4.2 && cdr(e, "c")) { startAtk(e, "combo3"); setcd(e, "c", ATK.combo3.cd); }
};
AI.clone = (e, _dt, c) => {
  walkTo(e, c.tp.x, c.tp.z, e.speed, 2);
  if (c.d < 3.2 && cdr(e, "a") && e.recover <= 0) { startAtk(e, "slash"); setcd(e, "a", 1.0); }
};

/* ---------- update ---------- */
const WHITE = new THREE.Color();
void WHITE;
export function updateEnemies(dt: number, time: number) {
  const list = G.enemies;
  G.danger = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    const rig: Rig = e.rig;
    const dp = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
    e.dp = dp;
    if (e.dead) {
      e.deadT += dt;
      e.mvs = 0;
      e.kb.multiplyScalar(Math.max(0, 1 - 5 * dt));
      if (!e.fly || e.pos.y <= 0.01) moveBody(e.pos, e.r * 0.6, 0.5, e.kb.x * dt, 0, e.kb.z * dt);
      if (e.fly && e.pos.y > 0) { e.vel.y -= 30 * dt; moveBody(e.pos, 0.3, 0.5, 0, e.vel.y * dt, 0); }
      rig.root.position.copy(e.pos);
      const sc = e.deadT > 1.3 ? Math.max(0.001, 1 - (e.deadT - 1.3) * 1.4) : 1;
      rig.root.scale.setScalar(rig.scale * sc);
      animate(rig, { mode: "dead", t: time, k: 18 }, dt);
      rig.flash(Math.max(0, 0.6 - e.deadT * 1.2));
      if (e.deadT > 2.0 && !e.boss) removeEnemy(e);
      continue;
    }
    if (e.boss && e.bossUpdate) { /* handled in boss module */ }
    if (dp > 230 && !e.boss && !e.keep) { removeEnemy(e); continue; }
    if (dp > 150 && !e.aggro && !e.boss) { rig.root.visible = false; continue; }
    rig.root.visible = !e.hidden;
    // timers
    for (const k in e.cd) e.cd[k] -= dt;
    e.flash = Math.max(0, e.flash - dt);
    e.evade = Math.max(0, e.evade - dt);
    e.invuln = Math.max(0, e.invuln - dt);
    e.recover = Math.max(0, e.recover - dt);
    if (e.burn) { e.burn.t -= dt; e.hp -= e.burn.dps * dt; if (Math.random() < 0.4) fx.em(e.pos.x + rnd(-0.4, 0.4), e.pos.y + rnd(0.2, e.h), e.pos.z + rnd(-0.4, 0.4), 0, 2, 0, 0xff6a1a, 0.5, 0.4, -1); if (e.hp <= 0) { G.hooks.kill?.(e); } if (e.burn.t <= 0) e.burn = null; }
    if (e.dead) continue;
    rig.flash(e.flash > 0 ? 0.9 : e.vuln > 1 ? 0.25 + Math.sin(time * 14) * 0.15 : 0);
    // detection
    if (!e.aggro && dp < e.detect && !P.dead) {
      e.aggro = true;
      for (const o of list) if (!o.dead && !o.aggro && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 20) o.aggro = true;
    }
    // target selection
    e.tgtT -= dt;
    if (e.tgtT <= 0 || !e.tgt || e.tgt.dead) {
      e.tgtT = 0.6;
      let best: any = P.dead ? null : P, bd = P.dead ? 1e9 : dp;
      for (const a of G.allies) {
        if (a.dead) continue;
        const d = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z);
        const bias = a.beacon ? (G.beaconFocus ? 0.35 : 1) : 0.8;
        if (d < 16 && d * bias < bd) { bd = d * bias; best = a; }
      }
      e.tgt = best;
    }
    const tgt = e.tgt;
    // movement scratch
    e.mvx = 0; e.mvz = 0; e.mvs = 0;
    const flying = e.fly;
    if (e.stagger > 0) {
      e.stagger -= dt;
      e.mode = e.stun ? "stun" : "hit";
    } else if (e.atk) {
      const a = e.atk, d = a.def;
      a.t += dt;
      if (tgt && (a.t < d.wind * 0.85 || e.type === "gunner") && !e.noFace) e.faceYaw = yawTo(e.pos, tgt.pos);
      if (!a.hit && a.t >= d.wind) { a.hit = true; d.on?.(e); }
      d.upd?.(e, dt, a.t);
      if (a.t >= d.dur) { const cur = e.atk; if (cur === a) { d.end?.(e); clearTele(e); e.atk = null; e.recover = rnd(0.35, 0.9) * (e.type === "brute" ? 1.4 : 1); } }
      e.mode = "atk";
    } else if (!e.aggro || !tgt) {
      e.mode = "idle";
      if (!e.aggro && e.type !== "hunter" && !e.intro) {
        e.ai.wt = (e.ai.wt ?? rnd(2, 6)) - dt;
        if (e.ai.wt <= 0) { e.ai.wt = rnd(3, 7); e.ai.wa = rnd(0, 6.28); e.ai.walk = Math.random() < 0.5; }
        if (e.ai.walk) { walkDir(e, Math.sin(e.ai.wa), Math.cos(e.ai.wa), e.speed * 0.25); }
      }
    } else {
      const dx = tgt.pos.x - e.pos.x, dz = tgt.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 0.01;
      const c: Ctx = { tp: tgt.pos, dx, dz, d, dp, ang: Math.atan2(dx, dz), tgt };
      e.faceYaw = c.ang;
      AI[e.type]?.(e, dt, c);
      if (e.atk) e.mode = "atk";
      else if (e.type === "gunner" && e.mvs === 0 && d < 50) e.mode = "shoot";
      else e.mode = e.mvs > 0 ? (e.mvs > e.speed * 0.9 ? "run" : "walk") : "idle";
    }
    if (e.aggro && e.type !== "hunter" && tgt === P) G.danger = Math.max(G.danger, clamp(1 - dp / 30, 0, 1));
    // velocity
    let vx = e.mvx * e.mvs, vz = e.mvz * e.mvs;
    if (e.dash) { if (G.time > e.dash.until) e.dash = null; else { vx = e.dash.x * e.dash.s; vz = e.dash.z * e.dash.s; } }
    if (e.stagger > 0 || e.type === "ninja" && e.hidden) { vx = 0; vz = 0; }
    vx += e.kb.x; vz += e.kb.z;
    e.kb.x *= Math.max(0, 1 - 5.5 * dt); e.kb.z *= Math.max(0, 1 - 5.5 * dt);
    if (e.kb.y > 0) { e.vel.y = Math.max(e.vel.y, e.kb.y); e.kb.y = 0; }
    if (flying) {
      const alt = e.ai.alt ?? 10;
      if (e.vel3) { e.vel.set(e.vel3.x, e.vel3.y, e.vel3.z); }
      else e.vel.y = e.atk && e.atk.name === "dive" ? e.vel.y * 0.9 : (alt - e.pos.y) * 2.2;
      if (!e.vel3) { e.vel.x = vx; e.vel.z = vz; }
      moveBody(e.pos, e.r, e.h, e.vel.x * dt, e.vel.y * dt, e.vel.z * dt);
    } else {
      e.vel.y -= 34 * dt;
      moveBody(e.pos, e.r, e.h, vx * dt, e.vel.y * dt, vz * dt);
      if (mv.landed) e.vel.y = 0;
    }
    e.spd += (Math.hypot(vx, vz) - e.spd) * Math.min(1, dt * 10);
    // facing
    e.yaw = dampAng(e.yaw, e.dash ? Math.atan2(e.dash.x, e.dash.z) : e.mvs > 0 && !e.atk && e.type !== "gunner" && e.type !== "assassin" && e.type !== "criminal" && e.aggro ? Math.atan2(e.mvx, e.mvz) : e.faceYaw, 12, dt);
    rig.root.position.copy(e.pos);
    if (e.hover) rig.root.position.y += e.hover + Math.sin(time * 2 + e.t0) * 0.2;
    rig.root.rotation.y = e.yaw;
    let p = 0;
    if (e.atk) { const a = e.atk, w = a.def.wind; p = a.t < w ? (a.t / w) * 0.3 : 0.3 + ((a.t - w) / Math.max(0.1, a.def.dur - w)) * 0.7; }
    let mode = e.mode;
    if (flying && mode !== "atk" && mode !== "hit") mode = "float";
    if (e.floatAnim && (mode === "idle" || mode === "run" || mode === "walk")) mode = "float";
    if (e.forceMode) mode = e.forceMode;
    animate(rig, { mode: mode === "run" || mode === "walk" ? "run" : mode, spd: clamp(e.spd / 9, 0, 1.3), kind: e.atk ? (e.atk.kind === 0 ? (e.kindAlt ? 1 : 0) : e.atk.kind) : 0, p, t: time + e.t0, k: mode === "atk" ? 24 : 14 }, dt);
  }
}
export const _x = [V3, THREE];
