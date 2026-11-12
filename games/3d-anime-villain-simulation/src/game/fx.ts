import * as THREE from 'three';
import { G, rnd, type Vec } from './runtime';

// Pooled particle / effect system. Everything is driven by updateFx(dt) from the render loop.
interface Eff { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; dur: number; kind: string; s0: number; s1: number; h: number; on: boolean }
export const fxRoot = new THREE.Group();
let pCount = 900, pi = 0;
let px: Float32Array, pv: Float32Array, pl: Float32Array, pm: Float32Array, ps: Float32Array, pc: Float32Array, pg: Float32Array;
let pMesh: THREE.InstancedMesh | null = null, projMesh: THREE.InstancedMesh | null = null;
const effs: Eff[] = []; let inited = false;
const dummy = new THREE.Object3D(); const tc = new THREE.Color();
const UPY = new THREE.Vector3(0, 0, 1);

export function initFx(level: 'low' | 'medium' | 'high' | 'ultra') {
  pCount = { low: 500, medium: 1100, high: 2200, ultra: 3600 }[level];
  if (inited) { fxRoot.remove(pMesh!); pMesh!.dispose(); }
  px = new Float32Array(pCount * 3); pv = new Float32Array(pCount * 3); pl = new Float32Array(pCount); pm = new Float32Array(pCount); ps = new Float32Array(pCount); pc = new Float32Array(pCount * 3); pg = new Float32Array(pCount);
  pMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), pCount);
  pMesh.frustumCulled = false; pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < pCount; i++) { pMesh.setColorAt(i, tc.set('#fff')); dummy.scale.setScalar(0); dummy.updateMatrix(); pMesh.setMatrixAt(i, dummy.matrix); }
  fxRoot.add(pMesh);
  if (inited) return; inited = true;
  projMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), 128); projMesh.frustumCulled = false; for (let i = 0; i < 128; i++) { projMesh.setColorAt(i, tc.set('#fff')); }
  fxRoot.add(projMesh);
  const mkPool = (kind: string, geo: THREE.BufferGeometry, n: number, side: THREE.Side = THREE.DoubleSide) => {
    for (let i = 0; i < n; i++) { const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side }); const m = new THREE.Mesh(geo, mat); m.visible = false; m.frustumCulled = false; fxRoot.add(m); effs.push({ m, mat, t: 0, dur: 1, kind, s0: 1, s1: 1, h: 1, on: false }); }
  };
  mkPool('ring', new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), 18);
  mkPool('beam', new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), 12);
  mkPool('slash', new THREE.RingGeometry(0.55, 1, 28, 1, -1.2, 2.4), 10);
  mkPool('dome', new THREE.SphereGeometry(1, 20, 14), 8);
  mkPool('pillar', new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0), 14);
}
function getEff(kind: string): Eff { let best: Eff | null = null; for (const e of effs) { if (e.kind !== kind) continue; if (!e.on) return e; if (!best || e.t / e.dur > best.t / best.dur) best = e; } return best!; }
const setE = (e: Eff, color: string, dur: number, s0: number, s1: number, h = 1) => { e.mat.color.set(color); e.t = 0; e.dur = dur; e.s0 = s0; e.s1 = s1; e.h = h; e.on = true; e.m.visible = true; };

export const fx = {
  spark(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: string, grav = 0) {
    if (!px) return;
    const i = pi++ % pCount; px[i * 3] = x; px[i * 3 + 1] = y; px[i * 3 + 2] = z; pv[i * 3] = vx; pv[i * 3 + 1] = vy; pv[i * 3 + 2] = vz; pl[i] = life; pm[i] = life; ps[i] = size; pg[i] = grav; tc.set(color); pc[i * 3] = tc.r; pc[i * 3 + 1] = tc.g; pc[i * 3 + 2] = tc.b;
  },
  burst(p: Vec, color: string, n = 20, speed = 6, life = 0.6, size = 0.18, grav = 0) {
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), b = rnd(-1, 1), s = rnd(0.3, 1) * speed; const c = Math.sqrt(1 - b * b); fx.spark(p.x, p.y, p.z, Math.cos(a) * c * s, b * s, Math.sin(a) * c * s, life * rnd(0.6, 1.2), size * rnd(0.5, 1.3), color, grav); }
  },
  ring(p: Vec, color: string, radius: number, dur = 0.6, y = 0.1) { if (!inited) return; const e = getEff('ring'); setE(e, color, dur, 0.2, radius); e.m.position.set(p.x, p.y + y, p.z); e.m.rotation.set(0, 0, 0); e.m.scale.set(0.2, 1, 0.2); },
  ringV(p: Vec, color: string, radius: number, dur: number, rx: number, ry: number) { if (!inited) return; const e = getEff('ring'); setE(e, color, dur, 0.2, radius); e.m.position.copy(p); e.m.rotation.set(rx, ry, 0); e.m.scale.set(0.2, 1, 0.2); },
  beam(a: Vec, b: Vec, color: string, width: number, dur = 0.5) { if (!inited) return;
    const e = getEff('beam'); setE(e, color, dur, width, width); e.m.position.copy(a); const d = b.clone().sub(a); const len = d.length(); e.m.quaternion.setFromUnitVectors(UPY, d.normalize()); e.m.scale.set(width, width, len);
  },
  slash(p: Vec, yaw: number, color: string, size: number, tilt = 0, dur = 0.28) { if (!inited) return; const e = getEff('slash'); setE(e, color, dur, size * 0.6, size); e.m.position.copy(p); e.m.rotation.set(0, yaw, 0); e.m.rotateX(-Math.PI / 2 + 0.0); e.m.rotateZ(tilt); e.m.scale.setScalar(size * 0.6); },
  dome(p: Vec, color: string, radius: number, dur = 0.5) { if (!inited) return; const e = getEff('dome'); setE(e, color, dur, 0.2, radius); e.m.position.copy(p); e.m.rotation.set(0, 0, 0); e.m.scale.setScalar(0.2); },
  pillar(p: Vec, color: string, radius: number, height: number, dur = 0.5) { if (!inited) return; const e = getEff('pillar'); setE(e, color, dur, radius, radius, height); e.m.position.set(p.x, p.y, p.z); e.m.rotation.set(0, 0, 0); e.m.scale.set(radius, height, radius); },
  explosion(p: Vec, color: string, r: number, c2 = '#fff') { fx.burst(p, color, 40, r * 2.2, 0.8, 0.3); fx.burst(p, c2, 14, r * 1.4, 0.5, 0.22); fx.ring(p, color, r, 0.5, 0.2); fx.dome(p, color, r * 0.7, 0.35); },
};

export function updateFx(dt: number) {
  if (!pMesh) return; const m = pMesh;
  for (let i = 0; i < pCount; i++) {
    if (pl[i] <= 0) { if (ps[i] !== 0) { ps[i] = 0; dummy.scale.setScalar(0); dummy.position.set(0, -999, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); } continue; }
    pl[i] -= dt; pv[i * 3 + 1] -= pg[i] * dt; px[i * 3] += pv[i * 3] * dt; px[i * 3 + 1] += pv[i * 3 + 1] * dt; px[i * 3 + 2] += pv[i * 3 + 2] * dt;
    const f = Math.max(0, pl[i] / pm[i]); dummy.position.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); dummy.scale.setScalar(ps[i] * (0.3 + f * 0.9)); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    tc.setRGB(pc[i * 3] * f * 1.3, pc[i * 3 + 1] * f * 1.3, pc[i * 3 + 2] * f * 1.3); m.setColorAt(i, tc);
  }
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  for (const e of effs) {
    if (!e.on) continue; e.t += dt; const p = e.t / e.dur; if (p >= 1) { e.on = false; e.m.visible = false; continue; } const ease = 1 - Math.pow(1 - p, 3);
    if (e.kind === 'ring') { const s = e.s0 + (e.s1 - e.s0) * ease; e.m.scale.set(s, 1, s); e.mat.opacity = (1 - p) * 0.9; }
    else if (e.kind === 'beam') { const w = e.s0 * (1 - p * 0.6) * (1 + Math.sin(e.t * 60) * 0.08); e.m.scale.x = w; e.m.scale.y = w; e.mat.opacity = Math.min(1, (1 - p) * 1.4); }
    else if (e.kind === 'slash') { const s = e.s0 + (e.s1 - e.s0) * ease; e.m.scale.setScalar(s); e.mat.opacity = (1 - p) * 0.95; }
    else if (e.kind === 'dome') { const s = e.s0 + (e.s1 - e.s0) * ease; e.m.scale.setScalar(s); e.mat.opacity = (1 - p) * 0.45; }
    else if (e.kind === 'pillar') { const hh = e.h * Math.min(1, p * 5); e.m.scale.set(e.s0 * (1 - p * 0.5), hh, e.s0 * (1 - p * 0.5)); e.mat.opacity = (1 - p) * 0.85; }
  }
  // projectiles
  if (projMesh) {
    let n = 0; for (const pr of G.projectiles) { if (n >= 128) break; dummy.position.copy(pr.pos); dummy.scale.setScalar(pr.size); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); projMesh.setMatrixAt(n, dummy.matrix); projMesh.setColorAt(n, tc.set(pr.c2 === '#000' ? pr.color : pr.c2).lerp(tc.clone().set('#fff'), 0.35)); n++; }
    projMesh.count = n; projMesh.instanceMatrix.needsUpdate = true; if (projMesh.instanceColor) projMesh.instanceColor.needsUpdate = true;
  }
}
