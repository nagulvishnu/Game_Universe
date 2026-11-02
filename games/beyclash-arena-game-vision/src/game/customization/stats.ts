import { PART_MAP, type PartDef, type StatMods } from '../../data/parts';
import type { BeyConfig } from '../types';

export interface BeyStats {
  attack: number;
  defense: number;
  stamina: number;
  balance: number;
  speed: number;
  weight: number;
  burstResist: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function configParts(cfg: BeyConfig): PartDef[] {
  return [cfg.layer, cfg.disc, cfg.driver, cfg.accessory].map((id) => PART_MAP[id]).filter(Boolean) as PartDef[];
}

export function computeStats(cfg: BeyConfig): BeyStats {
  const m: Required<StatMods> = { atk: 0, def: 0, sta: 0, bal: 0, spd: 0, wt: 10, brs: 0 };
  for (const p of configParts(cfg)) {
    for (const k of Object.keys(p.mods) as (keyof StatMods)[]) m[k] += p.mods[k] ?? 0;
  }
  const defense = clamp(40 + m.def, 5, 100);
  const weight = Math.max(40, m.wt);
  return {
    attack: clamp(40 + m.atk, 5, 100),
    defense,
    stamina: clamp(40 + m.sta, 5, 100),
    balance: clamp(40 + m.bal, 5, 100),
    speed: clamp(40 + m.spd, 5, 100),
    weight,
    burstResist: clamp(55 + defense * 0.25 + weight * 0.45 + m.brs, 20, 150),
  };
}

export type BeyType = 'Attack' | 'Defense' | 'Stamina' | 'Balance';

export function beyType(s: BeyStats): BeyType {
  const a = s.attack + (s.speed - 40) * 0.5;
  const d = s.defense + (s.weight - 90) * 0.3;
  const st = s.stamina;
  const best = Math.max(a, d, st);
  const spread = best - Math.min(a, d, st);
  if (spread < 12) return 'Balance';
  if (best === a) return 'Attack';
  if (best === d) return 'Defense';
  return 'Stamina';
}

/** Single number to compare builds (used by UI & tournament seeding). */
export function power(s: BeyStats): number {
  return Math.round(s.attack + s.defense + s.stamina + s.balance * 0.5 + s.speed * 0.5 + s.burstResist * 0.2);
}
