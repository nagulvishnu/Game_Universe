import type { Element, Form, Status } from '../types';
import { rt, nextId, bump, type EnemyRT, type Projectile, yawTo, angleDiff } from '../runtime';
import { calcDamage, calcIncoming, elementMultiplier } from '../logic/stats';
import { burst, ring, dust } from './fx';
import { audio } from '../audio';
import { bus } from '../bus';
import { useGame } from '../store';
import { pushToast, showBanner } from '../hudStore';
import { ITEMS } from '../data/items';
import { segmentHitsWall } from '../logic/collision';

export const ELEMENT_COLOR: Record<Element, string> = { none: '#ffffff', fire: '#ff7a2a', lightning: '#b9d6ff', wind: '#c8fff0', water: '#4aa8ff', earth: '#d2a273' };
export const FORM_MUL: Record<Form, { atk: number; def: number; speed: number; range: number }> = {
  base: { atk: 1, def: 1, speed: 1, range: 0 }, sage: { atk: 1.35, def: 1.2, speed: 1.05, range: 1.1 }, kurama: { atk: 1.6, def: 1.3, speed: 1.2, range: 0.6 },
};

export function floater(x: number, y: number, z: number, text: string, color = '#fff', size = 1) {
  if (rt.floaters.length > 28) rt.floaters.shift();
  rt.floaters.push({ id: nextId(), text, x, y, z, t: 0, color, size, vy: 1.6 });
}
export function shake(a: number) { rt.shake = Math.min(1.6, Math.max(rt.shake, a)); }
export function hitStop(t: number) { rt.hitStop = Math.max(rt.hitStop, t); }
export function schedule(t: number, fn: () => void) { rt.sched.push({ t, fn }); }

export function playerAtk(jutsu: boolean): number {
  const p = rt.player; const m = p.stats.mods;
  let a = p.stats.atk * FORM_MUL[p.form].atk * (1 + (p.buff.t > 0 ? p.buff.dmg : 0));
  a *= jutsu ? (1 + m.dmgJutsu) * (p.focusT > 0 ? 1.3 : 1) : 1 + m.dmgPhys;
  return a;
}

export interface HitOpts {
  power: number; element?: Element; knock?: number; stagger?: number; status?: Status; statusDur?: number; jutsu?: boolean;
  source?: 'player' | 'ally' | 'dot' | 'kunai'; fromX?: number; fromZ?: number; heavy?: boolean; atk?: number; noUlt?: boolean; finisher?: boolean; quiet?: boolean;
}

export function applyStatus(e: EnemyRT, s: Status, dur: number) {
  if (e.def.tier === 'dummy') return;
  const resist = e.def.tier === 'boss' ? 0.35 : e.def.tier === 'elite' ? 0.65 : 1;
  const d = dur * resist;
  e.status[s] = Math.max(e.status[s], d);
  if (s === 'stun' && e.state !== 'dead') {
    if (e.def.tier === 'boss' && (e.state === 'windup' || e.state === 'phase')) return;
    e.state = 'hit'; e.stateT = 0; e.pattern = null; e.pose.state = 'stun';
  }
}

export function hitEnemy(e: EnemyRT, o: HitOpts): number {
  if (e.state === 'dead' || e.invuln > 0 || e.vanish > 0.3) return 0;
  const p = rt.player; const src = o.source ?? 'player';
  const light = !o.jutsu && !o.heavy && o.power <= 1.6 && src === 'player';
  const fx = o.fromX ?? p.pos.x, fz = o.fromZ ?? p.pos.z;
  let dx = e.pos.x - fx, dz = e.pos.z - fz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  e.aggro = true;
  // defensive reactions
  if (light && (e.state === 'chase' || e.state === 'alert' || e.state === 'patrol' || e.state === 'recover')) {
    if (e.def.dodgeChance && e.dodgeCd <= 0 && Math.random() < e.def.dodgeChance) {
      e.dodgeCd = 2.2; e.vel.x = -dz * 9 * (Math.random() < 0.5 ? 1 : -1); e.vel.z = dx * 9;
      floater(e.pos.x, e.pos.y + 2.4, e.pos.z, 'MISS', '#9ad', 0.9); burst(e.pos.x, 0.5, e.pos.z, { n: 6, color: '#cfd8e8', speed: 2, life: 0.3 });
      return 0;
    }
    if (e.def.blockChance && e.blockCd <= 0 && Math.random() < e.def.blockChance) {
      e.blockCd = 1.5; audio.sfx('block'); floater(e.pos.x, e.pos.y + 2.4, e.pos.z, 'BLOCKED', '#aaa', 0.9);
      burst(e.pos.x, 1.2, e.pos.z, { n: 6, color: '#fff', speed: 3, life: 0.2 }); e.vel.x += dx * 2; e.vel.z += dz * 2; e.poise -= 4;
      return 0;
    }
  }
  const atk = o.atk ?? playerAtk(!!o.jutsu);
  const critChance = src === 'player' ? p.stats.crit + (p.counterT > 0 ? 0.35 : 0) : 0.05;
  const crit = Math.random() < critChance;
  const em = elementMultiplier(o.element ?? 'none', e.def.element, src === 'player' ? p.stats.mods.elementBonus : 0);
  const counterBonus = src === 'player' && p.counterT > 0 && !o.jutsu ? 0.5 : 0;
  const confusedBonus = e.status.confuse > 0 ? 0.25 : 0;
  let dmg = calcDamage({ atk, power: o.power, defense: e.def.def + e.lv * 0.6, elemMult: em, crit, bonus: counterBonus + confusedBonus, variance: 0.92 + Math.random() * 0.16 });
  if (e.def.tier === 'dummy') dmg = Math.max(8, Math.round(dmg * 0.5));
  // sand shield etc.
  if (e.shield > 0) {
    e.shield -= dmg; floater(e.pos.x, e.pos.y + 2.8, e.pos.z, 'SHIELD', '#e0c07a', 0.9);
    burst(e.pos.x, 1.4, e.pos.z, { n: 8, color: '#e6c887', speed: 4, life: 0.3 }); audio.sfx('block');
    if (e.shield > 0) return 0; dmg = Math.round(-e.shield); e.shield = 0; e.shieldT = 0;
    floater(e.pos.x, e.pos.y + 3, e.pos.z, 'SHIELD BROKEN', '#ffd', 1.1);
  }
  e.hp -= dmg; e.flash = 1; e.pose.flash = 1; e.pose.flashColor = '#ffffff';
  const col = crit ? '#ffe14a' : em > 1.01 ? '#ff9a4a' : em < 0.99 ? '#9aa' : '#ffffff';
  floater(e.pos.x + (Math.random() - 0.5) * 0.6, e.pos.y + 2.3, e.pos.z, `${dmg}${crit ? '!' : ''}`, col, crit || o.heavy ? 1.4 : 1);
  if (em > 1.01 && !o.quiet) floater(e.pos.x, e.pos.y + 3, e.pos.z, 'EFFECTIVE', '#ff9a4a', 0.7);
  burst(e.pos.x, 1.2, e.pos.z, { n: o.heavy ? 14 : 7, color: ELEMENT_COLOR[o.element ?? 'none'], color2: '#ffffff', speed: o.heavy ? 6 : 4, life: 0.35, size: 0.2 });
  if (!o.quiet) { audio.sfx(crit ? 'crit' : o.heavy ? 'heavy' : 'hit'); }
  if (src === 'player') {
    hitStop(o.heavy || o.finisher ? 0.08 : 0.035); shake(o.heavy ? 0.35 : 0.14);
    if (!o.noUlt) p.ult = Math.min(100, p.ult + dmg * 0.06 * (1 + p.stats.mods.ult));
    rt.comboCount++; rt.comboTimer = 2.4;
  }
  // knockback & poise
  const tierK = e.def.tier === 'boss' ? 0.12 : e.def.tier === 'elite' ? 0.45 : 1;
  const kn = (o.knock ?? 3) * tierK;
  if (e.def.tier !== 'dummy') { e.vel.x += dx * kn; e.vel.z += dz * kn; }
  e.poise -= o.stagger ?? o.power * 10;
  if (o.status) applyStatus(e, o.status, o.statusDur ?? 2);
  if (e.poise <= 0 && e.def.tier !== 'dummy') {
    e.poise = e.def.poise;
    const protectedBoss = e.def.tier === 'boss' && (e.state === 'windup' || e.state === 'attack' || e.state === 'phase');
    if (!protectedBoss) { e.state = 'hit'; e.stateT = 0; e.pattern = null; e.pose.state = 'hit'; e.pose.t = 0; e.atk.dashT = 0; }
  }
  if (e.def.tier === 'dummy') { e.pose.state = 'hit'; e.pose.t = 0; e.stateT = 0; e.state = 'hit'; }
  // phase thresholds for bosses
  if (e.def.phases && e.hp > 0) {
    const frac = e.hp / e.maxHp; const ph = e.def.phases.filter((t) => frac <= t).length;
    if (ph > e.phase) { e.phase = ph; bus.emit('bossPhase', e); }
  }
  if (e.hp <= 0) killEnemy(e);
  return dmg;
}

export function killEnemy(e: EnemyRT) {
  if (e.state === 'dead') return;
  e.hp = 0; e.state = 'dead'; e.deadT = 0; e.pose.state = 'dead'; e.pose.t = 0; e.status.burn = 0; e.pattern = null;
  e.vel.x *= 0.3; e.vel.z *= 0.3;
  if (rt.lock === e) rt.lock = null;
  burst(e.pos.x, 1, e.pos.z, { n: 18, color: '#ffffff', color2: '#cfd8e8', speed: 5, life: 0.6 });
  audio.sfx('defeat');
  const g = useGame.getState();
  if (e.def.xp > 0) g.gainXp(Math.round(e.def.xp * (1 + (e.lv - 1) * 0.08)), true);
  if (e.def.ryo > 0) { const ryo = Math.round(e.def.ryo * rt.player.stats.ryoMul * (1 + (e.lv - 1) * 0.05)); g.patchProfile((p) => ({ ryo: p.ryo + ryo, kills: p.kills + 1 })); floater(e.pos.x, 3, e.pos.z, `+${ryo} ryo`, '#ffd24a', 0.8); }
  else g.patchProfile((p) => ({ kills: p.kills + 1 }));
  e.def.drops?.forEach((d) => { if (Math.random() <= d.chance && ITEMS[d.item]) g.addItem(d.item, d.n ?? 1); });
  if (e.def.tier !== 'dummy') p_ult(6);
  bus.emit('mission', { t: 'kill', def: e.def.id, tag: e.tag });
  if (e.def.tier === 'boss') bus.emit('bossDefeated', e);
  if (e.camp) bus.emit('campProgress', e);
  bump('enemies');
}
const p_ult = (n: number) => { rt.player.ult = Math.min(100, rt.player.ult + n); };

export function healPlayer(n: number, quiet = false) {
  const p = rt.player; if (p.dead) return;
  const h = Math.min(n, p.stats.maxHp - p.hp); if (h <= 0) return;
  p.hp += h; if (!quiet) floater(p.pos.x, p.pos.y + 2.6, p.pos.z, `+${Math.round(h)}`, '#7cffb0', 1);
  burst(p.pos.x, 1.2, p.pos.z, { n: 8, color: '#7cffb0', speed: 2, life: 0.6, up: 2 });
}

export interface PlayerHitOpts { unblockable?: boolean; element?: Element; src?: EnemyRT; confuse?: number; stagger?: boolean; ignoreDodge?: boolean }
/** Resolves an incoming attack against the player (dodge i-frames, guard, parry, auto-substitution). */
export function damagePlayer(raw: number, fromX: number, fromZ: number, o: PlayerHitOpts = {}): boolean {
  const p = rt.player; if (p.dead || rt.cine?.freeze) return false;
  if (p.invuln > 0) {
    if (p.action?.kind === 'dodge' && !p.perfectDodgeUsed && !o.ignoreDodge) {
      p.perfectDodgeUsed = true; p.chakra = Math.min(p.stats.maxChakra, p.chakra + 15); p.ult = Math.min(100, p.ult + 8);
      rt.slowT = 0.6; floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'PERFECT DODGE', '#8ff', 1.3); audio.sfx('parry');
      burst(p.pos.x, 1, p.pos.z, { n: 14, color: '#8ff', speed: 5, life: 0.4 });
    }
    return false;
  }
  let guard = 1;
  const toAttacker = yawTo(fromX - p.pos.x, fromZ - p.pos.z);
  if (p.blocking && !o.unblockable && Math.abs(angleDiff(p.yaw, toAttacker)) < 1.9) {
    const window = 0.22 + p.stats.mods.parry;
    if (p.blockT < window) {
      guard = 0; rt.slowT = 0.35; audio.sfx('parry'); floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'PARRY!', '#ffe14a', 1.3);
      burst(p.pos.x + Math.sin(p.yaw), 1.3, p.pos.z + Math.cos(p.yaw), { n: 18, color: '#ffe14a', color2: '#fff', speed: 6, life: 0.4 });
      ring(p.pos.x, 1.2, p.pos.z, { color: '#ffe14a', r1: 3, life: 0.35 });
      p.counterT = 3; p.ult = Math.min(100, p.ult + 10);
      if (o.src && o.src.state !== 'dead') { applyStatus(o.src, 'stun', 1.0); o.src.state = 'hit'; o.src.stateT = 0; o.src.pattern = null; o.src.poise = o.src.def.poise; floater(o.src.pos.x, 2.8, o.src.pos.z, 'STAGGERED', '#ffe14a', 0.9); }
      return false;
    }
    guard = 0.25; audio.sfx('block'); p.stamina = Math.max(0, p.stamina - raw * 0.5);
    burst(p.pos.x + Math.sin(p.yaw), 1.3, p.pos.z + Math.cos(p.yaw), { n: 7, color: '#fff', speed: 3, life: 0.2 });
    if (p.stamina <= 0) { p.blocking = false; p.stunT = 0.7; floater(p.pos.x, p.pos.y + 2.6, p.pos.z, 'GUARD BROKEN', '#f66', 1); }
  }
  const def = p.stats.def * FORM_MUL[p.form].def * (1 + (p.buff.t > 0 ? p.buff.def : 0));
  const dmg = calcIncoming(raw, def, guard);
  if (p.hp - dmg <= 0 && p.stats.mods.autoSub > 0 && p.autoSubCd <= 0) {
    p.autoSubCd = 60; floater(p.pos.x, p.pos.y + 2.8, p.pos.z, 'LAST STAND SUBSTITUTION!', '#ffd', 1.1);
    bus.emit('autoSub'); return false;
  }
  p.hp -= dmg; p.pose.flash = 1; p.pose.flashColor = '#ff2200'; p.staminaDelay = 1;
  floater(p.pos.x, p.pos.y + 2.4, p.pos.z, `-${dmg}`, '#ff5a5a', 1.1); shake(guard < 1 ? 0.2 : 0.45); hitStop(0.05); audio.sfx(guard < 1 ? 'block' : 'hit');
  burst(p.pos.x, 1.2, p.pos.z, { n: 8, color: '#ff6a5a', speed: 4, life: 0.3 });
  p.ult = Math.min(100, p.ult + dmg * 0.03); p.lastTarget = rt.t;
  if (o.confuse) { p.confuseT = Math.max(p.confuseT, o.confuse); floater(p.pos.x, p.pos.y + 3, p.pos.z, 'GENJUTSU!', '#c070ff', 1.1); }
  if (p.charging) { p.charging = false; audio.charge(false); }
  if (p.hp <= 0) { bus.emit('playerDead'); return true; }
  if ((o.stagger || dmg > p.stats.maxHp * 0.07) && guard >= 1 && !(p.action?.kind === 'cast' && p.action.ability?.ult)) {
    p.action = { kind: 'hit', t: 0, dur: 0.38, hitAt: 99, fired: true, idx: 0 }; p.dash = null; p.orb = null; p.queued = null;
    const a = Math.atan2(p.pos.x - fromX, p.pos.z - fromZ); p.vel.x = Math.sin(a) * 5; p.vel.z = Math.cos(a) * 5;
  }
  return true;
}

// ------------------------------------------------------------------ Area damage
export interface AreaOpts extends Omit<HitOpts, 'fromX' | 'fromZ'> { x: number; z: number; radius: number; cone?: { yaw: number; half: number } }
export function areaDamage(o: AreaOpts): number {
  let n = 0;
  for (const e of rt.enemies.slice()) {
    if (e.state === 'dead') continue;
    const d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z);
    if (d > o.radius + e.radius) continue;
    if (o.cone) { const a = yawTo(e.pos.x - o.x, e.pos.z - o.z); if (Math.abs(angleDiff(o.cone.yaw, a)) > o.cone.half && d > 1.2) continue; }
    // falloff keeps big blasts readable: edge targets take 70%
    const fall = 1 - 0.3 * Math.min(1, d / Math.max(0.1, o.radius));
    if (hitEnemy(e, { ...o, power: o.power * fall, fromX: o.x, fromZ: o.z, quiet: n > 0 }) >= 0) n++;
  }
  return n;
}

export function explosion(x: number, y: number, z: number, radius: number, color: string, big = false) {
  ring(x, 0.2, z, { color, r0: 0.5, r1: radius, life: big ? 0.7 : 0.45 });
  ring(x, y, z, { color: '#ffffff', r0: 0.3, r1: radius * 0.6, life: 0.3 });
  burst(x, y, z, { n: big ? 70 : 28, color, color2: '#ffffff', speed: radius * (big ? 2.6 : 2.2), life: big ? 1 : 0.6, size: big ? 0.5 : 0.32, spread: 1.4, grav: 2 });
  dust(x, 0, z, big ? 14 : 6);
  audio.sfx('explode', Math.min(1, 0.4 + radius / 14)); shake(big ? 1.1 : 0.45);
  if (big) { rt.flash = 0.8; rt.flashColor = color; }
}

// ------------------------------------------------------------------ Projectiles
export function spawnProjectile(p: Partial<Projectile> & { x: number; y: number; z: number; vx: number; vz: number; dmg: number }): Projectile {
  const pr: Projectile = {
    id: nextId(), vy: 0, life: 2, radius: 0.8, explode: 0, element: 'none', hostile: false, pierce: false, size: 0.5, color: '#fff', hit: new Set(),
    kind: 'orb', spin: 0, lingering: false, grav: 0, ...p,
  };
  if (rt.projectiles.length > 48) rt.projectiles.shift();
  rt.projectiles.push(pr);
  return pr;
}

function detonate(pr: Projectile) {
  const r = pr.explode;
  explosion(pr.x, Math.max(0.6, pr.y), pr.z, r, pr.color, !!pr.big);
  if (pr.hostile) {
    const p = rt.player; if (Math.hypot(p.pos.x - pr.x, p.pos.z - pr.z) < r) damagePlayer(pr.dmg, pr.x, pr.z, { element: pr.element, confuse: pr.confuse ? 4 : 0, stagger: true });
  } else {
    areaDamage({ x: pr.x, z: pr.z, radius: r, power: pr.dmg, element: pr.element, knock: 8, stagger: 40, status: pr.status, statusDur: pr.statusDur, jutsu: true, heavy: true });
    if (pr.lingering) rt.dots.push({ x: pr.x, z: pr.z, r: r * 0.85, t: 0, dur: 1.5, dps: pr.dmg * 0.55, tick: 0, element: pr.element, color: pr.color });
  }
}

export function updateProjectiles(dt: number) {
  const p = rt.player;
  for (let i = rt.projectiles.length - 1; i >= 0; i--) {
    const pr = rt.projectiles[i];
    const ox = pr.x, oz = pr.z;
    pr.vy -= pr.grav * dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt; pr.life -= dt; pr.spin += dt * 14;
    let remove = false;
    if (pr.life <= 0) { if (pr.explode > 0) detonate(pr); remove = true; }
    else if (pr.y <= 0.15 && pr.grav > 0) { if (pr.explode > 0) detonate(pr); remove = true; }
    else if (segmentHitsWall(rt.colliders, ox, oz, pr.x, pr.z, pr.y)) { if (pr.explode > 0) detonate(pr); else burst(pr.x, pr.y, pr.z, { n: 6, color: pr.color, speed: 3, life: 0.3 }); remove = true; }
    else if (pr.hostile) {
      for (const a of rt.allies) {
        if (a.kind !== 'clone') continue;
        if (Math.hypot(a.pos.x - pr.x, a.pos.z - pr.z) < pr.radius + 0.6) { a.life = 0; burst(a.pos.x, 1, a.pos.z, { n: 14, color: '#fff', speed: 3 }); remove = true; if (pr.explode > 0) detonate(pr); break; }
      }
      if (!remove && !p.dead && Math.hypot(p.pos.x - pr.x, p.pos.z - pr.z) < pr.radius + 0.55 && pr.y < p.pos.y + 2.4 && pr.y > p.pos.y - 0.4) {
        if (pr.explode > 0) detonate(pr); else damagePlayer(pr.dmg, pr.x - pr.vx, pr.z - pr.vz, { element: pr.element, confuse: pr.confuse ? 4 : 0, stagger: true });
        remove = true;
      }
    } else {
      for (const e of rt.enemies) {
        if (e.state === 'dead' || pr.hit.has(e.id) || e.vanish > 0.3) continue;
        if (Math.hypot(e.pos.x - pr.x, e.pos.z - pr.z) < pr.radius + e.radius && pr.y < 3.6) {
          pr.hit.add(e.id);
          if (pr.explode > 0) { detonate(pr); remove = true; break; }
          hitEnemy(e, { power: pr.dmg, element: pr.element, knock: 4, jutsu: pr.kind !== 'kunai', source: pr.kind === 'kunai' ? 'kunai' : 'player', status: pr.status, statusDur: pr.statusDur, fromX: pr.x - pr.vx, fromZ: pr.z - pr.vz, stagger: pr.kind === 'kunai' ? 6 : 14 });
          if (!pr.pierce) { remove = true; break; }
        }
      }
    }
    if (!remove && Math.random() < 0.8) {
      // trails are emitted by the renderer for tidiness; here only the heavy ones add chakra sparks
      if (pr.big) burst(pr.x, pr.y, pr.z, { n: 2, color: pr.color, speed: 1, life: 0.5, size: 0.4 });
    }
    if (remove) rt.projectiles.splice(i, 1);
  }
}

export function updateDots(dt: number) {
  for (let i = rt.dots.length - 1; i >= 0; i--) {
    const d = rt.dots[i]; d.t += dt; d.tick -= dt;
    if (d.tick <= 0) {
      d.tick = 0.3;
      burst(d.x + (Math.random() - 0.5) * d.r, 0.6, d.z + (Math.random() - 0.5) * d.r, { n: 4, color: d.color, speed: 2, life: 0.4, up: 2 });
      for (const e of rt.enemies) if (e.state !== 'dead' && Math.hypot(e.pos.x - d.x, e.pos.z - d.z) < d.r) hitEnemy(e, { power: d.dps * 0.3, element: d.element, knock: 0, stagger: 2, source: 'dot', noUlt: true, quiet: true, jutsu: true });
    }
    if (d.t >= d.dur) rt.dots.splice(i, 1);
  }
}

export function toast(text: string, kind: 'info' | 'good' | 'warn' = 'info') { pushToast(text, kind); }
export { showBanner };
