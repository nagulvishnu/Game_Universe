// Shared contracts for every ECLIPSE subsystem (story, AI, rendering, camera, audio).
export type Vec2 = [number, number];
export type EnvId = 'village' | 'observatory' | 'caverns' | 'citadel' | 'temple' | 'road';
export type Weather = 'clear' | 'rain' | 'storm' | 'ash' | 'mist';
export type Emotion =
  | 'neutral' | 'joy' | 'sorrow' | 'anger' | 'fear' | 'surprise'
  | 'resolve' | 'smirk' | 'worry' | 'tender';
export type Gesture = 'none' | 'open' | 'point' | 'chest' | 'shake' | 'nod' | 'shrug' | 'fist';
export type AnimName =
  | 'slash_h' | 'slash_v' | 'thrust' | 'cast' | 'blast' | 'block' | 'dodge' | 'hit'
  | 'bow' | 'flinch' | 'raise' | 'collapse' | 'draw' | 'kneel_down' | 'stand_up' | 'reach';
export type Stance = 'stand' | 'sit' | 'kneel' | 'down' | 'combat' | 'wounded';
export type MusicCue =
  | 'silence' | 'prologue' | 'dawn' | 'mystery' | 'tension' | 'battle' | 'sorrow'
  | 'campfire' | 'dread' | 'triumph' | 'finale' | 'epilogue' | 'credits';

export type ShotKind =
  | 'establish' | 'wide' | 'medium' | 'close' | 'ecu' | 'ots' | 'two' | 'low' | 'high' | 'track' | 'top';
export interface ShotHint {
  k: ShotKind;
  on?: string[];
  side?: 1 | -1;
  dist?: number;
  move?: 'static' | 'push' | 'pull' | 'orbit' | 'crane' | 'handheld' | 'track';
  lens?: number; // focal length mm
}

export type FxKind =
  | 'lightning' | 'flash' | 'shake' | 'eclipse' | 'weather' | 'music' | 'sfx' | 'burst' | 'time' | 'aura' | 'destroy' | 'burn' | 'vanish';

export type Beat =
  | { t: 'line'; who: string; text: string; emo?: Emotion; g?: Gesture; to?: string; reveals?: string[]; off?: boolean; shot?: ShotHint }
  | { t: 'move'; to: Record<string, string>; run?: boolean; cap?: number; shot?: ShotHint }
  | { t: 'enter'; who: string; from: string; to: string; run?: boolean }
  | { t: 'exit'; who: string; via: string; run?: boolean }
  | { t: 'act'; who: string; anim: AnimName; dur?: number; at?: string; emo?: Emotion; shot?: ShotHint }
  | { t: 'stance'; who: string; stance: Stance; weapon?: boolean; emo?: Emotion }
  | { t: 'face'; who: string; at: string }
  | { t: 'fx'; k: FxKind; at?: string; who?: string; color?: string; amount?: number; to?: number | string; name?: string }
  | { t: 'combat'; id: string; sides: [string[], string[]]; winner: 0 | 1 | 'draw'; dur: number; arena?: string; end: 'down' | 'kneel' | 'draw' }
  | { t: 'title'; text: string; sub?: string; dur: number }
  | { t: 'wait'; dur: number; shot?: ShotHint }
  | { t: 'shot'; shot: ShotHint };

export interface SceneEffects {
  facts?: string[];
  hp?: Record<string, number>;
  dead?: string[];
  injuries?: Record<string, string>;
  outfit?: Record<string, string>;
  possessions?: [string, string][];
  rel?: [string, string, number, number][]; // a, b, trust delta, affection delta
}

export interface SceneDef {
  id: string;
  act: 1 | 2 | 3 | 4;
  title: string;
  env: EnvId;
  hour: number;
  weather: Weather;
  eclipse?: number;
  music: MusicCue;
  objective: string;
  assets: string[];
  motivations: Record<string, string>;
  cast: { id: string; at: string; face?: string; stance?: Stance; emo?: Emotion; weapon?: boolean }[];
  requires: string[];
  effects: SceneEffects;
  endCondition: string;
  continuity: string;
  sfx: string[];
  beats: Beat[];
}

export interface Relationship { trust: number; affection: number }
export interface MemoryEntry { scene: string; t: number; kind: 'heard' | 'said' | 'saw' | 'event'; text: string; from?: string; salience: number }

export interface WorldState {
  facts: Set<string>;
  hp: Record<string, number>;
  dead: Set<string>;
  injuries: Record<string, string[]>;
  outfit: Record<string, string>;
  possessions: Record<string, string[]>;
  rel: Record<string, Record<string, Relationship>>;
  knowledge: Record<string, Set<string>>;
  location: EnvId | null;
  history: { scene: string; who: string; text: string; emo?: Emotion }[];
}

export interface FxItem {
  kind: 'ring' | 'arc' | 'burst' | 'beam' | 'pillar';
  x: number; y: number; z: number;
  yaw: number;
  color: string;
  t: number; dur: number; size: number;
  x2?: number; z2?: number;
}
