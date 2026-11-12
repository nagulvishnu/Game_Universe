import { useSyncExternalStore } from "react";
import { Showroom } from "../game/showroom";
import { store } from "../game/store";
import { CarDef, RaceSettings, carById, derive } from "../game/data";
import type { PlayerSetup, HudState, RaceResult } from "../game/race";

export type Screen = "menu" | "setup" | "garage" | "settings" | "credits" | "race" | "results" | "champ";

export interface ChampState {
  round: number;
  total: number;
  points: [number, number];
  history: { track: string; pos: [number, number]; pts: [number, number] }[];
  settings: RaceSettings;
  done: boolean;
}

let sr: Showroom | null = null;
export const getShowroom = () => sr ?? (sr = new Showroom());

export function setupFor(p: number): PlayerSetup {
  const pr = store.get().profiles[p];
  const def = carById(pr.unlocked.includes(pr.selected) ? pr.selected : "kitsune");
  return { carId: def.id, custom: pr.custom[def.id], upgrades: pr.upgrades[def.id], name: pr.name };
}

export const POINTS = [25, 18];

class HudStore {
  state: HudState | null = null;
  listeners = new Set<() => void>();
  set = (s: HudState | null) => {
    this.state = s;
    this.listeners.forEach((l) => l());
  };
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
}
export const hudStore = new HudStore();
export const useHud = () => useSyncExternalStore(hudStore.subscribe, hudStore.get);

/** Stat values (0..10 scale) including upgrade bonuses. */
export function boosted(def: CarDef, up: number[]) {
  const d0 = derive(def, [0, 0, 0, 0, 0, 0, 0]);
  const d = derive(def, up);
  const s = def.stats;
  return {
    base: s,
    bonus: {
      speed: (d.topSpeed - d0.topSpeed) / 2.8,
      accel: (d.accel - d0.accel) / 1.05,
      handling: (d.latLimit - d0.latLimit) / 2.3 * 0.7 + (d.grip - d0.grip) / 0.85 * 0.3,
      drift: 0,
      nitro: (d.nitroCap - d0.nitroCap) / 6,
      braking: (d.brake - d0.brake) / 1.7,
    },
  };
}

export const money = (n: number) => "¤" + n.toLocaleString();

export type { PlayerSetup, HudState, RaceResult };
