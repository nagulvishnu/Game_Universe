import { create } from 'zustand';
import {
  DEFAULT_LOOK, DECORS, FACILITIES, FIRST, FORMS, GEAR, ITEM_MAP, LAST, MEMBER_SKILLS, MISSIONS, REGION_MAP, ROLES, ROLE_COST, ROLE_RANK, SKILLS, SKILL_MAP,
  type LookCfg, type Role, type Mission,
} from './data';
import { G, rnd } from './runtime';
import { sfx } from './audio';
import {
  applyXpGain, computeTick, deriveStats, facLv, findReadyMission, freshCore, missionAvail, rankOf, unlockedSkill,
  type Core, type Member, type Terr,
} from './logic';
export type { Core, Member, Terr } from './logic';
export { facLv, hqTier, missionAvail, ownedTerr, progressOf, rankOf, unlockedSkill } from './logic';
export interface Settings { gfx: 'low' | 'medium' | 'high' | 'ultra'; sens: number; camDist: number; volume: number; music: boolean; invertY: boolean }
export interface Toast { id: number; text: string; color: string }
interface UI {
  screen: 'menu' | 'game'; overlay: '' | 'inventory' | 'skills' | 'map' | 'org' | 'missions' | 'character' | 'market' | 'settings' | 'pause';
  slot: string; settings: Settings; toasts: Toast[]; cands: Member[]; sub: string;
}
export type State = Core & UI & Actions;
interface Actions {
  newGame: (slot: string, name: string, look: LookCfg) => void; applySave: (d: Core, slot: string) => void; snapshot: () => Core;
  setOverlay: (o: UI['overlay'], sub?: string) => void; setScreen: (s: UI['screen']) => void; setSettings: (p: Partial<Settings>) => void;
  setLook: (p: Partial<LookCfg>) => void;
  toast: (text: string, color?: string) => void;
  addMoney: (n: number) => void; addRep: (n: number) => void; addXp: (n: number) => void; giveItem: (id: string, n?: number) => void; takeItem: (id: string, n?: number) => boolean;
  equipItem: (id: string) => void; unequipItem: (id: string) => void; useItem: (id: string) => void; equipSkill: (slot: 'e' | 'r' | 'v', id: string) => void;
  upgradeWeapon: (id: string) => void; setFormSel: (n: number) => void; evt: (e: string, n?: number) => void; checkMissions: () => void; track: (id: string) => void;
  buildFacility: (id: string) => void; setDecor: (id: string) => void; upgradeSecurity: () => void; refreshCands: (pay?: boolean) => void; recruit: (id: string) => void; fire: (id: string) => void;
  assign: (id: string, a: string) => void; setCommander: (id: string, terr: string) => void; reward: (id: string) => void; train: () => void;
  sell: (id: string, n?: number) => void; buy: (id: string) => void; setTerr: (id: string, p: Partial<Terr>) => void; tick: () => void; newContract: () => void; addVehicle: (type: string, color: string) => void;
  captureTerritory: (id: string) => void;
}

/** Derive stats for the *current* transformation form (reads runtime state G). */
export const derive = (s: Core) => deriveStats(s, G.p.form);

const defaultSettings: Settings = { gfx: 'medium', sens: 1, camDist: 7, volume: 0.7, music: true, invertY: false };
const CORE_KEYS: (keyof Core)[] = ['name', 'look', 'level', 'xp', 'money', 'rep', 'inv', 'weapon', 'armor', 'outfit', 'accs', 'eq', 'forms', 'formSel', 'wlv', 'vehicles', 'members', 'fac', 'decor', 'security', 'research', 'prisoners', 'terr', 'bosses', 'done', 'counters', 'tracked', 'rivalGrowth', 'contracts', 'pos', 'time', 'playTime'];
let toastId = 1;

export function genMember(role: Role, rank: number, recLv: number): Member {
  const lvl = Math.max(1, Math.round(rank * 2 + recLv * 2 + rnd(0, 4) + (role === 'Commander' ? 8 : role === 'Elite Villain' ? 5 : 0)));
  const sk: string[] = []; while (sk.length < (role === 'Commander' || role === 'Elite Villain' ? 3 : 2)) { const x = MEMBER_SKILLS[Math.floor(rnd(0, MEMBER_SKILLS.length))]; if (!sk.includes(x)) sk.push(x); }
  return {
    id: 'mb' + Math.floor(rnd(1e8)), name: `${FIRST[Math.floor(rnd(0, FIRST.length))]} ${LAST[Math.floor(rnd(0, LAST.length))]}`, role, lvl, str: Math.round(lvl * (role === 'Henchman' ? 6 : 9) + rnd(3, 12)),
    loyalty: Math.round(rnd(55, 90)), skills: sk, gear: GEAR[Math.floor(rnd(0, GEAR.length))], assign: 'Follow Me', seed: Math.floor(rnd(1e6)), terr: '', xp: 0,
  };
}

export const useGame = create<State>((set, get) => ({
  ...freshCore('Nameless', DEFAULT_LOOK),
  screen: 'menu', overlay: '', slot: 'slot1', settings: (() => { try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem('sv_settings') || '{}') }; } catch { return defaultSettings; } })(), toasts: [], cands: [], sub: '',
  newGame: (slot, name, look) => {
    const c = freshCore(name || 'Nameless', look); set({ ...c, slot, overlay: '', screen: 'game', cands: [] });
    G.heat = 0; G.threat = 0; G.p.form = 0; G.p.formT = 0; G.time = c.time; G.p.hp = 9999; G.p.en = 9999;
    for (const m of MISSIONS) if (m.id === 'm1') set({ tracked: 'm1' });
  },
  applySave: (d, slot) => { set({ ...d, slot, overlay: '', screen: 'game', cands: [] }); G.time = d.time; G.heat = 0; G.threat = 0; G.p.form = 0; G.p.formT = 0; G.p.hp = 9999; G.p.en = 9999; },
  snapshot: () => { const s = get(); const o: any = {}; for (const k of CORE_KEYS) o[k] = (s as any)[k]; o.pos = [G.p.pos.x, G.p.pos.y, G.p.pos.z]; o.time = G.time; return o as Core; },
  setOverlay: (o, sub = '') => set({ overlay: o, sub }), setScreen: (screen) => set({ screen }),
  setSettings: (p) => { const st = { ...get().settings, ...p }; try { localStorage.setItem('sv_settings', JSON.stringify(st)); } catch { /* ignore */ } set({ settings: st }); },
  setLook: (p) => set((s) => ({ look: { ...s.look, ...p } })),
  toast: (text, color = '#e5e7eb') => { const id = toastId++; set((s) => ({ toasts: [...s.toasts.slice(-5), { id, text, color }] })); setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200); },
  addMoney: (n) => set((s) => ({ money: Math.max(0, s.money + Math.round(n > 0 ? n * derive(s).moneyMult : n)) })),
  addRep: (n) => set((s) => ({ rep: Math.max(0, s.rep + Math.round(n > 0 ? n * derive(s).repMult : n)) })),
  addXp: (n) => {
    const s = get();
    const r = applyXpGain(s.level, s.xp, n * derive(s).xpMult);
    set({ xp: r.xp, level: r.level });
    if (r.levels > 0) {
      const lvl = r.level;
      const st = get(); const eq = { ...st.eq };
      const fill = (slot: 'e' | 'r' | 'v') => { if (eq[slot]) return; const k = SKILLS.find((k) => unlockedSkill(st, k.id) && (slot === 'v' ? k.ult : !k.ult) && !Object.values(eq).includes(k.id)); if (k) eq[slot] = k.id; };
      fill('e'); fill('r'); fill('v'); set({ eq }); G.p.hp = 9999; G.p.en = 9999; sfx('levelup');
      get().toast(`LEVEL UP! You are now level ${lvl}`, '#fbbf24');
      for (const k of SKILLS) if (k.lvl === lvl) get().toast(`New skill unlocked: ${k.name}`, '#a855f7');
      for (const f of FORMS) if (f.lvl === lvl && f.id) get().toast(`Transformation available: ${f.name} (needs its item)`, '#ff2040');
    }
  },
  giveItem: (id, n = 1) => { set((s) => ({ inv: { ...s.inv, [id]: (s.inv[id] ?? 0) + n } })); const it = ITEM_MAP[id]; if (it) get().toast(`+${n > 1 ? n + '× ' : ''}${it.name}`, '#7dd3fc'); },
  takeItem: (id, n = 1) => { const s = get(); if ((s.inv[id] ?? 0) < n) return false; const inv = { ...s.inv, [id]: s.inv[id] - n }; if (inv[id] <= 0) delete inv[id]; set({ inv }); return true; },
  equipItem: (id) => {
    const it = ITEM_MAP[id]; if (!it || !get().inv[id]) return;
    if (it.cat === 'Weapons') set({ weapon: id }); else if (it.cat === 'Armor') set({ armor: id }); else if (it.cat === 'Outfits') set({ outfit: id });
    else if (it.cat === 'Accessories') set((s) => ({ accs: s.accs.includes(id) ? s.accs : [...s.accs, id] }));
    sfx('equip');
  },
  unequipItem: (id) => { const it = ITEM_MAP[id]; if (!it) return; if (it.cat === 'Weapons') set({ weapon: '' }); else if (it.cat === 'Armor') set({ armor: '' }); else if (it.cat === 'Accessories') set((s) => ({ accs: s.accs.filter((a) => a !== id) })); else if (it.cat === 'Outfits') set({ outfit: 'o_street' }); },
  useItem: (id) => {
    const it = ITEM_MAP[id]; const s = get(); if (!it || !s.inv[id]) return;
    if (it.form) { const f = FORMS[it.form]; if (s.level < f.lvl) { s.toast(`Need level ${f.lvl} to awaken ${f.name}`, '#f87171'); return; } get().takeItem(id); set((st) => ({ forms: [...new Set([...st.forms, it.form!])], formSel: it.form! })); s.toast(`TRANSFORMATION UNLOCKED: ${f.name}!`, '#ff2040'); sfx('levelup'); return; }
    if (it.heal || it.energy) { get().takeItem(id); const d = derive(s); if (it.heal) G.p.hp = Math.min(d.maxHp, G.p.hp + it.heal); if (it.energy) G.p.en = Math.min(d.maxEn, G.p.en + it.energy); sfx('heal'); s.toast(`Used ${it.name}`, '#86efac'); }
  },
  equipSkill: (slot, id) => { const s = get(); const k = SKILL_MAP[id]; if (!k || !unlockedSkill(s, id)) return; if (slot === 'v' && !k.ult) { s.toast('Only ultimate skills fit the Ultimate slot (V)', '#f87171'); return; } if (slot !== 'v' && k.ult) { s.toast('Ultimates go in the V slot', '#f87171'); return; } const eq = { ...s.eq }; (Object.keys(eq) as ('e' | 'r' | 'v')[]).forEach((x) => { if (eq[x] === id) eq[x] = ''; }); eq[slot] = id; set({ eq }); sfx('equip'); },
  upgradeWeapon: (id) => {
    const s = get(); if (!facLv(s, 'armory')) { s.toast('Build an Armory first', '#f87171'); return; }
    const lv = s.wlv[id] ?? 0; if (lv >= 10) return; const it = ITEM_MAP[id]; const cost = Math.round((it.price * 0.1 + 300) * (lv + 1)); const scrap = 3 * (lv + 1);
    if (s.money < cost || (s.inv.scrap ?? 0) < scrap) { s.toast(`Need $${cost} and ${scrap} Scrap Metal`, '#f87171'); return; }
    get().addMoney(-cost); get().takeItem('scrap', scrap); set((st) => ({ wlv: { ...st.wlv, [id]: lv + 1 } })); s.toast(`${it.name} upgraded to +${lv + 1}`, '#fbbf24'); sfx('equip');
  },
  setFormSel: (n) => set({ formSel: n }),
  evt: (e, n = 1) => { set((s) => ({ counters: { ...s.counters, [e]: (s.counters[e] ?? 0) + n } })); get().checkMissions(); },
  checkMissions: () => {
    const m = findReadyMission(get()); if (!m) return;
    const s = get();
    set((st) => ({ done: { ...st.done, [m.id]: true }, contracts: st.contracts.filter((c) => c.id !== m.id) }));
    get().addMoney(m.money); get().addRep(m.rep); get().addXp(m.xp); if (m.item) get().giveItem(m.item);
    s.toast(`MISSION COMPLETE: ${m.title}  +$${m.money}  +${m.rep} REP`, '#34d399'); sfx('mission');
    if (get().tracked === m.id) { const nx = [...MISSIONS, ...get().contracts].find((x) => missionAvail(get(), x)); set({ tracked: nx?.id ?? '' }); }
    get().checkMissions();
  },
  track: (id) => set({ tracked: id }),
  buildFacility: (id) => {
    const s = get(); const f = FACILITIES.find((x) => x.id === id)!; const lv = facLv(s, id); if (lv >= f.max) return; const cost = Math.round(f.base * Math.pow(lv + 1, 1.5));
    if (s.money < cost) { s.toast(`Need $${cost.toLocaleString()}`, '#f87171'); return; }
    get().addMoney(-cost); set((st) => ({ fac: { ...st.fac, [id]: lv + 1 } })); s.toast(`${f.name} ${lv ? 'upgraded to level ' + (lv + 1) : 'built'}!`, '#fbbf24'); sfx('mission'); get().evt('facility');
  },
  setDecor: (id) => { const s = get(); const d = DECORS.find((x) => x.id === id)!; if (s.money < d.cost && s.decor !== id) { s.toast('Not enough money', '#f87171'); return; } if (s.decor !== id) get().addMoney(-d.cost); set({ decor: id }); },
  upgradeSecurity: () => { const s = get(); const c = 4000 * (s.security + 1); if (s.security >= 5) return; if (s.money < c) { s.toast(`Need $${c}`, '#f87171'); return; } get().addMoney(-c); set({ security: s.security + 1 }); s.toast('HQ security increased', '#60a5fa'); },
  refreshCands: (pay) => {
    const s = get(); if (pay) { if (s.money < 200) { s.toast('Need $200 to scout', '#f87171'); return; } get().addMoney(-200); }
    const r = rankOf(s); const n = 4 + facLv(s, 'recruit'); const out: Member[] = [];
    const avail = ROLES.filter((x) => ROLE_RANK[x] <= r + (facLv(s, 'recruit') >= 3 ? 1 : 0));
    for (let i = 0; i < n; i++) out.push(genMember(avail[Math.floor(rnd(0, avail.length))], r, facLv(s, 'recruit')));
    set({ cands: out });
  },
  recruit: (id) => {
    const s = get(); const m = s.cands.find((c) => c.id === id); if (!m) return; const cost = ROLE_COST[m.role] * (1 + m.lvl / 30);
    const d = derive(s); if (s.members.length >= d.memberCap) { s.toast('Organization is full — build a Throne Room or rank up', '#f87171'); return; }
    if (m.role === 'Commander' && s.members.filter((x) => x.role === 'Commander').length >= Math.max(1, d.cmdCap)) { s.toast('Need more Commander Quarters', '#f87171'); return; }
    if (s.money < cost) { s.toast(`Need $${Math.round(cost).toLocaleString()}`, '#f87171'); return; }
    get().addMoney(-Math.round(cost)); set((st) => ({ members: [...st.members, m], cands: st.cands.filter((c) => c.id !== id) })); s.toast(`${m.name} (${m.role}) joined your organization!`, '#a78bfa'); get().evt('recruit'); sfx('equip');
  },
  fire: (id) => set((s) => ({ members: s.members.filter((m) => m.id !== id), terr: Object.fromEntries(Object.entries(s.terr).map(([k, t]) => [k, t.commander === id ? { ...t, commander: '' } : t])) })),
  assign: (id, a) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, assign: a } : m)) })),
  setCommander: (id, terr) => set((s) => {
    const t = s.terr[terr]; if (!t) return {};
    const terrs = Object.fromEntries(Object.entries(s.terr).map(([k, v]) => [k, v.commander === id ? { ...v, commander: '' } : v]));
    terrs[terr] = { ...terrs[terr], commander: id };
    return { terr: terrs, members: s.members.map((m) => (m.id === id ? { ...m, assign: 'Territory', terr } : m)) };
  }),
  reward: (id) => { const s = get(); const m = s.members.find((x) => x.id === id); if (!m) return; const c = 500 + m.lvl * 100; if (s.money < c) { s.toast(`Need $${c}`, '#f87171'); return; } get().addMoney(-c); set((st) => ({ members: st.members.map((x) => (x.id === id ? { ...x, loyalty: Math.min(100, x.loyalty + 15) } : x)) })); },
  train: () => { const s = get(); if (!facLv(s, 'training')) { s.toast('Build a Training Hall', '#f87171'); return; } const c = 500 * s.level; if (s.money < c) { s.toast(`Need $${c}`, '#f87171'); return; } get().addMoney(-c); get().addXp(40 * s.level); s.toast('Training complete', '#86efac'); },
  sell: (id, n = 1) => { const it = ITEM_MAP[id]; if (!it || !get().takeItem(id, n)) return; get().addMoney(Math.round(it.price * 0.5 * n * (1 + facLv(get(), 'garage') * 0.15))); get().toast(`Sold ${it.name}`, '#fde047'); get().evt('trade'); sfx('coin'); },
  buy: (id) => { const it = ITEM_MAP[id]; const s = get(); if (!it) return; const p = Math.round(it.price * 1.5); if (s.money < p) { s.toast('Not enough money', '#f87171'); return; } if (!it.stack && s.inv[id]) { s.toast('Already owned', '#f87171'); return; } get().addMoney(-p); get().giveItem(id); get().evt('trade'); sfx('coin'); },
  setTerr: (id, p) => set((s) => ({ terr: { ...s.terr, [id]: { ...s.terr[id], ...p } } })),
  captureTerritory: (id) => {
    const r = REGION_MAP[id]; const s = get();     get().setTerr(id, { state: 'Villain-Controlled', defense: 20 + s.level });
    set((st) => ({ bosses: { ...st.bosses, [r.boss]: true } }));
    get().toast(`${r.name} CAPTURED!`, '#f43f5e'); get().evt('capture:' + id); sfx('mission');
  },
  tick: () => {
    const s = get(); const r = computeTick(s, Math.random);
    for (const e of r.events.repelled) s.toast(`${e.region}: attack repelled!${e.cmdName ? ' ' + e.cmdName + ' held the line.' : ''}`, '#60a5fa');
    const b = r.events.betrayed;
    set({ terr: r.terr, members: r.members, research: s.research + r.researchPoints, rivalGrowth: s.rivalGrowth + 1 });
    if (r.money) get().addMoney(Math.round(r.money));
    if (r.scrap) get().giveItem('scrap', r.scrap);
    if (r.lost) { s.toast(`HEROES RETOOK ${r.lost.toUpperCase()}!`, '#ef4444'); sfx('alarm'); }
    if (b) s.toast(`BETRAYAL! ${b.name} (${b.role}) has abandoned you and stolen from the vault!`, '#ef4444');
    if (r.celebrate) s.toast('Your organization is hard at work…', '#9ca3af');
  },
  newContract: () => {
    const s = get(); if (s.contracts.length >= 3) { s.toast('Finish active contracts first', '#f87171'); return; }
    const r = rankOf(s); const kinds = [{ ev: 'kill_gang', t: 'Eliminate gang members', n: 6 }, { ev: 'steal', t: 'Steal vehicles for a buyer', n: 2 }, { ev: 'kill_hero', t: 'Eliminate heroes', n: 3 }, { ev: 'rob', t: 'Rob local shops', n: 2 }, { ev: 'burgle', t: 'Burgle residences', n: 5 }];
    const k = kinds[Math.floor(rnd(0, kinds.length))]; const id = 'c_' + Math.floor(rnd(1e6)); const n = Math.round(k.n * (1 + r * 0.15));
    const m: Mission = { id, title: `Contract: ${k.t}`, desc: `${k.t} (${n}).`, ev: k.ev, need: n, money: 1500 * r + n * 300, rep: 20 * r + n * 4, xp: 200 * r, rank: 1 };
    set((st) => ({ contracts: [...st.contracts, m], counters: { ...st.counters, ['base_' + id]: st.counters[k.ev] ?? 0 }, tracked: id })); s.toast('Contract accepted', '#38bdf8');
  },
  addVehicle: (type, color) => set((s) => ({ vehicles: [...s.vehicles, { type, color }] })),
}));

export const useHud = create<{ hp: number; maxHp: number; en: number; maxEn: number; speed: number; flying: boolean; boost: boolean; threat: number; form: number; formT: number; cd: number[]; prompt: string; progress: number; boss: null | { name: string; hp: number; max: number }; region: string; regionState: string; time: number; weather: string; fps: number; alt: number; combo: number; vehicle: string; wpDist: number; cine: number; dead: number; hint: string; vhp: number }>(() => ({
  hp: 100, maxHp: 100, en: 100, maxEn: 100, speed: 0, flying: false, boost: false, threat: 0, form: 0, formT: 0, cd: [0, 0, 0], prompt: '', progress: 0, boss: null, region: 'Metro City', regionState: '', time: 9, weather: 'clear', fps: 60, alt: 0, combo: 0, vehicle: '', wpDist: -1, cine: 0, dead: 0, hint: '', vhp: 0,
}));
