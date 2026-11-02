import { World } from './colliders';

// Binary-heap A* over the coarse navigation grid (10 m cells, 8-connected)
export function findPath(w: World, sx: number, sz: number, tx: number, tz: number): [number, number][] {
  const nav = w.nav;
  if (!nav) return [[tx, tz]];
  const n = w.navN, cell = w.navCell, half = w.half;
  const toC = (v: number) => Math.max(0, Math.min(n - 1, Math.floor((v + half) / cell)));
  const near = (ci: number, cj: number) => {
    if (!nav[cj * n + ci]) return [ci, cj];
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < n && j < n && !nav[j * n + i]) return [i, j];
    }
    return [ci, cj];
  };
  const [si, sj] = near(toC(sx), toC(sz));
  const [ti, tj] = near(toC(tx), toC(tz));
  const start = sj * n + si, goal = tj * n + ti;
  if (start === goal) return [[tx, tz]];
  const g = new Float32Array(n * n).fill(1e9);
  const from = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const heap: number[] = [], hf: number[] = [];
  const push = (id: number, f: number) => {
    heap.push(id); hf.push(f);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= hf[i]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const lastId = heap.pop()!, lastF = hf.pop()!;
    if (heap.length) {
      heap[0] = lastId; hf[0] = lastF;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && hf[l] < hf[m]) m = l;
        if (r < heap.length && hf[r] < hf[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m;
      }
    }
    return top;
  };
  const hh = (i: number, j: number) => {
    const dx = Math.abs(i - ti), dj = Math.abs(j - tj);
    return (dx + dj) + (1.414 - 2) * Math.min(dx, dj);
  };
  g[start] = 0;
  push(start, hh(si, sj));
  let iter = 0;
  while (heap.length && iter++ < 9000) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    const ci = cur % n, cj = (cur / n) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const id = j * n + i;
      if (nav[id] || closed[id]) continue;
      if (di && dj && (nav[cj * n + i] || nav[j * n + ci])) continue;
      const ng = g[cur] + (di && dj ? 1.414 : 1);
      if (ng < g[id]) { g[id] = ng; from[id] = cur; push(id, ng + hh(i, j)); }
    }
  }
  if (from[goal] < 0) return [[tx, tz]];
  const pts: [number, number][] = [];
  let c = goal;
  while (c !== start && c >= 0) { pts.push([(c % n + 0.5) * cell - half, (((c / n) | 0) + 0.5) * cell - half]); c = from[c]; }
  pts.reverse();
  // drop collinear points
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && i < pts.length - 1) {
      const a = pts[i - 1], b = pts[i], d = pts[i + 1];
      if (Math.abs((b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0])) < 1) continue;
    }
    out.push(pts[i]);
  }
  out.push([tx, tz]);
  return out;
}
