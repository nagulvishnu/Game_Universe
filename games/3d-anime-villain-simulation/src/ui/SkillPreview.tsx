import { useEffect, useRef } from 'react';
import type { Skill } from '../game/data';

const W = 440, H = 250, GY = 205, CX = 90, TX = 335;
const hex6 = (c: string) => {
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  throw new Error(`Unsupported skill preview color: ${c}`);
};
const withAlpha = (c: string, a: number) => {
  const color = hex6(c);
  return `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${a})`;
};
const h = (i: number) => Math.abs(Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, a = 1) {
  const color = hex6(c);
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(0.35, withAlpha(color, 0.67)); gr.addColorStop(1, withAlpha(color, 0)); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.globalAlpha = 1;
}
function figure(g: CanvasRenderingContext2D, x: number, y: number, s: number, pose: number, c: string, alpha = 1, hair = c) {
  g.save(); g.globalAlpha = alpha; g.lineCap = 'round'; g.lineJoin = 'round';
  const body = '#161224'; g.strokeStyle = c; g.fillStyle = body; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x - 4 * s, y - 48 * s); g.lineTo(x - 10 * s, y); g.moveTo(x + 4 * s, y - 48 * s); g.lineTo(x + 12 * s, y); g.lineWidth = 9 * s; g.strokeStyle = body; g.stroke(); g.lineWidth = 1.5; g.strokeStyle = c; g.stroke();
  g.beginPath(); g.roundRect(x - 12 * s, y - 94 * s, 24 * s, 48 * s, 7 * s); g.fill(); g.stroke();
  const hand = pose === 2 ? [x + 44 * s, y - 92 * s] : pose === 1 ? [x + 15 * s, y - 80 * s] : [x + 8 * s, y - 56 * s]; const hand2 = pose === 2 ? [x + 38 * s, y - 86 * s] : pose === 1 ? [x + 13 * s, y - 76 * s] : [x - 12 * s, y - 56 * s];
  g.strokeStyle = body; g.lineWidth = 7 * s; g.beginPath(); g.moveTo(x + 10 * s, y - 88 * s); g.lineTo(hand[0], hand[1]); g.moveTo(x - 10 * s, y - 88 * s); g.lineTo(hand2[0], hand2[1]); g.stroke(); g.strokeStyle = c; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = '#f3d2b5'; g.beginPath(); g.arc(x, y - 108 * s, 11 * s, 0, 7); g.fill(); g.strokeStyle = c; g.stroke();
  g.fillStyle = hair; for (let i = 0; i < 6; i++) { g.beginPath(); const a = -2.7 + i * 0.5; g.moveTo(x + Math.cos(a - 0.2) * 10 * s, y - 108 * s + Math.sin(a - 0.2) * 10 * s); g.lineTo(x + Math.cos(a) * (20 + (i % 2) * 7) * s, y - 108 * s + Math.sin(a) * (20 + (i % 2) * 7) * s); g.lineTo(x + Math.cos(a + 0.2) * 10 * s, y - 108 * s + Math.sin(a + 0.2) * 10 * s); g.fill(); }
  g.fillStyle = c; g.fillRect(x + 2 * s, y - 110 * s, 6 * s, 2.5 * s); g.restore();
  return hand;
}

export function SkillPreview({ s, k }: { s: Skill; k: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!; let raf = 0; const t0 = performance.now(); const A = hex6(s.c1), B = s.c2 === '#000' || s.c2 === '#000000' ? hex6(s.c1) : hex6(s.c2);
    const draw = () => {
      const T = 3.4; const t = (((performance.now() - t0) / 1000) % T); const lt = t - 0.55;
      g.clearRect(0, 0, W, H); const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0a18'); bg.addColorStop(1, '#1a1330'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + h(i) * 0.3})`; g.fillRect(h(i + 5) * W, h(i + 9) * 150, 1.5, 1.5); }
      g.fillStyle = '#12101e'; g.fillRect(0, GY, W, H - GY); g.strokeStyle = A + '55'; g.beginPath(); g.moveTo(0, GY); g.lineTo(W, GY); g.stroke();
      const pose = t < 0.5 ? 1 : t < 1.3 ? 2 : 0; let casterX = CX, tdx = 0, tdy = 0, tflash = 0; let hit = false; const fx = s.fx;
      // effect-dependent target reactions
      const reaction = (start: number, mag = 40) => { if (lt > start) { const a = lt - start; tdx = Math.min(mag, a * 160) * Math.exp(-a * 0.8) * 1.6 * Math.sign(mag); tflash = Math.max(0, 1 - a * 3); hit = true; } };
      const hp0 = fx === 'heal' ? 0.45 : 1;
      g.globalCompositeOperation = 'lighter';
      const handX = CX + 44, handY = GY - 92;
      if (t < 0.5) { const p = t / 0.5; glow(g, CX + 15, GY - 80, 10 + p * 24 + (fx === 'nova' ? p * 20 : 0), A, 0.9); for (let i = 0; i < 10; i++) { const a = h(i) * 6.28 + t * 6, r = (1 - p) * 60 + 8; g.fillStyle = A; g.globalAlpha = 0.7; g.fillRect(CX + 15 + Math.cos(a) * r, GY - 80 + Math.sin(a) * r, 2.5, 2.5); } g.globalAlpha = 1; }
      switch (fx) {
        case 'bolt': { if (lt > 0) { const sp = 300, px = handX + lt * sp; const li = (TX - 18 - handX) / sp; if (lt < li) { for (let i = 10; i >= 0; i--) glow(g, px - i * 9, handY + Math.sin(i + lt * 20) * 2, 14 - i, i % 2 ? A : B, 0.8 - i * 0.07); glow(g, px, handY, 20, A); glow(g, px, handY, 9, '#ffffff'); } else { const a = lt - li; reaction(li, 36); glow(g, TX - 10, handY + 10, 20 + a * 130, A, Math.max(0, 1 - a * 1.6)); g.strokeStyle = A; g.lineWidth = 3; g.globalAlpha = Math.max(0, 1 - a * 2); g.beginPath(); g.ellipse(TX - 10, GY, a * 140, a * 30, 0, 0, 7); g.stroke(); g.globalAlpha = 1; for (let i = 0; i < 16; i++) { const an = h(i) * 6.28; glow(g, TX - 10 + Math.cos(an) * a * 120 * h(i + 3), handY + 10 + Math.sin(an) * a * 90 * h(i + 3), 5, i % 2 ? A : B, Math.max(0, 1 - a * 2)); } } } break; }
        case 'beam': { if (lt > 0 && lt < 1.1) { const w = (14 + Math.sin(lt * 50) * 3) * Math.min(1, lt * 8) * Math.min(1, (1.1 - lt) * 5); g.strokeStyle = A; g.lineWidth = w * 1.8; g.globalAlpha = 0.45; g.lineCap = 'round'; const pts: number[][] = [[handX, handY]]; const n = s.cat === 'Lightning' ? 9 : 1; for (let i = 1; i <= n; i++) pts.push([handX + ((TX + 25 - handX) * i) / n, handY + 8 * (i / n) + (s.cat === 'Lightning' && i < n ? (h(i + Math.floor(lt * 30)) - 0.5) * 34 : 0)]); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = w * 0.6; g.stroke(); glow(g, handX, handY, 26, A); glow(g, TX + 25, handY + 8, 34 + Math.sin(lt * 40) * 6, B); reaction(0.05, 24); } break; }
        case 'burst': { if (lt > 0) { for (let r = 0; r < 3; r++) { const a = lt - r * 0.12; if (a > 0) { g.strokeStyle = r % 2 ? B : A; g.lineWidth = 6 - r * 1.5; g.globalAlpha = Math.max(0, 1 - a * 1.4); g.beginPath(); g.ellipse(CX, GY - 5, a * 330, a * 60, 0, 0, 7); g.stroke(); } } g.globalAlpha = 1; glow(g, CX, GY - 50, Math.max(0, 80 - lt * 60), A, Math.max(0, 1 - lt * 2)); for (let i = 0; i < 26; i++) { const a = h(i) * 3.14, sp = 100 + h(i + 7) * 180; glow(g, CX + Math.cos(a) * lt * sp, GY - 20 - Math.sin(a) * lt * sp * 0.6, 4, i % 2 ? A : B, Math.max(0, 1 - lt * 1.3)); } if (lt * 330 > TX - CX - 20) reaction((TX - CX - 20) / 330, 50); } break; }
        case 'blade': { if (lt > 0) { const sw = Math.min(1, lt * 6); const ang = -1.4 + sw * 2.6; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { g.strokeStyle = i === 0 ? '#fff' : i === 1 ? A : B; g.lineWidth = 16 - i * 5; g.globalAlpha = Math.max(0, 1 - Math.max(0, lt - 0.1) * 2.2) * (1 - i * 0.2); g.beginPath(); g.arc(CX + 22, GY - 70, 78 - i * 6, -1.5, ang); g.stroke(); } g.globalAlpha = 1; if (lt > 0.08) reaction(0.08, 55), glow(g, CX + 95, GY - 85, 30, A, Math.max(0, 1 - lt * 2.5)); } break; }
        case 'dash': { if (lt > 0) { const p = Math.min(1, lt / 0.28); const e = 1 - Math.pow(1 - p, 3); casterX = CX + (TX - 40 - CX) * e; const back = lt > 1.2 ? Math.min(1, (lt - 1.2) / 0.4) : 0; casterX = casterX + (CX - casterX) * back; for (let i = 1; i < 6; i++) { const q = Math.max(0, Math.min(1, (lt - i * 0.035) / 0.28)); const ex = CX + (TX - 40 - CX) * (1 - Math.pow(1 - q, 3)); glow(g, ex, GY - 55, 38, i % 2 ? A : B, (1 - i / 6) * 0.5 * (1 - back)); } if (lt > 0.14) reaction(0.14, 45); } break; }
        case 'shield': { const a = 0.35 + Math.sin(t * 6) * 0.1; glow(g, CX, GY - 55, 80, A, a); g.strokeStyle = A; g.lineWidth = 3; g.globalAlpha = 0.8; g.beginPath(); g.ellipse(CX, GY - 55, 52, 70, 0, 0, 7); g.stroke(); g.globalAlpha = 1; for (let i = 0; i < 3; i++) { const q = ((t * 1.1 + i * 0.33) % 1); const px = TX - q * (TX - CX - 55); glow(g, px, GY - 60 - i * 12, 7, '#ff4455', q < 1 ? 1 : 0); if (q > 0.97) glow(g, CX + 54, GY - 60 - i * 12, 25, '#fff'); } break; }
        case 'field': { if (lt > 0) { const grow = Math.min(1, lt * 3); for (let r = 0; r < 4; r++) { g.strokeStyle = r % 2 ? B : A; g.lineWidth = 3; g.globalAlpha = 0.7 * grow; g.beginPath(); g.ellipse(TX, GY - 5 - r * 22, (60 - r * 11) * grow, (14 - r * 2) * grow, 0, 0, 7); g.stroke(); } g.globalAlpha = 1; for (let i = 0; i < 40; i++) { const a = lt * 5 + i * 0.7, hh = (i / 40) * 110, r = (50 - hh * 0.3) * grow; glow(g, TX + Math.cos(a) * r, GY - 8 - hh + Math.sin(a) * 6, 4, i % 2 ? A : B, 0.9); } tdy = -Math.min(1, lt * 1.5) * 28 * (1 + Math.sin(lt * 5) * 0.2); tflash = 0.25 + Math.sin(lt * 12) * 0.2; hit = true; glow(g, TX, GY - 60, 90 * grow, A, 0.18); } break; }
        case 'summon': { if (lt > 0) for (let i = 0; i < 3; i++) { const a = Math.max(0, Math.min(1, (lt - i * 0.25) * 2)); if (a > 0) { g.globalCompositeOperation = 'source-over'; figure(g, CX + 60 + i * 55, GY, 0.85, 2, A, a * 0.85, A); g.globalCompositeOperation = 'lighter'; glow(g, CX + 60 + i * 55, GY - 50, 50 * (1 - a * 0.4), A, (1 - a) * 0.8 + 0.1); } } break; }
        case 'rain': { for (let i = 0; i < 8; i++) { const st = i * 0.22, a = lt - st; if (a > 0) { const dur = 0.5; const tx = TX - 60 + h(i) * 120, p = a / dur; if (p < 1) { const x = tx - 110 + 110 * p, y = -20 + (GY - 10 + 20) * p; if (s.cat === 'Lightning') { g.strokeStyle = A; g.lineWidth = 5; g.beginPath(); g.moveTo(tx, 0); g.lineTo(tx + (h(i + 2) - 0.5) * 30, GY * 0.5); g.lineTo(tx, GY); g.globalAlpha = 1 - p; g.stroke(); g.globalAlpha = 1; } else { for (let k = 0; k < 8; k++) glow(g, x - k * 8, y - k * 9, 12 - k, k % 2 ? A : B, 0.7 - k * 0.08); glow(g, x, y, 16, '#fff'); } } else { const q = a - dur; g.strokeStyle = A; g.lineWidth = 3; g.globalAlpha = Math.max(0, 1 - q * 2); g.beginPath(); g.ellipse(tx, GY, q * 110, q * 22, 0, 0, 7); g.stroke(); g.globalAlpha = 1; glow(g, tx, GY - 10, 30, B, Math.max(0, 1 - q * 3)); tflash = Math.max(tflash, 0.5 * Math.max(0, 1 - q * 3)); } } } if (lt > 0.5) { hit = true; tdx = Math.sin(lt * 25) * 3 * Math.max(0, 1 - lt * 0.5); } break; }
        case 'pull': case 'push': { const pull = fx === 'pull'; if (lt > 0) { for (let r = 0; r < 4; r++) { const a = (lt * 0.9 + r * 0.25) % 1; const rad = pull ? (1 - a) * 220 : a * 220; g.strokeStyle = r % 2 ? B : A; g.lineWidth = 4; g.globalAlpha = (pull ? a : 1 - a) * 0.9; g.beginPath(); g.ellipse(CX, GY - 50, rad, rad * 0.5, 0, 0, 7); g.stroke(); } g.globalAlpha = 1; glow(g, CX, GY - 50, 36, A, 0.8); const ap = Math.min(1, lt * 2.5); tdx = pull ? -ap * 130 : ap * 60; tflash = Math.max(0, 1 - lt * 2); hit = true; } break; }
        case 'nova': { if (lt > 0 && lt < 0.9) { const p = lt / 0.9; glow(g, CX + 15, GY - 80, 30 + p * 40, A, 1); glow(g, CX + 15, GY - 80, 12 + p * 16, '#fff'); } if (lt > 0.9) { const a = lt - 0.9; glow(g, CX + 15, GY - 70, 40 + a * 520, A, Math.max(0, 1 - a * 1.1)); glow(g, CX + 15, GY - 70, 20 + a * 300, '#fff', Math.max(0, 1 - a * 2)); g.strokeStyle = B; g.lineWidth = 8; g.globalAlpha = Math.max(0, 1 - a * 1.2); g.beginPath(); g.ellipse(CX + 15, GY - 10, a * 420, a * 80, 0, 0, 7); g.stroke(); g.globalAlpha = 1; g.fillStyle = '#fff'; g.globalAlpha = Math.max(0, 0.5 - a * 1.5); g.fillRect(0, 0, W, H); g.globalAlpha = 1; reaction(0.95, 70); } break; }
        case 'strike': { if (lt > 0.25) { const a = lt - 0.25; const earth = s.cat === 'Earth'; const w = (earth ? 30 : 20) * Math.max(0, 1 - a * 2.4); g.fillStyle = A; g.globalAlpha = Math.max(0, 1 - a * 2.4); if (earth) { g.fillRect(TX - w / 2, GY - Math.min(1, a * 8) * 110, w, Math.min(1, a * 8) * 110); } else { g.beginPath(); g.moveTo(TX + 10, 0); g.lineTo(TX - 12, GY * 0.45); g.lineTo(TX + 8, GY * 0.5); g.lineTo(TX - 4, GY); g.lineTo(TX + 12, GY * 0.52); g.lineTo(TX - 6, GY * 0.46); g.closePath(); g.fill(); } g.globalAlpha = 1; glow(g, TX, GY - 20, 60 + a * 80, B, Math.max(0, 1 - a * 2)); g.strokeStyle = A; g.lineWidth = 3; g.beginPath(); g.ellipse(TX, GY, a * 130, a * 24, 0, 0, 7); g.globalAlpha = Math.max(0, 1 - a * 2); g.stroke(); g.globalAlpha = 1; reaction(0.27, 30); } break; }
        case 'heal': { if (lt > 0) { for (let i = 0; i < 30; i++) { const a = (lt * 0.8 + h(i)) % 1; glow(g, CX + (h(i + 3) - 0.5) * 60, GY - a * 130, 5, A, 1 - a); } g.fillStyle = A; g.globalAlpha = 0.9; g.font = 'bold 26px sans-serif'; g.fillText('+', CX + 35, GY - 80 - lt * 30); g.globalAlpha = 1; glow(g, CX, GY - 55, 60, A, 0.25 + Math.sin(lt * 8) * 0.1); } break; }
      }
      g.globalCompositeOperation = 'source-over';
      figure(g, casterX, GY, 1, pose, A, fx === 'dash' && lt > 0.02 && lt < 0.3 ? 0.25 : 1);
      // target dummy
      const tcol = tflash > 0.1 ? '#ffffff' : '#ff5a6a'; figure(g, TX + tdx, GY + tdy, 1, 0, tcol, 1, '#7a2030');
      if (hit && fx !== 'field') { /* hp bar */ }
      const hpv = fx === 'heal' ? Math.min(1, hp0 + Math.max(0, lt) * 0.3) : 1 - Math.min(0.6, (hit ? Math.max(0, lt) * 0.18 : 0));
      g.fillStyle = '#000a'; g.fillRect(TX - 25 + tdx, GY - 140 + tdy, 50, 5); g.fillStyle = fx === 'heal' ? '#7cff6a' : '#ff4466'; g.fillRect(TX - 25 + tdx, GY - 140 + tdy, 50 * hpv, 5);
      g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.fillText(s.name.toUpperCase(), 10, 18); g.fillStyle = '#ffffff88'; g.font = '10px sans-serif'; g.fillText(`${s.cat} • ${s.fx.toUpperCase()}`, 10, 32);
      raf = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, [s, k]);
  return <canvas ref={ref} width={W} height={H} className="w-full rounded-lg border border-white/10" style={{ background: '#0b0a18' }} />;
}
