export type WeaponId = 'knife' | 'axe' | 'pistol' | 'smg' | 'ar' | 'shotgun' | 'sniper';
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
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  knife: { id: 'knife', name: 'Combat Knife', kind: 'melee', dmg: 45, rate: 0.36, range: 2.7, mag: 0, reload: 0, spread: 0, pellets: 1, auto: true, ammo: null, tier: 0, rarity: 0, recoil: 0, zoom: 62, len: 0.4, tracer: 0xffffff },
  axe: { id: 'axe', name: 'Fire Axe', kind: 'melee', dmg: 85, rate: 0.8, range: 3.4, mag: 0, reload: 0, spread: 0, pellets: 1, auto: true, ammo: null, tier: 1, rarity: 1, recoil: 0, zoom: 62, len: 0.6, tracer: 0xffffff },
  pistol: { id: 'pistol', name: 'M9 Pistol', kind: 'gun', dmg: 24, rate: 0.25, range: 110, mag: 12, reload: 1.0, spread: 0.012, pellets: 1, auto: false, ammo: 'light', tier: 1, rarity: 0, recoil: 0.012, zoom: 54, len: 0.35, tracer: 0xffe9a8 },
  smg: { id: 'smg', name: 'Vector SMG', kind: 'gun', dmg: 15, rate: 0.075, range: 85, mag: 30, reload: 1.3, spread: 0.032, pellets: 1, auto: true, ammo: 'light', tier: 2, rarity: 1, recoil: 0.011, zoom: 52, len: 0.55, tracer: 0xffe08a },
  ar: { id: 'ar', name: 'AK-47 Rifle', kind: 'gun', dmg: 26, rate: 0.11, range: 170, mag: 30, reload: 1.7, spread: 0.018, pellets: 1, auto: true, ammo: 'rifle', tier: 3, rarity: 2, recoil: 0.015, zoom: 48, len: 0.9, tracer: 0xffd166 },
  shotgun: { id: 'shotgun', name: 'M1887 Shotgun', kind: 'gun', dmg: 12, rate: 0.85, range: 42, mag: 6, reload: 2.0, spread: 0.075, pellets: 9, auto: false, ammo: 'shell', tier: 2, rarity: 2, recoil: 0.065, zoom: 55, len: 1.0, tracer: 0xffb36b },
  sniper: { id: 'sniper', name: 'AWM Sniper', kind: 'gun', dmg: 105, rate: 1.25, range: 420, mag: 5, reload: 2.3, spread: 0.0012, pellets: 1, auto: false, ammo: 'rifle', tier: 4, rarity: 3, recoil: 0.055, zoom: 22, len: 1.25, tracer: 0x9be7ff },
};

export const RARITY_COLORS = [0xd1d5db, 0x4ade80, 0x38bdf8, 0xc084fc, 0xfbbf24];
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
    id: 'room',
    name: 'Room Match',
    tag: 'PRIVATE ROOM · 12',
    desc: 'Create a room, gather the squad, fight on a compact arena. Fast & tense.',
    icon: '🚪',
    players: 12,
    half: 190,
    startR: 280,
    towns: 4,
    loot: 130,
    vehicles: { car: 3, bike: 3, truck: 2 },
    room: true,
    phases: [
      { wait: 34, shrink: 20, radius: 120, dps: 3 },
      { wait: 16, shrink: 18, radius: 62, dps: 6 },
      { wait: 12, shrink: 14, radius: 26, dps: 10 },
      { wait: 8, shrink: 12, radius: 5, dps: 14 },
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
