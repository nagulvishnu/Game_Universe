/** SHADOWSTRIKE — Equipment & cosmetics. All items render on the 2D fighter rig. */
import type { Rarity } from './weapons';

export type EquipSlot =
  | 'head' | 'mask' | 'outfit' | 'armor' | 'gloves' | 'boots' | 'back' | 'aura' | 'trail' | 'emote';

export interface EquipmentDef {
  id: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  description: string;
  /** primary tint used when drawing the item on the rig */
  color: number;
  /** secondary / glow tint */
  glow: number;
  /** drawing variant understood by the rig renderer */
  style: string;
  unlock: { level: number; cost: number };
  /** small, bounded, cosmetic-weight modifiers */
  mods?: Partial<{ maxHealth: number; moveSpeed: number; guard: number; cooldown: number }>;
}

const E = (
  id: string, name: string, slot: EquipSlot, rarity: Rarity, style: string,
  color: number, glow: number, description: string, level: number, cost: number,
  mods?: EquipmentDef['mods'],
): EquipmentDef => ({ id, name, slot, rarity, description, color, glow, style, unlock: { level, cost }, mods });

export const EQUIPMENT: EquipmentDef[] = [
  // ----- head (6)
  E('head_none', 'Bare', 'head', 'common', 'none', 0x000000, 0x000000, 'No headgear.', 1, 0),
  E('head_hood', 'Shade Hood', 'head', 'common', 'hood', 0x1a1a24, 0x5a4aff, 'A drawn hood of woven night.', 1, 0),
  E('head_horns', 'Oni Horns', 'head', 'rare', 'horns', 0xe8e0d0, 0xff5a3a, 'Twin horns carved from demon bone.', 5, 1200),
  E('head_crown', 'Void Crown', 'head', 'legendary', 'crown', 0x2a2040, 0xb060ff, 'A crown of condensed darkness.', 18, 6500),
  E('head_halo', 'Astral Halo', 'head', 'epic', 'halo', 0xfff0a0, 0xffd34a, 'A ring of light that never dims.', 12, 3400),
  E('head_topknot', 'Ronin Topknot', 'head', 'uncommon', 'topknot', 0x101018, 0x8899aa, 'The mark of a masterless blade.', 3, 600),

  // ----- mask (5)
  E('mask_none', 'No Mask', 'mask', 'common', 'none', 0x000000, 0x000000, 'Face bare to the arena.', 1, 0),
  E('mask_oni', 'Oni Mask', 'mask', 'rare', 'oni', 0xd04040, 0xffd0d0, 'Crimson demon visage.', 6, 1500),
  E('mask_visor', 'Pulse Visor', 'mask', 'epic', 'visor', 0x202830, 0x66e0ff, 'A scanning hardlight visor.', 10, 2800),
  E('mask_kitsune', 'Kitsune Mask', 'mask', 'legendary', 'kitsune', 0xf0e8e0, 0xff7a9a, 'Nine-tailed fox porcelain.', 16, 5600),
  E('mask_wrap', 'Shadow Wrap', 'mask', 'common', 'wrap', 0x15151c, 0x404050, 'Simple cloth wrap.', 1, 150),

  // ----- outfit (6)
  E('outfit_base', 'Shadow Silhouette', 'outfit', 'common', 'base', 0x0b0b10, 0x6a5aff, 'Pure stickman darkness.', 1, 0),
  E('outfit_gi', 'Training Gi', 'outfit', 'common', 'gi', 0xe6e6ee, 0x9aa4b8, 'Weighted practice garb.', 1, 200),
  E('outfit_ninja', 'Nightrunner Suit', 'outfit', 'uncommon', 'ninja', 0x121622, 0x4a7aff, 'Lightweight infiltration weave.', 4, 800, { moveSpeed: 0.03 }),
  E('outfit_samurai', 'Ronin Haori', 'outfit', 'rare', 'haori', 0x301020, 0xff6a8a, 'A flowing crimson haori.', 8, 2000),
  E('outfit_astral', 'Astral Robes', 'outfit', 'epic', 'robes', 0x201840, 0x9f7bff, 'Robes threaded with starlight.', 13, 3800, { cooldown: 0.04 }),
  E('outfit_void', 'Voidweave', 'outfit', 'mythic', 'void', 0x05050a, 0xb14bff, 'Fabric cut from the space between worlds.', 24, 11000, { cooldown: 0.06 }),

  // ----- armor (5)
  E('armor_none', 'Unarmoured', 'armor', 'common', 'none', 0x000000, 0x000000, 'Maximum mobility.', 1, 0),
  E('armor_light', 'Shade Plate', 'armor', 'uncommon', 'light', 0x2a2f3a, 0x8fa8ff, 'Light chest plating.', 3, 700, { maxHealth: 4 }),
  E('armor_heavy', 'Bulwark Harness', 'armor', 'rare', 'heavy', 0x3a3a44, 0xffc24a, 'Heavy harness that trades speed for durability.', 9, 2200, { maxHealth: 10, moveSpeed: -0.04 }),
  E('armor_spirit', 'Spirit Carapace', 'armor', 'epic', 'spirit', 0x1a2a2a, 0x7fffd0, 'Living carapace grown from spirit coral.', 14, 4200, { maxHealth: 7, guard: 0.05 }),
  E('armor_dragon', 'Dragonbone Rig', 'armor', 'legendary', 'dragon', 0x40281a, 0xff8a3a, 'Plates carved from a dead wyrm.', 20, 7400, { maxHealth: 12 }),

  // ----- gloves (4)
  E('gloves_none', 'Bare Hands', 'gloves', 'common', 'none', 0x000000, 0x000000, 'Nothing between you and the weapon.', 1, 0),
  E('gloves_wraps', 'Combat Wraps', 'gloves', 'common', 'wraps', 0xe0e0e0, 0xaaaaaa, 'Classic knuckle wraps.', 1, 150),
  E('gloves_storm', 'Storm Grips', 'gloves', 'rare', 'storm', 0x303840, 0xffe066, 'Conductive gauntlet grips.', 7, 1700, { guard: 0.04 }),
  E('gloves_void', 'Void Talons', 'gloves', 'epic', 'talons', 0x1a1024, 0xc46bff, 'Clawed gloves of shaped shadow.', 15, 4000),

  // ----- boots (4)
  E('boots_none', 'Barefoot', 'boots', 'common', 'none', 0x000000, 0x000000, 'Feel the arena floor.', 1, 0),
  E('boots_tabi', 'Silent Tabi', 'boots', 'uncommon', 'tabi', 0x15151c, 0x7a8aaa, 'Split-toe boots for soundless steps.', 2, 400, { moveSpeed: 0.03 }),
  E('boots_jet', 'Jet Striders', 'boots', 'epic', 'jet', 0x202830, 0x66e0ff, 'Micro-thrusters in the heel.', 12, 3200, { moveSpeed: 0.06 }),
  E('boots_titan', 'Titan Greaves', 'boots', 'rare', 'titan', 0x3a3a44, 0xffb34a, 'Heavy greaves that anchor your stance.', 10, 2400, { maxHealth: 6, moveSpeed: -0.03 }),

  // ----- back (5)
  E('back_none', 'Nothing', 'back', 'common', 'none', 0x000000, 0x000000, 'Travel light.', 1, 0),
  E('back_cape', 'Tattered Cape', 'back', 'common', 'cape', 0x1a1020, 0x6a4aff, 'A shredded shadow cape.', 1, 250),
  E('back_wings', 'Umbral Wings', 'back', 'legendary', 'wings', 0x100818, 0x9a4aff, 'Wings of folded darkness.', 19, 6800),
  E('back_scarf', 'Windcut Scarf', 'back', 'uncommon', 'scarf', 0xcc3344, 0xff8899, 'A long scarf that streams behind you.', 4, 650),
  E('back_sheath', 'Twin Sheaths', 'back', 'rare', 'sheath', 0x2a2420, 0xaab0c0, 'Crossed scabbards for a duellist.', 8, 1800),

  // ----- aura (6)
  E('aura_none', 'No Aura', 'aura', 'common', 'none', 0x000000, 0x000000, 'Unremarkable presence.', 1, 0),
  E('aura_ember', 'Ember Aura', 'aura', 'uncommon', 'ember', 0xff7a2a, 0xffb060, 'Drifting embers circle you.', 3, 550),
  E('aura_frost', 'Frost Aura', 'aura', 'uncommon', 'frost', 0x9fe8ff, 0xd0f6ff, 'A cold mist clings to your form.', 5, 900),
  E('aura_volt', 'Volt Aura', 'aura', 'rare', 'volt', 0xffe066, 0xfff2a0, 'Arcs of static snap around you.', 9, 2100),
  E('aura_void', 'Void Aura', 'aura', 'epic', 'void', 0x8a2bff, 0xc08bff, 'Reality frays at your edges.', 14, 4400),
  E('aura_celestial', 'Celestial Aura', 'aura', 'mythic', 'celestial', 0xfff0a0, 0xffffff, 'Starlight orbits your silhouette.', 25, 12000),

  // ----- weapon skins / trails (6)
  E('trail_none', 'No Trail', 'trail', 'common', 'none', 0x000000, 0x000000, 'Clean swings.', 1, 0),
  E('trail_white', 'Silver Arc', 'trail', 'common', 'solid', 0xffffff, 0xdfe8ff, 'Classic silver swing trail.', 1, 100),
  E('trail_crimson', 'Crimson Arc', 'trail', 'uncommon', 'solid', 0xff3b55, 0xff8a9a, 'A bloody red weapon trail.', 2, 450),
  E('trail_void', 'Void Arc', 'trail', 'rare', 'ribbon', 0x9a4aff, 0xcf8bff, 'Swings tear thin rifts in the air.', 8, 1900),
  E('trail_flame', 'Flame Arc', 'trail', 'epic', 'flame', 0xff6a1a, 0xffc070, 'Your weapon burns through the air.', 13, 3600),
  E('trail_prism', 'Prism Arc', 'trail', 'legendary', 'prism', 0x66ffff, 0xffffff, 'Refracted light follows every strike.', 21, 8200),

  // ----- emotes / victory poses (5)
  E('emote_bow', 'Respectful Bow', 'emote', 'common', 'bow', 0xffffff, 0xaaaaaa, 'Bow to your defeated opponent.', 1, 0),
  E('emote_sheath', 'Blade Flourish', 'emote', 'uncommon', 'sheath', 0xdfe8ff, 0x9fd8ff, 'Flourish and sheath the weapon.', 3, 500),
  E('emote_roar', 'Victory Roar', 'emote', 'rare', 'roar', 0xff8a3a, 0xffc070, 'Raise both fists and roar.', 7, 1600),
  E('emote_vanish', 'Shadow Vanish', 'emote', 'epic', 'vanish', 0x8a2bff, 0xc08bff, 'Dissolve into shadow as they fall.', 15, 4300),
  E('emote_ascend', 'Ascension', 'emote', 'mythic', 'ascend', 0xfff0a0, 0xffffff, 'Rise on a pillar of light.', 26, 13500),
];

export const EQUIPMENT_BY_ID: Record<string, EquipmentDef> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.id, e]),
);

export const EQUIP_SLOTS: { id: EquipSlot; label: string }[] = [
  { id: 'head', label: 'Headgear' },
  { id: 'mask', label: 'Mask' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'armor', label: 'Armor' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'boots', label: 'Boots' },
  { id: 'back', label: 'Back' },
  { id: 'aura', label: 'Aura' },
  { id: 'trail', label: 'Attack Trail' },
  { id: 'emote', label: 'Victory Pose' },
];

export const DEFAULT_LOADOUT_EQUIPMENT: Record<EquipSlot, string> = {
  head: 'head_hood',
  mask: 'mask_none',
  outfit: 'outfit_base',
  armor: 'armor_none',
  gloves: 'gloves_none',
  boots: 'boots_none',
  back: 'back_none',
  aura: 'aura_none',
  trail: 'trail_white',
  emote: 'emote_bow',
};

export const STARTER_EQUIPMENT = EQUIPMENT.filter((e) => e.unlock.cost === 0).map((e) => e.id);
