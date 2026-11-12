// Airship: model lifecycle, flight physics, fuel/hull, weapons, boarding.
import * as THREE from 'three';
import { SHIPS, SHIP_WEAPONS } from './data';
import { sfx } from './audio';
import { aimAssist, aimDirection, hooks, spawnProj } from './combat';
import { fx } from './fx';
import { buildAirship } from './models2';
import { G, clamp, input, lerp, lerpAng, rand } from './runtime';
import { shipStats, useStore } from './store';
import { ISLANDS, groundAt, nearestIsland, terrainH, worldRadius } from './world';

const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
export const shipInst = () => { const s = useStore.getState(); return s.ships[s.activeShip]; };

export function rebuildShip() {
  const S = G.ship; const st = useStore.getState(); const inst = st.ships[st.activeShip]; if (!G.scene) return;
  if (S.obj) G.scene.remove(S.obj);
  const obj = buildAirship(st.activeShip, { ...inst, upgrades: inst.upgrades }); S.obj = obj; G.scene.add(obj); S.props = obj.userData.props; S.exhausts = obj.userData.exhausts;
  obj.position.copy(S.pos); obj.rotation.y = S.yaw;
  if (!SHIPS[st.activeShip].weapons.includes(S.weapon)) S.weapon = 'cannon';
}
(window as any).__rebuildShip = () => rebuildShip();
export function initShip() { const st = useStore.getState(); const S = G.ship; S.pos.set(...st.shipPos); S.yaw = st.shipYaw; S.vel.set(0, 0, 0); S.speed = 0; S.landed = true; S.cds = {}; S.pitch = 0; S.roll = 0; S.wreckT = 0; const g = groundAt(S.pos.x, S.pos.z, S.pos.y + 40); if (g > -1e8 && S.pos.y < g + 1.2) S.pos.y = g + 1.2; rebuildShip(); }

export function damageShip(n: number, from?: THREE.Vector3) {
  const st = useStore.getState(); const inst = st.ships[st.activeShip]; if (G.cam.cine) return; const S = G.ship; if (S.wreckT > 0) return;
  inst.hull = Math.max(0, inst.hull - n); S.flash = 0.2; G.cam.shake = Math.max(G.cam.shake, Math.min(0.5, n * 0.02)); sfx('hurt', 0.8); G.combatT = 8;
  if (from) fx.sparks(from, '#ffb060', 12); fx.dmg(V1.set(S.pos.x, S.pos.y + 6, S.pos.z), `-${Math.round(n)}`, '#ff8a6a', true);
  if (inst.hull <= 0 && G.player.inShip) wreck();
}
hooks.damageShip = damageShip;
function wreck() {
  const S = G.ship; const st = useStore.getState(); const inst = shipInst(); const stat = shipStats(st);
  fx.explosion(S.pos, 3.5, 'big'); sfx('explosion'); G.cam.shake = 1;
  const isl = nearestIsland(S.pos.x, S.pos.z); const ang = Math.atan2(S.pos.z - isl.z, S.pos.x - isl.x); const px = isl.x + Math.cos(ang) * isl.r * 0.55, pz = isl.z + Math.sin(ang) * isl.r * 0.55; const pg = terrainH(isl, px, pz);
  G.player.inShip = false; G.player.pos.set(px, pg + 1, pz); G.player.vel.set(0, 0, 0); G.player.lastSafe.copy(G.player.pos);
  inst.hull = stat.maxHull * 0.3; inst.fuel = Math.max(inst.fuel, 30); const dock = { x: 66, z: 18 }; const dg = groundAt(dock.x, dock.z, 50);
  S.pos.set(dock.x, dg + 1.2, dock.z); S.vel.set(0, 0, 0); S.speed = 0; S.landed = true; S.yaw = Math.PI / 2;
  const lost = Math.floor((st.inv.gold || 0) * 0.1); st.set_({ inv: { ...st.inv, gold: (st.inv.gold || 0) - lost } });
  st.toast(`Your airship was destroyed! Towed back to the Old Dock (-${lost} gold).`, 'bad'); st.setBanner('AIRSHIP LOST', 'Emergency eject');
}
export function refuelShip(): boolean {
  const st = useStore.getState(); const inst = shipInst(); const stat = shipStats(st); if (inst.fuel >= stat.maxFuel - 1) { st.toast('Fuel tank is full', 'info'); return false; }
  if (st.inv.fuel_cell > 0) { st.removeItem('fuel_cell', 1); inst.fuel = stat.maxFuel; } else if (st.inv.crystal > 0) { st.removeItem('crystal', 1); inst.fuel = Math.min(stat.maxFuel, inst.fuel + 30); } else if (st.inv.essence > 0) { st.removeItem('essence', 1); inst.fuel = Math.min(stat.maxFuel, inst.fuel + 40); } else { st.toast('Need a Crystal, Essence or Fuel Cell to refuel', 'bad'); sfx('error'); return false; }
  sfx('pickup'); st.toast('Airship refueled', 'good'); return true;
}
export function repairShip(): boolean {
  const st = useStore.getState(); const inst = shipInst(); const stat = shipStats(st); if (inst.hull >= stat.maxHull - 1) { st.toast('Hull is undamaged', 'info'); return false; }
  if (!st.spend({ wood: 2, iron: 2 })) { st.toast('Repair needs 2 wood + 2 iron', 'bad'); sfx('error'); return false; }
  inst.hull = Math.min(stat.maxHull, inst.hull + stat.maxHull * 0.25); sfx('build'); st.toast('Hull repaired', 'good'); return true;
}
export function boardShip() {
  const st = useStore.getState(); const p = G.player; if (!st.repaired) return; p.inShip = true; p.lock = null; G.cam.dist = 30; sfx('open'); st.emitQ('count:board'); G.cam.yaw = G.ship.yaw + Math.PI;
  st.toast('Airship controls: W/S thrust · A/D turn · Space up · C down · Shift boost · 1-5 weapons · LMB fire · R refuel · H repair · E exit', 'info');
}
export function exitShip(): boolean {
  const p = G.player; const S = G.ship; const alt = S.pos.y - Math.max(-1e9, groundAt(S.pos.x, S.pos.z, S.pos.y + 3));
  if (!(alt < 6)) { useStore.getState().toast('Land first! Descend close to the ground to disembark.', 'bad'); sfx('error'); return false; }
  const side = S.yaw + Math.PI / 2; const x = S.pos.x + Math.sin(side) * 6, z = S.pos.z + Math.cos(side) * 6; const g = groundAt(x, z, S.pos.y + 6);
  if (g < -1e8) { const g2 = groundAt(S.pos.x - Math.sin(side) * 6, S.pos.z - Math.cos(side) * 6, S.pos.y + 6); if (g2 < -1e8) { useStore.getState().toast('No safe ground to disembark here.', 'bad'); return false; } p.pos.set(S.pos.x - Math.sin(side) * 6, g2, S.pos.z - Math.cos(side) * 6); } else p.pos.set(x, g, z);
  p.inShip = false; p.vel.set(0, 0, 0); p.lastSafe.copy(p.pos); S.landed = true; S.speed = 0; S.vel.set(0, 0, 0); S.throttle = 0; G.cam.dist = 8; sfx('open'); return true;
}

export function selectWeapon(i: number) { const st = useStore.getState(); const list = SHIPS[st.activeShip].weapons; const w = list[i]; if (w) { G.ship.weapon = w; sfx('click'); } }
function fire(id: string, dt: number) {
  const S = G.ship; const stat = shipStats(useStore.getState()); const w = SHIP_WEAPONS[id]; if ((S.cds[id] || 0) > 0) return; S.cds[id] = w.cd; const sc = S.obj?.userData.scale || 1; const mul = stat.dmgMul; void dt;
  const fwd = V1.set(Math.sin(S.yaw), 0, Math.cos(S.yaw)); const right = V3.set(fwd.z, 0, -fwd.x);
  const muzzle = new THREE.Vector3(S.pos.x + fwd.x * 4.2 * sc, S.pos.y + 1.6 * sc, S.pos.z + fwd.z * 4.2 * sc); const dir = aimDirection(new THREE.Vector3(), muzzle, id === 'repeater' ? 0.08 : 0.12);
  const dp = dir.dot(fwd) + dir.y * 0; if (dp < 0.2 && id !== 'bomb') dir.copy(fwd).setY(dir.y).normalize();
  G.cam.shake = Math.max(G.cam.shake, id === 'cannon' ? 0.25 : id === 'energy' ? 0.4 : 0.05);
  switch (id) {
    case 'cannon': sfx('cannon'); for (const s of (stat.def.id === 'scout' ? [0] : [-0.7, 0.7])) { const o = muzzle.clone().addScaledVector(right, s * sc); spawnProj({ kind: 'cannon', pos: o, dir: dir.clone(), speed: 95, dmg: w.dmg * mul, team: 'player', r: 1.2, aoe: 4, elem: 'fire', color: 0x222228, trail: 'smoke', grav: 3, life: 3.5, fromShip: true }); } fx.burst(muzzle, 14, '#ffb060', 7, 0.9, 0.4); break;
    case 'repeater': { sfx('repeater'); S.cds.alt = ((S.cds.alt || 0) + 1) % 2; const o = muzzle.clone().addScaledVector(right, (S.cds.alt ? 1.1 : -1.1) * sc).addScaledVector(fwd, -2); const d = dir.clone(); d.x += rand(-0.015, 0.015); d.y += rand(-0.015, 0.015); spawnProj({ kind: 'bullet', pos: o, dir: d, speed: 140, dmg: w.dmg * mul, team: 'player', r: 0.7, color: 0xffe080, life: 1.4, fromShip: true }); fx.emit(o.x, o.y, o.z, 0, 0, 0, '#ffe080', 1, 0.1); break; }
    case 'missile': { if (S.missiles <= 0) { S.cds[id] = 0.3; return; } sfx('missile'); const tgt = aimAssist(muzzle, dir, 0.6, 260); for (const s of [-1, 1]) { S.missiles--; const o = muzzle.clone().addScaledVector(right, s * 1.4 * sc); const d = dir.clone().addScaledVector(right, s * 0.25).normalize(); spawnProj({ kind: 'missile', pos: o, dir: d, speed: 60, dmg: w.dmg * mul, team: 'player', r: 1.3, aoe: 5, elem: 'fire', color: 0xff8a2a, homing: tgt, turn: 2.6, trail: 'smoke', life: 5, fromShip: true }); } break; }
    case 'energy': sfx('energy'); fx.shockwave(muzzle, 10, '#6af0ff', 0.5, false); spawnProj({ kind: 'energy', pos: muzzle.clone(), dir: dir.clone(), speed: 170, dmg: w.dmg * mul, team: 'player', r: 3, aoe: 7, elem: 'arcane', color: 0x6af0ff, trail: 'magic', pierce: false, life: 2.2, fromShip: true }); break;
    case 'bomb': sfx('bomb'); spawnProj({ kind: 'bomb', pos: V2.set(S.pos.x, S.pos.y - 1.5 * sc, S.pos.z).clone(), dir: new THREE.Vector3(S.vel.x, -2, S.vel.z).normalize(), speed: Math.max(4, Math.hypot(S.vel.x, S.vel.z)), dmg: w.dmg * mul, team: 'player', r: 1, aoe: 9, elem: 'fire', color: 0x222222, grav: 22, life: 8, fromShip: true }); break;
  }
}

export function updateShip(dt: number) {
  const S = G.ship; const st = useStore.getState(); const inst = st.ships[st.activeShip]; const stat = shipStats(st); const obj = S.obj; if (!obj) return; const p = G.player; const driving = p.inShip && !p.dead && !G.cam.cine;
  for (const k in S.cds) if (S.cds[k] > 0 && k !== 'alt') S.cds[k] -= dt; S.missiles = Math.min(6 + (st.ships[st.activeShip].upgrades.weapons || 0) * 2, S.missiles + dt * 0.25); S.flash = Math.max(0, S.flash - dt);
  const maxSpd = stat.speed * (S.boosting ? 1.65 : 1); const hasFuel = inst.fuel > 0;
  let thr = 0, turn = 0, vyT = 0;
  if (driving) {
    thr = input.moveY; turn = -input.moveX; if (input.up) vyT = 1; if (input.downKey) vyT = -1; S.boosting = input.sprint && thr > 0 && hasFuel;
    if (S.landed && (vyT > 0 || thr > 0.5) && hasFuel) { S.landed = false; sfx('open'); }
    for (let i = 1; i <= 5; i++) if (input.hit('Digit' + i)) selectWeapon(i - 1);
    const fireHeld = input.attack || input.keys.has('Enter'); if (fireHeld && !G.cam.cine) { fire(S.weapon, dt); }
    if (input.hit('KeyR')) refuelShip(); if (input.hit('KeyH')) repairShip();
    if (input.hit('KeyE')) exitShip();
    if (input.hit('KeyQ')) { const l = SHIPS[st.activeShip].weapons; selectWeapon((l.indexOf(S.weapon) + 1) % l.length); }
  } else { S.boosting = false; }
  if (!hasFuel) { thr = 0; vyT = driving ? Math.min(vyT, 0) - 0.25 : vyT; }
  S.throttle = lerp(S.throttle, Math.abs(thr), dt * 3);
  if (S.landed) { S.speed *= 1 - Math.min(1, dt * 4); S.vel.set(0, 0, 0); S.pitch *= 0.9; S.roll *= 0.9; const g = groundAt(S.pos.x, S.pos.z, S.pos.y + 4); if (g > -1e8) S.pos.y += (g + 1.2 - S.pos.y) * Math.min(1, dt * 4); if (driving && Math.abs(turn) > 0.1) S.yaw += turn * stat.turn * 0.4 * dt; }
  else {
    const target = thr > 0 ? thr * maxSpd : thr < 0 ? thr * maxSpd * 0.35 : 0; const acc = stat.accel * (S.boosting ? 1.8 : 1) * (thr === 0 ? 0.6 : 1);
    S.speed += clamp(target - S.speed, -acc * 1.2 * dt, acc * dt);
    const tf = clamp(Math.abs(S.speed) / 18, 0.3, 1); S.yaw += turn * stat.turn * tf * dt; S.yaw = (S.yaw + Math.PI * 2) % (Math.PI * 2);
    const vyTarget = vyT * (14 + stat.speed * 0.08) * (S.boosting ? 1.2 : 1); S.vy += (vyTarget - S.vy) * Math.min(1, dt * 2.2);
    // velocity: heading-aligned with drift
    const hx = Math.sin(S.yaw) * S.speed, hz = Math.cos(S.yaw) * S.speed; const k = Math.min(1, dt * 3 / (stat.drift + 0.2)); S.vel.x += (hx - S.vel.x) * k; S.vel.z += (hz - S.vel.z) * k; S.vel.y = S.vy;
    if (G.weather.type === 'storm' && G.weather.i > 0.3) { S.vel.x += Math.sin(G.t * 0.2) * 2.5 * dt; S.vel.z += Math.cos(G.t * 0.17) * 2.5 * dt; }
    S.pos.addScaledVector(S.vel, dt);
    // fuel
    if (driving) { const use = (0.35 + Math.abs(thr) * 0.9 + (S.boosting ? 3.2 : 0) + Math.abs(vyT) * 0.25) * stat.fuelEff; inst.fuel = Math.max(0, inst.fuel - use * dt); if (inst.fuel < 15 && !(G as any).fuelWarn) { (G as any).fuelWarn = true; st.toast('Low fuel! Press R to refuel (crystal/essence)', 'bad'); } if (inst.fuel > 25) (G as any).fuelWarn = false; if (inst.fuel <= 0 && !(G as any).fuelOut) { (G as any).fuelOut = true; st.toast('Engines out of fuel!', 'bad'); } if (inst.fuel > 0) (G as any).fuelOut = false; }
    // terrain collision / landing
    const g = groundAt(S.pos.x, S.pos.z, S.pos.y + 30); S.alt = g > -1e8 ? S.pos.y - g : 999;
    if (g > -1e8 && S.pos.y < g + 1.2) {
      const impact = Math.hypot(S.speed * 0.4, Math.min(0, S.vy)); S.pos.y = g + 1.2; if (S.vy < 0) S.vy = 0;
      if (impact > 14 && driving) { damageShip((impact - 14) * 3.5); S.speed *= 0.5; fx.burst(V1.set(S.pos.x, g + 1, S.pos.z), 14, '#b8a888', 8, 1.2, 0.7, 8); } else if (Math.abs(S.speed) < 8 && vyT <= 0 && (!driving || thr <= 0.2)) { S.landed = true; fx.burst(V1.set(S.pos.x, g + 0.5, S.pos.z), 10, '#d8c8a8', 6, 1.2, 0.8, 5); sfx('land'); }
    }
    const d0 = Math.hypot(S.pos.x, S.pos.z); if (d0 > worldRadius) { S.vel.x -= (S.pos.x / d0) * 40 * dt; S.vel.z -= (S.pos.z / d0) * 40 * dt; S.pos.x -= (S.pos.x / d0) * 20 * dt; S.pos.z -= (S.pos.z / d0) * 20 * dt; if (driving && G.msgT <= 0) { st.toast('Violent winds at the edge of the world push you back!', 'bad'); G.msgT = 5; } }
    if (S.pos.y > 520) S.pos.y = 520; if (S.pos.y < -300) { S.pos.y = -300; if (driving) damageShip(30 * dt); }
    S.pitch = lerp(S.pitch, clamp(-S.vy * 0.025, -0.35, 0.35), dt * 3); S.roll = lerp(S.roll, clamp(turn * tf * 0.55, -0.55, 0.55), dt * 3);
  }
  // transform
  const bob = S.landed ? 0 : Math.sin(G.t * 1.7) * 0.18; obj.position.set(S.pos.x, S.pos.y + bob, S.pos.z); obj.rotation.set(S.pitch, S.yaw, S.roll, 'YXZ');
  const spin = (driving ? 40 : 6) * (0.4 + S.throttle * 1.4); for (const pr of S.props) pr.rotation.z += spin * dt;
  const flag = obj.userData.flag as THREE.Object3D | undefined; if (flag) flag.rotation.y = Math.sin(G.t * 6) * 0.3;
  if (S.flash > 0 && Math.random() < 0.5) fx.sparks(V1.set(S.pos.x + rand(-2, 2), S.pos.y + rand(0, 2), S.pos.z + rand(-2, 2)), '#ffb060', 3);
  const hp = inst.hull / stat.maxHull; if (hp < 0.35 && Math.random() < 0.3) fx.trail(V1.set(S.pos.x + rand(-1.5, 1.5), S.pos.y + 1, S.pos.z + rand(-1.5, 1.5)), hp < 0.18 ? '#ff7a1a' : '#444', 1.6, 0.9, 1);
  // exhaust
  if (!S.landed && (S.throttle > 0.1 || S.boosting) && Math.random() < 0.8) { obj.updateMatrixWorld(); for (const e of S.exhausts) { V1.copy(e).applyEuler(obj.rotation).add(obj.position); fx.emit(V1.x, V1.y, V1.z, -Math.sin(S.yaw) * (8 + S.speed * 0.2) + rand(-0.5, 0.5), rand(-0.5, 0.5), -Math.cos(S.yaw) * (8 + S.speed * 0.2) + rand(-0.5, 0.5), S.boosting ? '#ffb040' : '#6af0ff', S.boosting ? 1.6 : 1, 0.45, 0, 1, -1); } }
  if (S.boosting && Math.random() < 0.5) for (let i = 0; i < 2; i++) fx.emit(S.pos.x + rand(-30, 30), S.pos.y + rand(-15, 15), S.pos.z + rand(-30, 30), -Math.sin(S.yaw) * 80, 0, -Math.cos(S.yaw) * 80, '#ffffff', 0.5, 0.35, 0, 0, 0, 0.5);
  // cloud wake / wind streaks
  if (!S.landed && Math.abs(S.speed) > 20 && Math.random() < 0.5) fx.emit(S.pos.x + Math.sin(S.yaw) * 20 + rand(-25, 25), S.pos.y + rand(-10, 12), S.pos.z + Math.cos(S.yaw) * 20 + rand(-25, 25), -Math.sin(S.yaw) * S.speed * 1.5, 0, -Math.cos(S.yaw) * S.speed * 1.5, '#ffffff', 0.35, 0.5, 0, 0, 0, 0.35);
  void lerpAng; void ISLANDS;
}
