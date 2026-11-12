// UI/application state (zustand): routing, settings, profile, session flows, HUD snapshot.
import { create } from 'zustand';
import { DIFF_LIST } from './constants';
import { DEFAULT_SETUP, Setup, Tournament, createTournament, reportTournament, STAGES } from './modes';
import { LaunchConfig } from './sim';
import { Look, Progress, Settings, Stats, HighScore, store as db } from './storage';

export type Screen = 'start' | 'menu' | 'setup' | 'game' | 'results' | 'settings' | 'customize' | 'stats' | 'scores' | 'practice' | 'bracket' | 'championship' | 'howto' | 'trophy';

export interface HudTeam { names: string[]; score: number; games: number }
export interface HudTiming { show: boolean; prox: number; grade: string; inReach: boolean; score: number }
export interface HudState {
  phase: string;
  teams: HudTeam[];
  serverTeam: number; serverSlot: number;
  gameNo: number; gamesToWin: number; pointsToWin: number;
  time: number;
  meters: number[]; stamina: number[]; timings: HudTiming[];
  doubles: boolean; humans: number;
  msg: string; sub: string;
  drill: null | { label: string; score: number; streak: number; best: number; returns: number; misses: number; timeLeft: number; timeLimit: number; zoneHits: number; goal: number; kind: string; msg: string; cones: number; perfectSmashes: number };
  camModes: number[]; arcade: boolean; label: string;
  matchPoint: boolean;
}
export interface FeedItem { id: number; vp: number; text: string; kind: string; t: number }

export interface MatchResult {
  kind: 'match' | 'drill';
  label: string;
  winner: number; // team index, -1 for drill
  humanWon: boolean;
  names: [string, string];
  games: [number, number][];
  final: [number, number];
  duration: number;
  rallies: number; longest: number;
  smashPoints: [number, number];
  perfect: [number, number];
  accuracy: [number, number];
  score: number;
  newHigh: boolean; rank: number;
  success?: boolean;
  drill?: { score: number; returns: number; best: number; zoneHits: number; misses: number; goal: number; kind: string };
  context?: LaunchConfig['context'];
  humans: number;
}

interface UI {
  screen: Screen;
  prev: Screen;
  go: (s: Screen) => void;
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  looks: [Look, Look];
  setLook: (i: 0 | 1, p: Partial<Look>) => void;
  progress: Progress;
  stats: Stats;
  scores: HighScore[];
  setup: Setup;
  setSetup: (p: Partial<Setup>) => void;
  launch: LaunchConfig | null;
  result: MatchResult | null;
  paused: boolean;
  setPaused: (b: boolean) => void;
  hud: HudState | null;
  feed: FeedItem[];
  pushFeed: (vp: number, text: string, kind: string) => void;
  tournament: Tournament | null;
  newTournament: () => void;
  engine: { start: (c: LaunchConfig) => void; restart: () => void; attract: () => void; stop: () => void } | null;
  setEngine: (e: UI['engine']) => void;
  startGame: (c: LaunchConfig) => void;
  quitToMenu: () => void;
  finishMatch: (r: MatchResult) => void;
  isTouch: boolean;
  toasts: { id: number; text: string }[];
  toast: (t: string) => void;
}

let feedId = 1;
export const useUI = create<UI>((set, get) => ({
  screen: 'start',
  prev: 'start',
  go: (s) => set((st) => ({ screen: s, prev: st.screen, stats: db.stats(), scores: db.scores(), progress: db.progress() })),
  settings: db.settings(),
  setSettings: (p) => set((st) => { const s = { ...st.settings, ...p }; db.saveSettings(s); return { settings: s }; }),
  looks: db.looks(),
  setLook: (i, p) => set((st) => { const l = [...st.looks] as [Look, Look]; l[i] = { ...l[i], ...p }; db.saveLooks(l); return { looks: l }; }),
  progress: db.progress(),
  stats: db.stats(),
  scores: db.scores(),
  setup: { ...DEFAULT_SETUP },
  setSetup: (p) => set((st) => ({ setup: { ...st.setup, ...p } })),
  launch: null,
  result: null,
  paused: false,
  setPaused: (b) => set({ paused: b }),
  hud: null,
  feed: [],
  pushFeed: (vp, text, kind) => set((st) => {
    const now = performance.now();
    return { feed: [...st.feed.filter((f) => now - f.t < 1400), { id: feedId++, vp, text, kind, t: now }].slice(-8) };
  }),
  tournament: null,
  newTournament: () => {
    const { setup, looks } = get();
    set({ tournament: createTournament(setup.doubles, setup.arena, looks[0], setup.diff) });
  },
  engine: null,
  setEngine: (e) => set({ engine: e }),
  startGame: (c) => {
    set({ launch: c, result: null, paused: false, screen: 'game', feed: [], hud: null });
    get().engine?.start(c);
  },
  quitToMenu: () => {
    get().engine?.attract();
    set({ screen: 'menu', paused: false, launch: null, hud: null, stats: db.stats(), scores: db.scores(), progress: db.progress() });
  },
  finishMatch: (r) => {
    const st = db.stats();
    const stats: Stats = { ...st };
    const human = r.humans > 0;
    if (r.kind === 'match') {
      stats.matches++;
      if (human) {
        if (r.humanWon) stats.wins++; else stats.losses++;
        stats.points += r.final[0]; stats.pointsLost += r.final[1];
        stats.perfect += r.perfect[0]; stats.smashes += r.smashPoints[0];
      }
      stats.longestRally = Math.max(stats.longestRally, r.longest);
      stats.playSeconds += r.duration;
    } else {
      stats.drills++; stats.playSeconds += r.duration;
      stats.perfect += r.perfect[0];
    }
    // context progression
    const ctx = r.context;
    let progress = db.progress();
    if (ctx?.type === 'championship' && r.humanWon) {
      const i = ctx.stage as number;
      progress = { ...progress, stageCleared: Math.max(progress.stageCleared, i + 1) };
      const u = STAGES[i].unlocks;
      if (u && !progress.unlocked.includes(u)) { progress.unlocked = [...progress.unlocked, u]; get().toast(`Arena unlocked: ${u.toUpperCase()}`); }
      if (i === STAGES.length - 1) stats.championships++;
      db.saveProgress(progress);
    }
    let tour = get().tournament;
    if (ctx?.type === 'tournament' && tour) {
      reportTournament(tour, r.humanWon, `${r.final[0]}-${r.final[1]}`);
      tour = { ...tour };
      if (tour.champion === tour.humanIdx) stats.tournamentTitles++;
    }
    // high score
    let newHigh = false, rank = 0;
    if (r.score > 0 && (r.kind === 'drill' || human)) {
      const hs: HighScore = { name: get().looks[0].name, score: r.score, mode: r.label, date: Date.now(), detail: r.kind === 'drill' ? `${r.drill?.returns ?? 0} returns` : `${r.final[0]}-${r.final[1]}` };
      const all = db.addScore(hs);
      rank = all.findIndex((x) => x === hs || (x.date === hs.date && x.score === hs.score)) + 1;
      newHigh = rank > 0 && rank <= 10;
    }
    db.saveStats(stats);
    set({ result: { ...r, newHigh, rank }, stats, progress, tournament: tour, scores: db.scores(), screen: 'results' });
  },
  isTouch: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  toasts: [],
  toast: (text) => {
    const id = feedId++;
    set((st) => ({ toasts: [...st.toasts, { id, text }] }));
    setTimeout(() => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })), 3200);
  },
}));

export const diffIndex = (d: string) => DIFF_LIST.indexOf(d as never);
