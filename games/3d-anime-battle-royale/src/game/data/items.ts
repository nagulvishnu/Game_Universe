import { ATTACHMENTS, WEAPONS, Rarity, AmmoType, AMMO_NAMES, AMMO_WEIGHT } from './weapons';
import { Rng, pick } from '../util';

export type ItemKind = 'weapon' | 'ammo' | 'armor' | 'helmet' | 'backpack' | 'heal' | 'throw' | 'attach';

export interface ItemDef {
  id: string; name: string; kind: ItemKind; rarity: Rarity; weight: number; level?: number; ref?: string; qty?: [number, number];
}

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#cbd5e0', uncommon: '#4ade80', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24',
};

// Armor: absorption fraction + durability
export const ARMOR_TIERS = [
  { name: 'None', absorb: 0, hp: 0 },
  { name: 'Level 1 Vest', absorb: 0.3, hp: 60 },
  { name: 'Level 2 Vest', absorb: 0.45, hp: 100 },
  { name: 'Level 3 Vest', absorb: 0.62, hp: 150 },
];
export const HELMET_TIERS = [
  { name: 'None', reduce: 0, hp: 0 },
  { name: 'Level 1 Helmet', reduce: 0.25, hp: 40 },
  { name: 'Level 2 Helmet', reduce: 0.45, hp: 70 },
  { name: 'Level 3 Helmet', reduce: 0.65, hp: 100 },
];
export const PACK_TIERS = [
  { name: 'No Backpack', cap: 30 },
  { name: 'Small Backpack', cap: 50 },
  { name: 'Medium Backpack', cap: 75 },
  { name: 'Large Backpack', cap: 110 },
];

export const ITEMS: Record<string, ItemDef> = {};
const add = (d: ItemDef) => { ITEMS[d.id] = d; };

for (const w of Object.values(WEAPONS)) add({ id: 'w_' + w.id, name: w.name, kind: 'weapon', rarity: w.rarity, weight: 0, ref: w.id });
(['light', 'rifle', 'sniper', 'shell'] as AmmoType[]).forEach((t) =>
  add({ id: 'ammo_' + t, name: AMMO_NAMES[t] + ' Ammo', kind: 'ammo', rarity: t === 'sniper' ? 'uncommon' : 'common', weight: AMMO_WEIGHT, ref: t,
    qty: t === 'light' ? [30, 60] : t === 'rifle' ? [30, 60] : t === 'sniper' ? [5, 15] : [6, 14] }));
const rar: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
[1, 2, 3].forEach((l) => {
  add({ id: 'armor_' + l, name: ARMOR_TIERS[l].name, kind: 'armor', rarity: rar[l === 1 ? 0 : l === 2 ? 2 : 4], weight: 0, level: l });
  add({ id: 'helmet_' + l, name: HELMET_TIERS[l].name, kind: 'helmet', rarity: rar[l === 1 ? 0 : l === 2 ? 2 : 3], weight: 0, level: l });
  add({ id: 'pack_' + l, name: PACK_TIERS[l].name, kind: 'backpack', rarity: rar[l === 1 ? 0 : l === 2 ? 2 : 3], weight: 0, level: l });
});
add({ id: 'bandage', name: 'Bandage', kind: 'heal', rarity: 'common', weight: 1, qty: [2, 5] });
add({ id: 'medkit', name: 'Medkit', kind: 'heal', rarity: 'rare', weight: 5, qty: [1, 2] });
add({ id: 'frag', name: 'Frag Grenade', kind: 'throw', rarity: 'uncommon', weight: 3, qty: [1, 3] });
add({ id: 'smoke', name: 'Smoke Grenade', kind: 'throw', rarity: 'common', weight: 2, qty: [1, 2] });
add({ id: 'flash', name: 'Flash Grenade', kind: 'throw', rarity: 'uncommon', weight: 2, qty: [1, 2] });
for (const a of Object.values(ATTACHMENTS)) add({ id: 'att_' + a.id, name: a.name, kind: 'attach', rarity: a.rarity, weight: a.weight, ref: a.id });

const CAT_W: Record<ItemKind, number> = { weapon: 30, ammo: 24, heal: 12, throw: 7, armor: 7, helmet: 6, backpack: 5, attach: 9 };
const RAR_W: Record<Rarity, number> = { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2 };

const byKind: Record<string, ItemDef[]> = {};
Object.values(ITEMS).forEach((d) => (byKind[d.kind] ||= []).push(d));

/** quality ~ 0.6 (poor) .. 2.0 (excellent) skews rarity upwards */
export function rollItem(r: Rng, quality: number, wantKind?: ItemKind): { id: string; qty: number } {
  let kind = wantKind;
  if (!kind) {
    const keys = Object.keys(CAT_W) as ItemKind[];
    let total = 0;
    keys.forEach((k) => (total += CAT_W[k]));
    let x = r() * total;
    kind = keys[0];
    for (const k of keys) { x -= CAT_W[k]; if (x <= 0) { kind = k; break; } }
  }
  const list = byKind[kind];
  const ws = list.map((d) => RAR_W[d.rarity] * Math.pow(quality, RARITY_ORDER.indexOf(d.rarity) * 1.15));
  const tot = ws.reduce((a, b) => a + b, 0);
  let x = r() * tot;
  let item = list[0];
  for (let i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) { item = list[i]; break; } }
  let qty = 1;
  if (item.qty) qty = Math.floor(item.qty[0] + r() * (item.qty[1] - item.qty[0] + 1));
  return { id: item.id, qty };
}

export function randomWeaponId(r: Rng) {
  return pick(r, Object.keys(WEAPONS));
}
