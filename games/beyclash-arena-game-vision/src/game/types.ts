export type Finish = 'SPIN' | 'RING_OUT' | 'BURST';
export const FINISHES: Finish[] = ['SPIN', 'RING_OUT', 'BURST'];
export type Difficulty = 'Beginner' | 'Easy' | 'Normal' | 'Hard' | 'Expert' | 'Champion';
export const DIFFICULTIES: Difficulty[] = ['Beginner', 'Easy', 'Normal', 'Hard', 'Expert', 'Champion'];
export type Strategy = 'aggressive' | 'defensive' | 'stamina' | 'evasive' | 'opportunist' | 'adaptive';
export type DistrictId = 'residential' | 'shopping' | 'training' | 'competition' | 'elite' | 'championship';

export interface BeyConfig {
  name: string;
  color: string;
  layer: string;
  disc: string;
  driver: string;
  accessory: string;
}

export type HairStyle = 'spiky' | 'bob' | 'ponytail' | 'long' | 'mohawk' | 'bun' | 'short' | 'twin' | 'swept';
export type AccKind = 'none' | 'headband' | 'goggles' | 'glasses' | 'cap' | 'scarf' | 'mask' | 'cape';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  eyes: string;
  top: string;
  top2: string;
  pants: string;
  shoes: string;
  acc: AccKind;
  accColor: string;
  height: number;
  build: number;
  skirt?: boolean;
  coat?: boolean;
}

export interface Requirement {
  level?: number;
  rep?: number;
  defeated?: string[];
  tournament?: string;
}

export interface RivalDef {
  id: string;
  name: string;
  title: string;
  category: string;
  district: DistrictId;
  home: { x: number; z: number };
  facing: number;
  look: Look;
  personality: string;
  bey: BeyConfig;
  strategy: Strategy;
  difficulty: Difficulty;
  req: Requirement;
  reward: number;
  wallet: number;
  ambush?: boolean;
  special?: { desc: string; need: Finish[]; bonus: number; part?: string };
  lines: {
    greet: string;
    talk: string[];
    locked: string;
    win: string;
    lose: string;
    defeated: string;
    surprise?: string;
  };
}

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  district: DistrictId;
  home: { x: number; z: number };
  facing: number;
  look: Look;
  lines: string[];
}

export interface RivalProgress {
  points: number;
  defeated: boolean;
  wins: number;
  losses: number;
  wallet: number;
  met: boolean;
  bonusClaimed: boolean;
}

export interface BattleResult {
  winner: 0 | 1;
  loser: 0 | 1;
  finish: Finish;
  time: number;
  stamina: [number, number];
}
