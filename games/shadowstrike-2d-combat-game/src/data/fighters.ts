/** SHADOWSTRIKE — Opponent roster & AI profiles. */

export type AIStyle = 'aggressive' | 'defensive' | 'balanced' | 'ranged' | 'specialist' | 'boss';

export interface AITuning {
  /** 0..1 — how eagerly the AI closes distance and attacks */
  aggression: number;
  /** 0..1 — chance to raise guard when threatened */
  blockChance: number;
  /** 0..1 — chance to dodge a telegraphed attack */
  dodgeChance: number;
  /** 0..1 — chance to use a ready skill when in range */
  skillUse: number;
  /** preferred fighting distance in px */
  spacing: number;
  /** chance to continue a combo chain */
  comboChance: number;
  /** chance to feint / delay an attack (hard AI only) */
  feintChance: number;
}

export interface OpponentDef {
  id: string;
  name: string;
  title: string;
  style: AIStyle;
  description: string;
  weapon: string;
  skills: [string, string, string];
  maxHealth: number;
  bodyColor: number;
  eyeColor: number;
  auraColor: number;
  scale: number;
  rewardMul: number;
  unlockLevel: number;
  tuning: AITuning;
  equipment?: Partial<Record<string, string>>;
}

export const OPPONENTS: OpponentDef[] = [
  {
    id: 'kage', name: 'KAGE', title: 'The Apprentice', style: 'balanced',
    description: 'A disciplined student of the shadow arts. Mixes light combos with the occasional fireball.',
    weapon: 'shadow_katana', skills: ['fire_homing', 'mob_dash', 'def_guard'],
    maxHealth: 100, bodyColor: 0x14141c, eyeColor: 0x7fd4ff, auraColor: 0x4a6aff, scale: 1,
    rewardMul: 1, unlockLevel: 1,
    tuning: { aggression: 0.5, blockChance: 0.35, dodgeChance: 0.25, skillUse: 0.3, spacing: 110, comboChance: 0.5, feintChance: 0.05 },
  },
  {
    id: 'raze', name: 'RAZE', title: 'The Berserker', style: 'aggressive',
    description: 'Never retreats. Charges in with a greatsword and punishes hesitation.',
    weapon: 'inferno_greatsword', skills: ['fire_dash', 'fire_nova', 'def_taunt'],
    maxHealth: 115, bodyColor: 0x1c0f0c, eyeColor: 0xff5a2a, auraColor: 0xff5a1a, scale: 1.06,
    rewardMul: 1.2, unlockLevel: 1,
    tuning: { aggression: 0.9, blockChance: 0.15, dodgeChance: 0.15, skillUse: 0.35, spacing: 80, comboChance: 0.8, feintChance: 0.05 },
  },
  {
    id: 'bastion', name: 'BASTION', title: 'The Wall', style: 'defensive',
    description: 'Turtles behind an unbreakable guard and counters every mistake.',
    weapon: 'gravebreaker_maul', skills: ['def_parry', 'earth_armor', 'earth_slam'],
    maxHealth: 135, bodyColor: 0x181a20, eyeColor: 0xffc24a, auraColor: 0xffb34a, scale: 1.12,
    rewardMul: 1.3, unlockLevel: 3,
    tuning: { aggression: 0.25, blockChance: 0.8, dodgeChance: 0.2, skillUse: 0.4, spacing: 150, comboChance: 0.35, feintChance: 0.1 },
  },
  {
    id: 'volt', name: 'VOLT', title: 'The Stormcaller', style: 'ranged',
    description: 'Keeps you at arm\'s length and electrocutes anything that approaches.',
    weapon: 'spirit_chain', skills: ['volt_bolt', 'thunder_strike', 'lightning_dash'],
    maxHealth: 90, bodyColor: 0x121820, eyeColor: 0xffe066, auraColor: 0xffe066, scale: 0.98,
    rewardMul: 1.25, unlockLevel: 4,
    tuning: { aggression: 0.3, blockChance: 0.4, dodgeChance: 0.5, skillUse: 0.8, spacing: 300, comboChance: 0.3, feintChance: 0.1 },
  },
  {
    id: 'vesper', name: 'VESPER', title: 'The Duelist', style: 'specialist',
    description: 'A dagger virtuoso. Blink-fast strings and relentless whiff punishment.',
    weapon: 'phantom_daggers', skills: ['mob_blink', 'shadow_clone', 'ice_shard'],
    maxHealth: 88, bodyColor: 0x101418, eyeColor: 0x7cf0d0, auraColor: 0x7cf0d0, scale: 0.95,
    rewardMul: 1.35, unlockLevel: 6,
    tuning: { aggression: 0.75, blockChance: 0.3, dodgeChance: 0.65, skillUse: 0.45, spacing: 90, comboChance: 0.85, feintChance: 0.2 },
  },
  {
    id: 'glacius', name: 'GLACIUS', title: 'The Frozen Judge', style: 'specialist',
    description: 'Controls space with ice and punishes frozen targets with a shattering palm.',
    weapon: 'halberd_of_dusk', skills: ['ice_beam', 'frost_nova', 'ice_trap'],
    maxHealth: 110, bodyColor: 0x101c24, eyeColor: 0xbdf0ff, auraColor: 0x9fe8ff, scale: 1.04,
    rewardMul: 1.45, unlockLevel: 8,
    tuning: { aggression: 0.45, blockChance: 0.55, dodgeChance: 0.4, skillUse: 0.7, spacing: 200, comboChance: 0.5, feintChance: 0.2 },
  },
  {
    id: 'nyx', name: 'NYX', title: 'The Clone Weaver', style: 'specialist',
    description: 'Fills the arena with shadow duplicates and strikes from the confusion.',
    weapon: 'void_scythe', skills: ['shadow_clone_rush', 'shadow_grasp', 'shadow_step'],
    maxHealth: 105, bodyColor: 0x0d0a14, eyeColor: 0xc46bff, auraColor: 0x8a4aff, scale: 1.0,
    rewardMul: 1.5, unlockLevel: 11,
    tuning: { aggression: 0.6, blockChance: 0.45, dodgeChance: 0.5, skillUse: 0.75, spacing: 160, comboChance: 0.6, feintChance: 0.25 },
  },
  {
    id: 'tempest', name: 'TEMPEST', title: 'The Skydancer', style: 'aggressive',
    description: 'Fights mostly in the air. Dive-ins, air dashes, and cyclone launchers.',
    weapon: 'tempest_fans', skills: ['wind_dash', 'wind_uppercut', 'wind_slash'],
    maxHealth: 94, bodyColor: 0x0f1a18, eyeColor: 0xa8ffe8, auraColor: 0x66ffe0, scale: 0.97,
    rewardMul: 1.5, unlockLevel: 13,
    tuning: { aggression: 0.85, blockChance: 0.25, dodgeChance: 0.6, skillUse: 0.55, spacing: 100, comboChance: 0.8, feintChance: 0.25 },
  },
  {
    id: 'oblivion', name: 'OBLIVION', title: 'Shadow Sovereign', style: 'boss',
    description: 'The final shadow. Perfect spacing, ruthless punishes, and an arena-ending ultimate.',
    weapon: 'eclipse_odachi', skills: ['ult_omega_beam', 'shadow_clone_bomb', 'grav_pull'],
    maxHealth: 170, bodyColor: 0x05050a, eyeColor: 0xff2d55, auraColor: 0xb14bff, scale: 1.18,
    rewardMul: 2.2, unlockLevel: 16,
    tuning: { aggression: 0.7, blockChance: 0.6, dodgeChance: 0.6, skillUse: 0.7, spacing: 140, comboChance: 0.9, feintChance: 0.35 },
  },
];

export const OPPONENT_BY_ID: Record<string, OpponentDef> = Object.fromEntries(OPPONENTS.map((o) => [o.id, o]));

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyProfile {
  id: Difficulty;
  label: string;
  description: string;
  /** ms before the AI can react to a new player state */
  reactionMs: number;
  /** ms between AI decisions */
  decisionMs: number;
  /** multipliers applied on top of the opponent tuning */
  aggressionMul: number;
  defenseMul: number;
  skillMul: number;
  /** damage dealt by the AI */
  damageMul: number;
  rewardMul: number;
  /** extra recovery the AI adds after its own attacks (openings for the player) */
  openingMs: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    id: 'easy', label: 'Easy',
    description: 'Slow reactions, simple patterns, long openings after every attack.',
    reactionMs: 520, decisionMs: 460, aggressionMul: 0.6, defenseMul: 0.45, skillMul: 0.45,
    damageMul: 0.78, rewardMul: 0.7, openingMs: 420,
  },
  medium: {
    id: 'medium', label: 'Medium',
    description: 'Mixes light and heavy attacks, blocks obvious strings, punishes whiffs.',
    reactionMs: 300, decisionMs: 280, aggressionMul: 0.9, defenseMul: 0.85, skillMul: 0.85,
    damageMul: 1, rewardMul: 1, openingMs: 180,
  },
  hard: {
    id: 'hard', label: 'Hard',
    description: 'Spacing, feints, punishes and skill chains — skilled, not omniscient.',
    reactionMs: 165, decisionMs: 150, aggressionMul: 1.1, defenseMul: 1.15, skillMul: 1.15,
    damageMul: 1.14, rewardMul: 1.6, openingMs: 70,
  },
};
