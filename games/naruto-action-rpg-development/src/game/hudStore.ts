import { create } from 'zustand';
import type { Form } from './types';

export interface CdInfo { id: string; name: string; icon: string; key: string; rem: number; total: number; cost: number; locked: boolean; color: string }
export interface Toast { id: number; text: string; kind: 'info' | 'good' | 'warn' | 'level' | 'loot'; expires: number }
export interface HudState {
  hp: number; maxHp: number; chakra: number; maxChakra: number; stamina: number; ult: number;
  slots: CdInfo[]; form: Form; formRem: number; formTotal: number;
  target: { name: string; hp: number; max: number; tier: string; status: string[]; level: number } | null;
  boss: { name: string; title: string; hp: number; max: number; phase: number; shield: number } | null;
  prompt: string | null; zone: string; zoneSub: string; clock: string; night: boolean;
  missionTitle: string | null; objectives: { text: string; done: boolean }[]; hint: string | null; objDist: number | null; objAngle: number;
  toasts: Toast[]; letterbox: boolean; banner: { title: string; sub: string; id: number } | null;
  combo: number; genjutsu: boolean; locked: boolean; guard: boolean; charging: boolean; timeLimit: number | null; fps: number;
  zoneBanner: { name: string; sub: string; id: number } | null; pointerLocked: boolean;
  level: number; xp: number; xpNeed: number; charName: string; charColor: string; ryo: number;
  set: (p: Partial<HudState>) => void;
}

let toastId = 1;
export const useHud = create<HudState>((set) => ({
  hp: 100, maxHp: 100, chakra: 100, maxChakra: 100, stamina: 100, ult: 0, slots: [], form: 'base', formRem: 0, formTotal: 1,
  target: null, boss: null, prompt: null, zone: '', zoneSub: '', clock: '', night: false,
  missionTitle: null, objectives: [], hint: null, objDist: null, objAngle: 0, toasts: [], letterbox: false, banner: null,
  combo: 0, genjutsu: false, locked: false, guard: false, charging: false, timeLimit: null, fps: 60, zoneBanner: null, pointerLocked: false,
  level: 1, xp: 0, xpNeed: 45, charName: 'Naruto', charColor: '#ff8a1a', ryo: 0,
  set: (p) => set(p),
}));

export function pushToast(text: string, kind: Toast['kind'] = 'info', ms = 3600) {
  const t: Toast = { id: toastId++, text, kind, expires: performance.now() + ms };
  useHud.setState((s) => ({ toasts: [...s.toasts.filter((x) => x.expires > performance.now()).slice(-5), t] }));
}
let bannerId = 1;
export function showBanner(title: string, sub: string, ms = 3200) {
  const id = bannerId++;
  useHud.setState({ banner: { title, sub, id } });
  setTimeout(() => { if (useHud.getState().banner?.id === id) useHud.setState({ banner: null }); }, ms);
}
export function showZone(name: string, sub: string) {
  const id = bannerId++;
  useHud.setState({ zoneBanner: { name, sub, id } });
  setTimeout(() => { if (useHud.getState().zoneBanner?.id === id) useHud.setState({ zoneBanner: null }); }, 3400);
}
