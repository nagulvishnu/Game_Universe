// ============================================================================
// COLOSSUS: AGE OF TITANS — static game data (mechs, weapons, monsters, missions)
// ============================================================================
export type Stats = { armor: number; speed: number; power: number; energy: number; defense: number };
export const STAT_KEYS: (keyof Stats)[] = ['armor', 'speed', 'power', 'energy', 'defense'];

export interface WeaponDef {
  id: string; name: string; kind: 'melee' | 'ranged'; dmg: number; cd: number; cost: number; range: number;
  desc: string; unlock: number; color: string;
  speed?: number; aoe?: number; pellets?: number; spread?: number; homing?: boolean; pierce?: boolean;
  beam?: boolean; grav?: number; count?: number; size?: number; arc?: number;
}
const W = (w: WeaponDef) => w;
export const WEAPONS: Record<string, WeaponDef> = {
  sword: W({ id: 'sword', name: 'Giant Mechanical Sword', kind: 'melee', dmg: 120, cd: 0.5, cost: 0, range: 19, arc: 0.1, desc: 'Balanced 3-hit combo blade. Final strike emits a shock arc.', unlock: 1, color: '#7fe8ff' }),
  dualblade: W({ id: 'dualblade', name: 'Dual Energy Blades', kind: 'melee', dmg: 74, cd: 0.3, cost: 0, range: 15, arc: 0.0, desc: 'Lightning-fast twin blades. Highest combo speed.', unlock: 2, color: '#ffd84a' }),
  hammer: W({ id: 'hammer', name: 'Heavy Gravity Hammer', kind: 'melee', dmg: 210, cd: 0.95, cost: 0, range: 17, arc: 0.0, desc: 'Slow, devastating smashes with ground impact waves.', unlock: 3, color: '#ff9a3c' }),
  axe: W({ id: 'axe', name: 'Mechanical War Axe', kind: 'melee', dmg: 150, cd: 0.68, cost: 0, range: 16, arc: -0.2, desc: 'Wide cleaving arcs that hit multiple targets.', unlock: 4, color: '#ff6b6b' }),
  spear: W({ id: 'spear', name: 'Energy Spear', kind: 'melee', dmg: 130, cd: 0.55, cost: 0, range: 26, arc: 0.55, desc: 'Long-reach piercing thrusts.', unlock: 5, color: '#9dff7a' }),
  plasmafist: W({ id: 'plasmafist', name: 'Plasma Fist', kind: 'melee', dmg: 165, cd: 0.5, cost: 0, range: 14, arc: 0.15, desc: 'Piston-driven punches wrapped in plasma.', unlock: 7, color: '#ff5fd2' }),
  chainblade: W({ id: 'chainblade', name: 'Chain Blade', kind: 'melee', dmg: 100, cd: 0.42, cost: 0, range: 23, arc: 0.1, desc: 'Whip-like segmented blade with extended range.', unlock: 6, color: '#c8d3ff' }),
  machinegun: W({ id: 'machinegun', name: 'Heavy Machine Guns', kind: 'ranged', dmg: 24, cd: 0.075, cost: 1.1, range: 160, speed: 150, spread: 0.035, desc: 'Sustained high-rate autocannon fire.', unlock: 1, color: '#ffe27a', size: 0.45 }),
  rocket: W({ id: 'rocket', name: 'Rocket Launcher', kind: 'ranged', dmg: 150, cd: 0.8, cost: 9, range: 180, speed: 80, aoe: 10, desc: 'Explosive rockets with splash damage.', unlock: 1, color: '#ff8a3a', size: 0.9 }),
  homing: W({ id: 'homing', name: 'Homing Missile System', kind: 'ranged', dmg: 85, cd: 1.15, cost: 15, range: 200, speed: 62, aoe: 6, count: 4, homing: true, desc: 'Salvo of 4 self-guided missiles.', unlock: 4, color: '#ff6a6a', size: 0.7 }),
  plasma: W({ id: 'plasma', name: 'Plasma Cannon', kind: 'ranged', dmg: 100, cd: 0.4, cost: 7, range: 170, speed: 115, aoe: 6, desc: 'Superheated plasma bolts with a small blast.', unlock: 1, color: '#6fe9ff', size: 1.0 }),
  railgun: W({ id: 'railgun', name: 'Railgun', kind: 'ranged', dmg: 400, cd: 1.5, cost: 20, range: 260, pierce: true, desc: 'Instant piercing slug. Ideal for weak points.', unlock: 3, color: '#b9a6ff' }),
  laser: W({ id: 'laser', name: 'Laser Beam', kind: 'ranged', dmg: 15, cd: 0.05, cost: 0.9, range: 130, beam: true, desc: 'Continuous cutting beam. Hold to fire.', unlock: 5, color: '#ff4d6d' }),
  artillery: W({ id: 'artillery', name: 'Heavy Artillery Cannon', kind: 'ranged', dmg: 320, cd: 1.8, cost: 22, range: 220, speed: 85, aoe: 16, grav: 28, desc: 'Lobbed shells with a massive blast radius.', unlock: 6, color: '#ffb347', size: 1.3 }),
  shotgun: W({ id: 'shotgun', name: 'Energy Shotgun', kind: 'ranged', dmg: 30, cd: 0.7, cost: 9, range: 70, speed: 120, pellets: 9, spread: 0.13, desc: 'Close-range scatter blast of energy.', unlock: 2, color: '#a0ff9a', size: 0.5 }),
};

export interface Look { tw: number; th: number; leg: number; sh: number; head: string; extras: string[] }
export interface MechDef {
  id: string; name: string; role: string; desc: string; scale: number;
  primary: string; accent: string; glow: string; stats: Stats; look: Look;
  loadout: [string, string, string];
  special: { id: string; name: string; cd: number; cost: number; desc: string };
  ultimate: { id: string; name: string; desc: string };
  transform: { name: string; dur: number; cd: number; dmg: number; spd: number; def: number; fly?: boolean; siege?: boolean; aura?: string; cloak?: boolean; desc: string };
  unlockAfter: number; price: number;
}
export const MECHS: MechDef[] = [
  { id: 'aegis', name: 'AEGIS PRIME', role: 'Frontline Balanced', scale: 1, primary: '#dfe6f2', accent: '#2f6bff', glow: '#59d7ff',
    desc: 'The standard-bearer of the Titan War. Balanced armor, sword and energy cannon make it ready for anything.',
    stats: { armor: 6, speed: 6, power: 6, energy: 6, defense: 6 }, look: { tw: 1, th: 1, leg: 1, sh: 1, head: 'crest', extras: ['cannon'] },
    loadout: ['sword', 'plasma', 'rocket'],
    special: { id: 'blast', name: 'Charged Energy Blast', cd: 9, cost: 30, desc: 'Charges and fires a huge plasma sphere.' },
    ultimate: { id: 'sunder', name: 'Aegis Judgment', desc: 'A colossal energy slash cleaves everything ahead.' },
    transform: { name: 'Overdrive Protocol', dur: 16, cd: 28, dmg: 1.35, spd: 1.15, def: 1.1, aura: 'none', desc: 'Armor glows white-hot. +35% damage, +15% speed.' }, unlockAfter: 0, price: 0 },
  { id: 'fang', name: 'THUNDER FANG', role: 'Fast Assault', scale: 0.95, primary: '#ffd23f', accent: '#1b1f2a', glow: '#fff36b',
    desc: 'A lean predator frame with twin energy blades and capacitors that arc lightning across the battlefield.',
    stats: { armor: 4, speed: 9, power: 6, energy: 6, defense: 4 }, look: { tw: 0.85, th: 0.95, leg: 0.85, sh: 0.9, head: 'horn', extras: ['blades', 'pylons'] },
    loadout: ['dualblade', 'shotgun', 'machinegun'],
    special: { id: 'dash', name: 'Lightning Dash', cd: 6, cost: 22, desc: 'Teleport-speed dash that slashes everything in your path.' },
    ultimate: { id: 'thunder', name: 'Tempest Judgment', desc: 'Calls down lightning on every enemy.' },
    transform: { name: 'Storm Mode', dur: 15, cd: 26, dmg: 1.25, spd: 1.35, def: 1, aura: 'shock', desc: 'Crackling aura shocks nearby enemies. +35% speed.' }, unlockAfter: 1, price: 2500 },
  { id: 'iron', name: 'IRON TITAN', role: 'Heavy Bruiser', scale: 1.28, primary: '#8a8f99', accent: '#e8431f', glow: '#ff8a3d',
    desc: 'A walking fortress. Massive plating and piston fists that flatten anything that comes close.',
    stats: { armor: 10, speed: 3, power: 9, energy: 5, defense: 9 }, look: { tw: 1.35, th: 1.15, leg: 1.4, sh: 1.5, head: 'dome', extras: ['bulk'] },
    loadout: ['plasmafist', 'artillery', 'rocket'],
    special: { id: 'smash', name: 'Ground Smash', cd: 8, cost: 28, desc: 'Slams the ground, cracking roads and staggering foes.' },
    ultimate: { id: 'quake', name: 'Titanfall Quake', desc: 'Three cascading seismic slams.' },
    transform: { name: 'Juggernaut Mode', dur: 16, cd: 30, dmg: 1.3, spd: 0.95, def: 1.7, aura: 'none', desc: 'Plating locks down: +70% defense, +30% damage.' }, unlockAfter: 2, price: 3500 },
  { id: 'phantom', name: 'PHANTOM ZERO', role: 'Stealth Assassin', scale: 0.9, primary: '#2a2438', accent: '#b04bff', glow: '#d27bff',
    desc: 'A razor-thin stealth frame that blinks across the battlefield and strikes weak points with dual blades.',
    stats: { armor: 3, speed: 10, power: 7, energy: 7, defense: 3 }, look: { tw: 0.75, th: 0.9, leg: 0.75, sh: 0.8, head: 'hood', extras: ['cape'] },
    loadout: ['dualblade', 'railgun', 'shotgun'],
    special: { id: 'teleport', name: 'Phase Strike', cd: 5, cost: 20, desc: 'Teleport behind the target and land a guaranteed critical.' },
    ultimate: { id: 'phantom', name: 'Eclipse Dance', desc: 'Flash between enemies in a blinding blade storm.' },
    transform: { name: 'Shadow Mode', dur: 14, cd: 24, dmg: 1.4, spd: 1.25, def: 1, cloak: true, aura: 'none', desc: 'Cloaked: +40% damage.' }, unlockAfter: 3, price: 4500 },
  { id: 'bastion', name: 'BASTION X', role: 'Defender / Artillery', scale: 1.15, primary: '#5a7a58', accent: '#f0c14b', glow: '#8bffb0',
    desc: 'Tower shield, heavy cannon and deployable barriers. Switches into siege artillery configuration.',
    stats: { armor: 9, speed: 4, power: 7, energy: 7, defense: 10 }, look: { tw: 1.2, th: 1.05, leg: 1.2, sh: 1.25, head: 'visor', extras: ['shield', 'cannon'] },
    loadout: ['axe', 'artillery', 'machinegun'],
    special: { id: 'shield', name: 'Aegis Barrier', cd: 12, cost: 25, desc: 'Deploys a barrier that absorbs 700 damage.' },
    ultimate: { id: 'fortress', name: 'Judgment Cannon', desc: 'Raises a barrier and fires a devastating beam.' },
    transform: { name: 'Siege Artillery Mode', dur: 18, cd: 30, dmg: 2.0, spd: 0.3, def: 1.6, siege: true, aura: 'none', desc: 'Cannons deploy. Nearly immobile, double damage.' }, unlockAfter: 4, price: 5000 },
  { id: 'inferno', name: 'INFERNO CORE', role: 'Fire Specialist', scale: 1.1, primary: '#c23a1e', accent: '#2a2a2e', glow: '#ff9a2e',
    desc: 'Reactor-fed flamethrowers and explosive munitions. Everything near it burns.',
    stats: { armor: 6, speed: 5, power: 9, energy: 7, defense: 5 }, look: { tw: 1.1, th: 1.1, leg: 1.1, sh: 1.2, head: 'horn', extras: ['tanks'] },
    loadout: ['axe', 'rocket', 'shotgun'],
    special: { id: 'flame', name: 'Inferno Wave', cd: 8, cost: 28, desc: 'Sweeping flamethrower burst that ignites targets.' },
    ultimate: { id: 'inferno', name: 'Solar Cataclysm', desc: 'Fire pillars erupt across the battlefield.' },
    transform: { name: 'Meltdown Mode', dur: 15, cd: 28, dmg: 1.5, spd: 1.0, def: 0.9, aura: 'burn', desc: 'Burning aura scorches nearby enemies. +50% damage.' }, unlockAfter: 5, price: 6000 },
  { id: 'frost', name: 'FROST GUARDIAN', role: 'Control / Ice', scale: 1.05, primary: '#b8e6ff', accent: '#2a5fa8', glow: '#9ff4ff',
    desc: 'Cryo-lances and freezing projectiles lock down the fastest predators.',
    stats: { armor: 7, speed: 6, power: 6, energy: 8, defense: 7 }, look: { tw: 1, th: 1, leg: 1, sh: 1.1, head: 'crown', extras: ['spikes'] },
    loadout: ['spear', 'plasma', 'railgun'],
    special: { id: 'freeze', name: 'Cryo Nova', cd: 9, cost: 26, desc: 'Freezes and damages all enemies nearby.' },
    ultimate: { id: 'blizzard', name: 'Absolute Zero', desc: 'Freezes the entire battlefield, then shatters it.' },
    transform: { name: 'Glacial Aura', dur: 16, cd: 28, dmg: 1.2, spd: 1.1, def: 1.3, aura: 'frost', desc: 'Frost aura slows all nearby enemies.' }, unlockAfter: 6, price: 6500 },
  { id: 'storm', name: 'STORM BREAKER', role: 'Railgun / Lightning', scale: 1.05, primary: '#3b4a6b', accent: '#46b6ff', glow: '#7ad0ff',
    desc: 'A sniper-class frame with twin rail pylons that discharge lightning on impact.',
    stats: { armor: 5, speed: 6, power: 9, energy: 9, defense: 5 }, look: { tw: 0.95, th: 1.05, leg: 0.95, sh: 1, head: 'visor', extras: ['pylons', 'cannon'] },
    loadout: ['chainblade', 'railgun', 'laser'],
    special: { id: 'chain', name: 'Arc Storm', cd: 7, cost: 24, desc: 'Chain lightning leaps between up to 6 enemies.' },
    ultimate: { id: 'railstorm', name: 'Orbital Railstorm', desc: 'Orbital rail beams rain onto the enemy.' },
    transform: { name: 'Overcharge Mode', dur: 15, cd: 26, dmg: 1.4, spd: 1.1, def: 1, aura: 'shock', desc: 'Capacitors maxed. +40% damage, shocking aura.' }, unlockAfter: 7, price: 7500 },
  { id: 'sky', name: 'SKY REAPER', role: 'Aerial Striker', scale: 1.0, primary: '#e9eef7', accent: '#ff4d6a', glow: '#ff7a90',
    desc: 'Transforms into flight mode to rain missiles from above, then dives into the enemy.',
    stats: { armor: 4, speed: 9, power: 7, energy: 8, defense: 4 }, look: { tw: 0.9, th: 0.95, leg: 0.85, sh: 0.9, head: 'crest', extras: ['wings'] },
    loadout: ['spear', 'homing', 'machinegun'],
    special: { id: 'dive', name: 'Reaper Dive', cd: 8, cost: 24, desc: 'Launch skyward and slam down on your target.' },
    ultimate: { id: 'skyfall', name: 'Skyfall Barrage', desc: '24 missiles rain from above.' },
    transform: { name: 'Flight Mode', dur: 22, cd: 24, dmg: 1.15, spd: 1.35, def: 1, fly: true, aura: 'none', desc: 'Wings deploy: hold SPACE to ascend, free flight.' }, unlockAfter: 8, price: 8500 },
  { id: 'omega', name: 'OMEGA COLOSSUS', role: 'Ultimate Endgame', scale: 1.3, primary: '#f5f1e6', accent: '#c9902a', glow: '#ffd36b',
    desc: 'Ancient-future relic of the first war. Transforms into its true radiant form.',
    stats: { armor: 10, speed: 7, power: 10, energy: 10, defense: 8 }, look: { tw: 1.2, th: 1.2, leg: 1.2, sh: 1.35, head: 'crown', extras: ['halo', 'cannon', 'bulk'] },
    loadout: ['sword', 'laser', 'artillery'],
    special: { id: 'shockwave', name: 'Omega Shockwave', cd: 7, cost: 30, desc: 'Omni-directional shockwave that repels everything.' },
    ultimate: { id: 'omega', name: 'Genesis Annihilator', desc: 'A sweeping reality-erasing beam.' },
    transform: { name: 'Omega Transformation', dur: 20, cd: 32, dmg: 1.8, spd: 1.2, def: 1.4, aura: 'burn', desc: 'True form: +80% damage, double energy regen.' }, unlockAfter: 10, price: 15000 },
];
export const MECH_BY_ID: Record<string, MechDef> = Object.fromEntries(MECHS.map(m => [m.id, m]));

export const SKINS: { id: string; name: string; unlock: number; p?: string; a?: string; g?: string }[] = [
  { id: 'factory', name: 'Factory', unlock: 1 }, { id: 'crimson', name: 'Crimson Guard', unlock: 3, p: '#a3182b', a: '#1c1c22', g: '#ff5468' },
  { id: 'arctic', name: 'Arctic Ops', unlock: 5, p: '#e8f1f8', a: '#48627a', g: '#7ee8ff' }, { id: 'jade', name: 'Jade Legion', unlock: 7, p: '#1f6b4f', a: '#d8c070', g: '#6effb4' },
  { id: 'void', name: 'Void Walker', unlock: 9, p: '#15131f', a: '#6a2bd9', g: '#c27bff' }, { id: 'gold', name: 'Golden Titan', unlock: 12, p: '#e0b03a', a: '#3a2a10', g: '#fff0a0' },
];
export const FX_COLORS = ['#59d7ff', '#ff7a2e', '#7dff8a', '#ff5fd2', '#fff36b', '#b08bff', '#ff4d4d', '#ffffff'];
export const PAINTS = ['#dfe6f2', '#ffd23f', '#8a8f99', '#2a2438', '#5a7a58', '#c23a1e', '#b8e6ff', '#3b4a6b', '#e9eef7', '#f5f1e6', '#a3182b', '#1f6b4f', '#e0b03a', '#15131f'];

export const UPGRADES = [
  { id: 'armor', name: 'Armor Plating', desc: '+8% hull and armor pool per level', icon: '🛡' },
  { id: 'core', name: 'Core Energy', desc: '+10% max energy & regen per level', icon: '⚡' },
  { id: 'speed', name: 'Servo Mobility', desc: '+4% move speed per level', icon: '🦿' },
  { id: 'ability', name: 'Special Systems', desc: '+10% ability power, -4% cooldown per level', icon: '✦' },
  { id: 'weapon', name: 'Weapon Output', desc: '+6% weapon damage per level', icon: '💥' },
];
export const MAX_UPGRADE = 8;
export const upgradeCost = (lvl: number) => 400 + lvl * 450;

export const DIFFICULTIES = [
  { id: 0, name: 'NORMAL', hp: 1, dmg: 1, reward: 1 }, { id: 1, name: 'HARD', hp: 1.5, dmg: 1.3, reward: 1.6 }, { id: 2, name: 'NIGHTMARE', hp: 2.2, dmg: 1.7, reward: 2.4 },
];
export const xpForLevel = (l: number) => Math.floor(250 * Math.pow(l, 1.5));
export const levelFromXp = (xp: number) => { let l = 1; while (xp >= xpForLevel(l)) { xp -= xpForLevel(l); l++; } return { level: l, into: xp, need: xpForLevel(l) }; };

// ---------------------------------------------------------------- Monsters
export interface Atk { t: string; r: [number, number]; dmg: number; w: number; cd: number; rad?: number; n?: number; fx?: string; dur?: number; rec?: number; name?: string }
export interface MonDef {
  id: string; name: string; cat: string; threat: number; hp: number; speed: number; radius: number; scale: number;
  shape: string; ai: string; hold: number; alt?: number; c1: string; c2: string; glow: string; weak: [number, number, number, number];
  attacks: Atk[]; voice: [number, number, number]; death: string; xp: number; desc: string; weakness: string;
  boss?: boolean; title?: string; sub?: string; theme?: string; phases?: { at: number; atks: number[]; spd: number }[]; env?: { fx: string; every: number }; heads?: number; hitY: number;
}
const A = (t: string, r0: number, r1: number, dmg: number, w: number, cd: number, x: Partial<Atk> = {}): Atk => ({ t, r: [r0, r1], dmg, w, cd, ...x });
const M = (d: Partial<MonDef> & Pick<MonDef, 'id' | 'name' | 'cat' | 'shape' | 'hp' | 'speed' | 'radius' | 'scale' | 'c1' | 'c2' | 'glow' | 'attacks' | 'voice' | 'death' | 'desc' | 'weakness'>): MonDef =>
  ({ threat: 1, ai: 'walk', hold: 14, weak: [0, 5, 3, 3], xp: 100, hitY: d.radius * 0.6, ...d } as MonDef);

export const MONSTER_LIST: MonDef[] = [
  M({ id: 'ironhide', name: 'Ironhide Crusher', cat: 'Armored Ground Beast', shape: 'quad', hp: 1700, speed: 9, radius: 7, scale: 1, c1: '#6d5b4d', c2: '#9a8b78', glow: '#ff6a3a', threat: 2, xp: 140, hold: 12, weak: [0, 4.2, -4, 3.2],
    attacks: [A('melee', 0, 15, 70, 0.8, 1.2), A('charge', 28, 70, 95, 1.1, 5, { dur: 1.1 })], voice: [90, 1.1, 0.7], death: 'collapse',
    desc: 'Plated quadruped that bulldozes defenses. Its heavy hide shrugs off small arms.', weakness: 'Unarmored spine node on its rear back.' }),
  M({ id: 'boulderback', name: 'Boulderback', cat: 'Armored Ground Beast', shape: 'quad', hp: 2500, speed: 7, radius: 8.5, scale: 1.2, c1: '#5b5f66', c2: '#8a8f99', glow: '#ffb03a', threat: 3, xp: 220, hold: 14, weak: [0, 4.5, 4.5, 3.4],
    attacks: [A('slam', 0, 22, 100, 1.0, 2.2, { rad: 15 }), A('charge', 30, 70, 110, 1.3, 6, { dur: 1.2 }), A('pulse', 0, 24, 60, 0.8, 7, { rad: 24, name: 'Rockburst' })], voice: [70, 1.3, 0.8], death: 'explode',
    desc: 'A mountain on legs. Rocky shell hides a glowing magma gland.', weakness: 'Glowing magma gland beneath the throat.' }),
  M({ id: 'razor', name: 'Razor Stalker', cat: 'Fast Predator', shape: 'raptor', ai: 'circle', hp: 750, speed: 21, radius: 4.6, scale: 0.8, c1: '#3e6b4a', c2: '#c9d36a', glow: '#ff3d3d', threat: 1, xp: 80, hold: 10, weak: [0, 4.2, 1.5, 2.2],
    attacks: [A('melee', 0, 11, 55, 0.45, 0.9), A('leap', 20, 50, 70, 0.6, 4, { rad: 9 })], voice: [260, 0.6, 0.9], death: 'collapse',
    desc: 'Pack hunter that circles prey and strikes from every angle.', weakness: 'Exposed neck while leaping.' }),
  M({ id: 'nightfang', name: 'Night Fang', cat: 'Fast Predator', shape: 'wolf', ai: 'circle', hp: 650, speed: 25, radius: 4.4, scale: 0.85, c1: '#262a3d', c2: '#4b5aa8', glow: '#6aa8ff', threat: 1, xp: 85, hold: 9, weak: [0, 3.5, 3.4, 2.2],
    attacks: [A('melee', 0, 11, 50, 0.4, 0.8), A('leap', 20, 55, 75, 0.55, 3.5, { rad: 9 })], voice: [200, 0.7, 1.0], death: 'dissolve',
    desc: 'Shadow-colored beast that darts through ruins with terrifying speed.', weakness: 'Glowing eye cluster.' }),
  M({ id: 'drakoth', name: 'Drakoth', cat: 'Giant Reptilian', shape: 'rex', hp: 2700, speed: 10, radius: 8.5, scale: 1.15, c1: '#7a3028', c2: '#d9a066', glow: '#ff7a1a', threat: 3, xp: 260, hold: 18, weak: [0, 8, 4, 3],
    attacks: [A('melee', 0, 18, 85, 0.8, 1.6), A('sweep', 0, 24, 90, 0.9, 3, { rad: 22, name: 'Tail Sweep' }), A('breath', 18, 55, 90, 1.0, 6, { dur: 1.8, fx: 'fire' })], voice: [75, 1.5, 0.8], death: 'collapse',
    desc: 'Classic fire-breathing reptilian titan with a bone-crushing tail.', weakness: 'Fire sac glowing in its chest.' }),
  M({ id: 'basilisk', name: 'Venom Basilisk', cat: 'Giant Reptilian', shape: 'serpent', hp: 1900, speed: 11, radius: 7, scale: 1, c1: '#3d7a3a', c2: '#c8e05a', glow: '#8aff3a', threat: 2, xp: 170, hold: 28, ai: 'range', weak: [0, 4.5, 8, 2.6],
    attacks: [A('spit', 15, 70, 55, 0.7, 2.2, { n: 3, fx: 'acid', rad: 6 }), A('melee', 0, 15, 80, 0.7, 1.5)], voice: [120, 1.2, 1.0], death: 'melt',
    desc: 'Serpentine reptile that spits corrosive venom from afar.', weakness: 'Venom gland beneath its jaw.' }),
  M({ id: 'galewyvern', name: 'Gale Wyvern', cat: 'Flying Winged', shape: 'flyer', ai: 'fly', alt: 24, hp: 1200, speed: 19, radius: 6.5, scale: 0.9, c1: '#4b6a8a', c2: '#d6e4f2', glow: '#9ae6ff', threat: 2, xp: 150, hold: 45, weak: [0, 0.5, 2.5, 2.5],
    attacks: [A('dive', 20, 90, 95, 1.0, 4.5, { rad: 12 }), A('volley', 20, 90, 35, 0.6, 3, { n: 5, fx: 'wind' })], voice: [320, 0.9, 0.8], death: 'spiral',
    desc: 'Agile wyvern that harasses from the sky then dives in for the kill.', weakness: 'Belly while grounded after a dive.' }),
  M({ id: 'tempestroc', name: 'Tempest Roc', cat: 'Flying Winged', shape: 'flyer', ai: 'fly', alt: 30, hp: 1600, speed: 16, radius: 8, scale: 1.1, c1: '#5a4f8a', c2: '#f0e9ff', glow: '#fff36b', threat: 3, xp: 220, hold: 55, weak: [0, 0.5, 3, 2.8],
    attacks: [A('pulse', 0, 50, 60, 0.9, 6, { rad: 36, name: 'Gale Burst' }), A('bolts', 10, 90, 100, 1.0, 5, { n: 4, rad: 9, fx: 'lightning' })], voice: [250, 1.0, 0.9], death: 'spiral',
    desc: 'Storm-riding giant bird that summons lightning with every wingbeat.', weakness: 'Storm crystal at the breastbone.' }),
  M({ id: 'reefcrusher', name: 'Reef Crusher', cat: 'Aquatic Ocean Monster', shape: 'crab', hp: 2300, speed: 8, radius: 8, scale: 1.1, c1: '#a8452e', c2: '#e8b48a', glow: '#4ad0ff', threat: 2, xp: 200, hold: 14, weak: [0, 5.5, -2, 3],
    attacks: [A('slam', 0, 22, 100, 0.9, 2.2, { rad: 14, name: 'Claw Smash' }), A('spit', 18, 60, 50, 0.8, 4, { n: 3, fx: 'water', rad: 7 })], voice: [100, 1.0, 0.9], death: 'explode',
    desc: 'Crustacean colossus with shell hardened by the deep trenches.', weakness: 'Soft tissue under the shell hump.' }),
  M({ id: 'abysseel', name: 'Abyss Eel', cat: 'Aquatic Ocean Monster', shape: 'serpent', ai: 'circle', hp: 1500, speed: 15, radius: 6, scale: 0.9, c1: '#2a4a6b', c2: '#7ad0ff', glow: '#7ae9ff', threat: 2, xp: 160, hold: 16, weak: [0, 4, 7, 2.4],
    attacks: [A('melee', 0, 15, 70, 0.55, 1.1), A('wave', 0, 60, 70, 0.9, 6, { fx: 'water' })], voice: [160, 1.1, 1.2], death: 'melt',
    desc: 'Electric eel that surges across the shoreline.', weakness: 'Electric organ behind the head.' }),
  M({ id: 'krakenspawn', name: 'Kraken Spawn', cat: 'Aquatic Ocean Monster', shape: 'kraken', hp: 2100, speed: 7, radius: 8, scale: 1.1, c1: '#5b2f6b', c2: '#d98ae0', glow: '#ff6af0', threat: 3, xp: 230, hold: 16, weak: [0, 7, 0, 3],
    attacks: [A('sweep', 0, 26, 85, 0.9, 2.4, { rad: 26 }), A('slam', 5, 24, 95, 1.0, 3, { rad: 13 }), A('spit', 20, 60, 40, 0.8, 4, { n: 4, fx: 'ink', rad: 6 })], voice: [85, 1.4, 1.3], death: 'melt',
    desc: 'Tentacled offspring of the abyssal mother. It grabs and crushes.', weakness: 'Central eye above the mantle.' }),
  M({ id: 'dunewyrm', name: 'Dune Wyrm', cat: 'Burrowing Underground', shape: 'serpent', hp: 2400, speed: 12, radius: 8, scale: 1.2, c1: '#a8844a', c2: '#e8d08a', glow: '#ffcc55', threat: 3, xp: 240, hold: 14, weak: [0, 5, 8, 3],
    attacks: [A('burrow', 22, 90, 120, 0.8, 6, { dur: 2.2, rad: 15 }), A('melee', 0, 17, 85, 0.7, 1.5)], voice: [65, 1.6, 1.0], death: 'sink',
    desc: 'Sand-swimming leviathan that erupts beneath its prey.', weakness: 'Soft maw while it surfaces.' }),
  M({ id: 'moleterror', name: 'Mole Terror', cat: 'Burrowing Underground', shape: 'quad', hp: 1500, speed: 14, radius: 6.5, scale: 0.95, c1: '#4d3a30', c2: '#d8a07a', glow: '#ff9a4a', threat: 2, xp: 150, hold: 12, weak: [0, 3.5, 5, 2.6],
    attacks: [A('burrow', 18, 80, 110, 0.7, 5, { dur: 1.8, rad: 13 }), A('charge', 20, 55, 85, 0.9, 5, { dur: 0.9 })], voice: [140, 0.9, 1.1], death: 'sink',
    desc: 'Digs beneath cities, collapsing streets in its wake.', weakness: 'Pink snout.' }),
  M({ id: 'plasmawraith', name: 'Plasma Wraith', cat: 'Energy Creature', shape: 'orb', ai: 'float', alt: 12, hp: 950, speed: 15, radius: 5.5, scale: 0.9, c1: '#2a3a8a', c2: '#7a9aff', glow: '#6ad0ff', threat: 2, xp: 140, hold: 40, weak: [0, 0, 0, 3],
    attacks: [A('volley', 15, 90, 38, 0.7, 2.4, { n: 7, fx: 'plasma' }), A('pulse', 0, 30, 65, 0.9, 6, { rad: 26 })], voice: [380, 0.9, 0.5], death: 'dissolve',
    desc: 'A sentient knot of plasma that fires energy needles.', weakness: 'Its unshielded core — always exposed.' }),
  M({ id: 'voltjelly', name: 'Volt Jelly', cat: 'Energy Creature', shape: 'jelly', ai: 'float', alt: 14, hp: 1150, speed: 9, radius: 6, scale: 1, c1: '#7a3aaa', c2: '#e08aff', glow: '#d06aff', threat: 2, xp: 150, hold: 35, weak: [0, 1, 0, 3],
    attacks: [A('bolts', 5, 80, 95, 1.0, 4.5, { n: 5, rad: 9, fx: 'lightning' }), A('pulse', 0, 28, 60, 0.8, 5, { rad: 25 })], voice: [300, 1.0, 0.4], death: 'dissolve',
    desc: 'A drifting storm in a jelly body, trailing lightning.', weakness: 'Central nucleus.' }),
  M({ id: 'solarflare', name: 'Solar Elemental', cat: 'Energy Creature', shape: 'orb', ai: 'float', alt: 16, hp: 1800, speed: 11, radius: 7.5, scale: 1.3, c1: '#aa4a1a', c2: '#ffc06a', glow: '#ffd040', threat: 3, xp: 240, hold: 45, weak: [0, 0, 0, 3.6],
    attacks: [A('beam', 20, 100, 110, 1.3, 7, { dur: 2.0, fx: 'plasma' }), A('volley', 10, 90, 40, 0.7, 3, { n: 12, fx: 'ring' })], voice: [220, 1.2, 0.5], death: 'dissolve',
    desc: 'A star-fragment given hunger. Its beam melts armor in seconds.', weakness: 'Dark core during beam recharge.' }),
  M({ id: 'cerberon', name: 'Cerberon', cat: 'Multi-Headed Monster', shape: 'multi', heads: 3, hp: 3100, speed: 11, radius: 9, scale: 1.25, c1: '#55272f', c2: '#d86a4a', glow: '#ff4a2a', threat: 4, xp: 340, hold: 16, weak: [0, 6.5, -3, 3.2],
    attacks: [A('melee', 0, 18, 90, 0.7, 1.4), A('leap', 25, 60, 100, 0.8, 5, { rad: 14 }), A('breath', 15, 50, 85, 1.0, 6, { dur: 1.6, fx: 'fire' })], voice: [80, 1.3, 1.2], death: 'explode',
    desc: 'Three-headed hound of the deep rift. One head always watches.', weakness: 'Ember heart between the shoulders.' }),
  M({ id: 'dihydra', name: 'Twin Hydra', cat: 'Multi-Headed Monster', shape: 'multi', heads: 2, ai: 'range', hp: 2700, speed: 9, radius: 8.5, scale: 1.15, c1: '#2a6a6b', c2: '#9ae0d0', glow: '#6affea', threat: 3, xp: 280, hold: 30, weak: [0, 6, -3, 3],
    attacks: [A('spit', 15, 70, 50, 0.8, 2.5, { n: 4, fx: 'acid', rad: 6 }), A('breath', 15, 50, 80, 1.0, 6, { dur: 1.6, fx: 'ice' }), A('melee', 0, 17, 85, 0.7, 1.5)], voice: [95, 1.3, 1.4], death: 'melt',
    desc: 'Two serpent heads that cooperate in deadly crossfire.', weakness: 'Fused root where the necks meet.' }),
  M({ id: 'siegecrawler', name: 'Bio-Siege Walker', cat: 'Mutated Mechanical-Organic', shape: 'spider', ai: 'range', hp: 2900, speed: 9, radius: 9, scale: 1.2, c1: '#4a4f5a', c2: '#c85a5a', glow: '#ff4a6a', threat: 3, xp: 300, hold: 38, weak: [0, 7.5, 0, 3],
    attacks: [A('volley', 20, 100, 40, 0.8, 3.2, { n: 10, fx: 'plasma' }), A('spit', 20, 80, 70, 0.9, 4, { n: 2, fx: 'fire', rad: 10 }), A('slam', 0, 22, 100, 0.9, 3, { rad: 15 })], voice: [110, 1.0, 1.5], death: 'explode',
    desc: 'Corrupted war machine fused with kaiju flesh. Fires from standoff range.', weakness: 'Exposed biological reactor on its dorsal side.' }),
  M({ id: 'cybermantis', name: 'Cyber Mantis', cat: 'Mutated Mechanical-Organic', shape: 'mantis', ai: 'circle', hp: 1900, speed: 19, radius: 6.5, scale: 1, c1: '#3a5a3a', c2: '#a0b0c0', glow: '#ff3a3a', threat: 3, xp: 230, hold: 12, weak: [0, 7, 1, 2.6],
    attacks: [A('melee', 0, 16, 75, 0.5, 0.9, { name: 'Scythe' }), A('leap', 20, 60, 95, 0.6, 4, { rad: 11 }), A('sweep', 0, 20, 85, 0.7, 3, { rad: 18 })], voice: [210, 0.8, 1.4], death: 'explode',
    desc: 'Cybernetic predator with monomolecular scythes.', weakness: 'Optic sensor in the head.' }),
  M({ id: 'elder', name: 'Elder Golem', cat: 'Ancient Legendary Titan', shape: 'golem', hp: 4300, speed: 6, radius: 11, scale: 1.5, c1: '#6a665c', c2: '#a89a78', glow: '#7affc8', threat: 4, xp: 450, hold: 18, weak: [0, 12, 3, 3.6],
    attacks: [A('slam', 0, 26, 130, 1.2, 2.6, { rad: 20 }), A('wave', 0, 90, 90, 1.2, 7), A('pulse', 0, 30, 80, 1.0, 8, { rad: 30, name: 'Rune Burst' })], voice: [50, 1.8, 0.6], death: 'collapse',
    desc: 'A titan of living stone from before recorded history.', weakness: 'The ancient rune stone in its chest.' }),
  M({ id: 'primeval', name: 'The Primeval', cat: 'Ancient Legendary Titan', shape: 'rex', hp: 5200, speed: 9, radius: 11.5, scale: 1.55, c1: '#2f3a4a', c2: '#8aa0c0', glow: '#a07aff', threat: 5, xp: 600, hold: 20, weak: [0, 10, 5, 3.6],
    attacks: [A('melee', 0, 22, 110, 0.8, 1.6), A('sweep', 0, 28, 110, 0.9, 3, { rad: 27 }), A('beam', 25, 110, 120, 1.3, 7, { dur: 2.0, fx: 'void' }), A('wave', 0, 90, 90, 1.1, 8)], voice: [45, 2.0, 0.8], death: 'explode',
    desc: 'First of the titans. Legends claim it shaped the continents.', weakness: 'Amethyst heart-crystal in its throat.' }),
  M({ id: 'riftspawn', name: 'Rift Spawn', cat: 'Dimensional Minion', shape: 'raptor', ai: 'circle', hp: 400, speed: 22, radius: 3.6, scale: 0.55, c1: '#2a1a3a', c2: '#a04aff', glow: '#d06aff', threat: 1, xp: 30, hold: 8, weak: [0, 3, 1, 2],
    attacks: [A('melee', 0, 9, 40, 0.4, 0.8)], voice: [420, 0.4, 1.4], death: 'dissolve',
    desc: 'Small horrors that pour from dimensional rifts.', weakness: 'Everything. They are fragile.' }),
];

const BA = (a: Atk, mult = 1.5): Atk => ({ ...a, dmg: Math.round(a.dmg * mult) });
export const BOSS_LIST: MonDef[] = [
  M({ id: 'abyssalrex', name: 'ABYSSAL REX', title: 'ABYSSAL REX', sub: 'Tyrant of the Drowned Trench', cat: 'Boss — Ocean Reptile', shape: 'rex', hp: 13000, speed: 11, radius: 17, scale: 2.5, c1: '#1f4a6b', c2: '#6ac0d8', glow: '#58e8ff', threat: 5, xp: 1500, hold: 22, boss: true, theme: 'platform', weak: [0, 18, 8, 5], env: { fx: 'water', every: 9 },
    attacks: [BA(A('melee', 0, 30, 90, 0.9, 1.6)), BA(A('sweep', 0, 42, 100, 1.0, 3, { rad: 40, name: 'Tidal Tail' })), BA(A('spit', 25, 100, 55, 0.9, 3, { n: 5, fx: 'water', rad: 10 })), BA(A('wave', 0, 120, 80, 1.2, 6, { fx: 'water', name: 'Tidal Surge' })), BA(A('breath', 25, 90, 100, 1.2, 7, { dur: 2.4, fx: 'water' })), BA(A('charge', 40, 120, 110, 1.3, 7, { dur: 1.3 }))],
    phases: [{ at: 1, atks: [0, 1, 2, 3], spd: 1 }, { at: 0.62, atks: [0, 1, 2, 3, 4], spd: 1.15 }, { at: 0.3, atks: [0, 1, 3, 4, 5], spd: 1.35 }], voice: [38, 2.6, 0.9], death: 'collapse',
    desc: 'An ocean reptile the size of a skyscraper. It fills the sea with storms.', weakness: 'Bioluminescent dorsal core, exposed after Tidal Surge.' }),
  M({ id: 'volcanus', name: 'VOLCANUS', title: 'VOLCANUS', sub: 'The Living Caldera', cat: 'Boss — Fire Titan', shape: 'golem', hp: 15000, speed: 8, radius: 17, scale: 2.7, c1: '#2b1a18', c2: '#ff5a1a', glow: '#ff8a1a', threat: 5, xp: 1700, hold: 24, boss: true, theme: 'volcano', weak: [0, 19, 4, 5], env: { fx: 'lava', every: 7 },
    attacks: [BA(A('slam', 0, 34, 120, 1.1, 2.4, { rad: 28 })), BA(A('bolts', 15, 120, 100, 1.2, 5, { n: 6, rad: 13, fx: 'lava', name: 'Lava Eruption' })), BA(A('bolts', 15, 120, 90, 1.3, 7, { n: 8, rad: 12, fx: 'meteor', name: 'Meteor Rain' })), BA(A('wave', 0, 120, 85, 1.2, 6, { fx: 'fire' })), BA(A('beam', 30, 120, 130, 1.4, 8, { dur: 2.2, fx: 'fire', name: 'Magma Beam' })), BA(A('pulse', 0, 40, 90, 1.0, 8, { rad: 42, name: 'Caldera Burst' }))],
    phases: [{ at: 1, atks: [0, 1, 3], spd: 1 }, { at: 0.62, atks: [0, 1, 2, 3, 5], spd: 1.15 }, { at: 0.3, atks: [1, 2, 3, 4, 5], spd: 1.35 }], voice: [32, 2.8, 1.0], death: 'explode',
    desc: 'A fire titan born from a dormant supervolcano. Lava rains wherever it walks.', weakness: 'Magma core in the chest, exposed after meteor attacks.' }),
  M({ id: 'stormhydra', name: 'STORM HYDRA', title: 'STORM HYDRA', sub: 'Five Heads, One Tempest', cat: 'Boss — Multi-Headed', shape: 'multi', heads: 5, hp: 14000, speed: 9, radius: 16, scale: 2.4, c1: '#3a4a7a', c2: '#a8c8ff', glow: '#8ad8ff', threat: 5, xp: 1600, hold: 28, boss: true, theme: 'harbor', weak: [0, 12, -6, 5], env: { fx: 'lightning', every: 6 }, ai: 'range',
    attacks: [BA(A('melee', 0, 30, 90, 0.8, 1.5)), BA(A('bolts', 10, 130, 100, 1.1, 4, { n: 6, rad: 11, fx: 'lightning', name: 'Thunder Rain' })), BA(A('breath', 20, 90, 100, 1.1, 6, { dur: 2.2, fx: 'lightning' })), BA(A('volley', 20, 120, 45, 0.9, 3, { n: 14, fx: 'ring' })), BA(A('spit', 20, 100, 60, 0.8, 3, { n: 5, fx: 'plasma', rad: 9 })), BA(A('pulse', 0, 40, 80, 1.0, 7, { rad: 40, name: 'Static Discharge' }))],
    phases: [{ at: 1, atks: [0, 1, 4], spd: 1 }, { at: 0.65, atks: [0, 1, 2, 4, 5], spd: 1.15 }, { at: 0.32, atks: [1, 2, 3, 4, 5], spd: 1.3 }], voice: [60, 2.4, 1.6], death: 'explode',
    desc: 'A five-headed beast that drags the storm behind it.', weakness: 'Conductive root core. Ignore the heads; hit the core.' }),
  M({ id: 'skydevourer', name: 'SKY DEVOURER', title: 'SKY DEVOURER', sub: 'Eater of Horizons', cat: 'Boss — Flying Colossus', shape: 'flyer', ai: 'fly', alt: 34, hp: 13500, speed: 18, radius: 18, scale: 3, c1: '#2a3a5a', c2: '#d86a4a', glow: '#ffb04a', threat: 5, xp: 1700, hold: 55, boss: true, theme: 'mountain', weak: [0, 1, 4, 5],
    attacks: [BA(A('dive', 25, 140, 110, 1.3, 5, { rad: 24 })), BA(A('volley', 20, 140, 45, 0.9, 3, { n: 10, fx: 'wind' })), BA(A('pulse', 0, 70, 80, 1.0, 7, { rad: 50, name: 'Hurricane Burst' })), BA(A('bolts', 10, 140, 100, 1.1, 5, { n: 7, rad: 11, fx: 'lightning' })), BA(A('beam', 30, 140, 130, 1.4, 8, { dur: 2.0, fx: 'plasma', name: 'Devouring Ray' }))],
    phases: [{ at: 1, atks: [0, 1, 2], spd: 1 }, { at: 0.62, atks: [0, 1, 2, 3], spd: 1.15 }, { at: 0.3, atks: [0, 1, 3, 4], spd: 1.3 }], voice: [42, 2.4, 0.9], death: 'spiral',
    desc: 'A winged leviathan so large its shadow causes night at noon.', weakness: 'Belly core — exposed when it crashes after a dive.' }),
  M({ id: 'hollowking', name: 'THE HOLLOW KING', title: 'THE HOLLOW KING', sub: 'Sovereign of the Rift', cat: 'Boss — Dimensional', shape: 'hollow', ai: 'float', alt: 12, hp: 14500, speed: 10, radius: 14, scale: 2.4, c1: '#1a1424', c2: '#7a4acb', glow: '#c27bff', threat: 5, xp: 1800, hold: 40, boss: true, theme: 'megacity', weak: [0, 4, 3, 4.5],
    attacks: [BA(A('summon', 0, 160, 0, 1.2, 9, { n: 4, name: 'Rift Summon' })), BA(A('volley', 20, 140, 45, 0.9, 3, { n: 14, fx: 'ring' })), BA(A('pulse', 0, 50, 85, 1.0, 6, { rad: 45, name: 'Void Pulse' })), BA(A('beam', 25, 140, 130, 1.4, 8, { dur: 2.2, fx: 'void', name: 'Hollow Ray' })), BA(A('bolts', 5, 140, 100, 1.1, 5, { n: 6, rad: 12, fx: 'void' })), BA(A('melee', 0, 26, 95, 0.8, 1.6))],
    phases: [{ at: 1, atks: [0, 1, 2, 5], spd: 1 }, { at: 0.62, atks: [0, 1, 2, 3, 4], spd: 1.15 }, { at: 0.3, atks: [0, 1, 3, 4], spd: 1.3 }], voice: [55, 2.6, 1.5], death: 'dissolve',
    desc: 'A dimensional sovereign that commands the rift spawn.', weakness: 'Void crown-core. Kill its summons for energy.' }),
  M({ id: 'omegabeast', name: 'OMEGA BEAST', title: 'OMEGA BEAST', sub: 'The Final Evolution', cat: 'Boss — Evolving Titan', shape: 'omega', hp: 24000, speed: 11, radius: 18, scale: 2.8, c1: '#2a2a3a', c2: '#c8a050', glow: '#ff4a3a', threat: 5, xp: 3500, hold: 26, boss: true, theme: 'city', weak: [0, 19, 4, 5], env: { fx: 'meteor', every: 10 },
    attacks: [BA(A('melee', 0, 32, 100, 0.8, 1.5)), BA(A('sweep', 0, 44, 110, 0.9, 3, { rad: 42 })), BA(A('charge', 40, 130, 120, 1.2, 7, { dur: 1.3 })), BA(A('breath', 20, 90, 110, 1.1, 7, { dur: 2.2, fx: 'fire' })), BA(A('bolts', 10, 140, 100, 1.1, 5, { n: 7, rad: 12, fx: 'lightning' })), BA(A('beam', 30, 150, 140, 1.4, 8, { dur: 2.4, fx: 'void', name: 'Annihilation Ray' })), BA(A('wave', 0, 130, 90, 1.1, 6)), BA(A('summon', 0, 160, 0, 1.2, 12, { n: 4 }))],
    phases: [{ at: 1, atks: [0, 1, 2, 3], spd: 1 }, { at: 0.7, atks: [0, 1, 2, 3, 4, 6], spd: 1.15 }, { at: 0.4, atks: [1, 2, 4, 5, 6, 7], spd: 1.3 }, { at: 0.18, atks: [1, 2, 3, 4, 5, 6, 7], spd: 1.5 }], voice: [30, 3.0, 1.3], death: 'explode',
    desc: 'The ultimate predator. It evolves through four phases as it is damaged.', weakness: 'Evolving core. Each phase changes its attack pattern.' }),
];
export const MONSTERS: Record<string, MonDef> = Object.fromEntries([...MONSTER_LIST, ...BOSS_LIST].map(m => [m.id, m]));
export const ALL_MONSTERS = [...MONSTER_LIST, ...BOSS_LIST];

// ---------------------------------------------------------------- Environments
export interface Theme {
  id: string; name: string; sky: [string, string]; fog: string; fogD: number; ground: string; ground2: string; road: boolean;
  bc: string[]; bh: [number, number]; win: string; wl: number; sun: string; amb: string; half: number; style: string;
  water?: string; lava?: boolean; hazard?: { fx: string; every: number }; desc: string; cell: number;
}
export const THEMES: Record<string, Theme> = {
  city: { id: 'city', name: 'Neo Meridian — Futuristic City', sky: ['#0b1130', '#e0805a'], fog: '#2a2f55', fogD: 0.0042, ground: '#262b3a', ground2: '#151824', road: true, bc: ['#5a6a8a', '#7a8aa8', '#44526e', '#8895b0'], bh: [3, 8], win: '#8fe9ff', wl: 1.4, sun: '#ffc79a', amb: '#6a7aa8', half: 150, style: 'city', cell: 50, desc: 'The shining capital of the last free nations.' },
  harbor: { id: 'harbor', name: 'Port Havenreach — Industrial Harbor', sky: ['#162036', '#8a9aa8'], fog: '#3a4a5c', fogD: 0.0048, ground: '#3a4350', ground2: '#242b34', road: true, bc: ['#c2452a', '#2a6fb0', '#d9a62a', '#3a8a5a', '#8a8f99'], bh: [1, 4], win: '#ffd88a', wl: 0.8, sun: '#ffe0b8', amb: '#6a7a8a', half: 150, style: 'harbor', water: '#1c4a6b', cell: 50, desc: 'Container stacks, cranes and storm-lashed docks.' },
  platform: { id: 'platform', name: 'Ocean Platform Zero', sky: ['#07203a', '#58a8c8'], fog: '#1e4a6a', fogD: 0.004, ground: '#394553', ground2: '#2a3441', road: false, bc: ['#8a98a8', '#c8d0d8', '#d8602a'], bh: [2, 5], win: '#7fe8ff', wl: 1.2, sun: '#d8f0ff', amb: '#5a8aaa', half: 110, style: 'platform', water: '#0e4668', cell: 50, desc: 'A vast offshore fortress platform adrift in an endless sea.' },
  desert: { id: 'desert', name: 'Fort Sandstorm — Desert Base', sky: ['#2a3a6a', '#f0b070'], fog: '#c8956a', fogD: 0.0042, ground: '#b99768', ground2: '#a38455', road: false, bc: ['#a08a68', '#b8a078', '#7a8a62', '#8a7a68'], bh: [1, 3], win: '#ffe0a0', wl: 0.5, sun: '#fff0d0', amb: '#c8a880', half: 150, style: 'desert', cell: 50, desc: 'A sun-baked military outpost on the edge of the dunes.' },
  snow: { id: 'snow', name: 'Station Polaris — Research Facility', sky: ['#14284a', '#b8d8f0'], fog: '#9ab8d0', fogD: 0.0055, ground: '#dce8f2', ground2: '#c0d0e0', road: false, bc: ['#e8eef4', '#7a9ab8', '#c8d8e8', '#5a7a98'], bh: [2, 5], win: '#a0f0ff', wl: 1.1, sun: '#f0f8ff', amb: '#a0b8d8', half: 150, style: 'snow', cell: 50, desc: 'A frozen arctic research complex under aurora skies.' },
  volcano: { id: 'volcano', name: 'Ashfall Basin — Volcanic Battlefield', sky: ['#1a0808', '#ff6a2a'], fog: '#4a1a10', fogD: 0.0055, ground: '#2a201e', ground2: '#1a1412', road: false, bc: ['#4a3a34', '#5a463c', '#3a2e2a'], bh: [2, 4], win: '#ff8a3a', wl: 1.4, sun: '#ff9a5a', amb: '#8a4a3a', half: 140, style: 'volcano', lava: true, hazard: { fx: 'lava', every: 11 }, cell: 50, desc: 'Scorched ruins around a bleeding caldera.' },
  mountain: { id: 'mountain', name: 'Citadel Peak — Mountain Fortress', sky: ['#1a1a4a', '#d890a0'], fog: '#5a5a7a', fogD: 0.0042, ground: '#58606b', ground2: '#444b55', road: false, bc: ['#7a8190', '#8a92a0', '#6a707e'], bh: [3, 6], win: '#ffd08a', wl: 0.7, sun: '#ffd8c8', amb: '#8a8ab0', half: 140, style: 'mountain', cell: 50, desc: 'A last-stand fortress carved into the mountain.' },
  megacity: { id: 'megacity', name: 'Dead Meridian — Abandoned Megacity', sky: ['#120a1c', '#7a3a5a'], fog: '#30223c', fogD: 0.005, ground: '#1f2128', ground2: '#14151a', road: true, bc: ['#3a3a4a', '#4a4452', '#2e3040'], bh: [4, 10], win: '#b06aff', wl: 0.5, sun: '#c89aff', amb: '#6a5a8a', half: 150, style: 'ruin', cell: 50, desc: 'A dead metropolis beneath a bleeding rift in the sky.' },
};
export const THEME_LIST = Object.values(THEMES);

// ---------------------------------------------------------------- Campaign
export interface Mission {
  id: number; name: string; theme: string; brief: string; story: string; obj: string; waves: string[][]; boss?: string;
  reward: { credits: number; xp: number }; bonus: { t: 'time' | 'integrity'; v: number; desc: string }; unlocks?: string; cityDefense?: boolean;
}
export const MISSIONS: Mission[] = [
  { id: 1, name: 'FIRST CONTACT', theme: 'city', brief: 'Neo Meridian reports kaiju surfacing from the harbor. You are the only operational Colossus unit.', story: '"Pilot, this is Command. The Titans have broken the coastal wall. Aegis Prime is online. Show them what humanity can do."', obj: 'Destroy all hostile creatures', waves: [['razor', 'razor'], ['razor', 'ironhide']], reward: { credits: 900, xp: 400 }, bonus: { t: 'time', v: 180, desc: 'Finish in under 3:00' }, unlocks: 'THUNDER FANG' },
  { id: 2, name: 'HARBOR UNDER SIEGE', theme: 'harbor', brief: 'Aquatic monsters are tearing apart Port Havenreach. Protect what remains of the docks.', story: '"The sea itself is hunting us. Thunder Fang prototype is cleared for deployment."', obj: 'Destroy all hostile creatures', waves: [['reefcrusher', 'abysseel'], ['krakenspawn', 'reefcrusher'], ['drakoth', 'abysseel']], reward: { credits: 1200, xp: 600 }, bonus: { t: 'time', v: 300, desc: 'Finish in under 5:00' }, unlocks: 'IRON TITAN' },
  { id: 3, name: 'SANDSTORM PROTOCOL', theme: 'desert', brief: 'Burrowers are undermining Fort Sandstorm. Fight on shifting ground.', story: '"Seismic sensors went mad an hour ago. Something is swimming through the sand. Brace for impact."', obj: 'Destroy all hostile creatures', waves: [['moleterror', 'moleterror'], ['dunewyrm', 'basilisk'], ['dunewyrm', 'moleterror', 'razor']], reward: { credits: 1500, xp: 800 }, bonus: { t: 'time', v: 360, desc: 'Finish in under 6:00' }, unlocks: 'PHANTOM ZERO' },
  { id: 4, name: 'THE DROWNED TYRANT', theme: 'platform', brief: 'Abyssal Rex rises beneath Ocean Platform Zero. Our oil fleets are doomed unless it falls.', story: '"Signature confirmed. Class Omega threat. All evacuations complete. It is you and the Tyrant now, pilot."', obj: 'Defeat ABYSSAL REX', waves: [['abysseel', 'abysseel']], boss: 'abyssalrex', reward: { credits: 2500, xp: 1500 }, bonus: { t: 'time', v: 420, desc: 'Defeat in under 7:00' }, unlocks: 'BASTION X' },
  { id: 5, name: 'FROZEN SILENCE', theme: 'snow', brief: 'Station Polaris went dark. Something woke inside the glacier.', story: '"Research team sent one last transmission: \'It\'s not a creature. It\'s a god.\' Eyes open, pilot."', obj: 'Destroy all hostile creatures', waves: [['nightfang', 'nightfang', 'nightfang'], ['plasmawraith', 'voltjelly', 'cybermantis'], ['elder']], reward: { credits: 2200, xp: 1100 }, bonus: { t: 'time', v: 420, desc: 'Finish in under 7:00' }, unlocks: 'INFERNO CORE' },
  { id: 6, name: 'ASHFALL', theme: 'volcano', brief: 'Volcanus is awake. Its caldera is spilling lava across the lowlands.', story: '"The mountain is walking. Pilot, we will give you everything we have left."', obj: 'Defeat VOLCANUS', waves: [['drakoth', 'boulderback']], boss: 'volcanus', reward: { credits: 3200, xp: 1900 }, bonus: { t: 'time', v: 480, desc: 'Defeat in under 8:00' }, unlocks: 'FROST GUARDIAN' },
  { id: 7, name: 'STORM FRONT', theme: 'harbor', brief: 'Storm Hydra rolls into harbor with the thunderhead. Lightning will rain with it.', story: '"Five heads, five storms. Cut it at the root, pilot. Cut the Hydra."', obj: 'Defeat STORM HYDRA', waves: [['tempestroc', 'voltjelly', 'dihydra']], boss: 'stormhydra', reward: { credits: 3600, xp: 2200 }, bonus: { t: 'time', v: 480, desc: 'Defeat in under 8:00' }, unlocks: 'STORM BREAKER' },
  { id: 8, name: 'CITADEL PEAK', theme: 'mountain', brief: 'Sky Devourer circles the last mountain fortress. Cities beyond will be next.', story: '"No air support survived. The Citadel has one chance: a Colossus pilot on the walls."', obj: 'Defeat SKY DEVOURER', waves: [['galewyvern', 'galewyvern', 'tempestroc'], ['cerberon', 'siegecrawler']], boss: 'skydevourer', reward: { credits: 4200, xp: 2600 }, bonus: { t: 'time', v: 540, desc: 'Defeat in under 9:00' }, unlocks: 'SKY REAPER' },
  { id: 9, name: 'DEAD MERIDIAN', theme: 'megacity', brief: 'A dimensional rift tears open above the abandoned megacity. Its King emerges.', story: '"The rift is spreading. The Hollow King calls. Close it, or humanity ends here."', obj: 'Defeat THE HOLLOW KING', waves: [['riftspawn', 'riftspawn', 'riftspawn', 'cybermantis'], ['primeval']], boss: 'hollowking', reward: { credits: 5000, xp: 3200 }, bonus: { t: 'time', v: 600, desc: 'Defeat in under 10:00' }, unlocks: 'OMEGA COLOSSUS' },
  { id: 10, name: 'OMEGA RISING', theme: 'city', brief: 'Neo Meridian. The final evolution of the Titans rises. Defend the city. End the war.', story: '"This is it, pilot. Every Colossus, every cannon is behind you. Make the last stand count."', obj: 'Defeat OMEGA BEAST. Keep the city intact.', waves: [['cerberon', 'siegecrawler', 'elder'], ['solarflare', 'cybermantis', 'primeval']], boss: 'omegabeast', reward: { credits: 9000, xp: 6000 }, bonus: { t: 'integrity', v: 40, desc: 'Keep city integrity above 40%' }, cityDefense: true, unlocks: 'VICTORY' },
];

// ---------------------------------------------------------------- Achievements
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Blood', desc: 'Destroy your first monster.' },
  { id: 'k50', name: 'Titan Hunter', desc: 'Destroy 50 monsters.' },
  { id: 'k250', name: 'Kaiju Slayer', desc: 'Destroy 250 monsters.' },
  { id: 'boss1', name: 'Giant Killer', desc: 'Defeat a boss.' },
  { id: 'boss6', name: 'Legend of the War', desc: 'Defeat all six bosses.' },
  { id: 'build', name: 'Collateral', desc: 'Destroy 60 buildings.' },
  { id: 'dodge', name: 'Untouchable', desc: 'Perform 15 perfect dodges.' },
  { id: 'counter', name: 'Perfect Guard', desc: 'Land 5 counterattacks.' },
  { id: 'ult', name: 'Final Judgment', desc: 'Use an ultimate attack.' },
  { id: 'transform', name: 'Transformation', desc: 'Transform your mech.' },
  { id: 'm1', name: 'Defender of Meridian', desc: 'Complete mission 1.' },
  { id: 'm10', name: 'End of the War', desc: 'Complete the campaign.' },
  { id: 'lvl5', name: 'Ace Pilot', desc: 'Reach pilot level 5.' },
  { id: 'arena10', name: 'Arena Champion', desc: 'Reach wave 10 in Arena or Survival.' },
  { id: 'weak', name: 'Sharpshooter', desc: 'Hit 30 weak points.' },
  { id: 'hangar', name: 'Collector', desc: 'Unlock 5 mechs.' },
];

export const DEFAULT_BINDS: Record<string, string> = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', switch: 'KeyQ', guard: 'KeyE',
  reload: 'KeyR', special: 'KeyF', ultimate: 'KeyG', lock: 'Tab', transform: 'KeyT',
};
export const BIND_LABELS: Record<string, string> = {
  forward: 'Move Forward', back: 'Move Back', left: 'Move Left', right: 'Move Right', jump: 'Jump / Ascend', dash: 'Dash / Boost', switch: 'Switch Weapon',
  guard: 'Guard / Counter', reload: 'Coolant Vent', special: 'Special Ability', ultimate: 'Ultimate', lock: 'Target Lock', transform: 'Transform / Overdrive',
};
