import * as THREE from 'three';
import { DungeonDef, DUNGEONS, rng, LORE } from './data';
import { Rig, buildNPC, labelSprite, gCone, gCyl } from './models';
import { glowTex } from './fx';

// ── Grid: collision, camera raycast, line-of-sight and flow-field navigation ──
// cell values: 0 free, 1 wall, 2 soft solid (props), 3 gate, 4 secret wall, 5 pillar
export class Grid {
  w: number; h: number; cs = 2; ox: number; oz: number; c: Uint8Array; haz: Uint8Array; dist: Int16Array; q: Int32Array;
  constructor(w: number, h: number, ox: number, oz: number, fill = 0) { this.w = w; this.h = h; this.ox = ox; this.oz = oz; this.c = new Uint8Array(w * h).fill(fill); this.haz = new Uint8Array(w * h); this.dist = new Int16Array(w * h).fill(-1); this.q = new Int32Array(w * h); }
  ci(x: number) { return Math.floor((x - this.ox) / this.cs); } cj(z: number) { return Math.floor((z - this.oz) / this.cs); }
  wx(i: number) { return this.ox + (i + 0.5) * this.cs; } wz(j: number) { return this.oz + (j + 0.5) * this.cs; }
  get(i: number, j: number) { return i < 0 || j < 0 || i >= this.w || j >= this.h ? 1 : this.c[j * this.w + i]; }
  set(i: number, j: number, v: number) { if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.c[j * this.w + i] = v; }
  solidAt(x: number, z: number) { return this.get(this.ci(x), this.cj(z)) > 0; }
  hazAt(x: number, z: number) { const i = this.ci(x), j = this.cj(z); return i < 0 || j < 0 || i >= this.w || j >= this.h ? 0 : this.haz[j * this.w + i]; }
  blocked(x: number, z: number, r: number) {
    const i0 = this.ci(x - r), i1 = this.ci(x + r), j0 = this.cj(z - r), j1 = this.cj(z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (this.get(i, j) > 0) { const cx = Math.max(this.ox + i * this.cs, Math.min(x, this.ox + (i + 1) * this.cs)); const cz = Math.max(this.oz + j * this.cs, Math.min(z, this.oz + (j + 1) * this.cs)); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return true; }
    }
    return false;
  }
  move(p: { x: number; z: number }, dx: number, dz: number, r: number) { if (!this.blocked(p.x + dx, p.z, r)) p.x += dx; if (!this.blocked(p.x, p.z + dz, r)) p.z += dz; }
  unstick(p: { x: number; z: number }, r: number) {
    if (!this.blocked(p.x, p.z, r)) return;
    for (let k = 1; k < 12; k++) for (let a = 0; a < 8; a++) { const x = p.x + Math.cos(a * 0.785) * k * 0.5, z = p.z + Math.sin(a * 0.785) * k * 0.5; if (!this.blocked(x, z, r)) { p.x = x; p.z = z; return; } }
  }
  ray(ax: number, az: number, bx: number, bz: number, cam: boolean) {
    const len = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(len / 0.25));
    for (let k = 1; k <= n; k++) { const t = k / n; const v = this.get(this.ci(ax + (bx - ax) * t), this.cj(az + (bz - az) * t)); if (cam ? v === 1 || v === 4 || v === 5 : v === 1 || v === 3 || v === 4 || v === 5) return (k - 1) / n; }
    return 1;
  }
  computeFlow(tx: number, tz: number, maxD = 70) {
    this.dist.fill(-1); const i0 = this.ci(tx), j0 = this.cj(tz); if (this.get(i0, j0) > 0) return; const w = this.w; let h = 0, t = 0;
    this.dist[j0 * w + i0] = 0; this.q[t++] = j0 * w + i0;
    while (h < t) {
      const cur = this.q[h++]; const ci = cur % w, cj = (cur / w) | 0; const d = this.dist[cur]; if (d >= maxD) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (this.get(ni, nj) > 0) continue; if (di && dj && (this.get(ci + di, cj) > 0 || this.get(ci, cj + dj) > 0)) continue;
        const idx = nj * w + ni; if (this.dist[idx] >= 0) continue; this.dist[idx] = d + 1; this.q[t++] = idx;
      }
    }
  }
  flowNext(x: number, z: number): [number, number] | null {
    const i = this.ci(x), j = this.cj(z); if (i < 0 || j < 0 || i >= this.w || j >= this.h) return null; const d = this.dist[j * this.w + i]; if (d <= 0) return null;
    let best = d, bi = i, bj = j;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (this.get(ni, nj) > 0) continue; if (di && dj && (this.get(i + di, j) > 0 || this.get(i, j + dj) > 0)) continue;
      const nd = this.dist[nj * this.w + ni]; if (nd >= 0 && nd < best) { best = nd; bi = ni; bj = nj; }
    }
    return best < d ? [this.wx(bi), this.wz(bj)] : null;
  }
}

// ── Types ──
export interface Inter { id: string; kind: string; pos: THREE.Vector3; r: number; prompt: string; data?: any; used?: boolean; obj?: THREE.Object3D }
export interface SpawnDef { id: string; x: number; z: number; lvl: number; room: number; boss?: boolean }
export interface Gate { cells: [number, number][]; mesh: THREE.Mesh }
export interface Room { i: number; kind: string; x0: number; x1: number; z0: number; z1: number; cx: number; cz: number; gates: { entry?: Gate; exit?: Gate }; state: 'idle' | 'active' | 'cleared'; center: THREE.Vector3; runes: number }
export interface Level {
  kind: 'world' | 'dungeon'; def?: DungeonDef; name: string; group: THREE.Group; grid: Grid; spawn: THREE.Vector3; inters: Inter[]; spawns: SpawnDef[]; rooms: Room[]; torches: THREE.Vector3[];
  bg: number; fogNear: number; fogFar: number; ambient: number; sunColor: number; anim: ((t: number, dt: number) => void)[]; ceiling: number; pickups: { kind: string; id: string; n: number; x: number; z: number }[];
  secrets: { i: number; j: number; mesh: THREE.Object3D; found: boolean }[]; hazard: (x: number, z: number, t: number) => string | null; music: 'village' | 'dungeon' | 'boss'; ambience: 'wind' | 'cave';
  discover: { id: string; x: number; z: number; r: number; name: string }[]; bossRoom?: Room; sky?: THREE.Object3D; theme?: DungeonDef['theme'];
}

// ── Textures ──
const TC = new Map<string, THREE.CanvasTexture>();
export function surfTex(base: string, kind: 'brick' | 'noise' | 'grass' | 'dirt' | 'tile', rx = 1, ry = 1): THREE.CanvasTexture {
  const k = `${base}${kind}${rx}${ry}`; const hit = TC.get(k); if (hit) return hit;
  const S = 128; const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!;
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const r = rng(base.length * 97 + kind.length * 13);
  const n = kind === 'grass' ? 1400 : 700;
  for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.04 + r() * 0.12})` : `rgba(255,255,255,${0.02 + r() * 0.07})`; const s = kind === 'grass' ? 1 + r() * 2 : 1 + r() * 5; g.fillRect(r() * S, r() * S, s, kind === 'grass' ? s * 3 : s); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
  if (kind === 'brick') { for (let y = 0; y < S; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); for (let x = (y / 32) % 2 ? 0 : 32; x < S; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } }
  if (kind === 'tile') { for (let y = 0; y < S; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); g.beginPath(); g.moveTo(y, 0); g.lineTo(y, S); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TC.set(k, t); return t;
}
function pbr(color: string, kind: 'brick' | 'noise' | 'grass' | 'dirt' | 'tile', rx = 1, ry = 1, rough = 0.9, em = 0, emI = 0) {
  const t = surfTex(color, kind, rx, ry); const m = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.8, roughness: rough, metalness: 0.05 }); if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = emI; } m.userData.shared = true; return m;
}
const mat = (c: number, em = 0, ei = 1, extra: any = {}) => new THREE.MeshStandardMaterial({ color: c, emissive: em, emissiveIntensity: em ? ei : 0, roughness: 0.8, ...extra });
const emi = (c: number, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op });

export function makeChest(color = 0xb8803a, glow = 0xffd24a): THREE.Group {
  const g = new THREE.Group(); const body = mat(color); const trim = mat(0xd8b04a, glow, 0.4);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), body); b.position.y = 0.35; b.castShadow = true; g.add(b);
  const lidP = new THREE.Group(); lidP.position.set(0, 0.7, -0.4); g.add(lidP); lidP.name = 'lid';
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 10, 1, false, 0, Math.PI), body); lid.rotation.z = Math.PI / 2; lid.rotation.y = 0; lid.position.set(0, 0, 0.4); lid.rotation.order = 'ZYX'; lid.castShadow = true; lidP.add(lid);
  for (const x of [-0.5, 0.5]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.84), trim); t.position.set(x, 0.35, 0); g.add(t); }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), trim); lock.position.set(0, 0.62, 0.42); g.add(lock);
  const glw = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })); glw.scale.set(2.4, 2.4, 1); glw.position.y = 0.9; g.add(glw);
  return g;
}

function skyDome(top: number, mid: number, bot: number) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#' + top.toString(16).padStart(6, '0')); gr.addColorStop(0.55, '#' + mid.toString(16).padStart(6, '0')); gr.addColorStop(1, '#' + bot.toString(16).padStart(6, '0')); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false })); m.renderOrder = -10; return m;
}
const solidRect = (g: Grid, x: number, z: number, w: number, d: number, v: number) => { for (let j = g.cj(z - d / 2); j <= g.cj(z + d / 2 - 0.01); j++) for (let i = g.ci(x - w / 2); i <= g.ci(x + w / 2 - 0.01); i++) g.set(i, j, v); };
const solidCircle = (g: Grid, x: number, z: number, r: number, v: number) => { for (let j = g.cj(z - r); j <= g.cj(z + r); j++) for (let i = g.ci(x - r); i <= g.ci(x + r); i++) if (Math.hypot(g.wx(i) - x, g.wz(j) - z) <= r) g.set(i, j, v); };
const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => { const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };

function house(x: number, z: number, w: number, d: number, wall: number, roof: number, yaw = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, d), mat(wall)); body.position.y = 1.7; body.castShadow = body.receiveShadow = true; g.add(body);
  const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4), mat(roof)); r.position.y = 4.7; r.rotation.y = Math.PI / 4; r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); r.castShadow = true; g.add(r);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.15), mat(0x4a2e1c)); door.position.set(0, 1.05, d / 2 + 0.02); g.add(door);
  for (const s of [-1, 1]) { const wn = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.12), emi(0xffd27a)); wn.position.set(s * w * 0.3, 2.0, d / 2 + 0.02); g.add(wn); }
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2, 0.7), mat(0x6a5a52)); ch.position.set(w * 0.3, 5.0, -d * 0.2); g.add(ch);
  return g;
}

// ── Overworld ──
export const WORLD_HALF = 112;
export function buildWorld(q: number): Level {
  const group = new THREE.Group(); const grid = new Grid(130, 130, -130, -130, 0); const R = rng(777);
  const anim: Level['anim'] = []; const inters: Inter[] = []; const spawns: SpawnDef[] = []; const pickups: Level['pickups'] = []; const discover: Level['discover'] = [];
  for (let j = 0; j < 130; j++) for (let i = 0; i < 130; i++) { const x = grid.wx(i), z = grid.wz(j); if (Math.abs(x) > WORLD_HALF || Math.abs(z) > WORLD_HALF) grid.set(i, j, 1); }
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), pbr('#4f8a3c', 'grass', 120, 120, 1)); ground.receiveShadow = true; group.add(ground);
  const sky = skyDome(0x4a8ad8, 0xa8d4f4, 0xf4ead0);
  // paths
  const village = new THREE.Vector3(0, 0, 0); const paths: [number, number, number, number][] = [];
  const pathMat = pbr('#a58a5c', 'dirt', 2, 6, 1); pathMat.polygonOffset = true; pathMat.polygonOffsetFactor = -1;
  for (const d of DUNGEONS) { const dx = d.wx - village.x, dz = d.wz - village.z; const len = Math.hypot(dx, dz); const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, len).rotateX(-Math.PI / 2), pathMat); m.position.set(dx / 2, 0.03, dz / 2); m.rotation.y = Math.atan2(dx, dz); m.receiveShadow = true; group.add(m); paths.push([0, 0, d.wx, d.wz]); }
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(15, 32).rotateX(-Math.PI / 2), pbr('#8c8a84', 'tile', 8, 8, 0.9)); plaza.position.y = 0.04; plaza.receiveShadow = true; group.add(plaza);
  // fountain
  const fo = new THREE.Group(); const basin = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.9, 20), mat(0x9a9a9e)); basin.position.y = 0.45; fo.add(basin); const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x4ab8ff, emissive: 0x2a88d8, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })); water.position.y = 0.85; fo.add(water);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 2.6, 8), mat(0xb0b0b8)); sp.position.y = 1.8; fo.add(sp); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), emi(0x9ae0ff)); orb.position.y = 3.3; fo.add(orb); group.add(fo); solidCircle(grid, 0, 0, 3.3, 2);
  anim.push((t) => { orb.position.y = 3.3 + Math.sin(t * 2) * 0.1; (water.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.15; });
  // houses
  const H: [number, number, number, number, number, number, number][] = [[-15, -14, 8, 6.5, 0xd8c8a8, 0x9a3a32, 0], [17, -14, 9, 7, 0xb8a890, 0x5a4a6a, 0], [-19, 10, 8, 7, 0xd0b898, 0x3a6a8a, Math.PI / 2], [26, 6, 7, 6, 0xc8b8a0, 0x7a5a32, -Math.PI / 2]];
  for (const h of H) { group.add(house(h[0], h[1], h[2], h[3], h[4], h[5], h[6])); const sw = h[6] ? h[3] : h[2], sd = h[6] ? h[2] : h[3]; solidRect(grid, h[0], h[1], sw, sd, 1); }
  // forge, anvil
  const forge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.2), mat(0x3a3a40, 0xff5a10, 0.9)); forge.position.set(11, 0.5, -8); group.add(forge); const anvil = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.5), mat(0x55555e)); anvil.position.set(14, 0.4, -8); group.add(anvil); solidRect(grid, 11, -8, 1.6, 1.2, 2); solidRect(grid, 14, -8, 1, 0.6, 2);
  anim.push((t) => { (forge.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(t * 9) * 0.25; });
  // merchant stall
  const stall = new THREE.Group(); stall.position.set(14, 0, 8); const tb = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 1.4), mat(0x7a5232)); tb.position.y = 0.5; stall.add(tb); const aw = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 2.4), mat(0xc83a4a)); aw.position.set(0, 3, -0.2); aw.rotation.x = 0.15; stall.add(aw); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), mat(0x5a3a22)); p.position.set(s * 1.9, 1.5, 0.8); stall.add(p); } group.add(stall); solidRect(grid, 14, 8, 3.4, 1.4, 2);
  // quest board
  const board = new THREE.Group(); board.position.set(5, 0, -8); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), mat(0x5a3a22)); p.position.set(s * 1.1, 1.5, 0); board.add(p); } const bd = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.12), mat(0x8a6a42)); bd.position.y = 2; board.add(bd); for (let i = 0; i < 4; i++) { const pp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.02), emi(0xf0e6c8)); pp.position.set(-0.9 + i * 0.6, 2 + (i % 2) * 0.2 - 0.1, 0.08); board.add(pp); } group.add(board); solidRect(grid, 5, -8, 2.4, 0.6, 2);
  inters.push({ id: 'board', kind: 'board', pos: new THREE.Vector3(5, 0, -6.4), r: 3, prompt: 'Read Quest Board' });
  // lamp posts
  const lampPos: [number, number][] = [[-8, -6], [8, 6], [-8, 8], [9, -8], [0, 14], [0, -17]];
  for (const [lx, lz] of lampPos) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 6), mat(0x2a2a30)); p.position.set(lx, 1.7, lz); group.add(p); const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), emi(0xffd27a)); l.position.set(lx, 3.5, lz); group.add(l); }
  // training yard
  const yard = new THREE.Mesh(new THREE.CircleGeometry(10, 24).rotateX(-Math.PI / 2), pbr('#b09a6a', 'dirt', 4, 4, 1)); yard.position.set(-34, 0.04, 14); group.add(yard);
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 5), mat(0x6a4a2a)); p.position.set(-34 + Math.cos(a) * 10, 0.7, 14 + Math.sin(a) * 10); group.add(p); if (i % 5 !== 0 || true) solidCircle(grid, p.position.x, p.position.z, 0.3, 2); }
  // clear the yard entrance
  for (const [dx, dz] of [[10, 0], [9.6, 1.5], [9.6, -1.5]]) solidCircle(grid, -34 + dx, 14 + dz, 0.8, 0);
  for (let i = 0; i < 4; i++) spawns.push({ id: 'dummy', x: -34 + Math.cos(i * 1.6) * 4.5, z: 14 + Math.sin(i * 1.6) * 4.5, lvl: 1, room: -1 });
  // NPCs
  const rigs: Rig[] = [];
  const NPCS: { id: string; name: string; x: number; z: number; yaw: number; cloth: number; hair: number; kind: string; prompt: string }[] = [
    { id: 'elder', name: 'Elder Maren', x: -12, z: -7.5, yaw: 0.4, cloth: 0x6a4a9a, hair: 0xe8e8f0, kind: 'dialogue', prompt: 'Talk to Elder Maren' },
    { id: 'smith', name: 'Torvald the Smith', x: 14, z: -6, yaw: -0.5, cloth: 0x5a3a2a, hair: 0x3a2a1a, kind: 'smith', prompt: 'Speak to Blacksmith' },
    { id: 'merchant', name: 'Lyra the Merchant', x: 14, z: 5.5, yaw: Math.PI, cloth: 0xc84a6a, hair: 0xd8a84a, kind: 'shop', prompt: 'Browse Wares' },
    { id: 'trainer', name: 'Kael, Trainer', x: -26, z: 14, yaw: Math.PI / 2 + 0.2, cloth: 0x3a7a5a, hair: 0x7a3a2a, kind: 'trainer', prompt: 'Talk to Kael' },
  ];
  for (const n of NPCS) {
    const rig = buildNPC(n.cloth, n.hair); rig.root.position.set(n.x, 0, n.z); rig.root.rotation.y = n.yaw; group.add(rig.root); rigs.push(rig);
    const lab = labelSprite(n.name, '#ffe9a0'); lab.position.set(n.x, 2.5, n.z); group.add(lab);
    solidCircle(grid, n.x, n.z, 0.6, 2);
    inters.push({ id: n.id, kind: n.kind, pos: new THREE.Vector3(n.x, 0, n.z), r: 3, prompt: n.prompt, data: n });
  }
  anim.push((_t, dt) => { for (const r of rigs) r.update(dt, { state: 'idle', speed: 0 }); });
  // portals
  for (const d of DUNGEONS) {
    const g = new THREE.Group(); g.position.set(d.wx, 0, d.wz); g.rotation.y = Math.atan2(-d.wx, -d.wz);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6, 0.9), mat(0x5a5a68, d.color, 0.3)); p.position.set(s * 3, 3, 0); p.castShadow = true; g.add(p); }
    const lin = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.9, 1), mat(0x4a4a58, d.color, 0.4)); lin.position.y = 6.2; g.add(lin);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.9, 28), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })); disc.position.y = 3; g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 8, 28), new THREE.MeshBasicMaterial({ color: d.color })); ring.position.y = 3; g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 30; g.add(beam);
    const lab = labelSprite(`${d.name}  (Lv ${d.level})`, '#' + d.color.toString(16).padStart(6, '0')); lab.position.set(0, 8.2, 0); lab.scale.set(5.5, 1.4, 1); g.add(lab);
    group.add(g); solidRect(grid, d.wx + Math.cos(g.rotation.y) * 3, d.wz - Math.sin(g.rotation.y) * 3, 1, 1, 2); solidRect(grid, d.wx - Math.cos(g.rotation.y) * 3, d.wz + Math.sin(g.rotation.y) * 3, 1, 1, 2);
    anim.push((t) => { ring.rotation.z = t * 0.8; disc.scale.setScalar(1 + Math.sin(t * 3 + d.seed) * 0.04); (disc.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 2 + d.seed) * 0.12; });
    const front = new THREE.Vector3(d.wx + Math.sin(g.rotation.y) * 2.2, 0, d.wz + Math.cos(g.rotation.y) * 2.2);
    inters.push({ id: d.id, kind: 'portal', pos: front, r: 3.4, prompt: `Enter ${d.name} (Lv ${d.level})`, data: d });
  }
  // lake
  const lake = new THREE.Mesh(new THREE.CircleGeometry(8, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a8ad0, emissive: 0x1a5a9a, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.2 })); lake.position.set(30, 0.06, -42); group.add(lake); solidCircle(grid, 30, -42, 7.4, 2);
  // special sites (secrets)
  const sites: { id: string; name: string; x: number; z: number }[] = [{ id: 'ruins', name: 'Ruins of Aurelith', x: -80, z: 22 }, { id: 'cave', name: 'Hidden Cave', x: 96, z: -86 }, { id: 'stones', name: 'Circle of Standing Stones', x: 48, z: 30 }];
  const stoneM = mat(0x7a7a80);
  { // ruins
    const [cx, cz] = [-80, 22];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const h = 2 + R() * 4; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, h, 8), stoneM); p.position.set(cx + Math.cos(a) * 6, h / 2, cz + Math.sin(a) * 6); p.rotation.z = (R() - 0.5) * 0.2; p.castShadow = true; group.add(p); solidCircle(grid, p.position.x, p.position.z, 0.8, 2); }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.5, 6, 14, Math.PI), stoneM); arch.position.set(cx, 0.1, cz - 6); group.add(arch);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 0.4), mat(0x8a8a90, 0x7ad8ff, 0.4)); tab.position.set(cx, 1, cz); group.add(tab); solidRect(grid, cx, cz, 1.4, 0.6, 2);
    inters.push({ id: 'lore_ruins', kind: 'lore', pos: new THREE.Vector3(cx, 0, cz + 1.6), r: 3, prompt: 'Read the glowing tablet', data: LORE[0] });
    inters.push({ id: 'wc_ruins', kind: 'chest', pos: new THREE.Vector3(cx + 3, 0, cz + 3), r: 2.6, prompt: 'Open Chest', data: { boost: 1.5 } });
  }
  { // cave
    const [cx, cz] = [96, -86]; const m = new THREE.Mesh(new THREE.SphereGeometry(8, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x66625c)); m.position.set(cx, 0, cz); m.scale.y = 0.7; m.castShadow = true; group.add(m); solidCircle(grid, cx, cz, 7.5, 1);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2.2, 14), emi(0x050408)); hole.position.set(cx - 7.4, 2, cz + 1.5); hole.rotation.y = -Math.PI / 2 + 0.3; group.add(hole);
    for (const [dx, dz] of [[-9, 1], [-8, 2.5], [-10, 3]]) solidCircle(grid, cx + dx, cz + dz, 1, 0);
    inters.push({ id: 'wc_cave', kind: 'chest', pos: new THREE.Vector3(cx - 11, 0, cz + 3), r: 2.6, prompt: 'Open Hidden Chest', data: { boost: 2.5, boss: true } });
    const cg = makeChest(0x7a3a8a, 0xc084fc); cg.position.set(cx - 11, 0, cz + 3); group.add(cg); inters[inters.length - 1].obj = cg;
  }
  { // standing stones
    const [cx, cz] = [48, 30]; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4 + (i % 3), 0.8), stoneM); p.position.set(cx + Math.cos(a) * 5, 2 + (i % 3) / 2, cz + Math.sin(a) * 5); p.rotation.y = -a; p.castShadow = true; group.add(p); solidCircle(grid, p.position.x, p.position.z, 0.9, 2); }
    const crys = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), emi(0x9a7aff)); crys.position.set(cx, 1.8, cz); group.add(crys); anim.push((t) => { crys.rotation.y = t; crys.position.y = 1.8 + Math.sin(t * 2) * 0.2; });
    inters.push({ id: 'lore_stones', kind: 'lore', pos: new THREE.Vector3(cx, 0, cz), r: 3.4, prompt: 'Touch the crystal', data: LORE[1] });
  }
  for (const s of sites) discover.push({ id: s.id, x: s.x, z: s.z, r: 9, name: s.name });
  inters.push({ id: 'lore_village', kind: 'lore', pos: new THREE.Vector3(0, 0, 4.8), r: 2.6, prompt: 'Read the plaque', data: LORE[2] });
  // treasure chests
  const CH: [string, number, number][] = [['wc1', -30, -62], ['wc2', 32, -26], ['wc3', -92, -34], ['wc4', 62, 92], ['wc5', 100, 14], ['wc6', -52, 100]];
  for (const [id, x, z] of CH) { const c = makeChest(); c.position.set(x, 0, z); c.rotation.y = R() * 6; group.add(c); solidCircle(grid, x, z, 0.8, 2); inters.push({ id, kind: 'chest', pos: new THREE.Vector3(x, 0, z), r: 2.6, prompt: 'Open Treasure Chest', data: { boost: 1 }, obj: c }); }
  for (const it of inters) if (it.id === 'wc_ruins') { const c = makeChest(); c.position.copy(it.pos); group.add(c); it.obj = c; }
  // enemy camps
  const camps: [string, number, number, number][] = [['goblin', -40, 40, 5], ['goblin_archer', -38, 44, 2], ['goblin', -22, -52, 4], ['goblin_archer', -20, -48, 2], ['forest_wolf', 52, -14, 3], ['poison_slime', 20, 44, 4], ['ogre', -72, -58, 1], ['ogre', 92, 4, 2], ['forest_wolf', -60, 70, 3], ['poison_slime', 76, 74, 3], ['goblin', 40, 70, 4]];
  for (const [id, cx, cz, n] of camps) {
    const lvl = Math.max(1, Math.round(Math.hypot(cx, cz) / 17));
    for (let i = 0; i < n; i++) spawns.push({ id, x: cx + (R() - 0.5) * 9, z: cz + (R() - 0.5) * 9, lvl: lvl + (id === 'ogre' ? 2 : 0), room: -1 });
    if (id === 'goblin') { const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 6), emi(0xff7a1a)); fire.position.set(cx, 0.6, cz); group.add(fire); anim.push((t) => { fire.scale.y = 1 + Math.sin(t * 12 + cx) * 0.2; }); for (let i = 0; i < 6; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 5), mat(0x4a3220)); lg.position.set(cx + Math.cos(i) * 0.9, 0.1, cz + Math.sin(i) * 0.9); lg.rotation.z = Math.PI / 2; lg.rotation.y = i; group.add(lg); } }
  }
  const blockedSpots: [number, number, number][] = [[0, 0, 27], ...DUNGEONS.map((d) => [d.wx, d.wz, 10] as [number, number, number]), ...sites.map((s) => [s.x, s.z, 11] as [number, number, number]), ...camps.map((c) => [c[1], c[2], 7] as [number, number, number]), [-34, 14, 13], [30, -42, 11], ...CH.map((c) => [c[1], c[2], 4] as [number, number, number])];
  // trees (instanced)
  const nT = [260, 480, 720][q]; const tm: THREE.Matrix4[] = []; const tc: number[] = []; const tr = new THREE.Matrix4();
  const ok = (x: number, z: number, extra = 0) => { for (const b of blockedSpots) if (Math.hypot(x - b[0], z - b[1]) < b[2] + extra) return false; for (const p of paths) if (segDist(x, z, p[0], p[1], p[2], p[3]) < 4.5 + extra) return false; return !grid.solidAt(x, z); };
  let tries = 0; while (tm.length < nT && tries++ < nT * 8) { const x = (R() * 2 - 1) * 108, z = (R() * 2 - 1) * 108; if (!ok(x, z, 0.5)) continue; const s = 0.8 + R() * 1.1; tm.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), new THREE.Vector3(s, s * (0.9 + R() * 0.4), s))); tc.push(R()); grid.set(grid.ci(x), grid.cj(z), 2); }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 3, 6), mat(0x5a3a22), tm.length); const fol1 = new THREE.InstancedMesh(new THREE.ConeGeometry(2, 4, 7), mat(0x2f7a3a), tm.length); const fol2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 3.4, 7), mat(0x3a8a44), tm.length);
  tm.forEach((m, i) => { trunk.setMatrixAt(i, m.clone().multiply(tr.makeTranslation(0, 1.5, 0))); fol1.setMatrixAt(i, m.clone().multiply(tr.makeTranslation(0, 4, 0))); fol2.setMatrixAt(i, m.clone().multiply(tr.makeTranslation(0, 6, 0))); const c = new THREE.Color().setHSL(0.27 + tc[i] * 0.08, 0.5, 0.26 + tc[i] * 0.12); fol1.setColorAt(i, c); fol2.setColorAt(i, c.clone().offsetHSL(0, 0, 0.05)); });
  trunk.castShadow = q > 0; fol1.castShadow = q > 0; group.add(trunk, fol1, fol2);
  // rocks
  const rm: THREE.Matrix4[] = []; tries = 0; while (rm.length < 90 && tries++ < 900) { const x = (R() * 2 - 1) * 108, z = (R() * 2 - 1) * 108; if (!ok(x, z, 0.5)) continue; const s = 0.6 + R() * 1.6; rm.push(new THREE.Matrix4().compose(new THREE.Vector3(x, s * 0.4, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(), R() * 6, R())), new THREE.Vector3(s, s * 0.7, s))); if (s > 1.1) grid.set(grid.ci(x), grid.cj(z), 2); }
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(0x7a7a7e), rm.length); rm.forEach((m, i) => rocks.setMatrixAt(i, m)); rocks.castShadow = q > 0; group.add(rocks);
  // mountains ring
  const mm: THREE.Matrix4[] = []; for (let k = 0; k < 90; k++) { const t = k / 90; const side = Math.floor(t * 4); const u = (t * 4 - side) * 2 - 1; const off = 122 + R() * 24; const x = side === 0 ? u * 140 : side === 1 ? off : side === 2 ? -u * 140 : -off; const z = side === 0 ? -off : side === 1 ? u * 140 : side === 2 ? off : -u * 140; const s = 14 + R() * 18; mm.push(new THREE.Matrix4().compose(new THREE.Vector3(x, s * 0.9, z), new THREE.Quaternion(), new THREE.Vector3(s * 0.9, s * 1.8, s * 0.9))); }
  const mt = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mat(0x6a6a74, 0, 1, { flatShading: true }), mm.length); mm.forEach((m, i) => mt.setMatrixAt(i, m)); group.add(mt);
  const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(0.4, 0.4, 7), mat(0xf4f8ff, 0, 1, { flatShading: true }), mm.length); mm.forEach((m, i) => { const p = new THREE.Vector3(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(); m.decompose(p, qt, sc); caps.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y + sc.y * 0.3, p.z), qt, new THREE.Vector3(sc.x * 0.99, sc.y * 0.99, sc.z * 0.99))); }); group.add(caps);
  // herbs & ore
  for (let i = 0; i < 26; i++) { let x = 0, z = 0, n = 0; do { x = (R() * 2 - 1) * 104; z = (R() * 2 - 1) * 104; } while ((!ok(x, z, -2) || grid.solidAt(x, z) || Math.hypot(x, z) < 22) && n++ < 40); pickups.push({ kind: 'herb', id: 'herb', n: 1, x, z }); }
  for (let i = 0; i < 10; i++) { let x = 0, z = 0, n = 0; do { x = (R() * 2 - 1) * 104; z = (R() * 2 - 1) * 104; } while ((!ok(x, z, -2) || grid.solidAt(x, z) || Math.hypot(x, z) < 22) && n++ < 40); pickups.push({ kind: 'ore', id: 'iron_ore', n: 1 + Math.floor(R() * 2), x, z }); }
  return { kind: 'world', name: 'Aurelith', group, grid, spawn: new THREE.Vector3(0, 0, 11), inters, spawns, rooms: [], torches: [], bg: 0xa8d4f4, fogNear: 60, fogFar: 230, ambient: 1, sunColor: 0xfff0d8, anim, ceiling: 999, pickups, secrets: [], hazard: () => null, music: 'village', ambience: 'wind', discover, sky };
}

// ── Dungeons ──
export function buildDungeon(def: DungeonDef, q: number): Level {
  const R = rng(def.seed); const th = def.theme; const group = new THREE.Group(); const anim: Level['anim'] = [];
  const kinds = ['start', 'combat', 'combat', 'puzzle', 'elite', 'combat', 'rest', 'boss'];
  const W = 64; const plan: { kind: string; cx: number; x0: number; x1: number; z0: number; z1: number; w: number; d: number }[] = [];
  let z = 4; let pcx = 32;
  kinds.forEach((kind, i) => {
    const boss = kind === 'boss'; const w = boss ? 27 : kind === 'start' ? 13 : 15 + Math.floor(R() * 3) * 2; const d = boss ? 27 : kind === 'start' ? 11 : 13 + Math.floor(R() * 3) * 2;
    const cx = boss || i === 0 ? 32 : Math.max(27, Math.min(37, pcx + Math.round((R() - 0.5) * 8)));
    const x0 = cx - (w >> 1); plan.push({ kind, cx, x0, x1: x0 + w - 1, z0: z, z1: z + d - 1, w, d }); z += d + 6; pcx = cx;
  });
  const H = z + 4; const grid = new Grid(W, H, 0, 0, 1);
  const rooms: Room[] = []; const spawns: SpawnDef[] = []; const inters: Inter[] = []; const pickups: Level['pickups'] = []; const torches: THREE.Vector3[] = []; const secrets: Level['secrets'] = [];
  const gateMat = new THREE.MeshBasicMaterial({ color: th.accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const mkGate = (xc: number, j: number): Gate => { const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), gateMat); m.position.set((xc + 0.5) * 2, 4, (j + 0.5) * 2); m.visible = false; group.add(m); return { cells: [[xc - 1, j], [xc, j], [xc + 1, j]], mesh: m }; };
  plan.forEach((p, i) => {
    const boss = p.kind === 'boss'; const cz = boss ? p.z0 + 13 : (p.z0 + p.z1) >> 1;
    for (let j = p.z0; j <= p.z1; j++) for (let ii = p.x0; ii <= p.x1; ii++) { if (boss && Math.hypot(ii - p.cx, j - cz) > 13.2) continue; grid.set(ii, j, 0); }
    rooms.push({ i, kind: p.kind, x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, cx: p.cx, cz, gates: {}, state: 'idle', center: new THREE.Vector3((p.cx + 0.5) * 2, 0, (cz + 0.5) * 2), runes: 0 });
  });
  const corr: number[] = [];
  for (let i = 0; i < plan.length - 1; i++) {
    const a = plan[i], b = plan[i + 1]; const xc = Math.round((a.cx + b.cx) / 2); corr.push(xc);
    for (let j = a.z1 + 1; j <= b.z0 + 3; j++) for (let ii = xc - 1; ii <= xc + 1; ii++) grid.set(ii, j, 0);
    rooms[i].gates.exit = mkGate(xc, a.z1 + 1); rooms[i + 1].gates.entry = mkGate(xc, b.z0 - 1);
    if (th.haz === 'spikes' && (i === 1 || i === 4)) for (let j = a.z1 + 2; j <= a.z1 + 4; j++) for (let ii = xc - 1; ii <= xc + 1; ii++) grid.haz[j * W + ii] = 2;
  }
  // lava channels
  if (th.haz === 'lava') for (const i of [1, 5]) { const r = rooms[i]; const mid = (r.z0 + r.z1) >> 1; for (let j = mid - 1; j <= mid + 1; j++) for (let ii = r.x0 + 1; ii <= r.x1 - 1; ii++) if (Math.abs(ii - r.cx) > 1) grid.haz[j * W + ii] = 1; }
  // pillars
  const setPillar = (i: number, j: number) => { if (grid.get(i, j) === 0 && !grid.haz[j * W + i]) grid.set(i, j, 5); };
  rooms.forEach((r, i) => {
    if (r.kind === 'boss') { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.4; setPillar(Math.round(r.cx + Math.cos(a) * 9), Math.round(r.cz + Math.sin(a) * 9)); } return; }
    if (r.kind === 'start') return; setPillar(r.x0 + 3, r.z0 + 3); setPillar(r.x1 - 3, r.z0 + 3); setPillar(r.x0 + 3, r.z1 - 3); setPillar(r.x1 - 3, r.z1 - 3);
    if (r.kind === 'elite' || r.kind === 'puzzle') { setPillar(r.cx - 3, r.cz); setPillar(r.cx + 3, r.cz); }
    void i;
  });
  // secret alcove in room 2
  { const r = rooms[2]; const side = R() < 0.5 ? -1 : 1; const mid = r.cz; const wallI = side > 0 ? r.x1 + 1 : r.x0 - 1;
    for (let k = 2; k <= 3; k++) grid.set(wallI + side * (k - 1), mid, 0);
    const a0 = side > 0 ? r.x1 + 4 : r.x0 - 10; for (let j = mid - 3; j <= mid + 3; j++) for (let ii = a0; ii < a0 + 7; ii++) grid.set(ii, j, 0);
    grid.set(wallI, mid, 4);
    const sm = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(th.wall).offsetHSL(0, 0, 0.04), emissive: th.accent, emissiveIntensity: 0.25, roughness: 0.9 })); sm.position.set((wallI + 0.5) * 2, 4, (mid + 0.5) * 2); group.add(sm); secrets.push({ i: wallI, j: mid, mesh: sm, found: false });
    const ax = (a0 + 3.5) * 2, az = (mid + 0.5) * 2; const c = makeChest(0x7a3a8a, 0xc084fc); c.position.set(ax, 0, az); group.add(c); inters.push({ id: 'chest_secret', kind: 'chest', pos: new THREE.Vector3(ax, 0, az), r: 2.6, prompt: 'Open Secret Chest', data: { boost: 2.5, boss: true }, obj: c });
    pickups.push({ kind: 'ore', id: def.mat, n: 2, x: ax + 3, z: az + 2 }, { kind: 'ore', id: 'iron_ore', n: 2, x: ax - 3, z: az - 2 });
  }
  const freeCell = (r: Room, margin: number, minJ = 0): [number, number] => { for (let t = 0; t < 60; t++) { let ii: number, j: number; if (r.kind === 'boss') { const a = R() * 6.28, d = R() * (13 - margin - 2); ii = Math.round(r.cx + Math.cos(a) * d); j = Math.round(r.cz + Math.sin(a) * d); } else { ii = r.x0 + margin + Math.floor(R() * (r.x1 - r.x0 + 1 - margin * 2)); j = r.z0 + Math.max(margin, minJ) + Math.floor(R() * (r.z1 - r.z0 + 1 - margin - Math.max(margin, minJ))); } if (grid.get(ii, j) === 0 && !grid.haz[j * W + ii]) return [ii, j]; } return [r.cx, r.cz]; };
  const lvlOf = (i: number) => def.level + Math.floor(i / 2);
  rooms.forEach((r, i) => {
    const mk = (id: string, minJ = 5) => { const [ci, cj] = freeCell(r, 2, minJ); spawns.push({ id, x: grid.wx(ci), z: grid.wz(cj), lvl: lvlOf(i), room: i }); };
    if (r.kind === 'combat') { const n = 3 + Math.floor(i / 2) + (q > 1 ? 1 : 0); for (let k = 0; k < n; k++) mk(def.pool[Math.floor(R() * def.pool.length)]); }
    if (r.kind === 'elite') { mk(def.elite, 6); for (let k = 0; k < 3; k++) mk(def.pool[Math.floor(R() * def.pool.length)], 5); }
    if (r.kind === 'boss') spawns.push({ id: def.boss, x: grid.wx(r.cx), z: grid.wz(r.cz + 4), lvl: def.level + 4, room: i, boss: true });
    // chests & loot
    if (r.kind !== 'start' && r.kind !== 'boss') { const [ci, cj] = freeCell(r, 2, 0); const c = makeChest(); const x = grid.wx(ci), zz = grid.wz(cj); c.position.set(x, 0, zz); c.rotation.y = R() * 6; group.add(c); grid.set(ci, cj, 2); inters.push({ id: `chest_${i}`, kind: 'chest', pos: new THREE.Vector3(x, 0, zz), r: 2.6, prompt: 'Open Chest', data: { boost: r.kind === 'rest' ? 2 : 0.8 }, obj: c }); }
    if (r.kind !== 'start') for (let k = 0; k < 2; k++) { const [ci, cj] = freeCell(r, 2, 0); pickups.push({ kind: 'ore', id: R() < 0.5 ? def.mat : 'iron_ore', n: 1, x: grid.wx(ci), z: grid.wz(cj) }); }
    if (r.kind === 'puzzle') { for (let k = 0; k < 3; k++) { const rx = r.cx + (k - 1) * 5; const rz = r.z1 - 2; const ped = new THREE.Group(); ped.position.set(grid.wx(rx), 0, grid.wz(rz)); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.2, 8), mat(0x4a4a56)); base.position.y = 0.6; ped.add(base); const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), emi(0x444455)); orb.position.y = 1.7; ped.add(orb); ped.userData.orb = orb; group.add(ped); grid.set(rx, rz, 2); inters.push({ id: `rune${k}`, kind: 'rune', pos: new THREE.Vector3(grid.wx(rx), 0, grid.wz(rz) - 1.4), r: 2.8, prompt: 'Activate Rune', obj: ped }); anim.push((t) => { orb.rotation.y = t * 1.5; orb.position.y = 1.7 + Math.sin(t * 2 + k) * 0.1; }); } }
    if (r.kind === 'rest') { const sh = new THREE.Group(); sh.position.set(r.center.x, 0, r.center.z); const b = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 8), mat(0x5a5a68)); b.position.y = 0.4; sh.add(b); const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6), emi(0x7affc0)); o.position.y = 1.8; sh.add(o); group.add(sh); grid.set(r.cx, r.cz, 2); inters.push({ id: 'shrine', kind: 'shrine', pos: new THREE.Vector3(r.center.x, 0, r.center.z + 1.8), r: 3, prompt: 'Pray at the Shrine (restore HP & Energy)', obj: sh }); anim.push((t) => { o.rotation.y = t; o.rotation.x = t * 0.7; o.position.y = 1.8 + Math.sin(t * 2) * 0.15; }); }
  });
  inters.push({ id: 'return', kind: 'return', pos: new THREE.Vector3(rooms[0].center.x, 0, rooms[0].center.z - 6), r: 3, prompt: 'Leave Dungeon' });
  // ── geometry ──
  let floors = 0, walls = 0, pills = 0, lava = 0;
  const near = (i: number, j: number) => { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (grid.get(i + di, j + dj) !== 1 && grid.get(i + di, j + dj) !== 4 && i + di >= 0 && j + dj >= 0 && i + di < W && j + dj < H) return true; return false; };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const v = grid.c[j * W + i]; if (v === 1) { if (near(i, j)) walls++; } else if (v === 5) { pills++; floors++; } else if (v !== 4) { if (grid.haz[j * W + i] === 1) lava++; else floors++; } }
  const fl = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), pbr(th.floor, 'tile', 1, 1, 0.85), Math.max(1, floors)); fl.receiveShadow = true;
  const wl = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 8.2, 2), pbr(th.wall, 'brick', 1, 4, 0.95), Math.max(1, walls)); wl.receiveShadow = true;
  const pl = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.05, 8.2, 10), pbr(th.wall, 'noise', 1, 3, 0.8), Math.max(1, pills)); pl.castShadow = q > 0; pl.receiveShadow = true;
  const lv = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff5a10, emissive: 0xff4a08, emissiveIntensity: 1.3, roughness: 0.5 }), Math.max(1, lava));
  const m4 = new THREE.Matrix4(); const col = new THREE.Color(); let fi = 0, wi = 0, pi = 0, li = 0; const spikeCells: [number, number][] = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const v = grid.c[j * W + i]; const x = (i + 0.5) * 2, zz = (j + 0.5) * 2;
    if (v === 1) { if (near(i, j)) { m4.makeTranslation(x, 4.1, zz); wl.setMatrixAt(wi, m4); col.setScalar(0.8 + R() * 0.4); wl.setColorAt(wi++, col); } }
    else if (v === 4) continue;
    else { if (v === 5) { m4.makeTranslation(x, 4.1, zz); pl.setMatrixAt(pi++, m4); } if (grid.haz[j * W + i] === 1) { m4.makeTranslation(x, 0.02, zz); lv.setMatrixAt(li++, m4); } else { m4.makeTranslation(x, 0, zz); fl.setMatrixAt(fi, m4); col.setScalar(0.85 + R() * 0.3); fl.setColorAt(fi++, col); } if (grid.haz[j * W + i] === 2) spikeCells.push([x, zz]); }
  }
  fl.count = fi; wl.count = wi; pl.count = pi; lv.count = li; group.add(fl, wl, pl, lv);
  if (li) anim.push((t) => { (lv.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(t * 2.2) * 0.3; });
  // spikes
  let spikes: THREE.InstancedMesh | null = null;
  if (spikeCells.length) { spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 1.4, 5), mat(0xc8c8d8, 0x8a4aff, 0.3), spikeCells.length * 4); group.add(spikes); const d = new THREE.Object3D(); anim.push((t) => { const ph = t % 3; const hgt = ph < 1.2 ? 1 : ph > 2.4 ? ((ph - 2.4) / 0.6) * 0.3 : 0.01; let n = 0; for (const [sx, sz] of spikeCells) for (let k = 0; k < 4; k++) { d.position.set(sx + (k % 2 ? 0.45 : -0.45), 0.7 * hgt - 0.05, sz + (k < 2 ? 0.45 : -0.45)); d.scale.set(1, hgt, 1); d.updateMatrix(); spikes!.setMatrixAt(n++, d.matrix); } spikes!.instanceMatrix.needsUpdate = true; }); }
  // ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, H * 2).rotateX(Math.PI / 2), pbr(th.wall, 'noise', 30, 60, 1)); ceil.position.set(W, 8.2, H); group.add(ceil);
  // torches (instanced flames)
  const tpos: [number, number, number, number][] = [];
  rooms.forEach((r) => { if (r.kind === 'boss') { for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.28; tpos.push([r.cx + Math.cos(a) * 12.4, r.cz + Math.sin(a) * 12.4, -Math.cos(a), -Math.sin(a)]); } return; } for (let ii = r.x0 + 2; ii < r.x1; ii += 5) { tpos.push([ii, r.z1, 0, 1]); } for (let j = r.z0 + 3; j < r.z1; j += 6) { tpos.push([r.x0, j, -1, 0]); tpos.push([r.x1, j, 1, 0]); } });
  const fm = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.7, 6), new THREE.MeshBasicMaterial({ color: th.torch }), tpos.length); const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), mat(0x2a2220), tpos.length);
  tpos.forEach((t, i) => { const x = grid.wx(t[0]) + t[2] * 0.7, zz = grid.wz(t[1]) + t[3] * 0.7; m4.makeTranslation(x, 2.7, zz); fm.setMatrixAt(i, m4); m4.makeTranslation(x, 2.0, zz); bm.setMatrixAt(i, m4); torches.push(new THREE.Vector3(x - t[2] * 0.4, 3, zz - t[3] * 0.4)); });
  group.add(fm, bm); anim.push((t) => { (fm.material as THREE.MeshBasicMaterial).color.setHex(th.torch).multiplyScalar(0.85 + Math.sin(t * 17) * 0.1 + Math.sin(t * 7.3) * 0.1); });
  // decor
  const decorN = [18, 32, 48][q]; const dm = new THREE.Matrix4(); let dgeo: THREE.BufferGeometry, dmat: THREE.Material, dy = 0.4, soft = true;
  switch (th.decor) { case 'sarcophagus': dgeo = new THREE.BoxGeometry(1.4, 0.9, 2.6); dmat = mat(0x6a6660); dy = 0.45; break; case 'spike': dgeo = new THREE.ConeGeometry(0.7, 3, 6); dmat = mat(0x2a1a16, 0xff4a08, 0.6); dy = 1.5; break; case 'ice': dgeo = new THREE.OctahedronGeometry(1, 0).scale(0.7, 1.8, 0.7); dmat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x3a9aff, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.1 }); dy = 1.6; break; case 'rune': dgeo = new THREE.OctahedronGeometry(0.5); dmat = mat(0x6a3aff, 0x8a4aff, 1.5); dy = 1.6; soft = false; break; case 'bones': dgeo = new THREE.TorusGeometry(1.4, 0.18, 6, 12, Math.PI); dmat = mat(0xd8d0b0); dy = 0; break; default: dgeo = new THREE.ConeGeometry(0.8, 5, 5); dmat = mat(0x1a1020, 0xff2d6f, 0.35); dy = 2.5; }
  const dec = new THREE.InstancedMesh(dgeo, dmat, decorN); let dn = 0;
  for (let t2 = 0; t2 < decorN * 4 && dn < decorN; t2++) { const r = rooms[1 + Math.floor(R() * (rooms.length - 1))]; const [ci, cj] = freeCell(r, 1, 0); if (r.kind === 'puzzle' || (grid.get(ci, cj) !== 0)) continue; const x = grid.wx(ci) + (R() - 0.5), zz = grid.wz(cj) + (R() - 0.5); dm.compose(new THREE.Vector3(x, dy, zz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), new THREE.Vector3(1, 0.8 + R() * 0.5, 1)); dec.setMatrixAt(dn++, dm); if (soft) grid.set(ci, cj, 2); }
  dec.count = dn; group.add(dec); if (th.decor === 'rune') anim.push((t) => { dec.rotation.y = 0; void t; });
  const start = rooms[0];
  return { kind: 'dungeon', def, name: def.name, group, grid, spawn: new THREE.Vector3(start.center.x, 0, start.center.z - 2), inters, spawns, rooms, torches, bg: th.fog, fogNear: 12, fogFar: 62, ambient: th.amb, sunColor: th.torch, anim, ceiling: 8, pickups, secrets, bossRoom: rooms[rooms.length - 1], theme: th, music: 'dungeon', ambience: 'cave', discover: [],
    hazard: (x, zz, t) => { const h = grid.hazAt(x, zz); if (h === 1) return 'lava'; if (h === 2 && t % 3 < 1.2) return 'spikes'; return null; } };
}
export { gCone, gCyl };
