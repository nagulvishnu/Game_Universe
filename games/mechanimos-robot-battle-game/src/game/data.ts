import type { CardDef, CardId, SpeciesDef, SpeciesId } from './types';

export const CARDS: Record<CardId, CardDef> = {
  ram: {
    id: 'ram', name: 'TURBO RAM', kind: 'attack', power: 18,
    desc: 'Full-throttle body slam. Reliable, never misses.',
    tag: '18 DMG', color: '#ffa62b', glow: 'rgba(255,166,43,.5)',
  },
  punch: {
    id: 'punch', name: 'ROCKET PUNCH', kind: 'attack', power: 26,
    desc: 'Detachable fist missile. Huge damage, 20% whiff chance.',
    tag: '26 DMG · 80% ACC', color: '#ff5470', glow: 'rgba(255,84,112,.5)',
  },
  flame: {
    id: 'flame', name: 'FLAME EXHAUST', kind: 'attack', power: 12,
    desc: 'Scorching exhaust jet. Burns for 6 DMG over 2 turns.',
    tag: '12 DMG · BURN', color: '#fb923c', glow: 'rgba(251,146,60,.5)',
  },
  volt: {
    id: 'volt', name: 'VOLT LASH', kind: 'attack', power: 10,
    desc: 'Crackling arc whip. 45% chance to stun for a turn.',
    tag: '10 DMG · STUN 45%', color: '#22d3ee', glow: 'rgba(34,211,238,.5)',
  },
  aegis: {
    id: 'aegis', name: 'AEGIS BARRIER', kind: 'defense', power: 0,
    desc: 'Hardlight shield. Blocks 75% of the next hit, restores 6 HP.',
    tag: 'BLOCK 75% · +6 HP', color: '#60a5fa', glow: 'rgba(96,165,250,.5)',
  },
  nanite: {
    id: 'nanite', name: 'NANITE REPAIR', kind: 'heal', power: 24,
    desc: 'Swarm of repair nanites. Restores 24 HP on the spot.',
    tag: '+24 HP', color: '#4ade80', glow: 'rgba(74,222,128,.5)',
  },
};

export const CARD_IDS: CardId[] = ['ram', 'punch', 'flame', 'volt', 'aegis', 'nanite'];

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  blaze: {
    id: 'blaze', name: 'BLAZE', sub: 'Pyro Sprinter',
    body: '#ff8a1e', dark: '#8a3c08', accent: '#ffd166', glass: '#7ef2ff',
    hp: 100, atk: 1.0, trait: 'fury', traitDesc: '+15% damage on every hit',
    rarity: 1, crest: 'fin',
  },
  voltox: {
    id: 'voltox', name: 'VOLTOX', sub: 'Storm Buggy',
    body: '#22d3ee', dark: '#0e5d6e', accent: '#eafcff', glass: '#d9fbff',
    hp: 88, atk: 1.05, trait: 'static', traitDesc: '20% chance to stun on hit',
    rarity: 2, crest: 'spike',
  },
  terradon: {
    id: 'terradon', name: 'TERRADON', sub: 'Bulwark Hauler',
    body: '#4ade80', dark: '#14532d', accent: '#d9f99d', glass: '#bef264',
    hp: 124, atk: 0.92, trait: 'plating', traitDesc: 'Takes 15% less damage',
    rarity: 2, crest: 'horns',
  },
  nimbra: {
    id: 'nimbra', name: 'NIMBRA', sub: 'Shadow Coupe',
    body: '#a855f7', dark: '#4c1d95', accent: '#f0abfc', glass: '#e9d5ff',
    hp: 92, atk: 1.0, trait: 'phase', traitDesc: '16% chance to dodge any hit',
    rarity: 2, crest: 'blade',
  },
  ferrion: {
    id: 'ferrion', name: 'FERRION', sub: 'Apex Muscle',
    body: '#ef4444', dark: '#7f1d1d', accent: '#fda4af', glass: '#fecdd3',
    hp: 104, atk: 1.06, trait: 'crit', traitDesc: '22% chance of 2x critical hits',
    rarity: 3, crest: 'disc',
  },
  aquella: {
    id: 'aquella', name: 'AQUELLA', sub: 'Tide Glider',
    body: '#3b82f6', dark: '#1e3a8a', accent: '#7dd3fc', glass: '#bae6fd',
    hp: 108, atk: 0.96, trait: 'regen', traitDesc: 'Regenerates 4 HP each turn',
    rarity: 3, crest: 'rings',
  },
};

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

export const TRAINER_NAMES = ['VEX', 'JUNO', 'KOBB', 'MIRA', 'DAX', 'LYNX'];

export function wildSpeciesPool(wins: number): SpeciesId[] {
  // rarer species appear as you win more
  const pool: SpeciesId[] = ['blaze', 'voltox', 'terradon', 'nimbra'];
  if (wins >= 2) pool.push('ferrion', 'aquella', 'voltox', 'nimbra');
  if (wins >= 5) pool.push('ferrion', 'aquella');
  return pool;
}
