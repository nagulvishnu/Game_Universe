import { MOVE } from '../data/config';
import { WEAPONS } from '../data/weapons';
import { groundAt, moveBody, moveRes } from '../world/colliders';
import { clamp, angDiff } from '../util';
import { Fighter } from './types';
import { damage } from './combat';
import type { Game } from './Game';

export const RADIUS = 0.4;

/** Push a body out of any solid it overlaps (used after parachute landings). */
export function popOut(g: Game, f: Fighter) {
  const b = g.world.grid.boxes;
  const list = g.world.grid.at(f.pos.x, f.pos.z);
  for (let k = 0; k < list.length; k++) {
    const i = list[k] * 6;
    if (f.pos.x + RADIUS > b[i] && f.pos.x - RADIUS < b[i + 3] && f.pos.z + RADIUS > b[i + 2] && f.pos.z - RADIUS < b[i + 5] && f.pos.y + 0.8 > b[i + 1] && f.pos.y + 0.1 < b[i + 4]) {
      f.pos.y = b[i + 4] + 0.02;
    }
  }
}

export function stepGround(g: Game, f: Fighter, dt: number) {
  const c = f.cmd;
  const w = f.weapon;
  f.stance = c.prone ? 'prone' : c.crouch ? 'crouch' : 'stand';
  let spd = f.stance === 'prone' ? MOVE.prone : f.stance === 'crouch' ? MOVE.crouch : MOVE.run;
  const wantSprint = c.sprint && c.mz > 0.3 && f.stance === 'stand' && !c.aim && f.healT <= 0 && f.throwT <= 0;
  f.sprinting = wantSprint && f.grounded;
  if (f.sprinting) spd = MOVE.sprint * (w ? 0.5 + 0.5 * WEAPONS[w.id].moveMul : 1.08);
  else spd *= w ? WEAPONS[w.id].moveMul : 1.06;
  if (c.aim && !f.sprinting) spd *= MOVE.aimMul;
  if (f.healT > 0) spd *= 0.55;
  if (f.reloadT > 0) spd *= 0.92;
  if (f.inWater) spd *= MOVE.water;
  const s = Math.sin(f.yaw), co = Math.cos(f.yaw);
  let wx = s * c.mz - co * c.mx, wz = co * c.mz + s * c.mx;
  const l = Math.hypot(wx, wz);
  if (l > 1) { wx /= l; wz /= l; }
  const tx = wx * spd, tz = wz * spd;
  const acc = (f.grounded ? (l > 0.01 ? MOVE.accel : MOVE.accel * 1.3) : MOVE.airAccel) * dt;
  f.vel.x += clamp(tx - f.vel.x, -acc, acc);
  f.vel.z += clamp(tz - f.vel.z, -acc, acc);
  if (c.jump && f.grounded && f.stance !== 'prone') { f.vel.y = MOVE.jump * (f.inWater ? 0.6 : 1); f.grounded = false; }
  const px = f.pos.x, pz = f.pos.z;
  const wasG = f.grounded;
  const r = moveBody(g.world, f.pos, f.vel, RADIUS, f.height, MOVE.stepUp, dt, wasG);
  f.grounded = r.grounded;
  if (r.grounded && !wasG) {
    if (r.impact > 5) { f.landT = 0.35; g.sound({ k: 'land', x: f.pos.x, y: f.pos.y, z: f.pos.z }); }
    if (r.impact > MOVE.fallDmgSpeed) damage(g, f, (r.impact - MOVE.fallDmgSpeed) * 7, 'body', null, 'fall', 'fall');
  }
  f.inWater = f.pos.y < -0.15 && g.world.heightAt(f.pos.x, f.pos.z) < -0.15 && f.grounded;
  const moved = Math.hypot(f.pos.x - px, f.pos.z - pz);
  f.distance += moved;
  const hs = moved / Math.max(dt, 1e-4);
  f.speedSm += (hs - f.speedSm) * Math.min(1, dt * 10);
  f.moving = f.speedSm > 0.4;
  f.stride += moved * (f.sprinting ? 0.95 : 1.1);
  if (f.grounded && moved > 0.001) {
    f.stepT -= moved;
    if (f.stepT <= 0) {
      f.stepT += f.sprinting ? 3.4 : f.stance === 'stand' ? 2.7 : 2;
      if (f.stance !== 'prone') g.stepSound(f);
    }
  }
}

export function stepAir(g: Game, f: Fighter, dt: number, chuteAlt: number, autoOpen = true) {
  const c = f.cmd;
  const s = Math.sin(f.yaw), co = Math.cos(f.yaw);
  const gh = groundAt(g.world, f.pos.x, f.pos.z, f.pos.y + 1.2, 1.2, RADIUS);
  const agl = f.pos.y - gh;
  if (f.state === 'freefall') {
    f.freefallT += dt;
    const dive = c.mz > 0 ? 34 : c.mz < 0 ? 6 : 14;
    const tx = (s * Math.max(c.mz, 0.0) * dive) + (s * (c.mz === 0 ? 8 : 0)) - co * c.mx * 12;
    const tz = (co * Math.max(c.mz, 0.0) * dive) + (co * (c.mz === 0 ? 8 : 0)) + s * c.mx * 12;
    f.vel.x += (tx - f.vel.x) * Math.min(1, dt * 1.6);
    f.vel.z += (tz - f.vel.z) * Math.min(1, dt * 1.6);
    const tvy = c.mz > 0 ? -58 : -48;
    f.vel.y += (tvy - f.vel.y) * Math.min(1, dt * 1.2);
    if ((autoOpen && agl < chuteAlt) || (f.isPlayer && c.jump && f.freefallT > 1.2 && agl > 70)) {
      f.state = 'chute'; f.chuteOpen = true;
      g.sound({ k: 'chute', x: f.pos.x, y: f.pos.y, z: f.pos.z });
    }
  } else {
    const sp = c.mz > 0 ? 14 : c.mz < 0 ? 5 : 8;
    const tx = s * c.mz * sp - co * c.mx * 9 + (c.mz === 0 ? s * 3 : 0);
    const tz = co * c.mz * sp + s * c.mx * 9 + (c.mz === 0 ? co * 3 : 0);
    f.vel.x += (tx - f.vel.x) * Math.min(1, dt * 1.5);
    f.vel.z += (tz - f.vel.z) * Math.min(1, dt * 1.5);
    const tvy = c.mz < 0 ? -6 : c.mz > 0 ? -9.5 : -7.5;
    f.vel.y += (tvy - f.vel.y) * Math.min(1, dt * 2.2);
  }
  f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt; f.pos.y += f.vel.y * dt;
  const ng = groundAt(g.world, f.pos.x, f.pos.z, f.pos.y + 1.2, 1.2, RADIUS);
  const lim = g.world.half - 3;
  f.pos.x = clamp(f.pos.x, -lim, lim); f.pos.z = clamp(f.pos.z, -lim, lim);
  f.bodyYaw += angDiff(f.bodyYaw, f.yaw) * Math.min(1, dt * 6);
  if (f.pos.y <= ng + 0.02) {
    f.pos.y = ng;
    f.state = 'ground'; f.vel.set(0, 0, 0); f.grounded = true; f.landT = 0.6; f.chuteOpen = false; f.landedAt = g.time;
    popOut(g, f);
    g.sound({ k: 'land', x: f.pos.x, y: f.pos.y, z: f.pos.z });
    g.fx({ k: 'dust', x: f.pos.x, y: f.pos.y, z: f.pos.z });
    if (g.world.heightAt(f.pos.x, f.pos.z) < -2.5 && g.mode === 'match') damage(g, f, 3, 'body', null, 'fall', 'fall');
  }
  void moveRes;
}
