import * as THREE from 'three';
import { BLOCK, REGION_SIZE, VEHICLE_PRICE, WORLD_OFF, regionAt } from './data';
import { BLASTS, G, V3, clamp, damp, down, rnd, seeded, type Vehicle, type Vec } from './runtime';
import { VSPECS, buildVehicle, type VParts } from './vehicles';
import { collide, type RegionGeo } from './world';
import { explode, crime, hurtActor, hurtPlayer } from './combat';
import { fx } from './fx';
import { sfx, engineUpdate } from './audio';
import { facLv, useGame } from './store';

export const vehiclesRoot = new THREE.Group();
const partsOf = new WeakMap<Vehicle, VParts>();
const tv = new V3(), tv2 = new V3(), pt = new V3();
export const CHOP = new V3(-100, 0, 45);
let trafficSpawnT = 0;

export function makeVehicle(type: string, color: string, pos: Vec, yaw: number, ai: Vehicle['ai']): Vehicle {
  const sp = VSPECS[type]; const v: Vehicle = {
    id: G.nextId++, type, color, pos: pos.clone(), yaw, speed: 0, vy: 0, steer: 0, hp: sp.hp, maxHp: sp.hp, ai, stolen: false, group: null, spin: 0, door: 0, braking: false,
    dir: new V3(Math.sin(yaw), 0, Math.cos(yaw)), smoke: 0, cargo: type === 'delivery' || type === 'truck' || type === 'van', fromGarage: false, roll: 0, pitch: 0, slip: 0, stealT: 0, tlock: 0,
  };
  G.vehicles.push(v); return v;
}
export function spawnWorldVehicles(geos: RegionGeo[]) {
  for (const v of G.vehicles) if (v.group) vehiclesRoot.remove(v.group); G.vehicles.length = 0; trafficSpawnT = 0; const rng = seeded(99);
  for (const g of geos) for (const c of g.cars) { const sp = VSPECS[c.type]; makeVehicle(c.type, sp.colors[Math.floor(rng() * sp.colors.length)], new V3(c.x, 0, c.z), c.yaw, 'parked'); }
  // traffic
  const line = (k: number) => WORLD_OFF + k * 80;
  for (let i = 0; i < 64; i++) {
    const metro = i < 44; const alongX = rng() < 0.5; const k = metro ? 5 + Math.floor(rng() * 6) : Math.floor(rng() * 16); const s = (metro ? -200 + rng() * 400 : -600 + rng() * 1200); const sign = rng() < 0.5 ? 1 : -1;
    const type = ['sedan', 'sedan', 'taxi', 'suv', 'van', 'delivery', 'truck', 'luxury', 'sports', 'bike'][Math.floor(rng() * 10)]; const sp = VSPECS[type];
    const dir = alongX ? new V3(sign, 0, 0) : new V3(0, 0, sign); const rt = new V3(-dir.z, 0, dir.x);
    const pos = alongX ? new V3(s, 0, line(k) + rt.z * 4) : new V3(line(k) + rt.x * 4, 0, s);
    const v = makeVehicle(type, sp.colors[Math.floor(rng() * sp.colors.length)], pos, Math.atan2(dir.x, dir.z), 'traffic'); v.dir.copy(dir); v.speed = 9 + rng() * 6; v.tlock = rng();
  }
}
const nightMat = { n: 0 };
function ensureGroup(v: Vehicle) {
  if (v.group) return; const b = buildVehicle(v.type, v.color); v.group = b.group; partsOf.set(v, b.parts); vehiclesRoot.add(v.group);
}
function dropGroup(v: Vehicle) { if (v.group) { vehiclesRoot.remove(v.group); v.group = null; partsOf.delete(v); } }
export function findNearestVehicle(pos: Vec, r: number): Vehicle | null {
  let best: Vehicle | null = null, bd = r; for (const v of G.vehicles) { if (v.ai === 'wreck' || v.ai === 'player') continue; const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z); const sp = VSPECS[v.type]; const dd = d - sp.l * 0.3; if (dd < bd) { best = v; bd = dd; } } return best;
}
export function damageVehicle(v: Vehicle, d: number) {
  if (v.ai === 'wreck') return; v.hp -= d; if (v.hp <= 0) {
    v.ai = 'wreck'; v.speed = 0; const c = new V3(v.pos.x, 1, v.pos.z); explode(c, 6, 40, '#ff7a1a', '#ffd23f', 'Fire', 'enemy', 14); v.tlock = 18; G.shake = Math.max(G.shake, 0.6);
    if (G.p.vehicle === v) { G.p.vehicle = null; G.p.pos.set(v.pos.x + 3, 0.2, v.pos.z); hurtPlayer(25, c, { kb: 14 }); }
    const b = partsOf.get(v); if (b) { b.head.emissiveIntensity = 0; }
    crime(10); const gr = v.group; if (gr) gr.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshStandardMaterial).color) { /* charred */ } });
  }
}
export function enterVehicle(v: Vehicle) {
  const p = G.p; p.vehicle = v; v.ai = 'player'; p.flying = false; p.vel.set(0, 0, 0); v.door = 1; sfx('door');
  if (!v.fromGarage && !v.stolen) { v.stolen = true; const st = useGame.getState(); st.evt('steal'); st.addRep(4); const wit = G.actors.some((a) => a.kind === 'civilian' && a.alive && a.pos.distanceTo(v.pos) < 25); crime(wit ? 9 : 3); st.toast(`Stole a ${VSPECS[v.type].name}! Bring it to your HQ chop zone for cash.`, '#fbbf24'); }
}
export function exitVehicle(): boolean {
  const p = G.p; const v = p.vehicle; if (!v) return false; if (Math.abs(v.speed) > 12) return false;
  const left = tv.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw)); const sp = VSPECS[v.type]; p.pos.set(v.pos.x, 0, v.pos.z).addScaledVector(left, sp.w / 2 + 1.0); p.yaw = v.yaw; p.vehicle = null; v.ai = 'parked'; v.door = 1; v.speed = 0; sfx('door'); engineUpdate(false, 0, 0);
  p.vel.set(0, 0, 0); return true;
}
export function deliverVehicle() {
  const p = G.p; const v = p.vehicle; if (!v) return; const st = useGame.getState(); const base = (VEHICLE_PRICE[v.type] ?? 1500) * (0.5 + 0.5 * (v.hp / v.maxHp)) * (1 + 0.15 * facLv(st, 'garage'));
  const owned = st.vehicles.some((x) => x.type === v.type); p.vehicle = null; p.pos.set(CHOP.x + 4, 0, CHOP.z + 4);
  if (!owned && v.stolen) { st.addVehicle(v.type, v.color); st.addMoney(Math.round(base * 0.4)); st.toast(`${VSPECS[v.type].name} kept in your garage! (+$${Math.round(base * 0.4)})`, '#34d399'); }
  else { st.addMoney(Math.round(base)); st.toast(`Sold ${VSPECS[v.type].name} for $${Math.round(base)}`, '#34d399'); }
  if (v.cargo) { st.giveItem('scrap', 4); st.giveItem('circuit', 1); }
  st.addRep(6); st.addXp(60); st.evt('deliver'); sfx('coin'); dropGroup(v); const i = G.vehicles.indexOf(v); if (i >= 0) G.vehicles.splice(i, 1);
}
export function spawnOwned(type: string, color: string) {
  const v = makeVehicle(type, color, new V3(CHOP.x - 6, 0, CHOP.z + 2), -Math.PI / 2, 'parked'); v.fromGarage = true; useGame.getState().toast(`${VSPECS[type].name} delivered from your garage`, '#93c5fd'); return v;
}

function applyVisual(v: Vehicle, dt: number, night: number) {
  const g = v.group!; const b = partsOf.get(v)!; const sp = VSPECS[v.type];
  g.position.set(v.pos.x, v.pos.y, v.pos.z); g.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
  for (const w of b.wheels) { w.spin.rotation.x += (v.speed * dt) / sp.wr; if (w.front) w.pivot.rotation.y = v.steer * 0.5; }
  v.door = damp(v.door, 0, 2.2, dt); if (v.door < 0.01) v.door = 0;
  if (b.door) b.door.rotation.y = -Math.min(1, v.door * 1.4) * 1.0;
  const lit = v.ai === 'player' || v.ai === 'traffic' ? night : 0; b.head.emissiveIntensity = 0.25 + lit * 2.2; b.tail.emissiveIntensity = 0.3 + lit * 0.8 + (v.braking ? 2.2 : 0);
  if (v.ai === 'wreck') { b.head.emissiveIntensity = 0; b.tail.emissiveIntensity = 0; g.scale.y = 0.9; }
}

export function updateVehicles(dt: number, night: number) {
  nightMat.n = night; const p = G.p; const px = p.pos.x, pz = p.pos.z;
  updateLocalTraffic(dt);
  for (const bl of BLASTS) for (const v of G.vehicles) { if (v.ai === 'wreck') continue; const d = Math.hypot(v.pos.x - bl.x, v.pos.z - bl.z); if (d < bl.r + 2) damageVehicle(v, bl.d * 0.4 * (1 - d / (bl.r + 3))); }
  BLASTS.length = 0;
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    const v = G.vehicles[i]; const d = Math.hypot(v.pos.x - px, v.pos.z - pz); const isP = v.ai === 'player';
    if (d > 300 && !isP) {
      dropGroup(v);
      if (v.ai === 'traffic') { G.vehicles.splice(i, 1); continue; }
      continue;
    }
    if (v.ai === 'wreck') { v.tlock -= dt; if (v.group) applyVisual(v, dt, 0); if (v.tlock < 0) { dropGroup(v); G.vehicles.splice(i, 1); } continue; }
    if (d < 230 || isP) ensureGroup(v); else dropGroup(v);
    if (isP) updateDriven(v, dt);
    else if (v.ai === 'traffic' && d < 260) updateTraffic(v, dt);
    else if (v.speed !== 0) { v.speed = damp(v.speed, 0, 3, dt); v.pos.addScaledVector(tv.set(Math.sin(v.yaw), 0, Math.cos(v.yaw)), v.speed * dt); }
    if (v.hp < v.maxHp * 0.5 && d < 60) { v.smoke -= dt; if (v.smoke < 0) { v.smoke = 0.07; fx.spark(v.pos.x + Math.sin(v.yaw) * 1.5, 1.1, v.pos.z + Math.cos(v.yaw) * 1.5, rnd(-0.5, 0.5), rnd(1, 3), rnd(-0.5, 0.5), 1, v.hp < v.maxHp * 0.25 ? 0.4 : 0.3, v.hp < v.maxHp * 0.25 ? '#ff7a2a' : '#8a8a8a'); } }
    if (v.group) { v.group.visible = true; applyVisual(v, dt, night); }
  }
  if (!p.vehicle) engineUpdate(false, 0, 0);
}

function updateLocalTraffic(dt: number) {
  trafficSpawnT -= dt;
  if (trafficSpawnT > 0) return;
  trafficSpawnT = 2.4;
  if (useGame.getState().screen !== 'game' || G.p.interior) return;

  const region = regionAt(G.p.pos.x, G.p.pos.z);
  if (!region) return;
  const nearby = G.vehicles.filter((v) => v.ai === 'traffic' && Math.hypot(v.pos.x - G.p.pos.x, v.pos.z - G.p.pos.z) < 185).length;
  const total = G.vehicles.filter((v) => v.ai === 'traffic').length;
  const count = Math.min(2, 7 - nearby, 78 - total);
  for (let i = 0; i < count; i++) {
    const alongX = Math.random() < 0.5, sign = Math.random() < 0.5 ? -1 : 1;
    const minX = WORLD_OFF + region.gx * REGION_SIZE, minZ = WORLD_OFF + region.gy * REGION_SIZE;
    const axis = alongX ? G.p.pos.z : G.p.pos.x, base = alongX ? minZ : minX;
    const lane = clamp(Math.round((axis - base) / BLOCK) + Math.round(rnd(-1, 1)), 0, REGION_SIZE / BLOCK);
    const distance = rnd(60, 155);
    const pos = alongX
      ? new V3(clamp(G.p.pos.x + sign * distance, minX + 12, minX + REGION_SIZE - 12), 0, minZ + lane * BLOCK + sign * 4)
      : new V3(minX + lane * BLOCK - sign * 4, 0, clamp(G.p.pos.z + sign * distance, minZ + 12, minZ + REGION_SIZE - 12));
    const type = ['sedan', 'sedan', 'taxi', 'suv', 'van', 'delivery', 'sports', 'bike'][Math.floor(rnd(0, 8))];
    const spec = VSPECS[type], yaw = alongX ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (sign > 0 ? 0 : Math.PI);
    const vehicle = makeVehicle(type, spec.colors[Math.floor(rnd(0, spec.colors.length))], pos, yaw, 'traffic');
    vehicle.dir.set(Math.sin(yaw), 0, Math.cos(yaw)); vehicle.speed = 8 + rnd(0, 5); vehicle.tlock = rnd(0, 1);
  }
}

function updateTraffic(v: Vehicle, dt: number) {
  const sp = VSPECS[v.type]; let tgt = 10 + sp.max * 0.18; v.tlock -= dt; v.braking = false;
  const ahead = (x: number, z: number) => { const dx = x - v.pos.x, dz = z - v.pos.z; const al = dx * v.dir.x + dz * v.dir.z; const lat = Math.abs(dx * -v.dir.z + dz * v.dir.x); return al > 0 && al < 10 && lat < 2.8; };
  if (!G.p.vehicle && ahead(G.p.pos.x, G.p.pos.z)) tgt = 0; for (const o of G.vehicles) if (o !== v && o.ai !== 'parked' && ahead(o.pos.x, o.pos.z)) tgt = 0; for (const a of G.actors) if (a.alive && a.team === 'civ' && a.pos.distanceToSquared(v.pos) < 144 && ahead(a.pos.x, a.pos.z)) tgt = 0;
  if (G.p.vehicle && ahead(G.p.vehicle.pos.x, G.p.vehicle.pos.z)) tgt = 0;
  if (tgt === 0) v.braking = true; v.speed = damp(v.speed, tgt, tgt === 0 ? 4 : 1.2, dt);
  v.pos.addScaledVector(v.dir, v.speed * dt);
  const alongX = Math.abs(v.dir.x) > 0.5; const along = alongX ? v.pos.x : v.pos.z; const rel = (((along - WORLD_OFF) % 80) + 80) % 80;
  if (v.tlock <= 0 && (rel < 0.9 || rel > 79.1)) {
    v.tlock = 2.5; const r = Math.random();
    if (Math.abs(along) > 590) { v.dir.multiplyScalar(-1); } else if (r > 0.62) {
      const right = r > 0.81; const nd = right ? new V3(-v.dir.z, 0, v.dir.x) : new V3(v.dir.z, 0, -v.dir.x); v.dir.copy(nd); const rt = new V3(-nd.z, 0, nd.x);
      if (Math.abs(nd.x) > 0.5) { v.pos.x = along; v.pos.z = WORLD_OFF + Math.round((v.pos.z - WORLD_OFF) / 80) * 80 + rt.z * 4; } else { v.pos.z = along; v.pos.x = WORLD_OFF + Math.round((v.pos.x - WORLD_OFF) / 80) * 80 + rt.x * 4; }
    }
  }
  const ty = Math.atan2(v.dir.x, v.dir.z); let dy = ty - v.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; v.yaw += dy * Math.min(1, 6 * dt); v.steer = clamp(dy, -0.5, 0.5);
}

function updateDriven(v: Vehicle, dt: number) {
  const p = G.p; const sp = VSPECS[v.type]; const thr = (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0); const st = (down('KeyA') ? 1 : 0) - (down('KeyD') ? 1 : 0); const hb = down('Space'); const nitro = down('ShiftLeft', 'ShiftRight') ? 1.35 : 1;
  const f = tv.set(Math.sin(v.yaw), 0, Math.cos(v.yaw)); const r = tv2.set(f.z, 0, -f.x);
  let vf = v.speed; const maxSp = sp.max * nitro;
  if (thr > 0) { vf += sp.acc * nitro * dt * (1 - Math.max(0, vf) / (maxSp * 1.1)) * (vf < 0 ? 2.5 : 1); } else if (thr < 0) { vf -= (vf > 1 ? sp.acc * 2.2 : sp.acc * 0.7) * dt; if (vf < -sp.max * 0.25) vf = -sp.max * 0.25; v.braking = true; } else vf -= Math.sign(vf) * Math.min(Math.abs(vf), (3.5 + Math.abs(vf) * 0.12) * dt);
  v.braking = thr < 0 && vf > 0.5 || hb; if (hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 16 * dt);
  const steerTarget = st * 0.55; v.steer = damp(v.steer, steerTarget, 7, dt);
  const speedF = Math.abs(vf) / (Math.abs(vf) + 7); const yawRate = v.steer * sp.steer * speedF * 2.1 * (hb ? 1.6 : 1) * Math.sign(vf || 1) * clamp(Math.abs(vf) / 3, 0, 1);
  v.yaw += yawRate * dt; if (hb && Math.abs(vf) > 8) { v.slip += st * -vf * 0.05 * dt * 10; } v.slip = damp(v.slip, 0, hb ? 1.2 : 6, dt);
  f.set(Math.sin(v.yaw), 0, Math.cos(v.yaw)); r.set(f.z, 0, -f.x);
  v.speed = vf; v.pos.x += (f.x * vf + r.x * v.slip) * dt; v.pos.z += (f.z * vf + r.z * v.slip) * dt;
  v.roll = damp(v.roll, sp.bike ? -v.steer * Math.min(1, Math.abs(vf) / 20) * 0.9 : -v.steer * speedF * 0.06, 6, dt); v.pitch = damp(v.pitch, -thr * 0.015 * Math.min(1, Math.abs(vf) / 10), 5, dt);
  // collision
  for (const k of [0.38, 0, -0.38]) {
    pt.set(v.pos.x + f.x * sp.l * k, 0, v.pos.z + f.z * sp.l * k); const ox = pt.x, oz = pt.z; const c = collide(pt, null, sp.w * 0.46, 1.2, 0);
    if (c.hit) { v.pos.x += pt.x - ox; v.pos.z += pt.z - oz; const impact = Math.abs(vf); if (impact > 3) { const d = Math.max(0, impact - 7) * 2.2; v.speed *= 0.45; if (impact > 7) { sfx('crash'); G.shake = Math.max(G.shake, Math.min(0.8, impact / 40)); fx.burst(tv.set(pt.x, 0.8, pt.z), '#ffcc66', 10, 6, 0.4, 0.15); crime(2); } if (d > 0) damageVehicle(v, d); } break; }
  }
  v.pos.x = clamp(v.pos.x, -640, 640); v.pos.z = clamp(v.pos.z, -640, 640);
  // hit actors & vehicles
  if (Math.abs(vf) > 5) for (const a of G.actors) { if (!a.alive || a.team === 'ally') continue; const dx = a.pos.x - v.pos.x, dz = a.pos.z - v.pos.z; if (dx * dx + dz * dz < (sp.w * 0.6 + 0.7) ** 2 && Math.abs(a.pos.y - 0) < 3) { tv.set(f.x * vf * 0.7, 6, f.z * vf * 0.7); hurtActor(a, Math.abs(vf) * 3.5, { kb: tv, player: true, heavy: true }); sfx('hit'); if (a.team === 'civ') crime(10); } }
  for (const o of G.vehicles) { if (o === v || o.ai === 'wreck') continue; const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z; const dd = Math.hypot(dx, dz); const lim = (VSPECS[o.type].l + sp.l) * 0.36; if (dd < lim && dd > 0.01) { const push = (lim - dd); o.pos.x += (dx / dd) * push * 0.7; o.pos.z += (dz / dd) * push * 0.7; v.pos.x -= (dx / dd) * push * 0.3; v.pos.z -= (dz / dd) * push * 0.3; const imp = Math.abs(vf - o.speed); if (imp > 5) { damageVehicle(o, imp * 1.6); damageVehicle(v, imp * 0.8); sfx('crash'); G.shake = Math.max(G.shake, 0.4); fx.burst(tv.set(o.pos.x, 1, o.pos.z), '#ffcc66', 8, 5, 0.4, 0.15); crime(4); } v.speed *= 0.7; o.speed = vf * 0.4; if (o.ai === 'traffic') { o.ai = 'parked'; } } }
  p.pos.set(v.pos.x, v.pos.y, v.pos.z); p.yaw = v.yaw; p.speed = Math.abs(vf);
  engineUpdate(true, vf, Math.abs(thr), !!sp.bike);
}
