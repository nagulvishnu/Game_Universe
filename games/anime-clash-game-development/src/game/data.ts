// Static game data: fighters, moves, arenas, input actions.

export type Element = "fire" | "lightning" | "dark" | "ice";
export type MoveType = "melee" | "proj" | "dash" | "zone" | "teleport" | "prison";

export interface MoveData {
  id: string;
  name: string;
  type: MoveType;
  element: Element | "none";
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  range: number;
  width: number;
  vert: number;
  hitstun: number;
  knock: number;
  launch: number;
  hitstop: number;
  guardDmg: number;
  ki: number;
  cd: number;
  anim: string;
  lunge: number;
  sound: string;
  // projectile
  count?: number;
  interval?: number;
  speed?: number;
  radius?: number;
  homing?: number;
  spread?: number;
  // dash
  dashSpeed?: number;
  invuln?: number;
  free?: boolean;
  // zone
  zoneR?: number;
  zoneLife?: number;
  // status
  freeze?: number;
  pull?: number;
  slow?: number;
  unblockable?: boolean;
  rehit?: number;
  spike?: boolean;
}

const base: MoveData = {
  id: "x", name: "Strike", type: "melee", element: "none",
  startup: 0.08, active: 0.07, recovery: 0.18, damage: 4, range: 1.6, width: 0.9, vert: 1.3,
  hitstun: 0.32, knock: 2.5, launch: 0, hitstop: 0.05, guardDmg: 1, ki: 0, cd: 0,
  anim: "jabL", lunge: 2.5, sound: "punch",
};
export const mv = (o: Partial<MoveData>): MoveData => ({ ...base, ...o });

export interface FighterDef {
  id: string;
  name: string;
  title: string;
  element: Element;
  color: string;
  color2: string;
  glow: number;
  glow2: number;
  formColor: number;
  formName: string;
  desc: string;
  hp: number;
  speed: number;
  power: number;
  defense: number;
  stats: { power: number; speed: number; range: number; defense: number; technique: number };
  light: MoveData[];
  heavy: MoveData;
  sig: MoveData;
  airLight: MoveData;
  airHeavy: MoveData;
  s1: MoveData;
  s2: MoveData;
  abilities: { key: string; name: string; desc: string }[];
  ult: { name: string; exName: string; desc: string };
}

const airLight = (el: Element | "none", dmg = 4) =>
  mv({ id: "airL", name: "Aerial Strike", element: el, anim: "airKick", startup: 0.06, active: 0.14, recovery: 0.16, damage: dmg, range: 1.5, width: 1, vert: 1.8, hitstun: 0.35, knock: 3, launch: 3.5, lunge: 3, hitstop: 0.05, sound: "kick" });
const airHeavy = (el: Element | "none", dmg = 8) =>
  mv({ id: "airH", name: "Meteor Slam", element: el, anim: "airSlam", startup: 0.16, active: 0.16, recovery: 0.2, damage: dmg, range: 1.4, width: 1.1, vert: 2.2, hitstun: 0.5, knock: 2, launch: -14, lunge: 0, hitstop: 0.09, spike: true, sound: "heavy" });

export const FIGHTERS: FighterDef[] = [
  {
    id: "kairo", name: "KAIRO", title: "THE INFERNO", element: "fire",
    color: "#ff4a1c", color2: "#ffb347", glow: 0xff5a1f, glow2: 0xffc04d, formColor: 0xffd23f,
    formName: "SOLAR BLAZE", hp: 1000, speed: 6.2, power: 1.0, defense: 1.0,
    desc: "A relentless brawler who burns hotter with every blow. Fast combos and brutal close-range fire.",
    stats: { power: 8, speed: 7, range: 4, defense: 5, technique: 6 },
    light: [
      mv({ id: "k1", name: "Ember Jab", anim: "jabL", damage: 40, startup: 0.06, active: 0.06, recovery: 0.16, range: 1.55, element: "fire" }),
      mv({ id: "k2", name: "Ember Cross", anim: "jabR", damage: 45, startup: 0.07, active: 0.06, recovery: 0.17, range: 1.6, element: "fire" }),
      mv({ id: "k3", name: "Blaze Hook", anim: "hook", damage: 65, startup: 0.1, active: 0.08, recovery: 0.3, range: 1.8, knock: 6, launch: 5, hitstun: 0.45, hitstop: 0.08, element: "fire", sound: "heavy" }),
    ],
    heavy: mv({ id: "kH", name: "Heavy Knuckle", anim: "cross", damage: 100, startup: 0.2, active: 0.08, recovery: 0.34, range: 1.9, knock: 7, launch: 4, hitstun: 0.5, hitstop: 0.09, lunge: 4, guardDmg: 2, sound: "heavy", element: "fire" }),
    sig: mv({ id: "kS", name: "Dragon Fist", type: "melee", element: "fire", anim: "uppercut", damage: 140, startup: 0.2, active: 0.12, recovery: 0.45, range: 2.5, width: 1.1, vert: 1.8, knock: 5, launch: 12, hitstun: 0.7, hitstop: 0.12, lunge: 7, ki: 20, cd: 4, guardDmg: 2.5, sound: "fire" }),
    airLight: airLight("fire", 40), airHeavy: airHeavy("fire", 85),
    s1: mv({ id: "k_s1", name: "Flame Burst", type: "proj", element: "fire", anim: "cast", damage: 42, startup: 0.1, active: 0.2, recovery: 0.2, count: 3, interval: 0.09, speed: 21, radius: 0.55, hitstun: 0.3, knock: 3, ki: 15, cd: 0.9, sound: "fire", hitstop: 0.04 }),
    s2: mv({ id: "k_s2", name: "Inferno Dash", type: "dash", element: "fire", anim: "dashPose", damage: 85, startup: 0.1, active: 0.38, recovery: 0.3, dashSpeed: 21, range: 1.7, width: 1.1, vert: 1.6, knock: 6, launch: 8, hitstun: 0.6, hitstop: 0.1, ki: 25, cd: 3.2, sound: "fire", guardDmg: 2 }),
    abilities: [
      { key: "S1", name: "Flame Burst", desc: "Rapid triple fire projectile." },
      { key: "S2", name: "Inferno Dash", desc: "High-speed flaming charge that launches." },
      { key: "HEAVY", name: "Dragon Fist", desc: "Rising flame uppercut. Launches foes." },
      { key: "ULT", name: "Phoenix Cataclysm", desc: "A colossal phoenix dives onto the foe." },
    ],
    ult: { name: "PHOENIX CATACLYSM", exName: "SOLAR PHOENIX APOCALYPSE", desc: "Summons a flaming phoenix that dives into the opponent." },
  },
  {
    id: "ryujin", name: "RYUJIN", title: "THE THUNDER GOD", element: "lightning",
    color: "#46a8ff", color2: "#e8f6ff", glow: 0x4fb8ff, glow2: 0xdff4ff, formColor: 0xfff07a,
    formName: "SUPER VOLT", hp: 880, speed: 7.4, power: 0.92, defense: 0.92,
    desc: "The fastest fighter alive. Lightning reflexes, high mobility, and relentless pressure.",
    stats: { power: 6, speed: 10, range: 6, defense: 4, technique: 8 },
    light: [
      mv({ id: "r1", name: "Spark Jab", anim: "jabR", damage: 32, startup: 0.04, active: 0.05, recovery: 0.12, range: 1.5, element: "lightning", lunge: 3.5 }),
      mv({ id: "r2", name: "Spark Hook", anim: "jabL", damage: 34, startup: 0.05, active: 0.05, recovery: 0.12, range: 1.55, element: "lightning", lunge: 3.5 }),
      mv({ id: "r3", name: "Volt Kick", anim: "roundhouse", damage: 55, startup: 0.08, active: 0.07, recovery: 0.26, range: 1.95, knock: 6, launch: 4, hitstun: 0.4, hitstop: 0.07, element: "lightning", sound: "kick", lunge: 4 }),
    ],
    heavy: mv({ id: "rH", name: "Thunder Palm", anim: "cross", damage: 85, startup: 0.17, active: 0.07, recovery: 0.3, range: 2.0, knock: 7, launch: 3, hitstun: 0.45, hitstop: 0.08, lunge: 5, guardDmg: 2, sound: "heavy", element: "lightning" }),
    sig: mv({ id: "rS", name: "Thunder Cage", type: "zone", element: "lightning", anim: "castUp", damage: 22, startup: 0.25, active: 0.1, recovery: 0.3, zoneR: 2.7, zoneLife: 2.6, hitstun: 0.18, knock: 0.5, ki: 25, cd: 7, sound: "thunder", hitstop: 0.02 }),
    airLight: airLight("lightning", 32), airHeavy: airHeavy("lightning", 70),
    s1: mv({ id: "r_s1", name: "Thunder Strike", type: "proj", element: "lightning", anim: "cast", damage: 70, startup: 0.1, active: 0.05, recovery: 0.17, count: 1, speed: 34, radius: 0.5, hitstun: 0.38, knock: 4, ki: 15, cd: 0.9, sound: "thunder", hitstop: 0.06 }),
    s2: mv({ id: "r_s2", name: "Flash Step", type: "dash", element: "lightning", anim: "dashPose", damage: 60, startup: 0.05, active: 0.2, recovery: 0.18, dashSpeed: 38, range: 1.6, width: 1.2, vert: 1.8, knock: 5, launch: 4, hitstun: 0.45, hitstop: 0.07, ki: 20, cd: 2.4, invuln: 0.28, free: true, sound: "thunder" }),
    abilities: [
      { key: "S1", name: "Thunder Strike", desc: "Fast lightning projectile." },
      { key: "S2", name: "Flash Step", desc: "Invulnerable lightning dash in any direction." },
      { key: "HEAVY", name: "Thunder Cage", desc: "Lightning zone that shocks and slows." },
      { key: "ULT", name: "Heaven's Judgment", desc: "A gigantic bolt and electrical shockwave." },
    ],
    ult: { name: "HEAVEN'S JUDGMENT", exName: "DIVINE TRIBULATION", desc: "Calls a colossal bolt from the heavens, then a ground shockwave." },
  },
  {
    id: "akuma", name: "AKUMA", title: "THE VOID WARRIOR", element: "dark",
    color: "#b04dff", color2: "#ff5ad8", glow: 0xa23cff, glow2: 0xff55e0, formColor: 0xff2a5a,
    formName: "ABYSS AWAKENED", hp: 1100, speed: 5.6, power: 1.12, defense: 1.05,
    desc: "A heavy-hitting shadow stalker. Teleports, drags enemies in, and crushes guard.",
    stats: { power: 10, speed: 5, range: 5, defense: 7, technique: 7 },
    light: [
      mv({ id: "a1", name: "Shade Jab", anim: "jabL", damage: 46, startup: 0.09, active: 0.06, recovery: 0.2, range: 1.7, element: "dark" }),
      mv({ id: "a2", name: "Shade Cross", anim: "jabR", damage: 50, startup: 0.09, active: 0.06, recovery: 0.2, range: 1.75, element: "dark" }),
      mv({ id: "a3", name: "Abyss Slash", anim: "roundhouse", damage: 78, startup: 0.12, active: 0.08, recovery: 0.34, range: 2.0, knock: 7, launch: 6, hitstun: 0.5, hitstop: 0.09, element: "dark", sound: "heavy" }),
    ],
    heavy: mv({ id: "aH", name: "Void Smash", anim: "slam", damage: 115, startup: 0.26, active: 0.09, recovery: 0.4, range: 2.0, knock: 8, launch: 3, hitstun: 0.55, hitstop: 0.1, lunge: 3, guardDmg: 3, sound: "heavy", element: "dark" }),
    sig: mv({ id: "aS", name: "Abyss Breaker", type: "melee", element: "dark", anim: "slam", damage: 165, startup: 0.3, active: 0.12, recovery: 0.5, range: 2.8, width: 1.4, vert: 1.8, knock: 11, launch: 7, hitstun: 0.8, hitstop: 0.14, lunge: 4, ki: 20, cd: 4, guardDmg: 4, sound: "dark", unblockable: false }),
    airLight: airLight("dark", 46), airHeavy: airHeavy("dark", 95),
    s1: mv({ id: "a_s1", name: "Void Orb", type: "proj", element: "dark", anim: "cast", damage: 90, startup: 0.2, active: 0.05, recovery: 0.25, count: 1, speed: 12, radius: 0.85, homing: 1.4, hitstun: 0.5, knock: 3, pull: 6, ki: 20, cd: 1.6, sound: "dark", hitstop: 0.08 }),
    s2: mv({ id: "a_s2", name: "Shadow Reversal", type: "teleport", element: "dark", anim: "jabR", damage: 80, startup: 0.14, active: 0.1, recovery: 0.3, range: 1.9, width: 1.3, vert: 1.8, knock: 6, launch: 4, hitstun: 0.5, hitstop: 0.09, ki: 25, cd: 3.5, invuln: 0.3, sound: "dark" }),
    abilities: [
      { key: "S1", name: "Void Orb", desc: "Slow homing dark orb that drags targets in." },
      { key: "S2", name: "Shadow Reversal", desc: "Teleport behind the opponent and strike." },
      { key: "HEAVY", name: "Abyss Breaker", desc: "Devastating dark strike with a ground-cracking wave." },
      { key: "ULT", name: "Absolute Void", desc: "A dark sphere engulfs the foe, then detonates." },
    ],
    ult: { name: "ABSOLUTE VOID", exName: "DIMENSIONAL COLLAPSE", desc: "Engulfs the opponent in a singularity that collapses in a dimensional blast." },
  },
  {
    id: "shiro", name: "SHIRO", title: "THE FROST EMPEROR", element: "ice",
    color: "#7fe6ff", color2: "#ffffff", glow: 0x76e2ff, glow2: 0xe8fbff, formColor: 0xb8a6ff,
    formName: "ABSOLUTE ZERO", hp: 940, speed: 6.0, power: 0.98, defense: 1.0,
    desc: "An elegant controller with the longest reach. Freezes, slows, and punishes mistakes.",
    stats: { power: 7, speed: 6, range: 9, defense: 6, technique: 10 },
    light: [
      mv({ id: "s1a", name: "Frost Jab", anim: "jabR", damage: 36, startup: 0.07, active: 0.06, recovery: 0.15, range: 1.95, element: "ice" }),
      mv({ id: "s2a", name: "Frost Slash", anim: "jabL", damage: 38, startup: 0.07, active: 0.06, recovery: 0.15, range: 2.0, element: "ice" }),
      mv({ id: "s3a", name: "Glacier Sweep", anim: "roundhouse", damage: 58, startup: 0.1, active: 0.08, recovery: 0.3, range: 2.3, knock: 6, launch: 4, hitstun: 0.45, hitstop: 0.08, element: "ice", sound: "ice" }),
    ],
    heavy: mv({ id: "sH", name: "Crystal Palm", anim: "cross", damage: 90, startup: 0.2, active: 0.08, recovery: 0.34, range: 2.4, knock: 7, launch: 3, hitstun: 0.5, hitstop: 0.09, lunge: 3.5, guardDmg: 2, sound: "heavy", element: "ice" }),
    sig: mv({ id: "sS", name: "Ice Prison", type: "prison", element: "ice", anim: "cast", damage: 45, startup: 0.22, active: 0.05, recovery: 0.32, speed: 25, radius: 0.7, freeze: 1.9, hitstun: 0.3, ki: 25, cd: 6, sound: "ice", hitstop: 0.08 }),
    airLight: airLight("ice", 36), airHeavy: airHeavy("ice", 80),
    s1: mv({ id: "s_s1", name: "Frost Spear", type: "proj", element: "ice", anim: "cast", damage: 68, startup: 0.12, active: 0.05, recovery: 0.2, count: 1, speed: 28, radius: 0.5, hitstun: 0.38, knock: 4.5, slow: 1.8, ki: 15, cd: 1.0, sound: "ice", hitstop: 0.06 }),
    s2: mv({ id: "s_s2", name: "Frozen Step", type: "dash", element: "ice", anim: "dashPose", damage: 45, startup: 0.05, active: 0.3, recovery: 0.16, dashSpeed: 25, range: 1.6, width: 1.2, vert: 1.6, knock: 4, hitstun: 0.4, hitstop: 0.06, ki: 18, cd: 2.0, invuln: 0.2, free: true, slow: 2.0, sound: "ice" }),
    abilities: [
      { key: "S1", name: "Frost Spear", desc: "Ice projectile that slows." },
      { key: "S2", name: "Frozen Step", desc: "Evasive ice slide that chills foes." },
      { key: "HEAVY", name: "Ice Prison", desc: "Freezes the opponent solid on hit." },
      { key: "ULT", name: "Eternal Winter", desc: "Freezes the battlefield, then shatters it." },
    ],
    ult: { name: "ETERNAL WINTER", exName: "ABSOLUTE ZERO REQUIEM", desc: "A wave of frost sweeps the arena, ending in a spectacular ice explosion." },
  },
];

export interface ArenaDef {
  id: string;
  name: string;
  sub: string;
  desc: string;
  colorA: string;
  colorB: string;
  music: string;
}

export const ARENAS: ArenaDef[] = [
  { id: "tokyo", name: "NEO TOKYO", sub: "Neon Rooftop", desc: "A rain-soaked rooftop above a futuristic neon metropolis.", colorA: "#ff2bd6", colorB: "#18d4ff", music: "tokyo" },
  { id: "dragon", name: "DRAGON SANCTUARY", sub: "Ancient Temple", desc: "Sacred stone ring guarded by dragons, beneath floating peaks.", colorA: "#ff9a3c", colorB: "#ff3b3b", music: "dragon" },
  { id: "celestial", name: "CELESTIAL RUINS", sub: "Floating Islands", desc: "Shattered marble beneath a cosmic sky of living crystal.", colorA: "#8c6bff", colorB: "#4de1ff", music: "celestial" },
];

// ---------- Input ----------
export type Action =
  | "up" | "down" | "left" | "right" | "jump" | "light" | "heavy" | "s1" | "s2" | "ult" | "block" | "dash" | "transform";

export const ACTIONS: Action[] = ["up", "down", "left", "right", "jump", "light", "heavy", "s1", "s2", "ult", "block", "dash", "transform"];

export const ACTION_LABEL: Record<Action, string> = {
  up: "Move Forward", down: "Move Backward", left: "Move Left", right: "Move Right", jump: "Jump",
  light: "Light Attack", heavy: "Heavy Attack", s1: "Special 1", s2: "Special 2", ult: "Ultimate",
  block: "Block / Parry", dash: "Dash", transform: "Transform",
};

export type Bindings = Record<Action, string>;

export const DEFAULT_BINDINGS: [Bindings, Bindings] = [
  { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", jump: "Space", light: "KeyF", heavy: "KeyG", s1: "KeyR", s2: "KeyT", ult: "KeyV", block: "KeyC", dash: "KeyX", transform: "KeyB" },
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", jump: "Enter", light: "KeyJ", heavy: "KeyK", s1: "KeyU", s2: "KeyI", ult: "KeyO", block: "KeyL", dash: "ShiftRight", transform: "ControlRight" },
];

export type PadMap = Partial<Record<Action, number>>;
export const DEFAULT_PADMAP: PadMap = { jump: 0, dash: 1, light: 2, heavy: 3, s1: 4, s2: 5, block: 6, ult: 7, transform: 8 };

export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const m: Record<string, string> = {
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ShiftRight: "R-Shift", ShiftLeft: "L-Shift",
    ControlRight: "R-Ctrl", ControlLeft: "L-Ctrl", Space: "Space", Enter: "Enter", NumpadEnter: "Num Enter",
    Slash: "/", Period: ".", Comma: ",", Semicolon: ";", Quote: "'", AltRight: "R-Alt", AltLeft: "L-Alt", Backspace: "Bksp",
  };
  return m[code] ?? code;
}

export const PAD_BUTTON_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Back", "Start", "L3", "R3", "D↑", "D↓", "D←", "D→"];

export const PLAYER_COLORS = ["#3da5ff", "#ff4a5c"];
