import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";

export interface Settings {
  uiMode: "dark" | "light"; boardTheme: string; pieceStyle: string;
  sound: boolean; music: boolean; volume: number;
  coords: boolean; legalMoves: boolean; highlightLast: boolean; animations: boolean; autoQueen: boolean; autoFlip: boolean;
}
export interface MatchRecord {
  id: string; date: number; mode: string; white: string; black: string;
  result: "win" | "loss" | "draw"; outcome: string; reason: string; moves: number; duration: number; pgn: string;
}
export interface Stats { games: number; wins: number; losses: number; draws: number; streak: number; bestStreak: number; playTime: number; history: MatchRecord[] }
export interface PuzzleStats { solved: Record<string, boolean>; attempts: number; correct: number; rushBest: number; survivalBest: number; daily: Record<string, boolean>; hintsUsed: number }
export interface TrainingStats { done: Record<string, boolean> }

export interface PersistedState { settings: Settings; stats: Stats; puzzles: PuzzleStats; training: TrainingStats }

export const DEFAULTS: PersistedState = {
  settings: { uiMode: "dark", boardTheme: "wood", pieceStyle: "staunton", sound: true, music: false, volume: 0.6, coords: true, legalMoves: true, highlightLast: true, animations: true, autoQueen: false, autoFlip: false },
  stats: { games: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, playTime: 0, history: [] },
  puzzles: { solved: {}, attempts: 0, correct: 0, rushBest: 0, survivalBest: 0, daily: {}, hintsUsed: 0 },
  training: { done: {} },
};

/** copy only known keys whose runtime type matches the default (protects against corrupted storage) */
function sanitize<T extends object>(def: T, src: unknown): T {
  if (!src || typeof src !== "object" || Array.isArray(src)) return def;
  const out = { ...def } as Record<string, unknown>;
  for (const k of Object.keys(def)) {
    const dv = (def as Record<string, unknown>)[k]; const sv = (src as Record<string, unknown>)[k];
    if (sv === undefined) continue;
    if (Array.isArray(dv)) { if (Array.isArray(sv)) out[k] = sv; }
    else if (dv && typeof dv === "object") { if (sv && typeof sv === "object" && !Array.isArray(sv)) out[k] = sv; }
    else if (typeof sv === typeof dv && (typeof sv !== "number" || Number.isFinite(sv))) out[k] = sv;
  }
  return out as T;
}

const safeStorage: StateStorage = {
  getItem: (n) => { try { return localStorage.getItem(n); } catch { return null; } },
  setItem: (n, v) => { try { localStorage.setItem(n, v); } catch { /* storage unavailable or full */ } },
  removeItem: (n) => { try { localStorage.removeItem(n); } catch { /* ignore */ } },
};

interface Actions {
  updateSettings: (p: Partial<Settings>) => void;
  recordGame: (r: MatchRecord, countsForStats: boolean) => void;
  recordPuzzle: (id: string | null, correct: boolean) => void;
  markDaily: (key: string) => void;
  setRushBest: (n: number) => void;
  setSurvivalBest: (n: number) => void;
  addHint: () => void;
  completeLesson: (id: string) => void;
  resetAll: () => void;
}

export const useStore = create<PersistedState & Actions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      recordGame: (r, counts) => set((s) => {
        const st = { ...s.stats };
        st.games += 1; st.playTime += r.duration;
        if (counts) {
          if (r.result === "win") { st.wins++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); }
          else if (r.result === "loss") { st.losses++; st.streak = 0; }
          else st.draws++;
        }
        st.history = [r, ...st.history].slice(0, 40);
        return { stats: st };
      }),
      recordPuzzle: (id, correct) => set((s) => ({
        puzzles: { ...s.puzzles, attempts: s.puzzles.attempts + 1, correct: s.puzzles.correct + (correct ? 1 : 0), solved: correct && id ? { ...s.puzzles.solved, [id]: true } : s.puzzles.solved },
      })),
      markDaily: (key) => set((s) => ({ puzzles: { ...s.puzzles, daily: { ...s.puzzles.daily, [key]: true } } })),
      setRushBest: (n) => set((s) => ({ puzzles: { ...s.puzzles, rushBest: Math.max(s.puzzles.rushBest, n) } })),
      setSurvivalBest: (n) => set((s) => ({ puzzles: { ...s.puzzles, survivalBest: Math.max(s.puzzles.survivalBest, n) } })),
      addHint: () => set((s) => ({ puzzles: { ...s.puzzles, hintsUsed: s.puzzles.hintsUsed + 1 } })),
      completeLesson: (id) => set((s) => ({ training: { done: { ...s.training.done, [id]: true } } })),
      resetAll: () => set({ ...DEFAULTS }),
    }),
    {
      name: "chess-infinity:v1",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ settings: s.settings, stats: s.stats, puzzles: s.puzzles, training: s.training }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedState>;
        const stats = sanitize(DEFAULTS.stats, p.stats);
        stats.history = Array.isArray(stats.history) ? stats.history.filter((h) => h && typeof h === "object" && typeof h.id === "string").slice(0, 40) : [];
        return {
          ...current,
          settings: sanitize(DEFAULTS.settings, p.settings),
          stats,
          puzzles: sanitize(DEFAULTS.puzzles, p.puzzles),
          training: sanitize(DEFAULTS.training, p.training),
        };
      },
    },
  ),
);
