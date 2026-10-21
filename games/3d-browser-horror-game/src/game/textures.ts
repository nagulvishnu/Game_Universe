import * as THREE from 'three';

// All textures are generated procedurally on <canvas> so the game ships as a single file.

function mulberry(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;

function mk(size = 512): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function noise(ctx: Ctx, size: number, amt: number, rnd: Rnd) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function stains(ctx: Ctx, size: number, rnd: Rnd, count: number, alpha: number, rgb = '25,16,8') {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 20 + rnd() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${alpha * (0.4 + rnd() * 0.6)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function drips(ctx: Ctx, size: number, rnd: Rnd, count: number, rgb = '30,18,10') {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size * 0.6;
    const len = 30 + rnd() * 180;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, `rgba(${rgb},${0.12 + rnd() * 0.15})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 2 + rnd() * 5, len);
  }
}

function cracks(ctx: Ctx, size: number, rnd: Rnd, count: number) {
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < count; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const n = 6 + Math.floor(rnd() * 10);
    for (let k = 0; k < n; k++) {
      x += (rnd() - 0.5) * 40;
      y += (rnd() - 0.2) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function finish(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function woodFloor(base: [number, number, number], seed: number, planks = 8, worn = 0.4): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  const ph = S / planks;
  for (let r = 0; r < planks; r++) {
    const sh = 0.78 + rnd() * 0.4;
    ctx.fillStyle = `rgb(${base[0] * sh},${base[1] * sh},${base[2] * sh})`;
    ctx.fillRect(0, r * ph, S, ph);
    // grain
    for (let k = 0; k < 34; k++) {
      const y = r * ph + rnd() * ph;
      ctx.strokeStyle = `rgba(0,0,0,${0.04 + rnd() * 0.1})`;
      ctx.lineWidth = 0.6 + rnd() * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      let yy = y;
      for (let x = 0; x <= S; x += 64) {
        yy += (rnd() - 0.5) * 3;
        ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // joints
    const joints = 1 + Math.floor(rnd() * 2);
    for (let j = 0; j < joints; j++) {
      const x = rnd() * S;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x, r * ph, 2.5, ph);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, r * ph, S, 2.5);
    // light edge
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, r * ph + 3, S, 2);
  }
  stains(ctx, S, rnd, 14, worn);
  noise(ctx, S, 22, rnd);
  return finish(c);
}

function carpet(base: [number, number, number], seed: number, pattern = true): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, S, S);
  if (pattern) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 3;
    for (let x = 0; x < S; x += 64) {
      for (let y = 0; y < S; y += 64) {
        ctx.beginPath();
        ctx.moveTo(x + 32, y + 6);
        ctx.lineTo(x + 58, y + 32);
        ctx.lineTo(x + 32, y + 58);
        ctx.lineTo(x + 6, y + 32);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  noise(ctx, S, 46, rnd);
  stains(ctx, S, rnd, 16, 0.4);
  stains(ctx, S, rnd, 3, 0.35, '60,0,0');
  return finish(c);
}

function tiles(c1: string, c2: string, seed: number, size = 64, grout = 'rgba(30,30,28,0.9)'): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  const n = S / size;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? c1 : c2;
      ctx.fillRect(i * size, j * size, size, size);
      ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
      ctx.fillRect(i * size, j * size, size, size);
    }
  }
  ctx.fillStyle = grout;
  for (let i = 0; i <= n; i++) {
    ctx.fillRect(i * size - 1.5, 0, 3, S);
    ctx.fillRect(0, i * size - 1.5, S, 3);
  }
  cracks(ctx, S, rnd, 4);
  stains(ctx, S, rnd, 16, 0.35);
  noise(ctx, S, 26, rnd);
  return finish(c);
}

function concrete(seed: number): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  ctx.fillStyle = 'rgb(88,88,84)';
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, rnd, 40, 0.25, '10,10,10');
  stains(ctx, S, rnd, 25, 0.18, '200,200,190');
  cracks(ctx, S, rnd, 8);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.4})`;
    ctx.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  noise(ctx, S, 40, rnd);
  return finish(c);
}

function wallpaper(
  base: [number, number, number],
  accent: [number, number, number],
  style: 'stripe' | 'damask' | 'plain',
  seed: number,
): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, S, S);
  if (style === 'stripe') {
    for (let x = 0; x < S; x += 64) {
      ctx.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},0.55)`;
      ctx.fillRect(x + 8, 0, 30, S);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 4, 0, 2, S);
      ctx.fillRect(x + 40, 0, 2, S);
    }
  } else if (style === 'damask') {
    for (let x = 0; x < S; x += 64) {
      for (let y = 0; y < S; y += 64) {
        const ox = (Math.floor(y / 64) % 2) * 32;
        ctx.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},0.5)`;
        ctx.beginPath();
        ctx.ellipse(x + 32 + ox, y + 32, 10, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 32 + ox, y + 32, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(x + 32 + ox, y + 32, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  stains(ctx, S, rnd, 22, 0.42);
  drips(ctx, S, rnd, 14);
  // peeling patches
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgba(210,200,170,${0.08 + rnd() * 0.1})`;
    ctx.fillRect(rnd() * S, rnd() * S, 8 + rnd() * 40, 30 + rnd() * 90);
  }
  noise(ctx, S, 20, rnd);
  return finish(c);
}

function plaster(seed: number): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  ctx.fillStyle = 'rgb(130,126,114)';
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, rnd, 40, 0.3);
  drips(ctx, S, rnd, 10);
  cracks(ctx, S, rnd, 6);
  noise(ctx, S, 36, rnd);
  return finish(c);
}

function woodPanel(seed: number): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  const pw = 64;
  for (let i = 0; i < S / pw; i++) {
    const sh = 0.75 + rnd() * 0.5;
    ctx.fillStyle = `rgb(${72 * sh},${46 * sh},${28 * sh})`;
    ctx.fillRect(i * pw, 0, pw, S);
    for (let k = 0; k < 30; k++) {
      const x = i * pw + rnd() * pw;
      ctx.strokeStyle = `rgba(0,0,0,${0.06 + rnd() * 0.12})`;
      ctx.lineWidth = 0.8 + rnd();
      ctx.beginPath();
      ctx.moveTo(x, 0);
      let xx = x;
      for (let y = 0; y <= S; y += 64) {
        xx += (rnd() - 0.5) * 3;
        ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(i * pw, 0, 2.5, S);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 250, S, 6);
  ctx.fillStyle = 'rgba(255,220,170,0.07)';
  ctx.fillRect(0, 256, S, 3);
  stains(ctx, S, rnd, 14, 0.4);
  noise(ctx, S, 22, rnd);
  return finish(c);
}

function ceiling(seed: number): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  ctx.fillStyle = 'rgb(118,112,100)';
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, rnd, 24, 0.35);
  noise(ctx, S, 28, rnd);
  return finish(c);
}

function furnitureWood(seed: number, base: [number, number, number] = [74, 46, 26]): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 70; k++) {
    const y = rnd() * S;
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.14})`;
    ctx.lineWidth = 0.6 + rnd() * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    let yy = y;
    for (let x = 0; x <= S; x += 32) {
      yy += (rnd() - 0.5) * 4;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (let k = 0; k < 18; k++) {
    ctx.strokeStyle = `rgba(255,220,170,${0.03 + rnd() * 0.05})`;
    ctx.beginPath();
    const y = rnd() * S;
    ctx.moveTo(0, y);
    ctx.lineTo(S, y + (rnd() - 0.5) * 10);
    ctx.stroke();
  }
  stains(ctx, S, rnd, 6, 0.3);
  noise(ctx, S, 20, rnd);
  return finish(c);
}

function fabric(rgb: [number, number, number], seed: number): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(0,0,0,0.13)';
  ctx.lineWidth = 1;
  for (let i = 0; i < S; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }
  stains(ctx, S, rnd, 10, 0.35);
  noise(ctx, S, 30, rnd);
  return finish(c);
}

function doorTex(seed: number): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = mk(S);
  const rnd = mulberry(seed);
  ctx.fillStyle = 'rgb(66,42,26)';
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 60; k++) {
    const x = rnd() * S;
    ctx.strokeStyle = `rgba(0,0,0,${0.06 + rnd() * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rnd() - 0.5) * 6, S);
    ctx.stroke();
  }
  // raised panels
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 22, 188, 96);
  ctx.strokeRect(34, 138, 188, 96);
  ctx.strokeStyle = 'rgba(255,220,170,0.1)';
  ctx.lineWidth = 2;
  ctx.strokeRect(38, 26, 180, 88);
  ctx.strokeRect(38, 142, 180, 88);
  stains(ctx, S, rnd, 8, 0.3);
  noise(ctx, S, 20, rnd);
  return finish(c);
}

function portrait(variant: number): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = mk(S);
  const rnd = mulberry(900 + variant * 31);
  const bg = [
    ['#1b1a14', '#3a3220'],
    ['#10181a', '#26383a'],
    ['#1a1015', '#3a2230'],
  ][variant % 3];
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, bg[1]);
  g.addColorStop(1, bg[0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // shoulders
  ctx.fillStyle = ['#15121a', '#22190f', '#101a14'][variant % 3];
  ctx.beginPath();
  ctx.ellipse(S / 2, S + 10, 105, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  // collar
  ctx.fillStyle = '#cfc7b4';
  ctx.beginPath();
  ctx.moveTo(S / 2 - 30, 186);
  ctx.lineTo(S / 2, 214);
  ctx.lineTo(S / 2 + 30, 186);
  ctx.lineTo(S / 2, 196);
  ctx.fill();
  // hair
  ctx.fillStyle = variant === 1 ? '#201c18' : '#a8a8a0';
  ctx.beginPath();
  ctx.ellipse(S / 2, 100, 58, 66, 0, 0, Math.PI * 2);
  ctx.fill();
  // face
  ctx.fillStyle = '#b9a98f';
  ctx.beginPath();
  ctx.ellipse(S / 2, 112, 42, 54, 0, 0, Math.PI * 2);
  ctx.fill();
  // eye sockets
  ctx.fillStyle = 'rgba(20,10,10,0.75)';
  ctx.beginPath();
  ctx.ellipse(S / 2 - 17, 104, 11, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(S / 2 + 17, 104, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.arc(S / 2 - 17, 104, 3.2, 0, Math.PI * 2);
  ctx.arc(S / 2 + 17, 104, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // mouth
  ctx.strokeStyle = 'rgba(40,10,10,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(S / 2 - 15, 146);
  ctx.quadraticCurveTo(S / 2, 140 + variant * 4, S / 2 + 15, 146);
  ctx.stroke();
  // cheek shadows + scratches
  stains(ctx, S, rnd, 8, 0.4, '0,0,0');
  ctx.strokeStyle = 'rgba(200,190,170,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    const x = rnd() * S;
    ctx.moveTo(x, rnd() * S);
    ctx.lineTo(x + (rnd() - 0.5) * 60, rnd() * S);
    ctx.stroke();
  }
  noise(ctx, S, 28, rnd);
  const vg = ctx.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function grannyDress(): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = mk(S);
  const rnd = mulberry(4242);
  ctx.fillStyle = '#2b2f45';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    ctx.fillStyle = `rgba(${180 + rnd() * 60},${150 + rnd() * 50},${150 + rnd() * 50},0.55)`;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(210,170,60,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  stains(ctx, S, rnd, 12, 0.5, '30,0,0');
  noise(ctx, S, 30, rnd);
  return finish(c);
}

function grannySkin(): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = mk(S);
  const rnd = mulberry(777);
  ctx.fillStyle = '#9a9a82';
  ctx.fillRect(0, 0, S, S);
  stains(ctx, S, rnd, 26, 0.45, '70,60,70');
  ctx.strokeStyle = 'rgba(40,30,30,0.35)';
  for (let i = 0; i < 70; i++) {
    ctx.lineWidth = 0.6 + rnd() * 0.8;
    ctx.beginPath();
    const y = rnd() * S;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(S * 0.3, y + (rnd() - 0.5) * 8, S * 0.6, y + (rnd() - 0.5) * 8, S, y + (rnd() - 0.5) * 6);
    ctx.stroke();
  }
  noise(ctx, S, 30, rnd);
  return finish(c);
}

function bloodStain(): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = mk(S);
  const rnd = mulberry(1313);
  ctx.clearRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    const x = S / 2 + (rnd() - 0.5) * 90;
    const y = S / 2 + (rnd() - 0.5) * 90;
    const r = 18 + rnd() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(70,0,0,0.9)');
    g.addColorStop(0.7, 'rgba(50,0,0,0.6)');
    g.addColorStop(1, 'rgba(40,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cache = new Map<string, THREE.CanvasTexture>();
const builders: Record<string, () => THREE.CanvasTexture> = {
  wood_dark: () => woodFloor([70, 44, 26], 11, 8, 0.45),
  wood_light: () => woodFloor([112, 78, 46], 12, 6, 0.35),
  wood_old: () => woodFloor([84, 70, 52], 13, 10, 0.6),
  carpet_red: () => carpet([86, 20, 24], 14),
  carpet_green: () => carpet([30, 62, 44], 15),
  carpet_cream: () => carpet([128, 112, 90], 16, false),
  tile_bath: () => tiles('#a9b4ae', '#8c9a95', 17, 64),
  tile_kitchen: () => tiles('#b8b19a', '#6e6a58', 18, 64),
  tile_checker: () => tiles('#d8d2c0', '#1b1a1a', 19, 128),
  concrete: () => concrete(20),
  wp_green: () => wallpaper([48, 78, 58], [34, 60, 44], 'stripe', 21),
  wp_red: () => wallpaper([100, 34, 36], [74, 22, 26], 'damask', 22),
  wp_beige: () => wallpaper([150, 134, 100], [128, 112, 80], 'stripe', 23),
  wp_blue: () => wallpaper([52, 70, 98], [38, 52, 78], 'damask', 24),
  wp_pink: () => wallpaper([150, 110, 118], [128, 90, 100], 'damask', 25),
  wp_purple: () => wallpaper([76, 44, 82], [58, 32, 66], 'damask', 26),
  wp_hall: () => wallpaper([84, 96, 90], [64, 74, 70], 'stripe', 27),
  plaster: () => plaster(28),
  tile_wall: () => tiles('#b7c4bd', '#a7b5ae', 29, 32, 'rgba(60,66,60,0.9)'),
  wood_panel: () => woodPanel(30),
  ceiling: () => ceiling(31),
  furn_wood: () => furnitureWood(32),
  furn_wood_light: () => furnitureWood(33, [118, 86, 52]),
  furn_wood_black: () => furnitureWood(34, [34, 24, 18]),
  door: () => doorTex(35),
  fabric_red: () => fabric([110, 30, 34], 36),
  fabric_green: () => fabric([44, 76, 56], 37),
  fabric_blue: () => fabric([52, 66, 98], 38),
  fabric_cream: () => fabric([150, 138, 116], 39),
  fabric_brown: () => fabric([84, 52, 34], 40),
  paint0: () => portrait(0),
  paint1: () => portrait(1),
  paint2: () => portrait(2),
  granny_dress: () => grannyDress(),
  granny_skin: () => grannySkin(),
  blood: () => bloodStain(),
};

export function getTexture(name: string): THREE.CanvasTexture {
  let t = cache.get(name);
  if (!t) {
    const b = builders[name];
    if (!b) throw new Error('unknown texture ' + name);
    t = b();
    cache.set(name, t);
  }
  return t;
}

export function disposeTextures() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}
