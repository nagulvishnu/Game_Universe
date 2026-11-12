import { CAT_COL, FORMS, ITEM_MAP, SKILL_MAP, THREAT_NAMES, type Cat, type FxKind, type Skill } from './data';
import { AIM, BLASTS, G, K, V3, angDiff, clamp, rnd, type Actor, type Vec } from './runtime';
import { derive, facLv, useGame } from './store';
import { fx } from './fx';
import { sfx } from './audio';
import { collide, query } from './world';

const S = () => useGame.getState();
const tv = new V3(), tv2 = new V3(), tv3 = new V3();
export const fwd = (yaw: number, out = new V3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
export const center = (a: Actor) => a.pos.y + 0.9 * a.scale;
const isHostile = (a: Actor, civ = false) => a.alive && (a.team === 'hero' || a.team === 'enemy' || (civ && a.team === 'civ'));

// ───────────── heat / threat ─────────────
const HEAT = [0, 10, 30, 55, 85, 125, 180, 260];
export const threatFromHeat = (h: number) => { let t = 0; for (let i = 1; i < HEAT.length; i++) if (h >= HEAT[i]) t = i; return t; };
export function crime(h: number) {
  G.heat += h; G.safeT = 0; const t = threatFromHeat(G.heat);
  if (t > G.threat) { G.threat = t; S().toast(`THREAT LEVEL ${t}: ${THREAT_NAMES[t]}`, t >= 4 ? '#ef4444' : '#fb923c'); sfx(t >= 3 ? 'alarm' : 'hero'); }
}

// ───────────── damage ─────────────
export function hurtActor(a: Actor, dmg: number, o: { kb?: Vec; cat?: Cat; heavy?: boolean; player?: boolean; bleed?: boolean; stun?: number; ignoreArmor?: boolean } = {}) {
  if (!a.alive) return; let d = dmg;
  if (o.cat && a.weak === o.cat) { d *= 1.5; }
  if (a.team === 'hero' && o.cat && o.player) {
    const n = (G.learn[o.cat] = (G.learn[o.cat] ?? 0) + 1); if (n === 14) S().toast(`Heroes are ADAPTING to your ${o.cat} attacks! Switch up your powers.`, '#60a5fa'); if (n > 14) d *= Math.max(0.55, 1 - (n - 14) * 0.02);
  }
  const s = S(); if (o.player && Math.random() < 0.08 + (s.accs.includes('a_goggles') ? 0.05 : 0)) d *= 1.8;
  d = Math.round(d); a.hp -= d; a.flash = 0.18; if (o.bleed) a.bleed = 3;
  const bossy = a.boss ? 0.25 : 1; if (o.kb) { a.vel.x += o.kb.x * bossy; a.vel.z += o.kb.z * bossy; a.vel.y += (o.kb.y + (o.heavy ? 3 : 1)) * bossy; }
  a.stun = Math.max(a.stun, (o.stun ?? (o.heavy ? 0.55 : 0.2)) * (a.boss ? 0.4 : 1)); a.aggro = true;
  const hitPos = tv.set(a.pos.x, center(a), a.pos.z);
  const hitColor = o.cat ? CAT_COL[o.cat] : '#ffdd88';
  fx.burst(hitPos, hitColor, o.heavy ? 12 : 8, o.heavy ? 7 : 5, o.heavy ? 0.45 : 0.35, o.heavy ? 0.18 : 0.15);
  if (o.heavy) fx.ring(tv.set(a.pos.x, a.pos.y, a.pos.z), hitColor, 2.2, 0.32, 0.08);
  if (o.player) { G.p.combatT = 6; G.safeT = 0; if (a.team === 'civ') crime(7); else if (a.team === 'hero') crime(1.2); if (a.team === 'hero' || a.team === 'enemy') G.p.en = Math.min(G.p.maxEn, G.p.en + 1.5); }
  if (a.hp <= 0) killActor(a, o);
}
export function killActor(a: Actor, o: { heavy?: boolean; player?: boolean } = {}) {
  a.alive = false; a.deadT = 0; a.state = 'dead'; a.hp = 0; const p = new V3(a.pos.x, center(a), a.pos.z);
  fx.burst(p, a.color, o.heavy ? 40 : 18, 8, 0.8, 0.22); if (o.heavy) { fx.ring(p, a.color, 4, 0.5, 0); G.hitStop = 0.1; G.shake = Math.max(G.shake, 0.4); }
  sfx(o.heavy ? 'heavy' : 'hit');
  if (a.team === 'ally' || a.kind === 'summon') return;
  const s = S(); const l = a.lvl;
  if (a.team === 'civ') { s.addRep(-3); crime(12); return; }
  if (a.kind === 'gang' || a.kind === 'guard') { s.addMoney(Math.round(15 + l * 6)); s.addXp(12 + l * 4); s.addRep(Math.max(1, Math.round(1 + l * 0.2))); s.evt('kill_gang'); if (Math.random() < 0.07) s.giveItem(Math.random() < 0.5 ? 'medkit' : 'energycell'); }
  else if (a.kind === 'hero' || a.kind === 'boss' || a.kind === 'rival') {
    if (a.kind === 'hero' && !a.boss) { s.addMoney(Math.round(80 + l * 30)); s.addXp(60 + l * 14); s.addRep(8 + l); s.evt('kill_hero'); crime(10); if (Math.random() < 0.12) s.giveItem(['scrap', 'circuit', 'darkcrystal', 'energycell'][Math.floor(rnd(0, 4))]); if (facLv(s, 'prison') > 0 && Math.random() < 0.4) { useGame.setState((st) => ({ prisoners: st.prisoners + 1 })); s.toast(`${a.name} captured and sent to your Prison!`, '#a78bfa'); } }
    else { s.addXp(200 + l * 20); s.evt('kill_hero'); }
  }
}
export function hurtPlayer(dmg: number, from?: Vec, o: { kb?: number; cat?: Cat } = {}) {
  const p = G.p; if (p.dead || p.invT > 0 || G.cine.t > 0) return; const s = S(); const d0 = derive(s);
  let d = dmg / (1 + d0.def / 60);
  if (p.shield > 0) d *= 0.2;
  if (p.blockT > 0 && from) { const dir = tv.copy(from).sub(p.pos); const ang = Math.abs(angDiff(p.yaw, Math.atan2(dir.x, dir.z))); if (ang < 1.6) { d *= 0.2; p.en = Math.max(0, p.en - dmg * 0.3); sfx('block'); fx.burst(tv2.set(p.pos.x, p.pos.y + 1.2, p.pos.z), '#9fd8ff', 8, 4, 0.3, 0.12); } }
  d = Math.max(1, Math.round(d)); p.hp -= d; p.invT = 0.18; p.combatT = 6; p.lastDmg = d; G.safeT = 0;
  if (d > 4 || !p.hitT || p.hitT < 0) { p.hitT = clamp(0.1 + d / 80, 0.15, 0.5); }
  G.shake = Math.max(G.shake, Math.min(0.5, d / 60 + 0.1)); sfx('hurt');
  if (from && (o.kb ?? 0) > 0) { tv.copy(p.pos).sub(from).setY(0.15).normalize(); p.vel.addScaledVector(tv, (o.kb ?? 0) * (s.armor === 'ironplate' ? 0.4 : 1)); }
  if (p.hp <= 0) { p.hp = 0; p.dead = 0.001; p.flying = false; p.diving = false; sfx('dead'); s.toast('YOU HAVE BEEN DEFEATED...', '#ef4444'); }
}
export function respawn() {
  const p = G.p; const s = S(); p.dead = 0; p.hp = derive(s).maxHp; p.en = derive(s).maxEn; p.vel.set(0, 0, 0); p.vehicle = null; p.interior = '';
  p.pos.set(-56, 0, 0); p.flying = false; p.invT = 2; const loss = Math.round(s.money * 0.1); if (loss) s.addMoney(-loss); G.heat *= 0.25; G.threat = threatFromHeat(G.heat);
  for (const a of G.actors) if (a.team === 'hero' && a.resp) a.alive = false; s.toast(`You wake up at your hideout. Lost $${loss}.`, '#fca5a5');
}

// ───────────── projectiles / explosions ─────────────
export interface ShotOpts { speed: number; dmg: number; color: string; c2?: string; size?: number; team: 'player' | 'enemy'; cat: Cat; life?: number; explode?: number; pierce?: number; grav?: number; fx?: FxKind; slow?: number; src?: string }
export function shoot(pos: Vec, dir: Vec, o: ShotOpts) {
  if (G.projectiles.length > 110) G.projectiles.shift();
  G.projectiles.push({ pos: pos.clone(), vel: dir.clone().normalize().multiplyScalar(o.speed), life: o.life ?? 2, dmg: o.dmg, color: o.color, c2: o.c2 ?? o.color, r: (o.size ?? 0.4) + 0.5, team: o.team, cat: o.cat, fx: o.fx ?? 'bolt', pierce: o.pierce ?? 0, hit: new Set(), size: o.size ?? 0.4, explode: o.explode ?? 0, grav: o.grav ?? 0, slow: o.slow ?? 0, src: o.src ?? '' });
}
export function explode(pos: Vec, radius: number, dmg: number, color: string, c2: string, cat: Cat, team: 'player' | 'enemy', kb = 10) {
  fx.explosion(pos, color, radius, c2); BLASTS.push({ x: pos.x, y: pos.y, z: pos.z, r: radius, d: dmg });
  const dp = pos.distanceTo(G.p.pos); if (radius > 2.5) { sfx('explosion'); G.shake = Math.max(G.shake, Math.min(0.9, radius / (dp * 0.15 + 4))); }
  if (team === 'player') { for (const a of G.actors) { if (!isHostile(a)) continue; const dx = a.pos.x - pos.x, dz = a.pos.z - pos.z, dy = center(a) - pos.y; const dd = Math.sqrt(dx * dx + dz * dz + dy * dy); if (dd > radius + 0.7) continue; tv3.set(dx, 0, dz).normalize().multiplyScalar(kb); tv3.y = kb * 0.35; hurtActor(a, dmg * (1 - (dd / (radius + 1)) * 0.5), { kb: tv3, cat, player: true, heavy: dmg > 60, stun: 0.6 }); if (cat === 'Ice') a.frozen = 1.2; } }
  else { const dd = pos.distanceTo(tv.set(G.p.pos.x, G.p.pos.y + 1, G.p.pos.z)); if (dd < radius + 0.6) hurtPlayer(dmg * (1 - dd / (radius + 1) * 0.5), pos, { kb: kb * 0.8, cat }); }
}

export function updateProjectiles(dt: number) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i]; pr.life -= dt; pr.vel.y -= pr.grav * dt; pr.pos.addScaledVector(pr.vel, dt);
    if (Math.random() < 0.9) fx.spark(pr.pos.x + rnd(-0.1, 0.1), pr.pos.y + rnd(-0.1, 0.1), pr.pos.z + rnd(-0.1, 0.1), rnd(-0.6, 0.6), rnd(-0.4, 0.8), rnd(-0.6, 0.6), 0.35, pr.size * 0.9, pr.color);
    let dead = pr.life <= 0; let hitSomething = false;
    if (pr.pos.y < 0.15 && pr.vel.y < 0) { dead = true; hitSomething = true; }
    if (!dead) { for (const b of query(pr.pos.x, pr.pos.z, 1)) { if (pr.pos.x > b.x0 && pr.pos.x < b.x1 && pr.pos.z > b.z0 && pr.pos.z < b.z1 && pr.pos.y > b.y0 && pr.pos.y < b.y1) { dead = true; hitSomething = true; break; } } }
    if (!dead && pr.team === 'player') {
      for (const a of G.actors) {
        if (!isHostile(a) || pr.hit.has(a.id)) continue; const dx = a.pos.x - pr.pos.x, dz = a.pos.z - pr.pos.z, dy = center(a) - pr.pos.y;
        if (dx * dx + dz * dz + dy * dy < (pr.r + 0.5 * a.scale) ** 2) {
          pr.hit.add(a.id); hitSomething = true;
          if (!pr.explode) { tv3.copy(pr.vel).setY(0).normalize().multiplyScalar(7); hurtActor(a, pr.dmg, { kb: tv3, cat: pr.cat, player: true }); if (pr.slow) a.frozen = Math.max(a.frozen, pr.slow); fx.burst(pr.pos, pr.color, 12, 6, 0.4, 0.2); sfx('hit'); }
          if (pr.pierce <= 0) { dead = true; break; } pr.pierce--;
        }
      }
    } else if (!dead && pr.team === 'enemy') {
      const dx = G.p.pos.x - pr.pos.x, dz = G.p.pos.z - pr.pos.z, dy = G.p.pos.y + 1 - pr.pos.y;
      if (dx * dx + dz * dz + dy * dy < (pr.r + 0.4) ** 2 && G.p.invT <= 0) { hitSomething = true; dead = true; if (!pr.explode) { hurtPlayer(pr.dmg, pr.pos, { kb: 6, cat: pr.cat }); fx.burst(pr.pos, pr.color, 12, 6, 0.4, 0.2); } }
    }
    if (dead) { if (pr.explode && hitSomething) explode(pr.pos, pr.explode, pr.dmg, pr.color, pr.c2, pr.cat, pr.team, 9); else if (hitSomething) fx.burst(pr.pos, pr.color, 10, 5, 0.4, 0.2); G.projectiles.splice(i, 1); }
  }
}

// ───────────── fields & delayed ─────────────
export function updateFields(dt: number) {
  for (let i = G.fields.length - 1; i >= 0; i--) {
    const f = G.fields[i]; f.t += dt; f.tick -= dt; const pr = f.t / f.dur;
    for (let k = 0; k < 2; k++) { const a = rnd(0, Math.PI * 2), r = rnd(0.3, 1) * f.r; fx.spark(f.pos.x + Math.cos(a) * r, f.pos.y + rnd(0, 3), f.pos.z + Math.sin(a) * r, -Math.sin(a) * 4, rnd(0.5, 4), Math.cos(a) * 4, 0.6, 0.18, k ? f.c1 : f.c2); }
    if (f.tick <= 0) {
      f.tick = 0.4; fx.ring(f.pos, f.c1, f.r, 0.5, 0.1);
      for (const a of G.actors) {
        if (!isHostile(a)) continue; const dx = f.pos.x - a.pos.x, dz = f.pos.z - a.pos.z; const d = Math.hypot(dx, dz); if (d > f.r) continue;
        if (f.kind === 'field') { a.vel.x += (dx / (d + 0.1)) * 6; a.vel.z += (dz / (d + 0.1)) * 6; if (f.cat === 'Wind') a.vel.y += 6; if (f.cat === 'Gravity') { a.frozen = Math.max(a.frozen, 0.6); a.vel.y += 1.5; } if (f.cat === 'Ice') a.frozen = Math.max(a.frozen, 0.9); if (f.cat === 'Space-Time') a.frozen = Math.max(a.frozen, 1.0); }
        hurtActor(a, f.dmg * 0.4 * derive(S()).dmgMult, { cat: f.cat, player: true, stun: 0.3 });
      }
    }
    if (pr >= 1) G.fields.splice(i, 1);
  }
}
export function updateDelayed(dt: number) { for (let i = G.delayed.length - 1; i >= 0; i--) { const d = G.delayed[i]; d.t -= dt; if (d.t <= 0) { G.delayed.splice(i, 1); d.fn(); } } }

// ───────────── targeting helpers ─────────────
export function nearestHostile(pos: Vec, r: number, dirYaw?: number, cone = Math.PI, civ = false): Actor | null {
  let best: Actor | null = null, bd = r;
  for (const a of G.actors) { if (!isHostile(a, civ)) continue; const dx = a.pos.x - pos.x, dz = a.pos.z - pos.z; const d = Math.hypot(dx, dz, center(a) - pos.y - 1); if (d > bd) continue; if (dirYaw !== undefined && Math.abs(angDiff(dirYaw, Math.atan2(dx, dz))) > cone) continue; best = a; bd = d; }
  return best;
}
export function aimFrom(origin: Vec, range: number, out = new V3()) {
  out.copy(AIM); const t = nearestHostile(origin, range, undefined, 1, false);
  if (t) { tv2.set(t.pos.x, center(t), t.pos.z).sub(origin).normalize(); if (tv2.dot(AIM) > 0.9) out.copy(tv2); } return out;
}

// ───────────── skills ─────────────
export function activeSkill(slot: 'e' | 'r' | 'v'): Skill | null {
  const s = S(); let id = s.eq[slot]; if (slot === 'v' && G.p.form && FORMS[G.p.form].skill) id = FORMS[G.p.form].skill!; return SKILL_MAP[id] ?? null;
}
const dmgScale = (cat?: Cat) => { const s = S(); return derive(s).dmgMult * (1 + s.level * 0.06) * (cat === 'Shadow' && s.armor === 'trench' ? 1.1 : 1); };

export function castSkill(slot: 'e' | 'r' | 'v') {
  const p = G.p; if (p.dead || p.vehicle || p.transT > 0 || G.cine.t > 0) return; const sk = activeSkill(slot); if (!sk) { S().toast('No skill equipped in this slot — open Skills (K).', '#fbbf24'); return; }
  if (p.cd[slot] > 0) return; if (p.en < sk.cost) { sfx('beep'); S().toast('Not enough energy', '#f87171'); return; }
  p.en -= sk.cost; p.cd[slot] = sk.cd * (1 - facLv(S(), 'lab') * 0.02); p.castT = sk.fx === 'nova' ? 1.0 : 0.5; p.combatT = 6; sfx('cast_' + sk.fx); S().evt('skill');

  const origin = new V3(p.pos.x, p.pos.y + 1.25, p.pos.z); const dmg = sk.dmg * dmgScale(sk.cat);
  const dir = aimFrom(origin, sk.range || 30).clone(); const horiz = tv3.set(dir.x, 0, dir.z).normalize().clone();
  if (!p.flying) p.yaw = Math.atan2(horiz.x, horiz.z); else p.yaw = Math.atan2(dir.x, dir.z);
  const delay = sk.fx === 'nova' ? 0.9 : 0.16; const cat = sk.cat;
  const at = (fn: () => void) => G.delayed.push({ t: delay, fn });
  fx.ring(p.pos, sk.c1, 2.2, 0.4, 0.1); fx.burst(origin, sk.c1, 10, 3, 0.5, 0.15);
  if (sk.fx === 'nova') { for (let i = 0; i < 20; i++) G.delayed.push({ t: i * 0.04, fn: () => { const a = rnd(0, 6.28), r = 5; fx.spark(p.pos.x + Math.cos(a) * r, p.pos.y + rnd(0.2, 2.5), p.pos.z + Math.sin(a) * r, -Math.cos(a) * 9, rnd(-1, 2), -Math.sin(a) * 9, 0.5, 0.25, sk.c1); } }); }
  switch (sk.fx) {
    case 'bolt': at(() => {
      const o = new V3(p.pos.x, p.pos.y + 1.25, p.pos.z).addScaledVector(dir, 1);
      shoot(o, dir, { speed: 58, dmg, color: sk.c1, c2: sk.c2, size: sk.ult ? 0.9 : 0.5, team: 'player', cat, life: sk.range / 55, explode: cat === 'Fire' || cat === 'Energy' || cat === 'Shadow' ? 2.6 : 0, pierce: cat === 'Wind' ? 3 : cat === 'Ice' ? 1 : 0, slow: cat === 'Ice' ? 1.5 : 0 });
      if (sk.id === 'fireball') G.delayed.push({ t: 0.12, fn: () => shoot(new V3(p.pos.x, p.pos.y + 1.25, p.pos.z).addScaledVector(dir, 1), dir, { speed: 58, dmg: dmg * 0.5, color: sk.c1, c2: sk.c2, size: 0.3, team: 'player', cat, life: 1.2, explode: 1.8 }) });
    }); break;
    case 'beam': at(() => {
      const a = new V3(p.pos.x, p.pos.y + 1.25, p.pos.z).addScaledVector(dir, 0.8); const b = a.clone().addScaledVector(dir, sk.range);
      const segs = cat === 'Lightning' ? 5 : 1; for (let i = 0; i < segs; i++) { const s0 = a.clone().lerp(b, i / segs), s1 = a.clone().lerp(b, (i + 1) / segs); if (cat === 'Lightning') { if (i > 0) s0.add(tv.set(rnd(-1.2, 1.2), rnd(-1.2, 1.2), rnd(-1.2, 1.2))); if (i < segs - 1) s1.add(tv.set(rnd(-1.2, 1.2), rnd(-1.2, 1.2), rnd(-1.2, 1.2))); } fx.beam(s0, s1, sk.c1, 0.55, 0.5); fx.beam(s0, s1, sk.c2, 0.25, 0.5); }
      fx.burst(a, sk.c1, 14, 8, 0.4, 0.2); G.shake = Math.max(G.shake, 0.15);
      for (const t of G.actors) { if (!isHostile(t)) continue; tv.set(t.pos.x, center(t), t.pos.z).sub(a); const along = tv.dot(dir); if (along < 0 || along > sk.range) continue; const perp = tv2.copy(dir).multiplyScalar(along).sub(tv).length(); if (perp < 1.8) { tv3.copy(dir).setY(0).multiplyScalar(8); hurtActor(t, dmg, { kb: tv3, cat, player: true, heavy: true }); fx.burst(tv.set(t.pos.x, center(t), t.pos.z), sk.c1, 14, 7, 0.5, 0.2); } }
      const ground = a.clone().addScaledVector(dir, sk.range); if (ground.y < 2) fx.explosion(ground.setY(0.2), sk.c1, 2.5, sk.c2);
    }); break;
    case 'burst': at(() => { explode(new V3(p.pos.x, p.pos.y + 0.9, p.pos.z), sk.range, dmg, sk.c1, sk.c2, cat, 'player', sk.ult ? 22 : 14); fx.ring(p.pos, sk.c2, sk.range * 1.2, 0.7, 0.2); if (sk.ult) { fx.pillar(p.pos, sk.c1, 3, 40, 0.8); G.hitStop = 0.08; } }); break;
    case 'blade': at(() => {
      const c = new V3(p.pos.x, p.pos.y + 1.2, p.pos.z).addScaledVector(horiz, 1.6); fx.slash(c, p.yaw, sk.c1, sk.range * 0.8, rnd(-0.6, 0.6), 0.35); fx.slash(c, p.yaw, sk.c2, sk.range * 0.6, rnd(-0.6, 0.6), 0.4);
      p.vel.addScaledVector(horiz, p.flying ? 14 : 9);
      for (const t of G.actors) { if (!isHostile(t)) continue; tv.set(t.pos.x - p.pos.x, 0, t.pos.z - p.pos.z); const d = tv.length(); if (d > sk.range + 1) continue; if (d > 1.2 && tv.normalize().dot(horiz) < 0.2) continue; tv3.copy(horiz).multiplyScalar(11); tv3.y = cat === 'Martial Arts' ? 10 : 2; hurtActor(t, dmg, { kb: tv3, cat, player: true, heavy: true }); }
      if (sk.id === 'rift_slash') fx.dome(c, sk.c1, 3, 0.5);
    }); break;
    case 'dash': {
      if (sk.id === 'blink') { at(() => { fx.burst(p.pos, sk.c1, 20, 6, 0.5, 0.2); p.pos.addScaledVector(p.flying ? dir : horiz, sk.range); collide(p.pos, null, 0.5, 1.8, 0); fx.burst(new V3(p.pos.x, p.pos.y + 1, p.pos.z), sk.c1, 20, 6, 0.5, 0.2); fx.ring(p.pos, sk.c1, 3, 0.4); p.invT = 0.3; }); break; }
      const dd = p.flying ? dir : horiz; p.dashT = 0.3; p.dashDir.copy(dd).multiplyScalar(sk.range / 0.3); p.invT = 0.35; p.hit.clear(); p.skDash = { dmg, cat, c1: sk.c1, c2: sk.c2 }; break;
    }
    case 'shield': p.shield = 5; fx.dome(new V3(p.pos.x, p.pos.y + 1, p.pos.z), sk.c1, 2.4, 0.8); break;
    case 'field': at(() => {
      const t = nearestHostile(p.pos, sk.range + 8, undefined, Math.PI); const c = t ? new V3(t.pos.x, 0, t.pos.z) : new V3(p.pos.x, 0, p.pos.z).addScaledVector(horiz, 9);
      G.fields.push({ pos: c, r: sk.range, t: 0, dur: sk.id === 'time_stop' ? 6 : 4.5, kind: 'field', dmg, cat, c1: sk.c1, c2: sk.c2, tick: 0 }); fx.dome(c.clone().setY(1.5), sk.c1, sk.range * 0.9, 0.7); fx.pillar(c, sk.c2, 1.5, 12, 0.8);
      if (sk.id === 'time_stop') for (const a of G.actors) if (isHostile(a)) a.frozen = Math.max(a.frozen, 6);
    }); break;
    case 'summon': at(() => { const n = 3; for (let i = 0; i < n; i++) { const a = (i / n) * 6.28; G.delayed.push({ t: i * 0.12, fn: () => { const ev = new CustomEvent('sv-summon', { detail: { x: p.pos.x + Math.cos(a) * 2.5, z: p.pos.z + Math.sin(a) * 2.5, dmg, c: sk.c1 } }); window.dispatchEvent(ev); } }); } fx.ring(p.pos, sk.c1, 4, 0.7); }); break;
    case 'rain': at(() => {
      const t = nearestHostile(p.pos, 45, undefined, Math.PI); const c = t ? new V3(t.pos.x, 0, t.pos.z) : new V3(p.pos.x, 0, p.pos.z).addScaledVector(horiz, 12);
      const n = sk.cat === 'Lightning' ? 9 : 11; for (let i = 0; i < n; i++) G.delayed.push({ t: i * 0.18, fn: () => {
        const x = c.x + rnd(-sk.range, sk.range) * 0.8, z = c.z + rnd(-sk.range, sk.range) * 0.8;
        if (sk.cat === 'Lightning') { const g = new V3(x, 0, z); fx.pillar(g, sk.c1, 1.2, 70, 0.35); G.delayed.push({ t: 0.05, fn: () => explode(g, 4.2, dmg, sk.c1, sk.c2, cat, 'player', 10) }); sfx('cast_strike'); }
        else { shoot(new V3(x - 8, 38, z - 8), tv.set(0.25, -1, 0.25), { speed: 48, dmg, color: sk.c1, c2: sk.c2, size: 1.0, team: 'player', cat, life: 2, explode: 4.5 }); }
      } });
    }); break;
    case 'pull': case 'push': at(() => {
      const pull = sk.fx === 'pull'; fx.ring(p.pos, sk.c1, sk.range, 0.6, 0.2); fx.dome(new V3(p.pos.x, p.pos.y + 1, p.pos.z), sk.c1, sk.range * 0.6, 0.4);
      for (const a of G.actors) { if (!isHostile(a)) continue; tv.set(p.pos.x - a.pos.x, 0, p.pos.z - a.pos.z); const d = tv.length(); if (d > sk.range) continue; tv.normalize().multiplyScalar(pull ? 24 : -26); tv.y = 4; hurtActor(a, dmg, { kb: tv, cat, player: true, stun: 0.5 }); if (pull) { a.vel.x *= 1.0; } }
      if (sk.id === 'tidal_wave') fx.pillar(p.pos, sk.c1, sk.range * 0.5, 6, 0.6);
    }); break;
    case 'nova': at(() => {
      const c = new V3(p.pos.x, p.pos.y + 0.9, p.pos.z); explode(c, sk.range, dmg, sk.c1, sk.c2, cat, 'player', 28); fx.ring(p.pos, sk.c2, sk.range * 1.4, 0.9, 0.2); fx.ring(p.pos, sk.c1, sk.range * 0.9, 0.7, 1.5); fx.pillar(p.pos, sk.c1, 4, 60, 1.0); fx.dome(c, sk.c1, sk.range, 0.8); G.hitStop = 0.15; G.shake = 1;
      for (const a of G.actors) if (isHostile(a) && a.pos.distanceTo(p.pos) < sk.range) a.stun = Math.max(a.stun, 1.2);
    }); break;
    case 'strike': at(() => {
      const t = nearestHostile(p.pos, sk.range, undefined, Math.PI); const c = t ? new V3(t.pos.x, 0, t.pos.z) : new V3(p.pos.x, 0, p.pos.z).addScaledVector(horiz, 10);
      const earth = cat === 'Earth'; fx.pillar(c, sk.c1, earth ? 2.6 : 1.4, earth ? 9 : 70, earth ? 0.7 : 0.4); fx.pillar(c, sk.c2, earth ? 1.6 : 0.6, earth ? 12 : 70, 0.4);
      G.delayed.push({ t: 0.05, fn: () => { explode(c, earth ? 5 : 4.5, dmg, sk.c1, sk.c2, cat, 'player', earth ? 6 : 10); if (earth) for (const a of G.actors) if (isHostile(a) && a.pos.distanceTo(c) < 5) a.vel.y += 14; } }); G.shake = Math.max(G.shake, 0.4);
    }); break;
    case 'heal': { const d = derive(S()); p.hp = Math.min(d.maxHp, p.hp + d.maxHp * 0.38); fx.ring(p.pos, sk.c1, 3, 0.8, 0.1); for (let i = 0; i < 30; i++) fx.spark(p.pos.x + rnd(-0.6, 0.6), p.pos.y + rnd(0, 1), p.pos.z + rnd(-0.6, 0.6), 0, rnd(2, 5), 0, 1, 0.16, sk.c1); break; }
  }
}

// ───────────── melee ─────────────
const WRANGE: Record<string, number> = { dagger: 2.4, sword: 3.1, dual: 2.9, greatsword: 3.9, spear: 5.2, scythe: 4.3, '': 2.5, energy: 0, special: 0 };
export function startAttack(heavy: boolean) {
  const p = G.p; if (p.dead || p.vehicle || p.dashT > 0 || p.transT > 0 || G.cine.t > 0 || p.diving) return; if (p.atkT > 0 && p.atkT > p.atkDur * 0.38) return;
  const s = S(); const w = ITEM_MAP[s.weapon]; const wt = w?.wtype ?? ''; const spd = (w?.stats?.Speed as number) ?? 1.9;
  p.combo = p.comboT > 0 && !heavy ? (p.combo + 1) % 3 : 0; p.heavy = heavy; p.atkDur = (heavy ? 1.05 : 0.66) / Math.pow(spd, heavy ? 0.5 : 0.7); p.atkT = p.atkDur; p.comboT = p.atkDur + 0.5; p.hasHit = false; p.combatT = 6;
  const t = nearestHostile(p.pos, 11, p.yaw, 1.3, true);
  if (t) p.yaw = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z); else p.yaw = Math.atan2(-Math.sin(G.p.camYaw), -Math.cos(G.p.camYaw));
  fwd(p.yaw, tv); p.vel.addScaledVector(tv, (p.flying ? 14 : heavy ? 7 : 9) * (wt === 'spear' ? 1.3 : 1)); sfx('swing');

}
export function resolveMelee() {
  const p = G.p; const s = S(); const d0 = derive(s); const w = ITEM_MAP[s.weapon]; const wt = w?.wtype ?? ''; const heavy = p.heavy; const combo = p.combo;
  const dmg = d0.base * d0.dmgMult * (heavy ? 2.6 : [1, 1.1, 1.6][combo]); const color = w?.color ?? '#ffe9c0'; const f = fwd(p.yaw);
  const origin = new V3(p.pos.x, p.pos.y + 1.2, p.pos.z);
  if (wt === 'energy') { const dir = aimFrom(origin, 50, new V3()).clone(); const big = w?.id === 'photon_cannon'; shoot(origin.clone().addScaledVector(dir, 0.9), dir, { speed: 85, dmg: dmg * (heavy ? 2 : 1), color, size: heavy ? 0.5 : big ? 0.4 : 0.25, team: 'player', cat: 'Energy', life: 1.2, explode: big || heavy ? 3 : 0 }); sfx('shoot'); fx.burst(origin.clone().addScaledVector(dir, 0.9), color, 6, 4, 0.3, 0.15); return; }
  if (wt === 'special') { const dir = aimFrom(origin, 40, new V3()).clone(); for (let i = -1; i <= 1; i++) { const dd = dir.clone().applyAxisAngle(new V3(0, 1, 0), i * 0.25); shoot(origin.clone().addScaledVector(dd, 1), dd, { speed: 50, dmg: dmg * 0.7, color, size: 0.35, team: 'player', cat: 'Unique', life: 1.2, pierce: heavy ? 3 : 0 }); } sfx('cast_bolt'); return; }
  const range = (WRANGE[wt] ?? 2.5) + (p.flying ? 0.6 : 0); const cone = wt === 'scythe' ? -1 : wt === 'greatsword' ? 0.1 : wt === 'spear' ? 0.6 : 0.25; let hits = 0; const max = wt === 'spear' ? 9 : heavy ? 8 : 4;
  const sc = tv2.copy(origin).addScaledVector(f, range * 0.55);
  if (wt === 'spear') { fx.beam(origin, tv3.copy(origin).addScaledVector(f, range), color, 0.25, 0.2); } else fx.slash(sc, p.yaw, color, Math.max(2, range * 0.75), (combo === 1 ? 0.0 : combo === 2 ? 1.2 : -0.5) + (heavy ? 0.9 : 0), heavy ? 0.4 : 0.26);
  if (heavy) { fx.ring(tv.set(p.pos.x + f.x * range * 0.7, p.pos.y, p.pos.z + f.z * range * 0.7), color, range * 1.1, 0.5, 0.1); G.shake = Math.max(G.shake, 0.25); if (w?.id === 'dragonfang') { fx.burst(tv.set(p.pos.x + f.x * range, p.pos.y + 0.5, p.pos.z + f.z * range), '#ff6a1a', 30, 8, 0.8, 0.3); fx.ring(tv, '#ff6a1a', 7, 0.7, 0.1); for (const a of G.actors) if (isHostile(a) && a.pos.distanceTo(p.pos) < 8) hurtActor(a, dmg * 0.4, { cat: 'Fire', player: true }); } }
  for (const a of G.actors) {
    if (hits >= max || !isHostile(a, true)) continue; tv.set(a.pos.x - p.pos.x, 0, a.pos.z - p.pos.z); const d = tv.length(); const dy = Math.abs(center(a) - origin.y); if (d > range + 0.6 * a.scale || dy > 2.6) continue;
    if (cone > -1 && d > 0.9 && tv.normalize().dot(f) < cone) continue; hits++;
    tv3.copy(f).multiplyScalar(heavy ? 15 : combo === 2 ? 11 : 6); tv3.y = heavy ? 3 : 0.5;
    hurtActor(a, wt === 'dagger' && !heavy ? dmg * 0.8 : dmg, { kb: tv3, cat: wt === '' ? 'Martial Arts' : 'Weapon Mastery', heavy: heavy || combo === 2, player: true, bleed: w?.id === 'fangs', stun: w?.id === 'ironbreaker' && heavy ? 0.9 : undefined });
    if (w?.id === 'void_edge') hurtActor(a, dmg * 0.3, { player: true });
  }
  if (hits) { sfx(heavy ? 'heavy' : 'hit'); G.hitStop = heavy ? 0.07 : 0.035; p.chain++; } else p.chain = 0;
}

// ───────────── dash / dive / transform ─────────────
export function startDash(dirIn: Vec | null) {
  const p = G.p; if (p.dead || p.vehicle || p.dashT > 0 || p.transT > 0 || G.cine.t > 0) return; const cost = S().armor === 'cloak' ? 6 : 9; if (p.en < cost) { sfx('beep'); return; }
  p.en -= cost; const d = dirIn && dirIn.lengthSq() > 0.01 ? dirIn.clone() : (p.flying ? AIM.clone() : fwd(p.yaw)); if (!p.flying) d.y = 0; d.normalize();
  p.dashT = 0.22; p.dashDir.copy(d).multiplyScalar(p.flying ? 62 : 36); p.invT = 0.3; p.hit.clear(); p.skDash = null; sfx('dash'); p.combatT = 4;
  if (!p.flying || dirIn) p.yaw = Math.atan2(d.x, d.z); fx.ring(tv.set(p.pos.x, p.pos.y + 1, p.pos.z), '#ffffff', 2, 0.3, 0);
}
export function startDive() {
  const p = G.p; if (!p.flying || p.dead || p.diving || p.en < 12) return; const t = nearestHostile(p.pos, 70, undefined, Math.PI);
  const dir = t ? tv.set(t.pos.x, center(t), t.pos.z).sub(p.pos).normalize().clone() : new V3(AIM.x * 0.3, -1, AIM.z * 0.3).normalize();
  p.en -= 12; p.diving = true; p.vel.copy(dir).multiplyScalar(75); p.invT = 0.5; p.yaw = Math.atan2(dir.x, dir.z); sfx('boost'); p.combatT = 6; p.atkT = 0;
}
export function diveImpact() {
  const p = G.p; p.diving = false; const s = S(); const w = ITEM_MAP[s.weapon]; const d0 = derive(s); const c = new V3(p.pos.x, Math.max(0.2, p.pos.y), p.pos.z);
  explode(c, 7.5, d0.base * d0.dmgMult * 3.2, w?.color ?? '#ffcc66', '#ffffff', 'Weapon Mastery', 'player', 18); fx.ring(c, '#ffffff', 10, 0.6, 0.2); G.shake = 0.9; G.hitStop = 0.08; sfx('slam'); p.vel.multiplyScalar(0.1); p.landT = 0.4;
}
export function startTransform() {
  const p = G.p; const s = S(); if (p.dead || p.vehicle || p.transT > 0) return;
  if (p.form > 0) { revertForm(); return; }
  const id = s.formSel; if (!id || !s.forms.includes(id)) { s.toast('No transformation unlocked. Use a transformation item (Inventory), then pick it in the Character tab.', '#fbbf24'); return; }
  const f = FORMS[id]; if (p.en < f.cost) { s.toast(`Need ${f.cost} energy to transform`, '#f87171'); return; }
  p.en -= f.cost; p.transT = 2.6; G.cine = { t: 0.001, dur: 2.6, form: id }; p.invT = 3; sfx('transform'); p.vel.set(0, 0, 0);
  for (let i = 0; i < 28; i++) G.delayed.push({ t: i * 0.07, fn: () => { const a = rnd(0, 6.28); fx.spark(p.pos.x + Math.cos(a) * 4, p.pos.y + rnd(0, 3), p.pos.z + Math.sin(a) * 4, -Math.cos(a) * 8, rnd(1, 4), -Math.sin(a) * 8, 0.5, 0.22, f.aura); } });
  G.delayed.push({ t: 2.0, fn: () => {
    p.form = id; p.formT = 40 + id * 12; const c = new V3(p.pos.x, p.pos.y + 1, p.pos.z); explode(c, 10, 80 + id * 40, f.aura, '#ffffff', 'Energy', 'player', 20); fx.pillar(p.pos, f.aura, 3, 90, 1.2); fx.ring(p.pos, f.aura, 18, 1.0, 0.2); fx.ring(p.pos, '#ffffff', 10, 0.7, 0.4); G.shake = 1.2; p.hp = Math.min(derive(S()).maxHp, p.hp + derive(S()).maxHp * 0.3); S().evt('transform'); S().toast(`${f.name} awakened!`, f.aura);
  } });
}
export function revertForm() { const p = G.p; if (!p.form) return; p.form = 0; p.formT = 0; sfx('revert'); fx.ring(p.pos, '#ffffff', 5, 0.5, 0.2); S().toast('Returned to base form', '#9ca3af'); }

// ───────────── per-frame combat update ─────────────
export function updateCombat(dt: number) {
  const p = G.p; const s = S(); const d = derive(s); p.maxHp = d.maxHp; p.maxEn = d.maxEn; if (p.hp > p.maxHp) p.hp = p.maxHp; if (p.en > p.maxEn) p.en = p.maxEn;
  for (const k of ['e', 'r', 'v']) if (p.cd[k] > 0) p.cd[k] -= dt;
  p.atkT -= dt; p.comboT -= dt; p.invT -= dt; p.hitT -= dt; p.castT -= dt; p.landT -= dt; p.shield -= dt; p.combatT -= dt; p.slowT -= dt;
  if (p.dead > 0) { p.dead += dt; if (p.dead > 4) respawn(); return; }
  if (p.transT > 0) { p.transT -= dt; G.cine.t += dt; if (G.cine.t >= G.cine.dur) G.cine.t = 0; }
  p.blockT = (K.down.has('KeyB') && !p.flying && !p.vehicle && p.atkT <= 0) ? 1 : 0; if (p.blockT > 0) p.en = Math.max(0, p.en - 3 * dt);
  const castingNova = p.castT > 0.1;
  if (!p.boost && !castingNova) p.en = Math.min(p.maxEn, p.en + d.regenEn * dt * (p.combatT > 0 ? 0.7 : 1.4));
  if (p.combatT <= 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.012 * dt);
  if (p.form > 0) { p.formT -= dt; p.en = Math.max(0, p.en - 0.8 * dt); if (p.formT <= 0) revertForm(); }
  if (p.atkT > 0 && !p.hasHit && 1 - p.atkT / p.atkDur >= 0.42) { p.hasHit = true; resolveMelee(); }
  if (p.bleed > 0) p.bleed -= dt;
  G.safeT += dt; if (G.safeT > 10 && G.heat > 0) { G.heat = Math.max(0, G.heat - (1.5 + G.threat * 0.5) * dt); const t = threatFromHeat(G.heat); if (t < G.threat) { G.threat = t; if (t === 0) S().toast('The heroes have lost track of you.', '#9ca3af'); } }
  for (const a of G.actors) { if (a.bleed > 0 && a.alive) { a.bleed -= dt; a.hp -= 4 * dt; if (a.hp <= 0) killActor(a, { player: true }); } }
  updateProjectiles(dt); updateFields(dt); updateDelayed(dt);

}
