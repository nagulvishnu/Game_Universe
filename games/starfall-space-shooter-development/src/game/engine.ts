// ─── Pure gameplay math: damage, homing, boss phases, rewards, saves ────────

import { SHIPS, WEAPONS, MISSIONS, UPGRADES, ACHIEVEMENTS } from '../data/gameData';

export interface HealthState { hull: number; maxHull: number; shield: number; maxShield: number; armor: number; }

/** Apply damage: shields absorb first (shieldMult), overflow hits hull reduced by armor. Returns new state + breakdown. */
export function applyDamage(state: HealthState, raw: number, shieldMult = 1, hullMult = 1): { next: HealthState; shieldDamage: number; hullDamage: number; killed: boolean } {
  let remaining = Math.max(0, raw);
  let shieldDamage = 0, hullDamage = 0;
  let shield = state.shield, hull = state.hull;
  if (shield > 0 && remaining > 0) {
    const eff = remaining * shieldMult;
    shieldDamage = Math.min(shield, eff);
    shield -= shieldDamage;
    remaining = Math.max(0, remaining - shieldDamage / Math.max(shieldMult, 0.0001));
  }
  if (remaining > 0) {
    let dmg = remaining * hullMult - state.armor;
    if (raw > 0) dmg = Math.max(1, dmg); // chip damage floor
    hullDamage = Math.min(hull, Math.max(0, dmg));
    hull -= hullDamage;
  }
  return { next: { ...state, shield, hull: Math.max(0, hull) }, shieldDamage, hullDamage, killed: hull <= 0 };
}

export function shieldRegen(state: HealthState, dt: number, ratePerSec: number, delayOk: boolean): HealthState {
  if (!delayOk || state.hull <= 0) return state;
  return { ...state, shield: Math.min(state.maxShield, state.shield + ratePerSec * dt) };
}

/** Steer a homing projectile velocity toward a target. Returns new velocity vector (as tuple). */
export function homeVelocity(
  pos: [number, number, number], vel: [number, number, number],
  target: [number, number, number], speed: number, turnRate: number, dt: number
): [number, number, number] {
  const dx = target[0] - pos[0], dy = target[1] - pos[1], dz = target[2] - pos[2];
  const dist = Math.hypot(dx, dy, dz) || 1;
  const desired: [number, number, number] = [(dx / dist) * speed, (dy / dist) * speed, (dz / dist) * speed];
  const t = Math.min(1, turnRate * dt);
  const nx = vel[0] + (desired[0] - vel[0]) * t;
  const ny = vel[1] + (desired[1] - vel[1]) * t;
  const nz = vel[2] + (desired[2] - vel[2]) * t;
  const nl = Math.hypot(nx, ny, nz) || 1;
  return [(nx / nl) * speed, (ny / nl) * speed, (nz / nl) * speed];
}

/** Boss phase from health fraction: 1 = >66%, 2 = 33–66%, 3 = <33% */
export function bossPhase(hullFrac: number): 1 | 2 | 3 {
  if (hullFrac > 0.66) return 1;
  if (hullFrac > 0.33) return 2;
  return 3;
}

export function missionRating(hullFrac: number, timeSec: number, kills: number, accuracy: number): { grade: string; points: number } {
  const points = Math.round(kills * 120 + hullFrac * 2500 + accuracy * 1500 - Math.min(1200, timeSec * 2));
  const grade = points >= 4200 ? 'S' : points >= 3200 ? 'A' : points >= 2200 ? 'B' : points >= 1200 ? 'C' : 'D';
  return { grade, points: Math.max(0, points) };
}

export function xpForLevel(level: number): number { return 100 + (level - 1) * 140; }

export function levelFromXp(totalXp: number): { level: number; into: number; needed: number } {
  let level = 1, remaining = totalXp;
  while (remaining >= xpForLevel(level)) { remaining -= xpForLevel(level); level++; if (level > 60) break; }
  return { level, into: remaining, needed: xpForLevel(level) };
}

export function upgradeCost(base: number, currentLevel: number): number {
  return Math.round(base * Math.pow(1.55, currentLevel));
}

export function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
export function rand(lo: number, hi: number): number { return lo + Math.random() * (hi - lo); }

// ─── Mission objectives: pure resolution of "what happens next" ─────────────

export interface ObjectiveConfig {
  kind: string; type: string; killTarget: number; timeLimit: number; waves: number; bossId?: string;
}
export interface ObjectiveState {
  t: number; kills: number; asteroidsDestroyed: number; wave: number;
  waveState: string; alive: number; bossAlive: boolean; bossQueueLeft: number; inCombat: boolean;
}
/**
 * 'continue'  — nothing to do right now
 * 'next-wave' — spawn the next wave
 * 'spawn-boss'— bring in the boss for this mission
 * 'win'       — objective complete
 * 'lose-timeout' — the clock ran out before the objective was met
 */
export type ObjectiveOutcome = 'continue' | 'next-wave' | 'spawn-boss' | 'win' | 'lose-timeout';

/**
 * Decide what a mission should do next. Every mission kind must always resolve to
 * 'win' or 'lose-timeout' eventually — a mode that can neither win nor lose is a soft-lock.
 */
export function resolveObjective(cfg: ObjectiveConfig, s: ObjectiveState): ObjectiveOutcome {
  const timeUp = cfg.timeLimit > 0 && s.t >= cfg.timeLimit;

  // Timed missions resolve on the clock, whether or not the arena is clear.
  // Without this a timed mission could neither be won nor lost once the timer expired.
  if (timeUp && (cfg.type === 'survival-time' || cfg.kind === 'timeattack')) {
    return s.kills >= cfg.killTarget ? 'win' : 'lose-timeout';
  }

  // Objective completion is checked before the wave flow, so reaching the target
  // ends the run immediately instead of sending one more wave.
  if (cfg.type === 'destroy' && cfg.kind !== 'campaign' && cfg.killTarget > 0 && s.kills >= cfg.killTarget) return 'win';
  if (cfg.kind === 'asteroid' && (s.kills + s.asteroidsDestroyed) >= cfg.killTarget) return 'win';

  // Wave flow (only while fighting, and never while a boss is alive).
  if (s.inCombat && !s.bossAlive && (s.waveState === 'pending' || (s.waveState === 'active' && s.alive === 0))) {
    if (cfg.type === 'survival-time') return 'next-wave';
    if (cfg.kind === 'survival' || cfg.kind === 'endless' || cfg.kind === 'asteroid' || cfg.kind === 'timeattack') return 'next-wave';
    if (cfg.kind === 'bossrush') return s.bossQueueLeft > 0 ? 'spawn-boss' : 'win';
    if (s.wave < cfg.waves) return 'next-wave';
    if (cfg.bossId) return 'spawn-boss';
    return 'win';
  }

  return 'continue';
}

// ─── Charge weapons (railgun): linear damage & cost ─────────────────────────

/** Peak damage multiplier of a fully charged shot. */
export const CHARGE_PEAK = 1.4;

/**
 * How far a charge weapon can be charged with the energy the pilot actually has.
 * Without this a full-power shot could be released for a fraction of its cost.
 */
export function chargeCap(energy: number, energyCost: number): number {
  if (energyCost <= 0) return 1;
  return clamp(energy / energyCost, 0, 1);
}

/**
 * Damage and energy cost of a charge shot. Both scale linearly with the charge, so the
 * damage-per-energy of a partial charge equals that of a full one — a charged weapon can
 * never be abused by tapping out cheap low-damage shots.
 */
export function chargeShot(weapon: { damage: number; energyCost: number }, charge: number, damageMult = 1, peak = CHARGE_PEAK): { damage: number; energyCost: number } {
  const c = clamp(charge, 0, 1);
  return { damage: weapon.damage * damageMult * c * peak, energyCost: weapon.energyCost * c };
}

// ─── Settings: shape + validation ───────────────────────────────────────────

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  sensitivity: number; invertY: boolean;
  masterVol: number; musicVol: number; sfxVol: number; uiVol: number;
  cameraShake: number; screenEffects: boolean; showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'high', sensitivity: 1, invertY: false,
  masterVol: 0.8, musicVol: 0.5, sfxVol: 0.85, uiVol: 0.6,
  cameraShake: 0.7, screenEffects: true, showFps: false,
};

/**
 * Coerce arbitrary input into valid Settings.
 * Values must be finite and inside their range — a corrupt localStorage entry must never
 * reach the Web Audio API (a NaN gain throws) or the renderer.
 */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const num = (v: unknown, fb: number, lo: number, hi: number) =>
    (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fb);
  const bool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb);
  const q = src.quality;
  return {
    quality: q === 'low' || q === 'medium' || q === 'high' ? q : base.quality,
    sensitivity: num(src.sensitivity, base.sensitivity, 0.1, 5),
    invertY: bool(src.invertY, base.invertY),
    masterVol: num(src.masterVol, base.masterVol, 0, 1),
    musicVol: num(src.musicVol, base.musicVol, 0, 1),
    sfxVol: num(src.sfxVol, base.sfxVol, 0, 1),
    uiVol: num(src.uiVol, base.uiVol, 0, 1),
    cameraShake: num(src.cameraShake, base.cameraShake, 0, 2),
    screenEffects: bool(src.screenEffects, base.screenEffects),
    showFps: bool(src.showFps, base.showFps),
  };
}

// ─── Save schema (versioned + validated) ─────────────────────────────────────
export const SAVE_KEY = 'starfall-galactic-war-save';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  credits: number; totalXp: number;
  ownedShips: string[]; selectedShip: string;
  ownedWeapons: string[]; primaryId: string; secondaryId: string;
  upgrades: Record<string, number>;
  completedMissions: number[]; missionRatings: Record<number, string>;
  achievements: string[];
  stats: Record<string, number>;
  paint: string;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION, credits: 1500, totalXp: 0,
    ownedShips: ['viper'], selectedShip: 'viper',
    ownedWeapons: ['pulse', 'seeker'], primaryId: 'pulse', secondaryId: 'seeker',
    upgrades: {}, completedMissions: [], missionRatings: {}, achievements: [],
    stats: { totalKills: 0, bossKills: 0, missionsDone: 0, lifetimeCredits: 0, shipsOwned: 1, bestSurvivalWave: 0, shotsFired: 0, ultsUsed: 0, deaths: 0, playTime: 0 },
    paint: 'default',
  };
}

// ─── Known content ids (used to reject saves that reference removed content) ──
const SHIP_IDS = new Set(SHIPS.map(s => s.id));
const WEAPON_IDS = new Set(WEAPONS.map(w => w.id));
const PRIMARY_IDS = new Set(WEAPONS.filter(w => w.slot === 'primary').map(w => w.id));
const SECONDARY_IDS = new Set(WEAPONS.filter(w => w.slot === 'secondary').map(w => w.id));
const MISSION_IDS = new Set(MISSIONS.map(m => m.id));
const UPGRADE_MAX = new Map(UPGRADES.map(u => [u.id, u.max]));
const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map(a => a.id));

/** Validate arbitrary parsed JSON into a safe SaveData. Corrupted fields fall back to defaults. */
export function validateSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  const num = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fb);
  const strArr = (v: unknown, fb: string[]) => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : fb);

  // Ships / weapons must exist in the content tables — a save naming a removed ship or
  // weapon would otherwise crash the moment a mission boots.
  const ownedShips = [...new Set(strArr(r.ownedShips, []).filter(id => SHIP_IDS.has(id)))];
  if (!ownedShips.length) ownedShips.push(...d.ownedShips);
  const ownedWeapons = [...new Set(strArr(r.ownedWeapons, []).filter(id => WEAPON_IDS.has(id)))];
  if (!ownedWeapons.length) ownedWeapons.push(...d.ownedWeapons);

  const selectedShip = typeof r.selectedShip === 'string' && SHIP_IDS.has(r.selectedShip) ? r.selectedShip : d.selectedShip;
  const fallbackPrimary = ownedWeapons.find(id => PRIMARY_IDS.has(id)) ?? d.primaryId;
  const fallbackSecondary = ownedWeapons.find(id => SECONDARY_IDS.has(id)) ?? d.secondaryId;
  const primaryId = typeof r.primaryId === 'string' && PRIMARY_IDS.has(r.primaryId) && ownedWeapons.includes(r.primaryId) ? r.primaryId : fallbackPrimary;
  const secondaryId = typeof r.secondaryId === 'string' && SECONDARY_IDS.has(r.secondaryId) && ownedWeapons.includes(r.secondaryId) ? r.secondaryId : fallbackSecondary;

  // Upgrade levels must exist and stay within their maximum.
  const upgrades: Record<string, number> = {};
  if (r.upgrades && typeof r.upgrades === 'object') {
    for (const [k, v] of Object.entries(r.upgrades as Record<string, unknown>)) {
      const max = UPGRADE_MAX.get(k);
      if (max === undefined) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      upgrades[k] = Math.max(0, Math.min(max, Math.floor(v)));
    }
  }

  const completedMissions = Array.isArray(r.completedMissions)
    ? [...new Set(r.completedMissions.filter(x => typeof x === 'number' && MISSION_IDS.has(x)))]
    : [];

  const missionRatings: Record<number, string> = {};
  if (r.missionRatings && typeof r.missionRatings === 'object') {
    for (const [k, v] of Object.entries(r.missionRatings as Record<string, unknown>)) {
      const id = Number(k);
      if (!Number.isInteger(id) || !MISSION_IDS.has(id)) continue;
      if (typeof v !== 'string' || v.length === 0 || v.length > 3) continue;
      missionRatings[id] = v;
    }
  }

  // Only known stat keys, only finite non-negative numbers.
  const stats: Record<string, number> = { ...d.stats };
  if (r.stats && typeof r.stats === 'object') {
    for (const k of Object.keys(d.stats)) {
      const v = (r.stats as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) stats[k] = v;
    }
  }

  return {
    version: SAVE_VERSION,
    credits: num(r.credits, d.credits),
    totalXp: num(r.totalXp, 0),
    ownedShips,
    selectedShip,
    ownedWeapons,
    primaryId,
    secondaryId,
    upgrades,
    completedMissions,
    missionRatings,
    achievements: strArr(r.achievements, []).filter(id => ACHIEVEMENT_IDS.has(id)),
    stats,
    paint: typeof r.paint === 'string' ? r.paint : 'default',
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return validateSave(JSON.parse(raw));
  } catch { return defaultSave(); }
}

export function persistSave(s: SaveData): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage full/blocked */ }
}
