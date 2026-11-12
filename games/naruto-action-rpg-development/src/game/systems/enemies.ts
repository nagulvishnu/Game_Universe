import type { PatternDef } from '../types';
import { newPose } from '../types';
import { rt, nextId, bump, yawTo, angleDiff, lerpAngle, type EnemyRT, type CampRT } from '../runtime';
import { getEnemy, enemyScale } from '../data/enemies';
import { CAMPS } from '../data/world';
import { moveXZ, snapGround } from './move';
import { damagePlayer, hitEnemy, floater, shake, spawnProjectile, explosion, killEnemy } from './combat';
import { burst, ring, trail } from './fx';
import { audio } from '../audio';
import { bus } from '../bus';
import { segmentHitsWall } from '../logic/collision';
import { showBanner } from '../hudStore';

export const ENEMY_CAP = 22;

export interface SpawnOpts { lv?: number; tag?: string; camp?: string; mission?: boolean; summoned?: boolean; aggro?: boolean }
export function spawnEnemy(defId: string, x: number, z: number, o: SpawnOpts = {}): EnemyRT | null {
  const def = getEnemy(defId);
  if (rt.enemies.length >= ENEMY_CAP && !o.mission && def.tier !== 'boss') return null;
  const lv = o.lv ?? 1; const sc = enemyScale(lv);
  const e: EnemyRT = {
    id: nextId(), def, pos: { x, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, yaw: Math.random() * 6.28, hp: def.hp * sc.hp, maxHp: def.hp * sc.hp, dmgMul: sc.dmg, lv,
    tag: o.tag, camp: o.camp, state: def.tier === 'boss' ? 'chase' : 'patrol', stateT: 0, pose: newPose(), home: { x, z }, patrol: { x, z, wait: Math.random() * 2 }, poise: def.poise,
    status: { stun: 0, confuse: 0, burn: 0, slow: 0 }, pattern: null, patCd: {}, atk: { tx: 0, tz: 0, dx: 0, dz: 1, done: false, dashT: 0 }, phase: 0, invuln: 0, shield: 0, shieldT: 0,
    vanish: 0, flash: 0, dodgeCd: 0, blockCd: 0, deadT: 0, aggro: !!o.aggro || def.tier === 'boss', strafe: Math.random() < 0.5 ? 1 : -1,
    radius: (def.radius ?? 0.5) * (def.look.scale ?? 1) / (def.radius ? 1 : 1), fromMission: !!o.mission, attackToken: false, burnTick: 0, confusedTarget: null, decideT: Math.random() * 0.4, summoned: !!o.summoned,
  };
  e.pose.style = def.look.weapon === 'sword' || def.look.weapon === 'bigSword' ? 'swordsman' : def.ai === 'brute' ? 'heavy' : 'brawler';
  snapGround(e.pos);
  rt.enemies.push(e);
  if (def.tier === 'boss') rt.boss = e;
  burst(x, 0.6, z, { n: 8, color: '#ffffff', speed: 2, life: 0.4 });
  bump('enemies');
  return e;
}

export function removeEnemy(e: EnemyRT) {
  const i = rt.enemies.indexOf(e); if (i >= 0) rt.enemies.splice(i, 1);
  if (rt.lock === e) rt.lock = null; if (rt.boss === e) rt.boss = null;
  bump('enemies');
}
export function clearEnemies(pred: (e: EnemyRT) => boolean = () => true) {
  rt.enemies = rt.enemies.filter((e) => !pred(e)); if (rt.lock && !rt.enemies.includes(rt.lock)) rt.lock = null; if (rt.boss && !rt.enemies.includes(rt.boss)) rt.boss = null; bump('enemies');
}

// ------------------------------------------------------------------ steering
function walk(e: EnemyRT, tx: number, tz: number, speed: number, dt: number, face = true) {
  const dx = tx - e.pos.x, dz = tz - e.pos.z; const d = Math.hypot(dx, dz) || 1;
  const slow = e.status.slow > 0 ? 0.5 : 1;
  const sp = speed * slow;
  e.vel.x += ((dx / d) * sp - e.vel.x) * Math.min(1, dt * 9); e.vel.z += ((dz / d) * sp - e.vel.z) * Math.min(1, dt * 9);
  if (face && d > 0.2) e.yaw = lerpAngle(e.yaw, yawTo(dx, dz), dt * 9);
}
function idle(e: EnemyRT, dt: number) { e.vel.x *= Math.max(0, 1 - dt * 10); e.vel.z *= Math.max(0, 1 - dt * 10); }

const isDead = (e: EnemyRT) => e.state === 'dead';
function chooseAttacker(): number { return rt.enemies.filter((e) => e.def.tier === 'minion' && (e.state === 'windup' || e.state === 'attack')).length; }

function pickPattern(e: EnemyRT, dp: number): PatternDef | null {
  const list = e.def.patterns.filter((p) => dp >= p.min && dp <= p.max && (e.patCd[p.id] ?? 0) <= 0 && (p.phase ?? 0) <= e.phase);
  if (!list.length) return null;
  if (list.some((p) => p.kind === 'summon') && rt.enemies.filter((x) => x.summoned && x.state !== 'dead').length >= 3) { const nl = list.filter((p) => p.kind !== 'summon'); if (nl.length) return weighted(nl); return null; }
  return weighted(list);
}
function weighted(list: PatternDef[]): PatternDef {
  let tot = 0; for (const p of list) tot += p.weight ?? 1; let r = Math.random() * tot;
  for (const p of list) { r -= p.weight ?? 1; if (r <= 0) return p; } return list[0];
}

function startWindup(e: EnemyRT, pat: PatternDef, tx: number, tz: number) {
  e.state = 'windup'; e.stateT = 0; e.pattern = pat; e.atk.done = false; e.atk.dashT = 0;
  const dx = tx - e.pos.x, dz = tz - e.pos.z; const d = Math.hypot(dx, dz) || 1; e.atk.dx = dx / d; e.atk.dz = dz / d; e.atk.tx = tx; e.atk.tz = tz;
  const wu = pat.windup * Math.pow(0.9, e.phase);
  const tele = (shape: 'circle' | 'cone' | 'line', x: number, z: number, r: number, yaw: number, angle: number) => rt.telegraphs.push({ id: nextId(), shape, x, z, r, yaw, angle, t: 0, dur: wu, color: pat.element === 'water' ? '#4aa8ff' : '#ff2a2a' });
  switch (pat.kind) {
    case 'melee': tele('cone', e.pos.x, e.pos.z, (pat.reach ?? 3.3) + 0.4, yawTo(dx, dz), 2.2); break;
    case 'spin': tele('circle', e.pos.x, e.pos.z, pat.radius ?? 3.5, 0, 0); break;
    case 'dash': tele('line', e.pos.x, e.pos.z, pat.dist ?? 8, yawTo(dx, dz), 1.6); break;
    case 'slam': tele('circle', tx, tz, pat.radius ?? 5, 0, 0); break;
    case 'mistStrike': e.vanish = wu + 0.25; rt.mistT = Math.max(rt.mistT, wu + 3.5); burst(e.pos.x, 1, e.pos.z, { n: 30, color: '#cfe0ea', speed: 4, life: 1, size: 0.8 }); break;
    case 'shield': burst(e.pos.x, 1.5, e.pos.z, { n: 20, color: pat.color ?? '#e6c887', speed: 5, life: 0.5 }); break;
    default: break;
  }
  if (e.def.tier !== 'dummy') audio.sfx('telegraph', 0.8);
  if (e.def.tier === 'boss' || e.def.tier === 'elite') floater(e.pos.x, e.pos.y + 3.6 * (e.def.look.scale ?? 1), e.pos.z, pat.name.toUpperCase(), pat.element === 'water' ? '#6ab0ff' : '#ffb84a', 0.9);
  else floater(e.pos.x, e.pos.y + 2.9, e.pos.z, '!', '#ff3a3a', 1.1);
}

function hostileShot(e: EnemyRT, yaw: number, pat: PatternDef, confuse = false) {
  const sp = pat.speed ?? 16; const raw = e.def.dmg * e.dmgMul * pat.power;
  spawnProjectile({
    x: e.pos.x + Math.sin(yaw) * 0.9, y: e.pos.y + 1.4, z: e.pos.z + Math.cos(yaw) * 0.9, vx: Math.sin(yaw) * sp, vz: Math.cos(yaw) * sp, dmg: raw, life: 2.2,
    radius: pat.radius ?? 1, explode: pat.element === 'fire' ? 3 : 0, element: pat.element ?? 'none', hostile: true, size: 0.55, color: pat.color ?? '#ff6a1a', kind: 'orb', confuse,
  });
}

function execute(e: EnemyRT) {
  const pat = e.pattern!; const p = rt.player; const raw = e.def.dmg * e.dmgMul * pat.power * (1 + e.phase * 0.08);
  const dxp = p.pos.x - e.pos.x, dzp = p.pos.z - e.pos.z; const dp = Math.hypot(dxp, dzp);
  const aim = yawTo(dxp, dzp);
  const hitClones = (reach: number, cone: boolean) => { for (const a of rt.allies) { if (a.kind !== 'clone' || a.life <= 0) continue; const d = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z); if (d < reach && (!cone || Math.abs(angleDiff(e.yaw, yawTo(a.pos.x - e.pos.x, a.pos.z - e.pos.z))) < 1.2)) { a.life = 0; burst(a.pos.x, 1, a.pos.z, { n: 14, color: '#fff', speed: 3 }); } } };
  switch (pat.kind) {
    case 'melee': {
      const reach = (pat.reach ?? 3.3) + 0.4; e.yaw = e.def.tier === 'boss' ? e.yaw : lerpAngle(e.yaw, aim, 0.5);
      burst(e.pos.x + Math.sin(e.yaw) * reach * 0.7, 1.2, e.pos.z + Math.cos(e.yaw) * reach * 0.7, { n: 10, color: pat.element === 'water' ? '#8ac8ff' : '#ffffff', speed: 4, life: 0.25 });
      if (dp < reach + 0.3 && Math.abs(angleDiff(e.yaw, aim)) < 1.15) damagePlayer(raw, e.pos.x, e.pos.z, { src: e, stagger: true, unblockable: pat.unblockable });
      hitClones(reach, true); audio.sfx('swing', 0.9); break;
    }
    case 'spin': {
      const r = (pat.radius ?? 3.5) + 0.3; ring(e.pos.x, 0.6, e.pos.z, { color: '#ffffff', r1: r, life: 0.3 });
      burst(e.pos.x, 1.2, e.pos.z, { n: 16, color: '#ffffff', speed: r * 2, life: 0.25 });
      if (dp < r + 0.3) damagePlayer(raw, e.pos.x, e.pos.z, { src: e, stagger: true, unblockable: pat.unblockable }); hitClones(r, false); audio.sfx('swing', 1); break;
    }
    case 'dash': {
      const dist = Math.min(pat.dist ?? 8, Math.max(2, dp + 1.5)); e.atk.dashT = 0.32; e.atk.dx = Math.sin(aim); e.atk.dz = Math.cos(aim); e.yaw = aim;
      e.vel.x = (e.atk.dx * dist) / 0.32; e.vel.z = (e.atk.dz * dist) / 0.32; audio.sfx('dodge', 0.9); break;
    }
    case 'slam': {
      const r = pat.radius ?? 5; explosion(e.atk.tx, 0.8, e.atk.tz, r, pat.color ?? '#d29a5a', e.def.tier === 'boss');
      if (Math.hypot(p.pos.x - e.atk.tx, p.pos.z - e.atk.tz) < r && p.pos.y < 2.2) damagePlayer(raw, e.atk.tx, e.atk.tz, { src: e, stagger: true, unblockable: true, element: pat.element });
      for (const a of rt.allies) if (a.kind === 'clone' && Math.hypot(a.pos.x - e.atk.tx, a.pos.z - e.atk.tz) < r) a.life = 0;
      break;
    }
    case 'ranged': hostileShot(e, aim, pat); audio.sfx(pat.element === 'fire' ? 'fire' : 'jutsu', 0.8); break;
    case 'genjutsu': hostileShot(e, aim, pat, true); audio.sfx('jutsu', 0.8); break;
    case 'fan': {
      const n = pat.count ?? 3; const spr = pat.spread ?? 0.5;
      for (let i = 0; i < n; i++) hostileShot(e, aim + (n > 1 ? (i / (n - 1) - 0.5) * spr : 0), pat);
      audio.sfx(pat.element === 'water' ? 'water' : pat.element === 'fire' ? 'fire' : 'jutsu', 0.9); break;
    }
    case 'summon': {
      const n = pat.count ?? 2;
      for (let i = 0; i < n; i++) { const a = aim + (i - (n - 1) / 2) * 1.4 + Math.PI; const s = spawnEnemy(pat.summon ?? 'rogue', e.pos.x + Math.sin(a) * 3.5, e.pos.z + Math.cos(a) * 3.5, { lv: e.lv, tag: e.tag ? e.tag + '_s' : undefined, mission: e.fromMission, summoned: true, aggro: true }); if (s) { s.state = 'chase'; ring(s.pos.x, 0.3, s.pos.z, { color: '#4aa8ff', r1: 2, life: 0.4 }); } }
      audio.sfx('clone'); break;
    }
    case 'mistStrike': {
      const bx = p.pos.x - Math.sin(p.yaw) * 2.6, bz = p.pos.z - Math.cos(p.yaw) * 2.6;
      burst(e.pos.x, 1, e.pos.z, { n: 20, color: '#cfe0ea', speed: 3, life: 0.6, size: 0.7 }); e.pos.x = bx; e.pos.z = bz; moveXZ(e.pos, 0, 0, e.radius); e.yaw = yawTo(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
      burst(e.pos.x, 1, e.pos.z, { n: 24, color: '#cfe0ea', speed: 4, life: 0.6, size: 0.7 }); e.vanish = 0; audio.sfx('swing', 1);
      damagePlayer(raw, e.pos.x, e.pos.z, { src: e, stagger: true }); break;
    }
    case 'shield': {
      e.shield = e.maxHp * (pat.amount ?? 0.1); e.shieldT = 6; ring(e.pos.x, 1, e.pos.z, { color: pat.color ?? '#e6c887', r1: 3, life: 0.5 });
      floater(e.pos.x, e.pos.y + 3.2, e.pos.z, 'SAND SHIELD!', '#e6c887', 1.1); audio.sfx('jutsu'); break;
    }
  }
}


function startPhase(e: EnemyRT) {
  e.state = 'phase'; e.stateT = 0; e.pattern = null; e.invuln = 1.7; e.vanish = 0; e.pose.state = 'cast'; e.shield = 0;
  rt.telegraphs = rt.telegraphs.filter(() => false);
  const line = e.def.phaseLines?.[e.phase - 1]; if (line) showBanner(e.def.name, line, 3200);
  shake(0.9); rt.flash = 0.4; rt.flashColor = e.def.color; audio.sfx('bossIntro');
  ring(e.pos.x, 0.3, e.pos.z, { color: e.def.color, r1: 9, life: 0.8 }); burst(e.pos.x, 1.5, e.pos.z, { n: 50, color: e.def.color, color2: '#fff', speed: 8, life: 1, size: 0.5 });
  if (e.def.id === 'zabuza') rt.mistT = 14;
  for (const k in e.patCd) e.patCd[k] = Math.max(e.patCd[k], 0.5);
}
bus.on('bossPhase', (e: EnemyRT) => { if (e.state !== 'dead') startPhase(e); });

// ------------------------------------------------------------------ main update
export function updateEnemies(dt: number) {
  const p = rt.player; const list = rt.enemies; const frozen = !!rt.cine?.freeze;
  const attackers = chooseAttacker(); const maxAtk = list.length > 8 ? 3 : 2; let tokens = maxAtk - attackers;
  let removed = false;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]; const def = e.def;
    e.stateT += dt; e.pose.t += dt; e.pose.form = 'base';
    for (const k in e.patCd) e.patCd[k] -= dt;
    e.dodgeCd -= dt; e.blockCd -= dt; e.invuln = Math.max(0, e.invuln - dt); e.vanish = Math.max(0, e.vanish - dt);
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 4);
    e.pose.flash = Math.max(e.pose.flash - dt * 4, 0);
    e.pose.alpha = e.vanish > 0.3 ? 0.06 : 1;
    if (e.state === 'dead') { e.deadT += dt; e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; e.vel.x *= 0.9; e.vel.z *= 0.9; e.pose.alpha = e.deadT > 2 ? Math.max(0, 1 - (e.deadT - 2) / 0.8) : 1; if (e.deadT > 2.8) { list.splice(i, 1); removed = true; if (rt.boss === e) rt.boss = null; } continue; }
    if (frozen) { idle(e, dt); continue; }
    const dxp = p.pos.x - e.pos.x, dzp = p.pos.z - e.pos.z; const dp = Math.hypot(dxp, dzp);
    if (dp > 150 && !e.fromMission && def.tier !== 'boss') continue; // dormant
    // status effects
    for (const s of ['stun', 'confuse', 'burn', 'slow'] as const) if (e.status[s] > 0) e.status[s] = Math.max(0, e.status[s] - dt);
    if (e.status.burn > 0) { e.burnTick -= dt; if (e.burnTick <= 0) { e.burnTick = 0.5; hitEnemy(e, { power: 0.35, atk: rt.player.stats.atk, element: 'fire', knock: 0, stagger: 0, source: 'dot', noUlt: true, quiet: true }); burst(e.pos.x, 1.6, e.pos.z, { n: 3, color: '#ff7a2a', speed: 1.5, up: 2, life: 0.5 }); if (isDead(e)) continue; } }
    if (e.shieldT > 0) { e.shieldT -= dt; if (e.shieldT <= 0) e.shield = 0; }
    if (e.status.confuse > 0 && Math.random() < dt * 4) burst(e.pos.x, 2.5, e.pos.z, { n: 1, color: '#ff9ad0', speed: 1, up: 1, life: 0.6 });

    // ---- state machine
    let speedBase = def.speed * (e.phase > 0 ? 1 + 0.1 * e.phase : 1);
    switch (e.state) {
      case 'patrol': {
        if (def.ai === 'dummy') { idle(e, dt); e.pose.state = 'idle'; break; }
        e.patrol.wait -= dt;
        if (e.patrol.wait > 0) { idle(e, dt); e.pose.state = 'idle'; }
        else {
          const d = Math.hypot(e.patrol.x - e.pos.x, e.patrol.z - e.pos.z);
          if (d < 1) { const a = Math.random() * 6.28, r = 3 + Math.random() * 6; e.patrol = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r, wait: 1.5 + Math.random() * 3 }; }
          else { walk(e, e.patrol.x, e.patrol.z, speedBase * 0.4, dt); e.pose.state = 'run'; }
        }
        e.decideT -= dt;
        if (e.decideT <= 0) {
          e.decideT = 0.25;
          const fov = Math.abs(angleDiff(e.yaw, yawTo(dxp, dzp))) < 1.3;
          if (e.aggro || (dp < def.detect && (dp < 7 || fov) && Math.abs(p.pos.y - e.pos.y) < 6 && !segmentHitsWall(rt.colliders, e.pos.x, e.pos.z, p.pos.x, p.pos.z, 2.5))) { e.state = 'alert'; e.stateT = 0; floater(e.pos.x, e.pos.y + 2.8, e.pos.z, '!', '#ffd24a', 1.2); alertGroup(e); }
        }
        break;
      }
      case 'alert': {
        idle(e, dt); e.yaw = lerpAngle(e.yaw, yawTo(dxp, dzp), dt * 10); e.pose.state = 'idle';
        if (e.stateT > 0.4) { e.state = 'chase'; e.stateT = 0; }
        break;
      }
      case 'chase': {
        // confusion: wander and attack allies
        if (e.status.confuse > 0) {
          if (!e.confusedTarget || e.confusedTarget.state === 'dead') { let b: EnemyRT | null = null; let bd = 14; for (const o of list) if (o !== e && o.state !== 'dead') { const d = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z); if (d < bd) { bd = d; b = o; } } e.confusedTarget = b; }
          const t = e.confusedTarget;
          if (t) { const d = Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z); if (d > 1.8) { walk(e, t.pos.x, t.pos.z, speedBase * 0.8, dt); e.pose.state = 'run'; } else { idle(e, dt); e.atk.dashT -= dt; if (e.atk.dashT <= 0) { e.atk.dashT = 1.1; e.pose.state = 'attack'; e.pose.t = 0; e.pose.dur = 0.3; hitEnemy(t, { power: 1, atk: def.dmg * e.dmgMul * 1.5, source: 'ally', knock: 2, noUlt: true, stagger: 10 }); } } }
          else { walk(e, e.pos.x + Math.sin(rt.t * 2 + e.id) * 4, e.pos.z + Math.cos(rt.t * 1.7 + e.id) * 4, speedBase * 0.4, dt); e.pose.state = 'run'; }
          break;
        }
        // choose target: nearest taunting clone beats the player
        let tx = p.pos.x, tz = p.pos.z, td = dp; let clone = false;
        for (const a of rt.allies) { if (a.kind !== 'clone') continue; const d = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z); if (d < 9 && d < td * 0.8) { tx = a.pos.x; tz = a.pos.z; td = d; clone = true; } }
        if (def.ai === 'dummy') { idle(e, dt); e.pose.state = 'idle'; break; }
        e.yaw = lerpAngle(e.yaw, yawTo(tx - e.pos.x, tz - e.pos.z), dt * 8);
        if (p.dead && !clone) { idle(e, dt); e.pose.state = 'idle'; break; }
        // lose interest
        if (!e.aggro || (dp > def.detect * 2.4 && def.tier !== 'boss' && !e.fromMission)) { if (dp > def.detect * 2.4 && def.tier !== 'boss') { e.state = 'patrol'; e.aggro = false; e.patrol.wait = 1; break; } }
        e.decideT -= dt;
        const wantAttack = e.decideT <= 0;
        if (wantAttack) e.decideT = 0.12 + Math.random() * 0.2;
        const pat = wantAttack ? pickPattern(e, td) : null;
        const isMinion = def.tier === 'minion';
        if (pat && (!isMinion || tokens > 0 || pat.kind === 'ranged' || pat.kind === 'genjutsu') && Math.random() < (def.tier === 'boss' ? 0.9 : 0.55)) {
          if (isMinion && pat.kind !== 'ranged' && pat.kind !== 'genjutsu') tokens--;
          startWindup(e, pat, tx, tz); break;
        }
        // movement by AI archetype
        const near = def.patterns.length ? Math.min(...def.patterns.map((q) => q.max)) : 3;
        if (def.ai === 'ranged') {
          if (td < 7) { walk(e, e.pos.x - (tx - e.pos.x), e.pos.z - (tz - e.pos.z), speedBase * 0.9, dt, false); e.yaw = lerpAngle(e.yaw, yawTo(tx - e.pos.x, tz - e.pos.z), dt * 8); e.pose.state = 'run'; }
          else if (td > 13) { walk(e, tx, tz, speedBase, dt); e.pose.state = 'run'; }
          else { strafe(e, tx, tz, speedBase * 0.5, dt); }
        } else if (def.ai === 'skirmisher') {
          if (td > 9) { walk(e, tx, tz, speedBase, dt); e.pose.state = 'run'; } else if (td < 4) { walk(e, e.pos.x - (tx - e.pos.x), e.pos.z - (tz - e.pos.z), speedBase * 0.8, dt, false); e.pose.state = 'run'; } else strafe(e, tx, tz, speedBase * 0.8, dt);
        } else if (def.ai === 'boss') {
          const desired = e.phase >= 1 && Math.random() < 0.002 ? 9 : 4.2;
          if (td > desired + 0.8) { walk(e, tx, tz, speedBase * (td > 12 ? 1.35 : 1), dt); e.pose.state = 'run'; }
          else if (td < desired - 1.5) { walk(e, e.pos.x - (tx - e.pos.x), e.pos.z - (tz - e.pos.z), speedBase * 0.6, dt, false); e.pose.state = 'run'; }
          else strafe(e, tx, tz, speedBase * 0.45, dt);
        } else {
          const stand = Math.max(1.6, Math.min(near * 0.7, 3));
          if (td > stand + 0.6) { if (isMinion && tokens <= 0 && td < 7) strafe(e, tx, tz, speedBase * 0.5, dt); else { walk(e, tx, tz, speedBase, dt); e.pose.state = 'run'; } }
          else if (isMinion && tokens <= 0) strafe(e, tx, tz, speedBase * 0.5, dt);
          else { idle(e, dt); e.pose.state = 'idle'; }
        }
        break;
      }
      case 'windup': {
        const pat = e.pattern; if (!pat) { e.state = 'chase'; break; }
        const wu = pat.windup * Math.pow(0.9, e.phase);
        e.pose.state = 'windup'; e.pose.dur = wu; e.pose.flash = 0.35 + 0.35 * Math.sin(e.stateT * 24); e.pose.flashColor = '#ff2a1a';
        if (pat.kind === 'mistStrike') {
          // circle invisibly around the player
          const a = rt.t * 3 + e.id; walk(e, p.pos.x + Math.cos(a) * 7, p.pos.z + Math.sin(a) * 7, speedBase * 3, dt, false); e.yaw = yawTo(dxp, dzp);
          if (Math.random() < dt * 20) burst(e.pos.x, 1, e.pos.z, { n: 2, color: '#cfe0ea', speed: 1, life: 0.6, size: 0.7 });
        } else {
          idle(e, dt);
          if (pat.kind !== 'slam' && e.stateT < wu * 0.7) { e.yaw = lerpAngle(e.yaw, yawTo(dxp, dzp), dt * (def.tier === 'boss' ? 7 : 5)); }
          if (pat.kind === 'slam' && e.def.tier === 'boss' && e.stateT < wu * 0.5) { e.atk.tx += (p.pos.x - e.atk.tx) * Math.min(1, dt * 2.5); e.atk.tz += (p.pos.z - e.atk.tz) * Math.min(1, dt * 2.5); const tg = rt.telegraphs.find((t) => t.shape === 'circle' && Math.abs(t.t - e.stateT) < 0.2 && t.dur === wu); if (tg) { tg.x = e.atk.tx; tg.z = e.atk.tz; } }
        }
        if (e.stateT >= wu) { execute(e); e.state = 'attack'; e.stateT = 0; e.pose.state = 'attack'; e.pose.t = 0; e.pose.dur = 0.3; e.pose.variant = (e.pose.variant + 1) % 3; }
        break;
      }
      case 'attack': {
        const pat = e.pattern;
        if (pat?.kind === 'dash' && e.atk.dashT > 0) {
          e.atk.dashT -= dt; trail(e.pos.x, 1, e.pos.z, def.color, 0.5, 0.35);
          if (!e.atk.done && Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < 1.5 + e.radius && Math.abs(p.pos.y - e.pos.y) < 2) { e.atk.done = true; damagePlayer(def.dmg * e.dmgMul * pat.power, e.pos.x - e.atk.dx, e.pos.z - e.atk.dz, { src: e, stagger: true, element: pat.element }); }
          for (const a of rt.allies) if (a.kind === 'clone' && Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) < 1.6) a.life = 0;
          if (e.atk.dashT <= 0) { e.vel.x *= 0.1; e.vel.z *= 0.1; e.state = 'recover'; e.stateT = 0; }
        } else if (e.stateT > 0.2) { e.state = 'recover'; e.stateT = 0; }
        if (e.state === 'attack') e.pose.state = 'attack';
        break;
      }
      case 'recover': {
        idle(e, dt); e.pose.state = 'idle'; const pat = e.pattern;
        if (!pat || e.stateT >= pat.recover) { if (pat) e.patCd[pat.id] = pat.cooldown ?? 1.2; e.pattern = null; e.state = 'chase'; e.stateT = 0; e.strafe = Math.random() < 0.5 ? 1 : -1; }
        break;
      }
      case 'hit': {
        idle(e, dt); e.pose.state = e.status.stun > 0 ? 'stun' : 'hit'; e.pose.dur = 0.4;
        if (e.stateT >= 0.42 && e.status.stun <= 0) { e.state = 'chase'; e.stateT = 0; e.aggro = true; }
        break;
      }
      case 'phase': {
        idle(e, dt); e.pose.state = 'cast'; e.pose.flash = 0.4; if (Math.random() < dt * 30) trail(e.pos.x + (Math.random() - 0.5) * 2, 0.5, e.pos.z + (Math.random() - 0.5) * 2, def.color, 0.5, 0.6);
        if (e.stateT >= 1.7) { e.state = 'chase'; e.stateT = 0; }
        break;
      }
    }
    // ---- integrate
    const spd = Math.hypot(e.vel.x, e.vel.z);
    if (spd > 0.01) {
      moveXZ(e.pos, e.vel.x * dt, e.vel.z * dt, e.radius * 0.9);
      snapGround(e.pos);
    }
    if (e.state === 'chase' || e.state === 'patrol') e.pose.speed += (Math.min(1.4, spd / 6) - e.pose.speed) * Math.min(1, dt * 10); else e.pose.speed *= 0.8;
    if (e.state === 'chase' && e.pose.state === 'run' && spd < 0.6) e.pose.state = 'idle';
    // separation
    for (let j = i - 1; j >= 0; j--) {
      const o = list[j]; if (o.state === 'dead') continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z; const d = Math.hypot(dx, dz); const min = e.radius + o.radius + 0.3;
      if (d < min && d > 0.001) { const push = (min - d) * 0.5; moveXZ(e.pos, (dx / d) * push, (dz / d) * push, e.radius * 0.9); moveXZ(o.pos, -(dx / d) * push, -(dz / d) * push, o.radius * 0.9); }
    }
    // boss arena clamp
    if (def.arena) { const ax = e.pos.x - def.arena.x, az = e.pos.z - def.arena.z; const ad = Math.hypot(ax, az); if (ad > def.arena.r) { e.pos.x = def.arena.x + (ax / ad) * def.arena.r; e.pos.z = def.arena.z + (az / ad) * def.arena.r; } }
    // soft clamp against the player standing on rooftops: give up
    if (e.state === 'chase' && p.pos.y > 2.5 && dp < 6 && e.pos.y < 0.5 && def.tier !== 'boss') { e.pose.state = 'idle'; }
  }
  if (removed) bump('enemies');
}

function strafe(e: EnemyRT, tx: number, tz: number, speed: number, dt: number) {
  const dx = tx - e.pos.x, dz = tz - e.pos.z; const d = Math.hypot(dx, dz) || 1;
  const sx = -dz / d * e.strafe, sz = dx / d * e.strafe; const pull = d > 6 ? 0.3 : d < 3 ? -0.3 : 0;
  e.vel.x += ((sx + (dx / d) * pull) * speed - e.vel.x) * Math.min(1, dt * 6); e.vel.z += ((sz + (dz / d) * pull) * speed - e.vel.z) * Math.min(1, dt * 6);
  e.yaw = lerpAngle(e.yaw, yawTo(dx, dz), dt * 8); e.pose.state = 'run';
  if (Math.random() < dt * 0.4) e.strafe *= -1;
}

function alertGroup(e: EnemyRT) {
  for (const o of rt.enemies) if (o !== e && o.state === 'patrol' && ((e.camp && o.camp === e.camp) || (e.tag && o.tag === e.tag)) && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 30) o.aggro = true;
}

export function updateTelegraphs(dt: number) {
  for (let i = rt.telegraphs.length - 1; i >= 0; i--) { const t = rt.telegraphs[i]; t.t += dt; if (t.t >= t.dur + 0.05) rt.telegraphs.splice(i, 1); }
}

// ------------------------------------------------------------------ camps
export function initCamps() {
  rt.camps = CAMPS.map((def) => ({ def, enemies: [], respawnAt: 0, active: false }));
}
export function updateCamps() {
  const p = rt.player;
  for (const c of rt.camps as CampRT[]) {
    const d = Math.hypot(c.def.pos[0] - p.pos.x, c.def.pos[1] - p.pos.z);
    if (c.active) {
      c.enemies = c.enemies.filter((e) => rt.enemies.includes(e));
      if (d > 160) { c.enemies.forEach((e) => { if (e.state !== 'dead') removeEnemy(e); }); c.enemies = []; c.active = false; c.respawnAt = 0; }
      else if (c.enemies.every((e) => e.state === 'dead') ) { c.active = false; c.enemies = []; c.respawnAt = rt.t + 150; }
    } else if (d < c.def.radius && rt.t >= c.respawnAt && !rt.boss && !missionBlocksCamp(c)) {
      for (const s of c.def.spawns) for (let i = 0; i < s.count; i++) {
        const a = Math.random() * 6.28, r = 2 + Math.random() * 6;
        const e = spawnEnemy(s.def, c.def.pos[0] + Math.cos(a) * r, c.def.pos[1] + Math.sin(a) * r, { lv: c.def.lv, camp: c.def.id });
        if (e) c.enemies.push(e);
      }
      c.active = c.enemies.length > 0;
    }
  }
}
function missionBlocksCamp(c: CampRT): boolean {
  const b = rt.mission; if (!b) return false;
  // do not spawn camps right on top of the boss arenas
  return [[-262, 0], [262, 44]].some(([x, z]) => Math.hypot(c.def.pos[0] - x, c.def.pos[1] - z) < 90);
}
export { killEnemy };
