import * as THREE from 'three';
import { Elem, Hit, StatKey } from './types';
import { ELEM_COLORS, CHALLENGES } from './data/world';
import { vfx, crescent } from './vfx';
import { sfx } from './audio';
import { bridge, useGame } from './store';
import { input } from './input';
import { Enemy, Proj, W, angDiff, clamp, difficulty, floatText, settings } from './world';
import { glowTex, slashTex } from './textures';

const V = new THREE.Vector3(), V2 = new THREE.Vector3();

// ------------------------------------------------------------------ meters / score / stats
export function addScore(n: number, label = '') {
  const r = W.run; if (!r || r.over) return;
  const mult = 1 + Math.min(W.P.combatCount, 60) / 12;
  r.score += Math.round(n * (label === 'raw' ? 1 : mult));
}
export function track(stat: StatKey, v: number, how: 'add' | 'max' = 'add') {
  const P = W.P, news = useGame.getState().bump(P.weaponId, stat, v, how);
  for (const id of news) {
    const c = CHALLENGES[P.weaponId].find(x => x.id === id);
    if (c) { bridge.popup('CHALLENGE COMPLETE', 'gold', `${c.label} · ${c.rewardLabel}`); sfx.win(); }
  }
}
export function gainUlt(v: number) {
  const P = W.P, tr = W.run?.mode === 'training' ? 2.5 : 1; P.ult = Math.min(100, P.ult + v * tr * (P.style.id === 'arcane' ? 1.25 : 1));
  if (P.awkT <= 0) P.awk = Math.min(100, P.awk + v * .55 * tr);
}
export function nearestEnemy(from: THREE.Vector3, maxD: number, pred?: (e: Enemy) => boolean): Enemy | null {
  let best: Enemy | null = null, bd = maxD;
  for (const e of W.enemies) { if (!e.alive || (pred && !pred(e))) continue; const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z); if (d < bd) { bd = d; best = e; } }
  return best;
}
export const pwNow = () => {
  const P = W.P, tr = W.run?.mode === 'training' ? useGame.getState().save.training.pw : 1;
  const m = P.style.pw * difficulty().pw * tr; return { pw: P.weapon.pw * m, nw: P.weapon.nw * (.7 + .3 * m) };
};

// ------------------------------------------------------------------ hit shapes
export function inShape(h: Hit, ox: number, oz: number, yaw: number, e: { pos: THREE.Vector3; def?: { radius: number } }, rangeMul = 1): boolean {
  const rad = e.def?.radius ?? .5, dx = e.pos.x - ox, dz = e.pos.z - oz, d = Math.hypot(dx, dz), range = h.range * rangeMul;
  if (Math.abs(e.pos.y - W.P.pos.y) > 4.2 && !h.land) return false;
  const shape = h.shape ?? 'cone';
  if (shape === 'circle') return d - rad <= range;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), f = dx * fx + dz * fz, l = dx * fz - dz * fx;
  if (shape === 'line') return f > -.4 - rad && f - rad <= range && Math.abs(l) <= (h.width ?? 1.4) / 2 + rad;
  if (d - rad > range) return false; if (d < rad + .6) return true;
  return Math.abs(angDiff(yaw, Math.atan2(dx, dz))) <= (h.arc ?? 2) / 2 + Math.atan2(rad, d);
}

// ------------------------------------------------------------------ damaging enemies
export interface HurtOpts { dir: THREE.Vector3; kb?: number; launch?: number; pull?: number; stagger?: number; freeze?: number; armor?: number; elem?: Elem; big?: boolean; heavy?: boolean; fx?: boolean; counter?: boolean; guardable?: boolean; src?: 'p' | 'proj' | 'hazard'; posture?: number }
export function hurtEnemy(e: Enemy, dmg: number, o: HurtOpts): boolean {
  const P = W.P; if (!e.alive || e.state === 'dying' || e.state === 'phase' || e.state === 'dead') return false;
  const elem = o.elem ?? 'phys', [c0] = ELEM_COLORS[elem], cen = V.set(e.pos.x, e.pos.y + e.def.scale * 1.1, e.pos.z).clone();
  const toP = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  if (e.guarding && o.guardable !== false && o.src !== 'hazard' && e.frozenT <= 0 && Math.abs(angDiff(e.yaw, toP)) < 1.2 && e.state !== 'stagger') {
    if (!o.big && !o.heavy && (o.armor ?? 1) < 2) {
      vfx.clash(elem, cen, o.dir, false, 1); sfx.clash(.7); e.flash = .08; e.posture += 4; floatText(e.pos, 'BLOCKED', 'blk');
      e.kx -= o.dir.x * -.5; W.hitStop = Math.max(W.hitStop, .04); P.combatCount += 0; return true;
    }
    e.guarding = false; e.staggerT = 1.4; e.state = 'stagger'; e.st = 0; sfx.guardBreak(); floatText(e.pos, 'GUARD BREAK', 'crit'); W.shake = Math.max(W.shake, .3);
  }
  let m = 1; if (e.staggerT > 0 || e.state === 'stagger') m *= 1.4; if (e.frozenT > 0) m *= 1.3; if (e.state === 'recover') m *= 1.15;
  if (e.boss && e.state === 'stagger') m *= 1.15;
  dmg *= m; e.hp -= dmg; e.lastDmgT = W.time; e.flash = .12;
  const st = P.style;
  // posture & armor
  e.posture += (dmg * .35 + (o.stagger ?? 0) * 6) * st.stagger * (o.posture ?? 1);
  e.armor = Math.max(0, e.armor - dmg * .5 * (o.armor ?? 1) * st.armorBreak * (o.heavy ? 1.5 : 1));
  if (e.armor <= 0 && e.maxArmor > 0 && !e.boss && e.state !== 'stagger') { e.maxArmor = 0; floatText(e.pos, 'ARMOR BREAK', 'crit'); sfx.guardBreak(); W.shake = Math.max(W.shake, .25); }
  const flinch = !e.boss && (e.armor <= 0 || o.launch);
  // reactions
  if (o.freeze) { e.frozenT = Math.max(e.frozenT, o.freeze * (e.boss ? .3 : 1)); if (e.state === 'windup' || e.state === 'strike') { e.state = 'move'; e.atk = null; e.st = 0; } floatText(e.pos, 'FROZEN', 'ice'); }
  const air = e.pos.y > .4;
  if (o.launch && !e.boss) {
    const l = o.launch * (e.def.scale > 1.3 ? .6 : 1) * (e.maxArmor > 0 && e.armor > 0 ? .5 : 1); e.vy = Math.max(e.vy, l); e.state = 'air'; e.st = 0; e.atk = null; e.cue = false; e.rig.root.visible = true;
  } else if (air && !e.boss) { e.vy = Math.max(e.vy, 3.2); e.state = 'air'; }
  else if (flinch && e.state !== 'stagger' && e.state !== 'down') { e.state = 'hurt'; e.hurtT = .3; e.atk = null; e.st = 0; e.cue = false; e.rig.root.visible = true; }
  if (o.stagger && !e.boss && o.stagger > .7 && e.state !== 'air') { e.staggerT = Math.max(e.staggerT, o.stagger); e.state = 'stagger'; e.atk = null; e.st = 0; e.cue = false; }
  const kbm = e.boss ? .15 : e.def.scale > 1.3 ? .5 : 1;
  if (o.kb) { e.kx += o.dir.x * o.kb * 3 * kbm; e.kz += o.dir.z * o.kb * 3 * kbm; }
  if (o.pull && !e.boss) { const d = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z); const s = Math.min(o.pull * 3.2, Math.max(0, d - 1.6) * 5); e.kx += (P.pos.x - e.pos.x) / (d || 1) * s; e.kz += (P.pos.z - e.pos.z) / (d || 1) * s; }
  if (e.posture >= e.maxPosture && e.state !== 'stagger') {
    e.posture = 0; e.staggerT = e.boss ? 3.6 : 2.4; e.state = 'stagger'; e.st = 0; e.atk = null; e.cue = false; e.guarding = false; e.rig.root.visible = true;
    floatText(e.pos, e.boss ? 'POSTURE BREAK' : 'BREAK', 'crit', 2.6); sfx.guardBreak(); W.hitStop = Math.max(W.hitStop, .1); W.shake = Math.max(W.shake, .5);
    if (e.boss) bridge.popup('POSTURE BREAK', 'gold', 'HEAVY ATTACK to execute!'); vfx.burst('phys', cen, 3);
  }
  // feedback
  if (o.fx !== false) { vfx.impact(elem, cen, o.dir, o.big ? 1.6 : .9); sfx.hit(o.big ? 1.4 : 1, elem); sfx.enemyHurt(); }
  floatText(e.pos, String(Math.round(dmg)), o.big || dmg > 40 ? 'dmg big' : o.counter ? 'dmg ctr' : 'dmg', e.def.scale * 1.9);
  if (o.src !== 'hazard') {
    P.combatCount++; P.comboT = 2.8; track('maxCombo', P.combatCount, 'max'); if (!P.grounded) track('airHits', 1);
    gainUlt(Math.min(4, dmg * .1) + .6); addScore(5 + Math.round(dmg * .3));
    if (st.id === 'berserker') P.hp = Math.min(P.maxHp, P.hp + dmg * .04);
    P.lastHitT = W.time; void c0;
  }
  if (e.hp <= 0) killEnemy(e, o);
  return true;
}

export function killEnemy(e: Enemy, o?: HurtOpts) {
  if (!e.alive) return; e.alive = false; e.hp = 0; e.atk = null; e.rig.root.visible = true; e.cue = false;
  const P = W.P, r = W.run, cen = new THREE.Vector3(e.pos.x, e.pos.y + e.def.scale, e.pos.z);
  const { score } = e.def; addScore(score * (e.mult.hp > 1.2 ? 1.3 : 1) * 1, 'raw'); if (r) { r.kills++; r.score += 0; }
  track('kills', 1); gainUlt(12);
  if (P.lock === e) P.lock = null;
  if (e.boss) {
    e.state = 'dying'; e.deathT = 0; W.cine = { t: 0, dur: 3.6, target: e, kind: 'finisher' }; W.slowT = 1.3; W.slowF = .2; sfx.boss('die');
    bridge.flash('#ffffff', .8, 600); bridge.banner('FOE DEFEATED', e.def.name); P.invuln = 5;
    const [c0, c1] = ELEM_COLORS[e.def.elem];
    for (let i = 0; i < 8; i++) vfx.delay(.1 + i * .22, () => { V2.set(e.pos.x + (Math.random() - .5) * 3, 1 + Math.random() * 4, e.pos.z + (Math.random() - .5) * 3); vfx.burst(e.def.elem, V2.clone(), 4 + Math.random() * 2, true); sfx.elem(e.def.elem === 'phys' ? 'slam' : e.def.elem === 'earth' ? 'slam' : e.def.elem as 'fire', true); W.shake = Math.max(W.shake, .5); });
    vfx.delay(1.6, () => { vfx.ult(e.def.elem, new THREE.Vector3(e.pos.x, 0, e.pos.z), 12); W.shake = 1; bridge.flash('#fff', .9, 700); void c0; void c1; });
  } else {
    e.state = 'dead'; e.deathT = 0; sfx.elem(e.def.elem === 'phys' ? 'slam' : (e.def.elem as 'fire'), false); vfx.impact(o?.elem ?? 'phys', cen, o?.dir ?? V2.set(0, 1, 0), 1.6);
    vfx.spark(cen.x, cen.y, cen.z, 0, 1, 0, 20, 8, 1, 0xffd9a0, .7);
    const roll = Math.random(); if (roll < .22) dropPickup('hp', e.pos); else if (roll < .5) dropPickup('ult', e.pos);
    if (W.P.hp / W.P.maxHp < .35 && Math.random() < .35) dropPickup('hp', e.pos);
    W.hitStop = Math.max(W.hitStop, .06);
  }
  if (P.style.id === 'berserker') P.hp = Math.min(P.maxHp, P.hp + 4);
}
export function dropPickup(kind: 'hp' | 'ult', p: THREE.Vector3) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), new THREE.MeshBasicMaterial({ color: kind === 'hp' ? 0x4dff8a : 0xffd34d, transparent: true, opacity: .95, blending: THREE.AdditiveBlending }));
  m.position.set(p.x, 1, p.z); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: kind === 'hp' ? 0x4dff8a : 0xffd34d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(1.6); m.add(sp);
  W.scene.add(m); W.pickups.push({ kind, pos: m.position.clone(), mesh: m, t: 0 });
}

// ------------------------------------------------------------------ damaging the player / deflection
export function damagePlayer(dmg: number, from: THREE.Vector3, o: { heavy?: boolean; unblock?: boolean; elem?: Elem; chip?: boolean } = {}) {
  const P = W.P; if (P.state === 'dying' || P.state === 'dead' || P.invuln > 0) return;
  dmg *= difficulty().dmg * P.style.taken; P.hp -= dmg; P.combatCount = 0; P.comboT = 0; P.lastHitT = W.time;
  const r = W.run; if (r) { r.noHit = false; r.damageTaken += dmg; }
  if (P.style.id === 'juggernaut') P.retaliate = 3.2;
  P.ult = Math.min(100, P.ult + dmg * .12);
  const hyper = P.style.id === 'juggernaut' && dmg < 22, immune = !!P.atk?.invuln;
  if (!o.chip && !immune && !(hyper && P.state === 'attack')) {
    P.state = 'hurt'; P.st = 0; P.hurtT = o.heavy ? .5 : .32; P.atk = null; P.d.active = false; P.chargeT = 0;
    const d = Math.hypot(P.pos.x - from.x, P.pos.z - from.z) || 1, k = o.heavy ? 9 : 5; P.vx = (P.pos.x - from.x) / d * k; P.vz = (P.pos.z - from.z) / d * k;
  }
  P.invuln = o.chip ? .12 : .28;
  const c = V.set(P.pos.x, P.pos.y + 1.2, P.pos.z).clone();
  vfx.impact(o.elem ?? 'phys', c, V2.set(P.pos.x - from.x, 0, P.pos.z - from.z).normalize(), 1.1);
  sfx.hurt(); W.shake = Math.max(W.shake, o.heavy ? .55 : .35); W.hitStop = Math.max(W.hitStop, .05);
  bridge.flash('#ff1030', o.chip ? .15 : .42, 320); input.rumble(.8, .5, 160);
  floatText(P.pos, String(Math.round(dmg)), 'dmg hurt', 2.2);
  if (P.hp <= 0) { P.hp = 0; P.state = 'dying'; P.st = 0; P.atk = null; W.slowT = 1.4; W.slowF = .25; sfx.fail(); }
}

export type StrikeResult = 'perfect' | 'normal' | 'fail' | 'dodged';
export function resolveEnemyStrike(e: Enemy | null, o: { dmg: number; unblock: boolean; heavy: boolean; pos: THREE.Vector3; elem: Elem; posture?: number; proj?: Proj }): StrikeResult {
  const P = W.P;
  if (P.state === 'dying' || P.state === 'dead') return 'dodged';
  if (P.invuln > 0 && P.state !== 'deflect') {
    if (P.state === 'dodge' && !P.perfectDodgeUsed && o.dmg > 0) {
      P.perfectDodgeUsed = true; W.slowT = .7; W.slowF = .35; gainUlt(10); addScore(75); sfx.perfectDodge(); bridge.popup('PERFECT DODGE', 'cyan', ''); bridge.flash('#58d8ff', .18, 300);
      vfx.fx('ring', { pos: [P.pos.x, 1, P.pos.z], s0: .5, s1: 5, color: 0x58d8ff, dur: .4 });
    }
    return 'dodged';
  }
  const dx = o.pos.x - P.pos.x, dz = o.pos.z - P.pos.z;
  if (!o.unblock && P.state === 'deflect' && P.d.active && Math.abs(angDiff(P.yaw, Math.atan2(dx, dz))) < 2) {
    const { pw, nw } = pwNow(), age = P.d.age;
    if (age <= pw) { onPerfect(e, o); return 'perfect'; }
    if (age <= nw) { onNormal(e, o); return 'normal'; }
  }
  if (P.invuln > 0) return 'dodged';
  if (o.unblock && P.state === 'deflect') floatText(P.pos, 'UNBLOCKABLE', 'blk', 2.4);
  damagePlayer(o.dmg, e ? e.pos : o.pos, { heavy: o.heavy || o.unblock, elem: o.elem });
  return 'fail';
}

function contactPoint(e: Enemy | null, o: { pos: THREE.Vector3 }) {
  const P = W.P; const c = V.set((P.pos.x + (e ? e.pos.x : o.pos.x)) / 2, P.pos.y + 1.35, (P.pos.z + (e ? e.pos.z : o.pos.z)) / 2).clone();
  const dir = V2.set((e ? e.pos.x : o.pos.x) - P.pos.x, 0, (e ? e.pos.z : o.pos.z) - P.pos.z).normalize().clone(); return { c, dir };
}
function onPerfect(e: Enemy | null, o: { dmg: number; heavy: boolean; pos: THREE.Vector3; elem: Elem; posture?: number; proj?: Proj }) {
  const P = W.P, wp = P.weapon, d = P.d, { c, dir } = contactPoint(e, o);
  d.chain++; d.chainT = 3.8; d.success = true; d.clashT = 0; d.active = false; d.lock = wp.lock * .5; const chain = d.chain;
  vfx.clash(wp.elem, c, dir, true, chain, wp.id); sfx.perfect(wp.id, chain);
  W.hitStop = Math.max(W.hitStop, Math.min(.17, .09 + chain * .012)); W.shake = Math.max(W.shake, .38 + Math.min(chain, 6) * .04); W.fovPunch = 7 + Math.min(chain, 6);
  bridge.flash('#' + new THREE.Color(wp.color2).getHexString(), .38, 260); bridge.zoom(.045); input.rumble(1, .8, 140);
  bridge.popup('PERFECT DEFLECT', 'perfect', chain > 1 ? `×${chain} CHAIN` : wp.deflectName.toUpperCase());
  P.counterT = 1.5; P.counterTarget = e; P.counterChain = chain; P.stam = Math.min(P.maxStam, P.stam + 14 + (P.style.id === 'samurai' ? 22 : 0));
  gainUlt(7 + chain * 1.6); addScore(150 * chain, 'raw'); if (W.run) { W.run.perfects++; W.run.deflects++; }
  track('perfects', 1); track('chain', chain, 'max');
  if (chain >= 4) { W.slowT = .22; W.slowF = .4; }
  if (e) {
    e.cue = false; e.rig.flash(0xffffff, 1.4); e.flash = .15;
    e.kx += dir.x * 4; e.kz += dir.z * 4; e.posture += (o.posture ?? 22) + chain * 2;
    if (e.boss) {
      e.state = 'hurt'; e.hurtT = .85; e.atk = null; e.st = 0; e.hitN = 0;
      if (e.posture >= e.maxPosture) { e.posture = 0; e.staggerT = 3.6; e.state = 'stagger'; floatText(e.pos, 'POSTURE BREAK', 'crit', 3.4); bridge.popup('POSTURE BREAK', 'gold', 'HEAVY ATTACK to execute!'); sfx.guardBreak(); W.shake = .6; }
    } else { e.state = 'stagger'; e.staggerT = wp.id === 'titan' ? 2.6 : 1.9; e.atk = null; e.st = 0; e.guarding = false; e.rig.root.visible = true; if (e.posture >= e.maxPosture) e.posture = 0; }
  }
  const pr = o.proj; if (pr) reflectProj(pr, true);
  P.vx = -dir.x * 3; P.vz = -dir.z * 3;
}
function onNormal(e: Enemy | null, o: { dmg: number; heavy: boolean; pos: THREE.Vector3; elem: Elem; proj?: Proj }) {
  const P = W.P, d = P.d, { c, dir } = contactPoint(e, o); d.active = false; d.lock = .12; d.success = true; d.clashT = 0; d.chain = 0;
  vfx.clash(P.weapon.elem, c, dir, false, 1, P.weapon.id); sfx.deflect(P.weapon.id); W.hitStop = Math.max(W.hitStop, .045); W.shake = Math.max(W.shake, .16);
  const cost = o.heavy ? 20 : 11; P.stam -= cost; P.stamDelay = .8; bridge.popup('DEFLECT', 'normal', ''); input.rumble(.4, .3, 80);
  if (P.stam <= 0) { P.stam = 0; sfx.guardBreak(); damagePlayer(o.dmg * .7, e ? e.pos : o.pos, { heavy: true }); floatText(P.pos, 'GUARD BROKEN', 'crit', 2.6); return; }
  damagePlayer(o.dmg * (o.heavy ? .45 : .22), e ? e.pos : o.pos, { chip: true });
  if (e) { e.posture += 8; e.kx += dir.x * 1.5; e.kz += dir.z * 1.5; }
  P.vx = -dir.x * 4.5; P.vz = -dir.z * 4.5; gainUlt(2); addScore(40);
  if (o.proj) reflectProj(o.proj, false);
}

// ------------------------------------------------------------------ projectiles
const pool: Record<string, THREE.Group[]> = {};
const slash = () => slashTex();
function makeMesh(kind: string): THREE.Group {
  const g = new THREE.Group();
  const am = () => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.name = 'glow'; g.add(sp);
  if (kind === 'wave') { const m = new THREE.Mesh(crescent(2.0, .35), am()); (m.material as THREE.MeshBasicMaterial).map = slash(); m.name = 'body'; g.add(m); const m2 = new THREE.Mesh(crescent(1.8, .18), am()); (m2.material as THREE.MeshBasicMaterial).map = slash(); m2.name = 'core'; m2.position.z = .08; g.add(m2); }
  else if (kind === 'lance' || kind === 'spear') { const m = new THREE.Mesh(new THREE.ConeGeometry(.2, kind === 'spear' ? 1.2 : 1.6, 6).rotateX(Math.PI / 2).translate(0, 0, .5), new THREE.MeshStandardMaterial({ roughness: .1, flatShading: true, transparent: true, opacity: .92 })); m.name = 'body'; g.add(m); if (kind === 'spear') { const sh = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.2, 6).rotateX(Math.PI / 2).translate(0, 0, -.9), new THREE.MeshStandardMaterial({ color: 0xcfe6f0, metalness: .8, roughness: .2 })); sh.name = 'shaft'; g.add(sh); } }
  else { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); m.name = 'core'; g.add(m); const m2 = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), am()); m2.name = 'body'; m2.scale.setScalar(1.7); g.add(m2); }
  return g;
}
export function spawnProj(o: { owner: 'e' | 'p'; kind: 'orb' | 'wave' | 'lance' | 'spear'; elem: Elem; pos: THREE.Vector3; dir: THREE.Vector3; speed: number; life: number; size: number; dmg: number; src: Enemy | null; pierce?: boolean; freeze?: number; deflectable?: boolean; mult?: number }) {
  const kind = o.kind; const g = (pool[kind] ??= []).pop() ?? makeMesh(kind); const [c0, c1] = ELEM_COLORS[o.elem];
  g.traverse(ob => {
    const me = ob as THREE.Mesh; const m = me.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | THREE.SpriteMaterial | undefined; if (!m) return;
    if (ob.name === 'glow') { m.color.setHex(c1); (ob as THREE.Sprite).scale.setScalar(o.size * (kind === 'wave' ? 2.2 : 3.6)); m.opacity = kind === 'wave' ? .35 : .8; }
    else if (ob.name === 'body') { m.color.setHex(kind === 'lance' || kind === 'spear' ? 0xbff4ff : c1); if ('emissive' in m) { m.emissive.setHex(c1); m.emissiveIntensity = 1.4; } if (kind === 'wave') me.scale.set(o.size, 1, o.size); else if (kind === 'orb') me.scale.setScalar(o.size * 1.6); }
    else if (ob.name === 'core') { m.color.setHex(c0); if (kind === 'wave') me.scale.set(o.size * .95, 1, o.size * .95); else me.scale.setScalar(o.size * .8); }
  });
  g.position.copy(o.pos); g.rotation.set(0, Math.atan2(o.dir.x, o.dir.z), 0); g.visible = true; W.scene.add(g);
  const p: Proj = { mesh: g, pos: o.pos.clone(), vel: o.dir.clone().normalize().multiplyScalar(o.speed), r: kind === 'wave' ? o.size * .55 : kind === 'orb' ? o.size * 1.1 : o.size * .6, dmg: o.dmg, owner: o.owner, elem: o.elem, kind, life: o.life, src: o.src,
    deflectable: o.deflectable ?? o.owner === 'e', reflected: false, hit: new Set(), freeze: o.freeze ?? 0, pierce: !!o.pierce, t: 0, size: o.size, alive: true, mult: o.mult ?? 1 };
  W.projs.push(p); return p;
}
function freeProj(p: Proj) { p.alive = false; p.mesh.visible = false; W.scene.remove(p.mesh); (pool[p.kind] ??= []).push(p.mesh); }
export function reflectProj(p: Proj, perfect: boolean) {
  p.owner = 'p'; p.reflected = true; p.hit.clear(); p.mult = perfect ? 3 : 1.2; p.deflectable = false;
  const tgt = p.src && p.src.alive ? p.src.pos : nearestEnemy(W.P.pos, 40)?.pos;
  const dir = tgt ? V.set(tgt.x - p.pos.x, 0, tgt.z - p.pos.z).normalize() : V.copy(p.vel).negate().normalize();
  const sp = p.vel.length() * (perfect ? 1.7 : 1.15); p.vel.copy(dir).multiplyScalar(sp); p.pos.y = Math.max(p.pos.y, 1.2); p.life = 3; p.mesh.rotation.y = Math.atan2(dir.x, dir.z);
  p.pierce = perfect; vfx.fx('ring', { pos: p.pos, s0: .3, s1: 3, color: 0xffffff, dur: .3 });
  floatText(p.pos, 'REFLECT', 'perfect-s', 0);
}
export function destroyEnemyProjectile(p: Proj, byPlayer: boolean) {
  vfx.burst(p.elem, p.pos, 1.5); sfx.hit(.7, p.elem); freeProj(p); if (byPlayer) { addScore(30); gainUlt(2); }
}

export function updateProjs(dt: number) {
  const P = W.P;
  for (let i = W.projs.length - 1; i >= 0; i--) {
    const p = W.projs[i]; if (!p.alive) { W.projs.splice(i, 1); continue; }
    p.t += dt; p.life -= dt; p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos);
    if (p.kind === 'orb') p.mesh.rotation.y += dt * 4;
    const [c0, c1] = ELEM_COLORS[p.elem];
    if (Math.random() < 60 * dt * vfx.density / 4 + .3) vfx.P(true, p.pos.x + (Math.random() - .5) * .3, p.pos.y + (Math.random() - .5) * .3, p.pos.z + (Math.random() - .5) * .3, (Math.random() - .5), (Math.random() - .5) + (p.elem === 'fire' ? 1.5 : 0), (Math.random() - .5), .4, p.size * .5 + .15, .02, c0, c1, p.elem === 'ice' ? 1 : 0, .5);
    if (p.elem === 'lightning' && Math.random() < .12) { V.copy(p.pos); V2.copy(p.pos).add(new THREE.Vector3((Math.random() - .5) * 1.4, (Math.random() - .5) * 1.4, (Math.random() - .5) * 1.4)); vfx.bolt(V.clone(), V2.clone(), c1, .03, .1, .2); }
    if (p.life <= 0 || p.pos.y < -.2 || Math.hypot(p.pos.x, p.pos.z) > (W.arena?.radius ?? 30) + 10) { if (p.owner === 'e' || p.kind === 'orb') vfx.burst(p.elem, p.pos, 1.2); freeProj(p); continue; }
    if (p.owner === 'e') {
      const dx = P.pos.x - p.pos.x, dz = P.pos.z - p.pos.z, dy = P.pos.y + 1 - p.pos.y;
      if (Math.hypot(dx, dz) < p.r + .55 && Math.abs(dy) < 1.8 + p.r) {
        const res = resolveEnemyStrike(p.src, { dmg: p.dmg, unblock: !p.deflectable, heavy: p.kind === 'wave', pos: p.pos, elem: p.elem, proj: p });
        if (res === 'fail') { vfx.burst(p.elem, p.pos, 1.8); freeProj(p); }
        else if (res === 'dodged') { /* passes through */ }
      }
    } else {
      for (const e of W.enemies) {
        if (!e.alive || p.hit.has(e) || e.state === 'dying') continue;
        if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < p.r + e.def.radius && Math.abs(e.pos.y + 1 - p.pos.y) < 3) {
          p.hit.add(e); const dir = V2.copy(p.vel).setY(0).normalize().clone();
          hurtEnemy(e, p.dmg * p.mult, { dir, kb: 1.5, freeze: p.freeze, elem: p.elem, big: p.size > 2 || p.mult > 2, launch: p.kind === 'wave' && p.size > 3 ? 3 : 0, stagger: .6, src: 'proj' });
          if (!p.pierce) { vfx.burst(p.elem, p.pos, p.kind === 'spear' ? 3 : 2); if (p.kind === 'lance' || p.kind === 'spear') vfx.crystals(p.pos, 2.5); freeProj(p); break; }
        }
      }
    }
  }
}

// ------------------------------------------------------------------ zones + pickups
export function updateZones(dt: number) {
  for (let i = W.zones.length - 1; i >= 0; i--) {
    const z = W.zones[i]; z.life -= dt; const k = 1 - z.life / z.max;
    z.vis.rotation.y += dt * 6; z.vis.scale.setScalar(.6 + Math.min(1, k * 3) * .4);
    vfx.P(true, z.pos.x + (Math.random() - .5) * z.r * 2, z.pos.y + .5 + Math.random() * 2, z.pos.z + (Math.random() - .5) * z.r * 2, 0, 0, 0, .5, .3, .03, 0xe0b0ff, 0xa24bff, 0, 0);
    for (const e of W.enemies) {
      if (!e.alive || e.boss) continue; const dx = z.pos.x - e.pos.x, dz = z.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d < z.r * 2.2 && d > .3) { const s = 9 * dt * (1 - d / (z.r * 2.4)) * 3; e.kx += dx / d * s * 6; e.kz += dz / d * s * 6; if (e.state === 'move' || e.state === 'windup') { e.state = 'hurt'; e.hurtT = .15; e.atk = null; } }
    }
    if (z.life <= 0) {
      W.zones.splice(i, 1); W.scene.remove(z.vis);
      vfx.ult('void', z.pos, z.r * 1.8); sfx.elem('void', true); W.shake = Math.max(W.shake, .7); W.hitStop = Math.max(W.hitStop, .1);
      for (const e of W.enemies) if (e.alive && Math.hypot(e.pos.x - z.pos.x, e.pos.z - z.pos.z) < z.r * 2.4 + e.def.radius) hurtEnemy(e, z.dmg, { dir: V.set(e.pos.x - z.pos.x, 0, e.pos.z - z.pos.z).normalize().clone(), launch: 8, stagger: 2, elem: 'void', big: true, kb: 3 });
    }
  }
  for (let i = W.pickups.length - 1; i >= 0; i--) {
    const p = W.pickups[i]; p.t += dt; p.mesh.position.y = 1 + Math.sin(p.t * 4) * .15; p.mesh.rotation.y += dt * 3;
    const d = Math.hypot(W.P.pos.x - p.pos.x, W.P.pos.z - p.pos.z);
    if (d < 4 && p.t > .4) { p.pos.x += (W.P.pos.x - p.pos.x) * Math.min(1, dt * 7); p.pos.z += (W.P.pos.z - p.pos.z) * Math.min(1, dt * 7); p.mesh.position.x = p.pos.x; p.mesh.position.z = p.pos.z; }
    if (d < 1.1 && p.t > .4 || p.t > 20) {
      if (d < 1.4) { if (p.kind === 'hp') { W.P.hp = Math.min(W.P.maxHp, W.P.hp + 16); floatText(W.P.pos, '+HP', 'heal', 2.4); } else { gainUlt(18); floatText(W.P.pos, '+ULT', 'ultg', 2.4); } sfx.pickup(); vfx.burst('plasma', p.mesh.position.clone(), 1.2); }
      W.scene.remove(p.mesh); W.pickups.splice(i, 1);
    }
  }
}
export const hazardAt = (x: number, z: number, r: number, dmg: number, elem: Elem) => {
  const P = W.P; if (Math.hypot(P.pos.x - x, P.pos.z - z) < r + .4 && P.pos.y < 2) {
    if (P.invuln > 0) { /* dodged */ } else damagePlayer(dmg, V.set(x, 0, z), { heavy: true, unblock: true, elem });
  }
  for (const e of W.enemies) if (e.alive && Math.hypot(e.pos.x - x, e.pos.z - z) < r + e.def.radius) hurtEnemy(e, dmg * 1.4, { dir: V.set(e.pos.x - x, 0, e.pos.z - z).normalize().clone(), launch: 5, elem, src: 'hazard', fx: false, guardable: false });
  for (const d of W.arena?.destructibles ?? []) if (d.alive && Math.hypot(d.x - x, d.z - z) < r + d.r) damageDestructible(d, 60);
};
export function damageDestructible(d: { x: number; z: number; r: number; hp: number; mesh: THREE.Object3D; alive: boolean }, dmg: number) {
  if (!d.alive) return; d.hp -= dmg; vfx.chunks(d.x, 1.5, d.z, 4, 4, 0x6a7a9a, .2);
  if (d.hp <= 0) {
    d.alive = false; d.mesh.visible = false; V.set(d.x, 1, d.z); vfx.slam('lightning', V.clone(), 3, false); vfx.chunks(d.x, 2, d.z, 18, 8, 0x6a7a9a, .3); sfx.elem('slam'); W.shake = Math.max(W.shake, .3);
    dropPickup(Math.random() < .5 ? 'hp' : 'ult', V.clone()); addScore(60);
  }
}
export { clamp, settings };
