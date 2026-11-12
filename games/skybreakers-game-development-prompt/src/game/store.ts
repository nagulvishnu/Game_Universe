import { create } from 'zustand';
import { ARMORS, BUILDINGS, CAPPED, ITEMS, KINGDOM_UPGRADES, QUESTS, RECIPES, SHIPS, SHIP_REQ, SHIP_UPGRADES, WEAPONS, xpForLevel, type QuestDef } from './data';

export interface BuildingInst { uid: number; type: string; x: number; z: number; rot: number; level: number; progress: number; hp: number; workers: number }
export interface ShipInst { hull: number; fuel: number; upgrades: Record<string, number>; hullColor: string; sailColor: string; trimColor: string; decor: string[]; style: string }
export interface QuestState { state: 'active' | 'ready' | 'done'; prog: number[] }
export interface Settings { master: number; music: number; sfx: number; quality: 'low' | 'medium' | 'high'; sens: number; shake: boolean; invertY: boolean }
export interface Toast { id: number; msg: string; kind: 'info' | 'good' | 'bad' | 'quest' | 'loot'; t: number }
export type Panel = null | 'menu' | 'pause' | 'settings' | 'trade' | 'workshop' | 'dialogue' | 'collection' | 'ending';
export type Tab = 'inventory' | 'craft' | 'journal' | 'skills' | 'kingdom';

export interface Progress {
  level: number; xp: number; skillPts: number; skills: Record<string, number>;
  inv: Record<string, number>; weapons: string[]; weapon: string; mastery: Record<string, number>; armor: string; armors: string[];
  ships: Record<string, ShipInst>; activeShip: string; shipPos: [number, number, number]; shipYaw: number; repaired: boolean;
  quests: Record<string, QuestState>; tracked: string | null;
  kingdom: { buildings: BuildingInst[]; workers: number; research: number; upgrades: string[]; nextUid: number; castleHp: number };
  bosses: string[]; chests: string[]; discovered: string[]; reached: string[]; flags: Record<string, boolean>;
  pos: [number, number, number]; dayTime: number; playTime: number; kills: number;
}

export const defaultShip = (hull: number): ShipInst => ({ hull, fuel: 100, upgrades: {}, hullColor: '#8a5a34', sailColor: '#f3ecd8', trimColor: '#d4a537', decor: [], style: 'balloon' });
export const newProgress = (): Progress => ({
  level: 1, xp: 0, skillPts: 0, skills: { health: 0, stamina: 0, magic: 0, combat: 0, spell: 0 },
  inv: { gold: 30, hp_potion: 2, mp_potion: 1, food: 3 }, weapons: ['sword', 'bow'], weapon: 'sword', mastery: {}, armor: 'cloth', armors: ['cloth'],
  ships: { scout: defaultShip(50) }, activeShip: 'scout', shipPos: [66, 1, 18], shipYaw: Math.PI * 0.5, repaired: false,
  quests: {}, tracked: null,
  kingdom: { buildings: [], workers: 0, research: 0, upgrades: [], nextUid: 1, castleHp: 400 },
  bosses: [], chests: [], discovered: ['verdant'], reached: [], flags: {},
  pos: [0, 5, 14], dayTime: 0.3, playTime: 0, kills: 0,
});
export const defaultSettings = (): Settings => ({ master: 0.8, music: 0.5, sfx: 0.8, quality: 'medium', sens: 1, shake: true, invertY: false });

const SAVE_KEY = 'skybreakers_save_v1';
const SET_KEY = 'skybreakers_settings_v1';
const loadSettings = (): Settings => { try { return { ...defaultSettings(), ...JSON.parse(localStorage.getItem(SET_KEY) || '{}') }; } catch { return defaultSettings(); } };
export const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };

// ───── derived stats ─────
export const maxHp = (p: Progress) => 100 + 20 * p.skills.health + 10 * (p.level - 1);
export const maxSp = (p: Progress) => 100 + 12 * p.skills.stamina;
export const maxMp = (p: Progress) => 60 + 12 * p.skills.magic + 5 * (p.level - 1);
export const dmgMul = (p: Progress) => 1 + 0.08 * p.skills.combat + 0.02 * (p.level - 1);
export const spellMul = (p: Progress) => 1 + 0.12 * p.skills.spell + 0.02 * (p.level - 1);
export const masteryLevel = (p: Progress, w: string) => Math.min(10, Math.floor(Math.sqrt((p.mastery[w] || 0) / 4)));
export const shipStats = (p: Progress, id = p.activeShip) => {
  const d = SHIPS[id]; const s = p.ships[id] || defaultShip(d.hull); const u = (k: string) => s.upgrades[k] || 0;
  return {
    def: d, inst: s, speed: d.speed * (1 + 0.08 * u('speed')), accel: d.accel * (1 + 0.1 * u('engine')), turn: d.turn * (1 + 0.12 * u('stability')), drift: 1 - 0.07 * u('stability'),
    maxHull: d.hull * (1 + 0.2 * u('armor')), maxFuel: d.fuel, dmgMul: (1 + 0.15 * u('weapons')) * (id === 'titan' ? 2 : 1), cargo: d.cargo + 25 * u('cargo'), fuelEff: 1 - 0.08 * u('engine'),
  };
};
export const capOf = (p: Progress, id: string) => {
  if (!CAPPED.includes(id)) return 99999;
  const st = shipStats(p);
  let c = 40 + st.cargo;
  for (const b of p.kingdom.buildings) if (b.type === 'storage' && b.progress >= 1) c += 40 * b.level;
  if (p.kingdom.upgrades.includes('vault')) c += 60;
  return c;
};
export const buildingBuilt = (p: Progress, type: string) => p.kingdom.buildings.some(b => b.type === type && b.progress >= 1);
export const buildCost = (type: string, level: number) => { const base = BUILDINGS[type].cost; const m = Math.pow(1.9, level - 1); const o: Record<string, number> = {}; for (const k in base) o[k] = Math.ceil(base[k] * m); return o; };

let toastId = 1;
interface Store extends Progress {
  screen: 'intro' | 'menu' | 'play'; panel: Panel; tab: Tab; dialogNpc: string | null; settings: Settings; toasts: Toast[]; placing: string | null; saveExists: boolean; banner: { text: string; sub: string; t: number } | null;
  setScreen: (s: 'intro' | 'menu' | 'play') => void; openPanel: (p: Panel, tab?: Tab) => void; closePanel: () => void;
  toast: (msg: string, kind?: Toast['kind']) => void; setBanner: (text: string, sub?: string) => void;
  setSettings: (s: Partial<Settings>) => void; set_: (p: Partial<Store>) => void;
  addItem: (id: string, n: number, force?: boolean) => number; removeItem: (id: string, n: number) => boolean; has: (cost: Record<string, number>) => boolean; spend: (cost: Record<string, number>) => boolean;
  craft: (id: string) => boolean; useItem: (id: string) => boolean; sell: (id: string, n: number) => void; buy: (id: string, n: number) => void;
  equipWeapon: (id: string) => void; equipArmor: (id: string) => void; gainXp: (n: number) => void; spendSkill: (k: string) => void; addMastery: (w: string, n: number) => void;
  acceptQuest: (id: string) => void; emitQ: (key: string, n?: number) => void; turnIn: (id: string) => void; refreshHave: () => void; questAvailable: (q: QuestDef) => boolean; trackQuest: (id: string | null) => void;
  placeBuilding: (type: string, x: number, z: number, rot: number) => boolean; upgradeBuilding: (uid: number) => boolean; recruit: () => boolean; assign: (uid: number, d: number) => void; unlockUpgrade: (id: string) => boolean;
  buyShip: (id: string) => boolean; selectShip: (id: string) => void; upgradeShip: (u: string) => boolean; paintShip: (patch: Partial<ShipInst>) => void; toggleDecor: (id: string) => boolean;
  save: () => void; load: () => boolean; newGame: () => void; discover: (id: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  ...newProgress(), screen: 'intro', panel: null, tab: 'inventory', dialogNpc: null, settings: loadSettings(), toasts: [], placing: null, saveExists: hasSave(), banner: null,
  setScreen: screen => set({ screen }),
  openPanel: (panel, tab) => set(s => ({ panel, tab: tab || s.tab })),
  closePanel: () => set({ panel: null, dialogNpc: null }),
  toast: (msg, kind = 'info') => set(s => ({ toasts: [...s.toasts.filter(t => performance.now() - t.t < 5000).slice(-5), { id: toastId++, msg, kind, t: performance.now() }] })),
  setBanner: (text, sub = '') => { set({ banner: { text, sub, t: performance.now() } }); },
  setSettings: p => set(s => { const settings = { ...s.settings, ...p }; try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch { /* */ } return { settings }; }),
  set_: p => set(p),

  addItem: (id, n, force) => {
    const s = get(); const cur = s.inv[id] || 0; const cap = capOf(s, id);
    const add = force ? n : Math.max(0, Math.min(n, cap - cur));
    if (add <= 0) { if (n > 0) get().toast(`${ITEMS[id]?.name || id}: cargo full!`, 'bad'); return 0; }
    set({ inv: { ...s.inv, [id]: cur + add } });
    get().refreshHave();
    return add;
  },
  removeItem: (id, n) => { const s = get(); if ((s.inv[id] || 0) < n) return false; set({ inv: { ...s.inv, [id]: s.inv[id] - n } }); return true; },
  has: cost => { const inv = get().inv; return Object.keys(cost).every(k => (inv[k] || 0) >= cost[k]); },
  spend: cost => { if (!get().has(cost)) return false; const inv = { ...get().inv }; for (const k in cost) inv[k] -= cost[k]; set({ inv }); return true; },
  craft: id => {
    const r = RECIPES.find(x => x.id === id); const s = get(); if (!r) return false;
    if ((r.level || 1) > s.level) { s.toast(`Requires level ${r.level}`, 'bad'); return false; }
    if (r.station && !buildingBuilt(s, r.station)) { s.toast(`Requires a ${BUILDINGS[r.station].name} in your kingdom`, 'bad'); return false; }
    if (!s.has(r.cost)) { s.toast('Missing materials', 'bad'); return false; }
    if (id.startsWith('w:') && s.weapons.includes(id.slice(2))) { s.toast('Already owned', 'info'); return false; }
    if (id.startsWith('a:') && s.armors.includes(id.slice(2))) { s.toast('Already owned', 'info'); return false; }
    const out = r.id; const base = id.includes(':') ? 0 : r.qty;
    if (base && (s.inv[out] || 0) + base > capOf(s, out)) { s.toast('Cargo full!', 'bad'); return false; }
    s.spend(r.cost);
    if (id.startsWith('w:')) { const w = id.slice(2); set(st => ({ weapons: [...st.weapons, w] })); s.toast(`Crafted ${WEAPONS[w].name}!`, 'good'); }
    else if (id.startsWith('a:')) { const a = id.slice(2); set(st => ({ armors: [...st.armors, a], armor: a })); s.toast(`Crafted & equipped ${ARMORS[a].name}!`, 'good'); }
    else { s.addItem(out, r.qty, true); s.toast(`Crafted ${r.qty}× ${ITEMS[out].name}`, 'good'); }
    get().emitQ('craft:' + id); get().refreshHave();
    return true;
  },
  useItem: id => {
    const s = get(); if ((s.inv[id] || 0) < 1) return false; return !!(window as any).__useItem?.(id);
  },
  sell: (id, n) => { const s = get(); const have = s.inv[id] || 0; n = Math.min(n, have); if (n <= 0 || ITEMS[id].value <= 0) return; const price = Math.max(1, Math.floor(ITEMS[id].value * 0.6)); set({ inv: { ...s.inv, [id]: have - n, gold: (s.inv.gold || 0) + price * n } }); },
  buy: (id, n) => { const s = get(); const price = Math.ceil(ITEMS[id].value * 1.5) * n; if ((s.inv.gold || 0) < price) { s.toast('Not enough gold', 'bad'); return; } if (get().addItem(id, n) > 0) set(st => ({ inv: { ...st.inv, gold: st.inv.gold - price } })); },
  equipWeapon: id => { if (get().weapons.includes(id)) set({ weapon: id }); },
  equipArmor: id => { if (get().armors.includes(id)) set({ armor: id }); },
  addMastery: (w, n) => { const s = get(); const before = masteryLevel(s, w); set({ mastery: { ...s.mastery, [w]: (s.mastery[w] || 0) + n } }); const after = masteryLevel(get(), w); if (after > before) get().toast(`${WEAPONS[w].name} mastery ${after}! (+${after * 4}% damage)`, 'good'); },
  gainXp: n => {
    let { xp, level, skillPts } = get(); xp += n; let up = 0;
    while (xp >= xpForLevel(level + 1)) { xp -= xpForLevel(level + 1); level++; skillPts++; up++; }
    set({ xp, level, skillPts });
    if (up) { get().setBanner('LEVEL UP', `Level ${level} — +${up} skill point`); get().toast(`Level ${level}! Skill points available (P)`, 'good'); (window as any).__levelUp?.(); }
  },
  spendSkill: k => { const s = get(); if (s.skillPts < 1 || s.skills[k] >= 10) return; set({ skillPts: s.skillPts - 1, skills: { ...s.skills, [k]: s.skills[k] + 1 } }); },

  questAvailable: q => { const s = get(); return !s.quests[q.id] && s.level >= q.level && q.requires.every(r => s.quests[r]?.state === 'done'); },
  trackQuest: id => set({ tracked: id }),
  acceptQuest: id => {
    const q = QUESTS.find(x => x.id === id)!; const s = get(); if (s.quests[id]) return;
    const quests = { ...s.quests, [id]: { state: 'active' as const, prog: q.objs.map(() => 0) } };
    set({ quests, tracked: s.tracked && s.quests[s.tracked]?.state === 'active' ? s.tracked : id });
    if (q.onAccept) set(st => ({ flags: { ...st.flags, [q.onAccept!]: true } }));
    s.toast(`Quest accepted: ${q.title}`, 'quest'); get().refreshHave();
    // objectives already satisfied by previously reached places
    for (const o of q.objs) if (o.key.startsWith('reach:') && get().reached.includes(o.key.slice(6))) get().emitQ(o.key);
  },
  refreshHave: () => {
    const s = get(); let changed = false; const quests = { ...s.quests };
    for (const q of QUESTS) { const st = quests[q.id]; if (!st || st.state !== 'active') continue; let prog = st.prog;
      q.objs.forEach((o, i) => { if (o.key.startsWith('have:')) { const v = Math.min(o.n, Math.max(prog[i], s.inv[o.key.slice(5)] || 0)); if (v !== prog[i]) { if (prog === st.prog) prog = [...prog]; prog[i] = v; } } });
      if (prog !== st.prog) { quests[q.id] = { ...st, prog }; changed = true; } }
    if (changed) { set({ quests }); QUESTS.forEach(q => checkDone(q.id)); }
  },
  emitQ: (key, n = 1) => {
    const s = get(); let changed = false; const quests = { ...s.quests };
    for (const q of QUESTS) { const st = quests[q.id]; if (!st || st.state !== 'active') continue; let prog = st.prog;
      q.objs.forEach((o, i) => { if (o.key === key && prog[i] < o.n) { if (prog === st.prog) prog = [...prog]; prog[i] = Math.min(o.n, prog[i] + n); } });
      if (prog !== st.prog) { quests[q.id] = { ...st, prog }; changed = true; } }
    if (changed) { set({ quests }); QUESTS.forEach(q => checkDone(q.id)); }
  },
  turnIn: id => {
    const q = QUESTS.find(x => x.id === id)!; const s = get(); if (s.quests[id]?.state !== 'ready') return;
    set({ quests: { ...s.quests, [id]: { ...s.quests[id], state: 'done' } } });
    for (const [it, n] of q.rewards) get().addItem(it, n, true);
    get().gainXp(q.xp); get().toast(`Quest complete: ${q.title}  (+${q.xp} XP)`, 'quest');
    const st = get(); if (st.tracked === id) { const next = QUESTS.find(x => st.quests[x.id]?.state === 'active'); set({ tracked: next ? next.id : null }); }
    if (id === 'main_9') { set(x => ({ flags: { ...x.flags, ending: true } })); setTimeout(() => get().openPanel('ending'), 1500); }
    get().save();
  },

  placeBuilding: (type, x, z, rot) => {
    const s = get(); const def = BUILDINGS[type]; const k = s.kingdom;
    if (type !== 'castle' && !k.buildings.some(b => b.type === 'castle')) { s.toast('Build the Main Castle first!', 'bad'); return false; }
    if (['castle', 'barracks', 'research', 'blacksmith', 'workshop'].includes(type) && k.buildings.some(b => b.type === type) && type === 'castle') { s.toast('Only one castle allowed', 'bad'); return false; }
    if (!s.spend(def.cost)) { s.toast('Not enough materials', 'bad'); return false; }
    const b: BuildingInst = { uid: k.nextUid, type, x, z, rot, level: 1, progress: 0, hp: def.hp, workers: 0 };
    set({ kingdom: { ...k, buildings: [...k.buildings, b], nextUid: k.nextUid + 1 } });
    s.toast(`${def.name} construction started`, 'good'); return true;
  },
  upgradeBuilding: uid => {
    const s = get(); const b = s.kingdom.buildings.find(x => x.uid === uid); if (!b || b.progress < 1) return false;
    if (b.level >= 3) { s.toast('Max level', 'info'); return false; }
    const castle = s.kingdom.buildings.find(x => x.type === 'castle'); if (b.type !== 'castle' && castle && b.level >= castle.level + 1) { s.toast('Upgrade the Castle first', 'bad'); return false; }
    if (!s.spend(buildCost(b.type, b.level + 1))) { s.toast('Not enough materials', 'bad'); return false; }
    set({ kingdom: { ...s.kingdom, buildings: s.kingdom.buildings.map(x => x.uid === uid ? { ...x, level: x.level + 1, progress: 0.0001, hp: BUILDINGS[x.type].hp * (x.level + 1) } : x) } });
    s.toast(`Upgrading ${BUILDINGS[b.type].name}...`, 'good'); return true;
  },
  recruit: () => {
    const s = get(); const castle = s.kingdom.buildings.find(b => b.type === 'castle' && b.progress >= 1); if (!castle) { s.toast('Build the castle first', 'bad'); return false; }
    const cap = 2 + castle.level * 3; if (s.kingdom.workers >= cap) { s.toast(`Worker limit reached (${cap}) — upgrade the castle`, 'bad'); return false; }
    if (!s.spend({ food: 15, gold: 30 })) { s.toast('Need 15 food and 30 gold', 'bad'); return false; }
    set({ kingdom: { ...s.kingdom, workers: s.kingdom.workers + 1 } }); s.emitQ('count:worker'); s.toast('A new worker joins your kingdom!', 'good'); return true;
  },
  assign: (uid, d) => {
    const s = get(); const k = s.kingdom; const b = k.buildings.find(x => x.uid === uid); if (!b || b.progress < 1) return;
    const used = k.buildings.reduce((a, x) => a + x.workers, 0);
    if (d > 0 && (used >= k.workers || b.workers >= 2 + b.level)) return; if (d < 0 && b.workers <= 0) return;
    set({ kingdom: { ...k, buildings: k.buildings.map(x => x.uid === uid ? { ...x, workers: x.workers + d } : x) } });
  },
  unlockUpgrade: id => {
    const s = get(); const u = KINGDOM_UPGRADES.find(x => x.id === id)!; if (s.kingdom.upgrades.includes(id)) return false;
    if (s.kingdom.research < u.cost) { s.toast('Not enough research points', 'bad'); return false; }
    set({ kingdom: { ...s.kingdom, research: s.kingdom.research - u.cost, upgrades: [...s.kingdom.upgrades, id] } }); s.toast(`Researched ${u.name}`, 'good'); return true;
  },

  buyShip: id => {
    const s = get(); if (s.ships[id]) return false; const req = SHIP_REQ[id];
    if (req.level && s.level < req.level) { s.toast(`Requires level ${req.level}`, 'bad'); return false; }
    if (req.boss && !s.bosses.includes(req.boss)) { s.toast('Defeat the Titan Golem first', 'bad'); return false; }
    if (!s.spend(SHIPS[id].cost)) { s.toast('Missing materials', 'bad'); return false; }
    const d = SHIPS[id]; set({ ships: { ...s.ships, [id]: { ...defaultShip(d.hull), style: d.style } } }); s.toast(`${d.name} acquired!`, 'good'); return true;
  },
  selectShip: id => { const s = get(); if (!s.ships[id]) return; const st = shipStats(s, id); set({ activeShip: id }); s.ships[id].hull = Math.min(Math.max(s.ships[id].hull, 1), st.maxHull); (window as any).__rebuildShip?.(); },
  upgradeShip: u => {
    const s = get(); const d = SHIP_UPGRADES.find(x => x.id === u)!; const inst = s.ships[s.activeShip]; const lvl = inst.upgrades[u] || 0;
    if (lvl >= d.max) return false; if (!s.spend(d.cost(lvl))) { s.toast('Missing parts or gold', 'bad'); return false; }
    set({ ships: { ...s.ships, [s.activeShip]: { ...inst, upgrades: { ...inst.upgrades, [u]: lvl + 1 } } } });
    if (u === 'armor') { const st = shipStats(get()); get().ships[get().activeShip].hull += st.maxHull * 0.2 / 1.2; }
    s.emitQ('count:upgrade'); s.toast(`${d.name} upgraded to level ${lvl + 1}`, 'good'); return true;
  },
  paintShip: patch => { const s = get(); set({ ships: { ...s.ships, [s.activeShip]: { ...s.ships[s.activeShip], ...patch } } }); (window as any).__rebuildShip?.(); },
  toggleDecor: id => {
    const s = get(); const inst = s.ships[s.activeShip]; const on = inst.decor.includes(id);
    set({ ships: { ...s.ships, [s.activeShip]: { ...inst, decor: on ? inst.decor.filter(d => d !== id) : [...inst.decor, id] } } }); (window as any).__rebuildShip?.(); return !on;
  },
  discover: id => {
    const s = get(); if (s.discovered.includes(id)) return; set({ discovered: [...s.discovered, id] });
    s.emitQ('count:discover'); s.gainXp(25);
  },

  save: () => {
    try { const s = get(); const p: any = {}; for (const k of Object.keys(newProgress())) p[k] = (s as any)[k]; localStorage.setItem(SAVE_KEY, JSON.stringify(p)); set({ saveExists: true }); } catch { /* */ }
  },
  load: () => {
    try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; const p = JSON.parse(raw); const base = newProgress(); set({ ...base, ...p, kingdom: { ...base.kingdom, ...p.kingdom }, skills: { ...base.skills, ...p.skills } }); return true; } catch { return false; }
  },
  newGame: () => { set({ ...newProgress(), toasts: [], panel: null, placing: null }); },
}));

function checkDone(id: string) {
  const s = useStore.getState(); const q = QUESTS.find(x => x.id === id)!; const st = s.quests[id];
  if (!st || st.state !== 'active') return;
  if (q.objs.every((o, i) => st.prog[i] >= o.n)) { useStore.setState({ quests: { ...s.quests, [id]: { ...st, state: 'ready' } } }); s.toast(`Objectives complete: ${q.title} — report to ${q.giver}`, 'quest'); (window as any).__sfx?.('quest'); }
}
export const progressOf = (s: Progress, q: QuestDef) => s.quests[q.id];
