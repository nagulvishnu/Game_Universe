export type HeroId = "kairo" | "ryujin";
export interface AbilityDef {
  key: string;
  name: string;
  cost: number;
  cd: number;
  desc: string;
  icon: string;
}
export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  color: string;
  color2: string;
  desc: string;
  style: string;
  maxHp: number;
  maxEn: number;
  abilities: AbilityDef[];
}

export const HERO: Record<HeroId, HeroDef> = {
  kairo: {
    id: "kairo",
    name: "KAIRO",
    title: "The Flame Awakened",
    color: "#ff6a1a",
    color2: "#ffd23f",
    desc: "Confident, energetic and utterly fearless. Kairo burns hotter the harder the fight gets — a fast, aggressive brawler who lives in the enemy's face and ends fights with explosions.",
    style: "Close-to-mid range · Fast · Explosive area damage",
    maxHp: 1000,
    maxEn: 100,
    abilities: [
      { key: "E", name: "Homing Fireball", cost: 15, cd: 1.6, icon: "fireball", desc: "Launch a fireball that tracks nearby enemies, follows their movement and explodes on impact." },
      { key: "R", name: "Inferno Burst", cost: 30, cd: 7, icon: "burst", desc: "A forward-facing fire explosion that damages several enemies and knocks them back." },
      { key: "F", name: "Meteor Strike", cost: 40, cd: 14, icon: "meteor", desc: "Call a burning meteor from the sky onto the targeted area for massive area damage." },
      { key: "Q", name: "Flame Dash", cost: 20, cd: 4, icon: "dash", desc: "Dash forward wrapped in flame, burning everything along the path." },
      { key: "X", name: "Solar Apocalypse", cost: 0, cd: 0, icon: "sun", desc: "ULTIMATE — Charge a miniature sun and detonate it in a gigantic fiery explosion across a wide area." },
    ],
  },
  ryujin: {
    id: "ryujin",
    name: "RYUJIN",
    title: "The Shadow Emperor",
    color: "#8a5cff",
    color2: "#3fd0ff",
    desc: "Calm, mysterious and terrifyingly powerful. Ryujin commands darkness itself — teleporting through the battlefield, raising an army of shadows and extracting the souls of the fallen.",
    style: "Mid-to-long range · Tricky · Summoner",
    maxHp: 1000,
    maxEn: 100,
    abilities: [
      { key: "E", name: "Shadow Blast", cost: 12, cd: 0.9, icon: "blast", desc: "Fire a concentrated projectile of dark energy toward your enemies." },
      { key: "R", name: "Void Beam", cost: 35, cd: 9, icon: "beam", desc: "Charge and release a continuous energy beam that tears through everything in its path." },
      { key: "F", name: "Shadow Summoning", cost: 35, cd: 18, icon: "summon", desc: "Summon three shadow warriors that hunt nearby enemies and fight beside you." },
      { key: "Q", name: "Shadow Step", cost: 20, cd: 3.5, icon: "step", desc: "Instantly teleport a short distance. Locked on? You reappear behind your target." },
      { key: "V", name: "Shadow Extraction", cost: 15, cd: 1, icon: "extract", desc: "Extract the shadow of a defeated enemy and bind it as a permanent companion. (B dismisses all.)" },
      { key: "X", name: "Army of the Abyss", cost: 0, cd: 0, icon: "army", desc: "ULTIMATE — Surround the battlefield with dark energy and unleash an army of shadows in a coordinated assault." },
    ],
  },
};

export const UPGRADES = [
  { id: "power", name: "Power Core", desc: "+8% all damage per rank", max: 5 },
  { id: "vital", name: "Vitality", desc: "+10% max health per rank", max: 5 },
  { id: "energy", name: "Energy Flow", desc: "+15% energy regeneration per rank", max: 5 },
  { id: "haste", name: "Ability Haste", desc: "-6% ability cooldowns per rank", max: 5 },
  { id: "mastery", name: "Ability Mastery", desc: "+10% ability damage & blast size per rank", max: 5 },
  { id: "surge", name: "Ultimate Surge", desc: "+15% ultimate charge rate per rank", max: 5 },
];

export const ENEMY_INFO: Record<string, { name: string; desc: string }> = {
  criminal: { name: "Street Criminal", desc: "Swarms and surrounds. Dodges now and then." },
  assassin: { name: "Fire Assassin", desc: "Keeps distance, flings fire, fire-dashes." },
  ninja: { name: "Shadow Ninja", desc: "Teleports and strikes from behind." },
  brute: { name: "Heavy Brute", desc: "Slow, armored. Slams, charges, shockwaves." },
  gunner: { name: "Energy Gunner", desc: "Long range sniper. Repositions constantly." },
  hunter: { name: "Aerial Hunter", desc: "Flies, shoots and dive-bombs." },
  commander: { name: "Elite Commander", desc: "Summons minions, multiple attack patterns." },
};

export const xpNeeded = (lvl: number) => 120 + lvl * 90;
export const MAX_LEVEL = 20;
