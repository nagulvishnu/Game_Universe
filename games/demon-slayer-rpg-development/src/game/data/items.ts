export type ItemCat = 'consumable' | 'material' | 'collectible' | 'quest';
export interface ItemDef { id: string; name: string; cat: ItemCat; desc: string; icon: string; price: number; use?: 'heal' | 'sta' | 'breath' | 'ult' | 'guard' | 'regen' }

export const ITEMS: Record<string, ItemDef> = {
  rice_ball: { id: 'rice_ball', name: 'Rice Ball', cat: 'consumable', desc: 'Restores 35% health.', icon: '🍙', price: 40, use: 'heal' },
  herb: { id: 'herb', name: 'Medicinal Herb', cat: 'consumable', desc: 'Restores 70% health.', icon: '🌿', price: 110, use: 'heal' },
  tonic: { id: 'tonic', name: 'Stamina Tonic', cat: 'consumable', desc: 'Refills stamina and boosts regeneration for 30s.', icon: '🍶', price: 70, use: 'regen' },
  elixir: { id: 'elixir', name: 'Breath Elixir', cat: 'consumable', desc: 'Refills the breathing gauge.', icon: '💨', price: 90, use: 'breath' },
  incense: { id: 'incense', name: 'Wisteria Incense', cat: 'consumable', desc: 'Reduces damage taken by 30% for 60s.', icon: '🪷', price: 120, use: 'guard' },
  charm_ult: { id: 'charm_ult', name: 'Hanafuda Charm', cat: 'consumable', desc: 'Adds 50% to the ultimate gauge.', icon: '🎴', price: 150, use: 'ult' },
  steel_shard: { id: 'steel_shard', name: 'Steel Shard', cat: 'material', desc: 'Sword upgrade material.', icon: '🔩', price: 60 },
  whetstone: { id: 'whetstone', name: 'Whetstone', cat: 'material', desc: 'Fine stone used by swordsmiths.', icon: '🪨', price: 90 },
  scarlet_ore: { id: 'scarlet_ore', name: 'Scarlet Iron Sand', cat: 'material', desc: 'Rare ore that forges Nichirin blades.', icon: '🔴', price: 300 },
  wisteria: { id: 'wisteria', name: 'Wisteria Flower', cat: 'collectible', desc: 'Demons detest its scent.', icon: '💜', price: 20 },
  feather: { id: 'feather', name: 'Crow Feather', cat: 'collectible', desc: 'Dropped by a Kasugai Crow.', icon: '🪶', price: 15 },
  silk: { id: 'silk', name: 'Spider Silk', cat: 'collectible', desc: 'Strong, bloody thread.', icon: '🕸️', price: 30 },
  scroll: { id: 'scroll', name: 'Corps Scroll', cat: 'collectible', desc: 'Ancient breathing notes.', icon: '📜', price: 50 },
  ema: { id: 'ema', name: 'Ema Plaque', cat: 'collectible', desc: 'A shrine wish plaque.', icon: '🪧', price: 25 },
  clue: { id: 'clue', name: 'Investigation Clue', cat: 'quest', desc: 'Evidence for a case.', icon: '🔎', price: 0 },
  ore_piece: { id: 'ore_piece', name: 'Ore Piece', cat: 'quest', desc: 'Requested by the swordsmiths.', icon: '⛏️', price: 0 },
};

export interface SwordDef { id: string; name: string; atk: number; color: number; glow: number; crit?: number; breath?: number; burn?: number; poison?: number; steal?: number; desc: string; price: number; guard: number }
export const SWORDS: Record<string, SwordDef> = {
  sw_std: { id: 'sw_std', name: 'Standard Nichirin', atk: 1.0, color: 0, glow: 0, desc: 'Color changes to match its wielder\'s breathing.', price: 0, guard: 0 },
  sw_black: { id: 'sw_black', name: 'Black Nichirin', atk: 1.12, color: 0x1a1a24, glow: 0x6a2a8a, crit: 0.08, desc: 'A rare dark blade. Boosts critical chance.', price: 900, guard: 1 },
  sw_scarlet: { id: 'sw_scarlet', name: 'Scarlet Crimson Blade', atk: 1.2, color: 0xd61f3a, glow: 0xff3a1a, burn: 1, desc: 'Strikes ignite demons.', price: 1600, guard: 2 },
  sw_wisteria: { id: 'sw_wisteria', name: 'Wisteria-Steeped Blade', atk: 1.1, color: 0xb59bff, glow: 0xb36bff, poison: 1, desc: 'Poisons demons on contact.', price: 1300, guard: 3 },
  sw_storm: { id: 'sw_storm', name: 'Stormsteel Blade', atk: 1.18, color: 0xffe14a, glow: 0xffe14a, breath: 0.3, desc: 'Breath regenerates much faster.', price: 1800, guard: 1 },
  sw_sun: { id: 'sw_sun', name: 'Sun-Forged Blade', atk: 1.35, color: 0xff7a2a, glow: 0xffd24a, steal: 0.04, crit: 0.05, desc: 'A legendary blade that heals on hit.', price: 4200, guard: 2 },
};
export const swordMult = (lvl: number) => 1 + lvl * 0.08;
export const upgradeCost = (lvl: number) => ({ sen: 120 * (lvl + 1), steel: lvl + 1, whet: lvl >= 4 ? Math.floor(lvl / 3) : 0 });

export interface EquipDef { id: string; name: string; slot: 'haori' | 'uniform' | 'charm'; stats: Partial<Record<'hp' | 'def' | 'sta' | 'atk' | 'spd' | 'breath' | 'crit', number>>; price: number; desc: string }
export const EQUIPMENT: Record<string, EquipDef> = {
  haori_plain: { id: 'haori_plain', name: 'Plain Haori', slot: 'haori', stats: { hp: 20 }, price: 150, desc: 'Sturdy cloth. +20 HP.' },
  haori_wisteria: { id: 'haori_wisteria', name: 'Wisteria Haori', slot: 'haori', stats: { def: 5, hp: 15 }, price: 600, desc: '+5 DEF, +15 HP.' },
  haori_flame: { id: 'haori_flame', name: 'Flame-Pattern Haori', slot: 'haori', stats: { atk: 4, hp: 30 }, price: 1400, desc: '+4 ATK, +30 HP.' },
  uniform_corps: { id: 'uniform_corps', name: 'Corps Uniform', slot: 'uniform', stats: { def: 4 }, price: 0, desc: '+4 DEF. Standard issue.' },
  uniform_reinf: { id: 'uniform_reinf', name: 'Reinforced Uniform', slot: 'uniform', stats: { def: 10, sta: 10 }, price: 900, desc: '+10 DEF, +10 STA.' },
  uniform_hashira: { id: 'uniform_hashira', name: 'Hashira Uniform', slot: 'uniform', stats: { def: 16, hp: 40, sta: 15 }, price: 2800, desc: '+16 DEF, +40 HP, +15 STA.' },
  charm_wind: { id: 'charm_wind', name: 'Wind Chime Charm', slot: 'charm', stats: { spd: 0.05 }, price: 400, desc: '+5% movement speed.' },
  charm_beads: { id: 'charm_beads', name: 'Breathing Beads', slot: 'charm', stats: { breath: 25 }, price: 700, desc: '+25 max breath.' },
  charm_fang: { id: 'charm_fang', name: 'Demon Fang Charm', slot: 'charm', stats: { crit: 10, atk: 2 }, price: 1100, desc: '+10% crit, +2 ATK.' },
};

export const SHOP = ['rice_ball', 'herb', 'tonic', 'elixir', 'incense', 'charm_ult', 'steel_shard', 'whetstone', 'scarlet_ore',
  'sw_black', 'sw_wisteria', 'sw_storm', 'sw_scarlet', 'sw_sun', 'haori_plain', 'haori_wisteria', 'haori_flame', 'uniform_reinf', 'uniform_hashira', 'charm_wind', 'charm_beads', 'charm_fang'];
