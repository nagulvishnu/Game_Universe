import * as THREE from 'three';
import { glowTex } from './textures';
import { buildWeapon } from './weaponModels';

export interface RigOpts { kind: string; main: number; accent: number; skin?: number; bulk?: number; scale: number; hover?: number }
export interface HeldWeapon { group: THREE.Group; second?: THREE.Group; grip2: THREE.Vector3 }

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
const shared = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, .5, 0), sph: new THREE.SphereGeometry(1, 12, 9), box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 8).translate(0, .5, 0),
};

export class Rig {
  root = new THREE.Group(); upper = new THREE.Group(); ub = new THREE.Group(); pivR = new THREE.Group(); pivL = new THREE.Group();
  arms: { up: THREE.Mesh; lo: THREE.Mesh; hand: THREE.Mesh }[] = []; legs: { th: THREE.Group; sh: THREE.Group }[] = [];
  mats: THREE.MeshStandardMaterial[] = []; accentMat: THREE.MeshStandardMaterial; skinMat: THREE.MeshStandardMaterial; clothMat: THREE.MeshStandardMaterial; armorMat: THREE.MeshStandardMaterial;
  cur = { R: [0, 0, 0, 0, 0, 0, 0, 0], L: [0, 0, 0, 0, 0, 0, 0, 0] }; inited = false;
  phase = 0; held: HeldWeapon | null = null; extras: ((t: number, dt: number) => void)[] = []; cape: THREE.Mesh | null = null; scarf: THREE.Mesh[] = [];
  bulk: number; hover = 0; noLegs = false; flashC = new THREE.Color(); sh = [new THREE.Vector3(), new THREE.Vector3()];
  hasLeftPiv = false; scale: number;

  constructor(public o: RigOpts) {
    this.bulk = o.bulk ?? 1; this.scale = o.scale; const b = this.bulk;
    const mk = (c: number, r = .6, m = .3) => { const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); this.mats.push(x); return x; };
    this.skinMat = mk(o.skin ?? 0xe8b896, .7, 0); this.clothMat = mk(o.main, .7, .1);
    this.armorMat = mk(new THREE.Color(o.main).multiplyScalar(1.5).getHex(), .35, .85);
    this.accentMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: o.accent, emissiveIntensity: 2, roughness: .4 });
    this.root.scale.setScalar(o.scale); this.root.add(this.upper); this.upper.position.y = .95; this.upper.add(this.ub); this.ub.position.y = -.95;
    this.ub.add(this.pivR, this.pivL);
    const M = (g: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], s: [number, number, number], parent: THREE.Object3D = this.ub) => { const m = new THREE.Mesh(g, mat); m.position.set(...p); m.scale.set(...s); m.castShadow = true; parent.add(m); return m; };
    const kind = o.kind; this.noLegs = kind === 'titanboss'; this.hover = o.hover ?? 0;
    // torso
    M(shared.sph, this.clothMat, [0, 1.22, 0], [.24 * b, .3, .17 * b]); M(shared.cyl, this.clothMat, [0, .98, 0], [.19 * b, .3, .14 * b]);
    M(shared.box, this.armorMat, [0, 1.3, .06 * b], [.3 * b, .24, .1]); M(shared.cyl, this.armorMat, [0, 1.0, 0], [.21 * b, .06, .16 * b]);
    M(shared.sph, this.accentMat, [0, 1.3, .12 * b], [.05, .05, .03]);
    // head
    const head = new THREE.Group(); head.position.set(0, 1.7, 0); this.ub.add(head);
    M(shared.sph, this.skinMat, [0, 0, 0], [.14, .16, .15], head); M(shared.cyl, this.skinMat, [0, -.17, 0], [.06, .1, .06], head);
    this.dress(kind, head, M, b);
    // arms
    for (let i = 0; i < 2; i++) {
      const arm = { up: M(shared.cyl, this.clothMat, [0, 0, 0], [.065 * Math.sqrt(b), 1, .065 * Math.sqrt(b)]), lo: M(shared.cyl, this.armorMat, [0, 0, 0], [.058 * Math.sqrt(b), 1, .058 * Math.sqrt(b)]), hand: M(shared.sph, this.skinMat, [0, 0, 0], [.07, .07, .07]) };
      this.arms.push(arm); const s = i === 0 ? -1 : 1; this.sh[i].set(s * .3 * b, 1.45, 0);
      M(shared.sph, this.armorMat, [s * .31 * b, 1.46, 0], [.13 * b, .11 * b, .13 * b]);
    }
    // legs
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1, th = new THREE.Group(); th.position.set(s * .14 * b, .95, 0); this.root.add(th);
      M(shared.cyl, this.clothMat, [0, 0, 0], [.085 * b, .47, .085 * b], th).rotation.x = Math.PI; // cyl base at y=0 extends +y; flip down
      const sh = new THREE.Group(); sh.position.set(0, -.47, 0); th.add(sh);
      M(shared.cyl, this.armorMat, [0, 0, 0], [.07 * b, .47, .07 * b], sh).rotation.x = Math.PI; M(shared.box, this.armorMat, [0, -.5, .05], [.1 * b, .07, .22], sh);
      this.legs.push({ th, sh }); if (this.noLegs) th.visible = false;
    }
    this.root.traverse(ob => { if ((ob as THREE.Mesh).isMesh) (ob as THREE.Mesh).frustumCulled = true; });
  }

  private dress(kind: string, head: THREE.Group, M: (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], s: [number, number, number], parent?: THREE.Object3D) => THREE.Mesh, b: number) {
    const hairM = this.mats[1], a = this.accentMat;
    const horn = (x: number, big: number, mat: THREE.Material) => { const h = M(shared.cone, mat, [x, .12, 0], [.05 * big, .35 * big, .05 * big], head); h.rotation.z = -Math.sign(x) * .9; };
    switch (kind) {
      case 'hero': {
        const hm = new THREE.MeshStandardMaterial({ color: 0x15121e, roughness: .5 }); this.mats.push(hm);
        for (let i = 0; i < 9; i++) { const ang = (i / 9) * 6.28; const sp = M(shared.cone, i % 3 === 0 ? a : hm, [Math.cos(ang) * .1, .1 + (i % 2) * .04, Math.sin(ang) * .1 - .02], [.06, .26 + (i % 3) * .06, .06], head); sp.rotation.set(Math.sin(ang) * .9, 0, -Math.cos(ang) * .9); }
        M(shared.sph, hm, [0, .06, -.02], [.16, .13, .16], head); M(shared.box, a, [0, .06, .14], [.15, .025, .02], head);
        const sc = new THREE.Mesh(new THREE.PlaneGeometry(.2, 1.1, 1, 6), new THREE.MeshStandardMaterial({ color: this.o.accent, emissive: this.o.accent, emissiveIntensity: .6, side: THREE.DoubleSide })); sc.position.set(0, 1.5, -.18); sc.geometry.translate(0, -.5, 0); this.ub.add(sc); this.scarf.push(sc);
        const coat = new THREE.Mesh(new THREE.ConeGeometry(.28, .9, 8, 1, true), this.clothMat.clone()); (coat.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; coat.position.set(0, .6, -.06); coat.scale.set(1, 1, .8); this.ub.add(coat);
        M(shared.box, this.armorMat, [0, 1.38, -.15], [.36, .5, .08]); break;
      }
      case 'knight': M(shared.sph, this.armorMat, [0, .02, 0], [.18, .2, .18], head); M(shared.box, a, [0, .03, .17], [.14, .02, .03], head); M(shared.cone, this.accentMat, [0, .18, -.02], [.04, .3, .12], head).rotation.x = -.5; break;
      case 'assassin': M(shared.sph, this.clothMat, [0, .03, -.01], [.19, .2, .19], head); M(shared.box, this.clothMat, [0, -.06, .13], [.14, .1, .04], head); M(shared.box, a, [0, .04, .15], [.13, .025, .02], head);
        for (const s of [-1, 1]) { const t = M(shared.cone, this.clothMat, [s * .06, -.1, -.18], [.04, .5, .04], head); t.rotation.x = 2.2; } break;
      case 'brute': M(shared.sph, this.armorMat, [0, .03, 0], [.21, .2, .21], head); horn(.16, 1.3, this.armorMat); horn(-.16, 1.3, this.armorMat); M(shared.box, a, [0, .03, .19], [.16, .025, .03], head);
        for (const s of [-1, 1]) M(shared.cone, this.armorMat, [s * .42 * b, 1.62, 0], [.08, .3, .08], this.ub); break;
      case 'mage': M(shared.cone, this.clothMat, [0, .12, 0], [.2, .52, .2], head).rotation.z = .15; M(shared.cyl, this.clothMat, [0, .1, 0], [.3, .03, .3], head); M(shared.sph, a, [0, .01, .14], [.03, .02, .02], head);
        const tr = new THREE.Mesh(new THREE.ConeGeometry(.3, .9, 8, 1, true), this.clothMat); (tr.material as THREE.Material).side = THREE.DoubleSide; tr.position.set(0, .55, 0); this.ub.add(tr); break;
      case 'hunter': { M(shared.box, a, [0, .08, .01], [.16, .035, .16], head); const pt = M(shared.cone, this.skinMat === this.mats[0] ? hairM : hairM, [0, .0, -.2], [.05, .5, .05], head); pt.rotation.x = 2.3; M(shared.sph, this.armorMat, [-.33, 1.5, 0], [.17, .1, .17]); break; }
      case 'exec': M(shared.cone, new THREE.MeshStandardMaterial({ color: 0x0a0809, roughness: .8 }), [0, .02, 0], [.22, .62, .22], head); M(shared.box, a, [-.05, .02, .15], [.04, .02, .02], head); M(shared.box, a, [.05, .02, .15], [.04, .02, .02], head);
        for (let i = 0; i < 6; i++) M(shared.sph, this.armorMat, [Math.sin(i) * .22, 1.2 - i * .08, .17], [.04, .04, .02]); M(shared.box, this.armorMat, [.38, 1.55, 0], [.2, .1, .26]); break;
      case 'ironboss': M(shared.sph, this.armorMat, [0, .03, 0], [.2, .22, .2], head); horn(.18, 2, this.armorMat); horn(-.18, 2, this.armorMat); M(shared.box, a, [0, .04, .19], [.16, .035, .03], head);
        for (const s of [-1, 1]) { M(shared.sph, this.armorMat, [s * .46 * b, 1.55, 0], [.2, .17, .2]); for (let i = 0; i < 3; i++) M(shared.cone, this.armorMat, [s * (.4 + i * .06) * b, 1.65, 0], [.04, .2, .04]); }
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.3, 1, 5), new THREE.MeshStandardMaterial({ color: 0x5a0d0a, roughness: .9, side: THREE.DoubleSide })); cape.geometry.translate(0, -.65, 0); cape.position.set(0, 1.5, -.2); this.ub.add(cape); this.cape = cape;
        M(shared.sph, a, [0, 1.25, .2], [.1, .1, .05]); break;
      case 'stormboss': M(shared.sph, this.clothMat, [0, .04, -.01], [.18, .19, .18], head); M(shared.box, new THREE.MeshStandardMaterial({ color: 0xcfe9ff, roughness: .3, metalness: .8 }), [0, -.04, .13], [.13, .08, .04], head);
        M(shared.box, a, [0, .04, .15], [.14, .025, .02], head); for (const s of [-1, 1]) { const t = M(shared.cone, this.clothMat, [s * .07, -.1, -.18], [.05, .8, .05], head); t.rotation.x = 2.3; }
        const halo = new THREE.Mesh(new THREE.TorusGeometry(.45, .018, 6, 40), new THREE.MeshBasicMaterial({ color: this.o.accent, transparent: true, opacity: .9, blending: THREE.AdditiveBlending })); halo.position.set(0, .05, -.25); head.add(halo);
        const halo2 = halo.clone(); halo2.scale.setScalar(.75); head.add(halo2); this.extras.push((t) => { halo.rotation.z = t * 2; halo2.rotation.z = -t * 3; halo.rotation.y = Math.sin(t) * .4; });
        const co = new THREE.Mesh(new THREE.ConeGeometry(.34, 1.1, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x141b34, roughness: .8, side: THREE.DoubleSide })); co.position.set(0, .5, -.05); this.ub.add(co); break;
      case 'titanboss': {
        const hm = new THREE.MeshStandardMaterial({ color: 0x0a0618, roughness: .4, metalness: .6 });
        M(shared.sph, hm, [0, .04, 0], [.2, .24, .2], head); for (let i = 0; i < 7; i++) { const ang = (i - 3) * .35; const hh = M(shared.cone, hm, [Math.sin(ang) * .22, .22, -.04], [.045, .4 + (3 - Math.abs(i - 3)) * .08, .045], head); hh.rotation.z = -ang * .9; }
        for (const s of [-1, 1]) M(shared.sph, a, [s * .07, .04, .17], [.04, .025, .02], head);
        const core = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 10), new THREE.MeshBasicMaterial({ color: this.o.accent, transparent: true, opacity: .95, blending: THREE.AdditiveBlending })); core.position.set(0, 1.22, .15); this.ub.add(core);
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: this.o.accent, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(1.2); gl.position.copy(core.position); this.ub.add(gl);
        const rings: THREE.Mesh[] = []; for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.9 + i * .4, .018, 6, 60), new THREE.MeshBasicMaterial({ color: this.o.accent, transparent: true, opacity: .75, blending: THREE.AdditiveBlending })); r.position.set(0, 1.2, 0); this.ub.add(r); rings.push(r); }
        for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const ar = M(shared.cyl, hm, [s * .35, 1.2 - k * .3, -.15], [.07, .9, .07]); ar.rotation.z = s * (1.0 + k * .3); ar.rotation.x = .3; M(shared.sph, a, [s * (.7 + k * .35), .8 - k * .35, -.1], [.08, .08, .08]); }
        for (let i = 0; i < 6; i++) { const t = M(shared.cone, hm, [Math.cos(i) * .15, .6, Math.sin(i) * .1], [.07, .7 + (i % 3) * .2, .07]); t.rotation.x = Math.PI + Math.sin(i * 2) * .3; t.rotation.z = Math.cos(i * 2) * .3; }
        this.extras.push((t) => { rings.forEach((r, i) => { r.rotation.set(t * (.6 + i * .3) + i, t * (.5 - i * .2), i); }); core.scale.setScalar(1 + Math.sin(t * 4) * .15); gl.scale.setScalar(1.2 + Math.sin(t * 4) * .2); }); break;
      }
    }
  }

  setWeapon(w: HeldWeapon) { this.held = w; this.pivR.add(w.group); if (w.second) { this.pivL.add(w.second); this.hasLeftPiv = true; } }
  flash(hex: number, k: number) { this.flashC.setHex(hex); for (const m of this.mats) { m.emissive.copy(this.flashC); m.emissiveIntensity = k; } }

  /** target poses (arrays of 8: px,py,pz,pitch,yaw,roll,lean,twist) */
  private apply(piv: THREE.Group, c: number[], mirror: boolean) {
    const s = mirror ? 1 : -1; piv.position.set(s * c[0], c[1], c[2]); piv.rotation.set(c[3], s * c[4], s * c[5], 'YXZ');
  }
  pose(R: ArrayLike<number>, L: ArrayLike<number> | null, dt: number, rate: number, t: number) {
    const k = this.inited ? Math.min(1, rate * dt) : 1; this.inited = true;
    for (let i = 0; i < 8; i++) { this.cur.R[i] += (R[i] - this.cur.R[i]) * k; if (L) this.cur.L[i] += (L[i] - this.cur.L[i]) * k; }
    const c = this.cur.R, br = Math.sin(t * 2 + this.phase) * .012;
    this.upper.rotation.set(c[6], -c[7], 0, 'YXZ'); this.upper.position.y = .95 + br;
    this.apply(this.pivR, c, false);
    if (this.hasLeftPiv) this.apply(this.pivL, this.cur.L, true);
    // arm IK in ub space
    this.ik(0, this.pivR.position);
    if (this.hasLeftPiv) this.ik(1, this.pivL.position);
    else if (this.held) { _v.copy(this.held.grip2).applyEuler(this.pivR.rotation).add(this.pivR.position); this.ik(1, _v); }
    else { _v.set(.4, 1.0, .25); this.ik(1, _v); }
    if (this.cape) { const a = Math.sin(t * 3) * .1; this.cape.rotation.x = .25 + a; }
    for (const s of this.scarf) { s.rotation.x = .35 + Math.sin(t * 5 + 1) * .12; s.rotation.z = Math.sin(t * 3) * .1; }
    for (const e of this.extras) e(t, dt);
  }
  private ik(i: number, hand: THREE.Vector3) {
    const S = this.sh[i], b = Math.sqrt(this.bulk), L1 = .36 * b, L2 = .36 * b, arm = this.arms[i];
    _d.copy(hand).sub(S); let dist = _d.length(); if (dist < .05) { _d.set(0, -1, 0); dist = .05; }
    const reach = L1 + L2; let l1 = L1, l2 = L2; if (dist > reach * .999) { const sc = dist / (reach * .999); l1 *= sc; l2 *= sc; }
    _d.divideScalar(dist); const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    _p.set(i === 0 ? -.55 : .55, -.7, -.35); _p.addScaledVector(_d, -_p.dot(_d)).normalize();
    _e.copy(S).addScaledVector(_d, a).addScaledVector(_p, h);
    this.seg(arm.up, S, _e); this.seg(arm.lo, _e, hand); arm.hand.position.copy(hand);
  }
  private seg(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    m.position.copy(a); _v.copy(b).sub(a); const l = _v.length(); _q.setFromUnitVectors(UP, _v.divideScalar(l || 1)); m.quaternion.copy(_q); m.scale.y = l;
  }
  legAnim(speed: number, dt: number, air: boolean) {
    if (this.noLegs) return;
    this.phase += dt * (3 + speed * 1.6) * (speed > .1 ? 1 : 0); const amp = Math.min(.9, speed * .13);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1, ph = this.phase * 2.2 * s, L = this.legs[i];
      const a = air ? (i === 0 ? .5 : -.25) : Math.sin(ph) * amp, k = air ? .9 : Math.max(0, -Math.sin(ph + 1.2)) * amp * 1.3;
      L.th.rotation.x += (a - L.th.rotation.x) * Math.min(1, dt * 20); L.sh.rotation.x += (k - L.sh.rotation.x) * Math.min(1, dt * 20);
    }
  }
}

// ----------------------------------------------------------------- weapons for enemies
const sm = (c: number, e = 0, r = .35, m = .9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e, emissiveIntensity: e ? 2 : 0 });
const bm = (c: number, op = .8) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
function blade2(len: number, w: number, d: number, m: THREE.Material) {
  const s = new THREE.Shape(); s.moveTo(-w, 0); s.lineTo(-w * 1.05, len * .75); s.lineTo(0, len); s.lineTo(w * 1.05, len * .75); s.lineTo(w, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); g.rotateY(-Math.PI / 2); const me = new THREE.Mesh(g, m); return me;
}
export function enemyWeapon(kind: string, accent: number): HeldWeapon | null {
  const g = new THREE.Group(), grip2 = new THREE.Vector3(0, -.3, 0); const add = (o: THREE.Object3D, p: [number, number, number] = [0, 0, 0], parent: THREE.Object3D = g) => { o.position.set(...p); parent.add(o); return o; };
  const handle = (len: number, r = .035, c = 0x2a1e18) => add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), sm(c, 0, .7, .2)), [0, len / 2 - .25, 0]);
  switch (kind) {
    case 'sword': handle(.5); add(new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .1), sm(0x777b88))); add(blade2(1.2, .07, .03, sm(0xc7ccd6, 0, .2)), [0, .05, 0]); add(blade2(1.1, .015, .04, bm(accent, .4)), [0, .08, 0]); break;
    case 'daggers': { handle(.3); add(new THREE.Mesh(new THREE.BoxGeometry(.2, .04, .06), sm(0x333)), [0, .06, 0]); add(blade2(.62, .045, .02, sm(0xb0b4c0, 0, .2)), [0, .08, 0]); add(blade2(.58, .012, .03, bm(accent, .8)), [0, .1, 0]);
      const s = new THREE.Group(); const h2 = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .3, 8), sm(0x222)); h2.position.y = -.1; s.add(h2); const b2 = blade2(.62, .045, .02, sm(0xb0b4c0, 0, .2)); b2.position.y = .08; s.add(b2); const b3 = blade2(.58, .012, .03, bm(accent, .8)); b3.position.y = .1; s.add(b3); return { group: g, second: s, grip2 }; }
    case 'club': handle(1.2, .05, 0x3a2418); add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .12, .6, 8), sm(0x4a4a50, 0, .5, .6)), [0, 1.1, 0]); for (let i = 0; i < 6; i++) { const sp = add(new THREE.Mesh(new THREE.ConeGeometry(.05, .2, 6), sm(0x8a8a90)), [Math.cos(i) * .2, 1.0 + (i % 3) * .2, Math.sin(i) * .2]); sp.rotation.set(Math.sin(i) * 1.4, 0, -Math.cos(i) * 1.4); } add(new THREE.Mesh(new THREE.TorusGeometry(.17, .02, 6, 12), bm(accent, .7)), [0, 1.35, 0]).rotation.x = Math.PI / 2; grip2.set(0, -.2, 0); break;
    case 'staff': handle(1.9, .03, 0x3a2a4a); add(new THREE.Mesh(new THREE.TorusGeometry(.14, .02, 6, 16), sm(0xc9a24a)), [0, 1.62, 0]); add(new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), bm(accent, .95)), [0, 1.62, 0]); { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: accent, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .6 })); sp.scale.setScalar(.9); add(sp, [0, 1.62, 0]); } grip2.set(0, -.4, 0); break;
    case 'spear': handle(2.7, .03, 0x4a3a28); add(blade2(.7, .09, .03, sm(0xd0d6e0, 0, .2)), [0, 2.4, 0]); add(new THREE.Mesh(new THREE.CylinderGeometry(.06, .04, .12, 8), sm(accent === 0 ? 0xaaa : 0xc9a24a)), [0, 2.35, 0]); add(new THREE.Mesh(new THREE.ConeGeometry(.035, .3, 6), sm(0x666)), [0, -.45, 0]).rotation.x = Math.PI; grip2.set(0, -.6, 0); break;
    case 'cleaver': handle(.7, .04, 0x1a1214); add(new THREE.Mesh(new THREE.BoxGeometry(.04, 1.3, .38), sm(0x2a2428, 0, .3, .9)), [0, 1.0, .08]); add(new THREE.Mesh(new THREE.BoxGeometry(.045, 1.3, .03), bm(accent, .8)), [0, 1.0, .27]); add(new THREE.Mesh(new THREE.ConeGeometry(.2, .35, 4), sm(0x2a2428, 0, .3, .9)), [0, 1.8, .08]); grip2.set(0, -.2, 0); break;
    case 'bosscleaver': handle(1.1, .05, 0x1a1214); add(new THREE.Mesh(new THREE.BoxGeometry(.06, 2.0, .7), sm(0x22252d, 0, .35, .95)), [0, 1.5, .15]); add(new THREE.Mesh(new THREE.BoxGeometry(.07, 2.0, .05), bm(accent, .9)), [0, 1.5, .5]);
      for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 4), sm(0x22252d)), [0, .8 + i * .38, -.28]).rotation.x = -1.57; add(new THREE.Mesh(new THREE.BoxGeometry(.08, .5, .3), bm(accent, .35)), [0, 1.2, .15]); add(new THREE.Mesh(new THREE.ConeGeometry(.35, .55, 4), sm(0x22252d)), [0, 2.75, .15]); grip2.set(0, -.3, 0); break;
    case 'stormblades': { const w = buildWeapon('thunder', accent, 0xffffff); return { group: w.group, second: w.second, grip2 }; }
    default: return null;
  }
  return { group: g, grip2 };
}
