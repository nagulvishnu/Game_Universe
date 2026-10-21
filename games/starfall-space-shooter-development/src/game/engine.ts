// ─── Pure gameplay math: damage, homing, boss phases, rewards, saves ────────

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

/** Validate arbitrary parsed JSON into a safe SaveData. Corrupted fields fall back to defaults. */
export function validateSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  const num = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fb);
  const strArr = (v: unknown, fb: string[]) => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : fb);
  return {
    version: SAVE_VERSION,
    credits: num(r.credits, d.credits),
    totalXp: num(r.totalXp, 0),
    ownedShips: strArr(r.ownedShips, d.ownedShips).length ? strArr(r.ownedShips, d.ownedShips) : d.ownedShips,
    selectedShip: typeof r.selectedShip === 'string' ? r.selectedShip : d.selectedShip,
    ownedWeapons: strArr(r.ownedWeapons, d.ownedWeapons).length ? strArr(r.ownedWeapons, d.ownedWeapons) : d.ownedWeapons,
    primaryId: typeof r.primaryId === 'string' ? r.primaryId : d.primaryId,
    secondaryId: typeof r.secondaryId === 'string' ? r.secondaryId : d.secondaryId,
    upgrades: (r.upgrades && typeof r.upgrades === 'object') ? r.upgrades as Record<string, number> : {},
    completedMissions: Array.isArray(r.completedMissions) ? r.completedMissions.filter(x => typeof x === 'number') : [],
    missionRatings: (r.missionRatings && typeof r.missionRatings === 'object') ? r.missionRatings as Record<number, string> : {},
    achievements: strArr(r.achievements, []),
    stats: { ...d.stats, ...((r.stats && typeof r.stats === 'object') ? r.stats : {}) },
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
