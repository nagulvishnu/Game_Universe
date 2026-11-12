import * as THREE from 'three';

const cache: Record<string, THREE.Texture> = {};
function mk(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = false): THREE.Texture {
  if (cache[key]) return cache[key];
  if (typeof document === 'undefined') return (cache[key] = new THREE.Texture());
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (cache[key] = t);
}
const rnd = (() => { let s = 1337; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

export const glowTex = () => mk('glow', 64, 64, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
export const ringTex = () => mk('ring', 128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.68, 'rgba(255,255,255,0)'); r.addColorStop(.8, 'rgba(255,255,255,.25)'); r.addColorStop(.93, 'rgba(255,255,255,1)'); r.addColorStop(.985, 'rgba(255,255,255,.4)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
export const discTex = () => mk('disc', 128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,.35)'); r.addColorStop(.85, 'rgba(255,255,255,.45)'); r.addColorStop(.93, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
export const slashTex = () => mk('slash', 128, 64, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h; // u along arc, v inner->outer
    const edge = Math.pow(Math.max(0, v), 2.2), core = Math.exp(-Math.pow((v - .93) * 14, 2));
    const fade = Math.min(1, u / .22) * Math.min(1, (1 - u) / .12);
    const a = Math.min(1, (edge * .55 + core * .9) * fade * (.75 + .25 * Math.sin(u * 40 + v * 6)));
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
});
export const crackTex = () => mk('crack', 256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 6; g.lineCap = 'round';
  const branch = (x: number, y: number, a: number, len: number, wd: number, d: number) => {
    if (d > 4 || len < 5) return; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y);
    let cx = x, cy = y, ca = a;
    for (let i = 0; i < 6; i++) { ca += (rnd() - .5) * .8; cx += Math.cos(ca) * len / 6; cy += Math.sin(ca) * len / 6; g.lineTo(cx, cy); }
    g.stroke();
    if (rnd() < .9) branch(cx, cy, ca + .6 + rnd() * .4, len * .55, wd * .6, d + 1);
    if (rnd() < .8) branch(x + (cx - x) * .5, y + (cy - y) * .5, ca - .7 - rnd() * .4, len * .5, wd * .6, d + 1);
  };
  for (let i = 0; i < 9; i++) branch(w / 2, h / 2, (i / 9) * Math.PI * 2 + rnd() * .4, 110 + rnd() * 20, 4, 0);
});
export const runeTex = () => mk('rune', 256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 5; g.lineWidth = 3;
  const c = w / 2; for (const r of [122, 112, 78]) { g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; g.lineWidth = i % 4 ? 2 : 4; g.beginPath(); g.moveTo(c + Math.cos(a) * 112, c + Math.sin(a) * 112); g.lineTo(c + Math.cos(a) * (i % 4 ? 119 : 104), c + Math.sin(a) * (i % 4 ? 119 : 104)); g.stroke(); }
  g.lineWidth = 2.5; for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2 + k * Math.PI / 6 + .3; const x = c + Math.cos(a) * 78, y = c + Math.sin(a) * 78; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = 95; g.save(); g.translate(c + Math.cos(a) * rr, c + Math.sin(a) * rr); g.rotate(a + Math.PI / 2); g.fillRect(-1.5, -9, 3, 18); g.fillRect(-6, -3, 12, 3); if (i % 3 == 0) g.fillRect(-5, 4, 10, 3); g.restore(); }
  g.beginPath(); g.arc(c, c, 14, 0, 7); g.stroke();
}, true);
export const stoneTex = (base: string, line: string, glow = '') => mk('stone' + base + line + glow, 256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) { const v = rnd() * 40 - 20; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 300})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 2 + rnd() * 6); }
  g.strokeStyle = line; g.lineWidth = 3; const n = 4; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(0, i * h / n); g.lineTo(w, i * h / n); g.stroke(); g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, h); g.stroke(); }
  if (glow) { g.strokeStyle = glow; g.lineWidth = 1.5; g.shadowColor = glow; g.shadowBlur = 6; for (let i = 0; i < 5; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 60; y += (rnd() - .5) * 60; g.lineTo(x, y); } g.stroke(); } }
}, true);
export const lavaTex = () => mk('lava', 256, 256, (g, w, h) => {
  g.fillStyle = '#3a0a00'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,200,40,.95)'); gr.addColorStop(.4, 'rgba(255,90,10,.7)'); gr.addColorStop(1, 'rgba(120,10,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.fillStyle = 'rgba(20,4,0,.55)'; for (let i = 0; i < 60; i++) { g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 18, 3 + rnd() * 8, rnd() * 3, 0, 7); g.fill(); }
}, true);
/** emissive crack map for blades (white cracks on black) */
export const bladeCrackTex = () => mk('bladecrack', 64, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 5; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) { let x = rnd() * w, y = rnd() * h; g.lineWidth = 1.5 + rnd() * 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (rnd() - .5) * 22; y += 12 + rnd() * 26; g.lineTo(x, y); } g.stroke(); }
});
export const runeStripTex = (hex = '#ffffff') => mk('strip' + hex, 128, 128, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = hex; g.shadowColor = hex; g.shadowBlur = 4; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const x = 8 + j * 30, y = 8 + i * 20; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12, y + 14); g.moveTo(x + 12, y); g.lineTo(x, y + 14); if ((i + j) % 2) { g.moveTo(x + 6, y); g.lineTo(x + 6, y + 14); } g.stroke(); }
});
export const smokeTex = () => glowTex();
