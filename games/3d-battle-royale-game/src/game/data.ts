export type WeaponId = 'knife' | 'axe' | 'pistol' | 'smg' | 'ar' | 'shotgun' | 'sniper' | 'lmg' | 'burst' | 'revolver';
export type AmmoType = 'light' | 'rifle' | 'shell';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: 'melee' | 'gun';
  dmg: number;
  rate: number; // seconds between shots
  range: number;
  mag: number;
  reload: number;
  spread: number;
  pellets: number;
  auto: boolean;
  ammo: AmmoType | null;
  tier: number;
  rarity: number; // 0..4
  recoil: number;
  zoom: number; // ADS fov
  len: number; // muzzle distance
  tracer: number;
  burst?: number; // rounds per trigger pull (burst weapons)
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  knife: { id: 'knife', name: 'Combat Knife', kind: 'melee', dmg: 45, rate: 0.36, range: 2.7, mag: 0, reload: 0, spread: 0, pellets: 1, auto: true, ammo: null, tier: 0, rarity: 0, recoil: 0, zoom: 62, len: 0.4, tracer: 0xffffff },
  axe: { id: 'axe', name: 'Fire Axe', kind: 'melee', dmg: 85, rate: 0.8, range: 3.4, mag: 0, reload: 0, spread: 0, pellets: 1, auto: true, ammo: null, tier: 1, rarity: 1, recoil: 0, zoom: 62, len: 0.6, tracer: 0xffffff },
  pistol: { id: 'pistol', name: 'M9 Pistol', kind: 'gun', dmg: 24, rate: 0.25, range: 110, mag: 12, reload: 1.0, spread: 0.012, pellets: 1, auto: false, ammo: 'light', tier: 1, rarity: 0, recoil: 0.012, zoom: 54, len: 0.35, tracer: 0xffe9a8 },
  smg: { id: 'smg', name: 'Vector SMG', kind: 'gun', dmg: 15, rate: 0.075, range: 85, mag: 30, reload: 1.3, spread: 0.032, pellets: 1, auto: true, ammo: 'light', tier: 2, rarity: 1, recoil: 0.011, zoom: 52, len: 0.55, tracer: 0xffe08a },
  ar: { id: 'ar', name: 'AK-47 Rifle', kind: 'gun', dmg: 26, rate: 0.11, range: 170, mag: 30, reload: 1.7, spread: 0.018, pellets: 1, auto: true, ammo: 'rifle', tier: 3, rarity: 2, recoil: 0.015, zoom: 48, len: 0.9, tracer: 0xffd166 },
  shotgun: { id: 'shotgun', name: 'M1887 Shotgun', kind: 'gun', dmg: 12, rate: 0.85, range: 42, mag: 6, reload: 2.0, spread: 0.075, pellets: 9, auto: false, ammo: 'shell', tier: 2, rarity: 2, recoil: 0.065, zoom: 55, len: 1.0, tracer: 0xffb36b },
  sniper: { id: 'sniper', name: 'AWM Sniper', kind: 'gun', dmg: 105, rate: 1.25, range: 420, mag: 5, reload: 2.3, spread: 0.0012, pellets: 1, auto: false, ammo: 'rifle', tier: 4, rarity: 3, recoil: 0.055, zoom: 22, len: 1.25, tracer: 0x9be7ff },
  lmg: { id: 'lmg', name: 'M60 LMG', kind: 'gun', dmg: 24, rate: 0.1, range: 165, mag: 75, reload: 3.4, spread: 0.04, pellets: 1, auto: true, ammo: 'rifle', tier: 4, rarity: 3, recoil: 0.02, zoom: 52, len: 1.05, tracer: 0xffc96b },
  burst: { id: 'burst', name: 'FAMAS Burst', kind: 'gun', dmg: 25, rate: 0.085, range: 175, mag: 30, reload: 1.8, spread: 0.012, pellets: 1, auto: false, burst: 3, ammo: 'rifle', tier: 3, rarity: 2, recoil: 0.02, zoom: 46, len: 0.85, tracer: 0xffd166 },
  revolver: { id: 'revolver', name: 'Magnum Revolver', kind: 'gun', dmg: 62, rate: 0.42, range: 140, mag: 6, reload: 1.7, spread: 0.009, pellets: 1, auto: false, ammo: 'light', tier: 3, rarity: 2, recoil: 0.05, zoom: 46, len: 0.35, tracer: 0xffb36b },
};

export const RARITY_COLORS = [0xd1d5db, 0x4ade80, 0x38bdf8, 0xc084fc, 0xfbbf24];

/* ---------------- maps ---------------- */
export type Biome = 'green' | 'desert' | 'snow' | 'tropical' | 'volcanic';

export interface MapDef {
  id: string;
  name: string;
  tag: string;
  desc: string;
  icon: string;
  half: number;   // world half-size at Classic scale
  towns: number;  // town count at Classic scale
  biome: Biome;
}

export const MAPS: MapDef[] = [
  { id: 'valley', name: 'Green Valley', tag: 'EXPANDED · TEMPERATE', desc: 'Huge rolling grassland, thick pine forest and 9 market towns.', icon: '🌲', half: 380, towns: 9, biome: 'green' },
  { id: 'dunes', name: 'Dust Basin', tag: 'DESERT', desc: 'Sun-bleached dunes, rock mesas and adobe compounds.', icon: '🏜️', half: 355, towns: 7, biome: 'desert' },
  { id: 'frost', name: 'Frosthold', tag: 'SNOW', desc: 'Frozen pines and white peaks — long sightlines, cold fights.', icon: '🏔️', half: 355, towns: 7, biome: 'snow' },
  { id: 'isle', name: 'Sunset Isle', tag: 'TROPICAL', desc: 'Palm coasts and bright jungle villages under a warm sky.', icon: '🌴', half: 330, towns: 7, biome: 'tropical' },
  { id: 'ash', name: 'Ashlands', tag: 'VOLCANIC', desc: 'Black rock, dead woods and a sky that never quite clears.', icon: '🌋', half: 340, towns: 6, biome: 'volcanic' },
];

export const DEFAULT_MAP = 'valley';

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}

/** per-biome atmosphere: fog/background color, sun color+intensity, sky-sphere tint, ambient light */
export const BIOME_SKY: Record<Biome, { fog: number; sun: number; sunI: number; tint: number; amb: number; ambI: number }> = {
  green: { fog: 0xb9d6f0, sun: 0xfff0d0, sunI: 1.5, tint: 0xffffff, amb: 0xe3efff, ambI: 1.0 },
  desert: { fog: 0xe8d3ab, sun: 0xffe4b0, sunI: 1.7, tint: 0xffe0bc, amb: 0xffe8c8, ambI: 1.1 },
  snow: { fog: 0xdfeaf5, sun: 0xeef4ff, sunI: 1.3, tint: 0xeaf2ff, amb: 0xeaf2ff, ambI: 1.15 },
  tropical: { fog: 0xc9e6d8, sun: 0xfff2d8, sunI: 1.6, tint: 0xd6f4e6, amb: 0xd8f2e4, ambI: 1.05 },
  volcanic: { fog: 0x8f7d72, sun: 0xffb08a, sunI: 1.0, tint: 0xb0907e, amb: 0xbba89c, ambI: 0.85 },
};
export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

export type VehicleType = 'car' | 'bike' | 'truck';
export interface VehicleDef {
  name: string;
  max: number;
  acc: number;
  turn: number;
  hp: number;
  r: number;
  ram: number;
  cam: number;
}
export const VEHICLES: Record<VehicleType, VehicleDef> = {
  car: { name: 'Buggy Car', max: 37, acc: 20, turn: 2.0, hp: 240, r: 1.9, ram: 1.0, cam: 8.5 },
  bike: { name: 'Dirt Bike', max: 43, acc: 28, turn: 2.8, hp: 110, r: 1.0, ram: 0.55, cam: 6.2 },
  truck: { name: 'Heavy Truck', max: 27, acc: 11, turn: 1.25, hp: 520, r: 2.7, ram: 1.9, cam: 11.5 },
};

export interface ZonePhase {
  wait: number;
  shrink: number;
  radius: number;
  dps: number;
}
export interface ModeDef {
  id: string;
  name: string;
  tag: string;
  desc: string;
  icon: string;
  players: number;
  half: number;
  startR: number;
  towns: number;
  loot: number;
  vehicles: Record<VehicleType, number>;
  phases: ZonePhase[];
  meleeOnly?: boolean;
  room?: boolean;
  /** 1 = free-for-all (default). 2 = duos team mode. 4 = squads. */
  teamSize?: number;
  /** arena deathmatch: seconds until respawn (no elimination) */
  respawn?: number;
  /** arena: first team to N kills wins */
  scoreLimit?: number;
  /** arena: match length in seconds (sudden death on tie) */
  timeLimit?: number;
}

export const MODES: ModeDef[] = [
  {
    id: 'classic',
    name: 'Classic Royale',
    tag: '50 PLAYERS',
    desc: 'Full 50-player drop. Loot up, drive hard, outlast the closing storm.',
    icon: '🪂',
    players: 50,
    half: 300,
    startR: 440,
    towns: 6,
    loot: 280,
    vehicles: { car: 6, bike: 6, truck: 4 },
    phases: [
      { wait: 48, shrink: 30, radius: 200, dps: 2 },
      { wait: 25, shrink: 25, radius: 110, dps: 4 },
      { wait: 20, shrink: 22, radius: 55, dps: 7 },
      { wait: 14, shrink: 18, radius: 22, dps: 10 },
      { wait: 8, shrink: 16, radius: 4, dps: 14 },
    ],
  },
  {
    id: 'duel',
    name: 'Duel Duos',
    tag: 'DUOS · 25 TEAMS',
    desc: 'Drop with a partner — you + 1 bot ally vs 24 rival duos. Last team standing wins.',
    icon: '🤝',
    players: 50,
    half: 290,
    startR: 420,
    towns: 6,
    loot: 300,
    vehicles: { car: 6, bike: 6, truck: 4 },
    teamSize: 2,
    phases: [
      { wait: 44, shrink: 28, radius: 195, dps: 2 },
      { wait: 24, shrink: 24, radius: 105, dps: 4 },
      { wait: 20, shrink: 22, radius: 52, dps: 7 },
      { wait: 14, shrink: 18, radius: 22, dps: 10 },
      { wait: 8, shrink: 16, radius: 4, dps: 14 },
    ],
  },
  {
    id: 'squad',
    name: 'Squad Ops',
    tag: 'SQUADS · 12 TEAMS',
    desc: 'You + 3 bot squadmates drop against 11 squads of 4. Only one team walks out.',
    icon: '🎖️',
    players: 48,
    half: 300,
    startR: 440,
    towns: 7,
    loot: 340,
    vehicles: { car: 6, bike: 7, truck: 5 },
    teamSize: 4,
    phases: [
      { wait: 48, shrink: 30, radius: 200, dps: 2 },
      { wait: 25, shrink: 25, radius: 110, dps: 4 },
      { wait: 20, shrink: 22, radius: 55, dps: 7 },
      { wait: 14, shrink: 18, radius: 22, dps: 10 },
      { wait: 8, shrink: 16, radius: 4, dps: 14 },
    ],
  },
  {
    id: 'room1',
    name: 'Room 1v1',
    tag: 'ARENA · 1v1',
    desc: 'Tiny arena, two fighters, infinite redeploy. First to 6 kills takes it.',
    icon: '🎯',
    players: 2,
    half: 100,
    startR: 140,
    towns: 1,
    loot: 45,
    vehicles: { car: 0, bike: 0, truck: 0 },
    room: true,
    teamSize: 2,
    respawn: 4,
    scoreLimit: 6,
    timeLimit: 180,
    phases: [
      { wait: 40, shrink: 20, radius: 90, dps: 1 },
      { wait: 10, shrink: 14, radius: 6, dps: 4 },
    ],
  },
  {
    id: 'room2',
    name: 'Room 2v2',
    tag: 'ARENA · 2v2',
    desc: 'Pair up in a compact arena with fast redeploy. First team to 10 kills wins.',
    icon: '⚔️',
    players: 4,
    half: 120,
    startR: 170,
    towns: 1,
    loot: 70,
    vehicles: { car: 0, bike: 0, truck: 0 },
    room: true,
    teamSize: 2,
    respawn: 5,
    scoreLimit: 10,
    timeLimit: 240,
    phases: [
      { wait: 40, shrink: 20, radius: 110, dps: 1 },
      { wait: 10, shrink: 14, radius: 6, dps: 4 },
    ],
  },
  {
    id: 'room4',
    name: 'Room 4v4',
    tag: 'ARENA · 4v4',
    desc: 'Full squad brawl on a small map. First team to 15 kills — or the highest score at time — wins.',
    icon: '💥',
    players: 8,
    half: 140,
    startR: 200,
    towns: 2,
    loot: 100,
    vehicles: { car: 0, bike: 0, truck: 0 },
    room: true,
    teamSize: 4,
    respawn: 6,
    scoreLimit: 15,
    timeLimit: 300,
    phases: [
      { wait: 40, shrink: 20, radius: 130, dps: 1 },
      { wait: 10, shrink: 14, radius: 6, dps: 4 },
    ],
  },
  {
    id: 'blitz',
    name: 'Blitz Rush',
    tag: '30 PLAYERS · FAST',
    desc: 'Packed loot, extra wheels and a storm in a hurry. Pure adrenaline.',
    icon: '⚡',
    players: 30,
    half: 240,
    startR: 350,
    towns: 5,
    loot: 260,
    vehicles: { car: 5, bike: 6, truck: 3 },
    phases: [
      { wait: 30, shrink: 20, radius: 150, dps: 3 },
      { wait: 14, shrink: 18, radius: 80, dps: 6 },
      { wait: 10, shrink: 14, radius: 36, dps: 10 },
      { wait: 7, shrink: 12, radius: 6, dps: 14 },
    ],
  },
  {
    id: 'brawl',
    name: 'Blade Brawl',
    tag: '20 PLAYERS · MELEE',
    desc: 'No guns. Knives, axes and bombs only. Get close and get brutal.',
    icon: '🪓',
    players: 20,
    half: 210,
    startR: 300,
    towns: 4,
    loot: 170,
    vehicles: { car: 4, bike: 4, truck: 3 },
    meleeOnly: true,
    phases: [
      { wait: 32, shrink: 20, radius: 130, dps: 3 },
      { wait: 16, shrink: 18, radius: 70, dps: 6 },
      { wait: 12, shrink: 14, radius: 28, dps: 10 },
      { wait: 8, shrink: 12, radius: 5, dps: 14 },
    ],
  },
];

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFS: Record<Difficulty, { acc: number; react: number; label: string }> = {
  easy: { acc: 0.55, react: 0.7, label: 'ROOKIE' },
  normal: { acc: 0.8, react: 0.45, label: 'VETERAN' },
  hard: { acc: 1.05, react: 0.25, label: 'ELITE' },
};

export const BOT_NAMES = [
  'Viper', 'Ghost', 'Raven', 'Havoc', 'Blaze', 'Nova', 'Rogue', 'Titan', 'Cobra', 'Falcon',
  'Reaper', 'Saber', 'Phantom', 'Storm', 'Hunter', 'Wolf', 'Jinx', 'Onyx', 'Echo', 'Zero',
  'Maverick', 'Shadow', 'Striker', 'Vector', 'Bandit', 'Cipher', 'Dagger', 'Fury', 'Hydra', 'Ionic',
  'Jester', 'Kodiak', 'Lynx', 'Mamba', 'Nitro', 'Omen', 'Pyro', 'Quake', 'Razor', 'Spectre',
  'Talon', 'Ultra', 'Venom', 'Warden', 'Xeno', 'Yeti', 'Zephyr', 'Atlas', 'Bolt', 'Crow',
  'Drift', 'Ember', 'Frost', 'Grim', 'Hawk', 'Iron', 'Jolt', 'Kilo', 'Luna', 'Moth',
];

export const SHIRTS = [0xe11d48, 0x2563eb, 0x16a34a, 0xd97706, 0x7c3aed, 0x0891b2, 0xdb2777, 0x65a30d, 0xea580c, 0x4f46e5, 0x0d9488, 0xb91c1c];
