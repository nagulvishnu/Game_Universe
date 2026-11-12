import { create } from 'zustand';
import { ArenaId, ModeId, ScoreEntry, StatKey, StyleId, WStats, WeaponId } from './types';
import { CHALLENGES } from './data/world';

export const ACTIONS = ['forward', 'back', 'left', 'right', 'light', 'deflect', 'heavy', 'spec1', 'spec2', 'dodge', 'ult', 'awaken', 'jump', 'sprint', 'menu', 'arena', 'lock', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'] as const;
export type Action = typeof ACTIONS[number];
export const ACTION_LABELS: Record<Action, string> = {
  forward: 'Move Forward', back: 'Move Back', left: 'Move Left', right: 'Move Right', light: 'Light Attack', deflect: 'Deflect / Parry', heavy: 'Heavy Attack',
  spec1: 'Special 1', spec2: 'Special 2', dodge: 'Dodge / Dash', ult: 'Ultimate', awaken: 'Weapon Awakening', jump: 'Jump', sprint: 'Sprint', menu: 'Combat Menu',
  arena: 'Arena Menu', lock: 'Target Lock', w1: 'Weapon 1', w2: 'Weapon 2', w3: 'Weapon 3', w4: 'Weapon 4', w5: 'Weapon 5', w6: 'Weapon 6',
};
export const DEFAULT_KEYS: Record<Action, string> = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', light: 'Mouse0', deflect: 'Mouse2', heavy: 'KeyF', spec1: 'KeyE', spec2: 'KeyR', dodge: 'KeyQ', ult: 'KeyV',
  awaken: 'KeyT', jump: 'Space', sprint: 'ShiftLeft', menu: 'Tab', arena: 'KeyM', lock: 'KeyC', w1: 'Digit1', w2: 'Digit2', w3: 'Digit3', w4: 'Digit4', w5: 'Digit5', w6: 'Digit6',
};

export interface Settings {
  quality: 'low' | 'medium' | 'high'; shadows: boolean; fx: number; sens: number; camDist: number; fov: number; difficulty: 'easy' | 'normal' | 'hard';
  master: number; music: number; sfx: number; shake: number; vibrate: boolean; touch: 'auto' | 'on' | 'off'; keys: Record<Action, string>;
}
export interface TrainingCfg { enemy: string; behavior: 'passive' | 'slow' | 'normal' | 'aggressive'; pw: number; count: number }
export interface Save {
  progress: Record<WeaponId, WStats>; done: Record<string, boolean>; skin: Record<WeaponId, number>; extraOn: Record<WeaponId, boolean>;
  scores: ScoreEntry[]; name: string; swap: boolean; training: TrainingCfg; best: Record<string, number>; seenTutorial: boolean;
}
export type Screen = 'hub' | 'playing' | 'paused' | 'gameover' | 'combat' | 'arena';

const emptyStats = (): WStats => ({ perfects: 0, maxCombo: 0, kills: 0, counters: 0, specials: 0, ults: 0, airHits: 0, chain: 0 });
const WEAPON_IDS: WeaponId[] = ['inferno', 'thunder', 'void', 'glacier', 'plasma', 'titan'];
const mkRec = <T,>(f: () => T) => Object.fromEntries(WEAPON_IDS.map(w => [w, f()])) as Record<WeaponId, T>;

const defaultSettings = (): Settings => ({
  quality: (typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)) ? 'low' : 'medium', shadows: true, fx: 1, sens: 1, camDist: 1, fov: 62, difficulty: 'normal',
  master: .8, music: .5, sfx: .9, shake: 1, vibrate: true, touch: 'auto', keys: { ...DEFAULT_KEYS },
});
const defaultSave = (): Save => ({
  progress: mkRec(emptyStats), done: {}, skin: mkRec(() => 0), extraOn: mkRec(() => false), scores: [], name: 'PLAYER',
  swap: false, training: { enemy: 'knight', behavior: 'normal', pw: 1, count: 1 }, best: {}, seenTutorial: false,
});

const KEY = 'chaosbreaker.v1';
function load(): { settings: Settings; save: Save; weapon: WeaponId; style: StyleId } {
  const d = { settings: defaultSettings(), save: defaultSave(), weapon: 'inferno' as WeaponId, style: 'samurai' as StyleId };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      d.settings = { ...d.settings, ...j.settings, keys: { ...DEFAULT_KEYS, ...(j.settings?.keys ?? {}) } };
      d.save = { ...d.save, ...j.save, progress: { ...d.save.progress, ...(j.save?.progress ?? {}) }, skin: { ...d.save.skin, ...(j.save?.skin ?? {}) }, extraOn: { ...d.save.extraOn, ...(j.save?.extraOn ?? {}) }, training: { ...d.save.training, ...(j.save?.training ?? {}) } };
      if (j.weapon) d.weapon = j.weapon; if (j.style) d.style = j.style;
    }
  } catch { /* ignore */ }
  return d;
}

interface GameStore {
  screen: Screen; hubTab: 'play' | 'armory' | 'scores' | 'settings' | 'controls'; mode: ModeId; arena: ArenaId; weapon: WeaponId; style: StyleId;
  settings: Settings; save: Save; runId: number; result: null | { score: number; wave: number; mode: ModeId; weapon: WeaponId; rank: number; victory: boolean; stats: string[] };
  rebinding: Action | null; toast: string;
  set: (p: Partial<GameStore>) => void;
  setSettings: (p: Partial<Settings>) => void;
  setSave: (p: Partial<Save>) => void;
  setKey: (a: Action, code: string) => void;
  resetKeys: () => void;
  addScore: (e: ScoreEntry) => number;
  bump: (w: WeaponId, stat: StatKey, v: number, how: 'add' | 'max') => string[];
}

const init = load();
export const useGame = create<GameStore>((set, get) => ({
  screen: 'hub', hubTab: 'play', mode: 'training', arena: 'citadel', weapon: init.weapon, style: init.style, settings: init.settings, save: init.save,
  runId: 0, result: null, rebinding: null, toast: '',
  set: p => set(p),
  setSettings: p => set(s => ({ settings: { ...s.settings, ...p } })),
  setSave: p => set(s => ({ save: { ...s.save, ...p } })),
  setKey: (a, code) => set(s => {
    const keys = { ...s.settings.keys };
    for (const k of ACTIONS) if (keys[k] === code && k !== a) keys[k] = keys[a];
    keys[a] = code; return { settings: { ...s.settings, keys }, rebinding: null };
  }),
  resetKeys: () => set(s => ({ settings: { ...s.settings, keys: { ...DEFAULT_KEYS } } })),
  addScore: e => {
    const scores = [...get().save.scores, e].sort((a, b) => b.score - a.score).slice(0, 50);
    set(s => ({ save: { ...s.save, scores } }));
    return scores.filter(x => x.mode === e.mode).findIndex(x => x === e) + 1;
  },
  bump: (w, stat, v, how) => {
    const s = get().save, p = { ...s.progress[w] };
    const prev = p[stat]; p[stat] = how === 'add' ? prev + v : Math.max(prev, v);
    if (p[stat] === prev) return [];
    const done = { ...s.done }, news: string[] = [];
    for (const c of CHALLENGES[w]) if (!done[c.id] && p[c.stat] >= c.target) { done[c.id] = true; news.push(c.id); }
    set({ save: { ...s, progress: { ...s.progress, [w]: p }, done } });
    return news;
  },
}));

let saveT: ReturnType<typeof setTimeout> | null = null;
useGame.subscribe(s => {
  if (saveT) clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ settings: s.settings, save: s.save, weapon: s.weapon, style: s.style })); } catch { /* ignore */ }
  }, 300);
});

// ---------------- HUD (updated by the engine at low frequency) ----------------
export interface HudState {
  hp: number; maxHp: number; stam: number; maxStam: number; ult: number; awk: number; awkOn: boolean; combo: number; comboT: number; score: number; rank: string;
  wave: string; left: number; cds: [number, number, number]; target: null | { name: string; hp: number; max: number; posture: number; frozen: boolean };
  boss: null | { name: string; hp: number; max: number; posture: number; phase: number; phases: number; stagger: boolean };
  lock: boolean; objective: string[]; chain: number; hint: string; time: number; training: boolean; counter: boolean; deflectCd: number;
}
export const useHud = create<HudState>(() => ({
  hp: 100, maxHp: 100, stam: 100, maxStam: 100, ult: 0, awk: 0, awkOn: false, combo: 0, comboT: 0, score: 0, rank: 'D', wave: '', left: 0, cds: [0, 0, 0], target: null, boss: null,
  lock: false, objective: [], chain: 0, hint: '', time: 0, training: false, counter: false, deflectCd: 0,
}));

// ---------------- imperative bridge for juicy DOM feedback ----------------
export const bridge = {
  popup: (_text: string, _kind: string, _sub?: string) => { /* set by HUD */ },
  float: (_sx: number, _sy: number, _text: string, _cls: string) => { /* set by HUD */ },
  flash: (_color: string, _a: number, _ms: number) => { /* set by HUD */ },
  banner: (_title: string, _sub: string) => { /* set by HUD */ },
  zoom: (_amt: number) => { /* set by HUD */ },
  toast: (_t: string) => { /* set by HUD */ },
};
