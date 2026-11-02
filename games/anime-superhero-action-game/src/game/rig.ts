import * as THREE from "three";
import { V3, clamp, damp, sstep } from "./core";

/* ---------- toon helpers ---------- */
const grad = (() => {
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const gc = new Map<string, THREE.BufferGeometry>();
const G_ = (k: string, f: () => THREE.BufferGeometry) => {
  let g = gc.get(k);
  if (!g) gc.set(k, (g = f()));
  return g;
};
export const cyl = (rt: number, rb: number, h: number, seg = 8) => G_(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const sph = (r: number, w = 12, h = 8) => G_(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
export const bx = (w: number, h: number, d: number) => G_(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cone = (r: number, h: number, seg = 6) => G_(`n${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const tor = (r: number, t: number) => G_(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 6, 20));
const cir = (r: number) => G_(`i${r}`, () => new THREE.CircleGeometry(r, 14));
const cap = (r: number) => G_(`p${r}`, () => new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.58));
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0b0814, side: THREE.BackSide });

export interface Rig {
  root: THREE.Group;
  hips: THREE.Group; torso: THREE.Group; head: THREE.Group;
  armL: THREE.Group; foreL: THREE.Group; armR: THREE.Group; foreR: THREE.Group;
  legL: THREE.Group; shinL: THREE.Group; legR: THREE.Group; shinR: THREE.Group;
  handL: THREE.Group; handR: THREE.Group;
  mats: THREE.MeshToonMaterial[];
  cur: Record<string, number>;
  phase: number;
  scale: number;
  height: number;
  upd: ((t: number, dt: number, a: any) => void)[];
  flash: (v: number) => void;
  setColor: (fn: (m: THREE.MeshToonMaterial) => void) => void;
}

const KEYS = ["tx", "ty", "tz", "hx", "hy", "alx", "alz", "elx", "arx", "arz", "erx", "lLx", "lLz", "lLk", "lRx", "lRz", "lRk", "hipY", "rx", "ry", "rz"];
const BASE: Record<string, number> = { alx: -0.12, alz: 0.14, elx: -0.35, arx: -0.12, arz: -0.14, erx: -0.35, lLz: 0.05, lRz: -0.05, tx: 0.03 };

export interface RigOpts {
  s?: number; bw?: number; skin?: number; hair?: number; hair2?: number; top?: number; pants?: number; boots?: number;
  accent?: number; eye?: number; hairStyle?: string; sleeveless?: boolean; ghost?: number; glowEye?: boolean; brow?: number; hairLen?: number;
  outline?: boolean; lowLod?: boolean; eyeSize?: number;
  deco?: (r: Rig, h: Helpers) => void;
}
export interface Helpers {
  add: (p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, pos?: number[], sc?: number[], rot?: number[], out?: boolean) => THREE.Mesh;
  mat: (c: number, e?: number, ei?: number) => THREE.MeshToonMaterial;
  basic: (c: number, o?: number) => THREE.MeshBasicMaterial;
  pivot: (p: THREE.Object3D, x: number, y: number, z: number) => THREE.Group;
}

export function buildHumanoid(o: RigOpts): Rig {
  const s = o.s ?? 0.88, bw = o.bw ?? 1;
  const root = new THREE.Group();
  const mats: THREE.MeshToonMaterial[] = [];
  const mat = (c: number, e = 0, ei = 0) => {
    const m = o.ghost !== undefined
      ? new THREE.MeshToonMaterial({ color: o.ghost, gradientMap: grad, emissive: e ? e : o.ghost, emissiveIntensity: e ? ei : 0.55, transparent: true, opacity: 0.86 })
      : new THREE.MeshToonMaterial({ color: c, gradientMap: grad, emissive: e, emissiveIntensity: ei });
    m.userData = { e: new THREE.Color(m.emissive), ei: m.emissiveIntensity };
    mats.push(m);
    return m;
  };
  const basic = (c: number, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op });
  const add = (p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, pos = [0, 0, 0], sc = [1, 1, 1], rot = [0, 0, 0], out = false) => {
    const me = new THREE.Mesh(g, m);
    me.position.set(pos[0], pos[1], pos[2]);
    me.scale.set(sc[0], sc[1], sc[2]);
    me.rotation.set(rot[0], rot[1], rot[2]);
    me.castShadow = true;
    if (out && o.outline && o.ghost === undefined) {
      const ol = new THREE.Mesh(g, outlineMat);
      ol.scale.setScalar(1.07);
      me.add(ol);
    }
    p.add(me);
    return me;
  };
  const pivot = (p: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  };
  const skinM = mat(o.skin ?? 0xf2c9a0), topM = mat(o.top ?? 0x333333), pantM = mat(o.pants ?? 0x222233), bootM = mat(o.boots ?? 0x111111);
  const hairM = mat(o.hair ?? 0x222222), hair2M = mat(o.hair2 ?? o.hair ?? 0x222222);
  const sleeve = o.sleeveless ? skinM : topM;
  const low = !!o.lowLod;

  const hips = pivot(root, 0, 0.94, 0);
  add(hips, bx(0.3 * bw, 0.16, 0.2), pantM, [0, 0, 0], [1, 1, 1], [0, 0, 0], true);
  const torso = pivot(hips, 0, 0.06, 0);
  add(torso, cyl(0.25 * bw, 0.17 * bw, 0.5, 8), topM, [0, 0.3, 0], [1, 1, 0.62], [0, 0, 0], true);
  add(torso, cyl(0.16 * bw, 0.15 * bw, 0.2, 8), topM, [0, 0.02, 0], [1, 1, 0.7]);
  const head = pivot(torso, 0, 0.64, 0);
  add(head, cyl(0.06, 0.07, 0.14, 6), skinM, [0, 0.02, 0]);
  const hd = add(head, sph(0.23), skinM, [0, 0.2, 0], [1, 1.04, 0.96], [0, 0, 0], true);
  void hd;
  // face
  const es = o.eyeSize ?? 1;
  for (const sx of [-1, 1]) {
    const eg = pivot(head, sx * 0.094, 0.19, 0.205);
    eg.rotation.y = sx * 0.4;
    if (!low) add(eg, cir(0.068 * es), basic(0xffffff), [0, 0, 0], [0.85, 1.12, 1]);
    add(eg, cir(0.05 * es), basic(o.eye ?? 0x2255ff), [0, -0.004, 0.003], [0.9, 1.15, 1]);
    if (!low) {
      add(eg, cir(0.022 * es), basic(0x050510), [0, -0.004, 0.006], [1, 1.2, 1]);
      add(eg, cir(0.012 * es), basic(0xffffff), [sx * -0.014, 0.016, 0.009]);
    }
    add(head, bx(0.085, 0.016, 0.01), mat(o.brow ?? o.hair ?? 0x222222), [sx * 0.098, 0.285, 0.2], [1, 1, 1], [0, sx * 0.4, sx * -0.22]);
  }
  // hair
  const hs = o.hairStyle ?? "spike";
  if (hs !== "none" && hs !== "helmet") add(head, cap(0.245), hairM, [0, 0.2, -0.015], [1, 1.04, 1], [0, 0, 0], true);
  const spike = (r: number, h: number, px: number, py: number, pz: number, rx: number, rz: number, m = hairM) => add(head, cone(r, h, 5), m, [px, py, pz], [1, 1, 1], [rx, 0, rz], true);
  if (hs === "kairo") {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, rr = 0.15;
      const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
      const out = Math.hypot(px, pz);
      spike(0.09, 0.42 + (i % 2) * 0.1, px, 0.38, pz - 0.02, Math.sin(a) * 0.55 + (pz < 0 ? -0.25 : 0), -Math.cos(a) * 0.55, i % 2 ? hair2M : hairM);
      void out;
    }
    spike(0.12, 0.6, 0, 0.44, -0.05, -0.55, 0, hair2M);
    for (const [x, y, r] of [[-0.12, 0.34, 0.25], [0, 0.35, 0], [0.12, 0.34, -0.25]]) spike(0.055, 0.2, x, y, 0.19, 2.6, r, hair2M);
    spike(0.07, 0.3, -0.2, 0.1, 0.0, 0, 0.9);
    spike(0.07, 0.3, 0.2, 0.1, 0.0, 0, -0.9);
    add(head, tor(0.235, 0.02), mat(0xd01818, 0xd01818, 0.4), [0, 0.28, 0], [1, 1.04, 0.96], [Math.PI / 2, 0, 0]);
  } else if (hs === "ryujin") {
    for (const [x, rz] of [[-0.12, 0.25], [0.02, 0], [0.14, -0.28]]) spike(0.07, 0.26, x, 0.31, 0.2, 2.5, rz, x > 0.05 ? hair2M : hairM);
    spike(0.09, 0.5, 0.22, 0.4, 0.05, -0.2, -1.0);
    spike(0.09, 0.4, -0.2, 0.4, 0.05, -0.2, 1.0);
    for (let i = 0; i < 5; i++) spike(0.08, 0.5, (i - 2) * 0.09, 0.42, -0.1, -0.9, 0, i === 3 ? hair2M : hairM);
  } else if (hs === "spike") {
    for (let i = 0; i < 5; i++) spike(0.07, 0.3, (i - 2) * 0.1, 0.4, -0.02, -0.2, (i - 2) * -0.3);
  } else if (hs === "mohawk") {
    for (let i = 0; i < 5; i++) spike(0.06, 0.34, 0, 0.43, -0.12 + i * 0.07, 0, 0);
  } else if (hs === "long") {
    for (let i = -2; i <= 2; i++) add(head, cyl(0.04, 0.012, 0.9, 5), hairM, [i * 0.08, -0.15, -0.2 - Math.abs(i) * 0.02], [1, 1, 1], [0.12, 0, i * 0.04]);
    for (let i = 0; i < 4; i++) spike(0.08, 0.34, (i - 1.5) * 0.12, 0.4, 0.0, -0.2, (i - 1.5) * -0.3);
  } else if (hs === "helmet") {
    const hm = mat(o.hair ?? 0x444444);
    add(head, sph(0.26), hm, [0, 0.2, -0.01], [1, 1.04, 1], [0, 0, 0], true);
    add(head, bx(0.3, 0.08, 0.06), mat(o.eye ?? 0x33ffff, o.eye ?? 0x33ffff, 1), [0, 0.2, 0.22]);
  }
  // shoulders
  const mkArm = (sx: number) => {
    const sh = pivot(torso, sx * 0.27 * bw, 0.52, 0);
    add(sh, sph(0.085 * bw), topM, [0, 0, 0], [1, 1, 1], [0, 0, 0], true);
    add(sh, cyl(0.065 * bw, 0.055 * bw, 0.3, 7), sleeve, [0, -0.15, 0], [1, 1, 1], [0, 0, 0], true);
    const fo = pivot(sh, 0, -0.3, 0);
    add(fo, cyl(0.055 * bw, 0.045 * bw, 0.28, 7), o.sleeveless ? skinM : sleeve, [0, -0.14, 0], [1, 1, 1], [0, 0, 0], true);
    const hand = pivot(fo, 0, -0.3, 0);
    add(hand, sph(0.058 * bw), skinM, [0, 0, 0], [1, 1.1, 1]);
    return { sh, fo, hand };
  };
  const aL = mkArm(1), aR = mkArm(-1);
  const mkLeg = (sx: number) => {
    const lg = pivot(hips, sx * 0.1 * bw, -0.02, 0);
    add(lg, cyl(0.105 * bw, 0.078 * bw, 0.46, 7), pantM, [0, -0.22, 0], [1, 1, 1], [0, 0, 0], true);
    const sn = pivot(lg, 0, -0.46, 0);
    add(sn, cyl(0.076 * bw, 0.055 * bw, 0.44, 7), pantM, [0, -0.22, 0], [1, 1, 1], [0, 0, 0], true);
    add(sn, cyl(0.07 * bw, 0.082 * bw, 0.22, 7), bootM, [0, -0.33, 0]);
    if (!low) add(sn, bx(0.13 * bw, 0.08, 0.27), bootM, [0, -0.41, 0.05], [1, 1, 1], [0, 0, 0], true);
    return { lg, sn };
  };
  const lL = mkLeg(1), lR = mkLeg(-1);
  root.scale.setScalar(s);
  const rig: Rig = {
    root, hips, torso, head, armL: aL.sh, foreL: aL.fo, armR: aR.sh, foreR: aR.fo, legL: lL.lg, shinL: lL.sn, legR: lR.lg, shinR: lR.sn,
    handL: aL.hand, handR: aR.hand, mats, cur: Object.fromEntries(KEYS.map((k) => [k, 0])), phase: Math.random() * 6, scale: s, height: 2.1 * s, upd: [],
    flash: (v: number) => {
      for (const m of mats) {
        m.emissive.copy(m.userData.e).lerp(new THREE.Color(0xffffff), v);
        m.emissiveIntensity = m.userData.ei + (1 - m.userData.ei) * v;
      }
    },
    setColor: (fn) => mats.forEach(fn),
  };
  root.userData.rig = rig;
  o.deco?.(rig, { add, mat, basic, pivot });
  return rig;
}

/* ---------- animation ---------- */
type Pose = Record<string, number>;
const ATK: Record<number, { w: Pose; s: Pose }> = {
  0: { w: { ty: -0.7, arx: 0.5, erx: -1.9, alx: -0.9, elx: -1.6, lLx: -0.35, lRx: 0.35 }, s: { ty: 0.6, arx: -1.5, erx: -0.05, arz: -0.1, alx: -0.9, elx: -1.8, lLx: -0.6, lRx: 0.5, tx: 0.2 } },
  1: { w: { ty: 0.7, alx: 0.5, elx: -1.9, arx: -0.9, erx: -1.6, lLx: 0.35, lRx: -0.35 }, s: { ty: -0.6, alx: -1.5, elx: -0.05, alz: 0.1, arx: -0.9, erx: -1.8, lLx: 0.5, lRx: -0.6, tx: 0.2 } },
  2: { w: { tx: -0.1, lRx: 0.5, lRk: 1.0, alx: -0.5, arx: -0.5, elx: -1.4, erx: -1.4 }, s: { lRx: -1.6, lRk: 0.15, lLk: 0.3, tx: -0.3, ty: 0.5, alx: 0.3, arx: -0.9, alz: 0.6, hipY: -0.03 } },
  3: { w: { alx: -2.8, arx: -2.8, elx: -0.4, erx: -0.4, tx: -0.35, lLx: -0.3, lRx: 0.3 }, s: { alx: -0.5, arx: -0.5, elx: -0.15, erx: -0.15, tx: 0.65, hipY: -0.12, lLx: -0.7, lRx: 0.4, lLk: 0.9 } },
  4: { w: { alx: -1.6, arx: -1.6, elx: -1.2, erx: -1.2, lLk: 1.0, lRk: 1.0, lLx: -0.6, lRx: -0.6 }, s: { alz: 1.4, arz: -1.4, alx: 0, arx: 0, elx: -0.1, erx: -0.1, lLk: 1.0, lRk: 1.0, lLx: -0.6, lRx: -0.5, tx: 0.2 } },
  5: { w: { alx: -0.4, arx: -0.4, elx: -1.8, erx: -1.8, tx: -0.3, lLx: -0.5, lRx: 0.5, hipY: -0.1 }, s: { alx: -1.55, arx: -1.55, elx: -0.1, erx: -0.1, tx: 0.35, lLx: -0.8, lRx: 0.6, lLk: 0.5, hipY: -0.12 } },
  6: { w: { arx: 0.2, erx: -2.0, alx: -1.4, elx: -1.2, ty: -0.9 }, s: { arx: -1.6, erx: -0.05, alx: -0.4, elx: -1.2, ty: 0.5, tx: 0.25, lLx: -0.5, lRx: 0.4 } },
  10: { w: { arx: -1.3, erx: -0.8, alx: -0.3, elx: -1.2, ty: -0.2 }, s: { arx: -1.55, erx: -0.05, alx: -0.4, elx: -1.3, ty: 0.25, tx: 0.08 } },
  11: { w: { arx: -1.0, alx: -1.0, erx: -1.6, elx: -1.6 }, s: { arx: -1.55, alx: -1.55, erx: -0.05, elx: -0.05, tx: 0.12, lLx: -0.3, lRx: 0.3 } },
  12: { w: { arx: -2.2, erx: -0.6, alx: -0.2, elx: -0.8, tx: -0.1 }, s: { arx: -2.95, erx: -0.1, alx: -0.2, elx: -0.8, tx: -0.2, hx: -0.3 } },
  13: { w: { alx: 0.4, arx: 0.4, tx: 0.2 }, s: { alx: 0.9, arx: 0.9, elx: -0.2, erx: -0.2, tx: 0.55, lLx: -0.4, lRx: 0.5 } },
  14: { w: { alz: 0.6, arz: -0.6, elx: -1.4, erx: -1.4, tx: -0.1 }, s: { alz: 1.3, arz: -1.3, alx: -0.5, arx: -0.5, elx: -0.3, erx: -0.3, hx: -0.3, tx: -0.2 } },
};
const wrap = (v: number) => ((((v + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

export function animate(rig: Rig, a: { mode: string; spd?: number; kind?: number; p?: number; t: number; k?: number; sprint?: boolean }, dt: number) {
  const T: Pose = { ...BASE };
  const spd = a.spd ?? 0, t = a.t;
  const set = (p: Pose, m = 1) => { for (const k in p) T[k] = (T[k] ?? 0) + p[k] * m; };
  let direct: Pose | null = null;
  switch (a.mode) {
    case "idle": {
      const b = Math.sin(t * 2.2 + rig.phase);
      set({ tx: b * 0.015, alx: b * 0.04, arx: b * 0.04, hipY: b * 0.012, hx: -0.02 });
      break;
    }
    case "walk":
    case "run": {
      rig.phase += dt * (4.5 + spd * 7.5);
      const ph = rig.phase, s_ = Math.sin(ph), c_ = Math.cos(ph);
      const amp = clamp(0.45 + spd * 0.6, 0, 1.25);
      T.lLx = -s_ * 0.95 * amp; T.lRx = s_ * 0.95 * amp;
      T.lLk = Math.max(0, c_) * 1.15 * amp + 0.08; T.lRk = Math.max(0, -c_) * 1.15 * amp + 0.08;
      T.alx = s_ * 0.85 * amp; T.arx = -s_ * 0.85 * amp;
      const eb = -0.4 - spd * 0.9;
      T.elx = eb; T.erx = eb;
      T.tx = 0.05 + spd * 0.2 + (a.sprint ? 0.15 : 0);
      T.ty = s_ * 0.15 * amp; T.hipY = -Math.abs(s_) * 0.045 * amp - spd * 0.05;
      T.alz = 0.1 + spd * 0.05; T.arz = -T.alz;
      break;
    }
    case "jump": set({ alz: 1.0, arz: -1.0, alx: -0.4, arx: -0.4, elx: -0.4, erx: -0.4, lLx: -0.55, lLk: 1.0, lRx: 0.2, lRk: 0.6, tx: 0.05 }); break;
    case "fall": set({ alz: 1.2, arz: -1.2, alx: 0.1, arx: 0.1, elx: -0.3, erx: -0.3, lLx: -0.25, lRx: 0.2, lLk: 0.4, lRk: 0.5, tx: 0.12, hx: -0.15 }); break;
    case "land": set({ hipY: -0.26, tx: 0.4, lLx: -0.8, lRx: -0.8, lLk: 1.6, lRk: 1.6, alx: -0.4, arx: -0.4, alz: 0.5, arz: -0.5 }); break;
    case "fly": {
      const f = clamp(spd, 0, 1);
      direct = { rx: 0.15 + f * 1.15 };
      set({ alx: -0.25 - f * 2.6, arx: -0.25 - f * 2.6, elx: -0.1, erx: -0.1, alz: 0.2 - f * 0.15, arz: -0.2 + f * 0.15, lLx: 0.15 + f * 0.1 + Math.sin(t * 7) * 0.04, lRx: 0.25 + f * 0.1, lLk: 0.3 + f * 0.1, lRk: 0.2, hx: -f * 0.9, tx: -f * 0.1 });
      break;
    }
    case "hover": {
      const b = Math.sin(t * 3 + rig.phase);
      set({ alz: 0.45, arz: -0.45, alx: 0.1, arx: 0.1, elx: -0.5, erx: -0.5, lLx: -0.1 + b * 0.05, lRx: 0.1 - b * 0.05, lLk: 0.35, lRk: 0.45, hipY: b * 0.03 });
      break;
    }
    case "atk": case "cast": {
      const p = a.p ?? 0, def = ATK[a.kind ?? 0] ?? ATK[0];
      const wp = sstep(0, 0.32, p), sp = sstep(0.3, 0.46, p), rec = a.mode === "cast" ? 1 - sstep(0.85, 1, p) : 1 - sstep(0.72, 1, p);
      for (const k in def.w) T[k] = (T[k] ?? 0) + def.w[k] * wp * (1 - sp) * rec;
      for (const k in def.s) T[k] = (T[k] ?? 0) + def.s[k] * sp * rec;
      if (a.kind === 4) direct = { ry: wrap(p * Math.PI * 2 * 1.25) };
      break;
    }
    case "charge": {
      const sh = Math.sin(t * 40) * 0.02;
      set({ alx: -1.0, arx: -1.0, alz: 0.8, arz: -0.8, elx: -1.8, erx: -1.8, tx: 0.18 + sh, lLz: 0.2, lRz: -0.2, lLk: 0.5, lRk: 0.5, hipY: -0.12 + sh, hx: -0.15 });
      break;
    }
    case "dodge": {
      const p = a.p ?? 0;
      direct = { rx: p * Math.PI * 2 };
      set({ alx: -1.4, arx: -1.4, elx: -1.6, erx: -1.6, lLx: -1.4, lRx: -1.4, lLk: 1.9, lRk: 1.9, tx: 0.5, hx: 0.3, hipY: -0.25 });
      break;
    }
    case "hit": set({ tx: -0.45, hx: -0.4, alx: 0.5, arx: 0.5, alz: 0.5, arz: -0.5, elx: -0.8, erx: -0.8, lLx: -0.2, lRx: 0.3, lLk: 0.3, hipY: -0.05 }); break;
    case "stun": set({ tx: -0.2 + Math.sin(t * 9) * 0.15, tz: Math.sin(t * 7) * 0.2, hx: 0.3, alx: 0.3, arx: 0.3, elx: -0.4, erx: -0.4, hipY: -0.1 }); break;
    case "victory": set({ arx: -2.9 + Math.sin(t * 6) * 0.1, arz: -0.3, erx: -0.25, alx: -0.2, alz: 0.5, elx: -1.4, tx: -0.08, hx: -0.18, lLz: 0.12, lRz: -0.12 }); break;
    case "pose": set({ arx: -1.2, erx: -2.1, alx: -0.4, alz: 0.35, elx: -1.9, ty: -0.2, hx: 0.05, lLz: 0.15, lRz: -0.15, tx: 0.05 }); break;
    case "dead": direct = { rx: -1.5 }; set({ hipY: -0.77, alz: 0.9, arz: -0.9, lLz: 0.2, lRz: -0.2, hx: 0.2 }); break;
    case "roar": set({ alz: 1.25, arz: -1.25, elx: -0.5, erx: -0.5, hx: -0.5, tx: -0.3, lLz: 0.15, lRz: -0.15, hipY: -0.05 + Math.sin(t * 30) * 0.015 }); break;
    case "shoot": set({ arx: -1.45, erx: -0.25, alx: -1.25, elx: -1.0, ty: 0.3, tx: 0.05, lLx: -0.2, lRx: 0.25 }); break;
    case "float": {
      const b = Math.sin(t * 2 + rig.phase);
      set({ alz: 0.5, arz: -0.5, elx: -0.7, erx: -0.7, lLx: 0.05, lRx: 0.1, lLk: 0.1, lRk: 0.1, hipY: b * 0.05, tx: 0.05 });
      break;
    }
  }
  const k = a.k ?? 14;
  rig.cur.rx = wrap(rig.cur.rx);
  rig.cur.ry = wrap(rig.cur.ry);
  const c = rig.cur;
  for (const key of KEYS) {
    const tv = T[key] ?? 0;
    if (direct && key in direct) c[key] = direct[key];
    else if ((key === "rx" || key === "ry") && Math.abs(c[key]) > 0.01) c[key] = damp(c[key], 0, k, dt);
    else c[key] = damp(c[key], tv, k, dt);
  }
  rig.hips.position.y = 0.94 + c.hipY;
  rig.hips.rotation.set(c.rx, c.ry, c.rz);
  rig.torso.rotation.set(c.tx, c.ty, c.tz);
  rig.head.rotation.set(c.hx, c.hy, 0);
  rig.armL.rotation.set(c.alx, 0, c.alz);
  rig.foreL.rotation.x = c.elx;
  rig.armR.rotation.set(c.arx, 0, c.arz);
  rig.foreR.rotation.x = c.erx;
  rig.legL.rotation.set(c.lLx, 0, c.lLz);
  rig.shinL.rotation.x = c.lLk;
  rig.legR.rotation.set(c.lRx, 0, c.lRz);
  rig.shinR.rotation.x = c.lRk;
  for (const u of rig.upd) u(t, dt, a);
}

/* ---------- characters ---------- */
const NEON = (c: number) => c;
const skins = [0xf2c9a0, 0xe0a97a, 0xc68a5e, 0xf7d9bd, 0x9a6a48];

function scarf(rig: Rig, h: Helpers, color: number, color2: number, n = 6, len = 0.22, wid = 0.2) {
  let parent: THREE.Object3D = rig.torso;
  const segs: THREE.Group[] = [];
  h.add(rig.torso, cyl(0.14, 0.16, 0.1, 8), h.mat(color), [0, 0.6, 0], [1, 1, 0.8]);
  for (let i = 0; i < n; i++) {
    const g = h.pivot(parent, 0, i === 0 ? 0.58 : 0, i === 0 ? -0.14 : -len);
    h.add(g, bx(wid * (1 - i * 0.05), 0.03, len + 0.01), h.mat(i % 2 ? color2 : color, i % 2 ? color2 : color, 0.4), [0, 0, -len / 2]);
    segs.push(g);
    parent = g;
  }
  rig.upd.push((t, _dt, a) => {
    const sp = clamp(a.spd ?? 0, 0, 1.3);
    segs.forEach((g, i) => {
      g.rotation.x = -(0.95 - sp * 0.8) * (i === 0 ? 1.2 : 0.35) + Math.sin(t * (6 + sp * 8) - i * 0.9) * (0.08 + sp * 0.14);
      g.rotation.y = Math.sin(t * 3 - i * 0.7) * 0.1;
    });
  });
}
function cape(rig: Rig, h: Helpers, color: number, color2: number, w = 0.55, l = 0.95, from = 0.5) {
  const g = h.pivot(rig.torso, 0, from, -0.16);
  const m = h.add(g, bx(w, l, 0.025), h.mat(color), [0, -l / 2, 0]);
  h.add(m, bx(w * 0.9, 0.05, 0.03), h.mat(color2, color2, 0.4), [0, -l / 2 + 0.03, 0]);
  rig.upd.push((t, _dt, a) => {
    const sp = clamp(a.spd ?? 0, 0, 1.4);
    g.rotation.x = 0.1 + sp * 0.8 + Math.sin(t * (4 + sp * 6)) * (0.04 + sp * 0.12);
    g.rotation.z = Math.sin(t * 2.5) * 0.04;
  });
}
function tails(rig: Rig, h: Helpers, color: number, trim: number, l = 0.8) {
  for (const [x, w, z] of [[0, 0.22, -0.16], [-0.12, 0.16, -0.12], [0.12, 0.16, -0.12]]) {
    const g = h.pivot(rig.hips, x, -0.05, z);
    const m = h.add(g, bx(w, l, 0.03), h.mat(color), [0, -l / 2, 0], [1, 1, 1], [0, 0, 0], true);
    h.add(m, bx(w, 0.04, 0.035), h.mat(trim, trim, 0.7), [0, -l / 2 + 0.02, 0]);
    rig.upd.push((t, _dt, a) => {
      const sp = clamp(a.spd ?? 0, 0, 1.4);
      g.rotation.x = 0.08 + sp * 0.75 + Math.sin(t * 5 + x * 9) * (0.05 + sp * 0.1);
      g.rotation.z = x * 0.8 * (0.3 + sp * 0.4);
    });
  }
}
function wings(rig: Rig, h: Helpers, color: number, glowc: number) {
  const ws: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const g = h.pivot(rig.torso, sx * 0.12, 0.45, -0.18);
    h.add(g, bx(0.9, 0.03, 0.3), h.mat(color), [sx * 0.45, 0, 0], [1, 1, 1], [0, 0, sx * -0.1]);
    h.add(g, bx(0.6, 0.03, 0.2), h.mat(color), [sx * 0.7, 0, -0.2], [1, 1, 1], [0, sx * 0.4, 0]);
    h.add(g, bx(0.9, 0.03, 0.04), h.mat(glowc, glowc, 1), [sx * 0.45, 0.02, 0.15]);
    ws.push(g);
  }
  h.add(rig.torso, bx(0.3, 0.35, 0.16), h.mat(0x333a4a), [0, 0.35, -0.2]);
  for (const sx of [-1, 1]) h.add(rig.torso, cyl(0.06, 0.08, 0.15, 6), h.mat(glowc, glowc, 1), [sx * 0.09, 0.15, -0.28], [1, 1, 1], [Math.PI / 2, 0, 0]);
  rig.upd.push((t, _dt, a) => {
    ws.forEach((g, i) => { g.rotation.z = (i ? 1 : -1) * (0.3 + Math.sin(t * 9) * 0.25 * (1 - clamp(a.spd ?? 0, 0, 0.6))); g.rotation.x = 0.15; });
  });
}
function weaponR(rig: Rig, h: Helpers, kind: string) {
  const hand = rig.handR;
  if (kind === "bat") { h.add(hand, cyl(0.04, 0.06, 0.8, 6), h.mat(0x8a5a2a), [0, -0.1, 0.25], [1, 1, 1], [-1.2, 0, 0]); }
  if (kind === "pipe") { h.add(hand, cyl(0.03, 0.03, 0.9, 6), h.mat(0x777777), [0, -0.1, 0.3], [1, 1, 1], [-1.3, 0, 0]); }
  if (kind === "katana") {
    h.add(hand, cyl(0.02, 0.02, 0.16, 6), h.mat(0x222222), [0, 0, 0.0]);
    h.add(hand, bx(0.025, 0.012, 0.85), h.mat(0xdde8ff, 0x99aaff, 0.6), [0, -0.05, 0.45], [1, 1, 1], [0.2, 0, 0]);
  }
  if (kind === "sword") {
    h.add(hand, bx(0.04, 0.04, 0.2), h.mat(0xffd23f, 0xffd23f, 0.5), [0, 0, 0.0]);
    h.add(hand, bx(0.3, 0.04, 0.05), h.mat(0xffd23f, 0xffd23f, 0.5), [0, -0.05, 0.1]);
    h.add(hand, bx(0.07, 0.025, 1.2), h.basic(0xff5588), [0, -0.05, 0.75]);
    h.add(hand, bx(0.14, 0.04, 1.2), h.basic(0xff5588, 0.35), [0, -0.05, 0.75]);
  }
  if (kind === "rifle") {
    h.add(hand, bx(0.1, 0.14, 0.7), h.mat(0x2a3a4a), [0, -0.05, 0.3]);
    h.add(hand, cyl(0.035, 0.035, 0.5, 6), h.mat(0x33ffff, 0x33ffff, 1), [0, -0.03, 0.85], [1, 1, 1], [Math.PI / 2, 0, 0]);
    h.add(hand, bx(0.05, 0.1, 0.15), h.mat(0x33ffff, 0x33ffff, 1), [0, 0.06, 0.2]);
  }
}

const SPECS: Record<string, () => RigOpts> = {
  kairo: () => ({
    s: 0.88, skin: 0xf4cfa8, hair: 0xff7a1a, hair2: 0xffd23f, top: 0x1d1d28, pants: 0x2b2c3b, boots: 0xd8421a, accent: 0xff6a1a, eye: 0xff9a10, hairStyle: "kairo", sleeveless: true, outline: true, eyeSize: 1.15, brow: 0x8a3a10,
    deco: (r, h) => {
      scarf(r, h, 0xff6a1a, 0xffd23f);
      // jacket trim & emblem
      h.add(r.torso, bx(0.1, 0.52, 0.02), h.mat(0xd01818), [0, 0.3, 0.17], [1, 1, 1]);
      h.add(r.torso, bx(0.46, 0.05, 0.3), h.mat(0xffd23f, 0xffd23f, 0.3), [0, 0.06, 0], [1, 1, 1]);
      h.add(r.torso, sph(0.05), h.mat(0xffd23f, 0xffd23f, 1), [0, 0.05, 0.16]);
      // gauntlets
      for (const [f, hd] of [[r.foreL, r.handL], [r.foreR, r.handR]] as const) {
        h.add(f, cyl(0.075, 0.085, 0.2, 7), h.mat(0xff6a1a, 0xff4a00, 0.9), [0, -0.17, 0], [1, 1, 1], [0, 0, 0], true);
        h.add(hd, sph(0.075), h.mat(0xff5a10, 0xff4a00, 0.8), [0, 0, 0]);
      }
      // coat tails short
      for (const x of [-0.1, 0.1]) { const g = h.pivot(r.hips, x, -0.05, -0.14); h.add(g, bx(0.15, 0.4, 0.03), h.mat(0x1d1d28), [0, -0.2, 0]); r.upd.push((t, _d, a) => { g.rotation.x = 0.1 + clamp(a.spd ?? 0, 0, 1.4) * 0.7 + Math.sin(t * 6) * 0.05; }); }
      // shoulder pads
      h.add(r.armL, sph(0.12), h.mat(0xffd23f, 0xffd23f, 0.3), [0.02, 0.02, 0], [1, 0.7, 1], [0, 0, 0], true);
      h.add(r.armR, sph(0.12), h.mat(0xffd23f, 0xffd23f, 0.3), [-0.02, 0.02, 0], [1, 0.7, 1], [0, 0, 0], true);
    },
  }),
  ryujin: () => ({
    s: 0.88, skin: 0xe9d4c6, hair: 0x0e0d16, hair2: 0x8a5cff, top: 0x15131f, pants: 0x0f0f18, boots: 0x07070b, accent: 0x8a5cff, eye: 0x3fd0ff, hairStyle: "ryujin", outline: true, eyeSize: 1.0, brow: 0x0e0d16,
    deco: (r, h) => {
      tails(r, h, 0x15131f, 0x8a5cff, 0.85);
      // high collar
      h.add(r.torso, cyl(0.15, 0.2, 0.14, 8), h.mat(0x15131f), [0, 0.62, -0.03], [1, 1, 0.9], [0, 0, 0], true);
      // glowing lines
      for (const x of [-0.07, 0.07]) h.add(r.torso, bx(0.015, 0.5, 0.02), h.basic(0x8a5cff), [x, 0.3, 0.175]);
      h.add(r.torso, bx(0.36, 0.015, 0.02), h.basic(0x3fd0ff), [0, 0.25, 0.17]);
      h.add(r.torso, sph(0.045), h.basic(0x3fd0ff), [0, 0.42, 0.17]);
      for (const f of [r.foreL, r.foreR]) {
        h.add(f, cyl(0.07, 0.08, 0.17, 7), h.mat(0x1e1b2e), [0, -0.19, 0], [1, 1, 1], [0, 0, 0], true);
        h.add(f, bx(0.02, 0.15, 0.02), h.basic(0x3fd0ff), [0, -0.19, 0.075]);
      }
      // ponytail
      const pt = h.pivot(r.head, 0, 0.3, -0.2);
      const seg: THREE.Group[] = [];
      let par: THREE.Object3D = pt;
      for (let i = 0; i < 4; i++) {
        const g = h.pivot(par, 0, i ? -0.2 : 0, 0);
        h.add(g, cone(0.07 - i * 0.012, 0.3, 5), h.mat(i === 3 ? 0x8a5cff : 0x0e0d16, i === 3 ? 0x8a5cff : 0, 0.4), [0, -0.1, 0], [1, 1, 1], [Math.PI, 0, 0]);
        seg.push(g); par = g;
      }
      r.upd.push((t, _d, a) => { const sp = clamp(a.spd ?? 0, 0, 1.4); seg.forEach((g, i) => { g.rotation.x = 0.5 + sp * 0.6 + Math.sin(t * 5 - i) * 0.1; g.rotation.z = Math.sin(t * 3 - i * 0.6) * 0.1; }); pt.rotation.x = 0.4; });
      // shoulder spikes
      for (const arm of [r.armL, r.armR]) h.add(arm, cone(0.05, 0.28, 5), h.mat(0x1e1b2e, 0x8a5cff, 0.3), [0, 0.1, 0], [1, 1, 1], [0, 0, (arm === r.armL ? -1 : 1) * 0.9], true);
    },
  }),
  criminal: () => {
    const c = [0xb33a3a, 0x3a6ab3, 0x4a4a4a, 0xb3883a, 0x3a8a5a][Math.floor(Math.random() * 5)];
    return {
      s: 0.9, skin: skins[Math.floor(Math.random() * skins.length)], hair: [0x222222, 0x6a3a1a, 0xd8b04a, 0x1a1a3a][Math.floor(Math.random() * 4)], top: c, pants: 0x2b3342, boots: 0x222222, accent: 0x000000, eye: 0x331100, hairStyle: Math.random() < 0.4 ? "mohawk" : "spike", lowLod: true, brow: 0x111111,
      deco: (r, h) => {
        if (Math.random() < 0.5) weaponR(r, h, Math.random() < 0.5 ? "bat" : "pipe");
        if (Math.random() < 0.5) h.add(r.head, cyl(0.24, 0.24, 0.08, 10), h.mat(0x222222), [0, 0.33, 0]);
        h.add(r.torso, bx(0.3, 0.5, 0.02), h.mat(0xffffff), [0, 0.3, 0.17], [0.0, 0, 0]);
      },
    };
  },
  assassin: () => ({
    s: 0.9, skin: 0xe0b090, hair: 0xff4a1a, top: 0x3a0f10, pants: 0x1a1010, boots: 0x6a1a10, accent: 0xff4a10, eye: 0xffaa22, hairStyle: "spike", lowLod: true, brow: 0x300,
    deco: (r, h) => {
      h.add(r.head, cyl(0.235, 0.25, 0.2, 8), h.mat(0x3a0f10), [0, 0.12, 0.0], [1, 1, 0.95]);
      h.add(r.head, bx(0.3, 0.14, 0.04), h.mat(0xff4a10, 0xff3a00, 0.9), [0, 0.1, 0.2]);
      scarf(r, h, 0xff4a10, 0xffb020, 4, 0.2, 0.16);
      for (const hd of [r.handL, r.handR]) h.add(hd, sph(0.09), h.mat(0xff5a10, 0xff3a00, 1), [0, 0, 0]);
    },
  }),
  ninja: () => ({
    s: 0.88, skin: 0xd8b8a0, hair: 0x111122, top: 0x14142a, pants: 0x101020, boots: 0x08080f, accent: 0xa060ff, eye: 0xc060ff, hairStyle: "none", lowLod: true,
    deco: (r, h) => {
      h.add(r.head, sph(0.245), h.mat(0x14142a), [0, 0.2, -0.01], [1, 1.04, 1]);
      h.add(r.head, bx(0.3, 0.12, 0.05), h.mat(0xd8b8a0), [0, 0.2, 0.2], [1, 1, 1]);
      for (const sx of [-1, 1]) h.add(r.head, bx(0.08, 0.025, 0.02), h.basic(0xc060ff), [sx * 0.09, 0.21, 0.235]);
      h.add(r.head, bx(0.5, 0.05, 0.03), h.mat(0xa060ff, 0xa060ff, 0.6), [0, 0.3, -0.2], [1, 1, 1]);
      h.add(r.torso, bx(0.07, 0.9, 0.05), h.mat(0x222233), [0.1, 0.25, -0.2], [1, 1, 1], [0, 0, 0.9]);
      weaponR(r, h, "katana");
      scarf(r, h, 0xa060ff, 0x14142a, 5, 0.2, 0.14);
    },
  }),
  brute: () => ({
    s: 1.35, bw: 1.65, skin: 0xc9966a, hair: 0x331a0a, top: 0xc9966a, pants: 0x4a3a2a, boots: 0x222222, accent: 0xff8a20, eye: 0xff2200, hairStyle: "mohawk", sleeveless: true, lowLod: true, brow: 0x111111,
    deco: (r, h) => {
      h.add(r.torso, bx(0.62, 0.1, 0.4), h.mat(0x333333), [0, 0.04, 0]);
      for (const a of [r.armL, r.armR]) h.add(a, sph(0.17), h.mat(0x555a66), [0, 0.04, 0], [1, 0.8, 1]);
      for (const hd of [r.handL, r.handR]) h.add(hd, sph(0.13), h.mat(0x444a55), [0, -0.03, 0]);
      h.add(r.torso, cone(0.06, 0.2, 5), h.mat(0x888888), [0.2, 0.62, -0.05], [1, 1, 1], [0, 0, -0.6]);
      h.add(r.torso, cone(0.06, 0.2, 5), h.mat(0x888888), [-0.2, 0.62, -0.05], [1, 1, 1], [0, 0, 0.6]);
    },
  }),
  gunner: () => ({
    s: 0.9, skin: 0xd8b49a, hair: 0x22c0c0, top: 0x1f3a46, pants: 0x1a2630, boots: 0x111a20, accent: 0x33ffff, eye: 0x33ffff, hairStyle: "helmet", lowLod: true,
    deco: (r, h) => {
      weaponR(r, h, "rifle");
      h.add(r.torso, bx(0.4, 0.3, 0.05), h.mat(0x2a4a5a, 0x33ffff, 0.25), [0, 0.35, 0.16]);
      h.add(r.torso, bx(0.25, 0.4, 0.12), h.mat(0x2a4a5a), [0, 0.3, -0.18]);
      h.add(r.armL, sph(0.1), h.mat(0x2a4a5a, 0x33ffff, 0.2), [0, 0.02, 0]);
    },
  }),
  hunter: () => ({
    s: 0.9, skin: 0xe6cbb5, hair: 0x2d3a5a, top: 0x2d3a5a, pants: 0x222a40, boots: 0x111522, accent: 0xff3a6a, eye: 0xff3a6a, hairStyle: "helmet", lowLod: true,
    deco: (r, h) => { wings(r, h, 0x3c4a70, 0xff3a6a); h.add(r.head, cyl(0.01, 0.01, 0.4, 4), h.mat(0xff3a6a, 0xff3a6a, 1), [0.18, 0.5, -0.05]); },
  }),
  commander: () => ({
    s: 1.15, bw: 1.2, skin: 0xd8a888, hair: 0xe8e8f0, hair2: 0xffd23f, top: 0x7a1020, pants: 0x2a1018, boots: 0x15080c, accent: 0xffd23f, eye: 0xff2a4a, hairStyle: "long", outline: true, lowLod: false,
    deco: (r, h) => {
      cape(r, h, 0x5a0a18, 0xffd23f, 0.62, 1.1);
      for (const a of [r.armL, r.armR]) h.add(a, sph(0.16), h.mat(0xffd23f, 0xffd23f, 0.3), [0, 0.04, 0], [1.1, 0.7, 1], [0, 0, 0], true);
      h.add(r.torso, bx(0.46, 0.4, 0.06), h.mat(0xffd23f, 0xffd23f, 0.25), [0, 0.35, 0.17], [1, 1, 1], [0, 0, 0], true);
      h.add(r.head, cone(0.05, 0.32, 5), h.mat(0xffd23f, 0xffd23f, 0.3), [-0.18, 0.43, 0], [1, 1, 1], [0, 0, 0.5]);
      h.add(r.head, cone(0.05, 0.32, 5), h.mat(0xffd23f, 0xffd23f, 0.3), [0.18, 0.43, 0], [1, 1, 1], [0, 0, -0.5]);
      weaponR(r, h, "sword");
    },
  }),
  titan: () => ({
    s: 2.9, bw: 1.9, skin: 0x8a6a62, hair: 0x2a1a1a, top: 0x8a6a62, pants: 0x3a3038, boots: 0x1a1418, accent: 0xff5a10, eye: 0xff4400, hairStyle: "mohawk", sleeveless: true, outline: true, brow: 0x000000,
    deco: (r, h) => {
      for (const a of [r.armL, r.armR]) { h.add(a, sph(0.2), h.mat(0x4a4450), [0, 0.05, 0], [1, 0.8, 1.1], [0, 0, 0], true); for (let i = 0; i < 3; i++) h.add(a, cone(0.06, 0.28, 5), h.mat(0x6a6470), [(a === r.armL ? 1 : -1) * 0.1, 0.18, (i - 1) * 0.1], [1, 1, 1], [0, 0, (a === r.armL ? -1 : 1) * 0.5], true); }
      for (const hd of [r.handL, r.handR]) h.add(hd, sph(0.16), h.mat(0x4a4450), [0, -0.03, 0], [1, 1, 1], [0, 0, 0], true);
      for (let i = 0; i < 5; i++) h.add(r.torso, bx(0.03, 0.2, 0.02), h.basic(0xff5a10), [(i - 2) * 0.1, 0.3 + (i % 2) * 0.08, 0.2], [1, 1, 1], [0, 0, (i - 2) * 0.2]);
      h.add(r.torso, bx(0.8, 0.12, 0.5), h.mat(0x333038, 0xff5a10, 0.3), [0, 0.02, 0], [1, 1, 1], [0, 0, 0], true);
      for (const sx of [-1, 1]) h.add(r.head, cone(0.06, 0.3, 5), h.mat(0xddd8cc), [sx * 0.2, 0.38, 0], [1, 1, 1], [0, 0, -sx * 0.7]);
    },
  }),
  reaper: () => ({
    s: 1.45, skin: 0xcfd0e0, hair: 0x120a22, top: 0x120a22, pants: 0x120a22, boots: 0x0a0614, accent: 0xb040ff, eye: 0xff2255, hairStyle: "none", outline: true, brow: 0x000000,
    deco: (r, h) => {
      const dark = h.mat(0x120a22, 0x2a0a50, 0.4);
      h.add(r.head, cyl(0.26, 0.34, 0.38, 8), dark, [0, 0.22, -0.04], [1, 1, 1], [0, 0, 0], true);
      h.add(r.head, sph(0.25), dark, [0, 0.28, -0.05], [1, 1, 1]);
      h.add(r.head, bx(0.28, 0.24, 0.05), h.mat(0xeeeeff), [0, 0.18, 0.2], [1, 1, 1], [0, 0, 0], true);
      for (const sx of [-1, 1]) h.add(r.head, bx(0.07, 0.04, 0.03), h.basic(0xff2255), [sx * 0.07, 0.2, 0.24]);
      const cl = h.pivot(r.hips, 0, 0, 0);
      h.add(cl, cone(0.5, 1.5, 8), dark, [0, -0.6, -0.02], [1, 1, 0.8], [0, 0, 0], true);
      h.add(r.torso, cone(0.5, 0.5, 8), dark, [0, 0.62, -0.02], [1, 1, 0.7], [Math.PI, 0, 0]);
      for (const hd of [r.handL, r.handR]) h.add(hd, sph(0.07), h.mat(0xb040ff, 0xb040ff, 1));
      // scythe-blade
      const hand = r.handR;
      h.add(hand, cyl(0.02, 0.02, 1.6, 5), h.mat(0x333333), [0, 0, 0.1], [1, 1, 1], [Math.PI / 2, 0, 0]);
      h.add(hand, bx(0.04, 0.05, 0.9), h.basic(0xb040ff), [0, 0.1, 0.95], [1, 1, 1], [0.9, 0, 0]);
      h.add(hand, bx(0.1, 0.1, 0.9), h.basic(0xb040ff, 0.3), [0, 0.1, 0.95], [1, 1, 1], [0.9, 0, 0]);
      r.upd.push((t) => { cl.position.y = Math.sin(t * 2) * 0.03; });
      // legs hidden by cloak
      for (const l of [r.legL, r.legR]) l.visible = false;
      // orbiting blades
      const orb = h.pivot(r.torso, 0, 0.3, 0);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; h.add(orb, cone(0.06, 0.5, 4), h.basic(0xb040ff), [Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7], [1, 1, 1], [Math.PI, a, 0]); }
      r.upd.push((t) => { orb.rotation.y = t * 1.5; });
    },
  }),
  zero: () => ({
    s: 1.65, bw: 1.15, skin: 0xf0e4dc, hair: 0xf4f4ff, hair2: 0xffd23f, top: 0xf0f0fa, pants: 0xdcdcee, boots: 0xffd23f, accent: 0xffd23f, eye: 0xff3355, hairStyle: "long", outline: true, brow: 0x999999,
    deco: (r, h) => {
      const gold = h.mat(0xffd23f, 0xffb800, 0.6);
      cape(r, h, 0xf4f4ff, 0xffd23f, 0.7, 1.2);
      for (const a of [r.armL, r.armR]) h.add(a, sph(0.17), gold, [0, 0.04, 0], [1.1, 0.7, 1], [0, 0, 0], true);
      h.add(r.torso, bx(0.5, 0.3, 0.06), gold, [0, 0.35, 0.17], [1, 1, 1], [0, 0, 0], true);
      h.add(r.torso, sph(0.07), h.basic(0xff3355), [0, 0.38, 0.22]);
      const halo = h.add(r.head, tor(0.4, 0.025), h.basic(0xffd23f), [0, 0.7, -0.05], [1, 1, 1], [Math.PI / 2, 0, 0]);
      r.upd.push((t) => { halo.rotation.z = t * 0.8; });
      const bl = h.pivot(r.torso, 0, 0.4, -0.3);
      const blades: THREE.Object3D[] = [];
      for (let i = 0; i < 6; i++) { const m = h.add(bl, cone(0.07, 0.9, 4), h.basic(i % 2 ? 0xffd23f : 0xffffff), [0, 0, 0], [1, 1, 1], [0, 0, 0]); blades.push(m); }
      r.upd.push((t) => { blades.forEach((b, i) => { const a = (i - 2.5) * 0.35; b.position.set(Math.sin(a) * 1.1, 0.2 + Math.cos(a) * 0.5 + Math.sin(t * 2 + i) * 0.05, -0.1); b.rotation.set(0, 0, -a + Math.PI); }); });
      for (const hd of [r.handL, r.handR]) h.add(hd, sph(0.08), h.basic(0xffd23f));
    },
  }),
};

// shadow allies
const SH: Record<string, { s: number; bw: number; col: number; hair: string; deco?: (r: Rig, h: Helpers) => void; name: string }> = {
  warrior: { s: 0.95, bw: 1.05, col: 0x2a1250, hair: "spike", name: "Shadow Warrior", deco: (r, h) => weaponR(r, h, "katana") },
  soldier: { s: 0.88, bw: 1, col: 0x1a0c3a, hair: "mohawk", name: "Abyss Soldier", deco: (r, h) => weaponR(r, h, "katana") },
  grunt: { s: 0.95, bw: 1.1, col: 0x351a60, hair: "mohawk", name: "Shadow Grunt" },
  ember: { s: 0.95, bw: 1, col: 0x4a1030, hair: "spike", name: "Ember Wraith", deco: (r, h) => { for (const hd of [r.handL, r.handR]) h.add(hd, sph(0.1), h.basic(0xff7a2a)); } },
  blade: { s: 0.9, bw: 0.95, col: 0x1a1040, hair: "none", name: "Phantom Blade", deco: (r, h) => { weaponR(r, h, "katana"); scarf(r, h, 0x8a5cff, 0x1a1040, 5, 0.2, 0.14); } },
  colossus: { s: 1.6, bw: 1.7, col: 0x25104a, hair: "mohawk", name: "Shadow Colossus", deco: (r, h) => { for (const a of [r.armL, r.armR]) h.add(a, sph(0.17), h.mat(0x3a2070), [0, 0.04, 0]); } },
  sniper: { s: 0.9, bw: 0.95, col: 0x0d2a40, hair: "helmet", name: "Shadow Sniper", deco: (r, h) => weaponR(r, h, "rifle") },
  raven: { s: 0.9, bw: 0.9, col: 0x1a0c3a, hair: "helmet", name: "Shadow Raven", deco: (r, h) => wings(r, h, 0x2a1250, 0x8a5cff) },
  knight: { s: 1.2, bw: 1.25, col: 0x2a1560, hair: "long", name: "Shadow Knight", deco: (r, h) => { cape(r, h, 0x3a2080, 0x8a5cff, 0.6, 1.0); weaponR(r, h, "sword"); } },
};
export const SHADOW_NAMES: Record<string, string> = Object.fromEntries(Object.entries(SH).map(([k, v]) => [k, v.name]));

export function buildChar(kind: string): Rig {
  if (kind.startsWith("sh_")) {
    const d = SH[kind.slice(3)] ?? SH.warrior;
    return buildHumanoid({ s: d.s, bw: d.bw, ghost: d.col, hairStyle: d.hair, eye: 0xc9a0ff, lowLod: true, deco: d.deco, top: d.col, pants: d.col, boots: d.col, hair: d.col, skin: d.col });
  }
  if (kind === "clone") {
    return buildHumanoid({ ...SPECS.reaper(), ghost: 0x2a0a55, outline: false, s: 1.3 });
  }
  const spec = SPECS[kind] ?? SPECS.criminal;
  void NEON;
  return buildHumanoid(spec());
}

/* ---------- civilians (cheap) ---------- */
export interface CivRig {
  root: THREE.Group; armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group; body: THREE.Group; phase: number;
}
export function buildCivilian(): CivRig {
  const root = new THREE.Group();
  const col = new THREE.Color().setHSL(Math.random(), 0.55, 0.55);
  const pc = new THREE.Color().setHSL(Math.random(), 0.3, 0.3);
  const sk = new THREE.MeshToonMaterial({ color: skins[Math.floor(Math.random() * skins.length)], gradientMap: grad });
  const tm = new THREE.MeshToonMaterial({ color: col, gradientMap: grad });
  const pm = new THREE.MeshToonMaterial({ color: pc, gradientMap: grad });
  const hm = new THREE.MeshToonMaterial({ color: new THREE.Color().setHSL(Math.random() < 0.5 ? 0.08 : Math.random(), 0.5, 0.25 + Math.random() * 0.3), gradientMap: grad });
  const body = new THREE.Group();
  body.position.y = 0.9;
  root.add(body);
  const m = (g: THREE.BufferGeometry, mt: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = body) => { const me = new THREE.Mesh(g, mt); me.position.set(x, y, z); p.add(me); return me; };
  m(cyl(0.2, 0.15, 0.55, 7), tm, 0, 0.3, 0).scale.z = 0.65;
  m(sph(0.17), sk, 0, 0.77, 0);
  m(cap(0.19), hm, 0, 0.78, -0.01);
  const mk = (_sx: number, y: number, len: number, mt: THREE.Material, px: number) => {
    const g = new THREE.Group(); g.position.set(px, y, 0); body.add(g);
    m(cyl(0.055, 0.045, len, 6), mt, 0, -len / 2, 0, g);
    return g;
  };
  const armL = mk(1, 0.52, 0.5, tm, 0.25), armR = mk(-1, 0.52, 0.5, tm, -0.25);
  const legL = mk(1, 0.02, 0.9, pm, 0.09), legR = mk(-1, 0.02, 0.9, pm, -0.09);
  root.scale.setScalar(0.92 + Math.random() * 0.15);
  return { root, armL, armR, legL, legR, body, phase: Math.random() * 6 };
}
export const _unused = V3;
