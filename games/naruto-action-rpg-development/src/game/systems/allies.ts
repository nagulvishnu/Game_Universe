import type { LookDef } from '../types';
import { newPose } from '../types';
import { rt, nextId, bump, type AllyRT, type EnemyRT, yawTo, lerpAngle } from '../runtime';
import { CHARACTERS } from '../data/characters';
import { hitEnemy, areaDamage, floater, explosion } from './combat';
import { burst, ring, lineBurst } from './fx';
import { moveXZ, snapGround } from './move';
import { audio } from '../audio';
import type { CharId } from '../types';

const TAZUNA: LookDef = { skin: '#e8c4a0', hair: '#cfcfcf', hairStyle: 'spikyShort', outfit: '#8a7a5a', trim: '#5a4a30', pants: '#6a5a40', headband: null, weapon: 'none', scale: 0.95 };
const HOUND: LookDef = { skin: '#d8c8a0', hair: '#d8c8a0', hairStyle: 'spikyShort', outfit: '#cdb98a', trim: '#a08a5a', pants: '#cdb98a', headband: null, weapon: 'none', scale: 0.62 };

export function spawnClone(x: number, z: number, look: LookDef, life: number, power: number, hound = false) {
  const a: AllyRT = {
    id: nextId(), kind: 'clone', charId: hound ? 'hound' : rt.player.charId, look: hound ? HOUND : look, pos: { x, y: rt.player.pos.y, z }, vel: { x: 0, y: 0, z: 0 },
    yaw: rt.player.yaw, pose: newPose(), life, atkCd: 0.3 + Math.random() * 0.4, dmg: power, hp: 1, target: null, spCd: 0, element: 'none', scale: hound ? 0.62 : 1, fromMission: false,
  };
  rt.allies.push(a);
  burst(x, 1, z, { n: 16, color: '#ffffff', color2: '#d8e0f0', speed: 3.5, life: 0.5, size: 0.4 }); ring(x, 0.3, z, { color: '#ffffff', r1: 1.8, life: 0.3 });
  bump('allies');
  return a;
}

export function spawnCompanion(id: 'sasuke' | 'sakura' | 'kakashi' | 'tazuna', x: number, z: number) {
  if (rt.allies.some((a) => a.charId === id)) return;
  const look = id === 'tazuna' ? TAZUNA : CHARACTERS[id as CharId].look;
  const a: AllyRT = {
    id: nextId(), kind: id === 'tazuna' ? 'escort' : 'companion', charId: id, look, pos: { x, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pose: newPose(), life: 1e9,
    atkCd: 0.5, dmg: id === 'sakura' ? 1.25 : id === 'sasuke' ? 0.95 : 1, hp: 1, target: null, spCd: 3 + Math.random() * 2, element: id === 'sasuke' ? 'fire' : id === 'kakashi' ? 'lightning' : 'earth',
    scale: id === 'tazuna' ? 0.95 : 1, fromMission: true,
  };
  a.pose.style = id === 'sakura' ? 'heavy' : id === 'sasuke' ? 'swordsman' : 'kicker';
  rt.allies.push(a); burst(x, 1, z, { n: 12, color: '#ffffff', speed: 3 }); bump('allies');
}

export function clearAllies(opts: { missionOnly?: boolean; clones?: boolean } = {}) {
  rt.allies = rt.allies.filter((a) => (opts.missionOnly ? !a.fromMission : opts.clones ? a.kind !== 'clone' : false));
  bump('allies');
}

const ATTACK_RATE: Record<string, number> = { clone: 0.85, sasuke: 0.65, sakura: 1.2, kakashi: 0.9, hound: 0.7 };

function pickTarget(a: AllyRT): EnemyRT | null {
  let best: EnemyRT | null = null; let bd = 1e9;
  for (const e of rt.enemies) {
    if (e.state === 'dead' || e.vanish > 0.3 || e.def.tier === 'dummy' && a.kind !== 'clone') continue;
    const d = Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z);
    const dp = Math.hypot(e.pos.x - rt.player.pos.x, e.pos.z - rt.player.pos.z);
    if (d < 18 && dp < 24 && d + (e === rt.lock ? -6 : 0) < bd) { bd = d + (e === rt.lock ? -6 : 0); best = e; }
  }
  return best;
}

export function updateAllies(dt: number) {
  const p = rt.player; let removed = false;
  for (let i = rt.allies.length - 1; i >= 0; i--) {
    const a = rt.allies[i];
    if (a.kind === 'clone') { a.life -= dt; if (a.life <= 0) { burst(a.pos.x, 1, a.pos.z, { n: 14, color: '#ffffff', speed: 3.5, life: 0.5, size: 0.4 }); rt.allies.splice(i, 1); removed = true; continue; } }
    a.atkCd -= dt; a.spCd -= dt; a.pose.t += dt; a.pose.form = 'base';
    if (a.pose.flash > 0) a.pose.flash = Math.max(0, a.pose.flash - dt * 5);
    if (a.target && (a.target.state === 'dead' || a.target.vanish > 0.3)) a.target = null;
    if (a.kind !== 'escort' && (!a.target || Math.random() < dt * 0.8)) a.target = pickTarget(a) ?? a.target;
    const dpx = p.pos.x - a.pos.x, dpz = p.pos.z - a.pos.z; const dp = Math.hypot(dpx, dpz);
    let mx = 0, mz = 0, speed = 0; let desiredYaw = a.yaw;
    const busyAttack = a.pose.state === 'attack' && a.pose.t < a.pose.dur;
    if (dp > 45) { a.pos.x = p.pos.x - Math.sin(p.yaw) * 3; a.pos.z = p.pos.z - Math.cos(p.yaw) * 3; a.pos.y = p.pos.y; burst(a.pos.x, 1, a.pos.z, { n: 8, color: '#fff', speed: 2 }); }
    if (a.target && a.kind !== 'escort') {
      const t = a.target; const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z; const d = Math.hypot(dx, dz);
      const hold = a.charId === 'kakashi' ? 5 : 1.9;
      desiredYaw = yawTo(dx, dz);
      if (d > hold && !busyAttack) { mx = dx / d; mz = dz / d; speed = a.kind === 'clone' ? 9.5 : 8.5; }
      if (d < hold + 1.2 && a.atkCd <= 0 && !busyAttack) {
        a.atkCd = (ATTACK_RATE[a.charId] ?? 0.9) * (0.9 + Math.random() * 0.3);
        a.pose.state = 'attack'; a.pose.t = 0; a.pose.dur = 0.32; a.pose.variant = (a.pose.variant + 1) % 4;
        const atk = p.stats.atk * (a.kind === 'clone' ? 1 : 0.9);
        if (a.charId === 'kakashi' && d > 3) { lineBurst(a.pos.x, a.pos.z, t.pos.x, t.pos.z, 1.4, '#bcd9ff', 10); hitEnemy(t, { power: 0.9, atk, source: 'ally', element: 'lightning', knock: 2, noUlt: true, stagger: 8 }); }
        else hitEnemy(t, { power: a.kind === 'clone' ? Math.max(0.5, a.dmg) : 0.9 * a.dmg, atk, source: 'ally', knock: 3, noUlt: true, stagger: 9, fromX: a.pos.x, fromZ: a.pos.z });
        audio.sfx('swing', 0.5);
      }
      if (a.kind === 'companion' && a.spCd <= 0 && d < 14) {
        a.spCd = 6 + Math.random() * 3; a.pose.state = 'cast'; a.pose.t = 0; a.pose.dur = 0.5;
        const cx = t.pos.x, cz = t.pos.z;
        if (a.charId === 'sakura') { ring(cx, 0.3, cz, { color: '#ff9fc4', r1: 5, life: 0.5 }); burst(cx, 0.5, cz, { n: 24, color: '#ff9fc4', color2: '#fff', speed: 6, grav: 2 }); areaDamage({ x: cx, z: cz, radius: 5, power: 2.6, atk: p.stats.atk, source: 'ally', element: 'earth', knock: 6, noUlt: true, stagger: 25, heavy: true }); audio.sfx('heavy'); }
        else if (a.charId === 'sasuke') { explosion(cx, 1, cz, 4.5, '#ff7a2a'); areaDamage({ x: cx, z: cz, radius: 4.5, power: 2.8, atk: p.stats.atk, source: 'ally', element: 'fire', knock: 5, noUlt: true, status: 'burn', statusDur: 3, heavy: true }); audio.sfx('fire'); }
        else { for (let k = 0; k < 6; k++) lineBurst(cx + (Math.random() - 0.5) * 3, cz + (Math.random() - 0.5) * 3, cx, cz, 1 + k * 1.8, '#d8e8ff', 4); audio.sfx('lightning'); areaDamage({ x: cx, z: cz, radius: 3, power: 3.2, atk: p.stats.atk, source: 'ally', element: 'lightning', knock: 3, noUlt: true, status: 'stun', statusDur: 1, heavy: true }); }
      }
    } else {
      // follow the player in formation
      const ang = a.id * 2.4; const gx = p.pos.x + Math.cos(ang) * 3.4, gz = p.pos.z + Math.sin(ang) * 3.4;
      const dx = gx - a.pos.x, dz = gz - a.pos.z; const d = Math.hypot(dx, dz);
      if (d > 1.2) { mx = dx / d; mz = dz / d; speed = Math.min(11, 3 + d * 1.3); desiredYaw = yawTo(dx, dz); }
      else desiredYaw = yawTo(dpx, dpz);
    }
    a.yaw = lerpAngle(a.yaw, desiredYaw, dt * 10);
    a.vel.x += (mx * speed - a.vel.x) * Math.min(1, dt * 10); a.vel.z += (mz * speed - a.vel.z) * Math.min(1, dt * 10);
    moveXZ(a.pos, a.vel.x * dt, a.vel.z * dt, 0.4); snapGround(a.pos);
    const sp = Math.hypot(a.vel.x, a.vel.z);
    a.pose.speed += (Math.min(1.4, sp / 8) - a.pose.speed) * Math.min(1, dt * 10);
    if (a.pose.state === 'attack' || a.pose.state === 'cast') { if (a.pose.t > a.pose.dur) { a.pose.state = 'idle'; a.pose.t = 0; } }
    else { const ns = sp > 0.6 ? 'run' : 'idle'; if (a.pose.state !== ns) { a.pose.state = ns; a.pose.t = 0; } }
    if (a.pose.state === 'idle' && a.kind === 'escort') a.pose.speed = 0;
  }
  if (removed) bump('allies');
}

export function spawnPoof(x: number, z: number) { burst(x, 1, z, { n: 14, color: '#fff', speed: 3 }); }
export { floater };
