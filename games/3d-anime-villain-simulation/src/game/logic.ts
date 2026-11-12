// ───────────── STICKVERSE pure game logic ─────────────
// Everything in this module is free of side effects (no DOM, no runtime state G,
// no audio/FX). Randomness is injected as `rand` so ticks and missions are
// deterministic under test. The zustand store wires these to the UI.
import {
  FORMS, ITEM_MAP, MISSIONS, REGIONS, SKILL_MAP, xpFor,
  type LookCfg, type Mission, type Role, type TState,
} from './data';

// ───────────── saved-game model ─────────────
export interface Member { id: string; name: string; role: Role; lvl: number; str: number; loyalty: number; skills: string[]; gear: string; assign: string; seed: number; terr: string; xp: number }
export interface Terr { state: TState; commander: string; defense: number }
export interface Core {
  name: string; look: LookCfg; level: number; xp: number; money: number; rep: number; inv: Record<string, number>;
  weapon: string; armor: string; outfit: string; accs: string[]; eq: { e: string; r: string; v: string }; forms: number[]; formSel: number; wlv: Record<string, number>;
  vehicles: { type: string; color: string }[]; members: Member[]; fac: Record<string, number>; decor: string; security: number; research: number; prisoners: number;
  terr: Record<string, Terr>; bosses: Record<string, boolean>; done: Record<string, boolean>; counters: Record<string, number>; tracked: string; rivalGrowth: number; contracts: Mission[];
  pos: [number, number, number]; time: number; playTime: number;
}

// ───────────── fresh game ─────────────
const initTerr = (): Record<string, Terr> => Object.fromEntries(REGIONS.map((r) => [r.id, { state: r.state, commander: '', defense: 20 }]));
const startInv = () => ({ knife: 1, o_street: 1, medkit: 3, energycell: 2, scrap: 5 });
export const freshCore = (name: string, look: LookCfg): Core => ({
  name, look, level: 1, xp: 0, money: 800, rep: 0, inv: startInv(), weapon: 'knife', armor: '', outfit: 'o_street', accs: [], eq: { e: 'shadow_bolt', r: 'energy_blast', v: '' },
  forms: [0], formSel: 0, wlv: {}, vehicles: [], members: [], fac: {}, decor: 'none', security: 0, research: 0, prisoners: 0, terr: initTerr(), bosses: {}, done: {}, counters: {},
  tracked: 'm1', rivalGrowth: 0, contracts: [], pos: [-56, 0, 14], time: 9.5, playTime: 0,
});

// ───────────── derived helpers ─────────────
export const facLv = (s: Core, id: string) => s.fac[id] ?? 0;
export const hqTier = (s: Core) => Math.min(5, 1 + Math.floor(Object.values(s.fac).reduce((a, b) => a + b, 0) / 5));
export const ownedTerr = (s: Core) => Object.values(s.terr).filter((t) => t.state === 'Villain-Controlled' || t.state === 'Fully Conquered').length;

export function rankOf(s: Core): number {
  const t = ownedTerr(s), tier = hqTier(s), m = s.members.length;
  const conds = [s.rep >= 50, s.rep >= 150 && s.level >= 3, s.rep >= 350 && m >= 3, s.rep >= 700 && tier >= 2, s.rep >= 1200 && t >= 1, s.rep >= 2000 && t >= 3, s.rep >= 3200 && t >= 5, s.rep >= 5000 && t >= 7, s.rep >= 8000 && t >= 9 && !!s.bosses.solaris];
  let r = 1; for (const c of conds) { if (c) r++; else break; } return r;
}

export const unlockedSkill = (s: Core, id: string) => { const k = SKILL_MAP[id]; return !!k && s.level >= k.lvl && (!k.req || !!s.bosses[k.req]); };

export const progressOf = (s: Core, m: Mission) => {
  if (m.ev === 'territories') return ownedTerr(s);
  return s.counters[m.ev] ?? 0;
};
export const missionAvail = (s: Core, m: Mission) => !s.done[m.id] && rankOf(s) >= m.rank && (!m.after || !!s.done[m.after]);

/** Stat derivation. `form` is the active transformation id (0 = base), passed in explicitly. */
export function deriveStats(s: Core, form: number) {
  const w = ITEM_MAP[s.weapon]; const a = ITEM_MAP[s.armor]; const f = FORMS[form] ?? FORMS[0];
  const has = (id: string) => (s.inv[id] ?? 0) > 0;
  const outfitBonus = (id: string) => s.outfit === id;
  const wlv = s.wlv[s.weapon] ?? 0;
  const weaponDmg = w ? (w.atk ?? 5) * (1 + 0.2 * wlv) * (1 + 0.04 * facLv(s, 'armory')) : 4;
  const artifact = (has('eye') ? 0.1 : 0) + (has('crown') ? 0.15 : 0);
  const dmgMult = f.dmg * (1 + artifact + (outfitBonus('o_void') ? 0.15 : 0) + (s.armor === 'voidplate' ? 0.2 : 0));
  return {
    maxHp: 100 + s.level * 14 + facLv(s, 'training') * 10,
    maxEn: 100 + s.level * 5 + facLv(s, 'energy') * 15 + (outfitBonus('o_neon') ? 15 : 0) + (s.accs.includes('a_halo') ? 20 : 0),
    weaponDmg, base: 6 + weaponDmg + s.level * 1.6, dmgMult, def: (a?.def ?? 0) + s.level * 0.6,
    speedMult: f.speed * (outfitBonus('o_ninja') ? 1.08 : 1), flyMult: f.fly * (s.armor === 'trench' ? 1.05 : 1),
    regenEn: 6 * (1 + facLv(s, 'energy') * 0.1 + (has('heartdark') ? 0.4 : 0)), xpMult: 1 + facLv(s, 'training') * 0.08,
    moneyMult: outfitBonus('o_suit') ? 1.05 : 1, repMult: 1 + facLv(s, 'throne') * 0.05 + (outfitBonus('o_regal') ? 0.15 : 0) + (has('crown') ? 0.25 : 0),
    memberCap: 4 + facLv(s, 'throne') * 3 + 2 * Math.floor(rankOf(s) / 2), cmdCap: facLv(s, 'quarters'),
  };
}

// ───────────── XP / levelling ─────────────
export const MAX_LEVEL = 60;
export function applyXpGain(level: number, xp: number, amount: number): { level: number; xp: number; levels: number } {
  let lvl = level, cur = xp + amount;
  while (lvl < MAX_LEVEL && cur >= xpFor(lvl)) { cur -= xpFor(lvl); lvl++; }
  return { level: lvl, xp: cur, levels: lvl - level };
}

// ───────────── missions ─────────────
/** The next completable mission, mirroring the historical first-match order (MISSIONS then contracts). */
export function findReadyMission(s: Core): Mission | null {
  const all = [...MISSIONS, ...s.contracts];
  for (const m of all) {
    if (!missionAvail(s, m)) continue;
    const extra = m.id.startsWith('c_') ? (s.counters['base_' + m.id] ?? 0) : 0;
    if (progressOf(s, m) >= m.need + extra) return m;
  }
  return null;
}

// ───────────── organization tick ─────────────
export interface TickEvent { repelled: { region: string; cmdName: string }[]; betrayed: Member | null }
export interface TickResult {
  money: number; scrap: number; researchPoints: number;
  terr: Record<string, Terr>; members: Member[];
  lost: string; celebrate: boolean; events: TickEvent;
}

/** Pure counterpart of the 30-second organisation tick. `rand` must return [0, 1). */
export function computeTick(s: Core, rand: () => number): TickResult {
  let money = 0, mats = 0, rp = facLv(s, 'lab');
  for (const m of s.members) {
    if (m.assign === 'Gather Resources') { mats += 1 + Math.floor(m.lvl / 8); money += m.lvl * 6; }
    if (m.assign === 'Research' || m.role === 'Scientist') rp += 1 + Math.floor(m.lvl / 10);
    if (m.assign === 'Patrol City') money += m.lvl * 4;
  }
  const upd: Record<string, Terr> = { ...s.terr };
  let members = [...s.members];
  let lost = '';
  const repelled: TickEvent['repelled'] = [];
  for (const r of REGIONS) {
    const t = upd[r.id]; if (!t || (t.state !== 'Villain-Controlled' && t.state !== 'Fully Conquered')) continue;
    const cmd = members.find((m) => m.id === t.commander);
    money += r.income * 0.05 * (cmd ? 1 + cmd.str / 120 : 0.4) * (t.state === 'Fully Conquered' ? 1.5 : 1);
    const defense = t.defense + (cmd ? cmd.str * 0.6 : 0) + facLv(s, 'war') * 10 + s.security * 6 + (t.state === 'Fully Conquered' ? 40 : 0);
    if (rand() < 0.18) {
      const atk = r.lvl * 6 + rand() * 40 + s.rivalGrowth * 2;
      if (atk > defense) {
        upd[r.id] = { state: 'Hero-Controlled', commander: '', defense: 20 }; lost = r.name;
        members = members.map((m) => (m.id === t.commander ? { ...m, terr: '', assign: 'Follow Me', loyalty: m.loyalty - 10 } : m));
      } else {
        repelled.push({ region: r.name, cmdName: cmd?.name ?? '' });
        if (cmd) members = members.map((m) => (m.id === cmd.id ? { ...m, xp: m.xp + 20, lvl: m.xp + 20 > m.lvl * 40 ? m.lvl + 1 : m.lvl, str: m.str + 1 } : m));
      }
    }
  }
  members = members.map((m) => {
    const roll = rand() < 0.15 ? -Math.round(1 + rand() * 5) : 0;
    const loyalty = Math.min(100, m.loyalty + (m.assign === 'Territory' ? 0 : 1) + roll);
    return { ...m, loyalty };
  });
  const traitor = members.find((m) => m.loyalty < 18 && rand() < 0.35);
  let betrayed: Member | null = null;
  if (traitor) {
    betrayed = traitor; money -= Math.round(s.money * 0.05);
    members = members.filter((m) => m.id !== traitor.id);
    for (const k of Object.keys(upd)) if (upd[k].commander === traitor.id) upd[k] = { ...upd[k], commander: '' };
  }
  money += s.prisoners * 40 * facLv(s, 'prison') + s.money * 0.004 * facLv(s, 'storage');
  return {
    money, scrap: mats, researchPoints: rp, terr: upd, members, lost,
    celebrate: members.length > 0 && rand() < 0.2,
    events: { repelled, betrayed },
  };
}
