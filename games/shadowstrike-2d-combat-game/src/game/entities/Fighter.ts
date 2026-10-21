/**
 * SHADOWSTRIKE — the fighter entity.
 *
 * Deterministic 2D character controller + explicit combat state machine.
 * No physics bodies drive the character, no ragdoll, no random forces.
 */

import Phaser from 'phaser';
import type { AttackDef, WeaponDef } from '../../data/weapons';
import type { SkillDef, SkillLevel } from '../../data/skills';
import type { EquipmentDef, EquipSlot } from '../../data/equipment';
import {
  attackPose, buildSkeleton, chargePose, drawFighter, locomotionPose, weaponTip,
  type Pose, type Skeleton, type LocoState,
} from '../rig/StickRig';
import { ContrastTracker, type ContrastStyle } from '../contrast/AdaptiveContrast';

export type FighterState =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch' | 'dash'
  | 'block' | 'attack' | 'charge' | 'cast' | 'hit' | 'knockdown' | 'getup'
  | 'victory' | 'defeat' | 'frozen';

export interface FighterInput {
  left: boolean; right: boolean; up: boolean; down: boolean;
  block: boolean;
  attackHeld: boolean;
  /** edge events consumed each frame */
  attackPressed: boolean; attackReleased: boolean;
  jumpPressed: boolean; dodgePressed: boolean;
  skillPressed: [boolean, boolean, boolean];
}

export const EMPTY_INPUT: FighterInput = {
  left: false, right: false, up: false, down: false, block: false,
  attackHeld: false, attackPressed: false, attackReleased: false,
  jumpPressed: false, dodgePressed: false, skillPressed: [false, false, false],
};

export interface EquippedSkill {
  def: SkillDef;
  level: number;
  cfg: SkillLevel;
  cooldown: number;
}

export interface FighterOptions {
  side: 'p1' | 'p2';
  name: string;
  weapon: WeaponDef;
  skills: EquippedSkill[];
  equipment: Partial<Record<EquipSlot, EquipmentDef>>;
  maxHealth: number;
  bodyColor: number;
  eyeColor: number;
  auraColor: number;
  scale: number;
  x: number;
  facing: 1 | -1;
  damageMul?: number;
  infiniteCooldowns?: boolean;
  isDummy?: boolean;
}

export interface Hitbox {
  x: number; y: number; w: number; h: number;
}

export interface StatusState {
  burn: number; chill: number; slow: number; shock: number;
  shield: number; haste: number; armor: number; stun: number;
  damageBuff: number;
}

export type FighterEvent =
  | { type: 'attack-start'; attack: AttackDef; charged: boolean }
  | { type: 'swing'; x: number; y: number; color: number }
  | { type: 'cast'; slot: number; skill: EquippedSkill }
  | { type: 'dodge' }
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'guard-break' }
  | { type: 'defeated' };

const GRAVITY = 1950;
const JUMP_VELOCITY = -660;
const WALK_SPEED = 230;
const AIR_ACCEL = 1500;
const GROUND_ACCEL = 2900;
const FRICTION = 3600;
const DASH_SPEED = 680;
const DASH_TIME = 190;
const DASH_IFRAMES = 130;
const DASH_COOLDOWN = 620;
const MAX_GUARD = 100;
const GUARD_REGEN = 14; // per second
const CAST_TIME = 240;

export class Fighter {
  readonly side: 'p1' | 'p2';
  readonly opts: FighterOptions;
  name: string;
  weapon: WeaponDef;
  skills: EquippedSkill[];
  equipment: Partial<Record<EquipSlot, EquipmentDef>>;

  x: number; y: number; vx = 0; vy = 0;
  facing: 1 | -1;
  onGround = true;
  scale: number;

  health: number; maxHealth: number;
  guard = MAX_GUARD; maxGuard = MAX_GUARD;

  state: FighterState = 'idle';
  stateTime = 0;
  animTime = 0;

  attack: AttackDef | null = null;
  attackPhase: 'startup' | 'active' | 'recovery' = 'startup';
  attackElapsed = 0;
  attackCharged = false;
  attackPower = 1;
  hitTargets = new Set<object>();

  comboIndex = 0;
  comboWindow = 0;
  comboCount = 0;
  comboDecay = 0;

  chargeTime = 0;
  charging = false;
  chargeReleasedAt = 0;

  attackPowerMul = 1;

  /** Counts down while the fighter is in the perfect-deflect window (ms). */
  deflectWindow = 0;
  /** True during the active deflect window — set by the block-press edge. */
  deflecting = false;
  /** Cooldown preventing deflect spam (ms). */
  deflectCooldown = 0;

  dashTime = 0; dashCooldown = 0; dashDir: 1 | -1 = 1;
  invuln = 0;
  hitstun = 0;
  knockdownTime = 0;
  guardBreakTime = 0;
  blockFlash = 0;
  flash = 0;
  castSlot = -1;
  castTimer = 0;
  pendingSkill: EquippedSkill | null = null;

  status: StatusState = { burn: 0, chill: 0, slow: 0, shock: 0, shield: 0, haste: 0, armor: 0, stun: 0, damageBuff: 0 };
  burnDamage = 0;

  damageDealt = 0;
  damageTaken = 0;
  highestCombo = 0;
  rounds = 0;

  events: FighterEvent[] = [];
  defeated = false;
  infiniteCooldowns: boolean;
  damageMul: number;
  isDummy: boolean;

  readonly container: Phaser.GameObjects.Container;
  private gfx: Phaser.GameObjects.Graphics;
  private aura: Phaser.GameObjects.Graphics;
  private pose: Pose;
  private skeleton: Skeleton;
  private floorY: number;
  private bounds: { left: number; right: number };
  private contrastTracker = new ContrastTracker();
  private contrastStyle?: ContrastStyle;

  constructor(scene: Phaser.Scene, opts: FighterOptions, floorY: number, bounds: { left: number; right: number }) {
    this.opts = opts;
    this.side = opts.side;
    this.name = opts.name;
    this.weapon = opts.weapon;
    this.skills = opts.skills;
    this.equipment = opts.equipment;
    this.scale = opts.scale;
    this.maxHealth = opts.maxHealth;
    this.health = opts.maxHealth;
    this.x = opts.x;
    this.y = floorY;
    this.facing = opts.facing;
    this.floorY = floorY;
    this.bounds = bounds;
    this.infiniteCooldowns = opts.infiniteCooldowns ?? false;
    this.damageMul = opts.damageMul ?? 1;
    this.isDummy = opts.isDummy ?? false;

    this.aura = scene.add.graphics();
    this.gfx = scene.add.graphics();
    this.container = scene.add.container(this.x, this.y, [this.aura, this.gfx]);
    this.container.setDepth(20);
    this.pose = locomotionPose('idle', 0);
    this.skeleton = buildSkeleton(this.pose, this.scale);
  }

  /* --------------------------------------------------------- properties */

  get moveSpeed(): number {
    let s = WALK_SPEED * this.weapon.moveSpeedMul;
    const mods = this.equipmentMods();
    s *= 1 + mods.moveSpeed;
    if (this.status.haste > 0) s *= 1.35;
    if (this.status.chill > 0) s *= 0.62;
    if (this.status.slow > 0) s *= 0.72;
    return s;
  }

  equipmentMods() {
    const out = { maxHealth: 0, moveSpeed: 0, guard: 0, cooldown: 0 };
    for (const item of Object.values(this.equipment)) {
      if (!item?.mods) continue;
      out.maxHealth += item.mods.maxHealth ?? 0;
      out.moveSpeed += item.mods.moveSpeed ?? 0;
      out.guard += item.mods.guard ?? 0;
      out.cooldown += item.mods.cooldown ?? 0;
    }
    return out;
  }

  get isBusy(): boolean {
    return this.state === 'attack' || this.state === 'cast' || this.state === 'hit'
      || this.state === 'knockdown' || this.state === 'getup' || this.state === 'defeat'
      || this.state === 'frozen';
  }

  get canAct(): boolean {
    return !this.defeated && !this.isBusy && this.status.stun <= 0 && this.guardBreakTime <= 0;
  }

  get hurtbox(): Hitbox {
    const crouched = this.state === 'crouch' || this.state === 'knockdown';
    const h = (crouched ? 70 : 112) * this.scale;
    return { x: this.x - 20 * this.scale, y: this.y - h, w: 40 * this.scale, h };
  }

  /* -------------------------------------------------------------- update */

  update(dt: number, input: FighterInput, opponentX: number): void {
    const dtS = dt / 1000;
    this.stateTime += dt;
    this.animTime += dt;

    // timers
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.deflectCooldown = Math.max(0, this.deflectCooldown - dt);
    this.deflectWindow = Math.max(0, this.deflectWindow - dt);
    if (this.deflectWindow <= 0) this.deflecting = false;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitstun = Math.max(0, this.hitstun - dt);
    this.blockFlash = Math.max(0, this.blockFlash - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.guardBreakTime = Math.max(0, this.guardBreakTime - dt);
    this.comboDecay = Math.max(0, this.comboDecay - dt);
    if (this.comboDecay <= 0 && this.comboCount > 0) this.comboCount = 0;
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    if (this.comboWindow <= 0 && this.state !== 'attack') this.comboIndex = 0;

    for (const k of ['burn', 'chill', 'slow', 'shock', 'haste', 'armor', 'stun', 'damageBuff'] as const) {
      this.status[k] = Math.max(0, this.status[k] - dt);
    }
    if (this.status.burn > 0) {
      this.health = Math.max(0, this.health - this.burnDamage * dtS);
      if (this.health <= 0) this.kill();
    }
    if (!this.infiniteCooldowns) {
      const cdMul = 1 + this.equipmentMods().cooldown;
      for (const s of this.skills) s.cooldown = Math.max(0, s.cooldown - dt * cdMul);
    } else {
      for (const s of this.skills) s.cooldown = 0;
    }
    if (this.guard < this.maxGuard && this.state !== 'block') {
      this.guard = Math.min(this.maxGuard, this.guard + GUARD_REGEN * dtS);
    }

    if (this.defeated) {
      this.applyPhysics(dtS);
      this.renderRig();
      return;
    }

    // facing: always turn toward the opponent unless committed to an action
    if (!this.isBusy && this.state !== 'dash') {
      const want: 1 | -1 = opponentX >= this.x ? 1 : -1;
      if (want !== this.facing) this.facing = want;
    }

    switch (this.state) {
      case 'attack': this.updateAttack(dt, dtS); break;
      case 'cast': this.updateCast(dt, dtS); break;
      case 'dash': this.updateDash(dt, dtS); break;
      case 'hit': this.updateHit(dtS); break;
      case 'knockdown': this.updateKnockdown(dt, dtS); break;
      case 'getup': this.updateGetup(dt, dtS); break;
      case 'frozen': this.updateFrozen(dt, dtS); break;
      case 'victory': this.applyPhysics(dtS); break;
      default: this.updateFree(dt, dtS, input); break;
    }

    // charge handling works across free + charge states
    if (this.charging) this.chargeTime += dt;

    this.renderRig();
  }

  /* ------------------------------------------------------- state updates */

  private updateFree(_dt: number, dtS: number, input: FighterInput): void {
    if (this.status.stun > 0 || this.guardBreakTime > 0) {
      this.vx *= 0.85;
      this.applyPhysics(dtS);
      this.state = 'hit';
      this.stateTime = 0;
      return;
    }

    // --- dodge / dash
    if (input.dodgePressed && this.dashCooldown <= 0 && !this.charging) {
      this.startDash(input.left ? -1 : input.right ? 1 : this.facing);
      return;
    }

    // --- skills
    for (let i = 0; i < 3; i++) {
      if (input.skillPressed[i]) {
        const sk = this.skills[i];
        if (sk && sk.cooldown <= 0) {
          this.startCast(i, sk);
          return;
        }
      }
    }

    // --- attack press begins the charge window
    if (input.attackPressed && this.onGround) {
      this.charging = true;
      this.chargeTime = 0;
      this.state = 'charge';
      this.stateTime = 0;
    }
    if (this.charging && (input.attackReleased || !input.attackHeld)) {
      const held = this.chargeTime;
      this.charging = false;
      if (held >= this.weapon.chargeTime) {
        const over = Math.min(1, (held - this.weapon.chargeTime) / Math.max(1, this.weapon.fullChargeTime - this.weapon.chargeTime));
        this.startAttack(this.weapon.charged, true, 1 + over * 0.6);
      } else {
        const idx = Math.min(this.comboIndex, 2);
        this.startAttack(this.weapon.combo[idx], false, 1, held);
      }
      return;
    }
    if (this.charging) {
      this.chargeTime = Math.min(this.chargeTime, this.weapon.fullChargeTime + 400);
      this.vx *= 0.8;
      this.applyPhysics(dtS);
      this.state = 'charge';
      return;
    }

    // --- blocking / deflect window
    if (input.block && this.onGround) {
      // Edge of block press opens a short deflect window (if not on cooldown)
      if (this.state !== 'block' && this.deflectCooldown <= 0) {
        this.deflectWindow = 160;
        this.deflecting = true;
      }
      this.state = 'block';
      this.vx *= 0.7;
      this.guard = Math.max(0, this.guard - 4 * dtS);
      this.applyPhysics(dtS);
      return;
    }

    // --- jump
    if (input.jumpPressed && this.onGround) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
      this.events.push({ type: 'jump' });
    }

    // --- horizontal movement
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
    const target = dir * this.moveSpeed * (input.down && this.onGround ? 0 : 1);
    if (dir !== 0) {
      this.vx = Phaser.Math.Linear(this.vx, target, Math.min(1, (accel * dtS) / Math.max(1, Math.abs(target - this.vx) || 1)));
      if (Math.abs(this.vx) > Math.abs(target)) this.vx = target;
      this.vx += dir * accel * dtS * 0.35;
      this.vx = Phaser.Math.Clamp(this.vx, -this.moveSpeed, this.moveSpeed);
    } else {
      const f = FRICTION * dtS * (this.onGround ? 1 : 0.35);
      if (Math.abs(this.vx) <= f) this.vx = 0; else this.vx -= Math.sign(this.vx) * f;
    }

    // fast fall
    if (input.down && !this.onGround && this.vy > -100) this.vy += 2200 * dtS;

    this.applyPhysics(dtS);

    // animation state
    if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
    else if (input.down) this.state = 'crouch';
    else if (Math.abs(this.vx) > this.moveSpeed * 0.65) this.state = 'run';
    else if (Math.abs(this.vx) > 12) this.state = 'walk';
    else this.state = 'idle';
  }

  private updateAttack(dt: number, dtS: number): void {
    if (!this.attack) { this.state = 'idle'; return; }
    this.attackElapsed += dt;
    const a = this.attack;
    const startup = a.startup * this.attackSpeedMul;
    const active = a.active;
    const recovery = a.recovery * this.attackSpeedMul;

    if (this.attackElapsed < startup) {
      this.attackPhase = 'startup';
      this.vx += this.facing * a.lunge * 1.6 * dtS;
    } else if (this.attackElapsed < startup + active) {
      if (this.attackPhase !== 'active') {
        this.attackPhase = 'active';
        const tip = this.worldWeaponTip();
        this.events.push({ type: 'swing', x: tip.x, y: tip.y, color: this.weapon.trail });
      }
      this.vx += this.facing * a.lunge * 2.2 * dtS;
    } else if (this.attackElapsed < startup + active + recovery) {
      this.attackPhase = 'recovery';
      this.vx *= 0.9;
    } else {
      // attack complete
      this.attack = null;
      this.attackPowerMul = 1;
      this.hitTargets.clear();
      this.comboWindow = a.cancelWindow;
      this.state = 'idle';
      this.stateTime = 0;
      return;
    }
    this.vx *= 0.92;
    this.applyPhysics(dtS);
  }

  private get attackSpeedMul(): number {
    let m = 1;
    if (this.status.haste > 0) m *= 0.88;
    if (this.status.chill > 0) m *= 1.2;
    return m;
  }

  private updateCast(dt: number, dtS: number): void {
    this.castTimer -= dt;
    this.vx *= 0.86;
    this.applyPhysics(dtS);
    if (this.castTimer <= 0) {
      if (this.pendingSkill) {
        this.events.push({ type: 'cast', slot: this.castSlot, skill: this.pendingSkill });
        this.pendingSkill = null;
      }
      this.state = 'idle';
      this.stateTime = 0;
    }
  }

  private updateDash(dt: number, dtS: number): void {
    this.dashTime -= dt;
    this.vx = this.dashDir * DASH_SPEED * (this.status.haste > 0 ? 1.2 : 1);
    if (!this.onGround) this.vy = Math.min(this.vy, 40);
    this.applyPhysics(dtS);
    if (this.dashTime <= 0) {
      this.vx *= 0.3;
      this.state = 'idle';
      this.stateTime = 0;
    }
  }

  private updateHit(dtS: number): void {
    this.vx *= 0.9;
    this.applyPhysics(dtS);
    if (this.hitstun <= 0 && this.status.stun <= 0 && this.guardBreakTime <= 0) {
      this.state = this.onGround ? 'idle' : 'fall';
      this.stateTime = 0;
    }
  }

  private updateKnockdown(dt: number, dtS: number): void {
    this.knockdownTime -= dt;
    this.vx *= 0.88;
    this.applyPhysics(dtS);
    if (this.knockdownTime <= 0 && this.onGround) {
      this.state = 'getup';
      this.stateTime = 0;
      this.invuln = Math.max(this.invuln, 220);
    }
  }

  private updateGetup(_dt: number, dtS: number): void {
    this.vx *= 0.8;
    this.applyPhysics(dtS);
    if (this.stateTime > 340) { this.state = 'idle'; this.stateTime = 0; }
  }

  private updateFrozen(_dt: number, dtS: number): void {
    this.vx *= 0.8;
    this.applyPhysics(dtS);
    if (this.status.stun <= 0) { this.state = 'idle'; this.stateTime = 0; }
  }

  private applyPhysics(dtS: number): void {
    this.vy += GRAVITY * dtS;
    this.x += this.vx * dtS;
    this.y += this.vy * dtS;
    if (this.y >= this.floorY) {
      if (!this.onGround) this.events.push({ type: 'land' });
      this.y = this.floorY;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.x = Phaser.Math.Clamp(this.x, this.bounds.left, this.bounds.right);
    if (this.x <= this.bounds.left || this.x >= this.bounds.right) this.vx *= 0.4;
  }

  /* ------------------------------------------------------------- actions */

  startAttack(def: AttackDef, charged: boolean, power = 1, preHeld = 0): void {
    this.attack = def;
    this.attackCharged = charged;
    this.attackPower = power;
    this.attackElapsed = Math.min(preHeld * 0.8, def.startup * 0.55);
    this.attackPhase = 'startup';
    this.hitTargets.clear();
    this.state = 'attack';
    this.stateTime = 0;
    if (!charged) this.comboIndex = Math.min(this.comboIndex + 1, 3) % 3;
    else this.comboIndex = 0;
    this.events.push({ type: 'attack-start', attack: def, charged });
  }

  startDash(dir: 1 | -1): void {
    this.dashDir = dir;
    this.dashTime = DASH_TIME;
    this.dashCooldown = DASH_COOLDOWN;
    this.invuln = Math.max(this.invuln, DASH_IFRAMES);
    this.state = 'dash';
    this.stateTime = 0;
    this.charging = false;
    this.events.push({ type: 'dodge' });
  }

  startCast(slot: number, sk: EquippedSkill): void {
    this.castSlot = slot;
    this.pendingSkill = sk;
    this.castTimer = CAST_TIME;
    this.state = 'cast';
    this.stateTime = 0;
    this.charging = false;
    if (!this.infiniteCooldowns) sk.cooldown = sk.cfg.cooldown;
  }

  /** Active melee hitbox in world space, or null when no hitbox is live. */
  getActiveHitbox(): Hitbox | null {
    if (this.state !== 'attack' || !this.attack || this.attackPhase !== 'active') return null;
    const a = this.attack;
    const cx = this.x + this.facing * (a.reach * 0.6) * this.scale;
    const w = a.hitW * this.scale;
    const h = a.hitH * this.scale;
    const cy = this.y - a.hitY * this.scale;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  isBlocking(fromX: number): boolean {
    if (this.state !== 'block') return false;
    const attackerSide = Math.sign(fromX - this.x) || 1;
    return attackerSide === this.facing;
  }

  /* ------------------------------------------------------------- damage */

  takeDamage(amount: number, fromX: number, knockback: number, launch: number, opts: {
    guardDamage?: number; hitstun?: number; knockdown?: boolean; guardbreak?: boolean;
    pierceBlock?: boolean;
  } = {}): { damage: number; blocked: boolean; broke: boolean } {
    if (this.defeated || this.invuln > 0) return { damage: 0, blocked: false, broke: false };
    const dir: 1 | -1 = fromX > this.x ? -1 : 1;
    let blocked = false;
    let broke = false;
    let dmg = amount;

    if (this.isBlocking(fromX) && !opts.pierceBlock) {
      blocked = true;
      const guardMods = 1 - Math.min(0.25, this.equipmentMods().guard);
      const chip = dmg * 0.14 * guardMods;
      this.guard -= (opts.guardDamage ?? 10) * (opts.guardbreak ? 2.2 : 1);
      dmg = chip;
      this.blockFlash = 160;
      this.vx = dir * knockback * 0.35;
      if (this.guard <= 0) {
        broke = true;
        this.guard = 0;
        this.guardBreakTime = 900;
        this.state = 'hit';
        this.hitstun = 900;
        this.events.push({ type: 'guard-break' });
      }
    } else {
      if (this.status.shield > 0) {
        const absorbed = Math.min(this.status.shield, dmg);
        this.status.shield -= absorbed;
        dmg -= absorbed;
      }
      if (dmg > 0) {
        this.vx = dir * knockback;
        if (launch > 0) { this.vy = -launch; this.onGround = false; }
        if (opts.knockdown) {
          this.state = 'knockdown';
          this.knockdownTime = 800;
          this.stateTime = 0;
        } else if (this.status.armor <= 0) {
          this.state = 'hit';
          this.hitstun = Math.max(this.hitstun, opts.hitstun ?? 260);
          this.stateTime = 0;
        }
        this.attack = null;
        this.charging = false;
        this.comboIndex = 0;
        this.flash = 140;
      }
    }

    dmg = Math.max(0, dmg);
    this.health = Math.max(0, this.health - dmg);
    this.damageTaken += dmg;
    if (this.health <= 0) this.kill();
    return { damage: dmg, blocked, broke };
  }

  heal(amount: number): void {
    if (this.defeated) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  registerCombo(): void {
    this.comboCount += 1;
    this.comboDecay = 1500;
    this.highestCombo = Math.max(this.highestCombo, this.comboCount);
  }

  kill(): void {
    if (this.defeated) return;
    this.defeated = true;
    this.health = 0;
    this.state = 'defeat';
    this.stateTime = 0;
    this.attack = null;
    this.charging = false;
    this.events.push({ type: 'defeated' });
  }

  resetForRound(x: number, facing: 1 | -1): void {
    this.x = x; this.y = this.floorY; this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.health = this.maxHealth + this.equipmentMods().maxHealth;
    this.maxHealth = this.maxHealth;
    this.guard = this.maxGuard;
    this.state = 'idle'; this.stateTime = 0;
    this.attack = null; this.attackElapsed = 0; this.hitTargets.clear();
    this.charging = false; this.chargeTime = 0;
    this.comboIndex = 0; this.comboCount = 0; this.comboWindow = 0;
    this.invuln = 0; this.hitstun = 0; this.defeated = false;
    this.guardBreakTime = 0; this.knockdownTime = 0;
    this.deflectWindow = 0; this.deflecting = false; this.deflectCooldown = 0;
    this.status = { burn: 0, chill: 0, slow: 0, shock: 0, shield: 0, haste: 0, armor: 0, stun: 0, damageBuff: 0 };
    for (const s of this.skills) s.cooldown = 0;
    this.events.length = 0;
  }

  setVictory(): void {
    if (this.defeated) return;
    this.state = 'victory';
    this.stateTime = 0;
    this.attack = null;
    this.charging = false;
  }

  /* ------------------------------------------------------------ rendering */

  private locoState(): LocoState {
    switch (this.state) {
      case 'walk': return 'walk';
      case 'run': return 'run';
      case 'jump': return 'jump';
      case 'fall': return 'fall';
      case 'crouch': return 'crouch';
      case 'dash': return 'dash';
      case 'block': return this.blockFlash > 0 ? 'blockhit' : 'block';
      case 'hit': return this.guardBreakTime > 0 ? 'hit' : 'hit';
      case 'knockdown': return 'knockdown';
      case 'getup': return 'getup';
      case 'victory': return 'victory';
      case 'defeat': return 'defeat';
      case 'cast': return this.pendingSkill?.def.kind === 'clone' || this.pendingSkill?.def.kind === 'summon' ? 'summon' : 'cast';
      case 'frozen': return 'hit';
      default: return 'idle';
    }
  }

  private computePose(): Pose {
    if (this.state === 'attack' && this.attack) {
      const a = this.attack;
      const startup = a.startup * this.attackSpeedMul;
      const active = a.active;
      const recovery = a.recovery * this.attackSpeedMul;
      if (this.attackElapsed < startup) return attackPose(a.arc, 'startup', this.attackElapsed / Math.max(1, startup));
      if (this.attackElapsed < startup + active) return attackPose(a.arc, 'active', (this.attackElapsed - startup) / Math.max(1, active));
      return attackPose(a.arc, 'recovery', (this.attackElapsed - startup - active) / Math.max(1, recovery));
    }
    if (this.state === 'charge') {
      return chargePose(this.weapon.charged.arc, this.animTime / 1000);
    }
    const speedRatio = Math.min(1, Math.abs(this.vx) / Math.max(1, this.moveSpeed));
    return locomotionPose(this.locoState(), this.animTime / 1000, speedRatio);
  }

  private renderRig(): void {
    this.pose = this.computePose();
    this.skeleton = buildSkeleton(this.pose, this.scale);
    this.container.setPosition(Math.round(this.x), Math.round(this.y));
    this.container.scaleX = this.facing;

    const g = this.gfx;
    g.clear();
    const flashT = this.flash > 0 ? this.flash / 140 : 0;
    const arena = (this.scene as any)?.arena ?? null;
    this.contrastStyle = this.contrastTracker.evaluate(
      arena,
      this.x,
      this.y,
      this.opts.bodyColor,
      this.opts.eyeColor,
      this.opts.auraColor,
      16
    );

    drawFighter(g, this.skeleton, {
      body: this.opts.bodyColor,
      eye: this.opts.eyeColor,
      outline: this.opts.auraColor,
      equipment: this.equipment as Record<string, EquipmentDef>,
      scale: this.scale,
      alpha: 1,
      contrast: this.contrastStyle,
      fighterId: this.opts.name.toLowerCase(),
      time: this.animTime / 1000,
    }, this.weapon, flashT);

    // aura / charge / status overlays
    const a = this.aura;
    a.clear();
    const auraItem = this.equipment.aura;
    const t = this.animTime / 1000;
    if (auraItem && auraItem.style !== 'none') {
      const pulse = 0.5 + Math.sin(t * 3) * 0.12;
      a.fillStyle(auraItem.glow, 0.1 * pulse);
      a.fillEllipse(0, -56 * this.scale, 86 * this.scale, 128 * this.scale);
      for (let i = 0; i < 4; i++) {
        const ang = t * 2 + (i * Math.PI) / 2;
        a.fillStyle(auraItem.color, 0.5);
        a.fillCircle(Math.cos(ang) * 30 * this.scale, -56 * this.scale + Math.sin(ang * 1.3) * 34 * this.scale, 2.6 * this.scale);
      }
    }
    if (this.charging) {
      const p = Math.min(1, this.chargeTime / this.weapon.fullChargeTime);
      const full = this.chargeTime >= this.weapon.chargeTime;
      const col = full ? this.weapon.glow : 0x8899aa;
      a.fillStyle(col, 0.12 + p * 0.22);
      a.fillCircle(0, -58 * this.scale, (36 + p * 42) * this.scale);
      a.lineStyle(2, col, 0.6 + p * 0.4);
      a.strokeCircle(0, -58 * this.scale, (30 + p * 46) * this.scale);
      if (full) {
        for (let i = 0; i < 6; i++) {
          const ang = t * 7 + (i * Math.PI) / 3;
          a.fillStyle(this.weapon.glow, 0.85);
          a.fillCircle(Math.cos(ang) * (44 + p * 16) * this.scale, -58 * this.scale + Math.sin(ang) * (44 + p * 16) * this.scale, 3);
        }
      }
    }
    if (this.status.shield > 0) {
      a.lineStyle(3, 0x9fd8ff, 0.7);
      a.strokeEllipse(0, -58 * this.scale, 92 * this.scale, 132 * this.scale);
      a.fillStyle(0x9fd8ff, 0.09);
      a.fillEllipse(0, -58 * this.scale, 92 * this.scale, 132 * this.scale);
    }
    if (this.status.burn > 0) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 3 + i * 0.6) % 1;
        a.fillStyle(0xff7a2a, 0.65 * (1 - ph));
        a.fillCircle((i - 1) * 12 * this.scale, (-20 - ph * 90) * this.scale, (5 - ph * 3) * this.scale);
      }
    }
    if (this.status.chill > 0) {
      a.lineStyle(2, 0x9fe8ff, 0.5);
      a.strokeEllipse(0, -56 * this.scale, 70 * this.scale, 120 * this.scale);
    }
    if (this.guardBreakTime > 0) {
      a.fillStyle(0xffe066, 0.5);
      for (let i = 0; i < 4; i++) {
        const ang = t * 9 + (i * Math.PI) / 2;
        a.fillCircle(Math.cos(ang) * 22, -110 * this.scale + Math.sin(ang) * 8, 3.4);
      }
    }
    if (this.state === 'block') {
      a.lineStyle(3, 0x7fd4ff, this.blockFlash > 0 ? 0.95 : 0.45);
      a.beginPath();
      a.arc(16 * this.scale, -58 * this.scale, 44 * this.scale, -1.1, 1.1);
      a.strokePath();
    }
  }

  worldWeaponTip(): { x: number; y: number } {
    const tip = weaponTip(this.skeleton, this.weapon, this.scale);
    return { x: this.x + tip.x * this.facing, y: this.y + tip.y };
  }

  worldHand(): { x: number; y: number } {
    return { x: this.x + this.skeleton.handR.x * this.facing, y: this.y + this.skeleton.handR.y };
  }

  centerY(): number { return this.y - 58 * this.scale; }

  destroy(): void {
    this.container.destroy(true);
  }
}
