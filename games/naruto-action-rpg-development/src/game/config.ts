import type { ZoneId } from './types';

export interface ZoneDef {
  id: ZoneId; name: string; sub: string; center: [number, number]; radius: number;
  ground: string; fog: string; fogDensity: number; music: 'village' | 'forest' | 'sea' | 'desert' | 'mystic' | 'valley' | 'wild';
  mapColor: string;
}

export const ZONES: ZoneDef[] = [
  { id: 'konoha', name: 'Hidden Leaf Village', sub: 'Konohagakure — Land of Fire', center: [0, 0], radius: 80, ground: '#78b155', fog: '#cfe9f5', fogDensity: 0.0042, music: 'village', mapColor: '#6fbf5a' },
  { id: 'forest', name: 'Forest of Death', sub: 'Training Ground 44', center: [0, 215], radius: 100, ground: '#2f5a33', fog: '#1d3a2b', fogDensity: 0.016, music: 'forest', mapColor: '#2c6a3a' },
  { id: 'waves', name: 'Land of Waves', sub: 'The Great Bridge', center: [-240, 0], radius: 85, ground: '#6e8f70', fog: '#b9cdd6', fogDensity: 0.011, music: 'sea', mapColor: '#4f93b5' },
  { id: 'sand', name: 'Hidden Sand Village', sub: 'Sunagakure — Land of Wind', center: [240, 0], radius: 90, ground: '#e0be7a', fog: '#f1d9a6', fogDensity: 0.006, music: 'desert', mapColor: '#d9b46a' },
  { id: 'myoboku', name: 'Mount Myoboku', sub: 'Home of the Toad Sages', center: [-210, -235], radius: 85, ground: '#5c9b6e', fog: '#bfe0d0', fogDensity: 0.009, music: 'mystic', mapColor: '#58b08a' },
  { id: 'valley', name: 'Valley of the End', sub: 'Where rivals clashed', center: [210, -235], radius: 85, ground: '#6d8a78', fog: '#c8d8de', fogDensity: 0.008, music: 'valley', mapColor: '#6aa0b0' },
];
export const WILDS: ZoneDef = {
  id: 'wilds', name: 'Land of Fire — Wilds', sub: 'Open country', center: [0, 0], radius: 0, ground: '#6fa352',
  fog: '#c4e0ea', fogDensity: 0.006, music: 'wild', mapColor: '#5e944a',
};
export const WORLD = { minX: -345, maxX: 345, minZ: -325, maxZ: 335 };

export function zoneAt(x: number, z: number): ZoneDef {
  let best: ZoneDef | null = null; let bd = Infinity;
  for (const zn of ZONES) {
    const d = Math.hypot(x - zn.center[0], z - zn.center[1]);
    if (d < zn.radius && d < bd) { best = zn; bd = d; }
  }
  return best ?? WILDS;
}
export const zoneById = (id: string): ZoneDef => ZONES.find((z) => z.id === id) ?? WILDS;

export interface GraphicsPreset {
  label: string; shadow: number; dpr: number; particles: number; aa: boolean; foliage: number; enemyCap: number;
}
export const GRAPHICS: Record<'low' | 'medium' | 'high', GraphicsPreset> = {
  low: { label: 'Low', shadow: 0, dpr: 0.85, particles: 500, aa: false, foliage: 0.45, enemyCap: 10 },
  medium: { label: 'Medium', shadow: 1024, dpr: 1, particles: 1100, aa: true, foliage: 0.75, enemyCap: 16 },
  high: { label: 'High', shadow: 2048, dpr: 1.5, particles: 2200, aa: true, foliage: 1, enemyCap: 22 },
};

export type Action =
  | 'forward' | 'back' | 'left' | 'right' | 'sprint' | 'jump' | 'charge' | 'special' | 'ultimate' | 'lock'
  | 'a1' | 'a2' | 'a3' | 'a4' | 'status' | 'inventory' | 'map' | 'skills' | 'missions' | 'pause'
  | 'interact' | 'transform' | 'block' | 'substitute' | 'kunai' | 'healItem' | 'chakraItem' | 'camLeft' | 'camRight';

export const DEFAULT_BINDINGS: Record<Action, string> = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', jump: 'Space',
  charge: 'KeyQ', special: 'KeyE', ultimate: 'KeyR', lock: 'KeyF',
  a1: 'Digit1', a2: 'Digit2', a3: 'Digit3', a4: 'Digit4',
  status: 'Tab', inventory: 'KeyI', map: 'KeyM', skills: 'KeyK', missions: 'KeyJ', pause: 'Escape',
  interact: 'KeyT', transform: 'KeyG', block: 'KeyC', substitute: 'KeyX', kunai: 'KeyZ',
  healItem: 'KeyH', chakraItem: 'KeyN', camLeft: 'ArrowLeft', camRight: 'ArrowRight',
};
export const ACTION_LABELS: Record<Action, string> = {
  forward: 'Move Forward', back: 'Move Back', left: 'Move Left', right: 'Move Right', sprint: 'Sprint', jump: 'Jump / Dodge',
  charge: 'Charge Chakra (hold)', special: 'Special Jutsu', ultimate: 'Ultimate Jutsu', lock: 'Lock-on / Switch',
  a1: 'Ability 1', a2: 'Ability 2', a3: 'Ability 3', a4: 'Ability 4', status: 'Character Status', inventory: 'Inventory',
  map: 'World Map', skills: 'Skill Tree', missions: 'Missions', pause: 'Pause', interact: 'Interact / Talk',
  transform: 'Transform (Sage/Kurama)', block: 'Guard (hold)', substitute: 'Substitution Jutsu', kunai: 'Throw Kunai',
  healItem: 'Quick Use: Ramen', chakraItem: 'Quick Use: Chakra Pill', camLeft: 'Camera Left', camRight: 'Camera Right',
};

export const SAVE_VERSION = 1;
export const SAVE_SLOTS = 3;
export const GRAVITY = 30;
export const WATER_LEVEL_Y = -0.35;
