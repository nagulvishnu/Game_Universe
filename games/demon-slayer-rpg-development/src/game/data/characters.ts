import type { CharDef, Look } from '../types';

const L = (o: Partial<Look> & Pick<Look, 'skin' | 'hair' | 'hairStyle' | 'eye' | 'outfit' | 'pants'>): Look =>
  ({ scale: 1, extras: [], pattern: 'none', ...o });

export const CHARACTERS: CharDef[] = [
  {
    id: 'tanjiro', name: 'Tanjiro Kamado', title: 'The Kind-Hearted Charcoal Seller', style: 'water', role: 'Balanced Swordsman',
    desc: 'A gentle boy turned Demon Slayer to cure his sister. Water Breathing flows into Hinokami Kagura as his resolve grows.',
    quote: 'I will protect everyone. No matter what.',
    stats: { hp: 120, sta: 100, atk: 15, def: 5, spd: 1, breath: 100, crit: 8 }, atkSpeed: 1, reach: 1,
    unlock: { type: 'start' }, weapon: 'Black Nichirin Blade', bladeColor: 0x16161e,
    look: L({ skin: 0xf2c4a0, hair: 0x4a1d1d, hairStyle: 'spiky', eye: 0xa83232, outfit: 0x1c1c24, pants: 0x1c1c24, haori: 0x1f7a45, haori2: 0x101010, pattern: 'checker', extras: ['scar', 'earrings'], sash: 0xf0f0f0 }),
    forms: ['water0', 'water1', 'water2', 'water3', 'water4', 'water5'], extraForms: ['sun0', 'sun1', 'sun2', 'sun3', 'sun4', 'sun5'],
    special: 'water6', specialAlt: { id: 'sun6', chapter: 5 }, ult: 'water7', ult2: { id: 'sun7', chapter: 5 },
  },
  {
    id: 'zenitsu', name: 'Zenitsu Agatsuma', title: 'The Sleeping Thunder', style: 'thunder', role: 'Speed Striker',
    desc: 'A cowardly boy with godlike speed. One technique, honed to perfection: Thunderclap and Flash.',
    quote: 'Once I start dreaming, nothing can stop me.',
    stats: { hp: 92, sta: 110, atk: 14, def: 3, spd: 1.18, breath: 90, crit: 14 }, atkSpeed: 1.28, reach: 0.95,
    unlock: { type: 'chapter', chapter: 4 }, weapon: 'Thunder Nichirin Blade', bladeColor: 0xffd23a,
    look: L({ skin: 0xf5cfa8, hair: 0xffc42a, tip: 0xff8a1a, hairStyle: 'short', eye: 0xd88a20, outfit: 0x1c1c24, pants: 0x1c1c24, haori: 0xf4c430, haori2: 0xffffff, pattern: 'triangle', sash: 0xf0f0f0 }),
    forms: ['thunder0', 'thunder1', 'thunder2', 'thunder3', 'thunder4', 'thunder5'], special: 'thunder6', ult: 'thunder7',
  },
  {
    id: 'inosuke', name: 'Inosuke Hashibira', title: 'King of the Mountain', style: 'beast', role: 'Dual-Blade Berserker',
    desc: 'Raised by boars, he fights with two serrated blades and razor-sharp spatial awareness.',
    quote: 'Rush in! Rush in! Rush in!',
    stats: { hp: 135, sta: 105, atk: 16, def: 4, spd: 1.08, breath: 95, crit: 12 }, atkSpeed: 1.12, reach: 0.95,
    unlock: { type: 'chapter', chapter: 4 }, weapon: 'Twin Serrated Blades', bladeColor: 0x8a919c, dual: true,
    look: L({ skin: 0xe6b48e, hair: 0x1a1a1e, hairStyle: 'wild', eye: 0x4a9a30, outfit: 0xe6b48e, pants: 0x2b4a8a, extras: ['boarmask', 'fur', 'bare'] }),
    forms: ['beast0', 'beast1', 'beast2', 'beast3', 'beast4', 'beast5'], special: 'beast6', ult: 'beast7',
  },
  {
    id: 'giyu', name: 'Giyu Tomioka', title: 'Water Hashira', style: 'water', role: 'Calm Duelist',
    desc: 'The stoic Water Hashira. Elegant, efficient and relentless in the Eleventh Form of calm.',
    quote: 'Calm your heart. Then cut.',
    stats: { hp: 140, sta: 105, atk: 18, def: 8, spd: 1.04, breath: 110, crit: 10 }, atkSpeed: 1.05, reach: 1.05,
    unlock: { type: 'trial', trial: 'trial_giyu', chapter: 2 }, weapon: 'Deep-Blue Nichirin Blade', bladeColor: 0x2c6fd6,
    look: L({ skin: 0xf2c8a8, hair: 0x14141c, hairStyle: 'pony', eye: 0x2a3a9a, outfit: 0x1c1c24, pants: 0x1c1c24, haori: 0xb83a3a, haori2: 0x2e8b57, pattern: 'half', sash: 0xf0f0f0, scale: 1.04 }),
    forms: ['water0', 'water1', 'water2', 'water3', 'water4', 'water5'], special: 'water6', ult: 'water7',
  },
  {
    id: 'rengoku', name: 'Kyojuro Rengoku', title: 'Flame Hashira', style: 'flame', role: 'Heavy Hitter',
    desc: 'The burning heart of the Corps. Powerful flame techniques and unshakable will.',
    quote: 'Set your heart ablaze!',
    stats: { hp: 160, sta: 100, atk: 21, def: 7, spd: 1.02, breath: 100, crit: 12 }, atkSpeed: 0.98, reach: 1.1,
    unlock: { type: 'chapter', chapter: 7 }, weapon: 'Flame Nichirin Blade', bladeColor: 0xff5a1a,
    look: L({ skin: 0xf2c8a8, hair: 0xffc22e, tip: 0xd8262a, hairStyle: 'flame', eye: 0xe8a020, outfit: 0x1c1c24, pants: 0x1c1c24, haori: 0xf7f2e0, haori2: 0xe03a1a, pattern: 'flame', scale: 1.06 }),
    forms: ['flame0', 'flame1', 'flame2', 'flame3', 'flame4', 'flame5'], special: 'flame6', ult: 'flame7',
  },
  {
    id: 'shinobu', name: 'Shinobu Kocho', title: 'Insect Hashira', style: 'insect', role: 'Poison Assassin',
    desc: 'Cannot sever necks, so she masters precision and wisteria poison.',
    quote: 'Smile. It makes the poison work better.',
    stats: { hp: 88, sta: 115, atk: 13, def: 3, spd: 1.2, breath: 105, crit: 20 }, atkSpeed: 1.3, reach: 0.9,
    unlock: { type: 'trial', trial: 'trial_shinobu', chapter: 4 }, weapon: 'Wisteria Needle Blade', bladeColor: 0xb36bff,
    look: L({ skin: 0xf8d8c4, hair: 0x1a1020, tip: 0x9b4dff, hairStyle: 'short', eye: 0xb36bff, outfit: 0x1c1c24, pants: 0x1c1c24, haori: 0xf8f8f8, haori2: 0x8a4dd0, pattern: 'butterfly', extras: ['butterflyclip'], scale: 0.9 }),
    forms: ['insect0', 'insect1', 'insect2', 'insect3', 'insect4', 'insect5'], special: 'insect6', ult: 'insect7',
  },
  {
    id: 'tengen', name: 'Tengen Uzui', title: 'Sound Hashira', style: 'sound', role: 'Flashy Dual-Wielder',
    desc: 'A former shinobi with huge cleavers and explosive, rhythmic combat.',
    quote: 'Flashy! That is the only way to fight.',
    stats: { hp: 150, sta: 100, atk: 19, def: 7, spd: 1.06, breath: 95, crit: 14 }, atkSpeed: 1.08, reach: 1.1,
    unlock: { type: 'chapter', chapter: 8 }, weapon: 'Twin Flashy Cleavers', bladeColor: 0xff3d6e, dual: true,
    look: L({ skin: 0xf2c8a8, hair: 0xf0f0f5, hairStyle: 'spiky', eye: 0xc03050, outfit: 0x2a2a34, pants: 0x2a2a34, extras: ['headband', 'jewel'], scale: 1.18 }),
    forms: ['sound0', 'sound1', 'sound2', 'sound3', 'sound4', 'sound5'], special: 'sound6', ult: 'sound7',
  },
  {
    id: 'muichiro', name: 'Muichiro Tokito', title: 'Mist Hashira', style: 'mist', role: 'Elusive Prodigy',
    desc: 'A genius swordsman who vanishes into drifting mist.',
    quote: 'Does it matter? Cut first.',
    stats: { hp: 100, sta: 112, atk: 17, def: 4, spd: 1.16, breath: 105, crit: 16 }, atkSpeed: 1.2, reach: 1.0,
    unlock: { type: 'chapter', chapter: 9 }, weapon: 'Mist Nichirin Blade', bladeColor: 0x9fe8f0,
    look: L({ skin: 0xf4d8bc, hair: 0x1a1c2c, tip: 0x7fd8e0, hairStyle: 'long', eye: 0x7fd8e0, outfit: 0x1c1c24, pants: 0x1c1c24, haori: 0xf4f4f8, haori2: 0x6fc8d8, pattern: 'plain', scale: 0.93 }),
    forms: ['mist0', 'mist1', 'mist2', 'mist3', 'mist4', 'mist5'], special: 'mist6', ult: 'mist7',
  },
  {
    id: 'mitsuri', name: 'Mitsuri Kanroji', title: 'Love Hashira', style: 'love', role: 'Flexible Whip-Blade',
    desc: 'Inhuman strength, a ribbon-like blade and whirlwind agility.',
    quote: 'I want to protect everyone with all my heart!',
    stats: { hp: 125, sta: 115, atk: 17, def: 5, spd: 1.12, breath: 105, crit: 10 }, atkSpeed: 1.15, reach: 1.25,
    unlock: { type: 'chapter', chapter: 9 }, weapon: 'Whip-Blade', bladeColor: 0xff7eb6,
    look: L({ skin: 0xffe2d0, hair: 0xff8fc0, tip: 0x8ee06a, hairStyle: 'long', eye: 0x6fd07a, outfit: 0xf8f4ee, pants: 0x1c1c24, haori: 0xf5f0e8, haori2: 0x2e8b57, pattern: 'plain', scale: 1.0 }),
    forms: ['love0', 'love1', 'love2', 'love3', 'love4', 'love5'], special: 'love6', ult: 'love7',
  },
  {
    id: 'sanemi', name: 'Sanemi Shinazugawa', title: 'Wind Hashira', style: 'wind', role: 'Aggressive Brawler',
    desc: 'A scarred, ferocious Hashira whose gale-force slashes shred demons.',
    quote: 'Come at me!',
    stats: { hp: 145, sta: 100, atk: 20, def: 5, spd: 1.1, breath: 95, crit: 18 }, atkSpeed: 1.12, reach: 1.0,
    unlock: { type: 'trial', trial: 'trial_sanemi', chapter: 7 }, weapon: 'Jade Wind Blade', bladeColor: 0x7ff2c0,
    look: L({ skin: 0xe8c0a0, hair: 0xf0f0f6, hairStyle: 'wild', eye: 0x8a4dd0, outfit: 0xe8c0a0, pants: 0x1c1c24, haori: 0xf0f0f0, haori2: 0x2a2a30, pattern: 'plain', extras: ['scars', 'bare'] }),
    forms: ['wind0', 'wind1', 'wind2', 'wind3', 'wind4', 'wind5'], special: 'wind6', ult: 'wind7',
  },
  {
    id: 'gyomei', name: 'Gyomei Himejima', title: 'Stone Hashira', style: 'stone', role: 'Unstoppable Tank',
    desc: 'The strongest Hashira. A towering, blind monk with a spiked flail and axe.',
    quote: 'Namu Amida Butsu.',
    stats: { hp: 210, sta: 95, atk: 24, def: 12, spd: 0.92, breath: 90, crit: 8 }, atkSpeed: 0.82, reach: 1.25,
    unlock: { type: 'trial', trial: 'trial_gyomei', chapter: 8 }, weapon: 'Spiked Flail & Axe', bladeColor: 0x9b7f4a,
    look: L({ skin: 0xe0b898, hair: 0x101014, hairStyle: 'short', eye: 0xdddddd, outfit: 0x4a3a30, pants: 0x2a2a30, haori: 0xe8e0d0, haori2: 0x7a5a30, pattern: 'plain', extras: ['beads'], scale: 1.4 }),
    forms: ['stone0', 'stone1', 'stone2', 'stone3', 'stone4', 'stone5'], special: 'stone6', ult: 'stone7',
  },
  {
    id: 'obanai', name: 'Obanai Iguro', title: 'Serpent Hashira', style: 'serpent', role: 'Winding Assassin',
    desc: 'Cold, precise, and accompanied by his serpent Kaburamaru.',
    quote: 'I will cut where there is no guard.',
    stats: { hp: 105, sta: 110, atk: 17, def: 4, spd: 1.12, breath: 105, crit: 18 }, atkSpeed: 1.18, reach: 1.1,
    unlock: { type: 'trial', trial: 'trial_obanai', chapter: 6 }, weapon: 'Serpent Blade', bladeColor: 0xa6ff6a,
    look: L({ skin: 0xf0d2ba, hair: 0x14141c, hairStyle: 'short', eye: 0x5aa83a, outfit: 0x1c1c24, pants: 0x1c1c24, haori: 0xf0f0f0, haori2: 0x181818, pattern: 'half', extras: ['bandage', 'snake'], scale: 0.98 }),
    forms: ['serpent0', 'serpent1', 'serpent2', 'serpent3', 'serpent4', 'serpent5'], special: 'serpent6', ult: 'serpent7',
  },
];

export const CHAR_BY_ID: Record<string, CharDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export const NPC_LOOKS: Record<string, Look> = {
  urokodaki: L({ skin: 0xe8c0a0, hair: 0xd8d8e0, hairStyle: 'long', eye: 0x333333, outfit: 0x2a4a6a, pants: 0x2a4a6a, haori: 0x2e5a8a, pattern: 'plain', extras: ['tengu', 'old'], scale: 1.15 }),
  villager: L({ skin: 0xf0c8a4, hair: 0x2a2018, hairStyle: 'short', eye: 0x332222, outfit: 0x8a6a4a, pants: 0x5a4a3a, scale: 1 }),
  merchant: L({ skin: 0xf0c8a4, hair: 0x555555, hairStyle: 'short', eye: 0x332222, outfit: 0x3a7a5a, pants: 0x3a3a3a, haori: 0xc8a050, pattern: 'plain', scale: 0.98 }),
  smith: L({ skin: 0xe6b894, hair: 0x2a1a10, hairStyle: 'short', eye: 0x332222, outfit: 0x3a4a6a, pants: 0x2a2a3a, extras: ['hyottoko'], scale: 1.1 }),
  child: L({ skin: 0xf4d0b0, hair: 0x2a2018, hairStyle: 'bob', eye: 0x332222, outfit: 0xc86a6a, pants: 0x5a4a3a, scale: 0.7 }),
  tamayo: L({ skin: 0xf6e0d0, hair: 0x14141c, hairStyle: 'long', eye: 0xb040a0, outfit: 0x8a3a8a, pants: 0x4a2a4a, scale: 0.98 }),
  muzan: L({ skin: 0xf0e8e8, hair: 0x14141c, hairStyle: 'short', eye: 0xff2a3a, outfit: 0xe8e8ec, pants: 0x22222a, haori: 0x1a1a22, pattern: 'plain', extras: ['hat'], demon: true, scale: 1.1 }),
  nezuko: L({ skin: 0xf8dccc, hair: 0x14141c, tip: 0xff6a3a, hairStyle: 'long', eye: 0xff5a8a, outfit: 0xe86a8a, pants: 0xe86a8a, haori: 0x2a2a30, haori2: 0xff9a9a, pattern: 'checker', extras: ['bamboo', 'bow'], scale: 0.82 }),
  crow: L({ skin: 0x111118, hair: 0x111118, hairStyle: 'none', eye: 0xff9a20, outfit: 0x111118, pants: 0x111118, scale: 0.3 }),
};

export interface PassiveDef { id: string; name: string; desc: string; max: number; per: number }
export const PASSIVES: PassiveDef[] = [
  { id: 'vit', name: 'Vitality', desc: '+8% max health per rank', max: 5, per: 0.08 },
  { id: 'end', name: 'Endurance', desc: '+8% stamina & regen per rank', max: 5, per: 0.08 },
  { id: 'might', name: 'Might', desc: '+6% attack per rank', max: 5, per: 0.06 },
  { id: 'res', name: 'Resolve', desc: '+8% defense per rank', max: 5, per: 0.08 },
  { id: 'swift', name: 'Swiftness', desc: '+3% move speed per rank', max: 5, per: 0.03 },
  { id: 'breath', name: 'Breath Efficiency', desc: '-6% breath cost, faster regen per rank', max: 5, per: 0.06 },
  { id: 'crit', name: 'Killing Instinct', desc: '+12% critical damage per rank', max: 5, per: 0.12 },
];

export const RANKS = [
  { name: 'Mizunoto', jp: '水', cp: 0 }, { name: 'Mizunoe', jp: '壬', cp: 120 }, { name: 'Kanoto', jp: '辛', cp: 300 },
  { name: 'Kanoe', jp: '庚', cp: 550 }, { name: 'Tsuchinoto', jp: '己', cp: 850 }, { name: 'Tsuchinoe', jp: '戊', cp: 1250 },
  { name: 'Hinoto', jp: '丁', cp: 1750 }, { name: 'Hinoe', jp: '丙', cp: 2350 }, { name: 'Kinoto', jp: '乙', cp: 3100 },
  { name: 'Kinoe', jp: '甲', cp: 4000 },
];
export const rankIndex = (cp: number) => { let r = 0; RANKS.forEach((x, i) => { if (cp >= x.cp) r = i; }); return r; };
