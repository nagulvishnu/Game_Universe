// Shared constants, types and court theme definitions for TENNIS MASTERS.

export const COURT = {
  halfLen: 11.885,
  halfWS: 4.115,
  halfWD: 5.485,
  service: 6.4,
  netH: 0.914,
  netHalf: 6.4,
};
export const BALL_R = 0.13;
export const G = 14;

export type SurfaceId = 'hard' | 'clay' | 'grass' | 'sand' | 'carpet';
export interface Surface {
  name: string;
  rest: number; // vertical restitution
  fric: number; // horizontal speed retention on bounce
  grip: number; // player acceleration multiplier
  dust: number; // hex colour of impact particles
  desc: string;
}
export const SURFACES: Record<SurfaceId, Surface> = {
  hard: { name: 'Hard Court', rest: 0.8, fric: 0.82, grip: 1, dust: 0xbfd8ff, desc: 'Balanced bounce' },
  clay: { name: 'Clay', rest: 0.74, fric: 0.7, grip: 0.82, dust: 0xe0815a, desc: 'Slow, high bounce, players slide' },
  grass: { name: 'Grass', rest: 0.68, fric: 0.88, grip: 0.9, dust: 0xa6e070, desc: 'Fast and low' },
  sand: { name: 'Beach Sand', rest: 0.66, fric: 0.62, grip: 0.76, dust: 0xffe0a0, desc: 'Very slow, heavy legs' },
  carpet: { name: 'Cyber Glass', rest: 0.84, fric: 0.9, grip: 1.08, dust: 0x66fff2, desc: 'Ultra fast, bouncy' },
};

export type CourtId = 'neon' | 'tropical' | 'stadium' | 'sunset' | 'mountain' | 'cyber';
export interface CourtTheme {
  id: CourtId;
  name: string;
  tagline: string;
  surface: SurfaceId;
  courtColor: number;
  outColor: number;
  lineColor: number;
  skyTop: number;
  skyBottom: number;
  fog: number;
  fogDensity: number;
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  night: boolean;
  accent: number;
  unlock: number; // championship stage needed (0 = open)
}
export const COURTS: CourtTheme[] = [
  { id: 'neon', name: 'Neon City Arena', tagline: 'Night skyline, hot neon', surface: 'hard', courtColor: 0x2b5fd9, outColor: 0x1a2250, lineColor: 0xffffff, skyTop: 0x0a0720, skyBottom: 0x5a1b7a, fog: 0x1b0f3a, fogDensity: 0.012, sun: 0xb9a0ff, sunIntensity: 1.1, hemiSky: 0x8a7bff, hemiGround: 0x201040, night: true, accent: 0xff2fd2, unlock: 0 },
  { id: 'tropical', name: 'Tropical Paradise', tagline: 'Palms, lagoon, clay', surface: 'clay', courtColor: 0xd9663a, outColor: 0x3e9a5a, lineColor: 0xffffff, skyTop: 0x2f9cf0, skyBottom: 0xbdf2ff, fog: 0xbdf2ff, fogDensity: 0.006, sun: 0xfff2d0, sunIntensity: 2.0, hemiSky: 0xbfe8ff, hemiGround: 0x4a8a50, night: false, accent: 0xffd23f, unlock: 0 },
  { id: 'stadium', name: 'Grand Championship Stadium', tagline: 'Grass, roaring crowd', surface: 'grass', courtColor: 0x3fa14a, outColor: 0x1f6b36, lineColor: 0xffffff, skyTop: 0x4aa3ff, skyBottom: 0xd8ecff, fog: 0xcfe4f5, fogDensity: 0.005, sun: 0xffffff, sunIntensity: 2.2, hemiSky: 0xdff0ff, hemiGround: 0x3a6a3a, night: false, accent: 0xffffff, unlock: 0 },
  { id: 'sunset', name: 'Sunset Beach Court', tagline: 'Golden hour on the sand', surface: 'sand', courtColor: 0xe8b86a, outColor: 0xf3d9a0, lineColor: 0xffffff, skyTop: 0x5b3a9a, skyBottom: 0xff8a4a, fog: 0xff9c6a, fogDensity: 0.01, sun: 0xffb070, sunIntensity: 1.8, hemiSky: 0xffa070, hemiGround: 0xc99a5a, night: false, accent: 0xff5a7a, unlock: 2 },
  { id: 'mountain', name: 'Mountain Tennis Resort', tagline: 'Alpine air, snowy peaks', surface: 'clay', courtColor: 0x4f8f78, outColor: 0x6a8a5a, lineColor: 0xffffff, skyTop: 0x5aa8e8, skyBottom: 0xe6f4ff, fog: 0xdcecf8, fogDensity: 0.008, sun: 0xfff6e0, sunIntensity: 1.9, hemiSky: 0xcfe8ff, hemiGround: 0x5a7a5a, night: false, accent: 0x7fe0ff, unlock: 4 },
  { id: 'cyber', name: 'Futuristic Cyber Court', tagline: 'Holograms and light', surface: 'carpet', courtColor: 0x0b1f3a, outColor: 0x070a18, lineColor: 0x40fff0, skyTop: 0x02030c, skyBottom: 0x0b1d4a, fog: 0x050a1e, fogDensity: 0.013, sun: 0x66e0ff, sunIntensity: 1.0, hemiSky: 0x3a7aff, hemiGround: 0x10102a, night: true, accent: 0x40fff0, unlock: 5 },
];
export const courtById = (id: CourtId) => COURTS.find((c) => c.id === id)!;

export interface Rules {
  setsToWin: number; // 1,2,3
  games: number; // games per set (target)
  tiebreak: boolean;
  noAd: boolean;
  pace: number; // ball flight-time multiplier (arcade speed)
}
export const RULE_PRESETS: { id: string; name: string; desc: string; rules: Rules }[] = [
  { id: 'blitz', name: 'Blitz', desc: 'First to 3 games · No-Ad', rules: { setsToWin: 1, games: 3, tiebreak: true, noAd: true, pace: 1 } },
  { id: 'quick', name: 'Quick Set', desc: '1 set to 4 games · Deuce', rules: { setsToWin: 1, games: 4, tiebreak: true, noAd: false, pace: 1 } },
  { id: 'classic', name: 'Classic Set', desc: '1 set to 6 games · Tie-break', rules: { setsToWin: 1, games: 6, tiebreak: true, noAd: false, pace: 1 } },
  { id: 'bo3', name: 'Best of 3', desc: '3 sets to 4 games', rules: { setsToWin: 2, games: 4, tiebreak: true, noAd: false, pace: 1 } },
];

export type Personality = 'aggressive' | 'defensive' | 'balanced' | 'tactical';
export const PERSONALITIES: Personality[] = ['aggressive', 'defensive', 'balanced', 'tactical'];
export const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Legendary'];

export type DrillType = 'free' | 'serve' | 'target' | 'perfect' | 'movement' | 'accuracy';
export type ModeId = 'quick' | 'versus' | 'solo' | 'coop' | 'tournament' | 'practice' | 'challenge' | 'champ' | 'demo';

export interface Look {
  color: number;
  outfit: number; // 0 tee, 1 tank, 2 long sleeve
  racket: number; // racket colour
  racketFx: number; // 0 none 1 spark 2 flame 3 ice 4 electric
  trail: number; // 0 default 1 neon 2 pink 3 gold 4 rainbow
  skin: number;
}

export interface PlayerSpec {
  name: string;
  human: number; // -1 AI, 0 = P1, 1 = P2
  level: number; // AI level 1..6
  personality: Personality;
  look: Look;
}
export interface MatchConfig {
  mode: ModeId;
  doubles: boolean;
  courtId: CourtId;
  rules: Rules;
  teams: [PlayerSpec[], PlayerSpec[]];
  drill?: DrillType;
  challengeSecs?: number;
  label: string;
  multiplier: number; // score multiplier (difficulty)
  meta?: Record<string, unknown>;
}

export const PALETTE = [0xff4d6d, 0x3a86ff, 0xffbe0b, 0x2ec4b6, 0x9b5de5, 0xff7b00, 0xf15bb5, 0x80ed99];
export const RACKET_COLORS = [0xffffff, 0x222222, 0xff4d6d, 0x3a86ff, 0xffbe0b, 0x2ec4b6];
export const FX_NAMES = ['None', 'Sparks', 'Flame', 'Frost', 'Electric'];
export const FX_COLORS = [0xffffff, 0xffe27a, 0xff7a2a, 0x8be9ff, 0x9a7bff];
export const TRAIL_NAMES = ['Classic', 'Neon Green', 'Hot Pink', 'Gold', 'Rainbow'];
export const TRAIL_COLORS = [0xe8ffd0, 0x4dff7a, 0xff4fd8, 0xffd23f, 0xffffff];
export const OUTFIT_NAMES = ['Classic Tee', 'Tank & Visor', 'Long Sleeve'];
export const SKIN_TONES = [0xf6d3b3, 0xe0ac82, 0xb27a54, 0x7b4b2e, 0x4a2c1a];

export const defaultLook = (i: number): Look => ({
  color: PALETTE[i % PALETTE.length],
  outfit: 0,
  racket: RACKET_COLORS[(i * 2 + 2) % RACKET_COLORS.length],
  racketFx: 1,
  trail: 0,
  skin: i % SKIN_TONES.length,
});
