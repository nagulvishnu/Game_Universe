// Shared type definitions for every gameplay system.
export type Element = 'none' | 'fire' | 'lightning' | 'wind' | 'water' | 'earth';
export type CharId = 'naruto' | 'sasuke' | 'sakura' | 'kakashi' | 'jiraiya' | 'lee' | 'gaara';
export type Form = 'base' | 'sage' | 'kurama';
export type SkillCategory = 'taijutsu' | 'ninjutsu' | 'chakra' | 'defense' | 'special' | 'transform';
export type AbilityKind =
  | 'clone' | 'dashStrike' | 'projectile' | 'aoe' | 'summon' | 'buff' | 'substitution' | 'genjutsu' | 'barrage';
export type Status = 'stun' | 'confuse' | 'burn' | 'slow';
export type ZoneId = 'konoha' | 'forest' | 'waves' | 'sand' | 'myoboku' | 'valley' | 'wilds';

export interface Vec3 { x: number; y: number; z: number }

export type AnimState =
  | 'idle' | 'run' | 'jump' | 'attack' | 'heavy' | 'cast' | 'orb' | 'charge'
  | 'dodge' | 'hit' | 'dead' | 'block' | 'stun' | 'windup' | 'air';

export interface Pose {
  state: AnimState;
  t: number;        // seconds in state
  dur: number;      // expected state duration
  speed: number;    // 0..1.6 locomotion intensity
  variant: number;  // attack variant
  form: Form;
  flash: number;    // 0..1 emissive flash
  flashColor: string;
  alpha: number;
  style: string;    // combat style: brawler | kicker | swordsman | ranged | heavy
}
export const newPose = (): Pose => ({
  state: 'idle', t: 0, dur: 1, speed: 0, variant: 0, form: 'base',
  flash: 0, flashColor: '#ff2200', alpha: 1, style: 'brawler',
});

export interface LookDef {
  skin: string; hair: string; hairStyle: 'spiky' | 'sasuke' | 'bob' | 'silver' | 'long' | 'bowl' | 'messy' | 'none' | 'hood' | 'spikyShort';
  outfit: string; trim: string; pants: string;
  headband?: string | null; headbandSlash?: boolean;
  whiskers?: boolean; mask?: boolean; bandage?: boolean;
  scale?: number;
  weapon?: 'kunai' | 'sword' | 'bigSword' | 'none';
  back?: 'gourd' | 'scroll' | 'none';
  cloak?: string | null; cloakClouds?: boolean;
  eye?: string; brows?: boolean; sharingan?: boolean;
}

export interface AbilityDef {
  id: string; name: string; desc: string; kind: AbilityKind; element: Element;
  cost: number; cooldown: number; power: number;
  radius?: number; range?: number; speed?: number; count?: number; duration?: number;
  size?: number; pierce?: boolean; spread?: number; castTime?: number;
  color: string; icon: string;
  unlockLevel: number; unlockFlag?: string;
  buff?: { heal?: number; dmg?: number; speed?: number; def?: number };
  status?: Status; statusDur?: number;
  visual?: 'toad' | 'sand' | 'lightning' | 'fire' | 'water' | 'blossom' | 'none';
  ult?: boolean; needsForm?: Form; category: SkillCategory; hold?: boolean;
}

export type ModKey =
  | 'dmgPhys' | 'dmgJutsu' | 'hp' | 'chakra' | 'regen' | 'cdr' | 'ult' | 'def' | 'dodge'
  | 'cloneCount' | 'cloneTime' | 'formTime' | 'formDrain' | 'chargeSpeed' | 'elementBonus'
  | 'subCost' | 'autoSub' | 'sage' | 'kurama' | 'atk' | 'crit' | 'parry';

export interface SkillNode {
  id: string; name: string; desc: string; category: SkillCategory; cost: number;
  minLevel: number; requires?: string; mods: Partial<Record<ModKey, number>>; icon: string;
}

export interface CharacterDef {
  id: CharId; name: string; title: string; desc: string; look: LookDef;
  stats: { hp: number; chakra: number; atk: number; def: number; speed: number; jump: number; dodge: number };
  growth: { hp: number; chakra: number; atk: number };
  combo: { hits: number; speed: number; range: number; dmg: number; style: string };
  abilities: string[];       // ability pool, first four equipped by default
  special: string;           // E
  ultimates: { base: string; sage?: string; kurama?: string }; // R
  color: string; unlock: string; identity: string;
}

export interface PatternDef {
  id: string; name: string;
  kind: 'melee' | 'spin' | 'dash' | 'slam' | 'ranged' | 'fan' | 'summon' | 'mistStrike' | 'shield' | 'genjutsu';
  min: number; max: number; windup: number; recover: number; power: number;
  reach?: number; radius?: number; speed?: number; count?: number; spread?: number; dist?: number;
  element?: Element; phase?: number; weight?: number; summon?: string; color?: string; cooldown?: number;
  unblockable?: boolean; amount?: number;
}

export interface EnemyDef {
  id: string; name: string; title?: string; hp: number; speed: number; dmg: number; def: number;
  look: LookDef; element: Element; detect: number; xp: number; ryo: number;
  tier: 'dummy' | 'minion' | 'elite' | 'boss';
  ai: 'melee' | 'ranged' | 'skirmisher' | 'brute' | 'boss' | 'dummy';
  patterns: PatternDef[]; blockChance?: number; dodgeChance?: number; poise: number;
  drops?: { item: string; chance: number; n?: number }[];
  phases?: number[]; phaseLines?: string[]; arena?: { x: number; z: number; r: number };
  intro?: string; outro?: string[]; color: string; radius?: number;
}

export interface ItemDef {
  id: string; name: string; desc: string; icon: string;
  type: 'consumable' | 'tool' | 'scroll' | 'weapon' | 'armor' | 'accessory' | 'material' | 'collectible';
  price: number; rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  stats?: { atk?: number; def?: number; hp?: number; chakra?: number; regen?: number; ryo?: number; speed?: number };
  use?: { heal?: number; chakra?: number; xp?: number; jutsuBuff?: number };
}

export interface DialogueLine { speaker: string; text: string; portrait?: string }

export type Objective =
  | { type: 'talk'; npc: string; label: string; lines?: DialogueLine[] }
  | { type: 'kill'; def?: string; tag?: string; count: number; label: string }
  | { type: 'reach'; pos: [number, number]; radius: number; minY?: number; label: string }
  | { type: 'checkpoints'; points: [number, number, number?][]; radius: number; label: string }
  | { type: 'collect'; kind: string; count: number; label: string }
  | { type: 'ability'; ability: string; count: number; label: string }
  | { type: 'boss'; boss: string; label: string }
  | { type: 'survive'; seconds: number; label: string }
  | { type: 'charge'; seconds: number; label: string };

export interface SpawnDef { def: string; pos: [number, number]; count?: number; spread?: number; tag?: string; lv?: number }

export interface Stage {
  objectives: Objective[];
  intro?: DialogueLine[];
  spawn?: SpawnDef[];
  waves?: { at: number; spawn: SpawnDef[] }[];
  companions?: string[];        // 'sasuke' | 'sakura' | 'kakashi' | 'tazuna'
  clearCompanions?: boolean;
  boss?: { id: string; pos: [number, number] };
  timeLimit?: number;
  hint?: string;
}

export interface Rewards { xp: number; ryo: number; items?: [string, number][]; unlockChars?: CharId[]; flag?: string; rankNote?: string }

export interface MissionDef {
  id: string; name: string; kind: 'story' | 'side'; chapter?: number;
  status: 'playable' | 'planned'; giver: string; minRank: number; minLevel?: number; requires?: string[];
  summary: string; offer: DialogueLine[]; stages: Stage[]; outro?: DialogueLine[]; rewards: Rewards;
  zone: ZoneId; checkpoint?: [number, number];
}

export interface ActiveMission { id: string; stage: number; progress: number[]; elapsed: number }

export interface NpcDef {
  id: string; name: string; pos: [number, number]; yaw: number; look: LookDef; zone: ZoneId;
  role: 'story' | 'shop' | 'healer' | 'flavor' | 'challenge'; lines: string[]; shop?: string[]; wander?: number;
  portrait: string;
}

export interface Collectible {
  id: string; kind: 'scroll' | 'chest' | 'cat' | 'secret' | 'orb'; pos: [number, number, number];
  mission?: string; tag?: string; reward?: { ryo?: number; xp?: number; items?: [string, number][] }; label: string;
}

export interface CampDef {
  id: string; zone: ZoneId; pos: [number, number]; lv: number; spawns: { def: string; count: number }[]; radius: number;
}
