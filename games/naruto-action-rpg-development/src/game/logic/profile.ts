import type { ActiveMission, CharId } from '../types';
import { CHARACTERS, CHAR_IDS } from '../data/characters';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/abilities';
import { MISSIONS } from '../data/missions';
import { ABILITIES } from '../data/abilities';
import { MAX_LEVEL } from './stats';
import { SAVE_VERSION } from '../config';

export interface CharProgress { level: number; xp: number; sp: number; skills: string[]; equipped: string[] }
export interface Profile {
  charId: CharId; unlocked: CharId[]; chars: Record<CharId, CharProgress>;
  inventory: Record<string, number>;
  equipment: { weapon: string | null; armor: string | null; accessory: string | null };
  upgrades: Record<string, number>; ryo: number;
  completed: string[]; activeMission: ActiveMission | null; flags: Record<string, boolean>;
  collected: string[]; kills: number; bossesDefeated: string[]; playtime: number; timeOfDay: number;
  pos: { x: number; z: number };
}
export interface SaveData { version: number; savedAt: number; slot: string; label: string; profile: Profile }

export function defaultChar(id: CharId): CharProgress {
  return { level: 1, xp: 0, sp: 0, skills: [], equipped: CHARACTERS[id].abilities.slice(0, 4) };
}
export function defaultProfile(): Profile {
  const chars = {} as Record<CharId, CharProgress>;
  for (const id of CHAR_IDS) chars[id] = defaultChar(id);
  return {
    charId: 'naruto', unlocked: ['naruto'], chars,
    inventory: { ramen: 3, soldierPill: 2, kunai: 12, academyKunai: 1, academyOutfit: 1 },
    equipment: { weapon: 'academyKunai', armor: 'academyOutfit', accessory: null },
    upgrades: {}, ryo: 200, completed: [], activeMission: null, flags: {}, collected: [], kills: 0,
    bossesDefeated: [], playtime: 0, timeOfDay: 0.3, pos: { x: 2, z: 18 },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const strArr = (v: unknown, valid: (s: string) => boolean): string[] => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && valid(s)))] : []);

/** Coerce arbitrary data into a valid profile; returns null if hopelessly corrupt. */
export function sanitizeProfile(raw: unknown): Profile | null {
  if (!isObj(raw)) return null;
  const d = defaultProfile();
  const unlocked = strArr(raw.unlocked, (s) => CHAR_IDS.includes(s as CharId)) as CharId[];
  if (!unlocked.includes('naruto')) unlocked.unshift('naruto');
  const charId = CHAR_IDS.includes(raw.charId as CharId) && unlocked.includes(raw.charId as CharId) ? (raw.charId as CharId) : 'naruto';
  const chars = {} as Record<CharId, CharProgress>;
  const rc = isObj(raw.chars) ? raw.chars : {};
  for (const id of CHAR_IDS) {
    const c = isObj(rc[id]) ? (rc[id] as Record<string, unknown>) : {};
    const eq = strArr(c.equipped, (s) => !!ABILITIES[s] && CHARACTERS[id].abilities.includes(s)).slice(0, 4);
    const def = defaultChar(id);
    chars[id] = {
      level: Math.floor(num(c.level, 1, 1, MAX_LEVEL)), xp: Math.max(0, Math.floor(num(c.xp, 0))), sp: Math.max(0, Math.floor(num(c.sp, 0))),
      skills: strArr(c.skills, (s) => !!SKILLS[s]), equipped: eq.length === 4 ? eq : def.equipped,
    };
  }
  const inventory: Record<string, number> = {};
  if (isObj(raw.inventory)) for (const k in raw.inventory) if (ITEMS[k]) { const n = Math.floor(num(raw.inventory[k], 0, 0, 99999)); if (n > 0) inventory[k] = n; }
  const eqRaw = isObj(raw.equipment) ? raw.equipment : {};
  const pick = (v: unknown, type: string) => (typeof v === 'string' && ITEMS[v]?.type === type ? v : null);
  const upgrades: Record<string, number> = {};
  if (isObj(raw.upgrades)) for (const k in raw.upgrades) if (ITEMS[k]) upgrades[k] = Math.floor(num(raw.upgrades[k], 0, 0, 5));
  const flags: Record<string, boolean> = {};
  if (isObj(raw.flags)) for (const k in raw.flags) if (raw.flags[k] === true) flags[k] = true;
  let activeMission: ActiveMission | null = null;
  if (isObj(raw.activeMission) && typeof raw.activeMission.id === 'string') {
    const def = MISSIONS.find((m) => m.id === (raw.activeMission as Record<string, unknown>).id);
    if (def && def.status === 'playable') {
      const am = raw.activeMission as Record<string, unknown>;
      const stage = Math.floor(num(am.stage, 0, 0, def.stages.length - 1));
      const prog = Array.isArray(am.progress) ? am.progress.map((v) => num(v, 0, 0, 1e6)) : [];
      activeMission = { id: def.id, stage, progress: def.stages[stage].objectives.map((_, i) => prog[i] ?? 0), elapsed: num(am.elapsed, 0, 0) };
    }
  }
  const p = isObj(raw.pos) ? raw.pos : {};
  return {
    charId, unlocked, chars,
    inventory: Object.keys(inventory).length ? inventory : d.inventory,
    equipment: { weapon: pick(eqRaw.weapon, 'weapon') ?? d.equipment.weapon, armor: pick(eqRaw.armor, 'armor') ?? d.equipment.armor, accessory: pick(eqRaw.accessory, 'accessory') },
    upgrades, ryo: Math.floor(num(raw.ryo, d.ryo, 0, 1e9)),
    completed: strArr(raw.completed, (s) => MISSIONS.some((m) => m.id === s)), activeMission, flags,
    collected: strArr(raw.collected, () => true), kills: Math.floor(num(raw.kills, 0, 0)),
    bossesDefeated: strArr(raw.bossesDefeated, () => true), playtime: num(raw.playtime, 0, 0), timeOfDay: num(raw.timeOfDay, 0.3, 0, 1),
    pos: { x: num(p.x, d.pos.x, -340, 340), z: num(p.z, d.pos.z, -320, 330) },
  };
}

export function validateSave(raw: unknown): SaveData | null {
  if (!isObj(raw)) return null;
  if (typeof raw.version !== 'number' || raw.version > SAVE_VERSION || raw.version < 1) return null;
  const profile = sanitizeProfile(raw.profile);
  if (!profile) return null;
  return { version: SAVE_VERSION, savedAt: num(raw.savedAt, Date.now()), slot: typeof raw.slot === 'string' ? raw.slot : 'slot1', label: typeof raw.label === 'string' ? raw.label.slice(0, 80) : 'Save', profile };
}
