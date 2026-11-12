// Enemy spawning, AI, animation, death, loot, pirate airships.
import * as THREE from 'three';
import { ENEMIES, type EnemyDef } from './data';
import { sfx } from './audio';
import { areaDamage, damageHostile, hooks, hurtPlayer, spawnLoot, spawnProj } from './combat';
import { fx } from './fx';
import { buildEnemy } from './models';
import { buildAirship } from './models2';
import { G, angDiff, clamp, lerpAng, rand, type Hostile } from './runtime';
import { useStore } from './store';
import { WORLD, collide, groundAt } from './world';

const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(); const C = { x: 0, z: 0 };
export function makeHostile(kind: Hostile['kind'], type: string, def: any, obj: THREE.Group, x: number, y: number, z: number, isl: string): Hostile {
  obj.position.set(x, y, z); G.scene!.add(obj);
  const h: Hostile = { uid: G.uid++, kind, type, def, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), yaw: rand(0, 6.28), hp: def.hp, maxHp: def.hp, r: def.r * (def.scale || 1) * (kind === 'enemy' ? 0.85 : 1), cy: kind === 'enemy' ? (def.flying ? 1.2 : 1.0) * (def.scale || 1) : 2, obj, parts: obj.userData.parts || {}, home: new THREE.Vector3(x, y, z), isl, state: 'idle', stateT: rand(0, 2), atkCd: rand(0.5, 2), dead: false, deadT: 0, hurtT: 0, slowT: 0, burnT: 0, stunT: 0, aggro: false, flying: !!def.flying, hover: def.flying ? rand(5, 8) : 0, dmgTaken: 0, vuln: 1, x: {}, spawnT: 0, active: true, walk: rand(0, 6), atkProg: 0, flash: 0, lockable: true, name: def.name };
  obj.rotation.y = h.yaw; G.hostiles.push(h); return h;
}
export function spawnEnemy(type: string, x: number, y: number, z: number, isl: string, o: { raid?: boolean; flying?: boolean; hpMul?: number } = {}) {
  const def = ENEMIES[type]; const obj = buildEnemy(type, def.color); obj.scale.setScalar(def.scale);
  if (type === 'stag') obj.scale.setScalar(def.scale);
  const h = makeHostile('enemy', type, def, obj, x, y, z, isl); if (o.raid) { h.raid = true; h.aggro = true; } if (o.hpMul) { h.hp *= o.hpMul; h.maxHp *= o.hpMul; } return h;
}
interface SpawnRec { s: typeof WORLD.spawns[number]; h: Hostile | null; respawn: number }
const recs: SpawnRec[] = WORLD.spawns.map(s => ({ s, h: null, respawn: 0 }));
export function resetEnemies() { for (const h of G.hostiles) G.scene?.remove(h.obj); G.hostiles.length = 0; G.boss = null; for (const r of recs) { r.h = null; r.respawn = 0; } }
const tgtPos = () => (G.player.inShip ? G.ship.pos : G.player.pos);

export function spawnPirate(x: number, y: number, z: number) {
  const inst = { hullColor: '#1c1c26', sailColor: '#3a1a1a', trimColor: '#c0392b', decor: ['lanterns'], style: 'sails', upgrades: { armor: 2 } };
  const obj = buildAirship('windrunner', inst, true); const lvl = useStore.getState().level;
  const def = { name: 'Pirate Airship', hp: 200 + lvl * 18, r: 3.6, scale: 1, dmg: 14 + lvl, xp: 120 };
  const h = makeHostile('ship', 'pirate', def, obj, x, y, z, ''); h.flying = true; h.r = 5; h.cy = 2.5; h.aggro = true; h.x = { fireCd: 2, ang: rand(0, 6.28), dir: Math.random() < 0.5 ? 1 : -1 }; h.name = 'Sky Pirate Airship'; return h;
}

const heightAt = (h: Hostile) => groundAt(h.pos.x, h.pos.z, h.pos.y + 3);
function moveGround(h: Hostile, dx: number, dz: number, speed: number, dt: number) {
  const sp = speed * (h.slowT > 0 ? 0.5 : 1); h.vel.x += (dx * sp - h.vel.x) * Math.min(1, dt * 8); h.vel.z += (dz * sp - h.vel.z) * Math.min(1, dt * 8);
}
function integrate(h: Hostile, dt: number) {
  const nx = h.pos.x + h.vel.x * dt, nz = h.pos.z + h.vel.z * dt;
  if (!h.flying) {
    const g = groundAt(nx, nz, h.pos.y + 1.5);
    if (g > -1e8 && Math.abs(g - h.pos.y) < 3) { collide(nx, nz, h.r * 0.6, C); h.pos.x = C.x; h.pos.z = C.z; } else { h.vel.x *= -0.2; h.vel.z *= -0.2; }
    const g2 = heightAt(h); if (g2 > -1e8) { h.vel.y -= 30 * dt; h.pos.y += h.vel.y * dt; if (h.pos.y <= g2) { h.pos.y = g2; h.vel.y = 0; } } else h.vel.y = 0;
    h.vel.x *= 1 - Math.min(1, dt * 1.5); h.vel.z *= 1 - Math.min(1, dt * 1.5);
  } else { h.pos.x = nx; h.pos.z = nz; h.pos.y += h.vel.y * dt; h.vel.y *= 1 - Math.min(1, dt * 3); }
}
function face(h: Hostile, tx: number, tz: number, rate = 8, dt = 0.016) { h.yaw = lerpAng(h.yaw, Math.atan2(tx - h.pos.x, tz - h.pos.z), rate * dt); }

function think(h: Hostile, dt: number) {
  const def = h.def as EnemyDef; const T = tgtPos(); const dx = T.x - h.pos.x, dz = T.z - h.pos.z; const d = Math.hypot(dx, dz); const dy = T.y - h.pos.y; const pl = G.player;
  h.stateT += dt; h.atkCd -= dt; const homeD = Math.hypot(h.pos.x - h.home.x, h.pos.z - h.home.z);
  if (h.stunT > 0) { h.stunT -= dt; h.vel.x *= 0.9; h.vel.z *= 0.9; return; }
  const aware = !pl.dead && d < (h.aggro ? def.detect * 2.2 : def.detect) && Math.abs(dy) < 40 && (!G.cam.cine);
  if (!h.raid && h.aggro && (homeD > 90 || !aware)) { if (h.state !== 'return') { h.state = 'return'; h.stateT = 0; } }
  if (!h.aggro && aware && def.ai !== 'flee') { h.aggro = true; h.state = 'chase'; h.stateT = 0; sfx('roar_' + (def.id === 'stag' ? 'wolf' : def.id), 0.5); }
  const dirx = d > 0.01 ? dx / d : 0, dirz = d > 0.01 ? dz / d : 0;
  // flee AI
  if (def.ai === 'flee') {
    if (d < def.detect && !pl.dead) { h.state = 'flee'; face(h, h.pos.x - dx, h.pos.z - dz, 10, dt); moveGround(h, -dirx, -dirz, def.speed, dt); h.walk += dt * 14; } else { wander(h, dt, 0.35); }
    return;
  }
  if (h.state === 'return') { const hx = h.home.x - h.pos.x, hz = h.home.z - h.pos.z, hd = Math.hypot(hx, hz); face(h, h.home.x, h.home.z, 6, dt); moveGround(h, hx / (hd || 1), hz / (hd || 1), def.speed, dt); h.walk += dt * def.speed * 1.5; if (def.flying) h.vel.y += (h.home.y + h.hover - h.pos.y) * dt; if (hd < 4) { h.state = 'idle'; h.aggro = false; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.5); } if (aware && homeD < 70) { h.state = 'chase'; } return; }
  if (!h.aggro) { wander(h, dt, 0.4); if (def.flying) flyIdle(h, dt); return; }
  // raid target
  let tx = T.x, tz = T.z, td = d; if (h.raid && d > 30) { const c = castlePos(); if (c) { tx = c.x; tz = c.z; td = Math.hypot(tx - h.pos.x, tz - h.pos.z); } }
  const tdx = tx - h.pos.x, tdz = tz - h.pos.z; const tdn = td > 0.01 ? { x: tdx / td, z: tdz / td } : { x: 0, z: 0 };
  switch (def.ai) {
    case 'melee': case 'lunge': case 'slam': {
      if (h.state === 'idle' || h.state === 'return') { h.state = 'chase'; }
      if (h.state === 'chase') { face(h, tx, tz, 8, dt); const rng = def.atkRange * (def.ai === 'lunge' ? 2.6 : 0.85); if (td > rng) { moveGround(h, tdn.x, tdn.z, def.speed, dt); h.walk += dt * def.speed * 1.6; } else { h.vel.x *= 0.8; h.vel.z *= 0.8; if (h.atkCd <= 0) { h.state = 'windup'; h.stateT = 0; if (def.ai === 'slam') fx.telegraph(V1.set(h.pos.x, h.pos.y, h.pos.z), def.atkRange * 1.15, def.windup, '#ff4a2a'); sfx('roar_' + def.id, 0.6); } } if (h.raid && td < 10 && d > 30) raidHit(h, dt); }
      else if (h.state === 'windup') { h.atkProg = clamp(h.stateT / def.windup, 0, 1); face(h, tx, tz, 10, dt); h.vel.x *= 0.7; h.vel.z *= 0.7; if (h.stateT >= def.windup) { h.atkProg = 1; if (def.ai === 'lunge') { h.state = 'lunge'; h.stateT = 0; h.x.hit = false; h.vel.x = tdn.x * 17; h.vel.z = tdn.z * 17; h.vel.y = 5; } else { h.state = 'strike'; h.stateT = 0; strike(h, def); } } }
      else if (h.state === 'lunge') { if (!h.x.hit && Math.hypot(T.x - h.pos.x, T.z - h.pos.z) < 2.4 && Math.abs(T.y - h.pos.y) < 3) { h.x.hit = true; hurtPlayer(def.dmg, h.pos); } if (h.stateT > 0.5) { h.state = 'chase'; h.atkCd = def.atkCd; h.atkProg = 0; } }
      else if (h.state === 'strike') { if (h.stateT > 0.5) { h.state = 'chase'; h.atkCd = def.atkCd; h.atkProg = 0; } }
      break; }
    case 'ranged': {
      if (h.state === 'idle') h.state = 'chase'; face(h, T.x, T.z, 8, dt);
      if (h.state === 'chase') { const want = def.atkRange * 0.6; if (d > want + 3) { moveGround(h, dirx, dirz, def.speed, dt); h.walk += dt * def.speed * 1.5; } else if (d < want - 4) { moveGround(h, -dirx, -dirz, def.speed * 0.8, dt); h.walk += dt * def.speed; } else { moveGround(h, -dirz * 0.6, dirx * 0.6, def.speed * 0.6, dt); h.walk += dt * 2; } if (h.atkCd <= 0 && d < def.atkRange) { h.state = 'windup'; h.stateT = 0; sfx('roar_' + def.id, 0.5); } }
      else if (h.state === 'windup') { h.atkProg = clamp(h.stateT / def.windup, 0, 1); h.vel.x *= 0.7; h.vel.z *= 0.7; if (h.stateT >= def.windup) { fireRanged(h, def, T); h.state = 'strike'; h.stateT = 0; } }
      else if (h.state === 'strike' && h.stateT > 0.45) { h.state = 'chase'; h.atkCd = def.atkCd; h.atkProg = 0; }
      break; }
    case 'swoop': {
      h.flying = true; if (h.state === 'idle' || h.state === 'return') h.state = 'chase';
      const ty = T.y + 7 + Math.sin(G.t + h.uid) * 1.5; 
      if (h.state === 'chase') { h.x.ang = (h.x.ang ?? rand(0, 6)) + dt * 0.9; const cx = T.x + Math.cos(h.x.ang) * 12, cz = T.z + Math.sin(h.x.ang) * 12; const ax = cx - h.pos.x, az = cz - h.pos.z, ad = Math.hypot(ax, az) || 1; h.vel.x += (ax / ad * def.speed - h.vel.x) * Math.min(1, dt * 3); h.vel.z += (az / ad * def.speed - h.vel.z) * Math.min(1, dt * 3); h.vel.y += clamp(ty - h.pos.y, -6, 6) * dt * 3; face(h, T.x, T.z, 6, dt); h.walk += dt * 10; if (h.atkCd <= 0 && d < 30) { h.state = 'windup'; h.stateT = 0; sfx('roar_harpy', 0.6); } }
      else if (h.state === 'windup') { h.atkProg = clamp(h.stateT / def.windup, 0, 1); h.vel.multiplyScalar(0.92); h.vel.y += 8 * dt; face(h, T.x, T.z, 12, dt); if (h.stateT >= def.windup) { h.state = 'dive'; h.stateT = 0; h.x.hit = false; V1.set(T.x - h.pos.x, T.y + 1.2 - h.pos.y, T.z - h.pos.z).normalize().multiplyScalar(def.speed * 2.3); h.vel.copy(V1); } }
      else if (h.state === 'dive') { h.walk += dt * 5; if (!h.x.hit && Math.hypot(T.x - h.pos.x, T.z - h.pos.z) < 2.3 && Math.abs(T.y + 1 - h.pos.y) < 2.5) { h.x.hit = true; if (G.player.inShip) hooks.damageShip?.(def.dmg, h.pos); else hurtPlayer(def.dmg, h.pos); } face(h, h.pos.x + h.vel.x, h.pos.z + h.vel.z, 10, dt); if (h.stateT > 0.9 || h.pos.y < heightAt(h) + 1) { h.state = 'chase'; h.atkCd = def.atkCd; h.atkProg = 0; } }
      break; }
    case 'blink': {
      if (h.state === 'idle') h.state = 'chase'; face(h, T.x, T.z, 9, dt);
      if (h.state === 'chase') { if (d > def.atkRange) { moveGround(h, dirx, dirz, def.speed, dt); h.walk += dt * 8; } else h.vel.multiplyScalar(0.8); if (h.atkCd <= 0 && d < 20) { h.state = 'windup'; h.stateT = 0; h.x.blink = d > 6; if (h.x.blink) fx.burst(V1.set(h.pos.x, h.pos.y + 1.5, h.pos.z), 20, '#b04cff', 5, 0.7, 0.6); } else if (h.atkCd <= 0 && d < def.atkRange * 1.1) { h.state = 'windup'; h.stateT = 0; h.x.blink = false; } }
      else if (h.state === 'windup') { h.atkProg = clamp(h.stateT / def.windup, 0, 1); h.obj.visible = h.x.blink ? (Math.sin(h.stateT * 60) > 0) : true; h.vel.multiplyScalar(0.8); if (h.stateT >= def.windup) { if (h.x.blink) { const a = Math.atan2(T.x - h.pos.x, T.z - h.pos.z) + Math.PI + rand(-0.5, 0.5); const nx = T.x + Math.sin(a) * 3.2, nz = T.z + Math.cos(a) * 3.2; const g = groundAt(nx, nz, T.y + 4); if (g > -1e8) { h.pos.set(nx, g, nz); fx.burst(V1.set(nx, g + 1.5, nz), 20, '#b04cff', 5, 0.7, 0.6); } } h.obj.visible = true; h.state = 'strike'; h.stateT = 0; strike(h, def); } }
      else if (h.state === 'strike' && h.stateT > 0.5) { h.state = 'chase'; h.atkCd = def.atkCd; h.atkProg = 0; }
      break; }
  }
  if (def.flying && def.ai !== 'swoop') flyIdle(h, dt);
}
function flyIdle(h: Hostile, dt: number) { h.vel.y += clamp(h.home.y + h.hover - h.pos.y, -4, 4) * dt * 2; h.walk += dt * 9; h.flying = true; }
function wander(h: Hostile, dt: number, amt: number) {
  const def = h.def as EnemyDef; if (h.stateT > h.x.wt) h.x.wt = 0; if (h.x.wt === undefined || h.x.wt === 0 || h.stateT > h.x.wt) { h.stateT = 0; h.x.wt = rand(2, 5); const a = rand(0, 6.28), r = rand(0, 14); h.x.wx = h.home.x + Math.cos(a) * r; h.x.wz = h.home.z + Math.sin(a) * r; h.x.go = Math.random() < 0.7; }
  if (h.x.go) { const dx = h.x.wx - h.pos.x, dz = h.x.wz - h.pos.z, d = Math.hypot(dx, dz); if (d > 1.5) { face(h, h.x.wx, h.x.wz, 4, 0.016); moveGround(h, dx / d, dz / d, def.speed * amt, dt); h.walk += dt * def.speed * amt * 1.6; } }
}
function strike(h: Hostile, def: EnemyDef) {
  const pl = G.player;
  if (def.ai === 'slam') { const c = V1.set(h.pos.x, h.pos.y, h.pos.z); fx.shockwave(c.clone().setY(c.y + 0.3), def.atkRange * 1.2, '#ffd8a0', 0.5); fx.burst(c, 22, def.id === 'yeti' ? '#e8f4ff' : '#b8a888', 7, 0.8, 0.8, 10, 3); G.cam.shake = Math.max(G.cam.shake, 0.35 * clamp(1 - h.pos.distanceTo(G.camera!.position) / 40, 0, 1)); sfx('explosion', 0.5); areaDamage(c, def.atkRange * 1.15, def.dmg, { team: 'enemy', elem: 'stone' }); }
  else { const reach = def.atkRange * 1.3 + 0.5; const T = tgtPos(); if (Math.hypot(T.x - h.pos.x, T.z - h.pos.z) < reach && Math.abs(T.y - h.pos.y) < 3) { sfx('swing', 0.6); if (pl.inShip) hooks.damageShip?.(def.dmg, h.pos); else hurtPlayer(def.dmg, h.pos); } else sfx('swing', 0.4); fx.slash(V2.set(h.pos.x, h.pos.y, h.pos.z), h.yaw, 1.8, def.id === 'shadow' ? '#b04cff' : '#ffd0d0', 1.8, 0.3, 0.2); }
}
function fireRanged(h: Hostile, def: EnemyDef, T: THREE.Vector3) {
  const o = V1.set(h.pos.x, h.pos.y + 2.2, h.pos.z); const base = new THREE.Vector3(T.x - o.x, T.y + 1.1 - o.y, T.z - o.z).normalize();
  if (def.id === 'fire') { sfx('fire', 0.6); spawnProj({ kind: 'fireball', pos: o.clone(), dir: base, speed: 20, dmg: def.dmg, team: 'enemy', r: 0.8, aoe: 2.5, elem: 'fire', color: 0xff6a1a, trail: 'fire', life: 3, scale: 0.7 }); }
  else { sfx('repeater', 0.8); for (let i = -1; i <= 1; i++) { const d = base.clone().applyAxisAngle(V2.set(0, 1, 0), i * 0.12); spawnProj({ kind: 'laser', pos: o.clone(), dir: d, speed: 30, dmg: def.dmg * 0.7, team: 'enemy', r: 0.5, elem: 'laser', color: 0x6af0ff, life: 2.5 }); } }
}
function castlePos() { const b = useStore.getState().kingdom.buildings.find(x => x.type === 'castle'); return b ? { x: b.x, z: b.z } : null; }
function raidHit(h: Hostile, dt: number) { h.x.rt = (h.x.rt || 0) + dt; if (h.x.rt > 2) { h.x.rt = 0; const k = useStore.getState().kingdom; k.castleHp = Math.max(0, k.castleHp - (h.def as EnemyDef).dmg * 1.2); fx.burst(V1.set(h.pos.x, h.pos.y + 1, h.pos.z), 8, '#ff9a4a', 4, 0.5, 0.4); sfx('hit', 0.5); } }

// ───────── animation ─────────
function animate(h: Hostile, dt: number) {
  const p = h.parts; const t = G.t; const w = h.walk; const mv = clamp(Math.hypot(h.vel.x, h.vel.z) / Math.max(1, h.def.speed || 5), 0, 1.2); const sw = Math.sin(w) * 0.8 * (h.flying ? 0 : mv); const ap = h.atkProg; const st = h.state;
  const set = (o: THREE.Object3D | undefined, x?: number, y?: number, z?: number) => { if (!o) return; if (x !== undefined) o.rotation.x += (x - o.rotation.x) * Math.min(1, dt * 16); if (y !== undefined) o.rotation.y += (y - o.rotation.y) * Math.min(1, dt * 16); if (z !== undefined) o.rotation.z += (z - o.rotation.z) * Math.min(1, dt * 16); };
  if (p.legFL) { set(p.legFL, sw); set(p.legBR, sw); set(p.legFR, -sw); set(p.legBL, -sw); if (p.tail) p.tail.rotation.y = Math.sin(t * 5) * 0.3; if (p.body && h.type === 'wolf') { p.body.position.y = 1.0 + Math.abs(Math.sin(w)) * 0.08 - (st === 'windup' ? 0.25 * ap : 0); p.body.rotation.x = st === 'windup' ? 0.3 * ap : st === 'lunge' ? -0.5 : 0; } if (p.wingL) { p.wingL.rotation.z = Math.sin(t * 10) * 0.4; p.wingR.rotation.z = -Math.sin(t * 10) * 0.4; } if (h.type === 'deer' || h.type === 'stag') { if (p.body) p.body.position.y = 1.5 + Math.abs(Math.sin(w)) * 0.1; } }
  else if (p.wingL && h.type === 'harpy') { const f = st === 'dive' ? 0.2 : Math.sin(t * 14 + h.uid) * 0.8; p.wingL.rotation.z = f; p.wingR.rotation.z = -f; set(p.body, st === 'dive' ? 1.2 : st === 'windup' ? -0.5 : 0.2); if (p.legL) { set(p.legL, 0.5); set(p.legR, 0.5); } }
  else if (p.armL && p.legL) { const hum = h.type === 'goblin'; set(p.legL, sw * 0.9); set(p.legR, -sw * 0.9);
    if (st === 'windup') { set(p.armR, -2.6 * ap, undefined, 0); set(p.armL, hum ? 0 : -2.6 * ap); if (p.torso) set(p.torso, -0.25 * ap); }
    else if (st === 'strike') { const k = clamp(h.stateT / 0.25, 0, 1); set(p.armR, -2.6 + 3.4 * k); set(p.armL, h.type === 'goblin' ? 0 : -2.6 + 3.4 * k); if (p.torso) set(p.torso, 0.3 * k); }
    else { set(p.armL, -sw * 0.7); set(p.armR, sw * 0.7); if (p.torso) set(p.torso, 0); if (p.torso) p.torso.position.y += (((p.torso.userData.y0 ??= p.torso.position.y) + Math.abs(Math.sin(w)) * 0.06) - p.torso.position.y) * 0.3; }
    if (h.def.ai === 'ranged' && st === 'windup') { set(p.armR, -1.5 * ap); }
    if (p.gear) p.gear.rotation.z += dt * 2; }
  else if (p.armL && p.body) { // shadow / fire
    set(p.armL, st === 'windup' ? -2 * ap : Math.sin(t * 2) * 0.2); set(p.armR, st === 'windup' ? -2 * ap : -Math.sin(t * 2) * 0.2); if (st === 'strike') { set(p.armL, 1.2); set(p.armR, 1.2); }
    p.body.position.y = (h.type === 'fire' ? 1.7 : 1.4) + Math.sin(t * 2.5 + h.uid) * 0.15; if (h.type === 'fire') { p.body.rotation.y += dt * 0.8; const s = 1 + Math.sin(t * 9 + h.uid) * 0.06 + ap * 0.2; p.body.scale.setScalar(s); } }
  // idle bob and flying bob
  if (h.flying) h.obj.position.y = h.pos.y + Math.sin(t * 3 + h.uid) * 0.15 * 0;
  // hurt squash
  const sq = h.hurtT > 0 ? 1 - h.hurtT * 0.4 : 1; h.obj.scale.y = (h.def.scale || 1) * sq;
}

// ───────── main update ─────────
let fireTick = 0;
export function updateEnemies(dt: number) {
  const pl = G.player; const camP = G.camera!.position; fireTick += dt;
  // lazy spawn / respawn
  for (const r of recs) {
    if (r.h && !r.h.dead) continue; const s = r.s; const d = Math.hypot(s.x - pl.pos.x, s.z - pl.pos.z) + (Math.abs(s.y - pl.pos.y) > 100 ? 400 : 0);
    if (!r.h) { if (d < 230) { const h = spawnEnemy(s.type, s.x, s.y, s.z, s.isl); (h as any).rec = r; r.h = h; if (s.flying || h.flying) { h.flying = true; h.pos.y = s.y + h.hover; } } }
    else if (r.h.dead && r.h.deadT > 1.3 && r.respawn === 0) { r.respawn = G.t + 150; }
    else if (r.respawn > 0 && G.t > r.respawn && d > 140) { r.respawn = 0; const old = r.h; G.scene!.remove(old.obj); const i = G.hostiles.indexOf(old); if (i >= 0) G.hostiles.splice(i, 1); const h = spawnEnemy(s.type, s.x, s.y, s.z, s.isl); (h as any).rec = r; r.h = h; if (h.flying) h.pos.y = s.y + h.hover; }
  }
  for (let i = G.hostiles.length - 1; i >= 0; i--) {
    const h = G.hostiles[i]; if (h.kind === 'boss') continue;
    const dd = h.pos.distanceTo(camP); h.active = dd < 260 && !(h.dead && h.deadT > 1.3); h.obj.visible = dd < 230 && !(h.dead && h.deadT > 1.3 && h.kind !== 'enemy');
    if (h.dead) { updateDeath(h, dt, i); continue; }
    if (!h.active) continue;
    h.hurtT = Math.max(0, h.hurtT - dt); h.slowT = Math.max(0, h.slowT - dt);
    if (h.burnT > 0) { h.burnT -= dt; h.x.bt = (h.x.bt || 0) + dt; if (h.x.bt > 0.5) { h.x.bt = 0; damageHostile(h, 5 + useStore.getState().level, { elem: 'fire' }); } fx.trail(V1.set(h.pos.x, h.pos.y + h.cy, h.pos.z), '#ff8a2a', 0.8, 0.4, 0.4); if (h.dead) continue; }
    if (h.slowT > 0 && fireTick > 0.15) fx.trail(V1.set(h.pos.x, h.pos.y + h.cy, h.pos.z), '#bfeaff', 0.5, 0.4, 0.5);
    if (h.kind === 'ship') { shipAI(h, dt); continue; }
    think(h, dt); integrate(h, dt); h.obj.position.copy(h.pos); h.obj.rotation.y = h.yaw; animate(h, dt);
    if (h.def.ai === 'blink' || h.type === 'shadow') { if (fireTick > 0.1) fx.trail(V1.set(h.pos.x + rand(-0.4, 0.4), h.pos.y + 0.4, h.pos.z + rand(-0.4, 0.4)), '#8a2aff', 0.6, 0.6, 0.3); }
    if (h.type === 'fire' && fireTick > 0.06) { fx.emit(h.pos.x + rand(-0.6, 0.6), h.pos.y + 1.2 + rand(0, 1.5), h.pos.z + rand(-0.6, 0.6), 0, 2.5, 0, Math.random() < 0.5 ? '#ff8a1a' : '#ffd23a', 0.8, 0.7, 0, 0.5, -0.6); }
    if (h.pos.y < -400) { h.dead = true; h.deadT = 2; }
  }
  if (fireTick > 0.15) fireTick = 0;
}

function updateDeath(h: Hostile, dt: number, idx: number) {
  h.deadT += dt; const k = clamp(h.deadT / 1.1, 0, 1);
  if (h.kind === 'ship') { // crash
    h.vel.y -= 25 * dt; h.pos.y += h.vel.y * dt; h.pos.x += h.vel.x * dt; h.pos.z += h.vel.z * dt; h.obj.rotation.z += dt * 1.5; h.obj.rotation.x += dt * 0.6; h.obj.position.copy(h.pos);
    if (fireTick > 0.05) { fx.trail(h.pos, '#ff7a1a', 2.2, 0.8, 1.5); fx.trail(h.pos, '#333', 2.5, 1.2, 1.5); }
    const g = groundAt(h.pos.x, h.pos.z, h.pos.y + 5); if (h.deadT > 4 || (g > -1e8 && h.pos.y < g + 1)) { fx.explosion(h.pos, 3.5, 'big'); sfx('explosion'); G.cam.shake = Math.max(G.cam.shake, 0.4 * clamp(1 - h.pos.distanceTo(G.camera!.position) / 150, 0, 1)); G.scene!.remove(h.obj); G.hostiles.splice(idx, 1); }
    return; }
  if (!h.flying || h.type === 'wolf') { h.obj.rotation.z = Math.min(1.5, k * 3) * (h.type === 'wolf' || h.type === 'deer' || h.type === 'stag' ? 1 : 0.9); h.obj.position.y = h.pos.y - k * 0.4; } else { h.vel.y -= 30 * dt; h.pos.y += h.vel.y * dt; const g = heightAt(h); if (g > -1e8 && h.pos.y < g) h.pos.y = g; h.obj.position.y = h.pos.y; h.obj.rotation.x += dt * 4; }
  if (h.deadT > 0.7) { h.obj.scale.setScalar(Math.max(0.01, (h.def.scale || 1) * (1 - (h.deadT - 0.7) / 0.6))); }
  if (h.deadT > 1.3) { h.obj.visible = false; if ((h as any).rec === undefined) { G.scene!.remove(h.obj); G.hostiles.splice(idx, 1); } }
}

function shipAI(h: Hostile, dt: number) {
  const T = tgtPos(); const x = h.x; const dx = T.x - h.pos.x, dz = T.z - h.pos.z, d = Math.hypot(dx, dz);
  x.ang += dt * 0.3 * x.dir; const want = 55; const cx = T.x + Math.cos(x.ang) * want, cz = T.z + Math.sin(x.ang) * want; const ax = cx - h.pos.x, az = cz - h.pos.z, ad = Math.hypot(ax, az) || 1; const sp = d > 140 ? 40 : 22;
  h.vel.x += (ax / ad * sp - h.vel.x) * Math.min(1, dt * 1.2); h.vel.z += (az / ad * sp - h.vel.z) * Math.min(1, dt * 1.2); h.vel.y += (clamp(T.y + 14 - h.pos.y, -10, 10) - h.vel.y) * Math.min(1, dt); h.pos.addScaledVector(h.vel, dt);
  const g = groundAt(h.pos.x, h.pos.z, h.pos.y + 10); if (g > -1e8 && h.pos.y < g + 8) h.pos.y = g + 8;
  h.yaw = lerpAng(h.yaw, Math.atan2(dx, dz), dt * 1.5); h.obj.position.copy(h.pos); h.obj.rotation.y = h.yaw; h.obj.rotation.z = clamp(angDiff(h.yaw, Math.atan2(h.vel.x, h.vel.z)) * 0.3, -0.3, 0.3); for (const pr of h.obj.userData.props || []) pr.rotation.z += dt * 30;
  if (fireTick > 0.1) fx.trail(V1.set(h.pos.x - Math.sin(h.yaw) * 5, h.pos.y + 1, h.pos.z - Math.cos(h.yaw) * 5), '#4fd8ff', 1, 0.4, 0.5);
  x.fireCd -= dt; if (x.fireCd <= 0 && d < 130 && d > 20) { x.fireCd = 2.6 - Math.min(1, useStore.getState().level * 0.05); sfx('cannon', 0.6); const o = V1.set(h.pos.x + Math.sin(h.yaw) * 4, h.pos.y + 2, h.pos.z + Math.cos(h.yaw) * 4); const lead = new THREE.Vector3(T.x, T.y, T.z); if (G.player.inShip) lead.addScaledVector(G.ship.vel, d / 60); const dir = lead.sub(o).normalize(); dir.x += rand(-0.03, 0.03); dir.y += rand(-0.02, 0.02); spawnProj({ kind: 'cannon', pos: o.clone(), dir, speed: 60, dmg: (h.def as any).dmg * 1.5, team: 'enemy', r: 1, aoe: 3, elem: 'fire', color: 0x222228, trail: 'smoke', life: 3.5, grav: 1 }); fx.burst(o, 10, '#ffb060', 5, 0.8, 0.4); }
}

hooks.onKill = (h: Hostile) => {
  const st = useStore.getState(); const def = h.def; const pl = G.player; if (pl.lock === h) pl.lock = null;
  if (h.kind === 'boss') return void (hooks as any).bossKill?.(h);
  if (h.kind === 'ship') { st.emitQ('count:pirate'); st.gainXp(def.xp); sfx('explosion'); fx.explosion(h.pos, 1.5, 'big'); h.vel.set(h.vel.x * 0.3, 0, h.vel.z * 0.3); for (const [it, c1, c2, ch] of [['gold', 60, 140, 1], ['ingot', 1, 3, 0.7], ['armor_plate', 1, 1, 0.25], ['engine_core', 1, 1, 0.15], ['crystal', 1, 3, 0.5]] as [string, number, number, number][]) if (Math.random() < ch) spawnLoot(V1.set(h.pos.x + rand(-2, 2), h.pos.y, h.pos.z + rand(-2, 2)), it, Math.round(rand(c1, c2))); st.toast('Pirate airship destroyed!', 'good'); (G as any).pirateCount = Math.max(0, ((G as any).pirateCount || 1) - 1); return; }
  st.gainXp(def.xp); st.set_({ kills: st.kills + 1 }); st.emitQ('kill:' + h.type); st.emitQ('kill:any'); st.addMastery(st.weapon, 1.5);
  sfx('death', 0.6); fx.burst(V1.set(h.pos.x, h.pos.y + h.cy, h.pos.z), 16, h.type === 'shadow' ? '#b04cff' : h.type === 'fire' ? '#ff8a1a' : '#ffe9a0', 6, 0.6, 0.7, 4);
  for (const [it, ch, a, b] of def.loot as [string, number, number, number][]) if (Math.random() < ch) spawnLoot(V2.set(h.pos.x, h.pos.y + 1, h.pos.z), it, Math.round(rand(a, b)));
  if (h.raid && G.event.raid) G.event.raid.alive--;
};
