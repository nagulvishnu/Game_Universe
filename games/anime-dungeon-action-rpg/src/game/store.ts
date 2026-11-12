import { create } from 'zustand';
import {
  ACHIEVEMENTS, EQUIP_KEYS, QUEST_TEMPLATES, REGIONS, RARITIES, SETS, SKILLS, WEAPONS, emptyStats, newId, regionOfFloor, rng, rollItem, rollRarity,
  starterItems, sellValue, buyValue, upgradeCost, upgradeMult, todayKey,
  type EquipKey, type Item, type RunStats, type Stats, type WeaponFamily, type Slot, type FloorSpec,
} from './data';

export const SAVE_KEY = 'toi_save_v1';
export const SCORE_KEY = 'toi_scores_v1';
export const SET_KEY = 'toi_settings_v1';
export const SAVE_VERSION = 1;
export const INV_CAP = 48;
export const VAULT_CAP = 60;

export interface Settings {
  master: number; music: number; sfx: number; shadows: number; particles: number; effects: number; res: number; view: number; sens: number; shake: number; touch: 'auto' | 'on' | 'off'; name: string; lockAssist: boolean;
}
export const isTouchDevice = () => typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.matchMedia?.('(pointer: coarse)').matches;
export const defaultSettings = (): Settings => {
  const m = isTouchDevice();
  return { master: 0.8, music: 0.55, sfx: 0.9, shadows: m ? 1 : 2, particles: m ? 0.55 : 1, effects: m ? 0 : 2, res: m ? 0.75 : 1, view: 1, sens: 1, shake: 1, touch: 'auto', name: 'Climber', lockAssist: true };
};
export interface Rec { time: number; rank: string; score: number; noHit?: boolean }
export interface Quest { id: string; text: string; stat: keyof RunStats; n: number; gold: number; base: number; claimed: boolean }
export interface SaveData {
  v: number; level: number; xp: number; sp: number; gold: number; essence: number;
  inv: Item[]; vault: Item[]; equip: Record<EquipKey, Item | null>;
  skills: Record<string, number>; slots: string[]; floor: number; highest: number;
  cleared: Record<number, Rec>; bosses: Record<number, { kills: number; best: number; noHit: boolean }>;
  ach: Record<string, boolean>; stats: RunStats; mastery: Record<string, number>; challenges: Record<string, boolean>;
  quests: { day: string; list: Quest[] }; ng: number; shop: Item[]; shopHi: number; secrets: Record<number, boolean>; ts: number; play: number;
}
export interface ScoreEntry { name: string; score: number; floor: number; mode: string; date: string; rank?: string }

const mkEquip = (): Record<EquipKey, Item | null> => ({ weapon: null, weapon2: null, helmet: null, armor: null, gloves: null, boots: null, ring: null, artifact: null });
export function newSave(): SaveData {
  const [a, b] = starterItems();
  const eq = mkEquip(); eq.weapon = a; eq.weapon2 = b;
  return {
    v: SAVE_VERSION, level: 1, xp: 0, sp: 2, gold: 120, essence: 5, inv: [], vault: [], equip: eq,
    skills: { wave: 1, fireball: 1, teleport: 1, beam: 1 }, slots: ['wave', 'fireball', 'teleport', 'beam'], floor: 1, highest: 1,
    cleared: {}, bosses: {}, ach: {}, stats: emptyStats(), mastery: {}, challenges: {}, quests: { day: '', list: [] }, ng: 0, shop: [], shopHi: -1, secrets: {}, ts: Date.now(), play: 0,
  };
}
function validate(raw: unknown): SaveData | null {
  try {
    const o = raw as SaveData;
    if (!o || typeof o !== 'object' || o.v !== SAVE_VERSION) return null;
    if (typeof o.level !== 'number' || !o.equip || !Array.isArray(o.inv) || !o.skills || !Array.isArray(o.slots)) return null;
    const base = newSave();
    const s = { ...base, ...o, stats: { ...base.stats, ...o.stats }, equip: { ...base.equip, ...o.equip } } as SaveData;
    if (!(s.level >= 1) || !(s.highest >= 1) || !(s.floor >= 1)) return null;
    s.slots = s.slots.slice(0, 4); while (s.slots.length < 4) s.slots.push('');
    return s;
  } catch { return null; }
}
export function readSave(): SaveData | null {
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (!t) return null;
    const s = validate(JSON.parse(t));
    if (!s) { localStorage.setItem(SAVE_KEY + '_corrupt', t); return null; }
    return s;
  } catch { return null; }
}
export const hasSave = () => !!readSave();
function loadSettings(): Settings {
  try { const t = localStorage.getItem(SET_KEY); if (t) return { ...defaultSettings(), ...JSON.parse(t) }; } catch { /* ignore */ }
  return defaultSettings();
}
function loadScores(): ScoreEntry[] {
  try { const t = localStorage.getItem(SCORE_KEY); if (t) { const a = JSON.parse(t); if (Array.isArray(a)) return a.filter((e) => typeof e?.score === 'number').slice(0, 10); } } catch { /* ignore */ }
  return [];
}

// ----- derived stats -----
export const xpNeed = (lv: number) => Math.round(40 + 22 * Math.pow(lv, 1.35));
export function masteryLevel(xp: number) { return Math.min(10, Math.floor(Math.sqrt((xp || 0) / 12))); }
export interface Derived extends Stats { sets: { name: string; count: number; lines: string[] }[]; weapon: Item | null; family: WeaponFamily; atkBase: number }
export function computeStats(s: SaveData): Derived {
  const L = s.level;
  const t: Stats = { atk: 12 + 2.2 * (L - 1), def: 4 + 1.1 * (L - 1), hp: 120 + 14 * (L - 1), crit: 5, critDmg: 150, stamina: 100 + 1.2 * (L - 1), mana: 80 + 3 * (L - 1) };
  const counts: Record<string, number> = {};
  for (const k of EQUIP_KEYS) {
    if (k === 'weapon2') continue;
    const it = s.equip[k]; if (!it) continue;
    const m = upgradeMult(it);
    for (const [st, v] of Object.entries(it.stats)) t[st as keyof Stats] += (v as number) * m;
    if (it.set) counts[it.set] = (counts[it.set] || 0) + 1;
  }
  const sets: Derived['sets'] = [];
  for (const [id, c] of Object.entries(counts)) {
    const def = SETS.find((x) => x.id === id)!; const lines: string[] = [];
    const apply = (b: Partial<Stats>) => { for (const [st, v] of Object.entries(b)) { if (st === 'crit') t.crit += (v as number) * 100 * 0.2; else if (st === 'critDmg') t.critDmg += (v as number) * 100; else t[st as keyof Stats] *= 1 + (v as number); } };
    if (c >= 2) { apply(def.b2); lines.push(`(2) ${def.d2}`); }
    if (c >= 4) { apply(def.b4); lines.push(`(4) ${def.d4}`); }
    sets.push({ name: def.name, count: c, lines });
  }
  const weapon = s.equip.weapon;
  const family = (weapon?.family || 'katana') as WeaponFamily;
  const ml = masteryLevel(s.mastery[family] || 0);
  t.atk *= 1 + 0.02 * ml;
  return { ...t, atk: Math.round(t.atk), def: Math.round(t.def), hp: Math.round(t.hp), stamina: Math.round(t.stamina), mana: Math.round(t.mana), crit: Math.round(t.crit * 10) / 10, critDmg: Math.round(t.critDmg), sets, weapon, family, atkBase: t.atk };
}

// ----- UI store -----
export interface Banner { title: string; sub?: string; color?: string; big?: boolean; id: number }
export interface ResultData { spec: FloorSpec; time: number; score: number; rank: string; kills: number; perfect: number; damage: number; maxCombo: number; noHit: boolean; first: boolean; loot: Item[]; gold: number; xp: number; mode: string; wave?: number; record?: boolean }
export interface GameOverData { score: number; floor: number; mode: string; wave?: number; place: number; spec: FloorSpec; won?: boolean }
export type Panel = null | 'portal' | 'blacksmith' | 'merchant' | 'vault' | 'trainer' | 'quests' | 'achievements' | 'trophies' | 'menu';
export type Tab = 'inventory' | 'character' | 'skills' | 'map';
interface UI {
  save: SaveData; settings: Settings; scores: ScoreEntry[]; rev: number;
  scene: 'title' | 'hub' | 'floor'; overlay: null | 'floorselect' | 'settings' | 'scores' | 'exit' | 'help';
  panel: Panel; tab: Tab; paused: boolean; results: ResultData | null; gameover: GameOverData | null; banners: Banner[];
  toasts: { id: number; text: string; color: string }[]; hasSave: boolean; loading: boolean; touch: boolean; training: boolean;
}
export const useStore = create<UI>(() => ({
  save: newSave(), settings: loadSettings(), scores: loadScores(), rev: 0, scene: 'title', overlay: null, panel: null, tab: 'inventory', paused: false,
  results: null, gameover: null, banners: [], toasts: [], hasSave: hasSave(), loading: false, touch: false, training: false,
}));
const st = () => useStore.getState();
const set = (p: Partial<UI>) => useStore.setState(p);
let tid = 1;
export function toast(text: string, color = '#fff') {
  const id = tid++;
  set({ toasts: [...st().toasts.slice(-4), { id, text, color }] });
  setTimeout(() => set({ toasts: st().toasts.filter((t) => t.id !== id) }), 3200);
}
let bid = 1;
export function banner(title: string, sub?: string, color?: string, big?: boolean, ms = 2600) {
  const id = bid++;
  set({ banners: [...st().banners.slice(-1), { title, sub, color, big, id }] });
  setTimeout(() => set({ banners: st().banners.filter((b) => b.id !== id) }), ms);
}
export function persist() {
  try {
    const s = st().save; s.ts = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(s)); set({ hasSave: true });
  } catch { /* storage unavailable */ }
}
function mutate(fn: (s: SaveData) => void, save = true) {
  const s = { ...st().save }; fn(s);
  set({ save: s, rev: st().rev + 1 });
  if (save) persist();
}
export function setSettings(p: Partial<Settings>) {
  const n = { ...st().settings, ...p }; set({ settings: n });
  try { localStorage.setItem(SET_KEY, JSON.stringify(n)); } catch { /* ignore */ }
}

// ----- save actions -----
export function startNewGame() { const s = newSave(); set({ save: s, rev: st().rev + 1 }); ensureQuests(); persist(); }
export function loadGame(): boolean {
  const s = readSave(); if (!s) return false;
  set({ save: s, rev: st().rev + 1 }); ensureQuests(); return true;
}
export function startNgPlus() { mutate((s) => { s.ng++; s.cleared = {}; s.highest = 1; s.floor = 1; s.bosses = { ...s.bosses }; }); toast(`New Game+ ${st().save.ng} begins — enemies are stronger!`, '#ffd860'); }
export function setFloor(n: number) { mutate((s) => { s.floor = n; }, false); }
export function addGold(n: number) { mutate((s) => { s.gold += n; }, false); }
export function addEssence(n: number) { mutate((s) => { s.essence += n; }, false); }
export function gainXp(n: number): number {
  let gained = 0;
  mutate((s) => {
    s.xp += n;
    while (s.level < 100 && s.xp >= xpNeed(s.level)) { s.xp -= xpNeed(s.level); s.level++; s.sp += 1; gained++; }
  }, false);
  return gained;
}
export function addItem(it: Item): boolean {
  if (st().save.inv.length >= INV_CAP) return false;
  mutate((s) => { s.inv = [...s.inv, it]; if (RARITIES.indexOf(it.rarity) >= 4) s.stats = { ...s.stats, legendary: s.stats.legendary + 1 }; }, false);
  return true;
}
export function equipItem(id: string, alt = false) {
  mutate((s) => {
    const it = s.inv.find((i) => i.id === id); if (!it) return;
    const key: EquipKey = it.slot === 'weapon' && alt ? 'weapon2' : it.slot;
    const old = s.equip[key];
    s.inv = s.inv.filter((i) => i.id !== id); if (old) s.inv.push(old);
    s.equip = { ...s.equip, [key]: it };
  });
}
export function unequip(key: EquipKey) {
  mutate((s) => { const it = s.equip[key]; if (!it || s.inv.length >= INV_CAP) return; s.equip = { ...s.equip, [key]: null }; s.inv = [...s.inv, it]; });
}
export function swapWeapons() { mutate((s) => { s.equip = { ...s.equip, weapon: s.equip.weapon2, weapon2: s.equip.weapon }; }, false); }
export function sellItem(id: string) {
  mutate((s) => { const it = s.inv.find((i) => i.id === id); if (!it) return; s.gold += sellValue(it); s.inv = s.inv.filter((i) => i.id !== id); });
}
export function salvageItem(id: string) {
  mutate((s) => { const it = s.inv.find((i) => i.id === id); if (!it) return; s.essence += 1 + RARITIES.indexOf(it.rarity) * 2 + it.upg; s.gold += Math.round(sellValue(it) * 0.3); s.inv = s.inv.filter((i) => i.id !== id); });
}
export function upgradeEquipped(where: 'inv' | EquipKey, id: string): boolean {
  let ok = false;
  mutate((s) => {
    const it = where === 'inv' ? s.inv.find((i) => i.id === id) : s.equip[where];
    if (!it || it.upg >= 10) return;
    const c = upgradeCost(it);
    if (s.gold < c.gold || s.essence < c.ess) return;
    s.gold -= c.gold; s.essence -= c.ess;
    const n = { ...it, upg: it.upg + 1 };
    if (where === 'inv') s.inv = s.inv.map((i) => (i.id === id ? n : i)); else s.equip = { ...s.equip, [where]: n };
    ok = true;
  });
  return ok;
}
export function refreshShop(force = false): void {
  const s = st().save; const hi = Math.min(100, s.highest);
  if (!force && s.shopHi === hi && s.shop.length) return;
  if (force && s.gold < 80) { toast('Not enough gold (80)', '#f66'); return; }
  const r = rng((Date.now() / 1000) | 0);
  mutate((x) => {
    if (force) x.gold -= 80;
    const reg = regionOfFloor(hi);
    x.shop = Array.from({ length: 8 }, (_, i) => rollItem(Math.max(1, hi - 1 + (i % 3)), { r, region: reg, min: i > 5 ? 'rare' : 'common', luck: 0.1 }));
    x.shopHi = hi;
  });
}
export function buyItem(id: string) {
  const s = st().save, it = s.shop.find((i) => i.id === id);
  if (!it) return;
  if (s.gold < buyValue(it)) { toast('Not enough gold', '#f66'); return; }
  if (s.inv.length >= INV_CAP) { toast('Inventory full', '#f66'); return; }
  mutate((x) => { x.gold -= buyValue(it); x.shop = x.shop.filter((i) => i.id !== id); x.inv = [...x.inv, it]; });
  toast(`Purchased ${it.name}`, '#ffd860');
}
export function toVault(id: string) { mutate((s) => { const it = s.inv.find((i) => i.id === id); if (!it || s.vault.length >= VAULT_CAP) return; s.inv = s.inv.filter((i) => i.id !== id); s.vault = [...s.vault, it]; }); }
export function fromVault(id: string) { mutate((s) => { const it = s.vault.find((i) => i.id === id); if (!it || s.inv.length >= INV_CAP) return; s.vault = s.vault.filter((i) => i.id !== id); s.inv = [...s.inv, it]; }); }
export const skillCost = (lv: number) => (lv === 0 ? 1 : lv + 1);
export function learnSkill(id: string): boolean {
  const s = st().save, lv = s.skills[id] || 0;
  if (lv >= 5) return false; const c = skillCost(lv);
  if (s.sp < c) { toast('Not enough skill points', '#f66'); return false; }
  mutate((x) => { x.sp -= c; x.skills = { ...x.skills, [id]: lv + 1 }; if (lv === 0 && !x.slots.includes(id)) { const e = x.slots.indexOf(''); if (e >= 0) x.slots = x.slots.map((q, i) => (i === e ? id : q)); } });
  return true;
}
export function setSkillSlot(i: number, id: string) {
  mutate((s) => { const a = [...s.slots]; const j = a.indexOf(id); if (j >= 0) a[j] = a[i]; a[i] = id; s.slots = a; });
}
export function respec() {
  const s = st().save; if (s.gold < 200) { toast('Respec costs 200 gold', '#f66'); return; }
  mutate((x) => { let refund = 0; for (const [id, lv] of Object.entries(x.skills)) { for (let l = 0; l < lv; l++) refund += skillCost(l); void id; } x.sp += refund - 4; x.gold -= 200; x.skills = { wave: 1, fireball: 1, teleport: 1, beam: 1 }; x.slots = ['wave', 'fireball', 'teleport', 'beam']; });
}
export function ensureQuests() {
  const s = st().save, day = todayKey();
  if (s.quests.day === day && s.quests.list.length) return;
  const r = rng(Array.from(day).reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const pool = [...QUEST_TEMPLATES].sort(() => r() - 0.5).slice(0, 3);
  const scale = 1 + Math.min(s.highest, 100) / 25;
  mutate((x) => {
    x.quests = { day, list: pool.map((q) => { const n = Math.round(q.base * scale * (0.8 + r() * 0.5)); return { id: q.id, text: q.text.replace('{n}', String(n)), stat: q.stat, n, gold: Math.round(q.gold * scale), base: x.stats[q.stat], claimed: false }; }) };
  });
}
export function claimQuest(i: number) {
  const s = st().save, q = s.quests.list[i];
  if (!q || q.claimed || s.stats[q.stat] - q.base < q.n) return;
  mutate((x) => { const l = x.quests.list.map((z, j) => (j === i ? { ...z, claimed: true } : z)); x.quests = { ...x.quests, list: l }; x.gold += q.gold; x.essence += 3; });
  toast(`Quest complete! +${q.gold} gold, +3 essence`, '#ffd860');
}
export function checkAchievements() {
  const s = st().save, fresh = ACHIEVEMENTS.filter((a) => !s.ach[a.id] && a.test(s.stats, s.highest, s.level));
  if (!fresh.length) return;
  mutate((x) => { x.ach = { ...x.ach }; for (const a of fresh) { x.ach[a.id] = true; x.gold += a.gold; } });
  for (const a of fresh) toast(`🏅 Achievement: ${a.name} (+${a.gold}g)`, '#ffd860');
}
export function bumpStat(k: keyof RunStats, n = 1, max = false) {
  const s = st().save; const cur = s.stats[k];
  const v = max ? Math.max(cur, n) : cur + n; if (v === cur) return;
  s.stats = { ...s.stats, [k]: v }; set({ save: { ...s } });
}
export function addMastery(f: WeaponFamily, n: number) { const s = st().save; s.mastery = { ...s.mastery, [f]: (s.mastery[f] || 0) + n }; }
export function recordFloor(n: number, rec: Rec) {
  mutate((s) => {
    const o = s.cleared[n];
    const better = !o || rec.score > o.score;
    s.cleared = { ...s.cleared, [n]: better ? { ...rec, time: o ? Math.min(o.time, rec.time) : rec.time, noHit: rec.noHit || o?.noHit } : { ...o, time: Math.min(o.time, rec.time), noHit: rec.noHit || o.noHit } };
    if (n >= s.highest && n < 100) s.highest = n + 1; else if (n >= 100) s.highest = Math.max(s.highest, 100);
    s.stats = { ...s.stats, floors: s.stats.floors + 1 };
  });
}
export function recordBoss(i: number, time: number, noHit: boolean) {
  mutate((s) => {
    const o = s.bosses[i];
    s.bosses = { ...s.bosses, [i]: { kills: (o?.kills || 0) + 1, best: o ? Math.min(o.best, time) : time, noHit: noHit || !!o?.noHit } };
    s.stats = { ...s.stats, bosses: Object.keys(s.bosses).length, noHitBoss: s.stats.noHitBoss + (noHit ? 1 : 0) };
  });
}
export function addScore(score: number, floor: number, mode: string, rank?: string): number {
  const e: ScoreEntry = { name: st().settings.name || 'Climber', score: Math.round(score), floor, mode, date: new Date().toLocaleDateString(), rank };
  const list = [...st().scores, e].sort((a, b) => b.score - a.score).slice(0, 10);
  const place = list.indexOf(e);
  set({ scores: list });
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return place;
}
export function clearScores() { set({ scores: [] }); try { localStorage.removeItem(SCORE_KEY); } catch { /* ignore */ } }

export { REGIONS, WEAPONS, SKILLS, rollRarity, newId };
export type { Slot };

// ----- tiny HUD store (updated ~15Hz by the engine) -----
export interface Hud {
  hp: number; maxHp: number; sta: number; maxSta: number; mp: number; maxMp: number; xp: number; xpNeed: number; level: number; ult: number; awk: number; awakened: boolean;
  floor: number; region: string; floorName: string; type: string; obj: string; objP: number; objG: number; time: number; timeLeft: number;
  boss: null | { name: string; hp: number; max: number; phase: number; posture: number; stunned: boolean; atk: string };
  target: null | { name: string; hp: number; max: number; elite: boolean };
  combo: number; comboT: number; score: number; mult: number; cds: number[]; sel: number; lock: boolean; prompt: string; gold: number; fps: number;
  barrier: number; wave: string; counterReady: boolean; family: string; training: null | { perfect: number; dmg: number; combo: number }; callout: null | { id: number; text: string; color: string }; cine: boolean;
}
export const useHud = create<Hud>(() => ({
  hp: 100, maxHp: 100, sta: 100, maxSta: 100, mp: 80, maxMp: 80, xp: 0, xpNeed: 100, level: 1, ult: 0, awk: 0, awakened: false, floor: 1, region: '', floorName: '', type: '', obj: '', objP: 0, objG: 0,
  time: 0, timeLeft: 0, boss: null, target: null, combo: 0, comboT: 0, score: 0, mult: 1, cds: [0, 0, 0, 0], sel: 0, lock: false, prompt: '', gold: 0, fps: 60, barrier: 0, wave: '', counterReady: false, family: 'katana', training: null, callout: null, cine: false,
}));
