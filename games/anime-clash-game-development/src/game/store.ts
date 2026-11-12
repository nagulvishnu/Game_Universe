import { create } from "zustand";
import { audio } from "./audio";

export type Screen = "boot" | "menu" | "modes" | "select" | "versus" | "game" | "results" | "gallery" | "settings" | "credits" | "champion";
export type Mode = "versus" | "practice" | "tournament";
export type Quality = "low" | "medium" | "high" | "ultra";

export interface Settings {
  quality: Quality;
  master: number;
  music: number;
  sfx: number;
  shake: number;
  damageNumbers: boolean;
  fpsCounter: boolean;
}

export interface FighterStats {
  damage: number;
  maxCombo: number;
  hits: number;
  blocks: number;
  parries: number;
  ultimates: number;
}

export interface MatchResult {
  winner: 0 | 1 | -1;
  rounds: [number, number];
  stats: [FighterStats, FighterStats];
  duration: number;
  chars: [number, number];
  arena: number;
  mode: Mode;
}

const SKEY = "animeclash.settings.v1";
const defaultSettings: Settings = { quality: "high", master: 0.8, music: 0.5, sfx: 0.8, shake: 0.7, damageNumbers: true, fpsCounter: false };
function loadSettings(): Settings {
  try {
    const s = localStorage.getItem(SKEY);
    if (s) return { ...defaultSettings, ...JSON.parse(s) };
  } catch { /* ignore */ }
  return defaultSettings;
}

interface Tourney {
  match: number; // 0..2
  wins: [number, number];
  history: { winner: number; chars: [number, number]; arena: number }[];
}

interface AppState {
  screen: Screen;
  prevScreen: Screen;
  mode: Mode;
  p1: number;
  p2: number;
  arena: number;
  settings: Settings;
  result: MatchResult | null;
  tourney: Tourney;
  matchKey: number; // increments to force engine remount
  go: (s: Screen) => void;
  setMode: (m: Mode) => void;
  setChars: (p1: number, p2: number) => void;
  setArena: (a: number) => void;
  setSettings: (s: Partial<Settings>) => void;
  startVersus: () => void;
  finishMatch: (r: MatchResult) => void;
  rematch: () => void;
  resetTourney: () => void;
}

const freshTourney = (): Tourney => ({ match: 0, wins: [0, 0], history: [] });

export const useApp = create<AppState>((set, get) => ({
  screen: "boot",
  prevScreen: "boot",
  mode: "versus",
  p1: 0,
  p2: 1,
  arena: 0,
  settings: loadSettings(),
  result: null,
  tourney: freshTourney(),
  matchKey: 0,
  go: (s) => set((st) => ({ screen: s, prevScreen: st.screen })),
  setMode: (m) => set({ mode: m }),
  setChars: (p1, p2) => set({ p1, p2 }),
  setArena: (a) => set({ arena: a }),
  setSettings: (s) => {
    const next = { ...get().settings, ...s };
    try { localStorage.setItem(SKEY, JSON.stringify(next)); } catch { /* ignore */ }
    audio.setVolumes({ master: next.master, music: next.music, sfx: next.sfx });
    set({ settings: next });
  },
  startVersus: () => set((st) => ({ screen: "versus", prevScreen: st.screen, matchKey: st.matchKey + 1 })),
  finishMatch: (r) => {
    const st = get();
    if (st.mode === "tournament") {
      const t = { ...st.tourney, wins: [...st.tourney.wins] as [number, number], history: [...st.tourney.history] };
      if (r.winner === 0 || r.winner === 1) t.wins[r.winner]++;
      t.history.push({ winner: r.winner, chars: r.chars, arena: r.arena });
      t.match++;
      set({ result: r, tourney: t, screen: "results", prevScreen: st.screen });
    } else {
      set({ result: r, screen: "results", prevScreen: st.screen });
    }
  },
  rematch: () => set((st) => ({ screen: "versus", prevScreen: st.screen, matchKey: st.matchKey + 1 })),
  resetTourney: () => set({ tourney: freshTourney() }),
}));

// ---------------- HUD (high-frequency, engine -> React) ----------------
export interface HudFighter {
  hp: number;
  hpShown: number;
  maxHp: number;
  ki: number;
  ult: number;
  xf: number;
  transformed: boolean;
  xfLeft: number;
  guard: number;
  combo: number;
  comboDmg: number;
  cd: [number, number, number]; // normalized 0..1 remaining for s1, s2, heavy-sig
  kiOk: [boolean, boolean, boolean];
  lastDmg: number;
}

export interface HudState {
  active: boolean;
  f: [HudFighter, HudFighter];
  timer: number;
  round: number;
  wins: [number, number];
  mode: Mode;
  infHp: boolean;
  infKi: boolean;
  paused: boolean;
  fps: number;
}

const blankF = (): HudFighter => ({ hp: 1, hpShown: 1, maxHp: 1, ki: 0, ult: 0, xf: 0, transformed: false, xfLeft: 0, guard: 100, combo: 0, comboDmg: 0, cd: [0, 0, 0], kiOk: [true, true, true], lastDmg: 0 });
export const useHud = create<HudState>(() => ({
  active: false, f: [blankF(), blankF()], timer: 99, round: 1, wins: [0, 0], mode: "versus", infHp: false, infKi: false, paused: false, fps: 60,
}));
