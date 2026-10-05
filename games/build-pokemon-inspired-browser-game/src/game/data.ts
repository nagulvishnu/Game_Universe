// ---------- TYPES ----------
export type TypeId =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice' | 'fighting'
  | 'poison' | 'ground' | 'flying' | 'psychic' | 'rock' | 'steel' | 'dragon';

export const TYPES: TypeId[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting',
  'poison', 'ground', 'flying', 'psychic', 'rock', 'steel', 'dragon',
];

export const TYPE_COLOR: Record<TypeId, string> = {
  normal: '#b8b0a0', fire: '#ff7a2f', water: '#3d9bff', electric: '#ffd62e', grass: '#5fcf4e',
  ice: '#8fe3ff', fighting: '#d9442f', poison: '#b05ad6', ground: '#d4a64f', flying: '#9fb4ff',
  psychic: '#ff6fb5', rock: '#a89868', steel: '#9fb0c2', dragon: '#6a5cff',
};

export const TYPE_ICON: Record<TypeId, string> = {
  normal: '⚪', fire: '🔥', water: '💧', electric: '⚡', grass: '🍃', ice: '❄️', fighting: '🥊',
  poison: '☠️', ground: '⛰️', flying: '🕊️', psychic: '🔮', rock: '🪨', steel: '⚙️', dragon: '🐉',
};

const SE: Record<TypeId, TypeId[]> = {
  normal: [],
  fire: ['grass', 'ice', 'steel'],
  water: ['fire', 'ground', 'rock'],
  electric: ['water', 'flying'],
  grass: ['water', 'ground', 'rock'],
  ice: ['grass', 'ground', 'flying', 'dragon'],
  fighting: ['normal', 'ice', 'rock', 'steel'],
  poison: ['grass'],
  ground: ['fire', 'electric', 'poison', 'rock', 'steel'],
  flying: ['grass', 'fighting'],
  psychic: ['fighting', 'poison'],
  rock: ['fire', 'ice', 'flying'],
  steel: ['ice', 'rock'],
  dragon: ['dragon'],
};
const NVE: Record<TypeId, TypeId[]> = {
  normal: ['rock', 'steel'],
  fire: ['fire', 'water', 'rock', 'dragon'],
  water: ['water', 'grass', 'dragon'],
  electric: ['electric', 'grass', 'dragon'],
  grass: ['fire', 'grass', 'poison', 'flying', 'dragon', 'steel'],
  ice: ['fire', 'water', 'ice', 'steel'],
  fighting: ['poison', 'flying', 'psychic'],
  poison: ['poison', 'ground', 'rock'],
  ground: ['grass'],
  flying: ['electric', 'rock', 'steel'],
  psychic: ['psychic', 'steel'],
  rock: ['fighting', 'ground', 'steel'],
  steel: ['fire', 'water', 'electric', 'steel'],
  dragon: ['steel'],
};
const IMM: Partial<Record<TypeId, TypeId[]>> = { electric: ['ground'], ground: ['flying'] };

export function typeMult(atk: TypeId, defTypes: TypeId[]): number {
  let m = 1;
  for (const d of defTypes) {
    if (IMM[atk]?.includes(d)) return 0;
    if (SE[atk].includes(d)) m *= 2;
    else if (NVE[atk].includes(d)) m *= 0.5;
  }
  return m;
}
export function weaknessesOf(types: TypeId[]): TypeId[] {
  return TYPES.filter((t) => typeMult(t, types) > 1);
}

// ---------- MOVES ----------
export interface Move {
  id: string; name: string; type: TypeId; power: number; acc: number; prio?: number;
}
const PHYSICAL: TypeId[] = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'steel'];
export const isPhysical = (t: TypeId) => PHYSICAL.includes(t);

const MOVE_NAMES: Record<TypeId, [string, string, string]> = {
  normal: ['Quick Strike', 'Body Slam', 'Hyper Beam'],
  fire: ['Ember', 'Flame Burst', 'Inferno Blast'],
  water: ['Water Gun', 'Bubble Beam', 'Hydro Pump'],
  electric: ['Spark', 'Thunderbolt', 'Thunder Crash'],
  grass: ['Vine Whip', 'Razor Leaf', 'Solar Beam'],
  ice: ['Ice Shard', 'Frost Beam', 'Blizzard'],
  fighting: ['Karate Chop', 'Cross Chop', 'Close Combat'],
  poison: ['Poison Sting', 'Sludge Bomb', 'Toxic Burst'],
  ground: ['Mud Shot', 'Bulldoze', 'Earthquake'],
  flying: ['Gust', 'Wing Attack', 'Sky Dive'],
  psychic: ['Confusion', 'Psybeam', 'Psychic Wave'],
  rock: ['Rock Throw', 'Rock Slide', 'Stone Edge'],
  steel: ['Metal Claw', 'Iron Head', 'Flash Cannon'],
  dragon: ['Dragon Breath', 'Dragon Claw', 'Draco Meteor'],
};
const TIER = [
  { power: 45, acc: 100 },
  { power: 70, acc: 95 },
  { power: 95, acc: 90 },
];
export function getMove(type: TypeId, tier: 0 | 1 | 2): Move {
  const t = TIER[tier];
  return {
    id: `${type}${tier}`, name: MOVE_NAMES[type][tier], type, power: type === 'normal' && tier === 0 ? 40 : t.power,
    acc: t.acc, prio: type === 'normal' && tier === 0 ? 1 : 0,
  };
}
export const TACKLE: Move = { id: 'tackle', name: 'Tackle', type: 'normal', power: 40, acc: 100 };

// ---------- SPECIES ----------
export type Shape = 'blob' | 'biped' | 'quad' | 'serpent' | 'bird';
type Role = 'attacker' | 'special' | 'tank' | 'speedy' | 'balanced' | 'bulky';

export interface Species {
  id: string; name: string; types: TypeId[]; bst: number; role: Role;
  c1: string; c2: string; shape: Shape; cr: number; stage: number;
  evo?: { lvl: number; to: string }; from?: string;
}

const ROLE_W: Record<Role, number[]> = {
  attacker: [1, 1.5, 0.9, 0.6, 0.8, 1.2],
  special: [0.9, 0.6, 0.8, 1.5, 1.0, 1.2],
  tank: [1.3, 0.9, 1.5, 0.6, 1.2, 0.5],
  speedy: [0.8, 1, 0.7, 1, 0.8, 1.7],
  balanced: [1, 1, 1, 1, 1, 1],
  bulky: [1.3, 1.4, 1.1, 0.6, 0.9, 0.7],
};

export const SPECIES: Record<string, Species> = {};
function S(
  id: string, name: string, types: TypeId[], bst: number, role: Role, c1: string, c2: string,
  shape: Shape, cr: number, stage: number, evo?: [number, string],
) {
  SPECIES[id] = { id, name, types, bst, role, c1, c2, shape, cr, stage, evo: evo ? { lvl: evo[0], to: evo[1] } : undefined };
}
// starters
S('embertail', 'Embertail', ['fire'], 310, 'special', '#f4813a', '#ffd27a', 'quad', 45, 1, [16, 'blazefang']);
S('blazefang', 'Blazefang', ['fire'], 410, 'special', '#e2552b', '#ffc062', 'quad', 45, 2, [36, 'infernox']);
S('infernox', 'Infernox', ['fire', 'fighting'], 535, 'attacker', '#c93a22', '#ffb347', 'biped', 45, 3);
S('aquip', 'Aquip', ['water'], 310, 'special', '#4aa8f0', '#bfe8ff', 'blob', 45, 1, [16, 'torrentide']);
S('torrentide', 'Torrentide', ['water'], 405, 'balanced', '#2f86e0', '#a8dcff', 'biped', 45, 2, [36, 'leviathor']);
S('leviathor', 'Leviathor', ['water', 'dragon'], 535, 'special', '#2a62d1', '#9ad7ff', 'serpent', 45, 3);
S('sproutle', 'Sproutle', ['grass'], 310, 'balanced', '#6ccf5a', '#e8ff9a', 'biped', 45, 1, [16, 'thornvine']);
S('thornvine', 'Thornvine', ['grass'], 405, 'bulky', '#4cb84a', '#d6f58a', 'quad', 45, 2, [36, 'floradon']);
S('floradon', 'Floradon', ['grass', 'poison'], 535, 'bulky', '#2f9a47', '#c28ae0', 'quad', 45, 3);
// wild
S('pidgel', 'Pidgel', ['normal', 'flying'], 270, 'speedy', '#c9a27a', '#fff0d6', 'bird', 255, 1, [18, 'galewing']);
S('galewing', 'Galewing', ['normal', 'flying'], 430, 'speedy', '#b98a5e', '#fff0d6', 'bird', 120, 2);
S('rattik', 'Rattik', ['normal'], 250, 'attacker', '#a98ccf', '#f0e0ff', 'quad', 255, 1, [18, 'rattigan']);
S('rattigan', 'Rattigan', ['normal'], 400, 'attacker', '#8e6cbf', '#f0e0ff', 'quad', 127, 2);
S('voltik', 'Voltik', ['electric'], 290, 'speedy', '#ffd93b', '#fff6a8', 'blob', 190, 1, [24, 'thundrix']);
S('thundrix', 'Thundrix', ['electric'], 440, 'special', '#f5c000', '#fff6a8', 'quad', 90, 2);
S('pebblit', 'Pebblit', ['rock', 'ground'], 290, 'tank', '#9a8f84', '#d6c8b8', 'blob', 190, 1, [28, 'boulderon']);
S('boulderon', 'Boulderon', ['rock', 'ground'], 460, 'tank', '#7d7268', '#cdbfae', 'biped', 90, 2);
S('frostkit', 'Frostkit', ['ice'], 290, 'speedy', '#8fd8ff', '#ffffff', 'quad', 150, 1, [28, 'glacivor']);
S('glacivor', 'Glacivor', ['ice'], 460, 'special', '#62bff0', '#ffffff', 'quad', 75, 2);
S('venomite', 'Venomite', ['poison'], 280, 'speedy', '#9b59c9', '#e6b3ff', 'serpent', 190, 1, [26, 'toxiserp']);
S('toxiserp', 'Toxiserp', ['poison'], 450, 'attacker', '#7d3aa8', '#e6b3ff', 'serpent', 90, 2);
S('boltcog', 'Boltcog', ['steel'], 290, 'tank', '#9aa7b5', '#e0e7ee', 'blob', 150, 1, [30, 'gearon']);
S('gearon', 'Gearon', ['steel'], 470, 'tank', '#7f8fa0', '#dfe6ee', 'biped', 75, 2);
S('magnebolt', 'Magnebolt', ['electric', 'steel'], 330, 'special', '#8fb0d9', '#ffd93b', 'blob', 120, 1, [34, 'magnoton']);
S('magnoton', 'Magnoton', ['electric', 'steel'], 480, 'special', '#6f95c8', '#ffd93b', 'blob', 60, 2);
S('brawlo', 'Brawlo', ['fighting'], 290, 'attacker', '#d4553a', '#f2d2a0', 'biped', 150, 1, [30, 'brawlord']);
S('brawlord', 'Brawlord', ['fighting'], 480, 'attacker', '#b93a24', '#f2d2a0', 'biped', 70, 2);
S('magmole', 'Magmole', ['fire', 'ground'], 300, 'bulky', '#b5532c', '#ff9a3c', 'quad', 120, 1, [32, 'magmaw']);
S('magmaw', 'Magmaw', ['fire', 'ground'], 490, 'bulky', '#9a3d1c', '#ff9a3c', 'quad', 60, 2);
S('mindle', 'Mindle', ['psychic'], 300, 'special', '#d98ad9', '#fbe0fb', 'biped', 120, 1, [30, 'psyclone']);
S('psyclone', 'Psyclone', ['psychic'], 480, 'special', '#b562c9', '#fbe0fb', 'biped', 60, 2);
S('dratling', 'Dratling', ['dragon'], 300, 'balanced', '#5f7cf2', '#cdd6ff', 'serpent', 45, 1, [28, 'draconis']);
S('draconis', 'Draconis', ['dragon'], 470, 'balanced', '#4560e0', '#cdd6ff', 'serpent', 45, 2, [48, 'drakonor']);
S('drakonor', 'Drakonor', ['dragon', 'flying'], 600, 'attacker', '#3a3fc8', '#ffe28a', 'bird', 30, 3);
S('wavelet', 'Wavelet', ['water', 'flying'], 300, 'speedy', '#5cc8e8', '#ffffff', 'bird', 150, 1, [28, 'tidewing']);
S('tidewing', 'Tidewing', ['water', 'flying'], 460, 'special', '#2fa8d8', '#ffffff', 'bird', 75, 2);
S('snowseal', 'Snowseal', ['ice', 'water'], 300, 'bulky', '#e8f6ff', '#6ec6ff', 'quad', 120, 1, [32, 'glaciseal']);
S('glaciseal', 'Glaciseal', ['ice', 'water'], 470, 'bulky', '#cfeaff', '#4fb0f5', 'quad', 60, 2);
S('cactusk', 'Cactusk', ['grass', 'ground'], 300, 'attacker', '#4fa05a', '#f0d36b', 'biped', 150, 1, [30, 'cactyrant']);
S('cactyrant', 'Cactyrant', ['grass', 'ground'], 460, 'attacker', '#3a8a4a', '#f0d36b', 'biped', 75, 2);
S('sludgeon', 'Sludgeon', ['poison', 'ground'], 300, 'bulky', '#7a5a8a', '#b09060', 'blob', 150, 1, [32, 'sludgolem']);
S('sludgolem', 'Sludgolem', ['poison', 'ground'], 470, 'bulky', '#654878', '#b09060', 'biped', 75, 2);
S('ferrock', 'Ferrock', ['rock', 'steel'], 350, 'tank', '#7d8fa0', '#c8a070', 'quad', 90, 1, [36, 'ferrodon']);
S('ferrodon', 'Ferrodon', ['rock', 'steel'], 500, 'tank', '#66798c', '#d8b080', 'quad', 45, 2);

for (const s of Object.values(SPECIES)) if (s.evo) SPECIES[s.evo.to].from = s.id;

export function rootOf(id: string): string {
  let s = SPECIES[id];
  while (s.from) s = SPECIES[s.from];
  return s.id;
}
export function formAt(root: string, level: number): string {
  let s = SPECIES[root];
  while (s.evo && level >= s.evo.lvl) s = SPECIES[s.evo.to];
  return s.id;
}
export const stoneName = (root: string) => `${SPECIES[root].name}ite`;

// ---------- MONSTERS ----------
export interface Mon {
  uid: string; sp: string; level: number; xp: number; hp: number; item?: string;
}
export interface Stats { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }

export const xpNeed = (l: number) => 2 * l * l + 20;

export function baseStats(sp: Species): Stats {
  const w = ROLE_W[sp.role];
  const k = sp.bst / 6;
  const b = w.map((x) => k * x);
  return { hp: b[0], atk: b[1], def: b[2], spa: b[3], spd: b[4], spe: b[5] };
}

export function calcStats(m: Mon): Stats {
  const b = baseStats(SPECIES[m.sp]);
  const L = m.level;
  const f = (v: number) => Math.floor((2 * v * L) / 100) + 5;
  const s: Stats = {
    hp: Math.floor((2 * b.hp * L) / 100) + L + 10, atk: f(b.atk), def: f(b.def), spa: f(b.spa), spd: f(b.spd), spe: f(b.spe),
  };
  const it = m.item ? ITEMS[m.item] : undefined;
  if (it?.kind === 'held' && it.stat && it.stat !== 'xp' && it.stat !== 'dmg') s[it.stat] = Math.floor(s[it.stat] * it.mult!);
  return s;
}
export const maxHp = (m: Mon) => calcStats(m).hp;

export function movesOf(m: Mon): Move[] {
  const sp = SPECIES[m.sp];
  const [t1, t2] = sp.types;
  const L = m.level;
  const list: Move[] = [TACKLE, getMove(t1, 0)];
  if (t2 && L >= 8) list.push(getMove(t2, 0));
  if (L >= 12) list.push(getMove(t1, 1));
  if (t2 && L >= 18) list.push(getMove(t2, 1));
  if (L >= 28) list.push(getMove(t1, 2));
  if (t2 && L >= 34) list.push(getMove(t2, 2));
  while (list.length > 4) {
    let mi = 0;
    for (let i = 1; i < list.length; i++) if (list[i].power < list[mi].power) mi = i;
    list.splice(mi, 1);
  }
  return list;
}

// ---------- ITEMS ----------
export interface ItemDef {
  id: string; name: string; desc: string; price: number; icon: string;
  kind: 'heal' | 'revive' | 'orb' | 'held' | 'candy';
  amount?: number; mult?: number; stat?: keyof Stats | 'xp' | 'dmg';
}
export const ITEMS: Record<string, ItemDef> = {};
function I(d: ItemDef) { ITEMS[d.id] = d; }
I({ id: 'potion', name: 'Potion', desc: 'Restores 40 HP.', price: 100, icon: '🧪', kind: 'heal', amount: 40 });
I({ id: 'super', name: 'Super Potion', desc: 'Restores 110 HP.', price: 260, icon: '💊', kind: 'heal', amount: 110 });
I({ id: 'hyper', name: 'Hyper Potion', desc: 'Restores 280 HP.', price: 520, icon: '🍶', kind: 'heal', amount: 280 });
I({ id: 'revive', name: 'Revive', desc: 'Revives a fainted monster at half HP.', price: 450, icon: '💖', kind: 'revive' });
I({ id: 'candy', name: 'Rare Candy', desc: 'Instantly raises a monster by one level.', price: 700, icon: '🍬', kind: 'candy' });
I({ id: 'orb', name: 'Capture Orb', desc: 'Standard orb for catching wild monsters.', price: 80, icon: '🔴', kind: 'orb', mult: 1 });
I({ id: 'great', name: 'Great Orb', desc: 'Catch rate x1.6.', price: 200, icon: '🔵', kind: 'orb', mult: 1.6 });
I({ id: 'ultra', name: 'Ultra Orb', desc: 'Catch rate x2.4.', price: 450, icon: '🟡', kind: 'orb', mult: 2.4 });
I({ id: 'powerband', name: 'Power Band', desc: 'Holder: Attack +25%.', price: 1000, icon: '💪', kind: 'held', stat: 'atk', mult: 1.25 });
I({ id: 'ironvest', name: 'Iron Vest', desc: 'Holder: Defense +25%.', price: 1000, icon: '🛡️', kind: 'held', stat: 'def', mult: 1.25 });
I({ id: 'mindlens', name: 'Mind Lens', desc: 'Holder: Sp. Atk +25%.', price: 1000, icon: '🔭', kind: 'held', stat: 'spa', mult: 1.25 });
I({ id: 'wardcloak', name: 'Ward Cloak', desc: 'Holder: Sp. Def +25%.', price: 1000, icon: '🧣', kind: 'held', stat: 'spd', mult: 1.25 });
I({ id: 'swiftboots', name: 'Swift Boots', desc: 'Holder: Speed +30%.', price: 1100, icon: '👟', kind: 'held', stat: 'spe', mult: 1.3 });
I({ id: 'vitalcharm', name: 'Vital Charm', desc: 'Holder: Max HP +20%.', price: 1100, icon: '❤️‍🔥', kind: 'held', stat: 'hp', mult: 1.2 });
I({ id: 'luckyegg', name: 'Lucky Egg', desc: 'Holder earns +50% EXP.', price: 1400, icon: '🥚', kind: 'held', stat: 'xp', mult: 1.5 });
I({ id: 'lifecrystal', name: 'Life Crystal', desc: 'Holder: all moves +15% damage.', price: 1600, icon: '💎', kind: 'held', stat: 'dmg', mult: 1.15 });

export const SHOP_CONSUMABLES = ['orb', 'great', 'ultra', 'potion', 'super', 'hyper', 'revive', 'candy'];
export const SHOP_HELD = ['powerband', 'ironvest', 'mindlens', 'wardcloak', 'swiftboots', 'vitalcharm', 'luckyegg', 'lifecrystal'];
export const STONE_PRICE = 2500;

// ---------- REGIONS ----------
export interface Palette {
  ground: string; ground2: string; tall: string; tall2: string; tree: string; tree2: string; water: string; water2: string;
  path: string; skyTop: string; skyBot: string; accent: string; trunk: string;
}
export interface RegionDef {
  name: string; town: string; pal: Palette; gymType: TypeId; leader: string; title: string; badge: string;
  pool: string[]; rare: string[]; trainerCls: string[]; gym: string[]; line: string;
}

export const REGIONS: RegionDef[] = [
  {
    name: 'Greenfield', town: 'Leafton', gymType: 'normal', leader: 'Wren', title: 'Gym Leader', badge: 'Plain Badge',
    pal: { ground: '#7ccf62', ground2: '#6dbf55', tall: '#3f9e45', tall2: '#2f8438', tree: '#2f7d3b', tree2: '#3f9a4a', water: '#4aa8f0', water2: '#8ad0ff', path: '#e8d49a', skyTop: '#6ec6ff', skyBot: '#d8f3ff', accent: '#ffd23f', trunk: '#6b4a2b' },
    pool: ['pidgel', 'rattik', 'rattik', 'pidgel', 'voltik'], rare: ['pebblit'], trainerCls: ['Youngster', 'Lass', 'Rookie'],
    gym: ['rattik', 'pidgel', 'galewing'], line: 'Normal is no weakness... but Fighting types break it!',
  },
  {
    name: 'Rockridge', town: 'Cobble Town', gymType: 'rock', leader: 'Granite', title: 'Gym Leader', badge: 'Boulder Badge',
    pal: { ground: '#c9b48a', ground2: '#bba67c', tall: '#8a9a4a', tall2: '#6f8038', tree: '#6a6a58', tree2: '#85857a', water: '#4a9ad8', water2: '#8ac4f0', path: '#e8dcc0', skyTop: '#9cc4e8', skyBot: '#f2e6cc', accent: '#a89868', trunk: '#5a4a3a' },
    pool: ['pebblit', 'pebblit', 'brawlo', 'boltcog', 'rattik'], rare: ['ferrock', 'sproutle'], trainerCls: ['Hiker', 'Miner', 'Climber'],
    gym: ['pebblit', 'boulderon', 'ferrock'], line: 'Rock is hard — but Water, Grass and Fighting crack it.',
  },
  {
    name: 'Tidehaven', town: 'Pearl Port', gymType: 'water', leader: 'Marina', title: 'Gym Leader', badge: 'Wave Badge',
    pal: { ground: '#f0dca0', ground2: '#e6cf8c', tall: '#58b88a', tall2: '#3f9e72', tree: '#2f9a6a', tree2: '#4cbf84', water: '#2f9bea', water2: '#7cd0ff', path: '#fff0c4', skyTop: '#58c0f0', skyBot: '#e6fbff', accent: '#3d9bff', trunk: '#8a6a3a' },
    pool: ['wavelet', 'wavelet', 'snowseal', 'sludgeon', 'pidgel'], rare: ['aquip', 'frostkit'], trainerCls: ['Swimmer', 'Sailor', 'Fisher'],
    gym: ['wavelet', 'snowseal', 'tidewing'], line: 'Water floods the field. Grass and Electric will dry me out!',
  },
  {
    name: 'Voltcity', town: 'Dynamo', gymType: 'electric', leader: 'Volta', title: 'Gym Leader', badge: 'Spark Badge',
    pal: { ground: '#a6b0bc', ground2: '#98a2ae', tall: '#7aa64a', tall2: '#5d8a38', tree: '#58708a', tree2: '#7a94ad', water: '#3a7acc', water2: '#7ab0f0', path: '#d6dde6', skyTop: '#7a9ccc', skyBot: '#e0e8f4', accent: '#ffd62e', trunk: '#3a4a5a' },
    pool: ['voltik', 'voltik', 'magnebolt', 'boltcog', 'mindle', 'rattigan'], rare: ['thundrix'], trainerCls: ['Engineer', 'Biker', 'Techie'],
    gym: ['thundrix', 'magnebolt', 'magnoton'], line: 'Ground types ignore my shocks. Care to test that?',
  },
  {
    name: 'Venomwood', town: 'Mossgrave', gymType: 'poison', leader: 'Morgan', title: 'Gym Leader', badge: 'Toxin Badge',
    pal: { ground: '#6a8a5a', ground2: '#5c7a4e', tall: '#4a6a3a', tall2: '#3a5a2e', tree: '#3a4a3a', tree2: '#566a4a', water: '#6a4a9a', water2: '#9a7acb', path: '#b8a888', skyTop: '#7a6a9a', skyBot: '#c8bcd8', accent: '#b05ad6', trunk: '#3a2a2a' },
    pool: ['venomite', 'venomite', 'sludgeon', 'cactusk', 'mindle'], rare: ['toxiserp', 'sproutle'], trainerCls: ['Witch', 'Herbalist', 'Ranger'],
    gym: ['venomite', 'sludgeon', 'toxiserp'], line: 'Poison seeps everywhere. Ground and Psychic cut through!',
  },
  {
    name: 'Frostpeak', town: 'Icicle Hold', gymType: 'ice', leader: 'Glacia', title: 'Gym Leader', badge: 'Glacier Badge',
    pal: { ground: '#eaf6ff', ground2: '#d8ecfa', tall: '#9ac8e0', tall2: '#78aac8', tree: '#4a8a8a', tree2: '#e8f8ff', water: '#5ab0e8', water2: '#b6e4ff', path: '#c8d8e6', skyTop: '#9ad0f0', skyBot: '#f4fbff', accent: '#8fe3ff', trunk: '#5a4a3a' },
    pool: ['frostkit', 'frostkit', 'snowseal', 'pebblit', 'ferrock', 'wavelet'], rare: ['glacivor'], trainerCls: ['Skier', 'Boarder', 'Yeti Fan'],
    gym: ['frostkit', 'snowseal', 'glacivor', 'glaciseal'], line: 'Fire, Fighting, Rock and Steel melt my ice!',
  },
  {
    name: 'Emberforge', town: 'Cinder Keep', gymType: 'fire', leader: 'Cinder', title: 'Gym Leader', badge: 'Magma Badge',
    pal: { ground: '#6a4a46', ground2: '#5c403c', tall: '#a8603a', tall2: '#884a2c', tree: '#3a2a2a', tree2: '#5a3a30', water: '#ff6a2a', water2: '#ffb347', path: '#9a7a66', skyTop: '#c8503a', skyBot: '#ffc27a', accent: '#ff7a2f', trunk: '#2a1a1a' },
    pool: ['magmole', 'magmole', 'brawlo', 'gearon', 'sludgeon', 'boulderon'], rare: ['magmaw', 'embertail'], trainerCls: ['Smith', 'Firebug', 'Blackbelt'],
    gym: ['magmole', 'embertail', 'magmaw', 'blazefang'], line: 'Water and Ground will quench my flames!',
  },
  {
    name: 'Dragonspire', town: 'Skyreach', gymType: 'dragon', leader: 'Drax', title: 'Dragon Master', badge: 'Dragon Badge',
    pal: { ground: '#8a7ac8', ground2: '#7a6ab8', tall: '#5a4a9a', tall2: '#46387e', tree: '#3a3470', tree2: '#5a52a0', water: '#6a8aff', water2: '#aac0ff', path: '#d6cff0', skyTop: '#5a4aa8', skyBot: '#e6d6ff', accent: '#6a5cff', trunk: '#2a2050' },
    pool: ['dratling', 'dratling', 'psyclone', 'galewing', 'brawlord', 'glacivor', 'thundrix'], rare: ['draconis', 'drakonor'], trainerCls: ['Tamer', 'Mystic', 'Cooltrainer'],
    gym: ['draconis', 'psyclone', 'drakonor', 'leviathor'], line: 'Ice and Dragon strike my kin. Do you have the nerve?',
  },
  {
    name: 'Champion Hall', town: 'Victory Plaza', gymType: 'dragon', leader: 'Aurora', title: 'Champion', badge: 'Champion Crown',
    pal: { ground: '#e8dcc0', ground2: '#ddd0b0', tall: '#c8b070', tall2: '#a8924c', tree: '#8a7a3a', tree2: '#b8a45a', water: '#6ab0ff', water2: '#b8e0ff', path: '#fff4d0', skyTop: '#ffb347', skyBot: '#fff2c8', accent: '#ffd23f', trunk: '#6a5a2a' },
    pool: [], rare: [], trainerCls: [], gym: [], line: '',
  },
];

export const TOURNAMENT = [
  { name: 'Rival Kai', cls: 'Rival', team: ['blazefang', 'galewing', 'thundrix'], lvl: 46, line: 'Quarterfinals! Let me see what a travelled hero can do!' },
  { name: 'Elite Sable', cls: 'Elite Four', team: ['psyclone', 'gearon', 'glaciseal', 'toxiserp'], lvl: 49, line: 'Semifinals. My team has never lost a round!' },
  { name: 'Champion Aurora', cls: 'Champion', team: ['drakonor', 'infernox', 'leviathor', 'floradon', 'magnoton', 'brawlord'], lvl: 53, line: 'The final! Show me everything you have learned on the road!' },
];

export const STARTERS = ['embertail', 'aquip', 'sproutle'];
