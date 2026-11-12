import type { Cfg } from './models';

export const LORD_CFG: Cfg = {
  skin: '#9a7a86', armor: '#14090e', trim: '#d4143c', cloth: '#2a0a14', glow: '#ff2040', horns: 'demon', hornColor: '#0e0709', cape: true, capeColor: '#5a0a1e', hair: 'long', hairColor: '#0a0608',
  royal: true, wings: 'demon', formWings: true, wingColor: '#4a0a1a', rings: true, weapon: 'sword',
};
export const ARMOR_SETS = [{ armor: '#14090e', trim: '#d4143c' }, { armor: '#0f0b1c', trim: '#8a4bff' }, { armor: '#d9cfae', trim: '#e0a82a' }];

export const COMMANDER_VIS: Record<string, Cfg & { scale?: number }> = {
  abyssal_king: { scale: 1.7, bulk: 1.4, skin: '#2a6aa0', armor: '#0a2a4a', trim: '#53b0ff', cloth: '#0a1a3a', glow: '#7affff', horns: 'crown', hornColor: '#7affff', weapon: 'spear', cape: true, capeColor: '#0a3a7a', helm: 'crest' },
  leviathan: { scale: 2.8, bulk: 2.2, skin: '#1a8a7a', armor: '#0a3a38', trim: '#19e0c0', cloth: '#06201e', glow: '#aaffee', horns: 'long', hornColor: '#19e0c0', weapon: 'none', tail: true, hair: 'long', hairColor: '#0a5a50' },
  tidal_queen: { scale: 1.3, skin: '#7ac8e0', armor: '#1a6a8a', trim: '#a8f0ff', cloth: '#0a4a6a', glow: '#e0ffff', horns: 'crown', hornColor: '#a8f0ff', hair: 'long', hairColor: '#53e0ff', weapon: 'staff', cape: true, capeColor: '#2a9ac0', tail: true },
  kraken: { scale: 2.4, bulk: 2.0, skin: '#7a3a9a', armor: '#2a0a3a', trim: '#e08aff', cloth: '#1a0628', glow: '#ffb0ff', horns: 'ram', hornColor: '#e8c0ff', weapon: 'none', tail: true, hair: 'long', hairColor: '#c24bff' },
  deepwarden: { scale: 2.0, bulk: 1.8, skin: '#6a7a88', armor: '#4a5a68', trim: '#c8d8e8', cloth: '#1a2a38', glow: '#aaddff', horns: 'none', helm: 'knight', weapon: 'greatsword', shield: true },
};
