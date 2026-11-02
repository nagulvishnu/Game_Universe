import * as THREE from 'three';
import { Look } from '../data/characters';
import { WEAPONS, WeaponInst } from '../data/weapons';
import { Fighter } from '../engine/types';
import { basic, geo, outlineMat, toon } from './materials';
import { buildWeapon } from './weaponModels';

const V = THREE.Vector3;
const L1 = 0.3, L2 = 0.29;

export interface Rig {
  root: THREE.Group; body: THREE.Group; hips: THREE.Group; chest: THREE.Group; head: THREE.Group;
  thighL: THREE.Group; shinL: THREE.Group; thighR: THREE.Group; shinR: THREE.Group;
  upL: THREE.Group; foreL: THREE.Group; upR: THREE.Group; foreR: THREE.Group;
  gunPivot: THREE.Group; gun: THREE.Group | null; gunKey: string; muzzle: THREE.Object3D | null;
  chute: THREE.Group; packMesh: THREE.Mesh; helmetMesh: THREE.Mesh; vestMesh: THREE.Mesh;
  eyeL: THREE.Mesh; eyeR: THREE.Mesh; mouth: THREE.Mesh;
  st: { crouch: number; prone: number; aim: number; sprint: number; air: number; dead: number; speed: number; sit: number; fall: number; chute: number; victory: number; blink: number; hold: number };
  gearKey: string; t: number; look: Look; twist: number;
}

const sph = (r: number, w = 14, h = 10) => geo(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const bx = (w: number, h: number, d: number) => geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const cy = (rt: number, rb: number, h: number, seg = 10) => geo(`cy${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const cn = (r: number, h: number, seg = 8) => geo(`cn${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));

function mk(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, outline = false) {
  const me = new THREE.Mesh(g, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  parent.add(me);
  if (outline) { const o = new THREE.Mesh(g, outlineMat()); o.scale.setScalar(1.07); me.add(o); }
  return me;
}

function buildHair(head: THREE.Group, look: Look) {
  const hm = toon(look.hair);
  const cap = mk(head, geo('hcap', () => new THREE.SphereGeometry(0.19, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)), hm, 0, 0.015, -0.01, true);
  cap.rotation.x = -0.15;
  const spike = (x: number, y: number, z: number, rx: number, rz: number, s = 1, len = 0.2) => {
    const c = mk(head, cn(0.06 * s, len * s, 6), hm, x, y, z); c.rotation.set(rx, 0, rz); return c;
  };
  switch (look.hairStyle) {
    case 'spiky':
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; spike(Math.cos(a) * 0.13, 0.17, Math.sin(a) * 0.13 - 0.02, Math.sin(a) * 0.9, -Math.cos(a) * 0.9, 1.1, 0.26); }
      spike(0, 0.26, 0.02, 0, 0, 1.2, 0.3); spike(0.07, 0.12, 0.17, 1.2, -0.3, 0.9, 0.2); spike(-0.07, 0.12, 0.17, 1.2, 0.3, 0.9, 0.2); spike(0, 0.1, 0.18, 1.3, 0, 0.8, 0.18);
      spike(0, 0.0, -0.2, -1.3, 0, 1.3, 0.3);
      break;
    case 'long':
      mk(head, bx(0.38, 0.5, 0.1), hm, 0, -0.2, -0.15);
      mk(head, bx(0.06, 0.36, 0.14), hm, 0.19, -0.1, 0.0); mk(head, bx(0.06, 0.36, 0.14), hm, -0.19, -0.1, 0.0);
      spike(0.06, 0.1, 0.18, 1.35, -0.2, 1, 0.22); spike(-0.08, 0.1, 0.18, 1.35, 0.25, 1, 0.22);
      break;
    case 'flame':
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; spike(Math.cos(a) * 0.12, 0.18, Math.sin(a) * 0.12, Math.sin(a) * 0.5, -Math.cos(a) * 0.5, 1.3, 0.34); }
      spike(0, 0.28, 0, 0, 0, 1.6, 0.42); spike(0.05, 0.14, 0.17, 1.2, 0, 1, 0.22); spike(-0.05, 0.14, 0.17, 1.2, 0, 1, 0.22);
      break;
    case 'bob':
      mk(head, bx(0.41, 0.2, 0.4), hm, 0, -0.05, -0.02).scale.set(1, 1, 1);
      mk(head, bx(0.38, 0.06, 0.06), hm, 0, 0.1, 0.19);
      break;
    case 'ponytail':
      mk(head, cy(0.03, 0.06, 0.4, 6), hm, 0, -0.1, -0.24).rotation.x = 0.3; mk(head, sph(0.06), hm, 0, 0.08, -0.2);
      spike(0.06, 0.12, 0.18, 1.3, 0, 1, 0.2); spike(-0.06, 0.12, 0.18, 1.3, 0, 1, 0.2);
      break;
    case 'mohawk':
      for (let i = 0; i < 5; i++) spike(0, 0.19, -0.1 + i * 0.07, 0, 0, 1.1, 0.28);
      break;
    default:
      spike(0.07, 0.12, 0.18, 1.3, -0.3, 1, 0.22); spike(-0.07, 0.12, 0.18, 1.3, 0.3, 1, 0.22); spike(0, 0.1, 0.19, 1.35, 0, 1, 0.2);
      mk(head, bx(0.06, 0.22, 0.14), hm, 0.19, -0.04, 0.0);
  }
}

export function createRig(look: Look): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  const skin = toon(look.skin), top = toon(look.top), bottom = toon(look.bottom), accent = toon(look.accent), vest = toon(look.vest), glove = toon(look.glove), boot = toon(look.boots);
  const glowMat = look.glow ? basic(look.glow) : null;
  // pelvis
  mk(hips, cy(0.19, 0.17, 0.18, 12), bottom, 0, 0.02, 0, true);
  mk(hips, bx(0.4, 0.05, 0.22), toon('#222831'), 0, 0.1, 0); // belt
  mk(hips, bx(0.07, 0.06, 0.03), accent, 0, 0.1, 0.115);
  // legs
  const mkLeg = (sx: number) => {
    const thigh = new THREE.Group(); thigh.position.set(sx * 0.1, -0.02, 0); hips.add(thigh);
    mk(thigh, cy(0.085, 0.07, 0.46, 8), bottom, 0, -0.23, 0, true);
    if (glowMat) mk(thigh, bx(0.012, 0.3, 0.012), glowMat, sx * 0.075, -0.22, 0.03);
    mk(thigh, bx(0.1, 0.08, 0.06), vest, sx * 0.02, -0.12, 0.08);
    const shin = new THREE.Group(); shin.position.y = -0.45; thigh.add(shin);
    mk(shin, cy(0.065, 0.055, 0.42, 8), bottom, 0, -0.2, 0, true);
    mk(shin, bx(0.1, 0.12, 0.16), boot, 0, -0.38, 0.03, true);
    mk(shin, bx(0.11, 0.2, 0.11), boot, 0, -0.27, 0);
    mk(shin, bx(0.09, 0.05, 0.05), accent, 0, -0.28, 0.06);
    return { thigh, shin };
  };
  const lL = mkLeg(-1), lR = mkLeg(1);
  // spine / chest
  const spine = new THREE.Group(); spine.position.y = 0.05; hips.add(spine);
  const chest = new THREE.Group(); spine.add(chest);
  mk(chest, cy(0.2, 0.17, 0.52, 12), top, 0, 0.27, 0, true).scale.set(1.05, 1, 0.78);
  const vestMesh = mk(chest, bx(0.4, 0.38, 0.27), vest, 0, 0.3, 0.02); vestMesh.scale.set(1, 1, 1);
  mk(chest, bx(0.1, 0.12, 0.05), accent, 0.0, 0.42, 0.155);
  mk(chest, bx(0.03, 0.4, 0.28), accent, -0.12, 0.3, 0.02);
  if (glowMat) { mk(chest, bx(0.2, 0.012, 0.01), glowMat, 0, 0.2, 0.155); mk(chest, bx(0.012, 0.18, 0.01), glowMat, 0.1, 0.34, 0.155); }
  mk(chest, bx(0.1, 0.1, 0.06), vest, 0.1, 0.15, 0.15); mk(chest, bx(0.1, 0.1, 0.06), vest, -0.1, 0.15, 0.15);
  // backpack
  const packMesh = mk(chest, bx(0.3, 0.38, 0.2), toon('#4a5a40'), 0, 0.3, -0.24, true);
  packMesh.visible = false;
  // neck + head
  mk(chest, cy(0.05, 0.06, 0.1, 8), skin, 0, 0.56, 0);
  const head = new THREE.Group(); head.position.set(0, 0.74, 0); chest.add(head);
  const hm = mk(head, sph(0.17, 22, 16), skin, 0, 0, 0, true); hm.scale.set(1, 1.04, 1.0);
  mk(head, sph(0.03, 8, 6), skin, 0, -0.01, 0.168).scale.set(1, 0.8, 0.8); // nose
  mk(head, sph(0.04, 8, 6), skin, 0.17, -0.01, 0).scale.set(0.5, 1, 0.8); mk(head, sph(0.04, 8, 6), skin, -0.17, -0.01, 0).scale.set(0.5, 1, 0.8);
  const eyeMat = toon('#ffffff'), iris = toon(look.eye, { emissive: look.eye, emissiveIntensity: 0.5 }), pupil = basic('#0b0b14'), hl = basic('#ffffff');
  const mkEye = (sx: number) => {
    const e = new THREE.Mesh(sph(0.04, 12, 10), eyeMat); e.position.set(sx * 0.07, 0.025, 0.14); e.scale.set(1.0, 1.35, 0.45); head.add(e);
    const ir = new THREE.Mesh(sph(0.028, 12, 10), iris); ir.position.set(0, -0.004, 0.015); ir.scale.set(1, 1.2, 0.6); e.add(ir);
    const pu = new THREE.Mesh(sph(0.014, 8, 6), pupil); pu.position.set(0, -0.003, 0.012); ir.add(pu);
    const h1 = new THREE.Mesh(sph(0.009, 6, 5), hl); h1.position.set(0.012, 0.014, 0.016); ir.add(h1);
    const brow = new THREE.Mesh(bx(0.06, 0.012, 0.015), toon(look.hair)); brow.position.set(sx * 0.07, 0.085, 0.155); brow.rotation.z = -sx * 0.18; head.add(brow);
    return e;
  };
  const eyeL = mkEye(-1), eyeR = mkEye(1);
  const mouth = mk(head, bx(0.05, 0.012, 0.01), toon('#7a2a2a'), 0, -0.075, 0.162);
  buildHair(head, look);
  // helmet
  const helmetMesh = mk(head, geo('helm', () => new THREE.SphereGeometry(0.205, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), toon('#4b5563'), 0, 0.02, -0.005, true);
  helmetMesh.visible = false;
  // accessories
  switch (look.accessory) {
    case 'scarf': mk(chest, geo('scarf', () => new THREE.TorusGeometry(0.1, 0.045, 8, 14).rotateX(Math.PI / 2)), accent, 0, 0.55, 0); mk(chest, bx(0.09, 0.3, 0.025), accent, 0.06, 0.38, -0.17).rotation.x = 0.2; break;
    case 'visor': mk(head, bx(0.3, 0.07, 0.07), toon(look.glow ?? '#38bdf8', { emissive: look.glow ?? '#38bdf8', emissiveIntensity: 1.2, transparent: true, opacity: 0.75 }), 0, 0.03, 0.15); mk(head, bx(0.05, 0.07, 0.07), vest, 0.18, 0.0, 0.0); break;
    case 'headband': mk(head, geo('hband', () => new THREE.TorusGeometry(0.18, 0.018, 6, 20).rotateX(Math.PI / 2)), accent, 0, 0.07, 0); mk(head, bx(0.03, 0.2, 0.01), accent, 0.04, 0.0, -0.2).rotation.x = 0.4; mk(head, bx(0.03, 0.18, 0.01), accent, -0.05, -0.02, -0.2).rotation.x = 0.55; break;
    case 'mask': mk(head, bx(0.25, 0.1, 0.1), toon('#15121f'), 0, -0.08, 0.1, false); if (glowMat) mk(head, bx(0.2, 0.01, 0.01), glowMat, 0, -0.08, 0.153); break;
    case 'headset': mk(head, bx(0.05, 0.1, 0.1), vest, 0.19, 0.0, 0.0); mk(head, bx(0.05, 0.1, 0.1), vest, -0.19, 0.0, 0.0); mk(head, bx(0.012, 0.012, 0.1), toon('#222'), 0.17, -0.07, 0.07); break;
    default: break;
  }
  // arms
  const mkArm = (sx: number) => {
    const up = new THREE.Group(); up.position.set(sx * 0.23, 0.46, 0); chest.add(up);
    mk(up, sph(0.075, 10, 8), vest, 0, 0, 0, true);
    mk(up, cy(0.058, 0.05, L1, 8), top, 0, -L1 / 2, 0, true);
    const fore = new THREE.Group(); fore.position.y = -L1; up.add(fore);
    mk(fore, cy(0.05, 0.042, L2, 8), skin, 0, -L2 / 2, 0, true);
    mk(fore, cy(0.054, 0.052, 0.12, 8), glove, 0, -L2 + 0.03, 0);
    mk(fore, sph(0.052, 8, 6), glove, 0, -L2 - 0.02, 0.01);
    return { up, fore };
  };
  const aL = mkArm(-1), aR = mkArm(1);
  const gunPivot = new THREE.Group(); chest.add(gunPivot);
  // parachute
  const chute = new THREE.Group(); chute.visible = false; chest.add(chute);
  const canopy = mk(chute, geo('canopy', () => new THREE.SphereGeometry(1.9, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), toon(look.accent, { side: THREE.DoubleSide }), 0, 2.4, -0.1);
  canopy.castShadow = false;
  mk(chute, geo('canopy2', () => new THREE.SphereGeometry(1.92, 18, 10, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.06)), toon('#ffffff', { side: THREE.DoubleSide }), 0, 2.4, -0.1);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const l = mk(chute, cy(0.006, 0.006, 2.6, 3), basic('#222'), Math.cos(a) * 0.95, 1.3, Math.sin(a) * 0.95 - 0.1); l.rotation.set(Math.sin(a) * 0.36, 0, -Math.cos(a) * 0.36); l.castShadow = false; }
  return {
    root, body, hips, chest, head, thighL: lL.thigh, shinL: lL.shin, thighR: lR.thigh, shinR: lR.shin,
    upL: aL.up, foreL: aL.fore, upR: aR.up, foreR: aR.fore, gunPivot, gun: null, gunKey: '', muzzle: null, chute, packMesh, helmetMesh, vestMesh, eyeL, eyeR, mouth,
    st: { crouch: 0, prone: 0, aim: 0, sprint: 0, air: 0, dead: 0, speed: 0, sit: 0, fall: 0, chute: 0, victory: 0, blink: 0, hold: 0 },
    gearKey: '', t: Math.random() * 10, look, twist: Math.random() < 0.5 ? 1 : -1,
  };
}

const _s = new V(), _t = new V(), _e = new V(), _pole = new V(), _d = new V(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const DOWN = new V(0, -1, 0);
function solveArm(up: THREE.Group, fore: THREE.Group, target: THREE.Vector3, poleOut: number) {
  _s.copy(up.position);
  _d.subVectors(target, _s);
  let D = _d.length();
  const maxD = L1 + L2 - 0.01;
  if (D > maxD) { _d.multiplyScalar(maxD / D); D = maxD; }
  if (D < 0.12) D = 0.12;
  const dn = _d.clone().normalize();
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  _pole.set(poleOut, -1, -0.3);
  _pole.addScaledVector(dn, -_pole.dot(dn)).normalize();
  _e.copy(_s).addScaledVector(dn, a).addScaledVector(_pole, h);
  _t.copy(_s).add(_d);
  up.quaternion.setFromUnitVectors(DOWN, _d.subVectors(_e, _s).normalize());
  _q.copy(up.quaternion).invert();
  const fd = _d.subVectors(_t, _e).normalize().applyQuaternion(_q);
  fore.quaternion.setFromUnitVectors(DOWN, fd);
}

const sm = (cur: number, target: number, dt: number, rate = 10) => cur + (target - cur) * Math.min(1, dt * rate);
const ease = (t: number) => t * t * (3 - 2 * t);

const gunPos = new V(), gunQ = new THREE.Quaternion(), rh = new V(), lh = new V(), tmpV = new V();
const eul = new THREE.Euler(), tiltQ = new THREE.Quaternion();

export function setRigGear(rig: Rig, f: Fighter) {
  const key = `${f.armor}|${f.helmet}|${f.pack}`;
  if (key === rig.gearKey) return;
  rig.gearKey = key;
  rig.packMesh.visible = f.pack > 0;
  rig.packMesh.scale.set(1 + f.pack * 0.12, 0.8 + f.pack * 0.2, 1 + f.pack * 0.2);
  rig.helmetMesh.visible = f.helmet > 0;
  (rig.helmetMesh.material as THREE.MeshToonMaterial) = toon(['#4b5563', '#6b7280', '#2563eb', '#7c3aed'][f.helmet]);
  rig.vestMesh.scale.set(1 + f.armor * 0.06, 1, 1 + f.armor * 0.12);
}

export function setRigWeapon(rig: Rig, inst: WeaponInst | null) {
  const key = inst ? inst.id + JSON.stringify(inst.att) : '';
  if (key === rig.gunKey) return;
  rig.gunKey = key;
  if (rig.gun) { rig.gunPivot.remove(rig.gun); rig.gun = null; rig.muzzle = null; }
  if (inst) {
    rig.gun = buildWeapon(inst); rig.gunPivot.add(rig.gun); rig.muzzle = rig.gun.userData.muzzle;
  }
}

/** Procedural animation: blends poses by smoothing continuous parameters. */
export function animateRig(rig: Rig, f: Fighter, dt: number, gameTime: number) {
  const s = rig.st;
  rig.t += dt;
  const st = f.stance;
  const state = f.state;
  const dead = !f.alive;
  const air = state === 'ground' && !f.grounded ? 1 : 0;
  const sit = state === 'vehicle' ? 1 : 0;
  const fall = state === 'freefall' ? 1 : 0;
  const chute = state === 'chute' ? 1 : 0;
  s.crouch = sm(s.crouch, st === 'crouch' && state === 'ground' ? 1 : 0, dt, 12);
  s.prone = sm(s.prone, st === 'prone' && state === 'ground' ? 1 : 0, dt, 9);
  s.aim = sm(s.aim, f.aiming && state === 'ground' ? 1 : 0, dt, 14);
  s.sprint = sm(s.sprint, f.sprinting ? 1 : 0, dt, 9);
  s.air = sm(s.air, air, dt, 12);
  s.dead = sm(s.dead, dead ? 1 : 0, dt, dead ? 5 : 20);
  s.sit = sm(s.sit, sit, dt, 10);
  s.fall = sm(s.fall, fall, dt, 6);
  s.chute = sm(s.chute, chute, dt, 8);
  s.victory = sm(s.victory, f.victory ? 1 : 0, dt, 6);
  s.speed = sm(s.speed, Math.min(f.speedSm, 9), dt, 12);
  const hasGun = !!f.weapon && state === 'ground' && !dead && f.healT <= 0 && !(f.throwT > 0.15) && !f.victory;
  s.hold = sm(s.hold, hasGun ? 1 : 0, dt, 10);
  // blink
  const bl = Math.sin(rig.t * 0.9 + rig.twist * 3) > 0.985 ? 0.15 : 1;
  rig.eyeL.scale.y = rig.eyeR.scale.y = 1.35 * bl;
  rig.mouth.scale.set(1, f.hitT > 0 || f.kickT > 0 ? 3.5 : f.victory ? 4 : 1, 1);

  const spd = s.speed;
  const run = Math.min(1, spd / 5.4);
  const stridePh = f.stride * 2.1;
  const swing = Math.sin(stridePh);
  const walkAmp = (0.35 + 0.5 * Math.min(1, spd / 5.6) + 0.35 * s.sprint) * Math.min(1, spd / 1.4) * (1 - s.crouch * 0.35);
  const mv = 1 - s.prone;
  // root
  rig.root.rotation.y = f.bodyYaw;
  // hips
  let hipY = 0.92 - 0.4 * s.crouch - 0.42 * s.sit;
  hipY += -Math.abs(swing) * 0.045 * run * mv - (f.landT > 0 ? 0.22 * Math.min(1, f.landT / 0.35) : 0);
  rig.hips.position.y = hipY;
  rig.hips.rotation.set(0, 0, 0);
  // legs
  const legSwing = swing * walkAmp;
  let thL = legSwing * mv, thR = -legSwing * mv;
  let shL = Math.max(0, -Math.cos(stridePh)) * walkAmp * 1.1 * mv, shR = Math.max(0, Math.cos(stridePh)) * walkAmp * 1.1 * mv;
  thL = thL - 1.12 * s.crouch - 1.5 * s.sit; thR = thR - 1.12 * s.crouch - 1.5 * s.sit;
  shL += 1.35 * s.crouch + 1.5 * s.sit; shR += 1.35 * s.crouch + 1.5 * s.sit;
  // prone crawl
  const crawl = Math.sin(stridePh * 0.8) * 0.35 * s.prone * Math.min(1, spd / 0.6);
  thL += crawl; thR -= crawl;
  // airborne / freefall / parachute
  thL = thL * (1 - s.air) + (-0.7) * s.air; thR = thR * (1 - s.air) + (0.25) * s.air;
  shL = shL * (1 - s.air) + 1.1 * s.air; shR = shR * (1 - s.air) + 0.5 * s.air;
  thL += s.fall * 0.5 + s.chute * 0.1; thR += s.fall * 0.5 + s.chute * 0.1;
  shL += s.fall * 0.5; shR += s.fall * 0.5;
  rig.thighL.rotation.set(thL, 0, 0.04 + s.fall * 0.3); rig.thighR.rotation.set(thR, 0, -0.04 - s.fall * 0.3);
  rig.shinL.rotation.set(shL, 0, 0); rig.shinR.rotation.set(shR, 0, 0);
  // body tilt: prone / freefall / dead
  const lieFace = Math.max(s.prone, s.fall * 0.92);
  rig.body.rotation.set(lieFace * Math.PI / 2 - s.dead * (Math.PI / 2 + lieFace * Math.PI / 2), s.dead * 0.3 * rig.twist, 0);
  rig.body.position.set(0, 0.18 * lieFace + 0.12 * s.dead, -0.85 * s.prone * mv * 1 + (-0.2) * s.dead);
  if (s.fall > 0.01) rig.body.position.set(0, 0.9 * s.fall, 0);
  if (s.prone < 0.01 && s.fall < 0.01 && s.dead > 0.01) rig.body.position.set(0, 0.2 * s.dead, -0.45 * s.dead);
  // chest
  const lean = 0.08 * run + 0.22 * s.sprint + 0.2 * s.crouch + 0.3 * s.sit;
  const pitch = f.pitch;
  let chestX = lean - pitch * (0.55 + 0.25 * s.aim) * (state === 'ground' ? 1 : 0.2) + (rig.hips.position.y < 0.6 ? 0 : 0);
  chestX += -f.kickT > -0.1 && f.kickT > 0 ? -0.06 : 0;
  const hit = Math.max(0, f.hitT) / 0.3;
  chestX += -0.28 * hit;
  chestX -= s.prone * (Math.PI / 2 - 0.95);
  chestX += s.fall * -0.5 + s.chute * -0.1;
  const brh = Math.sin(rig.t * 2) * 0.012;
  rig.chest.rotation.set(chestX, swing * walkAmp * 0.18 * mv * (1 - s.hold * 0.5) + hit * 0.2, hit * 0.1);
  rig.chest.scale.set(1, 1 + brh, 1);
  rig.head.rotation.set(-pitch * 0.45 * (state === 'ground' ? 1 : 0.3) + 0.1 * hit + chestX * -0.5 * (1 - s.prone), 0, 0);
  if (s.prone > 0.5) rig.head.rotation.x = -0.9 * s.prone + pitch * -0.3;
  if (s.dead > 0.5) rig.head.rotation.x = 0.3;
  // net tilt for gun compensation
  const net = rig.body.rotation.x + rig.chest.rotation.x;
  tiltQ.setFromAxisAngle(new V(1, 0, 0), -net);
  // ---- gun pose (upright frame) ----
  const w = f.weapon ? WEAPONS[f.weapon.id] : null;
  const isPistol = w?.cat === 'PISTOL';
  const aim = s.aim, spr = s.sprint;
  const hipP = new V(0.17, 0.14, isPistol ? 0.36 : 0.32);
  const adsP = new V(0.035, isPistol ? 0.5 : 0.46, isPistol ? 0.42 : 0.38);
  const sprP = new V(0.12, 0.02, 0.28);
  gunPos.copy(hipP).lerp(adsP, aim).lerp(sprP, spr * (1 - aim));
  let gRotX = -f.pitch * 0.6 * (1 - spr) + 0.08 * (1 - aim) + 0.55 * spr;
  let gRotY = -0.06 * (1 - aim) - 0.5 * spr;
  let gRotZ = 0;
  // recoil kick
  const kick = f.kickT > 0 ? f.kickT / 0.12 : 0;
  gunPos.z -= kick * (w?.cat === 'SNIPER' || w?.cat === 'SHOTGUN' ? 0.14 : 0.06);
  gRotX -= kick * (w?.cat === 'SNIPER' || w?.cat === 'SHOTGUN' ? 0.2 : 0.08);
  // idle sway / walk bob
  gunPos.y += Math.sin(rig.t * 1.6) * 0.004 + Math.abs(swing) * 0.015 * run * (1 - aim);
  // reload
  let lhRel: THREE.Vector3 | null = null;
  if (f.reloadT > 0 && w) {
    const p = w.reloadEach ? (f.reloadT / (w.reloadEach)) : 1 - f.reloadT / Math.max(0.01, f.reloadTotal);
    const q = w.reloadEach ? 1 - p : p;
    const k = Math.sin(Math.min(1, q) * Math.PI);
    gRotZ += 0.5 * k; gRotX -= 0.25 * k; gunPos.y -= 0.05 * k;
    lhRel = new V(-0.12 + 0.12 * (1 - k), -0.02 - 0.28 * k, 0.12 + 0.05 * k);
  }
  // switch
  if (f.switchT > 0) { const k = Math.sin(Math.min(1, f.switchT / 0.5) * Math.PI); gunPos.y -= 0.3 * k; gRotX += 0.6 * k; }
  eul.set(gRotX, gRotY, gRotZ, 'YXZ');
  gunQ.setFromEuler(eul);
  // convert upright-frame pose to chest-local
  gunPos.applyQuaternion(tiltQ);
  gunQ.premultiply(tiltQ);
  rig.gunPivot.position.copy(gunPos);
  rig.gunPivot.quaternion.copy(gunQ);
  rig.gunPivot.visible = hasGun || s.hold > 0.2;
  // hand targets
  const gripZ = w ? w.grip : 0.3;
  rh.set(0.0, -0.045, -0.04).applyQuaternion(gunQ).add(gunPos);
  lh.set(0.0, -0.04, gripZ).applyQuaternion(gunQ).add(gunPos);
  if (lhRel) lh.copy(lhRel).applyQuaternion(tiltQ).add(new V(0, 0.12, 0.08));
  // free-hand targets (no weapon)
  const sw = swing * walkAmp * 0.9;
  const freeR = new V(0.3, 0.02 - 0.35 * (1 - s.crouch * 0.3), 0.04 - sw * 0.5 + 0.1 * s.sprint);
  const freeL = new V(-0.3, 0.02 - 0.35 * (1 - s.crouch * 0.3), 0.04 + sw * 0.5 + 0.1 * s.sprint);
  const R = new V().copy(freeR), Lh = new V().copy(freeL);
  R.lerp(rh, s.hold); Lh.lerp(lh, s.hold);
  // throw
  if (f.throwT > 0) {
    const p = 1 - f.throwT / 0.7;
    const back = ease(Math.min(1, p / 0.45)), fwd = ease(Math.max(0, (p - 0.45) / 0.3));
    const t = new V(0.28, 0.65 - 0.2 * fwd, -0.35 + 0.95 * fwd).multiplyScalar(1).lerp(new V(0.3, 0.45, 0.1), 1 - back);
    R.lerp(t, 0.95);
    Lh.set(-0.2, 0.3, 0.25);
  }
  if (state === 'ground' && f.healT > 0) { R.set(0.12, 0.25, 0.3); Lh.set(-0.1, 0.22, 0.28); }
  // victory / chute / fall / vehicle
  if (s.victory > 0.01) {
    const jumpy = Math.sin(gameTime * 6) * 0.06;
    R.lerp(new V(0.3, 1.05 + jumpy, 0.1), s.victory); Lh.lerp(new V(-0.3, 1.0 - jumpy, 0.1), s.victory);
  }
  if (s.chute > 0.01) { R.lerp(new V(0.28, 1.0, 0.12), s.chute); Lh.lerp(new V(-0.28, 1.0, 0.12), s.chute); }
  if (s.fall > 0.01) { R.lerp(new V(0.72, 0.2, 0.28), s.fall); Lh.lerp(new V(-0.72, 0.2, 0.28), s.fall); }
  if (s.sit > 0.01) { R.lerp(new V(0.18, 0.15, 0.44), s.sit); Lh.lerp(new V(-0.18, 0.15, 0.44), s.sit); }
  if (s.dead > 0.01) { R.lerp(new V(0.38 * rig.twist, -0.05, -0.1), s.dead); Lh.lerp(new V(-0.4 * rig.twist, 0.0, 0.15), s.dead); }
  solveArm(rig.upR, rig.foreR, R, 1.0);
  solveArm(rig.upL, rig.foreL, Lh, -1.0);
  // parachute canopy visibility
  rig.chute.visible = state === 'chute';
  if (rig.chute.visible) { rig.chute.rotation.x = -(rig.chest.rotation.x); rig.chute.position.set(0, 0.1, 0); }
  rig.root.rotation.x = 0;
  void tmpV; void _q2;
}

export function disposeRig(rig: Rig) {
  rig.root.removeFromParent();
  // geometries & materials are shared through caches
}
