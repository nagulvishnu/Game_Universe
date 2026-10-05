import type { Game } from './game';
import type { Actor, Loot } from './actor';
import { WEAPONS } from './data';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angDiff = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function initBot(g: Game, a: Actor, jumpAt: number) {
  a.ai = {
    state: 'roam', think: Math.random() * 0.3, tx: 0, tz: 0, target: null, los: false,
    strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, loot: null, stuck: 0, lx: 0, lz: 0,
    unstuck: 0, ux: 0, uz: 0, react: 0, grenCd: 5 + Math.random() * 6, jumpAt,
    landX: 0, landZ: 0, stage: 0, navKey: -99, skill: g.botSkill * (0.75 + Math.random() * 0.5),
    roamT: 0, healT: 0, speed: 0,
  };
}

function hasLos(g: Game, b: Actor, e: Actor): boolean {
  const dx = e.x - b.x, dy = e.y + 1.2 - 1.5, dz = e.z - b.z;
  const l = Math.hypot(dx, dy, dz) || 1;
  return g.world.ray(b.x, 1.5, b.z, dx / l, dy / l, dz / l, l) >= l - 0.5;
}

function findLoot(g: Game, b: Actor, range: number): Loot | null {
  let best: Loot | null = null, bs = 1e9;
  const minTier = Math.min(b.guns[0] ? WEAPONS[b.guns[0].id].tier : -1, b.guns[1] ? WEAPONS[b.guns[1].id].tier : -1);
  for (const l of g.loot) {
    if (l.taken) continue;
    const dx = l.x - b.x, dz = l.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d > range) continue;
    let want = false;
    switch (l.kind) {
      case 'weapon': {
        const def = WEAPONS[l.wid!];
        if (def.kind === 'gun') want = def.tier > minTier;
        else want = def.tier > WEAPONS[b.melee].tier;
        break;
      }
      case 'medkit': want = b.medkits < 2; break;
      case 'shield': want = b.armor < 40; break;
      case 'grenade': want = b.gren < 2; break;
      case 'bomb': want = b.bomb < 1; break;
    }
    if (!want) continue;
    const s = d - l.rarity * 8;
    if (s < bs) { bs = s; best = l; }
  }
  return best;
}

function pickRoam(g: Game, b: Actor) {
  const ai = b.ai!;
  const z = g.zone;
  let cx = z.tx, cz = z.tz, r = z.tr;
  if (z.stage === 'final') { cx = z.cx; cz = z.cz; r = z.r; }
  const p = g.player;
  if (Math.random() < 0.22 && p.alive && p.phase === 'ground') { cx = p.x; cz = p.z; r = 30; }
  const a = Math.random() * 6.28;
  const rr = Math.sqrt(Math.random()) * Math.max(3, r * 0.75);
  const h = g.mode.half;
  ai.tx = clamp(cx + Math.cos(a) * rr, -h, h);
  ai.tz = clamp(cz + Math.sin(a) * rr, -h, h);
  ai.roamT = rnd(6, 12);
}

function think(g: Game, b: Actor) {
  const ai = b.ai!;
  const z = g.zone;
  const zd = Math.hypot(b.x - z.cx, b.z - z.cz);
  const def = WEAPONS[b.weaponId];
  const sight = def.id === 'sniper' ? 95 : def.kind === 'melee' ? 42 : 62;
  const dist = (e: Actor) => Math.hypot(e.x - b.x, e.z - b.z);
  let best: Actor | null = null, bd = 1e9;
  for (const e of g.actors) {
    if (e === b || !e.alive || e.phase === 'plane' || e.phase === 'fall' || e.phase === 'chute') continue;
    const d = dist(e);
    if (d < sight && d < bd) { bd = d; best = e; }
  }
  let tgt: Actor | null = ai.target && ai.target.alive && ai.target.phase !== 'plane' && dist(ai.target) < sight * 1.4 ? ai.target : null;
  let tl = tgt ? hasLos(g, b, tgt) : false;
  if ((!tgt || !tl) && best && best !== tgt) {
    const bl = hasLos(g, b, best);
    if (bl || !tgt) { tgt = best; tl = bl; }
  }
  if (tgt !== ai.target) ai.react = Math.max(ai.react, rnd(0.15, 0.4) * (1.2 - Math.min(1, ai.skill) * 0.6) * (g.diff === 'hard' ? 0.5 : 1));
  ai.target = tgt;
  ai.los = tl;
  const td = tgt ? dist(tgt) : 999;

  const outNow = zd > z.r - 5;
  const nextOut = Math.hypot(b.x - z.tx, b.z - z.tz) > z.tr - 8 && (z.stage === 'shrink' || z.dur - z.t < 14);
  const unarmed = b.bestGunTier === 0 && !g.mode.meleeOnly;
  const fighting = tgt && (tl || td < 30) && !(unarmed && td > 14 && !(ai.loot === null && findLoot(g, b, 60) === null));
  let next: typeof ai.state;
  if (outNow && (zd > z.r + 4 || !fighting)) next = 'zone';
  else if (nextOut && !(fighting && td < 28)) next = 'zone';
  else if (fighting) next = 'fight';
  else if (b.hp < 62 && b.medkits > 0 && !(tgt && td < 40)) next = 'heal';
  else {
    next = 'roam';
    const hasGun = b.bestGunTier > 0;
    if (!ai.loot || ai.loot.taken) {
      ai.loot = findLoot(g, b, hasGun ? 38 : g.mode.meleeOnly ? 60 : 110);
    }
    if (ai.loot) next = 'loot';
  }
  if (next !== ai.state) {
    if (ai.state === 'heal') ai.healT = 0;
    ai.state = next;
    if (next === 'roam') ai.roamT = 0;
  }
  // grenades
  if (tgt && tl && ai.grenCd <= 0 && td > 12 && td < 42 && ai.react <= 0 && (b.gren > 0 || b.bomb > 0)) {
    const useBomb = b.bomb > 0 && (b.gren === 0 || Math.random() < 0.3) && td > 20;
    const th = 0.6;
    const R = td * rnd(0.94, 1.06);
    const v = clamp(Math.sqrt((R * 24) / Math.sin(2 * th)), 8, 34);
    const dx = (tgt.x - b.x) / td, dz = (tgt.z - b.z) / td;
    b.yaw = Math.atan2(-dx, -dz);
    g.throwThrowable(b, useBomb ? 'bomb' : 'grenade', dx * Math.cos(th), Math.sin(th), dz * Math.cos(th), v);
    ai.grenCd = rnd(7, 13);
  }
}

function nav(g: Game, b: Actor, tx: number, tz: number): [number, number] {
  const ai = b.ai!;
  const w = g.world;
  const bi = w.buildingAt(tx, tz, 0);
  const bm = w.buildingAt(b.x, b.z, 0.2);
  if (bi === bm) return [tx, tz];
  const key = bm * 1000 + bi;
  if (ai.navKey !== key) { ai.navKey = key; ai.stage = 0; }
  if (bm >= 0) {
    const B = w.buildings[bm];
    if (ai.stage === 0) {
      if (Math.hypot(b.x - B.inX, b.z - B.inZ) < 1.1) ai.stage = 1;
      return [B.inX, B.inZ];
    }
    return [B.outX, B.outZ];
  }
  const B = w.buildings[bi];
  if (ai.stage === 0) {
    if (Math.hypot(b.x - B.outX, b.z - B.outZ) < 1.3) ai.stage = 1;
    return [B.outX, B.outZ];
  }
  return [B.inX, B.inZ];
}

function act(g: Game, b: Actor, dt: number) {
  const ai = b.ai!;
  const z = g.zone;
  let wx = 0, wz = 0, spd = 0;
  let facing = false;
  const WALK = 4.8, RUN = 7.2;

  if (ai.state !== 'heal') ai.healT = 0;

  if (ai.state === 'fight' && ai.target) {
    const e = ai.target;
    const def = WEAPONS[b.weaponId];
    const dx = e.x - b.x, dz = e.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    const ty = Math.atan2(-dx, -dz);
    const diff = angDiff(ty - b.yaw);
    const turn = 4.5 + Math.min(1.2, ai.skill) * 4;
    b.yaw += clamp(diff, -turn * dt, turn * dt);
    b.pitch = Math.atan2(e.y + 1.2 - (b.y + 1.5), d);
    facing = true;
    const pref = def.kind === 'melee' ? 1.2 : def.id === 'shotgun' ? 9 : def.id === 'smg' ? 16 : def.id === 'pistol' ? 18 : def.id === 'ar' ? 28 : 55;
    if (ai.unstuck <= 0) {
      if (d > pref + 6 || (!ai.los && d > 4)) {
        const [nx, nz] = ai.los ? [e.x, e.z] : nav(g, b, e.x, e.z);
        const ddx = nx - b.x, ddz = nz - b.z, dd = Math.hypot(ddx, ddz) || 1;
        wx = ddx / dd; wz = ddz / dd; spd = def.kind === 'melee' ? RUN : WALK + 1.2;
      } else if (d < pref - 5 && def.kind !== 'melee') {
        wx = -dx / d; wz = -dz / d; spd = WALK;
      } else if (def.kind !== 'melee') {
        if (ai.strafeT <= 0) { ai.strafe = -ai.strafe; ai.strafeT = rnd(0.7, 1.7); }
        wx = (-dz / d) * ai.strafe; wz = (dx / d) * ai.strafe; spd = WALK * 0.75;
      }
    }
    if (def.kind === 'gun') {
      if (ai.los && ai.react <= 0 && Math.abs(diff) < 0.28) g.botShoot(b, e.x, e.y + 1.2, e.z, ai.skill);
    } else if (d < def.range + 0.2 && Math.abs(diff) < 0.7 && b.cd <= 0 && ai.react <= 0) {
      g.meleeAttack(b);
    }
  } else if (ai.state === 'heal') {
    b.pitch = 0;
    if (ai.healT <= 0) ai.healT = 1.6;
    ai.healT -= dt;
    if (ai.healT <= 0.001) {
      b.hp = Math.min(100, b.hp + 55);
      b.medkits--;
      ai.healT = 0;
      ai.state = 'roam';
    }
  } else {
    b.pitch = 0;
    let tx = 0, tz = 0;
    if (ai.state === 'zone') {
      const a = b.id * 2.4;
      tx = z.tx + Math.cos(a) * z.tr * 0.45;
      tz = z.tz + Math.sin(a) * z.tr * 0.45;
      spd = RUN;
    } else if (ai.state === 'loot' && ai.loot && !ai.loot.taken) {
      tx = ai.loot.x; tz = ai.loot.z;
      spd = RUN * 0.9;
      if (Math.hypot(tx - b.x, tz - b.z) < 1.5) {
        g.pickupBot(b, ai.loot);
        ai.loot = null;
        ai.state = 'roam';
      }
    } else {
      ai.roamT -= dt;
      if (ai.roamT <= 0 || Math.hypot(ai.tx - b.x, ai.tz - b.z) < 3) pickRoam(g, b);
      tx = ai.tx; tz = ai.tz;
      spd = WALK * 1.15;
    }
    if (ai.unstuck <= 0 && spd > 0) {
      const [nx, nz] = nav(g, b, tx, tz);
      const dx = nx - b.x, dz = nz - b.z, d = Math.hypot(dx, dz) || 1;
      wx = dx / d; wz = dz / d;
      if (d < 0.6) spd = 0;
    }
  }

  if (ai.unstuck > 0) {
    wx = ai.ux; wz = ai.uz; spd = RUN * 0.8;
  }

  const ox = b.x, oz = b.z;
  if (spd > 0 && (wx !== 0 || wz !== 0)) {
    b.x += wx * spd * dt;
    b.z += wz * spd * dt;
    const p = { x: b.x, z: b.z };
    g.world.resolve(p, 0.5);
    b.x = p.x; b.z = p.z;
    ai.speed = spd;
    if (!facing) {
      const ty = Math.atan2(-wx, -wz);
      b.yaw += clamp(angDiff(ty - b.yaw), -9 * dt, 9 * dt);
    }
    const moved = Math.hypot(b.x - ox, b.z - oz);
    if (moved < spd * dt * 0.3) ai.stuck += dt;
    else ai.stuck = Math.max(0, ai.stuck - dt);
    if (ai.stuck > 0.8) {
      ai.stuck = 0;
      ai.unstuck = rnd(0.6, 1.1);
      const a = Math.atan2(wz, wx) + (Math.random() < 0.5 ? 1 : -1) * rnd(1.2, 2.4);
      ai.ux = Math.cos(a);
      ai.uz = Math.sin(a);
      ai.roamT = 0;
      ai.stage = 0;
      if (ai.state === 'loot') ai.loot = null;
    }
  } else {
    ai.speed = 0;
  }
}

export function updateBot(g: Game, b: Actor, dt: number) {
  const ai = b.ai!;
  if (b.phase === 'plane') return;
  if (b.phase === 'fall' || b.phase === 'chute') {
    const dx = ai.landX - b.x, dz = ai.landZ - b.z;
    const d = Math.hypot(dx, dz);
    const sp = b.phase === 'fall' ? 24 : 13;
    if (d > 3) { b.vx = (dx / d) * sp; b.vz = (dz / d) * sp; }
    else { b.vx *= 0.9; b.vz *= 0.9; }
    b.vy = b.phase === 'fall' ? -48 : -11;
    b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    if (d > 1) b.yaw = Math.atan2(-dx, -dz);
    if (b.phase === 'fall' && b.y < 52) b.phase = 'chute';
    if (b.y <= 0) {
      g.land(b);
      const p = { x: b.x, z: b.z };
      g.world.resolve(p, 0.5);
      b.x = p.x; b.z = p.z;
      ai.think = rnd(0.1, 0.5);
    }
    return;
  }
  if (b.phase !== 'ground') return;
  ai.react -= dt;
  ai.grenCd -= dt;
  ai.strafeT -= dt;
  ai.unstuck -= dt;
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = 0.2 + Math.random() * 0.15;
    think(g, b);
  }
  act(g, b, dt);
}
