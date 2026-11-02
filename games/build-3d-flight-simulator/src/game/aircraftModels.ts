import * as THREE from 'three';
import type { AircraftSpec, Livery } from './aircraft';
import { glowTexture } from './textures';

export interface NavLight { sprite: THREE.Sprite; kind: 'red' | 'green' | 'strobe' | 'beacon' | 'landing' | 'tail' }

export interface AircraftModel {
  root: THREE.Group;
  ailL: THREE.Object3D[];
  ailR: THREE.Object3D[];
  elev: THREE.Object3D[];
  rudder: THREE.Object3D[];
  flaps: THREE.Object3D[];
  gearNose: THREE.Object3D | null;
  gearL: THREE.Object3D | null;
  gearR: THREE.Object3D | null;
  props: THREE.Object3D[];
  propBlur: THREE.Mesh[];
  rotor: THREE.Object3D | null;
  rotorBlur: THREE.Mesh | null;
  tailRotor: THREE.Object3D | null;
  flames: THREE.Mesh[];
  lights: NavLight[];
  hide: THREE.Object3D[];
  exhaust: THREE.Vector3[];
  wingtips: THREE.Vector3[];
}

const _mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, rough = 0.5, metal = 0.15, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  let m = _mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    _mats.set(key, m);
  }
  return m;
}
const GLASS = () => mat(0x16293f, 0.12, 0.6, { emissive: 0x05101c });
const DARK = () => mat(0x1b1d21, 0.7, 0.3);
const METAL = () => mat(0x8a9099, 0.35, 0.8);

function shadow<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = false; }
  });
  return o;
}

/** Lathe fuselage; profile is [z, radius] from tail (+z) to nose (-z). */
function fuselage(profile: [number, number][], m: THREE.Material, scaleY = 1, seg = 20) {
  const pts = profile.map(([z, r]) => new THREE.Vector2(r, -z));
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateX(-Math.PI / 2);
  g.scale(1, scaleY, 1);
  const mm = m.clone();
  mm.side = THREE.DoubleSide;
  return new THREE.Mesh(g, mm);
}

interface WingOpts { span: number; root: number; tip: number; sweep: number; tRoot: number; tTip: number; dihedral?: number; side: 1 | -1 }
function wingGeo(o: WingOpts) {
  const { span, root, tip, sweep, tRoot, tTip, side } = o;
  const x = side * span;
  const y0 = span * Math.tan(o.dihedral ?? 0);
  const A = [0, tRoot / 2, 0], B = [0, tRoot / 2, root], Cc = [0, -tRoot / 2, 0], D = [0, -tRoot / 2, root];
  const E = [x, y0 + tTip / 2, sweep], F = [x, y0 + tTip / 2, sweep + tip], Gg = [x, y0 - tTip / 2, sweep], H = [x, y0 - tTip / 2, sweep + tip];
  const tris = [A, B, F, A, F, E, Cc, Gg, H, Cc, H, D, A, E, Gg, A, Gg, Cc, B, D, H, B, H, F, E, F, H, E, H, Gg];
  const arr = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => arr.set(v, i * 3));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

function wingMat(c: number) {
  const m = mat(c, 0.45, 0.2).clone();
  m.side = THREE.DoubleSide;
  return m;
}

function box(w: number, h: number, d: number, m: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}
function cyl(rt: number, rb: number, len: number, m: THREE.Material, seg = 14) {
  const g = new THREE.CylinderGeometry(rt, rb, len, seg);
  g.rotateX(Math.PI / 2); // axis along z
  return new THREE.Mesh(g, m);
}

function surface(w: number, chord: number, t: number, m: THREE.Material) {
  const pivot = new THREE.Group();
  const mesh = box(w, t, chord, m);
  mesh.position.z = chord / 2;
  pivot.add(mesh);
  return pivot;
}

function glow(color: number, size: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1);
  return s;
}

function gearLeg(len: number, wheelR: number, wheelW: number, twin: boolean, _m: THREE.Material) {
  const g = new THREE.Group();
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07 + wheelR * 0.1, 0.09 + wheelR * 0.1, len - wheelR, 8), METAL());
  strut.position.y = -(len - wheelR) / 2;
  g.add(strut);
  const offs = twin ? [-wheelW * 0.65, wheelW * 0.65] : [0];
  for (const ox of offs) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 14), DARK());
    w.rotation.z = Math.PI / 2;
    w.position.set(ox, -(len - wheelR), 0);
    g.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.5, wheelR * 0.5, wheelW * 1.05, 10), mat(0xb8bcc2, 0.4, 0.8));
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(w.position);
    g.add(hub);
  }
  return g;
}

function newModel(): AircraftModel {
  return {
    root: new THREE.Group(), ailL: [], ailR: [], elev: [], rudder: [], flaps: [], gearNose: null, gearL: null, gearR: null, props: [], propBlur: [],
    rotor: null, rotorBlur: null, tailRotor: null, flames: [], lights: [], hide: [], exhaust: [], wingtips: [],
  };
}

interface WingSet {
  attach: [number, number, number]; span: number; root: number; tip: number; sweep: number; tRoot: number; tTip: number; dihedral: number;
  flap?: [number, number]; ail?: [number, number]; chordFrac?: number; elevator?: boolean;
}

/** Adds a pair of wings with trailing-edge control surfaces. Returns pivots. */
function addWings(m: AircraftModel, ws: WingSet, wm: THREE.Material, sm: THREE.Material, parent: THREE.Object3D) {
  for (const side of [-1, 1] as const) {
    const g = new THREE.Mesh(wingGeo({ ...ws, side }), wm);
    g.position.set(ws.attach[0] * side, ws.attach[1], ws.attach[2]);
    parent.add(g);
    const teAt = (f: number) => ws.attach[2] + ws.sweep * f + ws.root + (ws.tip - ws.root) * f;
    const yAt = (f: number) => ws.attach[1] + ws.span * Math.tan(ws.dihedral) * f;
    const place = (range: [number, number], list: THREE.Object3D[]) => {
      const fc = (range[0] + range[1]) / 2;
      const chord = (ws.root + (ws.tip - ws.root) * fc) * (ws.chordFrac ?? 0.26);
      const s = surface((range[1] - range[0]) * ws.span, chord, Math.max(0.05, (ws.tRoot + (ws.tTip - ws.tRoot) * fc) * 0.6), sm);
      s.position.set(side * (ws.attach[0] + fc * ws.span), yAt(fc), teAt(fc) - chord * 0.35);
      parent.add(s);
      list.push(s);
      return s;
    };
    if (ws.flap) place(ws.flap, m.flaps);
    if (ws.ail) place(ws.ail, side < 0 ? m.ailL : m.ailR);
    m.wingtips.push(new THREE.Vector3(side * (ws.attach[0] + ws.span), yAt(1), ws.attach[2] + ws.sweep + ws.tip * 0.5));
  }
}

function addTail(
  m: AircraftModel, parent: THREE.Object3D, o: {
    stab: [number, number, number]; stabSpan: number; stabRoot: number; stabTip: number; stabSweep: number;
    fin: [number, number, number]; finSpan: number; finRoot: number; finTip: number; finSweep: number; thick: number;
  }, wm: THREE.Material, finMat: THREE.Material, sm: THREE.Material,
) {
  for (const side of [-1, 1] as const) {
    const g = new THREE.Mesh(wingGeo({ span: o.stabSpan, root: o.stabRoot, tip: o.stabTip, sweep: o.stabSweep, tRoot: o.thick, tTip: o.thick * 0.5, side }), wm);
    g.position.set(o.stab[0] * side, o.stab[1], o.stab[2]);
    parent.add(g);
    const fc = 0.5;
    const chord = (o.stabRoot + (o.stabTip - o.stabRoot) * fc) * 0.32;
    const s = surface(o.stabSpan * 0.9, chord, o.thick * 0.7, sm);
    s.position.set(side * (o.stab[0] + o.stabSpan * 0.5), o.stab[1], o.stab[2] + o.stabSweep * fc + o.stabRoot + (o.stabTip - o.stabRoot) * fc - chord * 0.35);
    parent.add(s);
    m.elev.push(s);
  }
  const fg = wingGeo({ span: o.finSpan, root: o.finRoot, tip: o.finTip, sweep: o.finSweep, tRoot: o.thick * 1.2, tTip: o.thick * 0.6, side: 1 });
  fg.rotateZ(Math.PI / 2);
  const fin = new THREE.Mesh(fg, finMat);
  fin.position.set(o.fin[0], o.fin[1], o.fin[2]);
  parent.add(fin);
  const fc = 0.5;
  const chord = (o.finRoot + (o.finTip - o.finRoot) * fc) * 0.3;
  const r = new THREE.Group();
  const rm = box(o.thick * 0.9, o.finSpan * 0.85, chord, finMat);
  rm.position.set(0, 0, chord / 2);
  r.add(rm);
  r.position.set(o.fin[0], o.fin[1] + o.finSpan * 0.5, o.fin[2] + o.finSweep * fc + o.finRoot + (o.finTip - o.finRoot) * fc - chord * 0.3);
  parent.add(r);
  m.rudder.push(r);
}

function engineNacelle(m: AircraftModel, parent: THREE.Object3D, x: number, y: number, z: number, r: number, len: number, body: THREE.Material, accent: THREE.Material, flame = false) {
  const n = cyl(r, r * 0.9, len, body, 16);
  n.position.set(x, y, z);
  parent.add(n);
  const intake = cyl(r * 0.8, r * 0.8, 0.1, DARK(), 16);
  intake.position.set(x, y, z - len / 2 - 0.02);
  parent.add(intake);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, r * 0.08, 6, 18), accent);
  ring.position.set(x, y, z - len / 2);
  parent.add(ring);
  const nozzle = cyl(r * 0.62, r * 0.7, 0.5, mat(0x3a3d42, 0.4, 0.8), 14);
  nozzle.position.set(x, y, z + len / 2 + 0.15);
  parent.add(nozzle);
  m.exhaust.push(new THREE.Vector3(x, y, z + len / 2 + 0.5));
  if (flame) addFlame(m, parent, x, y, z + len / 2 + 0.4, r * 0.55, r * 7);
}

function addFlame(m: AircraftModel, parent: THREE.Object3D, x: number, y: number, z: number, r: number, len: number) {
  const g = new THREE.ConeGeometry(r, len, 12, 1, true);
  g.translate(0, len / 2, 0);
  g.rotateX(Math.PI / 2);
  const outer = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  outer.position.set(x, y, z);
  const g2 = new THREE.ConeGeometry(r * 0.55, len * 0.6, 10, 1, true);
  g2.translate(0, len * 0.3, 0);
  g2.rotateX(Math.PI / 2);
  const inner = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  outer.add(inner);
  outer.visible = false;
  parent.add(outer);
  m.flames.push(outer);
}

function addLights(m: AircraftModel, wingL: THREE.Vector3, wingR: THREE.Vector3, tail: THREE.Vector3, top: THREE.Vector3, nose: THREE.Vector3, size: number) {
  const mk = (kind: NavLight['kind'], color: number, p: THREE.Vector3, s: number) => {
    const sp = glow(color, s);
    sp.position.copy(p);
    m.root.add(sp);
    m.lights.push({ sprite: sp, kind });
  };
  mk('red', 0xff2020, wingL, size);
  mk('green', 0x20ff40, wingR, size);
  mk('strobe', 0xffffff, wingL.clone().add(new THREE.Vector3(0, 0, 0.2)), size * 1.6);
  mk('strobe', 0xffffff, wingR.clone().add(new THREE.Vector3(0, 0, 0.2)), size * 1.6);
  mk('tail', 0xffffff, tail, size * 0.9);
  mk('beacon', 0xff3030, top, size * 1.4);
  mk('landing', 0xfff4d0, nose, size * 3);
}

/* ================================================================== */

export function buildAircraft(spec: AircraftSpec, lv: Livery): AircraftModel {
  const m = newModel();
  const body = mat(lv.primary, 0.35, 0.25);
  const second = mat(lv.secondary, 0.5, 0.2);
  const accent = mat(lv.accent, 0.4, 0.3);
  const wm = wingMat(lv.primary);
  const sm = mat(lv.accent === lv.primary ? lv.secondary : lv.secondary, 0.5, 0.2);
  const fin = mat(lv.accent, 0.4, 0.3);
  const R = m.root;

  switch (spec.cls) {
    case 'airliner': {
      const fus = fuselage([[18.75, 0.25], [15.5, 0.8], [11, 1.5], [7, 1.95], [3, 2.0], [-10, 2.0], [-13.5, 1.9], [-16.5, 1.35], [-18.7, 0.5]], body);
      R.add(fus);
      m.hide.push(fus);
      const belly = fuselage([[11, 1.45], [7, 1.9], [3, 1.96], [-10, 1.96], [-13, 1.85]], second, 0.92);
      belly.scale.set(1.01, 0.5, 1.01);
      belly.position.y = -0.95;
      R.add(belly);
      m.hide.push(belly);
      for (const s of [-1, 1]) {
        const win = box(0.05, 0.2, 25, mat(0x10161e, 0.2, 0.5));
        win.position.set(s * 1.96, 0.55, -2);
        R.add(win);
        m.hide.push(win);
        const stripe = box(0.04, 0.16, 28, accent);
        stripe.position.set(s * 1.96, -0.1, -1.5);
        R.add(stripe);
        m.hide.push(stripe);
      }
      const cw = box(1.9, 0.45, 1.3, GLASS());
      cw.position.set(0, 0.85, -16.4);
      cw.rotation.x = 0.35;
      R.add(cw);
      m.hide.push(cw);
      addWings(m, { attach: [1.6, -1.0, -3.2], span: 15.6, root: 6.4, tip: 1.6, sweep: 7.2, tRoot: 0.75, tTip: 0.22, dihedral: 0.06, flap: [0.1, 0.5], ail: [0.62, 0.94] }, wm, sm, R);
      const tailG = new THREE.Group();
      R.add(tailG);
      m.hide.push(tailG);
      addTail(m, tailG, { stab: [0.8, 0.8, 14.2], stabSpan: 6.2, stabRoot: 3.6, stabTip: 1.3, stabSweep: 3.4, fin: [0, 1.6, 10.8], finSpan: 6.2, finRoot: 6.8, finTip: 2.6, finSweep: 4.6, thick: 0.28 }, wm, fin, sm);
      for (const s of [-1, 1]) engineNacelle(m, R, s * 5.7, -2.2, -4.6, 1.15, 4.4, body, accent);
      // gear
      m.gearNose = gearLeg(2.0, 0.5, 0.35, true, DARK());
      m.gearNose.position.set(0, -1.6, -12.5);
      m.gearL = gearLeg(2.0, 0.55, 0.38, true, DARK());
      m.gearL.position.set(-3.8, -1.6, 1.0);
      m.gearR = gearLeg(2.0, 0.55, 0.38, true, DARK());
      m.gearR.position.set(3.8, -1.6, 1.0);
      R.add(m.gearNose, m.gearL, m.gearR);
      addLights(m, new THREE.Vector3(-17, 1.1, 4.4), new THREE.Vector3(17, 1.1, 4.4), new THREE.Vector3(0, 6.5, 18), new THREE.Vector3(0, 2.1, -3), new THREE.Vector3(0, -1.3, -13), 1.6);
      break;
    }
    case 'cargo': {
      const fus = fuselage([[22.4, 0.5], [19, 1.2], [15, 2.2], [11, 2.85], [6, 2.95], [-14, 2.95], [-18, 2.5], [-20.8, 1.4], [-22, 0.5]], body);
      R.add(fus);
      m.hide.push(fus);
      const band = fuselage([[8, 2.9], [3, 2.97], [-12, 2.97]], accent);
      band.scale.set(1.005, 0.12, 1.005);
      band.position.y = -0.4;
      R.add(band);
      m.hide.push(band);
      const nose = box(2.4, 0.9, 1.6, GLASS());
      nose.position.set(0, 1.3, -19.6);
      nose.rotation.x = 0.35;
      R.add(nose);
      m.hide.push(nose);
      addWings(m, { attach: [2.3, 2.4, -3.4], span: 21, root: 8, tip: 3.0, sweep: 5.5, tRoot: 1.1, tTip: 0.35, dihedral: -0.03, flap: [0.1, 0.52], ail: [0.62, 0.95], chordFrac: 0.24 }, wm, sm, R);
      const tailG = new THREE.Group();
      R.add(tailG);
      m.hide.push(tailG);
      addTail(m, tailG, { stab: [0.5, 9.4, 18.2], stabSpan: 7.8, stabRoot: 4.4, stabTip: 1.9, stabSweep: 3.6, fin: [0, 2.2, 14.2], finSpan: 7.5, finRoot: 8, finTip: 3.4, finSweep: 5.6, thick: 0.4 }, wm, fin, sm);
      for (const x of [-6.8, -14, 6.8, 14]) engineNacelle(m, R, x, 0.9, -5.5 - (Math.abs(x) > 10 ? -1 : 0), 1.05, 4.2, body, accent);
      m.gearNose = gearLeg(2.3, 0.6, 0.4, true, DARK());
      m.gearNose.position.set(0, -2.3, -15.5);
      m.gearL = gearLeg(2.3, 0.7, 0.45, true, DARK());
      m.gearL.position.set(-3.4, -2.3, 3.0);
      m.gearR = gearLeg(2.3, 0.7, 0.45, true, DARK());
      m.gearR.position.set(3.4, -2.3, 3.0);
      R.add(m.gearNose, m.gearL, m.gearR);
      const pods = [-1, 1].map((s) => {
        const p = box(1.5, 1.5, 7, body);
        p.position.set(s * 3.2, -1.6, 3);
        return p;
      });
      R.add(...pods);
      addLights(m, new THREE.Vector3(-23, 2.7, 3), new THREE.Vector3(23, 2.7, 3), new THREE.Vector3(0, 9.4, 21), new THREE.Vector3(0, 3, -4), new THREE.Vector3(0, -1.8, -16), 1.8);
      break;
    }
    case 'business': {
      const fus = fuselage([[8.75, 0.12], [6.8, 0.42], [4, 0.82], [0.5, 0.95], [-5, 0.95], [-6.7, 0.85], [-8, 0.45], [-8.75, 0.12]], body);
      R.add(fus);
      m.hide.push(fus);
      for (const s of [-1, 1]) {
        const win = box(0.04, 0.17, 7.5, mat(0x10161e, 0.2, 0.5));
        win.position.set(s * 0.93, 0.28, -1.5);
        R.add(win);
        m.hide.push(win);
        const st = box(0.04, 0.12, 12, accent);
        st.position.set(s * 0.95, -0.15, -0.5);
        R.add(st);
        m.hide.push(st);
      }
      const cw = box(1.1, 0.3, 0.8, GLASS());
      cw.position.set(0, 0.55, -6.6);
      cw.rotation.x = 0.4;
      R.add(cw);
      m.hide.push(cw);
      addWings(m, { attach: [0.85, -0.6, -1.2], span: 7.2, root: 3.1, tip: 1.1, sweep: 2.5, tRoot: 0.42, tTip: 0.14, dihedral: 0.05, flap: [0.1, 0.5], ail: [0.6, 0.94] }, wm, sm, R);
      const tailG = new THREE.Group();
      R.add(tailG);
      m.hide.push(tailG);
      addTail(m, tailG, { stab: [0.2, 3.9, 7.0], stabSpan: 2.7, stabRoot: 1.8, stabTip: 0.9, stabSweep: 1.4, fin: [0, 0.8, 5.0], finSpan: 3.3, finRoot: 3.4, finTip: 1.5, finSweep: 1.9, thick: 0.16 }, wm, fin, sm);
      for (const s of [-1, 1]) {
        engineNacelle(m, R, s * 1.5, 0.45, 4.7, 0.45, 2.4, body, accent);
        const pylon = box(0.5, 0.2, 1.8, body);
        pylon.position.set(s * 1.15, 0.4, 4.7);
        R.add(pylon);
      }
      m.gearNose = gearLeg(1.15, 0.22, 0.16, false, DARK());
      m.gearNose.position.set(0, -0.8, -5.5);
      m.gearL = gearLeg(1.15, 0.3, 0.2, true, DARK());
      m.gearL.position.set(-1.5, -0.8, 0.8);
      m.gearR = gearLeg(1.15, 0.3, 0.2, true, DARK());
      m.gearR.position.set(1.5, -0.8, 0.8);
      R.add(m.gearNose, m.gearL, m.gearR);
      addLights(m, new THREE.Vector3(-8, 0.5, 1.4), new THREE.Vector3(8, 0.5, 1.4), new THREE.Vector3(0, 4.2, 8), new THREE.Vector3(0, 1.0, -1), new THREE.Vector3(0, -0.6, -6), 0.9);
      break;
    }
    case 'fighter': {
      const fus = fuselage([[8.6, 0.38], [7.4, 0.66], [4, 0.8], [-1, 0.82], [-4.6, 0.62], [-7, 0.32], [-8.6, 0.05]], body, 0.95);
      R.add(fus);
      m.hide.push(fus);
      const can = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), GLASS());
      can.scale.set(0.5, 0.45, 1.7);
      can.position.set(0, 0.6, -3.2);
      R.add(can);
      m.hide.push(can);
      for (const s of [-1, 1]) {
        const intake = box(0.65, 0.7, 3.2, second);
        intake.position.set(s * 0.82, -0.35, -1.6);
        R.add(intake);
        m.hide.push(intake);
        const missile = cyl(0.1, 0.1, 3, mat(0xdde1e6, 0.4, 0.5), 8);
        missile.position.set(s * 2.4, -0.55, 0.6);
        R.add(missile);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8).rotateX(-Math.PI / 2), mat(0xdd3322, 0.5, 0.2));
        tip.position.set(s * 2.4, -0.55, -1.1);
        R.add(tip);
      }
      addWings(m, { attach: [0.55, -0.1, -1.6], span: 5.2, root: 6.0, tip: 1.2, sweep: 4.2, tRoot: 0.28, tTip: 0.1, dihedral: -0.04, flap: [0.1, 0.45], ail: [0.5, 0.92], chordFrac: 0.28 }, wm, sm, R);
      // stabilators (whole surface pivots)
      for (const s of [-1, 1] as const) {
        const piv = new THREE.Group();
        const g = new THREE.Mesh(wingGeo({ span: 2.6, root: 2.4, tip: 0.9, sweep: 1.6, tRoot: 0.14, tTip: 0.07, side: s }), wm);
        g.position.z = -1.0;
        piv.add(g);
        piv.position.set(s * 0.7, 0, 6.6);
        R.add(piv);
        m.elev.push(piv);
        m.hide.push(piv);
        const finG = wingGeo({ span: 2.5, root: 3.2, tip: 1.2, sweep: 1.9, tRoot: 0.14, tTip: 0.07, side: 1 });
        finG.rotateZ(Math.PI / 2);
        const f = new THREE.Mesh(finG, fin);
        f.position.set(s * 0.9, 0.5, 4.8);
        f.rotation.z = -s * 0.26;
        R.add(f);
        m.hide.push(f);
        const r = new THREE.Group();
        const rm = box(0.08, 1.9, 0.9, fin);
        rm.position.z = 0.45;
        r.add(rm);
        r.position.set(s * 0.9 + s * 0.3, 1.9, 4.8 + 1.0 + 3.2 * 0.55);
        r.rotation.z = -s * 0.26;
        R.add(r);
        m.rudder.push(r);
        m.hide.push(r);
        const noz = cyl(0.42, 0.5, 1.2, mat(0x30343a, 0.4, 0.8), 14);
        noz.position.set(s * 0.45, 0, 8.2);
        R.add(noz);
        m.hide.push(noz);
        m.exhaust.push(new THREE.Vector3(s * 0.45, 0, 8.9));
        addFlame(m, R, s * 0.45, 0, 8.7, 0.38, 4.2);
      }
      m.gearNose = gearLeg(1.15, 0.2, 0.14, false, DARK());
      m.gearNose.position.set(0, -0.9, -5.0);
      m.gearL = gearLeg(1.2, 0.3, 0.2, false, DARK());
      m.gearL.position.set(-1.5, -0.85, 1.8);
      m.gearR = gearLeg(1.2, 0.3, 0.2, false, DARK());
      m.gearR.position.set(1.5, -0.85, 1.8);
      R.add(m.gearNose, m.gearL, m.gearR);
      addLights(m, new THREE.Vector3(-5.6, -0.3, 3.5), new THREE.Vector3(5.6, -0.3, 3.5), new THREE.Vector3(0, 0.3, 8.8), new THREE.Vector3(0, 0.9, 1), new THREE.Vector3(0, -0.6, -5.5), 0.7);
      break;
    }
    case 'prop': {
      const fus = fuselage([[4.15, 0.28], [2.6, 0.32], [0.8, 0.55], [-1.2, 0.62], [-2.7, 0.52], [-3.7, 0.4], [-4.0, 0.32]], body);
      R.add(fus);
      m.hide.push(fus);
      const cowl = cyl(0.5, 0.54, 0.9, second, 16);
      cowl.position.set(0, 0, -3.95);
      R.add(cowl);
      m.hide.push(cowl);
      const cabin = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), GLASS());
      cabin.scale.set(0.58, 0.45, 1.25);
      cabin.position.set(0, 0.5, -0.3);
      R.add(cabin);
      m.hide.push(cabin);
      const stripe = box(1.28, 0.1, 6.2, accent);
      stripe.position.set(0, 0.12, 0.2);
      R.add(stripe);
      m.hide.push(stripe);
      addWings(m, { attach: [0.45, 0.78, -1.9], span: 5.1, root: 1.7, tip: 1.3, sweep: 0.3, tRoot: 0.24, tTip: 0.15, dihedral: 0.03, flap: [0.1, 0.5], ail: [0.55, 0.96], chordFrac: 0.3 }, wm, sm, R);
      for (const s of [-1, 1]) {
        const strut = box(0.07, 1.5, 0.12, METAL());
        strut.position.set(s * 1.5, 0.2, -1.1);
        strut.rotation.z = -s * 0.78;
        R.add(strut);
      }
      const tailG = new THREE.Group();
      R.add(tailG);
      m.hide.push(tailG);
      addTail(m, tailG, { stab: [0.15, 0.3, 3.3], stabSpan: 1.8, stabRoot: 1.1, stabTip: 0.8, stabSweep: 0.2, fin: [0, 0.3, 2.9], finSpan: 1.5, finRoot: 1.5, finTip: 0.8, finSweep: 0.8, thick: 0.1 }, wm, fin, sm);
      // propeller
      const prop = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const b = box(0.14, 1.9, 0.03, mat(0x222428, 0.5, 0.3));
        b.rotation.z = i * Math.PI / 2 * 0 + (i ? Math.PI : 0);
        b.position.y = 0;
        prop.add(b);
      }
      const spin = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 12).rotateX(-Math.PI / 2), mat(lv.accent, 0.3, 0.5));
      spin.position.z = -0.2;
      prop.add(spin);
      prop.position.set(0, 0, -4.45);
      R.add(prop);
      m.props.push(prop);
      const blur = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ color: 0x777c84, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      blur.position.set(0, 0, -4.46);
      R.add(blur);
      m.propBlur.push(blur);
      m.gearNose = gearLeg(1.0, 0.2, 0.12, false, DARK());
      m.gearNose.position.set(0, -0.45, -1.9);
      m.gearL = gearLeg(1.0, 0.22, 0.14, false, DARK());
      m.gearL.position.set(-1.15, -0.45, 0.5);
      m.gearR = gearLeg(1.0, 0.22, 0.14, false, DARK());
      m.gearR.position.set(1.15, -0.45, 0.5);
      R.add(m.gearNose, m.gearL, m.gearR);
      m.exhaust.push(new THREE.Vector3(0.3, -0.4, -2.5));
      addLights(m, new THREE.Vector3(-5.5, 0.85, -1.4), new THREE.Vector3(5.5, 0.85, -1.4), new THREE.Vector3(0, 0.5, 4.2), new THREE.Vector3(0, 1.6, 3.3), new THREE.Vector3(0, -0.3, -4.6), 0.6);
      break;
    }
    case 'helicopter': {
      const cab = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), body);
      cab.scale.set(1.15, 1.25, 2.7);
      cab.position.set(0, 0, -0.6);
      R.add(cab);
      m.hide.push(cab);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), GLASS());
      glass.scale.set(1.0, 0.9, 1.25);
      glass.position.set(0, 0.25, -2.35);
      R.add(glass);
      m.hide.push(glass);
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 6), accent);
      stripe.scale.set(1.17, 0.14, 2.72);
      stripe.position.set(0, -0.35, -0.6);
      R.add(stripe);
      m.hide.push(stripe);
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 6.8, 10).rotateX(Math.PI / 2), body);
      boom.position.set(0, 0.35, 4.9);
      R.add(boom);
      m.hide.push(boom);
      const finG = wingGeo({ span: 1.7, root: 1.5, tip: 0.8, sweep: 0.7, tRoot: 0.1, tTip: 0.06, side: 1 });
      finG.rotateZ(Math.PI / 2);
      const fn = new THREE.Mesh(finG, fin);
      fn.position.set(0, 0.35, 7.0);
      R.add(fn);
      m.hide.push(fn);
      const stab = new THREE.Mesh(wingGeo({ span: 1.2, root: 0.8, tip: 0.5, sweep: 0.2, tRoot: 0.08, tTip: 0.05, side: 1 }), wm);
      stab.position.set(0, 0.4, 6.0);
      const stab2 = new THREE.Mesh(wingGeo({ span: 1.2, root: 0.8, tip: 0.5, sweep: 0.2, tRoot: 0.08, tTip: 0.05, side: -1 }), wm);
      stab2.position.set(0, 0.4, 6.0);
      R.add(stab, stab2);
      m.hide.push(stab, stab2);
      // engines hump
      const hump = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), second);
      hump.scale.set(0.9, 0.6, 1.6);
      hump.position.set(0, 1.25, 0.2);
      R.add(hump);
      m.hide.push(hump);
      m.exhaust.push(new THREE.Vector3(0, 1.4, 1.8));
      // rotor
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), METAL());
      mast.position.set(0, 1.7, -0.3);
      R.add(mast);
      const rotor = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const b = box(0.4, 0.04, 6.9, mat(0x25282c, 0.5, 0.3));
        b.position.z = -3.5;
        const holder = new THREE.Group();
        holder.add(b);
        holder.rotation.y = (i * Math.PI) / 2;
        rotor.add(holder);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10), METAL());
      rotor.add(hub);
      rotor.position.set(0, 2.0, -0.3);
      R.add(rotor);
      m.rotor = rotor;
      const rb = new THREE.Mesh(new THREE.CircleGeometry(7, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x555a60, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      rb.position.set(0, 2.02, -0.3);
      R.add(rb);
      m.rotorBlur = rb;
      // tail rotor
      const tr = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const b = box(0.06, 1.6, 0.14, mat(0x25282c, 0.5, 0.3));
        b.rotation.x = i * Math.PI / 2;
        tr.add(b);
      }
      tr.position.set(0.28, 1.0, 7.1);
      R.add(tr);
      m.tailRotor = tr;
      // skids
      for (const s of [-1, 1]) {
        const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8).rotateX(Math.PI / 2), METAL());
        skid.position.set(s * 1.25, -1.6, 0);
        R.add(skid);
        const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8).rotateX(Math.PI / 2.8), METAL());
        nose.position.set(s * 1.25, -1.45, -2.2);
        R.add(nose);
        for (const z of [-1.1, 1.1]) {
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), METAL());
          st.position.set(s * 1.1, -1.05, z);
          st.rotation.z = s * 0.25;
          R.add(st);
        }
      }
      const gl = glow(0xfff4d0, 2.5);
      gl.position.set(0, -0.8, -2.8);
      R.add(gl);
      m.lights.push({ sprite: gl, kind: 'landing' });
      for (const [k, c, p] of [['red', 0xff2020, [-1.2, 0, -1]], ['green', 0x20ff40, [1.2, 0, -1]], ['tail', 0xffffff, [0, 0.4, 7.7]], ['beacon', 0xff3030, [0, 2.3, 0]], ['strobe', 0xffffff, [0, 0.9, 7.8]]] as const) {
        const sp = glow(c, k === 'beacon' ? 1 : 0.7);
        sp.position.set(p[0], p[1], p[2]);
        R.add(sp);
        m.lights.push({ sprite: sp, kind: k });
      }
      m.wingtips.push(new THREE.Vector3(0, 0.5, 7.5));
      break;
    }
  }
  shadow(R);
  // sprites should not cast shadows; blur discs neither
  m.propBlur.forEach((b) => (b.castShadow = false));
  if (m.rotorBlur) m.rotorBlur.castShadow = false;
  m.flames.forEach((f) => f.traverse((c) => (c.castShadow = false)));
  return m;
}

/** Cosmetic update of control surfaces / gear / props. */
export function animateModel(m: AircraftModel, spec: AircraftSpec, o: {
  pitch: number; roll: number; yaw: number; gear: number; flaps: number; propAngle: number; rotorAngle: number; rpm: number; throttle: number; ab: boolean; time: number; night: number; landingLight: boolean; cockpit: boolean;
}) {
  for (const e of m.elev) e.rotation.x = -o.pitch * 0.38;
  for (const a of m.ailL) a.rotation.x = o.roll * 0.45;
  for (const a of m.ailR) a.rotation.x = -o.roll * 0.45;
  for (const r of m.rudder) r.rotation.y = r.rotation.y * 0 + o.yaw * 0.4;
  for (const f of m.flaps) f.rotation.x = o.flaps * 0.75;
  const g = o.gear;
  if (m.gearNose) { m.gearNose.rotation.x = -(1 - g) * Math.PI / 2; m.gearNose.visible = g > 0.03; }
  if (m.gearL) { m.gearL.rotation.z = (1 - g) * Math.PI / 2; m.gearL.visible = g > 0.03; }
  if (m.gearR) { m.gearR.rotation.z = -(1 - g) * Math.PI / 2; m.gearR.visible = g > 0.03; }
  m.props.forEach((p) => (p.rotation.z = o.propAngle));
  const spinFast = Math.min(1, Math.max(0, (o.throttle - 0.1) * 1.6));
  m.propBlur.forEach((b) => ((b.material as THREE.MeshBasicMaterial).opacity = spinFast * 0.32));
  m.props.forEach((p) => p.children.forEach((c, i) => { if (i < 2) c.visible = spinFast < 0.85; }));
  if (m.rotor) {
    m.rotor.rotation.y = -o.rotorAngle;
    if (m.rotorBlur) (m.rotorBlur.material as THREE.MeshBasicMaterial).opacity = Math.min(0.28, o.rpm * 0.28);
    m.rotor.children.forEach((c) => { if (c !== m.rotor!.children[4]) c.visible = o.rpm < 0.75; });
  }
  if (m.tailRotor) m.tailRotor.rotation.x = o.rotorAngle * 3.5;
  const f = o.ab ? 1 : Math.max(0, (o.throttle - 0.55) / 0.45) * 0.5;
  for (const fl of m.flames) {
    fl.visible = f > 0.02 && spec.cls === 'fighter';
    fl.scale.set(1, 1, 0.5 + f * (0.8 + 0.2 * Math.sin(o.time * 60)));
  }
  const vis = !o.cockpit;
  for (const l of m.lights) {
    let on = true;
    let s = 1;
    switch (l.kind) {
      case 'strobe': on = (o.time % 1.2) < 0.08 || ((o.time % 1.2) > 0.18 && (o.time % 1.2) < 0.24); break;
      case 'beacon': on = (o.time % 1) < 0.5; break;
      case 'landing': on = o.landingLight; s = 1; break;
      default: on = true;
    }
    l.sprite.visible = on && vis;
    (l.sprite.material as THREE.SpriteMaterial).opacity = (l.kind === 'landing' ? 0.25 + 0.6 * o.night : 0.4 + 0.6 * o.night) * s;
  }
}

/** Simple 3D cockpit frame attached to the camera when in cockpit view. */
export function buildCockpit(spec: AircraftSpec) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.8, metalness: 0.2 });
  const dash = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.7, metalness: 0.2 });
  const emis = (c: number) => new THREE.MeshBasicMaterial({ color: c });
  const add = (mesh: THREE.Object3D, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
    return mesh;
  };
  const cls = spec.cls;
  const wide = cls === 'airliner' || cls === 'cargo' || cls === 'business';
  let yoke: THREE.Object3D;
  if (cls === 'fighter') {
    add(box(0.9, 0.36, 0.7, dash), 0, -0.52, -0.82, -0.25);
    add(box(0.55, 0.06, 0.28, dark), 0, -0.3, -0.9);
    add(box(0.035, 0.7, 0.04, dark), -0.46, 0.1, -0.95, 0, 0, -0.22);
    add(box(0.035, 0.7, 0.04, dark), 0.46, 0.1, -0.95, 0, 0, 0.22);
    add(box(1.0, 0.04, 0.04, dark), 0, 0.42, -0.9);
    add(box(0.04, 0.05, 1.5, dark), -0.62, -0.1, -0.2);
    add(box(0.04, 0.05, 1.5, dark), 0.62, -0.1, -0.2);
    yoke = new THREE.Group();
    yoke.add(box(0.03, 0.3, 0.03, dark));
    const knob = box(0.07, 0.07, 0.07, emis(0xaa3333));
    knob.position.y = 0.17;
    yoke.add(knob);
    add(yoke, 0.0, -0.5, -0.55);
  } else if (cls === 'helicopter') {
    add(box(1.5, 0.3, 0.6, dash), 0, -0.55, -0.85, -0.2);
    add(box(1.6, 0.05, 0.06, dark), 0, -0.34, -1.1);
    add(box(0.05, 0.9, 0.05, dark), -0.62, 0.05, -1.0, 0, 0, -0.25);
    add(box(0.05, 0.9, 0.05, dark), 0.62, 0.05, -1.0, 0, 0, 0.25);
    add(box(1.8, 0.05, 0.05, dark), 0, 0.56, -0.9);
    add(box(0.05, 0.05, 1.4, dark), 0, 0.57, -0.2);
    yoke = new THREE.Group();
    yoke.add(box(0.03, 0.38, 0.03, dark));
    const knob = box(0.1, 0.05, 0.1, dark);
    knob.position.y = 0.2;
    yoke.add(knob);
    add(yoke, 0.0, -0.45, -0.5);
  } else {
    const w = wide ? 1.9 : 1.5;
    add(box(w, 0.34, 0.7, dash), 0, -0.55, -0.9, -0.3);
    add(box(w, 0.06, 0.4, dark), 0, -0.36, -0.98);
    add(box(0.07, 0.85, 0.06, dark), -w * 0.42, 0.05, -1.0, 0, 0, -0.2);
    add(box(0.07, 0.85, 0.06, dark), w * 0.42, 0.05, -1.0, 0, 0, 0.2);
    add(box(0.06, 0.85, 0.06, dark), 0, 0.05, -1.05);
    add(box(w * 1.1, 0.06, 0.6, dark), 0, 0.55, -0.7);
    add(box(0.05, 0.06, 1.2, dark), -w * 0.5, 0.2, -0.2);
    add(box(0.05, 0.06, 1.2, dark), w * 0.5, 0.2, -0.2);
    yoke = new THREE.Group();
    const col = box(0.04, 0.04, 0.4, dark);
    yoke.add(col);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 20), dark);
    ring.position.z = 0.2;
    yoke.add(ring);
    add(yoke, wide ? -0.38 : -0.25, -0.38, -0.55);
  }
  // little instrument lights
  const cols = [0x41ff7a, 0xffb300, 0x33c3ff, 0xff4a4a];
  for (let i = 0; i < 10; i++) {
    const l = box(0.04, 0.025, 0.02, emis(cols[i % 4]));
    add(l, -0.35 + i * 0.075, -0.42 - (i % 2) * 0.05, -0.99 + (i % 2) * 0.01, -0.3);
  }
  g.traverse((c) => ((c as THREE.Mesh).isMesh ? ((c.castShadow = false), (c.frustumCulled = false)) : 0));
  g.renderOrder = 10;
  return { group: g, yoke };
}
