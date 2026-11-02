// ─────────────────────────────────────────────────────────────
// DUNGEON AWAKENING — static, data-driven game definitions
// ─────────────────────────────────────────────────────────────
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RAR: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b8c0cc', uncommon: '#4ade80', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24', mythic: '#fb3b64',
};
export const RARITY_HEX: Record<Rarity, number> = {
  common: 0xb8c0cc, uncommon: 0x4ade80, rare: 0x38bdf8, epic: 0xc084fc, legendary: 0xfbbf24, mythic: 0xfb3b64,
};
export const RARITY_MULT = [1, 1.25, 1.6, 2.1, 2.8, 3.8];
export type Slot = 'weapon' | 'helmet' | 'chest' | 'gloves' | 'boots' | 'accessory';
export const SLOTS: Slot[] = ['weapon', 'helmet', 'chest', 'gloves', 'boots', 'accessory'];
export type WType = 'sword' | 'greatsword' | 'dual' | 'spear' | 'staff' | 'gauntlets';
export const WTYPES: WType[] = ['sword', 'greatsword', 'dual', 'spear', 'staff', 'gauntlets'];
export type Element = 'none' | 'fire' | 'ice' | 'shadow' | 'poison' | 'abyss';
export const ELEM_COLOR: Record<Element, number> = { none: 0xcfe8ff, fire: 0xff6a1a, ice: 0x7fd8ff, shadow: 0x8a4bff, poison: 0x7cff4a, abyss: 0xff2d6f };

export interface Stats { atk: number; def: number; hp: number; crit: number; critDmg: number; regen: number; en: number }
export interface Item {
  id: string; name: string; slot: Slot; wtype?: WType; rarity: Rarity; lvl: number; stats: Partial<Stats>;
  up: number; element?: Element; elemDmg?: number; passive?: string; color: number; unique?: boolean;
}

export const PASSIVES: Record<string, string> = {
  lifesteal: 'Vampiric: heal 4% of damage dealt',
  surge: 'Abyss Surge: hits build 50% more Awakening meter',
  executioner: 'Executioner: +30% damage to enemies below 30% HP',
  swift: 'Swift: +12% attack speed',
  guard: 'Bulwark: -10% damage taken',
  fortune: 'Fortune: +25% gold and better drops',
};

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
let UID = Date.now() % 100000;
export const uid = () => `i${(UID++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

const WNAMES: Record<WType, string[]> = {
  sword: ['Blade', 'Saber', 'Longsword', 'Edge'], greatsword: ['Greatsword', 'Claymore', 'Bonecleaver', 'Zweihander'],
  dual: ['Twin Fangs', 'Dual Daggers', 'Razor Pair', 'Kris Pair'], spear: ['Spear', 'Pike', 'Lance', 'Halberd'],
  staff: ['Staff', 'Scepter', 'Rod', 'Focus'], gauntlets: ['Gauntlets', 'Knuckles', 'Crushers', 'Fists'],
};
const PRE = ['Rusted', 'Iron', 'Steel', 'Gallant', 'Runed', 'Stormforged', 'Emberlit', 'Frostbitten', 'Shaded', 'Abyssal', 'Aurelith', 'Voidtouched'];
const SLOTN: Record<string, string[]> = {
  helmet: ['Helm', 'Hood', 'Circlet', 'Visor'], chest: ['Cuirass', 'Vest', 'Robe', 'Plate', 'Hauberk'],
  gloves: ['Gloves', 'Bracers', 'Wraps', 'Gauntlets'], boots: ['Boots', 'Greaves', 'Treads', 'Sabatons'],
  accessory: ['Amulet', 'Ring', 'Charm', 'Talisman', 'Pendant'],
};
const SUFFIX = ['of the Wanderer', 'of Embers', 'of Rime', 'of Dusk', 'of the Wyrm', 'of the Abyss', 'of Aurelith'];
const ELEMS: Element[] = ['fire', 'ice', 'shadow', 'poison', 'abyss'];

export function rollRarity(boost = 0, min = 0): Rarity {
  let r = Math.random();
  r = 1 - Math.pow(1 - r, 1 + boost);
  const i = r < 0.58 ? 0 : r < 0.82 ? 1 : r < 0.94 ? 2 : r < 0.985 ? 3 : r < 0.998 ? 4 : 5;
  return RAR[Math.max(i, min)];
}

export function genItem(level: number, o: { slot?: Slot; wtype?: WType; rarity?: Rarity; boost?: number; minRarity?: number } = {}): Item {
  const slot: Slot = o.slot ?? pick<Slot>(['weapon', 'weapon', 'helmet', 'chest', 'gloves', 'boots', 'accessory']);
  const rarity = o.rarity ?? rollRarity(o.boost || 0, o.minRarity || 0);
  const ri = RAR.indexOf(rarity); const m = RARITY_MULT[ri]; const L = Math.max(1, level);
  const j = () => 0.9 + Math.random() * 0.2;
  const stats: Partial<Stats> = {};
  let name: string; let wtype: WType | undefined;
  if (slot === 'weapon') {
    wtype = o.wtype ?? pick(WTYPES);
    const wm = wtype === 'greatsword' ? 1.35 : wtype === 'dual' ? 0.8 : wtype === 'gauntlets' ? 0.9 : 1;
    stats.atk = Math.round((6 + L * 3.2) * m * j() * wm);
    if (ri >= 2) stats.crit = +(2 + ri * 1.5 + Math.random() * 2).toFixed(1);
    if (ri >= 3) stats.critDmg = Math.round(10 + ri * 6);
    name = `${pick(PRE)} ${pick(WNAMES[wtype])}`;
  } else {
    name = `${pick(PRE)} ${pick(SLOTN[slot])}`;
    if (slot === 'helmet') { stats.def = Math.round((2 + L * 0.9) * m * j()); stats.hp = Math.round((8 + L * 3) * m * j()); }
    if (slot === 'chest') { stats.def = Math.round((3 + L * 1.4) * m * j()); stats.hp = Math.round((15 + L * 5) * m * j()); }
    if (slot === 'gloves') { stats.atk = Math.round((1 + L * 0.7) * m * j()); stats.def = Math.round((1 + L * 0.5) * m * j()); }
    if (slot === 'boots') { stats.def = Math.round((1.5 + L * 0.7) * m * j()); stats.hp = Math.round((6 + L * 2.5) * m * j()); }
    if (slot === 'accessory') { stats.crit = +(2 + ri * 1.6 + Math.random() * 2).toFixed(1); stats.critDmg = Math.round(8 + ri * 7); stats.regen = +(0.4 + ri * 0.5).toFixed(1); stats.en = Math.round(5 + L * 0.8 * m); }
  }
  if (ri >= 3) name += ' ' + pick(SUFFIX);
  const it: Item = { id: uid(), name, slot, wtype, rarity, lvl: Math.max(1, L - Math.floor(Math.random() * 3)), stats, up: 0, color: 0, unique: false };
  const h = hashStr(name);
  const hue = (h % 360) / 360; const c = new (class { r = 0; g = 0; b = 0 })();
  // simple hsl→rgb
  const f = (n: number) => { const k = (n + hue * 12) % 12; const a = 0.45 * Math.min(0.55, 1 - 0.55); return 0.5 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
  c.r = f(0); c.g = f(8); c.b = f(4);
  it.color = (Math.round(c.r * 255) << 16) | (Math.round(c.g * 255) << 8) | Math.round(c.b * 255);
  if (ri >= 4) { it.element = pick(ELEMS); it.passive = pick(Object.keys(PASSIVES)); }
  else if (ri === 3 && Math.random() < 0.4) { it.passive = pick(Object.keys(PASSIVES)); }
  if (slot === 'weapon' && ri >= 4) it.elemDmg = Math.round((stats.atk || 10) * 0.22);
  return it;
}

export const BOSS_LEGENDS: Record<string, { name: string; wtype: WType; el: Element; passive: string; color: number }> = {
  bonewarden: { name: 'Marrowreaver', wtype: 'spear', el: 'shadow', passive: 'lifesteal', color: 0xc9d4b8 },
  ashengolem: { name: 'Ashbound Colossus', wtype: 'greatsword', el: 'fire', passive: 'executioner', color: 0xff7a2a },
  frostfang: { name: 'Frostfang Twins', wtype: 'dual', el: 'ice', passive: 'swift', color: 0x8fe6ff },
  executioner: { name: 'Umbral Verdict', wtype: 'sword', el: 'shadow', passive: 'surge', color: 0xa070ff },
  dragon: { name: 'Infernal Wyrmgrips', wtype: 'gauntlets', el: 'fire', passive: 'guard', color: 0xff4a1a },
  abyssking: { name: 'Crown of the Abyss', wtype: 'staff', el: 'abyss', passive: 'surge', color: 0xff2d6f },
};
export function genLegend(bossId: string, level: number): Item {
  const l = BOSS_LEGENDS[bossId];
  const it = genItem(level + 2, { slot: 'weapon', wtype: l.wtype, rarity: bossId === 'abyssking' ? 'mythic' : 'legendary' });
  it.name = l.name; it.element = l.el; it.passive = l.passive; it.color = l.color; it.unique = true;
  it.elemDmg = Math.round((it.stats.atk || 10) * 0.3);
  it.stats.crit = (it.stats.crit || 0) + 6; it.stats.critDmg = (it.stats.critDmg || 0) + 25;
  return it;
}

export const upScale = (it: Item) => 1 + 0.12 * it.up;
export function itemStats(it: Item): Partial<Stats> {
  const s: Partial<Stats> = {}; const k = upScale(it);
  for (const key of Object.keys(it.stats) as (keyof Stats)[]) s[key] = +((it.stats[key] || 0) * (key === 'crit' || key === 'regen' ? 1 + 0.04 * it.up : k)).toFixed(1);
  return s;
}
export function itemScore(it: Item): number {
  const s = itemStats(it);
  return Math.round(((s.atk || 0) * 2.2 + (s.def || 0) * 1.8 + (s.hp || 0) / 4 + (s.crit || 0) * 3 + (s.critDmg || 0) / 4 + (s.regen || 0) * 6 + (s.en || 0) / 3) + (it.elemDmg || 0) + (it.passive ? 15 : 0));
}
export const sellValue = (it: Item) => Math.round(itemScore(it) * 1.4 + 5);
export const upgradeCost = (it: Item) => ({ gold: Math.round(45 * (it.up + 1) * (1 + it.lvl / 10) * RARITY_MULT[RAR.indexOf(it.rarity)] * 0.7), ore: it.up + 1, rare: it.up >= 5 ? { id: it.up >= 8 ? 'abyss_crystal' : 'dragon_scale', n: it.up - 3 } : null });

// ── Materials & consumables ──
export const MATS: Record<string, { name: string; icon: string; color: string; desc: string; consumable?: boolean }> = {
  herb: { name: 'Moonpetal Herb', icon: '🌿', color: '#4ade80', desc: 'A glowing herb. Used for potions.' },
  iron_ore: { name: 'Iron Ore', icon: '⛏️', color: '#a8b4c4', desc: 'Used by the blacksmith to upgrade gear.' },
  bone_dust: { name: 'Bone Dust', icon: '🦴', color: '#e5e0c8', desc: 'Dust from the fallen dead.' },
  ember_core: { name: 'Ember Core', icon: '🔥', color: '#ff7a2a', desc: 'A still-burning heart of the Flame Abyss.' },
  frost_shard: { name: 'Frost Shard', icon: '❄️', color: '#7fd8ff', desc: 'A shard that never melts.' },
  shadow_essence: { name: 'Shadow Essence', icon: '🌑', color: '#a070ff', desc: 'Liquid darkness.' },
  dragon_scale: { name: 'Dragon Scale', icon: '🐉', color: '#ff5a2a', desc: 'Used to upgrade gear beyond +5.' },
  abyss_crystal: { name: 'Abyss Crystal', icon: '💎', color: '#ff2d6f', desc: 'Used to upgrade gear beyond +8.' },
  hp_potion: { name: 'Healing Draught', icon: '🧪', color: '#ff5470', desc: 'Restores 45% max HP. [1]', consumable: true },
  en_potion: { name: 'Energy Tonic', icon: '⚗️', color: '#4aa8ff', desc: 'Restores 60% energy. [2]', consumable: true },
  elixir: { name: 'Awakening Elixir', icon: '🔮', color: '#d070ff', desc: 'Fills the Awakening meter. [3]', consumable: true },
};

export const RECIPES: { id: string; name: string; desc: string; cost: Record<string, number>; gold: number; out?: { mat: string; n: number }; gear?: { slot: Slot; rarity: Rarity; wtype?: WType } }[] = [
  { id: 'c_hp', name: 'Healing Draught x2', desc: 'Brew from herbs.', cost: { herb: 2 }, gold: 10, out: { mat: 'hp_potion', n: 2 } },
  { id: 'c_en', name: 'Energy Tonic x2', desc: 'Herbs and bone dust.', cost: { herb: 2, bone_dust: 1 }, gold: 15, out: { mat: 'en_potion', n: 2 } },
  { id: 'c_el', name: 'Awakening Elixir', desc: 'Condensed abyssal power.', cost: { abyss_crystal: 1, shadow_essence: 2 }, gold: 120, out: { mat: 'elixir', n: 1 } },
  { id: 'c_blade', name: 'Ember-Forged Weapon (Rare)', desc: 'Random weapon type.', cost: { ember_core: 3, iron_ore: 4 }, gold: 260, gear: { slot: 'weapon', rarity: 'rare' } },
  { id: 'c_chest', name: 'Rimeplate Cuirass (Epic)', desc: 'Frost-hardened armor.', cost: { frost_shard: 5, iron_ore: 6 }, gold: 520, gear: { slot: 'chest', rarity: 'epic' } },
  { id: 'c_boots', name: 'Duskstep Treads (Epic)', desc: 'Silent boots.', cost: { shadow_essence: 5, iron_ore: 4 }, gold: 520, gear: { slot: 'boots', rarity: 'epic' } },
  { id: 'c_helm', name: 'Wyrmscale Helm (Legendary)', desc: 'Forged from dragon scales.', cost: { dragon_scale: 5, ember_core: 3 }, gold: 1500, gear: { slot: 'helmet', rarity: 'legendary' } },
  { id: 'c_amu', name: 'Abyssal Talisman (Legendary)', desc: 'A heart of crystal.', cost: { abyss_crystal: 4, shadow_essence: 4 }, gold: 2400, gear: { slot: 'accessory', rarity: 'legendary' } },
];

// ── Weapons: combo data ──
export interface AtkStep { style: string; dmg: number; dur: number; hs: number; he: number; range: number; arc: number; kb: number; lunge: number; poise: number; launch?: boolean; heavy?: boolean; low?: boolean }
const S = (style: string, dmg: number, dur: number, hs: number, he: number, range: number, arc: number, kb: number, lunge: number, poise: number, x: Partial<AtkStep> = {}): AtkStep => ({ style, dmg, dur, hs, he, range, arc, kb, lunge, poise, ...x });
export const COMBOS: Record<WType, AtkStep[]> = {
  sword: [S('slashR', 1, .44, .32, .56, 3.1, 130, 2, 1.4, 8), S('slashL', 1, .42, .32, .56, 3.1, 130, 2, 1.4, 8), S('thrust', 1.25, .5, .36, .58, 3.9, 50, 4, 2.4, 10), S('spin', 1.35, .58, .3, .7, 3.3, 360, 5, 0.8, 14), S('overhead', 2.4, .86, .5, .68, 3.4, 110, 9, 1.8, 35, { launch: true, heavy: true })],
  greatsword: [S('overhead', 2, .85, .5, .68, 3.8, 110, 6, 1.5, 28, { heavy: true }), S('slashR', 2.2, .9, .5, .7, 4, 150, 7, 1.5, 30, { heavy: true }), S('slam', 3.4, 1.15, .6, .78, 4.4, 220, 12, 1, 60, { launch: true, heavy: true })],
  dual: [S('slashR', .62, .3, .3, .55, 2.7, 120, 1, 1.0, 5), S('slashL', .62, .3, .3, .55, 2.7, 120, 1, 1.0, 5), S('slashR', .68, .3, .3, .55, 2.7, 130, 1, 1.0, 5), S('slashL', .68, .3, .3, .55, 2.7, 130, 1, 1.0, 5), S('spin', .95, .48, .3, .7, 3.1, 360, 3, .5, 10), S('uppercut', 1.5, .6, .4, .62, 2.9, 90, 6, 1.2, 25, { launch: true, heavy: true })],
  spear: [S('thrust', 1.1, .44, .36, .58, 5.0, 40, 3, 2.2, 8), S('thrust', 1.1, .44, .36, .58, 5.0, 40, 3, 2.2, 8), S('sweep', 1.3, .62, .35, .65, 4.4, 170, 5, 1.0, 14), S('thrust', 2.2, .8, .5, .66, 6.6, 36, 10, 3.5, 40, { launch: true, heavy: true })],
  staff: [S('spin', 1, .52, .3, .7, 3.6, 360, 3, .5, 10), S('slashR', 1, .44, .32, .56, 3.4, 130, 2, 1, 8), S('slam', 1.9, .8, .5, .7, 4.4, 360, 7, .5, 30, { heavy: true }), S('cast', 2.2, .9, .5, .72, 5.2, 360, 9, 0, 40, { launch: true, heavy: true })],
  gauntlets: [S('jabR', .8, .3, .28, .5, 2.6, 90, 2, 1.0, 8), S('jabL', .8, .3, .28, .5, 2.6, 90, 2, 1.0, 8), S('jabR', .9, .3, .28, .5, 2.6, 90, 3, 1.0, 10), S('uppercut', 1.4, .55, .35, .58, 2.8, 90, 6, 1.0, 22, { launch: true }), S('slam', 2.6, .9, .55, .75, 3.8, 360, 10, .5, 45, { heavy: true })],
};
export const SWEEP: AtkStep = S('sweep', 1.2, .55, .28, .55, 3.6, 220, 4, 0.6, 20, { low: true });
export const AIR_ATTACK: AtkStep = S('slam', 1.9, .6, .15, .6, 3.8, 360, 8, 0, 35, { heavy: true });
export const SPRINT_ATTACK: AtkStep = S('thrust', 1.5, .55, .25, .5, 4, 70, 6, 5, 18);
export const WEAPON_SPEED: Record<WType, number> = { sword: 1, greatsword: .8, dual: 1.25, spear: 1, staff: .95, gauntlets: 1.15 };

// ── Skills ──
export interface SkillDef { id: string; name: string; key: string; kind: 'active' | 'passive'; max: number; color: string; desc: string; ranks: string[] }
export const SKILLS: SkillDef[] = [
  { id: 'burst', name: 'Abyssal Burst', key: 'E', kind: 'active', max: 5, color: '#c084fc', desc: 'Launch a homing sphere of abyssal energy.', ranks: ['Base projectile', 'Greater damage', 'Piercing: passes through enemies', 'Faster recharge', 'Detonate: explodes in a wide blast'] },
  { id: 'rift', name: 'Shadow Rift', key: 'R', kind: 'active', max: 5, color: '#8a4bff', desc: 'Tear a dimensional slash through enemies ahead.', ranks: ['Base slash', 'Longer reach', 'Double Slash: a second rift follows', 'Lower cost', 'Gravity Well: drags enemies inward'] },
  { id: 'judgment', name: 'Abyssal Judgment', key: 'V', kind: 'active', max: 5, color: '#ff3d7f', desc: 'Cinematic pillar barrage that devastates nearby enemies.', ranks: ['3 waves', 'More damage', '4 waves & larger radius', 'Faster recharge', '5 waves + stagger'] },
  { id: 'awaken', name: 'Abyssal Awakening', key: 'T', kind: 'active', max: 5, color: '#ff9edb', desc: 'Transform into an empowered state. Stronger skills, faster attacks.', ranks: ['Base form', 'Longer duration', 'More damage', 'Energy regeneration', 'Awakened skills hit harder'] },
  { id: 'ironwill', name: 'Iron Will', key: '', kind: 'passive', max: 5, color: '#4ade80', desc: '+4% max HP per rank.', ranks: [] },
  { id: 'keenedge', name: 'Keen Edge', key: '', kind: 'passive', max: 5, color: '#fbbf24', desc: '+2% crit chance per rank.', ranks: [] },
  { id: 'abyssflow', name: 'Abyss Flow', key: '', kind: 'passive', max: 5, color: '#38bdf8', desc: '+1.2 energy regen per rank.', ranks: [] },
  { id: 'mastery', name: 'Blade Mastery', key: '', kind: 'passive', max: 5, color: '#fb7185', desc: '+3% damage per rank.', ranks: [] },
  { id: 'secondwind', name: 'Second Wind', key: '', kind: 'passive', max: 5, color: '#a3e635', desc: 'Heal 1% max HP per rank on kills.', ranks: [] },
];
export const skillNeedLevel = (def: SkillDef, rank: number) => def.kind === 'active' ? [1, 4, 8, 12, 18][rank] ?? 99 : 2 + rank * 3;
export function skillStats(id: string, r: number) {
  r = Math.max(1, r);
  switch (id) {
    case 'burst': return { dmg: 1.4 + 0.35 * r, cost: Math.max(8, 18 - 1.5 * r), cd: Math.max(1.4, 3.6 - 0.3 * r - (r >= 4 ? 0.4 : 0)), pierce: r >= 3, aoe: r >= 5 };
    case 'rift': return { dmg: 2.2 + 0.4 * r, cost: Math.max(10, 24 - 1.5 * r - (r >= 4 ? 3 : 0)), cd: 7 - 0.5 * r, range: 8 + (r >= 2 ? 2 : 0) + 0.5 * r, dbl: r >= 3, pull: r >= 5 };
    case 'judgment': return { dmg: 1.2 + 0.4 * r + (r >= 2 ? 0.3 : 0), cost: 60 - 3 * r, cd: 34 - 2 * r - (r >= 4 ? 4 : 0), radius: 11 + r + (r >= 3 ? 2 : 0), waves: r >= 5 ? 5 : r >= 3 ? 4 : 3 };
    default: return { dur: 0, cost: 0, cd: 0, dmg: 0 };
  }
}
export const TF_STAGES = [
  { name: 'Abyssal Awakening', color: 0x9b5cff, hair: 0xe8e0ff, dmg: 1.4, aspd: 1.2, dur: 22, regen: 6 },
  { name: 'Crimson Sovereign', color: 0xff3355, hair: 0xff4a60, dmg: 1.7, aspd: 1.3, dur: 28, regen: 9 },
  { name: 'Void Ascendant', color: 0xffe9a0, hair: 0xfff3c0, dmg: 2.1, aspd: 1.4, dur: 34, regen: 13 },
];
export const xpToNext = (lvl: number) => Math.floor(70 * Math.pow(lvl, 1.55));
export const MAX_LEVEL = 50;

// ── Enemies ──
export type AtkKind = 'melee' | 'slam' | 'smash' | 'dash' | 'leap' | 'shoot' | 'rain' | 'wave' | 'summon' | 'blink' | 'beam';
export interface Atk { name: string; kind: AtkKind; min: number; max: number; wind: number; act: number; rec: number; dmg: number; r: number; arc: number; weight: number; phase: number; anim: string; col: number; count: number; spread: number; speed: number; knock: boolean; status?: string; summon?: string[]; off?: number }
const A = (o: Partial<Atk> & { name: string; kind: AtkKind }): Atk => ({ min: 0, max: 3, wind: .6, act: .2, rec: .7, dmg: 1, r: 2.5, arc: 90, weight: 1, phase: 0, anim: 'slashR', col: 0xff3030, count: 1, spread: 0, speed: 12, knock: false, ...o });
export interface EDef {
  id: string; name: string; title?: string; tier: 'minion' | 'elite' | 'boss' | 'dummy'; look: any; hp: number; dmg: number; speed: number; detect: number;
  radius: number; height: number; armor: number; res: Partial<Record<Element, number>>; el: Element; xp: number; gold: number; poise: number;
  fly?: number; pref: number; attacks: Atk[]; mat?: [string, number]; dodge?: number; flee?: boolean; bossKey?: string; phases?: number[];
}
const E = (o: Partial<EDef> & { id: string; name: string; look: any; attacks: Atk[] }): EDef => ({ tier: 'minion', hp: 60, dmg: 8, speed: 3.4, detect: 16, radius: .6, height: 1.8, armor: 0, res: {}, el: 'none', xp: 12, gold: 6, poise: 30, pref: 2, ...o });

const jab = A({ name: 'Stab', kind: 'melee', max: 2.6, wind: .55, act: .15, rec: .7, r: 2.4, arc: 80, anim: 'jabR' });
const shootB = (c: number, dm = .8, sp = 13) => A({ name: 'Bolt', kind: 'shoot', min: 5, max: 20, wind: .8, act: .1, rec: 1.0, dmg: dm, speed: sp, col: c, anim: 'cast' });

export const ENEMIES: Record<string, EDef> = {};
const reg = (d: EDef) => { ENEMIES[d.id] = d; };
reg(E({ id: 'dummy', name: 'Training Dummy', tier: 'dummy', look: { m: 'h', scale: 1, skin: 0xb98a55, cloth: 0x8a5a2b, head: 'dummy', weapon: 'none' }, hp: 500, dmg: 0, poise: 9999, xp: 4, gold: 0, attacks: [], speed: 0, detect: 0 }));
reg(E({ id: 'goblin', name: 'Goblin Warrior', look: { m: 'h', scale: .72, skin: 0x7bbf4a, cloth: 0x6b4a2a, cloth2: 0x3a2a18, head: 'goblin', weapon: 'dagger', eye: 0xffe14a }, hp: 55, dmg: 7, speed: 4.4, xp: 10, gold: 5, dodge: .25, flee: true, pref: 1.8, mat: ['iron_ore', .12],
  attacks: [jab, A({ name: 'Lunge', kind: 'dash', min: 3, max: 7, wind: .7, act: .3, rec: .9, dmg: 1.2, r: 6, speed: 14, anim: 'thrust' })] }));
reg(E({ id: 'goblin_archer', name: 'Goblin Archer', look: { m: 'h', scale: .72, skin: 0x8acb55, cloth: 0x3d5a2a, head: 'goblin', weapon: 'bow', eye: 0xffe14a }, hp: 40, dmg: 7, speed: 3.6, xp: 12, gold: 6, pref: 9, flee: true, attacks: [shootB(0xffd35a, 1, 15)] }));
reg(E({ id: 'forest_wolf', name: 'Dire Wolf', look: { m: 'q', scale: .9, body: 0x6b6f78, accent: 0xb8bcc8, eye: 0xffd24a }, hp: 70, dmg: 9, speed: 5.4, xp: 14, gold: 6, dodge: .3, pref: 2, radius: .8, height: 1.2,
  attacks: [A({ name: 'Bite', kind: 'melee', max: 2.6, wind: .45, act: .15, rec: .7, r: 2.4, arc: 80, anim: 'lunge' }), A({ name: 'Pounce', kind: 'leap', min: 4, max: 9, wind: .7, act: .45, rec: 1, dmg: 1.3, r: 2.4, anim: 'lunge' })] }));
reg(E({ id: 'ogre', name: 'Giant Ogre', tier: 'elite', look: { m: 'h', scale: 1.7, bulk: 1.5, skin: 0x8a9a5a, cloth: 0x5a3d28, cloth2: 0x2d2018, head: 'ogre', weapon: 'club', eye: 0xff5a3a }, hp: 360, dmg: 16, speed: 2.7, radius: 1.1, height: 3.2, xp: 60, gold: 40, poise: 90, pref: 3, armor: 4, mat: ['iron_ore', .5],
  attacks: [A({ name: 'Club Smash', kind: 'smash', max: 4.5, wind: 1.0, act: .2, rec: 1.1, dmg: 1.4, r: 2.6, off: 2.8, anim: 'overhead' }), A({ name: 'Ground Pound', kind: 'slam', max: 5, wind: 1.1, act: .2, rec: 1.2, dmg: 1.2, r: 5, anim: 'slam', weight: .6, knock: true })] }));
reg(E({ id: 'poison_slime', name: 'Venom Slime', look: { m: 'b', scale: 1, body: 0x6ee04a, core: 0xd8ff6a }, hp: 65, dmg: 7, speed: 2.6, xp: 12, gold: 5, el: 'poison', res: { poison: .2 }, radius: .8, height: 1.2, pref: 2, mat: ['herb', .3],
  attacks: [A({ name: 'Splash', kind: 'melee', max: 2.4, wind: .6, act: .15, rec: .8, r: 2.4, arc: 140, anim: 'lunge', status: 'poison' }), A({ name: 'Venom Spit', kind: 'shoot', min: 4, max: 14, wind: .8, act: .1, rec: 1.1, dmg: .7, speed: 10, col: 0x8aff4a, anim: 'lunge', status: 'poison' })] }));
// Catacombs
reg(E({ id: 'skeleton', name: 'Skeleton Knight', look: { m: 'h', scale: 1, skin: 0xe6e0c8, cloth: 0x5a5a66, cloth2: 0x33333c, head: 'skull', weapon: 'sword', shield: true, eye: 0x7affd0 }, hp: 85, dmg: 9, speed: 3.2, xp: 16, gold: 8, el: 'shadow', res: { shadow: .5, fire: -.3 }, armor: 3, pref: 2.2, mat: ['bone_dust', .35],
  attacks: [A({ name: 'Slash', kind: 'melee', max: 2.9, wind: .6, act: .15, rec: .8, r: 2.8, arc: 100, anim: 'slashR' }), A({ name: 'Shield Bash', kind: 'melee', max: 2.4, wind: .5, act: .15, rec: .9, r: 2.3, arc: 70, anim: 'jabL', knock: true, dmg: .8 })] }));
reg(E({ id: 'skeleton_archer', name: 'Bone Archer', look: { m: 'h', scale: 1, skin: 0xe6e0c8, cloth: 0x4a3a2a, head: 'skull', weapon: 'bow', eye: 0x7affd0 }, hp: 55, dmg: 8, speed: 3.2, xp: 16, gold: 8, el: 'shadow', res: { shadow: .5 }, pref: 10, mat: ['bone_dust', .3], attacks: [shootB(0xe0f0c0, 1, 16)] }));
reg(E({ id: 'bone_bat', name: 'Crypt Bat', look: { m: 'f', scale: .8, body: 0x3a3048, accent: 0xb06aff, eye: 0xff4a4a, wings: 1 }, hp: 36, dmg: 6, speed: 5.6, fly: 2.6, xp: 11, gold: 4, radius: .5, height: 1, dodge: .3, pref: 3,
  attacks: [A({ name: 'Swoop', kind: 'dash', min: 3, max: 10, wind: .6, act: .4, rec: 1.0, dmg: 1, r: 8, speed: 16, anim: 'lunge' })] }));
reg(E({ id: 'crypt_guardian', name: 'Crypt Guardian', tier: 'elite', look: { m: 'h', scale: 1.5, bulk: 1.4, skin: 0xcfc8b0, cloth: 0x4a4a58, cloth2: 0x222230, head: 'helm', weapon: 'greatsword', shield: true, eye: 0x7affd0, glow: 0x3affb0 }, hp: 420, dmg: 15, speed: 2.9, radius: .95, height: 2.8, xp: 80, gold: 60, poise: 100, armor: 8, el: 'shadow', res: { shadow: .5, fire: -.3 }, pref: 3, mat: ['bone_dust', 1],
  attacks: [A({ name: 'Cleave', kind: 'melee', max: 4.2, wind: .9, act: .2, rec: 1, dmg: 1.3, r: 4.2, arc: 140, anim: 'slashR' }), A({ name: 'Crushing Blow', kind: 'smash', max: 5, wind: 1.2, act: .2, rec: 1.2, dmg: 1.6, r: 2.8, off: 3.2, anim: 'overhead', knock: true }), A({ name: 'Bone Volley', kind: 'shoot', min: 5, max: 16, wind: 1, act: .1, rec: 1.2, dmg: .7, count: 3, spread: 40, col: 0xcfffe0, anim: 'cast' })] }));
// Flame
reg(E({ id: 'fire_hound', name: 'Cinder Hound', look: { m: 'q', scale: .95, body: 0x3a1a14, accent: 0xff6a1a, glow: 0xff5a10, mane: 1, eye: 0xffd24a }, hp: 90, dmg: 11, speed: 5.8, xp: 20, gold: 10, el: 'fire', res: { fire: .6, ice: -.4 }, dodge: .3, radius: .8, height: 1.3, pref: 2,
  attacks: [A({ name: 'Flame Bite', kind: 'melee', max: 2.6, wind: .45, act: .15, rec: .7, r: 2.5, arc: 80, anim: 'lunge', status: 'burn' }), A({ name: 'Blazing Pounce', kind: 'leap', min: 4, max: 10, wind: .7, act: .45, rec: 1, dmg: 1.3, r: 2.6, anim: 'lunge', status: 'burn' })] }));
reg(E({ id: 'fire_imp', name: 'Ember Imp', look: { m: 'f', scale: .8, body: 0x7a1f10, accent: 0xff8a1a, glow: 0xff5a10, eye: 0xffee55, wings: 1 }, hp: 50, dmg: 9, speed: 4.4, fly: 3, xp: 18, gold: 8, el: 'fire', res: { fire: .6, ice: -.4 }, radius: .5, height: 1, pref: 9, mat: ['ember_core', .12],
  attacks: [shootB(0xff7a1a, 1, 13)] }));
reg(E({ id: 'magma_brute', name: 'Magma Brute', look: { m: 'h', scale: 1.8, bulk: 1.6, skin: 0x4a2a22, cloth: 0x2a1a16, head: 'ogre', weapon: 'club', eye: 0xffaa22, glow: 0xff5510 }, hp: 420, dmg: 18, speed: 2.8, radius: 1.1, height: 3.3, tier: 'elite', xp: 85, gold: 55, poise: 100, el: 'fire', res: { fire: .7, ice: -.5 }, pref: 3, mat: ['ember_core', .7],
  attacks: [A({ name: 'Magma Smash', kind: 'smash', max: 4.5, wind: 1, act: .2, rec: 1.1, dmg: 1.5, r: 2.8, off: 2.8, anim: 'overhead', status: 'burn' }), A({ name: 'Lava Burst', kind: 'rain', min: 3, max: 14, wind: 1.2, act: .2, rec: 1.2, dmg: 1, r: 2.3, count: 4, anim: 'slam', col: 0xff6a10 })] }));
reg(E({ id: 'lava_guardian', name: 'Lava Guardian', tier: 'elite', look: { m: 'h', scale: 1.7, bulk: 1.5, skin: 0x333038, cloth: 0x2a2630, head: 'helm', weapon: 'axe', shield: true, eye: 0xff8a1a, glow: 0xff5a10 }, hp: 520, dmg: 19, speed: 3, radius: 1, height: 3, xp: 100, gold: 70, poise: 110, armor: 10, el: 'fire', res: { fire: .8, ice: -.5 }, pref: 3, mat: ['ember_core', 1.2],
  attacks: [A({ name: 'Axe Arc', kind: 'melee', max: 4.2, wind: .85, act: .2, rec: 1, dmg: 1.3, r: 4.2, arc: 150, anim: 'slashR' }), A({ name: 'Charge', kind: 'dash', min: 5, max: 12, wind: .9, act: .5, rec: 1.2, dmg: 1.5, r: 10, speed: 16, anim: 'thrust', knock: true }), A({ name: 'Flame Fan', kind: 'shoot', min: 5, max: 16, wind: 1, act: .1, rec: 1.2, dmg: .7, count: 5, spread: 70, col: 0xff7a1a, anim: 'cast' })] }));
// Frozen
reg(E({ id: 'frost_wolf', name: 'Rime Wolf', look: { m: 'q', scale: 1, body: 0xaac8e0, accent: 0xeaf6ff, glow: 0x4aa8ff, spikes: 1, eye: 0x6affff }, hp: 100, dmg: 12, speed: 5.8, xp: 24, gold: 12, el: 'ice', res: { ice: .6, fire: -.4 }, dodge: .35, radius: .85, height: 1.3, pref: 2,
  attacks: [A({ name: 'Frost Bite', kind: 'melee', max: 2.6, wind: .45, act: .15, rec: .7, r: 2.5, arc: 80, anim: 'lunge', status: 'slow' }), A({ name: 'Rime Pounce', kind: 'leap', min: 4, max: 10, wind: .65, act: .45, rec: 1, dmg: 1.3, r: 2.6, anim: 'lunge' })] }));
reg(E({ id: 'ice_wraith', name: 'Ice Wraith', look: { m: 'f', scale: 1, body: 0x9ad8ff, accent: 0xe8faff, glow: 0x4ab8ff, eye: 0xffffff, tentacles: 4 }, hp: 70, dmg: 11, speed: 3.8, fly: 2.6, xp: 24, gold: 12, el: 'ice', res: { ice: .6, fire: -.4 }, radius: .6, height: 1.6, pref: 10, mat: ['frost_shard', .2],
  attacks: [shootB(0x8ae0ff, 1, 12), A({ name: 'Frost Nova', kind: 'slam', min: 0, max: 4, wind: .9, act: .2, rec: 1, dmg: 1, r: 4, anim: 'cast', col: 0x8ae0ff, status: 'slow' })] }));
reg(E({ id: 'frost_brute', name: 'Frost Brute', tier: 'elite', look: { m: 'h', scale: 1.8, bulk: 1.6, skin: 0x9ac4e0, cloth: 0x4a6a8a, head: 'ogre', weapon: 'club', eye: 0xaaffff, glow: 0x3a9aff, ice: 1 }, hp: 480, dmg: 20, speed: 2.8, radius: 1.1, height: 3.3, xp: 100, gold: 65, poise: 110, el: 'ice', res: { ice: .7, fire: -.5 }, pref: 3, mat: ['frost_shard', .8],
  attacks: [A({ name: 'Glacial Smash', kind: 'smash', max: 4.5, wind: 1, act: .2, rec: 1.1, dmg: 1.5, r: 2.8, off: 2.8, anim: 'overhead', status: 'slow' }), A({ name: 'Frost Quake', kind: 'wave', min: 0, max: 9, wind: 1.1, act: .2, rec: 1.3, dmg: 1.1, r: 12, speed: 9, anim: 'slam', col: 0x8ae0ff, weight: .7 })] }));
reg(E({ id: 'ice_sentinel', name: 'Ice Sentinel', tier: 'elite', look: { m: 'h', scale: 1.7, bulk: 1.4, skin: 0xbfe4ff, cloth: 0x5a86aa, head: 'helm', weapon: 'greatsword', shield: true, eye: 0xffffff, glow: 0x5ab8ff, ice: 1 }, hp: 560, dmg: 21, speed: 3, radius: 1, height: 3, xp: 120, gold: 80, poise: 120, armor: 10, el: 'ice', res: { ice: .8, fire: -.5 }, pref: 3, mat: ['frost_shard', 1.2],
  attacks: [A({ name: 'Rime Cleave', kind: 'melee', max: 4.3, wind: .85, act: .2, rec: 1, dmg: 1.3, r: 4.3, arc: 150, anim: 'slashR' }), A({ name: 'Shard Fan', kind: 'shoot', min: 5, max: 16, wind: 1, act: .1, rec: 1.2, dmg: .7, count: 5, spread: 70, col: 0x9ae8ff, anim: 'cast' }), A({ name: 'Glacier Rain', kind: 'rain', min: 3, max: 14, wind: 1.2, act: .2, rec: 1.2, dmg: 1, r: 2.3, count: 4, anim: 'slam', col: 0x7ad8ff })] }));
// Shadow
reg(E({ id: 'shadow_assassin', name: 'Shadow Assassin', look: { m: 'h', scale: 1, skin: 0x2a2038, cloth: 0x1a1426, cloth2: 0x6a3aa8, head: 'hood', weapon: 'dagger', eye: 0xff3a5a }, hp: 90, dmg: 13, speed: 5.2, xp: 26, gold: 14, el: 'shadow', res: { shadow: .6, fire: -.2 }, dodge: .45, pref: 1.8, mat: ['shadow_essence', .25],
  attacks: [A({ name: 'Backstab', kind: 'blink', min: 4, max: 14, wind: .5, act: .15, rec: .9, dmg: 1.3, r: 2.6, arc: 90, anim: 'jabR' }), A({ name: 'Slash', kind: 'melee', max: 2.6, wind: .4, act: .12, rec: .6, r: 2.4, arc: 100, anim: 'slashL' })] }));
reg(E({ id: 'shadow_wraith', name: 'Shade Wraith', look: { m: 'f', scale: 1, body: 0x1a1030, accent: 0x7a3aff, glow: 0x6a2aff, eye: 0xff3a8a, tentacles: 3 }, hp: 75, dmg: 12, speed: 3.8, fly: 2.4, xp: 26, gold: 14, el: 'shadow', res: { shadow: .6 }, radius: .6, height: 1.6, pref: 10, mat: ['shadow_essence', .3],
  attacks: [shootB(0x9a4aff, 1, 12), A({ name: 'Dark Burst', kind: 'rain', min: 3, max: 14, wind: 1.1, act: .2, rec: 1.2, dmg: 1, r: 2.2, count: 3, anim: 'cast', col: 0x9a4aff })] }));
reg(E({ id: 'shade_knight', name: 'Shade Knight', look: { m: 'h', scale: 1.1, skin: 0x201a30, cloth: 0x2a2040, cloth2: 0x7a4aff, head: 'helm', weapon: 'sword', shield: true, eye: 0xb06aff, glow: 0x7a3aff }, hp: 160, dmg: 14, speed: 3.6, xp: 30, gold: 16, el: 'shadow', res: { shadow: .5 }, armor: 5, pref: 2.4,
  attacks: [A({ name: 'Slash', kind: 'melee', max: 3, wind: .55, act: .15, rec: .7, r: 3, arc: 110, anim: 'slashR' }), A({ name: 'Shade Dash', kind: 'dash', min: 4, max: 10, wind: .7, act: .35, rec: 1, dmg: 1.2, r: 8, speed: 15, anim: 'thrust' })] }));
reg(E({ id: 'umbral_champion', name: 'Umbral Champion', tier: 'elite', look: { m: 'h', scale: 1.6, bulk: 1.3, skin: 0x1a1428, cloth: 0x2a1f40, cloth2: 0x8a4aff, head: 'horned', weapon: 'scythe', eye: 0xff3a8a, glow: 0x8a3aff }, hp: 600, dmg: 23, speed: 3.8, radius: 1, height: 3, xp: 140, gold: 90, poise: 120, armor: 8, el: 'shadow', res: { shadow: .8 }, pref: 3, mat: ['shadow_essence', 1.2],
  attacks: [A({ name: 'Reaping Arc', kind: 'melee', max: 4.8, wind: .8, act: .2, rec: .9, dmg: 1.3, r: 4.8, arc: 180, anim: 'sweep' }), A({ name: 'Phantom Step', kind: 'blink', min: 5, max: 16, wind: .5, act: .15, rec: .9, dmg: 1.4, r: 3.2, arc: 120, anim: 'slashR' }), A({ name: 'Shadow Fan', kind: 'shoot', min: 5, max: 16, wind: 1, act: .1, rec: 1.2, dmg: .7, count: 5, spread: 70, col: 0xa04aff, anim: 'cast' })] }));
// Dragon nest
reg(E({ id: 'whelp', name: 'Dragon Whelp', look: { m: 'q', scale: 1.15, body: 0x7a2a1a, accent: 0xffb04a, glow: 0xff5a10, wings: 1, horns: 1, eye: 0xffee55 }, hp: 160, dmg: 16, speed: 4.8, xp: 36, gold: 18, el: 'fire', res: { fire: .6, ice: -.3 }, radius: .95, height: 1.6, pref: 5, mat: ['dragon_scale', .1],
  attacks: [A({ name: 'Claw', kind: 'melee', max: 3, wind: .5, act: .15, rec: .8, r: 2.9, arc: 90, anim: 'lunge' }), A({ name: 'Fire Breath', kind: 'beam', min: 3, max: 9, wind: .9, act: .8, rec: 1.2, dmg: .3, r: 8, arc: 40, anim: 'cast', col: 0xff7a1a, status: 'burn' })] }));
reg(E({ id: 'dragonkin', name: 'Dragonkin Warrior', look: { m: 'h', scale: 1.2, bulk: 1.15, skin: 0xa0442a, cloth: 0x4a2a22, cloth2: 0xd9a04a, head: 'horned', weapon: 'spear', eye: 0xffee55 }, hp: 200, dmg: 17, speed: 3.8, xp: 40, gold: 20, el: 'fire', res: { fire: .5 }, armor: 6, pref: 3,
  attacks: [A({ name: 'Spear Thrust', kind: 'melee', max: 4.4, wind: .6, act: .15, rec: .8, r: 4.4, arc: 50, anim: 'thrust' }), A({ name: 'Sweeping Strike', kind: 'melee', max: 3.8, wind: .8, act: .2, rec: 1, r: 3.8, arc: 180, anim: 'sweep', dmg: 1.2 })] }));
reg(E({ id: 'drake_knight', name: 'Drake Knight', tier: 'elite', look: { m: 'h', scale: 1.7, bulk: 1.4, skin: 0xa0442a, cloth: 0x5a3a2a, cloth2: 0xffc04a, head: 'horned', weapon: 'greatsword', shield: true, eye: 0xffee55, glow: 0xff6a1a }, hp: 700, dmg: 26, speed: 3.2, radius: 1, height: 3.1, xp: 170, gold: 110, poise: 130, armor: 12, el: 'fire', res: { fire: .8, ice: -.3 }, pref: 3, mat: ['dragon_scale', .8],
  attacks: [A({ name: 'Greatsword Cleave', kind: 'melee', max: 4.5, wind: .9, act: .2, rec: 1, dmg: 1.3, r: 4.5, arc: 150, anim: 'slashR' }), A({ name: 'Wyrm Leap', kind: 'leap', min: 5, max: 13, wind: .9, act: .5, rec: 1.2, dmg: 1.5, r: 3.4, anim: 'overhead', knock: true }), A({ name: 'Fire Fan', kind: 'shoot', min: 5, max: 16, wind: 1, act: .1, rec: 1.2, dmg: .7, count: 5, spread: 70, col: 0xff7a1a, anim: 'cast' })] }));
// Citadel
reg(E({ id: 'abyss_horror', name: 'Abyss Horror', look: { m: 'f', scale: 1.4, body: 0x2a0a20, accent: 0xff2d6f, glow: 0xff2d6f, eye: 0xff2d6f, tentacles: 6, eyes: 1 }, hp: 190, dmg: 19, speed: 3.8, fly: 2.6, xp: 48, gold: 24, el: 'abyss', res: { abyss: .7 }, radius: .8, height: 2, pref: 9, mat: ['abyss_crystal', .08],
  attacks: [shootB(0xff2d6f, 1, 13), A({ name: 'Void Rain', kind: 'rain', min: 3, max: 14, wind: 1.1, act: .2, rec: 1.2, dmg: 1, r: 2.2, count: 4, anim: 'cast', col: 0xff2d6f })] }));
reg(E({ id: 'void_knight', name: 'Void Knight', look: { m: 'h', scale: 1.3, bulk: 1.2, skin: 0x1a0a18, cloth: 0x2a1020, cloth2: 0xff2d6f, head: 'helm', weapon: 'greatsword', shield: false, eye: 0xff2d6f, glow: 0xff2d6f }, hp: 260, dmg: 22, speed: 4, xp: 55, gold: 28, el: 'abyss', res: { abyss: .6 }, armor: 8, pref: 2.8, dodge: .2,
  attacks: [A({ name: 'Void Slash', kind: 'melee', max: 3.8, wind: .6, act: .15, rec: .8, r: 3.8, arc: 120, anim: 'slashR' }), A({ name: 'Rift Step', kind: 'blink', min: 5, max: 14, wind: .5, act: .15, rec: .9, dmg: 1.3, r: 3, arc: 110, anim: 'slashL' })] }));
reg(E({ id: 'abyss_hound', name: 'Abyss Stalker', look: { m: 'q', scale: 1.2, body: 0x1a0a18, accent: 0xff2d6f, glow: 0xff2d6f, spikes: 1, horns: 1, eye: 0xff2d6f }, hp: 220, dmg: 21, speed: 6, xp: 50, gold: 24, el: 'abyss', res: { abyss: .6 }, dodge: .4, radius: .95, height: 1.5, pref: 2,
  attacks: [A({ name: 'Rend', kind: 'melee', max: 2.9, wind: .4, act: .15, rec: .7, r: 2.8, arc: 90, anim: 'lunge' }), A({ name: 'Abyss Pounce', kind: 'leap', min: 4, max: 11, wind: .6, act: .45, rec: 1, dmg: 1.3, r: 2.8, anim: 'lunge' })] }));
reg(E({ id: 'abyss_champion', name: 'Abyss Champion', tier: 'elite', look: { m: 'h', scale: 1.8, bulk: 1.4, skin: 0x1a0a18, cloth: 0x2a1020, cloth2: 0xff2d6f, head: 'horned', weapon: 'greatsword', shield: false, eye: 0xff2d6f, glow: 0xff2d6f }, hp: 900, dmg: 30, speed: 3.6, radius: 1.05, height: 3.3, xp: 220, gold: 140, poise: 150, armor: 14, el: 'abyss', res: { abyss: .8 }, pref: 3, mat: ['abyss_crystal', .6],
  attacks: [A({ name: 'Abyssal Cleave', kind: 'melee', max: 4.6, wind: .85, act: .2, rec: 1, dmg: 1.3, r: 4.6, arc: 160, anim: 'slashR' }), A({ name: 'Rift Step', kind: 'blink', min: 5, max: 16, wind: .5, act: .15, rec: .9, dmg: 1.4, r: 3.2, arc: 120, anim: 'slashR' }), A({ name: 'Void Fan', kind: 'shoot', min: 5, max: 16, wind: 1, act: .1, rec: 1.2, dmg: .7, count: 5, spread: 70, col: 0xff2d6f, anim: 'cast' }), A({ name: 'Abyss Quake', kind: 'wave', min: 0, max: 8, wind: 1.1, act: .2, rec: 1.3, dmg: 1.1, r: 12, speed: 9, anim: 'slam', col: 0xff2d6f, weight: .6 })] }));

// ── Bosses ──
const boss = (o: Partial<EDef> & { id: string; name: string; look: any; attacks: Atk[] }) => reg(E({ tier: 'boss', hp: 1200, dmg: 14, speed: 3.2, detect: 40, poise: 400, phases: [0.66, 0.33], pref: 4, xp: 600, gold: 300, ...o }));
boss({ id: 'bonewarden', name: 'Marrowking Vaelor', title: 'The Bone Warden', bossKey: 'bonewarden', look: { m: 'h', scale: 3, bulk: 1.3, skin: 0xe0d8b8, cloth: 0x4a4a58, cloth2: 0x22222c, head: 'skull', crown: 1, weapon: 'scythe', eye: 0x7affd0, glow: 0x3affb0 }, hp: 1500, dmg: 15, speed: 3.4, radius: 1.5, height: 5.5, armor: 6, el: 'shadow', res: { shadow: .6, fire: -.3 }, mat: ['bone_dust', 5],
  attacks: [A({ name: 'Scythe Sweep', kind: 'melee', max: 6.5, wind: .95, act: .25, rec: 1, dmg: 1.2, r: 6.5, arc: 200, anim: 'sweep' }), A({ name: 'Bone Slam', kind: 'slam', max: 6, wind: 1.1, act: .2, rec: 1.2, dmg: 1.3, r: 5.5, anim: 'slam', knock: true }), A({ name: 'Bone Fan', kind: 'shoot', min: 5, max: 24, wind: 1, act: .1, rec: 1.2, dmg: .65, count: 7, spread: 80, col: 0xd8ffd0, speed: 13, anim: 'cast', weight: 1.2 }), A({ name: 'Grave Leap', kind: 'leap', min: 6, max: 20, wind: 1, act: .6, rec: 1.3, dmg: 1.5, r: 4.5, anim: 'overhead', phase: 1, knock: true }), A({ name: 'Raise the Dead', kind: 'summon', wind: 1.4, act: .1, rec: 1.2, anim: 'roar', phase: 1, summon: ['skeleton', 'skeleton'], weight: .6 }), A({ name: 'Grave Quake', kind: 'wave', wind: 1.2, act: .2, rec: 1.4, dmg: 1.1, r: 18, speed: 10, anim: 'slam', phase: 2, col: 0x8affc0, weight: .9 })] });
boss({ id: 'ashengolem', name: 'The Ashen Golem', title: 'Guardian of the Flame', bossKey: 'ashengolem', look: { m: 'h', scale: 3.6, bulk: 2, skin: 0x3a3436, cloth: 0x2a2426, cloth2: 0x1a1618, head: 'golem', weapon: 'none', eye: 0xffa030, glow: 0xff5510, cracks: 0xff6a10 }, hp: 2400, dmg: 20, speed: 2.8, radius: 1.9, height: 6.6, armor: 12, el: 'fire', res: { fire: .9, ice: -.5 }, mat: ['ember_core', 6],
  attacks: [A({ name: 'Fist Smash', kind: 'smash', max: 7, wind: 1.1, act: .2, rec: 1.2, dmg: 1.4, r: 3.8, off: 4.2, anim: 'overhead', knock: true }), A({ name: 'Lava Rain', kind: 'rain', min: 3, max: 30, wind: 1.4, act: .2, rec: 1.3, dmg: 1, r: 2.6, count: 6, anim: 'cast', col: 0xff6a10, weight: 1.2 }), A({ name: 'Ashen Charge', kind: 'dash', min: 7, max: 22, wind: 1.1, act: .7, rec: 1.4, dmg: 1.5, r: 16, speed: 17, anim: 'slam', knock: true }), A({ name: 'Magma Quake', kind: 'wave', wind: 1.2, act: .2, rec: 1.4, dmg: 1.2, r: 18, speed: 10, anim: 'slam', col: 0xff6a10 }), A({ name: 'Cinder Nova', kind: 'slam', max: 8, wind: 1.2, act: .2, rec: 1.2, dmg: 1.3, r: 7, anim: 'roar', phase: 1, status: 'burn' }), A({ name: 'Summon Imps', kind: 'summon', wind: 1.4, act: .1, rec: 1.2, anim: 'roar', phase: 1, summon: ['fire_imp', 'fire_imp', 'fire_hound'], weight: .5 })] });
boss({ id: 'frostfang', name: 'Frostfang', title: 'Sovereign of the Frozen Kingdom', bossKey: 'frostfang', look: { m: 'q', scale: 3.6, body: 0xaac8e0, accent: 0xf0faff, glow: 0x4aa8ff, spikes: 1, horns: 1, eye: 0x6affff }, hp: 3200, dmg: 24, speed: 4.6, radius: 2, height: 3.8, armor: 10, el: 'ice', res: { ice: .9, fire: -.5 }, mat: ['frost_shard', 7],
  attacks: [A({ name: 'Rending Bite', kind: 'melee', max: 6, wind: .65, act: .2, rec: .9, dmg: 1.2, r: 5.5, arc: 100, anim: 'lunge', status: 'slow' }), A({ name: 'Glacial Pounce', kind: 'leap', min: 6, max: 22, wind: .9, act: .5, rec: 1.2, dmg: 1.4, r: 4.2, anim: 'lunge', knock: true }), A({ name: 'Ice Shard Fan', kind: 'shoot', min: 5, max: 26, wind: 1, act: .1, rec: 1.1, dmg: .65, count: 7, spread: 90, col: 0x9ae8ff, speed: 14, anim: 'cast' }), A({ name: 'Rime Charge', kind: 'dash', min: 7, max: 22, wind: .9, act: .7, rec: 1.3, dmg: 1.4, r: 18, speed: 20, anim: 'lunge', phase: 0, knock: true }), A({ name: 'Frost Quake', kind: 'wave', wind: 1.1, act: .2, rec: 1.3, dmg: 1.1, r: 18, speed: 11, anim: 'roar', col: 0x8ae0ff, phase: 1 }), A({ name: 'Howl of the Pack', kind: 'summon', wind: 1.4, act: .1, rec: 1.2, anim: 'roar', phase: 1, summon: ['frost_wolf', 'frost_wolf'], weight: .5 }), A({ name: 'Blizzard', kind: 'rain', min: 3, max: 30, wind: 1.3, act: .2, rec: 1.2, dmg: 1, r: 2.6, count: 7, anim: 'cast', col: 0x7ad8ff, phase: 2 })] });
boss({ id: 'executioner', name: 'Shadow Executioner', title: 'Warden of the Shadow Temple', bossKey: 'executioner', look: { m: 'h', scale: 3.2, bulk: 1.5, skin: 0x201a30, cloth: 0x1a1426, cloth2: 0x7a3aff, head: 'hood', weapon: 'axe', eye: 0xff3a5a, glow: 0x8a3aff }, hp: 4200, dmg: 28, speed: 4, radius: 1.6, height: 6, armor: 12, el: 'shadow', res: { shadow: .8, fire: -.2 }, mat: ['shadow_essence', 8],
  attacks: [A({ name: 'Headsman Cleave', kind: 'melee', max: 6.5, wind: .9, act: .25, rec: 1, dmg: 1.3, r: 6.5, arc: 170, anim: 'slashR' }), A({ name: 'Execution Leap', kind: 'leap', min: 6, max: 22, wind: 1, act: .55, rec: 1.3, dmg: 1.6, r: 4.5, anim: 'overhead', knock: true }), A({ name: 'Shadow Step', kind: 'blink', min: 6, max: 24, wind: .6, act: .2, rec: 1, dmg: 1.4, r: 5, arc: 140, anim: 'slashL' }), A({ name: 'Dark Bolts', kind: 'shoot', min: 5, max: 26, wind: .9, act: .1, rec: 1.1, dmg: .7, count: 3, spread: 30, col: 0xa04aff, speed: 15, anim: 'cast' }), A({ name: 'Doom Rain', kind: 'rain', min: 3, max: 30, wind: 1.3, act: .2, rec: 1.2, dmg: 1, r: 2.6, count: 6, anim: 'cast', col: 0xa04aff, phase: 1 }), A({ name: 'Summon Shades', kind: 'summon', wind: 1.4, act: .1, rec: 1.2, anim: 'roar', phase: 1, summon: ['shadow_assassin', 'shadow_assassin'], weight: .5 }), A({ name: 'Dread Quake', kind: 'wave', wind: 1.1, act: .2, rec: 1.3, dmg: 1.1, r: 18, speed: 11, anim: 'slam', col: 0xa04aff, phase: 2 })] });
boss({ id: 'dragon', name: 'Infernal Dragon', title: 'Ancient of the Dragon Nest', bossKey: 'dragon', look: { m: 'q', scale: 4.4, body: 0x6a1f14, accent: 0xffb04a, glow: 0xff5a10, wings: 1, horns: 1, neck: 1, dragon: 1, eye: 0xffee55 }, hp: 5600, dmg: 32, speed: 3.6, radius: 2.6, height: 5, armor: 16, el: 'fire', res: { fire: .95, ice: -.4 }, mat: ['dragon_scale', 10],
  attacks: [A({ name: 'Claw Swipe', kind: 'melee', max: 8, wind: .8, act: .2, rec: 1, dmg: 1.2, r: 7.5, arc: 120, anim: 'lunge' }), A({ name: 'Tail Whip', kind: 'slam', max: 9, wind: 1, act: .2, rec: 1.1, dmg: 1.2, r: 8, anim: 'lunge', knock: true }), A({ name: 'Inferno Breath', kind: 'beam', min: 5, max: 24, wind: 1.2, act: 1.4, rec: 1.4, dmg: .28, r: 18, arc: 38, anim: 'cast', col: 0xff7a1a, status: 'burn', weight: 1.2 }), A({ name: 'Dragon Leap', kind: 'leap', min: 7, max: 22, wind: 1.1, act: .6, rec: 1.3, dmg: 1.6, r: 5.5, anim: 'overhead', knock: true }), A({ name: 'Meteor Rain', kind: 'rain', min: 3, max: 30, wind: 1.4, act: .2, rec: 1.3, dmg: 1, r: 3, count: 7, anim: 'roar', col: 0xff5a10, phase: 1 }), A({ name: 'Fireball Fan', kind: 'shoot', min: 6, max: 28, wind: 1, act: .1, rec: 1.1, dmg: .7, count: 7, spread: 90, col: 0xff7a1a, speed: 14, anim: 'cast', phase: 1 }), A({ name: 'Wyrm Brood', kind: 'summon', wind: 1.4, act: .1, rec: 1.2, anim: 'roar', phase: 2, summon: ['whelp', 'whelp'], weight: .5 }), A({ name: 'Scorching Quake', kind: 'wave', wind: 1.2, act: .2, rec: 1.3, dmg: 1.2, r: 20, speed: 11, anim: 'roar', col: 0xff7a1a, phase: 2 })] });
boss({ id: 'abyssking', name: 'The Abyssal King', title: 'Sovereign of the Abyss', bossKey: 'abyssking', look: { m: 'h', scale: 3.4, bulk: 1.4, skin: 0x1a0a18, cloth: 0x2a1020, cloth2: 0xff2d6f, head: 'horned', crown: 1, weapon: 'greatsword', eye: 0xff2d6f, glow: 0xff2d6f, cape: 1 }, hp: 8000, dmg: 36, speed: 4.2, radius: 1.7, height: 6.4, armor: 18, el: 'abyss', res: { abyss: .9 }, mat: ['abyss_crystal', 12], phases: [0.7, 0.4, 0.15],
  attacks: [A({ name: 'Royal Cleave', kind: 'melee', max: 7, wind: .85, act: .25, rec: .9, dmg: 1.3, r: 7, arc: 160, anim: 'slashR' }), A({ name: 'Abyss Smash', kind: 'smash', max: 8, wind: 1.1, act: .2, rec: 1.1, dmg: 1.5, r: 4, off: 4.5, anim: 'overhead', knock: true }), A({ name: 'Rift Step', kind: 'blink', min: 6, max: 24, wind: .55, act: .2, rec: 1, dmg: 1.4, r: 5.5, arc: 140, anim: 'slashL' }), A({ name: 'Void Orbs', kind: 'shoot', min: 5, max: 28, wind: 1, act: .1, rec: 1.1, dmg: .7, count: 7, spread: 90, col: 0xff2d6f, speed: 14, anim: 'cast' }), A({ name: 'Abyss Rain', kind: 'rain', min: 3, max: 30, wind: 1.3, act: .2, rec: 1.2, dmg: 1, r: 2.8, count: 7, anim: 'cast', col: 0xff2d6f, phase: 1 }), A({ name: 'Void Beam', kind: 'beam', min: 5, max: 24, wind: 1.2, act: 1.4, rec: 1.4, dmg: .28, r: 20, arc: 30, anim: 'cast', col: 0xff2d6f, phase: 1 }), A({ name: 'Call of the Void', kind: 'summon', wind: 1.4, act: .1, rec: 1.2, anim: 'roar', phase: 1, summon: ['abyss_horror', 'void_knight'], weight: .5 }), A({ name: 'Abyss Quake', kind: 'wave', wind: 1.1, act: .2, rec: 1.3, dmg: 1.2, r: 22, speed: 12, anim: 'slam', col: 0xff2d6f, phase: 2 }), A({ name: 'Collapse', kind: 'leap', min: 6, max: 24, wind: 1, act: .55, rec: 1.2, dmg: 1.7, r: 6, anim: 'overhead', phase: 2, knock: true })] });

// ── Dungeons ──
export interface DungeonDef {
  id: string; name: string; level: number; boss: string; elite: string; pool: string[]; desc: string; wx: number; wz: number; color: number; seed: number; mat: string;
  theme: { floor: string; wall: string; fog: number; amb: number; torch: number; accent: number; haz?: 'lava' | 'spikes'; decor: string; skyTop?: number };
  music: 'dungeon' | 'boss';
}
export const DUNGEONS: DungeonDef[] = [
  { id: 'catacombs', name: 'Forgotten Catacombs', level: 3, boss: 'bonewarden', elite: 'crypt_guardian', pool: ['skeleton', 'skeleton', 'skeleton_archer', 'bone_bat', 'goblin'], desc: 'An ancient tomb of Aurelith’s fallen guard. Skeleton warriors still hold the halls.', wx: -46, wz: -34, color: 0x7affd0, seed: 11, mat: 'bone_dust', theme: { floor: '#4a4540', wall: '#3a3834', fog: 0x0c0d10, amb: 0.55, torch: 0xffa84a, accent: 0x3affb0, decor: 'sarcophagus' }, music: 'dungeon' },
  { id: 'flame', name: 'Flame Abyss', level: 8, boss: 'ashengolem', elite: 'lava_guardian', pool: ['fire_hound', 'fire_imp', 'magma_brute', 'fire_hound'], desc: 'Volcanic caverns split by rivers of lava, ruled by an ancient fire guardian.', wx: 68, wz: -52, color: 0xff6a10, seed: 23, mat: 'ember_core', theme: { floor: '#3a2a26', wall: '#2a1d1a', fog: 0x1c0a06, amb: 0.6, torch: 0xff7a2a, accent: 0xff5a10, haz: 'lava', decor: 'spike' }, music: 'dungeon' },
  { id: 'frozen', name: 'Frozen Kingdom', level: 13, boss: 'frostfang', elite: 'ice_sentinel', pool: ['frost_wolf', 'ice_wraith', 'frost_brute', 'frost_wolf'], desc: 'Frozen caves and snow-buried ruins under the gaze of an ice sovereign.', wx: -62, wz: 60, color: 0x7fd8ff, seed: 37, mat: 'frost_shard', theme: { floor: '#7a98b0', wall: '#5a7a96', fog: 0x0a1a2a, amb: 0.75, torch: 0x8ad8ff, accent: 0x5ab8ff, decor: 'ice' }, music: 'dungeon' },
  { id: 'shadow', name: 'Shadow Temple', level: 18, boss: 'executioner', elite: 'umbral_champion', pool: ['shadow_assassin', 'shadow_wraith', 'shade_knight', 'shadow_assassin'], desc: 'Dark magical architecture riddled with traps and illusions.', wx: 26, wz: 78, color: 0xa070ff, seed: 41, mat: 'shadow_essence', theme: { floor: '#2a2438', wall: '#1e1a2c', fog: 0x08060e, amb: 0.5, torch: 0xa070ff, accent: 0x8a4aff, haz: 'spikes', decor: 'rune' }, music: 'dungeon' },
  { id: 'dragon', name: 'Ancient Dragon Nest', level: 23, boss: 'dragon', elite: 'drake_knight', pool: ['whelp', 'dragonkin', 'poison_slime', 'whelp'], desc: 'An enormous underground chamber, home to dragons and their hoards.', wx: 88, wz: 44, color: 0xffa04a, seed: 53, mat: 'dragon_scale', theme: { floor: '#4a3a2a', wall: '#35291d', fog: 0x1a0e06, amb: 0.65, torch: 0xffa84a, accent: 0xffa04a, decor: 'bones' }, music: 'dungeon' },
  { id: 'citadel', name: 'Abyssal Citadel', level: 28, boss: 'abyssking', elite: 'abyss_champion', pool: ['abyss_horror', 'void_knight', 'abyss_hound', 'void_knight'], desc: 'The endgame fortress at the heart of the Abyss. The source of the portals.', wx: 0, wz: -96, color: 0xff2d6f, seed: 67, mat: 'abyss_crystal', theme: { floor: '#1e1620', wall: '#150f18', fog: 0x0a0408, amb: 0.5, torch: 0xff2d6f, accent: 0xff2d6f, decor: 'spire' }, music: 'dungeon' },
];
export const DUNGEON_BY_ID: Record<string, DungeonDef> = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));

// ── Quests ──
export interface QObj { k: 'talk' | 'kill' | 'clear' | 'boss' | 'collect' | 'discover' | 'chest' | 'level'; t: string; n: number; text: string }
export interface Quest { id: string; title: string; type: 'main' | 'side'; chapter?: number; giver: string; desc: string; obj: QObj[]; reward: { xp: number; gold: number; mats?: Record<string, number>; gear?: Rarity; unlock?: string }; req?: { quest?: string; level?: number }; next?: string }
export const QUESTS: Quest[] = [
  { id: 'm1', title: 'The Awakening', type: 'main', chapter: 1, giver: 'elder', desc: 'A strange power stirs in your chest. Speak with Elder Maren in Hearthvale.', obj: [{ k: 'talk', t: 'elder', n: 1, text: 'Talk to Elder Maren' }], reward: { xp: 60, gold: 50 }, next: 'm2' },
  { id: 'm2', title: 'Trial of Steel', type: 'main', chapter: 1, giver: 'elder', desc: 'Test your new strength on the training dummies in the yard west of the village.', obj: [{ k: 'kill', t: 'dummy', n: 3, text: 'Defeat training dummies' }], reward: { xp: 120, gold: 80, gear: 'uncommon' }, next: 'm3' },
  { id: 'm3', title: 'Forgotten Catacombs', type: 'main', chapter: 1, giver: 'elder', desc: 'A portal has opened to the northwest. Enter the Forgotten Catacombs and defeat the Bone Warden.', obj: [{ k: 'boss', t: 'bonewarden', n: 1, text: 'Defeat Marrowking Vaelor' }], reward: { xp: 500, gold: 250, gear: 'rare' }, next: 'm4' },
  { id: 'm4', title: 'Embers of the Abyss', type: 'main', chapter: 2, giver: 'elder', desc: 'The Flame Abyss burns in the east. Slay its fire guardian. Your power will evolve.', obj: [{ k: 'boss', t: 'ashengolem', n: 1, text: 'Defeat The Ashen Golem' }], reward: { xp: 1200, gold: 500, gear: 'epic', unlock: 'tf2' }, req: { level: 6 }, next: 'm5' },
  { id: 'm5', title: 'The Frozen Sovereign', type: 'main', chapter: 3, giver: 'elder', desc: 'A winter that never ends has swallowed the southwest. End Frostfang’s reign.', obj: [{ k: 'boss', t: 'frostfang', n: 1, text: 'Defeat Frostfang' }], reward: { xp: 2400, gold: 800, gear: 'epic' }, req: { level: 11 }, next: 'm6' },
  { id: 'm6', title: 'Shadows over the Temple', type: 'main', chapter: 4, giver: 'elder', desc: 'Someone is deliberately opening these gates. The Shadow Temple holds the answer.', obj: [{ k: 'boss', t: 'executioner', n: 1, text: 'Defeat the Shadow Executioner' }], reward: { xp: 4000, gold: 1200, gear: 'epic', unlock: 'tf3' }, req: { level: 16 }, next: 'm7' },
  { id: 'm7', title: 'Wyrm of the Deep', type: 'main', chapter: 5, giver: 'elder', desc: 'The Ancient Dragon Nest has awoken. Its master guards a fragment of the old seal.', obj: [{ k: 'boss', t: 'dragon', n: 1, text: 'Defeat the Infernal Dragon' }], reward: { xp: 7000, gold: 2000, gear: 'legendary' }, req: { level: 21 }, next: 'm8' },
  { id: 'm8', title: 'Rise from the Abyss', type: 'main', chapter: 6, giver: 'elder', desc: 'The Abyssal Citadel has risen in the far north. End this, Awakened.', obj: [{ k: 'boss', t: 'abyssking', n: 1, text: 'Defeat the Abyssal King' }], reward: { xp: 15000, gold: 5000, gear: 'mythic' }, req: { level: 26 } },
  { id: 's1', title: 'Goblin Menace', type: 'side', giver: 'board', desc: 'Goblin raiders harass travelers on the roads. Thin their numbers.', obj: [{ k: 'kill', t: 'goblin', n: 8, text: 'Defeat Goblin Warriors' }], reward: { xp: 150, gold: 100, gear: 'uncommon' } },
  { id: 's2', title: 'Herbalist’s Request', type: 'side', giver: 'board', desc: 'Lyra needs Moonpetal herbs that glow in the fields.', obj: [{ k: 'collect', t: 'herb', n: 5, text: 'Collect Moonpetal Herbs' }], reward: { xp: 90, gold: 60, mats: { hp_potion: 3 } } },
  { id: 's3', title: 'Secrets of the Wilds', type: 'side', giver: 'board', desc: 'Old ruins and hidden caves dot the land. Discover three secrets.', obj: [{ k: 'discover', t: 'secret', n: 3, text: 'Discover secret locations' }], reward: { xp: 400, gold: 200, gear: 'rare' } },
  { id: 's4', title: 'Bone Collector', type: 'side', giver: 'board', desc: 'Clear the restless dead from the Catacombs.', obj: [{ k: 'kill', t: 'skeleton', n: 12, text: 'Defeat Skeleton Knights' }], reward: { xp: 350, gold: 160, mats: { iron_ore: 5 } }, req: { level: 3 } },
  { id: 's5', title: 'Ogre Hunter', type: 'side', giver: 'board', desc: 'Giant ogres lumber across the wilds. Hunt three.', obj: [{ k: 'kill', t: 'ogre', n: 3, text: 'Defeat Giant Ogres' }], reward: { xp: 450, gold: 250, gear: 'rare' }, req: { level: 4 } },
  { id: 's6', title: 'Treasure Hunter', type: 'side', giver: 'board', desc: 'Rumors speak of treasure chests in every corner of Aurelith.', obj: [{ k: 'chest', t: 'chest', n: 6, text: 'Open treasure chests' }], reward: { xp: 500, gold: 300, gear: 'rare' }, req: { level: 3 } },
  { id: 's7', title: 'Blacksmith’s Embers', type: 'side', giver: 'board', desc: 'Torvald needs Ember Cores from the Flame Abyss to forge something special.', obj: [{ k: 'collect', t: 'ember_core', n: 3, text: 'Collect Ember Cores' }], reward: { xp: 900, gold: 400, mats: { iron_ore: 8 } }, req: { level: 8 } },
  { id: 's8', title: 'Portal Scholar', type: 'side', giver: 'board', desc: 'Clear three different dungeons to understand the portals.', obj: [{ k: 'clear', t: '*', n: 3, text: 'Clear dungeons' }], reward: { xp: 2000, gold: 700, gear: 'epic' }, req: { level: 10 } },
];
export const QUEST_BY_ID: Record<string, Quest> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export const ELDER_LINES = [
  'Awakened… so the rumors were true. Three winters ago the sky tore open, and the Abyss began to breathe through the portals. Your Awakening System is the old seal of Aurelith, reborn in you. Prove yourself at the training yard.',
  'Good. Your blade arm is steady. The northwest portal leads to the Catacombs, where Aurelith buried its guardians. Something has woken them. Go — and learn.',
  'The Catacombs fell silent. You have grown, but the Abyss grows faster. The fire guardian in the east keeps the second fragment of the seal. Your power will evolve there.',
  'You wield Crimson Sovereign now. Frost and winter in the southwest — the portals are not random, Awakened. Something is *choosing* where they open.',
  'Shadows speak of a Hollow Prince who walks between portals. The Shadow Temple will tell us more.',
  'The dragon sleeps beneath the eastern mountains. It guards what remains of the seal. Be careful, Awakened.',
  'The Abyssal Citadel has risen at the edge of the world. It is the source. Whatever waits there… it knows your name.',
  'You did it. The portals fall quiet. But the Awakening in you — the seal — it is still warm. The story of Aurelith is not finished… Go forth, free explorer.',
];
export const INTRO_CARDS = [
  'Three winters ago, the sky over Aurelith tore open.\nPortals bloomed across the land, and the ABYSS began to breathe.',
  'You were no hero. Just a guildless adventurer with a rusted blade —\nuntil the stone in your chest awoke.',
  '[ AWAKENING SYSTEM ONLINE ]\nAbyssal Energy detected. Host: Unregistered.',
  'Find the portals. Grow stronger. Learn who is opening the gates.',
];
export const ENDING_CARDS = [
  'The Abyssal King falls, and the Citadel trembles.\nThe portals across Aurelith flicker… and close.',
  'But the Awakening in your chest still glows —\nthe seal of an ancient civilization, now yours to carry.',
  'DUNGEON AWAKENING — To be continued…\nThe world remains open. Hunt, forge and ascend.',
];
export const LORE: string[] = [
  'Aurelith’s Seal: "Seven Keepers bound the Abyss in a vessel of living stone. When the vessel wakes, so does the Awakening."',
  'A cracked tablet: "The gates open not by chance — a Hollow Prince walks between worlds, and he hungers."',
  'A weathered stele: "Flame, Frost, Shadow, Wyrm — four fragments of the seal, each guarded by those who fell to the Abyss."',
  'Hidden inscription: "To the Awakened: do not fear the power. Fear who offers you the key."',
];
