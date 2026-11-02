import { Vector3 } from 'three';
import { moveBody, moveRes } from '../world/colliders';
import { damage, explode } from './combat';
import { Fighter, Vehicle } from './types';
import type { Game } from './Game';

export const VEH = {
  jeep: { name: 'Off-road Jeep', max: 25, acc: 11, hp: 280, steer: 1.5, radius: 1.5, h: 1.6, grip: 0.9 },
  sports: { name: 'Sports Car', max: 40, acc: 17, hp: 200, steer: 1.9, radius: 1.3, h: 1.2, grip: 0.8 },
  bike: { name: 'Motorcycle', max: 32, acc: 15, hp: 130, steer: 2.3, radius: 0.55, h: 1.5, grip: 0.95 },
};

let vid = 1;
export function spawnVehicle(g: Game, type: Vehicle['type'], x: number, z: number, yaw: number) {
  const d = VEH[type];
  const v: Vehicle = { id: vid++, type, pos: new Vector3(x, g.world.heightAt(x, z) + 0.3, z), vel: new Vector3(), yaw, speed: 0, steer: 0, pitch: 0, roll: 0, hp: d.hp, maxHp: d.hp, driver: null, dead: false, burnT: 0, grounded: true, wheel: 0 };
  g.vehicles.push(v);
  return v;
}

export function enterVehicle(g: Game, f: Fighter, v: Vehicle) {
  if (v.dead || v.driver || f.state !== 'ground') return;
  v.driver = f; f.vehicle = v; f.state = 'vehicle'; f.reloadT = 0; f.healT = 0;
}

export function exitVehicle(g: Game, f: Fighter) {
  const v = f.vehicle;
  if (!v) return;
  const r = VEH[v.type].radius + 0.9;
  const rx = -Math.cos(v.yaw), rz = Math.sin(v.yaw);
  f.pos.set(v.pos.x + rx * r, v.pos.y, v.pos.z + rz * r);
  f.pos.y = Math.max(f.pos.y, g.world.heightAt(f.pos.x, f.pos.z));
  f.vel.set(v.vel.x * 0.5, 0, v.vel.z * 0.5);
  f.state = 'ground'; f.vehicle = null; v.driver = null; f.grounded = true;
  f.yaw = v.yaw;
}

export function damageVehicle(g: Game, v: Vehicle, amt: number, by: Fighter | null) {
  if (v.dead) return;
  v.hp -= amt;
  if (v.hp <= 0) {
    v.hp = 0; v.dead = true; v.burnT = 0;
    const drv = v.driver;
    if (drv) { exitVehicle(g, drv); drv.vel.y = 5; }
    explode(g, v.pos.x, v.pos.y + 0.8, v.pos.z, 9, 95, by ?? drv, 'Exploding Vehicle');
    v.speed = 0;
  }
}

export function updateVehicle(g: Game, v: Vehicle, dt: number) {
  const d = VEH[v.type];
  if (v.dead) { v.burnT += dt; v.vel.set(0, 0, 0); return; }
  const drv = v.driver;
  const c = drv ? drv.cmd : null;
  const thr = c ? c.mz : 0, st = c ? c.mx : 0, hb = c ? c.jump : false;
  if (thr > 0) v.speed += d.acc * thr * dt * (1 - Math.max(0, v.speed) / (d.max * 1.08));
  else if (thr < 0) { if (v.speed > 0.5) v.speed -= d.acc * 2.4 * dt; else v.speed = Math.max(-9, v.speed + d.acc * 0.6 * thr * dt); }
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (2.2 + Math.abs(v.speed) * 0.08) * dt);
  if (hb) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 22 * dt);
  const th = g.world.heightAt(v.pos.x, v.pos.z);
  if (th < -0.5 && v.grounded) v.speed *= 1 - Math.min(1, 1.8 * dt);
  v.steer += (st - v.steer) * Math.min(1, dt * 7);
  const rate = d.steer * (1 - Math.min(0.6, Math.abs(v.speed) / d.max * 0.6)) * Math.min(1, Math.abs(v.speed) / 4);
  v.yaw -= v.steer * rate * dt * Math.sign(v.speed || 1) * (hb ? 1.4 : 1);
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  // lateral grip
  const lat = v.vel.x * -fz + v.vel.z * fx;
  const slip = lat * (1 - Math.pow(1 - d.grip, dt * 10 + (hb ? 0 : 0.5)));
  v.vel.x = fx * v.speed + (-fz) * (lat - slip);
  v.vel.z = fz * v.speed + fx * (lat - slip);
  const px = v.pos.x, pz = v.pos.z;
  const r = moveBody(g.world, v.pos, v.vel, d.radius, d.h, 0.45, dt, v.grounded);
  v.grounded = r.grounded;
  if (moveRes.hit && moveRes.wall > 5) {
    damageVehicle(g, v, (moveRes.wall - 4) * 3.2, drv);
    if (drv && v.hp > 0) damage(g, drv, (moveRes.wall - 9) * 2.5, 'body', null, 'Crash', 'vehicle');
    v.speed *= -0.25;
  } else if (moveRes.hit) v.speed *= 0.6;
  else v.speed = v.vel.x * fx + v.vel.z * fz;
  // pitch/roll from terrain
  const ahead = g.world.heightAt(v.pos.x + fx * 1.6, v.pos.z + fz * 1.6), behind = g.world.heightAt(v.pos.x - fx * 1.6, v.pos.z - fz * 1.6);
  const tp = Math.atan2(behind - ahead, 3.2);
  v.pitch += (tp - v.pitch) * Math.min(1, dt * 8);
  v.roll += ((-v.steer * Math.min(1, Math.abs(v.speed) / d.max)) * (v.type === 'bike' ? 0.6 : 0.12) - v.roll) * Math.min(1, dt * 6);
  v.wheel += v.speed * dt * 0.9;
  if (drv) {
    drv.pos.copy(v.pos); drv.bodyYaw = v.yaw; drv.vel.copy(v.vel);
    drv.distance += Math.hypot(v.pos.x - px, v.pos.z - pz);
  }
  // run-over
  if (Math.abs(v.speed) > 6) {
    for (const f of g.fighters) {
      if (!f.alive || f === drv || f.state === 'plane' || f.state === 'vehicle') continue;
      if (Math.abs(f.pos.x - v.pos.x) < d.radius + 0.5 && Math.abs(f.pos.z - v.pos.z) < d.radius + 0.5 && Math.abs(f.pos.y - v.pos.y) < 1.5) {
        damage(g, f, Math.abs(v.speed) * 3.2, 'body', drv, 'Vehicle', 'vehicle');
        f.vel.x += fx * v.speed * 0.4; f.vel.z += fz * v.speed * 0.4; f.vel.y = 4; f.grounded = false;
        v.speed *= 0.8;
      }
    }
  }
}
