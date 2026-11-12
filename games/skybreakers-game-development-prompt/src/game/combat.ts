// Combat core: damage, projectiles, spells, player attacks, loot pickups.
import * as THREE from 'three';
import { ARMORS, ITEMS, SPELLS, WEAPONS } from './data';
import { fx } from './fx';
import { at, box, cone, cyl, glow, grp, ico, sph, torus } from './gfx';
import { sfx } from './audio';
import { dmgMul, masteryLevel, spellMul, useStore } from './store';
import { G, input, rand, type Hostile, type Proj, clamp } from './runtime';
import { groundAt } from './world';

export const hooks: { onKill?: (h: Hostile) => void; damageShip?: (n: number, from?: THREE.Vector3) => void; onPlayerDeath?: () => void } = {};
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
export const hostileCenter = (h: Hostile, out = V3) => out.set(h.pos.x, h.pos.y + h.cy, h.pos.z);

// ───────── damage ─────────
export function damageHostile(h: Hostile, amt: number, o: { crit?: boolean; knock?: THREE.Vector3 | null; slow?: number; burn?: number; stun?: number; elem?: string; src?: string } = {}) {
  if (h.dead) return 0; if (h.kind === 'boss' && !G.bossFight) return 0;
  amt *= h.vuln || 1; if (G.player.powerT > 0) amt *= 1.4; amt = Math.max(1, Math.round(amt));
  h.hp -= amt; h.hurtT = 0.2; h.dmgTaken += amt; h.aggro = true; if (o.slow) h.slowT = Math.max(h.slowT, o.slow); if (o.burn) h.burnT = Math.max(h.burnT, o.burn); if (o.stun && h.kind !== 'boss') h.stunT = Math.max(h.stunT, o.stun);
  if (o.knock && h.kind === 'enemy') { h.vel.x += o.knock.x; h.vel.z += o.knock.z; h.vel.y += Math.max(0, o.knock.y); }
  fx.dmg(V1.set(h.pos.x, h.pos.y + h.cy + h.r * 0.6, h.pos.z), String(amt), o.crit ? '#ffd23a' : o.elem === 'fire' ? '#ff9a4a' : o.elem === 'ice' ? '#9ae8ff' : '#ffffff', !!o.crit || amt > 60);
  fx.sparks(hostileCenter(h), o.elem === 'ice' ? '#bfeaff' : o.elem === 'fire' ? '#ff9a4a' : '#ffe9a0', o.crit ? 16 : 8);
  sfx(o.crit ? 'crit' : 'hit', 0.8); G.combatT = 8; G.comboCount++; G.comboShow = 2.2;
  if (o.crit || amt > 50) G.hitStop = 0.05;
  if (h.hp <= 0) { h.hp = 0; h.dead = true; h.deadT = 0; hooks.onKill?.(h); }
  return amt;
}
export function hurtPlayer(amount: number, from?: THREE.Vector3 | null, o: { unblockable?: boolean; knock?: number; elem?: string } = {}) {
  const p = G.player; const st = useStore.getState(); if (p.dead || p.invuln > 0 || G.cam.cine) return;
  amount *= 1 - ARMORS[st.armor].def;
  if (p.blocking && !o.unblockable && from) { const a = Math.atan2(from.x - p.pos.x, from.z - p.pos.z); let d = Math.abs(((a - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI); d = Math.abs(d); if (d < 1.9) { amount *= 0.2; p.sp -= amount * 3 + 6; sfx('block'); fx.sparks(V1.set(p.pos.x, p.pos.y + 1.2, p.pos.z), '#cfe8ff', 12); if (p.sp <= 0) { p.sp = 0; p.blocking = false; p.exhaust = 1.5; p.hurtT = 0.4; } p.invuln = 0.25; fx.dmg(V1.set(p.pos.x, p.pos.y + 2.2, p.pos.z), 'BLOCK', '#9ad8ff'); if (amount < 1) return; } }
  if (p.shield > 0) { const ab = Math.min(p.shield, amount); p.shield -= ab; amount -= ab; fx.sparks(V1.set(p.pos.x, p.pos.y + 1.2, p.pos.z), '#d8b888', 8); if (p.shield <= 0) p.shieldT = 0; }
  if (amount < 0.5) { p.invuln = 0.3; return; }
  amount = Math.max(1, Math.round(amount)); p.hp -= amount; p.invuln = 0.55; p.hurtT = 0.35; p.regenDelay = 4; G.combatT = 8; G.cam.shake = Math.max(G.cam.shake, 0.35); sfx('hurt');
  fx.dmg(V1.set(p.pos.x, p.pos.y + 2.2, p.pos.z), `-${amount}`, '#ff6a6a', true); fx.burst(V1.set(p.pos.x, p.pos.y + 1.2, p.pos.z), 8, o.elem === 'fire' ? '#ff8a2a' : '#ff5a5a', 5, 0.4, 0.4);
  if (from && (o.knock ?? 1)) { V2.set(p.pos.x - from.x, 0, p.pos.z - from.z).normalize().multiplyScalar(6 * (o.knock ?? 1)); p.vel.x += V2.x; p.vel.z += V2.z; }
  if (p.charging || p.atkT > 0) { p.atkT = 0; p.charging = false; p.chargeT = 0; p.drawT = 0; }
  if (p.hp <= 0) { p.hp = 0; hooks.onPlayerDeath?.(); }
}

// ───────── projectile meshes ─────────
const pm = new Map<string, THREE.Material>();
const bm = (c: number | string, add = true) => { const k = `${c}${add}`; let m = pm.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: add, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !add }); pm.set(k, m); } return m as THREE.MeshBasicMaterial; };
function projMesh(kind: string, color: number): THREE.Object3D {
  const c = new THREE.Color(color).getStyle();
  switch (kind) {
    case 'fireball': return grp(new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), bm(0xffc060)), glow(c, 3.4), new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), bm(color)));
    case 'ice': { const m = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.4, 5), bm(0xcff4ff)); m.rotation.x = Math.PI / 2; return grp(m, glow(c, 1.6)); }
    case 'wind': { const m = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 4, 14, Math.PI * 0.8), bm(0xd8ffe8)); m.rotation.set(Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.1 - Math.PI * 0.4); m.rotation.z = -Math.PI * 0.5 + 0.0; const g = grp(m, glow(c, 2.4)); return g; }
    case 'arrow': { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), bm(0xe8d8a8, false)); s.rotation.x = Math.PI / 2; const t = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 4), bm(0xd8d8e8, false)); t.rotation.x = Math.PI / 2; t.position.z = 0.7; g.add(s, t, glow(c, 0.9)); return g; }
    case 'bolt': return grp(new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bm(0xf0d8ff)), glow(c, 2.6));
    case 'orb': return grp(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bm(color)), glow(c, 3));
    case 'laser': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 5), bm(0x9af0ff)); m.rotation.x = Math.PI / 2; return grp(m, glow('#6af0ff', 1.8)); }
    case 'cannon': return grp(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bm(0x222228, false)), glow('#ff9a3a', 1.6, undefined, 0.6));
    case 'bullet': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 4), bm(0xfff0a0)); m.rotation.x = Math.PI / 2; return grp(m, glow('#ffd060', 1.2)); }
    case 'missile': { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 6), bm(0xcccccc, false)); b.rotation.x = Math.PI / 2; const n = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), bm(0xd94a4a, false)); n.rotation.x = Math.PI / 2; n.position.z = 0.95; g.add(b, n, glow('#ff8a2a', 2.4, [0, 0, -0.9])); return g; }
    case 'energy': return grp(new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), bm(0x9af8ff)), new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), bm(0x4ac8ff)), glow('#6af0ff', 9));
    case 'bomb': return grp(new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), bm(0x1a1a22, false)), glow('#ff4a1a', 1.2, [0, 0.8, 0]));
    case 'rock': return new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({ color: '#8a8478', flatShading: true }));
    case 'feather': { const m = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.2, 4), bm(0xff8aff)); m.rotation.x = Math.PI / 2; return grp(m, glow('#ff8aff', 1.4)); }
    default: return sph(0.4, color);
  }
}
export interface ProjOpt { kind: string; pos: THREE.Vector3; dir: THREE.Vector3; speed: number; dmg: number; team: 'player' | 'enemy'; r?: number; life?: number; aoe?: number; elem?: string; color?: number; homing?: Hostile | null; pierce?: boolean; grav?: number; trail?: string; slow?: number; knock?: number; crit?: boolean; fromShip?: boolean; turn?: number; scale?: number }
export function spawnProj(o: ProjOpt) {
  const color = o.color ?? 0xffffff; const mesh = projMesh(o.kind, color); if (o.scale) mesh.scale.setScalar(o.scale); mesh.position.copy(o.pos); G.scene!.add(mesh);
  const p: Proj = { mesh, pos: o.pos.clone(), vel: o.dir.clone().normalize().multiplyScalar(o.speed), life: o.life ?? 2.5, dmg: o.dmg, team: o.team, r: o.r ?? 0.8, aoe: o.aoe ?? 0, elem: o.elem ?? '', homing: o.homing ?? null, pierce: !!o.pierce, hit: new Set(), grav: o.grav ?? 0, trail: o.trail ?? '', color, kind: o.kind, slow: o.slow, knock: o.knock, crit: o.crit, fromShip: o.fromShip, turn: o.turn };
  G.projs.push(p); return p;
}
export function areaDamage(c: THREE.Vector3, radius: number, dmg: number, o: { elem?: string; slow?: number; burn?: number; stun?: number; knock?: number; player?: boolean; team?: 'player' | 'enemy'; crit?: boolean } = {}) {
  if (o.team !== 'enemy') for (const h of G.hostiles) { if (h.dead || !h.active) continue; const d = Math.hypot(h.pos.x - c.x, h.pos.y + h.cy - c.y, h.pos.z - c.z) - h.r; if (d < radius) { V2.set(h.pos.x - c.x, 0.3, h.pos.z - c.z).normalize().multiplyScalar((o.knock ?? 8) * (1 - d / radius * 0.5)); damageHostile(h, dmg * (1 - clamp(d / radius, 0, 1) * 0.4), { elem: o.elem, slow: o.slow, burn: o.burn, stun: o.stun, knock: V2, crit: o.crit, src: 'spell' }); } }
  if (o.team === 'enemy' || o.player) { const p = G.player; if (!p.inShip) { const d = Math.hypot(p.pos.x - c.x, p.pos.y + 1 - c.y, p.pos.z - c.z); if (d < radius + 0.5) hurtPlayer(dmg * (1 - clamp(d / (radius + 0.5), 0, 1) * 0.3), c, { elem: o.elem, knock: 1.4 }); } else { const d = G.ship.pos.distanceTo(c); if (d < radius + 5) hooks.damageShip?.(dmg * 0.8, c); } }
}
export function explodeAt(p: Proj) {
  const kind = p.elem === 'fire' ? 'fire' : p.elem === 'ice' ? 'ice' : p.elem === 'arcane' ? 'arcane' : p.elem === 'lightning' ? 'lightning' : p.elem === 'shadow' ? 'dark' : p.elem === 'stone' ? 'stone' : 'big';
  const sz = Math.max(0.6, p.aoe / 5); fx.explosion(p.pos, sz, kind); sfx('explosion', Math.min(1, 0.5 + sz * 0.3)); G.cam.shake = Math.max(G.cam.shake, Math.min(0.5, 0.1 * sz * Math.max(0, 1 - p.pos.distanceTo(G.camera!.position) / 80)));
  areaDamage(p.pos, p.aoe, p.dmg, { elem: p.elem, slow: p.slow, burn: p.elem === 'fire' ? 3 : 0, team: p.team, crit: p.crit, knock: 9 });
}
export function updateProjectiles(dt: number) {
  const pl = G.player;
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i]; p.life -= dt; let remove = p.life <= 0 && true;
    if (p.homing && !p.homing.dead) { V1.set(p.homing.pos.x, p.homing.pos.y + p.homing.cy, p.homing.pos.z).sub(p.pos).normalize(); const sp = p.vel.length(); p.vel.normalize().lerp(V1, clamp((p.turn ?? 3) * dt, 0, 1)).normalize().multiplyScalar(sp); }
    p.vel.y -= p.grav * dt; p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos);
    if (p.vel.lengthSq() > 0.01 && p.kind !== 'rock' && p.kind !== 'wind') p.mesh.lookAt(V1.copy(p.pos).add(p.vel));
    if (p.kind === 'wind') p.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.z) + Math.PI / 2;
    if (p.kind === 'rock') p.mesh.rotation.x += dt * 3;
    if (p.trail) { if (p.trail === 'fire') { fx.trail(p.pos, '#ff8a2a', 0.9, 0.4, 0.2); fx.trail(p.pos, '#ffd060', 0.5, 0.25, 0.1); } else if (p.trail === 'ice') fx.trail(p.pos, '#bfeaff', 0.5, 0.35, 0.1); else if (p.trail === 'smoke') fx.trail(p.pos, '#888', 0.9, 0.7, 0.1); else fx.trail(p.pos, p.color, 0.6, 0.3, 0.12); }
    const gy = groundAt(p.pos.x, p.pos.z, p.pos.y + 2);
    if (p.kind !== 'arrow' || true) if (gy > p.pos.y - 0.2 && p.vel.y <= 0.5 || (gy > p.pos.y && p.kind !== 'wind')) { if (p.aoe > 0) explodeAt(p); else { fx.sparks(p.pos, p.color, 5); } remove = true; }
    if (!remove) {
      if (p.team === 'player') {
        for (const h of G.hostiles) { if (h.dead || !h.active || p.hit.has(h.uid)) continue; if (h.kind === 'boss' && !G.bossFight) continue; const dx = h.pos.x - p.pos.x, dy = h.pos.y + h.cy - p.pos.y, dz = h.pos.z - p.pos.z; const rr = h.r + p.r; if (dx * dx + dy * dy + dz * dz < rr * rr) {
          p.hit.add(h.uid); if (p.aoe > 0) { explodeAt(p); remove = true; break; }
          V2.copy(p.vel).setY(0).normalize().multiplyScalar(p.knock ?? 4); damageHostile(h, p.dmg, { crit: p.crit, elem: p.elem, slow: p.slow, burn: p.elem === 'fire' ? 3 : 0, knock: V2, src: 'ranged' });
          if (!p.pierce) { remove = true; break; } } }
      } else {
        if (!pl.inShip) { const dx = pl.pos.x - p.pos.x, dy = pl.pos.y + 1 - p.pos.y, dz = pl.pos.z - p.pos.z; if (dx * dx + dy * dy + dz * dz < (p.r + 0.7) * (p.r + 0.7)) { if (p.aoe > 0) explodeAt(p); else hurtPlayer(p.dmg, p.pos, { elem: p.elem }); remove = true; } }
        else { const sr = 3.2 * (G.ship.obj?.userData.scale || 1) + p.r; if (p.pos.distanceToSquared(G.ship.pos) < sr * sr) { hooks.damageShip?.(p.dmg, p.pos); if (p.aoe > 0) fx.explosion(p.pos, 0.7, 'fire'); else fx.sparks(p.pos, '#ffb060', 10); remove = true; } }
      }
    }
    if (remove) { if (p.life <= 0 && p.aoe > 0 && p.kind === 'bomb') explodeAt(p); G.scene!.remove(p.mesh); G.projs.splice(i, 1); }
  }
}

// ───────── aim helpers ─────────
const camDir = new THREE.Vector3();
export function aimAssist(origin: THREE.Vector3, dir: THREE.Vector3, maxAng: number, maxDist: number): Hostile | null {
  let best: Hostile | null = null, bs = 1e9;
  for (const h of G.hostiles) { if (h.dead || !h.active || !h.lockable || (h.kind === 'boss' && !G.bossFight && false)) continue; V1.set(h.pos.x - origin.x, h.pos.y + h.cy - origin.y, h.pos.z - origin.z); const d = V1.length(); if (d > maxDist || d < 1) continue; const ang = Math.acos(clamp(V1.dot(dir) / d, -1, 1)); if (ang < maxAng && ang * 20 + d * 0.1 < bs) { bs = ang * 20 + d * 0.1; best = h; } }
  return best;
}
export function aimDirection(out: THREE.Vector3, origin: THREE.Vector3, assistAng = 0.12) {
  const cam = G.camera!; cam.getWorldDirection(camDir);
  if (G.player.lock && !G.player.lock.dead) { hostileCenter(G.player.lock, out).sub(origin).normalize(); return out; }
  V2.copy(cam.position).addScaledVector(camDir, 45); out.copy(V2).sub(origin).normalize();
  if (assistAng > 0) { const t = aimAssist(origin, out, assistAng, 70); if (t) hostileCenter(t, out).sub(origin).normalize(); }
  return out;
}

// ───────── spells ─────────
export function castSpell(idx: number) {
  const st = useStore.getState(); const sp = SPELLS[idx]; const p = G.player; if (!sp || p.dead || p.inShip || G.cam.cine) return;
  if (st.level < sp.reqLevel) { st.toast(`${sp.name} unlocks at level ${sp.reqLevel}`, 'bad'); sfx('error'); return; }
  if ((p.cd[sp.id] || 0) > 0) return; if (p.mp < sp.cost) { st.toast('Not enough magic energy', 'bad'); sfx('error'); return; }
  p.mp -= sp.cost; p.mpDelay = 2.5; p.cd[sp.id] = sp.cd; p.castT = 0.4; p.state = 'cast';
  const mult = spellMul(st) * (st.weapon === 'staff' ? 1.3 : 1) * (1 + masteryLevel(st, st.weapon) * 0.04); const dmg = sp.dmg * mult; const col = new THREE.Color(sp.color).getHex();
  const origin = new THREE.Vector3(p.pos.x, p.pos.y + 1.4, p.pos.z); const dir = aimDirection(new THREE.Vector3(), origin); p.faceYaw = Math.atan2(dir.x, dir.z); G.cam.shake = Math.max(G.cam.shake, 0.12);
  origin.addScaledVector(dir, 1.2);
  switch (sp.id) {
    case 'fire': sfx('fire'); fx.flash(origin, '#ff8a2a', 5); spawnProj({ kind: 'fireball', pos: origin, dir, speed: 30, dmg, team: 'player', r: 0.9, aoe: 5.5, elem: 'fire', color: col, trail: 'fire', life: 2.2, grav: 1 }); break;
    case 'ice': sfx('ice'); for (let i = -1; i <= 1; i++) { const d = dir.clone(); d.applyAxisAngle(V3.set(0, 1, 0), i * 0.14); spawnProj({ kind: 'ice', pos: origin.clone(), dir: d, speed: 42, dmg, team: 'player', r: 0.7, elem: 'ice', color: col, trail: 'ice', slow: 3, life: 1.6 }); } fx.burst(origin, 14, '#bfeaff', 6, 0.5, 0.5); break;
    case 'wind': sfx('wind'); spawnProj({ kind: 'wind', pos: origin, dir, speed: 36, dmg, team: 'player', r: 1.9, elem: 'wind', color: col, trail: 'wind', pierce: true, knock: 12, life: 1.1 }); fx.burst(origin, 12, '#d8ffe8', 6, 0.5, 0.5); break;
    case 'lightning': { sfx('lightning'); let tp = new THREE.Vector3(); const t = p.lock && !p.lock.dead ? p.lock : aimAssist(origin, dir, 0.35, 45);
      if (t) tp.set(t.pos.x, t.pos.y, t.pos.z); else { tp.set(p.pos.x + dir.x * 14, 0, p.pos.z + dir.z * 14); tp.y = Math.max(groundAt(tp.x, tp.z, p.pos.y + 6), p.pos.y - 2); }
      fx.telegraph(tp, 4.5, 0.4, '#fff27a'); const tpc = tp.clone(); setTimeout(() => { if (!G.scene) return; fx.bolt(V1.set(tpc.x + rand(-3, 3), tpc.y + 60, tpc.z + rand(-3, 3)).clone(), tpc, '#fff6a0', 0.45); fx.pillar(tpc, 2.2, 40, '#fff6a0', 0.4); fx.explosion(tpc, 1.1, 'lightning'); sfx('lightning'); G.cam.shake = 0.35; areaDamage(V2.set(tpc.x, tpc.y + 1, tpc.z), 4.8, dmg, { elem: 'lightning', stun: 1, knock: 6, crit: false }); }, 400); break; }
    case 'earth': sfx('earth'); p.shield = 70 + st.skills.spell * 8; p.shieldT = 12; fx.shockwave(V1.set(p.pos.x, p.pos.y + 0.3, p.pos.z), 5, '#c8a878', 0.6); fx.burst(V1.set(p.pos.x, p.pos.y + 0.5, p.pos.z), 20, '#b89868', 6, 0.7, 0.7, 10); break;
    case 'arcane': sfx('arcane'); { const c = new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z); fx.telegraph(V1.set(p.pos.x, p.pos.y, p.pos.z), 10, 0.5, '#c26bff'); setTimeout(() => { sfx('explosion'); fx.explosion(c, 2.2, 'arcane'); fx.shockwave(c.clone().setY(c.y - 0.5), 12, '#e8b0ff', 0.8); fx.pillar(c, 3, 25, '#c26bff', 0.6); G.cam.shake = 0.6; areaDamage(c, 10, dmg, { elem: 'arcane', knock: 14, stun: 0.8 }); }, 450); break; }
  }
}

// ───────── player attacks ─────────
const FWD = new THREE.Vector3();
export function startAttack(kind: 'light' | 'heavy', charge = 0) {
  const st = useStore.getState(); const w = WEAPONS[st.weapon]; const p = G.player;
  const cost = kind === 'heavy' ? 20 : 7; if (p.sp < cost || p.exhaust > 0) { if (p.sp < cost) { p.exhaust = Math.max(p.exhaust, 0.6); } return; }
  p.sp -= cost; p.regenDelay = 1.1; p.atkKind = kind; p.atkHit = false;
  // facing: movement dir > lock > nearest enemy in front
  let face = p.faceYaw; const mx = input.moveX, my = input.moveY; const cy = G.cam.yaw; if (Math.abs(mx) + Math.abs(my) > 0.2) { face = Math.atan2(mx * Math.cos(cy) - my * Math.sin(cy), -mx * Math.sin(cy) - my * Math.cos(cy)); } else face = cy + Math.PI;
  if (p.lock && !p.lock.dead) face = Math.atan2(p.lock.pos.x - p.pos.x, p.lock.pos.z - p.pos.z);
  else { let best: Hostile | null = null, bd = (w.kind === 'melee' ? w.range * 1.8 : 40); for (const h of G.hostiles) { if (h.dead || !h.active || (h.kind === 'boss' && !G.bossFight)) continue; const dx = h.pos.x - p.pos.x, dz = h.pos.z - p.pos.z; const d = Math.hypot(dx, dz) - h.r; if (d < bd) { let da = Math.atan2(dx, dz) - face; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < (w.kind === 'melee' ? 1.2 : 0.5)) { bd = d; best = h; } } } if (best) face = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z); }
  p.faceYaw = face; p.yaw = face;
  if (p.comboT > 0 && kind === 'light') p.atkStep = (p.atkStep + 1) % w.combo; else p.atkStep = 0; if (kind === 'heavy') p.atkStep = 0;
  const last = p.atkStep === w.combo - 1 && w.combo > 1; p.atkDur = kind === 'heavy' ? w.cd * 1.9 : w.cd * (last ? 1.25 : 1); p.atkT = p.atkDur; p.state = 'attack'; p.stateT = 0; p.comboT = 0;
  const crit = Math.random() < 0.1 + 0.02 * st.skills.combat; const mul = dmgMul(st) * (1 + masteryLevel(st, w.id) * 0.04) * p.buffDmg;
  FWD.set(Math.sin(face), 0, Math.cos(face));
  if (w.kind === 'melee') {
    p.vel.x += FWD.x * (kind === 'heavy' ? 7 : 4.5); p.vel.z += FWD.z * (kind === 'heavy' ? 7 : 4.5); sfx(kind === 'heavy' ? 'heavy' : 'swing');
    (p as any).pend = { w, kind, crit, dmg: w.dmg * mul * (kind === 'heavy' ? w.heavy * (1 + Math.min(1, charge) * 0.5) : last ? 1.45 : 1), last, t: p.atkDur * (kind === 'heavy' ? 0.5 : 0.38) };
  } else {
    p.atkDur = Math.max(0.3, w.cd * 0.8); p.atkT = p.atkDur; sfx(w.kind === 'ranged' ? 'bow' : 'wind');
    const origin = new THREE.Vector3(p.pos.x, p.pos.y + 1.4, p.pos.z); const dir = aimDirection(new THREE.Vector3(), origin, 0.1); p.faceYaw = p.yaw = Math.atan2(dir.x, dir.z); origin.addScaledVector(dir, 0.9);
    const pow = kind === 'heavy' ? 1 : clamp(charge, 0, 1);
    if (w.kind === 'ranged') { const power = kind === 'heavy' ? 1 : 0.35 + pow * 0.65; const dm = w.dmg * mul * (1 + (w.heavy - 1) * power * (kind === 'heavy' ? 1 : 1)); spawnProj({ kind: 'arrow', pos: origin, dir, speed: 30 + power * 45, dmg: dm * (kind === 'heavy' ? 1 : 1) * (crit ? 2 : 1), team: 'player', r: 0.5, elem: '', color: 0xd8ffa8, life: 2.2, grav: 4 * (1 - power * 0.8), crit, trail: power > 0.9 ? 'wind' : '', pierce: power > 0.95 }); if (kind === 'heavy' && power > 0.9) { const d2 = dir.clone().applyAxisAngle(V3.set(0, 1, 0), 0.08), d3 = dir.clone().applyAxisAngle(V3.set(0, 1, 0), -0.08); for (const d of [d2, d3]) spawnProj({ kind: 'arrow', pos: origin.clone(), dir: d, speed: 70, dmg: dm * 0.6, team: 'player', r: 0.5, color: 0xd8ffa8, life: 2.2, grav: 1, trail: 'wind' }); } }
    else { const big = kind === 'heavy'; spawnProj({ kind: 'bolt', pos: origin, dir, speed: big ? 32 : 44, dmg: w.dmg * mul * 1.2 * (big ? w.heavy : 1) * (crit ? 2 : 1), team: 'player', r: big ? 1.2 : 0.6, aoe: big ? 4.5 : 0, elem: 'arcane', color: 0xc26bff, trail: 'magic', life: 2, crit, scale: big ? 1.8 : 1 }); fx.burst(origin, 8, '#d8a0ff', 5, 0.4, 0.4); }
    p.atkHit = true;
  }
}


export function updateAttackHit(dt: number) {
  const p = G.player as any; const pend = p.pend; if (!pend) return; pend.t -= dt; if (pend.t > 0) return; p.pend = null; p.atkHit = true;
  const { w, kind, crit, dmg, last } = pend; const st = useStore.getState();
  FWD.set(Math.sin(p.yaw), 0, Math.cos(p.yaw)); const origin = V1.set(p.pos.x, p.pos.y, p.pos.z);
  const range = w.range * (kind === 'heavy' ? 1.25 : 1); const arc = kind === 'heavy' ? Math.min(Math.PI * 2, w.arc * 1.6) : w.arc;
  const tilt = [0.5, -0.5, 0.3, -0.7][p.atkStep % 4] + (kind === 'heavy' ? 0.2 : 0);
  fx.slash(origin, p.yaw, range * 0.75, w.color, arc, tilt, kind === 'heavy' ? 0.35 : 0.22, 1.1 + (kind === 'heavy' ? 0.2 : 0));
  if (w.id === 'dual') fx.slash(origin, p.yaw + (p.atkStep % 2 ? 0.2 : -0.2), range * 0.7, w.color, arc, -tilt, 0.2, 1.3);
  if (kind === 'heavy') { fx.shockwave(V2.set(p.pos.x + FWD.x * 2, p.pos.y + 0.2, p.pos.z + FWD.z * 2), range * 1.1, w.color, 0.4); G.cam.shake = Math.max(G.cam.shake, 0.2); }
  let hits = 0;
  for (const h of G.hostiles) {
    if (h.dead || !h.active || (h.kind === 'boss' && !G.bossFight)) continue; const dx = h.pos.x - p.pos.x, dz = h.pos.z - p.pos.z; const d = Math.hypot(dx, dz) - h.r; if (d > range) continue; if (Math.abs(h.pos.y + h.cy - p.pos.y - 1) > 3.5 + h.r) continue;
    let da = Math.atan2(dx, dz) - p.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > arc / 2 + (h.r / Math.max(1, d + h.r))) continue;
    V2.set(dx, 0.5, dz).normalize().multiplyScalar(w.id === 'greatsword' || kind === 'heavy' ? 11 : last ? 8 : 4);
    damageHostile(h, dmg * (crit ? 2 : 1) * (0.9 + Math.random() * 0.2), { crit, knock: V2, stun: kind === 'heavy' ? 0.5 : 0, src: 'melee' }); hits++;
    if (hits === 1) { sfx(crit ? 'crit' : 'hit'); } fx.burst(hostileCenter(h, V3), crit ? 14 : 6, w.color, 7, 0.4, 0.35, 8);
  }
  if (hits) { G.hitStop = Math.max(G.hitStop, kind === 'heavy' ? 0.09 : 0.04); G.cam.shake = Math.max(G.cam.shake, kind === 'heavy' ? 0.3 : 0.1); st.addMastery(w.id, hits * (kind === 'heavy' ? 2 : 1) * 0.5); }
}

// ───────── loot pickups ─────────
interface Pickup { obj: THREE.Group; pos: THREE.Vector3; vy: number; item: string; n: number; t: number; fly: boolean }
const pickups: Pickup[] = [];
export function spawnLoot(pos: THREE.Vector3, item: string, n: number) {
  const def = ITEMS[item]; const color = item === 'gold' ? '#ffd23a' : def?.kind === 'artifact' ? '#ff9aff' : def?.kind === 'potion' ? '#ff6a8a' : def?.kind === 'magic' ? '#c26bff' : '#8fe8ff';
  const g = grp(ico(0.3, color, [0, 0, 0], { em: color, ei: 1.8 }, 0), glow(color, item === 'gold' ? 1.6 : 2.4)); if (def?.kind === 'artifact') g.scale.setScalar(2);
  g.position.copy(pos); G.scene!.add(g); pickups.push({ obj: g, pos: g.position, vy: rand(4, 8), item, n, t: 0, fly: false });
  (g.userData as any).vx = rand(-3, 3); (g.userData as any).vz = rand(-3, 3);
}
export function updatePickups(dt: number) {
  const p = G.player; const st = useStore.getState();
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i]; k.t += dt; const gy = groundAt(k.pos.x, k.pos.z, k.pos.y + 2);
    if (!k.fly) { k.vy -= 20 * dt; k.pos.y += k.vy * dt; k.pos.x += (k.obj.userData as any).vx * dt; k.pos.z += (k.obj.userData as any).vz * dt; (k.obj.userData as any).vx *= 0.96; (k.obj.userData as any).vz *= 0.96; if (k.pos.y < gy + 0.6) { k.pos.y = gy + 0.6; k.vy = Math.abs(k.vy) > 3 ? -k.vy * 0.4 : 0; } }
    k.obj.rotation.y += dt * 3; const target = p.inShip ? G.ship.pos : p.pos; const d = Math.hypot(target.x - k.pos.x, (target.y + 1) - k.pos.y, target.z - k.pos.z);
    if (k.t > 0.6 && d < (p.inShip ? 9 : 5.5) && !k.fly) k.fly = true;
    if (k.fly && k.t > 0.6) { V1.set(target.x - k.pos.x, target.y + 1 - k.pos.y, target.z - k.pos.z).normalize(); k.pos.addScaledVector(V1, (14 + k.t * 2) * dt); if (d < 1.2) { const got = k.item === 'gold' ? (st.addItem('gold', k.n, true), k.n) : st.addItem(k.item, k.n); if (got > 0) { sfx(k.item === 'gold' ? 'coin' : 'pickup'); st.toast(`+${got} ${ITEMS[k.item].name}`, 'loot'); fx.burst(k.pos, 6, '#ffe9a0', 4, 0.3, 0.3); G.scene!.remove(k.obj); pickups.splice(i, 1); continue; } k.fly = false; k.t = 0.3; } }
    if (k.t > 120) { G.scene!.remove(k.obj); pickups.splice(i, 1); }
  }
}
export const clearPickups = () => { for (const k of pickups) G.scene?.remove(k.obj); pickups.length = 0; };
export { at, box, cone, cyl, torus };
