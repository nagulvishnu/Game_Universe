import type { CharacterDef, Element, ModKey } from '../types';
import { SKILLS, ABILITIES } from '../data/abilities';
import { ITEMS } from '../data/items';
import { RANKS } from '../data/missions';

export const MAX_LEVEL = 30;
/** XP needed to advance from `level` to `level + 1`. */
export const xpForLevel = (level: number) => Math.round(45 * Math.pow(level, 1.5));

export function addXp(level: number, xp: number, gain: number): { level: number; xp: number; gained: number } {
  let l = level, x = xp + Math.max(0, gain), gained = 0;
  while (l < MAX_LEVEL && x >= xpForLevel(l)) { x -= xpForLevel(l); l++; gained++; }
  if (l >= MAX_LEVEL) x = 0;
  return { level: l, xp: x, gained };
}

export function rankIndexFor(level: number, genin: boolean): number {
  if (!genin) return 0;
  let r = 1;
  for (const k of RANKS) if (k.id >= 1 && level >= k.minLevel) r = k.id;
  return r;
}

const BEATS: Record<Element, Element | null> = { wind: 'lightning', lightning: 'earth', earth: 'water', water: 'fire', fire: 'wind', none: null };
/** Fire > Wind > Lightning > Earth > Water > Fire. */
export function elementMultiplier(att: Element, def: Element, bonus = 0): number {
  if (att === 'none' || def === 'none') return 1;
  if (BEATS[att] === def) return 1.5 + bonus;
  if (BEATS[def] === att) return Math.max(0.5, 0.7 - bonus * 0.5);
  return 1;
}

export type Mods = Record<ModKey, number>;
export function skillMods(skills: string[]): Mods {
  const m = { dmgPhys: 0, dmgJutsu: 0, hp: 0, chakra: 0, regen: 0, cdr: 0, ult: 0, def: 0, dodge: 0, cloneCount: 0, cloneTime: 0, formTime: 0, formDrain: 0, chargeSpeed: 0, elementBonus: 0, subCost: 0, autoSub: 0, sage: 0, kurama: 0, atk: 0, crit: 0, parry: 0 } as Mods;
  for (const id of skills) { const n = SKILLS[id]; if (!n) continue; for (const k in n.mods) m[k as ModKey] += n.mods[k as ModKey] ?? 0; }
  return m;
}

export interface Equipment { weapon: string | null; armor: string | null; accessory: string | null }
export interface EquipBonus { atk: number; def: number; hp: number; chakra: number; regen: number; ryo: number; speed: number }
export function equipmentBonus(eq: Equipment, upgrades: Record<string, number>): EquipBonus {
  const b: EquipBonus = { atk: 0, def: 0, hp: 0, chakra: 0, regen: 0, ryo: 0, speed: 0 };
  for (const id of [eq.weapon, eq.armor, eq.accessory]) {
    if (!id) continue; const it = ITEMS[id]; if (!it?.stats) continue;
    const mul = 1 + 0.15 * (upgrades[id] ?? 0);
    for (const k in it.stats) b[k as keyof EquipBonus] += (it.stats[k as keyof EquipBonus] ?? 0) * (k === 'ryo' || k === 'regen' || k === 'speed' ? 1 : mul);
  }
  return b;
}

export interface DerivedStats {
  maxHp: number; maxChakra: number; maxStamina: number; atk: number; def: number; speed: number; jump: number;
  regen: number; mods: Mods; eq: EquipBonus; crit: number; ryoMul: number;
}
export function computeStats(ch: CharacterDef, level: number, skills: string[], eq: Equipment, upgrades: Record<string, number> = {}): DerivedStats {
  const mods = skillMods(skills); const b = equipmentBonus(eq, upgrades); const l = level - 1;
  const maxHp = Math.round((ch.stats.hp + ch.growth.hp * l + b.hp) * (1 + mods.hp));
  const maxChakra = Math.round(ch.stats.chakra + ch.growth.chakra * l + b.chakra + mods.chakra);
  return {
    maxHp, maxChakra, maxStamina: 100, mods, eq: b,
    atk: ch.stats.atk + ch.growth.atk * l + b.atk + mods.atk,
    def: ch.stats.def + l * 0.9 + b.def + mods.def,
    speed: ch.stats.speed + b.speed,
    jump: ch.stats.jump,
    regen: (3 + maxChakra * 0.012) * (1 + mods.regen + b.regen),
    crit: 0.05 + mods.crit,
    ryoMul: 1 + b.ryo,
  };
}

export interface DamageInput { atk: number; power: number; defense: number; elemMult?: number; crit?: boolean; bonus?: number; variance?: number }
export function calcDamage(i: DamageInput): number {
  const mitig = 100 / (100 + Math.max(0, i.defense) * 4);
  const v = i.variance ?? 1;
  return Math.max(1, Math.round(i.atk * i.power * mitig * (i.elemMult ?? 1) * (i.crit ? 1.6 : 1) * (1 + (i.bonus ?? 0)) * v));
}
/** Damage taken by the player after defense and incoming guard multiplier. */
export function calcIncoming(raw: number, defense: number, guard = 1): number {
  return Math.max(1, Math.round(raw * (100 / (100 + defense * 5)) * guard));
}

export function isAbilityUnlocked(id: string, level: number, flags: Record<string, boolean>): boolean {
  const a = ABILITIES[id]; if (!a) return false;
  return level >= a.unlockLevel && (!a.unlockFlag || !!flags[a.unlockFlag]);
}
export function isFormUnlocked(form: 'sage' | 'kurama', charId: string, level: number, skills: string[], flags: Record<string, boolean>): boolean {
  if (charId !== 'naruto') return false;
  const m = skillMods(skills);
  if (form === 'sage') return m.sage > 0 && level >= 6 && !!flags.sageTraining;
  return m.kurama > 0 && level >= 10 && m.sage > 0;
}
