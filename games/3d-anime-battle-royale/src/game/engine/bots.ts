import { Vector3 } from 'three';
import { ITEMS } from '../data/items';
import { ATTACHMENTS, WEAPONS, weaponScore, weaponStats } from '../data/weapons';
import { PLANE_SPEED } from '../data/config';
import { groundAt, hasLOS, raycastWorld } from '../world/colliders';
import { findPath } from '../world/nav';
import { angDiff, clamp, pick, rand, Rng, segDist } from '../util';
import { attach, equipSlot, startHeal, startReload } from './inventory';
import { startThrow, segSphere } from './combat';
import { Bot, Fighter, Loot, Personality } from './types';
import type { Game } from './Game';

const PERS: Personality[] = ['aggressive', 'aggressive', 'defensive', 'defensive', 'looter', 'looter', 'looter', 'tactical', 'tactical', 'sniper'];

export function createBot(r: Rng): Bot {
  return {
    personality: pick(r, PERS), skill: rand(r, 0.3, 0.92), react: rand(r, 0.25, 0.75), mode: 'plane', thinkT: r(), path: [], pathI: 0, goal: null, goalKind: '',
    lootTarget: -1, enemy: -1, lastSeen: null, seenSince: 0, coverPos: null, stuckT: 0, lastPos: [0, 0], strafeDir: r() < 0.5 ? 1 : -1, strafeT: 0,
    grenadeCd: rand(r, 3, 12), jumpPlan: { x: 0, z: 0, t: 0, tx: 0, tz: 0, chuteAlt: 150 }, landed: false, repathT: 0, heardPos: null, burstT: 0, burstPause: 0,
    zoneT: 0, roamT: 0, fightT: 0, noLootT: 0, doorStage: 0, aimErr: 0, accT: 0, flashedT: 0, visible: false, skip: {}, switchT: 0, wanderT: 0,
  };
}

/* ---------------- drop planning ---------------- */
export function planDrop(g: Game, f: Fighter) {
  const b = f.bot!;
  const w = g.world;
  const pl = g.plane;
  let best: { x: number; z: number; s: number } | null = null;
  const cand = w.buildings;
  const wl = b.personality === 'looter' ? 1.7 : b.personality === 'defensive' ? 0.9 : b.personality === 'sniper' ? 0.8 : 1.1;
  const wd = b.personality === 'aggressive' ? 0.9 : b.personality === 'defensive' ? -1.4 : b.personality === 'sniper' ? -0.6 : 0.1;
  for (let i = 0; i < 30; i++) {
    const bi = cand[Math.floor(g.rng() * cand.length)];
    if (!bi) break;
    const d = w.districts.find((x) => x.id === bi.district);
    if (!d) continue;
    const routeD = segDist(bi.x, bi.z, pl.start.x, pl.start.z, pl.end.x, pl.end.z);
    let s = d.loot * wl + d.danger * wd + g.rng() * 0.9 - Math.max(0, routeD - 300) * 0.012;
    if (b.personality === 'sniper' && (d.id === 'frost' || d.id === 'iron')) s += 0.8;
    s -= g.landingCount(bi.x, bi.z, 45) * 0.28;
    if (!best || s > best.s) best = { x: bi.x + (g.rng() - 0.5) * 8, z: bi.z + (g.rng() - 0.5) * 8, s };
  }
  if (!best) best = { x: (g.rng() - 0.5) * 600, z: (g.rng() - 0.5) * 600, s: 0 };
  {
    // aim for the doorstep rather than the roof
    const bi = g.buildingAt(best.x, best.z);
    if (bi && bi.door.length) { const dr = pick(g.rng, bi.door); best.x = dr.ox + (g.rng() - 0.5) * 4; best.z = dr.oz + (g.rng() - 0.5) * 4; }
  }
  g.noteLanding(best.x, best.z);
  // find jump point along plane route
  const reach = rand(g.rng, 240, 330);
  const L = Math.hypot(pl.end.x - pl.start.x, pl.end.z - pl.start.z);
  let bestT = 0, bestD = 1e9, found = -1;
  for (let t = 0; t <= L; t += 12) {
    const px = pl.start.x + pl.dir.x * t, pz = pl.start.z + pl.dir.z * t;
    const d = Math.hypot(px - best.x, pz - best.z);
    if (d < bestD) { bestD = d; bestT = t; }
    if (found < 0 && d <= reach && Math.abs(px) < w.half - 40 && Math.abs(pz) < w.half - 40) found = t;
  }
  const t = found >= 0 ? found : bestT;
  b.jumpPlan = { x: 0, z: 0, t: t / PLANE_SPEED + g.rng() * 2, tx: best.x, tz: best.z, chuteAlt: rand(g.rng, 110, 200) };
}

export function botAir(g: Game, f: Fighter, dt: number) {
  const b = f.bot!, c = f.cmd;
  const dx = b.jumpPlan.tx - f.pos.x, dz = b.jumpPlan.tz - f.pos.z;
  const d = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  f.yaw += clamp(angDiff(f.yaw, want), -3 * dt, 3 * dt);
  c.mx = 0; c.mz = d > 14 ? 1 : d < 6 ? -1 : 0;
  c.jump = false;
}

/* ---------------- helpers ---------------- */
const eyeOf = (f: Fighter, out: Vector3) => out.set(f.pos.x, f.pos.y + f.eyeY, f.pos.z);
const _a = new Vector3(), _b = new Vector3();

function smokeBlocked(g: Game, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  for (const s of g.smokes) if (segSphere(ax, ay, az, bx - ax, by - ay, bz - az, s.x, s.y + 2, s.z, s.r * 0.75) >= 0) return true;
  return false;
}

function canSee(g: Game, f: Fighter, o: Fighter) {
  eyeOf(f, _a);
  const ty = o.state === 'ground' && o.stance === 'prone' ? 0.4 : o.state === 'ground' && o.stance === 'crouch' ? 1.0 : 1.4;
  _b.set(o.pos.x, o.pos.y + ty, o.pos.z);
  if (!hasLOS(g.world, _a.x, _a.y, _a.z, _b.x, _b.y, _b.z)) return false;
  return !smokeBlocked(g, _a.x, _a.y, _a.z, _b.x, _b.y, _b.z);
}

function turnTo(f: Fighter, target: number, rate: number, dt: number) {
  f.yaw += clamp(angDiff(f.yaw, target), -rate * dt, rate * dt);
}

function hasAmmoFor(f: Fighter, slot: number) {
  const w = f.slots[slot];
  return !!w && (w.mag > 0 || f.ammo[WEAPONS[w.id].ammo] > 0);
}

function lootValue(g: Game, f: Fighter, l: Loot): number {
  const def = ITEMS[l.item];
  if (!def) return 0;
  switch (def.kind) {
    case 'weapon': {
      const id = def.ref!;
      const sc = weaponScore(id);
      const isP = WEAPONS[id].cat === 'PISTOL';
      if (isP) return f.slots[2] ? 0 : 55;
      const s0 = f.slots[0] ? weaponScore(f.slots[0].id) : 0, s1 = f.slots[1] ? weaponScore(f.slots[1].id) : 0;
      if (!f.slots[0] || !f.slots[1]) return 95 + sc * 0.05;
      return sc > Math.min(s0, s1) * 1.2 ? 60 + sc * 0.04 : 0;
    }
    case 'ammo': {
      const t = def.ref!;
      let need = 0;
      for (const w of f.slots) if (w && WEAPONS[w.id].ammo === t) need = Math.max(need, 2.8 * WEAPONS[w.id].mag - f.ammo[t as 'light']);
      return need > 0 ? 18 + Math.min(40, need * 0.6) : 0;
    }
    case 'armor': return def.level! > f.armor ? 38 + def.level! * 16 : 0;
    case 'helmet': return def.level! > f.helmet ? 34 + def.level! * 12 : 0;
    case 'backpack': return def.level! > f.pack ? 22 + def.level! * 8 : 0;
    case 'heal': return def.id === 'medkit' ? (f.heal.medkit < 2 ? 34 : 6) : f.heal.bandage < 5 ? 26 : 5;
    case 'throw': return f.throws[def.id] < 3 ? 20 : 4;
    case 'attach': return 9;
  }
  return 0;
}

export function considerEquip(g: Game, f: Fighter, l: Loot) {
  // handled through pickup(); bots use the same inventory logic
}

function desiredRange(f: Fighter) {
  const w = f.weapon;
  const b = f.bot!;
  let r = 28;
  if (w) {
    const c = WEAPONS[w.id].cat;
    r = c === 'SNIPER' ? 100 : c === 'SHOTGUN' ? 9 : c === 'SMG' ? 15 : c === 'PISTOL' ? 14 : c === 'LMG' ? 45 : 32;
  }
  if (b.personality === 'aggressive') r *= 0.7;
  if (b.personality === 'sniper') r *= 1.5;
  if (b.personality === 'defensive') r *= 1.15;
  return r;
}

function setPath(g: Game, f: Fighter, pts: [number, number][], kind: string) {
  const b = f.bot!;
  b.path = pts; b.pathI = 0; b.goalKind = kind; b.repathT = 2.5;
  b.goal = pts.length ? pts[pts.length - 1] : null;
  b.stuckT = 0;
}

function goTo(g: Game, f: Fighter, x: number, z: number, kind: string) {
  const d = Math.hypot(x - f.pos.x, z - f.pos.z);
  setPath(g, f, d > 30 ? findPath(g.world, f.pos.x, f.pos.z, x, z) : [[x, z]], kind);
}

function inside(bi: { x: number; z: number; w: number; d: number }, x: number, z: number, m = 0.5) {
  return Math.abs(x - bi.x) < bi.w / 2 + m && Math.abs(z - bi.z) < bi.d / 2 + m;
}

function goLoot(g: Game, f: Fighter, l: Loot) {
  const bi = g.buildingAt(l.x, l.z);
  const pts: [number, number][] = [];
  if (bi && !inside(bi, f.pos.x, f.pos.z, 0.6) && bi.door.length) {
    let bd = bi.door[0], bdd = 1e9;
    for (const d of bi.door) { const dd = Math.hypot(d.ox - f.pos.x, d.oz - f.pos.z); if (dd < bdd) { bdd = dd; bd = d; } }
    pts.push(...findPath(g.world, f.pos.x, f.pos.z, bd.ox, bd.oz)); pts.push([bd.ix, bd.iz]);
  } else if (!bi) pts.push(...findPath(g.world, f.pos.x, f.pos.z, l.x, l.z));
  pts.push([l.x, l.z]);
  setPath(g, f, pts, 'loot');
  f.bot!.lootTarget = l.id;
}

function clearAt(g: Game, f: Fighter, ang: number, dist: number) {
  const dx = Math.sin(ang), dz = Math.cos(ang);
  if (raycastWorld(g.world, f.pos.x, f.pos.y + 0.55, f.pos.z, dx, 0, dz, dist)) return false;
  const ex = f.pos.x + dx * dist, ez = f.pos.z + dz * dist;
  const gh = groundAt(g.world, ex, ez, f.pos.y, 0.6, 0.4);
  if (gh < -0.35 || gh - f.pos.y > 1.2 || f.pos.y - gh > 3.5 && gh < f.pos.y - 3.5) return false;
  return true;
}

function avoid(g: Game, f: Fighter, ang: number) {
  if (clearAt(g, f, ang, 2.4)) return ang;
  const s = f.bot!.strafeDir;
  for (const k of [0.55, 1.1, 1.7, 2.3]) {
    if (clearAt(g, f, ang + k * s, 2.4)) return ang + k * s;
    if (clearAt(g, f, ang - k * s, 2.4)) return ang - k * s;
  }
  return ang + Math.PI * 0.8;
}

function follow(g: Game, f: Fighter, dt: number, sprint: boolean): boolean {
  const b = f.bot!, c = f.cmd;
  if (b.pathI >= b.path.length) return false;
  let [wx, wz] = b.path[b.pathI];
  let d = Math.hypot(wx - f.pos.x, wz - f.pos.z);
  const last = b.pathI === b.path.length - 1;
  if (d < (last ? 1.1 : 3.2)) {
    b.pathI++;
    if (b.pathI >= b.path.length) return false;
    [wx, wz] = b.path[b.pathI];
    d = Math.hypot(wx - f.pos.x, wz - f.pos.z);
  }
  const ang = avoid(g, f, Math.atan2(wx - f.pos.x, wz - f.pos.z));
  turnTo(f, ang, 8, dt);
  c.mz = Math.abs(angDiff(f.yaw, ang)) < 1.2 ? 1 : 0.2;
  c.sprint = sprint;
  // stuck detection
  b.stuckT += 0; // updated in act via lastPos sampling
  return true;
}

function updateStuck(g: Game, f: Fighter, dt: number, wantMove: boolean) {
  const b = f.bot!;
  b.repathT -= dt;
  b.accT += dt;
  if (b.accT < 0.5) return;
  b.accT = 0;
  // rescue bots that ended up on roofs/structures with no way down
  const terr = g.world.heightAt(f.pos.x, f.pos.z);
  if (f.grounded && f.pos.y - terr > 4 && b.mode !== 'fight') {
    b.wanderT += 0;
    b.noLootT += 0.5;
    if (b.noLootT > 6) {
      b.noLootT = 0;
      for (let r = 4; r < 20; r += 3) for (let a = 0; a < 6.28; a += 0.7) {
        const x = f.pos.x + Math.cos(a) * r, z = f.pos.z + Math.sin(a) * r;
        const th = g.world.heightAt(x, z);
        if (th > 0.5 && groundAt(g.world, x, z, th + 1, 0.6, 0.4) < th + 0.6) { f.pos.set(x, th + 0.1, z); f.vel.set(0, 0, 0); b.path = []; b.mode = 'roam'; return; }
      }
    }
  } else b.noLootT = 0;
  const moved = Math.hypot(f.pos.x - b.lastPos[0], f.pos.z - b.lastPos[1]);
  b.lastPos = [f.pos.x, f.pos.z];
  if (wantMove && moved < 0.35) {
    b.stuckT += 0.5;
    if (b.stuckT >= 1) { f.cmd.jump = true; b.strafeDir *= -1; }
    if (b.stuckT >= 3) {
      if (b.lootTarget >= 0) b.skip[b.lootTarget] = g.time + 90;
      b.path = []; b.goal = null; b.stuckT = 0; b.mode = 'roam'; b.roamT = 0;
    }
  } else b.stuckT = 0;
}

function bestLoot(g: Game, f: Fighter, radius: number): Loot | null {
  const b = f.bot!;
  let best: Loot | null = null, bs = 0;
  const baseY = g.world.heightAt(f.pos.x, f.pos.z);
  for (const l of g.lootNear(f.pos.x, f.pos.z, radius)) {
    if (b.skip[l.id] && b.skip[l.id] > g.time) continue;
    if (l.y - g.world.heightAt(l.x, l.z) > 2.5 && Math.abs(f.pos.y - l.y) > 2.5) {
      // upper floors/roofs: only reachable by stairs; skip for bots unless already near
      if (Math.hypot(l.x - f.pos.x, l.z - f.pos.z) > 3) continue;
    }
    const v = lootValue(g, f, l);
    if (v <= 0) continue;
    const d = Math.hypot(l.x - f.pos.x, l.z - f.pos.z);
    const s = v - d * 0.35;
    if (s > bs) { bs = s; best = l; }
  }
  void baseY;
  return best;
}

interface ZInfo { want: boolean; urgent: boolean; gx: number; gz: number }
function zoneInfo(g: Game, f: Fighter): ZInfo {
  const z = g.zone;
  const dNow = Math.hypot(f.pos.x - z.cx, f.pos.z - z.cz);
  const outsideNow = dNow > z.r - 5;
  let tcx = z.nextCx, tcz = z.nextCz, tr = z.nextR;
  if (z.state === 'shrink') { tcx = z.toCx; tcz = z.toCz; tr = z.toR; }
  if (z.final) { tcx = z.cx; tcz = z.cz; tr = z.r; }
  const dNext = Math.hypot(f.pos.x - tcx, f.pos.z - tcz);
  const outsideNext = dNext > tr * 0.92 - 4;
  const travel = Math.max(0, dNext - tr * 0.6) / 5.2;
  const want = outsideNow || (outsideNext && (z.state === 'shrink' || z.timer < travel + 18));
  const a = Math.atan2(f.pos.z - tcz, f.pos.x - tcx);
  const k = Math.min(0.55 * tr, Math.max(0, dNext));
  let gx = tcx + Math.cos(a) * Math.min(k, tr * 0.5), gz = tcz + Math.sin(a) * Math.min(k, tr * 0.5);
  if (!g.world.landAt(gx, gz)) { gx = tcx; gz = tcz; }
  return { want, urgent: outsideNow, gx, gz };
}

function pickRoam(g: Game, f: Fighter) {
  const b = f.bot!;
  const z = g.zone;
  let tx = z.nextCx, tz = z.nextCz, tr = z.nextR;
  if (z.state === 'shrink') { tx = z.toCx; tz = z.toCz; tr = z.toR; }
  const w = g.world;
  const bs = w.buildings.filter((bi) => Math.hypot(bi.x - tx, bi.z - tz) < tr * 0.95 && Math.hypot(bi.x - f.pos.x, bi.z - f.pos.z) < 230 && Math.hypot(bi.x - f.pos.x, bi.z - f.pos.z) > 25);
  if (b.personality === 'sniper') {
    let best: [number, number, number] | null = null;
    for (let i = 0; i < 30; i++) {
      const a = g.rng() * 6.28, r = 40 + g.rng() * 140;
      const x = f.pos.x + Math.cos(a) * r, z2 = f.pos.z + Math.sin(a) * r;
      if (Math.hypot(x - tx, z2 - tz) > tr * 0.9 || !w.landAt(x, z2)) continue;
      const h = w.heightAt(x, z2);
      if (!best || h > best[2]) best = [x, z2, h];
    }
    if (best) { goTo(g, f, best[0], best[1], 'roam'); b.mode = 'roam'; return; }
  }
  if (bs.length && g.rng() < 0.85) {
    const bi = pick(g.rng, bs);
    const l = g.lootNear(bi.x, bi.z, 14).find((q) => lootValue(g, f, q) > 0);
    if (l) goLoot(g, f, l); else goTo(g, f, bi.x, bi.z + bi.d / 2 + 3, 'roam');
  } else {
    const a = g.rng() * 6.28, r = Math.sqrt(g.rng()) * tr * 0.8;
    let x = tx + Math.cos(a) * r, z2 = tz + Math.sin(a) * r;
    if (!w.landAt(x, z2)) { x = tx; z2 = tz; }
    goTo(g, f, x, z2, 'roam');
  }
  b.mode = 'roam';
}

/* ---------------- thinking (staggered) ---------------- */
export function botThink(g: Game, f: Fighter) {
  const b = f.bot!;
  if (f.state !== 'ground') return;
  const now = g.time;
  // perception
  let best: Fighter | null = null, bd = 1e9;
  const viewBase = f.weapon && WEAPONS[f.weapon.id].cat === 'SNIPER' ? 190 : 105;
  eyeOf(f, _a);
  for (const o of g.fighters) {
    if (o === f || !o.alive || (o.state !== 'ground' && o.state !== 'chute' && o.state !== 'vehicle')) continue;
    if (o.dummy) continue;
    const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z;
    const d = Math.hypot(dx, dz);
    const vis = viewBase * (o.stance === 'prone' && o.state === 'ground' ? 0.45 : o.stance === 'crouch' && o.state === 'ground' ? 0.7 : 1) * (o.state === 'vehicle' ? 1.2 : 1);
    if (d > vis || Math.abs(o.pos.y - f.pos.y) > 120) continue;
    if (d > 9 && Math.abs(angDiff(f.yaw, Math.atan2(dx, dz))) > 1.25) continue;
    if (!canSee(g, f, o)) continue;
    if (d < bd) { bd = d; best = o; }
  }
  b.visible = !!best;
  if (best) {
    if (b.enemy !== best.id) { b.enemy = best.id; b.seenSince = now; }
    b.lastSeen = [best.pos.x, best.pos.z, now];
  } else if (b.enemy >= 0) {
    const o = g.fighters[b.enemy];
    if (!o.alive || !b.lastSeen || now - b.lastSeen[2] > 1.5) b.enemy = -1;
  }
  // auto attachments & weapon management
  if (now - b.switchT > 1.5) {
    for (const k in f.atts) if (f.atts[k] > 0) { for (let s = 0; s < 3; s++) if (f.slots[s] && attach(f, s, k)) break; }
    b.switchT = now;
    if (!f.weapon || (!hasAmmoFor(f, f.cur))) {
      for (let s = 0; s < 3; s++) if (hasAmmoFor(f, s)) { equipSlot(g, f, s); break; }
    }
  }
  const armed = hasAmmoFor(f, 0) || hasAmmoFor(f, 1) || hasAmmoFor(f, 2);
  const ehp = f.hp + f.armorHp * 0.6;
  const z = zoneInfo(g, f);
  const enemy = b.enemy >= 0 ? g.fighters[b.enemy] : null;
  // choose best weapon for the range
  if (enemy && b.visible && now - b.switchT > 0.2 && f.switchT <= 0 && f.reloadT <= 0) {
    const d = Math.hypot(enemy.pos.x - f.pos.x, enemy.pos.z - f.pos.z);
    let bs = -1, bsc = -1;
    for (let s = 0; s < 3; s++) {
      if (!hasAmmoFor(g.fighters[f.id], s)) continue;
      const def = WEAPONS[f.slots[s]!.id];
      const fit = weaponScore(def.id) * (1 - Math.min(0.85, Math.abs(d - def.range * 0.5) / (def.range * 1.4)));
      if (f.slots[s]!.mag <= 0) continue;
      if (fit > bsc) { bsc = fit; bs = s; }
    }
    if (bs >= 0 && bs !== f.cur && bsc > weaponScore(f.weapon?.id ?? 'strike9') * 0.1 + 1) { equipSlot(g, f, bs); b.switchT = now; }
  }

  const prev = b.mode;
  b.fightT -= 0; // timers are decremented in act
  // 1. dangerous zone takes priority unless in close fight
  const closeFight = enemy && b.visible && Math.hypot(enemy.pos.x - f.pos.x, enemy.pos.z - f.pos.z) < 22;
  if (z.urgent && !closeFight && g.zone.dmg > 0) {
    if (prev !== 'zone' || b.repathT <= 0) { goTo(g, f, z.gx, z.gz, 'zone'); b.mode = 'zone'; }
    return;
  }
  if (enemy && (b.visible || (b.lastSeen && now - b.lastSeen[2] < 2))) {
    const d = Math.hypot(enemy.pos.x - f.pos.x, enemy.pos.z - f.pos.z);
    const power = armed ? weaponScore(f.weapon?.id ?? 'strike9') : 0;
    let courage = { aggressive: 1.0, tactical: 0.75, looter: 0.5, defensive: 0.45, sniper: 0.6 }[b.personality];
    courage += (ehp - 70) / 160 + (power - 120) / 500 + b.skill * 0.25;
    if (!armed) {
      const l = bestLoot(g, f, d < 25 ? 22 : 45);
      if (l && lootValue(g, f, l) > 50) {
        if (b.mode !== 'loot' || b.lootTarget !== l.id || !b.path.length) goLoot(g, f, l);
        b.mode = 'loot'; return;
      }
    }
    const retreat = !armed || courage < 0.35;
    if (retreat) {
      if (b.mode !== 'cover' || !b.path.length || b.pathI >= b.path.length) { if (b.mode !== 'cover' || b.fightT > 3) findCover(g, f, enemy); }
      b.mode = 'cover'; return;
    }
    if ((courage < 0.62 && ehp < 55 && b.personality !== 'aggressive') || (f.hitT > 0 && !b.visible)) {
      if (b.mode !== 'cover') findCover(g, f, enemy);
      b.mode = 'cover'; return;
    }
    if (b.personality === 'sniper' && d < 30 && b.mode !== 'cover') { findCover(g, f, enemy); b.mode = 'cover'; return; }
    if (b.visible || b.mode === 'fight') {
      if (b.mode !== 'fight') { b.fightT = 0; b.strafeT = 0; }
      b.mode = 'fight';
      return;
    }
  }
  if (b.mode === 'cover' && b.coverPos && b.fightT < 4 + b.skill * 3) return;
  // heal
  if (!b.visible && f.healT <= 0 && (!b.lastSeen || now - b.lastSeen[2] > 3)) {
    const lim = b.personality === 'defensive' ? 80 : 62;
    if (f.hp < lim && (f.heal.medkit > 0 || (f.heal.bandage > 0 && f.hp < 75))) { b.mode = 'heal'; return; }
  }
  if (b.mode === 'heal' && f.healT > 0) return;
  // zone (planned)
  if (z.want) {
    if (prev !== 'zone' || b.repathT <= 0 || !b.goal) { goTo(g, f, z.gx, z.gz, 'zone'); }
    b.mode = 'zone';
    return;
  }
  // hunt
  if (b.lastSeen && now - b.lastSeen[2] < 9 && (b.personality === 'aggressive' || b.personality === 'tactical') && armed && ehp > 55) {
    if (prev !== 'hunt') goTo(g, f, b.lastSeen[0], b.lastSeen[1], 'hunt');
    b.mode = 'hunt';
    return;
  }
  if (b.heardPos && now - b.heardPos[2] < 8 && armed && ehp > 60 && (b.personality === 'aggressive' || (b.personality === 'tactical' && g.rng() < 0.4))) {
    if (prev !== 'hunt') goTo(g, f, b.heardPos[0], b.heardPos[1], 'hunt');
    b.mode = 'hunt';
    return;
  }
  // loot
  const needy = !f.slots[0] && !f.slots[1];
  const R = needy ? 140 : b.personality === 'looter' ? 95 : 60;
  if (b.mode === 'loot' && b.lootTarget >= 0 && g.lootById.has(b.lootTarget) && b.path.length) return;
  const l = bestLoot(g, f, R);
  if (l) { goLoot(g, f, l); b.mode = 'loot'; return; }
  b.lootTarget = -1;
  if (b.mode === 'roam' && b.path.length && b.pathI < b.path.length) return;
  pickRoam(g, f);
}

function findCover(g: Game, f: Fighter, enemy: Fighter) {
  const b = f.bot!;
  b.fightT = 0;
  let best: [number, number] | null = null, bd = 1e9;
  eyeOf(enemy, _a);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 6.283 + g.rng() * 0.5, r = 5 + g.rng() * 11;
    const x = f.pos.x + Math.cos(a) * r, z = f.pos.z + Math.sin(a) * r;
    const gh = groundAt(g.world, x, z, f.pos.y, 0.6, 0.4);
    if (gh < -0.3 || Math.abs(gh - f.pos.y) > 1.5) continue;
    if (hasLOS(g.world, _a.x, _a.y, _a.z, x, gh + 1.0, z)) continue;
    if (r < bd) { bd = r; best = [x, z]; }
  }
  if (best) { b.coverPos = best; setPath(g, f, [best], 'cover'); }
  else {
    // no cover: run away from enemy
    const a = Math.atan2(f.pos.x - enemy.pos.x, f.pos.z - enemy.pos.z) + (g.rng() - 0.5) * 1.2;
    const x = f.pos.x + Math.sin(a) * 25, z = f.pos.z + Math.cos(a) * 25;
    b.coverPos = [x, z]; setPath(g, f, [[x, z]], 'cover');
  }
}

/* ---------------- acting (every frame / slow tick) ---------------- */
export function botAct(g: Game, f: Fighter, dt: number) {
  const b = f.bot!, c = f.cmd;
  c.fire = false; c.jump = false; c.reload = false; c.aim = false; c.sprint = false; c.aimDir = null; c.crouch = false; c.prone = false; c.mx = 0; c.mz = 0;
  if (f.state !== 'ground') return;
  b.fightT += dt;
  b.grenadeCd -= dt;
  const enemy = b.enemy >= 0 ? g.fighters[b.enemy] : null;
  const w = f.weapon;
  let wantMove = false;

  switch (b.mode) {
    case 'fight': {
      if (!enemy || !enemy.alive) { b.mode = 'roam'; break; }
      const dx = enemy.pos.x - f.pos.x, dz = enemy.pos.z - f.pos.z;
      const dist = Math.hypot(dx, dz);
      const ty = enemy.state === 'ground' && enemy.stance === 'prone' ? 0.4 : enemy.state === 'ground' && enemy.stance === 'crouch' ? 0.9 : 1.2;
      const targetYaw = Math.atan2(dx, dz);
      turnTo(f, targetYaw, 3 + b.skill * 7, dt);
      const dy = enemy.pos.y + ty - (f.pos.y + f.eyeY);
      const tp = Math.atan2(dy, dist);
      f.pitch += clamp(tp - f.pitch, -6 * dt, 6 * dt);
      const ideal = desiredRange(f);
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeDir = Math.random() < 0.5 ? 1 : -1; b.strafeT = rand(Math.random, 0.8, 2.4); }
      // movement relative to target
      let fwd = 0;
      if (dist > ideal * 1.3) fwd = 1; else if (dist < ideal * 0.55) fwd = -1;
      if (b.personality === 'aggressive' && dist > 6) fwd = Math.max(fwd, 0.6);
      if (b.personality === 'sniper' && dist > ideal * 0.6) fwd = 0;
      const isSniper = w && WEAPONS[w.id].cat === 'SNIPER';
      let strafe = isSniper && dist > 50 ? 0 : b.strafeDir * (0.6 + b.skill * 0.4);
      if (!b.visible) { fwd = 0.7; strafe = 0; }
      // convert to local (mx right, mz forward) relative to yaw (we face target)
      c.mz = fwd; c.mx = strafe;
      if (b.personality !== 'aggressive' && (b.personality === 'defensive' || b.personality === 'tactical' || isSniper) && dist > 22 && fwd <= 0) c.crouch = true;
      if (b.personality === 'aggressive' && Math.random() < 0.004) c.jump = true;
      c.sprint = false;
      wantMove = Math.abs(fwd) + Math.abs(strafe) > 0.1;
      // shooting
      if (w) {
        const def = WEAPONS[w.id];
        const reacted = g.time - b.seenSince > b.react;
        const aimErrYaw = Math.abs(angDiff(f.yaw, targetYaw));
        c.aim = dist > 14 && f.speedSm < 2.5;
        const flashed = f.flashT > 0;
        if (w.mag <= 0 && f.ammo[def.ammo] <= 0) {
          // swap or run
        } else if (w.mag < Math.max(2, def.mag * 0.08) && f.ammo[def.ammo] > 0 && dist > 20 && !b.visible) c.reload = true;
        if (b.visible && reacted && aimErrYaw < 0.14 && dist < def.range * 1.6 && !flashed && f.switchT <= 0) {
          const auto = def.mode === 'auto';
          if (b.burstPause > 0) b.burstPause -= dt;
          else {
            if (b.burstT <= 0) b.burstT = auto ? rand(Math.random, 0.35, 1.3) : 0.2;
            b.burstT -= dt;
            c.fire = true;
            if (b.burstT <= 0) b.burstPause = auto ? rand(Math.random, 0.12, 0.55) * (1.4 - b.skill) : isSniper ? 0.4 : 0.1;
          }
          // aim point with error
          const head = b.skill > 0.6 && Math.random() < 0.04 * b.skill * 10 * 0.1;
          const tx = enemy.pos.x, ty2 = enemy.pos.y + (head ? ty + 0.5 : ty), tz = enemy.pos.z;
          const mx = f.pos.x, my = f.pos.y + f.eyeY - 0.1, mz = f.pos.z;
          const ex = tx - mx, ey = ty2 - my, ez = tz - mz;
          const l = Math.hypot(ex, ey, ez);
          const err = ((1 - b.skill) * 0.045 + dist * 0.0004 * (1.2 - b.skill) + enemy.speedSm * 0.0035 * (1.1 - b.skill) + (f.speedSm > 1 ? 0.015 : 0)) * (c.aim ? 0.7 : 1);
          const ox = (Math.random() - 0.5) * 2 * err * l, oy = (Math.random() - 0.5) * 2 * err * l, oz = (Math.random() - 0.5) * 2 * err * l;
          // lead moving targets slightly
          const lead = Math.min(0.4, l / Math.max(120, def.speed));
          c.aimDir = new Vector3(ex + ox + enemy.vel.x * lead * b.skill, ey + oy, ez + oz + enemy.vel.z * lead * b.skill).normalize();
          if (enemy.dummy) c.aimDir = new Vector3(ex, ey, ez).normalize();
        }
      }
      // grenades
      if (b.grenadeCd <= 0 && dist > 12 && dist < 34 && (f.throws.frag > 0 || f.throws.flash > 0) && (b.personality === 'tactical' || b.personality === 'aggressive' || !b.visible) && Math.random() < 0.02) {
        const type = f.throws.frag > 0 ? 'frag' : 'flash';
        const tgt = b.lastSeen ?? [enemy.pos.x, enemy.pos.z, 0];
        const gx = tgt[0] - f.pos.x, gz = tgt[1] - f.pos.z, gl = Math.hypot(gx, gz) || 1;
        c.aimDir = new Vector3(gx / gl, 0.15 + gl * 0.012, gz / gl).normalize();
        turnTo(f, Math.atan2(gx, gz), 20, 1);
        if (startThrow(g, f, type)) b.grenadeCd = rand(Math.random, 8, 18);
      }
      if (!b.visible && b.lastSeen && g.time - b.lastSeen[2] > 3) { b.mode = 'hunt'; goTo(g, f, b.lastSeen[0], b.lastSeen[1], 'hunt'); }
      break;
    }
    case 'cover': {
      c.crouch = false;
      wantMove = follow(g, f, dt, true);
      if (!wantMove) {
        c.crouch = true;
        if (w && w.mag < WEAPONS[w.id].mag * 0.6) c.reload = true;
        if (enemy) turnTo(f, Math.atan2(enemy.pos.x - f.pos.x, enemy.pos.z - f.pos.z), 3, dt);
        if (f.hp < 60 && f.healT <= 0 && !b.visible) { if (f.heal.medkit > 0) startHeal(g, f, 'medkit'); else if (f.heal.bandage > 0) startHeal(g, f, 'bandage'); }
        if (b.fightT > 5 + b.skill * 3 || (b.visible && b.fightT > 1.5 && f.hp > 45)) { b.mode = b.visible ? 'fight' : 'roam'; b.coverPos = null; }
      }
      break;
    }
    case 'heal': {
      c.crouch = true;
      if (f.healT <= 0) { if (f.hp < 62 && f.heal.medkit > 0) startHeal(g, f, 'medkit'); else if (f.hp < 75 && f.heal.bandage > 0) startHeal(g, f, 'bandage'); else b.mode = 'roam'; }
      break;
    }
    case 'loot': {
      wantMove = follow(g, f, dt, false);
      const l = g.lootById.get(b.lootTarget);
      if (!l) { b.mode = 'roam'; b.lootTarget = -1; break; }
      const d = Math.hypot(l.x - f.pos.x, l.z - f.pos.z);
      if (d < 1.9 && Math.abs(l.y - f.pos.y) < 3.5) {
        g.botPickup(f, l);
        b.mode = 'roam'; b.lootTarget = -1; b.path = [];
        b.noLootT = 0;
        if (g.lootById.has(l.id)) b.skip[l.id] = g.time + 120;
      } else if (!wantMove && b.path.length) { b.mode = 'roam'; }
      if (w && w.mag < WEAPONS[w.id].mag * 0.35 && f.ammo[WEAPONS[w.id].ammo] > 0 && !b.visible) c.reload = true;
      break;
    }
    case 'zone': {
      wantMove = follow(g, f, dt, true);
      if (!wantMove) { b.mode = 'roam'; }
      if (w && w.mag < WEAPONS[w.id].mag * 0.3) c.reload = true;
      break;
    }
    case 'hunt': {
      wantMove = follow(g, f, dt, g.time - (b.lastSeen?.[2] ?? 0) > 3);
      c.aim = false;
      if (!wantMove) { b.mode = 'roam'; b.lastSeen = null; }
      break;
    }
    case 'roam': default: {
      wantMove = follow(g, f, dt, false);
      if (!wantMove) { b.wanderT -= dt; if (b.wanderT <= 0) { b.wanderT = 1.2; pickRoam(g, f); } }
      if (w && w.mag < WEAPONS[w.id].mag * 0.5 && f.ammo[WEAPONS[w.id].ammo] > 0 && !b.visible) c.reload = true;
      break;
    }
  }
  if (c.reload && f.reloadT <= 0) startReload(g, f);
  c.reload = false;
  updateStuck(g, f, dt, wantMove);
  void weaponStats; void ATTACHMENTS;
}

export function botHear(f: Fighter, x: number, z: number, now: number) {
  const b = f.bot;
  if (!b) return;
  b.heardPos = [x + (Math.random() - 0.5) * 20, z + (Math.random() - 0.5) * 20, now];
}
