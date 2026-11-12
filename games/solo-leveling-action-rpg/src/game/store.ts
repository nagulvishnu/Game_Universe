import { create } from 'zustand';
import {
  ENEMIES,
  ITEMS,
  MISSIONS,
  QUESTS,
  RANKS,
  SHADOWS,
  STAT_KEYS,
  xpNeeded,
  type QuestDef,
  type Slot,
  type StatKey,
} from './data';
import { SAVE_VERSION, defaultSettings, freshSave, normalizeSave, normalizeScores, normalizeSettings } from './save';

export { DEFAULT_KEYS, QUALITY_PRESETS, defaultSettings } from './save';

// ---------- Event bus (story script / engine listen) ----------
export interface GameEvents {
  requestLock: [];
  ui: [string];
  levelup: [number];
  equip: [string | undefined, string];
  useItem: [string];
  retry: [];
  skipCine: [string?];
  applySettings: [];
  command: [string];
  summon: [string[]];
  dismiss: [string[] | undefined];
  saveNow: [];
  travelTo: [string];
  sfx: [string, number?];
  dialogAdvance: [];
  dialogChoice: [string];
  summonDefault: [];
  questDone: [string];
  questStart: [string];
  acceptSystem: [];
  playerHurt: [number];
}
type Fn = (...a: any[]) => void;
const listeners: Record<string, Fn[]> = {};
export const bus = {
  on<K extends keyof GameEvents>(ev: K, f: (...args: GameEvents[K]) => void) {
    (listeners[ev] ||= []).push(f as Fn);
    return () => {
      listeners[ev] = listeners[ev].filter((x) => x !== f);
    };
  },
  emit<K extends keyof GameEvents>(ev: K, ...a: GameEvents[K]) {
    (listeners[ev] || []).slice().forEach((f) => f(...a));
  },
};

// ---------- Types ----------
export interface ShadowRec {
  id: string;
  key: string;
  name: string;
  rank: number;
  level: number;
  xp: number;
  favorite: boolean;
  squad: number;
  evo: number;
  state: 'stored' | 'summoned';
  kills: number;
}
export interface Settings {
  master: number;
  music: number;
  sfx: number;
  amb: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resScale: number;
  shadowQ: number;
  draw: number;
  particles: number;
  npcDensity: number;
  army: number;
  post: boolean;
  sens: number;
  uiScale: number;
  reducedMotion: boolean;
  keys: Record<string, string>;
}
export interface QState {
  state: 'active' | 'done';
  prog: number[];
}
export interface SaveData {
  v: number;
  chapter: number;
  level: number;
  xp: number;
  points: number;
  stats: Record<StatKey, number>;
  gold: number;
  essence: number;
  inv: Record<string, number>;
  equip: Partial<Record<Slot, string>>;
  shadows: ShadowRec[];
  quests: Record<string, QState>;
  flags: Record<string, boolean>;
  cleared: string[];
  titles: string[];
  title: string;
  dailyCount: number;
  dailyLeft: number;
  score: number;
  kills: number;
  playTime: number;
  tracked: string;
  savedAt: number;
}
export interface HighScore {
  name: string;
  score: number;
  level: number;
  note: string;
  date: string;
}
export type Panel =
  | 'none'
  | 'status'
  | 'inventory'
  | 'shadows'
  | 'quests'
  | 'map'
  | 'association'
  | 'shop'
  | 'settings'
  | 'controls'
  | 'credits'
  | 'load'
  | 'scores'
  | 'accept';
export interface Notif {
  id: number;
  kind: string;
  title: string;
  text?: string;
  t: number;
}
export interface DialogState {
  name: string;
  lines: string[];
  idx: number;
  choices?: { label: string; id: string }[];
  npc: string;
  color?: string;
}

export function loadSettings(): Settings {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem('sl-settings') || 'null'));
  } catch {
    return defaultSettings();
  }
}
export function loadScores(): HighScore[] {
  try {
    return normalizeScores(JSON.parse(localStorage.getItem('sl-scores') || '[]'));
  } catch {
    return [];
  }
}

// ---------- IndexedDB ----------
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('sl-shadow-monarch', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('saves');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function idbPut(key: string, val: unknown) {
  try {
    const db = await idb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    localStorage.setItem('sl-save-' + key, JSON.stringify(val));
  }
}
export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await idb();
    return await new Promise<T | null>((res, rej) => {
      const r = db.transaction('saves').objectStore('saves').get(key);
      r.onsuccess = () => res((r.result as T) ?? null);
      r.onerror = () => rej(r.error);
    });
  } catch {
    try {
      return JSON.parse(localStorage.getItem('sl-save-' + key) || 'null');
    } catch {
      return null;
    }
  }
}

// ---------- Derived ----------
export function derive(s: SaveData) {
  const sum = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, spd: 0, atkSpd: 0, str: 0, agi: 0, vit: 0, int: 0, per: 0 };
  for (const id of Object.values(s.equip)) {
    const it = id ? ITEMS[id] : null;
    if (!it) continue;
    for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += (it as any)[k] || 0;
  }
  const st = {
    str: s.stats.str + sum.str,
    agi: s.stats.agi + sum.agi,
    vit: s.stats.vit + sum.vit,
    int: s.stats.int + sum.int,
    per: s.stats.per + sum.per,
  };
  const w = s.equip.weapon ? ITEMS[s.equip.weapon] : null;
  return {
    st,
    weapon: w,
    atk: sum.atk + st.str * 1.6,
    def: sum.def + st.vit * 0.6,
    maxHp: Math.round(50 + st.vit * 9 + sum.hp + s.level * 4),
    maxMp: Math.round(20 + st.int * 7 + sum.mp),
    spd: 1 + st.agi * 0.006 + sum.spd,
    atkSpd: Math.max(0.5, 1 + st.agi * 0.008 + (w?.atkSpd || 0)),
    crit: 0.04 + st.per * 0.004 + sum.crit,
    mpRegen: 1.2 + st.int * 0.08,
    lockRange: 16 + st.per * 0.5,
    skillMul: 1 + st.int * 0.012,
    extractBonus: st.per * 0.006 + st.int * 0.003,
  };
}
export function shadowStats(r: ShadowRec) {
  const d = SHADOWS[r.key];
  const g = 1 + 0.12 * (r.level - 1);
  const rk = 1 + 0.35 * (r.rank - d.startRank);
  return {
    hp: Math.round(d.hp * g * rk),
    atk: Math.round(d.atk * g * rk),
    def: Math.round(d.def * g * rk),
    speed: d.speed * (1 + 0.02 * (r.rank - d.startRank)),
  };
}
export const shadowXpNeed = (lvl: number) => Math.round(40 * Math.pow(lvl, 1.5));
export function questDef(id: string, s?: { dailyCount: number }): QuestDef | undefined {
  const q = QUESTS[id] || MISSIONS.find((m) => m.id === id);
  if (!q) return undefined;
  if (id === 'q_daily') {
    const m = 1 + 0.25 * (s?.dailyCount ?? useGame.getState().save.dailyCount);
    return {
      ...q,
      objs: q.objs.map((o) => ({ ...o, need: Math.round(o.need * m) })),
      reward: { ...q.reward, xp: Math.round(q.reward.xp * m), gold: Math.round(q.reward.gold * m) },
    };
  }
  return q;
}

// ---------- Main store ----------
interface G {
  screen: 'menu' | 'playing' | 'paused' | 'dead' | 'ending';
  panel: Panel;
  session: number;
  save: SaveData;
  settings: Settings;
  scores: HighScore[];
  notifs: Notif[];
  dialog: DialogState | null;
  cine: { speaker?: string; text?: string; bars: boolean; fade?: number } | null;
  arise: { stage: number; name?: string; rank?: string; text?: string } | null;
  banner: { text: string; sub?: string; color?: string; t: number } | null;
  hasSave: boolean;
  runScore: number;
  deathInfo: { score: number; cause: string } | null;
  lastSaved: number;
  shopTab: string;
  listVer: number;
  setScreen(s: G['screen']): void;
  setPanel(p: Panel): void;
  setSettings(p: Partial<Settings>): void;
  newGame(): void;
  load(d: SaveData): void;
  snapshot(): SaveData;
  persist(slot?: string): Promise<void>;
  notify(n: { kind?: string; title: string; text?: string }): void;
  setFlag(k: string, v?: boolean): void;
  addXp(n: number): void;
  allocate(k: StatKey): void;
  addItem(id: string, n?: number): void;
  removeItem(id: string, n?: number): boolean;
  equip(id: string): void;
  unequip(s: Slot): void;
  sell(id: string): void;
  buy(id: string): void;
  startQuest(id: string): void;
  questEvent(type: string, key?: string, n?: number): void;
  addScore(n: number): void;
  submitScore(note: string): void;
  setTitle(t: string): void;
  addShadow(key: string): ShadowRec;
  patchShadow(id: string, p: Partial<ShadowRec>): void;
  upgradeShadow(id: string): void;
  evolveShadow(id: string): void;
  addGold(n: number): void;
  setDialog(d: DialogState | null): void;
  setBanner(b: G['banner']): void;
  setArise(a: G['arise']): void;
  setCine(c: G['cine']): void;
}

export const useGame = create<G>((set, get) => ({
  screen: 'menu',
  panel: 'none',
  session: 0,
  save: freshSave(),
  settings: loadSettings(),
  scores: loadScores(),
  notifs: [],
  dialog: null,
  cine: null,
  arise: null,
  banner: null,
  hasSave: false,
  runScore: 0,
  deathInfo: null,
  lastSaved: 0,
  shopTab: 'buy',
  listVer: 0,
  setScreen: (screen) => set({ screen }),
  setPanel: (panel) => set({ panel }),
  setSettings: (p) => {
    const settings = { ...get().settings, ...p };
    try {
      localStorage.setItem('sl-settings', JSON.stringify(settings));
    } catch {
      /* settings still apply for this session when storage is unavailable */
    }
    set({ settings });
  },
  newGame: () =>
    set((s) => ({
      save: freshSave(),
      session: s.session + 1,
      screen: 'playing',
      panel: 'none',
      runScore: 0,
      notifs: [],
      dialog: null,
      cine: null,
    })),
  load: (d) => {
    const { save, warnings, migratedFrom } = normalizeSave(d);
    set((s) => ({
      save,
      session: s.session + 1,
      screen: 'playing',
      panel: 'none',
      runScore: 0,
      notifs: [],
      dialog: null,
      cine: null,
      hasSave: true,
    }));
    if (warnings.length || migratedFrom) {
      setTimeout(
        () =>
          get().notify({
            kind: 'system',
            title: migratedFrom ? 'SAVE MIGRATED' : 'SAVE RECOVERED',
            text: warnings.slice(0, 3).join('\n') || `Version ${migratedFrom} → ${SAVE_VERSION}`,
          }),
        700
      );
    }
  },
  snapshot: () => ({ ...get().save, v: SAVE_VERSION, savedAt: Date.now() }),
  persist: async (slot = 'auto') => {
    try {
      const d = get().snapshot();
      await idbPut(slot, d);
      await idbPut('latest', slot);
      set({ lastSaved: Date.now(), hasSave: true });
    } catch {
      get().notify({
        kind: 'system',
        title: 'SAVE FAILED',
        text: 'Could not write the save. Your current progress is still in memory.',
      });
    }
  },
  notify: (n) => {
    const id = Math.random();
    set((s) => ({
      notifs: [...s.notifs.slice(-4), { id, kind: n.kind || 'system', title: n.title, text: n.text, t: Date.now() }],
    }));
    setTimeout(() => set((s) => ({ notifs: s.notifs.filter((x) => x.id !== id) })), 4800);
    bus.emit('sfx', n.kind === 'levelup' ? 'levelup' : 'system');
  },
  setFlag: (k, v = true) => set((s) => ({ save: { ...s.save, flags: { ...s.save.flags, [k]: v } } })),
  addGold: (n) => set((s) => ({ save: { ...s.save, gold: Math.max(0, s.save.gold + n) } })),
  addXp: (n) => {
    const s = get();
    let { xp, level, points } = s.save;
    xp += Math.round(n * (s.save.title === 'Necromancer' ? 1.05 : 1));
    let up = 0;
    while (level < 60 && xp >= xpNeeded(level)) {
      xp -= xpNeeded(level);
      level++;
      points += 5;
      up++;
    }
    set({ save: { ...s.save, xp, level, points } });
    if (up) {
      s.notify({ kind: 'levelup', title: 'LEVEL UP!', text: `Level ${level}  (+${up * 5} stat points)` });
      bus.emit('levelup', level);
    }
  },
  allocate: (k) =>
    set((s) =>
      s.save.points > 0
        ? { save: { ...s.save, points: s.save.points - 1, stats: { ...s.save.stats, [k]: s.save.stats[k] + 1 } } }
        : s
    ),
  addItem: (id, n = 1) => {
    set((s) => ({ save: { ...s.save, inv: { ...s.save.inv, [id]: (s.save.inv[id] || 0) + n } } }));
    if (ITEMS[id] && id !== 'essence')
      get().notify({ kind: 'item', title: 'ITEM ACQUIRED', text: `${ITEMS[id].name} x${n}` });
  },
  removeItem: (id, n = 1) => {
    const c = get().save.inv[id] || 0;
    if (c < n) return false;
    set((s) => {
      const inv = { ...s.save.inv };
      inv[id] = c - n;
      if (inv[id] <= 0) delete inv[id];
      return { save: { ...s.save, inv } };
    });
    return true;
  },
  equip: (id) => {
    const it = ITEMS[id];
    const s = get();
    if (!it?.slot || (s.save.inv[id] || 0) < 1) return;
    const old = s.save.equip[it.slot];
    set({ save: { ...s.save, equip: { ...s.save.equip, [it.slot]: id } } });
    bus.emit('equip', old, id);
  },
  unequip: (slot) =>
    set((s) => {
      const e = { ...s.save.equip };
      delete e[slot];
      return { save: { ...s.save, equip: e } };
    }),
  sell: (id) => {
    const it = ITEMS[id];
    const s = get();
    if (!it || (s.save.inv[id] || 0) < 1) return;
    if (Object.values(s.save.equip).includes(id) && (s.save.inv[id] || 0) < 2) return;
    if (it.kind === 'key' || id === 'essence') return;
    get().removeItem(id);
    get().addGold(Math.floor(it.price * 0.4));
    bus.emit('sfx', 'coin');
  },
  buy: (id) => {
    const it = ITEMS[id];
    const s = get();
    if (!it || s.save.gold < it.price) {
      get().notify({ title: 'NOT ENOUGH GOLD' });
      return;
    }
    get().addGold(-it.price);
    set((st) => ({ save: { ...st.save, inv: { ...st.save.inv, [id]: (st.save.inv[id] || 0) + 1 } } }));
    bus.emit('sfx', 'coin');
  },
  setTitle: (t) => set((s) => ({ save: { ...s.save, title: t } })),
  startQuest: (id) => {
    const s = get();
    const q = questDef(id);
    if (!q) return;
    if (s.save.quests[id]?.state === 'active') return;
    set({
      save: {
        ...s.save,
        quests: { ...s.save.quests, [id]: { state: 'active', prog: q.objs.map(() => 0) } },
        tracked: q.kind === 'main' || q.system || !s.save.tracked ? id : s.save.tracked,
      },
    });
    s.notify({ kind: 'quest', title: q.system ? 'QUEST ARRIVED' : 'NEW QUEST', text: q.title });
    bus.emit('questStart', id);
  },
  questEvent: (type, key, n = 1) => {
    const s = get();
    let quests = s.save.quests;
    const done: string[] = [];
    for (const id of Object.keys(quests)) {
      const qs = quests[id];
      if (qs.state !== 'active') continue;
      const q = questDef(id);
      if (!q) continue;
      let changed = false;
      const prog = qs.prog.map((p, i) => {
        const o = q.objs[i];
        if (o.type === type && (!o.key || o.key === 'any' || o.key === key) && p < o.need) {
          changed = true;
          return Math.min(o.need, p + n);
        }
        return p;
      });
      if (changed) {
        quests = { ...quests, [id]: { ...qs, prog } };
        if (prog.every((p, i) => p >= q.objs[i].need)) done.push(id);
      }
    }
    set({ save: { ...s.save, quests } });
    for (const id of done) {
      const q = questDef(id)!;
      const cur = get();
      const r = q.reward;
      set({
        save: {
          ...cur.save,
          quests: { ...cur.save.quests, [id]: { ...cur.save.quests[id], state: 'done' } },
          gold: cur.save.gold + r.gold,
          essence: cur.save.essence + (r.essence || 0),
          points: cur.save.points + (r.points || 0),
          dailyCount: id === 'q_daily' ? cur.save.dailyCount + 1 : cur.save.dailyCount,
        },
      });
      if (r.essence) get().addItem('essence', r.essence);
      get().addXp(r.xp);
      (r.items || []).forEach((i) => get().addItem(i));
      get().addScore(r.xp);
      if (r.title) {
        set((st) => ({ save: { ...st.save, titles: [...new Set([...st.save.titles, r.title!])], title: r.title! } }));
        get().notify({ kind: 'item', title: 'TITLE ACQUIRED', text: r.title });
      }
      get().notify({ kind: 'quest', title: 'QUEST COMPLETE', text: `${q.title}  +${r.xp} XP  +${r.gold} G` });
      bus.emit('sfx', 'questdone');
      bus.emit('questDone', id);
    }
    if (type === 'kill') {
      set((st) => ({ save: { ...st.save, kills: st.save.kills + n } }));
    }
  },
  addScore: (n) =>
    set((s) => ({ runScore: s.runScore + Math.round(n), save: { ...s.save, score: s.save.score + Math.round(n) } })),
  submitScore: (note) => {
    const s = get();
    if (s.runScore <= 0) return;
    const scores = [
      ...s.scores,
      { name: 'SUNG JIN-WOO', score: s.runScore, level: s.save.level, note, date: new Date().toLocaleDateString() },
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    try {
      localStorage.setItem('sl-scores', JSON.stringify(scores));
    } catch {
      /* keep the in-memory high score even if storage is unavailable */
    }
    set({ scores, runScore: 0 });
  },
  addShadow: (key) => {
    const d = SHADOWS[key];
    const rec: ShadowRec = {
      id: 'sh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      key,
      name: d.name,
      rank: d.startRank,
      level: 1,
      xp: 0,
      favorite: key === 'igris',
      squad: key === 'igris' ? 1 : 0,
      evo: 0,
      state: 'stored',
      kills: 0,
    };
    set((s) => ({ save: { ...s.save, shadows: [...s.save.shadows, rec] }, listVer: s.listVer + 1 }));
    return rec;
  },
  patchShadow: (id, p) =>
    set((s) => ({ save: { ...s.save, shadows: s.save.shadows.map((x) => (x.id === id ? { ...x, ...p } : x)) } })),
  upgradeShadow: (id) => {
    const s = get();
    const r = s.save.shadows.find((x) => x.id === id);
    if (!r) return;
    if ((s.save.inv.essence || 0) < 1) {
      s.notify({ title: 'NEED SHADOW ESSENCE' });
      return;
    }
    s.removeItem('essence');
    let { level, xp } = r;
    xp += shadowXpNeed(level);
    while (xp >= shadowXpNeed(level) && level < 50) {
      xp -= shadowXpNeed(level);
      level++;
    }
    s.patchShadow(id, { level, xp });
    s.notify({ title: 'SHADOW UPGRADED', text: `${r.name} \u2192 Lv ${level}` });
  },
  evolveShadow: (id) => {
    const s = get();
    const r = s.save.shadows.find((x) => x.id === id);
    if (!r) return;
    const d = SHADOWS[r.key];
    const e = d.evo[r.evo];
    if (!e || r.level < e.level) return;
    if (!s.removeItem('essence', e.cost)) {
      s.notify({ title: 'NEED ' + e.cost + ' SHADOW ESSENCE' });
      return;
    }
    s.patchShadow(id, { rank: r.rank + 1, evo: r.evo + 1 });
    s.notify({ kind: 'levelup', title: 'SHADOW EVOLVED', text: `${r.name} is now ${RANKS[r.rank + 1]}` });
  },
  setDialog: (dialog) => set({ dialog }),
  setBanner: (banner) => set({ banner }),
  setArise: (arise) => set({ arise }),
  setCine: (cine) => set({ cine }),
}));

export interface Hud {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  target: { name: string; hp: number; max: number; rank: string } | null;
  boss: { name: string; hp: number; max: number; phase: number } | null;
  prompt: string | null;
  cds: Record<string, number>;
  zone: string;
  army: number;
  cmd: string;
  dailyLeft: number;
  combo: number;
  danger: number;
  kneel: number;
  timer: string | null;
  locked: boolean;
  weapon: string;
}
export const useHud = create<Hud>(() => ({
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  target: null,
  boss: null,
  prompt: null,
  cds: {},
  zone: 'Seoul',
  army: 0,
  cmd: 'Follow',
  dailyLeft: 0,
  combo: 0,
  danger: 0,
  kneel: 0,
  timer: null,
  locked: false,
  weapon: '',
}));
export { STAT_KEYS, ENEMIES };
