import * as THREE from "three";
import { G, P, V3, rnd, clamp, dampAng, yawTo, fwd } from "./core";
import { buildChar, animate, SHADOW_NAMES, Rig } from "./rig";
import { fx } from "./fx";
import { sfx } from "./audio";
import { moveBody, freeSpot } from "./world";
import { dmgEnemy, shoot, explode, nearestEnemy, chestPos } from "./combat";
import { useGame, toast } from "../store";

let root: THREE.Group;
const STATS: Record<string, { hp: number; dmg: number; cd: number; speed: number; kind: "melee" | "ranged" | "blink" | "aoe" | "air"; range: number; keep?: number }> = {
  warrior: { hp: 170, dmg: 24, cd: 0.85, speed: 9, kind: "melee", range: 2.4 },
  soldier: { hp: 230, dmg: 40, cd: 0.6, speed: 13, kind: "melee", range: 2.6 },
  grunt: { hp: 210, dmg: 22, cd: 0.85, speed: 8.5, kind: "melee", range: 2.4 },
  ember: { hp: 150, dmg: 22, cd: 1.5, speed: 8, kind: "ranged", range: 24, keep: 12 },
  blade: { hp: 170, dmg: 34, cd: 1.0, speed: 10, kind: "blink", range: 2.6 },
  colossus: { hp: 760, dmg: 48, cd: 2.4, speed: 6, kind: "aoe", range: 4 },
  sniper: { hp: 130, dmg: 50, cd: 2.0, speed: 7.5, kind: "ranged", range: 42, keep: 22 },
  raven: { hp: 160, dmg: 30, cd: 1.7, speed: 14, kind: "air", range: 3 },
  knight: { hp: 560, dmg: 40, cd: 0.9, speed: 10, kind: "melee", range: 3.0 },
};
export const stash: string[] = [];

export function initAllies(r: THREE.Group) {
  root = r;
}
export function saveAllies() {
  useGame.getState().setCompanions(G.allies.filter((a: any) => a.perm && !a.dead).map((a: any) => a.type));
}
export function spawnAlly(type: string, pos: V3, o: { temp?: number; perm?: boolean; silent?: boolean } = {}) {
  const st = STATS[type] ?? STATS.warrior;
  const rig: Rig = buildChar("sh_" + type);
  root.add(rig.root);
  const a: any = {
    id: G.nextId++, type, name: SHADOW_NAMES[type], rig, pos: pos.clone(), vel: new V3(), kb: new V3(), yaw: P.yaw, hp: st.hp * G.mods.hp, maxHp: st.hp * G.mods.hp, r: 0.6, h: 1.9 * rig.scale / 0.88,
    dead: false, deadT: 0, st, atkCd: rnd(0.2, 0.8), atk: null, temp: o.temp ?? 0, perm: !!o.perm, tgt: null, flash: 0, slot: Math.random() * 6.28, mode: "idle", spd: 0, fadeIn: 0, tele: 0,
  };
  a.onDeath = () => { a.dead = true; a.deadT = 0; fx.burst(a.pos.clone().add(new V3(0, 1, 0)), 0x8a5cff, 20, 6, 0.5, 0.8, 0); if (a.perm) { toast(`${a.name} has fallen`, "#b99aff"); } };
  rig.root.position.copy(a.pos);
  G.allies.push(a);
  if (!o.silent) {
    fx.ring(pos.x, pos.z, 0.5, 4, 0x8a5cff, 0.6);
    fx.burst(pos.clone().add(new V3(0, 0.5, 0)), 0x8a5cff, 18, 6, 0.5, 0.8, -2, 1);
    fx.smoke(pos.x, pos.y + 0.5, pos.z, 0, 2, 0, 0x120a22, 2, 1, 0, 1);
    sfx("shadow", pos, 0.7);
  }
  if (o.perm) saveAllies();
  return a;
}
export function removeAlly(a: any, fade = true) {
  if (fade) fx.burst(a.pos.clone().add(new V3(0, 1, 0)), 0x8a5cff, 12, 4, 0.4, 0.6, 0);
  root.remove(a.rig.root);
  const i = G.allies.indexOf(a);
  if (i >= 0) G.allies.splice(i, 1);
}
export function stashAllies() {
  stash.length = 0;
  for (const a of [...G.allies]) { if (a.perm && !a.dead) stash.push(a.type); if (!a.beacon) removeAlly(a, true); }
}
export function restoreAllies(types: string[]) {
  for (const t of types) spawnAlly(t, freeSpot(P.pos.x, P.pos.z, 5), { perm: true });
}
export function dismissAll() {
  for (const a of [...G.allies]) if (a.perm) removeAlly(a);
  stash.length = 0;
  saveAllies();
}
export const permCount = () => G.allies.filter((a: any) => a.perm && !a.dead).length;

export function updateSouls(dt: number) {
  for (let i = G.souls.length - 1; i >= 0; i--) {
    const s = G.souls[i];
    s.t += dt;
    if (s.t > s.life) { G.souls.splice(i, 1); continue; }
    const a = s.t * 3;
    fx.em(s.pos.x + Math.cos(a) * 0.5, s.pos.y + Math.sin(s.t * 2) * 0.3 + (s.t % 1), s.pos.z + Math.sin(a) * 0.5, 0, 0.6, 0, 0xa070ff, 0.55, 0.7);
    if (Math.random() < 0.3) fx.em(s.pos.x, s.pos.y + 0.2, s.pos.z, rnd(-0.3, 0.3), 1.2, rnd(-0.3, 0.3), 0xe6d8ff, 0.35, 0.8);
  }
}

export function updateAllies(dt: number, time: number) {
  const alive = G.enemies.some((e: any) => !e.dead && e.aggro);
  for (let i = G.allies.length - 1; i >= 0; i--) {
    const a = G.allies[i];
    if (a.beacon) continue;
    const rig: Rig = a.rig;
    if (a.dead) {
      a.deadT += dt;
      rig.root.scale.setScalar(rig.scale * Math.max(0.01, 1 - a.deadT * 2));
      if (a.deadT > 0.5) { removeAlly(a, false); if (a.perm) saveAllies(); }
      continue;
    }
    a.fadeIn = Math.min(1, a.fadeIn + dt * 3);
    if (a.temp > 0) { a.temp -= dt; if (a.temp <= 0) { removeAlly(a); continue; } }
    a.flash = Math.max(0, a.flash - dt);
    rig.flash(a.flash > 0 ? 0.8 : 0);
    const st = a.st;
    a.atkCd -= dt;
    // target
    let tgt = a.tgt;
    if (!tgt || tgt.dead || tgt.hidden || tgt.pos.distanceTo(P.pos) > 60) tgt = null;
    if (!tgt || Math.random() < 0.02) {
      const lock = P.lock && !P.lock.dead && P.lock.pos.distanceTo(a.pos) < 40 ? P.lock : null;
      tgt = lock && Math.random() < 0.5 ? lock : nearestEnemy(a.pos, 24) ?? nearestEnemy(P.pos, 26);
    }
    a.tgt = tgt;
    const flying = st.kind === "air";
    let mx = 0, mz = 0, speed = 0;
    const dp = Math.hypot(P.pos.x - a.pos.x, P.pos.z - a.pos.z);
    if (dp > 55) {
      const sp = freeSpot(P.pos.x - Math.sin(P.yaw) * 4, P.pos.z - Math.cos(P.yaw) * 4, 4);
      fx.burst(a.pos.clone().add(new V3(0, 1, 0)), 0x8a5cff, 10, 4, 0.4, 0.5, 0);
      a.pos.set(sp.x, P.pos.y, sp.z);
    }
    let faceYaw = a.yaw;
    if (a.atk) {
      a.atk.t += dt;
      if (!a.atk.done && a.atk.t >= a.atk.hit) {
        a.atk.done = true;
        a.atk.fn();
      }
      if (a.atk.t >= a.atk.dur) a.atk = null;
      else if (a.atk.dash) { mx = a.atk.dash.x; mz = a.atk.dash.z; speed = a.atk.dash.len; }
      if (tgt && a.atk) faceYaw = yawTo(a.pos, tgt.pos);
    } else if (tgt) {
      const dx = tgt.pos.x - a.pos.x, dz = tgt.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
      faceYaw = Math.atan2(dx, dz);
      const reach = st.range + tgt.r;
      if (st.kind === "ranged") {
        const keep = st.keep ?? 12;
        if (d > st.range * 0.9) { mx = dx / d; mz = dz / d; speed = st.speed; }
        else if (d < keep) { mx = -dx / d; mz = -dz / d; speed = st.speed * 0.8; }
        else { mx = -dz / d; mz = dx / d; speed = st.speed * 0.3; }
        if (a.atkCd <= 0 && d < st.range) {
          a.atkCd = st.cd * rnd(0.9, 1.2);
          const kind = a.type === "sniper" ? "bolt" : "ember";
          a.atk = { t: 0, hit: 0.25, dur: 0.5, kind: 10, fn: () => { const o = a.pos.clone().add(new V3(0, 1.4, 0)); const dir = chestPos(tgt).sub(o).normalize(); shoot({ kind, team: "p", pos: o.addScaledVector(dir, 0.8), dir, speed: a.type === "sniper" ? 55 : 26, dmg: st.dmg * G.mods.dmg, radius: a.type === "sniper" ? 0 : 2.5, hitR: 0.6, knock: 4 }); sfx("shot", a.pos, 0.6); } };
        }
      } else if (st.kind === "blink") {
        if (d > reach) { mx = dx / d; mz = dz / d; speed = st.speed; }
        if (a.atkCd <= 0 && d < 16) {
          a.atkCd = st.cd * rnd(0.9, 1.3);
          fx.burst(a.pos.clone().add(new V3(0, 1, 0)), 0x8a5cff, 10, 4, 0.4, 0.4, 0);
          const f = fwd(tgt.yaw ?? 0);
          const np = tgt.pos.clone().addScaledVector(f, -(tgt.r + 1.6));
          a.pos.x = np.x; a.pos.z = np.z; a.pos.y = tgt.pos.y;
          fx.burst(a.pos.clone().add(new V3(0, 1, 0)), 0xc9a0ff, 10, 4, 0.4, 0.4, 0);
          sfx("teleport", a.pos, 0.5);
          a.atk = { t: 0, hit: 0.18, dur: 0.45, kind: 0, fn: () => { dmgEnemy(tgt, st.dmg, { kb: fwd(yawTo(a.pos, tgt.pos)).multiplyScalar(5), stagger: 0.4, src: "ally" }); fx.sparks(chestPos(tgt), 0xc9a0ff, 8); sfx("hit", a.pos, 0.6); } };
        }
      } else if (st.kind === "air") {
        if (d > 6) { mx = dx / d; mz = dz / d; speed = st.speed; }
        if (a.atkCd <= 0 && d < 24) {
          a.atkCd = st.cd * rnd(0.9, 1.3);
          const dir = new V3(dx / d, 0, dz / d);
          a.atk = { t: 0, hit: 0.35, dur: 0.6, kind: 6, dash: { x: dir.x, z: dir.z, len: 26 }, fn: () => { if (!tgt.dead && tgt.pos.distanceTo(a.pos) < 4.5) { dmgEnemy(tgt, st.dmg, { kb: dir.clone().multiplyScalar(6), stagger: 0.4, src: "ally" }); fx.sparks(chestPos(tgt), 0xc9a0ff, 8); } } };
        }
      } else {
        if (d > reach * 0.85) { mx = dx / d; mz = dz / d; speed = st.speed; }
        if (a.atkCd <= 0 && d < reach + 0.6) {
          a.atkCd = st.cd * rnd(0.9, 1.2);
          const aoe = st.kind === "aoe";
          a.atk = {
            t: 0, hit: aoe ? 0.55 : 0.22, dur: aoe ? 1.0 : 0.5, kind: aoe ? 3 : Math.floor(rnd(0, 3)),
            fn: () => {
              if (aoe) explode(a.pos.clone().addScaledVector(fwd(a.yaw), 2.5), 5.5, st.dmg, { team: "p", color: 0x6a3cff, color2: 0xc9a0ff, dark: true, knock: 12, stagger: 0.8, shake: 0.4 });
              else if (!tgt.dead && Math.hypot(tgt.pos.x - a.pos.x, tgt.pos.z - a.pos.z) < reach + tgt.r + 0.6) { dmgEnemy(tgt, st.dmg, { kb: fwd(yawTo(a.pos, tgt.pos)).multiplyScalar(5), stagger: 0.35, src: "ally" }); fx.sparks(chestPos(tgt), 0xc9a0ff, 8); sfx("hit", a.pos, 0.6); fx.mesh("slash", a.pos.x, a.pos.y + 1.2, a.pos.z, 0xb070ff, { life: 0.2, s0: [1.6, 1, 1.6], s1: [2.2, 1, 2.2], o0: 0.8, ry: a.yaw }); }
            },
          };
        }
      }
    } else {
      // follow
      const idx = G.allies.filter((x: any) => !x.beacon).indexOf(a);
      const ang = P.yaw + Math.PI + (idx - 1.5) * 0.9;
      const fx_ = P.pos.x + Math.sin(ang) * (3.5 + (idx % 2) * 1.5), fz = P.pos.z + Math.cos(ang) * (3.5 + (idx % 2) * 1.5);
      const dx = fx_ - a.pos.x, dz = fz - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.2) { mx = dx / d; mz = dz / d; speed = Math.min(st.speed * (d > 8 ? 1.4 : 0.8), d * 3); faceYaw = Math.atan2(dx, dz); }
      else faceYaw = P.yaw;
    }
    a.yaw = dampAng(a.yaw, faceYaw, 10, dt);
    a.vel.x = mx * speed + a.kb.x; a.vel.z = mz * speed + a.kb.z;
    a.kb.multiplyScalar(Math.max(0, 1 - 6 * dt));
    if (flying) {
      const ty = (tgt ? tgt.pos.y + 3 : P.pos.y + 4) + Math.sin(time * 2 + a.slot) * 0.6;
      a.vel.y = (ty - a.pos.y) * 3;
    } else a.vel.y -= 34 * dt;
    moveBody(a.pos, a.r, a.h, a.vel.x * dt, a.vel.y * dt, a.vel.z * dt);
    if (!flying && a.pos.y <= 0.001) a.vel.y = 0;
    a.spd = damp_(a.spd, Math.hypot(a.vel.x, a.vel.z), 8, dt);
    a.mode = a.atk ? (a.atk.kind >= 10 ? "cast" : "atk") : flying ? "float" : a.spd > 1 ? "run" : "idle";
    rig.root.position.copy(a.pos);
    rig.root.rotation.y = a.yaw;
    if (a.fadeIn < 1) rig.root.scale.setScalar(rig.scale * (0.3 + 0.7 * a.fadeIn));
    animate(rig, { mode: a.mode, spd: clamp(a.spd / 10, 0, 1.2), kind: a.atk?.kind ?? 0, p: a.atk ? a.atk.t / a.atk.dur : 0, t: time }, dt);
    if (Math.random() < 0.3) fx.smoke(a.pos.x + rnd(-0.3, 0.3), a.pos.y + rnd(0.2, 1.8), a.pos.z + rnd(-0.3, 0.3), 0, 0.8, 0, 0x2a1250, 0.7, 0.8, 0, 1);
  }
  void alive;
}
const damp_ = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
