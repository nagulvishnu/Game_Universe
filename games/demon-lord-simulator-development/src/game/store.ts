import { create } from 'zustand';
import {
  BUILDINGS, FACTIONS, GENERALS, GEN_BY_ID, ITEM_BY_ID, ITEMS, QUESTS, SAVE_KEY, SAVE_VERSION, START_INVENTORY, START_UNITS, TERRITORIES, TERR_BY_ID, UNITS, UNIT_KEYS,
  type FactionId, type ItemSlot, type Res, type ResKey, type Stats, type TerritoryDef, type UnitType,
} from './data';

export type Order = 'follow' | 'attack' | 'defend' | 'patrol' | 'garrison' | 'conquer' | 'idle';
export type Formation = 'offensive' | 'defensive' | 'balanced' | 'skirmish';
export interface Division {
  id: string; name: string; general: string | null; comp: Partial<Record<UnitType, number>>; formation: Formation; order: Order;
  target: string | null; status: 'base' | 'field' | 'garrison' | 'marching'; marchEnd?: number; marchStart?: number;
}
export interface TerrState { owner: FactionId; buildings: Record<string, number>; pop: number }
export interface GeneralState { loyalty: number; bond: number; deployed: boolean; mode: 'hq' | 'council' | 'follow'; kills: number }
export interface FactionState { relation: number; state: 'war' | 'neutral' | 'peace' | 'alliance'; strength: number }
export interface Attack { id: string; tid: string; faction: FactionId; power: number; eta: number; phase: 'marching' | 'arrived'; raid: boolean; arrivedAt?: number }
export interface Settings { sens: number; camDist: number; music: number; sfx: number; shadows: boolean; invertY: boolean; quality: 'low' | 'medium' | 'high' }
export interface Equipment { weapon: string | null; armor: string | null; ring1: string | null; ring2: string | null; artifact: string | null; dragon: string | null }
export type MenuId = null | 'pause' | 'command' | 'inventory' | 'map' | 'settings' | 'dialogue' | 'treasure' | 'help' | 'saves';
export interface Toast { id: number; text: string; kind: 'info' | 'good' | 'bad' | 'epic' }
export interface Offer { id: string; faction: FactionId; text: string }

const ZERO: Res = { gold: 0, crystals: 0, mana: 0, food: 0, supplies: 0 };
export const START_RES: Res = { gold: 25000, crystals: 3000, mana: 1800, food: 12000, supplies: 6000 };
export const DEFAULT_SETTINGS: Settings = { sens: 1, camDist: 9, music: 0.5, sfx: 0.7, shadows: true, invertY: false, quality: 'high' };

export interface Persist {
  res: Res; pending: Res; days: number; terr: Record<string, TerrState>; outposts: TerritoryDef[]; units: Record<UnitType, number>;
  divisions: Division[]; generals: Record<string, GeneralState>; commanders: Record<string, { loyalty: number }>; factions: Record<FactionId, FactionState>;
  inventory: string[]; equipment: Equipment; accepted: string[]; progress: Record<string, number>; done: string[]; tracked: string | null;
  bossesDefeated: string[]; chests: string[]; log: string[]; attacks: Attack[]; offers: Offer[]; councilOn: boolean; visited: string[]; kills: number;
}

const mkDivisions = (): Division[] => {
  const divs: Division[] = [];
  const guard: Division = { id: 'div_guard', name: 'Royal Guard', general: null, comp: {}, formation: 'balanced', order: 'follow', target: null, status: 'field' };
  const gdivs: Division[] = GENERALS.map((g) => ({ id: 'div_' + g.id, name: `${g.name}'s Legion`, general: g.id, comp: {}, formation: 'balanced', order: 'garrison', target: g.territory, status: 'garrison' }));
  for (const u of UNIT_KEYS) {
    const N = START_UNITS[u];
    const fg = GENERALS.filter((g) => g.focus.includes(u));
    for (const d of gdivs) {
      const g = GEN_BY_ID[d.general!];
      const share = (fg.includes(g) ? (0.6 / fg.length) : 0) + 0.15 / 7;
      d.comp[u] = Math.floor(N * share);
    }
    guard.comp[u] = Math.floor(N * 0.1);
  }
  divs.push(guard, ...gdivs);
  return divs;
};

export const freshPersist = (): Persist => {
  const terr: Record<string, TerrState> = {};
  for (const t of TERRITORIES) terr[t.id] = { owner: t.faction, buildings: {}, pop: t.pop };
  terr.capital.buildings = { barracks: 1, market: 1, mine: 1, walls: 2, farm: 1, manawell: 1, forge: 1, temple: 1 };
  const generals: Persist['generals'] = {};
  GENERALS.forEach((g, i) => (generals[g.id] = { loyalty: 70 + ((i * 7) % 25), bond: 40 + ((i * 11) % 30), deployed: false, mode: 'hq', kills: 0 }));
  const commanders: Persist['commanders'] = { abyssal_king: { loyalty: 90 }, leviathan: { loyalty: 72 }, tidal_queen: { loyalty: 80 }, kraken: { loyalty: 68 }, deepwarden: { loyalty: 85 } };
  return {
    res: { ...START_RES }, pending: { ...ZERO }, days: 1, terr, outposts: [], units: { ...START_UNITS }, divisions: mkDivisions(), generals, commanders,
    factions: {
      demon: { relation: 100, state: 'alliance', strength: 0 }, human: { relation: -20, state: 'neutral', strength: 30000 }, celestial: { relation: -45, state: 'neutral', strength: 45000 },
      rival: { relation: -80, state: 'war', strength: 15000 }, ancient: { relation: -30, state: 'war', strength: 25000 },
    },
    inventory: [...START_INVENTORY], equipment: { weapon: 'voidreaver', armor: 'crimson_royal', ring1: null, ring2: null, artifact: null, dragon: null },
    accepted: [], progress: {}, done: [], tracked: null, bossesDefeated: [], chests: [], log: ['The Demon Realm awaits its supreme ruler.'], attacks: [], offers: [], councilOn: false, visited: [], kills: 0,
  };
};

export const allTerritories = (s: { outposts: TerritoryDef[] }) => (s.outposts.length ? TERRITORIES.concat(s.outposts) : TERRITORIES);
export const terrDef = (s: { outposts: TerritoryDef[] }, id: string) => TERR_BY_ID[id] ?? s.outposts.find((o) => o.id === id)!;

export const unitCount = (c: Partial<Record<UnitType, number>>) => UNIT_KEYS.reduce((a, k) => a + (c[k] ?? 0), 0);
export const unitPower = (c: Partial<Record<UnitType, number>>) => UNIT_KEYS.reduce((a, k) => a + (c[k] ?? 0) * UNITS[k].power, 0);
export const totalArmy = (u: Record<UnitType, number>) => unitCount(u);
export const unassignedUnits = (s: Persist) => {
  const out = { ...s.units };
  for (const d of s.divisions) for (const k of UNIT_KEYS) out[k] -= d.comp[k] ?? 0;
  for (const k of UNIT_KEYS) out[k] = Math.max(0, out[k]);
  return out;
};
export const divisionPower = (s: Persist, d: Division) => {
  let p = unitPower(d.comp);
  const g = d.general ? GEN_BY_ID[d.general] : null;
  if (g) p *= 1 + (g.power / 2500) * (0.5 + s.generals[g.id].loyalty / 200);
  p *= d.formation === 'offensive' ? 1.12 : d.formation === 'skirmish' ? 1.04 : 1;
  return Math.round(p);
};
export const terrDefense = (s: Persist, id: string): number => {
  const def = terrDef(s, id);
  const st = s.terr[id];
  if (!st) return def.defense;
  let d = def.defense * (1 + 0.02 * (st.buildings.barracks ?? 0)) + (st.buildings.walls ?? 0) * 900;
  if (st.owner === 'demon') {
    for (const dv of s.divisions) if (dv.status === 'garrison' && dv.target === id) d += divisionPower(s, dv) * 0.6;
    for (const g of GENERALS) if (s.generals[g.id].deployed && g.territory === id) d += g.power * 2;
  }
  return Math.round(d);
};
export const armyCapacity = (s: Persist) => 12000 + 2000 * Object.values(s.terr).reduce((a, t) => a + (t.owner === 'demon' ? t.buildings.barracks ?? 0 : 0), 0);
export const armyPower = (s: Persist) => Math.round(unitPower(s.units));
export const canAfford = (res: Res, cost: Partial<Res>) => (Object.keys(cost) as ResKey[]).every((k) => res[k] >= (cost[k] ?? 0));
const pay = (res: Res, cost: Partial<Res>, mul = 1): Res => {
  const r = { ...res };
  for (const k of Object.keys(cost) as ResKey[]) r[k] -= Math.ceil((cost[k] ?? 0) * mul);
  return r;
};
export const dailyIncome = (s: Persist): Res => {
  const inc = { ...ZERO };
  for (const t of allTerritories(s)) {
    const st = s.terr[t.id];
    if (!st || st.owner !== 'demon') continue;
    for (const k of Object.keys(t.income) as ResKey[]) inc[k] += t.income[k] ?? 0;
    const b = st.buildings;
    inc.crystals += 40 * (b.mine ?? 0); inc.food += 120 * (b.farm ?? 0); inc.gold += 180 * (b.market ?? 0); inc.mana += 45 * (b.manawell ?? 0); inc.supplies += 70 * (b.forge ?? 0);
  }
  const n = totalArmy(s.units), nu = n - s.units.undead;
  inc.food -= Math.round(nu * 0.015); inc.gold -= Math.round(n * 0.004);
  return inc;
};
export const BASE_STATS = { hp: 2000, mana: 300, atk: 100, def: 0, crit: 5, speed: 0, regen: 8 };
export const equipStats = (eq: Equipment) => {
  const t = { ...BASE_STATS } as Record<keyof Stats, number>;
  for (const id of Object.values(eq)) if (id) { const it = ITEM_BY_ID[id]; for (const k of Object.keys(it.stats) as (keyof Stats)[]) t[k] += it.stats[k] ?? 0; }
  return t;
};

interface Hud { hp: number; maxHp: number; mana: number; maxMana: number; stamina: number; region: string; form: number; cds: Record<string, number>; flying: boolean; swimming: boolean; boss: null | { name: string; title: string; hp: number; max: number; phase: number }; fieldCount: number; enemiesNear: number; prompt: string | null; combo: number; fps: number; summonT: number }
export interface Dialogue { name: string; title: string; color: string; lines: string[]; kind: 'general' | 'commander' | 'npc'; id: string }

interface Game extends Persist {
  selTerr: string | null;
  screen: 'menu' | 'loading' | 'playing'; loadPct: number; loadMsg: string; menu: MenuId; cmdTab: string; settings: Settings; hud: Hud; toasts: Toast[]; dialogue: Dialogue | null; hasSave: boolean; flash: string | null; banner: string | null; startMode: 'new' | 'continue'; slotLoad: number; pendingPlayer: { x: number; y: number; z: number; form: number } | null; selDiv: string | null;
  setMenu: (m: MenuId) => void; setScreen: (s: Game['screen']) => void; toast: (t: string, k?: Toast['kind']) => void; addLog: (t: string) => void;
  newGame: () => void; continueGame: (slot?: number) => void; save: (slot: number) => boolean; load: (slot: number) => boolean; slotInfo: (slot: number) => null | { day: number; time: string; gold: number };
  setSettings: (p: Partial<Settings>) => void; spend: (c: Partial<Res>) => boolean; gain: (c: Partial<Res>) => void;
  collect: () => void; tickDay: () => void; build: (tid: string, key: string) => void; recruit: (u: UnitType, n: number) => void;
  createDivision: (name: string) => void; disband: (id: string) => void; moveUnits: (id: string, u: UnitType, n: number) => void; setOrder: (id: string, o: Order, target?: string | null) => void;
  setFormation: (id: string, f: Formation) => void; assignGeneral: (div: string, gen: string | null) => void; recallDiv: (id: string) => void; recallAll: () => void;
  setGeneral: (id: string, p: Partial<GeneralState>) => void; summonCouncil: (on: boolean) => void;
  declareWar: (f: FactionId) => void; ally: (f: FactionId) => void; peace: (f: FactionId) => void; surrender: (f: FactionId) => void; gift: (f: FactionId) => void; answerOffer: (id: string, ok: boolean) => void;
  tickWorld: (now: number) => void; resolveAttack: (id: string, defended: boolean | null) => void; setOwner: (tid: string, owner: FactionId) => void; establishOutpost: (x: number, z: number) => boolean;
  acceptQuest: (id: string) => void; report: (kind: string, target: string, n?: number) => void; track: (id: string | null) => void;
  equip: (id: string, ring?: 1 | 2) => void; unequip: (slot: keyof Equipment) => void; addItem: (id: string) => void; bossDefeated: (id: string) => void;
  openDialogue: (d: Dialogue | null) => void; setHud: (h: Partial<Hud>) => void; setFlash: (c: string | null) => void; setBanner: (t: string | null) => void;
}

let toastId = 1;
const persistKeys: (keyof Persist)[] = ['res', 'pending', 'days', 'terr', 'outposts', 'units', 'divisions', 'generals', 'commanders', 'factions', 'inventory', 'equipment', 'accepted', 'progress', 'done', 'tracked', 'bossesDefeated', 'chests', 'log', 'attacks', 'offers', 'councilOn', 'visited', 'kills'];
export const hooks: { getPlayer: () => { x: number; y: number; z: number; form: number }; time: () => number; playerPos: () => { x: number; z: number } } = { getPlayer: () => ({ x: 0, y: 0, z: 60, form: 0 }), time: () => 0, playerPos: () => ({ x: 0, z: 0 }) };

const readSlot = (slot: number) => {
  try { const raw = localStorage.getItem(SAVE_KEY + '_' + slot); if (!raw) return null; const d = JSON.parse(raw); if (d.version !== SAVE_VERSION) return null; return d; } catch { return null; }
};
const loadSettings = (): Settings => { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('demonlord_settings') || '{}') }; } catch { return DEFAULT_SETTINGS; } };

export const useGame = create<Game>((set, get) => ({
  ...freshPersist(),
  selTerr: 'capital', screen: 'menu', loadPct: 0, loadMsg: '', menu: null, cmdTab: 'overview', settings: loadSettings(), toasts: [], dialogue: null, hasSave: !!(readSlot(0) || readSlot(1) || readSlot(2)), flash: null, banner: null, startMode: 'new', slotLoad: 0, pendingPlayer: null, selDiv: 'div_guard',
  hud: { hp: 2000, maxHp: 2000, mana: 300, maxMana: 300, stamina: 100, region: 'Demon Capital', form: 0, cds: {}, flying: false, swimming: false, boss: null, fieldCount: 0, enemiesNear: 0, prompt: null, combo: 0, fps: 60, summonT: 0 },

  setMenu: (m) => set({ menu: m }),
  setScreen: (s) => set({ screen: s }),
  toast: (text, kind = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-5), { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  addLog: (t) => set((s) => ({ log: [`Day ${s.days}: ${t}`, ...s.log].slice(0, 40) })),

  newGame: () => set({ ...freshPersist(), startMode: 'new', screen: 'loading', pendingPlayer: null, menu: null, selDiv: 'div_guard' }),
  continueGame: (slot = 0) => {
    if (get().load(slot)) set({ startMode: 'continue', screen: 'loading', menu: null });
  },
  save: (slot) => {
    try {
      const s = get(); const data: Record<string, unknown> = { version: SAVE_VERSION, savedAt: Date.now(), player: hooks.getPlayer(), settings: s.settings, time: hooks.time() };
      for (const k of persistKeys) data[k] = s[k];
      localStorage.setItem(SAVE_KEY + '_' + slot, JSON.stringify(data));
      set({ hasSave: true }); return true;
    } catch { return false; }
  },
  load: (slot) => {
    const d = readSlot(slot);
    if (!d) return false;
    const base = freshPersist(); const patch: Record<string, unknown> = {};
    for (const k of persistKeys) patch[k] = d[k] ?? base[k];
    set({ ...(patch as Partial<Game>), settings: { ...DEFAULT_SETTINGS, ...d.settings }, pendingPlayer: d.player ?? null, dialogue: null });
    return true;
  },
  slotInfo: (slot) => { const d = readSlot(slot); return d ? { day: d.days, time: new Date(d.savedAt).toLocaleString(), gold: Math.floor(d.res.gold) } : null; },
  setSettings: (p) => { const st = { ...get().settings, ...p }; set({ settings: st }); try { localStorage.setItem('demonlord_settings', JSON.stringify(st)); } catch { /* ignore */ } },
  spend: (c) => { if (!canAfford(get().res, c)) { get().toast('Not enough resources', 'bad'); return false; } set((s) => ({ res: pay(s.res, c) })); return true; },
  gain: (c) => set((s) => { const r = { ...s.res }; for (const k of Object.keys(c) as ResKey[]) r[k] += c[k] ?? 0; return { res: r }; }),

  collect: () => { const p = get().pending; const tot = Object.values(p).reduce((a, b) => a + b, 0); if (tot < 1) return get().toast('No income to collect yet'); get().gain(p); set({ pending: { ...ZERO } }); get().toast('Royal income collected', 'good'); },
  tickDay: () => set((s) => {
    const inc = dailyIncome(s); const pending = { ...s.pending }; const res = { ...s.res };
    for (const k of Object.keys(inc) as ResKey[]) { if (inc[k] >= 0) pending[k] += inc[k]; else res[k] = Math.max(0, res[k] + inc[k]); }
    const terr = { ...s.terr };
    for (const t of allTerritories(s)) { const st = terr[t.id]; if (st && st.owner === 'demon') terr[t.id] = { ...st, pop: Math.round(st.pop * (1.002 + 0.002 * (st.buildings.farm ?? 0) + 0.001 * (st.buildings.temple ?? 0))) }; }
    const generals = { ...s.generals };
    for (const g of GENERALS) { const gs = generals[g.id]; const temple = terr[g.territory]?.buildings.temple ?? 0; generals[g.id] = { ...gs, loyalty: Math.min(100, gs.loyalty + (res.food <= 0 ? -2 : 0.2 + temple * 0.6)) }; }
    return { pending, res, terr, generals, days: s.days + 1 };
  }),

  build: (tid, key) => {
    const s = get(); const st = s.terr[tid]; const b = BUILDINGS[key];
    if (!st || st.owner !== 'demon') return s.toast('You do not own this territory', 'bad');
    const lvl = st.buildings[key] ?? 0;
    if (lvl >= b.max) return s.toast(`${b.name} is at max level`, 'bad');
    if (!s.spend(Object.fromEntries(Object.entries(b.cost).map(([k, v]) => [k, Math.ceil((v as number) * (1 + lvl * 0.8))])) as Partial<Res>)) return;
    set((x) => ({ terr: { ...x.terr, [tid]: { ...x.terr[tid], buildings: { ...x.terr[tid].buildings, [key]: lvl + 1 } } } }));
    get().toast(`${b.name} ${lvl ? 'upgraded to level ' + (lvl + 1) : 'constructed'} at ${terrDef(get(), tid).name}`, 'good');
    get().report('build', 'any');
  },
  recruit: (u, n) => {
    const s = get(); const room = armyCapacity(s) - totalArmy(s.units);
    if (room <= 0) return s.toast('Army capacity reached — build Barracks', 'bad');
    n = Math.min(n, room);
    const cost: Partial<Res> = {}; for (const k of Object.keys(UNITS[u].cost) as ResKey[]) cost[k] = UNITS[u].cost[k] * n;
    if (!s.spend(cost)) return;
    set((x) => ({ units: { ...x.units, [u]: x.units[u] + n } }));
    get().toast(`Recruited ${n} ${UNITS[u].name}`, 'good');
  },
  createDivision: (name) => { const id = 'div_' + Math.random().toString(36).slice(2, 7); set((s) => ({ divisions: [...s.divisions, { id, name: name || 'New Squad', general: null, comp: {}, formation: 'balanced', order: 'idle', target: null, status: 'base' }], selDiv: id })); },
  disband: (id) => set((s) => ({ divisions: s.divisions.filter((d) => d.id !== id || d.id === 'div_guard'), selDiv: s.selDiv === id ? 'div_guard' : s.selDiv })),
  moveUnits: (id, u, n) => set((s) => {
    const free = unassignedUnits(s)[u];
    return { divisions: s.divisions.map((d) => { if (d.id !== id) return d; const cur = d.comp[u] ?? 0; const next = n > 0 ? cur + Math.min(n, free) : Math.max(0, cur + n); return { ...d, comp: { ...d.comp, [u]: next } }; }) };
  }),
  setOrder: (id, order, target = null) => {
    const s = get(); const d = s.divisions.find((x) => x.id === id); if (!d) return;
    if (unitCount(d.comp) === 0) return s.toast('This division has no units', 'bad');
    let status: Division['status'] = 'field'; let marchEnd: number | undefined; let marchStart: number | undefined;
    if (order === 'garrison') {
      if (!target || s.terr[target]?.owner !== 'demon') return s.toast('Choose one of your territories to garrison', 'bad');
      status = 'garrison';
    } else if (order === 'conquer') {
      if (!target || s.terr[target]?.owner === 'demon') return s.toast('Choose an enemy territory to conquer', 'bad');
      status = 'marching'; marchStart = hooks.time(); marchEnd = marchStart + 35 + Math.random() * 25;
    } else if (order === 'idle') status = 'base';
    set((x) => ({ divisions: x.divisions.map((v) => (v.id === id ? { ...v, order, target, status, marchEnd, marchStart } : v)) }));
    s.toast(`${d.name}: ${order.toUpperCase()}${target ? ' → ' + terrDef(get(), target).name : ''}`, 'info');
  },
  setFormation: (id, f) => set((s) => ({ divisions: s.divisions.map((d) => (d.id === id ? { ...d, formation: f } : d)) })),
  assignGeneral: (div, gen) => set((s) => ({ divisions: s.divisions.map((d) => (d.id === div ? { ...d, general: gen } : d.general === gen && gen ? { ...d, general: null } : d)) })),
  recallDiv: (id) => { set((s) => ({ divisions: s.divisions.map((d) => (d.id === id ? { ...d, status: 'field', order: 'follow', target: null, marchEnd: undefined } : d)) })); get().toast('Division recalled to your side', 'good'); },
  recallAll: () => { set((s) => ({ divisions: s.divisions.map((d) => (d.status === 'marching' || d.status === 'garrison' ? { ...d, status: 'field', order: 'follow', target: null, marchEnd: undefined } : d)) })); get().toast('All deployed forces recalled', 'good'); },
  setGeneral: (id, p) => set((s) => ({ generals: { ...s.generals, [id]: { ...s.generals[id], ...p } } })),
  summonCouncil: (on) => set((s) => { const generals = { ...s.generals }; for (const g of GENERALS) generals[g.id] = { ...generals[g.id], mode: on ? 'council' : generals[g.id].mode === 'council' ? 'hq' : generals[g.id].mode, deployed: on ? false : generals[g.id].deployed }; return { generals, councilOn: on }; }),

  declareWar: (f) => { set((s) => ({ factions: { ...s.factions, [f]: { ...s.factions[f], state: 'war', relation: Math.min(-60, s.factions[f].relation - 40) } } })); get().toast(`War declared on the ${FACTIONS[f].name}!`, 'bad'); get().addLog(`You declared war on the ${FACTIONS[f].name}.`); },
  ally: (f) => {
    const s = get(); const fs = s.factions[f];
    if (fs.state === 'war') return s.toast('End the war first (negotiate peace)', 'bad');
    if (fs.state === 'alliance') return s.toast('Already allied');
    if (!s.spend({ gold: 3000 })) return;
    const p = Math.max(0.05, Math.min(0.9, (fs.relation + 60) / 150 + (f === 'ancient' ? -0.2 : 0) + (f === 'rival' ? -0.25 : 0)));
    if (Math.random() < p) { set((x) => ({ factions: { ...x.factions, [f]: { ...fs, state: 'alliance', relation: Math.min(100, fs.relation + 30) } } })); s.toast(`${FACTIONS[f].name} accepts an alliance!`, 'good'); s.addLog(`Alliance forged with the ${FACTIONS[f].name}.`); }
    else { set((x) => ({ factions: { ...x.factions, [f]: { ...fs, relation: fs.relation - 5 } } })); s.toast(`${FACTIONS[f].name} refuses your envoy`, 'bad'); }
  },
  peace: (f) => {
    const s = get(); const fs = s.factions[f]; if (fs.state !== 'war') return s.toast('You are not at war');
    if (!s.spend({ gold: 1500 })) return;
    const p = Math.max(0.1, Math.min(0.85, (fs.relation + 100) / 160 + (armyPower(s) > fs.strength ? 0.1 : -0.1)));
    if (Math.random() < p) { set((x) => ({ factions: { ...x.factions, [f]: { ...fs, state: 'peace', relation: Math.max(fs.relation, -10) + 10 } } })); s.toast('Peace treaty signed', 'good'); s.addLog(`Peace made with the ${FACTIONS[f].name}.`); }
    else s.toast('The enemy rejects your terms', 'bad');
  },
  surrender: (f) => {
    const s = get(); const fs = s.factions[f]; const theirs = allTerritories(s).filter((t) => s.terr[t.id].owner === f);
    if (!theirs.length) return s.toast('This faction has nothing left to surrender');
    const ratio = armyPower(s) / Math.max(1, fs.strength);
    if (ratio > 1.4 && Math.random() < Math.min(0.9, ratio / 3)) {
      const t = theirs.sort((a, b) => a.defense - b.defense)[0];
      get().setOwner(t.id, 'demon'); set((x) => ({ factions: { ...x.factions, [f]: { ...fs, relation: fs.relation - 15, strength: fs.strength * 0.9 } } }));
      s.toast(`${t.name} surrenders to the Demon Lord!`, 'epic'); s.report('conquer', t.id); s.addLog(`${FACTIONS[f].name} surrendered ${t.name}.`);
    } else { set((x) => ({ factions: { ...x.factions, [f]: { ...fs, relation: fs.relation - 25, state: 'war' } } })); s.toast('Your demand is refused — they take up arms!', 'bad'); }
  },
  gift: (f) => { if (!get().spend({ gold: 2000 })) return; set((s) => ({ factions: { ...s.factions, [f]: { ...s.factions[f], relation: Math.min(100, s.factions[f].relation + 12) } } })); get().toast('Gift delivered. Relations improve.', 'good'); },
  answerOffer: (id, ok) => {
    const o = get().offers.find((x) => x.id === id); if (!o) return;
    if (ok) { set((s) => ({ factions: { ...s.factions, [o.faction]: { ...s.factions[o.faction], state: 'peace', relation: Math.max(0, s.factions[o.faction].relation) } } })); get().toast('Peace accepted', 'good'); }
    set((s) => ({ offers: s.offers.filter((x) => x.id !== id) }));
  },
  setOwner: (tid, owner) => set((s) => ({ terr: { ...s.terr, [tid]: { ...s.terr[tid], owner } } })),

  tickWorld: (now) => {
    const s = get();
    // arrival of attacks
    const attacks = s.attacks.map((a) => ({ ...a }));
    for (const a of attacks) { if (a.phase === 'marching' && now >= a.eta) { a.phase = 'arrived'; a.arrivedAt = now; s.toast(`⚠ ${FACTIONS[a.faction].name} forces are attacking ${terrDef(get(), a.tid).name}!`, 'bad'); } }
    set({ attacks });
    for (const a of get().attacks) if (a.phase === 'arrived' && now - (a.arrivedAt ?? now) > (a.raid ? 160 : 40)) get().resolveAttack(a.id, null);
    // march resolution
    for (const d of get().divisions) {
      if (d.status === 'marching' && d.marchEnd && now >= d.marchEnd && d.target) {
        const st = get(); const tid = d.target; const def = terrDefense(st, tid); const att = divisionPower(st, d) * (0.8 + Math.random() * 0.45);
        const t = terrDef(st, tid);
        if (att > def) {
          get().setOwner(tid, 'demon');
          const f = st.terr[tid].owner;
          set((x) => ({
            factions: { ...x.factions, [f]: { ...x.factions[f], strength: x.factions[f].strength * 0.9 } },
            divisions: x.divisions.map((v) => (v.id === d.id ? { ...v, status: 'garrison', order: 'garrison', marchEnd: undefined, comp: scaleComp(v.comp, 0.8), target: tid } : v)),
            units: shrinkUnits(x.units, d.comp, 0.2),
          }));
          get().gain({ gold: 1500 + def * 0.5, crystals: 100 });
          get().toast(`🏴 ${t.name} CONQUERED by ${d.name}!`, 'epic'); get().addLog(`${d.name} conquered ${t.name}.`); get().report('conquer', tid);
          set({ banner: `${t.name.toUpperCase()} CONQUERED` }); setTimeout(() => set({ banner: null }), 4200);
        } else {
          set((x) => ({ divisions: x.divisions.map((v) => (v.id === d.id ? { ...v, status: 'base', order: 'idle', marchEnd: undefined, comp: scaleComp(v.comp, 0.45) } : v)), units: shrinkUnits(x.units, d.comp, 0.55) }));
          get().toast(`${d.name} was defeated at ${t.name} and retreated!`, 'bad'); get().addLog(`${d.name} failed to take ${t.name}.`);
        }
      }
    }
    // faction AI
    const st = get(); const facs = { ...st.factions }; const evs: string[] = [];
    const owned = (f: FactionId) => allTerritories(st).filter((t) => st.terr[t.id].owner === f);
    for (const f of ['human', 'celestial', 'rival', 'ancient'] as FactionId[]) {
      const fs = { ...facs[f] }; fs.strength = Math.max(3000, fs.strength * (1 + (Math.random() - 0.48) * 0.04)); facs[f] = fs;
      if (fs.state === 'war' && st.attacks.length < 2 && Math.random() < 0.28 && owned(f).length) {
        const mine = owned('demon'); const tgt = Math.random() < 0.12 ? mine.find((t) => t.id === 'capital')! : mine.filter((t) => t.id !== 'capital')[Math.floor(Math.random() * Math.max(1, mine.length - 1))];
        if (tgt && !st.attacks.some((a) => a.tid === tgt.id)) {
          const a: Attack = { id: 'atk_' + Math.random().toString(36).slice(2, 6), tid: tgt.id, faction: f, power: fs.strength * (0.08 + Math.random() * 0.1), eta: now + 40, phase: 'marching', raid: false };
          set((x) => ({ attacks: [...x.attacks, a] })); st.toast(`🚩 ${FACTIONS[f].name} host marches on ${tgt.name} (arrives soon)`, 'bad'); evs.push(`${FACTIONS[f].name} marched on ${tgt.name}.`);
        }
      }
      if (Math.random() < 0.3) {
        const others = (['human', 'celestial', 'rival', 'ancient'] as FactionId[]).filter((o) => o !== f && owned(o).length > 0);
        const o = others[Math.floor(Math.random() * others.length)];
        if (o && facs[f].strength > facs[o].strength * 0.9 && Math.random() < 0.35 && owned(o).length > 1) {
          const tgt = owned(o)[Math.floor(Math.random() * owned(o).length)];
          if (tgt.id !== 'forgotten_vault') { st.setOwner(tgt.id, f); facs[f].strength *= 1.03; facs[o].strength *= 0.93; evs.push(`${FACTIONS[f].name} seized ${tgt.name} from the ${FACTIONS[o].name}.`); }
        }
      }
      if (fs.state === 'war' && f !== 'ancient' && f !== 'rival' && fs.relation > -50 && Math.random() < 0.08 && !st.offers.some((o) => o.faction === f)) {
        set((x) => ({ offers: [...x.offers, { id: 'o_' + Math.random().toString(36).slice(2, 5), faction: f, text: `The ${FACTIONS[f].name} sues for peace.` }] })); st.toast(`${FACTIONS[f].name} envoys request peace talks`, 'info');
      }
      if (fs.state !== 'war') fs.relation = Math.max(-100, Math.min(100, fs.relation + (fs.state === 'alliance' ? 0.2 : 0.3)));
    }
    set({ factions: facs }); for (const e of evs) get().addLog(e);
    // check alliance auto-help
  },
  resolveAttack: (id, defended) => {
    const s = get(); const a = s.attacks.find((x) => x.id === id); if (!a) return;
    const t = terrDef(s, a.tid); const def = terrDefense(s, a.tid);
    const win = defended === true ? true : defended === false ? false : def * (0.8 + Math.random() * 0.5) > a.power * 1.4;
    set((x) => ({ attacks: x.attacks.filter((y) => y.id !== id) }));
    if (win) {
      s.toast(`🛡 ${t.name} held against the ${FACTIONS[a.faction].name}!`, 'good'); s.addLog(`${t.name} repelled an attack.`); s.gain({ gold: 800, crystals: 40 });
      set((x) => ({ factions: { ...x.factions, [a.faction]: { ...x.factions[a.faction], strength: x.factions[a.faction].strength * 0.97 } } }));
    } else if (a.tid === 'capital') {
      s.toast('The capital was ravaged — gold plundered!', 'bad'); set((x) => ({ res: { ...x.res, gold: Math.floor(x.res.gold * 0.85) } })); s.addLog('Raiders sacked the capital treasury.');
    } else { get().setOwner(a.tid, a.faction); s.toast(`✖ ${t.name} was lost to the ${FACTIONS[a.faction].name}!`, 'bad'); s.addLog(`${t.name} fell to the ${FACTIONS[a.faction].name}.`); }
  },
  establishOutpost: (x, z) => {
    const s = get(); if (!s.spend({ gold: 3500, supplies: 400, crystals: 50 })) return false;
    const n = s.outposts.length + 1; const id = 'outpost_' + n;
    const def: TerritoryDef = { id, name: `Demon Outpost ${n}`, region: 'capital', faction: 'demon', x, z, type: 'base', defense: 1500, income: { supplies: 40, gold: 60 }, pop: 1000, desc: 'A forward military base established by the Demon Lord.', flatR: 40 };
    set((g) => ({ outposts: [...g.outposts, def], terr: { ...g.terr, [id]: { owner: 'demon', buildings: {}, pop: 1000 } } }));
    s.toast('New military base established!', 'epic'); s.addLog(`Established ${def.name}.`); return true;
  },

  acceptQuest: (id) => set((s) => (s.accepted.includes(id) || s.done.includes(id) ? s : { accepted: [...s.accepted, id], tracked: s.tracked ?? id, progress: { ...s.progress, [id]: 0 } })),
  report: (kind, target, n = 1) => {
    const s = get(); const prog = { ...s.progress }; let changed = false;
    for (const q of QUESTS) {
      if (!s.accepted.includes(q.id) || s.done.includes(q.id) || q.kind !== kind) continue;
      const ok = q.target === 'any' || q.target === target || q.target.split(',').includes(target);
      if (!ok) continue;
      prog[q.id] = (prog[q.id] ?? 0) + n; changed = true;
      if (prog[q.id] >= q.n) {
        set((x) => ({ done: [...x.done, q.id], accepted: x.accepted.filter((a) => a !== q.id), tracked: x.tracked === q.id ? x.accepted.find((a) => a !== q.id) ?? null : x.tracked }));
        get().gain({ gold: q.reward.gold, crystals: q.reward.crystals }); if (q.reward.item) get().addItem(q.reward.item);
        get().toast(`QUEST COMPLETE: ${q.name} (+${q.reward.gold} gold)`, 'epic'); get().addLog(`Quest completed: ${q.name}`);
      }
    }
    if (changed) set({ progress: prog });
  },
  track: (id) => set({ tracked: id }),

  equip: (id, ring) => set((s) => {
    const it = ITEM_BY_ID[id]; if (!it || !s.inventory.includes(id)) return s;
    const eq = { ...s.equipment };
    if (it.slot === 'ring') { const k = ring === 2 ? 'ring2' : eq.ring1 && !eq.ring2 ? 'ring2' : 'ring1'; if (eq.ring1 === id || eq.ring2 === id) return s; eq[k] = id; }
    else eq[it.slot as ItemSlot as keyof Equipment] = id;
    return { equipment: eq };
  }),
  unequip: (slot) => set((s) => ({ equipment: { ...s.equipment, [slot]: null } })),
  addItem: (id) => { if (get().inventory.includes(id)) { get().gain({ gold: 2000 }); return; } set((s) => ({ inventory: [...s.inventory, id] })); get().toast(`Acquired: ${ITEM_BY_ID[id]?.name}`, 'epic'); },
  bossDefeated: (id) => set((s) => (s.bossesDefeated.includes(id) ? s : { bossesDefeated: [...s.bossesDefeated, id] })),

  openDialogue: (d) => set({ dialogue: d, menu: d ? 'dialogue' : null }),
  setHud: (h) => set((s) => ({ hud: { ...s.hud, ...h } })),
  setFlash: (c) => set({ flash: c }),
  setBanner: (t) => set({ banner: t }),
}));

const scaleComp = (c: Partial<Record<UnitType, number>>, m: number) => { const o: Partial<Record<UnitType, number>> = {}; for (const k of UNIT_KEYS) if (c[k]) o[k] = Math.floor(c[k]! * m); return o; };
const shrinkUnits = (u: Record<UnitType, number>, c: Partial<Record<UnitType, number>>, loss: number) => { const o = { ...u }; for (const k of UNIT_KEYS) if (c[k]) o[k] = Math.max(0, o[k] - Math.floor(c[k]! * loss)); return o; };
export const itemsOf = (ids: string[]) => ids.map((i) => ITEM_BY_ID[i]).filter(Boolean);
export const ALL_ITEMS = ITEMS;
