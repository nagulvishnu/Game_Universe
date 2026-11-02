// Procedural animation: converts agent state (stance, locomotion, gesture, one-shot anim) into joint targets.
import type { NpcAgent } from '../ai/npc';

export const JOINTS = ['hips', 'spine', 'chest', 'shL', 'shR', 'elL', 'elR', 'thL', 'thR', 'knL', 'knR'] as const;
export type Joint = (typeof JOINTS)[number];
export interface Pose {
  rootY: number; rootPitch: number; rootX: number; headX: number; headY: number; headZ: number;
  j: Record<Joint, [number, number, number]>;
  fast: boolean;
}
const zero = (): Record<Joint, [number, number, number]> =>
  Object.fromEntries(JOINTS.map((k) => [k, [0, 0, 0]])) as Record<Joint, [number, number, number]>;

const env = (u: number) => Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
const seg = (u: number, a: number, b: number) => Math.max(0, Math.min(1, (u - a) / (b - a)));

export function computePose(a: NpcAgent, t: number): Pose {
  const p: Pose = { rootY: 0, rootPitch: 0, rootX: 0, headX: 0, headY: 0, headZ: 0, j: zero(), fast: false };
  const j = p.j;
  // ---- stance base ----
  j.shL[2] = 0.1; j.shR[2] = -0.1; j.elL[0] = -0.15; j.elR[0] = -0.15;
  switch (a.stance) {
    case 'combat': {
      j.hips[1] = 0.4; j.spine[1] = -0.2; j.spine[0] = 0.12;
      j.thL[0] = -0.45; j.knL[0] = 0.65; j.thR[0] = 0.3; j.knR[0] = 0.55; j.thL[2] = 0.08; j.thR[2] = -0.12;
      j.shR[0] = -1.0; j.shR[2] = -0.25; j.elR[0] = -1.25; j.shL[0] = -0.6; j.shL[2] = 0.35; j.elL[0] = -1.2;
      p.rootY = -0.08 + Math.sin(t * 5) * 0.012; p.fast = true;
      break;
    }
    case 'wounded':
      j.spine[0] = 0.3; j.chest[0] = 0.15; j.thL[0] = -0.12; j.knL[0] = 0.25; j.thR[0] = 0.1; j.knR[0] = 0.3;
      j.shL[0] = -0.4; j.shL[2] = 0.15; j.elL[0] = -1.7; p.rootY = -0.05; p.headX = 0.25; j.hips[2] = 0.06;
      break;
    case 'sit':
      p.rootY = -0.46; j.thL[0] = -1.45; j.thR[0] = -1.45; j.knL[0] = 1.5; j.knR[0] = 1.5; j.thL[2] = 0.1; j.thR[2] = -0.1;
      j.spine[0] = 0.12; j.shL[0] = -0.55; j.elL[0] = -0.9; j.shR[0] = -0.5; j.elR[0] = -0.9; p.headX = 0.1;
      break;
    case 'kneel':
      p.rootY = -0.48; j.thL[0] = -1.5; j.knL[0] = 1.5; j.thR[0] = 0.15; j.knR[0] = 1.95;
      j.spine[0] = 0.28; p.headX = 0.3; j.shL[0] = -0.3; j.shR[0] = -0.2; j.elL[0] = -0.5;
      break;
    case 'down':
      p.rootPitch = -1.5; p.rootY = 0.17; j.shL[2] = 0.6; j.shR[2] = -0.5; j.thL[2] = 0.15; j.thR[2] = -0.12; j.elL[0] = -0.2;
      break;
    default: break;
  }
  const standing = a.stance === 'stand' || a.stance === 'combat' || a.stance === 'wounded';
  // ---- locomotion ----
  if (a.speed > 0.15 && standing) {
    const run = a.speed > 2.4;
    const amp = Math.min(1, a.speed / 1.5) * 0.5 + (run ? 0.45 : 0);
    const ph = t * (a.speed * 3.4 + 1);
    j.thL[0] = -Math.sin(ph) * amp; j.thR[0] = Math.sin(ph) * amp;
    j.knL[0] = Math.max(0, Math.cos(ph)) * amp * 1.3 + (run ? 0.2 : 0); j.knR[0] = Math.max(0, -Math.cos(ph)) * amp * 1.3 + (run ? 0.2 : 0);
    j.shL[0] = Math.sin(ph) * amp * 0.75; j.shR[0] = -Math.sin(ph) * amp * 0.75;
    j.elL[0] = -0.3 - (run ? 0.9 : 0); j.elR[0] = -0.3 - (run ? 0.9 : 0);
    j.spine[0] = (a.stance === 'wounded' ? 0.35 : 0.06) + (run ? 0.28 : 0); j.hips[1] = Math.sin(ph) * 0.14; j.spine[1] = -Math.sin(ph) * 0.1;
    p.rootY += Math.abs(Math.sin(ph)) * (run ? 0.06 : 0.03);
    j.shL[2] = 0.1; j.shR[2] = -0.1;
  } else if (standing && a.stance !== 'combat') {
    // idle life
    j.chest[0] += Math.sin(t * 1.6) * 0.02; j.spine[0] += Math.sin(t * 1.6 + 0.5) * 0.01;
    const ib = a.idleBehavior;
    if (ib.name === 'sway') { j.hips[2] = Math.sin(t * 0.8) * 0.035; j.spine[2] = Math.sin(t * 0.8 + 1) * -0.02; p.rootX = Math.sin(t * 0.8) * 0.015; }
    else if (ib.name === 'fidget') { j.elR[0] += Math.sin(t * 3) * 0.12 - 0.2; j.shR[0] -= 0.2; }
    else if (ib.name === 'breathe') { j.chest[0] += Math.sin(t * 1.1) * 0.025; j.shL[2] += Math.sin(t * 1.1) * 0.02; }
  } else if (a.stance === 'combat') { j.shR[0] += Math.sin(t * 4) * 0.04; }
  // ---- gestures (speech) ----
  const g = a.gesture;
  if (g && !a.anim && a.stance !== 'down') {
    const e = env(g.t / g.dur); const w = Math.sin(t * 6) * 0.1 * e;
    switch (g.name) {
      case 'open': j.shR[0] = lerp(j.shR[0], -0.95 + w, e); j.shR[2] = lerp(j.shR[2], -0.4, e); j.elR[0] = lerp(j.elR[0], -1.0, e); j.shL[0] = lerp(j.shL[0], -0.4, e * 0.6); j.elL[0] = lerp(j.elL[0], -0.9, e * 0.6); break;
      case 'point': j.shR[0] = lerp(j.shR[0], -1.45, e); j.elR[0] = lerp(j.elR[0], -0.15, e); j.shR[2] = lerp(j.shR[2], -0.12, e); break;
      case 'chest': j.shR[0] = lerp(j.shR[0], -0.8, e); j.shR[2] = lerp(j.shR[2], 0.5, e); j.elR[0] = lerp(j.elR[0], -2.15, e); break;
      case 'fist': j.shR[0] = lerp(j.shR[0], -1.0, e); j.elR[0] = lerp(j.elR[0], -1.95, e); j.shR[2] = lerp(j.shR[2], -0.2, e); j.shR[0] += w; break;
      case 'shrug': j.shL[2] = lerp(j.shL[2], 0.55, e); j.shR[2] = lerp(j.shR[2], -0.55, e); j.elL[0] = lerp(j.elL[0], -1.1, e); j.elR[0] = lerp(j.elR[0], -1.1, e); p.headZ = 0.12 * e; break;
      case 'nod': p.headX += Math.sin(g.t * 9) * 0.14 * e; break;
      case 'shake': p.headY += Math.sin(g.t * 9) * 0.22 * e; break;
      default: break;
    }
  }
  if (a.speech) { p.headX += Math.sin(t * 5.3) * 0.025; p.headY += Math.sin(t * 3.1) * 0.03; }
  // ---- one-shot animations ----
  const an = a.anim;
  if (an) {
    p.fast = true;
    const u = an.t / an.dur; const e = env(u);
    switch (an.name) {
      case 'slash_h': {
        const w = seg(u, 0, 0.35), s = seg(u, 0.35, 0.6), r = seg(u, 0.6, 1);
        j.shR[0] = -1.2 * e; j.shR[2] = lerp(lerp(-0.2, -1.5, w), 0.4, s) * (1 - r * 0.8); j.elR[0] = -0.5 - 0.3 * e;
        j.spine[1] = lerp(lerp(0, -0.8, w), 0.9, s) * (1 - r); j.hips[1] += lerp(lerp(0, -0.4, w), 0.5, s) * (1 - r);
        j.thL[0] += -0.5 * e; j.knL[0] += 0.4 * e; j.spine[0] += 0.15 * e; break;
      }
      case 'slash_v': {
        const w = seg(u, 0, 0.35), s = seg(u, 0.35, 0.6), r = seg(u, 0.6, 1);
        j.shR[0] = lerp(lerp(-1, -2.9, w), -0.3, s) * (1 - r * 0.6); j.elR[0] = lerp(-1.2, -0.2, s) * (1 - r * 0.5); j.shL[0] = -0.9 * e; j.elL[0] = -1.2 * e;
        j.spine[0] += lerp(lerp(0, -0.2, w), 0.5, s) * (1 - r); j.thL[0] += -0.6 * e; j.knL[0] += 0.5 * e; break;
      }
      case 'thrust': {
        const w = seg(u, 0, 0.35), s = seg(u, 0.35, 0.55), r = seg(u, 0.55, 1);
        j.shR[0] = lerp(lerp(-0.8, -0.5, w), -1.55, s) * (1 - r * 0.5); j.elR[0] = lerp(lerp(-1.3, -2.2, w), -0.05, s) * (1 - r * 0.4);
        j.spine[1] = lerp(0, -0.5, w) * (1 - s); j.spine[0] += 0.3 * s * (1 - r); j.thL[0] += -0.9 * s * (1 - r); j.knL[0] += 0.5 * s; j.thR[0] += 0.4 * s; break;
      }
      case 'cast': {
        const pul = Math.sin(t * 14) * 0.05 * e;
        j.shL[0] = -1.5 * e + pul; j.shR[0] = -1.5 * e - pul; j.shL[2] = 0.45 * e; j.shR[2] = -0.45 * e; j.elL[0] = -0.4 * e; j.elR[0] = -0.4 * e;
        j.chest[0] -= 0.15 * e; p.headX -= 0.2 * e; break;
      }
      case 'blast': {
        const w = seg(u, 0, 0.4), s = seg(u, 0.4, 0.55);
        j.shL[0] = lerp(lerp(-0.4, -0.8, w), -1.55, s) * e2(u); j.shR[0] = lerp(lerp(-0.4, -0.8, w), -1.55, s) * e2(u);
        j.shL[2] = lerp(0.9, 0.12, s) * e2(u); j.shR[2] = lerp(-0.9, -0.12, s) * e2(u); j.elL[0] = lerp(-1.4, -0.1, s); j.elR[0] = lerp(-1.4, -0.1, s);
        j.spine[0] += 0.25 * s * (1 - seg(u, 0.7, 1)); j.chest[0] -= 0.3 * w * (1 - s); break;
      }
      case 'raise': {
        j.shL[0] = -2.85 * e; j.shR[0] = -2.85 * e; j.shL[2] = 0.28 * e; j.shR[2] = -0.28 * e; j.elL[0] = -0.2 * e; j.elR[0] = -0.2 * e;
        j.chest[0] -= 0.22 * e; p.headX -= 0.35 * e; p.rootY += 0.04 * e; break;
      }
      case 'block': j.shR[0] = -1.5 * e; j.shR[2] = 0.45 * e; j.elR[0] = -1.55 * e; j.shL[0] = -1.1 * e; j.elL[0] = -1.4 * e; j.spine[0] -= 0.12 * e; break;
      case 'dodge': j.spine[0] -= 0.4 * e; j.hips[2] = 0.3 * e; p.rootY += 0.07 * e; j.thL[0] -= 0.5 * e; j.thR[0] += 0.5 * e; j.shL[2] += 0.6 * e; j.shR[2] -= 0.6 * e; break;
      case 'hit': j.spine[0] -= 0.55 * e; j.chest[0] -= 0.2 * e; p.headX -= 0.4 * e; j.shL[2] += 0.8 * e; j.shR[2] -= 0.8 * e; j.thL[0] -= 0.2 * e; break;
      case 'bow': j.spine[0] += 0.85 * e; p.headX += 0.3 * e; j.shL[0] -= 0.1 * e; j.shR[0] -= 0.1 * e; break;
      case 'flinch': j.shL[0] = -0.8 * e; j.shR[0] = -0.8 * e; j.shL[2] += 0.4 * e; j.shR[2] -= 0.4 * e; j.elL[0] = -1.7 * e; j.elR[0] = -1.7 * e; j.spine[0] += 0.3 * e; p.headX += 0.2 * e; p.rootY -= 0.05 * e; break;
      case 'draw': j.shR[0] = -1.25 * e; j.elR[0] = -1.5 * e; j.shR[2] = -0.3 * e; break;
      case 'reach': j.shR[0] = -1.6 * e; j.elR[0] = -0.25 * e; j.spine[0] += 0.12 * e; j.shR[2] = -0.15 * e; break;
      default: break;
    }
  }
  return p;
}
const e2 = (u: number) => (u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15);
