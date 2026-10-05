export const TILE = 48;
export const COLS = 16;
export const ROWS = 10;

export type Pt = [number, number];
export type TowerType = 'archer' | 'cannon' | 'frost' | 'tesla' | 'sniper';
export type EnemyType =
  | 'grunt'
  | 'runner'
  | 'swarm'
  | 'tank'
  | 'healer'
  | 'flyer'
  | 'splitter'
  | 'boss';
export type ThemeKey = 'meadow' | 'forest' | 'snow' | 'desert' | 'lava' | 'night';
export type ModKey = 'swift' | 'tough' | 'poor' | 'windfall' | 'fog' | 'regen' | 'horde' | 'air';

/* ------------------------------ Towers ------------------------------ */

export interface TowerDef {
  id: TowerType;
  name: string;
  icon: string;
  color: string;
  cost: number;
  range: number; // tiles
  dmg: number;
  rate: number; // seconds between shots
  air: boolean;
  unlock: number; // level index (0-based) that unlocks it
  splash?: number;
  chain?: number;
  slow?: number;
  pierce?: number;
  desc: string;
}

export const TOWERS: Record<TowerType, TowerDef> = {
  archer: {
    id: 'archer',
    name: 'Archer Tower',
    icon: '🏹',
    color: '#f59e0b',
    cost: 50,
    range: 3.1,
    dmg: 9,
    rate: 0.5,
    air: true,
    unlock: 0,
    desc: 'Fast and cheap. Hits ground and air.',
  },
  cannon: {
    id: 'cannon',
    name: 'Cannon',
    icon: '💣',
    color: '#ef4444',
    cost: 90,
    range: 2.7,
    dmg: 34,
    rate: 1.5,
    air: false,
    splash: 1.15,
    unlock: 0,
    pierce: 2,
    desc: 'Heavy splash damage. Ground only.',
  },
  frost: {
    id: 'frost',
    name: 'Frost Nova',
    icon: '❄️',
    color: '#38bdf8',
    cost: 75,
    range: 2.3,
    dmg: 5,
    rate: 1.0,
    air: true,
    slow: 0.4,
    unlock: 2,
    desc: 'Pulses around itself, slowing every enemy in range.',
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla Coil',
    icon: '⚡',
    color: '#a78bfa',
    cost: 140,
    range: 2.6,
    dmg: 20,
    rate: 1.1,
    air: true,
    chain: 3,
    unlock: 4,
    desc: 'Chain lightning jumps between enemies.',
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper Nest',
    icon: '🎯',
    color: '#34d399',
    cost: 130,
    range: 6.2,
    dmg: 90,
    rate: 2.8,
    air: true,
    pierce: 6,
    unlock: 6,
    desc: 'Huge range and damage, ignores armor. Slow shots.',
  },
};

export const TOWER_ORDER: TowerType[] = ['archer', 'cannon', 'frost', 'tesla', 'sniper'];
export const MAX_TIER = 3;
const UPGRADE_MULT = [0.7, 1.1, 1.7];

export function upgradeCost(type: TowerType, tier: number): number {
  return Math.round((TOWERS[type].cost * UPGRADE_MULT[tier]) / 5) * 5;
}

export function towerStats(type: TowerType, tier: number, rangeMod = 1) {
  const d = TOWERS[type];
  return {
    dmg: d.dmg * (1 + 0.65 * tier),
    range: (d.range + 0.25 * tier) * rangeMod,
    rate: d.rate * Math.pow(0.9, tier),
    splash: d.splash ? d.splash + 0.12 * tier : 0,
    chain: d.chain ? d.chain + tier : 0,
    slow: d.slow ? Math.min(0.75, d.slow + 0.1 * tier) : 0,
    pierce: d.pierce ?? 0,
  };
}

export const TARGET_MODES = ['First', 'Last', 'Strongest', 'Weakest'] as const;

/* ------------------------------ Enemies ------------------------------ */

export interface EnemyDef {
  id: EnemyType;
  name: string;
  icon: string;
  hp: number;
  speed: number; // tiles / sec
  reward: number;
  dmg: number;
  armor: number;
  cost: number;
  color: string;
  r: number;
  interval: number;
  flying?: boolean;
  intro: number;
  desc: string;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  grunt: { id: 'grunt', name: 'Grunt', icon: '🧟', hp: 42, speed: 1.0, reward: 4, dmg: 1, armor: 0, cost: 1, color: '#65a30d', r: 13, interval: 0.9, intro: 0, desc: 'Basic foot soldier.' },
  swarm: { id: 'swarm', name: 'Swarmling', icon: '🐜', hp: 12, speed: 1.4, reward: 2, dmg: 1, armor: 0, cost: 0.45, color: '#a16207', r: 9, interval: 0.3, intro: 1.0, desc: 'Weak but come in huge numbers.' },
  runner: { id: 'runner', name: 'Runner', icon: '🐺', hp: 26, speed: 2.0, reward: 4, dmg: 1, armor: 0, cost: 1.1, color: '#dc2626', r: 11, interval: 0.6, intro: 2.0, desc: 'Very fast. Slow it down!' },
  tank: { id: 'tank', name: 'Juggernaut', icon: '🦏', hp: 190, speed: 0.7, reward: 12, dmg: 2, armor: 3, cost: 4.5, color: '#64748b', r: 17, interval: 1.8, intro: 3.8, desc: 'Armored: weak shots barely scratch it.' },
  flyer: { id: 'flyer', name: 'Bat', icon: '🦇', hp: 55, speed: 1.5, reward: 6, dmg: 1, armor: 0, cost: 2.2, color: '#7c3aed', r: 12, interval: 0.8, flying: true, intro: 6.0, desc: 'Flies straight over the path. Cannons cannot hit it.' },
  splitter: { id: 'splitter', name: 'Slime', icon: '🦠', hp: 110, speed: 0.9, reward: 8, dmg: 1, armor: 0, cost: 3.5, color: '#16a34a', r: 15, interval: 1.4, intro: 7.5, desc: 'Splits into swarmlings when killed.' },
  healer: { id: 'healer', name: 'Shaman', icon: '🧙', hp: 80, speed: 0.95, reward: 9, dmg: 1, armor: 0, cost: 3.5, color: '#0ea5e9', r: 13, interval: 1.6, intro: 9.5, desc: 'Heals nearby enemies. Kill it first.' },
  boss: { id: 'boss', name: 'Warlord', icon: '👹', hp: 900, speed: 0.55, reward: 90, dmg: 10, armor: 3, cost: 25, color: '#b91c1c', r: 24, interval: 4, intro: 99, desc: 'A massive boss. Costs lots of lives if it escapes.' },
};

/* ------------------------------ Themes ------------------------------ */

export interface Theme {
  g1: string;
  g2: string;
  path: string;
  edge: string;
  obst: string[];
  card: string; // tailwind gradient classes
  label: string;
}

export const THEMES: Record<ThemeKey, Theme> = {
  meadow: { g1: '#4c9a52', g2: '#55a45b', path: '#d4b27a', edge: '#a5844f', obst: ['🌳', '🪨', '🌲'], card: 'from-emerald-500 to-lime-600', label: 'Meadow' },
  forest: { g1: '#2f7a46', g2: '#37854f', path: '#a98a5b', edge: '#7a6038', obst: ['🌲', '🌲', '🍄'], card: 'from-green-700 to-emerald-900', label: 'Forest' },
  snow: { g1: '#dbe8f4', g2: '#e6f0f8', path: '#9db9d6', edge: '#6f8fb3', obst: ['🎄', '🧊', '⛄'], card: 'from-sky-300 to-blue-500', label: 'Tundra' },
  desert: { g1: '#e2c680', g2: '#e8cf8d', path: '#b07d46', edge: '#86592b', obst: ['🌵', '🪨', '🌵'], card: 'from-amber-400 to-orange-600', label: 'Desert' },
  lava: { g1: '#3d2b2b', g2: '#463131', path: '#7b4a36', edge: '#f97316', obst: ['🪨', '🔥', '🌋'], card: 'from-red-700 to-orange-900', label: 'Volcano' },
  night: { g1: '#1f2b4d', g2: '#243157', path: '#4b5d8c', edge: '#7c8fc4', obst: ['🌲', '🪨', '🦉'], card: 'from-indigo-700 to-slate-900', label: 'Nightfall' },
};

/* ------------------------------ Modifiers ------------------------------ */

export const MODS: Record<ModKey, { name: string; icon: string; desc: string; good?: boolean }> = {
  swift: { name: 'Swift Foes', icon: '💨', desc: 'Enemies move 20% faster.' },
  tough: { name: 'Thick Hide', icon: '🛡️', desc: 'Enemies have 25% more health.' },
  poor: { name: 'Scarce Loot', icon: '🪙', desc: 'Kill rewards reduced by 20%.' },
  windfall: { name: 'Windfall', icon: '💰', desc: 'Kill rewards increased by 25%.', good: true },
  fog: { name: 'Thick Fog', icon: '🌫️', desc: 'Tower range reduced by 15%.' },
  regen: { name: 'Regeneration', icon: '💚', desc: 'Enemies heal 2% of max health each second.' },
  horde: { name: 'Endless Horde', icon: '👥', desc: '30% more enemies per wave.' },
  air: { name: 'Air Raid', icon: '🦅', desc: 'Many more flying enemies. Cannons struggle.' },
};

/* ------------------------------ Difficulty ------------------------------ */

export interface Difficulty {
  id: number;
  name: string;
  icon: string;
  hp: number;
  reward: number;
  startGold: number;
  lives: number;
  gap: number;
  color: string;
  desc: string;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 0, name: 'Easy', icon: '🌱', hp: 0.8, reward: 1.2, startGold: 1.3, lives: 25, gap: 20, color: 'bg-emerald-500', desc: 'Relaxed. Weaker foes, more gold.' },
  { id: 1, name: 'Normal', icon: '⚔️', hp: 1, reward: 1, startGold: 1, lives: 20, gap: 14, color: 'bg-sky-500', desc: 'The intended challenge.' },
  { id: 2, name: 'Hard', icon: '🔥', hp: 1.3, reward: 0.9, startGold: 0.9, lives: 12, gap: 10, color: 'bg-orange-500', desc: 'Tougher foes, fewer lives.' },
  { id: 3, name: 'Nightmare', icon: '💀', hp: 1.5, reward: 0.85, startGold: 0.85, lives: 8, gap: 7, color: 'bg-rose-600', desc: 'Brutal. Almost no room for error.' },
];

/* ------------------------------ Levels ------------------------------ */

export interface LevelDef {
  id: number;
  name: string;
  theme: ThemeKey;
  desc: string;
  paths: Pt[][];
  waves: number;
  gold: number;
  rocks: number;
  mods: ModKey[];
  seed: number;
}

export const LEVELS: LevelDef[] = [
  { id: 1, name: 'Meadow Trail', theme: 'meadow', desc: 'A gentle winding road. Learn the basics.', paths: [[[-1, 2], [4, 2], [4, 7], [10, 7], [10, 3], [16, 3]]], waves: 8, gold: 200, rocks: 12, mods: [], seed: 11 },
  { id: 2, name: 'Forest Bend', theme: 'forest', desc: 'A long snake through the trees.', paths: [[[-1, 1], [13, 1], [13, 4], [2, 4], [2, 8], [16, 8]]], waves: 10, gold: 230, rocks: 16, mods: [], seed: 22 },
  { id: 3, name: 'Frozen Pass', theme: 'snow', desc: 'Frost Nova unlocked! The horde is coming.', paths: [[[-1, 5], [3, 5], [3, 1], [8, 1], [8, 8], [12, 8], [12, 5], [16, 5]]], waves: 10, gold: 260, rocks: 14, mods: ['horde'], seed: 33 },
  { id: 4, name: 'Twin Rivers', theme: 'meadow', desc: 'Two roads, one gate. Split your defenses.', paths: [[[-1, 1], [7, 1], [7, 5], [16, 5]], [[-1, 8], [7, 8], [7, 5], [16, 5]]], waves: 12, gold: 300, rocks: 14, mods: ['windfall'], seed: 44 },
  { id: 5, name: 'Dune Crossroads', theme: 'desert', desc: 'Tesla Coil unlocked. Bats raid from above.', paths: [[[-1, 4], [5, 4], [5, 1], [10, 1], [10, 6], [6, 6], [6, 8], [16, 8]]], waves: 12, gold: 340, rocks: 14, mods: ['air'], seed: 55 },
  { id: 6, name: 'Lava Spiral', theme: 'lava', desc: 'They spiral inward, and they are fast.', paths: [[[-1, 1], [14, 1], [14, 8], [1, 8], [1, 3], [11, 3], [11, 6], [4, 6]]], waves: 14, gold: 380, rocks: 10, mods: ['swift'], seed: 66 },
  { id: 7, name: 'Night Siege', theme: 'night', desc: 'Sniper Nest unlocked. Fog hides the enemy.', paths: [[[-1, 1], [10, 1], [10, 5], [16, 5]], [[-1, 8], [5, 8], [5, 5], [10, 5]]], waves: 14, gold: 420, rocks: 14, mods: ['fog'], seed: 77 },
  { id: 8, name: 'Ice Labyrinth', theme: 'snow', desc: 'A maze of corridors. Tight build slots.', paths: [[[-1, 1], [14, 1], [14, 3], [1, 3], [1, 5], [14, 5], [14, 7], [1, 7], [1, 9], [16, 9]]], waves: 15, gold: 460, rocks: 4, mods: ['tough', 'horde'], seed: 88 },
  { id: 9, name: 'Three Fangs', theme: 'lava', desc: 'Three lanes converge at the gate.', paths: [[[-1, 1], [12, 1], [12, 5], [16, 5]], [[-1, 5], [12, 5]], [[-1, 9], [12, 9], [12, 5]]], waves: 16, gold: 500, rocks: 12, mods: ['swift', 'poor'], seed: 99 },
  { id: 10, name: 'Skyfall', theme: 'night', desc: 'The sky is black with wings.', paths: [[[-1, 2], [5, 2], [5, 7], [10, 7], [10, 2], [16, 2]]], waves: 16, gold: 540, rocks: 14, mods: ['air', 'fog'], seed: 110 },
  { id: 11, name: "Warlord's Keep", theme: 'desert', desc: 'Regenerating brutes march on the keep.', paths: [[[-1, 8], [3, 8], [3, 2], [7, 2], [7, 7], [12, 7], [12, 1], [16, 1]]], waves: 18, gold: 580, rocks: 14, mods: ['regen', 'tough'], seed: 121 },
  { id: 12, name: 'Final Stand', theme: 'lava', desc: 'Everything you have learned. Survive.', paths: [[[-1, 1], [9, 1], [9, 4], [16, 4]], [[-1, 8], [6, 8], [6, 6], [16, 6]]], waves: 20, gold: 650, rocks: 12, mods: ['tough', 'horde', 'air'], seed: 132 },
];

/* ------------------------------ Waves ------------------------------ */

export interface WaveGroup {
  type: EnemyType;
  count: number;
  delay: number;
  interval: number;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { mulberry32 };

export function generateWaves(level: LevelDef): WaveGroup[][] {
  const levelIdx = level.id - 1;
  const rng = mulberry32(level.seed * 7919);
  const air = level.mods.includes('air');
  const horde = level.mods.includes('horde') ? 1.3 : 1;
  const waves: WaveGroup[][] = [];

  for (let w = 1; w <= level.waves; w++) {
    const score = levelIdx * 3 + (w / level.waves) * 3;
    const avail = (Object.values(ENEMIES) as EnemyDef[])
      .filter((e) => e.id !== 'boss')
      .filter((e) => (e.id === 'flyer' && air ? score + 4.5 : score) >= e.intro)
      .filter((e) => !(e.id === 'flyer' && levelIdx === 0));

    const budget = (5 + w * 3) * (1 + levelIdx * 0.12) * horde;
    const isFinal = w === level.waves;
    const groupsN = w < 3 ? 1 : w < 8 ? 2 : 3;
    const groups: WaveGroup[] = [];
    const bossBudget = isFinal ? 0.55 : 1;

    // weights: favour newest enemy types so the player sees new stuff, but keep variety
    const weights = avail.map((e, i) => 1 + (i / Math.max(1, avail.length - 1)) * 2.2 + (e.id === 'flyer' && air ? 3 : 0));
    const pick = () => {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      for (let i = 0; i < avail.length; i++) {
        r -= weights[i];
        if (r <= 0) return avail[i];
      }
      return avail[avail.length - 1];
    };

    const used = new Set<EnemyType>();
    for (let g = 0; g < groupsN; g++) {
      let e = pick();
      let tries = 0;
      while (used.has(e.id) && tries++ < 6) e = pick();
      used.add(e.id);
      const share = (budget * bossBudget) / groupsN;
      const count = Math.min(60, Math.max(1, Math.round(share / e.cost)));
      groups.push({
        type: e.id,
        count,
        delay: g * (2.5 + rng() * 2),
        interval: e.interval * (0.8 + rng() * 0.4),
      });
    }

    const midBoss = levelIdx >= 4 && w === Math.ceil(level.waves / 2);
    if (isFinal) {
      groups.push({ type: 'boss', count: 1 + Math.floor(levelIdx / 6), delay: 3, interval: 5 });
    } else if (midBoss) {
      groups.push({ type: 'boss', count: 1, delay: 4, interval: 5 });
    }
    waves.push(groups);
  }
  return waves;
}
