import { useSyncExternalStore } from 'react';
import type { Game } from './engine';
import { STARTER_POWERS } from './types';

export interface Toast { id: number; text: string; color: string }
export interface HudState {
  loadMsg: string; loading: number; ready: boolean; started: boolean; locked: boolean;
  panelOpen: boolean; panelTab: string; wheelOpen: boolean; helpOpen: boolean;
  form: string; power: string; flying: boolean; speedLevel: number; speed: number; alt: number;
  x: number; y: number; z: number; hour: number; weather: string; zone: string; fps: number;
  invuln: boolean; hp: number; underwater: boolean; space: number;
  timeMode: 'normal' | 'freeze' | 'reverse' | 'fast'; timeScale: number;
  toasts: Toast[]; npc: number; veh: number; animals: number; buildings: number; charge: number; holding: boolean;
  flash: number; // increments on transformation
  hit: number; // increments on damage
  // creation selections
  bKind: string; vKind: string; aKind: string; wKind: string; sKind: string; dKind: string; tfMode: string; npcCount: number; brush: number;
  // settings
  volume: number; sens: number; fov: number; bloom: boolean; shadows: boolean; recovery: boolean; popTarget: number; seaLevel: number; daySpeed: number; weatherIntensity: number; music: boolean;
  unlockedPowers: string[]; ownedRegions: string[]; selectedGod: string; warActive: boolean;
  warGodHp: number; warGodMaxHp: number; warStatus: 'idle' | 'active' | 'victory' | 'defeat';
  warChoice: 'none' | 'imprisoned' | 'killed';
}

export const initialHud: HudState = {
  loadMsg: 'Forging reality…', loading: 0, ready: false, started: false, locked: false,
  panelOpen: false, panelTab: 'powers', wheelOpen: false, helpOpen: false,
  form: 'supreme', power: 'divine_bolt', flying: true, speedLevel: 0, speed: 0, alt: 0,
  x: 0, y: 0, z: 0, hour: 9, weather: 'clear', zone: 'Downtown', fps: 60,
  invuln: true, hp: 100, underwater: false, space: 0,
  timeMode: 'normal', timeScale: 1,
  toasts: [], npc: 0, veh: 0, animals: 0, buildings: 0, charge: 0, holding: false,
  flash: 0, hit: 0,
  bKind: 'skyscraper', vKind: 'sports', aKind: 'elephant', wKind: 'swords', sKind: 'temple', dKind: 'apocalypse', tfMode: 'raise', npcCount: 8, brush: 60,
  volume: 0.7, sens: 1, fov: 72, bloom: true, shadows: true, recovery: true, popTarget: 150, seaLevel: 0, daySpeed: 1, weatherIntensity: 1, music: true,
  unlockedPowers: STARTER_POWERS, ownedRegions: ['Aether Sanctum'], selectedGod: 'ashara', warActive: false,
  warGodHp: 0, warGodMaxHp: 0, warStatus: 'idle', warChoice: 'none',
};

let state: HudState = { ...initialHud };
const subs = new Set<() => void>();
export const hud = {
  get: () => state,
  set(p: Partial<HudState>) {
    let changed = false;
    for (const k in p) {
      if ((state as any)[k] !== (p as any)[k]) { changed = true; break; }
    }
    if (!changed) return;
    state = { ...state, ...p };
    subs.forEach(f => f());
  },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};
export function useHud<T>(sel: (s: HudState) => T): T {
  return useSyncExternalStore(hud.subscribe, () => sel(state));
}
export const ref: { game: Game | null } = { game: null };
