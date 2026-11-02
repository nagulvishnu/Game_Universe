import * as THREE from 'three';
import { HeroRig, AnimIn, HeroLook } from './models';
import { COMBOS, SWEEP, AIR_ATTACK, SPRINT_ATTACK, WEAPON_SPEED, AtkStep, skillStats, TF_STAGES, ELEM_COLOR, RAR, RARITY_HEX } from './data';
import { useGame, calcStats } from './store';
import type { Game } from './engine';
import type { Enemy } from './enemy';

const ang = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export class Player {
  g: Game; rig = new HeroRig(); pos = new THREE.Vector3(); yaw = 0; vel = new THREE.Vector3(); vy = 0; grounded = true; radius = 0.45;
  hp = 100; en = 80; stats = calcStats(useGame.getState()); state = 'free'; t = 0; dur = 1; invuln = 0; comboIdx = -1; comboT = 0; step: AtkStep | null = null; hitSet = new Set<Enemy>(); queued = false; airDive = false; impacted = false;
  cds = { e: 0, r: 0, v: 0, eMax: 1, rMax: 1, vMax: 1 }; tf = 0; tfActive = false; tfTime = 0; tfMax = 20; tfStage = 1; blocking = false; blockT = 0;
  status = { burn: 0, slow: 0, poison: 0 }; sprint = false; coyote = 0; dodgeCd = 0; dodgeDir = new THREE.Vector3(); lock: Enemy | null = null; combatT = 0; perfectCd = 0; skillId = ''; fired = 0; sTap = -9; landT = 0;
  stepDist = 0; moveSpeed = 0; spinFx = false; dotT = 0; wasAir = false; fallSpeed = 0; lastHitT = 0; aimDir = new THREE.Vector3(0, 0, 1); animState = 'idle'; comboCount = 0; comboShowT = 0; victoryT = 0;
  constructor(g: Game) { this.g = g; this.refreshStats(true); g.scene.add(this.rig.root); }

  get maxHp() { return this.stats.hp; } get maxEn() { return this.stats.en; }
  refreshStats(fill = false) {
    const s = useGame.getState(); this.stats = calcStats(s); this.tfStage = s.player.tfStage; if (fill) { this.hp = this.stats.hp; this.en = this.stats.en; }
    this.hp = Math.min(this.hp, this.stats.hp); this.en = Math.min(this.en, this.stats.en); this.applyLook();
  }
  applyLook() {
    const s = useGame.getState(); const eq = s.equipment; const it = (x?: any) => (x ? { color: x.color, r: RAR.indexOf(x.rarity) } : undefined);
    const w = eq.weapon; const stage = TF_STAGES[this.tfStage - 1] || TF_STAGES[0];
    const look: HeroLook = { hairStyle: s.appearance.hair, hairColor: s.appearance.hairColor, outfit: s.appearance.outfit, accessory: s.appearance.accessory,
      items: { helmet: it(eq.helmet), chest: it(eq.chest), gloves: it(eq.gloves), boots: it(eq.boots), accessory: it(eq.accessory) },
      wtype: w?.wtype || 'sword', wcolor: w?.color ?? 0xaab4c4, welem: w?.element && w.element !== 'none' ? ELEM_COLOR[w.element] : 0, wglow: w && RAR.indexOf(w.rarity) >= 2 ? RARITY_HEX[w.rarity] : 0,
      tf: this.tfActive ? this.tfStage : 0, tfColor: stage.color, tfHair: stage.hair };
    this.rig.look(look);
  }
  get wtype() { return useGame.getState().equipment.weapon?.wtype || 'sword'; }
  get aspd() { return WEAPON_SPEED[this.wtype] * (this.tfActive ? TF_STAGES[this.tfStage - 1].aspd : 1) * (this.stats.passives.includes('swift') ? 1.12 : 1); }
  get dmgMult() { return (this.tfActive ? TF_STAGES[this.tfStage - 1].dmg : 1); }
  get inCombat() { return this.combatT > 0; }

  teleport(x: number, z: number, yaw = 0) { this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.vy = 0; this.yaw = yaw; this.state = 'free'; this.invuln = 1; this.lock = null; }
  addTf(n: number) { if (!this.tfActive) this.tf = Math.min(100, this.tf + n); }
  gainEn(n: number) { this.en = Math.min(this.maxEn, this.en + n); }

  // ── main update ──
  update(dt: number) {
    const g = this.g; const inp = g.input; const grid = g.level.grid; const st = this.stats;
    if (this.dotT > 0) this.dotT -= dt;
    this.invuln = Math.max(0, this.invuln - dt); this.cds.e = Math.max(0, this.cds.e - dt); this.cds.r = Math.max(0, this.cds.r - dt); this.cds.v = Math.max(0, this.cds.v - dt);
    this.dodgeCd -= dt; this.perfectCd -= dt; this.comboT -= dt; this.combatT -= dt; this.comboShowT -= dt; if (this.comboT <= 0 && this.state !== 'attack') this.comboCount = 0;
    for (const k of ['burn', 'slow', 'poison'] as const) this.status[k] = Math.max(0, this.status[k] - dt);
    if (this.status.burn > 0 || this.status.poison > 0) { this.dotT = this.dotT > 0 ? this.dotT : 0.5; if (Math.floor(g.time * 2) !== Math.floor((g.time - dt) * 2)) this.takeDot(st.hp * (this.status.burn > 0 ? 0.012 : 0.008)); }
    // energy regen
    this.en = Math.min(this.maxEn, this.en + (st.regen + (this.tfActive ? TF_STAGES[this.tfStage - 1].regen : 0)) * dt * (this.state === 'attack' ? 0.6 : 1));
    if (this.tfActive) { this.tfTime -= dt; if (this.tfTime <= 0) this.endTransform(); }
    if (this.state === 'dead') { this.animate(dt); return; }
    if (g.enemies.some((e) => e.aggro && !e.dead && e.pos.distanceToSquared(this.pos) < 24 * 24)) this.combatT = 4;
    // movement input (camera-relative)
    let ix = 0, iz = 0; const locked = g.inputLocked;
    if (!locked) { ix = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0); iz = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0); }
    const cy = g.cam.yaw; const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    let dx = fx * iz + rx * ix, dz = fz * iz + rz * ix; const dl = Math.hypot(dx, dz); const moving = dl > 0.01; if (moving) { dx /= dl; dz /= dl; }
    if (moving) this.aimDir.set(dx, 0, dz);
    // double-tap S → low sweep
    if (!locked && inp.consume('KeyS', 0.05)) { if (g.time - this.sTap < 0.3) { this.sTap = -9; this.tryStart('sweep'); } else this.sTap = g.time; }
    // buffered actions
    const wantAtk = !locked && (inp.consume('KeyF', 0.16) || inp.consume('Mouse0', 0.16));
    if (!locked && inp.consume('KeyT', 0.2)) this.tryTransform();
    if (!locked && inp.consume('KeyV', 0.2)) this.tryUlt();
    if (!locked && inp.consume('KeyE', 0.16)) this.trySkill('burst');
    if (!locked && inp.consume('KeyR', 0.16)) this.trySkill('rift');
    if (!locked) { if (inp.consume('Digit1', 0.1)) g.usePotion('hp_potion'); if (inp.consume('Digit2', 0.1)) g.usePotion('en_potion'); if (inp.consume('Digit3', 0.1)) g.usePotion('elixir'); }
    const dodgeP = !locked && (inp.consume('ShiftLeft', 0.12) || inp.consume('ShiftRight', 0.12));
    const jumpP = !locked && inp.consume('Space', 0.12);

    this.t += dt;
    switch (this.state) {
      case 'free': this.free(dt, dx, dz, moving, wantAtk, dodgeP, jumpP); break;
      case 'attack': this.attackState(dt, wantAtk, dodgeP, moving, dx, dz); break;
      case 'skill': this.skillState(dt, dodgeP); break;
      case 'dodge': {
        const k = this.t / this.dur; const sp = 14 * (1 - k * 0.8); this.vel.set(this.dodgeDir.x * sp, 0, this.dodgeDir.z * sp); grid.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius);
        if (Math.floor(this.t * 40) % 3 === 0) g.fx.p.emit(this.pos.x, 0.6, this.pos.z, 1, { color: 0xaabbff, speed: 0.5, life: 0.3 });
        if (this.t >= this.dur) { this.state = 'free'; this.vel.multiplyScalar(0.4); }
        break;
      }
      case 'hit': { grid.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius); this.vel.multiplyScalar(Math.max(0, 1 - dt * 8)); if (this.t >= this.dur) this.state = 'free'; break; }
      case 'knock': {
        grid.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius); this.vel.multiplyScalar(Math.max(0, 1 - dt * 4)); this.invuln = Math.max(this.invuln, 0.05);
        if (this.t >= this.dur) { this.state = 'free'; this.invuln = 0.6; }
        break;
      }
      case 'land': if (this.t >= this.dur) this.state = 'free'; else { this.vel.multiplyScalar(Math.max(0, 1 - dt * 10)); grid.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius); } break;
      case 'transform': this.transformState(dt); break;
      case 'ult': this.ultState(dt); break;
      case 'victory': if (this.t > 3.2) this.state = 'free'; break;
    }
    // vertical physics
    if (this.state !== 'knock' && this.state !== 'transform' && this.state !== 'ult') {
      if (!this.grounded || this.vy > 0) { const grav = this.airDive ? 60 : 28; this.vy -= grav * dt; this.pos.y += this.vy * dt; this.fallSpeed = -this.vy; if (this.pos.y <= 0) { this.pos.y = 0; this.land(); } }
    }
    if (this.state === 'transform' || this.state === 'ult') { this.pos.y = this.state === 'transform' ? Math.min(this.pos.y + dt * 0.6, 0.8) : this.pos.y; if (this.state === 'ult') this.pos.y = Math.max(0, this.pos.y - dt * 4); }
    grid.unstick(this.pos, this.radius);
    // hazards
    const hz = g.level.hazard(this.pos.x, this.pos.z, g.time); if (hz && this.pos.y < 0.5 && this.invuln <= 0.05) { if (hz === 'lava') { this.hurt(st.hp * 0.1 * dt * 6, this.pos, { status: 'burn', hazard: true }); } else if (Math.floor(g.time * 10) !== Math.floor((g.time - dt) * 10)) this.hurt(st.hp * 0.06, this.pos, { hazard: true, kb: 3 }); }
    this.animate(dt);
  }
  takeDot(n: number) { if (this.invuln > 0 || this.state === 'dead') return; this.hp -= n; this.g.dmgNum(this.pos.x, 1.8, this.pos.z, `${Math.round(n)}`, '#7cff4a', 0.8); if (this.hp <= 0) this.die(); }

  free(dt: number, dx: number, dz: number, moving: boolean, wantAtk: boolean, dodgeP: boolean, jumpP: boolean) {
    const g = this.g; const inp = g.input; const grid = g.level.grid;
    this.blocking = !g.inputLocked && inp.down('KeyQ') && this.grounded && this.en > 0;
    if (this.blocking) { this.blockT += dt; this.en = Math.max(0, this.en - dt * 2); } else this.blockT = 0;
    // sprint / dodge
    const shift = inp.down('ShiftLeft') || inp.down('ShiftRight');
    if (dodgeP && this.dodgeCd <= 0 && this.grounded && (this.inCombat || !moving)) { this.startDodge(dx, dz, moving); return; }
    this.sprint = shift && moving && !this.blocking && this.grounded && !g.inputLocked;
    let target = (this.sprint ? 9.2 : 5.6) * (this.blocking ? 0.38 : 1) * (this.status.slow > 0 ? 0.6 : 1) * (this.tfActive ? 1.12 : 1);
    if (!moving) target = 0; const acc = this.grounded ? (moving ? 15 : 12) : 3.5;
    const k = Math.min(1, acc * dt); this.vel.x += (dx * target - this.vel.x) * k; this.vel.z += (dz * target - this.vel.z) * k;
    grid.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius);
    this.moveSpeed = Math.hypot(this.vel.x, this.vel.z);
    // facing
    const lt = this.lock && !this.lock.dead ? this.lock : null;
    if (lt) { this.yaw += clamp(ang(this.yaw, Math.atan2(lt.pos.x - this.pos.x, lt.pos.z - this.pos.z)), -14 * dt, 14 * dt); }
    else if (this.blocking) { /* keep facing */ } else if (this.moveSpeed > 0.6 && moving) { this.yaw += clamp(ang(this.yaw, Math.atan2(this.vel.x, this.vel.z)), -15 * dt, 15 * dt); }
    // footsteps
    if (this.grounded && this.moveSpeed > 1) { this.stepDist += this.moveSpeed * dt; if (this.stepDist > (this.sprint ? 2.2 : 1.7)) { this.stepDist = 0; g.sfx('step', undefined, 0.5); } }
    if (this.sprint && this.grounded) g.fx.p.emit(this.pos.x, 0.1, this.pos.z, 1, { color: 0xbbbbbb, speed: 0.6, life: 0.4 });
    // jump
    if (this.grounded) this.coyote = 0.1; else this.coyote -= dt;
    if (jumpP && (this.grounded || this.coyote > 0) && !this.blocking) { this.vy = 10.5; this.grounded = false; this.coyote = 0; g.sfx('jump', undefined, 0.8); g.fx.p.emit(this.pos.x, 0.1, this.pos.z, 8, { color: 0xcccccc, speed: 2, life: 0.4 }); }
    if (this.pos.y > 0.05) this.grounded = false;
    if (wantAtk) this.tryStart(this.pos.y > 0.4 ? 'air' : this.sprint && this.moveSpeed > 7 ? 'sprint' : (inp.down('KeyS') && this.g.enemies.some((e) => !e.dead && e.pos.distanceTo(this.pos) < 5)) ? 'sweep' : 'combo');
  }
  land() {
    const g = this.g; const wasDive = this.airDive;
    if (!this.grounded) { if (this.fallSpeed > 9) { g.fx.p.emit(this.pos.x, 0.1, this.pos.z, 12, { color: 0xcccccc, speed: 3, life: 0.5 }); g.sfx('land', undefined, 0.7); } if (this.fallSpeed > 16 && this.state === 'free') { this.state = 'land'; this.t = 0; this.dur = 0.18; } }
    this.grounded = true; this.vy = 0; this.airDive = false;
    if (wasDive && this.state === 'attack' && !this.impacted) { this.impacted = true; this.impact(AIR_ATTACK, 3.8); }
  }
  impact(step: AtkStep, r: number) {
    const g = this.g; g.fx.eff.ring(this.pos.x, this.pos.z, 0.5, r + 1, this.tfActive ? TF_STAGES[this.tfStage - 1].color : 0xbfe0ff, 0.5); g.fx.pb.emit(this.pos.x, 0.3, this.pos.z, 24, { color: 0xffffff, speed: r * 1.5, life: 0.5, grav: 6 }); g.shake(0.6); g.sfx('slam');
    for (const e of g.enemies) { if (e.dead || this.hitSet.has(e)) continue; const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) - e.radius * 0.7; if (d < r && e.y + e.hover < 2.5) this.strike(e, step, 1); }
    g.checkSecrets(this.pos, r + 1);
  }
  startDodge(dx: number, dz: number, moving: boolean) {
    const g = this.g; this.state = 'dodge'; this.t = 0; this.dur = 0.42; this.dodgeCd = 0.6; this.invuln = 0.34; this.queued = false;
    if (moving) this.dodgeDir.set(dx, 0, dz); else this.dodgeDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const lt = this.lock && !this.lock.dead; if (!moving && !lt) this.yaw = this.yaw; else if (!lt) this.yaw = Math.atan2(dx, dz);
    g.sfx('dodge'); g.fx.p.emit(this.pos.x, 0.5, this.pos.z, 10, { color: 0xaabbff, speed: 2, life: 0.4 }); this.comboT = 0;
  }
  // ── attacks ──
  autoAim() {
    const g = this.g; let best: Enemy | null = null, bs = 1e9; const base = this.aimDir.lengthSq() > 0.01 && this.moveSpeed > 0.5 ? Math.atan2(this.aimDir.x, this.aimDir.z) : this.yaw;
    const lt = this.lock && !this.lock.dead ? this.lock : null; if (lt) { this.yaw = Math.atan2(lt.pos.x - this.pos.x, lt.pos.z - this.pos.z); return; }
    for (const e of g.enemies) { if (e.dead || e.state === 'dormant') continue; const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z; const d = Math.hypot(dx, dz); if (d > 7) continue; const a = Math.abs(ang(base, Math.atan2(dx, dz))); if (a > 1.2) continue; const s = d + a * 3; if (s < bs) { bs = s; best = e; } }
    if (best) this.yaw = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z); else if (this.moveSpeed > 0.5) this.yaw = base;
  }
  tryStart(kind: 'combo' | 'sweep' | 'air' | 'sprint') {
    if (this.state !== 'free' && !(this.state === 'attack')) return; if (this.state === 'attack') { this.queued = true; return; }
    const g = this.g; let step: AtkStep; const steps = COMBOS[this.wtype];
    if (kind === 'sweep') step = SWEEP; else if (kind === 'air') step = AIR_ATTACK; else if (kind === 'sprint') step = SPRINT_ATTACK;
    else { let idx = this.comboT > 0 && this.comboIdx >= 0 && this.comboIdx < steps.length - 1 ? this.comboIdx + 1 : 0; if (this.comboT <= 0) idx = 0; this.comboIdx = idx; step = steps[idx]; }
    this.beginStep(step, kind === 'combo'); void g;
  }
  beginStep(step: AtkStep, isCombo: boolean) {
    const g = this.g; this.step = step; this.state = 'attack'; this.t = 0; this.dur = step.dur / this.aspd; this.hitSet.clear(); this.queued = false; this.impacted = false; this.spinFx = false; this.blocking = false;
    if (step === AIR_ATTACK) { this.airDive = true; this.vy = -6; this.dur = 0.7; } else this.autoAim();
    if (!isCombo) { this.comboIdx = -1; }
    this.comboCount++; this.comboShowT = 2.5; g.notifyAttack(this.pos, step.range);
    g.sfx(step.heavy ? 'swingHeavy' : 'swing'); this.vel.set(0, 0, 0);
  }
  attackState(dt: number, wantAtk: boolean, dodgeP: boolean, moving: boolean, dx: number, dz: number) {
    const g = this.g; const s = this.step!; const t = this.t / this.dur; const grid = g.level.grid;
    if (wantAtk) this.queued = true;
    // lunge during windup/strike
    if (s.lunge > 0 && t < s.hs + 0.12 && s !== AIR_ATTACK) { const sp = s.lunge / (this.dur * (s.hs + 0.12)); const near = g.enemies.some((e) => !e.dead && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < e.radius + 1.2 && Math.abs(ang(this.yaw, Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z))) < 0.8); if (!near) grid.move(this.pos, Math.sin(this.yaw) * sp * dt, Math.cos(this.yaw) * sp * dt, this.radius); }
    if (s === AIR_ATTACK && !this.grounded) { this.vel.set(0, 0, 0); }
    // hit window
    if (t >= s.hs && t <= s.he && s !== AIR_ATTACK) {
      if (!this.spinFx) { this.spinFx = true; this.swingFx(s); }
      for (const e of g.enemies) if (!e.dead && !this.hitSet.has(e) && this.inArc(e, s)) this.strike(e, s, 1);
      g.checkSecrets(new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * s.range * 0.6, 0, this.pos.z + Math.cos(this.yaw) * s.range * 0.6), s.range * 0.7);
    }
    if (s === AIR_ATTACK && !this.impacted && this.grounded) { this.impacted = true; this.impact(s, 3.8); }
    if (t >= s.he && dodgeP && this.dodgeCd <= 0) { this.startDodge(dx, dz, moving); return; }
    // chain
    if (this.queued && t >= s.he + 0.02 && s !== AIR_ATTACK) { this.comboT = 1; this.tryChain(); return; }
    if (t >= 1 || (moving && t > 0.82 && !this.queued)) { this.state = 'free'; this.comboT = 0.55; this.step = null; if (s === SWEEP || s === SPRINT_ATTACK || s === AIR_ATTACK) this.comboIdx = -1; }
  }
  tryChain() {
    const steps = COMBOS[this.wtype]; const prev = this.step!; let idx = this.comboIdx; if (prev === SWEEP || prev === SPRINT_ATTACK || prev === AIR_ATTACK || idx < 0) idx = -1; idx = idx + 1 >= steps.length ? 0 : idx + 1;
    this.comboIdx = idx; this.state = 'free'; this.beginStep(steps[idx], true);
  }
  swingFx(s: AtkStep) {
    const g = this.g; const col = this.tfActive ? TF_STAGES[this.tfStage - 1].color : this.stats.elem !== 'none' ? ELEM_COLOR[this.stats.elem] : 0xd8ecff;
    const tilt = s.style === 'overhead' || s.style === 'slam' ? 0.9 : s.style === 'uppercut' ? -0.8 : s.style === 'slashL' ? 0.25 : -0.25;
    const arc = (Math.min(s.arc, 330) * Math.PI) / 180;
    g.fx.eff.crescent(this.pos.x + Math.sin(this.yaw) * 0.4, 1.1, this.pos.z + Math.cos(this.yaw) * 0.4, this.yaw, s.range * 0.9, arc, col, 0.22, s.low ? 0 : tilt);
    if (s.style === 'slam') { g.fx.eff.ring(this.pos.x + Math.sin(this.yaw) * s.range * 0.6, this.pos.z + Math.cos(this.yaw) * s.range * 0.6, 0.5, s.range * 0.8, col, 0.4); g.shake(0.35); }
  }
  inArc(e: Enemy, s: { range: number; arc: number }): boolean {
    const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z; const d = Math.hypot(dx, dz); if (d - e.radius * 0.85 > s.range) return false;
    if (s.arc < 360) { const da = Math.abs(ang(this.yaw, Math.atan2(dx, dz))); if (da > (s.arc * Math.PI) / 360 + Math.atan2(e.radius * 0.8, Math.max(d, 0.3))) return false; }
    const ey = e.hover + e.y; if (this.pos.y > ey + e.height + 0.4 || this.pos.y + 2.1 < ey) return false;
    if (d > 1.5 && this.g.level.grid.ray(this.pos.x, this.pos.z, e.pos.x, e.pos.z, false) < 1) return false;
    return true;
  }
  strike(e: Enemy, s: { dmg: number; kb: number; poise: number; launch?: boolean; heavy?: boolean; low?: boolean }, mult: number, tag = 'hit') {
    const g = this.g; const st = this.stats; this.hitSet.add(e);
    const crit = Math.random() < st.crit / 100; let raw = st.atk * s.dmg * mult * this.dmgMult * (0.93 + Math.random() * 0.14) * (crit ? st.critDmg / 100 : 1);
    if (st.passives.includes('executioner') && e.hp / e.maxHp < 0.3) raw *= 1.3; raw += st.elemDmg * 0.5 * s.dmg;
    const dir = new THREE.Vector3(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize();
    const dmg = e.takeHit(g, raw, { kb: s.kb, dir, poise: s.poise * (this.tfActive ? 1.3 : 1), launch: s.launch, knockdown: s.low, el: st.elem, crit, heavy: s.heavy });
    if (dmg <= 0) return;
    const hy = e.hover + e.y + e.height * 0.55; g.fx.pb.emit(e.pos.x, hy, e.pos.z, crit ? 14 : 8, { color: crit ? 0xffe14a : 0xffffff, speed: crit ? 7 : 4.5, life: 0.35 }); g.fx.p.emit(e.pos.x, hy, e.pos.z, 6, { color: st.elem !== 'none' ? ELEM_COLOR[st.elem] : 0xffd0a0, speed: 5, life: 0.3, grav: 8 });
    if (s.heavy || s.launch) g.fx.eff.burst(e.pos.x, hy, e.pos.z, 1.2, 0xffffff, 0.2);
    g.sfx(crit ? 'crit' : 'hit', e.pos, tag === 'skill' ? 0.9 : 1); g.dmgNum(e.pos.x, hy + 0.8, e.pos.z, `${dmg}`, crit ? '#ffe14a' : '#ffffff', crit ? 1.4 : s.heavy ? 1.15 : 1);
    if (tag !== 'skill') { g.hitStop(crit || s.heavy ? 85 : 45); g.shake(s.heavy ? 0.45 : crit ? 0.3 : 0.14); }
    this.gainEn(2.5); this.addTf((s.heavy ? 2.4 : 1.1) * (st.passives.includes('surge') ? 1.5 : 1) * (s.dmg > 1.5 ? 1.2 : 1));
    if (st.passives.includes('lifesteal')) this.hp = Math.min(this.maxHp, this.hp + dmg * 0.04);
    this.combatT = 4; if (tag !== 'skill') this.comboShowT = 2.5;
  }
  // ── skills ──
  trySkill(id: 'burst' | 'rift') {
    if (this.state !== 'free' && !(this.state === 'attack' && this.t / this.dur >= (this.step?.he ?? 1))) return; const rank = useGame.getState().player.skills[id]; const sk: any = skillStats(id, rank);
    const ck = id === 'burst' ? 'e' : 'r';
    if (this.cds[ck] > 0) { this.g.hint(`${id === 'burst' ? 'Abyssal Burst' : 'Shadow Rift'} cooling down`); return; }
    if (this.en < sk.cost) { this.g.hint('Not enough energy'); return; }
    this.en -= sk.cost; this.cds[ck] = sk.cd; if (id === 'burst') this.cds.eMax = sk.cd; else this.cds.rMax = sk.cd;
    this.state = 'skill'; this.skillId = id; this.t = 0; this.dur = id === 'burst' ? 0.55 : 0.7; this.fired = 0; this.autoAim(); this.vel.set(0, 0, 0); this.step = null; this.queued = false; this.comboT = 0;
    this.g.notifyAttack(this.pos, 10); this.g.sfx(id === 'burst' ? 'burst' : 'rift');
  }
  skillState(dt: number, dodgeP: boolean) {
    const g = this.g; const t = this.t / this.dur; const id = this.skillId; const rank = useGame.getState().player.skills[id]; const sk: any = skillStats(id, rank); const col = id === 'burst' ? 0xc084fc : 0x8a4aff;
    if (id === 'burst' && this.fired === 0 && t >= 0.4) {
      this.fired = 1; const n = this.tfActive ? 3 : 1; const target = this.homingTarget(); const base = target ? Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z) : this.yaw;
      for (let i = 0; i < n; i++) { const a = base + (n === 1 ? 0 : (i - 1) * 0.22); g.shoot({ x: this.pos.x + Math.sin(a) * 0.8, y: 1.3, z: this.pos.z + Math.cos(a) * 0.8, dx: Math.sin(a), dz: Math.cos(a), speed: 22, dmg: this.stats.atk * sk.dmg * this.dmgMult * (rank >= 5 && this.tfActive ? 1.25 : 1), color: this.tfActive ? TF_STAGES[this.tfStage - 1].color : col, owner: 'player', radius: 0.5, pierce: sk.pierce, aoe: sk.aoe, homing: target, life: 2.2 }); }
      g.fx.pb.emit(this.pos.x, 1.3, this.pos.z, 20, { color: col, speed: 5, life: 0.4 }); g.shake(0.15);
    }
    if (id === 'rift') {
      const times = sk.dbl || this.tfActive ? [0.38, 0.6] : [0.38];
      for (let i = 0; i < times.length; i++) if (this.fired === i && t >= times[i]) {
        this.fired = i + 1; const range = sk.range * (i === 1 ? 1.15 : 1);
        g.fx.eff.crescent(this.pos.x + Math.sin(this.yaw) * 1, 1.3, this.pos.z + Math.cos(this.yaw) * 1, this.yaw, range, 1.9, col, 0.45, i === 0 ? -0.35 : 0.35); g.fx.eff.crescent(this.pos.x + Math.sin(this.yaw) * 1, 1.3, this.pos.z + Math.cos(this.yaw) * 1, this.yaw, range * 0.7, 1.6, 0xffffff, 0.3, i === 0 ? -0.35 : 0.35);
        g.shake(0.4); g.sfx('rift'); g.fx.pb.emit(this.pos.x + Math.sin(this.yaw) * range * 0.5, 1.2, this.pos.z + Math.cos(this.yaw) * range * 0.5, 30, { color: col, speed: 6, life: 0.5 });
        const dmg = sk.dmg * (this.tfActive ? 1.15 : 1);
        for (const e of g.enemies) { if (e.dead || !this.inArcR(e, range, 115)) continue; this.strike(e, { dmg, kb: 6, poise: 38, launch: false, heavy: true }, 1, 'skill'); if (sk.pull && !e.dead) { const d = new THREE.Vector3(this.pos.x - e.pos.x, 0, this.pos.z - e.pos.z).normalize(); e.knock.addScaledVector(d, 16); } }
        g.hitStop(70); g.checkSecrets(new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * range * 0.5, 0, this.pos.z + Math.cos(this.yaw) * range * 0.5), range * 0.6);
        g.level.grid.move(this.pos, Math.sin(this.yaw) * 1.6, Math.cos(this.yaw) * 1.6, this.radius);
      }
    }
    if (this.t / this.dur >= 1) { this.state = 'free'; this.step = null; }
    else if (t > 0.7 && dodgeP && this.dodgeCd <= 0) this.startDodge(0, 0, false);
    void dt;
  }
  inArcR(e: Enemy, range: number, arcDeg: number) { return this.inArc(e, { range, arc: arcDeg }); }
  homingTarget(): Enemy | null {
    const g = this.g; if (this.lock && !this.lock.dead) return this.lock; let best: Enemy | null = null, bs = 1e9;
    for (const e of g.enemies) { if (e.dead || e.state === 'dormant') continue; const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z; const d = Math.hypot(dx, dz); if (d > 30) continue; const a = Math.abs(ang(this.yaw, Math.atan2(dx, dz))); if (a > 0.9) continue; const s = d + a * 6; if (s < bs) { bs = s; best = e; } }
    return best;
  }
  tryUlt() {
    if (this.state !== 'free') return; const rank = useGame.getState().player.skills.judgment; const sk: any = skillStats('judgment', rank);
    if (this.cds.v > 0) { this.g.hint('Abyssal Judgment cooling down'); return; } if (this.en < sk.cost) { this.g.hint(`Needs ${Math.round(sk.cost)} energy`); return; }
    this.en -= sk.cost; this.cds.v = sk.cd; this.cds.vMax = sk.cd; this.state = 'ult'; this.t = 0; this.dur = 2.9; this.fired = 0; this.invuln = this.dur; this.vel.set(0, 0, 0); this.lock = this.lock;
    const g = this.g; g.sfx('ult'); g.slowmo(0.4, 1.0); g.flash('#8a4aff', 0.5);
    const p = this.pos; g.startCine(2.9, (f) => { const a = f * 2.2 + this.yaw; const d = 7 + f * 5; return { pos: new THREE.Vector3(p.x + Math.sin(a + 3) * d, 1.8 + f * 5, p.z + Math.cos(a + 3) * d), look: new THREE.Vector3(p.x, 1.6 + f * 1.5, p.z), fov: 60 + f * 10 }; });
  }
  ultState(dt: number) {
    const g = this.g; const rank = useGame.getState().player.skills.judgment; const sk: any = skillStats('judgment', rank); const t = this.t;
    const col = this.tfActive ? TF_STAGES[this.tfStage - 1].color : 0xff3d7f;
    if (t < 1.0) { const a = Math.random() * 6.28; g.fx.p.emit(this.pos.x + Math.cos(a) * 3, 0.2, this.pos.z + Math.sin(a) * 3, 3, { color: col, speed: 0.5, up: 7, life: 0.7 }); if (Math.floor(t * 20) !== Math.floor((t - dt) * 20)) g.fx.eff.ring(this.pos.x, this.pos.z, 4, 0.5, col, 0.4); }
    const waves = sk.waves + (this.tfActive ? 1 : 0); const start = 1.05; const gap = 0.3;
    for (let i = 0; i < waves; i++) if (this.fired === i && t >= start + i * gap) {
      this.fired = i + 1; const R = sk.radius; g.sfx('ultHit'); g.shake(0.9); g.flash('#ffffff', 0.25);
      g.fx.eff.ring(this.pos.x, this.pos.z, 1, R, col, 0.7, 0.15, 0.1); g.fx.eff.ring(this.pos.x, this.pos.z, 1, R * 0.6, 0xffffff, 0.5, 0.2, 0.1);
      for (let k = 0; k < 7; k++) { const a = Math.random() * 6.28, d = Math.random() * R; const x = this.pos.x + Math.cos(a) * d, z = this.pos.z + Math.sin(a) * d; g.fx.eff.pillar(x, z, 1.2 + Math.random(), 14, col, 0.7); g.fx.pb.emit(x, 0.5, z, 10, { color: col, speed: 6, life: 0.6, grav: 5 }); }
      g.fx.eff.pillar(this.pos.x, this.pos.z, 2.2, 18, 0xffffff, 0.8);
      for (const e of g.enemies) { if (e.dead || e.state === 'dormant') continue; const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z); if (d < R + e.radius) { this.strike(e, { dmg: sk.dmg * (this.tfActive ? 1.2 : 1), kb: 5, poise: rank >= 5 ? 90 : 45, launch: false, heavy: true }, 1, 'skill'); e.knock.addScaledVector(new THREE.Vector3(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize(), 6); } }
      g.checkSecrets(this.pos, R); g.hitStop(60);
    }
    if (t >= this.dur) { this.state = 'free'; this.invuln = 0.4; }
  }
  // ── transformation ──
  tryTransform() {
    if (this.state !== 'free') return; if (this.tfActive) { this.g.hint('Already awakened'); return; } if (this.tf < 100) { this.g.hint(`Awakening meter ${Math.floor(this.tf)}% — fight to charge it`); return; }
    const stage = TF_STAGES[this.tfStage - 1]; const rank = useGame.getState().player.skills.awaken;
    this.state = 'transform'; this.t = 0; this.dur = 2.6; this.invuln = this.dur + 0.2; this.fired = 0; this.vel.set(0, 0, 0); this.tfMax = stage.dur + (rank - 1) * 2; this.lock = this.lock;
    const g = this.g; g.sfx('transform'); g.slowmo(0.5, 1.4); g.flash('#ffffff', 0.4); g.hud(stage.name.toUpperCase(), stage.color);
    const p = this.pos; g.startCine(2.6, (f) => { const a = this.yaw + Math.PI + f * 1.4; const d = 5.5 - f * 1.5; return { pos: new THREE.Vector3(p.x + Math.sin(a) * d, 1.2 + f * 1.2, p.z + Math.cos(a) * d), look: new THREE.Vector3(p.x, 1.5 + f * 0.3, p.z), fov: 62 - f * 8 }; });
  }
  transformState(dt: number) {
    const g = this.g; const t = this.t; const stage = TF_STAGES[this.tfStage - 1];
    g.fx.p.emit(this.pos.x, 0.2 + Math.random() * 2, this.pos.z, 5, { color: stage.color, speed: 1.2, up: 6, life: 0.8 });
    if (Math.floor(t * 6) !== Math.floor((t - dt) * 6)) g.fx.eff.ring(this.pos.x, this.pos.z, 3.5, 0.5, stage.color, 0.5, 0.2 + t * 0.2);
    if (this.fired === 0 && t > 1.3) {
      this.fired = 1; this.tfActive = true; this.tf = 100; this.tfTime = this.tfMax; this.applyLook(); g.flash('#ffffff', 0.9); g.shake(1.1); g.sfx('ultHit');
      g.fx.eff.ring(this.pos.x, this.pos.z, 1, 16, stage.color, 0.8); g.fx.eff.pillar(this.pos.x, this.pos.z, 2.5, 20, stage.color, 1.2); g.fx.pb.emit(this.pos.x, 1, this.pos.z, 120, { color: stage.color, speed: 12, life: 1 });
      for (const e of g.enemies) { if (e.dead) continue; const d = e.pos.distanceTo(this.pos); if (d < 12 && !e.isBoss) e.knock.addScaledVector(new THREE.Vector3(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize(), 12); }
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25); g.checkSecrets(this.pos, 8);
    }
    if (t >= this.dur) { this.state = 'free'; this.invuln = 0.3; }
  }
  endTransform() { this.tfActive = false; this.tf = 0; this.tfTime = 0; this.applyLook(); this.g.sfx('tfEnd'); this.g.fx.pb.emit(this.pos.x, 1, this.pos.z, 50, { color: 0x9b5cff, speed: 6, life: 0.8 }); this.g.hud('AWAKENING FADES', 0xaa88ff); this.g.flash('#6a3aff', 0.25); }
  // ── damage ──
  hurt(dmg: number, from: THREE.Vector3, o: { knock?: boolean; kb?: number; status?: string; poise?: number; src?: Enemy | null; tick?: boolean; hazard?: boolean } = {}): boolean {
    const g = this.g; if (this.state === 'dead') return false;
    if (this.invuln > 0) { if (this.state === 'dodge' && this.perfectCd <= 0 && !o.hazard && !o.tick && this.t < this.dur) { this.perfectCd = 1.2; this.perfectDodge(); } return false; }
    const dx = from.x - this.pos.x, dz = from.z - this.pos.z; const toSrc = Math.atan2(dx, dz);
    if (this.blocking && Math.abs(ang(this.yaw, toSrc)) < 1.7 && !o.hazard) {
      if (this.blockT < 0.22 && !o.tick) { this.en = Math.min(this.maxEn, this.en + 18); this.addTf(8); g.sfx('parry'); g.fx.pb.emit(this.pos.x + Math.sin(this.yaw) * 0.9, 1.3, this.pos.z + Math.cos(this.yaw) * 0.9, 30, { color: 0xffffcc, speed: 7, life: 0.4 }); g.fx.eff.burst(this.pos.x + Math.sin(this.yaw) * 0.9, 1.3, this.pos.z + Math.cos(this.yaw) * 0.9, 1.5, 0xffffff, 0.25); g.slowmo(0.3, 0.3); g.shake(0.4); g.dmgNum(this.pos.x, 2.2, this.pos.z, 'PERFECT PARRY', '#ffffaa', 1.2); if (o.src && !o.src.dead) { o.src.poise += o.src.isBoss ? 80 : 999; if (o.src.poise >= o.src.maxPoise && !o.src.isBoss) o.src.takeHit(g, 1, { poise: 1, dir: new THREE.Vector3(-dx, 0, -dz).normalize(), kb: 6 }); else if (o.src.isBoss) o.src.takeHit(g, 1, { poise: 80 }); } return false; }
      dmg *= 0.25; g.sfx('block'); g.fx.pb.emit(this.pos.x + Math.sin(this.yaw) * 0.9, 1.3, this.pos.z + Math.cos(this.yaw) * 0.9, 10, { color: 0xffffff, speed: 4, life: 0.3 }); this.en = Math.max(0, this.en - dmg * 0.5); const d = new THREE.Vector3(-dx, 0, -dz).normalize(); this.vel.addScaledVector(d, 4);
    }
    const def = st_def(this.stats.def); dmg *= def * (this.stats.passives.includes('guard') ? 0.9 : 1) * (this.status.slow > 0 ? 1 : 1);
    dmg = Math.max(1, Math.round(dmg)); this.hp -= dmg; this.lastHitT = g.time; this.rig.flash(0.8); this.combatT = 4;
    g.dmgNum(this.pos.x, 2.1, this.pos.z, `${dmg}`, '#ff5a5a', 1.1); g.flash('#ff2030', 0.18); g.sfx('hurt', undefined, 0.8); g.shake(Math.min(0.8, 0.2 + dmg / this.maxHp * 2)); this.addTf((dmg / this.maxHp) * 45);
    if (o.status === 'burn') this.status.burn = 3; if (o.status === 'slow') this.status.slow = 2.5; if (o.status === 'poison') this.status.poison = 4;
    if (this.hp <= 0) { this.die(); return true; }
    if (!o.tick && !o.hazard) {
      const d = new THREE.Vector3(-dx, 0, -dz).normalize();
      if (o.knock) { this.state = 'knock'; this.t = 0; this.dur = 1.35; this.vel.set(d.x * (o.kb ?? 8), 0, d.z * (o.kb ?? 8)); this.step = null; this.queued = false; this.vy = Math.max(this.vy, 3); this.grounded = false; this.airDive = false; g.hitStop(80); }
      else if ((dmg > this.maxHp * 0.12 || (o.poise ?? 0) >= 25) && !(this.state === 'attack' && this.step?.heavy) && this.state !== 'skill') { this.state = 'hit'; this.t = 0; this.dur = 0.38; this.vel.set(d.x * 5, 0, d.z * 5); this.step = null; this.queued = false; g.hitStop(60); }
      else { this.vel.addScaledVector(d, 2.5); }
    }
    return true;
  }
  perfectDodge() { const g = this.g; g.slowmo(0.35, 0.55); g.sfx('parry', undefined, 0.6); this.gainEn(14); this.addTf(7); g.dmgNum(this.pos.x, 2.2, this.pos.z, 'PERFECT DODGE', '#aaddff', 1.2); g.fx.eff.ring(this.pos.x, this.pos.z, 0.5, 4, 0xaaddff, 0.5); g.hudSet({ perfect: Date.now() }); }
  die() { const g = this.g; this.hp = 0; this.state = 'dead'; this.t = 0; this.blocking = false; if (this.tfActive) { this.tfActive = false; this.applyLook(); } g.sfx('defeat'); g.slowmo(0.4, 1.2); g.onPlayerDeath(); }
  revive() { this.state = 'free'; this.hp = this.maxHp; this.en = this.maxEn; this.invuln = 2; this.status = { burn: 0, slow: 0, poison: 0 }; this.tf = Math.min(this.tf, 50); this.grounded = true; this.vy = 0; this.pos.y = 0; }
  victory() { this.state = 'victory'; this.t = 0; this.g.sfx('victory'); }

  animate(dt: number) {
    const a: AnimIn = { state: 'idle', speed: this.moveSpeed }; const t = this.dur > 0 ? clamp(this.t / this.dur, 0, 1) : 0;
    switch (this.state) {
      case 'attack': a.state = 'attack'; a.style = this.step?.style; a.t = t; break;
      case 'skill': a.state = 'attack'; a.style = this.skillId === 'burst' ? 'cast' : 'slashR'; a.t = t; break;
      case 'dodge': a.state = 'dodge'; a.t = t; break;
      case 'hit': a.state = 'hit'; break;
      case 'knock': a.state = t < 0.62 ? 'knock' : 'getup'; a.t = t < 0.62 ? 0 : (t - 0.62) / 0.38; break;
      case 'dead': a.state = 'dead'; break;
      case 'transform': a.state = 'transform'; a.t = t; break;
      case 'ult': a.state = 'ult'; a.t = t * 2.9 / 1.0; break;
      case 'land': a.state = 'land'; break;
      case 'victory': a.state = 'victory'; break;
      default:
        if (!this.grounded && this.pos.y > 0.1) a.state = this.vy > 0 ? 'jump' : 'fall';
        else if (this.blocking) a.state = 'block'; else if (this.moveSpeed > 0.8) { a.state = 'move'; a.sprint = this.sprint; } else a.state = 'idle';
    }
    this.rig.update(dt, a); this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw;
    if (this.tfActive) { this.g.fx.p.emit(this.pos.x, 0.2 + Math.random() * 2, this.pos.z, 1, { color: TF_STAGES[this.tfStage - 1].color, speed: 0.4, up: 2.5, life: 0.7 }); }
    if (this.state === 'dead') this.rig.root.position.y = 0;
  }
}
const st_def = (def: number) => 100 / (100 + def * 3);
