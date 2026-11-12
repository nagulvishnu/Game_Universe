import * as THREE from 'three';
import { rt, type EnemyRT } from '../runtime';
import { G, fwd, angDiff, rand, clamp, damp } from './ctx';
import { ATK, type EAtk } from '../data/enemies';
import { REGION_BY_ID } from '../data/regions';
import { audio } from '../audio';
import { useHud, useStore } from '../store';
import { clearTele, damageEnemy, getTele, hurtPlayer, removeEnemy, setTele, spawnEnemy, spawnProj, staggerEnemy } from './combat';
import { resolveCollisions } from './player';

const T = new THREE.Vector3(); const T2 = new THREE.Vector3();
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function atkList(e: EnemyRT): EAtk[] { return e.boss ? e.boss.atks : e.def.attacks.map((id) => ATK[id]); }
const haste = (e: EnemyRT) => (e.boss ? e.boss.haste ** (0.35 + e.phase * 0.2) : 1);

function startAttack(e: EnemyRT, a: EAtk) {
  const p = rt.player!; e.atk = a; e.state = 'windup'; e.t = 0; e.atkDone = false; e.lastAtk = a.id; e.guardUp = false;
  const tw = a.windup / Math.sqrt(haste(e)); e.transT = tw; const fxm = G.fx!;
  e.aim.set(p.pos.x, p.pos.y, p.pos.z); e.from.copy(e.pos);
  if (a.shape === 'teleport') {
    fxm.sparks(T.set(e.pos.x, e.pos.y + 1, e.pos.z), 14, a.color, 5); fxm.ring(e.pos, 2, a.color, 0.4);
    const pf = fwd(p.yaw, T2); e.pos.set(p.pos.x - pf.x * (a.range + 0.6), p.pos.y, p.pos.z - pf.z * (a.range + 0.6)); resolveCollisions(e.pos, e.def.radius); e.yaw = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    fxm.sparks(T.set(e.pos.x, e.pos.y + 1, e.pos.z), 14, a.color, 5); fxm.ring(e.pos, 2, a.color, 0.4); audio.sfx('dodge');
  }
  const col = a.color; const gy = rt.hAt(e.pos.x, e.pos.z);
  if (a.shape === 'cone' || a.shape === 'teleport') setTele(e, fxm.telegraph('cone', col, a.range, a.arc, 0));
  else if (a.shape === 'circle') setTele(e, fxm.telegraph('circle', col, a.range, 0, 0));
  else if (a.shape === 'line' || a.shape === 'dash') setTele(e, fxm.telegraph('line', col, a.range, 0, a.w));
  else if (a.shape === 'leap') setTele(e, fxm.telegraph('circle', col, a.range, 0, 0));
  else if (a.shape === 'proj') fxm.sparks(T.set(e.pos.x, e.pos.y + 1.4 * e.def.scale, e.pos.z), 10, col, 3, 0.2, 0.5);
  else if (a.shape === 'summon') fxm.ring(e.pos, 4, col, tw);
  void gy; audio.sfx('telegraph');
  const am = e.model.anim; am.expr = 'angry';
  if (a.shape === 'line' || a.shape === 'dash') { am.pose = 'thrust'; } else if (a.shape === 'proj' || a.shape === 'summon') am.pose = 'cast'; else { am.pose = 'attack'; am.variant = a.shape === 'circle' ? 2 : e.cd['_v'] ? 1 : 0; e.cd['_v'] = e.cd['_v'] ? 0 : 1; }
  am.pt = 0;
  if (e.boss && (a.shape === 'circle' || a.shape === 'leap' || a.dmg > 1.5)) audio.sfx('roar');
}

function doHit(e: EnemyRT, a: EAtk) {
  const p = rt.player!; const fxm = G.fx!; const dmg = e.def.dmg * a.dmg * e.dmgMul; const dx = p.pos.x - e.pos.x; const dz = p.pos.z - e.pos.z; const d = Math.hypot(dx, dz);
  const f = fwd(e.yaw, T2); const body = e.def.radius * e.def.scale;
  switch (a.shape) {
    case 'cone': case 'teleport': {
      fxm.slash(e.pos, e.yaw, { radius: a.range * 0.9, arc: (a.arc * Math.PI) / 180, color: a.color, core: 0xffffff, tilt: Math.random() * 0.6 - 0.3, life: 0.28, y: 1.0 * e.def.scale });
      const ang = Math.abs(angDiff(e.yaw, Math.atan2(dx, dz)));
      if (d < a.range + 0.4 && ang < (a.arc * Math.PI) / 360 + 0.2) hurtPlayer(dmg, e.pos, { kb: a.kb, status: a.status }, e);
      audio.sfx('swing'); break;
    }
    case 'circle': {
      const cx = e.pos.x + f.x * a.off; const cz = e.pos.z + f.z * a.off; const c = T.set(cx, e.pos.y, cz).clone();
      fxm.ring(c, a.range, a.color, a.ring ? 0.7 : 0.45, 0.15); fxm.dust(c, 12); fxm.sparks(c.clone().setY(c.y + 0.5), 14, a.color, 7); if (a.ring) fxm.ring(c, a.range * 0.6, 0xffffff, 0.5);
      if (Math.hypot(p.pos.x - cx, p.pos.z - cz) < a.range + 0.3) hurtPlayer(dmg, c, { kb: a.kb, status: a.status }, e);
      rt.shake = Math.max(rt.shake, Math.min(0.8, 0.3 + (a.range > 5 ? 0.3 : 0))); audio.sfx('quake'); break;
    }
    case 'line': {
      const end = T.set(e.pos.x + f.x * a.range, e.pos.y, e.pos.z + f.z * a.range).clone();
      fxm.trail(e.pos.clone(), end, { color: a.color, core: 0xffffff, width: a.w * 0.9, life: 0.35, y: 1.0 * e.def.scale });
      const along = dx * f.x + dz * f.z; const lat = Math.abs(dx * f.z - dz * f.x);
      if (along > -0.5 && along < a.range && lat < a.w / 2 + 0.45) hurtPlayer(dmg, e.pos, { kb: a.kb, status: a.status }, e);
      audio.sfx('swing2'); break;
    }
    case 'proj': {
      const n = a.count; const base = Math.atan2(dx, dz); const arc = (a.arc * Math.PI) / 180;
      for (let i = 0; i < n; i++) {
        const ang = a.arc >= 360 ? (i / n) * Math.PI * 2 + e.t : base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * arc);
        const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
        spawnProj({ pos: new THREE.Vector3(e.pos.x + dir.x * 0.8, e.pos.y + 1.2 * e.def.scale, e.pos.z + dir.z * 0.8), dir, speed: a.speed, dmg, friendly: false, color: a.color, core: 0xffffff, kind: e.boss ? 'slash' : 'blast', size: e.boss ? 0.8 : 0.45, life: 3, status: a.status, kb: a.kb, owner: e.id });
      }
      audio.sfx('swing2'); break;
    }
    case 'summon': {
      const alive = rt.enemies.filter((x) => x.state !== 'dead').length; const n = Math.min(a.count, Math.max(0, 11 - alive));
      for (let i = 0; i < n; i++) { const ang = rand(0, 6.28); const pos = new THREE.Vector3(e.pos.x + Math.sin(ang) * 4, 0, e.pos.z + Math.cos(ang) * 4); pos.y = rt.hAt(pos.x, pos.z); resolveCollisions(pos, 0.5); const s = spawnEnemy(a.summon!, pos, { level: Math.max(1, e.level - 2), tag: 'summon' }); s.aggro = true; s.state = 'chase'; G.fx!.ring(pos, 2, a.color, 0.5); G.fx!.sparks(T.set(pos.x, 1, pos.z), 12, a.color, 5); }
      audio.sfx('roar'); break;
    }
    default: break;
  }
  void body;
}

function startRecover(e: EnemyRT) {
  const a = e.atk!; e.cd[a.id] = a.cd; e.state = 'recover'; e.t = 0; e.transT = a.recover / Math.sqrt(haste(e)); e.nextAtkT = rand(0.15, 0.5) / haste(e); clearTele(e); e.model.anim.expr = 'normal';
}

function chooseAttack(e: EnemyRT, dist: number): EAtk | null {
  const list = atkList(e).filter((a) => e.phase >= a.phase && e.phase <= a.maxPhase && (e.cd[a.id] ?? 0) <= 0 && dist >= a.minR && dist <= a.maxR);
  if (!list.length) return null; const pool = list.filter((a) => a.id !== e.lastAtk); const use = pool.length ? pool : list;
  return use[Math.floor(Math.random() * use.length)];
}

function bossPhase(e: EnemyRT) {
  if (!e.boss) return; const r = e.hp / e.maxHp; let ph = 0; e.boss.phases.forEach((t) => { if (r <= t) ph++; });
  if (ph > e.phase && e.state !== 'dead') {
    e.phase = ph; clearTele(e); e.state = 'intro'; e.t = 0; e.transT = 1.3; e.atk = null; e.posture = 0; const nm = e.boss.phaseNames?.[ph] ?? `Phase ${ph + 1}`;
    G.fx!.ring(e.pos, 10, e.boss.color, 0.9); G.fx!.ring(e.pos, 6, 0xffffff, 0.6); G.fx!.column(e.pos, e.boss.color, 1.2, 14, 0.9); G.fx!.sparks(T.set(e.pos.x, e.pos.y + 1.5, e.pos.z), 40, e.boss.color, 10, 0.3, 0.9);
    rt.shake = 1; audio.sfx('roar'); useStore.getState().toast(`${e.def.name}: ${nm}`, 'warn'); e.model.anim.pose = 'intro'; e.model.anim.expr = 'angry';
    if (r < 0.9) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02);
    G.onBossPhase?.(e, nm);
    const p = rt.player!; const away = T.set(p.pos.x - e.pos.x, 0, p.pos.z - e.pos.z).normalize(); const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    if (d < 9) { p.kb.addScaledVector(away, 9); }
  }
}

export function updateEnemies(dt: number) {
  const p = rt.player!; const night = rt.nightMix > 0.5; const list = rt.enemies;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]; const m = e.model; const an = m.anim; const def = e.def;
    for (const k in e.cd) if (e.cd[k] > 0) e.cd[k] -= dt;
    e.sinceHit += dt; e.t += dt; e.nextAtkT -= dt; e.dodgeT -= dt;
    if (e.state === 'dead') {
      e.deadT += dt; an.pose = 'dead'; an.pt = clamp(e.deadT / 1.1, 0, 1); an.walk = 0; e.pos.addScaledVector(e.vel, dt); e.vel.multiplyScalar(Math.exp(-6 * dt));
      if (e.deadT > 1.2) m.group.position.y = e.pos.y - (e.deadT - 1.2) * 0.8; else m.group.position.y = e.pos.y;
      m.group.position.x = e.pos.x; m.group.position.z = e.pos.z; m.group.rotation.y = e.yaw; m.update(dt, rt.time);
      if (e.deadT > (e.boss ? 3.2 : 2.3)) removeEnemy(e); continue;
    }
    const dx = p.pos.x - e.pos.x; const dz = p.pos.z - e.pos.z; const dist = Math.hypot(dx, dz); const toP = Math.atan2(dx, dz);
    if (def.flags.dummy || def.flags.static) {
      if (an.pose === 'hurt') { an.pt += dt * 3; if (an.pt >= 1) { an.pose = 'idle'; } }
      if (def.flags.dummy) { e.hp = e.maxHp; } m.group.position.copy(e.pos); m.update(dt, rt.time); continue;
    }
    // statuses
    if (e.status.poison > 0) { e.status.poison -= dt; damageEnemy(e, (3 + p.stats.atk * 0.22) * dt, { dot: true }); }
    if (e.status.burn > 0) { e.status.burn -= dt; damageEnemy(e, (2 + p.stats.atk * 0.3) * dt, { dot: true }); if (Math.random() < 0.3) G.fx!.add.emit(e.pos.x + rand(-0.3, 0.3), e.pos.y + 1.2, e.pos.z + rand(-0.3, 0.3), 0, 1.5, 0, 0.5, 0.45, 0.05, 0xff7a20, 0.9); }
    if (e.status.slow > 0) e.status.slow -= dt; if ((e.state as string) === 'dead') continue;
    if (def.flags.regen && e.sinceHit > 3 && e.hp < e.maxHp) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * def.flags.regen * dt); if (Math.random() < 0.1) G.fx!.sparks(T.set(e.pos.x, e.pos.y + 1.2, e.pos.z), 2, 0x7aff9a, 1.5, 0.15, 0.6); }
    if (e.boss) {
      bossPhase(e);
      if (e.boss.dawn && e.phase >= 3 && e.aggro) damageEnemy(e, e.maxHp * 0.0035 * dt, { dot: true });
      if (e.posture > 0) e.posture = Math.max(0, e.posture - dt * 3);
    } else if (e.posture > 0 && e.state !== 'stagger') e.posture = Math.max(0, e.posture - dt * 4);
    const spd = def.spd * (e.status.slow > 0 ? 0.5 : 1) * (e.boss ? Math.sqrt(haste(e)) : 1);
    let moving = 0; let want = e.yaw;
    const detect = def.detect * (night ? 1.25 : 1);
    switch (e.state) {
      case 'hidden':
        if (dist < def.detect) { e.state = 'chase'; e.aggro = true; m.group.visible = true; G.fx!.dust(e.pos, 10, 0x4a3a50, 3); G.fx!.sparks(T.set(e.pos.x, e.pos.y + 0.5, e.pos.z), 8, 0xff3040, 4); audio.sfx('roar'); }
        break;
      case 'intro':
        an.pose = 'intro'; want = toP; if (e.t >= e.transT) { e.state = e.aggro ? 'chase' : 'idle'; an.pose = 'idle'; }
        break;
      case 'idle':
        an.pose = 'idle'; e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderT = rand(2, 5); e.wander.set(e.home.x + rand(-6, 6), 0, e.home.z + rand(-6, 6)); }
        { const wd = Math.hypot(e.wander.x - e.pos.x, e.wander.z - e.pos.z); if (wd > 1) { want = Math.atan2(e.wander.x - e.pos.x, e.wander.z - e.pos.z); moving = 0.35; } }
        if (!e.boss && (dist < detect || e.aggro) && p.state !== 'dead') { e.state = 'chase'; e.aggro = true; if (Math.random() < 0.5) audio.sfx('roar'); }
        break;
      case 'chase': {
        an.pose = 'idle'; if (p.state === 'dead') { e.state = 'idle'; e.aggro = false; break; }
        want = toP; const keep = def.flags.keep ?? 0; const melee = 1.6 * def.scale + 0.4;
        const a = e.nextAtkT <= 0 ? chooseAttack(e, dist) : null;
        if (a) { startAttack(e, a); break; }
        if (def.flags.guard) e.guardUp = dist < 7;
        if (keep && dist < keep - 1) { want = toP + Math.PI; moving = 1; }
        else if (keep && dist < keep + 2) { moving = 0; e.strafeT -= dt; if (e.strafeT <= 0) { e.strafeT = rand(1, 2.5); e.strafe *= -1; } const sa = toP + (Math.PI / 2) * e.strafe; e.pos.x += Math.sin(sa) * spd * 0.5 * dt; e.pos.z += Math.cos(sa) * spd * 0.5 * dt; an.walk = 0.6; }
        else if (dist > melee + 0.6) { moving = 1; if (dist < melee + 4 && (e.boss || def.flags.dodge)) { e.strafeT -= dt; if (e.strafeT <= 0) { e.strafeT = rand(0.8, 2); e.strafe = Math.random() < 0.5 ? 1 : -1; } const sa = toP + (Math.PI / 2) * e.strafe * 0.6; want = sa; } }
        else { moving = 0; e.strafeT -= dt; if (e.strafeT <= 0) { e.strafeT = rand(0.8, 1.8); e.strafe *= -1; } const sa = toP + (Math.PI / 2) * e.strafe; e.pos.x += Math.sin(sa) * spd * 0.4 * dt; e.pos.z += Math.cos(sa) * spd * 0.4 * dt; an.walk = 0.5; }
        // defensive dodge
        if (def.flags.dodge && e.dodgeT <= 0 && (p.state === 'attack' || p.state === 'heavy' || p.state === 'skill') && dist < 3.5 && Math.abs(angDiff(p.yaw, toP + Math.PI)) < 0.9 && Math.random() < 0.03) { e.dodgeT = 2.5; const sa = toP + (Math.PI / 2) * (Math.random() < 0.5 ? 1 : -1); e.vel.set(Math.sin(sa) * 11, 0, Math.cos(sa) * 11); G.fx!.dust(e.pos, 5); }
        if (!e.boss && !def.flags.keep && dist > def.detect * 2.2 && !e.aggro) e.state = 'idle';
        break;
      }
      case 'windup': {
        const a = e.atk!; const u = e.t / e.transT; const track = u < 0.6; want = track ? toP : e.yaw;
        if (a.shape === 'leap') { if (track) e.aim.set(p.pos.x, p.pos.y, p.pos.z); }
        an.pt = 0.22 * u; if (a.shape === 'line' || a.shape === 'dash' || a.shape === 'proj' || a.shape === 'summon') an.pt = u;
        const tl = getTele(e);
        if (tl) {
          const f = fwd(e.yaw, T2);
          if (a.shape === 'circle') tl.set(u, e.pos.x + f.x * a.off, e.pos.z + f.z * a.off, e.yaw, rt.hAt(e.pos.x + f.x * a.off, e.pos.z + f.z * a.off));
          else if (a.shape === 'leap') tl.set(u, e.aim.x, e.aim.z, 0, rt.hAt(e.aim.x, e.aim.z));
          else tl.set(u, e.pos.x, e.pos.z, e.yaw, e.pos.y);
        }
        if (e.t >= e.transT) { e.state = 'active'; e.t = 0; e.transT = a.shape === 'leap' ? 0.38 : a.shape === 'dash' ? 0.3 : 0.22; e.from.copy(e.pos); if (a.shape !== 'leap' && a.shape !== 'dash') { doHit(e, a); e.atkDone = true; } else audio.sfx('swing2'); clearTele(e); if (a.shape === 'dash') G.fx!.trail(e.pos.clone(), T.set(e.pos.x + Math.sin(e.yaw) * a.range, e.pos.y, e.pos.z + Math.cos(e.yaw) * a.range).clone(), { color: a.color, core: 0xffffff, width: 1.2, life: 0.4 }); }
        break;
      }
      case 'active': {
        const a = e.atk!; const u = clamp(e.t / e.transT, 0, 1);
        if (a.shape === 'dash') { const sp = a.range / e.transT; e.pos.x += Math.sin(e.yaw) * sp * dt; e.pos.z += Math.cos(e.yaw) * sp * dt; an.pt = u; if (!e.atkDone && dist < a.w * 0.6 + 0.5) { e.atkDone = true; hurtPlayer(e.def.dmg * a.dmg * e.dmgMul, e.pos, { kb: a.kb, status: a.status }, e); } if (Math.random() < 0.6) G.fx!.add.emit(e.pos.x, e.pos.y + 1, e.pos.z, 0, 0, 0, 0.3, 0.6, 0.05, a.color, 0.4); }
        else if (a.shape === 'leap') { e.pos.x = e.from.x + (e.aim.x - e.from.x) * u; e.pos.z = e.from.z + (e.aim.z - e.from.z) * u; e.model.group.position.y = e.pos.y + Math.sin(u * Math.PI) * 3.2; an.pose = 'air'; if (u >= 1 && !e.atkDone) { e.atkDone = true; const c = T.set(e.pos.x, e.pos.y, e.pos.z).clone(); G.fx!.ring(c, a.range, a.color, 0.5); G.fx!.dust(c, 14); G.fx!.sparks(c.clone().setY(1), 12, a.color, 7); rt.shake = Math.max(rt.shake, 0.5); audio.sfx('quake'); if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < a.range + 0.3) hurtPlayer(e.def.dmg * a.dmg * e.dmgMul, c, { kb: a.kb, status: a.status }, e); } }
        else { an.pt = 0.22 + 0.28 * u; if (a.shape === 'proj' || a.shape === 'summon') an.pt = 0.5 + u * 0.1; }
        if (e.t >= e.transT) { if (a.shape === 'leap' && !e.atkDone) { e.atkDone = true; } startRecover(e); }
        break;
      }
      case 'recover': {
        const a = e.atk; an.pt = 0.5 + 0.5 * clamp(e.t / e.transT, 0, 1); if (a && (a.shape === 'line' || a.shape === 'dash' || a.shape === 'proj' || a.shape === 'summon')) an.pose = a.shape === 'proj' || a.shape === 'summon' ? 'cast' : 'thrust'; if (!a) an.pose = 'hurt';
        want = e.yaw; if (e.t >= e.transT) { e.state = 'chase'; e.atk = null; an.pose = 'idle'; }
        break;
      }
      case 'stagger':
        an.pose = 'stagger'; if (Math.random() < 0.15) G.fx!.add.emit(e.pos.x + rand(-0.4, 0.4), e.pos.y + 2.3 * def.scale, e.pos.z + rand(-0.4, 0.4), 0, 0, 0, 0.5, 0.35, 0.05, 0xffe14a, 0.9);
        if (e.t >= e.transT) { e.state = 'chase'; an.pose = 'idle'; e.posture = 0; }
        break;
      default: break;
    }
    // movement
    if (moving > 0) { e.pos.x += Math.sin(want) * spd * moving * dt; e.pos.z += Math.cos(want) * spd * moving * dt; }
    if (e.state !== 'hidden') e.yaw += angDiff(e.yaw, want) * (1 - Math.exp(-(e.state === 'windup' ? 12 : 8) * dt));
    e.pos.addScaledVector(e.vel, dt); e.vel.multiplyScalar(Math.exp(-8 * dt));
    // separation
    for (const o of list) { if (o === e || o.state === 'dead') continue; const ox = e.pos.x - o.pos.x; const oz = e.pos.z - o.pos.z; const dd = Math.hypot(ox, oz); const min = (e.def.radius * e.def.scale + o.def.radius * o.def.scale) * 1.1; if (dd < min && dd > 0.001) { e.pos.x += (ox / dd) * (min - dd) * 0.5; e.pos.z += (oz / dd) * (min - dd) * 0.5; } }
    if (dist < 0.9 * def.scale && e.state !== 'active') { e.pos.x -= (dx / Math.max(dist, 0.01)) * 2 * dt; e.pos.z -= (dz / Math.max(dist, 0.01)) * 2 * dt; }
    resolveCollisions(e.pos, def.radius * def.scale * 0.8);
    e.pos.y = damp(e.pos.y, rt.hAt(e.pos.x, e.pos.z), 20, dt);
    if (e.state !== 'recover' && e.state !== 'stagger' && e.state !== 'windup' && e.state !== 'active' && e.state !== 'intro') { an.walk = damp(an.walk, moving > 0 ? moving : an.walk > 0.5 ? an.walk : 0, 10, dt); if (moving === 0 && !(e.state === 'chase' && dist < 3)) an.walk = damp(an.walk, 0, 10, dt); }
    else if (e.state !== 'active') an.walk = damp(an.walk, 0, 12, dt);
    if (e.state === 'recover' && an.pose === 'hurt') { an.pt = clamp(e.t / Math.max(0.1, e.transT), 0, 1); an.expr = 'hurt'; }
    m.group.position.set(e.pos.x, e.state === 'active' && e.atk?.shape === 'leap' ? m.group.position.y : e.pos.y, e.pos.z); m.group.rotation.y = e.yaw;
    if (e.state === 'active' && e.atk?.shape === 'leap') { /* y set above */ } else m.group.position.y = e.pos.y;
    m.update(dt, rt.time);
  }
}

// ---------------- ambient spawning ----------------
let spawnTimer = 3;
export function updateAmbient(dt: number, allow: boolean) {
  const reg = REGION_BY_ID[rt.region]; const p = rt.player!; const cap = Math.max(1, Math.round(reg.spawn.max * (G.quality.density > 0.5 ? 1 : 0.6)));
  // cull far ambient
  rt.enemies.forEach((e) => { if (e.tag === 'ambient' && e.state !== 'dead' && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > 85) removeEnemy(e); });
  if (!allow) return; spawnTimer -= dt; if (spawnTimer > 0) return; spawnTimer = rand(5, 9);
  const n = rt.enemies.filter((e) => e.tag === 'ambient' && e.state !== 'dead').length; if (n >= cap) return;
  spawnAmbientAt(p.pos, rand(22, 38));
}
export function spawnAmbientAt(center: THREE.Vector3, radius: number) {
  const reg = REGION_BY_ID[rt.region]; const types = rt.nightMix > 0.5 ? reg.spawn.night : reg.spawn.types;
  for (let t = 0; t < 8; t++) {
    const a = rand(0, 6.28); const x = center.x + Math.sin(a) * radius; const z = center.z + Math.cos(a) * radius; if ((x / rt.bounds.hx) ** 2 + (z / rt.bounds.hz) ** 2 > 0.85) continue;
    if (rt.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1)) continue;
    const e = spawnEnemy(types[Math.floor(Math.random() * types.length)], new THREE.Vector3(x, rt.hAt(x, z), z), { tag: 'ambient' }); G.fx!.sparks(T.set(x, 0.5, z), 6, 0x7a4a90, 2, 0.2, 0.5); return e;
  }
  return null;
}

export function bossHud(e: EnemyRT | null) {
  if (!e || !e.boss) { if (useHud.getState().boss) useHud.setState({ boss: null }); return; }
  useHud.setState({ boss: { name: e.def.name, title: e.boss.title, hp: e.hp, max: e.maxHp, phase: e.boss.phaseNames?.[e.phase] ?? (e.boss.phases.length ? `Phase ${e.phase + 1}` : ''), color: e.boss.color } });
  void hex;
}
export { staggerEnemy };
