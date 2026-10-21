/**
 * SHADOWSTRIKE — opponent AI.
 *
 * Behaviour-driven state machine with difficulty-scaled reaction windows.
 * The AI drives the exact same FighterInput structure as a human player, so it
 * obeys identical combat rules, cooldowns and recovery frames.
 */

import type { Fighter, FighterInput } from '../entities/Fighter';
import { EMPTY_INPUT } from '../entities/Fighter';
import type { AITuning, DifficultyProfile } from '../../data/fighters';

type Action = 'idle' | 'approach' | 'retreat' | 'attack' | 'charge' | 'block' | 'dodge' | 'skill' | 'jump' | 'reposition';

interface Snapshot {
  t: number;
  x: number;
  state: string;
  attacking: boolean;
  charging: boolean;
  startupLeft: number;
}

export class AIController {
  private action: Action = 'idle';
  private actionTime = 0;
  private decisionTimer = 0;
  private holdTime = 0;
  private skillSlot = -1;
  private emitted = false;
  private history: Snapshot[] = [];
  private time = 0;
  private recentPlayerAttacks: number[] = [];
  private openingTimer = 0;
  private rng: () => number;

  /**
   * Optional probe the scene injects so the AI can perceive nearby hostile
   * clones. Returns the nearest clone position hostile to this fighter, or
   * null when no clone is on the field.
   */
  private cloneProbe: (() => { x: number } | null) | null = null;
  /** X coordinate the AI is currently engaging (player by default). */
  private targetX: number | null = null;

  constructor(
    private self: Fighter,
    private foe: Fighter,
    private tuning: AITuning,
    private diff: DifficultyProfile,
    seed = 1337,
  ) {
    let s = seed >>> 0;
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  setOpponent(f: Fighter) { this.foe = f; }

  /** Let the scene feed nearby hostile clone positions to the AI. */
  setCloneProbe(fn: () => { x: number } | null) { this.cloneProbe = fn; }

  /**
   * Clone target selection: switch to a nearby hostile clone some of the time.
   * The player always remains the PRIMARY target — clones are only engaged
   * when they are close-ish, never exclusively.
   */
  private pickCloneTarget(): number | null {
    const probe = this.cloneProbe?.() ?? null;
    if (!probe) return null;
    const self = this.self;
    const cloneDist = Math.abs(probe.x - self.x);
    const foeDist = Math.abs(this.foe.x - self.x);
    if (cloneDist > foeDist * 1.6) return null; // never chase far-away clones
    if (this.rng() >= 0.35) return null; // ~35% of decisions engage the clone
    return probe.x;
  }

  private snapshotFoe(): Snapshot {
    const a = this.foe.attack;
    const startupLeft = a ? Math.max(0, a.startup - this.foe.attackElapsed) : 0;
    return {
      t: this.time,
      x: this.foe.x,
      state: this.foe.state,
      attacking: this.foe.state === 'attack',
      charging: this.foe.charging,
      startupLeft,
    };
  }

  /** The AI only "sees" the opponent as they were reactionMs ago. */
  private perceived(): Snapshot {
    const cutoff = this.time - this.diff.reactionMs;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].t <= cutoff) return this.history[i];
    }
    return this.history[0] ?? this.snapshotFoe();
  }

  update(dt: number): FighterInput {
    this.time += dt;
    this.actionTime += dt;
    this.decisionTimer -= dt;
    this.openingTimer = Math.max(0, this.openingTimer - dt);

    this.history.push(this.snapshotFoe());
    if (this.history.length > 90) this.history.shift();

    if (this.foe.state === 'attack' && this.recentPlayerAttacks[this.recentPlayerAttacks.length - 1] !== this.foe.attackElapsed) {
      if (this.foe.attackElapsed < 40) {
        this.recentPlayerAttacks.push(this.time);
        if (this.recentPlayerAttacks.length > 6) this.recentPlayerAttacks.shift();
      }
    }

    if (this.decisionTimer <= 0) this.decide();

    return this.toInput(dt);
  }

  private decide(): void {
    const t = this.tuning;
    const d = this.diff;
    const self = this.self;
    const foe = this.foe;
    const seen = this.perceived();
    const dist = Math.abs(foe.x - self.x);
    const reach = self.weapon.combo[0].reach * self.scale + 26;
    const r = this.rng();

    this.decisionTimer = d.decisionMs * (0.75 + this.rng() * 0.5);
    this.actionTime = 0;
    this.emitted = false;
    this.skillSlot = -1;
    this.holdTime = 0;
    this.targetX = null;

    if (self.defeated || foe.defeated) { this.action = 'idle'; return; }
    if (this.openingTimer > 0) { this.action = dist < reach * 0.7 ? 'retreat' : 'idle'; return; }

    // Defensive reactions always track the PLAYER (clones are distractions)
    const lowHealth = self.health / self.maxHealth < 0.35;
    const threatened = seen.attacking && dist < reach * 1.5;
    const canPunish = (seen.state === 'attack' && seen.startupLeft <= 0) || seen.state === 'hit' || seen.state === 'knockdown';

    // --- clone target selection for offense / spacing
    const cloneX = this.pickCloneTarget();
    const aimX = cloneX ?? foe.x;
    const aimDist = Math.abs(aimX - self.x);

    // --- defensive reactions
    if (threatened) {
      if (r < t.dodgeChance * d.defenseMul && self.dashCooldown <= 0) { this.action = 'dodge'; return; }
      if (r < (t.dodgeChance + t.blockChance) * d.defenseMul) { this.action = 'block'; this.holdTime = 320 + this.rng() * 260; return; }
    }
    if (lowHealth && r < 0.22 * d.defenseMul) {
      const healSlot = self.skills.findIndex((s) => s.cooldown <= 0 && (s.def.category === 'defense' || s.def.id === 'def_heal'));
      if (healSlot >= 0) { this.action = 'skill'; this.skillSlot = healSlot; return; }
    }

    // --- skills
    const readySlots = self.skills
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.cooldown <= 0);
    if (readySlots.length && r < t.skillUse * d.skillMul) {
      const viable = readySlots.filter(({ s }) => {
        const k = s.def.kind;
        if (k === 'melee' || k === 'aoe' || k === 'counter' || k === 'pull') return dist < 200;
        if (k === 'buff') return true;
        if (k === 'dash') return dist > 140 || this.rng() < 0.3;
        return dist > 90;
      });
      const pick = viable.length ? viable[Math.floor(this.rng() * viable.length)] : null;
      if (pick) { this.action = 'skill'; this.skillSlot = pick.i; return; }
    }

    // --- offense
    if (aimDist <= reach) {
      if (canPunish || r < t.aggression * d.aggressionMul) {
        // heavy/charged mix-up
        if (r < 0.18 + (d.id === 'hard' ? 0.12 : 0)) {
          this.action = 'charge';
          this.holdTime = self.weapon.chargeTime + 120 + this.rng() * 300;
          return;
        }
        if (d.id === 'hard' && this.rng() < t.feintChance) {
          this.action = 'reposition';
          this.holdTime = 180;
          return;
        }
        this.action = 'attack';
        return;
      }
      this.action = this.rng() < 0.4 ? 'retreat' : 'block';
      this.holdTime = 280;
      return;
    }

    // --- spacing
    const want = t.spacing;
    if (aimDist > want * 1.25) {
      this.action = 'approach';
      if (this.rng() < 0.12 && self.dashCooldown <= 0) this.action = 'dodge';
    } else if (aimDist < want * 0.7) {
      this.action = r < t.aggression * d.aggressionMul ? 'approach' : 'retreat';
    } else {
      this.action = r < t.aggression * d.aggressionMul * 0.8 ? 'approach' : 'idle';
    }
    if (this.rng() < 0.07) this.action = 'jump';
  }

  private toInput(_dt: number): FighterInput {
    const input: FighterInput = { ...EMPTY_INPUT, skillPressed: [false, false, false] };
    const self = this.self;
    const foe = this.foe;
    // Movement/facing follows the engaged target (player or engaged clone).
    const aimX = this.targetX ?? foe.x;
    const dir: 1 | -1 = aimX >= self.x ? 1 : -1;

    switch (this.action) {
      case 'approach':
        if (dir > 0) input.right = true; else input.left = true;
        break;
      case 'retreat':
        if (dir > 0) input.left = true; else input.right = true;
        break;
      case 'reposition':
        if (this.actionTime < this.holdTime / 2) { if (dir > 0) input.left = true; else input.right = true; }
        else { if (dir > 0) input.right = true; else input.left = true; }
        break;
      case 'block':
        input.block = this.actionTime < this.holdTime;
        break;
      case 'dodge':
        if (!this.emitted) { input.dodgePressed = true; this.emitted = true; }
        if (foe.x > self.x) input.left = true; else input.right = true;
        break;
      case 'jump':
        if (!this.emitted) { input.jumpPressed = true; this.emitted = true; }
        if (dir > 0) input.right = true; else input.left = true;
        break;
      case 'attack':
        if (!this.emitted) {
          input.attackPressed = true;
          input.attackHeld = true;
          this.emitted = true;
          this.openingTimer = this.diff.openingMs;
        } else if (this.actionTime < 60) {
          input.attackHeld = true;
        } else {
          input.attackReleased = true;
        }
        break;
      case 'charge':
        if (!this.emitted) { input.attackPressed = true; input.attackHeld = true; this.emitted = true; }
        else if (this.actionTime < this.holdTime) { input.attackHeld = true; }
        else {
          input.attackReleased = true;
          this.openingTimer = this.diff.openingMs + 120;
          this.action = 'idle';
        }
        break;
      case 'skill':
        if (!this.emitted && this.skillSlot >= 0) {
          input.skillPressed[this.skillSlot] = true;
          this.emitted = true;
          this.openingTimer = this.diff.openingMs * 0.5;
        }
        break;
      default:
        break;
    }
    return input;
  }
}
