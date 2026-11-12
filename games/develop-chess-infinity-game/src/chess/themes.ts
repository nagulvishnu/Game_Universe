export interface BoardTheme {
  id: string; name: string; blurb: string;
  light: string; dark: string; lightBg?: string; darkBg?: string;
  frame: string; page: string; accent: string; accent2: string;
  lastMove: string; select: string; coordLight: string; coordDark: string;
  pieces: string; fx: string;
}

const grain = (c: string) => `repeating-linear-gradient(92deg, ${c} 0 1px, transparent 1px 7px), repeating-linear-gradient(88deg, transparent 0 11px, ${c} 11px 12px)`;

export const BOARD_THEMES: BoardTheme[] = [
  { id: "wood", name: "Classic Wood", blurb: "Warm maple and walnut grain.", light: "#efd7b0", dark: "#a97449",
    lightBg: `${grain("rgba(140,90,40,.08)")}, #efd7b0`, darkBg: `${grain("rgba(40,20,5,.14)")}, #a97449`,
    frame: "#4a2f1a", page: "radial-gradient(1200px 700px at 20% 0%, #4a3322 0%, #1d140d 60%, #0f0a06 100%)",
    accent: "#e6a756", accent2: "#c7743a", lastMove: "rgba(255,213,79,.5)", select: "rgba(255,235,100,.7)", coordLight: "#a97449", coordDark: "#efd7b0", pieces: "staunton", fx: "fx-wood" },
  { id: "midnight", name: "Midnight Gold", blurb: "Deep navy squares with gilded light.", light: "#3b4570", dark: "#171c36",
    lightBg: "linear-gradient(135deg,#444f7e,#333c64)", darkBg: "linear-gradient(135deg,#1c2240,#121629)",
    frame: "#c9a227", page: "radial-gradient(1100px 700px at 80% 0%, #232a52 0%, #0b0e1f 60%, #05060e 100%)",
    accent: "#f5c542", accent2: "#c9a227", lastMove: "rgba(245,197,66,.38)", select: "rgba(245,197,66,.6)", coordLight: "#171c36", coordDark: "#c9a227", pieces: "royal", fx: "fx-gold" },
  { id: "neon", name: "Neon Cyber", blurb: "Glowing grid on black glass.", light: "#16213e", dark: "#0a0f1f",
    lightBg: "linear-gradient(135deg,#1b2a4d,#121b34)", darkBg: "linear-gradient(135deg,#0d1427,#070b17)",
    frame: "#00e5ff", page: "radial-gradient(900px 600px at 15% 10%, #1a0f3a 0%, transparent 60%), radial-gradient(900px 600px at 90% 90%, #002a3a 0%, transparent 60%), #05060f",
    accent: "#00e5ff", accent2: "#ff3df2", lastMove: "rgba(0,229,255,.28)", select: "rgba(255,61,242,.45)", coordLight: "#00e5ff", coordDark: "#00e5ff", pieces: "neon", fx: "fx-neon" },
  { id: "marble", name: "Royal Marble", blurb: "Polished white and slate marble.", light: "#ebe9e6", dark: "#8b93a3",
    lightBg: "radial-gradient(ellipse at 20% 30%, rgba(160,160,170,.25), transparent 40%), linear-gradient(120deg, transparent 40%, rgba(120,120,135,.18) 41%, transparent 43%), #ebe9e6",
    darkBg: "radial-gradient(ellipse at 70% 60%, rgba(255,255,255,.18), transparent 45%), linear-gradient(60deg, transparent 50%, rgba(40,45,60,.25) 51%, transparent 53%), #8b93a3",
    frame: "#3e4352", page: "radial-gradient(1100px 700px at 50% 0%, #3b4258 0%, #181b27 70%, #0d0f16 100%)",
    accent: "#8fa2ff", accent2: "#c9d1ff", lastMove: "rgba(120,140,255,.42)", select: "rgba(120,140,255,.6)", coordLight: "#8b93a3", coordDark: "#ebe9e6", pieces: "stone", fx: "fx-marble" },
  { id: "emerald", name: "Emerald Forest", blurb: "Moss, leaves and quiet woodland.", light: "#e4ecc4", dark: "#4f8a5b",
    lightBg: "radial-gradient(circle at 30% 30%, rgba(255,255,255,.35), transparent 50%), #e4ecc4", darkBg: "radial-gradient(circle at 70% 70%, rgba(180,255,190,.18), transparent 55%), #4f8a5b",
    frame: "#1d3d2b", page: "radial-gradient(1100px 700px at 30% 0%, #1f4a35 0%, #0c1f16 65%, #06100b 100%)",
    accent: "#86e0a0", accent2: "#d9f27a", lastMove: "rgba(210,242,100,.45)", select: "rgba(210,242,100,.65)", coordLight: "#4f8a5b", coordDark: "#e4ecc4", pieces: "fantasy", fx: "fx-emerald" },
  { id: "cosmic", name: "Cosmic Galaxy", blurb: "Violet nebula with drifting stars.", light: "#6a5aa8", dark: "#2b2058",
    lightBg: "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 70%, #fff9, transparent), linear-gradient(135deg,#7463b5,#5a4a96)",
    darkBg: "radial-gradient(1px 1px at 30% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 80% 25%, #fffc, transparent), linear-gradient(135deg,#33276a,#1f1745)",
    frame: "#7c5cff", page: "radial-gradient(800px 500px at 10% 10%, #4b2a8a55 0%, transparent 60%), radial-gradient(900px 600px at 90% 80%, #1c3a8a55 0%, transparent 60%), #07041a",
    accent: "#b388ff", accent2: "#7c9bff", lastMove: "rgba(179,136,255,.45)", select: "rgba(255,213,255,.55)", coordLight: "#2b2058", coordDark: "#b9a9f0", pieces: "neon", fx: "fx-cosmic" },
  { id: "minimal", name: "Minimal Tournament", blurb: "Clean, high-contrast and distraction-free.", light: "#eeeed2", dark: "#769656",
    frame: "#2d2b28", page: "radial-gradient(1000px 600px at 50% 0%, #3a3835 0%, #1f1e1c 70%, #151413 100%)",
    accent: "#bacb44", accent2: "#769656", lastMove: "rgba(255,255,0,.4)", select: "rgba(20,85,30,.5)", coordLight: "#769656", coordDark: "#eeeed2", pieces: "minimal", fx: "fx-minimal" },
];

export const themeById = (id: string) => BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
