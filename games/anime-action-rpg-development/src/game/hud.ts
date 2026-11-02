import { create } from 'zustand';
import type { Toast } from './store';

export interface HudState {
  hp: number; maxHp: number; en: number; maxEn: number; tf: number; tfActive: boolean; tfTime: number; tfMax: number; tfName: string;
  cd: { e: number; r: number; v: number; eMax: number; rMax: number; vMax: number }; costs: { e: number; r: number; v: number };
  boss: null | { name: string; title: string; hp: number; max: number; phase: number; stagger: number; staggered: boolean };
  target: null | { name: string; hp: number; max: number; level: number; el: string };
  prompt: string; location: string; objective: string; objDist: number; locked: boolean; combo: number;
  status: { burn: number; slow: number; poison: number }; toasts: Toast[]; levelUp: null | { lvl: number; t: number };
  banner: null | { title: string; sub: string; t: number }; pointer: 'locked' | 'free' | 'failed'; dead: boolean; perfect: number; potions: { hp: number; en: number; elixir: number };
  fade: number; cine: boolean; fps: number; hint: string; summary: null | { name: string; time: number; kills: number; xp: number };
  addToast: (t: Toast) => void; set: (p: Partial<HudState>) => void;
}

export const useHud = create<HudState>((set) => ({
  hp: 100, maxHp: 100, en: 80, maxEn: 80, tf: 0, tfActive: false, tfTime: 0, tfMax: 20, tfName: '',
  cd: { e: 0, r: 0, v: 0, eMax: 1, rMax: 1, vMax: 1 }, costs: { e: 0, r: 0, v: 0 }, boss: null, target: null, prompt: '', location: 'Hearthvale', objective: '', objDist: 0,
  locked: false, combo: 0, status: { burn: 0, slow: 0, poison: 0 }, toasts: [], levelUp: null, banner: null, pointer: 'free', dead: false, perfect: 0, potions: { hp: 0, en: 0, elixir: 0 },
  fade: 0, cine: false, fps: 60, hint: '', summary: null,
  addToast: (t) => {
    set((s) => ({ toasts: [...s.toasts.slice(-4), t] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 3200);
  },
  set: (p) => set(p),
}));
