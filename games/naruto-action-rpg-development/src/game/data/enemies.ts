import type { EnemyDef, LookDef, PatternDef } from '../types';

const mk = (o: Partial<LookDef>): LookDef => ({
  skin: '#e8c4a0', hair: '#2a2a2a', hairStyle: 'spikyShort', outfit: '#555', trim: '#333', pants: '#333', headband: '#444', headbandSlash: true, weapon: 'kunai', ...o,
});

const melee = (o: Partial<PatternDef> = {}): PatternDef => ({ id: 'slash', name: 'Kunai Slash', kind: 'melee', min: 0, max: 3.2, windup: 0.55, recover: 0.7, power: 1, reach: 3.3, ...o });

const E = (d: EnemyDef): [string, EnemyDef] => [d.id, d];
export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries([
  E({ id: 'dummy', name: 'Training Dummy', hp: 60, speed: 0, dmg: 0, def: 0, look: mk({ skin: '#c9a36a', hair: '#8a6a3a', hairStyle: 'none', outfit: '#d8b878', trim: '#a0703a', pants: '#a0703a', headband: '#cc3333', headbandSlash: false, weapon: 'none' }), element: 'none', detect: 0, xp: 12, ryo: 5, tier: 'dummy', ai: 'dummy', patterns: [], poise: 999, color: '#c9a36a' }),
  E({ id: 'rogue', name: 'Rogue Ninja', hp: 85, speed: 5.4, dmg: 11, def: 1, look: mk({ outfit: '#4a4a52', trim: '#7a2a2a', pants: '#2e2e36', hair: '#3a2a20' }), element: 'none', detect: 20, xp: 22, ryo: 14, tier: 'minion', ai: 'melee', poise: 28, patterns: [melee(), melee({ id: 'lunge', name: 'Lunge', kind: 'dash', min: 4, max: 9, windup: 0.7, dist: 6, power: 0.9, recover: 0.9 })], drops: [{ item: 'kunai', chance: 0.3, n: 3 }, { item: 'ramen', chance: 0.06 }, { item: 'ironScrap', chance: 0.15 }], color: '#7a2a2a' }),
  E({ id: 'skilled', name: 'Skilled Shinobi', hp: 150, speed: 6.4, dmg: 14, def: 3, look: mk({ outfit: '#3c5a6e', trim: '#1b2a3a', pants: '#2a3a48', hair: '#6a6a72', headband: '#222', mask: true }), element: 'none', detect: 24, xp: 40, ryo: 26, tier: 'minion', ai: 'melee', blockChance: 0.3, dodgeChance: 0.25, poise: 40, patterns: [melee({ windup: 0.45, power: 1.05 }), melee({ id: 'combo', name: 'Quick Combo', kind: 'spin', min: 0, max: 3.6, windup: 0.6, radius: 3.6, power: 1.1, recover: 0.8 }), melee({ id: 'rush', name: 'Shunshin Rush', kind: 'dash', min: 5, max: 12, windup: 0.55, dist: 8, power: 1, recover: 1 })], drops: [{ item: 'ironScrap', chance: 0.3 }, { item: 'soldierPill', chance: 0.08 }, { item: 'kunai', chance: 0.35, n: 4 }], color: '#3c6a8a' }),
  E({ id: 'fireNin', name: 'Fire Release Ninja', hp: 110, speed: 5.2, dmg: 14, def: 1, look: mk({ outfit: '#b83a1a', trim: '#4a1a10', pants: '#3a2220', hair: '#7a2a10', mask: true }), element: 'fire', detect: 26, xp: 38, ryo: 24, tier: 'minion', ai: 'ranged', poise: 24, patterns: [{ id: 'fireball', name: 'Fireball Jutsu', kind: 'ranged', min: 6, max: 24, windup: 0.9, recover: 1.1, power: 1.2, speed: 16, radius: 1.2, element: 'fire', color: '#ff6a1a' }, melee({ max: 3, windup: 0.5 })], drops: [{ item: 'chakraCrystal', chance: 0.1 }, { item: 'ramen', chance: 0.08 }], color: '#ff6a1a' }),
  E({ id: 'lightningNin', name: 'Lightning Release Ninja', hp: 120, speed: 7, dmg: 15, def: 2, look: mk({ outfit: '#d8c030', trim: '#4a4a20', pants: '#3a3a30', hair: '#e8e8a0' }), element: 'lightning', detect: 24, xp: 42, ryo: 26, tier: 'minion', ai: 'skirmisher', poise: 30, dodgeChance: 0.2, patterns: [{ id: 'bolt', name: 'Lightning Dash', kind: 'dash', min: 4, max: 16, windup: 0.65, recover: 0.9, power: 1.25, dist: 11, element: 'lightning', color: '#ffe84a' }, melee({ windup: 0.4 })], drops: [{ item: 'chakraCrystal', chance: 0.12 }], color: '#ffe84a' }),
  E({ id: 'illusionist', name: 'Genjutsu Adept', hp: 95, speed: 5, dmg: 8, def: 1, look: mk({ outfit: '#5a2a7a', trim: '#2a103a', pants: '#2a1a3a', hair: '#b080e0', headbandSlash: false, eye: '#ff40a0' }), element: 'none', detect: 28, xp: 45, ryo: 28, tier: 'minion', ai: 'ranged', poise: 22, patterns: [{ id: 'illusion', name: 'Demonic Illusion', kind: 'genjutsu', min: 7, max: 22, windup: 1.0, recover: 1.4, power: 0.6, speed: 12, radius: 1.3, color: '#c070ff', cooldown: 7 }, melee({ max: 3, windup: 0.5 })], drops: [{ item: 'xpScroll', chance: 0.1 }], color: '#c070ff' }),
  E({ id: 'demon', name: 'Demon Brother', title: 'Chain Assassin', hp: 230, speed: 6.6, dmg: 15, def: 3, look: mk({ outfit: '#2a2a2a', trim: '#8a8a90', pants: '#3a3a3a', hair: '#1a1a1a', mask: true, headband: '#555' }), element: 'none', detect: 30, xp: 60, ryo: 40, tier: 'minion', ai: 'melee', poise: 45, patterns: [melee({ windup: 0.5, power: 1.1 }), melee({ id: 'chain', name: 'Chain Lash', kind: 'dash', min: 4, max: 13, windup: 0.6, dist: 9, power: 1.2, recover: 1 })], color: '#8a8a90' }),
  E({ id: 'stoneBrute', name: 'Stone Brute', title: 'Earth Release Elite', hp: 520, speed: 4.4, dmg: 22, def: 6, look: mk({ outfit: '#7a5a3a', trim: '#4a3a28', pants: '#4a3a28', hair: '#2a1a10', hairStyle: 'none', scale: 1.35, headband: '#6a5a3a', weapon: 'none' }), element: 'earth', detect: 26, xp: 140, ryo: 90, tier: 'elite', ai: 'brute', poise: 120, patterns: [{ id: 'slam', name: 'Boulder Slam', kind: 'slam', min: 0, max: 14, windup: 1.0, recover: 1.2, power: 1.5, radius: 5, element: 'earth', color: '#d29a5a' }, melee({ id: 'hook', name: 'Heavy Hook', reach: 4, max: 4, windup: 0.8, power: 1.3, recover: 1 })], drops: [{ item: 'ironScrap', chance: 0.8, n: 2 }, { item: 'bigRamen', chance: 0.3 }, { item: 'chakraCrystal', chance: 0.3 }], color: '#d29a5a', radius: 0.8 }),
  E({ id: 'mistElite', name: 'Mist Swordsman', title: 'Elite Hunter-nin', hp: 600, speed: 6.8, dmg: 20, def: 5, look: mk({ outfit: '#2f4a5a', trim: '#9ab0b8', pants: '#1e2e3a', hair: '#8aa0b0', mask: true, weapon: 'sword', scale: 1.1, headband: '#44525a' }), element: 'water', detect: 30, xp: 190, ryo: 120, tier: 'elite', ai: 'melee', blockChance: 0.25, dodgeChance: 0.2, poise: 100, patterns: [melee({ windup: 0.5, power: 1.2, reach: 3.8, max: 3.8 }), melee({ id: 'whirl', name: 'Blade Whirl', kind: 'spin', min: 0, max: 4.5, radius: 4.5, windup: 0.65, power: 1.1, recover: 0.9 }), { id: 'wbullet', name: 'Water Bullets', kind: 'fan', min: 6, max: 22, windup: 0.7, recover: 1.1, power: 0.8, count: 3, spread: 0.45, speed: 17, radius: 1, element: 'water', color: '#5ab0ff' }, melee({ id: 'rush', name: 'Mist Rush', kind: 'dash', min: 5, max: 14, windup: 0.55, dist: 9, power: 1.2, recover: 0.9 })], drops: [{ item: 'chakraBlade', chance: 0.15 }, { item: 'ironScrap', chance: 1, n: 2 }, { item: 'chakraCrystal', chance: 0.5 }], color: '#7ab0c0' }),
  E({ id: 'akatsuki', name: 'Akatsuki Operative', title: 'S-rank Missing-nin', hp: 900, speed: 6.4, dmg: 24, def: 6, look: mk({ outfit: '#14141a', trim: '#c01a1a', pants: '#14141a', hair: '#cfcfd8', headband: '#999', headbandSlash: true, cloak: '#12121a', cloakClouds: true, weapon: 'none', scale: 1.08 }), element: 'fire', detect: 34, xp: 320, ryo: 220, tier: 'elite', ai: 'ranged', poise: 150, dodgeChance: 0.2, patterns: [{ id: 'blast', name: 'Explosive Blast', kind: 'slam', min: 4, max: 20, windup: 1.1, recover: 1, power: 1.5, radius: 5, element: 'fire', color: '#ff4a1a' }, { id: 'volley', name: 'Flame Volley', kind: 'fan', min: 5, max: 24, windup: 0.8, recover: 1, power: 0.9, count: 5, spread: 0.7, speed: 18, radius: 1, element: 'fire', color: '#ff7a2a' }, melee({ id: 'cleave', name: 'Cloaked Strike', windup: 0.5, power: 1.3 })], drops: [{ item: 'akatsukiPendant', chance: 0.2 }, { item: 'chakraCrystal', chance: 1, n: 2 }], color: '#c01a1a' }),
  E({ id: 'waterClone', name: 'Water Clone', hp: 45, speed: 6.5, dmg: 10, def: 0, look: mk({ outfit: '#2f4a5a', trim: '#9ab0b8', pants: '#1e2e3a', hair: '#8aa0b0', mask: true, weapon: 'sword' }), element: 'water', detect: 40, xp: 6, ryo: 0, tier: 'minion', ai: 'melee', poise: 5, patterns: [melee({ windup: 0.5, power: 1 })], color: '#5ab0ff' }),

  // ---------------- BOSSES ----------------
  E({
    id: 'zabuza', name: 'Zabuza Momochi', title: 'Demon of the Hidden Mist', hp: 1500, speed: 6.9, dmg: 24, def: 6, element: 'water', detect: 80, xp: 700, ryo: 800, tier: 'boss', ai: 'boss', poise: 260, color: '#6ab0ff', radius: 0.85,
    look: mk({ skin: '#d6b090', hair: '#2a2a32', hairStyle: 'spikyShort', outfit: '#3a4a5e', trim: '#c0c8d0', pants: '#6a6a78', headband: '#556070', headbandSlash: true, bandage: true, weapon: 'bigSword', scale: 1.22 }),
    arena: { x: -262, z: 0, r: 34 }, phases: [0.62, 0.3],
    phaseLines: ['Not bad, brat... Time to get serious. HIDDEN MIST JUTSU!', 'I am the Demon of the Hidden Mist! Come, face the Executioner!'],
    intro: 'The Demon of the Hidden Mist stands upon the bridge...',
    outro: ['Zabuza: ...Heh. You brats are no ordinary shinobi.', 'Zabuza: Take... my blade. Maybe you will be worthy of it someday.'],
    patterns: [
      { id: 'cleave', name: 'Executioner Cleave', kind: 'melee', min: 0, max: 4.8, windup: 0.8, recover: 0.8, power: 1.2, reach: 5, weight: 3 },
      { id: 'whirl', name: 'Blade Whirl', kind: 'spin', min: 0, max: 5.6, windup: 0.75, recover: 0.9, power: 1, radius: 5.8, weight: 2, cooldown: 4 },
      { id: 'rush', name: 'Executioner Rush', kind: 'dash', min: 5.5, max: 18, windup: 0.95, recover: 1, power: 1.4, dist: 13, weight: 2, cooldown: 3 },
      { id: 'wbullet', name: 'Water Bullet', kind: 'fan', min: 7, max: 28, windup: 0.75, recover: 1, power: 0.9, count: 3, spread: 0.5, speed: 18, radius: 1.1, element: 'water', color: '#4aa8ff', weight: 2, cooldown: 3.5 },
      { id: 'clones', name: 'Water Clone Jutsu', kind: 'summon', min: 4, max: 30, windup: 1.1, recover: 0.8, power: 0, count: 2, summon: 'waterClone', weight: 1.4, cooldown: 14 },
      { id: 'mist', name: 'Hidden Mist Ambush', kind: 'mistStrike', min: 5, max: 40, windup: 1.3, recover: 1, power: 1.7, reach: 5, phase: 1, weight: 2, cooldown: 7 },
      { id: 'dragon', name: 'Water Dragon Jutsu', kind: 'slam', min: 3, max: 26, windup: 1.3, recover: 1.2, power: 2, radius: 7.5, element: 'water', phase: 2, weight: 2.2, cooldown: 6, color: '#3a9cff' },
    ],
    drops: [{ item: 'kubikiriShard', chance: 1 }, { item: 'chakraCrystal', chance: 1, n: 2 }, { item: 'bigRamen', chance: 1, n: 2 }],
  }),
  E({
    id: 'gaara', name: 'Gaara of the Sand', title: 'The One-Tail Jinchuriki', hp: 1900, speed: 5.8, dmg: 26, def: 8, element: 'earth', detect: 80, xp: 950, ryo: 1000, tier: 'boss', ai: 'boss', poise: 320, color: '#e6c887', radius: 0.7,
    look: mk({ skin: '#f0d6c0', hair: '#c1362a', hairStyle: 'messy', outfit: '#8a5a3a', trim: '#e0c07a', pants: '#6a4a30', headband: null, back: 'gourd', weapon: 'none', eye: '#7ad8c8', brows: false }),
    arena: { x: 262, z: 44, r: 38 }, phases: [0.66, 0.33],
    phaseLines: ['Sand... defend me. Let me feel your existence!', 'The desert will swallow you whole!'],
    intro: 'The Sand Jinchuriki rises, sand swirling around him...',
    outro: ['Gaara: ...You fight for others. I begin to understand.', 'Gaara: Perhaps there is strength in bonds.'],
    patterns: [
      { id: 'tendril', name: 'Sand Tendril', kind: 'melee', min: 0, max: 6, windup: 0.6, recover: 0.7, power: 1, reach: 6, weight: 3 },
      { id: 'wave', name: 'Sand Wave', kind: 'fan', min: 5, max: 30, windup: 0.8, recover: 1, power: 0.9, count: 5, spread: 0.9, speed: 15, radius: 1.3, element: 'earth', color: '#e6c887', weight: 2.5, cooldown: 3 },
      { id: 'coffin', name: 'Sand Coffin', kind: 'slam', min: 2, max: 28, windup: 1.4, recover: 1.1, power: 1.6, radius: 6.5, element: 'earth', color: '#e0b860', weight: 2.5, cooldown: 4 },
      { id: 'shield', name: 'Sand Shield', kind: 'shield', min: 0, max: 40, windup: 0.6, recover: 0.6, power: 0, amount: 0.12, weight: 1.2, cooldown: 16 },
      { id: 'burial', name: 'Sand Burial', kind: 'slam', min: 3, max: 28, windup: 1.6, recover: 1.3, power: 2.1, radius: 10, element: 'earth', phase: 1, weight: 2, cooldown: 9, color: '#d0a040' },
      { id: 'storm', name: 'Desert Storm', kind: 'fan', min: 5, max: 30, windup: 0.9, recover: 1, power: 0.8, count: 11, spread: 2.4, speed: 17, radius: 1.2, element: 'earth', color: '#f0d090', phase: 2, weight: 2, cooldown: 7 },
      { id: 'dash', name: 'Sand Rush', kind: 'dash', min: 6, max: 20, windup: 0.8, recover: 1, power: 1.3, dist: 12, phase: 1, weight: 1.5, cooldown: 5 },
    ],
    drops: [{ item: 'sandGourdCharm', chance: 1 }, { item: 'chakraCrystal', chance: 1, n: 3 }],
  }),
]);

export const getEnemy = (id: string): EnemyDef => ENEMIES[id] ?? ENEMIES.rogue;

/** Scale enemy stats by encounter level. */
export const enemyScale = (lv: number) => ({ hp: 1 + 0.14 * (lv - 1), dmg: 1 + 0.07 * (lv - 1) });
