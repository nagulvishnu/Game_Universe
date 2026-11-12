import * as THREE from 'three';
import { RARITIES, RARITY, WEAPONS, SETS, type Item, type WeaponFamily } from './data';

// ---------- caches & helpers ----------
const matCache = new Map<string, THREE.MeshStandardMaterial>();
export interface MO { em?: number; ei?: number; metal?: number; rough?: number; op?: number; add?: boolean; flat?: boolean }
export function mat(color: number, o: MO = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.em ?? -1}|${o.ei ?? 1}|${o.metal ?? 0.1}|${o.rough ?? 0.7}|${o.op ?? 1}|${o.add ? 1 : 0}|${o.flat ? 1 : 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0.1, emissive: o.em ?? 0x000000, emissiveIntensity: o.em !== undefined ? (o.ei ?? 1) : 0,
      transparent: (o.op ?? 1) < 1 || !!o.add, opacity: o.op ?? 1, flatShading: !!o.flat, side: o.op !== undefined || o.add ? THREE.DoubleSide : THREE.FrontSide,
      blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.add && (o.op ?? 1) >= 1,
    });
    matCache.set(key, m);
  }
  return m;
}
export const glowMat = (c: number, ei = 2, op = 1) => mat(c, { em: c, ei, rough: 0.4, op: op < 1 ? op : undefined });
export const addMat = (c: number, op = 0.6) => {
  const k = `add${c}|${op}`; let m = matCache.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }) as unknown as THREE.MeshStandardMaterial; matCache.set(k, m); }
  return m;
};
const geoCache = new Map<string, THREE.BufferGeometry>();
function cg<T extends THREE.BufferGeometry>(k: string, f: () => T): T { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g as T; }
export const G = {
  box: (w: number, h: number, d: number) => cg(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt: number, rb: number, h: number, s = 8) => cg(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  sph: (r: number, ws = 12, hs = 9) => cg(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
  cone: (r: number, h: number, s = 8) => cg(`n${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
  tor: (r: number, t: number, rs = 8, ts = 24, arc = Math.PI * 2) => cg(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  oct: (r: number, d = 0) => cg(`o${r},${d}`, () => new THREE.OctahedronGeometry(r, d)),
  ico: (r: number, d = 0) => cg(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d)),
  pla: (w: number, h: number) => cg(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
};
type V3 = [number, number, number];
export function M(parent: THREE.Object3D | null, geo: THREE.BufferGeometry, mt: THREE.Material, p: V3 = [0, 0, 0], r?: V3, s?: number | V3, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mt); m.position.set(...p);
  if (r) m.rotation.set(...r);
  if (s !== undefined) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s); }
  m.castShadow = shadow;
  parent?.add(m); return m;
}
export function grp(parent: THREE.Object3D | null, p: V3 = [0, 0, 0], r?: V3): THREE.Group { const g = new THREE.Group(); g.position.set(...p); if (r) g.rotation.set(...r); parent?.add(g); return g; }

// blade extruded from a width profile
export function bladeGeo(len: number, w: number, curve = 0, thick = 0.035, wf: (t: number) => number = (t) => (t < 0.86 ? 1 : Math.max(0.02, 1 - (t - 0.86) / 0.14))): THREE.BufferGeometry {
  const k = `bl${len},${w},${curve},${thick},${wf(0.5)},${wf(0.2)}`;
  return cg(k, () => {
    const s = new THREE.Shape(), N = 14, L: [number, number][] = [], R: [number, number][] = [];
    for (let i = 0; i <= N; i++) { const t = i / N, y = len * t, off = curve * t * t, hw = (w / 2) * wf(t); L.push([off - hw, y]); R.push([off + hw, y]); }
    s.moveTo(L[0][0], L[0][1]); for (const p of L) s.lineTo(p[0], p[1]); for (let i = R.length - 1; i >= 0; i--) s.lineTo(R[i][0], R[i][1]); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: thick * 0.35, bevelThickness: thick * 0.35, bevelSegments: 1, steps: 1 });
    g.translate(0, 0, -thick / 2); return g;
  });
}

// ---------- WEAPONS ----------
export interface WeaponModel extends THREE.Group { userData: { tip: THREE.Object3D; base: THREE.Object3D; len: number } }
export function buildWeapon(fam: WeaponFamily, rarity: string = 'common', awakened = false, tint?: number): WeaponModel {
  const def = WEAPONS[fam], g = new THREE.Group() as WeaponModel;
  const ri = RARITIES.indexOf(rarity as never), rc = (RARITY[rarity as keyof typeof RARITY] ?? RARITY.common).hex;
  const steel = awakened ? 0xfff6d0 : def.color, glow = awakened ? 0xffd860 : (tint ?? def.glow), trim = awakened ? 0xffc83a : rc;
  const bm = mat(steel, { metal: 0.85, rough: 0.22, em: glow, ei: awakened ? 0.9 : 0.12 + ri * 0.07 });
  const gm = glowMat(glow, awakened ? 3 : 1.2 + ri * 0.25), tm = mat(trim, { metal: 0.8, rough: 0.3, em: trim, ei: 0.25 }), dk = mat(0x2a2230, { rough: 0.8 }), wrap = mat(0x3a2a40, { rough: 0.9 });
  let tipY = 1, baseY = 0.3;
  const grip = (y0: number, y1: number, r = 0.04) => { M(g, G.cyl(r, r, y1 - y0, 8), wrap, [0, (y0 + y1) / 2, 0]); for (let y = y0 + 0.05; y < y1 - 0.03; y += 0.08) M(g, G.tor(r, 0.008, 4, 10), dk, [0, y, 0], [Math.PI / 2, 0, 0]); };
  switch (fam) {
    case 'greatsword': {
      M(g, bladeGeo(2.05, 0.36, 0, 0.06, (t) => (t < 0.9 ? 1 - t * 0.12 : Math.max(0.02, (1 - (t - 0.9) / 0.1) * 0.9))), bm, [0, 0.32, 0]);
      M(g, G.box(0.05, 1.7, 0.075), gm, [0, 1.2, 0]);
      M(g, G.box(1.0, 0.1, 0.16), tm, [0, 0.3, 0]); for (const sx of [-1, 1]) { M(g, G.cone(0.09, 0.3, 4), tm, [sx * 0.55, 0.38, 0], [0, 0, -sx * 1.2]); M(g, G.sph(0.06), gm, [sx * 0.3, 0.3, 0.09]); }
      grip(-0.3, 0.28, 0.045); M(g, G.sph(0.09), tm, [0, -0.34, 0]); tipY = 2.37; baseY = 0.6; break;
    }
    case 'katana': {
      M(g, bladeGeo(1.4, 0.07, 0.16, 0.025, (t) => (t < 0.93 ? 1 : 0.2)), bm, [0, 0.12, 0]);
      M(g, G.box(0.012, 1.25, 0.03), mat(0xffffff, { em: glow, ei: 0.6 }), [0.0, 0.7, 0.0]);
      M(g, G.cyl(0.13, 0.13, 0.025, 12), tm, [0, 0.1, 0]); M(g, G.cyl(0.07, 0.07, 0.06, 8), tm, [0, 0.07, 0]);
      grip(-0.38, 0.06, 0.035); M(g, G.sph(0.05), tm, [0, -0.4, 0]); M(g, G.cone(0.03, 0.25, 6), mat(0xaa1e3a), [0, -0.5, 0], [Math.PI, 0, 0.2]); tipY = 1.52; baseY = 0.4; break;
    }
    case 'dual': {
      M(g, bladeGeo(0.95, 0.11, 0.07, 0.03), bm, [0, 0.1, 0]); M(g, G.box(0.01, 0.8, 0.04), gm, [0, 0.55, 0]);
      M(g, G.box(0.3, 0.05, 0.08), tm, [0, 0.08, 0]); M(g, G.cone(0.04, 0.14, 4), tm, [0.17, 0.12, 0], [0, 0, -0.9]);
      grip(-0.2, 0.06, 0.03); M(g, G.sph(0.045), tm, [0, -0.23, 0]); tipY = 1.07; baseY = 0.3; break;
    }
    case 'spear': {
      M(g, G.cyl(0.032, 0.032, 2.6, 8), mat(0x4a3a30, { rough: 0.6 }), [0, 0.5, 0]);
      M(g, bladeGeo(0.7, 0.22, 0, 0.04, (t) => Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.85 + 0.1) * (1 - t * 0.2)), bm, [0, 1.75, 0]); M(g, G.box(0.02, 0.5, 0.06), gm, [0, 2.05, 0]);
      M(g, G.tor(0.06, 0.018, 6, 12), tm, [0, 1.75, 0], [Math.PI / 2, 0, 0]); M(g, G.cone(0.07, 0.3, 8), mat(0xc0243a), [0, 1.62, 0], [Math.PI, 0, 0]);
      M(g, G.cone(0.04, 0.16, 6), tm, [0, -0.85, 0], [Math.PI, 0, 0]); tipY = 2.45; baseY = 1.5; break;
    }
    case 'scythe': {
      M(g, G.cyl(0.032, 0.036, 2.4, 8), mat(0x3a2a45, { rough: 0.6 }), [0, 0.55, 0]);
      const sh = new THREE.Shape(); sh.absarc(0, 0, 1.0, 0.25, 2.5, false); sh.absarc(0.12, -0.12, 0.84, 2.45, 0.35, true);
      const eg = cg('scythe', () => { const e = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); e.translate(0, 0, -0.02); return e; });
      M(g, eg, bm, [0.0, 1.45, 0], [0, 0, 0.1]); M(g, G.tor(0.9, 0.012, 4, 30, 2.2), gm, [0.02, 1.37, 0], [0, 0, 0.35]);
      M(g, G.sph(0.07), tm, [0, 1.75, 0]); M(g, G.cone(0.05, 0.24, 6), tm, [0, -0.78, 0], [Math.PI, 0, 0]); tipY = 2.05; baseY = 1.6; break;
    }
    case 'hammer': {
      M(g, G.cyl(0.045, 0.05, 1.7, 8), mat(0x4a3a30, { rough: 0.6 }), [0, 0.5, 0]);
      M(g, G.box(0.62, 0.52, 0.52), bm, [0, 1.45, 0]); M(g, G.box(0.66, 0.1, 0.56), tm, [0, 1.45, 0]);
      for (const sx of [-1, 1]) { M(g, G.cyl(0.2, 0.24, 0.12, 10), tm, [sx * 0.37, 1.45, 0], [0, 0, Math.PI / 2]); M(g, G.cone(0.07, 0.22, 6), tm, [sx * 0.5, 1.45, 0], [0, 0, -sx * Math.PI / 2]); }
      M(g, G.box(0.1, 0.1, 0.54), gm, [0, 1.45, 0]); M(g, G.cone(0.06, 0.2, 6), tm, [0, 1.8, 0]); M(g, G.sph(0.08), tm, [0, -0.38, 0]); tipY = 1.45; baseY = 1.0; break;
    }
    case 'staff': {
      M(g, G.cyl(0.03, 0.036, 2.2, 8), mat(0x5a4030, { rough: 0.5 }), [0, 0.5, 0]);
      for (const y of [-0.3, 0.2, 1.1]) M(g, G.tor(0.045, 0.012, 4, 10), tm, [0, y, 0], [Math.PI / 2, 0, 0]);
      M(g, G.tor(0.24, 0.025, 6, 20), tm, [0, 1.85, 0]); M(g, G.tor(0.18, 0.015, 6, 16), tm, [0, 1.85, 0], [Math.PI / 2, 0.5, 0]);
      const orb = M(g, G.oct(0.14, 1), gm, [0, 1.85, 0]); orb.name = 'orb';
      for (const sx of [-1, 1]) M(g, G.cone(0.04, 0.4, 5), tm, [sx * 0.2, 1.6, 0], [0, 0, sx * 0.5]);
      M(g, G.cone(0.05, 0.3, 5), tm, [0, 2.15, 0]); tipY = 1.95; baseY = 1.5; break;
    }
    case 'dagger': {
      M(g, bladeGeo(0.55, 0.12, 0.02, 0.028, (t) => (t < 0.8 ? 1 : Math.max(0.03, 1 - (t - 0.8) / 0.2))), bm, [0, 0.08, 0]); M(g, G.box(0.012, 0.42, 0.04), gm, [0, 0.34, 0]);
      M(g, G.box(0.26, 0.04, 0.07), tm, [0, 0.06, 0]); grip(-0.17, 0.04, 0.028); M(g, G.sph(0.04), tm, [0, -0.2, 0]); tipY = 0.65; baseY = 0.2; break;
    }
  }
  if (awakened) { const a = M(g, G.cyl(0.22, 0.12, tipY * 0.9, 8, ), addMat(0xffe070, 0.18), [0, tipY * 0.5, 0], undefined, 1, false); a.scale.set(1, 1, 0.5); }
  const tip = new THREE.Object3D(); tip.position.set(0, tipY, 0); const base = new THREE.Object3D(); base.position.set(0, baseY, 0); g.add(tip, base);
  g.userData = { tip, base, len: tipY };
  return g;
}

// ---------- PLAYER ----------
export interface Look { weapon?: Item | null; weapon2?: Item | null; helmet?: Item | null; armor?: Item | null; gloves?: Item | null; boots?: Item | null; ring?: Item | null; artifact?: Item | null; awakened?: boolean }
export interface PlayerRig {
  root: THREE.Group; body: THREE.Group; torso: THREE.Group; head: THREE.Group; armR: THREE.Group; armL: THREE.Group; legR: THREE.Group; legL: THREE.Group;
  hand: THREE.Group; handL: THREE.Group; cape: THREE.Group[]; wings: THREE.Group | null; weapon: WeaponModel | null; weapon2: WeaponModel | null; aura: THREE.Mesh | null; halo: THREE.Object3D | null; family: WeaponFamily;
}
const tintOf = (it?: Item | null) => (!it ? undefined : it.set ? SETS.find((s) => s.id === it.set)!.color : RARITY[it.rarity].hex);
export function buildPlayer(look: Look, ghost?: number): PlayerRig {
  const aw = !!look.awakened;
  const root = new THREE.Group(), body = grp(root, [0, 0.95, 0]), torso = grp(body);
  const at = tintOf(look.armor), ht = tintOf(look.helmet), gt = tintOf(look.gloves), bt = tintOf(look.boots);
  const cloth = mat(aw ? 0x2a2a4a : 0x1c2a5a, { rough: 0.8 }), cloth2 = mat(0x10183a, { rough: 0.85 });
  const armorC = mat(look.armor ? (at as number) : 0xb8c4d8, { metal: 0.7, rough: 0.35, em: aw ? 0xffc83a : look.armor ? (at as number) : 0x000000, ei: aw ? 0.5 : look.armor ? 0.12 : 0 });
  const trim = mat(aw ? 0xffd860 : 0xd8b050, { metal: 0.9, rough: 0.25, em: aw ? 0xffc83a : 0x000000, ei: aw ? 0.9 : 0 });
  const skin = mat(0xf2cdb0, { rough: 0.6 });
  const eyeC = aw ? 0xffd040 : 0x55ddff;
  // torso
  M(torso, G.box(0.46, 0.2, 0.28), cloth2, [0, 0.05, 0]); M(torso, G.cyl(0.26, 0.2, 0.5, 8), armorC, [0, 0.42, 0], undefined, [1.15, 1, 0.78]);
  M(torso, G.box(0.5, 0.06, 0.32), trim, [0, 0.2, 0]); M(torso, G.sph(0.06), glowMat(eyeC, 2), [0, 0.45, 0.2]);
  for (const sx of [-1, 1]) M(torso, G.sph(0.17, 10, 8), armorC, [sx * 0.34, 0.62, 0], undefined, [1.05, 0.7, 1]);
  M(torso, G.cyl(0.12, 0.15, 0.1, 8), trim, [0, 0.72, 0]);
  // skirt tassets
  for (let i = -1; i <= 1; i++) M(body, G.box(0.16, 0.3, 0.04), cloth, [i * 0.17, -0.12, 0.14], [-0.15, 0, 0]);
  M(body, G.box(0.2, 0.34, 0.04), cloth, [0, -0.14, -0.15], [0.15, 0, 0]);
  // head
  const head = grp(torso, [0, 0.95, 0]);
  M(head, G.sph(0.2, 14, 10), skin, [0, 0, 0], undefined, [1, 1.05, 1]);
  for (const sx of [-1, 1]) { M(head, G.box(0.075, 0.04, 0.03), glowMat(eyeC, 2.5), [sx * 0.085, 0.01, 0.185], [0, 0, sx * -0.12]); M(head, G.box(0.09, 0.012, 0.03), mat(0x1a1a2a), [sx * 0.085, 0.055, 0.185], [0, 0, sx * -0.18]); }
  const hairC = mat(aw ? 0xffe27a : 0xdfe6ff, { rough: 0.5, em: aw ? 0xffc83a : 0x000000, ei: aw ? 0.7 : 0 }), hairT = mat(aw ? 0xfff6c0 : 0x5a8aff, { rough: 0.5, em: aw ? 0xffe27a : 0x2a4aff, ei: aw ? 0.9 : 0.3 });
  M(head, G.sph(0.215, 12, 8), hairC, [0, 0.04, -0.03], [-0.25, 0, 0], [1, 0.9, 1]);
  const spikes = aw ? 1.5 : 1;
  for (let i = -2; i <= 2; i++) M(head, G.cone(0.065, 0.28 * (1 - Math.abs(i) * 0.1), 5), hairC, [i * 0.08, 0.17, 0.14], [0.9, 0, -i * 0.28]);
  for (let i = -2; i <= 2; i++) M(head, G.cone(0.07, (0.5 - Math.abs(i) * 0.06) * spikes, 5), i % 2 ? hairT : hairC, [i * 0.075, 0.1, -0.2], [-1.9 + Math.abs(i) * 0.1, 0, i * 0.22]);
  M(head, G.cone(0.035, 0.3 * spikes, 4), hairT, [0.02, 0.28, 0.06], [0.2, 0, -0.4]);
  if (look.helmet) { const hm = mat(ht as number, { metal: 0.8, rough: 0.3, em: ht as number, ei: 0.2 }); M(head, G.sph(0.235, 12, 7, ), hm, [0, 0.07, -0.01], undefined, [1, 0.62, 1.02]); M(head, G.box(0.04, 0.2, 0.34), trim, [0, 0.22, -0.04], [0.1, 0, 0]); M(head, G.cone(0.05, 0.22, 4), hm, [0.22, 0.16, 0], [0, 0, -0.9]); M(head, G.cone(0.05, 0.22, 4), hm, [-0.22, 0.16, 0], [0, 0, 0.9]); }
  // arms
  const mkArm = (sx: number) => {
    const a = grp(torso, [sx * 0.37, 0.58, 0]);
    M(a, G.cyl(0.075, 0.065, 0.5, 8), cloth, [0, -0.25, 0]);
    M(a, G.cyl(0.095, 0.085, 0.22, 8), gt ? mat(gt, { metal: 0.7, rough: 0.35, em: gt, ei: 0.15 }) : armorC, [0, -0.5, 0]);
    M(a, G.sph(0.075), look.gloves ? mat(gt as number, { metal: 0.6 }) : skin, [0, -0.62, 0]);
    const h = grp(a, [0, -0.62, 0]); return { a, h };
  };
  const R = mkArm(-1), L = mkArm(1);
  // legs
  const mkLeg = (sx: number) => {
    const l = grp(body, [sx * 0.13, 0, 0]);
    M(l, G.cyl(0.095, 0.075, 0.5, 8), cloth, [0, -0.25, 0]);
    const bm = look.boots ? mat(bt as number, { metal: 0.6, rough: 0.4, em: bt as number, ei: 0.12 }) : mat(0x24243a, { rough: 0.6 });
    M(l, G.cyl(0.085, 0.1, 0.4, 8), bm, [0, -0.68, 0]); M(l, G.box(0.14, 0.09, 0.26), bm, [0, -0.89, 0.05]); M(l, G.sph(0.09), trim, [0, -0.5, 0.05], undefined, [1, 0.7, 1]);
    return l;
  };
  const legR = mkLeg(1), legL = mkLeg(-1);
  // cape
  const capeC = mat(look.armor ? (at as number) : aw ? 0xffe27a : 0xaa1e3a, { rough: 0.8, em: aw ? 0xffc83a : 0x000000, ei: aw ? 0.5 : 0 }), cape: THREE.Group[] = [];
  let par: THREE.Object3D = torso, py = 0.65;
  for (let i = 0; i < 3; i++) { const c = grp(par, [0, i === 0 ? py : -0.34, -0.18]); M(c, G.box(0.5 - i * 0.05, 0.36, 0.03), capeC, [0, -0.17, 0]); cape.push(c); par = c; }
  // awakening visuals
  let wings: THREE.Group | null = null, aura: THREE.Mesh | null = null, halo: THREE.Object3D | null = null;
  if (aw) {
    wings = grp(torso, [0, 0.55, -0.2]);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
      const f = grp(wings, [sx * 0.1, 0.1 - i * 0.04, 0], [0, sx * (0.5 + i * 0.1), sx * (0.5 + i * 0.28)]);
      M(f, G.cone(0.07 - i * 0.008, 1.3 - i * 0.18, 4), addMat(i % 2 ? 0xffe27a : 0xfff6c0, 0.7), [0, 0.6 - i * 0.07, 0], undefined, [1, 1, 0.25], false);
    }
    halo = M(head, G.tor(0.3, 0.018, 6, 28), glowMat(0xffd860, 3), [0, 0.52, -0.04], [Math.PI / 2 - 0.2, 0, 0], 1, false);
    aura = M(root, G.cyl(0.6, 0.7, 2.2, 14, ), addMat(0xffd860, 0.1), [0, 1.1, 0], undefined, 1, false);
  } else if (look.artifact || look.ring) {
    const c = tintOf(look.artifact) ?? tintOf(look.ring) ?? 0x66ccff;
    M(torso, G.oct(0.07, 0), glowMat(c, 2.5), [0.42, 0.2, 0.2], undefined, 1, false);
  }
  const fam = (look.weapon?.family || 'katana') as WeaponFamily;
  let weapon: WeaponModel | null = null, weapon2: WeaponModel | null = null;
  if (look.weapon) {
    weapon = buildWeapon(fam, look.weapon.rarity, aw, look.weapon.set ? tintOf(look.weapon) : undefined); weapon.rotation.x = Math.PI / 2 - 0.45; R.h.add(weapon);
    if (aw) weapon.scale.setScalar(1.18);
    if (fam === 'dual') { weapon2 = buildWeapon(fam, look.weapon.rarity, aw); weapon2.rotation.x = Math.PI / 2 - 0.45; L.h.add(weapon2); }
  }
  if (ghost !== undefined) { const gm = new THREE.MeshBasicMaterial({ color: ghost, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }); root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = gm; }); }
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return { root, body, torso, head, armR: R.a, armL: L.a, legR, legL, hand: R.h, handL: L.h, cape, wings, weapon, weapon2, aura, halo, family: fam };
}
export function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && (m.geometry as THREE.BufferGeometry & { userData: { own?: boolean } }).userData?.own) m.geometry.dispose(); });
}
