// Shared types for CHAOS BREAKER
export type WeaponId = 'inferno' | 'thunder' | 'void' | 'glacier' | 'plasma' | 'titan';
export type StyleId = 'berserker' | 'samurai' | 'assassin' | 'arcane' | 'juggernaut';
export type Elem = 'fire' | 'lightning' | 'void' | 'ice' | 'plasma' | 'earth' | 'phys';
export type ArenaId = 'citadel' | 'forge' | 'sanctuary' | 'coliseum';
export type ModeId = 'training' | 'survival' | 'elite' | 'boss' | 'mastery' | 'endless';
export type EnemyId = 'knight' | 'assassin' | 'brute' | 'mage' | 'hunter' | 'executioner';
export type BossId = 'iron' | 'storm' | 'titan';

/** Keyframe: t(0..1), px,py,pz (hand pos, x right-positive), pitch, yaw(right-positive), roll, lean, twist, ease(0 smooth,1 in,2 out) */
export type KF = [number, number, number, number, number, number, number, number, number, number];

export interface ProjDef {
  speed: number; life: number; size: number; pierce?: boolean; kind: 'wave' | 'lance' | 'orb' | 'spear';
  elem: Elem; freeze?: number;
}

export interface Hit {
  t: number; dmg: number; range: number;
  shape?: 'cone' | 'line' | 'circle'; arc?: number; width?: number;
  kb?: number; launch?: number; pull?: number; stagger?: number; freeze?: number; armor?: number;
  fx?: 'hit' | 'burst' | 'slam' | 'pillar' | 'arc' | 'bolts' | 'crystals' | 'rift' | 'none' | 'ult';
  act?: 'proj' | 'blink' | 'warp' | 'bolt' | 'hole' | 'rift' | 'mark' | 'resolve' | 'slow' | 'quake' | 'flash';
  p?: number; ox?: number; shake?: number; stop?: number; land?: boolean; proj?: ProjDef; big?: boolean;
}

export interface AttackDef {
  id: string; name: string; dur: number; cancel: number; kf: KF[]; hits: Hit[];
  trail?: [number, number]; lunge?: [number, number, number]; stam?: number; hand?: 'R' | 'L' | 'B';
  holdAt?: number; charged?: string; cd?: number; air?: boolean; dive?: boolean; invuln?: boolean;
  cinematic?: boolean; elem?: Elem; swing?: number; mult?: number; hover?: boolean; leap?: number; slowmo?: [number, number, number];
}

export interface WeaponDef {
  id: WeaponId; name: string; title: string; desc: string; color: number; color2: number; elem: Elem;
  length: number; dual?: boolean; stats: { power: number; speed: number; reach: number; defense: number };
  light: AttackDef[]; heavy: AttackDef; charged: AttackDef; air: AttackDef[]; airHeavy: AttackDef;
  spec1: AttackDef; spec2: AttackDef; ult: AttackDef; counter: AttackDef; extra: AttackDef;
  guard: KF[]; clash: KF[]; pw: number; nw: number; lock: number;
  deflectName: string; counterName: string; awakenName: string; awakenDesc: string;
  skins: { name: string; color: number; color2: number }[];
  moves: string[];
}

export interface StyleDef {
  id: StyleId; name: string; desc: string; color: number; icon: string;
  dmg: number; speed: number; hp: number; stamina: number; taken: number; stagger: number; pw: number;
  counter: number; moveSpeed: number; dodgeStam: number; iframes: number; armorBreak: number;
  perks: string[];
}

export interface EAtk {
  id: string; name: string; pose: 'overhead' | 'horizontal' | 'thrust' | 'spin' | 'slam' | 'cast' | 'flurry' | 'sweep' | 'rush' | 'raise' | 'dive';
  wind: number; rec: number; min: number; max: number; dmg: number; reach: number; arc?: number; w: number;
  kind?: 'melee' | 'proj' | 'aoe' | 'rush' | 'rain' | 'pull' | 'beam' | 'teleport' | 'nova';
  unblock?: boolean; hits?: number; gap?: number; lunge?: number; feint?: boolean; phase?: number;
  proj?: { n: number; spread: number; speed: number; kind: 'orb' | 'wave' | 'lance'; elem: Elem; size: number };
  aoe?: { r: number; at: 'self' | 'target' | 'ahead'; n?: number; delay?: number };
  posture?: number; elem?: Elem; heavy?: boolean;
}

export interface EnemyDef {
  id: string; name: string; hp: number; speed: number; radius: number; scale: number; pref: number;
  armor: number; guard: boolean; atks: EAtk[]; score: number; posture: number; tokens: number;
  rig: { kind: string; main: number; accent: number; skin?: number; bulk?: number };
  weapon: string; boss?: boolean; phases?: number[]; elem: Elem; hover?: number;
}

export interface ArenaDef {
  id: ArenaId; name: string; desc: string; radius: number; sky: [number, number]; fog: number; fogDensity: number;
  light: number; ambient: number; accent: number; gravity: number; music: number;
}

export interface Challenge { id: string; label: string; stat: StatKey; target: number; reward: 'skin' | 'combo' | 'awaken'; rewardLabel: string }
export type StatKey = 'perfects' | 'maxCombo' | 'kills' | 'counters' | 'specials' | 'ults' | 'airHits' | 'chain';
export type WStats = Record<StatKey, number>;
export interface ScoreEntry { name: string; score: number; mode: ModeId; weapon: WeaponId; wave: number; date: number }

// ---- animation helpers ----
export const K = (t: number, px: number, py: number, pz: number, pi: number, ya: number, ro: number, ln = 0, tw = 0, e = 0): KF => [t, px, py, pz, pi, ya, ro, ln, tw, e];

export function samplePose(kf: KF[], u: number, out: number[]) {
  let a = kf[0], b = kf[0];
  if (u <= kf[0][0]) { /* a=b */ } else if (u >= kf[kf.length - 1][0]) { a = b = kf[kf.length - 1]; } else {
    for (let i = 1; i < kf.length; i++) if (u <= kf[i][0]) { a = kf[i - 1]; b = kf[i]; break; }
  }
  let f = b[0] === a[0] ? 1 : (u - a[0]) / (b[0] - a[0]);
  const e = b[9];
  f = e === 1 ? f * f : e === 2 ? 1 - (1 - f) * (1 - f) : f * f * (3 - 2 * f);
  for (let j = 1; j < 9; j++) out[j - 1] = a[j] + (b[j] - a[j]) * f;
  return out;
}
