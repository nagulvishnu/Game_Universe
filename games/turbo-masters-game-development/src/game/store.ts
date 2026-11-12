import { useSyncExternalStore } from "react";
import { CARS, GFX_PRESETS, Gfx, Custom, defaultCustom, carById, upgradeCost, MAX_UPGRADE } from "./data";

export interface Profile {
  name: string;
  money: number;
  unlocked: string[];
  upgrades: Record<string, number[]>;
  custom: Record<string, Custom>;
  selected: string;
  records: Record<string, number>;
  stats: { races: number; wins: number; drift: number; earned: number };
  pad: number; // -1 = auto/none, else gamepad index
}
export interface Settings {
  music: number;
  sfx: number;
  gfx: Gfx;
}
export interface SaveData {
  profiles: [Profile, Profile];
  settings: Settings;
}

const KEY = "turbo-masters-save-v1";
const starters = CARS.filter((c) => c.price === 0).map((c) => c.id);

function newProfile(i: number): Profile {
  const custom: Record<string, Custom> = {};
  const upgrades: Record<string, number[]> = {};
  CARS.forEach((c) => {
    custom[c.id] = defaultCustom(c);
    upgrades[c.id] = [0, 0, 0, 0, 0, 0, 0];
  });
  return {
    name: `PLAYER ${i + 1}`, money: 2500, unlocked: [...starters], upgrades, custom,
    selected: i === 0 ? "kitsune" : "hachi", records: {}, stats: { races: 0, wins: 0, drift: 0, earned: 0 }, pad: -1,
  };
}
function fresh(): SaveData {
  return { profiles: [newProfile(0), newProfile(1)], settings: { music: 0.6, sfx: 0.8, gfx: { ...GFX_PRESETS.high } } };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as SaveData;
      const f = fresh();
      // merge defaults for forward compat
      d.profiles = d.profiles.map((p, i) => {
        const base = newProfile(i);
        return { ...base, ...p, custom: { ...base.custom, ...p.custom }, upgrades: { ...base.upgrades, ...p.upgrades } };
      }) as [Profile, Profile];
      d.settings = { ...f.settings, ...d.settings, gfx: { ...f.settings.gfx, ...d.settings?.gfx } };
      return d;
    }
  } catch {
    /* ignore */
  }
  return fresh();
}

let data: SaveData = load();
const listeners = new Set<() => void>();
let saveTimer: any = 0;

export const store = {
  get: () => data,
  update(fn: (d: SaveData) => void) {
    const next = JSON.parse(JSON.stringify(data)) as SaveData;
    fn(next);
    data = next;
    listeners.forEach((l) => l());
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
    }, 150);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  reset() {
    data = fresh();
    listeners.forEach((l) => l());
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  },
};
export function useSave() {
  return useSyncExternalStore(store.subscribe, store.get);
}

export function buyCar(p: number, id: string): boolean {
  const price = carById(id).price;
  const pr = store.get().profiles[p];
  if (pr.unlocked.includes(id) || pr.money < price) return false;
  store.update((d) => {
    d.profiles[p].money -= price;
    d.profiles[p].unlocked.push(id);
  });
  return true;
}
export function buyUpgrade(p: number, car: string, idx: number): boolean {
  const pr = store.get().profiles[p];
  const lvl = pr.upgrades[car][idx];
  if (lvl >= MAX_UPGRADE) return false;
  const cost = upgradeCost(lvl);
  if (pr.money < cost) return false;
  store.update((d) => {
    d.profiles[p].money -= cost;
    d.profiles[p].upgrades[car][idx]++;
  });
  return true;
}

// ---- ghosts (kept separate, small)
export interface Ghost {
  time: number;
  car: string;
  primary: string;
  frames: number[]; // x,y,z,yaw * n (at 20Hz)
}
export function loadGhost(track: string, p: number): Ghost | null {
  try {
    const r = localStorage.getItem(`tm-ghost-${track}-${p}`);
    return r ? (JSON.parse(r) as Ghost) : null;
  } catch {
    return null;
  }
}
export function saveGhost(track: string, p: number, g: Ghost) {
  try {
    localStorage.setItem(`tm-ghost-${track}-${p}`, JSON.stringify(g));
  } catch {
    /* ignore */
  }
}
