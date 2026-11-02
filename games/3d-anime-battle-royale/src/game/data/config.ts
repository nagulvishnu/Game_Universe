export interface ZonePhase { wait: number; shrink: number; radius: number; dmg: number }

export const ZONE_PHASES: ZonePhase[] = [
  { wait: 110, shrink: 60, radius: 470, dmg: 1 },
  { wait: 60, shrink: 55, radius: 330, dmg: 2 },
  { wait: 50, shrink: 50, radius: 210, dmg: 3 },
  { wait: 45, shrink: 40, radius: 125, dmg: 5 },
  { wait: 35, shrink: 35, radius: 65, dmg: 7 },
  { wait: 30, shrink: 28, radius: 28, dmg: 10 },
  { wait: 20, shrink: 24, radius: 8, dmg: 14 },
];
export const ZONE_START_RADIUS = 660;

export type MatchMode = 'classic' | 'blitz';
export const MODES: Record<MatchMode, { name: string; desc: string; zoneTime: number; bots: number }> = {
  classic: { name: 'CLASSIC SOLO', desc: '50 fighters · standard zone timings', zoneTime: 1, bots: 49 },
  blitz: { name: 'BLITZ SOLO', desc: '50 fighters · fast shrinking zone', zoneTime: 0.5, bots: 49 },
};

export type GfxPreset = 'low' | 'medium' | 'high';
export interface GfxSettings {
  preset: GfxPreset; resolution: number; shadows: boolean; shadowSize: number; viewDist: number; effects: number; trees: number;
}
export const GFX_PRESETS: Record<GfxPreset, GfxSettings> = {
  low: { preset: 'low', resolution: 0.7, shadows: false, shadowSize: 1024, viewDist: 380, effects: 0.5, trees: 0.4 },
  medium: { preset: 'medium', resolution: 1, shadows: true, shadowSize: 1024, viewDist: 520, effects: 0.8, trees: 0.7 },
  high: { preset: 'high', resolution: 1, shadows: true, shadowSize: 2048, viewDist: 700, effects: 1, trees: 1 },
};

export const MOVE = {
  run: 5.4, sprint: 7.6, crouch: 2.7, prone: 1.2, aimMul: 0.62, water: 0.55, gravity: 24, jump: 7.6, stepUp: 0.55,
  accel: 38, airAccel: 7, fallDmgSpeed: 15,
};

export const WORLD_SIZE = 1400; // world spans [-700, 700]
export const PLANE_ALT = 420;
export const PLANE_SPEED = 34;
export const MATCH_SEED_DEFAULT = 0;
