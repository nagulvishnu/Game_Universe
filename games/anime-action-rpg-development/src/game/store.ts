import { create } from 'zustand';
import {
  Item, Slot, genItem, itemStats, Stats, xpToNext, MAX_LEVEL, QUESTS, QUEST_BY_ID, Quest, upgradeCost, RECIPES, sellValue, MATS, Element, Rarity, RAR,
} from './data';

export const SAVE_KEY = 'dungeon_awakening_save';
export const SAVE_VERSION = 2;

export interface Settings { master: number; music: number; sfx: number; ambience: number; quality: 'low' | 'medium' | 'high'; sens: number; invertY: boolean; shake: boolean }
export interface Appearance { hair: number; hairColor: string; outfit: string; accessory: 'none' | 'cape' | 'scarf' }
export interface PlayerState { level: number; xp: number; gold: number; attrPts: number; skillPts: number; attr: { str: number; vit: number; int: number; dex: number }; skills: Record<string, number>; tfStage: number }
export interface Progress { completed: Record<string, number>; bossKills: Record<string, number>; chapter: number; secrets: string[]; chests: string[]; achievements: string[]; kills: Record<string, number>; playTime: number; chestCount: number; deaths: number }
export interface QState { s: 'active' | 'done'; p: number[] }

export interface SaveData {
  v: number; player: PlayerState; inventory: Item[]; equipment: Partial<Record<Slot, Item>>; mats: Record<string, number>; appearance: Appearance;
  progress: Progress; quests: Record<string, QState>; tracked: string; settings: Settings; shop: Item[]; shopLvl: number; started: boolean; outfits: string[];
}

export const defaultSettings = (): Settings => ({ master: 0.8, music: 0.5, sfx: 0.8, ambience: 0.5, quality: 'medium', sens: 1, invertY: false, shake: true });
const defaultPlayer = (): PlayerState => ({ level: 1, xp: 0, gold: 80, attrPts: 0, skillPts: 1, attr: { str: 0, vit: 0, int: 0, dex: 0 }, skills: { burst: 1, rift: 1, judgment: 1, awaken: 1, ironwill: 0, keenedge: 0, abyssflow: 0, mastery: 0, secondwind: 0 }, tfStage: 1 });
const defaultProgress = (): Progress => ({ completed: {}, bossKills: {}, chapter: 1, secrets: [], chests: [], achievements: [], kills: {}, playTime: 0, chestCount: 0, deaths: 0 });
const defaultApp = (): Appearance => ({ hair: 0, hairColor: '#2a2438', outfit: '#3a5a8a', accessory: 'scarf' });

function starterGear(): { inv: Item[]; eq: Partial<Record<Slot, Item>> } {
  const w = genItem(1, { slot: 'weapon', wtype: 'sword', rarity: 'common' });
  w.name = 'Rusted Starter Sword'; w.stats = { atk: 9 }; w.lvl = 1; w.color = 0x9aa4b0;
  return { inv: [], eq: { weapon: w } };
}
export function freshSave(): SaveData {
  const g = starterGear();
  return { v: SAVE_VERSION, player: defaultPlayer(), inventory: g.inv, equipment: g.eq, mats: { hp_potion: 3, en_potion: 1, iron_ore: 2 }, appearance: defaultApp(), progress: defaultProgress(), quests: { m1: { s: 'active', p: [0] } }, tracked: 'm1', settings: defaultSettings(), shop: [], shopLvl: 0, started: false, outfits: ['#3a5a8a', '#8a3a3a', '#3a8a5a'] };
}

function migrate(raw: any): SaveData {
  const d = freshSave();
  if (!raw || typeof raw !== 'object') return d;
  const merge = (a: any, b: any): any => {
    if (b === undefined || b === null) return a;
    if (Array.isArray(a)) return Array.isArray(b) ? b : a;
    if (typeof a === 'object' && a) { const o: any = { ...a }; for (const k of Object.keys(b)) o[k] = k in a ? merge(a[k], b[k]) : b[k]; return o; }
    return typeof a === typeof b ? b : a;
  };
  const out: any = {};
  for (const k of Object.keys(d) as (keyof SaveData)[]) out[k] = merge((d as any)[k], raw[k]);
  out.v = SAVE_VERSION;
  if (raw.v === 1) { out.player.skills = { ...d.player.skills, ...(raw.player?.skills || {}) }; }
  if (!out.equipment || typeof out.equipment !== 'object') out.equipment = d.equipment;
  out.inventory = (out.inventory as Item[]).filter((i) => i && i.id && i.slot && i.rarity);
  return out as SaveData;
}

export function loadSave(): SaveData | null {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    return migrate(JSON.parse(s));
  } catch (e) {
    try { localStorage.setItem(SAVE_KEY + '_corrupt', localStorage.getItem(SAVE_KEY) || ''); } catch { /* ignore */ }
    console.warn('Save corrupted — starting fresh', e);
    return null;
  }
}

export type Panel = 'inventory' | 'character' | 'skills' | 'quests' | 'map' | 'settings' | 'shop' | 'smith' | 'board' | 'dialogue' | null;
export interface Toast { id: number; text: string; color: string; icon?: string }

export function calcStats(s: { player: PlayerState; equipment: Partial<Record<Slot, Item>> }) {
  const P = s.player; const L = P.level; const sk = P.skills;
  let hp = 120 + 10 * (L - 1) + P.attr.vit * 8; let en = 80 + 3 * (L - 1) + P.attr.int * 3;
  let atk = 10 + 2 * (L - 1) + P.attr.str * 1.5; let def = 4 + Math.floor(L / 2) + P.attr.vit * 0.5;
  let crit = 5 + P.attr.dex * 0.4 + sk.keenedge * 2; let critDmg = 150; let regen = 4 + P.attr.int * 0.05 + sk.abyssflow * 1.2;
  let elem: Element = 'none'; let elemDmg = 0; const passives: string[] = [];
  for (const it of Object.values(s.equipment)) {
    if (!it) continue; const st = itemStats(it);
    atk += st.atk || 0; def += st.def || 0; hp += st.hp || 0; crit += st.crit || 0; critDmg += st.critDmg || 0; regen += st.regen || 0; en += st.en || 0;
    if (it.passive) passives.push(it.passive);
    if (it.slot === 'weapon' && it.element) { elem = it.element; elemDmg = it.elemDmg || 0; }
  }
  hp *= 1 + 0.04 * sk.ironwill; atk *= 1 + 0.03 * sk.mastery;
  return { hp: Math.round(hp), en: Math.round(en), atk: Math.round(atk), def: Math.round(def), crit: Math.min(75, crit), critDmg, regen, elem, elemDmg, passives, rating: Math.round(atk * 4 + def * 3 + hp / 4 + crit * 5 + critDmg / 5 + regen * 8) };
}
export const equipScore = (eq: Partial<Record<Slot, Item>>) => Object.values(eq).reduce((a, it) => a + (it ? Math.round(((itemStats(it).atk || 0) * 2 + (itemStats(it).def || 0) * 1.5 + (itemStats(it).hp || 0) / 5)) : 0), 0);

interface GameState extends SaveData {
  screen: 'menu' | 'play'; paused: boolean; panel: Panel; panelData: any; hasSave: boolean; intro: boolean; ending: boolean;
  // actions
  setScreen: (s: 'menu' | 'play') => void; setPaused: (p: boolean) => void; openPanel: (p: Panel, data?: any) => void; closePanel: () => void;
  newGame: () => void; continueGame: () => boolean; save: () => void; wipe: () => void;
  addXp: (n: number) => void; addGold: (n: number) => void; giveItem: (it: Item, silent?: boolean) => boolean; addMat: (id: string, n: number) => void; useMat: (id: string, n: number) => boolean;
  equip: (id: string) => void; unequip: (s: Slot) => void; sell: (id: string) => void; upgrade: (id: string) => void; craft: (id: string) => void; buy: (idx: number) => void; restock: () => void;
  spendSkill: (id: string) => void; spendAttr: (k: 'str' | 'vit' | 'int' | 'dex') => void; setSettings: (p: Partial<Settings>) => void; setAppearance: (p: Partial<Appearance>) => void;
  questEvent: (k: string, t: string, n?: number) => void; acceptQuest: (id: string) => void; track: (id: string) => void; talkNpc: (id: string) => void;
  completeDungeon: (id: string) => void; recordKill: (id: string) => void; toast: (text: string, color?: string, icon?: string) => void; unlockAch: (id: string, name: string) => void;
  setEnding: (b: boolean) => void; setIntro: (b: boolean) => void; addPlay: (dt: number) => void;
}

export const useGame = create<GameState>((set, get) => {
  const loaded = loadSave();
  const base = loaded ?? freshSave();
  let toastId = 1;
  const pushToast = (text: string, color = '#fff', icon?: string) => { import('./hud').then((m) => m.useHud.getState().addToast({ id: toastId++, text, color, icon })); };

  const questTargetCount = (q: Quest, i: number, st: QState): number => {
    const o = q.obj[i]; const s = get();
    if (o.k === 'collect') return Math.min(o.n, s.mats[o.t] || 0);
    if (o.k === 'level') return Math.min(o.n, s.player.level);
    return Math.min(o.n, st.p[i] || 0);
  };
  const checkQuests = () => {
    const s = get(); let changed = false; const quests = { ...s.quests };
    for (const id of Object.keys(quests)) {
      const st = quests[id]; if (st.s !== 'active') continue; const q = QUEST_BY_ID[id]; if (!q) continue;
      if (q.obj.every((o, i) => questTargetCount(q, i, st) >= o.n)) {
        quests[id] = { s: 'done', p: st.p }; changed = true;
        set((x) => ({ quests: { ...x.quests, [id]: { s: 'done', p: st.p } } }));
        get().addXp(q.reward.xp); get().addGold(q.reward.gold);
        if (q.reward.mats) for (const [m, n] of Object.entries(q.reward.mats)) get().addMat(m, n);
        if (q.reward.gear) { const it = genItem(get().player.level + 1, { rarity: q.reward.gear }); get().giveItem(it); }
        if (q.reward.unlock === 'tf2') { set((x) => ({ player: { ...x.player, tfStage: Math.max(2, x.player.tfStage) } })); pushToast('Transformation evolved: CRIMSON SOVEREIGN', '#ff4a60', '🔥'); }
        if (q.reward.unlock === 'tf3') { set((x) => ({ player: { ...x.player, tfStage: 3 } })); pushToast('Transformation evolved: VOID ASCENDANT', '#ffe9a0', '✨'); }
        pushToast(`Quest Complete: ${q.title}`, '#ffd24a', '✔');
        if (q.type === 'main') { set((x) => ({ progress: { ...x.progress, chapter: Math.max(x.progress.chapter, (q.chapter || 1) + (q.next ? (QUEST_BY_ID[q.next].chapter !== q.chapter ? 1 : 0) : 1)) } })); }
        if (q.next) { const nq = QUEST_BY_ID[q.next]; set((x) => ({ quests: { ...x.quests, [nq.id]: { s: 'active', p: nq.obj.map(() => 0) } }, tracked: nq.id })); pushToast(`New Quest: ${nq.title}`, '#7ad8ff', '❗'); }
        else if (get().tracked === id) set({ tracked: Object.keys(get().quests).find((k) => get().quests[k].s === 'active') || '' });
      }
    }
    if (changed) get().save();
  };

  return {
    ...base, screen: 'menu', paused: false, panel: null, panelData: null, hasSave: !!loaded && loaded.started, intro: false, ending: false,
    setScreen: (screen) => set({ screen }), setPaused: (paused) => set({ paused }),
    openPanel: (panel, panelData) => set({ panel, panelData }), closePanel: () => set({ panel: null, panelData: null }),
    setEnding: (ending) => set({ ending }), setIntro: (intro) => set({ intro }),
    newGame: () => { const f = freshSave(); f.started = true; f.settings = get().settings; set({ ...f, hasSave: true, intro: true, panel: null, paused: false }); get().save(); },
    continueGame: () => { const l = loadSave(); if (!l) return false; set({ ...l, hasSave: true }); return true; },
    save: () => {
      const s = get();
      const d: SaveData = { v: SAVE_VERSION, player: s.player, inventory: s.inventory, equipment: s.equipment, mats: s.mats, appearance: s.appearance, progress: s.progress, quests: s.quests, tracked: s.tracked, settings: s.settings, shop: s.shop, shopLvl: s.shopLvl, started: s.started, outfits: s.outfits };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { console.warn('save failed', e); }
    },
    wipe: () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } const f = freshSave(); set({ ...f, hasSave: false }); },
    addPlay: (dt) => set((s) => ({ progress: { ...s.progress, playTime: s.progress.playTime + dt } })),
    toast: pushToast,
    unlockAch: (id, name) => { if (get().progress.achievements.includes(id)) return; set((s) => ({ progress: { ...s.progress, achievements: [...s.progress.achievements, id] } })); pushToast(`Achievement: ${name}`, '#ffd24a', '🏆'); },
    addXp: (n) => {
      set((s) => {
        let { level, xp, attrPts, skillPts } = s.player; xp += Math.round(n); const ups: number[] = [];
        while (level < MAX_LEVEL && xp >= xpToNext(level)) { xp -= xpToNext(level); level++; attrPts += 2; skillPts += 1; ups.push(level); }
        if (level >= MAX_LEVEL) xp = 0;
        if (ups.length) setTimeout(() => { import('./hud').then((m) => m.useHud.getState().set({ levelUp: { lvl: level, t: Date.now() } })); pushToast(`LEVEL UP! Level ${level}`, '#ffe14a', '⬆'); import('./engine').then((m) => m.game?.onLevelUp()); if (level >= 10) get().unlockAch('lv10', 'Seasoned Awakened (Level 10)'); if (level >= 30) get().unlockAch('lv30', 'Abyss-Touched (Level 30)'); }, 0);
        return { player: { ...s.player, level, xp, attrPts, skillPts } };
      });
      checkQuests();
    },
    addGold: (n) => set((s) => ({ player: { ...s.player, gold: Math.max(0, s.player.gold + Math.round(n)) } })),
    addMat: (id, n) => { set((s) => ({ mats: { ...s.mats, [id]: Math.max(0, (s.mats[id] || 0) + n) } })); if (n > 0) checkQuests(); },
    useMat: (id, n) => { if ((get().mats[id] || 0) < n) return false; set((s) => ({ mats: { ...s.mats, [id]: s.mats[id] - n } })); return true; },
    giveItem: (it, silent) => {
      if (get().inventory.length >= 80) { pushToast('Inventory full!', '#ff5470'); return false; }
      set((s) => ({ inventory: [...s.inventory, it] }));
      if (!silent) pushToast(`${it.name}`, { common: '#ccc', uncommon: '#4ade80', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24', mythic: '#fb3b64' }[it.rarity], '🎁');
      if (RAR.indexOf(it.rarity) >= 4) get().unlockAch('legend', 'Legendary Find');
      return true;
    },
    equip: (id) => {
      const s = get(); const it = s.inventory.find((i) => i.id === id); if (!it) return;
      if (it.lvl > s.player.level) { pushToast(`Requires level ${it.lvl}`, '#ff5470'); return; }
      const old = s.equipment[it.slot];
      set({ inventory: [...s.inventory.filter((i) => i.id !== id), ...(old ? [old] : [])], equipment: { ...s.equipment, [it.slot]: it } });
      get().save();
    },
    unequip: (slot) => { const s = get(); const it = s.equipment[slot]; if (!it) return; if (slot === 'weapon') { pushToast('You need a weapon!', '#ff5470'); return; } if (s.inventory.length >= 80) return; const eq = { ...s.equipment }; delete eq[slot]; set({ equipment: eq, inventory: [...s.inventory, it] }); get().save(); },
    sell: (id) => { const s = get(); const it = s.inventory.find((i) => i.id === id); if (!it) return; set({ inventory: s.inventory.filter((i) => i.id !== id) }); get().addGold(sellValue(it)); get().save(); },
    upgrade: (id) => {
      const s = get(); let it = s.inventory.find((i) => i.id === id); let eqSlot: Slot | null = null;
      if (!it) { for (const [k, v] of Object.entries(s.equipment)) if (v && v.id === id) { it = v; eqSlot = k as Slot; } }
      if (!it) return; if (it.up >= 10) { pushToast('Max upgrade', '#ffd24a'); return; }
      const c = upgradeCost(it);
      if (s.player.gold < c.gold || (s.mats.iron_ore || 0) < c.ore || (c.rare && (s.mats[c.rare.id] || 0) < c.rare.n)) { pushToast('Not enough materials', '#ff5470'); return; }
      get().addGold(-c.gold); get().useMat('iron_ore', c.ore); if (c.rare) get().useMat(c.rare.id, c.rare.n);
      const nu = { ...it, up: it.up + 1 };
      if (eqSlot) set((x) => ({ equipment: { ...x.equipment, [eqSlot!]: nu } })); else set((x) => ({ inventory: x.inventory.map((i) => (i.id === id ? nu : i)) }));
      pushToast(`${it!.name} +${nu.up}`, '#ffd24a', '🔨'); get().save();
    },
    craft: (rid) => {
      const r = RECIPES.find((x) => x.id === rid); if (!r) return; const s = get();
      if (s.player.gold < r.gold || Object.entries(r.cost).some(([m, n]) => (s.mats[m] || 0) < n)) { pushToast('Missing materials or gold', '#ff5470'); return; }
      if (r.gear && s.inventory.length >= 80) return;
      get().addGold(-r.gold); for (const [m, n] of Object.entries(r.cost)) get().useMat(m, n);
      if (r.out) { get().addMat(r.out.mat, r.out.n); pushToast(`Crafted ${MATS[r.out.mat].name} x${r.out.n}`, '#7ad8ff', '⚒'); }
      if (r.gear) get().giveItem(genItem(s.player.level + 1, { slot: r.gear.slot, rarity: r.gear.rarity, wtype: r.gear.wtype }));
      get().save();
    },
    restock: () => { const lvl = get().player.level; const stock = Array.from({ length: 8 }, (_, i) => genItem(lvl, { rarity: i < 4 ? 'common' : i < 7 ? 'uncommon' : 'rare', slot: i === 0 ? 'weapon' : undefined })); set({ shop: stock, shopLvl: lvl }); },
    buy: (idx) => {
      const s = get(); const it = s.shop[idx]; if (!it) return; const price = Math.round(sellValue(it) * 3.2 + 30);
      if (s.player.gold < price) { pushToast('Not enough gold', '#ff5470'); return; }
      if (!get().giveItem(it)) return; get().addGold(-price); set((x) => ({ shop: x.shop.filter((_, i) => i !== idx) })); get().save();
    },
    spendSkill: (id) => {
      const s = get(); const r = s.player.skills[id] ?? 0;
      import('./data').then(({ SKILLS, skillNeedLevel }) => {
        const def = SKILLS.find((d) => d.id === id)!; if (r >= def.max) return;
        if (s.player.skillPts < 1) { pushToast('No skill points', '#ff5470'); return; }
        if (s.player.level < skillNeedLevel(def, r)) { pushToast(`Requires level ${skillNeedLevel(def, r)}`, '#ff5470'); return; }
        set((x) => ({ player: { ...x.player, skillPts: x.player.skillPts - 1, skills: { ...x.player.skills, [id]: r + 1 } } })); pushToast(`${def.name} → Rank ${r + 1}`, '#c084fc', '✦'); get().save();
      });
    },
    spendAttr: (k) => { const s = get(); if (s.player.attrPts < 1) return; set((x) => ({ player: { ...x.player, attrPts: x.player.attrPts - 1, attr: { ...x.player.attr, [k]: x.player.attr[k] + 1 } } })); get().save(); },
    setSettings: (p) => { set((s) => ({ settings: { ...s.settings, ...p } })); get().save(); import('./audio').then((m) => m.audio.applyVolumes()); import('./engine').then((m) => m.game?.applyQuality()); },
    setAppearance: (p) => { set((s) => ({ appearance: { ...s.appearance, ...p } })); get().save(); import('./engine').then((m) => m.game?.refreshLook()); },
    recordKill: (id) => { set((s) => ({ progress: { ...s.progress, kills: { ...s.progress.kills, [id]: (s.progress.kills[id] || 0) + 1 } } })); get().questEvent('kill', id, 1); if (get().progress.kills[id] === 1 && Object.keys(get().progress.kills).length === 1) get().unlockAch('first', 'First Blood'); },
    questEvent: (k, t, n = 1) => {
      const s = get(); const quests = { ...s.quests }; let ch = false;
      for (const id of Object.keys(quests)) {
        const st = quests[id]; if (st.s !== 'active') continue; const q = QUEST_BY_ID[id]; if (!q) continue; const p = [...st.p];
        q.obj.forEach((o, i) => { if (o.k === k && (o.t === t || o.t === '*' || (k === 'discover' && o.t === 'secret') || (k === 'chest' && o.t === 'chest'))) { p[i] = Math.min(o.n, (p[i] || 0) + n); ch = true; } });
        quests[id] = { s: 'active', p };
      }
      if (ch) { set({ quests }); }
      checkQuests();
    },
    acceptQuest: (id) => { const q = QUEST_BY_ID[id]; if (!q || get().quests[id]) return; set((s) => ({ quests: { ...s.quests, [id]: { s: 'active', p: q.obj.map(() => 0) } }, tracked: id })); pushToast(`Quest Accepted: ${q.title}`, '#7ad8ff', '❗'); checkQuests(); get().save(); },
    track: (id) => set({ tracked: id }),
    talkNpc: (id) => { get().questEvent('talk', id, 1); },
    completeDungeon: (id) => {
      set((s) => ({ progress: { ...s.progress, completed: { ...s.progress.completed, [id]: (s.progress.completed[id] || 0) + 1 } } }));
      get().questEvent('clear', id, 1);
      if (Object.keys(get().progress.completed).length >= 6) get().unlockAch('all', 'Master of Dungeons');
      get().save();
    },
  };
});

// auto-save throttle on state changes
let t: any = null;
useGame.subscribe(() => { if (t) return; t = setTimeout(() => { t = null; if (useGame.getState().started) useGame.getState().save(); }, 1500); });
export const rarityIdx = (r: Rarity) => RAR.indexOf(r);
export { QUESTS };
export type { Stats };
