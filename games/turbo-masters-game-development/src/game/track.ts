import * as THREE from "three";
import { TrackDef } from "./data";

export interface Proj {
  kappa: number;
  i: number; // float sample index in [0,N]
  d: number; // lateral offset, + = left
  y: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  slope: number;
}
export const newProj = (): Proj => ({ kappa: 0, i: 0, d: 0, y: 0, tx: 0, tz: 1, nx: 1, nz: 0, slope: 0 });

export interface ZoneRange {
  i0: number;
  i1: number;
  kind: "tunnel" | "bridge" | "cable";
}

export class Track {
  def: TrackDef;
  N: number;
  ds: number;
  length: number;
  halfW: number;
  wallHalf: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  tx: Float32Array;
  tz: Float32Array;
  nx: Float32Array;
  nz: Float32Array;
  slope: Float32Array;
  vcurv: Float32Array;
  zones: ZoneRange[] = [];
  ctrlIdx: number[] = [];
  minX = Infinity;
  maxX = -Infinity;
  minZ = Infinity;
  maxZ = -Infinity;
  private grid = new Map<number, number[]>();
  private cell = 40;

  constructor(def: TrackDef) {
    this.def = def;
    const pts = def.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    const M = 6000;
    const dense = curve.getPoints(M);
    const cum = new Float32Array(M + 1);
    for (let i = 1; i <= M; i++) cum[i] = cum[i - 1] + dense[i].distanceTo(dense[i - 1]);
    this.length = cum[M];
    this.N = Math.round(this.length / 4);
    this.ds = this.length / this.N;
    const N = this.N;
    this.px = new Float32Array(N);
    this.py = new Float32Array(N);
    this.pz = new Float32Array(N);
    let k = 0;
    for (let i = 0; i < N; i++) {
      const s = i * this.ds;
      while (k < M - 1 && cum[k + 1] < s) k++;
      const f = (s - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
      this.px[i] = dense[k].x + (dense[k + 1].x - dense[k].x) * f;
      this.py[i] = dense[k].y + (dense[k + 1].y - dense[k].y) * f;
      this.pz[i] = dense[k].z + (dense[k + 1].z - dense[k].z) * f;
    }
    if (def.theme === "desert") {
      // dune jumps: short sharp crests that launch fast cars
      [0.2, 0.41, 0.78].forEach((f) => {
        const c = Math.floor(N * f), w = 6;
        for (let k = -w; k <= w; k++) {
          const s = Math.sin((Math.PI * (k + w)) / (2 * w));
          this.py[(c + k + N) % N] += 1.9 * s * s;
        }
      });
    }
    this.tx = new Float32Array(N);
    this.tz = new Float32Array(N);
    this.nx = new Float32Array(N);
    this.nz = new Float32Array(N);
    this.slope = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i + N - 1) % N, b = (i + 1) % N;
      let dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dz) || 1;
      this.slope[i] = (this.py[b] - this.py[a]) / l;
      dx /= l;
      dz /= l;
      this.tx[i] = dx;
      this.tz[i] = dz;
      this.nx[i] = dz;
      this.nz[i] = -dx;
      this.minX = Math.min(this.minX, this.px[i]);
      this.maxX = Math.max(this.maxX, this.px[i]);
      this.minZ = Math.min(this.minZ, this.pz[i]);
      this.maxZ = Math.max(this.maxZ, this.pz[i]);
    }
    this.vcurv = new Float32Array(N);
    for (let i = 0; i < N; i++) this.vcurv[i] = (this.slope[(i + 3) % N] - this.slope[(i + N - 3) % N]) / (6 * this.ds);
    this.halfW = def.halfW;
    this.wallHalf = def.halfW + def.wallExtra;
    const n = def.pts.length;
    const arcAt = (kk: number) => {
      const t = (((kk % n) + n) % n) / n * M;
      const i = Math.min(M - 1, Math.floor(t));
      return cum[i] + (cum[i + 1] - cum[i]) * (t - i);
    };
    this.ctrlIdx = def.pts.map((_, j) => Math.round(arcAt(j) / this.ds) % N);
    this.zones = def.zones.map((z) => ({ i0: Math.round(arcAt(z.k0) / this.ds), i1: Math.round(arcAt(z.k1) / this.ds), kind: z.kind }));
    for (let i = 0; i < N; i++) {
      const key = this.key(Math.floor(this.px[i] / this.cell), Math.floor(this.pz[i] / this.cell));
      const arr = this.grid.get(key);
      if (arr) arr.push(i);
      else this.grid.set(key, [i]);
    }
  }
  private key(cx: number, cz: number) {
    return (cx + 2048) * 4096 + (cz + 2048);
  }

  wrap(i: number) {
    return ((i % this.N) + this.N) % this.N;
  }

  /** Closest point on the track polyline; window search near `hint` (sample index) or global if hint<0. */
  project(x: number, z: number, hint: number, out: Proj, win = 14): Proj {
    const N = this.N;
    let best = Infinity, bi = 0, bt = 0, bx = 0, bz = 0;
    const count = hint < 0 ? N : win * 2 + 1;
    const start = hint < 0 ? 0 : Math.floor(hint) - win;
    for (let k = 0; k < count; k++) {
      const i = (((start + k) % N) + N) % N;
      const j = i + 1 === N ? 0 : i + 1;
      const ax = this.px[i], az = this.pz[i];
      const dx = this.px[j] - ax, dz = this.pz[j] - az;
      const l2 = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t, cz = az + dz * t;
      const dd = (x - cx) * (x - cx) + (z - cz) * (z - cz);
      if (dd < best) {
        best = dd;
        bi = i;
        bt = t;
        bx = cx;
        bz = cz;
      }
    }
    const j = bi + 1 === N ? 0 : bi + 1;
    let nx = this.nx[bi] + (this.nx[j] - this.nx[bi]) * bt;
    let nz = this.nz[bi] + (this.nz[j] - this.nz[bi]) * bt;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    out.i = bi + bt;
    out.nx = nx;
    out.nz = nz;
    out.tx = -nz;
    out.tz = nx;
    out.d = (x - bx) * nx + (z - bz) * nz;
    out.y = this.py[bi] + (this.py[j] - this.py[bi]) * bt;
    out.slope = this.slope[bi] + (this.slope[j] - this.slope[bi]) * bt;
    out.kappa = this.vcurv[bi] + (this.vcurv[j] - this.vcurv[bi]) * bt;
    return out;
  }

  /** Nearest centerline sample (grid accelerated). Returns dist=Infinity if > ~160m. */
  nearest(x: number, z: number): { idx: number; dist: number } {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = Infinity, bi = -1;
    for (let a = -4; a <= 4; a++)
      for (let b = -4; b <= 4; b++) {
        const arr = this.grid.get(this.key(cx + a, cz + b));
        if (!arr) continue;
        for (const i of arr) {
          const dd = (x - this.px[i]) ** 2 + (z - this.pz[i]) ** 2;
          if (dd < best) {
            best = dd;
            bi = i;
          }
        }
      }
    return { idx: bi, dist: bi < 0 ? Infinity : Math.sqrt(best) };
  }

  /** world position at sample index (float) and lateral offset */
  at(i: number, d = 0, out = new THREE.Vector3()) {
    const N = this.N;
    const a = this.wrap(Math.floor(i));
    const b = (a + 1) % N;
    const t = i - Math.floor(i);
    const x = this.px[a] + (this.px[b] - this.px[a]) * t;
    const y = this.py[a] + (this.py[b] - this.py[a]) * t;
    const z = this.pz[a] + (this.pz[b] - this.pz[a]) * t;
    const nx = this.nx[a] + (this.nx[b] - this.nx[a]) * t;
    const nz = this.nz[a] + (this.nz[b] - this.nz[a]) * t;
    return out.set(x + nx * d, y, z + nz * d);
  }
  heading(i: number) {
    const a = this.wrap(Math.floor(i));
    return Math.atan2(this.tx[a], this.tz[a]);
  }
  zoneAt(i: number) {
    const w = this.wrap(i);
    for (const z of this.zones) {
      if (z.i0 <= z.i1 ? w >= z.i0 && w <= z.i1 : w >= z.i0 || w <= z.i1) return z;
    }
    return null;
  }
}
