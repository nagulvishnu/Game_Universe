import { ArenaDef, ArenaId, BossId, Challenge, EAtk, Elem, EnemyDef, EnemyId, ModeId, StyleDef, StyleId, WeaponId } from '../types';
import { WEAPONS } from './weapons';

export const STYLES: Record<StyleId, StyleDef> = {
  berserker: { id: 'berserker', name: 'Berserker', icon: '🔥', color: 0xff4a2a, desc: 'Raw aggression. Hits harder, breaks posture, grows stronger when wounded.',
    dmg: 1.25, speed: .96, hp: 1, stamina: 1, taken: 1.1, stagger: 1.6, pw: 1, counter: 1.2, moveSpeed: 1, dodgeStam: 1, iframes: 1, armorBreak: 1.3,
    perks: ['+25% damage, +60% stagger', 'Rage: +20% damage below 50% HP', 'Heals 4% of damage dealt', '+10% damage taken'] },
  samurai: { id: 'samurai', name: 'Samurai', icon: '⚔', color: 0x7fd8ff, desc: 'Discipline and precision. Wider perfect-deflect window and lethal counters.',
    dmg: 1, speed: 1.05, hp: 1, stamina: 1.1, taken: 1, stagger: 1, pw: 1.45, counter: 1.7, moveSpeed: 1, dodgeStam: 1, iframes: 1, armorBreak: 1,
    perks: ['+45% perfect-deflect window', '+70% counter damage', 'Perfect deflect refunds stamina', 'Precision +5% attack speed'] },
  assassin: { id: 'assassin', name: 'Assassin', icon: '🗡', color: 0xb26bff, desc: 'Speed and mobility. Teleporting strikes, long i-frames, double jump.',
    dmg: .88, speed: 1.25, hp: .85, stamina: 1, taken: 1, stagger: .8, pw: 1, counter: 1.1, moveSpeed: 1.18, dodgeStam: .6, iframes: 1.5, armorBreak: .8,
    perks: ['+25% attack speed, +18% move speed', 'Dodge costs 40% less, longer i-frames', 'Double jump', 'Attack after dodge blinks to target'] },
  arcane: { id: 'arcane', name: 'Arcane Warrior', icon: '✦', color: 0x52f0ff, desc: 'Spell-infused combat. Combos fire elemental bolts, specials recharge faster.',
    dmg: .92, speed: 1.05, hp: .95, stamina: 1, taken: 1, stagger: 1, pw: 1.05, counter: 1.15, moveSpeed: 1.05, dodgeStam: 1, iframes: 1, armorBreak: 1,
    perks: ['Every light hit fires a spell bolt', 'Special cooldowns -30%', '+25% ultimate charge', 'Awakening lasts longer'] },
  juggernaut: { id: 'juggernaut', name: 'Juggernaut', icon: '🛡', color: 0xffc43d, desc: 'An immovable wall. Armored, resists flinching, breaks armor, retaliates.',
    dmg: 1, speed: .92, hp: 1.45, stamina: 1.2, taken: .72, stagger: 1.25, pw: 1.1, counter: 1.3, moveSpeed: .92, dodgeStam: 1.1, iframes: .9, armorBreak: 2.2,
    perks: ['+45% health, -28% damage taken', 'Hyper armor: rarely flinches', '2.2x armor-break', 'Retaliation: +50% damage after being hit'] },
};
export const STYLE_ORDER: StyleId[] = ['berserker', 'samurai', 'assassin', 'arcane', 'juggernaut'];

const E = (id: string, name: string, a: Partial<EAtk> & Pick<EAtk, 'pose' | 'wind' | 'rec' | 'dmg' | 'reach'>): EAtk => ({ id, name, min: 0, max: a.reach + 1.2, w: 3, kind: 'melee', ...a });

export const ENEMIES: Record<string, EnemyDef> = {
  knight: { id: 'knight', name: 'Sword Knight', hp: 70, speed: 3.6, radius: .55, scale: 1, pref: 2.5, armor: 0, guard: true, score: 100, posture: 40, tokens: 1, elem: 'phys',
    rig: { kind: 'knight', main: 0x6b7280, accent: 0xffc27a }, weapon: 'sword',
    atks: [E('slash', 'Slash', { pose: 'horizontal', wind: .6, rec: .75, dmg: 10, reach: 3, arc: 2, w: 3 }),
      E('chop', 'Overhead', { pose: 'overhead', wind: .8, rec: .9, dmg: 15, reach: 3.1, arc: 1.6, w: 2 }),
      E('combo', 'Twin Slash', { pose: 'flurry', wind: .65, rec: .9, dmg: 8, reach: 3, arc: 2, hits: 2, gap: .38, w: 2 })] },
  assassin: { id: 'assassin', name: 'Dual Blade Assassin', hp: 50, speed: 6.2, radius: .5, scale: .95, pref: 2.1, armor: 0, guard: false, score: 130, posture: 30, tokens: 1, elem: 'phys',
    rig: { kind: 'assassin', main: 0x3b2a55, accent: 0xff4d8d }, weapon: 'daggers',
    atks: [E('flurry', 'Blade Flurry', { pose: 'flurry', wind: .5, rec: .8, dmg: 6, reach: 2.6, arc: 2.2, hits: 3, gap: .24, lunge: 1.5, w: 3 }),
      E('dash', 'Shadow Dash', { pose: 'rush', wind: .55, rec: .8, dmg: 12, reach: 2.6, kind: 'rush', min: 3, max: 10, w: 2 }),
      E('throw', 'Kunai', { pose: 'cast', wind: .5, rec: .7, dmg: 7, reach: 14, kind: 'proj', min: 4, max: 14, w: 1, proj: { n: 1, spread: 0, speed: 17, kind: 'orb', elem: 'phys', size: .28 } })] },
  brute: { id: 'brute', name: 'Heavy Brute', hp: 190, speed: 2.5, radius: .95, scale: 1.4, pref: 2.8, armor: 60, guard: false, score: 220, posture: 70, tokens: 1, elem: 'earth',
    rig: { kind: 'brute', main: 0x6e4a3a, accent: 0xffa030, bulk: 1.4 }, weapon: 'club',
    atks: [E('smash', 'Crushing Blow', { pose: 'overhead', wind: 1.0, rec: 1.3, dmg: 26, reach: 3.7, arc: 1.8, w: 3, heavy: true, posture: 20 }),
      E('pound', 'Ground Pound', { pose: 'slam', wind: 1.15, rec: 1.3, dmg: 22, reach: 4.8, kind: 'aoe', unblock: true, aoe: { r: 4.8, at: 'self' }, w: 2 }),
      E('sweep', 'Wide Sweep', { pose: 'sweep', wind: .9, rec: 1.1, dmg: 17, reach: 3.9, arc: 3, w: 2 })] },
  mage: { id: 'mage', name: 'Arcane Mage', hp: 55, speed: 3.2, radius: .5, scale: 1, pref: 9, armor: 0, guard: false, score: 150, posture: 25, tokens: 1, elem: 'void',
    rig: { kind: 'mage', main: 0x3c2f6e, accent: 0xb26bff }, weapon: 'staff',
    atks: [E('orb', 'Arcane Orb', { pose: 'cast', wind: .85, rec: 1.0, dmg: 11, reach: 20, kind: 'proj', min: 3, max: 20, w: 3, proj: { n: 1, spread: 0, speed: 13, kind: 'orb', elem: 'void', size: .45 } }),
      E('fan', 'Orb Fan', { pose: 'cast', wind: 1.0, rec: 1.1, dmg: 8, reach: 20, kind: 'proj', min: 4, max: 20, w: 2, proj: { n: 3, spread: .5, speed: 11.5, kind: 'orb', elem: 'void', size: .38 } }),
      E('burst', 'Arcane Burst', { pose: 'raise', wind: .8, rec: 1.0, dmg: 18, reach: 20, kind: 'aoe', unblock: true, min: 0, max: 20, w: 2, aoe: { r: 3.2, at: 'target', delay: 1.1 } })] },
  hunter: { id: 'hunter', name: 'Spear Hunter', hp: 85, speed: 4.2, radius: .55, scale: 1.05, pref: 5, armor: 0, guard: false, score: 140, posture: 35, tokens: 1, elem: 'phys',
    rig: { kind: 'hunter', main: 0x2f5c4a, accent: 0x7cffb0 }, weapon: 'spear',
    atks: [E('thrust', 'Long Thrust', { pose: 'thrust', wind: .7, rec: .9, dmg: 14, reach: 6, arc: .6, min: 2.5, max: 7, lunge: 2.2, w: 3 }),
      E('sweep', 'Spear Sweep', { pose: 'horizontal', wind: .65, rec: .85, dmg: 12, reach: 4.5, arc: 2.8, w: 2 }),
      E('triple', 'Triple Thrust', { pose: 'thrust', wind: .7, rec: 1.0, dmg: 7, reach: 5.6, arc: .6, hits: 3, gap: .26, min: 2.5, max: 6.5, w: 2 })] },
  executioner: { id: 'executioner', name: 'Elite Executioner', hp: 270, speed: 4.5, radius: .75, scale: 1.3, pref: 2.8, armor: 40, guard: true, score: 450, posture: 60, tokens: 1, elem: 'phys',
    rig: { kind: 'exec', main: 0x22181c, accent: 0xff2a44, bulk: 1.15 }, weapon: 'cleaver',
    atks: [E('cleave', 'Execution Cleave', { pose: 'overhead', wind: .85, rec: .9, dmg: 24, reach: 3.8, arc: 1.8, w: 3, feint: true, heavy: true, posture: 18 }),
      E('triple', 'Reaper Combo', { pose: 'flurry', wind: .6, rec: 1.0, dmg: 11, reach: 3.5, arc: 2.4, hits: 3, gap: .4, w: 3, feint: true }),
      E('quick', 'Counter Slash', { pose: 'horizontal', wind: .32, rec: .7, dmg: 14, reach: 3.5, arc: 2.4, w: 1 }),
      E('doom', 'Doom Drop', { pose: 'slam', wind: 1.1, rec: 1.2, dmg: 30, reach: 4.2, kind: 'aoe', unblock: true, aoe: { r: 4.2, at: 'self' }, w: 2 }),
      E('rush', 'Hunting Rush', { pose: 'rush', wind: .7, rec: .9, dmg: 16, reach: 3, kind: 'rush', min: 4, max: 12, w: 2 })] },
};

export const BOSSES: Record<BossId, EnemyDef> = {
  iron: { id: 'iron', name: 'The Iron Executioner', hp: 760, speed: 3.3, radius: 1.35, scale: 2.1, pref: 4.2, armor: 260, guard: false, score: 3000, posture: 100, tokens: 1, boss: true, phases: [1, .5], elem: 'fire',
    rig: { kind: 'ironboss', main: 0x2c2f38, accent: 0xff4020, bulk: 1.3 }, weapon: 'bosscleaver',
    atks: [E('drop', 'Cleaver Drop', { pose: 'overhead', wind: 1.05, rec: 1.2, dmg: 30, reach: 5.2, arc: 1.9, w: 3, heavy: true, posture: 26 }),
      E('sweep', 'Reaping Sweep', { pose: 'horizontal', wind: .95, rec: 1.1, dmg: 24, reach: 5.6, arc: 3.2, w: 3, posture: 20 }),
      E('triple', 'Triple Cut', { pose: 'flurry', wind: .8, rec: 1.2, dmg: 15, reach: 5, arc: 2.4, hits: 3, gap: .55, w: 3, posture: 14 }),
      E('shatter', 'Earthshatter', { pose: 'slam', wind: 1.4, rec: 1.4, dmg: 34, reach: 8, kind: 'aoe', unblock: true, aoe: { r: 8, at: 'self' }, w: 2 }),
      E('charge', 'Iron Charge', { pose: 'rush', wind: 1.0, rec: 1.3, dmg: 30, reach: 3.4, kind: 'rush', unblock: true, min: 6, max: 18, w: 2 }),
      E('wave', 'Hellfire Wave', { pose: 'overhead', wind: 1.0, rec: 1.1, dmg: 26, reach: 20, kind: 'proj', min: 5, max: 20, w: 3, phase: 1, proj: { n: 1, spread: 0, speed: 14, kind: 'wave', elem: 'fire', size: 2.6 } }),
      E('rage', 'Rage Combo', { pose: 'flurry', wind: .7, rec: 1.3, dmg: 14, reach: 5, arc: 2.6, hits: 5, gap: .38, w: 3, phase: 1, posture: 10 })] },
  storm: { id: 'storm', name: 'The Storm Reaper', hp: 680, speed: 5.4, radius: .85, scale: 1.45, pref: 3.4, armor: 140, guard: false, score: 3200, posture: 80, tokens: 1, boss: true, phases: [1, .55], elem: 'lightning', hover: .25,
    rig: { kind: 'stormboss', main: 0x1b2440, accent: 0x5cc8ff }, weapon: 'stormblades',
    atks: [E('flurry', 'Lightning Flurry', { pose: 'flurry', wind: .6, rec: 1.0, dmg: 9, reach: 3.6, arc: 2.6, hits: 5, gap: .3, lunge: 1.3, w: 3 }),
      E('blink', 'Thunder Step', { pose: 'horizontal', wind: .6, rec: .9, dmg: 15, reach: 3.8, arc: 2.6, kind: 'teleport', min: 4, max: 20, w: 3 }),
      E('orbs', 'Thunder Orbs', { pose: 'cast', wind: .8, rec: 1.0, dmg: 12, reach: 20, kind: 'proj', min: 4, max: 20, w: 3, proj: { n: 3, spread: .38, speed: 15, kind: 'orb', elem: 'lightning', size: .45 } }),
      E('rain', 'Bolt Rain', { pose: 'raise', wind: .9, rec: 1.2, dmg: 22, reach: 20, kind: 'rain', unblock: true, min: 0, max: 20, w: 2, aoe: { r: 2.6, at: 'target', n: 6, delay: 1.05 } }),
      E('dive', 'Thunder Dive', { pose: 'rush', wind: .9, rec: 1.2, dmg: 26, reach: 3.2, kind: 'rush', unblock: true, min: 5, max: 18, w: 2, phase: 1 }),
      E('nova', 'Storm Nova', { pose: 'raise', wind: 1.2, rec: 1.3, dmg: 28, reach: 9, kind: 'nova', unblock: true, aoe: { r: 9, at: 'self' }, w: 2, phase: 1 })] },
  titan: { id: 'titan', name: 'The Abyssal Titan', hp: 1100, speed: 2.2, radius: 2.0, scale: 3.3, pref: 6, armor: 450, guard: false, score: 5000, posture: 120, tokens: 1, boss: true, phases: [1, .66, .33], elem: 'void', hover: 1.3,
    rig: { kind: 'titanboss', main: 0x120a24, accent: 0xb04dff, bulk: 1.2 }, weapon: 'none',
    atks: [E('slam', 'Void Slam', { pose: 'overhead', wind: 1.2, rec: 1.3, dmg: 28, reach: 7, arc: 2.4, w: 3, heavy: true, posture: 25 }),
      E('volley', 'Orb Volley', { pose: 'cast', wind: 1.0, rec: 1.2, dmg: 14, reach: 24, kind: 'proj', min: 5, max: 24, w: 3, proj: { n: 3, spread: .35, speed: 12, kind: 'orb', elem: 'void', size: .55 } }),
      E('well', 'Gravity Well', { pose: 'raise', wind: 1.3, rec: 1.3, dmg: 20, reach: 24, kind: 'pull', unblock: true, min: 4, max: 24, w: 2 }),
      E('barrage', 'Arm Barrage', { pose: 'flurry', wind: .9, rec: 1.3, dmg: 13, reach: 7, arc: 2.6, hits: 4, gap: .45, w: 3, phase: 1 }),
      E('rift', 'Rift Eruption', { pose: 'raise', wind: 1.0, rec: 1.3, dmg: 26, reach: 24, kind: 'rain', unblock: true, min: 0, max: 24, w: 2, phase: 1, aoe: { r: 3.2, at: 'target', n: 5, delay: 1.25 } }),
      E('meteor', 'Meteor Rain', { pose: 'raise', wind: 1.1, rec: 1.4, dmg: 24, reach: 24, kind: 'rain', unblock: true, min: 0, max: 24, w: 2, phase: 2, aoe: { r: 2.8, at: 'target', n: 9, delay: 1.2 } }),
      E('beam', 'Dimensional Beam', { pose: 'sweep', wind: 1.5, rec: 1.5, dmg: 36, reach: 22, kind: 'beam', unblock: true, min: 3, max: 24, w: 2, phase: 2 }),
      E('nova', 'Void Nova', { pose: 'slam', wind: 1.4, rec: 1.5, dmg: 30, reach: 12, kind: 'nova', unblock: true, aoe: { r: 11, at: 'self' }, w: 2, phase: 2 })] },
};
export const BOSS_ORDER: BossId[] = ['iron', 'storm', 'titan'];

export const ARENAS: Record<ArenaId, ArenaDef> = {
  citadel: { id: 'citadel', name: 'Crimson Citadel', desc: 'Ruined gothic castle beneath a blood-red moon.', radius: 24, sky: [0x12030a, 0x5a0f1c], fog: 0x1a050b, fogDensity: .018, light: 0xff6a6a, ambient: .5, accent: 0xff2a44, gravity: 1, music: 0 },
  forge: { id: 'forge', name: 'Infernal Forge', desc: 'Volcanic furnace arena. Lava rivers and erupting fire vents.', radius: 22, sky: [0x120300, 0x7a2200], fog: 0x2a0a00, fogDensity: .02, light: 0xff9a40, ambient: .55, accent: 0xff7a1a, gravity: 1, music: 1 },
  sanctuary: { id: 'sanctuary', name: 'Void Sanctuary', desc: 'Floating shrine between dimensions. Low gravity, rift portals.', radius: 21, sky: [0x04010c, 0x2a0a52], fog: 0x12052a, fogDensity: .014, light: 0xb08aff, ambient: .6, accent: 0xa24bff, gravity: .62, music: 2 },
  coliseum: { id: 'coliseum', name: 'Stormfall Coliseum', desc: 'Massive circular battlefield under a thunderstorm. Smashable obelisks.', radius: 26, sky: [0x05080f, 0x25364f], fog: 0x0d1624, fogDensity: .016, light: 0x9ac4ff, ambient: .55, accent: 0x4da8ff, gravity: 1, music: 3 },
};
export const ARENA_ORDER: ArenaId[] = ['citadel', 'forge', 'sanctuary', 'coliseum'];

export const MODES: { id: ModeId; name: string; desc: string; icon: string }[] = [
  { id: 'training', name: 'Training', desc: 'Free practice. Configure dummy behaviour, spawn any enemy, tweak deflect timing.', icon: '🎯' },
  { id: 'survival', name: 'Survival', desc: 'Ten escalating waves of mixed enemies. Survive them all.', icon: '⚔' },
  { id: 'elite', name: 'Elite Challenge', desc: 'Advanced Executioners with feints, counters and unblockables.', icon: '💀' },
  { id: 'boss', name: 'Boss Rush', desc: 'Iron Executioner, Storm Reaper and Abyssal Titan back to back.', icon: '👁' },
  { id: 'mastery', name: 'Weapon Mastery', desc: 'Weapon-specific challenges that unlock cosmetics and combo extensions.', icon: '★' },
  { id: 'endless', name: 'Endless Arena', desc: 'Never-ending, ever-escalating waves. How long can you last?', icon: '∞' },
];

const C = (id: string, label: string, stat: Challenge['stat'], target: number, reward: Challenge['reward'], w: WeaponId): Challenge => {
  const wd = WEAPONS[w];
  return { id: w + id, label, stat, target, reward, rewardLabel: reward === 'skin' ? `Appearance: ${wd.skins[1].name}` : reward === 'combo' ? `Combo extension: ${wd.extra.name}` : `Awakening variant: ${wd.skins[2].name}` };
};
export const CHALLENGES: Record<WeaponId, Challenge[]> = {
  inferno: [C('1', 'Defeat 25 enemies', 'kills', 25, 'skin', 'inferno'), C('2', 'Use 12 special attacks', 'specials', 12, 'combo', 'inferno'), C('3', 'Unleash Hellfire Cataclysm twice', 'ults', 2, 'awaken', 'inferno')],
  thunder: [C('1', 'Reach a 25-hit combo', 'maxCombo', 25, 'skin', 'thunder'), C('2', 'Land 3 perfect deflects in a row', 'chain', 3, 'combo', 'thunder'), C('3', 'Land 30 aerial hits', 'airHits', 30, 'awaken', 'thunder')],
  void: [C('1', 'Use 10 special attacks', 'specials', 10, 'skin', 'void'), C('2', 'Land 6 counterattacks', 'counters', 6, 'combo', 'void'), C('3', 'Defeat 30 enemies', 'kills', 30, 'awaken', 'void')],
  glacier: [C('1', 'Land 10 perfect deflects', 'perfects', 10, 'skin', 'glacier'), C('2', 'Use 12 special attacks', 'specials', 12, 'combo', 'glacier'), C('3', 'Unleash Eternal Winter twice', 'ults', 2, 'awaken', 'glacier')],
  plasma: [C('1', 'Land 15 perfect deflects', 'perfects', 15, 'skin', 'plasma'), C('2', 'Land 8 counterattacks', 'counters', 8, 'combo', 'plasma'), C('3', 'Land 5 perfect deflects in a row', 'chain', 5, 'awaken', 'plasma')],
  titan: [C('1', 'Defeat 20 enemies', 'kills', 20, 'skin', 'titan'), C('2', 'Land 6 counterattacks', 'counters', 6, 'combo', 'titan'), C('3', 'Unleash Worldbreaker twice', 'ults', 2, 'awaken', 'titan')],
};

export const ELEM_COLORS: Record<Elem, [number, number, number]> = {
  fire: [0xffe08a, 0xff4a1a, 0x401005], lightning: [0xffffff, 0x4fa8ff, 0x0a1a40], void: [0xf0d0ff, 0xa24bff, 0x1a0630],
  ice: [0xffffff, 0x7fe8ff, 0x0a2a40], plasma: [0xffffff, 0x27f2ff, 0x043040], earth: [0xfff0b0, 0xffc43d, 0x3a2a08], phys: [0xffffff, 0xffd9a0, 0x403020],
};

export const WAVES: { id: EnemyId; n: number }[][] = [
  [{ id: 'knight', n: 2 }], [{ id: 'knight', n: 2 }, { id: 'assassin', n: 1 }], [{ id: 'knight', n: 2 }, { id: 'hunter', n: 1 }, { id: 'mage', n: 1 }],
  [{ id: 'assassin', n: 2 }, { id: 'brute', n: 1 }, { id: 'knight', n: 1 }], [{ id: 'hunter', n: 2 }, { id: 'mage', n: 2 }, { id: 'knight', n: 2 }],
  [{ id: 'brute', n: 2 }, { id: 'assassin', n: 2 }, { id: 'mage', n: 1 }], [{ id: 'executioner', n: 1 }, { id: 'knight', n: 3 }, { id: 'mage', n: 1 }],
  [{ id: 'hunter', n: 2 }, { id: 'assassin', n: 3 }, { id: 'brute', n: 1 }], [{ id: 'executioner', n: 1 }, { id: 'brute', n: 2 }, { id: 'mage', n: 2 }],
  [{ id: 'executioner', n: 2 }, { id: 'assassin', n: 3 }, { id: 'hunter', n: 2 }, { id: 'brute', n: 1 }],
];
