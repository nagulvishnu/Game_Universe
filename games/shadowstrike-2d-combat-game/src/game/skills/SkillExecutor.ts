/**
 * SHADOWSTRIKE — skill execution.
 *
 * Every catalogue skill resolves to one of the handlers below. Perks granted by
 * upgrade levels 3/4/5 are read here and change real behaviour.
 */

import Phaser from 'phaser';
import type { SkillDef, SkillLevel, SkillPerk } from '../../data/skills';
import type { Fighter } from '../entities/Fighter';
import type { Effects } from '../effects/Effects';
import { buildSkeleton, drawFighter, locomotionPose, attackPose } from '../rig/StickRig';
import { audio } from '../audio/AudioManager';

export interface DamageOptions {
  knockback?: number;
  launch?: number;
  hitstun?: number;
  guardDamage?: number;
  knockdown?: boolean;
  guardbreak?: boolean;
  pierceBlock?: boolean;
  color?: number;
  source?: string;
}

export interface SkillWorld {
  scene: Phaser.Scene;
  effects: Effects;
  fighters: Fighter[];
  floorY: number;
  bounds: { left: number; right: number };
  dealDamage: (attacker: Fighter, target: Fighter, amount: number, opts?: DamageOptions) => number;
  hitStop: (ms: number) => void;
}

interface Entity {
  update(dt: number): boolean;
  destroy(): void;
}

const has = (perks: SkillPerk[], p: SkillPerk) => perks.includes(p);

/** Hard cap on active combat clones, enforced in the execution path. */
export const MAX_ACTIVE_CLONES = 2;

/** Per-level clone damage multiplier, controlled by skill data / balance config. */
const CLONE_LEVEL_DAMAGE_MUL: number[] = [1.0, 1.10, 1.20, 1.35, 1.60];

/** Deflect cooldown applied to the deflecting fighter after a successful deflect (ms). */
export const DEFLECT_COOLDOWN_MS = 800;

/* ------------------------------------------------------------ projectile */

class Projectile implements Entity {
  private g: Phaser.GameObjects.Graphics;
  private life: number;
  private trailPts: { x: number; y: number }[] = [];
  private hitSet = new Set<Fighter>();
  /** Prevents the same projectile being deflected more than once per collision. */
  private deflected = false;
  /** Set once the projectile has been consumed (deflected into a clone explosion). */
  private spent = false;

  constructor(
    private w: SkillWorld,
    public owner: Fighter,
    private def: SkillDef,
    private cfg: SkillLevel,
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    private homing: boolean,
    private radius: number,
    public damage: number,
    private gravity = 0,
  ) {
    this.g = w.scene.add.graphics().setDepth(28);
    this.life = homing ? Math.max(1200, cfg.duration) : 2200;
  }

  get isDeflected(): boolean { return this.deflected; }

  /** Collision radius used when checking projectile-vs-clone overlaps. */
  get hitRadius(): number { return this.radius + 4; }

  /** True once this projectile has been consumed and can never hit again. */
  get isSpent(): boolean { return this.spent; }

  /**
   * Consume the projectile: plays its impact visuals and marks it as spent.
   * Used when a hostile projectile destroys a clone — the projectile must not
   * continue on to hit other entities afterwards.
   */
  detonate(): void {
    if (this.spent) return;
    this.spent = true;
    // Reuse the standard impact path once (explosion + split handling).
    this.expire(true);
  }

  /**
   * Attempt to deflect this projectile by `deflector`.
   * Returns true if the deflection was valid and applied.
   */
  tryDeflect(deflector: Fighter): boolean {
    if (this.deflected) return false;
    if (this.owner === deflector) return false;
    if (deflector.defeated) return false;
    this.deflected = true;
    this.owner = deflector;
    // Reverse horizontal velocity toward the original attacker
    this.vx = -this.vx;
    // Clear hit set so the reflected projectile can hit the original owner
    this.hitSet.clear();
    // Prevent hitting the deflector immediately
    this.hitSet.add(deflector);
    return true;
  }

  update(dt: number): boolean {
    // Spent projectiles can never damage anything; they simply fall through
    // and are removed on the next executor sweep.
    if (this.spent) return false;
    const dtS = dt / 1000;
    this.life -= dt;
    // Homing only tracks when not deflected (deflected projectiles fly straight)
    const target = this.w.fighters.find((f) => f !== this.owner && !f.defeated);
    if (this.homing && !this.deflected && target && this.life > 400) {
      const seek = has(this.cfg.perks, 'seek') ? 7.5 : 4.2;
      const tx = target.x - this.x;
      const ty = target.centerY() - this.y;
      const len = Math.hypot(tx, ty) || 1;
      const speed = Math.hypot(this.vx, this.vy) || 1;
      this.vx += (tx / len) * speed * seek * dtS;
      this.vy += (ty / len) * speed * seek * dtS;
      const ns = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / ns) * speed;
      this.vy = (this.vy / ns) * speed;
    }
    this.vy += this.gravity * dtS;
    this.x += this.vx * dtS;
    this.y += this.vy * dtS;

    this.trailPts.push({ x: this.x, y: this.y });
    if (this.trailPts.length > 8) this.trailPts.shift();

    // category-specific rich procedural drawing
    const g = this.g;
    g.clear();
    const ang = Math.atan2(this.vy, this.vx);
    const cat = this.def.category;

    if (cat === 'fire') {
      // Flame teardrop / meteor
      g.fillStyle(this.def.color, 0.25);
      g.fillCircle(this.x, this.y, this.radius * 2.4);
      g.fillStyle(0xff7a2a, 0.85);
      g.fillEllipse(this.x, this.y, this.radius * 2.2, this.radius * 1.4);
      // Flame tail
      const tailX = this.x - Math.cos(ang) * this.radius * 1.8;
      const tailY = this.y - Math.sin(ang) * this.radius * 1.8;
      g.fillStyle(0xff3a1a, 0.7);
      g.fillTriangle(
        this.x + Math.sin(ang) * this.radius * 0.8, this.y - Math.cos(ang) * this.radius * 0.8,
        tailX, tailY,
        this.x - Math.sin(ang) * this.radius * 0.8, this.y + Math.cos(ang) * this.radius * 0.8,
      );
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(this.x + Math.cos(ang) * this.radius * 0.3, this.y + Math.sin(ang) * this.radius * 0.3, this.radius * 0.5);
    } else if (cat === 'lightning') {
      // Electrified javelin / jagged bolt
      g.lineStyle(this.radius * 0.8, this.def.color, 0.9);
      const jx1 = this.x - Math.cos(ang) * this.radius * 2.2;
      const jy1 = this.y - Math.sin(ang) * this.radius * 2.2;
      const jx2 = this.x + Math.cos(ang) * this.radius * 2.2;
      const jy2 = this.y + Math.sin(ang) * this.radius * 2.2;
      g.lineBetween(jx1, jy1, jx2, jy2);
      // Zigzag electric spurs
      const perp = ang + Math.PI / 2;
      g.lineStyle(1.6, 0xffffff, 0.95);
      g.beginPath();
      g.moveTo(jx1, jy1);
      g.lineTo((jx1 + jx2) / 2 + Math.cos(perp) * 6, (jy1 + jy2) / 2 + Math.sin(perp) * 6);
      g.lineTo(jx2, jy2);
      g.strokePath();
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(jx2, jy2, this.radius * 0.5);
    } else if (cat === 'ice') {
      // Faceted ice shard / crystal lance
      g.fillStyle(0x9fe8ff, 0.3);
      g.fillCircle(this.x, this.y, this.radius * 2);
      g.fillStyle(this.def.color, 0.9);
      const tipX = this.x + Math.cos(ang) * this.radius * 2.5;
      const tipY = this.y + Math.sin(ang) * this.radius * 2.5;
      const backX = this.x - Math.cos(ang) * this.radius * 1.5;
      const backY = this.y - Math.sin(ang) * this.radius * 1.5;
      const perp = ang + Math.PI / 2;
      g.fillTriangle(
        tipX, tipY,
        backX + Math.cos(perp) * this.radius, backY + Math.sin(perp) * this.radius,
        backX - Math.cos(perp) * this.radius, backY - Math.sin(perp) * this.radius,
      );
      g.lineStyle(1.4, 0xffffff, 0.95);
      g.lineBetween(backX, backY, tipX, tipY);
    } else if (cat === 'shadow' || cat === 'gravity') {
      // Void sphere with spinning accretion ring
      g.fillStyle(this.def.color, 0.25);
      g.fillCircle(this.x, this.y, this.radius * 2.3);
      g.lineStyle(2, this.def.color, 0.9);
      g.strokeEllipse(this.x, this.y, this.radius * 2.6, this.radius * 1.2);
      g.fillStyle(0x0a0515, 0.95);
      g.fillCircle(this.x, this.y, this.radius * 0.9);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(this.x, this.y, this.radius * 0.35);
    } else if (cat === 'wind') {
      // Curved vacuum gale crescent
      g.lineStyle(3, this.def.color, 0.9);
      g.beginPath();
      g.arc(this.x, this.y, this.radius * 1.8, ang - 1.2, ang + 1.2);
      g.strokePath();
      g.lineStyle(1.6, 0xffffff, 0.85);
      g.beginPath();
      g.arc(this.x + Math.cos(ang) * 3, this.y + Math.sin(ang) * 3, this.radius * 1.4, ang - 0.9, ang + 0.9);
      g.strokePath();
    } else {
      // Default radiant sphere
      g.fillStyle(this.def.color, 0.22);
      g.fillCircle(this.x, this.y, this.radius * 2.1);
      g.fillStyle(this.def.color, 0.85);
      g.fillCircle(this.x, this.y, this.radius);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(this.x, this.y, this.radius * 0.45);
    }

    // Trailing luminous wake
    if (this.trailPts.length > 2) {
      g.lineStyle(this.radius * 0.8, this.def.color, 0.45);
      g.beginPath();
      g.moveTo(this.trailPts[0].x, this.trailPts[0].y);
      for (const p of this.trailPts) g.lineTo(p.x, p.y);
      g.strokePath();
    }

    // collisions
    for (const f of this.w.fighters) {
      if (f === this.owner || f.defeated || this.hitSet.has(f)) continue;
      const hb = f.hurtbox;
      if (this.x > hb.x && this.x < hb.x + hb.w && this.y > hb.y && this.y < hb.y + hb.h) {
        this.hitSet.add(f);
        applyProjectileHit(this.w, this.owner, f, this.def, this.cfg, this.damage, this.x, this.y);
        if (!has(this.cfg.perks, 'pierce')) return this.expire(true);
      }
    }
    if (this.y >= this.w.floorY + 4 || this.x < this.w.bounds.left - 80 || this.x > this.w.bounds.right + 80 || this.life <= 0) {
      return this.expire(this.y >= this.w.floorY);
    }
    return true;
  }

  private expire(impact: boolean): boolean {
    if (impact) {
      this.w.effects.explosion(this.x, this.y, this.def.color, 26 + this.radius * 2);
      if (this.def.category === 'ice') {
        this.w.effects.burst(this.x, this.y, 0x9fe8ff, 12, 200);
      } else if (this.def.category === 'lightning') {
        this.w.effects.hitSpark(this.x, this.y, 0xffe066, 1.4);
      } else if (this.def.category === 'fire') {
        this.w.effects.burst(this.x, this.y, 0xff7a2a, 14, 220);
      } else if (this.def.category === 'shadow' || this.def.category === 'gravity') {
        this.w.effects.ring(this.x, this.y, 0xaa44ff, 38, 280, 3);
      }
      if (has(this.cfg.perks, 'split')) {
        for (let i = 0; i < 3; i++) {
          const ang = -Math.PI / 2 + (i - 1) * 0.6;
          this.w.scene.events.emit('ss-spawn', new Projectile(
            this.w, this.owner, this.def, { ...this.cfg, perks: this.cfg.perks.filter((p) => p !== 'split') },
            this.x, this.y, Math.cos(ang) * 320, Math.sin(ang) * 320, false,
            this.radius * 0.6, this.damage * 0.4, 500,
          ));
        }
      }
    }
    return false;
  }

  destroy(): void { this.g.destroy(); }
}

function applyProjectileHit(
  w: SkillWorld, owner: Fighter, target: Fighter, def: SkillDef, cfg: SkillLevel, damage: number, x: number, y: number,
) {
  const perks = cfg.perks;
  const dealt = w.dealDamage(owner, target, damage, {
    knockback: 140 + damage * 3,
    hitstun: 260,
    guardDamage: has(perks, 'guardbreak') ? 42 : 14,
    knockdown: has(perks, 'knockdown'),
    guardbreak: has(perks, 'guardbreak'),
    color: def.color,
    source: def.id,
  });
  w.effects.hitSpark(x, y, def.color, 1.2);
  applyPerkStatuses(w, owner, target, cfg, dealt);
}

export function applyPerkStatuses(_w: SkillWorld, owner: Fighter, target: Fighter, cfg: SkillLevel, dealt: number): void {
  const perks = cfg.perks;
  if (has(perks, 'burn')) { target.status.burn = Math.max(target.status.burn, 2600); target.burnDamage = Math.max(target.burnDamage, cfg.damage * 0.18); }
  if (has(perks, 'freeze')) target.status.chill = Math.max(target.status.chill, 2200);
  if (has(perks, 'slow')) target.status.slow = Math.max(target.status.slow, 2400);
  if (has(perks, 'shock')) target.status.shock = Math.max(target.status.shock, 1200);
  if (has(perks, 'stun') && dealt > 0) target.status.stun = Math.max(target.status.stun, 620);
  if (has(perks, 'lifesteal') && dealt > 0) owner.heal(dealt * 0.32);
  if (has(perks, 'shield')) owner.status.shield = Math.max(owner.status.shield, cfg.damage * 0.9 + 14);
  if (has(perks, 'haste')) owner.status.haste = Math.max(owner.status.haste, 2600);
  if (has(perks, 'armor')) owner.status.armor = Math.max(owner.status.armor, 1400);
  if (has(perks, 'vortex')) {
    const dir = Math.sign(owner.x - target.x) || 1;
    target.vx += dir * 320;
  }
  if (has(perks, 'refund') && dealt > 0) {
    for (const s of owner.skills) s.cooldown = Math.max(0, s.cooldown - 900);
  }
}

/* ------------------------------------------------------------------ beam */

class Beam implements Entity {
  private g: Phaser.GameObjects.Graphics;
  private time = 0;
  private tickAcc = 0;
  private dir: 1 | -1;
  constructor(
    private w: SkillWorld, private owner: Fighter, private def: SkillDef, private cfg: SkillLevel,
    private length: number, private thickness: number, private damagePerTick: number,
  ) {
    this.g = w.scene.add.graphics().setDepth(29);
    this.dir = owner.facing;
  }

  update(dt: number): boolean {
    this.time += dt;
    const dur = this.cfg.duration;
    if (this.time > dur) return false;
    const hand = this.owner.worldHand();
    const sweep = has(this.cfg.perks, 'bigger') ? Math.sin(this.time / dur * Math.PI) * 0.35 : 0;
    const ang = sweep * -this.dir;
    const x0 = hand.x, y0 = hand.y;
    const x1 = x0 + Math.cos(ang) * this.length * this.dir;
    const y1 = y0 + Math.sin(ang) * this.length;

    const warm = Math.min(1, this.time / 140);
    const fade = Math.min(1, (dur - this.time) / 160);
    const k = warm * fade;
    const g = this.g;
    g.clear();
    g.lineStyle(this.thickness * 2.6 * k, this.def.color, 0.22);
    g.lineBetween(x0, y0, x1, y1);
    g.lineStyle(this.thickness * k, this.def.color, 0.85);
    g.lineBetween(x0, y0, x1, y1);
    g.lineStyle(this.thickness * 0.35 * k, 0xffffff, 0.95);
    g.lineBetween(x0, y0, x1, y1);
    g.fillStyle(0xffffff, 0.8 * k);
    g.fillCircle(x0, y0, this.thickness * 0.7);

    // damage ticks only while visible
    this.tickAcc += dt;
    if (this.tickAcc >= 110 && k > 0.4) {
      this.tickAcc = 0;
      for (const f of this.w.fighters) {
        if (f === this.owner || f.defeated) continue;
        if (segmentHitsBox(x0, y0, x1, y1, f.hurtbox, this.thickness)) {
          const dealt = this.w.dealDamage(this.owner, f, this.damagePerTick, {
            knockback: 60, hitstun: 140,
            guardDamage: has(this.cfg.perks, 'guardbreak') ? 18 : 7,
            guardbreak: has(this.cfg.perks, 'guardbreak'),
            color: this.def.color, source: this.def.id,
          });
          applyPerkStatuses(this.w, this.owner, f, this.cfg, dealt);
          this.w.effects.hitSpark(f.x, f.centerY(), this.def.color, 0.6);
        }
      }
    }
    return true;
  }

  destroy(): void { this.g.destroy(); }
}

function segmentHitsBox(x0: number, y0: number, x1: number, y1: number, box: { x: number; y: number; w: number; h: number }, pad: number): boolean {
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (x > box.x - pad && x < box.x + box.w + pad && y > box.y - pad && y < box.y + box.h + pad) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ zone */

class Zone implements Entity {
  private g: Phaser.GameObjects.Graphics;
  private time = 0;
  private tickAcc = 0;
  constructor(
    private w: SkillWorld, private owner: Fighter, private def: SkillDef, private cfg: SkillLevel,
    private x: number, private y: number, private radius: number, private dps: number,
  ) {
    this.g = w.scene.add.graphics().setDepth(14);
  }

  update(dt: number): boolean {
    this.time += dt;
    if (this.time > this.cfg.duration) return false;
    const p = this.time / this.cfg.duration;
    const pulse = 0.65 + Math.sin(this.time / 110) * 0.2;
    const g = this.g;
    g.clear();
    g.fillStyle(this.def.color, 0.14 * pulse * (1 - p * 0.5));
    g.fillEllipse(this.x, this.y, this.radius * 2, this.radius * 1.2);
    g.lineStyle(2.5, this.def.color, 0.7 * (1 - p * 0.4));
    g.strokeEllipse(this.x, this.y, this.radius * 2, this.radius * 1.2);
    for (let i = 0; i < 5; i++) {
      const a = this.time / 300 + (i * Math.PI * 2) / 5;
      g.fillStyle(this.def.color, 0.65);
      g.fillCircle(this.x + Math.cos(a) * this.radius * 0.8, this.y + Math.sin(a * 1.4) * this.radius * 0.45 - (this.time / 20) % 30, 3);
    }

    this.tickAcc += dt;
    if (this.tickAcc >= 320) {
      this.tickAcc = 0;
      for (const f of this.w.fighters) {
        if (f === this.owner || f.defeated) continue;
        if (Math.abs(f.x - this.x) < this.radius && Math.abs(f.y - this.y) < this.radius * 1.4) {
          const dealt = this.w.dealDamage(this.owner, f, this.dps, {
            knockback: 30, hitstun: 90, guardDamage: 5, color: this.def.color, source: this.def.id,
          });
          applyPerkStatuses(this.w, this.owner, f, this.cfg, dealt);
        }
      }
    }
    return true;
  }

  destroy(): void { this.g.destroy(); }
}

/* ----------------------------------------------------------------- clone */

class Clone implements Entity {
  private g: Phaser.GameObjects.Graphics;
  private container: Phaser.GameObjects.Container;
  private life: number;
  private t = 0;
  private attackT = -1;
  private hitDone = false;
  private x: number; private y: number;
  private facing: 1 | -1 = 1;
  /** Set to true when a valid hostile hit destroys this clone. */
  private destroyed = false;

  get isActive(): boolean { return !this.destroyed && this.life > 0; }

  /** The fighter that summoned this clone — hostile attackers are everyone else. */
  get ownerFighter(): Fighter { return this.owner; }

  /** Accent colour of the summoning skill, used for the dissolve effect. */
  get accent(): number { return this.def.color; }

  get hurtbox(): { x: number; y: number; w: number; h: number } {
    return { x: this.x - 20, y: this.y - 112, w: 40, h: 112 };
  }

  /**
   * Called by CombatScene when a valid hostile hit lands on this clone.
   * Returns true if the clone was active and is now destroyed.
   */
  receiveHit(): boolean {
    if (!this.isActive) return false;
    this.destroyed = true;
    this.life = 0;
    return true;
  }
  constructor(
    private w: SkillWorld, private owner: Fighter, private def: SkillDef, private cfg: SkillLevel,
    offsetX: number, private damage: number, private explode: boolean,
  ) {
    this.x = owner.x + offsetX;
    this.y = owner.y;
    this.life = cfg.duration;
    this.g = w.scene.add.graphics();
    this.container = w.scene.add.container(this.x, this.y, [this.g]).setDepth(18).setAlpha(0.68);
    w.effects.ring(this.x, this.y - 50, def.color, 48, 320, 3);
  }

  update(dt: number): boolean {
    this.t += dt;
    this.life -= dt;
    if (this.destroyed || this.life <= 0) {
      this.w.effects.burst(this.x, this.y - 50, this.def.color, 14, 220);
      this.w.effects.ring(this.x, this.y - 50, this.def.color, 36, 260, 3);
      return false;
    }
    const target = this.w.fighters.find((f) => f !== this.owner && !f.defeated);
    const dtS = dt / 1000;
    let moving = false;
    if (target) {
      const dx = target.x - this.x;
      this.facing = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) > 70) {
        this.x += Math.sign(dx) * 330 * dtS;
        this.x = Phaser.Math.Clamp(this.x, this.w.bounds.left, this.w.bounds.right);
        moving = true;
      } else if (this.attackT < 0) {
        this.attackT = 0;
        this.hitDone = false;
      }
    }
    if (this.attackT >= 0) {
      this.attackT += dt;
      if (!this.hitDone && this.attackT > 130 && target) {
        this.hitDone = true;
        if (Math.abs(target.x - this.x) < 100) {
          if (this.explode) {
            this.w.effects.explosion(this.x, this.y - 50, this.def.color, 70);
            const dealt = this.w.dealDamage(this.owner, target, this.damage * 1.6, {
              knockback: 320, hitstun: 420, knockdown: true, guardDamage: 26, color: this.def.color, source: this.def.id,
            });
            applyPerkStatuses(this.w, this.owner, target, this.cfg, dealt);
            return false;
          }
          const dealt = this.w.dealDamage(this.owner, target, this.damage, {
            knockback: 140, hitstun: 240, guardDamage: 12, color: this.def.color, source: this.def.id,
          });
          applyPerkStatuses(this.w, this.owner, target, this.cfg, dealt);
          this.w.effects.hitSpark(target.x, target.centerY(), this.def.color, 0.8);
        }
      }
      if (this.attackT > 520) this.attackT = -1;
    }

    const ps = this.attackT >= 0
      ? attackPose('slash', this.attackT < 130 ? 'startup' : this.attackT < 260 ? 'active' : 'recovery',
        this.attackT < 130 ? this.attackT / 130 : this.attackT < 260 ? (this.attackT - 130) / 130 : (this.attackT - 260) / 260)
      : locomotionPose(moving ? 'run' : 'idle', this.t / 1000, 1);
    const sk = buildSkeleton(ps, this.owner.scale * 0.95);
    this.g.clear();
    drawFighter(this.g, sk, {
      body: this.def.color, eye: 0xffffff, outline: this.def.color,
      equipment: {}, scale: this.owner.scale * 0.95, alpha: 0.75,
    }, this.owner.weapon, 0);
    this.container.setPosition(this.x, this.y);
    this.container.scaleX = this.facing;
    this.container.setAlpha(0.45 + Math.sin(this.t / 160) * 0.12 + Math.min(0.2, this.life / 2000));
    return true;
  }

  destroy(): void { this.container.destroy(true); }
}

/* ---------------------------------------------------------------- summon */

class Summon implements Entity {
  private g: Phaser.GameObjects.Graphics;
  private life: number;
  private t = 0;
  private cd = 600;
  private x: number; private y: number;
  constructor(
    private w: SkillWorld, private owner: Fighter, private def: SkillDef, private cfg: SkillLevel,
    private damage: number, private shoots: boolean, private spawn: (e: Entity) => void,
  ) {
    this.x = owner.x - owner.facing * 50;
    this.y = owner.y - 40;
    this.life = cfg.duration;
    this.g = w.scene.add.graphics().setDepth(17);
    w.effects.ring(this.x, this.y, def.color, 60, 400, 4);
  }

  update(dt: number): boolean {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.w.effects.burst(this.x, this.y, this.def.color, 16, 240);
      return false;
    }
    const target = this.w.fighters.find((f) => f !== this.owner && !f.defeated);
    const dtS = dt / 1000;
    if (target) {
      const desired = this.shoots ? 260 : 60;
      const dx = target.x - this.x;
      if (Math.abs(dx) > desired) this.x += Math.sign(dx) * 190 * dtS;
      this.y += Math.sin(this.t / 300) * 22 * dtS;
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = this.shoots ? 900 : 760;
        if (this.shoots) {
          const ang = Math.atan2(target.centerY() - this.y, target.x - this.x);
          this.spawn(new Projectile(this.w, this.owner, this.def, this.cfg, this.x, this.y,
            Math.cos(ang) * 520, Math.sin(ang) * 520, false, 6, this.damage));
        } else if (Math.abs(dx) < 110) {
          const dealt = this.w.dealDamage(this.owner, target, this.damage, {
            knockback: 120, hitstun: 220, guardDamage: 10, color: this.def.color, source: this.def.id,
          });
          applyPerkStatuses(this.w, this.owner, target, this.cfg, dealt);
          this.w.effects.hitSpark(target.x, target.centerY(), this.def.color, 0.7);
        }
      }
    }

    const g = this.g;
    g.clear();
    const bob = Math.sin(this.t / 220) * 5;
    g.fillStyle(this.def.color, 0.18);
    g.fillCircle(this.x, this.y + bob, 30);
    g.fillStyle(this.def.color, 0.85);
    if (this.def.id.includes('wolf') || this.def.id.includes('reaper')) {
      g.fillEllipse(this.x, this.y + bob, 54, 24);
      g.fillTriangle(this.x + 22, this.y + bob - 12, this.x + 40, this.y + bob - 4, this.x + 20, this.y + bob + 6);
      g.fillRect(this.x - 24, this.y + bob + 8, 5, 16);
      g.fillRect(this.x + 12, this.y + bob + 8, 5, 16);
    } else if (this.def.id.includes('golem')) {
      g.fillRoundedRect(this.x - 20, this.y + bob - 26, 40, 52, 8);
      g.fillRect(this.x - 30, this.y + bob - 10, 10, 28);
      g.fillRect(this.x + 20, this.y + bob - 10, 10, 28);
    } else if (this.def.id.includes('dragon')) {
      g.fillEllipse(this.x, this.y + bob, 40, 20);
      g.fillTriangle(this.x - 6, this.y + bob - 6, this.x - 34, this.y + bob - 26, this.x - 4, this.y + bob + 4);
      g.fillTriangle(this.x + 16, this.y + bob - 6, this.x + 34, this.y + bob, this.x + 16, this.y + bob + 6);
    } else {
      g.fillCircle(this.x, this.y + bob, 15);
      g.lineStyle(2.5, this.def.color, 0.8);
      g.strokeCircle(this.x, this.y + bob, 24 + Math.sin(this.t / 180) * 3);
    }
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(this.x + 6, this.y + bob - 4, 3);
    return true;
  }

  destroy(): void { this.g.destroy(); }
}

/* ------------------------------------------------------------- executor */

export class SkillExecutor {
  private entities: Entity[] = [];
  constructor(private w: SkillWorld) {
    w.scene.events.on('ss-spawn', this.spawn, this);
  }

  spawn = (e: Entity) => { this.entities.push(e); };

  get activeCount(): number { return this.entities.length; }

  get activeCloneCount(): number {
    let n = 0;
    for (const e of this.entities) {
      if (e instanceof Clone) n++;
    }
    return n;
  }

  /** Returns all live Projectile instances (for deflection checks). */
  getProjectiles(): Projectile[] {
    return this.entities.filter((e): e is Projectile => e instanceof Projectile);
  }

  /** Returns all live Clone instances (for hit detection). */
  getClones(): Clone[] {
    return this.entities.filter((e): e is Clone => e instanceof Clone);
  }

  /**
   * Clone one-hit destruction, resolved centrally once per frame.
   *
   * A clone dies only when a VALID HOSTILE hit is confirmed:
   *  - friendly melee (the clone's own owner) never destroys it
   *  - friendly projectiles never destroy it
   *  - missed attacks simply never reach the overlap checks
   *  - each attacker swings at a given clone at most once (hitTargets dedupe)
   *  - a spent projectile cannot destroy a second clone after detonating
   *  - a destroyed clone stops attacking immediately (destroyed flag) and is
   *    removed from the entity list on the next update sweep, releasing its
   *    active-clone slot exactly once
   */
  resolveCloneHits(attackers: readonly Fighter[]): void {
    const clones = this.getClones().filter((cl) => cl.isActive);
    if (!clones.length) return;
    for (const clone of clones) {
      const hb = clone.hurtbox;
      // --- hostile melee hits
      for (const attacker of attackers) {
        if (attacker === clone.ownerFighter || attacker.defeated) continue;
        const ahb = attacker.getActiveHitbox();
        if (!ahb) continue;
        if (attacker.hitTargets.has(clone as unknown as object)) continue;
        if (!overlapsR(ahb, hb)) continue;
        attacker.hitTargets.add(clone as unknown as object);
        this.destroyClone(clone);
      }
      // --- hostile projectiles
      for (const proj of this.getProjectiles()) {
        if (proj.isSpent) continue;
        if (proj.owner === clone.ownerFighter) continue;
        const r = proj.hitRadius;
        if (proj.x < hb.x - r || proj.x > hb.x + hb.w + r || proj.y < hb.y - r || proj.y > hb.y + hb.h + r) continue;
        proj.detonate();
        this.destroyClone(clone);
      }
    }
  }

  /** Dissolve a destroyed clone once, with shadow-smoke + shatter feedback. */
  private destroyClone(clone: Clone): void {
    if (!clone.receiveHit()) return; // already destroyed this frame — no double processing
    const hb = clone.hurtbox;
    const cx = hb.x + hb.w / 2;
    const cy = hb.y + hb.h / 2;
    this.w.effects.burst(cx, cy, clone.accent, 16, 240);
    this.w.effects.ring(cx, cy, clone.accent, 40, 300, 3);
    this.w.effects.floatingText(cx, cy - 60, 'SHATTER', '#9a8aff');
    audio.play('explode');
  }

  update(dt: number): void {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      let alive = true;
      try { alive = this.entities[i].update(dt); } catch { alive = false; }
      if (!alive) {
        this.entities[i].destroy();
        this.entities.splice(i, 1);
      }
    }
    if (this.entities.length > 120) {
      const extra = this.entities.splice(0, this.entities.length - 120);
      for (const e of extra) e.destroy();
    }
  }

  clear(): void {
    for (const e of this.entities) e.destroy();
    this.entities = [];
  }

  destroy(): void {
    this.clear();
    this.w.scene.events.off('ss-spawn', this.spawn, this);
  }

  /** Executes a skill for the given fighter. Returns true if something happened. */
  cast(owner: Fighter, def: SkillDef, cfg: SkillLevel): boolean {
    const w = this.w;
    const perks = cfg.perks;
    const target = w.fighters.find((f) => f !== owner && !f.defeated);
    const dmgMul = owner.damageMul * (owner.status.damageBuff > 0 ? 1.25 : 1);
    const dmg = cfg.damage * dmgMul;
    const hand = owner.worldHand();
    const bigger = has(perks, 'bigger') ? 1.5 : 1;
    const echo = has(perks, 'echo');

    const doCast = (scale = 1) => {
      switch (def.kind) {
        case 'projectile':
        case 'homing': {
          const shots = has(perks, 'multishot') ? 3 : 1;
          for (let i = 0; i < shots; i++) {
            const spread = (i - (shots - 1) / 2) * 0.16;
            const base = owner.facing > 0 ? 0 : Math.PI;
            const ang = base + spread * owner.facing;
            const speed = def.speed || 600;
            this.entities.push(new Projectile(
              w, owner, def, cfg, hand.x, hand.y,
              Math.cos(ang) * speed, Math.sin(ang) * speed,
              def.kind === 'homing', (def.kind === 'homing' ? 11 : 8) * bigger,
              dmg * scale,
            ));
          }
          w.effects.burst(hand.x, hand.y, def.color, 8, 160);
          return true;
        }
        case 'beam': {
          this.entities.push(new Beam(w, owner, def, cfg, cfg.range * bigger, 11 * bigger, dmg * scale));
          w.effects.flashScreen(def.color, 0.12, 110);
          return true;
        }
        case 'aoe': {
          const r = cfg.range * bigger;
          w.effects.explosion(owner.x, owner.centerY(), def.color, r);
          w.effects.shake(0.012, 180);
          for (const f of w.fighters) {
            if (f === owner || f.defeated) continue;
            if (Math.abs(f.x - owner.x) < r && Math.abs(f.centerY() - owner.centerY()) < r * 1.2) {
              const dealt = w.dealDamage(owner, f, dmg * scale, {
                knockback: 300, launch: has(perks, 'knockdown') ? 220 : 90, hitstun: 380,
                guardDamage: 24, knockdown: has(perks, 'knockdown'), guardbreak: has(perks, 'guardbreak'),
                color: def.color, source: def.id,
              });
              applyPerkStatuses(w, owner, f, cfg, dealt);
            }
          }
          w.hitStop(70);
          return true;
        }
        case 'zone': {
          const zx = target ? (owner.x + target.x) / 2 : owner.x + owner.facing * 120;
          this.entities.push(new Zone(w, owner, def, cfg, zx, w.floorY - 40, (cfg.range / 3) * bigger, dmg * scale));
          return true;
        }
        case 'wave': {
          const speed = def.speed || 600;
          this.entities.push(new Projectile(w, owner, def, cfg, owner.x + owner.facing * 30, w.floorY - 26,
            owner.facing * speed, 0, false, 15 * bigger, dmg * scale));
          w.effects.ring(owner.x, w.floorY - 10, def.color, 40, 260, 3);
          return true;
        }
        case 'rain': {
          const count = has(perks, 'multishot') ? 7 : 4;
          const cx = target ? target.x : owner.x + owner.facing * 200;
          for (let i = 0; i < count; i++) {
            const px = cx + (i - count / 2) * 70 + Phaser.Math.Between(-20, 20);
            w.scene.time.delayedCall(i * 160, () => {
              w.effects.ring(px, w.floorY - 6, def.color, 34, 300, 2);
              this.entities.push(new Projectile(w, owner, def, cfg, px, -40, 0, def.speed || 600, false, 10 * bigger, dmg * scale, 400));
            });
          }
          return true;
        }
        case 'melee': {
          const r = cfg.range * bigger;
          const hx = owner.x + owner.facing * r * 0.8;
          w.effects.burst(hx, owner.centerY(), def.color, 18, 260);
          w.effects.ring(hx, owner.centerY(), def.color, r, 240, 4);
          for (const f of w.fighters) {
            if (f === owner || f.defeated) continue;
            if (Math.abs(f.x - hx) < r && Math.abs(f.centerY() - owner.centerY()) < 90) {
              const dealt = w.dealDamage(owner, f, dmg * scale, {
                knockback: 260, launch: has(perks, 'knockdown') ? 280 : 120, hitstun: 420,
                guardDamage: 30, knockdown: has(perks, 'knockdown'), guardbreak: has(perks, 'guardbreak'),
                color: def.color, source: def.id,
              });
              applyPerkStatuses(w, owner, f, cfg, dealt);
              w.hitStop(90);
            }
          }
          return true;
        }
        case 'dash': {
          const dist = cfg.range * 0.8;
          const from = owner.x;
          owner.x = Phaser.Math.Clamp(owner.x + owner.facing * dist, w.bounds.left, w.bounds.right);
          owner.vx = owner.facing * 160;
          if (has(perks, 'invuln')) owner.invuln = Math.max(owner.invuln, 320);
          if (has(perks, 'haste')) owner.status.haste = Math.max(owner.status.haste, 2600);
          w.effects.trail([{ x: from, y: owner.y - 50 }, { x: owner.x, y: owner.y - 50 }], def.color, 16, 260);
          w.effects.burst(from, owner.y - 50, def.color, 12, 200);
          if (dmg > 0) {
            for (const f of w.fighters) {
              if (f === owner || f.defeated) continue;
              const lo = Math.min(from, owner.x) - 30, hi = Math.max(from, owner.x) + 30;
              if (f.x > lo && f.x < hi) {
                const dealt = w.dealDamage(owner, f, dmg * scale, {
                  knockback: 220, hitstun: 300, guardDamage: 16,
                  knockdown: has(perks, 'knockdown'), guardbreak: has(perks, 'guardbreak'),
                  color: def.color, source: def.id,
                });
                applyPerkStatuses(w, owner, f, cfg, dealt);
              }
            }
          }
          if (has(perks, 'echo')) {
            w.effects.ring(from, owner.y - 50, def.color, 50, 400, 3);
          }
          return true;
        }
        case 'clone': {
          const baseCount = has(perks, 'multishot') ? 5 : def.id === 'ult_clone_army' ? 5 : def.id.includes('rush') ? 3 : 2;
          const activeClones = this.activeCloneCount;
          const remaining = MAX_ACTIVE_CLONES - activeClones;
          const count = Math.max(0, Math.min(baseCount, remaining));
          const cloneDamageMul = CLONE_LEVEL_DAMAGE_MUL[Math.min(5, Math.max(1, cfg.level)) - 1];
          for (let i = 0; i < count; i++) {
            this.entities.push(new Clone(w, owner, def, cfg, (i - count / 2) * 60 - owner.facing * 40,
              dmg * scale * cloneDamageMul, def.id.includes('bomb')));
          }
          if (count > 0) w.effects.burst(owner.x, owner.centerY(), def.color, 20, 260);
          return true;
        }
        case 'summon': {
          this.entities.push(new Summon(w, owner, def, cfg, dmg * scale,
            def.id.includes('sentry') || def.id.includes('dragon') || def.id.includes('raven'), this.spawn));
          if (has(perks, 'multishot')) {
            this.entities.push(new Summon(w, owner, def, cfg, dmg * 0.7 * scale,
              def.id.includes('sentry') || def.id.includes('dragon'), this.spawn));
          }
          return true;
        }
        case 'buff': {
          const dur = cfg.duration;
          owner.status.damageBuff = Math.max(owner.status.damageBuff, dur);
          if (has(perks, 'haste') || def.category === 'mobility' || def.category === 'wind') owner.status.haste = Math.max(owner.status.haste, dur);
          if (has(perks, 'shield') || def.category === 'defense') owner.status.shield = Math.max(owner.status.shield, 20 + cfg.damage + cfg.level * 6);
          if (has(perks, 'armor')) owner.status.armor = Math.max(owner.status.armor, dur);
          if (has(perks, 'invuln')) owner.invuln = Math.max(owner.invuln, 600);
          if (def.id === 'def_heal') owner.heal(14 + cfg.level * 5);
          if (def.id === 'def_cleanse') {
            owner.status.burn = 0; owner.status.chill = 0; owner.status.slow = 0; owner.status.shock = 0;
          }
          if (def.id === 'fire_buff') owner.status.burn = 0;
          owner.guard = Math.min(owner.maxGuard, owner.guard + 25);
          w.effects.ring(owner.x, owner.centerY(), def.color, 70, 420, 4);
          w.effects.burst(owner.x, owner.centerY(), def.color, 14, 180);
          return true;
        }
        case 'counter': {
          owner.invuln = Math.max(owner.invuln, Math.min(700, cfg.duration));
          owner.status.armor = Math.max(owner.status.armor, cfg.duration);
          owner.status.shield = Math.max(owner.status.shield, 18 + cfg.level * 5);
          w.effects.ring(owner.x, owner.centerY(), def.color, 56, 420, 5);
          // counter strike resolves if the opponent is close during the stance
          w.scene.time.delayedCall(Math.min(420, cfg.duration * 0.6), () => {
            if (owner.defeated || !target || target.defeated) return;
            if (Math.abs(target.x - owner.x) < 130) {
              const dealt = w.dealDamage(owner, target, dmg * scale, {
                knockback: 280, hitstun: 420, guardDamage: 30,
                guardbreak: has(perks, 'guardbreak'), color: def.color, source: def.id,
              });
              applyPerkStatuses(w, owner, target, cfg, dealt);
              w.effects.hitSpark(target.x, target.centerY(), def.color, 1.4);
              w.hitStop(90);
            }
          });
          return true;
        }
        case 'pull': {
          if (!target) return true;
          const pushAway = def.id.includes('push') || def.id.includes('repulsor');
          const dir = Math.sign(owner.x - target.x) || 1;
          const strength = 380 + cfg.damage * 6;
          target.vx = (pushAway ? -dir : dir) * strength;
          if (!pushAway) target.vy = Math.min(target.vy, -120);
          const dealt = w.dealDamage(owner, target, dmg * scale, {
            knockback: 0, hitstun: 300, guardDamage: 14,
            knockdown: has(perks, 'knockdown'), color: def.color, source: def.id,
          });
          applyPerkStatuses(w, owner, target, cfg, dealt);
          w.effects.ring(target.x, target.centerY(), def.color, 60 * bigger, 360, 4);
          return true;
        }
        case 'trap': {
          const tx = owner.x + owner.facing * 110;
          this.entities.push(new Zone(w, owner, { ...def, color: def.color }, { ...cfg, duration: cfg.duration },
            tx, w.floorY - 20, 42 * bigger, dmg * 0.5 * scale));
          w.effects.ring(tx, w.floorY - 10, def.color, 40, 400, 3);
          return true;
        }
        default:
          return false;
      }
    };

    const ok = doCast(1);
    if (ok && echo) {
      w.scene.time.delayedCall(420, () => { if (!owner.defeated) doCast(0.45); });
    }
    return ok;
  }
}

/** AABB overlap for hitboxes with arbitrary shapes (axes-aligned rectangles). */
function overlapsR(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
