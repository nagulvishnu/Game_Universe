export type StyleId =
  | 'water' | 'thunder' | 'beast' | 'flame' | 'insect' | 'sound'
  | 'mist' | 'love' | 'wind' | 'stone' | 'serpent' | 'sun';

export type SkillKind = 'dash' | 'arc' | 'spin' | 'multi' | 'proj' | 'slam' | 'ult';
export type Status = 'poison' | 'burn' | 'stun' | 'pull' | 'slow' | 'shock';

export interface SkillDef {
  id: string; name: string; form: string; style: StyleId; kind: SkillKind;
  dmg: number; range: number; arc: number; hits: number; dur: number; dash: number;
  breath: number; cd: number; level: number; sp: number; desc: string;
  fx?: Status; reqChapter?: number; ult?: boolean; special?: boolean;
}

export interface StyleDef {
  id: StyleId; name: string; jp: string; color: number; core: number; css: string;
  wave: number; particle: 'water' | 'fire' | 'spark' | 'wind' | 'mist' | 'poison' | 'note' | 'petal' | 'rock' | 'snake' | 'sun';
  forms: SkillDef[]; special: SkillDef; ultimate: SkillDef;
}

export type HairStyle = 'spiky' | 'long' | 'pony' | 'flame' | 'wild' | 'short' | 'bob' | 'none';
export type Pattern = 'checker' | 'plain' | 'half' | 'flame' | 'butterfly' | 'triangle' | 'none';

export interface Look {
  skin: number; hair: number; tip?: number; hairStyle: HairStyle; eye: number;
  outfit: number; pants: number; haori?: number; haori2?: number; pattern?: Pattern;
  scale: number; extras: string[]; demon?: boolean; sash?: number;
}

export interface Stats { hp: number; sta: number; atk: number; def: number; spd: number; breath: number; crit: number }

export interface CharDef {
  id: string; name: string; title: string; style: StyleId; role: string; desc: string; quote: string;
  stats: Stats; atkSpeed: number; reach: number;
  unlock: { type: 'start' } | { type: 'chapter'; chapter: number } | { type: 'trial'; trial: string; chapter: number };
  look: Look; bladeColor: number; dual?: boolean; weapon: string;
  forms: string[]; special: string; ult: string; ult2?: { id: string; chapter: number };
  specialAlt?: { id: string; chapter: number };
  extraForms?: string[];
}

export interface DialogueLine { who: string; text: string; cam?: 'boss' | 'npc' | 'player' | 'wide'; look?: string }

export type Step =
  | { t: 'dialogue'; lines: DialogueLine[]; region?: string; title?: string }
  | { t: 'talk'; npc: string; lines: DialogueLine[]; at?: [number, number]; region?: string; obj?: string }
  | { t: 'kill'; n: number; types: string[]; obj?: string; region?: string }
  | { t: 'boss'; boss: string; retreat?: number; region?: string; obj?: string }
  | { t: 'collect'; n: number; label: string; region?: string; kind?: string }
  | { t: 'survive'; sec: number; types: string[]; region?: string; obj?: string }
  | { t: 'reach'; at: [number, number]; r?: number; obj: string; region?: string; escort?: string }
  | { t: 'dummy'; n: number; obj?: string; region?: string };

export interface Reward { xp: number; sen: number; cp: number; sp?: number; items?: Record<string, number>; unlockChar?: string[]; unlockRegion?: string[]; sword?: string }

export interface Quest {
  id: string; kind: 'story' | 'side' | 'trial' | 'training'; cat: string; title: string; sub: string; region: string;
  desc: string; diff: 1 | 2 | 3 | 4 | 5; level: number; req?: { chapter?: number; char?: string; quest?: string; rank?: number };
  steps: Step[]; reward: Reward; chapter?: number; once?: boolean;
}

export interface Settings {
  gfx: 'low' | 'medium' | 'high' | 'ultra'; renderScale: number; shadows: 'off' | 'low' | 'high';
  music: number; sfx: number; ambience: number; sens: number; invertY: boolean; fov: number; showFps: boolean; shake: number;
}

export interface CharProg {
  level: number; xp: number; sp: number; unlocked: string[]; equipped: (string | null)[];
  passives: Record<string, number>; kills: number;
}

export interface Profile {
  version: number; created: number; playtime: number;
  activeChar: string; unlockedChars: string[]; chars: Record<string, CharProg>;
  chapter: number; questsDone: string[]; bosses: string[];
  inventory: Record<string, number>; swords: Record<string, number>; equippedSword: Record<string, string>;
  equipment: { haori: string | null; uniform: string | null; charm: string | null };
  sen: number; cp: number; collectibles: string[]; discoveries: string[];
  regions: string[]; region: string; clock: number; flags: Record<string, boolean>; kills: number;
  settings: Settings;
}
