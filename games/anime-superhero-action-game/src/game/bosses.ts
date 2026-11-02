import * as THREE from "three";
import { G, P, V3, rnd, clamp, lerp, yawTo, fwd, later, pick } from "./core";
import { fx } from "./fx";
import { shake } from "./fx";
import { sfx, voice, setMusicLevel } from "./audio";
import { ATK, AI, TYPES, createEnemy, startAtk, teleRing, teleLine, clearTele, melee, walkTo, walkDir, removeEnemy } from "./enemies";
import { explode, shockwave, dmgPlayer, hurt, clearProjectiles, shoot, chestPos, killEnemy } from "./combat";
import { segBlocked, freeSpot, ARENA } from "./world";
import { banner, toast } from "../store";

TYPES.titan = { name: "Titan, the Destroyer", hp: 5200, speed: 5.4, r: 2.1, h: 6.4, armor: 0.08, kbRes: 1, staggerRes: true, noSoul: true };
TYPES.reaper = { name: "Void Reaper", hp: 3900, speed: 9.5, r: 0.9, h: 3.2, armor: 0.05, kbRes: 0.9, staggerRes: true, noSoul: true };
TYPES.zero = { name: "Emperor Zero", hp: 7400, speed: 8.5, r: 1.1, h: 3.5, armor: 0.08, kbRes: 1, staggerRes: true, noSoul: true };

export const BOSS_INFO: Record<string, { name: string; title: string; color: string; intro: string }> = {
  titan: { name: "TITAN", title: "THE DESTROYER", color: "#ff6a1a", intro: "I will crush this city!" },
  reaper: { name: "VOID REAPER", title: "HARVESTER OF SHADOWS", color: "#b040ff", intro: "Your shadow will be mine." },
  zero: { name: "EMPEROR ZERO", title: "THE END OF ALL THINGS", color: "#ffd23f", intro: "Kneel before the Emperor." },
};

const once = (e: any, k: string, c: boolean, fn: () => void) => {
  if (c && !e.a[k]) { e.a[k] = true; fn(); }
};
const reset = (e: any) => { e.a = {}; };
function meteor(x: number, z: number, delay: number, r: number, dmg: number, col = 0xff5a20) {
  fx.mesh("disc", x, 0.13, z, col, { life: delay, s0: [r * 0.1, 1, r * 0.1], s1: [r, 1, r], o0: 0.2, o1: 0.5 });
  fx.mesh("ring", x, 0.15, z, col, { life: delay, s0: [r, 1, r], s1: [r, 1, r], o0: 0.9, o1: 0.9 });
  later(Math.max(0.01, delay - 0.45), () => {
    const m = fx.mesh("sphere", x + 12, 55, z + 7, col, { life: Infinity, s0: [r * 0.3, r * 0.3, r * 0.3], o0: 0.9, o1: 0.9 });
    let t = 0;
    G.updaters.push((dt: number) => {
      t += dt;
      const k = Math.min(1, t / 0.45);
      m.mesh.position.set(lerp(x + 12, x, k), lerp(55, 1, k), lerp(z + 7, z, k));
      fx.em(m.mesh.position.x, m.mesh.position.y, m.mesh.position.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), col, r * 0.4, 0.4);
      if (k >= 1) { fx.kill(m); explode(new V3(x, 0.3, z), r, dmg, { team: "e", color: col, knock: 10, shake: 0.5 }); return true; }
      return false;
    });
  });
}
const tgtPos = (e: any) => (e.tgt ?? P).pos as V3;
const beamMesh = (color: number, w: number, len: number) => fx.mesh("beam", 0, 0, 0, color, { life: Infinity, s0: [w, len, w], o0: 0.75, o1: 0.75 });
function setBeam(m: any, o: V3, dir: V3, len: number, w: number) {
  m.mesh.position.copy(o);
  m.mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
  m.mesh.scale.set(w, len, w);
}
function beamDamage(e: any, o: V3, dir: V3, len: number, w: number, dmg: number, key: string, t: number) {
  if (t - (e.a[key] ?? -1) < 0.2) return;
  e.a[key] = t;
  const end = o.clone().addScaledVector(dir, len);
  const p = new V3(P.pos.x, o.y, P.pos.z);
  const ab = end.clone().sub(o), ap = p.clone().sub(o);
  const k = clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
  const d = o.clone().addScaledVector(ab, k).distanceTo(p);
  if (d < w + 0.7 && P.pos.y < o.y + 1.8 && P.pos.y > o.y - 3.6) dmgPlayer(dmg * e.dm, o, { kb: 5, stagger: 0.12 });
}
function cancelAtk(e: any) {
  if (e.atk) { e.atk.def.end?.(e); e.atk = null; }
  clearTele(e);
}

/* ===================== TITAN ===================== */
ATK.t_smash = {
  wind: 1.0, dur: 2.0, cd: 2.5, kind: 3, armor: true,
  begin: (e) => { reset(e); const f = fwd(yawTo(e.pos, tgtPos(e))); e.a.pos = e.pos.clone().addScaledVector(f, 7); teleRing(e, e.a.pos.x, e.a.pos.z, 7, 1.0); sfx("warn", e.pos); },
  on: (e) => { explode(e.a.pos.setY(0.3), 7, 66 * e.dm, { team: "e", color: 0xc08050, color2: 0xffd090, knock: 16, shake: 0.9 }); shockwave(e.a.pos.x, e.a.pos.z, { max: 12, dmg: 22 * e.dm, speed: 18, breaks: true }); },
};
ATK.t_shock = {
  wind: 1.3, dur: 2.6, cd: 8, kind: 3, armor: true,
  begin: (e) => { reset(e); teleRing(e, e.pos.x, e.pos.z, 9, 1.3, 0xff6a20); sfx("roar", e.pos); },
  on: (e) => {
    shockwave(e.pos.x, e.pos.z, { max: 34, dmg: 55 * e.dm, speed: 20, color: 0xffa040, breaks: true });
    explode(e.pos.clone(), 7, 40 * e.dm, { team: "e", knock: 14, shake: 1 });
    if (e.stage >= 3) later(0.75, () => !e.dead && shockwave(e.pos.x, e.pos.z, { max: 34, dmg: 55 * e.dm, speed: 20, color: 0xff6020, breaks: true }));
  },
};
ATK.t_charge = {
  wind: 1.1, dur: 2.8, cd: 9, kind: 6, armor: true,
  begin: (e) => {
    reset(e);
    const d = new V3(tgtPos(e).x - e.pos.x, 0, tgtPos(e).z - e.pos.z).normalize();
    e.a.dir = d; e.a.pillars = G.props.filter((p: any) => !p.dead && p.type === "pillar").length;
    teleLine(e, e.pos, e.pos.clone().addScaledVector(d, 40), 5, 1.1, 0xff4020);
    sfx("roar", e.pos);
  },
  on: (e) => { e.dash = { x: e.a.dir.x, z: e.a.dir.z, s: 28, until: G.time + 1.4 }; e.yaw = e.faceYaw = Math.atan2(e.a.dir.x, e.a.dir.z); },
  upd: (e, _dt, t) => {
    if (t > 1.1 && t < 2.6) {
      shake(0.25);
      if (Math.random() < 0.7) fx.em(e.pos.x + rnd(-2, 2), 0.3, e.pos.z + rnd(-2, 2), rnd(-3, 3), rnd(2, 6), rnd(-3, 3), 0xcfc0a0, 2.2, 0.7, 4);
      G.hooks.damageAt?.(e.pos.clone().addScaledVector(e.a.dir, 3), 4, 500, "e");
      if (!e.a.hit && Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) < e.r + 1.4 && P.pos.y < 4) { e.a.hit = true; dmgPlayer(72 * e.dm, e.pos, { kb: 22, stagger: 0.8 }); fx.explosion(chestPos(P as any), 3); }
      const now = G.props.filter((p: any) => !p.dead && p.type === "pillar").length;
      if (now < e.a.pillars && !e.a.crash) {
        e.a.crash = true; e.dash = null; e.stagger = 2.2; e.vulnT = 3.2; e.vuln = 1.7; cancelAtk(e);
        shockwave(e.pos.x, e.pos.z, { max: 14, dmg: 20 * e.dm, speed: 16, breaks: true });
        toast("TITAN STUNNED — attack now!", "#ffd23f");
        fx.explosion(e.pos.clone().add(new V3(0, 3, 0)), 7);
      }
    }
  },
};
ATK.t_meteor = {
  wind: 1.2, dur: 4.2, cd: 14, kind: 12,
  begin: (e) => { reset(e); sfx("roar", e.pos); },
  on: (e) => {
    const n = e.stage >= 3 ? 11 : 7;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.28), r = i === 0 ? 0 : rnd(3, 15);
      meteor(P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r, 1.3 + i * 0.28, 5.2, 44 * e.dm);
    }
    sfx("warn", P.pos);
  },
};
ATK.t_leap = {
  wind: 0.9, dur: 2.6, cd: 11, kind: 6, armor: true,
  begin: (e) => { reset(e); e.a.from = e.pos.clone(); e.a.to = tgtPos(e).clone(); teleRing(e, e.a.to.x, e.a.to.z, 9, 1.6, 0xff4020); sfx("warn", e.pos); },
  upd: (e, _dt, t) => {
    if (t > 0.9 && t < 1.8) {
      const k = (t - 0.9) / 0.9;
      e.pos.x = lerp(e.a.from.x, e.a.to.x, k); e.pos.z = lerp(e.a.from.z, e.a.to.z, k); e.pos.y = Math.sin(k * Math.PI) * 16;
      e.vel.y = 0;
    }
    once(e, "land", t >= 1.8, () => { e.pos.y = 0; explode(e.pos.clone(), 10, 72 * e.dm, { team: "e", color: 0xc08050, color2: 0xffd090, knock: 18, shake: 1.2 }); shockwave(e.pos.x, e.pos.z, { max: 24, dmg: 30 * e.dm, speed: 18, breaks: true }); });
  },
  on: () => {},
};
ATK.t_quake = {
  wind: 2.6, dur: 5.2, cd: 30, kind: 14, armor: true,
  begin: (e) => { reset(e); teleRing(e, e.pos.x, e.pos.z, 12, 2.6, 0xff3010); sfx("longcharge" as any, e.pos); sfx("charge", e.pos); toast("ANNIHILATION QUAKE — jump or fly over the shockwaves!", "#ff9a40"); },
  upd: (e, _dt, t) => {
    if (t < 2.6) { shake(0.08 + t * 0.08); fx.em(e.pos.x + rnd(-6, 6), 0.3, e.pos.z + rnd(-6, 6), 0, rnd(4, 12), 0, 0xff6a20, 1.5, 0.8, -2); }
    for (let i = 0; i < 3; i++) once(e, "w" + i, t >= 2.6 + i * 0.85, () => { shockwave(e.pos.x, e.pos.z, { max: 48, dmg: 72 * e.dm, speed: 20, color: [0xffd23f, 0xff7a1a, 0xff3010][i], breaks: true, w: 2.8 }); shake(1); explode(e.pos.clone(), 6, 20, { team: "e", vfx: true }); });
  },
  on: () => {},
};
ATK.t_rage = {
  wind: 1.6, dur: 2.6, cd: 0, kind: 14,
  begin: (e) => { reset(e); e.invuln = 3; clearProjectiles("e"); sfx("roar", e.pos); voice("Graaaaah!", 0.3, 0.7); },
  on: (e) => {
    shockwave(e.pos.x, e.pos.z, { max: 24, dmg: 26 * e.dm, speed: 20, color: 0xff3010, breaks: true });
    explode(e.pos.clone(), 8, 30 * e.dm, { team: "e", color: 0xff3010, shake: 1.4 });
    e.rig.setColor((m: any) => { m.userData.e.set(0xff3300); m.userData.ei = 0.55; });
    e.speed *= 1.2; e.cdScale = (e.cdScale ?? 1) * 0.78;
  },
};
AI.titan = (e, _dt, c) => {
  const cd = (k: string) => (e.cd[k] ?? 0) <= 0;
  const set = (k: string, v: number) => (e.cd[k] = v * (e.cdScale ?? 1));
  walkTo(e, c.tp.x, c.tp.z, e.speed, 4.5);
  if (e.recover > 0) return;
  const go = (n: string) => { startAtk(e, n); set(n, ATK[n].cd); };
  if (e.stage >= 3 && cd("t_quake") && c.d < 30) return go("t_quake");
  if (e.stage >= 2 && cd("t_meteor")) return go("t_meteor");
  if (e.stage >= 2 && cd("t_leap") && c.d > 10) return go("t_leap");
  if (cd("t_charge") && c.d > 11 && G.props.some((p: any) => p.type === "pillar" && !p.dead) ) return go("t_charge");
  if (cd("t_shock") && c.d < 16) return go("t_shock");
  if (c.d < 10 && cd("t_smash")) return go("t_smash");
  if (c.d > 14 && cd("t_charge")) return go("t_charge");
};

/* ===================== VOID REAPER ===================== */
const REAP_CLONES = () => G.enemies.filter((x: any) => x.type === "clone" && !x.dead).length;
ATK.r_teleslash = {
  wind: 1.3, dur: 2.2, cd: 4, kind: 0,
  begin: (e) => { reset(e); e.hidden = true; e.rig.root.visible = false; fx.smoke(e.pos.x, e.pos.y + 1.5, e.pos.z, 0, 1, 0, 0x120a22, 3, 1, 0, 1); fx.burst(e.pos.clone().add(new V3(0, 1.5, 0)), 0xb040ff, 18, 7, 0.5, 0.5, 0); sfx("teleport", e.pos); },
  upd: (e, _dt, t) => {
    once(e, "app", t > 0.7, () => {
      const a = P.yaw + Math.PI + rnd(-0.4, 0.4);
      const p = freeSpot(P.pos.x + Math.sin(a) * 3.5, P.pos.z + Math.cos(a) * 3.5, 0.5);
      e.pos.set(p.x, 0, p.z); e.yaw = e.faceYaw = yawTo(e.pos, P.pos);
      e.hidden = false; e.rig.root.visible = true;
      fx.burst(e.pos.clone().add(new V3(0, 1.5, 0)), 0xff3a7a, 20, 8, 0.6, 0.5, 0);
      fx.ring(e.pos.x, e.pos.z, 0.5, 4, 0xb040ff, 0.4); sfx("teleport", e.pos);
      teleRing(e, e.pos.x, e.pos.z, 5, 0.6, 0xb040ff);
    });
    once(e, "s2", t > 1.65, () => { e.yaw = e.faceYaw = yawTo(e.pos, P.pos); melee(e, 5, 32, { kb: 10, stagger: 0.3, arc: -1 }); fx.mesh("slash", e.pos.x, e.pos.y + 1.6, e.pos.z, 0xff50a0, { life: 0.3, s0: [3, 1, 3], s1: [5, 1, 5], o0: 0.9, ry: e.yaw - 1.4 }); });
  },
  on: (e) => { e.yaw = e.faceYaw = yawTo(e.pos, P.pos); melee(e, 5, 40, { kb: 12, stagger: 0.4, arc: -1 }); fx.mesh("slash", e.pos.x, e.pos.y + 1.6, e.pos.z, 0xb040ff, { life: 0.3, s0: [3, 1, 3], s1: [5.5, 1, 5.5], o0: 0.9, ry: e.yaw - 1.4 }); const f = fwd(e.yaw); shoot({ kind: "wave", team: "e", pos: e.pos.clone().add(new V3(0, 1.4, 0)).addScaledVector(f, 2), dir: f, speed: 24, dmg: 22 * e.dm, hitR: 1.5, life: 1.5, pierce: true, wave: true, scale: 1.6 }); },
  end: (e) => { e.hidden = false; e.rig.root.visible = true; },
};
ATK.r_fan = {
  wind: 0.9, dur: 1.7, cd: 5, kind: 14,
  begin: (e) => { reset(e); sfx("charge", e.pos, 0.6); },
  on: (e) => {
    const n = e.stage >= 3 ? 11 : e.stage === 2 ? 8 : 5;
    const base = Math.atan2(tgtPos(e).x - e.pos.x, tgtPos(e).z - e.pos.z);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.22;
      const dir = new V3(Math.sin(a), 0, Math.cos(a));
      shoot({ kind: "void", team: "e", pos: e.pos.clone().add(new V3(0, 1.8, 0)).addScaledVector(dir, 1.5), dir, speed: 22, dmg: 17 * e.dm, hitR: 0.6, life: 3.5, scale: 0.9, radius: 0 });
    }
    sfx("laser", e.pos);
  },
};
ATK.r_clones = {
  wind: 1.1, dur: 2.2, cd: 15, kind: 12,
  begin: (e) => { reset(e); fx.ring(e.pos.x, e.pos.z, 1, 8, 0xb040ff, 1); sfx("summon", e.pos); },
  on: (e) => {
    const n = 3 - REAP_CLONES();
    for (let i = 0; i < n; i++) {
      const a = (i / 3) * 6.28 + rnd(0, 1);
      const p = freeSpot(P.pos.x + Math.sin(a) * 9, P.pos.z + Math.cos(a) * 9, 1);
      const c = createEnemy("clone", p.x, p.z, { aggro: true, minion: true });
      c.life = 8; c.noSoul = true; c.dm = e.dm;
      fx.burst(c.pos.clone().add(new V3(0, 1.5, 0)), 0xb040ff, 16, 6, 0.5, 0.5, 0);
    }
  },
};
ATK.r_bladedash = {
  wind: 0.7, dur: 3.6, cd: 8, kind: 6,
  begin: (e) => { reset(e); },
  upd: (e, _dt, t) => {
    for (let i = 0; i < 3; i++) {
      const T0 = 0.7 + i * 1.0;
      once(e, "tl" + i, t > T0 - 0.55, () => { const d = new V3(P.pos.x - e.pos.x, 0, P.pos.z - e.pos.z).normalize(); e.a["d" + i] = d; e.faceYaw = Math.atan2(d.x, d.z); teleLine(e, e.pos, e.pos.clone().addScaledVector(d, 18), 2.2, 0.55, 0xb040ff); sfx("warn", e.pos, 0.5); });
      once(e, "ds" + i, t > T0, () => { const d = e.a["d" + i]; e.dash = { x: d.x, z: d.z, s: 38, until: G.time + 0.28 }; e.yaw = e.faceYaw = Math.atan2(d.x, d.z); e.a["h" + i] = false; sfx("dash", e.pos); });
      if (t > T0 && t < T0 + 0.32) {
        fx.em(e.pos.x, e.pos.y + 1.5, e.pos.z, 0, 0, 0, 0xb040ff, 1.6, 0.4);
        if (!e.a["h" + i] && Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) < e.r + 1.6 && P.pos.y < 4) { e.a["h" + i] = true; dmgPlayer(36 * e.dm, e.pos, { kb: 10, stagger: 0.35 }); fx.mesh("slash", P.pos.x, P.pos.y + 1, P.pos.z, 0xff50a0, { life: 0.25, s0: [2, 1, 2], s1: [4, 1, 4], o0: 0.9, ry: e.yaw }); }
      }
    }
  },
  on: () => {},
};
ATK.r_scythe = {
  wind: 1.0, dur: 4.6, cd: 12, kind: 14,
  begin: (e) => { reset(e); e.a.a0 = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z); e.a.b1 = beamMesh(0xb040ff, 1, 1); e.a.b2 = e.stage >= 3 ? beamMesh(0xff3a7a, 1, 1) : null; e.a.b1.mesh.visible = false; if (e.a.b2) e.a.b2.mesh.visible = false; teleRing(e, e.pos.x, e.pos.z, 30, 1.0, 0xb040ff); sfx("charge", e.pos); },
  upd: (e, _dt, t) => {
    e.noFace = t > 0.9;
    if (t < 1.0) return;
    const a = e.a.a0 + (t - 1.0) * 2.0;
    for (const [m, off] of [[e.a.b1, 0], [e.a.b2, Math.PI]] as any) {
      if (!m) continue;
      m.mesh.visible = true;
      const dir = new V3(Math.sin(a + off), 0, Math.cos(a + off));
      const o = e.pos.clone().setY(1.3);
      setBeam(m, o, dir, 30, 1.0 + Math.sin(t * 30) * 0.15);
      beamDamage(e, o, dir, 30, 1.0, 24, "bd" + off, t);
    }
    e.yaw = a; e.faceYaw = a;
    shake(0.1);
    if (t > 4.2) { fx.kill(e.a.b1); fx.kill(e.a.b2); }
  },
  on: () => {},
  end: (e) => { fx.kill(e.a.b1); fx.kill(e.a.b2); e.noFace = false; },
};
ATK.r_eclipse = {
  wind: 2.4, dur: 6.0, cd: 26, kind: 14, armor: true,
  begin: (e) => { reset(e); G.darkT = 7; sfx("longcharge" as any, e.pos); sfx("charge", e.pos); toast("ABYSSAL ECLIPSE — dodge the orbs and the dimensional cuts!", "#d070ff"); e.a.dome = fx.mesh("dome", e.pos.x, 0, e.pos.z, 0x0a0420, { life: Infinity, s0: [3, 3, 3], o0: 0.55, o1: 0.55, back: true, dark: true }); },
  upd: (e, _dt, t) => {
    const k = clamp(t / 1.5, 0, 1);
    e.a.dome.mesh.scale.setScalar(6 + k * 55);
    e.a.dome.mesh.position.set(e.pos.x, 0, e.pos.z);
    once(e, "orbs", t > 2.4, () => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.28, r = 11;
        const pos = new V3(P.pos.x + Math.cos(a) * r, 1.6 + rnd(0, 2), P.pos.z + Math.sin(a) * r);
        const dir = new V3(P.pos.x - pos.x, 0.9 - pos.y, P.pos.z - pos.z).normalize();
        later(i * 0.12, () => !e.dead && shoot({ kind: "void", team: "e", pos, dir, speed: 15, dmg: 30 * e.dm, radius: 2.8, life: 6, scale: 1.1, homing: { tgt: { pos: P.pos, dead: false, h: 1.8, hidden: false }, turn: 1.8 }, hitR: 0.9 }));
      }
      sfx("summon", P.pos);
    });
    for (let i = 0; i < 4; i++) once(e, "cut" + i, t > 3.2 + i * 0.5, () => {
      const a = rnd(0, 3.14), ctr = P.pos.clone().add(new V3(rnd(-5, 5), 0, rnd(-5, 5)));
      const d = new V3(Math.sin(a), 0, Math.cos(a));
      const s = ctr.clone().addScaledVector(d, -30), en = ctr.clone().addScaledVector(d, 30);
      const m = teleLine(e, s, en, 4.2, 1.2, 0xff3a7a);
      void m;
      later(1.2, () => {
        if (e.dead) return;
        fx.mesh("beam", s.x, 1.5, s.z, 0xffffff, { life: 0.35, s0: [1.2, 60, 0.5], s1: [0.2, 60, 0.1], o0: 1, dir: d.clone() });
        sfx("laser", ctr);
        shake(0.5);
        const ab = en.clone().sub(s), ap = new V3(P.pos.x - s.x, 0, P.pos.z - s.z), kk = clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
        if (s.clone().addScaledVector(ab, kk).setY(0).distanceTo(new V3(P.pos.x, 0, P.pos.z)) < 2.4 && P.pos.y < 5) dmgPlayer(58 * e.dm, ctr, { kb: 12, stagger: 0.5 });
      });
    });
  },
  on: () => {},
  end: (e) => { fx.kill(e.a.dome); },
};
ATK.r_phase = {
  wind: 1.3, dur: 2.2, cd: 0, kind: 14,
  begin: (e) => { reset(e); e.invuln = 2.4; clearProjectiles("e"); sfx("roar", e.pos); voice(e.stage === 2 ? "Shadows, awaken." : "Darkness, consume them all!", 0.4, 0.7); fx.burst(e.pos.clone().add(new V3(0, 1.5, 0)), 0xb040ff, 40, 12, 0.7, 0.7, 0); },
  on: (e) => { shockwave(e.pos.x, e.pos.z, { max: 24, dmg: 20 * e.dm, speed: 20, color: 0xb040ff }); e.speed *= 1.15; e.cdScale = (e.cdScale ?? 1) * 0.78; e.rig.setColor((m: any) => { m.userData.e.set(e.stage === 2 ? 0x6a1aa0 : 0xa0107a); m.userData.ei = 0.6; }); },
};
AI.reaper = (e, dt, c) => {
  const cd = (k: string) => (e.cd[k] ?? 0) <= 0;
  const set = (k: string, v: number) => (e.cd[k] = v * (e.cdScale ?? 1));
  e.slot += dt * 0.4;
  if (c.d > 14) walkTo(e, c.tp.x, c.tp.z, e.speed, 2); else if (c.d < 6) walkDir(e, -c.dx, -c.dz, e.speed * 0.6); else walkDir(e, -c.dz, c.dx, e.speed * 0.5);
  if (e.recover > 0) return;
  const go = (n: string) => { startAtk(e, n); set(n, ATK[n].cd); };
  if (e.stage >= 3 && cd("r_eclipse")) return go("r_eclipse");
  if (e.stage >= 2 && cd("r_scythe") && c.d < 26) return go("r_scythe");
  if (cd("r_clones") && REAP_CLONES() === 0) return go("r_clones");
  if (cd("r_bladedash")) return go("r_bladedash");
  if (cd("r_fan") && c.d > 6) return go("r_fan");
  if (cd("r_teleslash")) return go("r_teleslash");
};

/* ===================== EMPEROR ZERO ===================== */
ATK.z_orbs = {
  wind: 0.8, dur: 2.4, cd: 4, kind: 11,
  begin: (e) => { reset(e); sfx("charge", e.pos, 0.6); },
  upd: (e, _dt, t) => {
    for (let i = 0; i < 3; i++) once(e, "v" + i, t > 0.8 + i * 0.4, () => {
      const n = e.stage >= 2 ? 7 : 5, base = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * 0.2, dir = new V3(Math.sin(a), 0, Math.cos(a));
        shoot({ kind: "orb", team: "e", pos: e.pos.clone().add(new V3(0, 2.2, 0)).addScaledVector(dir, 1.5), dir, speed: 25, dmg: 19 * e.dm, hitR: 0.65, life: 3.2, scale: 1 });
      }
      sfx("laser", e.pos, 0.8);
    });
  },
  on: () => {},
};
ATK.z_combo = {
  wind: 0.5, dur: 2.2, cd: 5, kind: 0, armor: true,
  begin: (e) => { reset(e); const d = new V3(P.pos.x - e.pos.x, 0, P.pos.z - e.pos.z).normalize(); e.dash = { x: d.x, z: d.z, s: 36, until: G.time + 0.25 }; e.noFace = true; sfx("dash", e.pos); },
  upd: (e, _dt, t) => {
    if (t > 0.3 && t < 1.8) e.noFace = false;
    once(e, "h1", t > 0.75, () => { melee(e, 4.2, 24, { kb: 6, stagger: 0.2 }); fx.mesh("slash", e.pos.x, e.pos.y + 1.8, e.pos.z, 0xffd23f, { life: 0.25, s0: [3, 1, 3], s1: [5, 1, 5], o0: 0.9, ry: e.yaw - 1.4 }); });
    once(e, "h2", t > 1.2, () => { e.yaw = e.faceYaw = yawTo(e.pos, P.pos); melee(e, 4.2, 24, { kb: 6, stagger: 0.2 }); fx.mesh("slash", e.pos.x, e.pos.y + 1.8, e.pos.z, 0xffffff, { life: 0.25, s0: [3, 1, 3], s1: [5, 1, 5], o0: 0.9, ry: e.yaw - 1.4 }); });
    once(e, "h3", t > 1.7, () => { e.yaw = e.faceYaw = yawTo(e.pos, P.pos); melee(e, 4.8, 38, { kb: 16, stagger: 0.6 }); fx.explosion(e.pos.clone().addScaledVector(fwd(e.yaw), 3).setY(0.5), 3.5, 0xffd23f, 0xffffff); });
  },
  on: () => {},
  end: (e) => { e.noFace = false; },
};
ATK.z_ring = {
  wind: 1.3, dur: 2.2, cd: 8, kind: 14, armor: true,
  begin: (e) => { reset(e); teleRing(e, e.pos.x, e.pos.z, 13, 1.3, 0xffd23f); sfx("charge", e.pos); },
  on: (e) => { explode(e.pos.clone().setY(0.3), 13, 54 * e.dm, { team: "e", color: 0xffd23f, color2: 0xffffff, knock: 16, shake: 1 }); shockwave(e.pos.x, e.pos.z, { max: 30, dmg: 30 * e.dm, speed: 20, color: 0xffd23f }); },
};
ATK.z_blink = {
  wind: 0.9, dur: 1.5, cd: 5, kind: 0,
  begin: (e) => { reset(e); e.hidden = true; e.rig.root.visible = false; fx.burst(e.pos.clone().add(new V3(0, 2, 0)), 0xffd23f, 20, 8, 0.6, 0.5, 0); sfx("teleport", e.pos); },
  upd: (e, _dt, t) => once(e, "app", t > 0.45, () => {
    const a = P.yaw + Math.PI + rnd(-0.6, 0.6), p = freeSpot(P.pos.x + Math.sin(a) * 4, P.pos.z + Math.cos(a) * 4, 0.5);
    e.pos.set(p.x, 0, p.z); e.hidden = false; e.rig.root.visible = true; e.yaw = e.faceYaw = yawTo(e.pos, P.pos);
    fx.burst(e.pos.clone().add(new V3(0, 2, 0)), 0xffffff, 20, 8, 0.6, 0.5, 0); fx.ring(e.pos.x, e.pos.z, 0.5, 4, 0xffd23f, 0.4); sfx("teleport", e.pos);
  }),
  on: (e) => { melee(e, 4.8, 36, { kb: 12, stagger: 0.4, arc: -1 }); fx.mesh("slash", e.pos.x, e.pos.y + 1.8, e.pos.z, 0xffd23f, { life: 0.3, s0: [3, 1, 3], s1: [5.5, 1, 5.5], o0: 0.9, ry: e.yaw - 1.4 }); },
  end: (e) => { e.hidden = false; e.rig.root.visible = true; },
};
ATK.z_lasers = {
  wind: 1.4, dur: 4.8, cd: 13, kind: 14,
  begin: (e) => { reset(e); e.a.a0 = rnd(0, 6.28); e.a.bm = [0, 1, 2, 3].map(() => { const m = beamMesh(0xffd23f, 1, 1); m.mesh.visible = false; return m; }); teleRing(e, e.pos.x, e.pos.z, 40, 1.4, 0xffd23f); sfx("charge", e.pos); },
  upd: (e, _dt, t) => {
    e.noFace = true;
    if (t < 1.4) return;
    const a = e.a.a0 + (t - 1.4) * (e.stage >= 3 ? 1.5 : 1.15);
    e.a.bm.forEach((m: any, i: number) => {
      m.mesh.visible = true;
      const dir = new V3(Math.sin(a + i * 1.5708), 0, Math.cos(a + i * 1.5708));
      const o = e.pos.clone().setY(1.5);
      setBeam(m, o, dir, 42, 0.9 + Math.sin(t * 30 + i) * 0.15);
      beamDamage(e, o, dir, 42, 0.9, 22, "bd" + i, t);
    });
    shake(0.1);
    if (t > 4.4) e.a.bm.forEach((m: any) => fx.kill(m));
  },
  on: () => {},
  end: (e) => { e.a.bm?.forEach((m: any) => fx.kill(m)); e.noFace = false; },
};
ATK.z_rain = {
  wind: 0.9, dur: 4.4, cd: 10, kind: 12,
  begin: (e) => { reset(e); sfx("charge", e.pos, 0.6); },
  upd: (e, _dt, t) => {
    for (let i = 0; i < 9; i++) once(e, "c" + i, t > 0.9 + i * 0.38, () => {
      const p = P.pos.clone().addScaledVector(P.vel, 0.5 + (i % 3) * 0.2);
      const x = clamp(p.x, ARENA.x - 70, ARENA.x + 70), z = clamp(p.z, ARENA.z - 70, ARENA.z + 70);
      fx.mesh("disc", x, 0.13, z, 0xffd23f, { life: 0.9, s0: [0.3, 1, 0.3], s1: [3.6, 1, 3.6], o0: 0.2, o1: 0.5 });
      fx.mesh("ring", x, 0.15, z, 0xffd23f, { life: 0.9, s0: [3.6, 1, 3.6], s1: [3.6, 1, 3.6], o0: 0.9, o1: 0.9 });
      later(0.9, () => { if (e.dead) return; fx.mesh("beam", x, 0, z, 0xffffff, { life: 0.4, s0: [3.4, 80, 3.4], s1: [0.5, 80, 0.5], o0: 0.9 }); explode(new V3(x, 0.3, z), 4, 48 * e.dm, { team: "e", color: 0xffd23f, color2: 0xffffff, knock: 10, shake: 0.5 }); });
    });
  },
  on: () => {},
};
ATK.z_collapse = {
  wind: 5.2, dur: 7.4, cd: 45, kind: 14, armor: true,
  begin: (e) => {
    reset(e); e.noFace = true; G.darkT = 7;
    toast("GENESIS COLLAPSE! Hide behind a pillar — or dodge at the last instant!", "#ff5070");
    banner("TAKE COVER!", "Break line-of-sight with a pillar", "#ff4060", 3500);
    sfx("longcharge" as any, e.pos); sfx("charge", e.pos);
    voice("Everything ends now.", 0.4, 0.7);
    e.a.sph = fx.mesh("sphere", e.pos.x, e.pos.y + 6, e.pos.z, 0xffffff, { life: Infinity, s0: [0.5, 0.5, 0.5], o0: 0.95, o1: 0.95 });
    e.a.sph2 = fx.mesh("sphere", e.pos.x, e.pos.y + 6, e.pos.z, 0xff3050, { life: Infinity, s0: [0.7, 0.7, 0.7], o0: 0.5, o1: 0.5 });
    e.invuln = 0;
  },
  upd: (e, _dt, t) => {
    const k = clamp(t / 5.2, 0, 1);
    const s = 0.8 + k * k * 9;
    const hp = e.pos.clone().add(new V3(0, 7 + k * 3, 0));
    e.a.sph.mesh.position.copy(hp); e.a.sph2.mesh.position.copy(hp);
    e.a.sph.mesh.scale.setScalar(s * 0.7); e.a.sph2.mesh.scale.setScalar(s * (1 + Math.sin(t * 25) * 0.04));
    e.pos.y = Math.min(3, t * 1.2);
    e.vel.y = 0;
    if (t < 5.2) {
      shake(0.06 + k * 0.35);
      for (let i = 0; i < 4; i++) { const a = rnd(0, 6.28), r = 25 * (1 - k * 0.5); fx.em(hp.x + Math.cos(a) * r, hp.y + rnd(-6, 6), hp.z + Math.sin(a) * r, -Math.cos(a) * r * 1.4, 0, -Math.sin(a) * r * 1.4, [0xffffff, 0xff3050, 0xffd23f][i % 3], 1.5, 0.8); }
    }
    once(e, "blast", t >= 5.2, () => {
      fx.kill(e.a.sph); fx.kill(e.a.sph2);
      G.flash = 1; shake(2); sfx("big"); sfx("explosion");
      const from = e.pos.clone().add(new V3(0, 8, 0)), to = new V3(P.pos.x, P.pos.y + 1.2, P.pos.z);
      const blocked = segBlocked(from, to, 1.2);
      for (let i = 0; i < 4; i++) fx.ring(e.pos.x, e.pos.z, 2, 80 + i * 8, [0xffffff, 0xffd23f, 0xff3050, 0xffffff][i], 0.9, 0.3 + i * 0.1, 0.9);
      fx.explosion(e.pos.clone().add(new V3(0, 6, 0)), 22, 0xff3050, 0xffffff);
      if (!blocked) { dmgPlayer(900, from); } else { toast("You survived behind cover!", "#9fe"); }
      for (const a of G.allies) if (!a.dead && !segBlocked(from, a.pos.clone().add(new V3(0, 1, 0)), 1.5)) hurt(a, 400, from);
      for (const pr of G.props) if (!pr.dead && pr.type === "pillar" && Math.random() < 0.0) pr.hp = 0;
      e.stagger = 3.2; e.vulnT = 4.5; e.vuln = 1.6; cancelAtk(e); e.pos.y = 0;
      toast("EMPEROR ZERO IS EXHAUSTED — strike now!", "#ffd23f");
    });
  },
  on: () => {},
  end: (e) => { fx.kill(e.a.sph); fx.kill(e.a.sph2); e.noFace = false; e.pos.y = 0; },
};
ATK.z_form = {
  wind: 2.0, dur: 3.2, cd: 0, kind: 14,
  begin: (e) => { reset(e); e.invuln = 3.4; clearProjectiles("e"); sfx("roar", e.pos); G.flash = 0.5; voice(e.stage === 2 ? "You amuse me. Witness true power." : "I am the end. I am Zero.", 0.4, 0.7); },
  on: (e) => {
    shockwave(e.pos.x, e.pos.z, { max: 30, dmg: 24 * e.dm, speed: 22, color: e.stage === 2 ? 0xff3050 : 0xffffff });
    explode(e.pos.clone(), 10, 28 * e.dm, { team: "e", color: e.stage === 2 ? 0xff3050 : 0xaaaaff, color2: 0xffffff, shake: 1.4 });
    e.speed *= 1.1; e.cdScale = (e.cdScale ?? 1) * 0.8;
    e.rig.root.scale.multiplyScalar(1.1); e.rig.scale *= 1.1;
    if (e.stage === 2) e.rig.setColor((m: any) => { m.color.lerp(new THREE.Color(0xffb0b8), 0.5); m.userData.e.set(0xff1030); m.userData.ei = 0.45; });
    else e.rig.setColor((m: any) => { m.color.lerp(new THREE.Color(0x14141f), 0.78); m.userData.e.set(0x7a30ff); m.userData.ei = 0.6; });
  },
};
AI.zero = (e, dt, c) => {
  const cd = (k: string) => (e.cd[k] ?? 0) <= 0;
  const set = (k: string, v: number) => (e.cd[k] = v * (e.cdScale ?? 1));
  e.slot += dt * 0.3;
  if (c.d > 12) walkTo(e, c.tp.x, c.tp.z, e.speed, 2); else if (c.d < 5) walkDir(e, -c.dx, -c.dz, e.speed * 0.6); else walkDir(e, -c.dz, c.dx, e.speed * 0.5);
  if (e.recover > 0) return;
  const go = (n: string) => { startAtk(e, n); set(n, ATK[n].cd); };
  if (e.stage >= 3 && cd("z_collapse")) return go("z_collapse");
  if (e.stage >= 2 && cd("z_lasers") && c.d < 30) return go("z_lasers");
  if (e.stage >= 2 && cd("z_rain")) return go("z_rain");
  if (cd("z_ring") && c.d < 14) return go("z_ring");
  if (cd("z_combo") && c.d < 22) return go("z_combo");
  if (cd("z_orbs") && c.d > 6) return go("z_orbs");
  if (cd("z_blink")) return go("z_blink");
};

/* ===================== management ===================== */
const TRANSFORM: Record<string, string> = { titan: "t_rage", reaper: "r_phase", zero: "z_form" };
export function spawnBoss(kind: string, x: number, z: number) {
  const e = createEnemy(kind, x, z, { aggro: false });
  e.boss = true; e.keep = true; e.noSoul = true; e.stage = 1; e.noKnock = true; e.stages = 3;
  e.name = BOSS_INFO[kind].name; e.title = BOSS_INFO[kind].title;
  e.intro = { t: 0, dur: 5.2 };
  e.invuln = 999;
  e.a = {};
  e.dm = 1;
  if (kind === "reaper") { e.hover = 0.6; e.floatAnim = true; }
  if (kind === "zero") { e.hover = 1.0; e.floatAnim = true; }
  e.onDeath = () => {
    G.slowT = 3.2;
    G.cam.cine = { type: "bossdeath", boss: e, t: 0, dur: 4 };
    G.freezeInput = true;
    P.invul = 99;
    clearProjectiles("e");
    for (const m of [...G.enemies]) if (m.minion && !m.dead) killEnemy(m);
    for (let i = 0; i < 14; i++) later(i * 0.22, () => fx.explosion(e.pos.clone().add(new V3(rnd(-2, 2), rnd(0.5, e.h), rnd(-2, 2))), rnd(2.5, 5), pick([0xffa040, 0xffffff, 0xff4060]), 0xffffff));
    sfx("roar", e.pos); sfx("big", e.pos);
    banner("DEFEATED", BOSS_INFO[kind].name, BOSS_INFO[kind].color, 3600);
    G.hooks.onBossDead?.(e);
    later(4.0, () => { fx.explosion(e.pos.clone().add(new V3(0, 2, 0)), 14, 0xffffff, 0xffd23f); G.flash = 0.8; shake(1.5); sfx("big"); G.freezeInput = false; P.invul = 1; G.cam.cine = null; G.boss = null; setMusicLevel(0); G.darkT = 0; removeEnemy(e); });
  };
  fx.burst(e.pos.clone().add(new V3(0, 2, 0)), 0xffffff, 20, 6, 0.6, 0.6, 0);
  return e;
}
export function updateBosses(dt: number, time: number) {
  let boss: any = null;
  for (const e of G.enemies) {
    if (e.type === "clone") {
      e.life -= dt;
      if (e.life <= 0 && !e.dead) { explode(e.pos.clone().setY(0.5), 4.5, 26 * e.dm, { team: "e", color: 0xb040ff, color2: 0xff80c0, dark: true, knock: 8 }); e.noSoul = true; e.hp = 0; e.dead = true; e.deadT = 1.9; fx.burst(e.pos.clone().add(new V3(0, 1.5, 0)), 0xb040ff, 12, 6); }
      continue;
    }
    if (!e.boss || e.dead) continue;
    boss = e;
    // ambient aura
    const col = e.type === "titan" ? 0xff5a10 : e.type === "reaper" ? 0xb040ff : 0xffd23f;
    if (Math.random() < 0.5) fx.em(e.pos.x + rnd(-1, 1) * e.r, e.pos.y + rnd(0, e.h), e.pos.z + rnd(-1, 1) * e.r, rnd(-0.5, 0.5), rnd(0.5, 2.5), rnd(-0.5, 0.5), col, 0.8, 0.9, -0.5);
    if (e.type === "reaper" && Math.random() < 0.4) fx.smoke(e.pos.x + rnd(-1, 1), e.pos.y + rnd(0, 2), e.pos.z + rnd(-1, 1), 0, 1, 0, 0x120a22, 2.2, 1.2, 0, 1);
    if (e.vulnT > 0) { e.vulnT -= dt; if (e.vulnT <= 0) e.vuln = 1; }
    if (e.intro) {
      const it = e.intro;
      it.t += dt;
      e.invuln = 5; e.aggro = false; P.invul = 5; G.freezeInput = true;
      e.forceMode = it.t > 1.4 ? "roar" : "idle";
      e.faceYaw = yawTo(e.pos, P.pos);
      G.cam.cine = { type: "boss", boss: e, t: it.t, dur: it.dur };
      if (it.t > 0.4 && !it.b) { it.b = true; banner(BOSS_INFO[e.type].name, BOSS_INFO[e.type].title, BOSS_INFO[e.type].color, 3800); setMusicLevel(2); }
      if (it.t > 1.4 && !it.r) { it.r = true; sfx("roar", e.pos, 1.2); voice(BOSS_INFO[e.type].intro, e.type === "titan" ? 0.3 : 0.5, 0.75); shake(0.8); fx.ring(e.pos.x, e.pos.z, 1, 25, 0xffffff, 0.8); }
      if (it.t > 1.4 && it.t < 3.6) shake(0.15);
      if (it.t >= it.dur) { e.intro = null; e.invuln = 0; e.aggro = true; e.forceMode = null; G.cam.cine = null; G.freezeInput = false; P.invul = 0.5; G.boss = e; e.recover = 0.8; }
      continue;
    }
    G.boss = e;
    const frac = e.hp / e.maxHp;
    const want = frac < 0.33 ? 3 : frac < 0.66 ? 2 : 1;
    if (want > e.stage && e.atk?.name !== TRANSFORM[e.type]) {
      e.stage = want;
      cancelAtk(e);
      e.dash = null;
      startAtk(e, TRANSFORM[e.type]);
      banner(BOSS_INFO[e.type].name, `STAGE ${want === 2 ? "II" : "III"}`, BOSS_INFO[e.type].color, 2200);
      G.cam.cine = { type: "bossform", boss: e, t: 0, dur: 2.6 };
      later(2.6, () => { if (G.cam.cine?.type === "bossform") G.cam.cine = null; });
    }
  }
  if (!boss && G.boss && G.boss.dead === false) G.boss = null;
  if (G.boss?.dead && G.boss.deadT > 5) G.boss = null;
  if (G.darkT > 0) G.darkT -= dt;
  void time;
}
