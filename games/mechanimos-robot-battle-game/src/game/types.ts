// ---------- shared types ----------

export type CardId = 'ram' | 'punch' | 'flame' | 'volt' | 'aegis' | 'nanite';

export type SpeciesId = 'blaze' | 'voltox' | 'terradon' | 'nimbra' | 'ferrion' | 'aquella';

export interface CardDef {
  id: CardId;
  name: string;
  kind: 'attack' | 'defense' | 'heal';
  power: number;
  desc: string;
  tag: string; // short stat line
  color: string; // hex
  glow: string; // rgba
}

export type TraitId = 'fury' | 'static' | 'plating' | 'phase' | 'crit' | 'regen';

export type CrestId = 'fin' | 'horns' | 'disc' | 'spike' | 'blade' | 'rings';

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  sub: string; // flavour role
  body: string;
  dark: string;
  accent: string;
  glass: string;
  hp: number;
  atk: number; // damage multiplier
  trait: TraitId;
  traitDesc: string;
  rarity: number; // 1 common .. 3 rare
  crest: CrestId;
}

export interface TeamEntry {
  uid: number;
  species: SpeciesId;
  level: number;
}

export interface StatusSet {
  burn: number; // turns of burn left
  stun: boolean;
  shield: number; // 0..1 damage reduction active
  charge: boolean; // next attack x2 (unused hook for AI)
}

export interface Battler {
  species: SpeciesDef;
  level: number;
  hp: number;
  maxHp: number;
  statuses: StatusSet;
  isPlayer: boolean;
  label: string; // display name ("BLAZE" / "WILD VOLTOX" / "VEX'S FERRION")
}

export interface DraftRequest {
  enemySpecies: SpeciesDef;
  enemyLevel: number;
  isTrainer: boolean;
  trainerName?: string;
  team: TeamEntry[];
}

export interface BattleCardsSnap {
  cards: CardId[];
  cooldowns: number[]; // turns left
  yourTurn: boolean;
  locked: boolean; // anim playing
}

export interface HudSnap {
  score: number;
  lives: number;
  teamCount: number;
  tameCards: number;
  wins: number;
  hint: string;
  engageName: string;
  engageKind: '' | 'wild' | 'trainer';
}

export interface RunStats {
  score: number;
  tames: number;
  wins: number;
  losses: number;
  timeMs: number;
  bestCombo: number;
}

export interface HiScore {
  name: string;
  score: number;
  tames: number;
  wins: number;
  date: number;
}

export const TAME_SCORE = 250;
export const WIN_SCORE = 150;
export const TRAINER_SCORE = 400;
export const CRYSTAL_SCORE = 25;
