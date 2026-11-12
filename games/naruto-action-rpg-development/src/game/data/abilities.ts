import type { AbilityDef, SkillNode } from '../types';

const A = (a: AbilityDef): [string, AbilityDef] => [a.id, a];

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries([
  // ---------------- Naruto ----------------
  A({ id: 'clone', name: 'Shadow Clone Jutsu', desc: 'Summon solid clones that fight beside you and draw enemy attention.', kind: 'clone', element: 'none', cost: 25, cooldown: 9, power: 0.55, count: 3, duration: 12, castTime: 0.4, color: '#ffffff', icon: '👥', unlockLevel: 1, category: 'special' }),
  A({ id: 'rasengan', name: 'Rasengan', desc: 'Dash at a target with a swirling sphere of chakra. Heavy knockback.', kind: 'dashStrike', element: 'none', cost: 30, cooldown: 5, power: 5, range: 14, radius: 3.2, castTime: 0.5, color: '#7fd8ff', icon: '🌀', unlockLevel: 2, category: 'ninjutsu', status: 'stun', statusDur: 0.8 }),
  A({ id: 'giantRasengan', name: 'Giant Rasengan', desc: 'A huge Rasengan with a wide blast. +35% damage while clones are active.', kind: 'dashStrike', element: 'none', cost: 55, cooldown: 12, power: 8, range: 12, radius: 6.5, castTime: 0.8, size: 2.4, color: '#9be8ff', icon: '🔵', unlockLevel: 5, category: 'ninjutsu', status: 'stun', statusDur: 1.2 }),
  A({ id: 'rasenshuriken', name: 'Rasenshuriken', desc: 'Hurl a spinning wind-release shuriken that explodes in a shredding storm. Needs the Secret Wind Scroll.', kind: 'projectile', element: 'wind', cost: 70, cooldown: 16, power: 9, speed: 24, radius: 7.5, range: 45, castTime: 0.95, size: 1.3, color: '#b8f5ff', icon: '✴️', unlockLevel: 8, unlockFlag: 'secretWind', category: 'ninjutsu' }),
  A({ id: 'windScythe', name: 'Wind Release: Wind Scythe', desc: 'Fast slicing wind blades. Cheap, quick and pierces enemies.', kind: 'projectile', element: 'wind', cost: 12, cooldown: 2.2, power: 1.7, speed: 34, radius: 1.2, range: 26, count: 1, castTime: 0.28, pierce: true, size: 0.55, color: '#d5fff2', icon: '🍃', unlockLevel: 3, category: 'ninjutsu' }),
  A({ id: 'sexy', name: 'Sexy Jutsu', desc: 'A shameless genjutsu-style distraction. Enemies nearby are charmed and confused.', kind: 'genjutsu', element: 'none', cost: 20, cooldown: 14, power: 0, radius: 9, duration: 4.5, castTime: 0.45, color: '#ffc6e0', icon: '💋', unlockLevel: 1, category: 'special', status: 'confuse' }),
  A({ id: 'summon', name: 'Summoning Jutsu', desc: 'Summon a giant toad that crashes down on the battlefield.', kind: 'summon', element: 'none', cost: 60, cooldown: 24, power: 7, radius: 9, range: 9, castTime: 0.8, color: '#6bd36b', icon: '🐸', unlockLevel: 4, category: 'special', visual: 'toad', status: 'stun', statusDur: 1.5 }),
  A({ id: 'uzumakiBarrage', name: 'Uzumaki Barrage', desc: 'Ultimate: clones swarm a target in a flurry of kicks, launching it skyward.', kind: 'barrage', element: 'none', cost: 40, cooldown: 3, power: 1.25, count: 10, radius: 4, castTime: 0.3, color: '#ffb84a', icon: '💥', unlockLevel: 3, category: 'special', ult: true, status: 'stun', statusDur: 1.4 }),
  A({ id: 'superRasenshuriken', name: 'Sage Art: Super Rasenshuriken', desc: 'Ultimate (Sage Mode): a colossal wind shuriken that devastates everything.', kind: 'projectile', element: 'wind', cost: 70, cooldown: 3, power: 16, speed: 22, radius: 11, range: 50, castTime: 1.1, size: 2.4, color: '#ffe9a8', icon: '🌪️', unlockLevel: 6, category: 'special', ult: true, needsForm: 'sage' }),
  A({ id: 'tailedBeastBomb', name: 'Tailed Beast Bomb', desc: 'Ultimate (Kurama Mode): condense chakra into a planet-shaking sphere.', kind: 'projectile', element: 'none', cost: 90, cooldown: 3, power: 24, speed: 20, radius: 14, range: 55, castTime: 1.3, size: 3.2, color: '#ffb02e', icon: '☄️', unlockLevel: 10, category: 'special', ult: true, needsForm: 'kurama' }),

  // ---------------- Sasuke ----------------
  A({ id: 'chidori', name: 'Chidori', desc: 'Lightning-charged thrust. Stuns on hit.', kind: 'dashStrike', element: 'lightning', cost: 28, cooldown: 5, power: 4.6, range: 15, radius: 3, castTime: 0.45, color: '#9ec8ff', icon: '⚡', unlockLevel: 1, category: 'ninjutsu', status: 'stun', statusDur: 1 }),
  A({ id: 'fireball', name: 'Fire Release: Fireball', desc: 'Exhale a roaring fireball that burns enemies.', kind: 'projectile', element: 'fire', cost: 24, cooldown: 4, power: 3.8, speed: 20, radius: 4.2, range: 28, castTime: 0.5, size: 0.9, color: '#ff7a2a', icon: '🔥', unlockLevel: 1, category: 'ninjutsu', status: 'burn', statusDur: 3 }),
  A({ id: 'sharinganGenjutsu', name: 'Sharingan Genjutsu', desc: 'Lock eyes with nearby foes and trap them in an illusion.', kind: 'genjutsu', element: 'none', cost: 22, cooldown: 12, power: 0, radius: 10, duration: 5, castTime: 0.4, color: '#ff4040', icon: '👁️', unlockLevel: 3, category: 'special', status: 'confuse' }),
  A({ id: 'lightningStream', name: 'Lightning Stream', desc: 'Bolts of lightning rain in a ring around you.', kind: 'aoe', element: 'lightning', cost: 35, cooldown: 8, power: 3.4, radius: 6.5, range: 0, castTime: 0.4, color: '#b7d6ff', icon: '🌩️', unlockLevel: 5, category: 'ninjutsu', visual: 'lightning', status: 'stun', statusDur: 0.8 }),
  A({ id: 'kirin', name: 'Kirin', desc: 'Ultimate: call down a dragon of heavenly lightning.', kind: 'aoe', element: 'lightning', cost: 60, cooldown: 3, power: 14, radius: 11, range: 8, castTime: 0.9, color: '#a0c0ff', icon: '🐉', unlockLevel: 1, category: 'special', ult: true, visual: 'lightning', status: 'stun', statusDur: 2 }),

  // ---------------- Sakura ----------------
  A({ id: 'blossomImpact', name: 'Cherry Blossom Impact', desc: 'A chakra-infused punch that shatters the ground.', kind: 'aoe', element: 'earth', cost: 22, cooldown: 5, power: 4.2, radius: 5, range: 2.5, castTime: 0.45, color: '#ff9fc4', icon: '🌸', unlockLevel: 1, category: 'taijutsu', visual: 'blossom', status: 'stun', statusDur: 0.8 }),
  A({ id: 'healingPalm', name: 'Mystical Palm Healing', desc: 'Restore 30% of your health.', kind: 'buff', element: 'none', cost: 30, cooldown: 14, power: 0, castTime: 0.6, duration: 6, buff: { heal: 0.3 }, color: '#7cffb0', icon: '💚', unlockLevel: 1, category: 'defense' }),
  A({ id: 'earthShatter', name: 'Ground Shatter', desc: 'Stomp to send a shockwave in a wide ring.', kind: 'aoe', element: 'earth', cost: 30, cooldown: 7, power: 3.2, radius: 8, range: 0, castTime: 0.5, color: '#d2a273', icon: '🪨', unlockLevel: 4, category: 'taijutsu', visual: 'blossom', status: 'slow', statusDur: 3 }),
  A({ id: 'strengthSeal', name: 'Strength of a Hundred Seal', desc: 'Release the seal: +40% damage and faster healing for 14s.', kind: 'buff', element: 'none', cost: 45, cooldown: 28, power: 0, castTime: 0.6, duration: 14, buff: { dmg: 0.4, heal: 0.1 }, color: '#d77cff', icon: '💮', unlockLevel: 6, category: 'special' }),
  A({ id: 'shannaro', name: 'Shannaro Mega-Impact', desc: 'Ultimate: a devastating earth-splitting punch.', kind: 'aoe', element: 'earth', cost: 55, cooldown: 3, power: 15, radius: 10, range: 3, castTime: 0.8, color: '#ff7aa8', icon: '👊', unlockLevel: 1, category: 'special', ult: true, visual: 'blossom', status: 'stun', statusDur: 2 }),

  // ---------------- Kakashi ----------------
  A({ id: 'raikiri', name: 'Raikiri', desc: 'Lightning Blade. A lethal piercing dash.', kind: 'dashStrike', element: 'lightning', cost: 30, cooldown: 5, power: 5, range: 16, radius: 2.8, castTime: 0.4, color: '#c7e0ff', icon: '⚡', unlockLevel: 1, category: 'ninjutsu', status: 'stun', statusDur: 1 }),
  A({ id: 'waterDragon', name: 'Water Release: Water Dragon', desc: 'A surging dragon of water that crushes foes.', kind: 'projectile', element: 'water', cost: 36, cooldown: 7, power: 4.5, speed: 18, radius: 5, range: 30, castTime: 0.6, size: 1.1, color: '#4aa8ff', icon: '🐲', unlockLevel: 1, category: 'ninjutsu', status: 'slow', statusDur: 3 }),
  A({ id: 'kakashiClones', name: 'Ninken Summoning', desc: 'Summon ninja hounds to harry your enemies.', kind: 'clone', element: 'none', cost: 28, cooldown: 12, power: 0.7, count: 2, duration: 10, castTime: 0.4, color: '#d8c8a0', icon: '🐕', unlockLevel: 3, category: 'special' }),
  A({ id: 'copySlash', name: 'Lightning Cutter', desc: 'A fan of lightning slashes.', kind: 'projectile', element: 'lightning', cost: 22, cooldown: 4, power: 2.2, speed: 30, radius: 1.5, range: 22, count: 3, spread: 0.45, castTime: 0.3, pierce: true, size: 0.5, color: '#bcd9ff', icon: '🗡️', unlockLevel: 4, category: 'ninjutsu' }),
  A({ id: 'kamui', name: 'Kamui Raikiri', desc: 'Ultimate: a dimension-warping Lightning Blade.', kind: 'dashStrike', element: 'lightning', cost: 60, cooldown: 3, power: 15, range: 22, radius: 7, castTime: 0.7, size: 1.6, color: '#d6b8ff', icon: '🌀', unlockLevel: 1, category: 'special', ult: true, status: 'stun', statusDur: 2 }),

  // ---------------- Jiraiya ----------------
  A({ id: 'jiraiyaRasengan', name: 'Rasengan', desc: 'The sage\'s own Rasengan.', kind: 'dashStrike', element: 'none', cost: 30, cooldown: 5, power: 4.6, range: 13, radius: 3.2, castTime: 0.5, color: '#8fdcff', icon: '🌀', unlockLevel: 1, category: 'ninjutsu', status: 'stun', statusDur: 0.8 }),
  A({ id: 'toadOil', name: 'Fire Release: Toad Oil Flame', desc: 'Spit flaming oil in a wide cone that burns.', kind: 'projectile', element: 'fire', cost: 30, cooldown: 6, power: 2, speed: 18, radius: 3.5, range: 14, count: 5, spread: 0.7, castTime: 0.5, size: 0.8, color: '#ff9a3a', icon: '🔥', unlockLevel: 1, category: 'ninjutsu', status: 'burn', statusDur: 4 }),
  A({ id: 'needleJizo', name: 'Needle Jizo', desc: 'Harden your hair into spikes: +40% defense and regen.', kind: 'buff', element: 'none', cost: 25, cooldown: 16, power: 0, castTime: 0.5, duration: 10, buff: { def: 0.4, heal: 0.08 }, color: '#f3f3f3', icon: '🛡️', unlockLevel: 1, category: 'defense' }),
  A({ id: 'swampBog', name: 'Earth Release: Swamp of the Underworld', desc: 'Turn the ground into swamp. Enemies are slowed.', kind: 'aoe', element: 'earth', cost: 34, cooldown: 9, power: 1.8, radius: 9, range: 6, castTime: 0.5, color: '#8a6a42', icon: '🟤', unlockLevel: 4, category: 'ninjutsu', status: 'slow', statusDur: 5, visual: 'blossom' }),
  A({ id: 'frogSong', name: 'Sage Art: Toad Oil Inferno', desc: 'Ultimate: summon a toad to flood the field with burning oil.', kind: 'summon', element: 'fire', cost: 70, cooldown: 3, power: 14, radius: 12, range: 10, castTime: 0.9, color: '#ff7a1a', icon: '🐸', unlockLevel: 1, category: 'special', ult: true, visual: 'toad', status: 'burn', statusDur: 5 }),

  // ---------------- Rock Lee ----------------
  A({ id: 'leafHurricane', name: 'Konoha Senpu', desc: 'Leaf Whirlwind: a spinning kick that sweeps around you.', kind: 'aoe', element: 'none', cost: 8, cooldown: 3, power: 3, radius: 4.6, range: 0, castTime: 0.3, color: '#7cff7c', icon: '🍃', unlockLevel: 1, category: 'taijutsu', visual: 'none', status: 'stun', statusDur: 0.5 }),
  A({ id: 'primaryLotus', name: 'Primary Lotus', desc: 'Launch an enemy and hammer it with a brutal combination.', kind: 'barrage', element: 'none', cost: 14, cooldown: 8, power: 0.9, count: 8, radius: 3.5, castTime: 0.25, color: '#ffe066', icon: '🪷', unlockLevel: 1, category: 'taijutsu', status: 'stun', statusDur: 1.2 }),
  A({ id: 'dynamicEntry', name: 'Dynamic Entry', desc: 'A rocket flying kick across the screen.', kind: 'dashStrike', element: 'none', cost: 10, cooldown: 4, power: 3.6, range: 15, radius: 2.5, castTime: 0.2, color: '#9cff9c', icon: '🦵', unlockLevel: 1, category: 'taijutsu', status: 'stun', statusDur: 0.8 }),
  A({ id: 'gateOpen', name: 'Eight Gates: Gate of Opening', desc: 'Open the gates: +60% damage and +30% speed for 15s.', kind: 'buff', element: 'none', cost: 16, cooldown: 26, power: 0, castTime: 0.5, duration: 15, buff: { dmg: 0.6, speed: 0.3 }, color: '#ff5c5c', icon: '🔴', unlockLevel: 4, category: 'special' }),
  A({ id: 'hirudora', name: 'Hirudora', desc: 'Ultimate: a punch that compresses air into a tiger-shaped blast.', kind: 'projectile', element: 'wind', cost: 30, cooldown: 3, power: 13, speed: 30, radius: 9, range: 36, castTime: 0.7, size: 1.8, color: '#fff3a0', icon: '🐅', unlockLevel: 1, category: 'special', ult: true }),

  // ---------------- Gaara ----------------
  A({ id: 'sandCoffin', name: 'Sand Coffin', desc: 'Entomb enemies in crushing sand.', kind: 'aoe', element: 'earth', cost: 28, cooldown: 6, power: 3.6, radius: 5.5, range: 7, castTime: 0.5, color: '#d9b46a', icon: '⏳', unlockLevel: 1, category: 'ninjutsu', visual: 'sand', status: 'stun', statusDur: 1.2 }),
  A({ id: 'sandShield', name: 'Absolute Defense', desc: 'A sand shield: +60% defense and regen for 8s.', kind: 'buff', element: 'none', cost: 24, cooldown: 14, power: 0, castTime: 0.4, duration: 8, buff: { def: 0.6, heal: 0.06 }, color: '#e0c07a', icon: '🟡', unlockLevel: 1, category: 'defense' }),
  A({ id: 'sandWave', name: 'Sand Tsunami', desc: 'A wide wave of sand sweeps forward.', kind: 'projectile', element: 'earth', cost: 30, cooldown: 7, power: 2.4, speed: 16, radius: 3, range: 24, count: 5, spread: 0.9, castTime: 0.5, pierce: true, size: 1, color: '#e6c887', icon: '🌊', unlockLevel: 3, category: 'ninjutsu', status: 'slow', statusDur: 3 }),
  A({ id: 'sandBurial', name: 'Desert Funeral', desc: 'Ultimate: bury everything nearby in sand.', kind: 'aoe', element: 'earth', cost: 55, cooldown: 3, power: 14, radius: 12, range: 6, castTime: 0.9, color: '#e8c070', icon: '⚰️', unlockLevel: 1, category: 'special', ult: true, visual: 'sand', status: 'stun', statusDur: 2.2 }),

  // ---------------- Shared ----------------
  A({ id: 'substitution', name: 'Substitution Jutsu', desc: 'Swap with a log and reappear behind your foe.', kind: 'substitution', element: 'none', cost: 18, cooldown: 6, power: 0, castTime: 0, color: '#c9a36a', icon: '🪵', unlockLevel: 1, category: 'defense' }),
]);

export const getAbility = (id: string): AbilityDef | undefined => ABILITIES[id];

const N = (n: SkillNode): [string, SkillNode] => [n.id, n];
export const SKILLS: Record<string, SkillNode> = Object.fromEntries([
  N({ id: 'tai1', name: 'Iron Fist', desc: '+12% taijutsu damage.', category: 'taijutsu', cost: 1, minLevel: 2, mods: { dmgPhys: 0.12 }, icon: '👊' }),
  N({ id: 'tai2', name: 'Combo Mastery', desc: '+15% taijutsu damage and +4% crit.', category: 'taijutsu', cost: 1, minLevel: 4, requires: 'tai1', mods: { dmgPhys: 0.15, crit: 0.04 }, icon: '🥋' }),
  N({ id: 'tai3', name: 'Gate Conditioning', desc: '+3 attack and +10% HP.', category: 'taijutsu', cost: 2, minLevel: 9, requires: 'tai2', mods: { atk: 3, hp: 0.1 }, icon: '💪' }),
  N({ id: 'nin1', name: 'Jutsu Focus', desc: '+12% ninjutsu damage.', category: 'ninjutsu', cost: 1, minLevel: 2, mods: { dmgJutsu: 0.12 }, icon: '📜' }),
  N({ id: 'nin2', name: 'Elemental Affinity', desc: 'Elemental advantage bonus +20%.', category: 'ninjutsu', cost: 1, minLevel: 5, requires: 'nin1', mods: { elementBonus: 0.2 }, icon: '🔥' }),
  N({ id: 'nin3', name: 'Advanced Ninjutsu', desc: '-15% ability cooldowns and +15% jutsu damage.', category: 'ninjutsu', cost: 2, minLevel: 10, requires: 'nin2', mods: { cdr: 0.15, dmgJutsu: 0.15 }, icon: '🌀' }),
  N({ id: 'chk1', name: 'Chakra Reservoir', desc: '+30 maximum chakra.', category: 'chakra', cost: 1, minLevel: 2, mods: { chakra: 30 }, icon: '💧' }),
  N({ id: 'chk2', name: 'Efficient Flow', desc: '+35% chakra regeneration.', category: 'chakra', cost: 1, minLevel: 4, requires: 'chk1', mods: { regen: 0.35 }, icon: '〰️' }),
  N({ id: 'chk3', name: 'Chakra Charging', desc: '+60% charging speed.', category: 'chakra', cost: 1, minLevel: 7, requires: 'chk2', mods: { chargeSpeed: 0.6 }, icon: '🔋' }),
  N({ id: 'def1', name: 'Tough Body', desc: '+12% max HP and +2 defense.', category: 'defense', cost: 1, minLevel: 2, mods: { hp: 0.12, def: 2 }, icon: '🛡️' }),
  N({ id: 'def2', name: 'Substitution Mastery', desc: 'Substitution costs 40% less chakra.', category: 'defense', cost: 1, minLevel: 4, requires: 'def1', mods: { subCost: 0.4 }, icon: '🪵' }),
  N({ id: 'def3', name: 'Reflexes', desc: 'Longer dodge invulnerability and wider parry window.', category: 'defense', cost: 1, minLevel: 6, requires: 'def2', mods: { dodge: 0.08, parry: 0.1 }, icon: '👁️' }),
  N({ id: 'def4', name: 'Last Stand Substitution', desc: 'Automatically substitute out of a lethal blow (60s cooldown).', category: 'defense', cost: 2, minLevel: 10, requires: 'def3', mods: { autoSub: 1 }, icon: '✨' }),
  N({ id: 'spc1', name: 'Fighting Spirit', desc: '+35% ultimate gauge gain.', category: 'special', cost: 1, minLevel: 3, mods: { ult: 0.35 }, icon: '🔥' }),
  N({ id: 'spc2', name: 'Clone Mastery', desc: '+1 clone and +4s clone duration.', category: 'special', cost: 1, minLevel: 5, requires: 'spc1', mods: { cloneCount: 1, cloneTime: 4 }, icon: '👥' }),
  N({ id: 'spc3', name: 'Battle Instinct', desc: '+6% crit chance and +2 attack.', category: 'special', cost: 1, minLevel: 8, requires: 'spc2', mods: { crit: 0.06, atk: 2 }, icon: '⭐' }),
  N({ id: 'trf1', name: 'Natural Energy', desc: 'Unlock Sage Mode (needs Natural Energy Training at Mount Myoboku). Naruto only.', category: 'transform', cost: 2, minLevel: 6, mods: { sage: 1 }, icon: '🐸' }),
  N({ id: 'trf2', name: 'Sage Mastery', desc: 'Forms last 50% longer.', category: 'transform', cost: 1, minLevel: 8, requires: 'trf1', mods: { formTime: 0.5 }, icon: '☯️' }),
  N({ id: 'trf3', name: 'Kurama Link', desc: 'Unlock Kurama Chakra Mode. Naruto only.', category: 'transform', cost: 3, minLevel: 10, requires: 'trf1', mods: { kurama: 1 }, icon: '🦊' }),
  N({ id: 'trf4', name: 'Cloak Mastery', desc: 'Form chakra drain -40%.', category: 'transform', cost: 2, minLevel: 12, requires: 'trf3', mods: { formDrain: 0.4 }, icon: '🌟' }),
]);

export const SKILL_CATEGORIES: { id: string; name: string; color: string; icon: string }[] = [
  { id: 'taijutsu', name: 'Taijutsu', color: '#ff8a3d', icon: '👊' },
  { id: 'ninjutsu', name: 'Ninjutsu', color: '#4aa8ff', icon: '🌀' },
  { id: 'chakra', name: 'Chakra Control', color: '#5ce0ff', icon: '💧' },
  { id: 'defense', name: 'Defensive Techniques', color: '#7cd86a', icon: '🛡️' },
  { id: 'special', name: 'Special Abilities', color: '#ff5c8a', icon: '⭐' },
  { id: 'transform', name: 'Transformation Mastery', color: '#ffc83d', icon: '🦊' },
];
