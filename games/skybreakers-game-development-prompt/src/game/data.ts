// ───────────── Static game data: items, weapons, spells, enemies, bosses, ships, buildings, recipes, quests ─────────────
export type Biome = 'emerald' | 'frost' | 'ember' | 'ruins' | 'celestial' | 'shadow';

export interface ItemDef { name: string; icon: string; kind: 'resource' | 'material' | 'potion' | 'part' | 'magic' | 'artifact' | 'food' | 'currency'; value: number; desc: string }
export const ITEMS: Record<string, ItemDef> = {
  gold: { name: 'Gold', icon: '🪙', kind: 'currency', value: 1, desc: 'Coin of the old kingdoms.' },
  wood: { name: 'Wood', icon: '🪵', kind: 'resource', value: 2, desc: 'Sturdy timber from sky-oaks.' },
  stone: { name: 'Stone', icon: '🪨', kind: 'resource', value: 2, desc: 'Quarried rock.' },
  iron: { name: 'Iron', icon: '⛓️', kind: 'resource', value: 5, desc: 'Raw iron ore.' },
  crystal: { name: 'Crystal', icon: '💎', kind: 'resource', value: 12, desc: 'Aether-charged crystal.' },
  essence: { name: 'Magical Essence', icon: '✨', kind: 'resource', value: 15, desc: 'Condensed wild magic.' },
  fragment: { name: 'Ancient Fragment', icon: '🗿', kind: 'resource', value: 25, desc: 'Relic shard of Aetheria.' },
  food: { name: 'Food', icon: '🍖', kind: 'food', value: 3, desc: 'Hearty rations. Restores health when eaten.' },
  hide: { name: 'Beast Hide', icon: '🐺', kind: 'resource', value: 8, desc: 'Tough hide from sky beasts.' },
  frostcore: { name: 'Frost Core', icon: '❄️', kind: 'resource', value: 30, desc: 'Rare core of an ice monster.' },
  embercore: { name: 'Ember Core', icon: '🔥', kind: 'resource', value: 30, desc: 'Rare core of a fire elemental.' },
  voidshard: { name: 'Void Shard', icon: '🌑', kind: 'resource', value: 30, desc: 'Shard of congealed shadow.' },
  gear: { name: 'Ancient Gear', icon: '⚙️', kind: 'resource', value: 20, desc: 'Salvage from mechanical guardians.' },
  plank: { name: 'Planks', icon: '🟫', kind: 'material', value: 4, desc: 'Building material.' },
  brick: { name: 'Stone Bricks', icon: '🧱', kind: 'material', value: 4, desc: 'Building material.' },
  ingot: { name: 'Iron Ingot', icon: '🔩', kind: 'material', value: 12, desc: 'Refined iron.' },
  engine_core: { name: 'Engine Core', icon: '🌀', kind: 'part', value: 60, desc: 'Airship engine component.' },
  armor_plate: { name: 'Armor Plating', icon: '🛡️', kind: 'part', value: 55, desc: 'Airship hull plating.' },
  cannon_barrel: { name: 'Cannon Barrel', icon: '💣', kind: 'part', value: 55, desc: 'Airship weapon component.' },
  cargo_net: { name: 'Cargo Net', icon: '🕸️', kind: 'part', value: 40, desc: 'Expands airship hold.' },
  sail_silk: { name: 'Sail Silk', icon: '🧵', kind: 'part', value: 40, desc: 'Lightweight aero-cloth.' },
  gyro: { name: 'Gyro Stabilizer', icon: '🧭', kind: 'part', value: 50, desc: 'Improves flight stability.' },
  hp_potion: { name: 'Health Potion', icon: '🧪', kind: 'potion', value: 20, desc: 'Restores 60 health. [H]' },
  mp_potion: { name: 'Mana Potion', icon: '🔮', kind: 'potion', value: 20, desc: 'Restores 60 magic energy. [B]' },
  sp_potion: { name: 'Stamina Tonic', icon: '⚡', kind: 'potion', value: 15, desc: 'Fully restores stamina.' },
  fire_scroll: { name: 'Fire Scroll', icon: '📜', kind: 'magic', value: 40, desc: 'Unleashes a firestorm around you.' },
  power_elixir: { name: 'Elixir of Power', icon: '🍷', kind: 'magic', value: 50, desc: '+40% damage for 60s.' },
  fuel_cell: { name: 'Aether Fuel Cell', icon: '🔋', kind: 'magic', value: 35, desc: 'Fully refuels your airship.' },
  phoenix_feather: { name: 'Phoenix Feather', icon: '🪶', kind: 'magic', value: 120, desc: 'Auto-revives you on death.' },
  frost_sigil: { name: 'Frost Sigil', icon: '🔷', kind: 'artifact', value: 0, desc: 'Artifact of the Frostfall Kingdom.' },
  titan_heart: { name: "Titan's Heart", icon: '🟤', kind: 'artifact', value: 0, desc: 'Artifact: the living core of the Titan Golem.' },
  ember_crown: { name: 'Ember Crown', icon: '👑', kind: 'artifact', value: 0, desc: 'Artifact: crown of the Inferno King.' },
  void_shard: { name: 'Void Heart', icon: '🟣', kind: 'artifact', value: 0, desc: 'Artifact: heart of the Void Colossus.' },
  storm_scale: { name: 'Storm Scale', icon: '🐉', kind: 'artifact', value: 0, desc: 'Artifact: scale of the Storm Wyrm.' },
  temple_key: { name: 'Temple Rune', icon: '🔑', kind: 'artifact', value: 0, desc: 'Rune from the Temple of Awakening.' },
};
export const CAPPED = ['wood', 'stone', 'iron', 'crystal', 'essence', 'fragment', 'hide', 'frostcore', 'embercore', 'voidshard', 'gear', 'food', 'plank', 'brick', 'ingot'];

export interface WeaponDef { id: string; name: string; icon: string; kind: 'melee' | 'ranged' | 'magic'; dmg: number; heavy: number; range: number; arc: number; cd: number; combo: number; color: string; desc: string; reqLevel: number }
export const WEAPONS: Record<string, WeaponDef> = {
  sword: { id: 'sword', name: 'Skyforged Sword', icon: '🗡️', kind: 'melee', dmg: 15, heavy: 2.2, range: 3.4, arc: 2.1, cd: 0.42, combo: 3, color: '#cfe8ff', desc: 'Balanced blade with a 3-hit combo.', reqLevel: 1 },
  dual: { id: 'dual', name: 'Twin Zephyrs', icon: '⚔️', kind: 'melee', dmg: 9, heavy: 2.0, range: 2.9, arc: 2.4, cd: 0.26, combo: 4, color: '#8ff7ff', desc: 'Dual blades — blistering 4-hit combos.', reqLevel: 2 },
  greatsword: { id: 'greatsword', name: 'Colossus Edge', icon: '🪓', kind: 'melee', dmg: 30, heavy: 2.0, range: 4.3, arc: 2.6, cd: 0.8, combo: 2, color: '#ffd27a', desc: 'Slow, devastating arcs. Heavy knockback.', reqLevel: 4 },
  bow: { id: 'bow', name: 'Windpiercer Bow', icon: '🏹', kind: 'ranged', dmg: 13, heavy: 2.8, range: 60, arc: 0, cd: 0.5, combo: 1, color: '#b6ff9e', desc: 'Hold to draw for powerful arrows.', reqLevel: 1 },
  staff: { id: 'staff', name: 'Aether Staff', icon: '🪄', kind: 'magic', dmg: 11, heavy: 3.0, range: 40, arc: 0, cd: 0.45, combo: 1, color: '#d89bff', desc: 'Arcane bolts; +30% spell power.', reqLevel: 3 },
  spear: { id: 'spear', name: 'Stormspear', icon: '🔱', kind: 'melee', dmg: 17, heavy: 2.1, range: 5.2, arc: 0.9, cd: 0.5, combo: 2, color: '#ffe36e', desc: 'Long reach thrusts through lines of foes.', reqLevel: 2 },
};
export const WEAPON_ORDER = ['sword', 'dual', 'greatsword', 'bow', 'staff', 'spear'];

export interface SpellDef { id: string; name: string; icon: string; cost: number; cd: number; dmg: number; color: string; reqLevel: number; desc: string }
export const SPELLS: SpellDef[] = [
  { id: 'fire', name: 'Fire Blast', icon: '🔥', cost: 18, cd: 3.5, dmg: 34, color: '#ff7a2a', reqLevel: 1, desc: 'Fireball that explodes and ignites.' },
  { id: 'ice', name: 'Ice Shards', icon: '❄️', cost: 15, cd: 3, dmg: 20, color: '#8fe8ff', reqLevel: 2, desc: 'Three freezing shards that slow.' },
  { id: 'wind', name: 'Wind Slash', icon: '🌪️', cost: 10, cd: 2.2, dmg: 22, color: '#c8ffd8', reqLevel: 3, desc: 'Piercing crescent of wind.' },
  { id: 'lightning', name: 'Lightning Strike', icon: '⚡', cost: 28, cd: 7, dmg: 55, color: '#fff27a', reqLevel: 4, desc: 'Calls a bolt on your target area.' },
  { id: 'earth', name: 'Earth Shield', icon: '🛡️', cost: 25, cd: 14, dmg: 0, color: '#b89868', reqLevel: 5, desc: 'Stone barrier absorbs 70 damage.' },
  { id: 'arcane', name: 'Arcane Explosion', icon: '💥', cost: 40, cd: 13, dmg: 70, color: '#c26bff', reqLevel: 7, desc: 'Massive blast around you.' },
];

export interface EnemyDef { id: string; name: string; hp: number; dmg: number; speed: number; detect: number; atkRange: number; atkCd: number; windup: number; flying: boolean; xp: number; r: number; ai: 'melee' | 'lunge' | 'ranged' | 'slam' | 'swoop' | 'blink' | 'flee'; loot: [string, number, number, number][]; color: string; scale: number }
export const ENEMIES: Record<string, EnemyDef> = {
  wolf: { id: 'wolf', name: 'Sky Wolf', hp: 45, dmg: 9, speed: 8.5, detect: 28, atkRange: 2.4, atkCd: 1.5, windup: 0.45, flying: false, xp: 14, r: 1.1, ai: 'lunge', loot: [['hide', 0.7, 1, 2], ['food', 0.4, 1, 2]], color: '#8a93a8', scale: 1 },
  harpy: { id: 'harpy', name: 'Gale Harpy', hp: 38, dmg: 8, speed: 9, detect: 40, atkRange: 3, atkCd: 2.4, windup: 0.5, flying: true, xp: 18, r: 1.1, ai: 'swoop', loot: [['hide', 0.5, 1, 1], ['essence', 0.25, 1, 1]], color: '#b95fd0', scale: 1 },
  goblin: { id: 'goblin', name: 'Goblin Raider', hp: 36, dmg: 7, speed: 6, detect: 24, atkRange: 2.2, atkCd: 1.3, windup: 0.4, flying: false, xp: 11, r: 0.9, ai: 'melee', loot: [['gold', 0.8, 3, 9], ['wood', 0.4, 1, 3], ['iron', 0.3, 1, 2]], color: '#6aa84f', scale: 1 },
  golem: { id: 'golem', name: 'Stone Guardian', hp: 150, dmg: 18, speed: 3.2, detect: 26, atkRange: 4.2, atkCd: 3, windup: 0.9, flying: false, xp: 42, r: 1.9, ai: 'slam', loot: [['stone', 1, 3, 6], ['fragment', 0.35, 1, 1], ['iron', 0.5, 1, 3]], color: '#8b8576', scale: 1.5 },
  shadow: { id: 'shadow', name: 'Shade Stalker', hp: 70, dmg: 13, speed: 7.5, detect: 36, atkRange: 2.6, atkCd: 2, windup: 0.4, flying: false, xp: 30, r: 1.1, ai: 'blink', loot: [['voidshard', 0.35, 1, 1], ['essence', 0.5, 1, 2]], color: '#3a1f55', scale: 1.15 },
  fire: { id: 'fire', name: 'Fire Elemental', hp: 85, dmg: 14, speed: 5, detect: 34, atkRange: 22, atkCd: 2.6, windup: 0.6, flying: false, xp: 34, r: 1.3, ai: 'ranged', loot: [['embercore', 0.3, 1, 1], ['crystal', 0.4, 1, 2], ['stone', 0.5, 1, 3]], color: '#ff6a1a', scale: 1.25 },
  yeti: { id: 'yeti', name: 'Frost Yeti', hp: 130, dmg: 20, speed: 4.6, detect: 28, atkRange: 3.8, atkCd: 2.6, windup: 0.8, flying: false, xp: 38, r: 1.6, ai: 'slam', loot: [['frostcore', 0.3, 1, 1], ['hide', 0.8, 1, 3], ['crystal', 0.3, 1, 2]], color: '#dfeeff', scale: 1.5 },
  mech: { id: 'mech', name: 'Ancient Sentinel', hp: 110, dmg: 12, speed: 4.2, detect: 40, atkRange: 26, atkCd: 2.2, windup: 0.7, flying: false, xp: 40, r: 1.4, ai: 'ranged', loot: [['gear', 0.8, 1, 2], ['iron', 0.7, 2, 4], ['fragment', 0.25, 1, 1]], color: '#c9a45a', scale: 1.3 },
  deer: { id: 'deer', name: 'Meadow Stag', hp: 22, dmg: 0, speed: 9, detect: 14, atkRange: 0, atkCd: 9, windup: 0, flying: false, xp: 4, r: 1, ai: 'flee', loot: [['food', 1, 2, 4], ['hide', 0.5, 1, 1]], color: '#b07a4a', scale: 1 },
  stag: { id: 'stag', name: 'Prismatic Stag', hp: 80, dmg: 0, speed: 12, detect: 30, atkRange: 0, atkCd: 9, windup: 0, flying: false, xp: 150, r: 1.2, ai: 'flee', loot: [['essence', 1, 3, 5], ['crystal', 1, 3, 5], ['phoenix_feather', 0.6, 1, 1]], color: '#ffd7ff', scale: 1.4 },
};

export interface BossAttack { id: 'slam' | 'volley' | 'strikes' | 'charge' | 'summon' | 'breath' | 'pull' | 'lava' | 'rocks' | 'swoop'; w: number; min: number }
export interface BossDef { id: string; name: string; title: string; island: string; hp: number; dmg: number; speed: number; r: number; flying: boolean; color: string; accent: string; xp: number; artifact: string; attacks: BossAttack[]; element: string; reward: [string, number, number][]; roar: string }
export const BOSSES: Record<string, BossDef> = {
  titan: { id: 'titan', name: 'TITAN GOLEM', title: 'Ancient Stone Guardian', island: 'ruins', hp: 1800, dmg: 30, speed: 4.2, r: 6, flying: false, color: '#8d8878', accent: '#ffc552', xp: 900, artifact: 'titan_heart', element: 'stone', reward: [['fragment', 8, 12], ['iron', 12, 20], ['gold', 300, 500]], roar: 'golem',
    attacks: [{ id: 'slam', w: 3, min: 0 }, { id: 'rocks', w: 2, min: 0 }, { id: 'charge', w: 1.5, min: 0 }, { id: 'summon', w: 1, min: 1 }, { id: 'volley', w: 1.2, min: 2 }] },
  inferno: { id: 'inferno', name: 'INFERNO KING', title: 'Lord of the Emberlands', island: 'ember', hp: 2600, dmg: 36, speed: 5, r: 5, flying: false, color: '#3a1a14', accent: '#ff6a1a', xp: 1400, artifact: 'ember_crown', element: 'fire', reward: [['embercore', 3, 5], ['crystal', 8, 12], ['gold', 450, 700]], roar: 'dragon',
    attacks: [{ id: 'volley', w: 3, min: 0 }, { id: 'lava', w: 2, min: 0 }, { id: 'slam', w: 2, min: 0 }, { id: 'breath', w: 1.5, min: 1 }, { id: 'strikes', w: 1.5, min: 2 }] },
  void: { id: 'void', name: 'VOID COLOSSUS', title: 'Devourer of Light', island: 'shadow', hp: 3400, dmg: 40, speed: 4.5, r: 6, flying: false, color: '#1a0f2e', accent: '#b04cff', xp: 2000, artifact: 'void_shard', element: 'shadow', reward: [['voidshard', 4, 7], ['essence', 10, 15], ['gold', 600, 900]], roar: 'shadow',
    attacks: [{ id: 'pull', w: 2, min: 0 }, { id: 'volley', w: 2.5, min: 0 }, { id: 'strikes', w: 2, min: 0 }, { id: 'slam', w: 1.5, min: 0 }, { id: 'summon', w: 1.5, min: 1 }, { id: 'charge', w: 1.2, min: 2 }] },
  wyrm: { id: 'wyrm', name: 'STORM WYRM', title: 'Tyrant of the Sky', island: 'celestial', hp: 4400, dmg: 44, speed: 12, r: 7, flying: true, color: '#3a4f7a', accent: '#8fd8ff', xp: 3200, artifact: 'storm_scale', element: 'lightning', reward: [['crystal', 12, 18], ['essence', 12, 18], ['gold', 900, 1400]], roar: 'dragon',
    attacks: [{ id: 'strikes', w: 3, min: 0 }, { id: 'volley', w: 2, min: 0 }, { id: 'swoop', w: 2.5, min: 0 }, { id: 'breath', w: 1.5, min: 1 }, { id: 'summon', w: 1, min: 2 }] },
};

export interface ShipDef { id: string; name: string; desc: string; speed: number; accel: number; turn: number; hull: number; fuel: number; cargo: number; weapons: string[]; cost: Record<string, number>; req: string; scale: number; style: 'balloon' | 'sails' | 'wings' }
export const SHIPS: Record<string, ShipDef> = {
  scout: { id: 'scout', name: 'Sky Scout', desc: 'Small, nimble explorer. Basic hold, light guns.', speed: 46, accel: 18, turn: 1.9, hull: 160, fuel: 100, cargo: 20, weapons: ['cannon', 'repeater'], cost: {}, req: 'Starting airship', scale: 1, style: 'balloon' },
  windrunner: { id: 'windrunner', name: 'Windrunner', desc: 'Balanced sailer. Faster, medium hold, bomb bay.', speed: 62, accel: 22, turn: 1.6, hull: 260, fuel: 140, cargo: 50, weapons: ['cannon', 'repeater', 'bomb'], cost: { plank: 30, ingot: 8, sail_silk: 3, gold: 300 }, req: 'Level 3', scale: 1.25, style: 'sails' },
  falcon: { id: 'falcon', name: 'Iron Falcon', desc: 'Armored warship with missile racks and energy cannon.', speed: 54, accel: 20, turn: 1.45, hull: 520, fuel: 180, cargo: 70, weapons: ['cannon', 'repeater', 'missile', 'energy', 'bomb'], cost: { ingot: 25, armor_plate: 4, engine_core: 2, gold: 800 }, req: 'Defeat the Titan Golem', scale: 1.5, style: 'wings' },
  titan: { id: 'titan', name: 'Sky Titan', desc: 'Endgame flagship. Heavy armor, vast hold, all weapons at double power.', speed: 58, accel: 17, turn: 1.15, hull: 1100, fuel: 260, cargo: 160, weapons: ['cannon', 'repeater', 'missile', 'energy', 'bomb'], cost: { ingot: 50, armor_plate: 10, engine_core: 5, cannon_barrel: 4, crystal: 20, gold: 2500 }, req: 'Level 10', scale: 2.1, style: 'balloon' },
};
export const SHIP_REQ: Record<string, { level?: number; boss?: string }> = { scout: {}, windrunner: { level: 3 }, falcon: { boss: 'titan' }, titan: { level: 10 } };
export interface ShipWeapon { id: string; name: string; key: string; cd: number; dmg: number; icon: string }
export const SHIP_WEAPONS: Record<string, ShipWeapon> = {
  cannon: { id: 'cannon', name: 'Cannon', key: '1', cd: 1.1, dmg: 38, icon: '💣' },
  repeater: { id: 'repeater', name: 'Repeater', key: '2', cd: 0.12, dmg: 7, icon: '🔫' },
  missile: { id: 'missile', name: 'Homing Missiles', key: '3', cd: 2.5, dmg: 55, icon: '🚀' },
  energy: { id: 'energy', name: 'Energy Cannon', key: '4', cd: 6, dmg: 160, icon: '☄️' },
  bomb: { id: 'bomb', name: 'Bomb Drop', key: '5', cd: 2.5, dmg: 90, icon: '🧨' },
};
export interface UpgradeDef { id: string; name: string; icon: string; desc: string; max: number; cost: (lvl: number) => Record<string, number> }
export const SHIP_UPGRADES: UpgradeDef[] = [
  { id: 'engine', name: 'Engine', icon: '🌀', desc: '+10% acceleration & better fuel efficiency per level', max: 5, cost: l => ({ engine_core: 1, iron: 6 * (l + 1), gold: 60 * (l + 1) }) },
  { id: 'armor', name: 'Armor', icon: '🛡️', desc: '+20% hull per level', max: 5, cost: l => ({ armor_plate: 1, ingot: 2 * (l + 1), gold: 70 * (l + 1) }) },
  { id: 'weapons', name: 'Weapons', icon: '💣', desc: '+15% airship weapon damage per level', max: 5, cost: l => ({ cannon_barrel: 1, ingot: 2 * (l + 1), gold: 80 * (l + 1) }) },
  { id: 'cargo', name: 'Cargo Hold', icon: '📦', desc: '+25 storage per resource per level', max: 5, cost: l => ({ cargo_net: 1, plank: 5 * (l + 1), gold: 50 * (l + 1) }) },
  { id: 'speed', name: 'Thrusters', icon: '💨', desc: '+8% top speed & boost per level', max: 5, cost: l => ({ engine_core: 1, sail_silk: 1, gold: 90 * (l + 1) }) },
  { id: 'stability', name: 'Stability', icon: '🧭', desc: '+12% steering & less drift per level', max: 5, cost: l => ({ gyro: 1, sail_silk: 1, gold: 60 * (l + 1) }) },
];
export const HULL_COLORS = ['#8a5a34', '#b53a3a', '#2d6bb5', '#2f8f5b', '#e2b23a', '#5b3a8f', '#e8e8f0', '#222831'];
export const SAIL_COLORS = ['#f3ecd8', '#e84a5f', '#4aa3e8', '#7ee08a', '#ffd166', '#b88cff', '#ffffff', '#ff8a3c'];
export const TRIM_COLORS = ['#d4a537', '#c0c8d8', '#4fd8ff', '#ff6a6a', '#8cffb0', '#caa0ff'];
export const DECORS = [{ id: 'flag', name: 'Banner Flag', cost: 40 }, { id: 'lanterns', name: 'Glow Lanterns', cost: 60 }, { id: 'figurehead', name: 'Dragon Figurehead', cost: 120 }, { id: 'runes', name: 'Aether Runes', cost: 150 }, { id: 'ribbons', name: 'Trail Ribbons', cost: 80 }];
export const STYLES = [{ id: 'balloon', name: 'Balloon Envelope' }, { id: 'sails', name: 'Square Sails' }, { id: 'wings', name: 'Glider Wings' }];

export interface BuildingDef { id: string; name: string; icon: string; r: number; cost: Record<string, number>; time: number; desc: string; produces?: [string, number]; hp: number }
export const BUILDINGS: Record<string, BuildingDef> = {
  castle: { id: 'castle', name: 'Main Castle', icon: '🏰', r: 10, cost: { plank: 10, brick: 15, gold: 100 }, time: 18, desc: 'Heart of your kingdom. Gold taxes, +workers, defense core.', produces: ['gold', 0.2], hp: 400 },
  workshop: { id: 'workshop', name: 'Workshop', icon: '🔧', r: 6, cost: { plank: 8, brick: 4, ingot: 2 }, time: 14, desc: 'Builders gather wood & stone. Airship workshop access.', produces: ['wood', 0.18], hp: 150 },
  blacksmith: { id: 'blacksmith', name: 'Blacksmith', icon: '⚒️', r: 5, cost: { brick: 8, ingot: 4, plank: 4 }, time: 14, desc: 'Smelts iron. Enables armor crafting.', produces: ['iron', 0.1], hp: 150 },
  storage: { id: 'storage', name: 'Resource Storage', icon: '📦', r: 5.5, cost: { plank: 10, brick: 4 }, time: 10, desc: '+40 storage per resource per level.', hp: 150 },
  farm: { id: 'farm', name: 'Farm', icon: '🌾', r: 7, cost: { plank: 6, gold: 20 }, time: 10, desc: 'Grows food for your people.', produces: ['food', 0.25], hp: 100 },
  market: { id: 'market', name: 'Market', icon: '🏪', r: 6, cost: { plank: 8, brick: 6, gold: 60 }, time: 14, desc: 'Generates gold from trade.', produces: ['gold', 0.4], hp: 120 },
  barracks: { id: 'barracks', name: 'Barracks', icon: '🛡️', r: 6, cost: { plank: 8, brick: 10, ingot: 4 }, time: 16, desc: 'Trains guards (1 per level + assigned workers).', hp: 200 },
  dock: { id: 'dock', name: 'Airship Dock', icon: '⚓', r: 8, cost: { plank: 14, ingot: 2 }, time: 12, desc: 'Auto-repairs & refuels your docked airship.', hp: 150 },
  tower: { id: 'tower', name: 'Defense Tower', icon: '🗼', r: 3.5, cost: { brick: 12, ingot: 3 }, time: 12, desc: 'Auto-fires at hostiles in range 45.', hp: 200 },
  research: { id: 'research', name: 'Research Tower', icon: '🔭', r: 5, cost: { brick: 10, crystal: 6, plank: 6 }, time: 18, desc: 'Produces research to unlock kingdom upgrades.', hp: 120 },
};
export const BUILD_ORDER = ['castle', 'workshop', 'blacksmith', 'storage', 'farm', 'market', 'barracks', 'dock', 'tower', 'research'];
export const KINGDOM_UPGRADES = [
  { id: 'agri', name: 'Crop Rotation', desc: '+30% food production', cost: 20 },
  { id: 'trade', name: 'Trade Routes', desc: '+30% gold production', cost: 25 },
  { id: 'masonry', name: 'Master Masons', desc: 'Construction 40% faster', cost: 30 },
  { id: 'arms', name: 'Aether Ballistae', desc: '+50% tower damage', cost: 40 },
  { id: 'vault', name: 'Deep Vaults', desc: '+60 storage per resource', cost: 50 },
];

export interface Recipe { id: string; qty: number; cat: 'Materials' | 'Weapons' | 'Armor' | 'Potions' | 'Airship Parts' | 'Magic Items'; cost: Record<string, number>; station?: string; level?: number }
export const RECIPES: Recipe[] = [
  { id: 'plank', qty: 2, cat: 'Materials', cost: { wood: 3 } },
  { id: 'brick', qty: 2, cat: 'Materials', cost: { stone: 3 } },
  { id: 'ingot', qty: 1, cat: 'Materials', cost: { iron: 3, wood: 1 } },
  { id: 'w:spear', qty: 1, cat: 'Weapons', cost: { ingot: 3, plank: 3, hide: 2 }, level: 2 },
  { id: 'w:dual', qty: 1, cat: 'Weapons', cost: { ingot: 5, hide: 3, crystal: 2 }, level: 2 },
  { id: 'w:staff', qty: 1, cat: 'Weapons', cost: { plank: 4, crystal: 4, essence: 4 }, level: 3 },
  { id: 'w:greatsword', qty: 1, cat: 'Weapons', cost: { ingot: 10, hide: 4, fragment: 3 }, level: 4 },
  { id: 'a:leather', qty: 1, cat: 'Armor', cost: { hide: 6, plank: 2 }, level: 1 },
  { id: 'a:iron', qty: 1, cat: 'Armor', cost: { ingot: 8, hide: 4 }, station: 'blacksmith', level: 3 },
  { id: 'a:crystal', qty: 1, cat: 'Armor', cost: { ingot: 8, crystal: 10, frostcore: 2 }, station: 'blacksmith', level: 6 },
  { id: 'a:celestial', qty: 1, cat: 'Armor', cost: { ingot: 15, crystal: 15, essence: 12, voidshard: 3 }, station: 'blacksmith', level: 9 },
  { id: 'hp_potion', qty: 2, cat: 'Potions', cost: { food: 2, essence: 1 } },
  { id: 'mp_potion', qty: 2, cat: 'Potions', cost: { crystal: 1, essence: 1 } },
  { id: 'sp_potion', qty: 2, cat: 'Potions', cost: { food: 2, crystal: 1 } },
  { id: 'engine_core', qty: 1, cat: 'Airship Parts', cost: { ingot: 4, crystal: 3, gear: 2 } },
  { id: 'armor_plate', qty: 1, cat: 'Airship Parts', cost: { ingot: 5, plank: 3 } },
  { id: 'cannon_barrel', qty: 1, cat: 'Airship Parts', cost: { ingot: 5, embercore: 1 } },
  { id: 'cargo_net', qty: 1, cat: 'Airship Parts', cost: { hide: 4, plank: 2 } },
  { id: 'sail_silk', qty: 1, cat: 'Airship Parts', cost: { hide: 2, essence: 2 } },
  { id: 'gyro', qty: 1, cat: 'Airship Parts', cost: { gear: 2, crystal: 2, ingot: 2 } },
  { id: 'fire_scroll', qty: 1, cat: 'Magic Items', cost: { essence: 3, embercore: 1 } },
  { id: 'power_elixir', qty: 1, cat: 'Magic Items', cost: { essence: 4, crystal: 2, food: 2 } },
  { id: 'fuel_cell', qty: 1, cat: 'Magic Items', cost: { crystal: 2, essence: 1 } },
  { id: 'phoenix_feather', qty: 1, cat: 'Magic Items', cost: { essence: 10, embercore: 2, crystal: 5 }, level: 5 },
];
export interface ArmorDef { id: string; name: string; icon: string; def: number }
export const ARMORS: Record<string, ArmorDef> = {
  cloth: { id: 'cloth', name: "Explorer's Garb", icon: '👕', def: 0 },
  leather: { id: 'leather', name: 'Leather Armor', icon: '🦺', def: 0.12 },
  iron: { id: 'iron', name: 'Iron Cuirass', icon: '🥋', def: 0.25 },
  crystal: { id: 'crystal', name: 'Crystalweave', icon: '💠', def: 0.38 },
  celestial: { id: 'celestial', name: 'Celestial Plate', icon: '🔰', def: 0.5 },
};
export const SHOP_BUY = ['hp_potion', 'mp_potion', 'sp_potion', 'food', 'wood', 'stone', 'iron', 'hide'];

export interface Objective { label: string; key: string; n: number }
export interface QuestDef { id: string; title: string; cat: 'Main Story' | 'Exploration' | 'Hunting' | 'Gathering' | 'Airship' | 'Kingdom' | 'Boss'; giver: string; level: number; requires: string[]; desc: string; offer: string; ready: string; done: string; objs: Objective[]; xp: number; rewards: [string, number][]; onAccept?: string }
export const QUESTS: QuestDef[] = [
  { id: 'main_1', title: 'A Fallen Sky', cat: 'Main Story', giver: 'maren', level: 1, requires: [], desc: 'Elder Maren speaks of a wrecked airship at the Old Dock.', offer: "Child of the sky... Aetheria once stood whole. Then came the Shattering, and every kingdom fell apart into drifting stone. They say an airship rests at the Old Dock east of the village. Go — see if she still has the will to fly.", ready: 'You found it? Then the sky remembers us after all.', done: 'Take what you need. The world is waiting.', objs: [{ label: 'Find the airship at the Old Dock', key: 'reach:oldDock', n: 1 }], xp: 40, rewards: [['wood', 5]] },
  { id: 'main_2', title: 'Mending the Skiff', cat: 'Main Story', giver: 'maren', level: 1, requires: ['main_1'], desc: 'Gather materials and repair the Sky Scout.', offer: 'The Scout is battered. Gather 10 wood and 4 iron (chop trees, mine ore — press E near them), then repair her at the dock.', ready: 'She flies again! Remember: Space ascends, C descends, Shift boosts.', done: 'Fly safe, explorer.', objs: [{ label: 'Gather wood', key: 'have:wood', n: 10 }, { label: 'Gather iron', key: 'have:iron', n: 4 }, { label: 'Repair the airship (E at dock)', key: 'count:repair', n: 1 }], xp: 90, rewards: [['gold', 50], ['fuel_cell', 1]] },
  { id: 'main_3', title: 'First Flight', cat: 'Main Story', giver: 'maren', level: 1, requires: ['main_2'], desc: 'Fly east to Haven Isle.', offer: 'East of here lies Haven Isle, a quiet, flat island. It could be the seed of a new kingdom. Fly there and land.', ready: 'Haven Isle... a good omen.', done: 'Steward Pip is camped there to help you build.', objs: [{ label: 'Reach Haven Isle', key: 'reach:haven', n: 1 }], xp: 120, rewards: [['gold', 100], ['plank', 6]] },
  { id: 'kingdom_1', title: 'Founding Haven', cat: 'Kingdom', giver: 'pip', level: 1, requires: ['main_3'], desc: 'Craft building materials and raise a castle.', offer: 'A castle needs 10 planks and 15 bricks plus gold. Craft them in your inventory (press U) — then open the Kingdom menu (K) and place the castle!', ready: 'Magnificent! The banner of a new kingdom flies!', done: 'Now we can truly grow.', objs: [{ label: 'Hold planks', key: 'have:plank', n: 10 }, { label: 'Hold bricks', key: 'have:brick', n: 15 }, { label: 'Build the Main Castle', key: 'build:castle', n: 1 }], xp: 200, rewards: [['gold', 150], ['iron', 6]] },
  { id: 'kingdom_2', title: 'A Working Kingdom', cat: 'Kingdom', giver: 'pip', level: 1, requires: ['kingdom_1'], desc: 'Build a farm and storage, recruit workers.', offer: 'People need food and a place to stow it. Build a farm, a storage house and recruit two workers (Kingdom menu → Workers).', ready: 'Smoke from the chimneys. It feels like home.', done: 'Assign workers to buildings to boost production.', objs: [{ label: 'Build a Farm', key: 'build:farm', n: 1 }, { label: 'Build Storage', key: 'build:storage', n: 1 }, { label: 'Recruit workers', key: 'count:worker', n: 2 }], xp: 260, rewards: [['gold', 200], ['crystal', 4]] },
  { id: 'kingdom_3', title: 'Walls and Watchtowers', cat: 'Kingdom', giver: 'pip', level: 3, requires: ['kingdom_2'], desc: 'Build 2 towers and barracks.', offer: 'Raiders circle the sky. Raise two defense towers and a barracks.', ready: 'Haven will not fall easily now.', done: 'Rest. They will come soon.', objs: [{ label: 'Build Defense Towers', key: 'build:tower', n: 2 }, { label: 'Build Barracks', key: 'build:barracks', n: 1 }], xp: 320, rewards: [['ingot', 6], ['gold', 200]] },
  { id: 'kingdom_4', title: 'Defend Haven', cat: 'Kingdom', giver: 'pip', level: 3, requires: ['kingdom_3'], desc: 'Repel a goblin raid on Haven.', offer: 'Scouts report a raiding party. Be on Haven when they land — protect the castle!', ready: 'You held the line!', done: 'The people sing of you.', objs: [{ label: 'Repel the raid on Haven', key: 'count:defend', n: 1 }], xp: 450, rewards: [['crystal', 10], ['gold', 300]], onAccept: 'raid' },
  { id: 'main_4', title: 'Temple of Awakening', cat: 'Main Story', giver: 'maren', level: 2, requires: ['main_3'], desc: 'Awaken the altar on Whisper Isle.', offer: 'West across the old bridge, the Temple of Whisper Isle sleeps. Wake its altar — but beware its guardians.', ready: 'The temple stirred, and with it, old memories...', done: 'The Shattering was no accident. Something broke the sky... Seek the four great guardians and their artifacts.', objs: [{ label: 'Activate the ancient altar', key: 'count:temple', n: 1 }, { label: 'Defeat awakened guardians', key: 'kill:golem', n: 2 }], xp: 260, rewards: [['fragment', 3], ['temple_key', 1]] },
  { id: 'main_5', title: 'Frozen Echoes', cat: 'Main Story', giver: 'ingrid', level: 3, requires: ['main_4'], desc: 'Retrieve the Frost Sigil from the Frozen Castle.', offer: 'I am Ingrid of Frostfall. The Frost Sigil lies within our frozen castle, guarded by yetis. Bring it back to me.', ready: 'The Sigil hums with the same sorrow as the temple...', done: 'Seek the Titan of Skyruins next.', objs: [{ label: 'Reach the Frozen Castle', key: 'reach:frostcastle', n: 1 }, { label: 'Slay Frost Yetis', key: 'kill:yeti', n: 3 }, { label: 'Recover the Frost Sigil', key: 'have:frost_sigil', n: 1 }], xp: 400, rewards: [['frostcore', 2], ['crystal', 6]] },
  { id: 'main_6', title: 'Heart of Stone', cat: 'Boss', giver: 'zeno', level: 4, requires: ['main_5'], desc: 'Defeat the Titan Golem.', offer: 'Zeno the Archivist. The Titan Golem guards the heart of our machines. It must fall.', ready: 'You felled the Titan!', done: 'Its heart powers old Aetheria... The Iron Falcon blueprints are yours.', objs: [{ label: 'Defeat the TITAN GOLEM', key: 'boss:titan', n: 1 }], xp: 800, rewards: [['gold', 400], ['gear', 5]] },
  { id: 'main_7', title: 'Fire in the Deep', cat: 'Boss', giver: 'hrok', level: 6, requires: ['main_6'], desc: 'Slay the Inferno King.', offer: 'Hrok the Forgemaster. The Inferno King has burned my forge for ten winters. End him.', ready: 'The fire dies. At last.', done: 'My finest steel is yours.', objs: [{ label: 'Defeat the INFERNO KING', key: 'boss:inferno', n: 1 }], xp: 1200, rewards: [['embercore', 3], ['gold', 600]] },
  { id: 'main_8', title: 'Whispers in Shadow', cat: 'Boss', giver: 'nyx', level: 8, requires: ['main_7'], desc: 'Vanquish the Void Colossus.', offer: 'Nyx, Seer of the Shadow Isles. The Colossus is what remains of the Shattering. Destroy it.', ready: 'The void recedes.', done: 'It was born from the catastrophe itself...', objs: [{ label: 'Defeat the VOID COLOSSUS', key: 'boss:void', n: 1 }], xp: 1800, rewards: [['voidshard', 4], ['gold', 800]] },
  { id: 'main_9', title: 'Storm Over Aetheria', cat: 'Boss', giver: 'lumina', level: 10, requires: ['main_8'], desc: 'End the Storm Wyrm — and learn the truth.', offer: 'I am Lumina, Keeper of the Celestial Kingdom. The Storm Wyrm broke Aetheria when it devoured the Sky Heart. Slay it, and the world may be rejoined.', ready: 'You did it. The skies are open.', done: 'Aetheria will rise again — and you are its first king or queen. Continue exploring and building!', objs: [{ label: 'Defeat the STORM WYRM', key: 'boss:wyrm', n: 1 }], xp: 4000, rewards: [['gold', 2000], ['phoenix_feather', 2]] },
  { id: 'hunt_1', title: 'Wolf Trouble', cat: 'Hunting', giver: 'tobin', level: 1, requires: [], desc: 'Cull the sky wolves.', offer: 'Wolves keep stalking my stags and fields. Kill four of them?', ready: 'Peace, at last.', done: 'Take this for your trouble.', objs: [{ label: 'Hunt Sky Wolves', key: 'kill:wolf', n: 4 }], xp: 70, rewards: [['gold', 40], ['hp_potion', 2]] },
  { id: 'hunt_2', title: 'Goblin Raiders', cat: 'Hunting', giver: 'rowan', level: 1, requires: [], desc: 'Break the goblin camp.', offer: 'Guard Rowan. Goblins have camped south of the village. Drive off six.', ready: 'Fine work!', done: 'The village sleeps easier.', objs: [{ label: 'Defeat Goblin Raiders', key: 'kill:goblin', n: 6 }], xp: 120, rewards: [['gold', 80], ['ingot', 2]] },
  { id: 'hunt_3', title: 'Harpy Menace', cat: 'Hunting', giver: 'rowan', level: 2, requires: ['hunt_2'], desc: 'Cull the harpies.', offer: 'Harpies circle the temple road. Bring down four.', ready: 'Skies are clearer.', done: 'Thanks, hero.', objs: [{ label: 'Defeat Gale Harpies', key: 'kill:harpy', n: 4 }], xp: 160, rewards: [['gold', 100], ['essence', 3]] },
  { id: 'hunt_4', title: 'Embers & Ash', cat: 'Hunting', giver: 'hrok', level: 6, requires: [], desc: 'Extinguish fire elementals.', offer: 'Six fire elementals roam my slopes. Put them out.', ready: 'Cooler already.', done: 'Good work.', objs: [{ label: 'Defeat Fire Elementals', key: 'kill:fire', n: 6 }], xp: 400, rewards: [['embercore', 2], ['gold', 200]] },
  { id: 'hunt_5', title: 'Shadow Cull', cat: 'Hunting', giver: 'nyx', level: 8, requires: [], desc: 'Dispel Shade Stalkers.', offer: 'The shades hunger. Dispel eight of them.', ready: 'The dark thins.', done: 'Thank you.', objs: [{ label: 'Defeat Shade Stalkers', key: 'kill:shadow', n: 8 }], xp: 700, rewards: [['voidshard', 2], ['gold', 300]] },
  { id: 'gather_1', title: 'Lumber for Dewmere', cat: 'Gathering', giver: 'brom', level: 1, requires: [], desc: 'Bring 15 wood to Brom.', offer: 'Brom the smith. My furnace is starving. 15 wood, please — chop trees with E.', ready: 'That will do nicely.', done: 'Here, for the effort.', objs: [{ label: 'Gather wood', key: 'have:wood', n: 15 }], xp: 60, rewards: [['gold', 40], ['ingot', 1]] },
  { id: 'gather_2', title: 'Crystals for Lira', cat: 'Gathering', giver: 'lira', level: 2, requires: [], desc: 'Find 6 crystals.', offer: 'Lira the merchant. Crystals sell dearly in the clouds — bring me six. Look in caves and on colder isles.', ready: 'Beautiful!', done: 'A pleasure doing business.', objs: [{ label: 'Gather crystals', key: 'have:crystal', n: 6 }], xp: 130, rewards: [['gold', 120], ['mp_potion', 2]] },
  { id: 'explore_1', title: "Cartographer's Request", cat: 'Exploration', giver: 'kael', level: 1, requires: ['main_2'], desc: 'Discover four islands.', offer: 'Kael, explorer. My map is mostly blank. Discover four islands in your airship and I will pay handsomely.', ready: 'Marvelous cartography!', done: 'Sky-maps are my life.', objs: [{ label: 'Discover new islands', key: 'count:discover', n: 4 }], xp: 250, rewards: [['gold', 150], ['crystal', 3]] },
  { id: 'explore_2', title: 'Hidden Treasures', cat: 'Exploration', giver: 'kael', level: 1, requires: [], desc: 'Find the hidden cave and open chests.', offer: 'Rumor: a cave hides near the waterfall on this very island. Find it, and open 3 treasure chests anywhere.', ready: 'You have the nose of a treasure hunter!', done: 'Keep exploring!', objs: [{ label: 'Find the Hidden Cave', key: 'reach:hiddenCave', n: 1 }, { label: 'Open treasure chests', key: 'count:chest', n: 3 }], xp: 180, rewards: [['gold', 100], ['essence', 3]] },
  { id: 'air_1', title: 'Sky Pirates!', cat: 'Airship', giver: 'lira', level: 2, requires: ['main_2'], desc: 'Sink two pirate airships.', offer: 'Pirates plunder my shipments! Sink two of their airships. They will find you — fly and watch the horizon.', ready: 'Their black sails are ash!', done: 'My trade routes thank you.', objs: [{ label: 'Sink pirate airships', key: 'count:pirate', n: 2 }], xp: 300, rewards: [['gold', 250], ['armor_plate', 1]], onAccept: 'pirates' },
  { id: 'air_2', title: 'Upgrade the Fleet', cat: 'Airship', giver: 'brom', level: 2, requires: ['main_2'], desc: 'Install three airship upgrades.', offer: 'An airship is only as good as her fittings. Craft parts and install three upgrades at the Shipwright (the yard by the Old Dock).', ready: 'She hums like a songbird now!', done: 'Fine work.', objs: [{ label: 'Install airship upgrades', key: 'count:upgrade', n: 3 }], xp: 220, rewards: [['engine_core', 1], ['gold', 100]] },
];

export interface NpcDef { id: string; name: string; role: 'Elder' | 'Blacksmith' | 'Merchant' | 'Farmer' | 'Explorer' | 'Guard' | 'Builder' | 'Keeper'; island: string; lx: number; lz: number; color: string; lines: string[]; shop?: boolean }
export const NPCS: NpcDef[] = [
  { id: 'maren', name: 'Elder Maren', role: 'Elder', island: 'verdant', lx: -8, lz: 14, color: '#7a5aa8', lines: ['The sky was once whole, child.', 'Aetheria... I still dream of its bells.'] },
  { id: 'brom', name: 'Brom the Smith', role: 'Blacksmith', island: 'verdant', lx: -20, lz: 26, color: '#a35a3a', lines: ['Iron sings when struck right.', 'Need parts? Craft them yourself — press U.'] },
  { id: 'lira', name: 'Lira the Merchant', role: 'Merchant', island: 'verdant', lx: 4, lz: 28, color: '#d49a2a', lines: ['Best prices in the clouds!', 'Everything has a price.'], shop: true },
  { id: 'tobin', name: 'Farmer Tobin', role: 'Farmer', island: 'verdant', lx: 12, lz: 6, color: '#7da64a', lines: ['Good soil, bad wolves.', 'Hunt a stag for food — it never goes to waste.'] },
  { id: 'kael', name: 'Kael the Explorer', role: 'Explorer', island: 'verdant', lx: -28, lz: 10, color: '#3aa0b5', lines: ['The horizon is calling.', 'Every island hides a secret.'] },
  { id: 'rowan', name: 'Guard Rowan', role: 'Guard', island: 'verdant', lx: 2, lz: 10, color: '#6a7a9a', lines: ['Stay sharp out there.', 'The goblins are bold lately.'] },
  { id: 'edda', name: 'Guard Edda', role: 'Guard', island: 'verdant', lx: -14, lz: 34, color: '#6a7a9a', lines: ['All quiet... for now.', 'I never sleep on duty.'] },
  { id: 'pip', name: 'Steward Pip', role: 'Builder', island: 'haven', lx: -10, lz: 30, color: '#c0793a', lines: ['This island is perfect for a kingdom!', 'Press K for the Kingdom menu.'] },
  { id: 'ingrid', name: 'Skald Ingrid', role: 'Explorer', island: 'frost', lx: 40, lz: 55, color: '#7fb5e8', lines: ['The cold keeps secrets well.', 'Mind the yetis.'] },
  { id: 'zeno', name: 'Archivist Zeno', role: 'Elder', island: 'ruins', lx: 50, lz: -20, color: '#c9a45a', lines: ['These machines are older than memory.', 'The gears remember.'] },
  { id: 'hrok', name: 'Forgemaster Hrok', role: 'Blacksmith', island: 'ember', lx: -55, lz: 25, color: '#c4452a', lines: ['Hot enough for you?', 'Steel is born in fire.'], shop: true },
  { id: 'nyx', name: 'Seer Nyx', role: 'Keeper', island: 'shadow', lx: 45, lz: 30, color: '#9a5ad0', lines: ['I see your end, and your beginning.', 'The dark remembers.'] },
  { id: 'lumina', name: 'Keeper Lumina', role: 'Keeper', island: 'celestial', lx: -40, lz: 70, color: '#ffe9a0', lines: ['Light endures.', 'The Sky Heart still beats, faintly.'], shop: true },
];

export const TIPS = [
  'Hold the attack button to charge a heavy strike.', 'Dodging grants brief invulnerability.', 'Press E near glowing nodes to gather resources.',
  'Land your airship before exiting with E.', 'Press R in your airship to refuel using crystals or essence.', 'Craft building materials in the Craft menu (U).',
  'Lock onto enemies with Tab or the lock button.', 'Earth Shield absorbs damage — use it on boss telegraphs.', 'Boss red circles show where attacks will land.',
  'Level up to break the storm barriers around new islands.', 'Airship upgrades truly change flight performance.', 'Assign workers to buildings to boost production.',
];
export const xpForLevel = (l: number) => Math.round(60 + 55 * Math.pow(l - 1, 1.55));
