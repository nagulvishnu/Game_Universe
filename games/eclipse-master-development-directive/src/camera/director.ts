// Cinematic camera director: decides shot grammar (pure logic, no rendering).
import type { Beat, SceneDef, ShotHint } from '../engine/types';
import type { CombatEvent } from '../ai/combat';
import type { EnvData } from '../world/envData';

export interface DirCtx {
  beat: Beat; scene: SceneDef; beatIdx: number; present: string[]; lineCount: number;
  pos: (id: string) => [number, number] | undefined;
}

const sideFor = (a: string, b: string): 1 | -1 => (a < b ? 1 : -1);
const INTENSE = new Set(['anger', 'fear', 'sorrow', 'resolve', 'surprise']);

export function planShot(c: DirCtx): ShotHint {
  const b = c.beat;
  if ('shot' in b && b.shot) return b.shot;
  switch (b.t) {
    case 'line': {
      const speaker = b.who;
      if (b.off || !c.present.includes(speaker)) return { k: c.scene.id === 'a1_prologue' ? 'establish' : 'wide', move: 'push' };
      const sp = c.pos(speaker);
      let listener = b.to && c.present.includes(b.to) ? b.to : undefined;
      if (!listener && sp) {
        let best = Infinity;
        for (const p of c.present) {
          if (p === speaker) continue;
          const q = c.pos(p); if (!q) continue;
          const d = Math.hypot(q[0] - sp[0], q[1] - sp[1]);
          if (d < best) { best = d; listener = p; }
        }
      }
      if (!listener) return { k: 'close', on: [speaker], move: 'push' };
      const n = c.lineCount;
      const side = sideFor(speaker, listener);
      const on = [speaker, listener];
      if (n % 6 === 5) return { k: 'two', on, move: 'push' };
      if ((b.emo === 'surprise' || b.emo === 'fear') && b.text.length < 45) return { k: 'ecu', on, side, move: 'static' };
      if (INTENSE.has(b.emo ?? '') && n % 2 === 0) return { k: 'close', on, side, move: 'push' };
      if (b.text.length > 120) return { k: 'medium', on, side, move: 'handheld' };
      return n % 3 === 1 ? { k: 'medium', on, side, move: 'push' } : { k: 'ots', on, side };
    }
    case 'move': return { k: Object.keys(b.to).length > 1 ? 'wide' : 'track', on: Object.keys(b.to), side: 1, move: 'track' };
    case 'enter': return { k: 'track', on: [b.who], side: -1, move: 'track' };
    case 'exit': return { k: 'track', on: [b.who], side: 1, move: 'track' };
    case 'act':
      if (b.anim === 'raise' || b.anim === 'cast' || b.anim === 'blast') return { k: 'low', on: [b.who], move: 'push' };
      return { k: 'medium', on: [b.who], side: 1, move: 'push' };
    case 'title': return { k: 'establish', move: 'crane' };
    case 'wait': return { k: 'wide', move: 'push' };
    default: return { k: 'wide', move: 'push' };
  }
}

/** Combat coverage: cycles through tracking, low-angle, over-shoulder, wide and close-up impact shots. */
export function combatShot(e: CombatEvent, n: number, fighterCount: number): ShotHint | null {
  if (e.k === 'finish') return { k: 'close', on: [e.who, e.target], side: 1, move: 'push' };
  if (e.k === 'clash') return { k: 'two', on: [], move: 'push' };
  if (e.k !== 'windup') return null;
  const on = [e.who, e.target];
  if (fighterCount > 3) return n % 3 === 0 ? { k: 'wide', on: [], move: 'orbit' } : { k: 'track', on, side: n % 2 ? 1 : -1, move: 'track' };
  if (e.ability.ult) return { k: 'low', on: [e.who], move: 'push' };
  switch (n % 5) {
    case 0: return { k: 'track', on, side: 1, move: 'track' };
    case 1: return { k: 'ots', on, side: sideFor(e.who, e.target) };
    case 2: return { k: 'low', on, side: -1, move: 'static' };
    case 3: return { k: 'medium', on, side: -1, move: 'handheld' };
    default: return { k: 'high', on, move: 'push' };
  }
}

export interface Pose { pos: [number, number, number]; look: [number, number, number]; fov: number }
const LENS_DEFAULT: Record<string, number> = { establish: 24, wide: 28, medium: 42, close: 70, ecu: 95, ots: 55, two: 40, low: 30, high: 32, track: 38, top: 30 };

/** Compute the ideal camera pose for a shot from live character positions. */
export function shotPose(
  shot: ShotHint, t: number, env: EnvData,
  head: (id: string) => [number, number, number] | undefined,
  facing: (id: string) => number | undefined,
  all: () => [number, number, number][],
): Pose {
  const pts = (shot.on ?? []).map(head).filter(Boolean) as [number, number, number][];
  const pool = pts.length ? pts : all();
  const n = Math.max(1, pool.length);
  const C: [number, number, number] = pool.length
    ? [pool.reduce((s, p) => s + p[0], 0) / n, pool.reduce((s, p) => s + p[1], 0) / n, pool.reduce((s, p) => s + p[2], 0) / n]
    : [0, 1.3, 0];
  const side = shot.side ?? 1;
  const u = Math.min(1, t / 7);
  const mv = shot.move ?? 'static';
  const dm = mv === 'push' ? 1 - 0.2 * u : mv === 'pull' ? 1 + 0.25 * u : 1;
  const sway = mv === 'handheld' ? [Math.sin(t * 1.7) * 0.03, Math.sin(t * 2.3) * 0.02, Math.cos(t * 1.3) * 0.03] : [0, 0, 0];
  let pos: [number, number, number] = [0, 2, 8], look: [number, number, number] = [C[0], C[1], C[2]];
  const first = pts[0], second = pts[1];
  const dir = (a: [number, number, number], b: [number, number, number]): [number, number] => {
    const dx = b[0] - a[0], dz = b[2] - a[2], d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d];
  };
  const rot = (v: [number, number], ang: number): [number, number] => [v[0] * Math.cos(ang) - v[1] * Math.sin(ang), v[0] * Math.sin(ang) + v[1] * Math.cos(ang)];
  const fallbackDir = (): [number, number] => {
    const y = facing(shot.on?.[0] ?? '') ?? 0; return [Math.sin(y), Math.cos(y)];
  };
  switch (shot.k) {
    case 'establish': {
      const a = mv === 'orbit' ? t * 0.07 - 0.3 : -0.35;
      const r = env.cam.r * (mv === 'crane' ? 1.05 - 0.1 * u : 1);
      const h = env.cam.h + (mv === 'crane' ? -u * 1.8 + 1.4 : 0);
      pos = [Math.sin(a) * r, h, Math.cos(a) * r]; look = [C[0] * 0.5, 1.4, C[2] * 0.5 - 1];
      break;
    }
    case 'wide': {
      const a = (mv === 'orbit' ? t * 0.1 : 0) + side * 0.35;
      const r = Math.max(7, env.cam.r * 0.62) * dm;
      pos = [C[0] + Math.sin(a) * r, 2.4 + (mv === 'crane' ? u * 2 : 0), C[2] + Math.cos(a) * r]; look = [C[0], 1.3, C[2]];
      break;
    }
    case 'high': case 'top': {
      pos = [C[0] + 1.5 * side, shot.k === 'top' ? 13 : 7, C[2] + (shot.k === 'top' ? 2 : 6)]; look = [C[0], 0.8, C[2]];
      break;
    }
    case 'track': {
      const f = fallbackDir(); const perp: [number, number] = [-f[1], f[0]];
      const d = 4.2 * dm;
      pos = [C[0] + perp[0] * d * side - f[0] * 0.8, 1.5, C[2] + perp[1] * d * side - f[1] * 0.8];
      look = [C[0] + f[0] * 0.9, C[1] - 0.1, C[2] + f[1] * 0.9];
      break;
    }
    case 'low': {
      const f = fallbackDir(); const d = 3.4 * dm;
      pos = [C[0] + f[0] * d + side * 0.6, 0.45, C[2] + f[1] * d]; look = [C[0], C[1] + 0.3, C[2]];
      break;
    }
    case 'ots': {
      if (first && second) {
        const d = dir(second, first); // listener -> speaker
        const p = rot(d, side * 0.35);
        pos = [second[0] - d[0] * 2.0 - p[1] * 0.0 + (-d[1]) * 0.8 * side, second[1] + 0.2, second[2] - d[1] * 2.0 + d[0] * 0.8 * side];
        look = [first[0], first[1] - 0.04, first[2]];
      } else { pos = [C[0], C[1], C[2] + 3.4 * dm]; look = C; }
      break;
    }
    case 'two': {
      if (first && second) {
        const d = dir(first, second); const span = Math.hypot(second[0] - first[0], second[2] - first[2]);
        const mid: [number, number, number] = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2, (first[2] + second[2]) / 2];
        const dist = Math.max(3.2, span * 1.2 + 2) * dm;
        pos = [mid[0] + -d[1] * dist * side, 1.45, mid[2] + d[0] * dist * side]; look = [mid[0], mid[1] - 0.1, mid[2]];
        break;
      }
      const dd = 3.4 * dm; pos = [C[0], C[1], C[2] + dd]; look = C;
      break;
    }
    case 'medium': case 'close': case 'ecu': default: {
      const dist = ({ medium: 2.9, close: 1.6, ecu: 0.95 } as Record<string, number>)[shot.k] ?? 3;
      const D = dist * dm;
      if (first) {
        const fd = fallbackDir();
        let v = second ? dir(first, second) : fd;
        // never shoot a face from behind: if the listener is behind the speaker, shoot along the speaker's facing instead
        if (v[0] * fd[0] + v[1] * fd[1] < 0.35) v = fd;
        const r = rot(v, side * (shot.k === 'ecu' ? 0.35 : 0.5));
        pos = [first[0] + r[0] * D, first[1] + (shot.k === 'medium' ? 0.05 : 0.0), first[2] + r[1] * D];
        look = [first[0], first[1] - (shot.k === 'medium' ? 0.12 : 0.02), first[2]];
      } else { pos = [C[0], C[1] + 0.2, C[2] + D]; look = C; }
    }
  }
  pos = [pos[0] + sway[0], pos[1] + sway[1], pos[2] + sway[2]];
  // keep camera inside the space
  const lim = env.bounds * (env.interior ? 0.94 : 1.15);
  const rr = Math.hypot(pos[0], pos[2]);
  if (rr > lim) { pos[0] *= lim / rr; pos[2] *= lim / rr; }
  pos[1] = Math.max(0.35, Math.min(14, pos[1]));
  const lens = shot.lens ?? LENS_DEFAULT[shot.k] ?? 40;
  const fov = (2 * Math.atan(12 / (lens * 0.7))) * (180 / Math.PI); // lens scaled for a wider effective sensor so close-ups keep head+shoulders
  return { pos, look, fov };
}
