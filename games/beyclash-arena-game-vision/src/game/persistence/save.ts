import { PART_MAP, STARTER_CONFIG, STARTER_PARTS } from '../../data/parts';
import { RIVALS } from '../../data/rivals';
import { TOURNAMENTS } from '../../data/tournaments';
import { START_POINTS } from '../economy/economy';
import type { ActiveTournament } from '../tournaments/bracket';
import type { BeyConfig, RivalProgress } from '../types';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'beyclash.save';
export const SETTINGS_KEY = 'beyclash.settings';
export const MAX_LEVEL = 30;

export interface TournamentRecord {
  wins: number;
  entered: number;
  active: ActiveTournament | null;
  history: { at: number; result: string }[];
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  profile: { name: string; outfit: number };
  level: number;
  xp: number;
  points: number;
  reputation: number;
  rivals: Record<string, RivalProgress>;
  stats: {
    battles: number; wins: number; losses: number;
    finishes: { SPIN: number; RING_OUT: number; BURST: number };
    pointsWon: number; pointsLost: number; playSeconds: number;
  };
  owned: string[];
  config: BeyConfig;
  tournaments: Record<string, TournamentRecord>;
  training: { spin: boolean; ringOut: boolean; burst: boolean };
  flags: Record<string, boolean>;
  clock: number;
  pos: { x: number; z: number };
  lastBattleId: string;
}

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  resolution: number;
  sfx: number;
  music: number;
  mouseSens: number;
  camSens: number;
  invertY: boolean;
}
export const DEFAULT_SETTINGS: Settings = { quality: 'medium', resolution: 1, sfx: 0.7, music: 0.5, mouseSens: 1, camSens: 1, invertY: false };

export function defaultRival(id: string): RivalProgress {
  const def = RIVALS.find((r) => r.id === id);
  return { points: 0, defeated: false, wins: 0, losses: 0, wallet: def?.wallet ?? 1000, met: false, bonusClaimed: false };
}

export function defaultSave(name = 'Rookie', outfit = 0): SaveData {
  const rivals: Record<string, RivalProgress> = {};
  for (const r of RIVALS) rivals[r.id] = defaultRival(r.id);
  const tournaments: Record<string, TournamentRecord> = {};
  for (const t of TOURNAMENTS) tournaments[t.id] = { wins: 0, entered: 0, active: null, history: [] };
  const now = Date.now();
  return {
    version: SAVE_VERSION, createdAt: now, updatedAt: now,
    profile: { name, outfit },
    level: 1, xp: 0, points: START_POINTS, reputation: 0,
    rivals,
    stats: { battles: 0, wins: 0, losses: 0, finishes: { SPIN: 0, RING_OUT: 0, BURST: 0 }, pointsWon: 0, pointsLost: 0, playSeconds: 0 },
    owned: [...STARTER_PARTS],
    config: { ...STARTER_CONFIG },
    tournaments,
    training: { spin: false, ringOut: false, burst: false },
    flags: {},
    clock: 0.32,
    pos: { x: -55, z: -40 },
    lastBattleId: '',
  };
}

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Versioned migrations: key = version being migrated FROM. */
const MIGRATIONS: Record<number, (d: Record<string, any>) => Record<string, any>> = {
  0: (d) => ({ ...d, version: 1, flags: d.flags ?? {}, training: d.training ?? { spin: false, ringOut: false, burst: false }, lastBattleId: d.lastBattleId ?? '' }),
};

export function migrate(raw: unknown): Record<string, any> | null {
  if (!isObj(raw)) return null;
  let d: Record<string, any> = raw;
  let v = typeof d.version === 'number' ? d.version : 0;
  if (v > SAVE_VERSION) return null; // from a newer build: do not touch
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) return null;
    d = m(d);
    v = d.version;
  }
  return d;
}

/** Validate + repair. Never throws; unknown ids are dropped, valid progress is preserved. */
export function sanitize(raw: unknown): SaveData | null {
  const d = migrate(raw);
  if (!d) return null;
  const base = defaultSave(typeof d.profile?.name === 'string' ? d.profile.name.slice(0, 16) || 'Rookie' : 'Rookie', num(d.profile?.outfit, 0, 0, 5));
  base.createdAt = num(d.createdAt, base.createdAt);
  base.updatedAt = num(d.updatedAt, base.updatedAt);
  base.level = Math.round(num(d.level, 1, 1, MAX_LEVEL));
  base.xp = Math.round(num(d.xp, 0, 0));
  base.points = Math.round(num(d.points, START_POINTS, 0));
  base.reputation = Math.round(num(d.reputation, 0, 0));
  if (isObj(d.rivals)) {
    for (const id of Object.keys(base.rivals)) {
      const r = d.rivals[id];
      if (!isObj(r)) continue;
      const pts = Math.round(num(r.points, 0, 0, 5));
      base.rivals[id] = {
        points: pts, defeated: r.defeated === true || pts >= 5,
        wins: Math.round(num(r.wins, 0, 0)), losses: Math.round(num(r.losses, 0, 0)),
        wallet: Math.round(num(r.wallet, base.rivals[id].wallet, 0)), met: r.met === true, bonusClaimed: r.bonusClaimed === true,
      };
    }
  }
  if (isObj(d.stats)) {
    const s = d.stats;
    base.stats = {
      battles: Math.round(num(s.battles, 0, 0)), wins: Math.round(num(s.wins, 0, 0)), losses: Math.round(num(s.losses, 0, 0)),
      finishes: { SPIN: Math.round(num(s.finishes?.SPIN, 0, 0)), RING_OUT: Math.round(num(s.finishes?.RING_OUT, 0, 0)), BURST: Math.round(num(s.finishes?.BURST, 0, 0)) },
      pointsWon: Math.round(num(s.pointsWon, 0, 0)), pointsLost: Math.round(num(s.pointsLost, 0, 0)), playSeconds: Math.round(num(s.playSeconds, 0, 0)),
    };
  }
  if (Array.isArray(d.owned)) {
    const owned = d.owned.filter((id: unknown) => typeof id === 'string' && PART_MAP[id]);
    base.owned = Array.from(new Set([...STARTER_PARTS, ...owned]));
  }
  if (isObj(d.config)) {
    const c = d.config;
    const ok = (id: unknown, slot: string) => typeof id === 'string' && PART_MAP[id]?.slot === slot && base.owned.includes(id);
    base.config = {
      name: typeof c.name === 'string' ? c.name.slice(0, 18) || base.config.name : base.config.name,
      color: typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : base.config.color,
      layer: ok(c.layer, 'layer') ? c.layer : base.config.layer,
      disc: ok(c.disc, 'disc') ? c.disc : base.config.disc,
      driver: ok(c.driver, 'driver') ? c.driver : base.config.driver,
      accessory: ok(c.accessory, 'accessory') ? c.accessory : base.config.accessory,
    };
  }
  if (isObj(d.tournaments)) {
    for (const id of Object.keys(base.tournaments)) {
      const t = d.tournaments[id];
      if (!isObj(t)) continue;
      const a = t.active;
      const active = isObj(a) && Array.isArray(a.entrants) && Array.isArray(a.winners) && Array.isArray(a.finishes) && a.id === id ? (a as ActiveTournament) : null;
      base.tournaments[id] = {
        wins: Math.round(num(t.wins, 0, 0)), entered: Math.round(num(t.entered, 0, 0)), active,
        history: Array.isArray(t.history) ? t.history.filter((h: any) => isObj(h) && typeof h.result === 'string').slice(-20) : [],
      };
    }
  }
  if (isObj(d.training)) base.training = { spin: d.training.spin === true, ringOut: d.training.ringOut === true, burst: d.training.burst === true };
  if (isObj(d.flags)) base.flags = Object.fromEntries(Object.entries(d.flags).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>;
  base.clock = num(d.clock, 0.32, 0, 1);
  base.pos = { x: num(d.pos?.x, base.pos.x, -105, 105), z: num(d.pos?.z, base.pos.z, -68, 68) };
  base.lastBattleId = typeof d.lastBattleId === 'string' ? d.lastBattleId : '';
  return base;
}

export interface LoadResult {
  save: SaveData | null;
  error?: string;
}

export function loadSave(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): LoadResult {
  let text: string | null = null;
  try { text = storage.getItem(SAVE_KEY); } catch (e) { return { save: null, error: 'Storage unavailable: ' + String(e) }; }
  if (!text) return { save: null };
  try {
    const save = sanitize(JSON.parse(text));
    if (save) return { save };
    storage.setItem(SAVE_KEY + '.backup', text);
    return { save: null, error: 'Save data was invalid or from a newer version. A backup copy was kept.' };
  } catch (e) {
    try { storage.setItem(SAVE_KEY + '.backup', text); } catch { /* ignore */ }
    return { save: null, error: 'Save data was corrupted. A backup copy was kept. (' + String(e) + ')' };
  }
}

export function writeSave(save: SaveData, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, updatedAt: Date.now() }));
    return true;
  } catch (e) {
    console.error('Failed to write save', e);
    return false;
  }
}

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    if (!isObj(raw)) return { ...DEFAULT_SETTINGS };
    return {
      quality: raw.quality === 'low' || raw.quality === 'high' ? raw.quality : 'medium',
      resolution: num(raw.resolution, 1, 0.5, 1),
      sfx: num(raw.sfx, 0.7, 0, 1), music: num(raw.music, 0.5, 0, 1),
      mouseSens: num(raw.mouseSens, 1, 0.2, 3), camSens: num(raw.camSens, 1, 0.2, 3), invertY: raw.invertY === true,
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function writeSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { console.error('Failed to save settings', e); }
}
