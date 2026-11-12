// Static game data: cars, tracks, upgrades, options.

export type Cat = "Street Supercar" | "Hypercar" | "Drift" | "Muscle" | "Concept" | "Lightweight";
export type Tod = "sunny" | "sunset" | "night";
export type Weather = "clear" | "rain" | "heavy" | "fog" | "storm";
export type Engine = "v8" | "v10" | "rotary" | "electric" | "turbo" | "hybrid" | "v6";

export interface CarStats {
  speed: number;
  accel: number;
  handling: number;
  drift: number;
  nitro: number;
  braking: number;
}
export interface CarDef {
  id: string;
  name: string;
  cat: Cat;
  blurb: string;
  price: number;
  mass: number;
  stats: CarStats;
  paint: [string, string];
  engine: Engine;
  nitroColor: string;
}

export const CARS: CarDef[] = [
  { id: "kitsune", name: "Kitsune GT", cat: "Street Supercar", blurb: "Mid-engine wedge with razor balance.", price: 0, mass: 1.2, stats: { speed: 7, accel: 7, handling: 7, drift: 6, nitro: 6, braking: 7 }, paint: ["#ff5a1f", "#101010"], engine: "v8", nitroColor: "#ff8a1f" },
  { id: "aurora", name: "Aurora S1", cat: "Street Supercar", blurb: "Long-hood grand tourer, ultra stable.", price: 3000, mass: 1.4, stats: { speed: 8, accel: 6, handling: 6, drift: 5, nitro: 7, braking: 7 }, paint: ["#2f7bff", "#f4f4f4"], engine: "v10", nitroColor: "#4fb0ff" },
  { id: "phantom", name: "Phantom Zero", cat: "Hypercar", blurb: "Ground-hugging aero monster.", price: 9000, mass: 1.15, stats: { speed: 10, accel: 9, handling: 5, drift: 4, nitro: 7, braking: 6 }, paint: ["#14161c", "#ffd21f"], engine: "hybrid", nitroColor: "#ffe14f" },
  { id: "raijin", name: "Raijin X", cat: "Hypercar", blurb: "Thunder-class angular hypercar.", price: 12000, mass: 1.1, stats: { speed: 9, accel: 10, handling: 5, drift: 5, nitro: 8, braking: 6 }, paint: ["#7a2bff", "#18e6ff"], engine: "v10", nitroColor: "#a05bff" },
  { id: "hachi", name: "Hachi-Roku 86", cat: "Drift", blurb: "Featherweight pop-up legend.", price: 0, mass: 1.0, stats: { speed: 5, accel: 6, handling: 8, drift: 10, nitro: 6, braking: 6 }, paint: ["#f5f5f5", "#0c0c0c"], engine: "turbo", nitroColor: "#7be6ff" },
  { id: "sakura", name: "Sakura RX", cat: "Drift", blurb: "Screaming rotary with a GT wing.", price: 3500, mass: 1.1, stats: { speed: 6, accel: 7, handling: 8, drift: 9, nitro: 7, braking: 6 }, paint: ["#ff6fb5", "#ffffff"], engine: "rotary", nitroColor: "#ff7ad0" },
  { id: "brute", name: "Brute V8", cat: "Muscle", blurb: "Raw torque. Respect the mass.", price: 0, mass: 1.7, stats: { speed: 8, accel: 7, handling: 4, drift: 7, nitro: 6, braking: 5 }, paint: ["#c8102e", "#f2f2f2"], engine: "v8", nitroColor: "#ff4a1f" },
  { id: "charger", name: "Thunder Charger", cat: "Muscle", blurb: "Fastback bruiser with hood vents.", price: 3200, mass: 1.6, stats: { speed: 7, accel: 8, handling: 5, drift: 8, nitro: 6, braking: 6 }, paint: ["#1a1a1a", "#ffb000"], engine: "v8", nitroColor: "#ffb000" },
  { id: "nova", name: "Nova Lumen", cat: "Concept", blurb: "Electric concept wrapped in light.", price: 8000, mass: 1.2, stats: { speed: 8, accel: 8, handling: 7, drift: 5, nitro: 9, braking: 7 }, paint: ["#e8f3ff", "#17d9ff"], engine: "electric", nitroColor: "#17e0ff" },
  { id: "zephyr", name: "Zephyr Ion", cat: "Concept", blurb: "Ion-thruster delta from 2099.", price: 10000, mass: 1.15, stats: { speed: 9, accel: 7, handling: 7, drift: 6, nitro: 10, braking: 6 }, paint: ["#0f1230", "#ff2fd0"], engine: "electric", nitroColor: "#ff4fe0" },
  { id: "kestrel", name: "Kestrel LM", cat: "Lightweight", blurb: "Covered-wheel endurance prototype.", price: 0, mass: 0.9, stats: { speed: 6, accel: 7, handling: 9, drift: 5, nitro: 6, braking: 9 }, paint: ["#19c37d", "#101010"], engine: "v6", nitroColor: "#5bffb0" },
  { id: "wasp", name: "Wasp F1", cat: "Lightweight", blurb: "Open-wheel razor. Pure downforce.", price: 6500, mass: 0.8, stats: { speed: 8, accel: 9, handling: 8, drift: 4, nitro: 6, braking: 8 }, paint: ["#ffd400", "#111111"], engine: "v6", nitroColor: "#ffd400" },
];
export const carById = (id: string) => CARS.find((c) => c.id === id) ?? CARS[0];

export const PAINTS = [
  "#ff5a1f", "#c8102e", "#ff6fb5", "#ff2fd0", "#7a2bff", "#2f7bff", "#17d9ff", "#19c37d",
  "#b8f200", "#ffd400", "#f5f5f5", "#9aa3ad", "#2a2e36", "#0c0c0c", "#e8f3ff", "#6b3f1d",
];
export const NEONS = ["off", "#17e0ff", "#ff2fd0", "#7a2bff", "#19ff7a", "#ff3b3b", "#ffd400", "#ffffff"];
export const SPOILERS = ["Stock", "None", "Lip", "Ducktail", "GT Wing", "Triple Wing"];
export const DECALS = ["None", "Center Stripe", "Twin Stripes", "Side Stripes", "Kanji Number", "Checker Flag"];
export const WHEELS = ["5-Spoke", "Mesh", "Turbine", "Dish", "Split 10", "Hex Star"];
export const EXHAUSTS = ["Chrome", "Burnt Titanium", "Carbon Black", "Gold"];
export const TINTS = ["Light", "Medium", "Dark", "Blackout"];

export interface Custom {
  primary: string;
  secondary: string;
  wheel: number;
  rim: string;
  spoiler: number;
  decal: number;
  neon: string;
  exhaust: number;
  plate: string;
  tint: number;
}
export const defaultCustom = (c: CarDef): Custom => ({
  primary: c.paint[0], secondary: c.paint[1], wheel: 0, rim: "#d8dde4", spoiler: 0,
  decal: 0, neon: "off", exhaust: 0, plate: c.id.slice(0, 3).toUpperCase() + "-" + (100 + Math.floor(Math.random() * 899)), tint: 2,
});

export const UPGRADES = [
  { id: "engine", name: "Engine", desc: "+Acceleration, +Top speed" },
  { id: "turbo", name: "Turbo", desc: "+Nitro thrust, +Mid-range pull" },
  { id: "tires", name: "Tires", desc: "+Grip, +Wet traction" },
  { id: "suspension", name: "Suspension", desc: "+Handling response, +Stability" },
  { id: "brakes", name: "Brakes", desc: "+Braking power" },
  { id: "nitro", name: "Nitro System", desc: "+Capacity, +Recharge" },
  { id: "aero", name: "Aerodynamics", desc: "+Top speed, +High-speed grip" },
] as const;
export const MAX_UPGRADE = 5;
export const upgradeCost = (lvl: number) => Math.round(450 * Math.pow(lvl + 1, 1.45) / 10) * 10;

export interface Derived {
  topSpeed: number; // m/s
  accel: number;
  brake: number;
  grip: number; // lateral grip rate
  latLimit: number; // lateral accel limit
  steerLow: number;
  driftMul: number;
  driftSlip: number;
  nitroCap: number;
  nitroRegen: number;
  nitroPower: number;
  mass: number;
  downforce: number;
  response: number;
}
export function derive(def: CarDef, u: number[]): Derived {
  const [eng, tur, tir, sus, brk, nit, aero] = u;
  const s = def.stats;
  return {
    topSpeed: (44 + s.speed * 2.8) * (1 + 0.012 * eng + 0.014 * aero + 0.008 * tur),
    accel: (6 + s.accel * 1.05) * (1 + 0.05 * eng + 0.03 * tur),
    brake: (21 + s.braking * 1.7) * (1 + 0.06 * brk),
    grip: 8 + s.handling * 0.85 + tir * 0.5,
    latLimit: 27 + s.handling * 2.3 + tir * 1.6 + sus * 0.8,
    steerLow: 1.5 + s.handling * 0.1 + sus * 0.03,
    driftMul: Math.max(0.22, 0.62 - s.drift * 0.035),
    driftSlip: 0.42 + s.drift * 0.03,
    nitroCap: (70 + s.nitro * 6) * (1 + 0.1 * nit),
    nitroRegen: 1.2 + 0.12 * nit + s.nitro * 0.08,
    nitroPower: 1.55 + s.nitro * 0.03 + tur * 0.05,
    mass: def.mass,
    downforce: 0.1 + aero * 0.03,
    response: 8 + s.handling * 0.6 + sus * 0.5,
  };
}

// ---------------------------------------------------------------- TRACKS
export interface Zone {
  k0: number; // control point index (float)
  k1: number;
  kind: "tunnel" | "bridge" | "cable";
}
export interface TrackDef {
  id: string;
  name: string;
  sub: string;
  desc: string;
  theme: "tokyo" | "mountain" | "desert" | "coast" | "cyber" | "skyline";
  accent: string;
  accent2: string;
  pts: number[][];
  halfW: number;
  wallExtra: number;
  shoulder: "none" | "grass" | "sand" | "gravel";
  laps: number;
  tod: Tod;
  weather: Weather;
  wet: number;
  zones: Zone[];
  music: { bpm: number; root: number; scale: "min" | "pent" | "dor" | "phr"; wave: OscillatorType };
  ambient: "none" | "sand" | "petals" | "sparks" | "dust" | "embers";
}

export const TRACKS: TrackDef[] = [
  {
    id: "tokyo", name: "Neon Tokyo", sub: "Midnight expressway", theme: "tokyo", accent: "#ff2fd0", accent2: "#17e0ff",
    desc: "Wet neon expressway through a futuristic skyline. Elevated roads, a tunnel and tight sweepers.",
    pts: [[0, 2, -200], [0, 2, 0], [10, 3, 200], [80, 5, 330], [220, 8, 400], [360, 10, 380], [460, 10, 260], [440, 8, 100], [380, 6, -30], [420, 4, -180], [520, 3, -320], [480, 2, -470], [320, 2, -560], [150, 2, -520], [40, 2, -400]],
    halfW: 9, wallExtra: 0.8, shoulder: "none", laps: 3, tod: "night", weather: "clear", wet: 0.75,
    zones: [{ k0: 12.1, k1: 13.6, kind: "tunnel" }],
    music: { bpm: 128, root: 57, scale: "min", wave: "sawtooth" }, ambient: "none",
  },
  {
    id: "mountain", name: "Dragon Mountain", sub: "Touge hairpin ascent", theme: "mountain", accent: "#ff4a2f", accent2: "#ffd21f",
    desc: "Winding mountain pass: hairpins, a gorge bridge, a rock tunnel, waterfalls and huge elevation changes.",
    pts: [[0, 0, -300], [0, 2, -100], [40, 6, 100], [160, 12, 230], [330, 20, 260], [480, 28, 190], [540, 36, 60], [480, 44, -40], [360, 48, -30], [330, 52, -120], [430, 50, -190], [560, 44, -250], [600, 36, -380], [500, 28, -480], [330, 18, -520], [160, 10, -470], [60, 4, -390]],
    halfW: 8.5, wallExtra: 5, shoulder: "gravel", laps: 3, tod: "sunny", weather: "clear", wet: 0,
    zones: [{ k0: 4.4, k1: 5.4, kind: "bridge" }, { k0: 12.2, k1: 13.4, kind: "tunnel" }],
    music: { bpm: 140, root: 52, scale: "phr", wave: "square" }, ambient: "petals",
  },
  {
    id: "desert", name: "Desert Storm", sub: "Sandstorm highway", theme: "desert", accent: "#ffb000", accent2: "#ff5a1f",
    desc: "Endless desert highway with huge dunes, mesas, abandoned outposts and a rolling sandstorm.",
    pts: [[0, 0, -500], [0, 0, -100], [0, 1, 300], [60, 2, 650], [250, 3, 850], [520, 5, 880], [760, 4, 760], [840, 3, 520], [760, 2, 300], [620, 2, 120], [640, 1, -120], [780, 1, -300], [740, 0, -560], [560, 0, -700], [330, 0, -720], [130, 0, -640]],
    halfW: 11, wallExtra: 14, shoulder: "sand", laps: 2, tod: "sunny", weather: "clear", wet: 0,
    zones: [],
    music: { bpm: 118, root: 50, scale: "phr", wave: "sawtooth" }, ambient: "sand",
  },
  {
    id: "coast", name: "Coastal Paradise", sub: "Sunset beach highway", theme: "coast", accent: "#ff8a3d", accent2: "#27d8ff",
    desc: "Sun-drenched coastal highway with ocean views, palm-lined beaches, a bay bridge and a headland tunnel.",
    pts: [[0, 2, -300], [0, 2, -100], [-30, 4, 120], [-150, 8, 260], [-330, 12, 300], [-470, 10, 200], [-500, 6, 40], [-420, 3, -100], [-300, 2, -200], [-260, 2, -340], [-330, 3, -480], [-200, 3, -600], [-30, 3, -560]],
    halfW: 9.5, wallExtra: 3.5, shoulder: "sand", laps: 3, tod: "sunset", weather: "clear", wet: 0,
    zones: [{ k0: 3.3, k1: 4.3, kind: "tunnel" }, { k0: 9.6, k1: 11.1, kind: "bridge" }],
    music: { bpm: 112, root: 55, scale: "dor", wave: "triangle" }, ambient: "none",
  },
  {
    id: "cyber", name: "Cyber Circuit", sub: "Neon grand-prix stadium", theme: "cyber", accent: "#17e0ff", accent2: "#7a2bff",
    desc: "A glowing futuristic stadium: laser barriers, packed grandstands and a technical infield.",
    pts: [[0, 0, -150], [0, 0, 100], [70, 0, 230], [200, 0, 260], [300, 0, 190], [270, 0, 80], [170, 0, 40], [150, 0, -60], [260, 0, -120], [340, 0, -220], [280, 0, -330], [140, 0, -360], [40, 0, -300]],
    halfW: 10, wallExtra: 1.2, shoulder: "none", laps: 4, tod: "night", weather: "clear", wet: 0.1,
    zones: [],
    music: { bpm: 150, root: 53, scale: "min", wave: "sawtooth" }, ambient: "sparks",
  },
  {
    id: "skyline", name: "Skyline Express", sub: "Suspended megacity highway", theme: "skyline", accent: "#ff4fe0", accent2: "#ffd21f",
    desc: "Elevated megacity highway in the clouds. Cable-suspended sections, a glass tunnel and vertigo drops.",
    pts: [[0, 80, -400], [0, 80, -100], [0, 84, 200], [-60, 90, 450], [-250, 96, 600], [-500, 100, 620], [-700, 96, 500], [-760, 90, 260], [-640, 84, 60], [-480, 80, -60], [-520, 76, -260], [-640, 72, -440], [-560, 70, -640], [-340, 74, -700], [-150, 78, -620]],
    halfW: 10, wallExtra: 0.8, shoulder: "none", laps: 3, tod: "sunset", weather: "clear", wet: 0.15,
    zones: [{ k0: 1.2, k1: 2.6, kind: "cable" }, { k0: 6.3, k1: 7.4, kind: "tunnel" }, { k0: 12.2, k1: 13.4, kind: "cable" }],
    music: { bpm: 132, root: 58, scale: "dor", wave: "sawtooth" }, ambient: "dust",
  },
];
export const trackById = (id: string) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];

export type Mode = "quick" | "championship" | "timetrial" | "battle";
export const MODES: { id: Mode; name: string; blurb: string }[] = [
  { id: "quick", name: "Quick Race", blurb: "Pick a track, pick your car, settle it." },
  { id: "championship", name: "Championship", blurb: "Six rounds. One champion. Points decide." },
  { id: "timetrial", name: "Time Trial", blurb: "Chase the clock and your own ghost." },
  { id: "battle", name: "Battle Race", blurb: "Power-ups, traps and shields. Skill still wins." },
];

export interface RaceSettings {
  track: string;
  laps: number;
  tod: Tod | "auto";
  weather: Weather | "auto";
}

export interface Gfx {
  preset: "low" | "medium" | "high" | "ultra" | "custom";
  res: number;
  shadows: 0 | 1 | 2 | 3;
  reflections: boolean;
  effects: 0 | 1 | 2 | 3;
  post: boolean;
  weatherDensity: number;
  fps: boolean;
  shake: boolean;
  split: "auto" | "vertical" | "horizontal";
}
export const GFX_PRESETS: Record<"low" | "medium" | "high" | "ultra", Gfx> = {
  low: { preset: "low", res: 0.7, shadows: 0, reflections: false, effects: 0, post: false, weatherDensity: 0.4, fps: false, shake: true, split: "auto" },
  medium: { preset: "medium", res: 0.85, shadows: 1, reflections: true, effects: 1, post: true, weatherDensity: 0.7, fps: false, shake: true, split: "auto" },
  high: { preset: "high", res: 1, shadows: 2, reflections: true, effects: 2, post: true, weatherDensity: 1, fps: false, shake: true, split: "auto" },
  ultra: { preset: "ultra", res: 1.25, shadows: 3, reflections: true, effects: 3, post: true, weatherDensity: 1.4, fps: false, shake: true, split: "auto" },
};
export const EFFECT_MULT = [0.35, 0.65, 1, 1.4];
