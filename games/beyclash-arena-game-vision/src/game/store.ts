import { create } from 'zustand';
import { PART_MAP } from '../data/parts';
import { RIVALS, RIVAL_MAP } from '../data/rivals';
import { TOURNAMENTS, TOURNAMENT_MAP } from '../data/tournaments';
import { DESK_BY_VENUE } from './world/layout';
import { computeStats } from './customization/stats';
import { defaultSave, DEFAULT_SETTINGS, loadSave, loadSettings, writeSave, writeSettings, SAVE_KEY, type SaveData, type Settings } from './persistence/save';
import { checkTournament, meetsRequirement, settleRivalBattle, settleTournamentMatch, type BattleSummary } from './progression/rewards';
import { newTournamentRun } from './tournaments/competitors';
import { nextPlayerMatch } from './tournaments/bracket';
import { runtime } from './runtime';
import type { BattleResult, BeyConfig, Difficulty, Look, Strategy } from './types';
import { DIFFICULTIES } from './types';

export type Scene = 'menu' | 'city' | 'battle';
export type Overlay =
  | null | 'newgame' | 'pause' | 'dialogue' | 'shop' | 'customize' | 'profile' | 'settings'
  | 'quick' | 'training' | 'tournament' | 'board' | 'map' | 'result' | 'confirmReset';

export interface Fighter {
  id: string;
  name: string;
  title: string;
  look: Look;
  bey: BeyConfig;
  strategy: Strategy;
  difficulty: Difficulty;
}

export interface BattleSetup {
  mode: 'rival' | 'tournament' | 'quick' | 'training';
  opponent: Fighter;
  stadium: string;
  battleId: string;
  rivalId?: string;
  tournamentId?: string;
  round?: string;
  tutorial?: boolean;
  returnTo: 'city' | 'menu';
  /** Optional custom config for the player (training/quick can preview parts). */
  playerBey: BeyConfig;
}

export type BattlePhase = 'intro' | 'countdown' | 'fight' | 'finish' | 'result';

export interface Toast { id: number; text: string; kind: 'info' | 'good' | 'level' | 'warn' }

interface GameState {
  save: SaveData;
  hasSave: boolean;
  settings: Settings;
  scene: Scene;
  overlay: Overlay;
  overlayData: any;
  prompt: string | null;
  toasts: Toast[];
  curtain: { state: 'none' | 'in' | 'out'; text: string };
  battle: { setup: BattleSetup; phase: BattlePhase; settled: boolean; summary: BattleSummary | null; key: number } | null;
  loadError: string | null;
  draftConfig: BeyConfig | null;
  init: () => void;
  persist: () => void;
  startNew: (name: string, outfit: number) => void;
  continueGame: () => void;
  exploreCity: () => void;
  toMenu: () => void;
  openOverlay: (o: Overlay, data?: any) => void;
  closeOverlay: () => void;
  setPrompt: (p: string | null) => void;
  notify: (text: string, kind?: Toast['kind']) => void;
  setSettings: (p: Partial<Settings>) => void;
  setDraft: (c: BeyConfig | null) => void;
  applyConfig: (c: BeyConfig) => void;
  buyPart: (id: string) => boolean;
  markMet: (rivalId: string) => void;
  registerTournament: (id: string) => boolean;
  withCurtain: (text: string, fn: () => void) => void;
  startBattle: (setup: Omit<BattleSetup, 'battleId' | 'playerBey' | 'returnTo'> & { playerBey?: BeyConfig; returnTo?: 'city' | 'menu' }) => void;
  setPhase: (p: BattlePhase) => void;
  finishBattle: (res: BattleResult) => void;
  rematch: () => void;
  leaveBattle: () => void;
  skipTime: (amount: number) => void;
  resetSave: () => void;
  clearLoadError: () => void;
}

let toastId = 1;
let battleCounter = 0;

function applyRuntimeSettings(s: Settings) {
  runtime.quality = s.quality;
  runtime.mouseSens = s.mouseSens;
  runtime.camSens = s.camSens;
  runtime.invertY = s.invertY;
}

export const useGame = create<GameState>((set, get) => ({
  save: defaultSave(),
  hasSave: false,
  settings: { ...DEFAULT_SETTINGS },
  scene: 'menu',
  overlay: null,
  overlayData: null,
  prompt: null,
  toasts: [],
  curtain: { state: 'none', text: '' },
  battle: null,
  loadError: null,
  draftConfig: null,

  init: () => {
    const settings = loadSettings();
    applyRuntimeSettings(settings);
    const r = loadSave();
    set({ settings, save: r.save ?? defaultSave(), hasSave: !!r.save, loadError: r.error ?? null });
    if (r.save) { runtime.pos = { ...r.save.pos }; runtime.clock = r.save.clock; }
  },

  persist: () => {
    const s = get().save;
    const next = { ...s, pos: { x: runtime.pos.x, z: runtime.pos.z }, clock: runtime.clock };
    if (writeSave(next)) set({ save: next, hasSave: true });
    else get().notify('Could not write save data (storage unavailable).', 'warn');
  },

  startNew: (name, outfit) => {
    const save = defaultSave(name.trim().slice(0, 16) || 'Rookie', outfit);
    runtime.pos = { ...save.pos };
    runtime.clock = save.clock;
    set({ save, overlay: null });
    get().persist();
    get().withCurtain('A NEW CHALLENGER!', () => set({ scene: 'city', overlay: null }));
  },

  continueGame: () => {
    const { save } = get();
    runtime.pos = { ...save.pos };
    runtime.clock = save.clock;
    get().withCurtain('WELCOME BACK', () => set({ scene: 'city', overlay: null }));
  },

  exploreCity: () => {
    if (!get().hasSave) get().startNew('Rookie', 0);
    else get().continueGame();
  },

  toMenu: () => {
    get().persist();
    get().withCurtain('MAIN MENU', () => set({ scene: 'menu', overlay: null, battle: null, prompt: null }));
  },

  openOverlay: (o, data) => {
    if (document.pointerLockElement) document.exitPointerLock();
    set({ overlay: o, overlayData: data ?? null, prompt: null, draftConfig: o === 'customize' || o === 'shop' ? get().save.config : null });
  },
  closeOverlay: () => set({ overlay: null, overlayData: null, draftConfig: null }),
  setPrompt: (p) => { if (get().prompt !== p) set({ prompt: p }); },

  notify: (text, kind = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },

  setSettings: (p) => {
    const settings = { ...get().settings, ...p };
    applyRuntimeSettings(settings);
    writeSettings(settings);
    set({ settings });
  },

  setDraft: (c) => set({ draftConfig: c }),

  applyConfig: (c) => {
    const s = get().save;
    const ok = (id: string, slot: string) => PART_MAP[id]?.slot === slot && s.owned.includes(id);
    if (!ok(c.layer, 'layer') || !ok(c.disc, 'disc') || !ok(c.driver, 'driver') || !ok(c.accessory, 'accessory')) {
      get().notify('That configuration uses parts you do not own.', 'warn');
      return;
    }
    set({ save: { ...s, config: { ...c, name: c.name.trim().slice(0, 18) || 'My Bey' } } });
    get().persist();
    get().notify('Beyblade configuration saved.', 'good');
  },

  buyPart: (id) => {
    const s = get().save;
    const p = PART_MAP[id];
    if (!p || p.reward || s.owned.includes(id)) return false;
    if (s.level < p.unlockLevel) { get().notify(`Requires level ${p.unlockLevel}.`, 'warn'); return false; }
    if (s.points < p.cost) { get().notify('Not enough points.', 'warn'); return false; }
    set({ save: { ...s, points: s.points - p.cost, owned: [...s.owned, id] } });
    get().persist();
    get().notify(`Purchased ${p.name}!`, 'good');
    return true;
  },

  markMet: (id) => {
    const s = get().save;
    if (s.rivals[id]?.met) return;
    set({ save: { ...s, rivals: { ...s.rivals, [id]: { ...s.rivals[id], met: true } } } });
    get().persist();
  },

  registerTournament: (id) => {
    const s = get().save;
    const t = TOURNAMENT_MAP[id];
    const missing = checkTournament(t, s);
    const rec = s.tournaments[id];
    if (missing.length || (rec.active && rec.active.status === 'active')) return false;
    const seed = (Date.now() ^ (rec.entered * 7919)) >>> 0;
    const active = newTournamentRun(t, seed);
    set({
      save: {
        ...s, points: s.points - t.fee,
        tournaments: { ...s.tournaments, [id]: { ...rec, entered: rec.entered + 1, active } },
      },
    });
    get().persist();
    get().notify(`Registered for the ${t.name}! Entry fee paid: ${t.fee.toLocaleString()} pts.`, 'good');
    return true;
  },

  withCurtain: (text, fn) => {
    set({ curtain: { state: 'in', text } });
    setTimeout(() => {
      fn();
      set({ curtain: { state: 'out', text } });
      setTimeout(() => set({ curtain: { state: 'none', text: '' } }), 700);
    }, 750);
  },

  startBattle: (setup) => {
    const s = get().save;
    const full: BattleSetup = {
      ...setup,
      playerBey: setup.playerBey ?? s.config,
      returnTo: setup.returnTo ?? (get().scene === 'city' ? 'city' : 'menu'),
      battleId: `b${Date.now()}-${battleCounter++}`,
    };
    if (document.pointerLockElement) document.exitPointerLock();
    set({ overlay: null, overlayData: null, prompt: null });
    get().withCurtain(full.mode === 'tournament' ? `${full.round?.toUpperCase() ?? 'MATCH'}!` : 'BEYCLASH!', () =>
      set((st) => ({ scene: 'battle', overlay: null, battle: { setup: full, phase: 'intro', settled: false, summary: null, key: (st.battle?.key ?? 0) + 1 } })),
    );
  },

  setPhase: (p) => set((st) => (st.battle ? { battle: { ...st.battle, phase: p } } : {})),

  finishBattle: (res) => {
    const st = get();
    const b = st.battle;
    if (!b || b.settled) return; // never settle twice
    set({ battle: { ...b, settled: true, phase: 'result' } });
    const { setup } = b;
    let summary: BattleSummary | null = null;
    let save = st.save;
    if (setup.mode === 'rival' && setup.rivalId) {
      const r = settleRivalBattle(save, RIVAL_MAP[setup.rivalId], res, setup.battleId);
      save = r.save; summary = r.summary;
    } else if (setup.mode === 'tournament' && setup.tournamentId) {
      const t = TOURNAMENT_MAP[setup.tournamentId];
      const r = settleTournamentMatch(save, t, res, setup.battleId);
      save = r.save; summary = r.summary;
      if (summary) summary.opponentName = setup.opponent.name;
    } else {
      const won = res.winner === 0;
      summary = {
        battleId: setup.battleId, mode: setup.mode, won, finish: res.finish, time: res.time, stamina: res.stamina,
        playerName: save.config.name, opponentName: setup.opponent.name, prize: 0, xp: 0, rep: 0, levelUps: [], unlocks: [],
        pointsAfter: save.points, levelAfter: save.level,
        note: setup.mode === 'training' ? 'Training battle: no official rewards, encounter points or tournament progress.' : 'Quick Battle: exhibition only. No official rewards or progression.',
      };
      if (setup.mode === 'training' && won) {
        const key = res.finish === 'SPIN' ? 'spin' : res.finish === 'RING_OUT' ? 'ringOut' : 'burst';
        if (!save.training[key]) {
          save = { ...save, training: { ...save.training, [key]: true } };
          get().notify(`Training: ${res.finish.replace('_', ' ')} finish learned!`, 'good');
        }
      }
    }
    set({ save, battle: { ...b, settled: true, phase: 'result', summary } });
    get().persist();
    if (summary) for (const l of summary.levelUps) get().notify(`LEVEL UP! You reached level ${l}`, 'level');
    set({ overlay: 'result' });
  },

  rematch: () => {
    const b = get().battle;
    if (!b) return;
    const su = b.setup;
    // official rival rematch only when still available
    set({ overlay: null });
    get().withCurtain('REMATCH!', () => set((st) => ({ battle: { setup: { ...su, battleId: `b${Date.now()}-${battleCounter++}` }, phase: 'intro', settled: false, summary: null, key: (st.battle?.key ?? 0) + 1 } })));
  },

  leaveBattle: () => {
    const b = get().battle;
    const to = b?.setup.returnTo ?? 'city';
    get().withCurtain(to === 'city' ? 'BACK TO THE CITY' : 'MAIN MENU', () => set({ scene: to === 'city' ? 'city' : 'menu', overlay: null, battle: null }));
  },

  skipTime: (amount) => {
    runtime.clock = (runtime.clock + amount) % 1;
  },

  resetSave: () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    const save = defaultSave();
    runtime.pos = { ...save.pos };
    runtime.clock = save.clock;
    set({ save, hasSave: false, overlay: null, scene: 'menu', battle: null });
    get().notify('Save data erased.', 'info');
  },

  clearLoadError: () => set({ loadError: null }),
}));

// ---------- derived helpers ----------
export function rivalStatus(save: SaveData, id: string) {
  const r = RIVAL_MAP[id];
  const missing = meetsRequirement(r.req, save);
  const prog = save.rivals[id];
  return { available: missing.length === 0 && !prog.defeated, locked: missing.length > 0, missing, defeated: prog.defeated, points: prog.points };
}

export function playerStats(save: SaveData) {
  return computeStats(save.config);
}

export function getObjective(save: SaveData): { text: string; target?: { x: number; z: number } } {
  for (const t of TOURNAMENTS) {
    const a = save.tournaments[t.id].active;
    if (a && a.status === 'active' && nextPlayerMatch(a)) {
      return { text: `Play your next ${t.name} match`, target: DESK_BY_VENUE[t.venue] };
    }
  }
  const avail = RIVALS.filter((r) => rivalStatus(save, r.id).available);
  const unmetFirst = avail.find((r) => save.rivals[r.id].points === 0) ?? avail[0];
  const nextT = TOURNAMENTS.find((t) => save.tournaments[t.id].wins < 1);
  if (nextT && save.tournaments[nextT.id].wins < 1) {
    const miss = checkTournament(nextT, save).filter((m) => !m.startsWith('Entry fee'));
    if (miss.length === 0 && save.points >= nextT.fee) return { text: `Register for the ${nextT.name}`, target: DESK_BY_VENUE[nextT.venue] };
  }
  if (unmetFirst) {
    const p = save.rivals[unmetFirst.id].points;
    return { text: `Challenge ${unmetFirst.name} (${p}/5 encounter points)`, target: unmetFirst.home };
  }
  if (nextT) {
    const miss = checkTournament(nextT, save)[0];
    return { text: `${nextT.name}: ${miss ?? 'Ready to register'}`, target: DESK_BY_VENUE[nextT.venue] };
  }
  return { text: 'You are the World Champion! Keep sharpening your skills.' };
}

export const DIFF_INDEX = (d: Difficulty) => DIFFICULTIES.indexOf(d);

if (typeof window !== 'undefined') (window as unknown as { __beyclash: typeof useGame }).__beyclash = useGame; // debug / test hook
