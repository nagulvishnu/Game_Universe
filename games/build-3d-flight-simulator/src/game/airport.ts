import * as THREE from 'three';
import { airportStructures, type Airport, type Helipad, HELIPADS } from './worldData';
import { helipadTexture, runwayTexture, taxiTexture, windowTextures } from './textures';
import { makeLightPoints } from './environment';
import { buildAircraft } from './aircraftModels';
import { AIRCRAFT, LIVERIES, getAircraft } from './aircraft';
import { hash2 } from './noise';

export interface AirportAsset {
  group: THREE.Group;
  lights: ReturnType<typeof makeLightPoints>;
  windowMats: THREE.MeshStandardMaterial[];
}

const surf = (color: number, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

function flat(w: number, l: number, m: THREE.Material, x: number, z: number, y: number) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), m);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildAirport(ap: Airport): AirportAsset {
  const group = new THREE.Group();
  group.position.set(ap.x, ap.elev, ap.z);
  group.rotation.y = -ap.heading;
  const L = ap.length;
  const W = ap.width;
  const big = ap.kind === 'international';
  const windowMats: THREE.MeshStandardMaterial[] = [];

  // runway
  const rm = new THREE.MeshStandardMaterial({ map: runwayTexture(ap), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  group.add(flat(W, L, rm, 0, 0, 0.07));
  // shoulders / overrun
  group.add(flat(W + 16, L + 120, surf(0x55595d, 0.95), 0, 0, 0.03));
  // taxiway
  const tt = taxiTexture().clone();
  tt.needsUpdate = true;
  tt.repeat.set(1, (L + 200) / 60);
  group.add(flat(22, L + 200, new THREE.MeshStandardMaterial({ map: tt, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 110, 0, 0.05));
  const conn = surf(0x4a4d52);
  for (const z of [-(L / 2 - 120), L / 2 - 120, 0]) group.add(flat(110, 22, conn, 55, z, 0.045));
  // apron
  const apronW = big ? 220 : 110;
  const apronL = big ? Math.min(700, L * 0.3) : 170;
  group.add(flat(apronW, apronL, surf(0x8f9298), 125 + apronW / 2, 0, 0.04));

  // structures
  const winM = windowTextures();
  for (const s of airportStructures(ap)) {
    const x = s.v;
    const z = -s.u;
    const h = s.h;
    if (s.type === 'terminal' || s.type === 'concourse') {
      const mm = winM.map.clone();
      const em = winM.emissive.clone();
      mm.needsUpdate = em.needsUpdate = true;
      mm.repeat.set(Math.max(1, s.d / 28), Math.max(0.5, h / 30));
      em.repeat.copy(mm.repeat);
      const m = new THREE.MeshStandardMaterial({ map: mm, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, color: 0xcfd8e2, roughness: 0.4, metalness: 0.3 });
      windowMats.push(m);
      const b = new THREE.Mesh(new THREE.BoxGeometry(s.w, h, s.d), m);
      b.position.set(x, h / 2, z);
      b.castShadow = b.receiveShadow = true;
      group.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(s.w + 2, 1.2, s.d + 2), new THREE.MeshStandardMaterial({ color: 0x6b7078, roughness: 0.8 }));
      roof.position.set(x, h + 0.6, z);
      roof.castShadow = true;
      group.add(roof);
    } else if (s.type === 'hangar') {
      const roofM = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide });
      // simple: box walls + half-cylinder roof
      const walls = new THREE.Mesh(new THREE.BoxGeometry(s.w, h * 0.55, s.d), new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.7 }));
      walls.position.set(x, h * 0.275, z);
      walls.castShadow = walls.receiveShadow = true;
      group.add(walls);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(s.w / 2, s.w / 2, s.d, 18, 1, false, Math.PI / 2, Math.PI), roofM);
      roof.rotation.set(Math.PI / 2, 0, 0);
      roof.scale.set(1, 1, (h * 0.45) / (s.w / 2));
      roof.position.set(x, h * 0.55, z);
      roof.castShadow = true;
      // cylinder axis after rotation.x=PI/2 is along z; thetaStart 0..PI is the +z half before rotation -> becomes upward
      group.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.8, h * 0.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x3c424a, roughness: 0.6 }));
      door.position.set(x - s.w / 2 - 0.1, h * 0.25, z);
      door.rotation.y = Math.PI / 2;
      group.add(door);
    } else if (s.type === 'tower') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(s.w * 0.45, s.w * 0.6, h, 12), new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.6 }));
      shaft.position.set(x, h / 2, z);
      shaft.castShadow = true;
      group.add(shaft);
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(s.w * 1.0, s.w * 0.7, h * 0.13, 12), new THREE.MeshStandardMaterial({ color: 0x1b3550, roughness: 0.15, metalness: 0.7, emissive: 0x0a1624 }));
      cab.position.set(x, h + h * 0.05, z);
      cab.castShadow = true;
      group.add(cab);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(s.w * 1.1, s.w * 1.1, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0x555a60 }));
      cap.position.set(x, h + h * 0.12, z);
      group.add(cap);
    } else {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(s.w / 2, s.w / 2, h, 16), new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.5 }));
      tank.position.set(x, h / 2, z);
      tank.castShadow = true;
      group.add(tank);
    }
  }

  // parked aircraft
  if (big) {
    for (let i = 0; i < 3; i++) {
      const lv = LIVERIES[Math.floor(hash2(i, ap.x | 0, 3) * LIVERIES.length) % LIVERIES.length];
      const m = buildAircraft(getAircraft(i === 1 ? 'titan90' : 'liner320'), lv);
      const sp = i === 1 ? getAircraft('titan90') : getAircraft('liner320');
      m.root.position.set(225, -sp.wheels[0].y + 0.04, (i - 1) * 190 - 20);
      m.root.rotation.y = -Math.PI / 2 + (i === 1 ? Math.PI : 0) * 0;
      group.add(m.root);
    }
  } else {
    const m = buildAircraft(AIRCRAFT[5], LIVERIES[(ap.x | 0) % 2 === 0 ? 1 : 2]);
    m.root.position.set(165, 1.5, 30);
    m.root.rotation.y = -Math.PI / 2;
    group.add(m.root);
    const h = buildAircraft(AIRCRAFT[4], LIVERIES[3]);
    h.root.position.set(165, 1.65, -40);
    h.root.rotation.y = -Math.PI / 2 + 0.6;
    group.add(h.root);
  }

  // lights
  const pos: number[] = [];
  const col: number[] = [];
  const add = (x: number, y: number, z: number, c: [number, number, number]) => { pos.push(x, y, z); col.push(...c); };
  const WHITE: [number, number, number] = [1, 0.95, 0.82];
  const GREEN: [number, number, number] = [0.1, 1, 0.25];
  const RED: [number, number, number] = [1, 0.12, 0.08];
  const BLUE: [number, number, number] = [0.15, 0.3, 1];
  const AMBER: [number, number, number] = [1, 0.7, 0.2];
  for (let z = -L / 2; z <= L / 2; z += 55) {
    const amber = Math.abs(z) > L / 2 - 500;
    add(-W / 2 - 1.2, 0.5, z, amber ? AMBER : WHITE);
    add(W / 2 + 1.2, 0.5, z, amber ? AMBER : WHITE);
  }
  for (let x = -W / 2; x <= W / 2; x += 3.2) {
    add(x, 0.5, L / 2 + 1.5, GREEN);
    add(x, 0.5, -L / 2 - 1.5, RED);
  }
  for (const dir of [1, -1]) {
    for (let d = 30; d <= 900; d += 30) {
      add(0, 0.8 + d * 0.0015, dir * (L / 2 + d), WHITE);
      if (d % 150 === 0) for (let k = 1; k <= 4; k++) { add(k * 2.6, 0.8, dir * (L / 2 + d), WHITE); add(-k * 2.6, 0.8, dir * (L / 2 + d), WHITE); }
    }
  }
  for (let i = 0; i < 4; i++) {
    add(-(W / 2 + 14 + i * 7), 0.9, L / 2 - 320, i < 2 ? WHITE : RED);
    add(W / 2 + 14 + i * 7, 0.9, -(L / 2 - 320), i < 2 ? WHITE : RED);
  }
  for (let z = -L / 2 - 90; z <= L / 2 + 90; z += 45) { add(110 - 12, 0.4, z, BLUE); add(110 + 12, 0.4, z, BLUE); }
  for (const s of airportStructures(ap)) {
    if (s.type === 'tower') add(s.v, s.h * 1.25, -s.u, RED);
    if (s.type === 'terminal') for (let k = -2; k <= 2; k++) add(s.v - s.w / 2 - 4, 9, -s.u + k * (s.d / 5), WHITE);
  }
  if (big) for (let z = -300; z <= 300; z += 100) add(190, 14, z, WHITE);
  const lights = makeLightPoints(pos, col, 2.6);
  group.add(lights.points);
  return { group, lights, windowMats };
}

export function buildHelipad(h: Helipad) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(20, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: helipadTexture(), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }),
  );
  m.position.set(h.x, h.elev + 0.32, h.z);
  m.receiveShadow = true;
  g.add(m);
  return g;
}

export const ALL_HELIPADS = HELIPADS;
