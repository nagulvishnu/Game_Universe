// Data-driven Beyblade components. Add a new entry and it is automatically
// available in the shop, customization UI, 3D model and battle stats.
export type PartSlot = 'layer' | 'disc' | 'driver' | 'accessory';

export interface StatMods {
  atk?: number;
  def?: number;
  sta?: number;
  bal?: number;
  spd?: number;
  wt?: number;
  brs?: number;
}

export interface PartDef {
  id: string;
  slot: PartSlot;
  name: string;
  desc: string;
  color: string;
  shape: string;
  mods: StatMods;
  unlockLevel: number;
  cost: number;
  reward?: boolean;
}

export const PARTS: PartDef[] = [
  // Energy layers
  { id: 'ember-fang', slot: 'layer', name: 'Ember Fang', desc: 'Three sharp fangs. Hits hard, tires quickly.', color: '#ff5a36', shape: 'blade3', mods: { atk: 14, def: -4, sta: -6, wt: 36 }, unlockLevel: 1, cost: 0 },
  { id: 'iron-bulwark', slot: 'layer', name: 'Iron Bulwark', desc: 'Rounded plating that shrugs off impacts.', color: '#6f8bb5', shape: 'round', mods: { atk: -6, def: 14, wt: 42 }, unlockLevel: 2, cost: 900 },
  { id: 'storm-wing', slot: 'layer', name: 'Storm Wing', desc: 'Five swept wings. Fast and nimble.', color: '#35d0ff', shape: 'blade5', mods: { atk: 8, spd: 6, bal: 4, wt: 34 }, unlockLevel: 3, cost: 1200 },
  { id: 'gale-ring', slot: 'layer', name: 'Gale Ring', desc: 'Thin ring that loses almost no energy.', color: '#38e08c', shape: 'ring', mods: { atk: -8, sta: 14, bal: 4, wt: 32 }, unlockLevel: 3, cost: 1100 },
  { id: 'nova-halo', slot: 'layer', name: 'Nova Halo', desc: 'Well-rounded halo layer.', color: '#b57cff', shape: 'halo', mods: { atk: 5, def: 5, sta: 5, bal: 6, wt: 36 }, unlockLevel: 6, cost: 3000 },
  { id: 'twin-fury', slot: 'layer', name: 'Twin Fury', desc: 'Twin axe heads. Brutal but unstable.', color: '#ff9d2e', shape: 'twin', mods: { atk: 18, def: -8, bal: -6, wt: 38 }, unlockLevel: 8, cost: 4000 },
  { id: 'aegis-dome', slot: 'layer', name: 'Aegis Dome', desc: 'Heavy golden dome. Hard to burst.', color: '#ffd24a', shape: 'dome', mods: { atk: -4, def: 18, sta: 4, wt: 46, brs: 8 }, unlockLevel: 10, cost: 5000 },
  { id: 'phantom-claw', slot: 'layer', name: 'Phantom Claw', desc: 'Elite striker with hooked claws.', color: '#ff3d9a', shape: 'claw', mods: { atk: 20, spd: 8, def: -6, sta: -4, wt: 37 }, unlockLevel: 15, cost: 12000 },
  { id: 'titan-crown', slot: 'layer', name: 'Titan Crown', desc: 'Massive crowned fortress layer.', color: '#8cf0ff', shape: 'crown', mods: { def: 22, atk: 4, wt: 50, brs: 10 }, unlockLevel: 18, cost: 16000 },
  { id: 'world-sovereign', slot: 'layer', name: 'World Sovereign', desc: 'Champion-only layer. Master of all trades.', color: '#fff2b0', shape: 'sovereign', mods: { atk: 12, def: 12, sta: 12, bal: 10, wt: 44, brs: 8 }, unlockLevel: 1, cost: 0, reward: true },
  // Discs
  { id: 'standard-disc', slot: 'disc', name: 'Standard Disc', desc: 'Reliable all-round weight.', color: '#9aa7b8', shape: 'std', mods: { wt: 26 }, unlockLevel: 1, cost: 0 },
  { id: 'light-disc', slot: 'disc', name: 'Light Disc', desc: 'Low weight, high agility.', color: '#c6e7ff', shape: 'light', mods: { spd: 8, def: -4, wt: 18 }, unlockLevel: 2, cost: 600 },
  { id: 'heavy-disc', slot: 'disc', name: 'Heavy Disc', desc: 'Dense disc. Great impact resistance.', color: '#5c6678', shape: 'heavy', mods: { def: 8, atk: 4, spd: -6, wt: 36, brs: 6 }, unlockLevel: 4, cost: 1500 },
  { id: 'ring-disc', slot: 'disc', name: 'Ring Disc', desc: 'Outer-weighted for long spins.', color: '#7fd6c2', shape: 'ring', mods: { sta: 10, spd: -2, wt: 30 }, unlockLevel: 5, cost: 1800 },
  { id: 'spike-disc', slot: 'disc', name: 'Spike Disc', desc: 'Serrated edge increases hit power.', color: '#ff7a7a', shape: 'spike', mods: { atk: 10, bal: -2, wt: 28 }, unlockLevel: 7, cost: 2400 },
  { id: 'gravity-disc', slot: 'disc', name: 'Gravity Disc', desc: 'Ultra-dense core. Slow but immovable.', color: '#3b4152', shape: 'heavy', mods: { def: 12, spd: -10, bal: 4, wt: 44, brs: 10 }, unlockLevel: 12, cost: 5500 },
  { id: 'prism-disc', slot: 'disc', name: 'Prism Disc', desc: 'Perfectly balanced prism weight.', color: '#d9b8ff', shape: 'prism', mods: { atk: 4, def: 4, sta: 4, bal: 8, wt: 32 }, unlockLevel: 14, cost: 7000 },
  // Drivers
  { id: 'sharp-driver', slot: 'driver', name: 'Sharp Driver', desc: 'Balanced grip. Stable around the dish.', color: '#cfd6e0', shape: 'sharp', mods: { sta: 4, def: 2, bal: 2, wt: 6 }, unlockLevel: 1, cost: 0 },
  { id: 'flat-driver', slot: 'driver', name: 'Flat Driver', desc: 'Aggressive movement, burns stamina.', color: '#ffb199', shape: 'flat', mods: { atk: 8, spd: 10, sta: -8, wt: 5 }, unlockLevel: 1, cost: 0 },
  { id: 'ball-driver', slot: 'driver', name: 'Ball Driver', desc: 'Free-rolling. Great stamina, low impact.', color: '#a6f0ff', shape: 'ball', mods: { sta: 14, spd: 2, atk: -6, def: -4, wt: 6 }, unlockLevel: 3, cost: 1000 },
  { id: 'grip-driver', slot: 'driver', name: 'Grip Driver', desc: 'Rubber tip digs in and holds position.', color: '#8fa0ff', shape: 'grip', mods: { def: 10, spd: -8, bal: 6, wt: 8 }, unlockLevel: 6, cost: 2200 },
  { id: 'rush-driver', slot: 'driver', name: 'Rush Driver', desc: 'Blazing speed, drains fast.', color: '#ff6f3c', shape: 'flat', mods: { spd: 16, atk: 6, sta: -12, bal: -4, wt: 5 }, unlockLevel: 7, cost: 2600 },
  { id: 'needle-driver', slot: 'driver', name: 'Needle Driver', desc: 'Razor-thin tip. Spins forever, wobbles when hit.', color: '#e8fff6', shape: 'needle', mods: { sta: 18, atk: -10, bal: -4, wt: 4 }, unlockLevel: 9, cost: 3500 },
  { id: 'orbit-driver', slot: 'driver', name: 'Orbit Driver', desc: 'Gyro-stabilised tip for adaptive play.', color: '#ffe46e', shape: 'sharp', mods: { bal: 10, sta: 6, wt: 7 }, unlockLevel: 13, cost: 6000 },
  // Accessories
  { id: 'no-accessory', slot: 'accessory', name: 'No Accessory', desc: 'Nothing extra.', color: '#888888', shape: 'none', mods: {}, unlockLevel: 1, cost: 0 },
  { id: 'guard-bolt', slot: 'accessory', name: 'Guard Bolt', desc: 'Lock bolt: +burst resistance.', color: '#d6d9e0', shape: 'bolt', mods: { brs: 22, atk: -2, wt: 2 }, unlockLevel: 2, cost: 800 },
  { id: 'balance-chip', slot: 'accessory', name: 'Balance Chip', desc: 'Gyro chip improves balance.', color: '#7ee8ff', shape: 'chip', mods: { bal: 8, wt: 2 }, unlockLevel: 4, cost: 1300 },
  { id: 'spike-cap', slot: 'accessory', name: 'Spike Cap', desc: 'Pointed cap: power over safety.', color: '#ff5555', shape: 'crown', mods: { atk: 6, brs: -6, wt: 2 }, unlockLevel: 5, cost: 1600 },
  { id: 'stamina-core', slot: 'accessory', name: 'Stamina Core', desc: 'Energy-saving core crystal.', color: '#55ff9a', shape: 'chip', mods: { sta: 8, wt: 2 }, unlockLevel: 8, cost: 2800 },
  { id: 'ward-ring', slot: 'accessory', name: 'Ward Ring', desc: 'Shield ring for defence builds.', color: '#ffd24a', shape: 'ring', mods: { def: 8, brs: 12, wt: 3 }, unlockLevel: 11, cost: 4200 },
  { id: 'fury-crown', slot: 'accessory', name: 'Fury Crown', desc: 'Crown of spikes. Maximum aggression.', color: '#ff2b6a', shape: 'crown', mods: { atk: 10, sta: -4, bal: -2, wt: 3 }, unlockLevel: 16, cost: 8500 },
];

export const PART_MAP: Record<string, PartDef> = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const partsBySlot = (slot: PartSlot) => PARTS.filter((p) => p.slot === slot);
export const STARTER_PARTS = ['ember-fang', 'standard-disc', 'sharp-driver', 'flat-driver', 'no-accessory'];
export const STARTER_CONFIG = {
  name: 'Ember Striker',
  color: '#ff4d6d',
  layer: 'ember-fang',
  disc: 'standard-disc',
  driver: 'sharp-driver',
  accessory: 'no-accessory',
};
