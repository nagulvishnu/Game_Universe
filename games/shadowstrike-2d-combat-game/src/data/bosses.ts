/**
 * SHADOWSTRIKE — Boss encounter definitions.
 *
 * Pure data: every boss is a Fighter under the hood, driven by BossAIController.
 * No 3D, no ragdoll — bosses are true 2D side-view combat entities scaled up
 * and given bespoke, telegraphed attack patterns.
 */

import type { Difficulty } from './fighters';
import type { SwingArc } from './weapons';

export interface BossPhaseDef {
  /** Health fraction (0-1) at or below which this phase becomes active. */
  threshold: number;
  name: string;
  /** Multiplier applied to the boss's attack cooldown speed (<1 = faster). */
  attackSpeedMul: number;
  /** Multiplier applied to movement speed. */
  moveSpeedMul: number;
  /** How eagerly the boss commits to attacks. */
  aggression: number;
}

export interface BossAttackDef {
  id: string;
  name: string;
  /** 'weapon' triggers a Fighter melee swing; 'skill' casts an equipped skill. */
  type: 'weapon' | 'skill';
  /** Weapon swing arc (only when type === 'weapon'). */
  weaponArc?: SwingArc;
  /** Skill id (only when type === 'skill'). Must be in boss.skills. */
  skillId?: string;
  /** Slot index for a skill attack. */
  skillSlot?: number;
  /** Attack reach in px (weapon attacks) or skill radius. */
  range: number;
  /** Minimum ms between uses of this attack. */
  cooldown: number;
  /** Telegraph/wind-up ms before the hit lands. Players can react in this window. */
  windUp: number;
  /** Damage multiplier applied to the base attack/skill damage. */
  damageMul: number;
  /** Knockback applied on hit. */
  knockback: number;
  /** Launch (vertical knockback) applied on hit. */
  launch: number;
  /** Guard damage applied on hit. */
  guardDamage: number;
  /** Colour of the telegraph / ground marker. */
  telegraphColor: number;
  /** Show a pulsing ground marker at the target location during wind-up. */
  groundMarker: boolean;
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  description: string;
  weapon: string;
  skills: [string, string, string];
  maxHealth: number;
  bodyColor: number;
  eyeColor: number;
  auraColor: number;
  /** Visual scale: 1.8–2.5 × a normal fighter. */
  scale: number;
  /** Hurtbox / collision size multiplier. */
  hurtboxMul: number;
  rewardXp: number;
  rewardShards: number;
  unlockLevel: number;
  recommendedDifficulty: Difficulty;
  phases: BossPhaseDef[];
  attacks: BossAttackDef[];
  introText: string;
  victoryText: string;
}

function boss(
  base: Omit<BossDef, 'phases' | 'attacks'> & {
    phases: BossPhaseDef[];
    attacks: BossAttackDef[];
  },
): BossDef {
  return { ...base };
}

/* ------------------------------------------------------------------ BOSS 1 */

export const BOSS_IRON_TYRANT: BossDef = boss({
  id: 'iron_tyrant',
  name: 'IRON TYRANT',
  title: 'The Armored Colossus',
  description:
    'A massive armored warrior wielding an enormous greatsword. Slow, devastating slams and ground shockwaves. Clear wind-ups precede every high-damage attack.',
  weapon: 'inferno_greatsword',
  skills: ['fire_nova', 'earth_slam', 'def_guard'],
  maxHealth: 320,
  bodyColor: 0x161014,
  eyeColor: 0xff5a2a,
  auraColor: 0xff6a1a,
  scale: 2.2,
  hurtboxMul: 1.35,
  rewardXp: 500,
  rewardShards: 750,
  unlockLevel: 12,
  recommendedDifficulty: 'medium',
  phases: [
    { threshold: 1.0, name: 'Iron Guard', attackSpeedMul: 1.0, moveSpeedMul: 0.85, aggression: 0.55 },
    { threshold: 0.5, name: 'Enraged', attackSpeedMul: 0.78, moveSpeedMul: 1.0, aggression: 0.75 },
  ],
  attacks: [
    {
      id: 'overhead_slam', name: 'Overhead Slam', type: 'weapon', weaponArc: 'overhead',
      cooldown: 3000, windUp: 700, damageMul: 1.6, range: 110, knockback: 260, launch: 260, guardDamage: 34,
      telegraphColor: 0xff6a1a, groundMarker: true,
    },
    {
      id: 'ground_shockwave', name: 'Ground Shockwave', type: 'skill', skillId: 'earth_slam', skillSlot: 2,
      cooldown: 5000, windUp: 600, damageMul: 1.1, range: 220, knockback: 200, launch: 120, guardDamage: 22,
      telegraphColor: 0xc0a070, groundMarker: true,
    },
    {
      id: 'sweeping_cleave', name: 'Sweeping Cleave', type: 'weapon', weaponArc: 'sweep',
      cooldown: 2400, windUp: 500, damageMul: 1.15, range: 120, knockback: 180, launch: 90, guardDamage: 24,
      telegraphColor: 0xff6a1a, groundMarker: true,
    },
  ],
  introText: 'The Iron Tyrant rises — his greatsword drains the light from the arena.',
  victoryText: 'The Iron Tyrant falls. His colossal armor shatters.',
});

/* ------------------------------------------------------------------ BOSS 2 */

export const BOSS_VOID_REAPER: BossDef = boss({
  id: 'void_reaper',
  name: 'VOID REAPER',
  title: 'The Shadow Assassin',
  description:
    'A towering shadow assassin with a giant scythe. Long-range sweeps, shadow projectiles and short teleport strikes. Every dangerous attack is telegraphed.',
  weapon: 'void_scythe',
  skills: ['shadow_step', 'shadow_bolt', 'shadow_clone'],
  maxHealth: 280,
  bodyColor: 0x0a0814,
  eyeColor: 0xc46bff,
  auraColor: 0x8a4aff,
  scale: 2.0,
  hurtboxMul: 1.25,
  rewardXp: 460,
  rewardShards: 700,
  unlockLevel: 14,
  recommendedDifficulty: 'medium',
  phases: [
    { threshold: 1.0, name: 'Reaper Stance', attackSpeedMul: 1.0, moveSpeedMul: 0.9, aggression: 0.6 },
    { threshold: 0.45, name: 'Void Shift', attackSpeedMul: 0.82, moveSpeedMul: 1.15, aggression: 0.8 },
  ],
  attacks: [
    {
      id: 'scythe_sweep', name: 'Scythe Sweep', type: 'weapon', weaponArc: 'sweep',
      cooldown: 2600, windUp: 550, damageMul: 1.3, range: 130, knockback: 220, launch: 140, guardDamage: 28,
      telegraphColor: 0xb14bff, groundMarker: true,
    },
    {
      id: 'shadow_bolt_barrage', name: 'Shadow Bolt Barrage', type: 'skill', skillId: 'shadow_bolt', skillSlot: 1,
      cooldown: 4000, windUp: 450, damageMul: 1.0, range: 560, knockback: 120, launch: 60, guardDamage: 14,
      telegraphColor: 0x7a3aff, groundMarker: false,
    },
    {
      id: 'teleport_strike', name: 'Teleport Strike', type: 'skill', skillId: 'shadow_step', skillSlot: 0,
      cooldown: 3600, windUp: 400, damageMul: 1.4, range: 60, knockback: 240, launch: 120, guardDamage: 30,
      telegraphColor: 0x6a2aff, groundMarker: true,
    },
  ],
  introText: 'The Void Reaper steps from the darkness — his scythe hungers.',
  victoryText: 'The Void Reaper dissolves into shadow. The scythe falls silent.',
});

/* ------------------------------------------------------------------ BOSS 3 */

export const BOSS_TEMPEST_OVERLORD: BossDef = boss({
  id: 'tempest_overlord',
  name: 'TEMPEST OVERLORD',
  title: 'The Storm Warmaster',
  description:
    'A giant storm warrior wielding a heavy polearm. Charged lightning thrusts, sweeping area attacks and thunderous slams. Rewards movement, dodging and timing.',
  weapon: 'storm_spear',
  skills: ['thunder_strike', 'wind_wave', 'volt_bolt'],
  maxHealth: 300,
  bodyColor: 0x0c1824,
  eyeColor: 0xffe066,
  auraColor: 0xffe066,
  scale: 2.1,
  hurtboxMul: 1.3,
  rewardXp: 480,
  rewardShards: 720,
  unlockLevel: 16,
  recommendedDifficulty: 'hard',
  phases: [
    { threshold: 1.0, name: 'Storm Front', attackSpeedMul: 1.0, moveSpeedMul: 0.88, aggression: 0.58 },
    { threshold: 0.5, name: 'Tempest Unleashed', attackSpeedMul: 0.8, moveSpeedMul: 1.05, aggression: 0.78 },
  ],
  attacks: [
    {
      id: 'charged_thrust', name: 'Charged Thrust', type: 'weapon', weaponArc: 'thrust',
      cooldown: 2800, windUp: 650, damageMul: 1.5, range: 140, knockback: 240, launch: 180, guardDamage: 32,
      telegraphColor: 0x66e0ff, groundMarker: true,
    },
    {
      id: 'lightning_strike', name: 'Lightning Strike', type: 'skill', skillId: 'thunder_strike', skillSlot: 0,
      cooldown: 4200, windUp: 500, damageMul: 1.05, range: 420, knockback: 160, launch: 140, guardDamage: 20,
      telegraphColor: 0xffe066, groundMarker: true,
    },
    {
      id: 'storm_wave', name: 'Storm Wave', type: 'skill', skillId: 'wind_wave', skillSlot: 2,
      cooldown: 5200, windUp: 550, damageMul: 1.0, range: 620, knockback: 190, launch: 100, guardDamage: 24,
      telegraphColor: 0xa8ffe8, groundMarker: true,
    },
  ],
  introText: 'The Tempest Overlord calls the storm — lightning splits the sky.',
  victoryText: 'The Tempest Overlord collapses. The storm breaks.',
});

export const BOSSES: BossDef[] = [BOSS_IRON_TYRANT, BOSS_VOID_REAPER, BOSS_TEMPEST_OVERLORD];

export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

export function getBoss(id: string): BossDef | undefined {
  return BOSS_BY_ID[id];
}

export function isBoss(opponentId: string): boolean {
  return !!BOSS_BY_ID[opponentId];
}
