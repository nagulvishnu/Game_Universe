export type HairStyle = 'spiky' | 'swept' | 'long' | 'ponytail' | 'bob' | 'flame' | 'mohawk';
export type Accessory = 'none' | 'scarf' | 'visor' | 'headband' | 'mask' | 'headset';

export interface Look {
  skin: string; hair: string; hairStyle: HairStyle; eye: string;
  top: string; bottom: string; accent: string; vest: string; glove: string; boots: string;
  accessory: Accessory; glow: string | null;
}

export interface CharacterDef {
  id: string; name: string; title: string; desc: string; outfit: string; personality: string;
  look: Look;
  skins: { name: string; look: Partial<Look> }[];
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'akira', name: 'AKIRA', title: 'The Balanced Fighter', personality: 'Calm, determined, never backs down.',
    desc: 'A modern anime hero in a tactical combat outfit. Reliable in every situation.', outfit: 'Urban Tactical',
    look: { skin: '#f6d2b0', hair: '#14141c', hairStyle: 'spiky', eye: '#3a7bff', top: '#2d3748', bottom: '#1f2733', accent: '#e53e3e', vest: '#3c4658', glove: '#171923', boots: '#171923', accessory: 'scarf', glow: null },
    skins: [{ name: 'Urban Tactical', look: {} }, { name: 'Crimson Operative', look: { top: '#5a1f2a', accent: '#f6ad55', vest: '#2d3748' } }],
  },
  {
    id: 'shadow', name: 'SHADOW', title: 'The Phantom', personality: 'Silent, mysterious, always one step ahead.',
    desc: 'A dark-themed operative in a black and violet suit with a hidden gaze.', outfit: 'Violet Phantom',
    look: { skin: '#e9cdb9', hair: '#2b1b4d', hairStyle: 'long', eye: '#c084fc', top: '#15121f', bottom: '#15121f', accent: '#9f5cff', vest: '#251a3d', glove: '#0c0a14', boots: '#0c0a14', accessory: 'mask', glow: '#a855f7' },
    skins: [{ name: 'Violet Phantom', look: {} }, { name: 'Midnight Teal', look: { accent: '#2dd4bf', glow: '#2dd4bf', eye: '#5eead4', hair: '#10303a' } }],
  },
  {
    id: 'blaze', name: 'BLAZE', title: 'The Aggressor', personality: 'Loud, fearless, fights at point blank.',
    desc: 'An energetic brawler in red and orange who lives for the frontline.', outfit: 'Inferno Rush',
    look: { skin: '#f3c9a1', hair: '#f26a1b', hairStyle: 'flame', eye: '#ffcb2e', top: '#c53030', bottom: '#3b2a24', accent: '#ffb02e', vest: '#9b2c2c', glove: '#2d1b14', boots: '#2d1b14', accessory: 'headband', glow: null },
    skins: [{ name: 'Inferno Rush', look: {} }, { name: 'Golden Blaze', look: { top: '#b7791f', accent: '#fff3b0', hair: '#ffd23f', vest: '#744210' } }],
  },
  {
    id: 'nova', name: 'NOVA', title: 'The Tactician', personality: 'Analytical, composed, reads the battlefield.',
    desc: 'A futuristic strategist in white and blue with a visor and tactical gear.', outfit: 'Cyber Frost',
    look: { skin: '#f9ddc4', hair: '#cfe8ff', hairStyle: 'bob', eye: '#22d3ee', top: '#e8f1fb', bottom: '#2b6cb0', accent: '#38bdf8', vest: '#bcd7f0', glove: '#2b6cb0', boots: '#e8f1fb', accessory: 'visor', glow: '#38bdf8' },
    skins: [{ name: 'Cyber Frost', look: {} }, { name: 'Solar Flare', look: { bottom: '#c05621', accent: '#fbd38d', glow: '#fbd38d', hair: '#ffe2b8' } }],
  },
];

const HAIRS: HairStyle[] = ['spiky', 'swept', 'long', 'ponytail', 'bob', 'flame', 'mohawk'];
const ACCS: Accessory[] = ['none', 'scarf', 'visor', 'headband', 'mask', 'headset'];
const HAIR_COLORS = ['#14141c', '#5b3a29', '#e2b84a', '#e53e3e', '#3b82f6', '#9f7aea', '#f7fafc', '#2f855a', '#ed64a6', '#ed8936'];
const OUTFITS: [string, string, string][] = [
  ['#2d3748', '#1f2733', '#e53e3e'], ['#2f4f3a', '#2a3a2c', '#f6e05e'], ['#6b4a2f', '#3c2f25', '#fbd38d'],
  ['#2b4c7e', '#1d2f4d', '#63b3ed'], ['#553c9a', '#2d2250', '#f687b3'], ['#3c4658', '#262d3a', '#68d391'],
  ['#8a3b3b', '#3a2224', '#fc8181'], ['#d6d3c9', '#59616e', '#4fd1c5'],
];
const SKINS = ['#f6d2b0', '#e9cdb9', '#f3c9a1', '#d9a981', '#b9835a', '#f9ddc4'];
const EYES = ['#3a7bff', '#22d3ee', '#ffcb2e', '#68d391', '#f56565', '#b794f4', '#ed8936'];

export function botLook(r: () => number): Look {
  const o = OUTFITS[Math.floor(r() * OUTFITS.length)];
  const p = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  return {
    skin: p(SKINS), hair: p(HAIR_COLORS), hairStyle: p(HAIRS), eye: p(EYES), top: o[0], bottom: o[1], accent: o[2],
    vest: o[0], glove: '#171923', boots: '#171923', accessory: p(ACCS), glow: null,
  };
}

export function lookFor(charId: string, skinIdx: number): Look {
  const c = CHARACTERS.find((x) => x.id === charId) ?? CHARACTERS[0];
  return { ...c.look, ...(c.skins[skinIdx]?.look ?? {}) };
}

const A = ['Kai', 'Rin', 'Ryu', 'Sora', 'Hana', 'Yuki', 'Ren', 'Mika', 'Taro', 'Aoi', 'Daichi', 'Emi', 'Haru', 'Jin', 'Kenji', 'Luna', 'Miko', 'Nao', 'Reo', 'Saki', 'Toma', 'Yuna', 'Zane', 'Iris', 'Orin'];
const B = ['Storm', 'Fang', 'Hawk', 'Wolf', 'Ghost', 'Viper', 'Blade', 'Comet', 'Raven', 'Drift', 'Spark', 'Titan', 'Echo', 'Falcon', 'Nyx', 'Onyx', 'Pulse', 'Rogue', 'Zephyr', 'Ember'];
export function botName(r: () => number, used: Set<string>) {
  for (let i = 0; i < 30; i++) {
    const n = A[Math.floor(r() * A.length)] + (r() < 0.5 ? '_' : '') + B[Math.floor(r() * B.length)] + (r() < 0.3 ? Math.floor(r() * 99) : '');
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = 'Bot' + used.size; used.add(n); return n;
}
