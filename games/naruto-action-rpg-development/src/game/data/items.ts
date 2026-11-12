import type { ItemDef } from '../types';

const I = (i: ItemDef): [string, ItemDef] => [i.id, i];
export const ITEMS: Record<string, ItemDef> = Object.fromEntries([
  I({ id: 'ramen', name: 'Ichiraku Miso Ramen', desc: 'Restores 90 HP. Naruto\'s favorite.', icon: '🍜', type: 'consumable', price: 40, rarity: 'common', use: { heal: 90 } }),
  I({ id: 'bigRamen', name: 'Special Pork Ramen', desc: 'Restores 220 HP.', icon: '🍥', type: 'consumable', price: 110, rarity: 'uncommon', use: { heal: 220 } }),
  I({ id: 'soldierPill', name: 'Soldier Pill', desc: 'Restores 60 chakra.', icon: '💊', type: 'consumable', price: 60, rarity: 'common', use: { chakra: 60 } }),
  I({ id: 'chakraPill', name: 'Chakra Pill', desc: 'Restores 130 chakra.', icon: '🟣', type: 'consumable', price: 140, rarity: 'uncommon', use: { chakra: 130 } }),
  I({ id: 'kunai', name: 'Kunai', desc: 'Throwing ninja tool (Z). Quick ranged damage.', icon: '🗡️', type: 'tool', price: 6, rarity: 'common' }),
  I({ id: 'xpScroll', name: 'Technique Scroll', desc: 'Study it to gain 160 XP.', icon: '📜', type: 'scroll', price: 150, rarity: 'uncommon', use: { xp: 160 } }),
  I({ id: 'focusScroll', name: 'Focus Scroll', desc: '+30% jutsu damage for 90 seconds.', icon: '📃', type: 'scroll', price: 180, rarity: 'uncommon', use: { jutsuBuff: 0.3 } }),
  // Equipment
  I({ id: 'academyKunai', name: 'Academy Kunai', desc: 'A standard issue kunai.', icon: '🔪', type: 'weapon', price: 0, rarity: 'common', stats: { atk: 2 } }),
  I({ id: 'steelKunai', name: 'Steel Fang Kunai', desc: 'Balanced steel kunai.', icon: '🔪', type: 'weapon', price: 320, rarity: 'uncommon', stats: { atk: 5 } }),
  I({ id: 'chakraBlade', name: 'Chakra Blade', desc: 'Conducts chakra. +attack and +chakra.', icon: '🗡️', type: 'weapon', price: 900, rarity: 'rare', stats: { atk: 9, chakra: 15 } }),
  I({ id: 'kubikiriShard', name: 'Executioner Blade Shard', desc: 'A fragment of Zabuza\'s legendary sword.', icon: '⚔️', type: 'weapon', price: 0, rarity: 'epic', stats: { atk: 15, hp: 25 } }),
  I({ id: 'academyOutfit', name: 'Academy Outfit', desc: 'Plain training clothes.', icon: '👕', type: 'armor', price: 0, rarity: 'common', stats: { def: 1 } }),
  I({ id: 'chuninVest', name: 'Flak Jacket', desc: 'Standard chunin vest.', icon: '🦺', type: 'armor', price: 450, rarity: 'uncommon', stats: { def: 5, hp: 30 } }),
  I({ id: 'anbuArmor', name: 'ANBU Armor', desc: 'Elite black-ops armor.', icon: '🥋', type: 'armor', price: 1400, rarity: 'rare', stats: { def: 10, hp: 70, speed: 0.3 } }),
  I({ id: 'leafHeadband', name: 'Leaf Headband', desc: 'Symbol of a Konoha ninja.', icon: '🎗️', type: 'accessory', price: 0, rarity: 'common', stats: { def: 1, chakra: 10 } }),
  I({ id: 'toadCharm', name: 'Toad Wallet Charm', desc: 'Earn +20% ryo.', icon: '🐸', type: 'accessory', price: 380, rarity: 'uncommon', stats: { ryo: 0.2 } }),
  I({ id: 'sagePendant', name: 'Sage Pendant', desc: '+25% chakra regeneration.', icon: '📿', type: 'accessory', price: 800, rarity: 'rare', stats: { regen: 0.25, chakra: 15 } }),
  I({ id: 'sandGourdCharm', name: 'Sand Gourd Charm', desc: 'A charm of sand. +8 def, +40 HP.', icon: '🏺', type: 'accessory', price: 0, rarity: 'epic', stats: { def: 8, hp: 40 } }),
  I({ id: 'akatsukiPendant', name: 'Cloud Pendant', desc: 'Taken from an Akatsuki operative. +4 attack, +25 chakra.', icon: '☁️', type: 'accessory', price: 0, rarity: 'epic', stats: { atk: 4, chakra: 25 } }),
  // Materials / collectibles
  I({ id: 'ironScrap', name: 'Iron Scrap', desc: 'Used to upgrade equipment.', icon: '🔩', type: 'material', price: 20, rarity: 'common' }),
  I({ id: 'chakraCrystal', name: 'Chakra Crystal', desc: 'Used to upgrade equipment.', icon: '💎', type: 'material', price: 90, rarity: 'rare' }),
  I({ id: 'leafScrollItem', name: 'Hidden Leaf Scroll', desc: 'A secret scroll hidden around the world.', icon: '📜', type: 'collectible', price: 100, rarity: 'uncommon' }),
  I({ id: 'ramenCoupon', name: 'Ramen Coupon', desc: 'Free bowls at Ichiraku. Sell it or keep it!', icon: '🎟️', type: 'collectible', price: 70, rarity: 'common' }),
]);
export const SHOP_TOOLS = ['ramen', 'bigRamen', 'soldierPill', 'chakraPill', 'kunai', 'focusScroll', 'steelKunai', 'chakraBlade', 'chuninVest', 'anbuArmor', 'toadCharm', 'sagePendant', 'ironScrap'];
export const SHOP_RAMEN = ['ramen', 'bigRamen', 'soldierPill', 'chakraPill'];
export const getItem = (id: string): ItemDef | undefined => ITEMS[id];
export const EQUIP_SLOTS = ['weapon', 'armor', 'accessory'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];
export const slotOf = (id: string): EquipSlot | null => {
  const t = ITEMS[id]?.type;
  return t === 'weapon' || t === 'armor' || t === 'accessory' ? t : null;
};
/** Cost to upgrade an item from its current upgrade level. */
export const upgradeCost = (level: number) => ({ ryo: 150 * (level + 1), scrap: 2 + level * 2, crystal: level >= 1 ? level : 0 });
export const MAX_UPGRADE = 5;
