// Player controller: movement, jump, dodge, block, swim, climb, combat input, items, animation, death/respawn.
import * as THREE from 'three';
import { NPCS, SPELLS, WEAPONS } from './data';
import { sfx } from './audio';
import { areaDamage, castSpell, hooks, startAttack, updateAttackHit } from './combat';
import { fx } from './fx';
import { cyl, grp, sph } from './gfx';
import { buildHero, buildWeapon } from './models';
import { G, angDiff, clamp, input, lerpAng, rand } from './runtime';
import { dmgMul, maxHp, maxMp, maxSp, useStore } from './store';
import { ISLAND_MAP, collide, groundAt, inLava, pondAt } from './world';
import { shipInst } from './airship';
import { shipStats } from './store';

const V1 = new THREE.Vector3(), C = { x: 0, z: 0 };
let hero: THREE.Group | null = null; let heroArmor = ''; let heroWeapon = ''; let shieldObj: THREE.Group | null = null; let walkPh = 0; let footT = 0; let buffer = 0; let safeT = 0; let wasSwim = false;
export const heroObj = () => hero;

export function buildPlayerModel() {
  const st = useStore.getState(); if (hero) G.scene!.remove(hero);
  hero = buildHero(st.armor); heroArmor = st.armor; heroWeapon = st.weapon; G.scene!.add(hero); attachWeapon(); hero.position.copy(G.player.pos);
  if (!shieldObj) { shieldObj = grp(); for (let i = 0; i < 5; i++) { const r = sph(0.38, '#b89868', [Math.cos(i * 1.256) * 1.6, 0, Math.sin(i * 1.256) * 1.6], undefined, 5); r.scale.set(1, 1.3, 1); shieldObj.add(r); } shieldObj.add(cyl(1.7, 1.7, 2.2, '#d8b888', [0, 0, 0], { opacity: 0.18, em: '#d8b888', ei: 0.4 }, 16)); shieldObj.visible = false; G.scene!.add(shieldObj); }
}
function attachWeapon() {
  const st = useStore.getState(); const w = WEAPONS[st.weapon]; const parts = hero!.userData.parts; parts.handR.clear(); parts.handL.clear();
  if (w.kind === 'ranged') { const b = buildWeapon('bow'); b.rotation.x = Math.PI / 2; parts.handL.add(b); }
  else { const m = buildWeapon(w.id, w.color); m.rotation.x = w.id === 'staff' ? 0.25 : w.id === 'spear' ? 1.6 : 1.9; parts.handR.add(m); if (w.id === 'dual') { const m2 = buildWeapon('dual', w.color); m2.rotation.x = 1.9; parts.handL.add(m2); } }
  parts.handR.userData.w = parts.handR.children[0];
}
export function resetPlayer(pos?: THREE.Vector3) {
  const p = G.player; const st = useStore.getState(); if (pos) p.pos.copy(pos); p.vel.set(0, 0, 0); p.hp = maxHp(st); p.sp = maxSp(st); p.mp = maxMp(st); p.dead = false; p.respawnT = 0; p.state = 'idle'; p.inShip = false; p.atkT = 0; p.cd = {}; p.shield = 0; p.invuln = 1.5; p.lock = null; p.climb = null; p.lastSafe.copy(p.pos); p.victoryT = 0; p.powerT = 0; p.buffDmg = 1; if (hero) { hero.rotation.set(0, p.yaw, 0); }
}
const useItemImpl = (id: string): boolean => {
  const st = useStore.getState(); const p = G.player; if ((st.inv[id] || 0) < 1) return false; let ok = true;
  switch (id) {
    case 'hp_potion': if (p.hp >= maxHp(st) - 1) { st.toast('Health is full', 'info'); return false; } p.hp = Math.min(maxHp(st), p.hp + 60); fx.burst(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 16, '#ff7a9a', 4, 0.6, 0.8, -3, 2); break;
    case 'food': if (p.hp >= maxHp(st) - 1) { st.toast('Health is full', 'info'); return false; } p.hp = Math.min(maxHp(st), p.hp + 25); break;
    case 'mp_potion': if (p.mp >= maxMp(st) - 1) { st.toast('Magic is full', 'info'); return false; } p.mp = Math.min(maxMp(st), p.mp + 60); fx.burst(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 16, '#6a9aff', 4, 0.6, 0.8, -3, 2); break;
    case 'sp_potion': p.sp = maxSp(st); p.exhaust = 0; break;
    case 'fire_scroll': if (p.inShip) return false; fx.explosion(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 2, 'fire'); sfx('explosion'); areaDamage(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 9, 80 * dmgMul(st), { elem: 'fire', knock: 12 }); break;
    case 'power_elixir': p.powerT = 60; fx.burst(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 20, '#ffd23a', 5, 0.7, 0.8); break;
    case 'fuel_cell': { const inst = shipInst(); const s = shipStats(st); if (inst.fuel >= s.maxFuel - 1) { st.toast('Fuel tank is full', 'info'); return false; } inst.fuel = s.maxFuel; break; }
    case 'phoenix_feather': st.toast('The feather will revive you automatically if you fall.', 'info'); return false;
    default: ok = false;
  }
  if (ok) { st.removeItem(id, 1); sfx('pickup'); st.toast(`Used ${id.replace('_', ' ')}`, 'info'); }
  return ok;
};
(window as any).__useItem = useItemImpl;
(window as any).__levelUp = () => { const p = G.player; const st = useStore.getState(); p.hp = maxHp(st); p.mp = maxMp(st); p.sp = maxSp(st); sfx('levelup'); fx.burst(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 40, '#ffe27a', 8, 0.8, 1.2, -2, 4); fx.shockwave(V1.set(p.pos.x, p.pos.y + 0.3, p.pos.z), 8, '#ffe27a', 0.8); };

function respawnPoint(from: THREE.Vector3): THREE.Vector3 {
  const st = useStore.getState(); let best: THREE.Vector3 | null = null; let bd = 1e9;
  for (const n of NPCS) { const isl = Object.values(ISLAND_MAP).find(i => i.id === n.island)!; const idMap: Record<string, string> = { verdant: 'verdant', haven: 'haven', frost: 'frost', ruins: 'ruins', ember: 'ember', shadow: 'shadow', celestial: 'celestial' }; if (!st.discovered.includes(idMap[n.island])) continue; const x = isl.x + n.lx + 4, z = isl.z + n.lz + 4; const g = groundAt(x, z, isl.y + 80); if (g < -1e8) continue; const d = Math.hypot(x - from.x, z - from.z) + Math.abs(g - from.y); if (d < bd) { bd = d; best = new THREE.Vector3(x, g + 0.5, z); } }
  return best || new THREE.Vector3(0, 3, 16);
}
hooks.onPlayerDeath = () => {
  const st = useStore.getState(); const p = G.player;
  if (st.inv.phoenix_feather > 0) { st.removeItem('phoenix_feather', 1); p.hp = maxHp(st) * 0.6; p.invuln = 3; st.toast('The Phoenix Feather burns — you are revived!', 'good'); st.setBanner('REBORN', 'Phoenix Feather'); fx.explosion(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 2.5, 'fire'); sfx('levelup'); areaDamage(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 10, 60, { elem: 'fire', knock: 14 }); return; }
  p.dead = true; p.respawnT = 4; p.state = 'dead'; p.lock = null; p.charging = false; p.blocking = false; sfx('death'); st.setBanner('YOU DIED', 'Resting at the nearest outpost...');
  if (p.inShip) { p.inShip = false; }
};

export function updatePlayer(dt: number) {
  const p = G.player; const st = useStore.getState(); const cam = G.cam; const maxH = maxHp(st);
  if (!hero || st.armor !== heroArmor) buildPlayerModel(); else if (st.weapon !== heroWeapon) { heroWeapon = st.weapon; attachWeapon(); }
  const parts = hero!.userData.parts as Record<string, THREE.Object3D>;
  const frozen = !!cam.cine;
  // camera look
  const sens = 0.0024 * st.settings.sens; cam.yaw -= (input.mdx + input.touchLook.x) * sens; cam.pitch = clamp(cam.pitch + (input.mdy + input.touchLook.y) * sens * (st.settings.invertY ? -1 : 1), -0.6, 1.25); input.touchLook.x = 0; input.touchLook.y = 0;
  if (input.wheel && !p.inShip && !input.keys.has('ShiftLeft')) { cam.dist = clamp(cam.dist + input.wheel * 0.8, 4, 14); }
  // timers
  p.invuln = Math.max(0, p.invuln - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.exhaust = Math.max(0, p.exhaust - dt); p.regenDelay = Math.max(0, p.regenDelay - dt); p.mpDelay = Math.max(0, p.mpDelay - dt); p.powerT = Math.max(0, p.powerT - dt); p.buffDmg = p.powerT > 0 ? 1.4 : 1; p.victoryT = Math.max(0, p.victoryT - dt); p.castT = Math.max(0, p.castT - dt); p.landT = Math.max(0, p.landT - dt);
  for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt); p.shieldT = Math.max(0, p.shieldT - dt); if (p.shieldT <= 0) p.shield = 0; p.stateT += dt; p.comboT = Math.max(0, p.comboT - dt); buffer = Math.max(0, buffer - dt); G.comboShow = Math.max(0, G.comboShow - dt); if (G.comboShow <= 0) G.comboCount = 0; G.combatT = Math.max(0, G.combatT - dt);
  // regen
  if (!p.dead) { if (p.regenDelay <= 0 && !p.sprinting && !p.blocking && p.dodgeT <= 0) p.sp = Math.min(maxSp(st), p.sp + (p.inShip ? 40 : 24 + st.skills.stamina * 2) * dt); if (p.mpDelay <= 0) p.mp = Math.min(maxMp(st), p.mp + (3.5 + st.skills.magic * 0.5) * dt); if (G.combatT <= 0 && p.hp < maxH) p.hp = Math.min(maxH, p.hp + 1.5 * dt); if (p.hp > maxH) p.hp = maxH; }
  // shield visual
  if (shieldObj) { shieldObj.visible = p.shield > 0; if (p.shield > 0) { shieldObj.position.set(p.pos.x, p.pos.y + 1.1, p.pos.z); shieldObj.rotation.y += dt * 2; } }
  // ship riding
  if (p.inShip) { hero!.visible = false; p.pos.copy(G.ship.pos); p.vel.set(0, 0, 0); p.lock = null; if (!p.dead) { /* airship handles input */ } hero!.position.copy(p.pos); return; }
  hero!.visible = true;
  // death
  if (p.dead) { p.respawnT -= dt; const k = clamp(1 - p.respawnT / 0.6, 0, 1); hero!.rotation.x = -1.4 * k; if (p.respawnT <= 0) { const gold = st.inv.gold || 0; const lost = Math.floor(gold * 0.1); const rp = respawnPoint(p.pos); st.set_({ inv: { ...st.inv, gold: gold - lost } }); resetPlayer(rp); hero!.rotation.x = 0; st.toast(`You wake at an outpost. Lost ${lost} gold.`, 'bad'); } hero!.position.copy(p.pos); return; }
  if (frozen) { p.vel.set(0, p.vel.y, 0); hero!.position.copy(p.pos); animateHero(parts, dt, 0); return; }

  // ground / swim
  const pond = pondAt(p.pos.x, p.pos.z); const gnd = groundAt(p.pos.x, p.pos.z, p.pos.y + 1.1); const swim = !!pond && gnd < pond.y - 0.7 && p.pos.y < pond.y + 0.15; p.swimming = swim;
  if (swim && !wasSwim) { sfx('splash'); fx.burst(V1.set(p.pos.x, pond!.y, p.pos.z), 20, '#bfe8ff', 5, 0.6, 0.6, 8, 3); } wasSwim = swim;
  if (p.climb) { updateClimb(dt); hero!.position.copy(p.pos); hero!.rotation.y = p.yaw; animateHero(parts, dt, 0); return; }

  // lock-on
  if (input.hit('Tab') || input.hit('KeyT')) { if (p.lock) { p.lock = null; } else { const d = new THREE.Vector3(); G.camera!.getWorldDirection(d); let best: any = null, bs = 1e9; for (const h of G.hostiles) { if (h.dead || !h.active || !h.lockable) continue; const dx = h.pos.x - p.pos.x, dz = h.pos.z - p.pos.z; const dist = Math.hypot(dx, dz); if (dist > 45) continue; const ang = Math.abs(angDiff(Math.atan2(d.x, d.z), Math.atan2(dx, dz))); const s = ang * 15 + dist; if (ang < 1.6 && s < bs) { bs = s; best = h; } } p.lock = best; if (best) sfx('click'); } }
  if (p.lock && (p.lock.dead || Math.hypot(p.lock.pos.x - p.pos.x, p.lock.pos.z - p.pos.z) > 60)) p.lock = null;
  // weapon switching
  if (input.hit('KeyQ') || input.hit('KeyX')) { const o = st.weapons; const i = o.indexOf(st.weapon); st.equipWeapon(o[(i + 1) % o.length]); sfx('click'); }
  for (let i = 0; i < 6; i++) if (input.hit('Digit' + (i + 1))) castSpell(i);
  if (input.hit('KeyH')) useItemImpl('hp_potion'); if (input.hit('KeyB')) useItemImpl('mp_potion'); if (input.hit('KeyG')) useItemImpl('food');

  const w = WEAPONS[st.weapon]; const busy = p.atkT > 0 || p.castT > 0;
  // block
  p.blocking = input.block && p.dodgeT <= 0 && p.atkT <= 0 && p.sp > 1 && p.exhaust <= 0 && !swim; if (p.blocking) p.regenDelay = Math.max(p.regenDelay, 0.5);
  // dodge
  if ((input.hit('KeyV') || input.hit('ControlLeft') || input.hit('AltLeft')) && p.dodgeT <= 0 && p.sp >= 18 && p.exhaust <= 0 && !swim && p.hurtT < 0.2) {
    const mx = input.moveX, my = input.moveY; const cy = cam.yaw; let dx = mx * Math.cos(cy) - my * Math.sin(cy), dz = -mx * Math.sin(cy) - my * Math.cos(cy); if (Math.abs(mx) + Math.abs(my) < 0.1) { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); } const l = Math.hypot(dx, dz) || 1; p.dodgeDir.set(dx / l, 0, dz / l); p.dodgeT = 0.4; p.invuln = Math.max(p.invuln, 0.45); p.sp -= 18; p.regenDelay = 1; p.atkT = 0; p.charging = false; sfx('dodge'); fx.burst(V1.set(p.pos.x, p.pos.y + 0.6, p.pos.z), 10, '#cfe8ff', 4, 0.5, 0.4); }
  // attack input
  const edge = input.lmbPressed || input.hit('KeyF'); const held = input.attack; const ranged = w.kind !== 'melee';
  if (!swim && p.dodgeT <= 0 && !p.blocking && p.hurtT <= 0.1 && !G.paused) {
    if (!ranged) {
      if (edge) { if (p.atkT <= 0.08 && p.castT <= 0) startAttack('light'); else buffer = 0.3; }
      if (buffer > 0 && p.atkT <= 0 && p.castT <= 0) { buffer = 0; startAttack('light'); }
      if (held && p.atkT <= 0) { p.chargeT += dt; p.charging = p.chargeT > 0.4; } else { if (!held && p.chargeT > 0.9 && p.atkT <= 0) { startAttack('heavy', clamp((p.chargeT - 0.9) / 0.8, 0, 1)); } if (!held || p.atkT > 0) { p.chargeT = 0; p.charging = false; } }
    } else {
      if (held && p.atkT <= 0 && p.castT <= 0) { p.drawT += dt; p.charging = true; p.chargeT = p.drawT; } else if (!held && p.drawT > 0) { const c = clamp(p.drawT / (w.id === 'bow' ? 0.9 : 0.8), 0, 1); if (p.drawT > 0.08) startAttack(c >= 0.98 ? 'heavy' : 'light', c); p.drawT = 0; p.charging = false; p.chargeT = 0; } if (p.atkT > 0) { p.drawT = 0; p.charging = false; } }
  } else { if (!held) { p.drawT = 0; } }
  if (p.charging && Math.random() < 0.6) { const wp = parts.handR.getWorldPosition(V1); fx.emit(wp.x + rand(-0.3, 0.3), wp.y + rand(0, 0.8), wp.z + rand(-0.3, 0.3), 0, 2, 0, w.color, 0.35, 0.4, 0, 0, 0); }
  if (p.atkT > 0) { p.atkT -= dt; if (p.atkT <= 0) { p.atkT = 0; p.comboT = 0.8; p.state = 'idle'; } }
  updateAttackHit(dt);

  // movement
  const mx = input.moveX, my = input.moveY; const mag = Math.min(1, Math.hypot(mx, my)); const cy = cam.yaw;
  let dx = mx * Math.cos(cy) - my * Math.sin(cy), dz = -mx * Math.sin(cy) - my * Math.cos(cy); const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  p.sprinting = input.sprint && mag > 0.3 && p.sp > 2 && p.exhaust <= 0 && !p.blocking && !busy && !swim && p.onGround;
  let spd = swim ? 4 : p.sprinting ? 12.5 : mag < 0.45 ? 3.8 : 7.6; if (p.blocking) spd *= 0.4; if (p.atkT > 0) spd *= 0.3; if (p.charging) spd *= 0.5; if (p.castT > 0) spd *= 0.5; if (p.hurtT > 0.15) spd *= 0.5;
  if (p.sprinting) { p.sp -= 16 * dt; p.regenDelay = 0.8; if (p.sp <= 0) { p.sp = 0; p.exhaust = 1.2; } }
  let tx = dx * spd * (mag > 0.05 ? 1 : 0) * mag, tz = dz * spd * (mag > 0.05 ? 1 : 0) * mag;
  if (p.dodgeT > 0) { p.dodgeT -= dt; const k = p.dodgeT / 0.4; tx = p.dodgeDir.x * 17 * (0.3 + k); tz = p.dodgeDir.z * 17 * (0.3 + k); p.vel.x = tx; p.vel.z = tz; fx.trail(V1.set(p.pos.x, p.pos.y + 0.8, p.pos.z), '#9ad8ff', 0.5, 0.3, 0.2); p.state = 'dodge'; }
  else { const acc = p.onGround || swim ? 14 : 4.5; p.vel.x += (tx - p.vel.x) * Math.min(1, dt * acc); p.vel.z += (tz - p.vel.z) * Math.min(1, dt * acc); }
  p.moveAmt = Math.hypot(p.vel.x, p.vel.z);
  // facing
  if (p.atkT <= 0.0 && p.dodgeT <= 0) {
    if (p.lock) p.yaw = lerpAng(p.yaw, Math.atan2(p.lock.pos.x - p.pos.x, p.lock.pos.z - p.pos.z), dt * 12);
    else if (p.charging && ranged || p.blocking || p.castT > 0) p.yaw = lerpAng(p.yaw, cy + Math.PI, dt * 14);
    else if (mag > 0.1) p.yaw = lerpAng(p.yaw, Math.atan2(dx, dz), dt * 12);
  } else if (p.dodgeT > 0) p.yaw = lerpAng(p.yaw, Math.atan2(p.dodgeDir.x, p.dodgeDir.z), dt * 14);
  // vertical
  if (swim) { p.vel.y += ((pond!.y - 0.85) - p.pos.y) * dt * 6 - p.vel.y * dt * 4; p.onGround = false; p.jumps = 0; if (input.hit('Space')) { p.vel.y = 8.5; sfx('splash'); } if (p.moveAmt > 1 && Math.random() < 0.3) fx.trail(V1.set(p.pos.x, pond!.y + 0.05, p.pos.z), '#d8f4ff', 0.6, 0.6, 0.3); }
  else {
    p.vel.y -= 30 * dt; if (p.vel.y < -60) p.vel.y = -60;
    if (input.hit('Space') && !busy && p.dodgeT <= 0 && p.hurtT <= 0.15) { if (p.onGround) { p.vel.y = 11; p.jumps = 1; p.onGround = false; sfx('jump'); p.state = 'jump'; } else if (p.jumps < 2) { p.vel.y = 9.5; p.jumps = 2; sfx('jump'); fx.burst(V1.set(p.pos.x, p.pos.y, p.pos.z), 10, '#cfe8ff', 3, 0.5, 0.4); fx.shockwave(V1.set(p.pos.x, p.pos.y + 0.1, p.pos.z), 2, '#cfe8ff', 0.3); } }
  }
  // integrate
  const nx = p.pos.x + p.vel.x * dt, nz = p.pos.z + p.vel.z * dt; const ng = groundAt(nx, nz, p.pos.y + 1.1);
  if (ng > -1e8 || p.pos.y > (gnd > -1e8 ? gnd : p.pos.y) + 0.5) { collide(nx, nz, 0.55, C, p.pos.y); p.pos.x = C.x; p.pos.z = C.z; } else if (p.onGround && p.dodgeT <= 0) { /* edge: allow walking off */ p.pos.x = nx; p.pos.z = nz; }
  else { p.pos.x = nx; p.pos.z = nz; }
  p.pos.y += p.vel.y * dt;
  const g2 = groundAt(p.pos.x, p.pos.z, p.pos.y + 1.1);
  if (!swim && g2 > -1e8 && p.pos.y <= g2 + 0.02 && p.vel.y <= 0.01) {
    if (!p.onGround) { const fv = -p.vel.y; if (fv > 30) { const dmg = (fv - 30) * 1.8; p.hp -= dmg; fx.dmg(V1.set(p.pos.x, p.pos.y + 2, p.pos.z), `-${Math.round(dmg)}`, '#ff6a6a'); sfx('hurt'); if (p.hp <= 0) { p.hp = 1; } } p.landT = 0.25; if (fv > 6) { sfx('land'); fx.burst(V1.set(p.pos.x, p.pos.y + 0.2, p.pos.z), Math.min(14, fv), '#d8c8a8', 3, 0.7, 0.5, 4); } }
    p.pos.y = g2; p.vel.y = 0; p.onGround = true; p.jumps = 0; p.fallV = 0;
  } else if (!swim) { if (p.onGround && g2 > -1e8 && p.pos.y - g2 < 0.5 && p.vel.y <= 0) { p.pos.y = g2; p.vel.y = 0; } else p.onGround = false; }
  // safe spot, falling out of world, lava
  safeT -= dt; if (p.onGround && safeT <= 0 && !swim) { safeT = 0.6; let ok = true; for (let a = 0; a < 6; a++) { if (groundAt(p.pos.x + Math.cos(a * 1.047) * 3.5, p.pos.z + Math.sin(a * 1.047) * 3.5, p.pos.y + 3) < -1e8) { ok = false; break; } } if (ok && !inLava(p.pos.x, p.pos.z)) p.lastSafe.copy(p.pos); }
  if (p.pos.y < p.lastSafe.y - 90 || p.pos.y < -400) { p.pos.copy(p.lastSafe); p.pos.y += 1; p.vel.set(0, 0, 0); const d = Math.round(maxH * 0.12); p.hp -= d; st.toast('You fell off the island! Pulled back by the sky currents.', 'bad'); sfx('hurt'); if (p.hp <= 0) { p.hp = 1; } fx.burst(V1.set(p.pos.x, p.pos.y + 1, p.pos.z), 14, '#9ad8ff', 5, 0.6, 0.6); }
  if (p.onGround && inLava(p.pos.x, p.pos.z)) { p.lavaT += dt; fx.trail(V1.set(p.pos.x, p.pos.y + 0.5, p.pos.z), '#ff8a1a', 0.8, 0.4, 0.3); if (p.lavaT > 0.4) { p.lavaT = 0; import('./combat').then(m => m.hurtPlayer(12, null, { unblockable: true, knock: 0, elem: 'fire' })); p.vel.y = 8; } } else p.lavaT = 0;
  // state
  if (p.atkT <= 0 && p.dodgeT <= 0 && p.castT <= 0) p.state = p.victoryT > 0 ? 'victory' : swim ? 'swim' : p.hurtT > 0.15 ? 'hurt' : !p.onGround ? (p.vel.y > 0 ? 'jump' : 'fall') : p.blocking ? 'block' : p.landT > 0 ? 'land' : p.moveAmt > 1 ? 'run' : 'idle';
  // footsteps
  if (p.state === 'run') { footT -= dt * (p.sprinting ? 1.6 : 1); if (footT <= 0) { footT = 0.34; sfx('tick', 0.5); } }
  // sprint dust
  if (p.sprinting && Math.random() < 0.4) fx.trail(V1.set(p.pos.x, p.pos.y + 0.2, p.pos.z), '#e8dcc0', 0.5, 0.4, 0.3);
  // apply
  hero!.position.copy(p.pos); hero!.rotation.y = p.yaw; animateHero(parts, dt, p.moveAmt);
  void maxMp; void hero;
}

function updateClimb(dt: number) {
  const p = G.player; const c = p.climb!; c.t += dt / 2.6; const k = clamp(c.t, 0, 1); p.pos.lerpVectors(c.from, c.to, k); p.state = 'climb'; p.vel.set(0, 0, 0);
  if (k >= 1) { p.climb = null; p.onGround = true; p.lastSafe.copy(p.pos); sfx('chest'); }
}
export function startClimb(to: THREE.Vector3, yaw: number) { const p = G.player; p.climb = { t: 0, from: p.pos.clone(), to: to.clone() }; p.yaw = yaw; p.atkT = 0; p.charging = false; }

// ───────── hero animation ─────────
function animateHero(P: Record<string, THREE.Object3D>, dt: number, speed: number) {
  const p = G.player; const t = G.t; const k = Math.min(1, dt * 14); const set = (o: THREE.Object3D | undefined, x?: number, y?: number, z?: number, kk = k) => { if (!o) return; if (x !== undefined) o.rotation.x += (x - o.rotation.x) * kk; if (y !== undefined) o.rotation.y += (y - o.rotation.y) * kk; if (z !== undefined) o.rotation.z += (z - o.rotation.z) * kk; };
  const hero_ = hero!; const w = WEAPONS[useStore.getState().weapon]; walkPh += dt * (p.state === 'run' ? (p.sprinting ? 14 : 10) : 6); const sw = Math.sin(walkPh); const s = p.state;
  let bodyX = 0, y0 = 0; let lL = 0, lR = 0, aL = 0, aR = 0, aLz = 0, aRz = 0, torY = 0, headX = 0;
  if (s === 'run') { lL = sw * 0.9; lR = -sw * 0.9; aL = -sw * 0.8; aR = sw * 0.8; bodyX = p.sprinting ? 0.35 : 0.15; y0 = Math.abs(Math.cos(walkPh)) * 0.07; }
  else if (s === 'idle') { aL = Math.sin(t * 1.5) * 0.04; aR = -Math.sin(t * 1.5) * 0.04; y0 = Math.sin(t * 1.8) * 0.015; }
  else if (s === 'jump') { lL = -0.5; lR = 0.3; aL = -2.3; aR = -2.3; aLz = -0.3; aRz = 0.3; }
  else if (s === 'fall') { lL = 0.3; lR = -0.2; aL = -2.6; aR = -2.6; aLz = -0.5; aRz = 0.5; bodyX = -0.1; }
  else if (s === 'land') { lL = -0.6; lR = -0.6; bodyX = 0.3; y0 = -0.2; aL = 0.4; aR = 0.4; }
  else if (s === 'block') { aL = -1.3; aR = -1.4; aLz = 0.5; aRz = -0.5; bodyX = 0.1; }
  else if (s === 'hurt') { bodyX = -0.35; aL = -0.8; aR = -0.8; headX = -0.3; }
  else if (s === 'victory') { aL = -2.9 + Math.sin(t * 8) * 0.2; aR = -2.9 - Math.sin(t * 8) * 0.2; aLz = -0.3; aRz = 0.3; y0 = Math.abs(Math.sin(t * 5)) * 0.25; }
  else if (s === 'swim') { bodyX = 1.1; lL = sw * 0.6; lR = -sw * 0.6; aL = -2.4 + Math.sin(walkPh) * 0.9; aR = -2.4 - Math.sin(walkPh) * 0.9; y0 = -0.3; }
  else if (s === 'climb') { const ph = t * 6; aL = -2.6 + Math.sin(ph) * 0.6; aR = -2.6 - Math.sin(ph) * 0.6; lL = Math.sin(ph + 1) * 0.7; lR = -Math.sin(ph + 1) * 0.7; bodyX = 0.05; }
  else if (s === 'dodge') { bodyX = 0.9; lL = -0.8; lR = 0.8; aL = 0.8; aR = 0.8; }
  else if (s === 'cast') { aL = -1.6; aR = -1.6; bodyX = -0.05; }
  else if (s === 'dead') { aL = 0.2; aR = 0.2; }
  if (p.atkT > 0 && s === 'attack') {
    const kk = 1 - p.atkT / p.atkDur; const heavy = p.atkKind === 'heavy'; const step = p.atkStep; const side = step % 2 ? -1 : 1;
    if (w.kind === 'melee') {
      if (w.id === 'spear') { const th = Math.sin(clamp(kk * 1.6, 0, 1) * Math.PI); aR = -1.5; aL = -1.2; aRz = 0; bodyX = 0.1 + th * 0.2; set(P.torso, undefined, -0.5 * (1 - th), undefined); hero_.position.addScaledVector(V1.set(Math.sin(p.yaw), 0, Math.cos(p.yaw)), th * 0.7); }
      else { const sw2 = clamp(kk / 0.6, 0, 1); const ang = -2.4 + (heavy ? 3.2 : 2.9) * (sw2 * sw2 * (3 - 2 * sw2)); aR = ang; aRz = side * (kk < 0.7 ? 0.3 : 0); torY = side * (-0.7 + 1.4 * sw2); bodyX = 0.25 * sw2; if (w.id === 'dual') { aL = -2.4 + 2.9 * clamp((kk - 0.1) / 0.6, 0, 1); aLz = -aRz; } if (w.id === 'greatsword') { aL = ang; aLz = 0; } }
    } else { aL = -1.55; aR = w.kind === 'ranged' ? -1.55 : -1.9 + kk * 0.6; bodyX = -0.05; }
  } else if (p.charging) { if (w.kind === 'melee') { aR = -2.5; aRz = 0.2; bodyX = -0.1; torY = -0.3; } else { aL = -1.55; aR = -1.1; aRz = 0.3; headX = 0; } }
  if (s === 'cast') { aL = -1.7; aR = -1.7 + Math.sin(t * 20) * 0.1; }
  set(P.legL, lL); set(P.legR, lR); set(P.armL, aL, undefined, -0.12 + aLz); set(P.armR, aR, undefined, 0.12 + aRz); set(P.torso, bodyX, torY); set(P.head, headX);
  if (P.cape) set(P.cape, 0.25 + Math.min(1, speed / 10) * 0.7 + Math.sin(t * 6) * 0.06 * Math.min(1, speed / 6), undefined, undefined, 0.2);
  if (s === 'dodge') { hero_.rotation.x += (0.7 - hero_.rotation.x) * k; } else if (s !== 'dead' && s !== 'swim') hero_.rotation.x += (0 - hero_.rotation.x) * k;
  hero_.position.y += y0; if (s === 'swim') hero_.position.y += -0.3;
  void SPELLS;
}
