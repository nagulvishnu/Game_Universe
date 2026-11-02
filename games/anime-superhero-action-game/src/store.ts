import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HeroId, MAX_LEVEL, xpNeeded } from "./data";

export type Screen = "menu" | "select" | "settings" | "info" | "playing" | "paused" | "upgrades" | "missions" | "dead";

export interface Settings {
  quality: "low" | "medium" | "high";
  master: number;
  music: number;
  sfx: number;
  sens: number;
  shake: boolean;
  voice: boolean;
  fov: number;
}

interface GameStore {
  screen: Screen;
  back: Screen;
  started: boolean;
  hero: HeroId;
  settings: Settings;
  level: number;
  xp: number;
  points: number;
  upgrades: Record<string, number>;
  missionsDone: string[];
  kills: number;
  companions: string[];
  setScreen: (s: Screen, back?: Screen) => void;
  setHero: (h: HeroId) => void;
  setSettings: (p: Partial<Settings>) => void;
  addXp: (n: number) => boolean;
  buyUpgrade: (id: string) => void;
  completeMission: (id: string) => void;
  addKill: () => void;
  setCompanions: (c: string[]) => void;
  resetProgress: () => void;
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      screen: "menu",
      back: "menu",
      started: false,
      hero: "kairo",
      settings: { quality: "medium", master: 0.8, music: 0.5, sfx: 0.8, sens: 1, shake: true, voice: true, fov: 70 },
      level: 1,
      xp: 0,
      points: 0,
      upgrades: {},
      missionsDone: [],
      kills: 0,
      companions: [],
      setScreen: (s, back) => set({ screen: s, back: back ?? get().back, started: get().started || s === "playing" }),
      setHero: (h) => set({ hero: h }),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      addXp: (n) => {
        let { level, xp, points } = get();
        let up = false;
        xp += n;
        while (level < MAX_LEVEL && xp >= xpNeeded(level)) {
          xp -= xpNeeded(level);
          level++;
          points++;
          up = true;
        }
        set({ level, xp, points });
        return up;
      },
      buyUpgrade: (id) => {
        const { points, upgrades } = get();
        const cur = upgrades[id] || 0;
        if (points < 1 || cur >= 5) return;
        set({ points: points - 1, upgrades: { ...upgrades, [id]: cur + 1 } });
      },
      completeMission: (id) => {
        const d = get().missionsDone;
        if (!d.includes(id)) set({ missionsDone: [...d, id] });
      },
      addKill: () => set({ kills: get().kills + 1 }),
      setCompanions: (c) => set({ companions: c }),
      resetProgress: () => set({ level: 1, xp: 0, points: 0, upgrades: {}, missionsDone: [], kills: 0, companions: [] }),
    }),
    {
      name: "hero-city-save-v1",
      partialize: (s) => ({
        hero: s.hero,
        settings: s.settings,
        level: s.level,
        xp: s.xp,
        points: s.points,
        upgrades: s.upgrades,
        missionsDone: s.missionsDone,
        kills: s.kills,
        companions: s.companions,
      }),
    }
  )
);

export interface HudState {
  hero: HeroId;
  hp: number;
  maxHp: number;
  en: number;
  maxEn: number;
  ult: number;
  cds: Record<string, { cd: number; max: number; ok: boolean }>;
  otherHp: number;
  otherMax: number;
  lock: string;
  bossName: string;
  bossHp: number;
  bossMax: number;
  bossStage: number;
  bossStages: number;
  mission: string;
  objectives: string[];
  combo: number;
  allies: number;
  souls: number;
  flying: boolean;
  prompt: string;
  letterbox: boolean;
  flash: number;
  banner: { title: string; sub: string; key: number; color: string } | null;
  toasts: { id: number; text: string; color: string }[];
  perfect: number;
  charge: number;
  danger: number;
  district: string;
  clock: string;
}

export const useHud = create<HudState>(() => ({
  hero: "kairo",
  hp: 1000,
  maxHp: 1000,
  en: 100,
  maxEn: 100,
  ult: 0,
  cds: {},
  otherHp: 1000,
  otherMax: 1000,
  lock: "",
  bossName: "",
  bossHp: 0,
  bossMax: 1,
  bossStage: 0,
  bossStages: 3,
  mission: "",
  objectives: [],
  combo: 0,
  allies: 0,
  souls: 0,
  flying: false,
  prompt: "",
  letterbox: false,
  flash: 0,
  banner: null,
  toasts: [],
  perfect: 0,
  charge: 0,
  danger: 0,
  district: "",
  clock: "",
}));

let toastId = 0;
export function toast(text: string, color = "#ffffff") {
  const id = ++toastId;
  useHud.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, color }] }));
  setTimeout(() => useHud.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
}
let bannerKey = 0;
export function banner(title: string, sub = "", color = "#ffd23f", ms = 3200) {
  const key = ++bannerKey;
  useHud.setState({ banner: { title, sub, key, color } });
  setTimeout(() => {
    if (useHud.getState().banner?.key === key) useHud.setState({ banner: null });
  }, ms);
}
