// Destructible environments: instanced floor-chunk buildings, vehicles, themed ground/sky/backdrops
import * as THREE from 'three';
import type { Theme } from './data';
import type { FX } from './fx';

export interface Floor { i: number; y: number; h: number; w: number; d: number; hp: number; max: number; alive: boolean }
export interface Building { x: number; z: number; w: number; d: number; h: number; floors: Floor[]; value: number; color: string; alive: number }
export interface Vehicle { x: number; z: number; y: number; rot: number; state: number; vx: number; vy: number; vz: number; t: number; color: string; spin: number }

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

function windowTextures(win: string, lit: number, wall: string, rnd: () => number) {
  const mk = (emit: boolean) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d')!;
    g.fillStyle = emit ? '#000' : wall; g.fillRect(0, 0, 128, 128);
    const r2 = rng(99); const cols = 4, rows = 3;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const on = r2() < lit; const px = 8 + x * 30, py = 12 + y * 38;
      if (emit) { if (on) { g.fillStyle = win; g.globalAlpha = 0.6 + r2() * 0.4; g.fillRect(px, py, 20, 26); g.globalAlpha = 1; } }
      else { g.fillStyle = on ? win : '#1a2236'; g.fillRect(px, py, 20, 26); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + 12, 20, 2); }
    }
    if (!emit) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 118, 128, 10); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; g.fillRect(rnd() * 128, rnd() * 128, 10, 3); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  return [mk(false), mk(true)];
}

function groundTexture(t: Theme, half: number, rnd: () => number) {
  const S = 1024; const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!; const k = S / (half * 2);
  g.fillStyle = t.ground; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.06})`; const s = 2 + rnd() * 14; g.fillRect(rnd() * S, rnd() * S, s, s); }
  if (t.road) {
    const N = Math.floor(half / t.cell); const rw = 12 * k;
    for (let i = -N; i <= N; i++) {
      const p = S / 2 + i * t.cell * k; g.fillStyle = t.ground2; g.fillRect(p - rw / 2, 0, rw, S); g.fillRect(0, p - rw / 2, S, rw);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(p - rw / 2, 0, 2, S); g.fillRect(p + rw / 2 - 2, 0, 2, S); g.fillRect(0, p - rw / 2, S, 2); g.fillRect(0, p + rw / 2 - 2, S, 2);
      g.fillStyle = 'rgba(255,214,90,0.5)'; for (let d = 0; d < S; d += 22) { g.fillRect(p - 1, d, 2, 11); g.fillRect(d, p - 1, 11, 2); }
    }
  } else if (t.style === 'platform') {
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * S / 16, 0); g.lineTo(i * S / 16, S); g.moveTo(0, i * S / 16); g.lineTo(S, i * S / 16); g.stroke(); }
    g.fillStyle = 'rgba(255,200,40,0.55)'; for (let i = 0; i < S; i += 24) { g.fillRect(i, 0, 12, 14); g.fillRect(i, S - 14, 12, 14); g.fillRect(0, i, 14, 12); g.fillRect(S - 14, i, 14, 12); }
    g.strokeStyle = 'rgba(120,230,255,0.6)'; g.lineWidth = 4; g.beginPath(); g.arc(S / 2, S / 2, S * 0.2, 0, 6.28); g.stroke(); g.beginPath(); g.arc(S / 2, S / 2, S * 0.04, 0, 6.28); g.stroke();
  } else if (t.style === 'volcano') {
    g.strokeStyle = 'rgba(255,100,20,0.7)'; g.lineWidth = 3; for (let i = 0; i < 40; i++) { let x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (rnd() - 0.5) * 90; y += (rnd() - 0.5) * 90; g.lineTo(x, y); } g.stroke(); }
  } else if (t.style === 'mountain') {
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; for (let i = 0; i <= 20; i++) { g.beginPath(); g.moveTo(i * S / 20, 0); g.lineTo(i * S / 20, S); g.moveTo(0, i * S / 20); g.lineTo(S, i * S / 20); g.stroke(); }
  } else if (t.style === 'desert') {
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,230,180,${0.05 + rnd() * 0.1})`; g.lineWidth = 6 + rnd() * 10; g.beginPath(); const y = rnd() * S; g.moveTo(0, y); g.bezierCurveTo(S / 3, y + 60, S * 2 / 3, y - 60, S, y + 20); g.stroke(); }
    g.fillStyle = t.ground2; g.fillRect(S / 2 - 60, 0, 120, S);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}

export class World {
  group = new THREE.Group(); buildings: Building[] = []; vehicles: Vehicle[] = []; half: number; inst!: THREE.InstancedMesh; veh!: THREE.InstancedMesh; totalValue = 0; aliveValue = 0;
  lavaPools: { x: number; z: number; r: number }[] = []; pending: { f: Floor; b: Building; t: number }[] = []; destroyedFloors = 0; destroyedBuildings = 0; onBuildingDown: (b: Building) => void = () => {};
  disposables: { dispose(): void }[] = []; water?: THREE.Mesh; sky!: THREE.Mesh; rnd: () => number; dummy = new THREE.Object3D(); floorsFlat: { b: Building; f: Floor }[] = []; sun!: THREE.Mesh; spinners: THREE.Object3D[] = [];

  constructor(public scene: THREE.Scene, public theme: Theme, public fx: FX, public density: number, public quality: number) {
    this.half = theme.half; this.rnd = rng(hash(theme.id) + 12345); scene.add(this.group);
    scene.background = new THREE.Color(theme.sky[0]); scene.fog = new THREE.FogExp2(theme.fog, theme.fogD);
    this.buildGround(); this.buildSky(); this.buildBackdrop(); this.layout(); this.buildInstances(); this.buildVehicles();
  }
  track<T extends { dispose(): void }>(o: T) { this.disposables.push(o); return o; }

  // --------------------------------------------------------- terrain
  buildGround() {
    const t = this.theme; const H = this.half; const tex = this.track(groundTexture(t, H, this.rnd));
    const gm = this.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.05 })); const gg = this.track(new THREE.PlaneGeometry(H * 2, H * 2)); gg.rotateX(-Math.PI / 2);
    const g = new THREE.Mesh(gg, gm); g.receiveShadow = true; this.group.add(g);
    const outerColor = t.water ? t.water : t.lava ? '#ff4a10' : t.ground2; const og = this.track(new THREE.PlaneGeometry(3000, 3000, t.water ? 30 : 1, t.water ? 30 : 1)); og.rotateX(-Math.PI / 2);
    const om = this.track(t.lava ? new THREE.MeshBasicMaterial({ color: outerColor, fog: true }) : new THREE.MeshStandardMaterial({ color: outerColor, roughness: t.water ? 0.25 : 1, metalness: t.water ? 0.6 : 0, flatShading: true, transparent: !!t.water, opacity: t.water ? 0.94 : 1 }));
    const o = new THREE.Mesh(og, om); o.position.y = t.water ? -2.5 : t.lava ? -1.5 : -0.1; o.receiveShadow = !t.water; this.group.add(o); if (t.water || t.lava) this.water = o;
    if (t.water) { // dock edge
      const eg = this.track(new THREE.BoxGeometry(H * 2 + 4, 3, H * 2 + 4)); const em = this.track(new THREE.MeshStandardMaterial({ color: t.ground2, roughness: 1 })); const e = new THREE.Mesh(eg, em); e.position.y = -1.6; this.group.add(e);
    }
    if (t.lava) {
      const pm = this.track(new THREE.MeshBasicMaterial({ color: '#ff5a14' })); const pg = this.track(new THREE.CircleGeometry(1, 28)); pg.rotateX(-Math.PI / 2);
      for (let i = 0; i < 5; i++) { const a = this.rnd() * 6.28, d = 55 + this.rnd() * (H - 75), r = 10 + this.rnd() * 12; const x = Math.cos(a) * d, z = Math.sin(a) * d; this.lavaPools.push({ x, z, r }); const m = new THREE.Mesh(pg, pm); m.position.set(x, 0.12, z); m.scale.setScalar(r); this.group.add(m); const rm = new THREE.Mesh(pg, this.track(new THREE.MeshBasicMaterial({ color: '#2a1008' }))); rm.position.set(x, 0.08, z); rm.scale.setScalar(r * 1.25); this.group.add(rm); }
    }
  }
  buildSky() {
    const t = this.theme; const geo = this.track(new THREE.SphereGeometry(1400, 24, 16));
    const mat = this.track(new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(t.sky[0]) }, hor: { value: new THREE.Color(t.sky[1]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.55)); if(vP.y<0.0) c = hor*0.6; gl_FragColor = vec4(c,1.0); }' }));
    this.sky = new THREE.Mesh(geo, mat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.group.add(this.sky);
    // stars
    const sp = new Float32Array(600 * 3); for (let i = 0; i < 600; i++) { const a = this.rnd() * 6.28, b = Math.acos(this.rnd() * 0.9 + 0.1); sp[i * 3] = Math.sin(b) * Math.cos(a) * 1300; sp[i * 3 + 1] = Math.cos(b) * 1300; sp[i * 3 + 2] = Math.sin(b) * Math.sin(a) * 1300; }
    const sg = this.track(new THREE.BufferGeometry()); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); const stars = new THREE.Points(sg, this.track(new THREE.PointsMaterial({ color: '#ffffff', size: 3, fog: false, transparent: true, opacity: 0.7, depthWrite: false }))); stars.frustumCulled = false; this.group.add(stars);
    const sm = this.track(new THREE.MeshBasicMaterial({ color: t.sun, fog: false })); const sg2 = this.track(new THREE.SphereGeometry(1, 20, 12));
    this.sun = new THREE.Mesh(sg2, sm); this.sun.scale.setScalar(t.style === 'volcano' ? 90 : 70); this.sun.position.set(-700, 320, -900); this.group.add(this.sun);
    const halo = new THREE.Mesh(sg2, this.track(new THREE.MeshBasicMaterial({ color: t.sun, fog: false, transparent: true, opacity: 0.2, depthWrite: false }))); halo.scale.setScalar(150); halo.position.copy(this.sun.position); this.group.add(halo);
    if (t.style === 'ruin' || t.id === 'city') { // dimensional rift
      const rg = this.track(new THREE.TorusGeometry(1, 0.06, 8, 48)); const rm = this.track(new THREE.MeshBasicMaterial({ color: t.id === 'city' ? '#ff4a3a' : '#b06aff', fog: false, transparent: true, opacity: 0.8 })); const rift = new THREE.Mesh(rg, rm); rift.scale.setScalar(t.id === 'city' ? 120 : 260); rift.position.set(200, 420, -700); rift.rotation.x = 0.4; this.group.add(rift); this.spinners.push(rift);
      const rift2 = new THREE.Mesh(rg, rm); rift2.scale.setScalar(t.id === 'city' ? 80 : 180); rift2.position.copy(rift.position); rift2.rotation.set(0.6, 0.3, 0); this.group.add(rift2); this.spinners.push(rift2);
    }
  }
  buildBackdrop() {
    const t = this.theme; const n = Math.round(46 * (0.5 + this.density * 0.5)); const mount = ['mountain', 'snow', 'desert', 'volcano', 'platform', 'harbor'].includes(t.style);
    const geo = mount ? this.track(new THREE.ConeGeometry(1, 1, 6)) : this.track(new THREE.BoxGeometry(1, 1, 1)); const fogC = new THREE.Color(t.fog);
    const mat = this.track(new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: t.style === 'volcano' ? '#ff3a08' : '#000000', emissiveIntensity: 0.12 }));
    const im = new THREE.InstancedMesh(geo, mat, n); const d = this.dummy; const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + this.rnd() * 0.1; const r = 480 + this.rnd() * 180; const h = mount ? 70 + this.rnd() * 190 : 60 + this.rnd() * 220; const w = mount ? 80 + this.rnd() * 140 : 25 + this.rnd() * 40;
      if (t.style === 'platform' || t.style === 'harbor') { if (i % 3) { d.scale.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.set('#000')); continue; } }
      d.position.set(Math.cos(a) * r, mount ? h / 2 - 4 : h / 2, Math.sin(a) * r); d.scale.set(w, h, mount ? w : w); d.rotation.set(0, this.rnd() * 3, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      im.setColorAt(i, c.set(mount ? t.bc[0] : t.bc[1] || '#333').lerp(fogC, 0.55 + this.rnd() * 0.25).multiplyScalar(0.8));
    }
    im.frustumCulled = false; this.group.add(im); this.track(im);
  }

  // --------------------------------------------------------- layout
  private raw: { x: number; z: number; w: number; d: number; n: number; fh: number; c: string; sb: number }[] = [];
  addB(x: number, z: number, w: number, d: number, n: number, fh: number, c: string, sb = 0) { this.raw.push({ x, z, w, d, n: Math.max(1, Math.round(n)), fh, c, sb }); }
  scatter(count: number, minR: number, maxR: number, f: (r: () => number) => [number, number, number, number, string, number?]) {
    const placed: [number, number, number][] = this.raw.map(b => [b.x, b.z, Math.max(b.w, b.d) / 2]); let tries = 0, made = 0;
    while (made < count && tries++ < 400) {
      const a = this.rnd() * 6.283, r = minR + this.rnd() * (maxR - minR); const x = Math.cos(a) * r, z = Math.sin(a) * r; const [w, d, n, fh, c, sb] = f(this.rnd); const rr = Math.max(w, d) / 2 + 5;
      if (Math.abs(x) > this.half - rr - 8 || Math.abs(z) > this.half - rr - 8) continue; if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < p[2] + rr)) continue;
      placed.push([x, z, rr]); this.addB(x, z, w, d, n, fh, c, sb || 0); made++;
    }
  }
  layout() {
    const t = this.theme; const R = this.rnd; const bc = () => t.bc[Math.floor(R() * t.bc.length)]; const dens = this.density; const N = Math.floor(this.half / t.cell); const cell = t.cell;
    if (t.style === 'city' || t.style === 'ruin' || t.style === 'harbor') {
      for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
        const cx = (i + 0.5) * cell, cz = (j + 0.5) * cell; if (Math.abs(cx) < cell * 0.8 && Math.abs(cz) < cell * 0.8) continue; if (R() > dens + 0.15) continue;
        const [lo, hi] = t.bh; const hf = () => Math.round(lo + R() * (hi - lo)) * (1 + (Math.hypot(cx, cz) < 100 ? 0.3 : 0));
        if (t.style === 'harbor') {
          const k = R();
          if (k < 0.45) { for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) this.addB(cx - 12 + a * 12, cz - 7 + b * 14, 10.5, 5, 1 + Math.floor(R() * 3), 3.2, bc()); }
          else if (k < 0.7) this.addB(cx, cz, 32, 20, 2, 6, bc());
          else if (k < 0.85) { this.addB(cx - 10, cz, 4, 4, 8, 5, '#d8602a'); this.addB(cx + 10, cz, 4, 4, 8, 5, '#d8602a'); this.addB(cx, cz - 14, 26, 6, 1, 3, '#8a8f99'); }
          else { this.addB(cx - 8, cz, 12, 12, 3, 5, '#aab4bc'); this.addB(cx + 9, cz, 12, 12, 3, 5, '#aab4bc'); }
          continue;
        }
        const k = R(); const h = (m = 1) => Math.max(2, hf() * m);
        const rub = t.style === 'ruin';
        if (k < 0.35) this.addB(cx, cz, 30 + R() * 4, 30 + R() * 4, h(), 5.5, bc(), R() < 0.5 ? 0.06 : 0);
        else if (k < 0.7) { const s = R() < 0.5; this.addB(cx + (s ? -9 : 0), cz + (s ? 0 : -9), s ? 15 : 30, s ? 30 : 15, h(), 5.5, bc()); this.addB(cx + (s ? 9 : 0), cz + (s ? 0 : 9), s ? 15 : 30, s ? 30 : 15, h(0.8), 5.5, bc()); }
        else for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (R() < 0.85) this.addB(cx - 8.5 + a * 17, cz - 8.5 + b * 17, 14, 14, h(0.9), 5.5, bc(), 0.05);
        if (rub && R() < 0.2) this.raw.pop();
      }
    } else if (t.style === 'platform') {
      this.scatter(Math.round(15 * dens + 4), 38, 100, r => [10 + r() * 12, 10 + r() * 12, 2 + r() * 4, 5.5, bc(), r() < 0.4 ? 0.05 : 0]);
      for (const [x, z] of [[-90, -90], [90, -90], [-90, 90], [90, 90]]) this.addB(x, z, 9, 9, 7, 5, '#d8602a');
    } else if (t.style === 'desert') {
      this.scatter(Math.round(22 * dens + 5), 40, 135, r => [10 + r() * 20, 8 + r() * 14, 1 + r() * 2, 5, bc()]);
    } else if (t.style === 'snow') {
      this.scatter(Math.round(18 * dens + 4), 40, 130, r => [12 + r() * 14, 10 + r() * 14, 2 + r() * 3, 5, bc(), 0.05]);
    } else if (t.style === 'volcano') {
      this.scatter(Math.round(12 * dens + 4), 45, 120, r => [10 + r() * 14, 10 + r() * 14, 2 + r() * 3, 5, bc(), 0.07]);
    } else if (t.style === 'mountain') {
      const wall = (x: number, z: number, w: number, d: number) => this.addB(x, z, w, d, 3, 5, '#7a8190'); const hh = this.half - 28;
      for (const s of [-1, 1]) { wall(-hh * 0.55, s * hh, 46, 6); wall(hh * 0.55, s * hh, 46, 6); wall(s * hh, -hh * 0.55, 6, 46); wall(s * hh, hh * 0.55, 6, 46); }
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) this.addB(x * hh, z * hh, 14, 14, 7, 5, '#8a92a0', 0.04);
      this.scatter(Math.round(8 * dens + 2), 40, 90, r => [12 + r() * 10, 12 + r() * 10, 2 + r() * 3, 5, bc(), 0.05]);
    }
  }
  buildInstances() {
    const t = this.theme; let total = 0; this.raw.forEach(b => (total += b.n)); const R = this.rnd;
    const [wt, et] = windowTextures(t.win, 0.25 + 0.5 * (t.wl / 1.4), '#c8ccd6', R); this.track(wt); this.track(et);
    const geo = this.track(new THREE.BoxGeometry(1, 1, 1)); const mat = this.track(new THREE.MeshStandardMaterial({ map: wt, emissiveMap: et, emissive: '#ffffff', emissiveIntensity: t.wl, roughness: 0.75, metalness: 0.2 }));
    this.inst = new THREE.InstancedMesh(geo, mat, Math.max(1, total)); this.inst.castShadow = true; this.inst.receiveShadow = true; this.inst.frustumCulled = false; this.group.add(this.inst);
    const d = this.dummy; let idx = 0; const col = new THREE.Color();
    for (const r of this.raw) {
      const floors: Floor[] = []; let y = 0; let value = 0;
      const hpBase = 150 + r.w * r.d * 0.12;
      for (let i = 0; i < r.n; i++) {
        const k = Math.max(0.55, 1 - r.sb * i); const f: Floor = { i: idx, y: y + r.fh / 2, h: r.fh, w: r.w * k, d: r.d * k, hp: hpBase, max: hpBase, alive: true };
        d.position.set(r.x, f.y, r.z); d.scale.set(f.w, f.h, f.d); d.rotation.set(0, 0, 0); d.updateMatrix(); this.inst.setMatrixAt(idx, d.matrix);
        col.set(r.c).multiplyScalar(0.8 + R() * 0.3); this.inst.setColorAt(idx, col); floors.push(f); y += r.fh; value += f.w * f.d * f.h * 0.01; idx++;
      }
      const b: Building = { x: r.x, z: r.z, w: r.w, d: r.d, h: y, floors, value, color: r.c, alive: r.n }; this.buildings.push(b); this.totalValue += value; floors.forEach(f => this.floorsFlat[f.i] = { b, f });
    }
    this.aliveValue = this.totalValue;
    // decor
    if (t.style === 'snow' || t.style === 'volcano' || t.style === 'mountain' || t.style === 'desert') {
      const n = Math.round((t.style === 'snow' ? 140 : 50) * (0.4 + this.density * 0.6)); const cg = this.track(new THREE.ConeGeometry(1, 1, 6)); const cm = this.track(new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: t.style === 'volcano' ? '#ff3a08' : '#000', emissiveIntensity: 0.15 }));
      const im = new THREE.InstancedMesh(cg, cm, n); im.castShadow = true; const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        let x = 0, z = 0, tries = 0; do { x = (R() * 2 - 1) * (this.half - 5); z = (R() * 2 - 1) * (this.half - 5); tries++; } while ((Math.hypot(x, z) < 45 || this.buildings.some(b => Math.abs(b.x - x) < b.w / 2 + 6 && Math.abs(b.z - z) < b.d / 2 + 6)) && tries < 20);
        const pine = t.style === 'snow'; const h = pine ? 9 + R() * 12 : 6 + R() * 18; const w = pine ? h * 0.28 : 3 + R() * 6;
        d.position.set(x, h / 2, z); d.scale.set(w, h, w); d.rotation.set(0, R() * 3, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.set(pine ? '#2f5a4a' : t.style === 'desert' ? '#8a7048' : t.style === 'volcano' ? '#2a1a16' : '#565c68').multiplyScalar(0.7 + R() * 0.5));
      }
      im.frustumCulled = false; this.group.add(im); this.track(im);
    }
  }
  buildVehicles() {
    const t = this.theme; const R = this.rnd; const n = Math.round(34 * this.density + 6); const g1 = new THREE.BoxGeometry(5.2, 1.5, 2.4); g1.translate(0, 1.1, 0); const g2 = new THREE.BoxGeometry(2.6, 1.2, 2.1); g2.translate(-0.3, 2.3, 0);
    const vg = this.track(mergeBox(g1, g2)); const vm = this.track(new THREE.MeshStandardMaterial({ color: '#fff', flatShading: true, roughness: 0.5, metalness: 0.5, emissive: '#331a08', emissiveIntensity: 0.3 })); this.veh = new THREE.InstancedMesh(vg, vm, n); this.veh.castShadow = true; this.veh.frustumCulled = false; this.group.add(this.veh);
    const cols = ['#d8302a', '#2a6fd8', '#e8d030', '#e8e8ee', '#2a2a30', '#30a850', '#e87a20'];
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0, rot = 0, tries = 0;
      do {
        if (t.road) { const N = Math.floor(this.half / t.cell); const line = (Math.floor(R() * (2 * N + 1)) - N) * t.cell; const along = (R() * 2 - 1) * (this.half - 10); const lane = (R() < 0.5 ? -1 : 1) * 3; if (R() < 0.5) { x = line + lane; z = along; rot = Math.PI / 2; } else { x = along; z = line + lane; rot = 0; } }
        else { x = (R() * 2 - 1) * (this.half - 10); z = (R() * 2 - 1) * (this.half - 10); rot = R() * 6.28; }
        tries++;
      } while ((Math.hypot(x, z) < 20 || this.buildings.some(b => Math.abs(b.x - x) < b.w / 2 + 3 && Math.abs(b.z - z) < b.d / 2 + 3)) && tries < 30);
      this.vehicles.push({ x, z, y: 0, rot, state: 0, vx: 0, vy: 0, vz: 0, t: 0, color: cols[Math.floor(R() * cols.length)], spin: 0 }); this.veh.setColorAt(i, new THREE.Color(this.vehicles[i].color));
    }
    this.syncVehicles();
  }
  syncVehicles() {
    const d = this.dummy; this.vehicles.forEach((v, i) => { d.position.set(v.x, v.y, v.z); d.rotation.set(v.state === 1 ? v.spin : 0, v.rot, v.state === 1 ? v.spin * 0.6 : 0); d.scale.setScalar(v.state === 2 ? 0 : 1.15); d.updateMatrix(); this.veh.setMatrixAt(i, d.matrix); }); this.veh.instanceMatrix.needsUpdate = true;
  }

  // --------------------------------------------------------- destruction
  setFloorMatrix(f: Floor, hide: boolean, b: Building) {
    const d = this.dummy; d.position.set(b.x, f.y, b.z); d.scale.set(hide ? 0 : f.w, hide ? 0 : f.h, hide ? 0 : f.d); d.updateMatrix(); this.inst.setMatrixAt(f.i, d.matrix); this.inst.instanceMatrix.needsUpdate = true;
  }
  destroyFloor(b: Building, f: Floor, big = false) {
    if (!f.alive) return; f.alive = false; b.alive--; this.setFloorMatrix(f, true, b); this.destroyedFloors++; this.aliveValue -= f.w * f.d * f.h * 0.01;
    const p = new THREE.Vector3(b.x, f.y, b.z); this.fx.chunk(p, 7, b.color, 14, Math.max(1, f.w * 0.09)); this.fx.chunk(p, 3, '#555a66', 20, 1.2); this.fx.smoke(p, 4, f.w * 0.1, '#6a6660'); this.fx.dust(p.setY(0), f.w * 0.5, 8);
    if (big || f.y < 8) { this.fx.burst(p, 6, '#ffb060', 18, 1.0, 0.5, 0, true, 2, 1); }
    this.fx.sparks(p, new THREE.Vector3(0, 1, 0), 6, '#9ad8ff', 24);
    if (b.alive === 0) { this.destroyedBuildings++; this.onBuildingDown(b); this.fx.explosion(new THREE.Vector3(b.x, 4, b.z), Math.min(3, b.w * 0.07), '#ffa04a', false); this.fx.smoke(new THREE.Vector3(b.x, 6, b.z), 8, Math.min(3, b.w * 0.09)); this.fx.dust(new THREE.Vector3(b.x, 0, b.z), b.w * 0.9, 18); }
  }
  collapseAbove(b: Building, f: Floor) { b.floors.forEach((o, k) => { if (o.alive && o.y > f.y) this.pending.push({ f: o, b, t: 0.12 + (k - b.floors.indexOf(f)) * 0.1 }); }); }
  damageFloor(b: Building, f: Floor, dmg: number) { if (!f.alive) return false; f.hp -= dmg; if (f.hp <= 0) { this.destroyFloor(b, f); this.collapseAbove(b, f); return true; } return false; }
  /** Area damage to buildings. y = blast centre height. Returns floors destroyed. */
  hit(x: number, y: number, z: number, r: number, dmg: number) {
    let n = 0;
    for (const b of this.buildings) {
      if (b.alive === 0) continue; const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0), dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0); const dd = Math.hypot(dx, dz); if (dd > r) continue;
      const fall = 1 - dd / r * 0.7; for (const f of b.floors) { if (!f.alive) continue; if (Math.abs(f.y - y) > r + f.h / 2) continue; if (this.damageFloor(b, f, dmg * fall)) n++; }
    }
    return n;
  }
  /** Point test for projectiles. Returns building+floor hit. */
  pointHit(p: THREE.Vector3): { b: Building; f: Floor } | null {
    for (const b of this.buildings) {
      if (b.alive === 0 || Math.abs(p.x - b.x) > b.w / 2 || Math.abs(p.z - b.z) > b.d / 2 || p.y > b.h || p.y < 0) continue;
      for (const f of b.floors) if (f.alive && Math.abs(p.y - f.y) <= f.h / 2 && Math.abs(p.x - b.x) <= f.w / 2 && Math.abs(p.z - b.z) <= f.d / 2) return { b, f };
    }
    return null;
  }
  /** Giant footprint collision. Plows low/small buildings or pushes out. */
  collide(pos: THREE.Vector3, r: number, plowMaxH: number, dps: number, dt: number): boolean {
    let pushed = false;
    for (const b of this.buildings) {
      if (b.alive === 0) continue; const hw = b.w / 2, hd = b.d / 2; if (Math.abs(pos.x - b.x) > hw + r || Math.abs(pos.z - b.z) > hd + r) continue;
      const cx = THREE.MathUtils.clamp(pos.x, b.x - hw, b.x + hw), cz = THREE.MathUtils.clamp(pos.z, b.z - hd, b.z + hd); let dx = pos.x - cx, dz = pos.z - cz; let dist = Math.hypot(dx, dz);
      if (dist >= r) continue;
      if (b.h <= plowMaxH || plowMaxH < 0) { const f = b.floors.find(k => k.alive); if (f && dps > 0) this.damageFloor(b, f, dps * dt); continue; }
      if (dist < 0.001) { dx = pos.x - b.x; dz = pos.z - b.z; dist = Math.hypot(dx, dz) || 1; }
      pos.x += (dx / dist) * (r - dist); pos.z += (dz / dist) * (r - dist); pushed = true;
    }
    return pushed;
  }
  explodeVehicle(v: Vehicle) { if (v.state === 2) return false; v.state = 2; this.fx.explosion(new THREE.Vector3(v.x, v.y + 1.5, v.z), 1.3, '#ffa040'); this.fx.chunk(new THREE.Vector3(v.x, v.y + 1, v.z), 6, '#333', 22, 0.7); return true; }
  integrity() { return Math.max(0, Math.min(100, (this.aliveValue / Math.max(1, this.totalValue)) * 100)); }
  hazardAt(x: number, z: number) { return this.lavaPools.some(p => Math.hypot(p.x - x, p.z - z) < p.r); }

  update(dt: number, t: number, camPos: THREE.Vector3) {
    this.pending = this.pending.filter(p => { p.t -= dt; if (p.t <= 0) { this.destroyFloor(p.b, p.f); return false; } return true; });
    this.sky.position.copy(camPos); if (this.water) this.water.position.y = (this.theme.lava ? -1.5 : -2.5) + Math.sin(t * 0.8) * 0.25;
    this.spinners.forEach((s, i) => (s.rotation.z += dt * (0.05 + i * 0.03)));
    let dirty = false;
    this.vehicles.forEach(v => { if (v.state !== 1) return; v.vy -= 40 * dt; v.x += v.vx * dt; v.y += v.vy * dt; v.z += v.vz * dt; v.spin += dt * 6; dirty = true; if (v.y <= 0) { v.y = 0; this.explodeVehicle(v); this.hit(v.x, 1, v.z, 12, 150); } });
    if (dirty) this.syncVehicles();
  }
  syncAll() { this.syncVehicles(); }
  dispose() { this.scene.remove(this.group); this.disposables.forEach(d => d.dispose()); this.inst.dispose(); this.veh.dispose(); this.scene.fog = null; }
}
function mergeBox(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const ga = a.toNonIndexed(), gb = b.toNonIndexed(); const out = new THREE.BufferGeometry();
  const merge = (n: string, c: number) => { const x = ga.getAttribute(n).array as Float32Array, y = gb.getAttribute(n).array as Float32Array; const arr = new Float32Array(x.length + y.length); arr.set(x); arr.set(y, x.length); out.setAttribute(n, new THREE.BufferAttribute(arr, c)); };
  merge('position', 3); merge('normal', 3); merge('uv', 2); return out;
}
