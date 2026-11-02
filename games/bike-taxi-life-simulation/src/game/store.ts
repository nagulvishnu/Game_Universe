import { create } from 'zustand';
import { produce, setAutoFreeze } from 'immer';
import type { GameState } from './types';
import { newGameState, notify } from './state';
import { LocalSaveRepository } from './persistence';
import { simulateOffline, stepSim } from './logic/sim';
import { faint } from './logic/life';
import { rt } from './runtime';
import { poiById } from './world/city';

setAutoFreeze(false);

export interface UI {
  screen: 'menu' | 'game';
  panel: string | null;
  panelArg?: string;
  phone: boolean;
  phoneApp: string | null;
  offerExpiresAt: number;
  saveStatus: string;
  toast: string | null;
  adminTab: string;
}

interface Store {
  g: GameState | null;
  ui: UI;
  hasSave: boolean;
  act: <R>(fn: (s: GameState) => R) => R;
  bulk: <R>(fn: (s: GameState) => R) => R;
  newGame: () => void;
  continueGame: () => boolean;
  toMenu: () => void;
  openPanel: (name: string, arg?: string) => void;
  closePanel: () => void;
  setPhone: (open: boolean, app?: string | null) => void;
  setUI: (p: Partial<UI>) => void;
  save: (reason?: string) => void;
  tick: (dtMin: number) => void;
  toast: (t: string) => void;
}

export const useGame = create<Store>()((set, get) => ({
  g: null,
  hasSave: LocalSaveRepository.exists(),
  ui: { screen: 'menu', panel: null, phone: false, phoneApp: null, offerExpiresAt: 0, saveStatus: '', toast: null, adminTab: 'overview' },
  act: (fn) => {
    let out!: ReturnType<typeof fn>;
    set((st) => ({ g: produce(st.g!, (d) => { out = fn(d as GameState); }) }));
    return out;
  },
  bulk: (fn) => {
    const clone = structuredClone(get().g!);
    const out = fn(clone);
    set({ g: clone });
    return out;
  },
  newGame: () => {
    const g = newGameState();
    syncRuntimeFromState(g);
    set((st) => ({ g, ui: { ...st.ui, screen: 'game', panel: null, phone: false } }));
    get().save('new game');
  },
  continueGame: () => {
    const res = LocalSaveRepository.load();
    if (!res.state) return false;
    const g = res.state;
    const away = Date.now() - (g.lastSavedReal || Date.now());
    const rep = simulateOffline(g, away);
    if (rep) { g.offlineReport = rep; }
    else if (away > 0) { /* short absence */ }
    if (res.source === 'backup') notify(g, 'Primary save was damaged — recovered from backup.', 'warn');
    syncRuntimeFromState(g);
    set((st) => ({ g, ui: { ...st.ui, screen: 'game', panel: rep ? 'offline' : null, phone: false, saveStatus: res.source === 'backup' ? 'Recovered from backup' : 'Loaded' } }));
    return true;
  },
  toMenu: () => { get().save('menu'); set((st) => ({ hasSave: LocalSaveRepository.exists(), ui: { ...st.ui, screen: 'menu', panel: null, phone: false } })); },
  openPanel: (name, arg) => set((st) => ({ ui: { ...st.ui, panel: name, panelArg: arg } })),
  closePanel: () => set((st) => ({ ui: { ...st.ui, panel: null, panelArg: undefined } })),
  setPhone: (open, app = null) => set((st) => ({ ui: { ...st.ui, phone: open, phoneApp: open ? app : null } })),
  setUI: (p) => set((st) => ({ ui: { ...st.ui, ...p } })),
  save: () => {
    const g = get().g;
    if (!g) return;
    const snap = captureRuntime(g);
    const ok = LocalSaveRepository.save(snap);
    set((st) => ({ hasSave: LocalSaveRepository.exists(), ui: { ...st.ui, saveStatus: ok ? `Saved ${new Date().toLocaleTimeString()}` : 'SAVE FAILED (storage full?)' } }));
  },
  tick: (dtMin) => {
    get().act((s) => {
      stepSim(s, dtMin);
      if (s.needs.health <= 0) { faint(s); rt.mode = 'walk'; }
    });
  },
  toast: (t) => { set((st) => ({ ui: { ...st.ui, toast: t } })); setTimeout(() => { if (get().ui.toast === t) set((st) => ({ ui: { ...st.ui, toast: null } })); }, 2800); },
}));

/** Copy runtime positions into a state snapshot for saving. */
function captureRuntime(g: GameState): GameState {
  const snap = structuredClone(g);
  snap.lastSavedReal = Date.now();
  snap.time = g.time;
  if (!snap.player.interior) {
    if (rt.mode === 'ride' || rt.mode === 'fallen') { snap.player.x = rt.bike.x; snap.player.z = rt.bike.z; snap.player.heading = rt.bike.heading; }
    else { snap.player.x = rt.walk.x; snap.player.z = rt.walk.z; snap.player.heading = rt.walk.heading; }
  }
  if (snap.player.onBike && snap.player.bikeId) {
    const b = snap.bikes.find((x) => x.id === snap.player.bikeId);
    if (b) { b.x = rt.bike.x; b.z = rt.bike.z; b.heading = rt.bike.heading; }
  }
  return snap;
}

export function syncRuntimeFromState(g: GameState) {
  const p = g.player;
  rt.walk.x = p.x; rt.walk.z = p.z; rt.walk.heading = p.heading; rt.walk.speed = 0;
  rt.mode = p.onBike && p.bikeId ? 'ride' : 'walk';
  const b = g.bikes.find((x) => x.id === p.bikeId);
  if (b) { rt.bike.id = b.id; rt.bike.x = b.x; rt.bike.z = b.z; rt.bike.heading = b.heading; }
  else if (p.onBike) { p.onBike = false; rt.mode = 'walk'; }
  rt.bike.speed = 0; rt.bike.steer = 0; rt.bike.lean = 0; rt.bike.fallenT = 0;
  rt.target = null; rt.route = null; rt.tel = { distanceM: 0, elapsedSec: 0, collisions: 0, hardEvents: 0, speedingSec: 0 };
  const h = poiById.get('home')!;
  if (p.interior) { rt.int.x = 0; rt.int.z = 3; rt.int.heading = Math.PI; }
  void h;
}

// auto-save on tab close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { const st = useGame.getState(); if (st.ui.screen === 'game') st.save('unload'); });
  document.addEventListener('visibilitychange', () => { const st = useGame.getState(); if (document.hidden && st.ui.screen === 'game') st.save('hidden'); });
}
