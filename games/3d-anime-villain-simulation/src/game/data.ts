// ───────────── STICKVERSE static game data ─────────────
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'Divine';
export const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine'];
export const RCOL: Record<Rarity, string> = {
  Common: '#9aa3b2', Uncommon: '#4ade80', Rare: '#38bdf8', Epic: '#a855f7', Legendary: '#fbbf24', Mythic: '#fb3b64', Divine: '#fff3b0',
};

export type Cat =
  | 'Shadow' | 'Fire' | 'Ice' | 'Lightning' | 'Wind' | 'Water' | 'Earth' | 'Energy' | 'Gravity' | 'Telekinesis'
  | 'Space-Time' | 'Dark Energy' | 'Martial Arts' | 'Weapon Mastery' | 'Mutation' | 'Unique';
export const CATS: Cat[] = ['Shadow', 'Fire', 'Ice', 'Lightning', 'Wind', 'Water', 'Earth', 'Energy', 'Gravity', 'Telekinesis', 'Space-Time', 'Dark Energy', 'Martial Arts', 'Weapon Mastery', 'Mutation', 'Unique'];
export const CAT_COL: Record<Cat, string> = {
  Shadow: '#7c3aed', Fire: '#ff6a1a', Ice: '#7fe3ff', Lightning: '#ffe94d', Wind: '#9bf5c8', Water: '#2f8cff', Earth: '#b7814a', Energy: '#4df0ff',
  Gravity: '#c04dff', Telekinesis: '#ff7ad9', 'Space-Time': '#6d8bff', 'Dark Energy': '#ff1f6b', 'Martial Arts': '#ffb347', 'Weapon Mastery': '#d6dbe6', Mutation: '#8dff3d', Unique: '#ffffff',
};

export type FxKind = 'bolt' | 'beam' | 'burst' | 'blade' | 'dash' | 'shield' | 'field' | 'summon' | 'rain' | 'pull' | 'push' | 'nova' | 'strike' | 'heal';
export interface Skill {
  id: string; name: string; cat: Cat; fx: FxKind; c1: string; c2: string; dmg: number; range: number; cd: number; cost: number;
  rarity: Rarity; lvl: number; desc: string; ult?: boolean; req?: string;
}
const S = (id: string, name: string, cat: Cat, fx: FxKind, c1: string, c2: string, dmg: number, range: number, cd: number, cost: number, rarity: Rarity, lvl: number, desc: string, ult = false, req?: string): Skill =>
  ({ id, name, cat, fx, c1, c2, dmg, range, cd, cost, rarity, lvl, desc, ult, req });
export const SKILLS: Skill[] = [
  S('shadow_bolt', 'Shadow Bolt', 'Shadow', 'bolt', '#7c3aed', '#1a0033', 28, 60, 1.6, 10, 'Common', 1, 'Hurls a screaming orb of condensed shadow that rips through the target.'),
  S('shadow_blade', 'Shadow Blade', 'Shadow', 'blade', '#a78bfa', '#2e1065', 55, 7, 2.4, 14, 'Uncommon', 2, 'A crescent of living darkness slashes everything in front of you.'),
  S('shadow_dash', 'Shadow Dash', 'Shadow', 'dash', '#6d28d9', '#0f0020', 40, 16, 4, 16, 'Rare', 4, 'Dissolve into shadow and reappear through your enemies, cutting them as you pass.'),
  S('shadow_summon', 'Shadow Legion', 'Shadow', 'summon', '#8b5cf6', '#000', 35, 12, 18, 35, 'Epic', 6, 'Summons shadow clones that fight for you for 12 seconds.'),
  S('shadow_explosion', 'Umbral Detonation', 'Shadow', 'burst', '#9333ea', '#000', 160, 16, 14, 55, 'Epic', 8, 'Collapse shadows around you into a devastating explosion.', true),
  S('energy_blast', 'Energy Blast', 'Energy', 'bolt', '#4df0ff', '#0077ff', 24, 70, 1.2, 8, 'Common', 1, 'A fast ball of raw ki that explodes on contact.'),
  S('energy_beam', 'Concentrated Beam', 'Energy', 'beam', '#7df9ff', '#2b6bff', 70, 55, 5, 28, 'Rare', 3, 'Fires a piercing beam of focused energy through multiple foes.'),
  S('energy_shield', 'Energy Shield', 'Energy', 'shield', '#4df0ff', '#fff', 0, 0, 14, 25, 'Uncommon', 5, 'Wraps you in a barrier that absorbs 80% of damage for 5 seconds.'),
  S('charged_explosion', 'Charged Explosion', 'Energy', 'nova', '#b8fbff', '#1e5cff', 210, 20, 16, 60, 'Legendary', 12, 'Charge your core and release a massive blast.', true),
  S('fireball', 'Fireball', 'Fire', 'bolt', '#ff7a1a', '#ffd23f', 34, 60, 1.8, 11, 'Common', 2, 'A blazing sphere that burns on impact and scatters embers.'),
  S('flame_wave', 'Flame Wave', 'Fire', 'burst', '#ff4d00', '#ffd23f', 85, 13, 6, 24, 'Rare', 6, 'Releases a ring of fire that expands from your body.'),
  S('meteor_rain', 'Meteor Rain', 'Fire', 'rain', '#ff5a1a', '#ffe08a', 120, 28, 18, 58, 'Legendary', 16, 'Call down a barrage of burning meteors on the battlefield.', true),
  S('lightning_strike', 'Lightning Strike', 'Lightning', 'strike', '#fff36b', '#6bc7ff', 75, 45, 3, 20, 'Uncommon', 3, 'Calls a bolt from the sky onto your target.'),
  S('thunder_chain', 'Thunder Chain', 'Lightning', 'beam', '#fff9a8', '#8a5cff', 62, 40, 5, 22, 'Rare', 7, 'Arcing lightning pierces everything in a line.'),
  S('storm_judgement', "Storm's Judgement", 'Lightning', 'rain', '#ffe94d', '#7d3cff', 140, 30, 20, 62, 'Epic', 18, 'A tempest of bolts rains from the heavens.', true),
  S('ice_spear', 'Ice Spear', 'Ice', 'bolt', '#9ef0ff', '#ffffff', 38, 65, 2, 12, 'Uncommon', 3, 'A piercing lance of ice that slows its target.'),
  S('frost_nova', 'Frost Nova', 'Ice', 'burst', '#7fe3ff', '#ffffff', 70, 14, 7, 22, 'Rare', 7, 'Flash-freezes everything around you.'),
  S('absolute_zero', 'Absolute Zero', 'Ice', 'field', '#c8f6ff', '#4aa8ff', 130, 18, 18, 55, 'Epic', 15, 'A freezing domain that damages and immobilizes enemies.', true),
  S('tornado', 'Tornado Attack', 'Wind', 'field', '#9bf5c8', '#ffffff', 90, 14, 9, 26, 'Rare', 5, 'Summons a violent tornado that drags enemies in.'),
  S('wind_slash', 'Wind Slash', 'Wind', 'bolt', '#b5ffe0', '#ffffff', 30, 55, 1.4, 9, 'Common', 2, 'A razor crescent of wind flies forward.'),
  S('cyclone_dash', 'Cyclone Dash', 'Wind', 'dash', '#9bf5c8', '#eafff6', 35, 18, 3.5, 14, 'Uncommon', 4, 'Dash within a spiraling cyclone.'),
  S('water_lance', 'Water Lance', 'Water', 'beam', '#4aa3ff', '#d9f0ff', 58, 50, 4, 20, 'Uncommon', 4, 'High-pressure water pierces armor.'),
  S('tidal_wave', 'Tidal Wave', 'Water', 'push', '#2f8cff', '#bfe6ff', 55, 18, 8, 24, 'Rare', 8, 'A crushing wave sweeps enemies away.'),
  S('aqua_barrier', 'Aqua Barrier', 'Water', 'shield', '#2f8cff', '#bfe6ff', 0, 0, 14, 22, 'Uncommon', 6, 'A swirling bubble of water blocks incoming attacks.'),
  S('ground_eruption', 'Ground Eruption', 'Earth', 'strike', '#c08a4a', '#ff9a3c', 95, 30, 5, 24, 'Rare', 5, 'Ground erupts in a pillar of stone at the target.'),
  S('stone_fist', 'Stone Fist', 'Earth', 'blade', '#b7814a', '#6b4a26', 70, 6, 3, 14, 'Uncommon', 3, 'A hammering fist of rock that sends foes flying.'),
  S('quake', 'World Quake', 'Earth', 'burst', '#b7814a', '#ffd9a0', 170, 22, 15, 56, 'Legendary', 14, 'Shatter the earth itself around you.', true),
  S('gravity_pull', 'Gravity Pull', 'Gravity', 'pull', '#c04dff', '#ffffff', 25, 24, 6, 18, 'Rare', 6, 'Drags nearby enemies to you.'),
  S('gravity_push', 'Gravity Push', 'Gravity', 'push', '#e08bff', '#ffffff', 45, 18, 5, 16, 'Rare', 6, 'Repels everything away with a gravity shockwave.'),
  S('gravity_field', 'Gravity Field', 'Gravity', 'field', '#9d3cff', '#ffffff', 60, 14, 11, 30, 'Epic', 10, 'Creates a zone that suspends and slows enemies.'),
  S('gravity_crush', 'Gravity Crush', 'Gravity', 'nova', '#7a1fff', '#e6c8ff', 230, 18, 18, 62, 'Legendary', 20, 'Crush all enemies under immense gravity.', true),
  S('psychic_throw', 'Psychic Throw', 'Telekinesis', 'bolt', '#ff7ad9', '#ffd1f1', 32, 55, 1.6, 10, 'Uncommon', 4, 'Hurl debris with your mind.'),
  S('mind_crush', 'Mind Crush', 'Telekinesis', 'burst', '#ff4fc7', '#fff', 100, 15, 9, 30, 'Epic', 11, 'Compress the space around your enemies.'),
  S('rift_slash', 'Rift Slash', 'Space-Time', 'blade', '#6d8bff', '#fff', 90, 9, 4, 20, 'Rare', 9, 'Cuts space itself.'),
  S('time_stop', 'Chrono Lock', 'Space-Time', 'field', '#aab8ff', '#fff', 40, 22, 22, 60, 'Mythic', 24, 'Freeze time around you — enemies cannot move.', true),
  S('blink', 'Blink Step', 'Space-Time', 'dash', '#8ea4ff', '#fff', 20, 22, 2.5, 12, 'Uncommon', 7, 'Teleport instantly forward.'),
  S('dark_beam', 'Dark Beam', 'Dark Energy', 'beam', '#ff1f6b', '#220010', 95, 55, 5, 30, 'Epic', 10, 'A beam of annihilating dark energy.'),
  S('void_collapse', 'Void Collapse', 'Dark Energy', 'nova', '#ff1f6b', '#000', 320, 24, 22, 70, 'Mythic', 25, 'Implode the void and consume everything near.', true),
  S('dragon_fist', 'Dragon Fist', 'Martial Arts', 'blade', '#ffb347', '#ff4d00', 80, 6, 3, 12, 'Uncommon', 3, 'A rising dragon-shaped uppercut.'),
  S('hundred_strikes', 'Hundred Strikes', 'Martial Arts', 'dash', '#ffd08a', '#fff', 60, 12, 6, 20, 'Rare', 8, 'A flurry of strikes as you rush through foes.'),
  S('crescent_slash', 'Crescent Slash', 'Weapon Mastery', 'blade', '#e6ebf7', '#8fa5ff', 75, 8, 3, 14, 'Uncommon', 4, 'A huge sweeping arc of your equipped weapon.'),
  S('blade_storm', 'Blade Storm', 'Weapon Mastery', 'burst', '#e6ebf7', '#8fa5ff', 110, 12, 8, 28, 'Epic', 12, 'Spin into a whirlwind of cutting edges.'),
  S('bio_spikes', 'Bio Spikes', 'Mutation', 'burst', '#8dff3d', '#1f5c00', 78, 11, 6, 20, 'Rare', 6, 'Spikes of mutated bone erupt from your body.'),
  S('regeneration', 'Mutant Regeneration', 'Mutation', 'heal', '#8dff3d', '#fff', 0, 0, 20, 30, 'Rare', 9, 'Rapidly regrow tissue, restoring health.'),
  S('soul_harvest', 'Soul Harvest', 'Unique', 'pull', '#ffffff', '#ff1f6b', 80, 20, 9, 25, 'Legendary', 15, 'Rip life from enemies nearby and consume it.', false, 'ragnar'),
  S('dominion', 'Dominion of the Ultimate', 'Unique', 'nova', '#fff3b0', '#ff1f6b', 420, 28, 25, 80, 'Divine', 30, 'The power of a world-ending villain, unleashed.', true, 'zerath'),
];
export const SKILL_MAP: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

// ───────────── Items ─────────────
export type ICat = 'Weapons' | 'Armor' | 'Outfits' | 'Accessories' | 'Consumables' | 'Materials' | 'Valuables' | 'Energy' | 'Artifacts' | 'Transformation';
export const ICATS: ICat[] = ['Weapons', 'Armor', 'Outfits', 'Accessories', 'Consumables', 'Materials', 'Valuables', 'Energy', 'Artifacts', 'Transformation'];
export type WType = 'sword' | 'dual' | 'greatsword' | 'dagger' | 'spear' | 'scythe' | 'energy' | 'special';
export interface Item {
  id: string; name: string; cat: ICat; rarity: Rarity; desc: string; icon: string; color: string; price: number;
  stats?: Record<string, number | string>; effects?: string[]; special?: string;
  wtype?: WType; atk?: number; def?: number; coat?: string; outfit?: string; acc?: string; form?: number; heal?: number; energy?: number; stack?: boolean;
}
const I = (id: string, name: string, cat: ICat, rarity: Rarity, icon: string, color: string, price: number, desc: string, extra: Partial<Item> = {}): Item =>
  ({ id, name, cat, rarity, icon, color, price, desc, ...extra });
const W = (id: string, name: string, wtype: WType, rarity: Rarity, atk: number, speed: number, range: number, color: string, price: number, desc: string, special?: string): Item =>
  I(id, name, 'Weapons', rarity, wtype, color, price, desc, { wtype, atk, special, stats: { Attack: atk, Speed: speed, Range: range }, effects: special ? [special] : [] });
export const ITEMS: Item[] = [
  W('knife', 'Street Knife', 'dagger', 'Common', 9, 1.6, 1.6, '#c8ced8', 80, 'A chipped blade from a back-alley pawn shop.'),
  W('katana', 'Steel Katana', 'sword', 'Uncommon', 18, 1.2, 2.4, '#dbe4ff', 900, 'Folded steel with an edge that sings.'),
  W('fangs', 'Twin Fang Blades', 'dual', 'Rare', 15, 1.7, 2.0, '#ff5d7a', 2600, 'Two serrated blades wielded as one.', 'Bleed: attacks add bleeding damage'),
  W('ironbreaker', 'Ironbreaker', 'greatsword', 'Rare', 34, 0.7, 3.0, '#aab4c8', 3200, 'A slab of iron too heavy for normal men.', 'Heavy hits stagger enemies'),
  W('venom_spear', 'Venom Spear', 'spear', 'Epic', 26, 1.0, 4.0, '#7dff4d', 6200, 'Poison drips from its jade tip.', 'Thrust pierces multiple enemies'),
  W('reaper', "Reaper's Scythe", 'scythe', 'Epic', 30, 0.9, 3.4, '#b06bff', 8400, 'It hungers for the souls of heroes.', 'Wide arcs strike all around'),
  W('plasma_pistol', 'Plasma Pistol', 'energy', 'Uncommon', 14, 1.5, 40, '#4df0ff', 1500, 'Fires bolts of superheated plasma.', 'Ranged: shoots energy bolts'),
  W('photon_cannon', 'Photon Cannon', 'energy', 'Legendary', 52, 0.8, 55, '#fff36b', 21000, 'Experimental hero-tech siphoned from a lab.', 'Ranged: explosive photon shells'),
  W('dragonfang', 'Dragonfang Greatsword', 'greatsword', 'Legendary', 70, 0.8, 3.4, '#ff6a1a', 26000, 'Forged in a volcano. Still warm.', 'Flame shockwave on heavy attack'),
  W('void_edge', 'Void Edge', 'sword', 'Mythic', 64, 1.3, 2.8, '#ff1f6b', 52000, 'A blade that cuts away from reality.', 'Slashes ignore armor'),
  W('soulrender', 'Soulrender', 'special', 'Mythic', 80, 1.1, 5.0, '#c04dff', 70000, 'A chained soul-orb that circles its master.', 'Attacks fling soul-orbs'),
  W('godslayer', 'Godslayer Halberd', 'spear', 'Divine', 140, 1.1, 5.4, '#fff3b0', 250000, 'A weapon meant to end heroes and gods alike.', 'Divine light pierces everything'),
  I('jacket', 'Leather Jacket', 'Armor', 'Common', 'jacket', '#3b3b46', 300, 'Scuffed leather. Better than nothing.', { coat: 'jacket', def: 4, stats: { Defense: 4 } }),
  I('trench', 'Shadow Trenchcoat', 'Armor', 'Rare', 'jacket', '#241a3a', 3600, 'A long coat woven with shadow-thread that flares in the wind.', { coat: 'trench', def: 12, stats: { Defense: 12, Flight: '+5%' }, effects: ['Shadow skills +10%'] }),
  I('ironplate', 'Ironclad Plate', 'Armor', 'Epic', 'armor', '#6b7385', 9000, 'Heavy plates with shoulder guards.', { coat: 'armor', def: 26, stats: { Defense: 26 }, effects: ['Knockback resistance'] }),
  I('cloak', 'Phantom Cloak', 'Armor', 'Epic', 'cape', '#4c1d95', 11000, 'A flowing cloak that ripples like smoke.', { coat: 'cloak', def: 18, stats: { Defense: 18, Dash: '-20% cost' }, effects: ['Dash costs less energy'] }),
  I('voidplate', 'Void Sovereign Plate', 'Armor', 'Mythic', 'armor', '#1b0b2e', 80000, 'Obsidian armor that drinks light.', { coat: 'armor', def: 60, stats: { Defense: 60 }, effects: ['+20% damage', 'Immune to stun'] }),
  I('o_street', 'Street Rags', 'Outfits', 'Common', 'outfit', '#555', 0, 'Your starting clothes.', { outfit: 'street' }),
  I('o_suit', 'Black Syndicate Suit', 'Outfits', 'Uncommon', 'outfit', '#15151c', 1800, 'A sharp black suit with crimson tie.', { outfit: 'suit', stats: { Charisma: 10 }, effects: ['+5% money from crimes'] }),
  I('o_ninja', 'Crimson Shinobi', 'Outfits', 'Rare', 'outfit', '#9b1030', 4200, 'Silent, deadly, stylish.', { outfit: 'ninja', stats: { Speed: '+8%' }, effects: ['+8% move speed'] }),
  I('o_neon', 'Neon Streetwear', 'Outfits', 'Rare', 'outfit', '#00e5ff', 3900, 'Reactive neon trim. Hard to miss.', { outfit: 'neon', stats: { Energy: '+15' }, effects: ['+15 max energy'] }),
  I('o_regal', 'Imperial Regalia', 'Outfits', 'Legendary', 'outfit', '#d4af37', 38000, 'Garb of a king in waiting.', { outfit: 'regal', stats: { Charisma: 35 }, effects: ['+15% reputation'] }),
  I('o_void', 'Void Monarch Attire', 'Outfits', 'Mythic', 'outfit', '#7c3aed', 90000, 'Woven from the dark between stars.', { outfit: 'void', stats: { Power: '+15%' }, effects: ['+15% skill damage'] }),
  I('a_mask', 'Skull Mask', 'Accessories', 'Uncommon', 'mask', '#e8e8f0', 1100, 'Intimidating porcelain skull.', { acc: 'mask', stats: { Fear: 8 } }),
  I('a_goggles', 'Cyber Goggles', 'Accessories', 'Rare', 'goggles', '#00e5ff', 2400, 'Tactical visor with enemy overlay.', { acc: 'goggles', effects: ['Crit chance +5%'] }),
  I('a_scarf', 'Crimson Scarf', 'Accessories', 'Common', 'scarf', '#d4143a', 400, 'Flutters dramatically in flight.', { acc: 'scarf' }),
  I('a_band', 'Shadow Headband', 'Accessories', 'Common', 'headband', '#1a1a22', 350, 'Black cloth with a silver plate.', { acc: 'headband' }),
  I('a_ear', 'Blood Ruby Earring', 'Accessories', 'Rare', 'earring', '#ff2e57', 2800, 'A single glittering stone.', { acc: 'earring', effects: ['Lifesteal 2%'] }),
  I('a_halo', 'Halo of Ruin', 'Accessories', 'Legendary', 'halo', '#ffd54a', 30000, 'A fallen angel’s halo, burning with dark gold.', { acc: 'halo', effects: ['+20 max energy'] }),
  I('medkit', 'Medical Kit', 'Consumables', 'Common', 'potion', '#ff4d6d', 150, 'Restores 60 health.', { heal: 60, stack: true, stats: { Heal: 60 } }),
  I('energycell', 'Energy Cell', 'Consumables', 'Common', 'cell', '#4df0ff', 150, 'Restores 60 energy.', { energy: 60, stack: true, stats: { Energy: 60 } }),
  I('stim', 'Overdrive Stim', 'Consumables', 'Rare', 'potion', '#ffd23f', 900, 'Restores 120 health and energy.', { heal: 120, energy: 120, stack: true }),
  I('scrap', 'Scrap Metal', 'Materials', 'Common', 'scrap', '#8b93a3', 25, 'Used for weapon upgrades.', { stack: true }),
  I('circuit', 'Circuit Board', 'Materials', 'Uncommon', 'chip', '#3ddc84', 120, 'Salvaged electronics.', { stack: true }),
  I('darkcrystal', 'Dark Crystal', 'Materials', 'Rare', 'crystal', '#a855f7', 600, 'Crystallized shadow energy.', { stack: true }),
  I('researchdata', 'Research Data', 'Materials', 'Epic', 'data', '#38bdf8', 1400, 'Stolen hero-tech blueprints.', { stack: true }),
  I('watch', 'Gold Watch', 'Valuables', 'Uncommon', 'watch', '#fbbf24', 450, 'A stolen luxury timepiece.', { stack: true }),
  I('ring', 'Diamond Ring', 'Valuables', 'Rare', 'ring', '#9be7ff', 1200, 'Sparkling and expensive.', { stack: true }),
  I('painting', 'Oil Painting', 'Valuables', 'Rare', 'painting', '#c58b4a', 1800, 'Someone’s priceless heirloom.', { stack: true }),
  I('vase', 'Ming Vase', 'Valuables', 'Epic', 'vase', '#4aa3ff', 3500, 'Ancient porcelain. Do not drop.', { stack: true }),
  I('jewelbox', 'Jewelry Box', 'Valuables', 'Uncommon', 'box', '#d946ef', 700, 'A box full of sparkling things.', { stack: true }),
  I('laptop', 'Encrypted Laptop', 'Valuables', 'Uncommon', 'laptop', '#6b7280', 650, 'Full of data worth money.', { stack: true }),
  I('plasmacore', 'Plasma Core', 'Energy', 'Rare', 'core', '#4df0ff', 2200, 'Restores all energy. +5 max energy when absorbed.', { energy: 999, stack: true }),
  I('arcreactor', 'Unstable Arc Core', 'Energy', 'Epic', 'core', '#fff36b', 7000, 'Crackling energy source. Sells high.', { stack: true }),
  I('eye', 'Eye of Eternity', 'Artifacts', 'Legendary', 'artifact', '#ff1f6b', 40000, 'A watching crimson eye. Whispers promises.', { special: 'Passive: +10% all damage', effects: ['+10% damage'] }),
  I('heartdark', 'Heart of Darkness', 'Artifacts', 'Mythic', 'artifact', '#7c3aed', 85000, 'A pulsing black heart that never stops beating.', { special: 'Passive: energy regenerates 40% faster', effects: ['+40% energy regen'] }),
  I('crown', 'Crown of Sovereigns', 'Artifacts', 'Divine', 'artifact', '#fff3b0', 300000, 'It chooses the one who will rule the world.', { special: 'Passive: +25% reputation, +15% damage', effects: ['+25% rep'] }),
  I('tf_shadow', 'Shadow Heart', 'Transformation', 'Rare', 'sigil', '#7c3aed', 5000, 'Use to unlock Shadow Awakening (Lv 5).', { form: 1 }),
  I('tf_crimson', 'Crimson Core', 'Transformation', 'Epic', 'sigil', '#ff2040', 18000, 'Use to unlock Crimson Overdrive (Lv 12).', { form: 2 }),
  I('tf_void', 'Void Fragment', 'Transformation', 'Legendary', 'sigil', '#22d3ee', 60000, 'Use to unlock Void Sovereign (Lv 22).', { form: 3 }),
  I('tf_god', 'Demon God Sigil', 'Transformation', 'Divine', 'sigil', '#ffd54a', 200000, 'Use to unlock Ascended Demon God (Lv 35).', { form: 4 }),
];
export const ITEM_MAP: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ───────────── Outfits (visual definitions) ─────────────
export interface Outfit { top: string; bottom: string; trim: string; boots: string; belt: string; style: 'tee' | 'hoodie' | 'suit' | 'ninja' | 'regal' | 'armorsuit' }
export const OUTFITS: Record<string, Outfit> = {
  street: { top: '#4b5563', bottom: '#1f2430', trim: '#d4143a', boots: '#15151a', belt: '#222', style: 'tee' },
  suit: { top: '#111118', bottom: '#111118', trim: '#d4143a', boots: '#0a0a0c', belt: '#d4af37', style: 'suit' },
  ninja: { top: '#26121a', bottom: '#1a0d12', trim: '#ff2e57', boots: '#0d0608', belt: '#9b1030', style: 'ninja' },
  neon: { top: '#1a1030', bottom: '#14102a', trim: '#00e5ff', boots: '#0a0a1a', belt: '#ff2bd6', style: 'hoodie' },
  regal: { top: '#241d10', bottom: '#1a150c', trim: '#d4af37', boots: '#3a2a10', belt: '#d4af37', style: 'regal' },
  void: { top: '#150a24', bottom: '#0e0618', trim: '#a855f7', boots: '#07030d', belt: '#7c3aed', style: 'armorsuit' },
};

// ───────────── Transformations ─────────────
export interface Form { id: number; name: string; lvl: number; dmg: number; speed: number; fly: number; cost: number; hair: string; eye: string; aura: string; skill?: string; desc: string }
export const FORMS: Form[] = [
  { id: 0, name: 'Base Form', lvl: 1, dmg: 1, speed: 1, fly: 1, cost: 0, hair: '', eye: '', aura: '#7c3aed', desc: 'Your natural self.' },
  { id: 1, name: 'Shadow Awakening', lvl: 5, dmg: 1.3, speed: 1.15, fly: 1.2, cost: 40, hair: '#8b5cf6', eye: '#e0b3ff', aura: '#7c3aed', skill: 'shadow_explosion', desc: 'Hair turns violet, eyes glow. Shadow aura wraps your body.' },
  { id: 2, name: 'Crimson Overdrive', lvl: 12, dmg: 1.7, speed: 1.3, fly: 1.4, cost: 55, hair: '#ff2a4d', eye: '#ffef5a', aura: '#ff2040', skill: 'meteor_rain', desc: 'Spiked crimson hair, shoulder armor and flaming aura.' },
  { id: 3, name: 'Void Sovereign', lvl: 22, dmg: 2.3, speed: 1.45, fly: 1.7, cost: 70, hair: '#d8f6ff', eye: '#00f0ff', aura: '#22d3ee', skill: 'void_collapse', desc: 'Horns, void wings and a cloak of stars.' },
  { id: 4, name: 'Ascended Demon God', lvl: 35, dmg: 3.2, speed: 1.7, fly: 2.1, cost: 90, hair: '#ffd54a', eye: '#ff1f1f', aura: '#ffb300', skill: 'dominion', desc: 'Golden hair, halo, crown and wings of ruin.' },
];

// ───────────── Heroes & villains ─────────────
export interface HeroDef { id: string; name: string; title: string; lvl: number; power: Cat; weak: Cat; color: string; hair: string; hp: number; fly: boolean; style: 'melee' | 'ranged' | 'mixed'; threat: number; line: string; trait: string }
export const HEROES: HeroDef[] = [
  { id: 'sparrow', name: 'Sparrow', title: 'Rookie Skyguard', lvl: 2, power: 'Wind', weak: 'Earth', color: '#7dffd0', hair: '#f7e07a', hp: 140, fly: true, style: 'ranged', threat: 2, line: 'Stop right there, villain!', trait: 'Eager rookie. Rushes in carelessly.' },
  { id: 'bulwark', name: 'Bulwark', title: 'Iron Wall', lvl: 4, power: 'Earth', weak: 'Wind', color: '#c89b5a', hair: '#3a2a1a', hp: 340, fly: false, style: 'melee', threat: 3, line: 'Nobody gets past me.', trait: 'Stubborn tank. Slow but tough.' },
  { id: 'lumina', name: 'Lumina', title: 'Light of Metro', lvl: 5, power: 'Energy', weak: 'Dark Energy', color: '#fff6a8', hair: '#ffe27a', hp: 220, fly: true, style: 'ranged', threat: 3, line: 'Your darkness ends tonight.', trait: 'Kind-hearted and precise.' },
  { id: 'frostbyte', name: 'Frostbyte', title: 'Winter Sentinel', lvl: 8, power: 'Ice', weak: 'Fire', color: '#8feaff', hair: '#e8fbff', hp: 360, fly: false, style: 'mixed', threat: 4, line: 'Chill out, villain.', trait: 'Cool and calculating. Hates fire.' },
  { id: 'blazewing', name: 'Blazewing', title: 'Phoenix Knight', lvl: 10, power: 'Fire', weak: 'Water', color: '#ff7a2b', hair: '#ff3b1a', hp: 400, fly: true, style: 'mixed', threat: 4, line: 'I will burn your empire down!', trait: 'Hot-headed aerial brawler.' },
  { id: 'thundra', name: 'Thundra', title: 'Stormbringer', lvl: 14, power: 'Lightning', weak: 'Earth', color: '#ffee55', hair: '#6a4cff', hp: 520, fly: true, style: 'ranged', threat: 5, line: 'Feel the thunder!', trait: 'Fast, arrogant, loves showboating.' },
  { id: 'marin', name: 'Marin', title: 'Tidecaller', lvl: 16, power: 'Water', weak: 'Lightning', color: '#3b9bff', hair: '#2255aa', hp: 560, fly: false, style: 'mixed', threat: 5, line: 'The tide always returns.', trait: 'Patient. Heals when standing still.' },
  { id: 'aegis', name: 'Sentinel Aegis', title: 'Alliance Shield', lvl: 22, power: 'Gravity', weak: 'Space-Time', color: '#d19bff', hair: '#e5e7eb', hp: 900, fly: true, style: 'mixed', threat: 6, line: 'The Alliance will stop you.', trait: 'Tactical genius. Adapts quickly.' },
  { id: 'kenjin', name: 'Master Kenjin', title: 'Iron Sage', lvl: 24, power: 'Martial Arts', weak: 'Telekinesis', color: '#ffb347', hair: '#d9d9d9', hp: 1100, fly: false, style: 'melee', threat: 6, line: 'Discipline defeats ambition.', trait: 'Legendary martial artist.' },
  { id: 'solaris', name: 'Paragon Solaris', title: 'World Hero Alliance Champion', lvl: 40, power: 'Energy', weak: 'Dark Energy', color: '#fff3b0', hair: '#fff3b0', hp: 3200, fly: true, style: 'mixed', threat: 7, line: 'Humanity’s hope will never fall.', trait: 'The strongest hero alive.' },
];
export const HERO_MAP: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export interface Rival { id: string; name: string; title: string; power: Cat; color: string; hair: string; hp: number; lvl: number; org: string; line: string; reward: { money: number; rep: number; xp: number; item?: string }; style: string }
export const RIVALS: Rival[] = [
  { id: 'ragnar', name: 'Ragnar', title: 'the Iron Tyrant', power: 'Earth', color: '#9aa3b2', hair: '#b54a1a', hp: 1600, lvl: 18, org: 'Ironfist Syndicate', line: 'This city is forged in MY iron!', reward: { money: 40000, rep: 600, xp: 2500, item: 'ironbreaker' }, style: 'Brute — heavy slams, charges, shockwaves' },
  { id: 'nyx', name: 'Nyx', title: 'the Void Assassin', power: 'Shadow', color: '#6d28d9', hair: '#e8e8ff', hp: 1200, lvl: 20, org: 'Nightveil Cult', line: 'You never saw me coming.', reward: { money: 55000, rep: 800, xp: 3200, item: 'reaper' }, style: 'Assassin — teleports, shadow blades, fast strikes' },
  { id: 'zerath', name: 'Zerath', title: 'the Ascended', power: 'Dark Energy', color: '#ff1f6b', hair: '#ff1f6b', hp: 2600, lvl: 28, org: 'Order of the Ascended', line: 'I have transcended mortal limits.', reward: { money: 120000, rep: 1500, xp: 6000, item: 'heartdark' }, style: 'Ascended — flies, dark beams, energy novas' },
];
export const RIVAL_MAP: Record<string, Rival> = Object.fromEntries(RIVALS.map((r) => [r.id, r]));

// ───────────── Regions & territory ─────────────
export type TState = 'Neutral' | 'Hero-Controlled' | 'Contested' | 'Villain-Controlled' | 'Fully Conquered';
export interface Region {
  id: string; name: string; gx: number; gy: number; theme: string; state: TState; boss: string; bossKind: 'hero' | 'rival' | 'gang'; bossName: string;
  lvl: number; ground: string; road: string; accent: string; desc: string; income: number; garrison: number;
}
export const REGIONS: Region[] = [
  { id: 'shadow', name: 'Shadow District', gx: 0, gy: 0, theme: 'shadow', state: 'Contested', boss: 'nyx', bossKind: 'rival', bossName: 'Nyx', lvl: 20, ground: '#1b1230', road: '#0c0a14', accent: '#a855f7', desc: 'Neon-drenched slums ruled by the Nightveil Cult. Hidden underground black market.', income: 900, garrison: 6 },
  { id: 'capital', name: 'Hero Capital', gx: 1, gy: 0, theme: 'capital', state: 'Hero-Controlled', boss: 'solaris', bossKind: 'hero', bossName: 'Paragon Solaris', lvl: 40, ground: '#6e7a88', road: '#2a2f38', accent: '#fff3b0', desc: 'Gleaming white towers around the World Hero Alliance headquarters.', income: 3000, garrison: 10 },
  { id: 'research', name: 'Research Zone', gx: 2, gy: 0, theme: 'research', state: 'Contested', boss: 'zerath', bossKind: 'rival', bossName: 'Zerath', lvl: 28, ground: '#8aa0b0', road: '#202a33', accent: '#22d3ee', desc: 'Glass labs and domes experimenting with ascension technology.', income: 1800, garrison: 8 },
  { id: 'industrial', name: 'Industrial City', gx: 0, gy: 1, theme: 'industrial', state: 'Contested', boss: 'ragnar', bossKind: 'rival', bossName: 'Ragnar', lvl: 18, ground: '#59544c', road: '#1d1d20', accent: '#ff8a3c', desc: 'Smokestacks, warehouses and the Ironfist Syndicate.', income: 1200, garrison: 7 },
  { id: 'metro', name: 'Metro City', gx: 1, gy: 1, theme: 'metro', state: 'Contested', boss: 'blazewing', bossKind: 'hero', bossName: 'Blazewing', lvl: 8, ground: '#4a5262', road: '#17181d', accent: '#ff3b5c', desc: 'The glittering metropolis where every villain’s story begins.', income: 800, garrison: 5 },
  { id: 'martial', name: 'Martial Arts Region', gx: 2, gy: 1, theme: 'martial', state: 'Hero-Controlled', boss: 'kenjin', bossKind: 'hero', bossName: 'Master Kenjin', lvl: 24, ground: '#6b5a4a', road: '#2a2220', accent: '#ff4d4d', desc: 'Pagoda dojos and temples guarded by legendary masters.', income: 1500, garrison: 8 },
  { id: 'mountain', name: 'Mountain Territories', gx: 0, gy: 2, theme: 'mountain', state: 'Neutral', boss: 'grimfang', bossKind: 'gang', bossName: 'Grimfang', lvl: 14, ground: '#8a9aa6', road: '#3a3f44', accent: '#9ad1ff', desc: 'Frozen peaks and mountain fortresses ruled by warlord Grimfang.', income: 1000, garrison: 6 },
  { id: 'intl', name: 'Sakura Harbor (International)', gx: 1, gy: 2, theme: 'intl', state: 'Hero-Controlled', boss: 'aegis', bossKind: 'hero', bossName: 'Sentinel Aegis', lvl: 22, ground: '#566074', road: '#191b24', accent: '#ff7ad9', desc: 'An international harbor city with neon towers and alliance outposts.', income: 2200, garrison: 9 },
  { id: 'island', name: 'Tidecaller Island', gx: 2, gy: 2, theme: 'island', state: 'Hero-Controlled', boss: 'marin', bossKind: 'hero', bossName: 'Marin', lvl: 16, ground: '#d9c58a', road: '#6d5f45', accent: '#3be3ff', desc: 'A volcanic island resort protected by the Tidecaller.', income: 1400, garrison: 6 },
];
export const REGION_MAP: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const REGION_SIZE = 400;
export const BLOCK = 80;
export const ROAD_W = 16;
export const WORLD_OFF = -600; // world spans -600..600
export const regionCenter = (r: { gx: number; gy: number }) => ({ x: WORLD_OFF + r.gx * REGION_SIZE + REGION_SIZE / 2, z: WORLD_OFF + r.gy * REGION_SIZE + REGION_SIZE / 2 });
export const regionAt = (x: number, z: number): Region | null => {
  const gx = Math.floor((x - WORLD_OFF) / REGION_SIZE), gy = Math.floor((z - WORLD_OFF) / REGION_SIZE);
  return REGIONS.find((r) => r.gx === gx && r.gy === gy) ?? null;
};

// ───────────── Progression ─────────────
export const STAGES = [
  'Unknown Criminal', 'Street-Level Villain', 'Dangerous Superpowered Villain', 'Gang Leader', 'Organization Leader',
  'City-Level Threat', 'Regional Villain Commander', 'National Threat', 'International Villain', 'Ultimate World-Level Villain',
];
export const THREAT_NAMES = ['Unknown', 'Local Attention', 'Hero Investigation', 'Local Hero Response', 'Professional Hero Squad', 'Elite Heroes', 'Legendary Hero Response', 'World Hero Alliance Intervention'];
export const xpFor = (lvl: number) => Math.floor(60 * Math.pow(lvl, 1.35));

// ───────────── Missions ─────────────
export interface Mission { id: string; title: string; desc: string; ev: string; need: number; money: number; rep: number; xp: number; item?: string; rank: number; main?: boolean; after?: string }
export const MISSIONS: Mission[] = [
  { id: 'm1', title: 'Petty Larceny', desc: 'Steal 2 vehicles (approach a car and hold G).', ev: 'steal', need: 2, money: 400, rep: 15, xp: 80, rank: 1, main: true },
  { id: 'm2', title: 'Knock Knock', desc: 'Search 4 containers inside houses.', ev: 'burgle', need: 4, money: 700, rep: 20, xp: 120, rank: 1, main: true, item: 'a_scarf' },
  { id: 'm3', title: 'Cash Register Blues', desc: 'Rob a shop’s cash register.', ev: 'rob', need: 1, money: 1200, rep: 30, xp: 180, rank: 1, main: true, item: 'tf_shadow', after: 'm2' },
  { id: 'm4', title: 'Hero Hunter', desc: 'Defeat 3 heroes who come for you.', ev: 'kill_hero', need: 3, money: 2500, rep: 60, xp: 400, rank: 2, main: true, item: 'katana' },
  { id: 'm5', title: 'Awakening', desc: 'Use a transformation (T). Unlock one by using the Shadow Heart in your inventory.', ev: 'transform', need: 1, money: 1500, rep: 40, xp: 350, rank: 2, main: true },
  { id: 'm6', title: 'Build a Crew', desc: 'Recruit 3 organization members.', ev: 'recruit', need: 3, money: 3000, rep: 80, xp: 500, rank: 3, main: true },
  { id: 'm7', title: 'Home Sweet Hideout', desc: 'Build or upgrade a headquarters facility.', ev: 'facility', need: 2, money: 4000, rep: 90, xp: 500, rank: 3, main: true },
  { id: 'm8', title: 'Take the City', desc: 'Capture Metro City by defeating Blazewing.', ev: 'capture:metro', need: 1, money: 12000, rep: 250, xp: 1500, rank: 3, main: true, item: 'tf_crimson' },
  { id: 'm9', title: 'The Iron Tyrant', desc: 'Defeat Ragnar in Industrial City.', ev: 'capture:industrial', need: 1, money: 25000, rep: 400, xp: 3000, rank: 5, main: true },
  { id: 'm10', title: 'Void Assassin', desc: 'Defeat Nyx in the Shadow District.', ev: 'capture:shadow', need: 1, money: 30000, rep: 450, xp: 3500, rank: 5, main: true },
  { id: 'm11', title: 'The Ascended', desc: 'Defeat Zerath in the Research Zone.', ev: 'capture:research', need: 1, money: 60000, rep: 800, xp: 6000, rank: 6, main: true, item: 'tf_void' },
  { id: 'm12', title: 'Regional Warlord', desc: 'Control 5 territories.', ev: 'territories', need: 5, money: 80000, rep: 1200, xp: 8000, rank: 7, main: true },
  { id: 'm13', title: 'Worldwide Terror', desc: 'Control 8 territories.', ev: 'territories', need: 8, money: 150000, rep: 2000, xp: 15000, rank: 8, main: true, item: 'tf_god' },
  { id: 'm14', title: 'End of the Heroes', desc: 'Defeat Paragon Solaris in Hero Capital.', ev: 'capture:capital', need: 1, money: 500000, rep: 5000, xp: 40000, rank: 9, main: true, item: 'crown' },
  { id: 's1', title: 'Gang Cleanup', desc: 'Defeat 8 gang members.', ev: 'kill_gang', need: 8, money: 1200, rep: 25, xp: 200, rank: 1 },
  { id: 's2', title: 'Warehouse Raid', desc: 'Loot a warehouse in Industrial City.', ev: 'warehouse', need: 3, money: 3500, rep: 50, xp: 400, rank: 2, item: 'circuit' },
  { id: 's3', title: 'Below the City', desc: 'Complete the underground bunker run in the Shadow District.', ev: 'underground', need: 1, money: 6000, rep: 90, xp: 700, rank: 2, item: 'darkcrystal' },
  { id: 's4', title: 'Chop Shop', desc: 'Deliver 3 stolen vehicles to your HQ garage zone.', ev: 'deliver', need: 3, money: 5000, rep: 60, xp: 500, rank: 1 },
  { id: 's5', title: 'Sky Is Mine', desc: 'Fly a total of 5 km.', ev: 'fly', need: 50, money: 1500, rep: 30, xp: 300, rank: 1 },
  { id: 's6', title: 'Power Practice', desc: 'Use skills 25 times.', ev: 'skill', need: 25, money: 1500, rep: 20, xp: 300, rank: 1 },
  { id: 's7', title: 'Black Market Dealer', desc: 'Trade 3 times at a black market.', ev: 'trade', need: 3, money: 2000, rep: 30, xp: 250, rank: 2 },
  { id: 's8', title: 'Lab Infiltration', desc: 'Raid a research lab and steal the data core.', ev: 'lab', need: 1, money: 9000, rep: 120, xp: 900, rank: 3, item: 'researchdata' },
  { id: 's9', title: 'Heroes Beware', desc: 'Defeat 15 heroes.', ev: 'kill_hero', need: 15, money: 15000, rep: 300, xp: 2500, rank: 4, item: 'a_halo' },
  { id: 's10', title: 'Arsenal of Crime', desc: 'Rob 4 shops.', ev: 'rob', need: 4, money: 6000, rep: 80, xp: 600, rank: 2 },
];

// ───────────── HQ facilities ─────────────
export interface Facility { id: string; name: string; icon: string; base: number; max: number; desc: string; perk: string }
export const FACILITIES: Facility[] = [
  { id: 'throne', name: 'Throne Room', icon: '👑', base: 5000, max: 5, desc: 'Seat of your power.', perk: '+5% reputation and +3 member capacity per level' },
  { id: 'training', name: 'Training Hall', icon: '🥋', base: 3000, max: 5, desc: 'Train to improve your body.', perk: '+8% XP and +10 max health per level; train for XP' },
  { id: 'recruit', name: 'Recruitment Center', icon: '📜', base: 3500, max: 5, desc: 'Attract better followers.', perk: 'Higher level recruits & more candidates' },
  { id: 'lab', name: 'Research Laboratory', icon: '🧪', base: 6000, max: 5, desc: 'Produces research data.', perk: '+1 research point per tick per level' },
  { id: 'armory', name: 'Armory', icon: '⚔️', base: 5000, max: 5, desc: 'Upgrade your weapons.', perk: '+4% weapon damage per level; unlocks weapon upgrades' },
  { id: 'garage', name: 'Garage', icon: '🚗', base: 4000, max: 5, desc: 'Store and repair stolen vehicles.', perk: 'Summon owned vehicles; +15% sell value per level' },
  { id: 'war', name: 'War Room', icon: '🗺️', base: 8000, max: 5, desc: 'Coordinate territory campaigns.', perk: '+10 defense for all territories per level' },
  { id: 'prison', name: 'Prison', icon: '⛓️', base: 6000, max: 5, desc: 'Hold captured heroes.', perk: 'Captured heroes yield ransom each tick' },
  { id: 'energy', name: 'Energy Chamber', icon: '⚡', base: 7000, max: 5, desc: 'Amplifies your core.', perk: '+15 max energy and faster regen per level' },
  { id: 'storage', name: 'Storage Vault', icon: '📦', base: 2500, max: 5, desc: 'Safely hoard loot.', perk: '+4% passive vault interest per tick per level' },
  { id: 'quarters', name: 'Commander Quarters', icon: '🏛️', base: 9000, max: 5, desc: 'Housing for commanders.', perk: '+1 commander slot per level' },
];
export const HQ_TIERS = ['Rundown Hideout', 'Warehouse Base', 'Fortified Compound', 'Dark Tower', 'Villain Fortress'];
export const DECORS = [
  { id: 'none', name: 'Bare Walls', color: '#6b7280', cost: 0 },
  { id: 'crimson', name: 'Crimson Banners', color: '#ff2e57', cost: 5000 },
  { id: 'void', name: 'Void Crystals', color: '#a855f7', cost: 12000 },
  { id: 'gold', name: 'Golden Statues', color: '#fbbf24', cost: 30000 },
];

// ───────────── Members ─────────────
export type Role = 'Henchman' | 'Fighter' | 'Assassin' | 'Guard' | 'Scientist' | 'Engineer' | 'Elite Villain' | 'Commander';
export const ROLES: Role[] = ['Henchman', 'Fighter', 'Assassin', 'Guard', 'Scientist', 'Engineer', 'Elite Villain', 'Commander'];
export const ROLE_COST: Record<Role, number> = { Henchman: 400, Fighter: 1500, Assassin: 2800, Guard: 1200, Scientist: 3500, Engineer: 3000, 'Elite Villain': 18000, Commander: 40000 };
export const ROLE_RANK: Record<Role, number> = { Henchman: 1, Fighter: 2, Assassin: 3, Guard: 2, Scientist: 3, Engineer: 3, 'Elite Villain': 5, Commander: 5 };
export const ROLE_COL: Record<Role, string> = { Henchman: '#8b93a3', Fighter: '#ff7a3c', Assassin: '#a855f7', Guard: '#4aa3ff', Scientist: '#3ddc84', Engineer: '#fbbf24', 'Elite Villain': '#ff1f6b', Commander: '#fff3b0' };
export const FIRST = ['Kuro', 'Vex', 'Rhea', 'Dante', 'Mira', 'Jax', 'Sable', 'Orin', 'Lyra', 'Kael', 'Zane', 'Nova', 'Ash', 'Riven', 'Talon', 'Ivy', 'Cass', 'Drake', 'Ember', 'Hex'];
export const LAST = ['Blackwood', 'Voss', 'Kage', 'Ironhart', 'Nightshade', 'Crow', 'Stormborn', 'Vale', 'Hollow', 'Ravenscar', 'Thorne', 'Ashfall', 'Grim', 'Sorrow'];
export const MEMBER_SKILLS = ['Brawler', 'Marksman', 'Stealth', 'Hacker', 'Mechanic', 'Tactician', 'Pyromancer', 'Cryomancer', 'Intimidation', 'Medic'];
export const ASSIGNMENTS = ['Follow Me', 'Guard HQ', 'Gather Resources', 'Research', 'Patrol City', 'Recruit'] as const;
export const GEAR = ['Combat Knife', 'Pistol', 'Baton', 'Katana', 'Energy Rifle', 'Riot Shield', 'Hacking Rig', 'Tool Kit', 'Dark Blade', 'Plasma Gauntlet'];

// ───────────── Customization ─────────────
export const SKINS = ['#ffe0cc', '#f5c7a1', '#e0a47c', '#bd7a4f', '#8a5230', '#5a3320', '#d8e4f2', '#b9d5b0'];
export const HAIRC = ['#14141c', '#e8e8f2', '#d4143a', '#7c3aed', '#2f6fff', '#f5c542', '#ff7ad9', '#3ddc84', '#7a4a2a', '#ff7a1a'];
export const EYEC = ['#d4143a', '#2fd1ff', '#ffd23f', '#a855f7', '#3ddc84', '#ff7a1a', '#e8e8f2', '#1a1a22'];
export const HAIRSTYLES = ['Spiky Rebel', 'Slick Villain', 'Ponytail', 'Messy Cut', 'Long Flow', 'Flame Spikes'];
export const FACES = ['Sharp', 'Soft', 'Fierce', 'Cold'];
export const COATS = ['none', 'jacket', 'trench', 'cloak', 'armor'];
export const GLOVES = ['none', 'fingerless', 'gauntlet', 'long'];
export const AURAS = ['#7c3aed', '#ff2040', '#22d3ee', '#ffd54a', '#3ddc84', '#ff7ad9', '#ffffff'];
export interface LookCfg { skin: string; hairStyle: number; hairColor: string; eyeColor: string; face: number; outfit: string; coat: string; coatColor: string; glove: string; gloveColor: string; acc: string[]; aura: string }
export const DEFAULT_LOOK: LookCfg = { skin: SKINS[1], hairStyle: 0, hairColor: HAIRC[0], eyeColor: EYEC[0], face: 0, outfit: 'street', coat: 'none', coatColor: '#2b2b36', glove: 'fingerless', gloveColor: '#15151a', acc: [], aura: AURAS[0] };

export const VEHICLE_PRICE: Record<string, number> = { sports: 4200, supercar: 14000, sedan: 1500, suv: 2600, bike: 1900, truck: 3000, van: 1800, luxury: 8000, delivery: 2200, taxi: 1200 };
