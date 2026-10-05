// Static game data: cars, tracks and environment themes.

export type CarType = "coupe" | "muscle" | "super" | "rally" | "formula" | "truck";

export interface CarDef {
  id: string;
  name: string;
  maker: string;
  type: CarType;
  blurb: string;
  maxSpeed: number; // m/s
  accel: number; // m/s^2
  handling: number; // yaw rate factor
  grip: number; // lateral grip decay
  brake: number; // m/s^2
  mass: number; // collision weight
  offroad: number; // 0..1 how well it copes with dirt/grass
  nitro: number; // nitro strength multiplier
  colors: number[];
}

export const PAINTS = [
  0xe11d2e, 0xff7a1a, 0xffd21f, 0x22c55e, 0x14b8e6, 0x2f5bff, 0x8b3dff, 0xff3da6, 0xf5f5f5, 0x1a1a1f,
];

export const CARS: CarDef[] = [
  {
    id: "apex",
    name: "Apex GT",
    maker: "Aurelia",
    type: "coupe",
    blurb: "Balanced grand-touring coupe. Forgiving, quick and great for learning every circuit.",
    maxSpeed: 66,
    accel: 17,
    handling: 2.3,
    grip: 8,
    brake: 30,
    mass: 1,
    offroad: 0.35,
    nitro: 1,
    colors: PAINTS,
  },
  {
    id: "viper",
    name: "Stallion V8",
    maker: "Brawn Motors",
    type: "muscle",
    blurb: "Raw American muscle. Monstrous torque out of corners, a handful when you lean on it.",
    maxSpeed: 69,
    accel: 19.5,
    handling: 1.85,
    grip: 6.5,
    brake: 26,
    mass: 1.35,
    offroad: 0.3,
    nitro: 1.1,
    colors: PAINTS,
  },
  {
    id: "falcon",
    name: "Falcon R",
    maker: "Zenith",
    type: "super",
    blurb: "Mid-engined hypercar with the highest top speed on the grid and fierce downforce.",
    maxSpeed: 78,
    accel: 20,
    handling: 2.2,
    grip: 8.5,
    brake: 33,
    mass: 0.95,
    offroad: 0.15,
    nitro: 1,
    colors: PAINTS,
  },
  {
    id: "dune",
    name: "Dune Runner",
    maker: "Kodiak Rally",
    type: "rally",
    blurb: "Turbo rally hatch with long-travel suspension. Shrugs off grass, sand and snow.",
    maxSpeed: 58,
    accel: 18.5,
    handling: 2.5,
    grip: 7.5,
    brake: 28,
    mass: 0.9,
    offroad: 0.9,
    nitro: 1.15,
    colors: PAINTS,
  },
  {
    id: "comet",
    name: "Comet F1",
    maker: "Nova Racing",
    type: "formula",
    blurb: "Open-wheel single seater. Insane agility and braking, but a feather in any collision.",
    maxSpeed: 74,
    accel: 22,
    handling: 2.75,
    grip: 9.5,
    brake: 37,
    mass: 0.6,
    offroad: 0.05,
    nitro: 0.9,
    colors: PAINTS,
  },
  {
    id: "rhino",
    name: "Rhino X",
    maker: "Titan Heavy",
    type: "truck",
    blurb: "Lifted off-road pickup. Slow to turn, impossible to push around and loves rough ground.",
    maxSpeed: 60,
    accel: 15.5,
    handling: 1.7,
    grip: 7,
    brake: 25,
    mass: 1.9,
    offroad: 0.8,
    nitro: 1.25,
    colors: PAINTS,
  },
];

export type ThemeId = "coast" | "alpine" | "city" | "desert" | "forest";
export type Weather = "clear" | "rain" | "snow";

export interface Theme {
  id: ThemeId;
  skyTop: number;
  skyMid: number;
  skyHorizon: number;
  fog: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  envIntensity: number;
  ground: number;
  runoff: number;
  asphalt: number;
  weather: Weather;
  night: boolean;
  exposure: number;
  cloudColor: number;
  cloudCount: number;
  roadRough: number;
  offroadGrip: number; // surface multiplier for the run-off area
  roadGrip: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  coast: {
    id: "coast",
    skyTop: 0x2a4a99,
    skyMid: 0xd9789a,
    skyHorizon: 0xffbf7a,
    fog: 0xf0b48a,
    fogDensity: 0.0011,
    sunColor: 0xffc58c,
    sunIntensity: 3.0,
    sunPos: [-0.8, 0.28, -0.55],
    hemiSky: 0xffd2a8,
    hemiGround: 0x4b6a86,
    hemiIntensity: 0.9,
    envIntensity: 0.55,
    ground: 0xe6d3a0,
    runoff: 0xcdb882,
    asphalt: 0x8a8a92,
    weather: "clear",
    night: false,
    exposure: 1.0,
    cloudColor: 0xffcfb0,
    cloudCount: 26,
    roadRough: 0.8,
    offroadGrip: 0.55,
    roadGrip: 1,
  },
  alpine: {
    id: "alpine",
    skyTop: 0x4d86cc,
    skyMid: 0x9cc2ea,
    skyHorizon: 0xe3eef8,
    fog: 0xdce8f2,
    fogDensity: 0.0019,
    sunColor: 0xfff4e0,
    sunIntensity: 2.6,
    sunPos: [0.5, 0.55, 0.6],
    hemiSky: 0xcfe4ff,
    hemiGround: 0xe8eef5,
    hemiIntensity: 1.1,
    envIntensity: 0.7,
    ground: 0xf3f7fb,
    runoff: 0xe3eaf2,
    asphalt: 0x7d8087,
    weather: "snow",
    night: false,
    exposure: 1.0,
    cloudColor: 0xffffff,
    cloudCount: 30,
    roadRough: 0.75,
    offroadGrip: 0.45,
    roadGrip: 0.92,
  },
  city: {
    id: "city",
    skyTop: 0x03051a,
    skyMid: 0x1c1050,
    skyHorizon: 0x7a2a8a,
    fog: 0x2a1448,
    fogDensity: 0.0017,
    sunColor: 0x7f93ff,
    sunIntensity: 0.55,
    sunPos: [0.4, 0.6, -0.5],
    hemiSky: 0x5a4fd0,
    hemiGround: 0x1b0f33,
    hemiIntensity: 0.55,
    envIntensity: 0.35,
    ground: 0x1a1a24,
    runoff: 0x262633,
    asphalt: 0x6a6a76,
    weather: "clear",
    night: true,
    exposure: 1.05,
    cloudColor: 0x3a2a6a,
    cloudCount: 10,
    roadRough: 0.45,
    offroadGrip: 0.7,
    roadGrip: 1,
  },
  desert: {
    id: "desert",
    skyTop: 0x2f82d4,
    skyMid: 0x8ec0e6,
    skyHorizon: 0xffe0b0,
    fog: 0xf2cc98,
    fogDensity: 0.0012,
    sunColor: 0xfff0d0,
    sunIntensity: 3.4,
    sunPos: [0.35, 0.62, 0.55],
    hemiSky: 0xbfdcff,
    hemiGround: 0xc98c52,
    hemiIntensity: 0.9,
    envIntensity: 0.6,
    ground: 0xdaa35d,
    runoff: 0xcc9450,
    asphalt: 0x8d8579,
    weather: "clear",
    night: false,
    exposure: 1.02,
    cloudColor: 0xffffff,
    cloudCount: 14,
    roadRough: 0.85,
    offroadGrip: 0.5,
    roadGrip: 1,
  },
  forest: {
    id: "forest",
    skyTop: 0x5d6f78,
    skyMid: 0x8a9a9d,
    skyHorizon: 0xb4c0bc,
    fog: 0x9fada9,
    fogDensity: 0.0028,
    sunColor: 0xd8e4e0,
    sunIntensity: 1.3,
    sunPos: [-0.3, 0.7, 0.4],
    hemiSky: 0xb8c8c4,
    hemiGround: 0x2b4026,
    hemiIntensity: 1.0,
    envIntensity: 0.5,
    ground: 0x3a6a30,
    runoff: 0x47792f,
    asphalt: 0x5d5f66,
    weather: "rain",
    night: false,
    exposure: 0.95,
    cloudColor: 0x8d9a9c,
    cloudCount: 34,
    roadRough: 0.32,
    offroadGrip: 0.42,
    roadGrip: 0.85,
  },
};

export type Harmonic = [number, number, number]; // k, amplitude, phase

export interface TrackDef {
  id: string;
  name: string;
  location: string;
  blurb: string;
  theme: ThemeId;
  difficulty: number; // 1..5
  laps: number;
  radius: number;
  stretch: [number, number];
  harmonics: Harmonic[];
  elev: Harmonic[];
  width: number;
  seed: number;
}

export const TRACKS: TrackDef[] = [
  {
    id: "coast",
    name: "Sunset Bay",
    location: "Amalfi Island",
    blurb: "Flowing seaside circuit under a blazing sunset. Palm-lined straights and fast sweepers.",
    theme: "coast",
    difficulty: 2,
    laps: 3,
    radius: 430,
    stretch: [1.3, 0.85],
    harmonics: [
      [2, 0.1, 0.5],
      [3, 0.12, 1.2],
      [5, 0.07, 2.0],
      [7, 0.02, 0.3],
    ],
    elev: [
      [2, 2.5, 0],
      [3, 1.5, 1],
    ],
    width: 16,
    seed: 11,
  },
  {
    id: "alpine",
    name: "Frostbite Pass",
    location: "Swiss Alps",
    blurb: "A snowy mountain road that rises and falls between pine forests. Grip is low, views are huge.",
    theme: "alpine",
    difficulty: 4,
    laps: 3,
    radius: 480,
    stretch: [1.1, 1],
    harmonics: [
      [2, 0.14, 0],
      [3, 0.16, 2.2],
      [4, 0.12, 0.7],
      [7, 0.05, 1],
    ],
    elev: [
      [1, 14, 0.5],
      [2, 9, 2],
      [3, 5, 1],
      [5, 2, 0],
    ],
    width: 15,
    seed: 23,
  },
  {
    id: "city",
    name: "Neon Nights",
    location: "Tokyo Bay",
    blurb: "Tight, technical street circuit through a glowing night-time skyline. Walls everywhere.",
    theme: "city",
    difficulty: 3,
    laps: 3,
    radius: 380,
    stretch: [1.3, 0.8],
    harmonics: [
      [2, 0.2, 0.3],
      [3, 0.12, 1.6],
      [4, 0.12, 3],
      [6, 0.07, 0.4],
      [9, 0.025, 1],
    ],
    elev: [
      [2, 1.5, 0],
      [4, 1, 2],
    ],
    width: 15,
    seed: 37,
  },
  {
    id: "desert",
    name: "Dustwind Canyon",
    location: "Arizona Mesa",
    blurb: "Blisteringly fast desert sweepers among towering red mesas. Top speed is king here.",
    theme: "desert",
    difficulty: 3,
    laps: 3,
    radius: 560,
    stretch: [1, 1],
    harmonics: [
      [2, 0.2, 1],
      [3, 0.1, 0],
      [5, 0.05, 2],
      [7, 0.02, 0.5],
    ],
    elev: [
      [1, 8, 0],
      [2, 6, 1.3],
      [3, 4, 2],
    ],
    width: 18,
    seed: 41,
  },
  {
    id: "forest",
    name: "Emerald Hollow",
    location: "Pacific Northwest",
    blurb: "Twisting wet forest road in the pouring rain. Rolling hills, thick fog and slippery asphalt.",
    theme: "forest",
    difficulty: 5,
    laps: 3,
    radius: 420,
    stretch: [1, 1],
    harmonics: [
      [3, 0.13, 0.4],
      [4, 0.1, 1.9],
      [5, 0.08, 0.2],
      [8, 0.03, 2.5],
    ],
    elev: [
      [2, 5, 1],
      [3, 4, 0],
      [5, 2.5, 0.3],
    ],
    width: 14,
    seed: 53,
  },
];

export const AI_NAMES = [
  "R. Castellano",
  "M. Tanaka",
  "J. Okafor",
  "L. Brandt",
  "S. Volkov",
  "A. Moreau",
  "D. Reyes",
  "K. Lindqvist",
  "T. Novak",
  "H. Singh",
];

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTY_SKILL: Record<Difficulty, number> = {
  easy: 0.8,
  medium: 0.9,
  hard: 0.98,
};
