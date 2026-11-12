// ===== TOWER OF INFINITY — static game data & pure generators =====
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'divine';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine'];
export const RARITY: Record<Rarity, { name: string; color: string; hex: number; mult: number; weight: number }> = {
  common: { name: 'Common', color: '#b8c0cc', hex: 0xb8c0cc, mult: 1, weight: 55 },
  uncommon: { name: 'Uncommon', color: '#5fd35f', hex: 0x5fd35f, mult: 1.25, weight: 28 },
  rare: { name: 'Rare', color: '#4aa3ff', hex: 0x4aa3ff, mult: 1.55, weight: 11 },
  epic: { name: 'Epic', color: '#b36bff', hex: 0xb36bff, mult: 1.95, weight: 4 },
  legendary: { name: 'Legendary', color: '#ffb02e', hex: 0xffb02e, mult: 2.5, weight: 1.4 },
  mythic: { name: 'Mythic', color: '#ff4f6d', hex: 0xff4f6d, mult: 3.2, weight: 0.4 },
  divine: { name: 'Divine', color: '#7ffcff', hex: 0x7ffcff, mult: 4.2, weight: 0.1 },
};
export type Slot = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'ring' | 'artifact';
export const SLOTS: Slot[] = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'artifact'];
export type EquipKey = Slot | 'weapon2';
export const EQUIP_KEYS: EquipKey[] = ['weapon', 'weapon2', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'artifact'];
export const SLOT_ICON: Record<Slot, string> = { weapon: '⚔️', helmet: '⛑️', armor: '🛡️', gloves: '🧤', boots: '👢', ring: '💍', artifact: '🔮' };
export type WeaponFamily = 'greatsword' | 'katana' | 'dual' | 'spear' | 'scythe' | 'hammer' | 'staff' | 'dagger';
export const FAMILIES: WeaponFamily[] = ['greatsword', 'katana', 'dual', 'spear', 'scythe', 'hammer', 'staff', 'dagger'];

export interface Stats { atk: number; def: number; hp: number; crit: number; critDmg: number; stamina: number; mana: number }
export const STAT_NAMES: Record<keyof Stats, string> = { atk: 'Attack', def: 'Defense', hp: 'Health', crit: 'Crit Chance', critDmg: 'Crit Damage', stamina: 'Stamina', mana: 'Mana' };
export interface Item {
  id: string; name: string; slot: Slot; rarity: Rarity; tier: number; stats: Partial<Stats>;
  family?: WeaponFamily; set?: string; upg: number; desc: string; boss?: boolean;
}

// ---------- RNG ----------
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- ENEMIES / BOSSES / REGIONS ----------
export type Tpl = 'humanoid' | 'beast' | 'golem' | 'floater' | 'crawler' | 'winged';
export type Arch = 'grunt' | 'assassin' | 'heavy' | 'mage';
export interface EnemyDef {
  name: string; tpl: Tpl; arch: Arch; color: number; accent: number; glow: number;
  head?: string; weapon?: string; extras?: string[]; scale: number; fly?: boolean;
}
export type BossAtkId = 'swing' | 'combo' | 'slam' | 'charge' | 'fan' | 'rain' | 'sweep' | 'summon' | 'nova' | 'beam';
export interface BossDef {
  name: string; title: string; model: string; color: number; accent: number; glow: number; scale: number;
  atks: [BossAtkId, string, number][]; // id, name, min phase
  weapon: { name: string; family: WeaponFamily };
  intro: string; fly?: boolean;
}
export interface SetDef { id: string; name: string; color: number; b2: Partial<Stats>; b4: Partial<Stats>; d2: string; d4: string }
export interface Region {
  id: number; name: string; sub: string; desc: string; floors: [number, number];
  sky: number; fog: number; fogD: number; ground: number; accent: number; glow: number; sun: number; hemi: number;
  ambient: string; hazard: 'pulse' | 'slip' | 'dmg' | 'push'; hazardName: string;
  music: { root: number; scale: number[]; tempo: number; wave: OscillatorType };
  enemies: EnemyDef[]; boss: BossDef; set: SetDef; places: string[]; suffix: string;
}
const E = (name: string, tpl: Tpl, arch: Arch, color: number, accent: number, glow: number, scale = 1, o: Partial<EnemyDef> = {}): EnemyDef => ({ name, tpl, arch, color, accent, glow, scale, ...o });
const MIN = [0, 2, 3, 5, 7, 8, 10], PHR = [0, 2, 4, 5, 7, 9, 11], HARM = [0, 2, 3, 5, 7, 8, 11], LYD = [0, 2, 4, 6, 7, 9, 11], PENT = [0, 3, 5, 7, 10], WHOLE = [0, 2, 4, 6, 8, 10];

export const REGIONS: Region[] = [
  {
    id: 0, name: 'Forgotten Kingdom', sub: 'Floors 1–10', desc: 'Crumbling castles, ruined villages and crypts of a kingdom the tower swallowed.', floors: [1, 10],
    sky: 0x1a2030, fog: 0x1c2233, fogD: 0.018, ground: 0x6d6a66, accent: 0xc9a86a, glow: 0xffb25a, sun: 0xffd9a8, hemi: 0x6a7a9a,
    ambient: 'dust', hazard: 'pulse', hazardName: 'Falling Masonry',
    music: { root: 50, scale: MIN, tempo: 78, wave: 'triangle' },
    enemies: [
      E('Skeleton Warrior', 'humanoid', 'grunt', 0xd8d2bc, 0x7a5a3a, 0x66ffcc, 1, { head: 'skull', weapon: 'sword' }),
      E('Undead Archer', 'humanoid', 'mage', 0xc9c2a8, 0x3a3a2a, 0x88ff99, 1, { head: 'hood', weapon: 'bow' }),
      E('Ruined Guardian', 'golem', 'heavy', 0x7b7d82, 0x3a3d44, 0xffc04a, 1.15, { extras: ['runes'] }),
      E('Ancient Knight', 'humanoid', 'grunt', 0x5a5f78, 0xb89a4a, 0x9acbff, 1.1, { head: 'helm', weapon: 'sword', extras: ['shield', 'cape'] }),
    ],
    boss: {
      name: 'Ancient Ruin Guardian', title: 'Colossus of the Fallen Crown', model: 'colossus', color: 0x8b8d92, accent: 0x3b3e46, glow: 0xffbb44, scale: 1, intro: 'Stone remembers every king. It will remember you.',
      atks: [['swing', 'Ruin Cleave', 1], ['slam', 'Crown Crusher', 1], ['fan', 'Rune Barrage', 1], ['combo', 'Triple Judgement', 2], ['rain', 'Falling Ruins', 2], ['summon', 'Awaken the Fallen', 3], ['sweep', 'Rune Sweep', 3]],
      weapon: { name: 'Ruinbreaker', family: 'greatsword' },
    },
    set: { id: 'ruin', name: 'Ruinbound', color: 0xc9a86a, b2: { def: 0.08 }, b4: { hp: 0.15, atk: 0.06 }, d2: '+8% Defense', d4: '+15% Health, +6% Attack' },
    places: ['Broken Gatehouse', 'Hollow Barracks', 'Forgotten Crypt', 'Ruined Village', 'Collapsed Bridge', 'Moonlit Courtyard', 'Bone Cellar', 'Sunken Chapel', 'Siege Walls', 'Throne of Dust'], suffix: 'of Ruin',
  },
  {
    id: 1, name: 'Frozen Abyss', sub: 'Floors 11–20', desc: 'Glacial caves and ice palaces where the wind itself is hunting you.', floors: [11, 20],
    sky: 0x0e1b2c, fog: 0x15283d, fogD: 0.022, ground: 0xb8d6ea, accent: 0x9fe6ff, glow: 0x66ccff, sun: 0xcfeaff, hemi: 0x88b8e0,
    ambient: 'snow', hazard: 'slip', hazardName: 'Black Ice',
    music: { root: 57, scale: PENT, tempo: 70, wave: 'sine' },
    enemies: [
      E('Frost Wolf', 'beast', 'assassin', 0xdfeaf5, 0x7bb7e0, 0x66e0ff, 1),
      E('Ice Warrior', 'humanoid', 'grunt', 0x8fc4e8, 0xeaf8ff, 0x99f0ff, 1.1, { head: 'helm', weapon: 'axe', extras: ['crystals'] }),
      E('Frozen Mage', 'floater', 'mage', 0xbfe4ff, 0x4a7fb5, 0x77ddff, 1, { extras: ['crystals'] }),
      E('Ice Golem', 'golem', 'heavy', 0x9ed8f5, 0x3a6a90, 0xaaf4ff, 1.3, { extras: ['crystals'] }),
    ],
    boss: {
      name: 'Frost Tyrant', title: 'Sovereign of the Eternal Winter', model: 'colossus', color: 0x8fd0f0, accent: 0x2a4f7a, glow: 0x88eeff, scale: 1.05, intro: 'Kneel, little ember. Winter has no mercy.',
      atks: [['swing', 'Glacier Axe', 1], ['slam', 'Permafrost Slam', 1], ['fan', 'Icicle Volley', 1], ['charge', 'Avalanche Rush', 2], ['rain', 'Blizzard Spears', 2], ['nova', 'Frostwave', 2], ['beam', 'Absolute Zero', 3], ['summon', 'Call of the Pack', 3]],
      weapon: { name: 'Frostfang Glaive', family: 'spear' },
    },
    set: { id: 'frost', name: 'Frostborn', color: 0x9fe6ff, b2: { mana: 0.12 }, b4: { crit: 0.25, critDmg: 0.1 }, d2: '+12% Mana', d4: '+25% Crit, +10% Crit Dmg' },
    places: ['Glacier Mouth', 'Frozen Lake', 'Crystal Cavern', 'Icebound Fortress', 'Howling Pass', 'Hall of Rime', 'Snowbound Keep', 'Shattered Palace', 'Winter Gallery', 'Tyrant’s Throne'], suffix: 'of Frost',
  },
  {
    id: 2, name: 'Infernal Depths', sub: 'Floors 21–30', desc: 'Rivers of lava, burning fortresses and things that thrive in the heat.', floors: [21, 30],
    sky: 0x2a0a06, fog: 0x3a1208, fogD: 0.02, ground: 0x4a3530, accent: 0xff6a2a, glow: 0xff7a22, sun: 0xff9a55, hemi: 0xa05030,
    ambient: 'ember', hazard: 'dmg', hazardName: 'Lava Pools',
    music: { root: 45, scale: PHR, tempo: 96, wave: 'sawtooth' },
    enemies: [
      E('Fire Demon', 'humanoid', 'grunt', 0xc23a22, 0x2a0e0a, 0xffaa22, 1.15, { head: 'demon', weapon: 'sword', extras: ['wings', 'flames'] }),
      E('Lava Beast', 'beast', 'heavy', 0x3a2420, 0xff5a1a, 0xff8a2a, 1.5, { extras: ['flames'] }),
      E('Flame Warrior', 'humanoid', 'assassin', 0x8a2a1a, 0xffcc44, 0xffbb33, 1, { head: 'helm', weapon: 'blades', extras: ['flames'] }),
      E('Infernal Mage', 'floater', 'mage', 0x5a1a14, 0xff7a22, 0xffaa44, 1.1, { extras: ['flames', 'horns'] }),
    ],
    boss: {
      name: 'Infernal Dragon', title: 'Wyrm of the Burning Core', model: 'dragon', color: 0x8a1a10, accent: 0x2a0a08, glow: 0xff8a22, scale: 1, intro: 'The mountain breathes. And it is hungry.',
      atks: [['swing', 'Claw Rend', 1], ['fan', 'Fire Breath Fan', 1], ['charge', 'Magma Dive', 1], ['slam', 'Tail Smash', 2], ['rain', 'Meteor Rain', 2], ['nova', 'Inferno Ring', 2], ['beam', 'Core Beam', 3], ['summon', 'Hatch the Brood', 3]],
      weapon: { name: 'Emberbrand', family: 'katana' },
    },
    set: { id: 'ember', name: 'Emberforged', color: 0xff7a22, b2: { atk: 0.08 }, b4: { atk: 0.15, critDmg: 0.15 }, d2: '+8% Attack', d4: '+15% Attack, +15% Crit Dmg' },
    places: ['Cinder Gate', 'Ashen Causeway', 'Magma Cavern', 'Burning Bastion', 'Obsidian Bridge', 'Smelter’s Pit', 'Ember Fortress', 'River of Fire', 'Scorched Halls', 'Dragon’s Maw'], suffix: 'of Embers',
  },
  {
    id: 3, name: 'Wildwood', sub: 'Floors 31–40', desc: 'A primeval forest of ancient trees, glowing spores and watchful spirits.', floors: [31, 40],
    sky: 0x07160e, fog: 0x0e2a1a, fogD: 0.024, ground: 0x3f6a3a, accent: 0x7dff8a, glow: 0x88ffaa, sun: 0xd8ffb0, hemi: 0x5a9a6a,
    ambient: 'firefly', hazard: 'dmg', hazardName: 'Toxic Bogs',
    music: { root: 52, scale: LYD, tempo: 84, wave: 'triangle' },
    enemies: [
      E('Beast Warrior', 'humanoid', 'grunt', 0x7a5a3a, 0x3a2a1a, 0xffcc66, 1.15, { head: 'horned', weapon: 'axe', extras: ['fur'] }),
      E('Poison Creature', 'crawler', 'mage', 0x6a9a2a, 0xb4ff44, 0xaaff33, 1, { extras: ['spikes'] }),
      E('Forest Spirit', 'floater', 'assassin', 0x4aa86a, 0xeaffd0, 0x99ffbb, 1, { extras: ['antlers'] }),
      E('Giant Insect', 'crawler', 'heavy', 0x3a5a2a, 0xc8a02a, 0xffd040, 1.5, { extras: ['pincers'] }),
    ],
    boss: {
      name: 'Forest Beast King', title: 'Antlered Lord of the Wildwood', model: 'beast', color: 0x6a4a2a, accent: 0x2a4a22, glow: 0x88ff88, scale: 1.05, intro: 'Every root, every leaf — they answer to me.',
      atks: [['swing', 'Savage Claw', 1], ['charge', 'Stampede', 1], ['fan', 'Thorn Volley', 1], ['combo', 'Feral Frenzy', 2], ['slam', 'Earthshatter Pounce', 2], ['rain', 'Spore Bombs', 2], ['summon', 'Call of the Wild', 3], ['nova', 'Roar of Ages', 3]],
      weapon: { name: 'Beastking’s Fangs', family: 'dual' },
    },
    set: { id: 'wild', name: 'Wildheart', color: 0x7dff8a, b2: { hp: 0.1 }, b4: { hp: 0.15, def: 0.1 }, d2: '+10% Health', d4: '+15% Health, +10% Defense' },
    places: ['Mossy Trailhead', 'Whispering Grove', 'Overgrown Temple', 'Spore Hollow', 'Elder Roots', 'Moonwell Glade', 'Thornwall Maze', 'Enchanted Ruins', 'Canopy Bridge', 'Beast King’s Den'], suffix: 'of the Wild',
  },
  {
    id: 4, name: 'Sunken Realm', sub: 'Floors 41–50', desc: 'Drowned temples and ocean caves lit by bioluminescence.', floors: [41, 50],
    sky: 0x041a2a, fog: 0x07304a, fogD: 0.028, ground: 0x4a8aa0, accent: 0x44e0d0, glow: 0x55ffe8, sun: 0x88ffee, hemi: 0x4a9ab8,
    ambient: 'bubble', hazard: 'push', hazardName: 'Whirlpools',
    music: { root: 48, scale: LYD, tempo: 66, wave: 'sine' },
    enemies: [
      E('Sea Warrior', 'humanoid', 'grunt', 0x2a8a9a, 0xe8c050, 0x66ffee, 1.1, { head: 'fish', weapon: 'trident', extras: ['fins'] }),
      E('Aquatic Monster', 'crawler', 'heavy', 0xc8503a, 0x6a2a20, 0xffaa88, 1.5, { extras: ['pincers'] }),
      E('Abyssal Creature', 'winged', 'assassin', 0x1a2a5a, 0x66ffff, 0x44ffee, 1, { extras: ['lure'], fly: true }),
      E('Water Mage', 'floater', 'mage', 0x2a6ac8, 0xbfeaff, 0x55bbff, 1.05, { extras: ['bubbles'] }),
    ],
    boss: {
      name: 'Abyssal Leviathan', title: 'Terror of the Drowned Deep', model: 'leviathan', color: 0x1c3a6a, accent: 0x0a1a30, glow: 0x44ffee, scale: 1, fly: true, intro: 'The deep has waited a thousand years for you.',
      atks: [['swing', 'Jaw Snap', 1], ['fan', 'Torpedo Spray', 1], ['charge', 'Tidal Ram', 1], ['rain', 'Depth Charges', 2], ['nova', 'Tsunami Ring', 2], ['slam', 'Coil Crush', 2], ['beam', 'Abyss Beam', 3], ['summon', 'Spawn of the Deep', 3]],
      weapon: { name: 'Tidal Reaper', family: 'scythe' },
    },
    set: { id: 'tide', name: 'Tidecaller', color: 0x44e0d0, b2: { stamina: 0.15 }, b4: { mana: 0.2, atk: 0.1 }, d2: '+15% Stamina', d4: '+20% Mana, +10% Attack' },
    places: ['Drowned Stair', 'Coral Terrace', 'Sunken Temple', 'Pearl Cavern', 'Kelp Labyrinth', 'Wreck Graveyard', 'Tidal Fortress', 'Glowing Trench', 'Siren’s Hall', 'Leviathan’s Lair'], suffix: 'of the Deep',
  },
  {
    id: 5, name: 'Mechanical Dominion', sub: 'Floors 51–60', desc: 'Neon factories and robotic fortresses that never sleep.', floors: [51, 60],
    sky: 0x080a16, fog: 0x0b1024, fogD: 0.02, ground: 0x2c3444, accent: 0x44ccff, glow: 0xff3df0, sun: 0x9ab8ff, hemi: 0x4a5a8a,
    ambient: 'spark', hazard: 'pulse', hazardName: 'Electric Floor',
    music: { root: 43, scale: MIN, tempo: 112, wave: 'square' },
    enemies: [
      E('Combat Robot', 'humanoid', 'grunt', 0x8a95a8, 0x2a3040, 0x44ccff, 1.1, { head: 'robot', weapon: 'sword', extras: ['antenna'] }),
      E('Mechanical Assassin', 'humanoid', 'assassin', 0x2a2f3a, 0xff3d6a, 0xff3d6a, 1, { head: 'robot', weapon: 'blades' }),
      E('Heavy War Machine', 'golem', 'heavy', 0x5a6070, 0xffaa22, 0xffaa22, 1.4, { extras: ['cannon'] }),
      E('Energy Sentry', 'floater', 'mage', 0x3a4a6a, 0x44ffcc, 0x44ffee, 1, { extras: ['rings'] }),
    ],
    boss: {
      name: 'Mechanical Overlord', title: 'Sovereign Intelligence Unit-0', model: 'overlord', color: 0x5a6478, accent: 0x1a1e2a, glow: 0xff3df0, scale: 1.1, intro: 'Organic variance detected. Initiating correction.',
      atks: [['swing', 'Piston Punch', 1], ['fan', 'Plasma Volley', 1], ['slam', 'Seismic Stomp', 1], ['combo', 'Hammer Protocol', 2], ['sweep', 'Laser Sweep', 2], ['rain', 'Orbital Strike', 2], ['beam', 'Annihilation Ray', 3], ['summon', 'Deploy Drones', 3]],
      weapon: { name: 'Overlord Piston', family: 'hammer' },
    },
    set: { id: 'cog', name: 'Cogwork', color: 0x44ccff, b2: { crit: 0.15 }, b4: { crit: 0.25, atk: 0.1 }, d2: '+15% Crit', d4: '+25% Crit, +10% Attack' },
    places: ['Assembly Line', 'Neon Foundry', 'Coolant Lab', 'Servo Fortress', 'Circuit Vault', 'Reactor Gallery', 'Drone Hangar', 'Data Spire', 'Conveyor Maze', 'Overlord’s Core'], suffix: 'of Cogs',
  },
  {
    id: 6, name: 'Dragon’s Domain', sub: 'Floors 61–70', desc: 'Windswept peaks, dragon nests and volcanic crags above the clouds.', floors: [61, 70],
    sky: 0x3a2a4a, fog: 0x5a3a4a, fogD: 0.012, ground: 0x7a6a62, accent: 0xff9a44, glow: 0xffc060, sun: 0xffc890, hemi: 0xa08aa8,
    ambient: 'ash', hazard: 'pulse', hazardName: 'Falling Boulders',
    music: { root: 46, scale: HARM, tempo: 100, wave: 'sawtooth' },
    enemies: [
      E('Dragon Warrior', 'humanoid', 'grunt', 0x9a3a2a, 0xe8c060, 0xffaa44, 1.2, { head: 'dragon', weapon: 'sword', extras: ['wings', 'horns'] }),
      E('Wyvern', 'winged', 'assassin', 0x6a3a5a, 0xffaa66, 0xff8a44, 1.2, { fly: true }),
      E('Dragon Rider', 'humanoid', 'mage', 0x3a3a5a, 0xe8c060, 0xff6a2a, 1.15, { head: 'helm', weapon: 'spear', extras: ['cape'] }),
      E('Ancient Flying Beast', 'winged', 'heavy', 0x5a5a6a, 0xc8b878, 0xffe090, 1.6, { fly: true, extras: ['horns'] }),
    ],
    boss: {
      name: 'Elder Dragon Emperor', title: 'Sky-Sovereign of Ten Thousand Wings', model: 'dragon', color: 0xc89a2a, accent: 0x5a1a1a, glow: 0xffd860, scale: 1.25, intro: 'I was old when your gods were young.',
      atks: [['swing', 'Imperial Claw', 1], ['fan', 'Golden Flame Fan', 1], ['charge', 'Sky Dive', 1], ['combo', 'Wing Slash Trio', 2], ['rain', 'Star Meteors', 2], ['nova', 'Emperor’s Roar', 2], ['beam', 'Sun Breath', 3], ['sweep', 'Tail Cyclone', 3], ['summon', 'Dragon Guard', 3]],
      weapon: { name: 'Emperor’s Scepter', family: 'staff' },
    },
    set: { id: 'wyrm', name: 'Dragonscale', color: 0xff9a44, b2: { atk: 0.06, def: 0.06 }, b4: { atk: 0.12, hp: 0.12, def: 0.12 }, d2: '+6% Attack/Defense', d4: '+12% Attack/Health/Defense' },
    places: ['Wind Ledge', 'Nest of Cinders', 'Skybridge', 'Volcanic Crag', 'Hoard Cavern', 'Cloudtop Arena', 'Wyrmbone Valley', 'Obsidian Spire', 'Storm Terrace', 'Emperor’s Aerie'], suffix: 'of Wyrms',
  },
  {
    id: 7, name: 'Shadow Dimension', sub: 'Floors 71–80', desc: 'A warped dimension of floating ruins where light is a rumour.', floors: [71, 80],
    sky: 0x0a0414, fog: 0x14082a, fogD: 0.026, ground: 0x2a2038, accent: 0xb06aff, glow: 0xc07aff, sun: 0xb090ff, hemi: 0x4a3a7a,
    ambient: 'wisp', hazard: 'dmg', hazardName: 'Void Rifts',
    music: { root: 41, scale: HARM, tempo: 80, wave: 'sawtooth' },
    enemies: [
      E('Shadow Assassin', 'humanoid', 'assassin', 0x1a1426, 0x8a3aff, 0xb06aff, 1, { head: 'hood', weapon: 'blades', extras: ['cape'] }),
      E('Void Creature', 'crawler', 'heavy', 0x120a22, 0xaa44ff, 0xcc66ff, 1.5, { extras: ['eyes', 'spikes'] }),
      E('Dark Knight', 'humanoid', 'grunt', 0x241a34, 0x7a2aff, 0xaa55ff, 1.2, { head: 'helm', weapon: 'sword', extras: ['shield', 'cape', 'horns'] }),
      E('Illusion Mage', 'floater', 'mage', 0x3a2a5a, 0xff66cc, 0xff66dd, 1.05, { extras: ['eyes', 'horns'] }),
    ],
    boss: {
      name: 'Shadow Monarch', title: 'King of the Hollow Throne', model: 'monarch', color: 0x1c1430, accent: 0x6a2aff, glow: 0xb06aff, scale: 1.1, intro: 'Light was only ever a loan. I am calling it in.',
      atks: [['swing', 'Umbral Cut', 1], ['fan', 'Shade Bolts', 1], ['charge', 'Shadow Step Strike', 1], ['combo', 'Phantom Quintet', 2], ['rain', 'Void Spears', 2], ['nova', 'Eclipse Ring', 2], ['summon', 'Shadow Legion', 3], ['beam', 'Oblivion Ray', 3], ['sweep', 'Blade Orbit', 3]],
      weapon: { name: 'Monarch’s Fang', family: 'dagger' },
    },
    set: { id: 'umbral', name: 'Umbral', color: 0xb06aff, b2: { critDmg: 0.15 }, b4: { critDmg: 0.3, crit: 0.2 }, d2: '+15% Crit Dmg', d4: '+30% Crit Dmg, +20% Crit' },
    places: ['Twilight Landing', 'Shattered Mirror', 'Floating Ruins', 'Hollow Library', 'Gravity Well', 'Echo Chamber', 'Void Fortress', 'Inverted Cathedral', 'Umbral Causeway', 'Hollow Throne'], suffix: 'of Shadows',
  },
  {
    id: 8, name: 'Celestial Heights', sub: 'Floors 81–90', desc: 'Golden temples on floating islands, guarded by faithful divine warriors.', floors: [81, 90],
    sky: 0x3a4a7a, fog: 0x8a9ac8, fogD: 0.011, ground: 0xe8dcb8, accent: 0xffe27a, glow: 0xfff0a0, sun: 0xfff4d0, hemi: 0xc8d8ff,
    ambient: 'feather', hazard: 'pulse', hazardName: 'Smiting Light',
    music: { root: 55, scale: LYD, tempo: 88, wave: 'triangle' },
    enemies: [
      E('Celestial Knight', 'humanoid', 'grunt', 0xe8e4d0, 0xffd04a, 0xfff0a0, 1.2, { head: 'helm', weapon: 'sword', extras: ['shield', 'cape', 'halo'] }),
      E('Angelic Warrior', 'humanoid', 'assassin', 0xf8f4ea, 0xffe27a, 0xffffff, 1.05, { head: 'plain', weapon: 'blades', extras: ['wings', 'halo'] }),
      E('Divine Archer', 'humanoid', 'mage', 0xd8e4ff, 0xffe27a, 0xaaddff, 1.05, { head: 'hood', weapon: 'bow', extras: ['wings', 'halo'] }),
      E('Holy Guardian', 'golem', 'heavy', 0xf2e8c0, 0xc89a2a, 0xffe27a, 1.45, { extras: ['halo', 'runes'] }),
    ],
    boss: {
      name: 'Celestial Archon', title: 'Seraph of the Final Verdict', model: 'archon', color: 0xf4eed8, accent: 0xc89a2a, glow: 0xfff2a0, scale: 1.15, intro: 'Judgement is mercy, mortal. Receive it.',
      atks: [['swing', 'Radiant Cleave', 1], ['fan', 'Feather Storm', 1], ['slam', 'Heaven’s Hammer', 1], ['combo', 'Seven Trumpets', 2], ['rain', 'Judgement Rays', 2], ['nova', 'Halo Burst', 2], ['beam', 'Final Verdict', 3], ['summon', 'Host of Heaven', 3], ['charge', 'Ascendant Lance', 3]],
      weapon: { name: 'Archon’s Radiance', family: 'katana' },
    },
    set: { id: 'radiant', name: 'Radiant', color: 0xffe27a, b2: { hp: 0.08, mana: 0.1 }, b4: { hp: 0.2, def: 0.15, mana: 0.15 }, d2: '+8% Health, +10% Mana', d4: '+20% Health, +15% Def, +15% Mana' },
    places: ['Cloud Stair', 'Gilded Courtyard', 'Floating Gardens', 'Sun Temple', 'Choir Terrace', 'Heavenly Palace', 'Bridge of Light', 'Seraph Hall', 'Divine Battlefield', 'Archon’s Sanctum'], suffix: 'of Radiance',
  },
  {
    id: 9, name: 'Infinity Core', sub: 'Floors 91–100', desc: 'The origin of the tower: cosmic geometry, dimensional tears and the thing that built it.', floors: [91, 100],
    sky: 0x020208, fog: 0x080818, fogD: 0.014, ground: 0x1a1a38, accent: 0x66ffee, glow: 0xff55ff, sun: 0xaabbff, hemi: 0x6a5aaa,
    ambient: 'star', hazard: 'push', hazardName: 'Gravity Anomalies',
    music: { root: 38, scale: WHOLE, tempo: 92, wave: 'sine' },
    enemies: [
      E('Ancient Guardian', 'golem', 'heavy', 0x2a2a4a, 0x66ffee, 0x66ffee, 1.5, { extras: ['runes', 'rings'] }),
      E('Dimensional Creature', 'crawler', 'assassin', 0x3a1a6a, 0xff55ff, 0xff66ff, 1.1, { extras: ['eyes', 'spikes'] }),
      E('Cosmic Warrior', 'humanoid', 'grunt', 0x1a1a4a, 0xffd860, 0x88aaff, 1.25, { head: 'helm', weapon: 'sword', extras: ['cape', 'halo', 'crystals'] }),
      E('Infinity Being', 'floater', 'mage', 0xe8e8ff, 0x8a5aff, 0xffffff, 1.2, { extras: ['rings', 'eyes'] }),
    ],
    boss: {
      name: 'Infinity Devourer', title: 'The Hunger Beyond the Last Floor', model: 'devourer', color: 0x08060f, accent: 0xff55ff, glow: 0x66ffee, scale: 1.2, fly: true, intro: '......... (the tower itself trembles) .........',
      atks: [['swing', 'Maw Strike', 1], ['fan', 'Stellar Barrage', 1], ['slam', 'Singularity Slam', 1], ['charge', 'Event Horizon', 2], ['rain', 'Falling Stars', 2], ['nova', 'Cosmic Ring', 2], ['combo', 'Devouring Trinity', 2], ['sweep', 'Orbital Cleave', 3], ['beam', 'Big Crunch', 3], ['summon', 'Echoes of Infinity', 3]],
      weapon: { name: 'Devourer’s Eclipse', family: 'scythe' },
    },
    set: { id: 'infinity', name: 'Infinity', color: 0xff55ff, b2: { atk: 0.1, crit: 0.1 }, b4: { atk: 0.25, critDmg: 0.25, hp: 0.15 }, d2: '+10% Attack, +10% Crit', d4: '+25% Attack, +25% Crit Dmg, +15% Health' },
    places: ['Starlit Threshold', 'Fractured Axis', 'Chrono Atrium', 'Quantum Galleries', 'Mirror of Origins', 'Nebula Walk', 'Eventide Spire', 'Zero Point', 'Last Ascent', 'Heart of Infinity'], suffix: 'of Infinity',
  },
];
export const SETS = REGIONS.map((r) => r.set);
export const regionOfFloor = (n: number) => Math.min(9, Math.floor((Math.max(1, n) - 1) / 10));

// ---------- WEAPONS ----------
export interface AtkDef { dur: number; hits: number[]; range: number; arc: number; dmg: number; knock: number; lunge: number; pose: string; launch?: boolean; slam?: boolean; proj?: boolean; stagger?: number }
export interface WeaponDef {
  name: string; spd: number; dmg: number; color: number; glow: number; combo: AtkDef[]; heavy: AtkDef; counter: AtkDef; counterName: string;
  guard: string; guardName: string; ult: 'cataclysm' | 'bladestorm' | 'tempest' | 'starfall'; ultName: string; desc: string;
}
const A = (dur: number, hits: number[], range: number, arc: number, dmg: number, knock: number, lunge: number, pose: string, o: Partial<AtkDef> = {}): AtkDef => ({ dur, hits, range, arc, dmg, knock, lunge, pose, ...o });
export const WEAPONS: Record<WeaponFamily, WeaponDef> = {
  greatsword: {
    name: 'Greatsword', spd: 0.85, dmg: 1.3, color: 0xcfe6ff, glow: 0x66aaff, desc: 'Slow, devastating arcs. Third strike staggers.',
    combo: [A(0.6, [0.5], 3.4, 2.2, 1, 3, 2.4, 'R'), A(0.6, [0.5], 3.4, 2.2, 1.05, 3, 2.4, 'L'), A(0.85, [0.55], 3.8, 1.9, 1.8, 7, 3, 'O', { stagger: 1 })],
    heavy: A(1.0, [0.62], 4.2, 2.6, 3.2, 9, 3, 'O', { launch: true, stagger: 1 }),
    counter: A(0.7, [0.45], 4.5, 2.4, 4.5, 10, 0, 'O', { launch: true }), counterName: 'Titan Riposte', guard: 'vertical', guardName: 'Fortress Guard', ult: 'cataclysm', ultName: 'Worldsplitter',
  },
  katana: {
    name: 'Katana', spd: 1.25, dmg: 1, color: 0xe8f0ff, glow: 0xaaccff, desc: 'Fast, precise cuts. Final rising slash launches.',
    combo: [A(0.34, [0.45], 3.0, 1.9, 0.85, 2, 2.2, 'R'), A(0.34, [0.45], 3.0, 1.9, 0.85, 2, 2.2, 'L'), A(0.38, [0.5], 3.6, 0.7, 1, 2, 3.4, 'T'), A(0.5, [0.5], 3.2, 1.8, 1.4, 4, 2, 'U', { launch: true })],
    heavy: A(0.7, [0.55], 6, 0.9, 2.6, 6, 7, 'T', { stagger: 1 }),
    counter: A(0.5, [0.4], 4.5, 2.2, 4, 6, 5, 'R', { stagger: 1 }), counterName: 'Moonlit Iai', guard: 'horizontal', guardName: 'Sheathed Deflection', ult: 'bladestorm', ultName: 'Thousand Cuts',
  },
  dual: {
    name: 'Dual Blades', spd: 1.55, dmg: 0.78, color: 0xffd0e0, glow: 0xff7aa8, desc: 'Blinding five-hit flurries. Hard to stop.',
    combo: [A(0.24, [0.5], 2.5, 1.8, 0.62, 1.2, 1.5, 'R'), A(0.24, [0.5], 2.5, 1.8, 0.62, 1.2, 1.5, 'L'), A(0.24, [0.5], 2.5, 1.8, 0.62, 1.2, 1.5, 'R'), A(0.24, [0.5], 2.5, 1.8, 0.62, 1.2, 1.5, 'L'), A(0.5, [0.35, 0.65], 3, 2.2, 0.9, 4, 1.5, 'X')],
    heavy: A(0.8, [0.3, 0.5, 0.7], 3.6, 6.28, 1.2, 3, 0, 'S', { stagger: 1 }),
    counter: A(0.55, [0.3, 0.5, 0.7], 3.6, 3, 1.8, 3, 4, 'X', { stagger: 1 }), counterName: 'Crossing Reprisal', guard: 'cross', guardName: 'Crossguard Deflection', ult: 'bladestorm', ultName: 'Dancing Tempest',
  },
  spear: {
    name: 'Spear', spd: 1.0, dmg: 1.05, color: 0xdff4ff, glow: 0x66ddff, desc: 'Long reach thrusts and a sweeping finisher.',
    combo: [A(0.42, [0.45], 4.6, 0.6, 0.95, 2.5, 2.8, 'T'), A(0.42, [0.45], 4.6, 0.6, 0.95, 2.5, 2.8, 'T'), A(0.7, [0.5], 4.2, 2.8, 1.5, 6, 1.5, 'S', { stagger: 1 })],
    heavy: A(0.9, [0.5], 7, 0.8, 2.8, 8, 7, 'T', { stagger: 1 }),
    counter: A(0.55, [0.4], 6.5, 0.9, 4.2, 9, 6, 'T', { launch: true }), counterName: 'Piercing Retort', guard: 'low', guardName: 'Spinning Ward', ult: 'tempest', ultName: 'Dragon Spiral',
  },
  scythe: {
    name: 'Scythe', spd: 0.95, dmg: 1.12, color: 0xd0c8ff, glow: 0xaa66ff, desc: 'Wide reaping arcs that catch whole crowds.',
    combo: [A(0.5, [0.5], 3.8, 2.8, 0.95, 3, 1.5, 'R'), A(0.5, [0.5], 3.8, 2.8, 0.95, 3, 1.5, 'L'), A(0.75, [0.4, 0.65], 4, 4.5, 1.2, 5, 1, 'S', { launch: true })],
    heavy: A(1.0, [0.45, 0.65], 4.5, 6.28, 1.9, 7, 0, 'S', { launch: true, stagger: 1 }),
    counter: A(0.7, [0.4, 0.6], 4.5, 6.28, 2.6, 8, 0, 'S', { stagger: 1 }), counterName: 'Reaper’s Rebuke', guard: 'horizontal', guardName: 'Reaping Ward', ult: 'tempest', ultName: 'Soul Harvest',
  },
  hammer: {
    name: 'War Hammer', spd: 0.7, dmg: 1.6, color: 0xffd9a0, glow: 0xffaa44, desc: 'Crushing blows. Shatters guards and armor.',
    combo: [A(0.7, [0.55], 3.2, 2.0, 1.3, 5, 2, 'O', { stagger: 1 }), A(0.7, [0.55], 3.2, 2.0, 1.3, 5, 2, 'R', { stagger: 1 }), A(1.0, [0.6], 3.8, 3.2, 2.4, 9, 2, 'O', { slam: true, stagger: 1 })],
    heavy: A(1.25, [0.65], 4.4, 6.28, 4.2, 11, 0, 'O', { slam: true, launch: true, stagger: 2 }),
    counter: A(0.8, [0.5], 4.5, 3.2, 5, 11, 2, 'U', { launch: true, stagger: 2 }), counterName: 'Anvil Uppercut', guard: 'overhead', guardName: 'Bulwark Block', ult: 'cataclysm', ultName: 'Meteor Hammer',
  },
  staff: {
    name: 'Magic Staff', spd: 1.05, dmg: 0.9, color: 0xb8e8ff, glow: 0x66ccff, desc: 'Fires arcane bolts. Heavy attack detonates.',
    combo: [A(0.38, [0.45], 16, 0.4, 0.7, 1.5, 0, 'C', { proj: true }), A(0.38, [0.45], 16, 0.4, 0.7, 1.5, 0, 'C', { proj: true }), A(0.6, [0.5], 5, 6.28, 1.4, 6, 0, 'C', { stagger: 1 })],
    heavy: A(1.0, [0.6], 6.5, 6.28, 3.0, 9, 0, 'C', { launch: true, stagger: 1 }),
    counter: A(0.6, [0.45], 8, 6.28, 4, 9, 0, 'C', { launch: true, stagger: 1 }), counterName: 'Arcane Riposte', guard: 'staff', guardName: 'Mana Ward', ult: 'starfall', ultName: 'Astral Judgement',
  },
  dagger: {
    name: 'Daggers', spd: 1.7, dmg: 0.7, color: 0xe0e8f0, glow: 0x88ffcc, desc: 'Lightning-fast stabs. Deadly from behind.',
    combo: [A(0.22, [0.5], 2.2, 1.6, 0.6, 1, 1.8, 'T'), A(0.22, [0.5], 2.2, 1.6, 0.6, 1, 1.8, 'R'), A(0.22, [0.5], 2.2, 1.6, 0.6, 1, 1.8, 'L'), A(0.4, [0.5], 2.6, 1.8, 1.2, 4, 2.4, 'U', { launch: true })],
    heavy: A(0.65, [0.5], 5, 1, 2.4, 5, 6, 'T', { stagger: 1 }),
    counter: A(0.45, [0.4], 3.5, 3, 4, 5, 4, 'X', { stagger: 1 }), counterName: 'Shadow Backstab', guard: 'reverse', guardName: 'Reverse Grip Parry', ult: 'bladestorm', ultName: 'Phantom Assault',
  },
};

// ---------- SKILLS ----------
export type SkillCat = 'physical' | 'elemental' | 'shadow' | 'arcane';
export interface SkillDef { id: string; name: string; cat: SkillCat; icon: string; desc: string; mana: number; cd: number; dmg: number; range: number; cast: number; color: number; up: string }
const S = (id: string, name: string, cat: SkillCat, icon: string, desc: string, mana: number, cd: number, dmg: number, range: number, cast: number, color: number, up: string): SkillDef => ({ id, name, cat, icon, desc, mana, cd, dmg, range, cast, color, up });
export const SKILLS: SkillDef[] = [
  S('wave', 'Crescent Wave', 'physical', '🌙', 'Hurl a piercing crescent of force.', 12, 4, 2.0, 16, 0.25, 0xcfe6ff, '+1 wave at Lv3 & Lv5'),
  S('crush', 'Heavy Crush', 'physical', '💥', 'Smash the ground, knocking foes down.', 16, 7, 3.0, 5.5, 0.45, 0xffaa55, 'Larger radius each level'),
  S('rend', 'Sky Rend', 'physical', '🗡️', 'Launch enemies skyward and follow up.', 14, 6, 2.2, 5, 0.3, 0xffe9a0, 'Higher launch at Lv3 & Lv5'),
  S('flurry', 'Blade Flurry', 'physical', '🌀', 'A spinning storm of rapid cuts.', 20, 9, 0.55, 4.5, 0.2, 0xffffff, '+2 hits at Lv3 & Lv5'),
  S('rush', 'Piercing Rush', 'physical', '➡️', 'Dash through foes with a thrust.', 14, 5, 2.4, 9, 0.2, 0xaaeeff, 'Longer dash each level'),
  S('fireball', 'Fireball', 'elemental', '🔥', 'Launch an exploding fireball.', 18, 5, 2.8, 20, 0.3, 0xff7a22, '+1 fireball at Lv3 & Lv5'),
  S('lance', 'Ice Lance', 'elemental', '❄️', 'Piercing ice that slows enemies.', 14, 4, 2.2, 22, 0.25, 0x88eeff, '+1 lance at Lv3 & Lv5'),
  S('lightning', 'Lightning Strike', 'elemental', '⚡', 'Call bolts down on nearby foes.', 22, 8, 3.0, 16, 0.3, 0xffee66, '+1 bolt each level'),
  S('quake', 'Earthquake', 'elemental', '🌋', 'Shockwaves tear through the earth.', 26, 10, 3.2, 9, 0.5, 0xc89a55, 'Wider shockwave each level'),
  S('elexp', 'Elemental Explosion', 'elemental', '☄️', 'Detonate stored elements around you.', 34, 14, 5.0, 8, 0.7, 0xff66ff, 'Radius & damage grow'),
  S('teleport', 'Shadow Step', 'shadow', '👣', 'Blink behind a foe with a slash.', 14, 4, 1.8, 14, 0.12, 0xaa66ff, 'Shorter cooldown'),
  S('clones', 'Shadow Clones', 'shadow', '👥', 'Summon clones that strike for you.', 28, 14, 1.0, 12, 0.3, 0x8844ff, '+1 clone at Lv3 & Lv5'),
  S('shadowblade', 'Shadow Blade', 'shadow', '🌑', 'Fan of dark blades.', 16, 5, 1.8, 15, 0.25, 0x9955ff, '+2 blades at Lv3 & Lv5'),
  S('invis', 'Vanish', 'shadow', '🫥', 'Become unseen; next strike crits.', 20, 14, 2.0, 0, 0.2, 0x6644aa, 'Longer duration'),
  S('darkexp', 'Dark Explosion', 'shadow', '🕳️', 'A delayed implosion of darkness.', 30, 11, 4.5, 7, 0.4, 0xaa22ff, 'Larger radius each level'),
  S('beam', 'Energy Beam', 'arcane', '🔷', 'Channel a ravaging beam.', 30, 10, 0.5, 16, 0.2, 0x66ddff, 'Longer channel each level'),
  S('gravity', 'Gravity Pull', 'arcane', '🌌', 'Drag enemies into a crushing well.', 24, 12, 2.6, 10, 0.35, 0xaa88ff, 'Stronger pull & range'),
  S('barrier', 'Magical Barrier', 'arcane', '🛡️', 'A shield that absorbs damage.', 22, 16, 1.0, 0, 0.25, 0x66ccff, 'Absorbs more damage'),
  S('dimslash', 'Dimensional Slash', 'arcane', '✴️', 'Rip a long rift through reality.', 28, 9, 4.0, 15, 0.35, 0xff66ee, 'Longer & wider rift'),
  S('arcexp', 'Arcane Explosion', 'arcane', '💫', 'Burst of raw arcane power.', 32, 13, 4.8, 8.5, 0.5, 0xcc88ff, 'Radius & damage grow'),
];
export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const skillScale = (def: SkillDef, lv: number) => ({
  dmg: def.dmg * (1 + 0.22 * (lv - 1)), cd: def.cd * (1 - 0.06 * (lv - 1)), range: def.range * (1 + 0.06 * (lv - 1)), mana: def.mana,
});

// ---------- ITEMS ----------
const BASES: Record<Slot, string[]> = {
  weapon: [], helmet: ['Helm', 'Circlet', 'Hood', 'Crown'], armor: ['Cuirass', 'Plate', 'Robes', 'Mail'], gloves: ['Gauntlets', 'Gloves', 'Grips'],
  boots: ['Greaves', 'Boots', 'Sabatons'], ring: ['Ring', 'Band', 'Signet'], artifact: ['Relic', 'Talisman', 'Orb', 'Sigil'],
};
const WBASE: Record<WeaponFamily, string[]> = {
  greatsword: ['Greatsword', 'Claymore', 'Zweihander'], katana: ['Katana', 'Tachi', 'Nodachi'], dual: ['Twin Blades', 'Dual Falchions', 'Kembu Pair'],
  spear: ['Spear', 'Lance', 'Halberd'], scythe: ['Scythe', 'Reaper', 'Harvester'], hammer: ['War Hammer', 'Maul', 'Crusher'],
  staff: ['Staff', 'Scepter', 'Wand'], dagger: ['Dagger', 'Kris', 'Stiletto'],
};
const PREFIX: Record<Rarity, string[]> = {
  common: ['Worn', 'Plain', 'Rusty', 'Simple'], uncommon: ['Sturdy', 'Honed', 'Tempered'], rare: ['Fine', 'Runed', 'Gleaming'],
  epic: ['Exalted', 'Arcane', 'Royal'], legendary: ['Ancient', 'Heroic', 'Radiant'], mythic: ['Mythic', 'Cursed', 'Transcendent'], divine: ['Divine', 'Godforged', 'Celestial'],
};
const DESCS: Record<Slot, string> = {
  weapon: 'A weapon forged for those who climb.', helmet: 'Protects the mind of the climber.', armor: 'Armor worn by countless fallen heroes.',
  gloves: 'Grips tighter as the tower grows darker.', boots: 'Steps lightly on cursed stone.', ring: 'A ring humming with quiet power.', artifact: 'A relic from the tower’s forgotten halls.',
};
let uid = 0;
export const newId = () => Date.now().toString(36) + (uid++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];

export function rollRarity(floor: number, luck = 0, min: Rarity = 'common', r: () => number = Math.random): Rarity {
  const shift = 1 + floor * 0.02 + luck;
  let total = 0;
  const w = RARITIES.map((k, i) => { const v = RARITY[k].weight * (i === 0 ? 1 / shift : Math.pow(shift, i * 0.9)); total += v; return v; });
  let x = r() * total, idx = 0;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { idx = i; break; } idx = i; }
  return RARITIES[Math.max(idx, RARITIES.indexOf(min))];
}
export function rollItem(floor: number, o: { min?: Rarity; luck?: number; slot?: Slot; rarity?: Rarity; family?: WeaponFamily; region?: number; set?: boolean; r?: () => number } = {}): Item {
  const r = o.r || Math.random;
  const reg = REGIONS[o.region ?? regionOfFloor(floor)];
  const rarity = o.rarity || rollRarity(floor, o.luck || 0, o.min || 'common', r);
  const slot = o.slot || pick(SLOTS, r);
  const m = RARITY[rarity].mult, sc = 1 + floor * 0.14, v = () => 0.9 + r() * 0.2;
  const stats: Partial<Stats> = {};
  let family: WeaponFamily | undefined, base: string;
  if (slot === 'weapon') {
    family = o.family || pick(FAMILIES, r);
    base = pick(WBASE[family], r);
    stats.atk = Math.round((8 + floor * 3.2) * m * v() * (WEAPONS[family].dmg * 0.4 + 0.6));
    if (rarity !== 'common') stats.crit = Math.round((2 + r() * 3) * m * 10) / 10;
    if (RARITIES.indexOf(rarity) >= 3) stats.critDmg = Math.round(10 * m * v());
  } else {
    base = pick(BASES[slot], r);
    const P = (x: number) => Math.round(x * sc * m * v());
    if (slot === 'helmet') { stats.def = P(3); stats.hp = P(14); }
    if (slot === 'armor') { stats.def = P(5); stats.hp = P(26); }
    if (slot === 'gloves') { stats.atk = P(2.2); stats.crit = Math.round((1.5 + r() * 2) * m * 10) / 10; }
    if (slot === 'boots') { stats.def = P(2.5); stats.stamina = P(7); }
    if (slot === 'ring') { stats.crit = Math.round((2 + r() * 3) * m * 10) / 10; stats.critDmg = Math.round(8 * m * v()); }
    if (slot === 'artifact') { stats.mana = P(10); stats.atk = P(1.6); stats.hp = P(8); }
    if (RARITIES.indexOf(rarity) >= 2 && r() < 0.6) { const extra = pick(['atk', 'def', 'hp'] as const, r); if (stats[extra] === undefined) stats[extra] = P(extra === 'hp' ? 10 : 2); }
  }
  const set = slot !== 'weapon' && (o.set || r() < 0.18 + RARITIES.indexOf(rarity) * 0.05) ? reg.set.id : undefined;
  const name = `${pick(PREFIX[rarity], r)} ${base} ${reg.suffix}`;
  return { id: newId(), name, slot, rarity, tier: floor, stats, family, set, upg: 0, desc: DESCS[slot] };
}
export function bossDrop(region: number, floor: number): Item {
  const reg = REGIONS[region];
  const slots: Slot[] = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'artifact'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const rarity: Rarity = Math.random() < 0.06 ? 'divine' : Math.random() < 0.2 ? 'mythic' : Math.random() < 0.6 ? 'legendary' : 'epic';
  if (slot === 'weapon' || Math.random() < 0.15) {
    const it = rollItem(floor + 2, { slot: 'weapon', rarity, family: reg.boss.weapon.family, region });
    it.name = reg.boss.weapon.name; it.boss = true; it.desc = `Exclusive spoils from ${reg.boss.name}.`;
    return it;
  }
  const it = rollItem(floor + 2, { slot, rarity, region, set: true });
  it.set = reg.set.id; it.boss = true; it.name = `${reg.set.name} ${BASES[slot][Math.floor(Math.random() * BASES[slot].length)]}`;
  it.desc = `${reg.set.name} set — dropped by ${reg.boss.name}.`;
  return it;
}
export const upgradeMult = (it: Item) => 1 + 0.1 * it.upg;
export const upgradeCost = (it: Item) => ({ gold: Math.round(60 * (it.upg + 1) * (1 + it.tier * 0.12) * (1 + RARITIES.indexOf(it.rarity) * 0.3)), ess: it.upg + 1 });
export const sellValue = (it: Item) => Math.round((12 + it.tier * 6) * RARITY[it.rarity].mult * RARITY[it.rarity].mult * (1 + it.upg * 0.4));
export const buyValue = (it: Item) => sellValue(it) * 4;
export const starterItems = (): Item[] => [
  { id: newId(), name: 'Traveler’s Katana', slot: 'weapon', rarity: 'common', tier: 1, stats: { atk: 10 }, family: 'katana', upg: 0, desc: 'A reliable blade for a new climber.' },
  { id: newId(), name: 'Iron Greatsword', slot: 'weapon', rarity: 'common', tier: 1, stats: { atk: 13 }, family: 'greatsword', upg: 0, desc: 'Heavy, honest steel.' },
];

// ---------- ACHIEVEMENTS ----------
export interface RunStats { kills: number; parries: number; perfect: number; dodges: number; bosses: number; maxCombo: number; chests: number; floors: number; secrets: number; awaken: number; endless: number; noHitBoss: number; legendary: number; deaths: number; skills: number; ults: number; rush: number }
export const emptyStats = (): RunStats => ({ kills: 0, parries: 0, perfect: 0, dodges: 0, bosses: 0, maxCombo: 0, chests: 0, floors: 0, secrets: 0, awaken: 0, endless: 0, noHitBoss: 0, legendary: 0, deaths: 0, skills: 0, ults: 0, rush: 0 });
export const ACHIEVEMENTS: { id: string; name: string; desc: string; icon: string; test: (s: RunStats, hi: number, lv: number) => boolean; gold: number }[] = [
  { id: 'first', name: 'First Blood', desc: 'Defeat your first enemy.', icon: '🗡️', test: (s) => s.kills >= 1, gold: 50 },
  { id: 'slayer', name: 'Monster Slayer', desc: 'Defeat 200 enemies.', icon: '💀', test: (s) => s.kills >= 200, gold: 400 },
  { id: 'perfect', name: 'Perfect Timing', desc: 'Land a perfect deflection.', icon: '✨', test: (s) => s.perfect >= 1, gold: 100 },
  { id: 'perfect50', name: 'Unbreakable Guard', desc: 'Land 50 perfect deflections.', icon: '🛡️', test: (s) => s.perfect >= 50, gold: 600 },
  { id: 'dodge', name: 'Ghost Step', desc: 'Dodge 50 times.', icon: '💨', test: (s) => s.dodges >= 50, gold: 200 },
  { id: 'combo30', name: 'Combo Artist', desc: 'Reach a 30-hit combo.', icon: '🔥', test: (s) => s.maxCombo >= 30, gold: 300 },
  { id: 'boss1', name: 'Guardian Slayer', desc: 'Defeat a region guardian.', icon: '👑', test: (s) => s.bosses >= 1, gold: 300 },
  { id: 'boss5', name: 'Half the Pantheon', desc: 'Defeat 5 guardians.', icon: '🏆', test: (s) => s.bosses >= 5, gold: 1500 },
  { id: 'nohit', name: 'Untouchable', desc: 'Defeat a boss without taking damage.', icon: '🌟', test: (s) => s.noHitBoss >= 1, gold: 800 },
  { id: 'chest', name: 'Treasure Hunter', desc: 'Open 20 chests.', icon: '🧰', test: (s) => s.chests >= 20, gold: 300 },
  { id: 'secret', name: 'Secret Seeker', desc: 'Discover a secret floor.', icon: '🔮', test: (s) => s.secrets >= 1, gold: 300 },
  { id: 'awaken', name: 'Awakened', desc: 'Awaken your true power.', icon: '🌅', test: (s) => s.awaken >= 1, gold: 150 },
  { id: 'f10', name: 'Out of the Ruins', desc: 'Reach floor 10.', icon: '🏰', test: (_s, hi) => hi >= 10, gold: 250 },
  { id: 'f50', name: 'Halfway Up', desc: 'Reach floor 50.', icon: '🗼', test: (_s, hi) => hi >= 50, gold: 1500 },
  { id: 'f100', name: 'Infinity Reached', desc: 'Reach floor 100.', icon: '♾️', test: (_s, hi) => hi >= 100, gold: 5000 },
  { id: 'lv10', name: 'Seasoned', desc: 'Reach level 10.', icon: '⭐', test: (_s, _h, lv) => lv >= 10, gold: 200 },
  { id: 'lv30', name: 'Veteran', desc: 'Reach level 30.', icon: '🌠', test: (_s, _h, lv) => lv >= 30, gold: 1000 },
  { id: 'legend', name: 'Legend Found', desc: 'Find a Legendary or better item.', icon: '💎', test: (s) => s.legendary >= 1, gold: 500 },
  { id: 'endless10', name: 'Endless Warrior', desc: 'Reach wave 10 in Endless Dungeon.', icon: '🌊', test: (s) => s.endless >= 10, gold: 700 },
  { id: 'rush', name: 'Boss Rusher', desc: 'Win a Boss Rush.', icon: '⚔️', test: (s) => s.rush >= 1, gold: 800 },
];

// ---------- CHALLENGES ----------
export const CHALLENGES = [
  { id: 'glass', name: 'Glass Cannon', desc: 'You deal ×2 damage but take ×3.', floor: 6 },
  { id: 'blockless', name: 'Dodge Only', desc: 'All enemy attacks are unblockable. Dodge!', floor: 12 },
  { id: 'horde', name: 'The Horde', desc: 'Double the enemies. Survive.', floor: 18 },
  { id: 'ironskin', name: 'Iron Skin', desc: 'Enemies have ×2 health. Better rewards.', floor: 25 },
  { id: 'blitz', name: 'Blitz', desc: 'Defeat everything in 75 seconds.', floor: 32 },
  { id: 'nomagic', name: 'Blade Purist', desc: 'Skills are disabled. Pure swordplay.', floor: 40 },
];

// ---------- FLOORS ----------
export type FloorType = 'combat' | 'boss' | 'treasure' | 'puzzle' | 'survival' | 'elite' | 'timetrial' | 'trap' | 'secret' | 'miniboss';
export type Mode = 'tower' | 'endless' | 'bossrush' | 'challenge' | 'mastery' | 'training';
export type Layout = 'arena' | 'hall' | 'ruin' | 'ring' | 'cross' | 'corridor' | 'vault';
export interface FloorSpec { n: number; region: number; type: FloorType; mode: Mode; seed: number; name: string; layout: Layout; enemies: number; waves: number; time: number; boss: number; hasSecret: boolean; mod?: string; returnTo?: number; weapon?: WeaponFamily }
export const TYPE_INFO: Record<FloorType, { name: string; icon: string; goal: string }> = {
  combat: { name: 'Combat Floor', icon: '⚔️', goal: 'Defeat all enemies' },
  boss: { name: 'Boss Floor', icon: '👑', goal: 'Defeat the floor guardian' },
  treasure: { name: 'Treasure Floor', icon: '🧰', goal: 'Find every hidden chest' },
  puzzle: { name: 'Puzzle Floor', icon: '🧩', goal: 'Step on the runes in the correct order' },
  survival: { name: 'Survival Floor', icon: '🌊', goal: 'Survive the enemy waves' },
  elite: { name: 'Elite Floor', icon: '💠', goal: 'Defeat the elite enemies' },
  timetrial: { name: 'Time Trial', icon: '⏱️', goal: 'Defeat the enemies before time runs out' },
  trap: { name: 'Trap Floor', icon: '☠️', goal: 'Reach the exit alive' },
  secret: { name: 'Secret Floor', icon: '🔮', goal: 'Plunder the hidden vault' },
  miniboss: { name: 'Mini-Boss Floor', icon: '🐲', goal: 'Defeat the champion' },
};
const CYCLE: FloorType[] = ['boss', 'combat', 'treasure', 'combat', 'survival', 'miniboss', 'trap', 'puzzle', 'elite', 'timetrial'];
const LAYOUTS: Layout[] = ['hall', 'ruin', 'ring', 'cross', 'arena'];
export function getFloorSpec(n: number, mode: Mode = 'tower'): FloorSpec {
  const region = regionOfFloor(n), p = n % 10, type = CYCLE[p], r = rng(n * 7919 + 13);
  const inReg = ((n - 1) % 10) + 1;
  let layout: Layout = LAYOUTS[Math.floor(r() * LAYOUTS.length)];
  if (type === 'trap') layout = 'corridor';
  if (type === 'boss' || type === 'miniboss') layout = 'arena';
  if (type === 'survival') layout = r() < 0.5 ? 'arena' : 'ring';
  const enemies = n === 1 ? 3 : Math.min(14, 4 + Math.floor(inReg * 0.5) + Math.floor(r() * 3));
  return {
    n, region, type, mode, seed: n * 1013 + 77, name: REGIONS[region].places[inReg - 1], layout, enemies,
    waves: type === 'survival' ? 3 : 1, time: type === 'timetrial' ? 70 + enemies * 4 : 0, boss: region,
    hasSecret: type !== 'boss' && type !== 'miniboss' && (n === 3 || (p !== 0 && p !== 5 && r() < 0.22)),
  };
}
export const floorTypeOf = (n: number) => CYCLE[n % 10];
export const bossSpec = (i: number, mode: Mode = 'tower'): FloorSpec => ({ ...getFloorSpec((i + 1) * 10, mode), mode });
export const endlessSpec = (seed: number): FloorSpec => ({ n: 1, region: seed % 10, type: 'survival', mode: 'endless', seed, name: 'Endless Dungeon', layout: 'arena', enemies: 0, waves: 999, time: 0, boss: 0, hasSecret: false });
export const trainingSpec = (): FloorSpec => ({ n: 1, region: 0, type: 'combat', mode: 'training', seed: 4242, name: 'Training Arena', layout: 'arena', enemies: 0, waves: 0, time: 0, boss: 0, hasSecret: false });
export const challengeSpec = (id: string): FloorSpec => {
  const c = CHALLENGES.find((x) => x.id === id)!;
  const s = getFloorSpec(c.floor, 'challenge');
  return { ...s, type: id === 'blitz' ? 'timetrial' : 'combat', mode: 'challenge', mod: id, name: c.name, time: id === 'blitz' ? 75 : 0, enemies: id === 'horde' ? 18 : 8, hasSecret: false, seed: c.floor * 31 + 5, layout: 'arena' };
};
export const masterySpec = (fam: WeaponFamily, hi: number): FloorSpec => {
  const n = Math.max(1, Math.min(100, hi)), s = getFloorSpec(n, 'mastery');
  return { ...s, type: 'survival', mode: 'mastery', weapon: fam, name: `${WEAPONS[fam].name} Trial`, waves: 2, enemies: 6, hasSecret: false, layout: 'arena' };
};
export const secretSpec = (n: number): FloorSpec => ({ ...getFloorSpec(n, 'tower'), type: 'secret', layout: 'vault', name: 'Secret Vault', returnTo: n, hasSecret: false, enemies: 4 });

export function rankFor(score: number): string {
  return score >= 90 ? 'S' : score >= 72 ? 'A' : score >= 54 ? 'B' : score >= 36 ? 'C' : 'D';
}
export const todayKey = () => new Date().toISOString().slice(0, 10);
export const QUEST_TEMPLATES = [
  { id: 'kills', text: 'Defeat {n} enemies', stat: 'kills' as const, base: 25, gold: 150 },
  { id: 'perfect', text: 'Land {n} perfect deflections', stat: 'perfect' as const, base: 6, gold: 220 },
  { id: 'floors', text: 'Clear {n} floors', stat: 'floors' as const, base: 3, gold: 260 },
  { id: 'chests', text: 'Open {n} treasure chests', stat: 'chests' as const, base: 4, gold: 200 },
  { id: 'dodges', text: 'Dodge {n} times', stat: 'dodges' as const, base: 15, gold: 140 },
  { id: 'skills', text: 'Cast {n} skills', stat: 'skills' as const, base: 12, gold: 140 },
];
export const romanize = (n: number) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
