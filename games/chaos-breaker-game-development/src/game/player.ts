import * as THREE from 'three';
import { AttackDef, Hit, WeaponId, samplePose } from './types';
import { WEAPONS } from './data/weapons';
import { STYLES, ELEM_COLORS } from './data/world';
import { Rig } from './rig';
import { buildWeapon } from './weaponModels';
import { WeaponTrail, vfx } from './vfx';
import { sfx } from './audio';
import { input } from './input';
import { bridge, useGame } from './store';
import { cam } from './camera';
import { W, Enemy, Player, angDiff, clamp, difficulty, floatText } from './world';
import { addScore, damageDestructible, destroyEnemyProjectile, gainUlt, hurtEnemy, inShape, nearestEnemy, spawnProj, track } from './combat';

const V = new THREE.Vector3(), V2 = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpT = new THREE.Vector3(), tmpB2 = new THREE.Vector3(), tmpT2 = new THREE.Vector3();
const REST = [.35, 1.1, .4, .9, .2, .4, 0, 0];
const poseTmp = [0, 0, 0, 0, 0, 0, 0, 0], poseTmp2 = [0, 0, 0, 0, 0, 0, 0, 0], idle = [.35, 1.1, .4, .9, .2, .4, 0, 0];

export function unlocked(w: WeaponId) {
  const d = useGame.getState().save.done; return { skin1: !!d[w + '1'], extra: !!d[w + '2'], variant: !!d[w + '3'] };
}
const awkOn = () => W.P.awkT > 0;

export function createPlayer(): Player {
  const st = useGame.getState(), wp = WEAPONS[st.weapon], style = STYLES[st.style];
  const rig = new Rig({ kind: 'hero', main: 0x1b1d2c, accent: wp.color, scale: 1 }); W.scene.add(rig.root);
  const m = buildWeapon(wp.id, wp.color, wp.color2);
  const P: Player = {
    rig, pos: new THREE.Vector3(0, 0, 4), vx: 0, vz: 0, vy: 0, yaw: Math.PI, grounded: true, hp: 100 * style.hp, maxHp: 100 * style.hp, stam: 100 * style.stamina, maxStam: 100 * style.stamina, stamDelay: 0, ult: 0, awk: 0, awkT: 0,
    weapon: wp, weaponId: wp.id, style, model: m, trail: new WeaponTrail(W.scene, wp.color, wp.color2), trail2: null, skin: 0, state: 'free', st: 0,
    atk: null, atkT: 0, atkSpeed: 1, hitIdx: 0, combo: 0, comboWin: 0, airIdx: 0, atkMul: 1, atkCounter: false, atkBig: false, chargeT: 0, charged: false, lastLight: false, swung: false, hitSet: new Set(),
    d: { age: 0, active: false, success: false, lock: 0, chain: 0, chainT: 0, clashT: 9, endAge: 0 }, counterT: 0, counterTarget: null, counterChain: 0,
    invuln: 0, dodgeCd: 0, dodgeDir: new THREE.Vector3(), dodgeT: 0, dodgeBlink: 0, perfectDodgeUsed: false, jumps: 0, cds: { spec1: 0, spec2: 0 }, cdMax: { spec1: 1, spec2: 1 }, hurtT: 0, retaliate: 0, switchT: 0,
    lock: null, combatCount: 0, comboT: 0, sprinting: false, pullT: 0, pullTo: null, lastHitT: 0, marks: [], deadT: 0, stepT: 0, speedNow: 0, awkVariant: false, pose: [...REST], poseL: [...REST],
  };
  W.P = P; attachModel(P, m); return P;
}
function attachModel(P: Player, m: ReturnType<typeof buildWeapon>) {
  P.model = m; P.rig.hasLeftPiv = false; P.rig.setWeapon({ group: m.group, second: m.second, grip2: m.grip2 }); if (m.back) P.rig.ub.add(m.back);
}
export function equip(id: WeaponId, silent = false) {
  const P = W.P, u = unlocked(id), old = P.model, wp = WEAPONS[id];
  P.rig.pivR.remove(old.group); if (old.second) P.rig.pivL.remove(old.second); if (old.back) P.rig.ub.remove(old.back);
  P.weaponId = id; P.weapon = wp; let sk = useGame.getState().save.skin[id] ?? 0; if ((sk === 1 && !u.skin1) || (sk === 2 && !u.variant)) sk = 0; P.skin = sk;
  const skin = awkOn() && u.variant ? wp.skins[2] : wp.skins[sk];
  attachModel(P, buildWeapon(id, skin.color, skin.color2));
  P.trail.setColor(skin.color2, skin.color); P.trail.reset();
  if (wp.dual) { if (!P.trail2) P.trail2 = new WeaponTrail(W.scene, skin.color2, skin.color); P.trail2.setColor(skin.color2, skin.color); P.trail2.reset(); } else if (P.trail2) { P.trail2.reset(); }
  P.rig.accentMat.emissive.setHex(skin.color);
  P.cds.spec1 = P.cds.spec2 = 0; P.state = P.state === 'attack' || P.state === 'deflect' ? 'free' : P.state; P.atk = null; P.switchT = .3; P.d.chain = 0; P.counterT = 0;
  if (!silent) { sfx.ui(); vfx.fx('ring', { pos: [P.pos.x, .1, P.pos.z], s0: .5, s1: 3, color: wp.color, dur: .4 }); vfx.burst(wp.elem, V.set(P.pos.x, 1, P.pos.z).clone(), 1.5); }
  if (useGame.getState().weapon !== id) useGame.getState().set({ weapon: id });
}
export function applyStyle() {
  const P = W.P, st = STYLES[useGame.getState().style]; if (st === P.style) return;
  const rh = P.hp / P.maxHp, rs = P.stam / P.maxStam; P.style = st; P.maxHp = 100 * st.hp; P.maxStam = 100 * st.stamina; P.hp = P.maxHp * rh; P.stam = P.maxStam * rs;
}
export function resetPlayer() {
  const P = W.P; P.pos.set(0, 0, 4); P.vx = P.vz = P.vy = 0; P.yaw = Math.PI; P.grounded = true; P.hp = P.maxHp; P.stam = P.maxStam; P.ult = 0; P.awk = 0; P.awkT = 0; P.state = 'free'; P.atk = null;
  P.invuln = 0; P.combatCount = 0; P.comboT = 0; P.counterT = 0; P.d.chain = 0; P.d.active = false; P.cds.spec1 = P.cds.spec2 = 0; P.lock = null; P.rig.root.rotation.set(0, 0, 0); P.hurtT = 0; P.pullT = 0; P.retaliate = 0; P.deadT = 0;
  P.trail.reset(); P.trail2?.reset(); cam.yaw = Math.PI; cam.pitch = .32;
}

// ------------------------------------------------------------------ helpers
function moveDir(): THREE.Vector3 | null {
  const m = input.move(); if (Math.abs(m.x) + Math.abs(m.y) < .1) return null;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -fz, rz = fx; return V.set(fx * m.y + rx * m.x, 0, fz * m.y + rz * m.x).normalize();
}
function lightChain(): AttackDef[] { const P = W.P, u = unlocked(P.weaponId); return u.extra && useGame.getState().save.extraOn[P.weaponId] !== false ? [...P.weapon.light, P.weapon.extra] : P.weapon.light; }
function aimAssist(range = 8.5) {
  const P = W.P; let tgt: Enemy | null = P.lock && P.lock.alive ? P.lock : null;
  if (!tgt) {
    const md = moveDir(); const want = md ? Math.atan2(md.x, md.z) : P.yaw;
    let best = 1e9; for (const e of W.enemies) { if (!e.alive) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d > range) continue; const a = Math.abs(angDiff(want, Math.atan2(dx, dz))); if (a > 1.5) continue; const sc = d + a * 2.5; if (sc < best) { best = sc; tgt = e; } }
  }
  if (tgt) P.yaw = Math.atan2(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z);
  else { const md = moveDir(); if (md) P.yaw = Math.atan2(md.x, md.z); }
  return tgt;
}
function stamUse(n: number) { const P = W.P; P.stam = Math.max(0, P.stam - n); P.stamDelay = .7; }

// ------------------------------------------------------------------ starting actions
export function startAttack(def: AttackDef, o: { mul?: number; counter?: boolean; noHold?: boolean; big?: boolean } = {}) {
  const P = W.P, tgt = aimAssist(def.air ? 11 : 8.5);
  if (P.dodgeBlink > 0 && tgt && def !== P.weapon.ult) { blinkTo(tgt, 1.7); P.dodgeBlink = 0; }
  P.state = 'attack'; P.atk = def; P.atkT = 0; P.hitIdx = 0; P.st = 0; P.atkMul = (o.mul ?? def.mult ?? 1) * (P.style.id === 'juggernaut' && P.retaliate > 0 ? 1.5 : 1); P.atkCounter = !!o.counter; P.atkBig = !!o.big;
  P.chargeT = o.noHold ? -9 : 0; P.charged = false; P.d.active = false; P.swung = false;
  P.atkSpeed = P.style.speed * (awkOn() ? 1.12 : 1) * (def.invuln && def.cinematic ? 1 : 1); if (def.cinematic) P.atkSpeed = 1;
  if (def.stam) stamUse(def.stam); if (P.hitSet.size) P.hitSet.clear();
  if (def.leap) { P.vy = def.leap; P.grounded = false; }
  else if (!P.grounded && def.hover) P.vy = Math.max(P.vy, 2.8);
  if (def.invuln) P.invuln = Math.max(P.invuln, def.dur * .75);
  P.lastLight = false; P.trail.reset(); P.trail2?.reset();
}
export function blinkTo(e: Enemy, dist: number) {
  const P = W.P; const [c0, c1] = ELEM_COLORS[P.weapon.elem];
  vfx.rift(V.set(P.pos.x, 0, P.pos.z).clone(), c1, 1.1, .35); vfx.spark(P.pos.x, 1, P.pos.z, 0, 1, 0, 10, 6, 1, c0, .4);
  const a = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z) + (Math.random() < .5 ? -1 : 1) * (1.6 + Math.random() * 1.4);
  const r = dist + e.def.radius; let x = e.pos.x + Math.sin(a) * r, z = e.pos.z + Math.cos(a) * r; const R = (W.arena?.radius ?? 20) - 1; const d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; }
  P.pos.x = x; P.pos.z = z; P.yaw = Math.atan2(e.pos.x - x, e.pos.z - z); P.vx = P.vz = 0;
  vfx.rift(V.set(x, 0, z).clone(), c1, 1.1, .35); P.trail.reset(); P.trail2?.reset(); sfx.dodge();
}
function doDodge() {
  const P = W.P, cost = 20 * P.style.dodgeStam; if (P.stam < 6 || P.dodgeCd > 0) { if (P.stam < 6) floatText(P.pos, 'NO STAMINA', 'blk', 2.3); return false; }
  stamUse(cost); const md = moveDir(); const dir = md ? md.clone() : V2.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)).clone();
  P.state = 'dodge'; P.st = 0; P.atk = null; P.dodgeT = P.style.id === 'assassin' ? .3 : .27; P.invuln = Math.max(P.invuln, .24 * P.style.iframes); P.perfectDodgeUsed = false; P.d.active = false;
  const sp = P.style.id === 'assassin' ? 21 : 17; P.vx = dir.x * sp; P.vz = dir.z * sp; P.dodgeDir.copy(dir); P.dodgeCd = .1; P.hurtT = 0; P.chargeT = 0;
  sfx.dodge(); const c = ELEM_COLORS[P.weapon.elem]; vfx.spark(P.pos.x, .4, P.pos.z, -dir.x, .3, -dir.z, 10, 5, .6, c[1], .35); vfx.fx('ring', { pos: [P.pos.x, .1, P.pos.z], s0: .3, s1: 2.2, color: c[1], dur: .3, op: .5 });
  P.trail.reset(); P.trail2?.reset(); return true;
}
function doDeflect() {
  const P = W.P, d = P.d; if (d.lock > 0 || P.stam <= 0) return false;
  let tgt: Enemy | null = null, best = 1e9;
  for (const e of W.enemies) { if (!e.alive) continue; const dd = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); const threat = e.state === 'windup' || e.state === 'strike' || e.cue; if (!threat || dd > 10) continue; if (dd < best) { best = dd; tgt = e; } }
  if (!tgt) for (const p of W.projs) if (p.owner === 'e' && Math.hypot(p.pos.x - P.pos.x, p.pos.z - P.pos.z) < 14) { P.yaw = Math.atan2(p.pos.x - P.pos.x, p.pos.z - P.pos.z); break; }
  if (tgt) P.yaw = Math.atan2(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z); else if (P.lock?.alive) P.yaw = Math.atan2(P.lock.pos.x - P.pos.x, P.lock.pos.z - P.pos.z);
  P.state = 'deflect'; P.st = 0; P.atk = null; d.age = 0; d.active = true; d.success = false; d.clashT = 9; P.vx *= .3; P.vz *= .3; stamUse(6); P.trail.reset(); P.chargeT = 0;
  sfx.swing(P.weaponId, false); return true;
}
function trySpec(which: 'spec1' | 'spec2') {
  const P = W.P; const swap = useGame.getState().save.swap; const slot = swap ? (which === 'spec1' ? 'spec2' : 'spec1') : which; const def = P.weapon[slot];
  if (P.cds[which] > 0) { floatText(P.pos, 'COOLDOWN', 'blk', 2.3); return false; }
  const cd = (def.cd ?? 6) * (P.style.id === 'arcane' ? .7 : 1) * (W.run?.mode === 'training' ? .35 : 1); P.cds[which] = cd; P.cdMax[which] = cd;
  startAttack(def, { mul: awkOn() ? 1.4 : 1 }); track('specials', 1); sfx.swing(P.weaponId, true); return true;
}
function tryUlt() {
  const P = W.P; if (P.ult < 100) { floatText(P.pos, 'ULT NOT READY', 'blk', 2.3); return false; }
  P.ult = 0; startAttack(P.weapon.ult, { mul: awkOn() ? 1.6 : 1 }); track('ults', 1); sfx.ult(); bridge.flash('#' + new THREE.Color(P.weapon.color).getHexString(), .5, 600); bridge.banner(P.weapon.ult.name.toUpperCase(), awkOn() ? 'AWAKENED ULTIMATE' : 'ULTIMATE');
  W.dim = 1; W.shake = Math.max(W.shake, .4); W.fovPunch = 10; return true;
}
function tryAwaken() {
  const P = W.P; if (P.awkT > 0) return false; if (P.awk < 100) { floatText(P.pos, 'AWAKENING NOT READY', 'blk', 2.3); return false; }
  P.awk = 0; P.awkT = 20 * (P.style.id === 'arcane' ? 1.4 : 1); P.invuln = Math.max(P.invuln, .8); sfx.awaken();
  const wp = P.weapon, [c0, c1] = ELEM_COLORS[wp.elem]; vfx.ult(wp.elem, V.set(P.pos.x, 0, P.pos.z).clone(), 7); vfx.fx('ring', { pos: [P.pos.x, .2, P.pos.z], s0: 1, s1: 14, color: c1, dur: .8 }); vfx.light1(P.pos, c0, 14, .8);
  bridge.flash('#' + new THREE.Color(wp.color2).getHexString(), .55, 600); bridge.banner(wp.awakenName.toUpperCase(), 'WEAPON AWAKENED'); W.slowT = .5; W.slowF = .25; W.shake = Math.max(W.shake, .5);
  if (unlocked(P.weaponId).variant) equip(P.weaponId, true); P.switchT = 0; if (P.state === 'attack') { P.state = 'free'; P.atk = null; } return true;
}
function tryCounter(kind: 'light' | 'heavy') {
  const P = W.P, wp = P.weapon, chain = P.counterChain; if (P.counterT <= 0) return false;
  const tgt = P.counterTarget && P.counterTarget.alive ? P.counterTarget : nearestEnemy(P.pos, 14); if (!tgt) return false;
  const mulC = P.style.counter * (1 + Math.min(chain, 6) * .1); const air = !P.grounded; P.counterT = 0;
  const dist = Math.hypot(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z);
  if (dist > 2.6 || P.weaponId === 'void' || P.weaponId === 'thunder') { if (P.weaponId !== 'plasma' && P.weaponId !== 'glacier') blinkTo(tgt, 1.8); }
  if (kind === 'heavy') { startAttack(wp.heavy, { mul: 2.1 * mulC, counter: true, noHold: true, big: true }); floatText(P.pos, 'HEAVY COUNTER', 'ctr-t', 2.5); }
  else if (air) { startAttack(wp.air[0], { mul: 2.4 * mulC, counter: true, big: true }); floatText(P.pos, 'AERIAL COUNTER', 'ctr-t', 2.5); }
  else if (chain >= 3) { startAttack(wp.counter, { mul: 2.1 * mulC, counter: true, big: true }); floatText(P.pos, `CHAIN COUNTER ×${chain}`, 'ctr-t', 2.5); }
  else { startAttack(wp.counter, { mul: 1.7 * mulC, counter: true, big: true }); floatText(P.pos, wp.counterName.toUpperCase(), 'ctr-t', 2.5); }
  track('counters', 1); P.d.success = false; return true;
}
function tryExecute(): boolean {
  const P = W.P; let tgt: Enemy | null = null;
  for (const e of W.enemies) if (e.alive && e.boss && e.state === 'stagger' && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 14) tgt = e;
  if (!tgt) return false; blinkTo(tgt, 2.4 + tgt.def.scale * .5); startAttack(P.weapon.counter, { mul: 3.2 * P.style.counter, counter: true, noHold: true, big: true }); tgt.staggerT = Math.max(tgt.staggerT, 2);
  bridge.banner('EXECUTION', P.weapon.counterName.toUpperCase()); W.slowT = .6; W.slowF = .3; W.cine = { t: 0, dur: 1.6, target: tgt, kind: 'exec' }; return true;
}
function startLight() {
  const P = W.P, wp = P.weapon;
  if (tryCounter(P.counterTarget && !P.grounded ? 'light' : 'light')) return true;
  if (!P.grounded) { const i = P.airIdx % wp.air.length; P.airIdx++; startAttack(wp.air[i]); return true; }
  const ch = lightChain(); const idx = P.comboWin > 0 ? P.combo % ch.length : 0; P.combo = (idx + 1) % ch.length; startAttack(ch[idx]);
  P.lastLight = true; return true;
}
function startHeavy() {
  const P = W.P, wp = P.weapon;
  if (tryExecute()) return true; if (tryCounter('heavy')) return true;
  if (!P.grounded) { startAttack(wp.airHeavy); return true; }
  if (P.stam < 3) { floatText(P.pos, 'NO STAMINA', 'blk', 2.3); return false; }
  startAttack(wp.heavy, { mul: P.style.id === 'berserker' ? 1.15 : 1 }); return true;
}
export function switchWeapon(id: WeaponId) {
  const P = W.P; if (id === P.weaponId) return; equip(id); useGame.getState().set({ weapon: id }); P.rig.flash(0xffffff, .8);
}

// ------------------------------------------------------------------ hit execution
function elemSfx(el: string, big: boolean) { sfx.elem((el === 'phys' ? 'slam' : el === 'earth' ? 'slam' : el) as 'fire', big); }
function fireHit(h: Hit, atk: AttackDef, last: boolean) {
  const P = W.P, wp = P.weapon, elem = atk.elem ?? wp.elem, awk = awkOn(), st = P.style;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), [, c1] = ELEM_COLORS[elem];
  let cx = P.pos.x + fx * (h.ox ?? 0), cz = P.pos.z + fz * (h.ox ?? 0), blinkCenter = false;
  const rangeMul = atk === wp.ult ? (awk ? 1.25 : 1) : awk ? 1.22 : 1;
  const isHeavyAtk = atk === wp.heavy || atk === wp.charged || atk === wp.airHeavy;
  // ---- special actions
  switch (h.act) {
    case 'proj': if (h.proj) {
      const aw = awk ? 1.3 : 1; V.set(fx, 0, fz); spawnProj({ owner: 'p', kind: h.proj.kind, elem: h.proj.elem, pos: V2.set(P.pos.x + fx * 1.2, 1.2, P.pos.z + fz * 1.2), dir: V, speed: h.proj.speed, life: h.proj.life * (awk ? 1.15 : 1), size: h.proj.size * aw, dmg: h.dmg * P.atkMul * st.dmg * (awk ? 1.3 : 1) * (isHeavyAtk ? 1 : 1), src: null, pierce: h.proj.pierce, freeze: h.proj.freeze, deflectable: false });
      elemSfx(h.proj.elem, true); vfx.fx('ring', { pos: [P.pos.x + fx, 1.1, P.pos.z + fz], s0: .5, s1: 3, color: c1, dur: .25, rot: [Math.PI / 2, P.yaw, 0] }); vfx.slashArc(h.proj.elem, V2.set(P.pos.x, 1.1, P.pos.z), P.yaw, 3 * aw, atk.id === wp.spec1.id && wp.id === 'inferno' ? Math.PI / 2 : 0);
    } break;
    case 'blink': { const t = P.lock?.alive ? P.lock : nearestEnemy(P.pos, 18); if (t) { blinkTo(t, h.p ?? 1.7); cx = P.pos.x; cz = P.pos.z; blinkCenter = true; } } break;
    case 'warp': { const R = (W.arena?.radius ?? 20) - 1; vfx.rift(V.set(P.pos.x, 0, P.pos.z).clone(), c1, 1.4, .4); let x = P.pos.x + fx * (h.p ?? 5), z = P.pos.z + fz * (h.p ?? 5); const d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; } P.pos.x = x; P.pos.z = z; vfx.rift(V.set(x, 0, z).clone(), c1, 1.4, .4); sfx.dodge(); P.trail.reset(); cx = x; cz = z; } break;
    case 'bolt': { const tg = nearestRandom(h.p ?? 14); cx = tg.x; cz = tg.z; V.set(cx, 0, cz); vfx.lightning(V.clone(), 'lightning', h.range); sfx.elem('lightning'); } break;
    case 'hole': { const hx = P.pos.x + fx * (h.ox ?? 7), hz = P.pos.z + fz * (h.ox ?? 7); const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, .12, 8, 40), new THREE.MeshBasicMaterial({ color: 0xc08aff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending })); ring.rotation.x = Math.PI / 2; const core = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0x07020f })); const gl = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), new THREE.MeshBasicMaterial({ color: 0xa24bff, transparent: true, opacity: .35, blending: THREE.AdditiveBlending })); g.add(ring, core, gl); g.position.set(hx, 1.8, hz); W.scene.add(g); W.zones.push({ type: 'hole', pos: new THREE.Vector3(hx, 0, hz), r: 2.4, life: h.p ?? 1.9, max: h.p ?? 1.9, dmg: 55 * P.atkMul * st.dmg * (awk ? 1.4 : 1), vis: g }); vfx.rift(V.set(hx, 0, hz).clone(), 0xa24bff, 2.4, 1); sfx.elem('void'); } break;
    case 'rift': vfx.rift(V.set(P.pos.x + fx * (h.ox ?? 8), 0, P.pos.z + fz * (h.ox ?? 8)).clone(), 0xc08aff, 6, 2); vfx.fx('disc', { pos: [P.pos.x + fx * (h.ox ?? 8), 4, P.pos.z + fz * (h.ox ?? 8)], s0: .5, s1: 7, color: 0xa24bff, dur: 2.2, tex: vfx.tex.rune, rot: [Math.PI / 2, P.yaw, 0], spin: 4, op: .9, pw: .5 }); sfx.elem('void', true); break;
    case 'mark': { const t = nearestRandomEnemy(); if (t) { blinkTo(t, 1.4); cx = P.pos.x; cz = P.pos.z; blinkCenter = true; P.marks.push(t.pos.clone()); const a = Math.random() * 3; vfx.fx('flare', { pos: [t.pos.x, 1.3, t.pos.z], s0: [.3, .04, 1], s1: [9, .25, 1], color: 0xffffff, dur: 1.2, roll: a, pw: .5 }); vfx.fx('flare', { pos: [t.pos.x, 1.3, t.pos.z], s0: [.3, .04, 1], s1: [7, .2, 1], color: 0x27f2ff, dur: 1.2, roll: a + .6, pw: .5 }); sfx.hit(.7, 'plasma'); t.rig.flash(0xffffff, 1); } h = { ...h, dmg: 0 }; } break;
    case 'resolve': { for (const m of P.marks) { V.copy(m); vfx.burst('plasma', V.clone(), 4, true); vfx.fx('flare', { pos: [m.x, 1.3, m.z], s0: [.3, .1, 1], s1: [14, .5, 1], color: 0xffffff, dur: .5, roll: Math.random() * 3 }); } P.marks.length = 0; W.slowT = 0; bridge.flash('#e8ffff', .9, 500); } break;
    case 'slow': W.slowT = h.p ?? .3; W.slowF = .3; break;
    case 'flash': bridge.flash('#' + new THREE.Color(c1).getHexString(), .4, 500); vfx.light1(P.pos, c1, 8, .6); vfx.fx('ring', { pos: [P.pos.x, .2, P.pos.z], s0: .5, s1: 8, color: c1, dur: .6 }); vfx.elemSpray(elem, P.pos.x, .3, P.pos.z, 4, 1); elemSfx(elem, true); break;
    case 'quake': break;
  }
  if (!blinkCenter && h.act !== 'bolt') { cx = P.pos.x + fx * (h.ox ?? 0); cz = P.pos.z + fz * (h.ox ?? 0); if (h.act === 'warp') { cx = P.pos.x; cz = P.pos.z; } }
  const center = V.set(cx, Math.max(0, P.pos.y), cz).clone();
  // ---- damage
  const rage = st.id === 'berserker' && P.hp < P.maxHp * .5 ? 1.2 : 1;
  const base = h.dmg * P.atkMul * st.dmg * (awk ? 1.3 : 1) * rage * (P.charged ? 1 + Math.min(P.chargeT, 1.2) * .35 : 1);
  let n = 0, heavyHit = false;
  const dir = V2.set(fx, 0, fz).clone();
  if (h.dmg > 0 || h.launch || h.pull || h.freeze || h.stagger) for (const e of W.enemies) {
    if (!e.alive || P.hitSet.has(e) && false) continue;
    if (!inShape(h, cx, cz, P.yaw, e, rangeMul)) continue;
    const d = V.set(e.pos.x - (h.shape === 'circle' ? cx : P.pos.x), 0, e.pos.z - (h.shape === 'circle' ? cz : P.pos.z)).normalize().clone(); if (d.lengthSq() < .01) d.copy(dir);
    const ok = hurtEnemy(e, base, { dir: h.shape === 'circle' ? d : dir.clone().lerp(d, .35).normalize(), kb: h.kb, launch: h.launch, pull: h.pull, stagger: (h.stagger ?? 0) * st.stagger, freeze: h.freeze, armor: h.armor, elem, big: h.big, heavy: isHeavyAtk || !!h.big, counter: P.atkCounter });
    if (ok) { n++; if (h.big) heavyHit = true; if (h.dmg > 0 && P.atkCounter && last && P.counterChain >= 3 && false) heavyHit = true; }
  }
  if (h.dmg > 0) {
    for (const p of W.projs) if (p.owner === 'e' && p.alive) { if (inShape(h, cx, cz, P.yaw, { pos: p.pos }, rangeMul)) destroyEnemyProjectile(p, true); }
    for (const dd of W.arena?.destructibles ?? []) if (dd.alive && inShape(h, cx, cz, P.yaw, { pos: V.set(dd.x, 0, dd.z) }, rangeMul)) damageDestructible(dd, base * 1.2);
  }
  // arcane: spell bolt on each light hit
  if (st.id === 'arcane' && P.lastLight && h.dmg > 0 && h.act !== 'proj') {
    const t = nearestEnemy(P.pos, 16); const dd = t ? V.set(t.pos.x - P.pos.x, 0, t.pos.z - P.pos.z).normalize().clone() : dir.clone();
    spawnProj({ owner: 'p', kind: 'orb', elem, pos: V2.set(P.pos.x + dd.x, 1.3, P.pos.z + dd.z), dir: dd, speed: 26, life: .9, size: .3, dmg: 7 * (awk ? 1.3 : 1), src: null, pierce: false, deflectable: false });
  }
  if (awk && P.lastLight && last && h.act !== 'proj') { V.set(fx, 0, fz); spawnProj({ owner: 'p', kind: 'wave', elem, pos: V2.set(P.pos.x + fx, 1.1, P.pos.z + fz), dir: V, speed: 22, life: .6, size: 2.2, dmg: 14, src: null, pierce: true, deflectable: false }); }
  if (P.atkCounter && last && P.counterChain >= 3 && h.dmg > 0) { vfx.burst(elem, center, 6, true); for (const e of W.enemies) if (e.alive && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 6) hurtEnemy(e, 25 * st.dmg, { dir: V.set(e.pos.x - P.pos.x, 0, e.pos.z - P.pos.z).normalize().clone(), kb: 3, elem, stagger: 1, fx: false, counter: true }); }
  // ---- visuals
  const yv = P.pos.y + 1.1, pitch = P.pose[3], vertical = pitch < 1.15 || pitch > 2.0 ? 1 : 0;
  const big = !!h.big; const r = Math.min(h.range * rangeMul, 20);
  switch (h.fx) {
    case 'burst': vfx.burst(elem, center, Math.min(r, 10), big); elemSfx(elem, big); break;
    case 'slam': vfx.slam(elem, center, Math.min(r, 9), big); elemSfx(elem, true); sfx.elem('slam', big); break;
    case 'pillar': for (let i = 0; i < 4; i++) { const px = P.pos.x + fx * (2.4 + i * 2.8), pz = P.pos.z + fz * (2.4 + i * 2.8); vfx.delay(i * .07, () => vfx.pillar(elem, V.set(px, 0, pz).clone(), 3)); } elemSfx(elem, true); break;
    case 'bolts': { let k = 0; for (const e of W.enemies) if (e.alive && k < 2 && inShape(h, cx, cz, P.yaw, e, rangeMul)) { vfx.lightning(V.set(e.pos.x, 0, e.pos.z).clone(), 'lightning', 1.6); k++; } if (!k) vfx.burst(elem, center, Math.min(r, 6)); sfx.elem('lightning'); } break;
    case 'crystals': vfx.crystals(center, Math.min(r, 8), elem); sfx.elem('ice', big); break;
    case 'rift': vfx.rift(center, c1, 2.4, .6); vfx.burst(elem, center, Math.min(r, 6), big); sfx.elem('void', big); break;
    case 'arc': vfx.slashArc(elem, V.set(P.pos.x, yv, P.pos.z), P.yaw, Math.min(r * .85, 6), vertical ? Math.PI / 2 : 0, .35); sfx.elem(elem === 'plasma' ? 'plasma' : 'lightning'); break;
    case 'ult': vfx.ult(elem, center, Math.min(r * (awk ? 1.1 : 1), 20)); elemSfx(elem, true); sfx.elem('slam', true); bridge.flash('#fff', .7, 500); break;
    case 'none': break;
    default:
      if (h.shape === 'circle') vfx.fx('ring', { pos: [cx, P.pos.y + .3, cz], s0: .6, s1: Math.min(r, 6), color: c1, dur: .22, op: .8 });
      else if (h.shape !== 'line') vfx.slashArc(elem, V.set(P.pos.x + fx * .3, yv, P.pos.z + fz * .3), P.yaw, Math.min(2.2 + r * .35, 4.5), vertical ? Math.PI / 2 + (P.pose[5] * -.3) : P.pose[5] * -.4, .22);
  }
  if (h.shape === 'line' && h.fx !== 'none') vfx.fx('flare', { pos: [P.pos.x + fx * r * .5, yv, P.pos.z + fz * r * .5], s0: [.3, .05, 1], s1: [r * .9, .22, 1], color: c1, dur: .22, roll: Math.atan2(-fz * 0, 1) });
  if (h.shake) W.shake = Math.max(W.shake, h.shake * (n || h.act === 'resolve' ? 1 : .6));
  if (n > 0) { W.hitStop = Math.max(W.hitStop, (h.stop ?? .025) * (atk.cinematic ? .4 : 1)); input.rumble(heavyHit ? .9 : .4, .4, heavyHit ? 120 : 50); }
  if (n > 0 && P.atkCounter) W.fovPunch = 6;
  if (h.act === 'resolve') { for (const e of W.enemies) if (e.alive) e.rig.flash(0xffffff, 1.2); }
}
const tmpR = new THREE.Vector3();
function nearestRandom(r: number): THREE.Vector3 {
  const P = W.P, c: Enemy[] = W.enemies.filter(e => e.alive && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < r);
  if (c.length) { const e = c[Math.floor(Math.random() * c.length)]; return tmpR.set(e.pos.x, 0, e.pos.z); }
  const a = Math.random() * 6.28, d = 3 + Math.random() * 6; return tmpR.set(P.pos.x + Math.cos(a) * d, 0, P.pos.z + Math.sin(a) * d);
}
let markIdx = 0;
function nearestRandomEnemy(): Enemy | null { const l = W.enemies.filter(e => e.alive); if (!l.length) return null; return l[markIdx++ % l.length]; }

// ------------------------------------------------------------------ main update
export function updatePlayer(dt: number, rawDt: number, active: boolean) {
  const P = W.P, wp = P.weapon, st = P.style, A = W.arena;
  const gravity = 28 * (A ? W.gravity : 1);
  // timers
  P.invuln = Math.max(0, P.invuln - dt); P.dodgeCd = Math.max(0, P.dodgeCd - dt); P.d.lock = Math.max(0, P.d.lock - dt); P.switchT = Math.max(0, P.switchT - dt);
  P.cds.spec1 = Math.max(0, P.cds.spec1 - dt); P.cds.spec2 = Math.max(0, P.cds.spec2 - dt); P.counterT = Math.max(0, P.counterT - dt); P.retaliate = Math.max(0, P.retaliate - dt); P.dodgeBlink = Math.max(0, P.dodgeBlink - dt);
  P.comboT = Math.max(0, P.comboT - dt); if (P.comboT <= 0 && P.combatCount > 0 && P.state !== 'attack') { P.combatCount = 0; }
  if (P.d.chainT > 0) { P.d.chainT -= dt; if (P.d.chainT <= 0) P.d.chain = 0; }
  if (P.awkT > 0) { P.awkT -= dt; if (P.awkT <= 0) { floatText(P.pos, 'AWAKENING ENDS', 'blk', 2.4); if (unlocked(P.weaponId).variant) equip(P.weaponId, true); } }
  if (W.dim > 0) W.dim = Math.max(0, W.dim - dt / (P.atk?.dur ?? 2) * .6);
  if (P.comboWin > 0 && P.state !== 'attack') P.comboWin -= dt;
  if (P.stamDelay > 0) P.stamDelay -= dt; else if (!P.sprinting && P.state !== 'deflect') P.stam = Math.min(P.maxStam, P.stam + 26 * dt);
  P.st += dt; if (P.state !== 'dying') P.hp = Math.min(P.maxHp, P.hp);
  if (P.pullT > 0 && P.pullTo) { P.pullT -= dt; const dx = P.pullTo.x - P.pos.x, dz = P.pullTo.z - P.pos.z, d = Math.hypot(dx, dz); if (d > 3) { P.pos.x += dx / d * 11 * dt; P.pos.z += dz / d * 11 * dt; } }

  const md = active ? (moveDir()?.clone() ?? null) : null; let speedTarget = 0;
  // ---------------- state machine
  if (!active || P.state === 'dying' || P.state === 'dead') {
    if (P.state === 'dying') { P.deadT += dt; P.vx *= .9; P.vz *= .9; }
    else if (P.state === 'attack' && P.atk) updateAttack(dt, 0);
  } else {
    const u = P.atk ? P.atkT / P.atk.dur : 0;
    // ---- gather permissions
    let canDodge = true, canDeflect = true, canChain = true;
    if (P.state === 'attack' && P.atk) {
      const a = P.atk, first = a.hits[0]?.t ?? .3, hold = a.holdAt ?? 9;
      const cin = !!a.cinematic;
      canDodge = !cin && !a.invuln && u >= Math.min(Math.max(.16, first * .8), hold * .95);
      canDeflect = !cin && !a.invuln && u >= Math.min(first * .9, hold * .95);
      canChain = !cin ? u >= a.cancel : u >= .96;
      if (a.dive && !P.grounded) { canDodge = false; canDeflect = false; canChain = false; }
    } else if (P.state === 'deflect') { canDodge = true; canDeflect = P.d.success ? P.d.lock <= 0 : false; canChain = P.d.success; }
    else if (P.state === 'dodge') { canDodge = false; canDeflect = P.st > .12; canChain = P.st > .1; }
    else if (P.state === 'hurt') { canDodge = P.st > .16; canDeflect = P.st > .22 && false; canChain = P.st > .26; }
    if (P.state === 'free' && P.switchT > 0) { /* switching: all actions still allowed */ }
    // ---- inputs (priority order)
    const flush = (a: 'light' | 'heavy' | 'spec1' | 'spec2' | 'dodge' | 'ult' | 'awaken' | 'deflect') => input.took(a, a === 'dodge' || a === 'deflect' ? .16 : .24);
    if (canDodge && input.peek('dodge', .16) && flush('dodge')) doDodge();
    else if (canDeflect && input.peek('deflect', .12) && flush('deflect')) doDeflect();
    else if (canChain) {
      if (input.peek('ult', .3) && P.ult >= 100 && flush('ult')) tryUlt();
      else if (input.peek('awaken', .3) && flush('awaken')) tryAwaken();
      else if (input.peek('spec1', .24) && flush('spec1')) trySpec('spec1');
      else if (input.peek('spec2', .24) && flush('spec2')) trySpec('spec2');
      else if (input.peek('heavy', .24) && flush('heavy')) startHeavy();
      else if (input.peek('light', .24) && flush('light')) startLight();
      else {
        const ids: WeaponId[] = ['inferno', 'thunder', 'void', 'glacier', 'plasma', 'titan'];
        for (let i = 0; i < 6; i++) if (input.took(('w' + (i + 1)) as 'w1', .2)) switchWeapon(ids[i]);
        if (input.took('lock', .2)) toggleLock();
      }
    }
    // free-state extras: jump / lock / sprint (also during recovery frames)
    if (input.took('lock', .2)) toggleLock();
    if ((P.state === 'free' || (P.state === 'dodge' && P.st > .12)) && input.took('jump', .12)) {
      if (P.grounded) { P.vy = 11 * (W.gravity < 1 ? .92 : 1); P.grounded = false; P.jumps = 1; sfx.step(); vfx.fx('ring', { pos: [P.pos.x, .1, P.pos.z], s0: .3, s1: 1.8, color: 0xffffff, dur: .3, op: .4 }); }
      else if (st.id === 'assassin' && P.jumps < 2) { P.vy = 10; P.jumps = 2; vfx.fx('ring', { pos: [P.pos.x, P.pos.y, P.pos.z], s0: .3, s1: 2.4, color: 0xb26bff, dur: .3, op: .8 }); sfx.dodge(); }
    }
    // ---- per-state update
    switch (P.state) {
      case 'free': {
        P.sprinting = !!md && input.isHeld('sprint') && P.stam > 4 && P.grounded;
        speedTarget = 6.4 * st.moveSpeed * (P.sprinting ? 1.55 : 1) * (P.weaponId === 'titan' ? .93 : P.weaponId === 'thunder' ? 1.07 : 1);
        if (P.sprinting) { P.stam -= 11 * dt; P.stamDelay = .5; }
        if (md) { const ty = Math.atan2(md.x, md.z); if (!(P.lock && P.lock.alive)) P.yaw += angDiff(P.yaw, ty) * Math.min(1, dt * 16); }
        if (P.lock && P.lock.alive) P.yaw += angDiff(P.yaw, Math.atan2(P.lock.pos.x - P.pos.x, P.lock.pos.z - P.pos.z)) * Math.min(1, dt * 14);
        const k = Math.min(1, dt * (P.grounded ? 14 : 4)), tx = md ? md.x * speedTarget : 0, tz = md ? md.z * speedTarget : 0;
        P.vx += (tx - P.vx) * k; P.vz += (tz - P.vz) * k; break;
      }
      case 'attack': updateAttack(dt, u); break;
      case 'deflect': {
        const d = P.d; d.age += dt; const { nw } = pw(); const k = Math.min(1, dt * 9); P.vx *= 1 - k; P.vz *= 1 - k;
        if (d.success) { d.clashT += dt; if (d.clashT > .26 && d.lock <= 0) { P.state = 'free'; P.st = 0; } }
        else {
          if (d.age > nw && d.active) { d.active = false; d.lock = .28; }
          if (d.age > nw + .2) { P.state = 'free'; P.st = 0; }
          // slow strafe while guarding
          if (md) { P.vx += md.x * 2.5 * dt * 10; P.vz += md.z * 2.5 * dt * 10; }
        }
        break;
      }
      case 'dodge': {
        P.dodgeT -= dt; const k = Math.min(1, dt * 7); P.vx *= 1 - k * .6; P.vz *= 1 - k * .6;
        const [c0, c1] = ELEM_COLORS[wp.elem]; if (Math.random() < .8) vfx.P(true, P.pos.x, .9, P.pos.z, 0, 0, 0, .3, .7, .1, c0, c1, 0, 0, .25);
        if (P.dodgeT <= 0) { P.state = 'free'; P.st = 0; if (st.id === 'assassin') P.dodgeBlink = .9; }
        break;
      }
      case 'hurt': { P.hurtT -= dt; const k = Math.min(1, dt * 8); P.vx *= 1 - k; P.vz *= 1 - k; if (P.hurtT <= 0) { P.state = 'free'; P.st = 0; } break; }
    }
    // charge visuals
    if (P.state === 'attack' && P.atk?.holdAt && P.chargeT > 0 && input.isHeld('heavy')) {
      const [c0, c1] = ELEM_COLORS[wp.elem]; const T = tipWorld(); if (Math.random() < .6) vfx.P(true, T.x + (Math.random() - .5) * 1.6, T.y + (Math.random() - .5) * 1.6, T.z + (Math.random() - .5) * 1.6, 0, 0, 0, .35, .3, .02, c0, c1, 0, 0); void c1;
    }
  }
  // ---------------- physics
  const hov = P.state === 'attack' && P.atk?.hover && !P.grounded; const g = hov ? gravity * .22 : gravity;
  if (!P.grounded || P.vy > 0) { P.vy -= g * dt; P.pos.y += P.vy * dt; }
  if (P.pos.y <= 0) { if (!P.grounded && P.vy < -6) { vfx.fx('ring', { pos: [P.pos.x, .1, P.pos.z], s0: .3, s1: 2, color: 0xffffff, dur: .3, op: .4 }); sfx.step(); } P.pos.y = 0; P.vy = 0; if (!P.grounded) { P.grounded = true; P.jumps = 0; P.airIdx = 0; } } else P.grounded = false;
  P.pos.x += P.vx * dt; P.pos.z += P.vz * dt;
  // arena bounds + obstacles + enemy separation
  if (A) {
    const R = A.radius - .7, d = Math.hypot(P.pos.x, P.pos.z); if (d > R) { P.pos.x *= R / d; P.pos.z *= R / d; }
    for (const o of A.obstacles) { const dx = P.pos.x - o.x, dz = P.pos.z - o.z, dd = Math.hypot(dx, dz), m = o.r + .45; if (dd < m && P.pos.y < 6) { P.pos.x = o.x + dx / (dd || 1) * m; P.pos.z = o.z + dz / (dd || 1) * m; } }
    for (const dd of A.destructibles) if (dd.alive) { const dx = P.pos.x - dd.x, dz = P.pos.z - dd.z, d2 = Math.hypot(dx, dz), m = dd.r + .45; if (d2 < m) { P.pos.x = dd.x + dx / (d2 || 1) * m; P.pos.z = dd.z + dz / (d2 || 1) * m; } }
  }
  if (active) for (const e of W.enemies) { if (!e.alive || e.state === 'down' || e.state === 'dying' || e.pos.y > 1.5) continue; const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz), m = e.def.radius + .42; if (d < m && !(P.state === 'dodge' || P.atk?.invuln) && P.pos.y < 1.2) { const pu = (m - d) * .6; P.pos.x += dx / (d || 1) * pu; P.pos.z += dz / (d || 1) * pu; } }
  P.speedNow = Math.hypot(P.vx, P.vz);
  if (P.grounded && P.speedNow > 3 && P.state === 'free') { P.stepT -= dt * P.speedNow; if (P.stepT <= 0) { P.stepT = 2.6; sfx.step(); } }
  // lock validity
  if (P.lock && (!P.lock.alive || Math.hypot(P.lock.pos.x - P.pos.x, P.lock.pos.z - P.pos.z) > 38)) P.lock = null;
  // ---------------- animation
  animate(dt, rawDt);
}
const pw = () => { const tr = W.run?.mode === 'training' ? useGame.getState().save.training.pw : 1; const m = W.P.style.pw * difficulty().pw * tr; return { pw: W.P.weapon.pw * m, nw: W.P.weapon.nw * (.7 + .3 * m) }; };

function toggleLock() {
  const P = W.P; if (P.lock) { P.lock = null; return; }
  const f = cam.yaw; let best = 1e9, tgt: Enemy | null = null;
  for (const e of W.enemies) { if (!e.alive) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d > 30) continue; const a = Math.abs(angDiff(f, Math.atan2(dx, dz))); const sc = d + a * 6 - (e.boss ? 4 : 0); if (sc < best) { best = sc; tgt = e; } }
  P.lock = tgt; if (tgt) { sfx.ui(); floatText(tgt.pos, '◎', 'lock', tgt.def.scale * 2.2); }
}
function tipWorld() { const m = W.P.model; tmpT.copy(m.tip); m.group.localToWorld(tmpT); return tmpT; }

function updateAttack(dt: number, uPrev: number) {
  const P = W.P, a = P.atk!, wp = P.weapon; void uPrev;
  let adt = dt * P.atkSpeed;
  if (a.slowmo && W.slowT > 0 && W.slowF < 1 && P.atkT / a.dur >= a.slowmo[0] && P.atkT / a.dur <= a.slowmo[1]) adt = dt / W.slowF;
  // hold behaviours
  if (a.holdAt !== undefined) {
    const hu = a.holdAt * a.dur;
    if (a.dive) {
      if (P.atkT >= hu - .001 && !P.grounded) { P.atkT = hu; if (!a.leap) P.vy = -30; adt = 0; P.vx *= .9; P.vz *= .9; if (!a.leap) vfx.P(true, P.pos.x, P.pos.y + 1, P.pos.z, 0, 4, 0, .3, .5, .05, ELEM_COLORS[wp.elem][0], ELEM_COLORS[wp.elem][1]); }
    } else if (P.chargeT > -1 && P.atkT >= hu - .001 && P.atkT <= hu + .05 && !P.charged) {
      if (input.isHeld('heavy') && P.chargeT < 1.3) {
        P.atkT = hu; adt = 0; const was = P.chargeT; P.chargeT += dt;
        if (was < .6 && P.chargeT >= .6) { sfx.elem(wp.elem === 'phys' ? 'slam' : wp.elem === 'earth' ? 'slam' : wp.elem as 'fire'); vfx.fx('ring', { pos: [P.pos.x, 1, P.pos.z], s0: 3, s1: .5, color: ELEM_COLORS[wp.elem][1], dur: .3 }); W.shake = Math.max(W.shake, .15); P.rig.flash(ELEM_COLORS[wp.elem][1], .9); vfx.fx('flare', { pos: tipWorld(), s0: .5, s1: 2.6, color: ELEM_COLORS[wp.elem][1], dur: .3 }); }
        if (P.chargeT > .6) P.rig.flash(ELEM_COLORS[wp.elem][1], .35 + Math.sin(W.time * 30) * .15);
      } else {
        P.rig.flash(0, 0);
        if (P.chargeT >= .6 && a === wp.heavy) { P.atk = wp.charged; P.charged = true; P.atkMul *= 1 + Math.min(P.chargeT, 1.2) * .3; sfx.swing(wp.id, true); }
        else P.charged = true;
      }
    }
  }
  const a2 = P.atk!; P.atkT += adt; const dur = a2.dur, u = P.atkT / dur;
  if (a2.slowmo && u >= a2.slowmo[0] && u <= a2.slowmo[1]) { W.slowT = .05; W.slowF = a2.slowmo[2]; }
  // swing sound at trail start
  if (!P.swung && a2.trail && u >= a2.trail[0] - .04) { P.swung = true; sfx.swing(wp.id, a2 === wp.heavy || a2 === wp.charged || a2.dur > .9); }
  // lunge
  if (a2.lunge && u >= a2.lunge[0] && u <= a2.lunge[1]) {
    const sp = a2.lunge[2] / ((a2.lunge[1] - a2.lunge[0]) * dur / P.atkSpeed), fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    let blocked = false;
    if (!a2.invuln) for (const e of W.enemies) { if (!e.alive || e.pos.y > 1.5) continue; const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d < e.def.radius + .9 && ((e.pos.x - P.pos.x) * fx + (e.pos.z - P.pos.z) * fz) > 0) blocked = true; }
    P.vx = blocked ? 0 : fx * sp; P.vz = blocked ? 0 : fz * sp;
  } else { const k = Math.min(1, dt * 12); P.vx *= 1 - k; P.vz *= 1 - k; const md = moveDir(); if (md && P.grounded) { P.vx += md.x * 1.6 * dt * 10 * .35; P.vz += md.z * 1.6 * dt * 10 * .35; } }
  // fire hits
  while (P.hitIdx < a2.hits.length && u >= a2.hits[P.hitIdx].t && (!a2.hits[P.hitIdx].land || P.grounded)) { const i = P.hitIdx++; fireHit(a2.hits[i], a2, i === a2.hits.length - 1); if (P.state !== 'attack') return; }
  if (u >= 1) { endAttack(); }
}
function endAttack() {
  const P = W.P; P.state = 'free'; P.st = 0; if (P.lastLight) P.comboWin = .75; P.atk = null; P.rig.flash(0, 0); P.d.success = false;
}

// ------------------------------------------------------------------ animation + trails
function animate(dt: number, rawDt: number) {
  const P = W.P, rig = P.rig, wp = P.weapon, u = P.atk ? clamp(P.atkT / P.atk.dur, 0, 1) : 0, t = W.time, dual = !!wp.dual;
  let R: number[] = P.pose, L: number[] = P.poseL, rate = 14, lean = 0, twist = 0;
  const idleP = idle.slice(); const breathe = Math.sin(t * 2) * .02; idleP[1] += breathe;
  R = idleP; L = idleP; // default
  if (P.state === 'attack' && P.atk) {
    const a = P.atk; samplePose(a.kf, u, poseTmp); R = poseTmp; rate = 40;
    if (dual) {
      const hand = a.hand ?? 'R';
      if (hand === 'R') L = idleP; else if (hand === 'L') { L = poseTmp.slice(); R = idleP; } else { samplePose(a.kf, Math.max(0, u - .07), poseTmp2); L = poseTmp2; }
    }
  } else if (P.state === 'deflect') {
    const d = P.d; if (d.success && d.clashT < 1) { samplePose(wp.clash, clamp(d.clashT / .26, 0, 1), poseTmp); } else samplePose(wp.guard, clamp(d.age / .22, 0, 1), poseTmp);
    R = poseTmp; L = poseTmp; rate = 30;
  } else if (P.state === 'dodge') {
    const p = idleP.slice(); p[2] = .0; p[6] = .65; p[7] = 0; p[3] = 1.4; R = p; L = p; rate = 20; lean = 0;
  } else if (P.state === 'hurt') { const p = idleP.slice(); p[6] = -.35; p[1] = .95; p[3] = .5; R = p; L = p; rate = 25; }
  else if (P.state === 'dying') { const p = idleP.slice(); p[6] = -.6; p[3] = .2; R = p; L = p; rate = 6; }
  else {
    const p = idleP.slice(); const sp = P.speedNow; p[6] = clamp(sp * .028, 0, .22); if (P.switchT > 0) { p[1] = 1.7; p[3] = 2.2; p[2] = .6; }
    if (!P.grounded) { p[6] = .1; p[1] += .1; }
    if (P.charged === false && false) lean = 0;
    p[2] += Math.sin(t * 8) * clamp(sp * .004, 0, .03); R = p; L = p; rate = P.switchT > 0 ? 18 : 12;
  }
  void lean; void twist;
  rig.root.position.copy(P.pos); rig.root.rotation.y = P.yaw;
  if (P.state === 'dying') { const k = clamp(P.deadT * 1.6, 0, 1); rig.root.rotation.x = -k * 1.45; rig.root.position.y += -.0 + k * .0; }
  else rig.root.rotation.x = 0;
  rig.pose(R, dual ? L : null, dt, rate, t);
  P.pose = R === poseTmp ? poseTmp.slice() : R.slice(); P.rig.legAnim(P.grounded ? P.speedNow : 0, dt, !P.grounded && P.vy !== 0);
  // flash on damage/invuln shimmer
  if (P.invuln > 0 && P.state === 'dodge') rig.flash(0x66ccff, .25 + Math.sin(t * 40) * .1); else if (P.state !== 'attack' && P.awkT <= 0) rig.flash(0, 0);
  if (P.awkT > 0 && P.state !== 'attack') rig.flash(ELEM_COLORS[wp.elem][1], .12 + Math.sin(t * 6) * .05);
  P.model.update(t, P.awkT > 0, dt);
  rig.root.updateMatrixWorld(true);
  // trails & ambient
  const a = P.atk; let on = false, on2 = false;
  if (P.state === 'attack' && a?.trail && u >= a.trail[0] && u <= a.trail[1]) { const hand = a.hand ?? 'R'; on = !dual || hand !== 'L'; on2 = dual && hand !== 'R'; }
  tmpB.copy(P.model.base); P.model.group.localToWorld(tmpB); tmpT.copy(P.model.tip); P.model.group.localToWorld(tmpT);
  P.trail.update(dt, tmpB, tmpT, on);
  vfx.ambient(wp.elem, tmpB, tmpT, rawDt, P.awkT > 0, on, wp.id === 'inferno' || wp.id === 'void' ? 1 : .6);
  if (P.model.second) {
    tmpB2.copy(P.model.base); P.model.second.localToWorld(tmpB2); tmpT2.copy(P.model.tip); P.model.second.localToWorld(tmpT2);
    P.trail2?.update(dt, tmpB2, tmpT2, on2); vfx.ambient(wp.elem, tmpB2, tmpT2, rawDt, P.awkT > 0, on2, .6);
  }
  P.rig.cur; void addScore; void gainUlt;
}
