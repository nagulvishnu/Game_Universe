import type { AbilityDef, Form } from '../types';
import { rt, nextId, bump, yawTo, angleDiff, type EnemyRT } from '../runtime';
import { ABILITIES } from '../data/abilities';
import { CHARACTERS } from '../data/characters';
import { ITEMS } from '../data/items';
import { useGame } from '../store';
import { audio } from '../audio';
import { bus } from '../bus';
import { burst, ring, dust, lineBurst } from './fx';
import { areaDamage, spawnProjectile, explosion, floater, shake, schedule, hitEnemy, applyStatus, ELEMENT_COLOR, playerAtk } from './combat';
import { spawnClone } from './allies';
import { moveXZ } from './move';
import { showBanner } from '../hudStore';

const CAST_TIME: Record<string, number> = { clone: 0.4, dashStrike: 0.5, projectile: 0.45, aoe: 0.4, summon: 0.8, buff: 0.5, genjutsu: 0.45, barrage: 0.3, substitution: 0 };

export const dirOf = (yaw: number) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

export function ultFor(): AbilityDef | undefined {
  const p = rt.player; const ch = CHARACTERS[p.charId];
  const id = (ch.ultimates as Record<string, string | undefined>)[p.form] ?? ch.ultimates.base;
  return ABILITIES[id];
}
export function abilityCost(a: AbilityDef): number {
  const p = rt.player; let c = a.cost;
  if (a.kind === 'substitution') c *= 1 - p.stats.mods.subCost;
  if (p.form === 'kurama') c *= 0.85;
  return Math.round(c);
}
export function cooldownOf(a: AbilityDef): number {
  const p = rt.player; return a.cooldown * (1 - Math.min(0.5, p.stats.mods.cdr)) * (p.form === 'kurama' ? 0.8 : 1);
}

/** Lock-on target first, else the nearest enemy in front of the player. */
export function pickTarget(range: number, frontOnly = true): EnemyRT | null {
  const p = rt.player;
  if (rt.lock && rt.lock.state !== 'dead' && Math.hypot(rt.lock.pos.x - p.pos.x, rt.lock.pos.z - p.pos.z) < range * 1.4) return rt.lock;
  let best: EnemyRT | null = null; let bs = 1e9;
  for (const e of rt.enemies) {
    if (e.state === 'dead' || e.vanish > 0.3) continue;
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; const d = Math.hypot(dx, dz);
    if (d > range) continue;
    const ang = Math.abs(angleDiff(p.yaw, yawTo(dx, dz)));
    if (frontOnly && ang > 1.3 && d > 3) continue;
    const score = d + ang * 3; if (score < bs) { bs = score; best = e; }
  }
  return best;
}

export function tryCast(a: AbilityDef): boolean {
  const p = rt.player;
  if (p.dead || p.stunT > 0 || rt.cine?.freeze) return false;
  const act = p.action;
  if (act && (act.kind === 'hit' || act.kind === 'dead' || act.kind === 'dodge' || act.kind === 'cast' || act.kind === 'sub')) return false;
  if (act && (act.kind === 'light' || act.kind === 'heavy' || act.kind === 'air') && act.t < act.hitAt) return false;
  if (p.dash) return false;
  if ((p.cd[a.id] ?? 0) > 0) { audio.sfx('error', 0.6); return false; }
  const cost = abilityCost(a);
  if (a.ult && p.ult < 100) { floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'ULTIMATE GAUGE NOT FULL', '#ffb84a', 0.8); audio.sfx('error', 0.6); return false; }
  if (p.chakra < cost) { floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'NOT ENOUGH CHAKRA', '#6ab0ff', 0.9); audio.sfx('error', 0.6); return false; }
  if (a.kind === 'substitution') return doSubstitution(false);
  p.chakra -= cost; p.cd[a.id] = cooldownOf(a); p.charging = false; audio.charge(false);
  p.blocking = false; p.queued = null;
  const ct = a.castTime ?? CAST_TIME[a.kind] ?? 0.4;
  p.action = { kind: 'cast', t: 0, dur: ct + 0.32, hitAt: ct, fired: false, idx: 0, ability: a };
  const t = a.kind === 'dashStrike' || a.kind === 'projectile' || a.kind === 'barrage' ? pickTarget(a.range ?? 18) : null;
  if (t) p.yaw = yawTo(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
  if (a.kind === 'dashStrike' || (a.kind === 'projectile' && (a.size ?? 0) >= 0.9)) p.orb = { color: a.color, size: (a.size ?? 0.7) * (a.kind === 'projectile' ? 0.55 : 0.5), blades: a.id.includes('huriken') || a.id === 'superRasenshuriken' };
  audio.sfx(a.element === 'fire' ? 'fire' : a.element === 'lightning' ? 'lightning' : a.element === 'water' ? 'water' : a.element === 'wind' ? 'wind' : a.id.includes('rasengan') || a.id.includes('Rasengan') ? 'rasengan' : 'jutsu');
  if (a.ult) {
    audio.sfx('ult'); rt.slowT = 0.5;
    rt.cine = { kind: 'ult', t: 0, dur: ct + 0.7, tx: p.pos.x, ty: 1.4, tz: p.pos.z, radius: 5.2, height: 1.6, speed: 0.9, freeze: false, startYaw: p.yaw + Math.PI * 0.75 };
    showBanner(a.name, CHARACTERS[p.charId].name, 1800);
  }
  return true;
}

/** Executes the ability once its cast time has elapsed. */
export function fireAbility(a: AbilityDef) {
  const p = rt.player; const d = dirOf(p.yaw); const jut = a.element !== 'none' || a.kind !== 'clone';
  if (a.ult) p.ult = 0;
  bus.emit('mission', { t: 'ability', id: a.id });
  const color = a.color;
  switch (a.kind) {
    case 'clone': {
      const n = (a.count ?? 3) + p.stats.mods.cloneCount; const life = (a.duration ?? 12) + p.stats.mods.cloneTime;
      for (let i = 0; i < n; i++) { const ang = p.yaw + (i - (n - 1) / 2) * 0.95; const x = p.pos.x + Math.sin(ang) * 2.4, z = p.pos.z + Math.cos(ang) * 2.4; spawnClone(x, z, CHARACTERS[p.charId].look, life, a.power, a.id === 'kakashiClones'); }
      audio.sfx('clone'); shake(0.2); break;
    }
    case 'dashStrike': {
      const t = pickTarget(a.range ?? 14);
      let dirYaw = p.yaw; let dist = (a.range ?? 14) * 0.55;
      if (t) { const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z; dirYaw = yawTo(dx, dz); dist = Math.max(0.5, Math.hypot(dx, dz) - 1.8); }
      dist = Math.min(dist, a.range ?? 14); p.yaw = dirYaw; const dd = dirOf(dirYaw);
      const dur = 0.22; p.dash = { t: 0, dur, dx: (dd.x * dist) / dur, dz: (dd.z * dist) / dur, ability: a };
      p.invuln = Math.max(p.invuln, 0.35); lineBurst(p.pos.x, p.pos.z, p.pos.x + dd.x * dist, p.pos.z + dd.z * dist, 1.2, color, 14);
      break;
    }
    case 'projectile': {
      const n = a.count ?? 1; const spread = a.spread ?? 0; const t = pickTarget(a.range ?? 30);
      let base = p.yaw; if (t) base = yawTo(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
      p.yaw = base;
      for (let i = 0; i < n; i++) {
        const ang = base + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0); const dd = dirOf(ang); const sp = a.speed ?? 20; const size = a.size ?? 0.6;
        const big = size >= 1.2;
        spawnProjectile({
          x: p.pos.x + dd.x * 0.9, y: p.pos.y + (big ? 1.6 : 1.3), z: p.pos.z + dd.z * 0.9, vx: dd.x * sp, vz: dd.z * sp, dmg: a.power * (jut ? 1 : 1), life: (a.range ?? 30) / sp,
          radius: 0.5 + size * (big ? 0.8 : 1.0), explode: a.radius && a.radius >= 3 ? a.radius : 0, element: a.element, pierce: !!a.pierce, size, color, status: a.status, statusDur: a.statusDur,
          kind: a.id.includes('huriken') ? 'shuriken' : a.id.includes('Bomb') ? 'bomb' : a.pierce ? 'blade' : 'orb', lingering: a.id.includes('huriken'), big, source: a.id,
        });
      }
      p.orb = null; shake(0.2); break;
    }
    case 'aoe': {
      const cx = p.pos.x + d.x * (a.range ?? 0), cz = p.pos.z + d.z * (a.range ?? 0);
      aoeVfx(a, cx, cz);
      areaDamage({ x: cx, z: cz, radius: a.radius ?? 5, power: a.power, element: a.element, knock: 8, stagger: 40, status: a.status, statusDur: a.statusDur, jutsu: a.category !== 'taijutsu', heavy: true });
      break;
    }
    case 'summon': {
      const cx = p.pos.x + d.x * (a.range ?? 9), cz = p.pos.z + d.z * (a.range ?? 9);
      rt.summon = { t: 0, dur: 2.2, x: cx, z: cz, kind: a.visual ?? 'toad', color, fired: false };
      audio.sfx('summon'); shake(0.5);
      ring(cx, 0.2, cz, { color, r1: (a.radius ?? 9) * 0.9, life: 1.0 });
      schedule(0.75, () => {
        explosion(cx, 1, cz, a.radius ?? 9, color, true);
        areaDamage({ x: cx, z: cz, radius: a.radius ?? 9, power: a.power, element: a.element, knock: 12, stagger: 80, status: a.status, statusDur: a.statusDur, jutsu: true, heavy: true });
        if (a.element === 'fire') rt.dots.push({ x: cx, z: cz, r: (a.radius ?? 9) * 0.8, t: 0, dur: 3, dps: a.power * 0.5, tick: 0, element: 'fire', color: '#ff8a2a' });
      });
      break;
    }
    case 'buff': {
      const b = a.buff ?? {};
      if (b.heal) { const h = p.stats.maxHp * b.heal; p.hp = Math.min(p.stats.maxHp, p.hp + h); floater(p.pos.x, p.pos.y + 2.6, p.pos.z, `+${Math.round(h)}`, '#7cffb0', 1.2); }
      if (b.dmg || b.def || b.speed) p.buff = { dmg: b.dmg ?? 0, def: b.def ?? 0, speed: b.speed ?? 0, t: a.duration ?? 10 };
      ring(p.pos.x, 0.3, p.pos.z, { color, r1: 3, life: 0.6 }); burst(p.pos.x, 1, p.pos.z, { n: 28, color, color2: '#fff', speed: 3, up: 3, life: 0.9, grav: -1 });
      audio.sfx('levelup', 0.5); break;
    }
    case 'genjutsu': {
      let n = 0;
      for (const e of rt.enemies) {
        if (e.state === 'dead' || Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > (a.radius ?? 9)) continue;
        applyStatus(e, 'confuse', a.duration ?? 4.5); applyStatus(e, 'stun', 0.5); n++;
        burst(e.pos.x, 2.6, e.pos.z, { n: 10, color, speed: 2, up: 2, life: 0.8 }); floater(e.pos.x, 3, e.pos.z, 'ILLUSION', color, 0.9);
      }
      ring(p.pos.x, 1, p.pos.z, { color, r1: a.radius ?? 9, life: 0.7 }); burst(p.pos.x, 1.2, p.pos.z, { n: 30, color, color2: '#fff', speed: 5, life: 0.8 });
      if (!n) floater(p.pos.x, p.pos.y + 2.8, p.pos.z, 'No targets...', '#ccc', 0.8);
      break;
    }
    case 'barrage': {
      const t = pickTarget(a.range ?? 20, false);
      const cx = t ? t.pos.x : p.pos.x + d.x * 3, cz = t ? t.pos.z : p.pos.z + d.z * 3;
      if (t) { const ang = yawTo(cx - p.pos.x, cz - p.pos.z); p.pos.x = cx - Math.sin(ang) * 2.2; p.pos.z = cz - Math.cos(ang) * 2.2; moveXZ(p.pos, 0, 0, 0.45); p.yaw = ang; }
      p.invuln = Math.max(p.invuln, 0.2 + (a.count ?? 8) * 0.1);
      const n = a.count ?? 8;
      if (t) t.status.stun = Math.max(t.status.stun, 0.1);
      for (let i = 0; i < n; i++) {
        schedule(i * 0.1, () => {
          const ang = Math.random() * Math.PI * 2; const rx = cx + Math.cos(ang) * 2.4, rz = cz + Math.sin(ang) * 2.4;
          burst(rx, 1.2, rz, { n: 5, color: '#fff', speed: 2, life: 0.3 }); lineBurst(rx, rz, cx, cz, 1.3, color, 6);
          areaDamage({ x: cx, z: cz, radius: a.radius ?? 3.5, power: a.power * (i === n - 1 ? 2.2 : 1), element: a.element, knock: i === n - 1 ? 12 : 0.5, stagger: i === n - 1 ? 60 : 4, jutsu: false, heavy: i === n - 1, status: i === n - 1 ? a.status : undefined, statusDur: a.statusDur, noUlt: false, quiet: i !== n - 1 });
          audio.sfx(i === n - 1 ? 'heavy' : 'hit', 0.7);
          if (i === n - 1) { explosion(cx, 1.2, cz, 4.5, color); ring(cx, 1.2, cz, { color: '#fff', r1: 5, life: 0.4 }); }
        });
      }
      break;
    }
    default: break;
  }
  if (a.kind !== 'dashStrike') p.orb = null;
}

function aoeVfx(a: AbilityDef, cx: number, cz: number) {
  const r = a.radius ?? 5; const col = a.color;
  if (a.visual === 'lightning') {
    for (let i = 0; i < 7; i++) {
      const ang = Math.random() * 6.28, rr = Math.random() * r * 0.9; const x = cx + Math.cos(ang) * rr, z = cz + Math.sin(ang) * rr;
      for (let h = 0; h < 14; h++) burst(x, h * 1.1, z, { n: 1, color: i % 2 ? '#ffffff' : col, speed: 0.4, life: 0.4, size: 0.4 });
      ring(x, 0.2, z, { color: col, r1: 2, life: 0.3 });
    }
    audio.sfx('lightning'); rt.flash = Math.max(rt.flash, a.ult ? 0.8 : 0.4); rt.flashColor = '#cfe0ff'; shake(a.ult ? 1 : 0.5);
  } else if (a.visual === 'sand') {
    for (let i = 0; i < 12; i++) { const ang = Math.random() * 6.28, rr = Math.random() * r * 0.9; const x = cx + Math.cos(ang) * rr, z = cz + Math.sin(ang) * rr; for (let h = 0; h < 6; h++) burst(x, h * 0.7, z, { n: 2, color: col, speed: 0.8, life: 0.8, size: 0.5 }); }
    ring(cx, 0.2, cz, { color: col, r0: r, r1: 0.5, life: 0.6 }); audio.sfx('heavy'); shake(0.5); dust(cx, 0, cz, 14, col);
  } else if (a.visual === 'blossom') {
    burst(cx, 0.6, cz, { n: 40, color: col, color2: '#ffffff', speed: r * 1.3, up: 3, life: 0.9, grav: 3, size: 0.3 }); ring(cx, 0.2, cz, { color: col, r1: r, life: 0.5 });
    ring(cx, 0.3, cz, { color: '#fff', r1: r * 0.6, life: 0.35 }); dust(cx, 0, cz, 10); audio.sfx('heavy'); shake(a.ult ? 1 : 0.55);
  } else {
    explosion(cx, 1, cz, r, ELEMENT_COLOR[a.element] === '#ffffff' ? col : col, !!a.ult);
  }
}

/** Impact at the end of a Rasengan/Chidori style dash. */
export function finishDash() {
  const p = rt.player; const dsh = p.dash; if (!dsh) return; const a = dsh.ability;
  const d = dirOf(p.yaw); const cx = p.pos.x + d.x * 1.5, cz = p.pos.z + d.z * 1.5;
  let power = a.power; if (a.id === 'giantRasengan' && rt.allies.some((x) => x.kind === 'clone')) power *= 1.35;
  const big = (a.radius ?? 3) >= 6 || !!a.ult;
  explosion(cx, 1.2, cz, a.radius ?? 3, a.color, big);
  burst(cx, 1.3, cz, { n: 24, color: a.color, color2: '#ffffff', speed: 7, life: 0.5 });
  areaDamage({ x: cx, z: cz, radius: a.radius ?? 3, power, element: a.element, knock: 11, stagger: 90, status: a.status, statusDur: a.statusDur, jutsu: true, heavy: true });
  p.dash = null; p.orb = null; p.vel.x = 0; p.vel.z = 0;
}

export function doSubstitution(auto: boolean): boolean {
  const p = rt.player; const a = ABILITIES.substitution;
  if (!auto) {
    if ((p.cd.substitution ?? 0) > 0) { audio.sfx('error', 0.6); return false; }
    const cost = abilityCost(a); if (p.chakra < cost) { floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'NOT ENOUGH CHAKRA', '#6ab0ff', 0.9); return false; }
    p.chakra -= cost; p.cd.substitution = cooldownOf(a) * (p.stats.mods.subCost > 0 ? 0.6 : 1);
  }
  rt.logs.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, t: 0 });
  burst(p.pos.x, 1, p.pos.z, { n: 22, color: '#ffffff', color2: '#c9a36a', speed: 4, life: 0.5, size: 0.4 }); audio.sfx('sub');
  let target: EnemyRT | null = null; let bd = 16;
  for (const e of rt.enemies) { if (e.state === 'dead') continue; const dd = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if (dd < bd) { bd = dd; target = e; } }
  if (target) { p.pos.x = target.pos.x - Math.sin(target.yaw) * 2.3; p.pos.z = target.pos.z - Math.cos(target.yaw) * 2.3; p.yaw = yawTo(target.pos.x - p.pos.x, target.pos.z - p.pos.z); }
  else { const d = dirOf(p.yaw); moveXZ(p.pos, -d.x * 5, -d.z * 5, 0.45); }
  moveXZ(p.pos, 0, 0, 0.45);
  p.invuln = Math.max(p.invuln, 0.7); p.counterT = 3; p.action = null; p.dash = null; p.orb = null; p.vel.x = p.vel.z = 0;
  burst(p.pos.x, 1, p.pos.z, { n: 14, color: '#ffffff', speed: 3, life: 0.4 });
  floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'SUBSTITUTION!', '#ffd89a', 1);
  return true;
}

export function throwKunai(): boolean {
  const p = rt.player;
  if (p.dead || p.action || (p.cd.kunai ?? 0) > 0) return false;
  if (!useGame.getState().removeItem('kunai', 1)) { floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'NO KUNAI', '#ccc', 0.8); return false; }
  p.cd.kunai = 0.4; const t = pickTarget(30); let ang = p.yaw; if (t) { ang = yawTo(t.pos.x - p.pos.x, t.pos.z - p.pos.z); p.yaw = ang; }
  const d = dirOf(ang);
  spawnProjectile({ x: p.pos.x + d.x * 0.8, y: p.pos.y + 1.3, z: p.pos.z + d.z * 0.8, vx: d.x * 40, vz: d.z * 40, dmg: 0.9, life: 0.75, radius: 0.5, size: 0.25, kind: 'kunai', color: '#d8e4f0', source: 'kunai' });
  p.action = { kind: 'light', t: 0, dur: 0.26, hitAt: 99, fired: true, idx: 1 };
  audio.sfx('kunai'); return true;
}

export function toggleForm(): boolean {
  const p = rt.player; if (p.dead || p.stunT > 0 || rt.cine) return false;
  const g = useGame.getState().profile; const c = g.chars[p.charId];
  if (p.charId !== 'naruto') { floater(p.pos.x, p.pos.y + 2.6, p.pos.z, `${CHARACTERS[p.charId].name} has no transformation`, '#ccc', 0.9); return false; }
  const sage = p.stats.mods.sage > 0 && c.level >= 6 && !!g.flags.sageTraining; const kur = p.stats.mods.kurama > 0 && c.level >= 10 && sage;
  const order: Form[] = ['base']; if (sage) order.push('sage'); if (kur) order.push('kurama');
  if (order.length === 1) { floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'No transformations unlocked (Skills → Transformation Mastery)', '#ffd', 0.9); return false; }
  const next = order[(order.indexOf(p.form) + 1) % order.length];
  if (next === 'base') { setForm('base'); return true; }
  const cost = next === 'sage' ? 40 : 60;
  if (p.chakra < cost) { floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'NOT ENOUGH CHAKRA', '#6ab0ff', 0.9); return false; }
  p.chakra -= cost; setForm(next); return true;
}

export function setForm(f: Form) {
  const p = rt.player; const prev = p.form; p.form = f;
  const m = p.stats.mods;
  p.formDur = f === 'base' ? 1 : (f === 'sage' ? 70 : 50) * (1 + m.formTime); p.formT = p.formDur;
  p.action = null; p.dash = null; p.orb = null;
  if (f === 'base') { burst(p.pos.x, 1, p.pos.z, { n: 20, color: '#ffffff', speed: 4 }); showBanner('Base Form', 'Power fades...', 1400); audio.sfx('back'); return; }
  const col = f === 'sage' ? '#ff9a3a' : '#ffc02e';
  p.invuln = 1.6;
  rt.cine = { kind: 'form', t: 0, dur: 1.7, tx: p.pos.x, ty: 1.4, tz: p.pos.z, radius: 4.6, height: 1.3, speed: 1.1, freeze: true, startYaw: p.yaw + Math.PI };
  audio.sfx('transform'); rt.flash = 0.7; rt.flashColor = col; shake(0.8);
  for (let i = 0; i < 4; i++) ring(p.pos.x, 0.2 + i * 0.5, p.pos.z, { color: col, r0: 0.4, r1: 5 + i, life: 0.7 + i * 0.15 });
  burst(p.pos.x, 1, p.pos.z, { n: 70, color: col, color2: '#ffffff', speed: 9, up: 3, life: 1.2, size: 0.4, grav: -1 });
  showBanner(f === 'sage' ? 'SAGE MODE' : 'KURAMA CHAKRA MODE', f === 'sage' ? 'Natural energy flows through you' : 'The Nine-Tails\' chakra cloaks you', 2600);
  void prev;
}

export function updateSummon(dt: number) {
  const s = rt.summon; if (!s) return; s.t += dt; if (s.t >= s.dur) rt.summon = null;
}
export { ITEMS, nextId, bump, hitEnemy, playerAtk, dust };
