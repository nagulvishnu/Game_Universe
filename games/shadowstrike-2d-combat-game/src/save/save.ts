/**
 * SHADOWSTRIKE — versioned localStorage save system.
 *
 * NOTE: browser localStorage is offline-friendly but is NOT tamper-proof.
 * A determined user can edit their own save; there is no server authority here.
 */

import { STARTER_WEAPONS, WEAPON_BY_ID } from '../data/weapons';
import { STARTER_SKILLS, SKILL_BY_ID } from '../data/skills';
import { DEFAULT_LOADOUT_EQUIPMENT, STARTER_EQUIPMENT, EQUIPMENT_BY_ID, type EquipSlot } from '../data/equipment';
import { BOSS_BY_ID } from '../data/bosses';

export const SAVE_VERSION = 4;
export const SAVE_KEY = 'shadowstrike.save.v1';

/** Cosmetic fighter appearance — light/dark body plus an accent colour. */
export interface LookConfig {
  variant: 'light' | 'dark';
  accent: number;
}

export const LOOK_VARIANTS: LookConfig['variant'][] = ['light', 'dark'];

export const LOOK_ACCENTS: { id: string; label: string; color: number }[] = [
  { id: 'white', label: 'Bone', color: 0xe8e8f2 },
  { id: 'ash', label: 'Ash', color: 0x8a8fa3 },
  { id: 'violet', label: 'Violet', color: 0xa855f7 },
  { id: 'azure', label: 'Azure', color: 0x38bdf8 },
  { id: 'cyan', label: 'Cyan', color: 0x22d3ee },
];

/** Accent swatches offered for each body variant. */
export const LOOK_SWATCHES: Record<LookConfig['variant'], number[]> = {
  light: [0xe8e8f2, 0x8a8fa3, 0xa855f7],
  dark: [0xe8e8f2, 0x38bdf8, 0x22d3ee],
};


export interface Loadout {
  weapon: string;
  skills: [string, string, string];
  equipment: Record<EquipSlot, string>;
}

export interface KeyBindings {
  left: string; right: string; jump: string; crouch: string;
  attack: string; skill1: string; skill2: string; skill3: string;
  dodge: string; block: string;
}

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  reducedMotion: boolean;
  damageNumbers: boolean;
  quality: 'low' | 'medium' | 'high';
  bindingsP1: KeyBindings;
  bindingsP2: KeyBindings;
}

export interface ProfileStats {
  wins: number; losses: number; matches: number;
  totalDamage: number; highestCombo: number;
  hardWins: number; bossWins: number; perfectWins: number;
  skillsUsed: number; playtimeMs: number;
}

export interface Profile {
  name: string;
  level: number;
  xp: number;
  shards: number;
  stats: ProfileStats;
  weaponUsage: Record<string, number>;
  skillUsage: Record<string, number>;
  unlockedWeapons: string[];
  unlockedSkills: string[];
  skillLevels: Record<string, number>;
  unlockedEquipment: string[];
  achievements: string[];
  skillUpgradesPurchased: number;
  loadout: Loadout;
  pvp: { p1: Loadout; p2: Loadout };
  savedLoadouts: { name: string; loadout: Loadout }[];
  defeatedBosses: string[];
  /** Cosmetic appearance selection (CHARACTER LOOK panel). */
  look: LookConfig;
}

export interface SaveData {
  version: number;
  profile: Profile;
  settings: Settings;
  updatedAt: number;
}

export const DEFAULT_BINDINGS_P1: KeyBindings = {
  left: 'KeyA', right: 'KeyD', jump: 'KeyW', crouch: 'KeyS',
  attack: 'KeyF', skill1: 'KeyE', skill2: 'KeyR', skill3: 'KeyV',
  dodge: 'Space', block: 'ShiftLeft',
};

export const DEFAULT_BINDINGS_P2: KeyBindings = {
  left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', crouch: 'ArrowDown',
  attack: 'KeyJ', skill1: 'KeyU', skill2: 'KeyI', skill3: 'KeyO',
  dodge: 'ControlRight', block: 'ShiftRight',
};

export function defaultLoadout(weapon = 'shadow_katana'): Loadout {
  return {
    weapon,
    skills: [...STARTER_SKILLS] as [string, string, string],
    equipment: { ...DEFAULT_LOADOUT_EQUIPMENT },
  };
}

export function defaultSettings(): Settings {
  return {
    masterVolume: 0.7, musicVolume: 0.45, sfxVolume: 0.8,
    screenShake: true, reducedMotion: false, damageNumbers: true, quality: 'high',
    bindingsP1: { ...DEFAULT_BINDINGS_P1 },
    bindingsP2: { ...DEFAULT_BINDINGS_P2 },
  };
}

export function defaultProfile(): Profile {
  const skillLevels: Record<string, number> = {};
  for (const id of STARTER_SKILLS) skillLevels[id] = 1;
  return {
    name: 'SHADOW',
    level: 1,
    xp: 0,
    shards: 800,
    stats: {
      wins: 0, losses: 0, matches: 0, totalDamage: 0, highestCombo: 0,
      hardWins: 0, bossWins: 0, perfectWins: 0, skillsUsed: 0, playtimeMs: 0,
    },
    weaponUsage: {},
    skillUsage: {},
    unlockedWeapons: [...STARTER_WEAPONS],
    unlockedSkills: [...STARTER_SKILLS],
    skillLevels,
    unlockedEquipment: [...STARTER_EQUIPMENT],
    achievements: [],
    skillUpgradesPurchased: 0,
    loadout: defaultLoadout(),
    pvp: { p1: defaultLoadout('shadow_katana'), p2: defaultLoadout('phantom_daggers') },
    savedLoadouts: [],
    defeatedBosses: [],
    look: { variant: 'dark', accent: LOOK_ACCENTS[0].color },
  };
}

export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, profile: defaultProfile(), settings: defaultSettings(), updatedAt: Date.now() };
}

/* ------------------------------------------------------------ validation */

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function sanitizeLoadout(v: unknown, fallback: Loadout): Loadout {
  const o = (v ?? {}) as Partial<Loadout>;
  const weapon = WEAPON_BY_ID[str(o.weapon, fallback.weapon)] ? str(o.weapon, fallback.weapon) : fallback.weapon;
  const rawSkills = arr(o.skills).filter((s): s is string => typeof s === 'string' && !!SKILL_BY_ID[s]);
  const skills = [0, 1, 2].map((i) => rawSkills[i] ?? fallback.skills[i]) as [string, string, string];
  const equipment = { ...DEFAULT_LOADOUT_EQUIPMENT };
  const eq = (o.equipment ?? {}) as Record<string, unknown>;
  for (const slot of Object.keys(equipment) as EquipSlot[]) {
    const id = str(eq[slot], equipment[slot]);
    if (EQUIPMENT_BY_ID[id] && EQUIPMENT_BY_ID[id].slot === slot) equipment[slot] = id;
  }
  return { weapon, skills, equipment };
}

function sanitizeBindings(v: unknown, d: KeyBindings): KeyBindings {
  const o = (v ?? {}) as Partial<KeyBindings>;
  const out = { ...d };
  for (const k of Object.keys(d) as (keyof KeyBindings)[]) out[k] = str(o[k], d[k]);
  return out;
}

function sanitizeLook(v: unknown, fallback: LookConfig): LookConfig {
  const o = (v ?? {}) as Partial<LookConfig>;
  const variant = o.variant === 'light' || o.variant === 'dark' ? o.variant : fallback.variant;
  const accent = LOOK_ACCENTS.some((a) => a.color === o.accent) ? (o.accent as number) : fallback.accent;
  return { variant, accent };
}

export function sanitize(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<SaveData>;
  const p = (data.profile ?? {}) as Partial<Profile>;
  const s = (data.settings ?? {}) as Partial<Settings>;
  const dp = base.profile;

  const unlockedWeapons = Array.from(
    new Set([...STARTER_WEAPONS, ...arr(p.unlockedWeapons).filter((x): x is string => typeof x === 'string' && !!WEAPON_BY_ID[x])]),
  );
  const unlockedSkills = Array.from(
    new Set([...STARTER_SKILLS, ...arr(p.unlockedSkills).filter((x): x is string => typeof x === 'string' && !!SKILL_BY_ID[x])]),
  );
  const defeatedBosses = Array.from(
    new Set(arr(p.defeatedBosses).filter((x): x is string => typeof x === 'string' && !!BOSS_BY_ID[x])),
  );
  const unlockedEquipment = Array.from(
    new Set([...STARTER_EQUIPMENT, ...arr(p.unlockedEquipment).filter((x): x is string => typeof x === 'string' && !!EQUIPMENT_BY_ID[x])]),
  );
  const skillLevels: Record<string, number> = {};
  for (const id of unlockedSkills) skillLevels[id] = 1;
  const rawLevels = (p.skillLevels ?? {}) as Record<string, unknown>;
  for (const [id, lvl] of Object.entries(rawLevels)) {
    if (SKILL_BY_ID[id] && unlockedSkills.includes(id)) {
      skillLevels[id] = Math.min(5, Math.max(1, Math.round(num(lvl, 1))));
    }
  }
  const stats = (p.stats ?? {}) as Partial<ProfileStats>;

  const profile: Profile = {
    name: str(p.name, dp.name).slice(0, 14) || 'SHADOW',
    level: Math.max(1, Math.round(num(p.level, 1))),
    xp: Math.max(0, num(p.xp, 0)),
    shards: Math.max(0, Math.round(num(p.shards, dp.shards))),
    stats: {
      wins: Math.max(0, Math.round(num(stats.wins, 0))),
      losses: Math.max(0, Math.round(num(stats.losses, 0))),
      matches: Math.max(0, Math.round(num(stats.matches, 0))),
      totalDamage: Math.max(0, Math.round(num(stats.totalDamage, 0))),
      highestCombo: Math.max(0, Math.round(num(stats.highestCombo, 0))),
      hardWins: Math.max(0, Math.round(num(stats.hardWins, 0))),
      bossWins: Math.max(0, Math.round(num(stats.bossWins, 0))),
      perfectWins: Math.max(0, Math.round(num(stats.perfectWins, 0))),
      skillsUsed: Math.max(0, Math.round(num(stats.skillsUsed, 0))),
      playtimeMs: Math.max(0, num(stats.playtimeMs, 0)),
    },
    weaponUsage: (p.weaponUsage && typeof p.weaponUsage === 'object' ? p.weaponUsage : {}) as Record<string, number>,
    skillUsage: (p.skillUsage && typeof p.skillUsage === 'object' ? p.skillUsage : {}) as Record<string, number>,
    unlockedWeapons,
    unlockedSkills,
    skillLevels,
    unlockedEquipment,
    defeatedBosses,
    achievements: arr(p.achievements).filter((x): x is string => typeof x === 'string'),
    skillUpgradesPurchased: Math.max(0, Math.round(num(p.skillUpgradesPurchased, 0))),
    loadout: sanitizeLoadout(p.loadout, dp.loadout),
    pvp: {
      p1: sanitizeLoadout(p.pvp?.p1, dp.pvp.p1),
      p2: sanitizeLoadout(p.pvp?.p2, dp.pvp.p2),
    },
    savedLoadouts: arr(p.savedLoadouts)
      .filter((x): x is { name: string; loadout: Loadout } => !!x && typeof x === 'object')
      .slice(0, 12)
      .map((x) => ({ name: str(x.name, 'Loadout'), loadout: sanitizeLoadout(x.loadout, dp.loadout) })),
    look: sanitizeLook(p.look, dp.look),
  };
  // make sure equipped items are actually owned
  const fixOwned = (l: Loadout) => {
    if (!unlockedWeapons.includes(l.weapon)) l.weapon = unlockedWeapons[0];
    l.skills = l.skills.map((id, i) => (unlockedSkills.includes(id) ? id : unlockedSkills[i] ?? unlockedSkills[0])) as [string, string, string];
    for (const slot of Object.keys(l.equipment) as EquipSlot[]) {
      if (!unlockedEquipment.includes(l.equipment[slot])) l.equipment[slot] = DEFAULT_LOADOUT_EQUIPMENT[slot];
    }
  };
  fixOwned(profile.loadout); fixOwned(profile.pvp.p1); fixOwned(profile.pvp.p2);

  const ds = base.settings;
  const settings: Settings = {
    masterVolume: clamp01(num(s.masterVolume, ds.masterVolume)),
    musicVolume: clamp01(num(s.musicVolume, ds.musicVolume)),
    sfxVolume: clamp01(num(s.sfxVolume, ds.sfxVolume)),
    screenShake: bool(s.screenShake, ds.screenShake),
    reducedMotion: bool(s.reducedMotion, ds.reducedMotion),
    damageNumbers: bool(s.damageNumbers, ds.damageNumbers),
    quality: (['low', 'medium', 'high'] as const).includes(s.quality as 'low') ? (s.quality as Settings['quality']) : ds.quality,
    bindingsP1: sanitizeBindings(s.bindingsP1, ds.bindingsP1),
    bindingsP2: sanitizeBindings(s.bindingsP2, ds.bindingsP2),
  };

  return { version: SAVE_VERSION, profile, settings, updatedAt: Date.now() };
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }

/* ------------------------------------------------------------ migrations */

export function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const data = raw as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : 0;
  // v0/v1 -> v2: pvp loadouts introduced
  if (version < 2) {
    const profile = (data.profile ?? {}) as Record<string, unknown>;
    if (!profile.pvp) {
      profile.pvp = { p1: profile.loadout ?? defaultLoadout(), p2: defaultLoadout('phantom_daggers') };
    }
    data.profile = profile;
    version = 2;
  }
  // v2 -> v3: savedLoadouts + skillUpgradesPurchased counters
  if (version < 3) {
    const profile = (data.profile ?? {}) as Record<string, unknown>;
    if (!Array.isArray(profile.savedLoadouts)) profile.savedLoadouts = [];
    if (typeof profile.skillUpgradesPurchased !== 'number') profile.skillUpgradesPurchased = 0;
    data.profile = profile;
    version = 3;
  }
  // v3 -> v4: character look (light/dark variant + accent colour)
  if (version < 4) {
    const profile = (data.profile ?? {}) as Record<string, unknown>;
    if (!profile.look || typeof profile.look !== 'object') {
      profile.look = { variant: 'dark', accent: LOOK_ACCENTS[0].color };
    }
    data.profile = profile;
    version = 4;
  }
  data.version = version;
  return data;
}

/* ---------------------------------------------------------------- IO */

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed: unknown = JSON.parse(raw);
    return sanitize(migrate(parsed));
  } catch (err) {
    console.warn('[SHADOWSTRIKE] Save data was unreadable; starting a fresh profile.', err);
    return defaultSave();
  }
}

let writeTimer: number | undefined;
export function writeSave(data: SaveData): void {
  if (typeof window === 'undefined') return;
  if (writeTimer !== undefined) window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION, updatedAt: Date.now() }));
    } catch (err) {
      console.warn('[SHADOWSTRIKE] Could not persist save data.', err);
    }
  }, 220);
}

export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

/* ------------------------------------------------------------ progression */

export function xpForLevel(level: number): number {
  return Math.round(350 * Math.pow(level, 1.42));
}

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let remaining = xp;
  while (level < 60 && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, into: remaining, need: xpForLevel(level) };
}
