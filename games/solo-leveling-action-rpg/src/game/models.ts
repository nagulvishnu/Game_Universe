// Procedural 3D character/monster/weapon models + skeletal-style pose animation.
import * as THREE from 'three';

const gBox = new THREE.BoxGeometry(1, 1, 1);
const gSph = new THREE.SphereGeometry(1, 12, 9);
const gCone = new THREE.ConeGeometry(1, 1, 7);
const gCyl = new THREE.CylinderGeometry(1, 1, 1, 9);
const limbs: Record<string, THREE.BufferGeometry> = {};
const limbGeo = (rt: number, rb: number) => (limbs[rt + '_' + rb] ||= new THREE.CylinderGeometry(rt, rb, 1, 8));
export const geo = { box: gBox, sph: gSph, cone: gCone, cyl: gCyl };

const toonGrad = (() => {
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const mats: Record<string, THREE.Material> = {};
export interface MatOpts {
  em?: number;
  ei?: number;
  metal?: boolean;
  add?: boolean;
  op?: number;
  basic?: boolean;
  side?: boolean;
}
export function mat(color: number, o: MatOpts = {}): THREE.Material {
  const k = color + JSON.stringify(o);
  if (mats[k]) return mats[k];
  let m: THREE.Material;
  if (o.add)
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: o.op ?? 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: o.side ? THREE.DoubleSide : THREE.FrontSide,
    });
  else if (o.basic)
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: o.op !== undefined,
      opacity: o.op ?? 1,
      side: o.side ? THREE.DoubleSide : THREE.FrontSide,
    });
  else if (o.metal)
    m = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.62,
      roughness: 0.3,
      emissive: o.em ?? 0,
      emissiveIntensity: o.ei ?? 1,
    });
  else
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: toonGrad,
      emissive: o.em ?? 0,
      emissiveIntensity: o.ei ?? 1,
      transparent: o.op !== undefined,
      opacity: o.op ?? 1,
    });
  return (mats[k] = m);
}
export const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
export const frozenMat = new THREE.MeshBasicMaterial({ color: 0x6d3cff });

export interface Rig {
  kind: 'hum' | 'serp' | 'quad';
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  handR: THREE.Group;
  handL: THREE.Group;
  cape?: THREE.Group;
  weapon?: THREE.Group;
  weaponLen: number;
  meshes: THREE.Mesh[];
  segs: THREE.Group[];
  extra: Record<string, THREE.Object3D>;
  height: number;
  flashT: number;
}
type V3 = [number, number, number];
function add(
  r: Rig,
  parent: THREE.Object3D,
  g: THREE.BufferGeometry,
  m: THREE.Material,
  s: V3,
  p: V3 = [0, 0, 0],
  rot?: V3,
  shadow = true
) {
  const me = new THREE.Mesh(g, m);
  me.scale.set(...s);
  me.position.set(...p);
  if (rot) me.rotation.set(...rot);
  me.castShadow = shadow;
  me.userData.m0 = m;
  parent.add(me);
  r.meshes.push(me);
  return me;
}
const grp = (parent: THREE.Object3D, p: V3 = [0, 0, 0]) => {
  const g = new THREE.Group();
  g.position.set(...p);
  parent.add(g);
  return g;
};
function newRig(kind: Rig['kind']): Rig {
  const root = new THREE.Group();
  const body = grp(root);
  const z = () => new THREE.Group();
  return {
    kind,
    root,
    body,
    hips: body,
    torso: z(),
    head: z(),
    armL: z(),
    armR: z(),
    foreL: z(),
    foreR: z(),
    legL: z(),
    legR: z(),
    shinL: z(),
    shinR: z(),
    handR: z(),
    handL: z(),
    meshes: [],
    segs: [],
    extra: {},
    height: 1.8,
    flashT: 0,
    weaponLen: 0.4,
  };
}
export function setFlash(r: Rig, on: boolean) {
  for (const m of r.meshes) m.material = on ? flashMat : (m.userData.m0 as THREE.Material);
}

// ---------------- Humanoid ----------------
export interface HumOpts {
  skin: number;
  top: number;
  top2?: number;
  pants: number;
  shoe?: number;
  hair?: number;
  hairStyle?: 'jw' | 'short' | 'long' | 'bun' | 'bald' | 'spiky';
  b?: number;
  scale?: number;
  eyes?: number;
  coat?: number;
  glowEyes?: boolean;
  metal?: boolean;
  em?: number;
  detail?: boolean;
  trim?: number;
  glove?: number;
  boot?: number;
}
export function humanoid(o: HumOpts): Rig {
  const r = newRig('hum');
  r.kind = 'hum';
  const b = o.b ?? 1;
  const detail = !!o.detail;
  const trim = o.trim ?? (o.metal ? 0x8a94a8 : 0x55627a);
  const M = (c: number) =>
    o.metal ? mat(c, { metal: true, em: o.em ?? 0, ei: 0.6 }) : mat(c, o.em ? { em: o.em, ei: 0.5 } : {});
  const skin = mat(o.skin),
    top = M(o.top),
    top2 = M(o.top2 ?? o.top),
    pants = M(o.pants),
    shoe = M(o.boot ?? o.shoe ?? 0x15151b),
    trimMat = mat(trim, o.metal ? { metal: true, em: o.em ?? 0, ei: 0.4 } : { em: o.em ?? 0, ei: 0.25 }),
    gloveMat = mat(o.glove ?? (o.metal ? 0x22262f : o.skin));

  r.hips = grp(r.body, [0, 0.95, 0]);
  add(r, r.hips, gBox, pants, [0.32 * b, 0.17, 0.21 * b], [0, 0.03, 0]);
  add(r, r.hips, gBox, pants, [0.28 * b, 0.08, 0.2 * b], [0, -0.07, 0]);
  add(r, r.hips, gBox, trimMat, [0.33 * b, 0.045, 0.225 * b], [0, 0.115, 0]);
  if (detail) {
    add(r, r.hips, gBox, mat(0xb08a3a, { metal: true }), [0.07, 0.05, 0.02], [0, 0.115, 0.12]);
    [-1, 1].forEach((s) => {
      const tasset = add(r, r.hips, gBox, top2, [0.1 * b, 0.24, 0.03], [s * 0.15 * b, -0.12, 0.08], [0.12, 0, s * 0.1]);
      tasset.userData.tasset = true;
    });
  }
  const leg = (x: number) => {
    const th = grp(r.hips, [x * b, -0.02, 0]);
    add(r, th, limbGeo(0.088 * b, 0.064 * b), pants, [1, 0.46, 1], [0, -0.23, 0]);
    if (detail) add(r, th, gBox, top2, [0.115 * b, 0.09, 0.03], [0, -0.26, 0.075], [0.08, 0, 0]);
    const sh = grp(th, [0, -0.46, 0]);
    add(r, sh, limbGeo(0.063 * b, 0.048 * b), pants, [1, 0.44, 1], [0, -0.22, 0]);
    add(r, sh, gBox, shoe, [0.1 * b, 0.09, 0.27], [0, -0.44, 0.065]);
    if (detail) {
      add(r, sh, gBox, trimMat, [0.105 * b, 0.035, 0.2], [0, -0.405, 0.03]);
      add(r, sh, gBox, shoe, [0.085 * b, 0.035, 0.12], [0, -0.485, 0.155]);
    }
    return [th, sh];
  };
  [r.legL, r.shinL] = leg(-0.105);
  [r.legR, r.shinR] = leg(0.105);
  r.torso = grp(r.hips, [0, 0.06, 0]);
  add(r, r.torso, gBox, top2, [0.29 * b, 0.2, 0.19 * b], [0, 0.1, 0]);
  add(r, r.torso, gBox, top, [0.44 * b, 0.31, 0.24 * b], [0, 0.36, 0]);
  if (detail) {
    add(r, r.torso, gBox, top, [0.36 * b, 0.14, 0.25 * b], [0, 0.5, 0]);
    add(r, r.torso, gBox, trimMat, [0.055, 0.48, 0.015], [-0.13 * b, 0.3, 0.125], [0, 0, 0.55]);
    add(r, r.torso, gBox, trimMat, [0.055, 0.36, 0.015], [0.13 * b, 0.34, 0.125], [0, 0, -0.35]);
    add(r, r.torso, gBox, top2, [0.2, 0.16, 0.05], [0, 0.37, 0.135]);
    add(r, r.torso, gBox, trimMat, [0.24, 0.02, 0.055], [0, 0.44, 0.15]);
    add(r, r.torso, gBox, trimMat, [0.24, 0.02, 0.055], [0, 0.3, 0.15]);
  }
  const neck = grp(r.torso, [0, 0.58, 0]);
  add(r, neck, limbGeo(0.05, 0.056), skin, [1, 0.1, 1], [0, 0.03, 0]);
  if (detail) add(r, neck, gBox, top, [0.16 * b, 0.06, 0.14 * b], [0, -0.01, 0]);
  r.head = grp(neck, [0, 0.07, 0]);
  const hd = add(r, r.head, gSph, skin, [0.112, 0.135, 0.118], [0, 0.13, 0]);
  hd.userData.face = true;
  const eyeC = o.eyes ?? 0x111116;
  const hc = mat(o.hair ?? 0x0a0a0e);
  if (detail) {
    add(r, r.head, gSph, skin, [0.088, 0.07, 0.09], [0, 0.072, 0.014]);
    [-1, 1].forEach((s) => {
      add(r, r.head, gSph, skin, [0.019, 0.028, 0.014], [s * 0.112, 0.128, 0]);
    });
    add(r, r.head, gCone, skin, [0.014, 0.04, 0.018], [0, 0.128, 0.12], [Math.PI / 2, 0, 0]);
    add(r, r.head, gBox, mat(0x7a4a42), [0.032, 0.005, 0.006], [0, 0.072, 0.12]);
  }
  if (o.glowEyes) {
    const em = mat(eyeC, { basic: true });
    [-1, 1].forEach((s) => {
      add(r, r.head, gSph, em, [0.03, 0.017, 0.01], [s * 0.046, 0.139, 0.111], undefined, false);
      add(r, r.head, gBox, hc, [0.055, 0.011, 0.012], [s * 0.046, 0.172, 0.112], [0, 0, -s * 0.22]);
    });
  } else {
    const sclera = mat(0xf2eee8);
    const iris = mat(eyeC);
    const pupil = mat(0x05060a, { basic: true });
    [-1, 1].forEach((s) => {
      add(r, r.head, gSph, sclera, [0.03, 0.019, 0.011], [s * 0.045, 0.139, 0.108], undefined, false);
      add(r, r.head, gSph, iris, [0.014, 0.014, 0.008], [s * 0.045, 0.139, 0.119], undefined, false);
      add(r, r.head, gSph, pupil, [0.006, 0.007, 0.005], [s * 0.045, 0.139, 0.123], undefined, false);
      add(r, r.head, gBox, hc, [0.05, 0.009, 0.012], [s * 0.046, 0.166, 0.112], [0, 0, -s * 0.2], false);
    });
  }
  const hs = o.hairStyle ?? 'short';
  if (hs !== 'bald') {
    add(r, r.head, gSph, hc, [0.124, 0.115, 0.13], [0, 0.172, -0.014]);
    add(r, r.head, gSph, hc, [0.105, 0.09, 0.09], [0, 0.145, -0.07]);
    if (hs === 'jw' || hs === 'spiky') {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9 - 0.5) * 2.9;
        add(
          r,
          r.head,
          gCone,
          hc,
          [0.032 + (i % 3) * 0.009, 0.13 + (i % 2) * 0.06, 0.034],
          [Math.sin(a) * 0.103, 0.255 + (i % 2) * 0.015, -0.055 - Math.cos(a) * 0.025],
          [-0.95 - (i % 3) * 0.16, a * 0.55, -Math.sin(a) * 0.7]
        );
      }
      for (let i = 0; i < 5; i++)
        add(
          r,
          r.head,
          gCone,
          hc,
          [0.028, 0.085 + (i % 2) * 0.035, 0.028],
          [(i - 2) * 0.039, 0.215 - Math.abs(i - 2) * 0.008, 0.105],
          [Math.PI * 0.78, 0, (i - 2) * 0.24]
        );
      [-1, 1].forEach((s) => {
        add(r, r.head, gBox, hc, [0.026, 0.11, 0.05], [s * 0.112, 0.135, 0.018], [0, 0, -s * 0.08]);
      });
    }
    if (hs === 'long') {
      add(r, r.head, gBox, hc, [0.2, 0.36, 0.06], [0, -0.01, -0.12]);
      add(r, r.head, gBox, hc, [0.022, 0.18, 0.085], [0.113, 0.07, 0.0]);
      add(r, r.head, gBox, hc, [0.022, 0.18, 0.085], [-0.113, 0.07, 0.0]);
    }
    if (hs === 'bun') add(r, r.head, gSph, hc, [0.06, 0.06, 0.06], [0, 0.29, -0.06]);
  }
  const arm = (x: number) => {
    const sh = grp(r.torso, [x * 0.265 * b, 0.535, 0]);
    add(r, sh, gSph, top, [0.07 * b, 0.07, 0.07 * b]);
    if (detail || o.metal) {
      add(r, sh, gSph, top2, [0.098 * b, 0.075, 0.098 * b], [0, 0.02, 0], undefined, true);
      add(r, sh, gBox, trimMat, [0.14 * b, 0.018, 0.04], [0, 0.06, 0.03]);
    }
    add(r, sh, limbGeo(0.056 * b, 0.047 * b), top, [1, 0.32, 1], [0, -0.16, 0]);
    const el = grp(sh, [0, -0.31, 0]);
    add(r, el, limbGeo(0.045 * b, 0.039 * b), o.metal || detail ? gloveMat : skin, [1, 0.28, 1], [0, -0.14, 0]);
    if (detail || o.metal) {
      add(r, el, gBox, top2, [0.095 * b, 0.13, 0.095 * b], [0, -0.13, 0]);
      add(r, el, gBox, trimMat, [0.1 * b, 0.02, 0.1 * b], [0, -0.06, 0]);
    }
    const hand = grp(el, [0, -0.29, 0]);
    add(r, hand, gSph, detail || o.metal ? gloveMat : skin, [0.048, 0.052, 0.048]);
    add(r, hand, gBox, detail || o.metal ? gloveMat : skin, [0.03, 0.035, 0.026], [x * -0.035, 0.005, 0.02], [0, 0, x * 0.3]);
    return [sh, el, hand];
  };
  [r.armL, r.foreL, r.handL] = arm(-1);
  [r.armR, r.foreR, r.handR] = arm(1);
  if (o.coat) {
    const c = mat(o.coat);
    const sk = grp(r.hips, [0, 0, 0]);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283;
      const panel = add(
        r,
        sk,
        gBox,
        c,
        [0.19 * b, 0.62, 0.035],
        [Math.sin(a) * 0.16 * b, -0.3, Math.cos(a) * 0.16 * b],
        [0, a, 0]
      );
      panel.userData.coatPanel = true;
    }
    add(r, sk, gBox, trimMat, [0.4 * b, 0.05, 0.34 * b], [0, 0.02, 0]);
    r.extra.coat = sk;
  }
  r.root.scale.setScalar(o.scale ?? 1);
  r.height = 1.8 * (o.scale ?? 1);
  return r;
}
export function addCape(r: Rig, color: number, w = 0.4, len = 0.95, emissive = 0) {
  const c = grp(r.torso, [0, 0.58, -0.13]);
  const cm = mat(color, emissive ? { em: emissive, ei: 0.4 } : {});
  const trim = mat(0xb08a3a, { metal: true });
  const cols = [-1, 0, 1];
  cols.forEach((cx, i) => {
    const panel = add(
      r,
      c,
      gBox,
      cm,
      [w * (i === 1 ? 0.46 : 0.3), len * (i === 1 ? 1 : 0.82), 0.025],
      [cx * w * 0.3, -len * (i === 1 ? 0.5 : 0.41), Math.abs(cx) * 0.035],
      [0.04, cx * 0.12, cx * 0.04]
    );
    panel.userData.capePanel = true;
  });
  add(r, c, gBox, trim, [w * 0.9, 0.045, 0.045], [0, -0.01, 0.01]);
  add(r, c, gSph, trim, [0.06, 0.06, 0.05], [0, 0.01, 0.02]);
  r.cape = c;
}
export function holdWeapon(r: Rig, w: THREE.Group, len: number) {
  r.weapon?.parent?.remove(w);
  r.weapon = w;
  w.rotation.set(Math.PI / 2, 0, 0);
  r.handR.add(w);
  r.weaponLen = len;
}

// ---------------- Weapons (blade along +Y from grip) ----------------
export function makeWeapon(look: string, wtype = 'dagger'): { g: THREE.Group; len: number } {
  const g = new THREE.Group();
  const r = newRig('hum');
  const A = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    s: V3,
    p: V3 = [0, 0, 0],
    rot?: V3,
    shadow = false
  ) => add(r, g, geometry, material, s, p, rot, shadow);
  let len = 0.4;
  const steel = mat(0xd6e2f0, { metal: true }),
    steelDark = mat(0x7a879c, { metal: true }),
    gold = mat(0xb08a3a, { metal: true }),
    wrap = mat(0x4a3a2e);
  switch (look) {
    case 'rusty': {
      A(gBox, mat(0x8a7a6a, { metal: true }), [0.036, 0.3, 0.013], [0, 0.2, 0], [0, 0, -0.03], true);
      A(gBox, mat(0x574e46, { metal: true }), [0.012, 0.26, 0.016], [0.012, 0.205, 0], [0, 0, -0.03]);
      A(gCone, mat(0x9a8a78, { metal: true }), [0.021, 0.09, 0.012], [0.004, 0.395, 0], [0, 0, -0.04]);
      A(gBox, mat(0x6a5a4a), [0.016, 0.05, 0.02], [-0.021, 0.22, 0], [0, 0, 0.2]);
      A(gBox, gold, [0.085, 0.017, 0.028], [0, 0.045, 0]);
      A(gCyl, wrap, [0.018, 0.085, 0.018], [0, -0.006, 0]);
      A(gSph, mat(0x6a5a4a, { metal: true }), [0.022, 0.022, 0.022], [0, -0.055, 0]);
      len = 0.46;
      break;
    }
    case 'steel': {
      const L = wtype === 'greatsword' ? 1.28 : 0.82;
      const W = wtype === 'greatsword' ? 0.15 : 0.068;
      const base = 0.13;
      A(gBox, steel, [W, L, 0.02], [0, base + L / 2, 0], undefined, true);
      A(gBox, steelDark, [W * 0.62, L * 0.98, 0.024], [0, base + L / 2, 0]);
      A(gBox, mat(0xeaf4ff, { metal: true }), [W * 0.16, L * 0.92, 0.026], [0, base + L / 2, 0]);
      A(gCone, steel, [W / 2, 0.14, 0.014], [0, base + L + 0.07, 0]);
      A(gBox, gold, [W * 2.5, 0.035, 0.055], [0, base - 0.015, 0]);
      [-1, 1].forEach((s) =>
        A(gBox, steelDark, [0.03, 0.09, 0.05], [s * W * 1.25, base + 0.01, 0], [0, 0, s * 0.3])
      );
      A(gCyl, wrap, [0.021, wtype === 'greatsword' ? 0.3 : 0.2, 0.021], [0, -0.05, 0]);
      A(gSph, gold, [0.038, 0.038, 0.038], [0, wtype === 'greatsword' ? -0.22 : -0.16, 0]);
      len = L + 0.3;
      break;
    }
    case 'fang': {
      const fm = mat(0xb8ffb0, { metal: true, em: 0x2cff6a, ei: 0.9 });
      for (let i = 0; i < 5; i++) {
        const a = i * 0.13;
        A(
          gBox,
          fm,
          [0.05 - i * 0.006, 0.135, 0.022],
          [Math.sin(a * 2) * 0.05 * i * 0.5, 0.11 + i * 0.115, 0],
          [0, 0, -a],
          true
        );
        A(gCone, mat(0x2cff6a, { basic: true }), [0.012, 0.04, 0.012], [0.03 - i * 0.006, 0.19 + i * 0.115, 0], [0, 0, -1.1]);
      }
      A(gCone, mat(0x7dff7a, { metal: true, em: 0x2cff6a, ei: 1.2 }), [0.022, 0.11, 0.015], [0.07, 0.68, 0], [0, 0, -0.78]);
      A(gBox, mat(0xcfc4a0, { metal: true }), [0.12, 0.035, 0.045], [0, 0.065, 0]);
      A(gCyl, wrap, [0.019, 0.08, 0.019], [0, 0, 0]);
      len = 0.65;
      break;
    }
    case 'killer': {
      A(gBox, mat(0x1b1b26, { metal: true, em: 0xff1830, ei: 0.5 }), [0.062, 0.52, 0.015], [0, 0.33, 0], [0, 0, 0.02], true);
      A(gBox, mat(0xe8f0ff, { metal: true }), [0.012, 0.5, 0.017], [0.027, 0.33, 0], [0, 0, 0.02]);
      A(gBox, mat(0xff2a3a, { basic: true }), [0.009, 0.44, 0.019], [-0.03, 0.32, 0], [0, 0, 0.02]);
      A(gCone, mat(0x1b1b26, { metal: true, em: 0xff1830, ei: 0.8 }), [0.031, 0.13, 0.013], [0.004, 0.65, 0], [0, 0, 0.03]);
      A(gBox, mat(0x111118, { metal: true }), [0.17, 0.03, 0.055], [0, 0.075, 0]);
      A(gBox, mat(0xff2030, { basic: true }), [0.014, 0.05, 0.06], [0.08, 0.09, 0], [0, 0, 0.5]);
      A(gCyl, wrap, [0.019, 0.085, 0.019], [0, 0, 0]);
      A(gSph, gold, [0.024, 0.024, 0.024], [0, -0.06, 0]);
      len = 0.7;
      break;
    }
    case 'igris': {
      A(gBox, mat(0x24202c, { metal: true, em: 0xff1428, ei: 0.25 }), [0.15, 1.48, 0.032], [0, 1.02, 0], undefined, true);
      A(gBox, mat(0x5a1020, { metal: true, em: 0xff1428, ei: 0.5 }), [0.05, 1.38, 0.04], [0, 1.02, 0]);
      A(gBox, mat(0xff2030, { basic: true }), [0.014, 1.3, 0.045], [0, 1.02, 0]);
      A(gCone, mat(0x2c2c36, { metal: true, em: 0xff1428, ei: 0.4 }), [0.076, 0.28, 0.024], [0, 1.9, 0]);
      for (let i = 0; i < 5; i++) {
        A(gBox, mat(0x6a1220, { metal: true }), [0.03, 0.04, 0.04], [-0.075, 0.72 + i * 0.2, 0], [0, 0, 0.5]);
        A(gBox, mat(0x6a1220, { metal: true }), [0.03, 0.04, 0.04], [0.075, 0.72 + i * 0.2, 0], [0, 0, -0.5]);
      }
      A(gBox, gold, [0.56, 0.06, 0.1], [0, 0.24, 0]);
      [-1, 1].forEach((s) => {
        A(gCone, mat(0x8a1420, { metal: true }), [0.045, 0.24, 0.045], [s * 0.3, 0.3, 0], [0, 0, -s * 1.05], true);
        A(gCone, mat(0xd01828, { metal: true }), [0.025, 0.14, 0.025], [s * 0.24, 0.18, 0], [0, 0, -s * 1.4]);
      });
      A(gCyl, wrap, [0.032, 0.36, 0.032], [0, 0.02, 0]);
      A(gSph, gold, [0.05, 0.05, 0.05], [0, -0.19, 0]);
      len = 2.1;
      break;
    }
    case 'shadow': {
      A(gBox, mat(0x14101f, { metal: true, em: 0x4a1c9a, ei: 0.4 }), [0.05, 0.62, 0.016], [0, 0.36, 0], undefined, true);
      A(gBox, mat(0xb26bff, { basic: true }), [0.008, 0.56, 0.02], [-0.021, 0.36, 0]);
      A(gCone, mat(0x14101f, { metal: true, em: 0x6a2cff, ei: 0.6 }), [0.025, 0.14, 0.014], [0, 0.75, 0]);
      A(gBox, mat(0x2a1a3a, { metal: true }), [0.14, 0.028, 0.05], [0, 0.055, 0]);
      A(gCyl, wrap, [0.017, 0.09, 0.017], [0, -0.01, 0]);
      A(gSph, mat(0xb26bff, { basic: true }), [0.018, 0.018, 0.018], [0, -0.07, 0], undefined, false);
      len = 0.78;
      break;
    }
    case 'mace': {
      A(gCyl, mat(0x4a4640, { metal: true }), [0.055, 1.05, 0.055], [0, 0.55, 0], undefined, true);
      const hm = mat(0x6e6a64, { metal: true });
      A(gBox, hm, [0.3, 0.42, 0.3], [0, 1.22, 0], undefined, true);
      A(gBox, mat(0x5a5650, { metal: true }), [0.34, 0.18, 0.34], [0, 1.34, 0]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283;
        A(gCone, mat(0x3a3630, { metal: true }), [0.06, 0.22, 0.06], [Math.cos(a) * 0.2, 1.22, Math.sin(a) * 0.2], [0, -a, 1.57]);
      }
      A(gBox, mat(0xff6a1a, { basic: true }), [0.32, 0.02, 0.32], [0, 1.05, 0]);
      len = 1.6;
      break;
    }
    case 'club': {
      A(gCyl, mat(0x6a4a2a), [0.07, 0.5, 0.07], [0, 0.25, 0], undefined, true);
      A(gSph, mat(0x6a4a2a), [0.115, 0.15, 0.115], [0, 0.56, 0]);
      A(gCone, mat(0x8a6a4a), [0.035, 0.12, 0.035], [0.06, 0.64, 0], [0, 0, -0.6]);
      A(gCone, mat(0x8a6a4a), [0.028, 0.1, 0.028], [-0.08, 0.6, 0.03], [0, 0, 0.7]);
      A(gBox, mat(0x3a2a1a), [0.14, 0.02, 0.04], [0, 0.08, 0]);
      len = 0.65;
      break;
    }
    case 'staff': {
      A(gCyl, mat(0x4a3a2a), [0.026, 0.95, 0.026], [0, 0.52, 0], undefined, true);
      A(gSph, mat(0xb26bff, { basic: true }), [0.075, 0.075, 0.075], [0, 1.03, 0]);
      A(new THREE.TorusGeometry(0.11, 0.014, 8, 24), mat(0xd4a0ff, { basic: true }), [1, 1, 1], [0, 1.03, 0], [1.57, 0, 0]);
      A(gCone, mat(0x6a2cff, { basic: true }), [0.03, 0.2, 0.03], [0, 0.88, 0], [3.14, 0, 0]);
      len = 1.1;
      break;
    }
  }
  return { g, len };
}

// ---------------- Characters ----------------
export interface PlayerLook {
  stage: number;
  armorColor?: number;
  weaponLook: string;
  wtype: string;
  hasHelm?: boolean;
  hasGloves?: boolean;
  hasBoots?: boolean;
  accessory?: string;
  trim?: number;
}
export function makeJinWoo(l: PlayerLook): Rig {
  const armored = l.stage >= 3;
  const monarch = l.stage >= 6;
  const top = l.armorColor ?? (monarch ? 0x141420 : armored ? 0x1a1c24 : 0x56627a);
  const trim = l.trim ?? (monarch ? 0x8a5cff : armored ? 0x8a93a8 : 0x6a7488);
  const r = humanoid({
    skin: 0xf0cfb0,
    top,
    top2: armored ? (monarch ? 0x0b0a14 : 0x101218) : 0x3a4256,
    pants: armored ? 0x11131a : 0x2b3550,
    hair: 0x07070b,
    hairStyle: 'jw',
    coat: armored ? (monarch ? 0x0a0812 : (l.armorColor ?? 0x0c0c12)) : undefined,
    detail: true,
    metal: armored,
    em: monarch ? 0x2a0a5a : undefined,
    trim,
    glove: l.hasGloves ? 0x2a3040 : armored ? 0x191c26 : undefined,
    boot: armored ? 0x0c0e14 : 0x1c1f2a,
    eyes: monarch ? 0xb26bff : 0x171d27,
    glowEyes: monarch,
    b: 1.0,
  });
  if (armored) {
    const plate = mat(top, { metal: true, em: monarch ? 0x1c0640 : 0, ei: 0.5 });
    const edge = mat(trim, { metal: true, em: monarch ? 0x4a1c9a : 0, ei: 0.55 });
    // breastplate + abdominal segments
    add(r, r.torso, gBox, plate, [0.39, 0.27, 0.07], [0, 0.38, 0.112]);
    add(r, r.torso, gBox, edge, [0.4, 0.018, 0.075], [0, 0.505, 0.118]);
    add(r, r.torso, gBox, mat(0x0b0d14, { metal: true }), [0.27, 0.05, 0.055], [0, 0.23, 0.115]);
    add(r, r.torso, gBox, mat(0x0b0d14, { metal: true }), [0.25, 0.04, 0.05], [0, 0.16, 0.112]);
    // chest crest
    add(r, r.torso, gCone, mat(monarch ? 0xb26bff : 0x56b4ff, { basic: true }), [0.045, 0.07, 0.025], [0, 0.4, 0.152], [Math.PI, 0, 0], false);
    add(r, r.torso, gBox, edge, [0.014, 0.1, 0.02], [0, 0.34, 0.153], undefined, false);
    // high collar / mantle
    if (monarch) {
      [-1, 1].forEach((s) => {
        add(r, r.torso, gBox, edge, [0.05, 0.32, 0.06], [s * 0.14, 0.56, -0.04], [0.16, 0, -s * 0.28]);
        add(r, r.torso, gBox, plate, [0.18, 0.09, 0.24], [s * 0.2 * 1.0, 0.56, 0], [0, 0, -s * 0.4]);
      });
      add(r, r.torso, gBox, mat(0x0a0712), [0.34, 0.1, 0.16], [0, 0.56, 0.06]);
      add(r, r.torso, gBox, edge, [0.36, 0.014, 0.17], [0, 0.6, 0.06]);
    }
    // shoulder plates (attached to arms)
    [r.armL, r.armR].forEach((a, i) => {
      const s = i === 0 ? -1 : 1;
      add(r, a, gBox, plate, [0.17, 0.1, 0.17], [0, 0.035, 0], [0, 0, -s * 0.18]);
      add(r, a, gBox, edge, [0.13, 0.016, 0.13], [0, 0.085, 0]);
      add(r, a, gCone, edge, [0.035, monarch ? 0.14 : 0.08, 0.035], [s * 0.1, 0.1, 0], [0, 0, -s * 0.45]);
    });
    // bracers
    [r.foreL, r.foreR].forEach((f) => {
      add(r, f, gBox, plate, [0.095, 0.14, 0.095], [0, -0.13, 0]);
      add(r, f, gBox, edge, [0.1, 0.016, 0.1], [0, -0.075, 0]);
    });
    // tassets + greaves
    [-1, 1].forEach((s) => {
      add(r, r.hips, gBox, plate, [0.12, 0.24, 0.035], [s * 0.145, -0.14, 0.085], [0.12, 0, s * 0.08]);
      add(r, r.legL && s < 0 ? r.shinL : r.shinR, gBox, plate, [0.09, 0.3, 0.06], [0, -0.22, 0.06]);
      add(r, r.legL && s < 0 ? r.shinL : r.shinR, gBox, edge, [0.095, 0.018, 0.065], [0, -0.38, 0.06]);
    });
    if (monarch) {
      add(r, r.torso, gBox, mat(0xb26bff, { basic: true }), [0.012, 0.2, 0.01], [-0.11, 0.34, 0.15], [0, 0, 0.35], false);
      add(r, r.torso, gBox, mat(0xb26bff, { basic: true }), [0.012, 0.16, 0.01], [0.12, 0.36, 0.15], [0, 0, -0.3], false);
      add(r, r.foreL, gBox, mat(0x8a4aff, { basic: true }), [0.008, 0.09, 0.085], [0.045, -0.15, 0], undefined, false);
      add(r, r.foreR, gBox, mat(0x8a4aff, { basic: true }), [0.008, 0.09, 0.085], [-0.045, -0.15, 0], undefined, false);
    }
  }
  if (l.hasHelm) {
    const hm = mat(0x3a4254, { metal: true, em: monarch ? 0x2a0a5a : 0, ei: 0.4 });
    add(r, r.head, gSph, hm, [0.137, 0.12, 0.142], [0, 0.176, -0.005]);
    add(r, r.head, gBox, hm, [0.05, 0.2, 0.14], [0.125, 0.11, 0], [0.12, 0, -0.12]);
    add(r, r.head, gBox, hm, [0.05, 0.2, 0.14], [-0.125, 0.11, 0], [0.12, 0, 0.12]);
    add(r, r.head, gBox, mat(0x07080d), [0.22, 0.045, 0.06], [0, 0.158, 0.105]);
    add(r, r.head, gBox, mat(monarch ? 0xb26bff : 0x56b4ff, { basic: true }), [0.18, 0.012, 0.02], [0, 0.158, 0.136], undefined, false);
    add(r, r.head, gBox, hm, [0.2, 0.07, 0.16], [0, 0.1, -0.08], [0.25, 0, 0]);
  }
  if (l.accessory) {
    if (l.accessory === 'mana_earring' || l.accessory === 'vit_ring') {
      add(r, r.head, gSph, mat(0xb26bff, { basic: true }), [0.016, 0.028, 0.012], [0.12, 0.09, 0.01], undefined, false);
      add(r, r.head, gSph, mat(0x8a4aff, { basic: true }), [0.01, 0.012, 0.008], [0.12, 0.062, 0.012], undefined, false);
    } else {
      add(r, r.torso, gBox, mat(0xb08a3a, { metal: true }), [0.012, 0.2, 0.012], [0, 0.47, 0.145], undefined, false);
      add(r, r.torso, gCone, mat(0x56b4ff, { basic: true }), [0.028, 0.045, 0.012], [0, 0.36, 0.152], [Math.PI, 0, 0], false);
    }
  }
  if (l.hasBoots) {
    [r.shinL, r.shinR].forEach((sh) => {
      add(r, sh, gBox, mat(0x2a3040, { metal: true }), [0.11, 0.09, 0.28], [0, -0.45, 0.065]);
      add(r, sh, gBox, mat(trim, { em: monarch ? 0x3a1470 : 0, ei: 0.4 }), [0.115, 0.02, 0.24], [0, -0.49, 0.06]);
    });
  }
  if (monarch) {
    addCape(r, 0x0a0714, 0.62, 1.08, 0x240650);
    const au = grp(r.body, [0, 0.88, 0]);
    r.extra.aura = au;
    for (let i = 0; i < 5; i++)
      add(
        r,
        au,
        gCone,
        mat(0x7a3cff, { add: true, op: 0.2 }),
        [0.24 - i * 0.035, 1.5 + i * 0.08, 0.24 - i * 0.035],
        [0, 0.18, 0],
        undefined,
        false
      );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.012, 6, 32),
      mat(0xb26bff, { add: true, op: 0.45 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.72;
    au.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.283;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), mat(0xb26bff, { basic: true }));
      orb.position.set(Math.cos(a) * 0.42, 0.82 + (i % 2) * 0.16, Math.sin(a) * 0.42);
      au.add(orb);
    }
  }
  const w = makeWeapon(l.weaponLook, l.wtype);
  holdWeapon(r, w.g, w.len);
  return r;
}
export function makeGoblin(shadow = false): Rig {
  const c = shadow ? 0x170b26 : 0x5b7f3a;
  const leather = shadow ? 0x160c24 : 0x5a3a1a;
  const r = humanoid({
    skin: c,
    top: leather,
    top2: shadow ? 0x0f0818 : 0x3a2a16,
    pants: shadow ? 0x120a1e : 0x4a3016,
    hairStyle: 'bald',
    eyes: shadow ? 0xc08aff : 0xffd21a,
    glowEyes: true,
    em: shadow ? 0x2a0a5a : 0,
    detail: true,
    metal: false,
    trim: shadow ? 0x6a2cff : 0x8a7a5a,
    scale: 0.75,
    b: 0.88,
  });
  [-1, 1].forEach((s) => {
    add(r, r.head, gCone, mat(c), [0.035, 0.26, 0.04], [s * 0.15, 0.18, -0.02], [0.1, 0, -s * 1.32]);
    add(r, r.head, gCone, mat(shadow ? 0x0f0818 : 0x3a5a26), [0.018, 0.12, 0.02], [s * 0.14, 0.1, 0.02], [0, 0, -s * 1.1]);
  });
  add(r, r.head, gCone, mat(c), [0.032, 0.07, 0.035], [0, 0.12, 0.135], [Math.PI / 2, 0, 0]);
  add(r, r.head, gBox, mat(0xf0e6c8), [0.018, 0.03, 0.012], [0.026, 0.075, 0.122]);
  add(r, r.head, gBox, mat(0xf0e6c8), [0.018, 0.03, 0.012], [-0.026, 0.075, 0.122]);
  // bone necklace + shoulder wrap
  for (let i = 0; i < 5; i++)
    add(r, r.torso, gCone, mat(0xd8cfb0), [0.012, 0.05, 0.012], [(i - 2) * 0.04, 0.52 - Math.abs(i - 2) * 0.012, 0.13], [Math.PI, 0, 0], false);
  add(r, r.torso, gBox, mat(shadow ? 0x2a1244 : 0x4a3a22), [0.2, 0.18, 0.045], [0, 0.34, 0.13], [0, 0, 0.2]);
  add(r, r.hips, gBox, mat(shadow ? 0x1c1030 : 0x6a4a2a), [0.28, 0.16, 0.24], [0, -0.02, 0.015]);
  const w = makeWeapon('club');
  holdWeapon(r, w.g, w.len);
  return r;
}
export function makeKnight(shadow = false): Rig {
  const steel = shadow ? 0x161024 : 0x8a92a2;
  const dark = shadow ? 0x0b0712 : 0x2d3240;
  const em = shadow ? 0x6a2cff : 0x1a0606;
  const trim = shadow ? 0x8a4aff : 0xb08a3a;
  const r = humanoid({
    skin: shadow ? 0x120a1e : 0x9a9aa8,
    top: steel,
    top2: dark,
    pants: dark,
    metal: true,
    em,
    detail: true,
    trim,
    b: 1.16,
    scale: 1.08,
    hairStyle: 'bald',
    eyes: shadow ? 0xb26bff : 0xff4a2a,
    glowEyes: true,
  });
  // helmet + crest
  add(r, r.head, gSph, mat(steel, { metal: true, em, ei: 0.6 }), [0.152, 0.17, 0.155], [0, 0.145, 0]);
  add(r, r.head, gBox, mat(0x05060a), [0.19, 0.045, 0.05], [0, 0.145, 0.135]);
  add(r, r.head, gBox, mat(shadow ? 0xb26bff : 0xff4a2a, { basic: true }), [0.16, 0.015, 0.01], [0, 0.145, 0.158], undefined, false);
  add(r, r.head, gBox, mat(steel, { metal: true }), [0.06, 0.22, 0.16], [0, 0.27, -0.04], [-0.15, 0, 0]);
  add(r, r.head, gCone, mat(shadow ? 0x3a1a6a : 0x883030), [0.038, 0.22, 0.038], [0, 0.36, -0.04], [0.15, 0, 0]);
  add(r, r.head, gBox, mat(trim, { metal: true }), [0.03, 0.06, 0.2], [0, 0.23, -0.06], [-0.3, 0, 0]);
  [-1, 1].forEach((s) =>
    add(r, s < 0 ? r.armL : r.armR, gSph, mat(steel, { metal: true, em, ei: 0.6 }), [0.13, 0.1, 0.13], [0, 0.03, 0], undefined, true)
  );
  // shield
  add(r, r.foreL, gBox, mat(dark, { metal: true, em, ei: 0.5 }), [0.055, 0.46, 0.36], [-0.11, -0.1, 0.12], [0, 0, 0.05]);
  add(r, r.foreL, gBox, mat(trim, { metal: true }), [0.04, 0.26, 0.24], [-0.15, -0.1, 0.12]);
  add(r, r.foreL, gCone, mat(shadow ? 0x6a2cff : 0xaa3a2a, { metal: true }), [0.05, 0.1, 0.05], [-0.16, 0.08, 0.12]);
  // tabard
  add(r, r.hips, gBox, mat(shadow ? 0x1a0f2e : 0x6a1420), [0.24, 0.44, 0.03], [0, -0.18, 0.115]);
  add(r, r.hips, gBox, mat(trim, { metal: true }), [0.26, 0.02, 0.035], [0, -0.39, 0.115]);
  const w = makeWeapon('steel', 'sword');
  holdWeapon(r, w.g, w.len);
  if (shadow) {
    const au = grp(r.body, [0, 0, 0]);
    r.extra.aura = au;
    for (let i = 0; i < 2; i++)
      add(r, au, gCone, mat(0x7a3cff, { add: true, op: 0.18 }), [0.35 - i * 0.1, 2.1, 0.35 - i * 0.1], [0, 0.9, 0], undefined, false);
  }
  return r;
}
export function makeIgris(shadow = false): Rig {
  const red = shadow ? 0x1c0f30 : 0xa81626,
    dark = shadow ? 0x0a0612 : 0x22222c,
    trim = shadow ? 0x8a4aff : 0xd6a040;
  const em = shadow ? 0x5a1cff : 0x300008;
  const r = humanoid({
    skin: dark,
    top: red,
    top2: dark,
    pants: dark,
    metal: true,
    em,
    detail: true,
    trim,
    b: 1.22,
    scale: 1.42,
    hairStyle: 'bald',
    eyes: shadow ? 0xb26bff : 0xff2030,
    glowEyes: true,
  });
  const M = (c: number, e = em) => mat(c, { metal: true, em: e, ei: 0.7 });
  // war helm
  add(r, r.head, gSph, M(red), [0.158, 0.185, 0.162], [0, 0.145, 0]);
  add(r, r.head, gBox, mat(0x000000), [0.2, 0.05, 0.055], [0, 0.145, 0.132]);
  add(r, r.head, gBox, mat(shadow ? 0xc08aff : 0xff2030, { basic: true }), [0.18, 0.018, 0.012], [0, 0.145, 0.16], undefined, false);
  add(r, r.head, gBox, M(trim, 0), [0.04, 0.3, 0.22], [0, 0.31, -0.03], [-0.28, 0, 0]);
  add(r, r.head, gCone, M(trim, 0), [0.045, 0.18, 0.045], [0, 0.43, -0.02], [0.1, 0, 0]);
  [-1, 1].forEach((s) => {
    add(r, r.head, gCone, M(shadow ? 0x4a1c9a : 0xd01828, em), [0.045, 0.3, 0.055], [s * 0.17, 0.25, -0.05], [0.3, 0, -s * 0.9]);
    add(r, r.head, gCone, M(trim, 0), [0.02, 0.18, 0.02], [s * 0.13, 0.32, 0.02], [0.2, 0, -s * 0.4]);
  });
  for (let i = 0; i < 4; i++)
    add(
      r,
      r.head,
      gCone,
      mat(shadow ? 0x4a1c9a : 0xa01426, { em: shadow ? 0x6a2cff : 0, ei: 0.6 }),
      [0.04, 0.22, 0.05],
      [0, 0.22 - i * 0.022, -0.19 - i * 0.07],
      [-1.7 - i * 0.18, 0, 0]
    );
  // pauldrons
  [r.armL, r.armR].forEach((a, i) => {
    const s = i === 0 ? -1 : 1;
    add(r, a, gSph, M(red), [0.19, 0.13, 0.19], [0, 0.035, 0], undefined, true);
    add(r, a, gCone, M(trim, 0), [0.045, 0.16, 0.045], [s * 0.08, 0.16, 0], [0, 0, -s * 0.5]);
    add(r, a, gBox, M(dark), [0.14, 0.05, 0.2], [0, -0.02, 0]);
  });
  add(r, r.foreL, gBox, M(dark), [0.15, 0.3, 0.15], [0, -0.14, 0]);
  add(r, r.foreR, gBox, M(dark), [0.15, 0.3, 0.15], [0, -0.14, 0]);
  add(r, r.foreL, gBox, M(trim, 0), [0.155, 0.02, 0.155], [0, -0.26, 0]);
  add(r, r.foreR, gBox, M(trim, 0), [0.155, 0.02, 0.155], [0, -0.26, 0]);
  // chest heraldry
  add(r, r.torso, gBox, M(red), [0.2, 0.26, 0.05], [0, 0.45, 0.145]);
  add(r, r.torso, gBox, M(dark), [0.035, 0.42, 0.05], [0, 0.4, 0.155]);
  add(r, r.torso, gCone, mat(shadow ? 0xb26bff : 0xff2030, { basic: true }), [0.05, 0.085, 0.02], [0, 0.47, 0.178], [Math.PI, 0, 0], false);
  add(r, r.torso, gBox, M(trim, 0), [0.3, 0.06, 0.3], [0, 0.2, 0]);
  add(r, r.hips, gBox, M(red), [0.3, 0.3, 0.035], [0, -0.18, 0.11]);
  add(r, r.hips, gBox, M(trim, 0), [0.32, 0.025, 0.04], [0, -0.34, 0.11]);
  // cloak
  addCape(r, shadow ? 0x1a0a2e : 0x7a0c18, 0.62, 1.35, shadow ? 0x2a0a6a : 0x200004);
  const w = makeWeapon('igris');
  holdWeapon(r, w.g, w.len);
  if (shadow) {
    const au = grp(r.body, [0, 0, 0]);
    r.extra.aura = au;
    for (let i = 0; i < 4; i++)
      add(r, au, gCone, mat(0x7a3cff, { add: true, op: 0.2 }), [0.6 - i * 0.14, 2.6, 0.6 - i * 0.14], [0, 1.2, 0], undefined, false);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.014, 6, 40), mat(0xb26bff, { add: true, op: 0.4 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.1;
    au.add(ring);
  }
  return r;
}
export function makeGuardian(): Rig {
  const st = 0x77736b,
    dk = 0x4a4741,
    light = 0x8d897f;
  const r = humanoid({
    skin: st,
    top: st,
    top2: dk,
    pants: dk,
    hairStyle: 'bald',
    b: 1.5,
    scale: 1.72,
    eyes: 0xff6a1a,
    glowEyes: true,
    trim: 0x5a564e,
    boot: dk,
  });
  const stone = mat(st),
    dark = mat(dk),
    lite = mat(light);
  [r.armL, r.armR].forEach((a, i) => {
    const s = i === 0 ? -1 : 1;
    add(r, a, gBox, dark, [0.21, 0.16, 0.21], [0, 0.02, 0], [0, s * 0.2, s * 0.12]);
    add(r, a, gBox, lite, [0.14, 0.1, 0.18], [s * 0.02, -0.02, 0.03], [0, 0, -s * 0.2]);
  });
  // weathered chest slab + cracks
  add(r, r.torso, gBox, lite, [0.2, 0.52, 0.06], [0, 0.4, 0.145], [0.02, 0, 0.03]);
  add(r, r.torso, gBox, dark, [0.19, 0.08, 0.07], [0, 0.24, 0.15], [0, 0, -0.08]);
  add(r, r.torso, gBox, mat(0xff6a1a, { basic: true }), [0.012, 0.2, 0.012], [0.03, 0.42, 0.178], [0, 0, 0.4], false);
  add(r, r.torso, gBox, mat(0xff6a1a, { basic: true }), [0.01, 0.13, 0.012], [-0.05, 0.32, 0.178], [0, 0, -0.5], false);
  // head: cracked stone helm
  add(r, r.head, gBox, dark, [0.21, 0.08, 0.21], [0, 0.29, 0]);
  add(r, r.head, gBox, lite, [0.16, 0.08, 0.04], [0, 0.2, 0.11], [0.1, 0, 0.06]);
  add(r, r.head, gBox, mat(0xff6a1a, { basic: true }), [0.09, 0.014, 0.012], [0, 0.17, 0.135], undefined, false);
  [r.hips, r.torso].forEach((p) => {
    add(r, p, gBox, dark, [0.12, 0.08, 0.12], [0.18, 0.05, 0.02], [0.2, 0.4, 0.1]);
    add(r, p, gBox, lite, [0.09, 0.06, 0.1], [-0.16, 0.02, 0.05], [0.3, 0.2, -0.3]);
  });
  [r.handL, r.handR].forEach((h) => add(r, h, gSph, stone, [0.11, 0.11, 0.11]));
  const w = makeWeapon('mace');
  holdWeapon(r, w.g, w.len);
  return r;
}
export function makeStatueOfGod(): Rig {
  const st = 0xb9b3a4,
    dk = 0x8a8478;
  const r = humanoid({
    skin: st,
    top: st,
    top2: dk,
    pants: dk,
    hairStyle: 'bald',
    b: 1.4,
    scale: 3.4,
    eyes: 0xff2a2a,
    glowEyes: true,
  });
  add(r, r.hips, limbGeo(0.28, 0.42), mat(dk), [1, 1.1, 0.9], [0, -0.45, 0]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    add(
      r,
      r.head,
      gCone,
      mat(0xd6c28a, { metal: true }),
      [0.025, 0.2, 0.025],
      [Math.sin(a) * 0.15, 0.33, Math.cos(a) * 0.15],
      [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]
    );
  }
  add(r, r.head, gBox, mat(0xd6c28a), [0.17, 0.02, 0.17], [0, 0.29, 0]);
  const halo = add(
    r,
    r.torso,
    gCyl,
    mat(0xffd27a, { add: true, op: 0.5 }),
    [0.45, 0.01, 0.45],
    [0, 0.95, -0.2],
    [Math.PI / 2, 0, 0],
    false
  );
  r.extra.halo = halo;
  r.armL.rotation.set(-0.3, 0, 0.5);
  r.armR.rotation.set(-0.3, 0, -0.5);
  return r;
}
export function makeStatueDecor(i: number): Rig {
  const r = humanoid({
    skin: 0x8c8678,
    top: 0x8c8678,
    top2: 0x6e695d,
    pants: 0x6e695d,
    hairStyle: 'bald',
    b: 1.3,
    scale: 2.4 + (i % 3) * 0.2,
    eyes: 0x222222,
  });
  r.root.userData.pray = true;
  return r;
}
export function makeNPC(o: {
  skin?: number;
  hair: number;
  hs?: HumOpts['hairStyle'];
  top: number;
  top2?: number;
  pants: number;
  coat?: number;
  scale?: number;
  weapon?: string;
  wtype?: string;
  b?: number;
  cape?: number;
}): Rig {
  const r = humanoid({
    skin: o.skin ?? 0xf2d2b6,
    hair: o.hair,
    hairStyle: o.hs ?? 'short',
    top: o.top,
    top2: o.top2,
    pants: o.pants,
    coat: o.coat,
    scale: o.scale ?? 1,
    b: o.b ?? 1,
  });
  if (o.cape) addCape(r, o.cape, 0.4, 0.8);
  if (o.weapon) {
    const w = makeWeapon(o.weapon, o.wtype || 'sword');
    holdWeapon(r, w.g, w.len);
  }
  return r;
}
export function makeShadowSoldier(): Rig {
  const r = humanoid({
    skin: 0x140b24,
    top: 0x1a1028,
    top2: 0x0a0612,
    pants: 0x0c0714,
    hairStyle: 'bald',
    eyes: 0xc08aff,
    glowEyes: true,
    detail: true,
    metal: true,
    trim: 0x8a4aff,
    em: 0x2a0a5a,
    b: 1.02,
  });
  [-1, 1].forEach((s) => {
    add(r, s < 0 ? r.armL : r.armR, gCone, mat(0x8a4aff, { metal: true, em: 0x5a1cff, ei: 0.5 }), [0.035, 0.14, 0.035], [s * 0.06, 0.14, 0], [0, 0, -s * 0.5]);
    add(r, s < 0 ? r.armL : r.armR, gBox, mat(0x0a0612, { metal: true }), [0.15, 0.06, 0.15], [0, 0.04, 0]);
  });
  add(r, r.torso, gCone, mat(0xb26bff, { basic: true }), [0.05, 0.08, 0.02], [0, 0.4, 0.155], [Math.PI, 0, 0], false);
  add(r, r.hips, gBox, mat(0x1a0f2e), [0.24, 0.38, 0.03], [0, -0.16, 0.105]);
  addCape(r, 0x1a0a2e, 0.34, 0.7, 0x2a0a6a);
  const w = makeWeapon('shadow');
  holdWeapon(r, w.g, w.len);
  const au = grp(r.body, [0, 0, 0]);
  r.extra.aura = au;
  for (let i = 0; i < 2; i++)
    add(r, au, gCone, mat(0x7a3cff, { add: true, op: 0.18 }), [0.3 - i * 0.08, 1.9, 0.3 - i * 0.08], [0, 0.7, 0], undefined, false);
  return r;
}

// ---------------- Serpent / Centipede / Lizard ----------------
export function makeSerpent(o: {
  n: number;
  rad: number;
  c1: number;
  c2: number;
  legs?: boolean;
  hood?: boolean;
  shadow?: boolean;
  eye?: number;
}): Rig {
  const r = newRig('serp');
  const sp = o.rad * 1.5;
  const sh = o.shadow;
  for (let i = 0; i < o.n; i++) {
    const g = grp(r.body, [0, 0, -i * sp]);
    const k = 1 - (i / o.n) * 0.7;
    const c = sh ? (i % 2 ? 0x0e0818 : 0x160c24) : i % 2 ? o.c1 : o.c2;
    add(
      r,
      g,
      gSph,
      mat(c, sh ? { em: 0x2a0a5a, ei: 0.4 } : {}),
      [o.rad * k * (o.legs ? 1.1 : 1), o.rad * k * (o.legs ? 0.65 : 1), sp * 0.75],
      [0, o.rad * k * 0.9, 0]
    );
    if (i > 0 && i < o.n - 2)
      add(
        r,
        g,
        gCone,
        mat(sh ? 0x2a1246 : o.c1),
        [o.rad * 0.1, o.rad * 0.68 * k, o.rad * 0.1],
        [0, o.rad * k * 1.15, -o.rad * 0.2],
        [-0.3, 0, 0]
      );
    if (sh)
      add(
        r,
        g,
        gBox,
        mat(0xb26bff, { basic: true }),
        [o.rad * k * 0.7, o.rad * 0.02, sp * 0.5],
        [0, o.rad * k * 1.02, 0],
        undefined,
        false
      );
    if (o.legs)
      [-1, 1].forEach((s) => {
        const lg = grp(g, [s * o.rad * k, o.rad * 0.6, 0]);
        add(
          r,
          lg,
          limbGeo(0.03, 0.02),
          mat(sh ? 0x0e0818 : 0x3a2a1a),
          [1, o.rad * 1.6, 1],
          [s * o.rad * 0.4, -o.rad * 0.4, 0],
          [0, 0, s * 0.9]
        );
        add(r, lg, gCone, mat(sh ? 0x2a1246 : 0x2a1a0a), [0.017, o.rad * 0.4, 0.017], [s * o.rad * 0.5, -o.rad * 0.8, 0], [0, 0, s * 0.6], false);
        lg.userData.s = s;
        (g.userData.legs ||= []).push(lg);
      });
    r.segs.push(g);
  }
  const hd = grp(r.body, [0, o.rad * 0.9, o.rad * 1.0]);
  r.head = hd;
  const hc = sh ? 0x160c24 : o.c2;
  add(
    r,
    hd,
    gSph,
    mat(hc, sh ? { em: 0x2a0a5a, ei: 0.4 } : {}),
    [o.rad * 0.95, o.rad * 0.8, o.rad * 1.25],
    [0, 0, 0.1]
  );
  [-1, 1].forEach((s) => {
    add(
      r,
      hd,
      gSph,
      mat(sh ? 0xb26bff : (o.eye ?? 0xffd21a), { basic: true }),
      [o.rad * 0.15, o.rad * 0.15, o.rad * 0.1],
      [s * o.rad * 0.5, o.rad * 0.25, o.rad * 0.85]
    );
    add(
      r,
      hd,
      gCone,
      mat(0xf4f0dc),
      [o.rad * 0.07, o.rad * 0.5, o.rad * 0.07],
      [s * o.rad * 0.3, -o.rad * 0.55, o.rad * 1.0],
      [Math.PI, 0, 0]
    );
  });
  if (o.legs)
    [-1, 1].forEach((s) =>
      add(
        r,
        hd,
        gCone,
        mat(0x2a1a0a),
        [o.rad * 0.08, o.rad * 0.8, o.rad * 0.08],
        [s * o.rad * 0.5, -o.rad * 0.1, o.rad * 1.4],
        [Math.PI / 2, 0, s * 0.6]
      )
    ); // pincers
  if (o.hood) add(r, hd, gSph, mat(o.c1), [o.rad * 1.7, o.rad * 1.3, o.rad * 0.18], [0, -o.rad * 0.2, -o.rad * 0.5]);
  if (o.hood) {
    [-1, 1].forEach((s) => {
      add(r, hd, gCone, mat(o.c2), [o.rad * 0.14, o.rad * 1.1, o.rad * 0.14], [s * o.rad * 0.7, o.rad * 0.4, -o.rad * 0.15], [0, 0, -s * 0.55]);
      add(r, hd, gCone, mat(0x14100a), [o.rad * 0.09, o.rad * 0.55, o.rad * 0.09], [s * o.rad * 0.35, o.rad * 0.32, o.rad * 0.75], [-0.6, 0, -s * 0.25]);
    });
    add(r, hd, gBox, mat(0x1a140c), [o.rad * 0.7, o.rad * 0.14, o.rad * 0.3], [0, -o.rad * 0.42, o.rad * 0.85]);
    for (let i = 0; i < 7; i++)
      add(r, hd, gCone, mat(0xf4f0dc), [o.rad * 0.045, o.rad * 0.18, o.rad * 0.045], [(i - 3) * o.rad * 0.2, -o.rad * 0.44, o.rad * 0.95], [3.1, 0, 0], false);
    if (sh) add(r, hd, gBox, mat(0xb26bff, { basic: true }), [o.rad * 0.9, o.rad * 0.02, o.rad * 0.05], [0, o.rad * 0.05, o.rad * 0.9], undefined, false);
  }
  if (!o.legs) {
    add(r, hd, gCone, mat(sh ? 0x2a1246 : hc), [o.rad * 0.16, o.rad * 0.7, o.rad * 0.16], [0, o.rad * 0.8, -o.rad * 0.15], [0.2, 0, 0], false);
    add(r, hd, gCone, mat(sh ? 0x2a1246 : hc), [o.rad * 0.1, o.rad * 0.45, o.rad * 0.1], [-o.rad * 0.35, o.rad * 0.55, -o.rad * 0.1], [0.2, 0, 0.2], false);
    add(r, hd, gCone, mat(sh ? 0x2a1246 : hc), [o.rad * 0.1, o.rad * 0.45, o.rad * 0.1], [o.rad * 0.35, o.rad * 0.55, -o.rad * 0.1], [0.2, 0, -0.2], false);
  }
  r.height = o.rad * 3;
  return r;
}
export function makeLizard(shadow = false): Rig {
  const r = newRig('quad');
  const c = shadow ? 0x120a1e : 0x4a6a3a,
    c2 = shadow ? 0x0c0714 : 0x8a9a4a;
  const em = shadow ? { em: 0x2a0a5a, ei: 0.4 } : {};
  r.torso = grp(r.body, [0, 0.55, 0]);
  add(r, r.torso, gSph, mat(c, em), [0.28, 0.24, 0.6]);
  add(r, r.torso, gSph, mat(c2, em), [0.2, 0.1, 0.5], [0, 0.17, 0]);
  const h = grp(r.torso, [0, 0.1, 0.55]);
  r.head = h;
  add(r, h, gSph, mat(c, em), [0.16, 0.13, 0.26], [0, 0, 0.1]);
  [-1, 1].forEach((s) =>
    add(r, h, gSph, mat(shadow ? 0xb26bff : 0xff4a1a, { basic: true }), [0.03, 0.03, 0.03], [s * 0.1, 0.06, 0.16])
  );
  for (let i = 0; i < 3; i++) {
    const t = grp(i ? r.segs[i - 1] : r.torso, [0, 0, i ? -0.3 : -0.55]);
    add(r, t, gSph, mat(c, em), [0.14 - i * 0.035, 0.12 - i * 0.03, 0.2], [0, 0, -0.1]);
    r.segs.push(t);
  }
  const legs: THREE.Group[] = [];
  [
    [-1, 0.3],
    [1, 0.3],
    [-1, -0.3],
    [1, -0.3],
  ].forEach(([s, z]) => {
    const l = grp(r.torso, [s * 0.26, -0.05, z]);
    add(r, l, limbGeo(0.06, 0.04), mat(c, em), [1, 0.5, 1], [s * 0.05, -0.25, 0], [0, 0, s * 0.3]);
    legs.push(l);
  });
  r.extra.l0 = legs[0];
  r.extra.l1 = legs[1];
  r.extra.l2 = legs[2];
  r.extra.l3 = legs[3];
  // dorsal spines + claws
  for (let i = 0; i < 4; i++)
    add(
      r,
      i < 2 ? r.torso : r.segs[i - 2],
      gCone,
      mat(shadow ? 0x2a1246 : 0x2a3a22),
      [0.035 - i * 0.005, 0.14 - i * 0.022, 0.045],
      [0, 0.21 - i * 0.015, 0.22 - i * 0.18],
      [-0.35, 0, 0]
    );
  legs.forEach((l, i) => {
    const s = i % 2 ? 1 : -1;
    for (let k = 0; k < 2; k++)
      add(r, l, gCone, mat(0xd8cfb0), [0.018, 0.1, 0.018], [s * 0.1 + k * 0.04, -0.48, 0.06], [2.6, 0, s * 0.3], false);
  });
  add(r, r.head, gCone, mat(shadow ? 0x2a1246 : 0xd8c090), [0.035, 0.18, 0.035], [0, 0.18, -0.02], [-0.2, 0, 0], false);
  add(r, r.head, gCone, mat(shadow ? 0x2a1246 : 0x8a9a4a), [0.025, 0.12, 0.025], [-0.11, 0.13, 0.02], [-0.2, 0, 0.45], false);
  add(r, r.head, gCone, mat(shadow ? 0x2a1246 : 0x8a9a4a), [0.025, 0.12, 0.025], [0.11, 0.13, 0.02], [-0.2, 0, -0.45], false);
  if (shadow) {
    add(r, r.head, gBox, mat(0xb26bff, { basic: true }), [0.22, 0.02, 0.02], [0, 0.08, 0.2], undefined, false);
    const au = grp(r.body, [0, 0.4, 0]);
    r.extra.aura = au;
    add(r, au, gCone, mat(0x7a3cff, { add: true, op: 0.2 }), [0.35, 1.2, 0.35], [0, 0.2, 0], undefined, false);
  }
  r.height = 0.9;
  return r;
}

// ---------------- Pose animation ----------------
export interface PoseState {
  t: number;
  phase: number;
  move: number;
  atk: number;
  kind: string;
  hurt: number;
  dead: number;
  kneel: number;
  cast: number;
  air: boolean;
  block: number;
  rear: number;
}
export const newPose = (): PoseState => ({
  t: 0,
  phase: 0,
  move: 0,
  atk: -1,
  kind: '',
  hurt: 0,
  dead: 0,
  kneel: 0,
  cast: 0,
  air: false,
  block: 0,
  rear: 0,
});
const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function kf(p: number, k: number[][]) {
  for (let i = 1; i < k.length; i++)
    if (p <= k[i][0]) {
      const t = (p - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      const e = t * t * (3 - 2 * t);
      return lerp(k[i - 1][1], k[i][1], e);
    }
  return k[k.length - 1][1];
}

export function pose(r: Rig, s: PoseState) {
  if (r.kind === 'serp') return poseSerp(r, s);
  if (r.kind === 'quad') return poseQuad(r, s);
  const S = Math.min(1.4, s.move),
    run = cl((S - 1) / 0.4, 0, 1),
    breath = Math.sin(s.t * 1.9),
    sw = Math.sin(s.phase) * 0.85 * S,
    idle = breath * 0.022 * (1 - Math.min(1, S) * 0.5),
    sway = Math.sin(s.phase) * S;
  r.body.position.set(0, 0, 0);
  r.body.rotation.set(0, 0, 0);
  r.legL.rotation.set(-sw - run * 0.12, 0, run * 0.02);
  r.legR.rotation.set(sw + run * 0.12, 0, -run * 0.02);
  r.shinL.rotation.x = Math.max(0, Math.cos(s.phase)) * (0.9 + run * 0.25) * S + 0.04;
  r.shinR.rotation.x = Math.max(0, -Math.cos(s.phase)) * (0.9 + run * 0.25) * S + 0.04;
  r.armL.rotation.set(sw * 0.82 + idle - run * 0.35, 0, 0.08 + sway * 0.035 + run * 0.05);
  r.foreL.rotation.set(-0.25 - S * 0.4 - run * 0.25, 0, 0);
  r.armR.rotation.set(-sw * 0.72 - 0.25 + run * 0.3, 0, -0.08 - sway * 0.035 - run * 0.05);
  r.foreR.rotation.set(-0.75 - S * 0.3 - run * 0.15, 0, 0);
  r.torso.rotation.set(S * 0.13 + idle + run * 0.1, Math.sin(s.phase) * 0.12 * S, sway * 0.025);
  const idleLook = Math.sin(s.t * 0.6) * 0.05 * (1 - Math.min(1, S));
  r.head.rotation.set(-idle * 0.4 - run * 0.06, idleLook + Math.sin(s.phase * 0.5) * 0.04 * S, -sway * 0.015);
  r.body.position.y = Math.abs(Math.sin(s.phase)) * (0.05 + run * 0.02) * S + breath * 0.006 * (1 - S);
  if (s.air) {
    r.legL.rotation.x = -0.7;
    r.legR.rotation.x = 0.35;
    r.shinL.rotation.x = 0.9;
    r.shinR.rotation.x = 0.7;
    r.armL.rotation.z = 0.7;
    r.armR.rotation.z = -0.5;
  }
  if (s.block > 0) {
    const b = s.block;
    r.armR.rotation.x = lerp(r.armR.rotation.x, -1.3, b);
    r.armR.rotation.z = lerp(r.armR.rotation.z, 0.5, b);
    r.foreR.rotation.x = lerp(r.foreR.rotation.x, -1.2, b);
    r.armL.rotation.x = lerp(r.armL.rotation.x, -1.0, b);
    r.torso.rotation.y = lerp(r.torso.rotation.y, 0.4, b);
  }
  if (s.cast > 0) {
    const c = s.cast;
    r.armL.rotation.set(lerp(r.armL.rotation.x, -1.55, c), 0, lerp(0.08, 0.15, c));
    r.armR.rotation.set(lerp(r.armR.rotation.x, -1.55, c), 0, -0.15 * c);
    r.foreL.rotation.x = lerp(r.foreL.rotation.x, -0.1, c);
    r.foreR.rotation.x = lerp(r.foreR.rotation.x, -0.1, c);
  }
  if (s.atk >= 0) {
    const p = Math.min(1, s.atk);
    switch (s.kind) {
      case 'slash1':
        r.armR.rotation.x = kf(p, [
          [0, -0.3],
          [0.4, -2.5],
          [0.62, -0.95],
          [1, -0.3],
        ]);
        r.armR.rotation.z = kf(p, [
          [0, -0.08],
          [0.4, -0.7],
          [0.62, 0.6],
          [1, -0.08],
        ]);
        r.foreR.rotation.x = kf(p, [
          [0, -0.7],
          [0.4, -1.0],
          [0.62, -0.2],
          [1, -0.7],
        ]);
        r.torso.rotation.y = kf(p, [
          [0, 0],
          [0.4, -0.7],
          [0.62, 0.8],
          [1, 0],
        ]);
        r.armL.rotation.x = kf(p, [
          [0, 0],
          [0.5, 0.8],
          [1, 0],
        ]);
        r.torso.rotation.x = kf(p, [
          [0, 0],
          [0.4, -0.08],
          [0.62, 0.2],
          [1, 0],
        ]);
        r.head.rotation.y = kf(p, [
          [0, 0],
          [0.4, 0.35],
          [0.62, -0.3],
          [1, 0],
        ]);
        r.legL.rotation.x = kf(p, [
          [0, 0],
          [0.5, -0.28],
          [1, 0],
        ]);
        r.legR.rotation.x = kf(p, [
          [0, 0],
          [0.5, 0.22],
          [1, 0],
        ]);
        break;
      case 'slash2':
        r.armR.rotation.x = kf(p, [
          [0, -0.3],
          [0.4, -1.9],
          [0.62, -1.0],
          [1, -0.3],
        ]);
        r.armR.rotation.z = kf(p, [
          [0, -0.08],
          [0.4, 0.95],
          [0.62, -0.8],
          [1, -0.08],
        ]);
        r.foreR.rotation.x = kf(p, [
          [0, -0.7],
          [0.4, -0.5],
          [0.62, -0.1],
          [1, -0.7],
        ]);
        r.torso.rotation.y = kf(p, [
          [0, 0],
          [0.4, 0.75],
          [0.62, -0.85],
          [1, 0],
        ]);
        r.torso.rotation.x = kf(p, [
          [0, 0],
          [0.4, 0.1],
          [0.62, -0.06],
          [1, 0],
        ]);
        r.head.rotation.y = kf(p, [
          [0, 0],
          [0.4, -0.3],
          [0.62, 0.3],
          [1, 0],
        ]);
        r.legR.rotation.x = kf(p, [
          [0, 0],
          [0.5, -0.25],
          [1, 0],
        ]);
        break;
      case 'stab':
        r.armR.rotation.x = kf(p, [
          [0, -0.3],
          [0.35, -0.9],
          [0.55, -1.55],
          [1, -0.3],
        ]);
        r.foreR.rotation.x = kf(p, [
          [0, -0.7],
          [0.35, -1.8],
          [0.55, 0],
          [1, -0.7],
        ]);
        r.torso.rotation.y = kf(p, [
          [0, 0],
          [0.35, -0.5],
          [0.55, 0.35],
          [1, 0],
        ]);
        r.torso.rotation.x = kf(p, [
          [0, 0],
          [0.55, 0.35],
          [1, 0],
        ]);
        r.legL.rotation.x = kf(p, [
          [0, 0],
          [0.5, -0.8],
          [1, 0],
        ]);
        r.legR.rotation.x = kf(p, [
          [0, 0],
          [0.5, 0.5],
          [1, 0],
        ]);
        r.head.rotation.x = kf(p, [
          [0, 0],
          [0.55, 0.18],
          [1, 0],
        ]);
        break;
      case 'overhead':
        r.armR.rotation.x = kf(p, [
          [0, -0.3],
          [0.45, -3.0],
          [0.65, -0.6],
          [1, -0.3],
        ]);
        r.armL.rotation.x = kf(p, [
          [0, 0],
          [0.45, -2.8],
          [0.65, -0.8],
          [1, 0],
        ]);
        r.armR.rotation.z = 0;
        r.foreR.rotation.x = kf(p, [
          [0, -0.7],
          [0.45, -0.3],
          [0.65, -0.1],
          [1, -0.7],
        ]);
        r.torso.rotation.x = kf(p, [
          [0, 0],
          [0.45, -0.35],
          [0.65, 0.65],
          [1, 0],
        ]);
        r.legL.rotation.x = kf(p, [
          [0, 0],
          [0.45, -0.35],
          [0.65, -0.1],
          [1, 0],
        ]);
        r.legR.rotation.x = kf(p, [
          [0, 0],
          [0.45, 0.25],
          [0.65, 0.1],
          [1, 0],
        ]);
        r.body.position.y = kf(p, [
          [0, 0],
          [0.45, 0.03],
          [0.65, -0.05],
          [1, 0],
        ]);
        break;
      case 'spin':
        r.armR.rotation.set(-1.4, 0, 1.4);
        r.armL.rotation.set(-1.4, 0, -1.4);
        r.foreR.rotation.x = 0;
        r.torso.rotation.x = 0.2;
        break;
      case 'plunge':
        r.armR.rotation.set(-3.0, 0, 0);
        r.armL.rotation.set(-3.0, 0, 0);
        r.legL.rotation.x = -0.3;
        r.legR.rotation.x = -0.1;
        r.torso.rotation.x = 0.4;
        break;
      case 'raise':
        r.armR.rotation.x = kf(p, [
          [0, -0.3],
          [0.5, -2.9],
          [1, -2.9],
        ]);
        r.foreR.rotation.x = -0.2;
        r.armL.rotation.x = kf(p, [
          [0, 0],
          [0.5, -2.2],
          [1, -2.2],
        ]);
        r.torso.rotation.x = -0.15;
        break;
    }
  }
  if (s.kneel > 0) {
    const k = s.kneel;
    r.legL.rotation.x = lerp(r.legL.rotation.x, -1.45, k);
    r.shinL.rotation.x = lerp(r.shinL.rotation.x, 1.9, k);
    r.legR.rotation.x = lerp(r.legR.rotation.x, -0.2, k);
    r.shinR.rotation.x = lerp(r.shinR.rotation.x, 1.8, k);
    r.body.position.y = -0.52 * k;
    r.torso.rotation.x = lerp(r.torso.rotation.x, 0.25, k);
    r.head.rotation.x = 0.45 * k;
    r.armL.rotation.set(lerp(r.armL.rotation.x, -0.8, k), 0, 0.1 * k);
    r.armR.rotation.set(lerp(r.armR.rotation.x, -0.8, k), 0, -0.1 * k);
    r.foreL.rotation.x = -1.1 * k;
    r.foreR.rotation.x = -1.1 * k;
  }
  if (s.hurt > 0) {
    r.torso.rotation.x -= s.hurt * 0.55;
    r.head.rotation.x -= s.hurt * 0.35;
    r.armL.rotation.z += s.hurt * 0.6;
    r.armR.rotation.z -= s.hurt * 0.6;
  }
  if (s.dead > 0) {
    const d = cl(s.dead);
    const e = d * d * (3 - 2 * d);
    r.body.rotation.x = -e * 1.5;
    r.body.position.y += e * 0.12;
    r.armL.rotation.z = e * 0.9;
    r.armR.rotation.z = -e * 0.9;
    r.legL.rotation.z = e * 0.2;
    r.legR.rotation.z = -e * 0.2;
  }
  if (r.cape) {
    r.cape.rotation.x = 0.12 + S * 0.55 + Math.sin(s.t * 3) * 0.05 + (s.atk >= 0 ? 0.3 : 0);
    r.cape.rotation.y = Math.sin(s.t * 1.7) * 0.07 + Math.sin(s.phase * 0.5) * 0.08 * S;
    r.cape.children.forEach((c, i) => {
      if (!c.userData.capePanel) return;
      c.rotation.z = Math.sin(s.t * 2.2 + i * 1.4) * 0.035 + (i - 1) * 0.02;
    });
  }
  if (r.extra.coat) {
    r.extra.coat.rotation.x = S * 0.25 * Math.max(0, Math.sin(s.phase)) + (s.atk >= 0 ? 0.14 : 0);
    r.extra.coat.children.forEach((c, i) => {
      if (!c.userData.coatPanel) return;
      c.rotation.z = Math.sin(s.t * 1.8 + i * 1.2) * 0.022;
    });
  }
  const au = r.extra.aura;
  if (au) {
    au.position.y = 0.88 + Math.sin(s.t * 1.5) * 0.02;
    au.children.forEach((c, i) => {
      c.scale.y = 1 + Math.sin(s.t * 6 + i * 2) * 0.1;
      c.rotation.y = s.t * (1 + i);
    });
  }
  const hl = r.extra.halo;
  if (hl) hl.rotation.z = s.t * 0.5;
}
function poseSerp(r: Rig, s: PoseState) {
  const sp = s.move,
    t = s.t * (2 + sp * 4);
  const n = r.segs.length;
  const rear = s.rear;
  r.body.rotation.set(0, 0, 0);
  r.body.position.set(0, 0, 0);
  r.segs.forEach((g, i) => {
    const k = i / n;
    g.position.x = Math.sin(t - i * 0.55) * (0.15 + 0.35 * (sp + 0.2)) * (0.3 + k) * r.height * 0.3;
    g.position.y = i < 4 ? rear * (1 - i / 4) * r.height * 0.5 : 0;
    g.rotation.y = Math.cos(t - i * 0.55) * 0.3;
    const L = g.userData.legs as THREE.Group[] | undefined;
    if (L)
      L.forEach((l) => {
        l.rotation.x = Math.sin(s.phase * 1.5 - i * 0.7 + (l.userData.s > 0 ? 0 : 1.5)) * 0.7;
      });
  });
  r.head.position.y = r.height * 0.3 + rear * r.height * 0.55;
  r.head.position.x = Math.sin(t) * 0.1;
  r.head.rotation.x =
    -rear * 0.7 +
    (s.atk >= 0
      ? kf(s.atk, [
          [0, 0],
          [0.4, -0.3],
          [0.6, 0.5],
          [1, 0],
        ])
      : 0);
  if (s.hurt > 0) r.body.position.z = -s.hurt * 0.2;
  if (s.dead > 0) {
    const e = cl(s.dead);
    r.body.rotation.z = e * 2.9;
    r.body.position.y = e * 0.2;
  }
  const au = r.extra.aura;
  if (au) au.children.forEach((c, i) => { c.scale.y = 1 + Math.sin(s.t * 5 + i * 2) * 0.1; c.rotation.y = s.t * (1 + i); });
}
function poseQuad(r: Rig, s: PoseState) {
  const S = Math.min(1.4, s.move);
  const sw = Math.sin(s.phase) * 0.9 * S;
  r.body.rotation.set(0, 0, 0);
  r.body.position.set(0, Math.abs(Math.sin(s.phase)) * 0.04 * S, 0);
  r.extra.l0.rotation.x = sw;
  r.extra.l3.rotation.x = sw;
  r.extra.l1.rotation.x = -sw;
  r.extra.l2.rotation.x = -sw;
  r.segs.forEach((g, i) => {
    g.rotation.y = Math.sin(s.t * 5 + i) * 0.35 * (0.3 + S);
  });
  r.head.rotation.x =
    s.atk >= 0
      ? kf(s.atk, [
          [0, 0],
          [0.4, -0.5],
          [0.6, 0.6],
          [1, 0],
        ])
      : 0;
  r.torso.rotation.x =
    s.atk >= 0
      ? kf(s.atk, [
          [0, 0],
          [0.4, -0.3],
          [0.6, 0.2],
          [1, 0],
        ])
      : 0;
  if (s.hurt > 0) r.torso.rotation.x = -s.hurt * 0.4;
  if (s.dead > 0) {
    const e = cl(s.dead);
    r.body.rotation.z = e * 3.0;
    r.body.position.y = 0.3 * e;
  }
  const au = r.extra.aura;
  if (au) au.children.forEach((c, i) => { c.scale.y = 1 + Math.sin(s.t * 5 + i * 2) * 0.1; c.rotation.y = s.t * (1 + i); });
}

// ---------------- Gates & misc ----------------
function swirlTex(color: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const col = new THREE.Color(color);
  const gr = g.createRadialGradient(128, 128, 5, 128, 128, 128);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.3, `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'lighter';
  g.lineWidth = 6;
  for (let k = 0; k < 5; k++) {
    g.beginPath();
    g.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.2})`;
    for (let a = 0; a < 6.3 * 1.5; a += 0.1) {
      const rr = 10 + a * 18 + k * 3;
      g.lineTo(128 + Math.cos(a + k * 1.256) * rr, 128 + Math.sin(a + k * 1.256) * rr);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}
export function makeGate(color: number, big = 1): THREE.Group {
  const g = new THREE.Group();
  const rad = 2.4 * big;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(rad, 40),
    new THREE.MeshBasicMaterial({
      map: swirlTex(color),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  disc.position.y = rad * 1.05;
  g.add(disc);
  g.userData.disc = disc;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.13 * big, 8, 40), mat(color, { basic: true }));
  ring.position.y = rad * 1.05;
  g.add(ring);
  g.userData.ring = ring;
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(rad * 1.12, 0.05 * big, 6, 40),
    mat(color, { add: true, op: 0.5 })
  );
  ring2.position.y = rad * 1.05;
  g.add(ring2);
  g.userData.ring2 = ring2;
  const ring3 = new THREE.Mesh(
    new THREE.TorusGeometry(rad * 0.82, 0.035 * big, 6, 40),
    mat(color, { add: true, op: 0.35 })
  );
  ring3.position.y = rad * 1.05;
  ring3.rotation.x = Math.PI / 2;
  g.add(ring3);
  g.userData.ring3 = ring3;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(rad * 0.7, rad * 1.1, 14, 16, 1, true),
    mat(color, { add: true, op: 0.1, side: true })
  );
  beam.position.y = 7;
  g.add(beam);
  const light = new THREE.PointLight(color, 20, 18, 1.6);
  light.position.y = rad * 1.05;
  g.add(light);
  g.userData.light = light;
  g.userData.rad = rad;
  return g;
}
export function makeLabel(
  text: string,
  o: { w?: number; h?: number; color?: string; bg?: string; font?: number; sub?: string } = {}
): THREE.Mesh {
  const W = 512,
    H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  if (o.bg) {
    g.fillStyle = o.bg;
    g.fillRect(0, 0, W, H);
  }
  g.fillStyle = o.color || '#9ad8ff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${o.font || 64}px "Segoe UI", Arial, sans-serif`;
  g.shadowColor = o.color || '#4ab4ff';
  g.shadowBlur = 12;
  g.fillText(text, W / 2, o.sub ? H * 0.38 : H / 2, W - 20);
  if (o.sub) {
    g.shadowBlur = 0;
    g.font = `bold ${(o.font || 64) * 0.5}px Arial`;
    g.fillStyle = '#e8f4ff';
    g.fillText(o.sub, W / 2, H * 0.78, W - 20);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(o.w ?? 4, o.h ?? 1),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  return m;
}

export function disposeObj(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!(m as any).isMesh && !(m as any).isPoints) return;
    if (m.geometry && !Object.values(geo).includes(m.geometry as any)) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((x: any) => {
      if (!x) return;
      if (x.map && !x.userData?.shared) x.map.dispose();
      if (x.emissiveMap) x.emissiveMap.dispose();
    });
  });
}
