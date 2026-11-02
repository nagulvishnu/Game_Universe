import { create } from 'zustand';
import { GFX_PRESETS, GfxPreset, GfxSettings, MatchMode } from '../data/config';
import { Game, HudSnap, MatchResult } from '../engine/Game';
import { Input } from '../engine/player';
import { audio } from '../audio/audio';

export type Screen = 'menu' | 'select' | 'lobby' | 'settings' | 'stats' | 'loading' | 'playing';
export type Overlay = 'none' | 'inventory' | 'map' | 'pause';

export interface Settings { sens: number; music: number; sfx: number; autoPickup: boolean; gfx: GfxSettings }
export interface Stats {
  matches: number; wins: number; kills: number; damage: number; headshots: number; survival: number; bestPlacement: number; distance: number; weaponShots: Record<string, number>;
}
export interface Profile { charId: string; skin: number; mode: MatchMode; seed: number; name: string; unlockedSkins: string[] }

const KEY = 'lastdrop.save.v1';
const defaults = {
  settings: { sens: 1, music: 0.5, sfx: 0.8, autoPickup: true, gfx: { ...GFX_PRESETS.medium } } as Settings,
  stats: { matches: 0, wins: 0, kills: 0, damage: 0, headshots: 0, survival: 0, bestPlacement: 0, distance: 0, weaponShots: {} } as Stats,
  profile: { charId: 'akira', skin: 0, mode: 'classic', seed: 0, name: 'YOU', unlockedSkins: [] } as Profile,
};
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); return { settings: { ...defaults.settings, ...o.settings, gfx: { ...defaults.settings.gfx, ...(o.settings?.gfx ?? {}) } }, stats: { ...defaults.stats, ...o.stats }, profile: { ...defaults.profile, ...o.profile } }; }
  } catch { /* ignore */ }
  return defaults;
}

export const current: { game: Game | null; input: Input | null } = { game: null, input: null };

interface S {
  screen: Screen; overlay: Overlay; settings: Settings; stats: Stats; profile: Profile; hud: HudSnap | null; ready: boolean; epoch: number;
  setScreen: (s: Screen) => void; setOverlay: (o: Overlay) => void;
  setSettings: (p: Partial<Settings>) => void; setGfxPreset: (p: GfxPreset) => void; setGfx: (p: Partial<GfxSettings>) => void;
  setProfile: (p: Partial<Profile>) => void;
  startGame: (mode: MatchMode | 'training') => void; leaveGame: () => void; recordResult: (r: MatchResult) => void; resetStats: () => void;
}

const persist = () => { const s = useStore.getState(); try { localStorage.setItem(KEY, JSON.stringify({ settings: s.settings, stats: s.stats, profile: s.profile })); } catch { /* ignore */ } };

export const useStore = create<S>()((set, get) => ({
  ...load(),
  screen: 'menu', overlay: 'none', hud: null, ready: false, epoch: 0,
  setScreen: (screen) => set({ screen }),
  setOverlay: (overlay) => {
    set({ overlay });
    if (overlay !== 'none') current.input?.unlock();
  },
  setSettings: (p) => { set({ settings: { ...get().settings, ...p } }); audio.setVolumes(get().settings.music, get().settings.sfx); persist(); },
  setGfxPreset: (p) => { set({ settings: { ...get().settings, gfx: { ...GFX_PRESETS[p] } } }); persist(); },
  setGfx: (p) => { set({ settings: { ...get().settings, gfx: { ...get().settings.gfx, ...p } } }); persist(); },
  setProfile: (p) => { set({ profile: { ...get().profile, ...p } }); persist(); },
  startGame: (mode) => {
    audio.init(); audio.setVolumes(get().settings.music, get().settings.sfx); audio.stopMusic();
    set({ screen: 'loading', overlay: 'none', hud: null });
    setTimeout(() => {
      const s = get();
      const g = new Game({ mode, seed: mode === 'training' ? 0 : s.profile.seed, charId: s.profile.charId, skin: s.profile.skin, sens: s.settings.sens, autoPickup: s.settings.autoPickup, name: s.profile.name || 'YOU' });
      g.onResult = (r) => get().recordResult(r);
      current.game = g;
      set({ screen: 'playing', epoch: s.epoch + 1 });
      audio.startMusic('battle');
    }, 60);
  },
  leaveGame: () => {
    const g = current.game;
    if (g) {
      // make sure an unfinished match still counts toward the statistics
      if (g.mode === 'match' && !g.resultSent) { g.player.alive && g.finish(false); }
      g.dispose();
    }
    current.game = null;
    set({ screen: 'menu', overlay: 'none', hud: null });
    audio.stopMusic(); audio.startMusic('menu');
  },
  recordResult: (r) => {
    const st = get().stats;
    const ws = { ...st.weaponShots };
    for (const k in r.weaponShots) ws[k] = (ws[k] || 0) + r.weaponShots[k];
    set({
      stats: {
        matches: st.matches + 1, wins: st.wins + (r.won ? 1 : 0), kills: st.kills + r.kills, damage: st.damage + r.damage, headshots: st.headshots + r.headshots,
        survival: st.survival + r.survival, bestPlacement: st.bestPlacement === 0 ? r.placement : Math.min(st.bestPlacement, r.placement), distance: st.distance + r.distance, weaponShots: ws,
      },
    });
    persist();
    if (r.won) audio.victory();
  },
  resetStats: () => { set({ stats: { ...defaults.stats, weaponShots: {} } }); persist(); },
}));

// debugging / automated testing hook
if (typeof window !== 'undefined') (window as unknown as { __lastdrop: unknown }).__lastdrop = { current, useStore };
