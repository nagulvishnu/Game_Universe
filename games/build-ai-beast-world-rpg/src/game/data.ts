import { mulberry32 } from "./noise";

export interface Continent { name: string; epithet: string; color: string; boss: string; teaser: string }
export const CONTINENTS: Continent[] = [
  { name: "Kaldraxis", epithet: "The Ashen Crown", color: "#e0894f", boss: "The Warden", teaser: "Where you woke. Scorched plains, a drowned forest, singing dunes and a frozen spine." },
  { name: "Virellon", epithet: "The Verdant Maw", color: "#5fd07a", boss: "Mother Thornveil", teaser: "A jungle continent that swallows cities whole. Its roots remember every footstep." },
  { name: "Solthara", epithet: "The Gilded Expanse", color: "#f2c14e", boss: "The Sunbound Regent", teaser: "Golden salt-flats and glass cities. The sun never sets on the Regent's court." },
  { name: "Nyxhollow", epithet: "The Starless Veil", color: "#9a6bff", boss: "Hollow Cantor", teaser: "A continent of endless dusk, where Beasts sing in frequencies that bend light." },
  { name: "Ymirheim", epithet: "The Rimebound Throne", color: "#7fd6ff", boss: "Glacial Sovereign", teaser: "Ice fortresses clasp the bones of a Beast older than the sea." },
  { name: "Zephyros", epithet: "The Sundered Skies", color: "#8be9d0", boss: "Stormwreath Matriarch", teaser: "Floating archipelagos tethered by chains of living lightning." },
  { name: "Orrenvale", epithet: "The First Garden", color: "#ff7ab8", boss: "The Unwritten", teaser: "The oldest land. Nothing here is recorded — and the Beasts here have your face." },
];
export const OCEANS = [
  { name: "The Mirrorsea", note: "A windless sea that reflects a different sky." },
  { name: "The Drowned Meridian", note: "Sunken cities line a line that cuts the world in two." },
  { name: "Stormwreath Deep", note: "Perpetual tempest. The Tidewall is thinnest here." },
  { name: "The Abyssal Hymn", note: "Something enormous sings from below the trench." },
  { name: "The Pale Lantern Sea", note: "Ten thousand drifting lights — none are stars." },
];
const PRE = ["Ash", "Gloam", "Thorn", "Salt", "Ember", "Hollow", "Veil", "Storm", "Amber", "Iron", "Moss", "Crystal", "Bone", "Silk", "Dusk", "Star", "Rime", "Gild", "Cinder", "Wyrm", "Rue", "Mist", "Brack", "Sable"];
const SUF = ["reach", "vale", "mark", "fall", "moor", "spire", "hollow", "fen", "crest", "strand", "dell", "barrow", "gate", "wold"];
const REG = ["Basin", "Heights", "Quarter", "Wilds", "Ruins", "Gardens", "Depths", "Terraces", "Crossing", "Hollows"];
export interface StateInfo { name: string; regions: string[] }
const cache: StateInfo[][] = [];
export function statesOf(ci: number): StateInfo[] {
  if (cache[ci]) return cache[ci];
  const rnd = mulberry32(ci * 977 + 13);
  const used = new Set<string>();
  const out: StateInfo[] = [];
  for (let s = 0; s < 10; s++) {
    if (ci === 0 && s === 0) {
      out.push({ name: "The Wastelands", regions: ["Cinder Flats", "Verdant Reach", "Sunscar Dunes", "Frostspine Rise"] });
      continue;
    }
    let name = "";
    do { name = PRE[Math.floor(rnd() * PRE.length)] + SUF[Math.floor(rnd() * SUF.length)]; } while (used.has(name));
    used.add(name);
    name = name[0].toUpperCase() + name.slice(1);
    const regions: string[] = [];
    const ru = new Set<number>();
    while (regions.length < 4) {
      const k = Math.floor(rnd() * REG.length);
      if (ru.has(k)) continue;
      ru.add(k);
      regions.push(PRE[Math.floor(rnd() * PRE.length)] + " " + REG[k]);
    }
    out.push({ name, regions });
  }
  return (cache[ci] = out);
}

export type Slot = "weapon" | "armor" | "charm";
export interface Gear { id: string; name: string; slot: Slot; rarity: number; atk: number; hp: number; desc: string }
export const RARITY = ["Worn", "Fine", "Rare", "Epic", "Legendary"];
export const RARITY_COL = ["#b9b2a5", "#7ddf8a", "#5db8ff", "#c183ff", "#ffb347"];
export const GEAR: Gear[] = [
  { id: "rustblade", name: "Rustblade", slot: "weapon", rarity: 0, atk: 0, hp: 0, desc: "A pitted blade that hums when Vesper is near." },
  { id: "dustfang", name: "Dustfang Saber", slot: "weapon", rarity: 1, atk: 7, hp: 0, desc: "Carved from a Skitter's fang." },
  { id: "tidecaller", name: "Tidecaller", slot: "weapon", rarity: 2, atk: 16, hp: 0, desc: "Still wet, though no sea touched it." },
  { id: "emberwake", name: "Emberwake", slot: "weapon", rarity: 3, atk: 28, hp: 0, desc: "Its edge never quite cools." },
  { id: "wardensedge", name: "Warden's Edge", slot: "weapon", rarity: 4, atk: 46, hp: 0, desc: "An oath given a blade." },
  { id: "wanderrags", name: "Wanderer's Rags", slot: "armor", rarity: 0, atk: 0, hp: 0, desc: "Ash-stained cloth." },
  { id: "hidejerkin", name: "Hide Jerkin", slot: "armor", rarity: 1, atk: 0, hp: 60, desc: "Stitched from Ashhorn hide." },
  { id: "plateofsalt", name: "Saltplate", slot: "armor", rarity: 2, atk: 0, hp: 140, desc: "Crystal crust hardens over the steel." },
  { id: "starwoven", name: "Starwoven Mantle", slot: "armor", rarity: 3, atk: 4, hp: 240, desc: "Threads taken from a dead sky." },
  { id: "luckcharm", name: "Bone Charm", slot: "charm", rarity: 1, atk: 3, hp: 20, desc: "A tooth on a cord." },
  { id: "echoshard", name: "Echo Shard", slot: "charm", rarity: 2, atk: 8, hp: 40, desc: "Replays the last sound it heard: a lullaby." },
  { id: "voidpearl", name: "Void Pearl", slot: "charm", rarity: 3, atk: 14, hp: 80, desc: "Colder than the deep it came from." },
];
export const gearById = (id: string) => GEAR.find((g) => g.id === id)!;
export const gearScore = (g: Gear) => g.atk * 5 + g.hp / 4 + g.rarity;

export const TABLETS: { title: string; text: string }[] = [
  { title: "Tablet I — The Sundering", text: "On the day the Beasts woke, the sea stood up and became a wall. We called it the Tidewall. We called it a mercy. It was a wound." },
  { title: "Tablet II — Not Born", text: "The Beasts were not born. They were kept — each one a verse of a single Song, broken so the Song could not be sung whole." },
  { title: "Tablet III — The Oath-Keepers", text: "Seven Wardens were forged, one for each gate. They guard nothing outside. Read it again: they guard nothing outside." },
  { title: "Tablet IV — The Binder", text: "There was one who bound the Song. When it was done, they asked the world to take their memory. The world agreed, and gave it to a small thing that hums." },
  { title: "Tablet V — Last Verse", text: "Vesper is not a Beast. Vesper is what remained when the Binder chose to forget. Feed it a Core and it remembers a little — and so, perhaps, will you." },
  { title: "Tablet VI — The Cores", text: "Each Core is a verse returned. Hold too many and the Song starts to sing itself. Hold none and you are nothing but ash." },
  { title: "Tablet VII — A Warning", text: "If the Binder wakes, the Wardens must test them. Not to stop them. To learn whether they still mean it." },
  { title: "Tablet VIII — Etched Last", text: "Whoever reads this: the gate was never meant to keep you out. It was meant to keep you from remembering what you built it to hold." },
];

export interface QuestDef { id: string; title: string; desc: string }
export const QUESTS: QuestDef[] = [
  { id: "wake", title: "Ash and Embers", desc: "Something is stalking the crater. Defend yourself — and Vesper." },
  { id: "tablet", title: "The Humming Road", desc: "Vesper pulls you toward the Waystation Ruins. Read the first Tablet." },
  { id: "village", title: "A Voice in the Dust", desc: "Find the village of Dustwell and speak with Maren." },
  { id: "portal", title: "Waystone Awakening", desc: "Activate a Waystone portal to anchor your journey." },
  { id: "level", title: "Temper the Blade", desc: "The Warden is no ordinary Beast. Reach level 4." },
  { id: "warden", title: "The Last Gate", desc: "Enter Warden Stadium and face its keeper." },
  { id: "free", title: "Beyond the Tidewall", desc: "The Wastelands are yours — for now. Discover everything the land hides." },
];

export interface EnemyDef {
  id: string; name: string; hp: number; poise: number; xp: number; score: number; speed: number; scale: number; tier: number;
  weak: string;
}
export const ENEMIES: Record<string, EnemyDef> = {
  skitter: { id: "skitter", name: "Dust Skitter", hp: 46, poise: 20, xp: 18, score: 100, speed: 8.5, scale: 1, tier: 0, weak: "Heavy attacks & launchers" },
  horn: { id: "horn", name: "Ashhorn", hp: 170, poise: 70, xp: 55, score: 300, speed: 6, scale: 1.2, tier: 1, weak: "Parry its gore, dodge its charge, strike while dizzy" },
  kite: { id: "kite", name: "Cinderkite", hp: 62, poise: 18, xp: 35, score: 200, speed: 7, scale: 1, tier: 1, weak: "Air attacks & Gale Rend" },
  colossus: { id: "colossus", name: "Stoneback Colossus", hp: 760, poise: 220, xp: 260, score: 1200, speed: 3.6, scale: 2.2, tier: 2, weak: "Glowing back — strike from behind" },
  grazer: { id: "grazer", name: "Moss Grazer", hp: 30, poise: 5, xp: 6, score: 20, speed: 5, scale: 1, tier: 0, weak: "Harmless" },
  warden: { id: "warden", name: "The Warden", hp: 3000, poise: 400, xp: 1500, score: 6000, speed: 5, scale: 1, tier: 3, weak: "Parry cleaves, topple pillars, shatter pylons" },
};

export const HELP_LINES = [
  "WASD move · Shift tap dodge / hold sprint · Space jump (hold in air = glide)",
  "LMB / J attack (hold = charged) · RMB / K block (tap just before a hit = parry)",
  "H heavy · E Gale Rend · Q Gravity Bloom · R Astral Judgement · Z Vesper Strike",
  "F interact · V mount Vesper · B Beast Core · G Vesper Sense · T lock-on · Tab map",
];
