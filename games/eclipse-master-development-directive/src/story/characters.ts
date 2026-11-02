// Character bible: identity, appearance, personality, goals and abilities.
export interface Personality {
  bravery: number; warmth: number; aggression: number; expressiveness: number; curiosity: number; loyalty: number;
}
export interface CharDef {
  id: string; name: string; role: string; tier: 'principal' | 'extra';
  age: number; height: number; build: number;
  skin: string; eyes: string;
  hair: { style: 'spiky' | 'long' | 'short' | 'elder' | 'bob' | 'helm' | 'crown'; color: string; accent?: string };
  outfit: { style: 'tunic' | 'robe' | 'coat' | 'armor' | 'dress' | 'dark'; primary: string; secondary: string; accent: string };
  weapon: 'none' | 'sword' | 'rapier' | 'staff' | 'greatsword' | 'spear';
  voice: { pitch: number; rate: number; gender: 'm' | 'f' };
  personality: Personality;
  goals: string[];
  backstory: string;
  abilities: string[];
  bearer?: boolean;
}

export const CHARACTERS: CharDef[] = [
  {
    id: 'kael', name: 'Kael Vireon', role: 'Protagonist — Observatory apprentice, the Eclipse Bearer', tier: 'principal',
    age: 17, height: 1.72, build: 0.95, skin: '#f3cfb3', eyes: '#f5b73b',
    hair: { style: 'spiky', color: '#c9d3e6', accent: '#6c7aa8' },
    outfit: { style: 'coat', primary: '#23283f', secondary: '#c9a24a', accent: '#f5b73b' },
    weapon: 'sword', voice: { pitch: 1.12, rate: 1.0, gender: 'm' },
    personality: { bravery: 0.7, warmth: 0.75, aggression: 0.45, expressiveness: 0.85, curiosity: 0.8, loyalty: 0.95 },
    goals: ['Protect Hollow\'s End', 'Understand the mark on his hand', 'Avenge and honour Orrin (Act III)', 'Break the cycle (Act IV)'],
    backstory: 'Orphan raised by Master Orrin in the Hollow\'s End observatory. Born under the last total eclipse; carries the Eclipse mark.',
    abilities: ['eclipse_slash', 'umbral_dash', 'solar_burst'], bearer: true,
  },
  {
    id: 'lyra', name: 'Lyra Ashenvale', role: 'Deuteragonist — cartographer, keeper of the Veil Key', tier: 'principal',
    age: 16, height: 1.60, build: 0.85, skin: '#f6d8c4', eyes: '#4fb7b0',
    hair: { style: 'long', color: '#7b3f9e', accent: '#d58bff' },
    outfit: { style: 'dress', primary: '#2f6f73', secondary: '#e8dcc0', accent: '#d58bff' },
    weapon: 'none', voice: { pitch: 1.3, rate: 1.04, gender: 'f' },
    personality: { bravery: 0.55, warmth: 0.9, aggression: 0.15, expressiveness: 0.9, curiosity: 0.95, loyalty: 0.85 },
    goals: ['Decode the Veil Key', 'Atone for her father\'s secret', 'Keep Kael human'],
    backstory: 'Daughter of the Umbral Order\'s late archivist. Fled with the Veil Key; hides it from everyone.',
    abilities: ['star_bolt'],
  },
  {
    id: 'orrin', name: 'Master Orrin', role: 'Mentor — astronomer and former Order sentinel', tier: 'principal',
    age: 71, height: 1.74, build: 0.9, skin: '#e2bfa0', eyes: '#7aa7d6',
    hair: { style: 'elder', color: '#f0f0f2' },
    outfit: { style: 'robe', primary: '#33477a', secondary: '#d9d2b8', accent: '#8fd0ff' },
    weapon: 'staff', voice: { pitch: 0.7, rate: 0.88, gender: 'm' },
    personality: { bravery: 0.9, warmth: 0.8, aggression: 0.3, expressiveness: 0.55, curiosity: 0.7, loyalty: 1.0 },
    goals: ['Prepare Kael', 'Hide the truth until Kael can bear it', 'Redeem the old Order'],
    backstory: 'Once Malachar\'s closest friend and fellow sentinel. Left the Order when it began to feed on the Bearer\'s power.',
    abilities: ['star_bolt', 'meteor_fall'],
  },
  {
    id: 'seren', name: 'Seren Vael', role: 'Rival — Umbral Order knight, later ally', tier: 'principal',
    age: 20, height: 1.74, build: 0.9, skin: '#e8bfa5', eyes: '#d63a56',
    hair: { style: 'bob', color: '#8e1b2e', accent: '#ff5d73' },
    outfit: { style: 'armor', primary: '#7e1424', secondary: '#2b2b33', accent: '#ff5d73' },
    weapon: 'rapier', voice: { pitch: 1.0, rate: 1.1, gender: 'f' },
    personality: { bravery: 0.9, warmth: 0.35, aggression: 0.8, expressiveness: 0.6, curiosity: 0.4, loyalty: 0.8 },
    goals: ['Capture the Bearer for the Regent', 'Learn whether the Order lied', 'Earn honour (becomes: protect the innocent)'],
    backstory: 'Orphan of a war the Order claimed to end. Believes in order above all — until proof says otherwise.',
    abilities: ['crimson_flurry', 'blade_dance'],
  },
  {
    id: 'malachar', name: 'Regent Malachar', role: 'Antagonist — High Regent of the Umbral Order, the previous Bearer', tier: 'principal',
    age: 912, height: 1.98, build: 1.15, skin: '#b9a7b8', eyes: '#b04dff',
    hair: { style: 'crown', color: '#16101f', accent: '#b04dff' },
    outfit: { style: 'dark', primary: '#16101f', secondary: '#4a2a6b', accent: '#b04dff' },
    weapon: 'greatsword', voice: { pitch: 0.55, rate: 0.85, gender: 'm' },
    personality: { bravery: 1.0, warmth: 0.2, aggression: 0.7, expressiveness: 0.5, curiosity: 0.3, loyalty: 0.4 },
    goals: ['Remain the sun\'s keeper forever', 'Consume the new Bearer', 'Never repeat the Sacrifice'],
    backstory: 'The last Bearer. Refused the sacrifice that renews the sun 900 years ago and has lived off stolen light since.',
    abilities: ['void_spear', 'shadow_wave', 'gravity_crush'], bearer: true,
  },
  {
    id: 'soldier_a', name: 'Umbral Soldier', role: 'Extra — Order infantry', tier: 'extra',
    age: 30, height: 1.78, build: 1.05, skin: '#d8b497', eyes: '#222',
    hair: { style: 'helm', color: '#2b2b33' },
    outfit: { style: 'armor', primary: '#33283f', secondary: '#1a1520', accent: '#b04dff' },
    weapon: 'spear', voice: { pitch: 0.8, rate: 1.0, gender: 'm' },
    personality: { bravery: 0.6, warmth: 0.3, aggression: 0.6, expressiveness: 0.2, curiosity: 0.2, loyalty: 0.7 },
    goals: ['Obey orders'], backstory: 'Conscript of the Umbral Order.', abilities: ['spear_thrust'],
  },
  {
    id: 'soldier_b', name: 'Umbral Soldier', role: 'Extra — Order infantry', tier: 'extra',
    age: 28, height: 1.82, build: 1.1, skin: '#c9a284', eyes: '#222',
    hair: { style: 'helm', color: '#2b2b33' },
    outfit: { style: 'armor', primary: '#33283f', secondary: '#1a1520', accent: '#b04dff' },
    weapon: 'spear', voice: { pitch: 0.85, rate: 1.0, gender: 'm' },
    personality: { bravery: 0.5, warmth: 0.3, aggression: 0.6, expressiveness: 0.2, curiosity: 0.2, loyalty: 0.7 },
    goals: ['Obey orders'], backstory: 'Conscript of the Umbral Order.', abilities: ['spear_thrust'],
  },
  {
    id: 'soldier_c', name: 'Umbral Soldier', role: 'Extra — Order infantry', tier: 'extra',
    age: 26, height: 1.76, build: 1.0, skin: '#e0c0a5', eyes: '#222',
    hair: { style: 'helm', color: '#2b2b33' },
    outfit: { style: 'armor', primary: '#33283f', secondary: '#1a1520', accent: '#b04dff' },
    weapon: 'sword', voice: { pitch: 0.9, rate: 1.0, gender: 'm' },
    personality: { bravery: 0.55, warmth: 0.3, aggression: 0.6, expressiveness: 0.2, curiosity: 0.2, loyalty: 0.7 },
    goals: ['Obey orders'], backstory: 'Conscript of the Umbral Order.', abilities: ['soldier_slash'],
  },
  {
    id: 'soldier_d', name: 'Umbral Captain', role: 'Extra — Order captain', tier: 'extra',
    age: 38, height: 1.86, build: 1.12, skin: '#bf9a7e', eyes: '#222',
    hair: { style: 'helm', color: '#4a2a6b' },
    outfit: { style: 'armor', primary: '#4a2a6b', secondary: '#1a1520', accent: '#ff5d73' },
    weapon: 'sword', voice: { pitch: 0.75, rate: 0.95, gender: 'm' },
    personality: { bravery: 0.8, warmth: 0.2, aggression: 0.8, expressiveness: 0.3, curiosity: 0.2, loyalty: 0.8 },
    goals: ['Hold the Citadel'], backstory: 'Veteran captain of the Citadel garrison.', abilities: ['soldier_slash', 'spear_thrust'],
  },
  {
    id: 'villager_a', name: 'Maren (villager)', role: 'Extra — baker of Hollow\'s End', tier: 'extra',
    age: 45, height: 1.62, build: 1.1, skin: '#e5c2a2', eyes: '#6b4a2a',
    hair: { style: 'bob', color: '#6b4a2a' },
    outfit: { style: 'dress', primary: '#8a5a3c', secondary: '#e8dcc0', accent: '#c9a24a' },
    weapon: 'none', voice: { pitch: 1.15, rate: 1.0, gender: 'f' },
    personality: { bravery: 0.3, warmth: 0.8, aggression: 0.1, expressiveness: 0.8, curiosity: 0.5, loyalty: 0.6 },
    goals: ['Keep the village calm'], backstory: 'Baker; fed Kael as a child.', abilities: [],
  },
  {
    id: 'villager_b', name: 'Toma (villager)', role: 'Extra — farmer of Hollow\'s End', tier: 'extra',
    age: 52, height: 1.75, build: 1.05, skin: '#d6ae8c', eyes: '#3a3a3a',
    hair: { style: 'short', color: '#7a6a55' },
    outfit: { style: 'tunic', primary: '#5e6b3a', secondary: '#8a7048', accent: '#c9a24a' },
    weapon: 'none', voice: { pitch: 0.85, rate: 0.95, gender: 'm' },
    personality: { bravery: 0.4, warmth: 0.6, aggression: 0.2, expressiveness: 0.5, curiosity: 0.4, loyalty: 0.6 },
    goals: ['Protect the harvest'], backstory: 'Farmer who distrusts omens.', abilities: [],
  },
];

export const CHAR_MAP: Record<string, CharDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
