import * as THREE from 'three';
import { ATTACHMENTS, WEAPONS, WeaponInst } from '../data/weapons';
import { basic, geo, toon } from './materials';

const box = (w: number, h: number, d: number) => geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (r: number, l: number, seg = 10) => geo(`c${r}|${l}|${seg}`, () => new THREE.CylinderGeometry(r, r, l, seg).rotateX(Math.PI / 2));

/** Weapon model: origin at the grip, barrel along +Z. `muzzle` marks the barrel tip. */
export function buildWeapon(inst: WeaponInst) {
  const d = WEAPONS[inst.id];
  const g = new THREE.Group();
  const main = toon(d.color), dark = toon('#20242c'), metal = toon('#59616e');
  const add = (geom: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me;
  };
  const L = d.len;
  let barrelEnd = L * 0.5;
  switch (d.cat) {
    case 'AR': {
      add(box(0.07, 0.11, L * 0.5), main, 0, 0.02, L * 0.12);
      add(box(0.06, 0.1, 0.28), dark, 0, -0.01, -0.28); // stock
      add(box(0.05, 0.05, 0.14), dark, 0, 0.0, -0.45);
      add(cyl(0.017, L * 0.4), metal, 0, 0.035, L * 0.5);
      add(box(0.05, 0.2, 0.08), dark, 0, -0.14, 0.1).rotation.x = 0.15; // mag
      add(box(0.05, 0.12, 0.06), dark, 0, -0.1, -0.02); // grip
      add(box(0.04, 0.03, 0.2), metal, 0, 0.085, 0.1); // rail
      barrelEnd = L * 0.7;
      if (d.id === 'viper') { add(box(0.09, 0.05, 0.3), toon('#1b4332'), 0, 0.03, 0.35); }
      break;
    }
    case 'SMG': {
      add(box(0.065, 0.1, L * 0.7), main, 0, 0.02, L * 0.15);
      add(cyl(0.018, L * 0.35), metal, 0, 0.03, L * 0.58);
      add(box(0.045, 0.24, 0.06), dark, 0, -0.17, 0.12);
      add(box(0.05, 0.12, 0.06), dark, 0, -0.1, -0.02);
      add(box(0.04, 0.04, 0.22), metal, 0, 0.0, -0.22);
      barrelEnd = L * 0.78;
      break;
    }
    case 'SNIPER': {
      add(box(0.065, 0.1, L * 0.45), main, 0, 0.02, 0.0);
      add(box(0.07, 0.13, 0.32), dark, 0, -0.01, -0.34);
      add(cyl(0.02, L * 0.55), metal, 0, 0.03, L * 0.5);
      add(cyl(0.036, 0.3), dark, 0, 0.115, 0.05);
      add(cyl(0.045, 0.06), metal, 0, 0.115, 0.22);
      add(box(0.05, 0.1, 0.06), dark, 0, -0.1, -0.02);
      add(box(0.05, 0.12, 0.08), dark, 0, -0.1, 0.18);
      barrelEnd = L * 0.78;
      break;
    }
    case 'SHOTGUN': {
      add(box(0.07, 0.1, L * 0.35), main, 0, 0.02, 0.0);
      add(box(0.07, 0.12, 0.32), toon('#6b4a2f'), 0, -0.01, -0.3);
      add(cyl(0.03, L * 0.6), metal, 0, 0.04, L * 0.45);
      add(cyl(0.032, L * 0.4), dark, 0, -0.01, L * 0.38);
      add(box(0.075, 0.08, 0.2), toon('#6b4a2f'), 0, -0.03, 0.34);
      add(box(0.05, 0.1, 0.06), dark, 0, -0.1, -0.02);
      barrelEnd = L * 0.75;
      break;
    }
    case 'PISTOL': {
      add(box(0.045, 0.07, 0.22), main, 0, 0.03, 0.08);
      add(box(0.042, 0.13, 0.06), dark, 0, -0.06, -0.01).rotation.x = 0.2;
      add(box(0.035, 0.03, 0.08), metal, 0, 0.075, 0.05);
      barrelEnd = 0.2;
      break;
    }
    case 'LMG': {
      add(box(0.09, 0.13, L * 0.45), main, 0, 0.02, 0.0);
      add(box(0.07, 0.13, 0.32), dark, 0, -0.01, -0.34);
      add(cyl(0.025, L * 0.45), metal, 0, 0.04, L * 0.5);
      add(cyl(0.04, L * 0.2), dark, 0, 0.03, L * 0.42);
      add(box(0.14, 0.14, 0.18), toon('#3b3f4a'), 0, -0.14, 0.05); // drum
      add(box(0.05, 0.1, 0.06), dark, 0, -0.1, -0.05);
      add(box(0.02, 0.1, 0.02), metal, 0.05, -0.08, L * 0.62).rotation.z = 0.4;
      add(box(0.02, 0.1, 0.02), metal, -0.05, -0.08, L * 0.62).rotation.z = -0.4;
      add(box(0.05, 0.05, 0.12), dark, 0, 0.11, 0.0);
      barrelEnd = L * 0.78;
      break;
    }
  }
  // attachments (visual)
  const a = inst.att;
  if (a.sight) {
    const at = ATTACHMENTS[a.sight];
    if (a.sight === 'reddot') { add(box(0.04, 0.045, 0.06), dark, 0, 0.11, 0.08); add(box(0.03, 0.03, 0.005), basic('#ff3030'), 0, 0.115, 0.112); }
    else add(cyl(at.zoom && at.zoom > 3 ? 0.04 : 0.032, at.zoom && at.zoom > 3 ? 0.36 : 0.22), dark, 0, 0.13, 0.08);
  }
  if (a.muzzle === 'suppressor') { add(cyl(0.032, 0.26), toon('#16181d'), 0, d.cat === 'PISTOL' ? 0.04 : 0.035, barrelEnd + 0.08); barrelEnd += 0.2; }
  else if (a.muzzle === 'compensator') { add(cyl(0.028, 0.07), metal, 0, 0.035, barrelEnd); }
  if (a.grip) add(box(0.035, 0.12, 0.04), dark, 0, -0.1, d.grip);
  if (a.mag) add(box(0.05, 0.1, 0.07), toon('#3a2a1a'), 0, -0.3, 0.1);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.035, barrelEnd + 0.04);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}
