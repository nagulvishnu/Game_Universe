// Static game data: items, enemies, shadows, quests, canon lore.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'unique';
export type Slot = 'weapon' | 'weapon2' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'accessory';
export type StatKey = 'str' | 'agi' | 'vit' | 'int' | 'per';
export const STAT_KEYS: StatKey[] = ['str', 'agi', 'vit', 'int', 'per'];
export const STAT_NAMES: Record<StatKey, string> = {
  str: 'Strength',
  agi: 'Agility',
  vit: 'Vitality',
  int: 'Intelligence',
  per: 'Perception',
};
export const STAT_DESC: Record<StatKey, string> = {
  str: '+1.6 attack damage per point.',
  agi: '+move speed, +attack speed, +dodge distance.',
  vit: '+9 max HP, +0.6 defense per point.',
  int: '+7 max MP, faster mana regen, +skill damage.',
  per: '+crit chance, +extraction success, +lock-on range.',
};
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b8c4d6',
  uncommon: '#5cf08a',
  rare: '#4aa8ff',
  epic: '#b56bff',
  legendary: '#ffb347',
  unique: '#ff5577',
};
export const SLOT_NAMES: Record<Slot, string> = {
  weapon: 'Main Weapon',
  weapon2: 'Secondary',
  helmet: 'Helmet',
  armor: 'Armor',
  gloves: 'Gloves',
  boots: 'Boots',
  accessory: 'Accessory',
};

export interface ItemDef {
  id: string;
  name: string;
  kind: 'equip' | 'consumable' | 'key' | 'material';
  rarity: Rarity;
  desc: string;
  price: number;
  slot?: Slot;
  wtype?: 'dagger' | 'sword' | 'greatsword';
  look?: string;
  color?: number;
  atk?: number;
  def?: number;
  hp?: number;
  mp?: number;
  crit?: number;
  spd?: number;
  atkSpd?: number;
  str?: number;
  agi?: number;
  vit?: number;
  int?: number;
  per?: number;
  special?: string;
  heal?: number;
  mana?: number;
  shop?: boolean;
}
const I = (d: ItemDef) => d;
export const ITEMS: Record<string, ItemDef> = {
  rusty_dagger: I({
    id: 'rusty_dagger',
    name: 'Rusty Dagger',
    kind: 'equip',
    slot: 'weapon',
    wtype: 'dagger',
    look: 'rusty',
    rarity: 'common',
    atk: 6,
    price: 20,
    desc: 'A battered dagger. The standard weapon of an E-Rank on a budget.',
  }),
  hunter_sword: I({
    id: 'hunter_sword',
    name: "Hunter's Longsword",
    kind: 'equip',
    slot: 'weapon',
    wtype: 'sword',
    look: 'steel',
    rarity: 'uncommon',
    atk: 17,
    price: 260,
    shop: true,
    desc: 'Balanced steel sword. Wide arcs, slower swings.',
  }),
  iron_greatsword: I({
    id: 'iron_greatsword',
    name: 'Iron Greatsword',
    kind: 'equip',
    slot: 'weapon',
    wtype: 'greatsword',
    look: 'steel',
    rarity: 'uncommon',
    atk: 30,
    atkSpd: -0.25,
    price: 520,
    shop: true,
    desc: 'Heavy blade. Slow, devastating, shakes the ground.',
  }),
  venom_fang: I({
    id: 'venom_fang',
    name: "Kasaka's Venom Fang",
    kind: 'equip',
    slot: 'weapon',
    wtype: 'dagger',
    look: 'fang',
    rarity: 'epic',
    atk: 30,
    crit: 0.06,
    special: 'Poisons enemies (DoT).',
    price: 1400,
    desc: 'A fang torn from the giant serpent Kasaka. Its venom never stops burning.',
  }),
  knight_killer: I({
    id: 'knight_killer',
    name: 'Knight Killer',
    kind: 'equip',
    slot: 'weapon',
    wtype: 'dagger',
    look: 'killer',
    rarity: 'unique',
    atk: 48,
    crit: 0.1,
    atkSpd: 0.1,
    special: '+50% damage vs Knights & armored foes.',
    price: 4000,
    desc: 'A dagger forged to cut down armored knights.',
  }),
  hunter_jacket: I({
    id: 'hunter_jacket',
    name: 'Worn Hunter Jacket',
    kind: 'equip',
    slot: 'armor',
    rarity: 'common',
    def: 3,
    hp: 10,
    color: 0x56627a,
    price: 30,
    desc: 'Cheap padded jacket from the Association supply shop.',
  }),
  reinforced_vest: I({
    id: 'reinforced_vest',
    name: 'Reinforced Vest',
    kind: 'equip',
    slot: 'armor',
    rarity: 'uncommon',
    def: 9,
    hp: 40,
    color: 0x3d4558,
    price: 300,
    shop: true,
    desc: 'Kevlar and plates. Standard for D-Rank hunters.',
  }),
  kasaka_hide: I({
    id: 'kasaka_hide',
    name: "Kasaka's Hide Coat",
    kind: 'equip',
    slot: 'armor',
    rarity: 'rare',
    def: 16,
    hp: 70,
    color: 0x2d4a3a,
    price: 900,
    desc: 'Scaled leather coat. Resists poison.',
  }),
  dark_knight_armor: I({
    id: 'dark_knight_armor',
    name: 'Dark Knight Plate',
    kind: 'equip',
    slot: 'armor',
    rarity: 'epic',
    def: 28,
    hp: 120,
    str: 3,
    color: 0x14141c,
    price: 2400,
    desc: 'Black plate from the Job Change dungeon.',
  }),
  work_gloves: I({
    id: 'work_gloves',
    name: 'Work Gloves',
    kind: 'equip',
    slot: 'gloves',
    rarity: 'common',
    def: 1,
    atk: 1,
    price: 15,
    desc: 'Better grip.',
  }),
  hunter_gloves: I({
    id: 'hunter_gloves',
    name: 'Hunter Gauntlets',
    kind: 'equip',
    slot: 'gloves',
    rarity: 'uncommon',
    def: 4,
    atk: 4,
    price: 180,
    shop: true,
    desc: 'Reinforced knuckles.',
  }),
  sneakers: I({
    id: 'sneakers',
    name: 'Running Shoes',
    kind: 'equip',
    slot: 'boots',
    rarity: 'common',
    def: 1,
    spd: 0.03,
    price: 25,
    desc: 'Worn out, but light.',
  }),
  swift_boots: I({
    id: 'swift_boots',
    name: 'Swift Boots',
    kind: 'equip',
    slot: 'boots',
    rarity: 'rare',
    def: 5,
    spd: 0.1,
    agi: 3,
    price: 700,
    shop: true,
    desc: 'Lightweight boots that hum with mana.',
  }),
  hunter_helm: I({
    id: 'hunter_helm',
    name: 'Hunter Helm',
    kind: 'equip',
    slot: 'helmet',
    rarity: 'uncommon',
    def: 5,
    hp: 20,
    price: 200,
    shop: true,
    desc: 'Protects your head from the worst of it.',
  }),
  license_pendant: I({
    id: 'license_pendant',
    name: 'Hunter License Pendant',
    kind: 'equip',
    slot: 'accessory',
    rarity: 'common',
    per: 1,
    price: 10,
    desc: 'Your E-Rank license, on a chain.',
  }),
  mana_earring: I({
    id: 'mana_earring',
    name: 'Mana Crystal Earring',
    kind: 'equip',
    slot: 'accessory',
    rarity: 'rare',
    int: 5,
    mp: 30,
    price: 650,
    shop: true,
    desc: 'Pulsing with condensed mana.',
  }),
  vit_ring: I({
    id: 'vit_ring',
    name: 'Ring of Vitality',
    kind: 'equip',
    slot: 'accessory',
    rarity: 'rare',
    vit: 5,
    hp: 40,
    price: 650,
    shop: true,
    desc: 'Warm to the touch.',
  }),
  hp_potion: I({
    id: 'hp_potion',
    name: 'Healing Potion',
    kind: 'consumable',
    rarity: 'common',
    heal: 90,
    price: 40,
    shop: true,
    desc: 'Restores 90 HP.',
  }),
  mp_potion: I({
    id: 'mp_potion',
    name: 'Mana Potion',
    kind: 'consumable',
    rarity: 'common',
    mana: 60,
    price: 40,
    shop: true,
    desc: 'Restores 60 MP.',
  }),
  elixir: I({
    id: 'elixir',
    name: 'Hunter Elixir',
    kind: 'consumable',
    rarity: 'rare',
    heal: 400,
    mana: 150,
    price: 300,
    desc: 'Restores 400 HP and 150 MP.',
  }),
  essence: I({
    id: 'essence',
    name: 'Shadow Essence',
    kind: 'material',
    rarity: 'rare',
    price: 60,
    desc: 'Condensed shadow energy. Used to upgrade and evolve shadows.',
  }),
  key_venom: I({
    id: 'key_venom',
    name: 'Instant Dungeon Key: Venom Cave',
    kind: 'key',
    rarity: 'rare',
    price: 0,
    desc: 'An Instant Dungeon key. Use it to open a portal. Home of the serpent Kasaka.',
  }),
  key_job: I({
    id: 'key_job',
    name: 'Job Change Key',
    kind: 'key',
    rarity: 'epic',
    price: 0,
    desc: 'Key to the Job Change Quest dungeon. Recommended Lv 5+.',
  }),
};

export interface EnemyDef {
  key: string;
  name: string;
  rank: string;
  model: string;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  scale: number;
  detect: number;
  xp: number;
  gold: number;
  extract: number;
  boss?: boolean;
  drops: [string, number][];
  armored?: boolean;
}
export const ENEMIES: Record<string, EnemyDef> = {
  goblin: {
    key: 'goblin',
    name: 'Goblin',
    rank: 'E',
    model: 'goblin',
    hp: 55,
    atk: 10,
    def: 0,
    speed: 3.9,
    scale: 0.7,
    detect: 18,
    xp: 16,
    gold: 12,
    extract: 0.5,
    drops: [['hp_potion', 0.12]],
  },
  lizard: {
    key: 'lizard',
    name: 'Cave Lizard',
    rank: 'D',
    model: 'lizard',
    hp: 95,
    atk: 15,
    def: 2,
    speed: 4.4,
    scale: 0.95,
    detect: 20,
    xp: 26,
    gold: 22,
    extract: 0.4,
    drops: [
      ['hp_potion', 0.15],
      ['mp_potion', 0.1],
    ],
  },
  kasaka: {
    key: 'kasaka',
    name: 'Kasaka',
    rank: 'C',
    model: 'serpent',
    hp: 1500,
    atk: 32,
    def: 6,
    speed: 4.6,
    scale: 1.0,
    detect: 40,
    xp: 520,
    gold: 400,
    extract: 0,
    boss: true,
    drops: [
      ['venom_fang', 1],
      ['kasaka_hide', 1],
      ['elixir', 0.5],
    ],
  },
  guardian: {
    key: 'guardian',
    name: 'Stone Guardian',
    rank: 'D',
    model: 'guardian',
    hp: 520,
    atk: 40,
    def: 8,
    speed: 2.4,
    scale: 1.7,
    detect: 60,
    xp: 110,
    gold: 0,
    extract: 0,
    armored: true,
    drops: [],
  },
  centipede: {
    key: 'centipede',
    name: 'Giant Centipede',
    rank: 'D',
    model: 'centipede',
    hp: 80,
    atk: 13,
    def: 1,
    speed: 5.4,
    scale: 1.0,
    detect: 60,
    xp: 22,
    gold: 10,
    extract: 0.55,
    drops: [['essence', 0.15]],
  },
  knight: {
    key: 'knight',
    name: 'Armored Knight',
    rank: 'B',
    model: 'knight',
    hp: 300,
    atk: 26,
    def: 6,
    speed: 3.5,
    scale: 1.1,
    detect: 70,
    xp: 62,
    gold: 35,
    extract: 0.4,
    armored: true,
    drops: [
      ['hp_potion', 0.2],
      ['essence', 0.2],
    ],
  },
  igris: {
    key: 'igris',
    name: 'Igris the Red Knight',
    rank: 'B+',
    model: 'igris',
    hp: 3400,
    atk: 46,
    def: 14,
    speed: 5.2,
    scale: 1.45,
    detect: 90,
    xp: 1400,
    gold: 1500,
    extract: 1,
    boss: true,
    armored: true,
    drops: [
      ['knight_killer', 1],
      ['dark_knight_armor', 1],
      ['elixir', 1],
    ],
  },
};

export const RANKS = ['Normal', 'Elite', 'Knight', 'Elite Knight', 'Commander', 'General', 'Marshal', 'Grand Marshal'];
export const SHADOW_RANK_COLORS = [
  '#b8c4d6',
  '#5cf08a',
  '#4aa8ff',
  '#b56bff',
  '#ffb347',
  '#ff5577',
  '#ffd24a',
  '#ff2a3a',
];
export interface ShadowDef {
  key: string;
  name: string;
  title: string;
  model: string;
  startRank: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  scale: number;
  style: 'melee' | 'combo';
  evo: { level: number; cost: number }[];
  desc: string;
  abilities: { lvl: number; name: string; desc: string }[];
  eyes: number;
}
export const SHADOWS: Record<string, ShadowDef> = {
  igris: {
    key: 'igris',
    name: 'Igris',
    title: 'The Bloodred',
    model: 'igris',
    startRank: 4,
    hp: 900,
    atk: 62,
    def: 22,
    speed: 6.4,
    scale: 1.4,
    style: 'combo',
    eyes: 0xff2a3a,
    evo: [
      { level: 15, cost: 30 },
      { level: 30, cost: 100 },
    ],
    desc: 'The Red Knight, sworn blade of the throne. A master swordsman whose loyalty never wavers.',
    abilities: [
      { lvl: 1, name: 'Sword Dance', desc: 'Strikes in a 3-hit combo.' },
      { lvl: 1, name: 'Crimson Rush', desc: 'Dashes at targets and cleaves through them.' },
      { lvl: 10, name: 'Parry Stance', desc: 'Takes 40% less damage while engaged.' },
    ],
  },
  knight: {
    key: 'knight',
    name: 'Shadow Knight',
    title: 'Soldier',
    model: 'knight',
    startRank: 2,
    hp: 330,
    atk: 28,
    def: 12,
    speed: 5.2,
    scale: 1.1,
    style: 'melee',
    eyes: 0xb26bff,
    evo: [
      { level: 10, cost: 15 },
      { level: 20, cost: 40 },
    ],
    desc: 'A fallen armored knight, risen to serve the Shadow Monarch.',
    abilities: [{ lvl: 1, name: 'Shield Wall', desc: 'Reduced damage when defending.' }],
  },
  goblin: {
    key: 'goblin',
    name: 'Shadow Goblin',
    title: 'Scout',
    model: 'goblin',
    startRank: 0,
    hp: 100,
    atk: 11,
    def: 2,
    speed: 6,
    scale: 0.7,
    style: 'melee',
    eyes: 0xb26bff,
    evo: [{ level: 8, cost: 8 }],
    desc: 'A tiny shadow soldier. Fast, fragile, endlessly loyal.',
    abilities: [{ lvl: 1, name: 'Swarm', desc: 'Fights faster in numbers.' }],
  },
  centipede: {
    key: 'centipede',
    name: 'Shadow Centipede',
    title: 'Crawler',
    model: 'centipede',
    startRank: 1,
    hp: 140,
    atk: 16,
    def: 3,
    speed: 7,
    scale: 1.0,
    style: 'melee',
    eyes: 0xb26bff,
    evo: [{ level: 10, cost: 12 }],
    desc: 'A venomous crawler, now a silent hunter of the dark.',
    abilities: [{ lvl: 1, name: 'Chitin Rush', desc: 'Very fast charge.' }],
  },
  lizard: {
    key: 'lizard',
    name: 'Shadow Lizard',
    title: 'Stalker',
    model: 'lizard',
    startRank: 0,
    hp: 160,
    atk: 18,
    def: 4,
    speed: 6.2,
    scale: 0.95,
    style: 'melee',
    eyes: 0xb26bff,
    evo: [{ level: 8, cost: 8 }],
    desc: 'A dungeon lizard bound to your will.',
    abilities: [{ lvl: 1, name: 'Pounce', desc: 'Leaps at prey.' }],
  },
};
export const SHADOW_CODEX: { name: string; role: string; arc: string; desc: string }[] = [
  {
    name: 'Iron',
    role: 'Heavy armored warrior',
    arc: 'Locked: Story Arc 07',
    desc: 'Defensive heavy-weapon shadow. Not yet in this build.',
  },
  {
    name: 'Tank',
    role: 'Bear-like bruiser',
    arc: 'Locked: Story Arc 06',
    desc: 'Large, tanky charge attacker. Not yet in this build.',
  },
  {
    name: 'Tusk',
    role: 'High orc shaman',
    arc: 'Locked: Story Arc 06',
    desc: 'Ranged magic and area spells. Not yet in this build.',
  },
  {
    name: 'Beru',
    role: 'Ant King',
    arc: 'Locked: Story Arc 09',
    desc: 'Jeju Island. Extremely fast, aerial. Not yet in this build.',
  },
  { name: 'Kaisel', role: 'Dragon mount', arc: 'Locked: Story Arc 08', desc: 'Flying travel. Not yet in this build.' },
  {
    name: 'Greed',
    role: 'Humanoid warrior',
    arc: 'Locked: Story Arc 08',
    desc: 'Unique-weapon fighter. Not yet in this build.',
  },
  {
    name: 'Bellion',
    role: 'Grand Marshal',
    arc: 'Locked: Story Arc 10',
    desc: 'Monarch-level shadow. Not yet in this build.',
  },
];

export const GUILDS = [
  {
    name: 'Hunters Guild',
    leader: 'Choi Jong-In',
    desc: 'Korea\u2019s largest guild. Disciplined, wealthy, and ambitious. Fire mage S-Rank at its head.',
    color: '#e0a030',
  },
  {
    name: 'White Tiger Guild',
    leader: 'Baek Yoon-Ho',
    desc: 'A guild of elite fighters led by the S-Rank Baek Yoon-Ho, famed for brutal speed.',
    color: '#e8eefc',
  },
  {
    name: 'Fiend Guild',
    leader: 'Guild Master',
    desc: 'Notorious guild known for aggressive raiding and rough hunters.',
    color: '#c43a3a',
  },
  {
    name: 'Ahjin Guild',
    leader: '???',
    desc: 'Not yet founded. It will rise once the Shadow Monarch\u2019s path is walked further.',
    color: '#7a5cff',
  },
];

export interface QuestDef {
  id: string;
  kind: 'main' | 'daily' | 'emergency' | 'side' | 'mission' | 'dungeon' | 'shadow';
  title: string;
  desc: string;
  system?: boolean;
  objs: { t: string; type: string; key?: string; need: number }[];
  reward: { xp: number; gold: number; items?: string[]; points?: number; title?: string; essence?: number };
}
export const QUESTS: Record<string, QuestDef> = {
  q_gate: {
    id: 'q_gate',
    kind: 'emergency',
    title: 'Gate Break: Survive!',
    desc: 'An E-Rank gate is leaking monsters onto the street. Defend yourself.',
    objs: [{ t: 'Defeat the Goblins', type: 'kill', key: 'goblin', need: 2 }],
    reward: { xp: 20, gold: 100 },
  },
  q_report: {
    id: 'q_report',
    kind: 'main',
    title: 'Report to the Hunter Association',
    desc: 'Head to the Hunter Association headquarters (north of the central plaza) and speak to the receptionist.',
    objs: [{ t: 'Speak to the Association receptionist', type: 'talk', key: 'reception', need: 1 }],
    reward: { xp: 15, gold: 150 },
  },
  q_raid: {
    id: 'q_raid',
    kind: 'main',
    title: 'D-Rank Gate Raid',
    desc: 'Join Song Chi-Yul and Kim Sang-Shik in the D-Rank gate beside the Association.',
    objs: [{ t: 'Enter the D-Rank Gate', type: 'enter', key: 'double', need: 1 }],
    reward: { xp: 10, gold: 0 },
  },
  q_double: {
    id: 'q_double',
    kind: 'main',
    title: 'The Double Dungeon',
    desc: 'The temple is no D-Rank dungeon. Survive the Statue of God\u2019s judgement.',
    objs: [{ t: 'Obey the commandments', type: 'judge', need: 4 }],
    reward: { xp: 150, gold: 300, title: 'Player' },
  },
  q_daily: {
    id: 'q_daily',
    kind: 'daily',
    system: true,
    title: 'Daily Quest: Preparation to Become Powerful',
    desc: 'Failure to complete the Daily Quest in time will result in a penalty.',
    objs: [
      { t: 'Push-ups', type: 'pushup', need: 30 },
      { t: 'Sit-ups', type: 'situp', need: 30 },
      { t: 'Run (meters, sprint)', type: 'run', need: 1200 },
      { t: 'Defeat monsters', type: 'kill', key: 'any', need: 4 },
    ],
    reward: { xp: 220, gold: 250, points: 3 },
  },
  q_venom: {
    id: 'q_venom',
    kind: 'dungeon',
    system: true,
    title: 'Instant Dungeon: Venom Cave',
    desc: 'Use the Instant Dungeon Key (Inventory > Use) and slay the serpent Kasaka.',
    objs: [{ t: 'Defeat Kasaka', type: 'kill', key: 'kasaka', need: 1 }],
    reward: { xp: 300, gold: 500, items: ['key_job'] },
  },
  q_job: {
    id: 'q_job',
    kind: 'emergency',
    system: true,
    title: 'Emergency Quest: Job Change',
    desc: 'Use the Job Change Key. Survive the knights and defeat the Red Knight, Igris.',
    objs: [
      { t: 'Defeat the Armored Knights', type: 'kill', key: 'knight', need: 12 },
      { t: 'Defeat Igris', type: 'kill', key: 'igris', need: 1 },
      { t: 'Extract Igris\u2019s shadow', type: 'extract', key: 'igris', need: 1 },
    ],
    reward: { xp: 900, gold: 1000, points: 5, title: 'Necromancer' },
  },
  q_army: {
    id: 'q_army',
    kind: 'shadow',
    system: true,
    title: 'Raise the Army',
    desc: 'Raid gates and extract shadow soldiers. Build your army.',
    objs: [{ t: 'Extract shadows', type: 'extract', key: 'any', need: 3 }],
    reward: { xp: 600, gold: 800, essence: 5 },
  },
  q_supply: {
    id: 'q_supply',
    kind: 'side',
    title: 'Hunter Supplies Run',
    desc: 'Lee Joohee needs monster parts. Defeat monsters around Seoul.',
    objs: [{ t: 'Defeat monsters', type: 'kill', key: 'any', need: 8 }],
    reward: { xp: 120, gold: 300, items: ['hp_potion', 'hp_potion'] },
  },
};
export const MISSIONS: QuestDef[] = [
  {
    id: 'm_e',
    kind: 'mission',
    title: 'E-Rank Mission: Gate Cleanup',
    desc: 'Clear monsters leaking from small gates.',
    objs: [{ t: 'Defeat monsters', type: 'kill', key: 'any', need: 6 }],
    reward: { xp: 90, gold: 220 },
  },
  {
    id: 'm_d',
    kind: 'mission',
    title: 'D-Rank Mission: Reptile Control',
    desc: 'Defeat lizards or goblins.',
    objs: [{ t: 'Defeat monsters', type: 'kill', key: 'any', need: 12 }],
    reward: { xp: 220, gold: 480, essence: 1 },
  },
  {
    id: 'm_c',
    kind: 'mission',
    title: 'C-Rank Mission: Raid Support',
    desc: 'Support raid teams with heavy hunting.',
    objs: [{ t: 'Defeat monsters', type: 'kill', key: 'any', need: 25 }],
    reward: { xp: 500, gold: 1100, essence: 3 },
  },
];

export function xpNeeded(level: number) {
  return Math.round(30 * Math.pow(level, 1.6));
}
export function hunterRank(level: number) {
  return level < 8 ? 'E' : level < 15 ? 'D' : level < 25 ? 'C' : level < 35 ? 'B' : level < 50 ? 'A' : 'S';
}
export const GATE_INFO: Record<
  string,
  { rank: string; name: string; color: number; threat: string; boss: string; monsters: string; reward: string }
> = {
  leak: {
    rank: 'E',
    name: 'E-Rank Gate (Unstable)',
    color: 0x6ab4ff,
    threat: 'Low',
    boss: 'None',
    monsters: 'Goblins',
    reward: 'XP, Gold',
  },
  double: {
    rank: 'D',
    name: 'D-Rank Gate: Double Dungeon',
    color: 0xff8a3a,
    threat: 'Unknown / Lethal',
    boss: 'Statue of God',
    monsters: 'Stone Guardians',
    reward: 'Awakening',
  },
  venom: {
    rank: 'C',
    name: 'Instant Dungeon: Venom Cave',
    color: 0x6dff7a,
    threat: 'Moderate',
    boss: 'Kasaka',
    monsters: 'Lizards',
    reward: "Kasaka's Venom Fang",
  },
  job: {
    rank: 'B',
    name: 'Job Change Dungeon',
    color: 0xff3a4a,
    threat: 'High',
    boss: 'Igris the Red Knight',
    monsters: 'Armored Knights',
    reward: 'Knight Killer, Necromancer',
  },
  raid: {
    rank: 'C',
    name: 'C-Rank Raid Gate (Repeatable)',
    color: 0xb26bff,
    threat: 'Escalating',
    boss: 'None',
    monsters: 'Goblins, Lizards, Centipedes, Knights',
    reward: 'XP, Gold, Shadows',
  },
  penalty: {
    rank: '?',
    name: 'Penalty Zone',
    color: 0xffc04a,
    threat: 'Survival',
    boss: 'None',
    monsters: 'Giant Centipedes',
    reward: 'Survival',
  },
};
