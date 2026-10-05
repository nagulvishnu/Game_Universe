import * as THREE from "three";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function tex(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  return t;
}

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

/** u across the road, v along it (one tile = 25 m). */
export function asphaltTexture(base: number, seed = 1) {
  const { c, g } = canvas(512, 512);
  const r = mulberry32(seed);
  g.fillStyle = hex(base);
  g.fillRect(0, 0, 512, 512);
  // grain
  for (let i = 0; i < 26000; i++) {
    const v = Math.floor(r() * 70);
    const lightOrDark = r() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${lightOrDark},${lightOrDark},${lightOrDark},${v / 700})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  // darker tyre lanes
  for (const x of [0.28, 0.72]) {
    const grad = g.createLinearGradient((x - 0.1) * 512, 0, (x + 0.1) * 512, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.22)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect((x - 0.1) * 512, 0, 0.2 * 512, 512);
  }
  // edge lines
  g.fillStyle = "rgba(245,245,245,0.92)";
  g.fillRect(512 * 0.035, 0, 512 * 0.016, 512);
  g.fillRect(512 * 0.949, 0, 512 * 0.016, 512);
  // centre dashes
  g.fillStyle = "rgba(255,226,120,0.9)";
  g.fillRect(512 * 0.4925, 0, 512 * 0.015, 512 * 0.38);
  g.fillStyle = "rgba(245,245,245,0.55)";
  for (const x of [0.33, 0.66]) g.fillRect(512 * x - 3, 0, 6, 512 * 0.2);
  const t = tex(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

export function noiseTexture(seed = 3, contrast = 0.18, size = 256) {
  const { c, g } = canvas(size, size);
  const r = mulberry32(seed);
  g.fillStyle = "#e6e6e6";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = 230 - Math.floor(r() * 255 * contrast);
    g.fillStyle = `rgb(${v},${v},${v})`;
    const s = 1 + r() * 4;
    g.fillRect(r() * size, r() * size, s, s);
  }
  // soft patches
  for (let i = 0; i < 60; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 10 + r() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = r() * 0.12;
    gr.addColorStop(0, `rgba(0,0,0,${a})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return tex(c);
}

export function curbTexture() {
  const { c, g } = canvas(64, 128);
  g.fillStyle = "#e8e8e8";
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = "#d8232a";
  g.fillRect(0, 0, 64, 64);
  return tex(c);
}

export function barrierTexture(accent = "#d8232a") {
  // x = vertical direction, y = along length
  const { c, g } = canvas(64, 256);
  g.fillStyle = "#cfd2d6";
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = "#b3b7bd";
  g.fillRect(0, 0, 64, 6);
  g.fillRect(0, 122, 64, 12);
  g.fillStyle = accent;
  g.fillRect(14, 0, 36, 128);
  g.fillStyle = "#fafafa";
  g.fillRect(14, 128, 36, 128);
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(0, 0, 64, 2);
  g.fillRect(0, 126, 64, 3);
  return tex(c);
}

export function checkerTexture(cols = 8, rows = 2) {
  const s = 32;
  const { c, g } = canvas(cols * s, rows * s);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 ? "#111" : "#f5f5f5";
      g.fillRect(x * s, y * s, s, s);
    }
  }
  const t = tex(c, false);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function crowdTexture(seed = 5) {
  const { c, g } = canvas(256, 64);
  const r = mulberry32(seed);
  g.fillStyle = "#2b2f38";
  g.fillRect(0, 0, 256, 64);
  const cols = ["#e63946", "#f1c40f", "#3498db", "#ecf0f1", "#2ecc71", "#e67e22", "#9b59b6", "#ff6fa5"];
  for (let i = 0; i < 700; i++) {
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.fillRect(r() * 256, r() * 64, 3, 3);
  }
  return tex(c);
}

export function signTexture(text: string, bg: string, fg: string, sub = "") {
  const { c, g } = canvas(512, 160);
  const grad = g.createLinearGradient(0, 0, 512, 160);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, "#000000");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 144);
  g.fillStyle = fg;
  g.font = "italic 900 84px Arial Black, Impact, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, sub ? 64 : 82);
  if (sub) {
    g.font = "bold 28px Arial, sans-serif";
    g.fillText(sub, 256, 128);
  }
  return tex(c, false);
}

export function bannerTexture() {
  const { c, g } = canvas(1024, 128);
  g.fillStyle = "#101216";
  g.fillRect(0, 0, 1024, 128);
  const s = 16;
  for (let y = 0; y < 128 / s; y++) {
    for (let x = 0; x < 1024 / s; x++) {
      if ((x + y) % 2 === 0) continue;
      if (y > 1 && y < 6 && x > 8 && x < 55) continue;
      g.fillStyle = "#f2f2f2";
      g.fillRect(x * s, y * s, s, s);
    }
  }
  g.fillStyle = "#101216";
  g.fillRect(9 * s - 6, 2 * s - 4, 46 * s + 12, 4 * s + 8);
  g.fillStyle = "#ffffff";
  g.font = "italic 900 58px Arial Black, Impact, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("START  /  FINISH", 512, 66);
  return tex(c, false);
}

export function glowTexture(inner = "rgba(255,255,255,1)") {
  const { c, g } = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.35, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return tex(c, false);
}

export function cloudTexture(seed = 9) {
  const { c, g } = canvas(256, 128);
  const r = mulberry32(seed);
  for (let i = 0; i < 16; i++) {
    const x = 50 + r() * 156;
    const y = 50 + r() * 28;
    const rad = 22 + r() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,0.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return tex(c, false);
}

export function windowTexture(seed = 2, warm = true) {
  const { c, g } = canvas(128, 128);
  const r = mulberry32(seed);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 128, 128);
  const palette = warm
    ? ["#ffd48a", "#ffe9b8", "#9fd8ff", "#ff9bd4", "#c7b6ff"]
    : ["#ffffff"];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (r() < 0.42) continue;
      g.fillStyle = palette[Math.floor(r() * palette.length)];
      g.globalAlpha = 0.5 + r() * 0.5;
      g.fillRect(x * 8 + 1, y * 8 + 1, 5, 5);
    }
  }
  g.globalAlpha = 1;
  const t = tex(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function waveTexture(seed = 4) {
  const { c, g } = canvas(256, 256);
  const r = mulberry32(seed);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const x = r() * 256;
    const y = r() * 256;
    const rad = 6 + r() * 22;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() > 0.5 ? 255 : 0;
    gr.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = gr;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) g.fillRect(x - rad + ox, y - rad + oy, rad * 2, rad * 2);
  }
  return tex(c, true, false);
}

export function dotTexture() {
  const { c, g } = canvas(32, 32);
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return tex(c, false);
}
