import * as THREE from 'three';
import { WeaponId } from './types';
import { bladeCrackTex, glowTex, runeStripTex, runeTex } from './textures';

export interface WeaponModel {
  group: THREE.Group; second?: THREE.Group; base: THREE.Vector3; tip: THREE.Vector3; grip2: THREE.Vector3; back?: THREE.Group;
  update: (t: number, awake: boolean, dt: number) => void; level: number; length: number;
}

const stdMat = (color: number, rough = .4, metal = .9, em = 0, ei = 1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: em, emissiveIntensity: em ? ei : 0 });
const addMat = (color: number, op = .6, map?: THREE.Texture) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: map ?? null });
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0], parent?: THREE.Object3D) => { const o = new THREE.Mesh(g, m); o.position.set(...p); o.castShadow = true; parent?.add(o); return o; };

/** extrude a 2D profile (x = width -> local Z, y = along blade) with thickness along local X */
function blade(pts: [number, number][], depth: number, bevel = .012, width = 1, length = 1): THREE.BufferGeometry {
  const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 });
  g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2);
  const pos = g.getAttribute('position') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getZ(i) / width + .5, pos.getY(i) / length);
  return g;
}
const curvedBlade = (len: number, w: number, bend: number, y0 = 0, tipTaper = .22) => {
  const L: [number, number][] = [], R: [number, number][] = [], n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = y0 + t * len, c = -bend * t * t, ww = w * (t > 1 - tipTaper ? Math.max(.02, (1 - t) / tipTaper) : 1) * (1 - t * .15);
    L.push([c + ww, y]); R.push([c - ww * .55, y]);
  }
  return [...L, ...R.reverse()];
};
const glowSprite = (hex: number, size: number, op = .4) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size); return s;
};

export function buildWeapon(id: WeaponId, c0: number, c1: number): WeaponModel {
  const group = new THREE.Group(); const T0 = new THREE.Color(c0), T1 = new THREE.Color(c1);
  const dark = stdMat(0x17171f, .35, .9), steel = stdMat(0x8a8fa0, .25, 1), gold = stdMat(0xd9a93a, .3, 1);
  const base = new THREE.Vector3(0, .3, 0), tip = new THREE.Vector3(0, 2, 0), grip2 = new THREE.Vector3(0, -.4, 0);
  const m: WeaponModel = { group, base, tip, grip2, update: () => {}, level: 0, length: 2, back: undefined };
  const lerpLevel = (awake: boolean, dt: number) => { m.level += ((awake ? 1 : 0) - m.level) * Math.min(1, dt * 5); return m.level; };

  if (id === 'inferno') {
    m.length = 2.4;
    mesh(new THREE.CylinderGeometry(.04, .045, .7, 10), stdMat(0x201014, .8, .2), [0, -.25, 0], group);
    for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(.048, .01, 6, 12), gold, [0, -.5 + i * .17, 0], group).rotation.x = Math.PI / 2;
    mesh(new THREE.IcosahedronGeometry(.09, 1), stdMat(0x200808, .3, .8, c0, 2), [0, -.62, 0], group);
    const guard = new THREE.Shape(); guard.moveTo(-.55, .22); guard.lineTo(-.4, .05); guard.lineTo(-.1, .07); guard.lineTo(0, .0); guard.lineTo(.1, .07); guard.lineTo(.4, .05); guard.lineTo(.55, .22); guard.lineTo(.3, .15); guard.lineTo(.12, .2); guard.lineTo(-.12, .2); guard.lineTo(-.3, .15); guard.closePath();
    const gg = new THREE.ExtrudeGeometry(guard, { depth: .09, bevelEnabled: true, bevelSize: .01, bevelThickness: .01, bevelSegments: 1 }); gg.translate(0, 0, -.045); gg.rotateY(-Math.PI / 2);
    mesh(gg, dark, [0, .05, 0], group).rotation.set(0, 0, 0);
    const gem = mesh(new THREE.OctahedronGeometry(.07), stdMat(0xff2200, .2, .3, c0, 3), [0, .12, .0], group);
    const pts: [number, number][] = [[-.12, .17], [-.2, .5], [-.16, .72], [-.27, .95], [-.2, 1.15], [-.3, 1.4], [-.22, 1.65], [-.2, 1.95], [-.05, 2.3], [0, 2.4], [.2, 1.95], [.27, 1.35], [.22, .7], [.13, .17]];
    const bm = new THREE.MeshStandardMaterial({ color: 0x18181e, roughness: .32, metalness: .92, emissive: c0, emissiveMap: bladeCrackTex(), emissiveIntensity: 2.4, map: null });
    const bg = blade(pts, .07, .014, .6, 2.4); const bl = mesh(bg, bm, [0, 0, 0], group);
    const core = mesh(blade([[-.02, .3], [-.05, 1.2], [0, 2.2], [.05, 1.2], [.02, .3]], .085, 0, .6, 2.4), addMat(c1, .55), [0, 0, 0], group);
    const aura = new THREE.Group(); group.add(aura); aura.visible = false;
    const fl: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) { const f = mesh(new THREE.ConeGeometry(.2 - i * .015, .9, 8, 1, true).translate(0, .45, 0), addMat(i % 2 ? c0 : c1, .5), [0, .3 + i * .33, 0], aura); f.castShadow = false; fl.push(f); }
    const glow = glowSprite(c0, 2.6, .35); glow.position.set(0, 1.3, 0); group.add(glow);
    base.set(0, .5, 0); tip.set(0, 2.38, 0); grip2.set(0, -.5, 0);
    m.update = (t, awake, dt) => {
      const l = lerpLevel(awake, dt); bm.emissiveIntensity = 2.2 + Math.sin(t * 5) * .6 + l * 1.8; (gem.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5 + Math.sin(t * 8);
      const sc = 1 + l * .5; bl.scale.set(1 + l * .5, sc, 1 + l * .6); core.scale.copy(bl.scale); tip.set(0, 2.38 * sc, 0); aura.visible = l > .05; aura.scale.set(1 + l * .5, sc, 1 + l * .5);
      fl.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 9 + i) * .2, .8 + Math.sin(t * 12 + i * 2) * .3, 1 + Math.cos(t * 10 + i) * .2); f.rotation.y = t * 3 + i; (f.material as THREE.MeshBasicMaterial).opacity = .45 * l; });
      glow.scale.setScalar(2.6 + l * 2.2 + Math.sin(t * 6) * .2);
    };
  } else if (id === 'thunder') {
    m.length = 1.2; const make = () => {
      const g = new THREE.Group();
      mesh(new THREE.CylinderGeometry(.03, .032, .42, 8), stdMat(0x0c1020, .7, .3), [0, -.12, 0], g); mesh(new THREE.SphereGeometry(.05, 10, 8), stdMat(0x111, .3, .9, c0, 2), [0, -.36, 0], g);
      const gs = new THREE.Shape(); gs.moveTo(-.2, .0); gs.quadraticCurveTo(-.22, .12, -.1, .16); gs.lineTo(0, .09); gs.lineTo(.1, .16); gs.quadraticCurveTo(.22, .12, .2, 0); gs.lineTo(.08, .06); gs.lineTo(-.08, .06); gs.closePath();
      const gg = new THREE.ExtrudeGeometry(gs, { depth: .05, bevelEnabled: false }); gg.translate(0, 0, -.025); gg.rotateY(-Math.PI / 2); mesh(gg, steel, [0, .07, 0], g);
      mesh(new THREE.OctahedronGeometry(.04), stdMat(0, .2, .2, c0, 3), [0, .13, 0], g);
      const prof = curvedBlade(1.25, .075, .13, .16, .18);
      const bm = new THREE.MeshStandardMaterial({ color: 0xe6edf8, roughness: .12, metalness: 1, emissive: c0, emissiveIntensity: .35 });
      mesh(blade(prof, .028, .006, .3, 1.4), bm, [0, 0, 0], g);
      mesh(blade(curvedBlade(1.23, .02, .13, .18, .15), .036, 0, .3, 1.4), addMat(c1, .9), [0, 0, 0], g);
      const gl = glowSprite(c0, 1.7, .32); gl.position.set(.0, .8, .05); g.add(gl); return { g, gl };
    };
    const a = make(), b = make(); group.add(a.g); m.second = b.g; base.set(0, .3, 0); tip.set(0, 1.4, .1); grip2.set(0, -.3, 0);
    // wings (awakened) attached to the back of the character
    const back = new THREE.Group(); m.back = back; const wm: THREE.MeshBasicMaterial[] = [];
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(.5, .25, 1.6 - i * .15, .1 + i * .05); sh.quadraticCurveTo(.8, -.08, 0, -.06); const f = new THREE.ShapeGeometry(sh);
      const mm = addMat(i % 2 ? c0 : c1, .55); wm.push(mm); const w = mesh(f, mm, [s * .15, 1.55 - i * .12, -.2], back); w.castShadow = false; w.rotation.set(-.1 + i * .06, s > 0 ? -.6 - i * .22 : Math.PI + .6 + i * .22, i * .1 * s); w.scale.setScalar(1.25);
    }
    back.visible = false;
    m.update = (t, awake, dt) => {
      const l = lerpLevel(awake, dt); back.visible = l > .02; back.scale.setScalar(.3 + l * .9); wm.forEach((x, i) => { x.opacity = l * (.35 + .25 * Math.sin(t * 14 + i * 1.7)); });
      a.gl.scale.setScalar(1.7 + Math.sin(t * 20) * .3 + l * 1.2); b.gl.scale.setScalar(1.7 + Math.cos(t * 17) * .3 + l * 1.2);
    };
  } else if (id === 'void') {
    m.length = 2.7;
    mesh(new THREE.CylinderGeometry(.035, .04, 2.5, 10), stdMat(0x1a0f2a, .4, .85), [0, .7, 0], group);
    const strip = mesh(new THREE.CylinderGeometry(.042, .042, 1.7, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0, emissive: c0, emissiveMap: runeStripTex('#ffffff'), emissiveIntensity: 1.6 }), [0, .5, 0], group); strip.castShadow = false;
    for (const y of [-.5, .3, 1.2]) mesh(new THREE.TorusGeometry(.055, .014, 6, 14), gold, [0, y, 0], group).rotation.x = Math.PI / 2;
    mesh(new THREE.ConeGeometry(.05, .3, 8), dark, [0, -.65, 0], group).rotation.x = Math.PI;
    mesh(new THREE.OctahedronGeometry(.1, 0), stdMat(0, .2, .5, c0, 3), [0, 1.95, 0], group);
    const outer: [number, number][] = [[0, 1.98], [.35, 2.32], [.8, 2.44], [1.2, 2.36], [1.55, 2.12], [1.72, 1.82], [1.45, 2.05], [1.15, 2.2], [.75, 2.24], [.35, 2.14], [0, 1.88]];
    const bm = new THREE.MeshStandardMaterial({ color: 0x1b1030, roughness: .25, metalness: 1, emissive: c0, emissiveIntensity: .5 });
    mesh(blade(outer, .05, .01, 2, 2), bm, [0, 0, 0], group);
    const edge: [number, number][] = [[1.72, 1.82], [1.45, 2.05], [1.15, 2.2], [.75, 2.24], [.35, 2.14], [0, 1.88], [.02, 1.9], [.36, 2.17], [.76, 2.27], [1.16, 2.23], [1.48, 2.08], [1.74, 1.84]];
    const em = mesh(blade(edge, .065, 0, 2, 2), addMat(c1, .95), [0, 0, 0], group);
    const ring = new THREE.Group(); group.add(ring); ring.position.set(0, 1.9, 0);
    const rg = mesh(new THREE.TorusGeometry(.34, .012, 6, 40), addMat(c1, .8), [0, 0, 0], ring); rg.rotation.x = Math.PI / 2;
    const orb = mesh(new THREE.SphereGeometry(.05, 8, 8), addMat(0xffffff, 1), [.34, 0, 0], ring);
    const halo = new THREE.Group(); halo.position.set(0, 2.05, .75); group.add(halo); halo.visible = false;
    const hr = mesh(new THREE.CircleGeometry(1.5, 48), addMat(c0, .85, runeTex()), [0, 0, 0], halo); hr.rotation.y = 0; hr.castShadow = false;
    const ht = mesh(new THREE.TorusGeometry(1.46, .03, 6, 60), addMat(c1, .9), [0, 0, 0], halo); ht.castShadow = false;
    halo.rotation.y = Math.PI / 2;
    const glow = glowSprite(c0, 3, .3); glow.position.set(0, 2.1, .75); group.add(glow);
    base.set(0, 2.0, 0); tip.set(0, 1.95, 1.7); grip2.set(0, -.3, 0);
    m.update = (t, awake, dt) => {
      const l = lerpLevel(awake, dt); ring.rotation.y = t * 2.4; ring.rotation.z = Math.sin(t) * .4; (em.material as THREE.MeshBasicMaterial).opacity = .8 + Math.sin(t * 6) * .15 + l * .1; bm.emissiveIntensity = .5 + l * 1.2;
      halo.visible = l > .03; halo.scale.setScalar(.2 + l * .85); hr.rotation.z = t * .9; ht.rotation.z = -t; (hr.material as THREE.MeshBasicMaterial).opacity = .85 * l;
      glow.scale.setScalar(3 + l * 2 + Math.sin(t * 4) * .3); orb.scale.setScalar(1 + Math.sin(t * 9) * .3);
    };
  } else if (id === 'glacier') {
    m.length = 2.9;
    mesh(new THREE.CylinderGeometry(.032, .036, 2.3, 10), stdMat(0xcfe6f0, .2, .9), [0, .55, 0], group);
    for (let i = 0; i < 9; i++) mesh(new THREE.TorusGeometry(.04, .008, 5, 12), stdMat(0x66aacc, .2, 1, c0, .6), [0, -.35 + i * .25, 0], group).rotation.x = Math.PI / 2 + .3;
    mesh(new THREE.ConeGeometry(.045, .35, 8), steel, [0, -.75, 0], group).rotation.x = Math.PI;
    mesh(new THREE.CylinderGeometry(.07, .05, .16, 10), gold, [0, 1.7, 0], group);
    const cm = new THREE.MeshStandardMaterial({ color: c1, emissive: c0, emissiveIntensity: 1.2, roughness: .08, metalness: .1, transparent: true, opacity: .88, flatShading: true });
    const main = mesh(new THREE.OctahedronGeometry(.5, 0), cm, [0, 2.3, 0], group); main.scale.set(.32, 1.25, .18);
    const sc: THREE.Mesh[] = [];
    for (const [x, z, h, r] of [[.16, .0, .5, .35], [-.16, 0, .45, -.35], [0, .14, .4, 0]]) { const c = mesh(new THREE.OctahedronGeometry(.3, 0), cm, [x, 1.9 + h * .1, z], group); c.scale.set(.2, 1.1 * h * 2, .12); c.rotation.z = -r; sc.push(c); }
    const shards = new THREE.Group(); shards.visible = false; group.add(shards);
    for (let i = 0; i < 7; i++) { const s = mesh(new THREE.OctahedronGeometry(.3, 0), cm, [0, 0, 0], shards); const a = (i / 7) * 6.28; s.position.set(Math.cos(a) * .35, 2.1 + (i % 3) * .2, Math.sin(a) * .35); s.scale.set(.2, 1.5 + (i % 3) * .4, .14); s.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); }
    const glow = glowSprite(c0, 2.4, .35); glow.position.set(0, 2.3, 0); group.add(glow);
    base.set(0, 1.9, 0); tip.set(0, 2.95, 0); grip2.set(0, -.3, 0);
    m.update = (t, awake, dt) => {
      const l = lerpLevel(awake, dt); cm.emissiveIntensity = 1.1 + Math.sin(t * 3) * .3 + l * 1.4; main.scale.set(.32 + l * .3, 1.25 + l * 1.4, .18 + l * .22); main.position.y = 2.3 + l * .8; tip.set(0, 2.95 + l * 1.7, 0);
      sc.forEach(s => { s.scale.multiplyScalar(1); }); shards.visible = l > .05; shards.scale.setScalar(.3 + l * 1.1); shards.position.y = l * .3; shards.rotation.y = t * .5; glow.position.y = 2.3 + l * .8; glow.scale.setScalar(2.4 + l * 2.5);
    };
  } else if (id === 'plasma') {
    m.length = 1.7;
    mesh(new THREE.CylinderGeometry(.03, .032, .5, 10), stdMat(0x0b0e14, .6, .5), [0, -.15, 0], group);
    mesh(new THREE.CylinderGeometry(.034, .034, .38, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0, emissive: c0, emissiveIntensity: 2.2 }), [0, -.15, 0], group).scale.set(1.05, 1, 1.05);
    const ts = mesh(new THREE.CylinderGeometry(.14, .14, .03, 6), stdMat(0xe8ecf4, .2, 1), [0, .12, 0], group); ts.rotation.x = 0;
    mesh(new THREE.TorusGeometry(.13, .008, 5, 6), stdMat(0, 1, 0, c0, 3), [0, .12, 0], group).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.03, .22, .045), stdMat(0x1a1d26, .3, .9), [0, .26, s * .04], group);
    const prof = curvedBlade(1.55, .052, .1, .2, .14);
    const outer = mesh(blade(prof, .03, .004, .25, 1.6), new THREE.MeshStandardMaterial({ color: c0, emissive: c0, emissiveIntensity: 1.8, transparent: true, opacity: .85, roughness: .1 }), [0, 0, 0], group);
    const inner = mesh(blade(curvedBlade(1.5, .02, .1, .22, .12), .036, 0, .25, 1.6), addMat(0xffffff, 1), [0, 0, 0], group);
    const ext = mesh(blade(curvedBlade(1.4, .05, .06, 1.78, .1), .026, 0, .25, 1.6), addMat(c0, .75), [0, 0, 0], group); ext.visible = false;
    const extCore = mesh(blade(curvedBlade(1.35, .018, .06, 1.8, .08), .03, 0, .25, 1.6), addMat(0xffffff, 1), [0, 0, 0], group); extCore.visible = false;
    const glow = glowSprite(c0, 2.2, .4); glow.position.set(0, .95, .05); group.add(glow);
    base.set(0, .4, 0); tip.set(0, 1.78, .1); grip2.set(0, -.3, 0);
    m.update = (t, awake, dt) => {
      const l = lerpLevel(awake, dt); (outer.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.7 + Math.sin(t * 25) * .15 + l;
      ext.visible = extCore.visible = l > .03; ext.scale.set(1, .2 + l * .8, 1); ext.position.y = (1 - (.2 + l * .8)) * 1.78 * .0; extCore.scale.set(1, .2 + l * .8, 1);
      tip.set(0, 1.78 + l * 1.45, .1 + l * .06); glow.scale.setScalar(2.2 + l * 2); glow.position.y = .95 + l * .7; inner.scale.set(1, 1, 1 + Math.sin(t * 30) * .08);
    };
  } else {
    m.length = 2.1;
    mesh(new THREE.CylinderGeometry(.06, .065, 2.1, 10), stdMat(0x2a2218, .5, .6), [0, .5, 0], group);
    for (let i = 0; i < 6; i++) mesh(new THREE.TorusGeometry(.07, .016, 6, 14), gold, [0, -.35 + i * .32, 0], group).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(.11, 12, 10), gold, [0, -.58, 0], group);
    const head = new THREE.Group(); head.position.set(0, 1.62, 0); group.add(head);
    mesh(new THREE.BoxGeometry(.52, .52, 1.0), stdMat(0x1c1a20, .3, .9), [0, 0, 0], head);
    for (const s of [-1, 1]) {
      const plate = mesh(new THREE.BoxGeometry(.6, .62, .14), gold, [0, 0, s * .54], head);
      const rn = mesh(new THREE.PlaneGeometry(.45, .45), new THREE.MeshStandardMaterial({ color: 0, emissive: c0, emissiveMap: runeStripTex('#ffffff'), emissiveIntensity: 2.2 }), [0, 0, s * .615], head); if (s < 0) rn.rotation.y = Math.PI; rn.castShadow = false; plate.castShadow = true;
      mesh(new THREE.BoxGeometry(.66, .1, .2), gold, [0, .3, s * .38], head); mesh(new THREE.BoxGeometry(.66, .1, .2), gold, [0, -.3, s * .38], head);
    }
    mesh(new THREE.BoxGeometry(.56, .14, .5), gold, [0, 0, 0], head);
    for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(.1, .35, 6), dark, [s * .3, 0, 0], head).rotation.z = -s * Math.PI / 2;
    const rr = mesh(new THREE.TorusGeometry(.4, .02, 6, 30), addMat(c0, .8), [0, 0, 0], head); rr.rotation.set(Math.PI / 2, 0, 0); rr.castShadow = false;
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), addMat(c0, .0)); aura.position.copy(head.position); group.add(aura);
    const halo1 = mesh(new THREE.TorusGeometry(1.1, .03, 6, 50), addMat(c1, .0), [0, 1.62, 0], group), halo2 = mesh(new THREE.TorusGeometry(.85, .025, 6, 50), addMat(c0, .0), [0, 1.62, 0], group); halo1.castShadow = halo2.castShadow = false;
    const glow = glowSprite(c0, 2.2, .3); glow.position.set(0, 1.62, 0); group.add(glow);
    base.set(0, 1.35, 0); tip.set(0, 1.62, 1.0); grip2.set(0, -.2, 0);
    m.update = (t, awake, dt) => {
      const l = lerpLevel(awake, dt); head.scale.setScalar(1 + l * .25); rr.rotation.z = t * 1.5; (rr.material as THREE.MeshBasicMaterial).opacity = .6 + Math.sin(t * 4) * .2 + l * .2;
      (aura.material as THREE.MeshBasicMaterial).opacity = l * (.16 + Math.sin(t * 7) * .04); aura.scale.setScalar(1 + l * .3 + Math.sin(t * 5) * .03);
      (halo1.material as THREE.MeshBasicMaterial).opacity = l * .8; (halo2.material as THREE.MeshBasicMaterial).opacity = l * .8; halo1.rotation.set(t * 1.3, t * .7, 0); halo2.rotation.set(-t, t * 1.1, 1);
      glow.scale.setScalar(2.2 + l * 3.2 + Math.sin(t * 5) * .2); tip.set(0, 1.62, 1 + l * .25);
    };
  }
  void T0; void T1;
  group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
  return m;
}
