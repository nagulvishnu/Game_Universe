import { ALL_SKILLS } from './data/styles';
import { CHAR_BY_ID } from './data/characters';
import type { CharProg, Profile, Settings } from './types';

export const SAVE_VERSION = 3;
const DB_NAME = 'breathing-world';
const STORE = 'saves';
const SETTINGS_KEY = 'dsbw.settings.v1';

export const defaultSettings = (): Settings => ({
  gfx: 'medium', renderScale: 1, shadows: 'low', music: 0.55, sfx: 0.8, ambience: 0.6, sens: 1, invertY: false, fov: 62, showFps: false, shake: 1,
});

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultSettings();
}
export function storeSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function newChar(id: string, level: number): CharProg {
  const def = CHAR_BY_ID[id];
  const unlocked = def.forms.slice(0, 2).filter((f) => ALL_SKILLS[f]);
  return {
    level, xp: 0, sp: level, unlocked, equipped: [unlocked[0] ?? null, unlocked[1] ?? null, null, null], passives: {}, kills: 0,
  };
}

export function defaultProfile(): Profile {
  return {
    version: SAVE_VERSION, created: Date.now(), playtime: 0, activeChar: 'tanjiro', unlockedChars: ['tanjiro'],
    chars: { tanjiro: newChar('tanjiro', 1) }, chapter: 0, questsDone: [], bosses: [],
    inventory: { rice_ball: 3, herb: 1, steel_shard: 1 }, swords: { sw_std: 0 }, equippedSword: { tanjiro: 'sw_std' },
    equipment: { haori: null, uniform: 'uniform_corps', charm: null }, sen: 150, cp: 0, collectibles: [], discoveries: [],
    regions: ['sagiri'], region: 'sagiri', clock: 0.35, flags: {}, kills: 0, settings: loadSettings(),
  };
}

/** Validate and repair a raw save object. Returns null if unusable. */
export function sanitize(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Profile>;
  if (!r.chars || typeof r.chars !== 'object' || !Array.isArray(r.unlockedChars)) return null;
  const base = defaultProfile();
  const p: Profile = { ...base, ...r, version: SAVE_VERSION } as Profile;
  p.settings = { ...defaultSettings(), ...(r.settings ?? {}) };
  p.unlockedChars = p.unlockedChars.filter((c) => CHAR_BY_ID[c]);
  if (!p.unlockedChars.includes('tanjiro')) p.unlockedChars.unshift('tanjiro');
  p.chars = { ...p.chars };
  for (const id of p.unlockedChars) {
    const cp = p.chars[id] as CharProg | undefined;
    const fresh = newChar(id, 1);
    p.chars[id] = {
      ...fresh, ...(cp ?? {}),
      level: Math.min(40, Math.max(1, Number(cp?.level) || 1)),
      unlocked: (cp?.unlocked ?? fresh.unlocked).filter((s) => ALL_SKILLS[s]),
      equipped: [0, 1, 2, 3].map((i) => { const s = cp?.equipped?.[i]; return s && ALL_SKILLS[s] ? s : null; }),
      passives: { ...(cp?.passives ?? {}) },
    };
    if (!p.equippedSword[id]) p.equippedSword[id] = 'sw_std';
  }
  if (!CHAR_BY_ID[p.activeChar] || !p.unlockedChars.includes(p.activeChar)) p.activeChar = 'tanjiro';
  p.equipment = { ...base.equipment, ...(r.equipment ?? {}) };
  p.swords = { sw_std: 0, ...(r.swords ?? {}) };
  p.inventory = { ...(r.inventory ?? {}) };
  p.flags = { ...(r.flags ?? {}) };
  p.chapter = Math.min(12, Math.max(0, Number(p.chapter) || 0));
  return p;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key: string): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbPut(key: string, val: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveProfile(p: Profile): Promise<boolean> {
  try {
    const prev = await idbGet('slot1');
    if (prev) await idbPut('backup', prev);
    await idbPut('slot1', { version: SAVE_VERSION, savedAt: Date.now(), profile: p });
    storeSettings(p.settings);
    return true;
  } catch { return false; }
}

export async function loadProfile(): Promise<Profile | null> {
  for (const key of ['slot1', 'backup']) {
    try {
      const v = (await idbGet(key)) as { profile?: unknown } | undefined;
      const p = sanitize(v?.profile);
      if (p) { p.settings = { ...p.settings }; return p; }
    } catch { /* try next */ }
  }
  return null;
}

export async function hasSave(): Promise<boolean> { return (await loadProfile()) !== null; }
