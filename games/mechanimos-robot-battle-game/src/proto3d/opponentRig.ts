/**
 * Phase 7 — SENTINEL-X placeholder opponent.
 *
 * Visually distinct from AURORA-01: heavier, angular, red/orange palette.
 * Assembled entirely from existing Three.js primitives — no external assets.
 * NOT a canonical Mechanimo; never registered in the roster.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- materials ----------
function mkMats() {
  return {
    hull:    new THREE.MeshStandardMaterial({ color: 0x3a1a0a, metalness: 0.88, roughness: 0.35 }),
    plate:   new THREE.MeshStandardMaterial({ color: 0x5c2a10, metalness: 0.82, roughness: 0.42 }),
    light:   new THREE.MeshStandardMaterial({ color: 0x8a4020, metalness: 0.75, roughness: 0.38 }),
    dark:    new THREE.MeshStandardMaterial({ color: 0x0e0806, metalness: 0.6,  roughness: 0.6  }),
    joint:   new THREE.MeshStandardMaterial({ color: 0x1a0e06, metalness: 0.95, roughness: 0.22 }),
    acc:     new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff6a00, emissiveIntensity: 1.8, metalness: 0.3, roughness: 0.3 }),
    accDim:  new THREE.MeshStandardMaterial({ color: 0xc04000, emissive: 0xc04000, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.4 }),
    tire:    new THREE.MeshStandardMaterial({ color: 0x0a0806, metalness: 0.2,  roughness: 0.9  }),
    rim:     new THREE.MeshStandardMaterial({ color: 0x8a6040, metalness: 0.9,  roughness: 0.25 }),
    glass:   new THREE.MeshStandardMaterial({ color: 0xff8040, metalness: 0.9,  roughness: 0.1, emissive: 0x5a1800, emissiveIntensity: 0.5 }),
  };
}

function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, rot?: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function mergeGroup(g: THREE.Group, disposables: { dispose(): void }[]): void {
  const buckets = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of [...g.children]) {
    if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      const list = buckets.get(child.material) ?? [];
      list.push(child as THREE.Mesh);
      buckets.set(child.material, list);
    }
  }
  for (const [mat, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geos: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      m.updateMatrix();
      let geo = m.geometry.clone();
      if (geo.index) { const n = geo.toNonIndexed(); geo.dispose(); geo = n; }
      for (const name of Object.keys(geo.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
      }
      geo.applyMatrix4(m.matrix);
      geos.push(geo);
    }
    const merged = mergeGeometries(geos, false);
    for (const geo of geos) geo.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (const m of meshes) { g.remove(m); disposables.push(m.geometry); }
    g.add(mesh);
    disposables.push(merged);
  }
}

export interface OpponentRig {
  root: THREE.Group;
  accents: THREE.MeshStandardMaterial[];
  /** Idle bob animation — call each frame with elapsed time */
  animateIdle(time: number): void;
  /** Attack flash — call with t in [0,1] */
  animateAttack(t: number): void;
  dispose(): void;
}

export function buildOpponentRig(): OpponentRig {
  const root = new THREE.Group();
  root.name = 'sentinelX';
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };

  const mats = mkMats();
  for (const m of Object.values(mats)) track(m);
  const accents = [mats.acc, mats.accDim];

  // ---- body ----
  const body = new THREE.Group();
  body.name = 'body';
  body.add(rbox(1.8, 0.9, 2.8, 0.1, mats.hull));                    // main hull
  body.add(rbox(1.6, 0.12, 2.4, 0.04, mats.plate, 0, 0.48, 0));     // top deck
  body.add(rbox(1.84, 0.08, 2.2, 0.03, mats.dark, 0, -0.46, 0));    // undertray
  // side armour slabs
  for (const s of [-1, 1]) {
    body.add(rbox(0.14, 0.6, 2.0, 0.04, mats.plate, s * 0.96, 0, 0));
    body.add(rbox(0.06, 0.3, 0.5, 0.02, mats.acc, s * 1.04, 0.1, 0.6));  // side glow
  }
  // cockpit / head block
  body.add(rbox(1.0, 0.5, 1.0, 0.1, mats.plate, 0, 0.68, -0.3));
  body.add(rbox(0.7, 0.28, 0.7, 0.08, mats.glass, 0, 0.82, -0.28));
  // chest energy core
  body.add(rbox(0.5, 0.3, 0.12, 0.04, mats.acc, 0, 0.2, 1.4));
  body.add(rbox(0.22, 0.18, 0.08, 0.02, mats.accDim, 0, 0.2, 1.52));
  // front grille
  for (let i = 0; i < 4; i++) body.add(rbox(1.2, 0.04, 0.06, 0.01, mats.dark, 0, -0.1 + i * 0.08, 1.44));
  // headlights
  for (const s of [-1, 1]) body.add(rbox(0.36, 0.08, 0.06, 0.02, mats.acc, s * 0.5, 0.06, 1.46));
  mergeGroup(body, disposables);
  body.position.set(0, 0.55, 0);
  root.add(body);

  // ---- arms (shoulder blocks) ----
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1] as const) {
    const arm = new THREE.Group();
    arm.name = s === -1 ? 'armL' : 'armR';
    arm.add(rbox(0.22, 0.9, 0.44, 0.06, mats.hull));
    arm.add(rbox(0.1, 0.7, 0.32, 0.03, mats.plate, s * 0.08, 0, 0));
    arm.add(rbox(0.06, 0.3, 0.06, 0.01, mats.acc, s * 0.12, -0.2, 0.2));
    // fist
    arm.add(rbox(0.3, 0.28, 0.34, 0.07, mats.dark, 0, -0.62, 0.04));
    arm.add(rbox(0.08, 0.06, 0.06, 0.01, mats.acc, 0, -0.56, 0.2));
    mergeGroup(arm, disposables);
    arm.position.set(s * 1.12, 1.8, 0);
    root.add(arm);
    arms.push(arm);
  }

  // ---- legs ----
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1] as const) {
    const leg = new THREE.Group();
    leg.name = s === -1 ? 'legL' : 'legR';
    leg.add(rbox(0.36, 0.7, 0.4, 0.07, mats.hull));                  // thigh
    leg.add(rbox(0.28, 0.55, 0.3, 0.05, mats.plate, 0, -0.62, 0));   // shin
    leg.add(rbox(0.06, 0.3, 0.04, 0.01, mats.acc, 0, -0.5, 0.18));   // shin glow
    leg.add(rbox(0.38, 0.14, 0.6, 0.05, mats.dark, 0, -1.0, 0.1));   // foot
    leg.add(rbox(0.3, 0.08, 0.2, 0.03, mats.plate, 0, -0.96, 0.36)); // toe
    mergeGroup(leg, disposables);
    leg.position.set(s * 0.44, 1.1, 0);
    root.add(leg);
    legs.push(leg);
  }

  // ---- wheels (4 simple) ----
  const wheelPositions = [
    [-1.0, 0.36, 1.1], [1.0, 0.36, 1.1],
    [-1.0, 0.36, -1.1], [1.0, 0.36, -1.1],
  ] as const;
  const wheelGrp = new THREE.Group();
  for (const [wx, wy, wz] of wheelPositions) {
    const w = new THREE.Group();
    w.add(cyl(0.34, 0.34, 0.24, mats.tire, 0, 0, 0, [0, 0, Math.PI / 2]));
    w.add(cyl(0.2, 0.2, 0.04, mats.rim, wx > 0 ? 0.13 : -0.13, 0, 0, [0, 0, Math.PI / 2]));
    w.add(cyl(0.06, 0.06, 0.04, mats.acc, wx > 0 ? 0.14 : -0.14, 0, 0, [0, 0, Math.PI / 2]));
    mergeGroup(w, disposables);
    w.position.set(wx, wy, wz);
    wheelGrp.add(w);
  }
  root.add(wheelGrp);

  // ---- burst ring (reuse same pattern as AURORA-01) ----
  const ringGeo = track(new THREE.TorusGeometry(1, 0.05, 8, 36));
  const ringMat = track(new THREE.MeshBasicMaterial({
    color: 0xff6a00, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const burstRing = new THREE.Mesh(ringGeo, ringMat);
  burstRing.rotation.x = -Math.PI / 2;
  burstRing.position.y = 0.06;
  burstRing.visible = false;
  root.add(burstRing);

  // store refs for animation
  const bodyRef = body;
  const armRefs = arms;
  const legRefs = legs;

  return {
    root,
    accents,
    animateIdle(time: number) {
      bodyRef.position.y = 0.55 + Math.sin(time * 1.8) * 0.04;
      bodyRef.rotation.z = Math.sin(time * 1.1) * 0.018;
      for (let i = 0; i < armRefs.length; i++) {
        armRefs[i].rotation.x = Math.sin(time * 1.8 + i * Math.PI) * 0.06;
      }
      for (let i = 0; i < legRefs.length; i++) {
        legRefs[i].rotation.x = Math.sin(time * 1.8 + i * Math.PI) * 0.04;
      }
    },
    animateAttack(t: number) {
      // lean forward and flash accent intensity
      bodyRef.rotation.x = -Math.sin(Math.PI * t) * 0.22;
      const intensity = 1.8 + Math.sin(Math.PI * t) * 2.5;
      for (const a of accents) a.emissiveIntensity = intensity;
      // right arm punch
      if (armRefs[1]) {
        armRefs[1].rotation.x = -Math.sin(Math.PI * t) * 1.4;
        armRefs[1].position.z = Math.sin(Math.PI * t) * 0.5;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    },
  };
}
