import * as THREE from 'three';
const V3 = THREE.Vector3;
type V3 = THREE.Vector3;
const PI = Math.PI;

// ---------- caches ----------
const geoC = new Map<string, THREE.BufferGeometry>();
const geo = (k: string, f: () => THREE.BufferGeometry) => { let g = geoC.get(k); if (!g) { g = f(); geoC.set(k, g); } return g; };
export const GB = (w: number, h: number, d: number) => geo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
export const GC = (rt: number, rb: number, h: number, s = 8) => geo(`c${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const GS = (r: number, ws = 12, hs = 9) => geo(`s${r}_${ws}_${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const GK = (r: number, h: number, s = 8) => geo(`k${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));
export const GT = (r: number, t: number, ts = 8, rs = 18, arc = PI * 2) => geo(`t${r}_${t}_${ts}_${rs}_${arc}`, () => new THREE.TorusGeometry(r, t, ts, rs, arc));
export const GO = (r: number) => geo(`o${r}`, () => new THREE.OctahedronGeometry(r));
const matC = new Map<string, THREE.MeshStandardMaterial>();
export interface MO { em?: string; ei?: number; metal?: number; rough?: number; tr?: number; add?: boolean; side?: THREE.Side }
export function M(color: string, o: MO = {}) {
  const k = `${color}|${o.em}|${o.ei}|${o.metal}|${o.rough}|${o.tr}|${o.add}|${o.side}`; let m = matC.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: o.em ?? '#000000', emissiveIntensity: o.ei ?? 1, metalness: o.metal ?? 0.25, roughness: o.rough ?? 0.65, transparent: !!o.tr, opacity: o.tr ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: !o.tr, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    matC.set(k, m);
  }
  return m;
}
export const glowM = (c: string, ei = 2) => M(c, { em: c, ei, rough: 0.4, metal: 0 });
export function mk(p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, role?: string, rot?: [number, number, number], sc?: [number, number, number]) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); if (rot) o.rotation.set(rot[0], rot[1], rot[2]); if (sc) o.scale.set(sc[0], sc[1], sc[2]); if (role) o.userData.role = role; p.add(o); return o;
}
const grp = (p: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };

function polyGeo(pts: [number, number][], key: string) {
  return geo('poly' + key, () => {
    let cx = 0, cy = 0; pts.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length; const v: number[] = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; v.push(cx, cy, 0, a[0], a[1], 0, b[0], b[1], 0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
  });
}
function bone(p: THREE.Object3D, a: [number, number], b: [number, number], r: number, m: THREE.Material) {
  const d = new V3(b[0] - a[0], b[1] - a[1], 0); const len = d.length(); const o = new THREE.Mesh(GC(r, r * 0.6, 1, 5), m);
  o.scale.y = len; o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); p.add(o); return o;
}
const DEMON_PTS: [number, number][] = [[0, 0.1], [0.9, 1.0], [1.9, 0.75], [1.85, 0.1], [1.45, -0.55], [1.0, -0.95], [0.45, -0.55], [0.1, -0.2]];
const ANGEL_PTS: [number, number][] = [[0, 0.2], [0.6, 0.9], [1.5, 1.4], [2.3, 1.2], [2.6, 0.5], [2.4, -0.2], [1.9, -0.8], [1.2, -1.0], [0.5, -0.7], [0.1, -0.3]];
export function makeWing(kind: string, c1: string, c2: string, size = 1, detail = 1) {
  const g = new THREE.Group();
  if (kind === 'angel') {
    [[1, 1, '#ffffff'], [0.82, 0.8, c1], [0.62, 0.6, '#fff8e0']].forEach(([s, h, c], i) => {
      const m = M(c as string, { rough: 0.5, metal: 0, side: THREE.DoubleSide, em: c1, ei: 0.35 });
      const o = new THREE.Mesh(polyGeo(ANGEL_PTS, 'a'), m); o.scale.set((s as number) * size, (h as number) * size, 1); o.position.z = -i * 0.02; g.add(o);
    });
  } else {
    const mem = M(c1, { rough: 0.8, metal: 0, side: THREE.DoubleSide, em: c1, ei: 0.25 });
    const o = new THREE.Mesh(polyGeo(DEMON_PTS, 'd'), mem); o.scale.set(size, size, 1); g.add(o);
    const bm = M(c2, { metal: 0.5, rough: 0.4 });
    const P = DEMON_PTS.map((p) => [p[0] * size, p[1] * size] as [number, number]);
    bone(g, [0, 0], P[1], 0.05 * size, bm); bone(g, P[1], P[2], 0.04 * size, bm);
    if (detail) { bone(g, P[1], P[3], 0.03 * size, bm); bone(g, P[1], P[4], 0.03 * size, bm); bone(g, P[1], P[5], 0.03 * size, bm); }
  }
  return g;
}
function hornChain(parent: THREE.Object3D, side: number, len: number, curl: number, thick: number, color: string, ram = false, segs = 5) {
  const m = M(color, { metal: 0.3, rough: 0.5 }); const g = grp(parent); const p = new V3();
  for (let i = 0; i < segs; i++) {
    const t = i / segs, t2 = (i + 1) / segs; let d: V3;
    if (ram) { const a = t * PI * 1.7; d = new V3(side * Math.cos(a), 0.12 - Math.sin(a) * 0.25, -Math.sin(a)); }
    else d = new V3(side * 0.55 * (1 - t * 0.5), Math.cos(curl * t), -Math.sin(curl * t));
    d.normalize(); const L = len / segs; const o = new THREE.Mesh(GC(thick * (1 - t2 * 0.92), thick * (1 - t * 0.92), L, 6), m);
    o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d); o.position.copy(p).addScaledVector(d, L / 2); g.add(o); p.addScaledVector(d, L);
  }
  return g;
}

// ---------- weapons ----------
export function makeWeapon(type: string, c: string, c2: string, hi = true) {
  const g = new THREE.Group(); const blade = M(c2, { metal: 0.9, rough: 0.2 }), edge = glowM(c, 2.2), hilt = M('#1a1a22', { metal: 0.6 }), gold = M('#c8a040', { metal: 0.9, rough: 0.25 });
  if (type === 'sword' || type === 'dual') {
    const s = type === 'dual' ? 0.75 : 1;
    mk(g, GC(0.025, 0.025, 0.28, 6), hilt, 0, 0.0, 0); mk(g, GB(0.3 * s, 0.045, 0.07), gold, 0, 0.16, 0); mk(g, GS(0.04, 8, 6), edge, 0, -0.16, 0);
    mk(g, GB(0.11 * s, 1.25 * s, 0.03), blade, 0, 0.8 * s, 0); mk(g, GK(0.055 * s, 0.25 * s, 4), blade, 0, 1.55 * s, 0, undefined, [0, PI / 4, 0], [1, 1, 0.3]);
    mk(g, GB(0.025 * s, 1.3 * s, 0.045), edge, 0, 0.82 * s, 0);
  } else if (type === 'greatsword') {
    mk(g, GC(0.03, 0.03, 0.5, 6), hilt, 0, 0.05, 0); mk(g, GB(0.5, 0.07, 0.1), gold, 0, 0.3, 0); mk(g, GS(0.06, 8, 6), edge, 0, -0.22, 0);
    mk(g, GB(0.26, 1.7, 0.05), blade, 0, 1.2, 0); mk(g, GK(0.18, 0.4, 4), blade, 0, 2.25, 0, undefined, [0, PI / 4, 0], [1, 1, 0.3]); mk(g, GB(0.06, 1.65, 0.07), edge, 0, 1.2, 0);
    if (hi) { mk(g, GB(0.4, 0.05, 0.06), edge, 0, 0.7, 0); }
  } else if (type === 'spear') {
    mk(g, GC(0.035, 0.035, 2.6, 6), M('#2a1a12', { metal: 0.3 }), 0, 0.7, 0); mk(g, GK(0.11, 0.7, 4), blade, 0, 2.3, 0, undefined, [0, PI / 4, 0], [1, 1, 0.35]); mk(g, GB(0.03, 0.6, 0.05), edge, 0, 2.3, 0);
    mk(g, GB(0.4, 0.05, 0.05), gold, 0, 2.0, 0); mk(g, GK(0.1, 0.3, 5), blade, 0.18, 2.1, 0, undefined, [0, 0, -0.5]); mk(g, GK(0.1, 0.3, 5), blade, -0.18, 2.1, 0, undefined, [0, 0, 0.5]);
  } else if (type === 'staff') {
    mk(g, GC(0.04, 0.045, 2.1, 6), M('#241830', { metal: 0.5 }), 0, 0.6, 0); mk(g, GS(0.17, 12, 10), glowM(c, 2.4), 0, 1.8, 0); mk(g, GT(0.24, 0.025, 6, 16), gold, 0, 1.8, 0, undefined, [PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; mk(g, GK(0.04, 0.35, 5), gold, Math.cos(a) * 0.2, 1.65, Math.sin(a) * 0.2, undefined, [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]); }
  } else if (type === 'bow') {
    mk(g, GT(0.55, 0.025, 5, 14, PI), M('#5a3a1a'), 0, 0.5, 0, undefined, [0, 0, -PI / 2]); mk(g, GC(0.004, 0.004, 1.1, 3), M('#e8e0c0'), 0, 0.5, 0);
  } else if (type === 'club') {
    mk(g, GC(0.05, 0.05, 0.5, 6), hilt, 0, 0.1, 0); mk(g, GC(0.14, 0.07, 0.6, 6), M('#2a1a12', { rough: 0.9 }), 0, 0.6, 0); mk(g, GS(0.1, 6, 5), edge, 0, 0.9, 0);
  }
  return g;
}

// ---------- humanoid ----------
export interface Cfg { skin?: string; armor?: string; trim?: string; cloth?: string; glow?: string; horns?: string; hornColor?: string; wings?: string; cape?: boolean; hood?: boolean; helm?: string; weapon?: string; shield?: boolean; bulk?: number; tail?: boolean; hair?: string; hairColor?: string; halo?: boolean; crystals?: boolean; wingColor?: string; capeColor?: string; royal?: boolean; formWings?: boolean; rings?: boolean }
export interface Pose { by: number; lean: number; twist: number; hdx: number; hdy: number; lsf: number; lso: number; lel: number; rsf: number; rso: number; rel: number; lhf: number; lkb: number; rhf: number; rkb: number; wing: number; rp: number; rr: number; ry: number }
export interface Rig {
  root: THREE.Group; hips: THREE.Group; spine: THREE.Group; head: THREE.Group; shL: THREE.Group; elL: THREE.Group; shR: THREE.Group; elR: THREE.Group; hpL: THREE.Group; knL: THREE.Group; hpR: THREE.Group; knR: THREE.Group;
  handR: THREE.Group; handL: THREE.Group; cape: THREE.Group[]; wingL: THREE.Group | null; wingR: THREE.Group | null; tail: THREE.Group[]; hornG: THREE.Group; glowMats: THREE.MeshStandardMaterial[]; weapon: THREE.Group | null; weapon2: THREE.Group | null;
  pose: Pose; cfg: Cfg; scale: number; aura: THREE.Mesh | null; rings: THREE.Mesh[]; gem: THREE.Mesh | null; mantle: THREE.Group | null; hi: boolean; wtype: string; flap: number; form: number; hits: number;
}
const POSE_KEYS: (keyof Pose)[] = ['by', 'lean', 'twist', 'hdx', 'hdy', 'lsf', 'lso', 'lel', 'rsf', 'rso', 'rel', 'lhf', 'lkb', 'rhf', 'rkb', 'wing', 'rp', 'rr', 'ry'];
const newPose = (): Pose => ({ by: 0, lean: 0, twist: 0, hdx: 0, hdy: 0, lsf: 0, lso: 0.1, lel: 0.2, rsf: 0, rso: 0.1, rel: 0.2, lhf: 0, lkb: 0, rhf: 0, rkb: 0, wing: 0, rp: 0, rr: 0, ry: 0 });

export function buildHumanoid(cfg: Cfg, detail = 0, scale = 1): Rig {
  const hi = detail > 0; const b = cfg.bulk ?? 1; const skin = cfg.skin ?? '#c8a080', armor = cfg.armor ?? '#444', trim = cfg.trim ?? '#aaa', cloth = cfg.cloth ?? '#333', glow = cfg.glow ?? '#000000';
  const hasGlow = glow !== '#000000'; const glowMats: THREE.MeshStandardMaterial[] = [];
  const skinM = M(skin, { rough: 0.7, metal: 0 }), armorM = M(armor, { metal: 0.7, rough: 0.35 }), trimM = M(trim, { metal: 0.8, rough: 0.3 }), clothM = M(cloth, { rough: 0.9, metal: 0, side: THREE.DoubleSide });
  const eyeM = hasGlow ? glowM(glow, 3) : M('#1a1a1a'); if (hasGlow) glowMats.push(eyeM);
  const root = new THREE.Group(); const hips = grp(root, 0, 1.0, 0);
  const side = (s: number) => {
    const hp = grp(hips, s * 0.15 * b, -0.02, 0); const kn = grp(hp, 0, -0.5, 0);
    mk(hp, GB(0.2 * b, 0.5, 0.22 * b), hi ? clothM : armorM, 0, -0.25, 0, hi ? undefined : 'armor');
    mk(kn, GB(0.17 * b, 0.48, 0.19 * b), armorM, 0, -0.25, 0, 'armor'); mk(kn, GB(0.2 * b, 0.12, 0.34 * b), trimM, 0, -0.48, 0.06, 'trim');
    if (hi) { mk(kn, GS(0.09 * b, 8, 6), trimM, 0, 0, 0.1, 'trim'); mk(kn, GB(0.15 * b, 0.3, 0.04), trimM, 0, -0.22, 0.1, 'trim'); mk(hp, GB(0.22 * b, 0.1, 0.24 * b), armorM, 0, -0.02, 0, 'armor'); mk(kn, GK(0.04, 0.12, 5), trimM, 0, 0.02, 0.18, 'trim', [PI / 2, 0, 0]); }
    return { hp, kn };
  };
  const R = side(-1), L = side(1);
  const spine = grp(hips, 0, 0.05, 0);
  mk(spine, GB(0.34 * b, 0.28, 0.22 * b), hi ? clothM : armorM, 0, 0.15, 0); mk(spine, GB(0.5 * b, 0.4, 0.3 * b), armorM, 0, 0.5, 0, 'armor'); mk(spine, GB(0.4 * b, 0.07, 0.26 * b), trimM, 0, 0.03, 0, 'trim');
  let gem: THREE.Mesh | null = null;
  if (hi) {
    mk(spine, GB(0.36 * b, 0.26, 0.04), trimM, 0, 0.52, 0.16 * b, 'trim'); gem = mk(spine, GS(0.045, 8, 6), hasGlow ? glowM(glow, 2.5) : glowM(trim, 1.2), 0, 0.52, 0.19 * b); if (hasGlow) glowMats.push(gem.material as THREE.MeshStandardMaterial);
    mk(spine, GB(0.1, 0.1, 0.04), trimM, 0, 0.03, 0.14 * b, 'trim'); mk(spine, GB(0.22 * b, 0.36, 0.03), clothM, 0, -0.2, 0.13 * b);
    mk(spine, GB(0.22 * b, 0.36, 0.03), clothM, 0, -0.2, -0.13 * b);
    for (const s of [-1, 1]) { mk(spine, GB(0.1, 0.3, 0.2), armorM, s * 0.22 * b, -0.14, 0, 'armor', [0, 0, s * 0.15]); mk(spine, GB(0.08, 0.04, 0.3 * b), trimM, s * 0.14 * b, 0.35, 0.01, 'trim'); }
    mk(spine, GB(0.06, 0.4, 0.04), trimM, 0, 0.5, -0.16 * b, 'trim');
  }
  mk(spine, GC(0.06, 0.07, 0.12, 6), skinM, 0, 0.73, 0);
  const sw = 0.3 * b + 0.05;
  const arm = (s: number) => {
    const sh = grp(spine, s * sw, 0.62, 0); const el = grp(sh, 0, -0.34, 0);
    mk(sh, GB(0.13 * b, 0.34, 0.14 * b), clothM, 0, -0.17, 0); mk(sh, GS(0.15 * b, 10, 7), armorM, 0, 0.04, 0, 'armor', undefined, [1.1, 0.7, 1.1]);
    mk(el, GB(0.12 * b, 0.32, 0.13 * b), armorM, 0, -0.16, 0, 'armor'); mk(el, GB(0.14 * b, 0.08, 0.15 * b), trimM, 0, -0.28, 0, 'trim'); mk(el, GB(0.1, 0.1, 0.1), skinM, 0, -0.38, 0);
    if (hi) { mk(sh, GB(0.2 * b, 0.05, 0.2 * b), trimM, 0, 0.1, 0, 'trim', [0, 0, s * 0.3]); mk(el, GS(0.07 * b, 7, 5), trimM, 0, 0.0, -0.06, 'trim'); mk(sh, GK(0.05 * b, 0.22, 5), trimM, s * 0.1, 0.17, 0, 'trim', [0, 0, -s * 0.5]); mk(sh, GK(0.04 * b, 0.16, 5), trimM, s * 0.02, 0.2, -0.06, 'trim', [-0.5, 0, -s * 0.2]); }
    else if (b > 1.4) mk(sh, GS(0.2 * b, 6, 5), armorM, 0, 0.06, 0, 'armor', undefined, [1, 0.8, 1]);
    const hand = grp(el, 0, -0.4, 0); hand.rotation.x = 1.2;
    return { sh, el, hand };
  };
  const aR = arm(-1), aL = arm(1);
  if (cfg.shield) { const sg = grp(aL.el, 0.16 * b, -0.18, 0.05); mk(sg, GC(0.34, 0.34, 0.05, 10), armorM, 0, 0, 0, 'armor', [0, 0, PI / 2], undefined).rotation.set(0, 0, PI / 2); sg.rotation.y = 0; mk(sg, GC(0.14, 0.14, 0.07, 8), trimM, 0.01, 0, 0, 'trim', [0, 0, PI / 2]); const rim = mk(sg, GT(0.34, 0.025, 5, 14), trimM, 0.03, 0, 0, 'trim'); rim.rotation.y = PI / 2; }
  const head = grp(spine, 0, 0.78, 0);
  const isSkull = cfg.helm === 'skull';
  mk(head, GS(0.14, 12, 10), isSkull ? M(skin, { rough: 0.9, metal: 0 }) : skinM, 0, 0.14, 0, undefined, undefined, [0.95, 1.08, 1]);
  mk(head, GB(0.11, 0.05, 0.1), isSkull ? M(skin, { rough: 0.9 }) : skinM, 0, 0.03, 0.06);
  for (const s of [-1, 1]) {
    mk(head, GB(0.055, 0.02, 0.02), eyeM, s * 0.055, 0.17, 0.125, undefined, [0, 0, -s * 0.3]);
    if (hi && !isSkull) { mk(head, GB(0.07, 0.015, 0.02), M('#111', { rough: 1 }), s * 0.058, 0.205, 0.125, undefined, [0, 0, -s * 0.35]); if (hasGlow) mk(head, GK(0.025, 0.12, 4), skinM, s * 0.15, 0.17, 0, undefined, [0, 0, -s * 1.3]); }
  }
  if (hi && !isSkull) mk(head, GB(0.06, 0.012, 0.02), M('#200', { rough: 1 }), 0, 0.07, 0.135);
  if (isSkull) { mk(head, GB(0.1, 0.05, 0.02), M('#111'), 0, 0.17, 0.13); mk(head, GB(0.1, 0.06, 0.02), M('#ddd'), 0, 0.06, 0.12); }
  const hornG = grp(head, 0, 0.2, 0);
  const hc = cfg.hornColor ?? '#222';
  if (cfg.horns === 'demon') for (const s of [-1, 1]) hornChain(hornG, s, 0.5, 1.5, 0.045, hc, false, hi ? 6 : 3).position.set(s * 0.08, 0.04, 0);
  else if (cfg.horns === 'long') for (const s of [-1, 1]) hornChain(hornG, s, 0.75, 1.9, 0.04, hc, false, hi ? 6 : 3).position.set(s * 0.09, 0.04, -0.02);
  else if (cfg.horns === 'ram') for (const s of [-1, 1]) hornChain(hornG, s, 0.7, 0, 0.055, hc, true, hi ? 7 : 4).position.set(s * 0.12, 0.0, 0.0);
  else if (cfg.horns === 'crown') for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; mk(hornG, GK(0.03, 0.14 + (i % 2) * 0.06, 5), M(hc, { metal: 0.5, em: hc, ei: 0.4 }), Math.cos(a) * 0.13, 0.04, Math.sin(a) * 0.13, undefined, [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]); }
  const hh = cfg.helm;
  if (hh && hh !== 'skull' && hh !== 'none') {
    mk(head, GS(0.16, 10, 8), armorM, 0, 0.16, -0.005, 'armor', undefined, [1, 1.05, 1.02]); mk(head, GB(0.2, 0.03, 0.02), M('#050505'), 0, 0.17, 0.15); mk(head, GB(0.04, 0.12, 0.02), trimM, 0, 0.14, 0.158, 'trim');
    if (hh === 'crest') mk(head, GB(0.03, 0.16, 0.34), trimM, 0, 0.3, -0.02, 'trim', [0.1, 0, 0]);
    if (hh === 'horned') for (const s of [-1, 1]) mk(head, GK(0.04, 0.2, 5), trimM, s * 0.15, 0.27, 0, 'trim', [0, 0, -s * 0.6]);
    if (hh === 'knight') mk(head, GB(0.03, 0.06, 0.2), M(cfg.cloth ?? '#a00'), 0, 0.33, -0.02);
  }
  if (cfg.hair === 'flame') for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; const c = cfg.hairColor ?? '#f80'; const m = glowM(c, 1.8); glowMats.push(m); mk(head, GK(0.05, 0.22 + (i % 3) * 0.07, 5), m, Math.cos(a) * 0.08, 0.3, Math.sin(a) * 0.08, undefined, [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]); }
  if (cfg.hair === 'long') { const hm = M(cfg.hairColor ?? '#111', { rough: 0.5, metal: 0.2 }); mk(head, GS(0.15, 10, 8), hm, 0, 0.19, -0.025, undefined, undefined, [1, 0.95, 1]); mk(head, GB(0.3, 0.6, 0.07), hm, 0, -0.1, -0.13, undefined, [0.1, 0, 0]); if (hi) for (const s of [-1, 1]) mk(head, GB(0.04, 0.3, 0.04), hm, s * 0.13, 0.05, 0.06); }
  if (cfg.hood) { const hm = M(cloth, { rough: 0.95, metal: 0, side: THREE.DoubleSide }); mk(head, GS(0.2, 10, 8), hm, 0, 0.16, -0.02, undefined, undefined, [1, 1.1, 1.1]); mk(head, GB(0.17, 0.15, 0.06), M('#050508', { rough: 1 }), 0, 0.15, 0.115); mk(head, GK(0.12, 0.2, 6), hm, 0, 0.12, -0.18, undefined, [-1.4, 0, 0]); mk(head, GB(0.055, 0.02, 0.02), eyeM, -0.055, 0.17, 0.15); mk(head, GB(0.055, 0.02, 0.02), eyeM, 0.055, 0.17, 0.15); }
  if (cfg.royal) {
    const gm = M('#1a1018', { metal: 0.7 }); for (const s of [-1, 1]) mk(spine, GB(0.18, 0.42, 0.04), gm, s * 0.13, 0.82, -0.14, 'armor', [0.25, s * 0.2, s * 0.15]);
    for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; mk(head, GK(0.025, 0.1 + (i === 2 ? 0.08 : 0), 4), trimM, Math.sin(a) * 0.14, 0.31, Math.cos(a) * 0.1 - 0.02, 'trim'); }
  }
  if (cfg.halo) { const hm = glowM('#ffe680', 2.5); glowMats.push(hm); mk(head, GT(0.26, 0.018, 6, 22), hm, 0, 0.5, -0.04, undefined, [PI / 2, 0, 0]); }
  if (cfg.crystals) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) mk(spine, GK(0.07, 0.35 + i * 0.1, 5), glowM('#aeeaff', 1.4), s * (0.35 * b + i * 0.05), 0.75 + i * 0.05, -0.05 + i * 0.05, undefined, [0.2 * i, 0, -s * (0.4 + i * 0.2)]);
  // cape
  const cape: THREE.Group[] = [];
  if (cfg.cape) {
    const cc = cfg.capeColor ?? cloth; const cm = M(cc, { rough: 0.85, metal: 0, side: THREE.DoubleSide });
    let par: THREE.Object3D = grp(spine, 0, 0.7, -0.17 * b);
    for (let i = 0; i < 6; i++) { const seg = grp(par, 0, i === 0 ? 0 : -0.3, 0); const w = (0.5 + i * 0.1) * b; mk(seg, GB(w, 0.32, 0.025), i === 5 ? M(trim, { metal: 0.6 }) : cm, 0, -0.16, 0, i === 5 ? 'trim' : undefined); if (i === 5 || i === 0) mk(seg, GB(w + 0.02, 0.03, 0.03), trimM, 0, i === 0 ? -0.01 : -0.32, 0, 'trim'); cape.push(seg); par = seg; }
  }
  // wings
  let wingL: THREE.Group | null = null, wingR: THREE.Group | null = null;
  if (cfg.wings) {
    const mkW = (s: number) => { const pv = grp(spine, s * 0.1, 0.55, -0.2); const w = makeWing(cfg.wings!, cfg.wingColor ?? '#400', trim, cfg.formWings ? 1.5 : 0.8 * Math.max(1, b * 0.7), hi ? 1 : 0); w.scale.x = -s; pv.add(w); return pv; };
    wingR = mkW(-1); wingL = mkW(1); wingL.rotation.y = 0; if (cfg.formWings) { wingL.visible = false; wingR.visible = false; }
  }
  const tail: THREE.Group[] = [];
  if (cfg.tail) { let par: THREE.Object3D = grp(hips, 0, -0.05, -0.12); for (let i = 0; i < 5; i++) { const s = grp(par, 0, 0, i === 0 ? 0 : -0.22); mk(s, GC(0.045 - i * 0.007, 0.05 - i * 0.007, 0.24, 5), skinM, 0, 0, -0.1, undefined, [PI / 2, 0, 0]); tail.push(s); par = s; } mk(par as THREE.Object3D, GK(0.05, 0.16, 4), trimM, 0, 0, -0.3, 'trim', [-PI / 2, 0, 0]); }
  let aura: THREE.Mesh | null = null;
  if (cfg.formWings || cfg.royal) { aura = mk(root, GS(1, 14, 10), M(glow === '#000000' ? '#ff2040' : glow, { add: true, tr: 0.1, side: THREE.BackSide, em: glow === '#000000' ? '#ff2040' : glow, ei: 1 }), 0, 1.2, 0, undefined, undefined, [1.2, 1.7, 1.2]); aura.visible = false; }
  const rings: THREE.Mesh[] = []; let mantle: THREE.Group | null = null;
  if (hi && cfg.rings) {
    for (let i = 0; i < 2; i++) { const r = mk(aL.el, GT(0.055, 0.012, 5, 10), glowM('#ffd24a', 1.5), 0, -0.4 + i * 0.045, 0, undefined, [PI / 2, 0, 0]); r.visible = false; rings.push(r); }
    mantle = grp(spine, 0, 0.7, 0); mantle.visible = false; for (const s of [-1, 1]) for (let i = 0; i < 5; i++) mk(mantle, GK(0.06, 0.28, 4), M('#e8c24a', { metal: 0.9, rough: 0.25, em: '#e8c24a', ei: 0.3 }), s * (0.18 + i * 0.07), 0.12 - i * 0.02, 0, undefined, [0, 0, -s * (0.9 + i * 0.1)]);
  }
  const rig: Rig = { root, hips, spine, head, shL: aL.sh, elL: aL.el, shR: aR.sh, elR: aR.el, hpL: L.hp, knL: L.kn, hpR: R.hp, knR: R.kn, handR: aR.hand, handL: aL.hand, cape, wingL, wingR, tail, hornG, glowMats, weapon: null, weapon2: null, pose: newPose(), cfg, scale, aura, rings, gem, mantle, hi, wtype: cfg.weapon ?? 'none', flap: 0, form: 0, hits: 0 };
  if (cfg.weapon && cfg.weapon !== 'none') setWeapon(rig, cfg.weapon, cfg.trim ?? '#ccc', '#222233');
  root.scale.setScalar(scale);
  if (hi) root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return rig;
}

export function setWeapon(rig: Rig, type: string, c: string, c2: string) {
  if (rig.weapon) { rig.handR.remove(rig.weapon); rig.weapon = null; }
  if (rig.weapon2) { rig.handL.remove(rig.weapon2); rig.weapon2 = null; }
  rig.wtype = type; if (type === 'none') return;
  const w = makeWeapon(type, c, c2, rig.hi); rig.handR.add(w); rig.weapon = w; rig.handR.rotation.x = type === 'spear' || type === 'staff' || type === 'bow' ? 0.6 : type === 'greatsword' ? 1.1 : 1.25;
  if (type === 'dual') { const w2 = makeWeapon('dual', c, c2, rig.hi); rig.handL.add(w2); rig.weapon2 = w2; rig.handL.rotation.x = 1.25; }
  if (rig.hi) w.traverse((o) => { o.castShadow = true; });
}
export function recolorArmor(rig: Rig, armor: string, trim: string) {
  rig.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; if (m.userData.role === 'armor') m.material = M(armor, { metal: 0.7, rough: 0.35 }); else if (m.userData.role === 'trim') m.material = M(trim, { metal: 0.8, rough: 0.3 }); });
}
export function setForm(rig: Rig, on: boolean) {
  rig.form = on ? 1 : 0; rig.hornG.scale.setScalar(on ? 1.8 : 1); if (rig.wingL) { rig.wingL.visible = on || !rig.cfg.formWings; rig.wingR!.visible = rig.wingL.visible; }
  if (rig.aura) rig.aura.visible = on; for (const m of rig.glowMats) m.emissiveIntensity = on ? 6 : 3;
}

// ---------- animation ----------
export type Anim = 'idle' | 'walk' | 'run' | 'sprint' | 'jump' | 'fall' | 'land' | 'dodge' | 'atk1' | 'atk2' | 'atk3' | 'heavy' | 'cast' | 'flyIdle' | 'fly' | 'takeoff' | 'flyLand' | 'transform' | 'ultimate' | 'victory' | 'intimidate' | 'hit' | 'die' | 'swim' | 'charge' | 'slam' | 'aerial' | 'flurry' | 'thrust' | 'bow' | 'council';
function kf(p: number, ...a: number[]) {
  if (p <= a[0]) return a[1];
  for (let i = 2; i < a.length; i += 2) if (p <= a[i]) { const u = (p - a[i - 2]) / (a[i] - a[i - 2]); const e = u * u * (3 - 2 * u); return a[i - 1] + (a[i + 1] - a[i - 1]) * e; }
  return a[a.length - 1];
}
const TG = newPose();
export function animateRig(rig: Rig, anim: Anim, t: number, sp: number, p: number, dt: number, speedMul = 1) {
  const T = TG; const d = newPose(); Object.assign(T, d); T.lsf = 0.05; T.rsf = 0.05; T.lean = 0.02;
  const ws = rig.wtype; const two = ws === 'greatsword' || ws === 'staff' || ws === 'spear';
  let snap = 12;
  switch (anim) {
    case 'idle': {
      const b = Math.sin(t * 1.7);
      T.by = b * 0.012; T.lean = -0.03 + b * 0.015; T.hdx = -0.04; T.hdy = Math.sin(t * 0.5) * 0.12; T.rsf = 0.25; T.rel = 0.55; T.rso = 0.05; T.lsf = 0.0; T.lso = 0.55; T.lel = 1.35; T.lkb = 0.05; T.rkb = 0.08; T.rhf = 0.06; T.lhf = -0.04; T.wing = 0.05 + b * 0.03; T.twist = 0.06; break;
    }
    case 'council': { T.rsf = 0.1; T.rel = 0.3; T.lsf = 0.1; T.lel = 0.3; T.hdy = Math.sin(t * 0.7) * 0.2; T.lean = -0.02; break; }
    case 'walk': case 'run': case 'sprint': {
      const ph = t * (anim === 'walk' ? 7 : anim === 'run' ? 10 : 12.5) * speedMul; let A = anim === 'walk' ? 0.55 : anim === 'run' ? 0.95 : 1.2; A *= 0.7 + 0.3 * sp;
      const s = Math.sin(ph);
      T.lhf = s * A; T.rhf = -s * A; T.lkb = (0.15 + 0.85 * Math.max(0, Math.sin(ph + 1.9))) * A * 1.25; T.rkb = (0.15 + 0.85 * Math.max(0, Math.sin(ph + 1.9 + PI))) * A * 1.25;
      T.lsf = -s * A * 0.9; T.rsf = two ? 0.5 + s * A * 0.2 : s * A * 0.55 + (anim === 'sprint' ? -0.35 : 0.1); T.lel = 0.45 + A * 0.55; T.rel = 0.6 + A * 0.4; T.lso = 0.12; T.rso = 0.12;
      T.lean = anim === 'walk' ? 0.07 : anim === 'run' ? 0.2 : 0.42; T.by = -Math.abs(Math.cos(ph)) * 0.07 * A + 0.02 - A * 0.02; T.twist = s * 0.18 * A; T.hdx = -T.lean * 0.7; T.wing = 0.15 + Math.abs(s) * 0.1; snap = 18;
      if (anim === 'sprint') { T.rsf = -0.5 + s * 0.2; T.lsf = -0.5 - s * 0.2; T.lso = 0.05; T.rso = 0.05; }
      break;
    }
    case 'jump': T.lhf = 0.5; T.lkb = 0.9; T.rhf = -0.25; T.rkb = 0.5; T.lsf = 0.3; T.lso = 1.1; T.rsf = 0.3; T.rso = 1.1; T.lel = 0.3; T.rel = 0.3; T.by = 0.05; T.lean = 0.05; T.wing = 0.6; snap = 16; break;
    case 'fall': T.lhf = 0.35; T.lkb = 0.4; T.rhf = -0.15; T.rkb = 0.3; T.lsf = 1.0; T.lso = 1.0; T.rsf = 1.0; T.rso = 1.0; T.lean = 0.1; T.wing = Math.sin(t * 9) * 0.3 + 0.2; break;
    case 'land': { const k = kf(p, 0, 1, 0.5, 0.5, 1, 0); T.by = -0.4 * k; T.lhf = 0.5 * k; T.rhf = 0.5 * k; T.lkb = 1.5 * k; T.rkb = 1.5 * k; T.lean = 0.35 * k; T.lsf = 0.4; T.rsf = 0.4; T.lso = 0.8 * k; T.rso = 0.8 * k; snap = 22; break; }
    case 'dodge': { T.rp = p * PI * 2 * (sp >= 0 ? 1 : -1) * 0.9; T.by = -0.2; T.lkb = 1.2; T.rkb = 1.2; T.lhf = 0.9; T.rhf = 0.9; T.lsf = 1.6; T.rsf = 1.6; T.lso = 0.3; T.rso = 0.3; T.lean = 0.5; snap = 30; break; }
    case 'atk1': {
      T.rsf = kf(p, 0, 0.3, 0.25, 2.6, 0.5, 0.7, 1, 0.3); T.rso = kf(p, 0, 0.1, 0.25, 0.6, 0.5, 0.0, 1, 0.1); T.rel = kf(p, 0, 0.6, 0.25, 0.4, 0.5, 0.2, 1, 0.5); T.twist = kf(p, 0, 0, 0.25, 0.8, 0.5, -0.8, 1, 0); T.lean = kf(p, 0, 0.1, 0.25, -0.15, 0.5, 0.4, 1, 0.1);
      T.lhf = kf(p, 0, 0, 0.3, -0.3, 0.5, 0.7, 1, 0); T.rhf = kf(p, 0, 0, 0.3, 0.3, 0.5, -0.5, 1, 0); T.lkb = 0.3; T.rkb = kf(p, 0, 0.1, 0.5, 0.6, 1, 0.1); T.lsf = kf(p, 0, 0.3, 0.3, -0.6, 0.5, 0.9, 1, 0.2); T.lso = 0.8; T.by = kf(p, 0, 0, 0.5, -0.12, 1, 0); if (two) T.lsf = T.rsf, T.lso = 0.1; snap = 28; break;
    }
    case 'atk2': {
      T.rsf = kf(p, 0, 0.3, 0.25, 1.4, 0.5, 1.2, 1, 0.3); T.rso = kf(p, 0, 0.2, 0.25, 1.9, 0.5, -0.2, 1, 0.1); T.rel = kf(p, 0, 0.6, 0.25, 0.3, 0.5, 0.1, 1, 0.5); T.twist = kf(p, 0, 0, 0.25, -1.0, 0.5, 1.0, 1, 0); T.lean = kf(p, 0, 0.1, 0.5, 0.35, 1, 0.1);
      T.lhf = kf(p, 0, 0, 0.5, -0.5, 1, 0); T.rhf = kf(p, 0, 0, 0.5, 0.6, 1, 0); T.lkb = 0.2; T.rkb = 0.5; T.lsf = kf(p, 0, 0.3, 0.3, 0.2, 0.5, -0.3, 1, 0.2); T.lso = 0.9; T.by = -0.08; if (two) T.lsf = T.rsf, T.lso = 0.1; snap = 28; break;
    }
    case 'atk3': case 'heavy': {
      const H = anim === 'heavy'; T.rsf = kf(p, 0, 0.3, H ? 0.45 : 0.3, 3.0, H ? 0.6 : 0.5, 0.2, 1, 0.3); T.lsf = T.rsf; T.rso = 0.1; T.lso = 0.1; T.rel = kf(p, 0, 0.6, 0.3, 0.3, 0.5, 0.1, 1, 0.5); T.lel = T.rel;
      T.lean = kf(p, 0, 0, 0.35, -0.25, 0.55, 0.65, 1, 0.1); T.by = kf(p, 0, 0, 0.35, 0.05, 0.55, -0.3, 1, 0); T.lhf = kf(p, 0, 0, 0.4, -0.3, 0.6, 0.9, 1, 0); T.rhf = kf(p, 0, 0, 0.4, 0.2, 0.6, -0.6, 1, 0); T.lkb = 0.4; T.rkb = kf(p, 0, 0.1, 0.6, 0.9, 1, 0.1); T.hdx = 0.1; T.wing = kf(p, 0, 0, 0.4, 1, 1, 0); snap = 26; break;
    }
    case 'thrust': { T.rsf = kf(p, 0, 0.6, 0.3, 0.5, 0.5, 1.5, 1, 0.5); T.rel = kf(p, 0, 1.2, 0.3, 1.4, 0.5, 0.0, 1, 0.5); T.lsf = 1.2; T.lel = 0.8; T.lean = kf(p, 0, 0, 0.3, -0.1, 0.5, 0.55, 1, 0.1); T.lhf = kf(p, 0, 0, 0.5, 0.9, 1, 0); T.rhf = kf(p, 0, 0, 0.5, -0.7, 1, 0); T.rkb = 0.6; T.twist = 0.4; snap = 28; break; }
    case 'bow': { T.lsf = 1.5; T.lel = 0.0; T.rsf = 1.4; T.rel = kf(p, 0, 2, 0.5, 2.4, 1, 1); T.twist = -0.3; T.lean = 0.0; break; }
    case 'aerial': { T.ry = p * PI * 2 * 1.5; T.rso = 1.5; T.lso = 1.5; T.rsf = 0.3; T.lsf = 0.3; T.lhf = 0.4; T.rhf = -0.2; T.lkb = 0.8; T.rkb = 0.8; T.lean = 0.2; snap = 28; break; }
    case 'flurry': { const s = Math.sin(t * 24); T.rsf = 1.2 + s * 1.0; T.rso = 0.5 + Math.cos(t * 24) * 0.7; T.lsf = 1.2 - s * 1.0; T.lso = 0.5 - Math.cos(t * 24) * 0.7; T.twist = s * 0.7; T.lean = 0.4; T.lhf = 0.8; T.rhf = -0.5; T.lkb = 0.5; T.rkb = 0.7; T.by = -0.1; snap = 30; break; }
    case 'cast': T.lsf = kf(p, 0, 0.4, 0.3, 1.6, 1, 1.5); T.rsf = kf(p, 0, 0.4, 0.3, 1.6, 1, 1.5); T.lso = 0.3; T.rso = 0.3; T.lel = 0.1; T.rel = 0.1; T.lean = kf(p, 0, 0, 0.3, -0.12, 0.6, 0.2, 1, 0.05); T.hdx = -0.1; T.lhf = 0.35; T.rhf = -0.2; T.lkb = 0.3; T.rkb = 0.3; T.wing = 0.4; snap = 20; break;
    case 'charge': T.lsf = 1.55; T.rsf = 1.55; T.lso = 0.25; T.rso = 0.25; T.lel = 0.05; T.rel = 0.05; T.lean = -0.1 + Math.sin(t * 40) * 0.015; T.hdx = -0.1; T.lhf = 0.4; T.rhf = -0.4; T.lkb = 0.3; T.rkb = 0.5; T.by = -0.1; T.wing = 0.5; break;
    case 'slam': T.lsf = kf(p, 0, 0.2, 0.4, 3.1, 0.6, 0.2, 1, 0.2); T.rsf = T.lsf; T.lso = 0.2; T.rso = 0.2; T.lean = kf(p, 0, 0, 0.4, -0.3, 0.6, 0.8, 1, 0.1); T.by = kf(p, 0, 0, 0.4, 0.15, 0.6, -0.45, 1, 0); T.lkb = kf(p, 0, 0.2, 0.6, 1.5, 1, 0.2); T.rkb = T.lkb; T.lhf = 0.4; T.rhf = 0.4; snap = 26; break;
    case 'ultimate': { const up = kf(p, 0, 0.3, 0.3, 3.0, 0.75, 3.1, 0.85, 0.4, 1, 0.4); T.lsf = up; T.rsf = up; T.lso = kf(p, 0, 0.1, 0.3, 0.5, 0.8, 0.5, 1, 0.2); T.rso = T.lso; T.hdx = kf(p, 0, 0, 0.3, -0.6, 0.8, -0.6, 1, 0.3); T.by = kf(p, 0, 0, 0.3, 0.25, 0.8, 0.25, 1, -0.2); T.lean = kf(p, 0, 0, 0.3, -0.2, 0.8, -0.2, 0.9, 0.6, 1, 0.3); T.lkb = 0.15; T.rkb = 0.15; T.wing = 1; T.lel = 0.2; T.rel = 0.2; snap = 16; break; }
    case 'transform': { const crouch = kf(p, 0, 0, 0.3, 1, 0.5, 1, 0.6, 0); T.by = -0.3 * crouch + (p > 0.6 ? 0.15 : 0); T.lkb = 1.3 * crouch; T.rkb = 1.3 * crouch; T.lhf = 0.8 * crouch; T.rhf = 0.8 * crouch; T.lsf = kf(p, 0, 0.9, 0.5, 0.9, 0.62, 0.3, 1, 0.3); T.rsf = T.lsf; T.lso = kf(p, 0, -0.4, 0.5, -0.4, 0.62, 1.7, 1, 1.3); T.rso = T.lso; T.lel = kf(p, 0, 1.8, 0.5, 1.8, 0.62, 0, 1, 0.1); T.rel = T.lel; T.hdx = kf(p, 0, 0.3, 0.5, 0.3, 0.62, -0.7, 1, -0.4); T.lean = kf(p, 0, 0.3, 0.5, 0.35, 0.62, -0.3, 1, -0.1); T.twist = Math.sin(t * 40) * 0.05 * (p < 0.6 ? 1 : 0); T.wing = 1; snap = 16; break; }
    case 'victory': T.rsf = 2.9 + Math.sin(t * 3) * 0.1; T.rso = 0.3; T.rel = 0.3; T.lsf = 0.2; T.lso = 0.9; T.lel = 0.9; T.twist = 0.4; T.hdx = -0.3; T.lean = -0.1; T.lhf = 0.2; T.rhf = -0.2; T.wing = 0.4 + Math.sin(t * 2) * 0.3; break;
    case 'intimidate': T.lso = 1.0; T.rso = 1.0; T.lsf = 0.2; T.rsf = 0.2; T.lel = 0.6; T.rel = 0.6; T.hdx = 0.25; T.lean = -0.12; T.by = Math.sin(t * 2) * 0.015; T.lhf = 0.3; T.rhf = -0.3; T.lkb = 0.1; T.rkb = 0.2; T.wing = 0.9 + Math.sin(t * 1.5) * 0.15; break;
    case 'hit': T.lean = -0.4; T.hdx = -0.4; T.by = -0.06; T.lsf = 0.5; T.rsf = 0.5; T.lso = 0.8; T.rso = 0.8; T.lkb = 0.4; T.rkb = 0.2; T.lhf = 0.2; T.rhf = -0.3; snap = 30; break;
    case 'die': { const k = kf(p, 0, 0, 0.6, 1, 1, 1); T.rp = -1.5 * k; T.by = -0.85 * k; T.lsf = 1.2 * k; T.rsf = 0.4 * k; T.lso = 1 * k; T.rso = 1 * k; T.lkb = 0.6 * k; T.rkb = 0.2 * k; T.hdx = -0.3 * k; snap = 8; break; }
    case 'fly': T.rp = 1.25; T.lean = -0.3; T.hdx = -0.6; T.lhf = -0.5; T.rhf = -0.3; T.lkb = 0.4; T.rkb = 0.6; T.lsf = -0.7; T.rsf = ws === 'none' ? -0.7 : -0.4; T.lso = 0.15; T.rso = 0.15; T.lel = 0.1; T.rel = 0.2; T.wing = 0.4 + Math.sin(t * 7) * 0.45; T.by = 0.1; snap = 8; break;
    case 'flyIdle': T.rp = 0.12; T.by = 0.15 + Math.sin(t * 2) * 0.05; T.lhf = 0.15; T.rhf = -0.1; T.lkb = 0.5; T.rkb = 0.7; T.lsf = 0.15; T.rsf = 0.15; T.lso = 0.6; T.rso = 0.6; T.lel = 0.4; T.rel = 0.4; T.wing = Math.sin(t * 3.2) * 0.4 + 0.3; T.hdx = -0.05; break;
    case 'takeoff': T.by = kf(p, 0, -0.3, 0.4, -0.3, 1, 0.2); T.lkb = kf(p, 0, 1.3, 0.4, 1.3, 0.6, 0.2, 1, 0.5); T.rkb = T.lkb; T.lhf = 0.7; T.rhf = 0.7; T.lsf = kf(p, 0, 0.5, 0.4, -0.2, 0.7, 2.8, 1, 2.0); T.rsf = T.lsf; T.lso = 0.6; T.rso = 0.6; T.lean = 0.3; T.wing = kf(p, 0, 0, 0.4, 0, 0.7, 1.3, 1, 0.7); snap = 20; break;
    case 'flyLand': T.by = 0.1; T.lhf = 0.6; T.rhf = 0.4; T.lkb = 0.5; T.rkb = 0.5; T.lsf = 0.2; T.rsf = 0.2; T.lso = 1.2; T.rso = 1.2; T.wing = 1.0; T.lean = -0.1; break;
    case 'swim': { const ph = t * 5; T.rp = 1.35; T.hdx = -0.8; T.rsf = 1.6 + Math.sin(ph) * 1.6; T.lsf = 1.6 - Math.sin(ph) * 1.6; T.rso = 0.3; T.lso = 0.3; T.rel = 0.3; T.lel = 0.3; T.lhf = Math.sin(ph * 2) * 0.35; T.rhf = -Math.sin(ph * 2) * 0.35; T.lkb = 0.25; T.rkb = 0.25; T.by = 0.05; break; }
  }
  const k = 1 - Math.exp(-dt * snap); const P = rig.pose;
  for (const key of POSE_KEYS) P[key] += (T[key] - P[key]) * k;
  rig.hips.position.y = 1.0 + P.by; rig.hips.rotation.set(P.rp, P.ry, P.rr); rig.spine.rotation.set(P.lean, P.twist, 0);
  rig.head.rotation.set(P.hdx - P.rp * 0.2, P.hdy, 0);
  rig.shL.rotation.set(-P.lsf, 0, P.lso); rig.shR.rotation.set(-P.rsf, 0, -P.rso); rig.elL.rotation.x = -P.lel; rig.elR.rotation.x = -P.rel;
  rig.hpL.rotation.x = -P.lhf; rig.hpR.rotation.x = -P.rhf; rig.knL.rotation.x = P.lkb; rig.knR.rotation.x = P.rkb;
  if (rig.wingL && rig.wingL.visible) { const f = P.wing; rig.wingL.rotation.z = -0.15 - f * 0.55; rig.wingR!.rotation.z = 0.15 + f * 0.55; rig.wingL.rotation.y = -0.25 - f * 0.1; rig.wingR!.rotation.y = 0.25 + f * 0.1; }
  const fl = anim === 'fly' ? 1 : anim === 'flyIdle' ? 0.4 : 0; const mv = Math.min(1, sp);
  for (let i = 0; i < rig.cape.length; i++) { const c = rig.cape[i]; const a = 0.06 + (mv * 0.35 + fl * 0.9) * (0.4 + i * 0.12) + Math.sin(t * 3 + i * 0.7) * 0.07 * (1 + mv + fl); c.rotation.x += (a - c.rotation.x) * Math.min(1, dt * 8); c.rotation.z = Math.sin(t * 2 + i) * 0.05; }
  for (let i = 0; i < rig.tail.length; i++) { rig.tail[i].rotation.y = Math.sin(t * 2.5 + i * 0.6) * 0.25; rig.tail[i].rotation.x = 0.1 * i + (anim === 'idle' ? 0 : 0.1); }
  if (rig.aura && rig.aura.visible) { const s = 1 + Math.sin(t * 8) * 0.06; rig.aura.scale.set(1.2 * s, 1.7 * s, 1.2 * s); }
}

// ---------- dragons ----------
export interface DragonRig { root: THREE.Group; body: THREE.Group; neck: THREE.Group[]; head: THREE.Group; jaw: THREE.Group; wingL: THREE.Group; wingR: THREE.Group; tail: THREE.Group[]; legs: THREE.Group[]; glow: THREE.MeshStandardMaterial }
export function buildDragon(color: string, belly: string, glow: string, scale = 1, detail = 1): DragonRig {
  const root = new THREE.Group(); const body = grp(root); const sk = M(color, { rough: 0.55, metal: 0.35 }), bel = M(belly, { rough: 0.8, metal: 0 }), gl = glowM(glow, 3);
  mk(body, GS(1, 14, 10), sk, 0, 0, 0, undefined, undefined, [1.1, 0.95, 2.2]); mk(body, GS(0.9, 10, 8), bel, 0, -0.25, 0.1, undefined, undefined, [1, 0.8, 2.0]);
  for (let i = 0; i < 6; i++) mk(body, GK(0.12, 0.45 - i * 0.03, 5), M(belly, { metal: 0.5 }), 0, 0.95 - Math.abs(i - 2.5) * 0.07, 1.6 - i * 0.6, undefined, [-0.2, 0, 0]);
  const neck: THREE.Group[] = []; let par: THREE.Object3D = grp(body, 0, 0.4, 1.9);
  for (let i = 0; i < 4; i++) { const g = grp(par, 0, 0, i === 0 ? 0 : 0.55); mk(g, GC(0.4 - i * 0.05, 0.45 - i * 0.05, 0.6, 7), sk, 0, 0, 0.25, undefined, [PI / 2, 0, 0]); g.rotation.x = -0.35; neck.push(g); par = g; }
  const head = grp(par, 0, 0, 0.7); mk(head, GB(0.7, 0.55, 0.9), sk, 0, 0, 0.2); mk(head, GB(0.5, 0.3, 0.8), sk, 0, -0.05, 0.85); mk(head, GB(0.46, 0.06, 0.7), M('#111'), 0, -0.2, 0.85);
  const jaw = grp(head, 0, -0.22, 0.4); mk(jaw, GB(0.46, 0.12, 0.95), bel, 0, 0, 0.45); for (let i = 0; i < 4; i++) mk(jaw, GK(0.04, 0.14, 4), M('#eee'), (i % 2 ? 1 : -1) * 0.18, 0.1, 0.3 + i * 0.2, undefined, [PI, 0, 0]);
  for (const s of [-1, 1]) { mk(head, GB(0.12, 0.08, 0.2), gl, s * 0.28, 0.2, 0.35, undefined, [0, 0, -s * 0.3]); hornChain(head, s, 1.1, 1.2, 0.09, belly, false, 5).position.set(s * 0.25, 0.25, -0.05); mk(head, GK(0.04, 0.2, 4), M('#eee'), s * 0.18, 0.0, 1.25, undefined, [PI, 0, 0]); }
  const mkw = (s: number) => { const pv = grp(body, s * 0.8, 0.7, 0.5); const w = makeWing('demon', color, belly, 2.4, detail); w.scale.x = -s; pv.add(w); return pv; };
  const wingR = mkw(-1), wingL = mkw(1);
  const tail: THREE.Group[] = []; par = grp(body, 0, 0, -1.9); for (let i = 0; i < 8; i++) { const g = grp(par, 0, 0, i === 0 ? 0 : -0.7); mk(g, GC(0.35 - i * 0.035, 0.4 - i * 0.035, 0.75, 6), sk, 0, 0, -0.3, undefined, [PI / 2, 0, 0]); tail.push(g); par = g; }
  mk(par as THREE.Object3D, GK(0.18, 0.6, 4), M(belly, { metal: 0.5 }), 0, 0, -0.9, undefined, [-PI / 2, 0, 0], [1, 1, 0.4]);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.8, 1.0], [0.8, 1.0], [-0.8, -0.9], [0.8, -0.9]]) { const l = grp(body, x, -0.5, z); mk(l, GC(0.2, 0.15, 0.8, 6), sk, 0, -0.4, 0); mk(l, GB(0.3, 0.12, 0.45), M(belly), 0, -0.82, 0.12); legs.push(l); }
  root.scale.setScalar(scale);
  return { root, body, neck, head, jaw, wingL, wingR, tail, legs, glow: gl };
}
export function animateDragon(d: DragonRig, t: number, flap: number, mouth: number, flying = true) {
  const f = Math.sin(t * flap); d.wingL.rotation.z = -0.1 - f * 0.7 - (flying ? 0.1 : 0.5); d.wingR.rotation.z = 0.1 + f * 0.7 + (flying ? 0.1 : 0.5); d.wingL.rotation.y = -0.3; d.wingR.rotation.y = 0.3;
  d.body.position.y = flying ? f * 0.15 : 0; d.jaw.rotation.x = mouth * 0.7; d.neck.forEach((n, i) => { n.rotation.y = Math.sin(t * 1.2 + i * 0.5) * 0.12; n.rotation.x = -0.35 + Math.sin(t * 1.5 + i) * 0.05; });
  d.tail.forEach((g, i) => { g.rotation.y = Math.sin(t * 2.2 - i * 0.5) * 0.22; g.rotation.x = flying ? 0.05 : 0; }); d.legs.forEach((l, i) => { l.rotation.x = flying ? 0.7 : Math.sin(t * 3 + i * PI) * 0.1; });
}

// ---------- special bosses ----------
export interface BossRig { root: THREE.Group; update: (t: number, dt: number, mood: number) => void; humanoid?: Rig; dragon?: DragonRig }
export function buildKraken(scale: number): BossRig {
  const root = new THREE.Group(); const sk = M('#2a3a6a', { rough: 0.45, metal: 0.2, em: '#0a2a5a', ei: 0.5 }), gl = glowM('#2fffd0', 3);
  const head = grp(root, 0, 3.2, 0); mk(head, GS(3, 16, 12), sk, 0, 1.2, 0, undefined, undefined, [1, 1.3, 1]); for (const s of [-1, 1]) { mk(head, GS(0.7, 10, 8), M('#fff'), s * 1.5, 0.2, 2.3); mk(head, GS(0.35, 8, 6), gl, s * 1.6, 0.2, 2.9); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; mk(head, GS(0.28, 6, 5), gl, Math.cos(a) * 2.2, 2.2 + (i % 3), Math.sin(a) * 2.2); }
  mk(head, GK(0.6, 1.4, 6), M('#e8e0c0'), 0, -0.6, 2.6, undefined, [PI, 0, 0]);
  const tents: THREE.Group[][] = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; let par: THREE.Object3D = grp(root, Math.cos(a) * 2, 2.0, Math.sin(a) * 2); par.rotation.y = -a + PI / 2; const chain: THREE.Group[] = []; for (let i = 0; i < 9; i++) { const g = grp(par, 0, i === 0 ? 0 : -1.0, 0); mk(g, GC(0.55 - i * 0.05, 0.6 - i * 0.05, 1.05, 6), sk, 0, -0.5, 0); if (i > 1 && i % 2) mk(g, GS(0.14, 5, 4), gl, 0, -0.5, 0.45 - i * 0.03); chain.push(g); par = g; } tents.push(chain); }
  root.scale.setScalar(scale);
  return { root, update: (t, _d, mood) => { tents.forEach((c, k) => c.forEach((g, i) => { g.rotation.x = 0.35 + Math.sin(t * (1.5 + mood) + k + i * 0.5) * 0.3; g.rotation.z = Math.cos(t * 1.2 + k + i * 0.4) * 0.25; })); head.position.y = 3.2 + Math.sin(t * 1.3) * 0.2; } };
}
export function buildDestroyer(scale: number): BossRig {
  const root = new THREE.Group(); const core = grp(root, 0, 4, 0);
  mk(core, GS(2.2, 20, 14), M('#f0e8ff', { rough: 0.2, metal: 0.1, em: '#6a2a9a', ei: 0.6 })); const iris = mk(core, GS(1.2, 14, 10), glowM('#ff4fd0', 3), 0, 0, 1.3, undefined, undefined, [1, 1, 0.5]); mk(core, GS(0.55, 10, 8), M('#000'), 0, 0, 2.0);
  const rings: THREE.Mesh[] = []; for (let i = 0; i < 3; i++) rings.push(mk(core, GT(3.5 + i * 0.9, 0.12, 6, 40), glowM(['#ff4fd0', '#8a4bff', '#4fe0ff'][i], 2), 0, 0, 0));
  const shards: THREE.Mesh[] = []; for (let i = 0; i < 10; i++) shards.push(mk(root, GO(0.8 + (i % 3) * 0.3), M('#1a0a2a', { em: '#a02aff', ei: 1.4, metal: 0.8, rough: 0.2 }), 0, 0, 0, undefined, undefined, [0.5, 1.8, 0.5]));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; mk(core, GK(0.4, 3.5, 5), M('#2a0a3a', { em: '#8a2aff', ei: 0.7 }), Math.cos(a) * 1.8, -2.2, Math.sin(a) * 1.8, undefined, [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5 + PI]); }
  root.scale.setScalar(scale);
  return { root, update: (t, _d, mood) => { core.position.y = 4 + Math.sin(t * 1.2) * 0.4; rings.forEach((r, i) => { r.rotation.x = t * (0.4 + i * 0.3 + mood * 0.3) + i; r.rotation.y = t * (0.3 + i * 0.2); }); shards.forEach((s, i) => { const a = t * (0.6 + (i % 3) * 0.2) + (i / 10) * PI * 2, r = 6 + (i % 4); s.position.set(Math.cos(a) * r, 4 + Math.sin(t + i) * 2, Math.sin(a) * r); s.rotation.set(t, a, 0); }); iris.scale.setScalar(1 + Math.sin(t * 3) * 0.05 + mood * 0.1); } };
}
