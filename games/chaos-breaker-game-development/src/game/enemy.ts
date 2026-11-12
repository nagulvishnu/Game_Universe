import * as THREE from 'three';
import { EAtk, Elem } from './types';
import { BOSSES, ENEMIES, ELEM_COLORS } from './data/world';
import { Rig, enemyWeapon } from './rig';
import { vfx } from './vfx';
import { sfx } from './audio';
import { bridge, useGame } from './store';
import { Enemy, W, angDiff, clamp, floatText, rand } from './world';
import { resolveEnemyStrike, spawnProj } from './combat';

const V = new THREE.Vector3(), V2 = new THREE.Vector3();
const REST = [.35, 1.1, .4, .9, .2, .4, 0, 0], GUARD = [.15, 1.3, .6, .35, 0, 0, -.05, 0];
type P8 = number[];
const POSES: Record<string, { raise: P8; strike: P8 }> = {
  overhead: { raise: [.25, 2.0, -.1, -.5, 0, .1, -.2, .2], strike: [.1, 1.1, .9, 2.3, 0, 0, .38, 0] },
  horizontal: { raise: [.75, 1.3, .0, 1.5, 1.6, 0, -.05, .7], strike: [-.5, 1.2, .8, 1.5, -1.6, 0, .12, -.7] },
  sweep: { raise: [.8, 1.2, -.1, 1.5, 1.9, 0, -.1, .9], strike: [-.7, 1.2, .8, 1.5, -1.9, 0, .15, -.9] },
  thrust: { raise: [.3, 1.2, -.35, 1.52, .25, 0, -.12, .35], strike: [.3, 1.2, 1.25, 1.52, 0, 0, .22, -.2] },
  spin: { raise: [.4, 1.25, .5, 1.5, .4, 0, 0, .6], strike: [.4, 1.25, .5, 1.5, .4, 0, 0, -2.5] },
  slam: { raise: [.1, 2.4, 0, -.3, 0, 0, -.35, 0], strike: [.1, .8, .9, 2.8, 0, 0, .55, 0] },
  cast: { raise: [.3, 1.9, .3, .5, 0, 0, -.12, 0], strike: [.3, 1.5, 1.0, 1.4, 0, 0, .12, 0] },
  flurry: { raise: [.75, 1.3, .0, 1.5, 1.4, 0, -.05, .6], strike: [-.4, 1.2, .8, 1.5, -1.4, 0, .12, -.6] },
  rush: { raise: [.3, 1.2, -.3, 1.5, .3, 0, -.2, .4], strike: [.3, 1.1, 1.0, 1.52, 0, 0, .6, -.2] },
  raise: { raise: [.3, 2.2, .2, .2, 0, 0, -.25, 0], strike: [.3, 1.8, .6, .8, 0, 0, .05, 0] },
  dive: { raise: [.3, 2.2, 0, 0, 0, 0, -.2, 0], strike: [.3, .9, .9, 2.9, 0, 0, .6, 0] },
};
const mirror = (p: P8): P8 => [p[0], p[1], p[2], p[3], -p[4], -p[5], p[6], -p[7]];
const lerpP = (a: P8, b: P8, k: number, out: P8) => { for (let i = 0; i < 8; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; };
const pA: P8 = [0, 0, 0, 0, 0, 0, 0, 0], pB: P8 = [0, 0, 0, 0, 0, 0, 0, 0];

export function spawnEnemy(id: string, pos: THREE.Vector3, mult = { hp: 1, dmg: 1, speed: 1 }): Enemy {
  const def = ENEMIES[id] ?? BOSSES[id as 'iron'];
  const rig = new Rig({ kind: def.rig.kind, main: def.rig.main, accent: def.rig.accent, skin: def.rig.skin, bulk: def.rig.bulk, scale: def.scale, hover: def.hover });
  const w = enemyWeapon(def.weapon, def.rig.accent); if (w) { rig.hasLeftPiv = false; rig.setWeapon(w); }
  rig.root.position.copy(pos); rig.root.scale.setScalar(.01); W.scene.add(rig.root);
  const boss = !!def.boss, hp = def.hp * mult.hp * (boss && useGame.getState().settings.difficulty === 'hard' ? 1.2 : 1);
  const e: Enemy = {
    id: W.nextId++, def, rig, pos: pos.clone(), yaw: 0, vy: 0, kx: 0, kz: 0, hp, maxHp: hp, posture: 0, maxPosture: def.posture, armor: def.armor, maxArmor: def.armor, state: 'spawn', st: 0, atk: null, hitN: 0, strikeDone: false,
    cd: rand(.6, 1.6), strafe: Math.random() < .5 ? 1 : -1, strafeT: rand(1, 2.5), last: '', lastLast: '', alive: true, boss, phase: 0, frozenT: 0, staggerT: 0, hurtT: 0, downT: 0, flash: 0, guarding: false, guardT: rand(.5, 2),
    mult, tgt: new THREE.Vector3(), rain: [], tpDone: false, rushDir: new THREE.Vector3(), rushed: 0, hitOnce: false, beamA: 0, beamHit: 0, feinted: false, deathT: 0, regenT: 0, cue: false, pullDone: false, lastDmgT: -9, spawnT: 0, aggro: 1, animSeed: Math.random() * 6, vulnerable: false, rushHit: false,
  };
  e.yaw = Math.atan2(W.P.pos.x - pos.x, W.P.pos.z - pos.z); W.enemies.push(e);
  const c = ELEM_COLORS[def.elem]; vfx.rift(V.set(pos.x, 0, pos.z).clone(), c[1], boss ? 4 : 1.6, .7); vfx.fx('ring', { pos: [pos.x, .1, pos.z], s0: .3, s1: boss ? 9 : 3.5, color: c[1], dur: .6 });
  if (boss) { sfx.boss('roar'); W.shake = Math.max(W.shake, .5); }
  return e;
}
export function clearEnemies() { for (const e of W.enemies) W.scene.remove(e.rig.root); W.enemies.length = 0; for (const p of W.projs) { p.alive = false; p.mesh.visible = false; W.scene.remove(p.mesh); } W.projs.length = 0; for (const z of W.zones) W.scene.remove(z.vis); W.zones.length = 0; for (const p of W.pickups) W.scene.remove(p.mesh); W.pickups.length = 0; }

// ------------------------------------------------------------------ AI
const attackers = (self: Enemy, ranged: boolean) => W.enemies.filter(x => x !== self && x.alive && !x.boss && (x.state === 'windup' || x.state === 'strike' || x.state === 'recover') && (x.def.id === 'mage') === ranged).length;
function pick(e: Enemy, dist: number): EAtk | null {
  const c = e.def.atks.filter(a => (a.phase ?? 0) <= e.phase && dist >= a.min && dist <= a.max);
  if (!c.length) return null;
  const w = c.map(a => a.w * (a.id === e.last ? .2 : a.id === e.lastLast ? .55 : 1) * (.7 + Math.random() * .6));
  let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < c.length; i++) { r -= w[i]; if (r <= 0) return c[i]; } return c[0];
}
function begin(e: Enemy, a: EAtk) {
  const P = W.P, beh = W.run?.mode === 'training' ? useGame.getState().save.training.behavior : 'normal';
  const slow = beh === 'slow' ? 1.5 : 1;
  e.state = 'windup'; e.st = 0; e.atk = { ...a, wind: a.wind * slow * (e.boss ? 1 : 1) }; e.hitN = 0; e.strikeDone = false; e.guarding = false; e.feinted = false; e.tpDone = false; e.cue = false; e.hitOnce = false; e.rushHit = false; e.last !== a.id && (e.lastLast = e.last); e.last = a.id;
  const A = e.atk, c = ELEM_COLORS[e.def.elem];
  if (a.unblock) { sfx.telegraph(true); floatText(e.pos, '⚠ UNBLOCKABLE', 'warn', e.def.scale * 2.3); if (e.boss) bridge.popup('UNBLOCKABLE', 'warn', 'DODGE!'); } else sfx.telegraph(false);
  if (e.boss || a.heavy) sfx.boss('swing');
  const k = a.kind ?? 'melee';
  if (k === 'aoe' || k === 'nova') {
    const at = a.aoe!.at, r = a.aoe!.r; if (at === 'target') e.tgt.set(P.pos.x, 0, P.pos.z); else if (at === 'ahead') e.tgt.set(e.pos.x + Math.sin(e.yaw) * 4, 0, e.pos.z + Math.cos(e.yaw) * 4); else e.tgt.set(e.pos.x, 0, e.pos.z);
    vfx.telegraph(e.tgt, r, A.wind + (a.aoe!.delay ?? 0), 0xff2a2a);
  } else if (k === 'rain') {
    e.rain = []; const n = a.aoe!.n ?? 5, R = (W.arena?.radius ?? 20) - 2;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * 6.28, d = i === 0 ? 0 : 2 + Math.random() * 7; let x = P.pos.x + Math.cos(ang) * d, z = P.pos.z + Math.sin(ang) * d; const dd = Math.hypot(x, z); if (dd > R) { x *= R / dd; z *= R / dd; }
      const t = A.wind + (a.aoe!.delay ?? 1) + i * .2; e.rain.push({ x, z, t, done: false }); vfx.telegraph([x, 0, z], a.aoe!.r, t, e.def.elem === 'lightning' ? 0x66b8ff : 0xff4a6a);
    }
  } else if (k === 'rush') { vfx.fx('beam', { pos: [e.pos.x, .1, e.pos.z], s0: [.5, 1, .5], s1: [.5, 1, .5], color: 0xff2a2a, dur: .01 }); }
  else if (k === 'pull') { vfx.fx('ring', { pos: [e.pos.x, .2, e.pos.z], s0: 14, s1: 1, color: c[1], dur: A.wind, op: .8, ease: 'in' }); sfx.elem('void'); }
  else if (k === 'beam') { vfx.fx('ring', { pos: [e.pos.x, 1, e.pos.z], s0: 6, s1: .5, color: c[1], dur: A.wind, ease: 'in', rot: [Math.PI / 2, 0, 0] }); }
  else if (k === 'teleport') { vfx.rift(V.set(e.pos.x, 0, e.pos.z).clone(), c[1], 1.6, .4); sfx.dodge(); }
  else if (k === 'proj') { vfx.fx('flare', { pos: [e.pos.x, e.def.scale * 1.5, e.pos.z], s0: .3, s1: 2.2, color: c[1], dur: A.wind * .9, ease: 'in' }); }
}

function endAttack(e: Enemy) { e.state = 'recover'; e.st = 0; e.vulnerable = true; e.cue = false; }

function strikeMelee(e: Enemy, a: EAtk, i: number) {
  const P = W.P, c = ELEM_COLORS[e.def.elem], sc = e.def.scale;
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
  e.cue = false; if (a.lunge) { e.kx += Math.sin(e.yaw) * a.lunge * 7; e.kz += Math.cos(e.yaw) * a.lunge * 7; }
  const yv = e.pos.y + sc * 1.1, vertical = a.pose === 'overhead' || a.pose === 'slam';
  vfx.slashArc(e.def.elem, V.set(e.pos.x + Math.sin(e.yaw) * .4 * sc, yv, e.pos.z + Math.cos(e.yaw) * .4 * sc), e.yaw, Math.min(a.reach * .85, 6), vertical ? Math.PI / 2 : (i % 2 ? .35 : -.35), .22);
  if (a.heavy || e.boss) sfx.boss('swing'); else sfx.swing('titan' as 'titan', false);
  const reach = a.reach + (a.lunge ? a.lunge * .55 : 0) + .45, arcOk = Math.abs(angDiff(e.yaw, Math.atan2(dx, dz))) <= (a.arc ?? 2) / 2 + .3;
  if (dist - e.def.radius <= reach && arcOk && P.pos.y < 2.4) {
    V.set(e.pos.x + dx * .5, 0, e.pos.z + dz * .5);
    resolveEnemyStrike(e, { dmg: a.dmg * e.mult.dmg, unblock: !!a.unblock, heavy: !!a.heavy, pos: V.clone(), elem: e.def.elem, posture: a.posture });
  }
  void c;
}
function explodeAt(e: Enemy, a: EAtk, x: number, z: number, r: number, selfType: boolean) {
  const P = W.P; V.set(x, 0, z); const el = e.def.elem;
  if (a.kind === 'nova' || r > 7) vfx.ult(el, V.clone(), r); else vfx.slam(el, V.clone(), r, !!e.boss);
  sfx.elem(el === 'phys' || el === 'earth' ? 'slam' : (el as 'fire'), r > 5); W.shake = Math.max(W.shake, clamp(r * .06, .2, .6));
  if (el === 'lightning' && !selfType) vfx.lightning(V.clone(), 'lightning', r);
  if (Math.hypot(P.pos.x - x, P.pos.z - z) < r + .4 && (selfType ? P.pos.y < 1.1 : P.pos.y < 3)) resolveEnemyStrike(e, { dmg: a.dmg * e.mult.dmg, unblock: true, heavy: true, pos: V.clone(), elem: el });
}

function updateAttack(e: Enemy, dt: number) {
  const P = W.P, a = e.atk!, kind = a.kind ?? 'melee', dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
  e.st += dt; const toP = Math.atan2(dx, dz);
  if (e.state === 'windup') {
    if (kind === 'rain') for (const r of e.rain) r.t -= dt;
    const lockT = a.wind * .78;
    if (kind !== 'rush' || e.st < a.wind * .6) if (e.st < lockT || kind === 'proj' || kind === 'teleport') e.yaw += angDiff(e.yaw, toP) * Math.min(1, dt * (e.boss ? 5 : 7.5));
    // cue flash (deflect hint)
    if (!e.cue && !a.unblock && e.st >= a.wind - .19 && (kind === 'melee' || kind === 'rush')) { e.cue = true; vfx.fx('flare', { pos: [e.pos.x + Math.sin(e.yaw) * e.def.scale, e.pos.y + e.def.scale * 1.4, e.pos.z + Math.cos(e.yaw) * e.def.scale], s0: .2, s1: 1.8 + e.def.scale * .4, color: 0xfff0c0, dur: .26 }); e.rig.flash(0xffffff, .55); sfx.telegraph(false); }
    if (kind === 'melee' && a.feint && !e.feinted && e.st >= a.wind * .55 && e.st < a.wind * .6 && Math.random() < .5 && dist < 7) {
      e.feinted = true; e.state = 'move'; e.atk = null; e.cd = .3; e.last = ''; e.rig.flash(0xffffff, 1); vfx.fx('ring', { pos: [e.pos.x, 1.2, e.pos.z], s0: .3, s1: 2, color: 0xffffff, dur: .25 }); floatText(e.pos, 'FEINT', 'warn', e.def.scale * 2.2); sfx.dodge(); return;
    }
    if (kind === 'teleport') {
      if (!e.tpDone && e.st >= a.wind * .4) {
        e.tpDone = true; const R = (W.arena?.radius ?? 20) - 2, ang = P.yaw + Math.PI + rand(-.5, .5); let x = P.pos.x + Math.sin(ang) * 3.2, z = P.pos.z + Math.cos(ang) * 3.2; const d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; }
        vfx.rift(V.set(e.pos.x, 0, e.pos.z).clone(), ELEM_COLORS[e.def.elem][1], 2, .4); e.pos.set(x, 0, z); e.yaw = Math.atan2(P.pos.x - x, P.pos.z - z); e.rig.root.visible = true; vfx.lightning(V.set(x, 0, z).clone(), 'lightning', 1.6); vfx.rift(V.set(x, 0, z).clone(), ELEM_COLORS[e.def.elem][1], 2, .5); sfx.elem('lightning');
      }
      e.rig.root.visible = e.tpDone || e.st < a.wind * .1;
    }
    if (e.st >= a.wind) {
      e.state = 'strike'; e.st = 0; e.hitN = 0; e.cue = false; e.rig.root.visible = true;
      if (kind === 'melee' || kind === 'teleport') { e.hitN = 1; strikeMelee(e, a, 0); e.st = 0; }
      else if (kind === 'proj') {
        const sc = e.def.scale, n = a.proj!.n, base = Math.atan2(dx, dz);
        for (let i = 0; i < n; i++) { const ang = base + (n === 1 ? 0 : (i / (n - 1) - .5) * a.proj!.spread * 2); const pos = V2.set(e.pos.x + Math.sin(ang) * sc * .9, e.pos.y + sc * (a.proj!.kind === 'wave' ? .6 : 1.3) + (e.def.hover ?? 0), e.pos.z + Math.cos(ang) * sc * .9); const dir = V.set(Math.sin(ang) * 1, (a.proj!.kind === 'wave' ? 0 : (P.pos.y + 1.1 - pos.y) / Math.max(4, dist)), Math.cos(ang));
          spawnProj({ owner: 'e', kind: a.proj!.kind, elem: a.proj!.elem, pos: pos.clone(), dir: dir.clone(), speed: a.proj!.speed, life: 4.5, size: a.proj!.size, dmg: a.dmg * e.mult.dmg, src: e, deflectable: !a.unblock }); }
        sfx.elem(a.proj!.elem === 'phys' ? 'slam' : (a.proj!.elem as 'fire'), false); e.hitN = 1;
      } else if (kind === 'rush') { e.rushDir.set(dx, 0, dz).normalize(); e.rushed = 0; e.rushHit = false; sfx.dodge(); }
      else if (kind === 'pull') { P.pullT = 1.0; P.pullTo = e.pos.clone(); vfx.fx('ring', { pos: [e.pos.x, 1, e.pos.z], s0: 14, s1: 2, color: 0xa24bff, dur: .9, ease: 'in' }); }
      else if (kind === 'beam') { e.beamA = toP - .95; e.beamHit = 0; sfx.boss('roar'); }
    }
    return;
  }
  if (e.state === 'strike') {
    if (kind === 'melee' || kind === 'teleport') {
      const hits = a.hits ?? 1, gap = a.gap ?? .4;
      if (e.hitN < hits) {
        e.yaw += angDiff(e.yaw, toP) * Math.min(1, dt * 8);
        if (!e.cue && e.st >= gap - .22 && !a.unblock) { e.cue = true; vfx.fx('flare', { pos: [e.pos.x + Math.sin(e.yaw) * e.def.scale, e.pos.y + e.def.scale * 1.4, e.pos.z + Math.cos(e.yaw) * e.def.scale], s0: .2, s1: 1.5 + e.def.scale * .3, color: 0xfff0c0, dur: .22 }); }
        if (e.st >= gap) { e.st -= gap; strikeMelee(e, a, e.hitN); e.hitN++; e.cue = false; }
      } else if (e.st >= .22) endAttack(e);
    } else if (kind === 'proj') { if (e.st >= .2) endAttack(e); }
    else if (kind === 'aoe' || kind === 'nova') {
      const delay = a.aoe!.delay ?? 0;
      if (!e.hitOnce && e.st >= delay) { e.hitOnce = true; explodeAt(e, a, e.tgt.x, e.tgt.z, a.aoe!.r, a.aoe!.at === 'self'); e.st = 0; } else if (e.hitOnce && e.st >= .25) endAttack(e);
    } else if (kind === 'rain') {
      let all = true;
      for (const r of e.rain) { r.t -= dt; if (!r.done && r.t + 0 <= a.wind - 0 - e.st + e.st - a.wind + 0.0001 && r.t <= 0) { r.done = true; V.set(r.x, 0, r.z); const el = e.def.elem; if (el === 'lightning') vfx.lightning(V.clone(), 'lightning', a.aoe!.r); else if (el === 'void') { vfx.rift(V.clone(), 0xa24bff, 2, .6); vfx.pillar('void', V.clone(), a.aoe!.r); vfx.burst('void', V.clone(), a.aoe!.r); } else vfx.pillar(el, V.clone(), a.aoe!.r); sfx.elem(el === 'phys' ? 'slam' : (el === 'earth' ? 'slam' : el as 'fire')); W.shake = Math.max(W.shake, .22); if (Math.hypot(P.pos.x - r.x, P.pos.z - r.z) < a.aoe!.r + .4 && P.pos.y < 4) resolveEnemyStrike(e, { dmg: a.dmg * e.mult.dmg, unblock: true, heavy: true, pos: V.clone(), elem: el }); } if (!r.done) all = false; }
      if (all) endAttack(e);
    } else if (kind === 'rush') {
      const sp = 24, step = sp * dt; e.pos.x += e.rushDir.x * step; e.pos.z += e.rushDir.z * step; e.rushed += step; e.yaw = Math.atan2(e.rushDir.x, e.rushDir.z);
      const [c0, c1] = ELEM_COLORS[e.def.elem]; vfx.P(true, e.pos.x, .8 * e.def.scale, e.pos.z, 0, 1, 0, .4, e.def.scale, .1, c0, c1, 0, 1, .5); if (Math.random() < .5) vfx.spark(e.pos.x, .5, e.pos.z, -e.rushDir.x, .4, -e.rushDir.z, 3, 6, .4, c1, .3);
      const dd = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
      if (!e.rushHit && dd < a.reach + e.def.radius * .6 + .4) { e.rushHit = true; const r = resolveEnemyStrike(e, { dmg: a.dmg * e.mult.dmg, unblock: !!a.unblock, heavy: true, pos: V.set(e.pos.x, 0, e.pos.z).clone(), elem: e.def.elem }); if (r === 'perfect' || r === 'normal') return; e.kx += e.rushDir.x * 10; e.kz += e.rushDir.z * 10; }
      if (e.rushed > 16 || e.st > 1.0 || (e.rushHit && e.st > .15) || Math.hypot(e.pos.x, e.pos.z) > (W.arena?.radius ?? 25) - 1) endAttack(e);
    } else if (kind === 'pull') {
      if (e.st >= 1.0) { if (dist < 4.5) resolveEnemyStrike(e, { dmg: a.dmg * e.mult.dmg, unblock: true, heavy: true, pos: e.pos.clone(), elem: e.def.elem }); vfx.burst('void', V.set(e.pos.x, 0, e.pos.z).clone(), 5, true); W.shake = Math.max(W.shake, .5); endAttack(e); }
    } else if (kind === 'beam') {
      const dur = 2.0, ang = e.beamA + e.st / dur * 1.9; e.yaw = ang; e.beamHit -= dt; const [c0, c1] = ELEM_COLORS[e.def.elem], sc = e.def.scale, oy = e.pos.y + sc * 1.2 + (e.def.hover ?? 0);
      vfx.fx('beam', { pos: [e.pos.x, oy, e.pos.z], s0: [1.3, 30, 1.3], s1: [1.1, 30, 1.1], color: c1, dur: .09, rot: [Math.PI / 2, ang, 0], op: .85 }); vfx.fx('beam', { pos: [e.pos.x, oy, e.pos.z], s0: [.55, 30, .55], s1: [.5, 30, .5], color: 0xffffff, dur: .09, rot: [Math.PI / 2, ang, 0], op: .95 });
      for (let i = 0; i < 2; i++) { const d = 3 + Math.random() * 24; vfx.P(true, e.pos.x + Math.sin(ang) * d, .3, e.pos.z + Math.cos(ang) * d, 0, 4, 0, .4, 1, .1, c0, c1); }
      W.shake = Math.max(W.shake, .18);
      const fxd = Math.sin(ang), fzd = Math.cos(ang), f = dx * fxd + dz * fzd, l = dx * fzd - dz * fxd;
      if (e.beamHit <= 0 && f > 0 && f < 32 && Math.abs(l) < 1.1 && P.pos.y < 2.2) { e.beamHit = .9; V.set(P.pos.x, 0, P.pos.z); resolveEnemyStrike(e, { dmg: a.dmg * e.mult.dmg, unblock: true, heavy: true, pos: V.clone(), elem: e.def.elem }); }
      if (e.st >= dur) endAttack(e);
    }
    return;
  }
  if (e.state === 'recover') { if (e.st >= a.rec * (e.boss ? .9 : 1)) { e.state = 'move'; e.st = 0; e.vulnerable = false; e.atk = null; e.cd = rand(.45, 1.5) * e.aggro * (e.boss ? .75 : 1); } }
}

export function updateEnemies(dt: number, rawDt: number) {
  const P = W.P, t = W.time, beh = W.run?.mode === 'training' ? useGame.getState().save.training.behavior : 'normal';
  const R = (W.arena?.radius ?? 20) - 1;
  for (let i = W.enemies.length - 1; i >= 0; i--) {
    const e = W.enemies[i], sc = e.def.scale, rig = e.rig;
    e.flash = Math.max(0, e.flash - dt); e.regenT += dt;
    if (!e.alive && e.state === 'dead') { e.deathT += dt; const k = clamp(e.deathT * 2.2, 0, 1); rig.root.rotation.x = -1.45 * k; rig.root.position.set(e.pos.x, e.pos.y - clamp((e.deathT - 1) * .8, 0, 2), e.pos.z); rig.flash(0xffffff, Math.max(0, .8 - e.deathT * 2)); if (e.deathT > 2.4) { W.scene.remove(rig.root); W.enemies.splice(i, 1); continue; } rig.pose(REST, null, dt, 10, t); continue; }
    if (e.state === 'dying') {
      e.deathT += dt; rig.root.position.set(e.pos.x + (Math.random() - .5) * .08 * Math.min(1, e.deathT), e.pos.y + (e.def.hover ?? 0) + Math.max(0, e.deathT - 1.7) * -1.2, e.pos.z); rig.flash(0xffffff, .3 + Math.sin(e.deathT * 30) * .3);
      if (Math.random() < .5) { const c = ELEM_COLORS[e.def.elem]; vfx.P(true, e.pos.x + (Math.random() - .5) * 3, Math.random() * sc * 2, e.pos.z + (Math.random() - .5) * 3, 0, 4, 0, .8, 1, .1, c[0], c[1]); }
      const s = Math.max(.01, e.deathT > 2.2 ? 1 - (e.deathT - 2.2) / .6 : 1); rig.root.scale.setScalar(sc * s); rig.pose(REST, null, dt, 10, t);
      if (e.deathT > 2.9) { W.scene.remove(rig.root); W.enemies.splice(i, 1); } continue;
    }
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dist = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    // armor regen
    if (e.maxArmor > 0 && e.armor < e.def.armor && W.time - e.lastDmgT > 3) e.armor = Math.min(e.def.armor, e.armor + 12 * dt);
    if (e.state === 'spawn') { e.spawnT += dt; const k = clamp(e.spawnT / (e.boss ? 1.1 : .55), 0, 1); rig.root.scale.setScalar(sc * (1 - Math.pow(1 - k, 3))); if (k >= 1) { e.state = 'move'; rig.root.scale.setScalar(sc); } }
    // boss phase transitions
    if (e.boss && e.def.phases && e.state !== 'phase' && e.alive) {
      const nx = e.def.phases[e.phase + 1]; if (nx !== undefined && e.hp / e.maxHp < nx) {
        e.phase++; e.state = 'phase'; e.st = 0; e.atk = null; e.cue = false; e.rig.root.visible = true; e.posture = 0; e.armor = e.def.armor; e.staggerT = 0;
        sfx.boss('phase'); bridge.banner(`PHASE ${['I', 'II', 'III', 'IV'][e.phase] ?? e.phase + 1}`, e.def.name); W.shake = Math.max(W.shake, .7); bridge.flash('#ffffff', .4, 400);
        for (const p of W.projs) if (p.owner === 'e') { p.alive = false; p.mesh.visible = false; }
        vfx.ult(e.def.elem, V.set(e.pos.x, 0, e.pos.z).clone(), 10); P.invuln = Math.max(P.invuln, .4);
        const dd = dist; if (dd < 12) { P.vx = -Math.sin(toP) * 14; P.vz = -Math.cos(toP) * 14; }
      }
    }
    // physics: vertical
    if (e.pos.y > 0 || e.vy !== 0) { e.vy -= 22 * (e.state === 'air' ? .6 : 1) * dt; e.pos.y += e.vy * dt; if (e.pos.y <= 0) { e.pos.y = 0; if (e.state === 'air') { e.vy = 0; e.state = 'down'; e.downT = .85; e.st = 0; vfx.fx('ring', { pos: [e.pos.x, .1, e.pos.z], s0: .3, s1: 2.5, color: 0xffffff, dur: .3, op: .4 }); sfx.step(); } else e.vy = 0; } }
    // knockback
    e.pos.x += e.kx * dt; e.pos.z += e.kz * dt; const kd = Math.exp(-7 * dt); e.kx *= kd; e.kz *= kd;
    if (e.frozenT > 0) { e.frozenT -= dt; rig.flash(0x66d8ff, .8 + Math.sin(t * 20) * .1); if (Math.random() < .2) vfx.P(true, e.pos.x + (Math.random() - .5), Math.random() * 2 * sc, e.pos.z + (Math.random() - .5), 0, .3, 0, .6, .15, .02, 0xffffff, 0x7fe8ff); if (e.frozenT <= 0) { vfx.chunks(e.pos.x, 1, e.pos.z, 8, 4, 0xbff4ff, .12); sfx.elem('ice'); rig.flash(0, 0); } e.vulnerable = true; }
    else switch (e.state) {
      case 'hurt': e.hurtT -= dt; if (e.hurtT <= 0) { e.state = 'move'; e.cd = Math.max(e.cd, .25); } break;
      case 'stagger': e.staggerT -= dt; e.guarding = false; if (e.staggerT <= 0) { e.state = 'move'; e.cd = rand(.5, 1); } else if (e.boss && Math.random() < .15) vfx.P(true, e.pos.x + (Math.random() - .5) * sc, sc * 2.1, e.pos.z + (Math.random() - .5) * sc, 0, 1, 0, .6, .25, .02, 0xffee88, 0xffaa22); break;
      case 'down': e.downT -= dt; if (e.downT <= 0) { e.state = 'move'; e.cd = rand(.4, 1); } break;
      case 'air': if (e.pos.y <= 0 && e.vy === 0) e.state = 'down'; break;
      case 'phase': e.st += dt; e.yaw += .8 * dt; if (Math.random() < .5) { const c = ELEM_COLORS[e.def.elem]; vfx.P(true, e.pos.x + (Math.random() - .5) * sc * 2, Math.random() * sc * 2, e.pos.z + (Math.random() - .5) * sc * 2, 0, 3, 0, .8, .7, .05, c[0], c[1]); } if (e.st > 2.2) { e.state = 'move'; e.st = 0; e.cd = .8; e.aggro *= .88; e.mult = { ...e.mult, speed: e.mult.speed * 1.08 }; } break;
      case 'windup': case 'strike': case 'recover': if (e.atk) updateAttack(e, dt); else e.state = 'move'; break;
      case 'move': case 'guard': {
        e.vulnerable = false;
        const spd = e.def.speed * e.mult.speed; let mvx = 0, mvz = 0, sp = 0;
        const passive = beh === 'passive';
        e.yaw += angDiff(e.yaw, toP) * Math.min(1, dt * (e.boss ? 3.5 : 6));
        e.cd -= dt; e.strafeT -= dt; if (e.strafeT <= 0) { e.strafeT = rand(1, 2.8); if (Math.random() < .45) e.strafe *= -1; }
        // guard behaviour
        if (e.def.guard && !passive) { e.guardT -= dt; if (e.guardT <= 0) { e.guarding = !e.guarding && dist < 8 && Math.random() < .6; e.guardT = e.guarding ? rand(1, 2) : rand(1.2, 3); } if (P.state === 'attack' && dist < 5 && !e.guarding && Math.random() < .02) { e.guarding = true; e.guardT = 1.4; } }
        else e.guarding = false;
        if (e.guarding && e.def.id === 'executioner' && e.flash > .04 && Math.random() < .5 && dist < 5) { e.guarding = false; const q = e.def.atks.find(a => a.id === 'quick'); if (q) { begin(e, q); break; } }
        if (!passive) {
          const range = e.def.pref;
          if (dist > range + .8) { sp = spd; mvx = Math.sin(toP); mvz = Math.cos(toP); }
          else if (dist < range - 1.2 && (e.def.id === 'mage' || e.def.id === 'hunter' || e.boss || dist < 1.4)) { sp = spd * .75; mvx = -Math.sin(toP); mvz = -Math.cos(toP); }
          else { sp = spd * (e.guarding ? .35 : .5); mvx = Math.cos(toP) * e.strafe; mvz = -Math.sin(toP) * e.strafe; }
          // choose attack
          const ranged = e.def.id === 'mage';
          const ok = e.boss || (ranged ? attackers(e, true) < 1 : attackers(e, false) < (W.run?.mode === 'elite' ? 2 : (useGame.getState().settings.difficulty === 'hard' ? 3 : 2)));
          if (e.cd <= 0 && ok && e.state === 'move') {
            const a = pick(e, dist); const cdMul = beh === 'slow' ? 2.2 : beh === 'aggressive' ? .5 : 1;
            if (a) { begin(e, a); e.aggro *= 1; e.cd = 0; void cdMul; break; } else if (dist > range + 1) { e.cd = .1; }
          } else if (e.cd <= 0 && !ok) e.cd = .15;
        } else { sp = 0; }
        e.pos.x += mvx * sp * dt; e.pos.z += mvz * sp * dt; (e as unknown as { spd: number }).spd = sp;
      }
    }
    // arena/obstacles + separation
    const dd = Math.hypot(e.pos.x, e.pos.z); if (dd > R - e.def.radius) { e.pos.x *= (R - e.def.radius) / dd; e.pos.z *= (R - e.def.radius) / dd; }
    if (W.arena) for (const o of W.arena.obstacles) { const ox = e.pos.x - o.x, oz = e.pos.z - o.z, od = Math.hypot(ox, oz), m = o.r + e.def.radius; if (od < m) { e.pos.x = o.x + ox / (od || 1) * m; e.pos.z = o.z + oz / (od || 1) * m; } }
    for (const o of W.enemies) { if (o === e || !o.alive) continue; const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = Math.hypot(ox, oz), m = e.def.radius + o.def.radius; if (od < m && od > .001) { const pu = (m - od) * .5 * Math.min(1, dt * 10); e.pos.x += ox / od * pu; e.pos.z += oz / od * pu; } }
    if (e.state !== 'strike' || !(e.atk?.kind === 'rush')) { const pdx = e.pos.x - P.pos.x, pdz = e.pos.z - P.pos.z, pd = Math.hypot(pdx, pdz), m = e.def.radius + .4; if (pd < m && pd > .001 && P.pos.y < 1.2) { e.pos.x += pdx / pd * (m - pd) * .5; e.pos.z += pdz / pd * (m - pd) * .5; } }
    // posture decay
    if (e.state !== 'stagger' && W.time - e.lastDmgT > 2) e.posture = Math.max(0, e.posture - 6 * dt);
    drawEnemy(e, dt, rawDt);
  }
}

function enemyPose(e: Enemy, out: P8): P8 {
  const a = e.atk; const pose = (a && POSES[a.pose]) || POSES.overhead;
  if (e.state === 'windup' && a) {
    const k = clamp(e.st / a.wind, 0, 1), e2 = 1 - Math.pow(1 - k, 2); return lerpP(REST, pose.raise, e2, out);
  }
  if (e.state === 'strike' && a) {
    const hits = a.hits ?? 1, gap = a.gap ?? .4, i = Math.max(0, Math.min(hits - 1, e.hitN - 1));
    const flip = a.pose === 'flurry' && i % 2 === 1; const R2 = flip ? mirror(pose.raise) : pose.raise, S = flip ? mirror(pose.strike) : pose.strike;
    if (e.hitN < hits && e.hitN > 0) { // swinging back for next strike
      const nextFlip = a.pose === 'flurry' && e.hitN % 2 === 1; const NR = nextFlip ? mirror(pose.raise) : pose.raise;
      const k = clamp((e.st - .1) / Math.max(.1, gap - .1), 0, 1); return lerpP(S, NR, 1 - Math.pow(1 - k, 2), out);
    }
    const k = clamp(e.st / .12, 0, 1); void R2; return lerpP(R2, S, k * k, out);
  }
  if (e.state === 'recover' && a) { const k = clamp(e.st / Math.max(.3, a.rec), 0, 1); const S = a.pose === 'flurry' && ((a.hits ?? 1) % 2 === 0) ? mirror(pose.strike) : pose.strike; return lerpP(S, REST, k * k * (3 - 2 * k), out); }
  if (e.guarding) return GUARD.slice();
  if (e.state === 'stagger') { const p = REST.slice(); p[1] = .9; p[3] = .1; p[6] = -.5; return p; }
  if (e.state === 'hurt') { const p = REST.slice(); p[6] = -.35; p[3] = .5; return p; }
  return REST.slice();
}
function drawEnemy(e: Enemy, dt: number, rawDt: number) {
  const rig = e.rig, t = W.time, sc = e.def.scale, hover = e.def.hover ?? 0; void rawDt;
  const bob = hover > 0 ? Math.sin(t * 2 + e.animSeed) * .18 + hover : 0;
  rig.root.position.set(e.pos.x, e.pos.y + bob, e.pos.z); rig.root.rotation.y = e.yaw; rig.root.rotation.x = e.state === 'down' ? -1.45 * clamp(1 - Math.abs(e.downT - .4) * 0, 0, 1) * clamp(e.downT * 6, 0, 1) : e.state === 'stagger' ? -.25 : 0;
  if (e.state !== 'spawn' && e.state !== 'dead') rig.root.scale.setScalar(sc);
  const p = enemyPose(e, pA); const dual = rig.hasLeftPiv; let L: P8 | null = null; if (dual) L = mirror(p);
  rig.pose(p, L, dt, e.state === 'windup' ? 14 : 24, t + e.animSeed);
  const sp = (e as unknown as { spd?: number }).spd ?? 0; rig.legAnim(e.state === 'move' ? sp : 0, dt, e.pos.y > .3);
  // telegraph tint
  if (e.frozenT > 0) { /* handled */ }
  else if (e.flash > 0) rig.flash(0xffffff, .9);
  else if (e.state === 'windup' && e.atk) { const k = clamp(e.st / e.atk.wind, 0, 1); if (e.atk.unblock) rig.flash(0xff1a1a, .25 + k * .9 + Math.sin(t * 28) * .15); else rig.flash(ELEM_COLORS[e.def.elem][1], .08 + k * .3); }
  else if (e.state === 'stagger') rig.flash(0xffcc33, .25 + Math.sin(t * 18) * .1);
  else if (e.state === 'phase') rig.flash(0xffffff, .4 + Math.sin(t * 20) * .3);
  else if (e.guarding) rig.flash(0x6688ff, .12);
  else rig.flash(0, 0);
  void pB; void V2; void (null as unknown as Elem);
}
