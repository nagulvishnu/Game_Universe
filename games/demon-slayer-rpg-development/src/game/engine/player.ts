import * as THREE from 'three';
import { rt, input, wasPressed, isDown, type PlayerRT, type EnemyRT } from '../runtime';
import { G, fwd, angDiff, rand, clamp, damp } from './ctx';
import { buildRig } from './rig';
import { computeStats, mastery, resolveSpecial, resolveUlt, specialUnlocked } from './stats';
import { ALL_SKILLS, STYLES } from '../data/styles';
import { CHAR_BY_ID } from '../data/characters';
import { useStore } from '../store';
import { audio } from '../audio';
import { damageEnemy, hurtPlayer, spawnProj, healPlayer } from './combat';
import type { SkillDef, StyleDef } from '../types';

const T = new THREE.Vector3(); const T2 = new THREE.Vector3(); const T3 = new THREE.Vector3();
const RUN = 6.2; const SPRINT = 9.6;
const LIGHT = [
  { dur: 0.46, hit: 0.34, range: 2.7, arc: 120, dmg: 1.0, kb: 1.5, st: 7, lunge: 2.2, v: 0, sta: 5 },
  { dur: 0.46, hit: 0.34, range: 2.7, arc: 120, dmg: 1.0, kb: 1.5, st: 7, lunge: 2.2, v: 1, sta: 5 },
  { dur: 0.58, hit: 0.4, range: 3.0, arc: 140, dmg: 1.3, kb: 3, st: 10, lunge: 2.8, v: 2, sta: 6 },
  { dur: 0.82, hit: 0.42, range: 3.5, arc: 360, dmg: 1.7, kb: 6, st: 18, lunge: 0.8, v: 3, sta: 9 },
];
const HEAVY = { dur: 0.88, hit: 0.6, range: 3.5, arc: 150, dmg: 2.5, kb: 7, st: 32, lunge: 3.2, v: 0, sta: 20 };

const weaponOf = (id: string) => (id === 'tengen' ? 'cleaver' : id === 'inosuke' ? 'serrated' : id === 'mitsuri' ? 'whip' : id === 'gyomei' ? 'flail' : 'sword');
const styleOf = () => STYLES[CHAR_BY_ID[rt.player!.charId].style];

export function createPlayer(pos: THREE.Vector3): PlayerRT {
  const prof = useStore.getState().profile; const stats = computeStats(prof); const def = CHAR_BY_ID[prof.activeChar];
  const model = buildRig(def.look, { blade: stats.bladeColor, glow: stats.glow, dual: def.dual, weapon: weaponOf(def.id), outline: true, shadow: true });
  model.group.position.copy(pos); G.ents.add(model.group);
  const p: PlayerRT = {
    pos: pos.clone(), yaw: 0, vy: 0, onGround: true, hp: stats.maxHp, maxHp: stats.maxHp, sta: stats.maxSta, maxSta: stats.maxSta, breath: stats.maxBreath, maxBreath: stats.maxBreath,
    ult: 0, maxUlt: 100, state: 'free', t: 0, dur: 0, combo: 0, queued: null, hitMask: 0, invuln: 0, guardT: 0, dodgeT: 0, perfect: 0, cd: {}, cdMax: {}, buffs: { focus: 0, guard: 0, regen: 0, slow: 0 },
    skill: null, skillHit: new Set(), skillTick: 0, skillDir: new THREE.Vector3(0, 0, 1), skillFrom: new THREE.Vector3(), skillTarget: null, stagger: 0, lockId: null, comboT: 0, stats,
    charId: def.id, model, footT: 0, sprinting: false, regenDelay: 0, lastHitT: 99, ultActive: 0, air: false, airAttack: false, heavyDir: 0, moveDir: new THREE.Vector3(), kb: new THREE.Vector3(),
  };
  return p;
}

export function destroyPlayer() { const p = rt.player; if (!p) return; if (p.model) { G.ents.remove(p.model.group); p.model.dispose(); } rt.player = null; }

export function refreshStats(fullHeal = false) {
  const p = rt.player; if (!p) return; const prof = useStore.getState().profile; const s = computeStats(prof);
  const hr = p.hp / p.maxHp; const sr = p.sta / p.maxSta; p.stats = s; p.maxHp = s.maxHp; p.maxSta = s.maxSta; p.maxBreath = s.maxBreath;
  p.hp = fullHeal ? s.maxHp : Math.min(s.maxHp, Math.max(1, hr * s.maxHp)); p.sta = fullHeal ? s.maxSta : sr * s.maxSta; p.breath = Math.min(p.breath, p.maxBreath);
  void rebuildBlade;
}
export function rebuildBlade() { /* blade colors rebuild on character switch */ }

export function swapCharacter() {
  const p = rt.player; if (!p) return; const pos = p.pos.clone(); const yaw = p.yaw; const hpr = p.hp / p.maxHp;
  destroyPlayer(); const np = createPlayer(pos); np.yaw = yaw; np.hp = Math.max(1, hpr * np.maxHp); np.ult = p.ult; rt.player = np; G.fx!.ring(pos, 3, 0xffffff, 0.5); G.fx!.sparks(T.set(pos.x, pos.y + 1, pos.z), 20, 0xffffff, 6); audio.sfx('magic');
}

function findTarget(maxD: number, dir: THREE.Vector3 | null, coneDeg: number): EnemyRT | null {
  const p = rt.player!; let best: EnemyRT | null = null; let bd = 1e9;
  if (p.lockId !== null) { const l = rt.enemies.find((e) => e.id === p.lockId && e.state !== 'dead'); if (l) return l; }
  for (const e of rt.enemies) {
    if (e.state === 'dead' || e.state === 'hidden') continue; const dx = e.pos.x - p.pos.x; const dz = e.pos.z - p.pos.z; const d = Math.hypot(dx, dz); if (d > maxD) continue;
    if (dir) { const a = Math.abs(angDiff(Math.atan2(dir.x, dir.z), Math.atan2(dx, dz))); if (a > (coneDeg * Math.PI) / 360) continue; }
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function power(mult: number): { dmg: number; crit: boolean } {
  const p = rt.player!; const prof = useStore.getState().profile; const crit = Math.random() < p.stats.crit + (p.buffs.focus > 0 ? 0.08 : 0);
  let d = p.stats.atk * mult * mastery(prof, p.charId) * (p.buffs.focus > 0 ? 1.15 : 1) * (0.93 + Math.random() * 0.14); if (crit) d *= p.stats.critDmg; return { dmg: d, crit };
}

function vfxSlash(st: StyleDef, pos: THREE.Vector3, yaw: number, radius: number, arc: number, tilt: number, dir: 1 | -1, y = 1.05) {
  const fx = G.fx!; fx.slash(pos, yaw, { radius, arc, color: st.color, core: st.core, tilt, dir, wave: st.wave, y, life: 0.34 });
  const n = 5; for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * arc * dir; const px = pos.x + Math.sin(yaw + a) * radius * 0.85; const pz = pos.z + Math.cos(yaw + a) * radius * 0.85; fx.style(st, T.set(px, pos.y + 1.0, pz), 2, 1.2); }
}
function vfxImpact(st: StyleDef, pos: THREE.Vector3, big = false) {
  const fx = G.fx!; fx.style(st, pos, big ? 22 : 8, big ? 4 : 2); fx.ring(pos, big ? 6 : 2.6, st.color, big ? 0.6 : 0.35, 0.15);
  if (st.particle === 'spark') fx.bolt(T.set(pos.x + rand(-1, 1), pos.y + 14, pos.z + rand(-1, 1)), pos.clone().setY(pos.y + 0.5), st.color, 0.22, 1.2);
  if (st.particle === 'rock') fx.debris(pos, big ? 18 : 6, 0x8a7050); if (st.particle === 'fire' || st.particle === 'sun') fx.column(pos, st.color, big ? 1.4 : 0.7, big ? 9 : 4, 0.5);
}
function skillSound(st: StyleDef) {
  const m: Record<string, string> = { water: 'water', fire: 'fire', sun: 'fire', spark: 'thunder', wind: 'wind', mist: 'magic', poison: 'poison', note: 'explosion', petal: 'magic', rock: 'quake', snake: 'magic' };
  audio.sfx(m[st.particle] ?? 'magic');
}

function meleeHit(range: number, arcDeg: number, mult: number, o: { kb: number; st: number; heavy?: boolean; skill?: boolean; status?: SkillDef['fx']; sk?: SkillDef; hits?: number; pull?: boolean; origin?: THREE.Vector3; yaw?: number }) {
  const p = rt.player!; const st = styleOf(); const yaw = o.yaw ?? p.yaw; const origin = o.origin ?? p.pos; let hitAny = false;
  for (const e of rt.enemies) {
    if (e.state === 'dead' || e.state === 'hidden') continue; const dx = e.pos.x - origin.x; const dz = e.pos.z - origin.z; const d = Math.hypot(dx, dz);
    const reach = range + e.def.radius * e.def.scale; if (d > reach) continue;
    if (arcDeg < 359) { const a = Math.abs(angDiff(yaw, Math.atan2(dx, dz))); if (a > (arcDeg * Math.PI) / 360 && d > e.def.radius * e.def.scale + 0.6) continue; }
    const dir = T.set(dx, 0, dz).normalize().clone(); const n = o.hits ?? 1;
    for (let i = 0; i < n; i++) {
      const { dmg, crit } = power(mult); let dd = dmg; let fin = false;
      if (e.state === 'stagger' && ((!e.boss && e.hp / e.maxHp < 0.3) || (e.boss && e.hp / e.maxHp < 0.1)) && !o.skill) { dd = e.hp + 1; fin = true; rt.slowmo = 0.8; G.fx!.number(T3.set(e.pos.x, e.pos.y + 3, e.pos.z), 'FINISHER', '#ff7a3a', true); }
      damageEnemy(e, dd, { kb: i === n - 1 ? o.kb : 0, dir, stagger: o.st, crit, style: st.id, heavy: o.heavy, skill: o.skill, status: i === n - 1 ? o.status : undefined, finisher: fin });
      if ((e.state as string) === 'dead') break;
    }
    if (o.pull && (e.state as string) !== 'dead' && !e.boss) { const pd = T.set(origin.x - e.pos.x, 0, origin.z - e.pos.z); if (pd.length() > 1.5) e.vel.addScaledVector(pd.normalize(), 5); }
    hitAny = true;
  }
  if (hitAny && !o.skill) p.sta = Math.min(p.maxSta, p.sta + 2);
  return hitAny;
}

function faceDesired(dt: number, rate = 16) { const p = rt.player!; void dt; void rate; return p.yaw; }

function aimAtStart() {
  const p = rt.player!; const mv = p.moveDir.lengthSq() > 0.01 ? p.moveDir : fwd(rt.camYaw, T2);
  const t = findTarget(p.lockId !== null ? 40 : 8.5, p.lockId !== null ? null : mv, 140);
  if (t) { p.yaw = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z); p.skillTarget = t.id; } else { p.skillTarget = null; if (p.moveDir.lengthSq() > 0.01) p.yaw = Math.atan2(p.moveDir.x, p.moveDir.z); }
}

function startAttack(kind: 'light' | 'heavy') {
  const p = rt.player!; const a = kind === 'heavy' ? HEAVY : LIGHT[p.combo % 4]; const spd = CHAR_BY_ID[p.charId].atkSpeed * (p.buffs.focus > 0 ? 1.1 : 1);
  if (p.sta < 3) return; const sprint = p.sprinting && kind === 'light' && p.state === 'free';
  aimAtStart(); p.state = kind === 'heavy' ? 'heavy' : 'attack'; p.t = 0; p.dur = a.dur / spd; p.hitMask = 0; p.queued = null; p.sta -= a.sta; p.regenDelay = 0.8; p.comboT = 1.0;
  if (sprint) { p.dur = 0.55 / spd; }
  p.skill = null; p.skillFrom.copy(p.pos); audio.sfx(kind === 'heavy' ? 'heavy' : p.combo % 2 ? 'swing2' : 'swing');
  const am = p.model!.anim; am.pose = kind === 'heavy' ? 'heavy' : 'attack'; am.variant = sprint ? 0 : a.v; am.pt = 0;
  (p as unknown as { _run: boolean })._run = sprint;
}

function attackUpdate(dt: number, heavy: boolean) {
  const p = rt.player!; const a = heavy ? HEAVY : LIGHT[p.combo % 4]; const run = (p as unknown as { _run: boolean })._run;
  const u = p.t / p.dur; const st = styleOf(); const am = p.model!.anim; am.pt = u;
  // lunge toward target
  const lunge = run ? 7 : a.lunge; const lu = a.hit * 1.05;
  if (u < lu) { const tgt = p.skillTarget !== null ? rt.enemies.find((e) => e.id === p.skillTarget) : null; const dist = tgt ? Math.hypot(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z) - tgt.def.radius * tgt.def.scale : 99; if (!tgt || dist > 1.3) { const sp = lunge / (lu * p.dur); p.pos.addScaledVector(fwd(p.yaw, T), sp * dt); } }
  if (!(p.hitMask & 1) && u >= a.hit) {
    p.hitMask |= 1; const range = a.range * CHAR_BY_ID[p.charId].reach; const tilt = a.v === 2 ? 1.25 : a.v === 3 ? 0.15 : a.v === 0 ? 0.25 : -0.25;
    vfxSlash(st, p.pos, p.yaw, range * 0.9, ((a.arc >= 360 ? 300 : a.arc) * Math.PI) / 180, heavy ? 1.0 : tilt, a.v === 1 ? -1 : 1);
    if (CHAR_BY_ID[p.charId].dual && !heavy) vfxSlash(st, p.pos, p.yaw, range * 0.8, 2.2, -tilt, a.v === 1 ? 1 : -1);
    if (a.v === 3 && !heavy) { G.fx!.ring(p.pos, range, st.color, 0.4); }
    const mult = a.dmg * (run ? 1.35 : 1) * CHAR_BY_ID[p.charId].atkSpeed ** -0.35;
    const hit = meleeHit(range, run ? 100 : a.arc, mult, { kb: a.kb, st: a.st, heavy });
    if (hit) { p.combo = (p.combo + 1) % 4; if (heavy) p.combo = 0; } else { p.combo = (p.combo + 1) % 4; }
    if (heavy) { G.fx!.dust(p.pos.clone().addScaledVector(fwd(p.yaw, T3), range * 0.7), 10); rt.shake = Math.max(rt.shake, 0.35); }
    rt.comboTimer = 2.2; if (hit) rt.combo++;
  }
  // chain
  if (u >= 0.5 && p.queued && !heavy) { const q = p.queued; p.queued = null; if (q === 'heavy') startAttack('heavy'); else startAttack('light'); return; }
  if (u >= 0.6 && p.queued === 'heavy' && heavy) { p.queued = null; startAttack('light'); return; }
  if (p.t >= p.dur) { p.state = 'free'; if (heavy) p.combo = 0; }
}

function startDodge() {
  const p = rt.player!; if (p.sta < 8 || p.state === 'dodge') return; p.sta -= 18; p.regenDelay = 0.7;
  const d = p.moveDir.lengthSq() > 0.01 ? p.moveDir.clone().normalize() : fwd(p.yaw, new THREE.Vector3()).multiplyScalar(-1);
  p.state = 'dodge'; p.t = 0; p.dur = 0.42; p.dodgeT = 0; p.invuln = 0.34; p.perfect = 0.3; p.skillDir.copy(d); p.queued = null;
  if (p.moveDir.lengthSq() > 0.01) p.yaw = Math.atan2(d.x, d.z);
  p.model!.anim.pose = 'dodge'; audio.sfx('dodge'); G.fx!.dust(p.pos, 6, 0xb0a890, 3);
}

function jump() { const p = rt.player!; if (!p.onGround || p.sta < 6) return; p.vy = 9.5; p.onGround = false; p.sta -= 6; audio.sfx('jump'); G.fx!.dust(p.pos, 4); }

function useSkill(sk: SkillDef) {
  const p = rt.player!; if (p.state === 'dead' || p.state === 'hurt' || p.state === 'dodge' && p.t < 0.15) return;
  if (p.cd[sk.id] > 0) { return; }
  const cost = sk.breath * p.stats.breathMul * (p.buffs.focus > 0 ? 0.5 : 1);
  if (sk.ult) { if (p.ult < p.maxUlt) { audio.sfx('deny'); return; } } else if (p.breath < cost) { audio.sfx('deny'); useStore.getState().toast('Not enough breath!', 'warn'); return; }
  if (p.state === 'attack' || p.state === 'heavy') { if (p.t < p.dur * 0.3) return; }
  if (sk.ult) p.ult = 0; else p.breath -= cost;
  aimAtStart(); p.state = 'skill'; p.skill = sk; p.t = 0; p.dur = sk.dur; p.skillHit.clear(); p.skillTick = 0; p.queued = null; p.skillFrom.copy(p.pos); p.skillDir.copy(fwd(p.yaw, new THREE.Vector3()));
  p.invuln = sk.kind === 'dash' ? sk.dur * 0.8 : sk.kind === 'multi' || sk.kind === 'ult' ? sk.dur : sk.kind === 'slam' ? sk.dur * 0.6 : 0.2;
  p.cd[sk.id] = sk.cd * (p.buffs.focus > 0 ? 0.85 : 1); p.cdMax[sk.id] = p.cd[sk.id]; p.regenDelay = 1.5; p.comboT = 0;
  const am = p.model!.anim; am.pt = 0; am.variant = 0;
  am.pose = sk.kind === 'dash' ? 'thrust' : sk.kind === 'spin' ? 'spin' : sk.kind === 'multi' ? 'skill' : sk.kind === 'ult' ? 'cast' : sk.kind === 'slam' ? 'spin' : sk.kind === 'proj' ? 'attack' : 'attack';
  if (sk.kind === 'arc' || sk.kind === 'proj') am.variant = sk.id.length % 3 === 0 ? 2 : 0;
  const st = STYLES[sk.style]; skillSound(st); audio.sfx('heavy');
  G.fx!.number(T.set(p.pos.x, p.pos.y + 2.5, p.pos.z), sk.name, '#' + st.color.toString(16).padStart(6, '0'), false);
  G.fx!.flash(T.set(p.pos.x, p.pos.y + 1, p.pos.z), st.color, 3, 0.2);
  if (sk.kind === 'ult') { rt.ultCam = 1; rt.shake = 0.6; G.fx!.column(p.pos, st.color, 1.4, 20, sk.dur); G.fx!.ring(p.pos, 10, st.core, 0.9); }
  if (sk.kind === 'dash') {
    const to = p.pos.clone().addScaledVector(p.skillDir, sk.dash); G.fx!.trail(p.pos.clone(), to, { color: st.color, core: st.core, width: 1.4, life: 0.55, jag: st.particle === 'spark' ? 0.7 : 0, y: 1.0 });
    if (st.particle === 'water') G.fx!.helix(p.pos.clone(), 1.3, 2.4, st.color, st.core, { turns: 1.5, life: 0.5, spin: 14 });
  }
  if (sk.kind === 'spin') { G.fx!.helix(p.pos.clone(), sk.range * 0.55, 3, st.color, st.core, { turns: 2.2, life: sk.dur, spin: 13, strands: 3, grow: 0.7 }); }
  if (sk.kind === 'slam') { G.fx!.helix(p.pos.clone(), 1.6, 3.4, st.color, st.core, { turns: 2, life: sk.dur * 0.6, spin: 18 }); }
  if (sk.id === 'water5') G.fx!.helix(p.pos.clone(), sk.range, 3.6, st.color, st.core, { turns: 3, life: sk.dur, spin: 8, strands: 3 });
}

function skillUpdate(dt: number) {
  const p = rt.player!; const sk = p.skill!; const st = STYLES[sk.style]; const u = p.t / p.dur; const am = p.model!.anim; am.pt = sk.kind === 'dash' || sk.kind === 'spin' || sk.kind === 'multi' || sk.kind === 'ult' ? u : Math.min(1, u);
  const lvl = (n: number) => sk.dmg * n;
  const hitArea = (r: number, arc: number, mult: number, hits = 1, o: Partial<{ pull: boolean; origin: THREE.Vector3; yaw: number }> = {}) => meleeHit(r, arc, mult, { kb: 6, st: 22, skill: true, status: sk.fx, sk, hits, ...o });
  switch (sk.kind) {
    case 'dash': {
      const a = 0.15; const b = 0.72;
      if (u > a && u < b) {
        const sp = sk.dash / ((b - a) * p.dur); p.pos.addScaledVector(p.skillDir, sp * dt); am.pose = 'thrust';
        if (Math.random() < 0.8) G.fx!.style(st, T.set(p.pos.x, p.pos.y + 1, p.pos.z), 2, 1);
        for (const e of rt.enemies) { if (e.state === 'dead' || e.state === 'hidden' || p.skillHit.has(e.id)) continue; if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < sk.range * 0.6 + e.def.radius * e.def.scale) { p.skillHit.add(e.id); const n = sk.hits; const dir = fwd(p.yaw, T3).clone(); for (let i = 0; i < n; i++) { const { dmg, crit } = power(lvl(1)); damageEnemy(e, dmg, { kb: i === n - 1 ? 7 : 0, dir, stagger: 24, crit, style: st.id, skill: true, status: i === n - 1 ? sk.fx : undefined, heavy: true }); } vfxImpact(st, T.set(e.pos.x, e.pos.y + 1, e.pos.z)); } }
      }
      if (!(p.hitMask & 2) && u >= b) { p.hitMask |= 2; vfxSlash(st, p.pos, p.yaw, sk.range, 2.4, 0.3, 1); }
      break;
    }
    case 'arc': {
      const n = Math.max(1, sk.hits); const t0 = 0.3; const span = 0.35;
      while (p.skillTick < n && u >= t0 + (n === 1 ? 0 : (p.skillTick / (n - 1)) * span)) {
        const i = p.skillTick++; vfxSlash(st, p.pos, p.yaw, sk.range * 0.9, (sk.arc * Math.PI) / 180, i % 2 ? -0.6 : 0.5, i % 2 ? -1 : 1); hitArea(sk.range, sk.arc, lvl(1)); p.pos.addScaledVector(fwd(p.yaw, T3), 0.35); am.variant = i % 2 ? 1 : 0;
        if (st.particle === 'spark') G.fx!.bolt(T.set(p.pos.x, p.pos.y + 12, p.pos.z + 1), T2.set(p.pos.x + Math.sin(p.yaw) * 2, p.pos.y + 1, p.pos.z + Math.cos(p.yaw) * 2), st.color);
      }
      break;
    }
    case 'spin': {
      const n = Math.max(1, sk.hits); const t0 = 0.12; const span = 0.7; am.pose = 'spin';
      while (p.skillTick < n && u >= t0 + (n === 1 ? 0 : (p.skillTick / (n - 1)) * span)) {
        const i = p.skillTick++; vfxSlash(st, p.pos, p.yaw + i * 1.3, sk.range * 0.85, Math.PI * 1.7, (i % 3) * 0.35 - 0.3, i % 2 ? -1 : 1, 0.9 + (i % 3) * 0.3);
        hitArea(sk.range, 360, lvl(1), 1, { pull: sk.fx === 'pull' }); if (st.particle === 'spark') G.fx!.bolt(T.set(p.pos.x + rand(-2, 2), p.pos.y + 12, p.pos.z + rand(-2, 2)), T2.set(p.pos.x + rand(-sk.range, sk.range), p.pos.y + 0.5, p.pos.z + rand(-sk.range, sk.range)), st.color);
        if (i === n - 1) vfxImpact(st, p.pos, true);
      }
      break;
    }
    case 'multi': {
      const n = Math.max(1, sk.hits); const t0 = 0.08; const span = 0.84; am.pose = 'skill';
      while (p.skillTick < n && u >= t0 + (n === 1 ? 0 : (p.skillTick / (n - 1)) * span)) {
        const i = p.skillTick++; let tgt: EnemyRT | null = null; let bd = 1e9;
        for (const e of rt.enemies) { if (e.state === 'dead' || e.state === 'hidden') continue; const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); const pen = p.skillTarget === e.id ? -2 : 0; if (d < sk.range && d + pen + (e.id === p.skillTarget ? 0 : (i % 2) * 0.01) < bd) { bd = d + pen; tgt = e; } }
        const from = p.pos.clone();
        if (tgt) { const ang = Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z) + (i % 2 ? 2.3 : -2.3); const rr = 1.5 + tgt.def.radius * tgt.def.scale; p.pos.set(tgt.pos.x + Math.sin(ang) * rr, p.pos.y, tgt.pos.z + Math.cos(ang) * rr); p.yaw = Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z); }
        else { p.pos.addScaledVector(fwd(p.yaw, T3), 2.2); }
        G.fx!.trail(from, p.pos.clone(), { color: st.color, core: st.core, width: 0.8, life: 0.35, jag: st.particle === 'spark' ? 0.8 : 0 });
        vfxSlash(st, p.pos, p.yaw, 2.4, 2.3, (i * 0.9) % 2.4 - 1.2, i % 2 ? -1 : 1);
        meleeHit(2.9, 200, lvl(1), { kb: 3, st: 12, skill: true, status: sk.fx, sk, origin: p.pos, yaw: p.yaw });
        if (st.particle === 'spark' && tgt) G.fx!.bolt(T.set(tgt.pos.x, tgt.pos.y + 14, tgt.pos.z), T2.set(tgt.pos.x, tgt.pos.y + 1, tgt.pos.z), st.color);
        am.variant = i % 4; rt.shake = Math.max(rt.shake, 0.15);
      }
      break;
    }
    case 'proj': {
      if (!(p.hitMask & 4) && u >= 0.4) {
        p.hitMask |= 4; const n = Math.max(1, sk.hits);
        for (let i = 0; i < n; i++) { const a = p.yaw + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.45); const dir = T.set(Math.sin(a), 0, Math.cos(a)).clone(); const { dmg } = power(lvl(1));
          spawnProj({ pos: T2.set(p.pos.x + dir.x, p.pos.y + 1.1, p.pos.z + dir.z).clone(), dir, speed: 24, dmg, friendly: true, color: st.color, core: st.core, kind: 'slash', size: 0.9 + sk.dmg * 0.15, life: sk.range / 24, pierce: true, status: sk.fx, style: st.id, kb: 4 }); }
        vfxSlash(st, p.pos, p.yaw, 2.4, 2, 0.4, 1);
      }
      break;
    }
    case 'slam': {
      const leapEnd = 0.55; am.pose = 'spin';
      if (u < leapEnd) { const sp = sk.dash / (leapEnd * p.dur); p.pos.addScaledVector(p.skillDir, sp * dt); p.vy = 0; p.air = true; (p as unknown as { _ly: number })._ly = Math.sin((u / leapEnd) * Math.PI) * 2.6; }
      else if (!(p.hitMask & 8)) { p.hitMask |= 8; (p as unknown as { _ly: number })._ly = 0; p.air = false; hitArea(sk.range, 360, lvl(1), 1); vfxImpact(st, p.pos, true); G.fx!.dust(p.pos, 18); rt.shake = Math.max(rt.shake, 0.7); audio.sfx('quake'); vfxSlash(st, p.pos, p.yaw, sk.range * 0.9, Math.PI * 1.8, 0.1, 1, 0.4); }
      break;
    }
    case 'ult': {
      am.pose = u < 0.22 ? 'cast' : 'spin'; p.pos.addScaledVector(p.skillDir, 0); rt.ultCam = u < 0.95 ? 1 : 0;
      if (u < 0.22 && Math.random() < 0.7) G.fx!.style(st, T.set(p.pos.x + rand(-1.5, 1.5), p.pos.y + rand(0, 2), p.pos.z + rand(-1.5, 1.5)), 3, 0.5);
      const n = sk.hits; const t0 = 0.24; const span = 0.6;
      while (p.skillTick < n && u >= t0 + (p.skillTick / Math.max(1, n - 1)) * span) {
        const i = p.skillTick++; const live = rt.enemies.filter((e) => e.state !== 'dead' && e.state !== 'hidden' && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < sk.range);
        const tg = live.length ? live[i % live.length] : null; const c = tg ? tg.pos.clone() : p.pos.clone().add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4)));
        const ang = (i / n) * Math.PI * 2 * 2; const from = p.pos.clone();
        G.fx!.trail(from, c.clone().setY(c.y), { color: st.color, core: st.core, width: 1.6, life: 0.5, jag: st.particle === 'spark' ? 1 : 0 });
        vfxSlash(st, c, ang, 3.4, 2.6, (i % 3) * 0.7 - 0.7, i % 2 ? -1 : 1, 1.2); vfxImpact(st, c.clone().setY(c.y + 0.5), i % 3 === 0);
        meleeHit(4.2, 360, lvl(1), { kb: 5, st: 16, skill: true, status: sk.fx, sk, origin: c, yaw: 0 }); rt.shake = Math.max(rt.shake, 0.35); audio.sfx(i % 2 ? 'swing2' : 'swing');
        if (i % 2 === 0) G.fx!.helix(c.clone(), 2.4, 5, st.color, st.core, { turns: 2, life: 0.7, spin: 14 });
      }
      if (!(p.hitMask & 16) && u >= 0.93) { p.hitMask |= 16; meleeHit(sk.range, 360, lvl(2.2), { kb: 10, st: 60, skill: true, status: sk.fx, sk, hits: 1 }); G.fx!.ring(p.pos, sk.range, st.color, 0.9); G.fx!.ring(p.pos, sk.range * 0.7, st.core, 0.7); vfxImpact(st, p.pos, true); rt.shake = 1; rt.hitstop = 0.12; audio.sfx('explosion'); G.fx!.flash(T.set(p.pos.x, p.pos.y + 1, p.pos.z), st.core, 8, 0.4); }
      break;
    }
  }
  if (p.t >= p.dur) { p.state = 'free'; p.skill = null; p.air = false; (p as unknown as { _ly: number })._ly = 0; p.model!.anim.pose = 'idle'; rt.ultCam = 0; }
}

function pickLock() {
  const p = rt.player!; if (p.lockId !== null) { p.lockId = null; audio.sfx('ui'); return; }
  const look = fwd(rt.camYaw, T2); const t = findTarget(24, look, 120); if (t) { p.lockId = t.id; audio.sfx('uiok'); }
}

export function updatePlayer(dt: number, realDt: number) {
  const p = rt.player!; const prof = useStore.getState().profile; const cp = prof.chars[p.charId]; const am = p.model!.anim; const def = CHAR_BY_ID[p.charId];
  void realDt;
  for (const k in p.cd) { if (p.cd[k] > 0) p.cd[k] -= dt; }
  p.invuln = Math.max(0, p.invuln - dt); p.perfect = Math.max(0, p.perfect - dt); p.lastHitT += dt; p.regenDelay -= dt; p.comboT -= dt; p.guardT += dt;
  (Object.keys(p.buffs) as (keyof typeof p.buffs)[]).forEach((k) => { p.buffs[k] = Math.max(0, p.buffs[k] - dt); });
  if (p.comboT <= 0 && p.state === 'free') p.combo = 0;
  if (p.state === 'dead') { p.t += dt; am.pose = 'dead'; am.pt = clamp(p.t / 1.2, 0, 1); am.walk = 0; return; }
  // input vector
  let fx = 0; let fy = 0; if (isDown('KeyW')) fy += 1; if (isDown('KeyS')) fy -= 1; if (isDown('KeyD')) fx += 1; if (isDown('KeyA')) fx -= 1;
  const look = fwd(rt.camYaw, T); const rx = -Math.cos(rt.camYaw); const rz = Math.sin(rt.camYaw);
  p.moveDir.set(look.x * fy + rx * fx, 0, look.z * fy + rz * fx); const mlen = p.moveDir.length(); if (mlen > 0.01) p.moveDir.multiplyScalar(1 / Math.max(1, mlen));
  const hasMove = mlen > 0.01; p.t += dt;
  // lock validation
  if (p.lockId !== null) { const l = rt.enemies.find((e) => e.id === p.lockId); if (!l || l.state === 'dead' || Math.hypot(l.pos.x - p.pos.x, l.pos.z - p.pos.z) > 34) p.lockId = null; }
  if (wasPressed('KeyF')) pickLock();
  // quick use
  if (wasPressed('KeyH')) { const inv = prof.inventory; const id = ['herb', 'rice_ball'].find((k) => (inv[k] ?? 0) > 0); if (id) useStore.getState().cmd({ type: 'useItem', id }); else useStore.getState().toast('No healing items.', 'warn'); }
  // action inputs
  const canAct = p.state === 'free' || p.state === 'guard';
  const light = input.clickL || (input.mouseL && p.state === 'free' && p.comboT > 0.2 && false); const heavy = input.clickR;
  if (p.state === 'free' || p.state === 'guard') {
    if (p.state === 'guard' && !isDown('KeyC')) { p.state = 'free'; }
    if (light) { if (!p.onGround) { if (!p.airAttack) { p.airAttack = true; p.vy = -18; am.pose = 'heavy'; audio.sfx('heavy'); } } else startAttack('light'); }
    else if (heavy) startAttack('heavy');
    else if (wasPressed('Space')) startDodge();
    else if (wasPressed('KeyX')) jump();
    else if (isDown('KeyC') && p.state === 'free' && p.sta > 5) { p.state = 'guard'; p.guardT = 0; p.t = 0; }
  } else if ((p.state === 'attack' || p.state === 'heavy')) {
    if (light) p.queued = 'light'; else if (heavy) p.queued = 'heavy';
    if (wasPressed('Space') && p.t > p.dur * 0.35) startDodge();
  } else if (p.state === 'skill') { if (wasPressed('Space') && p.skill?.kind !== 'ult' && p.t > p.dur * 0.5 && p.skill?.kind !== 'multi') startDodge(); }
  else if (p.state === 'hurt') { if (wasPressed('Space') && p.t > 0.12) startDodge(); }
  // skills
  const tryKey = (codes: string[], fn: () => void) => { if (wasPressed(...codes) && (canAct || p.state === 'attack' || p.state === 'heavy' || p.state === 'skill' && p.t > p.dur * 0.6)) fn(); };
  tryKey(['KeyQ'], () => { if (p.cd.focus > 0) { audio.sfx('deny'); return; } p.buffs.focus = 8; p.cd.focus = 14; p.cdMax.focus = 14; const st = styleOf(); G.fx!.ring(p.pos, 3.5, st.color, 0.7); G.fx!.helix(p.pos.clone(), 1.2, 2.4, st.color, st.core, { turns: 2, life: 0.8, spin: 6 }); audio.sfx('magic'); useStore.getState().toast('Total Concentration Breathing!', 'good'); p.breath = Math.min(p.maxBreath, p.breath + 20); });
  tryKey(['KeyE'], () => { const sp = resolveSpecial(def, prof.chapter); if (specialUnlocked(prof, p.charId, sp)) useSkill(sp); else useStore.getState().toast(`Special unlocks at Lv.4`, 'warn'); });
  tryKey(['KeyR'], () => { const ul = resolveUlt(def, prof.chapter); if (specialUnlocked(prof, p.charId, ul)) useSkill(ul); else useStore.getState().toast('Ultimate unlocks at Lv.3', 'warn'); });
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((c, i) => tryKey([c], () => { const id = cp.equipped[i]; if (id && cp.unlocked.includes(id)) useSkill(ALL_SKILLS[id]); else useStore.getState().toast('No skill equipped in this slot - open the Skills tab (K).', 'warn'); }));

  // ---- state updates
  const slowMul = p.buffs.slow > 0 ? 0.55 : 1;
  if (p.state === 'free' || p.state === 'guard') {
    p.sprinting = isDown('ShiftLeft', 'ShiftRight') && hasMove && p.sta > 2 && p.state === 'free';
    let spd = (p.sprinting ? SPRINT : RUN) * p.stats.spd * slowMul * (p.state === 'guard' ? 0.45 : 1);
    if (p.sprinting) p.sta -= 12 * dt; if (p.state === 'guard' && hasMove) spd *= 0.9;
    if (hasMove) { p.pos.addScaledVector(p.moveDir, spd * dt); }
    // facing
    const tgt = p.lockId !== null ? rt.enemies.find((e) => e.id === p.lockId) : null;
    let want = p.yaw; if (tgt && !p.sprinting) want = Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z); else if (hasMove) want = Math.atan2(p.moveDir.x, p.moveDir.z); else if (p.state === 'guard') want = p.yaw;
    p.yaw += angDiff(p.yaw, want) * (1 - Math.exp(-16 * dt));
    am.walk = hasMove ? (p.sprinting ? 1.5 : slowMul < 1 ? 0.5 : 1) : 0; am.sprint = p.sprinting; am.pose = !p.onGround ? 'air' : p.state === 'guard' ? 'guard' : 'idle'; am.expr = 'normal';
    if (hasMove && p.onGround) { p.footT -= dt; if (p.footT <= 0) { p.footT = p.sprinting ? 0.25 : 0.36; audio.sfx('step'); if (G.fx && p.sprinting && Math.random() < 0.5) G.fx.dust(p.pos, 1, 0x9a9080, 1); } }
    if (p.state === 'guard') { p.sta -= 1.2 * dt; if (p.sta <= 0) p.state = 'free'; }
  } else if (p.state === 'attack') { am.walk = 0; attackUpdate(dt, false); }
  else if (p.state === 'heavy') { am.walk = 0; attackUpdate(dt, true); }
  else if (p.state === 'skill') { am.walk = 0; skillUpdate(dt); }
  else if (p.state === 'dodge') {
    p.dodgeT += dt; const u = p.t / p.dur; am.pt = u; am.pose = 'dodge'; const sp = 11 * (1 - u * 0.7) * p.stats.spd; p.pos.addScaledVector(p.skillDir, sp * dt); am.walk = 0;
    if (Math.random() < 0.5) G.fx!.add.emit(p.pos.x, p.pos.y + 0.8, p.pos.z, 0, 0, 0, 0.3, 0.5, 0.05, 0xffffff, 0.3);
    if (p.t >= p.dur) { p.state = 'free'; p.invuln = Math.max(p.invuln, 0); }
  } else if (p.state === 'hurt') { am.pose = 'hurt'; am.pt = p.t / p.dur; am.expr = 'hurt'; am.walk = 0; if (p.t >= p.dur) p.state = 'free'; }
  // regen
  if (p.state !== 'attack' && p.state !== 'heavy' && p.state !== 'dodge' && !p.sprinting && p.state !== 'guard' && p.regenDelay <= 0) p.sta = Math.min(p.maxSta, p.sta + p.stats.staRegen * (p.buffs.focus > 0 ? 1.8 : 1) * (p.buffs.regen > 0 ? 1.8 : 1) * dt);
  if (p.state === 'free' && p.regenDelay <= 0) p.breath = Math.min(p.maxBreath, p.breath + (p.stats.breathRegen + (p.buffs.focus > 0 ? 6 : 0)) * dt);
  if (p.sta < 0) p.sta = 0;
  if (p.buffs.focus > 0 && Math.random() < 0.3) { const st = styleOf(); G.fx!.style(st, T.set(p.pos.x + rand(-0.5, 0.5), p.pos.y + rand(0.2, 1.6), p.pos.z + rand(-0.5, 0.5)), 1, 0.4); }
  // air attack plunge
  if (!p.onGround && p.airAttack) { am.pose = 'heavy'; am.pt = 0.7; }
  // physics
  p.pos.addScaledVector(p.kb, dt); p.kb.multiplyScalar(Math.exp(-9 * dt));
  const gy = rt.hAt(p.pos.x, p.pos.z); const ly = (p as unknown as { _ly?: number })._ly ?? 0;
  if (p.state === 'skill' && p.skill?.kind === 'slam') { p.pos.y = gy + ly; }
  else if (!p.onGround || p.pos.y > gy + 0.05) {
    p.vy -= 30 * dt; p.pos.y += p.vy * dt;
    if (p.pos.y <= gy) { p.pos.y = gy; if (!p.onGround) { audio.sfx('land'); G.fx!.dust(p.pos, 6); if (p.airAttack) { p.airAttack = false; meleeHit(3.2, 360, 1.6, { kb: 6, st: 20, heavy: true }); G.fx!.ring(p.pos, 3.5, styleOf().color, 0.4); rt.shake = 0.4; } } p.onGround = true; p.vy = 0; }
    else p.onGround = false;
  } else { p.pos.y = damp(p.pos.y, gy, 25, dt); p.onGround = true; p.airAttack = false; }
  if (p.state !== 'skill') (p as unknown as { _ly: number })._ly = 0;
  resolveCollisions(p.pos, 0.45);
  // sync model
  const m = p.model!; m.group.position.copy(p.pos); m.group.rotation.y = p.yaw; m.update(dt, rt.time);
  void faceDesired; void healPlayer; void hurtPlayer; void rand;
}

export function resolveCollisions(pos: THREE.Vector3, r: number) {
  for (const c of rt.colliders) { const dx = pos.x - c.x; const dz = pos.z - c.z; const rr = r + c.r; const d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 0.00001) { const d = Math.sqrt(d2); pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr; } }
  const b = rt.bounds; const nx = pos.x / b.hx; const nz = pos.z / b.hz; const n2 = nx * nx + nz * nz; if (n2 > 1) { const s = 1 / Math.sqrt(n2); pos.x *= s; pos.z *= s; }
}
