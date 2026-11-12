import * as THREE from 'three';
import { WEAPONS, SKILL_BY_ID, skillScale, type AtkDef, type SkillDef } from './data';
import { buildPlayer, addMat, G, type PlayerRig } from './models';
import { Trail } from './fx';
import { computeStats, useStore, swapWeapons, bumpStat, xpNeed, type Derived } from './store';
import { sfx } from './audio';
import { clamp, damp, dampAngle, wrap, ease, TAU } from './util';
import type { Game } from './engine';
import type { Enemy } from './enemy';

export type PState = 'free' | 'atk' | 'charge' | 'dodge' | 'guard' | 'cast' | 'hurt' | 'dead' | 'ult' | 'awaken' | 'victory';
interface Chan { t: number; dur: number; fn: (dt: number, c: Chan) => void; done?: () => void }
const REST_W: [number, number, number] = [Math.PI / 2 - 0.45, 0, 0];
const POSES: Record<string, { w: number[]; s: number[] }> = {
  // [armX, armZ, twist, lean]
  R: { w: [-1.3, -0.8, -1.0, 0.05], s: [-1.5, 0.5, 1.1, 0.18] }, L: { w: [-1.3, 0.5, 1.0, 0.05], s: [-1.5, -0.8, -1.1, 0.18] },
  O: { w: [-3.0, -0.2, 0, -0.3], s: [-1.1, 0, 0, 0.5] }, U: { w: [-0.4, -0.4, -0.6, 0.3], s: [-2.7, 0.2, 0.5, -0.25] },
  T: { w: [-1.0, -0.3, -0.7, -0.12], s: [-1.57, 0, 0.5, 0.4] }, S: { w: [-1.4, -0.8, -1.0, 0.1], s: [-1.5, 0.3, 1.0, 0.1] },
  X: { w: [-0.8, -0.9, -0.8, 0.05], s: [-1.6, 0.5, 0.9, 0.2] }, C: { w: [-0.6, -0.3, 0.1, -0.1], s: [-1.6, 0, 0.2, 0.15] },
};
const GUARD: Record<string, { ax: number; az: number; lx: number; lz: number; w: [number, number, number] }> = {
  vertical: { ax: -1.4, az: -0.15, lx: -1.3, lz: 0.25, w: REST_W }, horizontal: { ax: -1.1, az: 0.75, lx: -0.5, lz: 0.2, w: [Math.PI / 2 - 0.2, 0, Math.PI / 2] },
  cross: { ax: -1.2, az: 0.9, lx: -1.2, lz: -0.9, w: [Math.PI / 2 - 0.2, 0, 1.2] }, low: { ax: -0.8, az: -0.4, lx: -0.8, lz: 0.3, w: [Math.PI / 2 - 1.0, 0, 0.3] },
  overhead: { ax: -2.5, az: -0.1, lx: -2.5, lz: 0.2, w: [Math.PI / 2, 0, Math.PI / 2] }, staff: { ax: -1.3, az: -0.2, lx: -1.2, lz: 0.3, w: REST_W },
  reverse: { ax: -1.7, az: 0.5, lx: -0.6, lz: 0.2, w: [-Math.PI / 2, 0, 0.5] },
};
const GUARD_EFF: Record<string, number> = { greatsword: 0.14, hammer: 0.12, katana: 0.2, spear: 0.24, scythe: 0.24, dagger: 0.3, dual: 0.28, staff: 0.2 };

export class Player {
  group = new THREE.Group(); pos = new THREE.Vector3(); vx = 0; vz = 0; vy = 0; yaw = 0; grounded = true; landT = 0;
  rig!: PlayerRig; ghost: PlayerRig | null = null; trail!: Trail; shield: THREE.Mesh; stats: Derived; rev = -1; lastLook = '';
  hp = 100; maxHp = 100; sta = 100; maxSta = 100; mp = 80; maxMp = 80; ult = 0; awk = 0; awakenT = 0; awakened = false;
  state: PState = 'free'; st = 0; atk: AtkDef | null = null; atkIdx = 0; atkHit = 0; comboWin = 0; nextIdx = 0; buffer = 0; atkMul = 1; atkKind = ''; airAtk = false; counterAtk = false;
  guardT = 99; guardCd = 0; counterT = 0; counterTarget: Enemy | null = null; iframes = 0; dodgeVx = 0; dodgeVz = 0; dodgeDur = 0.34; dodgeBuf = 0; staDelay = 0; chargeT = 0; hurtT = 0;
  castDef: SkillDef | null = null; castLv = 1; castT = 0; castFired = false; cds: Record<string, number> = {}; selected = 0; chans: Chan[] = [];
  barrier = 0; barrierT = 0; invisT = 0; nextCrit = false; clones: { rig: PlayerRig; x: number; z: number; t: number; h: number; ang: number }[] = [];
  combo = 0; comboT = 0; maxCombo = 0; damageTaken = 0; perfects = 0; lastPerfDodge = -9; swapCd = 0; lock: Enemy | null = null; walkPh = 0; ultKind = ''; ultT = 0; victoryT = 0; aimYaw = 0; slipping = false; pushX = 0; pushZ = 0; deathT = 0;
  pose = { ax: -0.3, az: -0.05, lx: -0.1, lz: 0.05, tw: 0, lean: 0, spin: 0, wx: REST_W[0], wy: 0, wz: 0, drop: 0, roll: 0, head: 0 };
  private tipV = new THREE.Vector3(); private baseV = new THREE.Vector3(); private pw: [number, number, number] = [...REST_W];

  constructor(public g: Game) {
    this.stats = computeStats(useStore.getState().save);
    this.shield = new THREE.Mesh(G.sph(1.5, 20, 14), addMat(0x66ccff, 0.22) as unknown as THREE.Material); this.shield.visible = false; this.shield.position.y = 1;
    this.trail = new Trail(g.scene); g.scene.add(this.group);
    this.rebuild(); this.refresh(true);
  }
  get W() { return WEAPONS[this.stats.family]; }
  get aspd() { return this.W.spd * (this.awakened ? 1.22 : 1); }
  get dead() { return this.state === 'dead'; }
  rebuild() {
    const s = useStore.getState().save, eq = s.equip;
    if (this.rig) { this.group.remove(this.rig.root); }
    this.rig = buildPlayer({ weapon: eq.weapon, weapon2: eq.weapon2, helmet: eq.helmet, armor: eq.armor, gloves: eq.gloves, boots: eq.boots, ring: eq.ring, artifact: eq.artifact, awakened: this.awakened });
    this.group.add(this.rig.root); this.rig.root.add(this.shield);
    this.trail.setColor(this.awakened ? 0xffd860 : this.W.glow); this.trail.reset();
    if (this.ghost) { this.group.remove(this.ghost.root); this.ghost = null; }
    this.rig.root.visible = this.invisT <= 0;
    this.lastLook = JSON.stringify([eq.weapon?.id, eq.weapon2?.id, eq.helmet?.id, eq.armor?.id, eq.gloves?.id, eq.boots?.id, eq.ring?.id, eq.artifact?.id]);
  }
  refresh(full = false) {
    const store = useStore.getState(); this.rev = store.rev; const old = this.stats; this.stats = computeStats(store.save);
    const aw = this.awakened ? 1.15 : 1;
    this.maxHp = Math.round(this.stats.hp * aw); this.maxSta = this.stats.stamina; this.maxMp = this.stats.mana;
    if (full) { this.hp = this.maxHp; this.sta = this.maxSta; this.mp = this.maxMp; } else { this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - old.hp * aw) * 0.5); this.sta = Math.min(this.sta, this.maxSta); this.mp = Math.min(this.mp, this.maxMp); }
    const look = JSON.stringify([store.save.equip.weapon?.id, store.save.equip.weapon2?.id, store.save.equip.helmet?.id, store.save.equip.armor?.id, store.save.equip.gloves?.id, store.save.equip.boots?.id, store.save.equip.ring?.id, store.save.equip.artifact?.id]);
    if (look !== this.lastLook && this.rig) this.rebuild();
  }
  resetForFloor(x: number, z: number, yaw: number) {
    this.pos.set(x, 0, z); this.vx = this.vz = this.vy = 0; this.yaw = yaw; this.state = 'free'; this.st = 0; this.iframes = 1.2; this.chans = []; this.combo = 0; this.comboT = 0; this.comboWin = 0; this.buffer = 0;
    this.maxCombo = 0; this.damageTaken = 0; this.perfects = 0; this.lock = null; this.counterT = 0; this.chargeT = 0; this.barrier = 0; this.invisT = 0; this.nextCrit = false; this.guardT = 99; this.grounded = true;
    for (const c of this.clones) this.group.remove(c.rig.root); this.clones = []; this.shield.visible = false; if (this.rig) this.rig.root.visible = true; this.trail.reset();
    if (this.awakened) this.endAwaken(true);
    this.refresh(true); this.cds = {};
  }
  addUlt(n: number) { this.ult = clamp(this.ult + n, 0, 100); if (!this.awakened) this.awk = clamp(this.awk + n * 0.7, 0, 100); }
  heal(n: number) { this.hp = Math.min(this.maxHp, this.hp + n); }

  // ---------- damage rolls ----------
  roll(mult: number, forceCrit = false): { d: number; crit: boolean } {
    const st = this.stats; let m = mult * this.W.dmg * (this.awakened ? 1.5 : 1);
    if (this.g.spec?.mod === 'glass') m *= 2;
    const crit = forceCrit || this.nextCrit || Math.random() * 100 < st.crit;
    if (crit) m *= st.critDmg / 100;
    return { d: Math.max(1, Math.round(st.atk * m * (0.94 + Math.random() * 0.12))), crit };
  }
  // ---------- take damage ----------
  take(raw: number, o: { x: number; z: number; unblock?: boolean; kind: 'melee' | 'proj' | 'aoe' | 'env'; e?: Enemy; proj?: boolean; noKnock?: boolean; multi?: boolean }): string {
    const g = this.g; if (this.state === 'dead' || g.cleared && g.spec?.mode === 'training') return 'iframe';
    const mod = g.spec?.mod === 'glass' ? 3 : 1;
    if (this.state === 'dodge' && this.st < this.dodgeDur * 0.85 && o.kind !== 'env') {
      if (g.time - this.lastPerfDodge > 1.4 && this.st < 0.2) { this.lastPerfDodge = g.time; g.slowmo(0.3, 0.55); this.addUlt(8); g.addScore(80, 'PERFECT DODGE'); g.callout('PERFECT DODGE', '#9ff'); g.fx.ring(this.pos.x, 0.2, this.pos.z, 0x99ffff, 4, 0.4); sfx('dodge', 0.6, 1.5); bumpStat('dodges'); }
      return 'dodged';
    }
    if (this.iframes > 0 || this.state === 'ult' || this.state === 'awaken' || this.state === 'victory') return 'iframe';
    const dmgBase = raw * mod / (1 + this.stats.def / 120);
    // guard
    if (this.state === 'guard' && !o.unblock && o.kind !== 'env') {
      const a = Math.atan2(o.x - this.pos.x, o.z - this.pos.z);
      if (Math.abs(wrap(a - this.yaw)) < (o.proj ? 2.2 : 1.8)) {
        const win = (g.touch ? 0.32 : 0.24) + (this.awakened ? 0.04 : 0);
        const mx = this.pos.x + Math.sin(this.yaw) * 1.1, mz = this.pos.z + Math.cos(this.yaw) * 1.1;
        if (this.guardT <= win) {
          // PERFECT
          g.hitstop(0.13); g.slowmo(0.35, 0.28); g.shake(0.55); g.flash('#fff', 0.35);
          g.fx.burst(mx, 1.3, mz, 0xffffff, 40, 12, 0.5, 0.22, 3); g.fx.burst(mx, 1.3, mz, this.W.glow, 24, 9, 0.7, 0.3, 2); g.fx.ring(mx, 1.2, mz, 0xffffff, 3.6, 0.35); g.fx.blast(mx, 1.3, mz, 0xffffff, 1.4, 0.18, 0.8);
          g.fx.slash(this.pos.x, 1.2, this.pos.z, this.yaw, 0.0, 2.6, 5, 0xfff2b0, 0.25, 0.9);
          sfx('perfect'); g.addScore(150, 'PERFECT DEFLECT'); g.callout('PERFECT DEFLECT!', '#ffe27a');
          this.perfects++; bumpStat('perfect'); bumpStat('parries'); this.addUlt(10); this.awk = clamp(this.awk + (this.awakened ? 0 : 6), 0, 100); this.sta = Math.min(this.maxSta, this.sta + 25); this.heal(this.maxHp * 0.03);
          this.guardT = 0; this.counterT = 1.4; this.counterTarget = o.e || null; this.bumpCombo(); g.trainStat('perfect');
          if (o.e) o.e.onParried(g, true);
          return 'perfect';
        }
        const eff = GUARD_EFF[this.stats.family] ?? 0.2, cost = 16;
        sfx('block'); g.fx.burst(mx, 1.2, mz, 0xffddaa, 14, 8, 0.4, 0.18, 4); g.shake(0.18); g.hitstop(0.04); bumpStat('parries');
        if (this.sta < cost) { this.sta = 0; this.guardCd = 1; this.state = 'hurt'; this.st = 0; this.hurtT = 0.5; this.iframes = 0.5; this.applyDamage(dmgBase * 0.7); g.callout('GUARD BROKEN', '#f66'); this.knock(o.x, o.z, 7); return 'hit'; }
        this.sta -= cost; this.staDelay = 0.6; this.applyDamage(dmgBase * eff, true); this.iframes = 0.15; this.knock(o.x, o.z, 3.5);
        g.fx.num(new THREE.Vector3(this.pos.x, 2.2, this.pos.z), 'DEFLECT', '#9cf', 0.9);
        if (o.e) o.e.onParried(g, false);
        return 'deflect';
      }
    }
    if (this.barrier > 0) { const ab = Math.min(this.barrier, dmgBase); this.barrier -= ab; sfx('block'); g.fx.burst(this.pos.x, 1.2, this.pos.z, 0x66ccff, 12, 6, 0.4, 0.2, 2); if (ab >= dmgBase) { this.iframes = 0.25; return 'barrier'; } this.applyDamage(dmgBase - ab); }
    else this.applyDamage(dmgBase);
    if ((this.state as PState) === 'dead') return 'hit';
    // hit reaction
    sfx('hurt'); g.shake(0.45); g.flash('#f22', 0.4); g.hitstop(0.05);
    g.fx.burst(this.pos.x, 1.2, this.pos.z, 0xff4040, 16, 7, 0.5, 0.2, 8);
    this.iframes = 0.7; this.combo = 0; this.comboT = 0; this.buffer = 0; this.chargeT = 0;
    if (this.state !== 'cast' || !this.chans.length) { this.state = 'hurt'; this.st = 0; this.hurtT = 0.32; this.atk = null; }
    if (!o.noKnock) this.knock(o.x, o.z, 6);
    return 'hit';
  }
  private applyDamage(d: number, quiet = false) {
    d = Math.max(1, Math.round(d)); this.hp -= d; this.damageTaken += d; this.addUlt(2);
    if (!quiet) this.g.fx.num(new THREE.Vector3(this.pos.x, 2.4, this.pos.z), String(d), '#ff5a5a', 1.2);
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  private knock(sx: number, sz: number, f: number) { const a = Math.atan2(this.pos.x - sx, this.pos.z - sz); this.vx = Math.sin(a) * f; this.vz = Math.cos(a) * f; }
  die() { if (this.state === 'dead') return; this.state = 'dead'; this.st = 0; this.deathT = 0; this.g.slowmo(0.25, 1.2); this.g.fx.burst(this.pos.x, 1, this.pos.z, 0xff4040, 40, 9, 0.9, 0.3); sfx('death'); this.g.onPlayerDeath(); }
  envHurt(frac: number) { if (this.state === 'dead' || this.iframes > 0 || this.state === 'ult' || this.state === 'awaken' || this.state === 'dodge' && this.st < 0.25) return; const raw = this.maxHp * frac; this.applyDamage(raw); sfx('hurt'); this.g.shake(0.3); this.g.flash('#f62', 0.3); this.iframes = 0.4; }
  bumpCombo() { this.combo++; this.comboT = 2.4; if (this.combo > this.maxCombo) this.maxCombo = this.combo; bumpStat('maxCombo', this.combo, true); }

  // ---------- main update ----------
  update(dt: number, t: number) {
    const g = this.g, inp = g.input;
    if (useStore.getState().rev !== this.rev) this.refresh();
    this.iframes -= dt; this.guardCd -= dt; this.counterT -= dt; this.dodgeBuf -= dt; this.swapCd -= dt; this.landT -= dt; this.buffer -= dt; this.comboWin -= dt; this.staDelay -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    for (const k in this.cds) if (this.cds[k] > 0) this.cds[k] -= dt;
    if (this.barrierT > 0) { this.barrierT -= dt; if (this.barrierT <= 0) this.barrier = 0; }
    this.shield.visible = this.barrier > 0; if (this.shield.visible) { this.shield.rotation.y += dt; (this.shield.scale as THREE.Vector3).setScalar(1 + Math.sin(t * 6) * 0.02); }
    if (this.invisT > 0) { this.invisT -= dt; if (this.invisT <= 0) { this.rig.root.visible = true; if (this.ghost) this.ghost.root.visible = false; g.fx.burst(this.pos.x, 1, this.pos.z, 0x9966ff, 20, 5, 0.5); } }
    if (this.awakenT > 0 && this.state !== 'awaken') { this.awakenT -= dt; this.awk = clamp(this.awk, 0, 100); if (this.awakenT <= 0) this.endAwaken(); if (this.awakened && (t * 12) % 1 < 0.3) g.fx.emit(this.pos.x + (Math.random() - 0.5), 0.3, this.pos.z + (Math.random() - 0.5), 0, 2.5 + Math.random(), 0, 0xffd860, 0.9, 0.25); }
    if (this.state === 'dead') { this.deathT += dt; this.animate(dt, t); return; }
    if (this.state === 'victory') { this.victoryT += dt; this.applyMove(dt, 0, 0, 0); this.animate(dt, t); return; }
    // regen
    if (this.staDelay <= 0 && this.state !== 'guard') this.sta = Math.min(this.maxSta, this.sta + 30 * dt);
    this.mp = Math.min(this.maxMp, this.mp + (2 + this.maxMp * 0.012) * dt);
    // channels
    for (let i = this.chans.length - 1; i >= 0; i--) { const c = this.chans[i]; c.t += dt; c.fn(dt, c); if (c.t >= c.dur) { c.done?.(); this.chans.splice(i, 1); } }
    // clones
    this.updateClones(dt, t);
    // input
    const mv = inp.moveVec(); const mag = Math.min(1, Math.hypot(mv[0], mv[1]));
    const sy = Math.sin(g.camYaw), cy = Math.cos(g.camYaw);
    let wx = sy * mv[1] - cy * mv[0], wz = cy * mv[1] + sy * mv[0]; const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const inDungeon = g.scene3 === 'floor';
    // lock
    if (inp.pressed.lock && inDungeon) { if (this.lock) this.lock = null; else this.lock = g.nearestEnemy(this.pos.x, this.pos.z, 28, this.yaw); if (this.lock) sfx('click'); }
    if (this.lock && (this.lock.dead || Math.hypot(this.lock.x - this.pos.x, this.lock.z - this.pos.z) > 34)) this.lock = g.nearestEnemy(this.pos.x, this.pos.z, 28, this.yaw);
    if (inp.pressed.swap && this.swapCd <= 0 && (this.state === 'free' || this.state === 'guard')) { swapWeapons(); this.swapCd = 0.6; this.refresh(); this.rebuild(); sfx('click'); g.fx.burst(this.pos.x, 1.4, this.pos.z, this.W.glow, 18, 4, 0.5); g.callout(this.W.name, '#fff'); }
    const canAct = this.state === 'free' || this.state === 'guard';
    if (inDungeon) {
      // skills
      if (!g.noSkills && (this.state === 'free' || this.state === 'guard' || (this.state === 'atk' && this.progress() > 0.5))) {
        const sl = useStore.getState().save.slots;
        if (inp.pressed.skillA) this.tryCast(sl[this.selected]); else if (inp.pressed.skillB) this.tryCast(sl[(this.selected + 1) % 4]);
      }
      if (inp.select >= 0 && inp.select < 4) { this.selected = inp.select; sfx('click'); } inp.select = -1;
      if (inp.pressed.ult && (canAct || this.state === 'atk') && this.ult >= 100) this.startUlt();
      if (inp.pressed.awaken && (canAct || this.state === 'atk') && this.awk >= 100 && !this.awakened) this.startAwaken();
    }
    // jump
    if (inp.pressed.jump && this.grounded && (canAct || (this.state === 'atk' && this.progress() > 0.6))) { this.vy = 9.8; this.grounded = false; sfx('jump', 0.5); if (this.state === 'atk') { this.state = 'free'; this.atk = null; } g.fx.burst(this.pos.x, 0.1, this.pos.z, 0xcccccc, 6, 3, 0.4, 0.15, 2); }
    // dodge
    if (inp.pressed.dodge && this.sta >= 14 && (canAct || this.state === 'atk' && this.progress() >= (this.atk?.hits[0] ?? 0.5) || this.state === 'hurt' && this.st > 0.12 || this.state === 'charge')) this.startDodge(wx, wz, wl);
    switch (this.state) {
      case 'free': case 'guard': case 'charge': this.freeUpdate(dt, mv, mag, wx, wz, wl, canAct); break;
      case 'atk': this.atkUpdate(dt, wx, wz, wl); break;
      case 'dodge': this.st += dt; { const k = Math.max(0, 1 - this.st / this.dodgeDur); const sp = 15 * (0.35 + k * 0.65); this.vx = this.dodgeVx * sp; this.vz = this.dodgeVz * sp; if ((t * 40) % 1 < 0.5) g.fx.emit(this.pos.x, 0.8, this.pos.z, 0, 0.5, 0, 0x99ccff, 0.35, 0.5); if (this.st >= this.dodgeDur) { this.state = 'free'; this.dodgeBuf = 0.3; this.vx *= 0.3; this.vz *= 0.3; } } this.applyMove(dt, 0, 0, 0, true); break;
      case 'cast': this.castUpdate(dt); this.applyMove(dt, 0, 0, 0); break;
      case 'hurt': this.st += dt; this.vx *= 0.9; this.vz *= 0.9; if (this.st >= this.hurtT) this.state = 'free'; this.applyMove(dt, 0, 0, 0, true); break;
      case 'ult': this.ultUpdate(dt); break;
      case 'awaken': this.st += dt; this.vy = 0; this.applyMove(dt, 0, 0, 0); this.updateAwaken(dt); break;
    }
    // trail
    if (this.rig.weapon) {
      const sw = this.state === 'atk' && this.atk ? (this.progress() > 0.12 && this.progress() < 0.95) : this.state === 'ult' || (this.state === 'dodge' && this.atkKind === 'dodgeAtk');
      this.rig.weapon.userData.tip.getWorldPosition(this.tipV); this.rig.weapon.userData.base.getWorldPosition(this.baseV); this.trail.push(this.tipV, this.baseV, sw && this.invisT <= 0, dt);
    }
    this.animate(dt, t);
  }
  progress() { return this.atk ? this.st / (this.atk.dur / this.aspd) : 0; }

  private applyMove(dt: number, tx: number, tz: number, accel: number, keepVel = false) {
    const g = this.g;
    if (!keepVel && accel > 0) { const k = this.grounded ? (this.slipping ? 2 : accel) : accel * 0.35; this.vx = damp(this.vx, tx, k, dt); this.vz = damp(this.vz, tz, k, dt); }
    else if (!keepVel) { this.vx = damp(this.vx, 0, 14, dt); this.vz = damp(this.vz, 0, 14, dt); }
    this.slipping = false;
    let nx = this.pos.x + (this.vx + this.pushX) * dt, nz = this.pos.z + (this.vz + this.pushZ) * dt; this.pushX = this.pushZ = 0;
    [nx, nz] = g.collide(nx, nz, 0.45); this.pos.x = nx; this.pos.z = nz;
    if (!this.grounded || this.vy > 0) { this.vy -= (this.state === 'atk' && this.airAtk && this.vy < 2 ? 8 : 26) * dt; this.pos.y += this.vy * dt; if (this.pos.y <= 0) { this.pos.y = 0; if (!this.grounded && this.vy < -6) { this.landT = 0.18; sfx('land', 0.6); g.fx.burst(this.pos.x, 0.1, this.pos.z, 0xcccccc, 8, 4, 0.4, 0.2, 2); if (this.atkKind === 'dive') this.diveLand(); } this.vy = 0; this.grounded = true; if (this.atkKind === 'dive') this.atkKind = ''; } }
  }
  private freeUpdate(dt: number, mv: number[], mag: number, wx: number, wz: number, wl: number, canAct: boolean) {
    const g = this.g, inp = g.input; this.st += dt;
    const guarding = this.state === 'guard';
    // guard handling
    if (inp.pressed.guard && canAct && this.guardCd <= 0 && this.sta >= 4 && this.state !== 'charge') {
      this.state = 'guard'; this.guardT = 0; this.sta -= 4; this.staDelay = 0.5; const tgt = g.threat(this.pos.x, this.pos.z);
      if (tgt) this.yaw = Math.atan2(tgt.x - this.pos.x, tgt.z - this.pos.z); else if (!this.lock) this.yaw = g.camYaw;
      sfx('click', 0.3);
    }
    if (this.state === 'guard') { this.guardT += dt; if (!inp.down.guard) { this.state = 'free'; this.guardCd = 0.22; this.guardT = 99; } }
    const sprinting = inp.down.sprint && mag > 0.1 && this.sta > 1 && this.state === 'free' && !this.lock;
    const autoSprint = g.touch && mag > 0.93 && this.state === 'free' && this.sta > 1;
    const sp = (guarding || this.state === 'guard') ? 3.2 : this.state === 'charge' ? 2.8 : (sprinting || autoSprint) ? 10.5 : mag < 0.45 ? 3.6 : 7.4;
    if ((sprinting || autoSprint) && this.grounded && mag > 0.1) { this.sta -= 11 * dt; this.staDelay = 0.5; if ((g.time * 14) % 1 < 0.3) g.fx.emit(this.pos.x, 0.1, this.pos.z, 0, 0.6, 0, 0xcccccc, 0.4, 0.25); }
    this.applyMove(dt, wx * sp * (wl > 0 ? 1 : 0), wz * sp * (wl > 0 ? 1 : 0), 16);
    // facing
    if (this.lock && !sprinting) this.yaw = dampAngle(this.yaw, Math.atan2(this.lock.x - this.pos.x, this.lock.z - this.pos.z), 14, dt);
    else if (this.state === 'guard') { /* hold facing */ if (wl > 0 && !this.lock) this.yaw = dampAngle(this.yaw, g.camYaw, 8, dt); }
    else if (wl > 0) this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), 16, dt);
    this.walkPh += dt * Math.hypot(this.vx, this.vz) * 1.55;
    // heavy attack charge
    if (inp.pressed.heavy && canAct && this.state !== 'guard') {
      if (!this.grounded) { this.startDive(); return; }
      if (this.sta >= 10) { this.state = 'charge'; this.chargeT = 0; this.st = 0; this.aim(8); }
    }
    if (this.state === 'charge') {
      this.chargeT += dt; if (this.chargeT > 0.25 && (g.time * 20) % 1 < 0.4) g.fx.emit(this.pos.x + (Math.random() - 0.5) * 1.5, 0.3 + Math.random(), this.pos.z + (Math.random() - 0.5) * 1.5, 0, 0.5, 0, this.W.glow, 0.5, 0.18);
      if (!inp.down.heavy || this.chargeT >= 1.3) { const c = clamp((this.chargeT - 0.3) / 0.8, 0, 1); this.sta -= 10; this.staDelay = 0.7; this.startAttack(this.W.heavy, 'heavy', 1 + c * 1.1, false, c); }
    }
    // light attack
    if (inp.pressed.attack || (this.buffer > 0 && canAct)) {
      if (this.state === 'free' || this.state === 'guard') {
        this.buffer = 0;
        if (this.counterT > 0) this.startCounter();
        else if (!this.grounded) this.startAirAttack();
        else if (this.dodgeBuf > 0) { this.dodgeBuf = 0; this.startAttack({ ...this.W.combo[0], dmg: this.W.combo[0].dmg * 1.4, lunge: this.W.combo[0].lunge * 2.2, range: this.W.combo[0].range + 0.6 }, 'dodgeAtk', 1, true); g.callout('DODGE ATTACK', '#9ff'); }
        else { const i = this.comboWin > 0 ? this.nextIdx : 0; this.startAttack(this.W.combo[i % this.W.combo.length], 'light', 1, false, 0, i % this.W.combo.length); }
      }
    }
    void mv;
  }
  private aim(maxD: number) {
    const g = this.g; let tgt: Enemy | null = this.lock;
    if (!tgt) { const mv = g.input.moveVec(); const sy = Math.sin(g.camYaw), cy = Math.cos(g.camYaw); const wx = sy * mv[1] - cy * mv[0], wz = cy * mv[1] + sy * mv[0]; const ref = Math.hypot(wx, wz) > 0.1 ? Math.atan2(wx, wz) : this.yaw; tgt = g.nearestEnemy(this.pos.x, this.pos.z, maxD, ref, 1.5); if (!tgt && g.touch) tgt = g.nearestEnemy(this.pos.x, this.pos.z, maxD, this.yaw, 3.2); }
    if (tgt) this.yaw = Math.atan2(tgt.x - this.pos.x, tgt.z - this.pos.z);
    else { const mv = g.input.moveVec(); if (Math.hypot(mv[0], mv[1]) > 0.2) { const sy = Math.sin(g.camYaw), cy = Math.cos(g.camYaw); this.yaw = Math.atan2(sy * mv[1] - cy * mv[0], cy * mv[1] + sy * mv[0]); } }
  }
  startAttack(def: AtkDef, kind: string, mul = 1, dodgeAtk = false, charge = 0, idx = 0) {
    this.state = 'atk'; this.st = 0; this.atk = def; this.atkKind = kind; this.atkMul = mul; this.atkHit = 0; this.atkIdx = idx; this.airAtk = false; this.counterAtk = false; this.buffer = 0; this.chargeT = charge;
    this.aim(7.5); if (kind !== 'heavy') this.sta = Math.max(0, this.sta - 0); this.guardT = 99;
    sfx(kind === 'heavy' || def.dur > 0.8 ? 'swingheavy' : 'swing', 0.8, 0.9 + (this.aspd - 1) * 0.3); void dodgeAtk;
    const d = def.dur / this.aspd; const sp = def.lunge / (d * 0.38); this.vx = Math.sin(this.yaw) * sp; this.vz = Math.cos(this.yaw) * sp;
    // lunge toward target but don't overshoot
    const tgt = this.lock || this.g.nearestEnemy(this.pos.x, this.pos.z, 6, this.yaw, 1.2);
    if (tgt) { const dd = Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z) - tgt.radius - 0.6; if (dd < def.lunge) { const s2 = Math.max(0, dd) / (d * 0.38); this.vx = Math.sin(this.yaw) * s2; this.vz = Math.cos(this.yaw) * s2; } }
  }
  startAirAttack() {
    const def: AtkDef = { dur: 0.42, hits: [0.45], range: 3.4, arc: 3, dmg: 1.2, knock: 2, lunge: 0, pose: this.W.combo[0].pose === 'T' ? 'T' : 'X', launch: false };
    this.startAttack(def, 'air', 1); this.airAtk = true; this.vy = Math.max(this.vy, 2.5); this.vx *= 0.3; this.vz *= 0.3;
  }
  startDive() {
    this.state = 'atk'; this.st = 0; this.atk = { dur: 0.7, hits: [], range: 5, arc: 7, dmg: 2.4, knock: 8, lunge: 0, pose: 'O', slam: true }; this.atkKind = 'dive'; this.atkHit = 0; this.vy = -22; this.vx = 0; this.vz = 0; this.sta -= 8; sfx('swingheavy'); this.airAtk = false;
  }
  diveLand() {
    const g = this.g, r = 5.5; const { d, crit } = this.roll(2.6 * this.atkMul);
    g.fx.ring(this.pos.x, 0.1, this.pos.z, this.W.glow, r, 0.5); g.fx.ring(this.pos.x, 0.1, this.pos.z, 0xffffff, r * 0.6, 0.35); g.fx.burst(this.pos.x, 0.3, this.pos.z, 0xccbb99, 30, 9, 0.6, 0.3, 10);
    g.shake(0.6); sfx('heavy'); g.hitstop(0.07);
    g.aoe(this.pos.x, this.pos.z, r, d, { knock: 9, down: true, heavy: true, crit, stagger: 2, kind: 'melee' }); this.atkKind = ''; this.state = 'free'; this.atk = null; g.callout('GROUND FINISHER', '#ffcc88');
  }
  startCounter() {
    const g = this.g; const c = this.W.counter; let tgt = this.counterTarget && !this.counterTarget.dead ? this.counterTarget : g.nearestEnemy(this.pos.x, this.pos.z, 12, this.yaw, 6.3);
    this.counterT = 0; this.startAttack(c, 'counter', 1, false); this.counterAtk = true; this.iframes = Math.max(this.iframes, c.dur / this.aspd + 0.1); g.callout(this.W.counterName.toUpperCase(), '#ffd860');
    if (tgt) { const a = Math.atan2(tgt.x - this.pos.x, tgt.z - this.pos.z), d = Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z), stop = tgt.radius + 1.5;
      if (d > stop) { const mv = d - stop; g.fx.burst(this.pos.x, 1, this.pos.z, this.W.glow, 14, 4, 0.5); for (let i = 0; i < 8; i++) g.fx.emit(this.pos.x + Math.sin(a) * mv * i / 8, 1 + Math.random() * 0.4, this.pos.z + Math.cos(a) * mv * i / 8, 0, 0.5, 0, this.W.glow, 0.5, 0.4); const [nx, nz] = g.collide(this.pos.x + Math.sin(a) * mv, this.pos.z + Math.cos(a) * mv, 0.45); this.pos.x = nx; this.pos.z = nz; sfx('teleport', 0.6); }
      this.yaw = a; this.vx = this.vz = 0; }
  }
  private atkUpdate(dt: number, wx: number, wz: number, wl: number) {
    const g = this.g, def = this.atk!, inp = g.input; this.st += dt; const dur = def.dur / this.aspd, p = this.st / dur;
    if (this.atkKind === 'dive') { this.applyMove(dt, 0, 0, 0, true); if (this.grounded) { this.state = 'free'; this.atk = null; } return; }
    // hit windows
    while (this.atkHit < def.hits.length && p >= def.hits[this.atkHit]) this.hitFrame(def, this.atkHit++);
    // slight steering during windup
    if (p < 0.3 && wl > 0 && !this.lock) this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), 6, dt);
    if (p > 0.38) { this.vx = damp(this.vx, 0, 16, dt); this.vz = damp(this.vz, 0, 16, dt); }
    this.applyMove(dt, 0, 0, 0, true);
    if (inp.pressed.attack) this.buffer = 0.3;
    if (inp.pressed.guard && p >= (def.hits[0] ?? 0.5) && this.guardCd <= 0 && this.sta >= 4) { this.state = 'free'; this.atk = null; this.nextIdx = 0; this.comboWin = 0; return; }
    if (p >= (this.buffer > 0 ? 0.78 : 1)) {
      const next = (this.atkIdx + 1);
      const chain = this.atkKind === 'light' && this.W.combo.length > 0;
      this.state = 'free'; this.atk = null;
      if (this.atkKind === 'light') { this.nextIdx = next % this.W.combo.length; this.comboWin = 0.5; }
      else if (this.atkKind === 'counter' || this.atkKind === 'heavy') { this.nextIdx = 0; this.comboWin = 0.35; }
      if (this.buffer > 0 && chain && this.grounded) { this.buffer = 0; const i = this.nextIdx; this.startAttack(this.W.combo[i], 'light', 1, false, 0, i); }
      this.airAtk = false;
    }
  }
  private hitFrame(def: AtkDef, _i: number) {
    const g = this.g, yaw = this.yaw, px = this.pos.x, pz = this.pos.z, W = this.W;
    const col = this.awakened ? 0xffe070 : W.glow, counter = this.counterAtk, heavy = this.atkKind === 'heavy';
    const pose = def.pose, y = this.pos.y + 1.15, r = def.range;
    // VFX
    const sl = (tilt: number, sc = 1) => g.fx.slash(px, y, pz, yaw, tilt, r * 0.95 * sc, Math.min(def.arc, 6.4), col, 0.2 + def.dur * 0.1);
    if (!def.proj) {
      if (pose === 'R') sl(-0.35); else if (pose === 'L') sl(0.35); else if (pose === 'O') sl(Math.PI / 2 - 0.2); else if (pose === 'U') sl(-Math.PI / 2 + 0.25);
      else if (pose === 'X') { sl(0.8); sl(-0.8); } else if (pose === 'S') g.fx.slash(px, y, pz, yaw, 0, r * 0.95, 7, col, 0.28); else if (pose === 'T') g.fx.streak(px, y, pz, yaw, r, 0.28, col, 0.22);
      else if (pose === 'C') { g.fx.ring(px + Math.sin(yaw) * 1.5, 0.2, pz + Math.cos(yaw) * 1.5, col, r * 0.7, 0.35); g.fx.blast(px + Math.sin(yaw) * 2, 1.2, pz + Math.cos(yaw) * 2, col, 1.6, 0.25); }
    }
    if (counter) { g.fx.slash(px, y, pz, yaw, 0.4, r, 5, 0xffffff, 0.3, 1); g.fx.burst(px, 1.3, pz, 0xffe27a, 30, 12, 0.5, 0.25); g.slowmo(0.3, 0.3); }
    if (this.atkKind === 'dodgeAtk') g.fx.streak(px, y, pz, yaw, r * 1.2, 0.3, 0x99ffff, 0.25);
    // projectile attacks (staff)
    if (def.proj) {
      const { d, crit } = this.roll(def.dmg * this.atkMul); const sp = 26;
      g.spawnProj({ x: px + Math.sin(yaw) * 1.1, y: 1.3, z: pz + Math.cos(yaw) * 1.1, vx: Math.sin(yaw) * sp, vz: Math.cos(yaw) * sp, dmg: d, r: 0.7, life: r / sp, owner: 'p', color: col, shape: 'orb', size: 0.35, crit, knock: def.knock, aoe: 1.6 });
      sfx('magic', 0.5, 1.4); g.fx.burst(px + Math.sin(yaw) * 1.1, 1.3, pz + Math.cos(yaw) * 1.1, col, 8, 4, 0.3, 0.2); return;
    }
    // hit detection
    let hit = 0; const half = def.arc / 2;
    for (const e of g.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz);
      if (d > r + e.radius) continue;
      if (def.arc < 6) { const diff = Math.abs(wrap(Math.atan2(dx, dz) - yaw)); if (diff > half + Math.atan2(e.radius, Math.max(0.5, d))) continue; }
      if (Math.abs(this.pos.y - e.y) > 3.2 && !e.air) continue;
      let mul = def.dmg * this.atkMul; if (this.atkKind === 'dodgeAtk') mul *= 1;
      if (W.name === 'Daggers' && Math.abs(wrap(Math.atan2(-dx, -dz) - e.yaw)) > 2.2) mul *= 1.5;
      if (this.invisT > 0 || this.nextCrit) { mul *= 1.8; }
      const { d: dmg, crit } = this.roll(mul, counter);
      const kill = e.hit(g, dmg, { dx: dx / (d || 1), dz: dz / (d || 1), knock: def.knock * (heavy ? 1.2 : 1), launch: def.launch || (this.airAtk && false), stagger: def.stagger ?? 0, heavy: heavy || counter || !!def.slam, crit, air: this.airAtk, guardBreak: heavy || !!def.slam || counter, down: !!def.slam });
      hit++; this.onHitFeedback(e, crit, heavy || counter, kill);
    }
    if (def.slam) { g.fx.ring(px + Math.sin(yaw) * 2.5, 0.1, pz + Math.cos(yaw) * 2.5, col, r, 0.45); g.fx.burst(px + Math.sin(yaw) * 2.5, 0.3, pz + Math.cos(yaw) * 2.5, 0xccbb99, 24, 8, 0.6, 0.3, 10); g.shake(0.4); sfx('heavy'); }
    if (hit === 0) { if (this.atkKind === 'heavy') g.shake(0.1); } else { if (this.invisT > 0) { this.invisT = 0; this.rig.root.visible = true; if (this.ghost) this.ghost.root.visible = false; } this.nextCrit = false; }
    if (heavy) g.shake(0.25); if (this.awakened && hit > 0) g.fx.ring(px, 0.3, pz, 0xffd860, r * 0.9, 0.3, 0.5, 0.5);
  }
  onHitFeedback(e: Enemy, crit: boolean, heavy: boolean, kill: boolean) {
    const g = this.g; this.bumpCombo(); this.addUlt(heavy ? 5 : 2.4);
    g.hitstop(kill ? 0.09 : heavy ? 0.075 : crit ? 0.06 : 0.04); g.shake(heavy ? 0.4 : crit ? 0.25 : 0.12);
    sfx(heavy ? 'heavy' : crit ? 'crit' : 'hit', 0.9); g.addScore(10 + this.combo, '');
    if (this.stats.family) { /* mastery tracked on kill */ }
    void e;
  }
  startDodge(wx: number, wz: number, wl: number) {
    const g = this.g; this.sta -= 18; this.staDelay = 0.6; this.state = 'dodge'; this.st = 0; this.atk = null; this.iframes = 0; this.buffer = 0; this.atkKind = ''; this.chargeT = 0;
    if (wl > 0) { this.dodgeVx = wx; this.dodgeVz = wz; this.yaw = this.lock ? this.yaw : Math.atan2(wx, wz); } else { this.dodgeVx = -Math.sin(this.yaw); this.dodgeVz = -Math.cos(this.yaw); }
    this.dodgeDur = 0.34; sfx('dodge', 0.8); g.fx.burst(this.pos.x, 0.5, this.pos.z, 0x99ccff, 12, 5, 0.4, 0.3, 0); g.fov(6); bumpStat('dodges');
    if (this.guardT < 99) this.guardT = 99;
  }

  // ---------- skills ----------
  tryCast(id: string) {
    const g = this.g; if (!id) return; const def = SKILL_BY_ID[id], lv = useStore.getState().save.skills[id] || 0; if (!def || lv < 1) return;
    if (this.state === 'atk') { this.atk = null; this.state = 'free'; }
    const sc = skillScale(def, lv);
    if ((this.cds[id] || 0) > 0) { return; }
    if (this.mp < sc.mana) { g.callout('NOT ENOUGH MANA', '#7af'); sfx('wrong', 0.4); return; }
    this.mp -= sc.mana; this.cds[id] = sc.cd; this.state = 'cast'; this.castDef = def; this.castLv = lv; this.castT = 0; this.castFired = false; this.atk = null; this.guardT = 99;
    bumpStat('skills'); this.aim(14);
    sfx(def.cat === 'physical' ? 'swingheavy' : def.cat === 'elemental' ? (id === 'fireball' ? 'fire' : id === 'lance' ? 'ice' : id === 'lightning' ? 'lightning' : 'magic') : def.cat === 'shadow' ? 'shadow' : 'magic', 0.8);
    g.fx.ring(this.pos.x, 0.1, this.pos.z, def.color, 3, 0.4); g.fx.burst(this.pos.x, 1, this.pos.z, def.color, 14, 4, 0.5, 0.2);
    g.callout(def.name.toUpperCase(), '#' + def.color.toString(16).padStart(6, '0'));
  }
  private castUpdate(dt: number) {
    const def = this.castDef!; this.castT += dt;
    if (!this.castFired && this.castT >= def.cast) { this.castFired = true; this.fireSkill(def, this.castLv); }
    const busy = this.chans.some((c) => (c as Chan & { hold?: boolean }).hold);
    if (this.castFired && this.castT >= def.cast + 0.2 && !busy) { this.state = 'free'; this.castDef = null; }
  }
  private fireSkill(def: SkillDef, lv: number) {
    const g = this.g, sc = skillScale(def, lv), px = this.pos.x, pz = this.pos.z, yaw = this.yaw, fx = g.fx, col = def.color;
    const fwd = (d: number): [number, number] => [px + Math.sin(yaw) * d, pz + Math.cos(yaw) * d];
    const r1 = this.roll(sc.dmg); const dmg = r1.d, crit = r1.crit;
    const hold = (dur: number, fn: (dt: number, c: Chan) => void, done?: () => void) => { const c: Chan & { hold?: boolean } = { t: 0, dur, fn, done, hold: true }; this.chans.push(c); };
    const nearest = () => g.nearestEnemy(px, pz, sc.range + 4, yaw, 6.3);
    const o = { kind: 'skill' as const, crit };
    switch (def.id) {
      case 'wave': { const n = 1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0); for (let i = 0; i < n; i++) { const a = yaw + (i - (n - 1) / 2) * 0.3; g.spawnProj({ x: px + Math.sin(a), y: 1.1, z: pz + Math.cos(a), vx: Math.sin(a) * 22, vz: Math.cos(a) * 22, dmg: this.roll(sc.dmg).d, r: 1.6, life: sc.range / 22, owner: 'p', color: col, shape: 'slash', pierce: true, size: 1, knock: 4, yaw: a }); } break; }
      case 'crush': { const [x, z] = fwd(2.2); fx.ring(x, 0.1, z, col, sc.range, 0.5); fx.ring(x, 0.1, z, 0xffffff, sc.range * 0.6, 0.35); fx.burst(x, 0.3, z, 0xccaa88, 36, 10, 0.7, 0.35, 12); fx.pillar(x, 0, z, col, 1.2, 3, 0.3); g.shake(0.7); sfx('quake', 0.7); g.hitstop(0.08); g.aoe(x, z, sc.range, dmg, { ...o, knock: 8, down: true, stagger: 2, heavy: true }); break; }
      case 'rend': { const [x, z] = fwd(2); fx.slash(px, 1.2, pz, yaw, -Math.PI / 2 + 0.2, sc.range, 3, col, 0.3); fx.pillar(x, 0, z, col, 1.4, 6, 0.4); fx.burst(x, 0.3, z, col, 24, 8, 0.6, 0.25, 4); g.aoe(px, pz, sc.range, dmg, { ...o, knock: 2, launch: true, stagger: 1, cone: [yaw, 2.4], launchPow: 8 + lv }); this.vy = 8.5 + lv * 0.4; this.grounded = false; g.shake(0.4); g.hitstop(0.06); break; }
      case 'flurry': { const n = 6 + (lv >= 3 ? 2 : 0) + (lv >= 5 ? 2 : 0); let k = 0; hold(0.95, (_dt, c) => { while (k < n && c.t >= (k / n) * 0.9) { k++; fx.slash(this.pos.x, 1.1, this.pos.z, Math.random() * TAU, (Math.random() - 0.5) * 1.6, sc.range, 3.2, col, 0.18); sfx('hit', 0.4, 1.3); g.aoe(this.pos.x, this.pos.z, sc.range, this.roll(sc.dmg).d, { kind: 'skill', knock: 2, crit: false }); g.shake(0.15); } this.rig.root.rotation.y += 0; this.yaw += _dt * 14; }); break; }
      case 'rush': { const dist = 9 + lv * 1.2, sp = 42, dur = dist / sp, hitSet = new Set<Enemy>(); this.iframes = Math.max(this.iframes, dur + 0.15); hold(dur + 0.05, (_dt, c) => { if (c.t < dur) { this.vx = Math.sin(yaw) * sp; this.vz = Math.cos(yaw) * sp; fx.emit(this.pos.x, 1, this.pos.z, 0, 0, 0, col, 0.4, 0.5); for (const e of g.enemies) if (!e.dead && !hitSet.has(e) && Math.hypot(e.x - this.pos.x, e.z - this.pos.z) < e.radius + 1.8) { hitSet.add(e); const k = e.hit(g, this.roll(sc.dmg).d, { dx: Math.sin(yaw), dz: Math.cos(yaw), knock: 6, stagger: 1, heavy: true, crit: false }); this.onHitFeedback(e, false, true, k); } } else { this.vx = this.vz = 0; } this.applyMove(_dt, 0, 0, 0, true); }); fx.streak(px, 1.1, pz, yaw, dist, 0.6, col, 0.3); break; }
      case 'fireball': { const n = 1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0); for (let i = 0; i < n; i++) { const a = yaw + (i - (n - 1) / 2) * 0.22; g.spawnProj({ x: px + Math.sin(a), y: 1.3, z: pz + Math.cos(a), vx: Math.sin(a) * 19, vz: Math.cos(a) * 19, dmg: this.roll(sc.dmg).d, r: 0.8, life: sc.range / 19, owner: 'p', color: col, shape: 'orb', size: 0.55, aoe: 3.4, knock: 6, launch: false, trail: 0xffcc44 }); } break; }
      case 'lance': { const n = 1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0); for (let i = 0; i < n; i++) { const a = yaw + (i - (n - 1) / 2) * 0.2; g.spawnProj({ x: px + Math.sin(a), y: 1.3, z: pz + Math.cos(a), vx: Math.sin(a) * 34, vz: Math.cos(a) * 34, dmg: this.roll(sc.dmg).d, r: 0.7, life: sc.range / 34, owner: 'p', color: col, shape: 'lance', pierce: true, size: 0.3, slow: 3, knock: 3, yaw: a }); } break; }
      case 'lightning': { const n = 3 + lv; const list = g.enemies.filter((e) => !e.dead && Math.hypot(e.x - px, e.z - pz) < sc.range + 6).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)); for (let i = 0; i < n; i++) { const e = list[i % Math.max(1, list.length)]; const tx = e ? e.x + (list.length < n ? (Math.random() - 0.5) * 2 : 0) : px + Math.sin(yaw) * (4 + i * 2.5) + (Math.random() - 0.5) * 4, tz = e ? e.z : pz + Math.cos(yaw) * (4 + i * 2.5) + (Math.random() - 0.5) * 4; const tl = fx.tele('circle', tx, tz, 0, 2.4, 0, 0xffee66, 0.4 + i * 0.1); void tl; g.later(0.4 + i * 0.1, () => { fx.pillar(tx, 0, tz, 0xffee66, 0.5, 30, 0.3, 0.9); fx.pillar(tx, 0, tz, 0xffffff, 0.2, 30, 0.2, 1); fx.burst(tx, 0.5, tz, 0xffee66, 22, 10, 0.5, 0.25); fx.ring(tx, 0.1, tz, 0xffee66, 3, 0.3); sfx('lightning', 0.7); g.shake(0.3); g.aoe(tx, tz, 2.5, this.roll(sc.dmg).d, { kind: 'skill', knock: 3, stagger: 1, crit: false, stun: 0.8 }); }); } break; }
      case 'quake': { for (let k = 0; k < 3; k++) g.later(k * 0.22, () => { const r = sc.range * (0.55 + k * 0.25); fx.ring(this.pos.x, 0.1, this.pos.z, col, r, 0.5); fx.burst(this.pos.x, 0.2, this.pos.z, 0xaa8855, 20, r * 1.2, 0.6, 0.3, 12); g.shake(0.5); sfx('quake', 0.6); g.aoe(this.pos.x, this.pos.z, r, this.roll(sc.dmg * 0.55).d, { kind: 'skill', knock: 5, down: k === 2, stagger: 1, crit: false, ringOnly: k > 0 ? r * 0.55 : 0 }); }); break; }
      case 'elexp': { const cols = [0xff7a22, 0x88eeff, 0xffee66]; for (let k = 0; k < 3; k++) g.later(k * 0.25, () => { const r = sc.range * (0.6 + k * 0.2); fx.blast(this.pos.x, 1, this.pos.z, cols[k], r, 0.5); fx.ring(this.pos.x, 0.1, this.pos.z, cols[k], r, 0.5); fx.burst(this.pos.x, 1, this.pos.z, cols[k], 30, 12, 0.7, 0.3); g.shake(0.6); sfx('explode', 0.7); g.aoe(this.pos.x, this.pos.z, r, this.roll(sc.dmg * 0.4).d, { kind: 'skill', knock: 7, launch: k === 2, stagger: 2, crit: false }); }); break; }
      case 'teleport': { const e = nearest(); fx.burst(px, 1, pz, col, 24, 6, 0.6); fx.ring(px, 0.1, pz, col, 3, 0.4); this.iframes = Math.max(this.iframes, 0.5); let nx = px, nz = pz; if (e) { const a = Math.atan2(e.x - px, e.z - pz); nx = e.x + Math.sin(a) * (e.radius + 1.3); nz = e.z + Math.cos(a) * (e.radius + 1.3); this.yaw = Math.atan2(e.x - nx, e.z - nz); } else { [nx, nz] = fwd(8 + lv); } [nx, nz] = g.collide(nx, nz, 0.45); this.pos.x = nx; this.pos.z = nz; sfx('teleport'); fx.burst(nx, 1, nz, col, 30, 8, 0.6); fx.ring(nx, 0.1, nz, col, 4, 0.4); fx.slash(nx, 1.2, nz, this.yaw, 0.3, 3.4, 5, col, 0.3); g.hitstop(0.05); g.aoe(nx, nz, sc.range * 0.3 + 1.5, dmg, { ...o, knock: 4, stagger: 1 }); this.nextCrit = true; break; }
      case 'clones': { const n = 2 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0); for (let i = 0; i < n; i++) { const rig = buildPlayer({ weapon: useStore.getState().save.equip.weapon }, col); rig.root.position.set(px, 0, pz); g.scene.add(rig.root); this.clones.push({ rig, x: px + Math.sin(i * 2 + 1) * 2, z: pz + Math.cos(i * 2 + 1) * 2, t: 6 + lv, h: 0.3 * i, ang: i * 2.1 }); fx.burst(px, 1, pz, col, 14, 5, 0.5); } break; }
      case 'shadowblade': { const n = 3 + (lv >= 3 ? 2 : 0) + (lv >= 5 ? 2 : 0); for (let i = 0; i < n; i++) { const a = yaw + (i - (n - 1) / 2) * 0.26; g.spawnProj({ x: px + Math.sin(a), y: 1.1, z: pz + Math.cos(a), vx: Math.sin(a) * 26, vz: Math.cos(a) * 26, dmg: this.roll(sc.dmg).d, r: 1.2, life: sc.range / 26, owner: 'p', color: col, shape: 'slash', pierce: true, size: 0.9, knock: 3, yaw: a }); } break; }
      case 'invis': { this.invisT = 4 + lv; this.nextCrit = true; this.rig.root.visible = false; if (!this.ghost) { this.ghost = buildPlayer({ weapon: useStore.getState().save.equip.weapon }, 0x8855ff); this.group.add(this.ghost.root); } this.ghost.root.visible = true; fx.burst(px, 1, pz, 0x8855ff, 40, 7, 0.8); sfx('shadow'); g.enemies.forEach((e) => { if (Math.hypot(e.x - px, e.z - pz) > 3) e.loseTarget(); }); break; }
      case 'darkexp': { const e = nearest(); const [tx, tz] = e ? [e.x, e.z] : fwd(5); fx.tele('circle', tx, tz, 0, sc.range, 0, 0xaa22ff, 0.8); fx.ring(tx, 0.2, tz, 0xaa22ff, 0.5, 0.8, sc.range, 0.7); for (let i = 0; i < 4; i++) g.later(i * 0.18, () => { g.enemies.forEach((en) => { if (!en.dead && Math.hypot(en.x - tx, en.z - tz) < sc.range + 2) en.pull(tx, tz, 7); }); fx.burst(tx, 1, tz, 0xaa22ff, 10, 3, 0.6, 0.2, -2); }); g.later(0.8, () => { fx.blast(tx, 1.4, tz, 0x8800cc, sc.range, 0.6, 0.8); fx.blast(tx, 1.4, tz, 0x000000, sc.range * 0.6, 0.5, 0.9); fx.ring(tx, 0.1, tz, 0xcc66ff, sc.range * 1.3, 0.5); fx.burst(tx, 1, tz, 0xcc66ff, 50, 12, 0.8, 0.35); g.shake(0.7); sfx('explode', 0.8); g.hitstop(0.07); g.aoe(tx, tz, sc.range, dmg, { ...o, knock: 8, launch: true, stagger: 2 }); }); break; }
      case 'beam': { const dur = 1.0 + lv * 0.18; let tick = 0; hold(dur, (_dt, c) => { const aim = this.lock ? Math.atan2(this.lock.x - this.pos.x, this.lock.z - this.pos.z) : g.camYaw; this.yaw = dampAngle(this.yaw, aim, 6, _dt); const a = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 0.8, 1.35, this.pos.z + Math.cos(this.yaw) * 0.8), b = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * sc.range, 1.35, this.pos.z + Math.cos(this.yaw) * sc.range); fx.beam(a, b, col, 0.5 + Math.sin(c.t * 40) * 0.1, 0.5); fx.beam(a, b, 0xffffff, 0.2, 0.9); fx.emit(b.x, 1.3, b.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, col, 0.4, 0.3); g.shake(0.1); tick -= _dt; if (tick <= 0) { tick = 0.1; g.lineHit(this.pos.x, this.pos.z, this.yaw, sc.range, 1.1, this.roll(sc.dmg).d, { kind: 'skill', knock: 1.5, crit: false, noFlinch: true }); sfx('beam', 0.3); } }); break; }
      case 'gravity': { const e = nearest(); const [tx, tz] = e ? [e.x, e.z] : fwd(5); fx.tele('circle', tx, tz, 0, sc.range, 0, 0xaa88ff, 1.5); let tk = 0; hold(1.5 + 0.1 * lv, (_dt, c) => { fx.ring(tx, 0.2, tz, 0xaa88ff, 0.5, 0.5, sc.range, 0.5); fx.emit(tx + (Math.random() - 0.5) * sc.range * 2, 0.5 + Math.random() * 2, tz + (Math.random() - 0.5) * sc.range * 2, 0, 0, 0, 0xaa88ff, 0.5, 0.25); g.enemies.forEach((en) => { if (!en.dead && Math.hypot(en.x - tx, en.z - tz) < sc.range) en.pull(tx, tz, 9 * _dt * 60 / 60 + 4); }); tk -= _dt; if (tk <= 0) { tk = 0.3; g.aoe(tx, tz, sc.range, this.roll(sc.dmg * 0.2).d, { kind: 'skill', knock: 0, crit: false, noFlinch: true }); } void c; }, () => { fx.blast(tx, 1.2, tz, 0xaa88ff, sc.range, 0.4); fx.burst(tx, 1, tz, 0xddccff, 40, 11, 0.7, 0.3); sfx('explode', 0.6); g.shake(0.5); g.aoe(tx, tz, sc.range, dmg, { ...o, knock: 7, stagger: 2 }); }); break; }
      case 'barrier': { this.barrier = this.maxHp * (0.22 + lv * 0.07); this.barrierT = 12; fx.burst(px, 1, pz, 0x66ccff, 30, 6, 0.7); fx.ring(px, 0.1, pz, 0x66ccff, 3, 0.5); fx.blast(px, 1, pz, 0x66ccff, 1.8, 0.4); sfx('magic'); this.heal(this.maxHp * 0.05); break; }
      case 'dimslash': { const len = sc.range, wd = 1.8 + lv * 0.25; const ex = px + Math.sin(yaw) * len, ez = pz + Math.cos(yaw) * len; fx.streak(px, 1.2, pz, yaw, len, 0.9, col, 0.45); fx.slash(px + Math.sin(yaw) * len * 0.5, 1.3, pz + Math.cos(yaw) * len * 0.5, yaw + Math.PI / 2, 0, 2.5, 3, 0xffffff, 0.35, 1); fx.slash(px + Math.sin(yaw) * len * 0.5, 1.3, pz + Math.cos(yaw) * len * 0.5, yaw + Math.PI / 2, 0, 3, 3, col, 0.45, 1); for (let i = 0; i < 12; i++) fx.pillar(px + Math.sin(yaw) * len * i / 11, 0, pz + Math.cos(yaw) * len * i / 11, col, 0.4, 4, 0.3, 0.6); void ex; void ez; sfx('teleport', 0.8, 0.7); g.shake(0.6); g.hitstop(0.08); g.lineHit(px, pz, yaw, len, wd, dmg, { ...o, knock: 4, stagger: 1 }); break; }
      case 'arcexp': { fx.blast(px, 1, pz, col, sc.range, 0.5, 0.8); fx.ring(px, 0.1, pz, col, sc.range, 0.5); fx.ring(px, 0.1, pz, 0xffffff, sc.range * 0.6, 0.35); fx.burst(px, 1, pz, col, 60, 14, 0.8, 0.35); fx.pillar(px, 0, pz, col, 1.5, 8, 0.4); g.shake(0.8); sfx('explode', 0.8); g.hitstop(0.08); g.aoe(px, pz, sc.range, dmg, { ...o, knock: 9, launch: true, stagger: 2 }); break; }
    }
  }
  private updateClones(dt: number, t: number) {
    const g = this.g;
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const c = this.clones[i]; c.t -= dt; c.h -= dt;
      const tgt = g.nearestEnemy(c.x, c.z, 14, 0, 6.3);
      if (tgt) { const a = Math.atan2(tgt.x - c.x, tgt.z - c.z), d = Math.hypot(tgt.x - c.x, tgt.z - c.z); if (d > 2) { c.x += Math.sin(a) * 9 * dt; c.z += Math.cos(a) * 9 * dt; } c.rig.root.rotation.y = a; if (c.h <= 0 && d < 5) { c.h = 0.6; g.fx.slash(c.x, 1.2, c.z, a, (Math.random() - 0.5) * 1.5, 3, 3, 0x9955ff, 0.2); sfx('hit', 0.3, 1.2); const k = tgt.hit(g, this.roll(0.6 + this.castLv * 0.12).d, { dx: Math.sin(a), dz: Math.cos(a), knock: 2, stagger: 0, crit: false }); void k; this.addUlt(0.5); } c.rig.armR.rotation.x = -1.2; }
      else { c.ang += dt; c.x += (this.pos.x + Math.sin(c.ang) * 2.5 - c.x) * dt * 3; c.z += (this.pos.z + Math.cos(c.ang) * 2.5 - c.z) * dt * 3; }
      c.rig.root.position.set(c.x, 0, c.z); c.rig.legR.rotation.x = Math.sin(t * 10) * 0.5; c.rig.legL.rotation.x = -Math.sin(t * 10) * 0.5;
      if (c.t <= 0) { g.fx.burst(c.x, 1, c.z, 0x9955ff, 16, 5, 0.5); g.scene.remove(c.rig.root); this.clones.splice(i, 1); }
    }
  }

  // ---------- ultimate / awakening ----------
  startUlt() {
    const g = this.g; const u = this.W.ult; this.ult = 0; this.state = 'ult'; this.st = 0; this.ultKind = u; this.atk = null; this.ultT = 0; this.chargeT = 0; this.iframes = 3; this.vx = this.vz = 0;
    bumpStat('ults'); sfx('ult'); g.slowmo(0.35, 0.5); g.flash('#fff', 0.5); g.fov(14); g.shake(0.5); this.aim(20);
    g.callout(this.W.ultName.toUpperCase(), '#ffd860'); g.banner(this.W.ultName, this.awakened ? 'AWAKENED FINISHER' : 'ULTIMATE', '#ffd860');
    const fin = this.awakened ? 1.8 : 1, col = this.awakened ? 0xffe070 : this.W.glow, fx = g.fx;
    fx.ring(this.pos.x, 0.1, this.pos.z, col, 8, 0.8); fx.burst(this.pos.x, 1, this.pos.z, col, 60, 10, 1, 0.3);
    const px = () => this.pos.x, pz = () => this.pos.z;
    switch (u) {
      case 'cataclysm': {
        this.vy = 13; this.grounded = false; this.ultT = 1.5;
        g.later(0.6, () => { this.vy = -34; });
        const slam = () => { const R = 11 * (this.awakened ? 1.3 : 1);
          for (let k = 0; k < 3; k++) g.later(k * 0.16, () => { fx.ring(px(), 0.1, pz(), k === 1 ? 0xffffff : col, R * (0.5 + k * 0.25), 0.6); fx.blast(px(), 0.8, pz(), col, R * 0.5 * (k + 1) * 0.5, 0.5, 0.6); g.shake(0.9); g.aoe(px(), pz(), R * (0.6 + k * 0.2), this.roll(2.4 * fin).d, { kind: 'skill', knock: 10, down: k === 2, launch: k === 0, stagger: 2, crit: false }); });
          fx.pillar(px(), 0, pz(), col, 3, 30, 0.7); fx.burst(px(), 0.4, pz(), 0xccbb99, 80, 14, 1, 0.4, 10); sfx('explode', 1); sfx('quake', 1); g.hitstop(0.12); this.ultT = 0.7; };
        this.chans.push({ t: 0, dur: 1.2, fn: (_d, c) => { if (!this.grounded || c.t < 0.7) return; if (this.ultKind === 'cataclysm') { this.ultKind = 'cataclysm_done'; slam(); } } }); break;
      }
      case 'bladestorm': {
        const n = 9; this.ultT = 1.6;
        for (let k = 0; k < n; k++) g.later(0.25 + k * 0.12, () => { const list = g.enemies.filter((e) => !e.dead && Math.hypot(e.x - this.pos.x, e.z - this.pos.z) < 22); if (!list.length) return; const e = list[Math.floor(Math.random() * list.length)]; const a = Math.random() * TAU; fx.burst(this.pos.x, 1, this.pos.z, col, 10, 5, 0.4); let nx = e.x + Math.sin(a) * 1.8, nz = e.z + Math.cos(a) * 1.8; [nx, nz] = g.collide(nx, nz, 0.45); this.pos.x = nx; this.pos.z = nz; this.yaw = Math.atan2(e.x - nx, e.z - nz); fx.slash(e.x, 1.3, e.z, Math.random() * TAU, (Math.random() - 0.5) * 3, 3.4, 4, k % 2 ? 0xffffff : col, 0.22, 1); fx.burst(e.x, 1.2, e.z, col, 12, 8, 0.4, 0.2); sfx('crit', 0.6, 1 + k * 0.05); g.shake(0.3); g.hitstop(0.03); const kk = e.hit(g, this.roll(0.9 * fin).d, { dx: Math.sin(this.yaw), dz: Math.cos(this.yaw), knock: 3, stagger: 1, crit: true, heavy: true }); this.onHitFeedback(e, true, true, kk); });
        g.later(1.5, () => { fx.slash(px(), 1.2, pz(), 0, 0.8, 9, 7, 0xffffff, 0.5, 1); fx.slash(px(), 1.2, pz(), 0.8, -0.8, 9, 7, col, 0.5, 1); fx.blast(px(), 1, pz(), col, 8, 0.5); fx.ring(px(), 0.1, pz(), col, 10, 0.5); sfx('explode', 0.8); g.shake(0.8); g.aoe(px(), pz(), 10, this.roll(3 * fin).d, { kind: 'skill', knock: 8, launch: true, stagger: 2, crit: true }); });
        break;
      }
      case 'tempest': {
        this.ultT = 2.2; let tk = 0;
        this.chans.push({ t: 0, dur: 2.1, fn: (dt, c) => { this.yaw += dt * 18; tk -= dt; fx.ring(px(), 0.2 + (c.t % 0.5) * 3, pz(), col, 6, 0.3, 1, 0.5); fx.emit(px() + Math.cos(c.t * 20) * 4, 0.5, pz() + Math.sin(c.t * 20) * 4, 0, 4, 0, col, 0.5, 0.4); g.enemies.forEach((e) => { if (!e.dead && Math.hypot(e.x - px(), e.z - pz()) < 9) e.pull(px(), pz(), 4); }); if (tk <= 0) { tk = 0.14; fx.slash(px(), 1.2, pz(), Math.random() * TAU, 0, 6.5, 7, col, 0.18, 0.9); fx.pillar(px(), 0, pz(), col, 3.2, 8, 0.2, 0.25); sfx('hit', 0.4, 0.8); g.shake(0.25); g.aoe(px(), pz(), 6.5, this.roll(0.65 * fin).d, { kind: 'skill', knock: 1, stagger: 0, crit: false, noFlinch: false }); } }, done: () => { fx.blast(px(), 1, pz(), col, 9, 0.6); fx.ring(px(), 0.1, pz(), 0xffffff, 11, 0.6); fx.burst(px(), 1, pz(), col, 70, 14, 0.9, 0.35); sfx('explode', 1); g.shake(1); g.hitstop(0.1); g.aoe(px(), pz(), 9.5, this.roll(3.2 * fin).d, { kind: 'skill', knock: 11, launch: true, stagger: 2, crit: true }); } }); break;
      }
      case 'starfall': {
        this.ultT = 2.6; this.vy = 4; this.grounded = false;
        for (let k = 0; k < 14; k++) g.later(0.3 + k * 0.15, () => { const list = g.enemies.filter((e) => !e.dead && Math.hypot(e.x - this.pos.x, e.z - this.pos.z) < 24); const e = list.length ? list[Math.floor(Math.random() * list.length)] : null; const [tx, tz] = e ? [e.x + (Math.random() - 0.5) * 2, e.z + (Math.random() - 0.5) * 2] : g.world ? g.world.point(Math.random, 3) : [0, 0]; fx.tele('circle', tx, tz, 0, 3.6, 0, col, 0.5); fx.pillar(tx, 4, tz, col, 0.4, 24, 0.5, 0.35); g.later(0.5, () => { fx.blast(tx, 1.4, tz, col, 3.8, 0.45, 0.9); fx.pillar(tx, 0, tz, 0xffffff, 0.6, 22, 0.3, 0.9); fx.burst(tx, 0.5, tz, col, 26, 11, 0.7, 0.3); fx.ring(tx, 0.1, tz, col, 4.5, 0.4); sfx('explode', 0.6, 1.2); g.shake(0.4); g.hitstop(0.03); g.aoe(tx, tz, 3.8, this.roll(1.7 * fin).d, { kind: 'skill', knock: 6, launch: true, stagger: 2, crit: false }); }); });
        break;
      }
    }
  }
  private ultUpdate(dt: number) {
    this.st += dt; this.vx = damp(this.vx, 0, 10, dt); this.vz = damp(this.vz, 0, 10, dt);
    const k = this.ultKind; if (k === 'starfall' || k === 'cataclysm' || k === 'cataclysm_done') this.applyMove(dt, 0, 0, 0, true); else { this.vy = 0; this.pos.y = Math.max(0, this.pos.y); this.applyMove(dt, 0, 0, 0, true); }
    if (this.st >= this.ultT + 0.25 && this.grounded || this.st >= this.ultT + 1.5) { this.state = 'free'; this.iframes = Math.max(this.iframes, 0.6); this.pos.y = Math.max(0, this.pos.y); this.grounded = this.pos.y <= 0.01; }
  }
  startAwaken() {
    const g = this.g; this.awk = 0; this.state = 'awaken'; this.st = 0; this.iframes = 4; this.atk = null; bumpStat('awaken'); sfx('awaken'); g.slowmo(0.3, 1.0); g.fov(16); g.callout('AWAKENING', '#ffd860'); g.banner('AWAKENING', 'Power surges through you', '#ffd860');
    g.fx.ring(this.pos.x, 0.1, this.pos.z, 0xffd860, 14, 1.2); g.fx.pillar(this.pos.x, 0, this.pos.z, 0xffd860, 2, 40, 1.4, 0.5); g.flash('#ffe9a0', 0.6);
    this.vx = this.vz = 0;
    g.later(0.8, () => { this.awakened = true; this.awakenT = 22; this.refresh(); this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.35); this.rebuild(); g.fx.burst(this.pos.x, 1, this.pos.z, 0xffd860, 100, 16, 1.4, 0.4); g.fx.ring(this.pos.x, 0.1, this.pos.z, 0xffffff, 18, 0.9); g.shake(1); g.flash('#fff', 0.7); sfx('legend');
      g.aoe(this.pos.x, this.pos.z, 14, this.roll(2).d, { kind: 'skill', knock: 14, launch: true, stagger: 2, crit: true }); });
  }
  private updateAwaken(dt: number) { this.pos.y = Math.min(0.5, this.st * 0.8); if (this.st < 1.6 && (this.g.time * 30) % 1 < 0.6) this.g.fx.emit(this.pos.x + (Math.random() - 0.5) * 2, 0.2, this.pos.z + (Math.random() - 0.5) * 2, 0, 5 + Math.random() * 4, 0, 0xffd860, 1, 0.3); if (this.st >= 1.7) { this.state = 'free'; this.pos.y = 0; this.grounded = true; this.iframes = 0.8; } void dt; }
  endAwaken(silent = false) { this.awakened = false; this.awakenT = 0; this.awk = 0; this.refresh(); this.hp = Math.min(this.hp, this.maxHp); this.rebuild(); if (!silent) { this.g.fx.burst(this.pos.x, 1, this.pos.z, 0xffd860, 40, 8, 0.8); this.g.callout('Awakening ends', '#ccc'); } }
  victory() { if (this.state === 'dead') return; this.state = 'victory'; this.victoryT = 0; this.atk = null; this.iframes = 99; }

  // ---------- animation ----------
  private animate(dt: number, t: number) {
    const r = this.rig, P = this.pose, W = this.W, mag = Math.hypot(this.vx, this.vz), run = clamp(mag / 7, 0, 1.3), sw = Math.sin(this.walkPh) * run;
    let T = { ax: -0.3, az: -0.05, lx: -0.1, lz: 0.05, tw: 0, lean: 0, spin: 0, drop: 0, roll: 0, head: 0 }, k = 18; let wr: [number, number, number] = REST_W;
    const lowWeight = this.stats.family === 'katana' || this.stats.family === 'dagger' || this.stats.family === 'dual';
    switch (this.state) {
      case 'free': case 'guard': case 'charge': {
        T.ax = -0.35 - sw * 0.5; T.lx = -0.15 + sw * 0.5; T.lean = Math.min(0.35, mag / 30) + (this.landT > 0 ? 0.25 : 0); T.drop = this.landT > 0 ? -0.12 : 0;
        if (!this.grounded) { T.ax = -0.9; T.lx = -0.6; T.az = -0.4; T.lz = 0.4; T.lean = this.vy > 0 ? -0.1 : 0.1; }
        else if (run < 0.1) { T.ax = -0.3 + Math.sin(t * 1.6) * 0.03; T.drop = Math.sin(t * 1.6) * 0.012; }
        if (this.state === 'guard') { const gp = GUARD[W.guard]; T.ax = gp.ax; T.az = gp.az; T.lx = gp.lx; T.lz = gp.lz; wr = gp.w; k = 30; T.lean = 0.05; if (this.guardT < 0.25) T.tw = Math.sin(this.guardT * 40) * 0.1; }
        if (this.state === 'charge') { const hp = POSES[W.heavy.pose] || POSES.O; T.ax = hp.w[0]; T.az = hp.w[1]; T.tw = hp.w[2]; T.lean = hp.w[3]; T.lx = hp.w[0] * 0.7; T.lz = -hp.w[1]; k = 14; T.drop = -0.1 - this.chargeT * 0.05; }
        break;
      }
      case 'atk': case 'cast': case 'ult': {
        if (this.state === 'atk' && this.atk) {
          const def = this.atk; const p = clamp(this.progress(), 0, 1), h0 = def.hits[0] ?? 0.5, ps = POSES[def.pose] || POSES.R;
          const wp = clamp(p / Math.max(0.05, h0 * 0.85), 0, 1), sp = clamp((p - h0 * 0.85) / Math.max(0.1, 1 - h0 * 0.85), 0, 1);
          const e1 = ease(wp), e2 = ease(Math.min(1, sp * 2.2));
          const a = p < h0 * 0.85 ? ps.w : ps.s; const b = p < h0 * 0.85 ? [-0.3, -0.05, 0, 0] : ps.w;
          const f = p < h0 * 0.85 ? e1 : e2;
          const val = (i: number) => (p < h0 * 0.85 ? b[i] + (a[i] - b[i]) * f : ps.w[i] + (ps.s[i] - ps.w[i]) * f);
          T.ax = val(0); T.az = val(1); T.tw = val(2); T.lean = val(3); k = p > h0 * 0.8 ? 60 : 28;
          if (this.atkKind === 'light' && (def.pose === 'L' || def.pose === 'X' || def.pose === 'T') && lowWeight && this.atkIdx % 2) { T.tw *= -1; }
          if (def.pose === 'S') T.spin = ease(sp) * TAU;
          if (this.stats.family === 'dual' || W.name === 'Daggers') { T.lx = -T.ax * 0.0 + (-1.2 + (this.atkIdx % 2 ? -0.4 : 0.2) * (1 - f)); T.lz = 0.3 + (this.atkIdx % 2 ? 0.5 : -0.2); } else { T.lx = T.ax * 0.8; T.lz = -T.az * 0.6 + 0.3; }
          if (this.atkKind === 'counter') T.spin = def.pose === 'S' ? T.spin : 0;
        } else if (this.state === 'cast') {
          const c = clamp(this.castT / Math.max(0.1, this.castDef?.cast || 0.3), 0, 1); T.ax = -0.5 - ease(c) * 1.2; T.lx = T.ax; T.az = -0.3; T.lz = 0.3; T.lean = -0.1 + c * 0.2; k = 30;
          if (this.castDef?.id === 'flurry' || this.castDef?.id === 'gravity') T.spin = 0;
        } else { const u = this.ultKind; T.ax = this.st < 0.7 ? -3.0 : -1.2; T.lx = T.ax; T.az = -0.2; T.lz = 0.2; T.lean = this.st < 0.7 ? -0.3 : 0.5; k = 20; if (u === 'tempest') T.spin = this.st * 18; if (u === 'bladestorm') { T.tw = Math.sin(t * 30) * 1.2; T.ax = -1.5; } }
        break;
      }
      case 'dodge': { const p = this.st / this.dodgeDur; T.lean = 0.7; T.drop = -0.3; T.roll = Math.sin(this.yaw) * 0 + (this.dodgeVx * Math.sin(this.yaw) + this.dodgeVz * Math.cos(this.yaw) > -0.3 ? ease(p) * TAU : -0.5); T.ax = -0.9; T.lx = -0.9; k = 40; break; }
      case 'hurt': T.lean = -0.5; T.ax = -0.2; T.lx = -0.2; T.az = -0.8; T.lz = 0.8; T.head = -0.3; k = 40; break;
      case 'dead': { T.lean = -Math.min(1.55, this.deathT * 3.5); T.drop = -0.5 * Math.min(1, this.deathT * 3); T.ax = -0.3; T.az = -1.0; T.lz = 1.0; k = 12; break; }
      case 'victory': T.ax = -2.9 + Math.sin(t * 6) * 0.12; T.az = -0.2; T.lean = -0.1; T.head = -0.2; T.lx = -0.2; k = 14; break;
      case 'awaken': T.ax = -0.4; T.lx = -0.4; T.az = -1.4; T.lz = 1.4; T.lean = -0.25; T.head = -0.4; T.tw = Math.sin(t * 3) * 0.2; k = 10; break;
    }
    P.ax = damp(P.ax, T.ax, k, dt); P.az = damp(P.az, T.az, k, dt); P.lx = damp(P.lx, T.lx, k, dt); P.lz = damp(P.lz, T.lz, k, dt); P.tw = damp(P.tw, T.tw, k, dt); P.lean = damp(P.lean, T.lean, k * 0.8, dt);
    P.drop = damp(P.drop, T.drop, 20, dt); P.head = damp(P.head, T.head, 12, dt); P.spin = T.spin; P.roll = T.roll || damp(P.roll, 0, 30, dt);
    this.pw[0] = damp(this.pw[0], wr[0], 24, dt); this.pw[1] = damp(this.pw[1], wr[1], 24, dt); this.pw[2] = damp(this.pw[2], wr[2], 24, dt);
    r.armR.rotation.set(P.ax, 0, P.az); r.armL.rotation.set(P.lx, 0, P.lz); r.torso.rotation.y = P.tw; r.head.rotation.x = P.head; r.head.rotation.y = -P.tw * 0.4;
    r.body.rotation.x = P.roll ? P.roll : P.lean; r.body.position.y = 0.95 + P.drop + (run > 0.2 && this.grounded ? Math.abs(Math.sin(this.walkPh)) * 0.05 : 0);
    r.root.rotation.y = P.spin; this.group.rotation.y = this.yaw; this.group.position.copy(this.pos);
    if (r.weapon) { r.weapon.rotation.set(this.pw[0], this.pw[1], this.pw[2]); if (this.stats.family === 'dual' && r.weapon2) r.weapon2.rotation.set(this.pw[0], -this.pw[1], -this.pw[2]); }
    const air = !this.grounded;
    r.legR.rotation.x = air ? -0.7 : sw * 0.9; r.legL.rotation.x = air ? 0.35 : -sw * 0.9;
    if (this.state === 'dodge') { r.legR.rotation.x = -0.8; r.legL.rotation.x = 0.4; }
    for (let i = 0; i < r.cape.length; i++) r.cape[i].rotation.x = damp(r.cape[i].rotation.x, 0.1 + clamp(mag / 9, 0, 1) * 0.5 * (1 + i * 0.25) + Math.sin(t * 3 + i * 0.8) * 0.06 + (air ? 0.3 : 0), 8, dt);
    if (r.wings) r.wings.children.forEach((c, i) => { c.rotation.z += Math.sin(t * 2.4 + i) * 0.004; }); if (r.halo) r.halo.rotation.z = t * 1.2; if (r.aura) { r.aura.scale.setScalar(1 + Math.sin(t * 8) * 0.06); r.aura.rotation.y = t; }
    if (this.invisT > 0 && this.ghost) { this.ghost.root.visible = true; this.ghost.root.position.set(0, 0, 0); this.ghost.armR.rotation.copy(r.armR.rotation); this.ghost.armL.rotation.copy(r.armL.rotation); this.ghost.legR.rotation.copy(r.legR.rotation); this.ghost.legL.rotation.copy(r.legL.rotation); this.ghost.body.rotation.copy(r.body.rotation); this.ghost.body.position.y = r.body.position.y; this.ghost.root.rotation.y = r.root.rotation.y; if (this.ghost.weapon) this.ghost.weapon.rotation.copy(r.weapon?.rotation || this.ghost.weapon.rotation); }
    const flick = this.iframes > 0 && this.state === 'hurt' ? Math.sin(t * 60) > 0 : true; if (this.invisT <= 0) r.root.visible = flick;
  }
  xpBar() { const s = useStore.getState().save; return [s.xp, xpNeed(s.level)]; }
}
