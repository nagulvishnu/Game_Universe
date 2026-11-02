// Grid A* navigation with obstacle inflation and line-of-sight path smoothing.
import type { Vec2 } from '../engine/types';
import type { EnvData } from '../world/envData';

const CELL = 0.7;
const AGENT_R = 0.45;

function blocked(env: EnvData, x: number, z: number): boolean {
  if (Math.hypot(x, z) > env.bounds - 0.5) return true;
  for (const o of env.obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + AGENT_R) return true;
  return false;
}

function los(env: EnvData, a: Vec2, b: Vec2): boolean {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.ceil(d / 0.35);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocked(env, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

export function findPath(env: EnvData, from: Vec2, to: Vec2): Vec2[] | null {
  if (los(env, from, to)) return [to];
  const half = Math.ceil(env.bounds / CELL);
  const N = half * 2 + 1;
  const idx = (i: number, j: number) => (j + half) * N + (i + half);
  const toCell = (v: Vec2): [number, number] => [Math.round(v[0] / CELL), Math.round(v[1] / CELL)];
  const [si, sj] = toCell(from);
  const [gi, gj] = toCell(to);
  const g = new Float32Array(N * N).fill(Infinity);
  const came = new Int32Array(N * N).fill(-1);
  const open: { i: number; j: number; f: number }[] = [{ i: si, j: sj, f: 0 }];
  g[idx(si, sj)] = 0;
  const closed = new Uint8Array(N * N);
  let found = false;
  let guard = 0;
  while (open.length && guard++ < 20000) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
    const cur = open.splice(bi, 1)[0];
    const ci = idx(cur.i, cur.j);
    if (closed[ci]) continue;
    closed[ci] = 1;
    if (cur.i === gi && cur.j === gj) { found = true; break; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = cur.i + di, nj = cur.j + dj;
      if (Math.abs(ni) > half || Math.abs(nj) > half) continue;
      const ni2 = idx(ni, nj);
      if (closed[ni2]) continue;
      const goalCell = ni === gi && nj === gj;
      if (!goalCell && blocked(env, ni * CELL, nj * CELL)) continue;
      const cost = g[ci] + (di && dj ? 1.414 : 1);
      if (cost < g[ni2]) {
        g[ni2] = cost; came[ni2] = ci;
        open.push({ i: ni, j: nj, f: cost + Math.hypot(gi - ni, gj - nj) });
      }
    }
  }
  if (!found) return null;
  const cells: Vec2[] = [];
  let c = idx(gi, gj);
  while (c !== -1 && c !== idx(si, sj)) {
    cells.push([((c % N) - half) * CELL, (Math.floor(c / N) - half) * CELL]);
    c = came[c];
  }
  cells.reverse();
  cells[cells.length - 1] = to;
  // string-pulling smoothing
  const out: Vec2[] = [];
  let anchor = from;
  for (let k = 0; k < cells.length; k++) {
    const next = cells[k + 1];
    if (!next || !los(env, anchor, next)) { out.push(cells[k]); anchor = cells[k]; }
  }
  return out;
}
