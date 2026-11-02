// ---------------------------------------------------------------------------
// HAVOC CITY — shared game data
// ---------------------------------------------------------------------------

export type Vec2 = [number, number];

export const CITY = {
  blocks: 9,
  blockSize: 38,
  roadWidth: 14,
  pitch: 52,
  start: -234,
  extent: 234,
  platform: 247,
  waterY: -1.2,
};

/** centre coordinate of block index i (0..8) on both axes */
export const blockCenter = (i: number) => -208 + i * 52;
/** centre coordinate of a road grid line k (0..9) on both axes */
export const roadCenter = (k: number) => -234 + k * 52;

export type DistrictId = "downtown" | "neon" | "harbor" | "industrial" | "suburb";

export interface District {
  id: DistrictId;
  name: string;
  short: string;
  tagline: string;
  description: string;
  color: string;
  glow: string;
  center: Vec2;
  blocks: [number, number, number, number];
  tags: string[];
  danger: number;
}

export const DISTRICTS: District[] = [
  {
    id: "downtown",
    name: "Obsidian Heights",
    short: "Downtown",
    tagline: "Where the money sleeps with one eye open.",
    description:
      "Glass towers, private security and the city's tallest skyline. The Havoc Spire cuts through the smog at 180 metres. Every deal up here has a body count.",
    color: "#9ef01a",
    glow: "#c8ff3d",
    center: [0, 0],
    blocks: [3, 5, 3, 5],
    tags: ["Skyscrapers", "Finance", "High security"],
    danger: 3,
  },
  {
    id: "neon",
    name: "Neon Mile",
    short: "Neon Mile",
    tagline: "No clocks, no closing time.",
    description:
      "Casinos, night markets and back-alley clinics lit by ten thousand signs. The fastest cars in the city are won and lost on this strip before sunrise.",
    color: "#ff3d8b",
    glow: "#ff77ac",
    center: [156, -52],
    blocks: [6, 8, 0, 4],
    tags: ["Nightlife", "Casinos", "Street racing"],
    danger: 4,
  },
  {
    id: "harbor",
    name: "Killick Harbor",
    short: "Harbor",
    tagline: "Everything arrives by sea. Nothing leaves clean.",
    description:
      "Container yards, cranes and a shipping lane that never sleeps. If it fell off a truck, it fell off a boat here first.",
    color: "#3dd6ff",
    glow: "#7ce7ff",
    center: [-104, 156],
    blocks: [0, 4, 6, 8],
    tags: ["Docks", "Contraband", "Cranes"],
    danger: 4,
  },
  {
    id: "industrial",
    name: "The Foundry",
    short: "Industrial",
    tagline: "Steel, smoke and things that shouldn't be built.",
    description:
      "Refineries, rail yards and an airfield long enough to launder a jet. The tank depot is unguarded most nights — allegedly.",
    color: "#ffb03d",
    glow: "#ffd37c",
    center: [156, 156],
    blocks: [6, 8, 6, 8],
    tags: ["Factories", "Airfield", "Armory"],
    danger: 3,
  },
  {
    id: "suburb",
    name: "Palmwash",
    short: "Suburbs",
    tagline: "Quiet streets. Loud secrets.",
    description:
      "Bungalows, palm trees and cul-de-sacs with private security. A lovely place to disappear, if the neighbors stop watching.",
    color: "#7dffb0",
    glow: "#adffcd",
    center: [-156, -156],
    blocks: [0, 2, 0, 2],
    tags: ["Homes", "Golf", "Witness protection"],
    danger: 1,
  },
];

export const districtById = (id: DistrictId) => DISTRICTS.find((d) => d.id === id)!;

export function districtAt(x: number, z: number): DistrictId {
  let best: DistrictId = "downtown";
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const weight = d.id === "downtown" ? 1.25 : 1; // downtown claims the middle
    const dist = Math.hypot(x - d.center[0], z - d.center[1]) * weight;
    if (dist < bestDist) {
      bestDist = dist;
      best = d.id;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// VEHICLES
// ---------------------------------------------------------------------------

export type VehicleKind =
  | "sports"
  | "muscle"
  | "suv"
  | "taxi"
  | "police"
  | "truck"
  | "bike"
  | "sportbike"
  | "plane"
  | "heli"
  | "tank";

export type VehicleClass = "Car" | "Bike" | "Aircraft" | "Armor";

export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  brand: string;
  cls: VehicleClass;
  maxSpeed: number; // m/s
  accel: number;
  handling: number;
  health: number;
  mass: number;
  color: string;
  accent: string;
  price: number;
  cameraDist: number;
  desc: string;
}

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  sports: {
    kind: "sports",
    name: "Banshee GT",
    brand: "Vulcan",
    cls: "Car",
    maxSpeed: 58,
    accel: 22,
    handling: 2.3,
    health: 220,
    mass: 1,
    color: "#c8ff3d",
    accent: "#0c0f0a",
    price: 48000,
    cameraDist: 10,
    desc: "Mid-engine, rear-drive, no manners. The city's favourite getaway.",
  },
  muscle: {
    kind: "muscle",
    name: "Dominator 440",
    brand: "Bravado",
    cls: "Car",
    maxSpeed: 50,
    accel: 20,
    handling: 1.7,
    health: 280,
    mass: 1.2,
    color: "#ff6b35",
    accent: "#111111",
    price: 36000,
    cameraDist: 10,
    desc: "A V8 with a license plate. Sounds like thunder in a tunnel.",
  },
  suv: {
    kind: "suv",
    name: "Granger XT",
    brand: "Karin",
    cls: "Car",
    maxSpeed: 42,
    accel: 14,
    handling: 1.5,
    health: 360,
    mass: 1.6,
    color: "#dfe6ec",
    accent: "#20262b",
    price: 28000,
    cameraDist: 11,
    desc: "Room for five, or four and a duffel bag nobody asks about.",
  },
  taxi: {
    kind: "taxi",
    name: "Downtown Cab",
    brand: "Vapid",
    cls: "Car",
    maxSpeed: 38,
    accel: 12,
    handling: 1.4,
    health: 260,
    mass: 1.3,
    color: "#ffd23d",
    accent: "#141414",
    price: 9000,
    cameraDist: 11,
    desc: "The fastest way across town, provided your driver knows a guy.",
  },
  police: {
    kind: "police",
    name: "Interceptor V8",
    brand: "HCPD",
    cls: "Car",
    maxSpeed: 54,
    accel: 21,
    handling: 2.1,
    health: 340,
    mass: 1.3,
    color: "#f4f7fb",
    accent: "#10233f",
    price: 0,
    cameraDist: 10,
    desc: "Seized from the impound. The siren still works. Allegedly.",
  },
  truck: {
    kind: "truck",
    name: "Hauler 900",
    brand: "JoBuilt",
    cls: "Car",
    maxSpeed: 30,
    accel: 9,
    handling: 0.9,
    health: 640,
    mass: 3,
    color: "#3b4a5a",
    accent: "#ff8c1a",
    price: 22000,
    cameraDist: 14,
    desc: "Ten tonnes of steel. Corners are a suggestion, not a promise.",
  },
  bike: {
    kind: "bike",
    name: "Whippet 125",
    brand: "Pegassi",
    cls: "Bike",
    maxSpeed: 44,
    accel: 24,
    handling: 2.7,
    health: 90,
    mass: 0.5,
    color: "#00e0c6",
    accent: "#101010",
    price: 12000,
    cameraDist: 8,
    desc: "Light, loud and entirely the wrong tool for a tank fight.",
  },
  sportbike: {
    kind: "sportbike",
    name: "Akuma RR",
    brand: "Shitzu",
    cls: "Bike",
    maxSpeed: 62,
    accel: 30,
    handling: 3,
    health: 100,
    mass: 0.45,
    color: "#ff3d8b",
    accent: "#f4f4f4",
    price: 26000,
    cameraDist: 8,
    desc: "0–100 before the light turns green. Brakes optional.",
  },
  plane: {
    kind: "plane",
    name: "Mammoth Dodo",
    brand: "Mammoth",
    cls: "Aircraft",
    maxSpeed: 86,
    accel: 26,
    handling: 1.4,
    health: 320,
    mass: 2,
    color: "#eef2f7",
    accent: "#ff3d3d",
    price: 240000,
    cameraDist: 26,
    desc: "Single prop, four seats. Runway strongly recommended.",
  },
  heli: {
    kind: "heli",
    name: "Frogger 4",
    brand: "Maibatsu",
    cls: "Aircraft",
    maxSpeed: 62,
    accel: 18,
    handling: 1.8,
    health: 280,
    mass: 1.6,
    color: "#233244",
    accent: "#c8ff3d",
    price: 190000,
    cameraDist: 21,
    desc: "Vertical takeoff. Perfect for rooftops and unfinished business.",
  },
  tank: {
    kind: "tank",
    name: "Rhino MK II",
    brand: "HVY",
    cls: "Armor",
    maxSpeed: 20,
    accel: 7,
    handling: 0.8,
    health: 2400,
    mass: 8,
    color: "#606b39",
    accent: "#2a2f1e",
    price: 900000,
    cameraDist: 16,
    desc: "120mm of conflict resolution. The city has three; nobody knows where two are.",
  },
};

export const VEHICLE_LIST = Object.values(VEHICLES);

// ---------------------------------------------------------------------------
// WEAPONS
// ---------------------------------------------------------------------------

export type WeaponId = "fists" | "pistol" | "smg" | "shotgun" | "rifle" | "rocket";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  slot: number;
  damage: number;
  fireRate: number; // seconds
  auto: boolean;
  pellets: number;
  spread: number;
  range: number;
  mag: number;
  reserve: number;
  explosive?: boolean;
  desc: string;
  color: string;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  fists: {
    id: "fists",
    name: "Fists",
    slot: 1,
    damage: 12,
    fireRate: 0.38,
    auto: false,
    pellets: 1,
    spread: 0,
    range: 2.2,
    mag: Infinity,
    reserve: Infinity,
    desc: "Free. Personal. Surprisingly effective.",
    color: "#d9d9d9",
  },
  pistol: {
    id: "pistol",
    name: "Stinger .45",
    slot: 2,
    damage: 26,
    fireRate: 0.28,
    auto: false,
    pellets: 1,
    spread: 0.014,
    range: 90,
    mag: 12,
    reserve: 180,
    desc: "Every story in this city starts with one of these.",
    color: "#c8ff3d",
  },
  smg: {
    id: "smg",
    name: "Micro SMG",
    slot: 3,
    damage: 14,
    fireRate: 0.085,
    auto: true,
    pellets: 1,
    spread: 0.03,
    range: 70,
    mag: 30,
    reserve: 300,
    desc: "Loud. Inaccurate. Great for negotiating.",
    color: "#ffd23d",
  },
  shotgun: {
    id: "shotgun",
    name: "Street Sweeper",
    slot: 4,
    damage: 11,
    fireRate: 0.75,
    auto: false,
    pellets: 8,
    spread: 0.075,
    range: 34,
    mag: 8,
    reserve: 72,
    desc: "Eight reasons to leave the room.",
    color: "#ff8c1a",
  },
  rifle: {
    id: "rifle",
    name: "Marksman AR",
    slot: 5,
    damage: 48,
    fireRate: 0.16,
    auto: true,
    pellets: 1,
    spread: 0.008,
    range: 140,
    mag: 30,
    reserve: 240,
    desc: "Precision from the rooftop of your choice.",
    color: "#3dd6ff",
  },
  rocket: {
    id: "rocket",
    name: "RPG-7",
    slot: 6,
    damage: 220,
    fireRate: 1.6,
    auto: false,
    pellets: 1,
    spread: 0.01,
    range: 160,
    mag: 1,
    reserve: 12,
    explosive: true,
    desc: "The ultimate problem solver. Please aim upward.",
    color: "#ff3d5a",
  },
};

export const WEAPON_ORDER: WeaponId[] = ["fists", "pistol", "smg", "shotgun", "rifle", "rocket"];

// ---------------------------------------------------------------------------
// MISSIONS + QUESTS
// ---------------------------------------------------------------------------

export type StepKind = "reach" | "eliminate" | "collect" | "survive" | "vehicle";

export interface MissionStep {
  kind: StepKind;
  text: string;
  target: Vec2;
  radius?: number;
  count?: number;
  seconds?: number;
  vehicleKind?: VehicleKind;
}

export interface Mission {
  id: string;
  title: string;
  giver: string;
  district: DistrictId;
  difficulty: 1 | 2 | 3 | 4 | 5;
  brief: string;
  reward: number;
  xp: number;
  steps: MissionStep[];
  icon: "crosshair" | "car" | "box" | "shield" | "plane" | "tank" | "skull";
  category: "Mission" | "Quest" | "Heist";
}

export const MISSIONS: Mission[] = [
  {
    id: "welcome",
    title: "Welcome to the City",
    giver: "Rue",
    district: "downtown",
    difficulty: 1,
    category: "Quest",
    icon: "crosshair",
    brief:
      "Rue found you a place to stay and a name to use. Meet her under the Spire, then clean the squatters out of the garage.",
    reward: 2400,
    xp: 220,
    steps: [
      { kind: "reach", text: "Meet Rue beneath Havoc Spire", target: [16, 34], radius: 9 },
      { kind: "eliminate", text: "Remove the squatters from the garage", target: [66, 62], count: 3 },
      { kind: "reach", text: "Return to the Spire valet", target: [16, 34], radius: 9 },
    ],
  },
  {
    id: "repo",
    title: "Repo Run",
    giver: "Mako",
    district: "neon",
    difficulty: 2,
    category: "Mission",
    icon: "car",
    brief:
      "A Banshee GT walked out of Mako's showroom on a fake cheque. Bring it to the harbor and try not to scratch the paint.",
    reward: 3200,
    xp: 300,
    steps: [
      { kind: "vehicle", vehicleKind: "sports", text: "Take the Banshee GT to the harbor impound", target: [-96, 122], radius: 10 },
      { kind: "reach", text: "Sign the papers at the drop office", target: [-70, 140], radius: 8 },
    ],
  },
  {
    id: "debt",
    title: "Neon Debt",
    giver: "Vex",
    district: "neon",
    difficulty: 3,
    category: "Mission",
    icon: "skull",
    brief:
      "The Pink Vipers borrowed forty grand and forgot the part where they pay it back. Make an example of the crew on the strip.",
    reward: 4800,
    xp: 480,
    steps: [
      { kind: "reach", text: "Drive to the Neon Mile corner office", target: [126, -36], radius: 9 },
      { kind: "eliminate", text: "Clear out the Pink Vipers", target: [150, -10], count: 5 },
      { kind: "reach", text: "Collect the debt ledger", target: [168, -60], radius: 6 },
    ],
  },
  {
    id: "heist",
    title: "Harbor Heist",
    giver: "Kira",
    district: "harbor",
    difficulty: 3,
    category: "Heist",
    icon: "box",
    brief:
      "Three crates came off a ship that officially never existed. Grab them from the container yard before the dock patrol finishes coffee.",
    reward: 5200,
    xp: 520,
    steps: [
      { kind: "collect", text: "Recover the three crates", target: [-110, 174], count: 3 },
      { kind: "vehicle", vehicleKind: "suv", text: "Load the crates into a Granger and reach the safehouse", target: [-186, 118], radius: 11 },
    ],
  },
  {
    id: "jungle",
    title: "Concrete Jungle",
    giver: "Sergeant Hale",
    district: "downtown",
    difficulty: 4,
    category: "Quest",
    icon: "shield",
    brief:
      "HCPD wants to have a conversation about your recent paperwork. Stay alive on the plaza long enough for the heat to look elsewhere.",
    reward: 5600,
    xp: 560,
    steps: [
      { kind: "reach", text: "Get to the Obsidian plaza", target: [-2, 72], radius: 10 },
      { kind: "survive", text: "Survive the police response", target: [-2, 72], seconds: 45 },
    ],
  },
  {
    id: "skyline",
    title: "Skyline Run",
    giver: "Rotor",
    district: "downtown",
    difficulty: 4,
    category: "Mission",
    icon: "plane",
    brief:
      "A Frogger is fueled and waiting on the Meridian pad. Get airborne, then get the package to the Foundry before air traffic control wakes up.",
    reward: 7200,
    xp: 640,
    steps: [
      { kind: "reach", text: "Reach the Meridian helipad", target: [74, -74], radius: 9 },
      { kind: "vehicle", vehicleKind: "heli", text: "Fly to the Foundry landing zone", target: [150, 128], radius: 14 },
    ],
  },
  {
    id: "ironfist",
    title: "Iron Fist",
    giver: "Kowalski",
    district: "industrial",
    difficulty: 5,
    category: "Heist",
    icon: "tank",
    brief:
      "The Rhino depot is two guards and a chain-link fence. Borrow a tank, roll it to the Foundry gates and remind the foreman who owns the yard.",
    reward: 11000,
    xp: 900,
    steps: [
      { kind: "vehicle", vehicleKind: "tank", text: "Roll the Rhino to the Foundry gates", target: [106, 148], radius: 13 },
      { kind: "eliminate", text: "Crush the foreman's security detail", target: [136, 166], count: 5 },
    ],
  },
  {
    id: "runway",
    title: "Runway Escape",
    giver: "Rue",
    district: "industrial",
    difficulty: 4,
    category: "Heist",
    icon: "plane",
    brief:
      "One plane, one pilot, two bags that do not go through customs. Get to the Dodo on the airfield and fly the cargo out over the bay.",
    reward: 9800,
    xp: 780,
    steps: [
      { kind: "reach", text: "Reach the airfield hangar", target: [196, 196], radius: 11 },
      { kind: "vehicle", vehicleKind: "plane", text: "Fly the cargo out to sea", target: [236, 120], radius: 22 },
    ],
  },
  {
    id: "ghost",
    title: "Ghost Protocol",
    giver: "Mako",
    district: "suburb",
    difficulty: 3,
    category: "Quest",
    icon: "skull",
    brief:
      "A witness in Palmwash is about to say the wrong name to the wrong people. Reach the cul-de-sac and make sure the garage stays closed.",
    reward: 6400,
    xp: 600,
    steps: [
      { kind: "reach", text: "Reach the Palmwash cul-de-sac", target: [-160, -142], radius: 10 },
      { kind: "eliminate", text: "Eliminate the cleanup crew", target: [-192, -118], count: 4 },
      { kind: "reach", text: "Leave the neighborhood", target: [-104, -186], radius: 12 },
    ],
  },
  {
    id: "kingpin",
    title: "Kingpin",
    giver: "Rue",
    district: "downtown",
    difficulty: 5,
    category: "Mission",
    icon: "crosshair",
    brief:
      "Every road in this city ends at the top of Havoc Spire. Take the private elevator, then take the throne. This is the one they'll remember.",
    reward: 25000,
    xp: 2000,
    steps: [
      { kind: "reach", text: "Enter the Havoc Spire lobby", target: [0, -16], radius: 8 },
      { kind: "eliminate", text: "Take out the Kingpin's guard", target: [18, -58], count: 6 },
      { kind: "survive", text: "Survive the final lockdown", target: [18, -58], seconds: 50 },
    ],
  },
];

// ---------------------------------------------------------------------------
// GEAR, POWERUPS & COMBAT SKILLS
// ---------------------------------------------------------------------------

export type UpgradeId =
  | "ironSkin"
  | "gunslinger"
  | "wheelman"
  | "scavenger"
  | "extendedMag"
  | "armorPlating"
  | "nitroKit"
  | "scope";

export interface Upgrade {
  id: UpgradeId;
  name: string;
  category: "Combat" | "Gear";
  desc: string;
  cost: number;
  currency: "cash" | "skill";
  max: number;
  effect: string;
  icon: "heart" | "crosshair" | "car" | "coins" | "mag" | "shield" | "zap" | "scope";
}

export const UPGRADES: Upgrade[] = [
  {
    id: "ironSkin",
    name: "Iron Skin",
    category: "Combat",
    desc: "Permanent +25 max health per rank. Wake up angry.",
    cost: 1,
    currency: "skill",
    max: 5,
    effect: "+25 max HP / rank",
    icon: "heart",
  },
  {
    id: "gunslinger",
    name: "Gunslinger",
    category: "Combat",
    desc: "Deadlier hands. Every weapon hits 12% harder per rank.",
    cost: 1,
    currency: "skill",
    max: 5,
    effect: "+12% weapon damage",
    icon: "crosshair",
  },
  {
    id: "wheelman",
    name: "Wheelman",
    category: "Combat",
    desc: "Steering, grip and top speed all improve. Getaway driving.",
    cost: 1,
    currency: "skill",
    max: 4,
    effect: "+15% vehicle handling",
    icon: "car",
  },
  {
    id: "scavenger",
    name: "Scavenger",
    category: "Combat",
    desc: "Cash pickups and contract payouts are worth 20% more.",
    cost: 1,
    currency: "skill",
    max: 3,
    effect: "+20% cash rewards",
    icon: "coins",
  },
  {
    id: "extendedMag",
    name: "Extended Mags",
    category: "Gear",
    desc: "Deeper magazines and double spare ammo capacity.",
    cost: 6500,
    currency: "cash",
    max: 3,
    effect: "+50% magazine size",
    icon: "mag",
  },
  {
    id: "armorPlating",
    name: "Armor Plating",
    category: "Gear",
    desc: "Body armor that actually stops something. +25 armor capacity.",
    cost: 9000,
    currency: "cash",
    max: 3,
    effect: "+25 max armor",
    icon: "shield",
  },
  {
    id: "nitroKit",
    name: "Nitro Kit",
    category: "Gear",
    desc: "A bottle of very illegal upside. Hold Shift to boost any ground vehicle.",
    cost: 12000,
    currency: "cash",
    max: 2,
    effect: "Longer nitro boost",
    icon: "zap",
  },
  {
    id: "scope",
    name: "Urban Scope",
    category: "Gear",
    desc: "Tighter spread on all firearms. Precision pays.",
    cost: 7500,
    currency: "cash",
    max: 2,
    effect: "-25% weapon spread",
    icon: "scope",
  },
];

export const GARAGE_KINDS: VehicleKind[] = [
  "sports",
  "muscle",
  "suv",
  "taxi",
  "police",
  "truck",
  "bike",
  "sportbike",
  "plane",
  "heli",
  "tank",
];

// ---------------------------------------------------------------------------
// HUD SNAPSHOTS (game -> react)
// ---------------------------------------------------------------------------

export type BlipKind = "mission" | "enemy" | "police" | "vehicle" | "pickup" | "player" | "garage" | "hospital";

export interface Blip {
  x: number;
  z: number;
  kind: BlipKind;
}

export interface HudVehicle {
  kind: VehicleKind;
  name: string;
  speed: number;
  health: number;
  maxHealth: number;
  nitro: number;
  airborne: boolean;
}

export interface HudMission {
  id: string;
  title: string;
  step: string;
  stepIndex: number;
  stepCount: number;
  progress: number;
  progressMax: number;
  kind: StepKind;
  target: Vec2;
}

export interface HudState {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  cash: number;
  xp: number;
  level: number;
  xpNext: number;
  skillPoints: number;
  wanted: number;
  district: DistrictId;
  weapon: WeaponId;
  ammo: number;
  reserve: number;
  reloading: boolean;
  inVehicle: HudVehicle | null;
  mission: HudMission | null;
  completed: string[];
  ownedUpgrades: Partial<Record<UpgradeId, number>>;
  medkits: number;
  nearby: { kind: VehicleKind; name: string } | null;
  interaction: string | null;
  blips: Blip[];
  clock: string;
  dead: boolean;
  muted: boolean;
  quality: "high" | "performance";
  wantedReason: string;
  enemiesRemaining: number;
  fps: number;
  x: number;
  z: number;
  heading: number;
  speedOnFoot: number;
  boosts: { name: string; seconds: number }[];
  quickTravelLocked: boolean;
}
