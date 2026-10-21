/**
 * SHADOWSTRIKE — Boss AI controller.
 *
 * Drives a boss Fighter through a telegraphed, phase-based state machine using the
 * exact same FighterInput structure as a human player. Bosses obey identical
 * combat rules, cooldowns and recovery frames — they are not omniscient and they
 * are not relentless: every attack has a wind-up, an impact window and recovery.
 */

import type { Fighter, FighterInput } from '../entities/Fighter';
import { EMPTY_INPUT } from '../entities/Fighter';
import type { AttackDef } from '../../data/weapons';
import type { BossDef, BossAttackDef } from '../../data/bosses';
import type { DifficultyProfile } from '../../data/fighters';
import { Effects } from '../effects/Effects';

type BossState = 'idle' | 'approach' | 'telegraph' | 'execute' | 'recover' | 'stagger' | 'phaseTransition' | 'defeat';

interface Telegraph {
  active: boolean;
  x: number;
  y: number;
  r: number;
  color: number;
}

export class BossAIController {
  private state: BossState = 'phaseTransition';
  private stateTime = 0;
  private phaseIndex = 0;
  private attackCooldowns = new Map<string, number>();
  private telegraph: Telegraph = { active: false, x: 0, y: 0, r: 0, color: 0xffffff };
  private currentAttack?: BossAttackDef;
  private emitted = false;
  private staggerTimer = 0;
  private baseDamageMul: number;
  private rng: () => number;

  constructor(
    private self: Fighter,
    private foe: Fighter,
    private boss: BossDef,
    private diff: DifficultyProfile,
    private effects: Effects,
    seed = 777,
  ) {
    let s = seed >>> 0;
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
    this.baseDamageMul = diff.damageMul;
    for (const a of boss.attacks) this.attackCooldowns.set(a.id, 0);
  }

  /* ---------------------------------------------------------------- query */

  get stateName(): BossState { return this.state; }
  get phaseIndexRead(): number { return this.phaseIndex; }
  get phaseName(): string { return this.boss.phases[this.phaseIndex].name; }
  get telegraphActive(): boolean { return this.telegraph.active; }
  get telegraphX(): number { return this.telegraph.x; }
  get telegraphY(): number { return this.telegraph.y; }
  get telegraphRadius(): number { return this.telegraph.r; }
  get telegraphColor(): number { return this.telegraph.color; }

  private phase(): BossDef['phases'][number] { return this.boss.phases[this.phaseIndex]; }

  /* ------------------------------------------------------------- phase */

  private checkPhaseTransition(): boolean {
    const hp = this.self.health / this.self.maxHealth;
    for (let i = this.phaseIndex + 1; i < this.boss.phases.length; i++) {
      if (hp <= this.boss.phases[i].threshold) {
        this.phaseIndex = i;
        this.state = 'phaseTransition';
        this.stateTime = 0;
        this.emitted = false;
        this.telegraph.active = false;
        this.currentAttack = undefined;
        return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------- update */

  update(dt: number): FighterInput {
    const input: FighterInput = { ...EMPTY_INPUT, skillPressed: [false, false, false] };
    if (this.self.defeated) { this.state = 'defeat'; return input; }

    // reset per-frame damage multiplier unless we are mid skill-cast execute
    if (this.state !== 'execute') {
      this.self.damageMul = this.baseDamageMul;
    }
    this.stateTime += dt;
    this.staggerTimer = Math.max(0, this.staggerTimer - dt);

    for (const [id, cd] of this.attackCooldowns) {
      this.attackCooldowns.set(id, Math.max(0, cd - dt));
    }

    if (this.state !== 'phaseTransition' && this.state !== 'defeat') {
      this.checkPhaseTransition();
    }

    const d = this.diff;
    const p = this.phase();
    const dist = Math.abs(this.foe.x - this.self.x);
    const dir = this.foe.x >= this.self.x ? 1 : -1;

    // face the player unless committed to an attack animation
    if (!this.self.isBusy && this.state !== 'telegraph' && this.state !== 'execute') {
      if (dir !== this.self.facing) this.self.facing = dir;
    }

    // ------------------------------------------------------------- state machine
    switch (this.state) {
      case 'phaseTransition': {
        if (this.stateTime > 1400) {
          this.state = 'idle';
          this.stateTime = 0;
          this.emitted = false;
        }
        return input;
      }
      case 'defeat':
        return input;
      case 'stagger': {
        if (this.staggerTimer <= 0) { this.state = 'idle'; this.stateTime = 0; }
        return input;
      }
      case 'recover': {
        const recoverMs = (this.currentAttack?.cooldown ?? 1400) * 0.45 * p.attackSpeedMul;
        if (this.stateTime >= recoverMs) {
          this.state = 'idle';
          this.stateTime = 0;
          this.currentAttack = undefined;
          this.self.damageMul = this.baseDamageMul;
        }
        return input;
      }
      case 'telegraph': {
        // plant feet during the wind-up; the ground marker warns the player
        if (this.stateTime >= this.currentAttack!.windUp) {
          this.state = 'execute';
          this.stateTime = 0;
          this.emitted = false;
          this.telegraph.active = false;
        }
        return input;
      }
      case 'execute': {
        if (!this.emitted) {
          this.triggerAttack();
          this.emitted = true;
        }
        if (this.stateTime > 240) {
          this.state = 'recover';
          this.stateTime = 0;
        }
        return input;
      }
      case 'idle': {
        const reach = this.self.weapon.combo[0].reach * this.self.scale + 30;
        if (dist > reach * 1.15) {
          this.state = 'approach';
          this.stateTime = 0;
          return this.moveInput(dir);
        }
        const ready = this.boss.attacks.filter((a) => (this.attackCooldowns.get(a.id) ?? 0) <= 0);
        const viable = ready.filter((a) => {
          if (a.type === 'skill' && a.skillId) {
            const sk = this.self.skills[a.skillSlot ?? 0];
            if (!sk || sk.cooldown > 0) return false;
          }
          return true;
        });
        if (viable.length && this.rng() < p.aggression * d.aggressionMul) {
          this.currentAttack = viable[Math.floor(this.rng() * viable.length)];
          this.attackCooldowns.set(this.currentAttack.id, this.currentAttack.cooldown * p.attackSpeedMul);
          const atk = this.currentAttack;
          this.telegraph.active = true;
          this.telegraph.x = this.foe.x;
          this.telegraph.y = this.foe.y;
          this.telegraph.r = atk.groundMarker ? Math.max(40, (atk.range ?? 100) * 0.85) : 26;
          this.telegraph.color = atk.telegraphColor;
          this.effects.ring(this.telegraph.x, this.telegraph.y, atk.telegraphColor, this.telegraph.r, atk.windUp, 3);
          this.state = 'telegraph';
          this.stateTime = 0;
          return input;
        }
        return input;
      }
      case 'approach': {
        if (dist <= 150 || this.stateTime > 2200) { this.state = 'idle'; this.stateTime = 0; }
        return this.moveInput(dir);
      }
      default:
        return input;
    }
  }

  /* ------------------------------------------------------------- helpers */

  private moveInput(dir: 1 | -1): FighterInput {
    const input: FighterInput = { ...EMPTY_INPUT, skillPressed: [false, false, false] };
    if (dir > 0) input.right = true; else input.left = true;
    return input;
  }

  private triggerAttack(): void {
    const self = this.self;
    const atk = this.currentAttack!;
    self.facing = this.foe.x >= self.x ? 1 : -1;

    if (atk.type === 'weapon' && atk.weaponArc) {
      self.attackPowerMul = atk.damageMul;
      self.startAttack(this.buildWeaponAttack(atk), false, 1);
    } else if (atk.type === 'skill' && atk.skillId) {
      const slot = atk.skillSlot ?? 0;
      const sk = self.skills[slot];
      if (sk && sk.cooldown <= 0) {
        self.damageMul = this.baseDamageMul * atk.damageMul;
        self.startCast(slot, sk);
      }
    }
  }

  private buildWeaponAttack(atk: BossAttackDef): AttackDef {
    const base = this.self.weapon.combo[0];
    return {
      id: atk.id,
      name: atk.name,
      startup: Math.max(40, atk.windUp * 0.25),
      active: 110,
      recovery: Math.max(260, atk.cooldown * 0.3),
      damage: base.damage * atk.damageMul,
      reach: atk.range,
      hitW: 72 * (this.self.scale / 2),
      hitH: 84 * (this.self.scale / 2),
      hitY: 56,
      knockback: atk.knockback,
      launch: atk.launch,
      guardDamage: atk.guardDamage,
      hitstun: 320,
      lunge: 44,
      arc: atk.weaponArc,
      cancelWindow: 0,
    } as AttackDef;
  }

  /** Call from CombatScene when the boss takes heavy damage to trigger a stagger. */
  onHit(damage: number): void {
    if (damage >= 28 && this.staggerTimer <= 0 && this.state !== 'defeat') {
      this.staggerTimer = 700;
      this.state = 'stagger';
      this.stateTime = 0;
      this.emitted = false;
      this.telegraph.active = false;
    }
  }
}
