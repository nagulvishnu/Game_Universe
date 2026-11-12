import { create } from 'zustand';
import {
  ACHIEVEMENTS, DEFAULT_BINDS, DIFFICULTIES, MECHS, MECH_BY_ID, MISSIONS, MONSTERS, SKINS, UPGRADES, MAX_UPGRADE, upgradeCost, levelFromXp, WEAPONS, BOSS_LIST,
  type MechDef,
} from './data';

export interface Cust { primary: string; accent: string; glow: string; fx: string; armor: number; skin: string; loadout: [string, string, string] }
export interface MechSave { unlocked: boolean; xp: number; up: Record<string, number>; cust: Cust }
export interface Stats2 { kills: number; buildings: number; dodges: number; counters: number; ults: number; transforms: number; weak: number; bosses: number }
export interface Profile {
  credits: number; xp: number; mechs: Record<string, MechSave>; selected: string; done: boolean[];
  kills: Record<string, number>; seen: Record<string, boolean>; bossKills: Record<string, number>; ach: Record<string, boolean>;
  stats: Stats2; best: { arena: number; survival: number; city: number }; bestTimes: Record<string, number>;
}
export interface LaunchCfg { mode: 'campaign' | 'arena' | 'boss' | 'survival' | 'city'; mission?: number; mechId: string; theme: string; boss?: string; diff: number }
export interface RunResult {
  win: boolean; cfg: LaunchCfg; kills: Record<string, number>; xp: number; score: number; time: number; wave: number; buildings: number;
  dodges: number; counters: number; ults: number; transforms: number; weak: number; integrity: number; bosses: string[]; bonus: boolean;
  credits?: number; levelUp?: number; mechLevelUp?: number; firstClear?: boolean;
}

const defaultCust = (m: MechDef): Cust => ({ primary: m.primary, accent: m.accent, glow: m.glow, fx: m.glow, armor: 0, skin: 'factory', loadout: [...m.loadout] as Cust['loadout'] });
function freshProfile(): Profile {
  const mechs: Record<string, MechSave> = {};
  MECHS.forEach(m => (mechs[m.id] = { unlocked: m.unlockAfter === 0, xp: 0, up: {}, cust: defaultCust(m) }));
  return {
    credits: 1000, xp: 0, mechs, selected: 'aegis', done: MISSIONS.map(() => false), kills: {}, seen: {}, bossKills: {}, ach: {},
    stats: { kills: 0, buildings: 0, dodges: 0, counters: 0, ults: 0, transforms: 0, weak: 0, bosses: 0 }, best: { arena: 0, survival: 0, city: 0 }, bestTimes: {},
  };
}
function loadProfile(): Profile {
  const f = freshProfile();
  try {
    const raw = localStorage.getItem('colossus-save-v1');
    if (!raw) return f;
    const p = JSON.parse(raw);
    const merged: Profile = { ...f, ...p, stats: { ...f.stats, ...p.stats }, best: { ...f.best, ...p.best }, mechs: { ...f.mechs } };
    for (const id in f.mechs) if (p.mechs?.[id]) merged.mechs[id] = { ...f.mechs[id], ...p.mechs[id], cust: { ...f.mechs[id].cust, ...p.mechs[id].cust } };
    merged.done = MISSIONS.map((_, i) => !!p.done?.[i]);
    return merged;
  } catch { return f; }
}

export const QUALITY_PRESETS: Record<string, { shadows: number; res: number; particles: number; label: string }> = {
  low: { shadows: 0, res: 0.7, particles: 600, label: 'LOW' },
  medium: { shadows: 1, res: 0.9, particles: 1500, label: 'MEDIUM' },
  high: { shadows: 2, res: 1, particles: 2600, label: 'HIGH' },
  ultra: { shadows: 3, res: 1.25, particles: 4200, label: 'ULTRA' },
};
export interface Settings {
  quality: string; res: number; shadows: number; particles: number; master: number; music: number; sfx: number; sens: number; invertY: boolean;
  fov: number; shake: number; fps: boolean; binds: Record<string, string>; touchScale: number; touchLayout: Record<string, { x: number; y: number }>; touchSens: number; editTouch: boolean;
}
const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
function defaultSettings(): Settings {
  const q = isTouch ? 'low' : 'high';
  return { quality: q, ...QUALITY_PRESETS[q], master: 0.8, music: 0.45, sfx: 0.8, sens: 1, invertY: false, fov: 65, shake: 1, fps: false, binds: { ...DEFAULT_BINDS }, touchScale: 1, touchLayout: {}, touchSens: 1, editTouch: false } as Settings;
}
function loadSettings(): Settings {
  const d = defaultSettings();
  try { const raw = localStorage.getItem('colossus-settings-v1'); if (raw) { const s = JSON.parse(raw); return { ...d, ...s, binds: { ...d.binds, ...s.binds } }; } } catch { /* ignore */ }
  return d;
}

export const isMechUnlocked = (p: Profile, m: MechDef) => p.mechs[m.id]?.unlocked || m.unlockAfter === 0 || (m.unlockAfter > 0 && !!p.done[m.unlockAfter - 1]);
export const pilotLevel = (p: Profile) => levelFromXp(p.xp).level;
export const mechLevel = (p: Profile, id: string) => levelFromXp(p.mechs[id].xp).level;
export const weaponOwned = (p: Profile, id: string) => {
  if (pilotLevel(p) >= WEAPONS[id].unlock) return true;
  return MECHS.some(m => isMechUnlocked(p, m) && m.loadout.includes(id));
};
export const skinOwned = (p: Profile, id: string) => { const s = SKINS.find(k => k.id === id)!; return pilotLevel(p) >= s.unlock; };
export const missionUnlocked = (p: Profile, i: number) => i === 0 || p.done[i - 1];
export const bossUnlocked = (p: Profile, id: string) => {
  const i = BOSS_LIST.findIndex(b => b.id === id);
  if (i === 0) return true;
  const mi = MISSIONS.findIndex(m => m.boss === id);
  return p.bossKills[id] > 0 || (mi >= 0 && missionUnlocked(p, mi));
};

interface Toast { id: number; title: string; text: string; kind: string }
interface GameStore {
  profile: Profile; settings: Settings;
  screen: string; cfg: LaunchCfg | null; results: RunResult | null; paused: boolean; toasts: Toast[]; runKey: number; showControls: boolean;
  go: (s: string) => void; launch: (c: LaunchCfg) => void; setPaused: (b: boolean) => void; toast: (title: string, text: string, kind?: string) => void; dismissToast: (id: number) => void;
  setSettings: (s: Partial<Settings>) => void; setQuality: (q: string) => void; resetSettings: () => void;
  select: (id: string) => void; buyMech: (id: string) => boolean; upgrade: (mech: string, up: string) => boolean; setCust: (mech: string, c: Partial<Cust>) => void;
  finishRun: (r: RunResult) => void; checkAch: (extra?: Partial<Stats2> & { wave?: number }) => void; unlockAll: () => void; resetSave: () => void; markSeen: (id: string) => void;
  setShowControls: (b: boolean) => void;
}
let tid = 1;
export const useStore = create<GameStore>((set, get) => ({
  profile: loadProfile(), settings: loadSettings(), screen: 'menu', cfg: null, results: null, paused: false, toasts: [], runKey: 0, showControls: false,
  go: s => set({ screen: s, paused: false }),
  launch: c => set(st => ({ cfg: c, screen: 'game', results: null, paused: false, runKey: st.runKey + 1 })),
  setPaused: b => set({ paused: b }),
  setShowControls: b => set({ showControls: b }),
  toast: (title, text, kind = 'info') => { const id = tid++; set(s => ({ toasts: [...s.toasts, { id, title, text, kind }].slice(-4) })); setTimeout(() => get().dismissToast(id), 4200); },
  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  setSettings: p => set(s => ({ settings: { ...s.settings, ...p } })),
  setQuality: q => set(s => ({ settings: { ...s.settings, quality: q, ...QUALITY_PRESETS[q] } })),
  resetSettings: () => set({ settings: defaultSettings() }),
  select: id => set(s => ({ profile: { ...s.profile, selected: id } })),
  buyMech: id => {
    const { profile } = get(); const m = MECH_BY_ID[id];
    if (profile.credits < m.price || profile.mechs[id].unlocked) return false;
    set({ profile: { ...profile, credits: profile.credits - m.price, mechs: { ...profile.mechs, [id]: { ...profile.mechs[id], unlocked: true } } } });
    get().checkAch(); return true;
  },
  upgrade: (mech, up) => {
    const { profile } = get(); const ms = profile.mechs[mech]; const lvl = ms.up[up] || 0; const cost = upgradeCost(lvl);
    if (lvl >= MAX_UPGRADE || profile.credits < cost) return false;
    set({ profile: { ...profile, credits: profile.credits - cost, mechs: { ...profile.mechs, [mech]: { ...ms, up: { ...ms.up, [up]: lvl + 1 } } } } });
    return true;
  },
  setCust: (mech, c) => set(s => ({ profile: { ...s.profile, mechs: { ...s.profile.mechs, [mech]: { ...s.profile.mechs[mech], cust: { ...s.profile.mechs[mech].cust, ...c } } } } })),
  markSeen: id => { const p = get().profile; if (!p.seen[id]) set({ profile: { ...p, seen: { ...p.seen, [id]: true } } }); },
  checkAch: (extra = {}) => {
    const { profile } = get(); const st = profile.stats; const ex = extra as Record<string, number>;
    const g = (k: keyof Stats2) => st[k] + (ex[k] || 0);
    const owned = MECHS.filter(m => isMechUnlocked(profile, m)).length;
    const conds: Record<string, boolean> = {
      first: g('kills') >= 1, k50: g('kills') >= 50, k250: g('kills') >= 250, boss1: g('bosses') >= 1, boss6: BOSS_LIST.every(b => profile.bossKills[b.id] > 0),
      build: g('buildings') >= 60, dodge: g('dodges') >= 15, counter: g('counters') >= 5, ult: g('ults') >= 1, transform: g('transforms') >= 1,
      m1: profile.done[0], m10: profile.done[9], lvl5: pilotLevel(profile) >= 5, arena10: Math.max(profile.best.arena, profile.best.survival, ex.wave || 0) >= 10, weak: g('weak') >= 30, hangar: owned >= 5,
    };
    const fresh = ACHIEVEMENTS.filter(a => conds[a.id] && !profile.ach[a.id]);
    if (!fresh.length) return;
    const ach = { ...profile.ach }; fresh.forEach(a => (ach[a.id] = true));
    set({ profile: { ...profile, ach, credits: profile.credits + 250 * fresh.length } });
    fresh.forEach(a => get().toast('ACHIEVEMENT UNLOCKED', `${a.name} — ${a.desc} (+250 credits)`, 'ach'));
  },
  finishRun: r => {
    const { profile } = get(); const cfg = r.cfg; const diff = DIFFICULTIES[cfg.diff] || DIFFICULTIES[0];
    let credits = Math.round(r.xp * 0.55 * diff.reward); let xp = Math.round(r.xp * diff.reward);
    const done = [...profile.done]; let firstClear = false; const bestTimes = { ...profile.bestTimes };
    if (cfg.mode === 'campaign' && r.win && cfg.mission !== undefined) {
      const m = MISSIONS[cfg.mission]; firstClear = !done[cfg.mission];
      const mult = firstClear ? 1 : 0.4; credits += Math.round(m.reward.credits * mult * diff.reward); xp += Math.round(m.reward.xp * mult * diff.reward);
      if (r.bonus) credits += Math.round(m.reward.credits * 0.25);
      done[cfg.mission] = true;
      const k = 'm' + cfg.mission; if (!bestTimes[k] || r.time < bestTimes[k]) bestTimes[k] = r.time;
    }
    if (cfg.mode === 'boss' && r.win) { credits += 600 * (cfg.diff + 1); xp += 400 * (cfg.diff + 1); }
    if (cfg.mode === 'arena' || cfg.mode === 'survival') { credits += r.wave * 90; }
    if (cfg.mode === 'city' && r.win) { credits += 800 + Math.round(r.integrity * 10); xp += 500; }
    const before = levelFromXp(profile.xp).level; const after = levelFromXp(profile.xp + xp).level;
    const ms = profile.mechs[cfg.mechId]; const mb = levelFromXp(ms.xp).level; const ma = levelFromXp(ms.xp + xp).level;
    const kills = { ...profile.kills }; const seen = { ...profile.seen }; Object.entries(r.kills).forEach(([k, v]) => { kills[k] = (kills[k] || 0) + v; seen[k] = true; });
    const bossKills = { ...profile.bossKills }; r.bosses.forEach(b => (bossKills[b] = (bossKills[b] || 0) + 1));
    const s = profile.stats; const best = { ...profile.best };
    if (cfg.mode === 'arena') best.arena = Math.max(best.arena, r.wave);
    if (cfg.mode === 'survival') best.survival = Math.max(best.survival, r.wave);
    if (cfg.mode === 'city') best.city = Math.max(best.city, r.wave);
    const total = Object.values(r.kills).reduce((a, b) => a + b, 0);
    set({
      profile: { ...profile, credits: profile.credits + credits, xp: profile.xp + xp, done, kills, seen, bossKills, best, bestTimes,
        mechs: { ...profile.mechs, [cfg.mechId]: { ...ms, xp: ms.xp + xp } },
        stats: { kills: s.kills + total, buildings: s.buildings + r.buildings, dodges: s.dodges + r.dodges, counters: s.counters + r.counters, ults: s.ults + r.ults, transforms: s.transforms + r.transforms, weak: s.weak + r.weak, bosses: s.bosses + r.bosses.length } },
      results: { ...r, credits, xp, levelUp: after > before ? after : 0, mechLevelUp: ma > mb ? ma : 0, firstClear }, screen: 'results', paused: false,
    });
    setTimeout(() => get().checkAch(), 600);
  },
  unlockAll: () => set(s => {
    const mechs = { ...s.profile.mechs }; MECHS.forEach(m => (mechs[m.id] = { ...mechs[m.id], unlocked: true }));
    return { profile: { ...s.profile, mechs, xp: Math.max(s.profile.xp, 20000), done: MISSIONS.map(() => true), credits: s.profile.credits + 50000 } };
  }),
  resetSave: () => set({ profile: freshProfile() }),
}));

// persistence
let saveT: number | undefined;
useStore.subscribe((s, p) => {
  if (s.profile !== p.profile || s.settings !== p.settings) {
    clearTimeout(saveT);
    saveT = window.setTimeout(() => {
      try { localStorage.setItem('colossus-save-v1', JSON.stringify(s.profile)); localStorage.setItem('colossus-settings-v1', JSON.stringify(s.settings)); } catch { /* ignore */ }
    }, 250);
  }
});

// ------------------------------------------------ HUD (high frequency)
export interface HudState {
  hp: number; maxHp: number; armor: number; maxArmor: number; en: number; maxEn: number; weapons: string[]; wi: number; wcd: number;
  special: number; specialCd: number; specialCost: number; ult: number; transformCd: number; transformT: number; guardCd: number; dashCd: number;
  boss: { name: string; hp: number; max: number; phase: number; phases: number; vuln: boolean } | null;
  lock: boolean; objective: string; wave: number; waves: number; score: number; integrity: number; combo: number; time: number; kills: number; msg: string; msgT: number;
  cine: boolean; title: { t: string; s: string } | null; alt: string; beacon: number; enemies: number; fps: number; mode: string; sub: string; mechName: string; specialName: string; ultName: string; altName: string;
  choices: { id: string; name: string; desc: string }[] | null; shield: number; flying: boolean; bonus: string; countdown: number;
}
export const useHud = create<HudState>(() => ({
  hp: 1, maxHp: 1, armor: 0, maxArmor: 1, en: 1, maxEn: 1, weapons: [], wi: 0, wcd: 0, special: 1, specialCd: 0, specialCost: 0, ult: 0, transformCd: 0, transformT: 0, guardCd: 0, dashCd: 0, boss: null,
  lock: false, objective: '', wave: 0, waves: 0, score: 0, integrity: 100, combo: 0, time: 0, kills: 0, msg: '', msgT: 0, cine: false, title: null, alt: '', beacon: -1, enemies: 0, fps: 0, mode: '', sub: '',
  mechName: '', specialName: '', ultName: '', altName: '', choices: null, shield: 0, flying: false, bonus: '', countdown: 0,
}));

export const missionOf = (id?: number) => (id === undefined ? undefined : MISSIONS[id]);
export const monName = (id: string) => MONSTERS[id]?.name ?? id;
export const upgradeIcons = UPGRADES;

(window as any).__store = useStore;
