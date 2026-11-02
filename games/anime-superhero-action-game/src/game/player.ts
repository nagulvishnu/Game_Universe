import * as THREE from "three";
import { G, P, V3, rnd, clamp, damp, dampAng, angDiff, fwd, yawTo, later, sstep } from "./core";
import { buildChar, animate, Rig } from "./rig";
import { fx, shake, hitstop } from "./fx";
import { sfx, voice } from "./audio";
import { moveBody, mv, rayHit, pointInBox } from "./world";
import { dmgEnemy, explode, shoot, chestPos, nearestEnemy, distToSeg, clearProjectiles } from "./combat";
import { spawnAlly, removeAlly, saveAllies, dismissAll, stashAllies, restoreAllies, stash } from "./allies";
import { useGame, toast, banner } from "../store";
import { HeroId, HERO } from "../data";

export const rigs = {} as Record<HeroId, Rig>;
let grp: THREE.Group;
const down = (c: string) => G.input.keys.has(c);
const pressed = (c: string) => G.input.pressed.has(c);
export const addUpdater = (fn: (dt: number) => boolean | void) => G.updaters.push(fn);

export function initPlayer(root: THREE.Group) {
  grp = new THREE.Group();
  root.add(grp);
  for (const h of ["kairo", "ryujin"] as HeroId[]) {
    rigs[h] = buildChar(h);
    grp.add(rigs[h].root);
    rigs[h].root.visible = h === P.hero;
  }
}
export const rig = () => rigs[P.hero];

const _v = new V3();
const camDir = (out = new V3()) => out.set(0, 0, -1).applyQuaternion(G.camera.quaternion);
const hand = (out = new V3()) => rig().handR.getWorldPosition(out);
const handL = (out = new V3()) => rig().handL.getWorldPosition(out);

export function aim(): { dir: V3; from: V3; point: V3; tgt: any } {
  const from = new V3(P.pos.x, P.pos.y + 1.3, P.pos.z).addScaledVector(fwd(P.yaw, _v), 0.6);
  let tgt: any = P.lock && !P.lock.dead ? P.lock : null;
  const cd = camDir(), co = G.camera.position;
  if (!tgt) {
    let best = 0.17;
    for (const e of G.enemies) {
      if (e.dead || e.hidden || e.invuln > 0) continue;
      const v = chestPos(e).sub(co), d = v.length();
      if (d > 70 || d < 4) continue;
      const ang = Math.acos(clamp(v.dot(cd) / d, -1, 1));
      if (ang < best) { best = ang; tgt = e; }
    }
  }
  let point: V3;
  if (tgt) point = chestPos(tgt);
  else point = rayHit(co.clone().addScaledVector(cd, 8), cd, 80, 1.5).p;
  const dir = point.clone().sub(from).normalize();
  const f = fwd(P.yaw);
  if (dir.x * f.x + dir.z * f.z < -0.1) dir.copy(f);
  return { dir, from, point, tgt };
}

function startAct(type: string, dur: number, kind: number, fireAt = 0, fn?: (a: any) => void, extra: any = {}) {
  P.act = { type, t: 0, dur, kind, fireAt, fn, fired: !fn, ...extra };
  return P.act;
}
const mods = () => G.mods;
function spend(key: string, cost: number, cd: number) {
  const h = P.hero;
  if (P.cd[h][key] > 0) return false;
  if (P.en[h] < cost) { if (P.cd[h][key] <= 0) { toast("Not enough energy", "#8ac"); } return false; }
  P.en[h] -= cost;
  const c = cd * mods().cd;
  P.cd[h][key] = c;
  P.cdMax[key] = c;
  return true;
}
function faceAim(dir: V3) {
  P.yaw = Math.atan2(dir.x, dir.z);
}

/* ----------- lock-on ----------- */
function lockCandidates() {
  const out: { e: any; a: number }[] = [];
  const cd = camDir().setY(0).normalize();
  for (const e of G.enemies) {
    if (e.dead || e.hidden || e.invuln > 0) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > 48 || d < 0.5) continue;
    const dot = (dx * cd.x + dz * cd.z) / d;
    if (dot < 0.1) continue;
    out.push({ e, a: angDiff(Math.atan2(cd.x, cd.z), Math.atan2(dx, dz)) });
  }
  return out.sort((a, b) => a.a - b.a);
}
function toggleLock() {
  if (P.lock) { P.lock = null; return; }
  const c = lockCandidates();
  if (!c.length) return toast("No target in range", "#aaa");
  c.sort((a, b) => Math.abs(a.a) - Math.abs(b.a));
  P.lock = c[0].e;
  sfx("ui");
}
function cycleLock(dir: number) {
  if (!P.lock) return;
  const c = lockCandidates();
  if (c.length < 2) return;
  const i = c.findIndex((x) => x.e === P.lock);
  P.lock = c[(i + dir + c.length) % c.length].e;
  sfx("ui");
}

/* ----------- switching ----------- */
export function switchHero(to?: HeroId, force = false) {
  const from = P.hero;
  const nh: HeroId = to ?? (from === "kairo" ? "ryujin" : "kairo");
  if (nh === from) return;
  if (!force && (P.switchCd > 0 || (P.act && (P.act.type === "ult" || P.act.type === "beam")))) return;
  if (P.hp[nh] <= 0) { toast(`${HERO[nh].name} is down!`, "#ff6666"); return; }
  const p = P.pos.clone().add(new V3(0, 1, 0));
  fx.burst(p, parseInt(HERO[from].color.slice(1), 16), 24, 8, 0.6, 0.6, 0);
  fx.burst(p, parseInt(HERO[nh].color.slice(1), 16), 24, 10, 0.6, 0.7, 0);
  fx.ring(P.pos.x, P.pos.z, 0.5, 5, parseInt(HERO[nh].color.slice(1), 16), 0.5);
  fx.mesh("beam", P.pos.x, 0, P.pos.z, parseInt(HERO[nh].color.slice(1), 16), { life: 0.5, s0: [1.2, 40, 1.2], s1: [0.1, 40, 0.1], o0: 0.7 });
  fx.light(p, parseInt(HERO[nh].color2.slice(1), 16), 60, 0.4);
  sfx("teleport");
  if (from === "ryujin") stashAllies();
  P.hero = nh;
  P.act = null; P.charging = 0;
  P.lock = P.lock;
  P.switchCd = 1.4;
  P.invul = Math.max(P.invul, 0.6);
  rigs[from].root.visible = false;
  rigs[nh].root.visible = true;
  rigs[nh].root.scale.setScalar(rigs[nh].scale * 0.2);
  P.popT = 0.001;
  useGame.getState().setHero(nh);
  if (nh === "ryujin") restoreAllies(stash.length ? [...stash] : useGame.getState().companions);
  if (nh === "ryujin" && G.allies.length === 0 && useGame.getState().companions.length) restoreAllies(useGame.getState().companions);
  banner(HERO[nh].name, HERO[nh].title, HERO[nh].color, 1300);
  applyMods();
}
export function applyMods() {
  const u = useGame.getState().upgrades;
  const g = (k: string) => u[k] || 0;
  G.mods = { dmg: 1 + 0.08 * g("power"), hp: 1 + 0.1 * g("vital"), en: 1 + 0.15 * g("energy"), cd: 1 - 0.06 * g("haste"), mast: 1 + 0.1 * g("mastery"), ult: 1 + 0.15 * g("surge") };
  for (const h of ["kairo", "ryujin"] as HeroId[]) {
    const nm = Math.round(HERO[h].maxHp * G.mods.hp);
    if (P.maxHp[h] !== nm) { P.hp[h] += nm - P.maxHp[h]; P.maxHp[h] = nm; }
    P.maxEn[h] = HERO[h].maxEn + 0; 
  }
}

/* ----------- melee ----------- */
const KD = { kairo: [24, 24, 28, 50], ryujin: [20, 20, 26, 46] };
function meleeHit(kind: number, air = false) {
  const h = P.hero, f = fwd(P.yaw);
  const range = (h === "kairo" ? 3.3 : 3.9) + (kind === 3 ? 0.9 : 0) + (air ? 0.6 : 0);
  const arc = air ? -1 : h === "kairo" ? 0.0 : 0.25;
  let dmg = (air ? 36 : KD[h][kind]) * 1;
  let hits = 0;
  const hp = P.pos.clone().addScaledVector(f, 1.2).setY(P.pos.y + 1.2);
  for (const e of G.enemies) {
    if (e.dead || e.hidden || e.invuln > 0) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz) - e.r;
    if (d > range || e.pos.y > P.pos.y + 3.6 || e.pos.y + e.h < P.pos.y - 1.5) continue;
    const dot = (dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1);
    if (dot < arc && d > 1.3) continue;
    const dir = new V3(dx, 0, dz).normalize();
    const crit = Math.random() < 0.1;
    dmgEnemy(e, dmg * (crit ? 1.5 : 1), { kb: dir.multiplyScalar(kind === 3 || air ? 12 : 4.5).setY(kind === 3 ? 4 : 0.5), stagger: kind === 3 || air ? 0.7 : 0.28, crit, fire: h === "kairo" && kind >= 2 });
    fx.sparks(chestPos(e), h === "kairo" ? 0xffb030 : 0xb080ff, 10, 10);
    fx.mesh("sphere", e.pos.x, e.pos.y + e.h * 0.55, e.pos.z, 0xffffff, { life: 0.12, s0: [0.4, 0.4, 0.4], s1: [1.3, 1.3, 1.3], o0: 0.9 });
    P.en[h] = Math.min(P.maxEn[h], P.en[h] + 3);
    hits++;
  }
  G.hooks.damageAt?.(hp, 2.5, dmg, "p");
  if (hits) {
    hitstop(kind === 3 ? 0.11 : 0.05);
    shake(kind === 3 ? 0.5 : 0.18);
    sfx(kind === 3 ? "heavy" : "punch", P.pos);
    P.lastCombat = G.time;
  } else sfx("whoosh", P.pos, 0.6);
  // visuals
  const hc = h === "kairo" ? 0xff7a1a : 0x9a6bff;
  const hc2 = h === "kairo" ? 0xffd23f : 0x3fd0ff;
  const hpos = hp.clone();
  if (h === "kairo") {
    fx.burst(hpos, hc, 10, 6, 0.5, 0.4, -2);
    fx.mesh("sphere", hpos.x + f.x, hpos.y, hpos.z + f.z, hc2, { life: 0.18, s0: [0.5, 0.5, 0.5], s1: [1.6, 1.6, 1.6], o0: 0.7 });
    if (kind === 3) explode(hpos.clone().addScaledVector(f, 1.5), 4, 30 * mods().mast, { team: "p", knock: 10, stagger: 0.6, vfx: true, shake: 0.4 });
  } else {
    const roll = kind === 2 ? 0.6 : kind === 1 ? -0.5 : 0.3;
    const m = fx.mesh("slash", hpos.x, hpos.y + 0.1, hpos.z, kind % 2 ? hc2 : hc, { life: 0.22, s0: [range * 0.7, 1, range * 0.7], s1: [range * 1.0, 1, range * 1.0], o0: 0.9, ry: P.yaw - 1.4 });
    m.mesh.rotation.z = roll; m.mesh.rotation.order = "YXZ";
    fx.burst(hpos, hc, 8, 5, 0.4, 0.4, 0);
    if (kind === 3) shoot({ kind: "wave", team: "p", pos: hpos, dir: f, speed: 28, dmg: 32 * mods().mast, hitR: 1.4, life: 0.6, pierce: true, wave: true, scale: 1.2, knock: 6, stagger: 0.4 });
  }
}
function startAttack() {
  const h = P.hero;
  const air = !P.grounded && !P.flying;
  let kind = P.combo;
  if (air) kind = 4;
  if (P.comboT <= 0 && !air) { P.combo = 0; kind = 0; }
  const durs = [0.36, 0.36, 0.44, 0.66, 0.55];
  const dur = durs[kind] * (h === "kairo" ? 0.92 : 1);
  // aim assist
  const t = P.lock && !P.lock.dead ? P.lock : nearestEnemy(P.pos, 9, (e) => {
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
    const f = fwd(P.yaw);
    return (dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1) > 0.3 || Math.hypot(dx, dz) < 3;
  });
  let lunge: V3 | null = null;
  if (t) {
    const dx = t.pos.x - P.pos.x, dz = t.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    P.yaw = Math.atan2(dx, dz);
    const need = clamp(d - t.r - 1.4, 0, h === "kairo" ? 7 : 5);
    lunge = new V3(dx / d, 0, dz / d).multiplyScalar(need / (dur * 0.4));
  } else {
    const cd = camDir().setY(0).normalize();
    const mi = moveInput();
    if (mi.len > 0.1) P.yaw = Math.atan2(mi.x, mi.z); else if (G.cam.aim) P.yaw = Math.atan2(cd.x, cd.z);
    lunge = fwd(P.yaw).multiplyScalar(h === "kairo" ? 5 : 3.5);
  }
  startAct("atk", dur, kind, dur * 0.42, () => meleeHit(kind, air), { lunge, air });
  sfx("whoosh", P.pos, 0.5);
  if (!air) { P.combo = (kind + 1) % 4; }
  P.comboT = 1.0;
  P.queued = false;
  if (air) { P.vel.y = Math.max(P.vel.y, 3); }
}

/* ----------- heavy ----------- */
function startCharge() {
  P.charging = 0.0001;
  startAct("charge", 99, 0, 0, undefined, { heavy: true });
  sfx("charge", P.pos, 0.5);
}
function releaseHeavy() {
  const frac = clamp(P.charging / 1.0, 0, 1);
  P.charging = 0;
  const h = P.hero;
  const a = aim();
  faceAim(new V3(a.dir.x, 0, a.dir.z).normalize());
  const f = fwd(P.yaw);
  startAct("cast", 0.55, 5, 0.16, () => {
    const o = P.pos.clone().add(new V3(0, 1.2, 0));
    if (h === "kairo") {
      const c = P.pos.clone().addScaledVector(f, 4.2);
      P.vel.x = f.x * 14; P.vel.z = f.z * 14;
      explode(c.setY(0.5), (4.5 + frac * 2.5) * mods().mast, (55 + 100 * frac) * mods().mast, { team: "p", knock: 14 + frac * 8, stagger: 0.9, burn: true, shake: 0.5 + frac * 0.4 });
      hitstop(0.08);
    } else {
      shoot({ kind: "wave", team: "p", pos: o.addScaledVector(f, 1), dir: f, speed: 38, dmg: (50 + 90 * frac) * mods().mast, hitR: 1.6 + frac, life: 1.1, pierce: true, wave: true, scale: 1.3 + frac * 1.2, knock: 8, stagger: 0.7 });
      fx.burst(o, 0x8a5cff, 20, 10, 0.5, 0.5, 0);
      sfx("shadow", P.pos);
      shake(0.3);
    }
    sfx("heavy", P.pos);
  });
}

/* ----------- movement helpers ----------- */
function moveInput() {
  const ix = (down("KeyD") ? 1 : 0) - (down("KeyA") ? 1 : 0), iz = (down("KeyW") ? 1 : 0) - (down("KeyS") ? 1 : 0);
  const y = G.cam.yaw;
  const x = -Math.cos(y) * ix + Math.sin(y) * iz, z = Math.sin(y) * ix + Math.cos(y) * iz;
  const len = Math.hypot(x, z);
  return { x: len > 0 ? x / len : 0, z: len > 0 ? z / len : 0, len: Math.min(1, len), ix, iz };
}
function startFlying() {
  P.flying = true;
  P.vel.y = Math.max(P.vel.y, 4);
  fx.ring(P.pos.x, P.pos.z, 0.5, 6, P.hero === "kairo" ? 0xffaa40 : 0xa070ff, 0.5, P.pos.y + 0.2);
  sfx("whoosh", P.pos);
  toast("FLIGHT ACTIVATED — Space ascend · C descend · Shift boost", "#9cf");
}
function jump() {
  const sinceLast = G.time - P.lastSpace;
  P.lastSpace = G.time;
  if (P.flying) return;
  const h = P.hero;
  if (P.grounded) {
    if (down("ShiftLeft") || down("ShiftRight")) {
      P.vel.y = 42; P.jumps = 1;
      fx.ring(P.pos.x, P.pos.z, 0.5, 7, h === "kairo" ? 0xffaa40 : 0xa070ff, 0.5);
      fx.burst(P.pos.clone().add(new V3(0, 0.5, 0)), h === "kairo" ? 0xff7a1a : 0x8a5cff, 24, 10, 0.6, 0.6, 0);
      shake(0.3); sfx("dash", P.pos);
    } else { P.vel.y = h === "kairo" ? 16 : 15.2; P.jumps = 1; sfx("jump", P.pos, 0.6); }
    P.grounded = false;
  } else if (sinceLast < 0.32 && P.jumps >= 1) startFlying();
  else if (P.jumps < 2) {
    P.vel.y = 15.5; P.jumps = 2; sfx("jump", P.pos, 0.7);
    fx.ring(P.pos.x, P.pos.z, 0.3, 3, h === "kairo" ? 0xffaa40 : 0xa070ff, 0.4, P.pos.y + 0.1);
  }
}

/* ----------- abilities ----------- */
function castE() {
  const h = P.hero;
  const info = HERO[h].abilities[0];
  if (!spend("E", info.cost, info.cd)) return;
  const a = aim();
  faceAim(new V3(a.dir.x, 0, a.dir.z).normalize());
  startAct("cast", 0.4, 10, 0.18, () => {
    const d = aim();
    const o = hand();
    if (h === "kairo") {
      voice("Fireball!", 1.3, 1.1);
      const p = shoot({ kind: "fire", team: "p", pos: o, dir: d.dir, speed: 30, dmg: 68 * mods().mast, radius: 4.6, life: 4, homing: { tgt: d.tgt ?? nearestEnemy(P.pos, 40), turn: 3.6 }, knock: 9, stagger: 0.5, scale: 1.1, burn: true, hitR: 0.9 });
      void p;
      sfx("fireball", P.pos);
    } else {
      shoot({ kind: "dark", team: "p", pos: o, dir: d.dir, speed: 58, dmg: 54 * mods().mast, radius: 2.8, life: 1.5, homing: d.tgt ? { tgt: d.tgt, turn: 1.4 } : undefined, knock: 7, stagger: 0.4, scale: 1, expDark: true, hitR: 0.8 });
      sfx("shadow", P.pos, 0.8);
    }
    fx.burst(o, h === "kairo" ? 0xffa030 : 0x9a6bff, 10, 6, 0.4, 0.3, 0);
  });
}
function coneHit(dirv: V3, range: number, cosA: number, dmg: number, kb: number, stg: number, fire = false) {
  let n = 0;
  for (const e of G.enemies) {
    if (e.dead || e.hidden || e.invuln > 0) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d - e.r > range) continue;
    if ((dx * dirv.x + dz * dirv.z) / (d || 1) < cosA && d > 2) continue;
    dmgEnemy(e, dmg, { kb: new V3(dx, 0.5, dz).normalize().multiplyScalar(kb), stagger: stg, fire });
    n++;
  }
  G.hooks.damageAt?.(P.pos.clone().addScaledVector(dirv, range * 0.5), range * 0.5, dmg, "p");
  return n;
}
function castR() {
  const h = P.hero;
  const info = HERO[h].abilities[1];
  if (!spend("R", info.cost, info.cd)) return;
  const a = aim();
  faceAim(new V3(a.dir.x, 0, a.dir.z).normalize());
  if (h === "kairo") {
    voice("Inferno burst!", 1.2, 1.1);
    startAct("cast", 0.65, 11, 0.24, () => {
      const f = fwd(P.yaw), o = P.pos.clone().add(new V3(0, 1.2, 0));
      const n = coneHit(f, 14 * mods().mast, 0.35, 92 * mods().mast, 18, 0.9, true);
      for (let i = 0; i < 90; i++) {
        const sp = rnd(10, 26), ang = rnd(-0.6, 0.6), ca = Math.atan2(f.x, f.z) + ang;
        fx.em(o.x, o.y + rnd(-0.4, 0.4), o.z, Math.sin(ca) * sp, rnd(-1, 3), Math.cos(ca) * sp, [0xff4a10, 0xff7a1a, 0xffd23f][i % 3], rnd(1, 2.4), rnd(0.4, 0.8), -1, 1.5);
      }
      const m = fx.mesh("cone", o.x, o.y, o.z, 0xff7a1a, { life: 0.45, s0: [1, 3, 1], s1: [9, 14, 9], o0: 0.55, dir: f.clone().setY(0) });
      m.mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), f);
      fx.ring(P.pos.x, P.pos.z, 1, 14, 0xffd23f, 0.5);
      fx.light(o.clone().addScaledVector(f, 4), 0xff8a30, 70, 0.5);
      sfx("explosion", P.pos); sfx("fire", P.pos);
      shake(0.7); hitstop(n ? 0.08 : 0);
    });
  } else {
    voice("Void beam.", 0.6, 0.8);
    sfx("charge", P.pos);
    startAct("beam", 2.8, 11, 0, undefined, { phase: 0, tick: 0, beam: null, beam2: null });
    P.act.upd = (act: any, dt: number) => {
      const d = aim();
      const o = hand();
      if (act.t < 0.65) {
        // charge
        P.vel.x *= 0.8; P.vel.z *= 0.8;
        const k = act.t / 0.65;
        fx.mesh("sphere", o.x, o.y, o.z, 0x8a5cff, { life: 0.08, s0: [0.3 + k * 0.8, 0.3 + k * 0.8, 0.3 + k * 0.8], o0: 0.9 });
        for (let i = 0; i < 3; i++) { const a = rnd(0, 6.28), r = 2.5 * (1 - k) + 0.5; fx.em(o.x + Math.cos(a) * r, o.y + rnd(-1, 1) * r, o.z + Math.sin(a) * r, 0, 0, 0, 0xb080ff, 0.4, 0.2, 0); }
      } else {
        if (!act.beam) {
          act.beam = fx.mesh("beam", o.x, o.y, o.z, 0x7a3cff, { life: Infinity, s0: [1, 1, 1], o0: 0.55, o1: 0.55 });
          act.beam2 = fx.mesh("beam", o.x, o.y, o.z, 0xd8ffff, { life: Infinity, s0: [1, 1, 1], o0: 0.95, o1: 0.95 });
          sfx("beam", P.pos);
          shake(0.4);
        }
        faceAim(new V3(d.dir.x, 0, d.dir.z).normalize());
        const dir = d.dir.clone();
        const rh = rayHit(o, dir, 55, 1.2);
        const len = rh.d;
        const w = 0.9 + Math.sin(G.time * 40) * 0.12;
        for (const [m, k] of [[act.beam, 1], [act.beam2, 0.38]] as [any, number][]) {
          m.mesh.position.copy(o);
          m.mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
          m.mesh.scale.set(w * k * 1.2, len, w * k * 1.2);
        }
        const end = o.clone().addScaledVector(dir, len);
        fx.em(end.x, end.y, end.z, rnd(-6, 6), rnd(0, 6), rnd(-6, 6), 0xc9a0ff, 0.8, 0.4, 5);
        for (let i = 0; i < 3; i++) { const t = Math.random() * len; fx.em(o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t, rnd(-2, 2), rnd(-2, 2), rnd(-2, 2), 0x9a6bff, 0.5, 0.3); }
        shake(0.12);
        act.tick -= dt;
        if (act.tick <= 0) {
          act.tick = 0.1;
          for (const e of G.enemies) {
            if (e.dead || e.hidden || e.invuln > 0) continue;
            const c = chestPos(e);
            if (distToSeg(c, o, end) < e.r + 1.0) dmgEnemy(e, 12.5 * mods().mast, { kb: dir.clone().setY(0).multiplyScalar(2), stagger: 0.12, silent: Math.random() < 0.5 });
          }
          G.hooks.damageAt?.(end, 3, 22, "p");
          if (rh.hit) fx.em(end.x, end.y, end.z, 0, 3, 0, 0xffffff, 1.5, 0.3);
        }
      }
    };
    P.act.end = (act: any) => { fx.kill(act.beam); fx.kill(act.beam2); };
  }
}
function targetGround(): V3 {
  const a = aim();
  if (a.tgt) return new V3(a.tgt.pos.x, 0, a.tgt.pos.z);
  const co = G.camera.position, cd = camDir();
  const rh = rayHit(co.clone().addScaledVector(cd, 8), cd, 60, 1);
  let p = rh.p.clone();
  if (!rh.hit && cd.y < -0.05) { const t = -co.y / cd.y; p = co.clone().addScaledVector(cd, Math.min(t, 70)); }
  p.y = 0;
  const dx = p.x - P.pos.x, dz = p.z - P.pos.z, d = Math.hypot(dx, dz);
  if (d > 55) { p.x = P.pos.x + (dx / d) * 55; p.z = P.pos.z + (dz / d) * 55; }
  if (d < 6) { const f = fwd(P.yaw); p.x = P.pos.x + f.x * 12; p.z = P.pos.z + f.z * 12; }
  return p;
}
function castF() {
  const h = P.hero;
  const info = HERO[h].abilities[2];
  if (!spend("F", info.cost, info.cd)) return;
  if (h === "kairo") {
    voice("Meteor strike!", 1.1, 1.0);
    const tp = targetGround();
    faceAim(new V3(tp.x - P.pos.x, 0, tp.z - P.pos.z).normalize());
    startAct("cast", 0.7, 12, 0.3, () => {
      sfx("charge", tp, 0.8);
      const marker = fx.mesh("ring", tp.x, 0.2, tp.z, 0xff4a10, { life: 1.4, s0: [12 * mods().mast, 1, 12 * mods().mast], s1: [12 * mods().mast, 1, 12 * mods().mast], o0: 0.9, o1: 0.9 });
      const disc = fx.mesh("disc", tp.x, 0.18, tp.z, 0xff3a00, { life: 1.4, s0: [0.5, 1, 0.5], s1: [12 * mods().mast, 1, 12 * mods().mast], o0: 0.25, o1: 0.4 });
      void marker; void disc;
      const start = new V3(tp.x + 30, 120, tp.z + 18);
      const m = fx.mesh("sphere", start.x, start.y, start.z, 0xff7a1a, { life: Infinity, s0: [3.4, 3.4, 3.4], o0: 0.85, o1: 0.85 });
      const core = fx.mesh("sphere", start.x, start.y, start.z, 0xffe9a0, { life: Infinity, s0: [2.2, 2.2, 2.2], o0: 1, o1: 1 });
      let t = 0;
      addUpdater((dt) => {
        t += dt;
        const k = clamp((t - 0.35) / 1.0, 0, 1);
        const p = start.clone().lerp(tp.clone().setY(2), k * k);
        m.mesh.position.copy(p); core.mesh.position.copy(p);
        for (let i = 0; i < 6; i++) fx.em(p.x + rnd(-1.5, 1.5), p.y + rnd(-1, 2.5), p.z + rnd(-1.5, 1.5), rnd(-2, 2), rnd(0, 3), rnd(-2, 2), [0xff5a10, 0xffb030][i % 2], rnd(1.5, 3), 0.8, 0, 0.5);
        if (k >= 1) {
          fx.kill(m); fx.kill(core);
          explode(tp.clone(), 12 * mods().mast, 210 * mods().mast, { team: "p", knock: 22, stagger: 1.2, burn: true, shake: 1.1 });
          fx.mesh("beam", tp.x, 0, tp.z, 0xffa040, { life: 0.8, s0: [3, 60, 3], s1: [0.2, 60, 0.2], o0: 0.7 });
          hitstop(0.1);
          for (let i = 0; i < 8; i++) later(i * 0.05, () => fx.explosion(new V3(tp.x + rnd(-8, 8), 0, tp.z + rnd(-8, 8)), rnd(2, 4)));
          return true;
        }
        return false;
      });
    });
  } else {
    voice("Rise.", 0.5, 0.8);
    startAct("cast", 0.8, 12, 0.35, () => {
      for (let i = 0; i < 3; i++) {
        const a = P.yaw + (i - 1) * 1.1;
        spawnAlly("warrior", P.pos.clone().add(new V3(Math.sin(a) * 3, 0, Math.cos(a) * 3)), { temp: 20 });
      }
      fx.ring(P.pos.x, P.pos.z, 1, 9, 0x8a5cff, 0.7);
      fx.mesh("dome", P.pos.x, 0, P.pos.z, 0x8a5cff, { life: 0.5, s0: [1, 1, 1], s1: [7, 5, 7], o0: 0.4 });
      sfx("summon", P.pos);
      shake(0.3);
    });
  }
}
function castQ() {
  const h = P.hero;
  const info = HERO[h].abilities[3];
  if (!spend("Q", info.cost, info.cd)) return;
  const mi = moveInput();
  const cd = camDir();
  const a = aim();
  let dir: V3;
  if (P.flying || !P.grounded) dir = a.dir.clone();
  else if (mi.len > 0.1) dir = new V3(mi.x, 0, mi.z);
  else dir = new V3(cd.x, 0, cd.z).normalize();
  if (P.lock && !P.lock.dead && h === "kairo") dir = new V3(P.lock.pos.x - P.pos.x, 0, P.lock.pos.z - P.pos.z).normalize();
  if (h === "kairo") {
    voice("Flame dash!", 1.2, 1.2);
    faceAim(new V3(dir.x, 0, dir.z).normalize());
    sfx("dash", P.pos);
    startAct("dash", 0.26, 13, 0, undefined, { dir, hit: new Set(), invul: true });
    P.invul = 0.3;
    P.act.upd = (act: any) => {
      P.vel.copy(act.dir).multiplyScalar(66);
      const o = P.pos.clone().add(new V3(0, 1, 0));
      fx.mesh("sphere", o.x, o.y, o.z, 0xff7a1a, { life: 0.3, s0: [1.1, 1.1, 1.1], s1: [0.2, 0.2, 0.2], o0: 0.6 });
      for (let i = 0; i < 6; i++) fx.em(o.x + rnd(-0.5, 0.5), o.y + rnd(-0.8, 0.8), o.z + rnd(-0.5, 0.5), rnd(-2, 2), rnd(0, 3), rnd(-2, 2), [0xff4a10, 0xffd23f][i % 2], rnd(0.8, 1.6), 0.5, -1);
      for (const e of G.enemies) {
        if (e.dead || act.hit.has(e) || e.hidden) continue;
        if (distToSeg(chestPos(e), o, o.clone().addScaledVector(act.dir, 2.5)) < e.r + 1.7) {
          act.hit.add(e);
          dmgEnemy(e, 58 * mods().mast, { kb: act.dir.clone().multiplyScalar(10).setY(3), stagger: 0.8, fire: true });
          fx.explosion(chestPos(e), 2.5);
          hitstop(0.05); shake(0.35);
        }
      }
      G.hooks.damageAt?.(o, 2.5, 25, "p");
    };
    P.act.end = () => { P.vel.multiplyScalar(0.25); };
  } else {
    // shadow step
    voice("Shadow step.", 0.6, 0.9);
    const from = P.pos.clone();
    let dest = P.pos.clone();
    let behind = false;
    const t = P.lock && !P.lock.dead && P.lock.pos.distanceTo(P.pos) < 32 ? P.lock : null;
    if (t) {
      const f = fwd(t.yaw ?? 0);
      dest.set(t.pos.x - f.x * (t.r + 1.8), t.pos.y, t.pos.z - f.z * (t.r + 1.8));
      behind = true;
      if (pointInBox(dest.x, dest.y + 1, dest.z)) dest.set(t.pos.x + f.x * (t.r + 1.8), t.pos.y, t.pos.z + f.z * (t.r + 1.8));
    } else {
      const probe = P.pos.clone();
      let last = P.pos.clone();
      for (let d = 1; d <= 15; d += 1) {
        probe.copy(P.pos).addScaledVector(dir, d);
        if (probe.y < 0) probe.y = 0;
        if (pointInBox(probe.x, probe.y + 0.9, probe.z) || pointInBox(probe.x, probe.y + 0.1, probe.z)) break;
        last.copy(probe);
      }
      dest.copy(last);
    }
    fx.burst(from.clone().add(new V3(0, 1, 0)), 0x8a5cff, 26, 8, 0.7, 0.6, 0);
    fx.smoke(from.x, from.y + 1, from.z, 0, 1, 0, 0x120a22, 3, 1.2, 0, 1);
    fx.mesh("beam", from.x, from.y, from.z, 0x6a3cff, { life: 0.35, s0: [0.8, 3, 0.8], s1: [0.1, 4, 0.1], o0: 0.7 });
    P.pos.copy(dest);
    P.vel.set(0, Math.max(0, P.vel.y * 0.3), 0);
    if (t) P.yaw = yawTo(P.pos, t.pos);
    fx.burst(dest.clone().add(new V3(0, 1, 0)), 0x3fd0ff, 26, 8, 0.6, 0.6, 0);
    fx.ring(dest.x, dest.z, 0.5, 4, 0xa070ff, 0.4, dest.y + 0.2);
    fx.mesh("beam", dest.x, dest.y, dest.z, 0x9a6bff, { life: 0.4, s0: [0.1, 3, 0.1], s1: [0.9, 5, 0.9], o0: 0.7 });
    // afterimage trail
    for (let i = 0; i < 12; i++) { const k = i / 12; fx.em(from.x + (dest.x - from.x) * k, from.y + 1 + (dest.y - from.y) * k, from.z + (dest.z - from.z) * k, 0, 0.5, 0, 0x8a5cff, 0.9, 0.5); }
    sfx("teleport", dest);
    P.invul = Math.max(P.invul, 0.4);
    startAct("cast", 0.35, 14, 0.05, () => {
      for (const e of G.enemies) {
        if (e.dead || e.hidden) continue;
        if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 4 + e.r) dmgEnemy(e, (behind && t === e ? 52 : 34) * mods().mast, { kb: fwd(P.yaw).multiplyScalar(5), stagger: 0.45, crit: behind && t === e });
      }
      fx.mesh("slash", P.pos.x, P.pos.y + 1, P.pos.z, 0xc9a0ff, { life: 0.25, s0: [2, 1, 2], s1: [4, 1, 4], o0: 0.9, ry: P.yaw });
      shake(0.2);
    });
  }
}
function castV() {
  const info = HERO.ryujin.abilities[4];
  if (P.hero !== "ryujin") return;
  let best: any = null, bd = 40;
  for (const s of G.souls) { const d = s.pos.distanceTo(P.pos); if (d < bd) { bd = d; best = s; } }
  if (!best) { toast("No shadow to extract — defeat an enemy first", "#b99aff"); return; }
  if (!spend("V", info.cost, info.cd)) return;
  voice("Arise.", 0.5, 0.8);
  G.souls.splice(G.souls.indexOf(best), 1);
  const sp = best.pos.clone();
  const type = best.type;
  startAct("cast", 0.6, 12, 0.2, undefined);
  fx.ring(sp.x, sp.z, 0.5, 4, 0xa070ff, 0.6, sp.y);
  let t = 0;
  const orb = fx.mesh("sphere", sp.x, sp.y, sp.z, 0xc9a0ff, { life: Infinity, s0: [0.7, 0.7, 0.7], o0: 0.9, o1: 0.9 });
  sfx("summon", sp, 0.8);
  addUpdater((dt) => {
    t += dt;
    const k = clamp(t / 0.7, 0, 1);
    const tgt = P.pos.clone().add(new V3(0, 1.2, 0));
    orb.mesh.position.lerpVectors(sp, tgt, k * k);
    fx.em(orb.mesh.position.x, orb.mesh.position.y, orb.mesh.position.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0xa070ff, 0.6, 0.4);
    if (k >= 1) {
      fx.kill(orb);
      const perms = G.allies.filter((a: any) => a.perm && !a.dead);
      if (perms.length >= 5) removeAlly(perms[0]);
      const pos = P.pos.clone().addScaledVector(fwd(P.yaw), 2.5);
      const al = spawnAlly(type, pos, { perm: true });
      saveAllies();
      toast(`Shadow extracted: ${al.name}`, "#c9a0ff");
      banner(al.name.toUpperCase(), "SHADOW EXTRACTED", "#a070ff", 1800);
      return true;
    }
  });
}

/* ----------- ultimates ----------- */
function castUlt() {
  const h = P.hero;
  if (P.ult[h] < 100 || P.act) return;
  P.ult[h] = 0;
  P.invul = 99;
  P.vel.set(0, 0, 0);
  const a = aim();
  faceAim(new V3(a.dir.x, 0, a.dir.z).normalize());
  if (h === "kairo") {
    voice("Solar Apocalypse!", 0.9, 0.9);
    banner("SOLAR APOCALYPSE", "KAIRO", "#ffb020", 2400);
    sfx("longcharge");
    const act = startAct("ult", 3.7, 14, 0, undefined, { hover: true, sun: null, blasted: false });
    act.upd = (ac: any) => {
      const t = ac.t;
      P.vel.x = 0; P.vel.z = 0;
      P.vel.y = t < 1.2 ? 4.5 : 0;
      const top = P.pos.clone().add(new V3(0, 7, 0));
      if (!ac.sun) { ac.sun = fx.mesh("sphere", top.x, top.y, top.z, 0xff8a20, { life: Infinity, s0: [0.5, 0.5, 0.5], o0: 0.9, o1: 0.9 }); ac.sun2 = fx.mesh("sphere", top.x, top.y, top.z, 0xfff0b0, { life: Infinity, s0: [0.3, 0.3, 0.3], o0: 1, o1: 1 }); }
      if (t < 2.5) {
        const k = t / 2.5, s = 0.6 + k * k * 5.5;
        ac.sun.mesh.position.copy(top); ac.sun2.mesh.position.copy(top);
        ac.sun.mesh.scale.setScalar(s * (1 + Math.sin(t * 30) * 0.03)); ac.sun2.mesh.scale.setScalar(s * 0.65);
        for (let i = 0; i < 6; i++) { const an = rnd(0, 6.28), r = 14 * (1 - k * 0.3), el = rnd(-0.6, 0.6); fx.em(top.x + Math.cos(an) * r, top.y + el * r, top.z + Math.sin(an) * r, -Math.cos(an) * r * 1.6, -el * r * 1.6, -Math.sin(an) * r * 1.6, [0xff5a10, 0xffb030, 0xffe08a][i % 3], 1.2, 0.7); }
        G.shakeAdd = 0.1 + k * 0.4;
        shake(0.08 + k * 0.35);
        if (Math.random() < 0.3) fx.ring(P.pos.x, P.pos.z, 1, 8 + k * 10, 0xff8a20, 0.5, 0.2, 0.4);
      } else if (!ac.blasted) {
        ac.blasted = true;
        const c = P.pos.clone(); c.y = 0;
        fx.kill(ac.sun); fx.kill(ac.sun2);
        G.flash = 1; shake(1.8); hitstop(0.18);
        explode(c, 48 * mods().mast, 640 * mods().mast, { team: "p", knock: 30, stagger: 1.4, burn: true, shake: 1.8, falloff: 0.5 });
        clearProjectiles("e");
        for (let i = 0; i < 4; i++) later(i * 0.12, () => { fx.ring(c.x, c.z, 2, 60 + i * 6, [0xffd23f, 0xff7a1a, 0xff4a10, 0xffffff][i], 0.9 + i * 0.1, 0.3 + i * 0.1, 0.9); });
        fx.mesh("sphere", c.x, 6, c.z, 0xffb040, { life: 1.4, s0: [4, 4, 4], s1: [40, 26, 40], o0: 0.7, ease: 2 });
        fx.mesh("beam", c.x, 0, c.z, 0xffd23f, { life: 1.4, s0: [5, 150, 5], s1: [1, 150, 1], o0: 0.8 });
        for (let i = 0; i < 22; i++) later(0.1 + i * 0.07, () => fx.explosion(new V3(c.x + rnd(-1, 1) * 36, 0, c.z + rnd(-1, 1) * 36), rnd(3, 7)));
        sfx("big"); sfx("explosion");
        for (const e of G.enemies) if (!e.dead) fx.mesh("beam", e.pos.x, 0, e.pos.z, 0xff9a30, { life: 0.9, s0: [2, 60, 2], s1: [0.3, 60, 0.3], o0: 0.7 });
      }
    };
    act.end = (ac: any) => { fx.kill(ac.sun); fx.kill(ac.sun2); P.invul = 0.6; P.victoryT = 1.2; };
  } else {
    voice("Army of the Abyss.", 0.5, 0.75);
    banner("ARMY OF THE ABYSS", "RYUJIN", "#a070ff", 2400);
    sfx("longcharge");
    const act = startAct("ult", 3.9, 14, 0, undefined, { dome: null, waves: 0, summoned: false });
    act.upd = (ac: any) => {
      const t = ac.t;
      P.vel.x = 0; P.vel.z = 0; P.vel.y = t < 1.2 ? 3 : 0;
      const c = P.pos.clone();
      if (!ac.dome) {
        ac.dome = fx.mesh("dome", c.x, 0, c.z, 0x2a0a60, { life: Infinity, s0: [1, 1, 1], o0: 0.5, o1: 0.5, back: true, dark: true });
        ac.dome2 = fx.mesh("dome", c.x, 0, c.z, 0x8a5cff, { life: Infinity, s0: [1, 1, 1], o0: 0.18, o1: 0.18, back: true });
      }
      const k = clamp(t / 1.5, 0, 1), rad = 4 + k * 36;
      ac.dome.mesh.scale.set(rad, rad * 0.9, rad); ac.dome2.mesh.scale.set(rad * 0.98, rad * 0.88, rad * 0.98);
      ac.dome.mesh.position.set(c.x, 0, c.z); ac.dome2.mesh.position.set(c.x, 0, c.z);
      shake(0.06 + k * 0.2);
      for (let i = 0; i < 5; i++) { const a = rnd(0, 6.28), r = rnd(0.3, 1) * rad * 0.9; fx.em(c.x + Math.cos(a) * r, 0.2, c.z + Math.sin(a) * r, 0, rnd(6, 16), 0, [0x8a5cff, 0x3fd0ff, 0xc9a0ff][i % 3], rnd(0.8, 1.8), 0.9, -2); }
      if (t < 1.6 && Math.random() < 0.25) fx.ring(c.x, c.z, 1, 14, 0x8a5cff, 0.7, 0.2, 0.7);
      if (t > 1.5 && !ac.summoned) {
        ac.summoned = true;
        G.flash = 0.6;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2, r = 6 + (i % 2) * 5;
          spawnAlly("soldier", c.clone().add(new V3(Math.sin(a) * r, 0, Math.cos(a) * r)), { temp: 15 });
        }
        sfx("summon"); sfx("big", undefined, 0.6);
        shake(1);
      }
      if (t > 1.7 && ac.waves < 4 && t > 1.7 + ac.waves * 0.35) {
        ac.waves++;
        explode(c, 36 * mods().mast, 150 * mods().mast, { team: "p", color: 0x8a5cff, color2: 0xe0d0ff, dark: true, knock: 10, stagger: 0.9, shake: 0.9, falloff: 0.3, vfx: ac.waves === 4 });
        fx.ring(c.x, c.z, 2, 38, 0xb080ff, 0.6, 0.3);
        hitstop(0.05);
        for (const e of G.enemies) if (!e.dead) {
          const ep = chestPos(e);
          fx.mesh("beam", e.pos.x, 0, e.pos.z, 0xa070ff, { life: 0.4, s0: [1.4, 40, 1.4], s1: [0.2, 40, 0.2], o0: 0.8 });
          fx.mesh("slash", ep.x, ep.y, ep.z, 0xe0d0ff, { life: 0.25, s0: [1.5, 1, 1.5], s1: [3.5, 1, 3.5], o0: 0.95, ry: rnd(0, 6.28) });
          fx.burst(ep, 0xc9a0ff, 8, 8, 0.4, 0.4, 0);
        }
      }
    };
    act.end = (ac: any) => { fx.kill(ac.dome); fx.kill(ac.dome2); P.invul = 0.6; P.victoryT = 1.2; };
  }
}

/* ----------- main update ----------- */
let wasGrounded = true;
export function resetPlayerState() {
  P.act = null; P.charging = 0; P.flying = false; P.vel.set(0, 0, 0); P.invul = 0; P.stagger = 0; P.dead = false; P.lock = null;
}
export function updatePlayer(dt: number, time: number) {
  const h = P.hero, R = rig();
  const inp = G.input;
  // timers & regen for both heroes
  for (const hh of ["kairo", "ryujin"] as HeroId[]) {
    for (const k in P.cd[hh]) P.cd[hh][k] = Math.max(0, P.cd[hh][k] - dt);
    if (hh !== h) {
      P.en[hh] = Math.min(P.maxEn[hh], P.en[hh] + 8 * dt);
      if (P.hp[hh] > 0) P.hp[hh] = Math.min(P.maxHp[hh], P.hp[hh] + P.maxHp[hh] * 0.015 * dt);
    }
  }
  P.invul = Math.max(0, P.invul - dt);
  P.hurtT = Math.max(0, P.hurtT - dt);
  P.landT = Math.max(0, P.landT - dt);
  P.dodgeCd = Math.max(0, P.dodgeCd - dt);
  P.perfectCd = Math.max(0, P.perfectCd - dt);
  P.switchCd = Math.max(0, P.switchCd - dt);
  P.comboT = Math.max(0, P.comboT - dt);
  P.stagger = Math.max(0, P.stagger - dt);
  P.victoryT = Math.max(0, (P.victoryT ?? 0) - dt);
  if (P.popT) { P.popT += dt * 4; const s = Math.min(1, P.popT); R.root.scale.setScalar(R.scale * (0.2 + 0.8 * (1 - Math.pow(1 - s, 3)) * (1 + (s < 1 ? Math.sin(s * 3.14) * 0.15 : 0)))); if (P.popT >= 1) { P.popT = 0; R.root.scale.setScalar(R.scale); } }
  const inCombat = G.time - P.lastCombat < 6;
  if (!P.act || P.act.type === "atk") P.en[h] = Math.min(P.maxEn[h], P.en[h] + (h === "ryujin" ? 9 : 7) * G.mods.en * dt);
  if (!inCombat && P.hp[h] > 0) P.hp[h] = Math.min(P.maxHp[h], P.hp[h] + P.maxHp[h] * 0.02 * dt);

  if (P.dead) {
    P.deadT += dt;
    animate(R, { mode: "dead", t: time }, dt);
    R.root.position.copy(P.pos); R.root.rotation.y = P.yaw;
    return;
  }

  const frozen = G.freezeInput;
  // inputs: actions
  if (!frozen) {
    if (pressed("Tab")) switchHero();
    if (pressed("KeyT")) toggleLock();
    if (inp.wheel) { cycleLock(inp.wheel > 0 ? 1 : -1); }
    if (pressed("KeyZ")) cycleLock(1);
    if (P.lock && (P.lock.dead || P.lock.pos.distanceTo(P.pos) > 60)) P.lock = null;
    if (pressed("KeyB") && h === "ryujin") { dismissAll(); toast("Companions dismissed to the shadow realm", "#b99aff"); }
    const canAct = !P.act && P.stagger <= 0;
    const interruptible = P.act && (P.act.type === "atk" || P.act.type === "charge") && P.stagger <= 0;
    if (pressed("Space")) jump();
    if (pressed("KeyC") && !P.flying && P.dodgeCd <= 0 && (canAct || interruptible) && P.stagger <= 0) {
      const mi = moveInput();
      const dir = mi.len > 0.1 ? new V3(mi.x, 0, mi.z) : fwd(P.yaw).multiplyScalar(-1);
      P.dodgeCd = 0.75; P.invul = 0.4; P.charging = 0;
      startAct("dodge", 0.4, 0, 0, undefined, { dir });
      if (mi.len > 0.1) P.yaw = Math.atan2(dir.x, dir.z);
      fx.burst(P.pos.clone().add(new V3(0, 0.5, 0)), 0xdddddd, 8, 5, 0.5, 0.4, 0);
      sfx("dash", P.pos, 0.6);
    }
    if (canAct || interruptible) {
      if (pressed("KeyE")) { P.charging = 0; castE(); }
      else if (pressed("KeyR")) { P.charging = 0; castR(); }
      else if (pressed("KeyF")) { P.charging = 0; castF(); }
      else if (pressed("KeyQ")) { P.charging = 0; castQ(); }
      else if (pressed("KeyV")) castV();
      else if (pressed("KeyX")) castUlt();
    }
    // basic / heavy
    if (inp.mPressed[0]) {
      if (canAct || (P.act?.type === "atk" && P.act.t > P.act.dur * 0.5)) {
        if (canAct) startAttack(); else P.queued = true;
      } else if (P.act?.type === "atk") P.queued = true;
    }
    if (P.act?.type === "atk" && P.queued && P.act.t >= P.act.dur * 0.78) startAttack();
    if (inp.mPressed[1] && canAct) startCharge();
    if (P.act?.type === "charge") {
      P.charging += dt;
      if (P.charging > 1.4) P.charging = 1.4;
      const hp = hand();
      const col = h === "kairo" ? [0xff5a10, 0xffd23f] : [0x8a5cff, 0x3fd0ff];
      for (let i = 0; i < 2; i++) { const a = rnd(0, 6.28), r = 1.6; fx.em(hp.x + Math.cos(a) * r, hp.y + rnd(-1, 1), hp.z + Math.sin(a) * r, -Math.cos(a) * 6, 0, -Math.sin(a) * 6, col[i], 0.4, 0.28); }
      if (P.charging > 0.95) fx.em(hp.x, hp.y, hp.z, rnd(-1, 1), rnd(1, 3), rnd(-1, 1), col[1], 0.7, 0.3);
      if (!inp.mouse[1]) releaseHeavy();
    }
  }

  // act update
  if (P.act) {
    const a = P.act;
    a.t += dt;
    if (!a.fired && a.t >= a.fireAt) { a.fired = true; a.fn?.(a); }
    a.upd?.(a, dt);
    if (P.act === a && a.t >= a.dur) { a.end?.(a); if (P.act === a) P.act = null; }
  }
  const act = P.act;

  // movement
  const mi = frozen ? { x: 0, z: 0, len: 0, ix: 0, iz: 0 } : moveInput();
  const sprint = (down("ShiftLeft") || down("ShiftRight")) && !act;
  P.sprint = sprint;
  const runSp = h === "kairo" ? 11.5 : 10.2, sprSp = h === "kairo" ? 20 : 17.5;
  const speedCap = act?.type === "atk" ? 3 : act?.type === "charge" ? runSp * 0.35 : act?.type === "cast" ? runSp * 0.3 : act?.type === "beam" || act?.type === "ult" ? 0 : sprint ? sprSp : runSp;
  const hasOverride = act && (act.type === "dash" || act.type === "dodge");
  const aimLock = act && (act.type === "cast" || act.type === "beam");
  void aimLock;
  if (P.stagger > 0) { P.vel.x *= Math.max(0, 1 - 6 * dt); P.vel.z *= Math.max(0, 1 - 6 * dt); }
  if (!hasOverride) {
    if (P.flying) {
      const cd = camDir();
      const boost = down("ShiftLeft") || down("ShiftRight");
      const fs = act ? 6 : boost ? 66 : 32;
      const tx = new V3();
      if (!frozen && !act) {
        const f = cd.clone(), r = new V3(-Math.cos(G.cam.yaw), 0, Math.sin(G.cam.yaw));
        tx.addScaledVector(f, mi.iz).addScaledVector(r, mi.ix);
        if (down("Space")) tx.y += 0.9;
        if (down("KeyC")) tx.y -= 0.9;
        if (tx.lengthSq() > 1) tx.normalize();
      }
      const target = tx.multiplyScalar(fs);
      const k = tx.lengthSq() > 0 ? 3.2 : 2.4;
      P.vel.x = damp(P.vel.x, target.x, k, dt); P.vel.y = damp(P.vel.y, target.y, k, dt); P.vel.z = damp(P.vel.z, target.z, k, dt);
      if (act?.type === "ult") { P.vel.x = 0; P.vel.z = 0; }
    } else {
      const acc = P.grounded ? 70 : 22;
      const tvx = mi.x * speedCap * mi.len, tvz = mi.z * speedCap * mi.len;
      if (act?.lunge && act.t < act.dur * 0.42) { P.vel.x = act.lunge.x; P.vel.z = act.lunge.z; }
      else {
        const dx = tvx - P.vel.x, dz = tvz - P.vel.z, dl = Math.hypot(dx, dz);
        const st = Math.min(dl, acc * dt);
        if (dl > 0.001) { P.vel.x += (dx / dl) * st; P.vel.z += (dz / dl) * st; }
      }
      const hover = act?.hover;
      if (!hover) { P.vel.y -= 34 * dt; if (P.vel.y < -70) P.vel.y = -70; }
      if (act?.type === "atk" && act.air && act.t < 0.25) P.vel.y = Math.max(P.vel.y, 0);
    }
  } else if (act!.type === "dodge") {
    const k = 1 - act!.t / act!.dur * 0.55;
    P.vel.x = act!.dir.x * 21 * k; P.vel.z = act!.dir.z * 21 * k;
    if (!P.grounded) P.vel.y = Math.max(P.vel.y, -2);
    else P.vel.y = 0;
  }
  // facing
  if (!hasOverride && P.stagger <= 0) {
    const lock = P.lock && !P.lock.dead ? P.lock : null;
    let ty = P.yaw;
    if (act?.type === "beam" || act?.type === "cast" && act.kind === 11 || (act?.type === "charge")) {
      const cd = camDir();
      ty = Math.atan2(cd.x, cd.z);
      P.yaw = dampAng(P.yaw, ty, 18, dt);
    } else if (act?.type !== "atk" && act?.type !== "ult") {
      if (lock && !sprint) ty = yawTo(P.pos, lock.pos);
      else if (mi.len > 0.1) ty = Math.atan2(mi.x, mi.z);
      else ty = P.yaw;
      P.yaw = dampAng(P.yaw, ty, P.flying ? 9 : 16, dt);
    }
  }
  // integrate
  const prevVy = P.vel.y;
  moveBody(P.pos, P.radius, P.height, P.vel.x * dt, P.vel.y * dt, P.vel.z * dt);
  if (mv.wall && P.flying) { /* slide */ }
  if (mv.landed && P.vel.y <= 0) {
    if (!wasGrounded && prevVy < -13) {
      P.landT = 0.2; sfx("land", P.pos, 0.8); fx.ring(P.pos.x, P.pos.z, 0.3, 3 + Math.min(4, -prevVy / 10), 0xdddddd, 0.4, P.pos.y + 0.1, 0.5);
      fx.burst(P.pos.clone().add(new V3(0, 0.3, 0)), 0xbbbbbb, 10, 4, 0.8, 0.5, 2);
      if (prevVy < -30) { shake(0.4); }
    }
    P.vel.y = 0; P.grounded = true; P.jumps = 0; P.airT = 0;
    if (P.flying && P.vel.y <= 0 && (down("KeyC") || !down("Space"))) { if (down("KeyC") || P.pos.y < 0.05) P.flying = false; }
  } else { P.grounded = false; P.airT += dt; }
  if (mv.ceil && P.vel.y > 0) P.vel.y = 0;
  wasGrounded = P.grounded;
  if (P.flying && P.grounded && !down("Space")) P.flying = false;
  if (P.pos.y > 420) { P.pos.y = 420; P.vel.y = Math.min(0, P.vel.y); }

  const spd = Math.hypot(P.vel.x, P.vel.z);
  P.speedFrac = spd / sprSp;

  // animation
  let mode = "idle", kind = 0, p = 0, aspd = 0;
  if (act) {
    switch (act.type) {
      case "atk": mode = "atk"; kind = act.kind; p = act.t / act.dur; break;
      case "cast": mode = "cast"; kind = act.kind; p = act.t / act.dur; break;
      case "charge": mode = "charge"; break;
      case "ult": mode = act.t < 2.3 ? "charge" : "victory"; break;
      case "beam": mode = "cast"; kind = 11; p = act.t < 0.65 ? act.t / 0.65 * 0.4 : 0.55; break;
      case "dodge": mode = "dodge"; p = act.t / act.dur; break;
      case "dash": mode = "fly"; aspd = 1; break;
    }
  } else if (P.stagger > 0 || P.hurtT > 0.15) mode = "hit";
  else if (P.victoryT > 0) mode = "victory";
  else if (P.landT > 0) mode = "land";
  else if (P.flying) { mode = spd > 3 || Math.abs(P.vel.y) > 3 ? "fly" : "hover"; aspd = clamp(Math.hypot(spd, P.vel.y) / 40, 0, 1); }
  else if (!P.grounded) mode = P.vel.y > 0 ? "jump" : "fall";
  else if (spd > 0.6) { mode = spd > runSp * 0.55 ? "run" : "walk"; aspd = clamp(spd / runSp, 0, 1.5); }
  const animSpd = mode === "fly" || mode === "hover" ? aspd : P.flying ? aspd : mode === "idle" ? 0 : aspd;
  R.root.position.copy(P.pos);
  R.root.rotation.y = P.yaw;
  animate(R, { mode, kind, p, spd: animSpd, t: time, sprint, k: mode === "atk" || mode === "cast" || mode === "dodge" ? 26 : 14 }, dt);
  // attach spd for cloth using flight too
  (R as any).cloth = spd;

  // ambient VFX
  const warm = h === "kairo";
  if (warm) {
    const hp1 = hand(), hp2 = handL();
    const strength = act ? 1.5 : 0.5;
    if (Math.random() < 0.5 * strength) fx.em(hp1.x, hp1.y, hp1.z, rnd(-0.5, 0.5), rnd(1, 3), rnd(-0.5, 0.5), Math.random() < 0.5 ? 0xff5a10 : 0xffb030, 0.45, 0.45, -1);
    if (Math.random() < 0.5 * strength) fx.em(hp2.x, hp2.y, hp2.z, rnd(-0.5, 0.5), rnd(1, 3), rnd(-0.5, 0.5), Math.random() < 0.5 ? 0xff5a10 : 0xffb030, 0.45, 0.45, -1);
    if (P.sprint && spd > 8 && P.grounded && Math.random() < 0.6) fx.em(P.pos.x, 0.2, P.pos.z, rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1), 0xff7a1a, 0.6, 0.5, -1);
  } else {
    if (Math.random() < 0.35) { const a = rnd(0, 6.28); fx.smoke(P.pos.x + Math.cos(a) * 0.5, P.pos.y + rnd(0.1, 1.6), P.pos.z + Math.sin(a) * 0.5, 0, rnd(0.8, 1.6), 0, 0x1a0c3a, 0.9, 0.9, 0, 1); }
    if (Math.random() < 0.25) { const hp1 = Math.random() < 0.5 ? hand() : handL(); fx.em(hp1.x, hp1.y, hp1.z, rnd(-0.5, 0.5), rnd(0.5, 2), rnd(-0.5, 0.5), Math.random() < 0.5 ? 0x8a5cff : 0x3fd0ff, 0.35, 0.5); }
  }
  if (P.flying) {
    const sp = Math.hypot(spd, P.vel.y);
    if (sp > 8) for (let i = 0; i < 2; i++) fx.em(P.pos.x + rnd(-0.3, 0.3), P.pos.y + 1 + rnd(-0.4, 0.4), P.pos.z + rnd(-0.3, 0.3), -P.vel.x * 0.1, -P.vel.y * 0.1, -P.vel.z * 0.1, warm ? 0xffa030 : 0x9a6bff, 0.6, 0.5);
    if (Math.random() < 0.2) fx.em(P.pos.x, P.pos.y + 0.1, P.pos.z, rnd(-1, 1), -2, rnd(-1, 1), warm ? 0xff7a1a : 0x8a5cff, 0.5, 0.4);
  }
  if (P.invul > 0 && P.invul < 5 && Math.random() < 0.4 && act?.type !== "dodge") fx.em(P.pos.x + rnd(-0.4, 0.4), P.pos.y + rnd(0, 1.8), P.pos.z + rnd(-0.4, 0.4), 0, 1, 0, 0xffffff, 0.3, 0.3);
}
export { sstep as _s };
