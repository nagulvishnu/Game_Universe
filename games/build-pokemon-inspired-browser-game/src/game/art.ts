import { SPECIES, TYPE_COLOR, type TypeId } from './data';

// ---------- color helpers ----------
const cache = new Map<string, string>();
function parse(h: string): [number, number, number] {
  if (h.length === 4) return [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16)];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
export function mix(a: string, b: string, t: number): string {
  t = Math.round(t * 50) / 50;
  const key = a + b + t;
  const c = cache.get(key); if (c) return c;
  const A = parse(a), B = parse(b);
  const r = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  const out = `rgb(${r[0]},${r[1]},${r[2]})`;
  cache.set(key, out); return out;
}
export const rgba = (h: string, a: number) => { const c = parse(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

export interface MonOpts {
  facing?: 1 | -1; t?: number; mega?: boolean; flash?: number; alpha?: number; squash?: number; shadow?: boolean; tint?: string;
}
const OUT = '#1d1a33';

export function drawMonster(ctx: CanvasRenderingContext2D, spId: string, x: number, y: number, size: number, o: MonOpts = {}) {
  const sp = SPECIES[spId]; if (!sp) return;
  const t = o.t ?? 0, facing = o.facing ?? 1, mega = !!o.mega, flash = o.flash ?? 0;
  const stageK = [0, 0.8, 0.93, 1.06][sp.stage] || 1;
  const u = (size / 2) * stageK * (mega ? 1.2 : 1);
  const tcol = TYPE_COLOR[sp.types[0]];
  let c1 = sp.c1, c2 = sp.c2;
  if (mega) { c1 = mix(sp.c1, tcol, 0.3); c1 = mix(c1, '#ffffff', 0.12); c2 = mix(sp.c2, '#ffffff', 0.5); }
  const K = (c: string) => (flash > 0 ? mix(c, o.tint ?? '#ffffff', Math.min(1, flash)) : c);
  const dark = mix(c1, '#000000', 0.28), light = mix(c1, '#ffffff', 0.3);
  const br = Math.sin(t * 3 + sp.name.length) * 0.025;
  const sq = o.squash ?? 1;

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y, u * 0.85, u * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.translate(x, y);
  if (mega) {
    const g = ctx.createRadialGradient(0, -u, u * 0.2, 0, -u, u * 1.7);
    const a = 0.5 + Math.sin(t * 5) * 0.15;
    g.addColorStop(0, rgba('#ffffff', a)); g.addColorStop(0.35, rgba(tcol, a * 0.7)); g.addColorStop(1, rgba(tcol, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -u, u * 1.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.scale(u * facing * (1 - br) / Math.sqrt(sq), u * (1 + br) * sq);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = 0.05;

  const fill = (c: string, stroke = true) => {
    ctx.fillStyle = K(c); ctx.fill();
    if (stroke) { ctx.strokeStyle = K(OUT); ctx.lineWidth = lw; ctx.stroke(); }
  };
  const ell = (px: number, py: number, rx: number, ry: number, c: string, rot = 0, stroke = true) => {
    ctx.beginPath(); ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2); fill(c, stroke);
  };
  const poly = (pts: number[][], c: string, stroke = true) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); fill(c, stroke);
  };

  // geometry
  let body = { x: 0, y: -0.6, rx: 0.5, ry: 0.5 }, head = { x: 0.1, y: -1.2, r: 0.4 };
  let tail = { x: -0.5, y: -0.4 }, back = { x: -0.2, y: -1 };
  let hasHead = true; let legsX: number[] = [-0.2, 0.2]; let legH = 0.22;
  switch (sp.shape) {
    case 'blob': body = { x: 0, y: -0.58, rx: 0.7, ry: 0.58 }; head = { x: 0.2, y: -0.72, r: 0.5 }; tail = { x: -0.65, y: -0.35 }; back = { x: -0.1, y: -1.15 }; hasHead = false; legsX = [-0.32, 0.32]; legH = 0.12; break;
    case 'biped': body = { x: 0, y: -0.62, rx: 0.45, ry: 0.52 }; head = { x: 0.1, y: -1.3, r: 0.4 }; tail = { x: -0.42, y: -0.4 }; back = { x: -0.3, y: -0.95 }; legsX = [-0.2, 0.2]; legH = 0.25; break;
    case 'quad': body = { x: -0.05, y: -0.5, rx: 0.72, ry: 0.4 }; head = { x: 0.6, y: -0.82, r: 0.35 }; tail = { x: -0.75, y: -0.62 }; back = { x: -0.2, y: -0.88 }; legsX = [-0.5, -0.2, 0.25, 0.5]; legH = 0.22; break;
    case 'serpent': body = { x: 0, y: -0.5, rx: 0.5, ry: 0.4 }; head = { x: 0.55, y: -1.25, r: 0.36 }; tail = { x: -0.9, y: -0.2 }; back = { x: -0.1, y: -0.85 }; legsX = []; legH = 0; break;
    case 'bird': body = { x: 0, y: -0.72, rx: 0.48, ry: 0.42 }; head = { x: 0.3, y: -1.25, r: 0.31 }; tail = { x: -0.45, y: -0.65 }; back = { x: -0.1, y: -1.12 }; legsX = [-0.12, 0.12]; legH = 0.3; break;
  }
  const hx = head.x, hy = head.y, hr = head.r;
  const wag = Math.sin(t * 4) * 0.08;
  const types = sp.types;

  const flame = (fx: number, fy: number, s: number) => {
    const fl = Math.sin(t * 12) * 0.12;
    const cols = ['#e8381c', '#ff8a1f', '#ffe066'];
    for (let k = 0; k < 3; k++) {
      const sc = s * (1 - k * 0.25);
      ctx.beginPath();
      ctx.moveTo(fx - 0.2 * sc, fy);
      ctx.quadraticCurveTo(fx - 0.28 * sc, fy - 0.35 * sc, fx + fl * sc, fy - 0.75 * sc);
      ctx.quadraticCurveTo(fx + 0.28 * sc, fy - 0.35 * sc, fx + 0.2 * sc, fy);
      ctx.closePath(); fill(cols[k], k === 0);
    }
  };
  const bolt = (bx: number, by: number, s: number, rot: number) => {
    ctx.save(); ctx.translate(bx, by); ctx.rotate(rot); ctx.scale(s, s);
    poly([[0, 0], [0.18, -0.35], [0.04, -0.33], [0.2, -0.75], [-0.14, -0.3], [0.0, -0.3], [-0.12, 0]], '#ffe23a');
    ctx.restore();
  };
  const leaf = (lx: number, ly: number, rot: number, s: number) => {
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(rot);
    ctx.beginPath(); ctx.ellipse(0, -0.2 * s, 0.1 * s, 0.24 * s, 0, 0, Math.PI * 2); fill('#43b84f');
    ctx.restore();
  };
  const crystal = (cx: number, cy: number, s: number, rot: number) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);
    poly([[0, 0.05], [0.1, -0.2], [0, -0.55], [-0.1, -0.2]], '#aeeeff');
    poly([[0, -0.5], [0.04, -0.2], [0, -0.05], [-0.02, -0.2]], '#ffffff', false);
    ctx.restore();
  };
  const rockChunk = (rx: number, ry: number, s: number) => {
    poly([[rx - 0.2 * s, ry], [rx - 0.15 * s, ry - 0.2 * s], [rx, ry - 0.3 * s], [rx + 0.18 * s, ry - 0.18 * s], [rx + 0.22 * s, ry]], '#8d8576');
    poly([[rx - 0.15 * s, ry - 0.2 * s], [rx, ry - 0.3 * s], [rx + 0.05 * s, ry - 0.12 * s]], '#b9b09c', false);
  };

  // ---- BACK pass ----
  for (const ty of types as TypeId[]) {
    switch (ty) {
      case 'fire': flame(tail.x - 0.05, tail.y + 0.05 + wag * 0.3, 0.95); break;
      case 'water':
        ctx.save(); ctx.translate(tail.x, tail.y); ctx.rotate(wag);
        poly([[0.05, 0], [-0.45, -0.3], [-0.38, 0], [-0.45, 0.28]], c2); ctx.restore(); break;
      case 'electric': bolt(tail.x + 0.05, tail.y + 0.2, 1.2, -1.1 + wag); break;
      case 'flying': {
        const fl = Math.sin(t * 6) * 0.15;
        ctx.save(); ctx.translate(back.x + 0.1, back.y + 0.25); ctx.rotate(-0.5 + fl);
        poly([[0, 0], [-0.3, -0.5], [-0.15, -0.55], [-0.2, -0.85], [0, -0.7], [0.1, -0.9], [0.2, -0.5], [0.15, -0.1]], mix(c2, '#ffffff', 0.3));
        ctx.restore(); break;
      }
      case 'dragon':
        ctx.save(); ctx.translate(back.x + 0.1, back.y + 0.2); ctx.rotate(-0.4 + Math.sin(t * 4) * 0.1);
        poly([[0, 0], [-0.5, -0.5], [-0.35, -0.3], [-0.45, -0.1], [-0.2, -0.15], [-0.1, 0.05]], '#4a3ea8');
        ctx.restore(); break;
      case 'normal': ell(tail.x - 0.05, tail.y + wag, 0.2, 0.17, c2); break;
      case 'grass': ell(tail.x - 0.05, tail.y - 0.05 + wag, 0.12, 0.22, '#3aa84a', -0.8); break;
      case 'ground': poly([[tail.x, tail.y - 0.1], [tail.x - 0.35, tail.y - 0.3 + wag], [tail.x - 0.3, tail.y + 0.05]], dark); break;
      case 'steel': poly([[tail.x, tail.y - 0.1], [tail.x - 0.4, tail.y - 0.25 + wag], [tail.x - 0.25, tail.y + 0.05]], '#c9d4e0'); break;
      case 'poison': ell(tail.x - 0.1, tail.y - 0.05 + wag, 0.2, 0.1, '#8a3ab5', -0.5); break;
      case 'rock': rockChunk(tail.x - 0.1, tail.y + 0.15, 0.9); break;
      case 'ice': crystal(tail.x - 0.05, tail.y + 0.1, 0.9, -1.2); break;
      case 'psychic': ell(tail.x - 0.1, tail.y - 0.1 + wag, 0.14, 0.3, '#ff9ad0', -0.9); break;
      case 'fighting': ell(tail.x - 0.05, tail.y + wag, 0.14, 0.14, dark); break;
    }
  }
  if (sp.shape === 'serpent') {
    // tail coil
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      const px = -0.9 + k * 0.7 + Math.sin(t * 3 - i) * 0.04, py = -0.2 - Math.sin(k * Math.PI) * 0.18 - k * 0.1;
      ctx.beginPath(); ctx.arc(px, py, 0.1 + k * 0.14, 0, Math.PI * 2); fill(i % 2 ? c1 : mix(c1, c2, 0.25));
    }
  }
  // legs
  const stepAmt = Math.sin(t * 4) * 0.02;
  legsX.forEach((lx, i) => {
    const far = sp.shape === 'quad' && (i === 0 || i === 2);
    ctx.beginPath(); ctx.ellipse(lx, -legH * 0.5 + (i % 2 ? stepAmt : -stepAmt), 0.12, legH * 0.6 + 0.04, 0, 0, Math.PI * 2);
    fill(far ? dark : mix(c1, '#000000', 0.1));
    ctx.beginPath(); ctx.ellipse(lx + 0.05, -0.04, 0.17, 0.07, 0, 0, Math.PI * 2); fill(far ? dark : mix(c1, '#000000', 0.15));
  });
  if (sp.shape === 'bird') {
    ctx.strokeStyle = K('#f0a030'); ctx.lineWidth = 0.06;
    for (const lx of legsX) { ctx.beginPath(); ctx.moveTo(lx, -0.3); ctx.lineTo(lx, -0.02); ctx.lineTo(lx + 0.12, -0.02); ctx.stroke(); }
  }
  // arms (biped)
  if (sp.shape === 'biped') ell(body.x - 0.35, body.y + 0.05 + Math.sin(t * 4) * 0.03, 0.12, 0.26, dark, 0.3);

  // body
  ell(body.x, body.y, body.rx, body.ry, c1);
  ell(body.x - body.rx * 0.2, body.y - body.ry * 0.45, body.rx * 0.5, body.ry * 0.3, light, -0.2, false);
  ctx.globalAlpha *= 0.95;
  ell(body.x + body.rx * 0.2, body.y + body.ry * 0.35, body.rx * 0.6, body.ry * 0.5, c2, 0, false);
  ctx.globalAlpha = o.alpha ?? 1;
  if (sp.shape === 'serpent') {
    for (let i = 0; i < 4; i++) {
      const k = i / 3;
      ctx.beginPath(); ctx.arc(0.1 + k * 0.45, -0.55 - k * 0.45 + Math.sin(t * 3 + i) * 0.03, 0.3 - k * 0.05, 0, Math.PI * 2); fill(i % 2 ? c1 : mix(c1, c2, 0.25));
    }
  }
  if (hasHead) {
    ell(hx, hy, hr, hr * 0.92, c1);
    ell(hx + hr * 0.2, hy + hr * 0.3, hr * 0.55, hr * 0.4, c2, 0, false);
    ell(hx - hr * 0.2, hy - hr * 0.45, hr * 0.4, hr * 0.2, light, -0.2, false);
  }
  if (sp.shape === 'bird') poly([[hx + hr * 0.8, hy], [hx + hr * 1.6, hy + hr * 0.25], [hx + hr * 0.8, hy + hr * 0.55]], '#f4b733');
  if (sp.shape === 'quad' || sp.shape === 'serpent') ell(hx + hr * 0.75, hy + hr * 0.25, hr * 0.38, hr * 0.28, mix(c2, c1, 0.3), 0, false);

  // ---- FRONT features ----
  for (const ty of types as TypeId[]) {
    switch (ty) {
      case 'fire': flame(hx - hr * 0.1, hy - hr * 0.8, 0.42); break;
      case 'water': poly([[hx - hr * 0.3, hy - hr * 0.8], [hx - hr * 0.1, hy - hr * 1.7], [hx + hr * 0.3, hy - hr * 0.8]], c2); break;
      case 'electric':
        bolt(hx - hr * 0.35, hy - hr * 0.7, 0.8, -0.3); bolt(hx + hr * 0.3, hy - hr * 0.75, 0.8, 0.4);
        ctx.beginPath(); ctx.arc(hx + hr * 0.35, hy + hr * 0.35, hr * 0.17, 0, Math.PI * 2); fill('#ff5a4a', false); break;
      case 'grass': leaf(hx - hr * 0.1, hy - hr * 0.8, -0.5, 1.1); leaf(hx + hr * 0.1, hy - hr * 0.8, 0.5, 1.1); leaf(hx, hy - hr * 0.85, 0, 1.4); break;
      case 'ice': crystal(hx - hr * 0.1, hy - hr * 0.8, 0.9, -0.2); crystal(hx + hr * 0.3, hy - hr * 0.75, 0.7, 0.35); crystal(back.x, back.y + 0.1, 0.8, -0.5); break;
      case 'fighting': {
        ctx.beginPath(); ctx.rect(hx - hr * 0.98, hy - hr * 0.55, hr * 1.96, hr * 0.28); fill('#d93a3a');
        ctx.beginPath(); ctx.moveTo(hx - hr * 0.95, hy - hr * 0.45);
        ctx.quadraticCurveTo(hx - hr * 1.5, hy - hr * 0.2 + wag, hx - hr * 1.9, hy - hr * 0.6 + wag * 2);
        ctx.lineTo(hx - hr * 1.8, hy - hr * 0.3); ctx.closePath(); fill('#d93a3a');
        ell(body.x + body.rx * 0.8, body.y + body.ry * 0.6, 0.17, 0.17, '#8a2a22'); break;
      }
      case 'poison':
        ell(body.x - 0.15, body.y - 0.05, 0.1, 0.08, '#7a2a9a', 0, false); ell(body.x + 0.15, body.y - 0.25, 0.07, 0.06, '#7a2a9a', 0, false); ell(body.x - 0.05, body.y + 0.25, 0.08, 0.06, '#7a2a9a', 0, false);
        for (let i = 0; i < 3; i++) poly([[back.x - 0.12 + i * 0.14, back.y + 0.1], [back.x - 0.05 + i * 0.14, back.y - 0.2], [back.x + 0.02 + i * 0.14, back.y + 0.1]], '#b05ad6');
        break;
      case 'ground':
        ell(body.x - 0.1, body.y + 0.1, 0.2, 0.1, mix(c1, '#6a4a20', 0.5), 0.3, false); ell(body.x + 0.15, body.y - 0.15, 0.12, 0.07, mix(c1, '#6a4a20', 0.5), -0.3, false);
        poly([[hx + hr * 0.1, hy - hr * 0.8], [hx + hr * 0.35, hy - hr * 1.5], [hx + hr * 0.55, hy - hr * 0.7]], '#efe0b8'); break;
      case 'flying': break;
      case 'psychic': {
        poly([[hx, hy - hr * 0.95], [hx + hr * 0.2, hy - hr * 0.6], [hx, hy - hr * 0.25], [hx - hr * 0.2, hy - hr * 0.6]], '#ff4fa0');
        for (let i = 0; i < 2; i++) { const a = t * 2 + i * Math.PI; ell(hx + Math.cos(a) * hr * 1.5, hy - hr * 0.5 + Math.sin(a) * hr * 0.4, 0.07, 0.07, '#ffd0ee'); }
        break;
      }
      case 'rock': rockChunk(back.x - 0.1, back.y + 0.1, 1.2); rockChunk(back.x + 0.25, back.y + 0.2, 0.9); rockChunk(hx - hr * 0.2, hy - hr * 0.7, 0.8); break;
      case 'steel':
        ctx.beginPath(); ctx.roundRect(body.x - body.rx * 0.8, body.y - 0.12, body.rx * 1.6, 0.14, 0.05); fill('#cdd8e4');
        ell(body.x - body.rx * 0.6, body.y - 0.05, 0.03, 0.03, '#6a7a8a', 0, false); ell(body.x + body.rx * 0.6, body.y - 0.05, 0.03, 0.03, '#6a7a8a', 0, false);
        poly([[hx - hr * 0.2, hy - hr * 0.85], [hx + hr * 0.05, hy - hr * 1.7], [hx + hr * 0.3, hy - hr * 0.8]], '#dfe8f2'); break;
      case 'dragon':
        poly([[hx - hr * 0.5, hy - hr * 0.7], [hx - hr * 0.9, hy - hr * 1.6], [hx - hr * 0.2, hy - hr * 0.85]], '#f0e4c4');
        poly([[hx + hr * 0.1, hy - hr * 0.85], [hx + hr * 0.2, hy - hr * 1.7], [hx + hr * 0.5, hy - hr * 0.75]], '#f0e4c4');
        for (let i = 0; i < 3; i++) poly([[back.x - 0.12 + i * 0.16, back.y + 0.1], [back.x - 0.02 + i * 0.16, back.y - 0.18], [back.x + 0.06 + i * 0.16, back.y + 0.1]], c2);
        break;
      case 'normal':
        ell(hx - hr * 0.55, hy - hr * 0.85, hr * 0.3, hr * 0.35, c1); ell(hx + hr * 0.25, hy - hr * 0.95, hr * 0.3, hr * 0.35, c1);
        ell(hx - hr * 0.55, hy - hr * 0.85, hr * 0.15, hr * 0.2, c2, 0, false); ell(hx + hr * 0.25, hy - hr * 0.95, hr * 0.15, hr * 0.2, c2, 0, false); break;
    }
  }

  // ---- FACE ----
  const blink = (t % 3.4) > 3.28 ? 0.15 : 1;
  const ex = [hx + hr * 0.12, hx + hr * 0.62], ey = hy - hr * 0.05;
  const er = hr * 0.2;
  const angry = sp.role === 'attacker' || sp.role === 'bulky';
  for (let i = 0; i < 2; i++) {
    ctx.beginPath(); ctx.ellipse(ex[i], ey, er * 0.85, er * blink, 0, 0, Math.PI * 2);
    ctx.fillStyle = K(mega ? '#fff6c0' : '#ffffff'); ctx.fill(); ctx.strokeStyle = K(OUT); ctx.lineWidth = 0.035; ctx.stroke();
    if (blink > 0.5) {
      ctx.beginPath(); ctx.arc(ex[i] + er * 0.25, ey, er * 0.5, 0, Math.PI * 2); ctx.fillStyle = K(mega ? '#ff3a6a' : OUT); ctx.fill();
      ctx.beginPath(); ctx.arc(ex[i] + er * 0.4, ey - er * 0.2, er * 0.18, 0, Math.PI * 2); ctx.fillStyle = K('#fff'); ctx.fill();
    }
    if (angry || mega) {
      ctx.strokeStyle = K(OUT); ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(ex[i] - er, ey - er * (i === 0 ? 1.6 : 0.9)); ctx.lineTo(ex[i] + er, ey - er * (i === 0 ? 0.9 : 1.7)); ctx.stroke();
    }
  }
  ctx.strokeStyle = K(OUT); ctx.lineWidth = 0.04;
  ctx.beginPath(); ctx.arc(hx + hr * 0.5, hy + hr * 0.38, hr * 0.17, 0.1, Math.PI - 0.1); ctx.stroke();
  if (types[0] === 'poison' || types[0] === 'dragon') { poly([[hx + hr * 0.45, hy + hr * 0.45], [hx + hr * 0.52, hy + hr * 0.7], [hx + hr * 0.6, hy + hr * 0.45]], '#fff', true); }

  // ---- MEGA decorations ----
  if (mega) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.32;
      const bx = hx + Math.cos(a) * hr * 0.95, by = hy + Math.sin(a) * hr * 0.95;
      poly([[bx - 0.07, by + 0.02], [bx + Math.cos(a) * 0.38, by + Math.sin(a) * 0.38 - 0.1], [bx + 0.07, by + 0.02]], i % 2 ? '#ffe066' : tcol);
    }
    for (let i = 0; i < 6; i++) {
      const a = t * 2.2 + (i / 6) * Math.PI * 2;
      const sx = Math.cos(a) * 1.15, sy = -1 + Math.sin(a) * 0.9, s = 0.07 + 0.03 * Math.sin(t * 8 + i);
      poly([[sx, sy - s * 2], [sx + s * 0.6, sy], [sx, sy + s * 2], [sx - s * 0.6, sy]], '#fffbd0', false);
      poly([[sx - s * 2, sy], [sx, sy - s * 0.6], [sx + s * 2, sy], [sx, sy + s * 0.6]], '#fffbd0', false);
    }
  }
  ctx.restore();
}

// ---------- people ----------
export interface PersonColors { skin: string; shirt: string; pants: string; hat: string; hair: string }
export function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, walk: number, c: PersonColors, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  const sw = Math.sin(walk * Math.PI * 2) * 5;
  const bob = Math.abs(Math.sin(walk * Math.PI * 2)) * 1.5 * (walk > 0 ? 1 : 0);
  ctx.translate(0, -bob);
  const out = (c0: string) => { ctx.fillStyle = c0; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.stroke(); };
  // legs
  ctx.beginPath(); ctx.roundRect(-8, -14 + (dir === 1 || dir === 2 ? 0 : -sw * 0.3), 6, 14 + (dir === 1 || dir === 2 ? sw * 0.3 : sw * 0.5), 2); out(c.pants);
  ctx.beginPath(); ctx.roundRect(2, -14 + (dir === 1 || dir === 2 ? 0 : sw * 0.3), 6, 14 + (dir === 1 || dir === 2 ? -sw * 0.3 : -sw * 0.5), 2); out(c.pants);
  // body
  ctx.beginPath(); ctx.roundRect(-11, -32, 22, 21, 6); out(c.shirt);
  // arms
  if (dir === 0 || dir === 3) {
    ctx.beginPath(); ctx.roundRect(-15, -30 + sw * 0.2, 6, 14, 3); out(c.shirt);
    ctx.beginPath(); ctx.roundRect(9, -30 - sw * 0.2, 6, 14, 3); out(c.shirt);
  } else {
    ctx.beginPath(); ctx.roundRect(-3, -30 + sw * 0.25, 7, 14, 3); out(c.shirt);
  }
  // head
  ctx.beginPath(); ctx.arc(0, -41, 12, 0, Math.PI * 2); out(c.skin);
  const fx = dir === 1 ? -1 : dir === 2 ? 1 : 0;
  if (dir !== 3) {
    ctx.fillStyle = OUT;
    if (dir === 0) { ctx.beginPath(); ctx.arc(-4.5, -39, 1.9, 0, 7); ctx.arc(4.5, -39, 1.9, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(fx * 5.5, -39, 1.9, 0, 7); ctx.fill(); }
  }
  // hair back / hat
  ctx.beginPath(); ctx.arc(0, -43, 12.5, Math.PI, 0); ctx.closePath();
  if (dir === 3) { ctx.beginPath(); ctx.arc(0, -41, 12.5, 0, Math.PI * 2); }
  out(c.hat);
  if (dir === 0) { ctx.beginPath(); ctx.roundRect(-11, -44, 22, 4, 2); out(c.hat); }
  if (fx) { ctx.beginPath(); ctx.roundRect(fx > 0 ? 2 : -16, -44, 14, 4, 2); out(c.hat); }
  ctx.restore();
}

export function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string, open = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.14;
  ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.lineTo(-r, -open * r * 0.6); ctx.closePath();
  ctx.save(); ctx.translate(0, -open * r * 0.5); ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#f4f4f8'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
