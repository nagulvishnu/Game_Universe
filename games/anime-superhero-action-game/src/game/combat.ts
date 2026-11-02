import { G, P, V3, rnd, clamp } from "./core";
import { fx, shake, hitstop, dmgNum, FxM } from "./fx";
import { sfx } from "./audio";
import { pointInBox } from "./world";
import { useGame, toast } from "../store";

const up = new V3(0, 1, 0);
export const XP: Record<string, number> = { criminal: 12, assassin: 20, ninja: 22, brute: 45, gunner: 18, hunter: 25, commander: 120, titan: 700, reaper: 900, zero: 1400, clone: 0 };
export const SOUL: Record<string, string> = { criminal: "grunt", assassin: "ember", ninja: "blade", brute: "colossus", gunner: "sniper", hunter: "raven", commander: "knight" };

export const chestPos = (e: any, out = new V3()) => out.set(e.pos.x, e.pos.y + (e.h ?? 1.8) * 0.55, e.pos.z);

export function dmgEnemy(e: any, dmg: number, o: { kb?: V3; stagger?: number; src?: string; crit?: boolean; fire?: boolean; silent?: boolean; color?: string } = {}) {
  if (e.dead || e.invuln > 0) return 0;
  if (e.evade > 0) { dmgNum(chestPos(e).add(new V3(0, e.h * 0.4, 0)), "MISS", "#9be", 1); return 0; }
  const src = o.src ?? "player";
  if (src === "player") dmg *= G.mods.dmg;
  let amt = dmg * (1 - (e.armor ?? 0)) * (e.vuln ?? 1);
  if (e.atk?.def?.armor) amt *= 0.8;
  e.hp -= amt;
  e.flash = 0.16;
  e.lastHit = G.time;
  e.aggro = true;
  if (!o.silent) dmgNum(chestPos(e).add(new V3(0, e.h * 0.4, 0)), Math.round(amt), o.color ?? (o.crit ? "#ffd23f" : e.boss ? "#ffb3b3" : "#ffffff"), clamp(0.8 + amt / 120, 0.8, 1.9));
  if (o.kb && !e.noKnock) e.kb.addScaledVector(o.kb, 1 - (e.kbRes ?? 0));
  if (o.stagger && !(e.atk?.def?.armor && o.stagger < 0.8) && (!e.boss || o.stagger >= 0.8)) {
    const st = o.stagger * (e.boss ? 0.35 : e.staggerRes ? 0.4 : 1);
    if (st > 0.1) { e.stagger = Math.max(e.stagger ?? 0, st); e.atk = null; e.tele?.forEach((t: FxM) => fx.kill(t)); e.tele = []; }
  }
  if (src === "player") {
    const h = P.hero;
    P.ult[h] = Math.min(100, P.ult[h] + amt * 0.0125 * G.mods.ult);
    P.lastCombat = G.time;
  }
  if (o.fire) e.burn = { t: 3, dps: Math.max(5, amt * 0.08) };
  if (e.hp <= 0) killEnemy(e);
  return amt;
}

export function killEnemy(e: any) {
  if (e.dead) return;
  e.dead = true;
  e.deadT = 0;
  e.atk = null;
  e.hp = 0;
  e.tele?.forEach((t: FxM) => fx.kill(t));
  e.tele = [];
  if (e.type !== "clone") {
    useGame.getState().addKill();
    const xp = XP[e.type] ?? 10;
    if (xp) {
      const lv = useGame.getState().addXp(xp);
      if (lv) { sfx("level"); toast(`LEVEL UP! Lv ${useGame.getState().level} — +1 upgrade point`, "#ffd23f"); }
    }
    const m = G.mods; void m;
  }
  P.ult[P.hero] = Math.min(100, P.ult[P.hero] + 3);
  fx.burst(chestPos(e), e.shadowCol ?? 0xffffff, 14, 8, 0.4, 0.6);
  sfx("heavy", e.pos, 0.6);
  if (!e.boss && SOUL[e.type] && !e.noSoul) G.souls.push({ pos: e.pos.clone().add(new V3(0, 1.2, 0)), type: SOUL[e.type], t: 0, life: 16, id: G.nextId++ });
  G.hooks.onKill?.(e);
  e.onDeath?.(e);
}

export function dmgPlayer(dmg: number, from?: V3, o: { kb?: number; stagger?: number; ignore?: boolean } = {}) {
  if (P.dead || G.mode !== "playing") return;
  if (P.invul > 0) {
    if (P.act?.type === "dodge" && dmg >= 8 && P.perfectCd <= 0) {
      P.perfectCd = 3;
      G.slowT = 0.9;
      P.ult[P.hero] = Math.min(100, P.ult[P.hero] + 10);
      P.en[P.hero] = Math.min(P.maxEn[P.hero], P.en[P.hero] + 25);
      G.hooks.perfect?.();
      sfx("perfect");
    }
    return;
  }
  const h = P.hero;
  P.hp[h] -= dmg;
  P.hurtT = 0.3;
  P.invul = 0.18;
  G.hurt = Math.min(1, (G.hurt ?? 0) + 0.5 + dmg / 120);
  P.lastCombat = G.time;
  P.ult[h] = Math.min(100, P.ult[h] + dmg * 0.02 * G.mods.ult);
  shake(clamp(dmg / 60, 0.15, 0.7));
  sfx("hurt");
  if (from && o.kb) {
    const d = new V3(P.pos.x - from.x, 0, P.pos.z - from.z).normalize();
    P.vel.x += d.x * o.kb; P.vel.z += d.z * o.kb;
    if (o.kb > 8) P.vel.y = Math.max(P.vel.y, 4);
  }
  if (o.stagger && !(P.act && (P.act.type === "ult" || P.act.type === "beam" || P.act.type === "dodge" || P.act.type === "dash"))) {
    P.stagger = Math.max(P.stagger, o.stagger);
    if (P.act && P.act.type !== "ult") { P.act = null; }
  }
  if (P.hp[h] <= 0) { P.hp[h] = 0; G.hooks.playerDown?.(); }
}

export function hurt(tgt: any, dmg: number, from: V3, o: { kb?: number; stagger?: number } = {}) {
  if (!tgt) return;
  if (tgt === P) return dmgPlayer(dmg, from, o);
  if (tgt.dead) return;
  tgt.hp -= dmg;
  tgt.flash = 0.15;
  dmgNum(tgt.pos.clone().add(new V3(0, 2, 0)), Math.round(dmg), "#b99aff", 0.8);
  if (tgt.rig && o.kb) tgt.kb?.addScaledVector(new V3(tgt.pos.x - from.x, 0, tgt.pos.z - from.z).normalize(), o.kb * 0.5);
  if (tgt.hp <= 0) { tgt.hp = 0; tgt.dead = true; tgt.onDeath?.(tgt); }
}

/* ------------ AoE ------------- */
export function explode(
  pos: V3, radius: number, dmg: number,
  o: { team: "p" | "e"; color?: number; color2?: number; knock?: number; stagger?: number; dark?: boolean; shake?: number; burn?: boolean; silent?: boolean; vfx?: boolean; falloff?: number } = { team: "p" }
) {
  const c1 = o.color ?? 0xff7a1a, c2 = o.color2 ?? 0xffd23f;
  const fo = o.falloff ?? 0.45;
  if (o.vfx !== false) {
    fx.explosion(pos, radius, c1, c2, o.dark);
    sfx(radius > 12 ? "big" : "explosion", pos, radius > 12 ? 1.3 : 1);
  }
  const d0 = P.pos.distanceTo(pos);
  shake((o.shake ?? clamp(radius / 14, 0.2, 1.2)) * clamp(1.3 - d0 / (radius * 4 + 30), 0, 1));
  const kb = o.knock ?? 10;
  if (o.team === "p") {
    for (const e of G.enemies) {
      if (e.dead) continue;
      const cp = chestPos(e);
      const d = cp.distanceTo(pos) - e.r;
      if (d > radius) continue;
      const k = 1 - fo * clamp(d / radius, 0, 1);
      const dir = new V3(e.pos.x - pos.x, 0.25, e.pos.z - pos.z).normalize();
      dmgEnemy(e, dmg * k, { kb: dir.multiplyScalar(kb * k), stagger: o.stagger ?? 0.4, silent: o.silent, fire: o.burn });
    }
  } else {
    const d = P.pos.distanceTo(pos);
    if (d < radius + 0.6) dmgPlayer(dmg * (1 - fo * clamp(d / radius, 0, 1)), pos, { kb: kb, stagger: 0.35 });
    for (const a of G.allies) {
      if (a.dead) continue;
      const d2 = a.pos.distanceTo(pos);
      if (d2 < radius + 1) hurt(a, dmg * 0.8, pos, { kb: kb });
    }
  }
  G.hooks.damageAt?.(pos, radius, dmg, o.team);
}

export function nearestEnemy(pos: V3, maxD: number, filter?: (e: any) => boolean) {
  let best: any = null, bd = maxD;
  for (const e of G.enemies) {
    if (e.dead || e.invuln > 0 || e.hidden) continue;
    if (filter && !filter(e)) continue;
    const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
export function distToSeg(p: V3, a: V3, b: V3) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y, a.z + abz * t - p.z);
}

/* ------------ projectiles ------------ */
const PK: Record<string, { c: number; c2: number; s: number; trail: number }> = {
  fire: { c: 0xff7a1a, c2: 0xffe08a, s: 0.75, trail: 0xff5a10 },
  dark: { c: 0x8a5cff, c2: 0xe6d8ff, s: 0.6, trail: 0x6a3cff },
  bolt: { c: 0x33ffff, c2: 0xffffff, s: 0.28, trail: 0x33ddff },
  ember: { c: 0xff4a10, c2: 0xffcc66, s: 0.55, trail: 0xff7a1a },
  orb: { c: 0xffd23f, c2: 0xffffff, s: 0.7, trail: 0xffc020 },
  void: { c: 0xc040ff, c2: 0xff90d0, s: 0.7, trail: 0xa030ff },
  wave: { c: 0xb070ff, c2: 0xffffff, s: 1.0, trail: 0x8a5cff },
  red: { c: 0xff3050, c2: 0xffffff, s: 0.5, trail: 0xff3050 },
};
export interface ProjOpts {
  kind: string; team: "p" | "e"; pos: V3; dir: V3; speed: number; dmg: number; hitR?: number; life?: number;
  homing?: { tgt: any; turn: number }; radius?: number; pierce?: boolean; grav?: number; knock?: number; stagger?: number; scale?: number; owner?: any;
  expDark?: boolean; burn?: boolean; wave?: boolean; tgtOff?: number;
}
export function shoot(o: ProjOpts) {
  const k = PK[o.kind] ?? PK.fire;
  const sc = (o.scale ?? 1) * k.s;
  const vis: FxM = fx.mesh(o.wave ? "slash" : "sphere", o.pos.x, o.pos.y, o.pos.z, k.c, { life: Infinity, s0: o.wave ? [sc * 2, 1, sc * 2] : [sc, sc, sc], o0: 0.7, o1: 0.7 });
  const core: FxM | null = o.wave ? null : fx.mesh("sphere", o.pos.x, o.pos.y, o.pos.z, k.c2, { life: Infinity, s0: [sc * 0.55, sc * 0.55, sc * 0.55], o0: 1, o1: 1 });
  if (o.wave) vis.mesh.rotation.y = Math.atan2(o.dir.x, o.dir.z) - Math.PI * 0.4 + Math.PI / 2;
  const p = {
    ...o, pos: o.pos.clone(), vel: o.dir.clone().normalize().multiplyScalar(o.speed), t: 0, life: o.life ?? 4, vis, core, k, hit: new Set<any>(), hitR: o.hitR ?? 0.7, dead: false,
  };
  G.projectiles.push(p);
  return p;
}
const _t = new V3(), _d = new V3();
export function updateProjectiles(dt: number) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.t += dt;
    if (p.homing) {
      const tg = p.homing.tgt;
      if (tg && !tg.dead && !tg.hidden) {
        chestPos(tg, _t);
        _d.copy(_t).sub(p.pos).normalize();
        const sp = p.vel.length();
        p.vel.normalize().lerp(_d, clamp(p.homing.turn * dt, 0, 1)).normalize().multiplyScalar(sp);
      } else if (p.team === "p") {
        const ne = nearestEnemy(p.pos, 30);
        if (ne) p.homing.tgt = ne;
      }
    }
    if (p.grav) p.vel.y -= p.grav * dt;
    p.pos.addScaledVector(p.vel, dt);
    p.vis.mesh.position.copy(p.pos);
    p.core?.mesh.position.copy(p.pos);
    if (p.wave) p.vis.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.z) - Math.PI * 0.4 + Math.PI / 2;
    // trail
    const k = p.k;
    fx.em(p.pos.x + rnd(-0.1, 0.1), p.pos.y + rnd(-0.1, 0.1), p.pos.z + rnd(-0.1, 0.1), -p.vel.x * 0.05, rnd(-0.5, 0.5), -p.vel.z * 0.05, k.trail, 0.7 * (p.scale ?? 1) * k.s * 1.2, 0.35, 0, 1);
    let hitSomething = false;
    if (p.team === "p") {
      for (const e of G.enemies) {
        if (e.dead || e.invuln > 0 || e.hidden || p.hit.has(e)) continue;
        const a = e.pos, top = new V3(e.pos.x, e.pos.y + e.h, e.pos.z);
        if (distToSeg(p.pos, a, top) < e.r + p.hitR) {
          if (p.radius) { hitSomething = true; break; }
          p.hit.add(e);
          dmgEnemy(e, p.dmg, { kb: p.vel.clone().setY(1).normalize().multiplyScalar(p.knock ?? 6), stagger: p.stagger ?? 0.3, fire: p.burn });
          fx.sparks(p.pos, p.k.c, 8, 8);
          sfx("hit", p.pos);
          if (!p.pierce) { hitSomething = true; break; }
        }
      }
    } else {
      const tp = _t.set(P.pos.x, P.pos.y + 0.9, P.pos.z);
      if (!p.hit.has(P) && tp.distanceTo(p.pos) < p.hitR + 0.6) {
        if (p.radius) hitSomething = true;
        else { p.hit.add(P); dmgPlayer(p.dmg, p.pos, { kb: p.knock ?? 4, stagger: p.stagger ?? 0.15 }); fx.sparks(p.pos, p.k.c, 8, 8); if (!p.pierce) hitSomething = true; }
      }
      for (const a of G.allies) {
        if (a.dead || p.hit.has(a)) continue;
        if (Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < a.r + p.hitR && Math.abs(a.pos.y + 1 - p.pos.y) < 2.5) {
          p.hit.add(a);
          if (p.radius) { hitSomething = true; break; }
          hurt(a, p.dmg, p.pos);
          if (!p.pierce) hitSomething = true;
        }
      }
    }
    if (!hitSomething && (p.pos.y < 0.1 || (pointInBox(p.pos.x, p.pos.y, p.pos.z) && !p.pierce))) hitSomething = true;
    if (p.t > p.life) hitSomething = true;
    if (hitSomething) {
      if (p.radius) explode(p.pos, p.radius * (p.team === "p" ? G.mods.mast : 1), p.dmg, { team: p.team, color: p.k.c, color2: p.k.c2, knock: p.knock ?? 9, stagger: p.stagger ?? 0.5, dark: p.expDark, burn: p.burn });
      else if (p.t < p.life) { fx.sparks(p.pos, p.k.c, 6, 6); }
      fx.kill(p.vis); fx.kill(p.core);
      G.projectiles.splice(i, 1);
    }
  }
}
export function clearProjectiles(team?: string) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    if (team && p.team !== team) continue;
    fx.kill(p.vis); fx.kill(p.core);
    G.projectiles.splice(i, 1);
  }
}

/* ------------ ground shockwaves ------------ */
export function shockwave(x: number, z: number, o: { speed?: number; max: number; dmg: number; w?: number; color?: number; team?: "e" | "p"; breaks?: boolean; hgt?: number }) {
  const col = o.color ?? 0xffaa40;
  const vis = fx.mesh("ring", x, 0.2, z, col, { life: Infinity, s0: [1, 1, 1], o0: 0.9, o1: 0.9 });
  G.waves.push({ x, z, r: 0.5, speed: o.speed ?? 20, max: o.max, dmg: o.dmg, w: o.w ?? 2.2, vis, team: o.team ?? "e", hit: new Set(), breaks: !!o.breaks, hgt: o.hgt ?? 2.0, col });
  sfx("slam", new V3(x, 0, z));
}
export function updateWaves(dt: number) {
  for (let i = G.waves.length - 1; i >= 0; i--) {
    const w = G.waves[i];
    w.r += w.speed * dt;
    w.vis.mesh.scale.set(w.r, 1, w.r);
    w.vis.mat.opacity = 0.9 * (1 - w.r / w.max * 0.7);
    if (Math.random() < 0.7) { const a = rnd(0, 6.28); fx.em(w.x + Math.cos(a) * w.r, 0.3, w.z + Math.sin(a) * w.r, 0, rnd(2, 5), 0, w.col, 0.8, 0.5, 5); }
    if (w.team === "e") {
      const d = Math.hypot(P.pos.x - w.x, P.pos.z - w.z);
      if (!w.hit.has(P) && Math.abs(d - w.r) < w.w && P.pos.y < w.hgt) {
        w.hit.add(P);
        dmgPlayer(w.dmg, new V3(w.x, 0, w.z), { kb: 12, stagger: 0.4 });
      }
      for (const a of G.allies) if (!a.dead && !w.hit.has(a) && Math.abs(Math.hypot(a.pos.x - w.x, a.pos.z - w.z) - w.r) < w.w + 1 && a.pos.y < 2) { w.hit.add(a); hurt(a, w.dmg * 0.7, new V3(w.x, 0, w.z), { kb: 10 }); }
      if (w.breaks) G.hooks.breakRing?.(w.x, w.z, w.r);
    } else {
      for (const e of G.enemies) {
        if (e.dead || w.hit.has(e) || e.pos.y > w.hgt) continue;
        if (Math.abs(Math.hypot(e.pos.x - w.x, e.pos.z - w.z) - w.r) < w.w + e.r) { w.hit.add(e); dmgEnemy(e, w.dmg, { kb: new V3(e.pos.x - w.x, 0.3, e.pos.z - w.z).normalize().multiplyScalar(14), stagger: 0.6 }); }
      }
    }
    if (w.r >= w.max) { fx.kill(w.vis); G.waves.splice(i, 1); }
  }
}
export { up as _up, hitstop as _hs };
