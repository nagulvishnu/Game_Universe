// ---------- Static game data for NEON FRONT ----------

export type WeaponId = 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'plasma' | 'flame' | 'rocket' | 'rail' | 'arc';
export type CharId = 'ryker' | 'nova' | 'brick' | 'echo' | 'vex' | 'inferno';
export type EnemyId = 'grunt' | 'gunner' | 'runner' | 'brute' | 'sniper' | 'drone' | 'turret';
export type VehicleId = 'jeep' | 'tank' | 'hover' | 'heli';
export type UpgradeId = 'health' | 'damage' | 'speed' | 'ammo' | 'cooldown' | 'credits';
export type BossPattern = 'spread' | 'ring' | 'burst' | 'summon' | 'charge' | 'rockets' | 'sweep' | 'teleport';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  desc: string;
  color: string;
  dmg: number;
  rate: number;
  mag: number;
  reserve: number;
  reload: number;
  speed: number;
  spread: number;
  pellets: number;
  life: number;
  pierce: number;
  kind: 'bullet' | 'flame' | 'rocket' | 'rail' | 'arc' | 'plasma' | 'shell';
  explode: number;
  cost: number;
  auto: boolean;
  shake: number;
  size: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: 'pistol', name: 'M9 Sidearm', icon: '🔫', desc: 'Reliable and accurate. Infinite reserve ammo.', color: '#ffe9a8', dmg: 16, rate: 4.5, mag: 12, reserve: 9999, reload: 0.8, speed: 950, spread: 0.03, pellets: 1, life: 0.7, pierce: 1, kind: 'bullet', explode: 0, cost: 0, auto: false, shake: 1, size: 3 },
  smg: { id: 'smg', name: 'Viper SMG', icon: '🪖', desc: 'Blazing fire rate, loose spread.', color: '#ffd24a', dmg: 9, rate: 15, mag: 35, reserve: 280, reload: 1.4, speed: 980, spread: 0.1, pellets: 1, life: 0.65, pierce: 1, kind: 'bullet', explode: 0, cost: 400, auto: true, shake: 1, size: 3 },
  shotgun: { id: 'shotgun', name: 'Breacher', icon: '💢', desc: 'Devastating at close range. 8 pellets.', color: '#ff9a4a', dmg: 11, rate: 1.5, mag: 6, reserve: 54, reload: 1.9, speed: 850, spread: 0.32, pellets: 8, life: 0.42, pierce: 1, kind: 'shell', explode: 0, cost: 600, auto: false, shake: 6, size: 3 },
  rifle: { id: 'rifle', name: 'AR-7 Striker', icon: '🎯', desc: 'Accurate, high damage automatic rifle.', color: '#9dff6a', dmg: 22, rate: 8.5, mag: 30, reserve: 210, reload: 1.6, speed: 1150, spread: 0.035, pellets: 1, life: 0.9, pierce: 1, kind: 'bullet', explode: 0, cost: 900, auto: true, shake: 1.5, size: 3.5 },
  plasma: { id: 'plasma', name: 'Plasma Carbine', icon: '🔷', desc: 'Piercing energy bolts that slow targets.', color: '#4fd2ff', dmg: 26, rate: 5.5, mag: 24, reserve: 140, reload: 1.5, speed: 720, spread: 0.04, pellets: 1, life: 1.1, pierce: 3, kind: 'plasma', explode: 0, cost: 1300, auto: true, shake: 1.5, size: 6 },
  arc: { id: 'arc', name: 'Tesla Arc', icon: '⚡', desc: 'Chain lightning jumps between up to 5 foes.', color: '#b48cff', dmg: 24, rate: 3.2, mag: 22, reserve: 110, reload: 1.7, speed: 0, spread: 0, pellets: 1, life: 0, pierce: 5, kind: 'arc', explode: 0, cost: 2000, auto: true, shake: 1, size: 3 },
  flame: { id: 'flame', name: 'Inferno Thrower', icon: '🔥', desc: 'Short range stream of fire. Burns enemies.', color: '#ff7a2a', dmg: 5, rate: 32, mag: 110, reserve: 440, reload: 2.1, speed: 560, spread: 0.2, pellets: 1, life: 0.34, pierce: 3, kind: 'flame', explode: 0, cost: 1500, auto: true, shake: 0.5, size: 8 },
  rocket: { id: 'rocket', name: 'Hellfire Launcher', icon: '🚀', desc: 'Explosive rockets with a huge blast radius.', color: '#ff5a3a', dmg: 95, rate: 1.2, mag: 3, reserve: 21, reload: 2.3, speed: 620, spread: 0.02, pellets: 1, life: 1.6, pierce: 1, kind: 'rocket', explode: 120, cost: 2600, auto: false, shake: 7, size: 6 },
  rail: { id: 'rail', name: 'Longbow Railgun', icon: '☄️', desc: 'Hitscan beam that pierces everything.', color: '#ffffff', dmg: 170, rate: 0.95, mag: 4, reserve: 28, reload: 2.2, speed: 0, spread: 0, pellets: 1, life: 0, pierce: 99, kind: 'rail', explode: 0, cost: 3200, auto: false, shake: 9, size: 4 },
};

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'plasma', 'arc', 'flame', 'rocket', 'rail'];

export interface CharDef {
  id: CharId;
  name: string;
  title: string;
  icon: string;
  color: string;
  color2: string;
  hp: number;
  speed: number;
  crit: number;
  desc: string;
  passive: string;
  skill: { name: string; desc: string; cd: number };
  ult: { name: string; desc: string };
  cost: number;
  mods: { dmg?: Partial<Record<WeaponId, number>>; melee?: number; magnet?: number; credit?: number; expl?: number; burnImmune?: boolean };
}

export const CHARS: Record<CharId, CharDef> = {
  ryker: {
    id: 'ryker', name: 'RYKER', title: 'Vanguard Commando', icon: '🪖', color: '#4fb3ff', color2: '#1b4a8a', hp: 120, speed: 230, crit: 0.08, cost: 0,
    desc: 'Balanced frontline soldier. Reliable in every situation.',
    passive: 'SMG & Rifle deal +15% damage.',
    skill: { name: 'Adrenaline', desc: '+35% speed and +50% fire rate for 5s.', cd: 14 },
    ult: { name: 'Orbital Airstrike', desc: 'Call 12 devastating strikes on the cursor area.' },
    mods: { dmg: { smg: 1.15, rifle: 1.15 } },
  },
  nova: {
    id: 'nova', name: 'NOVA', title: 'Cyber Ninja', icon: '🥷', color: '#ff3df2', color2: '#6a0f66', hp: 85, speed: 285, crit: 0.12, cost: 800,
    desc: 'Lightning fast assassin. Fragile but deadly up close.',
    passive: 'Melee does double damage. +10% crit.',
    skill: { name: 'Phase Blink', desc: 'Teleport toward the cursor, slicing enemies on the way.', cd: 6 },
    ult: { name: 'Blade Storm', desc: '6 spectral blades orbit you for 8s, shredding foes and blocking bullets.' },
    mods: { melee: 2 },
  },
  brick: {
    id: 'brick', name: 'BRICK', title: 'Heavy Gunner', icon: '🛡️', color: '#ff9a3d', color2: '#7a3d0a', hp: 195, speed: 190, crit: 0.05, cost: 1500,
    desc: 'Walking fortress with massive health and heavy weapons.',
    passive: 'Shotgun, Rocket & Flame +25% damage.',
    skill: { name: 'Bulwark Shield', desc: 'Invulnerable for 4s. Reflects all enemy bullets back.', cd: 16 },
    ult: { name: 'Overdrive', desc: '8s of double damage, infinite ammo, no reloads.' },
    mods: { dmg: { shotgun: 1.25, rocket: 1.25, flame: 1.25 } },
  },
  echo: {
    id: 'echo', name: 'ECHO', title: 'Tech Engineer', icon: '🔧', color: '#3dffb0', color2: '#0a6a45', hp: 100, speed: 230, crit: 0.08, cost: 2200,
    desc: 'Deploys automated defenses and drones to control the battlefield.',
    passive: 'Pickup magnet range doubled. +20% credits.',
    skill: { name: 'Sentry Turret', desc: 'Deploy an auto-turret that lasts 18s (max 2).', cd: 10 },
    ult: { name: 'Drone Swarm', desc: '4 combat drones orbit you and hunt enemies for 14s.' },
    mods: { magnet: 2, credit: 1.2 },
  },
  vex: {
    id: 'vex', name: 'VEX', title: 'Chrono Sniper', icon: '❄️', color: '#9be8ff', color2: '#2a6a8a', hp: 90, speed: 240, crit: 0.25, cost: 3000,
    desc: 'Master of time and precision. Huge critical strike chance.',
    passive: 'Plasma, Arc & Railgun +25% damage. 25% crit.',
    skill: { name: 'Chrono Field', desc: 'Slow time for enemies by 70% for 4s.', cd: 15 },
    ult: { name: 'Absolute Zero', desc: 'Freeze every enemy nearby for 4s and shatter them for damage.' },
    mods: { dmg: { plasma: 1.25, arc: 1.25, rail: 1.25 } },
  },
  inferno: {
    id: 'inferno', name: 'INFERNO', title: 'Pyro Berserker', icon: '🔥', color: '#ff5a2a', color2: '#7a1a05', hp: 125, speed: 235, crit: 0.08, cost: 3800,
    desc: 'Fueled by flame. Everything she touches burns.',
    passive: 'Immune to fire. Flame +60% damage. Explosions +20%.',
    skill: { name: 'Fire Nova', desc: 'Burst of flame ignites and shoves back nearby enemies.', cd: 8 },
    ult: { name: 'Hellwave', desc: 'Expanding wave of fire scorches the entire area.' },
    mods: { dmg: { flame: 1.6 }, expl: 1.2, burnImmune: true },
  },
};

export const CHAR_ORDER: CharId[] = ['ryker', 'nova', 'brick', 'echo', 'vex', 'inferno'];

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  r: number;
  color: string;
  score: number;
  credits: number;
  dmg: number;
  flying?: boolean;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  grunt: { id: 'grunt', name: 'Grunt', hp: 45, speed: 115, r: 14, color: '#e24a4a', score: 10, credits: 5, dmg: 12 },
  gunner: { id: 'gunner', name: 'Gunner', hp: 55, speed: 95, r: 14, color: '#ff9a3d', score: 15, credits: 7, dmg: 8 },
  runner: { id: 'runner', name: 'Kamikaze', hp: 26, speed: 245, r: 12, color: '#ffe14a', score: 12, credits: 6, dmg: 30 },
  brute: { id: 'brute', name: 'Brute', hp: 300, speed: 72, r: 25, color: '#a02a3a', score: 40, credits: 20, dmg: 28 },
  sniper: { id: 'sniper', name: 'Sniper', hp: 42, speed: 75, r: 14, color: '#b06aff', score: 25, credits: 12, dmg: 32 },
  drone: { id: 'drone', name: 'Drone', hp: 34, speed: 165, r: 12, color: '#4fe0ff', score: 18, credits: 8, dmg: 6, flying: true },
  turret: { id: 'turret', name: 'Turret', hp: 170, speed: 0, r: 20, color: '#8a8a9a', score: 30, credits: 15, dmg: 9 },
};

export interface BossDef {
  name: string;
  title: string;
  hp: number;
  r: number;
  speed: number;
  color: string;
  color2: string;
  patterns: BossPattern[];
  cd: number;
}

export interface VehicleDef {
  id: VehicleId;
  name: string;
  icon: string;
  desc: string;
  hp: number;
  speed: number;
  accel: number;
  r: number;
  color: string;
  color2: string;
  flying: boolean;
  ram: number;
  fireRate: number;
  dmg: number;
  boostMult: number;
  boostDur: number;
  boostCd: number;
}

export const VEHICLES: Record<VehicleId, VehicleDef> = {
  jeep: { id: 'jeep', name: 'Raptor Jeep', icon: '🚙', desc: 'Fast armored buggy with a mounted machine gun. Great for running enemies over.', hp: 320, speed: 400, accel: 4, r: 26, color: '#6aa84f', color2: '#38611f', flying: false, ram: 45, fireRate: 12, dmg: 12, boostMult: 1.6, boostDur: 1.2, boostCd: 5 },
  tank: { id: 'tank', name: 'Titan Tank', icon: '🛡️', desc: 'Slow but nearly unstoppable. Fires explosive cannon shells.', hp: 900, speed: 200, accel: 2.6, r: 36, color: '#7a8a5a', color2: '#454f30', flying: false, ram: 90, fireRate: 1.6, dmg: 85, boostMult: 1.4, boostDur: 1.5, boostCd: 7 },
  hover: { id: 'hover', name: 'Phantom Hoverbike', icon: '🏍️', desc: 'Extremely agile with twin plasma cannons and a turbo boost.', hp: 230, speed: 500, accel: 6, r: 22, color: '#4fd2ff', color2: '#0b5a80', flying: false, ram: 35, fireRate: 9, dmg: 16, boostMult: 1.9, boostDur: 1.0, boostCd: 4 },
  heli: { id: 'heli', name: 'Hornet Gunship', icon: '🚁', desc: 'Flies over walls. Minigun plus homing missile barrages.', hp: 420, speed: 350, accel: 2.5, r: 30, color: '#c0c0d0', color2: '#555566', flying: true, ram: 0, fireRate: 16, dmg: 10, boostMult: 1.5, boostDur: 1.5, boostCd: 6 },
};

export type DecorKind = 'desert' | 'swamp' | 'ice' | 'city' | 'lava' | 'space' | 'ruins' | 'core';

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  desc: string;
  goal: number;
  size: [number, number];
  theme: { bg: string; bg2: string; grid: string; wall: string; wallTop: string; crate: string; accent: string; decor: DecorKind; fog: string };
  enemies: [EnemyId, number][];
  boss: BossDef;
  vehicles: VehicleId[];
  hazard?: { type: 'toxic' | 'lava' | 'energy'; count: number };
  turrets: number;
}

export const LEVELS: LevelDef[] = [
  {
    id: 0, name: 'OUTPOST ALPHA', subtitle: 'Desert Frontier', desc: 'Rebel forces hold a dusty outpost. Break through their lines and take down the Warden.',
    goal: 18, size: [2600, 1900],
    theme: { bg: '#3d3226', bg2: '#463a2b', grid: 'rgba(255,220,150,0.05)', wall: '#6b5a40', wallTop: '#8a7552', crate: '#9a6a3a', accent: '#ffb347', decor: 'desert', fog: 'rgba(255,170,60,0.06)' },
    enemies: [['grunt', 5], ['gunner', 3], ['runner', 1]], vehicles: ['jeep', 'jeep'], turrets: 0,
    boss: { name: 'THE WARDEN', title: 'Outpost Commander Mech', hp: 2000, r: 42, speed: 80, color: '#c8683a', color2: '#5a2a14', patterns: ['spread', 'charge', 'burst'], cd: 2.2 },
  },
  {
    id: 1, name: 'TOXIC SWAMP', subtitle: 'Bio-Hazard Zone', desc: 'Mutated creatures swarm from the toxic bog. Avoid the acid pools and kill the Hive Queen.',
    goal: 23, size: [2700, 1980],
    theme: { bg: '#10261b', bg2: '#15301f', grid: 'rgba(120,255,120,0.05)', wall: '#2f4a36', wallTop: '#436a4c', crate: '#5a6a2a', accent: '#7cff4f', decor: 'swamp', fog: 'rgba(80,255,80,0.07)' },
    enemies: [['grunt', 4], ['gunner', 3], ['runner', 3]], vehicles: ['jeep', 'hover'], turrets: 1, hazard: { type: 'toxic', count: 9 },
    boss: { name: 'HIVE QUEEN', title: 'Mother of the Swarm', hp: 2600, r: 46, speed: 70, color: '#8aff4a', color2: '#2a5a14', patterns: ['summon', 'ring', 'spread', 'burst'], cd: 2.0 },
  },
  {
    id: 2, name: 'FROZEN RIDGE', subtitle: 'Arctic Stronghold', desc: 'Heavy brutes and snipers guard the glacier fortress. Shatter the Cryo Titan.',
    goal: 28, size: [2800, 2060],
    theme: { bg: '#1b2b3a', bg2: '#213446', grid: 'rgba(160,230,255,0.06)', wall: '#5a7d99', wallTop: '#86b3d4', crate: '#4a6a8a', accent: '#9be8ff', decor: 'ice', fog: 'rgba(140,220,255,0.07)' },
    enemies: [['grunt', 3], ['gunner', 3], ['brute', 2], ['sniper', 2]], vehicles: ['tank', 'jeep'], turrets: 2,
    boss: { name: 'CRYO TITAN', title: 'Glacier Colossus', hp: 3400, r: 50, speed: 65, color: '#8fdcff', color2: '#2a5a80', patterns: ['ring', 'burst', 'rockets', 'charge'], cd: 1.9 },
  },
  {
    id: 3, name: 'NEON CITY', subtitle: 'Cyber District', desc: 'Drones patrol the glowing streets. The Phantom lurks somewhere in the static.',
    goal: 33, size: [2900, 2140],
    theme: { bg: '#130f20', bg2: '#1a1530', grid: 'rgba(255,60,240,0.07)', wall: '#3a2a5c', wallTop: '#5a3f8c', crate: '#7a2a7a', accent: '#ff3df2', decor: 'city', fog: 'rgba(255,60,240,0.06)' },
    enemies: [['gunner', 4], ['runner', 3], ['drone', 3], ['sniper', 1]], vehicles: ['hover', 'tank'], turrets: 3,
    boss: { name: 'THE PHANTOM', title: 'Quantum Assassin', hp: 3000, r: 34, speed: 120, color: '#ff3df2', color2: '#5a0a5a', patterns: ['teleport', 'burst', 'spread', 'ring'], cd: 1.5 },
  },
  {
    id: 4, name: 'VOLCANO FOUNDRY', subtitle: 'Molten Works', desc: 'Lava flows through the factory floor. The Magma Golem forges an army of brutes.',
    goal: 38, size: [3000, 2200],
    theme: { bg: '#2a1410', bg2: '#33190f', grid: 'rgba(255,120,40,0.06)', wall: '#5c3326', wallTop: '#8a4a32', crate: '#7a4a2a', accent: '#ff7a2a', decor: 'lava', fog: 'rgba(255,100,30,0.08)' },
    enemies: [['grunt', 3], ['brute', 3], ['gunner', 2], ['runner', 2], ['drone', 1]], vehicles: ['tank', 'heli'], turrets: 3, hazard: { type: 'lava', count: 11 },
    boss: { name: 'MAGMA GOLEM', title: 'Heart of the Foundry', hp: 4200, r: 54, speed: 75, color: '#ff6a1a', color2: '#5a1a05', patterns: ['charge', 'ring', 'rockets', 'summon'], cd: 1.8 },
  },
  {
    id: 5, name: 'ORBITAL STATION', subtitle: 'Zero-G Platform', desc: 'Fight through a derelict station swarming with drones. The Overlord awaits at the core.',
    goal: 43, size: [3100, 2260],
    theme: { bg: '#0b1020', bg2: '#101830', grid: 'rgba(80,200,255,0.07)', wall: '#34415f', wallTop: '#5a6e9a', crate: '#3a5a7a', accent: '#4fd2ff', decor: 'space', fog: 'rgba(60,160,255,0.06)' },
    enemies: [['drone', 4], ['gunner', 3], ['sniper', 2], ['brute', 2], ['runner', 1]], vehicles: ['heli', 'tank', 'hover'], turrets: 4,
    boss: { name: 'THE OVERLORD', title: 'Station AI Core', hp: 4800, r: 48, speed: 85, color: '#4fd2ff', color2: '#0a3a5a', patterns: ['spread', 'summon', 'rockets', 'sweep', 'ring'], cd: 1.7 },
  },
  {
    id: 6, name: 'RUINED METROPOLIS', subtitle: 'Fallen Capital', desc: 'An endless army floods the ruins of the capital. The Siege Walker guards the final bridge.',
    goal: 48, size: [3200, 2340],
    theme: { bg: '#1c1c22', bg2: '#22222a', grid: 'rgba(255,220,100,0.05)', wall: '#50505c', wallTop: '#74748a', crate: '#6a5a3a', accent: '#ffd24a', decor: 'ruins', fog: 'rgba(255,210,80,0.05)' },
    enemies: [['grunt', 3], ['gunner', 3], ['runner', 2], ['brute', 2], ['sniper', 2], ['drone', 2]], vehicles: ['tank', 'heli', 'jeep'], turrets: 4,
    boss: { name: 'SIEGE WALKER', title: 'Bipedal War Machine', hp: 5600, r: 58, speed: 70, color: '#ffd24a', color2: '#5a4a10', patterns: ['rockets', 'ring', 'summon', 'charge', 'burst'], cd: 1.6 },
  },
  {
    id: 7, name: 'OMEGA CORE', subtitle: 'Final Assault', desc: 'The source of the invasion. Everything you have learned will be tested. Destroy the Omega Core.',
    goal: 55, size: [3300, 2420],
    theme: { bg: '#1a0510', bg2: '#240718', grid: 'rgba(255,40,90,0.07)', wall: '#5a1238', wallTop: '#8a2058', crate: '#7a1a3a', accent: '#ff2a5a', decor: 'core', fog: 'rgba(255,30,80,0.08)' },
    enemies: [['grunt', 3], ['gunner', 3], ['runner', 3], ['brute', 3], ['sniper', 2], ['drone', 3]], vehicles: ['jeep', 'tank', 'hover', 'heli'], turrets: 5, hazard: { type: 'energy', count: 10 },
    boss: { name: 'OMEGA CORE', title: 'The Final Intelligence', hp: 8000, r: 62, speed: 90, color: '#ff2a5a', color2: '#4a0518', patterns: ['spread', 'ring', 'burst', 'summon', 'charge', 'rockets', 'sweep', 'teleport'], cd: 1.3 },
  },
];

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  desc: string;
  base: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'health', name: 'Armor Plating', icon: '❤️', desc: '+15% max health per level', base: 300 },
  { id: 'damage', name: 'Weapon Tuning', icon: '💥', desc: '+10% weapon damage per level', base: 400 },
  { id: 'speed', name: 'Servo Boots', icon: '👟', desc: '+5% movement speed per level', base: 250 },
  { id: 'ammo', name: 'Ammo Pouches', icon: '🎒', desc: '+20% reserve ammo capacity per level', base: 250 },
  { id: 'cooldown', name: 'Quantum Core', icon: '⏱️', desc: '-8% skill cooldown & faster ultimate charge', base: 350 },
  { id: 'credits', name: 'Salvage Rights', icon: '💰', desc: '+10% credits earned per level', base: 300 },
];
export const MAX_UPGRADE = 5;

// ---------- Save data ----------
export interface Save {
  credits: number;
  unlocked: number;
  weapons: WeaponId[];
  chars: CharId[];
  upgrades: Record<UpgradeId, number>;
  best: Record<number, number>;
  char: CharId;
}

const KEY = 'neon-front-save-v1';

export function defaultSave(): Save {
  return {
    credits: 300,
    unlocked: 0,
    weapons: ['pistol'],
    chars: ['ryker'],
    upgrades: { health: 0, damage: 0, speed: 0, ammo: 0, cooldown: 0, credits: 0 },
    best: {},
    char: 'ryker',
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    return { ...defaultSave(), ...s, upgrades: { ...defaultSave().upgrades, ...(s.upgrades || {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function resetSave(): Save {
  const s = defaultSave();
  writeSave(s);
  return s;
}
