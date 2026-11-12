import type { AbilityDef, AnimState } from '../types';
import { rt, angleDiff, lerpAngle, yawTo, type EnemyRT } from '../runtime';
import { input } from '../input';
import { useGame } from '../store';
import { CHARACTERS } from '../data/characters';
import { ABILITIES } from '../data/abilities';
import { ITEMS } from '../data/items';
import { computeStats, isAbilityUnlocked } from '../logic/stats';
import { GRAVITY, WORLD } from '../config';
import { WATER_RECTS, BOARD_POS } from '../data/world';
import { groundHeight } from '../logic/collision';
import { audio } from '../audio';
import { bus } from '../bus';
import { burst, dust, ring, swirl, trail } from './fx';
import { areaDamage, spawnProjectile, floater, shake, FORM_MUL, healPlayer } from './combat';
import { dirOf, fireAbility, finishDash, tryCast, ultFor, doSubstitution, throwKunai, toggleForm, setForm, pickTarget } from './abilities';
import { moveXZ } from './move';

let lockMode = false;
let landVy = 0;

export function refreshStats(healNew = false) {
  const g = useGame.getState().profile; const c = g.chars[g.charId]; const p = rt.player;
  const old = p.stats; const st = computeStats(CHARACTERS[g.charId], c.level, c.skills, g.equipment, g.upgrades);
  p.stats = st; p.charId = g.charId;
  if (!old) { p.hp = st.maxHp; p.chakra = st.maxChakra; }
  else if (healNew) { p.hp = st.maxHp; p.chakra = st.maxChakra; }
  else { p.hp = Math.min(st.maxHp, p.hp + Math.max(0, st.maxHp - old.maxHp)); p.chakra = Math.min(st.maxChakra, p.chakra); }
  p.stamina = Math.min(st.maxStamina, p.stamina);
}

function setPose(state: AnimState, dur = 1, variant = 0) {
  const ps = rt.player.pose;
  if (ps.state !== state || ps.variant !== variant || (state === 'attack' && ps.dur !== dur)) { ps.state = state; ps.t = 0; ps.variant = variant; }
  ps.dur = dur;
}

export function resolveLockTargets(): EnemyRT[] {
  const p = rt.player;
  return rt.enemies.filter((e) => e.state !== 'dead' && e.vanish < 0.3 && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 32).sort((a, b) => {
    const da = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) + Math.abs(angleDiff(rt.camYaw, yawTo(a.pos.x - p.pos.x, a.pos.z - p.pos.z))) * 5;
    const db = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) + Math.abs(angleDiff(rt.camYaw, yawTo(b.pos.x - p.pos.x, b.pos.z - p.pos.z))) * 5;
    return da - db;
  });
}
function cycleLock() {
  const list = resolveLockTargets();
  if (!list.length) { rt.lock = null; lockMode = false; return; }
  if (!rt.lock) { rt.lock = list[0]; lockMode = true; audio.sfx('ui', 0.6); return; }
  const i = list.indexOf(rt.lock); const next = list[i + 1];
  if (next) { rt.lock = next; audio.sfx('ui', 0.6); } else { rt.lock = null; lockMode = false; audio.sfx('back', 0.5); }
}

function updateCamInput(dt: number) {
  const s = useGame.getState().settings; const p = rt.player;
  const sens = 0.0024 * s.sensitivity;
  if (!rt.cine) {
    rt.camYaw -= input.dx * sens; rt.camPitch += input.dy * sens * (s.invertY ? -1 : 1);
    if (input.down('camLeft')) rt.camYaw += 2.2 * dt; if (input.down('camRight')) rt.camYaw -= 2.2 * dt;
    rt.camPitch = Math.max(-0.25, Math.min(1.25, rt.camPitch));
  }
  if (rt.lock && (rt.lock.state === 'dead' || Math.hypot(rt.lock.pos.x - p.pos.x, rt.lock.pos.z - p.pos.z) > 45)) {
    const prevDead = rt.lock.state === 'dead'; rt.lock = null;
    if (lockMode && prevDead) { const l = resolveLockTargets().filter((e) => Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 22); if (l.length) rt.lock = l[0]; else lockMode = false; }
  }
  if (rt.lock && !rt.cine) {
    const t = yawTo(rt.lock.pos.x - p.pos.x, rt.lock.pos.z - p.pos.z);
    rt.camYaw = lerpAngle(rt.camYaw, t, dt * 5 + Math.min(0.5, Math.abs(input.dx) * 0.0)); rt.camPitch += (0.28 - rt.camPitch) * Math.min(1, dt * 2);
  }
}

function inCombat(): boolean {
  if (rt.lock) return true; const p = rt.player;
  for (const e of rt.enemies) if (e.state !== 'dead' && e.def.tier !== 'dummy' && e.aggro && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 16) return true;
  return false;
}

export function quickUse(kind: 'heal' | 'chakra') {
  const inv = useGame.getState().profile.inventory; const g = useGame.getState();
  const ids = Object.keys(inv).filter((id) => (kind === 'heal' ? ITEMS[id]?.use?.heal : ITEMS[id]?.use?.chakra)).sort((a, b) => (ITEMS[a].use!.heal ?? ITEMS[a].use!.chakra ?? 0) - (ITEMS[b].use!.heal ?? ITEMS[b].use!.chakra ?? 0));
  if (!ids.length) { floater(rt.player.pos.x, rt.player.pos.y + 2.6, rt.player.pos.z, kind === 'heal' ? 'NO RAMEN' : 'NO CHAKRA PILLS', '#ccc', 0.8); return; }
  g.useItem(ids[0]); audio.sfx('pickup', 0.7);
}

export function updatePlayer(dt: number) {
  const p = rt.player; const ch = CHARACTERS[p.charId]; const st = p.stats; const g = useGame.getState();
  // ---------------------------------------------------------------- timers
  for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] = Math.max(0, p.cd[k] - dt);
  p.invuln = Math.max(0, p.invuln - dt); p.counterT = Math.max(0, p.counterT - dt); p.autoSubCd = Math.max(0, p.autoSubCd - dt);
  p.confuseT = Math.max(0, p.confuseT - dt); p.slowT = Math.max(0, p.slowT - dt); p.stunT = Math.max(0, p.stunT - dt);
  p.focusT = Math.max(0, p.focusT - dt); p.staminaDelay = Math.max(0, p.staminaDelay - dt); p.comboT = Math.max(0, p.comboT - dt);
  if (p.buff.t > 0) { p.buff.t -= dt; if (p.buff.t <= 0) p.buff = { dmg: 0, def: 0, speed: 0, t: 0 }; }
  if (rt.comboTimer > 0) { rt.comboTimer -= dt; if (rt.comboTimer <= 0) rt.comboCount = 0; }
  p.pose.t += dt; p.pose.form = p.form; p.pose.style = ch.combo.style;
  if (p.pose.flash > 0) p.pose.flash = Math.max(0, p.pose.flash - dt * 4);

  updateCamInput(dt);
  if (p.dead) { setPose('dead'); p.vel.x *= 0.9; p.vel.z *= 0.9; return; }
  const frozen = !!rt.cine?.freeze;

  // ---------------------------------------------------------------- transformations
  if (p.form !== 'base') {
    p.formT -= dt; const drain = (p.form === 'kurama' ? 3.6 : 1.4) * (1 - st.mods.formDrain);
    p.chakra = Math.max(0, p.chakra - drain * dt);
    if (p.form === 'kurama') healPlayer(st.maxHp * 0.012 * dt, true);
    if (Math.random() < dt * 14) trail(p.pos.x + (Math.random() - 0.5), 0.2 + Math.random() * 2, p.pos.z + (Math.random() - 0.5), p.form === 'sage' ? '#ff9a3a' : '#ffc02e', 0.3, 0.6);
    if (p.formT <= 0 || (p.form === 'kurama' && p.chakra <= 0)) { setForm('base'); floater(p.pos.x, p.pos.y + 2.8, p.pos.z, 'Transformation ended', '#ffd', 0.9); }
  }

  // ---------------------------------------------------------------- input intent
  let ix = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0); let iz = (input.down('forward') ? 1 : 0) - (input.down('back') ? 1 : 0);
  if (p.confuseT > 0) { ix = -ix; iz = -iz; }
  const il = Math.hypot(ix, iz); if (il > 0) { ix /= il; iz /= il; }
  const fx = Math.sin(rt.camYaw), fz = Math.cos(rt.camYaw); const rx = -Math.cos(rt.camYaw), rz = Math.sin(rt.camYaw);
  const wantX = fx * iz + rx * ix, wantZ = fz * iz + rz * ix; const moving = il > 0;
  const act = p.action;
  const busy = !!act && act.kind !== 'light' ? true : false;

  if (!frozen && p.stunT <= 0) {
    // lock-on
    if (input.pressed('lock')) cycleLock();
    // guard & charge
    const canGuard = p.grounded && (!act || act.kind === 'light' && act.t > act.dur * 0.6) && !p.dash;
    const wantBlock = input.down('block') && canGuard && p.stamina > 2;
    if (wantBlock && !p.blocking) { p.blockT = 0; p.action = act && act.kind === 'light' ? null : act; }
    if (!wantBlock) p.blockT = 0; else p.blockT += dt;
    p.blocking = wantBlock;
    const wantCharge = input.down('charge') && p.grounded && !p.action && !p.blocking && !moving && !p.dash;
    if (wantCharge !== p.charging) { p.charging = wantCharge; audio.charge(wantCharge); }
    // quick items / tools / substitution / transform / interact
    if (input.pressed('kunai')) throwKunai();
    if (input.pressed('substitute')) doSubstitution(false);
    if (input.pressed('transform')) toggleForm();
    if (input.pressed('healItem')) quickUse('heal');
    if (input.pressed('chakraItem')) quickUse('chakra');
    if (input.pressed('interact') && rt.interact && !p.action) bus.emit('interact', rt.interact);
    // abilities
    const slots = ['a1', 'a2', 'a3', 'a4'] as const; const prog = g.profile.chars[p.charId];
    slots.forEach((s, i) => {
      if (!input.pressed(s)) return; const a = ABILITIES[prog.equipped[i]];
      if (a && isAbilityUnlocked(a.id, prog.level, g.profile.flags)) tryCast(a); else if (a) floater(p.pos.x, p.pos.y + 2.6, p.pos.z, `Locked: level ${a.unlockLevel}${a.unlockFlag ? ' + quest' : ''}`, '#ccc', 0.8);
    });
    if (input.pressed('special')) { const a = ABILITIES[ch.special]; if (a && isAbilityUnlocked(a.id, prog.level, g.profile.flags)) tryCast(a); else if (a) floater(p.pos.x, p.pos.y + 2.6, p.pos.z, `Locked: level ${a.unlockLevel}`, '#ccc', 0.8); }
    if (input.pressed('ultimate')) { const a = ultFor(); if (a) { if (isAbilityUnlocked(a.id, prog.level, g.profile.flags) || a.needsForm) tryCast(a); } }
    // jump / dodge
    if (input.pressed('jump')) {
      const forceJump = input.down('sprint');
      if (p.grounded && !forceJump && inCombat() && !busy && p.stamina >= 16 && !p.dash && p.action?.kind !== 'cast') startDodge(wantX, wantZ, moving);
      else if (p.grounded && !p.dash && p.action?.kind !== 'cast' && p.action?.kind !== 'heavy') { p.vel.y = st.jump; p.grounded = false; p.jumps = 1; audio.sfx('jump', 0.6); dust(p.pos.x, p.pos.y, p.pos.z, 4); }
      else if (!p.grounded && p.jumps < 2 && p.chakra >= 4 && !p.dash) { p.vel.y = st.jump * 0.92; p.jumps = 2; p.chakra -= 4; ring(p.pos.x, p.pos.y + 0.1, p.pos.z, { color: '#7fd8ff', r1: 1.6, life: 0.3 }); burst(p.pos.x, p.pos.y, p.pos.z, { n: 8, color: '#7fd8ff', speed: 2, life: 0.3 }); audio.sfx('jump', 0.8); }
    }
    // attacks
    if (input.mousePressed[0]) tryLight();
    if (input.mousePressed[2]) tryHeavy();
    if (input.mouseDown[0] && !p.action && !p.blocking && !p.dash && p.comboT > 0.0) tryLight();
  } else { p.blocking = false; if (p.charging) { p.charging = false; audio.charge(false); } }

  // ---------------------------------------------------------------- movement
  const formM = FORM_MUL[p.form];
  const sprinting = input.down('sprint') && moving && p.stamina > 4 && !p.blocking && !p.charging && !p.action && p.stunT <= 0;
  let spd = st.speed * formM.speed * (1 + (p.buff.t > 0 ? p.buff.speed : 0)) * (p.slowT > 0 ? 0.55 : 1) * (sprinting ? 1.55 : 1);
  if (p.blocking) spd *= 0.5; if (p.onWater) spd *= 0.92;
  let ctl = 1; const a2 = p.action;
  if (a2) ctl = a2.kind === 'light' ? 0.4 : a2.kind === 'heavy' ? 0.15 : a2.kind === 'cast' ? 0.25 : a2.kind === 'dodge' || a2.kind === 'dead' ? 0 : a2.kind === 'hit' ? 0 : 0.3;
  if (p.charging || frozen || p.stunT > 0) ctl = 0;
  const lockedFace = !!rt.lock && !sprinting;
  let tvx = wantX * spd * ctl, tvz = wantZ * spd * ctl;
  if (p.dash) { tvx = p.dash.dx; tvz = p.dash.dz; }
  if (a2?.kind === 'dodge') { const f = a2.t < 0.3 ? 1 : 0; tvx = (a2.dx ?? 0) * 17 * f; tvz = (a2.dz ?? 0) * 17 * f; }
  const accel = p.dash ? 200 : a2?.kind === 'dodge' ? 120 : p.grounded ? (moving ? 40 : 32) : 14;
  const dvx = tvx - p.vel.x, dvz = tvz - p.vel.z; const dl = Math.hypot(dvx, dvz); const maxd = accel * dt;
  if (dl > maxd) { p.vel.x += (dvx / dl) * maxd; p.vel.z += (dvz / dl) * maxd; } else { p.vel.x = tvx; p.vel.z = tvz; }
  // knockback friction when being hit
  if (a2?.kind === 'hit') { p.vel.x *= 0.92; p.vel.z *= 0.92; }
  moveXZ(p.pos, p.vel.x * dt, p.vel.z * dt, 0.45);
  // facing
  const hs = Math.hypot(p.vel.x, p.vel.z);
  if (!frozen && p.stunT <= 0 && a2?.kind !== 'dodge' && !p.dash) {
    if (lockedFace && rt.lock && !(a2?.kind === 'cast' && !moving)) p.yaw = lerpAngle(p.yaw, yawTo(rt.lock.pos.x - p.pos.x, rt.lock.pos.z - p.pos.z), dt * 16);
    else if (moving && ctl > 0 && !p.blocking) p.yaw = lerpAngle(p.yaw, yawTo(p.vel.x, p.vel.z), dt * 14);
    else if (p.blocking && rt.lock) p.yaw = lerpAngle(p.yaw, yawTo(rt.lock.pos.x - p.pos.x, rt.lock.pos.z - p.pos.z), dt * 12);
  }
  // vertical
  p.vel.y -= GRAVITY * dt; p.pos.y += p.vel.y * dt;
  const gh = groundHeight(rt.colliders, p.pos.x, p.pos.z, p.pos.y, 0.35);
  if (p.pos.y <= gh + 0.001) {
    if (!p.grounded) {
      landVy = -p.vel.y; if (landVy > 9) { audio.sfx('land', Math.min(1, landVy / 22)); dust(p.pos.x, gh, p.pos.z, 6); }
      if (p.slamming) { p.slamming = false; const cx = p.pos.x, cz = p.pos.z; burst(cx, gh + 0.4, cz, { n: 22, color: '#ffe0a0', color2: '#fff', speed: 7, life: 0.5 }); ring(cx, gh + 0.2, cz, { color: '#ffd38a', r1: 4.2, life: 0.4 }); shake(0.5); audio.sfx('heavy');
        areaDamage({ x: cx, z: cz, radius: 4.2, power: 1.7 * ch.combo.dmg, knock: 7, stagger: 40, heavy: true, finisher: true }); }
    }
    p.pos.y = gh; if (p.vel.y < 0) p.vel.y = 0; p.grounded = true; p.jumps = 0;
  } else p.grounded = false;
  if (p.pos.y < -30) { p.pos.y = 0; p.pos.x = rt.checkpoint.x; p.pos.z = rt.checkpoint.z; }
  p.pos.x = Math.min(WORLD.maxX, Math.max(WORLD.minX, p.pos.x)); p.pos.z = Math.min(WORLD.maxZ, Math.max(WORLD.minZ, p.pos.z));
  // water walking
  p.onWater = p.pos.y < 0.3 && WATER_RECTS.some((r) => p.pos.x > r[0] && p.pos.x < r[1] && p.pos.z > r[2] && p.pos.z < r[3]);
  if (p.onWater && hs > 2 && Math.random() < dt * 10) ring(p.pos.x, 0.08, p.pos.z, { color: '#cfeaff', r0: 0.2, r1: 1.4, life: 0.5 });
  // footsteps + sprint dust
  if (p.grounded && hs > 2) { p.stepT += hs * dt; if (p.stepT > 3.1) { p.stepT = 0; audio.sfx('step', 0.5); if (sprinting) dust(p.pos.x, p.pos.y, p.pos.z, 1); } }

  // ---------------------------------------------------------------- dash (Rasengan, Chidori…)
  if (p.dash) {
    p.dash.t += dt; trail(p.pos.x, p.pos.y + 1.2, p.pos.z, p.dash.ability.color, 0.4, 0.4); trail(p.pos.x, p.pos.y + 0.6, p.pos.z, '#ffffff', 0.3, 0.3);
    if (p.dash.t >= p.dash.dur) finishDash();
  }

  // ---------------------------------------------------------------- actions
  const ac = p.action;
  if (ac) {
    ac.t += dt;
    if (ac.kind === 'light' && !ac.fired && ac.t >= ac.hitAt) { ac.fired = true; doLightHit(ac.idx); }
    else if (ac.kind === 'heavy' && !ac.fired && ac.t >= ac.hitAt) { ac.fired = true; doHeavyHit(); }
    else if (ac.kind === 'cast' && !ac.fired && ac.t >= ac.hitAt && ac.ability) { ac.fired = true; fireAbility(ac.ability as AbilityDef); }
    if (ac.kind === 'cast' && p.orb) swirl(p.pos.x + Math.sin(p.yaw) * 0.6, p.pos.y + 1.3, p.pos.z + Math.cos(p.yaw) * 0.6, 0.9 + p.orb.size, p.orb.color, 2, rt.t);
    if (ac.kind === 'dodge' && Math.random() < 0.7) trail(p.pos.x, p.pos.y + 1, p.pos.z, '#cfd8ff', 0.5, 0.3);
    if (ac.t >= ac.dur) {
      p.action = null; if (ac.kind === 'dodge') p.invuln = Math.min(p.invuln, 0.05);
      if (p.queued && !p.blocking) { const q = p.queued; p.queued = null; if (q === 'light') tryLight(); else tryHeavy(); }
    }
  }
  if (p.charging) {
    p.chakra = Math.min(st.maxChakra, p.chakra + 30 * (1 + st.mods.chargeSpeed) * dt); p.stamina = Math.min(st.maxStamina, p.stamina + 20 * dt);
    rt.chargeAcc += dt; swirl(p.pos.x, p.pos.y + 1, p.pos.z, 1.8, '#5ce0ff', 2, rt.t);
    if (Math.random() < dt * 3) burst(p.pos.x, p.pos.y + 0.1, p.pos.z, { n: 3, color: '#9ef', speed: 1.2, up: 2, life: 0.8 });
  }

  // ---------------------------------------------------------------- resources
  if (!p.charging) p.chakra = Math.min(st.maxChakra, p.chakra + (st.regen + (p.form === 'sage' ? 3 : 0)) * dt * (p.form === 'kurama' ? 0 : 1) * (p.action ? 0.4 : 1));
  if (sprinting) { p.stamina = Math.max(0, p.stamina - 14 * dt); p.staminaDelay = 0.8; }
  else if (p.staminaDelay <= 0) p.stamina = Math.min(st.maxStamina, p.stamina + (p.blocking ? 10 : 30) * dt);
  if (p.blocking && p.stamina <= 0) p.blocking = false;

  // ---------------------------------------------------------------- pose
  const a = p.action;
  p.pose.speed += (Math.min(1.6, hs / Math.max(1, st.speed)) - p.pose.speed) * Math.min(1, dt * 12);
  if (a?.kind === 'hit') setPose('hit', a.dur);
  else if (p.stunT > 0) setPose('stun');
  else if (a?.kind === 'dodge') setPose('dodge', a.dur);
  else if (a?.kind === 'cast') setPose(p.orb ? 'orb' : 'cast', a.dur);
  else if (a?.kind === 'light') setPose('attack', a.dur, a.idx);
  else if (a?.kind === 'heavy') setPose('heavy', a.dur);
  else if (a?.kind === 'air') setPose('air', a.dur);
  else if (p.dash) setPose('orb', 0.3);
  else if (p.blocking) setPose('block');
  else if (p.charging) setPose('charge');
  else if (!p.grounded) setPose(p.slamming ? 'air' : 'jump');
  else setPose(hs > 0.8 ? 'run' : 'idle');
  if (p.pose.state === 'attack' && p.pose.t > p.pose.dur) p.pose.t = p.pose.dur;

  scanInteract();
}

function startDodge(wx: number, wz: number, moving: boolean) {
  const p = rt.player; const d = dirOf(p.yaw);
  const dx = moving ? wx : -d.x; const dz = moving ? wz : -d.z; const l = Math.hypot(dx, dz) || 1;
  p.stamina -= 16; p.staminaDelay = 0.6; p.perfectDodgeUsed = false; p.queued = null; p.blocking = false;
  const mods = p.stats.mods; const dodgeMul = CHARACTERS[p.charId].stats.dodge;
  p.invuln = (0.3 + mods.dodge) * Math.min(1.15, dodgeMul);
  p.action = { kind: 'dodge', t: 0, dur: 0.38, hitAt: 99, fired: true, idx: 0, dx: (dx / l) * dodgeMul, dz: (dz / l) * dodgeMul };
  if (moving || !rt.lock) p.yaw = yawTo(dx, dz);
  burst(p.pos.x, p.pos.y + 0.8, p.pos.z, { n: 10, color: '#dfe6ff', speed: 3, life: 0.35 }); dust(p.pos.x, p.pos.y, p.pos.z, 5);
  ring(p.pos.x, p.pos.y + 0.2, p.pos.z, { color: '#cfd8ff', r1: 1.8, life: 0.3 }); audio.sfx('dodge');
}

function tryLight() {
  const p = rt.player; const ch = CHARACTERS[p.charId]; if (p.dead || p.stunT > 0 || rt.cine?.freeze || p.dash) return;
  const a = p.action;
  if (a) {
    if (a.kind === 'light' && a.t >= a.dur * 0.55) { p.action = null; }
    else if ((a.kind === 'light' || a.kind === 'heavy') && a.t > 0.1) { p.queued = 'light'; return; }
    else return;
  }
  if (p.blocking) return;
  if (!p.grounded) { // aerial dive slam
    p.action = { kind: 'air', t: 0, dur: 0.6, hitAt: 99, fired: true, idx: 0 }; p.vel.y = -24; p.slamming = true; audio.sfx('swing'); return;
  }
  const hits = ch.combo.hits; let idx = p.comboT > 0 && p.comboIdx < hits - 1 ? p.comboIdx + 1 : 0;
  if (p.comboT <= 0) idx = 0;
  const last = idx === hits - 1;
  const dur = (last ? 0.5 : 0.36) / ch.combo.speed;
  p.action = { kind: 'light', t: 0, dur, hitAt: dur * 0.4, fired: false, idx };
  p.comboIdx = idx;
  const t = pickTarget(ch.combo.range + (ch.combo.style === 'ranged' ? 12 : 3.5));
  if (t) p.yaw = yawTo(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
  const d = dirOf(p.yaw); const lunge = ch.combo.style === 'ranged' ? 0 : last ? 10 : 6.5;
  if (t && Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 2) { /* already close */ } else { p.vel.x = d.x * lunge; p.vel.z = d.z * lunge; }
  audio.sfx('swing');
}

function doLightHit(idx: number) {
  const p = rt.player; const ch = CHARACTERS[p.charId]; const last = idx === ch.combo.hits - 1; const d = dirOf(p.yaw);
  const range = ch.combo.range + FORM_MUL[p.form].range;
  p.comboT = 0.75 + (last ? -0.75 : 0);
  if (ch.combo.style === 'ranged') {
    spawnProjectile({ x: p.pos.x + d.x * 0.8, y: p.pos.y + 1.3, z: p.pos.z + d.z * 0.8, vx: d.x * 28, vz: d.z * 28, dmg: 0.75 * ch.combo.dmg * (last ? 1.6 : 1), life: 0.5, radius: 0.5, size: 0.4, color: '#e6c887', element: 'earth', kind: 'orb', source: 'sand' });
    burst(p.pos.x + d.x, p.pos.y + 1.3, p.pos.z + d.z, { n: 6, color: '#e6c887', speed: 3, life: 0.3 });
    return;
  }
  const power = ch.combo.dmg * (last ? 1.7 : 1) * (1 + idx * 0.06);
  const n = areaDamage({ x: p.pos.x, z: p.pos.z, radius: range, power, knock: last ? 9 : 3, stagger: last ? 45 : 13, finisher: last, cone: { yaw: p.yaw, half: last ? 1.5 : 1.05 }, heavy: last, element: p.form === 'kurama' ? 'none' : 'none' });
  const col = last ? '#ffe9b0' : '#ffffff';
  burst(p.pos.x + d.x * (range * 0.7), p.pos.y + 1.2, p.pos.z + d.z * (range * 0.7), { n: last ? 12 : 6, color: col, speed: last ? 6 : 3.5, life: 0.25, size: 0.18 });
  if (p.form === 'kurama' && last) { ring(p.pos.x, p.pos.y + 0.5, p.pos.z, { color: '#ffc02e', r1: 5, life: 0.35 }); areaDamage({ x: p.pos.x, z: p.pos.z, radius: 5, power: 0.9, knock: 5, stagger: 15, quiet: true }); }
  if (n === 0 && last) shake(0.08);
}

function tryHeavy() {
  const p = rt.player; if (p.dead || p.stunT > 0 || rt.cine?.freeze || p.dash || p.blocking) return;
  if (p.action) { if (p.action.kind === 'light' && p.action.t > p.action.dur * 0.45) p.action = null; else { if (p.action.kind === 'light') p.queued = 'heavy'; return; } }
  if (!p.grounded || p.stamina < 12) return;
  p.stamina -= 12; p.staminaDelay = 0.7;
  const t = pickTarget(7); if (t) p.yaw = yawTo(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
  p.action = { kind: 'heavy', t: 0, dur: 0.85, hitAt: 0.42, fired: false, idx: 0 };
  audio.sfx('swing', 1.2);
}
function doHeavyHit() {
  const p = rt.player; const ch = CHARACTERS[p.charId]; const d = dirOf(p.yaw); const range = ch.combo.range + 0.9 + FORM_MUL[p.form].range;
  const bonus = p.comboIdx >= ch.combo.hits - 1 || p.comboT > 0 ? 1.2 : 1;
  p.vel.x = d.x * 7; p.vel.z = d.z * 7;
  if (ch.combo.style === 'ranged') {
    for (let i = -1; i <= 1; i++) { const a = p.yaw + i * 0.22; spawnProjectile({ x: p.pos.x + Math.sin(a) * 0.8, y: p.pos.y + 1.3, z: p.pos.z + Math.cos(a) * 0.8, vx: Math.sin(a) * 24, vz: Math.cos(a) * 24, dmg: 1.4 * ch.combo.dmg, life: 0.6, radius: 0.7, size: 0.6, color: '#e6c887', element: 'earth', kind: 'orb', pierce: true }); }
    shake(0.25); audio.sfx('heavy'); return;
  }
  burst(p.pos.x + d.x * 2, p.pos.y + 1.3, p.pos.z + d.z * 2, { n: 18, color: '#ffe9b0', color2: '#fff', speed: 7, life: 0.35 });
  ring(p.pos.x + d.x * 2, p.pos.y + 0.4, p.pos.z + d.z * 2, { color: '#ffe9b0', r1: 3, life: 0.3 });
  areaDamage({ x: p.pos.x, z: p.pos.z, radius: range, power: 2.5 * ch.combo.dmg * bonus, knock: 11, stagger: 110, heavy: true, finisher: true, cone: { yaw: p.yaw, half: 1.3 } });
  p.comboT = 0;
}

/** Nearest talkable NPC / mission board. */
function scanInteract() {
  const p = rt.player; let best: typeof rt.interact = null; let bd = 3.6;
  for (const n of rt.npcs) {
    if (rt.allies.some((a) => a.charId === n.def.id)) continue;
    const d = Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z);
    if (d < bd && Math.abs(n.pos.y - p.pos.y) < 3) { bd = d; best = { kind: 'npc', id: n.def.id, label: `Talk to ${n.def.name}` }; }
  }
  for (const a of rt.allies) { if (a.kind !== 'escort') continue; const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z); if (d < bd) { bd = d; best = { kind: 'npc', id: a.charId, label: 'Talk to Tazuna' }; } }
  const db = Math.hypot(BOARD_POS[0] - p.pos.x, BOARD_POS[1] - p.pos.z);
  if (db < Math.max(3.8, bd)) best = { kind: 'board', id: 'board', label: 'Read the Mission Board' };
  rt.interact = best;
}
export { lockMode };
