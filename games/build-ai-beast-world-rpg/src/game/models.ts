import * as THREE from "three";
import { glowSprite } from "./world";

export interface Model {
  root: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  parts: Record<string, THREE.Object3D>;
  legs: THREE.Object3D[];
  tail?: THREE.Object3D[];
}

class B {
  mats: THREE.MeshStandardMaterial[] = [];
  mk(geo: THREE.BufferGeometry, color: number, o: { e?: number; ei?: number; flat?: boolean; rough?: number; metal?: number } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0.05, flatShading: o.flat ?? true, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1 });
    this.mats.push(m);
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    return mesh;
  }
  sph(r: number, color: number, sx = 1, sy = 1, sz = 1, o = {}) { const m = this.mk(new THREE.SphereGeometry(r, 10, 8), color, o); m.scale.set(sx, sy, sz); return m; }
  box(w: number, h: number, d: number, color: number, o = {}) { return this.mk(new THREE.BoxGeometry(w, h, d), color, o); }
  cone(r: number, h: number, color: number, seg = 6, o = {}) { return this.mk(new THREE.ConeGeometry(r, h, seg), color, o); }
  cyl(rt: number, rb: number, h: number, color: number, seg = 8, o = {}) { return this.mk(new THREE.CylinderGeometry(rt, rb, h, seg), color, o); }
  at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number) { o.position.set(x, y, z); return o; }
}

export function buildPlayer(): Model {
  const b = new B(), root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const skin = 0xe3b894, tunic = 0x2a6f93, trim = 0xf2c25a, dark = 0x252036;
  const torso = b.at(b.mk(new THREE.CapsuleGeometry(0.26, 0.5, 4, 8), tunic, { flat: false }), 0, 1.2, 0);
  const belt = b.at(b.cyl(0.29, 0.29, 0.12, trim, 8), 0, 0.95, 0);
  const head = b.at(b.sph(0.21, skin, 1, 1.05, 1, { flat: false }), 0, 1.78, 0);
  const hair = b.at(b.sph(0.235, 0x3b2a63, 1, 1, 1, { flat: false }), 0, 1.84, -0.03); hair.scale.set(1, 0.85, 1.05);
  const pony = b.at(b.cone(0.1, 0.6, 0x3b2a63, 5), 0, 1.7, -0.3); pony.rotation.x = -2.0;
  const eyeL = b.at(b.box(0.06, 0.05, 0.04, 0x9ff0ff, { e: 0x40e0ff, ei: 2 }), -0.08, 1.8, 0.2), eyeR = b.at(b.box(0.06, 0.05, 0.04, 0x9ff0ff, { e: 0x40e0ff, ei: 2 }), 0.08, 1.8, 0.2);
  const scarf = b.at(b.cyl(0.2, 0.26, 0.14, 0xd9534f, 8), 0, 1.55, 0);
  const mkLeg = (x: number) => {
    const g = new THREE.Group(); g.position.set(x, 0.88, 0);
    g.add(b.at(b.cyl(0.11, 0.09, 0.85, dark, 6), 0, -0.42, 0), b.at(b.box(0.17, 0.12, 0.3, 0x5a3d28), 0, -0.84, 0.05));
    return g;
  };
  const legL = mkLeg(-0.14), legR = mkLeg(0.14);
  const mkArm = (x: number) => {
    const g = new THREE.Group(); g.position.set(x, 1.5, 0);
    g.add(b.at(b.cyl(0.08, 0.07, 0.65, tunic, 6), 0, -0.32, 0), b.at(b.sph(0.08, skin), 0, -0.68, 0));
    return g;
  };
  const armL = mkArm(-0.36), armR = mkArm(0.36);
  const cape = new THREE.Group(); cape.position.set(0, 1.5, -0.22);
  const cm = b.mk(new THREE.PlaneGeometry(0.62, 1.1, 1, 1), 0x7a2a4a, { flat: false }); cm.material.side = THREE.DoubleSide; cm.position.y = -0.55; cm.rotation.x = 0.05;
  cape.add(cm);
  const sword = new THREE.Group(); sword.position.set(0, -0.68, 0.05);
  const blade = b.at(b.box(0.07, 1.15, 0.02, 0xcff6ff, { e: 0x40d0ff, ei: 1.2, metal: 0.6, rough: 0.2 }), 0, 0.7, 0);
  const guard = b.at(b.box(0.3, 0.05, 0.07, trim, { metal: 0.6 }), 0, 0.12, 0);
  const hilt = b.at(b.cyl(0.03, 0.03, 0.22, 0x3a2a1a, 5), 0, 0, 0);
  const tip = new THREE.Object3D(); tip.position.set(0, 1.28, 0);
  const bladeGlow = glowSprite(0x55d8ff, 1.6, 0.35); bladeGlow.position.set(0, 0.7, 0);
  sword.add(blade, guard, hilt, tip, bladeGlow);
  armR.add(sword); sword.rotation.x = 1.2;
  // glider wings
  const glider = new THREE.Group(); glider.position.set(0, 1.4, -0.25); glider.visible = false;
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(1.9, 0.5); wingShape.lineTo(1.5, -0.3); wingShape.lineTo(0.9, -0.5); wingShape.lineTo(0.4, -0.9); wingShape.lineTo(0, -0.7);
  const wgeo = new THREE.ShapeGeometry(wingShape);
  const wmat = new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const wl = new THREE.Mesh(wgeo, wmat), wr = new THREE.Mesh(wgeo, wmat); wl.scale.x = -1; wl.rotation.x = -1.2; wr.rotation.x = -1.2;
  glider.add(wl, wr);
  body.add(torso, belt, head, hair, pony, eyeL, eyeR, scarf, legL, legR, armL, armR, cape, glider);
  return { root, mats: b.mats, parts: { body, torso, head, cape, armL, armR, sword, glider, tip, blade }, legs: [legL, legR] };
}

export function buildVesper(): Model {
  const b = new B(), root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const fur = 0x3b2d5c, dk = 0x211a38, glow = 0xffb04a, cy = 0x58e6ff;
  const torso = b.at(b.sph(0.42, fur, 0.75, 0.7, 1.25, { flat: false }), 0, 0.62, 0);
  const chest = b.at(b.sph(0.3, 0xf0e4c8, 0.8, 0.9, 0.8, { flat: false }), 0, 0.5, 0.35);
  const neck = b.at(b.cyl(0.14, 0.2, 0.4, fur, 6), 0, 0.88, 0.5); neck.rotation.x = 0.7;
  const head = new THREE.Group(); head.position.set(0, 1.05, 0.7);
  head.add(b.sph(0.26, fur, 1, 0.9, 1.05, { flat: false }), b.at(b.cone(0.13, 0.4, fur, 5), 0, -0.03, 0.34));
  (head.children[1] as THREE.Mesh).rotation.x = Math.PI / 2;
  head.add(b.at(b.sph(0.045, 0xffd280, 1, 1, 1, { e: glow, ei: 3 }), -0.12, 0.07, 0.2), b.at(b.sph(0.045, 0xffd280, 1, 1, 1, { e: glow, ei: 3 }), 0.12, 0.07, 0.2));
  head.add(b.at(b.sph(0.03, 0x111111), 0, -0.03, 0.55));
  const earL = b.at(b.cone(0.1, 0.5, fur, 4), -0.14, 0.38, -0.04), earR = b.at(b.cone(0.1, 0.5, fur, 4), 0.14, 0.38, -0.04);
  earL.rotation.z = 0.25; earR.rotation.z = -0.25;
  const eTipL = b.at(b.sph(0.045, cy, 1, 1, 1, { e: cy, ei: 3 }), -0.2, 0.62, -0.04), eTipR = b.at(b.sph(0.045, cy, 1, 1, 1, { e: cy, ei: 3 }), 0.2, 0.62, -0.04);
  head.add(earL, earR, eTipL, eTipR);
  const mkLeg = (x: number, z: number) => {
    const g = new THREE.Group(); g.position.set(x, 0.55, z);
    g.add(b.at(b.cyl(0.08, 0.06, 0.55, dk, 5), 0, -0.27, 0), b.at(b.sph(0.08, dk), 0, -0.55, 0.03));
    return g;
  };
  const legs = [mkLeg(-0.2, 0.5), mkLeg(0.2, 0.5), mkLeg(-0.2, -0.5), mkLeg(0.2, -0.5)];
  const tail: THREE.Object3D[] = [];
  let parent: THREE.Object3D = body;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group(); seg.position.set(0, i === 0 ? 0.7 : 0, i === 0 ? -0.75 : -0.28);
    seg.add(b.at(b.sph(0.17 - i * 0.025, i === 4 ? 0xffe0a0 : fur, 1, 1, 1.4, i === 4 ? { e: glow, ei: 2.5 } : { flat: false }), 0, 0, -0.1));
    parent.add(seg); tail.push(seg); parent = seg;
  }
  const crest: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) { const c = b.at(b.cone(0.06, 0.28, cy, 4, { e: cy, ei: 2.2 }), 0, 0.98 - Math.abs(i - 2) * 0.04, 0.5 - i * 0.28); c.rotation.x = -0.2; crest.push(c); body.add(c); }
  // wings (shown in ascended / mount form)
  const wings = new THREE.Group(); wings.position.set(0, 0.95, 0.1); wings.visible = false;
  const ws = new THREE.Shape(); ws.moveTo(0, 0); ws.lineTo(1.8, 0.9); ws.lineTo(2.9, 0.1); ws.lineTo(2.2, -0.2); ws.lineTo(2.5, -0.9); ws.lineTo(1.2, -0.55); ws.lineTo(0.5, -1.0); ws.lineTo(0, -0.5);
  const wgeo = new THREE.ShapeGeometry(ws);
  const wm = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.75, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const wL = new THREE.Mesh(wgeo, wm), wR = new THREE.Mesh(wgeo, wm); wL.scale.x = -1; wL.rotation.x = -Math.PI / 2 + 0.3; wR.rotation.x = -Math.PI / 2 + 0.3;
  const wLg = new THREE.Group(), wRg = new THREE.Group(); wLg.add(wL); wRg.add(wR); wings.add(wLg, wRg);
  const halo = glowSprite(0xffa040, 4, 0); halo.position.y = 0.8;
  body.add(torso, chest, neck, head, ...legs, wings, halo);
  return { root, mats: b.mats, parts: { body, head, wings, wLg, wRg, halo, wm: Object.assign(new THREE.Object3D(), { userData: { m: wm } }) }, legs, tail };
}

export function buildEnemy(kind: string, tint: number): Model {
  const b = new B(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const parts: Record<string, THREE.Object3D> = { body };
  const legs: THREE.Object3D[] = [];
  const tail: THREE.Object3D[] = [];
  const eye = (x: number, y: number, z: number, s = 0.06, c = 0xff3b2e) => b.at(b.sph(s, c, 1, 1, 1, { e: c, ei: 3 }), x, y, z);
  if (kind === "skitter") {
    const col = tint, dk = 0x2a2020;
    body.add(b.at(b.sph(0.5, col, 0.8, 0.6, 1.3), 0, 0.7, 0));
    const head = new THREE.Group(); head.position.set(0, 0.85, 0.85);
    head.add(b.sph(0.3, col, 1, 0.8, 1.1), b.at(b.cone(0.18, 0.5, dk, 4), 0, -0.1, 0.4), eye(-0.14, 0.1, 0.22), eye(0.14, 0.1, 0.22));
    (head.children[1] as THREE.Mesh).rotation.x = Math.PI / 2;
    const jawL = b.at(b.cone(0.05, 0.3, 0xeee0c0, 4), -0.1, -0.2, 0.55), jawR = b.at(b.cone(0.05, 0.3, 0xeee0c0, 4), 0.1, -0.2, 0.55); jawL.rotation.x = jawR.rotation.x = Math.PI; head.add(jawL, jawR);
    parts.head = head; body.add(head);
    for (let i = 0; i < 4; i++) body.add(b.at(b.cone(0.1, 0.4, dk, 4), 0, 1.15, 0.5 - i * 0.35));
    for (const [x, z] of [[-0.35, 0.5], [0.35, 0.5], [-0.35, -0.5], [0.35, -0.5]]) {
      const g = new THREE.Group(); g.position.set(x, 0.6, z); g.add(b.at(b.cyl(0.08, 0.05, 0.7, dk, 5), x * 0.3, -0.3, 0)); g.children[0].rotation.z = -Math.sign(x) * 0.4;
      body.add(g); legs.push(g);
    }
    const t = b.at(b.cone(0.12, 0.9, col, 5), 0, 0.9, -1.1); t.rotation.x = -2.2; body.add(t); parts.tail = t;
    parts.weak = b.at(new THREE.Object3D(), 0, 1, -0.3);
  } else if (kind === "horn") {
    const col = tint, dk = 0x3a2a24, hornC = 0xe8dcc0;
    body.add(b.at(b.sph(0.9, col, 0.95, 0.85, 1.35), 0, 1.15, 0));
    body.add(b.at(b.box(1.3, 0.3, 1.8, dk), 0, 1.95, -0.1));
    for (let i = 0; i < 3; i++) body.add(b.at(b.box(0.9 - i * 0.1, 0.12, 0.5, 0x6a5a50), 0, 2.15 + i * 0.01, 0.4 - i * 0.55));
    const head = new THREE.Group(); head.position.set(0, 1.2, 1.5);
    head.add(b.sph(0.5, col, 1, 0.9, 1.1), eye(-0.25, 0.15, 0.4, 0.08), eye(0.25, 0.15, 0.4, 0.08));
    const hL = b.at(b.cone(0.18, 1.3, hornC, 5), -0.45, 0.3, 0.3), hR = b.at(b.cone(0.18, 1.3, hornC, 5), 0.45, 0.3, 0.3);
    hL.rotation.set(1.2, 0, 0.5); hR.rotation.set(1.2, 0, -0.5); head.add(hL, hR);
    parts.head = head; body.add(head);
    for (const [x, z] of [[-0.6, 0.8], [0.6, 0.8], [-0.6, -0.8], [0.6, -0.8]]) {
      const g = new THREE.Group(); g.position.set(x, 0.9, z); g.add(b.at(b.cyl(0.2, 0.15, 1, dk, 6), 0, -0.45, 0)); body.add(g); legs.push(g);
    }
    // ember cracks
    for (let i = 0; i < 4; i++) body.add(b.at(b.box(0.05, 0.5, 0.05, 0xff8a30, { e: 0xff6a10, ei: 2.5 }), (i % 2 ? 1 : -1) * 0.7, 1.3, 0.5 - i * 0.4)).rotation.z = 0.5;
    parts.weak = b.at(new THREE.Object3D(), 0, 1.3, -1);
  } else if (kind === "kite") {
    const col = tint;
    body.add(b.at(b.sph(0.4, col, 0.8, 0.8, 1.4), 0, 0, 0));
    body.add(b.at(b.sph(0.22, 0xffd070, 1, 1, 1, { e: 0xff8a30, ei: 3 }), 0, 0.05, 0.2));
    const head = b.at(b.cone(0.2, 0.6, col, 5), 0, 0.15, 0.7); head.rotation.x = Math.PI / 2; body.add(head); parts.head = head;
    body.add(eye(-0.1, 0.25, 0.65, 0.05), eye(0.1, 0.25, 0.65, 0.05));
    const ws = new THREE.Shape(); ws.moveTo(0, 0); ws.lineTo(1.6, 0.5); ws.lineTo(2.2, -0.2); ws.lineTo(1.2, -0.3); ws.lineTo(0.5, -0.7); ws.lineTo(0, -0.4);
    const wg = new THREE.ShapeGeometry(ws);
    const wmat = b.mk(wg, 0x6a2a20, { e: 0xff5a20, ei: 0.8, flat: true }); wmat.material.side = THREE.DoubleSide;
    const mkW = (s: number) => { const g = new THREE.Group(); g.position.set(s * 0.3, 0.2, 0); const m = new THREE.Mesh(wg, wmat.material); m.rotation.x = -Math.PI / 2; m.scale.x = s; g.add(m); body.add(g); return g; };
    parts.wL = mkW(-1); parts.wR = mkW(1);
    for (let i = 0; i < 4; i++) { const s = new THREE.Group(); s.position.set(0, 0, i === 0 ? -0.5 : -0.35); s.add(b.at(b.sph(0.13 - i * 0.02, i === 3 ? 0xffd070 : col, 1, 1, 1.3, i === 3 ? { e: 0xff7a20, ei: 3 } : {}), 0, 0, 0)); (i ? tail[i - 1] : body).add(s); tail.push(s); }
    parts.weak = b.at(new THREE.Object3D(), 0, 0, -0.4);
  } else if (kind === "colossus") {
    const rock = tint, dk = 0x3a3733;
    body.add(b.at(b.mk(new THREE.DodecahedronGeometry(1.8, 0), rock), 0, 2.4, 0));
    body.children[0].scale.set(1.1, 0.85, 1.4);
    body.add(b.at(b.mk(new THREE.DodecahedronGeometry(1.2, 0), dk), 1.1, 3.4, -0.3), b.at(b.mk(new THREE.DodecahedronGeometry(1.0, 0), dk), -1.2, 3.2, 0.4));
    const head = new THREE.Group(); head.position.set(0, 2.9, 2.4);
    head.add(b.mk(new THREE.DodecahedronGeometry(0.9, 0), rock), eye(-0.35, 0.1, 0.7, 0.12, 0x58e6ff), eye(0.35, 0.1, 0.7, 0.12, 0x58e6ff));
    parts.head = head; body.add(head);
    for (const [x, z] of [[-1.3, 1.3], [1.3, 1.3], [-1.3, -1.3], [1.3, -1.3]]) {
      const g = new THREE.Group(); g.position.set(x, 2, z); g.add(b.at(b.cyl(0.55, 0.65, 2.1, dk, 6), 0, -1, 0)); body.add(g); legs.push(g);
    }
    // glowing weak crystals on back
    const wk = new THREE.Group(); wk.position.set(0, 3.6, -1.6);
    for (let i = 0; i < 3; i++) { const c = b.at(b.cone(0.3, 1.2, 0xffa040, 5, { e: 0xff7a20, ei: 3 }), (i - 1) * 0.6, 0, i === 1 ? 0.2 : 0); c.rotation.z = (i - 1) * -0.3; wk.add(c); }
    const gl = glowSprite(0xff9a40, 4, 0.8); wk.add(gl);
    body.add(wk); parts.weak = wk;
  } else if (kind === "grazer") {
    const col = tint;
    body.add(b.at(b.sph(0.55, col, 1, 0.8, 1.2, { flat: false }), 0, 0.85, 0));
    for (let i = 0; i < 5; i++) body.add(b.at(b.sph(0.18, 0x9fe08a, 1, 1, 1, { flat: false }), (Math.random() - 0.5) * 0.7, 1.25, (Math.random() - 0.5) * 0.9));
    const head = new THREE.Group(); head.position.set(0, 1.1, 0.8);
    head.add(b.sph(0.22, 0xe8dcc0, 1, 1, 1.2, { flat: false }), eye(-0.1, 0.05, 0.18, 0.04, 0x222222), eye(0.1, 0.05, 0.18, 0.04, 0x222222));
    parts.head = head; body.add(head);
    for (const [x, z] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) { const g = new THREE.Group(); g.position.set(x, 0.55, z); g.add(b.at(b.cyl(0.07, 0.06, 0.55, 0x6a5a40, 5), 0, -0.27, 0)); body.add(g); legs.push(g); }
    body.add(b.at(b.sph(0.12, 0x7ae8ff, 1, 1, 1, { e: 0x40d0ff, ei: 2 }), 0, 1.05, -0.65));
    parts.weak = b.at(new THREE.Object3D(), 0, 1, -0.5);
  }
  return { root, mats: b.mats, parts, legs, tail };
}

export function buildWarden(): Model {
  const b = new B(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const steel = 0x3c3f4e, trim = 0xc29a45, rune = 0x40e8ff, dk = 0x22232d;
  const parts: Record<string, THREE.Object3D> = { body };
  const legs: THREE.Object3D[] = [];
  for (const x of [-1.1, 1.1]) {
    const g = new THREE.Group(); g.position.set(x, 3.4, 0);
    g.add(b.at(b.box(1.1, 3.4, 1.2, steel, { metal: 0.6, rough: 0.5 }), 0, -1.7, 0), b.at(b.box(1.4, 0.6, 2, dk), 0, -3.3, 0.4), b.at(b.box(0.2, 2.2, 0.1, rune, { e: rune, ei: 2 }), 0, -1.7, 0.62));
    body.add(g); legs.push(g);
  }
  body.add(b.at(b.box(3.2, 1, 1.8, dk), 0, 3.6, 0));
  const torso = b.at(b.box(3.6, 3.2, 2.2, steel, { metal: 0.6, rough: 0.5 }), 0, 5.4, 0);
  const plate = b.at(b.box(3.0, 1.6, 0.3, trim, { metal: 0.7, rough: 0.35 }), 0, 5.9, 1.2);
  const core = b.at(b.sph(0.55, 0xffffff, 1, 1, 1, { e: rune, ei: 3 }), 0, 5.1, 1.2);
  const coreGlow = glowSprite(rune, 4.5, 0.8); coreGlow.position.set(0, 5.1, 1.5);
  body.add(torso, plate, core, coreGlow);
  parts.core = core; parts.coreGlow = coreGlow;
  for (const s of [-1, 1]) {
    const sh = b.at(b.sph(1.0, steel, 1, 0.9, 1, { metal: 0.6 }), s * 2.4, 6.8, 0);
    body.add(sh, b.at(b.cone(0.4, 1.6, trim, 4), s * 2.7, 7.8, 0));
  }
  const head = new THREE.Group(); head.position.set(0, 7.6, 0.1);
  head.add(b.box(1.4, 1.5, 1.4, steel, { metal: 0.6 }), b.at(b.box(1.0, 0.18, 0.1, rune, { e: rune, ei: 3 }), 0, 0.1, 0.72), b.at(b.box(0.2, 0.8, 1.2, trim), 0, 1.0, 0));
  for (const s of [-1, 1]) { const h = b.at(b.cone(0.28, 2.2, 0xe0d8c0, 5), s * 0.9, 0.9, 0); h.rotation.z = -s * 0.7; head.add(h); }
  body.add(head); parts.head = head;
  const mkArm = (s: number) => {
    const g = new THREE.Group(); g.position.set(s * 2.6, 6.6, 0);
    g.add(b.at(b.box(0.9, 3.4, 0.9, steel, { metal: 0.6 }), 0, -1.7, 0), b.at(b.sph(0.7, dk, 1, 1, 1), 0, -3.5, 0));
    return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  const blade = new THREE.Group(); blade.position.set(0, -3.5, 0.2);
  blade.add(b.at(b.box(0.7, 8.5, 0.28, 0xd0d6e0, { metal: 0.8, rough: 0.25, e: rune, ei: 0.5 }), 0, 4.0, 0), b.at(b.box(2.0, 0.4, 0.5, trim), 0, 0, 0), b.at(b.box(0.12, 7.5, 0.3, rune, { e: rune, ei: 3 }), 0, 4.0, 0));
  blade.rotation.x = 1.0; armR.add(blade);
  const gaunt = b.at(b.box(1.6, 2.4, 0.5, dk, { metal: 0.6 }), 0, -3.6, 0.7); armL.add(gaunt);
  body.add(armL, armR); parts.armL = armL; parts.armR = armR; parts.blade = blade;
  root.scale.setScalar(1.05);
  return { root, mats: b.mats, parts, legs };
}

export function buildPylon(): Model {
  const b = new B(), root = new THREE.Group();
  const c = b.at(b.mk(new THREE.OctahedronGeometry(1.4, 0), 0xb870ff, { e: 0xa050ff, ei: 2, flat: true }), 0, 3.4, 0); c.scale.y = 1.7;
  const base = b.at(b.cyl(1.2, 1.6, 1.0, 0x3c3f4e, 8), 0, 0.5, 0);
  const g = glowSprite(0xb070ff, 8, 0.7); g.position.y = 3.4;
  root.add(c, base, g);
  return { root, mats: b.mats, parts: { crystal: c, glow: g }, legs: [] };
}
